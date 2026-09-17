/**
 * Der Kasseler Feed-Dialekt — der kürzeste, weil der Feed am wenigsten sagt.
 *
 * Datensatz: Ebene 27 „Bewohnerparkbezirke" des Kartendienstes
 * `Service_Daten/Verkehr_Mobilitaet/MapServer` im Geoportal der Stadt Kassel
 * (ArcGIS Enterprise 11.5), abgerufen am 17. September 2026. 29 Polygone mit
 * **genau einem Sachfeld**: `Name` (`BW1`, `SÜ2`, `VIII`, `Zentrum`). Keine
 * Zeiten, kein Betrag, keine Höchstparkdauer — die stehen in der
 * Parkgebührenordnung der Stadt und am Schild, nicht im Dienst. Kassel ist
 * damit die erste Stadt der **Klasse C**: Jede Zone trägt
 * `scheduleUnknown: true`, und die App sagt „Zeiten unbekannt" statt „frei".
 * Fixtures: `test/fixtures/kassel-bezirke-2026-09-17.json` (die 29
 * Sachdatensätze) und `test/fixtures/kassel-bezirk-vw7-2026-09-17.json` (ein
 * vollständiges Ergebnis mit Loch).
 *
 * Zwei Eigenheiten, die diesen Feed von allen davor unterscheiden:
 *
 *  1. **`query` liefert keine Geometrie.** Die Ebene führt kein
 *     Geometriefeld in ihrer Feldliste, und jede Abfrage — `f=geojson`,
 *     `f=json`, `f=pbf`, mit und ohne `returnGeometry=true` — antwortet mit
 *     `geometry: null` bei vollständigen Sachdaten. Die Geometrie gibt der
 *     Dienst nur über **`identify`** heraus (und je Objekt unter
 *     `/27/<OBJECTID>`). Der Abruf ist deshalb ein `identify` mit einem
 *     Rechteck über die ganze Stadt, `sr=4326`, und die Antwort ist kein
 *     GeoJSON, sondern Esri-JSON: `results[].geometry.rings`, dazu die
 *     Sachdaten **als Zeichenketten** (`"OBJECTID": "1"`), auch die Nummer.
 *  2. **Esri-Ringe sind keine GeoJSON-Polygone.** Ein Esri-Polygon ist eine
 *     flache Liste von Ringen; Außenringe laufen im Uhrzeigersinn, Löcher
 *     dagegen. GeoJSON will je Polygon den Außenring zuerst und die Löcher
 *     dahinter. `esriRingsToPolygons` sortiert das — gemessen an VW7, dem
 *     einen Bezirk mit einem Loch von fünf Stützpunkten.
 *
 * Der Name ist der Zonenschlüssel. Drei Formen kommen vor: Quartierskürzel
 * mit Ziffer (`BW1` … `WT1`, 21-mal), römische Nummer (`II` … `IX`, 7-mal)
 * und `Zentrum` (einmal). Was nicht in eine der drei Formen passt, wird
 * abgewiesen — ein Tippfehler im Dienst soll auffallen, nicht durchrutschen.
 */

import { polygonContains, type PolygonRings, type Position, type Ring } from './geo.js'

export class KasselParseError extends Error {
  constructor(
    readonly raw: string,
    reason: string
  ) {
    super(`Kasseler Feed: ${JSON.stringify(raw)} — ${reason}`)
    this.name = 'KasselParseError'
  }
}

/**
 * Wie in den anderen Parsern: fremde Eingabe wird zuerst begrenzt. Der
 * längste echte Wert ist `Zentrum` mit sieben Zeichen; das Feld selbst hat
 * im Dienst `length: 20`.
 */
const MAX_INPUT_LENGTH = 40

/**
 * Die Sachdaten eines Bezirks, wie `identify` sie liefert: **alles
 * Zeichenketten**, auch `OBJECTID` — anders als bei `query`, wo dieselbe
 * Nummer eine Zahl ist. Beide Felder optional, weil der Dienst sie weglassen
 * könnte und `fixture-shape.test.ts` die beobachtete Form festhält.
 */
export interface KasselZoneAttributes {
  OBJECTID?: string | null
  Name?: string | null
}

/** Ein Esri-Polygon: eine flache Liste von Ringen, jeder `[x, y]`. */
export interface EsriPolygon {
  rings?: Position[][] | null
  spatialReference?: { wkid?: number | null; latestWkid?: number | null } | null
}

/** Ein Eintrag aus `identify?…&f=json` → `results[]`. */
export interface KasselIdentifyResult {
  layerId?: number | null
  layerName?: string | null
  value?: string | null
  displayFieldName?: string | null
  attributes?: KasselZoneAttributes | null
  geometryType?: string | null
  geometry?: EsriPolygon | null
}

/**
 * Welche der drei Namensformen ein Bezirk hat. Die Form trägt keine Regel —
 * die Gebührenzone II umfasst laut Legende des Dienstes alle 28 Bezirke
 * außer `Zentrum` —, aber sie steht in der `note`, damit der Leser sieht,
 * was für ein Schlüssel das ist.
 */
export type KasselZoneKind = 'quartier' | 'nummer' | 'zentrum'

export interface KasselZoneName {
  /** Der Name, so wie er im Feld steht — er ist der Zonenschlüssel. */
  key: string
  kind: KasselZoneKind
}

/** `BW1`, `SÜ2`, `WT1`: zwei Großbuchstaben (Umlaut erlaubt) und eine Ziffer ab 1. */
const QUARTIER = /^[A-ZÄÖÜ]{2}[1-9]$/u
/** Die römischen Nummern, die als Bezirksname vorkommen können — ausdrücklich, nicht als Grammatik. */
const NUMMER = /^(?:I|II|III|IV|V|VI|VII|VIII|IX|X|XI|XII)$/u

/**
 * Liest das Feld `Name` und sagt, welche Form es hat.
 *
 * Wirft bei leerem, zu langem oder fremdem Inhalt — nie ein blankes `Error`,
 * damit `instanceof` in `fuzz.test.ts` „unlesbarer Wert" von „kaputtem
 * Parser" trennen kann.
 */
export function parseKasselZoneName(raw: string | null | undefined): KasselZoneName {
  if (raw === null || raw === undefined) throw new KasselParseError('', 'Bezirk ohne Name')
  if (raw.length > MAX_INPUT_LENGTH) {
    throw new KasselParseError(raw.slice(0, MAX_INPUT_LENGTH), `länger als ${MAX_INPUT_LENGTH} Zeichen`)
  }
  const key = raw.replace(/\s+/gu, ' ').trim()
  if (key === '') throw new KasselParseError(raw, 'Bezirk ohne Name')
  if (key === 'Zentrum') return { key, kind: 'zentrum' }
  if (QUARTIER.test(key)) return { key, kind: 'quartier' }
  if (NUMMER.test(key)) return { key, kind: 'nummer' }
  throw new KasselParseError(raw, 'weder Quartierskürzel mit Ziffer noch römische Nummer noch „Zentrum"')
}

/**
 * Was im Panel unter der Zone steht. Die Zeiten- und Gebührenlücke sagt die
 * Oberfläche selbst (`scheduleUnknown`); hier steht nur, was für ein Gebiet
 * das ist, und woher der Betrag käme, wenn man ihn wüsste.
 */
export function kasselZoneNote(name: KasselZoneName): string {
  const art =
    name.kind === 'zentrum'
      ? 'Bewohnerparkbezirk Zentrum'
      : name.kind === 'nummer'
        ? `Bewohnerparkbezirk ${name.key}`
        : `Bewohnerparkbezirk ${name.key} (Quartierskürzel)`
  return `${art} — Beträge nennt die Parkgebührenordnung der Stadt Kassel je Gebührenzone, nicht je Bezirk`
}

/** Doppelte Fläche nach der Schnürformel; negativ = Uhrzeigersinn, so zeichnet Esri Außenringe. */
function signedArea(ring: Ring): number {
  let sum = 0
  for (let i = 1; i < ring.length; i += 1) {
    const [x1, y1] = ring[i - 1] as Position
    const [x2, y2] = ring[i] as Position
    sum += x1 * y2 - x2 * y1
  }
  return sum
}

function describeRing(ring: readonly unknown[]): string {
  return JSON.stringify(ring).slice(0, MAX_INPUT_LENGTH)
}

/**
 * Aus der flachen Ringliste eines Esri-Polygons die GeoJSON-Polygone.
 *
 * Außenringe (Uhrzeigersinn) werden je ein Polygon; jedes Loch (gegen den
 * Uhrzeigersinn) kommt zu dem Außenring, der seinen ersten Stützpunkt
 * enthält. Ein Ring mit weniger als vier Stützpunkten, ein offener Ring, ein
 * Ring ohne Fläche und ein Loch ohne passenden Außenring werfen — eine
 * Fläche, die sich nicht zeichnen lässt, ist schlechter als keine, weil sie
 * auf der Karte nach „leer" aussieht statt nach einem Fehler.
 *
 * Die Orientierung wird nicht umgedreht: `polygonContains` fragt nur, ob ein
 * Punkt innerhalb liegt, und MapLibre zeichnet beide Richtungen.
 */
export function esriRingsToPolygons(rings: readonly (readonly Position[])[]): PolygonRings[] {
  const outers: { ring: Ring; holes: Ring[] }[] = []
  const holes: Ring[] = []
  for (const ring of rings) {
    if (ring.length < 4) throw new KasselParseError(describeRing(ring), 'Ring mit weniger als vier Stützpunkten')
    const first = ring[0] as Position
    const last = ring[ring.length - 1] as Position
    if (first[0] !== last[0] || first[1] !== last[1]) {
      throw new KasselParseError(describeRing(ring), 'Ring ist nicht geschlossen')
    }
    const area = signedArea(ring)
    if (area === 0) throw new KasselParseError(describeRing(ring), 'Ring ohne Fläche')
    if (area < 0) outers.push({ ring, holes: [] })
    else holes.push(ring)
  }
  for (const hole of holes) {
    const start = hole[0] as Position
    const owner = outers.find((outer) => polygonContains([outer.ring], start))
    if (owner === undefined) throw new KasselParseError(describeRing(hole), 'Loch ohne umschließenden Außenring')
    owner.holes.push(hole)
  }
  if (outers.length === 0) throw new KasselParseError(describeRing(rings), 'kein Außenring')
  return outers.map((outer) => [outer.ring, ...outer.holes])
}
