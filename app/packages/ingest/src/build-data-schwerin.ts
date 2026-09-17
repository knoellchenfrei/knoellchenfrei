/**
 * Baut Schwerins Daten — das achte Gegenstück zu `build-data.ts`.
 *
 * Acht Skripte statt eines mit acht Zweigen, aus demselben Grund wie immer:
 * Die Feeds teilen sich außer dem Wort „Parken" nichts.
 *
 * Was Schwerin **anders** macht als alle sieben Städte davor:
 *
 * - **Die Antwort ist GML, nicht GeoJSON.** Der Dienst kennt kein JSON;
 *   `fetch.ts` legt `.gml` ab, und `gml.ts` liest es hier. Begründung und
 *   Messung stehen dort.
 * - **Die Antwort ist in UTM, und zwar Zone 33.** Jedes andere `srsName`
 *   endet in `Invalid SRS`. `assertUtm` prüft, dass wirklich Meter ankommen,
 *   `utm.ts` rechnet um, `assertDegrees` prüft das Ergebnis — dieselbe
 *   doppelte Prüfung wie in Köln, nur in der anderen Zone.
 * - **Die Zonenpolygone tragen kein einziges Attribut.** Ihre Namen kommen
 *   aus `SCHWERIN_ZONE_ANCHORS` in `core` — der Messung gegen die
 *   Kartendarstellung des Dienstes. Fällt ein Anker aus seiner Fläche, bricht
 *   der Lauf ab, statt einen Buchstaben zu raten.
 * - **Die Zonen liegen übereinander.** `A/C` liegt in `A`, `A/F` überlappt
 *   `F`, `A/D` überlappt `D`. Ausgeliefert wird nach Fläche aufsteigend,
 *   damit `zoneAt` in der App — „erste Fläche, die den Punkt enthält" — die
 *   Mischfläche findet und nicht die Grundzone darunter. Ein Automat in
 *   beiden zählt für beide.
 *
 * Wie in Frankfurt hängen Tarif, Zeiten und Höchstparkdauer am Automaten;
 * was für eine Zone gilt, entsteht durch Zusammenlegen der Automaten darin.
 * Was Schwerin **nicht** hat: Umweltzone (es gibt in Mecklenburg-Vorpommern
 * keine), Straßenabschnitte, Stellplatzzahlen, Ladepunkte, Carsharing, P+R
 * (`masterportal:P_and_R` ist leer).
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

import {
  SCHWERIN,
  areaSquareMetres,
  mergeSchwerinFees,
  mergeSchwerinWindows,
  multiPolygonContains,
  parseSchwerinFee,
  parseSchwerinMaxStay,
  parseSchwerinSchedule,
  schwerinAutomatNote,
  schwerinMaxStayCode,
  schwerinZoneLetters,
  withinBounds,
  type BoundingBox,
  type ChargeWindow,
  type Fee,
  type PolygonRings,
  type Position,
  type SchwerinAutomatProperties,
} from '@knoellchenfrei/core'

import { citySources } from './sources.js'
import { parseWfsGml, type GmlFeature, type GmlGeometry } from './gml.js'
import { roundPoint, simplifyGeometry } from './simplify.js'
import { geprueftAm } from './abruf-zeit.js'
import { utmCoordinatesToWgs84 } from './utm.js'

const RAW = join(process.env.RAW_DIR ?? join(process.cwd(), '../../.raw'), SCHWERIN.key)
const OUT = join(process.env.OUT_DIR ?? join(process.cwd(), '../../apps/web/public/data'), SCHWERIN.key)

/** Die Zone, in der Schwerin liegt — 11,3° bis 11,5° Ost, also 12° bis 18°. */
const UTM_ZONE = 33

interface Geometry {
  type: string
  coordinates: unknown
}

const SOURCES = citySources(SCHWERIN.key)

/**
 * Was der Dienst als Koordinatensystem *sagen* muss, damit hier gerechnet
 * wird. `sources.ts` fragt genau das an; steht in der Antwort etwas anderes,
 * hat der Dienst die Anfrage nicht beachtet, und `assertUtm` allein könnte
 * Zone 32 nicht von 33 unterscheiden — beide sind plausible Meter.
 */
const EXPECTED_SRS = 'urn:ogc:def:crs:EPSG::25833'

function readGml(key: string): GmlFeature[] {
  const source = SOURCES.find((candidate) => candidate.key === key)
  if (source === undefined) throw new Error(`Keine Quelle "${key}" für Schwerin`)
  if (source.srsName !== EXPECTED_SRS) {
    throw new Error(`${key}: sources.ts fragt ${source.srsName ?? 'Grad'} an, dieses Skript rechnet aus ${EXPECTED_SRS}`)
  }
  const collection = parseWfsGml(readFileSync(join(RAW, `${key}.gml`), 'utf8'))
  if (collection.srsName !== EXPECTED_SRS) {
    throw new Error(
      `${key}: die Antwort nennt ${collection.srsName ?? 'kein'} Koordinatensystem statt ${EXPECTED_SRS} — ` +
        'der Dienst beachtet srsName inzwischen anders; die Umrechnung hier passt dann nicht mehr'
    )
  }
  return collection.features
}

/**
 * Bricht ab, wenn der Dienst **Grad** geliefert hat — die Umkehrung von
 * `assertDegrees`, wie in Köln: Sollte der Dienst eines Tages `srsName=4326`
 * annehmen und jemand `sources.ts` umstellen, ohne dieses Skript anzufassen,
 * machte `utmToWgs84` aus Graden stillschweigend Unfug in der Ostsee.
 */
function assertUtm(key: string, geometry: Geometry): void {
  const walk = (node: unknown): void => {
    if (!Array.isArray(node)) return
    if (typeof node[0] === 'number' && typeof node[1] === 'number') {
      const [easting, northing] = node as number[]
      if (Math.abs(easting as number) <= 180 && Math.abs(northing as number) <= 90) {
        throw new Error(`${key}: ${easting}/${northing} sehen nach Grad aus — der Schweriner Dienst lieferte bisher immer EPSG:25833`)
      }
      return
    }
    node.forEach(walk)
  }
  walk(geometry.coordinates)
}

/** Dieselbe Prüfung wie in Frankfurt und München — nach dem Rechnen statt davor. */
function assertDegrees(key: string, geometry: Geometry): void {
  const walk = (node: unknown): void => {
    if (!Array.isArray(node)) return
    if (typeof node[0] === 'number' && typeof node[1] === 'number') {
      const [lon, lat] = node as number[]
      if (Math.abs(lon as number) > 180 || Math.abs(lat as number) > 90) {
        throw new Error(`${key}: ${lon}/${lat} sind keine Grade — die Umprojektion ist falsch`)
      }
      return
    }
    node.forEach(walk)
  }
  walk(geometry.coordinates)
}

/** UTM-Geometrie aus dem GML nach Grad, mit beiden Prüfungen. */
function toDegrees(key: string, geometry: GmlGeometry): Geometry {
  assertUtm(key, geometry)
  const result: Geometry = { type: geometry.type, coordinates: utmCoordinatesToWgs84(geometry.coordinates, UTM_ZONE) }
  assertDegrees(key, result)
  return result
}

function write(name: string, value: unknown): void {
  const path = join(OUT, name)
  mkdirSync(dirname(path), { recursive: true })
  const json = JSON.stringify(value)
  writeFileSync(path, json)
  console.log(`  ${name}: ${(json.length / 1024).toFixed(0)} KB`)
}

/** Alle Aussen- und Innenringe eines (Multi-)Polygons, als Liste von Polygonen. */
function toPolygons(geometry: { type: string; coordinates: unknown }): PolygonRings[] {
  if (geometry.type === 'Polygon') return [geometry.coordinates as PolygonRings]
  if (geometry.type === 'MultiPolygon') return geometry.coordinates as PolygonRings[]
  return []
}

/** Alle Stützpunkte einer Geometrie, egal wie tief verschachtelt. */
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

function boundsOfPoints(points: readonly Position[]): BoundingBox {
  const lons = points.map((point) => point[0])
  const lats = points.map((point) => point[1])
  return { minLon: Math.min(...lons), maxLon: Math.max(...lons), minLat: Math.min(...lats), maxLat: Math.max(...lats) }
}

/** Mittelpunkt aller Stützpunkte — reicht, um einen Stadtteil zu treffen. */
function centroid(points: readonly Position[]): Position | null {
  if (points.length === 0) return null
  let lon = 0
  let lat = 0
  for (const point of points) {
    lon += point[0]
    lat += point[1]
  }
  return [lon / points.length, lat / points.length]
}

/** Dasselbe Feld-Schema wie die sieben Städte davor — ein Typ, ein Panel. */
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

console.log('Schwerin — Daten bauen …')

// ------------------------------------------------------------- Stadtteile
//
// Zuerst, weil die Zonen sie brauchen: Ein Buchstabe allein sagt niemandem,
// wo „Zone J" liegt; „Schelfstadt / Zone J" schon.

interface District {
  name: string
  rings: PolygonRings[]
}

const districtFeatures: { type: 'Feature'; properties: { name: string }; geometry: Geometry }[] = []
const districtIndex: District[] = []

for (const feature of readGml('districts')) {
  if (feature.geometry === null) continue
  const geometry = toDegrees('districts', feature.geometry)
  const name = (feature.properties['stt_bezeich'] ?? '').trim()
  if (name === '') throw new Error(`districts: Stadtteil ${feature.properties['stt'] ?? '?'} ohne Namen`)

  // Die Zuordnung läuft gegen die UNvereinfachte Geometrie, wie in Frankfurt:
  // Vereinfachte Grenzen wandern um ein paar Dutzend Meter.
  districtIndex.push({ name, rings: toPolygons(geometry) })

  const simplified = simplifyGeometry(geometry, 1e-4, 5)
  if (simplified === null) continue
  districtFeatures.push({ type: 'Feature', properties: { name }, geometry: simplified })
}

write('districts.geojson', { type: 'FeatureCollection', features: districtFeatures })

function districtAt(point: Position | null): District | null {
  if (point === null) return null
  return districtIndex.find((district) => multiPolygonContains(district.rings, point)) ?? null
}

// --------------------------------------------------------------- Automaten

interface Automat {
  properties: SchwerinAutomatProperties
  point: Position
}

const automats: Automat[] = []
for (const feature of readGml('automats')) {
  if (feature.geometry === null) continue
  const geometry = toDegrees('automats', feature.geometry)
  const coordinates = geometry.coordinates
  if (!Array.isArray(coordinates)) continue
  const [lon, lat] = coordinates as number[]
  if (typeof lon !== 'number' || typeof lat !== 'number') continue
  automats.push({ properties: feature.properties, point: [lon, lat] })
}

// ------------------------------------------------------------------ Zonen

interface Zone {
  letter: string
  geometry: Geometry
  polygons: PolygonRings[]
  bounds: BoundingBox
  areaSquareMetres: number
  automats: SchwerinAutomatProperties[]
}

const rawZones = readGml('zones').filter((feature) => feature.geometry !== null)

/**
 * Die Buchstaben, **vor** der Umrechnung: Die Ankerpunkte stehen in UTM,
 * weil der Dienst in UTM antwortet, und ein Punkt-in-Polygon in Metern ist
 * dieselbe Rechnung wie in Grad. Danach ist die Kennung an die Fläche
 * gebunden, und die Umrechnung ändert daran nichts mehr.
 */
const letters = schwerinZoneLetters(rawZones.map((feature) => toPolygons(feature.geometry as GmlGeometry)))

const zones: Zone[] = rawZones.map((feature, index) => {
  const geometry = toDegrees('zones', feature.geometry as GmlGeometry)
  const polygons = toPolygons(geometry)
  return {
    letter: letters[index] as string,
    geometry,
    polygons,
    bounds: boundsOfPoints(positionsOf(geometry)),
    areaSquareMetres: areaSquareMetres(polygons),
    automats: [],
  }
})

/**
 * Welcher Automat zu welcher Zone gehört — über die Geometrie, wie in
 * Frankfurt, und **in jede Zone, die ihn enthält**. Sieben Automaten stehen
 * am Abzug vom 16. September 2026 in zwei Zonen zugleich (A/F und F, A/D und
 * D); die Mischfläche und die Grundzone bekommen dann beide seine Zeiten.
 * Das ist keine Doppelzählung, sondern die Aussage der Karte: An dieser
 * Stelle gelten beide.
 */
let assigned = 0
let outsideEveryZone = 0
for (const automat of automats) {
  let hits = 0
  for (const zone of zones) {
    if (!withinBounds(automat.point, zone.bounds)) continue
    if (!multiPolygonContains(zone.polygons, automat.point)) continue
    zone.automats.push(automat.properties)
    hits += 1
  }
  if (hits === 0) outsideEveryZone += 1
  else assigned += 1
}

const zoneFeatures: { type: 'Feature'; properties: ZoneOut; geometry: Geometry }[] = []
let skippedWithoutAutomats: string[] = []
let withoutDistrict = 0

// Kleinste Fläche zuerst — siehe Kopfkommentar: `zoneAt` nimmt die erste
// Fläche, die den Punkt enthält, und die Mischflächen liegen in den
// Grundzonen.
for (const zone of [...zones].sort((a, b) => a.areaSquareMetres - b.areaSquareMetres)) {
  /**
   * Eine Zone ohne einen einzigen Automaten wird ausgelassen — dasselbe
   * Kriterium wie in Frankfurt, Köln und Karlsruhe. Heute sind es fünf von
   * 15: L, V, C/D, C/O und A/C. In L und V stehen keine Automaten (reines
   * Bewohnerparken oder Parkscheibe — die Quelle sagt es nicht), C/D, C/O
   * und A/C sind Mischflächen von 0,1 bis 0,4 ha. Ein Polygon ohne Antwort
   * wäre schlechter als kein Polygon.
   */
  if (zone.automats.length === 0) {
    skippedWithoutAutomats.push(zone.letter)
    continue
  }

  const simplified = simplifyGeometry(zone.geometry, 1e-5, 5)
  if (simplified === null) continue

  const points = positionsOf(zone.geometry)
  const district = districtAt(centroid(points))
  if (district === null) withoutDistrict += 1

  const schedules = zone.automats.map((automat) => parseSchwerinSchedule(automat.Bewirtschaftungszeit ?? ''))

  // Die Rohtexte mit Zähler, wie in Köln: „Mo - Sa 8-20 h (10×); Mo - So
  // 8-21 h (4×)" sagt, was hier üblich ist und was die Ausnahme — genau die
  // Auskunft, die `mergeSchwerinWindows` durch die Vereinigung verdeckt.
  const counted = (values: (string | null | undefined)[]): string => {
    const counts = new Map<string, number>()
    for (const value of values) {
      const text = (value ?? '').trim()
      if (text === '') continue
      counts.set(text, (counts.get(text) ?? 0) + 1)
    }
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([text, count]) => (count > 1 ? `${text} (${count}×)` : text))
      .join('; ')
  }

  /**
   * Die Höchstparkdauer wird **nie** als Regel der Zone ausgegeben — derselbe
   * Weg wie in Frankfurt, Köln und Karlsruhe: Sie steht je Automat, und in
   * sieben der zehn Zonen stehen „ohne" und „2 h" nebeneinander.
   */
  const stayCounts = new Map<string, number>()
  for (const automat of zone.automats) {
    const minutes = parseSchwerinMaxStay(automat.Hoechstparkdauer)
    if (minutes === undefined) continue
    const code = schwerinMaxStayCode(minutes)
    stayCounts.set(code, (stayCounts.get(code) ?? 0) + 1)
  }
  const stayEntries = [...stayCounts.entries()].sort((a, b) => b[1] - a[1])
  const limited = stayEntries.reduce((sum, [, count]) => sum + count, 0)

  const notes = [...new Set(zone.automats.map(schwerinAutomatNote).filter((note): note is string => note !== null))]

  zoneFeatures.push({
    type: 'Feature',
    properties: {
      zone: zone.letter,
      district: district?.name ?? SCHWERIN.name,
      rawHours: counted(zone.automats.map((automat) => automat.Bewirtschaftungszeit)),
      rawFee: counted(zone.automats.map((automat) => automat.Gebuehr)),
      note: notes.length === 0 ? null : notes.join(' · '),
      windows: mergeSchwerinWindows(schedules.flat()),
      fee: mergeSchwerinFees(zone.automats.map((automat) => parseSchwerinFee(automat.Gebuehr))),
      unmodelledRules: [],
      sourceDefect: null,
      spaces: null,
      maxStayMinutes: null,
      maxStay: stayEntries[0]?.[0] ?? null,
      maxStayShare: Math.round((limited / zone.automats.length) * 1000) / 1000,
      maxStayValues: stayEntries.map(([code]) => code),
      chargingPoints: 0,
      carsharing: 0,
    },
    geometry: simplified,
  })
}

write('zones.geojson', { type: 'FeatureCollection', features: zoneFeatures })

// ------------------------------------------------------------------- POI

/**
 * Die 64 Behindertenparkplätze, im selben POI-Schema wie überall. Der Feed
 * nennt `Bezeichnung` und `Standort` (in der Stichprobe gleich), dazu
 * `Stellplaetze` und eine leere `Kategorie`.
 */
const poi: { type: 'Feature'; properties: Record<string, unknown>; geometry: Geometry }[] = []

for (const feature of readGml('accessible')) {
  if (feature.geometry === null) continue
  const geometry = toDegrees('accessible', feature.geometry)
  const label = (feature.properties['Bezeichnung'] ?? '').trim() || (feature.properties['Standort'] ?? '').trim()
  const count = Number((feature.properties['Stellplaetze'] ?? '').trim())
  const detail =
    // Singular für einen: „1 Plätze" ist in Berlin schon einmal in die
    // Sprechblase gelaufen.
    Number.isInteger(count) && count > 0 ? `${count} ${count === 1 ? 'Platz' : 'Plätze'}` : null
  poi.push({
    type: 'Feature',
    properties: { kind: 'accessible', label: label || 'Behindertenparkplatz', detail },
    geometry: { type: 'Point', coordinates: roundPoint((geometry.coordinates as [number, number]) ?? [0, 0]) },
  })
}

write('poi.geojson', { type: 'FeatureCollection', features: poi })

// Leere Sammlung statt fehlender Datei: `loadData` holt für jede Stadt
// dieselben fünf Namen. Schwerin hat keine Umweltzone — in ganz
// Mecklenburg-Vorpommern gibt es keine.
write('umweltzone.geojson', { type: 'FeatureCollection', features: [] })

write('meta.json', {
  city: SCHWERIN.key,
  cityName: SCHWERIN.name,
  source: `${SCHWERIN.attribution.source}, WFS 2.0.0 (GML 3.2) über den Landkreis Ludwigslust-Parchim`,
  licence: SCHWERIN.attribution.licence,
  licenceUrl: SCHWERIN.attribution.licenceUrl,
  attributionRequired: SCHWERIN.attribution.attributionRequired,
  datasetUrl: SCHWERIN.attribution.datasetUrl,
  // Wann die Quelle zuletzt erfolgreich abgerufen wurde — siehe abruf-zeit.ts.
  geprueftAm: geprueftAm(RAW),
  zones: zoneFeatures.length,
  districts: districtFeatures.length,
  poi: poi.length,
  lowEmissionZone: false,
  segments: 0,
  managedSpaces: 0,
  crs: 'EPSG:4326 (lon/lat), umgerechnet aus EPSG:25833',
  // `umweltzone` heißt hier wirklich „gibt es nicht"; `segments` gibt es in
  // der Quelle nicht.
  absent: ['umweltzone', 'segments'],
})

// Die Zahlen gehören ins Log, nicht in einen Kommentar: Sie sind das, was
// beim nächsten Abzug anders sein kann.
console.log(
  `\n${zoneFeatures.length} von ${zones.length} Zonen übernommen` +
    ` — ohne Automaten ausgelassen: ${skippedWithoutAutomats.join(', ') || 'keine'}` +
    `, ${withoutDistrict} ohne Stadtteil-Treffer`
)
console.log(
  `${assigned} von ${automats.length} Automaten mindestens einer Zone zugeordnet,` +
    ` ${outsideEveryZone} liegen in keiner` +
    ` (${zones.reduce((sum, zone) => sum + zone.automats.length, 0)} Zuordnungen insgesamt)`
)
console.log(`${poi.length} Behindertenparkplätze, ${districtFeatures.length} Stadtteile`)
