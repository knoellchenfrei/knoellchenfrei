import { describe, expect, it } from 'vitest'

import { CITIES } from '@knoellchenfrei/core'

import { arcgisQueryUrl, cityFiles, citySources, toGeoJsonAxes, wfsUrl } from '../src/sources.js'

/**
 * Zwei Regeln aus CLAUDE.md mit je einem Vorfall, bis zum 10. September in
 * diesem Paket ohne Test: `srsName` ist Pflicht (Frankfurt antwortet ohne
 * den Parameter stillschweigend in EPSG:25832), und die Achsenreihenfolge
 * steht in der Konfiguration, nie in einer Heuristik (Hamburg liefert
 * `[lat, lon]`, geraten landen die Gebiete im Golf von Guinea).
 */
describe('wfsUrl', () => {
  it('fragt jede WFS-Quelle jeder Stadt ausdrücklich in Grad', () => {
    // Schwerin bleibt aussen vor: Sein Dienst kann nur EPSG:25833 und GML,
    // und genau das prüft der Test darunter — die Ausnahme steht in der
    // Konfiguration (`srsName`), nicht als Vermutung.
    const quellen = CITIES.flatMap((city) => citySources(city.key)).filter(
      (quelle) => quelle.srsName === undefined,
    )
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

  // Schwerin ist die Ausnahme von der Grad-Regel, und zwar ausdrücklich: Der
  // Dienst antwortet auf jedes andere srsName mit `Invalid SRS`. Deshalb
  // steht 25833 in der Konfiguration, GML als Kodierung — und der Datenbau
  // prüft mit `assertUtm`, dass wirklich Meter ankommen. Die Regel bleibt:
  // srsName steht in jeder Anfrage, nie fehlt er.
  it('fragt Schwerin in EPSG:25833 und als GML an, weil der Dienst nichts anderes kann', () => {
    const quellen = citySources('schwerin')
    expect(quellen.length).toBe(4)
    for (const quelle of quellen) {
      const url = new URL(wfsUrl(quelle))
      expect(url.searchParams.get('srsName'), quelle.typeName).toBe('urn:ogc:def:crs:EPSG::25833')
      expect(url.searchParams.get('outputFormat'), quelle.typeName).toBe('application/gml+xml; version=3.2')
      expect(quelle.encoding).toBe('gml')
      expect(quelle.axisOrder).toBe('lon,lat')
    }
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
    for (const stadt of ['berlin', 'hamburg', 'frankfurt', 'muenchen', 'koeln', 'duesseldorf', 'karlsruhe', 'cottbus', 'bern']) {
      expect(citySources(stadt).length + cityFiles(stadt).length, stadt).toBeGreaterThan(0)
    }
  })
})

describe('arcgisQueryUrl', () => {
  it('fragt jede Datei-Quelle von Graz als GeoJSON in Grad und mit Messlatte', () => {
    const dateien = cityFiles('graz')
    expect(dateien.map((datei) => datei.key)).toEqual(['kurzparkzonen', 'parkzonen', 'districts'])
    for (const datei of dateien) {
      const url = new URL(datei.url)
      expect(url.searchParams.get('outSR'), datei.key).toBe('4326')
      expect(url.searchParams.get('f'), datei.key).toBe('geojson')
      expect(url.searchParams.get('where'), datei.key).toBe('1=1')
      expect(url.pathname.endsWith('/query'), datei.key).toBe(true)
      expect(datei.expectedFeatures ?? 0, datei.key).toBeGreaterThan(0)
    }
    expect(citySources('graz')).toEqual([])
  })

  it('hängt die Abfrage an eine Ebene, nicht an den Dienst', () => {
    expect(arcgisQueryUrl('https://example.test/FeatureServer/3')).toBe(
      'https://example.test/FeatureServer/3/query?where=1%3D1&outFields=*&f=geojson&outSR=4326',
    )
  })

  it('kennt für Städte ohne Dateien eine leere Liste, ohne zu werfen', () => {
    expect(cityFiles('berlin')).toEqual([])
    expect(cityFiles('koeln').map((datei) => datei.key)).toEqual(['automats'])
  })
})

/**
 * Bern ist der erste ArcGIS-**MapServer** (Innsbruck, Graz und Cottbus sind
 * FeatureServer). Die `query`-Schnittstelle ist dieselbe; dass die drei
 * Ebenen sie in Grad und als GeoJSON fragen, steht hier — der Dienst liegt
 * in LV95, und ohne `outSR` kämen Meter.
 */
describe('cityFiles für Bern', () => {
  it('fragt jede MapServer-Ebene Berns als GeoJSON in Grad und mit Erwartungswert', () => {
    const dateien = cityFiles('bern')
    expect(dateien.map((d) => d.key)).toEqual(['zones', 'districts', 'stadtteile'])
    for (const datei of dateien) {
      const url = new URL(datei.url)
      expect(url.hostname).toBe('map.bern.ch')
      expect(url.pathname).toMatch(/\/MapServer\/\d+\/query$/)
      expect(url.searchParams.get('f'), datei.key).toBe('geojson')
      expect(url.searchParams.get('outSR'), datei.key).toBe('4326')
      expect(url.searchParams.get('where'), datei.key).toBe('1=1')
      expect(datei.expectedFeatures, datei.key).toBeGreaterThan(0)
      expect(datei.file).toMatch(/\.json$/)
    }
    expect(dateien.map((d) => d.expectedFeatures)).toEqual([42, 32, 6])
    expect(citySources('bern')).toEqual([])
  })
})

describe('cityFiles für Innsbruck', () => {
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
})
