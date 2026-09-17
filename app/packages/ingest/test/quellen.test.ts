import { describe, expect, it } from 'vitest'

import { CITIES } from '@knoellchenfrei/core'

import { NPR_AREA_MANAGERS, NPR_TABLES, cityFiles, citySources, nprFiles, toGeoJsonAxes, wfsUrl } from '../src/sources.js'

/**
 * Zwei Regeln aus CLAUDE.md mit je einem Vorfall, bis zum 10. September in
 * diesem Paket ohne Test: `srsName` ist Pflicht (Frankfurt antwortet ohne
 * den Parameter stillschweigend in EPSG:25832), und die Achsenreihenfolge
 * steht in der Konfiguration, nie in einer Heuristik (Hamburg liefert
 * `[lat, lon]`, geraten landen die Gebiete im Golf von Guinea).
 */
describe('wfsUrl', () => {
  it('fragt jede WFS-Quelle jeder Stadt ausdrücklich in Grad', () => {
    const quellen = CITIES.flatMap((city) => citySources(city.key))
    expect(quellen.length).toBeGreaterThan(8)
    for (const quelle of quellen) {
      const url = new URL(wfsUrl(quelle))
      expect(url.searchParams.get('srsName'), quelle.typeName).toBe('urn:ogc:def:crs:EPSG::4326')
      expect(url.searchParams.get('request')).toBe('GetFeature')
      expect(url.searchParams.get('typeNames')).toBe(quelle.typeName)
    }
  })

  it('wirft bei einer unbekannten Stadt, statt auf Berlin zurückzufallen', () => {
    expect(() => citySources('bielefeld')).toThrow()
  })
})

describe('toGeoJsonAxes', () => {
  const polygon = [
    [
      [53.55, 9.99],
      [53.56, 9.99],
      [53.56, 10.0],
      [53.55, 9.99],
    ],
  ]

  it('dreht jedes Paar bis in die tiefste Ebene, wenn die Quelle lat,lon liefert', () => {
    expect(toGeoJsonAxes(polygon, 'lat,lon')).toEqual([
      [
        [9.99, 53.55],
        [9.99, 53.56],
        [10.0, 53.56],
        [9.99, 53.55],
      ],
    ])
    expect(toGeoJsonAxes([[[[53.55, 9.99, 7]]]], 'lat,lon')).toEqual([[[[9.99, 53.55, 7]]]])
  })

  it('lässt lon,lat unangetastet — auch dann, wenn die Zahlen wie Hamburg aussehen', () => {
    expect(toGeoJsonAxes(polygon, 'lon,lat')).toBe(polygon)
  })

  it('lässt Unfug durch, statt zu werfen — der Datenbau prüft die Grade danach', () => {
    expect(toGeoJsonAxes(null, 'lat,lon')).toBeNull()
    expect(toGeoJsonAxes(['a', 'b'], 'lat,lon')).toEqual(['a', 'b'])
  })
})

/**
 * Cottbus hat keinen WFS: Beide Ebenen kommen als ArcGIS-Abfrage über
 * `cityFiles`. Eine Stadt, die dort **und** in `citySources` leer wäre,
 * meldete beim Abruf Erfolg und holte nichts — dieselbe Falle wie ein
 * stiller Rückfall auf Berlin.
 */
describe('cityFiles', () => {
  it('holt Cottbus in Grad, als GeoJSON und mit einer Messlatte je Ebene', () => {
    const dateien = cityFiles('cottbus')
    expect(dateien.map((datei) => datei.key)).toEqual(['zones', 'automats'])
    for (const datei of dateien) {
      const url = new URL(datei.url)
      expect(url.hostname).toBe('datenportal.cottbus.de')
      expect(url.pathname).toMatch(/\/FeatureServer\/\d+\/query$/)
      expect(url.searchParams.get('outSR')).toBe('4326')
      expect(url.searchParams.get('f')).toBe('geojson')
      expect(url.searchParams.get('outFields')).toBe('*')
      expect(url.searchParams.get('where')).toBe('1=1')
      expect(datei.expectedFeatures).toBeGreaterThan(0)
      expect(datei.file).toMatch(/\.json$/)
    }
    expect(citySources('cottbus')).toEqual([])
  })

  it('gibt für Städte, die alles aus WFS bekommen, eine leere Liste', () => {
    expect(cityFiles('berlin')).toEqual([])
    expect(cityFiles('bielefeld')).toEqual([])
    expect(cityFiles('koeln').map((datei) => datei.key)).toEqual(['automats'])
  })

  // Jede Stadt holt mindestens eine Ebene — über WFS oder als Datei.
  it('lässt keine Stadt ohne eine einzige Quelle', () => {
    for (const city of CITIES) {
      expect(citySources(city.key).length + cityFiles(city.key).length, city.key).toBeGreaterThan(0)
    }
  })
})

/**
 * Die Niederlande holen acht Socrata-Tabellen je Stadt. Vier Fallen aus
 * `sources.ts`, jede hier festgehalten: alles in `$where`, `$limit` gesetzt,
 * `$order` für stabile Seiten, und der Filter auf die eigene Gemeinde — eine
 * Tabelle, die für Amsterdam abgerufen würde, sähe für den Datenbau wie
 * Utrecht aus.
 */
describe('nprFiles', () => {
  it('holt für jede niederländische Stadt alle acht Tabellen mit Gemeindecode, Limit und Ordnung', () => {
    for (const [stadt, code] of Object.entries(NPR_AREA_MANAGERS)) {
      const dateien = cityFiles(stadt)
      expect(dateien.map((datei) => datei.key), stadt).toEqual(NPR_TABLES.map((table) => table.key))
      for (const datei of dateien) {
        const url = new URL(datei.url)
        expect(url.hostname).toBe('opendata.rdw.nl')
        expect(url.searchParams.get('$where')).toBe(`areamanagerid='${code}'`)
        expect(url.searchParams.get('$limit')).toBe('50000')
        expect(url.searchParams.get('$order')).toBe(':id')
        expect(url.searchParams.has('areamanagerid')).toBe(false)
        expect(datei.paginate?.pageSize).toBe(50_000)
        expect(datei.expectedFeatures, datei.key).toBeGreaterThanOrEqual(0)
        expect(datei.file).toBe(`${datei.key}.json`)
      }
      // Die Stadtteile kommen als WFS von PDOK, gefiltert auf die Gemeinde.
      const wfs = citySources(stadt)
      expect(wfs.map((quelle) => quelle.key)).toEqual(['districts'])
      const url = new URL(wfsUrl(wfs[0] as (typeof wfs)[number]))
      expect(url.searchParams.get('filter')).toContain(`<Literal>GM${code.padStart(4, '0')}</Literal>`)
    }
  })

  it('weist einen Gemeindecode ab, der keiner ist, und eine Messlatte je Tabelle zu wenig', () => {
    expect(() => nprFiles('GM0344', [1, 1, 1, 1, 1, 1, 1, 1])).toThrow()
    expect(() => nprFiles('344', [1, 1, 1])).toThrow()
  })
})
