import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import { CITIES } from '@knoellchenfrei/core'

import { buildZoneUnits, renderCoreFile, ROW_MAX_AREA_M2, UNIT_MIN_AREA_M2 } from '../src/zone-units.js'

/**
 * Die erzeugten Einheiten-Dateien gegen die ausgelieferten Daten — beide
 * Richtungen, wie `zone-keys-aktuell.test.ts` in `core`. Eine erzeugte
 * Datei, die niemand nachrechnet, läuft irgendwann auseinander, und hier
 * hiesse das: Der Worker ordnet Meldungen Einheiten zu, die die App nicht
 * kennt, und „diese Zone hat kein Muster" wäre von „diese Zone gibt es
 * nicht mehr" nicht zu unterscheiden.
 */
const DATEN = join(import.meta.dirname, '../../../apps/web/public/data')
const CORE = join(import.meta.dirname, '../../core/src/zone-units.generated.ts')
const API = join(import.meta.dirname, '../../../apps/api/src/zone-units.generated.json')

describe('die Einheiten der Langzeitmuster', () => {
  const output = buildZoneUnits(DATEN)

  it('sind eingecheckt, wie der Datenbau sie erzeugt — sonst: cd app/packages/ingest && npx tsx src/build-zone-units.ts', () => {
    expect(readFileSync(CORE, 'utf8')).toBe(renderCoreFile(output))
    expect(JSON.parse(readFileSync(API, 'utf8'))).toEqual(output.shapes)
  })

  it('kennen jede Stadt und jeden Zonenschlüssel', () => {
    expect(Object.keys(output.units).sort()).toEqual([...CITIES.map((city) => city.key)].sort())
    for (const [city, map] of Object.entries(output.units)) {
      expect(Object.keys(map).length, city).toBeGreaterThan(0)
      const shapeUnits = new Set(output.shapes[city]!.map((s) => s.unit))
      for (const unit of Object.values(map)) expect(shapeUnits.has(unit), `${city}: ${unit}`).toBe(true)
      expect(output.counts[city]).toBe(shapeUnits.size)
    }
  })

  it('schickt Karlsruhes Stellplatzreihen in den Bezirk, Berlins Zonen bleiben Zonen', () => {
    expect(new Set(Object.values(output.units.karlsruhe!)).size).toBe(13)
    expect(Object.values(output.units.karlsruhe!).every((u) => u.startsWith('bezirk:'))).toBe(true)
    expect(output.shapes.karlsruhe!.every((s) => s.kind === 'reihen')).toBe(true)
    expect(Object.entries(output.units.berlin!).every(([key, unit]) => key === unit)).toBe(true)
    // Hamburg: die kleinen Flächen ohne Nummer gehen in ihren Stadtteil, mit Bezirkspolygon.
    expect(output.shapes.hamburg!.some((s) => s.kind === 'bezirk')).toBe(true)
    expect(UNIT_MIN_AREA_M2).toBe(20_000)
  })

  // St. Gallen: 1.871 Reihen von 27 m² unter einem Schlüssel — zusammen
  // 6,8 ha, und die Summe allein hätte ein „Gebiet" mit 29 Punkten ergeben,
  // in dem nie eine Meldung liegt. Reihen bleiben Reihen: Fangradius, unter
  // dem Zonenschlüssel, als Raster von Kästchen statt 13.482 Stützpunkten.
  it('hält St. Gallens Reihen unter ihrem Schlüssel als Reihen, gerastert', () => {
    expect(output.units.stgallen).toEqual({ EBZ: 'EBZ', Parkuhr: 'Parkuhr' })
    const shapes = output.shapes.stgallen!
    expect(shapes.map((s) => [s.unit, s.kind])).toEqual([
      ['EBZ', 'reihen'],
      ['Parkuhr', 'reihen'],
    ])
    for (const shape of shapes) {
      expect(shape.polygons.length).toBeGreaterThan(100)
      expect(shape.polygons.length).toBeLessThan(600)
      for (const polygon of shape.polygons) expect(polygon[0]).toHaveLength(5)
    }
    expect(ROW_MAX_AREA_M2).toBe(500)
  })

  it('bleibt im Worker-Bündel klein und lässt keine Einheit ohne Geometrie', () => {
    const json = JSON.stringify(output.shapes)
    expect(json.length).toBeLessThan(1_000_000)
    for (const shapes of Object.values(output.shapes)) {
      for (const shape of shapes) {
        expect(shape.polygons.length, shape.unit).toBeGreaterThan(0)
        expect(shape.bounds[0]).toBeLessThan(shape.bounds[2])
        expect(shape.bounds[1]).toBeLessThan(shape.bounds[3])
      }
    }
  })
})
