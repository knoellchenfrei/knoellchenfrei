/**
 * Parses the real WFS payload. Any change to the Berlin feed that this parser
 * cannot handle must fail here rather than silently mis-quote a price.
 */
import { describe, expect, it } from 'vitest'

import { parseFee } from '../src/parse-fee.js'
import { parseSchedule } from '../src/parse-schedule.js'
import zones from './fixtures/parkzonen-2026-09-06.json' with { type: 'json' }

interface RawZone {
  id: string
  parkzone: string
  bezirk: string
  zeiten: string
  gebuehr: string
  bemerkung: string | null
}

const ZONES = zones as RawZone[]

describe('real WFS data', () => {
  it('carries the 103 zones the service reported', () => {
    expect(ZONES).toHaveLength(103)
    expect(new Set(ZONES.map((z) => z.parkzone)).size).toBe(103)
  })

  it('parses every zeiten value without exception', () => {
    const failures: string[] = []
    for (const zone of ZONES) {
      try {
        parseSchedule(zone.zeiten)
      } catch (error) {
        failures.push(`${zone.parkzone}: ${(error as Error).message}`)
      }
    }
    expect(failures).toEqual([])
  })

  it('parses every gebuehr value without exception', () => {
    const failures: string[] = []
    for (const zone of ZONES) {
      try {
        parseFee(zone.gebuehr)
      } catch (error) {
        failures.push(`${zone.parkzone}: ${(error as Error).message}`)
      }
    }
    expect(failures).toEqual([])
  })

  it('pins the distinct spellings so a feed change fails CI', () => {
    expect(new Set(ZONES.map((z) => z.zeiten)).size).toBe(18)
    expect(new Set(ZONES.map((z) => z.gebuehr)).size).toBe(5)
  })

  it('finds exactly one zone that charges on Sunday', () => {
    const sunday = ZONES.filter((z) => parseSchedule(z.zeiten).windows.some((w) => w.weekdays.includes(0)))
    expect(sunday.map((z) => z.parkzone)).toEqual(['29'])
  })

  it('flags the Advent zones as carrying rules the model cannot express', () => {
    const flagged = ZONES.filter((z) => parseSchedule(z.zeiten).unmodelledRules.length > 0)
    expect(flagged.map((z) => z.parkzone).sort()).toEqual(['10', '11', '12', '13'])
  })

  it('records the doubled source string as a defect rather than mis-parsing it', () => {
    const zone54 = ZONES.find((z) => z.parkzone === '54')
    const parsed = parseSchedule(zone54?.zeiten ?? '')
    expect(parsed.sourceDefect).toBeDefined()
    expect(parsed.windows).toEqual([{ weekdays: [1, 2, 3, 4, 5, 6], fromMinute: 540, toMinute: 1320 }])
  })

  it('keeps fee ranges as ranges', () => {
    const ranged = ZONES.filter((z) => parseFee(z.gebuehr).kind === 'range')
    expect(ranged).toHaveLength(3)
  })

  it('reports the real rate span as 2.00 to 4.00 EUR', () => {
    const cents = ZONES.flatMap((z) => {
      const fee = parseFee(z.gebuehr)
      return fee.kind === 'exact' ? [fee.centsPerHour] : [fee.minCentsPerHour, fee.maxCentsPerHour]
    })
    expect(Math.min(...cents)).toBe(200)
    expect(Math.max(...cents)).toBe(400)
  })
})
