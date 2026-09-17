/**
 * Baut Straßburgs Daten — das Gegenstück zu `build-data-wien.ts` für die
 * erste Stadt in Frankreich.
 *
 * Drei Opendatasoft-Exporte (`sources.ts`): die 19 Tarifzonen, die 10
 * Quartiere der Ville de Strasbourg und die 15 Bewohnerparkzonen. Was
 * diesen Datenbau von den Städten davor unterscheidet:
 *
 * - **Die Zeiten kommen aus der Datensatzbeschreibung**, nicht aus einem
 *   Feld — `STRASBOURG_HOURS` in `core/strasbourg.ts`, mit Fundstelle. Jede
 *   Zone trägt dieselben Fenster (Mo–Sa 9–19 Uhr), und `rawHours` sagt im
 *   Panel, woher sie stammen. Ein Feld, das eines Tages Zeiten trüge, fiele
 *   im `fixture-shape`-Test auf, nicht hier.
 * - **Der Tarif ist eine Staffel.** `parseStrasbourgTariff` liest die drei
 *   Schreibweisen des Abzugs, `strasbourgFee` macht daraus die Spanne der
 *   Stundenkosten, `strasbourgMaxStay` die Höchstparkdauer aus der letzten
 *   Stufe, und der Sprung am Ende steht als Zusatzregel im Panel. Der
 *   Rohtext bleibt französisch in `rawFee` — er ist die Quelle.
 * - **Gegenprobe gegen die Bewohnerzonen.** Jede Tarifzone nennt die
 *   Bewohnerzone, in der sie liegt; eine Nummer, die es dort nicht gibt,
 *   hält den Bau an, weil sie ein Zeichen für einen umgeschnittenen Feed ist.
 *
 * Die Ausgabe trägt die Lücken als `absent` in `meta.json`: keine POI, keine
 * Umweltzone (die ZFE-m der Eurométropole ist eine Crit'Air-Zone und keine
 * deutsche Umweltzone, siehe den Bericht), keine Straßenabschnitte.
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

import {
  STRASBOURG,
  STRASBOURG_COLOUR_LABELS,
  STRASBOURG_HOURS,
  cityByKey,
  multiPolygonContains,
  parseStrasbourgColour,
  parseStrasbourgTariff,
  strasbourgFee,
  strasbourgHourlyRates,
  strasbourgMaxStay,
  strasbourgUnmodelledRules,
  strasbourgWindows,
  strasbourgZoneKey,
  type ChargeWindow,
  type Fee,
  type PolygonRings,
  type Position,
  type StrasbourgQuartierProperties,
  type StrasbourgResidentZoneProperties,
  type StrasbourgZoneProperties,
} from '@knoellchenfrei/core'

import { geprueftAm } from './abruf-zeit.js'
import { simplifyGeometry } from './simplify.js'

/** Die Stadt kommt aus `core/city.ts` — Stadtgrenzen stehen genau einmal. */
const CITY = cityByKey(STRASBOURG.key)

const RAW = join(process.env.RAW_DIR ?? join(process.cwd(), '../../.raw'), CITY.key)
const OUT = join(process.env.OUT_DIR ?? join(process.cwd(), '../../apps/web/public/data'), CITY.key)

interface Geometry {
  type: string
  coordinates: unknown
}

interface Feature<P> {
  properties: P
  geometry: Geometry | null
}

function readFeatures<P>(key: string): Feature<P>[] {
  const parsed = JSON.parse(readFileSync(join(RAW, `${key}.json`), 'utf8')) as { features?: Feature<P>[] }
  if (!Array.isArray(parsed.features)) throw new Error(`${key}: keine FeatureCollection`)
  return parsed.features
}

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

/**
 * Nachmessen, dass Grade kamen — und dass sie in Straßburg liegen.
 *
 * Opendatasoft liefert GeoJSON in WGS84 und kennt kein `srsName`; die
 * Prüfung steht trotzdem, aus demselben Grund wie in Frankfurt: Eine
 * Konfiguration, deren Fehlen man nicht bemerkt, gehört geprüft. Die zweite
 * Hälfte fängt eine gedrehte Achse — 48,58 / 7,74 wären plausible Zahlen
 * und lägen in der Kirgisischen Steppe.
 */
function assertDegrees(key: string, geometry: Geometry): void {
  for (const [lon, lat] of positionsOf(geometry)) {
    if (Math.abs(lon) > 180 || Math.abs(lat) > 90) {
      throw new Error(`${key}: ${lon}/${lat} sind keine Grade — das Portal hat nicht in WGS84 geantwortet`)
    }
    if (lon < 7.5 || lon > 8 || lat < 48.4 || lat > 48.75) {
      throw new Error(`${key}: ${lon}/${lat} liegt nicht in Straßburg — Achsenreihenfolge prüfen`)
    }
  }
}

function toPolygons(geometry: Geometry): PolygonRings[] {
  if (geometry.type === 'Polygon') return [geometry.coordinates as PolygonRings]
  if (geometry.type === 'MultiPolygon') return geometry.coordinates as PolygonRings[]
  return []
}

function write(name: string, value: unknown): void {
  const path = join(OUT, name)
  mkdirSync(dirname(path), { recursive: true })
  const json = JSON.stringify(value)
  writeFileSync(path, json)
  console.log(`  ${name}: ${(json.length / 1024).toFixed(0)} KB`)
}

/** Dasselbe Feld-Schema wie die Städte davor. */
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

console.log('Straßburg — Daten bauen …')

// ------------------------------------------------------------- Quartiere
//
// Zuerst, weil die Zonen sie brauchen: Der Feed nennt zu einer Tarifzone
// kein Quartier, und „Zone rouge 10" ist im Panel keine Ortsangabe —
// „Gare-Kléber" ist eine.

interface District {
  name: string
  rings: PolygonRings[]
}

const districtIndex: District[] = []
const districtFeatures: { type: 'Feature'; properties: { name: string; bezirk: string }; geometry: Geometry }[] = []

for (const feature of readFeatures<StrasbourgQuartierProperties>('districts')) {
  if (feature.geometry === null) continue
  assertDegrees('districts', feature.geometry)
  const name = (feature.properties.nom ?? '').trim()
  const nr = feature.properties.id_quart10
  if (name === '' || typeof nr !== 'number') {
    throw new Error(`districts: Quartier ohne Namen oder Nummer: ${JSON.stringify(feature.properties)}`)
  }
  // Die Zuordnung läuft gegen die UNvereinfachte Geometrie — vereinfachte
  // Grenzen wandern um ein paar Dutzend Meter.
  districtIndex.push({ name, rings: toPolygons(feature.geometry) })
  const simplified = simplifyGeometry(feature.geometry, 1e-4, 5)
  if (simplified === null) continue
  districtFeatures.push({
    type: 'Feature',
    // Straßburg hat keine Ebene über dem Quartier; `bezirk` trägt die Stadt,
    // damit das Feld dieselbe Form hat wie in Hamburg und Wien.
    properties: { name, bezirk: 'Ville de Strasbourg' },
    geometry: simplified,
  })
}
if (districtFeatures.length !== 10) {
  throw new Error(`districts: ${districtFeatures.length} statt 10 Quartiere — die Ebene hat sich geändert`)
}

write('districts.geojson', { type: 'FeatureCollection', features: districtFeatures })

/**
 * Das Quartier, in dem die meisten Stützpunkte der Fläche liegen.
 *
 * Nicht der Schwerpunkt: Opendatasofts `geo_point_2d` ist der Schwerpunkt
 * der Fläche, und eine Zone, die sich um die Ill legt, kann ihren
 * Schwerpunkt im Wasser oder im Nachbarquartier haben. Die Mehrheit der
 * Ränder ist die robustere Aussage; wo sie auf der Grenze zweier Quartiere
 * liegt, gewinnt das mit mehr Rand — und das Log nennt die Zahl.
 */
function districtOf(geometry: Geometry): { name: string; share: number } | null {
  const points = positionsOf(geometry)
  let best: { name: string; hits: number } | null = null
  for (const district of districtIndex) {
    const hits = points.filter((point) => multiPolygonContains(district.rings, point)).length
    if (hits > 0 && (best === null || hits > best.hits)) best = { name: district.name, hits }
  }
  if (best === null || points.length === 0) return null
  return { name: best.name, share: best.hits / points.length }
}

// ------------------------------------------------------- Bewohnerzonen
//
// Nur zur Gegenprobe: Die Nummer, die jede Tarifzone nennt, muss es geben.

const residentZones = new Set<string>()
for (const feature of readFeatures<StrasbourgResidentZoneProperties>('residents')) {
  if (feature.geometry !== null) assertDegrees('residents', feature.geometry)
  const nummer = (feature.properties.numero_zone_resident ?? '').trim()
  if (nummer === '') throw new Error(`residents: Bewohnerzone ohne Nummer: ${JSON.stringify(feature.properties)}`)
  residentZones.add(nummer)
}
if (residentZones.size === 0) throw new Error('residents: keine einzige Bewohnerzone')

// -------------------------------------------------------------- Zonen

const zoneFeatures: { type: 'Feature'; properties: ZoneOut; geometry: Geometry }[] = []
const tariffSpellings = new Map<string, number>()
const colours = new Map<string, number>()
const updated = new Map<string, number>()
const keys = new Set<string>()
let withoutDistrict = 0
let splitDistrict = 0

function count(map: Map<string, number>, key: string): void {
  map.set(key, (map.get(key) ?? 0) + 1)
}

const euro = (cents: number): string => `${(cents / 100).toFixed(2).replace('.', ',')} €`

for (const feature of readFeatures<StrasbourgZoneProperties>('zones')) {
  if (feature.geometry === null) continue
  assertDegrees('zones', feature.geometry)
  const p = feature.properties
  const key = strasbourgZoneKey(p)
  if (keys.has(key)) throw new Error(`zones: Schlüssel ${key} steht zweimal`)
  keys.add(key)
  const colour = parseStrasbourgColour(p.couleur)
  count(colours, colour)

  const rawFee = (p.tarif ?? '').trim()
  if (rawFee === '') throw new Error(`zones: ${key} ohne Tarif — ohne Staffel keine Antwort, der Datenbau hält an`)
  count(tariffSpellings, rawFee)
  const tariff = parseStrasbourgTariff(rawFee)
  const rates = strasbourgHourlyRates(tariff)

  const resident = p.numero_zone_resident
  if (typeof resident !== 'number' || !residentZones.has(String(resident))) {
    throw new Error(`zones: ${key} nennt die Bewohnerzone ${String(resident)}, die es in stationnement_residant nicht gibt`)
  }
  count(updated, p.date_maj ?? 'ohne Datum')

  const district = districtOf(feature.geometry)
  if (district === null) withoutDistrict += 1
  else if (district.share < 0.95) splitDistrict += 1

  const simplified = simplifyGeometry(feature.geometry, 1e-5, 5)
  if (simplified === null) throw new Error(`zones: ${key} verschwindet beim Vereinfachen`)

  const maxStayMinutes = strasbourgMaxStay(tariff)
  zoneFeatures.push({
    type: 'Feature',
    properties: {
      zone: key,
      district: district?.name ?? CITY.name,
      rawHours: STRASBOURG_HOURS.rawHours,
      rawFee,
      note:
        `Zone ${colour} (${STRASBOURG_COLOUR_LABELS[colour]}) der Ville de Strasbourg, Bewohnerparkzone ${resident}; ` +
        `Stundenkosten nachgerechnet: ${rates.map(euro).join(' / ')}` +
        (p.date_maj ? `; laut Quelle Stand ${p.date_maj}` : ''),
      windows: strasbourgWindows(),
      fee: strasbourgFee(tariff),
      unmodelledRules: strasbourgUnmodelledRules(tariff),
      sourceDefect: null,
      spaces: null,
      maxStayMinutes,
      maxStay: null,
      maxStayShare: 0,
      maxStayValues: [],
      chargingPoints: 0,
      carsharing: 0,
    },
    geometry: simplified,
  })
}

if (zoneFeatures.length === 0) throw new Error('zones: keine einzige Fläche gebaut')

write('zones.geojson', { type: 'FeatureCollection', features: zoneFeatures })

// ------------------------------------------------------- was es nicht gibt

write('poi.geojson', { type: 'FeatureCollection', features: [] })
write('umweltzone.geojson', { type: 'FeatureCollection', features: [] })

write('meta.json', {
  city: CITY.key,
  cityName: CITY.name,
  source: `${CITY.attribution.source}, Opendatasoft-Export (stationnement-payant, strasbourg-10-quartiers, stationnement_residant)`,
  licence: CITY.attribution.licence,
  licenceUrl: CITY.attribution.licenceUrl,
  attributionRequired: CITY.attribution.attributionRequired,
  datasetUrl: CITY.attribution.datasetUrl,
  geprueftAm: geprueftAm(RAW),
  zones: zoneFeatures.length,
  districts: districtFeatures.length,
  poi: 0,
  lowEmissionZone: false,
  segments: 0,
  managedSpaces: 0,
  crs: 'EPSG:4326 (lon/lat), so wie Opendatasoft GeoJSON immer liefert',
  /**
   * `schedule` steht hier NICHT: Zeiten werden ausgeliefert — die der
   * Datensatzbeschreibung; `rawHours` je Zone sagt es. `fee` ebenso nicht.
   */
  absent: ['poi', 'lowEmissionZone', 'segments'],
})

// Die Zahlen gehören ins Log, nicht in einen Kommentar: Sie sind das, was
// beim nächsten Abzug anders sein kann.
const spellings = (map: Map<string, number>): string =>
  [...map.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([text, n]) => `    ${n} × ${text}`)
    .join('\n')
console.log(
  `\n${zoneFeatures.length} Tarifzonen (${[...colours.entries()]
    .sort()
    .map(([c, n]) => `${n}× ${c}`)
    .join(', ')}), ${districtFeatures.length} Quartiere, ${residentZones.size} Bewohnerzonen zur Gegenprobe — ` +
    `${withoutDistrict} ohne Quartier-Treffer, ${splitDistrict} über eine Quartiergrenze hinweg`
)
console.log(`Schreibweisen des Tarifs (${tariffSpellings.size}):\n${spellings(tariffSpellings)}`)
console.log(`Stand laut date_maj:\n${spellings(updated)}`)
console.log(`Zeiten für alle Zonen: ${STRASBOURG_HOURS.rawHours}`)
