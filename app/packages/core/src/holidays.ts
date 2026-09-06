/**
 * Statutory holidays, by Bundesland.
 *
 * Relevant because a weekday holiday is treated like a Sunday: no parking fee is
 * due. Getting this wrong makes the app tell people to pay on Good Friday.
 *
 * Was hier bewusst fehlt: die zwölf übrigen Bundesländer. Die Tabelle ist
 * leicht zu erweitern — aber nur mit einem Beleg je Eintrag, und aus dieser
 * Arbeitsumgebung sind fast alle amtlichen Seiten gesperrt. Ein unbekanntes
 * Land wirft deshalb, statt eine leere Menge zu liefern: Eine Stadt ohne
 * Feiertage würde an Karfreitag zum Zahlen auffordern und dabei nach nichts
 * aussehen. Zwei Fallstricke für den, der die Tabelle erweitert, stehen bei
 * `REGIONAL`.
 *
 * Easter Sunday and Whit Sunday are omitted deliberately — they always fall on a
 * Sunday, which the schedule already treats as free.
 */

import { berlinDateKey, type BerlinWallClock } from './berlin-time.js'

/** Amtliche Kürzel der Bundesländer, so weit belegt. */
export type Land = 'BE' | 'HH'

/**
 * Easter Sunday for a Gregorian year, as a UTC calendar date.
 * Anonymous Gregorian algorithm (Meeus/Jones/Butcher).
 */
function easterSunday(year: number): { month: number; day: number } {
  const a = year % 19
  const b = Math.floor(year / 100)
  const c = year % 100
  const d = Math.floor(b / 4)
  const e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4)
  const k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const month = Math.floor((h + l - 7 * m + 114) / 31)
  const day = ((h + l - 7 * m + 114) % 31) + 1
  return { month, day }
}

function shiftFromEaster(year: number, offsetDays: number): string {
  const easter = easterSunday(year)
  const date = new Date(Date.UTC(year, easter.month - 1, easter.day + offsetDays))
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  const day = String(date.getUTCDate()).padStart(2, '0')
  return `${date.getUTCFullYear()}-${month}-${day}`
}

/**
 * Die neun Feiertage, die in allen sechzehn Ländern gelten.
 *
 * Feste Daten als `MM-TT`, bewegliche als Abstand zum Ostersonntag.
 */
const NATIONWIDE_FIXED = ['01-01', '05-01', '10-03', '12-25', '12-26'] as const
const NATIONWIDE_FROM_EASTER = [
  -2, // Karfreitag
  1, // Ostermontag
  39, // Christi Himmelfahrt
  50, // Pfingstmontag
] as const

/**
 * Was ein Land über die neun bundesweiten hinaus hat.
 *
 * Zwei Fallstricke, bevor jemand hier ein Land ergänzt:
 *
 * - **Manche Feiertage gelten nur in Teilen eines Landes.** Mariä Himmelfahrt
 *   ist in Bayern gemeindeweise geregelt, Fronleichnam in Sachsen und
 *   Thüringen ebenso. Eine Tabelle je Land kann das nicht ausdrücken; für
 *   München gehört der Eintrag deshalb an die Stadt, nicht ans Land.
 * - **Buß- und Bettag ist beweglich, aber nicht österlich.** Er ist der
 *   Mittwoch vor dem 23. November und braucht eine eigene Regel, kein
 *   festes Datum.
 *
 * Belege für die beiden Einträge unten:
 *
 * - **BE** — Der Internationale Frauentag am 8. März ist seit 2019 in Berlin
 *   gesetzlicher Feiertag; außer Berlin führt ihn nur Mecklenburg-Vorpommern.
 *   Reformationstag und Buß- und Bettag sind in Berlin keine Feiertage.
 * - **HH** — Der Reformationstag am 31. Oktober ist seit 2018 gesetzlicher
 *   Feiertag; damit hat Hamburg zehn. Der 8. März ist keiner, Fronleichnam
 *   auch nicht. Nachgesehen am 6. September 2026.
 */
const REGIONAL: Record<Land, readonly string[]> = {
  BE: ['03-08'], // Internationaler Frauentag
  HH: ['10-31'], // Reformationstag
}

const cache = new Map<string, ReadonlySet<string>>()

/** Feiertage eines Landes in einem Jahr, als `YYYY-MM-DD`-Schlüssel. */
export function holidaysFor(land: Land, year: number): ReadonlySet<string> {
  const cacheKey = `${land}:${year}`
  const cached = cache.get(cacheKey)
  if (cached !== undefined) return cached

  // Ausdrücklich als "kann fehlen" typisiert: Zur Übersetzungszeit deckt
  // `Record<Land, …>` jeden Fall ab, zur Laufzeit kommt `land` aber aus
  // Konfiguration und damit aus einer Datei, die niemand geprüft hat.
  const regional: readonly string[] | undefined = REGIONAL[land]
  if (regional === undefined) {
    throw new Error(`Kein Feiertagskalender für "${land}" hinterlegt`)
  }

  const dates = new Set<string>(
    [...NATIONWIDE_FIXED, ...regional].map((date) => `${year}-${date}`),
  )
  for (const offset of NATIONWIDE_FROM_EASTER) dates.add(shiftFromEaster(year, offset))

  cache.set(cacheKey, dates)
  return dates
}

export function isHoliday(land: Land, clock: BerlinWallClock): boolean {
  return holidaysFor(land, clock.year).has(berlinDateKey(clock))
}

/**
 * The four Saturdays commonly called "Advents-Samstage".
 *
 * First Advent is the fourth Sunday before Christmas, so it falls between
 * 27 November and 3 December. The four shopping Saturdays are the Saturdays
 * preceding each Advent Sunday.
 *
 * The Berlin parking feed writes "Advents-Sa" in four Spandau zones without
 * defining which Saturdays it means, and no published rule settles it. This is
 * the everyday retail reading; because it is a reading and not the source's own
 * definition, callers should treat these dates as *uncertain* rather than
 * charging on them outright.
 */
export function adventSaturdays(year: number): ReadonlySet<string> {
  // Walk back from Christmas Eve to the preceding Sunday: that is 4th Advent.
  const christmas = new Date(Date.UTC(year, 11, 24))
  const fourthAdvent = new Date(christmas)
  fourthAdvent.setUTCDate(christmas.getUTCDate() - christmas.getUTCDay())

  const dates = new Set<string>()
  for (let week = 0; week < 4; week += 1) {
    // The Saturday before that Advent Sunday.
    const saturday = new Date(fourthAdvent)
    saturday.setUTCDate(fourthAdvent.getUTCDate() - week * 7 - 1)
    const month = String(saturday.getUTCMonth() + 1).padStart(2, '0')
    const day = String(saturday.getUTCDate()).padStart(2, '0')
    dates.add(`${saturday.getUTCFullYear()}-${month}-${day}`)
  }
  return dates
}

export function isAdventSaturday(clock: BerlinWallClock): boolean {
  return clock.weekday === 6 && adventSaturdays(clock.year).has(berlinDateKey(clock))
}
