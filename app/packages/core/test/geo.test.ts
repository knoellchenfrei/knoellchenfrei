import { describe, expect, it } from 'vitest'

import {
  boundsOf,
  distanceMetres,
  multiPolygonContains,
  polygonContains,
  withinBounds,
  type PolygonRings,
} from '../src/geo.js'

/** A unit square with a square hole in the middle, in [lon, lat] order. */
const withHole: PolygonRings = [
  [
    [0, 0],
    [4, 0],
    [4, 4],
    [0, 4],
    [0, 0],
  ],
  [
    [1, 1],
    [3, 1],
    [3, 3],
    [1, 3],
    [1, 1],
  ],
]

describe('polygonContains', () => {
  it('accepts a point inside the outer ring', () => {
    expect(polygonContains(withHole, [0.5, 0.5])).toBe(true)
  })

  it('rejects a point inside a hole', () => {
    expect(polygonContains(withHole, [2, 2])).toBe(false)
  })

  it('rejects a point outside entirely', () => {
    expect(polygonContains(withHole, [5, 5])).toBe(false)
  })

  it('counts a ray through a shared vertex once', () => {
    // A ray east from [-1, 4] grazes the top edge; a naive test double-counts.
    expect(polygonContains(withHole, [-1, 4])).toBe(false)
  })
})

describe('multiPolygonContains', () => {
  const square = (offset: number): PolygonRings => [
    [
      [offset, 0],
      [offset + 1, 0],
      [offset + 1, 1],
      [offset, 1],
      [offset, 0],
    ],
  ]

  it('matches any part of the multipolygon', () => {
    const parts = [square(0), square(10)]
    expect(multiPolygonContains(parts, [10.5, 0.5])).toBe(true)
    expect(multiPolygonContains(parts, [5, 0.5])).toBe(false)
  })
})

describe('boundsOf / withinBounds', () => {
  it('spans every outer ring', () => {
    const box = boundsOf([withHole])
    expect(box).toEqual({ minLon: 0, minLat: 0, maxLon: 4, maxLat: 4 })
    expect(withinBounds([2, 2], box)).toBe(true)
    expect(withinBounds([9, 2], box)).toBe(false)
  })
})

describe('distanceMetres', () => {
  it('measures a known Berlin distance', () => {
    // Brandenburger Tor -> Alexanderplatz is roughly 2.7 km.
    const distance = distanceMetres([13.3777, 52.5163], [13.4132, 52.5219])
    expect(distance).toBeGreaterThan(2300)
    expect(distance).toBeLessThan(2800)
  })

  it('is zero for identical points', () => {
    expect(distanceMetres([13.4, 52.5], [13.4, 52.5])).toBe(0)
  })
})

describe('boundsOf an den Rändern', () => {
  // Ein Feature ohne Ringe kommt aus einem WFS, der eine leere Geometrie
  // liefert. `rings[0]` wäre dort `undefined`, und ein `for … of undefined`
  // wirft — mitten im Datenbau, für eine Zone, die ohnehin nichts abdeckt.
  it('überspringt ein Polygon ohne Ringe, statt daran zu scheitern', () => {
    const empty: PolygonRings = []
    const bounds = boundsOf([empty, withHole])
    expect(bounds).toEqual({ minLon: 0, minLat: 0, maxLon: 4, maxLat: 4 })
  })

  /**
   * Ohne eine einzige Position bleiben die Grenzen unendlich — und das ist die
   * richtige Antwort: `withinBounds` sagt dann für jeden Punkt „nein“, statt
   * eine Box um den Nullpunkt zu erfinden, in der halb Westafrika läge.
   */
  it('liefert für gar keine Position eine Box, die nichts enthält', () => {
    const bounds = boundsOf([])
    expect(bounds.minLon).toBe(Infinity)
    expect(bounds.maxLon).toBe(-Infinity)
    expect(withinBounds([13.4, 52.5], bounds)).toBe(false)
  })

  // Die Löcher zählen für die Grenzen nicht mit: Sie liegen definitionsgemäss
  // im äusseren Ring, und ein Loch, das darüber hinausragte, wäre kaputte
  // Geometrie und keine grössere Zone.
  it('misst nur den äusseren Ring', () => {
    expect(boundsOf([withHole])).toEqual({ minLon: 0, minLat: 0, maxLon: 4, maxLat: 4 })
  })
})
