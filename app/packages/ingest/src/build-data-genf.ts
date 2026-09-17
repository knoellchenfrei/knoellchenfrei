/**
 * Baut Genfs Daten — die erste Stadt in der Schweiz und die erste der
 * Klasse C: Die Quelle nennt Zonengrenzen, aber weder Zeiten noch Beträge.
 *
 * Was Genf **anders** macht als die Städte davor:
 *
 * - **Kein WFS.** Vier Ebenen aus ArcGIS-MapServern des SITG
 *   (`sources.ts`, `GENF_FILES`), abgerufen mit `f=geojson&outSR=4326`.
 *   Die Achsen kommen als `[lon, lat]`; `assertDegrees` hält es, weil ein
 *   Dienst, der `outSR` eines Tages ignoriert, in Schweizer
 *   Landeskoordinaten (EPSG:2056, Meter um 2.500.000) antworten würde —
 *   plausible Zahlen, nur keine Grade.
 * - **Jede Zone trägt `scheduleUnknown`.** `windows: []`, `fee: unknown`,
 *   `rawHours` und `rawFee` leer. Die App sagt „Zeiten unbekannt" und färbt
 *   grau. Was die Quelle sonst weiß, steht in `note`: Sektor und Datum der
 *   Inbetriebnahme.
 * - **Die Sachauskunft kommt aus den Stellplatzreihen.** 13.236
 *   Parkierungslinien mit Art (`Payant 90 min`, `Gratuit 60 min` …) und
 *   Platzzahl; jede wird über ihren Mittelpunkt einer Zone zugeordnet, und
 *   daraus kommen `spaces`, `maxStay`, `maxStayShare` und `maxStayValues` —
 *   dieselbe Form wie Berlins Abschnittsauswertung, nur über Plätze statt
 *   Abschnitte. Eine Reihe, deren Art der Parser nicht kennt, wird
 *   **gezählt und genannt**, nicht geraten.
 * - **Die Stadt ist die Ville de Genève, nicht der Kanton.** Der Datensatz
 *   führt 53 Zonen im ganzen Kanton; behalten wird, was in einem der acht
 *   Quartiere liegt — 17 Zonen `A`–`Q`. Der Rest steht mit Buchstaben und
 *   Sektor im Log, damit niemand ihn für verloren hält.
 *
 * Was Genf **nicht** hat und andere schon: Umweltzone (es gibt keine),
 * Straßenabschnitte als Ebene, Ladepunkte, Carsharing, P+R. `poi.geojson`
 * trägt die Behindertenparkplätze der Ville.
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

import {
  cityByKey,
  genfMaxStayCode,
  genfStreetLabel,
  genfZoneKey,
  GenfParseError,
  multiPolygonContains,
  parseGenfTypeStationnement,
  type ChargeWindow,
  type Fee,
  type GenfLineProperties,
  type GenfZoneProperties,
  type PolygonRings,
  type Position,
} from '@knoellchenfrei/core'

import { roundPoint, simplifyGeometry } from './simplify.js'
import { geprueftAm } from './abruf-zeit.js'

/**
 * Die Stadt kommt aus `core/city.ts`, nicht aus einer Kopie hier — die
 * Grenzen stehen im Projekt an genau einer Stelle.
 */
const GENF = cityByKey('genf')

const RAW = join(process.env.RAW_DIR ?? join(process.cwd(), '../../.raw'), GENF.key)
const OUT = join(process.env.OUT_DIR ?? join(process.cwd(), '../../apps/web/public/data'), GENF.key)

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
  // Ein abgeschnittener Abruf sähe sonst aus wie eine kleinere Stadt. Für
  // die Linien nimmt `fetch.ts` die Marke beim Zusammensetzen der Seiten
  // heraus; steht sie hier noch, ist die Datei nicht aus `fetch-data`.
  if (parsed.exceededTransferLimit === true) {
    throw new Error(`${key}: der Dienst hat die Antwort abgeschnitten (exceededTransferLimit)`)
  }
  return parsed.features
}

/**
 * Grade oder nichts.
 *
 * `outSR=4326` verlangt Grade; ohne den Parameter antwortet der Dienst im
 * System der Ebene, und das ist beim SITG EPSG:2056 — Meter um 2.500.000 /
 * 1.120.000. Plausible Zahlen, keine Fehlermeldung, auf der Karte nur leer.
 */
function assertDegrees(key: string, geometry: Geometry): void {
  const walk = (node: unknown): void => {
    if (!Array.isArray(node)) return
    if (typeof node[0] === 'number' && typeof node[1] === 'number') {
      const [lon, lat] = node as number[]
      if (Math.abs(lon as number) > 180 || Math.abs(lat as number) > 90) {
        throw new Error(
          `${key}: ${lon}/${lat} sind keine Grade — der Dienst hat vermutlich in EPSG:2056 ` +
            'geantwortet. outSR=4326 fehlt in der Anfrage.'
        )
      }
      return
    }
    node.forEach(walk)
  }
  walk(geometry.coordinates)
}

function toPolygons(geometry: Geometry): PolygonRings[] {
  if (geometry.type === 'Polygon') return [geometry.coordinates as PolygonRings]
  if (geometry.type === 'MultiPolygon') return geometry.coordinates as PolygonRings[]
  return []
}

/** Mittelpunkt aller Stützpunkte — reicht, um ein Quartier oder eine Zone zu treffen. */
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

function write(name: string, value: unknown): void {
  const path = join(OUT, name)
  mkdirSync(dirname(path), { recursive: true })
  const json = JSON.stringify(value)
  writeFileSync(path, json)
  console.log(`  ${name}: ${(json.length / 1024).toFixed(0)} KB`)
}

console.log('Genf — Daten bauen …')

// -------------------------------------------------------------- Quartiere
//
// Zuerst, weil die Zonen sie doppelt brauchen: als Ortsangabe im Panel und
// als Filter — was in keinem Quartier liegt, gehört einer anderen Gemeinde.

interface District {
  name: string
  rings: PolygonRings[]
}

interface DistrictProperties {
  OBJECTID?: number | null
  NOM_QUARTIER?: string | null
}

const districtFeatures: { type: 'Feature'; properties: { name: string }; geometry: Geometry }[] = []
const districtIndex: District[] = []

for (const feature of readFeatures<DistrictProperties>('districts')) {
  const geometry = feature.geometry
  if (geometry === null) continue
  assertDegrees('districts', geometry)
  const name = (feature.properties.NOM_QUARTIER ?? '').replace(/\s+/g, ' ').trim()
  if (name === '') throw new Error(`districts: Quartier ${String(feature.properties.OBJECTID)} ohne Namen`)

  // Die Zuordnung läuft gegen die UNvereinfachte Geometrie. Vereinfachte
  // Grenzen wandern um ein paar Dutzend Meter, und eine Zone an der
  // Gemeindegrenze — die Arve gegen Carouge — bekäme sonst den Nachbarn.
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
  /** Klasse C: Die Quelle nennt keine Zeiten — an jeder Zone, nie an einer mit Zeiten. */
  scheduleUnknown: true
  spaces: number | null
  maxStayMinutes: number | null
  maxStay: string | null
  maxStayShare: number
  maxStayValues: string[]
  chargingPoints: number
  carsharing: number
}

interface VilleZone {
  key: string
  sector: string
  since: string | null
  district: string
  rings: PolygonRings[]
  geometry: Geometry
}

const rawZones = readFeatures<GenfZoneProperties>('zones')
const villeZones: VilleZone[] = []
const outsideVille: string[] = []
let withoutKey = 0
const seenKeys = new Set<string>()

for (const feature of rawZones) {
  const p = feature.properties
  const geometry = feature.geometry
  if (geometry === null) continue
  assertDegrees('zones', geometry)

  let key: string
  try {
    key = genfZoneKey(p)
  } catch (error) {
    // Nur die eigene Fehlerklasse ist „Zone ohne Schlüssel"; alles andere
    // ist ein kaputter Parser und soll den Lauf abbrechen.
    if (!(error instanceof GenfParseError)) throw error
    withoutKey += 1
    console.warn(`  ausgelassen: FID ${String(p['SITG_ADM.OTC_MACARON.FID'])} — ${error.message}`)
    continue
  }
  const sector = (p.NOM_SECTEUR ?? '').replace(/\s+/g, ' ').trim()

  const district = districtAt(centroid(geometry))
  if (district === null) {
    outsideVille.push(`${key} (${sector || 'ohne Sektor'})`)
    continue
  }
  if (seenKeys.has(key)) throw new Error(`zones: Zone ${key} kommt zweimal vor`)
  seenKeys.add(key)

  const since = typeof p.MISE_EN_SERVICE === 'number' ? new Date(p.MISE_EN_SERVICE).toISOString().slice(0, 10) : null
  villeZones.push({ key, sector, since, district: district.name, rings: toPolygons(geometry), geometry })
}

// ---------------------------------------------------------- Stellplatzreihen
//
// Die einzige Sachauskunft der Quelle. Je Reihe Art und Platzzahl; die Reihe
// gehört zu der Zone, in der ihr Mittelpunkt liegt. Reihen außerhalb der 17
// Zonen — die halbe Stadt, weil nur die bewirtschafteten Quartiere Zonen
// haben, und der ganze übrige Kanton — werden gezählt und sonst nicht
// gebraucht.

interface ZoneStats {
  lines: number
  /** Plätze für Autos mit Regime — bezahlt oder Blaue Zone/frei. */
  carPlaces: number
  payantPlaces: number
  /** Plätze mit Höchstdauer, je Schlüssel der Oberfläche (`90min`, `1h`). */
  limited: Map<string, number>
  unlimitedPlaces: number
  /** Zweiräder, Velos, Polizei, gelbe Sonderplätze … — gezählt, nicht ausgeliefert. */
  otherPlaces: number
}

const stats = new Map<string, ZoneStats>()
for (const zone of villeZones) {
  stats.set(zone.key, { lines: 0, carPlaces: 0, payantPlaces: 0, limited: new Map(), unlimitedPlaces: 0, otherPlaces: 0 })
}

const rawLines = readFeatures<GenfLineProperties>('lines')
const unreadableTypes = new Map<string, number>()
let linesOutsideZones = 0
let linesWithoutPlaces = 0

for (const feature of rawLines) {
  const geometry = feature.geometry
  if (geometry === null) continue
  assertDegrees('lines', geometry)
  const mid = centroid(geometry)
  const zone = villeZones.find((candidate) => mid !== null && multiPolygonContains(candidate.rings, mid))
  if (zone === undefined) {
    linesOutsideZones += 1
    continue
  }
  const p = feature.properties
  let type
  try {
    type = parseGenfTypeStationnement(p.TYPE_STATIONNEMENT)
  } catch (error) {
    if (!(error instanceof GenfParseError)) throw error
    const label = String(p.TYPE_STATIONNEMENT ?? 'null')
    unreadableTypes.set(label, (unreadableTypes.get(label) ?? 0) + 1)
    continue
  }
  const stat = stats.get(zone.key) as ZoneStats
  stat.lines += 1
  // 28 der 13.236 Reihen nennen keine Platzzahl. Sie zählen als Reihe, aber
  // nicht als Plätze — eine geratene Zahl wäre schlechter als eine fehlende.
  const places = typeof p.NOMBRE_PLACES === 'number' && p.NOMBRE_PLACES > 0 ? p.NOMBRE_PLACES : 0
  if (places === 0) linesWithoutPlaces += 1
  if (type.vehicles === 'other') {
    stat.otherPlaces += places
    continue
  }
  stat.carPlaces += places
  if (type.regime === 'payant') stat.payantPlaces += places
  if (type.maxStayMinutes === null) {
    stat.unlimitedPlaces += places
  } else {
    const code = genfMaxStayCode(type.maxStayMinutes)
    stat.limited.set(code, (stat.limited.get(code) ?? 0) + places)
  }
}

const zoneFeatures: { type: 'Feature'; properties: ZoneOut; geometry: Geometry }[] = []
let managedSpaces = 0

for (const zone of villeZones) {
  const stat = stats.get(zone.key) as ZoneStats
  const simplified = simplifyGeometry(zone.geometry, 1e-5, 5)
  if (simplified === null) continue

  // Wie in Berlin: die häufigste Höchstdauer als `maxStay`, ihr Anteil an
  // allen Autoplätzen als `maxStayShare`, alle Werte nach Häufigkeit als
  // `maxStayValues`. Plätze statt Abschnitte, weil die Quelle Plätze zählt.
  const stayEntries = [...stat.limited.entries()].sort((a, b) => b[1] - a[1])
  const limitedPlaces = stayEntries.reduce((sum, [, count]) => sum + count, 0)
  const maxStayShare = stat.carPlaces > 0 ? Math.round((limitedPlaces / stat.carPlaces) * 1000) / 1000 : 0
  managedSpaces += stat.carPlaces

  zoneFeatures.push({
    type: 'Feature',
    properties: {
      zone: zone.key,
      district: zone.district,
      rawHours: '',
      rawFee: '',
      // Was die Quelle über die Zone sonst sagt: der Sektor, wörtlich
      // französisch, und seit wann es sie gibt.
      note: [`Secteur ${zone.sector}`, zone.since === null ? null : `Macaron-Zone seit ${zone.since}`]
        .filter((part) => part !== null)
        .join(' — '),
      windows: [],
      fee: { kind: 'unknown' },
      unmodelledRules: [],
      sourceDefect: null,
      scheduleUnknown: true,
      spaces: stat.carPlaces > 0 ? stat.carPlaces : null,
      maxStayMinutes: null,
      maxStay: stayEntries[0]?.[0] ?? null,
      maxStayShare,
      maxStayValues: stayEntries.map(([code]) => code),
      chargingPoints: 0,
      carsharing: 0,
    },
    geometry: simplified,
  })
}

write('zones.geojson', { type: 'FeatureCollection', features: zoneFeatures })

// -------------------------------------------------------------------- POI
//
// Die Behindertenparkplätze des Kantons, behalten wird die Ville — dasselbe
// Kriterium wie bei den Zonen: der Punkt liegt in einem Quartier.

interface AccessibleProperties {
  VOIE?: string | null
  LOCALISATION?: string | null
  PLACE_ELARGIE?: string | null
  DUREE?: string | null
  NOMBRE_PLACES?: number | null
}

const poi: { type: 'Feature'; properties: Record<string, unknown>; geometry: Geometry }[] = []
let accessibleOutside = 0

for (const feature of readFeatures<AccessibleProperties>('accessible')) {
  const geometry = feature.geometry
  if (geometry === null || geometry.type !== 'Point') continue
  assertDegrees('accessible', geometry)
  const point = geometry.coordinates as Position
  if (districtAt(point) === null) {
    accessibleOutside += 1
    continue
  }
  const p = feature.properties
  const street = genfStreetLabel(p.VOIE)
  const number = (p.LOCALISATION ?? '').trim()
  const count = typeof p.NOMBRE_PLACES === 'number' && p.NOMBRE_PLACES > 0 ? p.NOMBRE_PLACES : Number.NaN
  const duration = (p.DUREE ?? '').trim()
  const detail = [
    Number.isFinite(count) ? `${count} ${count === 1 ? 'Platz' : 'Plätze'}` : null,
    // Die Dauer steht französisch, wie die Quelle sie schreibt („3 heures").
    duration === '' ? null : `Höchstdauer ${duration}`,
    (p.PLACE_ELARGIE ?? '').trim().toUpperCase() === 'OUI' ? 'verbreitert' : null,
  ]
    .filter((part) => part !== null)
    .join(' · ')
  poi.push({
    type: 'Feature',
    properties: {
      kind: 'accessible',
      label: [street, number].filter((part) => part !== '').join(' ') || 'Behindertenparkplatz',
      detail: detail === '' ? null : detail,
    },
    geometry: { type: 'Point', coordinates: roundPoint(geometry.coordinates as [number, number]) },
  })
}

write('poi.geojson', { type: 'FeatureCollection', features: poi })

// ------------------------------------------------------- was es nicht gibt

write('umweltzone.geojson', { type: 'FeatureCollection', features: [] })

write('meta.json', {
  city: GENF.key,
  cityName: GENF.name,
  source: `${GENF.attribution.source}, ArcGIS REST (vector.sitg.ge.ch)`,
  licence: GENF.attribution.licence,
  licenceUrl: GENF.attribution.licenceUrl,
  attributionRequired: GENF.attribution.attributionRequired,
  datasetUrl: GENF.attribution.datasetUrl,
  geprueftAm: geprueftAm(RAW),
  zones: zoneFeatures.length,
  districts: districtFeatures.length,
  poi: poi.length,
  lowEmissionZone: false,
  segments: 0,
  managedSpaces,
  crs: 'EPSG:4326 (lon/lat)',
  // `schedule` und `fee`: Klasse C — die Quelle nennt weder Zeiten noch
  // Beträge, und die Oberfläche soll das von „noch nicht geladen"
  // unterscheiden können.
  absent: ['schedule', 'fee', 'umweltzone', 'segments'],
})

// Was draußen bleibt, steht mit Namen im Log — 36 Zonen sind kein Rundungsfehler.
if (outsideVille.length > 0) {
  console.log(`  außerhalb der Ville de Genève, nicht ausgeliefert (${outsideVille.length}): ${outsideVille.join(', ')}`)
}
for (const [label, count] of [...unreadableTypes.entries()].sort((a, b) => b[1] - a[1])) {
  console.warn(`  unlesbare Stellplatzart ${JSON.stringify(label)}: ${count} Reihen ausgelassen`)
}

const linesInZones = [...stats.values()].reduce((sum, stat) => sum + stat.lines, 0)
const otherPlaces = [...stats.values()].reduce((sum, stat) => sum + stat.otherPlaces, 0)
console.log(
  `\n${zoneFeatures.length} von ${rawZones.length} Zonen übernommen (${withoutKey} ohne Schlüssel, ` +
    `${outsideVille.length} außerhalb der Ville), ${districtFeatures.length} Quartiere, ${poi.length} Behindertenparkplätze ` +
    `(${accessibleOutside} außerhalb)` +
    `\n${linesInZones} von ${rawLines.length} Stellplatzreihen in den Zonen (${linesOutsideZones} außerhalb, ` +
    `${[...unreadableTypes.values()].reduce((a, b) => a + b, 0)} unlesbar, ${linesWithoutPlaces} ohne Platzzahl): ` +
    `${managedSpaces} Autoplätze mit Regime, ${otherPlaces} Plätze anderer Art`
)
