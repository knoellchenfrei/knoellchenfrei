import { expiredMarks, withinCity, withinCitySession, type HeatMark } from '@knoellchenfrei/core'

import { CITY } from './city.js'
import { sanitiseMark } from './sighting-backend.js'

/**
 * Per-viewer persistence.
 *
 * Every accessor is guarded: a private window, cleared site data, or a browser
 * blocking storage makes these throw rather than return null, and the app has to
 * stay usable when they do.
 */

function read<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key)
    return raw === null ? null : (JSON.parse(raw) as T)
  } catch {
    return null
  }
}

function write(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* storage unavailable — the session simply is not remembered */
  }
}

/** A parked car: where, since when, and until when the driver wants warning. */
export interface ParkingSession {
  lon: number
  lat: number
  zone: string | null
  startedAt: number
  /** Epoch ms the user wants to be warned at, or null for an open-ended stay. */
  remindAt: number | null
}

const SESSION_KEY = 'knoellchenfrei.session'
const SIGHTINGS_KEY = 'knoellchenfrei.sightings'
const MARKS_KEY = 'knoellchenfrei.marks.v1'
const LOCATION_ASKED_KEY = 'knoellchenfrei.locationAsked.v1'
const VISITS_KEY = 'knoellchenfrei.visits.v1'
const INSTALL_HIDDEN_KEY = 'knoellchenfrei.installHidden.v1'

/**
 * Stored state is not trusted on the way back in.
 *
 * It survives deploys, so a shape from an older build is normal; it can also be
 * edited by hand or corrupted. A malformed session used to reach the UI intact
 * and render "NaN Min." or place the car marker at an impossible coordinate.
 */
export function loadSession(): ParkingSession | null {
  const raw = read<unknown>(SESSION_KEY)
  if (raw === null || typeof raw !== 'object') return null
  const value = raw as Partial<ParkingSession>

  const lon = Number(value.lon)
  const lat = Number(value.lat)
  const startedAt = Number(value.startedAt)
  if (!Number.isFinite(lon) || !Number.isFinite(lat) || !Number.isFinite(startedAt)) return null
  // Die Stadt, großzügig gefasst. Alles andere ist kein Parkplatz dieser App.
  if (!withinCitySession(CITY, lon, lat)) return null
  // A start in the future, or before this rewrite existed, is corrupt. The
  // lower bound matters: startedAt=1 rendered as "496850 Std." on the timer.
  const PROJECT_EPOCH = Date.UTC(2026, 0, 1)
  if (startedAt < PROJECT_EPOCH || startedAt > Date.now() + 60_000) return null

  const remindAt = Number(value.remindAt)
  // Bounded, not merely finite. A value like 9e15 is a valid number but not a
  // valid Date, and Intl.DateTimeFormat throws on it — which took down the whole
  // app on every load, including the reload the error screen suggests, because
  // the bad value stayed in storage.
  const remindPlausible =
    Number.isFinite(remindAt) && remindAt > 0 && remindAt < startedAt + 400 * 24 * 3_600_000

  return {
    lon,
    lat,
    startedAt,
    zone: typeof value.zone === 'string' && value.zone.length <= 32 ? value.zone : null,
    remindAt: remindPlausible ? remindAt : null,
  }
}

export function saveSession(session: ParkingSession | null): void {
  if (session === null) {
    try {
      localStorage.removeItem(SESSION_KEY)
    } catch {
      /* ignore */
    }
    return
  }
  write(SESSION_KEY, session)
}

export interface StoredSighting {
  id: string
  lat: number
  lon: number
  reportedAt: number
  confirmations: number
  disputes: number
}

/** Same reasoning as loadSession; a non-array here used to throw on render. */
export function loadSightings(): StoredSighting[] {
  const raw = read<unknown>(SIGHTINGS_KEY)
  if (!Array.isArray(raw)) return []
  const now = Date.now()
  return raw.flatMap((entry): StoredSighting[] => {
    if (entry === null || typeof entry !== 'object') return []
    const row = entry as Partial<StoredSighting>
    const lon = Number(row.lon)
    const lat = Number(row.lat)
    const reportedAt = Number(row.reportedAt)
    if (!Number.isFinite(lon) || !Number.isFinite(lat) || !Number.isFinite(reportedAt)) return []
    if (!withinCity(CITY, lon, lat)) return []
    if (reportedAt > now + 60_000) return []
    const id = typeof row.id === 'string' ? row.id : ''
    if (!/^[\w-]{1,64}$/.test(id)) return []
    return [
      {
        id,
        lon,
        lat,
        reportedAt,
        confirmations: Math.max(0, Math.min(500, Number(row.confirmations) || 0)),
        disputes: Math.max(0, Math.min(500, Number(row.disputes) || 0)),
      },
    ]
  })
}
export const saveSightings = (list: StoredSighting[]): void => write(SIGHTINGS_KEY, list)

/**
 * The heatmap's tallies, when no shared backend is available.
 *
 * A stricter cap than the sightings list: four weeks of marks on one device is
 * a few hundred rows at most, and a stored array is the one place a corrupt or
 * hand-edited value survives a deploy.
 */
const MAX_MARKS = 5_000

export function loadMarks(): HeatMark[] {
  const raw = read<unknown>(MARKS_KEY)
  if (!Array.isArray(raw)) return []
  const now = Date.now()
  const kept = raw.flatMap((entry): HeatMark[] => {
    const mark = sanitiseMark(entry)
    return mark === null ? [] : [mark]
  })
  const gone = new Set(expiredMarks(kept, { now }))
  return kept.filter((mark) => !gone.has(mark)).slice(-MAX_MARKS)
}

export const saveMarks = (list: readonly HeatMark[]): void => write(MARKS_KEY, list.slice(-MAX_MARKS))

/**
 * Ob der Standort-Vordialog schon einmal beantwortet wurde.
 *
 * Absichtlich nur ein Merker, kein gespeichertes „Nein": Die Entscheidung
 * gehört dem Browser. Hier steht bloß, dass wir schon gefragt haben — sonst
 * begrüßt die App jemanden bei jedem Aufruf mit derselben Karte.
 */
export function locationAsked(): boolean {
  return read<unknown>(LOCATION_ASKED_KEY) === true
}

export const rememberLocationAsked = (): void => write(LOCATION_ASKED_KEY, true)

/**
 * Wie oft diese Ansicht schon geöffnet wurde — eine Zahl, kein Verlauf.
 *
 * Nur dafür da, den Hinweis „auf dem Homescreen ablegen" nicht schon beim
 * ersten Blick zu zeigen. Wer eine App noch nicht kennt, will sie nicht
 * installieren.
 */
export function countVisit(): number {
  const previous = read<unknown>(VISITS_KEY)
  const count = typeof previous === 'number' && Number.isFinite(previous) ? previous : 0
  const next = Math.min(count + 1, 99)
  write(VISITS_KEY, next)
  return next
}

export function installHidden(): boolean {
  return read<unknown>(INSTALL_HIDDEN_KEY) === true
}

export const hideInstall = (): void => write(INSTALL_HIDDEN_KEY, true)
