import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import { buildZoneUnits, renderCoreFile, UNIT_MIN_AREA_M2 } from '../src/zone-units.js'

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
    expect(Object.keys(output.units).sort()).toEqual(['berlin', 'duesseldorf', 'frankfurt', 'hamburg', 'karlsruhe', 'koeln', 'muenchen'])
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
