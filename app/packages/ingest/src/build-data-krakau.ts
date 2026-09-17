/**
 * Baut Krakaus Daten — das erste Gegenstück zu `build-data.ts` für eine
 * Stadt der Klasse C: Die Quelle nennt Zonengrenzen und sonst nichts.
 *
 * Was Krakau **anders** macht als die Städte davor:
 *
 * - **Keine Zeiten, kein Tarif.** Kein Feld des Feeds sagt, wann kassiert
 *   wird oder wie viel. Beides steht in der Uchwała der Stadt und auf den
 *   Seiten des ZDMK — in Złoty, mit Handelssonntagen und einem Rabatt für
 *   die Karta Krakowska, alles Dinge, die das Modell nicht ausdrückt.
 *   Deshalb steht hier nichts davon: jede Zone trägt `scheduleUnknown: true`
 *   und `fee: { kind: 'unknown' }`, `meta.absent` führt `schedule` und
 *   `fee`, und die App sagt „Zeiten unbekannt" statt „frei".
 * - **Drei Ebenen für eine Aussage.** Die Flächen kommen aus
 *   `Granice_Stref_2026` (23), der Ebene der amtlichen ZDMK-Karte. Die
 *   Erweiterung vom 10. August 2026 (4 Polygone) sagt, welche davon neu
 *   oder erweitert sind — als Satz unter der Zone. Der als „Dane Otwarte"
 *   beschriebene Datensatz (Ebene 37, 26 Polygone, Stand Dezember 2024)
 *   dient nur der Gegenprobe: Er führt sechs geplante Sektoren mit Präfix
 *   `n`, von denen zwei (32, 33) noch nicht gelten. Was er anders sagt als
 *   die Karte, steht im Log, nicht in den Daten.
 * - **Ein Datum entscheidet, ob ein Sektor gilt.** Steht in der Bemerkung
 *   „Od 10 sierpnia 2026" ein Tag in der Zukunft, wird die Fläche nicht
 *   ausgeliefert — der tägliche Datenbau holt sie am Stichtag von selbst.
 *
 * Was Krakau **nicht** hat: POI, Umweltzone (die Strefa Czystego Transportu
 * ist eine andere Sache und eine andere Ebene), Straßenabschnitte,
 * Stellplatzzahlen. Die Dateien werden trotzdem geschrieben, leer.
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

import {
  areaSquareMetres,
  cityByKey,
  krakauNote,
  krakauSektor,
  krakauZoneKey,
  krakauZoneNote,
  multiPolygonContains,
  type ChargeWindow,
  type Fee,
  type KrakauGranicaProperties,
  type KrakauSektorProperties,
  type PolygonRings,
  type Position,
} from '@knoellchenfrei/core'

import { simplifyGeometry } from './simplify.js'
import { geprueftAm } from './abruf-zeit.js'

/** Die Stadt kommt aus `core/city.ts` — Stadtgrenzen stehen genau einmal. */
const KRAKAU = cityByKey('krakau')

const RAW = join(process.env.RAW_DIR ?? join(process.cwd(), '../../.raw'), KRAKAU.key)
const OUT = join(process.env.OUT_DIR ?? join(process.cwd(), '../../apps/web/public/data'), KRAKAU.key)

/**
 * Der Stichtag: Ein Sektor mit einem Datum nach heute gilt noch nicht. Aus
 * der Umgebung lesbar, damit ein Test den Bau auf einen Tag vor dem
 * 10. August 2026 stellen kann.
 */
const HEUTE = process.env.KRAKAU_STICHTAG ?? new Date().toISOString().slice(0, 10)

interface Geometry {
  type: string
  coordinates: unknown
}

interface Feature<P> {
  id?: string | number
  properties: P
  geometry: Geometry | null
}

interface Collection<P> {
  features: Feature<P>[]
  exceededTransferLimit?: boolean
}

function readCollection<P>(key: string): Feature<P>[] {
  const parsed = JSON.parse(readFileSync(join(RAW, `${key}.json`), 'utf8')) as Collection<P>
  // Der Dienst schneidet bei `maxRecordCount` ab und meldet es nur so.
  if (parsed.exceededTransferLimit === true) {
    throw new Error(`${key}: exceededTransferLimit — der Abruf ist abgeschnitten`)
  }
  return parsed.features
}

/** Dieselbe Prüfung wie in Graz und Innsbruck: `outSR=4326` muss gewirkt haben. */
function assertDegrees(key: string, geometry: Geometry): void {
  const walk = (node: unknown): void => {
    if (!Array.isArray(node)) return
    if (typeof node[0] === 'number' && typeof node[1] === 'number') {
      const [lon, lat] = node as number[]
      if (Math.abs(lon as number) > 180 || Math.abs(lat as number) > 90) {
        throw new Error(
          `${key}: ${lon}/${lat} sind keine Grade — der Dienst hat vermutlich in ` +
            'PUWG 1992 (wkid 2180, Meter um 565.000 / 243.000) geantwortet. outSR=4326 fehlt in der Anfrage.'
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

/** Mittelpunkt aller Stützpunkte — reicht, um einen Bezirk zu treffen. */
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

/** Dasselbe Feld-Schema wie alle Städte davor, plus die Marke der Klasse C. */
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

console.log(`Krakau — Daten bauen … (Stichtag ${HEUTE})`)

// ------------------------------------------------------------- Bezirke
//
// Zuerst, weil die Flächen sie brauchen: Der Feed nennt zu einem Sektor
// keinen Bezirk. Die 18 Dzielnice kommen aus dem ISDP der Stadt über
// denselben ArcGIS-Host.

interface District {
  name: string
  rings: PolygonRings[]
}

interface DistrictProperties {
  NR_DZIELNI?: string | null
  NAZWA?: string | null
  NAZWA_PELN?: string | null
}

const districtFeatures: {
  type: 'Feature'
  properties: { name: string; bezirk: string }
  geometry: Geometry
}[] = []
const districtIndex: District[] = []

for (const feature of readCollection<DistrictProperties>('districts')) {
  if (feature.geometry === null) continue
  assertDegrees('districts', feature.geometry)
  const name = (feature.properties.NAZWA ?? '').trim()
  const nr = (feature.properties.NR_DZIELNI ?? '').trim()
  if (name === '' || nr === '') {
    throw new Error(`districts: Dzielnica ohne Namen oder Nummer (${JSON.stringify(feature.properties)})`)
  }

  // Die Zuordnung läuft gegen die UNvereinfachte Geometrie — vereinfachte
  // Grenzen wandern um ein paar Dutzend Meter.
  districtIndex.push({ name, rings: toPolygons(feature.geometry) })

  const simplified = simplifyGeometry(feature.geometry, 1e-4, 5)
  if (simplified === null) continue
  districtFeatures.push({
    type: 'Feature',
    // Krakau hat keine Ebene über der Dzielnica; `bezirk` trägt die
    // römische Nummer („Dzielnica I"), damit das Feld dieselbe Form hat wie
    // in Hamburg und Graz. Der Name bleibt polnisch — er ist ein Name.
    properties: { name, bezirk: `Dzielnica ${nr}` },
    geometry: simplified,
  })
}

if (districtFeatures.length !== 18) {
  throw new Error(`districts: ${districtFeatures.length} statt 18 Dzielnice — die Ebene hat sich geändert`)
}

write('districts.geojson', { type: 'FeatureCollection', features: districtFeatures })

function districtAt(point: Position | null): District | null {
  if (point === null) return null
  return districtIndex.find((district) => multiPolygonContains(district.rings, point)) ?? null
}

// ------------------------------------------------------------- Gegenprobe
//
// Die Ebene 37 ist der beschriebene Datensatz, aber nicht die Karte: Ihr
// Datenstand ist der 9. Dezember 2024, und die Erweiterung vom August 2026
// steht dort nur als Entwurf mit Präfix `n`. Gezählt wird, was sie kennt.

const sektoren = { regular: new Set<string>(), planned: new Set<string>() }
for (const feature of readCollection<KrakauSektorProperties>('sectors')) {
  const sektor = krakauSektor(feature.properties)
  ;(sektor.planned ? sektoren.planned : sektoren.regular).add(krakauZoneKey(sektor))
}

// ------------------------------------------------------------- Erweiterung
//
// Vier Polygone mit dem Datum, ab dem sie gelten. Je Schlüssel das Datum
// und die Fläche — an der Fläche entscheidet sich unten, ob der Sektor neu
// ist oder nur gewachsen.

const erweiterung = new Map<string, { since: string; area: number }>()
for (const feature of readCollection<KrakauGranicaProperties>('extension')) {
  if (feature.geometry === null) continue
  assertDegrees('extension', feature.geometry)
  const sektor = krakauSektor(feature.properties)
  const since = krakauNote(feature.properties.Uwagi)
  if (since === null) {
    // Die Ebene heißt „Poszerzenie OPP od 10.08.2026"; ein Polygon ohne
    // Datum darin wäre eine Fläche, von der niemand weiß, seit wann sie gilt.
    throw new Error(`extension: Sektor ${krakauZoneKey(sektor)} ohne Datum in Uwagi`)
  }
  const key = krakauZoneKey(sektor)
  if (erweiterung.has(key)) throw new Error(`extension: Sektor ${key} steht zweimal`)
  erweiterung.set(key, { since, area: areaSquareMetres(toPolygons(feature.geometry)) })
}

// ------------------------------------------------------------- Flächen

const zoneFeatures: { type: 'Feature'; properties: ZoneOut; geometry: Geometry }[] = []
const counts = { planned: 0, future: 0, withoutDistrict: 0, neu: 0, erweitert: 0, unbekannt: 0 }
const podstrefy = new Map<string, number>()

function count(map: Map<string, number>, key: string): void {
  map.set(key, (map.get(key) ?? 0) + 1)
}

for (const feature of readCollection<KrakauGranicaProperties>('zones')) {
  if (feature.geometry === null) continue
  assertDegrees('zones', feature.geometry)
  const sektor = krakauSektor(feature.properties)
  const key = krakauZoneKey(sektor)
  if (sektor.planned) {
    counts.planned += 1
    continue
  }

  // Eine Bemerkung an der Grenze selbst wäre ein Datum; heute steht dort
  // nur ein Leerzeichen. Die Erweiterungsebene ist die Quelle des Datums.
  const eigenesDatum = krakauNote(feature.properties.Uwagi)
  const ext = erweiterung.get(key)
  const since = ext?.since ?? eigenesDatum
  // Neu oder erweitert: Ist die Fläche der Grenze deutlich größer als das
  // Stück in der Erweiterung, gab es den Sektor schon (B30: 75 zu 54
  // Hektar, Błonia kam dazu). Sonst ist das Stück der ganze Sektor.
  const extended = ext !== undefined && areaSquareMetres(toPolygons(feature.geometry)) > ext.area * 1.02
  if (since !== null && since > HEUTE) {
    // Ein erweiterter Sektor gab es vorher schon — aber die Ebene führt nur
    // die vereinigte Fläche, und die alte Grenze steht nirgends. Lieber
    // einen Sektor zu wenig als eine Fläche, die noch nicht kassiert.
    counts.future += 1
    console.log(
      `  Sektor ${key} gilt ${extended ? 'in seiner erweiterten Form' : ''} erst ab ${since} — nicht ausgeliefert`
        .replace(/\s+/g, ' ')
    )
    continue
  }
  if (ext !== undefined) counts[extended ? 'erweitert' : 'neu'] += 1
  if (!sektoren.regular.has(key) && !sektoren.planned.has(key)) counts.unbekannt += 1

  count(podstrefy, sektor.podstrefa)
  const district = districtAt(centroid(feature.geometry))
  if (district === null) counts.withoutDistrict += 1

  const simplified = simplifyGeometry(feature.geometry, 1e-5, 5)
  if (simplified === null) continue

  zoneFeatures.push({
    type: 'Feature',
    properties: {
      zone: key,
      district: district?.name ?? KRAKAU.name,
      // Leer, nicht erfunden: Die Quelle nennt weder Zeiten noch Betrag.
      rawHours: '',
      rawFee: '',
      note: krakauZoneNote(sektor, since, extended),
      windows: [],
      fee: { kind: 'unknown' },
      unmodelledRules: [],
      sourceDefect: null,
      scheduleUnknown: true,
      spaces: null,
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

if (zoneFeatures.length === 0) throw new Error('zones: keine einzige Fläche gebaut')

write('zones.geojson', { type: 'FeatureCollection', features: zoneFeatures })

// Zwei leere Sammlungen, damit `loadData` alle fünf Dateien bekommt.
write('poi.geojson', { type: 'FeatureCollection', features: [] })
write('umweltzone.geojson', { type: 'FeatureCollection', features: [] })

write('meta.json', {
  city: KRAKAU.key,
  cityName: KRAKAU.name,
  source: `${KRAKAU.attribution.source}, ArcGIS FeatureServer`,
  licence: KRAKAU.attribution.licence,
  licenceUrl: KRAKAU.attribution.licenceUrl,
  attributionRequired: KRAKAU.attribution.attributionRequired,
  datasetUrl: KRAKAU.attribution.datasetUrl,
  geprueftAm: geprueftAm(RAW),
  zones: zoneFeatures.length,
  districts: districtFeatures.length,
  poi: 0,
  lowEmissionZone: false,
  segments: 0,
  managedSpaces: 0,
  crs: 'EPSG:4326 (lon/lat)',
  // `schedule` und `fee` zuerst: Das ist die Aussage dieser Stadt.
  absent: ['schedule', 'fee', 'poi', 'umweltzone', 'segments'],
})

// Die Zahlen gehören ins Log: Sie sind das, was beim nächsten Abzug anders
// sein kann — und die Gegenprobe gegen die Ebene 37 steht nur hier.
const geplantNichtAusgeliefert = [...sektoren.planned]
  .filter((key) => !zoneFeatures.some((feature) => feature.properties.zone === key))
  .sort()
console.log(
  `\n${zoneFeatures.length} Sektoren (${[...podstrefy.entries()]
    .sort()
    .map(([p, n]) => `${n}× Podstrefa ${p}`)
    .join(', ')}), ${districtFeatures.length} Dzielnice — ` +
    `${counts.neu} neu und ${counts.erweitert} erweitert seit der Erweiterung, ` +
    `${counts.planned} geplante und ${counts.future} künftige ausgelassen, ` +
    `${counts.withoutDistrict} ohne Bezirks-Treffer`
)
console.log(
  `Gegenprobe Ebene 37: ${sektoren.regular.size} geltende und ${sektoren.planned.size} geplante Sektoren; ` +
    `${counts.unbekannt} Sektoren der Karte kennt sie nicht; ` +
    `geplant und nicht ausgeliefert: ${geplantNichtAusgeliefert.join(', ') || 'keiner'}`
)
