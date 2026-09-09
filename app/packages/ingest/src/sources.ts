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

const BY_CITY: Record<string, readonly Source[]> = {
  berlin: BERLIN_SOURCES,
  hamburg: HAMBURG_SOURCES,
  frankfurt: FRANKFURT_SOURCES,
  muenchen: MUENCHEN_SOURCES,
  koeln: KOELN_SOURCES,
  duesseldorf: DUESSELDORF_SOURCES,
  karlsruhe: KARLSRUHE_SOURCES,
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
}

const KOELN_FILES: readonly FileSource[] = [
  {
    key: 'automats',
    url: 'https://www.offenedaten-koeln.de/sites/default/files/distribution/psa_2016.csv',
    file: 'automats.csv',
  },
]

/** Die Dateien einer Stadt; leer für Städte, die alles aus WFS bekommen. */
export function cityFiles(cityKey: string): readonly FileSource[] {
  return cityKey === 'koeln' ? KOELN_FILES : []
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
