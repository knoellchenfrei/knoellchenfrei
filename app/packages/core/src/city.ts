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
 *   Zone macht daraus eine Konfiguration.
 * - **Der Tarif.** Der steht je Zone im Feed, nicht je Stadt. Eine Stadt hat
 *   keinen Preis, ihre Zonen haben einen.
 *
 * Der Feiertagskalender steht in `holidays.ts` und hängt am Bundesland, nicht
 * an der Stadt: Zwei Städte in Nordrhein-Westfalen teilen ihn sich. Die eine
 * Ausnahme trägt `holidays` unten — Bayern kennt Feiertage, die *gemeindeweise*
 * gelten, und die passen in keine Ländertabelle.
 */

import type { BoundingBox, Position } from './geo.js'
import type { Land } from './holidays.js'

export interface Attribution {
  /** Wer die Daten herausgibt, wörtlich so, wie er genannt werden will. */
  source: string
  licence: string
  licenceUrl: string
  /**
   * Ob die Lizenz die Nennung verlangt.
   *
   * Der Unterschied ist keine Formalie: Berlin gibt unter Datenlizenz
   * Deutschland **Zero** 2.0 heraus — Nennung freiwillig. Hamburg nutzt
   * Datenlizenz Deutschland **Namensnennung** 2.0; dort ist die Quellenangabe
   * Lizenzbedingung, und eine Oberfläche, die sie weglässt, verletzt sie.
   */
  attributionRequired: boolean
}

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
  attribution: {
    source: 'Geodateninfrastruktur Berlin (gdi.berlin.de)',
    licence: 'Datenlizenz Deutschland Zero 2.0',
    licenceUrl: 'https://www.govdata.de/dl-de/zero-2-0',
    attributionRequired: false,
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
  attribution: {
    source: 'Freie und Hansestadt Hamburg, Landesbetrieb Geoinformation und Vermessung',
    licence: 'Datenlizenz Deutschland Namensnennung 2.0',
    licenceUrl: 'https://www.govdata.de/dl-de/by-2-0',
    attributionRequired: true,
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
  attribution: {
    // Wörtlich der Quellenvermerk aus dem ISO-Metadatensatz des Dienstes.
    // Bei DL-DE/Namensnennung ist er Lizenzbedingung, nicht Höflichkeit —
    // wer ihn umformuliert, erfüllt sie nicht mehr sicher.
    source: 'Stadt Frankfurt am Main, www.frankfurt.de',
    licence: 'Datenlizenz Deutschland Namensnennung 2.0',
    licenceUrl: 'https://www.govdata.de/dl-de/by-2-0',
    attributionRequired: true,
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
  attribution: {
    // Wörtlich der Quellenvermerk aus dem ISO-Metadatensatz beider
    // Parkebenen (`.../records/752539b9-…` und `.../records/1cb25196-…`,
    // abgerufen am 7. September 2026). Bei DL-DE/Namensnennung ist er
    // Lizenzbedingung; der Metadatensatz der Stadtbezirke nennt daneben den
    // GeodatenService, das steht in `docs/staedte.md`.
    source: 'Datenquelle: dl-de/by-2-0: Landeshauptstadt München – opendata.muenchen.de',
    licence: 'Datenlizenz Deutschland Namensnennung 2.0',
    licenceUrl: 'https://www.govdata.de/dl-de/by-2-0',
    attributionRequired: true,
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
}

export const CITIES: readonly City[] = [BERLIN, HAMBURG, FRANKFURT, MUENCHEN]

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
