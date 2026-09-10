import { chargeableAt } from '@knoellchenfrei/core'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { ZoneProperties } from '../src/types.js'

/**
 * `toParkingZone` hängt an der Stadt: Feiertage, die nur dort gelten, und die
 * Höchstparkdauer aus zwei Quellen. Beides Regeln aus CLAUDE.md (Mariä
 * Himmelfahrt in München, Hamburgs Minutenangabe vor Berlins Schlüssel) —
 * und bis zum 10. September in diesem Paket ungeprüft.
 */
const eigenschaften = (patch: Partial<ZoneProperties> = {}): ZoneProperties => ({
  zone: '1',
  district: 'Altstadt',
  rawHours: 'Mo-Sa 9-20 Uhr',
  rawFee: '2,00 Euro',
  note: null,
  windows: [{ weekdays: [1, 2, 3, 4, 5, 6], fromMinute: 540, toMinute: 1200 }],
  fee: { kind: 'exact', centsPerHour: 200 },
  unmodelledRules: [],
  sourceDefect: null,
  spaces: null,
  maxStay: null,
  maxStayShare: 0,
  maxStayValues: [],
  chargingPoints: 0,
  carsharing: 0,
  ...patch,
})

/** Samstag, 15. August 2026, 10:30 — Mariä Himmelfahrt, in München ein Feiertag. */
const HIMMELFAHRT = Date.parse('2026-08-15T10:30:00+02:00')

async function zone(stadt: string, patch: Partial<ZoneProperties> = {}) {
  // Die Stadt steht als Konstante im Modul; jede Stadt braucht ein frisches.
  vi.resetModules()
  vi.stubEnv('VITE_CITY', stadt)
  const { toParkingZone } = await import('../src/useZoneStatus.js')
  return toParkingZone(eigenschaften(patch))
}

beforeEach(() => {
  vi.resetModules()
  vi.stubGlobal('window', { localStorage: { getItem: () => null, setItem: () => undefined, removeItem: () => undefined } })
  vi.stubGlobal('navigator', {})
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

describe('toParkingZone trägt die Stadt in die Zone', () => {
  it('München: Mariä Himmelfahrt ist frei, in Berlin kassiert derselbe Samstag', async () => {
    expect(chargeableAt(await zone('muenchen'), HIMMELFAHRT).chargeable).toBe(false)
    expect(chargeableAt(await zone('berlin'), HIMMELFAHRT).chargeable).toBe(true)
  })

  it('das Bundesland kommt aus der Stadt, nicht aus einer Vorgabe', async () => {
    expect((await zone('hamburg')).land).toBe('HH')
    expect((await zone('karlsruhe')).land).toBe('BW')
  })

  it('eine Minutenangabe am Gebiet schlägt den Schlüssel der Abschnitte', async () => {
    expect((await zone('hamburg', { maxStayMinutes: 90, maxStay: '4h' })).maxStayMinutes).toBe(90)
    expect((await zone('berlin', { maxStay: '4h' })).maxStayMinutes).toBe(240)
    expect((await zone('berlin')).maxStayMinutes).toBeUndefined()
  })
})
