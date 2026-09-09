/**
 * Point-in-polygon for locating the zone a coordinate falls in.
 *
 * Coordinates are GeoJSON order — [lon, lat] — throughout. The 2012 version of
 * this project stored them the other way round and compensated with a second
 * inversion at import; nothing here repeats that.
 */

/** A GeoJSON position: [longitude, latitude]. */
export type Position = readonly [number, number]

export type Ring = readonly Position[]
/** Outer ring first, holes after. */
export type PolygonRings = readonly Ring[]

export interface BoundingBox {
  minLon: number
  minLat: number
  maxLon: number
  maxLat: number
}

export function boundsOf(polygons: readonly PolygonRings[]): BoundingBox {
  let minLon = Infinity
  let minLat = Infinity
  let maxLon = -Infinity
  let maxLat = -Infinity
  for (const rings of polygons) {
    for (const position of rings[0] ?? []) {
      const [lon, lat] = position
      if (lon < minLon) minLon = lon
      if (lon > maxLon) maxLon = lon
      if (lat < minLat) minLat = lat
      if (lat > maxLat) maxLat = lat
    }
  }
  return { minLon, minLat, maxLon, maxLat }
}

export function withinBounds(point: Position, box: BoundingBox): boolean {
  return (
    point[0] >= box.minLon &&
    point[0] <= box.maxLon &&
    point[1] >= box.minLat &&
    point[1] <= box.maxLat
  )
}

/**
 * Ray casting. Counts crossings of a ray heading east from the point; an odd
 * count means inside.
 *
 * The `(yi > y) !== (yj > y)` test treats each edge as half-open in y, so a ray
 * passing exactly through a shared vertex is counted once rather than twice.
 */
function ringContains(ring: Ring, point: Position): boolean {
  const [x, y] = point
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i]
    const b = ring[j]
    if (a === undefined || b === undefined) continue
    const [xi, yi] = a
    const [xj, yj] = b
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
      inside = !inside
    }
  }
  return inside
}

/** True when the point is inside the outer ring and outside every hole. */
export function polygonContains(rings: PolygonRings, point: Position): boolean {
  const [outer, ...holes] = rings
  if (outer === undefined || !ringContains(outer, point)) return false
  return !holes.some((hole) => ringContains(hole, point))
}

/** True when the point falls in any polygon of a multipolygon. */
export function multiPolygonContains(polygons: readonly PolygonRings[], point: Position): boolean {
  return polygons.some((rings) => polygonContains(rings, point))
}

/** Metres between two positions, spherical approximation. */
export function distanceMetres(a: Position, b: Position): number {
  const R = 6_371_000
  const toRad = (deg: number): number => (deg * Math.PI) / 180
  const dLat = toRad(b[1] - a[1])
  const dLon = toRad(a[0] - b[0])
  const lat1 = toRad(a[1])
  const lat2 = toRad(b[1])
  const h =
    Math.sin(dLat / 2) ** 2 + Math.sin(dLon / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2)
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)))
}

/**
 * Der kürzeste Abstand von einem Punkt zum Rand eines Multipolygons, in
 * Metern. Null, wenn der Punkt innen liegt.
 *
 * Wofür: Karlsruhes „Zonen" sind die Stellplatzreihen selbst — im Median
 * 128 m² und 4,8 m breit. Eine Ortung auf 10 bis 20 m Genauigkeit trifft so
 * eine Fläche fast nie, obwohl das Auto darin steht. `zoneAt` bleibt strikt;
 * dieser Abstand trägt den Rückfall „nächste Fläche in Reichweite", und nur
 * für Städte, die ihn in `City.zoneSnapMetres` ausdrücklich erlauben.
 *
 * Gerechnet auf einer lokal abgewickelten Ebene (Längengrad mit cos der
 * Breite gestaucht): Bei Abständen unter hundert Metern liegt der Fehler
 * weit unter einem Meter, und eine Ellipsoid-Rechnung je Kante wäre für die
 * vier- bis fünfstellige Kantenzahl einer Stadt zu teuer für jeden Tipp.
 */
export function distanceToPolygonMetres(polygons: readonly PolygonRings[], point: Position): number {
  if (multiPolygonContains(polygons, point)) return 0
  const kx = Math.cos((point[1] * Math.PI) / 180) * 111_320
  const ky = 110_540
  let best = Infinity
  for (const rings of polygons) {
    for (const ring of rings) {
      for (let i = 0; i < ring.length; i += 1) {
        const a = ring[i] as Position
        const b = ring[(i + 1) % ring.length] as Position
        const d = segmentDistance(point, a, b, kx, ky)
        if (d < best) best = d
      }
    }
  }
  return best
}

function segmentDistance(p: Position, a: Position, b: Position, kx: number, ky: number): number {
  const ax = (a[0] - p[0]) * kx
  const ay = (a[1] - p[1]) * ky
  const bx = (b[0] - p[0]) * kx
  const by = (b[1] - p[1]) * ky
  const dx = bx - ax
  const dy = by - ay
  const len2 = dx * dx + dy * dy
  // Ein Punkt als Kante (aufeinanderfolgende gleiche Stützpunkte): Abstand zum Punkt.
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, -(ax * dx + ay * dy) / len2))
  const cx = ax + t * dx
  const cy = ay + t * dy
  return Math.sqrt(cx * cx + cy * cy)
}
