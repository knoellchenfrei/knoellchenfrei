import type { ZoneProperties } from './types.js'

/**
 * Wie eine Fläche heißt, wenn die Quelle ihr keinen Namen gegeben hat.
 *
 * Hamburg liefert für **44 seiner 145 Flächen** den Zonenschlüssel `-`. Bis
 * zum 8. September stand daraufhin an neun Stellen der Oberfläche wörtlich
 * „Zone -": im Panel, in der Ansage für Screenreader, in der Suche, im
 * Meldedialog und im Satz „Parkplatz gemerkt in Zone -". Das liest sich wie
 * ein Anzeigefehler und ist eine Tatsache der Quelle — nur eine, die man
 * aussprechen muss, statt sie durchzureichen.
 *
 * Zwei Formen, weil die Oberfläche zwei braucht: eine als Überschrift
 * („Parkzone 12") und eine im Dativ für den einen Satz, der sie mit „in"
 * nennt. Beide an einer Stelle, damit die zehnte Verwendung nicht wieder
 * `Zone ${zone}` schreibt.
 *
 * Was hier **nicht** passiert: den Schlüssel ersetzen. `properties.zone`
 * bleibt `-`, weil er die Kennung der Quelle ist und in Meldungen,
 * Parksitzungen und der Nutzungsstatistik steht. Ein Ersatzschlüssel gehört in
 * den Datenbau und ändert Gezähltes — das steht in `docs/todo.md`.
 */

/** Ohne Nummer vergibt Hamburgs Quelle diesen Platzhalter. */
const OHNE_NUMMER = '-'

export function hatNummer(properties: Pick<ZoneProperties, 'zone'>): boolean {
  return properties.zone.trim() !== '' && properties.zone.trim() !== OHNE_NUMMER
}

/**
 * Für den einen Satz, der die Fläche im Dativ nennt: „Parkplatz gemerkt **in**
 * Zone 12" beziehungsweise „… in einer Fläche ohne Nummer".
 *
 * Der Fall heisst im Namen mit, weil er sonst beim nächsten Aufrufer verloren
 * geht: Der erste Anlauf gab „eine Fläche ohne Nummer" zurück, und der Satz
 * lautete damit „gemerkt in eine Fläche ohne Nummer". Aufgefallen ist es im
 * eigenen Test, in dem der falsche Satz als Erwartung stand.
 */
export function zoneImDativ(properties: Pick<ZoneProperties, 'zone'>): string {
  return hatNummer(properties) ? `Zone ${properties.zone}` : 'einer Fläche ohne Nummer'
}

/**
 * Kurzform, wie sie in Listen und Knöpfen steht: „Zone 12" oder „Fläche ohne
 * Nummer".
 *
 * Sie gibt es, weil die erste Fassung überall `zoneTitel` einsetzte und damit
 * an vier Stellen aus „Zone 12" ein „Parkzone 12" machte — eine
 * Wortänderung, um die niemand gebeten hatte. Der Fehler, um den es ging, war
 * ausschliesslich der Platzhalter `-`; alles andere sollte gleich bleiben.
 */
export function zoneKurz(properties: Pick<ZoneProperties, 'zone'>): string {
  return hatNummer(properties) ? `Zone ${properties.zone}` : 'Fläche ohne Nummer'
}

/** Als Überschrift: „Parkzone 12" oder „Bewirtschaftete Fläche". */
export function zoneTitel(properties: Pick<ZoneProperties, 'zone'>): string {
  return hatNummer(properties) ? `Parkzone ${properties.zone}` : 'Bewirtschaftete Fläche'
}
