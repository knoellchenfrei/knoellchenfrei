/**
 * Der Wiener Feed-Dialekt.
 *
 * Was `hamburg.ts` für Hamburg tut, tut diese Datei für Wien — und wieder
 * getrennt, nach derselben Regel: ein Feed, ein Parser. Wien schreibt die
 * Zeit als `Mo.-Fr. (werkt.) v. 9-22 Uhr` und in den Geschäftsstraßen als
 * `Mo.-Fr. (w.) v. 8-18h, Sa. (w.) v. 8-12h`, die Höchstparkdauer als
 * `2 h` oder `1,5 h`, und einen Betrag schreibt der Feed **gar nicht**.
 *
 * Datensätze, abgerufen am 17. September 2026 vom GeoServer-WFS der Stadt
 * Wien (`data.wien.gv.at/daten/geo`, WFS 2.0.0, Arbeitsbereich `ogdwien`):
 * `KURZPARKZONEOGD` („Kurzparkzone (Fläche)", 81 Flächen — die
 * flächendeckenden Kurzparkzonen je Bezirk), `KURZPARKSTREIFENOGD`
 * („Kurzparkzone (Linie)", 796 Linien — die Geschäftsstraßen mit eigener
 * Regelung) und `BEZIRKSGRENZEOGD` (23 Bezirke). Fixtures:
 * `test/fixtures/wien-*-2026-09-17.json`.
 *
 * Die Eigenheit, die alles bestimmt: **Die Geschäftsstraße überstimmt die
 * Fläche.** Die 796 Streifen liegen innerhalb der Bezirksflächen, und wo ein
 * Streifen liegt, gilt seine Zeit (meist bis 18 Uhr, 1,5 h) statt der
 * Bezirkszeit (bis 22 Uhr, 2 h). Wer nur die Fläche fragt, sagt in der
 * Währinger Straße um 19 Uhr „kostet", wo seit 18 Uhr nichts mehr kostet.
 * Der Datenbau legt die Streifen deshalb als schmale Flächen **vor** die
 * Bezirksflächen — `zoneAt` nimmt den ersten Treffer.
 *
 * Und die zweite, die eine Entscheidung verlangt: **Kein Betrag im Feed.**
 * Wien hat einen einzigen Tarif für die ganze Stadt, festgelegt in § 2 der
 * Parkometerabgabeverordnung (Verordnung des Wiener Gemeinderats, ABl. der
 * Stadt Wien 2005/51, zuletzt geändert durch ABl. 2025/41, kundgemacht am
 * 9. Oktober 2025; laut Stadt Wien gültig seit 1. Jänner 2026): „Die Abgabe
 * beträgt für jede halbe Stunde Abstellzeit 1,70 Euro, wobei für angefangene
 * halbe Stunden der volle Abgabenbetrag zu entrichten ist. Beträgt die
 * gesamte Abstellzeit nicht mehr als fünfzehn Minuten, ist ein Abgabenbetrag
 * nicht zu entrichten […]". Gelesen im RIS,
 * `ris.bka.gv.at/Dokumente/Gemeinderecht/GEMRE_WI_90101_F420_040_2026/…`,
 * und gegen die Tariftabelle der Stadt gehalten
 * (`wien.gv.at/verkehr/parkgebuehren`: 30 Minuten 1,70 Euro, 1 Stunde
 * 3,40 Euro, 2 Stunden 6,80 Euro). Das ist eine Rechtsquelle mit Fundstelle,
 * keine Vermutung — deshalb `WIEN_ORDINANCE` als Konstante und
 * `fee: exact` statt `unknown`; `WIEN_RAW_FEE` sagt im Panel dazu, dass der
 * Betrag nicht aus dem Datensatz stammt. Wie Cottbus, nur ohne Widerspruch
 * zum Feed: Der Feed schweigt, er widerspricht nicht.
 */

import type { Weekday } from './berlin-time.js'
import type { Fee } from './parse-fee.js'
import type { ChargeWindow } from './tariff.js'

export class WienParseError extends Error {
  constructor(
    readonly raw: string,
    reason: string
  ) {
    super(`Wiener Feed: ${JSON.stringify(raw)} — ${reason}`)
    this.name = 'WienParseError'
  }
}

/** Wie in den anderen Parsern: fremde Eingabe wird zuerst begrenzt. */
const MAX_INPUT_LENGTH = 120

/** Die Kürzel des Feeds, kleingeschrieben. Sonntag ist 0, wie in `berlin-time.ts`. */
const DAY_NAMES: Record<string, Weekday> = {
  so: 0,
  mo: 1,
  di: 2,
  mi: 3,
  do: 4,
  fr: 5,
  sa: 6,
}

/**
 * Eine Klausel: `Mo.-Fr. (werkt.) v. 9-22 Uhr`, `Sa. (w.) v. 8-12h`,
 * `Mo.-Fr. (w.) v. 8:30-18h`, `Mo.-Fr. (w.) v. 10.30-15h`,
 * `Mo.-Fr. (werkt.) v.9-22h`.
 *
 * Was der Ausdruck verlangt und warum:
 *
 * - Die Tage stehen als Kürzel **mit Punkt** (`Mo.`), einzeln oder als
 *   Spanne mit Bindestrich. So schreibt der Feed alle 26 Werte; eine andere
 *   Form wäre ein anderer Feed.
 * - `(werkt.)` oder `(w.)` ist **Pflicht**. Das Wort steht auf jedem der
 *   Zusatzschilder und heißt: an gesetzlichen Feiertagen gilt die Zeit
 *   nicht. Genau darauf stützt sich `freeOnHolidays` — eine Klausel ohne das
 *   Wort sagte etwas anderes, und was, weiß niemand. Sie bricht ab.
 * - Minuten optional, mit `:` **oder** `.` (`8:30` und `10.30` kommen beide
 *   vor, je einmal bzw. zweimal), Stunden ein- oder zweistellig.
 * - Das Ende trägt `Uhr` (Flächen) oder `h` (Streifen), mit oder ohne
 *   Leerzeichen.
 */
const CLAUSE =
  /^([a-zäöü]{2})\.(?:-([a-zäöü]{2})\.)?\s*\((?:werkt|w)\.\)\s*v\.\s*(\d{1,2})(?:[:.](\d{2}))?\s*-\s*(\d{1,2})(?:[:.](\d{2}))?\s*(?:uhr|h)$/u

function parseDays(raw: string, from: string, to: string | undefined): readonly Weekday[] {
  const start = DAY_NAMES[from]
  const end = to === undefined ? start : DAY_NAMES[to]
  if (start === undefined || end === undefined) {
    throw new WienParseError(raw, `unbekannte Tagesangabe ${JSON.stringify(to === undefined ? from : `${from}-${to}`)}`)
  }
  // Rundlauf statt `for (d = start; d <= end)`, damit eine Spanne wie
  // `Sa.-Mo.` etwas Sinnvolles ergibt statt still leer zu bleiben — eine
  // leere Wochentagsliste hiesse „nie gebührenpflichtig". Die Spannweite wird
  // gerechnet, nicht erlaufen; die Schleife kann nicht endlos werden.
  const span = (end - start + 7) % 7
  const days: Weekday[] = []
  for (let step = 0; step <= span; step += 1) days.push(((start + step) % 7) as Weekday)
  return days
}

function parseClause(raw: string, clause: string): ChargeWindow {
  const match = CLAUSE.exec(clause.toLowerCase())
  if (match === null) {
    throw new WienParseError(raw, `keine Wiener Zeitklausel: ${JSON.stringify(clause)}`)
  }
  const [, fromDay, toDay, fromHour, fromMin, toHour, toMin] = match
  const weekdays = parseDays(raw, fromDay as string, toDay)

  const fromMinutes = Number(fromMin ?? '0')
  const toMinutes = Number(toMin ?? '0')
  if (fromMinutes > 59 || toMinutes > 59) throw new WienParseError(raw, 'Minuten über 59')
  const from = Number(fromHour) * 60 + fromMinutes
  const to = Number(toHour) * 60 + toMinutes

  // Stunde 24 heißt Minute 1440, nie 0 — wie in allen anderen Städten.
  if (from > 1440 || to > 1440) throw new WienParseError(raw, `Stunde über 24 in ${JSON.stringify(clause)}`)
  if (from >= to) {
    // Über Mitternacht kommt im Feed nicht vor. Eine Spanne wie `22-2 Uhr`
    // als ein Fenster zu speichern hiesse in `windowCovers` „nie", und sie zu
    // zerlegen hiesse, eine Lesart zu erfinden. Der Datenbau soll anhalten.
    throw new WienParseError(raw, `Spanne ${clause} endet nicht nach ihrem Anfang`)
  }
  return { weekdays, fromMinute: from, toMinute: to }
}

/**
 * Zerlegt `ZEITRAUM`.
 *
 * Gezählt am 17. September 2026: **3** Schreibweisen auf den 81 Flächen
 * (`Mo.-Fr. (werkt.) v. 9-22 Uhr` 78-mal, `… v. 8-11 Uhr` 2-mal,
 * `Mo.-Fr. (werkt.) v. 8-18 Uhr; Sa. (werkt.) v. 8-12 Uhr` 1-mal) und **23**
 * auf den 796 Streifen, davon `Mo.-Fr. (w.) v. 8-18h, Sa. (w.) v. 8-12h`
 * 667-mal. Die Flächen trennen Klauseln mit `;`, die Streifen mit `,`; beides
 * ist ein Trenner, weil in keiner Klausel ein Komma oder Semikolon
 * vorkommt (die Minuten schreibt der Feed mit `:` oder `.`, nie mit `,`).
 * Die vollständige Zählung steht in `docs/staedte-wien.md`.
 */
export function parseWienSchedule(raw: string): ChargeWindow[] {
  if (raw.length > MAX_INPUT_LENGTH) {
    throw new WienParseError(raw.slice(0, 40), `${raw.length} Zeichen sind keine Zeitangabe`)
  }
  const text = raw.trim().replace(/\s+/g, ' ')
  if (text === '') throw new WienParseError(raw, 'leere Zeitangabe')

  const clauses = text
    .split(/[;,]/)
    .map((part) => part.trim())
    .filter((part) => part !== '')
  if (clauses.length === 0) throw new WienParseError(raw, 'leere Zeitangabe')

  return clauses.map((clause) => parseClause(raw, clause))
}

/**
 * Zerlegt `DAUER`: `2 h` (80 Flächen, 3 Streifen) oder `1,5 h` (1 Fläche,
 * 793 Streifen). Ergebnis in Minuten.
 *
 * Nur Stunden, mit höchstens einer Nachkommastelle und deutschem Komma — so
 * schreibt der Feed beide Werte. `0 h` ist keine Höchstparkdauer, sondern
 * ein Parkverbot, und das steht dort nicht. Und mehr als drei Stunden darf
 * eine Kurzparkdauer nicht sein: § 25 Abs. 1 StVO 1960, „Die Kurzparkdauer
 * darf nicht weniger als 30 Minuten und nicht mehr als 3 Stunden betragen"
 * (RIS, Bundesnormen 10011336, gelesen am 17. September 2026). Ein Wert
 * darüber ist kein Tarif, sondern ein Feld, das ein Mensch ansehen muss.
 * Beides bricht ab, statt eine Zahl durchzureichen.
 */
const MAX_STAY = /^(\d{1,2})(?:,(\d))?\s*h$/

export function parseWienMaxStay(raw: string): number {
  if (raw.length > MAX_INPUT_LENGTH) {
    throw new WienParseError(raw.slice(0, 40), `${raw.length} Zeichen sind keine Höchstparkdauer`)
  }
  const match = MAX_STAY.exec(raw.trim())
  if (match === null) throw new WienParseError(raw, 'keine Höchstparkdauer der Form „2 h" oder „1,5 h"')
  const minutes = Number(match[1]) * 60 + Number(match[2] ?? '0') * 6
  if (minutes === 0) throw new WienParseError(raw, '0 h ist keine Höchstparkdauer')
  if (minutes > 3 * 60) throw new WienParseError(raw, 'länger als 3 h ist keine Kurzparkdauer (§ 25 Abs. 1 StVO)')
  return minutes
}

/**
 * Der Stadttarif — die Parkometerabgabeverordnung als Konstante, mit
 * Fundstelle. Fundstelle und Zitat stehen im Kopfkommentar.
 *
 * `centsPerHour` ist das Doppelte des Halbstundensatzes: 2 × 1,70 € = 3,40 €,
 * wie die Tariftabelle der Stadt es für 60 Minuten nennt. Die fünfzehn
 * gebührenfreien Minuten kennt `Fee` nicht; sie stehen in `WIEN_RAW_FEE`, das
 * Panel nennt sie.
 */
export const WIEN_ORDINANCE = {
  /** 1,70 Euro je angefangene halbe Stunde (§ 2 Parkometerabgabeverordnung). */
  centsPerHalfHour: 170,
  /** „Beträgt die gesamte Abstellzeit nicht mehr als fünfzehn Minuten, ist ein Abgabenbetrag nicht zu entrichten". */
  freeMinutes: 15,
  /** Kundmachung der jüngsten Änderung. */
  amtsblatt: 'ABl. der Stadt Wien 2025/41',
  /** Seit wann der Satz gilt, laut Tariftabelle der Stadt. */
  validFrom: '2026-01-01',
} as const

/** Der Tarif, den jede Wiener Zone trägt — es gibt nur diesen einen. */
export function wienFee(): Fee {
  return { kind: 'exact', centsPerHour: WIEN_ORDINANCE.centsPerHalfHour * 2 }
}

/**
 * Was im Panel unter „Tarif laut Quelle" steht. Der Klammerzusatz ist
 * Absicht: Der Betrag stammt aus der Verordnung, nicht aus dem Datensatz,
 * und wer die Quelle prüft, soll das nicht erst im Bericht erfahren — Salzburg
 * hält es genauso.
 */
export const WIEN_RAW_FEE =
  'laut Parkometerabgabeverordnung: 1,70 € je angefangene halbe Stunde, die ersten 15 Minuten gratis (nicht im Datensatz)'

/**
 * Der Zonenschlüssel einer Bezirksfläche: die Bezirksnummer, `17` — so
 * heißt die Zone auf dem Parkpickerl und im Alltag („der 17."). Drei Flächen
 * tragen zwei Bezirke (`BEZIRK` 4 mit `BEZIRK2` 5, zweimal 14 mit 15): Sie
 * gelten für beide, und Margareten (5) hat keine eigene Fläche. Der Schlüssel
 * nennt dann beide, `4+5`, damit niemand in Margareten „Zone 4" liest.
 *
 * Eine Nummer außerhalb 1–23 ist kein Wiener Bezirk; sie bricht ab, statt
 * als Zone `0` oder `24` durchzulaufen.
 */
export function wienAreaKey(properties: Pick<WienAreaProperties, 'BEZIRK' | 'BEZIRK2'>): string {
  const first = properties.BEZIRK
  if (!isBezirk(first)) throw new WienParseError(String(first), 'keine Wiener Bezirksnummer (1–23)')
  const second = properties.BEZIRK2
  if (second === null || second === undefined) return String(first)
  if (!isBezirk(second)) throw new WienParseError(String(second), 'keine Wiener Bezirksnummer (1–23)')
  if (second === first) return String(first)
  return `${first}+${second}`
}

/** Die Bezirke einer Fläche, aufsteigend — für die Bezirksnamen im Datenbau. */
export function wienAreaDistricts(properties: Pick<WienAreaProperties, 'BEZIRK' | 'BEZIRK2'>): number[] {
  const key = wienAreaKey(properties)
  return key.split('+').map(Number)
}

function isBezirk(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 23
}

/**
 * Der Zonenschlüssel eines Geschäftsstraßen-Streifens: Straße und
 * Hausnummernspanne, `Währinger Straße 121 bis 123`. Der Feed führt keine
 * Kennung, die jemand ausspricht; `SE_SDO_ROWID` ist eine Datenbankzeile.
 * Sechs Streifen haben keine Spanne (`GELTUNGSBEREICH` null, etwa
 * `Kettenbrücke`), dort bleibt es beim Namen. Fünf Paare teilen sich einen
 * Schlüssel — wie Hamburgs Stücke einer Zone; `loadZones` nummeriert die
 * Flächen ohnehin selbst.
 *
 * Der Feed schreibt die Spanne mit Leerzeichen am Ende (`30 `); getrimmt,
 * damit `Erbpostgasse 30` und `Erbpostgasse 30 ` nicht zwei Zonen sind.
 */
export function wienStripKey(properties: Pick<WienStripProperties, 'STRNAM' | 'GELTUNGSBEREICH'>): string {
  const street = (properties.STRNAM ?? '').replace(/\s+/g, ' ').trim()
  if (street === '') throw new WienParseError(String(properties.STRNAM), 'Streifen ohne Straßennamen')
  if (street.length > MAX_INPUT_LENGTH) {
    throw new WienParseError(street.slice(0, 40), `${street.length} Zeichen sind kein Straßenname`)
  }
  const range = (properties.GELTUNGSBEREICH ?? '').replace(/\s+/g, ' ').trim()
  return range === '' ? street : `${street} ${range}`
}

/** Rohzeile einer Kurzparkzonen-Fläche (`KURZPARKZONEOGD`), so weit wir sie lesen. */
export interface WienAreaProperties {
  /** Bezirksnummer 1–23, als Zahl. 22 der 23 Bezirke kommen vor; Margareten (5) nur in `BEZIRK2`. */
  BEZIRK?: number | null
  /** Zweiter Bezirk, bei 3 von 81 Flächen gesetzt (5 und zweimal 15). */
  BEZIRK2?: number | null
  /** `Mo.-Fr. (werkt.) v. 9-22 Uhr` — nur über `parseWienSchedule` lesen. */
  ZEITRAUM?: string | null
  /** `2 h` oder `1,5 h` — nur über `parseWienMaxStay` lesen. */
  DAUER?: string | null
  /** Immer null im Abzug vom 17. September 2026. */
  WEBLINK1?: string | null
  /** Die Kurzparkzonen-Seite der Stadt, bei 80 von 81 Flächen. */
  WEBLINK2?: string | null
  /** `2022-02-28Z` — seit wann die Fläche gilt; 12 Werte, jüngster `2025-04-06Z`. */
  GUELTIG_VON?: string | null
  SE_SDO_ROWID?: number | null
  /** Oracle-Restwert (`[B@1d3aabc`) bei 3 Flächen — ohne Bedeutung. */
  SE_ANNO_CAD_DATA?: string | null
}

/** Rohzeile eines Geschäftsstraßen-Streifens (`KURZPARKSTREIFENOGD`). */
export interface WienStripProperties {
  /** Bezirksnummer 1–23, als Zahl. */
  BEZIRK?: number | null
  /** Straßenname, `Währinger Straße`. */
  STRNAM?: string | null
  /** Hausnummernspanne, `121 bis 123`; bei 6 von 796 Streifen null. */
  GELTUNGSBEREICH?: string | null
  /** `Mo.-Fr. (w.) v. 8-18h, Sa. (w.) v. 8-12h` — nur über `parseWienSchedule` lesen. */
  ZEITRAUM?: string | null
  /** `1,5 h` (793) oder `2 h` (3). */
  DAUER?: string | null
  /** 127 Werte, zwei davon `1111-11-10Z` — ein Platzhalter, kein Datum. */
  GUELTIG_VON?: string | null
  SE_SDO_ROWID?: number | null
  SE_ANNO_CAD_DATA?: string | null
}

/** Rohzeile eines Bezirks (`BEZIRKSGRENZEOGD`), so weit wir sie lesen. */
export interface WienDistrictProperties {
  /** `Innere Stadt` */
  NAMEK?: string | null
  /** Bezirksnummer 1–23. */
  BEZNR?: number | null
  /** `1., Innere Stadt` */
  NAMEK_NUM?: string | null
  /** `I` */
  BEZ_RZ?: string | null
}
