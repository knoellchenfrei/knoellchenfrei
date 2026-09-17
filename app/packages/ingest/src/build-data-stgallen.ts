/**
 * Baut St. Gallens Daten — das Gegenstück zu `build-data.ts` für die vierte
 * Stadt in der Schweiz und die erste, deren Quelle **keine Zonen kennt**.
 *
 * Was St. Gallen **anders** macht als Bern und Genf:
 *
 * - **Die Quelle ist eine Parkfeld-Ebene, keine Zonen-Ebene.** 3.232
 *   Polygone, je eine Reihe von Parkplätzen mit einer `markierungsart`.
 *   Eine „Zone" entsteht hier aus dem Regime: `EBZ` für die 1.871 Reihen der
 *   Erweiterten Blauen Zone, `Parkuhr` für die 781 weiss markierten,
 *   bewirtschafteten. Jede Reihe bleibt ein eigenes Stück — wie Hamburgs
 *   Stücke und Karlsruhes Reihen —, damit Klick und Ortung die richtige
 *   Reihe treffen und `zoneSnapMetres` greifen kann. Warum nicht ein
 *   Schlüssel je Quartier, steht in `core/src/stgallen.ts`.
 * - **Weder Zeiten noch Beträge.** Jede Zone bekommt `scheduleUnknown: true`,
 *   `windows: []` und `fee: { kind: 'unknown' }`; `meta.absent` führt
 *   `schedule` und `fee`. Die Bewilligungszeiten der Stadtseite (8–19 Uhr,
 *   Mo–Sa) sind eine Aussage über das Recht, nicht über die Daten, und
 *   stehen als Zitat in `docs/staedte-stgallen.md`.
 * - **Zehn der zwölf Markierungsarten sind keine Zone.** Kundenparkplätze,
 *   Garagen, Güterumschlag, Taxi, Hotelhalt, Car, die freie Weisse Zone und
 *   drei Arten von „nichts" werden gezählt und bleiben draussen; die 114
 *   Invalidenparkplätze wandern als POI auf die Karte, wie Genfs `places
 *   handicapées`. Eine dreizehnte Art bricht den Bau ab.
 * - **Kein WFS, kein ArcGIS, sondern der GeoJSON-Export von Opendatasoft.**
 *   Immer WGS84 in `[lon, lat]`; `assertDegrees` misst trotzdem nach, weil
 *   eine Annahme, deren Fehlen man nicht bemerkt, geprüft gehört.
 *
 * Bezirke sind die 31 statistischen Quartiere (`wohnviertel`); Kreis und
 * Quartiergruppe kommen als `bezirk` mit, wie Berns Stadtteil. Was St. Gallen
 * **nicht** hat: Umweltzone, Strassenabschnitte. Die Dateien werden trotzdem
 * geschrieben, leer, damit `loadData` alle fünf bekommt.
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

import {
  StGallenParseError,
  cityByKey,
  multiPolygonContains,
  parseStGallenAccess,
  parseStGallenMarking,
  parseStGallenSpaces,
  stGallenQuarter,
  stGallenZoneKey,
  stGallenZoneNote,
  type ChargeWindow,
  type Fee,
  type PolygonRings,
  type Position,
  type StGallenAreaProperties,
  type StGallenMarking,
  type StGallenQuarterProperties,
} from '@knoellchenfrei/core'

import { roundPoint, simplifyGeometry } from './simplify.js'
import { geprueftAm } from './abruf-zeit.js'

/** Die Stadt kommt aus `core/city.ts` — die Grenzen stehen im Projekt genau einmal. */
const STGALLEN = cityByKey('stgallen')

const RAW = join(process.env.RAW_DIR ?? join(process.cwd(), '../../.raw'), STGALLEN.key)
const OUT = join(process.env.OUT_DIR ?? join(process.cwd(), '../../apps/web/public/data'), STGALLEN.key)

interface Geometry {
  type: string
  coordinates: unknown
}

interface Feature<P> {
  properties: P
  geometry: Geometry | null
}

interface Collection<P> {
  type?: string
  features: Feature<P>[]
}

function readFeatures<P>(key: string): Feature<P>[] {
  const parsed = JSON.parse(readFileSync(join(RAW, `${key}.json`), 'utf8')) as Collection<P>
  if (parsed.type !== 'FeatureCollection' || !Array.isArray(parsed.features)) {
    throw new Error(`${key}: keine FeatureCollection — der Export hat etwas anderes geliefert`)
  }
  return parsed.features
}

/**
 * Grade oder nichts.
 *
 * Opendatasoft exportiert GeoJSON immer in WGS84 — heute. Sollte der Export
 * einmal das Landessystem (LV95, Meter um 2.700.000 / 1.250.000) liefern,
 * kämen plausible Zahlen, keine Fehlermeldung, auf der Karte nur leer.
 */
function assertDegrees(key: string, geometry: Geometry): void {
  const walk = (node: unknown): void => {
    if (!Array.isArray(node)) return
    if (typeof node[0] === 'number' && typeof node[1] === 'number') {
      const [lon, lat] = node as number[]
      if (Math.abs(lon as number) > 180 || Math.abs(lat as number) > 90) {
        throw new Error(`${key}: ${lon}/${lat} sind keine Grade — der Export hat nicht in WGS84 geantwortet`)
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

/** Mittelpunkt aller Stützpunkte — bei Reihen von 30 m Länge reicht das, um ein Quartier zu treffen. */
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

console.log('St. Gallen — Daten bauen …')

// ------------------------------------------------------------ Quartiere
//
// Zuerst, weil die Zonen sie brauchen: Eine Reihe der EBZ trägt keinen
// Namen; ohne Quartier stünde in der Kopfzeile „Zone EBZ" und sonst nichts.

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

for (const feature of readFeatures<StGallenQuarterProperties>('districts')) {
  const geometry = feature.geometry
  if (geometry === null) continue
  assertDegrees('districts', geometry)
  // Ein Quartier ohne Namen ist kein „unlesbare Zeile", sondern ein kaputter
  // Abzug — deshalb ohne try: Der Fehler bricht den Bau ab.
  const { name, bezirk } = stGallenQuarter(feature.properties)

  // Die Zuordnung läuft gegen die UNvereinfachte Geometrie: Vereinfachte
  // Grenzen wandern um ein paar Dutzend Meter, und eine Reihe an der
  // Quartiergrenze bekäme sonst den Nachbarn.
  districtIndex.push({ name, rings: toPolygons(geometry) })

  const simplified = simplifyGeometry(geometry, 1e-4, 5)
  if (simplified === null) continue
  districtFeatures.push({ type: 'Feature', properties: { name, bezirk }, geometry: simplified })
}
if (districtIndex.length !== 31) throw new Error(`districts: ${districtIndex.length} statt 31 Quartiere`)

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

const rawAreas = readFeatures<StGallenAreaProperties>('zones')
const zoneFeatures: { type: 'Feature'; properties: ZoneOut; geometry: Geometry }[] = []
const poi: { type: 'Feature'; properties: Record<string, unknown>; geometry: Geometry }[] = []
const unreadable: string[] = []
const byMarking = new Map<StGallenMarking, number>()
const spacesByKey = { EBZ: 0, Parkuhr: 0 }
let withoutSpaces = 0
let withoutDistrict = 0
let collapsed = 0

for (const [index, feature] of rawAreas.entries()) {
  const geometry = feature.geometry
  if (geometry === null) continue
  assertDegrees('zones', geometry)
  const p = feature.properties

  let marking: StGallenMarking
  let spaces: number | null
  try {
    marking = parseStGallenMarking(p.markierungsart ?? '')
    parseStGallenAccess(p.zutrittsart ?? '')
    spaces = parseStGallenSpaces(p.anzahl_pp)
  } catch (error) {
    // Nur die eigene Fehlerklasse ist „unlesbare Zeile"; alles andere ist ein
    // kaputter Parser und bricht den Lauf ab.
    if (!(error instanceof StGallenParseError)) throw error
    unreadable.push(`Zeile ${index}: ${error.message}`)
    continue
  }
  byMarking.set(marking, (byMarking.get(marking) ?? 0) + 1)

  const centre = centroid(geometry)

  if (marking === 'invaliden') {
    // Behindertenparkplätze als Punkt auf die Karte, wie in Genf und
    // Frankfurt — der Schwerpunkt der Reihe reicht, sie ist 17 m lang.
    if (centre === null) continue
    poi.push({
      type: 'Feature',
      properties: {
        kind: 'accessible',
        label: 'Behindertenparkplatz',
        detail: spaces === null ? null : `${spaces} ${spaces === 1 ? 'Platz' : 'Plätze'}`,
      },
      geometry: { type: 'Point', coordinates: roundPoint([centre[0], centre[1]]) },
    })
    continue
  }

  const key = stGallenZoneKey(marking)
  if (key === null) continue

  if (spaces === null) withoutSpaces += 1
  else spacesByKey[key] += spaces

  const district = districtAt(centre)
  if (district === null) withoutDistrict += 1

  // Reihen von 1,6 m Breite überleben keine Vereinfachung auf einen Meter:
  // Karlsruhe nimmt 1e-6 bei 4,8 m, hier ist die sechste Stelle (0,1 m)
  // nötig, sonst wird aus einem Viereck ein Strich und die Fläche fällt weg.
  const simplified = simplifyGeometry(geometry, 1e-7, 6)
  if (simplified === null) {
    collapsed += 1
    continue
  }

  zoneFeatures.push({
    type: 'Feature',
    properties: {
      zone: key,
      district: district?.name ?? STGALLEN.name,
      // Leer, nicht erfunden: Der Feed hat kein Zeit- und kein Gebührenfeld.
      rawHours: '',
      rawFee: '',
      note: stGallenZoneNote(key, spaces),
      windows: [],
      fee: { kind: 'unknown' },
      unmodelledRules: [],
      sourceDefect: null,
      scheduleUnknown: true,
      spaces,
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

for (const line of unreadable) console.warn(`  unlesbar ausgelassen: ${line}`)
if (unreadable.length > 0) throw new Error(`zones: ${unreadable.length} unlesbare Zeilen — eine neue Markierungsart will gelesen werden`)
if (zoneFeatures.length === 0) throw new Error('zones: keine einzige Zone übernommen')
// Der Abzug hat 1.871 + 781 = 2.652 Reihen mit Regime; deutlich weniger
// hiesse, der Export ist gekürzt oder eine Art wurde umbenannt.
if (zoneFeatures.length < 2500) throw new Error(`zones: nur ${zoneFeatures.length} Reihen mit Regime — Abzug prüfen`)

write('zones.geojson', { type: 'FeatureCollection', features: zoneFeatures })
write('poi.geojson', { type: 'FeatureCollection', features: poi })
write('umweltzone.geojson', { type: 'FeatureCollection', features: [] })

const ebz = zoneFeatures.filter((f) => f.properties.zone === 'EBZ').length
const parkuhr = zoneFeatures.length - ebz

write('meta.json', {
  city: STGALLEN.key,
  cityName: STGALLEN.name,
  source: `${STGALLEN.attribution.source}, GeoJSON-Export (Opendatasoft)`,
  licence: STGALLEN.attribution.licence,
  licenceUrl: STGALLEN.attribution.licenceUrl,
  attributionRequired: STGALLEN.attribution.attributionRequired,
  datasetUrl: STGALLEN.attribution.datasetUrl,
  geprueftAm: geprueftAm(RAW),
  zones: zoneFeatures.length,
  districts: districtFeatures.length,
  poi: poi.length,
  lowEmissionZone: false,
  segments: 0,
  managedSpaces: spacesByKey.EBZ + spacesByKey.Parkuhr,
  crs: 'EPSG:4326 (lon/lat)',
  // `schedule` und `fee`: Klasse C — die Quelle nennt beides nicht.
  absent: ['schedule', 'fee', 'umweltzone', 'segments'],
})

console.log(
  `\n${zoneFeatures.length} von ${rawAreas.length} Parkfeldern als Zonenstücke übernommen ` +
    `(${ebz} EBZ mit ${spacesByKey.EBZ} Plätzen, ${parkuhr} Parkuhr mit ${spacesByKey.Parkuhr} Plätzen; ` +
    `${withoutSpaces} ohne Platzzahl, ${withoutDistrict} ohne Quartier-Treffer, ${collapsed} zu klein), ` +
    `${poi.length} Behindertenparkplätze, ${districtFeatures.length} Quartiere\n  Markierungsarten: ${[...byMarking.entries()]
      .sort(([, a], [, b]) => b - a)
      .map(([text, n]) => `${text} ×${n}`)
      .join(', ')}`
)
