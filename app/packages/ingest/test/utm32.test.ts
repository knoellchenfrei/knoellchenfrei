import { describe, expect, it } from 'vitest'

import { utm32ToWgs84, Utm32Error } from '../src/utm32.js'

/**
 * `utm32.ts` gegen amtliche Punktpaare — bis zum 10. September ein Skript
 * (`utm32.check.ts`), das von Hand lief und selbst ankündigte, in die Suite
 * umzuziehen, „sobald `ingest` einen Testlauf bekommt". Den gibt es seit dem
 * 8. September.
 *
 * ## Woher die Zahlen kommen
 *
 * Von einer **anderen Behörde als der, deren Daten geprüft werden** — das ist
 * der Punkt. Der Kölner Dienst kann als Referenz nicht dienen: Er rechnet ja
 * gerade nicht um. Der WFS der Bezirksregierung Köln für die
 * NRW-Verwaltungsgebiete tut es korrekt, und er führt dieselbe Stadt:
 *
 *     B='https://www.wfs.nrw.de/geobasis/wfs_nw_dvg'
 *     Q="service=WFS&version=2.0.0&request=GetFeature&typeNames=dvg:nw_dvg1_gem"
 *     Q="$Q&outputFormat=application%2Fjson%3B%20subtype%3Dgeojson"
 *     Q="$Q&bbox=355000,5644000,358000,5647000,urn:ogc:def:crs:EPSG::25832"
 *     curl -sS "$B?$Q"                                        # EPSG:25832
 *     curl -sS "$B?$Q&srsName=urn:ogc:def:crs:EPSG::4326"     # WGS 84
 *
 * Beide Antworten führen die Stadtgrenze Kölns mit **4.508 Stützpunkten in
 * derselben Reihenfolge** — also 4.508 Paare desselben Punktes in beiden
 * Systemen, gerechnet von der Landesvermessung. Der vollständige Abgleich lief
 * am 8. September 2026 und ergab als größte Abweichung 6,8 · 10⁻⁷ Meter.
 *
 * Unten stehen zwanzig davon: die vier Extrempunkte der Stadtgrenze und
 * sechzehn gleichmäßig über den Umriss verteilte. Zwanzig Punkte über 43 km
 * Ost-West und 28 km Nord-Süd fangen jeden Fehler, den es hier geben kann:
 * falsches Ellipsoid, falscher Mittelmeridian, falscher Maßstabsfaktor,
 * vertauschte Achsen, ein fehlendes Reihenglied.
 */
interface Reference {
  where: string
  easting: number
  northing: number
  lon: number
  lat: number
}

const REFERENCES: readonly Reference[] = [
  { where: 'nördlichster Punkt der Stadtgrenze', easting: 349316.753, northing: 5661474.627, lon: 6.848547491030035, lat: 51.08496082777669 },
  { where: 'südlichster Punkt der Stadtgrenze', easting: 363559.538, northing: 5632757.531, lon: 7.062540372211196, lat: 50.830433719768436 },
  { where: 'östlichster Punkt der Stadtgrenze', easting: 370675.605, northing: 5636972.085, lon: 7.162043275354011, lat: 50.869948218897285 },
  { where: 'westlichster Punkt der Stadtgrenze', easting: 343916.754, northing: 5659037.252, lon: 6.772559926829287, lat: 51.061615824174 },
  { where: 'Stadtgrenze 1/16', easting: 349321.854, northing: 5661440.196, lon: 6.848634626464627, lat: 51.08465276982379 },
  { where: 'Stadtgrenze 2/16', easting: 358194.179, northing: 5653046.902, lon: 6.978512762461877, lat: 51.01148567195695 },
  { where: 'Stadtgrenze 3/16', easting: 364674.342, northing: 5652179.309, lon: 7.071155730292661, lat: 51.005249536057015 },
  { where: 'Stadtgrenze 4/16', easting: 365982.209, northing: 5647162.635, lon: 7.091636096138035, lat: 50.960468209121295 },
  { where: 'Stadtgrenze 5/16', easting: 368102.222, northing: 5645352.098, lon: 7.122462800236569, lat: 50.94468478672508 },
  { where: 'Stadtgrenze 6/16', easting: 368567.524, northing: 5645244.49, lon: 7.129121325740343, lat: 50.94382389747698 },
  { where: 'Stadtgrenze 7/16', easting: 368992.813, northing: 5645354.798, lon: 7.135132000176564, lat: 50.944912124575126 },
  { where: 'Stadtgrenze 8/16', easting: 369539.274, northing: 5645483.944, lon: 7.142860150518984, lat: 50.9461967930903 },
  { where: 'Stadtgrenze 9/16', easting: 369164.814, northing: 5641941.086, lon: 7.138804283581826, lat: 50.914269230494824 },
  { where: 'Stadtgrenze 10/16', easting: 368746.531, northing: 5635548.589, lon: 7.135153327784497, lat: 50.85671910466563 },
  { where: 'Stadtgrenze 11/16', easting: 358652.67, northing: 5633635.895, lon: 6.992568810763168, lat: 50.83715041527535 },
  { where: 'Stadtgrenze 12/16', easting: 353854.294, northing: 5634873.155, lon: 6.923975145197704, lat: 50.847077640043196 },
  { where: 'Stadtgrenze 13/16', easting: 349730.385, northing: 5641394.871, lon: 6.862757071315649, lat: 50.90462818510773 },
  { where: 'Stadtgrenze 14/16', easting: 346732.457, northing: 5646953.806, lon: 6.817813942955306, lat: 50.953793211214695 },
  { where: 'Stadtgrenze 15/16', easting: 346735.735, northing: 5656032.471, lon: 6.814029438653544, lat: 51.03537468739666 },
  { where: 'Stadtgrenze 16/16', easting: 345246.771, northing: 5659594.766, lon: 6.791286732437174, lat: 51.066985513784935 },
]

const TOLERANCE_METRES = 0.001

/** Meter je Grad, grob und für eine Fehlerschranke völlig ausreichend. */
const METRES_PER_DEGREE_LAT = 111_132

function metresApart(lon: number, lat: number, otherLon: number, otherLat: number): number {
  const dLat = (lat - otherLat) * METRES_PER_DEGREE_LAT
  const dLon = (lon - otherLon) * METRES_PER_DEGREE_LAT * Math.cos((lat * Math.PI) / 180)
  return Math.hypot(dLat, dLon)
}


describe('utm32ToWgs84', () => {
  it.each(REFERENCES)('trifft $where auf einen Millimeter', ({ easting, northing, lon, lat }) => {
    const [gerechnetLon, gerechnetLat] = utm32ToWgs84(easting, northing)
    expect(metresApart(gerechnetLon, gerechnetLat, lon, lat)).toBeLessThan(TOLERANCE_METRES)
  })

  // Der wahrscheinlichste Betriebsfehler ist nicht eine falsche Formel,
  // sondern eine zweimal umgerechnete Liste — der Kölner Dienst beschriftet
  // seine UTM-Zahlen als EPSG:4326. Grad hinein müssen abbrechen, und zwar
  // mit der eigenen Fehlerklasse.
  it.each([
    [6.9583, 50.9413],
    [0, 0],
    [Number.NaN, 5645891],
  ])('weist %s/%s als Eingabe ab', (easting, northing) => {
    expect(() => utm32ToWgs84(easting, northing)).toThrow(Utm32Error)
  })
})
