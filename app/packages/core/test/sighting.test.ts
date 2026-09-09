import { describe, expect, it } from 'vitest'

import {
  activeSightings,
  confidenceOf,
  CONFIRMED_THRESHOLD,
  DEFAULT_HALF_LIFE_MS,
  DEFAULT_MAX_AGE_MS,
  type Sighting,
} from '../src/sighting.js'

const NOW = Date.UTC(2026, 8, 6, 12, 0, 0)

function sighting(overrides: Partial<Sighting> = {}): Sighting {
  return {
    id: 's1',
    lat: 52.5163,
    lon: 13.3777,
    reportedAt: NOW,
    confirmations: 0,
    disputes: 0,
    ...overrides,
  }
}

describe('confidenceOf', () => {
  it('behandelt eine einzelne frische Meldung als unbestätigt, nicht als Tatsache', () => {
    const result = confidenceOf(sighting(), { now: NOW })
    expect(result.score).toBeCloseTo(0.5)
    expect(result.status).toBe('unconfirmed')
    expect(result.stars).toBe(2)
  })

  it('stuft auf bestätigt hoch, sobald zwei andere zustimmen', () => {
    const result = confidenceOf(sighting({ confirmations: 2 }), { now: NOW })
    expect(result.score).toBeCloseTo(0.75)
    expect(result.status).toBe('confirmed')
    expect(result.stars).toBe(3)
  })

  it('stuft schon bei einer sauberen Bestätigung hoch — das sind bereits zwei Leute', () => {
    const result = confidenceOf(sighting({ confirmations: 1 }), { now: NOW })
    expect(result.status).toBe('confirmed')
  })

  it('lässt einen einzigen Widerspruch eine bestätigte Sichtung wieder herunterziehen', () => {
    const before = confidenceOf(sighting({ confirmations: 2 }), { now: NOW })
    const after = confidenceOf(sighting({ confirmations: 2, disputes: 1 }), { now: NOW })
    expect(before.status).toBe('confirmed')
    expect(after.status).toBe('unconfirmed')
  })

  it('hält den häufigen Fall 2:1 von der Schwelle weg', () => {
    // Regression guard: with CONFIRMED_THRESHOLD at 0.6 this landed exactly on
    // the cutoff and the outcome hung on float comparison.
    const score = confidenceOf(sighting({ confirmations: 2, disputes: 1 }), { now: NOW }).score
    expect(Math.abs(score - CONFIRMED_THRESHOLD)).toBeGreaterThan(0.01)
  })

  it('halbiert den Wert nach einer Halbwertszeit', () => {
    const fresh = confidenceOf(sighting({ confirmations: 2 }), { now: NOW })
    const aged = confidenceOf(sighting({ confirmations: 2 }), {
      now: NOW + DEFAULT_HALF_LIFE_MS,
    })
    expect(aged.score).toBeCloseTo(fresh.score / 2)
  })

  it('verfällt an der harten Grenze, gleich wie viele Bestätigungen es gibt', () => {
    const result = confidenceOf(sighting({ confirmations: 500 }), {
      now: NOW + DEFAULT_MAX_AGE_MS,
    })
    expect(result.score).toBe(0)
    expect(result.status).toBe('expired')
  })

  it('duldet einen kleinen Uhrenversatz in die Zukunft', () => {
    const result = confidenceOf(sighting({ reportedAt: NOW + 30_000 }), { now: NOW })
    expect(result.ageMs).toBe(0)
    expect(result.status).not.toBe('expired')
  })

  it('weist einen Zeitstempel weit in der Zukunft ab, statt ihm ewig zu glauben', () => {
    // Regression guard: clamping age to zero gave a far-future report a
    // near-perfect score permanently, immune to any number of disputes.
    const result = confidenceOf(
      sighting({ reportedAt: NOW + 9e12, confirmations: 500 }),
      { now: NOW }
    )
    expect(result.score).toBe(0)
    expect(result.status).toBe('expired')
  })

  it('hält eine Meldung aus ferner Zukunft aus der aktiven Liste heraus', () => {
    const evil = sighting({ id: 'evil', reportedAt: NOW + 9e12, confirmations: 500 })
    const real = sighting({ id: 'real', confirmations: 1 })
    const result = activeSightings([evil, real], { now: NOW })
    expect(result.map((entry) => entry.sighting.id)).toEqual(['real'])
  })
})

describe('activeSightings', () => {
  it('wirft verfallene Einträge weg und ordnet den Rest nach Wert', () => {
    const stale = sighting({ id: 'stale', reportedAt: NOW - DEFAULT_MAX_AGE_MS })
    const weak = sighting({ id: 'weak', disputes: 2 })
    const strong = sighting({ id: 'strong', confirmations: 3 })

    const result = activeSightings([stale, weak, strong], { now: NOW })

    expect(result.map((entry) => entry.sighting.id)).toEqual(['strong', 'weak'])
  })
})

describe('Zustimmung altert nicht, Sichtbarkeit schon', () => {
  // Der Betreiber, 9. September: drei Meldungen mit „du: gesehen", alle
  // „unbestätigt". Nachgerechnet: eine Bestätigung hielt „bestätigt" drei
  // Minuten, zwei acht, drei Bestätigungen standen nach 27 Minuten bei 0,43.
  const base = { id: 's', lon: 13.4, lat: 52.5, disputes: 0 }
  const now = Date.UTC(2026, 8, 9, 14, 0)
  const at = (minutes: number, confirmations: number, disputes = 0) =>
    confidenceOf({ ...base, confirmations, disputes, reportedAt: now - minutes * 60_000 }, { now })

  it('bleibt nach einer sauberen Bestätigung bestätigt, solange die Meldung sichtbar ist', () => {
    expect(at(7, 1).status).toBe('confirmed')
    expect(at(27, 1).status).toBe('confirmed')
    expect(at(27, 3).status).toBe('confirmed')
  })

  it('zeigt das Alter weiter in den Sternen, nicht im Status', () => {
    expect(at(27, 1).stars).toBeLessThan(at(1, 1).stars)
    expect(at(27, 1).status).toBe(at(1, 1).status)
  })

  it('macht ein Widerspruch weiter unbestätigt, auch bei einer frischen Meldung', () => {
    expect(at(2, 1, 1).status).toBe('unconfirmed')
    expect(at(2, 2, 1).status).toBe('unconfirmed')
  })

  it('kennt kein Bestätigt mehr, sobald die Meldung unter die Sichtbarkeit fällt', () => {
    expect(at(80, 5).status).toBe('expired')
  })
})
