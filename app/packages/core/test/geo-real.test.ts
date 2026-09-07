/**
 * Point-in-polygon against real zone geometry from the Berlin WFS.
 *
 * The synthetic tests in geo.test.ts prove the algorithm; this proves it works
 * on the actual multipolygons, in the actual coordinate order the service emits.
 */
import { describe, expect, it } from 'vitest'

import { boundsOf, multiPolygonContains, withinBounds, type PolygonRings, type Position } from '../src/geo.js'
import sample from './fixtures/zone-geometry-sample.json' with { type: 'json' }

interface ZoneFeature {
  properties: { zone: string; district: string }
  geometry: { type: string; coordinates: number[][][] | number[][][][] }
}

const ZONES = (sample as { features: ZoneFeature[] }).features.map((feature) => ({
  zone: feature.properties.zone,
  polygons: (feature.geometry.type === 'MultiPolygon'
    ? feature.geometry.coordinates
    : [feature.geometry.coordinates]) as unknown as PolygonRings[],
}))

function zoneAt(point: Position): string | null {
  for (const zone of ZONES) {
    if (!withinBounds(point, boundsOf(zone.polygons))) continue
    if (multiPolygonContains(zone.polygons, point)) return zone.zone
  }
  return null
}

describe('echte Zonengeometrie', () => {
  it('legt den Gendarmenmarkt in eine Zone in Mitte', () => {
    // [lon, lat] — GeoJSON order. Reversing these is the exact bug the 2012
    // codebase shipped, so an assertion on the real data is worth keeping.
    expect(zoneAt([13.3925, 52.5138])).toBe('2')
  })

  it('legt die Spandauer Altstadt in Zone 10', () => {
    expect(zoneAt([13.2005, 52.5355])).toBe('10')
  })

  it('liefert weit außerhalb des bewirtschafteten Gebiets nichts', () => {
    expect(zoneAt([13.65, 52.42])).toBeNull()
  })

  it('weist die vertauschte Koordinate ab und fängt damit einen Achsendreher', () => {
    expect(zoneAt([52.5138, 13.3925])).toBeNull()
  })
})
