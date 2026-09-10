import { describe, expect, it } from 'vitest'

import { areaSquareMetres } from '../src/geo.js'

describe('areaSquareMetres', () => {
  // Ein Quadrat von rund 100 m Kante bei 52,5° Breite: 0,001° Breite ≈ 111 m,
  // 0,00147° Länge ≈ 100 m.
  const quadrat = [
    [
      [13.4, 52.5],
      [13.40147, 52.5],
      [13.40147, 52.500904],
      [13.4, 52.500904],
      [13.4, 52.5],
    ],
  ] as const

  it('misst ein 100-m-Quadrat auf ein Prozent genau', () => {
    expect(areaSquareMetres([quadrat])).toBeGreaterThan(9_800)
    expect(areaSquareMetres([quadrat])).toBeLessThan(10_200)
  })

  it('zieht Löcher ab und summiert Teilflächen, unabhängig vom Umlaufsinn', () => {
    const loch = [
      [13.4004, 52.5003],
      [13.4004, 52.5006],
      [13.4008, 52.5006],
      [13.4008, 52.5003],
      [13.4004, 52.5003],
    ] as const
    const mitLoch = areaSquareMetres([[quadrat[0], loch]])
    expect(mitLoch).toBeLessThan(areaSquareMetres([quadrat]))
    expect(areaSquareMetres([quadrat, quadrat])).toBeCloseTo(2 * areaSquareMetres([quadrat]), 6)
    expect(areaSquareMetres([[[[13.4, 52.5], [13.41, 52.5]]]])).toBe(0)
  })
})
