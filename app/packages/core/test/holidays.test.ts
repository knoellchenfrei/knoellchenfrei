import { describe, expect, it } from 'vitest'

import { berlinWallClock } from '../src/berlin-time.js'
import { holidaysFor, isHoliday, type Land } from '../src/holidays.js'

describe('holidaysFor', () => {
  it('places the movable feasts correctly for 2026 (Easter 5 April)', () => {
    const dates = holidaysFor('BE', 2026)
    expect(dates.has('2026-04-03')).toBe(true) // Karfreitag
    expect(dates.has('2026-04-06')).toBe(true) // Ostermontag
    expect(dates.has('2026-05-14')).toBe(true) // Christi Himmelfahrt
    expect(dates.has('2026-05-25')).toBe(true) // Pfingstmontag
  })

  it('includes International Womens Day, which is Berlin-specific', () => {
    expect(holidaysFor('BE', 2026).has('2026-03-08')).toBe(true)
  })

  it('excludes days that are not Berlin holidays', () => {
    const dates = holidaysFor('BE', 2026)
    expect(dates.has('2026-10-31')).toBe(false) // Reformationstag
    expect(dates.has('2026-11-18')).toBe(false) // Buss- und Bettag
  })

  it('handles a year where Easter falls in March', () => {
    // Easter 2024 was 31 March, so Good Friday lands in March.
    expect(holidaysFor('BE', 2024).has('2024-03-29')).toBe(true)
    expect(holidaysFor('BE', 2024).has('2024-04-01')).toBe(true)
  })

  it('detects a holiday from a wall-clock reading', () => {
    // 1 May 2026, 10:00 Berlin time.
    expect(isHoliday('BE', berlinWallClock(Date.UTC(2026, 4, 1, 8, 0)))).toBe(true)
  })

  // Der eigentliche Grund für die Umstellung: Berlin und Hamburg haben
  // *verschiedene* Feiertage. Sähen die beiden Kalender gleich aus, wäre die
  // ganze Tabelle überflüssig.
  it('gives Hamburg Reformationstag and denies it Womens Day', () => {
    const hh = holidaysFor('HH', 2026)
    expect(hh.has('2026-10-31')).toBe(true) // Reformationstag, seit 2018
    expect(hh.has('2026-03-08')).toBe(false) // gilt nur in BE und MV
  })

  it('keeps the nine nationwide holidays in both Länder', () => {
    const be = holidaysFor('BE', 2026)
    const hh = holidaysFor('HH', 2026)
    for (const date of ['2026-01-01', '2026-05-01', '2026-10-03', '2026-12-25', '2026-12-26']) {
      expect(be.has(date)).toBe(true)
      expect(hh.has(date)).toBe(true)
    }
  })

  it('counts ten holidays for Hamburg and ten for Berlin', () => {
    // Neun bundesweite plus je einer. Die Zahl steht hier, damit ein
    // versehentlich doppelt eingetragenes Datum auffällt.
    expect(holidaysFor('BE', 2026).size).toBe(10)
    expect(holidaysFor('HH', 2026).size).toBe(10)
  })

  // Ein Land ohne hinterlegten Kalender darf nicht als "keine Feiertage"
  // durchgehen: Das hiesse, an Karfreitag zum Zahlen aufzufordern, und zwar
  // ohne dass irgendwo etwas nach einem Fehler aussieht.
  it('throws for a Land that has no table yet, rather than returning nothing', () => {
    expect(() => holidaysFor('BY' as Land, 2026)).toThrow(/BY/)
  })
})
