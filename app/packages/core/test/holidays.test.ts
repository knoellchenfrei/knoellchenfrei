import { describe, expect, it } from 'vitest'

import { berlinWallClock } from '../src/berlin-time.js'
import { berlinHolidays, isBerlinHoliday } from '../src/holidays.js'

describe('berlinHolidays', () => {
  it('places the movable feasts correctly for 2026 (Easter 5 April)', () => {
    const dates = berlinHolidays(2026)
    expect(dates.has('2026-04-03')).toBe(true) // Karfreitag
    expect(dates.has('2026-04-06')).toBe(true) // Ostermontag
    expect(dates.has('2026-05-14')).toBe(true) // Christi Himmelfahrt
    expect(dates.has('2026-05-25')).toBe(true) // Pfingstmontag
  })

  it('includes International Womens Day, which is Berlin-specific', () => {
    expect(berlinHolidays(2026).has('2026-03-08')).toBe(true)
  })

  it('excludes days that are not Berlin holidays', () => {
    const dates = berlinHolidays(2026)
    expect(dates.has('2026-10-31')).toBe(false) // Reformationstag
    expect(dates.has('2026-11-18')).toBe(false) // Buss- und Bettag
  })

  it('handles a year where Easter falls in March', () => {
    // Easter 2024 was 31 March, so Good Friday lands in March.
    expect(berlinHolidays(2024).has('2024-03-29')).toBe(true)
    expect(berlinHolidays(2024).has('2024-04-01')).toBe(true)
  })

  it('detects a holiday from a wall-clock reading', () => {
    // 1 May 2026, 10:00 Berlin time.
    expect(isBerlinHoliday(berlinWallClock(Date.UTC(2026, 4, 1, 8, 0)))).toBe(true)
  })
})
