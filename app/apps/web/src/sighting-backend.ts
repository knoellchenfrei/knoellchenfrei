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

import { expiredMarks, markFor, windowStart, withinCity, type HeatMark } from '@parkingzone/core'

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
  report: (lon: number, lat: number) => Promise<void>
  vote: (sighting: Sighting, kind: VoteKind) => Promise<void>
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
  if (typeof cell !== 'string' || !/^-?\d{1,6}_-?\d{1,6}$/.test(cell)) return null
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
      await db.doc(`marks/${newId()}`).set(markFor([safeLon, safeLat], now))
    },

    vote: async (sighting, kind) => {
      const key = kind === 'confirm' ? 'confirmations' : 'disputes'
      // Last-writer-wins, so a simultaneous vote elsewhere can be lost. For a
      // confidence score that is acceptable: a lost vote shifts a rating, it
      // does not corrupt anything.
      await db.doc(`sightings/${sighting.id}`).set({ ...sighting, [key]: sighting[key] + 1 })
    },
  }
}

// ------------------------------------------------------------------- worker

/**
 * Polls rather than holding a socket: sightings move on a scale of minutes, and
 * a socket would cost a durable object per viewer for no visible gain.
 */
function workerBackend(base: string): SightingBackend {
  const POLL_MS = 45_000

  const load = async (): Promise<Sighting[]> => {
    const response = await fetch(`${base}/sightings`, { signal: AbortSignal.timeout(10_000) })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const body = (await response.json()) as { sightings?: Partial<Sighting>[] }
    const now = Date.now()
    return (Array.isArray(body.sightings) ? body.sightings : [])
      .map((row) => sanitise(String(row?.id ?? ''), row, now))
      .filter((row): row is Sighting => row !== null)
  }

  const loadMarks = async (): Promise<HeatMark[]> => {
    const since = windowStart({ now: Date.now() })
    const response = await fetch(`${base}/marks?since=${since}`, {
      signal: AbortSignal.timeout(10_000),
    })
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
      await fetch(`${base}/sightings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lon: safeLon, lat: safeLat }),
      })
    },

    vote: async (sighting, kind) => {
      await fetch(`${base}/sightings/${encodeURIComponent(sighting.id)}/${kind}`, {
        method: 'POST',
      })
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
