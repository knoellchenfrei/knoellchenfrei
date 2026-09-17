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
  reportBounds: { minLon: 6.66, minLat: 51.11, maxLon: 6.96, maxLat: 51.37 },
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

export const CITIES: readonly City[] = [
  BERLIN,
  HAMBURG,
  FRANKFURT,
  MUENCHEN,
  KOELN,
  DUESSELDORF,
  KARLSRUHE,
  FREIBURG,
  ROSTOCK,
  COTTBUS,
  ZUERICH,
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
