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

describe('echte WFS-Daten', () => {
  it('trägt die 103 Zonen, die der Dienst gemeldet hat', () => {
    expect(ZONES).toHaveLength(103)
    expect(new Set(ZONES.map((z) => z.parkzone)).size).toBe(103)
  })

  it('liest jeden zeiten-Wert ohne Ausnahme', () => {
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

  it('liest jeden gebuehr-Wert ohne Ausnahme', () => {
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

  it('nagelt die verschiedenen Schreibweisen fest, damit eine Feed-Änderung die CI rot macht', () => {
    expect(new Set(ZONES.map((z) => z.zeiten)).size).toBe(18)
    expect(new Set(ZONES.map((z) => z.gebuehr)).size).toBe(5)
  })

  it('findet genau eine Zone, die sonntags kassiert', () => {
    const sunday = ZONES.filter((z) => parseSchedule(z.zeiten).windows.some((w) => w.weekdays.includes(0)))
    expect(sunday.map((z) => z.parkzone)).toEqual(['29'])
  })

  it('markiert die Advents-Zonen als Träger von Regeln, die das Modell nicht ausdrücken kann', () => {
    const flagged = ZONES.filter((z) => parseSchedule(z.zeiten).unmodelledRules.length > 0)
    expect(flagged.map((z) => z.parkzone).sort()).toEqual(['10', '11', '12', '13'])
  })

  it('hält die verdoppelte Quellzeile als Mangel fest, statt sie falsch zu lesen', () => {
    const zone54 = ZONES.find((z) => z.parkzone === '54')
    const parsed = parseSchedule(zone54?.zeiten ?? '')
    expect(parsed.sourceDefect).toBeDefined()
    expect(parsed.windows).toEqual([{ weekdays: [1, 2, 3, 4, 5, 6], fromMinute: 540, toMinute: 1320 }])
  })

  it('behält Gebührenspannen als Spannen', () => {
    const ranged = ZONES.filter((z) => parseFee(z.gebuehr).kind === 'range')
    expect(ranged).toHaveLength(3)
  })

  it('nennt die echte Tarifspanne 2,00 bis 4,00 Euro', () => {
    const cents = ZONES.flatMap((z) => {
      const fee = parseFee(z.gebuehr)
      // `parseFee` liefert für den Berliner Feed nur 'exact' und 'range' —
      // 'disc' und 'unknown' gibt es nur in Hamburg. Der Zweig steht trotzdem
      // hier, weil der Typ sie kennt und ein stiller Durchfall sonst als
      // fehlender Betrag durchginge.
      if (fee.kind === 'exact') return [fee.centsPerHour]
      if (fee.kind === 'range') return [fee.minCentsPerHour, fee.maxCentsPerHour]
      throw new Error(`Berliner Feed liefert unerwartet ${fee.kind}`)
    })
    expect(Math.min(...cents)).toBe(200)
    expect(Math.max(...cents)).toBe(400)
  })
})
