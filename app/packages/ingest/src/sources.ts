/**
 * Amtliche Quellen, nach Stadt.
 *
 * Zwei Städte, zwei Behörden, zwei Lizenzen — und das ist der Grund, warum das
 * hier nicht mehr eine flache Liste ist. Berlin gibt unter Datenlizenz
 * Deutschland **Zero** 2.0 heraus, Nennung freiwillig; Hamburg unter Datenlizenz
 * Deutschland **Namensnennung** 2.0, Nennung Bedingung. Wer die zweite Stadt
 * anschließt, ohne die Quelle zu nennen, verletzt eine Lizenz, nicht eine
 * Konvention. `City.attribution` in `@parkingzone/core` trägt diesen
 * Unterschied bis in die Oberfläche.
 *
 * srsName wird ausdrücklich angefordert: Die Dienste liegen nativ in
 * EPSG:25833 (Berlin) bzw. EPSG:25832 (Hamburg) und projizieren auf Anfrage um.
 * Das hier zu verlangen hält jeden Verbraucher weiter unten frei davon.
 */

export interface Source {
  key: string
  /** Vollständige Adresse des Dienstes, ohne Abfrageteil. */
  service: string
  typeName: string
  /** Ungefähr, damit ein still abgeschnittener Abruf auffällt. */
  expectedFeatures: number
}

const BERLIN_WFS = 'https://gdi.berlin.de/services/wfs'

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
  { key: 'zones', service: `${BERLIN_WFS}/parkraumbewirtschaftung`, typeName: 'parkraumbewirtschaftung:parkzonen', expectedFeatures: 103 },
  { key: 'segments', service: `${BERLIN_WFS}/parkplaetze`, typeName: 'parkplaetze:parkplaetze', expectedFeatures: 45917 },
  { key: 'parkAndRide', service: `${BERLIN_WFS}/park_and_ride`, typeName: 'park_and_ride:park_and_ride', expectedFeatures: 49 },
  { key: 'parkAndRideUmland', service: `${BERLIN_WFS}/park_and_ride`, typeName: 'park_and_ride:park_and_ride_umland', expectedFeatures: 59 },
  // Ein Feature, 7 KB, und die einzige Ebene, die „darf ich hier überhaupt
  // fahren" beantwortet statt „was kostet Parken".
  { key: 'lowEmissionZone', service: `${BERLIN_WFS}/umweltzone`, typeName: 'umweltzone:umweltzone', expectedFeatures: 1 },
  { key: 'accessible', service: `${BERLIN_WFS}/behindertenparkplaetze`, typeName: 'behindertenparkplaetze:bpark', expectedFeatures: 923 },
  // Nur Kontext: Ohne Hintergrundkarte schweben die Zonenpolygone im Nichts,
  // und Ortsteilgrenzen reichen, um Kreuzberg von Spandau zu unterscheiden.
  { key: 'districts', service: `${BERLIN_WFS}/alkis_ortsteile`, typeName: 'alkis_ortsteile:ortsteile', expectedFeatures: 97 },
]

/**
 * Hamburg — Landesbetrieb Geoinformation und Vermessung, DL-DE/BY-2.0.
 *
 * **Recherchiert, nicht abgerufen.** Aus dieser Arbeitsumgebung sperrt der
 * Egress-Proxy `geodienste.hamburg.de` wie `suche.transparenz.hamburg.de`; die
 * Adressen und Typnamen stammen aus den Metadaten der Dienste, die Zahlen in
 * `expectedFeatures` sind **geschätzt**. Der erste echte Abruf wird sie
 * korrigieren — und genau dafür stehen sie hier: Ein Abruf, der 40 statt 250
 * Gebiete liefert, soll auffallen, auch wenn die Schätzung grob ist.
 *
 * Was noch fehlt, bevor das läuft: ein Parser für die Hamburger Schreibweise
 * der Zeiten. Berlins „Mo-Sa 9-20 Uhr" ist eine Konvention dieses Feeds, keine
 * Norm. Bis der Parser steht, ist diese Liste Dokumentation, kein Abrufplan —
 * `citySources` gibt sie deshalb nur auf ausdrückliche Nachfrage heraus.
 */
const HAMBURG_SOURCES: readonly Source[] = [
  {
    key: 'residentZones',
    service: 'https://geodienste.hamburg.de/HH_WFS_bewohnerparkgebiete',
    typeName: 'de.hh.up:bewohnerparkgebiete',
    expectedFeatures: 100,
  },
  {
    key: 'publicParking',
    service: 'https://geodienste.hamburg.de/HH_WFS_Parkraum',
    typeName: 'de.hh.up:parkraum',
    expectedFeatures: 1000,
  },
]

const BY_CITY: Record<string, readonly Source[]> = {
  berlin: BERLIN_SOURCES,
  hamburg: HAMBURG_SOURCES,
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

/** Die Quellen der Stadt, die heute gebaut wird. */
export const SOURCES: readonly Source[] = citySources(process.env.CITY ?? 'berlin')

export function wfsUrl(source: Source): string {
  const params = new URLSearchParams({
    service: 'WFS',
    version: '2.0.0',
    request: 'GetFeature',
    typeNames: source.typeName,
    outputFormat: 'application/json',
    srsName: 'urn:ogc:def:crs:EPSG::4326',
  })
  return `${source.service}?${params}`
}
