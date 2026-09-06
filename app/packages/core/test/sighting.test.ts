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
  it('treats a lone fresh report as unconfirmed, not fact', () => {
    const result = confidenceOf(sighting(), { now: NOW })
    expect(result.score).toBeCloseTo(0.5)
    expect(result.status).toBe('unconfirmed')
    expect(result.stars).toBe(2)
  })

  it('promotes to confirmed once two peers agree', () => {
    const result = confidenceOf(sighting({ confirmations: 2 }), { now: NOW })
    expect(result.score).toBeCloseTo(0.75)
    expect(result.status).toBe('confirmed')
    expect(result.stars).toBe(3)
  })

  it('promotes on one clean confirmation, since that is already two people', () => {
    const result = confidenceOf(sighting({ confirmations: 1 }), { now: NOW })
    expect(result.status).toBe('confirmed')
  })

  it('lets a single dispute pull a confirmed sighting back down', () => {
    const before = confidenceOf(sighting({ confirmations: 2 }), { now: NOW })
    const after = confidenceOf(sighting({ confirmations: 2, disputes: 1 }), { now: NOW })
    expect(before.status).toBe('confirmed')
    expect(after.status).toBe('unconfirmed')
  })

  it('keeps the frequent 2:1 case off the threshold boundary', () => {
    // Regression guard: with CONFIRMED_THRESHOLD at 0.6 this landed exactly on
    // the cutoff and the outcome hung on float comparison.
    const score = confidenceOf(sighting({ confirmations: 2, disputes: 1 }), { now: NOW }).score
    expect(Math.abs(score - CONFIRMED_THRESHOLD)).toBeGreaterThan(0.01)
  })

  it('halves the score after one half-life', () => {
    const fresh = confidenceOf(sighting({ confirmations: 2 }), { now: NOW })
    const aged = confidenceOf(sighting({ confirmations: 2 }), {
      now: NOW + DEFAULT_HALF_LIFE_MS,
    })
    expect(aged.score).toBeCloseTo(fresh.score / 2)
  })

  it('expires at the hard cutoff no matter how many confirmations', () => {
    const result = confidenceOf(sighting({ confirmations: 500 }), {
      now: NOW + DEFAULT_MAX_AGE_MS,
    })
    expect(result.score).toBe(0)
    expect(result.status).toBe('expired')
  })

  it('tolerates a small clock skew into the future', () => {
    const result = confidenceOf(sighting({ reportedAt: NOW + 30_000 }), { now: NOW })
    expect(result.ageMs).toBe(0)
    expect(result.status).not.toBe('expired')
  })

  it('rejects a timestamp far in the future instead of trusting it forever', () => {
    // Regression guard: clamping age to zero gave a far-future report a
    // near-perfect score permanently, immune to any number of disputes.
    const result = confidenceOf(
      sighting({ reportedAt: NOW + 9e12, confirmations: 500 }),
      { now: NOW }
    )
    expect(result.score).toBe(0)
    expect(result.status).toBe('expired')
  })

  it('keeps a far-future report out of the active list', () => {
    const evil = sighting({ id: 'evil', reportedAt: NOW + 9e12, confirmations: 500 })
    const real = sighting({ id: 'real', confirmations: 1 })
    const result = activeSightings([evil, real], { now: NOW })
    expect(result.map((entry) => entry.sighting.id)).toEqual(['real'])
  })
})

describe('activeSightings', () => {
  it('drops expired entries and orders the rest by score', () => {
    const stale = sighting({ id: 'stale', reportedAt: NOW - DEFAULT_MAX_AGE_MS })
    const weak = sighting({ id: 'weak', disputes: 2 })
    const strong = sighting({ id: 'strong', confirmations: 3 })

    const result = activeSightings([stale, weak, strong], { now: NOW })

    expect(result.map((entry) => entry.sighting.id)).toEqual(['strong', 'weak'])
  })
})
