/**
 * Baut Hildesheims Daten — Klasse C wie Essen und Kassel, und wie dort das
 * kürzeste der Skripte, weil die Quelle nur Grenzen nennt.
 *
 * Was Hildesheim **anders** macht als die Städte davor:
 *
 * - **Zwei WFS-Ebenen, ein Buchstabe.** Die sieben Bewohnerparkzonen kommen
 *   als Polygone mit `Zone A` … `Zone G`; es gibt nichts zu parsen außer dem
 *   Buchstaben (`parseHildesheimZoneName` in `core`). Jede Zone geht mit
 *   `scheduleUnknown: true`, `windows: []` und `fee: { kind: 'unknown' }`
 *   hinaus, und `meta.absent` führt `schedule` und `fee`. Die Beträge der
 *   Gebührenordnung der Stadt stehen **nicht** in den Daten — der Dienst
 *   nennt sie nicht, und die Gebührenordnung war am 17. September 2026 unter
 *   ihrer Adresse nicht mehr abrufbar (410); `docs/staedte-hildesheim.md`.
 * - **`[lon, lat]` trotz MapServer.** Die Recherche notierte für dieselbe
 *   Ebene `[lat, lon]` — gemessen im GML von WFS 1.1.0. Das GeoJSON von
 *   2.0.0 kommt ungedreht; `sources.ts` sagt `lon,lat`, und
 *   `assertInHildesheim` misst nach: Gedreht läge die Altstadt bei 10° Nord,
 *   52° Ost — im Tschad, mit gültigen Graden.
 * - **Löcher sind Löcher.** Jede Zone ist ein Polygon aus einem Außenring im
 *   Uhrzeigersinn und null bis 18 Innenringen dagegen (Zone B: 18 Baublöcke),
 *   alle Innenringe liegen im Außenring — gemessen am 17. September. Das ist
 *   gültiges GeoJSON, anders als Kassels flache Esri-Ringe; hier wird nichts
 *   sortiert.
 *
 * Was Hildesheim nicht hat: Umweltzone (die Stadt hat keine), POI,
 * Straßenabschnitte. Die Dateien werden trotzdem geschrieben, leer —
 * `loadData` holt alle fünf.
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

import {
  cityByKey,
  HildesheimParseError,
  hildesheimZoneNote,
  multiPolygonContains,
  parseHildesheimZoneName,
  type ChargeWindow,
  type Fee,
  type HildesheimZoneProperties,
  type PolygonRings,
  type Position,
} from '@knoellchenfrei/core'

import { citySources, toGeoJsonAxes, type AxisOrder } from './sources.js'
import { simplifyGeometry } from './simplify.js'
import { geprueftAm } from './abruf-zeit.js'

/** Die Stadt aus `core/city.ts`, nicht als Kopie hier — die Grenzen stehen genau einmal. */
const HILDESHEIM = cityByKey('hildesheim')

const RAW = join(process.env.RAW_DIR ?? join(process.cwd(), '../../.raw'), HILDESHEIM.key)
const OUT = join(
  process.env.OUT_DIR ?? join(process.cwd(), '../../apps/web/public/data'),
  HILDESHEIM.key
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

const SOURCES = citySources(HILDESHEIM.key)

function axisOrderOf(key: string): AxisOrder {
  const source = SOURCES.find((candidate) => candidate.key === key)
  if (source === undefined) throw new Error(`Keine Quelle "${key}" für Hildesheim`)
  return source.axisOrder
}

/** `fetch-data` legt jede Quelle als `<key>.json` ab. */
function readFeatures<P>(key: string): Feature<P>[] {
  const parsed = JSON.parse(readFileSync(join(RAW, `${key}.json`), 'utf8')) as { features?: Feature<P>[] }
  if (!Array.isArray(parsed.features)) throw new Error(`${key}.json: keine FeatureCollection`)
  return parsed.features
}

function toGeoJson(geometry: Geometry | null, order: AxisOrder): Geometry | null {
  if (geometry === null) return null
  return { type: geometry.type, coordinates: toGeoJsonAxes(geometry.coordinates, order) }
}

/**
 * Grade oder nichts.
 *
 * Ohne `srsName` antwortet der Dienst in seinem `DefaultCRS` EPSG:25832:
 * `[565150.07, 5777739.93]` — plausible Zahlen, keine Grade, auf der Karte
 * nur leer. `wfsUrl` setzt den Parameter; hier wird geprüft, dass er
 * gewirkt hat.
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

/**
 * Bricht ab, wenn ein Punkt außerhalb Hildesheims liegt.
 *
 * Die Achsenreihenfolge steht in der Konfiguration; dieser Test misst, ob
 * sie stimmt. Gedreht läge die Altstadt bei 9,9° Nord, 52,1° Ost — im
 * Tschad, und `assertDegrees` sähe dabei gültige Grade. Die Zonen müssen im
 * Melderahmen liegen (eine Zone, in der niemand melden kann, wäre ein
 * stummer Fleck), die Ortschaften reichen bis an die Stadtgrenze und werden
 * gegen den weiteren Sitzungsrahmen geprüft — der Melderahmen ist aus ihrer
 * Hülle gerundet, und ein Stützpunkt genau auf der Hülle darf nicht an der
 * Rundung scheitern.
 */
function assertInHildesheim(key: string, geometry: Geometry, frame: 'report' | 'session'): void {
  const b = frame === 'report' ? HILDESHEIM.reportBounds : HILDESHEIM.sessionBounds
  const walk = (node: unknown): void => {
    if (!Array.isArray(node)) return
    if (typeof node[0] === 'number' && typeof node[1] === 'number') {
      const [lon, lat] = node as [number, number]
      if (lon < b.minLon || lon > b.maxLon || lat < b.minLat || lat > b.maxLat) {
        throw new Error(
          `${key}: ${lon}/${lat} liegt nicht in Hildesheim (${frame}) — Achsenreihenfolge oder Rahmen in core/city.ts prüfen`
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

/** Mittelpunkt aller Stützpunkte — reicht, um eine Ortschaft zu treffen. */
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

console.log('Hildesheim — Daten bauen …')

// ------------------------------------------------------------ Ortschaften
//
// Zuerst, weil die Zonen sie brauchen: „Bewohnerparkzone D" sagt niemandem,
// wo das ist. Die Ortschaft (Stadtmitte/Neustadt, Nordstadt …) ist die
// Ebene, in der die Suche und die Kopfzeile des Panels denken.

interface District {
  name: string
  rings: PolygonRings[]
}

/**
 * Die Felder der Ortschaften-Ebene, so weit sie hier gelesen werden — alle
 * als Zeichenkette, auch die Zahlen (`Area`, `Wohnbaufläche`), wie MapServer
 * sie aus der Shapedatei durchreicht.
 */
interface DistrictProperties {
  _feature_id?: string | null
  ID?: string | null
  /** Kurzname, bei zwei Flächen abgeschnitten oder vertippt: `Neuhof/HildesheimerWald/Marien`, `Bavenstadt`. */
  Name?: string | null
  /** Der vollständige Name: `Neuhof/Hildesheimer Wald/Marienrode`, `Bavenstedt`. */
  Name_lang?: string | null
}

const districtAxis = axisOrderOf('districts')
const districtFeatures: { type: 'Feature'; properties: { name: string }; geometry: Geometry }[] = []
const districtIndex: District[] = []

for (const feature of readFeatures<DistrictProperties>('districts')) {
  const geometry = toGeoJson(feature.geometry, districtAxis)
  if (geometry === null) continue
  assertDegrees('districts', geometry)
  assertInHildesheim('districts', geometry, 'session')
  // `Name_lang`, nicht `Name`: Das Kurzfeld ist bei „Neuhof/Hildesheimer
  // Wald/Marienrode" auf 30 Zeichen abgeschnitten und schreibt „Bavenstadt"
  // statt Bavenstedt — im Panel stünde ein Ortsname, den es nicht gibt.
  const name = (feature.properties.Name_lang ?? '').replace(/\s+/g, ' ').trim()
  if (name === '') throw new Error(`districts: Ortschaft ${String(feature.properties.ID)} ohne Name_lang`)

  // Die Zuordnung läuft gegen die UNvereinfachte Geometrie. Vereinfachte
  // Grenzen wandern um bis zu ein paar Dutzend Meter, und eine Zone an der
  // Ortschaftsgrenze bekäme sonst den Nachbarn zugeschrieben.
  districtIndex.push({ name, rings: toPolygons(geometry) })

  // Anzeigeebene, deshalb zwei Größenordnungen gröber als die Zonen: Die
  // Antwort hat 304 KB für 14 Ortschaften, das Ergebnis passt in den Vorrat
  // des Service Workers.
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

const zoneAxis = axisOrderOf('zones')
const rawZones = readFeatures<HildesheimZoneProperties>('zones')
const zoneFeatures: { type: 'Feature'; properties: ZoneOut; geometry: Geometry }[] = []
const seen = new Set<string>()
let withoutDistrict = 0

for (const feature of rawZones) {
  const geometry = toGeoJson(feature.geometry, zoneAxis)
  if (geometry === null) continue
  assertDegrees('zones', geometry)
  assertInHildesheim('zones', geometry, 'report')

  // Nicht auslassen, sondern abbrechen: Bei sieben Flächen ist jede einzelne
  // ein Siebtel der Stadt, und ein Feed, der einen Buchstaben leer lässt,
  // soll gesehen werden — nur die eigene Fehlerklasse wird dafür übersetzt,
  // alles andere ist ein kaputter Parser und fliegt unverändert.
  let name
  try {
    name = parseHildesheimZoneName(feature.properties.Zone)
  } catch (error) {
    if (!(error instanceof HildesheimParseError)) throw error
    throw new Error(`zones: ID ${String(feature.properties.ID)}: ${error.message}`, { cause: error })
  }
  if (seen.has(name.letter)) throw new Error(`zones: Zone ${name.letter} kommt zweimal vor`)
  seen.add(name.letter)

  const district = districtAt(centroid(geometry))
  if (district === null) withoutDistrict += 1

  const simplified = simplifyGeometry(geometry, 1e-5, 5)
  if (simplified === null) continue

  zoneFeatures.push({
    type: 'Feature',
    properties: {
      zone: name.letter,
      district: district?.name ?? HILDESHEIM.name,
      // Leer, nicht erfunden: Es gibt keinen Rohtext, den das Panel zitieren
      // könnte. Die Sätze dazu („keine Zeiten und keinen Tarif, nur seine
      // Grenze") kommen aus `scheduleUnknown`.
      rawHours: '',
      rawFee: '',
      note: hildesheimZoneNote(name),
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

// ------------------------------------------------------- was es nicht gibt

// Leere Sammlung statt fehlender Datei: `loadData` holt für jede Stadt
// dieselben fünf Namen, und ein 404 wäre von einem echten Ladefehler nicht zu
// unterscheiden. `meta.json` sagt, dass die Leere Absicht ist.
write('poi.geojson', { type: 'FeatureCollection', features: [] })
write('umweltzone.geojson', { type: 'FeatureCollection', features: [] })

write('meta.json', {
  city: HILDESHEIM.key,
  cityName: HILDESHEIM.name,
  source: `${HILDESHEIM.attribution.source}, MapServer-WFS 2.0.0`,
  licence: HILDESHEIM.attribution.licence,
  licenceUrl: HILDESHEIM.attribution.licenceUrl,
  attributionRequired: HILDESHEIM.attribution.attributionRequired,
  datasetUrl: HILDESHEIM.attribution.datasetUrl,
  // Wann die Quelle zuletzt erfolgreich abgerufen wurde — siehe abruf-zeit.ts.
  geprueftAm: geprueftAm(RAW),
  zones: zoneFeatures.length,
  districts: districtFeatures.length,
  poi: 0,
  lowEmissionZone: false,
  segments: 0,
  managedSpaces: 0,
  crs: 'EPSG:4326 (lon/lat)',
  /**
   * Was dieser Abzug nicht enthält. `schedule` und `fee` sind die Marke der
   * Klasse C: Die Quelle nennt für keine Fläche Zeiten oder Betrag.
   * `umweltzone` heißt hier „gibt es nicht" — Hildesheim hat keine —, `poi`
   * „nicht als Vektordienst gefunden" (Schwerbehindertenparkplätze und
   * P+R laufen im Viewer der Stadt nur als Kachel- oder Viewer-Ebene).
   */
  absent: ['schedule', 'fee', 'poi', 'umweltzone', 'segments'],
})

// Die Zahlen gehören ins Log, nicht in einen Kommentar: Sie sind das, was beim
// nächsten Abzug anders sein kann, und ein Sprung darin ist das erste, was
// auffällt.
console.log(
  `\n${zoneFeatures.length} von ${rawZones.length} Bewohnerparkzonen übernommen (${[...seen].sort().join(', ')}),` +
    ` alle ohne Zeiten und Tarif — ${withoutDistrict} ohne Ortschafts-Treffer; ${districtFeatures.length} Ortschaften`
)
