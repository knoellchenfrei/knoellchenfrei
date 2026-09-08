/**
 * Der Düsseldorfer Feed-Dialekt.
 *
 * Was `parse-schedule.ts`/`parse-fee.ts` für Berlin, `hamburg.ts` für Hamburg,
 * `frankfurt.ts` für Frankfurt und `muenchen.ts` für München tun, tut diese
 * Datei für Düsseldorf — und wieder getrennt, nach derselben Regel: ein Feed,
 * ein Parser. Die fünf Grammatiken teilen sich kein einziges Muster. Berlin
 * schreibt `Mo-Sa 9-20 Uhr`, Hamburg `werktags 9-20 Uhr`, Frankfurt
 * `Mo-Sa 9-20`, München einen ganzen Satz — und Düsseldorf
 * `werktags, 9 bis 20 Uhr` mit dem Wort „bis" statt eines Bindestrichs und
 * einem Komma zwischen Tagesangabe und Spanne.
 *
 * Datensätze, abgerufen am 8. September 2026 von
 * <https://maps.duesseldorf.de/services/verkehr/wfs>:
 * `verkehr:bewohnerparken` (65 Merkmale, 44 Gebiete) und
 * `verkehr:parkscheinautomaten` (732 Punkte).
 * Fixtures: `test/fixtures/dus-*-2026-09-08.json`.
 *
 * **Zwei Notationen in einem Dienst, und deshalb zwei Zeitparser.** Das Gebiet
 * schreibt `werktags, 9 bis 20 Uhr`, der Automat zwanzig Meter daneben
 * `Werktags 09:00 - 20:00`. Dieselbe Behörde, dieselbe Aussage, zwei
 * Schreibweisen. Ein Parser für beide müsste `werktags, 09:00 - 20:00`
 * ebenfalls annehmen — eine Schreibweise, die es nirgends gibt und deren
 * Bedeutung damit niemand geprüft hat. Getrennt bleibt jeder von beiden so
 * eng, wie seine Quelle wirklich ist.
 *
 * **Das Komma ist Trenner und Bindeglied zugleich**, wie in Köln das `+`:
 *
 * ```
 * werktags, 9 bis 20 Uhr                              ← Komma bindet Tag an Spanne
 * m bis fr, 8 bis 18 Uhr, sa 8 bis 14 Uhr             ← und trennt zwei Klauseln
 * montags bis freitags, 8 bis 18 Uhr, samstags, 8 bis 14 Uhr   ← beides, zweimal
 * ```
 *
 * Aufgelöst wird das nicht durch eine Heuristik, sondern durch die Form: Eine
 * Klausel ist `Tagesangabe [,] Spanne`, und zwischen zwei Klauseln steht ein
 * Komma. Der Abtaster unten läuft **lückenlos** über die Zeichenkette (`y`),
 * also bleibt am Ende nichts unbesehen liegen. Wer stattdessen an `,` splittet,
 * bekommt aus der ersten Zeile zwei Bruchstücke, von denen das eine keine Zeit
 * und das andere keine Tage hat.
 */

import type { Weekday } from './berlin-time.js'
import type { Fee } from './parse-fee.js'
import type { ChargeWindow } from './tariff.js'

export class DuesseldorfParseError extends Error {
  constructor(
    readonly raw: string,
    reason: string
  ) {
    super(`Düsseldorfer Feed: ${JSON.stringify(raw)} — ${reason}`)
    this.name = 'DuesseldorfParseError'
  }
}

/** Wie in allen anderen Parsern: fremde Eingabe wird zuerst begrenzt. */
const MAX_INPUT_LENGTH = 160

const ALL_DAYS: readonly Weekday[] = [0, 1, 2, 3, 4, 5, 6]

/**
 * `werktags` ist Montag bis **Samstag** — und das ist hier gemessen, nicht nur
 * hergeleitet.
 *
 * In Hamburg stand für dieselbe Festlegung die Legaldefinition in § 3 Abs. 2
 * BUrlG und die ständige Rechtsprechung des BGH. Düsseldorfs Feed liefert den
 * Beleg gleich selbst, und der ist stärker als jede Auslegung: Er kennt
 * **alle drei** Schreibweisen nebeneinander — `montags bis freitags`,
 * `werktags` und `montags bis sonntags`. Zwei davon sind vergeben; für
 * `werktags` bleibt nur Montag bis Samstag übrig. Wäre `werktags` gleich
 * Montag bis Freitag, hätte der Dienst zwei Wörter für dieselbe Menge und
 * keines für Montag bis Samstag.
 *
 * Die Gegenprobe steht im Abzug vom 8. September: Acht Gebiete, die im
 * Dateiabzug vom 11. Dezember 2025 noch `montags bis freitags, 9 bis 20 Uhr`
 * hießen, heißen jetzt `werktags, 9 bis 20 Uhr`. Die Stadt hat dort den
 * Samstag hinzugenommen und dafür das Wort gewechselt.
 *
 * Andersherum gelesen meldete die App an 47 der 65 Merkmale samstags
 * „gebührenfrei", und das kostet ein Knöllchen.
 */
const WEEKDAYS_MO_SA: readonly Weekday[] = [1, 2, 3, 4, 5, 6]

/**
 * Die Wochentage des Feeds. Sonntag ist 0, wie in `berlin-time.ts`.
 *
 * Die Kurzformen stehen hier, weil der Feed sie schreibt und nicht, weil sie
 * naheliegen: `m bis fr, 8 bis 18 Uhr, sa 8 bis 14 Uhr` (Hasselsstraße) ist
 * die einzige Zeile mit Abkürzungen, und sie kürzt Montag auf ein **einzelnes
 * `m`** ab. Die übrigen zweibuchstabigen Formen sind dieselbe Abkürzungsregel
 * auf dieselben sieben Wörter angewandt — kein geratenes zweites Vokabular.
 */
const DAY_NAMES: Record<string, Weekday> = {
  sonntags: 0,
  so: 0,
  montags: 1,
  mo: 1,
  m: 1,
  dienstags: 2,
  di: 2,
  mittwochs: 3,
  mi: 3,
  donnerstags: 4,
  do: 4,
  freitags: 5,
  fr: 5,
  samstags: 6,
  sonnabends: 6,
  sa: 6,
}

/**
 * Ein einzelner Wochentag, **lange Form vor kurzer** und mit hinterer
 * Wortgrenze.
 *
 * Beides hat in München je einen Vorfall hinter sich. Die Reihenfolge:
 * Reguläre Ausdrücke nehmen die erste passende Alternative, nicht die längste
 * — stünde `mo` vor `montags`, läse der Ausdruck aus `montags` ein `mo` und
 * ließe `ntags` liegen. Und die Grenze: Ohne sie fände `m` das „m" in
 * **mittwochs**, `so` das „so" in **sonntags**. `\b` taugt dafür nicht, weil
 * zwischen einem Buchstaben und einer Ziffer eine Wortgrenze steht und
 * `sa 8 bis 14 Uhr` genau so geschrieben ist; richtig ist `(?![\p{L}])` —
 * Ziffer erlaubt, Buchstabe nicht.
 */
const DAY =
  '(?:sonnabends|sonntags|samstags|donnerstags|dienstags|mittwochs|montags|freitags|mo|di|mi|do|fr|sa|so|m)(?![\\p{L}])'

/** `werktags`, `täglich`, `sonntags` oder `montags bis freitags`. */
const DAY_SPEC = `(?:werktags(?![\\p{L}])|t(?:ä|ae)glich(?![\\p{L}])|${DAY}(?:\\s*bis\\s+${DAY})?)`

/**
 * Eine Zeitspanne des Gebiets-Feldes: `9 bis 20 Uhr`, `24 Stunden`.
 *
 * Minuten kommen im Abzug nirgends vor; die Form `9:30` ist trotzdem
 * zugelassen, weil sie dieselbe Schreibweise mit derselben Einheit wäre und
 * nicht eine erfundene. Alles andere weist der Abtaster ab.
 */
const SPAN = '(?:(\\d{1,2})(?::(\\d{2}))?\\s*bis\\s+(\\d{1,2})(?::(\\d{2}))?\\s*uhr|24\\s*stunden)'

/** `Tagesangabe [,] Spanne` — das Komma zwischen beiden ist freigestellt. */
const CLAUSE = new RegExp(`(${DAY_SPEC})\\s*,?\\s*${SPAN}`, 'uy')

/** Was zwischen zwei Klauseln stehen darf. Beobachtet ist nur das Komma. */
const SEPARATOR = /\s*,\s*/uy

function expandDays(raw: string, spec: string): readonly Weekday[] {
  if (spec === 'werktags') return WEEKDAYS_MO_SA
  if (spec === 'täglich' || spec === 'taeglich') return ALL_DAYS

  const parts = spec.split(/\s*bis\s+/u)
  const from = DAY_NAMES[parts[0] as string]
  const to = parts.length === 1 ? from : DAY_NAMES[parts[1] as string]
  if (from === undefined || to === undefined) {
    // Kann heute nicht eintreten — `DAY` und `DAY_NAMES` führen dieselben
    // Wörter. Die Abfrage steht für den Tag, an dem jemand nur eine der beiden
    // Listen ergänzt: Eine leere Wochentagsliste hieße „nie gebührenpflichtig",
    // und das ist die teuerste stille Antwort, die dieser Parser geben könnte.
    throw new DuesseldorfParseError(raw, `unbekannte Tagesangabe ${JSON.stringify(spec)}`)
  }
  if (from === to) return [from]

  // Rundlauf statt einer aufsteigenden Schleife, damit auch `sa bis mo` etwas
  // Sinnvolles ergibt statt still leer zu bleiben. Die Spannweite wird
  // gerechnet, nicht erlaufen — so kann die Schleife nicht endlos werden.
  const span = (to - from + 7) % 7
  const days: Weekday[] = []
  for (let step = 0; step <= span; step += 1) days.push(((from + step) % 7) as Weekday)
  return days.sort((a, b) => a - b)
}

function minutesOf(raw: string, hour: string, minute: string | undefined): number {
  const hours = Number(hour)
  const minutes = Number(minute ?? 0)
  if (hours > 24 || minutes > 59) {
    throw new DuesseldorfParseError(raw, `${hour}:${minute ?? '00'} ist keine Uhrzeit`)
  }
  return hours * 60 + minutes
}

function windowOf(raw: string, match: RegExpExecArray): ChargeWindow {
  const weekdays = expandDays(raw, (match[1] as string).trim())

  // `24 Stunden` — der Zweig ohne Zahlen. Vier Gebiete schreiben ihn
  // (Christophstraße, Moorenplatz, Moorenstraße und im Dateiabzug auch
  // Kaiserswerth), und gemeint ist rund um die Uhr, nicht „nie".
  if (match[2] === undefined) return { weekdays, fromMinute: 0, toMinute: 1440 }

  const from = minutesOf(raw, match[2], match[3])
  const to = minutesOf(raw, match[4] as string, match[5])

  // Stunde 24 heisst Minute 1440, nie 0 — wie in allen vier anderen Städten.
  if (from >= to) {
    // Über Mitternacht kommt im Abzug nicht vor. Eine Spanne wie `22 bis 2 Uhr`
    // stillschweigend als ein Fenster zu speichern hieße „nie" (siehe
    // `windowCovers`); sie wie in Hamburg auf zwei Tage zu zerlegen hieße,
    // eine Lesart zu erfinden, die hier niemand geprüft hat. Der Datenbau soll
    // anhalten, sobald die Quelle so etwas anfängt.
    throw new DuesseldorfParseError(raw, `die Spanne endet nicht nach ihrem Anfang`)
  }
  return { weekdays, fromMinute: from, toMinute: to }
}

/**
 * Trennt den Teil ab, den das Modell nicht ausdrücken kann.
 *
 * Zwei Gebiete tragen einen Schrägstrich: `werktags, 9 bis 20 Uhr / teils
 * 9 bis 22 Uhr` (Unterbilk und Friedrichstadt am 8. September; im Dateiabzug
 * vom 11. Dezember 2025 stand dort `montags bis freitags, 9 bis 18 Uhr /
 * teilweise montags bis sonntags, 9 bis 23 Uhr*`, mit einem Sternchen, dessen
 * Fußnote nirgends mitgeliefert wird).
 *
 * „teils" sagt, dass es einen Teil des Gebiets gibt, für den etwas anderes
 * gilt — und **welchen Teil, sagt die Quelle nicht**. Der Zusatz bekommt
 * deshalb kein Fenster aus dem Text, sondern landet wörtlich in
 * `unmodelledRules`. Dieselbe Behandlung wie Berlins „Advents-Sa" und Münchens
 * „an Schultagen".
 */
export function duesseldorfExtraRules(raw: string | null | undefined): string[] {
  if (raw === null || raw === undefined) return []
  if (raw.length > MAX_INPUT_LENGTH) return []
  const slash = raw.indexOf('/')
  if (slash < 0) return []
  const tail = raw.slice(slash + 1).trim()
  return tail === '' ? [] : [tail]
}

/**
 * Zerlegt `zeitraum` eines Bewohnerparkgebiets.
 *
 * Zwölf Schreibweisen über 65 Merkmale, alle auf derselben Form. Was hinter
 * einem Schrägstrich steht, wird hier **abgeschnitten** und nicht gelesen —
 * es ist eine Aussage über einen Teil des Gebiets, den die Quelle nicht
 * benennt; `duesseldorfExtraRules` gibt es unverändert weiter.
 */
export function parseDuesseldorfSchedule(raw: string): ChargeWindow[] {
  if (raw.length > MAX_INPUT_LENGTH) {
    throw new DuesseldorfParseError(raw.slice(0, 40), `${raw.length} Zeichen sind keine Zeitangabe`)
  }
  const slash = raw.indexOf('/')
  const base = slash < 0 ? raw : raw.slice(0, slash)

  // Kleinschreibung einmal am Anfang statt eines `i`-Flags: Mit `i` fände `mi`
  // das „mi" in „mit" und `fr` das „fr" in „free floating" — genau der Fehler,
  // an dem in München 176 von 291 Texten hingen. Ohne Flag steht die
  // Fallunterscheidung an genau einer Stelle.
  const text = base.trim().replace(/\s+/gu, ' ').toLowerCase()
  if (text === '') throw new DuesseldorfParseError(raw, 'leere Zeitangabe')

  const windows: ChargeWindow[] = []
  let index = 0
  for (;;) {
    CLAUSE.lastIndex = index
    const match = CLAUSE.exec(text)
    if (match === null) {
      throw new DuesseldorfParseError(
        raw,
        `keine Tag-und-Stunden-Angabe ab ${JSON.stringify(text.slice(index, index + 30))}`
      )
    }
    windows.push(windowOf(raw, match))
    index = CLAUSE.lastIndex
    if (index >= text.length) return windows

    SEPARATOR.lastIndex = index
    const separator = SEPARATOR.exec(text)
    if (separator === null) {
      throw new DuesseldorfParseError(
        raw,
        `unverstandener Rest ${JSON.stringify(text.slice(index, index + 30))}`
      )
    }
    index = SEPARATOR.lastIndex
  }
}

/**
 * Zerlegt `tarifzeiten` eines Parkscheinautomaten.
 *
 * Drei Schreibweisen über 732 Automaten — `Werktags 09:00 - 20:00`,
 * `Werktags 09:00 - 22:00`, `Täglich 07:00 - 20:00`. Der sauberste Feed, den
 * dieses Projekt bisher gesehen hat, und trotzdem eine andere Notation als das
 * Gebiets-Feld derselben Behörde: Uhrzeiten mit Doppelpunkt, Bindestrich statt
 * „bis", kein „Uhr", kein Komma.
 */
const AUTOMAT_CLAUSE = new RegExp(
  `^(${DAY_SPEC})\\s+(\\d{1,2}):(\\d{2})\\s*-\\s*(\\d{1,2}):(\\d{2})$`,
  'u'
)

export function parseDuesseldorfAutomatSchedule(raw: string): ChargeWindow[] {
  if (raw.length > MAX_INPUT_LENGTH) {
    throw new DuesseldorfParseError(raw.slice(0, 40), `${raw.length} Zeichen sind keine Tarifzeit`)
  }
  const text = raw.trim().replace(/\s+/gu, ' ').toLowerCase()
  if (text === '') throw new DuesseldorfParseError(raw, 'leere Tarifzeit')

  const match = AUTOMAT_CLAUSE.exec(text)
  if (match === null) throw new DuesseldorfParseError(raw, 'keine erkennbare Tarifzeit')

  const weekdays = expandDays(raw, (match[1] as string).trim())
  const from = minutesOf(raw, match[2] as string, match[3])
  const to = minutesOf(raw, match[4] as string, match[5])
  if (from >= to) {
    throw new DuesseldorfParseError(raw, 'die Tarifzeit endet nicht nach ihrem Anfang')
  }
  return [{ weekdays, fromMinute: from, toMinute: to }]
}

/**
 * Beträge im Feed: `4,50 € pro Stunde`.
 *
 * Wieder eine eigene Schreibweise: Hamburg schreibt `3,50 € je Stunde`,
 * Frankfurt `2 €/h`, Berlin `2,00 Euro`. Ein Wort Unterschied, und Hamburgs
 * Ausdruck um `pro` zu erweitern hieße, an einem regulären Ausdruck zu
 * drehen, der 146 Hamburger Gebiete richtig liest, um einer Stadt willen, die
 * ihn gar nicht benutzt.
 */
const DUESSELDORF_AMOUNT = /^(\d{1,3}),(\d{2})\s*€\s*pro\s+Stunde$/iu

export function parseDuesseldorfFee(raw: string | null | undefined): Fee {
  if (raw === null || raw === undefined) return { kind: 'unknown' }
  if (raw.length > MAX_INPUT_LENGTH) {
    throw new DuesseldorfParseError(raw.slice(0, 40), `${raw.length} Zeichen sind keine Gebühr`)
  }
  const text = raw.trim()
  // Ein leeres Feld und ein Strich sind KEINE Gebühr von null. „Die Quelle
  // sagt nichts" ist keine Aussage über den Preis.
  if (text === '' || text === '-') return { kind: 'unknown' }

  const match = DUESSELDORF_AMOUNT.exec(text)
  if (match === null) throw new DuesseldorfParseError(raw, 'kein erkennbarer Betrag je Stunde')
  const centsPerHour = Number(match[1]) * 100 + Number(match[2])
  // Dieselbe Begründung wie in den vier anderen Gebührenparsern: `0,00 € pro
  // Stunde` wäre ein `exact` mit 0 Cent und damit `priced: true` — der einzige
  // Weg, an `CostEstimate.priced` vorbei ein „0,00 €" auf den Schirm zu
  // bringen. Was ein Nullbetrag im Feed bedeutete, weiss niemand, und
  // „kostenlos" ist die eine Lesart, die er sicher nicht verdient. Ausserdem
  // zöge er in `mergeDuesseldorfFees` die Spanne eines ganzen Gebiets nach
  // unten.
  if (centsPerHour === 0) {
    throw new DuesseldorfParseError(raw, 'ein Betrag von 0,00 € ist kein Tarif')
  }
  return { kind: 'exact', centsPerHour }
}

/**
 * Zerlegt `hoechstparkzeit`: `2 h` und `ohne`.
 *
 * **`ohne` heisst „keine", nicht null Minuten.** 558 der 732 Automaten tragen
 * das Wort. Es als 0 zu lesen hieße „Höchstparkdauer 0 Minuten", also Parken
 * verboten — und das steht dort nicht. Dieselbe Falle wie Hamburgs `9999`,
 * Frankfurts `-` und Kölns `0`; Düsseldorf ist die einzige der fünf Städte,
 * die sie ausschreibt.
 */
export function parseDuesseldorfMaxStay(raw: string | null | undefined): number | undefined {
  if (raw === null || raw === undefined) return undefined
  if (raw.length > MAX_INPUT_LENGTH) {
    throw new DuesseldorfParseError(raw.slice(0, 40), `${raw.length} Zeichen sind keine Parkdauer`)
  }
  const text = raw.trim()
  if (text === '' || text === '-' || /^ohne$/iu.test(text)) return undefined

  const match = /^(\d{1,2})\s*h$/iu.exec(text)
  if (match === null) throw new DuesseldorfParseError(raw, 'keine Stundenangabe')
  const hours = Number(match[1])
  if (hours === 0) throw new DuesseldorfParseError(raw, '0 h ist keine Höchstparkdauer')
  return hours * 60
}

/**
 * Der Code, unter dem die Oberfläche eine Höchstparkdauer beschriftet.
 *
 * Wie `frankfurtMaxStayCode`: `maxStayLabel` im Web kennt Berlins Form
 * `1h`/`30min`. Düsseldorfs `2 h` fiele dort durch und stünde wörtlich in der
 * Anzeige — zwei Städte, zwei Schreibweisen für dieselbe Sache im selben Satz.
 */
export function duesseldorfMaxStayCode(minutes: number): string {
  return minutes % 60 === 0 ? `${minutes / 60}h` : `${minutes}min`
}

/**
 * Legt die Gebühren mehrerer Automaten zu einer Aussage über ihr Gebiet
 * zusammen.
 *
 * Drei Sätze stehen im Feed — 4,50 €, 3,00 € und 2,00 € je Stunde —, und in
 * vier der 29 Gebiete mit Automaten stehen zwei davon nebeneinander. Auf einen
 * Wert zu reduzieren verschätzte jemanden dort um 50 %; also `Fee.range`, wie
 * in Frankfurt und wie bei Berlins Zonen 41–43.
 *
 * Bewusst eine eigene Funktion und kein Aufruf von `mergeFrankfurtFees`,
 * obwohl die Rechnung dieselbe ist: Die beiden Städte teilen sich hier nur die
 * Form, nicht die Zukunft. Bekäme Frankfurt eines Tages einen Zonentarif
 * neben dem Automatentarif, müsste seine Zusammenlegung sich ändern — und
 * änderte dabei stillschweigend Düsseldorfs Preise mit.
 */
export function mergeDuesseldorfFees(fees: readonly Fee[]): Fee {
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
 * Vereinigt Fenster, die aus mehreren Quellen desselben Gebiets kommen.
 *
 * Ein Gebiet bringt seine Fenster aus zwei Richtungen mit: aus seinem eigenen
 * `zeitraum` und aus den `tarifzeiten` der Automaten darin. Bei 73 Automaten
 * in Unterbilk stünden sonst 73 gleiche Einträge in der ausgelieferten Datei.
 *
 * Was hier bewusst NICHT passiert: benachbarte Fenster verschmelzen. `9-20`
 * und `9-22` als `9-22` auszugeben hieße, dem halben Gebiet zwei Stunden
 * Gebührenpflicht anzudichten, die dort niemand verlangt — und genau diese
 * beiden Werte stehen in Unterbilk und Friedrichstadt nebeneinander.
 */
export function mergeDuesseldorfWindows(windows: readonly ChargeWindow[]): ChargeWindow[] {
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
 * Rohzeile eines Bewohnerparkgebiets, so weit wir sie lesen.
 *
 * Alle sechs Felder des Dienstes stehen hier, auch die beiden, die der
 * Datenbau nicht benutzt: Ein Feld, das im Interface fehlt, fällt bei der
 * nächsten Formprobe nicht auf.
 */
export interface DuesseldorfZoneProperties {
  /**
   * Kennung des **Merkmals**, nicht des Gebiets.
   *
   * Die wichtigste Falle dieses Feeds: Er liefert 65 Merkmale für 44 Gebiete.
   * Elf Gebiete kommen in mehreren Stücken (Immermannstraße achtmal,
   * Friedrichstadt viermal), jedes mit eigener `_uuid` und gleichen Sachdaten.
   * Wer hierauf gruppiert, liefert 65 Zonen aus, davon 21 Doppelgänger mit
   * demselben Namen — und die Zonenliste der Statistikseite zählte sie einzeln.
   * Die Identität eines Gebiets ist `kuerzel`.
   */
  _uuid?: string | null
  name?: string | null
  /** Der Kennbuchstabe auf dem Schild: `A`, `MÜ`, `LB`. 44 verschiedene. */
  kuerzel?: string | null
  /** `werktags, 9 bis 20 Uhr`, `montags bis sonntags, 24 Stunden` … */
  zeitraum?: string | null
  /**
   * Sprungadresse in die Gebietsliste der Stadt, mit Sprungmarke.
   *
   * Im Abzug vom 8. September lückenlos gesetzt und 44-mal verschieden — also
   * je Gebiet eine, auch bei den elf Gebieten, die in mehreren Stücken kommen.
   * Im Dateiabzug vom 11. Dezember 2025 fehlte sie bei drei Gebieten.
   */
  url?: string | null
  /** `JJJJ-MM-TT`, im Abzug vom 8. September durchgängig `2026-06-19`. */
  _last_update?: string | null
}

/** Rohzeile eines Parkscheinautomaten. */
export interface DuesseldorfAutomatProperties {
  _uuid?: string | null
  /** Laufende Nummer als **Zeichenkette**, nicht als Zahl. 732 verschiedene. */
  psa_nr?: string | null
  /** `Carlstor ggü. 2` — häufig mit angehängtem Leerzeichen. */
  standort?: string | null
  /** `Werktags 09:00 - 20:00`, `Täglich 07:00 - 20:00`. Drei Schreibweisen. */
  tarifzeiten?: string | null
  /** `4,50 € pro Stunde`, `3,00 € pro Stunde`, `2,00 € pro Stunde`. */
  tarifgebuehr?: string | null
  /** `2 h` oder `ohne`. */
  hoechstparkzeit?: string | null
  /**
   * `ja`, leer oder `null` — und die drei sind nicht dasselbe.
   *
   * 339-mal `ja`, 372-mal die leere Zeichenkette, 21-mal `null`. Ob leer
   * „nein" heisst oder „nicht erfasst", sagt der Feed nicht; deshalb wird das
   * Feld gar nicht ausgewertet.
   */
  kartenzahlung_moeglich?: string | null
  /** Die Zone der Park-App, `402101` … `402109` und `404771`. */
  app_sms_zone?: string | null
  /** Adresse für Störungsmeldungen, mit `?subject=` daran. */
  email?: string | null
  _last_update?: string | null
}

/**
 * Die Kennung eines Gebiets, wie sie in der Oberfläche steht.
 *
 * Name **und** Kennbuchstabe, weil beide gebraucht werden: Der Name verortet
 * („Unterbilk"), der Buchstabe steht auf dem Schild und im Bewohnerparkausweis
 * („R"). Hamburg hält es genauso, dort steckt der Code schon im Namen
 * (`N 101 Flughafenstraße`).
 *
 * Ohne Namen bleibt der Buchstabe allein — er ist die Identität des Gebiets
 * und im Abzug lückenlos vorhanden.
 */
export function duesseldorfZoneLabel(properties: DuesseldorfZoneProperties): string {
  const name = (properties.name ?? '').trim()
  const code = (properties.kuerzel ?? '').trim()
  if (name === '') return code === '' ? '?' : code
  return code === '' ? name : `${name} (${code})`
}
