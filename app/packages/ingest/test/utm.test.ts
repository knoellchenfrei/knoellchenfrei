import { describe, expect, it } from 'vitest'

import { UtmError, utmCoordinatesToWgs84, utmToWgs84 } from '../src/utm.js'
import { utm32ToWgs84 } from '../src/utm32.js'

/**
 * `utm.ts` in **Zone 33** gegen amtliche Punktpaare — das Gegenstück zu
 * `utm32.test.ts`, das dieselbe Reihe in Zone 32 an der Kölner Stadtgrenze
 * misst. Die Rechnung ist seit dem 16. September 2026 parametrisiert; ein
 * Fehler im Mittelmeridian (9° statt 15°) verschöbe Schwerin um 660 km nach
 * Westen, und keine einzige Zahl sähe dabei unplausibel aus.
 *
 * ## Woher die Zahlen kommen
 *
 * Zwei Dienste, zwei Behörden, beide in Zone 33:
 *
 * **Berlin**, `gdi.berlin.de`, `parkraumbewirtschaftung:parkzonen` — der
 * GeoServer der Berliner Landesvermessung rechnet korrekt um und schreibt
 * acht Nachkommastellen. Dieselbe Anfrage (`count=3`) einmal mit
 * `srsName=urn:ogc:def:crs:EPSG::25833` und einmal mit `…::4326` liefert
 * 159 Stützpunkte in derselben Reihenfolge — 159 Paare desselben Punktes,
 * gerechnet von der Landesvermessung. Vierzehn davon stehen unten, gegen
 * eine Schranke von zwei Millimetern (acht Nachkommastellen sind rund ein
 * Millimeter; warum die Schranke trotzdem ein Zentimeter ist, steht am Test).
 *
 * **Schwerin**, `geoportal.kreis-lup.de/ows/masterportal/raumgliederung-sn`,
 * `ms:Stadtgrenzen_Schwerin` — der MapServer des Landkreises
 * Ludwigslust-Parchim kennt für diesen Dienst EPSG:4326 als `OtherCRS` und
 * rechnet um; nur der Parken-Dienst daneben tut es nicht. 2.259 Stützpunkte
 * der Stadtgrenze in beiden Systemen, aber nur **sechs Nachkommastellen** —
 * also rund ein Dezimeter. Acht davon stehen unten mit einer Schranke von
 * 0,15 m: grob, aber vom selben Server wie die Parkdaten, und damit der
 * Beleg, dass dessen 25833 dasselbe 25833 ist wie Berlins.
 *
 * Abgerufen am 16. September 2026.
 */
interface Reference {
  where: string
  easting: number
  northing: number
  lon: number
  lat: number
}

const BERLIN: readonly Reference[] = [
  { where: 'westlichster Stützpunkt', easting: 377895.3635, northing: 5822002.6558, lon: 13.19976784, lat: 52.53441322 },
  { where: 'östlichster Stützpunkt', easting: 394084.19466129, northing: 5815742.26205014, lon: 13.44033518, lat: 52.48154072 },
  { where: 'südlichster Stützpunkt', easting: 392761.31788284, northing: 5815644.4909612, lon: 13.42089459, lat: 52.48040373 },
  { where: 'nördlichster Stützpunkt', easting: 378368.6749, northing: 5822949.555, lon: 13.2063955, lat: 52.54302769 },
  { where: 'Zone 1/10', easting: 390868.5238, northing: 5820388.1901, lon: 13.39147919, lat: 52.52265847 },
  { where: 'Zone 2/10', easting: 390518.7752, northing: 5820175.8848, lon: 13.38639629, lat: 52.52068042 },
  { where: 'Zone 3/10', easting: 391108.9086, northing: 5819560.0661, lon: 13.39529202, lat: 52.51526451 },
  { where: 'Zone 4/10', easting: 391671.0055, northing: 5819744.0367, lon: 13.4035121, lat: 52.5170298 },
  { where: 'Zone 5/10', easting: 391509.9607, northing: 5820123.3728, lon: 13.40101594, lat: 52.52040673 },
  { where: 'Zone 6/10', easting: 391131.249, northing: 5820346.9445, lon: 13.39536343, lat: 52.52234037 },
  { where: 'Zone 7/10', easting: 377965.1874, northing: 5821973.4727, lon: 13.20080745, lat: 52.53416664 },
  { where: 'Zone 8/10', easting: 378535.821, northing: 5822408.3718, lon: 13.20905693, lat: 52.53820207 },
  { where: 'Zone 9/10', easting: 378361.9614, northing: 5822874.0064, lon: 13.20632423, lat: 52.54234733 },
  { where: 'Zone 10/10', easting: 378038.4769, northing: 5822542.9402, lon: 13.20167828, lat: 52.53930012 },
]

const SCHWERIN: readonly Reference[] = [
  { where: 'westlichster Punkt der Stadtgrenze', easting: 255290.401, northing: 5952167.956, lon: 11.296063, lat: 53.660885 },
  { where: 'östlichster Punkt der Stadtgrenze', easting: 268850.79, northing: 5947032.361, lon: 11.504697, lat: 53.620978 },
  { where: 'südlichster Punkt der Stadtgrenze', easting: 263127.023, northing: 5938889.497, lon: 11.424507, lat: 53.545372 },
  { where: 'nördlichster Punkt der Stadtgrenze', easting: 263642.441, northing: 5954676.27, lon: 11.420295, lat: 53.687227 },
  { where: 'Stadtgrenze 1/4', easting: 260733.739, northing: 5940206.013, lon: 11.387453, lat: 53.556097 },
  { where: 'Stadtgrenze 2/4', easting: 255787.576, northing: 5952332.234, lon: 11.303442, lat: 53.662591 },
  { where: 'Stadtgrenze 3/4', easting: 262976.528, northing: 5954606.419, lon: 11.410284, lat: 53.686299 },
  { where: 'Stadtgrenze 4/4', easting: 268806.923, northing: 5946796.501, lon: 11.50421, lat: 53.618843 },
]

/** Meter je Grad, grob und für eine Fehlerschranke völlig ausreichend. */
const METRES_PER_DEGREE_LAT = 111_132

function metresApart(lon: number, lat: number, otherLon: number, otherLat: number): number {
  const dLat = (lat - otherLat) * METRES_PER_DEGREE_LAT
  const dLon = (lon - otherLon) * METRES_PER_DEGREE_LAT * Math.cos((lat * Math.PI) / 180)
  return Math.hypot(dLat, dLon)
}

describe('utmToWgs84 in Zone 33', () => {
  // Nicht zwei Millimeter, sondern ein Zentimeter: Alle 159 Berliner Paare
  // liegen **gleichmäßig 3,6 bis 4,5 mm** neben der Reihe — kein Streuen,
  // sondern ein Versatz, wie ihn ein Datumsübergang ETRS89 → WGS 84 erzeugt,
  // den GeoServer offenbar rechnet und diese Datei bewusst nicht (siehe
  // `utm.ts`). Zwei Millimeter Schranke hätten also nicht die Reihe gemessen,
  // sondern die Frage, ob Berlin ein Datum verschiebt. Ein Fehler in Reihe,
  // Zone oder Ellipsoid läge bei Metern bis Kilometern, nicht bei Millimetern.
  it.each(BERLIN)('trifft Berlins $where auf einen Zentimeter', ({ easting, northing, lon, lat }) => {
    const [gerechnetLon, gerechnetLat] = utmToWgs84(easting, northing, 33)
    expect(metresApart(gerechnetLon, gerechnetLat, lon, lat)).toBeLessThan(0.01)
  })

  it.each(SCHWERIN)('trifft Schwerins $where auf 15 Zentimeter', ({ easting, northing, lon, lat }) => {
    const [gerechnetLon, gerechnetLat] = utmToWgs84(easting, northing, 33)
    expect(metresApart(gerechnetLon, gerechnetLat, lon, lat)).toBeLessThan(0.15)
  })

  // Die Probe, die den Parameter überhaupt rechtfertigt: Dieselben Meter in
  // Zone 32 gerechnet liegen sechs Grad weiter westlich — in Zone 32 wäre
  // Schwerin bei Bremen. Wer die Zone vergisst, bekommt keinen Fehler, nur
  // eine andere Stadt.
  it('unterscheidet sich von Zone 32 um genau die sechs Grad des Mittelmeridians', () => {
    const [lon33] = utmToWgs84(262318.0, 5948986.6, 33)
    const [lon32] = utm32ToWgs84(262318.0, 5948986.6)
    expect(lon33 - lon32).toBeCloseTo(6, 6)
  })

  it.each([
    [11.4183, 53.6355],
    [0, 0],
    [Number.NaN, 5948986],
  ])('weist %s/%s als Eingabe ab', (easting, northing) => {
    expect(() => utmToWgs84(easting, northing, 33)).toThrow(UtmError)
  })

  it('rechnet eine verschachtelte Koordinatenliste bis in die tiefste Ebene um', () => {
    const polygon = [[[262318.0, 5948986.6], [262418.0, 5948986.6], [262418.0, 5949086.6], [262318.0, 5948986.6]]]
    const result = utmCoordinatesToWgs84(polygon, 33) as number[][][]
    expect(result).toHaveLength(1)
    expect(result[0]).toHaveLength(4)
    const [lon, lat] = result[0]?.[0] as number[]
    expect(lon).toBeCloseTo(11.4046, 3)
    expect(lat).toBeCloseTo(53.6356, 3)
    expect(utmCoordinatesToWgs84(null, 33)).toBeNull()
  })
})
