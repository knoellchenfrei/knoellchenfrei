import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import { KASSEL } from '../src/city.js'
import { multiPolygonContains, type Position } from '../src/geo.js'
import { holidaysFor } from '../src/holidays.js'
import {
  KasselParseError,
  esriRingsToPolygons,
  kasselZoneNote,
  parseKasselZoneName,
  type KasselIdentifyResult,
  type KasselZoneAttributes,
} from '../src/kassel.js'
import { chargeableAt, estimateCost, type ParkingZone } from '../src/tariff.js'

/**
 * Die echten Sachdaten der 29 Bezirke und ein vollständiges Ergebnis (VW7,
 * der eine Bezirk mit Loch), beide aus dem `identify` vom 17. September 2026.
 *
 * Wie bei den Städten davor: Fixtures sind der Feed, nicht ausgedachte
 * Beispiele. Ein Test, der eine Schreibweise prüft, die es nicht gibt, prüft
 * nichts.
 */
const read = <T>(name: string): T =>
  JSON.parse(readFileSync(fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url)), 'utf8')) as T

const BEZIRKE = read<KasselZoneAttributes[]>('kassel-bezirke-2026-09-17.json')
const VW7 = read<KasselIdentifyResult>('kassel-bezirk-vw7-2026-09-17.json')

describe('parseKasselZoneName', () => {
  it('liest jeden der 29 Namen des Abzugs, und die Zählung stimmt', () => {
    const kinds = new Map<string, number>()
    for (const row of BEZIRKE) {
      const name = parseKasselZoneName(row.Name)
      expect(name.key).toBe(row.Name)
      kinds.set(name.kind, (kinds.get(name.kind) ?? 0) + 1)
    }
    // 21 Quartierskürzel, 7 römische Nummern, einmal Zentrum — die Zahlen
    // aus dem Datenbau vom 17. September.
    expect(Object.fromEntries(kinds)).toEqual({ quartier: 21, nummer: 7, zentrum: 1 })
    expect(new Set(BEZIRKE.map((row) => row.Name)).size).toBe(29)
  })

  it('unterscheidet die drei Formen', () => {
    expect(parseKasselZoneName('BW1')).toEqual({ key: 'BW1', kind: 'quartier' })
    // Der Umlaut steht im Feed, nicht als Ersatzschreibung.
    expect(parseKasselZoneName('SÜ2')).toEqual({ key: 'SÜ2', kind: 'quartier' })
    expect(parseKasselZoneName('VIII')).toEqual({ key: 'VIII', kind: 'nummer' })
    expect(parseKasselZoneName('Zentrum')).toEqual({ key: 'Zentrum', kind: 'zentrum' })
  })

  it('verträgt Leerraum am Rand, aber nicht mitten im Namen', () => {
    expect(parseKasselZoneName('  WT1 ').key).toBe('WT1')
    expect(() => parseKasselZoneName('W T1')).toThrow(KasselParseError)
  })

  it('weist ab, was der Feed nicht schreibt, statt es zu raten', () => {
    for (const raw of ['', ' ', 'bw1', 'BW0', 'BW10', 'B1', 'BWX', 'IIII', 'XIII', 'zentrum', 'Zentrum II', '27', 'Bewohnerparkbezirk']) {
      expect(() => parseKasselZoneName(raw), raw).toThrow(KasselParseError)
    }
    expect(() => parseKasselZoneName(null)).toThrow(KasselParseError)
    expect(() => parseKasselZoneName(undefined)).toThrow(KasselParseError)
  })

  it('begrenzt die Eingabelänge, bevor ein Muster sie sieht', () => {
    expect(() => parseKasselZoneName('Zentrum'.padEnd(41, ' '))).toThrow(/länger als 40/)
    expect(parseKasselZoneName('Zentrum'.padEnd(40, ' ')).key).toBe('Zentrum')
  })

  it('wirft nur seine eigene Fehlerklasse, mit dem Rohwert darin', () => {
    try {
      parseKasselZoneName('Parkhaus')
      expect.unreachable()
    } catch (error) {
      expect(error).toBeInstanceOf(KasselParseError)
      expect((error as KasselParseError).raw).toBe('Parkhaus')
      expect((error as Error).name).toBe('KasselParseError')
    }
  })
})

describe('kasselZoneNote', () => {
  it('nennt die Form und verweist auf die Gebührenordnung, ohne einen Betrag zu behaupten', () => {
    expect(kasselZoneNote(parseKasselZoneName('BW1'))).toMatch(/^Bewohnerparkbezirk BW1 \(Quartierskürzel\) — Beträge nennt die Parkgebührenordnung/)
    expect(kasselZoneNote(parseKasselZoneName('IX'))).toMatch(/^Bewohnerparkbezirk IX — /)
    expect(kasselZoneNote(parseKasselZoneName('Zentrum'))).toMatch(/^Bewohnerparkbezirk Zentrum — /)
    for (const row of BEZIRKE) {
      expect(kasselZoneNote(parseKasselZoneName(row.Name))).not.toMatch(/€|Euro|\d,\d\d/)
    }
  })
})

describe('esriRingsToPolygons', () => {
  const rings = VW7.geometry?.rings ?? []

  it('macht aus VW7 ein Polygon mit Außenring und einem Loch', () => {
    expect(rings).toHaveLength(2)
    const polygons = esriRingsToPolygons(rings)
    expect(polygons).toHaveLength(1)
    expect(polygons[0]).toHaveLength(2)
    // Der Außenring ist der lange (215 Stützpunkte), das Loch der mit fünf.
    expect(polygons[0]?.[0]).toHaveLength(215)
    expect(polygons[0]?.[1]).toHaveLength(5)
    // Der erste Stützpunkt des Lochs liegt im Außenring — sonst wäre es keins.
    const hole = polygons[0]?.[1] ?? []
    expect(multiPolygonContains([[polygons[0]?.[0] ?? []]], hole[0] as Position)).toBe(true)
    // Und ein Punkt im Loch liegt nicht im Polygon.
    const [x0, y0] = hole[0] as Position
    const [x2, y2] = hole[2] as Position
    expect(multiPolygonContains(polygons, [(x0 + x2) / 2, (y0 + y2) / 2])).toBe(false)
  })

  it('liefert Grad, weil identify mit sr=4326 gefragt wurde', () => {
    for (const ring of rings) {
      for (const [lon, lat] of ring) {
        expect(lon).toBeGreaterThan(9.4)
        expect(lon).toBeLessThan(9.6)
        expect(lat).toBeGreaterThan(51.2)
        expect(lat).toBeLessThan(51.4)
      }
    }
  })

  it('trennt zwei Außenringe in zwei Polygone und ordnet jedes Loch seinem Ring zu', () => {
    // Uhrzeigersinn = außen, gegen den Uhrzeigersinn = Loch, wie Esri es zeichnet.
    const outerA: Position[] = [[0, 0], [0, 10], [10, 10], [10, 0], [0, 0]]
    const holeA: Position[] = [[2, 2], [4, 2], [4, 4], [2, 4], [2, 2]]
    const outerB: Position[] = [[20, 0], [20, 10], [30, 10], [30, 0], [20, 0]]
    const holeB: Position[] = [[22, 2], [24, 2], [24, 4], [22, 4], [22, 2]]
    const polygons = esriRingsToPolygons([holeB, outerA, outerB, holeA])
    expect(polygons).toEqual([
      [outerA, holeA],
      [outerB, holeB],
    ])
  })

  it('wirft bei offenen, zu kurzen und flächenlosen Ringen und bei Löchern ohne Außenring', () => {
    const outer: Position[] = [[0, 0], [0, 10], [10, 10], [10, 0], [0, 0]]
    expect(() => esriRingsToPolygons([[[0, 0], [0, 10], [10, 10], [10, 0]]])).toThrow(/nicht geschlossen/)
    expect(() => esriRingsToPolygons([[[0, 0], [0, 10], [0, 0]]])).toThrow(/weniger als vier/)
    expect(() => esriRingsToPolygons([[[0, 0], [0, 10], [0, 20], [0, 0]]])).toThrow(/ohne Fläche/)
    expect(() => esriRingsToPolygons([outer, [[50, 50], [60, 50], [60, 60], [50, 60], [50, 50]]])).toThrow(/Loch ohne/)
    expect(() => esriRingsToPolygons([])).toThrow(/kein Außenring/)
    expect(() => esriRingsToPolygons([[[2, 2], [4, 2], [4, 4], [2, 4], [2, 2]]])).toThrow(KasselParseError)
  })
})

describe('eine Kasseler Zone in der Tarifrechnung', () => {
  // So baut `build-data-kassel.ts` jede der 29 Zonen.
  const zone: ParkingZone = {
    id: 'BW1',
    name: 'BW1',
    land: KASSEL.land,
    fee: { kind: 'unknown' },
    windows: [],
    scheduleUnknown: true,
  }

  it('ist weder frei noch gebührenpflichtig, sondern unbekannt — zu jeder Stunde', () => {
    for (const at of [Date.UTC(2026, 8, 15, 10), Date.UTC(2026, 8, 20, 3), Date.UTC(2026, 11, 24, 12)]) {
      expect(chargeableAt(zone, at)).toEqual({ chargeable: false, uncertain: false, unknown: true, changesAt: null })
    }
    expect(estimateCost(zone, Date.UTC(2026, 8, 15, 10), 120).priced).toBe(false)
  })

  it('hängt am hessischen Kalender, wie Frankfurt', () => {
    expect(KASSEL.land).toBe('HE')
    expect(KASSEL.holidays).toBeUndefined()
    // Fronleichnam gilt in Hessen, der Reformationstag nicht.
    expect(holidaysFor('HE', 2026).has('2026-06-04')).toBe(true)
    expect(holidaysFor('HE', 2026).has('2026-10-31')).toBe(false)
  })
})
