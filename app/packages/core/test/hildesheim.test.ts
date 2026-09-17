import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import { HILDESHEIM, cityCountry, withinCity } from '../src/city.js'
import {
  HildesheimParseError,
  hildesheimZoneNote,
  parseHildesheimZoneName,
  type HildesheimZoneProperties,
} from '../src/hildesheim.js'
import { holidaysFor } from '../src/holidays.js'
import { chargeableAt, isChargeable, type ParkingZone } from '../src/tariff.js'

/**
 * Die echte Quelle, abgerufen am 17. September 2026 — alle sieben
 * Bewohnerparkzonen mit Sachdaten, wörtlich aus der WFS-Antwort. Bei sieben
 * Flächen ist der Auszug die ganze Sachdatentabelle; die Geometrie steht für
 * eine Fläche in der zweiten Fixture.
 */
interface Fixture {
  numberMatched: number
  features: { properties: HildesheimZoneProperties }[]
}

interface GeometryFixture {
  feature: { properties: HildesheimZoneProperties; geometry: { type: string; coordinates: number[][][] } }
}

function read<T>(name: string): T {
  return JSON.parse(readFileSync(fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url)), 'utf8')) as T
}

const FIXTURE = read<Fixture>('hildesheim-zonen-2026-09-17.json')
const ZONE_D = read<GeometryFixture>('hildesheim-zone-d-2026-09-17.json').feature
const ZONES = FIXTURE.features.map((feature) => feature.properties)

describe('parseHildesheimZoneName', () => {
  it('liest jeden der sieben Namen des Abzugs — A bis G, jeder genau einmal', () => {
    expect(FIXTURE.numberMatched).toBe(7)
    expect(ZONES).toHaveLength(7)
    const letters = ZONES.map((zone) => parseHildesheimZoneName(zone.Zone).letter)
    expect(letters.sort()).toEqual(['A', 'B', 'C', 'D', 'E', 'F', 'G'])
  })

  it('macht aus „Zone D" den Schlüssel D und den Namen der Stadt', () => {
    expect(parseHildesheimZoneName('Zone D')).toEqual({ letter: 'D', label: 'Bewohnerparkzone D' })
  })

  // `ID` ist die Zeilennummer der Shapedatei und läuft nicht mit den
  // Buchstaben: ID 1 ist Zone D, ID 7 ist Zone C. Wer sie als Schlüssel nähme,
  // hätte eine Nummer, die auf keinem Schild steht.
  it('nimmt den Buchstaben als Schlüssel, nicht die ID der Quelle', () => {
    const byId = new Map(ZONES.map((zone) => [zone.ID, parseHildesheimZoneName(zone.Zone).letter]))
    expect(byId.get('1')).toBe('D')
    expect(byId.get('7')).toBe('C')
  })

  it('verträgt Leerraum am Rand und mehrfachen Leerraum im Namen', () => {
    expect(parseHildesheimZoneName('  Zone   G ').letter).toBe('G')
    expect(parseHildesheimZoneName('Zone\tB').letter).toBe('B')
  })

  it('weist ab, was der Feed nicht schreibt, statt es zu raten', () => {
    for (const raw of [
      '',
      '   ',
      'Zone',
      'ZoneD',
      'Zone d',
      'Zone DD',
      'Zone D neu',
      'Zone 1',
      'Zone Ä',
      'D',
      'Bewohnerparkzone D',
      'Zone D_A.shp',
    ]) {
      expect(() => parseHildesheimZoneName(raw), JSON.stringify(raw)).toThrow(HildesheimParseError)
    }
  })

  it('begrenzt die Eingabelänge, bevor ein Muster sie sieht', () => {
    expect(() => parseHildesheimZoneName(`Zone ${'A'.repeat(40)}`)).toThrow(/länger als 40 Zeichen/)
  })

  // Die Zusicherung aus `fuzz.test.ts`, hier für die Fälle, die ein Feed am
  // ehesten liefert: ein fehlendes Feld als `undefined` oder `null`.
  it('wirft auch bei Nicht-Text nur die eigene Fehlerklasse, mit dem Rohwert darin', () => {
    expect(() => parseHildesheimZoneName(undefined)).toThrow(HildesheimParseError)
    expect(() => parseHildesheimZoneName(null)).toThrow(HildesheimParseError)
    try {
      parseHildesheimZoneName('Zone 9')
    } catch (error) {
      expect(error).toBeInstanceOf(HildesheimParseError)
      expect((error as HildesheimParseError).raw).toBe('Zone 9')
      expect((error as HildesheimParseError).message).toContain('"Zone 9"')
    }
  })
})

describe('hildesheimZoneNote', () => {
  it('nennt die Zone und verweist auf die Gebührenordnung, ohne einen Betrag zu behaupten', () => {
    const note = hildesheimZoneNote(parseHildesheimZoneName('Zone C'))
    expect(note).toContain('Bewohnerparkzone C')
    expect(note).toContain('Gebührenordnung')
    expect(note).not.toMatch(/\d+,\d\d|€|Euro|Uhr/)
  })
})

/**
 * Die Klasse-C-Zone, so wie `build-data-hildesheim.ts` sie schreibt: ohne
 * Fenster, ohne Betrag, mit `scheduleUnknown`. Die Zusicherung ist die aus
 * `laender.test.ts`, hier gegen eine echte Hildesheimer Zone und Niedersachsen.
 */
describe('eine Hildesheimer Zone im Tarifmodell', () => {
  const zone: ParkingZone = {
    id: 'D',
    name: 'Bewohnerparkzone D',
    land: HILDESHEIM.land,
    fee: { kind: 'unknown' },
    windows: [],
    scheduleUnknown: true,
  }

  it('antwortet an einem Werktag um 11 Uhr mit „unbekannt", nicht mit „frei"', () => {
    const at = Date.parse('2026-09-15T11:00:00+02:00')
    expect(chargeableAt(zone, at)).toEqual({ chargeable: false, uncertain: false, unknown: true, changesAt: null })
    expect(isChargeable(zone, at)).toBe(false)
  })

  it('antwortet am Reformationstag genauso — es gibt nichts, was sich ändern könnte', () => {
    const at = Date.parse('2026-10-31T11:00:00+01:00')
    expect(chargeableAt(zone, at).unknown).toBe(true)
    expect(chargeableAt(zone, at).changesAt).toBeNull()
  })
})

describe('Hildesheim als Stadt', () => {
  it('hängt am niedersächsischen Kalender und braucht keinen Stadtfeiertag', () => {
    expect(HILDESHEIM.land).toBe('NI')
    expect(cityCountry(HILDESHEIM)).toBe('DE')
    expect(HILDESHEIM.holidays).toBeUndefined()
    // § 2 Abs. 1 Buchst. h NFeiertagsG: der 31. Oktober als Reformationstag.
    expect(holidaysFor('NI', 2026).has('2026-10-31')).toBe(true)
  })

  it('umschließt Zone D — Außenring und Loch — mit dem Melderahmen', () => {
    expect(ZONE_D.geometry.type).toBe('Polygon')
    expect(ZONE_D.geometry.coordinates.map((ring) => ring.length)).toEqual([191, 33])
    for (const ring of ZONE_D.geometry.coordinates) {
      for (const [lon, lat] of ring) {
        expect(withinCity(HILDESHEIM, lon as number, lat as number)).toBe(true)
      }
    }
  })

  // Die Antwort auf `srsName=urn:ogc:def:crs:EPSG::4326` ist `[lon, lat]` —
  // anders als Hamburg und Rostock, und anders als die Recherche vom
  // 16. September für das GML derselben Ebene notierte. Gemessen an der
  // Fixture: Länge um 9,95, Breite um 52,15.
  it('liegt in der Fixture als [lon, lat] vor, nicht gedreht', () => {
    const [lon, lat] = ZONE_D.geometry.coordinates[0]?.[0] as [number, number]
    expect(lon).toBeGreaterThan(9.9)
    expect(lon).toBeLessThan(10)
    expect(lat).toBeGreaterThan(52.1)
    expect(lat).toBeLessThan(52.2)
  })

  it('führt die Lizenz als unklar, weil die Nutzungsbedingungen sich selbst widersprechen', () => {
    expect(HILDESHEIM.attribution.licenceFamily).toBe('unklar')
    expect(HILDESHEIM.attribution.attributionRequired).toBe(true)
    expect(HILDESHEIM.attribution.licenceUrl).toContain('geoportal.stadt-hildesheim.de')
    expect(HILDESHEIM.attribution.licenceUrl).toContain('nutzungsbedingungen')
    expect(HILDESHEIM.attribution.datasetUrl).toBe(
      'https://gdi.stadt-hildesheim.de/interface/wfs-ms/Bewohnerparkzonen'
    )
    expect(HILDESHEIM.attribution.source).toContain('Geodaten © Stadt Hildesheim')
    expect(HILDESHEIM.licenceOpen).toContain('kommerzielle')
    expect(HILDESHEIM.licenceOpen).toMatch(/Stand \d+\. \w+ 20\d\d\./)
  })
})
