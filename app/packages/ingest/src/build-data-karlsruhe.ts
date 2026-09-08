/**
 * Baut Karlsruhes Daten — das fünfte Gegenstück zu `build-data.ts`.
 *
 * Fünf Skripte statt eines mit fünf Zweigen, aus demselben Grund wie bei den
 * drei Städten davor: Die Feeds teilen sich außer dem Wort „Parken" nichts.
 *
 * Was Karlsruhe **anders** macht als alle vier anderen Städte, und was dieses
 * Skript deshalb tun muss:
 *
 * - **Der Dienst ist nicht die Stadt.** `mobil.trk.de` gehört der
 *   TechnologieRegion Karlsruhe und führt elf Gemeinden, darunter **Haguenau
 *   und Saverne im Elsass**. Von 638 Parkscheinautomaten stehen 281 in
 *   Karlsruhe. Gefiltert wird über `isKarlsruheMachine`, und zwar **bevor**
 *   ein Parser eine Zeile anfasst: 334 der übrigen 360 Zeilen brächen ihn ab,
 *   und die 26, die durchgehen, gehören trotzdem einer anderen Stadt.
 * - **Die Zonen sind keine Gebiete, sondern Stellplatzreihen.**
 *   `TBA:parkscheinautomaten_flaechen` sind die kostenpflichtigen Parkplätze
 *   selbst — 282 Polygone mit einem Median von 128 m², zusammen 4,8 ha für die
 *   3.367 Plätze, die die Automaten ausweisen. Sie tragen **kein einziges
 *   Sachdatum**: `{id, gemeinde, stand}`, sonst nichts.
 * - **Die Zuordnung läuft über den Abstand, nicht über Punkt-in-Polygon.** Ein
 *   Automat steht am Bordstein neben der Reihe, nicht in ihr. Die 20 Meter
 *   sind gemessen; die Tabelle dazu steht bei `KARLSRUHE_JOIN_RADIUS_M` in
 *   `packages/core/src/karlsruhe.ts`.
 * - **Ohne `srsName` antwortet der Dienst in UTM.** `DefaultCRS` ist
 *   EPSG:25832, und die Antwort lautet dann `[460417.47, 5427328.97]` —
 *   plausible Zahlen, nur keine Grade. Dieselbe Falle wie in Frankfurt und
 *   München, deshalb steht `assertDegrees` auch hier.
 *
 * Was Karlsruhe **nicht** hat und Berlin schon:
 *
 * - **Keine Verwaltungsgrenzen.** Der Dienst führt 41 Typnamen und keinen
 *   davon mit Stadtteil- oder Gemarkungsgeometrie; das Transparenzportal
 *   führt sie ebenfalls nicht. `districts.geojson` bleibt leer, und der
 *   Stadtteil kommt aus dem **Automaten** — er steht dort als Feld.
 * - **Keine Umweltzone.** `TBA:umweltzonen` gibt es, aber TRK-weit und ohne
 *   `gemeinde`; sie ist ungeprüft und bleibt deshalb draußen.
 * - **Keine Ladepunkte und kein Carsharing.** `TBA:carsharing_stationen`
 *   führt keine `gemeinde` und reicht bis Kaiserslautern; ohne Filter wäre die
 *   Ebene für eine Karlsruher Karte unbrauchbar.
 *
 * ACHTUNG, offene Abhängigkeit: Dieses Skript braucht `KARLSRUHE` in
 * `core/city.ts`, den Re-Export von `karlsruhe.js` in `core/index.ts` und den
 * Eintrag `karlsruhe` in `sources.ts`. Alle drei Schnipsel stehen fertig in
 * `docs/staedte-karlsruhe.md`; bis sie eingetragen sind, meldet
 * `pnpm --filter @knoellchenfrei/ingest typecheck` genau diese fehlenden
 * Exporte.
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

import {
  KARLSRUHE,
  isKarlsruheMachine,
  isKarlsruheMachineNearArea,
  karlsruheAreaLabel,
  karlsruheMaxStayCode,
  mergeKarlsruheFees,
  mergeKarlsruheWindows,
  parseKarlsruheFee,
  parseKarlsruheMaxStay,
  parseKarlsruheSchedule,
  type ChargeWindow,
  type Fee,
  type KarlsruheAreaProperties,
  type KarlsruheMachineProperties,
  type PolygonRings,
  type Position,
} from '@knoellchenfrei/core'

import { citySources, toGeoJsonAxes, type AxisOrder } from './sources.js'
import { roundPoint, simplifyGeometry } from './simplify.js'

const RAW = join(process.env.RAW_DIR ?? join(process.cwd(), '../../.raw'), KARLSRUHE.key)
const OUT = join(
  process.env.OUT_DIR ?? join(process.cwd(), '../../apps/web/public/data'),
  KARLSRUHE.key
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

const SOURCES = citySources(KARLSRUHE.key)

function axisOrderOf(key: string): AxisOrder {
  const source = SOURCES.find((candidate) => candidate.key === key)
  if (source === undefined) throw new Error(`Keine Quelle "${key}" für Karlsruhe`)
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
 * Nachgemessen am 8. September 2026: Ohne `srsName` antwortet
 * `mobil.trk.de/geoserver/TBA/ows` mit `[460417.47, 5427328.97]` in
 * EPSG:25832. Das ist kein Fehler, keine Warnung und kein leeres Ergebnis —
 * auf der Karte sähe es nur nach „leer" aus. Dieselbe Prüfung wie in
 * Frankfurt und München; eine Konfiguration, deren Fehlen man nicht bemerkt,
 * gehört geprüft und nicht geglaubt.
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

/** Alle Außen- und Innenringe eines (Multi-)Polygons, als Liste von Polygonen. */
function toPolygons(geometry: Geometry): PolygonRings[] {
  if (geometry.type === 'Polygon') return [geometry.coordinates as PolygonRings]
  if (geometry.type === 'MultiPolygon') return geometry.coordinates as PolygonRings[]
  return []
}

/** Dasselbe Feld-Schema wie in allen vier anderen Städten — ein Typ, ein Panel. */
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

console.log('Karlsruhe — Daten bauen …')

// --------------------------------------------------------------- Automaten

const machineAxis = axisOrderOf('machines')

interface Machine {
  properties: KarlsruheMachineProperties
  point: Position
}

const allMachines = readFeatures<KarlsruheMachineProperties>('machines')
const machines: Machine[] = []
let droppedForeign = 0

for (const feature of allMachines) {
  // Der Filter steht **vor** der Geometrie und vor jedem Parser. Eine
  // französische Zeile aus Haguenau bräche `parseKarlsruheSchedule` ab, und
  // eine deutsche aus Rastatt liefe stillschweigend durch — mit dem
  // Preisniveau einer anderen Stadt.
  if (!isKarlsruheMachine(feature.properties)) {
    droppedForeign += 1
    continue
  }
  const geometry = toGeoJson(feature.geometry, machineAxis)
  if (geometry === null) continue
  assertDegrees('machines', geometry)
  const coordinates = geometry.coordinates
  if (!Array.isArray(coordinates)) continue
  const [lon, lat] = coordinates as number[]
  if (typeof lon !== 'number' || typeof lat !== 'number') continue
  machines.push({ properties: feature.properties, point: [lon, lat] })
}

// -------------------------------------------------------- Stellplatzflächen

const areaAxis = axisOrderOf('zones')

interface Area {
  properties: KarlsruheAreaProperties
  geometry: Geometry
  polygons: PolygonRings[]
  machines: KarlsruheMachineProperties[]
}

const areas: Area[] = []
for (const feature of readFeatures<KarlsruheAreaProperties>('zones')) {
  // Die Flächen sind heute ausnahmslos Karlsruher — anders als die Automaten.
  // Der Filter steht trotzdem da: Was heute für alle 282 gilt, ist eine
  // Beobachtung und keine Zusage des Dienstes.
  if (feature.properties.gemeinde !== KARLSRUHE.name) continue
  const geometry = toGeoJson(feature.geometry, areaAxis)
  if (geometry === null) continue
  assertDegrees('zones', geometry)
  areas.push({
    properties: feature.properties,
    geometry,
    polygons: toPolygons(geometry),
    machines: [],
  })
}

/**
 * Welcher Automat zu welcher Fläche gehört — **über den Abstand**.
 *
 * Frankfurt entscheidet das mit Punkt-in-Polygon, weil seine Polygone
 * Bewohnerparkbereiche sind und die Automaten darin stehen. Karlsruhes
 * Polygone sind die Stellplatzreihen selbst; ein Automat steht am Bordstein
 * daneben und liegt fast nie *in* der Fläche. Punkt-in-Polygon fände hier
 * nahezu nichts, und die Ausgabe wäre leer, ohne dass irgendetwas nach einem
 * Fehler aussähe.
 *
 * Am Abzug vom 8. September 2026 gegen die Kanten gemessen: Bei 20 m hat
 * **jeder** der 278 städtischen Automaten eine Fläche, drei der 282 Flächen
 * haben keinen Automaten (Bahnhofplatz und Stadtgarten; ihr nächster steht 81
 * bis 101 m entfernt), und **keine** Fläche bekommt widersprüchliche Tarife
 * oder Zeiten. Die vollständige Tabelle steht bei `KARLSRUHE_JOIN_RADIUS_M`.
 *
 * Ein Automat kann zu mehreren Flächen gehören, und das ist richtig: Eine
 * Stellplatzreihe wird links und rechts der Kreuzung getrennt geführt, und
 * derselbe Automat bedient beide.
 */
let areasWithoutMachine = 0
for (const area of areas) {
  for (const machine of machines) {
    if (isKarlsruheMachineNearArea(area.polygons, machine.point)) {
      area.machines.push(machine.properties)
    }
  }
}

const zoneFeatures: { type: 'Feature'; properties: ZoneOut; geometry: Geometry }[] = []
let withoutDistrict = 0

for (const area of areas) {
  /**
   * Eine Fläche ohne einen einzigen Automaten wird ausgelassen.
   *
   * Dasselbe Kriterium wie in Hamburg („ohne Zeitangabe") und Frankfurt („ohne
   * Automaten"): Ohne Zeiten kann die App die eine Frage nicht beantworten,
   * für die es sie gibt. Ein Polygon ohne Antwort ist schlechter als kein
   * Polygon — es sähe aus wie eine bewirtschaftete Fläche und wüsste über sie
   * nichts.
   */
  if (area.machines.length === 0) {
    areasWithoutMachine += 1
    continue
  }

  // 1e-6 statt Frankfurts 1e-5: Eine Stellplatzreihe ist wenige Meter breit,
  // und 1e-5 Grad sind rund einen Meter. Wer sie so grob vereinfacht, zieht
  // sie stellenweise zu einer Linie zusammen.
  const simplified = simplifyGeometry(area.geometry, 1e-6, 5)
  if (simplified === null) continue

  const distinct = (values: (string | null | undefined)[]): string[] => [
    ...new Set(values.map((value) => (value ?? '').trim()).filter((value) => value !== '')),
  ]

  const rawHours = distinct(area.machines.map((machine) => machine.parkzeit))
  const rawFees = distinct(area.machines.map((machine) => machine.gebuehren))

  // Der Stadtteil kommt aus dem Automaten, weil der Dienst keine
  // Verwaltungsgrenzen führt. Bei mehreren Automaten gewinnt der erste — sie
  // liegen alle innerhalb von 20 m, also im selben Stadtteil.
  const districts = distinct(area.machines.map((machine) => machine.stadtteil))
  if (districts.length === 0) withoutDistrict += 1

  const parsed = area.machines.map((machine) =>
    parseKarlsruheSchedule(machine.parkzeit ?? '')
  )

  /**
   * Die Höchstparkdauer wird **nie** als Regel der Fläche ausgegeben.
   *
   * Dieselbe Begründung wie in Frankfurt: Sie steht je Automat, und wo
   * mehrere an einer Fläche stehen, können sie verschiedene Werte tragen. Sie
   * trotzdem als `maxStayMinutes` auszuliefern hieße zu behaupten, die Quelle
   * nenne sie für die ganze Fläche; das Panel sagt bei diesem Feld genau das.
   */
  const stayCounts = new Map<string, number>()
  for (const machine of area.machines) {
    const minutes = parseKarlsruheMaxStay(machine.max_parkdauer)
    if (minutes === undefined) continue
    const code = karlsruheMaxStayCode(minutes)
    stayCounts.set(code, (stayCounts.get(code) ?? 0) + 1)
  }
  const stayEntries = [...stayCounts.entries()].sort((a, b) => b[1] - a[1])
  const limited = stayEntries.reduce((sum, [, count]) => sum + count, 0)

  /**
   * Die Stellplatzzahl der Automaten steht **nicht** an der Fläche.
   *
   * `stellplaetze` zählt, was ein Automat bedient — und ein Automat bedient
   * oft mehrere Flächen. Die Zahlen zu addieren hieße, dieselben Plätze
   * mehrfach zu zählen; die eines einzelnen Automaten zu übernehmen hieße,
   * einer 30-Meter-Reihe die 250 Plätze eines ganzen Parkplatzes
   * zuzuschreiben. Beides wäre erfunden, also bleibt das Feld leer.
   */
  zoneFeatures.push({
    type: 'Feature',
    properties: {
      zone: karlsruheAreaLabel(area.properties),
      district: districts[0] ?? KARLSRUHE.name,
      // Mit Mittelpunkt verbunden, nicht mit Semikolon wie in Frankfurt: Das
      // Semikolon ist in Karlsruhe der Trenner **innerhalb** eines Wertes.
      // `werktags 8 bis 20 Uhr; werktags 8 bis 20 Uhr; Tagespauschale` — so
      // sah eine Fläche mit zwei Automaten im Probelauf aus, und daran ist
      // nicht mehr zu erkennen, wo der eine aufhört. Betroffen war genau eine
      // der 279 Flächen; bei den Preistreppen wäre es jede mit zwei Tarifen.
      rawHours: rawHours.join(' · '),
      rawFee: rawFees.join(' · '),
      // Der Standort des Automaten ist das Einzige, was die Quelle über diese
      // Fläche in Worten sagt — und für den Leser die halbe Antwort auf „welche
      // Fläche ist das eigentlich".
      note: distinct(area.machines.map((machine) => machine.standort)).join(' · ') || null,
      windows: mergeKarlsruheWindows(parsed.flatMap((schedule) => schedule.windows)),
      fee: mergeKarlsruheFees(
        area.machines.map((machine) => parseKarlsruheFee(machine.gebuehren))
      ),
      unmodelledRules: [...new Set(parsed.flatMap((schedule) => schedule.unmodelledRules))],
      sourceDefect: null,
      spaces: null,
      maxStayMinutes: null,
      maxStay: stayEntries[0]?.[0] ?? null,
      maxStayShare: Math.round((limited / area.machines.length) * 1000) / 1000,
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
 * Behindertenparkplätze und Park-and-Ride, im selben POI-Schema wie Berlins.
 *
 * Beide Ebenen führen `gemeinde` und werden darauf gefiltert — ohne das reichte
 * Park-and-Ride bis Bad Herrenalb. `TBA:carsharing_stationen` fehlt hier
 * genau deshalb: Es führt **keine** `gemeinde` und enthält Stationen bis
 * Kaiserslautern; ein Filter über die Karlsruher Box wäre geraten, und die
 * Ebene ist den Rat nicht wert.
 */
const poi: { type: 'Feature'; properties: Record<string, unknown>; geometry: Geometry }[] = []

interface PoiSource {
  key: string
  kind: string
  fallbackLabel: string
}

const POI_SOURCES: readonly PoiSource[] = [
  { key: 'accessible', kind: 'accessible', fallbackLabel: 'Behindertenparkplatz' },
  { key: 'parkAndRide', kind: 'park_and_ride', fallbackLabel: 'Park and Ride' },
]

interface PoiProperties {
  gemeinde?: string | null
  standort?: string | null
  haltestelle?: string | null
  stellplaetze?: number | null
  bemerkung?: string | null
}

for (const source of POI_SOURCES) {
  const axis = axisOrderOf(source.key)
  for (const feature of readFeatures<PoiProperties>(source.key)) {
    if (feature.properties.gemeinde !== KARLSRUHE.name) continue
    const geometry = toGeoJson(feature.geometry, axis)
    if (geometry === null) continue
    assertDegrees(source.key, geometry)

    const count = feature.properties.stellplaetze
    const detail = [
      // Singular für einen: „1 Plätze" ist in Berlin schon einmal in die
      // Sprechblase gelaufen.
      typeof count === 'number' && count > 0 ? `${count} ${count === 1 ? 'Platz' : 'Plätze'}` : null,
      (feature.properties.bemerkung ?? '').trim() || null,
    ]
      .filter((part) => part !== null && part !== '')
      .join(' · ')

    poi.push({
      type: 'Feature',
      properties: {
        kind: source.kind,
        label:
          (feature.properties.standort ?? '').trim() ||
          (feature.properties.haltestelle ?? '').trim() ||
          source.fallbackLabel,
        detail: detail === '' ? null : detail,
      },
      geometry: {
        type: 'Point',
        coordinates: roundPoint((geometry.coordinates as [number, number]) ?? [0, 0]),
      },
    })
  }
}

write('poi.geojson', { type: 'FeatureCollection', features: poi })

// ------------------------------------------------------- was es nicht gibt

/**
 * Leere Sammlungen statt fehlender Dateien.
 *
 * `loadData` holt für jede Stadt dieselben fünf Namen, und ein 404 wäre von
 * einem echten Ladefehler nicht zu unterscheiden. `districts.geojson` ist hier
 * der schmerzhafte Eintrag: Der Dienst führt keine Verwaltungsgrenzen, und das
 * Transparenzportal führt sie auch nicht. Ohne Hintergrundkarte schweben die
 * 279 Stellplatzreihen damit im Nichts — der offene Punkt steht in
 * `docs/staedte-karlsruhe.md`.
 */
write('districts.geojson', { type: 'FeatureCollection', features: [] })
write('umweltzone.geojson', { type: 'FeatureCollection', features: [] })

write('meta.json', {
  city: KARLSRUHE.key,
  cityName: KARLSRUHE.name,
  source: `${KARLSRUHE.attribution.source}, WFS 2.0.0`,
  licence: KARLSRUHE.attribution.licence,
  licenceUrl: KARLSRUHE.attribution.licenceUrl,
  attributionRequired: KARLSRUHE.attribution.attributionRequired,
  datasetUrl: KARLSRUHE.attribution.datasetUrl,
  zones: zoneFeatures.length,
  districts: 0,
  poi: poi.length,
  lowEmissionZone: false,
  segments: 0,
  managedSpaces: 0,
  crs: 'EPSG:4326 (lon/lat)',
  /**
   * Was dieser Abzug nicht enthält.
   *
   * `umweltzone` heißt hier **nicht** „gibt es nicht": Karlsruhe hat seit 2009
   * eine, und `TBA:umweltzonen` führt sie sogar — nur TRK-weit und ohne
   * `gemeinde`, also ungeprüft. `districts` gibt es in keiner Karlsruher Quelle,
   * die dieses Projekt gefunden hat.
   */
  absent: ['districts', 'umweltzone', 'segments'],
})

// Die Zahlen gehören ins Log, nicht in einen Kommentar: Sie sind das, was beim
// nächsten Abzug anders sein kann, und ein Sprung darin ist das Erste, was
// auffällt.
console.log(
  `\n${zoneFeatures.length} von ${areas.length} Stellplatzflächen übernommen` +
    ` — ${areasWithoutMachine} ohne Automaten innerhalb von 20 m ausgelassen` +
    `, ${withoutDistrict} ohne Stadtteil-Angabe`
)
console.log(
  `${machines.length} städtische Automaten benutzt,` +
    ` ${droppedForeign} Zeilen anderer Gemeinden oder fremder Betreiber verworfen` +
    ` (von ${allMachines.length})`
)
console.log(`${poi.length} POI (Behindertenparkplätze und Park-and-Ride)`)
