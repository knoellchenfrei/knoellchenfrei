import {
  multiPolygonContains,
  boundsOf,
  withinBounds,
  type BoundingBox,
  type PolygonRings,
  type Position,
} from '@knoellchenfrei/core'

import type { ZoneProperties } from './types.js'

export interface LoadedZone {
  properties: ZoneProperties
  polygons: PolygonRings[]
  bounds: BoundingBox
}

interface ZoneFeature {
  properties: ZoneProperties
  geometry: { type: 'Polygon' | 'MultiPolygon'; coordinates: number[][][] | number[][][][] }
}

export function loadZones(collection: { features: ZoneFeature[] }): LoadedZone[] {
  return collection.features.map((feature) => {
    const polygons =
      feature.geometry.type === 'MultiPolygon'
        ? (feature.geometry.coordinates as number[][][][])
        : [feature.geometry.coordinates as number[][][]]
    const rings = polygons as unknown as PolygonRings[]
    return { properties: feature.properties, polygons: rings, bounds: boundsOf(rings) }
  })
}

/**
 * The zone a coordinate falls in.
 *
 * Bounding boxes are checked first so the expensive ray cast runs only for the
 * handful of zones whose box the point is in — 103 zones with thousands of
 * vertices each are otherwise noticeable on every location update.
 */
export function zoneAt(zones: readonly LoadedZone[], point: Position): LoadedZone | null {
  for (const zone of zones) {
    if (!withinBounds(point, zone.bounds)) continue
    if (multiPolygonContains(zone.polygons, point)) return zone
  }
  return null
}

/**
 * A point that is actually inside the zone, for anchoring "park here" after a
 * search pick.
 *
 * The bounding-box centre was used before and is wrong for three zones: 11 and
 * 91 are L-shaped, so their box centre lies on an unmetered street, and 132
 * wraps around 133, whose territory the centre falls in. Parking from the panel
 * of zone 132 then recorded the car in zone 133. Candidates are tried from the
 * centre outwards on a grid; the first inside point nearest the centre wins.
 */
export function representativePoint(zone: LoadedZone): Position {
  const { minLon, minLat, maxLon, maxLat } = zone.bounds
  const centre: Position = [(minLon + maxLon) / 2, (minLat + maxLat) / 2]
  if (multiPolygonContains(zone.polygons, centre)) return centre

  const STEPS = 12
  let best: Position | null = null
  let bestDistance = Infinity
  for (let i = 0; i <= STEPS; i += 1) {
    for (let j = 0; j <= STEPS; j += 1) {
      const candidate: Position = [
        minLon + ((maxLon - minLon) * i) / STEPS,
        minLat + ((maxLat - minLat) * j) / STEPS,
      ]
      if (!multiPolygonContains(zone.polygons, candidate)) continue
      const distance = (candidate[0] - centre[0]) ** 2 + (candidate[1] - centre[1]) ** 2
      if (distance < bestDistance) {
        bestDistance = distance
        best = candidate
      }
    }
  }
  if (best !== null) return best
  // A sliver thinner than the grid: fall back to a vertex, which is at least on
  // the zone's edge rather than in a neighbour.
  return zone.polygons[0]?.[0]?.[0] ?? centre
}
