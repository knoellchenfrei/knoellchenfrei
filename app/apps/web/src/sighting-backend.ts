/**
 * Where sightings live.
 *
 * Three possible backends, and the app must work with any of them — including
 * none:
 *
 *   1. A self-hosted Cloudflare Worker, when VITE_API_BASE is set at build time.
 *   2. The artifact runtime's `db` capability, when published as an artifact.
 *   3. Nothing, in which case the caller keeps reports in localStorage.
 *
 * The two remote backends have genuinely different shapes — a realtime document
 * store versus REST — so this interface is written for what the app needs
 * (subscribe, report, vote) rather than bending one into the other's API. An
 * earlier version adapted the worker to the document-store shape and lost the
 * direction of a vote in the process.
 */

import { expiredMarks, markFor, windowStart, withinCity, type HeatMark } from '@knoellchenfrei/core'

import { CITY } from './city.js'

export interface Sighting {
  id: string
  lat: number
  lon: number
  reportedAt: number
  confirmations: number
  disputes: number
}

export type VoteKind = 'confirm' | 'dispute'

export interface SightingBackend {
  /** Calls `handler` with the full current set; returns an unsubscribe function. */
  subscribe: (handler: (sightings: Sighting[]) => void) => () => void
  /**
   * The anonymous {day, cell} tallies behind the heatmap, if this backend keeps
   * them. Separate from `subscribe` because it is a different dataset with a
   * different retention: live sightings vanish after 90 minutes, marks live for
   * four weeks and carry neither a time of day nor a link to a report.
   */
  subscribeMarks?: (handler: (marks: HeatMark[]) => void) => () => void
  /**
   * Liefert die Kennung, unter der der Speicher die Meldung führt — oder
   * `null`, wenn er keine nennt. Die App zeigt ihre Meldung sofort unter einer
   * eigenen, lokalen Kennung; ohne die Rückgabe blieb die 45 Sekunden lang
   * stehen, bis die nächste Abfrage die Liste ersetzte. Wer in der Zeit die
   * eigene Meldung bewertete, schickte eine Kennung, die der Server nie
   * vergeben hatte — und bekam „404 Not Found" statt „eigene Meldung".
   */
  report: (lon: number, lat: number) => Promise<string | null>
  /**
   * `true`, wenn die Stimme gezählt wurde; `false`, wenn der Speicher sie
   * kannte und verwarf. Der Worker antwortet auf eine zweite Stimme desselben
   * Clients mit `200 { counted: false }` — kein Fehler, aber auch kein Zähler.
   * Beim Durchklicken am 9. September zeigte die App danach 45 Sekunden lang
   * eine Bestätigung mehr, als der Server hatte, bis die nächste Abfrage die
   * Liste ersetzte.
   */
  vote: (sighting: Sighting, kind: VoteKind) => Promise<boolean>
}

/**
 * Rows written by other viewers, so the shape is checked before it reaches the
 * aggregator. `buildHeatmap` drops junk too, but a store that keeps accepting
 * malformed rows grows without bound.
 */
export function sanitiseMark(row: unknown): HeatMark | null {
  if (row === null || typeof row !== 'object') return null
  const { day, cell } = row as Partial<HeatMark>
  if (typeof day !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(day)) return null
  // Seit dem 9. September mit dem Namen des Rasters davor, ausser in Berlin.
  if (typeof cell !== 'string' || !/^(?:[a-z]+:)?-?\d{1,6}_-?\d{1,6}$/.test(cell)) return null
  // The hour is optional: marks written before the time-of-day chart existed
  // still count on the map. An out-of-range value drops the field rather than
  // the row, so one bad write cannot erase a cell from the heatmap.
  const hour = (row as { hour?: unknown }).hour
  return Number.isInteger(hour) && (hour as number) >= 0 && (hour as number) < 24
    ? { day, cell, hour: hour as number }
    : { day, cell }
}

/** Anything older than this is expired; matches the confidence model. */
export const MAX_AGE_MS = 90 * 60 * 1000
/** Clock skew we tolerate on a peer's timestamp. */
const FUTURE_TOLERANCE_MS = 60_000
/** A plausible ceiling for peer feedback; anything above is manipulation. */
const MAX_VOTES = 500

const ID_PATTERN = /^[\w-]{1,64}$/

/**
 * Rows come from other viewers, so every field is coerced and range-checked
 * before the confidence model sees it.
 *
 * `id` is taken from the document key, never from its body: a row claiming
 * `id: "../elsewhere"` would otherwise make every other client write to a path
 * of the attacker's choosing when it votes.
 *
 * `reportedAt` is clamped at both ends. Unclamped, a timestamp far in the
 * future produced an age of zero forever — a permanent three-star sighting that
 * no amount of disputes could clear.
 */
function sanitise(id: string, row: Partial<Sighting> | null | undefined, now: number): Sighting | null {
  if (row === null || row === undefined) return null
  if (!ID_PATTERN.test(id)) return null

  const lat = Number(row.lat)
  const lon = Number(row.lon)
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null
  if (!withinCity(CITY, lon, lat)) return null

  const reportedAt = Number(row.reportedAt)
  if (!Number.isFinite(reportedAt)) return null
  if (reportedAt > now + FUTURE_TOLERANCE_MS) return null
  if (reportedAt < now - MAX_AGE_MS) return null

  return {
    id,
    lat,
    lon,
    reportedAt,
    confirmations: Math.max(0, Math.min(MAX_VOTES, Number(row.confirmations) || 0)),
    disputes: Math.max(0, Math.min(MAX_VOTES, Number(row.disputes) || 0)),
  }
}

/**
 * Reduces a position to roughly 10 m.
 *
 * A report marks where the reporter was standing as much as where the official
 * was, and it is public to everyone holding the link. Full float precision plus
 * a millisecond timestamp is a location record of the user; this is the least
 * that still places a sighting usefully on a map.
 */
export function coarsen(lon: number, lat: number): [number, number] {
  return [Math.round(lon * 1e4) / 1e4, Math.round(lat * 1e4) / 1e4]
}

/** Timestamps land on 5-minute buckets, for the same reason. */
function bucketTime(now: number): number {
  return Math.floor(now / 300_000) * 300_000
}

function newId(): string {
  return typeof crypto?.randomUUID === 'function'
    ? crypto.randomUUID()
    : `s-${Date.now()}-${Math.floor(Math.random() * 1e9)}`
}

// ---------------------------------------------------------------- artifact db

interface DbCollection {
  onSnapshot: (handler: (snapshot: { docs: { id: string; data: unknown }[] }) => void) => () => void
}

interface Db {
  doc: (path: string) => {
    set: (value: unknown) => Promise<unknown>
    delete?: () => Promise<unknown>
  }
  collection: (path: string) => DbCollection
}

function artifactBackend(db: Db): SightingBackend {
  return {
    subscribe: (handler) =>
      db.collection('sightings').onSnapshot((snapshot) => {
        const now = Date.now()
        const kept: Sighting[] = []
        for (const doc of snapshot.docs) {
          const row = sanitise(doc.id, doc.data as Partial<Sighting>, now)
          if (row !== null) {
            kept.push(row)
            continue
          }
          // Expired or malformed rows are deleted, not merely hidden. The UI
          // promises reports vanish after 90 minutes; without this the store
          // would quietly keep a permanent record of where officials were.
          void db.doc(`sightings/${doc.id}`).delete?.()
        }
        handler(kept)
      }),

    subscribeMarks: (handler) =>
      db.collection('marks').onSnapshot((snapshot) => {
        const now = Date.now()
        const kept: HeatMark[] = []
        const rows: { id: string; mark: HeatMark }[] = []
        for (const doc of snapshot.docs) {
          const mark = sanitiseMark(doc.data)
          if (mark === null) {
            void db.doc(`marks/${doc.id}`).delete?.()
            continue
          }
          rows.push({ id: doc.id, mark })
        }
        // Retention is enforced here rather than only filtered on read: the
        // promise is that nothing older than the window is kept, not that it is
        // merely hidden.
        const gone = new Set(expiredMarks(rows.map((row) => row.mark), { now }))
        for (const row of rows) {
          if (gone.has(row.mark)) {
            void db.doc(`marks/${row.id}`).delete?.()
            continue
          }
          kept.push(row.mark)
        }
        handler(kept)
      }),

    report: async (lon, lat) => {
      const [safeLon, safeLat] = coarsen(lon, lat)
      const now = Date.now()
      const entry: Sighting = {
        id: newId(),
        lon: safeLon,
        lat: safeLat,
        reportedAt: bucketTime(now),
        confirmations: 0,
        disputes: 0,
      }
      await db.doc(`sightings/${entry.id}`).set(entry)
      // A separate tally mark rather than a copy of the report: one row per
      // report, carrying only the day and the 250 m cell, so the long-lived
      // dataset can never be joined back to the short-lived one.
      await db.doc(`marks/${newId()}`).set(markFor([safeLon, safeLat], now, CITY.heatGrid))
      return entry.id
    },

    vote: async (sighting, kind) => {
      const key = kind === 'confirm' ? 'confirmations' : 'disputes'
      // Last-writer-wins, so a simultaneous vote elsewhere can be lost. For a
      // confidence score that is acceptable: a lost vote shifts a rating, it
      // does not corrupt anything.
      await db.doc(`sightings/${sighting.id}`).set({ ...sighting, [key]: sighting[key] + 1 })
      return true
    },
  }
}

// ------------------------------------------------------------------- worker

/**
 * Ein Schreibzugriff auf den Worker — und er **wirft**, wenn er scheitert.
 *
 * Vorher stand hier ein blankes `await fetch(…)`. Ein `fetch` gilt aber als
 * erfolgreich, sobald *irgendeine* Antwort kommt: 415, 429 und 500 landen alle
 * im `then`. Die Aufrufer in `App.tsx` nehmen ihren optimistischen Eintrag
 * genau dann zurück, wenn die Zusage bricht — bei einer Zusage, die nie bricht,
 * blieb eine Meldung stehen, die es nur auf diesem Schirm gab. Das Panel
 * verspricht „geteilt", und das wäre dann eine Lüge gewesen.
 *
 * Der Status kommt bewusst mit: 429 („zu viele Meldungen") und 415 („der
 * Aufruf war falsch gebaut") sind für den, der das Protokoll liest, zwei
 * verschiedene Geschichten. Die Adresse kommt **nicht** mehr mit: Sie stand
 * bis zum 9. September im Toast („http://…/sightings/…/confirm antwortete
 * 404 Not Found") und sagte dem Lesenden nichts — der Grund steht jetzt als
 * Satz davor, siehe `fehlerText`.
 */
async function send(url: string, body: string): Promise<Response> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
  })
  if (!response.ok) throw new WorkerFehler(response.status, response.statusText)
  return response
}

/** Eine Antwort des Workers ausserhalb von 2xx, mit dem Status zum Nachlesen. */
export class WorkerFehler extends Error {
  constructor(
    readonly status: number,
    statusText: string,
  ) {
    super(fehlerText(status, statusText))
    this.name = 'WorkerFehler'
  }
}

/**
 * Was ein Status für den Menschen vor dem Schirm heisst. Die Sätze folgen den
 * Antworten des Workers (`apps/api/src/worker.ts`): 403 ist dort ausschliesslich
 * die eigene Meldung oder ein fremder Origin, 404 eine Meldung, die schon
 * verfallen ist, 422 ein Ort ausserhalb der bekannten Städte, 429 die
 * Stundengrenze, 503 ein Worker ohne Salz. Alles andere bleibt nackt.
 */
export function fehlerText(status: number, statusText: string): string {
  switch (status) {
    case 403:
      return 'Die eigene Meldung lässt sich nicht bewerten (403)'
    case 404:
      return 'Diese Meldung ist schon verfallen (404)'
    case 422:
      return 'Der Ort liegt ausserhalb der bekannten Städte (422)'
    case 429:
      return 'Zu viele Meldungen in kurzer Zeit — bitte später noch einmal (429)'
    case 503:
      return 'Der Server ist noch nicht eingerichtet (503)'
    default:
      return `Der Server antwortete ${status} ${statusText}`.trim()
  }
}

/**
 * Polls rather than holding a socket: sightings move on a scale of minutes, and
 * a socket would cost a durable object per viewer for no visible gain.
 */
export function workerBackend(base: string): SightingBackend {
  const POLL_MS = 45_000

  // `?city=` ist keine Höflichkeit: Der Worker hält seit der zweiten Stadt
  // beide Städte in derselben Tabelle und fällt ohne den Parameter auf Berlin
  // zurück. Ohne ihn läse ein Hamburg-Nutzer Berliner Meldungen — auf der Karte
  // unsichtbar, weil 250 km dazwischen liegen, in den Zählern aber falsch.
  const load = async (): Promise<Sighting[]> => {
    const response = await fetch(`${base}/sightings?city=${encodeURIComponent(CITY.key)}`, {
      signal: AbortSignal.timeout(10_000),
    })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const body = (await response.json()) as { sightings?: Partial<Sighting>[] }
    const now = Date.now()
    return (Array.isArray(body.sightings) ? body.sightings : [])
      .map((row) => sanitise(String(row?.id ?? ''), row, now))
      .filter((row): row is Sighting => row !== null)
  }

  const loadMarks = async (): Promise<HeatMark[]> => {
    const since = windowStart({ now: Date.now() })
    const response = await fetch(
      `${base}/marks?since=${since}&city=${encodeURIComponent(CITY.key)}`,
      { signal: AbortSignal.timeout(10_000) }
    )
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const body = (await response.json()) as { marks?: unknown[] }
    return (Array.isArray(body.marks) ? body.marks : [])
      .map(sanitiseMark)
      .filter((mark): mark is HeatMark => mark !== null)
  }

  return {
    subscribe: (handler) => {
      let stopped = false
      const tick = (): void => {
        void load()
          .then((rows) => {
            if (!stopped) handler(rows)
          })
          .catch(() => {
            /* a failed poll just means the previous data stands */
          })
      }
      tick()
      const timer = setInterval(tick, POLL_MS)
      return () => {
        stopped = true
        clearInterval(timer)
      }
    },

    // Four weeks of tallies change slowly; polling them at the sighting rate
    // would be 20 requests per hour for data that moves once a day.
    subscribeMarks: (handler) => {
      let stopped = false
      const tick = (): void => {
        void loadMarks()
          .then((marks) => {
            if (!stopped) handler(marks)
          })
          .catch(() => {
            /* the previous tallies stand */
          })
      }
      tick()
      const timer = setInterval(tick, 10 * 60_000)
      return () => {
        stopped = true
        clearInterval(timer)
      }
    },

    report: async (lon, lat) => {
      const [safeLon, safeLat] = coarsen(lon, lat)
      // The worker derives the mark from the report itself: a client that could
      // post marks directly could paint a heatmap without reporting anything,
      // and the rate limit only covers reports.
      const response = await send(`${base}/sightings`, JSON.stringify({ lon: safeLon, lat: safeLat }))
      // Der Worker antwortet 201 mit `{ id }`. Ein Rumpf, der das nicht ist,
      // ist kein Fehler der Meldung — sie steht —, nur keine Kennung.
      const body = (await response.json().catch(() => null)) as { id?: unknown } | null
      return typeof body?.id === 'string' && body.id.length > 0 ? body.id : null
    },

    vote: async (sighting, kind) => {
      // Leerer Rumpf, aber mit Inhaltstyp — und das ist kein Schönheitsfehler
      // gewesen: `rejectsCrossSite` im Worker verlangt
      // `Content-Type: application/json`, weil erst der einen Preflight
      // erzwingt und damit die CORS-Allowlist überhaupt gefragt wird. Ohne den
      // Kopf antwortete der Worker mit **415**, und weil hier niemand den
      // Status ansah, verschwand die Stimme lautlos: Die Anzeige zählte hoch,
      // die Datenbank nicht. Gefunden im Audit (M-046).
      const response = await send(`${base}/sightings/${encodeURIComponent(sighting.id)}/${kind}`, '{}')
      // Nur ein ausdrückliches `counted: false` heisst „nicht gezählt". Ein
      // Rumpf ohne das Feld (ältere Worker, leere Antwort) gilt als gezählt —
      // die Stimme hat der Server angenommen, sonst hätte `send` geworfen.
      const body = (await response.json().catch(() => null)) as { counted?: unknown } | null
      return body?.counted !== false
    },
  }
}

// --------------------------------------------------------------------- open

declare global {
  interface Window {
    claude?: { use: (name: string) => Promise<unknown> }
  }
}

export async function openSightingBackend(): Promise<SightingBackend | null> {
  const apiBase = import.meta.env.VITE_API_BASE as string | undefined
  if (typeof apiBase === 'string' && apiBase.length > 0) {
    return workerBackend(apiBase.replace(/\/+$/, ''))
  }

  if (typeof window === 'undefined' || window.claude === undefined) return null
  try {
    const db = (await window.claude.use('db')) as Db | null
    return db === null ? null : artifactBackend(db)
  } catch {
    return null
  }
}
