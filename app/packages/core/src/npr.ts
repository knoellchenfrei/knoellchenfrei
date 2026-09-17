/**
 * Der Dialekt des Nationaal Parkeer Register (NPR) — die eine Quelle für alle
 * niederländischen Städte.
 *
 * Datensatz: RDW „Open Data Parkeren", opendata.rdw.nl (Socrata), acht
 * Tabellen in einem Sternschema über `areamanagerid` (= CBS-Gemeindecode):
 * GEBIED, GEOMETRIE GEBIED, GEBIED REGELING, REGELING, TIJDVAK, TARIEFDEEL,
 * TARIEFBEREKENING, SPECIALE DAG. Abgerufen am 17. September 2026 für Utrecht
 * (344), Den Haag (518), Rotterdam (599), Groningen (14), Nijmegen (268) und
 * Eindhoven (772). Fixtures: `test/fixtures/npr-*-2026-09-17.json`.
 *
 * Was dieser Feed anders macht als alle deutschen davor: **Er hat keinen
 * Freitext.** Zeiten stehen als Tagestyp plus `900`/`2100`, Beträge als
 * Bruchteil je Schrittweite in Minuten, die Höchstparkdauer als Minutenzahl.
 * Ein Parser für Sätze entfällt; was bleibt, sind vier Dinge, die man leicht
 * falsch liest:
 *
 *  1. **Drei Datumsformate nebeneinander.** `20150501`, `20150501000000` und
 *     `2015-05-01T00:00:00.000` — je Tabelle ein anderes, und ein offenes
 *     Ende ist `29991231`, `2099-01-01` oder gar nicht vorhanden. Jede Zeile
 *     jeder Tabelle trägt Gültigkeit, und alte Fassungen bleiben stehen: In
 *     Rotterdam sind 1.341 von 5.425 Zeitfenstern heute gültig.
 *  2. **Ein Tagestyp ist kein Wochentag.** Neben `MAANDAG…ZONDAG` führt die
 *     Gemeinde eigene Typen (`FEESTDAG`, `FEEST ZOND`, `VOETBAL1430`,
 *     `AHOY_ZATERDAG`, `KOOPZONDAG`), und die Tabelle SPECIALE DAG sagt,
 *     an welchem Datum welcher Typ den Wochentag ersetzt. Der Kalender liegt
 *     also in den Daten — und ist je Gemeinde anders gepflegt.
 *  3. **Kein Zeitfenster heißt frei.** Die RDW schreibt es in die
 *     Beschreibung von TIJDVAK: „Voor die gedeelten van het etmaal waarvoor
 *     geen tijdvak is, geldt dat volgens de regeling het recht geen tarief
 *     heeft." Ein `Nultarief`/`Gratis`-Fenster ist dasselbe: ein Fenster ohne
 *     Gebühr, nie ein Betrag von 0.
 *  4. **Ein Tarif ist eine Staffel.** `0.08900000` je 1 Minute ist 5,34 € je
 *     Stunde — mit Rundungsrest. Eindhoven schreibt „0,30 starttarief, 4,50
 *     per uur" als drei Teile (0–1, 1–60, 60–∞ Minuten), Den Haag einen
 *     progressiven Tarif in acht Teilen. `parseNprFare` rechnet die Staffel
 *     stundenweise durch und liefert `exact` nur, wenn die ersten drei Stunden
 *     dasselbe kosten.
 */

import type { Weekday } from './berlin-time.js'
import type { Fee } from './parse-fee.js'
import type { ChargeWindow } from './tariff.js'

export class NprParseError extends Error {
  constructor(
    readonly raw: string,
    reason: string
  ) {
    super(`NPR-Feed: ${JSON.stringify(raw)} — ${reason}`)
    this.name = 'NprParseError'
  }
}

/** Wie in allen Parsern: fremde Eingabe wird zuerst begrenzt. */
const MAX_INPUT_LENGTH = 40

// ------------------------------------------------------------- Rohzeilen
//
// Socrata liefert jedes Feld als Zeichenkette, auch die als `number`
// deklarierten (`"starttimetimeframe": "900"`). Die Interfaces sagen das so;
// eine Zahl an dieser Stelle wäre eine Änderung des Dienstes, und
// `fixture-shape.test.ts` hält die beobachtete Typmenge fest.

export interface NprAreaRow {
  areamanagerid?: string | null
  areaid?: string | null
  areadesc?: string | null
  startdatearea?: string | null
  enddatearea?: string | null
}

export interface NprGeometryRow {
  areamanagerid?: string | null
  areaid?: string | null
  startdatearea?: string | null
  enddatearea?: string | null
  /** WKT: `POLYGON ((lon lat, …))` oder `MULTIPOLYGON (((…)))`, EPSG:4326. */
  areageometryastext?: string | null
}

export interface NprAreaRegulationRow {
  areamanagerid?: string | null
  areaid?: string | null
  regulationid?: string | null
  usageid?: string | null
  startdatearearegulation?: string | null
  enddatearearegulation?: string | null
}

export interface NprRegulationRow {
  areamanagerid?: string | null
  regulationid?: string | null
  regulationdesc?: string | null
  /** `B` Basisregeling, `A` Aanvullende regeling (Tageskarte, Abendkarte). */
  regulationtype?: string | null
  maximumdaycharge?: string | null
  startdateregulation?: string | null
  enddateregulation?: string | null
}

export interface NprTimeFrameRow {
  areamanagerid?: string | null
  regulationid?: string | null
  daytimeframe?: string | null
  starttimetimeframe?: string | null
  endtimetimeframe?: string | null
  claimrightpossible?: string | null
  farecalculationcode?: string | null
  maxdurationright?: string | null
  minparkinginterruption?: string | null
  resetdurationtimeframe?: string | null
  startdatetimeframe?: string | null
  enddatetimeframe?: string | null
}

export interface NprFarePartRow {
  areamanagerid?: string | null
  farecalculationcode?: string | null
  startdurationfarepart?: string | null
  enddurationfarepart?: string | null
  amountfarepart?: string | null
  stepsizefarepart?: string | null
  amountcumulative?: string | null
  startdatefarepart?: string | null
  enddatefarepart?: string | null
}

export interface NprFareRow {
  areamanagerid?: string | null
  farecalculationcode?: string | null
  farecalculationdesc?: string | null
  periodnametariff?: string | null
  vatpercentage?: string | null
  startdatefare?: string | null
  enddatefare?: string | null
}

export interface NprSpecialDayRow {
  areamanagerid?: string | null
  /** `JJJJMMTT` */
  datespecialday?: string | null
  namespecialday?: string | null
}

// ------------------------------------------------------------- Gültigkeit

/**
 * Ein Datum des Feeds als `JJJJMMTT`.
 *
 * Drei Schreibweisen, alle gemessen: `20150501` (GEBIED, REGELING, TARIEF*,
 * SPECIALE DAG), `20150501000000` (GEBIED REGELING, TIJDVAK) und ISO
 * `2015-05-01T00:00:00.000` (GEOMETRIE GEBIED). Die Uhrzeit fällt weg — eine
 * Fassung, die um 14:21 Uhr beginnt, gilt für diese App ab dem Tag.
 */
export function nprDateKey(raw: string | null | undefined): string | null {
  if (raw === null || raw === undefined) return null
  if (raw.length > MAX_INPUT_LENGTH) {
    throw new NprParseError(raw.slice(0, 40), `${raw.length} Zeichen sind kein Datum`)
  }
  const text = raw.trim()
  if (text === '') return null
  const compact = /^(\d{8})(?:\d{6})?$/.exec(text)
  if (compact !== null) return compact[1] as string
  const iso = /^(\d{4})-(\d{2})-(\d{2})(?:T[\d:.]+)?$/.exec(text)
  if (iso !== null) return `${iso[1]}${iso[2]}${iso[3]}`
  throw new NprParseError(raw, 'kein Datum in einer der drei Schreibweisen')
}

/**
 * Ob eine Zeile am Stichtag gilt.
 *
 * Gültig ist, was begonnen hat (`start <= heute`) und nicht geendet ist
 * (`ende > heute` oder kein Ende). Ein Ende am Stichtag zählt als vorbei:
 * `enddatearea: 20260917` heißt „gilt bis zum 16." — so liest es auch das
 * NPR, das Nachfolgefassungen mit demselben Tag beginnen lässt. Ohne Anfang
 * gilt die Zeile nicht: Ein fehlendes Startdatum ist im Feed nie vorgekommen
 * und wäre eher ein Fehler als eine Regel seit jeher.
 */
export function nprValidOn(
  start: string | null | undefined,
  end: string | null | undefined,
  today: string
): boolean {
  if (!/^\d{8}$/.test(today)) throw new NprParseError(today, 'Stichtag muss JJJJMMTT sein')
  const from = nprDateKey(start)
  if (from === null || from > today) return false
  const until = nprDateKey(end)
  return until === null || until > today
}

/** `JJJJMMTT` → `JJJJ-MM-TT`, die Form, die `holidaysFor` liefert. */
export function nprIsoDate(key: string): string {
  if (!/^\d{8}$/.test(key)) throw new NprParseError(key, 'kein JJJJMMTT')
  return `${key.slice(0, 4)}-${key.slice(4, 6)}-${key.slice(6, 8)}`
}

// ------------------------------------------------------------- Tagestypen

/** Die sieben Wochentage des Feeds, `0` ist Sonntag wie in `berlin-time.ts`. */
export const NPR_WEEKDAYS: Readonly<Record<string, Weekday>> = {
  ZONDAG: 0,
  MAANDAG: 1,
  DINSDAG: 2,
  WOENSDAG: 3,
  DONDERDAG: 4,
  VRIJDAG: 5,
  ZATERDAG: 6,
}

export type NprDayKind = 'weekday' | 'holiday' | 'event'

/**
 * Feiertagstypen, wie die sechs Gemeinden sie schreiben — inklusive des
 * Tippfehlers `2E PINKERSTERDAG`, der in Rotterdam 27-mal in TIJDVAK und
 * 8-mal in SPECIALE DAG steht. Ein Typ, der hier fehlt, gilt als
 * Ereignistag; ein Feiertag, der als Ereignis zählt, würde als „nicht
 * gerechnet" gemeldet statt als frei — das ist die vorsichtige Richtung.
 */
const HOLIDAY_TYPE = /^(FEEST|ZONFEEST|1E |2E |HEMELVAART|KONING|NIEUWJAAR|BEVRIJDING)/

/**
 * Wochentag, Feiertag oder Ereignis?
 *
 * `ZONDAG` in SPECIALE DAG heißt „an diesem Datum gelten die Sonntagszeiten"
 * und ist damit ein Wochentag; Amsterdam schreibt so den 5. Mai. Alles, was
 * kein Wochentag und kein Feiertagstyp ist, ist ein Ereignis:
 * `VOETBAL1430` (Feyenoord-Heimspiel, Anstoß 14:30), `AHOY_ZATERDAG`,
 * `EVENEMENT`, `KOOPZONDAG`, `KOOPAVOND`, `OPENDAG`, `MONSTERJAM`. Für die
 * hat diese App keinen Kalender und rechnet sie nicht.
 */
export function nprDayKind(dayType: string): NprDayKind {
  const type = dayType.trim().toUpperCase()
  if (type in NPR_WEEKDAYS) return 'weekday'
  if (HOLIDAY_TYPE.test(type)) return 'holiday'
  return 'event'
}

// ------------------------------------------------------------- Zeiten

/**
 * `uumm` als Minuten seit Mitternacht.
 *
 * `0` ist Mitternacht, `900` ist 9 Uhr, `1130` halb zwölf, `2400` das Ende
 * des Tages (1440, nie 0). Den Haag schreibt `1` und `202` — 00:01 und
 * 02:02 Uhr — in Zusatzregelungen; beide sind lesbar und werden so gelesen.
 */
export function parseNprTime(raw: string | null | undefined): number {
  if (raw === null || raw === undefined) throw new NprParseError('', 'Zeit fehlt')
  if (raw.length > MAX_INPUT_LENGTH) {
    throw new NprParseError(raw.slice(0, 40), `${raw.length} Zeichen sind keine Uhrzeit`)
  }
  const text = raw.trim()
  if (!/^\d{1,4}$/.test(text)) throw new NprParseError(raw, 'keine Uhrzeit der Form uumm')
  const value = Number(text)
  const hours = Math.floor(value / 100)
  const minutes = value % 100
  if (minutes > 59) throw new NprParseError(raw, `Minute ${minutes} gibt es nicht`)
  if (hours > 24 || (hours === 24 && minutes > 0)) {
    throw new NprParseError(raw, `Stunde ${hours} gibt es nicht`)
  }
  return hours * 60 + minutes
}

/** Ein gelesenes Zeitfenster — noch ohne Wochentag, denn der Tagestyp kann ein Feiertag sein. */
export interface NprTimeFrame {
  dayType: string
  kind: NprDayKind
  fromMinute: number
  toMinute: number
  /** `null`: Recht ohne Tarif (Vergunninggebiete) oder Recht nicht erwerbbar. */
  fareCode: string | null
  claimable: boolean
  maxDurationMinutes: number | undefined
}

/**
 * Zerlegt eine TIJDVAK-Zeile.
 *
 * Fenster reichen im Feed nie über Mitternacht: `ZATERDAG 0–100` ist die
 * erste Stunde des Samstags, `VRIJDAG 900–2400` der Freitag bis Mitternacht.
 * Was Hamburg als „täglich 9-2 Uhr" in einem Stück schreibt, steht hier
 * schon als zwei Zeilen — deshalb gibt es hier kein Aufteilen, nur die
 * Prüfung, dass Anfang vor Ende liegt.
 */
export function parseNprTimeFrame(row: NprTimeFrameRow): NprTimeFrame {
  const dayType = (row.daytimeframe ?? '').trim().toUpperCase()
  if (dayType === '') throw new NprParseError(JSON.stringify(row).slice(0, 40), 'Tagestyp fehlt')
  if (dayType.length > MAX_INPUT_LENGTH) {
    throw new NprParseError(dayType.slice(0, 40), `${dayType.length} Zeichen sind kein Tagestyp`)
  }
  const fromMinute = parseNprTime(row.starttimetimeframe)
  const toMinute = parseNprTime(row.endtimetimeframe)
  if (fromMinute >= toMinute) {
    throw new NprParseError(
      `${row.starttimetimeframe}-${row.endtimetimeframe}`,
      'Anfang liegt nicht vor dem Ende'
    )
  }
  const code = (row.farecalculationcode ?? '').trim()
  return {
    dayType,
    kind: nprDayKind(dayType),
    fromMinute,
    toMinute,
    fareCode: code === '' ? null : code,
    claimable: (row.claimrightpossible ?? 'J').trim().toUpperCase() !== 'N',
    maxDurationMinutes: parseNprMaxDuration(row.maxdurationright),
  }
}

/**
 * `maxdurationright` in Minuten; `0` heißt „keine Begrenzung", nie „0 Minuten".
 *
 * Groningen schreibt `1440` an 15 Fenster — ein Tag, also praktisch keine
 * Grenze, aber eine, die die Quelle so nennt; sie bleibt stehen.
 */
export function parseNprMaxDuration(raw: string | null | undefined): number | undefined {
  if (raw === null || raw === undefined) return undefined
  if (raw.length > MAX_INPUT_LENGTH) {
    throw new NprParseError(raw.slice(0, 40), `${raw.length} Zeichen sind keine Minutenzahl`)
  }
  const text = raw.trim()
  if (text === '') return undefined
  if (!/^\d{1,6}$/.test(text)) throw new NprParseError(raw, 'keine Minutenzahl')
  const minutes = Number(text)
  return minutes === 0 ? undefined : minutes
}

/** Ein Wochentags-Fenster als `ChargeWindow`; für Feiertags- und Ereignistypen `null`. */
export function nprChargeWindow(frame: NprTimeFrame): ChargeWindow | null {
  const weekday = NPR_WEEKDAYS[frame.dayType]
  if (weekday === undefined) return null
  return { weekdays: [weekday], fromMinute: frame.fromMinute, toMinute: frame.toMinute }
}

// ------------------------------------------------------------- Tarif

export interface NprFarePart {
  fromMinute: number
  /** `999999` im Feed heißt unbegrenzt. */
  toMinute: number
  /** Euro je Schritt, als Zahl mit Rundungsrest (`0.04583333`). */
  amount: number
  stepMinutes: number
}

const OPEN_END = 999_999

function parseNumber(raw: string | null | undefined, what: string): number {
  if (raw === null || raw === undefined) throw new NprParseError('', `${what} fehlt`)
  if (raw.length > MAX_INPUT_LENGTH) {
    throw new NprParseError(raw.slice(0, 40), `${raw.length} Zeichen sind keine Zahl`)
  }
  const text = raw.trim()
  if (!/^\d{1,9}(?:\.\d{1,8})?$/.test(text)) throw new NprParseError(raw, `${what}: keine Zahl`)
  return Number(text)
}

/** Ein Tarifteil aus einer TARIEFDEEL-Zeile; negative oder unlesbare Werte werfen. */
export function parseNprFarePart(row: NprFarePartRow): NprFarePart {
  const fromMinute = parseNumber(row.startdurationfarepart, 'Beginn')
  const toMinute = parseNumber(row.enddurationfarepart, 'Ende')
  const amount = parseNumber(row.amountfarepart, 'Betrag')
  const stepMinutes = parseNumber(row.stepsizefarepart, 'Schrittweite')
  if (!Number.isInteger(fromMinute) || !Number.isInteger(toMinute) || !Number.isInteger(stepMinutes)) {
    throw new NprParseError(JSON.stringify(row).slice(0, 40), 'Minuten sind keine ganzen Zahlen')
  }
  if (stepMinutes < 1) throw new NprParseError(row.stepsizefarepart ?? '', 'Schrittweite unter einer Minute')
  if (toMinute <= fromMinute) {
    throw new NprParseError(`${fromMinute}-${toMinute}`, 'Tarifteil endet nicht nach seinem Beginn')
  }
  return { fromMinute, toMinute, amount, stepMinutes }
}

/**
 * Was `n` Minuten nach der Staffel kosten, in Cent.
 *
 * Je Teil werden angefangene Schritte gezählt — so bucht das NPR („te
 * betalen in stappen van 10 min"). Die Teile müssen aufsteigend und lückenlos
 * sein; eine Lücke hieße, dass die Quelle für eine Minute keinen Preis
 * nennt, und das ist ein Abbruch, kein Nullpreis.
 */
export function nprFareCostCents(parts: readonly NprFarePart[], minutes: number): number {
  if (!Number.isFinite(minutes) || minutes < 0) throw new NprParseError(String(minutes), 'Dauer')
  const sorted = [...parts].sort((a, b) => a.fromMinute - b.fromMinute)
  // Erst die Kette prüfen, dann rechnen: Eine Lücke hinter der gefragten
  // Minute ist genauso ein Fehler der Quelle wie eine davor.
  let expectedStart = 0
  for (const part of sorted) {
    if (part.fromMinute !== expectedStart) {
      throw new NprParseError(`${part.fromMinute}`, `Tarifteil beginnt nicht bei Minute ${expectedStart}`)
    }
    expectedStart = part.toMinute
  }
  if (sorted.length === 0 || expectedStart < OPEN_END) {
    throw new NprParseError(`${expectedStart}`, 'Staffel endet vor 999999 Minuten')
  }
  let euros = 0
  for (const part of sorted) {
    if (minutes <= part.fromMinute) break
    const covered = Math.min(minutes, part.toMinute) - part.fromMinute
    euros += Math.ceil(covered / part.stepMinutes) * part.amount
  }
  return Math.round(euros * 100)
}

export type NprFare =
  /** Nultarief, Gratis: ein Fenster, in dem nichts zu zahlen ist. */
  | { kind: 'free' }
  /**
   * Der erste Schritt dauert drei Stunden oder länger — eine Pauschale
   * (Dagkaart, „1,00 per 3 uur"), kein Stundensatz. `perHour` ist der
   * Durchschnitt über den Schritt, `firstHour` das, was die erste Stunde
   * wirklich kostet: den ganzen Schritt.
   */
  | { kind: 'flat'; fee: Fee; stepMinutes: number; stepCents: number }
  | { kind: 'hourly'; fee: Fee; hourCents: readonly [number, number, number] }

/**
 * Aus einer Staffel wird ein `Fee`.
 *
 * Gerechnet wird, was die erste, zweite und dritte Stunde kosten. Sind die
 * drei gleich, ist es ein Stundensatz (`exact`); sonst eine Spanne über die
 * Stunden, die etwas kosten (`range`). Eindhovens „0,30 starttarief, 4,50
 * per uur" ergibt 4,80 / 4,50 / 4,50 und damit 4,50–4,80 €; Groningens
 * „Eerste 90 minuten 0,50, daarna 2,70 per uur" 0,33 / 1,52 / 2,70 und damit
 * 0,33–2,70 €. Eine Stunde, die nichts kostet, fällt aus der Spanne heraus:
 * Eine Spanne ab 0 wäre der Nullbetrag, den dieses Projekt nirgends
 * ausliefert. Kostet keine der drei etwas, ist der Tarif frei.
 */
export function parseNprFare(rows: readonly NprFarePartRow[]): NprFare {
  const parts = rows.map(parseNprFarePart)
  if (parts.length === 0) throw new NprParseError('', 'Tarif ohne Tarifteil')
  const first = [...parts].sort((a, b) => a.fromMinute - b.fromMinute)[0] as NprFarePart
  const hours: [number, number, number] = [
    nprFareCostCents(parts, 60),
    nprFareCostCents(parts, 120) - nprFareCostCents(parts, 60),
    nprFareCostCents(parts, 180) - nprFareCostCents(parts, 120),
  ]
  if (parts.every((part) => part.amount === 0)) return { kind: 'free' }
  if (first.stepMinutes >= 180 && first.amount > 0) {
    const stepCents = Math.round(first.amount * 100)
    const perHour = Math.round((first.amount * 100 * 60) / first.stepMinutes)
    if (perHour <= 0) throw new NprParseError(String(first.amount), 'Pauschale ohne Betrag')
    return {
      kind: 'flat',
      stepMinutes: first.stepMinutes,
      stepCents,
      fee:
        perHour === stepCents
          ? { kind: 'exact', centsPerHour: stepCents }
          : { kind: 'range', minCentsPerHour: perHour, maxCentsPerHour: stepCents },
    }
  }
  const priced = hours.filter((cents) => cents > 0)
  if (priced.length === 0) {
    throw new NprParseError(JSON.stringify(rows[0]).slice(0, 40), 'Beträge, die in drei Stunden nichts kosten')
  }
  const min = Math.min(...priced)
  const max = Math.max(...priced)
  return {
    kind: 'hourly',
    hourCents: hours,
    fee: min === max ? { kind: 'exact', centsPerHour: min } : { kind: 'range', minCentsPerHour: min, maxCentsPerHour: max },
  }
}

/**
 * Mehrere Tarife in einer Zone — Den Haag schreibt samstags einen anderen
 * Code als werktags — werden zu einer Spanne; ein einziger bleibt, was er ist.
 */
export function mergeNprFees(fees: readonly Fee[]): Fee {
  const priced = fees.filter((fee) => fee.kind === 'exact' || fee.kind === 'range')
  if (priced.length === 0) return { kind: 'unknown' }
  let min = Number.POSITIVE_INFINITY
  let max = 0
  for (const fee of priced) {
    if (fee.kind === 'exact') {
      min = Math.min(min, fee.centsPerHour)
      max = Math.max(max, fee.centsPerHour)
    } else if (fee.kind === 'range') {
      min = Math.min(min, fee.minCentsPerHour)
      max = Math.max(max, fee.maxCentsPerHour)
    }
  }
  return min === max ? { kind: 'exact', centsPerHour: min } : { kind: 'range', minCentsPerHour: min, maxCentsPerHour: max }
}

// ------------------------------------------------------------- Feiertage

export type NprHolidayOutcome = 'frei' | 'wochentag' | 'anders'

export interface NprHolidayFinding {
  /** `JJJJ-MM-TT` */
  date: string
  /** Der Tagestyp der Gemeinde für dieses Datum, oder `null`, wenn sie keinen führt. */
  dayType: string | null
  outcome: NprHolidayOutcome
}

/** Ein Fenster, reduziert auf das, was zwei Tage vergleichbar macht. */
function frameKey(frame: NprTimeFrame): string {
  return `${frame.fromMinute}-${frame.toMinute}:${frame.fareCode ?? ''}`
}

/**
 * Was die Quelle an den Feiertagen des Kalenders tut.
 *
 * Für jedes Datum aus `holidays` (die Menge, die `holidaysFor` liefert) wird
 * der Tagestyp der Gemeinde nachgeschlagen. Kennt sie keinen, gilt der
 * Wochentag — das NPR ersetzt einen Wochentag nur, wenn SPECIALE DAG es sagt;
 * Den Haag führt gar keine speziellen Tage und kassiert damit an Koningsdag
 * wie an jedem Montag. Kennt sie einen, entscheiden die Fenster dieses Typs:
 * keine gebührenpflichtigen → `frei`; dieselben wie am Wochentag →
 * `wochentag`; andere → `anders` (Rotterdams `FEEST ZOND`: die
 * Sonntagszeiten an einem Montag).
 *
 * `paidFrames` sind nur die Fenster mit Tarif, denn ein `Nultarief`-Fenster
 * ist für diese Frage kein Fenster.
 */
export function nprHolidayFindings(
  holidays: ReadonlySet<string>,
  specialDays: ReadonlyMap<string, string>,
  paidFrames: readonly NprTimeFrame[]
): NprHolidayFinding[] {
  const byType = new Map<string, Set<string>>()
  for (const frame of paidFrames) {
    const keys = byType.get(frame.dayType) ?? new Set<string>()
    keys.add(frameKey(frame))
    byType.set(frame.dayType, keys)
  }
  const findings: NprHolidayFinding[] = []
  for (const date of [...holidays].sort()) {
    const dayType = specialDays.get(date) ?? null
    const usual = byType.get(nprWeekdayName(date)) ?? new Set<string>()
    // Ohne Sondertag gilt der Wochentag — und der ist frei, wenn er keine
    // Fenster hat: Ein Feiertag auf einem Samstag in einer Mo–Fr-Zone ist
    // frei, ohne dass die Quelle ihn kennen müsste.
    const effective = dayType === null ? usual : (byType.get(dayType) ?? new Set<string>())
    if (effective.size === 0) {
      findings.push({ date, dayType, outcome: 'frei' })
    } else if (effective.size === usual.size && [...effective].every((key) => usual.has(key))) {
      findings.push({ date, dayType, outcome: 'wochentag' })
    } else {
      findings.push({ date, dayType, outcome: 'anders' })
    }
  }
  return findings
}

/** `MAANDAG` für `2026-04-27` — der Tagestyp, den das Datum ohne Sondertag hätte. */
export function nprWeekdayName(isoDate: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) throw new NprParseError(isoDate, 'kein JJJJ-MM-TT')
  const weekdayIndex = new Date(`${isoDate}T12:00:00Z`).getUTCDay()
  return Object.keys(NPR_WEEKDAYS).find((name) => NPR_WEEKDAYS[name] === weekdayIndex) as string
}

/**
 * Tage, an denen die Gemeinde nichts verlangt, obwohl der Kalender sie nicht
 * kennt — Groningen führt Goede Vrijdag als `FEESTDAG 2E`, Rotterdam den
 * 5. Mai als `FEEST ZOND`. Zurück kommen nur Feiertagstypen; Ereignistage
 * (Koopzondag, Fußball) sind eine andere Frage.
 */
export function nprExtraFreeDays(
  holidays: ReadonlySet<string>,
  specialDays: ReadonlyMap<string, string>,
  paidFrames: readonly NprTimeFrame[],
  years: readonly number[]
): { date: string; dayType: string }[] {
  const paidTypes = new Set(paidFrames.map((frame) => frame.dayType))
  const found: { date: string; dayType: string }[] = []
  for (const [date, dayType] of [...specialDays.entries()].sort()) {
    if (!years.includes(Number(date.slice(0, 4)))) continue
    if (holidays.has(date)) continue
    if (nprDayKind(dayType) !== 'holiday') continue
    if (paidTypes.has(dayType)) continue
    // Ein freier Ostersonntag in einer Zone ohne Sonntagsfenster ist keine
    // Nachricht; erst wo der Wochentag kassiert, ist der Sondertag eine.
    if (!paidTypes.has(nprWeekdayName(date))) continue
    found.push({ date, dayType })
  }
  return found
}

/** `2026-04-27` → `27.04.` */
function shortDate(iso: string): string {
  return `${iso.slice(8, 10)}.${iso.slice(5, 7)}.`
}

/**
 * Ein Satz für `unmodelledRules`, wenn die Quelle an Feiertagen etwas
 * anderes tut als „frei" — die Antwort, die das Modell sonst gäbe.
 * `null`, wenn jeder Feiertag frei ist und es nichts zu sagen gibt.
 */
export function nprHolidayRule(findings: readonly NprHolidayFinding[], year: number): string | null {
  const thisYear = findings.filter((finding) => finding.date.startsWith(`${year}-`))
  if (thisYear.every((finding) => finding.outcome === 'frei')) return null
  const list = (outcome: NprHolidayOutcome): string =>
    thisYear
      .filter((finding) => finding.outcome === outcome)
      .map((finding) => shortDate(finding.date))
      .join(', ')
  const parts: string[] = []
  if (thisYear.some((finding) => finding.outcome === 'frei')) parts.push(`frei am ${list('frei')}`)
  if (thisYear.some((finding) => finding.outcome === 'wochentag')) {
    parts.push(`gebührenpflichtig wie am Wochentag am ${list('wochentag')}`)
  }
  if (thisYear.some((finding) => finding.outcome === 'anders')) {
    parts.push(`mit eigenen Zeiten (hier nicht gerechnet) am ${list('anders')}`)
  }
  return `Feiertage ${year} laut Quelle: ${parts.join('; ')}`
}

/**
 * Ein Satz zu den Ereignistagen einer Regelung — Rotterdam führt 37
 * Tagestypen, darunter 19 Anstoßzeiten. Gruppiert nach dem Wortstamm, damit
 * aus `VOETBAL1200 … VOETBAL2100` eine Nennung wird.
 */
export function nprEventRule(dayTypes: readonly string[]): string | null {
  const events = [...new Set(dayTypes.filter((type) => nprDayKind(type) === 'event'))]
  if (events.length === 0) return null
  const stems = new Map<string, number>()
  for (const type of events) {
    const stem = type.replace(/[\d_].*$/, '')
    stems.set(stem, (stems.get(stem) ?? 0) + 1)
  }
  const named = [...stems.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([stem, count]) => (count > 1 ? `${stem}… (${count} Sorten)` : stem))
  return `Ereignistage laut Quelle mit eigenen Zeiten, hier nicht gerechnet: ${named.join(', ')}`
}

// ------------------------------------------------------------- Geometrie

export interface NprGeometry {
  type: 'Polygon' | 'MultiPolygon'
  coordinates: unknown
}

/** Höchstlänge eines WKT-Texts; Rotterdams größtes Gebiet hat 26 KB. */
const MAX_WKT_LENGTH = 400_000

/**
 * `areageometryastext` als GeoJSON-Geometrie.
 *
 * Nur `POLYGON` und `MULTIPOLYGON`; ein `POINT` (P+R-Plätze) ist keine Zone
 * und wird abgewiesen, damit der Aufrufer ihn zählt. Die Koordinaten
 * stehen als `lon lat` in Grad — und werden **nachgemessen**: Ein Wert über
 * 180 bzw. 90 ist keine Geographie, und die Karte sähe dabei nur leer aus.
 * Ein Ring wird geschlossen, falls die Quelle es nicht tut, und ein Ring mit
 * weniger als vier Positionen wirft.
 */
export function parseNprWkt(raw: string | null | undefined): NprGeometry {
  if (raw === null || raw === undefined) throw new NprParseError('', 'Geometrie fehlt')
  if (raw.length > MAX_WKT_LENGTH) {
    throw new NprParseError(raw.slice(0, 40), `${raw.length} Zeichen sind keine Zonengeometrie`)
  }
  const text = raw.trim()
  const match = /^(POLYGON|MULTIPOLYGON)\s*\((.*)\)$/s.exec(text)
  if (match === null) throw new NprParseError(text.slice(0, 40), 'weder POLYGON noch MULTIPOLYGON')
  const type = match[1] as 'POLYGON' | 'MULTIPOLYGON'
  const body = match[2] as string

  const ring = (source: string): [number, number][] => {
    const positions = source
      .trim()
      .split(',')
      .map((pair) => {
        const parts = pair.trim().split(/\s+/)
        if (parts.length !== 2) throw new NprParseError(pair.trim().slice(0, 40), 'kein Koordinatenpaar')
        const lon = Number(parts[0])
        const lat = Number(parts[1])
        if (!Number.isFinite(lon) || !Number.isFinite(lat)) {
          throw new NprParseError(pair.trim().slice(0, 40), 'keine Zahlen')
        }
        if (Math.abs(lon) > 180 || Math.abs(lat) > 90) {
          throw new NprParseError(pair.trim().slice(0, 40), 'keine Grade')
        }
        return [lon, lat] as [number, number]
      })
    const head = positions[0]
    const tail = positions[positions.length - 1]
    if (head !== undefined && tail !== undefined && (head[0] !== tail[0] || head[1] !== tail[1])) {
      positions.push([head[0], head[1]])
    }
    if (positions.length < 4) throw new NprParseError(source.slice(0, 40), 'Ring mit weniger als vier Positionen')
    return positions
  }
  // Ringe stehen je in eigenen Klammern: `((a b, c d), (hole))`.
  const rings = (source: string): [number, number][][] => {
    const found = [...source.matchAll(/\(([^()]*)\)/g)].map((inner) => ring(inner[1] as string))
    if (found.length === 0) throw new NprParseError(source.slice(0, 40), 'Polygon ohne Ring')
    return found
  }

  if (type === 'POLYGON') return { type: 'Polygon', coordinates: rings(body) }
  const polygons = [...body.matchAll(/\(((?:\([^()]*\)\s*,?\s*)+)\)/g)].map((inner) => rings(inner[1] as string))
  if (polygons.length === 0) throw new NprParseError(body.slice(0, 40), 'MultiPolygon ohne Polygon')
  return { type: 'MultiPolygon', coordinates: polygons }
}

// ------------------------------------------------------------- Texte

const DAY_SHORT: readonly string[] = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa']

function clock(minute: number): string {
  const hours = Math.floor(minute / 60)
  const minutes = minute % 60
  return minutes === 0 ? `${hours}` : `${hours}:${String(minutes).padStart(2, '0')}`
}

/**
 * Die Wochentagsfenster als kurzer Text — „Mo–Fr 9–21, Sa 9–18 Uhr".
 *
 * Die Quelle hat keinen Satz, den man zitieren könnte; das hier ist der
 * Satz, den die Oberfläche unter „Zeiten laut Quelle" zeigt. Tage mit
 * denselben Fenstern werden zusammengefasst, aufeinanderfolgende als Spanne.
 */
export function nprScheduleText(windows: readonly ChargeWindow[]): string {
  const byDay = new Map<Weekday, string[]>()
  const sorted = [...windows].sort((a, b) => a.fromMinute - b.fromMinute)
  for (const window of sorted) {
    for (const day of window.weekdays) {
      const list = byDay.get(day) ?? []
      list.push(`${clock(window.fromMinute)}–${clock(window.toMinute)}`)
      byDay.set(day, list)
    }
  }
  // Montag zuerst, Sonntag zuletzt — die Reihenfolge, in der Menschen Wochen lesen.
  const order: Weekday[] = [1, 2, 3, 4, 5, 6, 0]
  const groups: { days: Weekday[]; text: string }[] = []
  for (const day of order) {
    const spans = byDay.get(day)
    if (spans === undefined) continue
    const text = spans.join(' und ')
    const last = groups[groups.length - 1]
    const previous = order[order.indexOf(day) - 1]
    if (last !== undefined && last.text === text && last.days[last.days.length - 1] === previous) {
      last.days.push(day)
    } else {
      groups.push({ days: [day], text })
    }
  }
  return groups
    .map(({ days, text }) => {
      const first = DAY_SHORT[days[0] as Weekday] as string
      const last = DAY_SHORT[days[days.length - 1] as Weekday] as string
      const label = days.length === 1 ? first : days.length === 2 ? `${first}, ${last}` : `${first}–${last}`
      return `${label} ${text}`
    })
    .join(', ')
    .concat(groups.length === 0 ? '' : ' Uhr')
}

function euros(cents: number): string {
  return `${(cents / 100).toFixed(2).replace('.', ',')} €`
}

/**
 * „kortparkeertarief gebied 3 — 5,34 €/h": die Beschreibung der Quelle und
 * das, was die Staffel für die ersten Stunden ergibt. Bei einer Staffel
 * stehen die drei Stunden einzeln, denn die Spanne im `Fee` sagt nicht,
 * welche Stunde die teure ist — und bei Eindhovens Starttarif ist es die erste.
 */
export function nprFeeText(desc: string | null | undefined, fare: NprFare): string {
  const label = (desc ?? '').trim()
  let amount: string
  if (fare.kind === 'free') amount = 'ohne Gebühr'
  else if (fare.kind === 'flat') amount = `Pauschale ${euros(fare.stepCents)} je ${fare.stepMinutes} Minuten`
  else if (fare.fee.kind === 'exact') amount = `${euros(fare.fee.centsPerHour)}/h`
  else amount = `1. Stunde ${euros(fare.hourCents[0])}, 2. Stunde ${euros(fare.hourCents[1])}, 3. Stunde ${euros(fare.hourCents[2])}`
  return label === '' ? amount : `${label} — ${amount}`
}
