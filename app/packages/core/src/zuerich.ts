/**
 * Der Zürcher Feed-Dialekt — der erste ausserhalb Deutschlands und
 * Österreichs, der erste in Franken.
 *
 * Wie bei den Städten davor: ein Feed, ein Parser. Drei Ebenen aus dem
 * Geoportal der Stadt (`www.ogd.stadt-zuerich.ch/wfs/geoportal/…`, QGIS
 * Server, WFS 1.1.0), gemessen am 17. September 2026:
 *
 * - `Gebietseinteilung_Parkierungsgebuehren` → `tarifzonen`: **2** Polygone,
 *   beide `tarifzone: "Hochtarifzone"`, beide `zone_bezeichnung: "Innenstadt
 *   und Oerlikon"`, beide `bedienungszeiten: "Montag - Samstag, 9:00 - 20:00
 *   Uhr"` (eine Schreibweise). Kein Betrag. Der Niedertarif ist keine Fläche,
 *   sondern „die übrigen Gebiete der Stadt" (Art. 5 der Vorschriften).
 * - `oeffentlich_zugaengliche_Parkplaetze_DAV` → `oeff_strassenparkierung_spuzpu`:
 *   **1.397** Sammel- und Zentralparkuhren (`typ` SPU/ZPU) mit einem Feld
 *   `tarif` wie `HOCH 2h Mo-Sa 09:00-20:00` — Tarifstufe, Höchstparkdauer,
 *   Tage, Zeiten in einer Zeile, **33 Schreibweisen**, davon 25 nach diesem
 *   Muster und 8 Sonderbezeichnungen (`Zoo ganze Woche`, `Theater 11`, …).
 * - dieselbe Quelle → `oeff_strassenparkierung_dav_p`: **13.272** gebühren-
 *   oder bewilligungspflichtige Parkfelder als Punkt, mit `gebpflicht`
 *   (`1`/`0`), `parkdauer` (Minuten als Zahl, 9 Werte und `null`) und `art`
 *   (11 Werte). Täglich nachgeführt (`stand: 2026-09-17`).
 *
 * Fixtures: `test/fixtures/zh-tarifzonen-2026-09-17.json`,
 * `zh-parkuhren-2026-09-17.json`, `zh-parkfelder-2026-09-17.json`,
 * `zh-quartiere-2026-09-17.json`.
 *
 * ## Die Eigenheit, die alles bestimmt: Der Tarif steht im Erlass, nicht im Feed
 *
 * Kein Feld nennt einen Betrag. Die Beträge stehen in den „Vorschriften über
 * die Parkierungs- und Parkuhrkontrollgebühren" (Amtliche Sammlung der Stadt
 * Zürich, AS 551.330; Gemeindebeschluss vom 25. September 1994, letzte
 * Änderung GRB vom 23. März 2016, in Kraft seit dem 1. April 2017). Die
 * Verordnung steht deshalb unten als Konstante `ZUERICH_ORDINANCE`, wörtlich
 * genug für das Panel, mit Fundstelle — wie Cottbus' Parkgebührenordnung.
 * Anders als dort widerspricht der Feed dem Erlass nicht; er schweigt nur.
 *
 * Und der Hochtarif ist **gestaffelt**, kein Stundensatz: Art. 3 nennt eine
 * Parkuhrkontrollgebühr von Fr. –.50 je 20 Minuten (1,50 Fr./h), Art. 4 ab
 * der 31. Minute zusätzlich Fr. –.50 je 10 Minuten in den ersten zwei
 * Stunden (zusammen 4,50 Fr./h), danach Fr. –.50 je Stunde (zusammen
 * 2,00 Fr./h). Eine Stunde kostet 3,00 Fr., zwei 7,50 Fr., drei 9,50 Fr.
 * `Fee` kennt keine Staffel; die ehrliche Form ist eine **Spanne** der
 * Grenzsätze, 1,50–4,50 Fr./h: Jede Schätzung der App liegt damit um den
 * wahren Betrag, statt ihn mit einem erfundenen Mittelwert zu treffen.
 * Der Niedertarif (Art. 5) ist ein Satz: Fr. –.50 für 1 Stunde.
 *
 * **Währung.** Beide Beträge tragen `currency: 'CHF'`; ohne das Feld stünde
 * „3,00 €" über Zürich (`docs/staedte-recherche-2026-09-16.md`).
 */

import type { Weekday } from './berlin-time.js'
import type { Position } from './geo.js'
import type { Fee } from './parse-fee.js'
import type { ChargeWindow } from './tariff.js'

export class ZuerichParseError extends Error {
  constructor(
    readonly raw: string,
    reason: string
  ) {
    super(`Zürcher Feed: ${JSON.stringify(raw)} — ${reason}`)
    this.name = 'ZuerichParseError'
  }
}

/**
 * Wie in allen Parsern davor: fremde Eingabe wird zuerst begrenzt.
 *
 * Der längste Wert des Abzugs ist `Montag - Samstag, 9:00 - 20:00 Uhr` mit
 * 34 Zeichen; 80 lässt Luft für zwei Klauseln und bleibt weit unter allem,
 * was ein Rückverfolgen im Muster teuer machen könnte.
 */
const MAX_INPUT_LENGTH = 80

function bounded(raw: string | null | undefined, what: string): string {
  if (raw === null || raw === undefined) throw new ZuerichParseError('', `keine ${what}`)
  if (raw.length > MAX_INPUT_LENGTH) {
    throw new ZuerichParseError(raw.slice(0, 40), `${raw.length} Zeichen sind keine ${what}`)
  }
  const text = raw.replace(/\s+/g, ' ').trim()
  if (text === '') throw new ZuerichParseError(raw, `keine ${what}`)
  return text
}

// ---------------------------------------------------------------- Wochentage

/** Sonntag ist 0, wie in `berlin-time.ts`. Kürzel und volle Namen. */
const DAY_NAMES: Record<string, Weekday> = {
  so: 0,
  mo: 1,
  di: 2,
  mi: 3,
  do: 4,
  fr: 5,
  sa: 6,
  sonntag: 0,
  montag: 1,
  dienstag: 2,
  mittwoch: 3,
  donnerstag: 4,
  freitag: 5,
  samstag: 6,
}

function dayOf(token: string, raw: string): Weekday {
  const day = DAY_NAMES[token]
  if (day === undefined) throw new ZuerichParseError(raw, `unbekannter Wochentag „${token}"`)
  return day
}

/** `Mo-Sa` → 1..6, aufsteigend; über den Sonntag hinweg erlaubt (`Sa-Mo`). */
function dayRange(from: Weekday, to: Weekday | undefined): Weekday[] {
  if (to === undefined) return [from]
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

const CLOCK = /^(\d{1,2})(?::(\d{2}))?$/

/**
 * `9` und `9:00` → 540, `24:00` → 1440. Stunde 24 heisst Minute 1440, nie 0
 * — wie in Berlin, Hamburg und Cottbus: „bis 24:00" auf 0 abzubilden löschte
 * den ganzen Abend, und `Mo-So 00:00-24:00` steht in 15 Parkuhren.
 */
function minuteOf(token: string, raw: string): number {
  const match = CLOCK.exec(token)
  if (match === null) throw new ZuerichParseError(raw, `„${token}" ist keine Uhrzeit`)
  const hours = Number(match[1])
  const minutes = match[2] === undefined ? 0 : Number(match[2])
  if (minutes > 59) throw new ZuerichParseError(raw, 'Minuten über 59')
  const total = hours * 60 + minutes
  if (total > 1440) throw new ZuerichParseError(raw, 'jenseits von 24:00')
  return total
}

/**
 * Ein Fenster aus Tagen, Beginn und Ende — oder zwei, wenn es über
 * Mitternacht läuft. `00:00-24:00` ist der ganze Tag, kein Fehler.
 */
function windowsOf(days: readonly Weekday[], from: number, to: number, raw: string): ChargeWindow[] {
  if (from === to) throw new ZuerichParseError(raw, 'Anfang und Ende sind gleich')
  if (from >= 1440) throw new ZuerichParseError(raw, 'Beginn um 24:00 ist kein Beginn')
  if (to === 0) throw new ZuerichParseError(raw, 'Ende um 00:00 ist kein Ende — 24:00 wäre Mitternacht')
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

// ------------------------------------------------- Bedienungszeiten der Zone

/**
 * `Montag - Samstag, 9:00 - 20:00 Uhr`: ein Tag oder eine Spanne, Komma,
 * eine Zeitspanne, wahlweise „Uhr". Die Wortgrenze steckt im `^…$` je
 * Klausel — ein `Mi` in „mit" kann nicht treffen, weil alles daneben die
 * Klausel ungültig macht. Der Abzug hat eine Schreibweise; Kürzel, „bis"
 * und der Halbgeviertstrich sind mit abgedeckt, weil eine Stadt ihre
 * Schreibweise ändern darf, ohne dass der Bau deshalb still leer läuft.
 */
const ZONE_CLAUSE =
  /^([a-zäö]+)(?: ?(?:-|–|bis) ?([a-zäö]+))?(?: ?, ?| )(\d{1,2}(?::\d{2})?) ?(?:-|–|bis) ?(\d{1,2}(?::\d{2})?)(?: uhr)?$/u

/**
 * Zerlegt `bedienungszeiten` in Fenster. Mehrere Klauseln durch `;`.
 *
 * Ein leerer Wert wirft: Die Zone ist eine Hochtarifzone, und eine
 * Hochtarifzone ohne Zeiten wäre eine Zone, die die App „frei" nennt.
 */
export function parseZuerichSchedule(raw: string | null | undefined): ChargeWindow[] {
  const text = bounded(raw, 'Zeitangabe').toLowerCase()
  const windows: ChargeWindow[] = []
  for (const clause of text.split(';')) {
    const part = clause.trim()
    const match = ZONE_CLAUSE.exec(part)
    if (match === null) throw new ZuerichParseError(raw ?? '', `„${part}" ist keine Zeitangabe`)
    const [, fromDay, toDay, fromTime, toTime] = match
    const days = dayRange(
      dayOf(fromDay as string, raw ?? ''),
      toDay === undefined ? undefined : dayOf(toDay, raw ?? '')
    )
    windows.push(
      ...windowsOf(days, minuteOf(fromTime as string, raw ?? ''), minuteOf(toTime as string, raw ?? ''), raw ?? '')
    )
  }
  return windows
}

// ----------------------------------------------------------------- Tarifstufe

/** Die zwei Stufen der Vorschriften: Art. 2–4 (hoch) und Art. 5 (nieder). */
export type ZuerichTariffLevel = 'hoch' | 'nieder'

/**
 * `Hochtarifzone` → `hoch`, `Niedertarifzone` → `nieder`. Alles andere wirft:
 * Eine dritte Stufe gibt es im Erlass nicht, und eine Fläche, deren Stufe
 * niemand kennt, darf keinen Betrag bekommen.
 */
export function parseZuerichTariffZone(raw: string | null | undefined): ZuerichTariffLevel {
  const text = bounded(raw, 'Tarifzone').toLowerCase()
  if (text === 'hochtarifzone' || text === 'hochtarif') return 'hoch'
  if (text === 'niedertarifzone' || text === 'niedertarif') return 'nieder'
  throw new ZuerichParseError(raw ?? '', 'weder Hochtarifzone noch Niedertarifzone')
}

// ------------------------------------------------------- Tarifzeile der Parkuhr

/**
 * Die acht Sonderbezeichnungen des Abzugs, wörtlich. Sie stehen an 182 der
 * 1.397 Parkuhren und sagen nichts Lesbares über Zeit oder Stufe — der
 * Datenbau zählt sie und lässt sie liegen. Eine **unbekannte** Bezeichnung
 * wirft dagegen: Sie kann eine neue Sonderregel sein oder ein neues Muster,
 * und beides muss ein Mensch ansehen, bevor die App es übergeht.
 */
export const ZUERICH_SPECIAL_TARIFFS: readonly string[] = [
  'Zoo ganze Woche',
  'Saisonal Baeder',
  'Adlisbergstrasse (Zoo)',
  'Kreis 5 Spezial 4h',
  'Kreis 5 Spezial 2h',
  'Hafendamm Enge',
  'Theater 11',
  'Balgrist spezial',
]

export type ZuerichMeterTariff =
  | {
      kind: 'regular'
      level: ZuerichTariffLevel
      /** Höchstparkdauer in Minuten, aus `2h`, `0.5h`, `48h`. */
      maxStayMinutes: number
      windows: ChargeWindow[]
    }
  | { kind: 'special'; label: string }

/**
 * `HOCH 2h Mo-Sa 09:00-20:00`: Stufe, Dauer mit `h`, Tagesspanne, Zeitspanne.
 *
 * Die Dauer erlaubt eine Nachkommastelle (`0.5h`); die Tage sind Kürzel mit
 * Bindestrich, die Zeiten `HH:MM`. Das Muster passt auf 1.215 der 1.397
 * Zeilen, die acht Sonderbezeichnungen auf weitere 182 — zusammen alle.
 */
const METER_TARIFF =
  /^(hoch|nieder) (\d{1,3}(?:[.,]\d)?) ?h ([a-z]{2}) ?- ?([a-z]{2}) (\d{1,2}:\d{2}) ?- ?(\d{1,2}:\d{2})$/

export function parseZuerichMeterTariff(raw: string | null | undefined): ZuerichMeterTariff {
  const text = bounded(raw, 'Tarifzeile')
  if (ZUERICH_SPECIAL_TARIFFS.includes(text)) return { kind: 'special', label: text }
  const match = METER_TARIFF.exec(text.toLowerCase())
  if (match === null) throw new ZuerichParseError(raw ?? '', 'weder Tarifzeile noch bekannte Sonderbezeichnung')
  const [, level, hours, fromDay, toDay, fromTime, toTime] = match
  const maxStayMinutes = Math.round(Number((hours as string).replace(',', '.')) * 60)
  if (maxStayMinutes <= 0) throw new ZuerichParseError(raw ?? '', 'eine Höchstparkdauer von 0 ist keine')
  const days = dayRange(dayOf(fromDay as string, raw ?? ''), dayOf(toDay as string, raw ?? ''))
  return {
    kind: 'regular',
    level: level as ZuerichTariffLevel,
    maxStayMinutes,
    windows: windowsOf(days, minuteOf(fromTime as string, raw ?? ''), minuteOf(toTime as string, raw ?? ''), raw ?? ''),
  }
}

// ------------------------------------------------------------ Höchstparkdauer

/** Länger als eine Woche nennt keine Parkuhr; darüber ist es ein Tippfehler. */
const MAX_STAY_MINUTES = 7 * 24 * 60

/**
 * `parkdauer` eines Parkfelds — **eine Zahl** in Minuten, oder `null`.
 *
 * `null` heisst hier nicht „unbegrenzt", sondern „ohne Parkuhr": Alle 4.829
 * Felder ohne Wert sind zugleich die 4.829 mit `gebpflicht: "0"` und
 * `kategorie: "OPU"`. Deshalb `undefined` statt eines Abbruchs. Eine Null
 * dagegen wirft — ein Parkfeld, auf dem man null Minuten stehen darf, ist
 * keine Auskunft. Eine numerische Zeichenkette geht durch, falls der Feldtyp
 * eines Tages kippt, wie Frankfurts `bewohnerparkzone`.
 */
export function parseZuerichMaxStay(raw: number | string | null | undefined): number | undefined {
  if (raw === null || raw === undefined) return undefined
  let value: number
  if (typeof raw === 'number') {
    value = raw
  } else {
    const text = bounded(raw, 'Parkdauer')
    if (!/^\d{1,5}$/.test(text)) throw new ZuerichParseError(raw, 'keine Minutenzahl')
    value = Number(text)
  }
  if (!Number.isInteger(value)) throw new ZuerichParseError(String(raw), 'keine ganze Minutenzahl')
  if (value <= 0) throw new ZuerichParseError(String(raw), 'eine Parkdauer von 0 Minuten ist keine')
  if (value > MAX_STAY_MINUTES) throw new ZuerichParseError(String(raw), 'mehr als eine Woche ist keine Höchstparkdauer')
  return value
}

/** `120` → `2 h`, `30` → `30 min`, `90` → `1,5 h` — so wie die Karte es nennt. */
export function zuerichMaxStayLabel(minutes: number): string {
  if (minutes < 60) return `${minutes} min`
  const hours = minutes / 60
  return `${Number.isInteger(hours) ? hours : hours.toFixed(1).replace('.', ',')} h`
}

// ------------------------------------------------------------- der Erlass

/** Ein Gebiet nach Art. 2 der Vorschriften, mit einem Ankerpunkt darin. */
export interface ZuerichOrdinanceArea {
  /** Schlüssel der Zone, ASCII — steht im Panel, in der Suche, in Meldungen. */
  key: string
  name: string
  article: string
  /**
   * Ein Punkt, der nach dem Wortlaut von Art. 2 sicher im Gebiet liegt. Der
   * Datenbau ordnet jede Fläche des Feeds dem Gebiet zu, dessen Anker sie
   * enthält — beide Flächen tragen dieselbe `zone_bezeichnung`, und ein
   * Schlüssel aus `objectid` stünde auf keinem Schild.
   */
  anchor: Position
  anchorName: string
}

const francs = (cents: number): string => `${(cents / 100).toFixed(2).replace('.', ',')} CHF`

/**
 * Die Vorschriften über die Parkierungs- und Parkuhrkontrollgebühren der
 * Stadt Zürich (AS 551.330), abgeschrieben aus dem amtlichen PDF, nicht aus
 * einer Pressemeldung.
 *
 * Fundstelle: <https://www.stadt-zuerich.ch/de/politik-und-verwaltung/politik-und-recht/amtliche-sammlung/5/551/330.html>,
 * PDF `551.330_Parkierungs- und Parkuhrkontrollgebühren17_V3.pdf`,
 * abgerufen am 17. September 2026. Gemeindebeschluss vom 25. September 1994
 * mit Änderungen bis GRB vom 23. März 2016; Art. 1–4 in der Fassung vom
 * 23. März 2016, in Kraft seit dem 1. April 2017 (STRB Nr. 919/2016).
 * Wörtlich:
 *
 * - Art. 1: „Das mehr als 30 Minuten dauernde Parkieren auf mit Parkuhren
 *   oder zentralen Parkuhren versehenen Parkplätzen gilt in den in Art. 2
 *   umschriebenen Gebieten als gebührenpflichtiger gesteigerter
 *   Gemeingebrauch."
 * - Art. 2 Abs. 1–3 umschreiben die Innenstadt, das Zentrum von Oerlikon
 *   und das Gebiet Zürich-West strassenweise; Abs. 4 ermächtigt den
 *   Stadtrat, „die Ausdehnung dieser Gebiete auf einzelne Strassen im
 *   Grenzbereich der Entwicklung anzupassen".
 * - Art. 3: „Die Parkuhrkontrollgebühr beträgt Fr. –.50 pro 20 Minuten in
 *   den in Art. 2 aufgeführten Gebieten."
 * - Art. 4: „Für das mehr als 30 Minuten dauernde Parkieren in den in
 *   Art. 2 aufgeführten Gebieten beträgt die Parkierungsgebühr in den
 *   ersten beiden Stunden Fr. –.50 für jeweils 10 Minuten, danach Fr. –.50
 *   pro Stunde."
 * - Art. 5: „In den übrigen Gebieten der Stadt Zürich wird eine blosse
 *   Parkuhrkontrollgebühr von Fr. –.50 für 1 Stunde erhoben."
 * - Art. 7: „Das Festlegen der Höchstparkierungsdauer und der Betriebszeit
 *   der Parkuhren liegt in der Zuständigkeit des Polizeidepartements." —
 *   die **Zeiten** stehen also nicht im Erlass; sie kommen aus dem Feed.
 *
 * Art. 2bis und 4bis regeln das Gebiet „Zoo Zürich" (Sonn- und Feiertage
 * nach Tabelle, werktags Art. 5); im Feed erscheint es nur als
 * Sonderbezeichnung an 102 Parkuhren, nicht als Fläche.
 */
export const ZUERICH_ORDINANCE = {
  validFrom: '2017-04-01',
  decidedOn: '2016-03-23',
  url: 'https://www.stadt-zuerich.ch/de/politik-und-verwaltung/politik-und-recht/amtliche-sammlung/5/551/330.html',
  title: 'Vorschriften über die Parkierungs- und Parkuhrkontrollgebühren (AS 551.330)',
  /**
   * Hochtarif als Spanne der Grenzsätze: 1,50 Fr./h in den ersten 30 Minuten
   * (Art. 3 allein), 4,50 Fr./h von der 31. bis zur 120. Minute (Art. 3 und
   * 4), 2,00 Fr./h danach. Eine Stunde 3,00 Fr., zwei 7,50 Fr., drei 9,50 Fr.
   */
  hoch: {
    fee: { kind: 'range', minCentsPerHour: 150, maxCentsPerHour: 450, currency: 'CHF' } as Fee,
    text:
      'Hochtarif (Art. 3 und 4 AS 551.330): 0,50 CHF je 20 Minuten Parkuhrkontrollgebühr, ' +
      'ab der 31. Minute zusätzlich 0,50 CHF je 10 Minuten in den ersten zwei Stunden, danach 0,50 CHF je Stunde ' +
      '— 1 h = 3,00 CHF, 2 h = 7,50 CHF, 3 h = 9,50 CHF',
  },
  nieder: {
    fee: { kind: 'exact', centsPerHour: 50, currency: 'CHF' } as Fee,
    text: 'Niedertarif (Art. 5 AS 551.330): 0,50 CHF für 1 Stunde Parkuhrkontrollgebühr',
  },
  /**
   * Die drei Gebiete des Art. 2. Der Feed führt zwei Flächen, beide als
   * „Innenstadt und Oerlikon" — Zürich-West (Abs. 3) fehlt ihm; der Datenbau
   * zählt das und sagt es im Log, statt eine Fläche zu erfinden.
   */
  areas: [
    { key: 'Innenstadt', name: 'Innenstadt', article: 'Art. 2 Abs. 1', anchor: [8.5391, 47.3699], anchorName: 'Paradeplatz' },
    { key: 'Oerlikon', name: 'Zentrum Oerlikon', article: 'Art. 2 Abs. 2', anchor: [8.5464, 47.4098], anchorName: 'Marktplatz Oerlikon' },
    { key: 'Zuerich-West', name: 'Zürich-West', article: 'Art. 2 Abs. 3', anchor: [8.5205, 47.3906], anchorName: 'Escher-Wyss-Platz' },
  ] as readonly ZuerichOrdinanceArea[],
} as const

/** Der Betrag zu einer Stufe — immer in Franken, nie ohne Währung. */
export function zuerichFeeFor(level: ZuerichTariffLevel): Fee {
  return level === 'hoch' ? ZUERICH_ORDINANCE.hoch.fee : ZUERICH_ORDINANCE.nieder.fee
}

/** Was das Panel unter „Tarif laut Quelle" zeigt — die Quelle ist der Erlass. */
export function zuerichFeeText(level: ZuerichTariffLevel): string {
  return level === 'hoch' ? ZUERICH_ORDINANCE.hoch.text : ZUERICH_ORDINANCE.nieder.text
}

/** `HOCH 2h Mo-Sa 09:00-20:00` in Worten, für Zählungen im Panel und im Log. */
export function zuerichMeterTariffText(tariff: ZuerichMeterTariff): string {
  if (tariff.kind === 'special') return tariff.label
  const level = tariff.level === 'hoch' ? 'Hochtarif' : 'Niedertarif'
  return `${level}, ${zuerichMaxStayLabel(tariff.maxStayMinutes)} (${francs(
    tariff.level === 'hoch' ? 300 : 50
  )} je erste Stunde)`
}

// ---------------------------------------------------------------- Rohzeilen

/** Rohzeile der Ebene `tarifzonen`, so weit wir sie lesen. */
export interface ZuerichZoneProperties {
  /** `Montag - Samstag, 9:00 - 20:00 Uhr` — eine Schreibweise. */
  bedienungszeiten?: string | null
  /** Immer `null`; das Feld ist ein Artefakt des Geodaten-Exports. */
  geometrie_gdo?: null
  objectid?: number | null
  /** `Hochtarifzone` — der Niedertarif hat keine Fläche. */
  tarifzone?: string | null
  /** `Innenstadt und Oerlikon`, an beiden Flächen gleich. */
  zone_bezeichnung?: string | null
}

/** Rohzeile der Ebene `oeff_strassenparkierung_spuzpu` (Sammel-/Zentralparkuhren). */
export interface ZuerichMeterProperties {
  davnr?: string | null
  /** HTML mit einem Foto-Link ins Intranet der Stadt — nicht lesbar von aussen. */
  file_path?: string | null
  geometrie_gdo?: null
  geoserverhausnummerid?: string | null
  geoserverstrasseid?: string | null
  /** LV95-Nordwert, als Zahl neben der WGS84-Geometrie. */
  hochwert?: number | null
  kategorie?: string | null
  objectid?: number | null
  /** Name der Parkierungszone der Parkuhr, z. B. `Genferstrasse` — 566 verschiedene. */
  parkierungzonename?: string | null
  parkierungzonenummer?: number | null
  rechtswert?: number | null
  /** `HOCH 2h Mo-Sa 09:00-20:00` oder eine Sonderbezeichnung. */
  tarif?: string | null
  /** `SPU` (Sammelparkuhr) oder `ZPU` (Zentralparkuhr). */
  typ?: string | null
}

/** Rohzeile der Ebene `oeff_strassenparkierung_dav_p` (Parkfelder als Punkt). */
export interface ZuerichSpaceProperties {
  /** `Standard`, `Blaue Zone`, `Parkscheibe`, `Taxi`, `Invalid`, … — 11 Werte. */
  art?: string | null
  bezeichnung?: string | null
  davnr?: string | null
  dienstabteilung?: string | null
  eigentum?: string | null
  /** `1` gebührenpflichtig, `0` nicht — als Zeichenkette. */
  gebpflicht?: string | null
  geometrie_gdo?: null
  inbetriebnahme?: string | null
  inprojekt?: string | null
  /** `OPU` ohne Parkuhr, `SPU` Sammelparkuhr, `ZPU` Zentralparkuhr. */
  kategorie?: string | null
  objectid?: number | null
  orientierung?: string | null
  /** Minuten als Zahl; `null` genau bei `OPU`. */
  parkdauer?: number | null
  parkfeldnummer?: string | null
  stand?: string | null
  zugang?: string | null
}

/** Rohzeile der Ebene `adm_statistische_quartiere_v` (34 Quartiere). */
export interface ZuerichQuartierProperties {
  geometrie_gdo?: null
  /** `Kreis 1` … `Kreis 12`. */
  kname?: string | null
  knr?: number | null
  objectid?: number | null
  objid?: string | null
  /** `Lindenhof`, `Oerlikon`, … — eindeutig. */
  qname?: string | null
  qnr?: number | null
}
