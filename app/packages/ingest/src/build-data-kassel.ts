/**
 * Baut Kassels Daten — das Gegenstück zu `build-data.ts` für die erste Stadt
 * der Klasse C: nur Grenzen, keine Zeiten, kein Betrag.
 *
 * Der Datenbau ist deshalb kurz: kein Zeit- und kein Gebührenparser, nur
 * einer für den Zonennamen. Was er trotzdem tun muss, und warum:
 *
 * - **Die Bezirke kommen aus `identify`, nicht aus `query`.** Die Ebene 27
 *   „Bewohnerparkbezirke" gibt über `query` keine Geometrie heraus (siehe
 *   `KASSEL_FILES` in `sources.ts`). Die Datei `bezirke.json` ist deshalb
 *   Esri-JSON — `results[]` mit `geometry.rings` und Sachdaten als
 *   Zeichenketten — und kein GeoJSON. `esriRingsToPolygons` macht aus den
 *   flachen Ringlisten GeoJSON-Polygone; VW7 hat ein Loch.
 * - **`sr=4326` wird nachgemessen.** Ohne den Parameter antwortet `identify`
 *   in EPSG:25832 (`[531078.79, 5685006.78]`) — plausible Zahlen, nur keine
 *   Grade. `assertDegrees` bricht ab, wie in Frankfurt und Graz.
 * - **Die Zählung macht dieser Bau, nicht `fetch.ts`.** `expectedFeatures`
 *   gilt dort nur für FeatureCollections. Weniger als 95 % der erwarteten
 *   29 Bezirke sind ein Abbruch: Ein `identify`, das nur einen Teil trifft
 *   (falsches Rechteck, geänderte Ebenennummer), sähe sonst aus wie eine
 *   kleinere Stadt.
 * - **Jede Zone trägt `scheduleUnknown: true`**, `windows: []`,
 *   `fee: {kind: 'unknown'}`, `rawHours: ''`, `rawFee: ''` — und `meta.absent`
 *   nennt `schedule` und `fee`. Die Oberfläche sagt „Zeiten unbekannt" und
 *   färbt grau; „frei" wäre eine Behauptung über einen Ort, über den die
 *   Daten nichts sagen.
 *
 * Was Kassel **nicht** hat: POI, Umweltzone (Kassel hat keine),
 * Straßenabschnitte, Stellplatzzahlen. Die Dateien werden trotzdem
 * geschrieben, leer, damit `loadData` alle fünf bekommt.
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

import {
  cityByKey,
  esriRingsToPolygons,
  kasselZoneNote,
  multiPolygonContains,
  parseKasselZoneName,
  type ChargeWindow,
  type Fee,
  type KasselIdentifyResult,
  type PolygonRings,
  type Position,
} from '@knoellchenfrei/core'

import { simplifyGeometry } from './simplify.js'
import { geprueftAm } from './abruf-zeit.js'

/**
 * Die Stadt kommt aus `core/city.ts`, nicht aus einer Kopie hier —
 * Stadtgrenzen stehen im Projekt an genau einer Stelle.
 */
const KASSEL = cityByKey('kassel')

const RAW = join(process.env.RAW_DIR ?? join(process.cwd(), '../../.raw'), KASSEL.key)
const OUT = join(process.env.OUT_DIR ?? join(process.cwd(), '../../apps/web/public/data'), KASSEL.key)

/** Die Ebene, die `identify` treffen muss — eine andere Nummer wäre eine andere Ebene. */
const BEZIRKE_LAYER = 27
/** Nachgemessen am 17. September 2026; dieselbe 95-%-Schwelle wie `fetch.ts`. */
const BEZIRKE_ERWARTET = 29

interface Geometry {
  type: string
  coordinates: unknown
}

interface Feature<P> {
  properties: P
  geometry: Geometry | null
}

interface Collection<P> {
  features: Feature<P>[]
  exceededTransferLimit?: boolean
}

interface IdentifyResponse {
  results?: KasselIdentifyResult[]
  error?: { code?: number; message?: string }
}

function readJson<T>(name: string): T {
  return JSON.parse(readFileSync(join(RAW, name), 'utf8')) as T
}

/** Dieselbe Prüfung wie in Frankfurt, München und Graz: Grad, nicht Meter. */
function assertDegrees(key: string, node: unknown): void {
  if (!Array.isArray(node)) return
  if (typeof node[0] === 'number' && typeof node[1] === 'number') {
    const [lon, lat] = node as number[]
    if (Math.abs(lon as number) > 180 || Math.abs(lat as number) > 90) {
      throw new Error(
        `${key}: ${lon}/${lat} sind keine Grade — der Dienst hat vermutlich in ETRS89 / UTM 32N ` +
          '(EPSG:25832) geantwortet. sr=4326 bzw. outSR=4326 fehlt in der Anfrage.'
      )
    }
    return
  }
  node.forEach((child) => assertDegrees(key, child))
}

function write(name: string, value: unknown): void {
  const path = join(OUT, name)
  mkdirSync(dirname(path), { recursive: true })
  const json = JSON.stringify(value)
  writeFileSync(path, json)
  console.log(`  ${name}: ${(json.length / 1024).toFixed(0)} KB`)
}

function toPolygons(geometry: Geometry): PolygonRings[] {
  if (geometry.type === 'Polygon') return [geometry.coordinates as PolygonRings]
  if (geometry.type === 'MultiPolygon') return geometry.coordinates as PolygonRings[]
  return []
}

/** Mittelpunkt aller Stützpunkte des Außenrings — reicht, um einen Ortsbezirk zu treffen. */
function centroid(polygons: readonly PolygonRings[]): Position | null {
  let lon = 0
  let lat = 0
  let n = 0
  for (const rings of polygons) {
    for (const [x, y] of rings[0] ?? []) {
      lon += x
      lat += y
      n += 1
    }
  }
  return n === 0 ? null : [lon / n, lat / n]
}

/** Dasselbe Feld-Schema wie die Städte davor — plus `scheduleUnknown`. */
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
  scheduleUnknown: true
  spaces: number | null
  maxStayMinutes: number | null
  maxStay: string | null
  maxStayShare: number
  maxStayValues: string[]
  chargingPoints: number
  carsharing: number
}

console.log('Kassel — Daten bauen …')

// ------------------------------------------------------------- Ortsbezirke
//
// Zuerst, weil die Bezirke sie brauchen: Der Feed nennt zu einem
// Bewohnerparkbezirk keinen Stadtteil, nur den Namen.

interface OrtsbezirkProperties {
  OBJECTID?: number | null
  OBZ?: string | null
  OBZ_Name?: string | null
  Shape_Length?: number | null
  Shape_Area?: number | null
}

interface District {
  name: string
  polygons: PolygonRings[]
}

const districts = readJson<Collection<OrtsbezirkProperties>>('districts.json')
if (districts.exceededTransferLimit === true) {
  throw new Error('districts: exceededTransferLimit — der Abruf ist abgeschnitten')
}

const districtFeatures: {
  type: 'Feature'
  properties: { name: string; bezirk: string }
  geometry: Geometry
}[] = []
const districtIndex: District[] = []

for (const feature of districts.features) {
  if (feature.geometry === null) continue
  assertDegrees('districts', feature.geometry.coordinates)
  const name = (feature.properties.OBZ_Name ?? '').trim()
  const nummer = (feature.properties.OBZ ?? '').trim()
  if (name === '' || nummer === '') {
    throw new Error(`districts: Ortsbezirk ${String(feature.properties.OBJECTID)} ohne Namen oder Nummer`)
  }

  // Die Zuordnung läuft gegen die UNvereinfachte Geometrie — vereinfachte
  // Grenzen wandern um ein paar Dutzend Meter, und ein Bezirk an der
  // Ortsbezirksgrenze bekäme sonst den Nachbarn.
  districtIndex.push({ name, polygons: toPolygons(feature.geometry) })

  const simplified = simplifyGeometry(feature.geometry, 1e-4, 5)
  if (simplified === null) continue
  districtFeatures.push({
    type: 'Feature',
    // Kassel hat keine Ebene über dem Ortsbezirk; `bezirk` trägt die
    // amtliche Nummer (`OBZ`), damit das Feld dieselbe Form hat wie sonst.
    properties: { name, bezirk: `Ortsbezirk ${nummer}` },
    geometry: simplified,
  })
}

write('districts.geojson', { type: 'FeatureCollection', features: districtFeatures })

function districtAt(point: Position | null): District | null {
  if (point === null) return null
  return districtIndex.find((district) => multiPolygonContains(district.polygons, point)) ?? null
}

// ------------------------------------------------------------- Bezirke

const identify = readJson<IdentifyResponse>('bezirke.json')
if (identify.error !== undefined) {
  // Ein ArcGIS-Dienst antwortet auch auf einen Fehler mit 200; `fetch.ts`
  // sieht nur, dass etwas kam.
  throw new Error(`bezirke: der Dienst meldet ${identify.error.code ?? '?'} — ${identify.error.message ?? ''}`)
}
const results = identify.results ?? []
if (results.length < Math.floor(BEZIRKE_ERWARTET * 0.95)) {
  throw new Error(
    `bezirke: nur ${results.length} statt ${BEZIRKE_ERWARTET} Bezirke — das ist ein Rückgang, ` +
      'und der ist bei dieser Ebene kein normaler Vorgang. Von Hand nachsehen, bevor ' +
      'BEZIRKE_ERWARTET angepasst wird.'
  )
}

const zoneFeatures: { type: 'Feature'; properties: ZoneOut; geometry: Geometry }[] = []
const counts = { withoutDistrict: 0, withHoles: 0, multipart: 0 }
const kinds = new Map<string, number>()
const districtsHit = new Map<string, number>()
const seen = new Set<string>()

function count(map: Map<string, number>, key: string): void {
  map.set(key, (map.get(key) ?? 0) + 1)
}

for (const result of results) {
  // Eine fremde Ebene im Ergebnis hieße: `layers=all:27` hat nicht gegriffen,
  // und was hier als Bezirk gezeichnet würde, wäre ein Parkhaus oder eine
  // Fahrradzone.
  if (result.layerId !== BEZIRKE_LAYER) {
    throw new Error(`bezirke: Ergebnis aus Ebene ${String(result.layerId)} (${result.layerName ?? '?'}) statt ${BEZIRKE_LAYER}`)
  }
  const name = parseKasselZoneName(result.attributes?.Name)
  if (seen.has(name.key)) throw new Error(`bezirke: Name ${name.key} kommt zweimal vor`)
  seen.add(name.key)
  count(kinds, name.kind)

  const rings = result.geometry?.rings ?? []
  const polygons = esriRingsToPolygons(rings)
  assertDegrees('bezirke', polygons)
  if (polygons.some((polygon) => polygon.length > 1)) counts.withHoles += 1
  if (polygons.length > 1) counts.multipart += 1

  const district = districtAt(centroid(polygons))
  if (district === null) counts.withoutDistrict += 1
  else count(districtsHit, district.name)

  const geometry: Geometry =
    polygons.length === 1
      ? { type: 'Polygon', coordinates: polygons[0] }
      : { type: 'MultiPolygon', coordinates: polygons }
  const simplified = simplifyGeometry(geometry, 1e-5, 5)
  if (simplified === null) continue

  zoneFeatures.push({
    type: 'Feature',
    properties: {
      zone: name.key,
      district: district?.name ?? KASSEL.name,
      rawHours: '',
      rawFee: '',
      note: kasselZoneNote(name),
      windows: [],
      fee: { kind: 'unknown' },
      unmodelledRules: [],
      sourceDefect: null,
      scheduleUnknown: true,
      spaces: null,
      maxStayMinutes: null,
      maxStay: null,
      maxStayShare: 0,
      maxStayValues: [],
      chargingPoints: 0,
      carsharing: 0,
    },
    geometry: simplified,
  })
}

write('zones.geojson', { type: 'FeatureCollection', features: zoneFeatures })

// Zwei leere Sammlungen, damit `loadData` alle fünf Dateien bekommt.
write('poi.geojson', { type: 'FeatureCollection', features: [] })
write('umweltzone.geojson', { type: 'FeatureCollection', features: [] })

write('meta.json', {
  city: KASSEL.key,
  cityName: KASSEL.name,
  source: `${KASSEL.attribution.source}, ArcGIS MapServer (identify)`,
  licence: KASSEL.attribution.licence,
  licenceUrl: KASSEL.attribution.licenceUrl,
  attributionRequired: KASSEL.attribution.attributionRequired,
  datasetUrl: KASSEL.attribution.datasetUrl,
  geprueftAm: geprueftAm(RAW),
  zones: zoneFeatures.length,
  districts: districtFeatures.length,
  poi: 0,
  lowEmissionZone: false,
  segments: 0,
  managedSpaces: 0,
  crs: 'EPSG:4326 (lon/lat)',
  // `schedule` und `fee` zuerst: Das ist die Aussage, die diese Stadt von
  // allen davor unterscheidet.
  absent: ['schedule', 'fee', 'poi', 'umweltzone', 'segments'],
})

// Die Zahlen gehören ins Log: Sie sind das, was beim nächsten Abzug anders
// sein kann, und ein neuer Name ist das erste, was auffällt.
const list = (map: Map<string, number>): string =>
  [...map.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([text, n]) => `  ${n}× ${text}`)
    .join('\n')
console.log(
  `\n${zoneFeatures.length} Bewohnerparkbezirke (${counts.withHoles} mit Loch, ${counts.multipart} mehrteilig), ` +
    `${districtFeatures.length} Ortsbezirke — ${counts.withoutDistrict} ohne Ortsbezirks-Treffer`
)
console.log(`Namensformen:\n${list(kinds)}`)
console.log(`Ortsbezirke der Bezirke:\n${list(districtsHit)}`)
console.log(`Namen: ${[...seen].sort((a, b) => a.localeCompare(b, 'de')).join(', ')}`)
