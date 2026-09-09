/**
 * Der Karlsruher Feed-Dialekt.
 *
 * Was `parse-schedule.ts`/`parse-fee.ts` für Berlin, `hamburg.ts` für Hamburg,
 * `frankfurt.ts` für Frankfurt und `muenchen.ts` für München tun, tut diese
 * Datei für Karlsruhe — und wieder getrennt, nach derselben Regel: fünf Feeds,
 * fünf Parser. Karlsruhes Grammatik teilt mit keiner der anderen ein einziges
 * Muster. Berlin schreibt `Mo-Sa 9-20 Uhr` und `2,00 Euro`, Hamburg
 * `werktags 9-20 Uhr` und `3,50 € je Stunde`, Frankfurt `Mo-Sa 9-20` und
 * `2 €/h`, München `Mischparken 18-23 Uhr Montag bis Freitag`, Karlsruhe
 * `werktags 8 bis 20 Uhr; Tagespauschale` und — als einzige Stadt — gar keinen
 * Stundensatz, sondern eine **Preistreppe**:
 * `30 min = 1,50 €; 60 min = 3,00 €; 90 min = 4,50 €; 120 min = 6,00 €`.
 *
 * Datensätze, abgerufen am 8. September 2026 aus
 * <https://mobil.trk.de/geoserver/TBA/ows>:
 * `TBA:parkscheinautomaten` (638 Punkte) und
 * `TBA:parkscheinautomaten_flaechen` (282 Polygone).
 * Fixtures: `test/fixtures/ka-*-2026-09-08.json`.
 *
 * Vier Eigenheiten bestimmen alles Weitere, und alle vier sind nachgemessen:
 *
 *  1. **Der Feed ist nicht Karlsruhe, sondern die TechnologieRegion.** Von 638
 *     Automaten stehen 281 in Karlsruhe; der Rest verteilt sich auf Landau,
 *     Rastatt, Ettlingen, Baden-Baden, Gaggenau, Bruchsal, Bretten,
 *     Germersheim — und auf **Haguenau (54) und Saverne (19) im Elsass**, also
 *     auf Frankreich. Deren Zeilen sind französisch
 *     (`Du lundi au samedi 9h-12h et 14h-19h`, `30 cts par 1/4 d'heure`) und
 *     hängen an einem anderen Feiertagskalender. `isKarlsruheMachine` filtert
 *     deshalb auf `gemeinde`, bevor irgendein Parser eine Zeile anfasst.
 *  2. **Die Preistreppe ist kein Stundensatz.** `30 min = 1,50 €` heißt 3 €/h,
 *     `15 min = 1,50 €` aber 6 €/h. Wer nur die erste Zahl liest, halbiert den
 *     Preis. `parseKarlsruheFee` liest **alle** Stufen und prüft, dass sie
 *     denselben Satz ergeben; anderswo im Feed tun sie das nicht
 *     (`15 min = 0,10 €; … 60 min = 0,80 €` ist progressiv), und ein einzelner
 *     €/h-Wert wäre dort eine Lüge.
 *  3. **Die Flächen tragen keine Attribute** — `{id, gemeinde, stand}`, sonst
 *     nichts. Tarif und Zeiten hängen an den Automaten. Das ist Frankfurts
 *     Problem, nur eine Größenordnung feiner: Frankfurts Polygone sind
 *     Bewohnerparkbereiche, Karlsruhes sind die **Stellplatzflächen selbst**
 *     (Median 128 m²). Die Zuordnung läuft deshalb über den Abstand und nicht
 *     über Punkt-in-Polygon — Begründung bei `KARLSRUHE_JOIN_RADIUS_M`.
 *  4. **`tarifzone` „0" sind keine Straßenstellplätze**, sondern drei fremd
 *     betriebene Parkplätze am Hauptbahnhof (P4, P6, P7 — die `bemerkung`
 *     nennt contipark.de bzw. parken-in-karlsruhe.de). Sie tragen weder
 *     `gebuehren` noch `max_parkdauer` und stehen ausgerechnet **näher** an
 *     zwei Flächen als jeder städtische Automat: 3 m und 18 m gegen 99 m und
 *     81 m. Ohne diesen Filter erbte die Fläche den leeren Tarif des privaten
 *     Betreibers und behauptete damit „bewirtschaftet, Preis unbekannt", wo
 *     die Stadt 3 €/h nimmt.
 */

import type { Weekday } from './berlin-time.js'
import type { PolygonRings, Position } from './geo.js'
import type { Fee } from './parse-fee.js'
import type { ChargeWindow } from './tariff.js'

export class KarlsruheParseError extends Error {
  constructor(
    readonly raw: string,
    reason: string
  ) {
    super(`Karlsruher Feed: ${JSON.stringify(raw)} — ${reason}`)
    this.name = 'KarlsruheParseError'
  }
}

/**
 * Wie in allen anderen Parsern: fremde Eingabe wird zuerst begrenzt.
 *
 * 160 statt Hamburgs und Frankfurts 120, weil Karlsruhes Preistreppe das
 * längste Feld aller fünf Feeds ist: 93 Zeichen
 * (`30 min = 1,50 €; … 120 min = 6,00 €; Tagespauschale = 15,00 €`). 120 wäre
 * knapp genug, dass eine fünfte Stufe den Datenbau abbräche, ohne dass daran
 * etwas falsch wäre.
 */
const MAX_INPUT_LENGTH = 160

const ALL_DAYS: readonly Weekday[] = [0, 1, 2, 3, 4, 5, 6]

/**
 * „werktags" ist Montag bis **Samstag**, nicht Montag bis Freitag.
 *
 * Dieselbe Auslegung und dieselbe Begründung wie in `hamburg.ts`: § 3 Abs. 2
 * BUrlG definiert Werktage als alle Kalendertage außer Sonn- und Feiertagen,
 * und die Rechtsprechung liest die Verkehrsschilder ebenso. Hier wiegt sie
 * schwerer als irgendwo sonst — **229 der 278 Karlsruher Automaten** tragen
 * genau dieses Wort. Andersherum gelesen meldete die App an fast der ganzen
 * Innenstadt samstags „gebührenfrei", und das kostet ein Knöllchen.
 *
 * Feiertage stehen nicht hier — die nimmt `isFreeDay` in `tariff.ts` heraus.
 */
const WEEKDAYS_MO_SA: readonly Weekday[] = [1, 2, 3, 4, 5, 6]

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

/** Sammelbegriffe, die für eine ganze Tagesmenge stehen. */
const DAY_SPECS: Record<string, readonly Weekday[]> = {
  täglich: ALL_DAYS,
  taeglich: ALL_DAYS,
  werktags: WEEKDAYS_MO_SA,
}

/**
 * Klauseln, die keine Zeitangabe sind, sondern eine Zusatzregel.
 *
 * Heute gibt es genau eine: `Tagespauschale`. Sie steht an 34 Karlsruher
 * Automaten hinter einem Semikolon und sagt, dass es neben dem Stundensatz
 * eine Tageskarte gibt — **kein Zeitfenster**. Sie stillschweigend zu
 * schlucken hieße, eine Aussage der Quelle zu verlieren; sie als Fenster zu
 * lesen wäre erfunden. Sie geht deshalb nach `unmodelledRules`, und das Panel
 * schreibt sie wörtlich hin.
 *
 * Bewusst eine Positivliste und kein „alles ohne Ziffern": Ein neues Wort im
 * Feed soll den Datenbau anhalten, damit jemand nachsieht, was es bedeutet.
 */
const KNOWN_EXTRA_RULES: readonly string[] = ['Tagespauschale']

/** `Mo`, `Mo-Fr`, `täglich`, `werktags` — kleingeschrieben geprüft. */
const DAY_RANGE = /^([a-zäöü]{2})(?:\s*-\s*([a-zäöü]{2}))?$/

function parseDays(raw: string, spec: string): readonly Weekday[] {
  const text = spec.trim().toLowerCase()
  const named = DAY_SPECS[text]
  if (named !== undefined) return named

  // Ein Kürzel oder zwei, durch einen Bindestrich getrennt — als eigener
  // regulärer Ausdruck statt als `split('-')`, aus demselben Grund wie in
  // Frankfurt: Der Split kann nicht sagen, dass es höchstens zwei Teile gibt.
  //
  // Der Ausdruck ist von beiden Seiten verankert. Das ist die Lehre aus
  // München, wo `Fr` das „fr" in **free floating** und `Mi` das „mi" in
  // **mit** fand: Eine Tagesabkürzung braucht eine Grenze auf BEIDEN Seiten.
  const range = DAY_RANGE.exec(text)
  if (range === null) {
    throw new KarlsruheParseError(raw, `unbekannte Tagesangabe ${JSON.stringify(spec)}`)
  }
  const from = DAY_NAMES[range[1] as string]
  const to = range[2] === undefined ? from : DAY_NAMES[range[2]]
  if (from === undefined || to === undefined) {
    throw new KarlsruheParseError(raw, `unbekannte Tagesangabe ${JSON.stringify(spec)}`)
  }
  if (from === to) return [from]

  // Rundlauf wie in Frankfurt, damit auch `Sa-Mo` etwas Sinnvolles ergibt
  // statt still leer zu bleiben. Eine leere Wochentagsliste hieße „nie
  // gebührenpflichtig" — die teuerste stille Antwort, die dieser Parser geben
  // könnte. Die Spannweite wird gerechnet, nicht erlaufen.
  const span = (to - from + 7) % 7
  const days: Weekday[] = []
  for (let step = 0; step <= span; step += 1) days.push(((from + step) % 7) as Weekday)
  return days.sort((a, b) => a - b)
}

/**
 * Eine Klausel: `<Tage> <von> bis <bis> Uhr`.
 *
 * Ohne Minuten, weil der Feed keine schreibt — alle elf Karlsruher
 * Schreibweisen nennen volle Stunden. Sie trotzdem zuzulassen hieße, eine
 * Schreibweise zu erfinden, deren Bedeutung niemand geprüft hat: `8.30 bis 20`
 * wäre in Deutschland genauso gut „8 Uhr 30" wie ein Tippfehler.
 */
const CLAUSE = /^([A-Za-zÄÖÜäöü]{2,9}(?:\s*-\s*[A-Za-zÄÖÜäöü]{2})?)\s+(\d{1,2})\s+bis\s+(\d{1,2})\s+Uhr$/i

function parseClause(raw: string, clause: string): ChargeWindow {
  const match = CLAUSE.exec(clause)
  if (match === null) {
    throw new KarlsruheParseError(raw, `keine Tag-und-Stunden-Angabe in ${JSON.stringify(clause)}`)
  }
  const weekdays = parseDays(raw, match[1] as string)
  const fromHour = Number(match[2])
  const toHour = Number(match[3])

  if (fromHour > 24 || toHour > 24) {
    throw new KarlsruheParseError(raw, `Stunde über 24 in ${JSON.stringify(clause)}`)
  }
  // Stunde 24 heißt Minute 1440, nie 0 — wie in allen vier anderen Städten.
  // `täglich 0 bis 24 Uhr` steht elfmal im Feed und ist das Gegenteil von
  // „nie"; auf 0-0 abgebildet wäre es genau das (siehe `windowCovers`).
  const from = fromHour * 60
  const to = toHour * 60
  if (from >= to) {
    // Über Mitternacht kommt in Karlsruhe nicht vor: Der Feed schreibt
    // durchgehende Bewirtschaftung als `täglich 0 bis 24 Uhr`. Eine Spanne wie
    // `20 bis 8` zu zerlegen hieße, eine Lesart zu erfinden, die niemand
    // geprüft hat, und sie als ein Fenster zu speichern hieße „nie".
    throw new KarlsruheParseError(
      raw,
      `Spanne ${fromHour} bis ${toHour} endet nicht nach ihrem Anfang`
    )
  }
  return { weekdays, fromMinute: from, toMinute: to }
}

/**
 * Was in `parkzeit` steht: Zeitfenster und Zusatzregeln, getrennt.
 *
 * Anders als Hamburgs und Frankfurts Parser gibt dieser hier **zwei** Listen
 * zurück, und das ist keine Formsache: Karlsruhes Feld mischt zwei Arten von
 * Aussage in einer Zeichenkette. `werktags 8 bis 20 Uhr; Tagespauschale` sagt
 * einmal, wann kassiert wird, und einmal, dass es daneben eine Tageskarte
 * gibt. Ein `ChargeWindow[]` allein könnte den zweiten Halbsatz nur verlieren.
 */
export interface KarlsruheSchedule {
  windows: ChargeWindow[]
  /**
   * Klauseln, die kein Zeitfenster sind — wörtlich, wie sie im Feed stehen.
   *
   * Sie landen in `ParkingZone.unmodelledRules`. Das ist sicher, seit
   * `isUncertainAt` über `adventRulesOf` nur noch auf Regeln sieht, die den
   * Advent erwähnen: Ein „Tagespauschale" macht daraus keine Unsicherheit,
   * sondern nur einen Satz im Panel. Vor dieser Änderung hätte München
   * dasselbe Problem gehabt.
   */
  unmodelledRules: string[]
}

/**
 * Zerlegt `parkzeit`.
 *
 * Elf Schreibweisen über die 281 Karlsruher Automaten, gezählt am
 * 8. September 2026 — nicht die 29 der Rangliste in
 * `docs/staedte-recherche-2026-09.md`: Die zählen den ganzen Feed mit Landau,
 * Rastatt und dem Elsass. Alle elf passen auf dieselbe Form: Klauseln, durch
 * Semikolon getrennt, jede entweder ein Zeitfenster oder eine Zusatzregel.
 *
 *  - `werktags 8 bis 20 Uhr` (229)
 *  - `werktags 8 bis 20 Uhr; Tagespauschale` (22)
 *  - `täglich 6 bis 24 Uhr; Tagespauschale` (10)
 *  - `täglich 0 bis 24 Uhr` (9)
 *  - `Mo-Fr 9 bis 18 Uhr; Sa 9 bis 13 Uhr` (2), `Mo-Fr 8 bis 16 Uhr` (2),
 *    `täglich 0 bis 24 Uhr; Tagespauschale` (2), `Mo-Fr 8 bis 18 Uhr` (2),
 *    `Mo-Fr 8 bis 17 Uhr` (1), `täglich 6 bis 24 Uhr` (1)
 *
 * Alles andere wird abgewiesen, statt geraten.
 */
export function parseKarlsruheSchedule(raw: string): KarlsruheSchedule {
  if (raw.length > MAX_INPUT_LENGTH) {
    throw new KarlsruheParseError(raw.slice(0, 40), `${raw.length} Zeichen sind keine Zeitangabe`)
  }
  const text = raw.trim().replace(/\s+/g, ' ')
  if (text === '') throw new KarlsruheParseError(raw, 'leere Zeitangabe')

  const windows: ChargeWindow[] = []
  const unmodelledRules: string[] = []
  for (const part of text.split(';')) {
    const clause = part.trim()
    if (clause === '') continue
    const known = KNOWN_EXTRA_RULES.find((rule) => rule.toLowerCase() === clause.toLowerCase())
    if (known !== undefined) {
      unmodelledRules.push(known)
      continue
    }
    windows.push(parseClause(raw, clause))
  }

  // Eine Zeile, die nur aus Zusatzregeln besteht, sagt nichts darüber, wann
  // kassiert wird. Sie durchzulassen hieße, ein Gebiet mit null Fenstern
  // auszuliefern — und null Fenster heißt in `isChargeable` „nie".
  if (windows.length === 0) {
    throw new KarlsruheParseError(raw, 'keine einzige Zeitangabe, nur Zusätze')
  }
  return { windows, unmodelledRules }
}

/** Eine Stufe der Preistreppe: `30 min = 1,50 €`. */
const FEE_STEP = /^(\d{1,4})\s*min\.?\s*=\s*(\d{1,3})(?:,(\d{2}))?\s*€$/i

/** Die Tageskarte: `Tagespauschale = 15,00 €`. Kein Stundensatz. */
const FEE_FLAT = /^(?:Tagespauschale|Tageskarte)\s*=\s*(\d{1,3})(?:,(\d{2}))?\s*€$/i

/**
 * Zerlegt `gebuehren` — die Preistreppe.
 *
 * **Karlsruhe nennt keinen Stundensatz.** Es nennt vier Stützstellen, und der
 * Satz steckt in ihrem Verhältnis. Die Rangliste in
 * `docs/staedte-recherche-2026-09.md` hat das als Falle notiert, und sie ist
 * echt: Beide Karlsruher Treppen fangen mit `= 1,50 €` an, die eine bei 30
 * Minuten (3 €/h, Tarifzone 2, 184 Automaten) und die andere bei 15 Minuten
 * (6 €/h, Tarifzone 1, 94 Automaten). Wer die erste Zahl nimmt, nennt der
 * halben Innenstadt den halben Preis.
 *
 * Deshalb wird **jede** Stufe gelesen und gegen die anderen gehalten. Ist die
 * Treppe nicht linear, bricht der Parser ab, statt einen Wert zu wählen: In
 * Rastatt steht `15 min = 0,10 €; 30 min = 0,20 €; 45 min = 0,50 €;
 * 60 min = 0,80 €` — 0,40 €/h an der ersten Stufe, 0,80 €/h an der letzten.
 * Ein einzelner €/h-Wert wäre dort keine Vereinfachung, sondern eine falsche
 * Auskunft. In Karlsruhe ist heute jede Treppe linear; genau das hält der
 * Test gegen die Fixture fest.
 *
 * Die **Tagespauschale zählt nicht mit.** Sie ist ein anderer Tarif, kein
 * Punkt auf derselben Geraden (22,50 € für 24 h wären 0,94 €/h und zögen jede
 * Prüfung ins Absurde). Verloren geht sie trotzdem nicht: Der Datenbau legt
 * den Rohtext als `rawFee` ab, und das Panel zeigt ihn wörtlich.
 */
export function parseKarlsruheFee(raw: string | null | undefined): Fee {
  if (raw === null || raw === undefined) return { kind: 'unknown' }
  if (raw.length > MAX_INPUT_LENGTH) {
    throw new KarlsruheParseError(raw.slice(0, 40), `${raw.length} Zeichen sind keine Gebühr`)
  }
  const text = raw.trim().replace(/\s+/g, ' ')

  // Ein leeres Feld und ein Strich sind KEINE Gebühr von null. Drei Karlsruher
  // Zeilen lassen `gebuehren` leer — es sind genau die drei fremd betriebenen
  // Parkplätze mit `tarifzone` „0", die `isKarlsruheMachine` ohnehin
  // aussortiert.
  if (text === '' || text === '-') return { kind: 'unknown' }

  let centsPerHour: number | null = null
  let steps = 0
  for (const part of text.split(';')) {
    const clause = part.trim()
    if (clause === '') continue
    if (FEE_FLAT.test(clause)) continue

    const step = FEE_STEP.exec(clause)
    if (step === null) {
      throw new KarlsruheParseError(raw, `keine Stufe der Preistreppe in ${JSON.stringify(clause)}`)
    }
    const minutes = Number(step[1])
    const cents = Number(step[2]) * 100 + Number(step[3] ?? 0)

    // `0 min` ließe sich nicht in einen Stundensatz umrechnen, und `0,00 €`
    // ist kein Tarif — dieselbe Begründung wie in `parse-fee.ts`, `hamburg.ts`
    // und `frankfurt.ts`: Ein Nullbetrag ergäbe `exact` mit 0 Cent und damit
    // `priced: true`, also ein „0,00 €" auf dem Schirm. Was ein Nullbetrag im
    // Feed bedeutete, weiß niemand, und „kostenlos" ist die eine Lesart, die
    // er sicher nicht verdient.
    if (minutes === 0) {
      throw new KarlsruheParseError(raw, `0 Minuten sind keine Stufe (${JSON.stringify(clause)})`)
    }
    if (cents === 0) {
      throw new KarlsruheParseError(raw, `ein Betrag von 0,00 € ist kein Tarif (${JSON.stringify(clause)})`)
    }

    // Ganzzahlig gerechnet, damit kein Rundungsfehler eine krumme Treppe
    // gerade aussehen lässt. Ein Satz, der keine ganzen Cent je Stunde ergibt,
    // ist selbst ein Befund und keine Sache fürs Runden.
    const perHour = (cents * 60) / minutes
    if (!Number.isInteger(perHour)) {
      throw new KarlsruheParseError(
        raw,
        `${cents} Cent je ${minutes} min ergeben keinen ganzen Cent-Satz je Stunde`
      )
    }
    if (centsPerHour === null) centsPerHour = perHour
    else if (centsPerHour !== perHour) {
      throw new KarlsruheParseError(
        raw,
        `die Treppe ist nicht linear: ${centsPerHour} gegen ${perHour} Cent je Stunde`
      )
    }
    steps += 1
  }

  // Zwei Automaten tragen `Tagespauschale = 22,50 €` und sonst nichts. Das ist
  // ein Preis, aber kein Stundensatz — `unknown` heißt hier also
  // „gebührenpflichtig, Satz nicht in der Quelle", dieselbe ehrliche Antwort
  // wie in ganz München. Ein aus 22,50 € je 24 h gerechneter Stundensatz wäre
  // erfunden: Niemand zahlt dort 0,94 € für eine Stunde.
  if (steps === 0 || centsPerHour === null) return { kind: 'unknown' }
  return { kind: 'exact', centsPerHour }
}

/**
 * Zerlegt `max_parkdauer`: `2 Std.`, `1 Std.`, `24 h`.
 *
 * Vier Schreibweisen in Karlsruhe, davon eine `null` — nicht die 15 bzw. 16
 * des ganzen Feeds. Was hier bewusst **nicht** gelesen wird, steht in den
 * übrigen Gemeinden: `1 Monat` (Bretten), `3h30` (Landau), `max. 3,50€`
 * (ein Betrag im Dauerfeld) und `im Bau`. Jede davon bräuchte eine
 * Entscheidung, die niemand getroffen hat; sie werfen deshalb.
 *
 * Die Endungen stehen **lang vor kurz**. Das ist die Lehre aus München:
 * `Std(?:\.|)` wäre harmlos, aber `Stunde(?:n)?` als `(?:e|en)` geschrieben
 * läse bei „Stunden" nur „Stunde" und ließe ein „n" liegen — reguläre
 * Ausdrücke nehmen die erste passende Alternative, nicht die längste.
 *
 * `24 h` ist **kein Platzhalter** wie Hamburgs 9999, sondern eine echte
 * Grenze: Die 35 Automaten, die ihn tragen, sind die mit Tagespauschale. Wer
 * dort 25 Stunden steht, steht zu lange.
 */
const MAX_STAY = /^(\d{1,3})\s*(Stunden|Stunde|Std\.|Std|h)$/i

export function parseKarlsruheMaxStay(raw: string | null | undefined): number | undefined {
  if (raw === null || raw === undefined) return undefined
  if (raw.length > MAX_INPUT_LENGTH) {
    throw new KarlsruheParseError(raw.slice(0, 40), `${raw.length} Zeichen sind keine Parkdauer`)
  }
  const text = raw.trim().replace(/\s+/g, ' ')
  if (text === '' || text === '-') return undefined

  const match = MAX_STAY.exec(text)
  if (match === null) throw new KarlsruheParseError(raw, 'keine Stundenangabe')
  const hours = Number(match[1])
  // Wie in Frankfurt: „0 Std." hieße Parken verboten, und das steht dort
  // nicht.
  if (hours === 0) throw new KarlsruheParseError(raw, '0 Stunden sind keine Höchstparkdauer')
  if (hours > 24) {
    throw new KarlsruheParseError(raw, `${hours} Stunden sind keine Höchstparkdauer eines Automaten`)
  }
  return hours * 60
}

/**
 * Der Code, unter dem die Oberfläche eine Höchstparkdauer beschriftet.
 *
 * Dieselbe Übersetzung wie `frankfurtMaxStayCode` und `muenchenMaxStayCode`:
 * `maxStayLabel` im Web kennt Berlins Form `1h`/`30min`, und Karlsruhes
 * `2 Std.` stünde dort wörtlich in der Anzeige — fünf Städte, fünf
 * Schreibweisen für dieselbe Sache im selben Satz.
 */
export function karlsruheMaxStayCode(minutes: number): string {
  return minutes % 60 === 0 ? `${minutes / 60}h` : `${minutes}min`
}

/**
 * Legt die Gebühren mehrerer Automaten zu einer Aussage über ihre Fläche
 * zusammen — wie `mergeFrankfurtFees` es für einen Bewohnerparkbereich tut.
 *
 * Eigene Funktion statt der Frankfurter, obwohl die Rechnung dieselbe ist:
 * `mergeMuenchenWindows` steht aus demselben Grund neben
 * `mergeFrankfurtWindows`. Eine Stadt, die eine fremde Zusammenlegung
 * aufruft, erbt jede Änderung an ihr — und die Regel dieses Projekts lautet
 * „ein Feed, ein Parser".
 *
 * Automaten ohne Betrag zählen nicht mit: „die Quelle sagt hier nichts" ist
 * keine Aussage über den Preis und darf die Spanne nicht nach unten ziehen.
 */
export function mergeKarlsruheFees(fees: readonly Fee[]): Fee {
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
 * Vereinigt die Fenster mehrerer Automaten, doppelte heraus, Reihenfolge
 * stabil.
 *
 * Was hier bewusst NICHT passiert: benachbarte Fenster verschmelzen.
 * `8 bis 20` und `6 bis 24` als `6 bis 24` auszugeben hieße, der halben
 * Fläche vier Stunden Gebührenpflicht anzudichten, die dort niemand verlangt.
 */
export function mergeKarlsruheWindows(windows: readonly ChargeWindow[]): ChargeWindow[] {
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

/** Rohzeile eines Parkscheinautomaten, so weit wir sie lesen. */
export interface KarlsruheMachineProperties {
  id?: number | null
  /** Elf Werte im Feed, von „Karlsruhe" bis „Saverne". Der wichtigste Filter. */
  gemeinde?: string | null
  stadtteil?: string | null
  standort?: string | null
  /**
   * `"1"`, `"2"` — und `"0"` für die drei fremd betriebenen Parkplätze.
   *
   * Als **Zeichenkette**, nicht als Zahl. Das ist gegen die Fixture geprüft
   * und nicht nur behauptet: In Frankfurt stand `bewohnerparkzone` als
   * `string | null` im Interface und war im Feed eine Zahl. Ein Interface über
   * einer JSON-Datei ist eine Behauptung, kein Beweis.
   */
  tarifzone?: string | null
  parkzeit?: string | null
  max_parkdauer?: string | null
  stellplaetze?: number | null
  gebuehren?: string | null
  bemerkung?: string | null
  stand?: string | null
}

/** Rohzeile einer Stellplatzfläche. Mehr als das steht wirklich nicht drin. */
export interface KarlsruheAreaProperties {
  id?: number | null
  gemeinde?: string | null
  stand?: string | null
}

/** Wie die Stadt in `gemeinde` geschrieben ist. */
export const KARLSRUHE_GEMEINDE = 'Karlsruhe'

/**
 * Die Tarifzone der fremd betriebenen Parkplätze.
 *
 * P4 (Poststraße), P6 und P7 am Hauptbahnhof, betrieben von contipark.de bzw.
 * parken-in-karlsruhe.de. Sie stehen im selben Feed wie die städtischen
 * Automaten, tragen aber weder Gebühr noch Höchstparkdauer — und liegen näher
 * an zwei Stellplatzflächen als jeder städtische Automat. Ohne diesen Filter
 * bekämen diese beiden Flächen einen leeren Tarif von einem Betreiber, der
 * für sie gar nicht zuständig ist.
 */
const PRIVATE_TARIFZONE = '0'

/**
 * Ob eine Zeile ein städtischer Karlsruher Parkscheinautomat ist.
 *
 * Zwei Filter in einer Funktion, weil beide dieselbe Frage beantworten:
 * „gehört diese Zeile zu der Stadt, die wir ausliefern". 281 von 638 Zeilen
 * bestehen den ersten, 278 auch den zweiten.
 */
export function isKarlsruheMachine(properties: KarlsruheMachineProperties): boolean {
  return (
    properties.gemeinde === KARLSRUHE_GEMEINDE && properties.tarifzone !== PRIVATE_TARIFZONE
  )
}

/**
 * Wie weit ein Automat von einer Stellplatzfläche entfernt sein darf, damit
 * sein Tarif für sie gilt — in Metern.
 *
 * Diese Zahl ist gemessen, nicht gewählt. Karlsruhe ist die erste Stadt, in
 * der die Zuordnung Punkt→Fläche **nicht** über Punkt-in-Polygon laufen kann:
 * Die 282 Flächen sind nicht Gebiete, sondern die Stellplatzreihen selbst
 * (Median 128 m², zusammen 4,8 ha für 3.367 ausgewiesene Plätze — das
 * Metadatenfeld nennt sie „Flächen mit kostenpflichtige
 * Parkschein-Parkplätzen"). Ein Automat steht am Bordstein daneben, nicht in
 * der Reihe.
 *
 * Am Abzug vom 8. September 2026 durchgezählt, Abstand Punkt zu **Kante**
 * (nicht zum Schwerpunkt und nicht zum nächsten Stützpunkt — die längste
 * Kante misst 114 m):
 *
 * | Radius | Flächen ohne Automat | mit mehreren | uneins über die Gebühr | Automaten ohne Fläche |
 * | --- | --- | --- | --- | --- |
 * | 10 m | 6 | 13 | 0 | **3** |
 * | 15 m | 4 | 45 | 0 | 0 |
 * | **20 m** | **3** | 77 | 1 | 0 |
 * | 30 m | 3 | 122 | 2 | 0 |
 * | 40 m | 3 | 158 | 3 | 0 |
 * | 75 m | 3 | 221 | 19 | 0 |
 *
 * 20 m ist die Stelle, an der beide Kurven flach werden: Jeder Automat hat ab
 * 15 m eine Fläche, und die Zahl der Flächen ohne Automaten erreicht bei 20 m
 * ihren Boden von drei. Diese drei liegen am Bahnhofplatz und am Stadtgarten;
 * ihr nächster städtischer Automat steht 81, 99 und 101 m entfernt, gehört
 * also zu etwas anderem. Weiter aufzumachen kauft keine einzige zusätzliche
 * Fläche und handelt sich nur Widersprüche ein — bei 75 m sind es 19.
 */
export const KARLSRUHE_JOIN_RADIUS_M = 20

/**
 * Abstand eines Punktes zur nächsten Kante eines Ringes, in Metern.
 *
 * Zur **Kante**, nicht zum nächsten Stützpunkt: Karlsruhes Flächen haben im
 * Median 12 Stützpunkte, ihre längste Kante misst aber 114 m. Über die
 * Stützpunkte gerechnet läge ein Automat in der Mitte einer solchen Kante
 * scheinbar 57 m entfernt, obwohl er direkt an der Fläche steht — und der
 * Radius müsste auf einen Wert aufgeblasen werden, bei dem sich vier Flächen
 * um ihn streiten.
 *
 * Gerechnet wird in einer **lokalen Meter-Ebene** um den Punkt herum, nicht in
 * Grad: Ein Grad Länge misst auf 49° Nord nur 73 km gegen 111 km Breite. In
 * Grad gerechnet wäre jeder Ost-West-Abstand um die Hälfte zu groß, und der
 * Radius müsste die Verzerrung mit auffangen. Für zwanzig Meter in Karlsruhe
 * ist die Ebene genau genug — der Fehler gegen `distanceMetres` liegt bei
 * unter einem Promille; ein Test hält das fest.
 */
const METRES_PER_DEGREE_LAT = 111_320

function edgeDistanceMetres(ring: readonly Position[], point: Position): number {
  const metresPerDegreeLon = METRES_PER_DEGREE_LAT * Math.cos((point[1] * Math.PI) / 180)
  const toPlane = (position: Position): readonly [number, number] => [
    (position[0] - point[0]) * metresPerDegreeLon,
    (position[1] - point[1]) * METRES_PER_DEGREE_LAT,
  ]

  let best = Infinity
  for (let i = 1; i < ring.length; i += 1) {
    const [ax, ay] = toPlane(ring[i - 1] as Position)
    const [bx, by] = toPlane(ring[i] as Position)
    const dx = bx - ax
    const dy = by - ay
    const lengthSquared = dx * dx + dy * dy
    // Der Fußpunkt des Lotes, auf die Strecke geklemmt. Ohne das Klemmen
    // läge er bei einer kurzen Kante irgendwo auf ihrer Verlängerung, und ein
    // Automat hundert Meter weiter zählte als „an der Fläche".
    const t = lengthSquared === 0 ? 0 : Math.max(0, Math.min(1, (-ax * dx - ay * dy) / lengthSquared))
    best = Math.min(best, Math.hypot(ax + t * dx, ay + t * dy))
  }
  return best
}

/**
 * Ob ein Automat nah genug an einer Fläche steht, dass sein Tarif für sie
 * gilt.
 *
 * Bewusst der Abstand zur Kante und **nicht** zusätzlich eine
 * Punkt-in-Polygon-Prüfung: Ein Punkt im Inneren einer Fläche ist von ihrer
 * Kante höchstens ein paar Meter entfernt — die Flächen sind Stellplatzreihen
 * von wenigen Metern Breite. Zwei Prüfungen, die dasselbe Ergebnis liefern,
 * sind eine zu viel; die zweite wäre die, die niemand mehr testet.
 */
export function isKarlsruheMachineNearArea(
  polygons: readonly PolygonRings[],
  point: Position,
  radiusMetres: number = KARLSRUHE_JOIN_RADIUS_M
): boolean {
  if (!Number.isFinite(point[0]) || !Number.isFinite(point[1])) return false
  return polygons.some((rings) =>
    rings.some((ring) => ring.length >= 2 && edgeDistanceMetres(ring, point) <= radiusMetres)
  )
}

/**
 * Die Kennung einer Fläche, wie sie in der Oberfläche steht.
 *
 * Der Feed vergibt genau eine Identität — `id`, 1 bis 292 mit Lücken. Es gibt
 * keinen Namen, keine Nummer eines Gebiets, keinen Stadtteil. Jede schönere
 * Beschriftung wäre erfunden; der Datenbau setzt den Stadtteil daneben, und
 * der kommt aus dem Automaten, nicht aus der Fläche.
 */
export function karlsruheAreaLabel(properties: KarlsruheAreaProperties): string {
  const id = properties.id
  return typeof id === 'number' && Number.isInteger(id) ? String(id) : '?'
}
