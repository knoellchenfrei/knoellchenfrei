/**
 * Baut Graz' Daten — das achte Gegenstück zu `build-data.ts`.
 *
 * Acht Skripte statt eines mit acht Zweigen, aus demselben Grund wie bei
 * jeder Stadt davor: Die Feeds teilen sich außer dem Wort „Parken" nichts.
 *
 * Was Graz **anders** macht als die sieben Städte davor:
 *
 * - **Kein WFS, sondern ArcGIS.** Die drei Dateien unter `.raw/graz/` kommen
 *   aus `query?…&f=geojson&outSR=4326` und liegen damit schon als GeoJSON in
 *   `[lon, lat]` vor. `assertDegrees` prüft trotzdem: Ohne `outSR` antwortet
 *   der Dienst in MGI / Austria GK M34 (Meter um −67.000 / 215.000), und das
 *   sähe auf der Karte nur nach „leer" aus.
 * - **Zwei Ebenen mit denselben Feldern, zwei Tarife.** Die Blaue Zone
 *   (Kurzparkzonen, 2,60 €/h, höchstens 3 Stunden) und die Grüne Zone
 *   (Parkzonen, 2,00 €/h, unbegrenzt, Tagesticket). Welche Farbe eine Fläche
 *   hat, sagt kein Attribut — nur die Datei, aus der sie kommt. Sie steht
 *   deshalb als `GrazZoneKind` in der `note` jeder Fläche.
 * - **Tarif, Zeiten und Höchstparkdauer stehen je Fläche im Feature** — wie
 *   in Hamburg, ohne Automaten und ohne Zuordnung. `maxStayMinutes` wird
 *   gesetzt, weil es eine Regel der Fläche ist.
 * - **Die Höchstparkdauer steht zweimal** (`PARKDAUER` und `PARK_DAUER` als
 *   Satz) und wird zweimal gelesen; laufen die beiden auseinander, bricht
 *   der Bau ab.
 *
 * Was Graz **nicht** hat: Umweltzone (gibt es in Österreich nicht als
 * Fahrverbotszone), POI, Straßenabschnitte, Stellplatzzahlen. Die Dateien
 * werden trotzdem geschrieben, leer, damit `loadData` alle fünf bekommt.
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

import {
  cityByKey,
  grazDeletedMarker,
  grazZoneKey,
  grazZoneNote,
  isGrazStreetwise,
  multiPolygonContains,
  parseGrazFee,
  parseGrazMaxStay,
  parseGrazMaxStayProse,
  parseGrazSchedule,
  type ChargeWindow,
  type Fee,
  type GrazZoneKind,
  type GrazZoneProperties,
  type PolygonRings,
  type Position,
} from '@knoellchenfrei/core'

import { simplifyGeometry } from './simplify.js'
import { geprueftAm } from './abruf-zeit.js'

/**
 * Die Stadt kommt aus `core/city.ts`, nicht aus einer Kopie hier —
 * Stadtgrenzen stehen im Projekt an genau einer Stelle.
 */
const GRAZ = cityByKey('graz')

const RAW = join(process.env.RAW_DIR ?? join(process.cwd(), '../../.raw'), GRAZ.key)
const OUT = join(process.env.OUT_DIR ?? join(process.cwd(), '../../apps/web/public/data'), GRAZ.key)

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
  // Der Dienst schneidet bei `maxRecordCount` ab und meldet es nur so. Eine
  // halbe Stadt auszuliefern sähe aus wie eine ganze.
  if (parsed.exceededTransferLimit === true) {
    throw new Error(`${key}: exceededTransferLimit — der Abruf ist abgeschnitten`)
  }
  return parsed.features
}

/** Dieselbe Prüfung wie in Frankfurt und München: `outSR=4326` muss gewirkt haben. */
function assertDegrees(key: string, geometry: Geometry): void {
  const walk = (node: unknown): void => {
    if (!Array.isArray(node)) return
    if (typeof node[0] === 'number' && typeof node[1] === 'number') {
      const [lon, lat] = node as number[]
      if (Math.abs(lon as number) > 180 || Math.abs(lat as number) > 90) {
        throw new Error(
          `${key}: ${lon}/${lat} sind keine Grade — der Dienst hat vermutlich in ` +
            'MGI / Austria GK M34 (wkid 31256) geantwortet. outSR=4326 fehlt in der Anfrage.'
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

/** Dasselbe Feld-Schema wie die sieben Städte davor. */
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

console.log('Graz — Daten bauen …')

// ------------------------------------------------------------- Bezirke
//
// Zuerst, weil die Flächen sie brauchen: Der Feed nennt zu einer Fläche
// keinen Bezirk, nur einen Gebietsnamen wie „Lend" — und bei Straßenzügen
// nicht einmal den.

interface District {
  name: string
  rings: PolygonRings[]
}

interface DistrictProperties {
  BEZ_NR?: number | null
  BEZ_NAME?: string | null
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
  const name = (feature.properties.BEZ_NAME ?? '').trim()
  if (name === '') throw new Error(`districts: Bezirk ${String(feature.properties.BEZ_NR)} ohne Namen`)

  // Die Zuordnung läuft gegen die UNvereinfachte Geometrie — vereinfachte
  // Grenzen wandern um ein paar Dutzend Meter, und ein Straßenzug an der
  // Bezirksgrenze bekäme sonst den Nachbarn.
  districtIndex.push({ name, rings: toPolygons(feature.geometry) })

  const simplified = simplifyGeometry(feature.geometry, 1e-4, 5)
  if (simplified === null) continue
  districtFeatures.push({
    type: 'Feature',
    // Graz hat keine Ebene über dem Bezirk; `bezirk` trägt die römische
    // Nummer der Stadt (I. bis XVII.), damit das Feld dieselbe Form hat wie
    // in Hamburg.
    properties: { name, bezirk: `${String(feature.properties.BEZ_NR ?? '?')}. Bezirk` },
    geometry: simplified,
  })
}

write('districts.geojson', { type: 'FeatureCollection', features: districtFeatures })

function districtAt(point: Position | null): District | null {
  if (point === null) return null
  return districtIndex.find((district) => multiPolygonContains(district.rings, point)) ?? null
}

// ------------------------------------------------------------- Flächen

const zoneFeatures: { type: 'Feature'; properties: ZoneOut; geometry: Geometry }[] = []
const counts = { deleted: 0, withoutDistrict: 0, streetwise: 0, areawide: 0 }
const schedules = new Map<string, number>()
const fees = new Map<string, number>()
const stays = new Map<string, number>()

function count(map: Map<string, number>, key: string): void {
  map.set(key, (map.get(key) ?? 0) + 1)
}

/**
 * Baut die Flächen einer Ebene — beide Ebenen gehen durch dieselbe
 * Funktion, weil sie dieselben Felder tragen; nur die `kind` unterscheidet
 * sie, und die steht in der `note`.
 */
function buildLayer(key: string, kind: GrazZoneKind): void {
  const features = readCollection<GrazZoneProperties>(key)

  // **Flächendeckende Gebiete zuerst, Straßenzüge zuletzt.** Zehn der 69
  // blauen Straßenzüge liegen innerhalb eines flächendeckenden Gebiets. Die
  // Reihenfolge entscheidet zweimal: `zoneAt` nimmt die erste Fläche, die den
  // Punkt enthält (das Gebiet); die Karte zeichnet die spätere obenauf und
  // der Klick trifft sie (den Streifen). Beide Antworten sind richtig, weil
  // alle zehn dieselbe Zeit, dieselbe Gebühr und dieselbe Höchstparkdauer
  // tragen — nachgemessen am 16. September 2026, nur der Schlüssel weicht
  // dreimal ab (Streifen „07" im Gebiet „06 Münzgraben"). Der Streifen oben
  // ist die genauere Auskunft für den, der ihn antippt.
  const ordered = [...features].sort((a, b) => Number(isGrazStreetwise(a.properties)) - Number(isGrazStreetwise(b.properties)))

  for (const feature of ordered) {
    const p = feature.properties
    if (grazDeletedMarker(p) !== null) {
      counts.deleted += 1
      continue
    }
    if (feature.geometry === null) continue
    assertDegrees(key, feature.geometry)

    const rawHours = (p.GELTUNGSZEIT ?? '').replace(/\s+/g, ' ').trim()
    const rawFee = (p.PARK_GEBUEHR ?? '').replace(/\s+/g, ' ').trim()
    if (rawHours === '') {
      // Kommt heute nicht vor. Käme es vor, wäre ein Polygon ohne Antwort
      // schlechter als kein Polygon — wie in Hamburg.
      throw new Error(`${key}: Fläche ${String(p.OBJECTID)} ohne GELTUNGSZEIT`)
    }
    count(schedules, rawHours)
    count(fees, rawFee)
    count(stays, `${(p.PARKDAUER ?? '').trim()} | ${(p.PARK_DAUER ?? '').trim()}`)

    const maxStay = parseGrazMaxStay(p.PARKDAUER)
    const maxStayProse = parseGrazMaxStayProse(p.PARK_DAUER)
    if (maxStay !== maxStayProse) {
      throw new Error(
        `${key}: Fläche ${String(p.OBJECTID)} nennt PARKDAUER ${String(maxStay)} und PARK_DAUER ${String(maxStayProse)}`
      )
    }
    const tariff = parseGrazFee(p.PARK_GEBUEHR)
    // Die Obergrenze der Blauen Zone (7,80 €) ist die für drei Stunden; bei
    // 90 und 60 Minuten steht derselbe Satz. Sie darf nie unter dem liegen,
    // was die Höchstparkdauer zum Stundensatz kostet — sonst wäre der
    // Stundensatz falsch gelesen.
    if (tariff.maxTotalCents !== null && maxStay !== undefined && tariff.fee.kind === 'exact') {
      const forMaxStay = (tariff.fee.centsPerHour * maxStay) / 60
      if (forMaxStay > tariff.maxTotalCents) {
        throw new Error(`${key}: ${maxStay} min zu ${tariff.fee.centsPerHour} ct/h übersteigen die Obergrenze ${tariff.maxTotalCents}`)
      }
    }

    const district = districtAt(centroid(feature.geometry))
    if (district === null) counts.withoutDistrict += 1
    if (isGrazStreetwise(p)) counts.streetwise += 1
    else counts.areawide += 1

    const simplified = simplifyGeometry(feature.geometry, 1e-5, 5)
    if (simplified === null) continue

    zoneFeatures.push({
      type: 'Feature',
      properties: {
        zone: grazZoneKey(p),
        district: district?.name ?? GRAZ.name,
        rawHours,
        rawFee,
        note: grazZoneNote(kind, p, tariff),
        windows: parseGrazSchedule(rawHours),
        fee: tariff.fee,
        unmodelledRules: [],
        sourceDefect: null,
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
}

buildLayer('kurzparkzonen', 'kurzparkzone')
buildLayer('parkzonen', 'parkzone')

write('zones.geojson', { type: 'FeatureCollection', features: zoneFeatures })

// Zwei leere Sammlungen, damit `loadData` alle fünf Dateien bekommt.
write('poi.geojson', { type: 'FeatureCollection', features: [] })
write('umweltzone.geojson', { type: 'FeatureCollection', features: [] })

write('meta.json', {
  city: GRAZ.key,
  cityName: GRAZ.name,
  source: `${GRAZ.attribution.source}, ArcGIS FeatureServer`,
  licence: GRAZ.attribution.licence,
  licenceUrl: GRAZ.attribution.licenceUrl,
  attributionRequired: GRAZ.attribution.attributionRequired,
  datasetUrl: GRAZ.attribution.datasetUrl,
  geprueftAm: geprueftAm(RAW),
  zones: zoneFeatures.length,
  districts: districtFeatures.length,
  poi: 0,
  lowEmissionZone: false,
  segments: 0,
  managedSpaces: 0,
  crs: 'EPSG:4326 (lon/lat)',
  absent: ['poi', 'umweltzone', 'segments'],
})

// Die Zahlen gehören ins Log: Sie sind das, was beim nächsten Abzug anders
// sein kann, und eine neue Schreibweise ist das erste, was auffällt.
console.log(
  `\n${zoneFeatures.length} Flächen (${counts.areawide} flächendeckend, ${counts.streetwise} straßenzugsweise), ` +
    `${districtFeatures.length} Bezirke — ${counts.deleted} mit Löschvermerk ausgelassen, ` +
    `${counts.withoutDistrict} ohne Bezirks-Treffer`
)
const list = (map: Map<string, number>): string =>
  [...map.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([text, n]) => `  ${n}× ${text}`)
    .join('\n')
console.log(`Zeiten:\n${list(schedules)}`)
console.log(`Gebühren:\n${list(fees)}`)
console.log(`Höchstparkdauer:\n${list(stays)}`)
