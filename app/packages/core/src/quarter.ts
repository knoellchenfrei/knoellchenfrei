import { berlinDateKey, berlinWallClock, type BerlinWallClock, type Weekday } from './berlin-time.js'
import { holidaysFor, type Land } from './holidays.js'

/**
 * Quartale und Beobachtungstage — der Kalender hinter den Langzeitmustern.
 *
 * Die Langzeittabelle trägt kein Datum, nur das Quartal (`YYYY-Qn`): Ein
 * Quartal hat dreizehn gleiche Wochentage, eine „1" in einer Zeile sagt „an
 * einem von dreizehn". Damit die Rate daraus stimmt, muss der Nenner aus dem
 * Kalender kommen — wie viele Dienstage lagen im Quartal zwischen dem ersten
 * Erntetag und gestern? Feiertage zählen dabei als Sonntag: Wer an Mariä
 * Himmelfahrt in München meldet, meldet an einem gebührenfreien Tag, und der
 * gehört in die Spalte der Sonntage, nicht in die des Samstags, auf den er
 * fällt.
 */
const DAY_MS = 86_400_000
const QUARTER = /^(\d{4})-Q([1-4])$/

export function quarterOf(clock: BerlinWallClock): string {
  return `${clock.year}-Q${Math.floor((clock.month - 1) / 3) + 1}`
}

export function quarterAt(instant: Date | number): string {
  return quarterOf(berlinWallClock(instant))
}

/** Fortlaufende Nummer, damit Abstände zwischen Quartalen rechenbar sind. */
export function quarterIndex(quarter: string): number {
  const match = QUARTER.exec(quarter)
  if (match === null) throw new RangeError(`kein Quartal: ${quarter}`)
  return Number(match[1]) * 4 + Number(match[2]) - 1
}

export function quarterFromIndex(index: number): string {
  if (!Number.isInteger(index)) throw new RangeError(`keine Quartalsnummer: ${index}`)
  return `${Math.floor(index / 4)}-Q${(index % 4) + 1}`
}

/** Das Quartal `n` Schritte vor `quarter` (n darf negativ sein). */
export function quarterBefore(quarter: string, n: number): string {
  return quarterFromIndex(quarterIndex(quarter) - n)
}

/** Erster Kalendertag des Quartals, als `YYYY-MM-DD`. */
export function quarterStart(quarter: string): string {
  const match = QUARTER.exec(quarter)
  if (match === null) throw new RangeError(`kein Quartal: ${quarter}`)
  const month = (Number(match[2]) - 1) * 3 + 1
  return `${match[1]}-${String(month).padStart(2, '0')}-01`
}

/** Letzter Kalendertag des Quartals, als `YYYY-MM-DD`. */
export function quarterEnd(quarter: string): string {
  const next = quarterStart(quarterBefore(quarter, -1))
  const asUtc = Date.parse(`${next}T00:00:00Z`) - DAY_MS
  return new Date(asUtc).toISOString().slice(0, 10)
}

/** ISO-Woche `YYYY-Www` zu einem Berliner Kalendertag. */
export function isoWeekOf(clock: BerlinWallClock): string {
  // Rechnung in UTC über den Kalendertag: Die Woche hängt nur am Datum.
  const date = new Date(Date.UTC(clock.year, clock.month - 1, clock.day))
  const weekday = date.getUTCDay() === 0 ? 7 : date.getUTCDay()
  // Donnerstag derselben Woche bestimmt das ISO-Jahr.
  date.setUTCDate(date.getUTCDate() + 4 - weekday)
  const yearStart = Date.UTC(date.getUTCFullYear(), 0, 1)
  const week = Math.ceil(((date.getTime() - yearStart) / DAY_MS + 1) / 7)
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, '0')}`
}

export interface ObservedDaysOptions {
  /** Erster Tag mit Ernte, `YYYY-MM-DD`; frühere Tage des Quartals zählen nicht. */
  since: string
  /** Letzter zu zählender Tag, `YYYY-MM-DD` (gestern — der heutige Tag ist noch nicht vollständig). */
  until: string
  land: Land
  extraHolidays?: readonly string[]
}

/**
 * Wie viele Tage je Wochentag (Sonntag = 0) im Quartal zwischen `since` und
 * `until` lagen — Feiertage vom eigenen Wochentag abgezogen und dem Sonntag
 * zugeschlagen. Die Summe über alle sieben ist die Zahl der Kalendertage.
 */
export function observedDays(quarter: string, options: ObservedDaysOptions): number[] {
  const counts = new Array<number>(7).fill(0)
  const from = maxDay(quarterStart(quarter), options.since)
  const to = minDay(quarterEnd(quarter), options.until)
  if (from > to) return counts
  let cursor = Date.parse(`${from}T00:00:00Z`)
  const end = Date.parse(`${to}T00:00:00Z`)
  for (; cursor <= end; cursor += DAY_MS) {
    const date = new Date(cursor)
    const key = date.toISOString().slice(0, 10)
    const weekday = date.getUTCDay() as Weekday
    const holiday = holidaysFor(options.land, date.getUTCFullYear(), options.extraHolidays ?? []).has(key)
    const slot = holiday ? 0 : weekday
    counts[slot] = (counts[slot] ?? 0) + 1
  }
  return counts
}

/** Der Wochentag einer Berliner Uhrzeit für die Langzeittabelle: Feiertag = Sonntag. */
export function patternWeekday(
  clock: BerlinWallClock,
  land: Land,
  extraHolidays: readonly string[] = [],
): Weekday {
  return holidaysFor(land, clock.year, extraHolidays).has(berlinDateKey(clock)) ? 0 : clock.weekday
}

const maxDay = (a: string, b: string): string => (a > b ? a : b)
const minDay = (a: string, b: string): string => (a < b ? a : b)
