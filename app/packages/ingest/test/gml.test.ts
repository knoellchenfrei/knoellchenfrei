import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import { GmlError, parseWfsGml } from '../src/gml.js'

/**
 * Der GML-Leser gegen zwei wörtliche Auszüge der Schweriner Antworten vom
 * 16. September 2026 — drei Parkscheinautomaten (darunter die beiden ohne
 * Betrag und der mit Zeilenumbruch in der Bemerkung) und zwei Parkzonen
 * (eine `MultiSurface` aus zwei Teilflächen, ein Fünfeck). Ausgedachtes GML
 * wäre immer das, das der Leser schon kann.
 */
const read = (name: string): string =>
  readFileSync(fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url)), 'utf8')

const AUTOMATEN = read('sn-parkscheinautomaten-auszug-2026-09-16.gml')
const ZONEN = read('sn-parkzonen-auszug-2026-09-16.gml')

describe('parseWfsGml an den Parkscheinautomaten', () => {
  const collection = parseWfsGml(AUTOMATEN)

  it('liest Kopfzahlen, srsName und genau die drei Features', () => {
    expect(collection.numberMatched).toBe(143)
    expect(collection.numberReturned).toBe(3)
    expect(collection.srsName).toBe('urn:ogc:def:crs:EPSG::25833')
    expect(collection.features).toHaveLength(3)
  })

  it('führt Typname, Kennung und alle acht Sachfelder als Zeichenketten', () => {
    const first = collection.features[0]
    expect(first?.typeName).toBe('masterportal:Parkscheinautomaten')
    expect(first?.id).toBe('Parkscheinautomaten.148')
    expect(first?.properties).toEqual({
      Bezeichnung: 'PA 41',
      Bemerkung: '',
      Standort: 'Am Strand',
      Bewirtschaftungszeit: 'Mo - So 8-21 h',
      Hoechstparkdauer: 'ohne',
      Gebuehr: '1.50 Euro je Std.',
      Tagesticket: 'nein',
      Kurzparkticket: 'nein',
    })
  })

  it('liest den Punkt in der Reihenfolge der Datei, ohne Achsen zu drehen', () => {
    expect(collection.features[0]?.geometry).toEqual({
      type: 'Point',
      coordinates: [265351.118989, 5945118.589195],
    })
  })

  // Ein leeres Feld ist eine leere Zeichenkette, kein `null` und kein
  // fehlendes Feld — so schreibt MapServer es, und der Datenbau soll den
  // Unterschied zu einem weggelassenen Element sehen können.
  it('liefert leere Felder als leere Zeichenkette und behält Zeilenumbrüche', () => {
    const marstall = collection.features.find((f) => f.properties['Bezeichnung'] === 'PA 12')
    expect(marstall?.properties['Gebuehr']).toBe('')
    expect(marstall?.properties['Hoechstparkdauer']).toBe('')
    expect(marstall?.properties['Bemerkung']).toMatch(/^Sonderregelung: {2}Privatparkplatz Landesregierung.*\n$/)
  })

  it('kennt kein gml:boundedBy als Sachfeld', () => {
    for (const feature of collection.features) {
      expect(Object.keys(feature.properties)).not.toContain('boundedBy')
      expect(Object.keys(feature.properties)).not.toContain('msGeometry')
    }
  })
})

describe('parseWfsGml an den Parkzonen', () => {
  const collection = parseWfsGml(ZONEN)

  // Die Ebene hat keine Kennung — MapServer schreibt das als Kommentar in die
  // Antwort — und kein einziges Sachfeld. Beides muss so herauskommen und
  // darf nicht als Fehler gelten: Es ist der Befund, um den sich Schwerins
  // Datenbau dreht.
  it('liest Features ohne Kennung und ohne Sachfelder', () => {
    expect(collection.features).toHaveLength(2)
    for (const feature of collection.features) {
      expect(feature.id).toBeNull()
      expect(feature.properties).toEqual({})
      expect(feature.typeName).toBe('masterportal:Parkzonen')
    }
  })

  it('macht aus einer MultiSurface ein MultiPolygon mit zwei geschlossenen Ringen', () => {
    const multi = collection.features[0]?.geometry
    expect(multi?.type).toBe('MultiPolygon')
    const polygons = multi?.coordinates as number[][][][]
    expect(polygons).toHaveLength(2)
    for (const polygon of polygons) {
      expect(polygon).toHaveLength(1) // kein Loch
      const ring = polygon[0] as number[][]
      expect(ring.length).toBeGreaterThanOrEqual(4)
      expect(ring[0]).toEqual(ring[ring.length - 1])
    }
  })

  it('liest ein einfaches Polygon mit fünf Stützpunkten', () => {
    const polygon = collection.features[1]?.geometry
    expect(polygon?.type).toBe('Polygon')
    expect((polygon?.coordinates as number[][][])[0]).toHaveLength(5)
  })
})

describe('parseWfsGml weist ab, was es nicht sicher lesen kann', () => {
  it('wirft den Text eines ows:ExceptionReport, statt null Features zu liefern', () => {
    const report =
      '<?xml version="1.0"?><ows:ExceptionReport xmlns:ows="http://www.opengis.net/ows/1.1">' +
      '<ows:Exception exceptionCode="InvalidParameterValue" locator="srsname">' +
      '<ows:ExceptionText>msWFSGetFeature(): WFS server error. Invalid SRS</ows:ExceptionText>' +
      '</ows:Exception></ows:ExceptionReport>'
    expect(() => parseWfsGml(report)).toThrow(/Invalid SRS/)
    expect(() => parseWfsGml(report)).toThrow(GmlError)
  })

  it('wirft bei allem, was keine FeatureCollection ist', () => {
    expect(() => parseWfsGml('<html><body>404</body></html>')).toThrow(GmlError)
    expect(() => parseWfsGml('{"type":"FeatureCollection","features":[]}')).toThrow(GmlError)
    expect(() => parseWfsGml('')).toThrow(GmlError)
  })

  it('wirft, wenn numberReturned und die gelesenen Features auseinanderlaufen', () => {
    const gekuerzt = AUTOMATEN.replace('numberReturned="3"', 'numberReturned="4"')
    expect(() => parseWfsGml(gekuerzt)).toThrow(/numberReturned="4", gelesen wurden 3/)
  })

  // Aus einer Dreierliste Paare zu bilden ergäbe plausible Zahlen an
  // falschen Stellen — die Höhe rutschte in den Ostwert des nächsten Punktes.
  it('wirft bei drei Dimensionen', () => {
    const dreidimensional = AUTOMATEN.replace(
      '<gml:pos>265351.118989 5945118.589195</gml:pos>',
      '<gml:pos srsDimension="3">265351.118989 5945118.589195 40.0</gml:pos>',
    )
    expect(() => parseWfsGml(dreidimensional)).toThrow(/srsDimension 3/)
  })

  it('wirft bei einer ungeraden Zahlenliste und bei einem offenen Ring', () => {
    const ungerade = AUTOMATEN.replace(
      '<gml:pos>265351.118989 5945118.589195</gml:pos>',
      '<gml:pos>265351.118989</gml:pos>',
    )
    expect(() => parseWfsGml(ungerade)).toThrow(/keine Koordinatenpaare/)
    const dreieck = ZONEN.replace(
      /<gml:posList srsDimension="2">([\d.]+ [\d.]+) ([\d.]+ [\d.]+) [\d. ]*<\/gml:posList>/,
      '<gml:posList srsDimension="2">$1 $2 $1</gml:posList>',
    )
    expect(() => parseWfsGml(dreieck)).toThrow(/Ring mit 3 Punkten/)
  })

  it('wirft bei Linien, statt eine leere Geometrie durchzulassen', () => {
    const linie = AUTOMATEN.replace(
      /<gml:Point[^>]*>\s*<gml:pos>([^<]*)<\/gml:pos>\s*<\/gml:Point>/,
      '<gml:LineString><gml:posList>$1 $1</gml:posList></gml:LineString>',
    )
    expect(() => parseWfsGml(linie)).toThrow(/LineString wird nicht gelesen/)
  })

  it('wirft bei einem Sachfeld mit Markup darin', () => {
    const verschachtelt = AUTOMATEN.replace(
      '<masterportal:Standort>Am Strand</masterportal:Standort>',
      '<masterportal:Standort><b>Am Strand</b></masterportal:Standort>',
    )
    expect(() => parseWfsGml(verschachtelt)).toThrow(/enthält Markup/)
  })

  it('löst die fünf XML-Entities und numerische Zeichen auf', () => {
    const kodiert = AUTOMATEN.replace(
      '<masterportal:Standort>Am Strand</masterportal:Standort>',
      '<masterportal:Standort>Am &amp; Strand &lt;3&gt; &quot;a&quot; &apos;b&apos; &#228; &#xDF;</masterportal:Standort>',
    )
    expect(parseWfsGml(kodiert).features[0]?.properties['Standort']).toBe('Am & Strand <3> "a" \'b\' ä ß')
  })

  it('liest ein selbstschließendes leeres Feld genauso wie ein leeres Paar', () => {
    const kurz = AUTOMATEN.replace('<masterportal:Bemerkung></masterportal:Bemerkung>', '<masterportal:Bemerkung/>')
    expect(parseWfsGml(kurz).features[0]?.properties['Bemerkung']).toBe('')
  })
})
