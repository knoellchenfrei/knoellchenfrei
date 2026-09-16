/**
 * Der Rostocker Feed-Dialekt.
 *
 * Was `hamburg.ts` für Hamburg und `frankfurt.ts` für Frankfurt tun, tut diese
 * Datei für Rostock — und wieder getrennt, nach derselben Regel: ein Feed, ein
 * Parser. Rostock teilt mit keiner anderen Stadt eine Schreibweise: Die Zeit
 * steht als `08:00-19:00` **ohne** Tagesangabe, der Betrag ist eine **Zahl**
 * (`1.5`), und die Höchstparkdauer kommt als Zahl **mit eigenem
 * Einheitenfeld** (`2` + `h`). Ein gemeinsamer Parser müsste alle Grammatiken
 * kennen und wäre bei jeder Änderung an einer Stadt für die anderen gefährlich.
 *
 * Datensätze, abgerufen am 16. September 2026 von `geo.sv.rostock.de`, WFS
 * 2.0.0, beide **CC0 1.0**: `hro.parkscheinautomaten.parkscheinautomaten`
 * (111 Punkte) und `hro.bewohnerparkgebiete.bewohnerparkgebiete` (10
 * Polygone). Fixtures: `test/fixtures/hro-*-2026-09-16.json`.
 *
 * Die eine Eigenheit, die alles andere bestimmt — wie in Frankfurt:
 * **Tarif, Geltungszeit und Höchstparkdauer hängen am Automaten, nicht an
 * einer Fläche.** Die Tarifzonen A, B, C, D und W der Parkgebührenordnung
 * gibt es nur als PDF-Karte; die einzigen Flächen im Feed sind die zehn
 * Bewohnerparkgebiete. Was für ein Gebiet gilt, entsteht also erst durch
 * Zusammenlegen der Automaten darin — `mergeRostockFees` und
 * `mergeRostockWindows` stehen deshalb hier und nicht im Datenbau.
 *
 * Und die zweite, die eine Entscheidung verlangt: **83 der 111 Automaten
 * nennen keinen Wochentag.** `08:00-19:00` ohne Tag — ob das Mo–So oder
 * Mo–Sa heißt, steht nicht im Feld. Die Antwort steht in § 4 Abs. 2 und 3 der
 * Parkgebührenordnung der Hanse- und Universitätsstadt Rostock (Amts- und
 * Mitteilungsblatt Nr. 23 vom 26. November 2022): Die Zonen W, A, B und C
 * werden **„täglich"** bewirtschaftet, nur Zone D **„werktags Montag -
 * Freitag"** — und genau die Zone-D-Automaten sind im Feed die einzigen, die
 * `Mo-Fr` ausschreiben. Eine Zeitangabe ohne Tag heißt hier also täglich,
 * Sonntag eingeschlossen. Das ist eine gelesene Regel, keine Vermutung;
 * Fundstelle und Zitat stehen in `docs/staedte-rostock.md`.
 */

import type { Weekday } from './berlin-time.js'
import type { Fee } from './parse-fee.js'
import type { ChargeWindow } from './tariff.js'

export class RostockParseError extends Error {
  constructor(
    readonly raw: string,
    reason: string
  ) {
    super(`Rostocker Feed: ${JSON.stringify(raw)} — ${reason}`)
    this.name = 'RostockParseError'
  }
}

/** Wie in den anderen Parsern: fremde Eingabe wird zuerst begrenzt. */
const MAX_INPUT_LENGTH = 120

/** Die Kürzel des Feeds. Sonntag ist 0, wie in `berlin-time.ts`. */
const DAY_NAMES: Record<string, Weekday> = {
  so: 0,
  mo: 1,
  di: 2,
  mi: 3,
  do: 4,
  fr: 5,
  sa: 6,
}

const ALL_DAYS: readonly Weekday[] = [0, 1, 2, 3, 4, 5, 6]

/** `Mo` oder `Mo-Fr`, kleingeschrieben. */
const DAY_RANGE = /^([a-z]{2})(?:-([a-z]{2}))?$/

/**
 * Eine Tagesangabe: `Mo-Fr`, `Sa`, `Mo-Fr,So`.
 *
 * Das Komma verbindet Gruppen (`Mo-Fr,So` = Montag bis Freitag und Sonntag),
 * der Bindestrich spannt. Beides kommt im Abzug vom 16. September 2026 genau
 * einmal vor, im selben Wert: `Mo-Fr,So 08:00-19:00; Sa 15:00-19:00` am
 * Strandweg in Warnemünde. Ergebnis aufsteigend sortiert und ohne Doppelte,
 * damit `mergeRostockWindows` gleiche Fenster als gleich erkennt.
 */
function parseDays(raw: string, spec: string): readonly Weekday[] {
  const days = new Set<Weekday>()
  for (const group of spec.toLowerCase().split(',')) {
    const range = DAY_RANGE.exec(group.trim())
    if (range === null) {
      throw new RostockParseError(raw, `unbekannte Tagesangabe ${JSON.stringify(spec)}`)
    }
    const from = DAY_NAMES[range[1] as string]
    const to = range[2] === undefined ? from : DAY_NAMES[range[2]]
    if (from === undefined || to === undefined) {
      throw new RostockParseError(raw, `unbekannte Tagesangabe ${JSON.stringify(spec)}`)
    }
    // Rundlauf statt `for (d = from; d <= to)`, damit `Sa-Mo` etwas
    // Sinnvolles ergibt statt still leer zu bleiben — eine leere
    // Wochentagsliste hiesse „nie gebührenpflichtig". Die Spannweite wird
    // gerechnet, nicht erlaufen; die Schleife kann nicht endlos werden.
    const span = (to - from + 7) % 7
    for (let step = 0; step <= span; step += 1) days.add(((from + step) % 7) as Weekday)
  }
  return [...days].sort((a, b) => a - b)
}

/**
 * Eine Klausel: optional eine Tagesangabe, dann `HH:MM-HH:MM`.
 *
 * Der Feed schreibt Minuten **immer** und Stunden **immer zweistellig**
 * (`08:00`, nie `8:00`); beides ist hier Pflicht. Eine Schreibweise, die im
 * Feed nicht vorkommt, stillschweigend zu akzeptieren hiesse, eine Bedeutung
 * zu erfinden, die niemand geprüft hat.
 */
const CLAUSE = /^(?:([A-Za-z,-]+)\s+)?(\d{2}):(\d{2})\s*-\s*(\d{2}):(\d{2})$/

function parseClause(raw: string, clause: string, dayless: boolean): ChargeWindow {
  const match = CLAUSE.exec(clause)
  if (match === null) {
    throw new RostockParseError(raw, `keine Tag-und-Stunden-Angabe in ${JSON.stringify(clause)}`)
  }
  const [, daySpec, fromHour, fromMin, toHour, toMin] = match

  // Ohne Tagesangabe gilt die Lesart der Parkgebührenordnung: täglich (siehe
  // Kopfkommentar). Das gilt aber nur für eine Angabe, die **allein** steht.
  // Eine tagelose Klausel neben einer mit Tagesangabe (`08:00-19:00; Sa
  // 15:00-19:00`) wäre widersprüchlich — welche der beiden gilt samstags? —
  // und kommt im Feed nicht vor. Sie bricht ab, statt eine Lesart zu raten.
  let weekdays: readonly Weekday[]
  if (daySpec === undefined) {
    if (!dayless) {
      throw new RostockParseError(raw, 'Klausel ohne Tagesangabe neben einer mit Tagesangabe')
    }
    weekdays = ALL_DAYS
  } else {
    weekdays = parseDays(raw, daySpec)
  }

  if (Number(fromMin) > 59 || Number(toMin) > 59) {
    throw new RostockParseError(raw, 'Minuten über 59')
  }
  const from = Number(fromHour) * 60 + Number(fromMin)
  const to = Number(toHour) * 60 + Number(toMin)

  // Stunde 24 heisst Minute 1440, nie 0 — wie in allen anderen Städten.
  if (from > 1440 || to > 1440) {
    throw new RostockParseError(raw, `Stunde über 24 in ${JSON.stringify(clause)}`)
  }
  if (from >= to) {
    // Über Mitternacht kommt im Feed nicht vor. Eine Spanne wie `22:00-02:00`
    // als ein Fenster zu speichern hiesse in `windowCovers` „nie", und sie zu
    // zerlegen hiesse, eine Lesart zu erfinden. Der Datenbau soll anhalten.
    throw new RostockParseError(raw, `Spanne ${fromHour}:${fromMin}-${toHour}:${toMin} endet nicht nach ihrem Anfang`)
  }
  return { weekdays, fromMinute: from, toMinute: to }
}

/**
 * Zerlegt `bewirtschaftungszeiten`.
 *
 * Fünf Schreibweisen über 111 Automaten, gezählt am 16. September 2026:
 * `08:00-19:00` (83), `08:00-18:00` (22), `Mo-Fr 08:00-18:00` (4),
 * `08:00-20:00` (1) und `Mo-Fr,So 08:00-19:00; Sa 15:00-19:00` (1). Das
 * Semikolon trennt Klauseln, das Komma Tagesgruppen; alles andere weist der
 * Parser ab.
 */
export function parseRostockSchedule(raw: string): ChargeWindow[] {
  if (raw.length > MAX_INPUT_LENGTH) {
    throw new RostockParseError(raw.slice(0, 40), `${raw.length} Zeichen sind keine Zeitangabe`)
  }
  const text = raw.trim().replace(/\s+/g, ' ')
  if (text === '') throw new RostockParseError(raw, 'leere Zeitangabe')

  const clauses = text
    .split(';')
    .map((part) => part.trim())
    .filter((part) => part !== '')
  if (clauses.length === 0) throw new RostockParseError(raw, 'leere Zeitangabe')

  return clauses.map((clause) => parseClause(raw, clause, clauses.length === 1))
}

/**
 * Obergrenze für einen Stundensatz, in Cent.
 *
 * Der teuerste Satz im Feed ist 5,00 € (Busse). Eine Zahl weit darüber ist
 * kein Tarif, sondern ein vertipptes Feld — und weil der Betrag hier eine
 * **Zahl** ist und kein Text, gibt es keine Schreibweise, an der so etwas
 * sonst auffiele.
 */
const MAX_CENTS_PER_HOUR = 99_900

/**
 * Zerlegt `normaltarif_gebuehren_pro_stunde` — eine **Zahl** in Euro.
 *
 * Anders als in allen anderen Städten steht hier kein Text (`2,00 Euro`,
 * `3,50 € je Stunde`, `2 €/h`), sondern `1.5`. Das macht den Parser kurz und
 * die Prüfung wichtiger: Eine Zahl kann `NaN`, negativ, unendlich oder ein
 * Bruchteil eines Cents sein, ohne dass irgendein Muster sie abweist.
 *
 * `null` ist **kein** Betrag von null: Zwei Automaten (Tarif `A3` und `C3`,
 * beide mit 30 Minuten Höchstparkdauer) tragen `null`, und was dort gilt,
 * sagt der Feed nicht. Und `0` ist auch keiner — dieselbe Regel wie in
 * Berlin, Hamburg und Frankfurt: Ein Nullbetrag wäre `exact` mit 0 Cent und
 * damit `priced: true`, das eine „0,00 €", das die Oberfläche nie zeigen soll.
 */
export function parseRostockFee(raw: number | null | undefined): Fee {
  if (raw === null || raw === undefined) return { kind: 'unknown' }
  if (typeof raw !== 'number' || !Number.isFinite(raw)) {
    throw new RostockParseError(String(raw), 'kein endlicher Betrag')
  }
  const cents = Math.round(raw * 100)
  if (Math.abs(raw * 100 - cents) > 1e-6) {
    throw new RostockParseError(String(raw), 'Bruchteile eines Cents sind kein Tarif')
  }
  if (cents < 0) throw new RostockParseError(String(raw), 'ein negativer Betrag ist kein Tarif')
  if (cents === 0) throw new RostockParseError(String(raw), 'ein Betrag von 0,00 € ist kein Tarif')
  if (cents > MAX_CENTS_PER_HOUR) {
    throw new RostockParseError(String(raw), `${cents} Cent je Stunde sind kein Tarif`)
  }
  return { kind: 'exact', centsPerHour: cents }
}

/** Die Einheiten, die das Feld `*_einheit` führt, in Minuten. */
const UNIT_MINUTES: Record<string, number> = {
  min: 1,
  h: 60,
  d: 1440,
}

/**
 * Obergrenze für eine Höchstparkdauer: 31 Tage.
 *
 * Der längste Wert im Feed ist `4 d`. Eine Zahl, die Monate ergibt, ist
 * keine Höchstparkdauer mehr, sondern ein Tippfehler in einem Zahlenfeld.
 */
const MAX_STAY_MINUTES = 31 * 1440

/**
 * Zerlegt `normaltarif_parkdauer_max` mit `normaltarif_parkdauer_max_einheit`.
 *
 * Zwei Felder, ein Wert: die Zahl und ihre Einheit (`h` 108-mal, `min` und
 * `d` je selten). Beide fehlen oder beide sind da — eine Zahl ohne Einheit
 * wäre nicht lesbar, und sie als Stunden anzunehmen hiesse raten; der Parser
 * bricht dann ab. Im Abzug vom 16. September 2026 fehlt keines von beiden.
 *
 * `0` ist keine Höchstparkdauer: Es hiesse „Parken verboten", und das steht
 * dort nicht. Anders als Hamburg kennt der Feed keinen Platzhalter für
 * „unbegrenzt"; `24 h` und `4 d` werden wörtlich übernommen.
 */
export function parseRostockMaxStay(
  value: number | null | undefined,
  unit: string | null | undefined
): number | undefined {
  const noValue = value === null || value === undefined
  const noUnit = unit === null || unit === undefined || unit.trim() === ''
  if (noValue && noUnit) return undefined
  if (noValue || noUnit) {
    throw new RostockParseError(`${String(value)} ${String(unit)}`, 'Zahl und Einheit gehören zusammen')
  }
  if (typeof value !== 'number' || !Number.isInteger(value)) {
    throw new RostockParseError(`${String(value)} ${unit}`, 'keine ganze Zahl')
  }
  if (unit.length > MAX_INPUT_LENGTH) {
    throw new RostockParseError(unit.slice(0, 40), `${unit.length} Zeichen sind keine Einheit`)
  }
  const factor = UNIT_MINUTES[unit.trim().toLowerCase()]
  if (factor === undefined) throw new RostockParseError(`${value} ${unit}`, 'unbekannte Einheit')
  if (value <= 0) throw new RostockParseError(`${value} ${unit}`, '0 ist keine Höchstparkdauer')
  const minutes = value * factor
  if (minutes > MAX_STAY_MINUTES) {
    throw new RostockParseError(`${value} ${unit}`, 'länger als 31 Tage ist keine Höchstparkdauer')
  }
  return minutes
}

/**
 * Der Code, unter dem die Oberfläche eine Höchstparkdauer beschriftet —
 * dieselbe Übersetzung wie in Frankfurt: `maxStayLabel` im Web kennt `1h`
 * und `30min` und macht daraus „1 Std." und „30 Min.".
 */
export function rostockMaxStayCode(minutes: number): string {
  return minutes % 60 === 0 ? `${minutes / 60}h` : `${minutes}min`
}

/**
 * Legt die Gebühren mehrerer Automaten zu einer Aussage über ihr Gebiet
 * zusammen — wie `mergeFrankfurtFees`, aus demselben Grund.
 *
 * Die Bewohnerparkgebiete folgen nicht den Tarifzonen: Im Gebiet A3
 * (Östliche Altstadt) stehen fünf Automaten zu 1,50 € neben einem zu 2,00 €.
 * Auf einen Wert zu reduzieren verschätzt jemanden dort um ein Drittel — also
 * `Fee.range`. Automaten ohne Betrag zählen nicht mit; sagt keiner etwas,
 * bleibt es `unknown`.
 */
export function mergeRostockFees(fees: readonly Fee[]): Fee {
  const amounts = new Set<number>()
  for (const fee of fees) {
    if (fee.kind === 'exact') amounts.add(fee.centsPerHour)
    else if (fee.kind === 'range') {
      amounts.add(fee.minCentsPerHour)
      amounts.add(fee.maxCentsPerHour)
    }
  }
  if (amounts.size === 0) return { kind: 'unknown' }
  const sorted = [...amounts].sort((a, b) => a - b)
  const min = sorted[0] as number
  const max = sorted[sorted.length - 1] as number
  return min === max
    ? { kind: 'exact', centsPerHour: min }
    : { kind: 'range', minCentsPerHour: min, maxCentsPerHour: max }
}

/**
 * Vereinigt die Fenster mehrerer Automaten: doppelte heraus, Reihenfolge
 * stabil, benachbarte **nicht** verschmolzen — `08:00-18:00` und `08:00-19:00`
 * als `08:00-19:00` auszugeben hiesse, dem halben Gebiet eine Stunde
 * Gebührenpflicht anzudichten, die dort niemand verlangt.
 */
export function mergeRostockWindows(windows: readonly ChargeWindow[]): ChargeWindow[] {
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

/**
 * Die Bezeichnung eines Bewohnerparkgebiets: `A3 – Östliche Altstadt`.
 *
 * Kürzel und Name in einem Feld, getrennt durch einen Halbgeviertstrich mit
 * Leerzeichen. Das Kürzel ist der Zonenschlüssel — es ist dasselbe, das die
 * Automaten in `bewohnerparkgebiet` tragen und das auf dem Ausweis steht.
 * Beide Hälften sind Pflicht; ein Feld ohne Trenner ist keine Bezeichnung
 * dieses Feeds und bricht ab, statt als Schlüssel `A3 - Östliche Altstadt`
 * durchzulaufen.
 */
const AREA_NAME = /^([A-Z]\d{1,2})\s+[–-]\s+(.+)$/u

export interface RostockAreaName {
  /** Das Kürzel, z. B. `A3`. */
  code: string
  /** Der Name, z. B. `Östliche Altstadt`. */
  name: string
}

export function parseRostockAreaName(raw: string): RostockAreaName {
  if (raw.length > MAX_INPUT_LENGTH) {
    throw new RostockParseError(raw.slice(0, 40), `${raw.length} Zeichen sind keine Gebietsbezeichnung`)
  }
  const match = AREA_NAME.exec(raw.trim().replace(/\s+/g, ' '))
  if (match === null) throw new RostockParseError(raw, 'keine Gebietsbezeichnung der Form „A3 – Name"')
  return { code: match[1] as string, name: (match[2] as string).trim() }
}

/** Rohzeile eines Parkscheinautomaten, so weit wir sie lesen. */
export interface RostockAutomatProperties {
  uuid?: string | null
  /** Laufende Nummer der Stadt, 111 verschiedene. */
  nummer?: number | null
  /** Standort in Worten, z. B. `Lange Str./ Marienkirche`. Nur im WFS, nicht im Download. */
  bezeichnung?: string | null
  /** Tarifzone der Parkgebührenordnung: `A`, `B`, `C`, `D`, `W` — und `X` für die Kunsthalle. */
  zone?: string | null
  handyparkzone?: number | null
  /** Tarifstufe: `B1`, `W2`, `Bus`, `Kunsthalle` … */
  tarif?: string | null
  /** `08:00-19:00`, `Mo-Fr 08:00-18:00`, … */
  bewirtschaftungszeiten?: string | null
  normaltarif_parkdauer_min?: number | null
  normaltarif_parkdauer_min_einheit?: string | null
  normaltarif_parkdauer_max?: number | null
  /** `h`, `min` oder `d`. */
  normaltarif_parkdauer_max_einheit?: string | null
  /** Euro je Stunde als **Zahl**, `null` bei zwei Automaten. */
  normaltarif_gebuehren_pro_stunde?: number | null
  /** `4 min = 0,10 €` — die Taktung, nur zur Anzeige. */
  normaltarif_gebuehrenschritte?: string | null
  veranstaltungstarif_parkdauer_min?: number | null
  veranstaltungstarif_parkdauer_min_einheit?: string | null
  veranstaltungstarif_parkdauer_max?: number | null
  veranstaltungstarif_parkdauer_max_einheit?: string | null
  /** Euro je Stunde bei Großveranstaltungen (§ 5 Parkgebührenordnung), 84-mal gesetzt. */
  veranstaltungstarif_gebuehren_pro_stunde?: number | null
  veranstaltungstarif_gebuehrenschritte?: string | null
  zugelassene_muenzen?: string | null
  /** Kürzel des Bewohnerparkgebiets, 48-mal gesetzt — sagt, wo der Automat *gemeint* ist, nicht wo er steht. */
  bewohnerparkgebiet?: string | null
  stellplaetze_pkw?: number | null
}

/** Rohzeile eines Bewohnerparkgebiets. */
export interface RostockZoneProperties {
  uuid?: string | null
  /** `A3 – Östliche Altstadt`; nur über `parseRostockAreaName` lesen. */
  bezeichnung?: string | null
  /** Straßenliste mit Hausnummernspannen, `;`-getrennt. */
  adressen?: string | null
}
