/**
 * Baut Frankfurts Daten — das dritte Gegenstück zu `build-data.ts`.
 *
 * Drei Skripte statt eines mit drei Zweigen, aus demselben Grund wie bei
 * Hamburg: Die Feeds teilen sich außer dem Wort „Parken" nichts. Andere
 * Felder, andere Schreibweisen, andere Dienste, andere Lizenz.
 *
 * Was Frankfurt **anders** macht als beide anderen Städte, und was dieses
 * Skript deshalb tun muss:
 *
 * - **Die Sachdaten hängen nicht am Polygon.** Ein Bewohnerparkbereich trägt
 *   nur eine Nummer (`name` und `description` sind in allen 42 Bereichen
 *   `null`). Tarif, Geltungszeit und Höchstparkdauer stehen an den 921
 *   Parkscheinautomaten. Was für einen Bereich gilt, entsteht hier durch
 *   Zusammenlegen der Automaten **darin**.
 * - **Die Zuordnung läuft über die Geometrie, nicht über das Attribut.**
 *   Begründung mit Zahlen steht unten, bei der Schleife über `placedAutomats`.
 * - **Ohne `srsName` antwortet der Dienst in UTM.** Die Prüfung dagegen steht
 *   unten in `assertDegrees`.
 *
 * Was Frankfurt **nicht** hat und Berlin schon:
 *
 * - **Keine Stellplatzzahlen.** Der Feed zählt keine Plätze; `spaces` bleibt
 *   null. Eine geschätzte Zahl wäre schlechter als keine.
 * - **Keine Umweltzonen-Geometrie.** Frankfurt *hat* eine Umweltzone — der
 *   Parken-Dienst führt sie nur nicht. `absent` in `meta.json` heißt hier
 *   also „nicht in diesem Abzug", nicht „gibt es nicht"; das steht auch in
 *   `docs/staedte.md`.
 * - **Keine Ladepunkte und kein Carsharing.** Andere Dienste, andere Felder.
 *   `poi.geojson` trägt deshalb nur die 458 Behindertenparkplätze.
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

import {
  FRANKFURT,
  frankfurtMaxStayCode,
  frankfurtZoneLabel,
  frankfurtZoneNote,
  mergeFrankfurtFees,
  mergeFrankfurtWindows,
  multiPolygonContains,
  parseFrankfurtFee,
  parseFrankfurtMaxStay,
  parseFrankfurtSchedule,
  stripHtml,
  type ChargeWindow,
  type Fee,
  type FrankfurtAutomatProperties,
  type FrankfurtZoneProperties,
  type PolygonRings,
  type Position,
} from '@knoellchenfrei/core'

import { citySources, toGeoJsonAxes, type AxisOrder } from './sources.js'
import { roundPoint, simplifyGeometry } from './simplify.js'

const RAW = join(process.env.RAW_DIR ?? join(process.cwd(), '../../.raw'), FRANKFURT.key)
const OUT = join(
  process.env.OUT_DIR ?? join(process.cwd(), '../../apps/web/public/data'),
  FRANKFURT.key
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

const SOURCES = citySources(FRANKFURT.key)

function axisOrderOf(key: string): AxisOrder {
  const source = SOURCES.find((candidate) => candidate.key === key)
  if (source === undefined) throw new Error(`Keine Quelle "${key}" für Frankfurt`)
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
 * Der Frankfurter WFS antwortet **ohne** `srsName` stillschweigend in
 * EPSG:25832: `[477189.85, 5550859.91]`. Das sind plausible Zahlen, nur keine
 * Grade — und weil `wfsUrl` den Parameter setzt, fällt so ein Abruf nur dann
 * auf, wenn jemand die Adresse von Hand zusammenbaut oder der Dienst den
 * Parameter eines Tages ignoriert. Ohne diese Prüfung landeten alle 42
 * Bereiche irgendwo bei 477.000° Ost; die Karte sähe dabei nur leer aus, nicht
 * kaputt, und niemand käme auf die Idee, dass die Koordinaten das Problem sind.
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

/** Dasselbe Feld-Schema wie Berlin und Hamburg — ein Typ, ein Panel. */
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

console.log('Frankfurt am Main — Daten bauen …')

// ------------------------------------------------------------- Stadtteile
//
// Zuerst, weil die Bereiche sie brauchen: Der Feed nennt zu einem
// Bewohnerparkbereich nichts als eine Nummer. Ohne Stadtteil stünde in der
// Kopfzeile des Panels „Frankfurt am Main / Parkzone 19" — richtig und
// nutzlos.

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
  const raw = feature.properties['STT_NAME']
  const name = typeof raw === 'string' ? raw.trim() : ''

  // Die Zuordnung läuft gegen die UNvereinfachte Geometrie. Vereinfachte
  // Grenzen wandern um bis zu ein paar Dutzend Meter, und ein Bereich direkt
  // an der Stadtteilgrenze bekäme sonst den Nachbarn zugeschrieben.
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

const automatAxis = axisOrderOf('automats')
const automats = readFeatures<FrankfurtAutomatProperties>('automats')

interface Automat {
  properties: FrankfurtAutomatProperties
  point: Position
}

const placedAutomats: Automat[] = []
for (const feature of automats) {
  const geometry = toGeoJson(feature.geometry, automatAxis)
  if (geometry === null) continue
  assertDegrees('automats', geometry)
  const coordinates = geometry.coordinates
  if (!Array.isArray(coordinates)) continue
  const [lon, lat] = coordinates as number[]
  if (typeof lon !== 'number' || typeof lat !== 'number') continue
  placedAutomats.push({ properties: feature.properties, point: [lon, lat] })
}

// ---------------------------------------------------------------- Bereiche

const zoneAxis = axisOrderOf('zones')
const rawZones = readFeatures<FrankfurtZoneProperties>('zones')

interface Zone {
  properties: FrankfurtZoneProperties
  geometry: Geometry
  polygons: PolygonRings[]
  automats: FrankfurtAutomatProperties[]
}

const zones: Zone[] = []
for (const feature of rawZones) {
  const geometry = toGeoJson(feature.geometry, zoneAxis)
  if (geometry === null) continue
  assertDegrees('zones', geometry)
  zones.push({
    properties: feature.properties,
    geometry,
    polygons: toPolygons(geometry),
    automats: [],
  })
}

/**
 * Welcher Automat zu welchem Bereich gehört — **über die Geometrie**.
 *
 * Der Feed bietet beides an: Ein Automat trägt ein Feld `bewohnerparkzone`,
 * das auf die `nummer` eines Bereichs zeigt. Am Abzug vom 7. September 2026
 * ausgezählt, warum trotzdem der Punkt entscheidet und nicht das Attribut:
 *
 * | | über `bewohnerparkzone` | über Punkt-in-Polygon |
 * | --- | --- | --- |
 * | zugeordnete Automaten | 503 von 921 | **808** von 921 |
 * | erreichte Bereiche | 21 von 42 | **27** von 42 |
 * | Automaten, die auf einen Bereich zeigen, in dem sie nicht stehen | 2 | — |
 *
 * Dazu 13 Automaten, bei denen beide Wege ein Ergebnis liefern und sich
 * widersprechen (etwa fünfmal Attribut 20 gegen Polygon 19). Die 21 über das
 * Attribut erreichten Bereiche sind eine echte Teilmenge der 27 geometrischen
 * — das Attribut findet also nichts, was der Punkt nicht auch findet, und
 * lässt 305 Automaten und sechs Bereiche liegen.
 *
 * Der Grund dahinter ist inhaltlich: `bewohnerparkzone` sagt, zu welchem
 * **Bewohnerparkausweis** ein Automat gehört, nicht, wo er steht. Die Frage
 * dieser App ist aber „was gilt an der Stelle, an der ich stehe" — und die
 * beantwortet der Punkt.
 *
 * Kein Punkt fällt in zwei Bereiche; die 42 Polygone überlappen sich nicht.
 * Deshalb genügt der erste Treffer.
 */
let attributeAgrees = 0
let attributeDisagrees = 0
let attributeOutside = 0
let automatsWithoutZone = 0

for (const automat of placedAutomats) {
  const zone = zones.find((candidate) => multiPolygonContains(candidate.polygons, automat.point))
  // Als Zahl, nicht als Zeichenkette -- das stand erst falsch im Interface und
  // ist hier mit `claimed.trim is not a function` aufgeflogen. Die Kennung auf
  // der anderen Seite ist eine Zeichenkette, also wird sie hier erzeugt statt
  // die beiden ungleich zu vergleichen.
  const claimed = automat.properties.bewohnerparkzone
  const claimedLabel = claimed === null || claimed === undefined ? null : String(claimed)
  if (zone === undefined) {
    automatsWithoutZone += 1
    if (claimedLabel !== null) attributeOutside += 1
    continue
  }
  zone.automats.push(automat.properties)
  if (claimedLabel !== null) {
    if (claimedLabel === frankfurtZoneLabel(zone.properties)) attributeAgrees += 1
    else attributeDisagrees += 1
  }
}

const zoneFeatures: { type: 'Feature'; properties: ZoneOut; geometry: Geometry }[] = []
let skippedWithoutAutomats = 0
let skippedFlagged = 0
let withoutDistrict = 0

for (const zone of zones) {
  const label = frankfurtZoneLabel(zone.properties)

  /**
   * Ein Bereich ohne einen einzigen Automaten wird ausgelassen.
   *
   * Dasselbe Kriterium wie bei Hamburgs „ohne Zeitangabe": Ohne Zeiten kann
   * die App die eine Frage nicht beantworten, für die es sie gibt. Ein
   * Polygon ohne Antwort ist schlechter als kein Polygon — es sähe aus wie
   * eine bewirtschaftete Fläche und wüsste über sie nichts.
   *
   * Warum das datengetriebene Kriterium und nicht `mitparkraumbewirtschaftung`:
   * Das Flag steht in 11 der 42 Bereiche auf 1 und sonst auf `null`, und der
   * Feed sagt nicht, was `null` heißt. Nachgemessen am 7. September 2026
   * decken sich die beiden nicht: Alle 11 geflaggten Bereiche haben Automaten
   * — aber **16 weitere** haben ebenfalls welche, ohne geflaggt zu sein. Wer
   * dem Flag folgte, würfe 16 Bereiche mit zusammen 245 Parkscheinautomaten
   * weg und behauptete damit, dort werde nicht bewirtschaftet, während in
   * ihnen Automaten stehen. Das Flag ist also *nicht* „wird bewirtschaftet";
   * was es ist, weiß nur die Stadt (Rückfrage steht in `docs/todo.md`).
   */
  if (zone.automats.length === 0) {
    skippedWithoutAutomats += 1
    if (zone.properties.mitparkraumbewirtschaftung === 1) skippedFlagged += 1
    continue
  }

  const simplified = simplifyGeometry(zone.geometry, 1e-5, 5)
  if (simplified === null) continue

  const district = districtAt(centroid(zone.geometry))
  if (district === null) withoutDistrict += 1

  // Rohtexte: alle verschiedenen, in der Reihenfolge ihres ersten Auftretens,
  // mit `; ` verbunden. Das Panel zeigt sie wörtlich unter „Zeiten laut
  // Quelle" — dort gehört hin, was wirklich an den Automaten steht, nicht
  // eine Zusammenfassung davon.
  const distinct = (values: (string | null | undefined)[]): string[] => [
    ...new Set(values.map((value) => (value ?? '').trim()).filter((value) => value !== '')),
  ]

  const rawHours = distinct(zone.automats.map((automat) => automat.gebuehrenzeit))
  const rawFees = distinct(zone.automats.map((automat) => automat.gebuehrenzone))

  /**
   * Die Höchstparkdauer wird **nie** als Regel des Bereichs ausgegeben.
   *
   * Sie steht je Automat, und in 19 der 27 Bereiche stehen mehrere Werte
   * nebeneinander — oft „1 h" neben „-", also neben „keine". Sie trotzdem als
   * `maxStayMinutes` auszuliefern hiesse zu behaupten, die Quelle nenne sie
   * für das ganze Gebiet; das Panel sagt bei diesem Feld genau das, und es
   * wäre gelogen. Genau dieser Fehler ist in Berlin schon einmal passiert
   * (dort mit den Strassenabschnitten) und hat `maxStayShare` hervorgebracht.
   * Frankfurt benutzt denselben Weg: Wert, Anteil und alle Ausprägungen.
   */
  const stayCounts = new Map<string, number>()
  for (const automat of zone.automats) {
    const minutes = parseFrankfurtMaxStay(automat.maximal_parkdauer)
    if (minutes === undefined) continue
    const code = frankfurtMaxStayCode(minutes)
    stayCounts.set(code, (stayCounts.get(code) ?? 0) + 1)
  }
  const stayEntries = [...stayCounts.entries()].sort((a, b) => b[1] - a[1])
  const limited = stayEntries.reduce((sum, [, count]) => sum + count, 0)

  zoneFeatures.push({
    type: 'Feature',
    properties: {
      zone: label,
      district: district?.name ?? FRANKFURT.name,
      rawHours: rawHours.join('; '),
      rawFee: rawFees.join('; '),
      note: frankfurtZoneNote(zone.properties),
      windows: mergeFrankfurtWindows(
        zone.automats.flatMap((automat) => parseFrankfurtSchedule(automat.gebuehrenzeit ?? ''))
      ),
      fee: mergeFrankfurtFees(
        zone.automats.map((automat) => parseFrankfurtFee(automat.gebuehrenzone))
      ),
      // Frankfurts Feed kennt nichts, was ChargeWindow nicht ausdruecken kann.
      // Das Feld bleibt, damit alle drei Städte dieselbe Form haben.
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
 * Die 458 Behindertenparkplätze, im selben POI-Schema wie Berlins.
 *
 * Ohne Änderung an der Oberfläche: `kind: 'accessible'` gibt es dort schon,
 * und Beschriftung und Detailzeile haben dieselbe Form. Der Feed nennt Anzahl
 * und Öffnungszeiten; beides ist genau das, was jemand vor Ort wissen will.
 *
 * Die 113 Parkscheinautomaten **ohne** Bereich sind hier bewusst NICHT
 * abgelegt. Das POI-Schema kennt vier Arten (`charging`, `carsharing`,
 * `park_and_ride`, `accessible`), und keine passt; sie als eine davon
 * auszugeben hiesse, ein Symbol zu setzen, das etwas anderes behauptet. Eine
 * fünfte Art wäre ein Umbau der Karte, der Legende und der Filter — für eine
 * Stadt, deren Bereichsdaten die Frage schon zu 88 % beantworten. Der offene
 * Punkt steht in `docs/todo.md`.
 */
const accessibleAxis = axisOrderOf('accessible')
const poi: { type: 'Feature'; properties: Record<string, unknown>; geometry: Geometry }[] = []

for (const feature of readFeatures<Record<string, unknown>>('accessible')) {
  const geometry = toGeoJson(feature.geometry, accessibleAxis)
  if (geometry === null) continue
  assertDegrees('accessible', geometry)

  const text = (key: string): string => stripHtml(String(feature.properties[key] ?? ''))
  const spaces = feature.properties['behindertenstellplaetze']
  const count = typeof spaces === 'number' ? spaces : Number.NaN

  const detail = [
    // Singular für einen: "1 Plätze" ist in Berlin schon einmal in die
    // Sprechblase gelaufen.
    Number.isFinite(count) && count > 0 ? `${count} ${count === 1 ? 'Platz' : 'Plätze'}` : null,
    text('vti_oeffnungszeiten') || null,
  ]
    .filter((part) => part !== null && part !== '')
    .join(' · ')

  poi.push({
    type: 'Feature',
    properties: {
      kind: 'accessible',
      label: text('name') || text('description') || 'Behindertenparkplatz',
      detail: detail === '' ? null : detail,
    },
    geometry: {
      type: 'Point',
      coordinates: roundPoint((geometry.coordinates as [number, number]) ?? [0, 0]),
    },
  })
}

write('poi.geojson', { type: 'FeatureCollection', features: poi })

// ------------------------------------------------------- was es nicht gibt

// Leere Sammlung statt fehlender Datei: `loadData` holt für jede Stadt
// dieselben fünf Namen, und ein 404 wäre von einem echten Ladefehler nicht zu
// unterscheiden.
write('umweltzone.geojson', { type: 'FeatureCollection', features: [] })

write('meta.json', {
  city: FRANKFURT.key,
  cityName: FRANKFURT.name,
  source: `${FRANKFURT.attribution.source}, WFS 2.0.0`,
  licence: FRANKFURT.attribution.licence,
  licenceUrl: FRANKFURT.attribution.licenceUrl,
  attributionRequired: FRANKFURT.attribution.attributionRequired,
  datasetUrl: FRANKFURT.attribution.datasetUrl,
  zones: zoneFeatures.length,
  districts: districtFeatures.length,
  poi: poi.length,
  lowEmissionZone: false,
  segments: 0,
  managedSpaces: 0,
  crs: 'EPSG:4326 (lon/lat)',
  /**
   * Was dieser Abzug nicht enthält.
   *
   * `umweltzone` heißt hier ausdrücklich **nicht** „gibt es nicht": Frankfurt
   * hat seit 2008 eine Umweltzone, der Parken-Dienst führt ihre Geometrie nur
   * nicht. `segments` und `managedSpaces` gibt es in der Quelle wirklich nicht.
   */
  absent: ['umweltzone', 'segments'],
})

// Die Zahlen gehören ins Log, nicht in einen Kommentar: Sie sind das, was
// beim nächsten Abzug anders sein kann, und ein Sprung darin ist das erste,
// was auffällt.
console.log(
  `\n${zoneFeatures.length} von ${zones.length} Bereichen übernommen` +
    ` — ${skippedWithoutAutomats} ohne Parkscheinautomaten ausgelassen` +
    ` (davon ${skippedFlagged} mit mitparkraumbewirtschaftung=1)` +
    `, ${withoutDistrict} ohne Stadtteil-Treffer`
)
console.log(
  `${placedAutomats.length - automatsWithoutZone} von ${placedAutomats.length} Automaten` +
    ` einem Bereich zugeordnet, ${automatsWithoutZone} liegen in keinem`
)
console.log(
  `Attribut bewohnerparkzone: ${attributeAgrees} mal einig mit der Geometrie,` +
    ` ${attributeDisagrees} mal uneins, ${attributeOutside} mal auf einen Bereich zeigend,` +
    ' in dem der Automat nicht steht'
)
console.log(`${poi.length} Behindertenparkplätze, ${districtFeatures.length} Stadtteile`)
