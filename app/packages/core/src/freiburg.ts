/**
 * Der Freiburger Feed-Dialekt.
 *
 * Datensatz: WFS `gut_parken` der Stadt Freiburg i. Br. (Garten- und
 * Tiefbauamt), Typnamen `ms:parkgebzonen` (37 Polygone) und `ms:psa` (538
 * Parkscheinautomaten), abgerufen am 16. September 2026. Fixtures:
 * `test/fixtures/fr-parkgebzonen-2026-09-16.json` und
 * `test/fixtures/fr-parkscheinautomaten-2026-09-16.json`.
 *
 * Was dieser Feed anders macht als die sieben davor:
 *
 *  1. **Die Zone trägt Zeit UND Betrag selbst** — wie Hamburg, nicht wie
 *     Frankfurt. Die Automaten sind Beiwerk: Sie bestätigen die Zeit und
 *     nennen die Höchstparkdauer. Nur **eine** Fläche, ausgerechnet die
 *     einzige der Gebührenzone 1 (Altstadt), schreibt statt einer Zeit
 *     „Beschilderung beachten!". Dort entscheidet der Datenbau über die 109
 *     Automaten darin (`isFreiburgSignageOnly`).
 *  2. **Zwei Grammatiken für dieselbe Sache.** Die Polygone schreiben
 *     `werktags 09:00-19:00 Uhr`, die Automaten `werktags\n09:00 - 19:00` —
 *     mit Zeilenumbruch, mit Leerzeichen um den Strich, ohne „Uhr". Beides
 *     liest derselbe Parser, weil beides derselbe Dienst ist; ein zweiter
 *     Parser für die Automaten wäre eine zweite Stelle für denselben Fehler.
 *  3. **Ein Tippfehler im Feed.** `werktags 09:00-19:00 Uhrä` steht an einer
 *     Fläche. Der Parser weist das ab — ein Parser, der Tippfehler still
 *     schluckt, schluckt auch die, die eine Stunde verändern. Was der Datenbau
 *     daraus macht, sagt `freiburgScheduleTypo`: genau diese eine Schreibweise,
 *     wörtlich, wird korrigiert gelesen und als Quelldefekt vermerkt.
 *  4. **`--` ist kein Betrag.** Sechs Flächen (Park-and-Ride) nennen keinen
 *     Stundensatz, sondern „9,00 € oder ÖPNV-Ticket" als Tagespauschale. Das
 *     ist `Fee.unknown` plus Notiz — nicht 0,00 €, nicht 9,00 € je Stunde.
 */

import type { Weekday } from './berlin-time.js'
import type { Fee } from './parse-fee.js'
import type { ChargeWindow } from './tariff.js'

export class FreiburgParseError extends Error {
  constructor(
    readonly raw: string,
    reason: string
  ) {
    super(`Freiburger Feed: ${JSON.stringify(raw)} — ${reason}`)
    this.name = 'FreiburgParseError'
  }
}

/** Wie in den anderen Parsern: fremde Eingabe wird zuerst begrenzt. */
const MAX_INPUT_LENGTH = 120

const ALL_DAYS: readonly Weekday[] = [0, 1, 2, 3, 4, 5, 6]

/**
 * „werktags" ist Montag bis **Samstag** — dieselbe Auslegung wie in
 * `hamburg.ts` (§ 3 Abs. 2 BUrlG, ständige Rechtsprechung). Andersherum
 * gelesen meldete die App an 26 Freiburger Flächen samstags „gebührenfrei".
 */
const WEEKDAYS_MO_SA: readonly Weekday[] = [1, 2, 3, 4, 5, 6]

/** Tagesnamen des Feeds, ausgeschrieben („Montag - Freitag") und abgekürzt („Mo-Fr", „Sa"). */
const DAY_NAMES: Record<string, Weekday> = {
  so: 0,
  sonntag: 0,
  mo: 1,
  montag: 1,
  di: 2,
  dienstag: 2,
  mi: 3,
  mittwoch: 3,
  do: 4,
  donnerstag: 4,
  fr: 5,
  freitag: 5,
  sa: 6,
  samstag: 6,
}

/**
 * Eine Klausel: Tagesangabe, Stundenspanne, optional „Uhr".
 *
 * Die Tagesangabe ist entweder ein Wort (`werktags`, `täglich`) oder ein
 * Tagesname mit optionalem zweiten Tagesnamen dahinter. Alles hängt am
 * Zeilenende: `Uhrä` passt nicht, und genau das ist gewollt.
 */
const CLAUSE =
  /^(werktags|täglich|taeglich|(\p{L}+)(?:\s*-\s*(\p{L}+))?)\s+(\d{1,2})(?::(\d{2}))?\s*-\s*(\d{1,2})(?::(\d{2}))?(?:\s*Uhr)?$/iu

function daysOf(raw: string, spec: string, first: string | undefined, last: string | undefined): readonly Weekday[] {
  const word = spec.toLowerCase()
  if (word === 'werktags') return WEEKDAYS_MO_SA
  if (word === 'täglich' || word === 'taeglich') return ALL_DAYS
  const from = DAY_NAMES[(first ?? '').toLowerCase()]
  if (from === undefined) throw new FreiburgParseError(raw, `unbekannte Tagesangabe ${spec}`)
  if (last === undefined) return [from]
  const to = DAY_NAMES[last.toLowerCase()]
  if (to === undefined) throw new FreiburgParseError(raw, `unbekannte Tagesangabe ${spec}`)
  // Sonntag ist 0, steht aber am Ende der Woche: „Mo-So" muss bis 0 laufen.
  const end = to === 0 ? 7 : to
  const start = from === 0 ? 7 : from
  if (start > end) throw new FreiburgParseError(raw, `umgekehrte Tagesspanne ${spec}`)
  const days: Weekday[] = []
  for (let day = start; day <= end; day += 1) days.push((day % 7) as Weekday)
  return days
}

function parseClause(raw: string, clause: string): ChargeWindow {
  const match = CLAUSE.exec(clause)
  if (match === null) throw new FreiburgParseError(raw, `keine erkennbare Tag-und-Stunden-Angabe in "${clause}"`)
  const [, spec, first, last, fromHour, fromMin, toHour, toMin] = match
  const weekdays = daysOf(raw, spec as string, first, last)
  if (Number(fromMin ?? 0) > 59 || Number(toMin ?? 0) > 59) {
    throw new FreiburgParseError(raw, 'Minuten über 59')
  }
  const fromMinute = Number(fromHour) * 60 + Number(fromMin ?? 0)
  const toMinute = Number(toHour) * 60 + Number(toMin ?? 0)
  // Stunde 24 heisst Minute 1440, nie 0: „00:00 - 24:00" ist der ganze Tag.
  if (!(fromMinute >= 0 && fromMinute < 1440 && toMinute > 0 && toMinute <= 1440)) {
    throw new FreiburgParseError(raw, `unplausible Spanne ${fromHour}-${toHour}`)
  }
  // Über Mitternacht kommt im Freiburger Feed nicht vor (Hamburg hat es, und
  // dort ist es gebaut). Hier ist eine umgekehrte Spanne ein Fehler, keine
  // Regel — sonst würde „19-9" zu einem Nachtfenster, das niemand gemeint hat.
  if (fromMinute >= toMinute) throw new FreiburgParseError(raw, `Ende ${toHour} liegt nicht nach Anfang ${fromHour}`)
  return { weekdays, fromMinute, toMinute }
}

/** Die eine Fläche, die statt einer Zeit auf die Beschilderung verweist. */
export function isFreiburgSignageOnly(raw: string | null | undefined): boolean {
  return /^Beschilderung beachten!?$/i.test((raw ?? '').trim())
}

/**
 * Bekannte Tippfehler des Feeds — wörtlich, nicht als Muster.
 *
 * Ein Muster wie „Uhr plus ein beliebiger Buchstabe" würde auch `Uhr5`
 * schlucken, und wer weiss, was das einmal heissen soll. Die Liste nennt die
 * Zeichenkette, die am 16. September 2026 im Feed stand, und was sie
 * offensichtlich meint. Der Datenbau vermerkt die Korrektur als Quelldefekt,
 * damit sie in der Oberfläche nicht wie eine gelesene Tatsache aussieht.
 */
const KNOWN_TYPOS: Readonly<Record<string, string>> = {
  'werktags 09:00-19:00 Uhrä': 'werktags 09:00-19:00 Uhr',
}

export function freiburgScheduleTypo(raw: string | null | undefined): { corrected: string } | null {
  const corrected = KNOWN_TYPOS[(raw ?? '').trim()]
  return corrected === undefined ? null : { corrected }
}

/**
 * Zerlegt `zeit_der_gebuehrenpflicht` (Polygone) und `laufzeiten` (Automaten).
 *
 * Sieben Schreibweisen an den Flächen, siebzehn an den Automaten — und alle
 * bis auf drei passen auf „Tagesangabe, Stundenspanne, optional Uhr", durch
 * Semikolon getrennt. Die drei anderen: `durchgehend` (ganztägig, alle
 * Tage), `Beschilderung beachten!` (keine Zeit — siehe
 * `isFreiburgSignageOnly`) und `9 - 19 Uhr` an einem einzigen Automaten,
 * ohne Tagesangabe. Der letzte wirft: Ob „9 - 19 Uhr" täglich oder werktags
 * meint, sagt die Zeile nicht, und geraten wäre es an sechs von sieben Tagen
 * eine Behauptung.
 */
export function parseFreiburgSchedule(raw: string): ChargeWindow[] {
  if (raw.length > MAX_INPUT_LENGTH) {
    throw new FreiburgParseError(raw.slice(0, 40), `${raw.length} Zeichen sind keine Zeitangabe`)
  }
  // Die Automaten schreiben den Zeilenumbruch mitten in die Angabe.
  const text = raw.replace(/\s+/g, ' ').trim()
  if (text === '') throw new FreiburgParseError(raw, 'leer')
  if (/^durchgehend$/i.test(text)) return [{ weekdays: ALL_DAYS, fromMinute: 0, toMinute: 1440 }]
  if (isFreiburgSignageOnly(text)) {
    throw new FreiburgParseError(raw, 'keine Zeit, nur ein Verweis auf die Beschilderung')
  }
  return text
    .split(';')
    .map((clause) => clause.trim())
    .filter((clause) => clause !== '')
    .map((clause) => parseClause(raw, clause))
}

/**
 * Fenster zusammenlegen: gleiche Fenster nur einmal.
 *
 * Für die eine Fläche, deren Zeiten aus ihren Automaten kommen. 93 Automaten
 * mit `werktags 09:00 - 23:00` sollen ein Fenster ergeben, nicht 93.
 */
export function mergeFreiburgWindows(windows: readonly ChargeWindow[]): ChargeWindow[] {
  const seen = new Set<string>()
  const merged: ChargeWindow[] = []
  for (const window of windows) {
    const key = `${[...window.weekdays].join(',')}|${window.fromMinute}|${window.toMinute}`
    if (seen.has(key)) continue
    seen.add(key)
    merged.push(window)
  }
  return merged
}

/** Beträge an den Flächen: `1,80 €`, Komma, Leerzeichen, Eurozeichen. */
const ZONE_AMOUNT = /^(\d{1,3}),(\d{2})\s*€$/

/**
 * Zerlegt `parkgebuehr_je_stunde`.
 *
 * Vier Werte über 37 Flächen: drei Beträge und `--`. Der Strich steht an den
 * sechs Park-and-Ride-Flächen, die eine Tagespauschale „oder ÖPNV-Ticket"
 * verlangen — kein Stundensatz, also `unknown`, und die Pauschale kommt als
 * Notiz mit (`freiburgZoneNote`).
 */
export function parseFreiburgFee(raw: string | null | undefined): Fee {
  if (raw === null || raw === undefined) return { kind: 'unknown' }
  if (raw.length > MAX_INPUT_LENGTH) {
    throw new FreiburgParseError(raw.slice(0, 40), `${raw.length} Zeichen sind keine Gebühr`)
  }
  const text = raw.trim()
  if (text === '' || text === '-' || text === '--') return { kind: 'unknown' }
  const match = ZONE_AMOUNT.exec(text)
  if (match === null) throw new FreiburgParseError(raw, 'kein erkennbarer Betrag je Stunde')
  const centsPerHour = Number(match[1]) * 100 + Number(match[2])
  // Dieselbe Regel wie überall: Ein Nullbetrag ist kein Tarif. Was `0,00 €`
  // im Feed bedeutete, weiss niemand — „kostenlos" ist die eine Lesart, die
  // er sicher nicht verdient.
  if (centsPerHour === 0) throw new FreiburgParseError(raw, 'ein Betrag von 0,00 € ist kein Tarif')
  return { kind: 'exact', centsPerHour }
}

/** Beträge an den Automaten: `tarif_e_h` als `1.80`, Punkt statt Komma, ohne Einheit. */
const AUTOMAT_AMOUNT = /^(\d{1,3})\.(\d{2})$/

/**
 * Zerlegt `tarif_e_h` eines Automaten — nur zur Gegenprobe.
 *
 * Der Betrag der Fläche kommt aus der Fläche. Die Automaten darin sollen
 * dasselbe sagen, und der Datenbau zählt nach, ob sie es tun.
 */
export function parseFreiburgAutomatFee(raw: string | null | undefined): Fee {
  if (raw === null || raw === undefined) return { kind: 'unknown' }
  if (raw.length > MAX_INPUT_LENGTH) {
    throw new FreiburgParseError(raw.slice(0, 40), `${raw.length} Zeichen sind keine Gebühr`)
  }
  const text = raw.trim()
  if (text === '') return { kind: 'unknown' }
  const match = AUTOMAT_AMOUNT.exec(text)
  if (match === null) throw new FreiburgParseError(raw, 'kein erkennbarer Betrag je Stunde')
  const centsPerHour = Number(match[1]) * 100 + Number(match[2])
  if (centsPerHour === 0) throw new FreiburgParseError(raw, 'ein Betrag von 0,00 € ist kein Tarif')
  return { kind: 'exact', centsPerHour }
}

/**
 * Ab dieser Stundenzahl gilt eine Höchstparkdauer als „keine".
 *
 * 506 der 538 Automaten führen `24`: Das ist das Tagesticket, nicht eine
 * Regel, die jemanden nach 24 Stunden wegschickt. Als Höchstparkdauer
 * angezeigt sähe „24 h" aus wie eine Aussage — und die trifft der Feed nicht.
 */
const MAX_STAY_DAY_HOURS = 24

/**
 * Zerlegt `hoechstparkdauer_in_h` — eine Zahl, Stunden.
 *
 * Nur 1, 2 und 4 kommen als echte Begrenzung vor. Alles, was keine positive
 * ganze Stundenzahl ist, wirft: Eine `0` hiesse „Parken verboten", ein
 * Bruch wäre eine Schreibweise, die es im Feed nicht gibt.
 */
export function parseFreiburgMaxStay(raw: number | null | undefined): number | undefined {
  if (raw === null || raw === undefined) return undefined
  if (!Number.isInteger(raw) || raw <= 0) {
    throw new FreiburgParseError(String(raw), 'keine positive ganze Stundenzahl')
  }
  if (raw >= MAX_STAY_DAY_HOURS) return undefined
  return raw * 60
}

/** Kurzform für `maxStayValues`, wie in Frankfurt: `1h`, `90min`. */
export function freiburgMaxStayCode(minutes: number): string {
  return minutes % 60 === 0 ? `${minutes / 60}h` : `${minutes}min`
}

/** Rohzeile einer Gebührenzonen-Fläche, so weit wir sie lesen. */
export interface FreiburgZoneProperties {
  fid?: number | null
  /** `1`, `2` oder `3` — als Zeichenkette, anders als am Automaten. */
  parkgebuehrenzone?: string | null
  parkgebuehr_je_stunde?: string | null
  /** Mit Bindestrich, wie die Quelle das Feld nennt. */
  'tages-parkpauschale'?: string | null
  zeit_der_gebuehrenpflicht?: string | null
  zonenname?: string | null
}

/** Rohzeile eines Parkscheinautomaten. */
export interface FreiburgAutomatProperties {
  gid?: number | null
  kartenzahlung?: boolean | null
  gebiet?: string | null
  /** `1`, `2` oder `3` — als **Zahl**, anders als an der Fläche. */
  gebuehrenzone?: number | null
  laufzeiten?: string | null
  hoechstparkdauer_in_h?: number | null
  handyparkzone?: string | null
  standort?: string | null
  stadtteil?: string | null
  tarif_in_euro_h?: number | null
  aktiv?: boolean | null
  tarif_e_h?: string | null
  kartenzahlung_i?: number | null
}

/** Rohzeile eines Behindertenparkplatzes (Übersichtsebene, Punkte). */
export interface FreiburgAccessibleProperties {
  fid?: string | null
  strasse?: string | null
  hausnummer?: string | null
  /** `1`, `2` oder `1 von 2` — der wievielte Platz von wie vielen. */
  anzahl?: string | null
  hinweis?: string | null
  stadtteil?: string | null
}

/**
 * Ob ein Automat in Betrieb ist. Alle 538 tragen `true`; der Filter steht
 * trotzdem, damit ein abgeschalteter Automat eines Tages nicht mitzählt.
 */
export function isActiveFreiburgAutomat(properties: FreiburgAutomatProperties): boolean {
  return properties.aktiv === true
}

/**
 * Der Schlüssel einer Fläche: Gebührenzone und Flächennummer.
 *
 * „Zone 3" allein ist kein Schlüssel — 34 Flächen tragen ihn. Die `fid` der
 * Quelle allein wäre einer, sagte aber nichts über den Tarif. Beides
 * zusammen ist eindeutig und liest sich in der Oberfläche als
 * „Zone 3 (Fläche 12)".
 */
export function freiburgZoneLabel(properties: FreiburgZoneProperties): string {
  const zone = (properties.parkgebuehrenzone ?? '').trim() || '?'
  const fid = properties.fid
  return `${zone} (Fläche ${typeof fid === 'number' && Number.isInteger(fid) ? fid : '?'})`
}

/**
 * Was die Quelle über die Fläche sonst noch sagt: die Tagespauschale.
 *
 * `Fee` kennt keine Pauschale, und sie ist für den Leser die halbe Antwort —
 * bei den sechs Park-and-Ride-Flächen sogar die ganze.
 */
export function freiburgZoneNote(properties: FreiburgZoneProperties): string | null {
  const pauschale = (properties['tages-parkpauschale'] ?? '').replace(/\s+/g, ' ').trim()
  return pauschale === '' || pauschale === '--' ? null : `Tagespauschale ${pauschale}`
}

/**
 * Wie viele Plätze ein Behindertenparkplatz-Standort hat.
 *
 * `anzahl` ist „1", „2" oder „1 von 2": Bei der Form „n von m" ist m die
 * Zahl der Plätze am Standort. Was nicht in eine der beiden Formen passt
 * (leer, „1von 2" ohne Leerzeichen zählt noch), bleibt ohne Zahl statt zu
 * raten.
 */
export function freiburgAccessibleCount(raw: string | null | undefined): number | null {
  const text = (raw ?? '').trim()
  const ofTotal = /^\d{1,3}\s*von\s*(\d{1,3})$/i.exec(text)
  if (ofTotal !== null) return Number(ofTotal[1])
  if (/^\d{1,3}$/.test(text)) return Number(text)
  return null
}
