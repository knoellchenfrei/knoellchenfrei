/**
 * Baut Berns Daten — das Gegenstück zu `build-data.ts` für die erste Stadt
 * in der Schweiz und die erste der **Klasse C**.
 *
 * Was Bern **anders** macht als alle Städte davor:
 *
 * - **Die Quelle nennt weder Zeiten noch Beträge.** Die 42 Parkkartenzonen
 *   sagen, wo eine Anwohner-Parkkarte gilt — nicht, wann die Parkscheibe
 *   läuft oder was die Parkuhr kostet. Jede Zone bekommt deshalb
 *   `scheduleUnknown: true`, `windows: []` und `fee: { kind: 'unknown' }`,
 *   `meta.absent` führt `schedule` und `fee`. Die App sagt „Zeiten
 *   unbekannt" und färbt grau. Ein Fenster zu erfinden — etwa die Blaue
 *   Zone der Signalisationsverordnung — wäre eine Aussage über das Recht,
 *   nicht über die Daten; sie steht als Zitat in `docs/staedte-bern.md`.
 * - **Kein WFS, sondern ein ArcGIS-MapServer** in LV95. `outSR=4326` in der
 *   Abfrage, `assertDegrees` hier — ohne den Parameter kämen Meter um
 *   2.600.000 / 1.200.000, plausible Zahlen, auf der Karte nur leer.
 * - **Acht Flächen ohne eine einzige Sachangabe.** Kein Name, keine Art,
 *   kein Hinweis; fünf davon liegen in benannten Zonen. Sie werden
 *   ausgelassen und gezählt. Eine Fläche mit Art, aber ohne Namen, wäre ein
 *   neuer Fall und bricht den Bau ab.
 * - **Der Zonenname steht zweimal** (`PKZ_name` und `PLZ_beschrieb` +
 *   `PLZ_zusatz_beschrieb`); beide werden gelesen, und laufen sie
 *   auseinander, bricht der Bau ab — wie Graz' doppelte Höchstparkdauer.
 *
 * Was Bern **nicht** hat: POI, Umweltzone, Straßenabschnitte. Die
 * Parkfeld-Ebenen des Dienstes `Parkplaetze_oeffentlich` (455
 * gebührenpflichtige, 3.002 blaue, 469 und 81 weisse Felder) tragen auch
 * keine Zeiten und Beträge; sie bleiben für später. Die drei Dateien werden
 * trotzdem geschrieben, leer, damit `loadData` alle fünf bekommt.
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

import {
  BernParseError,
  bernZoneNameFromPlz,
  bernZoneNote,
  cityByKey,
  isBernZoneUnattributed,
  multiPolygonContains,
  parseBernFieldType,
  parseBernInfo,
  parseBernZoneName,
  type BernZoneProperties,
  type ChargeWindow,
  type Fee,
  type PolygonRings,
  type Position,
} from '@knoellchenfrei/core'

import { simplifyGeometry } from './simplify.js'
import { geprueftAm } from './abruf-zeit.js'

/** Die Stadt kommt aus `core/city.ts` — die Grenzen stehen im Projekt genau einmal. */
const BERN = cityByKey('bern')

const RAW = join(process.env.RAW_DIR ?? join(process.cwd(), '../../.raw'), BERN.key)
const OUT = join(process.env.OUT_DIR ?? join(process.cwd(), '../../apps/web/public/data'), BERN.key)

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
  const parsed = JSON.parse(readFileSync(join(RAW, `${key}.json`), 'utf8')) as Collection<P>
  // Ein abgeschnittener Abruf sähe sonst aus wie eine kleinere Stadt.
  if (parsed.exceededTransferLimit === true) {
    throw new Error(`${key}: der Dienst hat die Antwort abgeschnitten (exceededTransferLimit)`)
  }
  return parsed.features
}

/**
 * Grade oder nichts.
 *
 * Der Dienst liegt in LV95 (`wkid` 2056). Ohne `outSR=4326` antwortet er
 * darin: `[2600000, 1200000]` — plausible Zahlen, keine Fehlermeldung, auf
 * der Karte nur leer. Dieselbe Falle wie Frankfurts UTM.
 */
function assertDegrees(key: string, geometry: Geometry): void {
  const walk = (node: unknown): void => {
    if (!Array.isArray(node)) return
    if (typeof node[0] === 'number' && typeof node[1] === 'number') {
      const [lon, lat] = node as number[]
      if (Math.abs(lon as number) > 180 || Math.abs(lat as number) > 90) {
        throw new Error(
          `${key}: ${lon}/${lat} sind keine Grade — der Dienst hat vermutlich in LV95 ` +
            '(wkid 2056) geantwortet. outSR=4326 fehlt in der Anfrage.'
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

function toPolygons(geometry: Geometry): PolygonRings[] {
  if (geometry.type === 'Polygon') return [geometry.coordinates as PolygonRings]
  if (geometry.type === 'MultiPolygon') return geometry.coordinates as PolygonRings[]
  return []
}

/** Mittelpunkt aller Stützpunkte — reicht, um einen Bezirk zu treffen. */
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

console.log('Bern — Daten bauen …')

// ------------------------------------------------------ Bezirke, Stadtteile
//
// Zuerst, weil die Zonen sie brauchen: Der Feed nennt zu einer Zone nur eine
// Postleitzahl. Ohne Bezirk stünde in der Kopfzeile „Parkkartenzone 3006"
// und sonst nichts. Die statistischen Bezirke tragen die Kennung ihres
// Stadtteils (`Stadtteil_fid`); der Stadtteil wird als `bezirk` mitgegeben,
// wie in Hamburg.

interface StadtteilProperties {
  Nummer?: number | null
  Nummer_roem?: string | null
  Name?: string | null
  'PG_KQU.PG_O.vgp__Stadtteile__Stadtteil_1.fid'?: string | null
}

interface BezirkProperties {
  Nummer?: number | null
  Name?: string | null
  Stadtteil_fid?: string | null
}

const stadtteilByFid = new Map<string, string>()
for (const feature of readFeatures<StadtteilProperties>('stadtteile')) {
  const fid = feature.properties['PG_KQU.PG_O.vgp__Stadtteile__Stadtteil_1.fid'] ?? ''
  const name = (feature.properties.Name ?? '').replace(/\s+/g, ' ').trim()
  if (fid === '' || name === '') {
    throw new Error(`stadtteile: Stadtteil ${String(feature.properties.Nummer)} ohne Kennung oder Namen`)
  }
  stadtteilByFid.set(fid, `Stadtteil ${feature.properties.Nummer_roem ?? '?'} ${name}`)
}
if (stadtteilByFid.size !== 6) throw new Error(`stadtteile: ${stadtteilByFid.size} statt 6 Stadtteile`)

interface District {
  name: string
  rings: PolygonRings[]
}

const districtFeatures: {
  type: 'Feature'
  properties: { name: string; bezirk: string }
  geometry: Geometry
}[] = []
const districtIndex: District[] = []

for (const feature of readFeatures<BezirkProperties>('districts')) {
  const geometry = feature.geometry
  if (geometry === null) continue
  assertDegrees('districts', geometry)
  const name = (feature.properties.Name ?? '').replace(/\s+/g, ' ').trim()
  if (name === '') throw new Error(`districts: Bezirk ${String(feature.properties.Nummer)} ohne Namen`)
  const stadtteil = stadtteilByFid.get(feature.properties.Stadtteil_fid ?? '')
  if (stadtteil === undefined) {
    throw new Error(`districts: Bezirk ${name} verweist auf einen unbekannten Stadtteil`)
  }

  // Die Zuordnung läuft gegen die UNvereinfachte Geometrie: Vereinfachte
  // Grenzen wandern um ein paar Dutzend Meter, und eine Zone an der
  // Bezirksgrenze bekäme sonst den Nachbarn.
  districtIndex.push({ name, rings: toPolygons(geometry) })

  const simplified = simplifyGeometry(geometry, 1e-4, 5)
  if (simplified === null) continue
  districtFeatures.push({ type: 'Feature', properties: { name, bezirk: stadtteil }, geometry: simplified })
}

write('districts.geojson', { type: 'FeatureCollection', features: districtFeatures })

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
  scheduleUnknown: true
  spaces: number | null
  maxStayMinutes: number | null
  maxStay: string | null
  maxStayShare: number
  maxStayValues: string[]
  chargingPoints: number
  carsharing: number
}

const rawZones = readFeatures<BernZoneProperties>('zones')
const zoneFeatures: { type: 'Feature'; properties: ZoneOut; geometry: Geometry }[] = []
const unattributed: string[] = []
const unreadable: string[] = []
const counts = { blau: 0, weiss: 0, sonntags: 0, withoutDistrict: 0 }
const infos = new Map<string, number>()

for (const feature of rawZones) {
  const p = feature.properties
  const objectId = String(p.Objectid ?? feature.id ?? '?')
  if (isBernZoneUnattributed(p)) {
    unattributed.push(objectId)
    continue
  }

  const geometry = feature.geometry
  if (geometry === null) continue
  assertDegrees('zones', geometry)

  infos.set(p.Info_beschrieb ?? '(leer)', (infos.get(p.Info_beschrieb ?? '(leer)') ?? 0) + 1)

  let zone: string
  let kind
  let rule: string | null
  try {
    zone = parseBernZoneName(p.PKZ_name ?? '')
    // Die zweite Schreibweise desselben Namens muss dieselbe sein.
    const fromPlz = bernZoneNameFromPlz(p.PLZ_beschrieb ?? '', p.PLZ_zusatz_beschrieb ?? '')
    if (fromPlz !== zone) {
      throw new Error(`zones: Objectid ${objectId} heißt ${zone}, PLZ und Zusatz ergeben ${fromPlz}`)
    }
    kind = parseBernFieldType(p.Parkfeld_typ_beschrieb ?? '')
    rule = parseBernInfo(p.Info_beschrieb ?? '')
  } catch (error) {
    // Nur die eigene Fehlerklasse ist „unlesbare Zeile"; alles andere ist ein
    // kaputter Parser oder ein widersprüchlicher Feed und bricht den Lauf ab.
    if (!(error instanceof BernParseError)) throw error
    unreadable.push(`Objectid ${objectId}: ${error.message}`)
    continue
  }
  counts[kind] += 1
  if (rule !== null) counts.sonntags += 1

  const district = districtAt(centroid(geometry))
  if (district === null) counts.withoutDistrict += 1

  const simplified = simplifyGeometry(geometry, 1e-5, 5)
  if (simplified === null) continue

  zoneFeatures.push({
    type: 'Feature',
    properties: {
      zone,
      district: district?.name ?? BERN.name,
      // Leer, nicht erfunden: Der Feed hat kein Zeit- und kein Gebührenfeld.
      rawHours: '',
      rawFee: '',
      note: bernZoneNote(kind, rule),
      windows: [],
      fee: { kind: 'unknown' },
      unmodelledRules: rule === null ? [] : [rule],
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

// Bei 42 Flächen ist jede ausgelassene eine, die jemand ansehen soll —
// deshalb nicht nur zählen, sondern nennen.
for (const line of unreadable) console.warn(`  unlesbar ausgelassen: ${line}`)
if (unattributed.length > 0) {
  console.warn(`  ohne Sachangaben ausgelassen: Objectid ${unattributed.join(', ')}`)
}
if (zoneFeatures.length === 0) throw new Error('zones: keine einzige Zone übernommen')

write('zones.geojson', { type: 'FeatureCollection', features: zoneFeatures })

// ------------------------------------------------------- was es nicht gibt

write('poi.geojson', { type: 'FeatureCollection', features: [] })
write('umweltzone.geojson', { type: 'FeatureCollection', features: [] })

write('meta.json', {
  city: BERN.key,
  cityName: BERN.name,
  source: `${BERN.attribution.source}, ArcGIS MapServer (map.bern.ch)`,
  licence: BERN.attribution.licence,
  licenceUrl: BERN.attribution.licenceUrl,
  attributionRequired: BERN.attribution.attributionRequired,
  datasetUrl: BERN.attribution.datasetUrl,
  geprueftAm: geprueftAm(RAW),
  zones: zoneFeatures.length,
  districts: districtFeatures.length,
  poi: 0,
  lowEmissionZone: false,
  segments: 0,
  managedSpaces: 0,
  crs: 'EPSG:4326 (lon/lat)',
  // `schedule` und `fee`: Klasse C — die Quelle nennt beides nicht.
  absent: ['schedule', 'fee', 'poi', 'umweltzone', 'segments'],
})

console.log(
  `\n${zoneFeatures.length} von ${rawZones.length} Flächen übernommen (${counts.blau} blau, ${counts.weiss} weiss, ` +
    `${counts.sonntags} mit „Auch Sonntags"), ${districtFeatures.length} Bezirke — ` +
    `${unattributed.length} ohne Sachangaben und ${unreadable.length} unlesbar ausgelassen, ` +
    `${counts.withoutDistrict} ohne Bezirks-Treffer\n  Hinweise der Quelle: ${[...infos.entries()]
      .map(([text, n]) => `${text} ×${n}`)
      .join(', ')}`
)
