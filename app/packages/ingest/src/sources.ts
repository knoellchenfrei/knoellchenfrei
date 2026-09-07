/**
 * Amtliche Quellen, nach Stadt.
 *
 * Drei Städte, drei Behörden — und drei Unterschiede, die jeder einzeln einen
 * halben Tag kosten, wenn man sie erst im Datenbau bemerkt:
 *
 * 1. **Ausgabeformat.** Berlin liefert `application/json`, Hamburg kennt das
 *    nicht und will `application/geo+json`, Frankfurts Parken-Dienst will
 *    wieder `application/json` und quittiert Hamburgs Wert mit einem
 *    `ows:ExceptionReport` — Frankfurts Stadtteil-Dienst dagegen läuft auf
 *    MapServer und heißt das Format schlicht `GEOJSON`. Ein falscher Wert
 *    bringt in Berlin keinen Fehler, sondern GML — also gültiges XML, an dem
 *    `JSON.parse` scheitert.
 * 2. **Achsenreihenfolge.** Auf dieselbe Anfrage (`urn:ogc:def:crs:EPSG::4326`)
 *    antwortet Berlin mit `[lon, lat]`, Hamburg mit `[lat, lon]`, Frankfurt
 *    wieder mit `[lon, lat]`. Hamburg hält sich an die URN-Form, die Breite
 *    zuerst vorschreibt; die anderen liefern GeoJSON-Konvention. Alles
 *    verteidigbar, und genau deshalb steht die Reihenfolge hier als Feld: Wer
 *    sie rät, legt Hamburgs Zonen in den Indischen Ozean, und die Karte sieht
 *    dabei aus, als wäre sie nur leer.
 * 3. **Lizenz.** Berlin gibt unter Datenlizenz Deutschland **Zero** 2.0 heraus,
 *    Nennung freiwillig; Hamburg und Frankfurt unter **Namensnennung** 2.0,
 *    Nennung Bedingung. `City.attribution` in `@knoellchenfrei/core` trägt das
 *    bis in die Oberfläche.
 *
 * Und einer, den nur Frankfurt hat: **`srsName` ist dort Pflicht.** Ohne den
 * Parameter antwortet der Dienst stillschweigend in EPSG:25832 —
 * `[477189.85, 5550859.91]`, plausible Zahlen, nur keine Grade. `wfsUrl` setzt
 * ihn für alle Städte; `build-data-frankfurt.ts` prüft die Antwort trotzdem
 * noch einmal, weil ein Wegfall hier auf der Karte nur nach „leer" aussähe.
 */

/** In welcher Reihenfolge der Dienst die Koordinaten schreibt. */
export type AxisOrder = 'lon,lat' | 'lat,lon'

export interface Source {
  key: string
  /** Vollständige Adresse des Dienstes, ohne Abfrageteil. */
  service: string
  typeName: string
  /** Ungefähr, damit ein still abgeschnittener Abruf auffällt. */
  expectedFeatures: number
  outputFormat: string
  axisOrder: AxisOrder
}

const BERLIN_WFS = 'https://gdi.berlin.de/services/wfs'
const HAMBURG_WFS = 'https://geodienste.hamburg.de'

const BERLIN_DEFAULTS = {
  outputFormat: 'application/json',
  axisOrder: 'lon,lat',
} as const

const HAMBURG_DEFAULTS = {
  outputFormat: 'application/geo+json',
  axisOrder: 'lat,lon',
} as const

/**
 * Berlin — Geodateninfrastruktur Berlin, DL-DE/Zero-2.0.
 *
 * Bewusst NICHT abgerufen: `parkplaetze:parkplaetze_aussen`, die 214.173
 * Straßenabschnitte außerhalb des S-Bahn-Rings. Jeder einzelne meldet
 * zone="nicht bewirtschaftet" — außerhalb des Rings wird nicht bewirtschaftet
 * —, die ganze Ebene beantwortet also eine Frage, zum Preis von rund 190 MB.
 * `zoneAt` liefert für „unbewirtschaftet" schon null, und die Oberfläche sagt
 * es in Worten.
 */
const BERLIN_SOURCES: readonly Source[] = [
  { key: 'zones', service: `${BERLIN_WFS}/parkraumbewirtschaftung`, typeName: 'parkraumbewirtschaftung:parkzonen', expectedFeatures: 103, ...BERLIN_DEFAULTS },
  { key: 'segments', service: `${BERLIN_WFS}/parkplaetze`, typeName: 'parkplaetze:parkplaetze', expectedFeatures: 45917, ...BERLIN_DEFAULTS },
  { key: 'parkAndRide', service: `${BERLIN_WFS}/park_and_ride`, typeName: 'park_and_ride:park_and_ride', expectedFeatures: 49, ...BERLIN_DEFAULTS },
  { key: 'parkAndRideUmland', service: `${BERLIN_WFS}/park_and_ride`, typeName: 'park_and_ride:park_and_ride_umland', expectedFeatures: 59, ...BERLIN_DEFAULTS },
  // Ein Feature, 7 KB, und die einzige Ebene, die „darf ich hier überhaupt
  // fahren" beantwortet statt „was kostet Parken".
  { key: 'lowEmissionZone', service: `${BERLIN_WFS}/umweltzone`, typeName: 'umweltzone:umweltzone', expectedFeatures: 1, ...BERLIN_DEFAULTS },
  { key: 'accessible', service: `${BERLIN_WFS}/behindertenparkplaetze`, typeName: 'behindertenparkplaetze:bpark', expectedFeatures: 923, ...BERLIN_DEFAULTS },
  // Nur Kontext: Ohne Hintergrundkarte schweben die Zonenpolygone im Nichts,
  // und Ortsteilgrenzen reichen, um Kreuzberg von Spandau zu unterscheiden.
  { key: 'districts', service: `${BERLIN_WFS}/alkis_ortsteile`, typeName: 'alkis_ortsteile:ortsteile', expectedFeatures: 97, ...BERLIN_DEFAULTS },
]

/**
 * Hamburg — Freie und Hansestadt Hamburg, DL-DE/BY-2.0.
 *
 * Zahlen und Typnamen sind am 6. September 2026 gegen die Dienste selbst
 * geprüft, nicht aus Metadaten übernommen.
 *
 * Bewusst NICHT abgerufen: `de.hh.up:parkraum`, der **öffentliche Parkraum**
 * mit 203.283 Polygonen — je Stellplatz eines. Das ist Hamburgs Gegenstück zu
 * Berlins Straßenabschnitten, und es beantwortet eine andere Frage als diese
 * App: Seine Attribute sind Ausrichtung zur Straße, Markierung, Fahrzeugtyp
 * und Straßenname; ein Tarif steht nicht darin, und das Feld
 * `geltungszeit_primaerer_bewirtschaftung` war in der Stichprobe leer. Für
 * „kostet das hier gerade etwas" trägt die Ebene nichts bei, was die 146
 * Gebiete nicht schon sagen — sie kostet nur ein Vielfaches an Bytes.
 */
const HAMBURG_SOURCES: readonly Source[] = [
  {
    key: 'zones',
    service: `${HAMBURG_WFS}/HH_WFS_bewohnerparkgebiete`,
    typeName: 'de.hh.up:bewohnerparkgebiete',
    expectedFeatures: 146,
    ...HAMBURG_DEFAULTS,
  },
  // Dieselbe Rolle wie Berlins Ortsteile: Ohne Hintergrundkarte schweben die
  // Gebiete sonst im Nichts.
  {
    key: 'districts',
    service: `${HAMBURG_WFS}/HH_WFS_Verwaltungsgrenzen`,
    typeName: 'app:stadtteile',
    expectedFeatures: 104,
    ...HAMBURG_DEFAULTS,
  },
]

/**
 * Frankfurt am Main — Stadt Frankfurt am Main, DL-DE/BY-2.0.
 *
 * Zahlen und Typnamen sind am 7. September 2026 gegen die Dienste selbst
 * geprüft. Zwei Dienste statt einem, und das ist keine Nachlässigkeit: Der
 * Parken-Dienst führt **keine** Verwaltungsgrenzen (`GetCapabilities` kennt
 * genau drei Typnamen, alle unten). Die Stadtteile liegen in
 * `WFS_Stadtgebietsgliederung` — anderer Server (MapServer statt GeoServer),
 * anderes Ausgabeformat, dieselbe Lizenz und derselbe Quellenvermerk.
 *
 * Bewusst NICHT abgerufen: nichts. Anders als Berlin und Hamburg hat
 * Frankfurts Parken-Dienst keine Ebene mit Hunderttausenden Stellplatz-
 * Polygonen; die drei Typnamen sind alles, was er führt.
 *
 * Was der Datensatz **nicht** hergibt, steht in `docs/staedte.md`: keine
 * Stellplatzzahlen, keine Umweltzonen-Geometrie (die Umweltzone gibt es in
 * Frankfurt, dieser Dienst führt sie nur nicht), und für 113 der 921
 * Automaten kein Polygon.
 */
const FRANKFURT_PARKEN = 'https://geowebdienste.frankfurt.de/Parken'

const FRANKFURT_DEFAULTS = {
  // NICHT `application/geo+json` wie Hamburg: Darauf antwortet dieser Dienst
  // mit einem `ows:ExceptionReport`. Immerhin ein Fehler und nicht, wie in
  // Berlin, stilles GML.
  outputFormat: 'application/json',
  axisOrder: 'lon,lat',
} as const

const FRANKFURT_SOURCES: readonly Source[] = [
  {
    key: 'zones',
    service: FRANKFURT_PARKEN,
    typeName: 'opendata:Bewohnerparken',
    expectedFeatures: 42,
    ...FRANKFURT_DEFAULTS,
  },
  // Die eigentliche Sachauskunft. Tarif, Geltungszeit und Höchstparkdauer
  // hängen in Frankfurt am Automaten, nicht am Gebiet — ohne diese Ebene
  // wüsste die App von einem Bereich nur, dass es ihn gibt.
  {
    key: 'automats',
    service: FRANKFURT_PARKEN,
    typeName: 'opendata:Parkscheinautomaten',
    expectedFeatures: 921,
    ...FRANKFURT_DEFAULTS,
  },
  {
    key: 'accessible',
    service: FRANKFURT_PARKEN,
    typeName: 'opendata:Behindertenparkplaetze',
    expectedFeatures: 458,
    ...FRANKFURT_DEFAULTS,
  },
  // Dieselbe Rolle wie Berlins Ortsteile und Hamburgs Stadtteile: Ohne
  // Hintergrundkarte schweben die Bereiche sonst im Nichts — und der Feed
  // nennt zu einem Bereich nicht einmal einen Namen, nur eine Nummer.
  //
  // Eigener Dienst, und deshalb ein eigenes Ausgabeformat: Dahinter steht ein
  // MapServer, der `application/json` nicht kennt und das Format `GEOJSON`
  // nennt. Die Achsen kommen auch hier als `[lon, lat]`.
  {
    key: 'districts',
    service: 'https://geowebdienste.frankfurt.de/WFS_Stadtgebietsgliederung',
    typeName: 'Stadtgebietsgliederung:Stadtteile',
    expectedFeatures: 46,
    outputFormat: 'GEOJSON',
    axisOrder: 'lon,lat',
  },
]

const BY_CITY: Record<string, readonly Source[]> = {
  berlin: BERLIN_SOURCES,
  hamburg: HAMBURG_SOURCES,
  frankfurt: FRANKFURT_SOURCES,
}

/**
 * Die Quellen einer Stadt.
 *
 * Wirft bei einem unbekannten Schlüssel. Eine leere Liste zurückzugeben hieße:
 * Der Abruf meldet Erfolg, ohne etwas geholt zu haben, und der Datenbau baut
 * danach aus dem Nichts.
 */
export function citySources(cityKey: string): readonly Source[] {
  const sources = BY_CITY[cityKey]
  if (sources === undefined) {
    throw new Error(
      `Keine Quellen für "${cityKey}" — bekannt sind: ${Object.keys(BY_CITY).join(', ')}`,
    )
  }
  return sources
}

/** Die Stadt, die gerade gebaut wird. Ohne Angabe Berlin, wie überall sonst. */
export const CITY_KEY = process.env.CITY ?? 'berlin'

/** Die Quellen der Stadt, die heute gebaut wird. */
export const SOURCES: readonly Source[] = citySources(CITY_KEY)

export function wfsUrl(source: Source): string {
  const params = new URLSearchParams({
    service: 'WFS',
    version: '2.0.0',
    request: 'GetFeature',
    typeNames: source.typeName,
    outputFormat: source.outputFormat,
    srsName: 'urn:ogc:def:crs:EPSG::4326',
  })
  return `${source.service}?${params}`
}

/**
 * Dreht eine Koordinatenliste an Ort und Stelle in GeoJSON-Reihenfolge.
 *
 * Rekursiv über die verschachtelten Arrays, weil dieselbe Funktion Punkte,
 * Linien, Polygone und Multipolygone treffen muss. Ein `[lat, lon]`-Paar
 * erkennt man nicht am Wert — in Hamburg wären beide Zahlen plausibel
 * zweistellig —, deshalb entscheidet die Konfiguration und nicht die Heuristik.
 */
export function toGeoJsonAxes(coordinates: unknown, order: AxisOrder): unknown {
  if (order === 'lon,lat') return coordinates
  if (!Array.isArray(coordinates)) return coordinates
  if (typeof coordinates[0] === 'number' && typeof coordinates[1] === 'number') {
    const [lat, lon, ...rest] = coordinates as number[]
    return [lon, lat, ...rest]
  }
  return coordinates.map((node) => toGeoJsonAxes(node, order))
}
