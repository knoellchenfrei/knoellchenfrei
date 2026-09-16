import { describe, expect, it } from 'vitest'

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
    const quellen = [
      'berlin',
      'hamburg',
      'frankfurt',
      'muenchen',
      'koeln',
      'duesseldorf',
      'karlsruhe',
      'innsbruck',
    ].flatMap((stadt) => citySources(stadt))
    expect(quellen.length).toBeGreaterThan(7)
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
 * Innsbruck hat keinen WFS: Beide Ebenen sind ArcGIS-Abfragen als Datei.
 * Dieselbe Regel wie `srsName` bei WFS gilt für `outSR` — ohne den Parameter
 * antwortet der Stadtteil-Dienst in Web Mercator, und `f=geojson` ist die
 * einzige Form, die `[lon, lat]` liefert. Beides steht in der Adresse und
 * wird hier gelesen, nicht geglaubt.
 */
describe('cityFiles', () => {
  it('fragt jede ArcGIS-Ebene Innsbrucks als GeoJSON in Grad und mit Erwartungswert', () => {
    const dateien = cityFiles('innsbruck')
    expect(dateien.map((d) => d.key)).toEqual(['zones', 'districts'])
    for (const datei of dateien) {
      const url = new URL(datei.url)
      expect(url.searchParams.get('f'), datei.key).toBe('geojson')
      expect(url.searchParams.get('outSR'), datei.key).toBe('4326')
      expect(url.searchParams.get('where'), datei.key).toBe('1=1')
      expect(url.pathname.endsWith('/query'), datei.key).toBe(true)
      expect(datei.expectedFeatures, datei.key).toBeGreaterThan(0)
      expect(datei.file).toMatch(/\.json$/)
    }
  })

  it('ist für Städte ohne Dateien leer und wirft nicht', () => {
    expect(cityFiles('berlin')).toEqual([])
    expect(cityFiles('bielefeld')).toEqual([])
    expect(cityFiles('koeln').map((d) => d.key)).toEqual(['automats'])
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
