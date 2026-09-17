/**
 * Baut Zürichs Daten — das elfte Gegenstück zu `build-data.ts`.
 *
 * Ein Skript je Stadt, aus demselben Grund wie bei den zehn davor: Die
 * Feeds teilen sich ausser dem Wort „Parkieren" nichts.
 *
 * Was Zürich **anders** macht, und was dieses Skript deshalb tun muss:
 *
 * - **Die Flächen sind Tarifzonen, keine Bewohnerparkgebiete** — und es sind
 *   nur zwei, beide Hochtarif, beide mit derselben Bezeichnung „Innenstadt
 *   und Oerlikon". Den Schlüssel liefert der Erlass: Jede Fläche bekommt
 *   das Gebiet aus Art. 2 der Vorschriften (AS 551.330), dessen Ankerpunkt
 *   sie enthält (`ZUERICH_ORDINANCE.areas`). Enthält eine Fläche keinen
 *   Anker oder zwei, bricht der Bau ab — ein Schlüssel aus `objectid`
 *   stünde auf keinem Schild. Zürich-West (Art. 2 Abs. 3) hat im Feed keine
 *   Fläche; das wird gezählt und gesagt, nicht erfunden.
 * - **Der Betrag kommt aus dem Erlass, die Zeit aus dem Feed.** Kein Feld
 *   nennt Franken; `zuerichFeeFor` liefert die Spanne der Grenzsätze des
 *   Hochtarifs in CHF. Die Bedienungszeit steht an der Fläche
 *   (`bedienungszeiten`), und die Parkuhren darin sind die Gegenprobe:
 *   Sagt eine Parkuhr in der Fläche etwas anderes als die Fläche, wird das
 *   gezählt und steht im `note`; sagt die **Mehrheit** etwas anderes, bricht
 *   der Bau ab, weil dann die Fläche und nicht die Parkuhr veraltet ist.
 * - **Der Niedertarif hat keine Fläche.** 844 der 1.397 Parkuhren stehen
 *   ausserhalb beider Flächen, darunter 70 mit `HOCH` — in der Enge und im
 *   Seefeld, also in Strassen, die Art. 2 Abs. 1 wörtlich zur Innenstadt
 *   zählt (Breitinger-, Seestrasse, Parkring, Gutenbergstrasse, Kreuzstrasse
 *   „alle inklusive"). Für sie gibt es keine Fläche, und ein Puffer um die
 *   Parkuhr wäre eine Behauptung über Strassen, die niemand geprüft hat.
 *   Sie fehlen deshalb, mit Zählung im Log und im Bericht.
 * - **Die Koordinaten kommen als `[lon, lat]` in Grad**, weil die Abfrage
 *   `SRSNAME=EPSG:4326` sagt — mit der URN-Form antwortete der QGIS Server
 *   mit 500. `assertDegrees` prüft die Grade, `assertInZuerich` den Rahmen:
 *   Vertauscht lägen die Flächen bei 8° Nord, 47° Ost — in Somalia, und
 *   `assertDegrees` sähe dabei gültige Grade.
 *
 * Was Zürich **nicht** hat und Berlin schon: keine POI (Behindertenparkplätze
 * liegen in einem Datensatz von 2017, nicht abgerufen), keine Umweltzone
 * (die Schweiz kennt keine), keine Strassenabschnitte.
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

import {
  ZUERICH,
  ZUERICH_ORDINANCE,
  multiPolygonContains,
  parseZuerichMaxStay,
  parseZuerichMeterTariff,
  parseZuerichSchedule,
  parseZuerichTariffZone,
  withinBounds,
  zuerichFeeFor,
  zuerichFeeText,
  zuerichMaxStayLabel,
  zuerichMeterTariffText,
  type BoundingBox,
  type ChargeWindow,
  type Fee,
  type PolygonRings,
  type Position,
  type ZuerichMeterProperties,
  type ZuerichMeterTariff,
  type ZuerichOrdinanceArea,
  type ZuerichQuartierProperties,
  type ZuerichSpaceProperties,
  type ZuerichTariffLevel,
  type ZuerichZoneProperties,
} from '@knoellchenfrei/core'

import { simplifyGeometry } from './simplify.js'
import { geprueftAm } from './abruf-zeit.js'

const RAW = join(process.env.RAW_DIR ?? join(process.cwd(), '../../.raw'), ZUERICH.key)
const OUT = join(process.env.OUT_DIR ?? join(process.cwd(), '../../apps/web/public/data'), ZUERICH.key)

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
 * Liest eine Antwort des QGIS Servers — und weist ab, was `fetch.ts` schon
 * abweist, noch einmal: Ein Abzug, der von Hand mit `curl` geholt wurde, ist
 * an der Prüfung dort vorbeigekommen. Eine HTML-Fehlerseite (der 500 auf die
 * URN-Form) beginnt mit `<` und scheitert hier an `JSON.parse`, laut.
 */
function readFeatures<P>(name: string): Feature<P>[] {
  const parsed = JSON.parse(readFileSync(join(RAW, name), 'utf8')) as { features?: Feature<P>[] }
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
 * Bricht ab, wenn der Dienst LV95-Meter statt Grad geliefert hat.
 *
 * Das Layer-CRS ist EPSG:2056 (`hochwert`/`rechtswert` an den Parkuhren
 * zeigen es: 1.243.681 / 2.683.177); nur `SRSNAME=EPSG:4326` macht Grade
 * daraus. Fällt der Parameter eines Tages weg, kämen plausible Zahlen, nur
 * keine Grade, und die Karte sähe dabei nur leer aus.
 */
function assertDegrees(key: string, geometry: Geometry): void {
  const walk = (node: unknown): void => {
    if (!Array.isArray(node)) return
    if (typeof node[0] === 'number' && typeof node[1] === 'number') {
      const [lon, lat] = node as number[]
      if (Math.abs(lon as number) > 180 || Math.abs(lat as number) > 90) {
        throw new Error(
          `${key}: ${lon}/${lat} sind keine Grade — der Dienst hat vermutlich in EPSG:2056 (LV95) ` +
            'geantwortet. SRSNAME=EPSG:4326 fehlt in der Abfrage.'
        )
      }
      return
    }
    node.forEach(walk)
  }
  walk(geometry.coordinates)
}

/**
 * Bricht ab, wenn ein Punkt ausserhalb Zürichs liegt — die Messung der
 * Achsenreihenfolge. Der Rahmen ist `reportBounds`, also die Hülle der
 * Quartiere.
 */
function assertInZuerich(key: string, point: Position): void {
  const [lon, lat] = point
  const b = ZUERICH.reportBounds
  if (lon < b.minLon || lon > b.maxLon || lat < b.minLat || lat > b.maxLat) {
    throw new Error(`${key}: ${lon}/${lat} liegt nicht in Zürich — Achsenreihenfolge der Abfrage prüfen`)
  }
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

/** Der erste Punkt einer Punkt- oder Mehrpunktgeometrie. */
function firstPoint(geometry: Geometry | null): Position | null {
  if (geometry === null) return null
  const points = positionsOf(geometry)
  return points[0] ?? null
}

const windowKey = (window: ChargeWindow): string =>
  `${[...window.weekdays].join(',')}|${window.fromMinute}|${window.toMinute}`

function sameWindows(a: readonly ChargeWindow[], b: readonly ChargeWindow[]): boolean {
  const left = [...a].map(windowKey).sort()
  const right = [...b].map(windowKey).sort()
  return left.length === right.length && left.every((key, index) => key === right[index])
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

console.log('Zürich — Daten bauen …')

// -------------------------------------------------------------- Quartiere
//
// Zuerst, weil die Flächen sie brauchen: Die Fläche heisst „Innenstadt", das
// Quartier ist die Ebene, in der die Suche und die Kopfzeile des Panels
// denken. Der Kreis steht als Zusatz dabei — „Lindenhof (Kreis 1)" ist die
// Form, in der Zürich seine Quartiere nennt.

interface District {
  name: string
  kreis: string
  rings: PolygonRings[]
}

const districtFeatures: { type: 'Feature'; properties: { name: string }; geometry: Geometry }[] = []
const districtIndex: District[] = []

for (const feature of readFeatures<ZuerichQuartierProperties>('districts.json')) {
  if (feature.geometry === null) continue
  assertDegrees('districts', feature.geometry)
  const name = (feature.properties.qname ?? '').trim()
  const kreis = (feature.properties.kname ?? '').trim()
  if (name === '' || kreis === '') throw new Error('districts: ein Quartier ohne qname oder kname')
  const first = firstPoint(feature.geometry)
  if (first !== null) assertInZuerich('districts', first)

  // Die Zuordnung läuft gegen die UNvereinfachte Geometrie. Vereinfachte
  // Grenzen wandern um bis zu ein paar Dutzend Meter, und eine Fläche direkt
  // an der Quartiergrenze bekäme sonst den Nachbarn zugeschrieben.
  districtIndex.push({ name, kreis, rings: toPolygons(feature.geometry) })

  const simplified = simplifyGeometry(feature.geometry, 1e-4, 5)
  if (simplified === null) continue
  districtFeatures.push({ type: 'Feature', properties: { name: `${name} (${kreis})` }, geometry: simplified })
}

const districtNames = new Set(districtIndex.map((district) => district.name))
if (districtNames.size !== districtIndex.length) {
  throw new Error(`${districtIndex.length} Quartiere, aber nur ${districtNames.size} verschiedene Namen`)
}

write('districts.geojson', { type: 'FeatureCollection', features: districtFeatures })

function districtAt(point: Position | null): District | null {
  if (point === null) return null
  return districtIndex.find((district) => multiPolygonContains(district.rings, point)) ?? null
}

// ------------------------------------------------------------------- Zonen

interface Zone {
  area: ZuerichOrdinanceArea
  level: ZuerichTariffLevel
  properties: ZuerichZoneProperties
  geometry: Geometry
  polygons: PolygonRings[]
  bounds: BoundingBox
  windows: ChargeWindow[]
  meters: { properties: ZuerichMeterProperties; tariff: ZuerichMeterTariff }[]
  spaces: ZuerichSpaceProperties[]
}

const zones: Zone[] = []
for (const feature of readFeatures<ZuerichZoneProperties>('zones.json')) {
  if (feature.geometry === null) continue
  assertDegrees('zones', feature.geometry)
  const polygons = toPolygons(feature.geometry)
  const points = positionsOf(feature.geometry)
  for (const point of points) assertInZuerich('zones', point)

  /**
   * Der Schlüssel aus dem Erlass: das Gebiet, dessen Anker in der Fläche
   * liegt. Genau eines — zwei Anker in einer Fläche hiesse, die Stadt hat
   * Innenstadt und Oerlikon zu einem Polygon verbunden, und dann stimmt der
   * Schlüssel nicht mehr; keiner hiesse, die Fläche ist eine, die der
   * Erlass nicht kennt.
   */
  const areas = ZUERICH_ORDINANCE.areas.filter((area) => multiPolygonContains(polygons, area.anchor))
  if (areas.length !== 1) {
    throw new Error(
      `zones: Fläche objectid=${feature.properties.objectid ?? '?'} enthält ${areas.length} Ankerpunkte ` +
        `(${areas.map((area) => area.anchorName).join(', ')}) — erwartet genau einen`
    )
  }
  const area = areas[0] as ZuerichOrdinanceArea

  const lons = points.map((point) => point[0])
  const lats = points.map((point) => point[1])
  zones.push({
    area,
    level: parseZuerichTariffZone(feature.properties.tarifzone),
    properties: feature.properties,
    geometry: feature.geometry,
    polygons,
    bounds: {
      minLon: Math.min(...lons),
      maxLon: Math.max(...lons),
      minLat: Math.min(...lats),
      maxLat: Math.max(...lats),
    },
    windows: parseZuerichSchedule(feature.properties.bedienungszeiten),
    meters: [],
    spaces: [],
  })
}

const keys = new Set(zones.map((zone) => zone.area.key))
if (keys.size !== zones.length) {
  throw new Error(`${zones.length} Flächen, aber nur ${keys.size} verschiedene Gebiete des Erlasses`)
}
const areasWithoutPolygon = ZUERICH_ORDINANCE.areas.filter((area) => !keys.has(area.key))

function zoneAt(point: Position): Zone | undefined {
  return zones.find(
    (candidate) => withinBounds(point, candidate.bounds) && multiPolygonContains(candidate.polygons, point)
  )
}

// --------------------------------------------------------------- Parkuhren
//
// Die Gegenprobe zur Fläche. Jede Parkuhr sagt in `tarif`, welche Stufe,
// welche Höchstparkdauer und welche Zeiten an ihr gelten; die Fläche sagt
// nur Stufe und Zeiten. Gemessen am 17. September 2026 stehen in der
// Innenstadt-Fläche 495 Parkuhren, davon 475 mit „HOCH … Mo-Sa 09:00-20:00",
// 10 mit NIEDER (alle am Nordrand, Unterstrass und Oberstrass) und 10 HOCH
// mit anderen Zeiten (Car-Parkplätze am Stadthausquai und Bahnhofquai,
// Mo-So 08:00-21:00). Die Fläche gilt; die Abweichungen stehen im `note`.

let metersTotal = 0
let metersSpecial = 0
let metersOutside = 0
const outsideByTariff = new Map<string, number>()

for (const feature of readFeatures<ZuerichMeterProperties>('meters.json')) {
  metersTotal += 1
  const point = firstPoint(feature.geometry)
  if (point === null) continue
  assertDegrees('meters', feature.geometry as Geometry)
  assertInZuerich('meters', point)
  const tariff = parseZuerichMeterTariff(feature.properties.tarif)
  if (tariff.kind === 'special') metersSpecial += 1
  const zone = zoneAt(point)
  if (zone === undefined) {
    metersOutside += 1
    const label = zuerichMeterTariffText(tariff)
    outsideByTariff.set(label, (outsideByTariff.get(label) ?? 0) + 1)
    continue
  }
  zone.meters.push({ properties: feature.properties, tariff })
}

// -------------------------------------------------------------- Parkfelder
//
// 13.272 Punkte, je Parkfeld einer. `gebpflicht` sagt, ob es kassiert,
// `parkdauer`, wie lange man stehen darf. Nur die Felder in einer Fläche
// zählen; die 9.727 ausserhalb gehören zum Niedertarif oder zur Blauen Zone,
// und für beide gibt es keine Fläche.

let spacesTotal = 0
let spacesChargeable = 0
for (const feature of readFeatures<ZuerichSpaceProperties>('spaces.json')) {
  spacesTotal += 1
  if (feature.properties.gebpflicht === '1') spacesChargeable += 1
  const point = firstPoint(feature.geometry)
  if (point === null) continue
  assertDegrees('spaces', feature.geometry as Geometry)
  assertInZuerich('spaces', point)
  const zone = zoneAt(point)
  if (zone === undefined) continue
  zone.spaces.push(feature.properties)
}

// ------------------------------------------------------- Zonen ausgeben

const zoneFeatures: { type: 'Feature'; properties: ZoneOut; geometry: Geometry }[] = []
let totalSpaces = 0
let metersInZones = 0
let metersAgreeing = 0
let metersDeviating = 0

for (const zone of zones) {
  const regular = zone.meters.flatMap((meter) => (meter.tariff.kind === 'regular' ? [meter.tariff] : []))
  const agreeing = regular.filter(
    (tariff) => tariff.level === zone.level && sameWindows(tariff.windows, zone.windows)
  )
  const deviating = zone.meters.length - agreeing.length
  metersInZones += zone.meters.length
  metersAgreeing += agreeing.length
  metersDeviating += deviating

  /**
   * Die Mehrheit der Parkuhren muss der Fläche zustimmen. Sonst ist nicht
   * eine Parkuhr die Ausnahme, sondern die Fläche veraltet — und dann darf
   * der Bau nicht so tun, als wüsste er, was gilt. Heute: 475 von 495 und
   * 52 von 58.
   */
  if (zone.meters.length > 0 && agreeing.length * 2 <= zone.meters.length) {
    throw new Error(
      `${zone.area.key}: nur ${agreeing.length} von ${zone.meters.length} Parkuhren sagen, was die Fläche sagt ` +
        `(${zone.properties.tarifzone ?? '?'}, ${zone.properties.bedienungszeiten ?? '?'}) — die Fläche ist veraltet`
    )
  }

  // Abweichungen gezählt, nach Wortlaut, für das Panel.
  const deviations = new Map<string, number>()
  for (const meter of zone.meters) {
    if (meter.tariff.kind === 'regular' && agreeing.includes(meter.tariff)) continue
    const label = meter.tariff.kind === 'special' ? meter.tariff.label : meter.properties.tarif ?? '?'
    deviations.set(label, (deviations.get(label) ?? 0) + 1)
  }
  const deviationText = [...deviations.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([label, count]) => `${count}× „${label}"`)
    .join(', ')

  // Höchstparkdauer: aus den Parkfeldern mit Parkuhr in der Fläche, als
  // Anteil — wie in Berlin und Frankfurt, denn sie gilt je Feld, nicht je
  // Fläche. Heute 2 h auf 94 % der Felder der Innenstadt.
  const stays = new Map<number, number>()
  let withStay = 0
  for (const space of zone.spaces) {
    const minutes = parseZuerichMaxStay(space.parkdauer)
    if (minutes === undefined) continue
    withStay += 1
    stays.set(minutes, (stays.get(minutes) ?? 0) + 1)
  }
  const stayEntries = [...stays.entries()].sort((a, b) => b[1] - a[1])
  const topStay = stayEntries[0]

  const spaces = zone.spaces.filter((space) => space.gebpflicht === '1').length
  totalSpaces += spaces

  const simplified = simplifyGeometry(zone.geometry, 1e-5, 5)
  if (simplified === null) continue

  // Das Quartier am Ankerpunkt des Erlasses, nicht am Schwerpunkt: Der
  // Schwerpunkt der Innenstadt-Fläche liegt im Quartier Langstrasse (Kreis 4),
  // der Paradeplatz im Quartier City (Kreis 1) — und „Innenstadt, City
  // (Kreis 1)" ist die Auskunft, die jemand am Paradeplatz erwartet.
  const district = districtAt(zone.area.anchor)
  const levelName = zone.level === 'hoch' ? 'Hochtarifzone' : 'Niedertarifzone'

  zoneFeatures.push({
    type: 'Feature',
    properties: {
      zone: zone.area.key,
      district: district === null ? ZUERICH.name : `${district.name} (${district.kreis})`,
      rawHours: zone.properties.bedienungszeiten ?? '',
      rawFee: zuerichFeeText(zone.level),
      note:
        `${levelName} ${zone.area.name} (${zone.area.article} der Vorschriften über die Parkierungs- und ` +
        `Parkuhrkontrollgebühren, AS 551.330) — ${zone.meters.length} Parkuhren in der Fläche, ` +
        `${agreeing.length} davon mit denselben Angaben` +
        (deviationText === '' ? '' : `; abweichend: ${deviationText}`),
      windows: zone.windows,
      fee: zuerichFeeFor(zone.level),
      unmodelledRules: [],
      sourceDefect: null,
      spaces,
      maxStayMinutes: null,
      maxStay: topStay === undefined ? null : zuerichMaxStayLabel(topStay[0]),
      maxStayShare: withStay === 0 || topStay === undefined ? 0 : Math.round((topStay[1] / withStay) * 1000) / 1000,
      maxStayValues: stayEntries.map(([minutes]) => zuerichMaxStayLabel(minutes)),
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
  city: ZUERICH.key,
  cityName: ZUERICH.name,
  source: `${ZUERICH.attribution.source}, WFS 1.1.0 (QGIS Server)`,
  licence: ZUERICH.attribution.licence,
  licenceUrl: ZUERICH.attribution.licenceUrl,
  attributionRequired: ZUERICH.attribution.attributionRequired,
  datasetUrl: ZUERICH.attribution.datasetUrl,
  // Wann die Quelle zuletzt erfolgreich abgerufen wurde — siehe abruf-zeit.ts.
  geprueftAm: geprueftAm(RAW),
  zones: zoneFeatures.length,
  districts: districtFeatures.length,
  poi: 0,
  lowEmissionZone: false,
  segments: 0,
  managedSpaces: totalSpaces,
  crs: 'EPSG:4326 (lon/lat), vom Dienst aus EPSG:2056 umgerechnet (SRSNAME=EPSG:4326)',
  /**
   * `fee` steht hier NICHT: Ein Betrag wird ausgeliefert — der des Erlasses,
   * in Franken; `rawFee` je Zone nennt die Fundstelle. `umweltzone` heisst
   * „gibt es nicht", `poi` „nicht abgerufen", `segments` „hat der Feed nicht".
   */
  absent: ['poi', 'umweltzone', 'segments'],
})

// Die Zahlen gehören ins Log, nicht in einen Kommentar: Sie sind das, was
// beim nächsten Abzug anders sein kann, und ein Sprung darin ist das erste,
// was auffällt.
console.log(
  `\n${zoneFeatures.length} Flächen übernommen (${zones.map((zone) => zone.area.key).join(', ')})` +
    `; ohne Fläche im Feed: ${areasWithoutPolygon.map((area) => `${area.name} (${area.article})`).join(', ') || 'keines'}`
)
console.log(
  `${metersInZones} von ${metersTotal} Parkuhren in einer Fläche — ${metersAgreeing} einig mit ihr, ` +
    `${metersDeviating} abweichend; ${metersOutside} ausserhalb, ${metersSpecial} mit Sonderbezeichnung`
)
console.log('Parkuhren ausserhalb der Flächen, nach Tarif:')
for (const [label, count] of [...outsideByTariff.entries()].sort((a, b) => b[1] - a[1])) {
  console.log(`  ${count} × ${label}`)
}
console.log(
  `${totalSpaces.toLocaleString('de-CH')} gebührenpflichtige Parkfelder in den Flächen` +
    ` (stadtweit ${spacesChargeable.toLocaleString('de-CH')} von ${spacesTotal.toLocaleString('de-CH')})`
)
console.log(`${districtFeatures.length} Quartiere`)
