/**
 * Baut Wiens Daten — das Gegenstück zu `build-data-hamburg.ts`, für die
 * erste Stadt außerhalb Deutschlands.
 *
 * Drei Ebenen aus einem GeoServer (`sources.ts`): die 81 Kurzparkzonen-
 * Flächen (je Bezirk), die 796 Geschäftsstraßen-Streifen (Linien) und die
 * 23 Bezirke. Was diesen Datenbau von allen vorherigen unterscheidet:
 *
 * - **Die Streifen werden zu Flächen.** Die App kennt nur Polygone, die
 *   Geschäftsstraßen kommen als Linien. `bufferLine` legt um jede ein Band
 *   von 2 × `HALF_WIDTH_METRES`; die Bänder stehen in `zones.geojson`
 *   **vor** den Bezirksflächen, weil `zoneAt` den ersten Treffer nimmt und
 *   die Regelung der Geschäftsstraße die des Bezirks überstimmt (bis 18 Uhr
 *   statt 22, 1,5 h statt 2). Wer die Reihenfolge umdreht, macht jede
 *   Geschäftsstraße unsichtbar, ohne dass irgendetwas rot würde.
 * - **Der Tarif kommt aus der Verordnung**, nicht aus dem Feed — `wienFee()`
 *   und `WIEN_RAW_FEE` in `core/wien.ts`, mit Fundstelle. `meta.absent`
 *   führt `fee` deshalb **nicht**; das Panel sagt in `rawFee`, woher die Zahl
 *   stammt.
 * - **Die Bezirksflächen sind groß.** 383.289 Stützpunkte in 81 Flächen,
 *   9,9 MB roh — die Quelle zeichnet jede Straßenkante nach. Vereinfacht mit
 *   1e-5 (rund ein Meter), wie die Zonen der anderen Städte; die Bezirke mit
 *   1e-4 wie überall. Und ein MultiPolygon wird zu einem Feature je Stück,
 *   siehe `pieces`.
 *
 * Die Ausgabe trägt die Lücken als `absent` in `meta.json`: keine POI, keine
 * Umweltzone (Wien hat keine), keine Straßenabschnitte.
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

import {
  WIEN,
  WIEN_RAW_FEE,
  multiPolygonContains,
  parseWienMaxStay,
  parseWienSchedule,
  wienAreaDistricts,
  wienAreaKey,
  wienFee,
  wienStripKey,
  type ChargeWindow,
  type Fee,
  type PolygonRings,
  type Position,
  type WienAreaProperties,
  type WienDistrictProperties,
  type WienStripProperties,
} from '@knoellchenfrei/core'

import { geprueftAm } from './abruf-zeit.js'
import { bufferLine } from './linien-puffer.js'
import { simplifyGeometry } from './simplify.js'
import { citySources, toGeoJsonAxes, type AxisOrder } from './sources.js'

const RAW = join(process.env.RAW_DIR ?? join(process.cwd(), '../../.raw'), WIEN.key)
const OUT = join(process.env.OUT_DIR ?? join(process.cwd(), '../../apps/web/public/data'), WIEN.key)

/**
 * Halbe Breite des Bands um eine Geschäftsstraße, in Metern.
 *
 * Die Linie der Quelle liegt auf der Straßenachse; geparkt wird am Rand,
 * auf beiden Seiten. Eine Wiener Geschäftsstraße ist mit Gehsteigen
 * zwischen 15 und 25 m breit (Währinger Straße, Landstraßer Hauptstraße),
 * die Parkspur also 5 bis 10 m von der Achse entfernt, und eine Ortung
 * liegt noch einmal bis zu 10 m daneben. 12 m fangen beides; 20 m zögen
 * Ortungen aus der Querstraße herein, die zur Bezirkszone gehören. Das Band
 * ragt damit über die Fahrbahn hinaus in die Häuserfront — dort parkt
 * niemand, also schadet es nicht.
 */
const HALF_WIDTH_METRES = 12

interface Geometry {
  type: string
  coordinates: unknown
}

interface Feature<P> {
  id?: string
  properties: P
  geometry: Geometry | null
}

const AXIS: AxisOrder = citySources(WIEN.key).find((source) => source.key === 'zones')?.axisOrder ?? 'lon,lat'

function readFeatures<P>(key: string): Feature<P>[] {
  const parsed = JSON.parse(readFileSync(join(RAW, `${key}.json`), 'utf8')) as { features: Feature<P>[] }
  return parsed.features
}

function toGeoJson(geometry: Geometry | null): Geometry | null {
  if (geometry === null) return null
  return { type: geometry.type, coordinates: toGeoJsonAxes(geometry.coordinates, AXIS) }
}

/**
 * Nachmessen, dass Grade kamen. Ohne `srsName` antwortet Wiens GeoServer in
 * EPSG:31256 (MGI / Gauß-Krüger M34): `[759.8, 345262.9]` — Meter um einen
 * Nullpunkt bei Wien, plausible Zahlen, keine Grade, auf der Karte nur
 * „leer". Dazu die Gegenrichtung: Ein Wert, der wie ein Grad aussieht, aber
 * nicht in Wien liegt, ist eine gedrehte Achse.
 */
function assertDegrees(key: string, geometry: Geometry): void {
  for (const [lon, lat] of positionsOf(geometry)) {
    if (Math.abs(lon) > 180 || Math.abs(lat) > 90) {
      throw new Error(`${key}: ${lon}/${lat} sind keine Grade — der Dienst hat vermutlich in EPSG:31256 geantwortet; srsName fehlt`)
    }
    if (lon < 16 || lon > 17 || lat < 48 || lat > 48.5) {
      throw new Error(`${key}: ${lon}/${lat} liegt nicht in Wien — Achsenreihenfolge in sources.ts prüfen`)
    }
  }
}

function positionsOf(geometry: Geometry): Position[] {
  const points: Position[] = []
  const walk = (node: unknown): void => {
    if (!Array.isArray(node)) return
    if (typeof node[0] === 'number' && typeof node[1] === 'number') {
      points.push([node[0], node[1]])
      return
    }
    node.forEach(walk)
  }
  walk(geometry.coordinates)
  return points
}

function toPolygons(geometry: Geometry): PolygonRings[] {
  if (geometry.type === 'Polygon') return [geometry.coordinates as PolygonRings]
  if (geometry.type === 'MultiPolygon') return geometry.coordinates as PolygonRings[]
  return []
}

function write(name: string, value: unknown): void {
  const path = join(OUT, name)
  mkdirSync(dirname(path), { recursive: true })
  const json = JSON.stringify(value)
  writeFileSync(path, json)
  console.log(`  ${name}: ${(json.length / 1024).toFixed(0)} KB`)
}

/** Dasselbe Feld-Schema wie die zehn Städte davor. */
interface ZoneOut {
  zone: string
  district: string
  rawHours: string
  rawFee: string
  note: string | null
  windows: ChargeWindow[]
  fee: Fee
  unmodelledRules: string[]
  sourceDefect: string | null
  spaces: number | null
  maxStayMinutes: number | null
  maxStay: string | null
  maxStayShare: number
  maxStayValues: string[]
  chargingPoints: number
  carsharing: number
}

console.log('Wien — Daten bauen …')

// --------------------------------------------------------------- Bezirke
//
// Zuerst, weil Flächen und Streifen sie brauchen: Der Feed nennt zu beiden
// nur die Bezirksnummer, und „17" ist im Panel keine Antwort — „Hernals" ist
// eine.

interface District {
  bezirk: number
  name: string
  rings: PolygonRings[]
}

const districtByNumber = new Map<number, District>()
const districtFeatures: { type: 'Feature'; properties: { name: string; bezirk: string }; geometry: Geometry }[] = []

for (const feature of readFeatures<WienDistrictProperties>('districts')) {
  const geometry = toGeoJson(feature.geometry)
  if (geometry === null) continue
  assertDegrees('districts', geometry)
  const bezirk = feature.properties.BEZNR
  const name = (feature.properties.NAMEK ?? '').trim()
  if (typeof bezirk !== 'number' || name === '') {
    throw new Error(`districts: Bezirk ohne Nummer oder Namen: ${JSON.stringify(feature.properties)}`)
  }
  districtByNumber.set(bezirk, { bezirk, name, rings: toPolygons(geometry) })
  const simplified = simplifyGeometry(geometry, 1e-4, 5)
  if (simplified === null) continue
  districtFeatures.push({
    type: 'Feature',
    properties: { name, bezirk: (feature.properties.NAMEK_NUM ?? `${bezirk}., ${name}`).trim() },
    geometry: simplified,
  })
}
if (districtByNumber.size !== 23) {
  throw new Error(`districts: ${districtByNumber.size} Bezirke statt 23 — Wien hat 23, und jede Zone braucht ihren`)
}

write('districts.geojson', { type: 'FeatureCollection', features: districtFeatures })

function districtName(bezirk: number, key: string): string {
  const district = districtByNumber.get(bezirk)
  if (district === undefined) throw new Error(`${key}: Bezirk ${bezirk} steht nicht in den Bezirksgrenzen`)
  return district.name
}

/** Ein Feature der Ausgabe — alle Felder bis auf die vier, die je Ebene anders sind. */
function zoneOut(fields: Pick<ZoneOut, 'zone' | 'district' | 'rawHours' | 'note' | 'maxStayMinutes'>): ZoneOut {
  return {
    ...fields,
    rawFee: WIEN_RAW_FEE,
    windows: parseWienSchedule(fields.rawHours),
    fee: wienFee(),
    unmodelledRules: [],
    sourceDefect: null,
    spaces: null,
    maxStay: null,
    maxStayShare: 0,
    maxStayValues: [],
    chargingPoints: 0,
    carsharing: 0,
  }
}

/** `2022-02-28Z` → `2022-02-28`; der Platzhalter `1111-11-10Z` der Streifen ist kein Datum. */
function validFrom(raw: string | null | undefined): string | null {
  if (raw === null || raw === undefined || raw.startsWith('1111')) return null
  return raw.slice(0, 10)
}

// -------------------------------------------------------- Geschäftsstraßen
//
// Zuerst in die Ausgabe, siehe Kopfkommentar: `zoneAt` nimmt den ersten
// Treffer, und der Streifen muss die Bezirksfläche überstimmen.

const zoneFeatures: { type: 'Feature'; properties: ZoneOut; geometry: Geometry }[] = []
const stripSpellings = new Map<string, number>()
let stripsOutsideDistrict = 0
let stripPieces = 0

function stripGeometry(geometry: Geometry, key: string): Geometry {
  const lines =
    geometry.type === 'LineString'
      ? [geometry.coordinates as Position[]]
      : geometry.type === 'MultiLineString'
        ? (geometry.coordinates as Position[][])
        : null
  if (lines === null) throw new Error(`strips: ${key} ist ${geometry.type}, keine Linie`)
  const rings = lines.map((line) => [bufferLine(line, HALF_WIDTH_METRES)])
  stripPieces += rings.length
  return rings.length === 1 ? { type: 'Polygon', coordinates: rings[0] } : { type: 'MultiPolygon', coordinates: rings }
}

for (const feature of readFeatures<WienStripProperties>('strips')) {
  const geometry = toGeoJson(feature.geometry)
  if (geometry === null) continue
  assertDegrees('strips', geometry)
  const p = feature.properties
  const key = wienStripKey(p)
  const zeiten = (p.ZEITRAUM ?? '').trim()
  if (zeiten === '') throw new Error(`strips: ${key} ohne ZEITRAUM — ohne Zeiten keine Antwort, der Datenbau hält an`)
  stripSpellings.set(zeiten, (stripSpellings.get(zeiten) ?? 0) + 1)
  if (typeof p.BEZIRK !== 'number') throw new Error(`strips: ${key} ohne Bezirk`)

  // Gegenprobe zur Bezirksnummer: Liegt der erste Stützpunkt wirklich im
  // genannten Bezirk? Ein Streifen auf der Bezirksgrenze darf daneben
  // liegen; gezählt und im Log genannt, nicht abgebrochen.
  const first = positionsOf(geometry)[0]
  const rings = districtByNumber.get(p.BEZIRK)?.rings ?? []
  if (first !== undefined && !multiPolygonContains(rings, first)) stripsOutsideDistrict += 1

  const seit = validFrom(p.GUELTIG_VON)
  zoneFeatures.push({
    type: 'Feature',
    properties: zoneOut({
      zone: key,
      district: districtName(p.BEZIRK, key),
      rawHours: zeiten,
      note:
        `Geschäftsstraße im ${p.BEZIRK}. Bezirk — eigene Regelung, ausgenommen von der flächendeckenden Kurzparkzone` +
        (seit === null ? '' : `; laut Quelle gültig seit ${seit}`),
      maxStayMinutes: parseWienMaxStay((p.DAUER ?? '').trim()),
    }),
    geometry: stripGeometry(geometry, key),
  })
}
const stripCount = zoneFeatures.length

// ---------------------------------------------------------- Bezirksflächen

const areaSpellings = new Map<string, number>()
let areasWithTwoDistricts = 0
let areaCount = 0
let areaPieces = 0

/**
 * Ein Stück je Feature.
 *
 * 32 der 81 Flächen sind MultiPolygone, und eines davon (Meidling,
 * `KURZPARKZONEOGD.44534`) besteht aus fünf Stücken von 850 bis 27.000 m²,
 * verstreut über einen Rahmen von 2,1 × 2,6 km. `representativePoint` im
 * Web sucht auf einem 13 × 13-Raster über dem Rahmen — bei 175 m Schrittweite
 * trifft es keines der Stücke, und „hier geparkt" aus dem Panel landete auf
 * einer Kante statt in der Fläche. Getrennt hat jedes Stück seinen eigenen
 * Rahmen, und der Zonenschlüssel bleibt derselbe — wie Hamburgs Stücke
 * einer Zone. Löcher bleiben bei ihrem Außenring.
 */
function pieces(geometry: Geometry): Geometry[] {
  if (geometry.type !== 'MultiPolygon') return [geometry]
  return (geometry.coordinates as PolygonRings[]).map((rings) => ({ type: 'Polygon', coordinates: rings }))
}

for (const feature of readFeatures<WienAreaProperties>('zones')) {
  const geometry = toGeoJson(feature.geometry)
  if (geometry === null) continue
  assertDegrees('zones', geometry)
  const p = feature.properties
  const key = wienAreaKey(p)
  const bezirke = wienAreaDistricts(p)
  if (bezirke.length > 1) areasWithTwoDistricts += 1
  const zeiten = (p.ZEITRAUM ?? '').trim()
  if (zeiten === '') throw new Error(`zones: Fläche ${key} ohne ZEITRAUM — der Datenbau hält an`)
  areaSpellings.set(zeiten, (areaSpellings.get(zeiten) ?? 0) + 1)

  const simplified = simplifyGeometry(geometry, 1e-5, 5)
  if (simplified === null) throw new Error(`zones: Fläche ${key} verschwindet beim Vereinfachen`)

  const seit = validFrom(p.GUELTIG_VON)
  areaCount += 1
  for (const piece of pieces(simplified)) {
    areaPieces += 1
    zoneFeatures.push({
      type: 'Feature',
      properties: zoneOut({
        zone: key,
        district: bezirke.map((bezirk) => districtName(bezirk, key)).join(' / '),
        rawHours: zeiten,
        note:
          `Flächendeckende Kurzparkzone, ${bezirke.map((bezirk) => `${bezirk}.`).join(' und ')} Bezirk` +
          (seit === null ? '' : `; laut Quelle gültig seit ${seit}`),
        maxStayMinutes: parseWienMaxStay((p.DAUER ?? '').trim()),
      }),
      geometry: piece,
    })
  }
}

write('zones.geojson', { type: 'FeatureCollection', features: zoneFeatures })

// ------------------------------------------------------- was es nicht gibt

write('poi.geojson', { type: 'FeatureCollection', features: [] })
write('umweltzone.geojson', { type: 'FeatureCollection', features: [] })

write('meta.json', {
  city: WIEN.key,
  cityName: WIEN.name,
  source: `${WIEN.attribution.source}, WFS 2.0.0 (KURZPARKZONEOGD, KURZPARKSTREIFENOGD, BEZIRKSGRENZEOGD)`,
  licence: WIEN.attribution.licence,
  licenceUrl: WIEN.attribution.licenceUrl,
  attributionRequired: WIEN.attribution.attributionRequired,
  datasetUrl: WIEN.attribution.datasetUrl,
  geprueftAm: geprueftAm(RAW),
  zones: zoneFeatures.length,
  /** Die 81 Flächen der Quelle, bevor MultiPolygone in Stücke zerlegt wurden. */
  areas: areaCount,
  /** Eine Zahl, die nur Wien hat: wie viele der Zonen Geschäftsstraßen-Bänder sind. */
  strips: stripCount,
  districts: districtFeatures.length,
  poi: 0,
  lowEmissionZone: false,
  segments: 0,
  managedSpaces: 0,
  crs: 'EPSG:4326 (lon/lat), vom Dienst aus EPSG:31256 umgerechnet (srsName)',
  /**
   * `fee` steht hier NICHT: Ein Betrag wird ausgeliefert — der der
   * Parkometerabgabeverordnung; `rawFee` je Zone sagt es.
   */
  absent: ['poi', 'lowEmissionZone', 'segments'],
})

// Die Zahlen gehören ins Log, nicht in einen Kommentar: Sie sind das, was
// beim nächsten Abzug anders sein kann.
const spellings = (map: Map<string, number>): string =>
  [...map.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([text, n]) => `    ${n} × ${text}`)
    .join('\n')
console.log(
  `\n${areaCount} Bezirksflächen in ${areaPieces} Stücken (${areasWithTwoDistricts} für zwei Bezirke) und ${stripCount} Geschäftsstraßen` +
    ` (${stripPieces} Bänder à ${2 * HALF_WIDTH_METRES} m, ${stripsOutsideDistrict} mit erstem Stützpunkt außerhalb ihres Bezirks)` +
    `, ${districtFeatures.length} Bezirke`,
)
console.log(`Schreibweisen der Flächen (${areaSpellings.size}):\n${spellings(areaSpellings)}`)
console.log(`Schreibweisen der Geschäftsstraßen (${stripSpellings.size}):\n${spellings(stripSpellings)}`)
