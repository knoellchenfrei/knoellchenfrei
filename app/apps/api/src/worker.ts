/**
 * ParkingZone API — a Cloudflare Worker.
 *
 * Two jobs the static build cannot do:
 *
 * 1. **Cache the Berlin WFS.** gdi.berlin.de does send
 *    `Access-Control-Allow-Origin: *`, so this is not a CORS workaround: it
 *    keeps a public agency's infrastructure from being hit once per app open,
 *    and lets us serve the 49 MB segment layer as a small derived answer.
 *    For sources whose CORS posture is unknown — the live charging-point feed
 *    on api.viz.berlin.de, for one — it is also the only way in.
 *
 * 2. **Hold sightings.** Shared, short-lived, server-side state — the one thing
 *    a static host genuinely cannot provide.
 *
 * Cost: the free tier covers 100k requests/day, 100k D1 reads/day and 1k D1
 * writes/day. Cache hits are the common path and cost no upstream traffic.
 */

import {
  isFeedbackKind,
  markFor,
  parseTelegramUpdate,
  tidyFeedback,
  windowStart,
} from '@parkingzone/core'

// The one place the worker does NOT re-implement a core rule. Everything else
// here is deliberately independent, but the heat grid's cell ids are stored:
// a second implementation that drifted by a metre would silently scatter four
// weeks of tallies across neighbouring cells.

/// <reference types="@cloudflare/workers-types" />

export interface Env {
  CACHE: KVNamespace
  DB: D1Database
  /** Comma-separated origins allowed to call this API. */
  ALLOWED_ORIGINS?: string
  /**
   * Secret mixed into the client hash. Set it, and rotate it daily:
   * `wrangler secret put CLIENT_SALT`. Without it the hash is brute-forceable
   * back to an IP in minutes.
   */
  CLIENT_SALT?: string
  /**
   * Bot-Token von @BotFather. Fehlt er, gibt es den Webhook nicht — dieselbe
   * Regel wie beim Feedback: Was nicht eingerichtet ist, existiert auch nicht
   * als Endpunkt.
   */
  TELEGRAM_TOKEN?: string
  /**
   * Beliebiges Geheimnis, das beim Setzen des Webhooks als `secret_token`
   * übergeben wird. Telegram schickt es in jeder Zustellung zurück. Die
   * Webhook-Adresse ist sonst nur durch Unkenntnis geschützt, und "niemand
   * kennt sie" ist keine Zugangskontrolle.
   */
  TELEGRAM_SECRET?: string
}

const WFS_BASE = 'https://gdi.berlin.de/services/wfs'

/**
 * How long each layer may be served from cache.
 *
 * Zone boundaries and fees change on the order of months — Friedrichshain-
 * Kreuzberg's zones 58 and 68 arrived over a whole spring. A day is already
 * far fresher than the data changes.
 */
const LAYERS: Record<string, { service: string; typeName: string; ttlSeconds: number }> = {
  zones: {
    service: 'parkraumbewirtschaftung',
    typeName: 'parkraumbewirtschaftung:parkzonen',
    ttlSeconds: 86_400,
  },
  parkAndRide: {
    service: 'park_and_ride',
    typeName: 'park_and_ride:park_and_ride',
    ttlSeconds: 86_400,
  },
  accessible: {
    service: 'behindertenparkplaetze',
    typeName: 'behindertenparkplaetze:bpark',
    ttlSeconds: 86_400,
  },
}

/** Matches the client-side confidence model: nothing outlives this. */
const SIGHTING_MAX_AGE_MS = 90 * 60 * 1000
/** Reports per client per hour. Enough for honest use, not for flooding. */
const REPORT_LIMIT_PER_HOUR = 6
/** Votes per client per hour. Higher than reports: voting is the cheap action. */
const VOTE_LIMIT_PER_HOUR = 40

function corsHeaders(request: Request, env: Env): Record<string, string> {
  const origin = request.headers.get('Origin') ?? ''
  const allowed = (env.ALLOWED_ORIGINS ?? '').split(',').map((value) => value.trim())
  // An unset allowlist means "same-origin only": no header, so the browser
  // blocks cross-origin reads. Failing closed beats a wildcard by default.
  if (!allowed.includes(origin)) return {}
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    Vary: 'Origin',
  }
}

function json(body: unknown, init: ResponseInit = {}, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...extra, ...init.headers },
  })
}

/**
 * A coarse client identifier for rate limiting and one-vote-per-report.
 *
 * Deliberately does NOT include the User-Agent: a caller controls that header,
 * so a new value per request minted a new identity and defeated every limit
 * here. Only Cloudflare-set values are used.
 *
 * The salt matters. Without one, 64 bits over the IPv4 space is brute-forceable
 * offline in minutes, which makes the stored hash a pseudonym for an IP address
 * rather than an anonymous token. Rotating it daily also caps how long two
 * actions can be linked to each other.
 */
async function clientHash(request: Request, env: Env): Promise<string> {
  const material = [
    request.headers.get('CF-Connecting-IP') ?? '',
    env.CLIENT_SALT ?? '',
  ].join('|')
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(material))
  return [...new Uint8Array(digest)]
    .slice(0, 8)
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

/**
 * Rejects cross-site writes that CORS does not stop.
 *
 * A POST with no body, or with `Content-Type: text/plain`, is a "simple
 * request": the browser sends it without a preflight, so any other site could
 * make its visitors post here under their own IP. Requiring JSON forces a
 * preflight, which the CORS allowlist then answers for.
 */
function rejectsCrossSite(request: Request, env: Env): Response | null {
  const contentType = request.headers.get('Content-Type') ?? ''
  if (!contentType.startsWith('application/json')) {
    return json({ error: 'Content-Type: application/json required' }, { status: 415 })
  }
  const origin = request.headers.get('Origin')
  const allowed = (env.ALLOWED_ORIGINS ?? '').split(',').map((value) => value.trim())
  if (origin !== null && !allowed.includes(origin)) {
    return json({ error: 'origin not allowed' }, { status: 403 })
  }
  return null
}

/** Positions are stored at ~10 m, matching what the client sends. */
function coarsen(value: number): number {
  return Math.round(value * 1e4) / 1e4
}

/**
 * Wie oft dieser Client in der letzten Stunde geschrieben hat.
 *
 * Die Zeitspalte heißt je Tabelle anders, deshalb die Zuordnung statt einer
 * interpolierten Spalte: Der einzige in die Abfrage eingesetzte Bezeichner
 * stammt aus dieser Konstante, nie aus einer Anfrage.
 */
const RATE_COLUMNS = {
  sightings: 'reported_at',
  votes: 'voted_at',
  feedback: 'created_at',
} as const

async function countRecent(
  env: Env,
  table: keyof typeof RATE_COLUMNS,
  hash: string
): Promise<number> {
  const since = Date.now() - 3_600_000
  const column = RATE_COLUMNS[table]
  const row = await env.DB.prepare(
    `SELECT COUNT(*) AS n FROM ${table} WHERE client_hash = ? AND ${column} > ?`
  )
    .bind(hash, since)
    .first<{ n: number }>()
  return row?.n ?? 0
}

async function serveLayer(name: string, env: Env, cors: Record<string, string>): Promise<Response> {
  const layer = LAYERS[name]
  if (layer === undefined) return json({ error: 'unknown layer' }, { status: 404 }, cors)

  const key = `wfs:${name}`
  const cached = await env.CACHE.get(key)
  if (cached !== null) {
    return new Response(cached, {
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': `public, max-age=${layer.ttlSeconds}`,
        'X-Cache': 'HIT',
        ...cors,
      },
    })
  }

  const params = new URLSearchParams({
    service: 'WFS',
    version: '2.0.0',
    request: 'GetFeature',
    typeNames: layer.typeName,
    outputFormat: 'application/json',
    srsName: 'urn:ogc:def:crs:EPSG::4326',
  })

  let body: string
  try {
    const upstream = await fetch(`${WFS_BASE}/${layer.service}?${params}`, {
      signal: AbortSignal.timeout(20_000),
    })
    if (!upstream.ok) throw new Error(`HTTP ${upstream.status}`)
    body = await upstream.text()
    // A 200 carrying something that is not a FeatureCollection would poison the
    // cache for a whole day, so it is checked before storing.
    const parsed = JSON.parse(body) as { type?: string; features?: unknown[] }
    if (parsed.type !== 'FeatureCollection' || !Array.isArray(parsed.features)) {
      throw new Error('upstream did not return a FeatureCollection')
    }
  } catch (error) {
    return json(
      { error: 'upstream unavailable', detail: (error as Error).message },
      { status: 502 },
      cors
    )
  }

  await env.CACHE.put(key, body, { expirationTtl: layer.ttlSeconds })
  return new Response(body, {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': `public, max-age=${layer.ttlSeconds}`,
      'X-Cache': 'MISS',
      ...cors,
    },
  })
}

async function listSightings(env: Env, cors: Record<string, string>): Promise<Response> {
  const cutoff = Date.now() - SIGHTING_MAX_AGE_MS
  const { results } = await env.DB.prepare(
    'SELECT id, lon, lat, reported_at, confirmations, disputes FROM sightings WHERE reported_at > ? ORDER BY reported_at DESC LIMIT 500'
  )
    .bind(cutoff)
    .all<{
      id: string
      lon: number
      lat: number
      reported_at: number
      confirmations: number
      disputes: number
    }>()

  return json(
    {
      sightings: results.map((row) => ({
        id: row.id,
        lon: row.lon,
        lat: row.lat,
        reportedAt: row.reported_at,
        confirmations: row.confirmations,
        disputes: row.disputes,
      })),
    },
    {},
    { 'Cache-Control': 'no-store', ...cors }
  )
}

/**
 * The heatmap's tallies inside the retention window.
 *
 * The window is computed here, not taken from the query string: a client asking
 * for `since=1970-01-01` must not be able to read further back than the app
 * promises to keep.
 */
async function listMarks(env: Env, cors: Record<string, string>): Promise<Response> {
  const since = windowStart({ now: Date.now() })
  const { results } = await env.DB.prepare('SELECT day, cell, hour FROM marks WHERE day >= ?')
    .bind(since)
    .all<{ day: string; cell: string; hour: number | null }>()
  return json({ since, marks: results ?? [] }, { status: 200 }, cors)
}

/** A device is "here" if it pinged within this window. */
const ONLINE_WINDOW_MS = 5 * 60_000
/** Visit rows are kept a day beyond the count, so a day boundary is not a cliff. */
const VISIT_KEEP_MS = 2 * 86_400_000

/** `YYYY-MM-DD` in Berlin, matching the day key everything else uses. */
function berlinDay(at: number): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Berlin',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(at))
}

/**
 * Records that a device is here and answers with the live figures.
 *
 * The artifact runtime answers "how many are looking right now" from its own
 * presence channel; a static host has none, so the same question is answered
 * from the freshness of these rows. Nothing else about the device is stored.
 */
async function recordVisit(
  request: Request,
  env: Env,
  cors: Record<string, string>
): Promise<Response> {
  const blocked = rejectsCrossSite(request, env)
  if (blocked !== null) return blocked

  let payload: { id?: unknown } | null
  try {
    payload = (await request.json()) as typeof payload
  } catch {
    return json({ error: 'invalid JSON' }, { status: 400 }, cors)
  }
  const id = String(payload?.id ?? '')
  // The id must be the client's own `<day>-<nonce>`; anything else would let a
  // caller write into another device's row or invent an unbounded number.
  const match = /^(\d{4}-\d{2}-\d{2})-[\w-]{1,32}$/.exec(id)
  if (match === null) return json({ error: 'bad id' }, { status: 400 }, cors)

  const now = Date.now()
  const today = berlinDay(now)
  // A row may only be written for today: back-dating one would inflate a past
  // day's count for as long as it is kept.
  if (match[1] !== today) return json({ error: 'stale day' }, { status: 422 }, cors)

  await env.DB.prepare('INSERT OR REPLACE INTO visits (id, day, seen_at) VALUES (?, ?, ?)')
    .bind(id, today, now)
    .run()

  const counts = await env.DB.prepare(
    'SELECT (SELECT COUNT(*) FROM visits WHERE day = ?) AS today,' +
      ' (SELECT COUNT(*) FROM visits WHERE seen_at > ?) AS online'
  )
    .bind(today, now - ONLINE_WINDOW_MS)
    .first<{ today: number; online: number }>()

  return json({ today: counts?.today ?? 0, online: counts?.online ?? 0 }, { status: 200 }, cors)
}

/** Deckelt, was eine Person in einer Stunde abladen kann. */
const FEEDBACK_LIMIT_PER_HOUR = 4
/** Rückmeldungen sind kein Betriebsdatum — nach drei Monaten sind sie erledigt. */
const FEEDBACK_MAX_AGE_MS = 90 * 86_400_000

/**
 * Nimmt eine Rückmeldung entgegen. Es gibt bewusst kein Gegenstück zum Lesen:
 * die einzige Tabelle mit Freitext von Fremden soll nicht über eine öffentliche
 * URL abrufbar sein, nur weil es bequem wäre.
 */
async function createFeedback(
  request: Request,
  env: Env,
  cors: Record<string, string>
): Promise<Response> {
  const blocked = rejectsCrossSite(request, env)
  if (blocked !== null) return blocked

  const hash = await clientHash(request, env)
  if ((await countRecent(env, 'feedback', hash)) >= FEEDBACK_LIMIT_PER_HOUR) {
    return json({ error: 'rate limited' }, { status: 429 }, cors)
  }

  let payload: { kind?: unknown; text?: unknown } | null
  try {
    payload = (await request.json()) as typeof payload
  } catch {
    return json({ error: 'invalid JSON' }, { status: 400 }, cors)
  }
  if (payload === null || typeof payload !== 'object') {
    return json({ error: 'expected a JSON object' }, { status: 400 }, cors)
  }

  const kind = payload.kind
  if (!isFeedbackKind(kind)) {
    return json({ error: 'unknown kind' }, { status: 422 }, cors)
  }

  // Dieselbe Säuberung wie im Client, aus derselben Funktion: der Client
  // lässt sich umgehen, und zwei Implementierungen driften auseinander.
  const text = tidyFeedback(String(payload.text ?? ''))
  if (text.length === 0) {
    return json({ error: 'empty' }, { status: 422 }, cors)
  }

  await env.DB.prepare(
    'INSERT INTO feedback (id, kind, text, created_at, client_hash) VALUES (?, ?, ?, ?, ?)'
  )
    // Auf die Stunde gerundet: Die exakte Minute sagt über einen Vorschlag
    // nichts und grenzt ein, wer ihn geschrieben haben kann.
    .bind(crypto.randomUUID(), kind, text, Math.floor(Date.now() / 3_600_000) * 3_600_000, hash)
    .run()

  return json({ ok: true }, { status: 201 }, cors)
}

async function createSighting(
  request: Request,
  env: Env,
  cors: Record<string, string>
): Promise<Response> {
  const blocked = rejectsCrossSite(request, env)
  if (blocked !== null) return blocked

  const hash = await clientHash(request, env)
  if ((await countRecent(env, 'sightings', hash)) >= REPORT_LIMIT_PER_HOUR) {
    return json({ error: 'rate limited' }, { status: 429 }, cors)
  }

  let payload: { lon?: unknown; lat?: unknown } | null
  try {
    payload = (await request.json()) as typeof payload
  } catch {
    return json({ error: 'invalid JSON' }, { status: 400 }, cors)
  }
  // `null` is valid JSON and would throw on property access below.
  if (payload === null || typeof payload !== 'object') {
    return json({ error: 'expected a JSON object' }, { status: 400 }, cors)
  }

  const lon = Number(payload.lon)
  const lat = Number(payload.lat)
  // Berlin's bounding box. A report outside it is a bug or an abuse attempt;
  // either way it has no business in a Berlin parking app.
  if (!(lon >= 13.0 && lon <= 13.8 && lat >= 52.3 && lat <= 52.7)) {
    return json({ error: 'position outside Berlin' }, { status: 422 }, cors)
  }

  const id = await storeSighting(env, lon, lat, hash)
  return json({ id }, { status: 201 }, cors)
}

/**
 * Schreibt eine Meldung und den zugehörigen Strich der Heatmap.
 *
 * Eine Stelle für beide Wege — Web und Telegram. Zwei Einfügepfade, die
 * auseinanderlaufen, wären genau die Art Fehler, die niemandem auffällt: Die
 * Karte zeigte dann Meldungen ohne Strich, und die Heatmap bliebe blass,
 * obwohl gemeldet wurde.
 */
async function storeSighting(
  env: Env,
  lon: number,
  lat: number,
  hash: string
): Promise<string> {
  const id = crypto.randomUUID()
  await env.DB.prepare(
    'INSERT INTO sightings (id, lon, lat, reported_at, confirmations, disputes, client_hash) VALUES (?, ?, ?, ?, 0, 0, ?)'
  )
    // Stored coarsened and time-bucketed: a report is also a location record of
    // whoever filed it, and this row is world-readable.
    .bind(id, coarsen(lon), coarsen(lat), Math.floor(Date.now() / 300_000) * 300_000, hash)
    .run()

  // The heatmap's tally is derived here rather than posted by the client: a
  // client that could write marks directly could paint a density it never
  // reported, and only this path is rate-limited.
  const mark = markFor([coarsen(lon), coarsen(lat)], Date.now())
  await env.DB.prepare('INSERT INTO marks (id, day, cell, hour) VALUES (?, ?, ?, ?)')
    .bind(crypto.randomUUID(), mark.day, mark.cell, mark.hour ?? null)
    .run()

  return id
}

async function voteOnSighting(
  request: Request,
  env: Env,
  id: string,
  kind: 'confirm' | 'dispute',
  cors: Record<string, string>
): Promise<Response> {
  const blocked = rejectsCrossSite(request, env)
  if (blocked !== null) return blocked

  const hash = await clientHash(request, env)
  if ((await countRecent(env, 'votes', hash)) >= VOTE_LIMIT_PER_HOUR) {
    return json({ error: 'rate limited' }, { status: 429 }, cors)
  }

  // Check the sighting exists before writing anything. Without this, a POST to
  // any invented id burnt a database write, and the free tier's 1,000 writes a
  // day are exhausted in seconds.
  const target = await env.DB.prepare(
    'SELECT id FROM sightings WHERE id = ? AND reported_at > ?'
  )
    .bind(id, Date.now() - SIGHTING_MAX_AGE_MS)
    .first<{ id: string }>()
  if (target === null) return json({ error: 'not found' }, { status: 404 }, cors)

  // One vote per client per sighting; the primary key does the enforcing, so a
  // duplicate is a no-op rather than an error the caller has to handle.
  const inserted = await env.DB.prepare(
    'INSERT OR IGNORE INTO votes (sighting_id, client_hash, voted_at) VALUES (?, ?, ?)'
  )
    .bind(id, hash, Date.now())
    .run()
  if (inserted.meta.changes === 0) return json({ ok: true, counted: false }, {}, cors)

  const column = kind === 'confirm' ? 'confirmations' : 'disputes'
  const result = await env.DB.prepare(
    `UPDATE sightings SET ${column} = ${column} + 1 WHERE id = ? AND reported_at > ?`
  )
    .bind(id, Date.now() - SIGHTING_MAX_AGE_MS)
    .run()

  if (result.meta.changes === 0) return json({ error: 'not found' }, { status: 404 }, cors)
  return json({ ok: true, counted: true }, {}, cors)
}


/* ------------------------------------------------------------------ Telegram */

const TELEGRAM_HELP = [
  'Hier kannst du melden, wo das Ordnungsamt gerade kontrolliert.',
  '',
  'So geht es: Büroklammer → Standort → „Standort senden“.',
  'Die Meldung erscheint sofort auf der Karte und verfällt nach 90 Minuten.',
  '',
  'Gespeichert wird nur ein gerundeter Punkt und die Uhrzeit auf fünf Minuten genau.',
  'Weder dein Name noch deine Telegram-Kennung landen in der Datenbank.',
].join('\n')

/**
 * Vergleicht zwei Geheimnisse in konstanter Zeit.
 *
 * Ein `===` auf Zeichenketten bricht beim ersten Unterschied ab. Über genug
 * Versuche ist daraus die Laufzeit ablesbar — bei einer Adresse, die jeder
 * aufrufen kann, ist das kein theoretischer Einwand.
 */
function secretMatches(given: string, expected: string): boolean {
  if (given.length !== expected.length) return false
  let diff = 0
  for (let i = 0; i < given.length; i += 1) {
    diff |= given.charCodeAt(i) ^ expected.charCodeAt(i)
  }
  return diff === 0
}

/**
 * Kennung des Absenders — gehasht wie eine IP-Adresse im Web-Pfad.
 *
 * Die Telegram-Nutzerkennung ist dauerhaft und eindeutig; sie im Klartext
 * neben einen Ort zu schreiben wäre ein Bewegungsprofil mit Namensschild.
 * Gebraucht wird sie nur, um die Meldegrenze durchzusetzen, und dafür genügt
 * der Hash.
 */
async function telegramHash(userId: number, env: Env): Promise<string> {
  const material = `telegram:${userId}|${env.CLIENT_SALT ?? ''}`
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(material))
  return [...new Uint8Array(digest)]
    .slice(0, 8)
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

async function telegramSend(env: Env, chatId: number, text: string): Promise<void> {
  const token = env.TELEGRAM_TOKEN
  if (token === undefined) return
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, disable_notification: true }),
    })
  } catch {
    // Die Meldung steht bereits in der Datenbank. Dass die Bestätigung nicht
    // ankam, ist ärgerlich, aber kein Grund, Telegram einen Fehler zu melden —
    // es würde die Zustellung wiederholen und die Meldung doppelt anlegen.
  }
}

/**
 * Der Webhook.
 *
 * Antwortet Telegram *immer* mit 200, sobald das Geheimnis stimmt. Ein
 * Fehlercode lässt Telegram die Zustellung wiederholen, und eine Wiederholung
 * nach einem erfolgreichen Datenbankschreiben legt dieselbe Meldung ein
 * zweites Mal an. Was schiefging, steht in der Antwort an den Absender.
 */
async function telegramWebhook(request: Request, env: Env): Promise<Response> {
  const secret = env.TELEGRAM_SECRET
  // Ohne eingerichteten Bot gibt es diesen Endpunkt nicht — wie beim Feedback.
  if (secret === undefined || env.TELEGRAM_TOKEN === undefined) {
    return json({ error: 'not found' }, { status: 404 }, {})
  }
  const given = request.headers.get('X-Telegram-Bot-Api-Secret-Token') ?? ''
  if (!secretMatches(given, secret)) {
    return json({ error: 'forbidden' }, { status: 403 }, {})
  }

  let update: unknown
  try {
    update = await request.json()
  } catch {
    // Nicht wiederholen lassen: Ungültiges JSON wird beim zweiten Mal auch
    // nicht gültig.
    return json({ ok: true }, {}, {})
  }

  const { intent, sender } = parseTelegramUpdate(update)
  if (sender === null || intent.kind === 'ignore') return json({ ok: true }, {}, {})

  if (intent.kind === 'help') {
    await telegramSend(env, sender.chatId, TELEGRAM_HELP)
    return json({ ok: true }, {}, {})
  }

  if (intent.kind === 'unknown') {
    await telegramSend(
      env,
      sender.chatId,
      'Damit kann ich nichts anfangen. Schick mir einen Standort in Berlin: ' +
        'Büroklammer → Standort. /hilfe erklärt es ausführlicher.'
    )
    return json({ ok: true }, {}, {})
  }

  const hash = await telegramHash(sender.userId, env)
  if ((await countRecent(env, 'sightings', hash)) >= REPORT_LIMIT_PER_HOUR) {
    await telegramSend(
      env,
      sender.chatId,
      `Für diese Stunde reicht es — mehr als ${REPORT_LIMIT_PER_HOUR} Meldungen nimmt der Dienst ` +
        'von einem Absender nicht an. Später gerne wieder.'
    )
    return json({ ok: true }, {}, {})
  }

  await storeSighting(env, intent.lon, intent.lat, hash)
  await telegramSend(
    env,
    sender.chatId,
    'Notiert, danke. Die Meldung steht jetzt auf der Karte und verfällt nach 90 Minuten.'
  )
  return json({ ok: true }, {}, {})
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const cors = corsHeaders(request, env)
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors })

    const url = new URL(request.url)
    const path = url.pathname.replace(/\/+$/, '')

    if (path === '/health') return json({ ok: true }, {}, cors)

    // Vor der CORS-Behandlung und ohne sie: Telegram ist kein Browser, schickt
    // keinen Origin und wird durch das Geheimnis im Kopf ausgewiesen.
    if (path === '/telegram' && request.method === 'POST') {
      return telegramWebhook(request, env)
    }

    const layerMatch = /^\/wfs\/([a-zA-Z]+)$/.exec(path)
    if (layerMatch !== null && request.method === 'GET') {
      return serveLayer(layerMatch[1] as string, env, cors)
    }

    if (path === '/sightings' && request.method === 'GET') return listSightings(env, cors)
    if (path === '/marks' && request.method === 'GET') return listMarks(env, cors)
    if (path === '/visits' && request.method === 'POST') return recordVisit(request, env, cors)
    if (path === '/feedback' && request.method === 'POST') return createFeedback(request, env, cors)
    if (path === '/sightings' && request.method === 'POST') {
      return createSighting(request, env, cors)
    }

    const voteMatch = /^\/sightings\/([\w-]{1,64})\/(confirm|dispute)$/.exec(path)
    if (voteMatch !== null && request.method === 'POST') {
      return voteOnSighting(
        request,
        env,
        voteMatch[1] as string,
        voteMatch[2] as 'confirm' | 'dispute',
        cors
      )
    }

    return json({ error: 'not found' }, { status: 404 }, cors)
  },

  /**
   * Deletes expired sightings. Wired to a cron trigger so the table cannot grow
   * into a movement history even if the read path stops filtering.
   */
  async scheduled(_event: ScheduledController, env: Env): Promise<void> {
    const cutoff = Date.now() - SIGHTING_MAX_AGE_MS
    // Drop the client hash as soon as the rate-limit window has passed, so a
    // still-live sighting stops carrying a pseudonym for its reporter.
    await env.DB.prepare(
      'UPDATE sightings SET client_hash = NULL WHERE client_hash IS NOT NULL AND reported_at <= ?'
    )
      .bind(Date.now() - 3_600_000)
      .run()
    await env.DB.prepare('DELETE FROM sightings WHERE reported_at <= ?').bind(cutoff).run()
    await env.DB.prepare(
      'DELETE FROM votes WHERE sighting_id NOT IN (SELECT id FROM sightings)'
    ).run()
    // Same promise for the long-lived table: deleted, not merely filtered out.
    await env.DB.prepare('DELETE FROM marks WHERE day < ?')
      .bind(windowStart({ now: Date.now() }))
      .run()
    await env.DB.prepare('DELETE FROM visits WHERE seen_at < ?')
      .bind(Date.now() - VISIT_KEEP_MS)
      .run()
    // Der Hash fällt, sobald das Rate-Limit-Fenster durch ist; der Text bleibt
    // 90 Tage und ist dann ohne jeden Bezug zu seinem Absender.
    await env.DB.prepare(
      'UPDATE feedback SET client_hash = NULL WHERE client_hash IS NOT NULL AND created_at <= ?'
    )
      .bind(Date.now() - 3_600_000)
      .run()
    await env.DB.prepare('DELETE FROM feedback WHERE created_at < ?')
      .bind(Date.now() - FEEDBACK_MAX_AGE_MS)
      .run()
  },
}
