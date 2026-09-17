/**
 * Baut Cottbus' Daten — das achte Gegenstück zu `build-data.ts`.
 *
 * Acht Skripte statt eines mit acht Zweigen, aus demselben Grund wie bei
 * allen Städten davor: Die Feeds teilen sich außer dem Wort „Parken" nichts.
 *
 * Was Cottbus **anders** macht als die sieben Städte davor:
 *
 * - **Die Quelle ist ein ArcGIS FeatureServer, kein WFS.** Beide Ebenen kommen
 *   als GeoJSON aus `…/FeatureServer/<n>/query?…&f=geojson&outSR=4326`
 *   (`sources.ts`, `COTTBUS_FILES`). Gemessen am 16. September 2026 kommen
 *   `[lon, lat]` in Grad; `assertDegrees` misst es bei jedem Lauf nach, weil
 *   das Layer-CRS EPSG:25833 ist und ein Dienst, der `outSR` eines Tages
 *   ignoriert, UTM-Meter mit 200 liefert.
 * - **Die Zonen sind die fünf Bewohnerparkzonen; Tarif und Zeiten kommen aus
 *   den Automaten darin** — über die Geometrie, wie in Frankfurt und Köln.
 *   Begründung mit Zahlen unten bei der Zuordnung.
 * - **Der Feed nennt den Stand von 2014.** Betrag und Wochentagsende sind die
 *   der abgelösten Parkgebührenordnung; `cottbusTariffFor` in `core` liefert
 *   die seit dem 1. Juni 2025 geltende Ordnung aus und setzt `sourceDefect`.
 *   Warum nicht `Fee.unknown` wie in Köln: Dort war nur der Betrag veraltet,
 *   hier auch die **Stunde**, und eine App, die um 19:30 Uhr „frei" sagt, wo
 *   die Stadt bis 20 Uhr kassiert, ist der teuerste Fehler dieses Projekts.
 *   Die Rechnung steht in `docs/staedte-cottbus.md`.
 *
 * Was Cottbus **nicht** hat und andere schon: Stadtteile (die Ebene
 * `Daten_Admin/Ortsteile` existiert, trägt aber keinen Lizenzvermerk im
 * Portal — Begründung in `sources.ts`), Umweltzone (Cottbus hat keine), POI,
 * Straßenabschnitte. Die drei Dateien werden trotzdem geschrieben, leer:
 * `loadData` in der Web-App holt alle fünf und bricht ab, wenn eine fehlt.
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

import {
  cityByKey,
  cottbusScheduleText,
  cottbusTariffFor,
  cottbusZoneKey,
  cottbusZoneNote,
  mergeCottbusWindows,
  multiPolygonContains,
  parseCottbusFee,
  parseCottbusSchedule,
  parseCottbusTariffZone,
  withinBounds,
  type BoundingBox,
  type ChargeWindow,
  type CottbusAutomatProperties,
  type CottbusTariffZone,
  type CottbusZoneProperties,
  type Fee,
  type PolygonRings,
  type Position,
} from '@knoellchenfrei/core'

import { simplifyGeometry } from './simplify.js'
import { geprueftAm } from './abruf-zeit.js'

/**
 * Die Stadt kommt aus `core/city.ts`, nicht aus einer Kopie hier. Solange
 * dort kein `COTTBUS` steht, bricht dieser Lauf mit `Unbekannte Stadt
 * "cottbus"` ab — laut und in der ersten Zeile.
 */
const COTTBUS = cityByKey('cottbus')

const RAW = join(process.env.RAW_DIR ?? join(process.cwd(), '../../.raw'), COTTBUS.key)
const OUT = join(process.env.OUT_DIR ?? join(process.cwd(), '../../apps/web/public/data'), COTTBUS.key)

interface Geometry {
  type: string
  coordinates: unknown
}

interface Feature<P> {
  id?: number | string
  properties: P
  geometry: Geometry | null
}

/**
 * Liest eine ArcGIS-Antwort — und weist ab, was `fetch.ts` schon abweist,
 * noch einmal: Ein Abzug, der von Hand mit `curl` geholt wurde, ist an der
 * Prüfung dort vorbeigekommen.
 */
function readFeatures<P>(name: string): Feature<P>[] {
  const parsed = JSON.parse(readFileSync(join(RAW, name), 'utf8')) as {
    error?: { message?: string }
    exceededTransferLimit?: boolean
    features?: Feature<P>[]
  }
  if (parsed.error !== undefined) throw new Error(`${name}: ArcGIS meldet ${parsed.error.message ?? 'einen Fehler'}`)
  if (parsed.exceededTransferLimit === true) throw new Error(`${name}: exceededTransferLimit — abgeschnitten`)
  if (parsed.features === undefined) throw new Error(`${name}: keine features`)
  return parsed.features
}

function write(name: string, value: unknown): void {
  const path = join(OUT, name)
  mkdirSync(dirname(path), { recursive: true })
  const json = JSON.stringify(value)
  writeFileSync(path, json)
  console.log(`  ${name}: ${(json.length / 1024).toFixed(0)} KB`)
}

/**
 * Bricht ab, wenn der Dienst UTM statt Grad geliefert hat.
 *
 * Das Layer-CRS ist EPSG:25833; nur `outSR=4326` macht Grade daraus. Fällt
 * der Parameter eines Tages weg oder wird ignoriert, kämen
 * `[453286.86, 5732826.86]` — plausible Zahlen, nur keine Grade, und die
 * Karte sähe dabei nur leer aus.
 */
function assertDegrees(key: string, geometry: Geometry): void {
  const walk = (node: unknown): void => {
    if (!Array.isArray(node)) return
    if (typeof node[0] === 'number' && typeof node[1] === 'number') {
      const [lon, lat] = node as number[]
      if (Math.abs(lon as number) > 180 || Math.abs(lat as number) > 90) {
        throw new Error(
          `${key}: ${lon}/${lat} sind keine Grade — der Dienst hat vermutlich in EPSG:25833 ` +
            'geantwortet. outSR=4326 fehlt in der Abfrage.'
        )
      }
      return
    }
    node.forEach(walk)
  }
  walk(geometry.coordinates)
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

/** Dasselbe Feld-Schema wie die sieben Städte davor. */
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

console.log('Cottbus — Daten bauen …')

// ------------------------------------------------------------------- Zonen

interface Automat {
  properties: CottbusAutomatProperties
  point: Position
  tariffZone: CottbusTariffZone
  windows: ChargeWindow[]
  fee: Fee
  scheduleText: string
}

interface Zone {
  key: string
  properties: CottbusZoneProperties
  geometry: Geometry
  polygons: PolygonRings[]
  bounds: BoundingBox
  automats: Automat[]
}

const zones: Zone[] = []
for (const feature of readFeatures<CottbusZoneProperties>('zones.json')) {
  if (feature.geometry === null) continue
  assertDegrees('zones', feature.geometry)
  const points = positionsOf(feature.geometry)
  const lons = points.map((point) => point[0])
  const lats = points.map((point) => point[1])
  zones.push({
    key: cottbusZoneKey(feature.properties),
    properties: feature.properties,
    geometry: feature.geometry,
    polygons: toPolygons(feature.geometry),
    bounds: {
      minLon: Math.min(...lons),
      maxLon: Math.max(...lons),
      minLat: Math.min(...lats),
      maxLat: Math.max(...lats),
    },
    automats: [],
  })
}

// Der Schlüssel ist zugleich der Name, unter dem die Zone ausgeliefert wird.
// Zwei gleiche hiessen: eine Zone verschwindet, und zwar lautlos.
const keys = new Set(zones.map((zone) => zone.key))
if (keys.size !== zones.length) {
  throw new Error(`${zones.length} Zonen, aber nur ${keys.size} verschiedene Schlüssel`)
}

// --------------------------------------------------------------- Automaten

/**
 * Welcher Automat zu welcher Zone gehört — **über die Geometrie**.
 *
 * Der Feed bietet keinen Verweis vom Automaten auf die Bewohnerparkzone
 * (`id_ortsteile`, `id_stadtgebiete` und `id_bezirke` zeigen auf die
 * Verwaltungsgliederung, nicht auf die Parkzone). Am Abzug vom 16. September
 * 2026 gemessen: 38 der 44 Automaten liegen in einer der fünf Zonen
 * (II: 17, III: 6, IV: 2, V: 11, VI: 2), fünf außerhalb (Goethestraße,
 * Ostrower Platz, Ostrower Straße, zweimal Bahnhof), einer ohne Geometrie
 * (Dreifertstraße). Die Automaten außerhalb sind kein Fehler: Cottbus
 * kassiert auch dort, wo kein Bewohnerparkrecht gilt — die Tarifzone 2 der
 * Ordnung umfasst „die übrigen Straßen, Wege und Plätze des Stadtgebietes".
 * Diese Automaten gehören zu keinem Polygon, das dieser Dienst führt.
 */
const automats: Automat[] = []
let withoutGeometry = 0
let withoutSchedule = 0

for (const feature of readFeatures<CottbusAutomatProperties>('automats.json')) {
  const p = feature.properties
  if (feature.geometry === null) {
    withoutGeometry += 1
    continue
  }
  assertDegrees('automats', feature.geometry)
  const coordinates = feature.geometry.coordinates
  if (!Array.isArray(coordinates)) continue
  const [lon, lat] = coordinates as number[]
  if (typeof lon !== 'number' || typeof lat !== 'number') continue

  const windows = parseCottbusSchedule(p)
  if (windows.length === 0) {
    // Ohne Zeiten kann der Automat nichts zur Zone beitragen — und ein
    // Automat ohne Zeit als „immer" zu lesen wäre die falsche der beiden
    // möglichen Fehldeutungen.
    withoutSchedule += 1
    continue
  }
  automats.push({
    properties: p,
    point: [lon, lat],
    tariffZone: parseCottbusTariffZone(p.zone),
    windows,
    fee: parseCottbusFee(p.gebuehr),
    scheduleText: cottbusScheduleText(p),
  })
}

let assigned = 0
let outsideEveryZone = 0
for (const automat of automats) {
  const zone = zones.find(
    (candidate) =>
      withinBounds(automat.point, candidate.bounds) &&
      multiPolygonContains(candidate.polygons, automat.point)
  )
  if (zone === undefined) {
    outsideEveryZone += 1
    continue
  }
  assigned += 1
  zone.automats.push(automat)
}

// ------------------------------------------------------- Zonen ausgeben

const zoneFeatures: { type: 'Feature'; properties: ZoneOut; geometry: Geometry }[] = []
let skippedWithoutAutomat = 0
let totalSpaces = 0
let withDefect = 0

for (const zone of zones) {
  /**
   * Eine Zone ohne einen einzigen Automaten wird ausgelassen — dasselbe
   * Kriterium wie in Hamburg, Frankfurt und Köln: Ohne Zeiten kann die App
   * die eine Frage nicht beantworten, für die es sie gibt. Heute trifft es
   * keine der fünf.
   */
  if (zone.automats.length === 0) {
    skippedWithoutAutomat += 1
    continue
  }

  /**
   * Eine Bewohnerparkzone liegt in genau **einer** Tarifzone der Ordnung —
   * am Abzug nachgemessen (II bis V nur Zone 1, VI nur Zone 2). Läuft das
   * auseinander, ist die Zone nicht mehr mit einem Betrag zu beschreiben,
   * und statt eine Spanne zu erfinden bricht der Bau ab.
   */
  const tariffZones = new Set(zone.automats.map((automat) => automat.tariffZone))
  if (tariffZones.size !== 1) {
    throw new Error(
      `Parkzone ${zone.key}: Automaten aus ${tariffZones.size} Tarifzonen (${[...tariffZones].join(', ')})`
    )
  }
  const tariffZone = zone.automats[0]?.tariffZone as CottbusTariffZone

  // Auch Betrag und Zeiten müssen in der Zone einheitlich sein: Ein Feld je
  // Automat kann je Automat anders stehen, und `cottbusTariffFor` vergleicht
  // gegen genau einen Stand.
  const fees = new Set(zone.automats.map((automat) => JSON.stringify(automat.fee)))
  const texts = new Set(zone.automats.map((automat) => automat.scheduleText))
  if (fees.size !== 1 || texts.size !== 1) {
    throw new Error(
      `Parkzone ${zone.key}: ${fees.size} verschiedene Beträge, ${texts.size} verschiedene Zeitangaben — ` +
        'die Automaten einer Zone sagen nicht mehr dasselbe'
    )
  }
  const first = zone.automats[0] as Automat
  const tariff = cottbusTariffFor(
    tariffZone,
    first.fee,
    mergeCottbusWindows(zone.automats.flatMap((automat) => automat.windows)),
    first.scheduleText
  )
  if (tariff.sourceDefect !== null) withDefect += 1

  const simplified = simplifyGeometry(zone.geometry, 1e-5, 5)
  if (simplified === null) continue

  // Stellplätze: die Pkw-Plätze der Automaten in der Zone. Behinderten- und
  // Kradplätze stehen daneben in eigenen Feldern und zählen hier nicht mit —
  // sie sind nicht das, was ein Autofahrer sucht.
  const spaces = zone.automats.reduce((sum, automat) => sum + (automat.properties.pkw ?? 0), 0)
  totalSpaces += spaces

  zoneFeatures.push({
    type: 'Feature',
    properties: {
      zone: zone.key,
      // Kein Stadtteil-Dienst mit Lizenz — der Stadtname statt eines
      // geratenen Ortsteils, wie in Köln und Karlsruhe.
      district: COTTBUS.name,
      rawHours: tariff.rawHours,
      rawFee: tariff.rawFee,
      note: cottbusZoneNote(zone.properties, tariffZone),
      windows: tariff.windows,
      fee: tariff.fee,
      unmodelledRules: tariff.unmodelledRules,
      sourceDefect: tariff.sourceDefect,
      spaces: spaces > 0 ? spaces : null,
      // Die Ordnung überlässt die Höchstparkdauer dem einzelnen Automaten
      // (§ 3 Abs. 5), und der Feed führt sie nicht.
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

// Drei leere Sammlungen, damit `loadData` alle fünf Dateien bekommt.
write('districts.geojson', { type: 'FeatureCollection', features: [] })
write('poi.geojson', { type: 'FeatureCollection', features: [] })
write('umweltzone.geojson', { type: 'FeatureCollection', features: [] })

write('meta.json', {
  city: COTTBUS.key,
  cityName: COTTBUS.name,
  source: `${COTTBUS.attribution.source}, ArcGIS FeatureServer (Bewohnerparkzonen/7, Parkscheinautomaten/1)`,
  licence: COTTBUS.attribution.licence,
  licenceUrl: COTTBUS.attribution.licenceUrl,
  attributionRequired: COTTBUS.attribution.attributionRequired,
  datasetUrl: COTTBUS.attribution.datasetUrl,
  // Wann die Quelle zuletzt erfolgreich abgerufen wurde — siehe abruf-zeit.ts.
  geprueftAm: geprueftAm(RAW),
  zones: zoneFeatures.length,
  districts: 0,
  poi: 0,
  lowEmissionZone: false,
  segments: automats.length + withoutGeometry + withoutSchedule,
  managedSpaces: totalSpaces,
  crs: 'EPSG:4326 (lon/lat), vom Dienst aus EPSG:25833 umgerechnet (outSR=4326)',
  /**
   * `fee` steht hier NICHT: Ein Betrag wird ausgeliefert — der der
   * Parkgebührenordnung, nicht der des Feeds; `sourceDefect` je Zone sagt
   * es. `districts` fehlt, weil die Ebene keinen Lizenzvermerk trägt.
   */
  absent: ['districts', 'poi', 'lowEmissionZone', 'segments'],
})

// Die Zahlen gehören ins Log, nicht in einen Kommentar: Sie sind das, was
// beim nächsten Abzug anders sein kann.
console.log(
  `\n${zoneFeatures.length} von ${zones.length} Zonen übernommen` +
    ` — ${skippedWithoutAutomat} ohne einen einzigen Automaten, ${withDefect} mit Quellvermerk (Feed nennt Stand 2014)`
)
console.log(
  `${assigned} von ${automats.length} Automaten einer Zone zugeordnet,` +
    ` ${outsideEveryZone} außerhalb aller Zonen,` +
    ` ${withoutGeometry} ohne Geometrie, ${withoutSchedule} ohne Zeitangabe`
)
console.log(`${totalSpaces.toLocaleString('de-DE')} Pkw-Stellplätze an zugeordneten Automaten`)
