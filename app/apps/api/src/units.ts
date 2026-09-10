import { distanceToPolygonMetres, multiPolygonContains, type PolygonRings, type Position } from '@knoellchenfrei/core'

import shapesJson from './zone-units.generated.json'

/**
 * Welche Einheit der Langzeitmuster eine Position trifft — gerechnet aus
 * der Position, nie aus einem Feld, das der Client behauptet. Die Geometrie
 * kommt erzeugt aus dem Datenbau (`packages/ingest/src/build-zone-units.ts`)
 * und ist dieselbe, aus der die App ihre Zuordnung liest; zwei Zonenrechnungen
 * ergäben irgendwann zwei Zonen.
 *
 * Reihenfolge: eine Zone, die den Punkt enthält; sonst ein Bezirk, der ihn
 * enthält; sonst der nächste Bezirk aus Stellplatzreihen im Fangradius
 * (Karlsruhe hat keine Bezirksdatei, wohl aber Reihen mit Bezirksnamen).
 * Sonst `''` — in der Stadt, aber in keiner Einheit.
 */
interface UnitShape {
  unit: string
  kind: 'zone' | 'bezirk' | 'reihen'
  bounds: [number, number, number, number]
  polygons: PolygonRings[]
}

export const UNIT_SNAP_METRES = 300

const SHAPES = shapesJson as unknown as Record<string, UnitShape[]>

const inBounds = (shape: UnitShape, [lon, lat]: Position, margin = 0): boolean =>
  lon >= shape.bounds[0] - margin &&
  lon <= shape.bounds[2] + margin &&
  lat >= shape.bounds[1] - margin &&
  lat <= shape.bounds[3] + margin

export function unitAt(cityKey: string, point: Position): string {
  const shapes = SHAPES[cityKey]
  if (shapes === undefined) throw new Error(`Keine Einheiten für die Stadt "${cityKey}"`)
  for (const kind of ['zone', 'bezirk'] as const) {
    for (const shape of shapes) {
      if (shape.kind !== kind || !inBounds(shape, point)) continue
      if (multiPolygonContains(shape.polygons, point)) return shape.unit
    }
  }
  // 300 m sind rund 0,004 Grad; der Rahmen wird grosszügig erweitert und die
  // Entfernung danach genau gerechnet.
  let best: { unit: string; metres: number } | null = null
  for (const shape of shapes) {
    if (shape.kind !== 'reihen' || !inBounds(shape, point, 0.005)) continue
    const metres = distanceToPolygonMetres(shape.polygons, point)
    if (metres <= UNIT_SNAP_METRES && (best === null || metres < best.metres)) best = { unit: shape.unit, metres }
  }
  return best?.unit ?? ''
}

/** Zahl der Einheiten je Stadt — der Nenner der Basisrate im Modell. */
export function unitCount(cityKey: string): number {
  return SHAPES[cityKey]?.length ?? 0
}
