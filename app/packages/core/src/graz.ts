/**
 * Der Grazer Feed-Dialekt.
 *
 * Was `hamburg.ts` für Hamburg tut, tut diese Datei für Graz — getrennt, weil
 * die Feeds außer der Domäne nichts teilen. Ein gemeinsamer Parser wäre bei
 * jeder Änderung an einer Stadt für die andere gefährlich.
 *
 * Datensatz: ArcGIS FeatureServer `1_3_Verkehrswesen/Grazer_Parkzonen` des
 * Stadtvermessungsamts Graz, zwei Ebenen: „Kurzparkzonen aktuell" (90
 * Flächen, die **Blaue Zone**) und „Parkzonen aktuell" (75 Flächen, die
 * **Grüne Zone**), abgerufen am 16. September 2026. Fixtures:
 * `test/fixtures/graz-kurzparkzonen-2026-09-16.json` und
 * `test/fixtures/graz-parkzonen-2026-09-16.json`.
 *
 * Die erste Stadt außerhalb Deutschlands, und der erste Feed, bei dem Tarif,
 * Zeiten und Höchstparkdauer **je Fläche** als Prosa stehen — wie in
 * Frankfurt, nur ohne den Umweg über Automaten. Drei Eigenheiten:
 *
 *  1. **Die Gebühr steht je halbe Stunde, nicht je Stunde.** „Mindestgebühr
 *     (halbe Stunde): € 1,30" heißt 2,60 € je Stunde; die Stadt bestätigt
 *     auf gps.graz.at, dass ab der Mindestgebühr „in 10-Cent-Schritten" bis
 *     zur Höchstparkdauer gezahlt wird — also linear. Das „bis € 7,80" im
 *     selben Satz ist die Obergrenze für drei Stunden (6 × 1,30) und wird
 *     nachgerechnet, nicht geglaubt: Ist es kein Vielfaches der halben
 *     Stunde, ist der Tarif nicht linear, und der Parser bricht ab.
 *  2. **Die Grüne Zone kennt Tickets, die `Fee` nicht ausdrückt.** Tagesticket
 *     11,00 €, 5-Tages-Ticket 55,00 €. Sie stehen als `tickets` neben dem
 *     Stundensatz und landen im Datenbau in der `note` — verschwiegen wäre
 *     die halbe Antwort, denn wer 24 Stunden steht, zahlt nicht 48 €.
 *  3. **Zwei Ebenen, dieselben Felder.** Ob eine Fläche blau oder grün ist,
 *     sagt kein Attribut, nur die Ebene. Deshalb trägt der Datenbau die
 *     `GrazZoneKind` von außen hinein.
 *
 * Die Tagesangabe „Werktags, Montag bis Freitag" nennt beides: das Wort und
 * die Tage. Gelesen werden die **Tage**; „werktags" allein, ohne Aufzählung,
 * wird abgewiesen — in Österreich wie in Deutschland zählt der Samstag als
 * Werktag, im Feed steht er aber immer als eigene Klausel mit eigener Zeit.
 */

import type { Weekday } from './berlin-time.js'
import type { Fee } from './parse-fee.js'
import type { ChargeWindow } from './tariff.js'

export class GrazParseError extends Error {
  constructor(
    readonly raw: string,
    reason: string
  ) {
    super(`Grazer Feed: ${JSON.stringify(raw)} — ${reason}`)
    this.name = 'GrazParseError'
  }
}

/**
 * Wie in den anderen Parsern: fremde Eingabe wird zuerst begrenzt. Der
 * längste echte Wert hat 103 Zeichen (die blaue Geltungszeit mit Samstag).
 */
const MAX_INPUT_LENGTH = 160

const ALL_DAYS: readonly Weekday[] = [0, 1, 2, 3, 4, 5, 6]

/** Ausgeschriebene Wochentage, klein; `Weekday` zählt ab Sonntag. */
const DAY_NAMES: Readonly<Record<string, Weekday>> = {
  sonntag: 0,
  montag: 1,
  dienstag: 2,
  mittwoch: 3,
  donnerstag: 4,
  freitag: 5,
  samstag: 6,
}

/**
 * Eine Klausel: optional „Werktags,", dann „Täglich" oder ein Tag oder eine
 * Tagesspanne, dann „von H.MM (Uhr) bis H.MM (Uhr)".
 *
 * Die Stunde steht mit Punkt (`9.00`), nicht mit Doppelpunkt; „Uhr" fehlt in
 * der grünen Schreibweise nach der ersten Zeit („von 9.00 bis 20.00 Uhr.").
 * Beides ist optional, damit beide Ebenen durch dasselbe Muster gehen.
 */
const CLAUSE =
  /^(?:werktags,?\s+)?(täglich|(\p{L}+)(?:\s+bis\s+(\p{L}+))?),?\s+von\s+(\d{1,2})(?:\.(\d{2}))?(?:\s*uhr)?\s+bis\s+(\d{1,2})(?:\.(\d{2}))?(?:\s*uhr)?$/iu

function dayOf(raw: string, name: string): Weekday {
  const day = DAY_NAMES[name.toLowerCase()]
  if (day === undefined) throw new GrazParseError(raw, `unbekannte Tagesangabe „${name}"`)
  return day
}

/**
 * Montag bis Freitag → [1, 2, 3, 4, 5]. Eine umgedrehte Spanne („Freitag bis
 * Montag") ist Feed-Inhalt, kein Parserfehler — sie wirft die eigene Klasse,
 * damit `instanceof` unlesbare Zeile von kaputtem Parser unterscheiden kann.
 */
function daySpan(raw: string, from: Weekday, to: Weekday): Weekday[] {
  // Sonntag zählt als 0 und stünde damit vor Montag; für Spannen gilt die
  // Woche ab Montag, wie auf jedem Schild.
  const order = (day: Weekday): number => (day === 0 ? 7 : day)
  if (order(from) > order(to)) {
    throw new GrazParseError(raw, 'die Tagesspanne ist umgedreht')
  }
  const days: Weekday[] = []
  for (let index = order(from); index <= order(to); index += 1) {
    days.push((index % 7) as Weekday)
  }
  return days
}

function minuteOf(raw: string, hour: string, minute: string | undefined): number {
  const minutes = Number(minute ?? 0)
  if (minutes > 59) throw new GrazParseError(raw, 'Minuten über 59')
  return Number(hour) * 60 + minutes
}

/**
 * Zerlegt `GELTUNGSZEIT`.
 *
 * Drei Schreibweisen im Abzug vom 16. September 2026:
 *
 * - `Werktags, Montag bis Freitag, von 9.00 Uhr bis 20.00 Uhr und Samstag
 *   von 9.00 Uhr bis 13.00 Uhr` (89 blaue Flächen)
 * - `Täglich von 8.00 Uhr bis 22.00 Uhr` (eine: der Europaplatz vor dem
 *   Hauptbahnhof)
 * - `Werktags, Montag bis Freitag von 9.00 bis 20.00 Uhr.` (alle 75 grünen —
 *   ohne Komma vor „von", ohne „Uhr" nach der ersten Zeit, mit Punkt am Ende)
 *
 * Klauseln trennt ein „und". Ein Fenster über Mitternacht kommt nicht vor
 * und wird abgewiesen statt gedeutet: Was die Stadt damit meinte, weiß der
 * Parser nicht, und eine still falsch gelesene Zeit nennt jemandem eine
 * Stunde, in der er ein Knöllchen bekommt.
 */
export function parseGrazSchedule(raw: string): ChargeWindow[] {
  if (raw.length > MAX_INPUT_LENGTH) {
    throw new GrazParseError(raw.slice(0, 40), `${raw.length} Zeichen sind keine Zeitangabe`)
  }
  const text = raw.trim().replace(/\s+/g, ' ').replace(/\.$/, '')
  if (text === '') throw new GrazParseError(raw, 'leer')

  const windows: ChargeWindow[] = []
  for (const clause of text.split(/\s+und\s+/i)) {
    const match = CLAUSE.exec(clause)
    if (match === null) {
      throw new GrazParseError(raw, `keine erkennbare Tag-und-Stunden-Angabe in „${clause}"`)
    }
    const [, daySpec, firstDay, lastDay, fromHour, fromMin, toHour, toMin] = match

    let weekdays: readonly Weekday[]
    if ((daySpec as string).toLowerCase() === 'täglich') {
      weekdays = ALL_DAYS
    } else {
      const from = dayOf(raw, firstDay as string)
      weekdays = lastDay === undefined ? [from] : daySpan(raw, from, dayOf(raw, lastDay))
    }

    const from = minuteOf(raw, fromHour as string, fromMin)
    const to = minuteOf(raw, toHour as string, toMin)
    // Stunde 24 heißt Minute 1440, nie 0 — wie in Berlin und Hamburg.
    if (!(from >= 0 && from < 1440 && to > 0 && to <= 1440)) {
      throw new GrazParseError(raw, `unplausible Spanne ${fromHour}-${toHour}`)
    }
    if (from >= to) {
      throw new GrazParseError(raw, 'Ende liegt nicht nach dem Anfang')
    }
    windows.push({ weekdays, fromMinute: from, toMinute: to })
  }
  return windows
}

/** Ein Ticket der Grünen Zone, das `Fee` nicht ausdrücken kann. */
export interface GrazTicket {
  label: string
  cents: number
}

/** Was `PARK_GEBUEHR` hergibt: der Stundensatz und, wo es sie gibt, Tickets. */
export interface GrazTariff {
  fee: Fee
  /** Die Obergrenze aus „bis € 7,80" — nur die Blaue Zone nennt eine. */
  maxTotalCents: number | null
  tickets: readonly GrazTicket[]
}

const HALF_HOUR = /^Mindestgebühr \(halbe Stunde\):\s*€\s*(\d{1,3}),(\d{2})/u
const BLUE_REST = /^\s+bis\s+€\s*(\d{1,3}),(\d{2})\s+je nach maximaler Parkdauer$/u
const GREEN_REST =
  /^\s+Tagesticket \(24 Stunden\):\s*€\s*(\d{1,3}),(\d{2})\s+bis\s+5-Tages-Ticket:\s*€\s*(\d{1,3}),(\d{2})$/u

const cents = (euro: string, cent: string): number => Number(euro) * 100 + Number(cent)

/**
 * Zerlegt `PARK_GEBUEHR`.
 *
 * Zwei Werte im ganzen Abzug, einer je Ebene:
 *
 * - blau: `Mindestgebühr (halbe Stunde): € 1,30 bis € 7,80 je nach maximaler
 *   Parkdauer` — 2,60 €/h, Obergrenze 7,80 € (sechs halbe Stunden).
 * - grün: `Mindestgebühr (halbe Stunde): € 1,00 Tagesticket (24 Stunden):
 *   € 11,00 bis 5-Tages-Ticket: € 55,00` — 2,00 €/h und zwei Tickets.
 *
 * Ein Betrag von 0,00 € ist ein Abbruch, nie ein Tarif: Was ein Nullbetrag
 * im Feed bedeutete, weiß niemand, und „kostenlos" ist die eine Lesart, die
 * er sicher nicht verdient (`CLAUDE.md`, „null Euro sind auch kein Betrag").
 */
export function parseGrazFee(raw: string | null | undefined): GrazTariff {
  if (raw === null || raw === undefined) return { fee: { kind: 'unknown' }, maxTotalCents: null, tickets: [] }
  if (raw.length > MAX_INPUT_LENGTH) {
    throw new GrazParseError(raw.slice(0, 40), `${raw.length} Zeichen sind keine Gebühr`)
  }
  const text = raw.trim().replace(/\s+/g, ' ')
  if (text === '') return { fee: { kind: 'unknown' }, maxTotalCents: null, tickets: [] }

  const head = HALF_HOUR.exec(text)
  if (head === null) throw new GrazParseError(raw, 'keine Mindestgebühr je halbe Stunde')
  const halfHour = cents(head[1] as string, head[2] as string)
  if (halfHour === 0) throw new GrazParseError(raw, 'ein Betrag von 0,00 € ist kein Tarif')
  const centsPerHour = halfHour * 2
  const rest = text.slice(head[0].length)

  const blue = BLUE_REST.exec(rest)
  if (blue !== null) {
    const maxTotal = cents(blue[1] as string, blue[2] as string)
    // Die Obergrenze muss auf halbe Stunden aufgehen — sonst ist der Tarif
    // nicht linear, und „Mindestgebühr × 2" wäre kein Stundensatz.
    if (maxTotal < halfHour || maxTotal % halfHour !== 0) {
      throw new GrazParseError(raw, `Obergrenze ${maxTotal} ist kein Vielfaches der halben Stunde ${halfHour}`)
    }
    return { fee: { kind: 'exact', centsPerHour }, maxTotalCents: maxTotal, tickets: [] }
  }

  const green = GREEN_REST.exec(rest)
  if (green !== null) {
    const day = cents(green[1] as string, green[2] as string)
    const fiveDays = cents(green[3] as string, green[4] as string)
    // Ein Tagesticket, das teurer ist als 24 Stunden zum Stundensatz, oder ein
    // 5-Tages-Ticket unter dem Tagesticket, wäre ein Tippfehler der Quelle.
    if (day === 0 || day > 24 * centsPerHour || fiveDays < day) {
      throw new GrazParseError(raw, `Tickets ${day}/${fiveDays} passen nicht zum Stundensatz ${centsPerHour}`)
    }
    return {
      fee: { kind: 'exact', centsPerHour },
      maxTotalCents: null,
      tickets: [
        { label: 'Tagesticket (24 Stunden)', cents: day },
        { label: '5-Tages-Ticket', cents: fiveDays },
      ],
    }
  }

  throw new GrazParseError(raw, 'weder Obergrenze noch Tickets nach der Mindestgebühr')
}

/**
 * Zerlegt `PARKDAUER` — `180 min`, `90 min`, `60 min` oder `Ohne
 * Beschränkung`.
 *
 * `0 min` wäre „Parken verboten" und steht nirgends; es wird abgewiesen statt
 * als „keine Begrenzung" gelesen.
 */
export function parseGrazMaxStay(raw: string | null | undefined): number | undefined {
  if (raw === null || raw === undefined) return undefined
  if (raw.length > MAX_INPUT_LENGTH) {
    throw new GrazParseError(raw.slice(0, 40), `${raw.length} Zeichen sind keine Parkdauer`)
  }
  const text = raw.trim().replace(/\s+/g, ' ')
  if (text === '') return undefined
  if (/^ohne beschränkung$/iu.test(text)) return undefined
  const match = /^(\d{1,4})\s*min\.?$/iu.exec(text)
  if (match === null) throw new GrazParseError(raw, 'keine Minutenzahl')
  const minutes = Number(match[1])
  if (minutes === 0) throw new GrazParseError(raw, 'null Minuten sind keine Höchstparkdauer')
  return minutes
}

const PROSE_STAY = /^Die maximale Parkdauer beträgt (\d{1,4}) Minuten \((\d{1,2})(?:,(\d))? Stunden?\)$/u

/**
 * Zerlegt `PARK_DAUER`, die Satzform derselben Angabe: `Die maximale
 * Parkdauer beträgt 90 Minuten (1,5 Stunden)` oder `Ohne zeitliche
 * Beschränkung`.
 *
 * Der Feed führt die Höchstparkdauer zweimal. Der Datenbau liest beide und
 * bricht ab, wenn sie auseinanderlaufen — eine Angabe, die zweimal dasteht
 * und einmal anders, ist ein Hinweis, dass jemand nur eine gepflegt hat.
 * Die Stundenzahl in der Klammer wird gegen die Minuten gerechnet, aus
 * demselben Grund.
 */
export function parseGrazMaxStayProse(raw: string | null | undefined): number | undefined {
  if (raw === null || raw === undefined) return undefined
  if (raw.length > MAX_INPUT_LENGTH) {
    throw new GrazParseError(raw.slice(0, 40), `${raw.length} Zeichen sind keine Parkdauer`)
  }
  const text = raw.trim().replace(/\s+/g, ' ')
  if (text === '') return undefined
  if (/^ohne zeitliche beschränkung$/iu.test(text)) return undefined
  const match = PROSE_STAY.exec(text)
  if (match === null) throw new GrazParseError(raw, 'kein Satz über die maximale Parkdauer')
  const minutes = Number(match[1])
  const hours = Number(match[2]) + (match[3] === undefined ? 0 : Number(match[3]) / 10)
  if (minutes === 0) throw new GrazParseError(raw, 'null Minuten sind keine Höchstparkdauer')
  if (hours * 60 !== minutes) {
    throw new GrazParseError(raw, `${hours} Stunden sind nicht ${minutes} Minuten`)
  }
  return minutes
}

/** Rohzeile des Feeds, beide Ebenen führen dieselben dreizehn Felder. */
export interface GrazZoneProperties {
  OBJECTID?: number | null
  /** Zonenschlüssel: `01`…`11`, `S1`, `S2` (blau) bzw. `A`…`K`, `S`, `S3` (grün). */
  BEZEICHNUNG?: string | null
  NAME?: string | null
  /** `Flächendeckend` oder `Straßenzugsweise`. */
  TYP?: string | null
  PARKDAUER?: string | null
  /** Leer, ein Leerzeichen oder die Zeichenkette `<Null>` — nie ein Wert. */
  DELETED?: string | null
  GELTUNGSZEIT?: string | null
  PARK_DAUER?: string | null
  PARK_GEBUEHR?: string | null
  AG_BEWOHNER_INFO?: string | null
  ZONEN_PLAN?: string | null
  HANDYPARKEN_CODE?: string | null
  Shape__Area?: number | null
}

/**
 * Welche Ebene eine Fläche stammt — die Farbe auf dem Schild.
 *
 * Kein Feld des Feeds sagt das; es steht nur im Namen der Ebene. Der Datenbau
 * weiß, welche Datei er liest, und reicht es hier hinein.
 */
export type GrazZoneKind = 'kurzparkzone' | 'parkzone'

export const GRAZ_ZONE_KIND_LABEL: Readonly<Record<GrazZoneKind, string>> = {
  kurzparkzone: 'Blaue Zone',
  parkzone: 'Grüne Zone',
}

/**
 * Was im Feld `DELETED` steht, wenn es etwas sagt — oder null.
 *
 * Im Abzug trägt das Feld ein Leerzeichen (163-mal), nichts (einmal) oder
 * wörtlich `<Null>` (einmal) — alles Platzhalter, keiner ein Wert. Was ein
 * echter Löschvermerk wäre, sagt der Dienst nicht. Der Datenbau lässt jede
 * Fläche mit einem Vermerk aus und zählt sie im Log: Eine gelöschte Fläche
 * als geltend auszuliefern wäre eine Warnung vor einer Bewirtschaftung, die
 * es nicht gibt.
 */
export function grazDeletedMarker(properties: GrazZoneProperties): string | null {
  const value = (properties.DELETED ?? '').trim()
  if (value === '' || value === '<Null>') return null
  return value
}

/** Der Zonenschlüssel, wie ihn die Stadt vergibt — ohne Farbe, die trägt die `note`. */
export function grazZoneKey(properties: GrazZoneProperties): string {
  const key = (properties.BEZEICHNUNG ?? '').trim()
  if (key === '') {
    throw new GrazParseError(String(properties.OBJECTID ?? '?'), 'Fläche ohne BEZEICHNUNG')
  }
  return key
}

/** Ob eine Fläche ein Straßenzug ist statt eines Gebiets. */
export function isGrazStreetwise(properties: GrazZoneProperties): boolean {
  return /^straßenzugsweise$/iu.test((properties.TYP ?? '').trim())
}

/**
 * Der Satz unter der Zone: Farbe, Gebietsname, Art — und bei der Grünen Zone
 * die Tickets, die der Stundensatz nicht ausdrückt.
 *
 * Bei Straßenzügen ist `NAME` nur eine Wiederholung des Typs („Straßenzugsweise
 * Kurzparkzone 180 min.") und fällt weg; bei Gebieten ist er der Ortsname.
 */
export function grazZoneNote(kind: GrazZoneKind, properties: GrazZoneProperties, tariff: GrazTariff): string {
  const name = (properties.NAME ?? '').replace(/\s+/g, ' ').trim()
  const streetwise = isGrazStreetwise(properties)
  const head = streetwise
    ? `${GRAZ_ZONE_KIND_LABEL[kind]}, straßenzugsweise`
    : `${GRAZ_ZONE_KIND_LABEL[kind]} ${name}, flächendeckend`.replace(/\s+,/, ',')
  const tickets = tariff.tickets.map((ticket) => `${ticket.label} ${formatEuro(ticket.cents)}`)
  return [head, ...tickets].join(' — ')
}

function formatEuro(amount: number): string {
  const euro = Math.floor(amount / 100)
  const cent = amount % 100
  return `${euro},${String(cent).padStart(2, '0')} €`
}
