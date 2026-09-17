/**
 * Ein Band um eine Linie — für Städte, deren Regelung an einer Straße hängt
 * und nicht an einer Fläche.
 *
 * Wien führt seine Geschäftsstraßen als **Linien** (`KURZPARKSTREIFENOGD`,
 * 796 Stück, im Median 53 m lang, 627 davon mit genau zwei Stützpunkten).
 * Die App kennt nur Flächen: `zoneAt` rechnet Punkt-in-Polygon,
 * `loadZones` nimmt nur `Polygon` und `MultiPolygon`. Eine Linie ohne
 * Breite trifft keine Ortung. Deshalb wird jede Linie hier zu einem Band
 * mit fester halber Breite, und dieses Band liegt im Datenbau **vor** der
 * Bezirksfläche, damit `zoneAt` es zuerst findet.
 *
 * Wie: Gehrungs-Versatz (miter offset) je Seite — zu jedem Stützpunkt die
 * Winkelhalbierende der beiden Nachbarsegmente, um `1/cos(θ/2)` gestreckt,
 * damit die Bandbreite auch in der Kurve stimmt; die Streckung ist auf das
 * Vierfache begrenzt, sonst schösse eine spitze Kehre kilometerweit hinaus.
 * Die Enden sind flach. Linke Seite vorwärts, rechte Seite rückwärts, Ring
 * geschlossen. Für die kurzen, fast geraden Streifen Wiens reicht das; ein
 * Band, das sich bei einer engen Kehre selbst schneidet, bliebe für den
 * Punkt-im-Polygon-Test trotzdem ein Band.
 *
 * Gerechnet wird in einer lokalen Ebene: Grad Breite mal 110.540 m, Grad
 * Länge mal 111.320 m × cos(Breite) — auf 48° Nord und 300 m Länge ist der
 * Fehler unter einem Zentimeter.
 */

type Position = [number, number]
/** Was hereinkommt: GeoJSON-Koordinaten, auch als `readonly`-Tupel aus `core`. */
type Input = readonly (readonly [number, number])[]

const METRES_PER_DEG_LAT = 110_540
const METRES_PER_DEG_LON = 111_320
/** Wie weit eine Gehrung über die halbe Breite hinausragen darf. */
const MAX_MITER = 4

/**
 * Das Band um eine Linie, als ein Polygonring (geschlossen, erster = letzter
 * Punkt), auf fünf Stellen gerundet — etwa ein Meter, wie überall in den
 * ausgelieferten Daten.
 *
 * Wirft bei weniger als zwei verschiedenen Stützpunkten: Ein Punkt hat keine
 * Richtung, und ein Band ohne Richtung wäre ein erfundenes Quadrat.
 */
export function bufferLine(line: Input, halfWidthMetres: number): Position[] {
  if (!(halfWidthMetres > 0)) throw new Error(`Bandbreite ${halfWidthMetres} m ist keine Breite`)
  const points = dedupe(line)
  if (points.length < 2) throw new Error(`eine Linie aus ${points.length} Punkt(en) hat keine Richtung`)

  const lat0 = (points[0] as Position)[1]
  const cosLat = Math.cos((lat0 * Math.PI) / 180)
  const toMetres = ([lon, lat]: Position): Position => [lon * METRES_PER_DEG_LON * cosLat, lat * METRES_PER_DEG_LAT]
  const toDegrees = ([x, y]: Position): Position => [
    Math.round((x / (METRES_PER_DEG_LON * cosLat)) * 1e5) / 1e5,
    Math.round((y / METRES_PER_DEG_LAT) * 1e5) / 1e5,
  ]

  const local = points.map(toMetres)
  const left: Position[] = []
  const right: Position[] = []
  for (let i = 0; i < local.length; i += 1) {
    const prev = local[i - 1]
    const here = local[i] as Position
    const next = local[i + 1]
    // Die Normale (nach links) des Segments vor und nach dem Punkt; an den
    // Enden gibt es nur eines von beiden.
    const before = prev === undefined ? undefined : leftNormal(prev, here)
    const after = next === undefined ? undefined : leftNormal(here, next)
    let offset: Position
    if (before === undefined) offset = after as Position
    else if (after === undefined) offset = before
    else {
      const bx = before[0] + after[0]
      const by = before[1] + after[1]
      const len = Math.hypot(bx, by)
      if (len < 1e-9) {
        // Kehrtwende: Die Normalen heben sich auf; das Band endet hier
        // flach wie an einem Linienende, statt eine Gehrung ins Unendliche
        // zu rechnen.
        offset = before
      } else {
        // Winkelhalbierende, gestreckt um 1/cos(θ/2) = 1/(len/2), gedeckelt.
        const scale = Math.min(MAX_MITER, 2 / len)
        offset = [(bx / len) * scale, (by / len) * scale]
      }
    }
    left.push([here[0] + offset[0] * halfWidthMetres, here[1] + offset[1] * halfWidthMetres])
    right.push([here[0] - offset[0] * halfWidthMetres, here[1] - offset[1] * halfWidthMetres])
  }

  const ring = [...left, ...right.reverse()].map(toDegrees)
  ring.push(ring[0] as Position)
  return ring
}

/** Einheitsnormale nach links, in Laufrichtung von `a` nach `b`. */
function leftNormal(a: Position, b: Position): Position {
  const dx = b[0] - a[0]
  const dy = b[1] - a[1]
  const len = Math.hypot(dx, dy)
  return [-dy / len, dx / len]
}

/** Aufeinanderfolgende gleiche Punkte fallen weg — sie hätten keine Richtung. */
function dedupe(line: Input): Position[] {
  const out: Position[] = []
  for (const point of line) {
    const last = out[out.length - 1]
    if (last !== undefined && Math.abs(last[0] - point[0]) < 1e-9 && Math.abs(last[1] - point[1]) < 1e-9) continue
    out.push([point[0], point[1]])
  }
  return out
}
