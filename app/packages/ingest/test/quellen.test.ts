import { describe, expect, it } from 'vitest'

import { CITIES, KASSEL } from '@knoellchenfrei/core'

import { NPR_AREA_MANAGERS, NPR_TABLES, arcgisIdentifyUrl, arcgisQueryUrl, cityFiles, citySources, nprFiles, toGeoJsonAxes, wfsUrl } from '../src/sources.js'

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

  /**
   * Zürichs QGIS Server antwortet auf `wfsUrl` (2.0.0, URN-Form, JSON) mit
   * HTTP 500 — deshalb vier fertige 1.1.0-Adressen mit `SRSNAME=EPSG:4326`.
   * Geprüft wird genau das, was den 500 auslöste, damit niemand die
   * Adressen „vereinheitlicht" und den Abruf still verliert.
   */
  it('holt Zürich als WFS 1.1.0 mit EPSG:4326 in Kurzform und GeoJSON, mit Messlatte je Ebene', () => {
    const dateien = cityFiles('zuerich')
    expect(dateien.map((datei) => datei.key)).toEqual(['zones', 'meters', 'spaces', 'districts'])
    for (const datei of dateien) {
      const url = new URL(datei.url)
      expect(url.hostname).toBe('www.ogd.stadt-zuerich.ch')
      expect(url.pathname).toMatch(/^\/wfs\/geoportal\/[A-Za-z_]+$/)
      expect(url.searchParams.get('VERSION')).toBe('1.1.0')
      expect(url.searchParams.get('REQUEST')).toBe('GetFeature')
      expect(url.searchParams.get('SRSNAME')).toBe('EPSG:4326')
      expect(url.searchParams.get('OUTPUTFORMAT')).toBe('application/vnd.geo+json')
      expect(url.searchParams.get('TYPENAME')?.length ?? 0).toBeGreaterThan(0)
      expect(datei.expectedFeatures).toBeGreaterThan(0)
      expect(datei.file).toMatch(/\.json$/)
    }
    expect(citySources('zuerich')).toEqual([])
  })

  it('holt Zürich als WFS 1.1.0 mit EPSG:4326 in Kurzform und GeoJSON, mit Messlatte je Ebene', () => {
    const dateien = cityFiles('zuerich')
    expect(dateien.map((datei) => datei.key)).toEqual(['zones', 'meters', 'spaces', 'districts'])
    for (const datei of dateien) {
      const url = new URL(datei.url)
      expect(url.hostname).toBe('www.ogd.stadt-zuerich.ch')
      expect(url.pathname).toMatch(/^\/wfs\/geoportal\/[A-Za-z_]+$/)
      expect(url.searchParams.get('VERSION')).toBe('1.1.0')
      expect(url.searchParams.get('REQUEST')).toBe('GetFeature')
      expect(url.searchParams.get('SRSNAME')).toBe('EPSG:4326')
      expect(url.searchParams.get('OUTPUTFORMAT')).toBe('application/vnd.geo+json')
      expect(url.searchParams.get('TYPENAME')?.length ?? 0).toBeGreaterThan(0)
      expect(datei.expectedFeatures).toBeGreaterThan(0)
      expect(datei.file).toMatch(/\.json$/)
    }
    expect(citySources('zuerich')).toEqual([])
  })

  /**
   * Essen hat weder WFS noch FeatureServer: drei fertige GeoJSON-Dateien aus
   * dem DKAN-Portal. Ohne `expectedFeatures` sähe eine Datei mit null
   * Features (etwa nach einem Umzug des Portals, der eine HTML-Seite mit 200
   * liefert) wie ein Erfolg aus — deshalb je Datei eine Messlatte.
   */
  it('holt Essen als drei GeoJSON-Dateien vom Open-Data-Portal, mit Messlatte je Datei', () => {
    const dateien = cityFiles('essen')
    expect(dateien.map((datei) => datei.key)).toEqual(['zones', 'districts', 'lowEmissionZone'])
    for (const datei of dateien) {
      const url = new URL(datei.url)
      expect(url.hostname).toBe('opendata.essen.de')
      expect(url.pathname).toMatch(/^\/sites\/default\/files\/[A-Za-z0-9_]+\.geojson$/)
      expect(datei.expectedFeatures, datei.key).toBeGreaterThan(0)
      expect(datei.file).toMatch(/\.json$/)
    }
    expect(dateien.find((datei) => datei.key === 'zones')?.expectedFeatures).toBe(9)
    expect(citySources('essen')).toEqual([])
  })

  /**
   * Essen hat weder WFS noch FeatureServer: drei fertige GeoJSON-Dateien aus
   * dem DKAN-Portal. Ohne `expectedFeatures` sähe eine Datei mit null
   * Features (etwa nach einem Umzug des Portals, der eine HTML-Seite mit 200
   * liefert) wie ein Erfolg aus — deshalb je Datei eine Messlatte.
   */
  it('holt Essen als drei GeoJSON-Dateien vom Open-Data-Portal, mit Messlatte je Datei', () => {
    const dateien = cityFiles('essen')
    expect(dateien.map((datei) => datei.key)).toEqual(['zones', 'districts', 'lowEmissionZone'])
    for (const datei of dateien) {
      const url = new URL(datei.url)
      expect(url.hostname).toBe('opendata.essen.de')
      expect(url.pathname).toMatch(/^\/sites\/default\/files\/[A-Za-z0-9_]+\.geojson$/)
      expect(datei.expectedFeatures, datei.key).toBeGreaterThan(0)
      expect(datei.file).toMatch(/\.json$/)
    }
    expect(dateien.find((datei) => datei.key === 'zones')?.expectedFeatures).toBe(9)
    expect(citySources('essen')).toEqual([])
  })

  it('gibt für Städte, die alles aus WFS bekommen, eine leere Liste', () => {
    expect(cityFiles('berlin')).toEqual([])
    expect(cityFiles('bielefeld')).toEqual([])
    expect(cityFiles('koeln').map((datei) => datei.key)).toEqual(['automats'])
  })

  // Jede Stadt holt mindestens eine Ebene — über WFS oder als Datei.
  it('lässt keine Stadt ohne eine einzige Quelle', () => {
    for (const stadt of ['berlin', 'hamburg', 'frankfurt', 'muenchen', 'koeln', 'duesseldorf', 'karlsruhe', 'cottbus', 'zuerich', 'essen']) {
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

describe('cityFiles für Krakau', () => {
  // Vier Ebenen, alle ArcGIS, alle in Grad — und die eine mit `ś` im
  // Dienstnamen prozentkodiert, damit `new URL` sie so lässt, wie der
  // Dienst sie erwartet.
  it('fragt jede der vier Ebenen als GeoJSON in Grad und mit Erwartungswert', () => {
    const dateien = cityFiles('krakau')
    expect(dateien.map((d) => d.key)).toEqual(['zones', 'extension', 'sectors', 'districts'])
    for (const datei of dateien) {
      const url = new URL(datei.url)
      expect(url.host).toBe('services-eu1.arcgis.com')
      expect(url.searchParams.get('f'), datei.key).toBe('geojson')
      expect(url.searchParams.get('outSR'), datei.key).toBe('4326')
      expect(url.searchParams.get('where'), datei.key).toBe('1=1')
      expect(url.pathname.endsWith('/query'), datei.key).toBe(true)
      expect(datei.expectedFeatures, datei.key).toBeGreaterThan(0)
      expect(datei.file).toMatch(/\.json$/)
    }
    expect(dateien.find((d) => d.key === 'sectors')?.url).toContain('Sektory_SPP_wy%C5%9Bwietlenie/FeatureServer/37/')
    expect(dateien.find((d) => d.key === 'zones')?.expectedFeatures).toBe(23)
  })

  it('kennt Krakau auch in citySources — mit leerer WFS-Liste, ohne zu werfen', () => {
    expect(citySources('krakau')).toEqual([])
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

describe('cityFiles für Genf', () => {
  it('fragt jede SITG-Ebene als GeoJSON in Grad, und nur die Linien seitenweise', () => {
    const dateien = cityFiles('genf')
    expect(dateien.map((d) => d.key)).toEqual(['zones', 'lines', 'accessible', 'districts'])
    for (const datei of dateien) {
      const url = new URL(datei.url)
      expect(url.hostname, datei.key).toBe('vector.sitg.ge.ch')
      expect(url.searchParams.get('f'), datei.key).toBe('geojson')
      expect(url.searchParams.get('outSR'), datei.key).toBe('4326')
      expect(url.searchParams.get('where'), datei.key).toBe('1=1')
      expect(url.pathname.endsWith('/query'), datei.key).toBe(true)
      expect(datei.expectedFeatures, datei.key).toBeGreaterThan(0)
      expect(datei.file).toMatch(/\.json$/)
      // `paged` nur da, wo die Ebene größer als maxRecordCount (4.000) ist:
      // Eine Seite mehr wäre harmlos, eine Seite weniger eine kleinere Stadt.
      expect(datei.paged, datei.key).toBe((datei.expectedFeatures ?? 0) > 4000 ? true : undefined)
    }
    expect(citySources('genf')).toEqual([])
  })
})

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

describe('cityFiles für Krakau', () => {
  // Vier Ebenen, alle ArcGIS, alle in Grad — und die eine mit `ś` im
  // Dienstnamen prozentkodiert, damit `new URL` sie so lässt, wie der
  // Dienst sie erwartet.
  it('fragt jede der vier Ebenen als GeoJSON in Grad und mit Erwartungswert', () => {
    const dateien = cityFiles('krakau')
    expect(dateien.map((d) => d.key)).toEqual(['zones', 'extension', 'sectors', 'districts'])
    for (const datei of dateien) {
      const url = new URL(datei.url)
      expect(url.host).toBe('services-eu1.arcgis.com')
      expect(url.searchParams.get('f'), datei.key).toBe('geojson')
      expect(url.searchParams.get('outSR'), datei.key).toBe('4326')
      expect(url.searchParams.get('where'), datei.key).toBe('1=1')
      expect(url.pathname.endsWith('/query'), datei.key).toBe(true)
      expect(datei.expectedFeatures, datei.key).toBeGreaterThan(0)
      expect(datei.file).toMatch(/\.json$/)
    }
    expect(dateien.find((d) => d.key === 'sectors')?.url).toContain('Sektory_SPP_wy%C5%9Bwietlenie/FeatureServer/37/')
    expect(dateien.find((d) => d.key === 'zones')?.expectedFeatures).toBe(23)
  })

  it('kennt Krakau auch in citySources — mit leerer WFS-Liste, ohne zu werfen', () => {
    expect(citySources('krakau')).toEqual([])
  })
})

describe('cityFiles für Kassel', () => {
  // `query` gibt bei dieser Ebene keine Geometrie heraus; der Abruf ist ein
  // `identify` über den Gemeindeumriss. Läuft das Rechteck vom Rahmen in
  // `core/city.ts` weg, fehlen Bezirke am Rand — deshalb beide gleich.
  it('fragt die Bezirke per identify über den Gemeindeumriss in Grad', () => {
    const dateien = cityFiles('kassel')
    expect(dateien.map((d) => d.key)).toEqual(['bezirke', 'districts'])
    const bezirke = new URL(dateien[0]?.url ?? '')
    expect(bezirke.pathname.endsWith('/Verkehr_Mobilitaet/MapServer/identify')).toBe(true)
    const { minLon, minLat, maxLon, maxLat } = KASSEL.reportBounds
    expect(bezirke.searchParams.get('geometry')).toBe(`${minLon},${minLat},${maxLon},${maxLat}`)
    expect(bezirke.searchParams.get('geometryType')).toBe('esriGeometryEnvelope')
    expect(bezirke.searchParams.get('sr')).toBe('4326')
    expect(bezirke.searchParams.get('layers')).toBe('all:27')
    expect(bezirke.searchParams.get('tolerance')).toBe('0')
    expect(bezirke.searchParams.get('returnGeometry')).toBe('true')
    expect(bezirke.searchParams.get('f')).toBe('json')
    // Kein GeoJSON, also keine Messlatte hier — die steht im Datenbau.
    expect(dateien[0]?.expectedFeatures).toBeUndefined()
    expect(citySources('kassel')).toEqual([])
  })

  it('fragt die Ortsbezirke wie jede andere ArcGIS-Ebene, mit Messlatte', () => {
    const districts = cityFiles('kassel')[1]
    const url = new URL(districts?.url ?? '')
    expect(url.pathname.endsWith('/Politik_Verwaltung/MapServer/0/query')).toBe(true)
    expect(url.searchParams.get('f')).toBe('geojson')
    expect(url.searchParams.get('outSR')).toBe('4326')
    expect(districts?.expectedFeatures).toBe(24)
  })

  it('baut ein identify, das Eingabe- und Ausgabebezug gleich setzt', () => {
    const url = new URL(arcgisIdentifyUrl('https://example.test/MapServer', 3, { minLon: 1, minLat: 2, maxLon: 3, maxLat: 4 }))
    expect(url.pathname).toBe('/MapServer/identify')
    expect(url.searchParams.get('geometry')).toBe('1,2,3,4')
    expect(url.searchParams.get('mapExtent')).toBe('1,2,3,4')
    expect(url.searchParams.get('layers')).toBe('all:3')
    expect(url.searchParams.get('sr')).toBe('4326')
  })
})

describe('cityFiles für Saarbrücken', () => {
  // Kein Dienst, sondern vier statische GeoJSON-Dateien aus dem CKAN der
  // Stadt, paarweise Fläche und Beschriftung — deshalb keine Abfrageparameter,
  // aber je Datei eine Erwartungszahl, an der ein leerer Abruf auffällt.
  it('holt die vier Dateien vom Portal der Stadt, jede mit Erwartungswert', () => {
    const dateien = cityFiles('saarbruecken')
    expect(dateien.map((d) => d.key)).toEqual(['zones', 'zoneLabels', 'districts', 'districtLabels'])
    for (const datei of dateien) {
      const url = new URL(datei.url)
      expect(url.hostname).toBe('opendata.saarbruecken.de')
      expect(url.pathname).toMatch(/^\/dataset\/[0-9a-f-]{36}\/resource\/[0-9a-f-]{36}\/download\/[a-z_]+\.geojson$/)
      expect(url.search, datei.key).toBe('')
      expect(datei.expectedFeatures, datei.key).toBeGreaterThan(0)
      expect(datei.file).toMatch(/\.json$/)
    }
    expect(dateien.map((d) => d.expectedFeatures)).toEqual([27, 30, 20, 20])
    // Fläche und Beschriftung eines Datensatzes kommen aus demselben Datensatz.
    const datensatz = (key: string): string =>
      (dateien.find((d) => d.key === key)?.url ?? '').split('/resource/')[0] ?? ''
    expect(datensatz('zones')).toBe(datensatz('zoneLabels'))
    expect(datensatz('districts')).toBe(datensatz('districtLabels'))
    expect(datensatz('zones')).not.toBe(datensatz('districts'))
  })

  it('kennt Saarbrücken auch in citySources — mit leerer WFS-Liste, ohne zu werfen', () => {
    expect(citySources('saarbruecken')).toEqual([])
  })
})
