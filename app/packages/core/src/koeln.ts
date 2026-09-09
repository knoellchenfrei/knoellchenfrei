/**
 * Der Kölner Feed-Dialekt.
 *
 * Der fünfte eigene Parser, nach derselben Regel wie die vier davor: ein Feed,
 * ein Parser. Köln ist dabei der erste Fall, in dem die Sachauskunft gar nicht
 * aus einem Geodienst kommt, sondern aus einer **CSV** — und der erste, dessen
 * Zeitangabe eine kleine Grammatik braucht, obwohl sie wie ein Feld aussieht.
 *
 * Zwei Quellen, gemessen am 8. September 2026:
 *
 * - `ms:bewohnerparkgebiete_zonen` aus
 *   <https://geoportal.stadt-koeln.de/wss/service/bewohnerparken_wfs/guest>
 *   — **47** Bewohnerparkgebiete, nur Geometrie und Name. Keine Zeit, keine
 *   Gebühr, keine Höchstparkdauer.
 * - `psa_2016.csv` aus dem offenen Datenportal der Stadt — **2.315**
 *   Parkscheinautomaten mit Gebührenzeit, Gebühr, Höchstparkdauer,
 *   Stellplatzzahl und Koordinaten.
 *
 * Fixtures: `test/fixtures/koeln-psa-2026-09-08.json` und
 * `test/fixtures/koeln-gebiete-2026-09-08.json`.
 *
 * ## Was dieser Parser ausdrücklich NICHT tut
 *
 * - **Einen Betrag ausgeben.** Die CSV nennt `0,50 €` und `1,00 €` je 20
 *   Minuten, also 1,50 € und 3,00 € je Stunde. Beide Werte sind mindestens
 *   zwei Erhöhungsrunden alt, und die Datei belegt das selbst: Ihre Spalte
 *   heißt `Tagesgebühr 4,00 €`, während die Stadt auf ihrer eigenen Seite
 *   „Parken rund um die Uhr" heute mit **5 Euro** beziffert. `parseKoelnFee`
 *   liest den Wert trotzdem — er soll geprüft und getestet sein, wenn die
 *   Stadt die Datei fortschreibt —, aber `build-data-koeln.ts` liefert
 *   `Fee = { kind: 'unknown' }` aus. Die Begründung steht in
 *   `docs/staedte-koeln.md`.
 * - **Einen uneindeutigen Beginn auflösen.** Sieben Automaten auf der
 *   Frankfurter Straße in Mülheim tragen `Mo-Sa 12:00/18:00 - 20:00`. Zwei
 *   Anfangszeiten, und die Quelle sagt nicht, wann welche gilt. Die Klausel
 *   ergibt deshalb **kein** Fenster und landet in `unmodelled` — wie Berlins
 *   „Advents-Sa".
 * - **Eine unplausible Koordinate reparieren.** 19 der 2.315 Zeilen stehen
 *   nicht in Köln: zwölfmal fehlt in der Ostkoordinate das Dezimalkomma
 *   (`7008383` statt `7,008383`), sechsmal ist eine Ziffer vertippt
 *   (`90,94144` statt `50,94144`), einmal fehlt die führende Fünf
 *   (`0,93180819`). Jede dieser Reparaturen wäre plausibel und keine wäre
 *   belegt — ein Automat am falschen Ort trägt seine Zeiten in das falsche
 *   Gebiet. `koelnAutomatPosition` gibt deshalb `null` zurück und der
 *   Datenbau zählt mit.
 */

import type { Weekday } from './berlin-time.js'
import { withinBounds, type BoundingBox, type Position } from './geo.js'
import type { Fee } from './parse-fee.js'
import type { ChargeWindow } from './tariff.js'

export class KoelnParseError extends Error {
  constructor(
    readonly raw: string,
    reason: string
  ) {
    super(`Kölner Feed: ${JSON.stringify(raw)} — ${reason}`)
    this.name = 'KoelnParseError'
  }
}

/**
 * Wie in den vier anderen Parsern: fremde Eingabe wird zuerst begrenzt.
 *
 * Der längste der 46 Werte misst 60 Zeichen
 * (`Mo-Mi+Fr 09:00 - 18:00; Do 14:00 - 18:00 + Sa 09:00 - 14:00`). 160 lässt
 * Luft für eine Fortschreibung und ist weit von allem entfernt, was jemand
 * als Angriff einschleusen würde.
 */
const MAX_INPUT_LENGTH = 160

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

// --------------------------------------------------------------- Zeitangaben

export interface KoelnSchedule {
  /** Der Quelltext, Leerraum normalisiert. */
  raw: string
  windows: ChargeWindow[]
  /** Was der Text sagt und `ChargeWindow` nicht ausdrücken kann. */
  unmodelled: string[]
}

/**
 * Die Bestandteile einer Gebührenzeit, in einer Alternative.
 *
 * Die Tagesabkürzungen brauchen **keine** hintere Wortgrenze, weil dieser Feed
 * — anders als Münchens Regelsätze — außer Tagen, Uhrzeiten und Trennern
 * nichts enthält: Jedes Zeichen, das hier nicht passt, bricht ab. Ein `Mi` in
 * „mit" kann es deshalb gar nicht geben, und die vordere Grenze entsteht
 * daraus, dass der Rest der Alternative alles Übrige abdeckt.
 *
 * `time` steht vor `dash`, damit `09:00` nicht als Ziffer plus Doppelpunkt
 * zerfällt.
 */
const TOKEN =
  /(?<day>Mo|Di|Mi|Do|Fr|Sa|So)|(?<time>\d{1,2}:\d{2})|(?<uhr>Uhr)|(?<dash>-)|(?<plus>\+)|(?<semi>;)|(?<slash>[/])|(?<space>\s+)/giu

type TokenKind = 'day' | 'time' | 'uhr' | 'dash' | 'plus' | 'semi' | 'slash'

interface Token {
  kind: TokenKind
  text: string
}

/**
 * Zerlegt die Zeile in Marken — und bricht bei jedem Zeichen ab, das keine ist.
 *
 * Anders als in München gibt es hier keine Füllwortliste. Der Feed schreibt in
 * 46 Schreibweisen ausschließlich Tage, Uhrzeiten, Trenner und ein einziges
 * überzähliges „Uhr"; alles andere wäre eine neue Regel und keine neue
 * Formulierung.
 */
function tokenise(raw: string, text: string): Token[] {
  const tokens: Token[] = []
  let consumed = 0
  TOKEN.lastIndex = 0
  for (const match of text.matchAll(TOKEN)) {
    const at = match.index
    if (at !== consumed) {
      throw new KoelnParseError(raw, `nicht gelesen: ${JSON.stringify(text.slice(consumed, at))}`)
    }
    consumed = at + match[0].length
    const groups = match.groups ?? {}
    if (groups['space'] !== undefined) continue
    const kind = (['day', 'time', 'uhr', 'dash', 'plus', 'semi', 'slash'] as const).find(
      (candidate) => groups[candidate] !== undefined
    )
    // Kann nicht eintreten, solange die Alternative und die Liste oben
    // dieselben Gruppen führen — steht hier, damit ein künftiger Zusatz in
    // der einen ohne die andere abbricht statt still zu verschwinden.
    if (kind === undefined) throw new KoelnParseError(raw, `unbekannte Marke ${JSON.stringify(match[0])}`)
    tokens.push({ kind, text: match[0] })
  }
  if (consumed !== text.length) {
    throw new KoelnParseError(raw, `nicht gelesen: ${JSON.stringify(text.slice(consumed))}`)
  }
  return tokens
}

function toMinutes(raw: string, text: string): number {
  const [hourPart, minutePart] = text.split(':')
  const hour = Number(hourPart)
  const minute = Number(minutePart)
  if (!Number.isInteger(hour) || hour > 24 || minute > 59) {
    throw new KoelnParseError(raw, `keine gültige Uhrzeit: ${JSON.stringify(text)}`)
  }
  return hour * 60 + minute
}

interface Clause {
  days: Weekday[]
  /** Alle genannten Anfangszeiten. Mehr als eine heißt: uneindeutig. */
  starts: number[]
  end: number | null
  /** Wörtlich, für die Meldung in `unmodelled`. */
  rawStarts: string
}

function sortedUnique(days: readonly Weekday[]): Weekday[] {
  return [...new Set(days)].sort((a, b) => a - b)
}

/**
 * Ein Tagesbereich `Mo-Sa` — als Rundlauf, damit `Sa-Mo` etwas Sinnvolles
 * ergibt statt still leer zu bleiben.
 */
function dayRange(from: Weekday, to: Weekday): Weekday[] {
  const span = (to - from + 7) % 7
  const days: Weekday[] = []
  for (let step = 0; step <= span; step += 1) days.push(((from + step) % 7) as Weekday)
  return days
}

/**
 * Ein Tageskürzel zu seiner Zahl.
 *
 * Der Abbruch ist heute unerreichbar: `TOKEN` gibt nur die sieben Kürzel
 * heraus, die `DAY_NAMES` kennt. Er steht trotzdem hier — läuft eines Tages
 * die Alternative im Muster mit der Tabelle auseinander, ist ein Abbruch die
 * richtige Antwort und `undefined` als Wochentag die falscheste.
 */
function dayOf(raw: string, text: string): Weekday {
  const day = DAY_NAMES[text.toLowerCase()]
  if (day === undefined) throw new KoelnParseError(raw, `unbekannter Wochentag ${JSON.stringify(text)}`)
  return day
}

/**
 * Zerschneidet die Marken in Klauseln — und `+` ist dabei **zweierlei**.
 *
 * Das ist die eine Stelle, an der dieser Feed nicht trivial ist. Ein `+`
 * verbindet Wochentage (`Mo-Mi+Fr`, `Do + Sa`, `Mi+Sa`, `Mo-Di+Do-Fr`) *und*
 * es trennt zwei vollständige Klauseln (`Mo-Fr 09:00 - 21:00 + Sa 10:00 -
 * 15:00`). Beides steht im selben Datensatz, zweimal sogar in derselben Zeile:
 *
 *     Mo-Mi+Fr 09:00 - 18:00; Do 14:00 - 18:00 + Sa 09:00 - 14:00
 *
 * Wer `+` fest als Trenner liest, macht aus `Mo-Mi+Fr 09:00 - 20:00` zwei
 * Klauseln, von denen die erste keine Zeit hat und die zweite keinen Bereich —
 * und wer es fest als Tagesverbinder liest, hängt `Sa 10:00 - 15:00` an
 * dieselbe Spanne wie `Mo-Fr 09:00 - 21:00` und lässt samstags eine Stunde
 * früher kassieren, als die Stadt es tut.
 *
 * Die Auflösung braucht keine Heuristik, nur die Reihenfolge: Ein `+` trennt
 * genau dann, wenn die laufende Klausel ihre Spanne **schon** hat. Dasselbe
 * gilt für einen Wochentag, der nach einer vollständigen Spanne auftaucht —
 * `Mo-Fr 09:00 - 18:00; Sa 09:00 - 14:00` kommt ohne `+` aus, und `;` trennt
 * immer.
 */
function splitClauses(raw: string, tokens: readonly Token[]): Clause[] {
  const clauses: Clause[] = []
  let current: Clause = { days: [], starts: [], end: null, rawStarts: '' }
  const finish = (): void => {
    if (current.days.length > 0 || current.starts.length > 0) clauses.push(current)
    current = { days: [], starts: [], end: null, rawStarts: '' }
  }

  let index = 0
  while (index < tokens.length) {
    const token = tokens[index] as Token
    if (token.kind === 'semi') {
      finish()
      index += 1
      continue
    }
    if (token.kind === 'plus') {
      if (current.end !== null) finish()
      index += 1
      continue
    }
    // Der eine überzählige Wert im Abzug endet auf „Uhr"; alle anderen 45
    // schreiben ihn nicht. Aufgenommen statt repariert: Ein Abbruch daran
    // hilft niemandem.
    if (token.kind === 'uhr') {
      index += 1
      continue
    }
    if (token.kind === 'day') {
      if (current.end !== null) finish()
      const next = tokens[index + 1]
      const after = tokens[index + 2]
      if (next?.kind === 'dash' && after?.kind === 'day') {
        current.days.push(...dayRange(dayOf(raw, token.text), dayOf(raw, after.text)))
        index += 3
        continue
      }
      current.days.push(dayOf(raw, token.text))
      index += 1
      continue
    }
    if (token.kind === 'time') {
      if (current.end !== null) {
        throw new KoelnParseError(raw, 'zweite Spanne ohne Trenner')
      }
      const rawStarts = [token.text]
      current.starts.push(toMinutes(raw, token.text))
      index += 1
      // `12:00/18:00 - 20:00`: weitere Anfangszeiten, durch Schrägstrich
      // getrennt.
      while (tokens[index]?.kind === 'slash' && tokens[index + 1]?.kind === 'time') {
        const alternative = tokens[index + 1] as Token
        rawStarts.push(alternative.text)
        current.starts.push(toMinutes(raw, alternative.text))
        index += 2
      }
      current.rawStarts = rawStarts.join('/')
      if (tokens[index]?.kind !== 'dash') {
        throw new KoelnParseError(raw, `kein Bindestrich nach ${JSON.stringify(current.rawStarts)}`)
      }
      index += 1
      const end = tokens[index]
      if (end?.kind !== 'time') {
        throw new KoelnParseError(raw, `keine Endzeit nach ${JSON.stringify(current.rawStarts)}`)
      }
      current.end = toMinutes(raw, end.text)
      index += 1
      continue
    }
    throw new KoelnParseError(raw, `unerwartetes ${JSON.stringify(token.text)}`)
  }
  finish()
  return clauses
}

/**
 * Eine Spanne auf Tage legen — auch über Mitternacht.
 *
 * 163 Automaten tragen `09:00 - 01:00` oder `19:00 - 01:00`, in der Innenstadt
 * und im Belgischen Viertel. Der zweite Teil gehört dem **Folgetag**: „Mo-Sa
 * 09:00 - 01:00" heißt auch Sonntag von 0 bis 1 Uhr, nicht Montag von 0 bis 1.
 * Beides in ein Fenster zu schreiben hiesse laut `windowCovers` „nie".
 */
function toWindows(days: readonly Weekday[], from: number, to: number): ChargeWindow[] {
  if (from < to) return [{ weekdays: days, fromMinute: from, toMinute: to }]
  const nextDay = sortedUnique(days.map((day) => ((day + 1) % 7) as Weekday))
  return [
    { weekdays: days, fromMinute: from, toMinute: 1440 },
    { weekdays: nextDay, fromMinute: 0, toMinute: to },
  ]
}

/**
 * Zerlegt die Spalte `Gebührenzeit`.
 *
 * 46 Schreibweisen über 2.315 Automaten. Der Feed nennt **immer** Wochentage —
 * es gibt keinen Wert ohne Tagesangabe, und deshalb hat dieser Parser auch
 * keine Vorgabe dafür. Das ist der Unterschied zu München, wo 3.909 Abschnitte
 * schweigen und die Vorgabe die folgenreichste Entscheidung des Parsers ist:
 * Hier gibt es nichts anzunehmen, und eine Klausel ohne Tage bricht ab.
 *
 * `Mo-So` steht in 87 Zeilen und meint den Sonntag wörtlich. Die Stadt
 * bestätigt das aus zweiter Quelle: Auf „Parken rund um die Uhr" schreibt sie,
 * an Sonn- und Feiertagen sei das Parken frei — „Ausnahmen sind der Nahbereich
 * der LANXESS arena, am Kölner Zoo und an der Koelnmesse". Genau dort stehen
 * die 87: in Deutz, an der Zoobrücke und auf der Riehler Straße.
 */
export function parseKoelnSchedule(raw: string | null | undefined): KoelnSchedule {
  if (raw === null || raw === undefined) throw new KoelnParseError('', 'keine Zeitangabe')
  if (raw.length > MAX_INPUT_LENGTH) {
    throw new KoelnParseError(raw.slice(0, 40), `${raw.length} Zeichen sind keine Zeitangabe`)
  }
  const text = raw.replace(/\s+/g, ' ').trim()
  if (text === '') throw new KoelnParseError(raw, 'leere Zeitangabe')

  const clauses = splitClauses(raw, tokenise(raw, text))
  if (clauses.length === 0) throw new KoelnParseError(raw, 'keine Klausel im Text')

  const windows: ChargeWindow[] = []
  const unmodelled = new Set<string>()
  for (const clause of clauses) {
    if (clause.days.length === 0) {
      throw new KoelnParseError(raw, 'Klausel ohne Wochentag')
    }
    if (clause.end === null) {
      throw new KoelnParseError(raw, 'Klausel ohne Zeitspanne')
    }
    const days = sortedUnique(clause.days)
    if (clause.starts.length > 1) {
      // Zwei Anfangszeiten, und die Quelle sagt nicht, wann welche gilt. Die
      // spätere zu nehmen ließe eine Stunde gebührenfrei aussehen, die es
      // nicht ist; die frühere behauptete eine Gebühr, die vielleicht nicht
      // anfällt. Also keine von beiden.
      unmodelled.add(`Beginn laut Quelle uneindeutig: ${clause.rawStarts} Uhr`)
      continue
    }
    const from = clause.starts[0] as number
    if (from === clause.end) {
      throw new KoelnParseError(raw, `Spanne ${clause.rawStarts} ist leer`)
    }
    windows.push(...toWindows(days, from, clause.end))
  }

  return { raw: text, windows, unmodelled: [...unmodelled] }
}

// ------------------------------------------------------------------- Gebühr

/** `0,50 €` — der einzige Aufbau, den die Spalte kennt. */
const AMOUNT = /^(\d{1,3}),(\d{2})\s*€$/

/**
 * Die Bezugsdauer der Spalte, in Minuten.
 *
 * Sie steht nicht im Wert, sondern **im Spaltennamen**: `Gebühr je 20 Minuten`.
 * Deshalb steht sie hier als Konstante mit Namen und nicht als 3 irgendwo in
 * einer Rechnung — wer sie eines Tages ändert, muss die Spaltenprüfung in
 * `parseKoelnAutomats` mitziehen, und die schlägt fehl, wenn der Kopf nicht
 * mehr passt.
 */
const FEE_PERIOD_MINUTES = 20

/**
 * Zerlegt die Spalte `Gebühr je 20 Minuten` und rechnet auf die Stunde um.
 *
 * **Der Wert wird bewusst nicht ausgeliefert.** Er ist veraltet, und zwar
 * belegbar aus der Datei selbst: Sie führt eine Spalte `Tagesgebühr 4,00 €`,
 * während die Stadt Köln auf ihrer Seite „Parken rund um die Uhr" (abgerufen
 * am 8. September 2026) für dieselbe Leistung **5 Euro** nennt. Die
 * Pressemitteilung zur Parkgebührenordnung 2025 nennt für das Kurzzeitparken
 * 5 € je Stunde in der Innenstadt „vormals 4 Euro" und 2,50 € in den
 * Stadtbezirken 2 bis 9 „vormals 2 Euro" — der Datensatz kennt mit 3,00 €
 * und 1,50 € je Stunde **weder den neuen noch den vorherigen** Satz.
 *
 * Die Funktion steht trotzdem hier, mit Test: Sie ist der Schalter, den
 * jemand umlegt, sobald die Stadt die Datei fortschreibt. Was fehlt, ist der
 * Beleg, nicht der Code.
 */
export function parseKoelnFee(raw: string | null | undefined): Fee {
  if (raw === null || raw === undefined) return { kind: 'unknown' }
  if (raw.length > MAX_INPUT_LENGTH) {
    throw new KoelnParseError(raw.slice(0, 40), `${raw.length} Zeichen sind keine Gebühr`)
  }
  const text = raw.replace(/\s+/g, ' ').trim()
  if (text === '' || text === '-') return { kind: 'unknown' }

  const match = AMOUNT.exec(text)
  if (match === null) throw new KoelnParseError(raw, 'kein erkennbarer Betrag')
  const cents = Number(match[1]) * 100 + Number(match[2])
  // Dieselbe Begründung wie in Berlin, Hamburg und Frankfurt: `exact` mit 0
  // Cent liefert `priced: true`, und das ist der einzige Weg, an
  // `CostEstimate` vorbei ein „0,00 €" auf den Schirm zu bringen. Was ein
  // Nullbetrag in dieser Spalte bedeutete, weiß niemand; im Abzug steht
  // keiner.
  if (cents === 0) throw new KoelnParseError(raw, 'ein Betrag von 0,00 € ist kein Tarif')

  // 20 teilt 60 ohne Rest, die Umrechnung ist also exakt und braucht keine
  // Rundung: 50 Cent werden zu 150. Der Tag, an dem das nicht mehr stimmt,
  // ist der Tag, an dem die Spalte anders heißt — und den fängt die
  // Kopfprüfung in `parseKoelnAutomats`, nicht eine Rundungsregel hier.
  return { kind: 'exact', centsPerHour: (cents * 60) / FEE_PERIOD_MINUTES }
}

// --------------------------------------------------------- Höchstparkdauer

/**
 * Zerlegt die Spalte `Höchstparkdauer` — eine nackte Stundenzahl.
 *
 * Zwölf Werte über den Abzug: 1, 2, 4, 7, 8, 9, 10, 11, 12, 14, 16 — und
 * **0**, viermal. Wie Hamburgs `9999` ist die Null ein Platzhalter, dessen
 * Bedeutung der Datensatz nicht nennt; sie als echte Null zu lesen hiesse
 * „Höchstparkdauer 0 Minuten", also Parken verboten, und das steht dort
 * nicht. Die vier Zeilen (Josefstr. 6 in Porz, Olpener Str. 9-13 in Kalk,
 * Geibelstr. 29 in Lindenthal-Süd, Elstergasse 3 am Neumarkt) tragen alle
 * eine gewöhnliche Gebührenzeit und eine gewöhnliche Gebühr — es fehlt nur
 * diese eine Angabe.
 */
export function parseKoelnMaxStay(raw: string | null | undefined): number | undefined {
  if (raw === null || raw === undefined) return undefined
  const text = raw.trim()
  if (text === '') return undefined
  if (!/^\d{1,2}$/.test(text)) throw new KoelnParseError(raw, 'keine Stundenzahl')
  const hours = Number(text)
  if (hours === 0) return undefined
  if (hours > 24) throw new KoelnParseError(raw, `${hours} Stunden sind keine Höchstparkdauer`)
  return hours * 60
}

/**
 * Der Code, unter dem die Oberfläche eine Höchstparkdauer beschriftet.
 *
 * Dieselbe Übersetzung wie in Frankfurt und München und trotzdem hier noch
 * einmal: Die Städte teilen sich absichtlich keinen Code, an dem eine Änderung
 * für eine Stadt die andere trifft. Köln kennt nur volle Stunden — die Minuten
 * stehen hier für den Tag, an dem die Stadt eine halbe schreibt.
 */
export function koelnMaxStayCode(minutes: number): string {
  return minutes % 60 === 0 ? `${minutes / 60}h` : `${minutes}min`
}

// -------------------------------------------------------------------- Fenster

/**
 * Vereinigt die Fenster mehrerer Automaten zu einer Aussage über ihr Gebiet.
 *
 * Wie in Frankfurt und München: doppelte heraus, Reihenfolge stabil — ein
 * Gebiet hat bis zu 130 Automaten, und `Mo-Sa 09:00 - 23:00` stünde sonst
 * hundertfach in der ausgelieferten Datei. Und wie dort **nicht**: benachbarte
 * Fenster verschmelzen. Aus `09:00-18:00` und `18:00-23:00` ein `09:00-23:00`
 * zu machen hiesse, einem Teil des Gebiets fünf Stunden anzudichten, die dort
 * niemand verlangt.
 */
export function mergeKoelnWindows(windows: readonly ChargeWindow[]): ChargeWindow[] {
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

// -------------------------------------------------------------- Die CSV-Datei

/**
 * Die Spalten, die `psa_2016.csv` führen **muss**.
 *
 * Geprüft statt geglaubt, und zwar aus zwei Gründen. Erstens: Eine umbenannte
 * Spalte ergäbe sonst überall den leeren Wert, und leer heißt bei drei der
 * vier Parsern „keine Angabe" — der Datenbau liefe durch und lieferte 47
 * Gebiete ohne Zeiten aus. Zweitens steht die Bezugsdauer der Gebühr **im
 * Spaltennamen**: Wenn aus `Gebühr je 20 Minuten` eines Tages
 * `Gebühr je 30 Minuten` wird, ist jede Umrechnung falsch, und nichts am Wert
 * selbst würde das verraten.
 */
export const KOELN_CSV_COLUMNS = [
  'PSA-Nr',
  'Aufstellort',
  'Bezirk/Gebiet',
  'Stellplätze',
  'Gebührenzeit',
  'Gebühr je 20 Minuten',
  'Höchstparkdauer',
  'Tagesgebühr 4,00 €',
  'GeoKoordinateNord',
  'GeoKoordinateOst',
] as const

/** Obergrenzen für eine Datei aus fremder Hand. */
const MAX_CSV_BYTES = 8 * 1024 * 1024
const MAX_CSV_ROWS = 50_000

/** Eine Rohzeile der CSV, so weit wir sie lesen. */
export interface KoelnAutomat {
  /** Laufende Nummer der Stadt. Im Abzug 2.315-mal verschieden. */
  number: string
  /** Adresse, wörtlich: `Deutzer Freiheit 53`. */
  location: string
  /** Gebiets- oder Bezirksname der Stadt — **kein** Schlüssel, siehe unten. */
  area: string
  spaces: number
  rawHours: string
  rawFee: string
  rawMaxStay: string
  /** Ob die Zeile die Tagesgebühr führt (`JA`). Der Betrag steht im Spaltenkopf. */
  dayRate: boolean
  rawNorth: string
  rawEast: string
}

/**
 * Liest die CSV — mit Anführungszeichen, und das ist keine Vorsicht.
 *
 * Sieben der 2.315 Zeilen tragen ein Feld in Anführungszeichen, und es sind
 * ausgerechnet die interessantesten: Die zusammengesetzten Gebührenzeiten
 * enthalten selbst ein Semikolon —
 * `"Mo-Mi+Fr 09:00 - 20:00; Do + Sa 15:00 - 20:00"` — und eine achte Zeile
 * schreibt ein verdoppeltes Anführungszeichen (`"""Hagen""-Gelände"`). Ein
 * `line.split(';')` zerlegt genau diese acht falsch, und zwar leise: Aus einer
 * Gebührenzeit werden zwei Felder, alles dahinter rutscht um eins, und die
 * Koordinate landet in der Spalte der Höchstparkdauer.
 *
 * Deshalb ein Leser nach RFC 4180 statt eines `split`. Er gehört nach `core`,
 * weil er fremde Eingaben zerlegt — dieselbe Regel, aus der auch der
 * Telegram-Parser hier liegt.
 */
function readCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false
  let index = 0
  // Ein BOM steht heute nicht in der Datei. Er kostet nichts und wäre sonst
  // Teil des ersten Spaltennamens — die Kopfprüfung schlüge fehl, und die
  // Meldung nennte einen Namen, der auf dem Bildschirm richtig aussieht.
  if (text.charCodeAt(0) === 0xfeff) index = 1

  const endField = (): void => {
    row.push(field)
    field = ''
  }
  const endRow = (): void => {
    endField()
    rows.push(row)
    row = []
  }

  while (index < text.length) {
    const char = text[index] as string
    if (quoted) {
      if (char === '"') {
        if (text[index + 1] === '"') {
          field += '"'
          index += 2
          continue
        }
        quoted = false
        index += 1
        continue
      }
      field += char
      index += 1
      continue
    }
    if (char === '"' && field === '') {
      quoted = true
      index += 1
      continue
    }
    if (char === ';') {
      endField()
      index += 1
      continue
    }
    if (char === '\r' || char === '\n') {
      endRow()
      // CRLF ist ein Zeilenende, nicht zwei. Die Datei benutzt es durchgehend.
      if (char === '\r' && text[index + 1] === '\n') index += 2
      else index += 1
      continue
    }
    field += char
    index += 1
  }
  if (field !== '' || row.length > 0) endRow()
  return rows
}

function cell(row: readonly string[], at: number): string {
  return (row[at] ?? '').trim()
}

/**
 * Die Anzahl Stellplätze eines Automaten.
 *
 * Vier Zeilen lassen die Spalte leer. Das ergibt 0 statt eines Abbruchs: Die
 * Zahl ist Beiwerk in der Anzeige, und ein Gebiet wegen einer fehlenden
 * Stellplatzangabe gar nicht auszuliefern wäre die schlechtere Antwort.
 */
export function koelnSpaces(raw: string | null | undefined): number {
  if (raw === null || raw === undefined) return 0
  const value = Number(raw.trim())
  return Number.isInteger(value) && value > 0 && value < 10_000 ? value : 0
}

/**
 * Zerlegt die ganze Datei.
 *
 * Bricht ab, wenn der Kopf nicht stimmt oder eine Zeile zu wenige Felder hat.
 * Beides wäre sonst still: Ein verschobener Kopf liefert lauter leere Werte,
 * und leer heißt hier „keine Angabe" — 2.315 Automaten ohne Zeit, ohne
 * Fehler, ohne Hinweis.
 */
export function parseKoelnAutomats(csv: string): KoelnAutomat[] {
  if (csv.length > MAX_CSV_BYTES) {
    throw new KoelnParseError('psa.csv', `${csv.length} Zeichen sind keine Automatenliste`)
  }
  const rows = readCsv(csv)
  const header = rows[0]
  if (header === undefined) throw new KoelnParseError('psa.csv', 'leere Datei')

  const columns = new Map(header.map((name, position) => [name.trim(), position]))
  const at = (name: (typeof KOELN_CSV_COLUMNS)[number]): number => {
    const position = columns.get(name)
    if (position === undefined) {
      throw new KoelnParseError('psa.csv', `Spalte ${JSON.stringify(name)} fehlt im Dateikopf`)
    }
    return position
  }
  // Einmal vorab, damit eine fehlende Spalte den Lauf sofort anhält statt
  // 2.315-mal dieselbe Meldung zu werfen.
  for (const name of KOELN_CSV_COLUMNS) at(name)

  const body = rows.slice(1).filter((row) => row.some((value) => value.trim() !== ''))
  if (body.length > MAX_CSV_ROWS) {
    throw new KoelnParseError('psa.csv', `${body.length} Zeilen sind keine Automatenliste`)
  }

  return body.map((row, line) => {
    if (row.length < header.length) {
      throw new KoelnParseError(`Zeile ${line + 2}`, `${row.length} statt ${header.length} Feldern`)
    }
    return {
      number: cell(row, at('PSA-Nr')),
      location: cell(row, at('Aufstellort')),
      area: cell(row, at('Bezirk/Gebiet')),
      spaces: koelnSpaces(cell(row, at('Stellplätze'))),
      rawHours: cell(row, at('Gebührenzeit')),
      rawFee: cell(row, at('Gebühr je 20 Minuten')),
      rawMaxStay: cell(row, at('Höchstparkdauer')),
      dayRate: cell(row, at('Tagesgebühr 4,00 €')).toUpperCase() === 'JA',
      rawNorth: cell(row, at('GeoKoordinateNord')),
      rawEast: cell(row, at('GeoKoordinateOst')),
    }
  })
}

// --------------------------------------------------------------- Koordinaten

/**
 * Eine deutsche Dezimalzahl aus der CSV — oder `null`.
 *
 * `50,93686078`. Kein `parseFloat`: Das liest `50,9` als 50 und wäre 100 km
 * daneben, ohne zu murren.
 */
function decimal(raw: string): number | null {
  const text = raw.trim()
  if (!/^-?\d{1,3}(?:,\d{1,12})?$/.test(text)) return null
  return Number(text.replace(',', '.'))
}

/**
 * Die Position eines Automaten — oder `null`, wenn sie nicht in Köln liegt.
 *
 * Die CSV führt die Koordinaten bereits in Grad (WGS 84), in zwei Spalten und
 * mit Dezimalkomma; **Nord vor Ost**, also Breite vor Länge — umgekehrt zur
 * GeoJSON-Reihenfolge, die diese Funktion zurückgibt. Die Umprojektion aus
 * UTM betrifft nur die Gebietsgeometrie aus dem WFS, nicht diese Punkte.
 *
 * Warum ein Rahmen und keine Reparatur: 19 Zeilen stehen außerhalb, und jede
 * hat einen erkennbaren Tippfehler — zwölfmal fehlt das Dezimalkomma in der
 * Ostkoordinate (`7008383`), sechsmal ist eine Ziffer daneben (`90,94144`,
 * `9,95552`, `50,3736`), einmal fehlt die führende Fünf (`0,93180819`). Die
 * naheliegende Reparatur wäre bei jeder einzelnen plausibel und bei keiner
 * belegt. Ein Automat, den man 60 km nach Süden repariert hat, trägt seine
 * Zeiten in das Gebiet, in dem er nach der Reparatur liegt — und das sähe auf
 * der Karte nach nichts aus.
 */
export function koelnAutomatPosition(
  automat: Pick<KoelnAutomat, 'rawNorth' | 'rawEast'>,
  bounds: BoundingBox
): Position | null {
  const lat = decimal(automat.rawNorth)
  const lon = decimal(automat.rawEast)
  if (lat === null || lon === null) return null
  const point: Position = [lon, lat]
  return withinBounds(point, bounds) ? point : null
}

// ------------------------------------------------------------ Die Gebiete

/** Rohzeile eines Bewohnerparkgebiets aus dem WFS. */
export interface KoelnZoneProperties {
  gid?: string | null
  /** Der Name, unter dem die Stadt das Gebiet führt: `Belgisches Viertel`. */
  Name?: string | null
  /** Das Kürzel auf dem Automaten und im Bewohnerparkausweis: `BELG`. */
  'Abkürzung'?: string | null
  /** Adresse der Gebietsseite bei stadt-koeln.de. In allen 47 Zeilen gesetzt. */
  Weitere_Informationen?: string | null
}

/**
 * Der Name, unter dem ein Gebiet in der Oberfläche steht.
 *
 * Wie in München ein echter Name und keine Nummer — `Belgisches Viertel` statt
 * `11`. Alle 47 sind gesetzt und alle 47 sind verschieden; das zählt, weil der
 * Name zugleich der Schlüssel ist, unter dem das Gebiet ausgeliefert wird.
 */
export function koelnZoneLabel(properties: KoelnZoneProperties): string {
  const name = properties.Name?.trim() ?? ''
  return name === '' ? '?' : name
}

/**
 * Was der Feed über ein Gebiet sonst noch sagt — oder `null`.
 *
 * Das Kürzel ist die eine Angabe, die jemandem vor Ort etwas nützt: Es steht
 * auf dem Automaten und auf dem Bewohnerparkausweis, und in der CSV trägt es
 * die Spalte `Roter Punkt`. Die Adresse aus `Weitere_Informationen` wird
 * bewusst **nicht** ausgegeben — wie in München: Das Panel hat für einen Link
 * keine Stelle, und eine nackte URL im Fließtext ist keiner.
 */
export function koelnZoneNote(properties: KoelnZoneProperties): string | null {
  const parts: string[] = []
  const short = properties['Abkürzung']?.trim() ?? ''
  const name = properties.Name?.trim() ?? ''
  // Wo das Kürzel nur der Name selbst ist (`Deutz I`, `Nippes III`), sagt es
  // nichts Zusätzliches und bleibt weg.
  if (short !== '' && short.toLowerCase() !== name.toLowerCase()) {
    parts.push(`Kürzel auf dem Automaten: ${short}`)
  }
  if ((properties.Weitere_Informationen?.trim() ?? '') !== '') {
    parts.push('Gebietsseite bei stadt-koeln.de')
  }
  return parts.length === 0 ? null : parts.join(' · ')
}
