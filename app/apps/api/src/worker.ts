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
  BERLIN,
  berlinWallClock,
  CITIES,
  cityAt,
  cityByKey,
  clampEventCount,
  countingWindowStart,
  EVENTS_PER_REQUEST,
  hourFor,
  isEventName,
  isEventValue,
  isFeedbackKind,
  markFor,
  originAllowed,
  parseTelegramUpdate,
  tidyFeedback,
  windowStart,
  ZONE_KEYS,
  type City,
} from '@knoellchenfrei/core'

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

/*
 * Der Worker bedient **alle** Städte aus `CITIES`, nicht eine konfigurierte.
 *
 * Bis zum 6. September 2026 stand hier `CITY` in der Umgebung, ohne Wert
 * Berlin. Die App schaltet seitdem zwischen Berlin und Hamburg um, der Worker
 * nicht — eine Hamburger Meldung bekam `422 position outside Berlin`, und in
 * der App sah das aus, als sei das Melden kaputt.
 *
 * Die Stadt steht jetzt beim Schreiben in der Position (`cityAt`) und beim
 * Lesen in der Anfrage (`?city=`). Eine Zeile ohne Stadt entsteht nicht mehr.
 *
 * Warum eine Spalte und nicht eine Datenbank je Stadt: FreiFahren fährt je
 * Stadt eine eigene D1 *und* einen eigenen Worker. Sauber getrennt, aber
 * n-mal Betrieb — für zwei Städte auf dem Free Tier ist das Aufwand ohne
 * Gegenwert.
 */

/**
 * Die Stadt, in der eine Anfrage lesen will.
 *
 * Die Regel steht in CLAUDE.md und ist hier wörtlich umgesetzt: Ein
 * **fehlender** Parameter fällt auf Berlin zurück — das ist die Stadt, die
 * heute ausgeliefert wird, und ein Client, der die Stadt noch nicht mitschickt,
 * bekommt weiter, was er bisher bekam. Ein **unbekannter** Schlüssel fällt
 * nicht zurück, sondern wird abgewiesen: Wer `?city=hambrug` schickt und
 * schweigend Berliner Meldungen bekommt, sucht den Fehler dort, wo er nicht
 * ist. `cityByKey` wirft dafür bereits; die Meldung nennt die bekannten
 * Schlüssel und wird deshalb weitergereicht statt verschluckt.
 */
type CityChoice = { city: City } | { error: string }

function requestedCity(url: URL): CityChoice {
  const key = url.searchParams.get('city')
  if (key === null || key === '') return { city: BERLIN }
  try {
    return { city: cityByKey(key) }
  } catch (error) {
    return { error: (error as Error).message }
  }
}

/** Alle bekannten Städte als Aufzählung — für Meldungen, die keine verschweigen. */
function cityNames(separator: string): string {
  return CITIES.map((city) => city.name).join(separator)
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
  // An unset allowlist means "same-origin only": no header, so the browser
  // blocks cross-origin reads. Failing closed beats a wildcard by default.
  if (!originAllowed(env.ALLOWED_ORIGINS, origin)) return {}
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
  const salt = env.CLIENT_SALT ?? ''
  // Zweite Sperre hinter der im Router: Wer diese Funktion je aus einem
  // anderen Pfad aufruft, soll nicht versehentlich ungesalzen hashen. Ein
  // ungesalzener Hash ist kein Pseudonym, sondern eine umgeschriebene
  // IP-Adresse.
  if (salt === '') throw new Error('CLIENT_SALT fehlt — ohne Salz kein Client-Hash')
  const material = [request.headers.get('CF-Connecting-IP') ?? '', salt].join('|')
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
  if (origin !== null && !originAllowed(env.ALLOWED_ORIGINS, origin)) {
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

/**
 * Ab wann gezählt wird — und warum das nicht überall dasselbe ist.
 *
 * `feedback` speichert `created_at` **auf die Stunde abgerundet**: Die genaue
 * Minute sagt über einen Vorschlag nichts und grenzt ein, wer ihn geschrieben
 * haben kann. Ein rollendes Ein-Stunden-Fenster über gerundete Werte zählt am
 * Stundenwechsel aber falsch — eine um 10:59 geschriebene Zeile trägt den
 * Stempel 10:00 und fällt um 11:01 aus dem Fenster. Vier Rückmeldungen um
 * 10:59 und vier um 11:01 waren acht in zwei Minuten (Audit-Punkt M-045).
 *
 * Das Fenster reicht deshalb bei `feedback` eine Stunde weiter zurück. Die
 * Grenze ist damit eher zu streng als zu locker, und das ist die richtige
 * Richtung: Eine Rückmeldung ist eine seltene Handlung.
 */
const RATE_WINDOW_MS = 3_600_000

async function countRecent(
  env: Env,
  table: keyof typeof RATE_COLUMNS,
  hash: string
): Promise<number> {
  // `feedback` speichert auf die Stunde gerundet, die übrigen Tabellen auf die
  // Millisekunde — `countingWindowStart` in `core` kennt den Unterschied und
  // ist dort auf genau diesen Stundenwechsel getestet.
  const since = countingWindowStart(
    Date.now(),
    RATE_WINDOW_MS,
    table === 'feedback' ? RATE_WINDOW_MS : 0
  )
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
    // Ins Log, nicht in die Antwort (Audit-Punkt M-092). Die Meldung kommt aus
    // fremder Hand — sie kann interne Adressen, Pfade oder den Aufbau des
    // Dienstes nennen, und ein Aufrufer kann sie erzwingen, indem er eine
    // Ebene anfragt, die der Behörden-WFS gerade nicht mag. `wrangler tail`
    // zeigt sie dem Betreiber; nach außen geht der Zustand, nicht der Grund.
    console.error(`WFS ${layer.service}/${layer.typeName}:`, (error as Error).message)
    return json({ error: 'upstream unavailable' }, { status: 502 }, cors)
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

/**
 * Die lebenden Meldungen einer Stadt.
 *
 * Der Filter ist nicht Kosmetik, obwohl 250 km zwischen den Städten liegen und
 * auf der Karte nichts auffiele: Die 500er-Grenze unten teilen sich sonst alle
 * Städte, und die Zähler in der Oberfläche zählten Hamburger Meldungen für
 * Berlin mit.
 */
async function listSightings(
  env: Env,
  city: City,
  cors: Record<string, string>
): Promise<Response> {
  const cutoff = Date.now() - SIGHTING_MAX_AGE_MS
  const { results } = await env.DB.prepare(
    'SELECT id, lon, lat, reported_at, confirmations, disputes FROM sightings WHERE reported_at > ? AND city = ? ORDER BY reported_at DESC LIMIT 500'
  )
    .bind(cutoff, city.key)
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
async function listMarks(
  env: Env,
  city: City,
  cors: Record<string, string>
): Promise<Response> {
  const since = windowStart({ now: Date.now() })
  const { results } = await env.DB.prepare(
    'SELECT day, cell, hour FROM marks WHERE day >= ? AND city = ?'
  )
    .bind(since, city.key)
    .all<{ day: string; cell: string; hour: number | null }>()
  return json({ since, marks: results ?? [] }, { status: 200 }, cors)
}

/** A device is "here" if it pinged within this window. */
const ONLINE_WINDOW_MS = 5 * 60_000
/**
 * Ab wann ein Ping die Zeile wirklich neu schreibt.
 *
 * Drei Minuten: kurz genug, dass ein Zusehender nie aus dem
 * Fünf-Minuten-Fenster fällt, lang genug, dass aus einem Ping alle zwei
 * Minuten nicht ein Schreibvorgang alle zwei Minuten wird.
 */
const VISIT_REFRESH_MS = 3 * 60_000

/**
 * Obergrenze für **neue** Besuchszeilen an einem Tag.
 *
 * Grosszügig gegen den Betrieb, eng gegen den Missbrauch: Der geschlossene
 * Test hat eine zweistellige Zahl Leser, und selbst ein erfolgreicher Start
 * käme in Berlin nicht an 20.000 Geräte am Tag. Das freie Tagesbudget von D1
 * liegt bei 100.000 Schreibvorgängen; die Grenze lässt also Luft für alles
 * andere, was der Worker am Tag schreibt.
 */
const VISITS_PER_DAY = 20_000
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
 *
 * **Ohne Stadt, und zwar mit Absicht.** Sichtungen und Striche bekamen mit
 * der zweiten Stadt eine Spalte, die Besuche nicht — aus zwei Gründen, von
 * denen jeder für sich reicht:
 *
 * 1. Ein Ping trägt keine Position. Die Stadt wäre also nicht abgeleitet,
 *    sondern **behauptet**: Der Client müsste sie mitschicken, und ein
 *    behaupteter Wert ist keiner, den dieser Worker prüfen kann. Genau das
 *    macht er sonst nirgends — jede andere Zeile hier entsteht aus etwas, das
 *    er selbst festgestellt hat.
 * 2. Die Zahl beantwortet „wie viele benutzen knoellchenfrei gerade", nicht
 *    „wie viele in Berlin". Das ist eine Eigenschaft des Dienstes, keine der
 *    Stadt — und im geschlossenen Test wären zwei geteilte Zahlen vor allem
 *    zwei kleinere.
 *
 * Soll die Zahl eines Tages *je Stadt* gelten, ist der ehrliche Weg nicht eine
 * Spalte aus einer Client-Angabe, sondern eine Stadt im Pfad des Pings, die
 * genauso abgewiesen wird wie ein unbekanntes `?city=` beim Lesen.
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

  // Schreiben nur, wenn die Zeile wirklich veraltet ist.
  //
  // Vorher stand hier `INSERT OR REPLACE`, und das schrieb bei **jedem** Ping.
  // Die App pingt alle zwei Minuten, solange der Tab sichtbar ist — ein
  // Arbeitstag mit einem offenen Tab sind rund 240 Schreibvorgänge, zwei
  // Nutzer sprengen das Tagesbudget des Free Tier (1.000). Das ist keine
  // Missbrauchsrechnung, sondern der Normalbetrieb (Audit-Punkt M-015).
  //
  // `excluded` ist die Zeile, die eingefügt worden wäre; die Bedingung im
  // `DO UPDATE` lässt SQLite die Zeile unangetastet, solange sie frisch genug
  // ist. Die Schwelle liegt unter `ONLINE_WINDOW_MS`, damit ein Besucher nie
  // aus dem Fenster fällt, während er zusieht.
  //
  // Und: **höchstens `VISITS_PER_DAY` neue Zeilen am Tag.** Die Kennung kommt
  // vom Aufrufer, und `<heute>-<beliebig>` erfüllt das Muster beliebig oft —
  // wer will, legt in einer Schleife Millionen Zeilen an, treibt die Zahlen
  // hoch und verbrennt das Schreibbudget. `rejectsCrossSite` hilft dagegen
  // nicht: Es prüft eine Herkunft, und wer keinen Browser benutzt, schickt
  // gar keine (Audit-Punkt M-016).
  //
  // Die Grenze steht im `INSERT` selbst und nicht als zweite Abfrage davor:
  // Zwischen Zählen und Schreiben liegt sonst ein Fenster, in dem zwanzig
  // gleichzeitige Anfragen alle „noch Platz" lesen. `INSERT … SELECT … WHERE`
  // zählt und schreibt in derselben Anweisung.
  //
  // Was das **nicht** löst: Wer die Grenze ausschöpft, sorgt dafür, dass echte
  // Besucher an diesem Tag nicht mehr gezählt werden. Das ist der bewusste
  // Tausch — eine falsche Zahl ist ärgerlich, ein volles Schreibbudget legt
  // die Meldungen mit lahm. Sichtbar wird es daran, dass die Tageszahl exakt
  // auf der Grenze steht.
  //
  // Das `EXISTS` davor ist nicht schmückend, sondern der Grund, warum die
  // Grenze niemanden hinauswirft: Ohne es hielt die Bedingung auch das
  // **Auffrischen** vorhandener Zeilen an, sobald der Tag voll war — die
  // Anzeige „gerade online" wäre dann von selbst auf null gelaufen, während
  // die Leute zusahen. Gegen SQLite nachgemessen, nicht überlegt.
  await env.DB.prepare(
    'INSERT INTO visits (id, day, seen_at) SELECT ?, ?, ?' +
      ' WHERE EXISTS (SELECT 1 FROM visits WHERE id = ?)' +
      ' OR (SELECT COUNT(*) FROM visits WHERE day = ?) < ?' +
      ' ON CONFLICT(id) DO UPDATE SET seen_at = excluded.seen_at' +
      ' WHERE excluded.seen_at - visits.seen_at > ?'
  )
    .bind(id, today, now, id, today, VISITS_PER_DAY, VISIT_REFRESH_MS)
    .run()

  const counts = await env.DB.prepare(
    'SELECT (SELECT COUNT(*) FROM visits WHERE day = ?) AS today,' +
      ' (SELECT COUNT(*) FROM visits WHERE seen_at > ?) AS online'
  )
    .bind(today, now - ONLINE_WINDOW_MS)
    .first<{ today: number; online: number }>()

  return json({ today: counts?.today ?? 0, online: counts?.online ?? 0 }, { status: 200 }, cors)
}

/**
 * Obergrenze für **angenommene** Ereignisse der Nutzungsstatistik an einem Tag.
 *
 * Warum es sie braucht: `/events` ist eine offene Adresse, und D1 zählt jedes
 * `ON CONFLICT DO UPDATE` als geschriebene Zeile. Die Grenze bei `visits`
 * zählt nur *neue* Zeilen und hilft hier deshalb nicht — ohne dieses Budget
 * schriebe ein Aufrufer unbegrenzt auf bestehende Zeilen, und wenn das freie
 * Tagesbudget fällt, fallen die Meldungen mit.
 *
 * 5.000 sind rund fünf Prozent des freien Budgets. Für den geschlossenen Test
 * ist das reichlich; wenn die Zahl je zu klein wird, sagt es die Statistikseite
 * selbst, weil sie exakt auf der Grenze steht.
 */
const EVENTS_PER_DAY = 5_000

/**
 * Nimmt gezählte Ereignisse entgegen — ein Zählwerk, kein Protokoll.
 *
 * Drei Dinge entscheidet **der Server**, nicht der Aufrufer, und jedes davon
 * wäre sonst eine Behauptung:
 *
 *  1. **Tag und Stunde**, aus `Date.now()`. Ein Client-Stempel wäre
 *     rückdatierbar — dieselbe Falle, gegen die `/visits` seine
 *     `stale day`-Regel hat.
 *  2. **Die Auflösung.** Ereignisse, deren Ausprägung ein Ort ist, bekommen
 *     `hour = -1`; nur die anderen bekommen die Stunde. Ort **oder** Zeit, nie
 *     beides — sonst wäre eine Zeile bei kleinen Zahlen ein Einzelereignis mit
 *     Ort und Zeit, und sie stünde neben `sightings` und `marks` in derselben
 *     Datenbank.
 *  3. **Was überhaupt gezählt werden darf.** Name und Ausprägung gegen den
 *     Katalog in `core`, die Zonenkennung gegen die erzeugte Liste. Die
 *     Prüfung im Client ist eine Bequemlichkeit, keine Grenze.
 *
 * Gespeichert wird nichts, was auf eine Person zeigt: keine Kennung, keine
 * Sitzung, keine Reihenfolge, keine IP — auch nicht gehasht. Deshalb steht hier
 * auch kein `clientHash`: Er wäre für nichts anderes da, als ein Pseudonym zu
 * schaffen, das es sonst nicht gäbe.
 */
async function recordEvents(
  request: Request,
  env: Env,
  cors: Record<string, string>
): Promise<Response> {
  const blocked = rejectsCrossSite(request, env)
  if (blocked !== null) return blocked

  let payload: { city?: unknown; events?: unknown } | null
  try {
    payload = (await request.json()) as typeof payload
  } catch {
    return json({ error: 'invalid JSON' }, { status: 400 }, cors)
  }

  // `cityByKey` wirft bei einem unbekannten Schlüssel, statt still auf Berlin
  // zurückzufallen — die Regel des Projekts. Hier wird daraus eine 400.
  let city
  try {
    city = cityByKey(String(payload?.city ?? ''))
  } catch (error) {
    return json({ error: (error as Error).message }, { status: 400 }, cors)
  }

  const roh = Array.isArray(payload?.events) ? payload.events : []
  if (roh.length === 0) return json({ written: 0 }, { status: 200 }, cors)
  if (roh.length > EVENTS_PER_REQUEST) {
    return json({ error: 'too many events' }, { status: 413 }, cors)
  }

  const now = Date.now()
  const day = berlinDay(now)
  const hour = Math.floor(berlinWallClock(now).minuteOfDay / 60)
  // Die Zonen **dieser** Stadt, nicht alle 275. Vorher stand hier
  // `ALL_ZONE_KEYS`, und das ist keine Kleinigkeit: Berlin und Frankfurt
  // teilen sich 20 Kennungen (`10`, `12`, `13`, …), weil beide schlicht
  // durchnummerieren. Eine Frankfurter Zahl landete damit als Berliner Zone
  // in der Auswertung, und in München wären 193 der 275 angenommenen
  // Kennungen solche, die es dort gar nicht gibt. Die Liste ist ohnehin je
  // Stadt erzeugt — sie wurde nur flachgeklopft, bevor sie geprüft hat.
  const listen = { zones: ZONE_KEYS[city.key] ?? [], cities: CITIES.map((eine) => eine.key) }

  const angenommen: { name: string; hour: number; value: string; n: number }[] = []
  for (const eintrag of roh) {
    const kandidat = eintrag as { name?: unknown; value?: unknown; n?: unknown }
    const name = kandidat.name
    if (!isEventName(name)) continue
    const value = typeof kandidat.value === 'string' ? kandidat.value : ''
    if (!isEventValue(name, value, listen)) continue
    angenommen.push({ name, hour: hourFor(name, hour), value, n: clampEventCount(kandidat.n) })
  }
  if (angenommen.length === 0) return json({ written: 0 }, { status: 200 }, cors)

  // Erst lesen — **eine** Zeile über den Primärschlüssel. Eine Summe über den
  // ganzen Tag im Prädikat läse bei jedem einzelnen Ereignis die ganze
  // Tagesmenge; D1 rechnet gelesene Zeilen gegen ein eigenes Budget ab, und
  // das wäre die teure Hälfte.
  const stand = await env.DB.prepare('SELECT n FROM event_budget WHERE day = ?')
    .bind(day)
    .first<{ n: number }>()
  // Voller Tag: 200 mit `written: 0`, nicht 429. Der Aufrufer soll seinen
  // Puffer verwerfen und nicht wiederholen — ein Fehler hier wäre nicht seiner.
  if ((stand?.n ?? 0) >= EVENTS_PER_DAY) return json({ written: 0 }, { status: 200 }, cors)

  const gesamt = angenommen.reduce((summe, e) => summe + e.n, 0)
  /**
   * Was ein einzelnes Bündel höchstens vom Tagesdeckel beanspruchen darf.
   *
   * Ohne diese Grenze kann eine Anfrage 25 × 50 = 1.250 Zählungen behaupten,
   * also **ein Viertel des Tages** — vier Aufrufe genügten, um die Statistik
   * für 24 Stunden abzuschalten. Ein echtes Bündel liegt weit darunter: Es
   * sammelt fünf Minuten lang, was ein Mensch in der App tut.
   *
   * Das ist kein vollständiger Schutz, und der wäre auch nicht zu haben —
   * dazu bräuchte es eine Kennung je Aufrufer, und genau die soll diese
   * Tabelle nicht kennen. Siehe `SECURITY.md`, „Bekannte Grenzen". Es
   * verschiebt nur das Verhältnis: aus vier Aufrufen werden fünfundzwanzig,
   * und ein legitimer Aufrufer merkt nichts davon.
   */
  const EVENT_BUNDLE_MAX = 200
  if (gesamt > EVENT_BUNDLE_MAX) {
    return json({ error: 'bundle too large' }, { status: 413 }, cors)
  }
  await env.DB.batch([
    ...angenommen.map((e) =>
      env.DB.prepare(
        'INSERT INTO events (day, hour, city, name, value, n) SELECT ?, ?, ?, ?, ?, ?' +
          ' WHERE COALESCE((SELECT n FROM event_budget WHERE day = ?), 0) < ?' +
          ' ON CONFLICT (day, hour, city, name, value) DO UPDATE SET n = events.n + excluded.n'
      ).bind(day, e.hour, city.key, e.name, e.value, e.n, day, EVENTS_PER_DAY)
    ),
    // Reserviert wird **zuletzt**, und das ist die Korrektur eines Fehlers.
    //
    // Vorher stand diese Anweisung an erster Stelle. Ein `batch` läuft der
    // Reihe nach in einer Transaktion — die Zaehlanweisungen lasen also
    // bereits den *erhöhten* Stand. Ein Bündel, das den Deckel überschritt,
    // schrieb damit **gar nichts**, auch nicht den Teil, der noch gepasst
    // hätte, und die Antwort meldete trotzdem `written: n`. Gemessen gegen
    // SQLite: Deckel 20, Stand 18, Bündel mit 5 → Budget 23, geschrieben 0,
    // gemeldet 2.
    //
    // Jetzt lesen die Zählanweisungen den Stand *vor* diesem Bündel — den,
    // den die Vorpruefung oben schon als „passt" befunden hat. Der Deckel
    // greift ab dem nächsten Aufruf. Der Überschuss ist damit höchstens ein
    // Bündel (25 × 50 = 1.250 auf 5.000), und er ist derselbe wie vorher; nur
    // liegt er jetzt in der Tabelle statt in der Luft.
    //
    // `COALESCE(…, 0)` ist Pflicht und kein Schmuck: Am ersten Bündel eines
    // Tages gibt es die Budgetzeile noch nicht, `NULL < 5000` ist NULL, und
    // ohne den Ersatzwert würde an jedem Tag das erste Bündel verworfen —
    // täglich, still, und ausgerechnet die Zeile für Mitternacht.
    //
    // Reserviert wird weiterhin das **Angenommene**, nicht das Geschriebene.
    env.DB.prepare(
      'INSERT INTO event_budget (day, n) VALUES (?, ?)' +
        ' ON CONFLICT (day) DO UPDATE SET n = event_budget.n + excluded.n'
    ).bind(day, gesamt),
  ])

  return json({ written: angenommen.length }, { status: 200 }, cors)
}

/** Wie viele Tage die Statistikseite zeigt. */
const STATS_DAYS = 28
/**
 * Ab wie vielen Zählungen eine Zone beim Namen genannt wird.
 *
 * Darunter geht sie in eine Sammelzeile „andere". Das ist die eine Stelle, an
 * der aus Zahlen wieder ein Ort werden könnte: Eine Zone, die in 28 Tagen
 * **einmal** angesehen wurde, beschreibt einen einzelnen Menschen. Die Schwelle
 * steht deshalb im SQL und nicht in der Anzeige — was die Antwort nicht
 * enthält, kann auch niemand auslesen.
 */
const STATS_MIN_ZONE = 5
/** Der Schlüssel im KV. Die Version steht drin, damit ein Formatwechsel nichts umbenennt. */
const STATS_KEY = 'stats:v1'

/**
 * Rechnet die Statistik **einmal je Stunde** aus und legt sie ins KV.
 *
 * Warum nicht bei jeder Anfrage: D1 rechnet **gelesene** Zeilen gegen ein
 * eigenes Tagesbudget ab. Sechs `GROUP BY`-Abfragen über 28 Tage lesen je
 * Aufruf fünfstellig viele Zeilen; bei einem öffentlichen Endpunkt mit
 * Neuladen wäre das Budget vor dem Mittag weg. So kostet die Auswertung
 * **24 Läufe am Tag**, unabhängig davon, wie oft jemand hinsieht.
 */
async function rollupStats(env: Env): Promise<void> {
  const now = Date.now()
  const seit = berlinDay(now - (STATS_DAYS - 1) * 86_400_000)
  const seit7 = berlinDay(now - 6 * 86_400_000)
  const heute = berlinDay(now)

  const ergebnisse = await env.DB.batch([
    env.DB.prepare(
      "SELECT day, SUM(n) AS n FROM events WHERE day >= ? AND name = 'app.open' GROUP BY day ORDER BY day"
    ).bind(seit),
    // `hour >= 0` ist Pflicht: Ortsereignisse liegen auf -1 und stünden sonst
    // als 25. Balken im Tagesgang.
    env.DB.prepare(
      "SELECT hour, SUM(n) AS n FROM events WHERE day >= ? AND hour >= 0 AND name = 'app.open'" +
        ' GROUP BY hour ORDER BY hour'
    ).bind(seit),
    env.DB.prepare(
      "SELECT city, SUM(n) AS n FROM events WHERE day >= ? AND name = 'app.open' GROUP BY city ORDER BY n DESC"
    ).bind(seit),
    env.DB.prepare(
      'SELECT name, SUM(n) AS n FROM events WHERE day >= ? GROUP BY name ORDER BY n DESC'
    ).bind(seit),
    // Die k-Schwelle: Was seltener vorkommt, wird zu ''. Die Stadtsumme bleibt
    // exakt — es wird zusammengefasst, nicht weggelassen.
    //
    // Das Ergebnis heisst `zone` und nicht `value`, und das ist kein Geschmack:
    // Hiesse es wie die Quellspalte, löste SQLite `GROUP BY value` gegen die
    // **innere** Spalte auf statt gegen den `CASE`-Ausdruck. Die seltenen
    // Zonen blieben dann einzeln stehen, jede mit ihrer eigenen Zeile und dem
    // leeren Namen — die Schwelle wäre wirkungslos und sähe trotzdem so aus,
    // als wirkte sie. Gefunden hat es der Test gegen SQLite.
    env.DB.prepare(
      'SELECT city, CASE WHEN roh >= ? THEN value ELSE \'\' END AS zone, SUM(roh) AS n FROM (' +
        " SELECT city, value, SUM(n) AS roh FROM events" +
        " WHERE day >= ? AND hour = -1 AND name = 'zone.open' GROUP BY city, value" +
        ') GROUP BY city, zone ORDER BY city, n DESC'
    ).bind(STATS_MIN_ZONE, seit),
    /**
     * Die Ausprägungen der Ereignisse, deren Werte **keine Orte** sind.
     *
     * Eine Frage, fünf Antworten: welche Ebenen eingeschaltet werden, was die
     * App geantwortet hat, wie jemand zu einer Zone kam, worüber die App
     * geöffnet wurde, ob ein Stadtvorschlag angenommen wird. Ohne das steht
     * unter „Was benutzt wird" je Ereignis genau eine Zahl — `layer.on: 214`
     * beantwortet die Frage „welche Ebenen" gerade nicht.
     *
     * Die Liste ist **fest und aufzählend**, nicht „alles ausser den Orten":
     * `zone.open` und `city.switch` tragen Ortsangaben als Wert und gehören
     * durch die k-Schwelle darunter, nicht hierher. Eine Positivliste kann
     * nicht dadurch undicht werden, dass jemand dem Katalog ein Ereignis
     * hinzufügt.
     */
    env.DB.prepare(
      'SELECT name, value, SUM(n) AS n FROM events' +
        " WHERE day >= ? AND name IN ('layer.on', 'zone.answer', 'zone.source', 'app.open', 'city.suggest')" +
        ' GROUP BY name, value ORDER BY name, n DESC'
    ).bind(seit),
    // Die Gegenprobe. Siehe unten, warum sie nur zwei Tage weit reicht.
    env.DB.prepare('SELECT day, COUNT(*) AS n FROM visits GROUP BY day ORDER BY day').bind(),
  ])

  // `batch` liefert ein Feld in derselben Reihenfolge; `noUncheckedIndexedAccess`
  // macht daraus `T | undefined`, deshalb der Zugriff über eine Funktion.
  const zeilen = <T>(index: number): T[] => (ergebnisse[index]?.results ?? []) as T[]
  const tage = zeilen<{ day: string; n: number }>(0)
  const summe = (ab: string): number =>
    tage.filter((zeile) => zeile.day >= ab).reduce((s, zeile) => s + zeile.n, 0)

  /**
   * Die Gegenprobe: Stimmen die Zahlen überhaupt?
   *
   * Nichts sonst sagt, ob die Bündel ankommen. Bleibt ein Aufruf still liegen
   * — eine geänderte CORS-Regel, ein Fehler im Client, ein volles Tagesbudget
   * —, sinken die Zahlen einfach, und das sieht aus wie weniger Nutzung.
   *
   * `visits` zählt Geräte je Tag und wird über einen ganz anderen Weg
   * geschrieben (`POST /visits`, alle zwei Minuten, eine Zeile je Gerät).
   * **Jedes Gerät, das eine Zeile anlegt, hat die App geöffnet** — also muss
   * `app.open` mindestens so groß sein wie die Zahl der Zeilen. Ist es das
   * nicht, kommen Ereignisse nicht an.
   *
   * Sie reicht nur **zwei Tage** weit, und das ist keine Nachlässigkeit:
   * `visits` wird nach zwei Tagen gelöscht, `events` nach 90. Ein Vergleich
   * über 28 Tage verglich eine volle Zahl mit einer leeren und meldete jedes
   * Mal Alarm.
   */
  const besuche = zeilen<{ day: string; n: number }>(6)
  const gestern = berlinDay(now - 86_400_000)
  const probe = besuche
    .filter((zeile) => zeile.day >= gestern)
    .map((zeile) => ({
      day: zeile.day,
      geraete: zeile.n,
      oeffnungen: tage.find((eintrag) => eintrag.day === zeile.day)?.n ?? 0,
    }))

  const stand = {
    erzeugtAm: new Date(now).toISOString(),
    tage: STATS_DAYS,
    schwelle: STATS_MIN_ZONE,
    kopf: { heute: summe(heute), tage7: summe(seit7), tage28: summe(seit) },
    proTag: tage,
    proStunde: zeilen(1),
    proStadt: zeilen(2),
    proName: zeilen(3),
    proZone: zeilen(4),
    proWert: zeilen(5),
    probe,
  }
  await env.CACHE.put(STATS_KEY, JSON.stringify(stand))
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
  // Die Stadt kommt aus der Position, nicht aus der Konfiguration: Eine
  // Meldung sagt nicht, wo sie herkommt, sie liegt dort. Passt sie in keine
  // Box, ist sie ein Fehler oder ein Missbrauchsversuch; in beiden Fällen hat
  // sie hier nichts zu suchen.
  const city = cityAt(lon, lat)
  if (city === undefined) {
    // Nennt alle bekannten Städte, nicht nur eine. Die alte Fassung antwortete
    // `position outside Berlin`, auch wenn der Punkt sauber in Hamburg lag —
    // die Meldung führte damit von der Ursache weg.
    return json({ error: `position outside ${cityNames(', ')}` }, { status: 422 }, cors)
  }

  const id = await storeSighting(env, lon, lat, hash, city)
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
  hash: string,
  city: City
): Promise<string> {
  const id = crypto.randomUUID()
  await env.DB.prepare(
    'INSERT INTO sightings (id, lon, lat, city, reported_at, confirmations, disputes, client_hash) VALUES (?, ?, ?, ?, ?, 0, 0, ?)'
  )
    // Stored coarsened and time-bucketed: a report is also a location record of
    // whoever filed it, and this row is world-readable.
    // Die Stadt wird vom Aufrufer aus derselben Position abgeleitet, aus der
    // er sie angenommen hat — sie hier ein zweites Mal zu bestimmen hiesse,
    // eine Zeile schreiben zu können, die eine andere Stadt nennt als die
    // Prüfung durchgelassen hat.
    .bind(
      id,
      coarsen(lon),
      coarsen(lat),
      city.key,
      Math.floor(Date.now() / 300_000) * 300_000,
      hash
    )
    .run()

  // The heatmap's tally is derived here rather than posted by the client: a
  // client that could write marks directly could paint a density it never
  // reported, and only this path is rate-limited.
  const mark = markFor([coarsen(lon), coarsen(lat)], Date.now())
  await env.DB.prepare('INSERT INTO marks (id, day, cell, city, hour) VALUES (?, ?, ?, ?, ?)')
    .bind(crypto.randomUUID(), mark.day, mark.cell, city.key, mark.hour ?? null)
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
    'SELECT id, client_hash FROM sightings WHERE id = ? AND reported_at > ?'
  )
    .bind(id, Date.now() - SIGHTING_MAX_AGE_MS)
    .first<{ id: string; client_hash: string | null }>()
  if (target === null) return json({ error: 'not found' }, { status: 404 }, cors)

  // Der Schema-Kommentar zu `sightings.client_hash` versprach seit jeher, die
  // Spalte halte "one client confirming its own report" auf — geprüft wurde
  // es nie (Audit-Punkt M-047). Eine selbst bestätigte Meldung sieht für
  // jeden anderen aus wie eine von zwei Leuten bestätigte, und genau diese
  // Zahl trägt die Konfidenz.
  //
  // `client_hash` darf NULL sein — bei Meldungen aus Telegram steht dort
  // nichts. Ein NULL ist keine Übereinstimmung, sondern eine fehlende Angabe,
  // und die verbietet nichts.
  if (target.client_hash !== null && target.client_hash === hash) {
    return json({ error: 'cannot vote on your own report' }, { status: 403 }, cors)
  }

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
  const salt = env.CLIENT_SALT ?? ''
  if (salt === '') throw new Error('CLIENT_SALT fehlt — ohne Salz kein Telegram-Hash')
  const material = `telegram:${userId}|${salt}`
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

  // Alle Städte, nicht eine konfigurierte: Ein gesendeter Standort bringt keine
  // Stadt mit, sie steht nur im Punkt. Vorher bekam der Parser die eine Stadt
  // des Workers — ein Hamburger Standort war damit „unknown", und der Bot
  // antwortete, er verstehe das nicht.
  const { intent, sender } = parseTelegramUpdate(update, CITIES)
  if (sender === null || intent.kind === 'ignore') return json({ ok: true }, {}, {})

  if (intent.kind === 'help') {
    await telegramSend(env, sender.chatId, TELEGRAM_HELP)
    return json({ ok: true }, {}, {})
  }

  if (intent.kind === 'unknown') {
    await telegramSend(
      env,
      sender.chatId,
      `Damit kann ich nichts anfangen. Schick mir einen Standort in ${cityNames(' oder ')}: ` +
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

  // Die Stadt steht schon im Intent: Der Parser hat den Punkt gegen die Boxen
  // gehalten, um überhaupt zu entscheiden, dass es eine Meldung ist.
  await storeSighting(env, intent.lon, intent.lat, hash, intent.city)
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

    // Ohne Salz wird nicht geschrieben. `clientHash` fiel sonst still auf einen
    // ungesalzenen SHA-256 über die IP-Adresse zurück (`env.CLIENT_SALT ?? ''`)
    // — und 64 Bit über den IPv4-Raum rechnet man offline in Minuten zurück.
    // Aus dem Pseudonym, das die Datenschutzerklärung verspricht, wäre damit
    // die IP-Adresse selbst geworden. Der Kommentar über `clientHash` sagt das
    // seit jeher; der Code tat es trotzdem (Audit-Punkt M-014).
    //
    // 503 und nicht 500: Das ist keine Panne, sondern eine Einrichtung, die
    // fehlt — dieselbe Richtung wie beim Beta-Riegel. Lieber gar nicht
    // schreiben als umkehrbare Kennungen sammeln.
    if (request.method === 'POST' && (env.CLIENT_SALT ?? '') === '') {
      return json({ error: 'CLIENT_SALT not configured' }, { status: 503 }, cors)
    }

    // Vor der CORS-Behandlung und ohne sie: Telegram ist kein Browser, schickt
    // keinen Origin und wird durch das Geheimnis im Kopf ausgewiesen.
    if (path === '/telegram' && request.method === 'POST') {
      return telegramWebhook(request, env)
    }

    const layerMatch = /^\/wfs\/([a-zA-Z]+)$/.exec(path)
    if (layerMatch !== null && request.method === 'GET') {
      return serveLayer(layerMatch[1] as string, env, cors)
    }

    // `?city=` entscheidet, welche Stadt gelesen wird. Fehlt der Parameter,
    // bleibt es Berlin; ein unbekannter Schlüssel ist ein 400 und kein stiller
    // Rückfall — siehe `requestedCity`.
    if (path === '/sightings' && request.method === 'GET') {
      const choice = requestedCity(url)
      if ('error' in choice) return json({ error: choice.error }, { status: 400 }, cors)
      return listSightings(env, choice.city, cors)
    }
    if (path === '/marks' && request.method === 'GET') {
      const choice = requestedCity(url)
      if ('error' in choice) return json({ error: choice.error }, { status: 400 }, cors)
      return listMarks(env, choice.city, cors)
    }
    if (path === '/visits' && request.method === 'POST') return recordVisit(request, env, cors)
    // Öffentlich, und zwar mit Absicht: Der Worker liegt **nicht** hinter dem
    // Beta-Riegel — die Seite tut es, die Adressen des Workers nicht. Ein
    // Endpunkt, der nur „hinter dem Riegel" gedacht ist, wäre eine Annahme,
    // die nicht trägt. Deshalb steckt die k-Schwelle im Rollup und nicht in
    // der Anzeige.
    if (path === '/stats' && request.method === 'GET') {
      const stand = await env.CACHE.get(STATS_KEY)
      if (stand === null) {
        // Noch kein Lauf: leer und ehrlich, nicht auf Verdacht gerechnet.
        return json({ erzeugtAm: null, leer: true }, { status: 200 }, {
          ...cors,
          'Cache-Control': 'public, max-age=60',
        })
      }
      return new Response(stand, {
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Cache-Control': 'public, max-age=300',
          ...cors,
        },
      })
    }
    if (path === '/events' && request.method === 'POST') return recordEvents(request, env, cors)
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
   * Der Aufräumlauf: löscht, was abgelaufen ist, und rechnet danach die
   * Statistik. Stündlich am Cron, damit keine Tabelle zu einem Bewegungsprofil
   * wächst — auch dann nicht, wenn der Lesepfad einmal aufhört zu filtern.
   *
   * ## Warum jeder Schritt für sich läuft
   *
   * Vorher war das eine Kette aus zehn `await`. Eine geworfene Ausnahme in der
   * Mitte hielt alles danach an — und „danach" standen ausgerechnet die drei
   * Löschungen, die die Aufbewahrungsfrist der Nutzungsstatistik und der
   * Rückmeldungen einhalten. Der Reihe nach hiess: Eine Statistik, die nicht
   * gerechnet werden konnte, verhinderte, dass Daten gelöscht wurden. Das ist
   * die falsche Richtung: Die Löschung ist ein Versprechen aus
   * `docs/datenschutz.md`, die Statistik ist Beiwerk.
   *
   * Jetzt läuft jeder Schritt einzeln und meldet, wenn er scheitert. Was
   * gescheitert ist, wird am Ende **geworfen** — sonst wäre ein stiller
   * `catch` genau der Fehler, den dieses Projekt dreimal gemacht hat: etwas
   * meldet Erfolg und tut nichts. So bleibt der Cron-Lauf rot und steht in der
   * Observability, während die übrigen neun Schritte trotzdem gelaufen sind.
   */
  async scheduled(_event: ScheduledController, env: Env): Promise<void> {
    const now = Date.now()
    // Das Fenster, nach dem ein Pseudonym nichts mehr nützt: das Rate-Limit
    // ist eine Stunde lang, danach ist der Hash nur noch ein Bezug.
    const pseudonymFrist = now - 3_600_000

    const schritte: [string, () => Promise<unknown>][] = [
      // Der Hash fällt, sobald das Rate-Limit-Fenster durch ist, damit eine
      // noch sichtbare Meldung kein Pseudonym ihres Melders mehr trägt.
      [
        'sichtungen: hash löschen',
        () =>
          env.DB.prepare(
            'UPDATE sightings SET client_hash = NULL WHERE client_hash IS NOT NULL AND reported_at <= ?'
          )
            .bind(pseudonymFrist)
            .run(),
      ],
      [
        'sichtungen: abgelaufene löschen',
        () =>
          env.DB.prepare('DELETE FROM sightings WHERE reported_at <= ?')
            .bind(now - SIGHTING_MAX_AGE_MS)
            .run(),
      ],
      [
        'stimmen: verwaiste löschen',
        () =>
          env.DB.prepare(
            'DELETE FROM votes WHERE sighting_id NOT IN (SELECT id FROM sightings)'
          ).run(),
      ],
      // Dasselbe Versprechen für die langlebige Tabelle: gelöscht, nicht bloss
      // aus der Anzeige gefiltert.
      [
        'kontrolldichte: altes fenster löschen',
        () => env.DB.prepare('DELETE FROM marks WHERE day < ?').bind(windowStart({ now })).run(),
      ],
      [
        'besuche: löschen',
        () =>
          env.DB.prepare('DELETE FROM visits WHERE seen_at < ?')
            .bind(now - VISIT_KEEP_MS)
            .run(),
      ],
      [
        'rückmeldungen: hash löschen',
        () =>
          env.DB.prepare(
            'UPDATE feedback SET client_hash = NULL WHERE client_hash IS NOT NULL AND created_at <= ?'
          )
            .bind(pseudonymFrist)
            .run(),
      ],
      // Die Nutzungsstatistik: 90 Tage. Eine Zahl, die älter ist als ein
      // Quartal, beantwortet keine Frage, die dieses Projekt hat. Das
      // Tagesbudget hält nur zwei Tage — es ist ein Zähler, kein Bestand.
      [
        'ereignisse: nach 90 tagen löschen',
        () =>
          env.DB.prepare('DELETE FROM events WHERE day < ?')
            .bind(berlinDay(now - 90 * 86_400_000))
            .run(),
      ],
      [
        'tagesbudget: löschen',
        () =>
          env.DB.prepare('DELETE FROM event_budget WHERE day < ?')
            .bind(berlinDay(now - 2 * 86_400_000))
            .run(),
      ],
      [
        'rückmeldungen: nach 90 tagen löschen',
        () =>
          env.DB.prepare('DELETE FROM feedback WHERE created_at < ?')
            .bind(now - FEEDBACK_MAX_AGE_MS)
            .run(),
      ],
      // Zuletzt, und mit Absicht nach allen Löschungen: Der Stand soll die
      // Zahlen zeigen, die danach noch da sind.
      ['auswertung rechnen', () => rollupStats(env)],
    ]

    const gescheitert: string[] = []
    for (const [name, tun] of schritte) {
      try {
        await tun()
      } catch (fehler) {
        gescheitert.push(name)
        console.error(`Aufräumlauf: "${name}" gescheitert:`, fehler)
      }
    }
    if (gescheitert.length > 0) {
      throw new Error(`Aufräumlauf unvollständig: ${gescheitert.join(', ')}`)
    }
  },
}
