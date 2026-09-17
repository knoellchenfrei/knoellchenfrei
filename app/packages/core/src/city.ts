/**
 * Eine Stadt als Konfiguration.
 *
 * Bis hierher steckte Berlin an vier Stellen als Konstante im Code: in zwei
 * Bounding-Boxen im Web, einer dritten im Worker und im Kartenmittelpunkt.
 * Vier Zahlenpaare, die auseinanderlaufen können — und genau das ist der
 * teuerste Fehler dieser Art: Weicht die Prüfung im Worker von der im Browser
 * ab, verwirft der Server Meldungen, die die App gerade noch angenommen hat,
 * und niemand sieht, warum.
 *
 * Die Zonendaten hängen NICHT hier, sondern liegen je Stadt als eigene Dateien
 * unter `public/data/<key>/`. Der Browser holt sie zur Laufzeit; ein
 * Stadtwechsel lädt also nach, statt einen zweiten Build zu verlangen. (Eine
 * frühere Fassung dieses Kommentars behauptete das Gegenteil und begründete
 * damit einen Build je Stadt — das war falsch: `loadData` hat die Dateien
 * schon immer per `fetch` geholt. Nur das Artifact bettet sie ein, und dort
 * ist der Umschalter deshalb auf die eingebetteten Städte beschränkt.)
 *
 * Was hier NICHT steht, obwohl es nach Stadt aussieht:
 *
 * - **Die Zeitzone.** `Europe/Berlin` gilt für ganz Deutschland; sie ist keine
 *   Eigenheit Berlins, sondern die des Landes. `berlin-time.ts` heißt deshalb
 *   weiter so und bleibt unverändert richtig. Erst eine Stadt außerhalb dieser
 *   Zone macht daraus eine Konfiguration. Wien und Zürich (seit dem
 *   16. September) liegen in derselben — `Europe/Vienna` und `Europe/Zurich`
 *   sind dieselbe Wanduhr wie Berlin, mit derselben Sommerzeit.
 * - **Der Tarif.** Der steht je Zone im Feed, nicht je Stadt. Eine Stadt hat
 *   keinen Preis, ihre Zonen haben einen.
 *
 * Der Feiertagskalender steht in `holidays.ts` und hängt am Bundesland, nicht
 * an der Stadt: Zwei Städte in Nordrhein-Westfalen teilen ihn sich. Die eine
 * Ausnahme trägt `holidays` unten — Bayern kennt Feiertage, die *gemeindeweise*
 * gelten, und die passen in keine Ländertabelle.
 */

import type { BoundingBox, Position } from './geo.js'
import type { HeatGrid } from './heatmap.js'
import { countryOf, type Country, type Land } from './holidays.js'

export interface Attribution {
  /** Wer die Daten herausgibt, wörtlich so, wie er genannt werden will. */
  source: string
  licence: string
  licenceUrl: string
  /**
   * Der Datensatz selbst, nicht die Lizenz.
   *
   * § 2 der Datenlizenz Deutschland verlangt bei Namensnennung neben dem
   * Herausgeber auch einen Verweis auf den Datensatz — „soweit verfügbar mit
   * dem Uniform Resource Identifier". Der Quellenvermerk allein erfüllt die
   * Auflage nicht (Audit-Punkt M-016). Hier steht die Adresse, die der
   * Datenbau wirklich abruft, nicht eine Portalseite, die daneben liegt.
   */
  datasetUrl: string
  /**
   * Ob die Lizenz die Nennung verlangt.
   *
   * Der Unterschied ist keine Formalie: Berlin gibt unter Datenlizenz
   * Deutschland **Zero** 2.0 heraus — Nennung freiwillig. Hamburg nutzt
   * Datenlizenz Deutschland **Namensnennung** 2.0; dort ist die Quellenangabe
   * Lizenzbedingung, und eine Oberfläche, die sie weglässt, verletzt sie.
   */
  attributionRequired: boolean
  /**
   * Welche Lizenz*familie* — nicht welche Lizenz.
   *
   * Der Unterschied ist ein Satz mehr in der Oberfläche: CC BY 4.0
   * § 3 a) 1) A) iv) verlangt einen Hinweis auf den Gewährleistungsausschluss,
   * die Datenlizenz Deutschland nicht. Auf den Text von `licence` zu prüfen
   * wäre der bequeme Weg und die falsche Abstraktion — er ist ein
   * Anzeigename und kann sich ändern, ohne dass sich die Auflage ändert
   * (`docs/staedte-karlsruhe.md`, 5.3).
   */
  licenceFamily: LicenceFamily
}

/**
 * `cc0` kam am 16. September mit Rostock: keine Nennung verlangt, wie
 * DL-DE/Zero. `unklar` ist keine Lizenz, sondern ihr Fehlen — der Dienst
 * nennt keine Bedingungen (Graz, Innsbruck, Kassel). Eine solche Stadt trägt
 * `licenceOpen` mit dem Satz, was offen ist, und die App zeigt ihn über der
 * Karte; ohne diese Familie hätte der Datenbau eine Lizenz erfinden müssen.
 */
export type LicenceFamily = 'dl-de-zero' | 'dl-de-by' | 'cc-by' | 'cc0' | 'unklar'

export interface City {
  /** Kleingeschrieben, ohne Umlaute — taugt als Dateiname und als URL-Teil. */
  key: string
  name: string
  land: Land
  /** Kartenmittelpunkt beim ersten Öffnen. */
  center: Position
  zoom: number
  /**
   * Wo eine Meldung liegen darf.
   *
   * Eng gefasst: Alles außerhalb ist ein Fehler oder ein Missbrauchsversuch.
   * Diese Box prüfen Browser und Worker mit denselben Zahlen.
   */
  reportBounds: BoundingBox
  /**
   * Wo ein *gespeicherter* Parkplatz liegen darf.
   *
   * Bewusst weiter als `reportBounds`. Sie prüft keinen fremden Eingabewert,
   * sondern erkennt kaputten oder fremden `localStorage` — und wer am
   * Stadtrand parkt und über die Grenze läuft, soll seine Uhr behalten.
   */
  sessionBounds: BoundingBox
  /**
   * Das 250-m-Raster der Kontrolldichte, siehe `HeatGrid` in `heatmap.ts`.
   *
   * Fest, nie aus den Daten abgeleitet. Ursprung ist die Südwestecke der
   * `reportBounds` zum Zeitpunkt der Einführung — als Zahl hier abgeschrieben,
   * nicht als Verweis: Ändern sich die Grenzen später, darf das Raster nicht
   * mitwandern, sonst liegt jede gespeicherte Zelle woanders.
   */
  heatGrid: HeatGrid
  attribution: Attribution
  /**
   * Feste Feiertage, die **nur in dieser Stadt** gelten, als `MM-TT`.
   *
   * Die Ausnahme von der Regel „Feiertage hängen am Land". Art. 1 Abs. 1 Nr. 2
   * des Bayerischen Feiertagsgesetzes macht Mariä Himmelfahrt zum
   * gesetzlichen Feiertag „in Gemeinden mit überwiegend katholischer
   * Bevölkerung", Abs. 2 gibt Augsburg zusätzlich das Friedensfest. In Bayern
   * gilt der 15. August damit in 1.708 der 2.056 Gemeinden und in den übrigen
   * 348 nicht — eine Tabelle je Land kann das nicht ausdrücken, ohne für die
   * eine oder die andere Hälfte falsch zu sein.
   *
   * Fehlt das Feld, gilt allein der Länderkalender. Für Berlin, Hamburg und
   * Frankfurt ist das richtig: Keines der drei Länder kennt eine gemeindeweise
   * Regelung.
   */
  holidays?: readonly string[]
  /**
   * Wie weit eine Ortung neben einer Fläche liegen darf, damit die App sie
   * dieser Fläche zuordnet — in Metern, und nur für Städte, deren „Zonen"
   * keine Gebiete sind, sondern die Stellplatzreihen selbst.
   *
   * Karlsruhe ist der Fall: 279 Flächen, im Median 128 m² und 4,8 m breit.
   * Eine Ortung auf 10 bis 20 m trifft so eine Fläche fast nie, und die App
   * hätte an jedem Karlsruher Automaten „außerhalb der Parkraumbewirtschaftung"
   * gesagt (`docs/staedte-karlsruhe.md`, Punkt 5.1). In Berlin, Hamburg,
   * Frankfurt und München sind die Zonen Gebiete mit Straßen als Grenze; dort
   * hiesse ein Rückfall, jemanden von der falschen Straßenseite in eine Zone
   * zu ziehen. Deshalb je Stadt, nicht global — und ohne Wert gibt es keinen
   * Rückfall.
   */
  zoneSnapMetres?: number
  /**
   * Wer Auskunft gibt, wenn das Auto weg ist.
   *
   * Bis zum 7. September stand in `TowInfo.tsx` fest verdrahtet die
   * Auskunfts- und Fahndungsstelle der **Polizei Berlin** — mit Link, Nummer
   * und Namen, in allen vier Städten. Wer in München sein Auto suchte, bekam
   * eine Berliner Telefonnummer, und das ist schlechter als gar keine Angabe:
   * Es sieht aus wie eine Auskunft. Derselbe Fehler wie damals bei den
   * Demodaten, die über Berliner Koordinaten gestreut waren.
   *
   * **Fehlt das Feld, wird der Abschnitt nicht angezeigt** — kein Rückfall auf
   * Berlin. Das ist die Regel dieses Projekts für unbekannte Städte, und sie
   * gilt hier genauso.
   */
  towedVehicles?: TowedVehicles
  /**
   * Was an der Lizenz der Zonendaten ungeklärt ist — ein Satz, den die App
   * als Banner über der Karte zeigt, solange er da steht.
   *
   * Nur zusammen mit `licenceFamily: 'unklar'`. Der Betreiber hat am
   * 16. September entschieden, solche Städte trotzdem anzuschliessen und die
   * Frage sichtbar zu machen, statt sie zu verschweigen oder die Stadt
   * wegzulassen. Fällt die Klärung, verschwindet mit dem Feld der Banner.
   */
  licenceOpen?: string
}

/** Der Staat einer Stadt, aus ihrem Landeskürzel (siehe `countryOf`). */
export function cityCountry(city: Pick<City, 'land'>): Country {
  return countryOf(city.land)
}

/** Anzeigename je Staat, für die Stadtwahl und den Standort-Vorschlag. */
export const COUNTRY_NAMES: Record<Country, string> = {
  DE: 'Deutschland',
  AT: 'Österreich',
  CH: 'Schweiz',
  NL: 'Niederlande',
  FR: 'Frankreich',
  PL: 'Polen',
}

/**
 * Die Stelle, die weiß, wohin ein umgesetztes Fahrzeug gebracht wurde.
 *
 * Warum die Telefonnummer optional ist und ein Prüfdatum trägt: Eine falsche
 * Nummer ist schlimmer als keine — sie kostet jemanden Zeit in einer Lage, in
 * der er ohnehin keine hat. Die amtliche Seite ist deshalb der Hauptweg, die
 * Nummer ein datierter Hinweis daneben. Wo sie sich am 7. September nicht aus
 * einer amtlichen Quelle belegen ließ, steht sie nicht da.
 */
export interface TowedVehicles {
  /** Wie die Stelle heißt, wörtlich wie bei ihr selbst. */
  authority: string
  /** Die amtliche Seite. Sie gilt, nicht die Angaben hier. */
  url: string
  /** Nur, wenn auf genau dieser Seite belegt. */
  phone?: string
  /** Wann die Angaben zuletzt gegen die Seite gehalten wurden, `JJJJ-MM`. */
  checkedOn: string
  /** Ein Satz, der etwas erklärt, das die Nummer allein nicht sagt. */
  note?: string
}

/**
 * Berlin — die Stadt, mit der das Projekt angefangen hat.
 *
 * Die Boxen sind die Zahlen, die vorher verstreut im Code standen; sie sind
 * hier zusammengezogen, nicht neu erfunden.
 */
export const BERLIN: City = {
  key: 'berlin',
  name: 'Berlin',
  land: 'BE',
  center: [13.404954, 52.520008],
  zoom: 11.5,
  reportBounds: { minLon: 13.0, minLat: 52.3, maxLon: 13.8, maxLat: 52.7 },
  sessionBounds: { minLon: 12.5, minLat: 52.0, maxLon: 14.5, maxLat: 53.0 },
  // Das alte, einzige Raster — ohne Namen, damit jeder gespeicherte
  // Schlüssel bleibt, was er war.
  heatGrid: { id: '', originLon: 13.0, originLat: 52.3, latitude: 52.52 },
  attribution: {
    source: 'Geodateninfrastruktur Berlin (gdi.berlin.de)',
    datasetUrl: 'https://gdi.berlin.de/services/wfs/parkraumbewirtschaftung',
    licence: 'Datenlizenz Deutschland Zero 2.0',
    licenceUrl: 'https://www.govdata.de/dl-de/zero-2-0',
    attributionRequired: false,
    licenceFamily: 'dl-de-zero',
  },
  towedVehicles: {
    authority: 'Auskunfts- und Fahndungsstelle der Polizei Berlin',
    url: 'https://www.berlin.de/polizei/service/auto-fahrrad-bus/auto-wiederfinden/',
    // Die Nummer aus der Ideenliste von 2012 — (030) 4664-98 7800 — stimmt
    // nicht mehr. Diese steht auf der amtlichen Seite.
    phone: '(030) 4664-709800',
    checkedOn: '2026-09',
  },
}

/**
 * Hamburg — die zweite Stadt, vorbereitet, noch nicht angeschlossen.
 *
 * Die Box ist gerechnet, nicht geschätzt: Hamburg gibt die größte Ausdehnung
 * des Stadtgebiets **ohne Neuwerk** mit 39,88 km in Ost-West- und 42,31 km in
 * Nord-Süd-Richtung an, um einen Mittelpunkt im Bereich Uhlenhorst. Auf
 * 53,57° Nord sind 39,88 km rund 0,60° Länge und 42,31 km rund 0,38° Breite;
 * aufgerundet ergibt das die Box unten.
 *
 * Neuwerk, Scharhörn und Nigehörn liegen absichtlich draußen. Sie gehören zu
 * Hamburg, liegen aber 100 km westlich im Wattenmeer, und es gibt dort keine
 * Parkraumbewirtschaftung. Eine Box, die sie einschließt, wäre 130 km breit
 * und würde die halbe Nordsee als gültigen Meldeort akzeptieren.
 */
export const HAMBURG: City = {
  key: 'hamburg',
  name: 'Hamburg',
  land: 'HH',
  center: [9.9937, 53.5511],
  zoom: 11.5,
  reportBounds: { minLon: 9.7, minLat: 53.35, maxLon: 10.35, maxLat: 53.8 },
  sessionBounds: { minLon: 9.4, minLat: 53.15, maxLon: 10.7, maxLat: 54.0 },
  heatGrid: { id: 'hamburg', originLon: 9.7, originLat: 53.35, latitude: 53.55 },
  attribution: {
    source: 'Freie und Hansestadt Hamburg, Landesbetrieb Geoinformation und Vermessung',
    datasetUrl: 'https://geodienste.hamburg.de/HH_WFS_bewohnerparkgebiete',
    licence: 'Datenlizenz Deutschland Namensnennung 2.0',
    licenceUrl: 'https://www.govdata.de/dl-de/by-2-0',
    attributionRequired: true,
    licenceFamily: 'dl-de-by',
  },
  towedVehicles: {
    authority: 'Zentrale Verwahrstelle der Polizei Hamburg, Ausschläger Allee',
    url: 'https://www.polizei.hamburg/zentrale-verwahrstelle-fuer-fahrzeuge-791284',
    phone: '040 7810450',
    checkedOn: '2026-09',
    // Hamburg hat zwei Verwahrstellen, und welches Kommissariat zuständig
    // ist, hängt am Abstellort — die Seite sagt das selbst. Deshalb der
    // Zusatz statt der stillen Annahme, eine Nummer reiche.
    note: 'Rund um die Uhr. Wohin genau umgesetzt wurde, weiß das Polizeikommissariat des Abstellorts.',
  },
}

/**
 * Frankfurt am Main — die dritte Stadt.
 *
 * Die Box ist gemessen, nicht geschätzt, und sie ist absichtlich **nicht** aus
 * der amtlichen Ausdehnung gerechnet: Frankfurt gibt 23,4 km Ost-West und
 * 23,3 km Nord-Süd an, das ergäbe um den Römer (8,6821 / 50,1109) herum
 * 8,52–8,85 / 50,01–50,22. Das Stadtgebiet liegt aber nicht mittig um den
 * Römer — es reicht im Westen bis Zeilsheim und Sindlingen, im Norden bis
 * Nieder-Erlenbach. Der Umriss der 46 Stadtteile aus
 * `Stadtgebietsgliederung:Stadtteile` misst 8,4714–8,8010 / 50,0149–50,2273;
 * nach außen gerundet steht das unten. Wer stattdessen die Ausdehnung
 * abgeschrieben hätte, hätte Höchst und Zeilsheim aus der Meldegrenze
 * geworfen — und die App hätte dort „außerhalb" gesagt, ohne dass irgendetwas
 * nach einem Fehler ausgesehen hätte.
 *
 * Der Zoom ist enger als in Berlin und Hamburg, weil die Stadt kleiner ist:
 * 0,40° Länge gegen Hamburgs 0,65°.
 */
export const FRANKFURT: City = {
  key: 'frankfurt',
  name: 'Frankfurt am Main',
  land: 'HE',
  center: [8.6821, 50.1109],
  zoom: 12,
  reportBounds: { minLon: 8.45, minLat: 50.0, maxLon: 8.85, maxLat: 50.25 },
  sessionBounds: { minLon: 8.2, minLat: 49.85, maxLon: 9.1, maxLat: 50.45 },
  heatGrid: { id: 'frankfurt', originLon: 8.45, originLat: 50.0, latitude: 50.11 },
  attribution: {
    // Wörtlich der Quellenvermerk aus dem ISO-Metadatensatz des Dienstes.
    // Bei DL-DE/Namensnennung ist er Lizenzbedingung, nicht Höflichkeit —
    // wer ihn umformuliert, erfüllt sie nicht mehr sicher.
    source: 'Stadt Frankfurt am Main, www.frankfurt.de',
    datasetUrl: 'https://geowebdienste.frankfurt.de/Parken',
    licence: 'Datenlizenz Deutschland Namensnennung 2.0',
    licenceUrl: 'https://www.govdata.de/dl-de/by-2-0',
    attributionRequired: true,
    licenceFamily: 'dl-de-by',
  },
  towedVehicles: {
    authority: 'Stadt Frankfurt am Main, Abschleppungen',
    url: 'https://frankfurt.de/themen/sicherheit-und-ordnung/vorgaben-und-regeln/fuer-das-auto/abschleppungen',
    // **Bewusst ohne Nummer.** Die Seite der Stadt weist automatisierte
    // Abrufe mit 403 ab, und eine Nummer aus zweiter Hand einzutragen wäre
    // genau der Fehler, den dieser Abschnitt beheben soll. Wer sie belegen
    // kann, trägt sie nach; bis dahin führt der Weg über die Seite.
    checkedOn: '2026-09',
    note: 'Die Seite der Stadt nennt die zuständige Stelle und ihre Zeiten.',
  },
}

/**
 * München — die vierte Stadt.
 *
 * Die Box ist gemessen, nicht geschätzt, und sie stammt aus den *Stadtbezirken*
 * statt aus der Parkebene: `gsm_wfs:vablock_stadtbezirk` (25 Bezirke, 27
 * Polygone) umschließt 11,3565–11,7285 / 48,0568–48,2510. Die Parkseiten
 * reichen nur bis 11,4037–11,7108 / 48,0698–48,2264, weil im äußersten Westen
 * (Aubing, Langwied) und im Norden (Feldmoching) nichts bewirtschaftet wird —
 * wer die Box daraus nähme, wiese eine Meldung aus Lochhausen als „außerhalb"
 * ab, obwohl sie mitten in München liegt. Nach außen gerundet steht der
 * Bezirksumriss unten.
 *
 * Der Mittelpunkt ist der Marienplatz. Der Zoom ist Berlins und Hamburgs:
 * 0,37° Länge liegt zwischen Frankfurts 0,40° bei Zoom 12 und Hamburgs 0,65°
 * bei 11,5 — und die bewirtschafteten Gebiete liegen dicht um die Mitte, wo
 * 11,5 sie alle zeigt.
 */
export const MUENCHEN: City = {
  key: 'muenchen',
  name: 'München',
  land: 'BY',
  center: [11.5755, 48.1372],
  zoom: 11.5,
  reportBounds: { minLon: 11.35, minLat: 48.05, maxLon: 11.73, maxLat: 48.26 },
  sessionBounds: { minLon: 11.05, minLat: 47.85, maxLon: 12.05, maxLat: 48.5 },
  heatGrid: { id: 'muenchen', originLon: 11.35, originLat: 48.05, latitude: 48.14 },
  attribution: {
    // Wörtlich der Quellenvermerk aus dem ISO-Metadatensatz beider
    // Parkebenen (`.../records/752539b9-…` und `.../records/1cb25196-…`,
    // abgerufen am 7. September 2026). Bei DL-DE/Namensnennung ist er
    // Lizenzbedingung; der Metadatensatz der Stadtbezirke nennt daneben den
    // GeodatenService, das steht in `docs/staedte.md`.
    source: 'Datenquelle: dl-de/by-2-0: Landeshauptstadt München – opendata.muenchen.de',
    datasetUrl: 'https://geoportal.muenchen.de/geoserver/mor_wfs/ows',
    licence: 'Datenlizenz Deutschland Namensnennung 2.0',
    licenceUrl: 'https://www.govdata.de/dl-de/by-2-0',
    attributionRequired: true,
    licenceFamily: 'dl-de-by',
  },
  /**
   * Mariä Himmelfahrt, und zwar belegt statt angenommen.
   *
   * Art. 1 Abs. 1 Nr. 2 BayFTG macht den 15. August nur „in Gemeinden mit
   * überwiegend katholischer Bevölkerung" zum Feiertag; nach Abs. 3 stellt das
   * Landesamt für Statistik fest, welche das sind. Dessen Gemeindeabfrage
   * (<https://www.statistik.bayern.de/statistik/gebiet_bevoelkerung/zensus/himmelfahrt/>,
   * abgerufen am 7. September 2026) führt „München, Landeshauptstadt",
   * Gemeindeschlüssel 09162000, mit **ja** — 402.058 katholische gegen 147.912
   * evangelische Einwohner nach dem Zensus. Nürnberg steht in derselben
   * Abfrage mit „nein"; eine Bayern-weite Annahme wäre also für die
   * zweitgrößte Stadt des Landes falsch gewesen.
   */
  holidays: ['08-15'],
  towedVehicles: {
    authority: 'Kfz-Verwahrstelle der Polizei München',
    url: 'https://stadt.muenchen.de/service/info/kfzverwahrstelle-der-polizei/1081220/',
    phone: '089 429301',
    checkedOn: '2026-09',
    note: 'Bei Falschparkern rund um die Uhr erreichbar, Thomas-Hauser-Straße 19.',
  },
}

/**
 * Köln — die fünfte Stadt.
 *
 * Die Box ist gemessen, nicht geschätzt: Der Umriss der Gemeinde Köln aus
 * `dvg:nw_dvg1_gem` des Landes-WFS (4.508 Stützpunkte, abgerufen am
 * 8. September 2026) misst 6,7726–7,1620 / 50,8304–51,0850; nach außen
 * gerundet steht das unten. Die 47 Bewohnerparkgebiete reichen nur
 * 6,8278–7,1075 / 50,8755–50,9752 — wer die Box daraus nähme, wiese eine
 * Meldung aus Chorweiler oder Rodenkirchen als „außerhalb" ab, obwohl dort
 * bewirtschaftet wird und nur kein Bewohnerparkgebiet liegt.
 *
 * Der Mittelpunkt ist der Dom. Der Zoom ist Berlins, Hamburgs und Münchens:
 * 0,39° Länge und 0,25° Breite liegen zwischen Frankfurts 0,40°/0,21° bei
 * Zoom 12 und Hamburgs 0,65°/0,45° bei 11,5 — und Kölns Nord-Süd-Ausdehnung
 * ist die größere von beiden, weil die Stadt von Worringen bis Godorf 28 km
 * misst. Bei 12 fielen Chorweiler im Norden und Porz im Süden aus dem Bild,
 * und in beiden stehen Automaten.
 */
export const KOELN: City = {
  key: 'koeln',
  name: 'Köln',
  land: 'NW',
  center: [6.9583, 50.9413],
  zoom: 11.5,
  reportBounds: { minLon: 6.75, minLat: 50.82, maxLon: 7.18, maxLat: 51.1 },
  sessionBounds: { minLon: 6.45, minLat: 50.6, maxLon: 7.5, maxLat: 51.35 },
  heatGrid: { id: 'koeln', originLon: 6.75, originLat: 50.82, latitude: 50.94 },
  attribution: {
    // DL-DE/Zero-2.0 verlangt keine Nennung; der Quellenvermerk steht
    // trotzdem — freiwillig ist nicht verboten, und Berlin hält es genauso.
    // Wörtlich aus `ows:AccessConstraints` des WFS: „Bereitstellung als
    // OpenData unter Datenlizenz Deutschland - Zero - Version 2.0."
    source: 'Stadt Köln, Amt für Verkehrsmanagement — offenedaten-koeln.de',
    datasetUrl: 'https://geoportal.stadt-koeln.de/wss/service/bewohnerparken_wfs/guest',
    licence: 'Datenlizenz Deutschland Zero 2.0',
    licenceUrl: 'https://www.govdata.de/dl-de/zero-2-0',
    attributionRequired: false,
    licenceFamily: 'dl-de-zero',
  },
  // `towedVehicles` fehlt mit Absicht: Für die Kölner Verwahrstelle ließ sich
  // am 8. September keine amtliche Seite mit Namen und Nummer belegen. Fehlt
  // das Feld, zeigt die App den Abschnitt nicht — eine Nummer aus zweiter
  // Hand wäre schlechter als keine.
}

/**
 * Düsseldorf.
 *
 * Die Box ist gemessen, nicht geschätzt: Der Umriss der Stadt aus
 * `grenzen:stadtgrenze` (abgerufen am 8. September 2026) misst
 * 6,6888–6,9399 / 51,1244–51,3525; nach außen gerundet steht das unten. Die
 * 44 Bewohnerparkgebiete reichen nur 6,7275–6,8742 / 51,1733–51,3027 — wer die
 * Box daraus nähme, wiese eine Meldung aus Garath oder Kalkum als „außerhalb"
 * ab, obwohl dort bewirtschaftet werden kann und nur kein
 * Bewohnerparkgebiet liegt.
 *
 * **Achtung bei Köln.** Kölns vorgeschlagene `reportBounds` enden im Norden
 * bei 51,10, Düsseldorfs beginnen bei 51,11 — 0,01°, also gut einen
 * Kilometer. Die beiden Boxen überschneiden sich damit nicht, und der Test in
 * `city.test.ts` bleibt grün; wer eine der beiden nach außen erweitert, macht
 * `cityAt` zum Zufall.
 *
 * **Und im Norden Essen, seit dem 17. September.** Die Nordkante stand bis
 * dahin bei 51,37 — zwei Kilometer Luft über der Stadtgrenze (51,3525). Essens
 * Stadtgrenze reicht bei Kettwig bis 51,3476 herunter, die beiden Umrisse
 * überlappen sich also um 545 m in der Breite, und zwei achsenparallele Rahmen
 * können nicht beide ganz fassen. Die Kante liegt jetzt bei **51,349**, und das
 * kostet Düsseldorf 390 m Rheinufer und Angerwiesen nördlich von Bockum und
 * Angermund — keine Parkzone, keine Straße mit Automaten. Die Rechnung steht
 * bei `ESSEN`.
 *
 * Der Mittelpunkt ist die Mitte des Rahmens der 44 Gebiete, nicht die
 * Altstadt: Bei Zoom 12 (Frankfurts Wert, rund 0,40° × 0,21°) liegen damit
 * alle 44 im Bild, und ihre Nord-Süd-Ausdehnung von 0,130° passt gerade so
 * hinein. Vom Altstadt-Zentroid (6,7706 / 51,2211) aus fiele der Flughafen im
 * Norden knapp heraus.
 */
export const DUESSELDORF: City = {
  key: 'duesseldorf',
  name: 'Düsseldorf',
  land: 'NW',
  center: [6.8009, 51.238],
  zoom: 12,
  reportBounds: { minLon: 6.66, minLat: 51.11, maxLon: 6.96, maxLat: 51.349 },
  sessionBounds: { minLon: 6.4, minLat: 50.9, maxLon: 7.25, maxLat: 51.6 },
  heatGrid: { id: 'duesseldorf', originLon: 6.66, originLat: 51.11, latitude: 51.24 },
  attribution: {
    // DL-DE/Zero-2.0 verlangt keine Nennung; der Quellenvermerk steht
    // trotzdem — freiwillig ist nicht verboten, und Berlin hält es genauso.
    // Belegt am DCAT-AP.de-Datensatz `aec4ca40-…`: `dct:license` ist
    // `dl-zero-de/2.0` in allen vier Distributionen, `dct:publisher` ist
    // „Landeshauptstadt Düsseldorf – Amt für Verkehrsmanagement".
    source: 'Landeshauptstadt Düsseldorf, Amt für Verkehrsmanagement — opendata.duesseldorf.de',
    datasetUrl: 'https://maps.duesseldorf.de/services/verkehr/wfs',
    licence: 'Datenlizenz Deutschland Zero 2.0',
    licenceUrl: 'https://www.govdata.de/dl-de/zero-2-0',
    attributionRequired: false,
    licenceFamily: 'dl-de-zero',
  },
  // Belegt auf der Seite des Ordnungsamts, wörtlich und mit beiden Nummern.
  // Zuständig ist das Ordnungsamt, nicht das Amt für Verkehrsmanagement; eine
  // städtische Verwahrstelle gibt es nicht, die Fahrzeuge stehen beim
  // beauftragten Abschleppunternehmen.
  towedVehicles: {
    authority: 'Leitstelle des Ordnungsamtes der Landeshauptstadt Düsseldorf',
    url: 'https://www.duesseldorf.de/ordnungsamt/verkehrueb/schlepp',
    phone: '0211 89-94000',
    checkedOn: '2026-09',
    note:
      'Die Stadt rät, zuerst die nächste Polizeidienststelle zu fragen ' +
      '(0211 870-0): Dort ist bekannt, zu welchem Abschleppunternehmen das ' +
      'Fahrzeug gebracht wurde.',
  },
}

/**
 * Karlsruhe — die fünfte Stadt, und die erste unter einer dritten
 * Lizenzfamilie: Creative Commons Namensnennung 4.0 statt Datenlizenz
 * Deutschland.
 *
 * Die Box ist gemessen, nicht geschätzt, und sie stammt **nicht** aus der
 * Parkebene: Die bewirtschafteten Flächen liegen zwischen 8,3421 und 8,4764
 * Länge — wer die Box daraus nähme, wiese eine Meldung aus Neureut oder
 * Grötzingen als „außerhalb" ab, obwohl sie mitten in Karlsruhe liegt. Der
 * Umriss kommt aus den 188 Wahlbezirken des Wahlkreises „Karlsruhe-Stadt"
 * (Transparenzportal, Datensatz `bundestagswahl-2017`, GeoJSON in CRS84): Sie
 * decken das ganze Stadtgebiet ab und messen 8,2774–8,5418 / 48,9405–49,0912.
 * Nach außen gerundet steht das unten; es entspricht der amtlichen Ausdehnung
 * von rund 19 km Ost-West und 16 km Nord-Süd.
 *
 * Der Mittelpunkt ist der Marktplatz mit der Pyramide. Der Zoom ist Frankfurts
 * 12 und nicht Berlins 11,5: 0,28° Länge sind weniger als Frankfurts 0,40°,
 * und die 279 Stellplatzflächen liegen in einem Band von 9,8 × 5,3 km zwischen
 * Mühlburg und Durlach.
 *
 * `holidays` fehlt mit Absicht: Baden-Württemberg kennt anders als Bayern
 * keine gemeindeweise geregelten Feiertage (Begründung in `holidays.ts` beim
 * neuen `BW`-Eintrag).
 */
export const KARLSRUHE: City = {
  key: 'karlsruhe',
  name: 'Karlsruhe',
  land: 'BW',
  center: [8.4037, 49.0094],
  zoom: 12,
  reportBounds: { minLon: 8.27, minLat: 48.93, maxLon: 8.55, maxLat: 49.1 },
  sessionBounds: { minLon: 8.0, minLat: 48.7, maxLon: 8.9, maxLat: 49.35 },
  heatGrid: { id: 'karlsruhe', originLon: 8.27, originLat: 48.93, latitude: 49.01 },
  // Gemessen, nicht gewählt: Bei 20 m Abstand zur Kante hat jeder Automat
  // eine Fläche und die Zahl der Flächen ohne Automaten erreicht ihren Boden
  // (`docs/staedte-karlsruhe.md`, 2.2). Derselbe Radius, mit dem der Datenbau
  // die Automaten zuordnet, gilt für die Ortung.
  zoneSnapMetres: 20,
  attribution: {
    /**
     * Anders als Frankfurt und München nennt der Metadatensatz **keinen**
     * wörtlichen Quellenvermerk. Was er nennt: die herausgebende Stelle
     * (`organization.title` = „Stadt Karlsruhe"), den Urheber
     * (`author` = „Digitale Mobilität") und das Portal. CC BY 4.0 § 3 a) 1) A)
     * verlangt die Nennung des Urhebers „in any reasonable manner"; beides
     * zusammen ist die belegbare Form.
     */
    source: 'Stadt Karlsruhe (Digitale Mobilität), transparenz.karlsruhe.de',
    // Die Adresse, die der Datenbau wirklich abruft — nicht die Portalseite.
    datasetUrl: 'https://mobil.trk.de/geoserver/TBA/ows',
    licence: 'Creative Commons Namensnennung 4.0 International (CC BY 4.0)',
    licenceUrl: 'https://creativecommons.org/licenses/by/4.0/',
    attributionRequired: true,
    licenceFamily: 'cc-by',
  },
  // Bewusst ohne `towedVehicles`: Aus dieser Sitzung liess sich keine
  // Karlsruher Verwahrstelle aus einer amtlichen Seite belegen. Fehlt das
  // Feld, zeigt die Oberfläche den Abschnitt nicht — kein Rückfall auf Berlin.
}

/**
 * Freiburg im Breisgau — die achte Stadt, die zweite in Baden-Württemberg.
 *
 * Die Box ist gemessen, nicht geschätzt, und sie stammt **nicht** aus der
 * Parkebene: Die 37 Gebührenzonen-Flächen liegen zwischen 7,7955 und 7,8954
 * Länge, 47,9724 und 48,0356 Breite — ein Band von 7 × 7 km um die Altstadt.
 * Wer die Box daraus nähme, wiese eine Meldung aus Tiengen, Munzingen oder
 * Kappel als „außerhalb" ab, obwohl sie mitten im Stadtkreis liegt. Der
 * Umriss kommt aus `ms:stadtkreis` des Dienstes `gdm_gemarkung`
 * (`geoportal.freiburg.de`, abgerufen am 16. September 2026, ein Polygon):
 * 7,6619–7,9309 / 47,9036–48,0710. Nach außen gerundet steht das unten.
 *
 * Karlsruhe, die andere BW-Stadt, beginnt bei 8,27 Länge und 48,93 Breite —
 * über 30 km weiter östlich und 90 km nördlich; die Boxen überschneiden sich
 * nicht, und der Test in `city.test.ts` hält das fest.
 *
 * Der Mittelpunkt ist das Münster. Der Zoom ist Frankfurts und Karlsruhes 12:
 * 0,27° Länge sind Karlsruhes 0,28°, und die Flächen liegen dicht um die
 * Altstadt; bei 11,5 wären sie ein Fleck.
 *
 * `holidays` fehlt mit Absicht: Baden-Württemberg kennt keine gemeindeweise
 * geregelten Feiertage (Begründung in `holidays.ts` beim `BW`-Eintrag).
 */
export const FREIBURG: City = {
  key: 'freiburg',
  name: 'Freiburg im Breisgau',
  land: 'BW',
  center: [7.8523, 47.9955],
  zoom: 12,
  reportBounds: { minLon: 7.66, minLat: 47.9, maxLon: 7.94, maxLat: 48.08 },
  sessionBounds: { minLon: 7.4, minLat: 47.7, maxLon: 8.2, maxLat: 48.3 },
  heatGrid: { id: 'freiburg', originLon: 7.66, originLat: 47.9, latitude: 47.99 },
  attribution: {
    // Wörtlich aus `ows:Fees` des WFS `gut_parken` (und zeichengleich in
    // `abi_gliederung`): „Dieser Datensatz/Dienst kann gemäß der
    // 'Datenlizenz Deutschland - Namensnennung - Version 2.0'
    // (https://www.govdata.de/dl-de/by-2-0) genutzt werden.
    // 'Datengrundlage: Stadt Freiburg, www.freiburg.de'". Der Quellenvermerk
    // ist der in den Anführungszeichen; er steht hier so, wie er genannt
    // werden will.
    source: 'Stadt Freiburg, www.freiburg.de',
    // Die Adresse, die der Datenbau wirklich abruft — nicht die Katalogseite.
    datasetUrl: 'https://geoportal.freiburg.de/wfs/gut_parken/gut_parken',
    licence: 'Datenlizenz Deutschland Namensnennung 2.0',
    licenceUrl: 'https://www.govdata.de/dl-de/by-2-0',
    attributionRequired: true,
    licenceFamily: 'dl-de-by',
  },
  // Bewusst ohne `towedVehicles`: Auf freiburg.de fand sich am 16. September
  // keine Seite, die eine Verwahrstelle mit Namen und Nummer nennt — die Seite
  // „Parkverstoß" verweist nur auf Gemeindevollzugsdienst und Polizei. Fehlt
  // das Feld, zeigt die Oberfläche den Abschnitt nicht — kein Rückfall auf
  // Berlin.
}

/**
 * Cottbus/Chóśebuz — die achte Stadt, die erste in Brandenburg und die erste,
 * deren Quelle kein WFS ist, sondern ein ArcGIS FeatureServer.
 *
 * Die Box ist gemessen, nicht geschätzt, und sie stammt **nicht** aus der
 * Parkebene: Die fünf Bewohnerparkzonen liegen zwischen 14,3130 und 14,3404
 * Länge, 51,7429 und 51,7656 Breite — 2 × 2,5 km Innenstadt. Wer die Box
 * daraus nähme, wiese eine Meldung aus Sachsendorf oder vom Bahnhof als
 * „außerhalb" ab, obwohl beides bewirtschaftet wird (die Automaten am
 * Bahnhof liegen außerhalb jeder Bewohnerparkzone). Der Umriss kommt aus
 * `FB33/Stadtgrenze/FeatureServer/1` des Datenportals der Stadt (ein
 * Multipolygon, 2.775 Stützpunkte, `gemeinde_key` 12052000, abgerufen am
 * 16. September 2026): 14,2733–14,5013 / 51,6926–51,8642. Nach außen gerundet
 * steht das unten.
 *
 * Der Mittelpunkt ist der Altmarkt (OSM über Photon, 16. September 2026).
 * Der Zoom ist 13 und damit enger als überall sonst: Die Stadt misst 0,23°
 * Länge gegen Karlsruhes 0,28° bei 12, und die fünf Zonen liegen in einem
 * Band von 1,9 × 2,5 km um den Altmarkt — bei 12 wären sie ein Fleck.
 *
 * **Berlin liegt nahe, aber nicht zu nahe:** Berlins `sessionBounds` reichen
 * bis 52,0 Breite herunter, die Cottbuser enden bei 51,99 — 13 km nördlich
 * der Stadtgrenze. Die Meldeboxen (`reportBounds`) trennen 0,43°.
 *
 * `holidays` fehlt mit Absicht: Brandenburg kennt keine gemeindeweise
 * geregelten Feiertage (Begründung in `holidays.ts` beim `BB`-Eintrag).
 */
export const COTTBUS: City = {
  key: 'cottbus',
  name: 'Cottbus',
  land: 'BB',
  center: [14.3341, 51.7607],
  zoom: 13,
  reportBounds: { minLon: 14.27, minLat: 51.69, maxLon: 14.51, maxLat: 51.87 },
  sessionBounds: { minLon: 14.0, minLat: 51.45, maxLon: 14.8, maxLat: 51.99 },
  heatGrid: { id: 'cottbus', originLon: 14.27, originLat: 51.69, latitude: 51.76 },
  attribution: {
    // Wörtlich aus `licenseInfo` der Hub-Einträge beider Ebenen
    // (ArcGIS-Online-Items `22eacadca78940b4b43d1d4c9ab77863` und
    // `157cb566b0bf429c8eeffa04d564b27f`, abgerufen am 16. September 2026):
    // „Als Rechteinhaber und Bereitsteller ist ‚Stadt Cottbus/Chóśebuz',
    // sowie das Jahr des Datenbezugs in Klammern anzugeben." Das Jahr gehört
    // also zum Vermerk, und es ist das Jahr des Abrufs, nicht das des
    // Datensatzes.
    source: 'Stadt Cottbus/Chóśebuz (2026), Fachbereich Ordnung und Sicherheit — opendataportal.cottbus.de',
    datasetUrl: 'https://datenportal.cottbus.de/server/rest/services/FB32/Bewohnerparkzonen/FeatureServer/7',
    licence: 'Datenlizenz Deutschland Namensnennung 2.0',
    licenceUrl: 'https://www.govdata.de/dl-de/by-2-0',
    attributionRequired: true,
    licenceFamily: 'dl-de-by',
  },
  // Bewusst ohne `towedVehicles`: Auf freiburg.de fand sich am 16. September
  // keine Seite, die eine Verwahrstelle mit Namen und Nummer nennt — die Seite
  // „Parkverstoß" verweist nur auf Gemeindevollzugsdienst und Polizei. Fehlt
  // das Feld, zeigt die Oberfläche den Abschnitt nicht — kein Rückfall auf
  // Berlin.
}

/**
 * Rostock — die achte Stadt, die erste in Mecklenburg-Vorpommern und die
 * erste unter **CC0**: Die Hanse- und Universitätsstadt gibt ihre Geodaten
 * gemeinfrei heraus, Nennung nicht verlangt.
 *
 * Die Box ist gemessen, nicht geschätzt, und sie stammt aus den
 * **Ortsteilen** statt aus der Parkebene: `hro.ortsteile.ortsteile` (31
 * Polygone, abgerufen am 16. September 2026) umschließt
 * 11,9984–12,2954 / 54,0508–54,2445; nach außen gerundet steht das unten. Die
 * zehn Bewohnerparkgebiete reichen nur 12,0662–12,1497 / 54,0742–54,1818 —
 * wer die Box daraus nähme, wiese eine Meldung aus Lütten Klein, Dierkow oder
 * Hohe Düne als „außerhalb" ab, obwohl dort Parkscheinautomaten stehen und
 * nur kein Bewohnerparkgebiet liegt.
 *
 * Der Mittelpunkt ist **nicht** die Altstadt, sondern die Mitte des Rahmens
 * der zehn Gebiete: Sie liegen in zwei Haufen, sieben um die Stadtmitte
 * (54,07–54,09) und drei in Warnemünde (54,17–54,18), elf Kilometer
 * auseinander. Bei Zoom 12 (Frankfurts Wert, rund 0,40° × 0,21°) sind von
 * 54,128 aus beide im Bild; vom Neuen Markt (12,1406 / 54,0887) aus fiele
 * Warnemünde heraus, und dort stehen 27 der 111 Automaten.
 */
export const ROSTOCK: City = {
  key: 'rostock',
  name: 'Rostock',
  land: 'MV',
  center: [12.108, 54.128],
  zoom: 12,
  reportBounds: { minLon: 11.99, minLat: 54.04, maxLon: 12.3, maxLat: 54.25 },
  sessionBounds: { minLon: 11.7, minLat: 53.8, maxLon: 12.6, maxLat: 54.5 },
  heatGrid: { id: 'rostock', originLon: 11.99, originLat: 54.04, latitude: 54.09 },
  attribution: {
    // CC0 verlangt keine Nennung; der Quellenvermerk steht trotzdem, wie bei
    // Berlin und Köln. Wörtlich aus `ows:AccessConstraints` beider Dienste:
    // „Das von der Hanse- und Universitätsstadt Rostock hier angebotene Werk
    // unterliegt der gemeinfreien Lizenz Creative Commons 1.0 Universell
    // Public Domain Dedication (CC0 1.0; …)". Der Katalog `opendata-hro.de`
    // führt beide Datensätze mit `license_id: cc-zero`, Autor „Hanse- und
    // Universitätsstadt Rostock".
    source: 'Hanse- und Universitätsstadt Rostock — geo.sv.rostock.de, OpenData HRO',
    // Die Adresse, die der Datenbau wirklich abruft: der Dienst mit der
    // Sachauskunft. Die Gebiete liegen daneben unter `/bewohnerparkgebiete/wfs`.
    datasetUrl: 'https://geo.sv.rostock.de/geodienste/parkscheinautomaten/wfs',
    licence: 'Creative Commons Zero 1.0 Universell (CC0 1.0)',
    licenceUrl: 'https://creativecommons.org/publicdomain/zero/1.0/deed.de',
    attributionRequired: false,
    licenceFamily: 'cc0',
  },
  // Belegt auf der Seite des Stadtamts („Park- und Halteverbot"), wörtlich:
  // „Auskünfte über abgeschleppte Fahrzeuge erteilt die Einsatzleistelle der
  // Polizei Waldeck unter der Telefonnummer 038208 8880. Dort wird auch
  // mitgeteilt, wo man das Fahrzeug wieder in Empfang nehmen kann." Das
  // Stadtamt schleppt ab, die Polizei weiß, wohin — deshalb steht hier die
  // Stelle, die Auskunft gibt, nicht die, die den Bescheid schreibt.
  towedVehicles: {
    authority: 'Einsatzleitstelle der Polizei Waldeck (Auskunft laut Stadtamt Rostock)',
    url: 'https://rathaus.rostock.de/de/service/aemter/stadtamt/park_und_halteverbot/257403',
    phone: '038208 8880',
    checkedOn: '2026-09',
    note: 'Abgeschleppt wird durch das Stadtamt; wo das Fahrzeug steht, sagt die Polizei-Einsatzleitstelle.',
  },
}


/**
 * Schwerin — die achte Stadt, die erste in Mecklenburg-Vorpommern und die
 * kleinste: 0,10 Mio Einwohner, 15 Bewohnerparkzonen auf 2,5 × 2,4 km.
 *
 * Die Box ist gemessen, nicht geschätzt, und sie stammt aus dem
 * **Gemeindeumriss**: `ms:Stadtgrenzen_Schwerin` aus dem Raumgliederungs-
 * Dienst des Landkreises (2.259 Stützpunkte, in EPSG:4326 abgerufen am
 * 16. September 2026) misst 11,2960–11,5055 / 53,5443–53,6873; nach außen
 * gerundet steht das unten. Die Parkzonen selbst liegen nur zwischen
 * 11,39 und 11,43 Länge — wer die Box daraus nähme, wiese eine Meldung aus
 * Lankow oder Mueß als „außerhalb" ab, obwohl sie mitten in Schwerin liegt.
 *
 * Der Mittelpunkt ist der Marktplatz am Dom. Der Zoom ist **13** und damit
 * enger als überall sonst: 0,22° Länge ist die halbe Frankfurter Breite, und
 * alle 15 Zonen liegen in einem Rechteck von 2,5 km um die Altstadt; bei 12
 * wären sie ein Fleck am Schweriner See.
 *
 * Nachbarn: Hamburg endet bei 10,35° Ost, Schwerin beginnt bei 11,29° — fast
 * ein Grad Abstand, der Test in `city.test.ts` prüft es trotzdem.
 */
export const SCHWERIN: City = {
  key: 'schwerin',
  name: 'Schwerin',
  land: 'MV',
  center: [11.4156, 53.6291],
  zoom: 13,
  reportBounds: { minLon: 11.29, minLat: 53.54, maxLon: 11.51, maxLat: 53.69 },
  sessionBounds: { minLon: 11.0, minLat: 53.35, maxLon: 11.8, maxLat: 53.9 },
  heatGrid: { id: 'schwerin', originLon: 11.29, originLat: 53.54, latitude: 53.63 },
  attribution: {
    // Wörtlich aus `ows:AccessConstraints` beider Dienste (Parken und
    // Raumgliederung): „Datenlizenz Deutschland - Namensnennung - 2.0.
    // Quellenvermerk: Landeshauptstadt Schwerin". Bei DL-DE/Namensnennung
    // ist der Vermerk Lizenzbedingung; er steht deshalb so und nicht als
    // der Landkreis, der die Dienste betreibt (`ows:ProviderName`:
    // „Vermessungs- und Geoinformationsbehoerde des Landkreises
    // Ludwigslust-Parchim und der Landeshauptstadt Schwerin").
    source: 'Landeshauptstadt Schwerin',
    datasetUrl: 'https://geoportal.kreis-lup.de/ows/masterportal/parken-sn',
    licence: 'Datenlizenz Deutschland Namensnennung 2.0',
    licenceUrl: 'https://www.govdata.de/dl-de/by-2-0',
    attributionRequired: true,
    licenceFamily: 'dl-de-by',
  },
  // Belegt auf der Seite des Kommunalen Ordnungsdienstes, wörtlich:
  // „Auskünfte darüber, ob Ihr Fahrzeug vom Kommunalen Ordnungsdienst des
  // Fachdienstes Gewerbe und Ordnungsdienst abgeschleppt wurde und wo es
  // abzuholen ist, erhalten Sie unter der Telefonnummer: +49 385 545-1830".
  // Abgerufen am 16. September 2026.
  towedVehicles: {
    authority: 'Kommunaler Ordnungsdienst der Landeshauptstadt Schwerin',
    url: 'https://www.schwerin.de/mein-schwerin/leben/ordnung-sicherheit-verkehr/ordnung-sicherheit/kommunaler-ordnungsdienst/',
    phone: '0385 545-1830',
    checkedOn: '2026-09',
    note:
      'Nach Abschluss einer Abschleppmaßnahme weiß auch die Leitstelle der ' +
      'Polizei Bescheid (+49 3820 8888 2224, so auf der Seite der Stadt).',
  },
}

/**
 * Graz — die achte Stadt, die erste in Österreich und die erste, deren Quelle
 * **keine Lizenz nennt**.
 *
 * Die Box ist gemessen, nicht geschätzt: Die Ebene „Stadtgrenze" des
 * OGD-Dienstes (`OGD_WFS/FeatureServer/45`, 3.519 Stützpunkte, abgerufen am
 * 16. September 2026) misst 15,3497–15,5342 / 47,0119–47,1345; nach außen
 * gerundet steht das unten. Die Parkzonen reichen nur 15,3909–15,4902 /
 * 47,0296–47,1067 — wer die Box daraus nähme, wiese eine Meldung aus
 * Andritz oder Puntigam als „außerhalb" ab, obwohl sie mitten in Graz liegt.
 *
 * Der Mittelpunkt ist der Hauptplatz. Der Zoom ist Frankfurts und Karlsruhes
 * 12: 0,20° Länge sind weniger als Karlsruhes 0,28°, und die beiden Zonen
 * liegen in einem Band von 7,5 × 8,5 km um die Mitte, das bei 12 ganz im
 * Bild ist.
 *
 * **Die Lizenz ist offen**, und das ist keine Formalie: Der Dienst
 * (`gisportal/sharing/rest/content/items/150ea5bc…`) führt `licenseInfo:
 * null` und als `accessInformation` nur „© Magistrat Graz |
 * Stadtvermessungsamt | Referat für Geoinformation | Kein Rechtsanspruch aus
 * der Karte ableitbar!" — ein Urheberrechtsvermerk, keine Freigabe. Das
 * OGD-Portal der Stadt stellt seine Daten unter CC BY 4.0 („Datenquelle:
 * Stadt Graz – data.graz.gv.at"), listet die Parkzonen aber nicht, und der
 * OGD-Dienst `OGD_WFS` führt sie ebenfalls nicht — nur Behindertenparkplätze,
 * P+R und Parkgaragen. Ob die Freigabe des Portals den GIS-Dienst
 * einschließt, kann nur das Stadtvermessungsamt sagen. Bis dahin: Familie
 * `unklar`, Nennung wie bei der strengsten Lesart, und der Banner über der
 * Karte. Die **Bezirksgrenzen** kommen dagegen aus dem OGD-Dienst und sind
 * damit belegt CC BY 4.0.
 *
 * `zoneSnapMetres` ist gemessen, nicht gewählt: 122 der 165 Flächen sind
 * „straßenzugsweise" — Streifen entlang einzelner Straßen, im Median 6,7 m
 * (blau) bzw. 3,7 m (grün) breit (Fläche und Umfang aus dem Abzug, Rechteck
 * angenommen). Eine Ortung auf 10 bis 20 m trifft so einen Streifen fast
 * nie; Karlsruhes Wert für 4,8 m breite Reihen gilt hier aus demselben Grund.
 * Die flächendeckenden Gebiete treffen strikt, der Rückfall greift nur, wo
 * `zoneAt` nichts findet.
 */
export const GRAZ: City = {
  key: 'graz',
  name: 'Graz',
  land: 'AT-ST',
  center: [15.4386, 47.0707],
  zoom: 12,
  reportBounds: { minLon: 15.34, minLat: 47.0, maxLon: 15.54, maxLat: 47.14 },
  sessionBounds: { minLon: 15.1, minLat: 46.8, maxLon: 15.8, maxLat: 47.35 },
  heatGrid: { id: 'graz', originLon: 15.34, originLat: 47.0, latitude: 47.07 },
  zoneSnapMetres: 20,
  attribution: {
    // Wörtlich aus `accessInformation` des Dienstes, um den Rechtsvorbehalt
    // gekürzt — er steht in `licenceOpen`.
    source: 'Magistrat Graz, Stadtvermessungsamt, Referat für Geoinformation (geodaten.graz.at)',
    datasetUrl:
      'https://geodaten.graz.at/mapping/rest/services/1_3_Verkehrswesen/Grazer_Parkzonen/FeatureServer',
    licence: 'nicht ausgewiesen',
    // Die Seite, auf der die Lizenz stehen müsste: der Eintrag des Dienstes
    // im GIS-Portal der Stadt.
    licenceUrl: 'https://geodaten.graz.at/gisportal/home/item.html?id=150ea5bc2262464abfde7392cd0b3fea',
    attributionRequired: true,
    licenceFamily: 'unklar',
  },
  licenceOpen:
    'Der Parkzonen-Dienst des Stadtvermessungsamts Graz nennt keine Lizenz — ' +
    'nur „© Magistrat Graz, Kein Rechtsanspruch aus der Karte ableitbar". ' +
    'Ob die CC-BY-4.0-Freigabe des OGD-Portals data.graz.gv.at auch für ihn gilt, ' +
    'muss das Stadtvermessungsamt (Europaplatz 20, 8020 Graz, ' +
    'stadtvermessung@stadt.graz.at) bestätigen. Stand 16. September 2026.',
  // Belegt auf der Seite der Stadt „Abschleppung von Kraftfahrzeugen und
  // Fahrrädern": Die Fahrzeuge stehen beim beauftragten Unternehmen, nicht
  // bei einer städtischen Stelle. Die Nummer steht dort als +43 316 721111;
  // hier in der Schreibweise, in der man sie im Inland wählt.
  towedVehicles: {
    authority: 'ATSW 24h Service Franz Wuthe, Triester Straße 25, 8020 Graz',
    url: 'https://www.graz.at/cms/beitrag/10211713/7749726/Abschleppung_von_Kraftfahrzeugen_und_Fahrraedern.html',
    phone: '+43 316 721111',
    checkedOn: '2026-09',
    note: 'Abholung rund um die Uhr; Zulassungsschein und Führerschein mitbringen. Auskunft gibt auch das Straßenamt der Stadt, 0316 872-3602.',
  },
}

/**
 * Salzburg — die achte Stadt, die erste außerhalb Deutschlands, und die erste
 * unter Creative Commons **3.0** statt 4.0.
 *
 * Die Box ist gemessen, nicht geschätzt, und sie stammt **nicht** aus der
 * Parkebene: Die 41 Kurzparkzonen liegen zwischen 13,0062 und 13,0782 Länge —
 * wer die Box daraus nähme, wiese eine Meldung aus Liefering oder Aigen als
 * „außerhalb" ab, obwohl sie mitten in Salzburg liegt. Der Umriss kommt aus
 * den 132 Flächen der Ebene `ogdsbg:stadtteil` mit `GEMEINDE = Salzburg`
 * (abgerufen am 16. September 2026): 12,9856–13,1275 / 47,7512–47,8544. Nach
 * außen gerundet steht das unten. Die Ebene führt daneben 13 Flächen der
 * Nachbargemeinden; die sind nicht mitgemessen.
 *
 * **Freilassing liegt am Rand der Box.** Die Saalach ist die Staatsgrenze,
 * und die bayerische Nachbarstadt beginnt bei 12,98 — der Westrand. Eine Box
 * ist grob, und das ist bei jeder Stadt so (Kölns Box reicht nach Leverkusen
 * hinein); solange keine zweite Stadt daneben liegt, entscheidet sie nur
 * „Salzburg oder nichts", und das ist für Freilassing die richtige Antwort
 * auf beide Fragen: keine Zone, keine Meldung.
 *
 * Der Mittelpunkt ist der Residenzplatz. Der Zoom ist **13**, enger als
 * Karlsruhes 12: Das Stadtgebiet misst 0,14° × 0,10°, die Kurzparkzonen liegen
 * in einem Band von 0,072° × 0,057° um die Altstadt — bei Zoom 13 zeigt ein
 * 400 Pixel breites Telefon rund 0,069° Länge, also fast alle 41 auf einmal.
 * Bei 12 wären sie ein Fleck in der Mitte.
 *
 * `land: 'AT-S'`: Alle österreichischen Feiertage sind Bundesrecht (§ 7 Abs. 2
 * Feiertagsruhegesetz, siehe `holidays.ts`). Der Rupertitag (24. September)
 * ist Landesfeiertag ohne Feiertagsruhe — die Kurzparkzonen gelten; ein Test
 * in `salzburg.test.ts` hält das fest. `holidays` fehlt deshalb mit Absicht.
 */
export const SALZBURG: City = {
  key: 'salzburg',
  name: 'Salzburg',
  land: 'AT-S',
  center: [13.0466, 47.7982],
  zoom: 13,
  reportBounds: { minLon: 12.98, minLat: 47.75, maxLon: 13.13, maxLat: 47.86 },
  sessionBounds: { minLon: 12.7, minLat: 47.55, maxLon: 13.4, maxLat: 48.05 },
  heatGrid: { id: 'salzburg', originLon: 12.98, originLat: 47.75, latitude: 47.8 },
  attribution: {
    /**
     * Wörtlich aus `ows:AccessConstraints` des WFS (abgerufen am
     * 16. September 2026): „Datenquelle: Stadt Salzburg –
     * data.stadt-salzburg.at; Nutzungsbedingungen: CC BY 3.0 AT
     * (https://creativecommons.org/licenses/by/3.0/at/deed.de)". Dasselbe
     * sagt die OGD-Seite der Stadt (<https://www.stadt-salzburg.at/ogd/>):
     * „Die Daten werden unter der CC BY 3.0 AT Lizenz zur Verfügung
     * gestellt." Der Katalogeintrag bei data.gv.at von 2016
     * (`200e7304-f01d-4acd-91ff-1becafe98641`) nennt dagegen CC BY-**SA**
     * 3.0 AT — die Stadt selbst, am Dienst und auf ihrer Seite, sagt heute
     * BY. Abwägung in `docs/staedte-salzburg.md`.
     */
    source: 'Datenquelle: Stadt Salzburg – data.stadt-salzburg.at',
    datasetUrl: 'https://data.stadt-salzburg.at/geodaten/wfs',
    licence: 'Creative Commons Namensnennung 3.0 Österreich (CC BY 3.0 AT)',
    licenceUrl: 'https://creativecommons.org/licenses/by/3.0/at/deed.de',
    attributionRequired: true,
    licenceFamily: 'cc-by',
  },
  // Belegt auf der Seite des Verkehrs- und Straßenrechtsamts, wörtlich:
  // „Wenn Ihr Fahrzeug abgeschleppt wurde, wenden Sie sich bitte an die
  // nächste Polizeiinspektion oder an das Abschleppunternehmen Car &
  // Transport GmbH, Tel. +43 (0)676 44 44 650" — Fahrzeugabholung
  // Mayrwiesstraße 7a, 5300 Hallwang, „NACHTS NUR NACH telefonischem
  // Kontakt". Eine städtische Verwahrstelle gibt es nicht; das Amt selbst ist
  // unter +43 662 8072 3191 erreichbar.
  towedVehicles: {
    authority: 'Verkehrs- und Straßenrechtsamt der Stadt Salzburg',
    url: 'https://www.stadt-salzburg.at/verkehr-und-strassenraum/fahrzeugabschleppung',
    phone: '+43 676 44 44 650',
    checkedOn: '2026-09',
    note:
      'Fahrzeuge mit Kennzeichen stehen beim Abschleppunternehmen Car & Transport GmbH, ' +
      'Mayrwiesstraße 7a, 5300 Hallwang — nachts nur nach telefonischem Kontakt. ' +
      'Die Stadt rät, zuerst die nächste Polizeiinspektion zu fragen.',
  },
}

/**
 * Innsbruck — die achte Stadt und die erste außerhalb Deutschlands.
 *
 * Die Box ist gemessen, nicht geschätzt: Der Umriss der Gemeinde Innsbruck
 * aus dem OGD-Dienst des Landes Tirol (tiris, `Service_Public/ogd_basis`,
 * Ebene 45 „Gemeinden", `GEMOESTAT` 70101, 3.029 Stützpunkte, abgerufen am
 * 16. September 2026) misst 11,3006–11,4580 / 47,2107–47,3606; nach außen
 * gerundet steht das unten. Die 21 Parkzonen reichen nur 11,3220–11,4530 /
 * 47,2463–47,2906 — wer die Box daraus nähme, wiese eine Meldung aus Igls
 * oder von der Hungerburg als „außerhalb" ab, obwohl beide zur Stadt gehören
 * und die Hungerburg ab November 2026 selbst eine Parkstraße wird.
 *
 * Der Mittelpunkt ist das Goldene Dachl. Der Zoom ist Frankfurts und
 * Karlsruhes 12, nicht 13: Die Zonen spannen 0,13° Länge, und das ist bei
 * Zoom 12 genau die Breite eines Handybildschirms — bei 13 fiele die Hälfte
 * heraus, bei 11,5 wären es zwei Drittel Nordkette.
 *
 * `holidays` fehlt mit Absicht: Alle österreichischen Feiertage sind
 * Bundesrecht (§ 7 Abs. 2 Feiertagsruhegesetz, siehe `holidays.ts`), und der
 * Tiroler Landespatron Josef am 19. März ist keiner davon. `towedVehicles`
 * fehlt, weil sich am 16. September auf `innsbruck.gv.at` keine Seite mit
 * Verwahrstelle und Nummer finden ließ.
 */
export const INNSBRUCK: City = {
  key: 'innsbruck',
  name: 'Innsbruck',
  land: 'AT-T',
  center: [11.3934, 47.2685],
  zoom: 12,
  reportBounds: { minLon: 11.3, minLat: 47.21, maxLon: 11.46, maxLat: 47.37 },
  sessionBounds: { minLon: 11.05, minLat: 47.0, maxLon: 11.7, maxLat: 47.55 },
  heatGrid: { id: 'innsbruck', originLon: 11.3, originLat: 47.21, latitude: 47.27 },
  attribution: {
    /**
     * Wörtlich die vorgeschriebene Form aus der Nutzungsbedingung des geoHub
     * Innsbruck: „Die Namensnennung der Stadt Innsbruck als Rechteinhaber
     * hat in folgender Weise zu erfolgen: "Datenquelle: Stadt Innsbruck"".
     * Das ArcGIS-Item selbst hat ein leeres `licenseInfo`; die Bedingungen
     * stehen eine Ebene höher, auf der Seite des Hubs, und gelten laut ihrem
     * ersten Satz für „die Daten der Stadt Innsbruck".
     */
    source: 'Datenquelle: Stadt Innsbruck',
    // Die Adresse, die der Datenbau wirklich abruft — der ArcGIS-Layer, nicht
    // die Hub-Seite daneben.
    datasetUrl:
      'https://services8.arcgis.com/LxSaGwss445axp1E/arcgis/rest/services/Parkzonen_WGS84/FeatureServer/0',
    /**
     * Keine der bekannten Lizenzen wörtlich, sondern eine eigene Bedingung
     * der Stadt: „eine offene Lizenz vergleichbar mit "Creative Commons
     * Namensnennung 4.0" (CC-BY 4.0)". Die Familie ist trotzdem `cc-by`, weil
     * die beiden Auflagen, an denen die Oberfläche hängt, dieselben sind:
     * Nennung in vorgeschriebener Form und der Hinweis, dass die Daten
     * „ohne jegliche Gewähr" kommen. Was CC BY **nicht** kennt und hier
     * dazukommt, steht in `docs/staedte-innsbruck.md`: Wer die Daten in einer
     * öffentlichen Anwendung benutzt, teilt der Stadt unter
     * post.vermessung-gis@innsbruck.gv.at mit, wo und wofür — das ist eine
     * E-Mail des Betreibers, `docs/todo.md` führt sie.
     */
    licence: 'Nutzungsbedingung der Stadt Innsbruck — offene Lizenz, „vergleichbar mit CC BY 4.0"',
    licenceUrl: 'https://geohub-1-magibk.hub.arcgis.com/pages/nutzungsbed',
    attributionRequired: true,
    licenceFamily: 'cc-by',
  },
}

/**
 * Bern — die erste Stadt in der Schweiz und die erste der **Klasse C**: Die
 * Quelle nennt Zonengrenzen, aber weder Zeiten noch Beträge. Jede der 42
 * Parkkartenzonen trägt `scheduleUnknown`, die App sagt „Zeiten unbekannt"
 * und färbt grau, statt „frei" zu behaupten; Blaue Zone und Parkuhr-Tarif
 * stehen als Zitat in `docs/staedte-bern.md`, nicht in den Daten.
 *
 * Der Rahmen kommt aus der **Gemeindegrenze** der amtlichen Vermessung
 * (`Amtliche_Vermessung_Kontur/MapServer/78`, ein Linienzug von 54 km,
 * `Lineattr_beschrieb: Rechtskräftig`, abgerufen am 17. September 2026):
 * 7,2943–7,4956 / 46,9190–46,9902 — nach außen gerundet steht das unten.
 * Die 32 statistischen Bezirke haben auf sechs Stellen denselben Rahmen. Die
 * Parkebene wäre die falsche Quelle: Die Zonen reichen nur von 7,373 bis
 * 7,484, und Bümpliz-Oberbottigen im Westen hat keine einzige. Die Box ist
 * grob — Köniz und Ostermundigen liegen mit darin, wie Leverkusen in Kölns
 * Box; solange keine zweite Stadt daneben liegt, entscheidet sie nur „Bern
 * oder nichts".
 *
 * Der Mittelpunkt ist der Zytglogge. Zoom **12**: Die Zonen liegen in einem
 * Band von 0,11° × 0,05°, und bei Zoom 12 zeigt ein 400 Pixel breites
 * Telefon rund 0,137° Länge — alle 42 auf einmal; bei 13 wären es zwei
 * Drittel.
 *
 * `land: 'CH-BE'`: Art. 2 des Gesetzes über die Ruhe an öffentlichen
 * Feiertagen (FRG, BSG 555.1), siehe `holidays.ts`. Der 1. Mai ist im Kanton
 * Bern **kein** Feiertag, der 2. Januar einer; `laender.test.ts` hält beides
 * fest. `holidays` fehlt mit Absicht — das FRG kennt keine gemeindeweise
 * Regelung mehr, seit Vellerat zum Kanton Jura gehört.
 *
 * Kein `towedVehicles`: Eine amtliche Seite der Stadt oder der Kantonspolizei
 * mit Stelle und Nummer für abgeschleppte Fahrzeuge liess sich am
 * 17. September 2026 nicht belegen; `OHNE_BELEG` in `city.test.ts`.
 */
export const BERN: City = {
  key: 'bern',
  name: 'Bern',
  land: 'CH-BE',
  center: [7.4477, 46.948],
  zoom: 12,
  reportBounds: { minLon: 7.29, minLat: 46.91, maxLon: 7.5, maxLat: 47.0 },
  sessionBounds: { minLon: 7.1, minLat: 46.75, maxLon: 7.7, maxLat: 47.15 },
  heatGrid: { id: 'bern', originLon: 7.29, originLat: 46.91, latitude: 46.95 },
  attribution: {
    /**
     * Wörtlich die vorgeschriebene Form aus Ziffer 5 der Nutzungsbedingungen
     * („Auf sämtlichen Publikationen ist die Quellenangabe "Geodaten Stadt
     * Bern" anzugeben", Art. 22 Abs. 1 Bst. c KGeoIV) — und dasselbe Wort
     * steht als `copyrightText` am Dienst und als `quellenangabe` im
     * Geodatenkatalog.
     */
    source: 'Geodaten Stadt Bern',
    // Die Adresse, die der Datenbau wirklich abruft — die Ebene, nicht der Dienst.
    datasetUrl: 'https://map.bern.ch/arcgis/rest/services/Geoportal/Parkkartenzonen/MapServer/1',
    /**
     * Keine der bekannten Lizenzen, sondern die Nutzungsbedingungen der
     * Stadt (Version 1.0, Januar 2020): „Die Geodaten dürfen grundsätzlich
     * von jedermann kostenlos genutzt werden", öffentlich zugängliche Daten
     * „uneingeschränkt", Reproduktion „mit gut sichtbarem Quellenhinweis
     * beliebig", „keine Gewähr" für Richtigkeit und Aktualität. Der
     * Geodatenkatalog führt die Parkkartenzonen als „A: öffentlich
     * zugänglich" mit „Freie Nutzung. Quellenangabe ist Pflicht." — das ist
     * die Stufe, für die die Bedingungen die Weitergabe erlauben; für Stufe B
     * wäre sie verboten (Ziffer 6). Die Familie ist `cc-by`, weil die zwei
     * Auflagen, an denen die Oberfläche hängt, dieselben sind: Nennung in
     * vorgeschriebener Form und der Hinweis auf die fehlende Gewähr. Was CC
     * BY nicht kennt und hier dazukommt, steht in `docs/staedte-bern.md`:
     * Wer die Daten weitergibt, orientiert die Empfänger über die
     * Bedingungen (Ziffer 6), und der Zeitstand soll genannt werden
     * (Ziffer 10) — `meta.geprueftAm` tut das.
     */
    licence:
      'Nutzungsbedingungen betreffend Geodaten der Stadt Bern, Version 1.0 — „Freie Nutzung. Quellenangabe ist Pflicht."',
    licenceUrl: 'https://map.bern.ch/geoportal/data/Nutzungsbedingungen_Geodaten_Stadt-Bern_1.0.pdf',
    attributionRequired: true,
    licenceFamily: 'cc-by',
  },
}


/**
 * Zürich — die erste Stadt ausserhalb Deutschlands und Österreichs, die erste
 * in Franken, die zweite unter **CC0**.
 *
 * Der Rahmen ist gemessen, nicht geschätzt, und stammt aus den **34
 * Statistischen Quartieren** (`adm_statistische_quartiere_v`, abgerufen am
 * 17. September 2026): Sie umschliessen 8,446892–8,627209 / 47,319034–47,43514
 * — dieselbe Hülle wie die zwölf Stadtkreise —, nach aussen gerundet steht
 * das unten. Die zwei Hochtarifflächen reichen nur 8,518–8,552 / 47,364–47,414;
 * wer den Rahmen daraus nähme, wiese jede Meldung aus Altstetten, Höngg oder
 * Witikon ab, obwohl dort Parkuhren stehen (Niedertarif, Art. 5).
 *
 * Der Mittelpunkt liegt zwischen den beiden Flächen — Innenstadt (Schwerpunkt
 * 8,534 / 47,377) und Zentrum Oerlikon (8,547 / 47,410), vier Kilometer
 * auseinander. Zoom 12 wie in Rostock, aus demselben Grund: Bei 13 wäre vom
 * Hauptbahnhof aus Oerlikon nicht mehr im Bild, und dort stehen 58 der 553
 * Parkuhren in den Flächen.
 */
export const ZUERICH: City = {
  key: 'zuerich',
  name: 'Zürich',
  land: 'CH-ZH',
  center: [8.54, 47.389],
  zoom: 12,
  reportBounds: { minLon: 8.44, minLat: 47.31, maxLon: 8.63, maxLat: 47.44 },
  sessionBounds: { minLon: 8.2, minLat: 47.15, maxLon: 8.9, maxLat: 47.6 },
  heatGrid: { id: 'zuerich', originLon: 8.44, originLat: 47.31, latitude: 47.38 },
  attribution: {
    // CC0 verlangt keine Nennung; der Quellenvermerk steht trotzdem, so wie
    // die Stadt ihn empfiehlt. Wörtlich aus den Nutzungsbestimmungen im
    // geocat.ch-Metadatensatz `809a40eb-32a5-4873-aac9-fa9776c0a687`
    // („öffentlich zugängliche Parkplätze DAV", abgerufen am 17. September
    // 2026): „Diese Geodaten stehen unter der international gültigen
    // Creative-Commons-Zero-Lizenz (CC-0). […] Eine Quellenangabe (CC-BY)
    // wird empfohlen: Sie lautet: „Quelle: Stadt Zürich"." Der Katalog
    // `data.stadt-zuerich.ch` führt alle vier Datensätze mit
    // `license_id: cc-zero`, Autor „Dienstabteilung Verkehr,
    // Sicherheitsdepartement" bzw. „Statistik Stadt Zürich".
    source: 'Quelle: Stadt Zürich — Dienstabteilung Verkehr, Open Data Zürich (data.stadt-zuerich.ch)',
    // Die Adresse, die der Datenbau wirklich abruft: der WFS mit den zwei
    // Tarifflächen. Parkuhren und Parkfelder liegen daneben unter
    // `/wfs/geoportal/oeffentlich_zugaengliche_Parkplaetze_DAV`.
    datasetUrl: 'https://www.ogd.stadt-zuerich.ch/wfs/geoportal/Gebietseinteilung_Parkierungsgebuehren',
    licence: 'Creative Commons Zero 1.0 Universell (CC0 1.0)',
    licenceUrl: 'https://creativecommons.org/publicdomain/zero/1.0/deed.de',
    attributionRequired: false,
    licenceFamily: 'cc0',
  },
  // Bewusst ohne `towedVehicles`: Auf stadt-zuerich.ch fand sich am
  // 17. September keine Seite, die eine Auskunftsstelle für abgeschleppte
  // Fahrzeuge mit Namen und Nummer nennt — die Parkieren-Seiten verlinken
  // nur Bewilligungen, Parkhäuser und Parkplätze. Fehlt das Feld, zeigt die
  // Oberfläche den Abschnitt nicht — kein Rückfall auf Berlin.
}

/**
 * Wien — die erste Stadt außerhalb Deutschlands, unter dem Kalender `AT-W`
 * (alle österreichischen Feiertage sind Bundesrecht, siehe `holidays.ts`).
 *
 * Die Box ist gemessen, nicht geschätzt, und sie stammt aus den
 * **Bezirksgrenzen** (`ogdwien:BEZIRKSGRENZEOGD`, 23 Polygone, abgerufen am
 * 17. September 2026): 16,1818–16,5775 / 48,1179–48,3227, nach außen
 * gerundet steht das unten. Die 81 Kurzparkzonen-Flächen reichen
 * 16,1999–16,5527 / 48,1210–48,3054 — fast dasselbe, weil die Kurzparkzone
 * flächendeckend ist; die Ränder von Liesing und Donaustadt liegen trotzdem
 * außerhalb der Parkebene und innerhalb der Stadt.
 *
 * Der Mittelpunkt ist der Stephansplatz. Zoom 11,5 wie Berlin: Die Stadt
 * misst 0,40° Länge und 0,20° Breite, Berlins Rahmen 0,80° × 0,40° — bei 12
 * fielen Floridsdorf und Liesing aus dem ersten Bild.
 *
 * Keine Überschneidung mit einer anderen Stadt: Die nächste ist München,
 * 3° westlich.
 */
export const WIEN: City = {
  key: 'wien',
  name: 'Wien',
  land: 'AT-W',
  center: [16.3725, 48.2083],
  zoom: 11.5,
  reportBounds: { minLon: 16.18, minLat: 48.11, maxLon: 16.58, maxLat: 48.33 },
  sessionBounds: { minLon: 15.9, minLat: 47.9, maxLon: 16.9, maxLat: 48.55 },
  heatGrid: { id: 'wien', originLon: 16.18, originLat: 48.11, latitude: 48.21 },
  attribution: {
    // Wörtlich aus den Nutzungsbedingungen der Stadt
    // (`digitales.wien.gv.at/ogd-nutzungsbedingungen/`, wohin
    // `data.wien.gv.at/nutzungsbedingungen` aus den `ows:AccessConstraints`
    // des WFS weiterleitet; gelesen am 17. September 2026): „Open Government
    // Data der Stadt Wien stehen unter einer ‚Creative Commons Namensnennung
    // 4.0 Lizenz' (CC BY 4.0). […] Die Namensnennung der Stadt Wien als
    // Rechteinhaberin hat in folgender Weise zu erfolgen: ‚Datenquelle:
    // Stadt Wien – data.wien.gv.at'". Der Katalog data.gv.at führt den
    // Datensatz „Kurzparkzonen Wien" (6858b208-…) mit derselben Lizenz an
    // jeder Verteilung. Nur `ows:Fees` des WFS nennt noch CC BY **3.0 AT**;
    // beide verlangen die Nennung, 4.0 dazu den Hinweis auf den
    // Gewährleistungsausschluss — die App hält sich an die strengere.
    source: 'Datenquelle: Stadt Wien – data.wien.gv.at',
    datasetUrl: 'https://data.wien.gv.at/daten/geo',
    licence: 'Creative Commons Namensnennung 4.0 (CC BY 4.0)',
    licenceUrl: 'https://creativecommons.org/licenses/by/4.0/deed.de',
    attributionRequired: true,
    licenceFamily: 'cc-by',
  },
  // Belegt auf der Seite der Stadt „Fahrzeug abholen" (wien.gv.at, gelesen am
  // 17. September 2026), wörtlich: „Ob Ihr Fahrzeug abgeschleppt wurde,
  // erfahren Sie unter der Telefonnummer +43 1 760 43 oder bei der nächsten
  // Polizei-Dienststelle. Abholung Ort: 11., Jedletzbergerstraße 1
  // (Autobahnknoten Simmeringer Haide)". Zuständig ist die Abschleppgruppe
  // der MA 48 (Abfallwirtschaft, Straßenreinigung und Fuhrpark).
  towedVehicles: {
    authority: 'Abschleppgruppe der MA 48 (Stadt Wien)',
    url: 'https://www.wien.gv.at/verkehr/auto-abgeschleppt',
    phone: '+43 1 760 43',
    checkedOn: '2026-09',
    note: 'Abholung in 11., Jedletzbergerstraße 1 (Autobahnknoten Simmeringer Haide); für Fahrzeuge mit Kennzeichen rund um die Uhr.',
  },
}

/**
 * Die Niederlande — sechs Städte aus **einer** Quelle, dem Nationaal Parkeer
 * Register (NPR) der RDW. Die Stadt ist dort nur ein `areamanagerid`
 * (CBS-Gemeindecode, siehe `NPR_AREA_MANAGERS` in `ingest/sources.ts`), und
 * der Datenbau ist für alle sechs derselbe (`build-data-npr.ts`).
 *
 * Was für alle sechs gilt: Rahmen aus der Gemeindegrenze (PDOK „Bestuurlijke
 * Gebieden", `Gemeentegebied`, `bbox` gemessen am 17. September 2026),
 * Stadtteile aus den CBS-Wijken über PDOK (CC0), Lizenz CC0 laut dem
 * Metadatenfeld `Licentie: Creative Commons 0 (CC0)` jeder der acht
 * Tabellen auf opendata.rdw.nl — das Feld `attribution` ist dort leer, der
 * Quellenvermerk unten ist unsere Formulierung, keine Vorgabe. Die
 * Feiertage liegen in der Quelle (SPECIALE DAG); `holidays` bleibt leer,
 * weil keine der sechs Gemeinden einen festen Tag frei gibt, den der
 * Kalender nicht kennt — Rotterdam führt den 5. Mai, aber als „wie
 * Sonntag", und das ist in den Zentrumszonen ein Zahltag.
 */
const NPR_ATTRIBUTION = (datasetUrl: string): Attribution => ({
  source: 'RDW — Nationaal Parkeer Register (NPR), Open Data Parkeren, opendata.rdw.nl',
  datasetUrl,
  licence: 'Creative Commons Zero 1.0 Universell (CC0 1.0)',
  licenceUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
  attributionRequired: false,
  licenceFamily: 'cc0',
})

const NPR_GEBIED = 'https://opendata.rdw.nl/resource/adw6-9hsg.json'

export const UTRECHT: City = {
  key: 'utrecht',
  name: 'Utrecht',
  land: 'NL-UT',
  center: [5.1214, 52.0907],
  zoom: 12,
  // Gemeentegebied-bbox: 4.9701, 52.0263 – 5.1952, 52.1421
  reportBounds: { minLon: 4.97, minLat: 52.02, maxLon: 5.2, maxLat: 52.15 },
  sessionBounds: { minLon: 4.7, minLat: 51.85, maxLon: 5.45, maxLat: 52.3 },
  heatGrid: { id: 'utrecht', originLon: 4.97, originLat: 52.02, latitude: 52.09 },
  attribution: NPR_ATTRIBUTION(`${NPR_GEBIED}?$where=areamanagerid='344'`),
  // Belegt auf utrecht.nl, „Wegslepen auto" (gelesen am 17. September 2026):
  // „Bergings Combinatie Utrecht (BCU) … Elektronweg 24, 3542 AC UTRECHT …
  // 030 - 241 5060 (keuze 1)". Kein Datum auf der Seite; Preise dort
  // „per 2026".
  towedVehicles: {
    authority: 'Bergings Combinatie Utrecht (BCU), Elektronweg 24',
    url: 'https://www.utrecht.nl/wonen-en-leven/parkeren/parkeren-bezoeker/op-straat-parkeren/wegslepen-auto',
    phone: '+31 30 241 5060',
    checkedOn: '2026-09',
    note: 'Depot der Gemeinde Utrecht; Ausweis und Zulassungsbescheinigung mitbringen.',
  },
}

export const DENHAAG: City = {
  key: 'denhaag',
  name: 'Den Haag',
  land: 'NL-ZH',
  center: [4.3007, 52.0705],
  zoom: 12,
  // Gemeentegebied-bbox: 4.1850, 52.0148 – 4.4225, 52.1350. Die Südkante
  // bleibt bei 52,01, weil Rotterdams Rahmen bei 52,00 endet — die beiden
  // Gemeinden grenzen bei Hoek van Holland fast aneinander.
  reportBounds: { minLon: 4.18, minLat: 52.01, maxLon: 4.43, maxLat: 52.14 },
  sessionBounds: { minLon: 3.9, minLat: 51.9, maxLon: 4.7, maxLat: 52.3 },
  heatGrid: { id: 'denhaag', originLon: 4.18, originLat: 52.01, latitude: 52.07 },
  attribution: NPR_ATTRIBUTION(`${NPR_GEBIED}?$where=areamanagerid='518'`),
  // Bewusst ohne `towedVehicles`: denhaag.nl antwortet aus dieser Umgebung
  // mit 403 (Bot-Schutz), und ohne gelesene Seite steht hier keine Nummer.
}

export const ROTTERDAM: City = {
  key: 'rotterdam',
  name: 'Rotterdam',
  land: 'NL-ZH',
  center: [4.4777, 51.9244],
  zoom: 11.5,
  // Gemeentegebied-bbox: 3.9407, 51.8421 – 4.6018, 52.0045. Die Nordkante
  // ist auf 52,00 geschnitten, damit sie Den Haag nicht berührt; die
  // 500 Meter Dünen nördlich von Hoek van Holland haben keine Parkzone.
  reportBounds: { minLon: 3.94, minLat: 51.84, maxLon: 4.61, maxLat: 52.0 },
  sessionBounds: { minLon: 3.7, minLat: 51.7, maxLon: 4.9, maxLat: 52.1 },
  heatGrid: { id: 'rotterdam', originLon: 3.94, originLat: 51.84, latitude: 51.92 },
  attribution: NPR_ATTRIBUTION(`${NPR_GEBIED}?$where=areamanagerid='599'`),
  // Belegt auf rotterdam.nl, „Uw voertuig is weggesleept" (gelesen am
  // 17. September 2026): „Bel dan met de gemeente Rotterdam via telefoon
  // 14 010" und „Vreugdenhil Berging B.V. Aploniastraat 20, 3084 CC
  // Rotterdam Telefoon: 015 251 13 51". Kein Datum auf der Seite.
  towedVehicles: {
    authority: 'Vreugdenhil Berging B.V., Aploniastraat 20 (Auskunft laut Gemeinde Rotterdam)',
    url: 'https://www.rotterdam.nl/uw-voertuig-is-weggesleept',
    phone: '+31 15 251 13 51',
    checkedOn: '2026-09',
    note: 'Die Gemeinde selbst ist unter 14 010 erreichbar.',
  },
}

export const GRONINGEN: City = {
  key: 'groningen',
  name: 'Groningen',
  land: 'NL-GR',
  center: [6.5665, 53.2194],
  zoom: 12,
  // Gemeentegebied-bbox: 6.4627, 53.1062 – 6.7725, 53.3130
  reportBounds: { minLon: 6.46, minLat: 53.1, maxLon: 6.78, maxLat: 53.32 },
  sessionBounds: { minLon: 6.2, minLat: 52.95, maxLon: 7.05, maxLat: 53.45 },
  heatGrid: { id: 'groningen', originLon: 6.46, originLat: 53.1, latitude: 53.22 },
  attribution: NPR_ATTRIBUTION(`${NPR_GEBIED}?$where=areamanagerid='14'`),
  // Bewusst ohne `towedVehicles`: gemeente.groningen.nl antwortet mit 403.
}

export const NIJMEGEN: City = {
  key: 'nijmegen',
  name: 'Nijmegen',
  land: 'NL-GE',
  center: [5.8622, 51.8426],
  zoom: 12,
  // Gemeentegebied-bbox: 5.7576, 51.7906 – 5.9083, 51.8946
  reportBounds: { minLon: 5.75, minLat: 51.79, maxLon: 5.91, maxLat: 51.9 },
  sessionBounds: { minLon: 5.55, minLat: 51.65, maxLon: 6.1, maxLat: 52.0 },
  heatGrid: { id: 'nijmegen', originLon: 5.75, originLat: 51.79, latitude: 51.84 },
  attribution: NPR_ATTRIBUTION(`${NPR_GEBIED}?$where=areamanagerid='268'`),
  // Bewusst ohne `towedVehicles`: nijmegen.nl antwortet mit 403.
}

export const EINDHOVEN: City = {
  key: 'eindhoven',
  name: 'Eindhoven',
  land: 'NL-NB',
  center: [5.4697, 51.4416],
  zoom: 12,
  // Gemeentegebied-bbox: 5.3567, 51.4000 – 5.5489, 51.4971
  reportBounds: { minLon: 5.35, minLat: 51.39, maxLon: 5.55, maxLat: 51.5 },
  sessionBounds: { minLon: 5.15, minLat: 51.25, maxLon: 5.75, maxLat: 51.65 },
  heatGrid: { id: 'eindhoven', originLon: 5.35, originLat: 51.39, latitude: 51.44 },
  attribution: NPR_ATTRIBUTION(`${NPR_GEBIED}?$where=areamanagerid='772'`),
  // Bewusst ohne `towedVehicles`: Die geratene Adresse auf eindhoven.nl
  // antwortete mit 404, und eine Suche blieb aus — ohne gelesene Seite keine Nummer.
}

/**
 * Genf — die erste Stadt in der Schweiz und die erste der **Klasse C**: Die
 * Quelle nennt Zonengrenzen, aber weder Zeiten noch Beträge. Jede Zone trägt
 * `scheduleUnknown`, die App sagt „Zeiten unbekannt" und färbt grau; der
 * Tarif (Parkuhren der Fondation des Parkings, Blaue Zone mit Parkscheibe)
 * steht in `docs/staedte-genf.md` als das, was fehlt.
 *
 * Die Stadt ist die **Ville de Genève**, nicht der Kanton. Der Datensatz
 * `OTC_MACARON` führt 53 Macaron-Zonen im ganzen Kanton — 17 mit Buchstaben
 * `A`–`Q` in der Ville de Genève, 36 mit Nummern in Carouge, Lancy, Vernier,
 * Meyrin, Versoix und 20 weiteren Gemeinden. Ausgeliefert werden die 17: Der
 * Datenbau nimmt, was in einem der acht Quartiere der Ville liegt, und zählt
 * den Rest im Log. Wer den Kanton will, ändert Rahmen, Bezirke und Filter —
 * `docs/staedte-genf.md`, „Was offen bleibt".
 *
 * Die Box ist gemessen, nicht geschätzt: Die vier Sektionen der Gemeinde
 * Genève aus `CAD_COMMUNE` (`NO_COM_FEDERAL` 6621: Cité, Plainpalais,
 * Eaux-Vives, Petit-Saconnex; 13.522 Stützpunkte, abgerufen am
 * 17. September 2026) messen 6,1102–6,1758 / 46,1778–46,2319, die acht
 * Quartiere aus `VDG_QUARTIER_VILLE` auf vier Stellen dasselbe. Nach außen
 * gerundet steht das unten. Die 17 Zonen reichen nur 6,1102–6,1758 /
 * 46,1840–46,2274 — die Box aus ihnen zu nehmen, wiese die Rue de Lausanne
 * am Seeufer und das Bois de la Bâtie ab. Nach Süden endet die Ville an der
 * Arve gegen Carouge; Carouge selbst liegt bei 46,181° Nord noch in der Box,
 * weil die Box ein Rechteck ist und die Gemeindegrenze keines. Eine Meldung
 * von dort wird angenommen; die Karte zeigt dort nur keine Zone.
 *
 * Der Mittelpunkt ist der Pont du Mont-Blanc; der Zoom ist 13 und damit
 * enger als jede andere Stadt: 0,066° Länge sind ein Drittel von Frankfurts
 * 0,40° bei 12, und bei 13 füllen die acht Quartiere ein Handy-Display.
 */
export const GENF: City = {
  key: 'genf',
  name: 'Genf',
  land: 'CH-GE',
  center: [6.1478, 46.2071],
  zoom: 13,
  reportBounds: { minLon: 6.1, minLat: 46.17, maxLon: 6.18, maxLat: 46.24 },
  sessionBounds: { minLon: 5.95, minLat: 46.05, maxLon: 6.35, maxLat: 46.4 },
  heatGrid: { id: 'genf', originLon: 6.1, originLat: 46.17, latitude: 46.2 },
  attribution: {
    /**
     * Die Nennung in der Form, die die Nutzungsbedingungen des SITG
     * vorschreiben: „Vous devez obligatoirement indiquer la source (ex :
     * « Données SITG », date/fréquence d'extraction)". Das Datum des Abrufs
     * steht in `meta.json` (`geprueftAm`) und in der Quellenzeile der App.
     * Die Behörde dahinter ist der Etat de Genève; das SITG ist der Verbund,
     * der die Daten herausgibt.
     */
    source: 'Données SITG — Système d\'information du territoire à Genève (Etat de Genève)',
    // Die Adresse, die der Datenbau wirklich abruft — die Ebene, nicht das Portal.
    datasetUrl: 'https://vector.sitg.ge.ch/arcgis/rest/services/OTC_MACARON/MapServer/0',
    /**
     * Keine Creative-Commons-Lizenz, sondern die Stufe „A – Accès libre
     * (Open Data)" der Conditions d'utilisation des données du Portail SITG
     * (Version vom 19. Mai 2026, Ziffer 4.1): frei für private und
     * kommerzielle Nutzung, Quellenangabe Pflicht, Daten „en l'état …
     * sans garantie d'aucune sorte" (Ziffer 4.4.1). Jedes der vier
     * ArcGIS-Items zu `OTC_MACARON` trägt `licenseInfo: "Accès libre"`.
     * Die Familie ist `cc-by`, weil die beiden Auflagen, an denen die
     * Oberfläche hängt, dieselben sind wie bei Innsbruck: Nennung in
     * vorgeschriebener Form und der Hinweis auf die fehlende Gewähr.
     */
    licence: 'Conditions d\'utilisation des données du Portail SITG, niveau „A – Accès libre (Open Data)"',
    licenceUrl: 'https://sitg.ge.ch/ressources/conditions-utilisation-donnees',
    attributionRequired: true,
    licenceFamily: 'cc-by',
  },
  // Belegt auf der Seite des Kantons (Démarches → Véhicules → Fourrière des
  // véhicules, Stand 21. März 2025): Die kantonale Fourrière liegt in
  // Satigny, nicht in der Stadt, und die Seite sagt selbst, dass zuerst die
  // Polizei weiß, wohin ein Fahrzeug gebracht wurde.
  towedVehicles: {
    authority: 'Secteur de la fourrière des véhicules (SCEM-DSL-SAMP), République et canton de Genève',
    url: 'https://www.ge.ch/fourriere-vehicules',
    phone: '+41 22 427 90 30',
    checkedOn: '2026-09',
    note:
      'Zuerst die Polizei fragen, wo das Fahrzeug steht. Die Fourrière in ' +
      'Satigny (5A, Rue de la Bergère) ist Mo–Fr 8–12 und 13:30–16 Uhr ' +
      'offen, nur mit Online-Termin.',
  },
}

/**
 * Krakau — die erste Stadt in Polen und die erste der **Klasse C**: Die
 * Quelle nennt Sektorgrenzen und den Buchstaben der Podstrefa, sonst
 * nichts. Zeiten und Tarif stehen in der Uchwała LXXXIX/2177/17 der Rada
 * Miasta Krakowa samt Änderungen und auf den Seiten des Zarząd Dróg Miasta
 * Krakowa (Podstrefa A täglich, B und C Mo–Sa, je 9–22 Uhr; ansteigend
 * 9/10/11 zł je Stunde in A) — nichts davon als Konstante, weil das
 * Modell weder Złoty noch Handelssonntage kennt. Jede Zone trägt
 * `scheduleUnknown`, die App sagt „Zeiten unbekannt".
 *
 * Der Rahmen kommt aus der Stadtgrenze (`Granice_Miasta_Krakowa`, ISDP,
 * 19,7928–20,2179 / 49,9671–50,1255), nicht aus den Sektoren: Nowa Huta im
 * Osten und Swoszowice im Süden haben keine Parkzone und gehören trotzdem
 * dazu. Mit 0,43 × 0,16 Grad ist die Stadt so gross wie Berlin — Zoom 11,5.
 *
 * Feiertage: `PL-MA` — alles Bundesrecht (ustawa z 18 stycznia 1951 r. o
 * dniach wolnych od pracy), keine Woiwodschaftsfeiertage; die Liste der
 * gebührenfreien Tage des ZDMK ist genau diese (samt Wigilia seit 2025).
 */
export const KRAKAU: City = {
  key: 'krakau',
  name: 'Krakau',
  land: 'PL-MA',
  center: [19.9372, 50.0616],
  zoom: 11.5,
  reportBounds: { minLon: 19.79, minLat: 49.96, maxLon: 20.22, maxLat: 50.13 },
  sessionBounds: { minLon: 19.5, minLat: 49.75, maxLon: 20.5, maxLat: 50.35 },
  heatGrid: { id: 'krakau', originLon: 19.79, originLat: 49.96, latitude: 50.06 },
  attribution: {
    // Wörtlich aus `accessInformation` des Items; der Haftungsvorbehalt aus
    // `licenseInfo` steht in `licenceOpen`.
    source: 'Zarząd Transportu Publicznego w Krakowie (Gmina Miejska Kraków), ArcGIS Online der Stadt',
    // Die Ebene, die der Datenbau wirklich als Flächen liest — die der
    // amtlichen ZDMK-Karte.
    datasetUrl:
      'https://services-eu1.arcgis.com/svTzSt3AvH7sK6q9/arcgis/rest/services/Granice_Stref_2026/FeatureServer/1',
    licence: 'nicht ausgewiesen',
    // Die Seite, auf der die Lizenz stehen müsste: der Item-Eintrag des
    // beschriebenen Datensatzes „Strefa Płatnego Parkowania w Krakowie".
    licenceUrl: 'https://www.arcgis.com/home/item.html?id=d9e0ef7c33cd4f4a99c4e7d8024d3956',
    attributionRequired: true,
    licenceFamily: 'unklar',
  },
  licenceOpen:
    'Der Sektoren-Datensatz des Zarząd Transportu Publicznego w Krakowie nennt keine Lizenz — ' +
    'nur den Vorbehalt „Warstwa … ma charakter poglądowy. Informacje na niej zawarte nie mogą być ' +
    'podstawą do jakichkolwiek roszczeń" (die Ebene ist orientierend und kein Anhang der Uchwała). ' +
    'Ob die Stadt eine Nachnutzung freigibt, muss der ZTP (ul. Wielopole 1, 31-072 Kraków, ' +
    'sekretariat@ztp.krakow.pl) bestätigen. Stand 17. September 2026.',
  // Belegt auf der Seite des Zarząd Dróg Miasta Krakowa „Odholowany
  // samochód – co dalej?": Erst die Straż Miejska (986) sagt, ob und warum
  // abgeschleppt wurde; die Fahrzeuge stehen auf dem bewachten Parkplatz
  // ul. Jerzego Turowicza 9, rund um die Uhr, Abholung nur nach Anruf.
  towedVehicles: {
    authority: 'Zarząd Dróg Miasta Krakowa — Parking strzeżony, ul. Jerzego Turowicza 9, Kraków',
    url: 'https://zdmk.krakow.pl/zalatw-sprawe/odholowany-samochod-co-dalej/',
    phone: '+48 12 616 7502',
    checkedOn: '2026-09',
    note: 'Zuerst die Straż Miejska unter 986 fragen, ob das Auto abgeschleppt wurde. Der Parkplatz ist rund um die Uhr besetzt (+48 601 213 722), Abholung nur nach Anruf; Freigabe der anordnenden Stelle mitbringen.',
  },
}


/**
 * Kassel — die zweite Stadt in Hessen und die erste der **Klasse C**: Die
 * Stadt veröffentlicht ihre 29 Bewohnerparkbezirke als Polygone mit genau
 * einem Feld (`Name`) — keine Zeiten, keinen Betrag. Jede Zone trägt deshalb
 * `scheduleUnknown`, und die App sagt „Zeiten unbekannt" statt „frei".
 *
 * Der Rahmen ist gemessen, nicht geschätzt, und stammt aus dem
 * **Gemeindeumriss**: Ebene 8 „Gemeindegrenzen (Landkreis)" des Dienstes
 * `Politik_Verwaltung` führt die Stadt Kassel als MultiPolygon aus zwei
 * Teilen (abgerufen am 17. September 2026), 9,351023–9,570084 /
 * 51,260381–51,369403; die 24 Ortsbezirke haben auf sechs Stellen dieselbe
 * Hülle. Nach außen gerundet steht das unten. Die Bezirke selbst liegen nur
 * zwischen 9,4289 und 9,5184 Länge — wer den Rahmen daraus nähme, wiese eine
 * Meldung aus Harleshausen, Waldau oder Niederzwehren als „außerhalb" ab.
 *
 * Der Mittelpunkt ist die Mitte des Rahmens der 29 Bezirke (9,4289–9,5184 /
 * 51,2974–51,3318), nicht der Königsplatz: Bad Wilhelmshöhe liegt fünf
 * Kilometer westlich der Innenstadt, und bei Zoom 13 (Schwerins Wert, rund
 * 0,22° × 0,08°) sind von hier aus alle 29 im Bild — die Bezirke spannen
 * 0,09° × 0,03°; bei 12 wären sie ein Fleck.
 *
 * **Die Lizenz ist offen**, und zwar nur für die Bezirke: Der Kartendienst
 * `Verkehr_Mobilitaet` trägt im ArcGIS-Online-Eintrag der Stadt
 * (`244e07e4069d43b0b59251c1746ddb06`) und im geoHub-Eintrag der Website
 * `licenseInfo: null`, an beiden Stellen nur `accessInformation: "Stadt
 * Kassel, Vermessung und Geoinformation"` — ein Quellenvermerk, keine
 * Freigabe. Die Ebene hat keinen eigenen Katalogeintrag, und der geoHub der
 * Stadt hat seine Feeds abgeschaltet. Anders die **Ortsbezirke**: Ihr Eintrag
 * (`b9456e1211c64c0eb5b6a85252d52a07`) nennt wörtlich „Open Data Datenlizenz
 * Deutschland Namensnennung 2.0 "Stadt Kassel, Vermessung und
 * Geoinformation, 2025"" — dieselbe Lizenz, die die Stadt für ein Dutzend
 * anderer Ebenen ausweist. Ob sie auch für die Bewohnerparkbezirke gilt,
 * kann nur das Amt sagen. Bis dahin: Familie `unklar`, Nennung wie bei der
 * strengsten Lesart, und der Banner über der Karte.
 */
export const KASSEL: City = {
  key: 'kassel',
  name: 'Kassel',
  land: 'HE',
  center: [9.474, 51.315],
  zoom: 13,
  reportBounds: { minLon: 9.35, minLat: 51.26, maxLon: 9.58, maxLat: 51.37 },
  sessionBounds: { minLon: 9.1, minLat: 51.05, maxLon: 9.85, maxLat: 51.6 },
  heatGrid: { id: 'kassel', originLon: 9.35, originLat: 51.26, latitude: 51.31 },
  attribution: {
    // Wörtlich `accessInformation` des Dienstes und `copyrightText` des
    // Kartendienstes; die Ortsbezirke nennen dieselbe Stelle mit Jahr.
    source: 'Stadt Kassel, Vermessung und Geoinformation (geoportal.kassel.de)',
    // Die Ebene, die der Datenbau wirklich liest — über `identify`, weil
    // `query` bei dieser Ebene keine Geometrie herausgibt.
    datasetUrl:
      'https://geoportal.kassel.de/arcgis/rest/services/Service_Daten/Verkehr_Mobilitaet/MapServer/27',
    licence: 'nicht ausgewiesen',
    // Die Seite, auf der die Lizenz stehen müsste: der Eintrag des
    // Kartendienstes im ArcGIS Online der Stadt.
    licenceUrl: 'https://kassel-geoportal.maps.arcgis.com/home/item.html?id=244e07e4069d43b0b59251c1746ddb06',
    attributionRequired: true,
    licenceFamily: 'unklar',
  },
  licenceOpen:
    'Der Kartendienst „Verkehr & Mobilität" des Geoportals Kassel nennt für die ' +
    'Bewohnerparkbezirke keine Lizenz — nur „Stadt Kassel, Vermessung und Geoinformation". ' +
    'Ob die Datenlizenz Deutschland Namensnennung 2.0, unter der die Stadt ihre Ortsbezirke ' +
    'und ein Dutzend weitere Ebenen ausweist, auch für sie gilt, muss das Amt für Vermessung ' +
    'und Geoinformation (Obere Königsstraße 8, 34117 Kassel, vermgeo@kassel.de) bestätigen. ' +
    'Stand 17. September 2026.',
  // Bewusst ohne `towedVehicles`: Auf kassel.de fand sich am 17. September
  // keine Seite, die eine Auskunftsstelle für abgeschleppte Fahrzeuge mit
  // Namen und Nummer nennt — die Suche nach „abgeschleppt" und „Abschleppen"
  // liefert keinen Treffer, die Parkzonen-Seite nennt nur die Leitstelle des
  // Ordnungsamts für Automatendefekte. Fehlt das Feld, zeigt die Oberfläche
  // den Abschnitt nicht — kein Rückfall auf Berlin.
}

/**
 * Essen — die erste Stadt der **Klasse C**: Die Quelle veröffentlicht neun
 * Bewohnerparkbereiche als Flächen und sonst nichts — keine Zeiten, keinen
 * Tarif, keine Höchstparkdauer. Jede Zone trägt deshalb `scheduleUnknown`,
 * und die App sagt „Zeiten unbekannt" statt „frei".
 *
 * Der Rahmen ist gemessen, nicht geschätzt, und stammt aus der
 * **Stadtgrenze** (`Stadtgrenze_WGS84.geojson`, 6.552 Stützpunkte, abgerufen
 * am 17. September 2026): 6,8944–7,1376 / 51,3476–51,5342. Die neun Flächen
 * liegen nur zwischen 6,997 und 7,025 Länge um die Innenstadt — wer den Rahmen
 * daraus nähme, wiese jede Meldung aus Steele, Borbeck oder Werden ab.
 *
 * **Die Südkante ist die eine Stelle, an der der Rahmen enger ist als die
 * Stadt, und der Grund ist Düsseldorf.** Düsseldorfs Stadtgrenze reicht bei
 * Wittlaer bis 51,3525 Nord, Essens bei Kettwig vor der Brücke bis 51,3476
 * Süd — die beiden Umrisse überlappen sich in der Breite um 545 m, obwohl die
 * Stellen 15 km auseinanderliegen (Wittlaer bei 6,75 Ost, Kettwig bei 6,96).
 * Zwei achsenparallele Rahmen können das nicht beide vollständig fassen, und
 * `cityAt` verlangt, dass sie sich nicht schneiden. Die Trennlinie liegt bei
 * **51,349/51,351**: Düsseldorf verliert 390 m Rheinufer und Angerwiesen
 * nördlich von Bockum und Angermund, Essen 380 m Ruhrhang südlich von Kettwig
 * vor der Brücke (Ortsmitte laut Photon 51,3601) — in beiden Streifen liegt
 * keine Parkzone. Drei Nachkommastellen, weil zwei nicht reichen: 51,35 auf
 * beiden Seiten wäre ein gemeinsamer Punkt, und den verbietet der Test; und
 * der Test „knapp innerhalb / knapp außerhalb" verlangt mehr als 0,001° Luft
 * zwischen zwei Rahmen, sonst liegt der Prüfpunkt 110 m über Düsseldorfs
 * Nordostecke schon in Essen.
 *
 * Der Mittelpunkt ist die Mitte des Rahmens der neun Flächen (Innenstadt,
 * südlich des Hauptbahnhofs). Zoom **13** wie in Schwerin: Die neun Flächen
 * liegen in einem Rechteck von 2 × 3 km; bei 12 wären sie ein Fleck.
 */
export const ESSEN: City = {
  key: 'essen',
  name: 'Essen',
  land: 'NW',
  center: [7.011, 51.4504],
  zoom: 13,
  reportBounds: { minLon: 6.89, minLat: 51.351, maxLon: 7.14, maxLat: 51.54 },
  sessionBounds: { minLon: 6.6, minLat: 51.15, maxLon: 7.45, maxLat: 51.75 },
  heatGrid: { id: 'essen', originLon: 6.89, originLat: 51.351, latitude: 51.45 },
  attribution: {
    // Wörtlich aus der Beschreibung des Datensatzes im DKAN-Katalog
    // („Quelle: FB 66 - Amt für Straßen und Verkehr / FB 62 - Amt für
    // Geoinformation, Vermessung und Kataster"), abgerufen am 17. September
    // 2026. Bei DL-DE/Namensnennung ist der Vermerk Lizenzbedingung.
    source:
      'Stadt Essen — FB 66 Amt für Straßen und Verkehr / FB 62 Amt für Geoinformation, ' +
      'Vermessung und Kataster, opendata.essen.de',
    // Die Datei, die der Datenbau wirklich abruft — nicht die Portalseite
    // (`https://opendata.essen.de/dataset/bewohnerparkbereiche-essen`).
    datasetUrl: 'https://opendata.essen.de/sites/default/files/Bewohnerparkbereiche.geojson',
    licence: 'Datenlizenz Deutschland Namensnennung 2.0',
    licenceUrl: 'https://www.govdata.de/dl-de/by-2-0',
    attributionRequired: true,
    licenceFamily: 'dl-de-by',
  },
  // Bewusst ohne `towedVehicles`: Auf essen.de fand sich am 17. September
  // unter „Verkehrsüberwachung" keine Seite, die eine Auskunftsstelle für
  // abgeschleppte Fahrzeuge mit Namen und Nummer nennt — nur die Leitstelle
  // für defekte Parkscheinautomaten. Fehlt das Feld, zeigt die Oberfläche
  // den Abschnitt nicht; kein Rückfall auf Berlin.
}

/**
 * Gera — die erste Stadt in Thüringen, Klasse C: zehn Bewohnerparkzonen
 * (Buchstaben A bis L, eine geteilte Fläche C/G) als Flächen aus dem
 * GeoServer-WFS des Geoportals der Stadt, ohne Zeiten und Betrag. Dazu
 * 138 Straßenlinien in derselben Ebene, 27 Ortsteile und 12
 * Behindertenparkplätze.
 *
 * Die Box ist gemessen, nicht geschätzt, und sie stammt **nicht** aus der
 * Parkebene, sondern aus der Ebene `gera:geom_stadtgrenze_und_flaeche`
 * (zwei Polygone: die Stadt mit 15.219,79 ha und eine 2 ha große Exklave bei
 * 12,155/50,868): 11,9981–12,1695 / 50,7985–50,9766, nach außen auf zwei
 * Stellen gerundet. Die 27 Ortsteile füllen exakt denselben Rahmen. Die zehn
 * Zonenflächen liegen alle in einem Rechteck von 1,7 × 1,8 km um die
 * Innenstadt (12,0732–12,0969 / 50,8692–50,8855); der Mittelpunkt ist dessen
 * Mitte, und Zoom **13** wie in Kassel und Essen: Bei 12 wären die Zonen ein
 * Fleck. Nachbarn mit eigener Konstante gibt es hier keine — Leipzig, Jena
 * und Zwickau sind nicht angeschlossen —, die Überschneidungsprüfung in
 * `city.test.ts` läuft trotzdem über jedes Paar.
 *
 * Kein `zoneSnapMetres`: Anders als Karlsruhes Stellplatzreihen sind die
 * Flächen ganze Quartiere (0,9 bis 41,7 ha), eine Ortung trifft sie.
 */
export const GERA: City = {
  key: 'gera',
  name: 'Gera',
  land: 'TH',
  center: [12.085, 50.8774],
  zoom: 13,
  reportBounds: { minLon: 11.99, minLat: 50.79, maxLon: 12.17, maxLat: 50.98 },
  sessionBounds: { minLon: 11.7, minLat: 50.55, maxLon: 12.45, maxLat: 51.2 },
  heatGrid: { id: 'gera', originLon: 11.99, originLat: 50.79, latitude: 50.88 },
  attribution: {
    // `ows:ProviderName` des Dienstes, wörtlich; die Karte des Portals
    // schreibt „Daten: © Stadt Gera".
    source: 'Stadtverwaltung Gera, Zentrales GIS (geoportal.gera.de)',
    // Der Dienst, den der Datenbau wirklich liest — GetCapabilities, weil dort
    // die Lizenz stünde: `Fees: NONE`, `AccessConstraints: NONE`, kein Katalogeintrag.
    datasetUrl: 'https://geoportal.gera.de/geoserver/gera/wfs?service=WFS&request=GetCapabilities',
    licence: 'nicht ausgewiesen',
    licenceUrl: 'https://geoportal.gera.de/geoserver/gera/wfs?service=WFS&request=GetCapabilities',
    attributionRequired: true,
    licenceFamily: 'unklar',
  },
  licenceOpen:
    'Der WFS des Geoportals Gera nennt für die Anwohnerparkzonen keine Lizenz — nur ' +
    '„Fees: NONE" und „AccessConstraints: NONE", das Open-Data-Portal der Stadt ' +
    '(opendata.gera.de) ist leer, und das Impressum von gera.de behält sich alle Rechte vor. ' +
    'Ob und unter welcher Lizenz die Daten weitergegeben werden dürfen, muss das Zentrale ' +
    'GIS der Stadtverwaltung Gera (Kontakt laut GetCapabilities des Dienstes, ' +
    'Telefon 0365 838-1224) bestätigen. Stand 17. September 2026.',
  // Bewusst ohne `towedVehicles`: Am 17. September fand sich auf gera.de weder
  // auf der Seite des Vollzugsdienstes noch beim Straßenverkehr eine
  // Auskunftsstelle für abgeschleppte Fahrzeuge mit Namen und Nummer. Fehlt
  // das Feld, zeigt die Oberfläche den Abschnitt nicht; kein Rückfall auf Berlin.
}

export const CITIES: readonly City[] = [
  BERLIN,
  HAMBURG,
  FRANKFURT,
  MUENCHEN,
  KOELN,
  DUESSELDORF,
  KARLSRUHE,
  FREIBURG,
  COTTBUS,
  ROSTOCK,
  SCHWERIN,
  GRAZ,
  SALZBURG,
  INNSBRUCK,
  BERN,
  ZUERICH,
  WIEN,
  UTRECHT,
  DENHAAG,
  ROTTERDAM,
  GRONINGEN,
  NIJMEGEN,
  EINDHOVEN,
  GENF,
  KRAKAU,
  KASSEL,
  ESSEN,
  GERA,
]

/**
 * Eine Stadt zu ihrem Schlüssel.
 *
 * Wirft bei einem unbekannten Schlüssel, statt auf Berlin zurückzufallen. Ein
 * stiller Rückfall wäre die schlechteste Antwort: Eine falsch konfigurierte
 * Hamburg-Instanz würde dann Hamburger Meldungen verwerfen und niemandem
 * sagen, warum.
 */
export function cityByKey(key: string): City {
  const city = CITIES.find((candidate) => candidate.key === key)
  if (city === undefined) {
    throw new Error(`Unbekannte Stadt "${key}" — bekannt sind: ${CITIES.map((c) => c.key).join(', ')}`)
  }
  return city
}

/** Ob eine Position als Meldung dieser Stadt durchgeht. */
export function withinCity(city: City, lon: number, lat: number): boolean {
  return (
    Number.isFinite(lon) &&
    Number.isFinite(lat) &&
    lon >= city.reportBounds.minLon &&
    lon <= city.reportBounds.maxLon &&
    lat >= city.reportBounds.minLat &&
    lat <= city.reportBounds.maxLat
  )
}

/** Ob eine Position als gespeicherter Parkplatz dieser Stadt durchgeht. */
export function withinCitySession(city: City, lon: number, lat: number): boolean {
  return (
    Number.isFinite(lon) &&
    Number.isFinite(lat) &&
    lon >= city.sessionBounds.minLon &&
    lon <= city.sessionBounds.maxLon &&
    lat >= city.sessionBounds.minLat &&
    lat <= city.sessionBounds.maxLat
  )
}

/**
 * Die Stadt zu einer Position — oder keine.
 *
 * Der Gegenpol zu `cityByKey`: Dort kommt die Stadt aus der Konfiguration,
 * hier aus dem Punkt selbst. Der Worker braucht genau das, seit die App zwei
 * Städte kennt. Vorher war er auf **eine** Stadt konfiguriert (`Env.CITY`,
 * ohne Wert Berlin), und eine Hamburger Meldung bekam
 * `422 position outside Berlin` — in der App sah das aus, als sei das Melden
 * kaputt, und im Log stand nichts, was nach einem Fehler aussah.
 *
 * Kein Rückfall auf Berlin: Liegt der Punkt in keiner Stadt, kommt `undefined`
 * zurück, und der Aufrufer weist die Meldung ab. Ein Rückfall würde eine
 * Münchner Meldung als Berliner Zeile in die Datenbank schreiben — falsch,
 * und nirgends sichtbar.
 *
 * Die erste passende Stadt gewinnt. Das ist nur eindeutig, solange sich die
 * Boxen nicht überlappen; ein Test in `city.test.ts` hält das fest, statt es
 * zu hoffen.
 *
 * `cities` ist ein Parameter, damit eine Instanz die Auswahl einschränken kann
 * — und damit der Test einen Punkt gegen genau eine Stadt halten kann.
 */
export function cityAt(lon: number, lat: number, cities: readonly City[] = CITIES): City | undefined {
  return cities.find((city) => withinCity(city, lon, lat))
}

/**
 * Die Stadt, zu der ein Wechsel vorzuschlagen ist — oder keine.
 *
 * Der Vorschlag nach FreiFahrens Vorbild („Switch to {city}? Your location
 * looks like you are in {city}."). Er entsteht ausschließlich aus einer
 * Position, die die App ohnehin schon hat: `cityAt` beantwortet die Frage,
 * diese Funktion entscheidet, ob sie jemanden interessiert.
 *
 * Vier Fälle enden in `null`, und jeder aus einem eigenen Grund:
 *
 * - **Kein Treffer.** Wer in Kiel steht, bekommt keinen Vorschlag, sondern die
 *   bestehende Antwort „außerhalb der Parkraumbewirtschaftung". Eine der vier
 *   Städte anzubieten, weil sie die nächste ist, wäre geraten.
 * - **Die Stadt, die schon läuft.** Der Normalfall; ein Hinweis darauf wäre
 *   reine Störung.
 * - **Schon abgelehnt.** `dismissed` trägt die Schlüssel, zu denen jemand
 *   „hier bleiben" gesagt hat. Ohne dieses Gedächtnis fragte die App bei jedem
 *   Standortabruf erneut.
 * - **Nicht auslieferbar.** Über `cities` schränkt der Aufrufer auf das ein,
 *   wozu diese Auslieferung überhaupt umschalten kann — im Artifact sind das
 *   nur die eingebetteten Städte. Ein Vorschlag, dessen Annahme in
 *   „Diese Fassung enthält muenchen nicht" endet, wäre schlimmer als keiner.
 *
 * Verglichen wird über den **Schlüssel**, nicht über die Objektidentität:
 * `cities` ist ein Parameter, und eine eingeschränkte Liste kann Kopien
 * enthalten. Ein Identitätsvergleich schlüge dort fehl und schlüge die
 * laufende Stadt sich selbst vor.
 */
export function suggestCity(
  current: City,
  lon: number,
  lat: number,
  dismissed: readonly string[] = [],
  cities: readonly City[] = CITIES,
): City | null {
  const found = cityAt(lon, lat, cities)
  if (found === undefined) return null
  if (found.key === current.key) return null
  if (dismissed.includes(found.key)) return null
  return found
}
