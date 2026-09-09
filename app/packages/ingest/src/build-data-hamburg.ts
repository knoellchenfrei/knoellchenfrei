/**
 * Baut Hamburgs Daten — das Gegenstück zu `build-data.ts`, das Berlin baut.
 *
 * Zwei Skripte statt eines mit zwei Zweigen: Die Feeds teilen sich außer der
 * Domäne nichts. Andere Felder, andere Schreibweisen, andere
 * Achsenreihenfolge, andere Lizenz. Ein gemeinsames Skript wäre bei jeder
 * Änderung an einer Stadt für die andere gefährlich, und der Preis dafür wären
 * ein paar Zeilen doppelte Ein-/Ausgabe.
 *
 * Was Hamburg **nicht** hat und Berlin schon:
 *
 * - **Keine POI.** Ladepunkte, P+R, Behindertenparkplätze und Carsharing
 *   liegen in Hamburg in anderen Diensten, mit anderen Feldern. Sie fehlen
 *   hier, statt halb dazusein.
 * - **Keine Umweltzone.** Hamburg hat keine; es gibt Durchfahrtsbeschränkungen
 *   für Diesel auf zwei Straßenabschnitten, und das ist etwas anderes.
 * - **Keine Straßenabschnitte.** `de.hh.up:parkraum` hätte 203.283 Polygone,
 *   je Stellplatz eines, ohne Tarif und mit leerem Zeitfeld. Begründung steht
 *   in `sources.ts`.
 *
 * Die Ausgabe trägt diese Lücken als Flags in `meta.json`, damit die
 * Oberfläche „gibt es hier nicht" von „noch nicht geladen" unterscheiden kann.
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

import {
  HAMBURG,
  isActiveHamburgZone,
  multiPolygonContains,
  parseHamburgFee,
  parseHamburgMaxStay,
  parseHamburgSchedule,
  type ChargeWindow,
  type Fee,
  type PolygonRings,
  type Position,
  type HamburgZoneProperties,
} from '@knoellchenfrei/core'

import { citySources, toGeoJsonAxes, type AxisOrder } from './sources.js'
import { simplifyGeometry } from './simplify.js'
import { geprueftAm } from './abruf-zeit.js'

const RAW = join(process.env.RAW_DIR ?? join(process.cwd(), '../../.raw'), HAMBURG.key)
const OUT = join(
  process.env.OUT_DIR ?? join(process.cwd(), '../../apps/web/public/data'),
  HAMBURG.key
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

const AXIS: AxisOrder =
  citySources(HAMBURG.key).find((source) => source.key === 'zones')?.axisOrder ?? 'lat,lon'

function readFeatures<P>(key: string): Feature<P>[] {
  const path = join(RAW, `${key}.json`)
  const parsed = JSON.parse(readFileSync(path, 'utf8')) as { features: Feature<P>[] }
  return parsed.features
}

/**
 * Achsen drehen, bevor irgendetwas anderes die Geometrie anfasst.
 *
 * Hamburg antwortet auf `urn:ogc:def:crs:EPSG::4326` mit `[lat, lon]`, Berlin
 * auf dieselbe Anfrage mit `[lon, lat]`. Ungedreht landen Hamburgs Gebiete bei
 * 9° Nord, 53° Ost — im Golf von Guinea. Auf der Karte sieht das nicht nach
 * einem Fehler aus, sondern nach einer leeren Stadt.
 */
function toGeoJson(geometry: Geometry | null): Geometry | null {
  if (geometry === null) return null
  return { type: geometry.type, coordinates: toGeoJsonAxes(geometry.coordinates, AXIS) }
}

function write(name: string, value: unknown): void {
  const path = join(OUT, name)
  mkdirSync(dirname(path), { recursive: true })
  const json = JSON.stringify(value)
  writeFileSync(path, json)
  console.log(`  ${name}: ${(json.length / 1024).toFixed(0)} KB`)
}

// ------------------------------------------------------------------- Zonen

/**
 * Dasselbe Feld-Schema wie Berlin.
 *
 * Nicht aus Ordnungsliebe: `ZoneProperties` im Web ist ein Typ, und eine
 * zweite Stadt mit eigenen Feldnamen hiesse zwei Typen, zwei Panels und zwei
 * Stellen, an denen ein Feld vergessen werden kann.
 *
 * Zwei Felder verhalten sich trotzdem unterschiedlich, und das ist Absicht:
 *
 * - `maxStayMinutes` setzt nur Hamburg. Dort ist die Hoechstparkdauer eine
 *   Regel des Gebiets und steht als Zahl im Feed. In Berlin ist sie eine
 *   Eigenschaft einzelner Strassenabschnitte — sie als Zonenregel auszugeben
 *   war dort ein gefundener Fehler, und `maxStayShare` sagt seitdem, auf wie
 *   wenigen Abschnitten sie überhaupt gilt.
 * - `spaces` bleibt null. Hamburgs Stellplatzzahl liegt in einer Ebene mit
 *   203.283 Polygonen, die diese App nicht abruft.
 */
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
  /** Verbindliche Hoechstparkdauer des Gebiets, in Minuten. */
  maxStayMinutes: number | null
  /** Berlins abschnittsweise Auswertung; in Hamburg gibt es sie nicht. */
  maxStay: string | null
  maxStayShare: number
  maxStayValues: string[]
  chargingPoints: number
  carsharing: number
}

// ------------------------------------------------------------- Stadtteile
//
// Zuerst, weil die Gebiete sie brauchen: Der Feed nennt zu einem
// Bewohnerparkgebiet keinen Stadtteil, nur einen Namen wie „N 101
// Flughafenstraße". Ohne Zuordnung stünde in der Kopfzeile des Panels
// dieselbe Zeichenkette zweimal.

interface District {
  name: string
  bezirk: string
  rings: PolygonRings[]
}

/** Alle Aussen- und Innenringe eines (Multi-)Polygons, als Liste von Polygonen. */
function toPolygons(geometry: Geometry): PolygonRings[] {
  if (geometry.type === 'Polygon') return [geometry.coordinates as PolygonRings]
  if (geometry.type === 'MultiPolygon') return geometry.coordinates as PolygonRings[]
  return []
}

const districtFeatures: {
  type: 'Feature'
  properties: { name: string; bezirk: string }
  geometry: Geometry
}[] = []
const districtIndex: District[] = []

for (const feature of readFeatures<Record<string, string>>('districts')) {
  const geometry = toGeoJson(feature.geometry)
  if (geometry === null) continue
  const name = feature.properties['stadtteil_name'] ?? ''
  const bezirk = feature.properties['bezirk_name'] ?? ''

  // Die Zuordnung läuft gegen die UNvereinfachte Geometrie. Vereinfachte
  // Grenzen wandern um bis zu ein paar Dutzend Meter, und ein Gebiet direkt an
  // der Stadtteilgrenze bekäme sonst den Nachbarn zugeschrieben.
  districtIndex.push({ name, bezirk, rings: toPolygons(geometry) })

  const simplified = simplifyGeometry(geometry, 1e-4, 5)
  if (simplified === null) continue
  districtFeatures.push({
    type: 'Feature',
    properties: { name, bezirk },
    geometry: simplified,
  })
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

// ------------------------------------------------------------------ Gebiete

const rawZones = readFeatures<HamburgZoneProperties>('zones')

// Ein geplantes Gebiet als geltend auszuliefern hiesse, vor einer
// Bewirtschaftung zu warnen, die es nicht gibt.
const active = rawZones.filter((feature) => isActiveHamburgZone(feature.properties))
const skippedInactive = rawZones.length - active.length

const zoneFeatures: { type: 'Feature'; properties: ZoneOut; geometry: Geometry }[] = []
let skippedWithoutHours = 0
let withoutDistrict = 0

for (const feature of active) {
  const p = feature.properties
  const zeiten = (p.bewirtschaftungszeit ?? '').trim()
  if (zeiten === '') {
    // Ohne Zeiten kann die App die eine Frage nicht beantworten, für die es
    // sie gibt. Ein Polygon ohne Antwort ist schlechter als kein Polygon.
    skippedWithoutHours += 1
    continue
  }
  const geometry = toGeoJson(feature.geometry)
  if (geometry === null) continue

  const district = districtAt(centroid(geometry))
  if (district === null) withoutDistrict += 1

  const simplified = simplifyGeometry(geometry, 1e-5, 5)
  if (simplified === null) continue

  const name = (p.bwp_name ?? '').replace(/\s+/g, ' ').trim()
  const art = (p.bewirtschaftungsart ?? '').trim()

  // 44 der 145 Flächen tragen in `bwp_code` den Platzhalter `-`: Es sind die
  // Flächen ohne Bewohnerparkrecht, für die die Quelle keine Zonennummer
  // führt. Bis zum 9. September ging der Strich als Schlüssel durch — und
  // damit zählte die Nutzungsstatistik 44 verschiedene Flächen als eine Zone,
  // die Suche fand unter `-` genau die erste. Der Ersatz ist nicht erfunden,
  // sondern die eigene Kennung des Anbieters (`DE.HH.UP_BEWOHNERPARKGEBIETE_<objectid>`);
  // sie ist über zwei Momentaufnahmen stabil (docs/todo.md, Abschnitt 5).
  // Die Oberfläche erkennt die Form und nennt die Fläche weiter „ohne Nummer".
  const code = (p.bwp_code ?? '').trim()
  const zone =
    code === '' || code === '-'
      ? (feature.id ?? `DE.HH.UP_BEWOHNERPARKGEBIETE_${String(p.objectid ?? '?')}`)
      : code

  zoneFeatures.push({
    type: 'Feature',
    properties: {
      zone,
      district: district?.name ?? 'Hamburg',
      rawHours: zeiten,
      rawFee: (p.gebuehrenzone ?? '').trim(),
      // Der Gebietsname und die Bewirtschaftungsart sind das, was die Quelle
      // über dieses Gebiet sonst noch sagt — und „Bewohner mit Ausweis frei"
      // ist für den Leser die halbe Antwort.
      note: [name, art].filter((part) => part !== '').join(' — ') || null,
      windows: parseHamburgSchedule(zeiten),
      fee: parseHamburgFee(p.gebuehrenzone),
      // Hamburgs Feed kennt nichts, was ChargeWindow nicht ausdruecken kann —
      // die Advents-Samstage sind eine Berliner Eigenheit. Das Feld bleibt,
      // damit beide Städte dieselbe Form haben.
      unmodelledRules: [],
      sourceDefect: null,
      spaces: null,
      maxStayMinutes: parseHamburgMaxStay(p.hoechstparkdauer) ?? null,
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

// ------------------------------------------------------- was es nicht gibt

// Leere Sammlungen statt fehlender Dateien: `loadData` holt für jede Stadt
// dieselben fünf Namen, und ein 404 wäre von einem echten Ladefehler nicht zu
// unterscheiden. `meta.json` sagt, dass die Leere Absicht ist.
write('poi.geojson', { type: 'FeatureCollection', features: [] })
write('umweltzone.geojson', { type: 'FeatureCollection', features: [] })

write('meta.json', {
  city: HAMBURG.key,
  cityName: HAMBURG.name,
  source: `${HAMBURG.attribution.source}, WFS 2.0.0`,
  licence: HAMBURG.attribution.licence,
  licenceUrl: HAMBURG.attribution.licenceUrl,
  attributionRequired: HAMBURG.attribution.attributionRequired,
  datasetUrl: HAMBURG.attribution.datasetUrl,
  // Wann die Quelle zuletzt erfolgreich abgerufen wurde — siehe abruf-zeit.ts.
  geprueftAm: geprueftAm(RAW),
  zones: zoneFeatures.length,
  districts: districtFeatures.length,
  poi: 0,
  lowEmissionZone: false,
  segments: 0,
  managedSpaces: 0,
  crs: 'EPSG:4326 (lon/lat)',
  /** Was diese Stadt nicht liefert — damit die Oberfläche es sagen kann. */
  absent: ['poi', 'umweltzone', 'segments'],
})

console.log(
  `\n${zoneFeatures.length} Gebiete, ${districtFeatures.length} Stadtteile` +
    ` — ${skippedInactive} nicht aktiv, ${skippedWithoutHours} ohne Zeitangabe ausgelassen` +
    `, ${withoutDistrict} ohne Stadtteil-Treffer`
)
