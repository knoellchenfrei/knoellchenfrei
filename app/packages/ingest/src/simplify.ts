/**
 * Ramer-Douglas-Peucker line simplification.
 *
 * The district outlines are 2.1 MB at full ALKIS precision, which is cadastral
 * accuracy for a layer that only has to say "this is Kreuzberg". Zone polygons
 * matter more — point-in-polygon runs against them — so they get a far tighter
 * tolerance.
 *
 * Tolerances are in degrees. At Berlin's latitude 1e-5° is roughly 1.1 m
 * north-south and 0.7 m east-west.
 */

type Position = [number, number]

function perpendicularDistance(point: Position, start: Position, end: Position): number {
  const [x, y] = point
  const [x1, y1] = start
  const [x2, y2] = end
  const dx = x2 - x1
  const dy = y2 - y1
  if (dx === 0 && dy === 0) return Math.hypot(x - x1, y - y1)
  const t = ((x - x1) * dx + (y - y1) * dy) / (dx * dx + dy * dy)
  const clamped = Math.max(0, Math.min(1, t))
  return Math.hypot(x - (x1 + clamped * dx), y - (y1 + clamped * dy))
}

/**
 * Iterative rather than recursive: a cadastral ring can carry tens of thousands
 * of vertices, and the recursive form overflows the stack on the worst of them.
 */
function simplifyRing(points: Position[], tolerance: number): Position[] {
  if (points.length <= 2) return points

  const keep = new Uint8Array(points.length)
  keep[0] = 1
  keep[points.length - 1] = 1

  const stack: [number, number][] = [[0, points.length - 1]]
  while (stack.length > 0) {
    const segment = stack.pop()
    if (segment === undefined) break
    const [start, end] = segment
    let maxDistance = 0
    let index = -1
    for (let i = start + 1; i < end; i += 1) {
      const distance = perpendicularDistance(
        points[i] as Position,
        points[start] as Position,
        points[end] as Position
      )
      if (distance > maxDistance) {
        maxDistance = distance
        index = i
      }
    }
    if (index !== -1 && maxDistance > tolerance) {
      keep[index] = 1
      stack.push([start, index], [index, end])
    }
  }

  return points.filter((_, index) => keep[index] === 1)
}

/** Round to `digits` decimals; 5 is about a metre and plenty for display. */
function round(points: Position[], digits: number): Position[] {
  const factor = 10 ** digits
  return points.map(([lon, lat]): Position => [
    Math.round(lon * factor) / factor,
    Math.round(lat * factor) / factor,
  ])
}

/**
 * Simplify a polygon or multipolygon, preserving ring closure.
 *
 * A ring that collapses below four positions is dropped: it no longer encloses
 * anything and would render as a sliver.
 */
export function simplifyGeometry(
  geometry: { type: string; coordinates: unknown },
  tolerance: number,
  digits = 5
): { type: string; coordinates: unknown } | null {
  const doRing = (ring: Position[]): Position[] | null => {
    const simplified = round(simplifyRing(ring, tolerance), digits)
    if (simplified.length < 4) return null
    const head = simplified[0] as Position
    const tail = simplified[simplified.length - 1] as Position
    // Rounding can separate endpoints that were identical before.
    if (head[0] !== tail[0] || head[1] !== tail[1]) simplified.push(head)
    return simplified
  }

  const doPolygon = (rings: Position[][]): Position[][] | null => {
    const outer = rings[0]
    if (outer === undefined) return null
    const keptOuter = doRing(outer)
    if (keptOuter === null) return null
    const holes = rings.slice(1).map(doRing).filter((ring): ring is Position[] => ring !== null)
    return [keptOuter, ...holes]
  }

  if (geometry.type === 'Polygon') {
    const result = doPolygon(geometry.coordinates as Position[][])
    return result === null ? null : { type: 'Polygon', coordinates: result }
  }
  if (geometry.type === 'MultiPolygon') {
    const parts = (geometry.coordinates as Position[][][])
      .map(doPolygon)
      .filter((part): part is Position[][] => part !== null)
    return parts.length === 0 ? null : { type: 'MultiPolygon', coordinates: parts }
  }
  return geometry
}

/** Rounds a point without changing the number of coordinates. */
export function roundPoint(coordinates: Position, digits = 5): Position {
  const factor = 10 ** digits
  return [
    Math.round(coordinates[0] * factor) / factor,
    Math.round(coordinates[1] * factor) / factor,
  ]
}
