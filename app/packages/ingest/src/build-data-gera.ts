/**
 * Baut Geras Daten — Klasse C wie Kassel und Essen, mit einer Eigenheit,
 * die keine der Städte davor hatte: **Fläche und Straße liegen in einer
 * Ebene.**
 *
 * `gera:geom_portal_anwohnerparken` liefert 148 Features: zehn `Polygon`
 * (je Zonenbuchstabe eine Fläche, dazu die geteilte `C/G`) und 138
 * `LineString` (die Straßenabschnitte darin). Die Recherche vom
 * 16. September hatte „148 Linien" gelesen und die Frage aufgeworfen, ob
 * man sie zu Bändern puffern muss, wie Wiens Geschäftsstraßen. Die Messung
 * vom 17. September sagt nein: Von 138 Linien liegen 128 ganz in der Fläche
 * ihres Buchstabens, keine weiter als 4,8 m davon entfernt. Die Flächen
 * **sind** die Zonen; die Linien werden zur Straßenliste im `note`. Was
 * bleibt, ist die Wache darüber: Läuft eine Linie mehr als
 * `LINE_TOLERANCE_METRES` von ihrer Fläche weg, decken die Flächen die
 * Zonen nicht mehr, und der Bau bricht ab, statt eine Straße stumm zu
 * verlieren — dann wäre der Tag, an dem `linien-puffer.ts` doch gebraucht
 * wird.
 *
 * Was Gera sonst anders macht:
 *
 * - **Keine Zeiten, kein Betrag.** Jede Zone geht mit `scheduleUnknown:
 *   true`, `windows: []`, `fee: { kind: 'unknown' }` hinaus; `meta.absent`
 *   führt `schedule` und `fee`. Die Gebührenordnung der Stadt ist ein PDF
 *   im Ortsrecht — `docs/staedte-gera.md`.
 * - **`srsName` wirkt, und ohne ihn kommt EPSG:25833.** `assertDegrees`
 *   misst nach, `assertInGera` dazu: Gedreht läge die Innenstadt bei
 *   12° Nord, 51° Ost — im Tschad, mit gültigen Graden.
 * - **Der Buchstabe ist der Schlüssel**, und eine Fläche gehört zu zwei
 *   Zonen (`C/G`). Sie bleibt eine eigene Zone mit dem Schlüssel `C/G`, so
 *   wie die Quelle und die Stadtseite („Zone C und G") sie führen; Linien
 *   mit `C` oder `G` dürfen in ihr liegen.
 *
 * Was Gera hat: 27 Ortsteile und 12 Behindertenparkplätze aus demselben
 * Dienst. Was es nicht hat: eine Umweltzone (die Stadt hat keine),
 * Straßenabschnitte mit Regeln. Die Dateien werden trotzdem geschrieben,
 * leer — `loadData` holt alle fünf.
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

import {
  cityByKey,
  distanceToPolygonMetres,
  GeraParseError,
  geraZoneName,
  multiPolygonContains,
  parseGeraAccessible,
  parseGeraInfostring,
  parseGeraZoneKey,
  type ChargeWindow,
  type Fee,
  type GeraAccessibleProperties,
  type GeraZoneKey,
  type GeraZoneProperties,
  type PolygonRings,
  type Position,
} from '@knoellchenfrei/core'

import { simplifyGeometry } from './simplify.js'
import { geprueftAm } from './abruf-zeit.js'

/** Die Stadt aus `core/city.ts`, nicht als Kopie hier — die Grenzen stehen genau einmal. */
const GERA = cityByKey('gera')

const RAW = join(process.env.RAW_DIR ?? join(process.cwd(), '../../.raw'), GERA.key)
const OUT = join(
  process.env.OUT_DIR ?? join(process.cwd(), '../../apps/web/public/data'),
  GERA.key
)

/**
 * Wie weit ein Stützpunkt einer Straßenlinie von der Fläche seiner Zone
 * entfernt liegen darf. Gemessen am 17. September: höchstens 4,8 m
 * (Schillerstraße, Zone C), 128 von 138 Linien bei 0 m. Zwölf Meter sind
 * die halbe Bandbreite aus Wien — eine Linie, die weiter wegläuft, gehört
 * zu einer Fläche, die es nicht gibt.
 */
const LINE_TOLERANCE_METRES = 12

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
}

/** Die Dateinamen kommen aus `fetch.ts`: `<key>.json` je Quelle in `sources.ts`. */
function readFeatures<P>(file: string): Feature<P>[] {
  const parsed = JSON.parse(readFileSync(join(RAW, file), 'utf8')) as Collection<P>
  if (!Array.isArray(parsed.features)) throw new Error(`${file}: keine FeatureCollection`)
  return parsed.features
}

/**
 * Grade oder nichts.
 *
 * Ohne `srsName` antwortet der GeoServer in EPSG:25833 — `[295415.59,
 * 5640369.99]`, plausible Zahlen, keine Grade, auf der Karte nur leer.
 * `wfsUrl` setzt den Parameter; sollte der Dienst ihn eines Tages
 * ignorieren, bricht der Bau hier ab.
 */
function assertDegrees(key: string, geometry: Geometry): void {
  const walk = (node: unknown): void => {
    if (!Array.isArray(node)) return
    if (typeof node[0] === 'number' && typeof node[1] === 'number') {
      const [lon, lat] = node as number[]
      if (Math.abs(lon as number) > 180 || Math.abs(lat as number) > 90) {
        throw new Error(
          `${key}: ${lon}/${lat} sind keine Grade — der Dienst hat srsName ignoriert und in EPSG:25833 geantwortet`
        )
      }
      return
    }
    node.forEach(walk)
  }
  walk(geometry.coordinates)
}

/**
 * Bricht ab, wenn ein Punkt außerhalb Geras liegt — der Test auf die
 * Achsenreihenfolge. Die Ortsteile reichen bis an die Stadtgrenze und
 * werden gegen `sessionBounds` geprüft; Zonen und Parkplätze müssen im
 * Melderahmen liegen, denn eine Zone, in der niemand melden kann, wäre auf
 * der Karte ein stummer Fleck.
 */
function assertInGera(key: string, geometry: Geometry, frame: 'report' | 'session'): void {
  const b = frame === 'report' ? GERA.reportBounds : GERA.sessionBounds
  const walk = (node: unknown): void => {
    if (!Array.isArray(node)) return
    if (typeof node[0] === 'number' && typeof node[1] === 'number') {
      const [lon, lat] = node as [number, number]
      if (lon < b.minLon || lon > b.maxLon || lat < b.minLat || lat > b.maxLat) {
        throw new Error(
          `${key}: ${lon}/${lat} liegt nicht in Gera (${frame}) — Achsenreihenfolge oder Rahmen in core/city.ts prüfen`
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

/**
 * Nur die eigene Fehlerklasse wird in eine Meldung mit der Zeilennummer
 * übersetzt; alles andere ist ein kaputter Parser und fliegt unverändert.
 */
function parsed<T>(what: string, mslink: unknown, read: () => T): T {
  try {
    return read()
  } catch (error) {
    if (!(error instanceof GeraParseError)) throw error
    throw new Error(`${what}: mslink ${String(mslink)}: ${error.message}`, { cause: error })
  }
}

console.log('Gera — Daten bauen …')

// -------------------------------------------------------------- Ortsteile
//
// Zuerst, weil die Zonen sie brauchen: „Zone K" sagt niemandem, wo das ist.
// Der Ortsteil (Zentrum Süd, Ostviertel) ist die Ebene, in der Suche und
// Kopfzeile des Panels denken.

interface District {
  name: string
  rings: PolygonRings[]
}

/** Die Felder der Ortsteil-Ebene, so weit sie hier gelesen werden. */
interface DistrictProperties {
  mslink?: number | null
  /** Der Name, z. B. `Zentrum Süd` oder `Ostviertel, Leumnitz und Südhang`. */
  ortsteil?: string | null
}

const districtFeatures: { type: 'Feature'; properties: { name: string }; geometry: Geometry }[] = []
const districtIndex: District[] = []

for (const feature of readFeatures<DistrictProperties>('districts.json')) {
  const geometry = feature.geometry
  if (geometry === null) continue
  assertDegrees('districts', geometry)
  assertInGera('districts', geometry, 'session')
  const name = (feature.properties.ortsteil ?? '').replace(/\s+/g, ' ').trim()
  if (name === '') throw new Error(`districts: Ortsteil mslink ${String(feature.properties.mslink)} ohne Namen`)

  // Die Zuordnung läuft gegen die UNvereinfachte Geometrie; vereinfachte
  // Grenzen wandern um ein paar Dutzend Meter, und eine Zone an der
  // Ortsteilgrenze bekäme sonst den Nachbarn zugeschrieben.
  districtIndex.push({ name, rings: toPolygons(geometry) })

  // Anzeigeebene, deshalb zwei Größenordnungen gröber als die Zonen: 12.796
  // Stützpunkte für 27 Ortsteile, das Ergebnis passt in den Vorrat des
  // Service Workers.
  const simplified = simplifyGeometry(geometry, 1e-4, 5)
  if (simplified === null) continue
  districtFeatures.push({ type: 'Feature', properties: { name }, geometry: simplified })
}

write('districts.geojson', { type: 'FeatureCollection', features: districtFeatures })

function districtAt(point: Position | null): District | null {
  if (point === null) return null
  return districtIndex.find((district) => multiPolygonContains(district.rings, point)) ?? null
}

// ------------------------------------------------------------------ Zonen

/**
 * Dasselbe Feld-Schema wie in allen anderen Städten — ein Typ, ein Panel —
 * plus `scheduleUnknown`, die Marke der Klasse C (`ZoneProperties` in
 * `apps/web/src/types.ts`).
 */
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

interface Area {
  key: GeraZoneKey
  name: string
  mslink: unknown
  geometry: Geometry
  rings: PolygonRings[]
  streets: Set<string>
}

const rawZones = readFeatures<GeraZoneProperties>('zones.json')
const areas = new Map<string, Area>()
const lines: { key: GeraZoneKey; name: string; mslink: unknown; points: Position[] }[] = []
let otherGeometry = 0

// Erster Durchgang: Flächen und Linien trennen, beide lesen. Die Flächen
// müssen vollständig sein, bevor eine Linie gegen sie gemessen wird.
for (const feature of rawZones) {
  const geometry = feature.geometry
  if (geometry === null) continue
  assertDegrees('zones', geometry)
  assertInGera('zones', geometry, 'report')
  const mslink = feature.properties.mslink
  const key = parsed('zones', mslink, () => parseGeraZoneKey(feature.properties.anwohnerparkzone))
  const info = parsed('zones', mslink, () => parseGeraInfostring(feature.properties.infostring))
  // Der Buchstabe vorn im Infotext und das Feld müssen dasselbe sagen — ein
  // Feed, in dem „E - Schuhgasse" in Zone K steht, hat einen Fehler, den nur
  // dieser Vergleich sieht.
  if (info.zone.key !== key.key) {
    throw new Error(`zones: mslink ${String(mslink)}: Infotext nennt Zone ${info.zone.key}, das Feld ${key.key}`)
  }

  if (geometry.type === 'Polygon' || geometry.type === 'MultiPolygon') {
    // Nicht auslassen, sondern abbrechen: Zwei Flächen mit demselben
    // Buchstaben wären auf der Statistikseite eine Zone und auf der Karte
    // zwei — und die Quelle hat heute genau eine je Buchstabe.
    if (areas.has(key.key)) throw new Error(`zones: Zone ${key.key} hat zwei Flächen (mslink ${String(mslink)})`)
    areas.set(key.key, { key, name: info.name, mslink, geometry, rings: toPolygons(geometry), streets: new Set() })
  } else if (geometry.type === 'LineString') {
    lines.push({ key, name: info.name, mslink, points: geometry.coordinates as Position[] })
  } else {
    otherGeometry += 1
  }
}

if (otherGeometry > 0) throw new Error(`zones: ${otherGeometry} Features, die weder Fläche noch Linie sind`)
if (areas.size === 0) throw new Error('zones: keine einzige Fläche — die Ebene hat nur noch Linien; jetzt bräuchte es linien-puffer.ts')

/** Die Flächen, in denen eine Linie mit diesem Buchstaben liegen darf: die eigene und jede geteilte, die ihn führt. */
function areasFor(key: GeraZoneKey): Area[] {
  return [...areas.values()].filter((area) => key.letters.some((letter) => area.key.letters.includes(letter)))
}

// Zweiter Durchgang: Jede Linie gehört in ihre Fläche — oder der Bau bricht ab.
let farthest = 0
for (const line of lines) {
  const candidates = areasFor(line.key)
  if (candidates.length === 0) {
    throw new Error(`zones: Linie „${line.key.key} - ${line.name}" (mslink ${String(line.mslink)}) hat keine Fläche`)
  }
  const rings = candidates.flatMap((area) => area.rings)
  for (const point of line.points) {
    const distance = distanceToPolygonMetres(rings, point)
    if (distance > farthest) farthest = distance
    if (distance > LINE_TOLERANCE_METRES) {
      throw new Error(
        `zones: Linie „${line.key.key} - ${line.name}" (mslink ${String(line.mslink)}) liegt ${distance.toFixed(1)} m ` +
          `außerhalb ihrer Fläche — mehr als ${LINE_TOLERANCE_METRES} m; die Flächen decken die Zonen nicht mehr`
      )
    }
  }
  // Die Straße steht bei jeder Fläche, zu der ihr Buchstabe gehört — die
  // geteilte Fläche C/G führt also die Straßen von C und von G nicht mit,
  // sondern nur, was ihr selbst zugeschrieben ist: Linien mit `C/G` gibt es
  // im Abzug keine, und eine Straße der Zone C ist keine Straße von C/G.
  const own = areas.get(line.key.key)
  if (own !== undefined) own.streets.add(line.name)
}

const zoneFeatures: { type: 'Feature'; properties: ZoneOut; geometry: Geometry }[] = []
let withoutDistrict = 0

for (const area of [...areas.values()].sort((a, b) => a.key.key.localeCompare(b.key.key))) {
  const district = districtAt(centroid(area.geometry))
  if (district === null) withoutDistrict += 1

  const simplified = simplifyGeometry(area.geometry, 1e-5, 5)
  if (simplified === null) continue

  const streets = [...area.streets].sort((a, b) => a.localeCompare(b, 'de'))
  zoneFeatures.push({
    type: 'Feature',
    properties: {
      zone: area.key.key,
      district: district?.name ?? GERA.name,
      // Leer, nicht erfunden: Es gibt keinen Rohtext, den das Panel zitieren
      // könnte. Die Sätze dazu kommen aus `scheduleUnknown`.
      rawHours: '',
      rawFee: '',
      // Das eine, was die Quelle über die Zone sagt: ihren Namen und ihre
      // Straßen. Die Liste ist die Straßenlinien-Ebene, sonst ginge sie verloren.
      note:
        streets.length === 0
          ? `Bewohnerpark${geraZoneName(area.key, area.name).replace(/^Zone/, 'zone')}`
          : `Bewohnerpark${geraZoneName(area.key, area.name).replace(/^Zone/, 'zone')}. ` +
            `Straßen laut Quelle: ${streets.join(', ')}`,
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

write('zones.geojson', { type: 'FeatureCollection', features: zoneFeatures })

// -------------------------------------------------- Behindertenparkplätze

const poiFeatures: {
  type: 'Feature'
  properties: { kind: 'accessible'; label: string; detail: string }
  geometry: Geometry
}[] = []

for (const feature of readFeatures<GeraAccessibleProperties>('accessible.json')) {
  const geometry = feature.geometry
  if (geometry === null) continue
  if (geometry.type !== 'Point') throw new Error(`accessible: mslink ${String(feature.properties.mslink)} ist kein Punkt`)
  assertDegrees('accessible', geometry)
  assertInGera('accessible', geometry, 'report')
  const place = parsed('accessible', feature.properties.mslink, () => parseGeraAccessible(feature.properties.infostring))
  const [lon, lat] = geometry.coordinates as [number, number]
  poiFeatures.push({
    type: 'Feature',
    properties: {
      kind: 'accessible',
      label: place.label,
      detail: place.spaces === 1 ? '1 Platz' : `${place.spaces} Plätze`,
    },
    geometry: { type: 'Point', coordinates: [Math.round(lon * 1e5) / 1e5, Math.round(lat * 1e5) / 1e5] },
  })
}

write('poi.geojson', { type: 'FeatureCollection', features: poiFeatures })

// ------------------------------------------------------- was es nicht gibt

// Leere Sammlung statt fehlender Datei: `loadData` holt für jede Stadt
// dieselben fünf Namen, und ein 404 wäre von einem echten Ladefehler nicht zu
// unterscheiden. `meta.json` sagt, dass die Leere Absicht ist.
write('umweltzone.geojson', { type: 'FeatureCollection', features: [] })

write('meta.json', {
  city: GERA.key,
  cityName: GERA.name,
  source: `${GERA.attribution.source}, GeoServer-WFS 2.0.0`,
  licence: GERA.attribution.licence,
  licenceUrl: GERA.attribution.licenceUrl,
  attributionRequired: GERA.attribution.attributionRequired,
  datasetUrl: GERA.attribution.datasetUrl,
  // Wann die Quelle zuletzt erfolgreich abgerufen wurde — siehe abruf-zeit.ts.
  geprueftAm: geprueftAm(RAW),
  zones: zoneFeatures.length,
  districts: districtFeatures.length,
  poi: poiFeatures.length,
  lowEmissionZone: false,
  segments: 0,
  managedSpaces: 0,
  crs: 'EPSG:4326 (lon/lat)',
  /**
   * Was dieser Abzug nicht enthält. `schedule` und `fee` sind die Marke der
   * Klasse C: Die Quelle nennt für keine Fläche Zeiten oder Betrag.
   * `umweltzone`: Gera hat keine. `segments`: Die Straßenlinien der Quelle
   * tragen keine Regel und stehen als Liste im `note` der Zone.
   */
  absent: ['schedule', 'fee', 'umweltzone', 'segments'],
})

// Die Zahlen gehören ins Log, nicht in einen Kommentar: Sie sind das, was beim
// nächsten Abzug anders sein kann, und ein Sprung darin ist das erste, was
// auffällt.
console.log(
  `\n${zoneFeatures.length} Zonenflächen aus ${rawZones.length} Features (${lines.length} Straßenlinien, ` +
    `weitester Stützpunkt ${farthest.toFixed(1)} m neben seiner Fläche), alle ohne Zeiten und Tarif` +
    ` — ${withoutDistrict} ohne Ortsteil-Treffer; ${districtFeatures.length} Ortsteile,` +
    ` ${poiFeatures.length} Behindertenparkplätze`
)
