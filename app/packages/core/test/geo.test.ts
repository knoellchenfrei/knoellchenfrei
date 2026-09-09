import { describe, expect, it } from 'vitest'

import {
  boundsOf,
  distanceMetres,
  multiPolygonContains,
  polygonContains,
  withinBounds,
  type PolygonRings,
  distanceToPolygonMetres,
  type Position,
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
  it('nimmt einen Punkt im äußeren Ring an', () => {
    expect(polygonContains(withHole, [0.5, 0.5])).toBe(true)
  })

  it('weist einen Punkt in einem Loch ab', () => {
    expect(polygonContains(withHole, [2, 2])).toBe(false)
  })

  it('weist einen Punkt außerhalb ab', () => {
    expect(polygonContains(withHole, [5, 5])).toBe(false)
  })

  it('zählt einen Strahl durch einen geteilten Eckpunkt einmal', () => {
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

  it('trifft auf jeden Teil des Multipolygons zu', () => {
    const parts = [square(0), square(10)]
    expect(multiPolygonContains(parts, [10.5, 0.5])).toBe(true)
    expect(multiPolygonContains(parts, [5, 0.5])).toBe(false)
  })
})

describe('boundsOf / withinBounds', () => {
  it('umspannt jeden äußeren Ring', () => {
    const box = boundsOf([withHole])
    expect(box).toEqual({ minLon: 0, minLat: 0, maxLon: 4, maxLat: 4 })
    expect(withinBounds([2, 2], box)).toBe(true)
    expect(withinBounds([9, 2], box)).toBe(false)
  })
})

describe('distanceMetres', () => {
  it('misst eine bekannte Berliner Entfernung', () => {
    // Brandenburger Tor -> Alexanderplatz is roughly 2.7 km.
    const distance = distanceMetres([13.3777, 52.5163], [13.4132, 52.5219])
    expect(distance).toBeGreaterThan(2300)
    expect(distance).toBeLessThan(2800)
  })

  it('ist null für identische Punkte', () => {
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

describe('distanceToPolygonMetres', () => {
  // Ein 20 m × 10 m grosses Rechteck bei 49° Nord, Karlsruher Breite.
  const lat = 49.0094
  const dLon = 20 / (Math.cos((lat * Math.PI) / 180) * 111_320)
  const dLat = 10 / 110_540
  const rechteck: PolygonRings = [
    [
      [8.4, lat],
      [8.4 + dLon, lat],
      [8.4 + dLon, lat + dLat],
      [8.4, lat + dLat],
      [8.4, lat],
    ],
  ]

  it('ist null innen und misst aussen den Abstand zur Kante, nicht zum Stützpunkt', () => {
    expect(distanceToPolygonMetres([rechteck], [8.4 + dLon / 2, lat + dLat / 2])).toBe(0)
    // 15 m südlich der Mitte der Unterkante: 15, nicht die 18 zur Ecke.
    const suedlich: Position = [8.4 + dLon / 2, lat - 15 / 110_540]
    expect(distanceToPolygonMetres([rechteck], suedlich)).toBeCloseTo(15, 0)
    // 30 m westlich der Westkante.
    const westlich: Position = [8.4 - 30 / (Math.cos((lat * Math.PI) / 180) * 111_320), lat + dLat / 2]
    expect(distanceToPolygonMetres([rechteck], westlich)).toBeCloseTo(30, 0)
  })

  it('nimmt bei mehreren Polygonen das nächste', () => {
    const fern: PolygonRings = [
      [
        [8.5, lat],
        [8.5 + dLon, lat],
        [8.5 + dLon, lat + dLat],
        [8.5, lat + dLat],
        [8.5, lat],
      ],
    ]
    const punkt: Position = [8.4 + dLon / 2, lat - 5 / 110_540]
    expect(distanceToPolygonMetres([fern, rechteck], punkt)).toBeCloseTo(5, 0)
  })
})
