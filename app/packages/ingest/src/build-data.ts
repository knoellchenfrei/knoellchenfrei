/**
 * Turns the raw WFS payloads into the small, frozen assets the PWA ships.
 *
 * Data is baked at build time rather than fetched at runtime: the WFS sends no
 * CORS headers, the segment layer is ~49 MB, and a frozen snapshot makes the app
 * work offline and the build reproducible.
 *
 * Anything this script cannot parse aborts the build. Shipping a zone whose
 * hours were silently mis-read would have the app quote a wrong price to someone
 * who then gets a ticket.
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

import { BERLIN, parseFee, parseSchedule, type Fee } from '@parkingzone/core'

import { CITY_KEY } from './sources.js'
import { roundPoint, simplifyGeometry } from './simplify.js'

// Dieses Skript ist der BERLINER Zweig. Hamburg hat einen eigenen
// (`build-data-hamburg.ts`), weil die beiden Feeds ausser der Domaene nichts
// teilen: andere Felder, andere Schreibweisen, andere Achsenreihenfolge. Ein
// gemeinsames Skript mit zwei Zweigen waere bei jeder Aenderung an einer Stadt
// fuer die andere gefaehrlich.
if (CITY_KEY !== BERLIN.key) {
  console.error(
    `CITY=${CITY_KEY}: Dieses Skript baut nur Berlin. Fuer Hamburg: pnpm --filter @parkingzone/ingest build-data-hamburg`
  )
  process.exit(2)
}

// Je Stadt ein Verzeichnis, auf beiden Seiten. Vorher lagen die Dateien flach
// unter `public/data/`; mit einer zweiten Stadt haetten sie sich gegenseitig
// ueberschrieben, ohne dass irgendetwas fehlgeschlagen waere.
const RAW = join(process.env.RAW_DIR ?? join(process.cwd(), '../../.raw'), BERLIN.key)
const OUT = join(
  process.env.OUT_DIR ?? join(process.cwd(), '../../apps/web/public/data'),
  BERLIN.key
)

interface Feature<P> {
  id?: string
  properties: P
  geometry: { type: string; coordinates: unknown }
}

function readFeatures<P>(key: string): Feature<P>[] {
  const path = join(RAW, `${key}.json`)
  const parsed = JSON.parse(readFileSync(path, 'utf8')) as { features: Feature<P>[] }
  return parsed.features
}

function write(name: string, value: unknown): void {
  const path = join(OUT, name)
  mkdirSync(dirname(path), { recursive: true })
  const json = JSON.stringify(value)
  writeFileSync(path, json)
  console.log(`  ${name}: ${(json.length / 1024).toFixed(0)} KB`)
}

/** Centroid of a polygon ring set — good enough to place a marker. */
function centroid(geometry: { type: string; coordinates: unknown }): [number, number] | null {
  const points: [number, number][] = []
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

interface ZoneProps {
  parkzone: string
  bezirk: string
  zeiten: string
  gebuehr: string
  bemerkung: string | null
}

interface SegmentProps {
  zone: string
  errechnete_anzahl_parkplaetze: string
  hoechstparkdauer: string
  ladesaeule: string
  carsharing: string
  strassenname: string
  parkgebuehr: string
  bewirtschaftungszeit: string
  nur_schwerbehinderte: string
}

console.log('Building web data...')

// ---------------------------------------------------------------- zones
const zoneFeatures = readFeatures<ZoneProps>('zones')
const segments = readFeatures<SegmentProps>('segments')

/**
 * Segment-level aggregates per zone. The zone service states no capacity and no
 * structured maximum stay; the segment service does, so this is the only place
 * those two facts exist in machine-readable form.
 */
interface ZoneStats {
  spaces: number
  segments: number
  maxStay: Record<string, number>
  chargingPoints: number
  carsharing: number
  accessibleOnly: number
}

const stats = new Map<string, ZoneStats>()
for (const segment of segments) {
  const zone = segment.properties.zone?.trim()
  if (!zone || zone === 'nicht bewirtschaftet') continue
  const entry = stats.get(zone) ?? {
    spaces: 0,
    segments: 0,
    maxStay: {},
    chargingPoints: 0,
    carsharing: 0,
    accessibleOnly: 0,
  }
  entry.spaces += Number(segment.properties.errechnete_anzahl_parkplaetze || 0)
  entry.segments += 1
  const stay = segment.properties.hoechstparkdauer?.trim()
  if (stay) entry.maxStay[stay] = (entry.maxStay[stay] ?? 0) + 1
  if (segment.properties.ladesaeule === 'ja') entry.chargingPoints += 1
  if (segment.properties.carsharing === 'ja') entry.carsharing += 1
  if (segment.properties.nur_schwerbehinderte === 'ja') entry.accessibleOnly += 1
  stats.set(zone, entry)
}

const failures: string[] = []
const zones = {
  type: 'FeatureCollection' as const,
  features: zoneFeatures.map((feature) => {
    const props = feature.properties
    const zoneId = props.parkzone.trim()
    let windows, unmodelledRules, sourceDefect, fee: Fee
    try {
      const schedule = parseSchedule(props.zeiten)
      windows = schedule.windows
      unmodelledRules = schedule.unmodelledRules
      sourceDefect = schedule.sourceDefect
      fee = parseFee(props.gebuehr)
    } catch (error) {
      failures.push(`zone ${zoneId}: ${(error as Error).message}`)
      return null
    }

    const stat = stats.get(zoneId)

    /**
     * Maximum stay, with the share of the zone it actually covers.
     *
     * Only 747 of 45,917 segments carry a value at all — typically 1-2% of a
     * zone. Publishing the most common value as a zone-wide fact told drivers
     * "4h" for a zone where a handful of streets near one square are limited
     * and everywhere else is not, and would tell someone parked on a 1h stretch
     * they had four hours. The share travels with the value so the UI can say
     * how far it reaches instead of implying it is the rule.
     */
    const stayEntries = stat ? Object.entries(stat.maxStay).sort((a, b) => b[1] - a[1]) : []
    const dominantStay = stayEntries[0]?.[0] ?? null
    const limitedSegments = stayEntries.reduce((sum, [, count]) => sum + count, 0)
    const maxStayShare =
      stat && stat.segments > 0 ? Math.round((limitedSegments / stat.segments) * 1000) / 1000 : 0
    const maxStayValues = stayEntries.map(([value]) => value)

    return {
      type: 'Feature' as const,
      id: zoneId,
      properties: {
        zone: zoneId,
        district: props.bezirk.trim(),
        rawHours: props.zeiten.trim(),
        rawFee: props.gebuehr.trim(),
        note: props.bemerkung?.trim() || null,
        windows,
        fee,
        unmodelledRules,
        sourceDefect: sourceDefect ?? null,
        spaces: stat?.spaces ?? null,
        maxStay: dominantStay,
        /** 0..1 — how much of the zone the maximum stay actually applies to. */
        maxStayShare,
        /** Every distinct limit present, so the UI can name the range. */
        maxStayValues,
        chargingPoints: stat?.chargingPoints ?? 0,
        carsharing: stat?.carsharing ?? 0,
      },
      // 1e-6 degrees is about 10 cm: enough to strip cadastral noise without
      // moving a boundary a driver could stand on.
      geometry: simplifyGeometry(feature.geometry, 1e-6, 6) ?? feature.geometry,
    }
  }),
}

if (failures.length > 0) {
  console.error('Refusing to build with unparsed zones:')
  for (const failure of failures) console.error(`  ${failure}`)
  process.exit(1)
}

write('zones.geojson', zones)

// ---------------------------------------------------------------- points of interest
interface PoiProps {
  kind: 'charging' | 'carsharing' | 'park_and_ride' | 'accessible'
  label: string
  detail: string | null
}

const poi: { type: 'Feature'; properties: PoiProps; geometry: unknown }[] = []

for (const segment of segments) {
  const p = segment.properties
  const isCharging = p.ladesaeule === 'ja'
  const isCarsharing = p.carsharing === 'ja'
  if (!isCharging && !isCarsharing) continue
  const point = centroid(segment.geometry)
  if (!point) continue
  poi.push({
    type: 'Feature',
    properties: {
      kind: isCharging ? 'charging' : 'carsharing',
      label: p.strassenname?.trim() || 'Ohne Straßenangabe',
      detail: p.zone && p.zone !== 'nicht bewirtschaftet' ? `Parkzone ${p.zone}` : null,
    },
    geometry: { type: 'Point', coordinates: roundPoint(point) },
  })
}

for (const feature of readFeatures<Record<string, string>>('parkAndRide')) {
  poi.push({
    type: 'Feature',
    properties: {
      kind: 'park_and_ride',
      label: feature.properties.anlagennam?.trim() || 'P+R-Anlage',
      detail: [feature.properties.bahnhofsna?.trim(), `${feature.properties.stellplaet ?? '?'} Stellplätze`]
        .filter(Boolean)
        .join(' · '),
    },
    geometry: feature.geometry,
  })
}

for (const feature of readFeatures<Record<string, string>>('parkAndRideUmland')) {
  poi.push({
    type: 'Feature',
    properties: {
      kind: 'park_and_ride',
      label: feature.properties.anlagennam?.trim() || 'P+R-Anlage (Umland)',
      detail: feature.properties.stellplatzanzahl
        ? `${feature.properties.stellplatzanzahl} Stellplätze · Umland`
        : 'Umland',
    },
    geometry: feature.geometry,
  })
}

for (const feature of readFeatures<Record<string, string>>('accessible')) {
  poi.push({
    type: 'Feature',
    properties: {
      kind: 'accessible',
      label: feature.properties.standort?.trim() || 'Behindertenparkplatz',
      detail: [
        // Singular for one: the feed's count is a bare number and "1 Plätze" reached the popup.
        feature.properties.anzahl
          ? `${feature.properties.anzahl} ${Number(feature.properties.anzahl) === 1 ? 'Platz' : 'Plätze'}`
          : null,
        feature.properties.bemerkung?.trim().replace(/\s{2,}/g, ' ') || null,
      ]
        .filter(Boolean)
        .join(' · ') || null,
    },
    geometry: feature.geometry,
  })
}

write('poi.geojson', { type: 'FeatureCollection', features: poi })

// ---------------------------------------------------------------- districts
interface DistrictProps {
  nam: string
}

const districts = {
  type: 'FeatureCollection' as const,
  features: readFeatures<DistrictProps>('districts')
    .map((feature) => {
      // A display-only layer, so a tolerance two orders of magnitude looser than
      // the zones: 1e-4 degrees is roughly 10 m.
      const geometry = simplifyGeometry(feature.geometry, 1e-4, 4)
      return geometry === null
        ? null
        : { type: 'Feature' as const, properties: { name: feature.properties.nam }, geometry }
    })
    .filter((feature) => feature !== null),
}

write('districts.geojson', districts)

// ---------------------------------------------------------------- low emission zone
const lowEmission = {
  type: 'FeatureCollection' as const,
  features: readFeatures<Record<string, string>>('lowEmissionZone')
    .map((feature) => {
      const geometry = simplifyGeometry(feature.geometry, 1e-5, 5)
      return geometry === null
        ? null
        : { type: 'Feature' as const, properties: { name: 'Umweltzone' }, geometry }
    })
    .filter((feature) => feature !== null),
}

write('umweltzone.geojson', lowEmission)

// ---------------------------------------------------------------- provenance
const totalSpaces = [...stats.values()].reduce((sum, s) => sum + s.spaces, 0)
write('meta.json', {
  city: BERLIN.key,
  cityName: BERLIN.name,
  // Aus der Stadt-Konfiguration statt als Zeichenkette hier: Die
  // Quellenangabe ist bei Hamburg Lizenzbedingung, und zwei Orte fuer
  // dieselbe Aussage laufen auseinander.
  source: `${BERLIN.attribution.source}, WFS 2.0.0`,
  licence: BERLIN.attribution.licence,
  licenceUrl: BERLIN.attribution.licenceUrl,
  attributionRequired: BERLIN.attribution.attributionRequired,
  zones: zones.features.length,
  segments: segments.length,
  managedSpaces: totalSpaces,
  poi: poi.length,
  districts: districts.features.length,
  lowEmissionZone: lowEmission.features.length > 0,
  crs: 'EPSG:4326 (lon/lat)',
})

console.log(`\n${zones.features.length} zones, ${poi.length} POI, ${totalSpaces} managed spaces`)
