/**
 * Statutory holidays in Berlin.
 *
 * Relevant because a weekday holiday is treated like a Sunday: no parking fee is
 * due. Getting this wrong makes the app tell people to pay on Good Friday.
 *
 * Berlin-specific: International Women's Day on 8 March has been a public
 * holiday here since 2019 and exists in no other Land except Mecklenburg-
 * Vorpommern. Reformationstag and Buß- und Bettag are not Berlin holidays.
 *
 * Easter Sunday and Whit Sunday are omitted deliberately — they always fall on a
 * Sunday, which the schedule already treats as free.
 */

import { berlinDateKey, type BerlinWallClock } from './berlin-time.js'

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

const cache = new Map<number, ReadonlySet<string>>()

/** Berlin holiday dates for a year, as `YYYY-MM-DD` keys. */
export function berlinHolidays(year: number): ReadonlySet<string> {
  const cached = cache.get(year)
  if (cached !== undefined) return cached

  const fixed = ['01-01', '03-08', '05-01', '10-03', '12-25', '12-26']
  const dates = new Set<string>(fixed.map((date) => `${year}-${date}`))

  dates.add(shiftFromEaster(year, -2)) // Karfreitag
  dates.add(shiftFromEaster(year, 1)) // Ostermontag
  dates.add(shiftFromEaster(year, 39)) // Christi Himmelfahrt
  dates.add(shiftFromEaster(year, 50)) // Pfingstmontag

  cache.set(year, dates)
  return dates
}

export function isBerlinHoliday(clock: BerlinWallClock): boolean {
  return berlinHolidays(clock.year).has(berlinDateKey(clock))
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
