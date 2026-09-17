import { describe, expect, it } from 'vitest'

import { loadZones, representativePoint, zoneAt, type ZoneFeature } from '../src/zones.js'
import type { ZoneProperties } from '../src/types.js'

/**
 * `representativePoint` für eine Fläche, die schmaler ist als das Raster.
 *
 * Der Fall aus Wien, 17. Bezirk (17. September 2026): ein Straßenzug von
 * rund 800 m Länge und 6 m Breite, schräg in seinem Rahmen. Das 13 × 13-
 * Raster über 617 × 496 m hat 50 m Schrittweite und trifft ihn nie; der alte
 * Rückfall auf den ersten Stützpunkt lag **auf** der Kante, und `zoneAt`
 * fand dort nichts. `flaechenpunkt.test.ts` hat das über den ganzen Bestand
 * gefunden; hier steht der Fall nachgebaut, damit er auch ohne die Wiener
 * Daten geprüft wird.
 */
const PROPERTIES: ZoneProperties = {
  zone: 'schmal',
  district: 'Test',
  rawHours: 'Mo-Fr 9-22 Uhr',
  rawFee: '',
  note: null,
  windows: [],
  fee: { kind: 'unknown' },
  unmodelledRules: [],
  sourceDefect: null,
  spaces: null,
  maxStay: null,
  maxStayShare: 0,
  maxStayValues: [],
  chargingPoints: 0,
  carsharing: 0,
}

/** Ein 6 m breites, 800 m langes Band, diagonal — Länge und Breite in Grad auf 48° Nord. */
function schraegesBand(): ZoneFeature {
  const cos = Math.cos((48.22 * Math.PI) / 180)
  const along = 800 / Math.SQRT2
  const across = 3 / Math.SQRT2
  const dx = (m: number): number => m / (111_320 * cos)
  const dy = (m: number): number => m / 110_540
  const ring: [number, number][] = [
    [16.3 + dx(-across), 48.22 + dy(across)],
    [16.3 + dx(along - across), 48.22 + dy(along + across)],
    [16.3 + dx(along + across), 48.22 + dy(along - across)],
    [16.3 + dx(across), 48.22 + dy(-across)],
    [16.3 + dx(-across), 48.22 + dy(across)],
  ]
  return { type: 'Feature', properties: PROPERTIES, geometry: { type: 'Polygon', coordinates: [ring] } } as ZoneFeature
}

describe('representativePoint bei einer Fläche schmaler als das Raster', () => {
  it('liefert einen Punkt, den zoneAt in derselben Fläche findet', () => {
    const geladen = loadZones({ features: [schraegesBand()] })
    const zone = geladen[0]
    expect(zone).toBeDefined()
    const punkt = representativePoint(zone!)
    expect(zoneAt(geladen, punkt)).toBe(zone)
  })
})
