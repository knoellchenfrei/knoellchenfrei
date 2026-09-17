/**
 * Baut die Daten einer niederländischen Stadt aus dem Nationaal Parkeer
 * Register — **ein** Datenbau für sechs Städte, die Stadt ist ein Parameter.
 *
 * `CITY=utrecht pnpm --filter @knoellchenfrei/ingest build-data-npr`. Der
 * Schlüssel muss in `NPR_AREA_MANAGERS` (sources.ts) stehen; alles andere
 * bricht ab, statt auf eine Stadt zurückzufallen.
 *
 * Was hier anders ist als in den zehn Städten davor: Die Quelle ist ein
 * Sternschema aus acht Tabellen (`core/npr.ts`, Kopfkommentar), und jede
 * Zeile trägt eine Gültigkeit. Der Bau filtert deshalb zuerst auf den
 * Stichtag — den Tag des Abrufs (`geprueftAm`), nicht den des Baus, damit
 * ein Neubau aus demselben Abzug dieselben Dateien ergibt — und setzt dann
 * zusammen:
 *
 *   Gebiet (BETAALDP) → Basisregelung (Typ B) → Zeitfenster je Tagestyp
 *   → Tarif je Fenster (Staffel) → Zone mit Fenstern, Betrag, Höchstdauer,
 *   Feiertagsbefund und Ereignisregel.
 *
 * Fünf Entscheidungen, jede mit Zählung im Log und Begründung in
 * `docs/staedte-niederlande.md`:
 *
 *  1. **Zone = Gebiet mit Nutzungszweck `BETAALDP` und Geometrie.**
 *     `VERGUNP` (Vergunninggebiete) tragen in allen sechs Städten Fenster
 *     ohne Tarif — dort darf ein Besucher nicht parken, aber die Frage „was
 *     kostet es" hat keine Antwort; sie werden gezählt und ausgelassen.
 *     `BEZOEKP`, `GARAGEP`, `PARKRIDE`, `DEELAUTOP` sind keine Straßenzonen.
 *  2. **Genau eine Basisregelung je Gebiet.** Zusatzregelungen (Typ A:
 *     Tages-, Abendkarte) sind Produkte, keine Pflicht; ein Gebiet mit
 *     keiner oder zwei Basisregelungen bricht ab.
 *  3. **Ein Fenster ohne Betrag ist kein Fenster.** `Nultarief`, `Gratis`,
 *     fehlender Tarifcode, `claimrightpossible = N` — alles fällt heraus.
 *     Bleibt kein Wochentagsfenster, wird die Zone ausgelassen und gezählt.
 *  4. **Feiertage kommen aus der Quelle.** SPECIALE DAG und die
 *     Feiertagstypen in TIJDVAK werden gegen `holidaysFor` gehalten; kassiert
 *     die Gemeinde an einem Kalenderfeiertag, trägt die Zone
 *     `freeOnHolidays: false` und einen Satz dazu.
 *  5. **Ereignistage werden genannt, nicht gerechnet.** Feyenoord-Anstoß,
 *     Ahoy, Koopzondag: ein Satz in `unmodelledRules`.
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

import {
  cityByKey,
  holidaysFor,
  mergeNprFees,
  multiPolygonContains,
  nprChargeWindow,
  nprDateKey,
  nprEventRule,
  nprExtraFreeDays,
  nprFeeText,
  nprHolidayFindings,
  nprHolidayRule,
  nprIsoDate,
  nprScheduleText,
  nprValidOn,
  parseNprFare,
  parseNprTimeFrame,
  parseNprWkt,
  type ChargeWindow,
  type Fee,
  type NprAreaRegulationRow,
  type NprAreaRow,
  type NprFarePartRow,
  type NprFareRow,
  type NprGeometryRow,
  type NprRegulationRow,
  type NprSpecialDayRow,
  type NprTimeFrame,
  type NprTimeFrameRow,
  type PolygonRings,
  type Position,
} from '@knoellchenfrei/core'

import { simplifyGeometry } from './simplify.js'
import { geprueftAm } from './abruf-zeit.js'
import { NPR_AREA_MANAGERS, NPR_TABLES } from './sources.js'

const CITY_KEY = process.env.CITY
if (CITY_KEY === undefined) {
  throw new Error(`CITY fehlt — eine von: ${Object.keys(NPR_AREA_MANAGERS).join(', ')}`)
}
const AREA_MANAGER = NPR_AREA_MANAGERS[CITY_KEY]
if (AREA_MANAGER === undefined) {
  throw new Error(`"${CITY_KEY}" ist keine NPR-Stadt — bekannt sind: ${Object.keys(NPR_AREA_MANAGERS).join(', ')}`)
}
const CITY = cityByKey(CITY_KEY)

const RAW = join(process.env.RAW_DIR ?? join(process.cwd(), '../../.raw'), CITY.key)
const OUT = join(process.env.OUT_DIR ?? join(process.cwd(), '../../apps/web/public/data'), CITY.key)

/**
 * Der Stichtag: der Tag des Abrufs, als `JJJJMMTT`. Ohne Rohdaten-Zeit
 * (Bau ohne vorherigen Abruf) der heutige Tag.
 */
const ABGERUFEN = geprueftAm(RAW)
const STICHTAG = (ABGERUFEN ?? new Date().toISOString()).slice(0, 10).replace(/-/g, '')
const JAHR = Number(STICHTAG.slice(0, 4))

function readRows<T>(key: string): T[] {
  const table = NPR_TABLES.find((entry) => entry.key === key)
  if (table === undefined) throw new Error(`Unbekannte Tabelle ${key}`)
  const parsed = JSON.parse(readFileSync(join(RAW, `${key}.json`), 'utf8')) as unknown
  if (!Array.isArray(parsed)) throw new Error(`${key}.json: kein Array`)
  return parsed as T[]
}

function write(name: string, value: unknown): void {
  const path = join(OUT, name)
  mkdirSync(dirname(path), { recursive: true })
  const json = JSON.stringify(value)
  writeFileSync(path, json)
  console.log(`  ${name}: ${(json.length / 1024).toFixed(0)} KB`)
}

interface Geometry {
  type: string
  coordinates: unknown
}

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
  freeOnHolidays?: boolean
  spaces: number | null
  maxStayMinutes: number | null
  maxStay: string | null
  maxStayShare: number
  maxStayValues: string[]
  chargingPoints: number
  carsharing: number
}

console.log(`${CITY.name} (NPR ${AREA_MANAGER}) — Daten bauen, Stichtag ${STICHTAG} …`)

// ------------------------------------------------------------- Tabellen

const areas = new Map<string, string>()
for (const row of readRows<NprAreaRow>('npr-gebied')) {
  if (!nprValidOn(row.startdatearea, row.enddatearea, STICHTAG)) continue
  if (row.areaid) areas.set(row.areaid, (row.areadesc ?? '').trim())
}

const geometries = new Map<string, Geometry[]>()
let pointGeometries = 0
for (const row of readRows<NprGeometryRow>('npr-geometrie')) {
  if (!nprValidOn(row.startdatearea, row.enddatearea, STICHTAG)) continue
  if (!row.areaid) continue
  if (/^POINT/i.test((row.areageometryastext ?? '').trim())) {
    pointGeometries += 1
    continue
  }
  const list = geometries.get(row.areaid) ?? []
  list.push(parseNprWkt(row.areageometryastext))
  geometries.set(row.areaid, list)
}

const regulations = new Map<string, NprRegulationRow>()
for (const row of readRows<NprRegulationRow>('npr-regeling')) {
  if (!nprValidOn(row.startdateregulation, row.enddateregulation, STICHTAG)) continue
  if (row.regulationid) regulations.set(row.regulationid, row)
}

const usageCount = new Map<string, number>()
const paidAreas = new Map<string, string[]>()
for (const row of readRows<NprAreaRegulationRow>('npr-gebiedregeling')) {
  if (!nprValidOn(row.startdatearearegulation, row.enddatearearegulation, STICHTAG)) continue
  const usage = row.usageid ?? '?'
  usageCount.set(usage, (usageCount.get(usage) ?? 0) + 1)
  if (usage !== 'BETAALDP' || !row.areaid || !row.regulationid) continue
  const list = paidAreas.get(row.areaid) ?? []
  list.push(row.regulationid)
  paidAreas.set(row.areaid, list)
}

const framesByRegulation = new Map<string, NprTimeFrame[]>()
for (const row of readRows<NprTimeFrameRow>('npr-tijdvak')) {
  if (!nprValidOn(row.startdatetimeframe, row.enddatetimeframe, STICHTAG)) continue
  if (!row.regulationid) continue
  const list = framesByRegulation.get(row.regulationid) ?? []
  list.push(parseNprTimeFrame(row))
  framesByRegulation.set(row.regulationid, list)
}

const farePartsByCode = new Map<string, NprFarePartRow[]>()
for (const row of readRows<NprFarePartRow>('npr-tariefdeel')) {
  if (!nprValidOn(row.startdatefarepart, row.enddatefarepart, STICHTAG)) continue
  if (!row.farecalculationcode) continue
  const list = farePartsByCode.get(row.farecalculationcode) ?? []
  list.push(row)
  farePartsByCode.set(row.farecalculationcode, list)
}

const fareDesc = new Map<string, string>()
for (const row of readRows<NprFareRow>('npr-tariefberekening')) {
  if (!nprValidOn(row.startdatefare, row.enddatefare, STICHTAG)) continue
  if (row.farecalculationcode) fareDesc.set(row.farecalculationcode, (row.farecalculationdesc ?? '').trim())
}

const specialDays = new Map<string, string>()
for (const row of readRows<NprSpecialDayRow>('npr-specialedag')) {
  const key = nprDateKey(row.datespecialday)
  if (key === null || !row.namespecialday) continue
  specialDays.set(nprIsoDate(key), row.namespecialday.trim().toUpperCase())
}

// ------------------------------------------------------------- Stadtteile

interface District {
  name: string
  rings: PolygonRings[]
}

interface WijkFeature {
  properties: Record<string, unknown>
  geometry: Geometry | null
}

function toPolygons(geometry: Geometry): PolygonRings[] {
  if (geometry.type === 'Polygon') return [geometry.coordinates as PolygonRings]
  if (geometry.type === 'MultiPolygon') return geometry.coordinates as PolygonRings[]
  return []
}

/** Dieselbe Messung wie in Cottbus: Grade, oder der Dienst hat umprojiziert. */
function assertDegrees(key: string, geometry: Geometry): void {
  const walk = (node: unknown): void => {
    if (!Array.isArray(node)) return
    if (typeof node[0] === 'number' && typeof node[1] === 'number') {
      const [lon, lat] = node as number[]
      if (Math.abs(lon as number) > 180 || Math.abs(lat as number) > 90) {
        throw new Error(`${key}: ${lon}/${lat} sind keine Grade — srsName fehlt oder wird ignoriert`)
      }
      return
    }
    node.forEach(walk)
  }
  walk(geometry.coordinates)
}

const districtIndex: District[] = []
const districtFeatures: { type: 'Feature'; properties: { name: string; bezirk: string }; geometry: Geometry }[] = []
let waterDistricts = 0
{
  const parsed = JSON.parse(readFileSync(join(RAW, 'districts.json'), 'utf8')) as { features?: WijkFeature[] }
  for (const feature of parsed.features ?? []) {
    if (feature.geometry === null) continue
    // „Groot water" ist ein Wijk aus Wasser (Den Haag, Rotterdam) — kein
    // Stadtteil, in dem jemand parkt.
    if (feature.properties['water'] === 'JA') {
      waterDistricts += 1
      continue
    }
    assertDegrees('districts', feature.geometry)
    const name = String(feature.properties['wijknaam'] ?? '').replace(/^Wijk \d+ /, '')
    districtIndex.push({ name, rings: toPolygons(feature.geometry) })
    const simplified = simplifyGeometry(feature.geometry, 1e-4, 5)
    if (simplified === null) continue
    districtFeatures.push({ type: 'Feature', properties: { name, bezirk: CITY.name }, geometry: simplified })
  }
}

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

function districtAt(point: Position | null): string | null {
  if (point === null) return null
  return districtIndex.find((district) => multiPolygonContains(district.rings, point))?.name ?? null
}

// ------------------------------------------------------------- Zonen

const fareCache = new Map<string, ReturnType<typeof parseNprFare>>()
function fareOf(code: string): ReturnType<typeof parseNprFare> {
  const cached = fareCache.get(code)
  if (cached !== undefined) return cached
  const parts = farePartsByCode.get(code)
  if (parts === undefined) throw new Error(`Tarifcode ${code} ohne gültigen Tarifteil`)
  const fare = parseNprFare(parts)
  fareCache.set(code, fare)
  return fare
}

// Die Feiertage des laufenden Jahres. Nur dieses: Die Gemeinden tragen
// SPECIALE DAG jahrweise nach (Rotterdam und Groningen haben am 17. September
// 2026 keinen Tag für 2027), und ein Kalender, der das nächste Jahr schon
// mitzählte, hielte jede Zone bis Dezember für „kassiert an Neujahr". Der
// Bau läuft täglich; im Januar zählt er das neue Jahr.
const kalender = new Set<string>(holidaysFor(CITY.land, JAHR, CITY.holidays ?? []))

const zoneFeatures: { type: 'Feature'; properties: ZoneOut; geometry: Geometry }[] = []
const counts = {
  paidAreas: paidAreas.size,
  withoutGeometry: 0,
  withoutBase: 0,
  onlyFree: 0,
  zones: 0,
  pieces: 0,
  freeFrames: 0,
  unclaimable: 0,
  noFareCode: 0,
  flatFares: 0,
  rangeFees: 0,
  chargedHolidays: 0,
  otherHolidays: 0,
  eventRules: 0,
  withoutDistrict: 0,
  holidayFree: 0,
}
const extraFree = new Map<string, number>()
const dayTypesSeen = new Map<string, number>()

for (const [areaId, regulationIds] of [...paidAreas.entries()].sort(([a], [b]) => a.localeCompare(b))) {
  const pieces = geometries.get(areaId)
  if (pieces === undefined) {
    counts.withoutGeometry += 1
    continue
  }
  const base = regulationIds.filter((id) => regulations.get(id)?.regulationtype === 'B')
  if (base.length !== 1) {
    // Zwei Basisregelungen hiessen zwei Wahrheiten für dieselbe Fläche.
    // Gemessen: in keiner der sechs Städte der Fall — bricht ab, wenn doch.
    if (base.length > 1) throw new Error(`Gebiet ${areaId}: ${base.length} Basisregelungen (${base.join(', ')})`)
    counts.withoutBase += 1
    continue
  }
  const regulationId = base[0] as string
  const frames = framesByRegulation.get(regulationId) ?? []

  const paidFrames: NprTimeFrame[] = []
  const windows: ChargeWindow[] = []
  const codes = new Set<string>()
  for (const frame of frames) {
    dayTypesSeen.set(frame.dayType, (dayTypesSeen.get(frame.dayType) ?? 0) + 1)
    if (!frame.claimable) {
      counts.unclaimable += 1
      continue
    }
    if (frame.fareCode === null) {
      counts.noFareCode += 1
      continue
    }
    const fare = fareOf(frame.fareCode)
    if (fare.kind === 'free') {
      counts.freeFrames += 1
      continue
    }
    paidFrames.push(frame)
    const window = nprChargeWindow(frame)
    if (window !== null) {
      windows.push(window)
      codes.add(frame.fareCode)
    }
  }
  if (windows.length === 0) {
    counts.onlyFree += 1
    continue
  }

  // Betrag: alle Tarife der Wochentagsfenster zu einem `Fee`.
  const fees = [...codes].map((code) => fareOf(code))
  const fee = mergeNprFees(fees.map((fare) => (fare.kind === 'free' ? { kind: 'unknown' as const } : fare.fee)))
  if (fees.some((fare) => fare.kind === 'flat')) counts.flatFares += 1
  if (fee.kind === 'range') counts.rangeFees += 1
  const rawFee = [...codes].map((code) => nprFeeText(fareDesc.get(code), fareOf(code))).join(' · ')

  // Höchstparkdauer: ein Wert über alle Wochentagsfenster, oder die Liste.
  const weekdayPaid = paidFrames.filter((frame) => frame.kind === 'weekday')
  const limits = weekdayPaid.map((frame) => frame.maxDurationMinutes).filter((m): m is number => m !== undefined)
  const distinctLimits = [...new Set(limits)].sort((a, b) => a - b)
  const maxStayMinutes = distinctLimits.length === 1 && limits.length === weekdayPaid.length ? (distinctLimits[0] as number) : null
  const maxStayValues = maxStayMinutes === null ? distinctLimits.map((m) => `${m} min`) : []
  const maxStayShare = maxStayMinutes === null && weekdayPaid.length > 0 ? limits.length / weekdayPaid.length : 0

  // Feiertage und Ereignisse.
  const findings = nprHolidayFindings(kalender, specialDays, paidFrames)
  const freeOnHolidays = findings.every((finding) => finding.outcome === 'frei')
  const unmodelledRules: string[] = []
  const holidayRule = nprHolidayRule(findings, JAHR)
  if (holidayRule !== null) unmodelledRules.push(holidayRule)
  if (findings.some((finding) => finding.outcome === 'wochentag')) counts.chargedHolidays += 1
  if (findings.some((finding) => finding.outcome === 'anders')) counts.otherHolidays += 1
  if (freeOnHolidays) counts.holidayFree += 1
  const extra = nprExtraFreeDays(kalender, specialDays, paidFrames, [JAHR])
  for (const day of extra) extraFree.set(`${day.date} ${day.dayType}`, (extraFree.get(`${day.date} ${day.dayType}`) ?? 0) + 1)
  const extraThisYear = extra.filter((day) => day.date.startsWith(`${JAHR}-`))
  if (extraThisYear.length > 0) {
    unmodelledRules.push(
      `Zusätzlich frei laut Quelle ${JAHR}: ${extraThisYear.map((day) => `${day.date.slice(8, 10)}.${day.date.slice(5, 7)}.`).join(', ')}`
    )
  }
  const eventRule = nprEventRule(frames.map((frame) => frame.dayType))
  if (eventRule !== null) {
    unmodelledRules.push(eventRule)
    counts.eventRules += 1
  }

  const desc = areas.get(areaId) ?? ''
  const regulationDesc = (regulations.get(regulationId)?.regulationdesc ?? '').trim()
  const noteParts = [desc, regulationDesc].filter((part) => part !== '' && part !== areaId)
  const note = noteParts.length === 0 ? null : [...new Set(noteParts)].join(' — ')

  counts.zones += 1
  for (const geometry of pieces) {
    const simplified = simplifyGeometry(geometry, 1e-5, 5)
    if (simplified === null) continue
    const district = districtAt(centroid(geometry))
    if (district === null) counts.withoutDistrict += 1
    counts.pieces += 1
    zoneFeatures.push({
      type: 'Feature',
      properties: {
        zone: areaId,
        district: district ?? CITY.name,
        rawHours: nprScheduleText(windows),
        rawFee,
        note,
        windows,
        fee,
        unmodelledRules,
        sourceDefect: null,
        ...(freeOnHolidays ? {} : { freeOnHolidays: false }),
        spaces: null,
        maxStayMinutes,
        maxStay: null,
        maxStayShare,
        maxStayValues,
        chargingPoints: 0,
        carsharing: 0,
      },
      geometry: simplified,
    })
  }
}

// Zonenschlüssel sind je Stadt eindeutig — mehrere Flächen dürfen ihn
// teilen (wie Hamburgs Stücke), aber zwei Gebiete nie.
write('zones.geojson', { type: 'FeatureCollection', features: zoneFeatures })
write('districts.geojson', { type: 'FeatureCollection', features: districtFeatures })
write('poi.geojson', { type: 'FeatureCollection', features: [] })
write('umweltzone.geojson', { type: 'FeatureCollection', features: [] })

write('meta.json', {
  city: CITY.key,
  cityName: CITY.name,
  source: `${CITY.attribution.source} (Gebiedsbeheerder ${AREA_MANAGER}); Stadtteile: CBS Wijken 2024 über PDOK`,
  licence: CITY.attribution.licence,
  licenceUrl: CITY.attribution.licenceUrl,
  attributionRequired: CITY.attribution.attributionRequired,
  datasetUrl: CITY.attribution.datasetUrl,
  geprueftAm: ABGERUFEN,
  stichtag: nprIsoDate(STICHTAG),
  zones: zoneFeatures.length,
  districts: districtFeatures.length,
  poi: 0,
  lowEmissionZone: false,
  segments: 0,
  managedSpaces: 0,
  crs: 'EPSG:4326 (lon/lat), WKT der Quelle',
  absent: ['poi', 'lowEmissionZone', 'segments', 'spaces'],
})

console.log(
  `\n${counts.zones} von ${counts.paidAreas} BETAALDP-Gebieten als Zonen (${counts.pieces} Flächen)` +
    ` — ${counts.withoutGeometry} ohne Geometrie, ${counts.withoutBase} ohne Basisregelung, ${counts.onlyFree} nur mit Nulltarif`
)
console.log(
  `Fenster ausgelassen: ${counts.freeFrames} Nulltarif, ${counts.noFareCode} ohne Tarifcode, ${counts.unclaimable} nicht erwerbbar` +
    ` · Tarife: ${counts.rangeFees} Zonen mit Spanne, ${counts.flatFares} mit Pauschale`
)
console.log(
  `Feiertage: ${counts.holidayFree} Zonen frei, ${counts.chargedHolidays} kassieren wie am Wochentag, ${counts.otherHolidays} mit eigenen Zeiten` +
    ` · ${counts.eventRules} Zonen mit Ereignistagen · ${counts.withoutDistrict} Flächen ohne Stadtteil (${waterDistricts} Wasser-Wijken ausgelassen)`
)
console.log(`Nutzungszwecke (gültig): ${[...usageCount.entries()].map(([usage, n]) => `${usage} ${n}`).join(', ')}`)
console.log(`Tagestypen der Basisregelungen: ${[...dayTypesSeen.entries()].map(([type, n]) => `${type} ${n}`).join(', ')}`)
console.log(`${pointGeometries} Punktgeometrien (P+R u. ä.) übergangen`)
if (extraFree.size > 0) {
  console.log(`Frei laut Quelle, dem Kalender unbekannt: ${[...extraFree.entries()].map(([day, n]) => `${day} (${n} Zonen)`).join(', ')}`)
}
