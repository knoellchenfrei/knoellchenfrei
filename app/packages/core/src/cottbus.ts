/**
 * Der Cottbuser Feed-Dialekt.
 *
 * Der achte eigene Parser, nach derselben Regel wie die sieben davor: ein
 * Feed, ein Parser. Cottbus ist dabei der erste Fall, in dem die Quelle kein
 * WFS ist, sondern ein **ArcGIS FeatureServer** — und der erste, in dem die
 * Zeiten nicht als Satz kommen, sondern **strukturiert in sechs Feldern**.
 *
 * Zwei Ebenen im Ordner `FB32` (Fachbereich Ordnung und Sicherheit) des
 * Datenportals der Stadt, gemessen am 16. September 2026:
 *
 * - `Bewohnerparkzonen/FeatureServer/7` — **5** Polygone `Parkzone II` bis
 *   `Parkzone VI`, nur Name, Kürzel und Kontakt. Keine Zeit, keine Gebühr,
 *   keine Höchstparkdauer.
 * - `Parkscheinautomaten/FeatureServer/1` — **44** Punkte mit
 *   Bewirtschaftungszeit (`wt` = `Mo - Fr`, `wt_bew_beginn` = `08:00`,
 *   `wt_bew_ende` = `19:00`, `woende` = `Sa`, `09:00`–`15:00`; alle 44
 *   gleich), Tarifzone (`zone` = `Zone 1` 40-mal, `Zone 2` 4-mal), Betrag
 *   (`gebuehr` = 1 bzw. 0.5, als **Zahl** in Euro je Stunde) und
 *   Stellplatzzahlen. Keine Höchstparkdauer.
 *
 * Fixtures: `test/fixtures/cottbus-bewohnerparkzonen-2026-09-16.json` und
 * `test/fixtures/cottbus-parkscheinautomaten-2026-09-16.json`.
 *
 * ## Die Eigenheit, die alles bestimmt: Der Feed nennt den Stand von 2014
 *
 * Betrag **und** Zeit im Datensatz sind die der Parkgebührenordnung vom
 * 1. Januar 2014: 1,00 € je Stunde in Zone 1, 0,50 € in Zone 2, Montag bis
 * Freitag 08:00 bis **19:00** Uhr, Samstag 09:00 bis 15:00 Uhr. Seit dem
 * 1. Juni 2025 gilt eine neue Parkgebührenordnung (beschlossen von der
 * Stadtverordnetenversammlung am 26. Februar 2025): 2,00 € bzw. 1,00 € je
 * Stunde, Montag bis Freitag 08:00 bis **20:00** Uhr, Samstag 09:00 bis
 * 15:00 Uhr. Der Feed nennt also nicht nur den halben Betrag — das wäre der
 * Kölner Fall, ein „Tarif nicht angegeben" —, sondern **eine Stunde zu
 * wenig**: Wer ihm folgt, sagt um 19:30 Uhr „gebührenfrei", wo die Stadt
 * kassiert. Das ist der teuerste Fehler, den diese App machen kann.
 *
 * Deshalb steht die Ordnung hier als Konstante, mit Datum und Fundstelle,
 * und `cottbusTariffFor` entscheidet **gemessen**, was ausgeliefert wird:
 * Nennt der Feed die Werte von 2025, gilt der Feed. Nennt er die von 2014,
 * gilt die Ordnung und `sourceDefect` sagt es. Nennt er etwas Drittes, wirft
 * die Funktion — dann hat die Stadt etwas geändert, das niemand kennt, und
 * ein Mensch muss hinsehen, bevor die App etwas behauptet.
 */

import type { Weekday } from './berlin-time.js'
import type { Fee } from './parse-fee.js'
import type { ChargeWindow } from './tariff.js'

export class CottbusParseError extends Error {
  constructor(
    readonly raw: string,
    reason: string
  ) {
    super(`Cottbuser Feed: ${JSON.stringify(raw)} — ${reason}`)
    this.name = 'CottbusParseError'
  }
}

/**
 * Wie in den sieben anderen Parsern: fremde Eingabe wird zuerst begrenzt.
 *
 * Der längste Feldwert des Abzugs ist `Mo - Fr` mit sieben Zeichen; 40 lässt
 * Luft für `Montag bis Freitag` und ist weit von allem entfernt, was jemand
 * als Angriff einschleusen würde.
 */
const MAX_INPUT_LENGTH = 40

// ---------------------------------------------------------------- Wochentage

/** Sonntag ist 0, wie in `berlin-time.ts`. */
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
 * `Mo - Fr`, `Sa`, `Mo-Sa` — ein Kürzel oder zwei, mit Bindestrich.
 *
 * Ganz zu passen (`^…$`) ist hier die Wortgrenze auf beiden Seiten: Ein
 * `Mi` in „mit" oder ein `Fr` in „frei" kann gar nicht erst treffen, weil
 * jedes Zeichen daneben die ganze Angabe ungültig macht.
 */
const DAY_RANGE = /^([a-z]{2})(?:\s*-\s*([a-z]{2}))?$/

/**
 * Zerlegt `wt` bzw. `woende`.
 *
 * Ergebnis aufsteigend, auch wenn die Spanne über den Sonntag läuft
 * (`Sa - Mo` ergibt `[0, 1, 6]`). Eine Spanne, die rückwärts läuft und dabei
 * mehr als die Woche wäre, gibt es nicht — sieben Tage sind sieben Tage.
 */
export function parseCottbusDays(raw: string | null | undefined): readonly Weekday[] {
  if (raw === null || raw === undefined) {
    throw new CottbusParseError('', 'keine Tagesangabe')
  }
  if (raw.length > MAX_INPUT_LENGTH) {
    throw new CottbusParseError(raw.slice(0, 40), `${raw.length} Zeichen sind keine Tagesangabe`)
  }
  const text = raw.trim().replace(/\s+/g, ' ').toLowerCase()
  const match = DAY_RANGE.exec(text)
  if (match === null) throw new CottbusParseError(raw, 'keine erkennbare Tagesangabe')
  const from = DAY_NAMES[match[1] as string]
  if (from === undefined) throw new CottbusParseError(raw, `unbekannter Wochentag ${match[1]}`)
  if (match[2] === undefined) return [from]
  const to = DAY_NAMES[match[2]]
  if (to === undefined) throw new CottbusParseError(raw, `unbekannter Wochentag ${match[2]}`)

  const days: Weekday[] = []
  let day = from
  for (let step = 0; step < 7; step += 1) {
    days.push(day)
    if (day === to) break
    day = ((day + 1) % 7) as Weekday
  }
  return days.sort((a, b) => a - b)
}

// ---------------------------------------------------------------- Uhrzeiten

const CLOCK = /^(\d{1,2}):(\d{2})$/

/**
 * `08:00` → 480. Stunde 24 heißt Minute 1440, nie 0 — wie in Berlin und
 * Hamburg: „bis 24:00" auf 0 abzubilden löschte den ganzen Abend.
 */
export function parseCottbusTime(raw: string | null | undefined): number {
  if (raw === null || raw === undefined) throw new CottbusParseError('', 'keine Uhrzeit')
  if (raw.length > MAX_INPUT_LENGTH) {
    throw new CottbusParseError(raw.slice(0, 40), `${raw.length} Zeichen sind keine Uhrzeit`)
  }
  const match = CLOCK.exec(raw.trim())
  if (match === null) throw new CottbusParseError(raw, 'keine Uhrzeit der Form HH:MM')
  const hours = Number(match[1])
  const minutes = Number(match[2])
  if (minutes > 59) throw new CottbusParseError(raw, 'Minuten über 59')
  const total = hours * 60 + minutes
  if (total > 1440) throw new CottbusParseError(raw, 'jenseits von 24:00')
  return total
}

/**
 * Ein Fenster aus Tagen, Beginn und Ende — oder zwei, wenn es über
 * Mitternacht läuft (dann gehört der zweite Teil dem Folgetag). Der Abzug hat
 * kein solches Fenster; die Form ist trotzdem abgedeckt, weil ein Feed, der
 * Zeiten als Felder führt, sie jederzeit eintragen kann.
 */
function windowsOf(
  days: readonly Weekday[],
  from: number,
  to: number,
  raw: string
): ChargeWindow[] {
  if (from === to) throw new CottbusParseError(raw, 'Anfang und Ende sind gleich')
  if (from >= 1440) throw new CottbusParseError(raw, 'Beginn um 24:00 ist kein Beginn')
  if (to === 0) throw new CottbusParseError(raw, 'Ende um 00:00 ist kein Ende — 24:00 wäre Mitternacht')
  if (from < to) return [{ weekdays: days, fromMinute: from, toMinute: to }]
  return [
    { weekdays: days, fromMinute: from, toMinute: 1440 },
    {
      weekdays: days.map((day) => ((day + 1) % 7) as Weekday).sort((a, b) => a - b),
      fromMinute: 0,
      toMinute: to,
    },
  ]
}

/** Die sechs Zeitfelder eines Automaten, so wie der Feed sie führt. */
export interface CottbusScheduleFields {
  wt?: string | null
  wt_bew_beginn?: string | null
  wt_bew_ende?: string | null
  woende?: string | null
  woen_bew_beginn?: string | null
  woen_bew_ende?: string | null
}

const isBlank = (value: string | null | undefined): boolean =>
  value === null || value === undefined || value.trim() === ''

/**
 * Eine Dreiergruppe Tage/Beginn/Ende: entweder ganz leer (kein Fenster) oder
 * ganz gefüllt. Halb gefüllt ist ein Abbruch, kein „dann eben ohne" — ein
 * Automat mit Wochentagen und ohne Ende sagt etwas, das niemand lesen kann.
 */
function clause(
  days: string | null | undefined,
  from: string | null | undefined,
  to: string | null | undefined
): ChargeWindow[] {
  const blanks = [days, from, to].filter(isBlank).length
  if (blanks === 3) return []
  const raw = `${days ?? ''} ${from ?? ''}-${to ?? ''}`.trim()
  if (blanks > 0) throw new CottbusParseError(raw, 'Zeitangabe nur teilweise ausgefüllt')
  return windowsOf(parseCottbusDays(days), parseCottbusTime(from), parseCottbusTime(to), raw)
}

/**
 * Zerlegt die sechs Zeitfelder eines Automaten in Fenster.
 *
 * Leer heißt: Der Automat nennt keine Zeit — der Datenbau zählt das und
 * lässt ihn liegen. Ein leeres Ergebnis ist also kein „immer" und kein „nie",
 * sondern eine fehlende Auskunft.
 */
export function parseCottbusSchedule(fields: CottbusScheduleFields): ChargeWindow[] {
  return [
    ...clause(fields.wt, fields.wt_bew_beginn, fields.wt_bew_ende),
    ...clause(fields.woende, fields.woen_bew_beginn, fields.woen_bew_ende),
  ]
}

/** Der Rohtext eines Automaten, wie er im Panel unter „laut Quelle" stünde. */
export function cottbusScheduleText(fields: CottbusScheduleFields): string {
  const parts: string[] = []
  if (!isBlank(fields.wt)) {
    parts.push(`${fields.wt?.trim()} ${fields.wt_bew_beginn?.trim()}-${fields.wt_bew_ende?.trim()}`)
  }
  if (!isBlank(fields.woende)) {
    parts.push(
      `${fields.woende?.trim()} ${fields.woen_bew_beginn?.trim()}-${fields.woen_bew_ende?.trim()}`
    )
  }
  return parts.join('; ')
}

/** Doppelte Fenster zusammenlegen — 40 Automaten sagen dasselbe. */
export function mergeCottbusWindows(windows: readonly ChargeWindow[]): ChargeWindow[] {
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

// ------------------------------------------------------------------ Gebühr

/** Mehr als 100 € je Stunde nennt keine deutsche Stadt; darüber ist es ein Tippfehler. */
const MAX_CENTS_PER_HOUR = 10_000

/**
 * Zerlegt `gebuehr` — **eine Zahl** in Euro je Stunde, kein Text.
 *
 * Der Feed schreibt `1` und `0.5`; das Nachbarfeld `mind_gebuehr` zeigt mit
 * `0.200000003`, dass die Werte als Fließkommazahl einfacher Genauigkeit
 * gespeichert sind. Deshalb wird auf ganze Cent gerundet, statt die Zahl zu
 * glauben. Eine Zeichenkette mit Dezimalpunkt geht ebenfalls durch — für den
 * Fall, dass der Feldtyp eines Tages kippt, so wie Frankfurts
 * `bewohnerparkzone` von der Zeichenkette zur Zahl gekippt ist.
 *
 * Null ist ein Abbruch, kein Tarif: Was ein Nullbetrag im Feed bedeutete,
 * weiß niemand, und „kostenlos" ist die eine Lesart, die er nicht verdient.
 */
export function parseCottbusFee(raw: number | string | null | undefined): Fee {
  if (raw === null || raw === undefined) return { kind: 'unknown' }
  let value: number
  if (typeof raw === 'number') {
    value = raw
  } else {
    if (raw.length > MAX_INPUT_LENGTH) {
      throw new CottbusParseError(raw.slice(0, 40), `${raw.length} Zeichen sind kein Betrag`)
    }
    const text = raw.trim()
    if (text === '') return { kind: 'unknown' }
    if (!/^\d{1,4}(?:\.\d{1,6})?$/.test(text)) {
      throw new CottbusParseError(raw, 'kein Betrag in Euro je Stunde')
    }
    value = Number(text)
  }
  if (!Number.isFinite(value)) throw new CottbusParseError(String(raw), 'keine endliche Zahl')
  const centsPerHour = Math.round(value * 100)
  if (centsPerHour <= 0) throw new CottbusParseError(String(raw), 'ein Betrag von 0 € ist kein Tarif')
  if (centsPerHour > MAX_CENTS_PER_HOUR) {
    throw new CottbusParseError(String(raw), 'mehr als 100 € je Stunde ist kein Tarif')
  }
  return { kind: 'exact', centsPerHour }
}

// --------------------------------------------------------------- Tarifzone

/** Die zwei Tarifzonen der Parkgebührenordnung: 1 Innenstadt, 2 der Rest. */
export type CottbusTariffZone = 1 | 2

const TARIFF_ZONE = /^zone\s*([12])$/

/** `Zone 1` → 1. Alles andere ist ein Abbruch — eine dritte Zone gibt es nicht. */
export function parseCottbusTariffZone(raw: string | null | undefined): CottbusTariffZone {
  if (raw === null || raw === undefined) throw new CottbusParseError('', 'keine Tarifzone')
  if (raw.length > MAX_INPUT_LENGTH) {
    throw new CottbusParseError(raw.slice(0, 40), `${raw.length} Zeichen sind keine Tarifzone`)
  }
  const match = TARIFF_ZONE.exec(raw.trim().replace(/\s+/g, ' ').toLowerCase())
  if (match === null) throw new CottbusParseError(raw, 'keine Tarifzone der Form „Zone 1"')
  return Number(match[1]) as CottbusTariffZone
}

// ------------------------------------------------- die Parkgebührenordnung

const MO_FR: readonly Weekday[] = [1, 2, 3, 4, 5]
const SA: readonly Weekday[] = [6]

export interface CottbusOrdinanceZone {
  centsPerHour: number
  /** Mindestgebühr in Cent, danach in 0,10-€-Schritten (§ 3 Abs. 1). */
  minimumCents: number
}

/**
 * Die Parkgebührenordnung der Stadt Cottbus/Chóśebuz, in Kraft seit dem
 * 1. Juni 2025 — abgeschrieben aus dem amtlichen Text, nicht aus einer
 * Pressemeldung.
 *
 * Fundstelle: <https://cottbus.de/download/23796/fachbereich-32-ordnung-und-sicherheit/165743/parkgebuehrenordnung-2025.pdf>
 * (verlinkt von <https://cottbus.de/wpfd_file/parkgebuehrenordnung-2025/>),
 * abgerufen am 16. September 2026. § 3 Abs. 1 wörtlich: „Die Höhe der
 * Parkgebühren in der Stadt Cottbus/Chóśebuz beträgt von Montag bis Freitag
 * in der Zeit von 08:00 - 20:00 Uhr, Samstag in der Zeit von 09:00 - 15:00
 * Uhr in Zone 1: Parkgebühr: 1 Stunde = 2,00 € Mindestgebühr: 0,50 €,
 * danach Erhöhung in 0,10 €-Schritten, in Zone 2: Parkgebühr: 1 Stunde =
 * 1,00 € Mindestgebühr: 0,20 €, danach Erhöhung in 0,10 €-Schritten."
 * § 4: „Diese Gebührenordnung tritt am 01.06.2025 in Kraft; gleichzeitig
 * tritt die Parkgebührenordnung vom 01.01.2014 außer Kraft."
 *
 * § 3 Abs. 2 behält der Stadt vor, „zu Zeiten von Großveranstaltungen, wie
 * dem Stadtfest oder dem Weihnachtsmarkt, von Montag bis Sonntag in der Zeit
 * von 08:00 - 20:00 Uhr" in Zone 1 zu kassieren — eine Regel ohne Kalender,
 * wie Berlins Adventssamstage; sie steht als `unmodelledRules` an der Zone.
 * § 3 Abs. 5: Die Höchstparkdauer „kann … individuell festgelegt werden. Die
 * Angaben an den jeweiligen Parkscheinautomaten sind hierbei zu beachten."
 * — der Feed führt sie nicht, also führt die App sie auch nicht.
 */
export const COTTBUS_ORDINANCE = {
  validFrom: '2025-06-01',
  decidedOn: '2025-02-26',
  url: 'https://cottbus.de/download/23796/fachbereich-32-ordnung-und-sicherheit/165743/parkgebuehrenordnung-2025.pdf',
  windows: [
    { weekdays: MO_FR, fromMinute: 8 * 60, toMinute: 20 * 60 },
    { weekdays: SA, fromMinute: 9 * 60, toMinute: 15 * 60 },
  ] as readonly ChargeWindow[],
  scheduleText: 'Mo–Fr 08:00–20:00 Uhr, Sa 09:00–15:00 Uhr',
  zones: {
    1: { centsPerHour: 200, minimumCents: 50 },
    2: { centsPerHour: 100, minimumCents: 20 },
  } as Readonly<Record<CottbusTariffZone, CottbusOrdinanceZone>>,
  /** § 3 Abs. 2, wörtlich genug, dass das Panel ihn nennen kann. */
  eventRule:
    'Bei Großveranstaltungen wie Stadtfest oder Weihnachtsmarkt kann die Stadt in Zone 1 ' +
    'Montag bis Sonntag 08:00–20:00 Uhr kassieren (§ 3 Abs. 2 Parkgebührenordnung)',
} as const

/**
 * Was der Feed am 16. September 2026 nennt: die Ordnung vom 1. Januar 2014.
 *
 * Belegt über den Beschlussbericht zur damaligen Änderung („Eine Anpassung
 * der Bewirtschaftungszeiten von Montag bis Freitag in der Zeit von 08:00 bis
 * 19:00 Uhr … und Samstag in der Zeit von 09:00 bis 15:00 Uhr", „Erhöhung auf
 * 1,00 Euro pro Stunde", Bahnhof „mit dem Gebührentarif der Zone 2";
 * Niederlausitz aktuell, abgerufen am 16. September 2026) und über die
 * Mitteilung der Stadt vom 21. Mai 2025, die genau diese Beträge als die
 * „bisherigen" nennt. Der Feed nennt exakt diese Werte — nicht ungefähr.
 */
export const COTTBUS_FEED_2014 = {
  windows: [
    { weekdays: MO_FR, fromMinute: 8 * 60, toMinute: 19 * 60 },
    { weekdays: SA, fromMinute: 9 * 60, toMinute: 15 * 60 },
  ] as readonly ChargeWindow[],
  centsPerHour: { 1: 100, 2: 50 } as Readonly<Record<CottbusTariffZone, number>>,
} as const

const windowKey = (window: ChargeWindow): string =>
  `${[...window.weekdays].join(',')}|${window.fromMinute}|${window.toMinute}`

function sameWindows(a: readonly ChargeWindow[], b: readonly ChargeWindow[]): boolean {
  const left = [...a].map(windowKey).sort()
  const right = [...b].map(windowKey).sort()
  return left.length === right.length && left.every((key, index) => key === right[index])
}

export interface CottbusTariff {
  fee: Fee
  windows: ChargeWindow[]
  /** Was das Panel unter „Zeiten laut Quelle" zeigt. */
  rawHours: string
  rawFee: string
  /** Gesetzt, wenn der Feed den Stand von 2014 nennt und die Ordnung gilt. */
  sourceDefect: string | null
  unmodelledRules: string[]
}

const euro = (cents: number): string => `${(cents / 100).toFixed(2).replace('.', ',')} €`

/**
 * Entscheidet, was für eine Tarifzone ausgeliefert wird — gemessen am Feed.
 *
 * Drei Ausgänge, und der dritte ist Absicht:
 *
 * 1. **Der Feed nennt die Ordnung von 2025.** Dann gilt er, ohne Vermerk;
 *    der Tag, an dem die Stadt ihren Datensatz nachzieht, macht diesen Zweig
 *    zum Normalfall.
 * 2. **Der Feed nennt exakt den Stand von 2014.** Dann gilt die Ordnung, und
 *    `sourceDefect` sagt, warum nicht der Feed — Köln hält es genauso, nur
 *    dass dort kein Betrag gezeigt wird, weil dort keine amtliche Ordnung
 *    mit Betrag je Zone vorlag.
 * 3. **Der Feed nennt etwas Drittes.** Dann wirft die Funktion. Ein Feed,
 *    der von beiden bekannten Ständen abweicht, hat sich geändert, und ob
 *    die neue Zahl eine dritte Ordnung oder ein Tippfehler ist, weiß nur ein
 *    Mensch. Still die Ordnung von 2025 zu nehmen hiesse, eine Änderung der
 *    Stadt zu übersehen; still den Feed zu nehmen hiesse, einen Tippfehler
 *    auszuliefern.
 */
export function cottbusTariffFor(
  tariffZone: CottbusTariffZone,
  feedFee: Fee,
  feedWindows: readonly ChargeWindow[],
  feedScheduleText: string
): CottbusTariff {
  const ordinance = COTTBUS_ORDINANCE.zones[tariffZone]
  const feedCents = feedFee.kind === 'exact' ? feedFee.centsPerHour : null
  const unmodelledRules = tariffZone === 1 ? [COTTBUS_ORDINANCE.eventRule] : []

  const feedIsCurrent =
    feedCents === ordinance.centsPerHour && sameWindows(feedWindows, COTTBUS_ORDINANCE.windows)
  if (feedIsCurrent) {
    return {
      fee: { kind: 'exact', centsPerHour: ordinance.centsPerHour },
      windows: [...COTTBUS_ORDINANCE.windows],
      rawHours: feedScheduleText,
      rawFee: `${euro(ordinance.centsPerHour)} je Stunde (Zone ${tariffZone})`,
      sourceDefect: null,
      unmodelledRules,
    }
  }

  const feedIs2014 =
    feedCents === COTTBUS_FEED_2014.centsPerHour[tariffZone] &&
    sameWindows(feedWindows, COTTBUS_FEED_2014.windows)
  if (!feedIs2014) {
    throw new CottbusParseError(
      `Zone ${tariffZone}: ${feedScheduleText}, ${feedCents === null ? 'kein Betrag' : euro(feedCents)}`,
      'weder der Stand von 2014 noch die Ordnung von 2025 — die Stadt hat etwas geändert, ' +
        'das in cottbus.ts nicht bekannt ist; erst nachsehen, dann eintragen'
    )
  }

  return {
    fee: { kind: 'exact', centsPerHour: ordinance.centsPerHour },
    windows: [...COTTBUS_ORDINANCE.windows],
    rawHours: `${COTTBUS_ORDINANCE.scheduleText} (Parkgebührenordnung vom 1. Juni 2025; der Datensatz der Stadt nennt noch ${feedScheduleText})`,
    rawFee: `${euro(ordinance.centsPerHour)} je Stunde (Zone ${tariffZone} der Parkgebührenordnung vom 1. Juni 2025; der Datensatz nennt noch ${euro(COTTBUS_FEED_2014.centsPerHour[tariffZone])})`,
    sourceDefect:
      'der Datensatz der Stadt nennt noch die Parkgebührenordnung von 2014 — ' +
      `${euro(COTTBUS_FEED_2014.centsPerHour[tariffZone])} je Stunde und Montag bis Freitag nur bis 19:00 Uhr. ` +
      'Gezeigt wird die seit dem 1. Juni 2025 geltende Ordnung: ' +
      `${euro(ordinance.centsPerHour)} je Stunde, ${COTTBUS_ORDINANCE.scheduleText}`,
    unmodelledRules,
  }
}

// ---------------------------------------------------------------- Rohzeilen

/** Rohzeile der Ebene `Bewohnerparkzonen`, so weit wir sie lesen. */
export interface CottbusZoneProperties {
  OBJECTID?: number | null
  /** `Parkzone II` … `Parkzone VI`. */
  name?: string | null
  /** `Z2` … `Z6`. */
  bem?: string | null
  tel?: string | null
  mail?: string | null
  url?: string | null
  ansprechpa?: string | null
  gis_id_ort?: string | null
  geaendert_am?: number | string | null
  GlobalID?: string | null
  Shape__Area?: number | null
  Shape__Length?: number | null
}

/** Rohzeile der Ebene `Parkscheinautomaten`, so weit wir sie lesen. */
export interface CottbusAutomatProperties extends CottbusScheduleFields {
  OBJECTID?: number | null
  /** Steht im GeoJSON an jedem Automaten und ist immer `null` — die Layer-Beschreibung kennt das Feld nicht. */
  SHAPE?: null
  standort?: string | null
  naehe_bezeich?: string | null
  pkw?: number | null
  behin_stellpl?: number | null
  krad?: number | null
  /** `Zone 1` / `Zone 2` — die Tarifzone der Parkgebührenordnung. */
  zone?: string | null
  mind_gebuehr?: number | null
  /** Euro je Stunde, als Zahl. */
  gebuehr?: number | null
  id_postleitzahl?: string | null
  id_ort?: string | null
  id_stadtgebiete?: string | null
  id_ortsteile?: string | null
  id_bezirke?: string | null
  bloecke?: string | null
  pk_psa?: number | null
  lfd__Nr_?: number | null
}

const ZONE_NAME = /^parkzone\s+([ivx]{1,4})$/

/**
 * Der Schlüssel einer Bewohnerparkzone: die römische Zahl aus `Parkzone II`.
 *
 * Nicht `bem` (`Z2`), obwohl das kürzer wäre: Auf den Schildern und im
 * Antrag der Stadt heißt die Zone „Parkzone II", und der Schlüssel steht im
 * Panel, in der Suche und in jeder Meldung. Alles, was nicht dieser Form
 * folgt, wirft — ein stiller Rückfall auf `OBJECTID` sähe aus wie eine Zone
 * und wäre eine Zahl, die niemand auf einem Schild wiederfindet.
 */
export function cottbusZoneKey(properties: CottbusZoneProperties): string {
  const raw = (properties.name ?? '').replace(/\s+/g, ' ').trim()
  if (raw.length > MAX_INPUT_LENGTH) {
    throw new CottbusParseError(raw.slice(0, 40), `${raw.length} Zeichen sind kein Zonenname`)
  }
  const match = ZONE_NAME.exec(raw.toLowerCase())
  if (match === null) throw new CottbusParseError(raw, 'kein Zonenname der Form „Parkzone II"')
  return (match[1] as string).toUpperCase()
}

/** Was die Quelle über die Zone sonst noch sagt — für das Panel. */
export function cottbusZoneNote(
  properties: CottbusZoneProperties,
  tariffZone: CottbusTariffZone
): string {
  const kuerzel = (properties.bem ?? '').trim()
  const where = tariffZone === 1 ? 'Innenstadt' : 'außerhalb der Innenstadt'
  return `Bewohnerparkzone${kuerzel === '' ? '' : ` ${kuerzel}`} — Tarifzone ${tariffZone} (${where}) der Parkgebührenordnung`
}
