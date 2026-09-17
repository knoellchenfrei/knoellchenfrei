/**
 * Baut Innsbrucks Daten — das achte Gegenstück zu `build-data.ts`, und das
 * erste für eine Stadt außerhalb Deutschlands.
 *
 * Was Innsbruck **anders** macht als die sieben Städte davor:
 *
 * - **Kein WFS.** Beide Ebenen kommen als GeoJSON aus ArcGIS-FeatureServern
 *   (`sources.ts`, `INNSBRUCK_FILES`), abgerufen mit `f=geojson&outSR=4326`.
 *   Die Achsen kommen als `[lon, lat]`; `assertDegrees` hält es, weil ein
 *   Dienst, der `outSR` eines Tages ignoriert, in Web-Mercator-Metern
 *   antworten würde — plausible Zahlen, nur keine Grade.
 * - **Alles steht in einem Freitextfeld.** `INFO` trägt Zeiten, Betrag,
 *   Tagesdeckel und Tarifsprung; `parseInnsbruckInfo` in `core` zerlegt es.
 *   Ein Gebiet, dessen Text der Parser nicht liest, wird **ausgelassen und
 *   gezählt** — nicht geraten. Bei 21 Zonen ist jede Auslassung im Log ein
 *   Grund nachzusehen.
 * - **Der Schlüssel ist eine Nummer der Quelle.** Der Feed hat keinen
 *   Zonennamen, nur `FID` und eine Art (`BEZEICH`). `FID` ist über den
 *   Abzug eindeutig; ob er über Neuausgaben stabil bleibt, sagt der Feed
 *   nicht — `zone-keys-aktuell.test.ts` bemerkt es, wenn er springt.
 *
 * Was Innsbruck **nicht** hat und andere schon: POI, Umweltzone,
 * Straßenabschnitte. Der Hub führt Behindertenparkplätze und Parkscheinautomaten
 * als Karten, aber nicht als Ebenen mit Sachdaten, die diese App liest. Die
 * drei Dateien werden trotzdem geschrieben, leer: `loadData` in der Web-App
 * holt alle fünf und bricht ab, wenn eine fehlt.
 *
 * Der Stand verfällt am **2. November 2026** mit der neuen
 * Parkabgabeverordnung; `docs/staedte-innsbruck.md` sagt, was dann zu tun ist.
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

import {
  cityByKey,
  innsbruckZoneNote,
  InnsbruckParseError,
  multiPolygonContains,
  parseInnsbruckInfo,
  parseInnsbruckMaxStay,
  type ChargeWindow,
  type Fee,
  type InnsbruckZoneProperties,
  type PolygonRings,
  type Position,
} from '@knoellchenfrei/core'

import { simplifyGeometry } from './simplify.js'
import { geprueftAm } from './abruf-zeit.js'

/**
 * Die Stadt kommt aus `core/city.ts`, nicht aus einer Kopie hier — die
 * Grenzen stehen im Projekt an genau einer Stelle.
 */
const INNSBRUCK = cityByKey('innsbruck')

const RAW = join(process.env.RAW_DIR ?? join(process.cwd(), '../../.raw'), INNSBRUCK.key)
const OUT = join(
  process.env.OUT_DIR ?? join(process.cwd(), '../../apps/web/public/data'),
  INNSBRUCK.key
)

interface Geometry {
  type: string
  coordinates: unknown
}

interface Feature<P> {
  id?: string | number
  properties: P
  geometry: Geometry | null
}

interface Collection<P> {
  features: Feature<P>[]
  /** ArcGIS: gesetzt, wenn der Dienst bei `maxRecordCount` abgeschnitten hat. */
  exceededTransferLimit?: unknown
}

function readFeatures<P>(key: string): Feature<P>[] {
  const path = join(RAW, `${key}.json`)
  const parsed = JSON.parse(readFileSync(path, 'utf8')) as Collection<P>
  // Ein abgeschnittener Abruf sähe sonst aus wie eine kleinere Stadt.
  if (parsed.exceededTransferLimit === true) {
    throw new Error(`${key}: der Dienst hat die Antwort abgeschnitten (exceededTransferLimit)`)
  }
  return parsed.features
}

/**
 * Grade oder nichts.
 *
 * `outSR=4326` verlangt Grade; ohne den Parameter antwortet ein
 * FeatureServer im System der Ebene — hier WGS 84, aber die Stadtteile
 * liegen intern in Web Mercator (`wkid` 102100), und dort hiesse „ohne"
 * `[1268000, 5985000]`. Plausible Zahlen, keine Fehlermeldung, auf der
 * Karte nur leer.
 */
function assertDegrees(key: string, geometry: Geometry): void {
  const walk = (node: unknown): void => {
    if (!Array.isArray(node)) return
    if (typeof node[0] === 'number' && typeof node[1] === 'number') {
      const [lon, lat] = node as number[]
      if (Math.abs(lon as number) > 180 || Math.abs(lat as number) > 90) {
        throw new Error(
          `${key}: ${lon}/${lat} sind keine Grade — der Dienst hat vermutlich in ` +
            'Web Mercator geantwortet. outSR=4326 fehlt in der Anfrage.'
        )
      }
      return
    }
    node.forEach(walk)
  }
  walk(geometry.coordinates)
}

function write(name: string, value: unknown): void {
  const path = join(OUT, name)
  mkdirSync(dirname(path), { recursive: true })
  const json = JSON.stringify(value)
  writeFileSync(path, json)
  console.log(`  ${name}: ${(json.length / 1024).toFixed(0)} KB`)
}

console.log('Innsbruck — Daten bauen …')

// ------------------------------------------------------------- Stadtteile
//
// Zuerst, weil die Zonen sie brauchen: Der Feed nennt zu einer Zone keinen
// Ort, nur eine Nummer und eine Art. Ohne Stadtteil stünde in der Kopfzeile
// des Panels „Zone 138" und sonst nichts.

interface District {
  name: string
  rings: PolygonRings[]
}

function toPolygons(geometry: Geometry): PolygonRings[] {
  if (geometry.type === 'Polygon') return [geometry.coordinates as PolygonRings]
  if (geometry.type === 'MultiPolygon') return geometry.coordinates as PolygonRings[]
  return []
}

interface DistrictProperties {
  OBJECTID?: number | null
  STNEU?: number | null
  Stadtteil_1?: string | null
  Area_km2?: number | null
}

const districtFeatures: { type: 'Feature'; properties: { name: string }; geometry: Geometry }[] = []
const districtIndex: District[] = []

for (const feature of readFeatures<DistrictProperties>('districts')) {
  const geometry = feature.geometry
  if (geometry === null) continue
  assertDegrees('districts', geometry)
  const name = (feature.properties.Stadtteil_1 ?? '').replace(/\s+/g, ' ').trim()
  if (name === '') throw new Error(`districts: Stadtteil ${String(feature.properties.OBJECTID)} ohne Namen`)

  // Die Zuordnung läuft gegen die UNvereinfachte Geometrie. Vereinfachte
  // Grenzen wandern um bis zu ein paar Dutzend Meter, und eine Zone an der
  // Stadtteilgrenze bekäme sonst den Nachbarn zugeschrieben.
  districtIndex.push({ name, rings: toPolygons(geometry) })

  const simplified = simplifyGeometry(geometry, 1e-4, 5)
  if (simplified === null) continue
  districtFeatures.push({ type: 'Feature', properties: { name }, geometry: simplified })
}

write('districts.geojson', { type: 'FeatureCollection', features: districtFeatures })

/** Mittelpunkt aller Stützpunkte — reicht, um einen Stadtteil zu treffen. */
function centroid(geometry: Geometry): Position | null {
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
  if (points.length === 0) return null
  let lon = 0
  let lat = 0
  for (const point of points) {
    lon += point[0]
    lat += point[1]
  }
  return [lon / points.length, lat / points.length]
}

function districtAt(point: Position | null): District | null {
  if (point === null) return null
  return districtIndex.find((district) => multiPolygonContains(district.rings, point)) ?? null
}

// ------------------------------------------------------------------ Zonen

/** Dasselbe Feld-Schema wie die anderen Städte; Begründung in `build-data-hamburg.ts`. */
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

const rawZones = readFeatures<InnsbruckZoneProperties>('zones')
const zoneFeatures: { type: 'Feature'; properties: ZoneOut; geometry: Geometry }[] = []
const unreadable: string[] = []
let withoutDistrict = 0
let seasonal = 0
const seenKeys = new Set<string>()

for (const feature of rawZones) {
  const p = feature.properties
  const zone = String(p.FID ?? feature.id ?? '')
  if (zone === '') throw new Error('zones: eine Zone ohne FID — der Feed hat keinen anderen Schlüssel')
  if (seenKeys.has(zone)) throw new Error(`zones: FID ${zone} kommt zweimal vor`)
  seenKeys.add(zone)

  const geometry = feature.geometry
  if (geometry === null) continue
  assertDegrees('zones', geometry)

  const info = (p.INFO ?? '').trim()
  let parsed
  let maxStay
  try {
    parsed = parseInnsbruckInfo(info)
    maxStay = parseInnsbruckMaxStay(p.BEZEICH)
  } catch (error) {
    // Nur die eigene Fehlerklasse ist „unlesbare Zeile"; alles andere ist ein
    // kaputter Parser und soll den Lauf abbrechen.
    if (!(error instanceof InnsbruckParseError)) throw error
    unreadable.push(`FID ${zone}: ${error.message}`)
    continue
  }
  if (parsed.unmodelledRules.length > 0) seasonal += 1

  const district = districtAt(centroid(geometry))
  if (district === null) withoutDistrict += 1

  const simplified = simplifyGeometry(geometry, 1e-5, 5)
  if (simplified === null) continue

  zoneFeatures.push({
    type: 'Feature',
    properties: {
      zone,
      district: district?.name ?? INNSBRUCK.name,
      rawHours: parsed.rawHours,
      rawFee: parsed.rawFee,
      note: innsbruckZoneNote(p, parsed),
      windows: parsed.windows,
      fee: parsed.fee,
      unmodelledRules: parsed.unmodelledRules,
      sourceDefect: null,
      spaces: null,
      maxStayMinutes: maxStay ?? null,
      maxStay: null,
      maxStayShare: 0,
      maxStayValues: [],
      chargingPoints: 0,
      carsharing: 0,
    },
    geometry: simplified,
  })
}

// Bei 21 Zonen ist jede unlesbare eine, die jemand ansehen soll — deshalb
// nicht nur zählen, sondern nennen. Abbrechen wäre die andere Wahl; sie
// hiesse, dass eine einzige neue Formulierung im Feed die ganze Stadt aus dem
// Deploy nimmt, statt eine Zone.
for (const line of unreadable) console.warn(`  ausgelassen: ${line}`)

write('zones.geojson', { type: 'FeatureCollection', features: zoneFeatures })

// ------------------------------------------------------- was es nicht gibt

write('poi.geojson', { type: 'FeatureCollection', features: [] })
write('umweltzone.geojson', { type: 'FeatureCollection', features: [] })

write('meta.json', {
  city: INNSBRUCK.key,
  cityName: INNSBRUCK.name,
  source: `${INNSBRUCK.attribution.source}, ArcGIS FeatureServer (geoHub Innsbruck)`,
  licence: INNSBRUCK.attribution.licence,
  licenceUrl: INNSBRUCK.attribution.licenceUrl,
  attributionRequired: INNSBRUCK.attribution.attributionRequired,
  datasetUrl: INNSBRUCK.attribution.datasetUrl,
  geprueftAm: geprueftAm(RAW),
  zones: zoneFeatures.length,
  districts: districtFeatures.length,
  poi: 0,
  lowEmissionZone: false,
  segments: 0,
  managedSpaces: 0,
  crs: 'EPSG:4326 (lon/lat)',
  absent: ['poi', 'umweltzone', 'segments'],
})

console.log(
  `\n${zoneFeatures.length} von ${rawZones.length} Zonen übernommen, ${districtFeatures.length} Stadtteile` +
    ` — ${unreadable.length} unlesbar ausgelassen, ${seasonal} mit Saisonregel` +
    `, ${withoutDistrict} ohne Stadtteil-Treffer`
)
