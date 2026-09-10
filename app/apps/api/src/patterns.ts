import {
  backtest,
  berlinDateKey,
  berlinWallClock,
  CITIES,
  fitPatterns,
  observedDays,
  quarterAt,
  quarterBefore,
  isoWeekOf,
  patternWeekday,
  type BerlinWallClock,
  type City,
  type BacktestResult,
  type PatternResult,
  type PatternRow,
} from '@knoellchenfrei/core'

import { unitCount } from './units.js'

/**
 * Das Tagesmodell: aus den Langzeitzählern je Stadt die Muster rechnen und
 * als JSON in den KV legen. Einmal am Tag, nicht stündlich — bei drei Jahren
 * Daten wären das 24 × 400.000 gelesene Zeilen, über dem Tagesbudget von D1;
 * so sind es unter 8 % davon. Die Formeln liegen in `core` und laufen dort
 * ohne Datenbank in Tests; hier ist nur der Weg von Tabelle zu KV.
 *
 * Dazu die zwei Dinge, die nur täglich Sinn haben: die Nutzung des Vortags
 * aus `events` in `kontrollen_nutzung` übernehmen (bevor `events` nach 90
 * Tagen verfällt) und die Fristen der Langzeittabellen halten.
 */
export const PATTERNS_KEY = 'patterns:v1'
/** So viele Quartale zurück liest das Modell — mehr trägt nach dem Verfall nichts bei. */
export const MODEL_QUARTERS = 8
/** Frist der Langzeitzähler: zwölf Quartale, danach gelöscht. */
export const KEEP_QUARTERS = 12
/** Frist des Wochenverlaufs: drei Jahre. */
export const KEEP_WEEKS_MS = 3 * 365 * 86_400_000

export interface PatternStand {
  erzeugtAm: string
  city: string
  since: string | null
  quarters: number
  base: number
  /** Stadtprofil je Wochenstunde in Promille. */
  profile: number[]
  n: number[]
  cityWindows: number
  units: PatternResult['units']
  guete: BacktestResult | null
}

interface LangzeitRow extends PatternRow {
  city: string
}

export function patternsKey(city: string): string {
  return `${PATTERNS_KEY}:${city}`
}

export async function rollupPatterns(env: { DB: D1Database; CACHE: KVNamespace }, now: number): Promise<void> {
  const currentQuarter = quarterAt(now)
  const oldest = quarterBefore(currentQuarter, MODEL_QUARTERS - 1)
  const yesterday = berlinDateKey(berlinWallClock(now - 86_400_000))

  for (const city of CITIES) {
    const meta = await env.DB.prepare('SELECT since FROM kontrollen_meta WHERE city = ?')
      .bind(city.key)
      .first<{ since: string }>()
    const { results } = await env.DB.prepare(
      'SELECT unit, quarter, weekday, hour, slots, reports, confirmed, disputed, weight FROM kontrollen_langzeit' +
        ' WHERE city = ? AND quarter >= ?',
    )
      .bind(city.key, oldest)
      .all<LangzeitRow>()
    const rows = results ?? []

    const observed: Record<string, number[]> = {}
    if (meta !== null) {
      for (let back = MODEL_QUARTERS - 1; back >= 0; back -= 1) {
        const quarter = quarterBefore(currentQuarter, back)
        observed[quarter] = observedDays(quarter, {
          since: meta.since,
          until: yesterday,
          land: city.land,
          extraHolidays: city.holidays ?? [],
        })
      }
    }

    const fitted = fitPatterns({ rows, observed, currentQuarter, unitCount: unitCount(city.key) })
    const guete = backtest({ rows, observed, currentQuarter })
    const stand: PatternStand = {
      erzeugtAm: new Date(now).toISOString(),
      city: city.key,
      since: meta?.since ?? null,
      quarters: Object.keys(observed).length,
      base: Math.round(fitted.base * 1e5) / 1e5,
      profile: fitted.profile.map((p) => Math.round(p * 1000)),
      n: fitted.n,
      cityWindows: fitted.cityWindows,
      units: fitted.units,
      guete,
    }
    await env.CACHE.put(patternsKey(city.key), JSON.stringify(stand))
  }
}

/**
 * Die Nutzung des Vortags aus `events` in die Langzeittabelle, je Stadt
 * genau einmal: `kontrollen_meta.nutzung_bis` sagt, bis wohin es schon
 * geschehen ist. Ohne Meta-Zeile (noch keine Ernte) passiert nichts —
 * eine Stadt ohne Meldungen braucht keinen Nenner.
 */
export async function rollupUsage(db: D1Database, now: number): Promise<number> {
  const yesterdayClock = berlinWallClock(now - 86_400_000)
  const yesterday = berlinDateKey(yesterdayClock)
  const quarter = quarterAt(now - 86_400_000)
  let written = 0
  for (const city of CITIES) {
    const meta = await db.prepare('SELECT nutzung_bis FROM kontrollen_meta WHERE city = ?')
      .bind(city.key)
      .first<{ nutzung_bis: string | null }>()
    if (meta === null || (meta.nutzung_bis !== null && meta.nutzung_bis >= yesterday)) continue
    const { results } = await db
      .prepare(
        "SELECT hour, SUM(n) AS n FROM events WHERE day = ? AND city = ? AND name = 'app.open' AND hour >= 0 GROUP BY hour",
      )
      .bind(yesterday, city.key)
      .all<{ hour: number; n: number }>()
    // Der Wochentag der Nutzung folgt derselben Feiertagsregel wie die Meldungen.
    const weekday = holidayWeekday(city, yesterdayClock)
    const statements = (results ?? []).map((row) =>
      db
        .prepare(
          'INSERT INTO kontrollen_nutzung (city, quarter, weekday, hour, opens, hours_used) VALUES (?, ?, ?, ?, ?, 1)' +
            ' ON CONFLICT (city, quarter, weekday, hour) DO UPDATE SET opens = opens + excluded.opens, hours_used = hours_used + 1',
        )
        .bind(city.key, quarter, weekday, row.hour, row.n),
    )
    const opens = (results ?? []).reduce((s, r) => s + r.n, 0)
    statements.push(
      db
        .prepare('UPDATE kontrollen_verlauf SET opens = opens + ? WHERE city = ? AND week = ?')
        .bind(opens, city.key, weekOf(yesterdayClock)),
    )
    statements.push(db.prepare('UPDATE kontrollen_meta SET nutzung_bis = ? WHERE city = ?').bind(yesterday, city.key))
    await db.batch(statements)
    written += statements.length - 1
  }
  return written
}

export async function pruneLongTerm(db: D1Database, now: number): Promise<void> {
  const oldestKept = quarterBefore(quarterAt(now), KEEP_QUARTERS - 1)
  const oldestWeek = weekOf(berlinWallClock(now - KEEP_WEEKS_MS))
  await db.batch([
    db.prepare('DELETE FROM kontrollen_langzeit WHERE quarter < ?').bind(oldestKept),
    db.prepare('DELETE FROM kontrollen_nutzung WHERE quarter < ?').bind(oldestKept),
    db.prepare('DELETE FROM kontrollen_verlauf WHERE week < ?').bind(oldestWeek),
  ])
}

const weekOf = (clock: BerlinWallClock): string => isoWeekOf(clock)
const holidayWeekday = (city: City, clock: BerlinWallClock): number =>
  patternWeekday(clock, city.land, city.holidays ?? [])
