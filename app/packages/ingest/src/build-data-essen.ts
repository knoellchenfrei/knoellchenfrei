/**
 * Baut Essens Daten — das Gegenstück zu `build-data.ts` für die erste Stadt
 * der **Klasse C**, und deshalb das kürzeste der Skripte.
 *
 * Was Essen **anders** macht als die sechzehn Städte davor:
 *
 * - **Die Quelle nennt keine Zeiten und keinen Betrag.** Die neun
 *   Bewohnerparkbereiche kommen als Flächen mit einem einzigen Sachfeld,
 *   `NameGebiet`. Es gibt nichts zu parsen außer dem Namen; jede Zone geht
 *   mit `scheduleUnknown: true`, `windows: []` und `fee: { kind: 'unknown' }`
 *   hinaus, und `meta.absent` führt `schedule` und `fee`. Die Tarife der
 *   Stadtseite (Parkzone 1 bis 6) stehen **nicht** in den Daten, weil die
 *   Flächen nicht die Parkzonen sind — `docs/staedte-essen.md`.
 * - **Kein WFS.** Drei fertige GeoJSON-Dateien aus dem DKAN-Portal
 *   (`sources.ts`, `ESSEN_FILES`), alle `[lon, lat]` in Grad. `assertDegrees`
 *   hält es trotzdem, und `assertInEssen` dazu: Eine Datei, die eines Tages
 *   in ETRS89/UTM (EPSG 4647, wie die Shape-Fassung daneben) käme, hätte
 *   siebenstellige Zahlen — und eine in `[lat, lon]` läge im Indischen Ozean,
 *   mit gültigen Graden.
 * - **Der Schlüssel ist der Name.** `FID` ist die Zeilennummer der Datei und
 *   `Id` bei allen neun `0`. Wie in Köln und Düsseldorf ist der lesbare Name
 *   der Schlüssel; `parseEssenAreaName` in `core` prüft die Form, und ein
 *   doppelter Name bricht ab, weil er auf der Statistikseite eine Zone wäre
 *   und auf der Karte zwei.
 *
 * Was Essen hat und Rostock nicht: die **Umweltzone** (drei Polygone aus
 * demselben Portal). Was es nicht hat: POI, Straßenabschnitte. Die Dateien
 * werden trotzdem geschrieben, leer — `loadData` holt alle fünf.
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

import {
  cityByKey,
  EssenParseError,
  multiPolygonContains,
  parseEssenAreaName,
  type ChargeWindow,
  type EssenZoneProperties,
  type Fee,
  type PolygonRings,
  type Position,
} from '@knoellchenfrei/core'

import { simplifyGeometry } from './simplify.js'
import { geprueftAm } from './abruf-zeit.js'

/** Die Stadt aus `core/city.ts`, nicht als Kopie hier — die Grenzen stehen genau einmal. */
const ESSEN = cityByKey('essen')

const RAW = join(process.env.RAW_DIR ?? join(process.cwd(), '../../.raw'), ESSEN.key)
const OUT = join(
  process.env.OUT_DIR ?? join(process.cwd(), '../../apps/web/public/data'),
  ESSEN.key
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
}

/** Die Dateinamen stehen in `sources.ts` (`file`); hier dieselben drei. */
function readFeatures<P>(file: string): Feature<P>[] {
  const parsed = JSON.parse(readFileSync(join(RAW, file), 'utf8')) as Collection<P>
  if (!Array.isArray(parsed.features)) throw new Error(`${file}: keine FeatureCollection`)
  return parsed.features
}

/**
 * Grade oder nichts.
 *
 * Die Shape-Fassung derselben Datensätze liegt in ETRS89/UTM 32 (EPSG 4647,
 * mit Zonenkennziffer: `32370000` Ost) — plausible Zahlen, keine Grade, auf
 * der Karte nur leer. Sollte das Portal die GeoJSON-Datei eines Tages daraus
 * neu erzeugen, bricht der Bau hier ab statt eine leere Karte auszuliefern.
 */
function assertDegrees(key: string, geometry: Geometry): void {
  const walk = (node: unknown): void => {
    if (!Array.isArray(node)) return
    if (typeof node[0] === 'number' && typeof node[1] === 'number') {
      const [lon, lat] = node as number[]
      if (Math.abs(lon as number) > 180 || Math.abs(lat as number) > 90) {
        throw new Error(
          `${key}: ${lon}/${lat} sind keine Grade — die Datei ist vermutlich in ` +
            'ETRS89/UTM (EPSG 4647) statt WGS84 exportiert.'
        )
      }
      return
    }
    node.forEach(walk)
  }
  walk(geometry.coordinates)
}

/**
 * Bricht ab, wenn ein Punkt außerhalb Essens liegt.
 *
 * Die Achsenreihenfolge steht nirgends in der Datei (die Stadtteile tragen
 * nicht einmal ein `crs`); dieser Test misst, ob `[lon, lat]` stimmt. Gedreht
 * läge die Innenstadt bei 7° Nord, 51° Ost — vor Somalia, mit gültigen
 * Graden.
 *
 * Gemessen wird gegen zwei Rahmen, und der Unterschied ist kein Zufall:
 * `reportBounds` endet im Süden bei 51,351 und damit 380 m **über** der
 * Stadtgrenze (51,3476 bei Kettwig vor der Brücke) — der Preis dafür, dass
 * Düsseldorfs und Essens Rahmen sich nicht schneiden (`core/city.ts`). Die
 * Stadtteile und die Umweltzone reichen bis an die Stadtgrenze und werden
 * deshalb gegen `sessionBounds` geprüft; die ersten Läufe brachen genau an
 * Kettwig ab. Die **Zonen** müssen dagegen im Melderahmen liegen, denn eine
 * Zone, in der niemand melden kann, wäre auf der Karte ein stummer Fleck.
 */
function assertInEssen(key: string, geometry: Geometry, frame: 'report' | 'session'): void {
  const b = frame === 'report' ? ESSEN.reportBounds : ESSEN.sessionBounds
  const walk = (node: unknown): void => {
    if (!Array.isArray(node)) return
    if (typeof node[0] === 'number' && typeof node[1] === 'number') {
      const [lon, lat] = node as [number, number]
      if (lon < b.minLon || lon > b.maxLon || lat < b.minLat || lat > b.maxLat) {
        throw new Error(
          `${key}: ${lon}/${lat} liegt nicht in Essen (${frame}) — Achsenreihenfolge oder Rahmen in core/city.ts prüfen`
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

/** Alle Außen- und Innenringe eines (Multi-)Polygons, als Liste von Polygonen. */
function toPolygons(geometry: Geometry): PolygonRings[] {
  if (geometry.type === 'Polygon') return [geometry.coordinates as PolygonRings]
  if (geometry.type === 'MultiPolygon') return geometry.coordinates as PolygonRings[]
  return []
}

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

console.log('Essen — Daten bauen …')

// ------------------------------------------------------------- Stadtteile
//
// Zuerst, weil die Zonen sie brauchen: „Museum-Nord (II)" sagt niemandem,
// wo das ist. Der Stadtteil (Südviertel, Stadtkern, Ostviertel) ist die
// Ebene, in der die Suche und die Kopfzeile des Panels denken.

interface District {
  name: string
  rings: PolygonRings[]
}

/** Die Felder der Stadtteil-Datei, so weit sie hier gelesen werden. */
interface DistrictProperties {
  FID?: number | null
  OBJECTID?: number | null
  /** Der Name, z. B. `Rüttenscheid`. */
  STADTTEILE?: string | null
  /** Statistische Nummer, z. B. 308 — Bezirk 3, Stadtteil 08. */
  STAT_NR?: number | null
  STADTBEZ?: number | null
}

const districtFeatures: { type: 'Feature'; properties: { name: string }; geometry: Geometry }[] = []
const districtIndex: District[] = []

for (const feature of readFeatures<DistrictProperties>('districts.json')) {
  const geometry = feature.geometry
  if (geometry === null) continue
  assertDegrees('districts', geometry)
  assertInEssen('districts', geometry, 'session')
  const name = (feature.properties.STADTTEILE ?? '').replace(/\s+/g, ' ').trim()
  if (name === '') throw new Error(`districts: Stadtteil ${String(feature.properties.STAT_NR)} ohne Namen`)

  // Die Zuordnung läuft gegen die UNvereinfachte Geometrie. Vereinfachte
  // Grenzen wandern um bis zu ein paar Dutzend Meter, und eine Zone an der
  // Stadtteilgrenze bekäme sonst den Nachbarn zugeschrieben.
  districtIndex.push({ name, rings: toPolygons(geometry) })

  // Anzeigeebene, deshalb zwei Größenordnungen gröber als die Zonen: Die
  // Datei hat 67.933 Stützpunkte für 50 Stadtteile, das Ergebnis passt in
  // den Vorrat des Service Workers.
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

/**
 * Dasselbe Feld-Schema wie in allen anderen Städten — ein Typ, ein Panel —
 * plus `scheduleUnknown`, die Marke der Klasse C (`ZoneProperties` in
 * `apps/web/src/types.ts`).
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
  scheduleUnknown: true
  spaces: number | null
  maxStayMinutes: number | null
  maxStay: string | null
  maxStayShare: number
  maxStayValues: string[]
  chargingPoints: number
  carsharing: number
}

const rawZones = readFeatures<EssenZoneProperties>('zones.json')
const zoneFeatures: { type: 'Feature'; properties: ZoneOut; geometry: Geometry }[] = []
const seen = new Set<string>()
let withoutDistrict = 0

for (const feature of rawZones) {
  const geometry = feature.geometry
  if (geometry === null) continue
  assertDegrees('zones', geometry)
  assertInEssen('zones', geometry, 'report')

  // Nicht auslassen, sondern abbrechen: Bei neun Flächen ist jede einzelne
  // ein Zehntel der Stadt, und ein Feed, der einen Namen leer lässt, soll
  // gesehen werden — nur die eigene Fehlerklasse wird dafür übersetzt, alles
  // andere ist ein kaputter Parser und fliegt unverändert.
  let area
  try {
    area = parseEssenAreaName(feature.properties.NameGebiet ?? '')
  } catch (error) {
    if (!(error instanceof EssenParseError)) throw error
    throw new Error(`zones: FID ${String(feature.properties.FID)}: ${error.message}`, { cause: error })
  }
  if (seen.has(area.label)) throw new Error(`zones: Gebiet „${area.label}" kommt zweimal vor`)
  seen.add(area.label)

  const district = districtAt(centroid(geometry))
  if (district === null) withoutDistrict += 1

  const simplified = simplifyGeometry(geometry, 1e-5, 5)
  if (simplified === null) continue

  zoneFeatures.push({
    type: 'Feature',
    properties: {
      zone: area.label,
      district: district?.name ?? ESSEN.name,
      // Leer, nicht erfunden: Es gibt keinen Rohtext, den das Panel zitieren
      // könnte. Die Sätze dazu („keine Zeiten und keinen Tarif, nur seine
      // Grenze") kommen aus `scheduleUnknown`.
      rawHours: '',
      rawFee: '',
      note: `Bewohnerparkbereich ${area.label}`,
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

// ------------------------------------------------------------- Umweltzone

const lowEmissionFeatures: { type: 'Feature'; properties: { name: string }; geometry: Geometry }[] = []
for (const feature of readFeatures<Record<string, unknown>>('umweltzone.json')) {
  const geometry = feature.geometry
  if (geometry === null) continue
  assertDegrees('lowEmissionZone', geometry)
  assertInEssen('lowEmissionZone', geometry, 'session')
  const simplified = simplifyGeometry(geometry, 1e-5, 5)
  if (simplified === null) continue
  lowEmissionFeatures.push({ type: 'Feature', properties: { name: 'Umweltzone' }, geometry: simplified })
}

write('umweltzone.geojson', { type: 'FeatureCollection', features: lowEmissionFeatures })

// ------------------------------------------------------- was es nicht gibt

// Leere Sammlung statt fehlender Datei: `loadData` holt für jede Stadt
// dieselben fünf Namen, und ein 404 wäre von einem echten Ladefehler nicht zu
// unterscheiden. `meta.json` sagt, dass die Leere Absicht ist.
write('poi.geojson', { type: 'FeatureCollection', features: [] })

write('meta.json', {
  city: ESSEN.key,
  cityName: ESSEN.name,
  source: `${ESSEN.attribution.source}, GeoJSON-Download (DKAN)`,
  licence: ESSEN.attribution.licence,
  licenceUrl: ESSEN.attribution.licenceUrl,
  attributionRequired: ESSEN.attribution.attributionRequired,
  datasetUrl: ESSEN.attribution.datasetUrl,
  // Wann die Quelle zuletzt erfolgreich abgerufen wurde — siehe abruf-zeit.ts.
  geprueftAm: geprueftAm(RAW),
  zones: zoneFeatures.length,
  districts: districtFeatures.length,
  poi: 0,
  lowEmissionZone: lowEmissionFeatures.length > 0,
  segments: 0,
  managedSpaces: 0,
  crs: 'EPSG:4326 (lon/lat)',
  /**
   * Was dieser Abzug nicht enthält. `schedule` und `fee` sind die Marke der
   * Klasse C: Die Quelle nennt für keine Fläche Zeiten oder Betrag. `poi`
   * heißt „nicht im Katalog" — Behindertenparkplätze führt das Portal nicht.
   */
  absent: ['poi', 'segments', 'schedule', 'fee'],
})

// Die Zahlen gehören ins Log, nicht in einen Kommentar: Sie sind das, was beim
// nächsten Abzug anders sein kann, und ein Sprung darin ist das erste, was
// auffällt.
console.log(
  `\n${zoneFeatures.length} von ${rawZones.length} Bewohnerparkbereichen übernommen, alle ohne Zeiten und Tarif` +
    ` — ${withoutDistrict} ohne Stadtteil-Treffer; ${districtFeatures.length} Stadtteile,` +
    ` Umweltzone in ${lowEmissionFeatures.length} Flächen`
)
