import { unitOfZone, type PatternLevel, type UnitPattern } from '@knoellchenfrei/core'

/**
 * Die Langzeitmuster vom Worker (`GET /patterns?city=`), täglich dort
 * gerechnet, hier nur gelesen. Sechs Stunden im Speicher, kein
 * `localStorage` — jeder Schlüssel dort braucht eine Zeile in der
 * Datenschutzerklärung, und ein Muster ist nichts, was ein Gerät behalten
 * muss. Ohne Worker (Artifact, lokaler Modus) gibt es keine Muster; das
 * Zonenblatt sagt es dann, statt „ruhig" zu raten.
 */
export interface PatternStand {
  erzeugtAm: string
  city: string
  since: string | null
  quarters: number
  base: number
  profile: number[]
  n: number[]
  cityWindows: number
  units: Record<string, UnitPattern>
  guete: {
    quarter: string
    windows: number
    brier: number
    brierBase: number
    brierProfile: number
    skill: number
    skillProfile: number
  } | null
}

export const PATTERN_CACHE_MS = 6 * 3_600_000

const LEVELS: readonly PatternLevel[] = [0, 1, 2, 3]

/** Liest den Stand und lässt fallen, was nicht die Form hat — die Antwort kommt über das Netz. */
export function parsePatterns(body: unknown): PatternStand | null {
  if (typeof body !== 'object' || body === null) return null
  const roh = body as Record<string, unknown>
  if (typeof roh.city !== 'string' || typeof roh.erzeugtAm !== 'string') return null
  if (!Array.isArray(roh.n) || roh.n.length !== 7 || !roh.n.every((v) => typeof v === 'number')) return null
  const units: Record<string, UnitPattern> = {}
  if (typeof roh.units === 'object' && roh.units !== null) {
    for (const [unit, wert] of Object.entries(roh.units as Record<string, unknown>)) {
      if (typeof wert !== 'object' || wert === null) continue
      const u = wert as Record<string, unknown>
      const levels = Array.isArray(u.levels) ? u.levels : null
      const k = Array.isArray(u.k) ? u.k : null
      if (levels === null || k === null || levels.length !== 168 || k.length !== 168) continue
      if (!levels.every((l) => typeof l === 'number' && LEVELS.includes(l as PatternLevel))) continue
      units[unit] = {
        levels: levels as PatternLevel[],
        k: k.map((v) => (typeof v === 'number' && Number.isFinite(v) ? v : 0)),
        p: Array.isArray(u.p) ? (u.p as number[]) : new Array<number>(168).fill(0),
        factor: typeof u.factor === 'number' ? u.factor : 1,
        windows: typeof u.windows === 'number' ? u.windows : 0,
        reports: typeof u.reports === 'number' ? u.reports : 0,
        confirmedShare: typeof u.confirmedShare === 'number' ? u.confirmedShare : null,
      }
    }
  }
  const guete = roh.guete
  return {
    erzeugtAm: roh.erzeugtAm,
    city: roh.city,
    since: typeof roh.since === 'string' ? roh.since : null,
    quarters: typeof roh.quarters === 'number' ? roh.quarters : 0,
    base: typeof roh.base === 'number' ? roh.base : 0,
    profile: Array.isArray(roh.profile) ? (roh.profile as number[]) : [],
    n: roh.n as number[],
    cityWindows: typeof roh.cityWindows === 'number' ? roh.cityWindows : 0,
    units,
    guete:
      typeof guete === 'object' && guete !== null && typeof (guete as { skill?: unknown }).skill === 'number'
        ? (guete as PatternStand['guete'])
        : null,
  }
}

let cache: { city: string; at: number; stand: PatternStand | null } | null = null

/**
 * Der Stand der Stadt, oder null: ohne Worker, offline, vor dem ersten
 * Tageslauf (404). Ein Fehler ist still — die Zonen und Striche bleiben.
 */
export async function loadPatterns(city: string, now = Date.now()): Promise<PatternStand | null> {
  const base = import.meta.env.VITE_API_BASE as string | undefined
  if (typeof base !== 'string' || base.length === 0) return null
  if (cache !== null && cache.city === city && now - cache.at < PATTERN_CACHE_MS) return cache.stand
  let stand: PatternStand | null = null
  try {
    const response = await fetch(`${base.replace(/\/+$/, '')}/patterns?city=${encodeURIComponent(city)}`, {
      signal: AbortSignal.timeout(10_000),
    })
    if (response.ok) stand = parsePatterns(await response.json())
  } catch {
    stand = null
  }
  cache = { city, at: now, stand }
  return stand
}

/** Nur für Tests: den Speicher leeren. */
export function forgetPatterns(): void {
  cache = null
}

/** Das Muster der Einheit, zu der eine Zone gehört — oder null. */
export function patternForZone(stand: PatternStand | null, city: string, zoneKey: string): UnitPattern | null {
  if (stand === null) return null
  const unit = unitOfZone(city, zoneKey)
  if (unit === null) return null
  return stand.units[unit] ?? null
}
