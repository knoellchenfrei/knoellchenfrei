/**
 * Der Hamburger Feed-Dialekt.
 *
 * Was `parse-schedule.ts` und `parse-fee.ts` für Berlin tun, tut diese Datei
 * für Hamburg — und getrennt, weil die beiden Feeds außer der Domäne nichts
 * teilen. Ein gemeinsamer Parser müsste beide Grammatiken kennen und wäre
 * genau deshalb bei jeder Änderung an einer Stadt für die andere gefährlich.
 *
 * Datensatz: `de.hh.up:bewohnerparkgebiete`, 146 Gebiete, abgerufen am
 * 6. September 2026. Fixture: `test/fixtures/hh-bewohnerparkgebiete.json`.
 *
 * Der Feed ist **einfacher** als Berlins — zehn Schreibweisen für die Zeiten
 * statt achtzehn, die Höchstparkdauer als Zahl statt als Prosa — und
 * gleichzeitig **schwieriger**, weil er drei Dinge enthält, die Berlin nicht
 * kennt:
 *
 *  1. **Fenster über Mitternacht.** Fünf Gebiete lauten „täglich 9-2 Uhr“.
 *     `ChargeWindow` kann das nicht in einem Stück ausdrücken; der Parser
 *     zerlegt es in 9:00–24:00 und 0:00–2:00 des Folgetags.
 *  2. **Gebiete ohne Gebühr.** „Parkscheibe“ heißt: kostenlos, aber Scheibe
 *     und Höchstparkdauer. Das ist kein Preis von null — wer ohne Scheibe
 *     steht, zahlt trotzdem.
 *  3. **Gebiete, die es noch nicht gibt.** `geplant_aktiv` unterscheidet
 *     aktive von geplanten. Ein geplantes Gebiet als geltend auszuliefern
 *     hieße, für eine Bewirtschaftung zu warnen, die es nicht gibt.
 */

import type { Weekday } from './berlin-time.js'
import type { Fee } from './parse-fee.js'
import type { ChargeWindow } from './tariff.js'

export class HamburgParseError extends Error {
  constructor(
    readonly raw: string,
    reason: string
  ) {
    super(`Hamburger Feed: ${JSON.stringify(raw)} — ${reason}`)
    this.name = 'HamburgParseError'
  }
}

/** Wie in den Berliner Parsern: fremde Eingabe wird zuerst begrenzt. */
const MAX_INPUT_LENGTH = 120

const ALL_DAYS: readonly Weekday[] = [0, 1, 2, 3, 4, 5, 6]

/**
 * „werktags“ ist Montag bis **Samstag**, nicht Montag bis Freitag.
 *
 * Das ist die Auslegung im Verkehrsrecht, gestützt auf die Legaldefinition in
 * § 3 Abs. 2 BUrlG („Werktage sind alle Kalendertage, die nicht Sonn- oder
 * gesetzliche Feiertage sind“) und ständige Rechtsprechung des BGH. Sie
 * andersherum zu lesen wäre der teuerste Fehler in dieser Datei: Die App
 * meldete an 31 Hamburger Gebieten samstags „gebührenfrei“, und das kostet
 * ein Knöllchen.
 *
 * Feiertage stehen nicht hier — die nimmt `isFreeDay` in `tariff.ts` heraus,
 * für alle Städte gleich.
 */
const WEEKDAYS_MO_SA: readonly Weekday[] = [1, 2, 3, 4, 5, 6]

/** Gültige Tagesangaben des Feeds, klein geschrieben. */
const DAY_SPECS: Record<string, readonly Weekday[]> = {
  täglich: ALL_DAYS,
  taeglich: ALL_DAYS,
  werktags: WEEKDAYS_MO_SA,
}

const CLAUSE =
  /^(täglich|taeglich|werktags)\s+(\d{1,2})(?::(\d{2}))?\s*-\s*(\d{1,2})(?::(\d{2}))?\s*Uhr$/i

/** Einen Wochentag um einen Tag weiterdrehen. */
function nextDay(day: Weekday): Weekday {
  return ((day + 1) % 7) as Weekday
}

/**
 * Zerlegt `bewirtschaftungszeit`.
 *
 * Alle zehn im Feed vorkommenden Werte passen auf ein Muster: eine
 * Tagesangabe, eine Stundenspanne, „Uhr“. Der Parser akzeptiert deshalb genau
 * das und weist alles andere ab, statt zu raten — eine still falsch geparste
 * Zeit nennt jemandem eine Stunde, in der er ein Knöllchen bekommt.
 */
export function parseHamburgSchedule(raw: string): ChargeWindow[] {
  if (raw.length > MAX_INPUT_LENGTH) {
    throw new HamburgParseError(raw.slice(0, 40), `${raw.length} Zeichen sind keine Zeitangabe`)
  }
  const text = raw.trim().replace(/\s+/g, ' ')
  const match = CLAUSE.exec(text)
  if (match === null) {
    throw new HamburgParseError(raw, 'keine erkennbare Tag-und-Stunden-Angabe')
  }

  const [, daySpec, fromHour, fromMin, toHour, toMin] = match
  const weekdays = DAY_SPECS[(daySpec as string).toLowerCase()]
  if (weekdays === undefined) throw new HamburgParseError(raw, `unbekannte Tagesangabe ${daySpec}`)

  if (Number(fromMin ?? 0) > 59 || Number(toMin ?? 0) > 59) {
    throw new HamburgParseError(raw, 'Minuten über 59')
  }
  const from = Number(fromHour) * 60 + Number(fromMin ?? 0)
  const to = Number(toHour) * 60 + Number(toMin ?? 0)

  // Wie in Berlin: Stunde 24 heißt Minute 1440, nie 0. „9-24 Uhr“ auf 0
  // abzubilden löschte den ganzen Abend.
  if (!(from >= 0 && from < 1440 && to > 0 && to <= 1440)) {
    throw new HamburgParseError(raw, `unplausible Spanne ${fromHour}-${toHour}`)
  }

  if (from < to) return [{ weekdays, fromMinute: from, toMinute: to }]

  // Über Mitternacht: „täglich 9-2 Uhr“. Zwei Fenster, und das zweite gehört
  // dem Folgetag. Bei „täglich“ fällt das nicht auf, weil alle sieben Tage
  // dabei sind — bei „werktags“ schon: Der Samstagabend läuft in den Sonntag,
  // der Sonntagabend aber in gar nichts.
  if (from === to) {
    throw new HamburgParseError(raw, 'Anfang und Ende sind gleich')
  }
  return [
    { weekdays, fromMinute: from, toMinute: 1440 },
    { weekdays: weekdays.map(nextDay), fromMinute: 0, toMinute: to },
  ]
}

/** Beträge im Feed: „3,50 € je Stunde“. Anders als Berlin nennt Hamburg die Einheit. */
const HAMBURG_AMOUNT = /^(\d{1,3}),(\d{2})\s*€\s*je\s+Stunde$/i

/**
 * Zerlegt `gebuehrenzone`.
 *
 * Sieben Werte über 146 Gebiete: vier Beträge, dazu „Parkscheibe“, „-“ und
 * ein leeres Feld. Die letzten drei sind **keine** Gebühr von null:
 * „Parkscheibe“ heißt kostenlos mit Scheibenpflicht, „-“ heißt, dass die
 * Quelle nichts sagt. Beides als 0,00 € auszuliefern wäre eine Behauptung,
 * die der Feed nicht deckt.
 *
 * Der Feed ist preislich aktuell: Er nennt 4,00 / 3,50 / 3,00 / 2,00 € — die
 * Sätze, die seit dem 1. Juli 2026 gelten. Veraltet ist nur die
 * *Beschreibung* des Dienstes in den Metadaten, die noch von drei Zonen zu
 * 3, 2 und 1 € spricht. Wer den Tarif von dort liest, liefert falsche Preise.
 */
export function parseHamburgFee(raw: string | null | undefined): Fee {
  if (raw === null || raw === undefined) return { kind: 'unknown' }
  if (raw.length > MAX_INPUT_LENGTH) {
    throw new HamburgParseError(raw.slice(0, 40), `${raw.length} Zeichen sind keine Gebühr`)
  }
  const text = raw.trim()
  if (text === '' || text === '-') return { kind: 'unknown' }
  if (/^Parkscheibe$/i.test(text)) return { kind: 'disc' }

  const match = HAMBURG_AMOUNT.exec(text)
  if (match === null) throw new HamburgParseError(raw, 'kein erkennbarer Betrag je Stunde')
  const centsPerHour = Number(match[1]) * 100 + Number(match[2])
  // Dieselbe Begründung wie in `parse-fee.ts`: „0,00 € je Stunde“ wäre ein
  // `exact` mit 0 Cent und damit `priced: true` — ein Preis von null, den die
  // Oberfläche ausschreiben dürfte. Hamburg hat für „kostenlos, aber Scheibe“
  // das Wort „Parkscheibe“ und für „Quelle sagt nichts“ den Strich; ein
  // Nullbetrag ist keins von beidem und gehört gemeldet.
  if (centsPerHour === 0) throw new HamburgParseError(raw, 'ein Betrag von 0,00 € ist kein Tarif')
  return { kind: 'exact', centsPerHour }
}

/**
 * Obergrenze, ab der eine Höchstparkdauer als „keine“ gilt.
 *
 * Der Feed setzt `9999` als Platzhalter für unbegrenzt. Die Zahl ungeprüft zu
 * übernehmen hieße, „6 Tage 22 Stunden“ als Höchstparkdauer anzuzeigen — eine
 * Angabe, die aussieht, als hätte sie jemand gemeint.
 */
const MAX_STAY_SENTINEL = 9999

/**
 * Zerlegt `hoechstparkdauer` — Minuten als Zeichenkette.
 *
 * `0` und `9999` sind beide Platzhalter für „keine Begrenzung“, und beide
 * kommen vor. `0` als echte Null zu lesen hieße: „Höchstparkdauer 0 Minuten“,
 * also Parken verboten — das steht dort nicht.
 */
export function parseHamburgMaxStay(raw: string | null | undefined): number | undefined {
  if (raw === null || raw === undefined) return undefined
  const text = raw.trim()
  if (text === '') return undefined
  if (!/^\d{1,5}$/.test(text)) {
    throw new HamburgParseError(raw, 'keine Minutenzahl')
  }
  const minutes = Number(text)
  if (minutes === 0 || minutes >= MAX_STAY_SENTINEL) return undefined
  return minutes
}

/** Rohzeile des Feeds, so weit wir sie lesen. */
export interface HamburgZoneProperties {
  /** Laufende Nummer der Quelle; steckt auch in der GML-Kennung des Features. */
  objectid?: number | null
  bwp_code?: string | null
  bwp_name?: string | null
  bewirtschaftungszeit?: string | null
  gebuehrenzone?: string | null
  hoechstparkdauer?: string | null
  bewirtschaftungsart?: string | null
  geplant_aktiv?: number | null
}

/**
 * Ob ein Gebiet heute tatsächlich bewirtschaftet wird.
 *
 * `geplant_aktiv` trägt im Abruf vom 6. September 2026 die Werte 2 (145 Mal)
 * und 3 (einmal). Welche Zahl welchen Zustand meint, sagt der Feed nicht, und
 * die Metadaten sagen es auch nicht — deshalb gilt hier die *vorsichtige*
 * Lesart: Nur der überwältigend häufige Wert zählt als aktiv, alles andere
 * fliegt raus. Ein Gebiet zu übersehen kostet einen fehlenden Hinweis; ein
 * geplantes Gebiet als geltend auszuliefern kostet eine falsche Warnung.
 *
 * Sobald jemand die Bedeutung belegt hat, gehört sie hierher — bis dahin ist
 * das eine begründete Annahme und keine gelesene Tatsache.
 */
const ACTIVE = 2

export function isActiveHamburgZone(properties: HamburgZoneProperties): boolean {
  return properties.geplant_aktiv === ACTIVE
}
