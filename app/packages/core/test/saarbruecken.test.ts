import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import { SAARBRUECKEN, cityAt, cityCountry, withinCity } from '../src/city.js'
import { holidaysFor } from '../src/holidays.js'
import {
  SaarbrueckenParseError,
  isSaarbrueckenLabelEmpty,
  parseSaarbrueckenStadtteil,
  parseSaarbrueckenZoneLabel,
  saarbrueckenZoneName,
  saarbrueckenZoneNote,
  type SaarbrueckenLabelProperties,
  type SaarbrueckenStadtteilLabelProperties,
  type SaarbrueckenZoneProperties,
} from '../src/saarbruecken.js'
import { chargeableAt, estimateCost, isChargeable, type ParkingZone } from '../src/tariff.js'

/**
 * Der echte Abruf vom 17. September 2026 — die Sachdaten aller 27 Flächen,
 * alle 30 Beschriftungspunkte und alle 20 Stadtteil-Beschriftungen.
 *
 * Wie bei den Städten davor: Die Fixture ist der Feed, nicht ein ausgedachtes
 * Beispiel. Bei 27 + 30 + 20 Zeilen passt alles hinein, und „jeder Wert liest
 * sich" prüft wirklich jeden Wert.
 */
interface Fixture {
  abgerufenAm: string
  anzahlFlaechen: number
  geometrieTypen: Record<string, number>
  ersterStuetzpunkt: [number, number]
  flaechen: SaarbrueckenZoneProperties[]
  beschriftungen: { properties: SaarbrueckenLabelProperties; punkt: [number, number] }[]
  stadtteile: { properties: SaarbrueckenStadtteilLabelProperties; punkt: [number, number] }[]
}

const FIXTURE = JSON.parse(
  readFileSync(fileURLToPath(new URL('./fixtures/saarbruecken-parkzonen-2026-09-17.json', import.meta.url)), 'utf8')
) as Fixture
const LABELS = FIXTURE.beschriftungen.map((row) => row.properties)
const NAMED = LABELS.filter((row) => !isSaarbrueckenLabelEmpty(row))

/** Die 27 Zonen, wie die Stadtseite „Übersicht über die Parkzonen" sie führt. */
const ZONEN_DER_STADTSEITE = [
  'A1', 'A2', 'A3',
  'B1', 'B2',
  'C1', 'C2',
  'D1', 'D2',
  'E1', 'E2',
  'F1', 'F2', 'F3',
  'H1', 'H2',
  'I1', 'I2',
  'J',
  'L1', 'L2', 'L3',
  'N1', 'N2', 'N3',
  'R',
  'U',
]

describe('die Fixture', () => {
  it('ist der ganze Abzug: 27 MultiPolygone ohne Attribut, 30 Beschriftungen, in Grad', () => {
    expect(FIXTURE.anzahlFlaechen).toBe(27)
    expect(FIXTURE.flaechen).toHaveLength(27)
    expect(FIXTURE.geometrieTypen).toEqual({ MultiPolygon: 27 })
    expect(FIXTURE.beschriftungen).toHaveLength(30)
    // `[lon, lat]`: Saarbrücken liegt bei 7° Ost, 49° Nord. In UTM stünde
    // hier 355.000 / 5.455.000, und die Karte sähe nur leer aus.
    const [lon, lat] = FIXTURE.ersterStuetzpunkt
    expect(lon).toBeGreaterThan(6.8)
    expect(lon).toBeLessThan(7.2)
    expect(lat).toBeGreaterThan(49.1)
    expect(lat).toBeLessThan(49.4)
  })

  // Das ist die Eigenheit, die alles bestimmt: Die Fläche weiß nichts.
  it('führt an jeder Fläche genau ein Feld, und das ist immer 0', () => {
    for (const row of FIXTURE.flaechen) {
      expect(Object.keys(row)).toEqual(['ID'])
      expect(row.ID).toBe(0)
    }
  })

  it('hat drei leere Beschriftungen, alle drei auf demselben Punkt', () => {
    const leer = FIXTURE.beschriftungen.filter((row) => isSaarbrueckenLabelEmpty(row.properties))
    expect(leer).toHaveLength(3)
    expect(new Set(leer.map((row) => row.punkt.join(','))).size).toBe(1)
    for (const row of leer) {
      expect(Object.values(row.properties).every((value) => value === null)).toBe(true)
    }
  })

  it('beschriftet genau die 27 Zonen der Stadtseite, jede einmal', () => {
    const texte = NAMED.map((row) => parseSaarbrueckenZoneLabel(row.Text ?? '')).sort()
    expect(texte).toEqual([...ZONEN_DER_STADTSEITE].sort())
    expect(new Set(texte).size).toBe(27)
  })

  // `G` steht in der Beschreibung des Datensatzes und sonst nirgends.
  it('kennt keine Zone G, obwohl die Beschreibung sie nennt', () => {
    expect(NAMED.some((row) => (row.Text ?? '').startsWith('G'))).toBe(false)
  })

  it('liest jede der 20 Stadtteil-Beschriftungen, mit vier Bezirken', () => {
    const teile = FIXTURE.stadtteile.map((row) => parseSaarbrueckenStadtteil(row.properties.PGIS_TXT ?? ''))
    expect(teile).toHaveLength(20)
    expect(new Set(teile.map((teil) => teil.number)).size).toBe(20)
    const bezirke = new Map<string, number>()
    for (const teil of teile) bezirke.set(teil.bezirk, (bezirke.get(teil.bezirk) ?? 0) + 1)
    // Die vier Bezirksseiten der Stadt: fünf, vier, vier und sieben Stadtteile.
    expect(bezirke.get('Mitte')).toBe(5)
    expect(bezirke.get('West')).toBe(4)
    expect(bezirke.get('Dudweiler')).toBe(4)
    expect(bezirke.get('Halberg')).toBe(7)
  })

  it('führt die Stadtteil-Koordinaten in Grad, obwohl daneben UTM-Werte stehen', () => {
    for (const row of FIXTURE.stadtteile) {
      const [lon, lat] = row.punkt
      expect(lon).toBeGreaterThan(6.8)
      expect(lon).toBeLessThan(7.2)
      expect(lat).toBeGreaterThan(49.1)
      expect(lat).toBeLessThan(49.4)
      // `PGIS_R`/`PGIS_H` sind Rechts- und Hochwert in Metern — wer sie für
      // die Lage nähme, läge um sechs Größenordnungen daneben.
      expect(row.properties.PGIS_R).toBeGreaterThan(300_000)
      expect(row.properties.PGIS_H).toBeGreaterThan(5_000_000)
    }
  })
})

describe('parseSaarbrueckenZoneLabel', () => {
  it('liest Buchstabe mit Ziffer und Buchstabe allein', () => {
    expect(parseSaarbrueckenZoneLabel('A1')).toBe('A1')
    expect(parseSaarbrueckenZoneLabel('F3')).toBe('F3')
    expect(parseSaarbrueckenZoneLabel('J')).toBe('J')
    expect(parseSaarbrueckenZoneLabel('U')).toBe('U')
  })

  it('vergibt Leerraum und Kleinschreibung', () => {
    expect(parseSaarbrueckenZoneLabel(' b2 ')).toBe('B2')
    expect(parseSaarbrueckenZoneLabel('\tr\n')).toBe('R')
  })

  it('nimmt G an, weil die Quelle den Buchstaben nennt', () => {
    expect(parseSaarbrueckenZoneLabel('G')).toBe('G')
    expect(parseSaarbrueckenZoneLabel('G1')).toBe('G1')
  })

  it('wirft bei Buchstaben, die die Stadt nicht vergibt', () => {
    for (const raw of ['K', 'K1', 'M', 'O', 'P', 'Q', 'S', 'T', 'V', 'Z']) {
      expect(() => parseSaarbrueckenZoneLabel(raw), raw).toThrow(SaarbrueckenParseError)
    }
  })

  it('wirft bei Null, zwei Ziffern, Leerem und Unfug', () => {
    for (const raw of ['', 'A0', 'A10', '1A', 'AA', 'A-1', 'A 1', 'Zone A', '-', 'null']) {
      expect(() => parseSaarbrueckenZoneLabel(raw), raw).toThrow(SaarbrueckenParseError)
    }
  })

  it('wirft bei überlanger Eingabe, ohne die Eingabe ganz zurückzugeben', () => {
    let caught: unknown
    try {
      parseSaarbrueckenZoneLabel('A'.repeat(500))
    } catch (error) {
      caught = error
    }
    expect(caught).toBeInstanceOf(SaarbrueckenParseError)
    expect((caught as SaarbrueckenParseError).raw.length).toBe(120)
  })
})

describe('parseSaarbrueckenStadtteil', () => {
  it('liest Nummer, Name und Bezirk', () => {
    expect(parseSaarbrueckenStadtteil('11 Alt-Saarbrücken')).toEqual({
      number: 11,
      name: 'Alt-Saarbrücken',
      bezirk: 'Mitte',
    })
    expect(parseSaarbrueckenStadtteil('48 Bübingen')).toEqual({ number: 48, name: 'Bübingen', bezirk: 'Halberg' })
    expect(parseSaarbrueckenStadtteil('31 Dudweiler')).toEqual({ number: 31, name: 'Dudweiler', bezirk: 'Dudweiler' })
    expect(parseSaarbrueckenStadtteil('24 Burbach')).toEqual({ number: 24, name: 'Burbach', bezirk: 'West' })
  })

  // Der Feed schreibt `St.Johann` ohne und `St. Arnual` mit Leerzeichen.
  it('schreibt St.Johann mit Leerzeichen und lässt St. Arnual, wie es ist', () => {
    expect(parseSaarbrueckenStadtteil('13 St.Johann').name).toBe('St. Johann')
    expect(parseSaarbrueckenStadtteil('16 St. Arnual').name).toBe('St. Arnual')
  })

  it('wirft, wenn Nummer und Name auf verschiedene Bezirke zeigen', () => {
    expect(() => parseSaarbrueckenStadtteil('21 Alt-Saarbrücken')).toThrow(SaarbrueckenParseError)
    expect(() => parseSaarbrueckenStadtteil('11 Burbach')).toThrow(/Bezirk West/)
  })

  it('wirft bei unbekanntem Stadtteil, fehlender Nummer und Unfug', () => {
    for (const raw of ['11 Saarlouis', '51 Bübingen', 'Bübingen', '48', '', '48  ', '4 Bübingen', '480 Bübingen']) {
      expect(() => parseSaarbrueckenStadtteil(raw), raw).toThrow(SaarbrueckenParseError)
    }
  })
})

describe('Name und Satz der Zone', () => {
  it('nennt die Zone wie die Stadtseite und die Gruppe nach dem Buchstaben', () => {
    expect(saarbrueckenZoneName('A1')).toBe('Parkzone A1')
    expect(saarbrueckenZoneNote('A1')).toContain('Bewohnerparkzone A ')
    expect(saarbrueckenZoneNote('U')).toContain('Bewohnerparkzone U ')
    expect(saarbrueckenZoneNote('U')).toContain('nennt der Datensatz nicht')
  })
})

/**
 * Eine Saarbrücker Zone im gemeinsamen Tarifmodell: `scheduleUnknown`, kein
 * Fenster, kein Betrag — und die Antwort ist „unbekannt", nicht „frei".
 */
describe('eine Saarbrücker Zone im gemeinsamen Tarifmodell', () => {
  const zone: ParkingZone = {
    id: 'saarbruecken-A1',
    name: 'Parkzone A1',
    land: 'SL',
    fee: { kind: 'unknown' },
    windows: [],
    scheduleUnknown: true,
  }

  it('sagt an einem Dienstag um zehn „unbekannt", nicht „frei"', () => {
    const status = chargeableAt(zone, Date.UTC(2026, 8, 15, 8))
    expect(status.unknown).toBe(true)
    expect(status.chargeable).toBe(false)
    expect(status.changesAt).toBeNull()
    expect(isChargeable(zone, Date.UTC(2026, 8, 15, 8))).toBe(false)
  })

  it('sagt es an Mariä Himmelfahrt genauso — ein Feiertag macht aus unbekannt kein frei', () => {
    expect(holidaysFor('SL', 2026).has('2026-08-15')).toBe(true)
    expect(chargeableAt(zone, Date.UTC(2026, 7, 15, 10)).unknown).toBe(true)
  })

  it('rechnet keine Kosten und nennt keinen Preis', () => {
    const estimate = estimateCost(zone, Date.UTC(2026, 8, 15, 8), 120)
    expect(estimate.priced).toBe(false)
    expect(estimate.chargedMinutes).toBe(0)
  })
})

describe('Saarbrücken als Stadt', () => {
  it('liegt in Deutschland, im Saarland, ohne Stadtfeiertage', () => {
    expect(SAARBRUECKEN.land).toBe('SL')
    expect(cityCountry(SAARBRUECKEN)).toBe('DE')
    expect(SAARBRUECKEN.holidays).toBeUndefined()
  })

  it('nimmt den St. Johanner Markt, Dudweiler und Bübingen an', () => {
    expect(cityAt(6.9965, 49.2335)).toBe(SAARBRUECKEN)
    expect(withinCity(SAARBRUECKEN, 7.0366, 49.2755)).toBe(true) // Dudweiler, Zone U
    expect(withinCity(SAARBRUECKEN, 7.0378, 49.1801)).toBe(true) // Bübingen, ohne eine einzige Zone
  })

  // Der Rahmen kommt aus dem Umriss der Stadtteile, nicht aus der Parkebene —
  // die Zonen reichen nur von 6,972° bis 7,041° Ost, die Stadt von 6,827° bis
  // 7,138°. Völklingen und St. Ingbert liegen im Rechteck, weil Saarbrücken
  // an beide grenzt; abgewiesen wird, was hinter dem Rechteck liegt.
  it('weist Neunkirchen, Lebach und Saargemünd ab', () => {
    expect(cityAt(7.1794, 49.3467)).toBeUndefined() // Neunkirchen, Rathaus
    expect(cityAt(6.9107, 49.4103)).toBeUndefined() // Lebach
    expect(cityAt(7.0682, 49.1104)).toBeUndefined() // Sarreguemines
  })

  it('umschliesst den ersten Stützpunkt des Abzugs und jede Beschriftung', () => {
    const { minLon, minLat, maxLon, maxLat } = SAARBRUECKEN.reportBounds
    for (const [lon, lat] of [FIXTURE.ersterStuetzpunkt, ...FIXTURE.beschriftungen.map((row) => row.punkt)]) {
      expect(lon).toBeGreaterThan(minLon)
      expect(lon).toBeLessThan(maxLon)
      expect(lat).toBeGreaterThan(minLat)
      expect(lat).toBeLessThan(maxLat)
    }
  })

  it('hält die Lizenz offen und verlangt bis dahin die Nennung', () => {
    expect(SAARBRUECKEN.attribution.licenceFamily).toBe('unklar')
    expect(SAARBRUECKEN.attribution.attributionRequired).toBe(true)
    expect(SAARBRUECKEN.licenceOpen).toContain('datenliz-de')
    expect(SAARBRUECKEN.attribution.datasetUrl).toMatch(/parkzonen_fl\.geojson$/)
    expect(SAARBRUECKEN.towedVehicles).toBeUndefined()
  })
})
