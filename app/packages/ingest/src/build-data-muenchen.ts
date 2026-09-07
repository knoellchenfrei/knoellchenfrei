/**
 * Baut Münchens Daten — das vierte Gegenstück zu `build-data.ts`.
 *
 * Vier Skripte statt eines mit vier Zweigen, aus demselben Grund wie bei
 * Hamburg und Frankfurt: Die Feeds teilen sich außer dem Wort „Parken" nichts.
 *
 * Was München **anders** macht als die drei anderen Städte:
 *
 * - **Die Regel steht als Satz, nicht in Feldern.** 291 verschiedene Werte von
 *   `parkregel_beschreibung`, zusammengesetzt aus bis zu vier Klauseln.
 *   `muenchen.ts` in `packages/core` zerlegt sie; hier wird nur noch
 *   zusammengelegt.
 * - **Die Sachdaten hängen an der Straßenseite, nicht am Gebiet.** Ein Gebiet
 *   trägt Namen, Status, Maßnahme und wer kontrolliert — keine Zeit, keine
 *   Gebühr, keine Stellplatzzahl. Alles davon entsteht hier aus den bis zu
 *   900 Abschnitten darin.
 * - **Die Zuordnung läuft über das Attribut, nicht über die Geometrie** — das
 *   Gegenteil von Frankfurt. Begründung mit Zahlen unten bei `assign`.
 * - **Kein Betrag, nirgends.** Jedes Gebiet bekommt `Fee = { kind: 'unknown' }`.
 *   Die 2 € je Stunde der Gebührenordnung stehen in keinem Datensatz, und sie
 *   hier abzutippen hieße, eine Zahl zu behaupten, die niemand geprüft hat —
 *   für die Altstadt wäre sie außerdem falsch.
 *
 * Was München **hat** und Frankfurt nicht: eine Umweltzone in der Quelle,
 * Stellplatzzahlen, Ladeinfrastruktur, Carsharing und P+R. Die POI-Datei
 * bedient damit alle vier Arten, die die Karte kennt, ohne eine fünfte.
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

import {
  MUENCHEN,
  isMuenchenParkingGroup,
  isMuenchenZoneActive,
  mergeMuenchenWindows,
  muenchenMaxStay,
  muenchenMaxStayCode,
  muenchenParkingWindows,
  muenchenSpaces,
  muenchenZoneLabel,
  muenchenZoneNote,
  multiPolygonContains,
  parseMuenchenRule,
  withinBounds,
  type BoundingBox,
  type ChargeWindow,
  type Fee,
  type MuenchenRule,
  type MuenchenSideProperties,
  type MuenchenZoneProperties,
  type PolygonRings,
  type Position,
} from '@knoellchenfrei/core'

import { citySources, toGeoJsonAxes, type AxisOrder } from './sources.js'
import { roundPoint, simplifyGeometry } from './simplify.js'

const RAW = join(process.env.RAW_DIR ?? join(process.cwd(), '../../.raw'), MUENCHEN.key)
const OUT = join(
  process.env.OUT_DIR ?? join(process.cwd(), '../../apps/web/public/data'),
  MUENCHEN.key
)

interface Geometry {
  type: string
  coordinates: unknown
}

interface Feature<P> {
  id?: string
  properties: P
  geometry: Geometry | null
}

const SOURCES = citySources(MUENCHEN.key)

function axisOrderOf(key: string): AxisOrder {
  const source = SOURCES.find((candidate) => candidate.key === key)
  if (source === undefined) throw new Error(`Keine Quelle "${key}" für München`)
  return source.axisOrder
}

function readFeatures<P>(key: string): Feature<P>[] {
  const path = join(RAW, `${key}.json`)
  const parsed = JSON.parse(readFileSync(path, 'utf8')) as { features: Feature<P>[] }
  return parsed.features
}

function toGeoJson(geometry: Geometry | null, order: AxisOrder): Geometry | null {
  if (geometry === null) return null
  return { type: geometry.type, coordinates: toGeoJsonAxes(geometry.coordinates, order) }
}

/**
 * Bricht ab, wenn der Dienst UTM statt Grad geliefert hat.
 *
 * Wörtlich dieselbe Prüfung wie in Frankfurt, und aus demselben Grund: Der
 * Münchner GeoServer führt `urn:ogc:def:crs:EPSG::25832` als `DefaultCRS`.
 * Ohne `srsName` kämen `[691000, 5334000]` — plausible Zahlen, nur keine
 * Grade. `wfsUrl` setzt den Parameter; ob er wirkt, wird hier gemessen statt
 * geglaubt. Ohne die Prüfung läge ganz München bei 691.000° Ost, und die Karte
 * sähe dabei nur leer aus.
 */
function assertDegrees(key: string, geometry: Geometry): void {
  const walk = (node: unknown): void => {
    if (!Array.isArray(node)) return
    if (typeof node[0] === 'number' && typeof node[1] === 'number') {
      const [lon, lat] = node as number[]
      if (Math.abs(lon as number) > 180 || Math.abs(lat as number) > 90) {
        throw new Error(
          `${key}: ${lon}/${lat} sind keine Grade — der Dienst hat vermutlich in ` +
            'EPSG:25832 (UTM) geantwortet. srsName fehlt in der Anfrage.'
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

/** Alle Aussen- und Innenringe eines (Multi-)Polygons, als Liste von Polygonen. */
function toPolygons(geometry: Geometry): PolygonRings[] {
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

/** Mittelpunkt aller Stützpunkte — reicht, um einen Stadtbezirk zu treffen. */
function centroid(geometry: Geometry): Position | null {
  const points = positionsOf(geometry)
  if (points.length === 0) return null
  let lon = 0
  let lat = 0
  for (const point of points) {
    lon += point[0]
    lat += point[1]
  }
  return [lon / points.length, lat / points.length]
}

/**
 * Der mittlere Stützpunkt einer Linie.
 *
 * Nicht der Schwerpunkt: Eine Straßenseite ist ein Streckenzug, und sein
 * Schwerpunkt kann bei einer Kurve neben der Straße liegen. Ein Punkt *auf*
 * der Linie ist das, was hier gebraucht wird.
 */
function midpoint(geometry: Geometry): Position | null {
  const points = positionsOf(geometry)
  return points[Math.floor(points.length / 2)] ?? null
}

/** Dasselbe Feld-Schema wie Berlin, Hamburg und Frankfurt — ein Typ, ein Panel. */
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

console.log('München — Daten bauen …')

// ----------------------------------------------------------- Stadtbezirke
//
// Zuerst, weil die Gebiete sie brauchen: Ein Parkraummanagementgebiet heißt
// „Südliche Au" oder „TU-Viertel" — schöne Namen, die aber nicht sagen, wo in
// der Stadt das ist. Der Bezirk in der Kopfzeile des Panels tut das.
//
// 27 Polygone für 25 Bezirke: Thalkirchen-… und Untergiesing-Harlaching sind
// je zweiteilig. Der Name entscheidet, nicht das Polygon.

interface District {
  name: string
  rings: PolygonRings[]
}

const districtAxis = axisOrderOf('districts')
const districtFeatures: {
  type: 'Feature'
  properties: { name: string }
  geometry: Geometry
}[] = []
const districtIndex: District[] = []

for (const feature of readFeatures<Record<string, unknown>>('districts')) {
  const geometry = toGeoJson(feature.geometry, districtAxis)
  if (geometry === null) continue
  assertDegrees('districts', geometry)
  const raw = feature.properties['sb_name']
  const name = typeof raw === 'string' ? raw.trim() : ''

  // Die Zuordnung laeuft gegen die UNvereinfachte Geometrie. Vereinfachte
  // Grenzen wandern um bis zu ein paar Dutzend Meter, und ein Gebiet direkt an
  // der Bezirksgrenze bekaeme sonst den Nachbarn zugeschrieben.
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

// ---------------------------------------------------------------- Gebiete

const zoneAxis = axisOrderOf('zones')

interface Zone {
  label: string
  properties: MuenchenZoneProperties
  geometry: Geometry
  polygons: PolygonRings[]
  bounds: BoundingBox
  sides: { properties: MuenchenSideProperties; rule: MuenchenRule }[]
}

const zones: Zone[] = []
let skippedInactive = 0

for (const feature of readFeatures<MuenchenZoneProperties>('zones')) {
  const geometry = toGeoJson(feature.geometry, zoneAxis)
  if (geometry === null) continue
  assertDegrees('zones', geometry)

  // Heute wirft das kein einziges Gebiet weg — alle 82 stehen auf
  // `in Betrieb`. Die Prüfung steht trotzdem hier: Der Feed führt das Feld,
  // also kann er eines Tages ein geplantes oder aufgehobenes Gebiet
  // mitliefern, und das als bewirtschaftete Fläche zu zeichnen wäre eine
  // Behauptung über einen Ort, an dem gerade niemand kassiert.
  if (!isMuenchenZoneActive(feature.properties)) {
    skippedInactive += 1
    continue
  }

  const polygons = toPolygons(geometry)
  const points = positionsOf(geometry)
  const lons = points.map((point) => point[0])
  const lats = points.map((point) => point[1])
  zones.push({
    label: muenchenZoneLabel(feature.properties),
    properties: feature.properties,
    geometry,
    polygons,
    bounds: {
      minLon: Math.min(...lons),
      maxLon: Math.max(...lons),
      minLat: Math.min(...lats),
      maxLat: Math.max(...lats),
    },
    sides: [],
  })
}

const zoneByName = new Map(zones.map((zone) => [zone.label, zone]))

// ------------------------------------------------------------ Straßenseiten

const sideAxis = axisOrderOf('sides')

/**
 * Welche Straßenseite zu welchem Gebiet gehört — **über das Attribut**.
 *
 * Und damit genau andersherum als in Frankfurt, wo der Punkt gewinnt. Der
 * Grund ist inhaltlich und lässt sich nachzählen; am Abzug vom 7. September
 * 2026 gemessen:
 *
 * | | über `prm_name` | über Punkt-in-Polygon |
 * | --- | --- | --- |
 * | zugeordnete Abschnitte | **12.365** von 13.714 | 12.364 |
 * | erreichte Gebiete | 82 von 82 | 82 von 82 |
 * | Abschnitte, die der andere Weg nicht findet | 43 | 0 |
 *
 * Beide Wege sind sich 12.363-mal einig und **einmal** uneins. Die Geometrie
 * findet also nichts, was das Attribut nicht auch findet, und verliert 43
 * Abschnitte, deren Linienmitte knapp neben dem Polygon liegt — bei einer
 * Straße *auf* der Gebietsgrenze ist das der Normalfall, nicht die Ausnahme.
 *
 * Der Unterschied zu Frankfurt ist kein Widerspruch, sondern eine andere
 * Bedeutung desselben Feldtyps: Frankfurts `bewohnerparkzone` sagt, zu welchem
 * **Ausweis** ein Automat gehört, nicht wo er steht. Münchens `prm_name` sagt,
 * in welchem Gebiet die Straßenseite **liegt** — es ist die Aussage der Stadt
 * selbst über ihre eigene Geometrie.
 *
 * Die Geometrie wird trotzdem gerechnet, als Gegenprobe. Läuft sie eines Tages
 * auseinander, steht es im Log, statt dass es niemand merkt.
 */
let assignedByName = 0
let unknownName = 0
let withoutName = 0
let geometryAgrees = 0
let geometryDisagrees = 0
let geometryMisses = 0
const foreignNames = new Map<string, number>()

/** Straßenseiten ohne Parkbezug, gezählt je Gebiet — für die POI-Zeile im Panel. */
const chargingSides = new Map<string, number>()
const carsharingSides = new Map<string, number>()

let sidesTotal = 0
let sidesUnparsed = 0

for (const feature of readFeatures<MuenchenSideProperties>('sides')) {
  sidesTotal += 1
  const geometry = toGeoJson(feature.geometry, sideAxis)
  if (geometry !== null) assertDegrees('sides', geometry)

  const claimed = feature.properties.prm_name?.trim() ?? ''
  const zone = claimed === '' ? undefined : zoneByName.get(claimed)

  // Gegenprobe über den Punkt. Bounding-Box zuerst, sonst sind es 13.714 mal
  // 82 Strahlenschnitte gegen Polygone mit Tausenden Stützpunkten.
  const point = geometry === null ? null : midpoint(geometry)
  const geometric =
    point === null
      ? undefined
      : zones.find(
          (candidate) =>
            withinBounds(point, candidate.bounds) && multiPolygonContains(candidate.polygons, point)
        )

  if (claimed === '') {
    withoutName += 1
  } else if (zone === undefined) {
    unknownName += 1
    foreignNames.set(claimed, (foreignNames.get(claimed) ?? 0) + 1)
  } else {
    assignedByName += 1
    if (geometric === undefined) geometryMisses += 1
    else if (geometric.label === zone.label) geometryAgrees += 1
    else geometryDisagrees += 1
  }

  if (zone === undefined) continue

  const gruppe = feature.properties.parkregel_gruppe?.trim() ?? ''
  if (gruppe === 'E-Parken') {
    chargingSides.set(zone.label, (chargingSides.get(zone.label) ?? 0) + 1)
  }
  if (gruppe === 'Carsharing') {
    carsharingSides.set(zone.label, (carsharingSides.get(zone.label) ?? 0) + 1)
  }

  // Genau eine der 13.714 Zeilen führt `parkregel_beschreibung: null`. Sie
  // deshalb den ganzen Datenbau abbrechen zu lassen wäre unverhältnismäßig;
  // sie stillschweigend als „keine Regel" mitzuzählen wäre falsch. Also:
  // überspringen und zählen, damit ein Anwachsen dieser Zahl auffällt.
  if (feature.properties.parkregel_beschreibung == null) {
    sidesUnparsed += 1
    continue
  }
  zone.sides.push({
    properties: feature.properties,
    rule: parseMuenchenRule(feature.properties.parkregel_beschreibung),
  })
}

// ------------------------------------------------------- Gebiete ausgeben

const zoneFeatures: { type: 'Feature'; properties: ZoneOut; geometry: Geometry }[] = []
let skippedWithoutRule = 0
let withoutDistrict = 0
let totalSpaces = 0

for (const zone of zones) {
  /**
   * Ein Gebiet ohne einen einzigen Abschnitt mit allgemeinem Parken wird
   * ausgelassen.
   *
   * Dasselbe Kriterium wie Hamburgs „ohne Zeitangabe" und Frankfurts „ohne
   * Automaten": Ohne Zeiten kann die App die eine Frage nicht beantworten, für
   * die es sie gibt, und ein Polygon ohne Antwort ist schlechter als kein
   * Polygon — es sähe aus wie eine bewirtschaftete Fläche und wüsste über sie
   * nichts.
   */
  const parking = zone.sides.filter((side) =>
    isMuenchenParkingGroup(side.properties.parkregel_gruppe)
  )
  if (parking.length === 0) {
    skippedWithoutRule += 1
    continue
  }

  const simplified = simplifyGeometry(zone.geometry, 1e-5, 5)
  if (simplified === null) continue

  const district = districtAt(centroid(zone.geometry))
  if (district === null) withoutDistrict += 1

  /**
   * Die Rohtexte: die häufigsten, mit Zähler.
   *
   * Nicht alle: Ein Gebiet trägt bis zu 60 verschiedene Regeltexte, und
   * `<code>` im Panel wäre dann ein Absatz. Fünf plus die Zahl der übrigen
   * sagen, was hier üblich ist und dass es mehr gibt — und das ist genau die
   * Auskunft, die jemand vor Ort braucht.
   */
  const textCounts = new Map<string, number>()
  for (const side of parking) {
    const text = side.rule.raw
    textCounts.set(text, (textCounts.get(text) ?? 0) + 1)
  }
  const ranked = [...textCounts.entries()].sort((a, b) => b[1] - a[1])
  const shown = ranked.slice(0, 5).map(([text, count]) => `${text} (${count}×)`)
  const rest = ranked.length - shown.length
  const rawHours = [...shown, ...(rest > 0 ? [`+ ${rest} weitere`] : [])].join('; ')

  /**
   * Die Höchstparkdauer wird **nie** als Regel des Gebiets ausgegeben.
   *
   * Derselbe Weg wie in Berlin und Frankfurt und aus demselben Grund: Sie steht
   * je Straßenseite, und in München stehen im selben Gebiet regelmäßig
   * `Kurzzeitparken 2h` und `Mischparken 9-23 Uhr` ohne Grenze nebeneinander.
   * Sie als `maxStayMinutes` auszuliefern hiesse zu behaupten, die Quelle nenne
   * sie für das ganze Gebiet — das Panel sagt bei diesem Feld genau das, und es
   * wäre gelogen. `maxStayShare` nennt stattdessen den Anteil.
   */
  const stayCounts = new Map<string, number>()
  for (const side of parking) {
    const minutes = muenchenMaxStay(side.rule)
    if (minutes === undefined) continue
    const code = muenchenMaxStayCode(minutes)
    stayCounts.set(code, (stayCounts.get(code) ?? 0) + 1)
  }
  const stayEntries = [...stayCounts.entries()].sort((a, b) => b[1] - a[1])
  const limited = stayEntries.reduce((sum, [, count]) => sum + count, 0)

  const spaces = parking.reduce((sum, side) => sum + muenchenSpaces(side.properties.angebot), 0)
  totalSpaces += spaces

  const unmodelledRules = [
    ...new Set(parking.flatMap((side) => side.rule.unmodelled)),
  ].sort()

  zoneFeatures.push({
    type: 'Feature',
    properties: {
      zone: zone.label,
      district: district?.name ?? MUENCHEN.name,
      rawHours,
      // Kein Betrag steht in dieser Quelle, also steht hier auch keiner. Das
      // Feld bleibt, damit alle vier Städte dieselbe Form haben; die Anzeige
      // liest ohnehin `fee`.
      rawFee: '',
      note: muenchenZoneNote(zone.properties),
      // Aus **allen** Abschnitten, nicht nur den gezählten: „Behindertenparkplatz
      // 8-18 Uhr Montag bis Freitag, Mischparken 18-23 Uhr" sagt wahr, dass in
      // diesem Gebiet abends Gebühren fällig sind. `muenchenParkingWindows`
      // wirft dabei alles weg, was kein Gebührenfenster ist.
      windows: mergeMuenchenWindows(
        zone.sides.flatMap((side) => muenchenParkingWindows(side.rule))
      ),
      // Siehe Dateikopf: In keinem der 291 Regeltexte steht ein Betrag.
      fee: { kind: 'unknown' },
      unmodelledRules,
      sourceDefect: null,
      spaces: spaces > 0 ? spaces : null,
      maxStayMinutes: null,
      maxStay: stayEntries[0]?.[0] ?? null,
      maxStayShare: Math.round((limited / parking.length) * 1000) / 1000,
      maxStayValues: stayEntries.map(([code]) => code),
      chargingPoints: chargingSides.get(zone.label) ?? 0,
      carsharing: carsharingSides.get(zone.label) ?? 0,
    },
    geometry: simplified,
  })
}

write('zones.geojson', { type: 'FeatureCollection', features: zoneFeatures })

// ------------------------------------------------------------------- POI

/**
 * Die vier POI-Arten, die die Karte kennt — und München bedient alle vier.
 *
 * Ohne Änderung an der Oberfläche: `charging`, `carsharing`, `park_and_ride`
 * und `accessible` gibt es dort schon, samt Symbol, Legende und Filter. Für
 * jede der vier Ebenen ist die Lizenz einzeln aus ihrem ISO-Metadatensatz
 * geprüft (siehe `sources.ts`); ohne Beleg wäre keine hier gelandet.
 */
interface PoiProps {
  kind: 'charging' | 'carsharing' | 'park_and_ride' | 'accessible'
  label: string
  detail: string | null
}

const poi: { type: 'Feature'; properties: PoiProps; geometry: Geometry }[] = []

function text(value: unknown): string {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : ''
}

function count(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && /^\d+$/.test(value.trim())) return Number(value.trim())
  return null
}

/** „1 Plätze" ist in Berlin schon einmal in die Sprechblase gelaufen. */
function spacesLabel(value: number | null): string | null {
  if (value === null || value <= 0) return null
  return `${value} ${value === 1 ? 'Platz' : 'Plätze'}`
}

/**
 * Ein POI ist ein Punkt — auch wenn die Quelle eine Fläche liefert.
 *
 * Münchens Carsharing-Plätze sind Polygone (die markierte Stellfläche), P+R
 * kommt als `MultiPoint`. Beides auf einen Punkt zu bringen ist hier richtig:
 * Die Karte setzt Symbole, keine Umrisse, und eine 12 m lange Stellfläche als
 * Fläche zu zeichnen wäre bei Zoom 12 ein Pixel.
 */
function asPoint(geometry: Geometry): Geometry | null {
  const centre = centroid(geometry)
  // `Position` aus `core` ist readonly, `roundPoint` nimmt ein veränderliches
  // Tupel. Kopieren statt casten: Die Kopie kostet nichts und lügt nicht.
  return centre === null ? null : { type: 'Point', coordinates: roundPoint([centre[0], centre[1]]) }
}

const accessibleAxis = axisOrderOf('accessible')
for (const feature of readFeatures<Record<string, unknown>>('accessible')) {
  const geometry = toGeoJson(feature.geometry, accessibleAxis)
  if (geometry === null) continue
  assertDegrees('accessible', geometry)
  const point = asPoint(geometry)
  if (point === null) continue

  const detail = [
    spacesLabel(count(feature.properties['anzahl_stellplaetze'])),
    text(feature.properties['zeitliche_einschraenkung']) || null,
    // Der Feed führt Baustellen mit: `status: "Baustelle"` samt Hinweistext.
    // Das ist genau die Auskunft, die jemand vor Ort braucht, bevor er
    // hinfährt.
    text(feature.properties['status']) === 'Baustelle'
      ? text(feature.properties['hinweis']) || 'zurzeit Baustelle'
      : null,
  ]
    .filter((part) => part !== null && part !== '')
    .join(' · ')

  poi.push({
    type: 'Feature',
    properties: {
      kind: 'accessible',
      label: text(feature.properties['bezeichnung']) || 'Behindertenparkplatz',
      detail: detail === '' ? null : detail,
    },
    geometry: point,
  })
}

const parkAndRideAxis = axisOrderOf('parkAndRide')
for (const feature of readFeatures<Record<string, unknown>>('parkAndRide')) {
  const geometry = toGeoJson(feature.geometry, parkAndRideAxis)
  if (geometry === null) continue
  assertDegrees('parkAndRide', geometry)
  const point = asPoint(geometry)
  if (point === null) continue

  // Der Feed zählt in drei Feldern: Kurz-, Mittel- und Langzeitplätze. Die
  // Summe ist die Zahl, die jemand sucht; einzeln wären es drei Zahlen ohne
  // Erklärung.
  const total = ['stellpla_1', 'stellpla_2', 'stellpla_3'].reduce(
    (sum, key) => sum + (count(feature.properties[key]) ?? 0),
    0
  )
  const detail = [text(feature.properties['adresse']) || null, spacesLabel(total)]
    .filter((part) => part !== null && part !== '')
    .join(' · ')

  poi.push({
    type: 'Feature',
    properties: {
      kind: 'park_and_ride',
      label: text(feature.properties['name']) || 'P+R-Anlage',
      detail: detail === '' ? null : detail,
    },
    geometry: point,
  })
}

const chargingAxis = axisOrderOf('charging')
for (const feature of readFeatures<Record<string, unknown>>('charging')) {
  const geometry = toGeoJson(feature.geometry, chargingAxis)
  if (geometry === null) continue
  assertDegrees('charging', geometry)
  const point = asPoint(geometry)
  if (point === null) continue

  const points = count(feature.properties['anzahl_ladepunkte'])
  const detail = [
    points !== null && points > 0 ? `${points} ${points === 1 ? 'Ladepunkt' : 'Ladepunkte'}` : null,
    text(feature.properties['kat_ladegeschwindigkeit']) || null,
  ]
    .filter((part) => part !== null && part !== '')
    .join(' · ')

  poi.push({
    type: 'Feature',
    properties: {
      kind: 'charging',
      label: text(feature.properties['standort']) || 'Ladeinfrastruktur',
      detail: detail === '' ? null : detail,
    },
    geometry: point,
  })
}

const carsharingAxis = axisOrderOf('carsharing')
for (const feature of readFeatures<Record<string, unknown>>('carsharing')) {
  const geometry = toGeoJson(feature.geometry, carsharingAxis)
  if (geometry === null) continue
  assertDegrees('carsharing', geometry)
  const point = asPoint(geometry)
  if (point === null) continue

  poi.push({
    type: 'Feature',
    properties: {
      kind: 'carsharing',
      label: text(feature.properties['sonderparken_standortname']) || 'Carsharing-Platz',
      detail: text(feature.properties['sonderparken_typ_text']) || null,
    },
    geometry: point,
  })
}

write('poi.geojson', { type: 'FeatureCollection', features: poi })

// ------------------------------------------------------------- Umweltzone

/**
 * Zwölf Polygone, nicht eines.
 *
 * Berlin liefert die Umweltzone als ein Feature. München liefert dreizehn
 * Flächen in einer Ebene: die Zone selbst und elf „Transferflächen" (Parkplätze
 * am Rand, etwa die Olympiaparkharfe). Alle mitzunehmen ist richtig — sie
 * gehören zur Regelung —, und das Schema der Datei bleibt dasselbe wie in
 * Berlin: eine Sammlung mit `name` je Fläche.
 */
const lowEmissionAxis = axisOrderOf('lowEmissionZone')
const lowEmission: { type: 'Feature'; properties: { name: string }; geometry: Geometry }[] = []

for (const feature of readFeatures<Record<string, unknown>>('lowEmissionZone')) {
  const geometry = toGeoJson(feature.geometry, lowEmissionAxis)
  if (geometry === null) continue
  assertDegrees('lowEmissionZone', geometry)
  const simplified = simplifyGeometry(geometry, 1e-5, 5)
  if (simplified === null) continue
  lowEmission.push({
    type: 'Feature',
    properties: { name: text(feature.properties['bezeichnung']) || 'Umweltzone' },
    geometry: simplified,
  })
}

write('umweltzone.geojson', { type: 'FeatureCollection', features: lowEmission })

// ------------------------------------------------------------- Herkunft

write('meta.json', {
  city: MUENCHEN.key,
  cityName: MUENCHEN.name,
  source: `${MUENCHEN.attribution.source}, WFS 2.0.0`,
  licence: MUENCHEN.attribution.licence,
  licenceUrl: MUENCHEN.attribution.licenceUrl,
  attributionRequired: MUENCHEN.attribution.attributionRequired,
  datasetUrl: MUENCHEN.attribution.datasetUrl,
  zones: zoneFeatures.length,
  districts: districtFeatures.length,
  poi: poi.length,
  lowEmissionZone: lowEmission.length > 0,
  segments: sidesTotal,
  managedSpaces: totalSpaces,
  crs: 'EPSG:4326 (lon/lat)',
  /**
   * Was dieser Abzug nicht enthält: der Tarif. Er steht in der
   * Gebührenordnung, nicht in den Daten — siehe `docs/staedte.md`.
   */
  absent: ['fee'],
})

// Die Zahlen gehoeren ins Log, nicht in einen Kommentar: Sie sind das, was
// beim naechsten Abzug anders sein kann, und ein Sprung darin ist das erste,
// was auffaellt.
console.log(
  `\n${zoneFeatures.length} von ${zones.length + skippedInactive} Gebieten übernommen` +
    ` — ${skippedInactive} nicht in Betrieb, ${skippedWithoutRule} ohne Abschnitt mit Parkbezug` +
    `, ${withoutDistrict} ohne Stadtbezirk-Treffer`
)
console.log(
  `${assignedByName} von ${sidesTotal} Abschnitten über prm_name zugeordnet,` +
    ` ${withoutName} ohne Gebietsnamen, ${unknownName} mit einem Namen ohne Polygon` +
    ` (${[...foreignNames.entries()].map(([name, n]) => `${name}: ${n}`).join(', ')})`
)
console.log(
  `Gegenprobe Geometrie: ${geometryAgrees} mal einig, ${geometryDisagrees} mal uneins,` +
    ` ${geometryMisses} mal ohne Treffer`
)
console.log(
  `${totalSpaces.toLocaleString('de-DE')} Stellplätze, ${poi.length} POI,` +
    ` ${districtFeatures.length} Stadtbezirke, ${lowEmission.length} Umweltzonen-Flächen` +
    `${sidesUnparsed > 0 ? `, ${sidesUnparsed} ohne Regeltext` : ''}`
)
