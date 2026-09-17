import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import { ESSEN, withinCity } from '../src/city.js'
import { EssenParseError, parseEssenAreaName, type EssenZoneProperties } from '../src/essen.js'
import { holidaysFor } from '../src/holidays.js'
import { chargeableAt, isChargeable, type ParkingZone } from '../src/tariff.js'

/**
 * Die echte Quelle, abgerufen am 17. September 2026 — alle neun
 * Bewohnerparkbereiche mit Sachdaten und Geometrie, wörtlich aus der
 * DKAN-Datei. Bei neun Flächen ist der Auszug die ganze Datei.
 */
interface Fixture {
  anzahl: number
  features: { properties: EssenZoneProperties; geometry: { type: string; coordinates: number[][][] } }[]
}

const FIXTURE = JSON.parse(
  readFileSync(
    fileURLToPath(new URL('./fixtures/essen-bewohnerparkbereiche-2026-09-17.json', import.meta.url)),
    'utf8'
  )
) as Fixture

const AREAS = FIXTURE.features.map((feature) => feature.properties)

describe('parseEssenAreaName', () => {
  it('liest einen Namen ohne Ziffer', () => {
    expect(parseEssenAreaName('Ostviertel')).toEqual({ name: 'Ostviertel', numeral: null, label: 'Ostviertel' })
    expect(parseEssenAreaName('Innenstadt Süd')).toEqual({
      name: 'Innenstadt Süd',
      numeral: null,
      label: 'Innenstadt Süd',
    })
  })

  it('trennt die römische Ziffer in Klammern ab und setzt sie im Schlüssel wieder ein', () => {
    expect(parseEssenAreaName('Museum-Nord (II)')).toEqual({
      name: 'Museum-Nord',
      numeral: 'II',
      label: 'Museum-Nord (II)',
    })
    expect(parseEssenAreaName('Sternviertel (I)').numeral).toBe('I')
    expect(parseEssenAreaName('Museum-West (IV)').numeral).toBe('IV')
  })

  // Der Feed schreibt „Ostviertel 2" mit arabischer Ziffer im Namen — das ist
  // ein Teil des Namens, keine Nummer in Klammern.
  it('lässt eine arabische Ziffer im Namen stehen', () => {
    expect(parseEssenAreaName('Ostviertel 2')).toEqual({ name: 'Ostviertel 2', numeral: null, label: 'Ostviertel 2' })
  })

  it('glättet Leerraum, ohne den Namen zu verändern', () => {
    expect(parseEssenAreaName('  Museum-Süd   (V) ').label).toBe('Museum-Süd (V)')
    expect(parseEssenAreaName('Museum-Süd(V)').label).toBe('Museum-Süd (V)')
  })

  it('liest jeden der neun Namen der Fixture, mit neun verschiedenen Schlüsseln', () => {
    expect(FIXTURE.anzahl).toBe(9)
    expect(AREAS).toHaveLength(9)
    const labels = AREAS.map((area) => parseEssenAreaName(area.NameGebiet ?? '').label)
    expect(new Set(labels).size).toBe(9)
    expect(labels.sort()).toEqual(
      [
        'Ostviertel',
        'Ostviertel 2',
        'Innenstadt Nord',
        'Innenstadt Süd',
        'Sternviertel (I)',
        'Museum-Nord (II)',
        'Museum-Ost (III)',
        'Museum-West (IV)',
        'Museum-Süd (V)',
      ].sort()
    )
  })

  it('nennt fünf Flächen mit Ziffer I bis V, je genau einmal', () => {
    const numerals = AREAS.map((area) => parseEssenAreaName(area.NameGebiet ?? '').numeral).filter(
      (numeral) => numeral !== null
    )
    expect(numerals.sort()).toEqual(['I', 'II', 'III', 'IV', 'V'])
  })

  it('weist ab, was kein Gebietsname dieses Feeds ist', () => {
    for (const raw of [
      '',
      '   ',
      '(II)',
      'Museum-Nord (IIII)',
      'Museum-Nord (VX)',
      'Museum-Nord (2)',
      'Museum-Nord (ii)',
      'Museum-',
      '2 Ostviertel',
      'Museum-Nord (II) x',
      'Museum;Nord',
      'a'.repeat(81),
    ]) {
      expect(() => parseEssenAreaName(raw), JSON.stringify(raw)).toThrow(EssenParseError)
    }
  })

  // Die Zusicherung aus `fuzz.test.ts`, hier für den einen Fall, den ein
  // Feed am ehesten liefert: ein fehlendes Feld, das als `undefined` ankommt.
  it('wirft auch bei Nicht-Text nur die eigene Fehlerklasse', () => {
    expect(() => parseEssenAreaName(undefined as unknown as string)).toThrow(EssenParseError)
    expect(() => parseEssenAreaName(42 as unknown as string)).toThrow(EssenParseError)
  })
})

/**
 * Die Klasse-C-Zone, so wie `build-data-essen.ts` sie schreibt: ohne Fenster,
 * ohne Betrag, mit `scheduleUnknown`. Die Zusicherung ist die aus
 * `laender.test.ts`, hier gegen eine echte Essener Fläche und Essens Land.
 */
describe('eine Essener Zone im Tarifmodell', () => {
  const zone: ParkingZone = {
    id: 'Museum-Nord (II)',
    name: 'Bewohnerparkbereich Museum-Nord (II)',
    land: ESSEN.land,
    fee: { kind: 'unknown' },
    windows: [],
    scheduleUnknown: true,
  }

  it('antwortet an einem Werktag um 11 Uhr mit „unbekannt", nicht mit „frei"', () => {
    const at = Date.parse('2026-09-15T11:00:00+02:00')
    expect(chargeableAt(zone, at)).toEqual({ chargeable: false, uncertain: false, unknown: true, changesAt: null })
    expect(isChargeable(zone, at)).toBe(false)
  })

  it('antwortet am Sonntag genauso — es gibt nichts, was sich ändern könnte', () => {
    const at = Date.parse('2026-09-20T11:00:00+02:00')
    expect(chargeableAt(zone, at).unknown).toBe(true)
    expect(chargeableAt(zone, at).changesAt).toBeNull()
  })
})

describe('Essen als Stadt', () => {
  it('hängt am Kalender von Nordrhein-Westfalen und braucht keinen Stadtfeiertag', () => {
    expect(ESSEN.land).toBe('NW')
    expect(ESSEN.holidays).toBeUndefined()
    // Allerheiligen ist in NW Feiertag — der Kalender ist derselbe wie Kölns.
    expect(holidaysFor('NW', 2026).has('2026-11-01')).toBe(true)
  })

  it('umschließt jede der neun Flächen mit dem Melderahmen', () => {
    for (const feature of FIXTURE.features) {
      for (const ring of feature.geometry.coordinates) {
        for (const [lon, lat] of ring) {
          expect(withinCity(ESSEN, lon as number, lat as number), feature.properties.NameGebiet ?? '').toBe(true)
        }
      }
    }
  })

  it('führt DL-DE/Namensnennung mit Nennungspflicht, Quellenvermerk und der abgerufenen Datei', () => {
    expect(ESSEN.attribution.licenceFamily).toBe('dl-de-by')
    expect(ESSEN.attribution.attributionRequired).toBe(true)
    expect(ESSEN.attribution.licenceUrl).toBe('https://www.govdata.de/dl-de/by-2-0')
    expect(ESSEN.attribution.datasetUrl).toBe(
      'https://opendata.essen.de/sites/default/files/Bewohnerparkbereiche.geojson'
    )
    expect(ESSEN.attribution.source).toContain('Stadt Essen')
    expect(ESSEN.attribution.source).toContain('FB 66')
  })
})
