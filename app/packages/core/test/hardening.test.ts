/**
 * Regression tests for defects found by adversarial review.
 * Each one failed before the fix it guards.
 */
import { describe, expect, it } from 'vitest'

import { adventSaturdays, isAdventSaturday } from '../src/holidays.js'
import { berlinWallClock } from '../src/berlin-time.js'
import { parseSchedule } from '../src/parse-schedule.js'
import { confidenceOf } from '../src/sighting.js'
import { estimateCost, isUncertainAt, MAX_PRICED_MINUTES, type ParkingZone } from '../src/tariff.js'
import { parseFee } from '../src/parse-fee.js'

const zone: ParkingZone = {
  id: '1',
  name: '1',
  land: 'BE',
  fee: parseFee('4,00 Euro'),
  windows: parseSchedule('Mo-Sa 9-22 Uhr').windows,
}

const spandau: ParkingZone = (() => {
  const parsed = parseSchedule('Mo-Fr 9-17 Uhr, Sa 9 -14 Uhr/ Advents-Sa 9 -17 Uhr')
  return {
    id: '10',
    name: '10',
    land: 'BE',
    fee: parseFee('2,00 Euro'),
    windows: parsed.windows,
    unmodelledRules: parsed.unmodelledRules,
  }
})()

describe('estimateCost bounds', () => {
  it('refuses a non-finite duration instead of looping forever', () => {
    expect(() => estimateCost(zone, Date.UTC(2026, 8, 7, 8), Infinity)).toThrow(RangeError)
    expect(() => estimateCost(zone, Date.UTC(2026, 8, 7, 8), Number.NaN)).toThrow(RangeError)
  })

  it('refuses a negative duration instead of quoting zero as fact', () => {
    expect(() => estimateCost(zone, Date.UTC(2026, 8, 7, 8), -60)).toThrow(RangeError)
  })

  it('caps an absurd duration at a week rather than blocking the thread', () => {
    const result = estimateCost(zone, Date.UTC(2026, 8, 7, 8), 10_000_000)
    expect(result.chargedMinutes).toBeLessThanOrEqual(MAX_PRICED_MINUTES)
  })
})

describe('confidence with hostile counters', () => {
  const base = { id: 'x', lat: 52.5, lon: 13.4, reportedAt: 0 }

  it('never scores above 1, even with negative disputes', () => {
    const result = confidenceOf({ ...base, confirmations: 0, disputes: -5 }, { now: 0 })
    expect(result.score).toBeLessThanOrEqual(1)
    expect(result.status).not.toBe('confirmed')
  })

  it('does not produce NaN from non-finite counters', () => {
    const result = confidenceOf(
      { ...base, confirmations: Number.POSITIVE_INFINITY, disputes: 0 },
      { now: 0 }
    )
    expect(Number.isFinite(result.score)).toBe(true)
  })
})

describe('parseSchedule input hardening', () => {
  it('rejects a long whitespace run quickly instead of backtracking', () => {
    const hostile = `Mo 9${' '.repeat(50_000)}-${' '.repeat(50_000)}x`
    const started = performance.now()
    expect(() => parseSchedule(hostile)).toThrow()
    expect(performance.now() - started).toBeLessThan(1000)
  })

  it('rejects impossible minutes rather than rolling them over', () => {
    expect(() => parseSchedule('Mo-Fr 9:75-20:00 Uhr')).toThrow()
  })
})

describe('Advent Saturdays', () => {
  it('finds the four shopping Saturdays of 2026', () => {
    // First Advent 2026 is 29 November, so the Saturdays are 28 Nov, 5, 12, 19 Dec.
    expect([...adventSaturdays(2026)].sort()).toEqual([
      '2026-11-28',
      '2026-12-05',
      '2026-12-12',
      '2026-12-19',
    ])
  })

  it('always yields Saturdays', () => {
    for (let year = 2020; year <= 2040; year += 1) {
      for (const date of adventSaturdays(year)) {
        expect(new Date(`${date}T12:00:00Z`).getUTCDay()).toBe(6)
      }
    }
  })

  it('marks a Spandau zone uncertain on an Advent Saturday, not on an ordinary one', () => {
    const adventSaturday = Date.UTC(2026, 11, 5, 15) // 5 Dec 2026, 16:00 local
    const plainSaturday = Date.UTC(2026, 8, 5, 14)
    expect(isAdventSaturday(berlinWallClock(adventSaturday))).toBe(true)
    expect(isUncertainAt(spandau, adventSaturday)).toBe(true)
    expect(isUncertainAt(spandau, plainSaturday)).toBe(false)
  })

  it('leaves zones without an unmodelled rule certain', () => {
    expect(isUncertainAt(zone, Date.UTC(2026, 11, 5, 15))).toBe(false)
  })
})
