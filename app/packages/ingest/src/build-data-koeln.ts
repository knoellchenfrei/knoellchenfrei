/**
 * Baut Kölns Daten — das fünfte Gegenstück zu `build-data.ts`.
 *
 * Fünf Skripte statt eines mit fünf Zweigen, aus demselben Grund wie bei
 * Hamburg, Frankfurt und München: Die Feeds teilen sich außer dem Wort
 * „Parken" nichts.
 *
 * Was Köln **anders** macht als die vier anderen Städte:
 *
 * - **Die Sachauskunft steht in einer CSV, nicht in einem Geodienst.** Der WFS
 *   führt 47 Bewohnerparkgebiete mit Namen und Umriss — und sonst nichts:
 *   keine Zeit, keine Gebühr, keine Höchstparkdauer, keine Stellplatzzahl.
 *   Alles davon entsteht hier aus den 2.315 Parkscheinautomaten der Datei
 *   `psa_2016.csv`.
 * - **Die Geometrie muss umgerechnet werden.** Kölns WFS ignoriert `srsName`
 *   und antwortet immer in EPSG:25832. `utm32.ts` rechnet das um; die
 *   Begründung und die Messreihe stehen dort.
 * - **Die Zuordnung läuft über die Geometrie, nicht über das Attribut** — das
 *   Gegenteil von München und dasselbe wie in Frankfurt. Begründung mit Zahlen
 *   unten bei `assign`.
 * - **Kein Betrag, nirgends.** Jedes Gebiet bekommt `Fee = { kind: 'unknown' }`,
 *   obwohl die Quelle einen Betrag nennt. Warum: siehe unten und
 *   `docs/staedte-koeln.md`.
 *
 * Was Köln **nicht** hat und die anderen schon: Stadtbezirke, Umweltzone,
 * Behindertenparkplätze, Ladeinfrastruktur, Carsharing, P+R. Für keine dieser
 * Ebenen ließ sich am 8. September 2026 ein Dienst der Stadt belegen — der
 * Geoportal-Server antwortet auf jeden geratenen Dienstnamen mit `403`, auch
 * auf einen erfundenen. Die drei Dateien werden trotzdem geschrieben, leer:
 * `loadData` in der Web-App holt alle fünf und bricht ab, wenn eine fehlt, und
 * Frankfurts leere `umweltzone.geojson` ist dafür der Vorgänger.
 *
 * Abruf der Rohdaten (`fetch.ts` kennt nur WFS, die CSV kommt daneben):
 *
 *     B='https://geoportal.stadt-koeln.de/wss/service/bewohnerparken_wfs/guest'
 *     OF='application%2Fjson%3B%20subtype%3Dgeojson'
 *     curl -sS "$B?service=WFS&version=2.0.0&request=GetFeature\
 *     &typeNames=ms:bewohnerparkgebiete_zonen&outputFormat=$OF" > .raw/koeln/zones.json
 *     curl -sS 'https://www.offenedaten-koeln.de/sites/default/files/distribution/psa_2016.csv' \
 *       > .raw/koeln/automats.csv
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

import {
  cityByKey,
  koelnAutomatPosition,
  koelnMaxStayCode,
  koelnZoneLabel,
  koelnZoneNote,
  mergeKoelnWindows,
  multiPolygonContains,
  parseKoelnAutomats,
  parseKoelnMaxStay,
  parseKoelnSchedule,
  withinBounds,
  type BoundingBox,
  type ChargeWindow,
  type Fee,
  type KoelnAutomat,
  type KoelnZoneProperties,
  type PolygonRings,
  type Position,
} from '@knoellchenfrei/core'

import { simplifyGeometry } from './simplify.js'
import { geprueftAm } from './abruf-zeit.js'
import { utm32CoordinatesToWgs84 } from './utm32.js'

/**
 * Die Stadt kommt aus `core/city.ts`, nicht aus einer Kopie hier.
 *
 * Solange dort kein `KOELN` steht, bricht dieser Lauf mit
 * `Unbekannte Stadt "koeln"` ab — laut und in der ersten Zeile. Die Zahlen
 * hier zu wiederholen wäre die Alternative gewesen und genau der Fehler, den
 * `city.ts` behebt: Stadtgrenzen stehen im Projekt an genau einer Stelle.
 */
const KOELN = cityByKey('koeln')

const RAW = join(process.env.RAW_DIR ?? join(process.cwd(), '../../.raw'), KOELN.key)
const OUT = join(process.env.OUT_DIR ?? join(process.cwd(), '../../apps/web/public/data'), KOELN.key)

interface Geometry {
  type: string
  coordinates: unknown
}

interface Feature<P> {
  id?: string
  properties: P
  geometry: Geometry | null
}

function write(name: string, value: unknown): void {
  const path = join(OUT, name)
  mkdirSync(dirname(path), { recursive: true })
  const json = JSON.stringify(value)
  writeFileSync(path, json)
  console.log(`  ${name}: ${(json.length / 1024).toFixed(0)} KB`)
}

/**
 * Bricht ab, wenn der Dienst **Grad** geliefert hat — die Umkehrung von
 * `assertDegrees`.
 *
 * In Frankfurt und München prüft der Datenbau, ob `srsName` gewirkt hat. In
 * Köln ist die Frage andersherum: Der Dienst rechnet grundsätzlich nicht um,
 * also *muss* UTM ankommen, und dieses Skript rechnet selbst. Fängt die Stadt
 * eines Tages an, `srsName` zu beachten, käme die Antwort in Grad — und
 * `utm32ToWgs84` machte daraus stillschweigend Unfug irgendwo in der Nordsee.
 * Diese Prüfung fängt das ab, bevor gerechnet wird.
 *
 * Sie steht hier und nicht in `utm32.ts`, weil sie eine Aussage über *diesen*
 * Dienst ist und keine über die Umrechnung; `utm32ToWgs84` weist einzelne
 * Gradwerte ohnehin ab.
 */
function assertUtm(key: string, geometry: Geometry): void {
  const walk = (node: unknown): void => {
    if (!Array.isArray(node)) return
    if (typeof node[0] === 'number' && typeof node[1] === 'number') {
      const [easting, northing] = node as number[]
      if (Math.abs(easting as number) <= 180 && Math.abs(northing as number) <= 90) {
        throw new Error(
          `${key}: ${easting}/${northing} sehen nach Grad aus — der Kölner Dienst hat ` +
            'bisher immer EPSG:25832 geliefert und srsName ignoriert. Wenn er das ' +
            'geändert hat, gehört die Umprojektion hier heraus statt verdoppelt.'
        )
      }
      return
    }
    node.forEach(walk)
  }
  walk(geometry.coordinates)
}

/** Dieselbe Prüfung wie in Frankfurt und München — nach dem Rechnen statt davor. */
function assertDegrees(key: string, geometry: Geometry): void {
  const walk = (node: unknown): void => {
    if (!Array.isArray(node)) return
    if (typeof node[0] === 'number' && typeof node[1] === 'number') {
      const [lon, lat] = node as number[]
      if (Math.abs(lon as number) > 180 || Math.abs(lat as number) > 90) {
        throw new Error(`${key}: ${lon}/${lat} sind keine Grade — die Umprojektion ist falsch`)
      }
      return
    }
    node.forEach(walk)
  }
  walk(geometry.coordinates)
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

/** Dasselbe Feld-Schema wie Berlin, Hamburg, Frankfurt und München. */
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

console.log('Köln — Daten bauen …')

// ---------------------------------------------------------------- Gebiete

interface Zone {
  label: string
  properties: KoelnZoneProperties
  geometry: Geometry
  polygons: PolygonRings[]
  bounds: BoundingBox
  automats: KoelnAutomat[]
}

const zoneFile = JSON.parse(readFileSync(join(RAW, 'zones.json'), 'utf8')) as {
  features: Feature<KoelnZoneProperties>[]
}

const zones: Zone[] = []
for (const feature of zoneFile.features) {
  if (feature.geometry === null) continue
  assertUtm('zones', feature.geometry)
  const geometry: Geometry = {
    type: feature.geometry.type,
    coordinates: utm32CoordinatesToWgs84(feature.geometry.coordinates),
  }
  assertDegrees('zones', geometry)

  const points = positionsOf(geometry)
  const lons = points.map((point) => point[0])
  const lats = points.map((point) => point[1])
  zones.push({
    label: koelnZoneLabel(feature.properties),
    properties: feature.properties,
    geometry,
    polygons: toPolygons(geometry),
    bounds: {
      minLon: Math.min(...lons),
      maxLon: Math.max(...lons),
      minLat: Math.min(...lats),
      maxLat: Math.max(...lats),
    },
    automats: [],
  })
}

// Der Name ist zugleich der Schlüssel, unter dem das Gebiet ausgeliefert wird.
// Zwei gleiche Namen hiessen: ein Gebiet verschwindet, und zwar lautlos.
const labels = new Set(zones.map((zone) => zone.label))
if (labels.size !== zones.length) {
  throw new Error(`${zones.length} Gebiete, aber nur ${labels.size} verschiedene Namen`)
}

// ------------------------------------------------------------- Automaten

/**
 * Welcher Automat zu welchem Gebiet gehört — **über die Geometrie**.
 *
 * Und damit wie in Frankfurt, nicht wie in München. Der Grund ist derselbe wie
 * dort und lässt sich nachzählen; am Abzug vom 8. September 2026 gemessen:
 *
 * | | über Punkt-in-Polygon | über `Bezirk/Gebiet` |
 * | --- | --- | --- |
 * | zugeordnete Automaten | **1.902** von 2.315 | 1.638 |
 * | erreichte Gebiete | 45 von 47 | 25 von 47 |
 *
 * Die Spalte `Bezirk/Gebiet` ist kein Schlüssel, sondern eine Beschriftung:
 * Sie schreibt `City/Martinsviertel`, wo das Gebiet `City-Martinsviertel`
 * heißt, `Lindenthal Süd I` gegen `Lindenthal-Süd I`, `Ehrenfeld` für vier
 * Gebiete auf einmal und `lrh. ohne BWP` für alles linksrheinisch außerhalb.
 * Die zweite Kandidatin, `Roter Punkt`, ist noch schlechter: 530 Zeilen lassen
 * sie leer, sie schreibt `DEUTZ I` neben `Deutz I` und trägt Mehrfachwerte wie
 * `EIGEL+ AGN I`.
 *
 * Eine Namensangleichung wäre möglich und wäre geraten. Der Punkt ist die
 * Aussage der Stadt über den Ort des Automaten; sie braucht keine Auslegung.
 */
const csv = readFileSync(join(RAW, 'automats.csv'), 'utf8')
const automats = parseKoelnAutomats(csv)

let withoutPosition = 0
let outsideEveryZone = 0
let assigned = 0
let nameAgrees = 0

for (const automat of automats) {
  const point = koelnAutomatPosition(automat, KOELN.reportBounds)
  if (point === null) {
    withoutPosition += 1
    continue
  }
  const zone = zones.find(
    (candidate) =>
      withinBounds(point, candidate.bounds) && multiPolygonContains(candidate.polygons, point)
  )
  if (zone === undefined) {
    // Kein Fehler: Köln bewirtschaftet auch außerhalb der Bewohnerparkgebiete
    // — die Spalte `Bezirk/Gebiet` sagt das selbst, mit Werten wie
    // `lrh. ohne BWP`, `Chorweiler` und `Rodenkirchen`. Diese Automaten
    // gehören zu keinem Polygon, das dieser Dienst führt.
    outsideEveryZone += 1
    continue
  }
  assigned += 1
  // Gegenprobe über den Namen, wie in München die Gegenprobe über die
  // Geometrie: Läuft beides eines Tages weit auseinander, steht es im Log.
  if (automat.area === zone.label) nameAgrees += 1
  zone.automats.push(automat)
}

/**
 * Wie viele Automaten ohne brauchbare Koordinate hinnehmbar sind.
 *
 * Heute sind es 125 von 2.315, also 5,4 %: 106 Zeilen lassen beide
 * Koordinatenspalten leer, 19 stehen erkennbar falsch — zwölfmal fehlt das
 * Dezimalkomma im Ostwert, sechsmal ist eine Ziffer vertippt, einmal fehlt
 * die führende Fünf. Einzeln wegzuwerfen ist richtig; **stillschweigend** die
 * Hälfte wegzuwerfen wäre es nicht. Die Schranke ist deshalb doppelt so hoch
 * wie der heutige Stand: Sie lässt eine Verschlechterung zu und hält einen
 * Zusammenbruch auf.
 */
const MAX_UNPLACED_SHARE = 0.1
const unplacedShare = withoutPosition / automats.length
if (unplacedShare > MAX_UNPLACED_SHARE) {
  throw new Error(
    `${withoutPosition} von ${automats.length} Automaten ohne brauchbare Koordinate ` +
      `(${(unplacedShare * 100).toFixed(1)} %) — mehr als die Schranke von ` +
      `${MAX_UNPLACED_SHARE * 100} %. Die Datei hat sich geändert, nicht der Code.`
  )
}

// ------------------------------------------------------- Gebiete ausgeben

/**
 * Was in `sourceDefect` steht, und warum überhaupt etwas.
 *
 * Die Quelle nennt einen Betrag, und er ist falsch. Ihn wegzulassen und sonst
 * zu schweigen wäre die halbe Antwort: Wer die CSV selbst öffnet, sieht dort
 * `0,50 €` und hielte die App für unvollständig. Der Satz sagt, dass der Wert
 * existiert und warum er nicht gezeigt wird.
 */
const FEE_DEFECT =
  'Die Quelle nennt 0,50 € bzw. 1,00 € je 20 Minuten. Dieser Wert ist veraltet: ' +
  'Die Datei führt eine Spalte „Tagesgebühr 4,00 €", während die Stadt Köln für ' +
  'dasselbe Tagesticket heute 5 Euro nennt. Deshalb steht hier kein Betrag.'

const zoneFeatures: { type: 'Feature'; properties: ZoneOut; geometry: Geometry }[] = []
let skippedWithoutAutomat = 0
let totalSpaces = 0

for (const zone of zones) {
  /**
   * Ein Gebiet ohne einen einzigen Automaten wird ausgelassen.
   *
   * Dasselbe Kriterium wie Hamburgs „ohne Zeitangabe", Frankfurts „ohne
   * Automaten" und Münchens „ohne Abschnitt mit Parkbezug": Ohne Zeiten kann
   * die App die eine Frage nicht beantworten, für die es sie gibt, und ein
   * Polygon ohne Antwort ist schlechter als kein Polygon — es sähe aus wie
   * eine bewirtschaftete Fläche und wüsste über sie nichts.
   *
   * Heute trifft das zwei der 47: Porz-Grengel und
   * Lindenthal-Nord III/Piusstraße. Beide sind Bewohnerparkgebiete ohne
   * Parkscheinautomaten — dort gilt der Ausweis, aber es kassiert niemand.
   */
  if (zone.automats.length === 0) {
    skippedWithoutAutomat += 1
    continue
  }

  const simplified = simplifyGeometry(zone.geometry, 1e-5, 5)
  if (simplified === null) continue

  const schedules = zone.automats.map((automat) => parseKoelnSchedule(automat.rawHours))

  /**
   * Die Rohtexte: die häufigsten, mit Zähler — wie in München.
   *
   * Nicht alle: Ein Gebiet trägt bis zu acht verschiedene Gebührenzeiten, und
   * die vollständige Liste wäre im Panel ein Absatz. Fünf plus die Zahl der
   * übrigen sagen, was hier üblich ist und dass es mehr gibt.
   */
  const textCounts = new Map<string, number>()
  for (const schedule of schedules) {
    textCounts.set(schedule.raw, (textCounts.get(schedule.raw) ?? 0) + 1)
  }
  const ranked = [...textCounts.entries()].sort((a, b) => b[1] - a[1])
  const shown = ranked.slice(0, 5).map(([text, count]) => `${text} (${count}×)`)
  const rest = ranked.length - shown.length
  const rawHours = [...shown, ...(rest > 0 ? [`+ ${rest} weitere`] : [])].join('; ')

  /**
   * Die Höchstparkdauer wird **nie** als Regel des Gebiets ausgegeben.
   *
   * Derselbe Weg wie in Berlin, Frankfurt und München und aus demselben Grund:
   * Sie steht je Automat, und im selben Gebiet stehen regelmäßig zwei und
   * neun Stunden nebeneinander. Sie als `maxStayMinutes` auszuliefern hiesse
   * zu behaupten, die Quelle nenne sie für das ganze Gebiet — das Panel sagt
   * bei diesem Feld genau das. `maxStayShare` nennt stattdessen den Anteil.
   */
  const stayCounts = new Map<string, number>()
  for (const automat of zone.automats) {
    const minutes = parseKoelnMaxStay(automat.rawMaxStay)
    if (minutes === undefined) continue
    const code = koelnMaxStayCode(minutes)
    stayCounts.set(code, (stayCounts.get(code) ?? 0) + 1)
  }
  const stayEntries = [...stayCounts.entries()].sort((a, b) => b[1] - a[1])
  const limited = stayEntries.reduce((sum, [, count]) => sum + count, 0)

  const spaces = zone.automats.reduce((sum, automat) => sum + automat.spaces, 0)
  totalSpaces += spaces

  const unmodelledRules = [...new Set(schedules.flatMap((schedule) => schedule.unmodelled))].sort()

  zoneFeatures.push({
    type: 'Feature',
    properties: {
      zone: zone.label,
      // Köln hat neun Stadtbezirke, und für keinen ließ sich am 8. September
      // 2026 ein Dienst belegen. Der Stadtname statt eines geratenen Bezirks
      // — dieselbe Antwort wie in München, wo der Bezirk fehlt.
      district: KOELN.name,
      rawHours,
      // Bewusst leer. Die Quelle nennt einen Betrag, und `sourceDefect` sagt,
      // warum er nicht hier steht.
      rawFee: '',
      note: koelnZoneNote(zone.properties),
      windows: mergeKoelnWindows(schedules.flatMap((schedule) => schedule.windows)),
      fee: { kind: 'unknown' },
      unmodelledRules,
      sourceDefect: FEE_DEFECT,
      spaces: spaces > 0 ? spaces : null,
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

// Drei leere Sammlungen, damit `loadData` alle fünf Dateien bekommt. Frankfurt
// liefert seine Umweltzone genauso — leer heißt „dieser Dienst führt das
// nicht", und das ist eine Auskunft.
write('districts.geojson', { type: 'FeatureCollection', features: [] })
write('poi.geojson', { type: 'FeatureCollection', features: [] })
write('umweltzone.geojson', { type: 'FeatureCollection', features: [] })

write('meta.json', {
  city: KOELN.key,
  cityName: KOELN.name,
  source: `${KOELN.attribution.source}, WFS 2.0.0 und psa_2016.csv`,
  licence: KOELN.attribution.licence,
  licenceUrl: KOELN.attribution.licenceUrl,
  attributionRequired: KOELN.attribution.attributionRequired,
  datasetUrl: KOELN.attribution.datasetUrl,
  // Wann die Quelle zuletzt erfolgreich abgerufen wurde — siehe abruf-zeit.ts.
  geprueftAm: geprueftAm(RAW),
  zones: zoneFeatures.length,
  districts: 0,
  poi: 0,
  lowEmissionZone: false,
  segments: automats.length,
  managedSpaces: totalSpaces,
  crs: 'EPSG:4326 (lon/lat), umgerechnet aus EPSG:25832',
  /**
   * Was dieser Abzug nicht enthält. `fee` steht hier nicht, weil die Quelle
   * schweigt — sie tut das Gegenteil —, sondern weil ihr Wert veraltet ist.
   * Die Unterscheidung gehört in die Doku, nicht in dieses Feld.
   */
  absent: ['fee', 'districts', 'poi', 'lowEmissionZone'],
})

// Die Zahlen gehören ins Log, nicht in einen Kommentar: Sie sind das, was beim
// nächsten Abzug anders sein kann, und ein Sprung darin ist das erste, was
// auffällt.
console.log(
  `\n${zoneFeatures.length} von ${zones.length} Gebieten übernommen` +
    ` — ${skippedWithoutAutomat} ohne einen einzigen Automaten`
)
console.log(
  `${assigned} von ${automats.length} Automaten einem Gebiet zugeordnet,` +
    ` ${outsideEveryZone} außerhalb aller Gebiete,` +
    ` ${withoutPosition} ohne brauchbare Koordinate` +
    ` (${(unplacedShare * 100).toFixed(1)} %, Schranke ${MAX_UNPLACED_SHARE * 100} %)`
)
console.log(
  `Gegenprobe Name: ${nameAgrees} von ${assigned} Zuordnungen nennen dasselbe Gebiet` +
    ` in der Spalte "Bezirk/Gebiet"`
)
console.log(`${totalSpaces.toLocaleString('de-DE')} Stellplätze an zugeordneten Automaten`)
