import { describe, expect, it } from 'vitest'

import { distanceMetres, multiPolygonContains, polygonContains, type PolygonRings } from '@knoellchenfrei/core'

import { bufferLine } from '../src/linien-puffer.js'

/**
 * Das Band um eine Wiener Geschäftsstraße — gemessen, nicht angesehen.
 *
 * Die Bänder sind das, was in Wien eine Ortung überhaupt trifft: Ohne sie
 * gäbe es 796 Linien ohne Breite, und `zoneAt` fände in jeder
 * Geschäftsstraße die Bezirksfläche mit ihren Zeiten bis 22 Uhr.
 */
describe('bufferLine', () => {
  // Währinger Straße 121–123, der erste Streifen des Abzugs vom 17. September 2026.
  const WAEHRINGER: [number, number][] = [
    [16.3405543, 48.226841],
    [16.33986168, 48.22708848],
  ]

  it('macht aus zwei Punkten ein geschlossenes Viereck', () => {
    const ring = bufferLine(WAEHRINGER, 12)
    expect(ring).toHaveLength(5)
    expect(ring[0]).toEqual(ring[4])
  })

  it('enthält die Achse und Punkte bis zur halben Breite daneben, nicht darüber hinaus', () => {
    const ring = bufferLine(WAEHRINGER, 12)
    const polygon: PolygonRings = [ring]
    const [a, b] = WAEHRINGER as [[number, number], [number, number]]
    const mid: [number, number] = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]
    expect(polygonContains(polygon, mid)).toBe(true)
    // Senkrecht zur Achse: 10 m drin, 14 m draußen. Die Achse läuft etwa
    // West-Nord-West; ihre Normale zeigt nach Nord-Nord-Ost.
    const dx = b[0] - a[0]
    const dy = b[1] - a[1]
    const cos = Math.cos((mid[1] * Math.PI) / 180)
    const len = Math.hypot(dx * 111_320 * cos, dy * 110_540)
    const normal: [number, number] = [(-dy * 110_540) / len, (dx * 111_320 * cos) / len]
    const offset = (metres: number): [number, number] => [
      mid[0] + (normal[0] * metres) / (111_320 * cos),
      mid[1] + (normal[1] * metres) / 110_540,
    ]
    expect(polygonContains(polygon, offset(10))).toBe(true)
    expect(polygonContains(polygon, offset(-10))).toBe(true)
    expect(polygonContains(polygon, offset(14))).toBe(false)
    expect(polygonContains(polygon, offset(-14))).toBe(false)
  })

  it('hält die Bandbreite auch an einem Knick', () => {
    // Ein rechter Winkel: 100 m nach Osten, dann 100 m nach Norden.
    const cos = Math.cos((48.2 * Math.PI) / 180)
    const east = 100 / (111_320 * cos)
    const north = 100 / 110_540
    const ring = bufferLine(
      [
        [16.3, 48.2],
        [16.3 + east, 48.2],
        [16.3 + east, 48.2 + north],
      ],
      12,
    )
    expect(ring).toHaveLength(7)
    const polygon: PolygonRings = [ring]
    // Auf beiden Schenkeln drin, 20 m neben dem zweiten Schenkel draußen.
    expect(polygonContains(polygon, [16.3 + east / 2, 48.2])).toBe(true)
    expect(polygonContains(polygon, [16.3 + east, 48.2 + north / 2])).toBe(true)
    expect(polygonContains(polygon, [16.3 + east + (20 / (111_320 * cos)), 48.2 + north / 2])).toBe(false)
    // Die Gehrungsecke außen liegt 12·√2 ≈ 17 m vom Knick — nicht weiter.
    const corner = ring[1] as [number, number]
    expect(distanceMetres(corner, [16.3 + east, 48.2])).toBeGreaterThan(15)
    expect(distanceMetres(corner, [16.3 + east, 48.2])).toBeLessThan(19)
  })

  it('deckelt die Gehrung an einer spitzen Kehre statt sie ins Unendliche zu rechnen', () => {
    const cos = Math.cos((48.2 * Math.PI) / 180)
    const east = 100 / (111_320 * cos)
    const north = 5 / 110_540
    const ring = bufferLine(
      [
        [16.3, 48.2],
        [16.3 + east, 48.2],
        [16.3, 48.2 + north],
      ],
      12,
    )
    for (const point of ring) {
      expect(distanceMetres(point, [16.3 + east, 48.2])).toBeLessThan(12 * 4 + 1 + 100)
    }
    expect(multiPolygonContains([[ring]], [16.3 + east / 2, 48.2])).toBe(true)
  })

  it('übergeht doppelte Stützpunkte und wirft bei einem einzelnen', () => {
    const ring = bufferLine([...WAEHRINGER, WAEHRINGER[1] as [number, number]], 12)
    expect(ring).toHaveLength(5)
    expect(() => bufferLine([[16.3, 48.2]], 12)).toThrow(/keine Richtung/)
    expect(() => bufferLine([[16.3, 48.2], [16.3, 48.2]], 12)).toThrow(/keine Richtung/)
    expect(() => bufferLine(WAEHRINGER, 0)).toThrow(/keine Breite/)
  })
})
