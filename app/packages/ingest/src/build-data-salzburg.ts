/**
 * Baut Salzburgs Daten — das Gegenstück zu `build-data-hamburg.ts`, für die
 * erste Stadt außerhalb Deutschlands.
 *
 * Ein eigenes Skript aus demselben Grund wie bei den sieben Städten davor:
 * Der Feed teilt mit keinem anderen ein Feld. Was Salzburg anders macht:
 *
 * - **Der Tarif kommt aus der Verordnung, nicht aus dem Feed.** Kein Feld
 *   nennt einen Betrag; § 2 Abs. 1 der Parkgebührenverordnung 1990 (22.
 *   Novelle) setzt 1,10 € je halbe Stunde für die ganze Stadt fest. Jede
 *   gebührenpflichtige Zone bekommt diesen Satz und in `rawFee` den Hinweis,
 *   woher er stammt — siehe `SALZBURG_TARIFF` in `@knoellchenfrei/core`.
 * - **Der Samstag ist eine Zusatzregel.** Elf Zonen kassieren Mo–Fr und
 *   verlangen samstags nur die Scheibe. Als Fenster gelesen stünde samstags
 *   „2,20 €" über einer Zone, die gratis ist; deshalb steht er in
 *   `unmodelledRules`, und das Panel nennt ihn wörtlich.
 * - **Die Stadtteile sind Flächenstücke, keine Stadtteile.** Die Ebene
 *   zerlegt das Stadtgebiet in 132 Stücke (und 13 der Nachbargemeinden); 45
 *   davon tragen keinen `STADTTEIL`, sondern den Namen ihres Stadtteils als
 *   `LANDSCHAFTSRAUM`. Der Bau fasst die Stücke je Name zu einem MultiPolygon
 *   zusammen — 28 Stadtteile —, damit `zone-units.ts`, das je Name genau
 *   eine Fläche hält, keinen Stadtteil auf sein letztes Stück verkürzt.
 *
 * Was Salzburg **nicht** hat: keine Umweltzone (es gibt keine), keine
 * Straßenabschnitte, keine Stellplatzzahlen. POI sind die 185
 * Behindertenstellplätze. `meta.json` trägt die Lücken als `absent`.
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

import {
  SALZBURG,
  SALZBURG_RAW_FEE,
  isActiveSalzburgZone,
  multiPolygonContains,
  parseSalzburgMaxStay,
  parseSalzburgRule,
  salzburgArtMatchesRule,
  salzburgDistrictName,
  salzburgFee,
  salzburgUnmodelledRules,
  salzburgZoneLabel,
  salzburgZoneNote,
  type ChargeWindow,
  type Fee,
  type PolygonRings,
  type Position,
  type SalzburgDistrictProperties,
  type SalzburgZoneProperties,
} from '@knoellchenfrei/core'

import { citySources, toGeoJsonAxes, type AxisOrder } from './sources.js'
import { roundPoint, simplifyGeometry } from './simplify.js'
import { geprueftAm } from './abruf-zeit.js'

const RAW = join(process.env.RAW_DIR ?? join(process.cwd(), '../../.raw'), SALZBURG.key)
const OUT = join(process.env.OUT_DIR ?? join(process.cwd(), '../../apps/web/public/data'), SALZBURG.key)

interface Geometry {
  type: string
  coordinates: unknown
}

interface Feature<P> {
  id?: string
  properties: P
  geometry: Geometry | null
}

const SOURCES = citySources(SALZBURG.key)

function axisOrderOf(key: string): AxisOrder {
  const source = SOURCES.find((entry) => entry.key === key)
  if (source === undefined) throw new Error(`Salzburg: keine Quelle "${key}" in sources.ts`)
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
 * Bricht ab, wenn der Dienst Meter statt Grad geliefert hat.
 *
 * Nachgemessen am 16. September 2026: Ohne `srsName` antwortet der Dienst in
 * EPSG:31255 mit `[-20891.7, 295427.09]` — Gauß-Krüger-Meter um den Meridian
 * M31, der Ostwert negativ. Kein Fehler, keine Warnung; auf der Karte sähe es
 * nach „leer" aus. Dieselbe Prüfung wie in Frankfurt, München, Düsseldorf und
 * Karlsruhe.
 */
function assertDegrees(key: string, geometry: Geometry): void {
  const walk = (node: unknown): void => {
    if (!Array.isArray(node)) return
    if (typeof node[0] === 'number' && typeof node[1] === 'number') {
      const [lon, lat] = node as number[]
      if (Math.abs(lon as number) > 180 || Math.abs(lat as number) > 90) {
        throw new Error(
          `${key}: ${lon}/${lat} sind keine Grade — der Dienst hat vermutlich in ` +
            'EPSG:31255 (Gauß-Krüger) geantwortet. srsName fehlt in der Anfrage.'
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

/** Dasselbe Feld-Schema wie in allen anderen Städten — ein Typ, ein Panel. */
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

console.log('Salzburg — Daten bauen …')

// ------------------------------------------------------------- Stadtteile
//
// Zuerst, weil die Zonen sie brauchen: Der Feed nennt zu einer Kurzparkzone
// keinen Stadtteil, nur einen Namen wie „NONNTAL-OST" oder „Kurzparkzone
// (Bewohnerparkzone E)" — der zweite sagt nichts darüber, wo sie liegt.

interface District {
  name: string
  rings: PolygonRings[]
}

const districtAxis = axisOrderOf('districts')
const pieces = new Map<string, PolygonRings[]>()
let foreignPieces = 0

for (const feature of readFeatures<SalzburgDistrictProperties>('districts')) {
  const geometry = toGeoJson(feature.geometry, districtAxis)
  if (geometry === null) continue
  assertDegrees('districts', geometry)
  const name = salzburgDistrictName(feature.properties)
  if (name === null) {
    foreignPieces += 1
    continue
  }
  pieces.set(name, [...(pieces.get(name) ?? []), ...toPolygons(geometry)])
}

// Die Zuordnung läuft gegen die UNvereinfachte Geometrie. Vereinfachte Grenzen
// wandern um bis zu ein paar Dutzend Meter, und eine Zone direkt an der
// Stadtteilgrenze bekäme sonst den Nachbarn zugeschrieben.
const districtIndex: District[] = [...pieces.entries()].map(([name, rings]) => ({ name, rings }))

const districtFeatures: { type: 'Feature'; properties: { name: string }; geometry: Geometry }[] = []
for (const { name, rings } of districtIndex) {
  const simplified = simplifyGeometry({ type: 'MultiPolygon', coordinates: rings }, 1e-4, 5)
  if (simplified === null) continue
  districtFeatures.push({ type: 'Feature', properties: { name }, geometry: simplified })
}

write('districts.geojson', { type: 'FeatureCollection', features: districtFeatures })

function districtAt(point: Position | null): District | null {
  if (point === null) return null
  return districtIndex.find((district) => multiPolygonContains(district.rings, point)) ?? null
}

// ------------------------------------------------------------------ Zonen

const zoneAxis = axisOrderOf('zones')
const rawZones = readFeatures<SalzburgZoneProperties>('zones')
const now = Date.now()

const zoneFeatures: { type: 'Feature'; properties: ZoneOut; geometry: Geometry }[] = []
const rawHoursSeen = new Map<string, number>()
let skippedInactive = 0
let skippedUnreadable = 0
let skippedNoGeometry = 0
let withoutDistrict = 0
let defects = 0
let paid = 0

for (const feature of rawZones) {
  const p = feature.properties
  if (!isActiveSalzburgZone(p, now)) {
    skippedInactive += 1
    continue
  }
  const rawHours = (p.GEBUEHRENPFLICHT ?? '').replace(/\s+/g, ' ').trim()
  const rawMaxStay = p.MAXIMALE_PARKDAUER ?? null

  // Nichts raten: Eine Zone, deren Zeile der Parser nicht liest, bleibt
  // draußen und steht mit Grund im Log. Ein Polygon ohne Antwort ist
  // schlechter als kein Polygon.
  let rule
  let maxStay
  try {
    rule = parseSalzburgRule(rawHours)
    maxStay = parseSalzburgMaxStay(rawMaxStay)
  } catch (error) {
    skippedUnreadable += 1
    console.log(`  ausgelassen ${String(p.ID)} (${salzburgZoneLabel(p)}): ${(error as Error).message}`)
    continue
  }
  rawHoursSeen.set(rawHours, (rawHoursSeen.get(rawHours) ?? 0) + 1)

  const geometry = toGeoJson(feature.geometry, zoneAxis)
  if (geometry === null) {
    skippedNoGeometry += 1
    console.log(`  ausgelassen ${String(p.ID)} (${salzburgZoneLabel(p)}): keine Geometrie`)
    continue
  }
  assertDegrees('zones', geometry)

  const district = districtAt(centroid(geometry))
  if (district === null) withoutDistrict += 1

  // Ein Ring, der beim Vereinfachen unter vier Punkte fällt, umschließt
  // nichts. Im Abzug vom 16. September trifft das genau eine Zone: Nr. 546,
  // ein Dreieck von rund vier Metern Kantenlänge in der Riedenburg, das die
  // Quelle als gebührenpflichtige Fläche führt. Auf der Karte wäre es ein
  // Strich, in der Suche ein zweites „INNENSTADT-RIEDENBURG-LEHENSÜD" — die
  // Zone bleibt draußen, und der Grund steht hier, nicht im Nichts.
  const simplified = simplifyGeometry(geometry, 1e-5, 5)
  if (simplified === null) {
    skippedNoGeometry += 1
    console.log(`  ausgelassen ${String(p.ID)} (${salzburgZoneLabel(p)}): Fläche fällt beim Vereinfachen zusammen`)
    continue
  }

  // `ART` und `GEBUEHRENPFLICHT` sagen dasselbe — oder die Zone trägt es als
  // Mangel. Die Zeiten gewinnen, weil sie die feinere Aussage sind.
  const consistent = salzburgArtMatchesRule(p.ART, rule)
  if (!consistent) defects += 1
  if (rule.kind === 'paid') paid += 1

  zoneFeatures.push({
    type: 'Feature',
    properties: {
      // Die Kennung der Quelle, nicht der Name: Sechs Zonen heißen
      // „Kurzparkzone (Bewohnerparkzone E)", vier „INNENSTADT-RIEDENBURG-LEHENSÜD".
      zone: String(p.ID ?? feature.id ?? '?'),
      district: district?.name ?? SALZBURG.name,
      rawHours,
      rawFee: rule.kind === 'paid' ? SALZBURG_RAW_FEE : 'gebührenfrei (aber Parkuhrenpflicht)',
      note: [salzburgZoneLabel(p), salzburgZoneNote(p)].filter((part) => part !== null).join(' — '),
      windows: rule.windows,
      fee: salzburgFee(rule),
      unmodelledRules: salzburgUnmodelledRules(rule, maxStay),
      sourceDefect: consistent
        ? null
        : `ART sagt „${String(p.ART)}", die Zeitangabe sagt ${rule.kind === 'paid' ? 'gebührenpflichtig' : 'gebührenfrei'}`,
      spaces: null,
      maxStayMinutes: maxStay ?? null,
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

// -------------------------------------------------------------------- POI

const accessibleAxis = axisOrderOf('accessible')
const poi: { type: 'Feature'; properties: Record<string, unknown>; geometry: Geometry }[] = []

for (const feature of readFeatures<Record<string, unknown>>('accessible')) {
  const geometry = toGeoJson(feature.geometry, accessibleAxis)
  if (geometry === null || geometry.type !== 'Point') continue
  assertDegrees('accessible', geometry)
  const text = (key: string): string => String(feature.properties[key] ?? '').trim()
  const count = feature.properties['ANZAHL_PLAETZE']
  const spaces = typeof count === 'number' && count > 0 ? count : Number.NaN
  const detail = [
    Number.isFinite(spaces) ? `${spaces} ${spaces === 1 ? 'Platz' : 'Plätze'}` : null,
    // Der Euroschlüssel öffnet den Poller oder die Schranke — wer ihn nicht
    // hat, kommt nicht hin.
    text('EUROSCHLUESSEL').toLowerCase() === 'ja' ? 'Euroschlüssel' : null,
  ]
    .filter((part) => part !== null)
    .join(' · ')
  poi.push({
    type: 'Feature',
    properties: {
      kind: 'accessible',
      label: text('BEZEICHNUNG') || text('ADRESSE') || 'Behindertenstellplatz',
      detail: detail === '' ? null : detail,
    },
    geometry: { type: 'Point', coordinates: roundPoint(geometry.coordinates as [number, number]) },
  })
}

write('poi.geojson', { type: 'FeatureCollection', features: poi })

// Leere Sammlung statt fehlender Datei: `loadData` holt für jede Stadt
// dieselben fünf Namen. Salzburg hat keine Umweltzone.
write('umweltzone.geojson', { type: 'FeatureCollection', features: [] })

write('meta.json', {
  city: SALZBURG.key,
  cityName: SALZBURG.name,
  source: `${SALZBURG.attribution.source}, WFS 2.0.0`,
  licence: SALZBURG.attribution.licence,
  licenceUrl: SALZBURG.attribution.licenceUrl,
  attributionRequired: SALZBURG.attribution.attributionRequired,
  datasetUrl: SALZBURG.attribution.datasetUrl,
  // Wann die Quelle zuletzt erfolgreich abgerufen wurde — siehe abruf-zeit.ts.
  geprueftAm: geprueftAm(RAW),
  zones: zoneFeatures.length,
  districts: districtFeatures.length,
  poi: poi.length,
  lowEmissionZone: false,
  segments: 0,
  managedSpaces: 0,
  crs: 'EPSG:4326 (lon/lat)',
  /**
   * Was dieser Abzug nicht enthält. Der Tarif fehlt **nicht**: Er steht in
   * der Verordnung, nicht im Feed, und ist mit Fundstelle an jeder
   * gebührenpflichtigen Zone eingetragen.
   */
  absent: ['umweltzone', 'segments'],
})

console.log(
  `\n${zoneFeatures.length} Kurzparkzonen (${paid} gebührenpflichtig, ${zoneFeatures.length - paid} mit Parkscheibe), ` +
    `${districtFeatures.length} Stadtteile aus ${[...pieces.values()].reduce((n, rings) => n + rings.length, 0)} Stücken, ` +
    `${poi.length} Behindertenstellplätze — ${skippedInactive} nicht aktiv, ${skippedUnreadable} unlesbar, ` +
    `${skippedNoGeometry} ohne brauchbare Fläche, ` +
    `${withoutDistrict} ohne Stadtteil-Treffer, ${defects} mit widersprüchlichem ART, ${foreignPieces} Stücke fremder Gemeinden`
)
console.log('Schreibweisen der Zeitangabe:')
for (const [text, count] of [...rawHoursSeen.entries()].sort((a, b) => b[1] - a[1])) {
  console.log(`  ${count}× ${text}`)
}
