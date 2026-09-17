/**
 * Der Innsbrucker Feed-Dialekt.
 *
 * Datensatz: `Parkzonen_WGS84` im ArcGIS Online der Stadt Innsbruck
 * (geoHub Innsbruck, Eigentümer `geoHub_Innsbruck`, Organisation
 * „Stadtmagistrat Innsbruck"), 21 Polygone, abgerufen am 16. September 2026.
 * Fixture: `test/fixtures/ibk-parkzonen-2026-09-16.json`.
 *
 * Was dieser Feed anders macht als die sieben Städte davor: **Alles steht in
 * einem Freitextfeld.** `INFO` trägt Zeiten, Betrag, Tagesdeckel und den
 * Tarifsprung ab der vierten Stunde in einem Satz; `BEZEICH` trägt die
 * Höchstparkdauer als Teil einer Bezeichnung („Kurzparkzone 180 min
 * kostenpflichtig"). Ein eigenes Zeit- oder Gebührenfeld gibt es nicht. Und
 * die Beträge stehen mit **Dezimalpunkt** (`EUR 1.10`), nicht mit Komma —
 * `parse-fee.ts` läse „1.10" als Tausendertrennung oder gar nicht.
 *
 * Drei Dinge, die nur hier vorkommen:
 *
 *  1. **„werktags" ist hier ausdrücklich Mo–Fr.** Der Feed schreibt
 *     `werktags Mo-Fr`, und die Stadt sagt es auf ihrer Seite genauso
 *     („von Montag bis Freitag von 9.00 bis 19.00 Uhr kostenpflichtig").
 *     Hamburgs Lesart „werktags = Mo–Sa" wäre hier falsch; ein nacktes
 *     `werktags` ohne Tagesspanne weist der Parser deshalb ab, statt eine der
 *     beiden Lesarten zu raten.
 *  2. **Der Betrag gilt je halbe Stunde**, nicht je Stunde: „EUR 1.10 erste
 *     halbe Stunde, danach gleicher Tarif in EUR 0.10 - Schritten" heißt
 *     2,20 € je Stunde. Ein Parkplatz (Waldparkplatz) springt ab der vierten
 *     Stunde von 0,50 auf 1,00 € je halbe Stunde — das ist die einzige
 *     Spanne.
 *  3. **Eine Saisonregel.** Die Zone am Tivoli kassiert „täglich (1.5. bis
 *     31.8.) bzw. werktags Mo-Fr (1.9. bis 30.4.)". `ChargeWindow` kennt
 *     keinen Kalender; der Parser nimmt die Vereinigung der Tage (täglich)
 *     und legt die Klausel wörtlich in `unmodelledRules`. Die Richtung ist
 *     bewusst: Im Winter am Wochenende „kostet" zu sagen, wo es frei ist,
 *     kostet niemanden ein Knöllchen — die andere Lesart täte das im Sommer.
 *
 * Der Stand ist befristet: Die Stadt hat am 16. Juli 2026 eine neue
 * Parkabgabeverordnung beschlossen, ab **2. November 2026** gelten neue
 * Zeiten (Mo–Fr 8–21, Sa 8–18) und drei neue Parkstraßen. Der Feed trägt
 * heute noch den alten Stand; `docs/staedte-innsbruck.md` hält fest, was
 * dann zu prüfen ist.
 */

import type { Weekday } from './berlin-time.js'
import type { Fee } from './parse-fee.js'
import type { ChargeWindow } from './tariff.js'

export class InnsbruckParseError extends Error {
  constructor(
    readonly raw: string,
    reason: string
  ) {
    super(`Innsbrucker Feed: ${JSON.stringify(raw)} — ${reason}`)
    this.name = 'InnsbruckParseError'
  }
}

/**
 * Der längste `INFO`-Text des Abzugs hat 233 Zeichen — mehr als jede andere
 * Stadt, weil hier alles in einem Feld steht. 300 lässt Luft für einen
 * weiteren Nebensatz und hält trotzdem Unfug draußen.
 */
const MAX_INPUT_LENGTH = 300

const ALL_DAYS: readonly Weekday[] = [0, 1, 2, 3, 4, 5, 6]
const MO_FR: readonly Weekday[] = [1, 2, 3, 4, 5]
const MO_SA: readonly Weekday[] = [1, 2, 3, 4, 5, 6]

/**
 * Tagesangaben des Feeds, klein geschrieben.
 *
 * `werktags` steht absichtlich **nur mit** Spanne: `werktags Mo-Fr` ist die
 * Schreibweise des Feeds. Ein `werktags` allein wäre in Deutschland Mo–Sa und
 * in diesem Feed Mo–Fr — der Parser soll das nicht entscheiden.
 */
const DAY_SPECS: Record<string, readonly Weekday[]> = {
  täglich: ALL_DAYS,
  'werktags mo-fr': MO_FR,
  'mo-fr': MO_FR,
  'mo-sa': MO_SA,
  sa: [6],
  so: [0],
}

/** Einen Wochentag um einen Tag weiterdrehen, für Fenster über Mitternacht. */
function nextDay(day: Weekday): Weekday {
  return ((day + 1) % 7) as Weekday
}

function guardLength(raw: string, what: string): string {
  if (raw.length > MAX_INPUT_LENGTH) {
    throw new InnsbruckParseError(raw.slice(0, 40), `${raw.length} Zeichen sind keine ${what}`)
  }
  return raw.trim().replace(/\s+/g, ' ')
}

export interface InnsbruckSchedule {
  windows: ChargeWindow[]
  /** Klauseln mit Saisonangabe, wörtlich — das Modell hat keinen Kalender. */
  unmodelledRules: string[]
}

/** `9-19`, `9:30-13:00` — Minuten sind im Abzug nie da, der Parser nimmt sie trotzdem. */
const CLAUSE =
  /^(?<days>.+?) von (?<fromH>\d{1,2})(?::(?<fromM>\d{2}))?\s*-\s*(?<toH>\d{1,2})(?::(?<toM>\d{2}))? Uhr$/u

/** Eine Tagesangabe, optional mit Saison: `täglich (1.5. bis 31.8.)`. */
const DAY_ALTERNATIVE = /^(?<spec>[\p{L}][\p{L} -]*?)(?: \((?<from>\d{1,2}\.\d{1,2}\.) bis (?<to>\d{1,2}\.\d{1,2}\.)\))?$/u

function assertDayMonth(raw: string, date: string): void {
  const [day, month] = date.split('.').map(Number)
  if (!(day !== undefined && month !== undefined && day >= 1 && day <= 31 && month >= 1 && month <= 12)) {
    throw new InnsbruckParseError(raw, `${date} ist kein Datum der Form T.M.`)
  }
}

/**
 * Zerlegt den Zeitteil von `INFO` — alles vor dem ersten Betrag.
 *
 * Vier Schreibweisen im Abzug, alle nach demselben Muster: eine oder zwei
 * Klauseln mit „und" verbunden, jede aus Tagesangabe, „von", Stundenspanne,
 * „Uhr". Die Tagesangabe darf mit „bzw." zwei Alternativen mit Saison
 * nennen; dann zählen alle Tage beider Alternativen und die Klausel landet
 * wörtlich in `unmodelledRules`.
 */
export function parseInnsbruckSchedule(raw: string): InnsbruckSchedule {
  const text = guardLength(raw, 'Zeitangabe')
  if (text === '') throw new InnsbruckParseError(raw, 'leer')

  const windows: ChargeWindow[] = []
  const unmodelledRules: string[] = []

  for (const clause of text.split(/ und /u)) {
    const match = CLAUSE.exec(clause)
    if (match?.groups === undefined) {
      throw new InnsbruckParseError(raw, `keine erkennbare Tag-und-Stunden-Angabe in "${clause}"`)
    }
    const { days, fromH, fromM, toH, toM } = match.groups as Record<string, string | undefined>

    const weekdays = new Set<Weekday>()
    let seasonal = false
    for (const alternative of (days as string).split(/ bzw\. /u)) {
      const alt = DAY_ALTERNATIVE.exec(alternative)
      if (alt?.groups === undefined) {
        throw new InnsbruckParseError(raw, `unlesbare Tagesangabe "${alternative}"`)
      }
      const spec = (alt.groups['spec'] as string).toLowerCase()
      const known = DAY_SPECS[spec]
      if (known === undefined) {
        throw new InnsbruckParseError(
          raw,
          spec === 'werktags'
            ? 'werktags ohne Tagesspanne — der Feed schreibt "werktags Mo-Fr", und Mo-Sa wäre die andere Lesart'
            : `unbekannte Tagesangabe "${alt.groups['spec']}"`
        )
      }
      for (const day of known) weekdays.add(day)
      if (alt.groups['from'] !== undefined && alt.groups['to'] !== undefined) {
        assertDayMonth(raw, alt.groups['from'])
        assertDayMonth(raw, alt.groups['to'])
        seasonal = true
      }
    }
    if (seasonal) unmodelledRules.push(clause)

    if (Number(fromM ?? 0) > 59 || Number(toM ?? 0) > 59) {
      throw new InnsbruckParseError(raw, 'Minuten über 59')
    }
    const from = Number(fromH) * 60 + Number(fromM ?? 0)
    const to = Number(toH) * 60 + Number(toM ?? 0)
    // Wie überall: Stunde 24 ist Minute 1440, nie 0.
    if (!(from >= 0 && from < 1440 && to > 0 && to <= 1440)) {
      throw new InnsbruckParseError(raw, `unplausible Spanne ${fromH}-${toH}`)
    }
    if (from === to) throw new InnsbruckParseError(raw, 'Anfang und Ende sind gleich')

    const sorted = [...weekdays].sort((a, b) => a - b)
    if (from < to) {
      windows.push({ weekdays: sorted, fromMinute: from, toMinute: to })
    } else {
      // Über Mitternacht — kommt im Abzug nicht vor, aber Hamburg hat es, und
      // ein Fenster mit from > to hiesse in `windowCovers` schlicht „nie".
      windows.push({ weekdays: sorted, fromMinute: from, toMinute: 1440 })
      windows.push({ weekdays: sorted.map(nextDay), fromMinute: 0, toMinute: to })
    }
  }

  return { windows, unmodelledRules }
}

/** Der Betrag des Feeds: `EUR 1.10`, `EUR 9`, `EUR 0.50` — Dezimalpunkt, nie Komma. */
const AMOUNT = String.raw`EUR (\d{1,3}(?:\.\d{1,2})?)`

function cents(raw: string, amount: string): number {
  const value = Math.round(Number(amount) * 100)
  if (!Number.isInteger(value) || value < 0) throw new InnsbruckParseError(raw, `${amount} ist kein Betrag`)
  // Dieselbe Regel wie in jedem anderen Gebührenparser: Was ein Nullbetrag
  // bedeutete, weiß niemand, und „kostenlos" ist die eine Lesart, die er
  // sicher nicht verdient. Der Feed hat für kostenlos das Wort „kostenfrei".
  if (value === 0) throw new InnsbruckParseError(raw, 'ein Betrag von 0 € ist kein Tarif')
  return value
}

export interface InnsbruckTariff {
  fee: Fee
  /** „jedoch höchstens EUR 9 pro Kalendertag" — das Modell hat keinen Deckel, der Hinweis schon. */
  dailyCapCents?: number
  /** „ab 4. Stunde EUR 1 je halbe Stunde" — ab welcher Stunde der höhere Satz gilt. */
  higherFromHour?: number
}

/**
 * Die Bausteine des Gebührenteils, jeder am Anfang des Rests verankert.
 *
 * Der Text wird Stück für Stück abgetragen, nicht an Kommas zerschnitten: Der
 * Nebensatz „(auch dann, wenn Parkvorgang über abgabenfreie Zeit hinaus
 * fortgesetzt wird)" trägt selbst ein Komma. Bleibt am Ende etwas übrig, das
 * kein Baustein ist, wirft der Parser — eine neue Formulierung im Feed soll
 * auffallen, nicht stillschweigend als Nebensatz durchgehen.
 */
const FIRST_HALF_HOUR = new RegExp(String.raw`^${AMOUNT} erste halbe Stunde`, 'u')
const SAME_RATE_IN_STEPS = new RegExp(String.raw`^danach gleicher Tarif in ${AMOUNT} - Schritten`, 'u')
const DAILY_CAP = new RegExp(String.raw`^jedoch höchstens ${AMOUNT} pro Kalendertag`, 'u')
const HIGHER_RATE = new RegExp(
  String.raw`^ab (\d{1,2})\. Stunde ${AMOUNT} je halbe Stunde in ${AMOUNT} - Schritten` +
    String.raw`(?: \(auch dann, wenn Parkvorgang über abgabenfreie Zeit hinaus fortgesetzt wird\))?`,
  'u'
)

/**
 * Zerlegt den Gebührenteil von `INFO` — alles ab dem ersten Betrag.
 *
 * „kostenfrei" ist **keine** Gebühr von null: Es sind die beiden
 * Kurzparkzonen „kostenfrei 180 min 1-5 Uhr", in denen nachts die
 * Höchstparkdauer gilt und die Ankunft nach § 1 der
 * Kurzparkzonen-Überwachungsverordnung (BGBl. Nr. 857/1994) mit Parkscheibe
 * nachzuweisen ist — Hamburgs `disc`, mit derselben Begründung.
 */
export function parseInnsbruckTariff(raw: string): InnsbruckTariff {
  const text = guardLength(raw, 'Gebühr')
  if (/^kostenfrei$/iu.test(text)) return { fee: { kind: 'disc' } }

  const first = FIRST_HALF_HOUR.exec(text)
  if (first === null) throw new InnsbruckParseError(raw, 'kein Betrag für die erste halbe Stunde')
  const base = cents(raw, first[1] as string) * 2

  let rest = text.slice(first[0].length)
  let dailyCapCents: number | undefined
  let higher: { fromHour: number; centsPerHour: number } | undefined
  while (rest !== '') {
    rest = rest.replace(/^,?\s*/u, '')
    if (rest === '') break
    let match: RegExpExecArray | null
    if ((match = SAME_RATE_IN_STEPS.exec(rest)) !== null) {
      cents(raw, match[1] as string)
    } else if ((match = DAILY_CAP.exec(rest)) !== null) {
      dailyCapCents = cents(raw, match[1] as string)
    } else if ((match = HIGHER_RATE.exec(rest)) !== null) {
      const fromHour = Number(match[1])
      if (fromHour < 2) throw new InnsbruckParseError(raw, `Tarifsprung ab Stunde ${fromHour} ergibt keinen Sinn`)
      higher = { fromHour, centsPerHour: cents(raw, match[2] as string) * 2 }
      cents(raw, match[3] as string)
    } else {
      throw new InnsbruckParseError(raw, `unbekannter Gebührenbaustein "${rest.slice(0, 40)}"`)
    }
    rest = rest.slice(match[0].length)
  }

  let fee: Fee
  if (higher === undefined || higher.centsPerHour === base) {
    fee = { kind: 'exact', centsPerHour: base }
  } else {
    fee = {
      kind: 'range',
      minCentsPerHour: Math.min(base, higher.centsPerHour),
      maxCentsPerHour: Math.max(base, higher.centsPerHour),
    }
  }
  return {
    fee,
    ...(dailyCapCents === undefined ? {} : { dailyCapCents }),
    ...(higher === undefined ? {} : { higherFromHour: higher.fromHour }),
  }
}

/** Nur der Betrag — für die Listen in `fuzz.test.ts` und für Aufrufer, die den Rest nicht brauchen. */
export function parseInnsbruckFee(raw: string): Fee {
  return parseInnsbruckTariff(raw).fee
}

export interface InnsbruckInfo extends InnsbruckSchedule, InnsbruckTariff {
  /** Der Zeitteil, wörtlich — für `rawHours`. */
  rawHours: string
  /** Der Gebührenteil, wörtlich — für `rawFee`. */
  rawFee: string
}

/** Zeitteil und Gebührenteil trennt das Komma nach „Uhr". */
const SPLIT = /^(?<hours>.+? Uhr), (?<fee>.+)$/u

/**
 * Zerlegt das ganze `INFO`-Feld.
 *
 * Der Schnitt liegt am ersten Komma nach „Uhr": Davor stehen die Zeiten,
 * dahinter der Betrag oder „kostenfrei". Ein Feld ohne Zeiten oder ohne
 * Gebührenteil wirft — beides kommt im Abzug nicht vor, und ein Gebiet, das
 * nur eines von beiden nennt, wäre keine Antwort auf die Frage der App.
 */
export function parseInnsbruckInfo(raw: string): InnsbruckInfo {
  const text = guardLength(raw, 'Zonenbeschreibung')
  const match = SPLIT.exec(text)
  if (match?.groups === undefined) {
    throw new InnsbruckParseError(raw, 'kein Komma nach "Uhr" — Zeiten und Gebühr sind nicht zu trennen')
  }
  const rawHours = match.groups['hours'] as string
  const rawFee = match.groups['fee'] as string
  return {
    ...parseInnsbruckSchedule(rawHours),
    ...parseInnsbruckTariff(rawFee),
    rawHours,
    rawFee,
  }
}

/** Eine Höchstparkdauer über einem Tag wäre keine Kurzparkzone mehr. */
const MAX_STAY_LIMIT = 1440

/**
 * Liest die Höchstparkdauer aus `BEZEICH`: „Kurzparkzone 180 min
 * kostenpflichtig" → 180. Parkstraßen nennen keine — dort darf man stehen,
 * solange man zahlt; das ist `undefined`, nicht 0.
 */
export function parseInnsbruckMaxStay(raw: string | null | undefined): number | undefined {
  if (raw === null || raw === undefined) return undefined
  const text = guardLength(raw, 'Bezeichnung')
  const match = /(\d{1,4}) min(?![\p{L}])/u.exec(text)
  if (match === null) {
    if (/\bmin(?![\p{L}])/u.test(text)) throw new InnsbruckParseError(raw, '"min" ohne Zahl davor')
    return undefined
  }
  const minutes = Number(match[1])
  if (minutes === 0) throw new InnsbruckParseError(raw, '0 Minuten hiesse Parken verboten — das steht dort nicht')
  if (minutes > MAX_STAY_LIMIT) throw new InnsbruckParseError(raw, `${minutes} Minuten sind keine Kurzparkzone`)
  return minutes
}

/** Rohzeile des Feeds, so weit wir sie lesen. */
export interface InnsbruckZoneProperties {
  /** Laufende Nummer der Quelle — der einzige Schlüssel, den der Feed hat. */
  FID?: number | null
  /** Art und Höchstparkdauer: „Kurzparkzone 180 min kostenpflichtig", „Parkstraße kostenpflichtig (werktags)". */
  BEZEICH?: string | null
  /** Zeiten, Betrag, Deckel, Tarifsprung — alles in einem Satz. */
  INFO?: string | null
  Shape__Area?: number | null
  Shape__Length?: number | null
}

function euro(centsValue: number): string {
  return `${(centsValue / 100).toFixed(2).replace('.', ',')} €`
}

/**
 * Was die Oberfläche zu dieser Zone sonst noch sagen soll: die Bezeichnung
 * der Quelle, dazu Deckel und Tarifsprung, die das Gebührenmodell nicht
 * ausdrückt. „höchstens 9,00 € je Kalendertag" ist für den, der den ganzen
 * Tag steht, die Hälfte der Antwort.
 */
export function innsbruckZoneNote(properties: InnsbruckZoneProperties, tariff: InnsbruckTariff): string | null {
  const parts: string[] = []
  const label = (properties.BEZEICH ?? '').replace(/\s+/g, ' ').trim()
  if (label !== '') parts.push(label)
  if (tariff.dailyCapCents !== undefined) parts.push(`höchstens ${euro(tariff.dailyCapCents)} je Kalendertag`)
  if (tariff.higherFromHour !== undefined && tariff.fee.kind === 'range') {
    parts.push(
      `bis zur ${tariff.higherFromHour - 1}. Stunde ${euro(tariff.fee.minCentsPerHour)}/h, ` +
        `ab der ${tariff.higherFromHour}. Stunde ${euro(tariff.fee.maxCentsPerHour)}/h`
    )
  }
  return parts.length === 0 ? null : parts.join(' — ')
}
