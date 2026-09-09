/**
 * Baut Düsseldorfs Daten — das fünfte Gegenstück zu `build-data.ts`.
 *
 * Fünf Skripte statt eines mit fünf Zweigen, aus demselben Grund wie bei
 * Hamburg, Frankfurt und München: Die Feeds teilen sich außer dem Wort
 * „Parken" nichts.
 *
 * **Dieses Skript läuft noch nicht durch `pnpm --filter @knoellchenfrei/ingest
 * typecheck`.** Es holt aus `@knoellchenfrei/core` Namen, die dort erst
 * exportiert werden, wenn die drei Einträge aus
 * `docs/staedte-duesseldorf.md`, Abschnitt „Was einzutragen bleibt", gemacht
 * sind. Das ist erwartet und in dem Abschnitt aufgezählt.
 *
 * Was Düsseldorf **anders** macht als die vier angeschlossenen Städte:
 *
 * - **65 Merkmale sind 44 Gebiete.** Elf Gebiete liefert der Dienst in
 *   mehreren Stücken, jedes mit eigener `_uuid` und gleichen Sachdaten. Die
 *   Identität ist `kuerzel`; wer auf `_uuid` gruppiert, liefert 21
 *   Doppelgänger mit demselben Namen aus, und die Zonenliste der
 *   Statistikseite zählte sie einzeln.
 * - **Zwei Aussagen über dieselbe Zeit, in zwei Notationen.** Das Gebiet sagt
 *   `werktags, 9 bis 20 Uhr`, die Automaten darin sagen
 *   `Werktags 09:00 - 20:00`. Beide werden gelesen und ihre Fenster
 *   **vereinigt** — `windowCovers` fragt ohnehin nur, ob irgendeines passt,
 *   und die Vereinigung ist die Richtung, in der ein Fehler eine überflüssige
 *   Warnung kostet statt eines Knöllchens. In Unterbilk und Friedrichstadt
 *   erklärt genau das den Zusatz „teils 9 bis 22 Uhr": Dort stehen wirklich
 *   Automaten beider Tarifzeiten.
 * - **Zwei Gebiete überlappen sich.** Blücherstraße (S) und Derendorfer
 *   Straße (W) teilen sich rund 50.000 m² — die Stadt führt Eulerstraße und
 *   Prinz-Georg-Straße in beiden Straßenlisten. Beide sagen dieselbe Zeit, die
 *   Antwort der App hängt also nicht daran; das Skript zählt die Fälle
 *   trotzdem, damit ein Auseinanderlaufen auffällt.
 *
 * Was Düsseldorf **nicht** hat:
 *
 * - **Keine Stellplatzzahlen.** Weder das Gebiet noch der Automat zählt Plätze;
 *   `spaces` bleibt null. Eine geschätzte Zahl wäre schlechter als keine.
 * - **Keine Höchstparkdauer je Gebiet.** Sie steht je Automat, und in vier der
 *   29 Gebiete mit Automaten stehen beide Werte nebeneinander. Wie in
 *   Frankfurt: Wert, Anteil und alle Ausprägungen, aber kein
 *   `maxStayMinutes`.
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

import {
  DUESSELDORF,
  duesseldorfExtraRules,
  duesseldorfMaxStayCode,
  duesseldorfZoneLabel,
  mergeDuesseldorfFees,
  mergeDuesseldorfWindows,
  multiPolygonContains,
  parseDuesseldorfAutomatSchedule,
  parseDuesseldorfFee,
  parseDuesseldorfMaxStay,
  parseDuesseldorfSchedule,
  type ChargeWindow,
  type DuesseldorfAutomatProperties,
  type DuesseldorfZoneProperties,
  type Fee,
  type PolygonRings,
  type Position,
} from '@knoellchenfrei/core'

import { toGeoJsonAxes, type AxisOrder } from './sources.js'
import { roundPoint, simplifyGeometry } from './simplify.js'

const RAW = join(process.env.RAW_DIR ?? join(process.cwd(), '../../.raw'), DUESSELDORF.key)
const OUT = join(
  process.env.OUT_DIR ?? join(process.cwd(), '../../apps/web/public/data'),
  DUESSELDORF.key
)

/**
 * Die Achsenreihenfolge, gemessen am 8. September 2026 an beiden Diensten.
 *
 * Sie gehört nach `sources.ts`, sobald der Eintrag dort steht — hier steht sie
 * nur, damit dieses Skript vor dem Eintrag überhaupt laufen kann. Was gemessen
 * ist: Mit `srsName` kommt `[6.788, 51.219]`, also `[lon, lat]` wie in Berlin,
 * Frankfurt und München und anders als in Hamburg. Der Dienst schreibt an die
 * Antwort `urn:ogc:def:crs:EPSG::4326` — die URN-Form, die die Breite zuerst
 * vorschreibt. Er hält sich also nicht an seine eigene Beschriftung, und das
 * ist genau der Grund, warum die Reihenfolge gemessen und nicht aus dem
 * `crs`-Feld gelesen wird.
 *
 * **Ohne `srsName` antwortet er in EPSG:25832**, ehrlich beschriftet und
 * trotzdem tödlich: `[345550.30, 5676562.02]` sind plausible Zahlen und keine
 * Grade. `wfsUrl` setzt den Parameter; `assertDegrees` misst trotzdem nach.
 */
const AXIS_ORDER: AxisOrder = 'lon,lat'

/**
 * Ob die Lizenz der Parkscheinautomaten belegt ist.
 *
 * **Steht auf `false`, und das ist eine Aussage, keine Bequemlichkeit.** Die
 * Ebene `verkehr:parkscheinautomaten` liegt auf demselben öffentlichen WFS wie
 * die Bewohnerparkgebiete, führt Tarif, Tarifzeit und Höchstparkdauer — und
 * steht am 8. September 2026 **in keinem Datenkatalog**: nicht im Portal der
 * Stadt, nicht in `ckan.open.nrw.de`, nicht in GovData. Der Dienst sagt
 * `ows:Fees: NONE` und `ows:AccessConstraints: NONE`, und beides ist keine
 * Lizenz, sondern die Aussage, dass er kein Geld kostet und keinen Zugang
 * beschränkt.
 *
 * Solange das so ist, wird der Betrag **berechnet und ins Log geschrieben,
 * aber nicht ausgeliefert**: `fee` bleibt `unknown`, `rawFee` leer, und
 * `sourceDefect` sagt in einem Satz, warum. Die Zeiten der Automaten kommen
 * trotzdem mit — dazu unten bei `windows`.
 *
 * Umlegen darf diesen Schalter, wer eine Antwort von `opendata@duesseldorf.de`
 * oder `maps@duesseldorf.de` hat. Der Code ist fertig und getestet; was fehlt,
 * ist der Beleg.
 */
const AUTOMATS_LICENCE_CONFIRMED = false

/**
 * Warum die Tarifzeiten trotzdem mitkommen, der Betrag aber nicht.
 *
 * Eine Zeitangabe ist keine schutzfähige Datenbankleistung in dem Sinn, in dem
 * ein Preis eine Auskunft ist — aber das ist nicht die Begründung, und sie
 * wäre auch keine gute. Die Begründung ist eine andere: Die Gebiete sagen ihre
 * Zeiten **selbst**, aus einer Ebene mit belegter Lizenz. Die Automatenzeiten
 * bestätigen sie in 25 von 29 Gebieten wörtlich und ergänzen in vier Gebieten
 * die zweite Spanne, die das Gebiets-Feld als „teils" abkürzt. Fiele die Ebene
 * ganz weg, bliebe jede Aussage über Zeiten bestehen; nur der Zusatz „teils"
 * bliebe unaufgelöst.
 *
 * Wer beides zusammen draußen haben will, setzt hier `false` — dann baut das
 * Skript allein aus `zeitraum`.
 */
const USE_AUTOMAT_HOURS = true

interface Geometry {
  type: string
  coordinates: unknown
}

interface Feature<P> {
  properties: P
  geometry: Geometry | null
}

function readFeatures<P>(key: string): Feature<P>[] {
  const path = join(RAW, `${key}.json`)
  const parsed = JSON.parse(readFileSync(path, 'utf8')) as { features: Feature<P>[] }
  return parsed.features
}

function toGeoJson(geometry: Geometry | null): Geometry | null {
  if (geometry === null) return null
  return { type: geometry.type, coordinates: toGeoJsonAxes(geometry.coordinates, AXIS_ORDER) }
}

/**
 * Bricht ab, wenn der Dienst UTM statt Grad geliefert hat.
 *
 * Dieselbe Prüfung wie in Frankfurt und München, und aus demselben Grund:
 * `DefaultCRS` ist bei allen Ebenen dieses Servers EPSG:25832. Ohne `srsName`
 * kämen Meter — plausible Zahlen, nur keine Grade —, und auf der Karte sähe
 * das nur nach „leer" aus, nicht nach kaputt.
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
function centroid(polygons: readonly PolygonRings[]): Position | null {
  let lon = 0
  let lat = 0
  let count = 0
  for (const rings of polygons) {
    for (const position of rings[0] ?? []) {
      lon += position[0]
      lat += position[1]
      count += 1
    }
  }
  return count === 0 ? null : [lon / count, lat / count]
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

/** Dasselbe Feld-Schema wie in den vier anderen Städten — ein Typ, ein Panel. */
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

console.log('Düsseldorf — Daten bauen …')

// ------------------------------------------------------------- Stadtteile
//
// Zuerst, weil die Gebiete sie brauchen. Anderer Dienst als die Parkebenen
// (`grenzen` statt `verkehr`), anderes Amt (Statistik und Wahlen statt
// Verkehrsmanagement), dieselbe Lizenz. Gefunden über das offene Datenportal
// der Stadt, nicht durch Raten von Adressen — der Weg, den schon Frankfurts
// und Münchens Stadtteile gegangen sind.
//
// Und ein Hinweis, der leicht zu übersehen ist: Der Stadtteil widerspricht
// manchmal dem Gebietsnamen. Das Bewohnerparkgebiet „Niederkassel" liegt
// vollständig im Stadtteil **Oberkassel**. Beide Angaben sind richtig; die
// Stadt hat das Gebiet nach der Straße benannt, nicht nach dem Stadtteil.

interface District {
  name: string
  rings: PolygonRings[]
}

const districtFeatures: {
  type: 'Feature'
  properties: { name: string }
  geometry: Geometry
}[] = []
const districtIndex: District[] = []

for (const feature of readFeatures<Record<string, unknown>>('districts')) {
  const geometry = toGeoJson(feature.geometry)
  if (geometry === null) continue
  assertDegrees('districts', geometry)
  const name = text(feature.properties['name'])

  // Die Zuordnung läuft gegen die UNvereinfachte Geometrie. Vereinfachte
  // Grenzen wandern um bis zu ein paar Dutzend Meter, und ein Gebiet direkt
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

interface Automat {
  properties: DuesseldorfAutomatProperties
  point: Position
}

const placedAutomats: Automat[] = []
for (const feature of readFeatures<DuesseldorfAutomatProperties>('automats')) {
  const geometry = toGeoJson(feature.geometry)
  if (geometry === null) continue
  assertDegrees('automats', geometry)
  const coordinates = geometry.coordinates
  if (!Array.isArray(coordinates)) continue
  const [lon, lat] = coordinates as number[]
  if (typeof lon !== 'number' || typeof lat !== 'number') continue
  placedAutomats.push({ properties: feature.properties, point: [lon, lat] })
}

// ---------------------------------------------------------------- Gebiete
//
// **Gruppiert wird auf `kuerzel`, nicht auf `_uuid`.** Der Dienst liefert 65
// Merkmale für 44 Gebiete; Immermannstraße kommt achtmal, Friedrichstadt
// viermal. Alle Stücke eines Gebiets tragen dieselben Sachdaten — ein Test in
// `duesseldorf.test.ts` hält das gegen die Fixture fest, damit es auffällt,
// wenn eines Tages zwei Stücke verschiedene Zeiten nennen.

interface Zone {
  properties: DuesseldorfZoneProperties
  polygons: PolygonRings[]
  parts: number
  automats: DuesseldorfAutomatProperties[]
}

const zones = new Map<string, Zone>()
let featuresRead = 0
let inconsistentParts = 0

for (const feature of readFeatures<DuesseldorfZoneProperties>('zones')) {
  const geometry = toGeoJson(feature.geometry)
  if (geometry === null) continue
  assertDegrees('zones', geometry)
  featuresRead += 1

  const code = text(feature.properties.kuerzel)
  if (code === '') continue
  const existing = zones.get(code)
  if (existing === undefined) {
    zones.set(code, {
      properties: feature.properties,
      polygons: toPolygons(geometry),
      parts: 1,
      automats: [],
    })
    continue
  }
  existing.polygons.push(...toPolygons(geometry))
  existing.parts += 1
  // Laut melden statt still das erste Stück gewinnen zu lassen: Zwei Stücke
  // mit verschiedenen Zeiten wären eine neue Aussage der Stadt, und die will
  // jemand gelesen haben, bevor die App sie halbiert.
  if (
    text(existing.properties.zeitraum) !== text(feature.properties.zeitraum) ||
    text(existing.properties.name) !== text(feature.properties.name)
  ) {
    inconsistentParts += 1
    console.warn(
      `  ! ${code}: zwei Stücke desselben Gebiets nennen Verschiedenes — ` +
        `${JSON.stringify(existing.properties.zeitraum)} gegen ` +
        `${JSON.stringify(feature.properties.zeitraum)}`
    )
  }
}

/**
 * Welcher Automat zu welchem Gebiet gehört — über die Geometrie.
 *
 * Anders als in Frankfurt und München gibt es hier gar keine Wahl: Der Automat
 * nennt kein Gebiet. Er trägt eine `app_sms_zone` (elf Werte über 732
 * Automaten), und die ist die Zone der Park-App, nicht das Bewohnerparkgebiet
 * — 44 Gebiete lassen sich damit nicht unterscheiden.
 *
 * Ein Automat kann in zwei Gebiete fallen, weil sich Blücherstraße und
 * Derendorfer Straße überlappen. Er wird dem ersten Treffer zugeschlagen und
 * die Zahl ins Log geschrieben; beide Gebiete nennen dieselbe Zeit, die
 * Antwort der App hängt also nicht an der Reihenfolge.
 */
let automatsInTwoZones = 0
let automatsWithoutZone = 0

for (const automat of placedAutomats) {
  const hits = [...zones.values()].filter((zone) =>
    multiPolygonContains(zone.polygons, automat.point)
  )
  if (hits.length === 0) {
    automatsWithoutZone += 1
    continue
  }
  if (hits.length > 1) automatsInTwoZones += 1
  ;(hits[0] as Zone).automats.push(automat.properties)
}

const zoneFeatures: { type: 'Feature'; properties: ZoneOut; geometry: Geometry }[] = []
let withoutDistrict = 0
let withoutAutomats = 0
let feeExact = 0
let feeRange = 0
let hoursFromAutomatsOnly = 0

for (const [code, zone] of zones) {
  const rawHours = text(zone.properties.zeitraum)

  /**
   * Ein Gebiet ohne lesbare Zeitangabe wird ausgelassen.
   *
   * Dasselbe Kriterium wie bei Hamburgs „ohne Zeitangabe" und Frankfurts
   * „ohne Automaten": Ein Polygon ohne Antwort ist schlechter als kein
   * Polygon — es sähe aus wie eine bewirtschaftete Fläche und wüsste über sie
   * nichts. Im Abzug vom 8. September trifft das **kein** Gebiet; im
   * Dateiabzug vom 11. Dezember 2025 hätte es drei getroffen
   * (Ahnfeldstraße, Feuerbachstraße, Schillerplatz, alle drei mit
   * `zeitraum: null`).
   */
  if (rawHours === '') {
    console.log(`  ausgelassen: ${code} ohne Zeitangabe`)
    continue
  }

  const zoneWindows = parseDuesseldorfSchedule(rawHours)
  const automatHours = [
    ...new Set(zone.automats.map((automat) => text(automat.tarifzeiten)).filter((v) => v !== '')),
  ]
  const automatWindows = USE_AUTOMAT_HOURS
    ? automatHours.flatMap((value) => parseDuesseldorfAutomatSchedule(value))
    : []
  const windows = mergeDuesseldorfWindows([...zoneWindows, ...automatWindows])
  if (windows.length > zoneWindows.length) hoursFromAutomatsOnly += 1

  const fees = zone.automats.map((automat) => parseDuesseldorfFee(automat.tarifgebuehr))
  const merged = mergeDuesseldorfFees(fees)
  if (merged.kind === 'exact') feeExact += 1
  if (merged.kind === 'range') feeRange += 1
  const rawFees = [
    ...new Set(zone.automats.map((automat) => text(automat.tarifgebuehr)).filter((v) => v !== '')),
  ]

  /**
   * Die Höchstparkdauer wird **nie** als Regel des Gebiets ausgegeben.
   *
   * Sie steht je Automat, und in vier der 29 Gebiete mit Automaten stehen
   * `2 h` und `ohne` nebeneinander. Sie trotzdem als `maxStayMinutes`
   * auszuliefern hieße zu behaupten, die Quelle nenne sie für das ganze
   * Gebiet. Derselbe Weg wie in Berlin und Frankfurt: Wert, Anteil und alle
   * Ausprägungen.
   */
  const stayCounts = new Map<string, number>()
  for (const automat of zone.automats) {
    const minutes = parseDuesseldorfMaxStay(automat.hoechstparkzeit)
    if (minutes === undefined) continue
    stayCounts.set(
      duesseldorfMaxStayCode(minutes),
      (stayCounts.get(duesseldorfMaxStayCode(minutes)) ?? 0) + 1
    )
  }
  const stayEntries = [...stayCounts.entries()].sort((a, b) => b[1] - a[1])
  const limited = stayEntries.reduce((sum, [, count]) => sum + count, 0)

  if (zone.automats.length === 0) withoutAutomats += 1

  const district = districtAt(centroid(zone.polygons))
  if (district === null) withoutDistrict += 1

  const geometry: Geometry =
    zone.polygons.length === 1
      ? { type: 'Polygon', coordinates: zone.polygons[0] }
      : { type: 'MultiPolygon', coordinates: zone.polygons }
  const simplified = simplifyGeometry(geometry, 1e-5, 5)
  if (simplified === null) continue

  // Der Satz steht nur da, wo er etwas erklärt: Ein Gebiet mit Automaten, für
  // die kein Lizenzbeleg vorliegt, sähe sonst aus, als wüsste die Stadt den
  // Preis nicht — sie weiß ihn, wir dürfen ihn nur nicht weitergeben.
  const sourceDefect =
    !AUTOMATS_LICENCE_CONFIRMED && rawFees.length > 0
      ? 'Die Stadt nennt an den Parkscheinautomaten dieses Gebiets einen Tarif. ' +
        'Er wird hier nicht angezeigt, weil für diesen Datensatz keine offene ' +
        'Lizenz belegt ist.'
      : null

  zoneFeatures.push({
    type: 'Feature',
    properties: {
      zone: duesseldorfZoneLabel(zone.properties),
      district: district?.name ?? DUESSELDORF.name,
      // Die Rohtexte beider Ebenen, wörtlich und getrennt. Das Panel zeigt sie
      // unter „Zeiten laut Quelle"; dort gehört hin, was wirklich dasteht.
      rawHours: [rawHours, ...(USE_AUTOMAT_HOURS ? automatHours : [])].join('; '),
      rawFee: AUTOMATS_LICENCE_CONFIRMED ? rawFees.join('; ') : '',
      note: null,
      windows,
      fee: AUTOMATS_LICENCE_CONFIRMED ? merged : { kind: 'unknown' },
      // `teils 9 bis 22 Uhr` und die alte Form mit Sternchen: Die Quelle sagt,
      // dass für einen Teil des Gebiets etwas anderes gilt, und nicht, für
      // welchen. Ein Fenster daraus wäre erfunden.
      unmodelledRules: duesseldorfExtraRules(zone.properties.zeitraum),
      sourceDefect,
      spaces: null,
      maxStayMinutes: null,
      maxStay: stayEntries[0]?.[0] ?? null,
      maxStayShare:
        zone.automats.length === 0
          ? 0
          : Math.round((limited / zone.automats.length) * 1000) / 1000,
      maxStayValues: stayEntries.map(([value]) => value),
      chargingPoints: 0,
      carsharing: 0,
    },
    geometry: simplified,
  })
}

write('zones.geojson', { type: 'FeatureCollection', features: zoneFeatures })

// ------------------------------------------------------------------- POI
//
// Zwei der vier POI-Arten, die die Karte schon kennt — ohne eine Zeile
// Änderung an der Oberfläche. Ladepunkte und Carsharing hat dieser Dienst
// zwar auch (`verkehr:sharingstationen_point`, 331 Punkte), aber sie mischen
// Auto-, Rad- und Rollersharing in einer Ebene; welcher Punkt welches ist,
// sagen die Attribute nicht sauber. Lieber zwei Arten richtig als vier halb.

const poi: { type: 'Feature'; properties: Record<string, unknown>; geometry: Geometry }[] = []

for (const feature of readFeatures<Record<string, unknown>>('accessible')) {
  const geometry = toGeoJson(feature.geometry)
  if (geometry === null) continue
  assertDegrees('accessible', geometry)

  // `anzahl` steht als Text da: „4 Stellplätze", „1 Stellplatz". Er wird
  // wörtlich übernommen statt zu einer Zahl gemacht — die Stadt hat den
  // Singular selbst richtig gesetzt, und „1 Plätze" ist in Berlin schon
  // einmal in die Sprechblase gelaufen.
  const detail = [text(feature.properties['anzahl']), text(feature.properties['zeitbegrenzung'])]
    .filter((part) => part !== '')
    .join(' · ')

  poi.push({
    type: 'Feature',
    properties: {
      kind: 'accessible',
      label:
        text(feature.properties['beschreibung']) ||
        text(feature.properties['adresse']) ||
        'Behindertenparkplatz',
      detail: detail === '' ? null : detail,
    },
    geometry: {
      type: 'Point',
      coordinates: roundPoint((geometry.coordinates as [number, number]) ?? [0, 0]),
    },
  })
}

for (const feature of readFeatures<Record<string, unknown>>('parkAndRide')) {
  const geometry = toGeoJson(feature.geometry)
  if (geometry === null) continue
  assertDegrees('parkAndRide', geometry)

  // Die Ebene reicht über die Stadtgrenze: zwölf verschiedene Werte in
  // `stadt`, darunter Meerbusch und Langenfeld. Das ist Absicht der Stadt —
  // ein P+R-Platz nützt gerade dort, wo man noch nicht in Düsseldorf ist —
  // und deshalb bleiben sie drin.
  const detail = [text(feature.properties['nahverkehr']), text(feature.properties['hinweis'])]
    .filter((part) => part !== '')
    .join(' · ')

  poi.push({
    type: 'Feature',
    properties: {
      kind: 'park_and_ride',
      label: text(feature.properties['name']) || 'P+R',
      detail: detail === '' ? null : detail,
    },
    geometry: {
      type: 'Point',
      coordinates: roundPoint((geometry.coordinates as [number, number]) ?? [0, 0]),
    },
  })
}

write('poi.geojson', { type: 'FeatureCollection', features: poi })

// ------------------------------------------------------------- Umweltzone

const umweltzone: { type: 'Feature'; properties: Record<string, unknown>; geometry: Geometry }[] =
  []
for (const feature of readFeatures<Record<string, unknown>>('lowEmissionZone')) {
  const geometry = toGeoJson(feature.geometry)
  if (geometry === null) continue
  assertDegrees('lowEmissionZone', geometry)
  const simplified = simplifyGeometry(geometry, 1e-5, 5)
  if (simplified === null) continue
  umweltzone.push({ type: 'Feature', properties: {}, geometry: simplified })
}

write('umweltzone.geojson', { type: 'FeatureCollection', features: umweltzone })

write('meta.json', {
  city: DUESSELDORF.key,
  cityName: DUESSELDORF.name,
  source: `${DUESSELDORF.attribution.source}, WFS 2.0.0`,
  licence: DUESSELDORF.attribution.licence,
  licenceUrl: DUESSELDORF.attribution.licenceUrl,
  attributionRequired: DUESSELDORF.attribution.attributionRequired,
  datasetUrl: DUESSELDORF.attribution.datasetUrl,
  zones: zoneFeatures.length,
  districts: districtFeatures.length,
  poi: poi.length,
  lowEmissionZone: umweltzone.length > 0,
  segments: 0,
  managedSpaces: 0,
  crs: 'EPSG:4326 (lon/lat)',
  /**
   * `fee` steht hier als abwesend, obwohl die Quelle einen Betrag führt —
   * siehe `AUTOMATS_LICENCE_CONFIRMED`. `segments` und `managedSpaces` gibt es
   * in Düsseldorf wirklich nicht.
   */
  absent: AUTOMATS_LICENCE_CONFIRMED ? ['segments'] : ['fee', 'segments'],
})

// Die Zahlen gehören ins Log, nicht in einen Kommentar: Sie sind das, was beim
// nächsten Abzug anders sein kann, und ein Sprung darin ist das erste, was
// auffällt.
console.log(
  `\n${zoneFeatures.length} Gebiete aus ${featuresRead} Merkmalen` +
    ` (${featuresRead - zones.size} Stücke zusammengelegt,` +
    ` ${inconsistentParts} widersprüchlich), ${withoutDistrict} ohne Stadtteil-Treffer`
)
console.log(
  `${placedAutomats.length - automatsWithoutZone} von ${placedAutomats.length} Automaten` +
    ` einem Gebiet zugeordnet, ${automatsWithoutZone} liegen in keinem,` +
    ` ${automatsInTwoZones} in zweien`
)
console.log(
  `${zones.size - withoutAutomats} Gebiete mit Automaten, ${withoutAutomats} ohne` +
    ` — davon ${hoursFromAutomatsOnly} mit einem Fenster, das nur die Automaten nennen`
)
console.log(
  AUTOMATS_LICENCE_CONFIRMED
    ? `Tarif: ${feeExact} Gebiete mit einem Betrag, ${feeRange} mit einer Spanne`
    : `Tarif gerechnet, aber NICHT ausgeliefert (Lizenz nicht belegt):` +
        ` ${feeExact} Gebiete mit einem Betrag, ${feeRange} mit einer Spanne`
)
console.log(`${poi.length} POI, ${districtFeatures.length} Stadtteile, ${umweltzone.length} Umweltzone`)
