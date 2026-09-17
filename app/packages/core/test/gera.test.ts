import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import { GERA } from '../src/city.js'
import { distanceToPolygonMetres, multiPolygonContains, type PolygonRings, type Position } from '../src/geo.js'
import {
  GeraParseError,
  geraZoneName,
  parseGeraAccessible,
  parseGeraInfostring,
  parseGeraZoneKey,
  type GeraAccessibleProperties,
  type GeraZoneProperties,
} from '../src/gera.js'
import { holidaysFor } from '../src/holidays.js'
import { chargeableAt, estimateCost, type ParkingZone } from '../src/tariff.js'

/**
 * Die echten Features des Abrufs vom 17. September 2026: alle zehn Flächen
 * und sechs der 138 Straßenlinien — darunter die Schillerstraße (Zone C),
 * deren Stützpunkt 4,8 m neben der Fläche liegt, die Neue Straße (H, 2,2 m)
 * und die Louis-Schlutter-Straße (K, auf der Kante) —, dazu alle zwölf
 * Behindertenparkplätze.
 *
 * Wie bei den Städten davor: Fixtures sind der Feed, nicht ausgedachte
 * Beispiele. Ein Test, der eine Schreibweise prüft, die es nicht gibt, prüft
 * nichts.
 */
const read = <T>(name: string): T =>
  JSON.parse(readFileSync(fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url)), 'utf8')) as T

interface Feature<P> {
  properties: P
  geometry: { type: string; coordinates: unknown }
}

const ZONES = read<{ features: Feature<GeraZoneProperties>[] }>('gera-anwohnerparken-2026-09-17.json').features
const ACCESSIBLE = read<{ features: Feature<GeraAccessibleProperties>[] }>(
  'gera-behindertenparkplaetze-2026-09-17.json'
).features

const AREAS = ZONES.filter((feature) => feature.geometry.type === 'Polygon')
const LINES = ZONES.filter((feature) => feature.geometry.type === 'LineString')

describe('parseGeraZoneKey', () => {
  it('liest jeden Buchstaben des Abzugs, und die Zählung stimmt', () => {
    const keys = ZONES.map((feature) => parseGeraZoneKey(feature.properties.anwohnerparkzone).key)
    // Zehn Flächen, zehn Schlüssel — je Buchstabe eine, plus die geteilte.
    expect([...new Set(AREAS.map((f) => parseGeraZoneKey(f.properties.anwohnerparkzone).key))].sort()).toEqual([
      'A', 'B', 'C', 'C/G', 'D', 'E', 'G', 'H', 'K', 'L',
    ])
    expect(keys).toHaveLength(16)
  })

  it('gibt einen Buchstaben als einen und die geteilte Fläche als zwei zurück', () => {
    expect(parseGeraZoneKey('B')).toEqual({ key: 'B', letters: ['B'] })
    expect(parseGeraZoneKey('C/G')).toEqual({ key: 'C/G', letters: ['C', 'G'] })
    expect(parseGeraZoneKey(' K ')).toEqual({ key: 'K', letters: ['K'] })
  })

  it('weist ab, was der Feed nicht schreibt, statt es zu raten', () => {
    for (const raw of ['', ' ', 'b', 'AB', 'C/C', 'G/C', 'C/', '/G', 'C-G', 'C / G', '1', 'Zone B', 'C/G/K']) {
      expect(() => parseGeraZoneKey(raw), raw).toThrow(GeraParseError)
    }
    expect(() => parseGeraZoneKey(null)).toThrow(GeraParseError)
    expect(() => parseGeraZoneKey(undefined)).toThrow(GeraParseError)
    expect(() => parseGeraZoneKey(7)).toThrow(GeraParseError)
  })

  it('begrenzt die Eingabelänge, bevor ein Muster sie sieht', () => {
    expect(() => parseGeraZoneKey('B'.padEnd(121, ' '))).toThrow(/länger als 120/)
    expect(parseGeraZoneKey('B'.padEnd(120, ' ')).key).toBe('B')
  })

  it('wirft nur seine eigene Fehlerklasse, mit dem Rohwert darin', () => {
    try {
      parseGeraZoneKey('Parkhaus')
      expect.unreachable()
    } catch (error) {
      expect(error).toBeInstanceOf(GeraParseError)
      expect((error as GeraParseError).raw).toBe('Parkhaus')
      expect((error as Error).name).toBe('GeraParseError')
      expect((error as Error).message).toContain('Geraer Feed')
    }
  })
})

describe('parseGeraInfostring', () => {
  it('liest jeden Infotext des Abzugs, und der Buchstabe passt zum Feld', () => {
    for (const feature of ZONES) {
      const info = parseGeraInfostring(feature.properties.infostring)
      expect(info.zone.key).toBe(parseGeraZoneKey(feature.properties.anwohnerparkzone).key)
      expect(info.name.length).toBeGreaterThan(0)
    }
  })

  it('trennt Buchstabe und Name am „ - " und behält die Schreibweise des Namens', () => {
    expect(parseGeraInfostring('L - Calvinstraße')).toEqual({ zone: { key: 'L', letters: ['L'] }, name: 'Calvinstraße' })
    expect(parseGeraInfostring('C/G - Zschochernstraße / Ziegelberg').name).toBe('Zschochernstraße / Ziegelberg')
    expect(parseGeraInfostring('C - Ziegelberg, Zschochern-, Bauvereinstraße').name).toBe(
      'Ziegelberg, Zschochern-, Bauvereinstraße'
    )
    expect(parseGeraInfostring('B - Innenstadt (Nord)').name).toBe('Innenstadt (Nord)')
    expect(parseGeraInfostring('H - Tivolistraße/Ernst-Toller-Straße').name).toBe('Tivolistraße/Ernst-Toller-Straße')
  })

  it('weist ab, was kein Infotext ist', () => {
    for (const raw of ['', 'Calvinstraße', 'L-Calvinstraße', 'L - ', ' - Calvinstraße', 'L - A - B', 'l - Calvinstraße', 'L - Calvin<straße>', 'L - Calvinstraße -', 'L - Calvinstraße,']) {
      expect(() => parseGeraInfostring(raw), raw).toThrow(GeraParseError)
    }
    expect(() => parseGeraInfostring(null)).toThrow(GeraParseError)
  })
})

describe('geraZoneName', () => {
  it('nennt Buchstabe und Gebiet, für die geteilte Fläche beide Buchstaben', () => {
    expect(geraZoneName(parseGeraZoneKey('B'), 'Innenstadt (Nord)')).toBe('Zone B — Innenstadt (Nord)')
    expect(geraZoneName(parseGeraZoneKey('C/G'), 'Zschochernstraße / Ziegelberg')).toBe(
      'Zone C/G — Zschochernstraße / Ziegelberg'
    )
  })
})

describe('parseGeraAccessible', () => {
  it('liest alle zwölf Parkplätze des Abzugs, 30 Plätze in Summe', () => {
    const places = ACCESSIBLE.map((feature) => parseGeraAccessible(feature.properties.infostring))
    expect(places).toHaveLength(12)
    expect(places.reduce((sum, place) => sum + place.spaces, 0)).toBe(30)
    expect(places.find((place) => place.label === 'Küchengartenallee')?.spaces).toBe(5)
  })

  it('unterscheidet Platz und Plätze und lässt die Klammer weg', () => {
    expect(parseGeraAccessible('Am Bärenweg (1 Platz)')).toEqual({ label: 'Am Bärenweg', spaces: 1 })
    expect(parseGeraAccessible('Schloßstraße/Puschkinplatz (2 Plätze)')).toEqual({ label: 'Schloßstraße/Puschkinplatz', spaces: 2 })
  })

  it('weist ab, was keine Zahl in der Klammer hat — und null Plätze', () => {
    for (const raw of ['', 'Am Bärenweg', 'Am Bärenweg (Platz)', 'Am Bärenweg (0 Plätze)', 'Am Bärenweg (1 Platz', '(1 Platz)', 'Am Bärenweg (1 Plaetze)']) {
      expect(() => parseGeraAccessible(raw), raw).toThrow(GeraParseError)
    }
  })
})

/**
 * Die Messung, die die Entscheidung trägt: Die Flächen decken die Linien.
 * Kein Band um die Straßen (Wien), keine Hülle — jede Linie liegt in oder
 * höchstens 4,8 m neben der Fläche ihres Buchstabens. Stünde hier eine
 * größere Zahl, wäre `build-data-gera.ts` an derselben Grenze abgebrochen.
 */
describe('Flächen und Linien derselben Ebene', () => {
  const rings = (feature: Feature<GeraZoneProperties>): PolygonRings => feature.geometry.coordinates as PolygonRings

  it('trägt je Zonenbuchstabe genau eine Fläche, alle zehn im Melderahmen', () => {
    const keys = AREAS.map((feature) => parseGeraZoneKey(feature.properties.anwohnerparkzone).key)
    expect(new Set(keys).size).toBe(AREAS.length)
    for (const feature of AREAS) {
      for (const [lon, lat] of rings(feature)[0] as Position[]) {
        expect(lon).toBeGreaterThan(GERA.reportBounds.minLon)
        expect(lon).toBeLessThan(GERA.reportBounds.maxLon)
        expect(lat).toBeGreaterThan(GERA.reportBounds.minLat)
        expect(lat).toBeLessThan(GERA.reportBounds.maxLat)
      }
    }
  })

  it('legt jede Linie in oder höchstens fünf Meter neben ihre Fläche', () => {
    let farthest = 0
    for (const line of LINES) {
      const key = parseGeraZoneKey(line.properties.anwohnerparkzone)
      const own = AREAS.filter((area) =>
        key.letters.some((letter) => parseGeraZoneKey(area.properties.anwohnerparkzone).letters.includes(letter))
      ).map(rings)
      expect(own.length, line.properties.infostring ?? '').toBeGreaterThan(0)
      for (const point of line.geometry.coordinates as Position[]) {
        farthest = Math.max(farthest, distanceToPolygonMetres(own, point))
      }
    }
    expect(farthest).toBeGreaterThan(4)
    expect(farthest).toBeLessThan(5)
  })

  it('hält den Code des Kartensystems fest: 62637 Fläche, 62638 Linie', () => {
    // Der Datenbau entscheidet an der Geometrie; die Fixture hält fest, dass
    // beide heute zusammenfallen — kippt das, sagt die Quelle etwas Neues.
    for (const feature of AREAS) expect(feature.properties.feature).toBe(62637)
    for (const feature of LINES) expect(feature.properties.feature).toBe(62638)
  })

  it('liegt mit der Innenstadt-Fläche B über dem Markt und nicht über dem Hauptbahnhof', () => {
    const b = AREAS.find((feature) => feature.properties.anwohnerparkzone === 'B')
    expect(b).toBeDefined()
    expect(multiPolygonContains([rings(b as Feature<GeraZoneProperties>)], [12.0812, 50.8795])).toBe(true)
    expect(multiPolygonContains([rings(b as Feature<GeraZoneProperties>)], [12.0723, 50.8815])).toBe(false)
  })
})

/**
 * Was die App mit einer Zone ohne Zeiten sagt: nichts Falsches. Sie ist
 * weder frei noch pflichtig, und eine Kostenschätzung gibt es nicht.
 */
describe('eine Geraer Zone im Tarifmodell', () => {
  const zone: ParkingZone = {
    id: 'B',
    name: 'Zone B — Innenstadt (Nord)',
    land: 'TH',
    fee: { kind: 'unknown' },
    windows: [],
    scheduleUnknown: true,
  }

  it('kassiert nach dem Modell nie, weil es keine Fenster hat', () => {
    // Dienstag, 15. September 2026, 10:30 Uhr — mitten in einer Stunde, in
    // der Berlin kassiert.
    expect(chargeableAt(zone, Date.UTC(2026, 8, 15, 8, 30)).chargeable).toBe(false)
  })

  it('nennt keinen Betrag', () => {
    expect(estimateCost(zone, Date.UTC(2026, 8, 15, 8, 30), 60).priced).toBe(false)
  })

  it('hängt am Thüringer Kalender mit Weltkindertag und Reformationstag', () => {
    const th = holidaysFor(zone.land, 2026)
    expect(th.has('2026-09-20')).toBe(true)
    expect(th.has('2026-10-31')).toBe(true)
    expect(th.has('2026-06-04')).toBe(false) // Fronleichnam gilt in Gera nicht
  })
})
