/**
 * Baut Rostocks Daten — das achte Gegenstück zu `build-data.ts`.
 *
 * Ein Skript je Stadt, aus demselben Grund wie bei den sieben davor: Die
 * Feeds teilen sich außer dem Wort „Parken" nichts.
 *
 * Was Rostock **anders** macht, und was dieses Skript deshalb tun muss:
 *
 * - **Die Sachdaten hängen nicht an einer Fläche.** Wie in Frankfurt stehen
 *   Tarif, Zeiten und Höchstparkdauer an den 111 Parkscheinautomaten. Die
 *   Tarifzonen A–D und W der Parkgebührenordnung gibt es nur als PDF-Karte;
 *   die einzigen Flächen im Feed sind die **zehn Bewohnerparkgebiete**. Was
 *   für ein Gebiet gilt, entsteht hier durch Zusammenlegen der Automaten
 *   darin — Punkt-in-Polygon, nicht über das Attribut `bewohnerparkgebiet`
 *   (Begründung mit Zahlen unten bei der Schleife).
 * - **Die Gebiete decken nur die Hälfte ab.** 52 der 111 Automaten stehen in
 *   einem Gebiet, 59 nicht — darunter alle vier der Zone D, die Busplätze und
 *   die Kunsthalle. Für diese 59 gibt es keine Fläche, und eine erfundene
 *   (Kreis um den Automaten) wäre eine Behauptung über Straßen, die niemand
 *   geprüft hat. Sie fehlen deshalb, mit Zählung im Log und im Bericht;
 *   die Alternative steht in `docs/staedte-rostock.md` unter „Was offen
 *   bleibt".
 * - **Die Achsen kommen als `[lat, lon]`**, wie in Hamburg. `sources.ts`
 *   sagt es, `toGeoJsonAxes` dreht, `assertDegrees` prüft danach die Grade.
 * - **Leere Felder fehlen, statt `null` zu tragen.** Der WFS lässt ein
 *   Feld weg, wenn es leer ist; `bewohnerparkgebiet` ist bei 63 Automaten ein
 *   Leerstring. Jeder Zugriff hier rechnet mit beidem.
 *
 * Was Rostock **nicht** hat und Berlin schon: keine POI (Behindertenparkplätze
 * liegen in einem eigenen Datensatz mit eigenen Feldern, nicht abgerufen),
 * keine Umweltzone (Rostock hat keine), keine Straßenabschnitte.
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

import {
  ROSTOCK,
  mergeRostockFees,
  mergeRostockWindows,
  multiPolygonContains,
  parseRostockAreaName,
  parseRostockFee,
  parseRostockMaxStay,
  parseRostockSchedule,
  rostockMaxStayCode,
  type ChargeWindow,
  type Fee,
  type PolygonRings,
  type Position,
  type RostockAutomatProperties,
  type RostockZoneProperties,
} from '@knoellchenfrei/core'

import { citySources, toGeoJsonAxes, type AxisOrder } from './sources.js'
import { simplifyGeometry } from './simplify.js'
import { geprueftAm } from './abruf-zeit.js'

const RAW = join(process.env.RAW_DIR ?? join(process.cwd(), '../../.raw'), ROSTOCK.key)
const OUT = join(
  process.env.OUT_DIR ?? join(process.cwd(), '../../apps/web/public/data'),
  ROSTOCK.key
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

const SOURCES = citySources(ROSTOCK.key)

function axisOrderOf(key: string): AxisOrder {
  const source = SOURCES.find((candidate) => candidate.key === key)
  if (source === undefined) throw new Error(`Keine Quelle "${key}" für Rostock`)
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
 * Bricht ab, wenn keine Grade angekommen sind.
 *
 * Rostocks `DefaultCRS` ist EPSG:25833. Gemessen am 16. September 2026
 * antwortet der Dienst im GeoJSON zwar auch ohne `srsName` in Grad — nur in
 * der anderen Reihenfolge —, aber eine Konfiguration, deren Fehlen man nicht
 * bemerkt, gehört geprüft und nicht geglaubt: Mit UTM-Metern läge die Karte
 * leer da, ohne einen einzigen Fehler.
 */
function assertDegrees(key: string, geometry: Geometry): void {
  const walk = (node: unknown): void => {
    if (!Array.isArray(node)) return
    if (typeof node[0] === 'number' && typeof node[1] === 'number') {
      const [lon, lat] = node as number[]
      if (Math.abs(lon as number) > 180 || Math.abs(lat as number) > 90) {
        throw new Error(
          `${key}: ${lon}/${lat} sind keine Grade — der Dienst hat vermutlich in ` +
            'EPSG:25833 (UTM) geantwortet. srsName fehlt in der Anfrage.'
        )
      }
      return
    }
    node.forEach(walk)
  }
  walk(geometry.coordinates)
}

/**
 * Bricht ab, wenn ein Punkt außerhalb Rostocks liegt.
 *
 * Die Achsenreihenfolge steht in der Konfiguration; dieser Test misst, ob sie
 * stimmt. Ungedreht läge Warnemünde bei 12° Nord, 54° Ost — vor Somalia, und
 * `assertDegrees` sähe dabei gültige Grade. Der Rahmen ist `reportBounds`,
 * also der Umriss der Ortsteile.
 */
function assertInRostock(key: string, point: Position): void {
  const [lon, lat] = point
  const b = ROSTOCK.reportBounds
  if (lon < b.minLon || lon > b.maxLon || lat < b.minLat || lat > b.maxLat) {
    throw new Error(
      `${key}: ${lon}/${lat} liegt nicht in Rostock — Achsenreihenfolge in sources.ts prüfen`
    )
  }
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

/** Mittelpunkt aller Stützpunkte — reicht, um einen Ortsteil zu treffen. */
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

console.log('Rostock — Daten bauen …')

// ------------------------------------------------------------- Ortsteile
//
// Zuerst, weil die Gebiete sie brauchen: „A3 – Östliche Altstadt" trägt den
// Namen zwar schon selbst, der Ortsteil (Stadtmitte, Kröpeliner-Tor-Vorstadt,
// Seebad Warnemünde) ist aber die Ebene, in der die Suche und die Kopfzeile
// des Panels denken.

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
  const raw = feature.properties['gemeindeteil_name']
  const name = typeof raw === 'string' ? raw.trim() : ''
  if (name === '') throw new Error('districts: ein Ortsteil ohne gemeindeteil_name')

  // Die Zuordnung läuft gegen die UNvereinfachte Geometrie. Vereinfachte
  // Grenzen wandern um bis zu ein paar Dutzend Meter, und ein Gebiet direkt an
  // der Ortsteilgrenze bekäme sonst den Nachbarn zugeschrieben.
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
  properties: RostockAutomatProperties
  point: Position
}

const placedAutomats: Automat[] = []
for (const feature of readFeatures<RostockAutomatProperties>('automats')) {
  const geometry = toGeoJson(feature.geometry, automatAxis)
  if (geometry === null) continue
  assertDegrees('automats', geometry)
  const coordinates = geometry.coordinates
  if (!Array.isArray(coordinates)) continue
  const [lon, lat] = coordinates as number[]
  if (typeof lon !== 'number' || typeof lat !== 'number') continue
  assertInRostock('automats', [lon, lat])
  placedAutomats.push({ properties: feature.properties, point: [lon, lat] })
}

/**
 * Jeder Wert des Abzugs muss sich lesen lassen — **bevor** etwas gebaut
 * wird. Ein Automat mit einer neuen Schreibweise bricht hier ab, mit seiner
 * Nummer und dem Rohwert; er soll nicht stillschweigend aus einem Gebiet
 * fallen und dessen Zeiten verschieben.
 */
for (const automat of placedAutomats) {
  const p = automat.properties
  try {
    parseRostockSchedule(p.bewirtschaftungszeiten ?? '')
    parseRostockFee(p.normaltarif_gebuehren_pro_stunde)
    parseRostockMaxStay(p.normaltarif_parkdauer_max, p.normaltarif_parkdauer_max_einheit)
  } catch (error) {
    throw new Error(`Automat ${String(p.nummer)}: ${(error as Error).message}`, { cause: error })
  }
}

// ---------------------------------------------------------------- Gebiete

const zoneAxis = axisOrderOf('zones')

interface Zone {
  code: string
  name: string
  properties: RostockZoneProperties
  geometry: Geometry
  polygons: PolygonRings[]
  automats: RostockAutomatProperties[]
}

const zones: Zone[] = []
for (const feature of readFeatures<RostockZoneProperties>('zones')) {
  const geometry = toGeoJson(feature.geometry, zoneAxis)
  if (geometry === null) continue
  assertDegrees('zones', geometry)
  const { code, name } = parseRostockAreaName(feature.properties.bezeichnung ?? '')
  zones.push({ code, name, properties: feature.properties, geometry, polygons: toPolygons(geometry), automats: [] })
}

// Zehn Gebiete, zehn Kürzel — ein doppeltes wäre in der Nutzungsstatistik eine
// Zone und auf der Karte zwei.
const codes = new Set(zones.map((zone) => zone.code))
if (codes.size !== zones.length) throw new Error('zones: ein Gebietskürzel kommt doppelt vor')

/**
 * Welcher Automat zu welchem Gebiet gehört — **über die Geometrie**.
 *
 * Der Feed bietet beides an: `bewohnerparkgebiet` am Automaten zeigt auf das
 * Kürzel eines Gebiets. Am Abzug vom 16. September 2026 ausgezählt, warum
 * trotzdem der Punkt entscheidet:
 *
 * | | über `bewohnerparkgebiet` | über Punkt-in-Polygon |
 * | --- | --- | --- |
 * | zugeordnete Automaten | 48 von 111 | **52** von 111 |
 * | Attribut und Punkt einig | 42 | — |
 * | Attribut zeigt auf ein Gebiet, in dem der Automat nicht steht | 6 | — |
 *
 * Automat 142 trägt `A1` und steht in A3; fünf weitere tragen ein Kürzel und
 * stehen in gar keinem Gebiet. Das Attribut sagt, zu welchem **Ausweis** ein
 * Automat gehört, nicht, wo er steht — und die Frage dieser App ist „was gilt
 * hier". Kein Punkt fällt in zwei Gebiete; der erste Treffer genügt.
 */
let attributeAgrees = 0
let attributeDisagrees = 0
let attributeOutside = 0
let automatsWithoutZone = 0

for (const automat of placedAutomats) {
  const hits = zones.filter((candidate) => multiPolygonContains(candidate.polygons, automat.point))
  if (hits.length > 1) {
    throw new Error(`Automat ${String(automat.properties.nummer)} liegt in ${hits.length} Gebieten`)
  }
  const zone = hits[0]
  const claimed = (automat.properties.bewohnerparkgebiet ?? '').trim()
  if (zone === undefined) {
    automatsWithoutZone += 1
    if (claimed !== '') attributeOutside += 1
    continue
  }
  zone.automats.push(automat.properties)
  if (claimed !== '') {
    if (claimed === zone.code) attributeAgrees += 1
    else attributeDisagrees += 1
  }
}

const distinct = (values: (string | null | undefined)[]): string[] => [
  ...new Set(values.map((value) => (value ?? '').trim()).filter((value) => value !== '')),
]

/** `1.5` → `1,50 €`, für den Rohtext im Panel — der Feed hat keinen Text, nur die Zahl. */
function euro(value: number | null | undefined): string | null {
  if (value === null || value === undefined) return null
  return `${value.toFixed(2).replace('.', ',')} €`
}

const zoneFeatures: { type: 'Feature'; properties: ZoneOut; geometry: Geometry }[] = []
let skippedWithoutAutomats = 0
let withoutDistrict = 0

for (const zone of zones) {
  // Ein Gebiet ohne einen einzigen Automaten wird ausgelassen — dasselbe
  // Kriterium wie in Frankfurt: Ohne Zeiten kann die App die eine Frage
  // nicht beantworten, für die es sie gibt. Im Abzug vom 16. September hat
  // jedes der zehn Gebiete mindestens zwei.
  if (zone.automats.length === 0) {
    skippedWithoutAutomats += 1
    continue
  }

  const simplified = simplifyGeometry(zone.geometry, 1e-5, 5)
  if (simplified === null) continue

  const district = districtAt(centroid(zone.geometry))
  if (district === null) withoutDistrict += 1

  const rawHours = distinct(zone.automats.map((automat) => automat.bewirtschaftungszeiten))
  const rawFees = distinct(zone.automats.map((automat) => euro(automat.normaltarif_gebuehren_pro_stunde)))
  const tarife = distinct(zone.automats.map((automat) => automat.tarif))

  /**
   * Die Höchstparkdauer wird **nie** als Regel des Gebiets ausgegeben.
   *
   * Sie steht je Automat, und in den Gebieten stehen verschiedene Werte
   * nebeneinander — in A2 „2 h" neben „30 min", in W1 „2 h" neben „6 h".
   * Sie als `maxStayMinutes` auszuliefern hiesse zu behaupten, die Quelle
   * nenne sie für das ganze Gebiet. Frankfurts Weg: Wert, Anteil und alle
   * Ausprägungen.
   */
  const stayCounts = new Map<string, number>()
  for (const automat of zone.automats) {
    const minutes = parseRostockMaxStay(
      automat.normaltarif_parkdauer_max,
      automat.normaltarif_parkdauer_max_einheit
    )
    if (minutes === undefined) continue
    const code = rostockMaxStayCode(minutes)
    stayCounts.set(code, (stayCounts.get(code) ?? 0) + 1)
  }
  const stayEntries = [...stayCounts.entries()].sort((a, b) => b[1] - a[1])
  const limited = stayEntries.reduce((sum, [, count]) => sum + count, 0)

  /**
   * Der Veranstaltungstarif ist eine Regel, die `ChargeWindow` nicht
   * ausdrücken kann. Wann er gilt, sagt der Feed **nicht** — das Feld
   * `veranstaltungstarif_bewirtschaftungszeiten` des Downloads ist bei allen
   * 111 Automaten leer. § 5 der Parkgebührenordnung (Fassung 2022) kennt
   * genau eine Veranstaltungsregel: „für die Dauer der Großveranstaltungen
   * ‚Hanse Sail' und ‚Weihnachtsmarkt'" zahlt Zone B die Sätze der Zone A —
   * und dazu passt der Wert 2,00 € an den B-Automaten. Nicht dazu passt der
   * Wert 1,00 € an den Warnemünder W-Automaten: Das ist der Satz der
   * **Nebensaison** (1. November bis 31. März) aus § 4 Abs. 3, und der ist
   * keine Veranstaltung. Was das Feld also wirklich meint, weiss nur die
   * Stadt (`docs/staedte-rostock.md`, „Was offen bleibt"). Deshalb steht der
   * Betrag wörtlich im Panel, ohne eine Bedeutung dazuzudichten — und nur,
   * wo er vom Normaltarif abweicht, denn ein gleicher Betrag ist keine Regel.
   */
  const eventFees = distinct(
    zone.automats
      .filter(
        (automat) =>
          automat.veranstaltungstarif_gebuehren_pro_stunde !== undefined &&
          automat.veranstaltungstarif_gebuehren_pro_stunde !== null &&
          automat.veranstaltungstarif_gebuehren_pro_stunde !== automat.normaltarif_gebuehren_pro_stunde
      )
      .map((automat) => euro(automat.veranstaltungstarif_gebuehren_pro_stunde))
  )
  const unmodelledRules =
    eventFees.length === 0
      ? []
      : [
          `Veranstaltungstarif laut Quelle: ${eventFees.join(' / ')} je Stunde — wann er gilt, ` +
            'sagt die Quelle nicht (§ 5 Parkgebührenordnung nennt Hanse Sail und Weihnachtsmarkt)',
        ]

  zoneFeatures.push({
    type: 'Feature',
    properties: {
      zone: zone.code,
      district: district?.name ?? ROSTOCK.name,
      rawHours: rawHours.join('; '),
      rawFee: rawFees.join('; '),
      // Der Gebietsname und die Tarifstufen der Automaten darin: „Östliche
      // Altstadt — Tarif B1, B3, A2" sagt dem Leser, dass hier zwei Zonen der
      // Gebührenordnung aneinanderstoßen, und warum der Betrag eine Spanne ist.
      note: `Bewohnerparkgebiet ${zone.name} — Tarif ${tarife.join(', ')}`,
      windows: mergeRostockWindows(
        zone.automats.flatMap((automat) => parseRostockSchedule(automat.bewirtschaftungszeiten ?? ''))
      ),
      fee: mergeRostockFees(
        zone.automats.map((automat) => parseRostockFee(automat.normaltarif_gebuehren_pro_stunde))
      ),
      unmodelledRules,
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

// ------------------------------------------------------- was es nicht gibt

// Leere Sammlungen statt fehlender Dateien: `loadData` holt für jede Stadt
// dieselben fünf Namen, und ein 404 wäre von einem echten Ladefehler nicht zu
// unterscheiden. `meta.json` sagt, dass die Leere Absicht ist.
write('poi.geojson', { type: 'FeatureCollection', features: [] })
write('umweltzone.geojson', { type: 'FeatureCollection', features: [] })

write('meta.json', {
  city: ROSTOCK.key,
  cityName: ROSTOCK.name,
  source: `${ROSTOCK.attribution.source}, WFS 2.0.0`,
  licence: ROSTOCK.attribution.licence,
  licenceUrl: ROSTOCK.attribution.licenceUrl,
  attributionRequired: ROSTOCK.attribution.attributionRequired,
  datasetUrl: ROSTOCK.attribution.datasetUrl,
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
   * Was dieser Abzug nicht enthält. `umweltzone` heißt hier „gibt es nicht":
   * Rostock hat keine Umweltzone. `poi` heißt „nicht abgerufen" — die
   * Behindertenparkplätze liegen in einem eigenen Datensatz.
   */
  absent: ['poi', 'umweltzone', 'segments'],
})

// Die Zahlen gehören ins Log, nicht in einen Kommentar: Sie sind das, was beim
// nächsten Abzug anders sein kann, und ein Sprung darin ist das erste, was
// auffällt.
console.log(
  `\n${zoneFeatures.length} von ${zones.length} Gebieten übernommen` +
    ` — ${skippedWithoutAutomats} ohne Parkscheinautomaten ausgelassen` +
    `, ${withoutDistrict} ohne Ortsteil-Treffer`
)
console.log(
  `${placedAutomats.length - automatsWithoutZone} von ${placedAutomats.length} Automaten` +
    ` einem Gebiet zugeordnet, ${automatsWithoutZone} liegen in keinem`
)
console.log(
  `Attribut bewohnerparkgebiet: ${attributeAgrees} mal einig mit der Geometrie,` +
    ` ${attributeDisagrees} mal uneins, ${attributeOutside} mal auf ein Gebiet zeigend,` +
    ' in dem der Automat nicht steht'
)
console.log(`${districtFeatures.length} Ortsteile`)
