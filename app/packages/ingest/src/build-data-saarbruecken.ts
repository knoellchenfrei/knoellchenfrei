/**
 * Baut Saarbrückens Daten — die erste Stadt im Saarland und die erste
 * deutsche Stadt der **Klasse C**.
 *
 * Was Saarbrücken **anders** macht als alle Städte davor:
 *
 * - **Die Flächen tragen kein Attribut.** `parkzonen_fl.geojson` hat 27
 *   MultiPolygone mit den Sachdaten `{"ID": 0}`, sonst nichts; die
 *   Zonenbuchstaben liegen als CAD-Beschriftung in einer zweiten Datei mit
 *   30 Punkten (27 mit Text, drei leere auf demselben Punkt). Der Bau legt
 *   jeden beschrifteten Punkt in die Flächen und verlangt **genau einen**
 *   Punkt je Fläche und genau eine Fläche je Punkt: Eine Fläche ohne Punkt
 *   wäre eine Zone ohne Namen, zwei Punkte in einer Fläche wären zwei Zonen
 *   in einer, und beides würde der Datenbau sonst stillschweigend zu einer
 *   Auskunft machen. Am 17. September 2026: 27 zu 27, eins zu eins.
 * - **Die Quelle nennt weder Zeiten noch Beträge.** Jede Zone bekommt
 *   `scheduleUnknown: true`, `windows: []` und `fee: { kind: 'unknown' }`,
 *   `meta.absent` führt `schedule` und `fee`. Die Gebührenordnung der Stadt
 *   regelt die Kurzparkzonen, nicht die Bewohnerparkzonen — sie steht als
 *   Zitat in `docs/staedte-saarbruecken.md`, nicht hier.
 * - **Die Stadtteile kommen genauso paarweise**: 20 Flächen ohne Attribut,
 *   20 Beschriftungen `11 Alt-Saarbrücken`, dazu eine dritte Koordinate
 *   `0.0` an jedem Stützpunkt, die `simplifyGeometry` beim Runden abstreift.
 *   Der Stadtbezirk (Mitte, West, Dudweiler, Halberg) kommt aus der Nummer
 *   und wird gegen den Namen geprüft (`parseSaarbrueckenStadtteil`).
 *
 * Was Saarbrücken **nicht** hat: POI, Umweltzone, Straßenabschnitte. Die
 * Dateien werden trotzdem geschrieben, leer, damit `loadData` alle fünf
 * bekommt.
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

import {
  SaarbrueckenParseError,
  cityByKey,
  isSaarbrueckenLabelEmpty,
  multiPolygonContains,
  parseSaarbrueckenStadtteil,
  parseSaarbrueckenZoneLabel,
  saarbrueckenZoneNote,
  type ChargeWindow,
  type Fee,
  type PolygonRings,
  type Position,
  type SaarbrueckenLabelProperties,
  type SaarbrueckenStadtteilLabelProperties,
  type SaarbrueckenZoneProperties,
} from '@knoellchenfrei/core'

import { simplifyGeometry } from './simplify.js'
import { geprueftAm } from './abruf-zeit.js'

/** Die Stadt kommt aus `core/city.ts` — die Grenzen stehen im Projekt genau einmal. */
const SAARBRUECKEN = cityByKey('saarbruecken')

const RAW = join(process.env.RAW_DIR ?? join(process.cwd(), '../../.raw'), SAARBRUECKEN.key)
const OUT = join(process.env.OUT_DIR ?? join(process.cwd(), '../../apps/web/public/data'), SAARBRUECKEN.key)

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
}

function readFeatures<P>(key: string): Feature<P>[] {
  return (JSON.parse(readFileSync(join(RAW, `${key}.json`), 'utf8')) as Collection<P>).features
}

/**
 * Grade oder nichts.
 *
 * Die Dateien tragen kein `crs`-Feld. Die Beschriftungen führen daneben
 * UTM-Werte als Sachdaten (`PGIS_R: 359302.683`) — käme die Geometrie
 * einmal genauso, wären das plausible Zahlen, auf der Karte nur leer.
 */
function assertDegrees(key: string, geometry: Geometry): void {
  const walk = (node: unknown): void => {
    if (!Array.isArray(node)) return
    if (typeof node[0] === 'number' && typeof node[1] === 'number') {
      const [lon, lat] = node as number[]
      if (Math.abs(lon as number) > 180 || Math.abs(lat as number) > 90) {
        throw new Error(`${key}: ${lon}/${lat} sind keine Grade — die Datei ist vermutlich in UTM (EPSG:25832).`)
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

/** Die Ringe eines (Multi-)Polygons, auf zwei Koordinaten gekürzt — die Stadtteile tragen eine dritte. */
function toPolygons(geometry: Geometry): PolygonRings[] {
  const strip = (polygon: number[][][]): PolygonRings =>
    polygon.map((ring) => ring.map((point): Position => [point[0] as number, point[1] as number]))
  if (geometry.type === 'Polygon') return [strip(geometry.coordinates as number[][][])]
  if (geometry.type === 'MultiPolygon') return (geometry.coordinates as number[][][][]).map(strip)
  return []
}

function pointOf(geometry: Geometry | null): Position | null {
  if (geometry === null || geometry.type !== 'Point') return null
  const [lon, lat] = geometry.coordinates as number[]
  if (typeof lon !== 'number' || typeof lat !== 'number') return null
  return [lon, lat]
}

/** Mittelpunkt aller Stützpunkte — reicht, um einen Stadtteil zu treffen. */
function centroid(rings: readonly PolygonRings[]): Position | null {
  let lon = 0
  let lat = 0
  let n = 0
  for (const polygon of rings) {
    for (const point of polygon[0] ?? []) {
      lon += point[0]
      lat += point[1]
      n += 1
    }
  }
  return n === 0 ? null : [lon / n, lat / n]
}

/**
 * Legt Beschriftungspunkte in Flächen und verlangt eine Eins-zu-eins-
 * Zuordnung. Beide Richtungen werden geprüft, weil beide Fehler leise
 * wären: Eine Fläche ohne Punkt fiele sonst als namenlose Zone auf die
 * Karte, ein Punkt ohne Fläche wäre eine Zone, die es laut Quelle gibt
 * und die niemand sieht.
 */
function matchLabels(
  what: string,
  areas: readonly { rings: PolygonRings[] }[],
  labels: readonly { text: string; point: Position }[]
): string[] {
  const byArea: string[][] = areas.map(() => [])
  for (const label of labels) {
    const hits = areas.map((area, i) => (multiPolygonContains(area.rings, label.point) ? i : -1)).filter((i) => i >= 0)
    if (hits.length !== 1) {
      throw new Error(`${what}: Beschriftung ${label.text} liegt in ${hits.length} Flächen statt in genau einer`)
    }
    ;(byArea[hits[0] as number] as string[]).push(label.text)
  }
  return byArea.map((texts, i) => {
    if (texts.length !== 1) {
      throw new Error(`${what}: Fläche ${i} trägt ${texts.length} Beschriftungen (${texts.join(', ')}) statt genau einer`)
    }
    return texts[0] as string
  })
}

console.log('Saarbrücken — Daten bauen …')

// ------------------------------------------------------------- Stadtteile
//
// Zuerst, weil die Zonen sie brauchen: Die Zonenbeschriftung ist ein
// Buchstabe, und ohne Stadtteil stünde in der Kopfzeile „Parkzone A1" und
// sonst nichts. Der Bezirk wird als `bezirk` mitgegeben, wie in Hamburg.

const districtAreas = readFeatures<SaarbrueckenZoneProperties>('districts').map((feature, i) => {
  if (feature.geometry === null) throw new Error(`districts: Fläche ${i} ohne Geometrie`)
  assertDegrees('districts', feature.geometry)
  return { rings: toPolygons(feature.geometry), geometry: feature.geometry }
})

const districtLabels = readFeatures<SaarbrueckenStadtteilLabelProperties>('districtLabels').flatMap((feature) => {
  const text = (feature.properties.PGIS_TXT ?? '').trim()
  const point = pointOf(feature.geometry)
  if (text === '' || point === null) throw new Error('districtLabels: Beschriftung ohne Text oder ohne Punkt')
  return [{ text, point }]
})

const stadtteilTexts = matchLabels('stadtteile', districtAreas, districtLabels)

interface District {
  name: string
  bezirk: string
  rings: PolygonRings[]
}

const districtIndex: District[] = []
const districtFeatures: {
  type: 'Feature'
  properties: { name: string; bezirk: string }
  geometry: Geometry
}[] = []

for (const [i, area] of districtAreas.entries()) {
  // Ein unlesbarer Stadtteil bricht den Bau ab: Bei 20 Namen, die alle
  // gegen die Bezirksliste der Stadt geprüft sind, ist jeder Fehler einer,
  // den jemand ansehen soll — nicht einer, der leise ausgelassen wird.
  const stadtteil = parseSaarbrueckenStadtteil(stadtteilTexts[i] as string)
  const bezirk = `Stadtbezirk ${stadtteil.bezirk}`
  // Die Zuordnung der Zonen läuft gegen die UNvereinfachte Geometrie.
  districtIndex.push({ name: stadtteil.name, bezirk, rings: area.rings })
  const simplified = simplifyGeometry(area.geometry, 1e-4, 5)
  if (simplified === null) continue
  districtFeatures.push({ type: 'Feature', properties: { name: stadtteil.name, bezirk }, geometry: simplified })
}
if (districtFeatures.length !== 20) throw new Error(`stadtteile: ${districtFeatures.length} statt 20 Stadtteile`)

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

const zoneAreas = readFeatures<SaarbrueckenZoneProperties>('zones').map((feature, i) => {
  if (feature.geometry === null) throw new Error(`zones: Fläche ${i} ohne Geometrie`)
  assertDegrees('zones', feature.geometry)
  return { rings: toPolygons(feature.geometry), geometry: feature.geometry }
})

const rawLabels = readFeatures<SaarbrueckenLabelProperties>('zoneLabels')
const emptyLabels = rawLabels.filter((feature) => isSaarbrueckenLabelEmpty(feature.properties)).length
const zoneLabels = rawLabels.flatMap((feature) => {
  if (isSaarbrueckenLabelEmpty(feature.properties)) return []
  const point = pointOf(feature.geometry)
  if (point === null) throw new Error(`zoneLabels: Beschriftung ${String(feature.properties.Text)} ohne Punkt`)
  let text: string
  try {
    text = parseSaarbrueckenZoneLabel(feature.properties.Text ?? '')
  } catch (error) {
    // Nur die eigene Fehlerklasse ist „unlesbare Beschriftung"; alles andere
    // ist ein kaputter Parser und bricht den Lauf ab. Und auch die eigene
    // bricht ab: Eine Beschriftung, die nicht lesbar ist, hinterliesse eine
    // Fläche ohne Namen, und die soll nicht leise ausfallen.
    if (!(error instanceof SaarbrueckenParseError)) throw error
    throw new Error(`zoneLabels: ${error.message}`)
  }
  return [{ text, point }]
})

const seen = new Set<string>()
for (const label of zoneLabels) {
  if (seen.has(label.text)) throw new Error(`zoneLabels: Beschriftung ${label.text} kommt zweimal vor`)
  seen.add(label.text)
}

const zoneTexts = matchLabels('zonen', zoneAreas, zoneLabels)

const zoneFeatures: { type: 'Feature'; properties: ZoneOut; geometry: Geometry }[] = []
const stadtteile = new Map<string, number>()
let withoutDistrict = 0

for (const [i, area] of zoneAreas.entries()) {
  const zone = zoneTexts[i] as string
  const district = districtAt(centroid(area.rings))
  if (district === null) withoutDistrict += 1
  const name = district?.name ?? SAARBRUECKEN.name
  stadtteile.set(name, (stadtteile.get(name) ?? 0) + 1)

  const simplified = simplifyGeometry(area.geometry, 1e-5, 5)
  if (simplified === null) throw new Error(`zones: Fläche ${zone} fällt beim Vereinfachen weg`)

  zoneFeatures.push({
    type: 'Feature',
    properties: {
      zone,
      district: name,
      // Leer, nicht erfunden: Der Feed hat kein Zeit- und kein Gebührenfeld.
      rawHours: '',
      rawFee: '',
      note: saarbrueckenZoneNote(zone),
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

if (zoneFeatures.length === 0) throw new Error('zones: keine einzige Zone übernommen')

write('zones.geojson', { type: 'FeatureCollection', features: zoneFeatures })

// ------------------------------------------------------- was es nicht gibt

write('poi.geojson', { type: 'FeatureCollection', features: [] })
write('umweltzone.geojson', { type: 'FeatureCollection', features: [] })

write('meta.json', {
  city: SAARBRUECKEN.key,
  cityName: SAARBRUECKEN.name,
  source: `${SAARBRUECKEN.attribution.source}, GeoJSON aus dem CKAN der Stadt`,
  licence: SAARBRUECKEN.attribution.licence,
  licenceUrl: SAARBRUECKEN.attribution.licenceUrl,
  attributionRequired: SAARBRUECKEN.attribution.attributionRequired,
  datasetUrl: SAARBRUECKEN.attribution.datasetUrl,
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
  `\n${zoneFeatures.length} Zonen aus ${zoneAreas.length} Flächen und ${zoneLabels.length} Beschriftungen ` +
    `(${emptyLabels} leere Beschriftungen übergangen), ${districtFeatures.length} Stadtteile — ` +
    `${withoutDistrict} Zonen ohne Stadtteil-Treffer\n  Zonen je Stadtteil: ${[...stadtteile.entries()]
      .map(([name, n]) => `${name} ×${n}`)
      .join(', ')}`
)
