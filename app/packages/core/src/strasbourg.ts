/**
 * Der Straßburger Feed-Dialekt — die erste Stadt in Frankreich.
 *
 * Wie bei allen Städten davor: ein Feed, ein Parser. Straßburg teilt mit
 * keinem der anderen ein Muster: Der Tarif steht als **kumulierte Staffel**
 * in einem Textfeld, `1h = 3.5€ / 2h = 8€ / 2h15 = 10€ / … / 3h = 17€`, mit
 * Dezimalpunkt und Stufen wie `2h15`, `2h50`, `3h45`; und die Zeiten stehen
 * **gar nicht am Feature**, sondern nur in der Beschreibung des Datensatzes.
 *
 * Datensatz: `stationnement-payant` („Zones de stationnement payant", Ville
 * de Strasbourg) auf dem Opendatasoft-Portal `data.strasbourg.eu`, abgerufen
 * am 17. September 2026 über
 * `/api/explore/v2.1/catalog/datasets/stationnement-payant/exports/geojson`:
 * **19 Polygone**, `couleur` rouge (5) / orange (7) / vert (7), `tarif` in
 * genau **drei** Schreibweisen (eine je Farbe), `id_zone_visiteur` 1–20 ohne
 * 15, `numero_zone_resident` 1–16 ohne 13, `date_maj` durchweg `2026-09-03`.
 * Fixture: `test/fixtures/sxb-stationnement-payant-2026-09-17.json`.
 *
 * ## Die Eigenheit, die alles bestimmt: eine Staffel, kein Stundensatz
 *
 * Die Zone rouge kostet 3,50 € für die erste Stunde, 8 € für zwei — und
 * 17 € für drei. Die zweite Stunde kostet also 4,50 €, die dritte 9 €. Das
 * ist die Logik des französischen **Forfait post-stationnement** (FPS, seit
 * dem 1. Januar 2018): Die letzte Stufe jeder Staffel ist 17 € — der
 * ermäßigte FPS, den die Stadt bei Zahlung binnen drei Tagen verlangt („FPS
 * = 35 € (17 € si réglé dans les 3 jours …)", strasbourg.eu/stationnement-
 * visiteur, Tarife zum 1. September 2026). Wer länger steht als die letzte
 * Stufe, zahlt den vollen FPS. `Fee` kennt keine Staffel; die ehrliche Form
 * ist — wie in Zürich — eine **Spanne** aus den Kosten der vollen Stunden:
 * rouge 3,50–9,00 €/h, orange 1,00–7,00 €/h, vert 1,00–7,00 €/h. Jede
 * Schätzung der App liegt damit um den wahren Betrag; ein erfundener
 * Mittelwert träfe ihn nie. Der Sprung steht als `unmodelledRules` im Panel,
 * und die letzte Stufe ist die Höchstparkdauer: 3, 4 bzw. 5 Stunden.
 *
 * ## Die Zeiten stehen in der Beschreibung, nicht im Feld
 *
 * Kein Feld nennt Tage oder Uhrzeiten. Die Datensatzbeschreibung sagt
 * wörtlich: „Le stationnement est payant du lundi au samedi de 9h00 à 19h00
 * et gratuit les dimanches et les jours fériés." Dieselbe Regel steht auf der
 * Seite der Stadt („Le stationnement est payant du lundi au samedi, de 9 h à
 * 19 h. Il est gratuit les dimanches et les jours fériés."). Deshalb steht
 * sie hier als Konstante `STRASBOURG_HOURS` mit Fundstelle — wie Wiens
 * Stundensatz aus der Verordnung, nur umgekehrt: Dort fehlte der Betrag,
 * hier fehlt die Zeit. `rawHours` sagt im Panel, woher sie stammt.
 *
 * Feiertage: `FR-67` — Bas-Rhin mit den zwei Tagen des Alsace-Moselle-Rechts
 * (Vendredi saint, 26. Dezember), siehe `holidays.ts`. Die Beschreibung
 * nennt „jours fériés" ausdrücklich frei, also `freeOnHolidays: true`.
 */

import type { Weekday } from './berlin-time.js'
import type { Fee } from './parse-fee.js'
import type { ChargeWindow } from './tariff.js'

export class StrasbourgParseError extends Error {
  constructor(
    readonly raw: string,
    reason: string
  ) {
    super(`Straßburger Feed: ${JSON.stringify(raw)} — ${reason}`)
    this.name = 'StrasbourgParseError'
  }
}

/**
 * Wie in allen Parsern davor: fremde Eingabe wird zuerst begrenzt.
 *
 * Der längste Wert des Abzugs ist die grüne Staffel mit 128 Zeichen (zehn
 * Stufen). 200 lässt einer elften und zwölften Stufe Platz, ohne dass ein
 * Kilobyte Unfug durch die Muster läuft.
 */
const MAX_INPUT_LENGTH = 200

function bounded(raw: string | null | undefined, what: string): string {
  if (raw === null || raw === undefined) throw new StrasbourgParseError('', `keine ${what}`)
  if (raw.length > MAX_INPUT_LENGTH) {
    throw new StrasbourgParseError(raw.slice(0, 40), `${raw.length} Zeichen sind keine ${what}`)
  }
  const text = raw.replace(/\s+/g, ' ').trim()
  if (text === '') throw new StrasbourgParseError(raw, `keine ${what}`)
  return text
}

// ------------------------------------------------------------------ Staffel

/** Eine Stufe der Staffel: bis `minutes` Minuten kostet es `cents` — kumuliert. */
export interface StrasbourgTariffStep {
  minutes: number
  cents: number
}

export interface StrasbourgTariff {
  /** Aufsteigend in Minuten und in Cent; mindestens eine volle Stunde. */
  steps: readonly StrasbourgTariffStep[]
}

/**
 * Eine Stufe: `1h = 3.5€`, `2h15 = 10€`, `3h45 = 16.5€`, `5.50€`.
 *
 * Die Minuten hängen ohne Trenner an der Stunde (`2h15`), der Betrag trägt
 * einen **Dezimalpunkt** mit einer oder zwei Stellen — so schreibt der Feed
 * alle 25 Stufen der drei Staffeln. Das Komma der Stadtseite (`3,50 €`)
 * steht bewusst nicht im Muster: Eine vierte Schreibweise im Feed soll den
 * Datenbau anhalten, damit ein Mensch sie ansieht, statt still durchzulaufen.
 */
const STEP = /^(\d{1,2})h(\d{2})? ?= ?(\d{1,3})(?:\.(\d{1,2}))?€$/

/**
 * Zerlegt `tarif` in seine Stufen.
 *
 * Verlangt wird, was eine kumulierte Staffel ausmacht: Die Minuten steigen
 * streng, die Beträge steigen streng, kein Betrag ist null. Eine Stufe mit
 * fallendem Betrag wäre keine Staffel, sondern ein Tippfehler im Feed — und
 * aus dem Verhältnis zweier Stufen rechnet `strasbourgHourlyRates` unten die
 * Stundenkosten; ein Fehler dort wäre eine falsche Spanne im Panel.
 */
export function parseStrasbourgTariff(raw: string | null | undefined): StrasbourgTariff {
  const text = bounded(raw, 'Tarifstaffel')
  const steps: StrasbourgTariffStep[] = []
  for (const part of text.split('/')) {
    const clause = part.trim()
    const match = STEP.exec(clause)
    if (match === null) throw new StrasbourgParseError(raw ?? '', `keine Stufe der Staffel: ${JSON.stringify(clause)}`)
    const [, hours, mins, euros, decimals] = match
    const minutePart = mins === undefined ? 0 : Number(mins)
    if (minutePart > 59) throw new StrasbourgParseError(raw ?? '', `Minuten über 59 in ${JSON.stringify(clause)}`)
    const minutes = Number(hours) * 60 + minutePart
    if (minutes === 0) throw new StrasbourgParseError(raw ?? '', `0h ist keine Stufe (${JSON.stringify(clause)})`)
    // `3.5` heißt 3,50 €, `5.50` ebenso; eine Stelle ist Zehntel, nicht Cent.
    const cents = Number(euros) * 100 + (decimals === undefined ? 0 : Number(decimals.padEnd(2, '0')))
    // Null Cent ist kein Tarif — dieselbe Regel wie in `parse-fee.ts`: Ein
    // `exact` mit 0 brächte ein „0,00 €" auf den Schirm, und was ein
    // Nullbetrag in einer Staffel bedeutete, weiß niemand.
    if (cents === 0) throw new StrasbourgParseError(raw ?? '', `ein Betrag von 0 € ist kein Tarif (${JSON.stringify(clause)})`)
    const previous = steps[steps.length - 1]
    if (previous !== undefined) {
      if (minutes <= previous.minutes) {
        throw new StrasbourgParseError(raw ?? '', `die Stufen steigen nicht: ${previous.minutes} min vor ${minutes} min`)
      }
      if (cents <= previous.cents) {
        throw new StrasbourgParseError(raw ?? '', `die Beträge steigen nicht: ${previous.cents} Cent vor ${cents} Cent`)
      }
    }
    steps.push({ minutes, cents })
  }
  const last = steps[steps.length - 1]
  if (last === undefined || last.minutes < 60) {
    throw new StrasbourgParseError(raw ?? '', 'keine volle Stunde in der Staffel — kein Stundensatz ableitbar')
  }
  return { steps }
}

/**
 * Was ein Aufenthalt von `minutes` Minuten kostet: die erste Stufe, die ihn
 * deckt — so rechnet der Automat. Über der letzten Stufe gibt es keinen
 * Preis, nur den Forfait post-stationnement; das ist hier `undefined`, nicht
 * die letzte Stufe, weil die App sonst „17 €" für vier Stunden in der Zone
 * rouge nennte, die in Wahrheit 35 € kosten.
 */
export function strasbourgCostFor(tariff: StrasbourgTariff, minutes: number): number | undefined {
  if (!Number.isFinite(minutes) || minutes < 0) return undefined
  return tariff.steps.find((step) => step.minutes >= minutes)?.cents
}

/**
 * Die Kosten je voller Stunde, aus der Staffel nachgerechnet: erste Stunde,
 * zweite (2 h minus 1 h), dritte … bis zur letzten vollen Stunde der Staffel.
 * Rouge: 350, 450, 900. Orange: 250, 100, 650, 700. Vert: 100, 100, 250, 550, 700.
 */
export function strasbourgHourlyRates(tariff: StrasbourgTariff): number[] {
  const last = tariff.steps[tariff.steps.length - 1]
  if (last === undefined) return []
  const hours = Math.floor(last.minutes / 60)
  const rates: number[] = []
  let previous = 0
  for (let hour = 1; hour <= hours; hour += 1) {
    const cost = strasbourgCostFor(tariff, hour * 60)
    if (cost === undefined) break
    rates.push(cost - previous)
    previous = cost
  }
  return rates
}

/**
 * Der Tarif als `Fee`: die **Spanne** der Stundenkosten, Zürichs Weg. Sind
 * alle Stunden gleich teuer, ist es ein Satz. Kein Mittelwert: In der Zone
 * orange kostet die zweite Stunde 1 €, die vierte 7 €, und „4 €/h" träfe
 * keine einzige. Die Währung bleibt Euro, `currency` entfällt.
 */
export function strasbourgFee(tariff: StrasbourgTariff): Fee {
  const rates = strasbourgHourlyRates(tariff)
  const min = Math.min(...rates)
  const max = Math.max(...rates)
  if (rates.length === 0 || !Number.isFinite(min)) return { kind: 'unknown' }
  if (min === max) return { kind: 'exact', centsPerHour: min }
  return { kind: 'range', minCentsPerHour: min, maxCentsPerHour: max }
}

/**
 * Die Höchstparkdauer ist die letzte Stufe: Die Stadt schreibt zu jeder
 * Staffel „Au-delà de N heures de stationnement, montant du Forfait de
 * post-stationnement (FPS) = 35 €". Wer länger steht, zahlt den FPS.
 */
export function strasbourgMaxStay(tariff: StrasbourgTariff): number {
  const last = tariff.steps[tariff.steps.length - 1]
  if (last === undefined) throw new StrasbourgParseError('', 'leere Staffel hat keine Höchstparkdauer')
  return last.minutes
}

const euro = (cents: number): string => `${(cents / 100).toFixed(2).replace('.', ',')} €`

function stepLabel(step: StrasbourgTariffStep): string {
  const hours = Math.floor(step.minutes / 60)
  const minutes = step.minutes % 60
  return `${hours} h${minutes === 0 ? '' : ` ${String(minutes).padStart(2, '0')}`} ${euro(step.cents)}`
}

/**
 * Die Regel, die `Fee` nicht ausdrückt, in einem Satz fürs Panel: die ganze
 * Staffel und der Sprung am Ende. Der Satz nennt den FPS, weil die letzte
 * Stufe ohne ihn wie ein Preis aussieht und keiner ist — es ist die Strafe
 * in ihrer ermäßigten Form.
 */
export function strasbourgUnmodelledRules(tariff: StrasbourgTariff): string[] {
  const staffel = tariff.steps.map(stepLabel).join(', ')
  const last = tariff.steps[tariff.steps.length - 1]
  const hours = last === undefined ? 0 : last.minutes / 60
  return [
    `Staffeltarif (kumuliert): ${staffel} — die letzte Stufe entspricht dem ermäßigten ` +
      `Forfait post-stationnement (FPS); länger als ${hours} h kostet den vollen FPS von 35 €`,
  ]
}

// -------------------------------------------------------------------- Farbe

/** Die drei Tarifzonen der Stadt, wie der Feed sie schreibt. */
export type StrasbourgColour = 'rouge' | 'orange' | 'vert'

/** Deutsche Farbwörter fürs Panel — die Schilder in der Stadt zeigen die Farbe. */
export const STRASBOURG_COLOUR_LABELS: Record<StrasbourgColour, string> = {
  rouge: 'rot',
  orange: 'orange',
  vert: 'grün',
}

/** `rouge` / `orange` / `vert`; alles andere wirft — eine vierte Farbe hätte einen vierten Tarif. */
export function parseStrasbourgColour(raw: string | null | undefined): StrasbourgColour {
  const text = bounded(raw, 'Farbe').toLowerCase()
  if (text === 'rouge' || text === 'orange' || text === 'vert') return text
  throw new StrasbourgParseError(raw ?? '', 'weder rouge noch orange noch vert')
}

/**
 * Der Zonenschlüssel: Farbe und Nummer der Besucherzone, `rouge 10`. Die
 * Farbe steht auf dem Schild und dem Automaten, die Nummer im Feed — beides
 * zusammen ist eindeutig (19 Werte für 19 Flächen) und liest sich im Panel
 * als „Zone rouge 10". Eine Nummer ohne Farbe wäre für den Fahrer nichts.
 */
export function strasbourgZoneKey(properties: Pick<StrasbourgZoneProperties, 'couleur' | 'id_zone_visiteur'>): string {
  const colour = parseStrasbourgColour(properties.couleur)
  const id = properties.id_zone_visiteur
  if (typeof id !== 'number' || !Number.isInteger(id) || id <= 0) {
    throw new StrasbourgParseError(String(id), 'keine Nummer der Besucherzone')
  }
  return `${colour} ${id}`
}

// ------------------------------------------------------------------- Zeiten

const MO_SA: readonly Weekday[] = [1, 2, 3, 4, 5, 6]

/**
 * Die Zeiten der Gebührenpflicht — stadtweit, aus der Beschreibung des
 * Datensatzes, nicht aus einem Feld. Fundstellen (beide gelesen am
 * 17. September 2026):
 *
 * - Datensatzbeschreibung `stationnement-payant` auf data.strasbourg.eu:
 *   „Le stationnement est payant du lundi au samedi de 9h00 à 19h00 et
 *   gratuit les dimanches et les jours fériés."
 * - Seite der Ville et Eurométropole „Stationnement visiteur"
 *   (`strasbourg.eu/stationnement-visiteur`, Abschnitt „Stationnement en
 *   voirie — Les tarifs de stationnement au 1er septembre 2026"): „Le
 *   stationnement est payant du lundi au samedi, de 9 h à 19 h. Il est
 *   gratuit les dimanches et les jours fériés."
 *
 * Was die Konstante bewusst **nicht** trägt: die Lieferflächen im Hyper-
 * Zentrum (dieselbe Seite: gebührenpflichtig nur 11:30–19:00), denn sie sind
 * keine Zone des Datensatzes.
 */
export const STRASBOURG_HOURS = {
  windows: [{ weekdays: MO_SA, fromMinute: 9 * 60, toMinute: 19 * 60 }] as readonly ChargeWindow[],
  rawHours:
    'laut Datensatzbeschreibung: du lundi au samedi de 9h00 à 19h00, gratuit les dimanches et les jours fériés (nicht am Feature)',
  descriptionQuote:
    'Le stationnement est payant du lundi au samedi de 9h00 à 19h00 et gratuit les dimanches et les jours fériés.',
  cityPage: 'https://www.strasbourg.eu/stationnement-visiteur',
  /** „Les tarifs de stationnement au 1er septembre 2026" auf der Seite der Stadt. */
  tariffsFrom: '2026-09-01',
} as const

/** Die Fenster jeder Straßburger Zone — es gibt nur diese. Jedes Mal neu, damit niemand alle zugleich ändert. */
export function strasbourgWindows(): ChargeWindow[] {
  return STRASBOURG_HOURS.windows.map((window) => ({ ...window, weekdays: [...window.weekdays] }))
}

// ----------------------------------------------------------------- Rohzeilen

/** Rohzeile der Ebene `stationnement-payant`, so weit wir sie lesen. */
export interface StrasbourgZoneProperties {
  /** Opendatasofts Schwerpunkt der Fläche, `{ lon, lat }`. */
  geo_point_2d?: { lon: number; lat: number } | null
  /** 1–20 ohne 15 im Abzug; eindeutig je Fläche. */
  id_zone_visiteur?: number | null
  /** `rouge`, `orange`, `vert` — nur über `parseStrasbourgColour` lesen. */
  couleur?: string | null
  /** `1h = 3.5€ / 2h = 8€ / …` — nur über `parseStrasbourgTariff` lesen. */
  tarif?: string | null
  /** Nummer der Bewohnerparkzone, in der die Fläche liegt (1–16 ohne 13); nicht eindeutig. */
  numero_zone_resident?: number | null
  /** `2026-09-03` — an allen 19 Flächen gleich. */
  date_maj?: string | null
}

/** Rohzeile der Ebene `strasbourg-10-quartiers` (Découpage de la ville de Strasbourg en 10 quartiers). */
export interface StrasbourgQuartierProperties {
  geo_point_2d?: { lon: number; lat: number } | null
  id_quart10?: number | null
  /** `Gare-Kléber`, `Bourse-Esplanade-Krutenau`, … */
  nom?: string | null
}

/** Rohzeile der Ebene `stationnement_residant` (Zones de stationnement résidant), nur zur Gegenprobe. */
export interface StrasbourgResidentZoneProperties {
  geo_point_2d?: { lon: number; lat: number } | null
  id_zone_resident?: number | null
  /** Als **Text** — anders als `numero_zone_resident` an den Tarifzonen, das eine Zahl ist. */
  numero_zone_resident?: string | null
  annee_mise_en_place?: string | null
  type_zone?: string | null
  date_maj?: string | null
}
