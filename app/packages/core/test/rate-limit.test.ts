/**
 * Der Fehler, gegen den diese Tests stehen, war nicht sichtbar: Die Grenze galt
 * — nur eben doppelt, und nur am Stundenwechsel.
 */
import { describe, expect, it } from 'vitest'

import { countingWindowStart } from '../src/rate-limit.js'

const HOUR = 3_600_000

/** 7. September 2026, 10:59 Uhr UTC — eine Minute vor dem Wechsel. */
const KURZ_VOR = Date.UTC(2026, 8, 7, 10, 59, 0)
/** …und 11:01, zwei Minuten später. */
const KURZ_NACH = Date.UTC(2026, 8, 7, 11, 1, 0)

describe('countingWindowStart', () => {
  it('ist ohne Rundung ein rollendes Fenster', () => {
    expect(countingWindowStart(KURZ_NACH, HOUR)).toBe(KURZ_NACH - HOUR)
    expect(countingWindowStart(KURZ_NACH, HOUR, 1)).toBe(KURZ_NACH - HOUR)
  })

  /**
   * Der Vorfall selbst, als Test: Eine um 10:59 geschriebene Zeile trägt den
   * Stempel 10:00. Das alte rollende Fenster liess sie um 11:01 herausfallen.
   */
  it('haelt eine auf 10:00 gerundete Zeile um 11:01 noch im Fenster', () => {
    const gestempelt = Math.floor(KURZ_VOR / HOUR) * HOUR // 10:00
    const altesFenster = KURZ_NACH - HOUR // 10:01 — zu spaet
    expect(gestempelt < altesFenster).toBe(true)

    const neuesFenster = countingWindowStart(KURZ_NACH, HOUR, HOUR)
    expect(gestempelt >= neuesFenster).toBe(true)
  })

  it('beginnt bei Rundung eine volle Stunde vor dem laufenden Kasten', () => {
    expect(countingWindowStart(KURZ_NACH, HOUR, HOUR)).toBe(Date.UTC(2026, 8, 7, 10, 0, 0))
    expect(countingWindowStart(KURZ_VOR, HOUR, HOUR)).toBe(Date.UTC(2026, 8, 7, 9, 0, 0))
  })

  // Genau auf der vollen Stunde: Der Kasten beginnt hier, das Fenster eine
  // Stunde davor. Ohne diesen Fall bliebe offen, ob `floor` den Wechsel
  // eine Stunde zu frueh nimmt.
  it('rechnet auf der vollen Stunde richtig', () => {
    const voll = Date.UTC(2026, 8, 7, 11, 0, 0)
    expect(countingWindowStart(voll, HOUR, HOUR)).toBe(Date.UTC(2026, 8, 7, 10, 0, 0))
  })

  it('ist nie lockerer als das rollende Fenster', () => {
    for (let minute = 0; minute < 60; minute += 1) {
      const jetzt = Date.UTC(2026, 8, 7, 11, minute, 0)
      expect(countingWindowStart(jetzt, HOUR, HOUR)).toBeLessThanOrEqual(jetzt - HOUR)
    }
  })

  it('weist unbrauchbare Angaben ab, statt still zu rechnen', () => {
    expect(() => countingWindowStart(Number.NaN, HOUR)).toThrow(/Zählfenster/)
    expect(() => countingWindowStart(KURZ_NACH, 0)).toThrow(/Zählfenster/)
    expect(() => countingWindowStart(KURZ_NACH, -1)).toThrow(/Zählfenster/)
    expect(() => countingWindowStart(KURZ_NACH, HOUR, -1)).toThrow(/Speichergenauigkeit/)
    expect(() => countingWindowStart(KURZ_NACH, HOUR, Number.NaN)).toThrow(/Speichergenauigkeit/)
  })
})
