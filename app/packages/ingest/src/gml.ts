/**
 * Ein Leser für WFS-2.0-Antworten in GML 3.2 — so weit MapServer sie schreibt.
 *
 * ## Warum es ihn gibt
 *
 * Sieben Städte lang kam jede Ebene als GeoJSON: Man wählt das richtige
 * `outputFormat`, und `JSON.parse` erledigt den Rest. Schwerins Dienst beim
 * Landkreis Ludwigslust-Parchim kennt **kein** JSON — jede Schreibweise
 * (`application/json`, `application/geo+json`, `GEOJSON`, `geojson`,
 * `application/json; subtype=geojson`) endet in `'…' is not a permitted
 * output format for layer 'Parkzonen', review wfs_getfeature_formatlist
 * setting`. Die `GetCapabilities` nennen vier Formate, und alle vier sind
 * GML. Gemessen am 16. September 2026.
 *
 * Es gibt fertige XML-Parser auf npm; keiner steht hier. Der Grund ist
 * derselbe wie bei `utm.ts`: Was gebraucht wird, ist klein und lässt sich
 * gegen die echte Antwort messen — Punkte, Polygone, Multiflächen und ein
 * Dutzend Textfelder je Feature. Eine Abhängigkeit, die zehnmal mehr kann,
 * müsste man glauben, und sie brächte ihre eigene Lesart von Namensräumen,
 * Entities und Leerraum mit, die niemand hier nachprüft.
 *
 * ## Was er liest, und was er absichtlich nicht liest
 *
 * - `wfs:FeatureCollection` mit `numberMatched`/`numberReturned` und einer
 *   Folge von `wfs:member`, je eines mit **genau einem** Feature-Element.
 * - Sachfelder als direkte Kindelemente des Features mit reinem Text —
 *   leer (`<ns:Bemerkung></ns:Bemerkung>` oder `<ns:Bemerkung/>`) heißt
 *   leere Zeichenkette, **nicht** `null`: So schreibt MapServer ein leeres
 *   Feld, und ein fehlendes Element wäre ein anderer Befund (Hamburgs Feed
 *   lässt Felder weg; `fixture-shape.test.ts` hält den Unterschied fest).
 *   Ein Feld mit Markup darin ist ein Abbruch, keine stille Zeichenkette.
 * - Geometrien `gml:Point` (`gml:pos`), `gml:Polygon` (äußerer Ring und
 *   Löcher als `gml:posList`), `gml:MultiSurface` aus Polygonen und
 *   `gml:MultiPoint`. Linien braucht heute keine Ebene; sie werfen, statt als
 *   leere Geometrie durchzurutschen.
 * - **Nur zwei Dimensionen.** `srsDimension="3"` ist ein Abbruch: Paare aus
 *   einer Dreierliste zu bilden ergäbe plausible Zahlen an falschen Stellen.
 * - **Keine Achsenreihenfolge und keine Umprojektion.** Die Zahlen kommen so
 *   heraus, wie sie in der Datei stehen. Was sie bedeuten, sagt `sources.ts`
 *   (`axisOrder`, `srsName`), und der Datenbau prüft es mit `assertUtm` —
 *   dieselbe Regel wie überall: Die Reihenfolge steht in der Konfiguration,
 *   nie in einer Heuristik. Der `srsName` der Antwort wird trotzdem
 *   mitgegeben, damit der Datenbau ihn *nachmessen* kann.
 *
 * Ein `ows:ExceptionReport` — MapServers Antwort auf ein falsches
 * `srsName` oder einen falschen Typnamen, mit HTTP 200 oder 400 — wird
 * erkannt und mit seinem Text geworfen, statt als Sammlung mit null
 * Features durchzugehen.
 */

export class GmlError extends Error {
  constructor(reason: string) {
    super(`GML: ${reason}`)
    this.name = 'GmlError'
  }
}

export interface GmlGeometry {
  type: 'Point' | 'Polygon' | 'MultiPolygon' | 'MultiPoint'
  coordinates: unknown
}

export interface GmlFeature {
  /** `gml:id` des Features — MapServer lässt es weg, wenn die Ebene keine Kennung hat. */
  id: string | null
  typeName: string
  properties: Record<string, string>
  geometry: GmlGeometry | null
}

export interface GmlCollection {
  numberMatched: number | null
  numberReturned: number | null
  /** Der erste `srsName` der Antwort, wörtlich — zum Nachmessen, nicht zum Glauben. */
  srsName: string | null
  features: GmlFeature[]
}

/** Die fünf XML-Entities plus numerische; mehr schreibt MapServer nicht. */
function decodeEntities(text: string): string {
  return text
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex: string) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec: string) => String.fromCodePoint(Number(dec)))
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')
}

/** Eine Zahlenliste aus `gml:pos`/`gml:posList` in Paare zerlegen. */
function parsePositions(text: string, where: string): number[][] {
  const numbers = text.trim().split(/\s+/).filter((token) => token !== '')
  if (numbers.length === 0 || numbers.length % 2 !== 0) {
    throw new GmlError(`${where}: ${numbers.length} Zahlen sind keine Koordinatenpaare`)
  }
  const positions: number[][] = []
  for (let i = 0; i < numbers.length; i += 2) {
    const x = Number(numbers[i])
    const y = Number(numbers[i + 1])
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      throw new GmlError(`${where}: "${numbers[i]} ${numbers[i + 1]}" ist keine Koordinate`)
    }
    positions.push([x, y])
  }
  return positions
}

function assertTwoDimensional(fragment: string, where: string): void {
  const dimension = /srsDimension="(\d+)"/.exec(fragment)
  if (dimension !== null && dimension[1] !== '2') {
    throw new GmlError(`${where}: srsDimension ${dimension[1]} — nur zwei Dimensionen werden gelesen`)
  }
}

function parseRing(fragment: string, where: string): number[][] {
  const list = /<gml:posList[^>]*>([^<]*)<\/gml:posList>/.exec(fragment)
  if (list === null) throw new GmlError(`${where}: Ring ohne gml:posList`)
  assertTwoDimensional(fragment, where)
  const ring = parsePositions(list[1] as string, where)
  if (ring.length < 4) throw new GmlError(`${where}: Ring mit ${ring.length} Punkten`)
  return ring
}

function parsePolygon(fragment: string, where: string): number[][][] {
  const exterior = /<gml:exterior>([\s\S]*?)<\/gml:exterior>/.exec(fragment)
  if (exterior === null) throw new GmlError(`${where}: Polygon ohne gml:exterior`)
  const rings = [parseRing(exterior[1] as string, `${where} außen`)]
  for (const interior of fragment.matchAll(/<gml:interior>([\s\S]*?)<\/gml:interior>/g)) {
    rings.push(parseRing(interior[1] as string, `${where} innen`))
  }
  return rings
}

function parsePoint(fragment: string, where: string): number[] {
  const pos = /<gml:pos[^>]*>([^<]*)<\/gml:pos>/.exec(fragment)
  if (pos === null) throw new GmlError(`${where}: Point ohne gml:pos`)
  assertTwoDimensional(fragment, where)
  const positions = parsePositions(pos[1] as string, where)
  if (positions.length !== 1) throw new GmlError(`${where}: Point mit ${positions.length} Positionen`)
  return positions[0] as number[]
}

/**
 * Die Geometrie eines Features — das erste `gml:`-Element unter seinem
 * Geometriefeld (`msGeometry` bei MapServer; der Name wird nicht
 * vorausgesetzt, weil GeoServer `the_geom` schreibt).
 */
function parseGeometry(fragment: string, where: string): GmlGeometry | null {
  const start = /<gml:(Point|Polygon|MultiSurface|MultiPoint|LineString|MultiCurve|Curve)\b/.exec(fragment)
  if (start === null) return null
  const kind = start[1] as string
  const body = fragment.slice(start.index)

  if (kind === 'Point') {
    return { type: 'Point', coordinates: parsePoint(body, where) }
  }
  if (kind === 'Polygon') {
    const end = body.indexOf('</gml:Polygon>')
    return { type: 'Polygon', coordinates: parsePolygon(body.slice(0, end), where) }
  }
  if (kind === 'MultiSurface') {
    const polygons: number[][][][] = []
    for (const member of body.matchAll(/<gml:surfaceMember>([\s\S]*?)<\/gml:surfaceMember>/g)) {
      polygons.push(parsePolygon(member[1] as string, `${where} Teilfläche ${polygons.length + 1}`))
    }
    if (polygons.length === 0) throw new GmlError(`${where}: MultiSurface ohne surfaceMember`)
    return { type: 'MultiPolygon', coordinates: polygons }
  }
  if (kind === 'MultiPoint') {
    const points: number[][] = []
    for (const member of body.matchAll(/<gml:pointMember>([\s\S]*?)<\/gml:pointMember>/g)) {
      points.push(parsePoint(member[1] as string, `${where} Punkt ${points.length + 1}`))
    }
    if (points.length === 0) throw new GmlError(`${where}: MultiPoint ohne pointMember`)
    return { type: 'MultiPoint', coordinates: points }
  }
  throw new GmlError(`${where}: gml:${kind} wird nicht gelesen`)
}

/** Leerer Rumpf (`<a></a>`, `<a/>`) oder reiner Text — alles andere ist ein Abbruch. */
const PROPERTY = /<([A-Za-z_][\w.-]*):([A-Za-z_][\w.-]*)(?:\s[^>]*)?(?:\/>|>([\s\S]*?)<\/\1:\2>)/g

/**
 * Ein einzelner `wfs:member`: Typname, Kennung, Felder, Geometrie.
 *
 * Das Geometriefeld wird zuerst herausgeschnitten, damit die Feldschleife
 * darunter nur noch flache Elemente sieht. `gml:boundedBy` ebenso — es ist
 * eine Aussage des Servers über die Geometrie, kein Sachfeld.
 */
function parseMember(member: string, index: number): GmlFeature {
  const where = `Feature ${index + 1}`
  const head = /<([A-Za-z_][\w.-]*):([A-Za-z_][\w.-]*)((?:\s[^>]*)?)>/.exec(member)
  if (head === null) throw new GmlError(`${where}: kein Feature-Element im wfs:member`)
  const prefix = head[1] as string
  const typeName = `${prefix}:${head[2] as string}`
  const idMatch = /gml:id="([^"]*)"/.exec(head[3] ?? '')
  const id = idMatch === null ? null : (idMatch[1] as string)

  const closing = `</${typeName}>`
  const closingAt = member.lastIndexOf(closing)
  if (closingAt < 0) throw new GmlError(`${where}: ${typeName} wird nicht geschlossen`)
  let body = member.slice(head.index + head[0].length, closingAt)

  body = body.replace(/<gml:boundedBy>[\s\S]*?<\/gml:boundedBy>/g, '')

  // Das Geometriefeld: das Element, dessen Inhalt mit einem gml:-Element
  // beginnt. Genau eines wird erwartet; ein zweites wäre eine Ebene, die
  // dieser Leser nicht kennt.
  let geometry: GmlGeometry | null = null
  const geometryField = /<([A-Za-z_][\w.-]*):([A-Za-z_][\w.-]*)(?:\s[^>]*)?>\s*<gml:[\s\S]*?<\/\1:\2>/.exec(body)
  if (geometryField !== null) {
    geometry = parseGeometry(geometryField[0], where)
    body = body.slice(0, geometryField.index) + body.slice(geometryField.index + geometryField[0].length)
  }

  const properties: Record<string, string> = {}
  for (const match of body.matchAll(PROPERTY)) {
    const name = match[2] as string
    const raw = match[3] ?? ''
    if (raw.includes('<')) {
      throw new GmlError(`${where}: Feld ${name} enthält Markup — verschachtelte Felder werden nicht gelesen`)
    }
    properties[name] = decodeEntities(raw)
  }
  return { id, typeName, properties, geometry }
}

/** Was von der Antwort nach den Features übrig bleiben darf: Leerraum. */
export function parseWfsGml(xml: string): GmlCollection {
  if (/<(ows:)?(Service)?ExceptionReport\b/.test(xml)) {
    // WFS 2.0 schreibt den Text in `ows:ExceptionText`, WMS 1.3 direkt in
    // `ServiceException`; beide Formen kommen von diesem Server.
    const text = /<ows:ExceptionText[^>]*>([^<]*)</.exec(xml) ?? /<ServiceException\b[^>]*>([^<]*)</.exec(xml)
    throw new GmlError(`der Dienst meldet einen Fehler: ${(text?.[1] ?? '').trim() || 'ohne Text'}`)
  }
  if (!/<wfs:FeatureCollection\b/.test(xml)) {
    throw new GmlError('keine wfs:FeatureCollection')
  }
  const header = /<wfs:FeatureCollection\b[^>]*>/.exec(xml)?.[0] ?? ''
  const numberMatched = /numberMatched="(\d+)"/.exec(header)
  const numberReturned = /numberReturned="(\d+)"/.exec(header)
  const srsName = /srsName="([^"]*)"/.exec(xml)

  const features: GmlFeature[] = []
  for (const member of xml.matchAll(/<wfs:member>([\s\S]*?)<\/wfs:member>/g)) {
    features.push(parseMember(member[1] as string, features.length))
  }

  const returned = numberReturned === null ? null : Number(numberReturned[1])
  if (returned !== null && returned !== features.length) {
    throw new GmlError(`numberReturned="${returned}", gelesen wurden ${features.length} Features`)
  }
  return {
    numberMatched: numberMatched === null ? null : Number(numberMatched[1]),
    numberReturned: returned,
    srsName: srsName === null ? null : (srsName[1] as string),
    features,
  }
}
