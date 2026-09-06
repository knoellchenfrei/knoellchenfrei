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
 * an der Stadt: Zwei Städte in Nordrhein-Westfalen teilen ihn sich.
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

export const CITIES: readonly City[] = [BERLIN, HAMBURG]

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
