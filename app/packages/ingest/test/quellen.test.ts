import { describe, expect, it } from 'vitest'

import { CITIES } from '@knoellchenfrei/core'

import { cityFiles, citySources, toGeoJsonAxes, wfsUrl } from '../src/sources.js'

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

/**
 * Wien holt drei Ebenen von **einer** Adresse; der Dienst antwortet auf
 * `application/json` in `[lon, lat]` und **ohne** `srsName` in EPSG:31256.
 * Die Achsenreihenfolge steht in der Konfiguration, nie in einer Heuristik.
 */
describe('die Wiener Quellen', () => {
  it('fragen alle drei Ebenen desselben GeoServers als JSON in lon,lat', () => {
    const quellen = citySources('wien')
    expect(quellen.map((q) => q.key)).toEqual(['zones', 'strips', 'districts'])
    for (const quelle of quellen) {
      expect(quelle.service).toBe('https://data.wien.gv.at/daten/geo')
      expect(quelle.typeName).toMatch(/^ogdwien:[A-Z]+OGD$/)
      expect(quelle.outputFormat).toBe('application/json')
      expect(quelle.axisOrder).toBe('lon,lat')
      expect(quelle.expectedFeatures).toBeGreaterThan(0)
    }
    expect(quellen.map((q) => q.expectedFeatures)).toEqual([81, 796, 23])
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
    expect(cityFiles('wien')).toEqual([])
    expect(cityFiles('bielefeld')).toEqual([])
    expect(cityFiles('koeln').map((datei) => datei.key)).toEqual(['automats'])
  })

  // Jede Stadt holt mindestens eine Ebene — über WFS oder als Datei.
  it('lässt keine Stadt ohne eine einzige Quelle', () => {
    for (const stadt of ['berlin', 'hamburg', 'frankfurt', 'muenchen', 'koeln', 'duesseldorf', 'karlsruhe', 'cottbus', 'wien']) {
      expect(citySources(stadt).length + cityFiles(stadt).length, stadt).toBeGreaterThan(0)
    }
  })
})
