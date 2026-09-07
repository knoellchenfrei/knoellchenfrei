/**
 * Der Münchner Feed-Dialekt.
 *
 * Der vierte eigene Parser, nach derselben Regel wie die drei davor: ein Feed,
 * ein Parser. Und er ist mit Abstand der aufwendigste, weil München als
 * einzige der vier Städte die Regel nicht in Felder zerlegt, sondern **als
 * Satz** ausliefert. Zum Vergleich, gezählt am Abzug vom 7. September 2026:
 * Berlin hat 18 Schreibweisen seiner Zeitangabe, Hamburg 10, Frankfurt 30 —
 * München **291**, und sie sind zusammengesetzt:
 *
 *     Absolutes Halteverbot 6:30-8:30 Uhr und 16-19 Uhr,
 *     Eingeschränktes Halteverbot 8:30-16 Uhr, Mischparken 19-23 Uhr
 *
 * Das ist ein Wert eines Feldes. Ein regulärer Ausdruck bekommt das nicht,
 * eine kleine Grammatik schon.
 *
 * Datensätze, abgerufen am 7. September 2026 aus
 * <https://geoportal.muenchen.de/geoserver/mor_wfs/ows>:
 * `mor_wfs:ruhver_prm_gebiete_poly` (82 Parkraummanagementgebiete) und
 * `mor_wfs:ruhver_parkseiten_line` (13.714 Straßenseiten).
 * Fixture: `test/fixtures/muc-parkseiten-2026-09-07.json`.
 *
 * ## Was der Parser ausdrücklich NICHT tut
 *
 * - **`an Schultagen` auflösen.** Ein Schulkalender ist keine Feiertagstabelle;
 *   er ist je Land und Jahr anders und steht nirgends in dieser Quelle. Solche
 *   Regeln landen in `unmodelled` und von dort in `unmodelledRules` der Zone.
 * - **`sonst Mischparken` in Fenster übersetzen.** Naheliegend wäre das
 *   Komplement der vorher genannten Zeiten — und es wäre falsch. Bei
 *   `Eingeschränktes Halteverbot 7-20 Uhr, sonst Mischparken` ergäbe das
 *   Komplement „gebührenpflichtig von 20 bis 7 Uhr und den ganzen Sonntag";
 *   gemeint ist aber „außerhalb des Halteverbots gilt die gewöhnliche
 *   Mischparken-Regelung des Gebiets", also 9–23 Uhr. Die Quelle sagt nur
 *   *welche* Regel gilt, nicht *wann*. Solche Klauseln bekommen deshalb
 *   `timing: 'otherwise'` und **keine** Fenster; das Gebiet trägt seine
 *   gewöhnlichen Zeiten ohnehin aus den Abschnitten, die sie ausschreiben.
 * - **Einen Betrag erfinden.** In keinem der 291 Texte steht `€`, `Euro` oder
 *   `EUR`. Der Tarif steht ausschließlich in der Gebührenordnung, und die ist
 *   eine PDF-Auskunft, keine Datenquelle. Jedes Gebiet bekommt
 *   `Fee = { kind: 'unknown' }`.
 */

import type { Weekday } from './berlin-time.js'
import type { ChargeWindow } from './tariff.js'

export class MuenchenParseError extends Error {
  constructor(
    readonly raw: string,
    reason: string
  ) {
    super(`Münchner Feed: ${JSON.stringify(raw)} — ${reason}`)
    this.name = 'MuenchenParseError'
  }
}

/**
 * Wie in den drei anderen Parsern: fremde Eingabe wird zuerst begrenzt.
 *
 * Großzügiger als dort, weil die Texte hier wirklich lang sind — der längste
 * im Abzug misst 212 Zeichen (`Absolutes Halteverbot 7-18 Uhr werktags Montag
 * bis Freitag an Schultagen, …`). 400 lässt Luft für eine Fortschreibung und
 * ist immer noch weit von allem entfernt, was jemand als Angriff einschleusen
 * würde.
 */
const MAX_INPUT_LENGTH = 400

/** Was eine Klausel über das Parken sagt. */
export type MuenchenRuleKind =
  /** Besucher zahlen: Mischparken, Kurzzeitparken, Altstadt- und Hauptbahnhoftarif. */
  | 'charge'
  /** Nur mit Bewohnerparkausweis. Kein Betrag, aber für Besucher gesperrt. */
  | 'licence'
  /** Parkscheibe — kostet nichts und verlangt trotzdem etwas. */
  | 'disc'
  /** Absolutes oder eingeschränktes Halteverbot. */
  | 'noStopping'
  /** Für eine bestimmte Gruppe reserviert: Behinderte, Taxi, Bus, Carsharing, Ladeplatz. */
  | 'reserved'
  /** Ausdrücklich freies Parken oder „keine Regelung". */
  | 'free'
  /** Trägt keine Aussage über das Parken von Besuchern. */
  | 'other'

/**
 * Die Regelarten, für die dieses Modell ein Gebührenfenster ausgibt.
 *
 * Alle drei heißen für jemanden, der einen Platz sucht, dasselbe: **hier ist
 * Parken nicht einfach frei.** Zahlen, Ausweis oder Scheibe sind
 * verschiedene Formen derselben Auskunft, und das Gebiet mischt sie ohnehin —
 * in München stehen Mischparken, Bewohnerparken und Parkscheibe regelmäßig in
 * einem einzigen Gebiet nebeneinander. Was genau gilt, steht am Schild; dass
 * überhaupt etwas gilt, steht hier.
 */
const PARKING_KINDS: ReadonlySet<MuenchenRuleKind> = new Set(['charge', 'licence', 'disc'])

export interface MuenchenClause {
  kind: MuenchenRuleKind
  /** Leer, wenn die Klausel keine eigene Zeitangabe trägt. */
  windows: ChargeWindow[]
  /** Höchstparkdauer, sofern die Klausel eine nennt (`Kurzzeitparken 2h`). */
  maxStayMinutes?: number
  /**
   * `timed` — die Klausel nennt eigene Stunden.
   * `otherwise` — mit `sonst` eingeleitet: sagt welche Regel, nicht wann.
   * `untimed` — nennt gar keine Zeit (`Carsharing free floating`).
   */
  timing: 'timed' | 'otherwise' | 'untimed'
  /** Der Ausschnitt des Quelltexts, aus dem diese Klausel gelesen wurde. */
  raw: string
}

export interface MuenchenRule {
  raw: string
  clauses: MuenchenClause[]
  /** Was der Text sagt und `ChargeWindow` nicht ausdrücken kann. */
  unmodelled: string[]
}

// --------------------------------------------------------------- Wochentage

/** Sonntag ist 0, wie in `berlin-time.ts`. */
const DAY_NAMES: Record<string, Weekday> = {
  sonntag: 0,
  montag: 1,
  dienstag: 2,
  mittwoch: 3,
  donnerstag: 4,
  freitag: 5,
  samstag: 6,
  so: 0,
  mo: 1,
  di: 2,
  mi: 3,
  do: 4,
  fr: 5,
  sa: 6,
  // Die adverbialen Formen: `Eingeschränktes Halteverbot 7-14 Uhr samstags`.
  montags: 1,
  dienstags: 2,
  mittwochs: 3,
  donnerstags: 4,
  freitags: 5,
  samstags: 6,
  sonntags: 0,
}

/**
 * `werktags` heißt Montag bis **Samstag**, nicht Montag bis Freitag.
 *
 * Werktage sind nach deutschem Sprachgebrauch und § 3 Abs. 2 BUrlG alle Tage
 * außer Sonn- und Feiertagen. Der Feed bestätigt das aus sich selbst heraus:
 * Er schreibt an 27 Stellen `werktags Montag bis Freitag` — die Einengung wäre
 * überflüssig, wenn `werktags` schon Montag bis Freitag hieße.
 */
const WERKTAGS: readonly Weekday[] = [1, 2, 3, 4, 5, 6]

/**
 * Die Tage, die gelten, wenn der Text **keine** nennt.
 *
 * Das ist die folgenreichste Entscheidung dieses Parsers: 3.909 der 13.714
 * Abschnitte tragen schlicht `Mischparken 9-23 Uhr`, ohne ein Wort über
 * Wochentage. Alle sieben Tage anzunehmen hieße, in ganz München sonntags
 * Gebühren zu verlangen; das wäre der teuerste stille Fehler, den diese App
 * machen kann.
 *
 * Montag bis Samstag steht hier deshalb nicht als Ortskenntnis, sondern als
 * Befund aus dem Feed selbst, ausgezählt über alle 291 Texte:
 *
 * - Wo Wochentage genannt werden, hängt die gewöhnliche Neun-bis-dreiundzwanzig
 *   an Montag bis Freitag **und an Samstag** (`Mischparken 18-23 Uhr Montag bis
 *   Freitag und 9-23 Uhr Samstag`, 85-mal in dieser Form).
 * - **Sonntag kommt in genau vier Texten vor**, und dort ausgeschrieben:
 *   `Parkscheibe 2h 9-18 Uhr Montag bis Sonntag` (Blaue Zone Messestadt Riem),
 *   `9-18 Uhr Samstag bis Sonntag`, `(Fr-So)`, `Taxi 15-5 Uhr Samstag und
 *   Sonntag`. Der Feed *kann* also Sonntag sagen und tut es, wo er ihn meint.
 * - Kein einziger Text hängt eine gebührenpflichtige Regel an einen Sonntag,
 *   ohne ihn zu nennen.
 *
 * Die Annahme ist damit belegt und trotzdem eine Annahme — sie steht deshalb
 * hier an einer Stelle, mit Test, statt verstreut in Regeln.
 */
const DEFAULT_DAYS: readonly Weekday[] = WERKTAGS

// ------------------------------------------------------------------ Lexikon

interface Keyword {
  phrase: string
  kind: MuenchenRuleKind
}

/**
 * Die Regelarten, die der Feed kennt — **als Phrasen, längste zuerst**.
 *
 * Die Reihenfolge ist die halbe Grammatik: `Mischparken mit Parkscheibe` muss
 * vor `Mischparken` stehen, sonst bleibt „mit Parkscheibe" als Rest liegen und
 * aus einem Scheibengebiet wird ein Gebührengebiet. Dasselbe gilt für
 * `Hauptbahnhoftarif Kurzzeitparken` vor `Kurzzeitparken`, `E-Carsharing` vor
 * `Carsharing` und `Bewohner frei` vor `Bewohner`.
 *
 * Der Text wird an genau diesen Phrasen in Klauseln zerschnitten — **nicht am
 * Komma**. Das Komma taugt nicht als Trenner: In
 * `8-14 Uhr Montag, Dienstag, Donnerstag, Hauptbahnhoftarif Kurzzeitparken 2h`
 * trennt es dreimal eine Wochentagsliste und einmal zwei Regeln.
 */
const KEYWORDS: readonly Keyword[] = [
  // Der einzige Text, der mit einer Zeitangabe *beginnt*. Als ganze Phrase im
  // Lexikon, weil sonst „0-24 Uhr" vor der ersten Klausel stünde und der
  // Parser zu Recht abbräche.
  { phrase: '0-24 Uhr keine Regelung', kind: 'free' },

  { phrase: 'Hauptbahnhoftarif Kurzzeitparken', kind: 'charge' },
  { phrase: 'Hauptbahnhoftarif Mischparken', kind: 'charge' },
  { phrase: 'Hauptbahnhoftarif', kind: 'charge' },
  { phrase: 'Altstadttarif', kind: 'charge' },
  { phrase: 'Blaue Zone Messestadt Riem', kind: 'disc' },

  { phrase: 'Mischparken mit Parkscheibe', kind: 'disc' },
  { phrase: 'Mischkurzzeitparken', kind: 'charge' },
  { phrase: 'Mischparken', kind: 'charge' },
  { phrase: 'gebührenpflichtiges Kurzzeitparken', kind: 'charge' },
  { phrase: 'Kurzzeitparken', kind: 'charge' },

  { phrase: 'Busparken mit Parkscheibe', kind: 'reserved' },
  { phrase: 'Busparken', kind: 'reserved' },
  { phrase: 'Parkscheibe', kind: 'disc' },

  { phrase: 'Bewohnerparken', kind: 'licence' },
  // „Bewohner frei" ist keine Regel für Besucher, sondern die Ausnahme für
  // Bewohner. Als eigene Klausel geführt, damit sie nicht als Rest der
  // vorigen liegen bleibt — und mit `other`, damit sie kein Fenster erzeugt.
  { phrase: 'Bewohner frei', kind: 'other' },
  { phrase: 'Bewohnerbevorrechtigung', kind: 'other' },
  { phrase: 'Bewohner', kind: 'licence' },

  { phrase: 'Absolutes Halteverbot', kind: 'noStopping' },
  { phrase: 'Eingeschränktes Halteverbot', kind: 'noStopping' },
  // Ein Tippfehler der Quelle: „Eingeschränktes 7-16 Uhr Samstag" ohne
  // „Halteverbot". Aufgenommen statt repariert — die Bedeutung ist eindeutig,
  // und ein Abbruch hier hilft niemandem.
  { phrase: 'Eingeschränktes', kind: 'noStopping' },

  { phrase: 'Behindertenparkplatz', kind: 'reserved' },
  { phrase: 'Behindertenparken', kind: 'reserved' },
  { phrase: 'E-Carsharing', kind: 'reserved' },
  { phrase: 'Carsharing', kind: 'reserved' },
  { phrase: 'E-Ladeinfrastruktur', kind: 'reserved' },
  { phrase: 'Taxiparken', kind: 'reserved' },
  { phrase: 'Taxi', kind: 'reserved' },
  { phrase: 'Fahrradparken', kind: 'reserved' },

  { phrase: 'Abends freies Parken', kind: 'free' },
  { phrase: 'freies Parken', kind: 'free' },
  { phrase: 'frei', kind: 'free' },

  { phrase: 'Kraftfahrzeugparken allgemein', kind: 'other' },
  { phrase: 'Baustelle erfasst', kind: 'other' },
  { phrase: 'Hotel Anfahrtszone', kind: 'other' },
  { phrase: 'Duales Parken Sommer/Winter', kind: 'other' },
  { phrase: 'Parken Dual', kind: 'other' },
  // Schreibfehler der Quelle für „Sonderparken Hauptbahnhof". Wörtlich
  // aufgenommen: Wer ihn stillschweigend korrigierte, bräche ab, sobald die
  // Stadt ihn korrigiert.
  { phrase: 'Siónderparken Hauptbahnhof', kind: 'other' },
  { phrase: 'Sonderparken Hauptbahnhof', kind: 'other' },
]

/**
 * Maskiert die Sonderzeichen einer Phrase — und `-` und `/` ausdrücklich nicht.
 *
 * Im `u`-Modus sind `\-` und `\/` **ungültige** Escapes und lassen den
 * regulären Ausdruck gar nicht erst entstehen. Beide Zeichen brauchen außerhalb
 * einer Zeichenklasse ohnehin keine Maskierung; `Duales Parken Sommer/Winter`
 * und `E-Carsharing` sind genau die Phrasen, die es betrifft.
 */
function escapeForRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Wortgrenzen um die Phrase — **Buchstaben**, nicht `\b`.
 *
 * Beide Seiten sind teuer erkauft. Ohne die *hintere* Grenze fand
 * `frei` das „Frei" in **Freitag**: Aus
 * `Mischparken 18-23 Uhr Montag bis Freitag` wurden zwei Klauseln, die zweite
 * hieß „frei" und hatte den Rest „tag", und die erste verlor ihre Tagesangabe.
 * 176 der 291 Texte brachen daran ab — laut, immerhin; leise wäre gewesen,
 * dass „Montag bis Freitag" zu „Montag" zusammenschrumpft.
 *
 * Und `\b` taugt für die hintere Grenze nicht: Die Quelle schreibt an zwei
 * Stellen `Mischparken13-23 Uhr` ohne Leerzeichen, und `\b` steht zwischen
 * `n` und `1` nicht. `(?![\p{L}])` lässt die Ziffer durch und den Buchstaben
 * nicht.
 */
const KEYWORD_PATTERN = new RegExp(
  `(?<![\\p{L}])(?:${KEYWORDS.map((entry) => escapeForRegExp(entry.phrase)).join('|')})(?![\\p{L}])`,
  'giu'
)

/** Welche Regelart eine gefundene Phrase meint. */
const KIND_BY_PHRASE = new Map(KEYWORDS.map((entry) => [entry.phrase.toLowerCase(), entry.kind]))

// -------------------------------------------------------- Klauselbestandteile

/**
 * Ein Wochentag, in jeder Form, die im Feed vorkommt — mit **Wortende**.
 *
 * Das `(?![\p{L}])` am Schluss ist nicht Kosmetik, sondern der Unterschied
 * zwischen einem Parser und einem Zufallsgenerator. Ohne es liest die
 * Abkürzungsliste bei `i`-Flag mitten in gewöhnlichen Wörtern mit: `Mi` in
 * „mit", `Fr` in „free floating", `So` in „sonst", `Mo` in „(Motorradparken)".
 * Aus `sonst Mischparken` wurde so eine Tagesangabe „Sonntag", und der Rest
 * „nst" brach den Datenbau ab — der laute Fall. Der leise wäre eine Klausel
 * gewesen, deren Fenster plötzlich am Sonntag hängt.
 *
 * Was hier bewusst **fehlt**: `täglich`. Frankfurts Parser kennt `Tgl.`, weil
 * es dort 19-mal im Feed steht; in Münchens 291 Texten kommt keine solche
 * Sammelform vor. Eine Schreibweise aufzunehmen, die die Quelle nicht benutzt,
 * hieße eine Bedeutung zu behaupten, die niemand geprüft hat — und ausgerechnet
 * bei dieser wäre die Behauptung „auch sonntags".
 */
const DAY_WORD =
  '(?:werktags|Montag|Dienstag|Mittwoch|Donnerstag|Freitag|Samstag|Sonntag' +
  '|montags|dienstags|mittwochs|donnerstags|freitags|samstags|sonntags' +
  '|Mo|Di|Mi|Do|Fr|Sa|So)(?![\\p{L}])'

/**
 * Die Bestandteile einer Klausel, in einer Alternative — Reihenfolge zählt.
 *
 * `span` vor `maxStay`, damit `9-18` nicht als „9 h" gelesen wird. `dayRun`
 * schluckt eine ganze Tagesangabe samt Verbindern (`Montag bis Freitag`,
 * `Samstag und Sonntag`, `werktags Montag bis Freitag`,
 * `Montag, Dienstag, Donnerstag`) — sonst müsste der Aufrufer raten, ob ein
 * `und` zwei Tage verbindet oder zwei Zeitgruppen trennt.
 */
const CLAUSE_TOKEN = new RegExp(
  [
    // Regeln, die dieses Modell nicht ausdrücken kann. Sie werden erkannt und
    // gemerkt, nicht überlesen. Die Endungen stehen absichtlich lang vor kurz:
    // `Schultag(?:e|en)?` liest bei „Schultagen" nur „Schultage" und lässt ein
    // „n" liegen — dreizehn Abschnitte sind genau daran abgebrochen.
    '(?<schoolDays>(?:an\\s+|außerhalb\\s+von\\s+)?(?:nicht\\s+)?Schultag(?:en|es|e|s)?)',
    '(?<unknownTime>\\(?\\s*zeitliche\\s+Einschränkung\\s+unbekannt\\s*\\)?)',
    // „bis 19Uhr" / „ab 18 Uhr": ein Ende ohne Anfang oder umgekehrt. Einen
    // Anfang dazuzuerfinden hiesse, eine Lesart zu behaupten, die die Quelle
    // nicht deckt.
    '(?<openEnded>\\b(?:ab|bis)\\s*\\d{1,2}(?::\\d{2})?\\s*(?:Uhr)?)',
    '(?<span>\\d{1,2}(?::\\d{2})?\\s*-\\s*\\d{1,2}(?::\\d{2})?)',
    '(?<maxStay>(?:max\\.\\s*)?\\d{1,2}(?:,\\d)?\\s*(?:h(?![\\p{L}])|Std\\.|Stunden|Stunde|min(?![\\p{L}])|Minuten))',
    `(?<dayRun>${DAY_WORD}(?:\\s*(?:bis|-|,|und|oder)?\\s*${DAY_WORD})*)`,
    // Füllwörter: alles, was im Feed zwischen den obigen steht und keine
    // Auskunft über Zeit oder Regelart trägt. Bewusst als geschlossene Liste —
    // ein neues Wort soll den Datenbau anhalten, nicht stillschweigend
    // verschwinden.
    '(?<filler>Uhr|und|oder|sonst|an|im|in|mit|nur|ohne|allgemein|temporär|tagsüber|Abends|personenbezogen|gebührenfrei|Krankenhaus|Einsatzfahrzeuge|u\\.|Notdienst|Krafträder|Motorradparken|Lieferverkehr|Bus|Ausnahme|Regelung\\s+für\\s+Parkraumerfassung|Sommer/Winter|AC|Normalladen|\\d+\\s*kW|E-Fahrzeuge|Ladezustand|free\\s+floating|stationär|Parken)',
  ].join('|'),
  'giu'
)

/** Was zwischen zwei Bestandteilen stehen darf, ohne dass es etwas bedeutet. */
const SEPARATOR = /^[\s,;.()/–-]*$/

interface DayRun {
  days: readonly Weekday[]
}

function sortedUnique(days: readonly Weekday[]): readonly Weekday[] {
  return [...new Set(days)].sort((a, b) => a - b)
}

/**
 * Eine Tagesangabe zu einer Wochentagsliste.
 *
 * Zwei Verknüpfungen, die man leicht verwechselt: Namen verbinden sich zur
 * **Vereinigung** (`Samstag und Sonntag`), `werktags` **schneidet** (`werktags
 * Montag bis Freitag` ist Montag bis Freitag, nicht Montag bis Samstag). Wer
 * beides gleich behandelte, bekäme aus `Samstag und Sonntag` die leere Menge —
 * und eine leere Wochentagsliste heißt „nie gebührenpflichtig", die teuerste
 * stille Antwort dieses Parsers.
 */
function parseDayRun(raw: string, spec: string): DayRun {
  const atoms = spec.match(new RegExp(`${DAY_WORD}|bis|-`, 'giu')) ?? []
  const named: Weekday[] = []
  let restrictToWerktags = false

  for (let index = 0; index < atoms.length; index += 1) {
    const atom = (atoms[index] as string).toLowerCase()
    if (atom === 'werktags') {
      restrictToWerktags = true
      continue
    }
    if (atom === 'bis' || atom === '-') continue

    const day = DAY_NAMES[atom]
    if (day === undefined) throw new MuenchenParseError(raw, `unbekannter Wochentag ${JSON.stringify(atom)}`)

    // Ein `bis` oder `-` unmittelbar davor macht aus zwei Namen eine Spanne.
    const previous = index > 0 ? (atoms[index - 1] as string).toLowerCase() : ''
    const from = index > 0 ? DAY_NAMES[(atoms[index - 2] ?? '').toLowerCase()] : undefined
    if ((previous === 'bis' || previous === '-') && from !== undefined) {
      // Rundlauf, damit auch `Samstag bis Montag` etwas Sinnvolles ergibt
      // statt still leer zu bleiben. Die Spannweite wird gerechnet, nicht
      // erlaufen — so kann die Schleife nicht endlos werden.
      const span = (day - from + 7) % 7
      for (let step = 1; step <= span; step += 1) named.push(((from + step) % 7) as Weekday)
      continue
    }
    named.push(day)
  }

  if (named.length === 0) return { days: restrictToWerktags ? WERKTAGS : DEFAULT_DAYS }
  const union = sortedUnique(named)
  if (!restrictToWerktags) return { days: union }
  const narrowed = union.filter((day) => WERKTAGS.includes(day))
  // `werktags Sonntag` gibt es im Feed nicht und wäre ein Widerspruch. Leer
  // durchzulassen hiesse „nie" — also abbrechen, statt zu schweigen.
  if (narrowed.length === 0) {
    throw new MuenchenParseError(raw, `Tagesangabe ${JSON.stringify(spec)} bleibt nach "werktags" leer`)
  }
  return { days: narrowed }
}

function toMinutes(raw: string, text: string): number {
  const [hourPart, minutePart] = text.split(':')
  const hour = Number(hourPart)
  const minute = minutePart === undefined ? 0 : Number(minutePart)
  if (!Number.isInteger(hour) || hour > 24 || minute > 59) {
    throw new MuenchenParseError(raw, `keine gültige Uhrzeit: ${JSON.stringify(text)}`)
  }
  return hour * 60 + minute
}

interface Span {
  fromMinute: number
  toMinute: number
}

function parseSpan(raw: string, text: string): Span {
  const [from, to] = text.split('-').map((part) => part.trim())
  const fromMinute = toMinutes(raw, from as string)
  const toMinute = toMinutes(raw, to as string)
  if (fromMinute === toMinute) {
    throw new MuenchenParseError(raw, `Spanne ${JSON.stringify(text)} ist leer`)
  }
  return { fromMinute, toMinute }
}

/**
 * Eine Spanne auf Tage legen — auch über Mitternacht.
 *
 * Anders als in Berlin, Hamburg und Frankfurt kommt das hier wirklich vor:
 * `Eingeschränktes Halteverbot 8:30-16 Uhr und 19-6:30 Uhr`, `Taxi 15-5 Uhr
 * Samstag und Sonntag`, `Taxiparken 19-9 Uhr`. Acht solcher Spannen stehen im
 * Abzug, alle in Klauseln, die kein Gebührenfenster ergeben — aber das ist ein
 * Befund von heute und keine Zusicherung der Quelle.
 *
 * Der zweite Teil landet auf dem **Folgetag**: `15-5 Uhr Samstag` heißt
 * Samstag ab 15 Uhr und Sonntag bis 5 Uhr, nicht Samstag von 0 bis 5. Beides
 * in ein Fenster zu schreiben hiesse laut `windowCovers` „nie".
 */
function toWindows(span: Span, days: readonly Weekday[]): ChargeWindow[] {
  if (span.fromMinute < span.toMinute) {
    return [{ weekdays: days, fromMinute: span.fromMinute, toMinute: span.toMinute }]
  }
  const nextDay = sortedUnique(days.map((day) => ((day + 1) % 7) as Weekday))
  return [
    { weekdays: days, fromMinute: span.fromMinute, toMinute: 1440 },
    { weekdays: nextDay, fromMinute: 0, toMinute: span.toMinute },
  ]
}

function parseMaxStay(raw: string, text: string): number {
  const match = /(\d{1,2})(?:,(\d))?\s*(h|Std\.|Stunden|Stunde|min|Minuten)/i.exec(text)
  if (match === null) throw new MuenchenParseError(raw, `keine Dauer in ${JSON.stringify(text)}`)
  const whole = Number(match[1])
  const fraction = match[2] === undefined ? 0 : Number(match[2]) / 10
  const unit = (match[3] as string).toLowerCase()
  const minutes = unit.startsWith('min') ? whole : Math.round((whole + fraction) * 60)
  if (minutes === 0) throw new MuenchenParseError(raw, '0 ist keine Höchstparkdauer')
  return minutes
}

// -------------------------------------------------------------------- Parser

interface RawClause {
  kind: MuenchenRuleKind
  keyword: string
  body: string
  otherwise: boolean
}

/**
 * Zerschneidet den Text an den Regelphrasen.
 *
 * Was **vor** der ersten Phrase steht, bricht ab. Ein Text, dessen erste Regel
 * dieser Parser nicht kennt, würde sonst seine Zeiten der zweiten Regel
 * zuschlagen — und das wäre still falsch statt laut kaputt.
 */
function splitClauses(raw: string, text: string): RawClause[] {
  KEYWORD_PATTERN.lastIndex = 0
  const matches = [...text.matchAll(KEYWORD_PATTERN)]
  if (matches.length === 0) {
    throw new MuenchenParseError(raw, 'keine bekannte Regelart im Text')
  }
  const head = text.slice(0, matches[0]?.index ?? 0)
  if (!SEPARATOR.test(head)) {
    throw new MuenchenParseError(raw, `unbekannte Regelart vor der ersten Klausel: ${JSON.stringify(head.trim())}`)
  }

  return matches.map((match, index) => {
    const start = (match.index ?? 0) + match[0].length
    const end = index + 1 < matches.length ? (matches[index + 1]?.index ?? text.length) : text.length
    const body = text.slice(start, end)
    const kind = KIND_BY_PHRASE.get(match[0].toLowerCase())
    if (kind === undefined) {
      throw new MuenchenParseError(raw, `Regelart ${JSON.stringify(match[0])} ohne Zuordnung`)
    }
    // `sonst` steht am Ende der VORIGEN Klausel, weil der Zwischenraum dorthin
    // gehört — deshalb wird hier zurückgeschaut statt nach vorn.
    const lead = index === 0 ? head : text.slice(0, match.index ?? 0)
    return { kind, keyword: match[0], body, otherwise: /\bsonst\s*$/i.test(lead) }
  })
}

type Item = { type: 'span'; span: Span } | { type: 'days'; days: readonly Weekday[] }

/**
 * Liest eine Klausel: Höchstparkdauer, Zeitspannen, Tagesangaben.
 *
 * Die Zuordnung Spanne → Tage folgt dem, was im Feed steht: Eine Tagesangabe
 * gilt für die Spannen **davor**, wenn es welche gibt, sonst für die danach.
 * `18-23 Uhr Montag bis Freitag und 9-23 Uhr Samstag` sind damit zwei Gruppen,
 * `Freitag 11-16:30 Uhr` eine.
 */
function parseClause(raw: string, clause: RawClause, unmodelled: Set<string>): MuenchenClause {
  const body = clause.body
  const items: Item[] = []
  let maxStayMinutes: number | undefined
  let consumedUntil = 0

  CLAUSE_TOKEN.lastIndex = 0
  for (const match of body.matchAll(CLAUSE_TOKEN)) {
    const at = match.index ?? 0
    const gap = body.slice(consumedUntil, at)
    if (!SEPARATOR.test(gap)) {
      throw new MuenchenParseError(raw, `nicht gelesen: ${JSON.stringify(gap.trim())}`)
    }
    consumedUntil = at + match[0].length
    const groups = match.groups ?? {}

    if (groups['schoolDays'] !== undefined) {
      // Ein Schulkalender steht nicht in dieser Quelle. Die Zeiten der Klausel
      // bleiben trotzdem stehen: Sie sind die weitere Auslegung, und das
      // Gebiet trägt sie ohnehin aus seinen gewöhnlichen Abschnitten.
      unmodelled.add('Regelung nur an Schultagen')
      continue
    }
    if (groups['unknownTime'] !== undefined) {
      unmodelled.add('Zeit laut Quelle unbekannt')
      continue
    }
    if (groups['openEnded'] !== undefined) {
      unmodelled.add('Zeitangabe ohne Anfang oder Ende')
      continue
    }
    if (groups['span'] !== undefined) {
      items.push({ type: 'span', span: parseSpan(raw, groups['span']) })
      continue
    }
    if (groups['maxStay'] !== undefined) {
      maxStayMinutes = parseMaxStay(raw, groups['maxStay'])
      continue
    }
    if (groups['dayRun'] !== undefined) {
      items.push({ type: 'days', days: parseDayRun(raw, groups['dayRun']).days })
      continue
    }
    // filler: nichts zu tun.
  }

  const tail = body.slice(consumedUntil)
  if (!SEPARATOR.test(tail)) {
    throw new MuenchenParseError(raw, `nicht gelesen: ${JSON.stringify(tail.trim())}`)
  }

  const windows: ChargeWindow[] = []
  let pending: Span[] = []
  let leadingDays: readonly Weekday[] | undefined
  const flush = (days: readonly Weekday[]): void => {
    for (const span of pending) windows.push(...toWindows(span, days))
    pending = []
  }
  for (const item of items) {
    if (item.type === 'span') {
      pending.push(item.span)
      continue
    }
    if (pending.length > 0) {
      flush(item.days)
      leadingDays = undefined
    } else {
      leadingDays = item.days
    }
  }
  flush(leadingDays ?? DEFAULT_DAYS)

  const timing = windows.length > 0 ? 'timed' : clause.otherwise ? 'otherwise' : 'untimed'
  return {
    kind: clause.kind,
    windows,
    ...(maxStayMinutes === undefined ? {} : { maxStayMinutes }),
    timing,
    raw: `${clause.keyword}${clause.body}`.trim(),
  }
}

/**
 * Zerlegt `parkregel_beschreibung`.
 *
 * Wirft bei allem, was der Parser nicht vollständig lesen kann — und zwar
 * ausdrücklich auch bei einem Rest, der nur wie Beiwerk aussieht. Ein neues
 * Wort im Feed ist im Zweifel eine neue Regel, und eine übersehene Regel wäre
 * hier kein leeres Feld, sondern eine falsche Uhrzeit an einem Auto.
 */
export function parseMuenchenRule(raw: string | null | undefined): MuenchenRule {
  if (raw === null || raw === undefined) {
    throw new MuenchenParseError('', 'keine Regelangabe')
  }
  if (raw.length > MAX_INPUT_LENGTH) {
    throw new MuenchenParseError(raw.slice(0, 60), `${raw.length} Zeichen sind keine Parkregel`)
  }
  const text = raw.replace(/\s+/g, ' ').trim()
  if (text === '') throw new MuenchenParseError(raw, 'leere Regelangabe')

  const unmodelled = new Set<string>()
  const clauses = splitClauses(raw, text).map((clause) => parseClause(raw, clause, unmodelled))
  return { raw: text, clauses, unmodelled: [...unmodelled] }
}

/**
 * Die Fenster, in denen Parken hier nicht einfach frei ist.
 *
 * Nur `timed`-Klauseln: `sonst Mischparken` sagt welche Regel gilt, nicht wann
 * — siehe die Begründung oben im Dateikopf.
 */
export function muenchenParkingWindows(rule: MuenchenRule): ChargeWindow[] {
  return rule.clauses
    .filter((clause) => clause.timing === 'timed' && PARKING_KINDS.has(clause.kind))
    .flatMap((clause) => clause.windows)
}

/**
 * Die Regelgruppen, in denen ein gewöhnliches Auto überhaupt stehen darf.
 *
 * `parkregel_gruppe` ist die Antwort der Stadt auf die Frage, was ein
 * Abschnitt **hauptsächlich** ist — und die braucht es zusätzlich zu den
 * Klauselarten, weil ein Regeltext seine Nebensätze nicht gewichtet. Der
 * teuerste Fall ist einer, der 1.171-mal vorkommt:
 *
 *     E-Ladeinfrastruktur AC (Normalladen 22kW) nur E-Fahrzeuge im
 *     Ladezustand 8-20 Uhr 4h mit Parkscheibe
 *
 * Das schließende „mit Parkscheibe" ist eine Klausel der Art `disc` — und der
 * Abschnitt ist trotzdem ein Ladeplatz, kein Parkplatz. Ohne diese Liste zählte
 * er bei den Stellplätzen mit, stünde unter „Zeiten laut Quelle" ganz oben und
 * verdürbe den Anteil der Höchstparkdauer. Umgekehrt gilt dasselbe für
 * Behinderten-, Taxi-, Bus- und Carsharing-Plätze.
 *
 * Die sieben aufgenommenen Gruppen, mit ihrer Zahl im Abzug vom 7. September
 * 2026 (13.714 Abschnitte insgesamt):
 *
 * | Gruppe | Abschnitte | warum drin |
 * | --- | --- | --- |
 * | Mischparken | 4.351 | Besucher zahlen, Bewohner frei |
 * | Bewohnerparken | 1.968 | für Besucher gesperrt, aber bewirtschaftet |
 * | Mischparken mit Parkscheibe | 887 | Scheibe statt Betrag |
 * | Eingeschränktes Halteverbot temporär | 430 | nennt fast immer ein Abendfenster |
 * | Kurzzeitparken | 378 | zahlen mit Höchstdauer |
 * | Altstadt und HBF | 274 | eigener Tarif, sonst wie Mischparken |
 * | Absolutes Halteverbot temporär | 170 | wie das eingeschränkte |
 *
 * Die elf ausgelassenen: `Absolutes Halteverbot (0-24 Uhr)` (1.916),
 * `E-Parken` (1.171), `Carsharing` (901), `Behindertenparken` (825),
 * `Eingeschränktes Halteverbot (0-24 Uhr)` (188), `Taxi` (149),
 * `keine Regelung 0 - 24 Uhr` (85), `Baustelle` (10), `Busparken` (8),
 * `Kraftfahrzeugparken allgemein` (2) und eine Zeile ohne Gruppe. Zusammen
 * 5.256 Abschnitte — wer sie mitnähme, baute eine Halteverbotskarte.
 *
 * Die *Fenster* eines Gebiets entstehen trotzdem aus **allen** Abschnitten:
 * „Behindertenparkplatz 8-18 Uhr Montag bis Freitag, Mischparken 18-23 Uhr"
 * sagt wahr, dass dort abends Gebühren fällig sind. Diese Liste entscheidet,
 * was *gezählt* wird, nicht was *gilt*.
 */
export const MUENCHEN_PARKING_GROUPS: ReadonlySet<string> = new Set([
  'Mischparken',
  'Bewohnerparken',
  'Mischparken mit Parkscheibe',
  'Eingeschränktes Halteverbot temporär',
  'Kurzzeitparken',
  'Altstadt und HBF',
  'Absolutes Halteverbot temporär',
])

export function isMuenchenParkingGroup(gruppe: string | null | undefined): boolean {
  return MUENCHEN_PARKING_GROUPS.has(gruppe?.trim() ?? '')
}

/**
 * Die Höchstparkdauer, die diese Regel für Besucher nennt — oder `undefined`.
 *
 * Nur aus Klauseln mit Parkbezug: `Busparken 2h` und `Behindertenparkplatz
 * max. 2 Stunden` sind Dauern für jemand anderen. Nennen mehrere Klauseln
 * eine, gewinnt die **kürzeste** — sie ist die Grenze, an der es teuer wird.
 */
export function muenchenMaxStay(rule: MuenchenRule): number | undefined {
  const values = rule.clauses
    .filter((clause) => PARKING_KINDS.has(clause.kind))
    .map((clause) => clause.maxStayMinutes)
    .filter((minutes): minutes is number => minutes !== undefined)
  return values.length === 0 ? undefined : Math.min(...values)
}

/**
 * Vereinigt die Fenster mehrerer Straßenseiten zu einer Aussage über ihr
 * Gebiet.
 *
 * Wie in Frankfurt: doppelte heraus, Reihenfolge stabil — ein Gebiet hat bis
 * zu 900 Abschnitte, und `Mischparken 9-23 Uhr` stünde sonst hundertfach in
 * der ausgelieferten Datei. Und wie dort **nicht**: benachbarte Fenster
 * verschmelzen. Aus `9-18` und `18-23` ein `9-23` zu machen hiesse, einem
 * Teil des Gebiets fünf Stunden anzudichten, die dort niemand verlangt.
 */
export function mergeMuenchenWindows(windows: readonly ChargeWindow[]): ChargeWindow[] {
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
 * Der Code, unter dem die Oberfläche eine Höchstparkdauer beschriftet.
 *
 * Dieselbe Übersetzung wie in Frankfurt und trotzdem hier noch einmal: Die
 * Städte teilen sich absichtlich keinen Code, an dem eine Änderung für eine
 * Stadt die andere trifft. München braucht zusätzlich die halbe Stunde —
 * `Kurzzeitparken 0,5h` und `Parkscheibe 0,5h` stehen im Feed.
 */
export function muenchenMaxStayCode(minutes: number): string {
  return minutes % 60 === 0 ? `${minutes / 60}h` : `${minutes}min`
}

// ------------------------------------------------------------- Rohzeilen

/** Rohzeile eines Parkraummanagementgebiets. */
export interface MuenchenZoneProperties {
  /** Der Name, unter dem die Stadt das Gebiet führt: `TU-Viertel`, `Südliche Au`. */
  name?: string | null
  /** In allen 82 Gebieten `in Betrieb`. Geplante und aufgehobene führt der Feed nicht. */
  status?: string | null
  /** `Lizenzgebiet in Betrieb`, `Parkraumbewirtschaftung`, `in Betrieb mit Altstadttarif`. */
  massnahme?: string | null
  /** Wer kontrolliert: `KVÜ` (Kommunale Verkehrsüberwachung) oder `Polizei`. */
  ueberwachung?: string | null
  /** Datum der Eröffnung, `TT.MM.JJJJ`. */
  eroeffnung?: string | null
  /** Adresse eines PDF mit der Einzelübersicht; in 3 von 82 Gebieten leer. */
  einzeluebersicht_link?: string | null
}

/** Rohzeile einer Straßenseite. */
export interface MuenchenSideProperties {
  /**
   * Anzahl der Stellplätze — als **Zeichenkette**, in 44 Zeilen `null`.
   *
   * Der Feed schreibt `"5"`, nicht `5`. Ein `typeof === 'number'` hätte hier
   * still null Plätze gezählt und jedes Gebiet mit 0 Stellplätzen ausgeliefert.
   */
  angebot?: string | null
  parkregel_beschreibung?: string | null
  /** Eine von 18 Gruppen, etwa `Mischparken` oder `Absolutes Halteverbot (0-24 Uhr)`. */
  parkregel_gruppe?: string | null
  parkregel_name?: string | null
  /** Name des Gebiets, in dem die Seite liegt — oder `null` außerhalb aller Gebiete. */
  prm_name?: string | null
  strasse?: string | null
}

/**
 * Die Anzahl Stellplätze einer Straßenseite.
 *
 * `null`, leer und alles Nichtnumerische ergeben 0 statt eines Abbruchs: Die
 * Zahl ist Beiwerk in der Anzeige, und ein Gebiet wegen einer fehlenden
 * Stellplatzangabe gar nicht auszuliefern wäre die schlechtere Antwort.
 */
export function muenchenSpaces(angebot: string | null | undefined): number {
  if (angebot === null || angebot === undefined) return 0
  const value = Number(angebot.trim())
  return Number.isInteger(value) && value > 0 && value < 10_000 ? value : 0
}

/**
 * Der Name, unter dem ein Gebiet in der Oberfläche steht.
 *
 * Anders als in Berlin und Frankfurt ist das ein echter Name und keine Nummer
 * — `Glockenbachviertel` statt `19`. Alle 82 sind gesetzt und alle 82 sind
 * verschieden.
 */
export function muenchenZoneLabel(properties: MuenchenZoneProperties): string {
  const name = properties.name?.trim() ?? ''
  return name === '' ? '?' : name
}

/** Ob das Gebiet heute bewirtschaftet wird. */
export function isMuenchenZoneActive(properties: MuenchenZoneProperties): boolean {
  return (properties.status?.trim().toLowerCase() ?? '') === 'in betrieb'
}

/**
 * Was der Feed über ein Gebiet sonst noch sagt — oder `null`.
 *
 * `massnahme` und `ueberwachung` sind die beiden Felder, die einem Menschen
 * vor Ort etwas sagen: ob es ein Lizenzgebiet ist und wer kontrolliert. `KVÜ`
 * wird ausgeschrieben, weil die Abkürzung außerhalb der Verwaltung niemand
 * kennt.
 *
 * Die Adresse aus `einzeluebersicht_link` wird bewusst **nicht** als Link
 * ausgegeben: Das Panel hat für einen Link keine Stelle, und eine nackte URL
 * im Fließtext ist keine. Genannt wird nur, dass es die Übersicht gibt und wo
 * — das ist die Auskunft, den Rest findet, wer sie sucht.
 */
const UEBERWACHUNG_LABELS: Record<string, string> = {
  kvü: 'Kommunale Verkehrsüberwachung',
  polizei: 'Polizei',
}

export function muenchenZoneNote(properties: MuenchenZoneProperties): string | null {
  const parts: string[] = []
  const massnahme = properties.massnahme?.trim() ?? ''
  if (massnahme !== '') parts.push(massnahme)

  const ueberwachung = properties.ueberwachung?.trim() ?? ''
  if (ueberwachung !== '') {
    parts.push(`Überwachung: ${UEBERWACHUNG_LABELS[ueberwachung.toLowerCase()] ?? ueberwachung}`)
  }

  const link = properties.einzeluebersicht_link?.trim() ?? ''
  if (link !== '') parts.push('Einzelübersicht als PDF bei muenchenunterwegs.de')

  return parts.length === 0 ? null : parts.join(' · ')
}
