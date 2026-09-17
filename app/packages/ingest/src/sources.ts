/**
 * Amtliche Quellen, nach Stadt.
 *
 * Vier Städte, vier Behörden — und drei Unterschiede, die jeder einzeln einen
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
  /**
   * Wie die Antwort kodiert ist. Fehlt das Feld, ist es GeoJSON — der
   * Normalfall seit Berlin. `'gml'` heißt: Der Dienst kann kein JSON, die
   * Antwort landet als `<key>.gml` im Abzug und wird im Datenbau mit
   * `gml.ts` gelesen. Schwerin ist der erste Fall.
   */
  encoding?: 'gml'
  /**
   * Welches Koordinatensystem angefragt wird. Fehlt das Feld, ist es
   * `urn:ogc:def:crs:EPSG::4326` — Grad, für alle Städte, die umrechnen.
   * Ein anderer Wert steht nur da, wo der Dienst Grad **verweigert**
   * (Schwerin: jedes andere `srsName` endet in `Invalid SRS`), und der
   * Datenbau prüft dann mit `assertUtm`, dass wirklich Meter ankommen.
   */
  srsName?: string
  /**
   * Ein OGC-Filter (XML, unkodiert) — nur für Dienste, die ganze Länder
   * führen. PDOKs CBS-Wijken liegen für alle 342 Gemeinden in einer Ebene;
   * ohne Filter kämen 3.000 Wijken statt der zehn Utrechter.
   */
  filter?: string
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
 * München — Landeshauptstadt München, DL-DE/BY-2.0.
 *
 * Zahlen und Typnamen sind am 7. September 2026 mit `resultType=hits` gegen den
 * Dienst selbst geprüft, nicht aus Metadaten übernommen.
 *
 * Zwei Dienste auf **einem** Server: `mor_wfs` (Mobilitätsreferat) führt 68
 * Ebenen und darunter alles zum Parken; die Verwaltungsgrenzen liegen im
 * Arbeitsbereich `gsm_wfs` (GeodatenService). Gefunden über den offenen
 * Datenkatalog der Stadt (`opendata.muenchen.de/api/3/action/package_search`),
 * nicht durch Raten von Endpunkten — dasselbe Vorgehen wie bei Frankfurts
 * Stadtteilen. Die Sammel-Adresse `/geoserver/ows` antwortet mit
 * `ServiceUnavailable: Service WFS is disabled`; jeder Arbeitsbereich muss
 * einzeln angefragt werden.
 *
 * Die Lizenz ist für **jede** Ebene einzeln aus ihrem ISO-Metadatensatz
 * geprüft (`MetadataURL` aus `GetCapabilities`, `/metadata/srv/api/records/…`).
 * Alle nennen `dl-de-by-2.0`; die Parkebenen den Quellenvermerk
 * `Datenquelle: dl-de/by-2-0: Landeshauptstadt München – opendata.muenchen.de`,
 * die Stadtbezirke abweichend den GeodatenService. Beides steht in
 * `docs/staedte.md`.
 *
 * Bewusst NICHT abgerufen: `ruhver_els_saeule_point` (592 Ladesäulen) neben
 * `ruhver_els_standort_point` (369 Standorte) — dieselben Orte, nur feiner
 * gezählt; zwei Punkte übereinander sind auf der Karte kein Gewinn. Und die
 * 40 übrigen Ebenen des Dienstes (Radwege, Ampeln, Baustellen, Bushaltestellen
 * …) beantworten andere Fragen als „was kostet Parken hier".
 */
const MUENCHEN_MOR = 'https://geoportal.muenchen.de/geoserver/mor_wfs/ows'

const MUENCHEN_DEFAULTS = {
  // GeoServer wie in Berlin und Frankfurt: `application/json`. Hamburgs
  // `application/geo+json` steht in `GetCapabilities` gar nicht erst.
  outputFormat: 'application/json',
  // `DefaultCRS` ist EPSG:25832 — ohne `srsName` kämen also UTM-Meter.
  // `wfsUrl` setzt ihn; die Antwort ist dann `[11.573, 48.156]`, also
  // `[lon, lat]` wie in Berlin und Frankfurt und anders als in Hamburg.
  axisOrder: 'lon,lat',
} as const

const MUENCHEN_SOURCES: readonly Source[] = [
  {
    key: 'zones',
    service: MUENCHEN_MOR,
    typeName: 'mor_wfs:ruhver_prm_gebiete_poly',
    expectedFeatures: 82,
    ...MUENCHEN_DEFAULTS,
  },
  // Die eigentliche Sachauskunft, und die größte Datei des Projekts: 6,5 MB.
  // Wie in Frankfurt hängen Zeiten nicht am Gebiet, sondern eine Ebene tiefer
  // — hier an der einzelnen Straßenseite. Ohne sie wüsste die App von einem
  // Gebiet nur, dass es existiert.
  {
    key: 'sides',
    service: MUENCHEN_MOR,
    typeName: 'mor_wfs:ruhver_parkseiten_line',
    expectedFeatures: 13714,
    ...MUENCHEN_DEFAULTS,
  },
  // Anders als Hamburg und Frankfurt liefert München die Umweltzone mit —
  // als 12 Polygone, nicht als eines: die Zone selbst und elf Transferflächen.
  {
    key: 'lowEmissionZone',
    service: MUENCHEN_MOR,
    typeName: 'mor_wfs:miv_umweltzone_poly',
    expectedFeatures: 12,
    ...MUENCHEN_DEFAULTS,
  },
  {
    key: 'accessible',
    service: MUENCHEN_MOR,
    typeName: 'mor_wfs:behindertenparkplaetze',
    expectedFeatures: 556,
    ...MUENCHEN_DEFAULTS,
  },
  {
    key: 'parkAndRide',
    service: MUENCHEN_MOR,
    typeName: 'mor_wfs:park_ride_standorte',
    expectedFeatures: 25,
    ...MUENCHEN_DEFAULTS,
  },
  {
    key: 'charging',
    service: MUENCHEN_MOR,
    typeName: 'mor_wfs:ruhver_els_standort_point',
    expectedFeatures: 369,
    ...MUENCHEN_DEFAULTS,
  },
  {
    key: 'carsharing',
    service: MUENCHEN_MOR,
    typeName: 'mor_wfs:ruhver_carsharing',
    expectedFeatures: 710,
    ...MUENCHEN_DEFAULTS,
  },
  // Dieselbe Rolle wie Berlins Ortsteile: Ohne Hintergrundkarte schweben die
  // Gebiete sonst im Nichts. Anderer Arbeitsbereich, gleiche Lizenz, anderer
  // Quellenvermerk — siehe oben.
  {
    key: 'districts',
    service: 'https://geoportal.muenchen.de/geoserver/gsm_wfs/ows',
    typeName: 'gsm_wfs:vablock_stadtbezirk',
    expectedFeatures: 27,
    ...MUENCHEN_DEFAULTS,
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

/**
 * Köln — Stadt Köln, DL-DE/Zero-2.0.
 *
 * Die einzige Stadt, deren Dienst `srsName` **nicht** beachtet. Er dreht die
 * Achsen nach dem angefragten System und beschriftet die Geometrie damit,
 * rechnet aber nie um: Es kommen immer UTM-Meter in EPSG:25832.
 * `build-data-koeln.ts` rechnet deshalb selbst (`utm32.ts`) und prüft mit
 * `assertUtm`, dass wirklich Meter ankommen. Details in
 * `docs/staedte-koeln.md`.
 *
 * Bewusst NICHT abgerufen: `ms:bewohnerparkgebiete_weiche_grenzen` (15
 * Linien). Sie markieren, wo ein Bewohnerausweis beidseitig gilt — eine
 * Auskunft für Bewohner, nicht für die Frage „kostet Parken hier gerade
 * etwas".
 */
const KOELN_SOURCES: readonly Source[] = [
  {
    key: 'zones',
    service: 'https://geoportal.stadt-koeln.de/wss/service/bewohnerparken_wfs/guest',
    typeName: 'ms:bewohnerparkgebiete_zonen',
    expectedFeatures: 47,
    // MapServer, und der Wert trägt Semikolon und Leerzeichen — er muss
    // URL-kodiert in die Anfrage. `URLSearchParams` in `wfsUrl` tut das.
    outputFormat: 'application/json; subtype=geojson',
    // Gemessen, nicht geraten: Im GeoJSON kommt [Ost, Nord], und zwar mit und
    // ohne `srsName` byteweise identisch. Im GML dreht der Dienst sehr wohl —
    // sollte er das eines Tages auch im GeoJSON tun, bricht `utm32ToWgs84` ab,
    // weil ein Nordwert im Ostwert die Zonengrenze sprengt.
    axisOrder: 'lon,lat',
  },
]

/**
 * Düsseldorf — Landeshauptstadt Düsseldorf, DL-DE/Zero-2.0.
 *
 * Zahlen und Typnamen sind am 8. September 2026 mit `resultType=hits` gegen
 * die Dienste selbst geprüft, nicht aus Metadaten übernommen.
 *
 * Zwei Dienste, weil der Verkehrs-WFS keine Verwaltungsgrenzen führt — wie in
 * Frankfurt und München. Gefunden wurden beide über den Katalog: Der
 * Portal-Datensatz „Allgemeine Behindertenparkplätze" hat als Distribution
 * wörtlich einen Aufruf von `services/verkehr/wfs`; von dort führt der
 * Sitemap-Nachbar `services/grenzen/wfs` zu den Stadtteilen. Geratene Namen
 * (`geodaten.duesseldorf.de`, `/geoserver/ows`) ergaben 404.
 *
 * **`srsName` ist Pflicht.** `DefaultCRS` ist bei jeder Ebene EPSG:25832;
 * ohne den Parameter kommen UTM-Meter (`[345550.30, 5676562.02]`). Und die
 * Antwort ist FALSCH beschriftet: Der Dienst schreibt
 * `urn:ogc:def:crs:EPSG::4326` an die Geometrie — die Form, die die Breite
 * zuerst vorschreibt — und liefert dann `[lon, lat]`. Deshalb steht die
 * Reihenfolge hier und wird nicht aus der Antwort gelesen.
 *
 * Bewusst NICHT abgerufen: `verkehr:sharingstationen_point` (331 Punkte,
 * mischt Auto-, Rad- und Rollersharing ohne sauberes Unterscheidungsmerkmal),
 * `verkehr:parkhaus` (44), `verkehr:quartiersgaragen` (77),
 * `verkehr:feierabendparken` (25), `verkehr:motorradstellplatz` (12) und die
 * sechs Ebenen, die gar nichts mit Parken zu tun haben. Details in
 * `docs/staedte-duesseldorf.md`.
 */
const DUESSELDORF_VERKEHR = 'https://maps.duesseldorf.de/services/verkehr/wfs'

const DUESSELDORF_DEFAULTS = {
  outputFormat: 'application/json',
  axisOrder: 'lon,lat',
} as const

const DUESSELDORF_SOURCES: readonly Source[] = [
  // 65 Merkmale für 44 Gebiete: Elf Gebiete kommen in mehreren Stücken, jedes
  // mit eigener `_uuid` und gleichen Sachdaten. `build-data-duesseldorf.ts`
  // gruppiert deshalb auf `kuerzel`.
  {
    key: 'zones',
    service: DUESSELDORF_VERKEHR,
    typeName: 'verkehr:bewohnerparken',
    expectedFeatures: 65,
    ...DUESSELDORF_DEFAULTS,
  },
  // Tarif, Tarifzeit und Höchstparkdauer. Der Betrag wird heute NICHT
  // ausgeliefert — der Datensatz steht in keinem Katalog, und der Dienst
  // beantwortet die Lizenzfrage nicht. Siehe `AUTOMATS_LICENCE_CONFIRMED`.
  {
    key: 'automats',
    service: DUESSELDORF_VERKEHR,
    typeName: 'verkehr:parkscheinautomaten',
    expectedFeatures: 732,
    ...DUESSELDORF_DEFAULTS,
  },
  {
    key: 'accessible',
    service: DUESSELDORF_VERKEHR,
    typeName: 'verkehr:behindertenparkplatz',
    expectedFeatures: 340,
    ...DUESSELDORF_DEFAULTS,
  },
  // Reicht über die Stadtgrenze hinaus (Meerbusch, Langenfeld, Neuss) — das
  // ist Absicht der Stadt und bleibt so.
  {
    key: 'parkAndRide',
    service: DUESSELDORF_VERKEHR,
    typeName: 'verkehr:park_ride',
    expectedFeatures: 48,
    ...DUESSELDORF_DEFAULTS,
  },
  // Ein Polygon, seit 2009, seit 2013 erweitert. Düsseldorf ist damit nach
  // Berlin und München die dritte Stadt mit Umweltzonen-Geometrie im Abzug.
  {
    key: 'lowEmissionZone',
    service: DUESSELDORF_VERKEHR,
    typeName: 'verkehr:umweltzone',
    expectedFeatures: 1,
    ...DUESSELDORF_DEFAULTS,
  },
  // Dieselbe Rolle wie Berlins Ortsteile: Ohne Hintergrundkarte schweben die
  // Gebiete sonst im Nichts. Anderer Dienst, anderes Amt (Statistik und
  // Wahlen), dieselbe Lizenz. Die zehn Stadtbezirke wären die gröbere Wahl;
  // 50 Stadtteile verorten „Unterbilk" besser als „Stadtbezirk 3".
  {
    key: 'districts',
    service: 'https://maps.duesseldorf.de/services/grenzen/wfs',
    typeName: 'grenzen:stadtteile',
    expectedFeatures: 50,
    ...DUESSELDORF_DEFAULTS,
  },
]

/**
 * Karlsruhe — Stadt Karlsruhe über die TechnologieRegion, CC BY 4.0.
 *
 * Zahlen und Typnamen sind am 8. September 2026 mit `resultType=hits` gegen den
 * Dienst selbst geprüft, nicht aus Metadaten übernommen.
 *
 * **Ein Dienst, 41 Typnamen — und keiner davon nur für Karlsruhe.**
 * `mobil.trk.de` gehört der TechnologieRegion und führt elf Gemeinden bis nach
 * Haguenau und Saverne im Elsass. Der Filter sitzt deshalb nicht hier, sondern
 * im Datenbau: `isKarlsruheMachine` in `@knoellchenfrei/core`. Eine
 * WFS-Filterabfrage wäre der elegantere Weg, macht die Adresse aber von der
 * Filtersyntax des Servers abhängig — und `expectedFeatures` unten prüft dann
 * nicht mehr, ob der Abruf still abgeschnitten wurde.
 *
 * Bewusst NICHT abgerufen: `TBA:carsharing_stationen` (führt keine `gemeinde`
 * und reicht bis Kaiserslautern), `TBA:parkscheiben` (363 Punkte,
 * Parkscheibenzonen — eine eigene Frage, die diese App heute nicht stellt),
 * `TBA:umweltzonen` (TRK-weit, ohne `gemeinde`, ungeprüft) und die 34 übrigen
 * Ebenen (Baustellen, Blitzer, Fähren, Traumrouten …).
 */
const KARLSRUHE_TBA = 'https://mobil.trk.de/geoserver/TBA/ows'

const KARLSRUHE_DEFAULTS = {
  // GeoServer wie in Berlin, Frankfurt und München: `application/json`.
  // Hamburgs `application/geo+json` quittiert dieser Dienst mit HTTP 400.
  outputFormat: 'application/json',
  // `DefaultCRS` ist EPSG:25832 — ohne `srsName` kämen also UTM-Meter.
  // `wfsUrl` setzt ihn; die Antwort ist dann `[8.4589, 48.9976]`, also
  // `[lon, lat]` wie überall ausser in Hamburg.
  axisOrder: 'lon,lat',
} as const

const KARLSRUHE_SOURCES: readonly Source[] = [
  // Die „Zonen" sind hier die Stellplatzflächen selbst — 282 Polygone von im
  // Median 128 m². Sie tragen kein einziges Sachdatum; Begründung und
  // Messungen in `docs/staedte-karlsruhe.md`.
  {
    key: 'zones',
    service: KARLSRUHE_TBA,
    typeName: 'TBA:parkscheinautomaten_flaechen',
    expectedFeatures: 282,
    ...KARLSRUHE_DEFAULTS,
  },
  // Die eigentliche Sachauskunft. Wie in Frankfurt und München hängen Tarif und
  // Zeiten nicht an der Fläche, sondern am Automaten daneben.
  {
    key: 'machines',
    service: KARLSRUHE_TBA,
    typeName: 'TBA:parkscheinautomaten',
    expectedFeatures: 638,
    ...KARLSRUHE_DEFAULTS,
  },
  {
    key: 'accessible',
    service: KARLSRUHE_TBA,
    typeName: 'TBA:behinderten_parkplaetze',
    expectedFeatures: 694,
    ...KARLSRUHE_DEFAULTS,
  },
  {
    key: 'parkAndRide',
    service: KARLSRUHE_TBA,
    typeName: 'TBA:park_ride',
    expectedFeatures: 171,
    ...KARLSRUHE_DEFAULTS,
  },
]

/**
 * Freiburg im Breisgau — Stadt Freiburg, DL-DE/BY-2.0.
 * Rostock — Hanse- und Universitätsstadt Rostock, CC0 1.0.
 *
 * Zahlen und Typnamen sind am 16. September 2026 mit `resultType=hits` gegen
 * die Dienste selbst geprüft, nicht aus Metadaten übernommen.
 *
 * Zwei Dienste auf **einem** MapServer (`geoportal.freiburg.de`): `gut_parken`
 * (Garten- und Tiefbauamt) führt alles zum Parken, die Stadtteile liegen in
 * `abi_gliederung` (Amt für Bürgerservice und Informationsverarbeitung).
 * Gefunden über den GeoNetwork-Katalog der Stadt
 * (`geodaten.freiburg.de/geonetwork/srv/api/search/records/_search`,
 * Datensatz „Stadtteile der Stadt Freiburg i. Br."), nicht durch Raten.
 * Beide Dienste nennen in `ows:Fees` wörtlich dieselbe Lizenz und denselben
 * Quellenvermerk „Datengrundlage: Stadt Freiburg, www.freiburg.de".
 *
 * **`srsName` ist Pflicht.** `DefaultCRS` ist EPSG:25832; ohne den Parameter
 * kommen UTM-Meter (`[412031.0, 5317230.4]`) — anders als Frankfurt sagt der
 * Dienst es immerhin dazu (`crs` im GeoJSON). Mit `srsName` kommt `[lon, lat]`
 * ohne `crs`-Objekt. Und das Ausgabeformat verlangt den **ganzen** Wert aus
 * `GetCapabilities` samt `charset`: `application/json; subtype=geojson`
 * allein (Kölns Form) quittiert der Dienst mit HTTP 400.
 *
 * Bewusst NICHT abgerufen: `ms:bewohnerparken` (33 Bewohnerparkgebiete ohne
 * Zeit und Betrag — sie sagen, wo ein Bewohnerausweis gilt, nicht, was
 * Parken kostet; Begründung in `docs/staedte-freiburg.md`),
 * `ms:behindertenparkplatz_detail` (328 Polygone, je Stellplatz eines; die
 * Übersichtsebene mit 195 Standorten reicht für ein Symbol) und
 * `ms:gesperrte_flaechen_pr` (6 gesperrte Flächen auf P+R-Anlagen).
 */
const FREIBURG_GUT_PARKEN = 'https://geoportal.freiburg.de/wfs/gut_parken/gut_parken'

const FREIBURG_DEFAULTS = {
  outputFormat: 'application/json; subtype=geojson; charset=utf-8',
  axisOrder: 'lon,lat',
} as const

const FREIBURG_SOURCES: readonly Source[] = [
  // Die Flächen tragen Zeit und Betrag selbst — wie Hamburg, nicht wie
  // Frankfurt. Nur eine schreibt „Beschilderung beachten!" statt einer Zeit;
  // für sie braucht der Datenbau die Automaten.
  {
    key: 'zones',
    service: FREIBURG_GUT_PARKEN,
    typeName: 'ms:parkgebzonen',
    expectedFeatures: 37,
    ...FREIBURG_DEFAULTS,
  },
  // Zeiten, Tarif und Höchstparkdauer je Automat: Gegenprobe zur Fläche,
  // Quelle der Höchstparkdauer, und für die Altstadt die einzige Zeit.
  {
    key: 'automats',
    service: FREIBURG_GUT_PARKEN,
    typeName: 'ms:psa',
    expectedFeatures: 538,
    ...FREIBURG_DEFAULTS,
  },
  {
    key: 'accessible',
    service: FREIBURG_GUT_PARKEN,
    typeName: 'ms:behindertenparkpl_uebersicht',
    expectedFeatures: 195,
    ...FREIBURG_DEFAULTS,
  },
  // Dieselbe Rolle wie Berlins Ortsteile: Ohne Hintergrundkarte schweben die
  // Flächen sonst im Nichts. 28 Stadtteile; die 42 Stadtbezirke desselben
  // Dienstes wären die feinere, die 28 die geläufige Gliederung.
  {
    key: 'districts',
    service: 'https://geoportal.freiburg.de/wfs/abi_gliederung/abi_gliederung',
    typeName: 'ms:stadtteile',
    expectedFeatures: 28,
    ...FREIBURG_DEFAULTS,
  },
]

/**
 * Rostock — Hanse- und Universitätsstadt Rostock, CC0 1.0.
 *
 * Zahlen und Typnamen sind am 16. September 2026 mit `resultType=hits` gegen
 * die Dienste selbst geprüft, nicht aus Metadaten übernommen.
 *
 * **Ein Dienst je Datensatz.** `geo.sv.rostock.de/geodienste/<name>/wfs` führt
 * genau einen Typnamen; die drei Ebenen kommen also von drei Adressen
 * desselben Servers. Gefunden über den CKAN-Katalog der Stadt
 * (`opendata-hro.de/api/3/action/package_search`), der zu jedem Datensatz die
 * WFS-Adresse und daneben fertige Downloads (GeoJSON, CSV, GML) nennt.
 *
 * **Ausgabeformat `application/geo+json`**, wie Hamburg — `application/json`
 * weist der Dienst mit `InvalidParameterValue` ab. Und die Achsen sind
 * Hamburgs: Mit `srsName=urn:ogc:def:crs:EPSG::4326` antwortet der Dienst
 * `[54.0873, 12.1383]`, also **`[lat, lon]`**. Gemessen, nicht geraten — und
 * mit einer Falle daneben: **Ohne** `srsName` liefert derselbe Dienst im
 * GeoJSON `[12.1383, 54.0873]` in Grad, obwohl `DefaultCRS` EPSG:25833 ist.
 * Wer den Parameter weglässt, bekommt also die andere Reihenfolge, nicht
 * UTM-Meter. Der fertige GeoJSON-Download ist ebenfalls `[lon, lat]`. Weil
 * `wfsUrl` den Parameter für alle Städte setzt, steht hier `lat,lon`, und
 * `assertDegrees` im Datenbau prüft die Grade trotzdem.
 *
 * Bewusst NICHT abgerufen: die fertigen Downloads. Sie sind `[lon, lat]`
 * ohne `crs`, tragen aber nicht die `bezeichnung` des Standorts — und die
 * steht im Panel. Dafür eine Eigenheit des WFS, die der Download nicht hat:
 * Ein leeres Feld wird **weggelassen**, nicht als `null` geführt (80 von 111
 * Automaten ohne `normaltarif_gebuehren_max`, zwei ohne
 * `normaltarif_gebuehren_pro_stunde`), und `bewohnerparkgebiet` ist bei 63
 * Automaten ein Leerstring. `fixture-shape.test.ts` hält beides fest.
 * Details in `docs/staedte-rostock.md`.
 */
const ROSTOCK_WFS = 'https://geo.sv.rostock.de/geodienste'

const ROSTOCK_DEFAULTS = {
  outputFormat: 'application/geo+json',
  axisOrder: 'lat,lon',
} as const

const ROSTOCK_SOURCES: readonly Source[] = [
  // Die einzigen Flächen im Feed. Die Tarifzonen A–D und W der
  // Parkgebührenordnung gibt es nur als PDF-Karte.
  {
    key: 'zones',
    service: `${ROSTOCK_WFS}/bewohnerparkgebiete/wfs`,
    typeName: 'hro.bewohnerparkgebiete.bewohnerparkgebiete',
    expectedFeatures: 10,
    ...ROSTOCK_DEFAULTS,
  },
  // Die eigentliche Sachauskunft. Wie in Frankfurt hängen Tarif, Zeiten und
  // Höchstparkdauer am Automaten, nicht am Gebiet.
  {
    key: 'automats',
    service: `${ROSTOCK_WFS}/parkscheinautomaten/wfs`,
    typeName: 'hro.parkscheinautomaten.parkscheinautomaten',
    expectedFeatures: 111,
    ...ROSTOCK_DEFAULTS,
  },
  // Dieselbe Rolle wie Berlins Ortsteile: Kartenkontext, und der Rahmen der
  // Stadt für `reportBounds`. 31 Ortsteile, jeder mit `gemeindeteil_name`.
  {
    key: 'districts',
    service: `${ROSTOCK_WFS}/ortsteile/wfs`,
    typeName: 'hro.ortsteile.ortsteile',
    expectedFeatures: 31,
    ...ROSTOCK_DEFAULTS,
  },
]

/**
 * Cottbus/Chóśebuz — Stadt Cottbus, DL-DE/BY-2.0.
 *
 * **Kein WFS.** Die Stadt betreibt ein ArcGIS Enterprise
 * (`datenportal.cottbus.de/server/rest/services`), und beide Parkebenen
 * liegen als FeatureServer im Ordner `FB32`. Ein FeatureServer kennt weder
 * `typeNames` noch `outputFormat` noch `srsName`; die Abfrage ist
 * `…/FeatureServer/<n>/query?where=1%3D1&outFields=*&f=geojson&outSR=4326`.
 * Deshalb steht Cottbus hier mit einer **leeren** WFS-Liste und zwei
 * Einträgen in `COTTBUS_FILES` — dieselbe Form wie Kölns CSV, nur zweimal.
 *
 * Gemessen am 16. September 2026: `outSR=4326` wirkt (`[14.313, 51.743]`,
 * also `[lon, lat]`); **ohne** den Parameter antwortet der Dienst im
 * GeoJSON ebenfalls in Grad, das Layer-CRS ist trotzdem EPSG:25833 — der
 * Parameter bleibt gesetzt und `assertDegrees` im Datenbau misst nach.
 * `maxRecordCount` ist 2000, `exceededTransferLimit` fehlt in beiden
 * Antworten; `fetch.ts` prüft das Feld, weil ein Dienst, der es eines Tages
 * auf `true` setzt, einen abgeschnittenen Abzug mit 200 liefert.
 *
 * Bewusst NICHT abgerufen: `Daten_Admin/Ortsteile` (19 Polygone) und
 * `FB33/Stadtgrenze` — für keine der beiden Ebenen führt das Open-Data-Portal
 * einen Eintrag mit Lizenz, nur die Parkebenen tragen den
 * DL-DE/BY-2.0-Vermerk. Die Stadtgrenze diente nur zum Messen der
 * `reportBounds`. `FB32/Parkplätze`, `Fahrradboxen` und `Taxistandplätze`
 * beantworten andere Fragen.
 */
const COTTBUS_SOURCES: readonly Source[] = []

/**
 * Schwerin — Landeshauptstadt Schwerin, DL-DE/BY-2.0, gehostet vom Landkreis
 * Ludwigslust-Parchim.
 *
 * Zahlen und Typnamen sind am 16. September 2026 gegen die Dienste selbst
 * geprüft (`numberMatched` in der Antwort), nicht aus Metadaten übernommen.
 * Zwei Dinge, die keine andere Stadt hat:
 *
 * 1. **Kein JSON.** Die `GetCapabilities` nennen vier Ausgabeformate, alle
 *    GML; jedes JSON-Format endet in `is not a permitted output format`.
 *    Deshalb `encoding: 'gml'` und `gml.ts` im Datenbau.
 * 2. **Nur EPSG:25833.** `srsName=urn:ogc:def:crs:EPSG::4326`, `EPSG:4326`,
 *    `EPSG:4258`, `CRS:84` und `EPSG:3857` enden alle in `Invalid SRS`; die
 *    Capabilities des Parken-Dienstes nennen kein `OtherCRS`. Angefragt wird
 *    deshalb ausdrücklich 25833, die Achsen kommen als [Ost, Nord], und
 *    `build-data-schwerin.ts` rechnet mit `utm.ts` in Zone 33 um — und
 *    prüft vorher mit `assertUtm`, dass wirklich Meter ankommen.
 *
 * Der Raumgliederungs-Dienst daneben (`raumgliederung-sn`) **könnte** Grad
 * liefern (EPSG:4326 steht dort als `OtherCRS`, mit [Breite, Länge]); er
 * wird trotzdem in 25833 abgerufen, damit alle vier Ebenen denselben Weg
 * gehen und der Datenbau eine Prüfung hat statt zwei. Seine Grad-Antwort
 * dient in `test/utm.test.ts` als Referenz für die Umrechnung.
 *
 * Bewusst NICHT abgerufen: `masterportal:Parken` (40 Parkplätze und
 * Parkhäuser mit Stellplatzzahl — die App hat keine POI-Art dafür),
 * `masterportal:Wohnmobilstellplaetze` (11), `masterportal:P_and_R`
 * (`numberMatched="0"`) und `masterportal:Parkplaetze_SN` (antwortet mit
 * `ms_error->code not found`, HTTP 400). Die Bezirks- und Baublockgrenzen
 * des Raumgliederungs-Dienstes sind gröber bzw. feiner als die 27
 * Stadtteile und beantworten keine Frage, die die App stellt.
 */
const SCHWERIN_PARKEN = 'https://geoportal.kreis-lup.de/ows/masterportal/parken-sn'

const SCHWERIN_DEFAULTS = {
  // MapServer, GML 3.2 — das erste der vier Formate aus den Capabilities.
  outputFormat: 'application/gml+xml; version=3.2',
  // In EPSG:25833 schreibt MapServer Ost vor Nord; nachgemessen am
  // 16. September 2026 (`262237.215592 5949291.058336`).
  axisOrder: 'lon,lat',
  encoding: 'gml',
  srsName: 'urn:ogc:def:crs:EPSG::25833',
} as const

const SCHWERIN_SOURCES: readonly Source[] = [
  // 15 Polygone **ohne ein einziges Attribut** — nicht einmal eine Kennung.
  // Welche Zone welche ist, sagt nur die Kartendarstellung des Dienstes;
  // `SCHWERIN_ZONE_ANCHORS` in `core` hält das Ergebnis dieser Messung.
  {
    key: 'zones',
    service: SCHWERIN_PARKEN,
    typeName: 'masterportal:Parkzonen',
    expectedFeatures: 15,
    ...SCHWERIN_DEFAULTS,
  },
  // Die eigentliche Sachauskunft: Zeiten, Betrag, Höchstparkdauer je Automat.
  {
    key: 'automats',
    service: SCHWERIN_PARKEN,
    typeName: 'masterportal:Parkscheinautomaten',
    expectedFeatures: 143,
    ...SCHWERIN_DEFAULTS,
  },
  {
    key: 'accessible',
    service: SCHWERIN_PARKEN,
    typeName: 'masterportal:Behindertenparkplatz',
    expectedFeatures: 64,
    ...SCHWERIN_DEFAULTS,
  },
  // Dieselbe Rolle wie Berlins Ortsteile: Ohne Hintergrundkarte schweben die
  // Zonen sonst im Nichts. Zweiter Dienst desselben Servers, gefunden über
  // den GDI-DE-Katalog („Raumgliederung der Landeshauptstadt Schwerin"),
  // gleiche Lizenz, gleicher Quellenvermerk.
  {
    key: 'districts',
    service: 'https://geoportal.kreis-lup.de/ows/masterportal/raumgliederung-sn',
    typeName: 'ms:Stadtteilgrenzen_Schwerin',
    expectedFeatures: 27,
    ...SCHWERIN_DEFAULTS,
  },
]
/**
 * Graz — Magistrat Graz, Stadtvermessungsamt; Lizenz am Dienst **nicht
 * ausgewiesen** (siehe `GRAZ.licenceOpen` in `core/city.ts`).
 *
 * Die erste Stadt ohne einen einzigen WFS: Alles kommt als GeoJSON aus dem
 * ArcGIS-REST-Dienst (`query?…&f=geojson&outSR=4326`), deshalb steht sie
 * unten bei den Dateien und diese Liste bleibt leer. Sie steht trotzdem hier,
 * damit `citySources('graz')` nicht wirft — `fetch.ts` fragt beide Listen.
 *
 * Gemessen am 16. September 2026: `outSR=4326` wirkt (`[15.4478, 47.0711]`,
 * also `[lon, lat]`); ohne den Parameter käme MGI / Austria GK M34
 * (`wkid 31256`, Meter um `-67.000 / 215.000`). `maxRecordCount` ist 2000,
 * die größte Ebene hat 90 Features — `exceededTransferLimit` bleibt aus,
 * und `fetch.ts` prüft es trotzdem.
 */
const GRAZ_SOURCES: readonly Source[] = []

/**
 * Salzburg — Stadtgemeinde Salzburg, CC BY 3.0 AT. Die erste Stadt außerhalb
 * Deutschlands.
 *
 * Zahlen und Typnamen sind am 16. September 2026 mit `resultType=hits` gegen
 * den Dienst selbst geprüft. Ein Dienst, 81 Typnamen, alle im Arbeitsbereich
 * `ogdsbg` — und darunter auch die Stadtteile, anders als in Frankfurt,
 * München und Düsseldorf, wo sie in einem zweiten Dienst liegen.
 *
 * **`srsName` ist Pflicht.** `DefaultCRS` ist bei jeder Ebene EPSG:31255 (MGI
 * / Gauß-Krüger M31); ohne den Parameter kommen Meter mit negativem Ostwert
 * (`[-20891.7, 295427.09]`). Mit `srsName=urn:ogc:def:crs:EPSG::4326` liefert
 * GeoJSON `[lon, lat]` — das GML derselben Anfrage dagegen `[lat, lon]`.
 * Deshalb steht die Reihenfolge hier, und `build-data-salzburg.ts` prüft die
 * Grade nach.
 *
 * **Der Host war am Vormittag des 16. September aus dieser Umgebung gesperrt**
 * (`connect_rejected` am Egress-Proxy, nur über WebFetch erreichbar) und am
 * Nachmittag offen — curl und Nodes `fetch` mit `NODE_USE_ENV_PROXY=1`
 * antworteten beide mit 200. Scheitert der Abruf im Deploy wieder, bleibt
 * der eingecheckte Abzug stehen; das ist dort so vorgesehen.
 *
 * Bewusst NICHT abgerufen: `ogdsbg:bewohnerparkzone` (13 Flächen — die
 * Bewohnerzone ist eine Berechtigung, keine Gebührenfrage, und ihr Buchstabe
 * steht schon in `GRUPPE` der Kurzparkzonen), `ogdsbg:anwohnerzone` (57
 * Punkte, Schilder), `ogdsbg:parkscheinautomat` (180 Punkte ohne Tarif — die
 * App kennt keine POI-Art dafür) und `ogdsbg:parkplatz` (32 Parkplätze und
 * Garagen). Details in `docs/staedte-salzburg.md`.
 */
const SALZBURG_WFS = 'https://data.stadt-salzburg.at/geodaten/wfs'

const SALZBURG_DEFAULTS = {
  // GeoServer wie in Berlin, Frankfurt, München und Karlsruhe.
  outputFormat: 'application/json',
  axisOrder: 'lon,lat',
} as const


const SALZBURG_SOURCES: readonly Source[] = [
  {
    key: 'zones',
    service: SALZBURG_WFS,
    typeName: 'ogdsbg:kurzparkzone',
    expectedFeatures: 41,
    ...SALZBURG_DEFAULTS,
  },
  // 145 Flächen, davon 132 in Salzburg und 13 in den Nachbargemeinden — die
  // Ebene ist im Rahmen der Stadt geschnitten, nicht an ihrer Grenze.
  // `salzburgDistrictName` in `@knoellchenfrei/core` sortiert die fremden aus.
  {
    key: 'districts',
    service: SALZBURG_WFS,
    typeName: 'ogdsbg:stadtteil',
    expectedFeatures: 145,
    ...SALZBURG_DEFAULTS,
  },
  {
    key: 'accessible',
    service: SALZBURG_WFS,
    typeName: 'ogdsbg:behindertenstellplatz',
    expectedFeatures: 185,
    ...SALZBURG_DEFAULTS,
  },
]
/**
 * Zürich — Stadt Zürich, CC0 1.0.
 *
 * **Ein WFS, der `wfsUrl` nicht verträgt.** `www.ogd.stadt-zuerich.ch` ist
 * ein QGIS Server mit WFS **1.1.0** (`GetCapabilities` nennt 1.1.0 und
 * 1.0.0, kein 2.0.0). Gemessen am 17. September 2026: Mit
 * `srsName=urn:ogc:def:crs:EPSG::4326` **und** einem JSON-Ausgabeformat
 * antwortet er mit **HTTP 500 und einer HTML-Fehlerseite** der Stadt; mit
 * `srsName=EPSG:4326` kommt GeoJSON in `[lon, lat]`, und zwar byteweise
 * dasselbe wie ganz ohne `srsName`. Das Ausgabeformat heisst
 * `application/vnd.geo+json` (auch `geojson` geht); `application/json`
 * gibt es in den Capabilities nicht. Im GML dreht der Dienst mit der
 * URN-Form sehr wohl auf `[lat, lon]` (`lowerCorner 47.364 8.518`) — deshalb
 * bleibt die Reihenfolge eine Aussage über **diese** Abfrage, und
 * `assertDegrees` plus ein Rahmen-Test im Datenbau messen sie nach.
 * Weil `wfsUrl` für alle Städte 2.0.0 und die URN-Form setzt, steht Zürich
 * hier mit einer leeren WFS-Liste und vier fertigen Adressen in
 * `ZUERICH_FILES` — dieselbe Form wie Cottbus' ArcGIS-Abfragen, und
 * `fetch.ts` zählt die Features an `expectedFeatures` genauso.
 *
 * Gefunden über den CKAN-Katalog der Stadt
 * (`data.stadt-zuerich.ch/api/3/action/package_search?q=park`, 79 Treffer),
 * nicht durch Raten. Vier Datensätze, alle `license_id: cc-zero`:
 * `geo_gebietseinteilung_parkierungsgebuehren` (2 Flächen, Stand
 * 15.03.2024), `geo_oeffentlich_zugaengliche_parkplaetze_dav` (fünf Ebenen,
 * **täglich** nachgeführt — davon die Parkuhren und die Parkfelder),
 * `geo_statistische_quartiere` (34).
 *
 * Bewusst NICHT abgerufen: `geo_oeffentlich_zugaengliche_strassenparkplaetze_ogd`
 * (`view_pp_ogd`, 46.282 Punkte) — das ist der Datensatz der Recherche vom
 * Vormittag, aber „Datenstand per Ende 2021 und werden nicht mehr
 * aktualisiert" steht in seiner Beschreibung; die DAV-Ebene sagt dasselbe
 * mit Stand von heute. Ebenso die drei übrigen DAV-Ebenen: `…_dav_l` (5.943
 * Abschnitte der Blauen Zone als Linie), `…_opu_mit_l_p` (6.056 Punkte
 * derselben Abschnitte) und `…_gueterumschlag_p` (1.168) — die Blaue Zone
 * ist Parkscheibe mit Anwohnerkarte, und was dort gilt, steht in keinem
 * Feld. `geo_behindertenparkplaetze` (Stand 2017) und `geo_stadtkreise`
 * (die Quartiere tragen den Kreis als Feld mit).
 */
const ZUERICH_SOURCES: readonly Source[] = []
/**
 * Wien — Stadt Wien, Open Government Data, CC BY 4.0.
 *
 * Zahlen und Typnamen sind am 17. September 2026 mit `resultType=hits` gegen
 * den Dienst selbst geprüft, nicht aus Metadaten übernommen — und einmal
 * abweichend von der Recherche vom Vortag: 796 Streifen statt 795.
 *
 * **Ein GeoServer für alles.** `data.wien.gv.at/daten/geo` führt im
 * Arbeitsbereich `ogdwien` mehrere hundert Typen; die drei hier sind die
 * Kurzparkzonen-Flächen (je Bezirk, flächendeckend), die
 * Geschäftsstraßen-Streifen (Linien mit eigener Regelung) und die
 * Bezirksgrenzen. `GetCapabilities` ist 371 KB und nennt `ows:Fees`
 * = `creativecommons.org/licenses/by/3.0/at/deed.de` und
 * `ows:AccessConstraints` = `data.wien.gv.at/nutzungsbedingungen`, wo CC BY
 * **4.0** steht — die Stadt-Konstante nimmt die strengere Lesart.
 *
 * **Ausgabeformat `application/json`**, Achsen `[lon, lat]`: Mit
 * `srsName=urn:ogc:def:crs:EPSG::4326` antwortet der Dienst im JSON
 * `[16.3424, 48.2457]` und trägt `crs.name = urn:ogc:def:crs:EPSG::4326`
 * dazu. Gemessen, nicht geraten — und die Falle daneben ist eine andere als
 * in Hamburg: **Ohne** `srsName` antwortet derselbe Dienst in EPSG:31256
 * (MGI / Gauß-Krüger M34, `[759.8, 345262.9]`, Meter um einen Nullpunkt bei
 * Wien) — plausible Zahlen, keine Grade, auf der Karte nur „leer".
 * `assertDegrees` im Datenbau misst deshalb nach. Das GML desselben Dienstes
 * liefert `[lat, lon]` (Recherche vom 16. September); es wird nicht benutzt.
 *
 * Bewusst NICHT abgerufen: `PARKENGELTUNGOGD` (238 Geltungsbereiche) und
 * `PARKENBERECHTOGD` (24 Berechtigungszonen) — beide tragen den Vermerk
 * `TEXT_RECHT: "…haben keine Rechtsgültigkeit"` und beantworten die Frage
 * nach dem Parkpickerl, nicht die nach der Gebühr; `PARKENANRAINEROGD`
 * (1.356 Anrainerparkplätze) und `PARKENAUTOMATOGD` (206 Punkte — das sind
 * **Verkaufsstellen** der Wiener Linien, Wien hat keine Parkscheinautomaten
 * am Straßenrand). Details in `docs/staedte-wien.md`.
 */
const WIEN_WFS = 'https://data.wien.gv.at/daten/geo'

const WIEN_DEFAULTS = {
  outputFormat: 'application/json',
  axisOrder: 'lon,lat',
} as const

const WIEN_SOURCES: readonly Source[] = [
  // Die flächendeckenden Kurzparkzonen, je Bezirk ein oder mehrere Stücke.
  {
    key: 'zones',
    service: WIEN_WFS,
    typeName: 'ogdwien:KURZPARKZONEOGD',
    expectedFeatures: 81,
    ...WIEN_DEFAULTS,
  },
  // Die Geschäftsstraßen: Linien, deren Regelung die Fläche überstimmt.
  {
    key: 'strips',
    service: WIEN_WFS,
    typeName: 'ogdwien:KURZPARKSTREIFENOGD',
    expectedFeatures: 796,
    ...WIEN_DEFAULTS,
  },
  // Die 23 Bezirke: Kartenkontext, Name der Zone und der Rahmen der Stadt.
  {
    key: 'districts',
    service: WIEN_WFS,
    typeName: 'ogdwien:BEZIRKSGRENZEOGD',
    expectedFeatures: 23,
    ...WIEN_DEFAULTS,
  },
]
/**
 * Niederlande — je Stadt die Stadtteile (Wijken) des CBS über PDOK, sonst
 * nichts per WFS: Die Parkdaten kommen aus dem NPR, siehe `nprFiles` unten.
 *
 * Dienst: `service.pdok.nl/cbs/wijkenbuurten/2024/wfs/v1_0`, Typ
 * `wijkenbuurten:wijken`, gefiltert über `gemeentecode` (`GM0344`). Gemessen
 * am 17. September 2026: mit `urn:ogc:def:crs:EPSG::4326` antwortet der
 * Dienst in `[lon, lat]` (`[5.018, 52.062]`), `application/json` liefert
 * GeoJSON. Lizenz laut `ows:AccessConstraints` der Capabilities:
 * `https://creativecommons.org/publicdomain/zero/1.0/deed.nl` — CC0. Den
 * Haag und Rotterdam führen je ein Wijk „Groot water" (`water: JA`), das der
 * Datenbau auslässt.
 */
const PDOK_WIJKEN = 'https://service.pdok.nl/cbs/wijkenbuurten/2024/wfs/v1_0'

function pdokWijken(gemeentecode: string, expectedFeatures: number): Source {
  return {
    key: 'districts',
    service: PDOK_WIJKEN,
    typeName: 'wijkenbuurten:wijken',
    expectedFeatures,
    outputFormat: 'application/json',
    axisOrder: 'lon,lat',
    filter:
      '<Filter><PropertyIsEqualTo><ValueReference>gemeentecode</ValueReference>' +
      `<Literal>GM${gemeentecode}</Literal></PropertyIsEqualTo></Filter>`,
  }
}

/**
 * Gera — Stadtverwaltung Gera, Zentrales GIS, über den GeoServer-WFS 2.0.0
 * des Geoportals (`geoportal.gera.de/geoserver/gera/wfs`). Lizenz nicht
 * ausgewiesen, siehe `GERA` in `core/city.ts`.
 *
 * Gemessen am 17. September 2026: `outputFormat=application/json` liefert
 * GeoJSON, `srsName=urn:ogc:def:crs:EPSG::4326` wirkt und antwortet in
 * `[lon, lat]` (erster Stützpunkt `[12.0917, 50.8787]`); **ohne** `srsName`
 * kommt dieselbe Ebene stillschweigend in EPSG:25833
 * (`[295415.59, 5640369.99]`, `DefaultCRS` der Ebene) — der Frankfurt-Fall,
 * `assertDegrees` in `build-data-gera.ts` misst nach. `resultType=hits`
 * nennt `numberMatched="148"`, und das ist die Messlatte.
 *
 * Drei Ebenen aus einem Dienst: die Anwohnerparkzonen (10 Flächen und 138
 * Linien in **einer** Ebene, `feature` 62637 bzw. 62638), die 27 Ortsteile
 * (`geom_portal_ortsteile`, Feld `ortsteil`) und 12 Behindertenparkplätze.
 * Gemessen, nicht ausgeliefert: `geom_stadtgrenze_und_flaeche` (zwei
 * Polygone, nur für den Rahmen in `core/city.ts`). Nicht genommen:
 * `geom_portal_parken` und `geom_portal_parken_alles` (14 bzw. 26 Punkte —
 * Parkhäuser, Busparkplätze, dieselben Behindertenparkplätze noch einmal)
 * und `geom_statistik_gemeindeteile` (72 Gemeindeteile — feiner als die
 * Ortsteile, aber nicht die Gliederung, in der die Stadt spricht).
 * Keine Umweltzone: Gera hat keine.
 */
const GERA_WFS = 'https://geoportal.gera.de/geoserver/gera/wfs'

const GERA_DEFAULTS = {
  outputFormat: 'application/json',
  axisOrder: 'lon,lat',
} as const

const GERA_SOURCES: readonly Source[] = [
  {
    key: 'zones',
    service: GERA_WFS,
    typeName: 'gera:geom_portal_anwohnerparken',
    expectedFeatures: 148,
    ...GERA_DEFAULTS,
  },
  {
    key: 'districts',
    service: GERA_WFS,
    typeName: 'gera:geom_portal_ortsteile',
    expectedFeatures: 27,
    ...GERA_DEFAULTS,
  },
  {
    key: 'accessible',
    service: GERA_WFS,
    typeName: 'gera:geom_portal_behindertenparkplaetze',
    expectedFeatures: 12,
    ...GERA_DEFAULTS,
  },
]

/**
 * Hildesheim — Geoportal der Stadt Hildesheim, MapServer-WFS 2.0.0, Lizenz
 * laut Nutzungsbedingungen DL-DE/BY-2.0 mit einem Vorbehalt gegen
 * kommerzielle Nutzung (deshalb `unklar`, siehe `HILDESHEIM` in
 * `core/city.ts`). Zwei Ebenen, je ein eigener Dienstpfad
 * (`/interface/wfs-ms/<Ebene>`, ein Typname je Dienst), beide am
 * 17. September 2026 gemessen: `numberMatched` 7 und 14.
 *
 * **Ausgabeformat `application/json`** — der Dienst kennt daneben
 * `application/vnd.geo+json`, beide liefern dasselbe GeoJSON. **Und die
 * Achsen sind Berlins, nicht Hamburgs:** Mit `srsName=urn:ogc:def:crs:EPSG::4326`
 * antwortet das GeoJSON `[9.9521, 52.1463]`, also `[lon, lat]`. Das
 * widerspricht der Recherche vom 16. September, die für dieselbe Ebene
 * `[lat, lon]` notierte — die Messung dort war WFS 1.1.0 mit **GML**, und
 * MapServer dreht im GML die Achsen, im GeoJSON nicht. Weil `wfsUrl` immer
 * 2.0.0 und JSON anfragt, steht hier `lon,lat`; `assertInHildesheim` im
 * Datenbau misst es trotzdem nach. Die Falle daneben: **Ohne** `srsName`
 * antwortet der Dienst in seinem `DefaultCRS` EPSG:25832 —
 * `[565150.07, 5777739.93]`, mit `crs` im Kopf, ohne Fehler.
 *
 * Die **Ortschaften** sind die 14 Ortschaften der Stadt (Stadtmitte,
 * Nordstadt, Sorsum, Himmelsthür …), mit `Name` und `Name_lang`; der Datenbau
 * nimmt `Name_lang`, weil `Name` bei zwei Flächen abgeschnitten oder
 * vertippt ist (`Neuhof/HildesheimerWald/Marien`, `Bavenstadt`). Ihre Hülle
 * ist der Rahmen in `core/city.ts`.
 *
 * Bewusst NICHT abgerufen: die Ebene `Stadtgrenze` des Viewers (nur über
 * `/interface/geojson/<uuid>` in EPSG:25832 erreichbar, kein WFS-Pfad, und
 * die Ortschaften decken dieselbe Fläche), `Schwerbehindertenparkplätze`
 * (nur als WMS/Mapproxy-Kachel im Viewer, kein Vektordienst gefunden),
 * `Park and Ride` (Viewer-Ebene, kein `wfs-ms`-Pfad geraten — Raten hat
 * hier dreimal 404 gebracht: `Stadtgrenze`, `Ortsteile`, `Stadtteile`).
 */
const HILDESHEIM_WFS = 'https://gdi.stadt-hildesheim.de/interface/wfs-ms'

const HILDESHEIM_DEFAULTS = {
  outputFormat: 'application/json',
  axisOrder: 'lon,lat',
} as const

const HILDESHEIM_SOURCES: readonly Source[] = [
  // Die einzigen Flächen: sieben Bewohnerparkzonen A bis G, vier Felder,
  // keine Zeiten, kein Betrag.
  {
    key: 'zones',
    service: `${HILDESHEIM_WFS}/Bewohnerparkzonen`,
    typeName: 'ms:Bewohnerparkzonen',
    expectedFeatures: 7,
    ...HILDESHEIM_DEFAULTS,
  },
  // Dieselbe Rolle wie Berlins Ortsteile: Kartenkontext, Name im Panel und
  // der Rahmen der Stadt.
  {
    key: 'districts',
    service: `${HILDESHEIM_WFS}/Ortschaften`,
    typeName: 'ms:Ortschaften',
    expectedFeatures: 14,
    ...HILDESHEIM_DEFAULTS,
  },
]

const BY_CITY: Record<string, readonly Source[]> = {
  berlin: BERLIN_SOURCES,
  hamburg: HAMBURG_SOURCES,
  frankfurt: FRANKFURT_SOURCES,
  muenchen: MUENCHEN_SOURCES,
  koeln: KOELN_SOURCES,
  duesseldorf: DUESSELDORF_SOURCES,
  karlsruhe: KARLSRUHE_SOURCES,
  freiburg: FREIBURG_SOURCES,
  rostock: ROSTOCK_SOURCES,
  cottbus: COTTBUS_SOURCES,
  schwerin: SCHWERIN_SOURCES,
  graz: GRAZ_SOURCES,
  salzburg: SALZBURG_SOURCES,
  // Kein WFS: Innsbruck kommt vollständig über `cityFiles`. Der Eintrag
  // steht trotzdem hier, damit `citySources` die Stadt kennt — sonst wirft
  // `fetch-data` „Keine Quellen", obwohl es zwei Dateien gibt.
  innsbruck: [],
  zuerich: ZUERICH_SOURCES,
  wien: WIEN_SOURCES,
  utrecht: [pdokWijken('0344', 10)],
  denhaag: [pdokWijken('0518', 45)],
  rotterdam: [pdokWijken('0599', 22)],
  groningen: [pdokWijken('0014', 20)],
  nijmegen: [pdokWijken('0268', 9)],
  eindhoven: [pdokWijken('0772', 20)],
  // Kein WFS: Genf kommt vollständig über `cityFiles`, aus demselben Grund.
  genf: [],
  // Ebenso Bern: drei Ebenen eines ArcGIS-MapServers, alle über `cityFiles`.
  bern: [],
  // Straßburg: drei Opendatasoft-Exporte, alle über `cityFiles`.
  strasbourg: [],
  // St. Gallen ebenso: zwei GeoJSON-Exporte des Opendatasoft-Portals, über `cityFiles`.
  stgallen: [],
  // Krakau ebenso: drei ArcGIS-Ebenen, alle über `cityFiles`.
  krakau: [],
  // Kein WFS: Kassel kommt vollständig über `cityFiles` — ein `identify`
  // und eine `query` gegen das Geoportal der Stadt.
  kassel: [],
  // Kein WFS: Essen kommt vollständig über `cityFiles` (drei DKAN-Dateien).
  essen: [],
  // Saarbrücken: vier GeoJSON-Dateien aus dem CKAN der Stadt, alle über `cityFiles`.
  saarbruecken: [],
  gera: GERA_SOURCES,
  hildesheim: HILDESHEIM_SOURCES,
}

/**
 * Dateien, die kein WFS sind: eine Adresse, ein Dateiname, mehr nicht.
 *
 * Kölns Parkscheinautomaten kommen als CSV aus dem offenen Datenportal — kein
 * Typname, kein Ausgabeformat, keine Achsenreihenfolge, also passt sie nicht
 * in `Source`. Bis zum 9. September stand der Abruf als `curl`-Zeile im Kopf
 * von `build-data-koeln.ts`; der tägliche Datenabruf im Deploy hätte sie nie
 * geholt, und der Datenbau wäre an einer fehlenden Datei gescheitert.
 */
export interface FileSource {
  key: string
  url: string
  /** Dateiname unter `.raw/<stadt>/`. */
  file: string
  /**
   * Nur für GeoJSON-Dateien: Wie viele Features erwartet werden.
   *
   * Ein ArcGIS FeatureServer antwortet auf jede Frage mit 200 — auch mit
   * `{"error":{…}}` und auch mit einem abgeschnittenen Ergebnis, das
   * `exceededTransferLimit: true` trägt. Beides sieht für die Längenprüfung
   * in `fetch.ts` aus wie eine Datei. Mit dieser Zahl gilt dieselbe
   * 95-%-Schranke wie bei einem WFS.
   * Nur für GeoJSON-Dateien: ungefähr, damit ein still abgeschnittener Abruf
   * auffällt — dieselbe 95-%-Schwelle wie bei den WFS-Quellen. Ein ArcGIS
   * FeatureServer schneidet bei `maxRecordCount` ab und sagt es nur mit
   * `exceededTransferLimit: true` im Rumpf; `fetch.ts` prüft beides.
   * Nur für Dateien, die eine GeoJSON-`FeatureCollection` sind: Wie viele
   * Merkmale erwartet werden. `fetch.ts` prüft dann dieselbe 95-%-Schwelle
   * wie bei WFS-Quellen. Ein ArcGIS-FeatureServer schneidet eine Antwort
   * still bei `maxRecordCount` ab und meldet das nur als Feld
   * `exceededTransferLimit` — bei 21 Zonen kein Thema, aber die Zahl ist die
   * Messlatte, an der ein leerer oder halber Abruf auffällt.
   */
  expectedFeatures?: number
  /**
   * Socrata liefert ohne `$limit` 1.000 Zeilen und sagt es nicht; mit
   * `$limit` höchstens so viele, wie hier stehen. `fetch.ts` hängt `$offset`
   * an und holt weiter, bis eine Seite kürzer ist — und zählt die Zeilen
   * gegen `expectedFeatures`, denn eine NPR-Antwort ist ein JSON-Array ohne
   * `features`.
   */
  paginate?: { pageSize: number }
  /**
   * Die Ebene ist größer als `maxRecordCount`, und `fetch.ts` holt sie
   * seitenweise (`resultOffset`), bis der Dienst `exceededTransferLimit`
   * nicht mehr setzt. Genfs 13.236 Parkierungslinien bei einem Deckel von
   * 4.000 sind der erste Fall. Ohne die Marke wäre die dritte Seite kein
   * Fehler, sondern eine kleinere Stadt.
   */
  paged?: true
}

const KOELN_FILES: readonly FileSource[] = [
  {
    key: 'automats',
    url: 'https://www.offenedaten-koeln.de/sites/default/files/distribution/psa_2016.csv',
    file: 'automats.csv',
  },
]

const COTTBUS_FB32 = 'https://datenportal.cottbus.de/server/rest/services/FB32'
const ARCGIS_QUERY = 'query?where=1%3D1&outFields=*&f=geojson&outSR=4326'

const COTTBUS_FILES: readonly FileSource[] = [
  {
    key: 'zones',
    url: `${COTTBUS_FB32}/Bewohnerparkzonen/FeatureServer/7/${ARCGIS_QUERY}`,
    file: 'zones.json',
    expectedFeatures: 5,
  },
  // Die eigentliche Sachauskunft: Zeiten, Tarifzone und Betrag hängen am
  // Automaten, nicht an der Zone — wie in Frankfurt und Köln.
  {
    key: 'automats',
    url: `${COTTBUS_FB32}/Parkscheinautomaten/FeatureServer/1/${ARCGIS_QUERY}`,
    file: 'automats.json',
    expectedFeatures: 44,
  },
]

/**
 * Die Abfrage-Adresse einer ArcGIS-FeatureServer-Ebene, als GeoJSON in Grad.
 *
 * `outSR=4326` ist das Gegenstück zu `srsName` beim WFS und genauso Pflicht:
 * Ohne den Parameter antwortet Graz in seinem Landessystem (`wkid 31256`,
 * Meter). `f=geojson` liefert `[lon, lat]`, wie es GeoJSON vorschreibt.
 */
export function arcgisQueryUrl(layer: string): string {
  const params = new URLSearchParams({
    where: '1=1',
    outFields: '*',
    f: 'geojson',
    outSR: '4326',
  })
  return `${layer}/query?${params}`
}

const GRAZ_PARKZONEN =
  'https://geodaten.graz.at/mapping/rest/services/1_3_Verkehrswesen/Grazer_Parkzonen/FeatureServer'
/**
 * Die Bezirksgrenzen kommen bewusst aus dem **OGD-Dienst** der Stadt und nicht
 * aus `3_3_Verwaltungseinheiten`, obwohl beide dieselben 17 Polygone führen:
 * Nur der OGD-Dienst ist über data.graz.gv.at unter CC BY 4.0 belegt, der
 * andere nennt wie der Parkzonen-Dienst keine Lizenz.
 */
const GRAZ_OGD = 'https://geodaten.graz.at/mapping/rest/services/OGD_WFS/FeatureServer'

const GRAZ_FILES: readonly FileSource[] = [
  // Ebene 0, „Kurzparkzonen aktuell" — die Blaue Zone.
  { key: 'kurzparkzonen', url: arcgisQueryUrl(`${GRAZ_PARKZONEN}/0`), file: 'kurzparkzonen.json', expectedFeatures: 90 },
  // Ebene 1, „Parkzonen aktuell" — die Grüne Zone.
  { key: 'parkzonen', url: arcgisQueryUrl(`${GRAZ_PARKZONEN}/1`), file: 'parkzonen.json', expectedFeatures: 75 },
  // Ebene 44 des OGD-Dienstes, die 17 Grazer Stadtbezirke.
  { key: 'districts', url: arcgisQueryUrl(`${GRAZ_OGD}/44`), file: 'districts.json', expectedFeatures: 17 },
]

/**
 * Innsbruck — Stadt Innsbruck über ihr ArcGIS Online („geoHub Innsbruck"),
 * Nutzungsbedingung der Stadt („vergleichbar mit CC BY 4.0").
 *
 * Kein WFS, sondern zwei ArcGIS-FeatureServer-Ebenen, beide als Datei
 * abgerufen: `f=geojson&outSR=4326` liefert GeoJSON in `[lon, lat]`, am
 * 16. September 2026 nachgemessen (erster Stützpunkt `[11.3989, 47.2810]`)
 * und in `build-data-innsbruck.ts` mit `assertDegrees` gehalten. `where=1=1`
 * ist die ArcGIS-Schreibweise für „alles"; ohne `where` antwortet der
 * Dienst mit einem Fehler.
 *
 * Gefunden über die Hub-API (`/api/v3/datasets`), nicht über die Suche:
 * Deren erster Treffer für „Parkzonen" ist ein Datensatz aus Gütersloh —
 * die Suche eines ArcGIS-Hubs ist nicht auf die eigene Organisation
 * begrenzt. Der Eigentümer `geoHub_Innsbruck` ist das Kriterium.
 *
 * Die Stadtteile liegen im selben Hub als Ebene `stadtteile` (20
 * statistische Stadtteile, Feld `Stadtteil_1`); ihr Umriss deckt das ganze
 * Gemeindegebiet, nachgemessen gegen die Gemeindegrenze aus tiris — der
 * Rahmen beider ist auf vier Stellen derselbe. Die Statistik-Dienste
 * (`statistik_07/0` u. a.) führen dieselben 20 Stadtteile mit Kennzahlen;
 * `statistik_06_v/0` ist die Ebene ohne Beiwerk.
 */
const INNSBRUCK_ARCGIS = 'https://services8.arcgis.com/LxSaGwss445axp1E/arcgis/rest/services'
const ARCGIS_ALL_AS_GEOJSON = 'query?where=1%3D1&outFields=*&f=geojson&outSR=4326'

const INNSBRUCK_FILES: readonly FileSource[] = [
  {
    key: 'zones',
    url: `${INNSBRUCK_ARCGIS}/Parkzonen_WGS84/FeatureServer/0/${ARCGIS_ALL_AS_GEOJSON}`,
    file: 'zones.json',
    expectedFeatures: 21,
  },
  {
    key: 'districts',
    url: `${INNSBRUCK_ARCGIS}/statistik_06_v/FeatureServer/0/${ARCGIS_ALL_AS_GEOJSON}`,
    file: 'districts.json',
    expectedFeatures: 20,
  },
]

const ZUERICH_WFS = 'https://www.ogd.stadt-zuerich.ch/wfs/geoportal'

/**
 * Eine WFS-1.1.0-Abfrage, wie der QGIS Server sie annimmt — siehe den
 * Kommentar über `ZUERICH_SOURCES`, warum nicht `wfsUrl`. `+` im
 * Ausgabeformat ist kodiert, sonst läse der Server ein Leerzeichen.
 */
function zuerichQuery(service: string, typeName: string): string {
  const params = new URLSearchParams({
    SERVICE: 'WFS',
    VERSION: '1.1.0',
    REQUEST: 'GetFeature',
    TYPENAME: typeName,
    SRSNAME: 'EPSG:4326',
    OUTPUTFORMAT: 'application/vnd.geo+json',
  })
  return `${ZUERICH_WFS}/${service}?${params}`
}

const ZUERICH_DAV = 'oeffentlich_zugaengliche_Parkplaetze_DAV'

const ZUERICH_FILES: readonly FileSource[] = [
  // Die einzigen Flächen im Feed: zwei Hochtarifzonen mit Bedienungszeit.
  {
    key: 'zones',
    url: zuerichQuery('Gebietseinteilung_Parkierungsgebuehren', 'tarifzonen'),
    file: 'zones.json',
    expectedFeatures: 2,
  },
  // Die Gegenprobe zur Fläche und die Höchstparkdauer: 1.397 Sammel- und
  // Zentralparkuhren, jede mit `tarif` wie `HOCH 2h Mo-Sa 09:00-20:00`.
  {
    key: 'meters',
    url: zuerichQuery(ZUERICH_DAV, 'oeff_strassenparkierung_spuzpu'),
    file: 'meters.json',
    expectedFeatures: 1397,
  },
  // Die Stellplätze: 13.272 gebühren- oder bewilligungspflichtige Parkfelder
  // als Punkt, 7 MB — die grösste Datei nach Münchens Strassenseiten. Sie
  // zählt, wie viele Felder in einer Fläche kassieren, und auf wie vielen
  // welche Höchstparkdauer gilt.
  {
    key: 'spaces',
    url: zuerichQuery(ZUERICH_DAV, 'oeff_strassenparkierung_dav_p'),
    file: 'spaces.json',
    expectedFeatures: 13272,
  },
  // Dieselbe Rolle wie Berlins Ortsteile: Kartenkontext, und der Rahmen der
  // Stadt für `reportBounds`. 34 Statistische Quartiere, jedes mit `qname`
  // und dem Kreis in `kname`; die zwölf Kreise allein wären zu grob, um
  // „Seefeld" von „Mühlebach" zu unterscheiden.
  {
    key: 'districts',
    url: zuerichQuery('Statistische_Quartiere', 'adm_statistische_quartiere_v'),
    file: 'districts.json',
    expectedFeatures: 34,
  },
]
/**
 * Niederlande — das Nationaal Parkeer Register (NPR) der RDW, „Open Data
 * Parkeren" auf `opendata.rdw.nl` (Socrata/SODA), CC0, täglich.
 *
 * Eine Quelle für alle niederländischen Städte: Acht Tabellen, alle über
 * `areamanagerid` (= CBS-Gemeindecode ohne führende Nullen) verknüpft. Vier
 * Fallen, alle gemessen am 16. und 17. September 2026:
 *
 *  1. Ein einfacher Filter (`?areamanagerid=363`) **zusammen** mit `$where`
 *     lieferte Zeilen anderer Gemeinden — alles steht in `$where`.
 *  2. Ohne `$limit` kommen 1.000 Zeilen, ohne Hinweis. Rotterdams TIJDVAK hat
 *     5.425. Deshalb `$limit=50000` **und** `paginate`, weil 50.000 die
 *     Obergrenze von SODA 2.0 ist.
 *  3. `$order=:id` macht die Seiten stabil; ohne Sortierung darf Socrata
 *     zwischen zwei Seiten umsortieren.
 *  4. Gültigkeit wird **nicht** hier gefiltert, sondern im Datenbau: Der
 *     Abzug trägt alle Fassungen samt der schon eingetragenen künftigen
 *     (Utrecht: Gebiet 21400 mit REG08 ab dem 1. November), und der Datenbau
 *     entscheidet am Tag des Laufs, was gilt. Ein Abzug, der schon gefiltert
 *     wäre, ließe sich nicht mehr nachprüfen.
 *
 * `expectedFeatures` ist die Zeilenzahl **aller** Fassungen je Tabelle,
 * gemessen am 17. September 2026; sie wächst mit jeder Änderung der
 * Gemeinde und sinkt nie — deshalb taugt sie als Messlatte.
 */
const NPR_SODA = 'https://opendata.rdw.nl/resource'

export interface NprTable {
  key: string
  /** Socrata-Kennung der Tabelle. */
  id: string
}

export const NPR_TABLES: readonly NprTable[] = [
  { key: 'npr-gebied', id: 'adw6-9hsg' },
  { key: 'npr-geometrie', id: 'nsk3-v9n7' },
  { key: 'npr-gebiedregeling', id: 'qtex-qwd8' },
  { key: 'npr-regeling', id: 'yefi-qfiq' },
  { key: 'npr-tijdvak', id: 'ixf8-gtwq' },
  { key: 'npr-tariefdeel', id: '534e-5vdg' },
  { key: 'npr-tariefberekening', id: 'nfzq-8g7y' },
  { key: 'npr-specialedag', id: 'hpi4-mynq' },
]

/** Die acht Tabellen einer Gemeinde; `expected` in der Reihenfolge von `NPR_TABLES`. */
export function nprFiles(areaManagerId: string, expected: readonly number[]): readonly FileSource[] {
  if (!/^\d{1,4}$/.test(areaManagerId)) throw new Error(`Kein Gemeindecode: ${areaManagerId}`)
  if (expected.length !== NPR_TABLES.length) {
    throw new Error(`${expected.length} Messlatten für ${NPR_TABLES.length} Tabellen`)
  }
  return NPR_TABLES.map((table, index) => ({
    key: table.key,
    url: `${NPR_SODA}/${table.id}.json?$where=areamanagerid='${areaManagerId}'&$limit=50000&$order=:id`,
    file: `${table.key}.json`,
    expectedFeatures: expected[index] as number,
    paginate: { pageSize: 50_000 },
  }))
}

/** CBS-Gemeindecode je Stadt — der Schlüssel des NPR und der Wijken zugleich. */
export const NPR_AREA_MANAGERS: Readonly<Record<string, string>> = {
  utrecht: '344',
  denhaag: '518',
  rotterdam: '599',
  groningen: '14',
  nijmegen: '268',
  eindhoven: '772',
}

/**
 * Genf — Etat de Genève über das SITG, Conditions d'utilisation des données
 * du Portail SITG, Stufe „A – Accès libre (Open Data)".
 *
 * Kein WFS, obwohl es einen gäbe (`…/arcgis/services/OTC_MACARON/MapServer/WFSServer`):
 * Der WFS antwortet auf `urn:ogc:def:crs:EPSG::4326` mit GML in `[lat, lon]`
 * und ohne `srsName` in EPSG:2056 (Schweizer Landeskoordinaten, Meter um
 * 2.500.000 / 1.120.000); der REST-Dienst liefert mit `f=geojson&outSR=4326`
 * GeoJSON in `[lon, lat]`, am 17. September 2026 nachgemessen (erster
 * Stützpunkt `[6.1326, 46.2252]`) und in `build-data-genf.ts` mit
 * `assertDegrees` gehalten. Alle vier Ebenen liegen auf **einem** Server;
 * die Katalogeinträge (ArcGIS Online `sitg.maps.arcgis.com`, je Ebene ein
 * Item für MapServer, FeatureServer, WFS und WMS) tragen alle
 * `licenseInfo: "Accès libre"` und `accessInformation: "© 2026 SITG"`.
 *
 * Die 53 Macaron-Zonen decken den ganzen Kanton; der Datenbau behält die 17
 * der Ville de Genève (Begründung an `GENF` in `core/city.ts`). Die
 * Parkierungslinien sind die einzige Sachauskunft — Art und Platzzahl je
 * Stellplatzreihe —, und sie sind mehr als `maxRecordCount` (4.000):
 * `paged` lässt `fetch.ts` seitenweise holen.
 *
 * Bewusst NICHT abgerufen: `OTC_PARKING` (534 Parkhäuser und -plätze, keine
 * `PoiKind`), `AGGLO_STATION_AUTOPARTAGE` (Carsharing, ungeprüft),
 * `OCS_SECTEURS_STATISTIQUES` (61 Sektoren des Kantons — für den Kanton die
 * richtigen Bezirke, für die Ville sind es die acht Quartiere) und
 * `CAD_COMMUNE` (48 Polygone; nur für den Rahmen gemessen, nicht ausgeliefert).
 */
const GENF_SITG = 'https://vector.sitg.ge.ch/arcgis/rest/services'

const GENF_FILES: readonly FileSource[] = [
  { key: 'zones', url: arcgisQueryUrl(`${GENF_SITG}/OTC_MACARON/MapServer/0`), file: 'zones.json', expectedFeatures: 53 },
  {
    key: 'lines',
    url: arcgisQueryUrl(`${GENF_SITG}/OTC_STATIONNEMENT_V_PUBLIQUE/MapServer/0`),
    file: 'lines.json',
    // Täglich nachgeführt; die Recherche vom Vortag zählte 12.731, der Abruf
    // vom 17. September 13.236. Die Messlatte ist der Abruf.
    expectedFeatures: 13236,
    paged: true,
  },
  { key: 'accessible', url: arcgisQueryUrl(`${GENF_SITG}/OTC_PLACE_HANDICAPE/MapServer/0`), file: 'accessible.json', expectedFeatures: 599 },
  // Die acht Quartiere der Ville de Genève („découpage … validé en 2013"):
  // Kartenkontext, Ortsangabe im Panel und der Filter, der die Ville vom
  // Kanton trennt.
  { key: 'districts', url: arcgisQueryUrl(`${GENF_SITG}/VDG_QUARTIER_VILLE/MapServer/0`), file: 'districts.json', expectedFeatures: 8 },
]

/**
 * Bern — Stadt Bern, Geoinformation, über ihren ArcGIS-Server `map.bern.ch`
 * (Nutzungsbedingungen betreffend Geodaten der Stadt Bern, Version 1.0).
 *
 * Kein WFS, sondern ein ArcGIS **MapServer** — `arcgisQueryUrl` passt
 * trotzdem, die `query`-Schnittstelle ist dieselbe wie beim FeatureServer.
 * Der Dienst liegt intern in LV95 (`wkid` 2056, Meter um 2.600.000 /
 * 1.200.000); `outSR=4326` ist deshalb Pflicht, und `build-data-bern.ts`
 * misst mit `assertDegrees` nach. Am 17. September 2026 nachgemessen: erster
 * Stützpunkt `[7.3955, 46.9471]`, `[lon, lat]`.
 *
 * Drei Ebenen aus drei Diensten desselben Servers:
 *
 * - `Parkkartenzonen/MapServer/1` — „Parkkartenzone_Umrandung", 42 Polygone.
 *   Ebene 2 („Flaechenfuellung") führt dieselben 42 mit denselben Feldern;
 *   sie ist nur die Darstellung.
 * - `Statistische_Bezirke/MapServer/0` — die 32 statistischen Bezirke, laut
 *   Dienst „eine offizielle Stadteinteilung". Die 6 Stadtteile wären zu grob
 *   für die Kopfzeile des Panels, die 114 gebräuchlichen Quartiere zu fein.
 * - `Stadtteile/MapServer/0` — die 6 Stadtteile, nur damit jeder Bezirk
 *   seinen Stadtteil nennen kann (`Stadtteil_fid`), wie Hamburgs `bezirk`.
 *
 * `maxRecordCount` ist 1000; bei 42, 32 und 6 Merkmalen bleibt
 * `exceededTransferLimit` aus, geprüft wird es trotzdem.
 */
const BERN_ARCGIS = 'https://map.bern.ch/arcgis/rest/services/Geoportal'

const BERN_FILES: readonly FileSource[] = [
  { key: 'zones', url: arcgisQueryUrl(`${BERN_ARCGIS}/Parkkartenzonen/MapServer/1`), file: 'zones.json', expectedFeatures: 42 },
  { key: 'districts', url: arcgisQueryUrl(`${BERN_ARCGIS}/Statistische_Bezirke/MapServer/0`), file: 'districts.json', expectedFeatures: 32 },
  { key: 'stadtteile', url: arcgisQueryUrl(`${BERN_ARCGIS}/Stadtteile/MapServer/0`), file: 'stadtteile.json', expectedFeatures: 6 },
]

/**
 * Krakau — Gmina Miejska Kraków, Zarząd Transportu Publicznego (ZTP), über
 * das ArcGIS Online der Stadt. **Keine Lizenz ausgewiesen**, siehe
 * `KRAKAU.licenceOpen` in `core/city.ts`.
 *
 * Vier Ebenen, alle als Datei, alle mit `f=geojson&outSR=4326` — ohne
 * `outSR` antwortet der Dienst in PUWG 1992 (`wkid 2180`, Meter um
 * 565.000 / 243.000), am 17. September 2026 nachgemessen. Die Ebene mit
 * `ś` im Dienstnamen (`Sektory_SPP_wyświetlenie`) braucht die Adresse
 * prozentkodiert; `curl` braucht dazu `-g`, sonst frisst es die Klammern
 * nicht, sondern die Kodierung. Warum vier Ebenen für eine Aussage, steht
 * in `build-data-krakau.ts`: Die amtliche ZDMK-Karte zeichnet
 * `Granice_Stref_2026`, der beschriebene Datensatz ist die Ebene 37 mit
 * Stand Dezember 2024, und die Erweiterung vom 10. August 2026 hat eine
 * eigene Ebene mit Datum.
 */
const KRAKAU_ARCGIS = 'https://services-eu1.arcgis.com/svTzSt3AvH7sK6q9/arcgis/rest/services'

const KRAKAU_FILES: readonly FileSource[] = [
  // Die Ebene der amtlichen Karte („Mapa ZDMK v2"): 23 Sektoren, Stand
  // 6. August 2026 — die Flächen.
  {
    key: 'zones',
    url: arcgisQueryUrl(`${KRAKAU_ARCGIS}/Granice_Stref_2026/FeatureServer/1`),
    file: 'zones.json',
    expectedFeatures: 23,
  },
  // Die Erweiterung vom 10. August 2026: vier Polygone mit Datum in `Uwagi`.
  {
    key: 'extension',
    url: arcgisQueryUrl(`${KRAKAU_ARCGIS}/Poszerzenie_OPP_od_10_08_2026/FeatureServer/0`),
    file: 'extension.json',
    expectedFeatures: 4,
  },
  // Der beschriebene Datensatz „Strefa Płatnego Parkowania w Krakowie"
  // (Item d9e0ef7c33cd4f4a99c4e7d8024d3956, Tag „Dane Otwarte"): 26
  // Polygone, 20 geltende und sechs geplante mit Präfix `n`. Nur zur
  // Gegenprobe im Log; Stand der Daten 9. Dezember 2024.
  {
    key: 'sectors',
    url: arcgisQueryUrl(`${KRAKAU_ARCGIS}/Sektory_SPP_wy%C5%9Bwietlenie/FeatureServer/37`),
    file: 'sectors.json',
    expectedFeatures: 26,
  },
  // Die 18 Dzielnice aus dem ISDP der Stadt (Ebene `F07_DZIELN_2014_polyg`).
  {
    key: 'districts',
    url: arcgisQueryUrl(`${KRAKAU_ARCGIS}/Dzielnice_Krakowa/FeatureServer/10`),
    file: 'districts.json',
    expectedFeatures: 18,
  },
]

/**
 * Kassel — Stadt Kassel, Vermessung und Geoinformation, über das Geoportal
 * der Stadt (ArcGIS Enterprise 11.5). Lizenz für die Bezirke offen, siehe
 * `KASSEL` in `core/city.ts`.
 *
 * **`query` liefert bei der Ebene „Bewohnerparkbezirke" keine Geometrie.**
 * Am 17. September 2026 nachgemessen: Die Feldliste der Ebene 27 führt kein
 * Geometriefeld, und `query?where=1%3D1&outFields=*&returnGeometry=true`
 * antwortet in jedem Format (`geojson`, `json`, `pbf`) mit vollständigen
 * Sachdaten und `geometry: null` — 2.489 Bytes für 29 Bezirke, kein
 * Fehler, kein Hinweis. Die Geometrie gibt der Dienst über **`identify`**
 * heraus: ein Rechteck über die ganze Stadt, `tolerance=0`, `sr=4326`, und
 * die Antwort trägt alle 29 Ringe in Grad (`[9.4459, 51.3155]`). Das
 * Rechteck ist `KASSEL.reportBounds` — der Gemeindeumriss —, und
 * `quellen.test.ts` hält beide gleich. Ohne `mapExtent` und `imageDisplay`
 * antwortet `identify` mit einem Fehler; die Werte sind Pflicht und ohne
 * Bedeutung bei Toleranz null. Kein `expectedFeatures`: Die Antwort ist
 * Esri-JSON (`results[]`), keine FeatureCollection — die Zählung macht
 * `build-data-kassel.ts`.
 *
 * Die **Ortsbezirke** liegen in einem zweiten Kartendienst
 * (`Politik_Verwaltung`, Ebene 0) und antworten auf `query` wie üblich mit
 * GeoJSON in `[lon, lat]`; ihr Katalogeintrag nennt die Datenlizenz
 * Deutschland Namensnennung 2.0. 24 Flächen: 23 Ortsbezirke und die
 * ortsbezirksfreie Dönchelandschaft.
 */
const KASSEL_ARCGIS = 'https://geoportal.kassel.de/arcgis/rest/services/Service_Daten'

/**
 * Ein `identify` über ein Rechteck in Grad — der Weg zur Geometrie, wenn
 * `query` sie verweigert. Das Rechteck ist Eingabe und Ausgabe zugleich
 * (`sr=4326`), `layers=all:<ebene>` fragt genau eine Ebene.
 */
export function arcgisIdentifyUrl(
  service: string,
  layer: number,
  box: { minLon: number; minLat: number; maxLon: number; maxLat: number }
): string {
  const envelope = `${box.minLon},${box.minLat},${box.maxLon},${box.maxLat}`
  const params = new URLSearchParams({
    geometry: envelope,
    geometryType: 'esriGeometryEnvelope',
    sr: '4326',
    layers: `all:${layer}`,
    tolerance: '0',
    mapExtent: envelope,
    imageDisplay: '800,600,96',
    returnGeometry: 'true',
    f: 'json',
  })
  return `${service}/identify?${params}`
}

/** Der Gemeindeumriss aus `KASSEL.reportBounds` — hier abgeschrieben, weil diese Datei nichts aus `core` liest. */
const KASSEL_BOX = { minLon: 9.35, minLat: 51.26, maxLon: 9.58, maxLat: 51.37 }

const KASSEL_FILES: readonly FileSource[] = [
  {
    key: 'bezirke',
    url: arcgisIdentifyUrl(`${KASSEL_ARCGIS}/Verkehr_Mobilitaet/MapServer`, 27, KASSEL_BOX),
    file: 'bezirke.json',
  },
  {
    key: 'districts',
    url: arcgisQueryUrl(`${KASSEL_ARCGIS}/Politik_Verwaltung/MapServer/0`),
    file: 'districts.json',
    expectedFeatures: 24,
  },
]

/**
 * Essen — Stadt Essen, DL-DE/BY-2.0, drei **fertige GeoJSON-Dateien** aus dem
 * DKAN-Portal `opendata.essen.de`. Kein WFS, kein FeatureServer: Das
 * Geodatenportal der Stadt (`geodaten.essen.de`) ist aus dieser Umgebung
 * nicht erreichbar (`CONNECT tunnel failed, 502`), und die Dateien sind der
 * Weg, den das Open-Data-Portal selbst nennt. Alle drei am 17. September 2026
 * gemessen: `application/geo+json`, `[lon, lat]` in Grad (die Zonen tragen
 * `crs: EPSG:4326` im Kopf, die Stadtteile keinen), Zahlen unten aus den
 * Dateien gezählt.
 *
 * Bewusst NICHT abgerufen: `Stadtgrenze_WGS84.geojson` (1 Polygon, diente nur
 * zum Messen der `reportBounds`), `Stadtbezirke_WGS84.geojson` (9 Bezirke —
 * die 50 Stadtteile verorten feiner, wie in Düsseldorf), und die Shape-Fassungen
 * in ETRS89/UTM (EPSG 4647). Einen Datensatz mit Parkscheinautomaten, Tarif-
 * oder Bewirtschaftungszonen führt der Katalog nicht (110 Datensätze, nach
 * `park|bewohner|gebühr` gefiltert: nur dieser eine) — Essen bleibt Klasse C.
 */
const ESSEN_OPENDATA = 'https://opendata.essen.de/sites/default/files'

const ESSEN_FILES: readonly FileSource[] = [
  // Die einzigen Flächen: neun Bewohnerparkbereiche, drei Felder, keine
  // Zeiten, kein Betrag. Katalog `modified` 2022-11-09.
  { key: 'zones', url: `${ESSEN_OPENDATA}/Bewohnerparkbereiche.geojson`, file: 'zones.json', expectedFeatures: 9 },
  // Dieselbe Rolle wie Berlins Ortsteile: Kartenkontext und Stadtteilname
  // im Panel. 50 Polygone mit `STADTTEILE`, aus „Verwaltungsgrenzen der
  // Stadt Essen" (FB 12 / FB 62), `modified` 2024-07-02.
  { key: 'districts', url: `${ESSEN_OPENDATA}/Stadtteile_WGS84.geojson`, file: 'districts.json', expectedFeatures: 50 },
  // Die Umweltzone als drei Polygone (FB 62 / FB 59), `modified` 2024-07-02.
  { key: 'lowEmissionZone', url: `${ESSEN_OPENDATA}/Umweltzone_Essen_0.geojson`, file: 'umweltzone.json', expectedFeatures: 3 },
]

/**
 * Saarbrücken — Landeshauptstadt Saarbrücken über ihr Open-Data-Portal
 * (`opendata.saarbruecken.de`, CKAN 2.11). Lizenz dort nur als `datenliz-de`
 * ohne Variante, siehe `SAARBRUECKEN.licenceOpen` in `core/city.ts`.
 *
 * Kein Dienst, sondern **statische GeoJSON-Dateien** je Datensatz, immer
 * paarweise: `<name>_fl.geojson` mit den Flächen (jedes Feature nur
 * `{"ID": 0}`) und `<name>_txt(_pos).geojson` mit den Beschriftungspunkten
 * aus dem CAD. Der Text steht also in einer anderen Datei als die Fläche,
 * und `build-data-saarbruecken.ts` legt die Punkte in die Flächen. Alle
 * Dateien in `[lon, lat]`, am 17. September 2026 nachgemessen (erster
 * Stützpunkt `[7.0028, 49.2308]`); die Stadtteil-Dateien tragen eine dritte
 * Koordinate `0.0`, die der Datenbau fallen lässt. Ein `crs`-Feld hat keine
 * der Dateien.
 *
 * Die vier Dateien:
 *
 * - `parkzonen_fl.geojson` — 27 MultiPolygone, die Bewohnerparkzonen.
 * - `parkzonen_txt_pos.geojson` — 30 Punkte, 27 mit `Text` (`A1` … `U`),
 *   drei ohne, alle drei auf demselben Punkt.
 * - `stadtteile_fl.geojson` / `stadtteile_txt.geojson` — die 20 Stadtteile
 *   als Flächen und als Beschriftung (`11 Alt-Saarbrücken`). Die 57
 *   **Distrikte** desselben Portals wären feiner, tragen aber nur eine
 *   Nummer (`453`) und keinen Namen; für die Kopfzeile des Panels sind die
 *   Stadtteile die richtige Ebene.
 *
 * Die Adressen enthalten die CKAN-Kennungen von Datensatz und Ressource;
 * `package_show?id=parkzonen` nennt sie, falls sie sich ändern. Die
 * `expectedFeatures` gelten, weil die Dateien GeoJSON-FeatureCollections
 * sind — ein leerer oder halber Abruf fiele an der 95-%-Schwelle auf.
 */
const SAARBRUECKEN_CKAN = 'https://opendata.saarbruecken.de/dataset'

const SAARBRUECKEN_FILES: readonly FileSource[] = [
  {
    key: 'zones',
    url: `${SAARBRUECKEN_CKAN}/bc0c5b4c-986c-4e7e-92c7-70a150ef3bc3/resource/7ec001d8-f31a-4c6a-84c3-fafe0046ac0f/download/parkzonen_fl.geojson`,
    file: 'zones.json',
    expectedFeatures: 27,
  },
  {
    key: 'zoneLabels',
    url: `${SAARBRUECKEN_CKAN}/bc0c5b4c-986c-4e7e-92c7-70a150ef3bc3/resource/5d6793f3-fcf8-4e7d-8eae-87d531597918/download/parkzonen_txt_pos.geojson`,
    file: 'zoneLabels.json',
    expectedFeatures: 30,
  },
  {
    key: 'districts',
    url: `${SAARBRUECKEN_CKAN}/3f0e6878-d689-4a15-94d1-b00c5e0a0b08/resource/033f9637-fb26-428c-aaac-f01dc854d508/download/stadtteile_fl.geojson`,
    file: 'districts.json',
    expectedFeatures: 20,
  },
  {
    key: 'districtLabels',
    url: `${SAARBRUECKEN_CKAN}/3f0e6878-d689-4a15-94d1-b00c5e0a0b08/resource/98224953-8bee-4966-8e78-5f9a2c60b3ac/download/stadtteile_txt.geojson`,
    file: 'districtLabels.json',
    expectedFeatures: 20,
  },
]

/**
 * Ein Opendatasoft-Export als GeoJSON — der Weg für jedes Portal dieser
 * Bauart (Paris, Toulouse, Nantes, Bordeaux nutzen dieselbe Software).
 *
 * `/exports/geojson` liefert die **ganze** Ebene in einer Antwort, ohne
 * Seitengrenze; `/records` dagegen höchstens 100 je Seite und über `limit`
 * höchstens 10.000. Am 17. September 2026 nachgemessen: 19 Features,
 * 93.045 Bytes, `application/json; charset=utf-8`, `[lon, lat]` in Grad —
 * Opendatasoft liefert GeoJSON immer in WGS84, ein `srsName` gibt es nicht.
 * `build-data-strasbourg.ts` misst die Grade trotzdem nach.
 */
export function odsExportUrl(portal: string, dataset: string): string {
  return `https://${portal}/api/explore/v2.1/catalog/datasets/${dataset}/exports/geojson`
}

/**
 * Straßburg — Ville de Strasbourg über das Opendatasoft-Portal der Ville et
 * Eurométropole (`data.strasbourg.eu`), Licence Ouverte (Etalab).
 *
 * Drei Ebenen, alle als Datei:
 *
 * - `stationnement-payant` — „Zones de stationnement payant", 19 Polygone
 *   mit Farbe und Tarifstaffel; die Zeiten stehen nur in der Beschreibung
 *   (siehe `core/strasbourg.ts`). Lizenz „Licence Ouverte (Etalab)", also
 *   die Fassung 1.0.
 * - `strasbourg-10-quartiers` — „Découpage de la ville de Strasbourg en 10
 *   quartiers", Eurométropole, Stand 7. Dezember 2018, dieselbe Lizenz. Es
 *   gibt auch Schnitte in 14, 15, 23 und 28 Quartiere; die zehn sind die
 *   Gliederung, die die Stadt selbst in „Mon quartier" führt (Robertsau-
 *   Wacken, Gare-Kléber, Bourse-Esplanade-Krutenau, …).
 * - `stationnement_residant` — „Zones de stationnement résidant", 15
 *   Polygone (Licence Ouverte v2.0), nur zur Gegenprobe: Jede Tarifzone
 *   nennt in `numero_zone_resident` die Bewohnerzone, in der sie liegt, und
 *   der Datenbau prüft, dass es die gibt.
 *
 * Bewusst NICHT abgerufen: `vo_st_stationmnt_vehi` („Le stationnement des
 * véhicules", 26.851 Stellplatzreihen der ganzen Eurométropole mit
 * `occupation` payant/gratuit/livraison, aber ohne Tarif und Zeit),
 * `zfe_emprise` (die ZFE-m der Eurométropole — Crit'Air, nicht die deutsche
 * Umweltzone, siehe `docs/staedte-strasbourg.md`) und `limites_de_communes`
 * (nur für den Rahmen gemessen, nicht ausgeliefert).
 */
const STRASBOURG_ODS = 'data.strasbourg.eu'

const STRASBOURG_FILES: readonly FileSource[] = [
  { key: 'zones', url: odsExportUrl(STRASBOURG_ODS, 'stationnement-payant'), file: 'zones.json', expectedFeatures: 19 },
  { key: 'districts', url: odsExportUrl(STRASBOURG_ODS, 'strasbourg-10-quartiers'), file: 'districts.json', expectedFeatures: 10 },
  { key: 'residents', url: odsExportUrl(STRASBOURG_ODS, 'stationnement_residant'), file: 'residents.json', expectedFeatures: 15 },
]

/**
 * St. Gallen — Stadt St.Gallen, Rauminformationszentrum (RIZ), über das
 * Open-Data-Portal der Stadt `daten.stadt.sg.ch` (Opendatasoft), CC BY 4.0.
 *
 * Kein WFS und kein ArcGIS, sondern der **GeoJSON-Export** des Portals
 * (`…/datasets/<id>/exports/geojson`). Er liefert ohne `limit` alle Zeilen
 * (am 17. September 2026 nachgemessen: 3.232 von 3.232), `limit=-1` steht
 * trotzdem da, weil die Opendatasoft-Doku es als „alles" definiert und ein
 * künftiger Vorgabewert sonst still kürzen könnte. Die Antwort ist immer
 * WGS84 in `[lon, lat]` (erster Stützpunkt `[9.3027, 47.4043]`); der
 * Datenbau misst mit `assertDegrees` trotzdem nach. Die Sachfelder tragen
 * zusätzlich `geo_point_2d` als Objekt `{lon, lat}` — den Schwerpunkt, kein
 * GeoJSON.
 *
 * Zwei Ebenen:
 *
 * - `ppv-parkflaeche` — 3.232 Parkfeld-Polygone mit `markierungsart`,
 *   `zutrittsart`, `anzahl_pp`. Keine Zeiten, keine Beträge, kein Sektor.
 *   Stand der Daten 2023-07-05 (`data_processed`); die Metadaten wurden
 *   zuletzt 2026-02-23 angefasst.
 * - `wohnviertel` — die 31 statistischen Quartiere mit Kreis und
 *   Quartiergruppe, für Kartenkontext, Ortsangabe im Panel und den Rahmen.
 *
 * Nicht im Portal: die EBZ-Sektoren (nur als Ebene `ebz` im Stadtplan
 * `map.stadt.sg.ch`, ohne erreichbaren Dienst dahinter) und eine
 * Gemeindegrenze — der Rahmen kommt aus dem Umriss der 31 Quartiere.
 */
const STGALLEN_ODS = 'https://daten.stadt.sg.ch/api/explore/v2.1/catalog/datasets'

const STGALLEN_FILES: readonly FileSource[] = [
  { key: 'zones', url: `${STGALLEN_ODS}/ppv-parkflaeche/exports/geojson?limit=-1`, file: 'zones.json', expectedFeatures: 3232 },
  { key: 'districts', url: `${STGALLEN_ODS}/wohnviertel/exports/geojson?limit=-1`, file: 'districts.json', expectedFeatures: 31 },
]

const FILES_BY_CITY: Record<string, readonly FileSource[]> = {
  strasbourg: STRASBOURG_FILES,
  koeln: KOELN_FILES,
  cottbus: COTTBUS_FILES,
  graz: GRAZ_FILES,
  innsbruck: INNSBRUCK_FILES,
  zuerich: ZUERICH_FILES,
  utrecht: nprFiles('344', [496, 362, 760, 56, 1112, 343, 38, 102]),
  denhaag: nprFiles('518', [515, 239, 804, 198, 2866, 119, 44, 0]),
  rotterdam: nprFiles('599', [360, 243, 688, 132, 5425, 196, 43, 411]),
  groningen: nprFiles('14', [235, 74, 342, 82, 1076, 104, 39, 22]),
  nijmegen: nprFiles('268', [89, 58, 168, 66, 1364, 108, 48, 74]),
  eindhoven: nprFiles('772', [328, 328, 372, 101, 990, 261, 44, 44]),
  genf: GENF_FILES,
  bern: BERN_FILES,
  krakau: KRAKAU_FILES,
  kassel: KASSEL_FILES,
  essen: ESSEN_FILES,
  saarbruecken: SAARBRUECKEN_FILES,
  stgallen: STGALLEN_FILES,
}

/** Die Dateien einer Stadt; leer für Städte, die alles aus WFS bekommen. */
export function cityFiles(cityKey: string): readonly FileSource[] {
  return FILES_BY_CITY[cityKey] ?? []
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
    srsName: source.srsName ?? 'urn:ogc:def:crs:EPSG::4326',
  })
  if (source.filter !== undefined) params.set('filter', source.filter)
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
