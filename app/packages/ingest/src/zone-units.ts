import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { areaSquareMetres, boundsOf, CITIES, type BoundingBox, type PolygonRings } from '@knoellchenfrei/core'

import { simplifyGeometry } from './simplify.js'

/**
 * Die Einheiten der Langzeitmuster — was der Worker aus einer Position macht.
 *
 * Eine Einheit ist der Zonenschlüssel, wenn die Zone ein Gebiet ist
 * (Fläche aller Stücke des Schlüssels ≥ 2 ha), sonst der Bezirk: Karlsruhes
 * Zonen sind Stellplatzreihen (Median 126 m²), Hamburgs 44 Flächen ohne
 * Bewohnerparkrecht liegen bei 50 m² bis wenigen Hektar. Eine Wochenstunde
 * an einer 30-m-Reihe über Quartale ist zwar kein Personenbezug, aber näher
 * an „vor dem Haus von …" als nötig — und statistisch ohnehin Rauschen.
 *
 * Zwei Ausgaben aus einer Quelle, damit App und Worker nie zwei Zonen
 * rechnen: `ZONE_UNITS` (Zonenschlüssel → Einheit, für die App) und die
 * Geometrie je Einheit für den Worker, der eine Meldung beim Ablauf einer
 * Einheit zuordnet — aus der Position, wie `city` und `mark` heute, nie aus
 * einem Feld, das der Client behauptet.
 *
 * Für den Bezirk gibt es zwei Formen: das Bezirkspolygon aus
 * `districts.geojson`, wo es eins gibt (Hamburg), und sonst die Reihen des
 * Bezirks selbst mit einem Fangradius (Karlsruhe hat keine Bezirksdatei):
 * Wer 15 m neben einer Reihe der Südstadt meldet, meldet in der Südstadt.
 */
export const UNIT_MIN_AREA_M2 = 20_000
/** Fangradius um die Reihen eines Bezirks ohne Bezirkspolygon. */
export const UNIT_SNAP_METRES = 300
/** Vereinfachung der Geometrie im Worker-Bündel: 8 m Toleranz, 5 Stellen. */
const TOLERANCE_DEG = 0.00008

export interface UnitShape {
  unit: string
  /** `zone`: enthält; `bezirk`: enthält; `reihen`: nächste Reihe im Fangradius. */
  kind: 'zone' | 'bezirk' | 'reihen'
  bounds: [number, number, number, number]
  polygons: PolygonRings[]
}

export interface ZoneUnitsOutput {
  /** Je Stadt: Zonenschlüssel → Einheit. */
  units: Record<string, Record<string, string>>
  /** Je Stadt: die Geometrie der Einheiten. */
  shapes: Record<string, UnitShape[]>
  /** Je Stadt: Zahl der Einheiten (Nenner der Basisrate). */
  counts: Record<string, number>
}

interface Feature {
  properties?: { zone?: unknown; district?: unknown; name?: unknown }
  geometry?: { type?: string; coordinates?: unknown } | null
}

/**
 * Ob die Stücke eines Schlüssels Stellplatzreihen sind statt Gebiete: kein
 * Stück erreicht 2 ha, und die Hälfte liegt unter 500 m². Bis St. Gallen gab
 * es den Fall nicht — dort tragen 1.871 Reihen von im Median 27 m² denselben
 * Schlüssel `EBZ`, zusammen 6,8 ha. Die Summe hätte daraus ein „Gebiet"
 * gemacht, dessen Geometrie die 8-m-Vereinfachung auf 29 Punkte zusammenschob:
 * eine Einheit, in der keine Meldung je gelegen hätte. Reihen bleiben Reihen,
 * auch zu Tausenden, und werden wie Karlsruhes über den Fangradius getroffen —
 * nur unter dem Zonenschlüssel statt dem Bezirk, weil sie über 27 Quartiere
 * verteilt sind und die Einheit je Schlüssel genau eine ist.
 */
export const ROW_MAX_AREA_M2 = 500

function isRows(polygons: readonly PolygonRings[]): boolean {
  const areas = polygons.map((polygon) => areaSquareMetres([polygon])).sort((a, b) => a - b)
  const median = areas[Math.floor(areas.length / 2)] ?? 0
  return areas.length >= 10 && median < ROW_MAX_AREA_M2 && (areas.at(-1) ?? 0) < UNIT_MIN_AREA_M2
}

function polygonsOf(feature: Feature): PolygonRings[] {
  const geometry = feature.geometry
  if (geometry === null || geometry === undefined) return []
  if (geometry.type === 'Polygon') return [geometry.coordinates as PolygonRings]
  if (geometry.type === 'MultiPolygon') return geometry.coordinates as PolygonRings[]
  return []
}

function simplified(polygons: readonly PolygonRings[], tolerance = TOLERANCE_DEG): PolygonRings[] {
  const result = simplifyGeometry({ type: 'MultiPolygon', coordinates: polygons }, tolerance, 5)
  if (result === null) return []
  return result.type === 'MultiPolygon' ? (result.coordinates as PolygonRings[]) : [result.coordinates as PolygonRings]
}

/**
 * Tausende Reihen als ein Raster von Kästchen — für den Fangradius reicht das.
 *
 * St. Gallens 1.871 EBZ-Reihen haben 13.482 Stützpunkte; ungekürzt sprengten
 * sie mit den 4.838 der Parkuhr-Reihen das Worker-Bündel (1,26 MB statt
 * unter 1 MB). Der Worker fragt für Reihen nur „liegt eine in 300 m?", und
 * dafür ist ein Kästchen von 0,002° (rund 150 × 220 m) um alle Reihen einer
 * Rasterzelle genau genug: Der Fehler bleibt unter 150 m, das Ergebnis
 * dieselbe Einheit. Karlsruhes Reihen bleiben ungekürzt — sie gehen in den
 * Bezirk und sind zu wenige, um zu stören.
 */
const ROW_CELL_DEG = 0.002

function rasterised(polygons: readonly PolygonRings[]): PolygonRings[] {
  const cells = new Map<string, BoundingBox>()
  for (const polygon of polygons) {
    const b = boundsOf([polygon])
    const cell = `${Math.floor(b.minLon / ROW_CELL_DEG)}:${Math.floor(b.minLat / ROW_CELL_DEG)}`
    const seen = cells.get(cell)
    cells.set(
      cell,
      seen === undefined
        ? { ...b }
        : {
            minLon: Math.min(seen.minLon, b.minLon),
            minLat: Math.min(seen.minLat, b.minLat),
            maxLon: Math.max(seen.maxLon, b.maxLon),
            maxLat: Math.max(seen.maxLat, b.maxLat),
          }
    )
  }
  const r = (v: number): number => Math.round(v * 1e5) / 1e5
  return [...cells.values()].map((b) => [
    [
      [r(b.minLon), r(b.minLat)],
      [r(b.maxLon), r(b.minLat)],
      [r(b.maxLon), r(b.maxLat)],
      [r(b.minLon), r(b.maxLat)],
      [r(b.minLon), r(b.minLat)],
    ],
  ])
}

const box = (polygons: readonly PolygonRings[]): [number, number, number, number] => {
  const b: BoundingBox = boundsOf(polygons)
  const r = (v: number): number => Math.round(v * 1e5) / 1e5
  return [r(b.minLon), r(b.minLat), r(b.maxLon), r(b.maxLat)]
}

export function buildZoneUnits(dataDir: string): ZoneUnitsOutput {
  const units: Record<string, Record<string, string>> = {}
  const shapes: Record<string, UnitShape[]> = {}
  const counts: Record<string, number> = {}

  for (const city of CITIES) {
    const zones = JSON.parse(readFileSync(join(dataDir, city.key, 'zones.geojson'), 'utf8')) as { features?: Feature[] }
    const districts = JSON.parse(readFileSync(join(dataDir, city.key, 'districts.geojson'), 'utf8')) as {
      features?: Feature[]
    }

    // Alle Stücke je Schlüssel, und der Bezirk des ersten Stücks.
    const byKey = new Map<string, { polygons: PolygonRings[]; district: string }>()
    for (const feature of zones.features ?? []) {
      const key = feature.properties?.zone
      if (typeof key !== 'string' || key === '') continue
      const district = typeof feature.properties?.district === 'string' ? feature.properties.district : ''
      const entry = byKey.get(key) ?? { polygons: [], district }
      entry.polygons.push(...polygonsOf(feature))
      byKey.set(key, entry)
    }
    if (byKey.size === 0) throw new Error(`${city.key}: keine einzige Zone in zones.geojson`)

    const cityUnits: Record<string, string> = {}
    const cityShapes: UnitShape[] = []
    const smallByDistrict = new Map<string, PolygonRings[]>()
    for (const [key, entry] of [...byKey.entries()].sort(([a], [b]) => a.localeCompare(b))) {
      if (areaSquareMetres(entry.polygons) >= UNIT_MIN_AREA_M2) {
        cityUnits[key] = key
        if (isRows(entry.polygons)) {
          cityShapes.push({ unit: key, kind: 'reihen', bounds: box(entry.polygons), polygons: rasterised(entry.polygons) })
        } else {
          cityShapes.push({ unit: key, kind: 'zone', bounds: box(entry.polygons), polygons: simplified(entry.polygons) })
        }
      } else {
        const unit = `bezirk:${entry.district}`
        cityUnits[key] = unit
        const list = smallByDistrict.get(entry.district) ?? []
        list.push(...entry.polygons)
        smallByDistrict.set(entry.district, list)
      }
    }

    const districtPolygons = new Map<string, PolygonRings[]>()
    for (const feature of districts.features ?? []) {
      const name = feature.properties?.name
      if (typeof name === 'string') districtPolygons.set(name, polygonsOf(feature))
    }
    for (const [district, rows] of [...smallByDistrict.entries()].sort(([a], [b]) => a.localeCompare(b))) {
      const polygon = districtPolygons.get(district)
      if (polygon !== undefined && polygon.length > 0) {
        cityShapes.push({ unit: `bezirk:${district}`, kind: 'bezirk', bounds: box(polygon), polygons: simplified(polygon) })
      } else {
        // Reihen von 4,8 m Breite überleben keine 8-m-Vereinfachung — bei
        // Karlsruhe blieben von 4.530 Punkten 42. Nur runden.
        cityShapes.push({ unit: `bezirk:${district}`, kind: 'reihen', bounds: box(rows), polygons: simplified(rows, 0) })
      }
    }

    units[city.key] = cityUnits
    shapes[city.key] = cityShapes
    counts[city.key] = cityShapes.length
  }
  return { units, shapes, counts }
}

/** Der Inhalt von `core/src/zone-units.generated.ts`. */
export function renderCoreFile(output: ZoneUnitsOutput): string {
  const zeilen = Object.entries(output.units)
    .map(
      ([city, map]) =>
        `  ${JSON.stringify(city)}: {\n${Object.entries(map)
          .map(([key, unit]) => `    ${JSON.stringify(key)}: ${JSON.stringify(unit)},`)
          .join('\n')}\n  },`,
    )
    .join('\n')
  const counts = Object.entries(output.counts)
    .map(([city, n]) => `  ${JSON.stringify(city)}: ${n},`)
    .join('\n')
  return `/**
 * ERZEUGT von \`packages/ingest/src/build-zone-units.ts\` — nicht von Hand ändern.
 *
 * Je Stadt: Zonenschlüssel → Einheit der Langzeitmuster. Eine Zone unter
 * 2 ha (Karlsruhes Stellplatzreihen, Hamburgs kleine Flächen) zählt für
 * ihren Bezirk, alle anderen für sich. \`zone-units-aktuell.test.ts\` hält
 * die Datei gegen die ausgelieferten Daten; der Befehl steht dort.
 */

export const ZONE_UNITS: Readonly<Record<string, Readonly<Record<string, string>>>> = {
${zeilen}
}

/** Zahl der Einheiten je Stadt, auch der stillen — der Nenner der Basisrate. */
export const UNIT_COUNTS: Readonly<Record<string, number>> = {
${counts}
}

/** Die Einheit einer Zone, oder null, wenn die Stadt oder der Schlüssel unbekannt ist. */
export function unitOfZone(city: string, zoneKey: string): string | null {
  return ZONE_UNITS[city]?.[zoneKey] ?? null
}
`
}
