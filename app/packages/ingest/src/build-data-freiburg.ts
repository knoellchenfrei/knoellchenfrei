/**
 * Baut Freiburgs Daten — das achte Gegenstück zu `build-data.ts`.
 *
 * Ein Skript je Stadt, aus demselben Grund wie bei allen davor: Die Feeds
 * teilen sich außer dem Wort „Parken" nichts.
 *
 * Was Freiburg **anders** macht, und was dieses Skript deshalb tut:
 *
 * - **Die Fläche trägt Zeit und Betrag selbst** — wie Hamburg. Die 538
 *   Parkscheinautomaten sind hier nicht die Sachauskunft (wie in Frankfurt),
 *   sondern die **Gegenprobe**: Der Datenbau zählt je Fläche, wie viele
 *   Automaten darin dasselbe sagen wie die Fläche, und schreibt es ins Log.
 * - **Eine Fläche verweist auf die Beschilderung.** Die einzige Fläche der
 *   Gebührenzone 1 (Altstadt) schreibt `Beschilderung beachten!` statt einer
 *   Zeit. Für sie kommen die Fenster aus den Automaten darin — wie Frankfurt
 *   es für alle Bereiche tut —, und `sourceDefect` sagt das.
 * - **Die Höchstparkdauer steht nur am Automaten.** Wie in Frankfurt wird sie
 *   nie als Regel der Fläche ausgegeben, sondern als Wert, Anteil und
 *   Ausprägungen (`maxStay`, `maxStayShare`, `maxStayValues`).
 * - **Ohne `srsName` antwortet der Dienst in UTM.** Die Prüfung dagegen steht
 *   unten in `assertDegrees`.
 *
 * Was Freiburg **nicht** hat: Stellplatzzahlen (`spaces` bleibt null), eine
 * Umweltzone (Freiburg hat seit 2010 eine; der Dienst führt ihre Geometrie
 * nicht — `absent` heißt hier „nicht in diesem Abzug"), Ladepunkte und
 * Carsharing (andere Dienste). `poi.geojson` trägt die 195
 * Behindertenparkplatz-Standorte.
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

import {
  FREIBURG,
  FreiburgParseError,
  freiburgAccessibleCount,
  freiburgMaxStayCode,
  freiburgScheduleTypo,
  freiburgZoneLabel,
  freiburgZoneNote,
  isActiveFreiburgAutomat,
  isFreiburgSignageOnly,
  mergeFreiburgWindows,
  multiPolygonContains,
  parseFreiburgAutomatFee,
  parseFreiburgFee,
  parseFreiburgMaxStay,
  parseFreiburgSchedule,
  type ChargeWindow,
  type Fee,
  type FreiburgAccessibleProperties,
  type FreiburgAutomatProperties,
  type FreiburgZoneProperties,
  type PolygonRings,
  type Position,
} from '@knoellchenfrei/core'

import { citySources, toGeoJsonAxes, type AxisOrder } from './sources.js'
import { roundPoint, simplifyGeometry } from './simplify.js'
import { geprueftAm } from './abruf-zeit.js'

const RAW = join(process.env.RAW_DIR ?? join(process.cwd(), '../../.raw'), FREIBURG.key)
const OUT = join(
  process.env.OUT_DIR ?? join(process.cwd(), '../../apps/web/public/data'),
  FREIBURG.key
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

const SOURCES = citySources(FREIBURG.key)

function axisOrderOf(key: string): AxisOrder {
  const source = SOURCES.find((candidate) => candidate.key === key)
  if (source === undefined) throw new Error(`Keine Quelle "${key}" für Freiburg`)
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
 * Ohne `srsName` antwortet `geoportal.freiburg.de` in EPSG:25832:
 * `[412031.0, 5317230.4]`. Plausible Zahlen, nur keine Grade — und weil
 * `wfsUrl` den Parameter setzt, fällt so ein Abruf nur dann auf, wenn jemand
 * die Adresse von Hand zusammenbaut oder der Dienst den Parameter eines
 * Tages ignoriert. Auf der Karte sähe das nur nach „leer" aus.
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

/** Dasselbe Feld-Schema wie alle Städte davor — ein Typ, ein Panel. */
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

console.log('Freiburg im Breisgau — Daten bauen …')

// ------------------------------------------------------------- Stadtteile
//
// Zuerst, weil die Flächen sie brauchen: Der Feed nennt zu einer Fläche
// keinen Stadtteil, nur „Zone 3". Ohne Stadtteil stünde in der Kopfzeile des
// Panels „Freiburg im Breisgau / Zone 3 (Fläche 12)" — richtig und nutzlos.

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
  const raw = feature.properties['name']
  const name = typeof raw === 'string' ? raw.trim() : ''

  // Die Zuordnung läuft gegen die UNvereinfachte Geometrie. Vereinfachte
  // Grenzen wandern um bis zu ein paar Dutzend Meter, und eine Fläche direkt
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

interface Automat {
  properties: FreiburgAutomatProperties
  point: Position
  /** Die gelesenen Fenster — oder null, wenn die Zeile nicht lesbar ist. */
  windows: ChargeWindow[] | null
}

const placedAutomats: Automat[] = []
let inactiveAutomats = 0
let unreadableAutomats = 0
const unreadableTexts = new Map<string, number>()

for (const feature of readFeatures<FreiburgAutomatProperties>('automats')) {
  if (!isActiveFreiburgAutomat(feature.properties)) {
    inactiveAutomats += 1
    continue
  }
  const geometry = toGeoJson(feature.geometry, automatAxis)
  if (geometry === null) continue
  assertDegrees('automats', geometry)
  const coordinates = geometry.coordinates
  if (!Array.isArray(coordinates)) continue
  const [lon, lat] = coordinates as number[]
  if (typeof lon !== 'number' || typeof lat !== 'number') continue

  // Ein unlesbarer Automat bleibt ein Automat — er zählt für die Zuordnung
  // und die Höchstparkdauer, nur nicht für die Zeiten. Was er sagt, steht
  // gezählt im Log; heute ist es genau einer („9 - 19 Uhr" ohne Tag).
  let windows: ChargeWindow[] | null
  try {
    windows = parseFreiburgSchedule(feature.properties.laufzeiten ?? '')
  } catch (error) {
    if (!(error instanceof FreiburgParseError)) throw error
    windows = null
    unreadableAutomats += 1
    const text = (feature.properties.laufzeiten ?? '').replace(/\s+/g, ' ').trim()
    unreadableTexts.set(text, (unreadableTexts.get(text) ?? 0) + 1)
  }
  placedAutomats.push({ properties: feature.properties, point: [lon, lat], windows })
}

// ----------------------------------------------------------------- Flächen

const zoneAxis = axisOrderOf('zones')

interface Zone {
  properties: FreiburgZoneProperties
  geometry: Geometry
  polygons: PolygonRings[]
  automats: Automat[]
}

const zones: Zone[] = []
for (const feature of readFeatures<FreiburgZoneProperties>('zones')) {
  const geometry = toGeoJson(feature.geometry, zoneAxis)
  if (geometry === null) continue
  assertDegrees('zones', geometry)
  zones.push({ properties: feature.properties, geometry, polygons: toPolygons(geometry), automats: [] })
}

/**
 * Welcher Automat in welcher Fläche steht — über die Geometrie.
 *
 * Der Automat trägt `gebuehrenzone` (1/2/3), die Fläche `parkgebuehrenzone`
 * — aber „Zone 3" sind 34 Flächen, das Attribut kann also keine Fläche
 * benennen, nur einen Tarif. Am Abzug vom 16. September 2026: 515 von 538
 * Automaten stehen in einer Fläche, keiner in zweien, 23 in keiner; bei 510
 * stimmt die Zonennummer mit der Fläche überein, bei 5 nicht. Die fünf
 * stehen im Log, nicht in den Daten — die Fläche entscheidet.
 */
let attributeAgrees = 0
let attributeDisagrees = 0
let automatsWithoutZone = 0

for (const automat of placedAutomats) {
  const zone = zones.find((candidate) => multiPolygonContains(candidate.polygons, automat.point))
  if (zone === undefined) {
    automatsWithoutZone += 1
    continue
  }
  zone.automats.push(automat)
  const claimed = automat.properties.gebuehrenzone
  if (claimed !== null && claimed !== undefined) {
    if (String(claimed) === (zone.properties.parkgebuehrenzone ?? '').trim()) attributeAgrees += 1
    else attributeDisagrees += 1
  }
}

/** Ein Fenster als Vergleichsschlüssel — für „sagt der Automat dasselbe wie die Fläche". */
function windowsKey(windows: readonly ChargeWindow[]): string {
  return windows
    .map((window) => `${[...window.weekdays].join(',')}|${window.fromMinute}|${window.toMinute}`)
    .sort()
    .join(';')
}

/** Alle verschiedenen Rohtexte mit Anzahl, häufigster zuerst — für `rawHours` und das Log. */
function countTexts(automats: readonly Automat[]): [string, number][] {
  const counts = new Map<string, number>()
  for (const automat of automats) {
    const text = (automat.properties.laufzeiten ?? '').replace(/\s+/g, ' ').trim()
    if (text === '') continue
    counts.set(text, (counts.get(text) ?? 0) + 1)
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1])
}

const zoneFeatures: { type: 'Feature'; properties: ZoneOut; geometry: Geometry }[] = []
let skippedUnreadable = 0
let skippedSignageWithoutAutomats = 0
let withoutDistrict = 0
let automatsAgreeingWithZone = 0
let automatsDifferingFromZone = 0
const differing: string[] = []
let feeAgrees = 0
let feeDisagrees = 0

for (const zone of zones) {
  const p = zone.properties
  const label = freiburgZoneLabel(p)
  const rawHoursOfZone = (p.zeit_der_gebuehrenpflicht ?? '').replace(/\s+/g, ' ').trim()
  const rawFee = (p.parkgebuehr_je_stunde ?? '').trim()
  const fee = parseFreiburgFee(p.parkgebuehr_je_stunde)

  let windows: ChargeWindow[]
  let rawHours = rawHoursOfZone
  let sourceDefect: string | null = null

  if (isFreiburgSignageOnly(rawHoursOfZone)) {
    /**
     * Die eine Fläche ohne Zeit — die Altstadt, Gebührenzone 1.
     *
     * Ohne Zeiten kann die App die eine Frage nicht beantworten, für die es
     * sie gibt; die Fläche auszulassen hiesse aber, ausgerechnet die Altstadt
     * als „nicht bewirtschaftet" zu zeigen. Der Feed hat die Antwort an
     * anderer Stelle: 109 Automaten stehen in der Fläche, 93 davon sagen
     * `werktags 09:00 - 23:00` — das ist auch die Zeit, die die Stadt auf
     * ihrer Seite für Zone 1 nennt (9–23 Uhr werktags). Die anderen 16
     * nennen sieben weitere Schreibweisen, darunter zehnmal „täglich".
     *
     * Wie in Frankfurt gilt die **Vereinigung** der Fenster: Was irgendein
     * Automat in der Fläche verlangt, meldet die App als Gebührenpflicht.
     * Das warnt sonntags an Stellen, an denen die Mehrheit nicht kassiert —
     * die teurere Richtung wäre die andere, und `rawHours` nennt jede
     * Schreibweise mit ihrer Zahl, damit der Leser sieht, was die Mehrheit
     * sagt. `sourceDefect` sagt, dass die Fläche selbst keine Zeit nennt.
     */
    const readable = zone.automats.filter((automat) => automat.windows !== null)
    if (readable.length === 0) {
      skippedSignageWithoutAutomats += 1
      continue
    }
    windows = mergeFreiburgWindows(readable.flatMap((automat) => automat.windows ?? []))
    const texts = countTexts(zone.automats)
    rawHours =
      `${rawHoursOfZone} — laut den ${zone.automats.length} Automaten darin: ` +
      texts.map(([text, count]) => `${text} (${count})`).join('; ')
    sourceDefect =
      'die Fläche nennt keine Zeit, sondern „Beschilderung beachten!"; die Zeiten hier ' +
      `stammen von den ${zone.automats.length} Parkscheinautomaten in der Fläche`
  } else {
    // Der eine Tippfehler des Feeds: wörtlich bekannt, wörtlich korrigiert,
    // und als Quelldefekt vermerkt — sonst sähe die Korrektur aus wie eine
    // gelesene Tatsache.
    const typo = freiburgScheduleTypo(rawHoursOfZone)
    const text = typo === null ? rawHoursOfZone : typo.corrected
    if (typo !== null) {
      sourceDefect = `die Quelle schreibt „${rawHoursOfZone}"; gelesen als „${typo.corrected}"`
    }
    try {
      windows = parseFreiburgSchedule(text)
    } catch (error) {
      if (!(error instanceof FreiburgParseError)) throw error
      // Eine Fläche, deren Zeit sich nicht lesen lässt, wird ausgelassen —
      // mit Zählung im Log. Heute keine; die Zählung steht, damit ein neuer
      // Wert im Feed auffällt, statt still zu verschwinden.
      skippedUnreadable += 1
      console.log(`  ausgelassen ${label}: ${(error as Error).message}`)
      continue
    }

    // Gegenprobe: Sagen die Automaten in der Fläche dasselbe wie die Fläche?
    // Nur im Log — die Fläche ist die amtliche Aussage über die Fläche.
    const zoneKey = windowsKey(windows)
    for (const automat of zone.automats) {
      if (automat.windows === null) continue
      if (windowsKey(automat.windows) === zoneKey) automatsAgreeingWithZone += 1
      else automatsDifferingFromZone += 1
    }
    const differingTexts = countTexts(
      zone.automats.filter((automat) => automat.windows !== null && windowsKey(automat.windows) !== zoneKey)
    )
    if (differingTexts.length > 0) {
      differing.push(
        `${label} „${rawHoursOfZone}": ` + differingTexts.map(([text, count]) => `${text} (${count})`).join('; ')
      )
    }
  }

  // Gegenprobe auch beim Betrag: `tarif_e_h` der Automaten gegen
  // `parkgebuehr_je_stunde` der Fläche.
  for (const automat of zone.automats) {
    const automatFee = parseFreiburgAutomatFee(automat.properties.tarif_e_h)
    if (fee.kind !== 'exact' || automatFee.kind !== 'exact') continue
    if (fee.centsPerHour === automatFee.centsPerHour) feeAgrees += 1
    else feeDisagrees += 1
  }

  const simplified = simplifyGeometry(zone.geometry, 1e-5, 5)
  if (simplified === null) continue

  const district = districtAt(centroid(zone.geometry))
  if (district === null) withoutDistrict += 1

  /**
   * Die Höchstparkdauer wird **nie** als Regel der Fläche ausgegeben.
   *
   * Sie steht je Automat, und in der Altstadt stehen 79-mal „24 h" (keine)
   * neben 29-mal „1 h" und einmal „2 h". Sie als `maxStayMinutes`
   * auszuliefern hiesse zu behaupten, die Quelle nenne sie für die ganze
   * Fläche. Frankfurts Weg gilt auch hier: Wert, Anteil, Ausprägungen.
   */
  const stayCounts = new Map<string, number>()
  for (const automat of zone.automats) {
    const minutes = parseFreiburgMaxStay(automat.properties.hoechstparkdauer_in_h)
    if (minutes === undefined) continue
    const code = freiburgMaxStayCode(minutes)
    stayCounts.set(code, (stayCounts.get(code) ?? 0) + 1)
  }
  const stayEntries = [...stayCounts.entries()].sort((a, b) => b[1] - a[1])
  const limited = stayEntries.reduce((sum, [, count]) => sum + count, 0)

  zoneFeatures.push({
    type: 'Feature',
    properties: {
      zone: label,
      district: district?.name ?? FREIBURG.name,
      rawHours,
      rawFee,
      note: freiburgZoneNote(p),
      windows,
      fee,
      // Freiburgs Feed kennt nichts, was ChargeWindow nicht ausdrücken kann.
      unmodelledRules: [],
      sourceDefect,
      spaces: null,
      maxStayMinutes: null,
      maxStay: stayEntries[0]?.[0] ?? null,
      maxStayShare:
        zone.automats.length === 0 ? 0 : Math.round((limited / zone.automats.length) * 1000) / 1000,
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
 * Die 195 Behindertenparkplatz-Standorte, im selben POI-Schema wie Berlins.
 *
 * Die Übersichtsebene, nicht die 328 Einzelplätze: Ein Symbol je Standort,
 * und `anzahl` sagt, wie viele Plätze dort sind („1 von 2" heisst zwei).
 */
const accessibleAxis = axisOrderOf('accessible')
const poi: { type: 'Feature'; properties: Record<string, unknown>; geometry: Geometry }[] = []

for (const feature of readFeatures<FreiburgAccessibleProperties>('accessible')) {
  const geometry = toGeoJson(feature.geometry, accessibleAxis)
  if (geometry === null) continue
  assertDegrees('accessible', geometry)
  const coordinates = geometry.coordinates
  if (!Array.isArray(coordinates)) continue
  const [lon, lat] = coordinates as number[]
  if (typeof lon !== 'number' || typeof lat !== 'number') continue

  const p = feature.properties
  const text = (value: string | null | undefined): string => (value ?? '').replace(/\s+/g, ' ').trim()
  const count = freiburgAccessibleCount(p.anzahl)
  const detail = [
    // Singular für einen: „1 Plätze" ist in Berlin schon einmal in die
    // Sprechblase gelaufen.
    count !== null && count > 0 ? `${count} ${count === 1 ? 'Platz' : 'Plätze'}` : null,
    text(p.hinweis) || null,
  ]
    .filter((part) => part !== null)
    .join(' · ')

  poi.push({
    type: 'Feature',
    properties: {
      kind: 'accessible',
      label: [text(p.strasse), text(p.hausnummer)].filter((part) => part !== '').join(' ') || 'Behindertenparkplatz',
      detail: detail === '' ? null : detail,
    },
    geometry: { type: 'Point', coordinates: roundPoint([lon, lat]) },
  })
}

write('poi.geojson', { type: 'FeatureCollection', features: poi })

// ------------------------------------------------------- was es nicht gibt

// Leere Sammlung statt fehlender Datei: `loadData` holt für jede Stadt
// dieselben fünf Namen, und ein 404 wäre von einem echten Ladefehler nicht zu
// unterscheiden.
write('umweltzone.geojson', { type: 'FeatureCollection', features: [] })

write('meta.json', {
  city: FREIBURG.key,
  cityName: FREIBURG.name,
  source: `${FREIBURG.attribution.source}, WFS 2.0.0`,
  licence: FREIBURG.attribution.licence,
  licenceUrl: FREIBURG.attribution.licenceUrl,
  attributionRequired: FREIBURG.attribution.attributionRequired,
  datasetUrl: FREIBURG.attribution.datasetUrl,
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
   * Was dieser Abzug nicht enthält.
   *
   * `umweltzone` heißt hier **nicht** „gibt es nicht": Freiburg hat seit 2010
   * eine Umweltzone, der Parken-Dienst führt ihre Geometrie nur nicht.
   * `segments` und `managedSpaces` gibt es in der Quelle wirklich nicht.
   */
  absent: ['umweltzone', 'segments'],
})

// Die Zahlen gehören ins Log, nicht in einen Kommentar: Sie sind das, was
// beim nächsten Abzug anders sein kann, und ein Sprung darin ist das erste,
// was auffällt.
console.log(
  `\n${zoneFeatures.length} von ${zones.length} Flächen übernommen` +
    ` — ${skippedUnreadable} mit unlesbarer Zeit ausgelassen` +
    `, ${skippedSignageWithoutAutomats} mit „Beschilderung beachten!" ohne Automaten ausgelassen` +
    `, ${withoutDistrict} ohne Stadtteil-Treffer`
)
console.log(
  `${placedAutomats.length - automatsWithoutZone} von ${placedAutomats.length} Automaten` +
    ` einer Fläche zugeordnet, ${automatsWithoutZone} liegen in keiner, ${inactiveAutomats} nicht aktiv`
)
console.log(
  `Attribut gebuehrenzone: ${attributeAgrees} mal einig mit der Fläche, ${attributeDisagrees} mal uneins`
)
console.log(
  `Zeiten: ${automatsAgreeingWithZone} Automaten sagen dasselbe wie ihre Fläche, ` +
    `${automatsDifferingFromZone} etwas anderes, ${unreadableAutomats} unlesbar` +
    (unreadableTexts.size > 0
      ? ` (${[...unreadableTexts.entries()].map(([text, count]) => `„${text}" ×${count}`).join(', ')})`
      : '')
)
for (const line of differing) console.log(`  abweichend: ${line}`)
console.log(`Betrag: ${feeAgrees} Automaten einig mit ihrer Fläche, ${feeDisagrees} uneins`)
console.log(`${poi.length} Behindertenparkplatz-Standorte, ${districtFeatures.length} Stadtteile`)
