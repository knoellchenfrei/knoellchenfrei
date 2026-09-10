import { describe, expect, it } from 'vitest'

import { betaCdf, betaQuantile, lnGamma } from '../src/beta.js'

describe('die Betafunktion', () => {
  it('lnGamma trifft die Fakultäten', () => {
    expect(Math.exp(lnGamma(5))).toBeCloseTo(24, 8)
    expect(Math.exp(lnGamma(1))).toBeCloseTo(1, 10)
    expect(Math.exp(lnGamma(0.5))).toBeCloseTo(Math.sqrt(Math.PI), 8)
    expect(() => lnGamma(0)).toThrow(RangeError)
  })

  it('betaCdf trifft geschlossene Formen', () => {
    // Beta(1,1) ist gleichverteilt.
    expect(betaCdf(0.3, 1, 1)).toBeCloseTo(0.3, 10)
    // Beta(2,3): F(x) = 6x² − 8x³ + 3x⁴.
    expect(betaCdf(0.25, 2, 3)).toBeCloseTo(0.26171875, 10)
    // Beta(0.5,0.5), die Arkussinus-Verteilung, hat ihren Median bei 0,5.
    expect(betaCdf(0.5, 0.5, 0.5)).toBeCloseTo(0.5, 10)
    // Symmetrie.
    expect(betaCdf(0.2, 2, 2)).toBeCloseTo(1 - betaCdf(0.8, 2, 2), 10)
    expect(betaCdf(0, 2, 3)).toBe(0)
    expect(betaCdf(1, 2, 3)).toBe(1)
    expect(() => betaCdf(0.5, 0, 1)).toThrow(RangeError)
  })

  it('betaQuantile kehrt betaCdf um', () => {
    expect(betaQuantile(0.26171875, 2, 3)).toBeCloseTo(0.25, 8)
    expect(betaQuantile(0.5, 2, 2)).toBeCloseTo(0.5, 8)
    // Beta(2,5): Median 0,26445 (Tabellenwert).
    expect(betaQuantile(0.5, 2, 5)).toBeCloseTo(0.26445, 4)
    for (const [a, b] of [
      [0.3, 7],
      [6.19, 15.81],
      [0.06, 22],
    ] as const) {
      for (const p of [0.05, 0.2, 0.5, 0.8, 0.95]) {
        expect(betaCdf(betaQuantile(p, a, b), a, b)).toBeCloseTo(p, 6)
      }
    }
    expect(betaQuantile(0, 2, 3)).toBe(0)
    expect(betaQuantile(1, 2, 3)).toBe(1)
    expect(() => betaQuantile(1.5, 2, 3)).toThrow(RangeError)
  })
})
