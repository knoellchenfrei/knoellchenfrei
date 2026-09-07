/**
 * Der Frankfurter Feed-Dialekt.
 *
 * Was `parse-schedule.ts`/`parse-fee.ts` für Berlin und `hamburg.ts` für
 * Hamburg tun, tut diese Datei für Frankfurt am Main — und wieder getrennt,
 * nach derselben Regel: drei Feeds, drei Parser. Frankfurts Grammatik teilt
 * mit keiner der beiden anderen ein einziges Muster. Berlin schreibt
 * `Mo-Sa 9-20 Uhr` mit Pflichtwort „Uhr" und `2,00 Euro`, Hamburg
 * `werktags 9-20 Uhr` und `3,50 € je Stunde`, Frankfurt `Mo-Sa 9-20` ohne
 * „Uhr" und `2 €/h`. Ein gemeinsamer Parser müsste alle drei kennen und wäre
 * bei jeder Änderung an einer Stadt für die beiden anderen gefährlich.
 *
 * Datensätze, abgerufen am 7. September 2026:
 * `opendata:Bewohnerparken` (42 Polygone) und `opendata:Parkscheinautomaten`
 * (921 Punkte) aus <https://geowebdienste.frankfurt.de/Parken>.
 * Fixtures: `test/fixtures/ffm-*-2026-09-07.json`.
 *
 * Die eine Eigenheit, die alles andere bestimmt: **Tarif, Geltungszeit und
 * Höchstparkdauer hängen am Automaten, nicht am Gebiet.** Das Polygon trägt
 * nichts als eine Nummer. Was für ein Gebiet gilt, entsteht also erst durch
 * Zusammenlegen der Automaten darin — mit allen Widersprüchen, die dabei
 * sichtbar werden. Deshalb stehen `mergeFrankfurtFees` und
 * `mergeFrankfurtWindows` hier und nicht im Datenbau: Sie sind Auswertung
 * fremder Daten, und die gehört dorthin, wo man sie mit Unfug beschießen kann.
 */

import type { Weekday } from './berlin-time.js'
import type { Fee } from './parse-fee.js'
import type { ChargeWindow } from './tariff.js'

export class FrankfurtParseError extends Error {
  constructor(
    readonly raw: string,
    reason: string
  ) {
    super(`Frankfurter Feed: ${JSON.stringify(raw)} — ${reason}`)
    this.name = 'FrankfurtParseError'
  }
}

/** Wie in den Berliner und Hamburger Parsern: fremde Eingabe wird zuerst begrenzt. */
const MAX_INPUT_LENGTH = 120

/**
 * Die Kürzel des Feeds. Sonntag ist 0, wie in `berlin-time.ts`.
 *
 * `Tgl.` steht im Feed 19-mal und ist gleichbedeutend mit `Mo-So`. Es hier als
 * eigenes Kürzel zu führen statt es vorher zu ersetzen, hält die Rohschreibung
 * in der Fehlermeldung lesbar.
 */
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
const DAY_RANGE = /^([a-zäöü]{2})(?:\s*-\s*([a-zäöü]{2}))?$/

/**
 * Eine Tagesangabe: `Mo`, `Mo-Fr`, `Tgl.`.
 *
 * Ergebnis immer aufsteigend sortiert, auch wenn die Spanne über den Sonntag
 * läuft. `Mo-So` ergibt damit dieselbe Liste wie `Tgl.` — und zwei Automaten,
 * die dasselbe mit verschiedenen Worten sagen, ergeben nach
 * `mergeFrankfurtWindows` ein Fenster statt zweier.
 */
function parseDays(raw: string, spec: string): readonly Weekday[] {
  const text = spec.trim().toLowerCase()
  if (text === 'tgl.' || text === 'tgl' || text === 'täglich' || text === 'taeglich') {
    return ALL_DAYS
  }

  // Ein Kürzel oder zwei, durch einen Bindestrich getrennt. Als eigener
  // regulärer Ausdruck statt als `split('-')`: Der Split kann nicht sagen,
  // dass es höchstens zwei Teile gibt, und liesse `Mo-Fr-Sa` bis zu einer
  // Längenprüfung durchlaufen, die man vergessen kann.
  const range = DAY_RANGE.exec(text)
  if (range === null) {
    throw new FrankfurtParseError(raw, `unbekannte Tagesangabe ${JSON.stringify(spec)}`)
  }
  const from = DAY_NAMES[range[1] as string]
  const to = range[2] === undefined ? from : DAY_NAMES[range[2]]
  if (from === undefined || to === undefined) {
    throw new FrankfurtParseError(raw, `unbekannte Tagesangabe ${JSON.stringify(spec)}`)
  }
  if (from === to) return [from]

  // Rundlauf statt `for (d = from; d <= to)`, damit auch `Sa-Mo` etwas
  // Sinnvolles ergibt statt still leer zu bleiben. Im Feed vom 7.9.2026 kommt
  // keine solche Spanne vor; eine leere Wochentagsliste hiesse aber „nie
  // gebuehrenpflichtig", und das ist die teuerste stille Antwort, die dieser
  // Parser geben könnte. Die Spannweite wird gerechnet statt erlaufen — so
  // kann die Schleife nicht endlos werden und braucht keine Notbremse, die
  // nie greift.
  const span = (to - from + 7) % 7
  const days: Weekday[] = []
  for (let step = 0; step <= span; step += 1) days.push(((from + step) % 7) as Weekday)
  return days.sort((a, b) => a - b)
}

/**
 * Eine Stundenspanne ohne Minuten: `7-19`, `0-24`.
 *
 * Der Feed schreibt nirgends Minuten. Sie trotzdem stillschweigend zu
 * akzeptieren hiesse, eine Schreibweise zu erfinden, deren Bedeutung niemand
 * geprüft hat — `9.30-17` etwa wäre in Deutschland genauso gut als „9 Uhr 30"
 * wie als Tippfehler zu lesen. Also: abweisen und den Datenbau abbrechen
 * lassen, sobald die Quelle so etwas anfaengt.
 */
const CLAUSE = /^([A-Za-zÄÖÜäöü.]{2,8}(?:\s*-\s*[A-Za-zÄÖÜäöü.]{2,3})?)\s+(\d{1,2})\s*-\s*(\d{1,2})$/

function parseClause(raw: string, clause: string): ChargeWindow {
  const match = CLAUSE.exec(clause.trim())
  if (match === null) {
    throw new FrankfurtParseError(raw, `keine Tag-und-Stunden-Angabe in ${JSON.stringify(clause)}`)
  }
  const weekdays = parseDays(raw, match[1] as string)
  const fromHour = Number(match[2])
  const toHour = Number(match[3])

  // Stunde 24 heisst Minute 1440, nie 0 — wie in Berlin und Hamburg. `0-24`
  // auf 0-0 abzubilden hiesse „nie", und das steht im Feed sechsmal als
  // `Mo-So 0-24`, also als das genaue Gegenteil.
  const from = fromHour * 60
  const to = toHour * 60
  if (fromHour > 24 || toHour > 24) {
    throw new FrankfurtParseError(raw, `Stunde über 24 in ${JSON.stringify(clause)}`)
  }
  if (from >= to) {
    // Über Mitternacht kommt im Feed nicht vor. Eine Spanne wie `22-2`
    // stillschweigend als ein Fenster zu speichern hiesse „nie" (siehe
    // `windowCovers`), und sie zu zerlegen hiesse, eine Lesart zu erfinden,
    // die niemand geprüft hat. Der Datenbau soll hier anhalten.
    throw new FrankfurtParseError(raw, `Spanne ${fromHour}-${toHour} endet nicht nach ihrem Anfang`)
  }
  return { weekdays, fromMinute: from, toMinute: to }
}

/**
 * Zerlegt `gebuehrenzeit`.
 *
 * 30 Schreibweisen über 921 Automaten, und alle passen auf dieselbe Form: eine
 * Tagesangabe, eine Stundenspanne, optional eine zweite Klausel für den
 * Samstag. Die zweite Klausel steht 68-mal mit Leerzeichen abgetrennt
 * (`Mo-Fr 8-18 Sa 8-14`) und **einmal** mit Komma (`Mo-Fr 9-17, Sa 9-14`).
 * Dieses eine Komma ist der Grund, warum hier an beidem getrennt wird: Wer nur
 * das Leerzeichen kennt, liest `9-17, Sa` als eine kaputte Zahl und bricht ab.
 */
export function parseFrankfurtSchedule(raw: string): ChargeWindow[] {
  if (raw.length > MAX_INPUT_LENGTH) {
    throw new FrankfurtParseError(raw.slice(0, 40), `${raw.length} Zeichen sind keine Zeitangabe`)
  }
  const text = raw.trim().replace(/\s+/g, ' ')
  if (text === '') throw new FrankfurtParseError(raw, 'leere Zeitangabe')

  // Erst am Komma, dann an der Stelle, an der eine Stundenspanne endet und ein
  // Buchstabe beginnt. Der Lookahead trennt nur dort, wo wirklich eine neue
  // Klausel anfaengt — ein blosses `split(' ')` zerschnitte `Mo-Fr 8-18` mit.
  const clauses = text
    .split(',')
    .flatMap((part) => part.trim().split(/(?<=\d)\s+(?=[A-Za-zÄÖÜäöü])/))
    .map((part) => part.trim())
    .filter((part) => part !== '')

  return clauses.map((clause) => parseClause(raw, clause))
}

/**
 * Beträge im Feed: `2 €/h`, `4 €/h`.
 *
 * Mit `parse-fee.ts` ist das **nicht** zu lesen: Dort ist das Wort `Euro`
 * Pflicht, und die Zahl trägt zwingend zwei Nachkommastellen. Diese Datei
 * erweitern statt jene: Berlins Parser um `€/h` zu ergänzen hiesse, an einem
 * Regulären Ausdruck zu drehen, der 103 Berliner Zonen richtig liest, um einer
 * Stadt willen, die ihn gar nicht benutzt.
 *
 * Der Nachkommateil ist optional zugelassen, obwohl der Feed heute nur ganze
 * Euro schreibt. Das ist keine geratene Schreibweise, sondern dieselbe
 * Schreibweise mit derselben Einheit — eine Gebuehrenerhoehung auf `2,50 €/h`
 * soll den Datenbau nicht abbrechen lassen.
 */
const FRANKFURT_AMOUNT = /^(\d{1,3})(?:,(\d{2}))?\s*€\s*\/\s*h$/i

export function parseFrankfurtFee(raw: string | null | undefined): Fee {
  if (raw === null || raw === undefined) return { kind: 'unknown' }
  if (raw.length > MAX_INPUT_LENGTH) {
    throw new FrankfurtParseError(raw.slice(0, 40), `${raw.length} Zeichen sind keine Gebühr`)
  }
  const text = raw.trim()

  // Ein leeres Feld und ein Strich sind KEINE Gebuehr von null. Genau ein
  // Automat im Abzug vom 7.9.2026 lässt `gebuehrenzone` leer (Giessener
  // Strasse); 0,00 € auszuliefern wäre eine Behauptung, die der Feed nicht
  // deckt.
  if (text === '' || text === '-') return { kind: 'unknown' }

  const match = FRANKFURT_AMOUNT.exec(text)
  if (match === null) throw new FrankfurtParseError(raw, 'kein erkennbarer Betrag je Stunde')
  const centsPerHour = Number(match[1]) * 100 + Number(match[2] ?? 0)
  // Dieselbe Begründung wie in `parse-fee.ts`: `0 €/h` wäre ein `exact` mit
  // 0 Cent, also `priced: true` — und `mergeFrankfurtFees` zoege damit die
  // Spanne eines ganzen Bereichs auf „0,00-4,00 €“ herunter, genau das, was der
  // Test „ignores machines that state no rate at all“ verhindern soll. Ein
  // stummer Automat trägt den Strich, keine Null.
  if (centsPerHour === 0) throw new FrankfurtParseError(raw, 'ein Betrag von 0 € ist kein Tarif')
  return { kind: 'exact', centsPerHour }
}

/**
 * Zerlegt `maximal_parkdauer`: `1 h`, `2 h`, … und `-`.
 *
 * **`-` heisst „keine", nicht null Minuten.** 579 der 921 Automaten tragen den
 * Strich. Ihn als 0 zu lesen hiesse „Höchstparkdauer 0 Minuten", also Parken
 * verboten — und das steht dort nicht.
 */
export function parseFrankfurtMaxStay(raw: string | null | undefined): number | undefined {
  if (raw === null || raw === undefined) return undefined
  if (raw.length > MAX_INPUT_LENGTH) {
    throw new FrankfurtParseError(raw.slice(0, 40), `${raw.length} Zeichen sind keine Parkdauer`)
  }
  const text = raw.trim()
  if (text === '' || text === '-') return undefined

  const match = /^(\d{1,2})\s*h$/i.exec(text)
  if (match === null) throw new FrankfurtParseError(raw, 'keine Stundenangabe')
  const hours = Number(match[1])
  if (hours === 0) throw new FrankfurtParseError(raw, '0 h ist keine Hoechstparkdauer')
  return hours * 60
}

/**
 * Der Code, unter dem die Oberfläche eine Höchstparkdauer beschriftet.
 *
 * `maxStayLabel` im Web kennt Berlins Form `1h`/`30min` und schreibt daraus
 * „1 Std.". Frankfurts `1 h` fällt dort durch und stünde wörtlich in der
 * Anzeige — zwei Städte, zwei Schreibweisen für dieselbe Sache im selben
 * Satz. Deshalb hier die Übersetzung, an der Stelle, an der die Rohform
 * ohnehin gelesen wird.
 */
export function frankfurtMaxStayCode(minutes: number): string {
  return minutes % 60 === 0 ? `${minutes / 60}h` : `${minutes}min`
}

/**
 * Legt die Gebühren mehrerer Automaten zu einer Aussage über ihr Gebiet
 * zusammen.
 *
 * Zwei Sätze stehen im Feed, 2 €/h und 4 €/h, und in zwei der 27
 * bewirtschafteten Bereiche (15 und 18) stehen beide nebeneinander. Auf einen
 * Wert zu reduzieren verschätzt jemanden dort um 100 % — also `Fee.range`,
 * genau wie Berlins Zonen 41–43 es aus einer Spanne im Feed machen.
 *
 * Automaten ohne Betrag zählen nicht mit: „die Quelle sagt hier nichts" ist
 * keine Aussage über den Preis und darf die Spanne nicht nach unten ziehen.
 * Sagt kein einziger Automat etwas, bleibt es `unknown`.
 */
export function mergeFrankfurtFees(fees: readonly Fee[]): Fee {
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
 * Vereinigt die Fenster mehrerer Automaten.
 *
 * Ein Bereich kann fünf verschiedene Zeitangaben tragen (Bereich 20 tut es).
 * Die Fenster einfach aneinanderzuhängen wäre richtig — `windowCovers` fragt
 * ohnehin nur, ob *irgendeines* passt —, hinterliesse aber bei 92 Automaten
 * 92 identische Einträge in der ausgelieferten Datei. Deshalb doppelte
 * heraus, Reihenfolge stabil.
 *
 * Was hier bewusst NICHT passiert: benachbarte Fenster verschmelzen. `7-19`
 * und `7-22` als `7-22` auszugeben hiesse, dem halben Bereich drei Stunden
 * Gebuehrenpflicht anzudichten, die dort niemand verlangt.
 */
export function mergeFrankfurtWindows(windows: readonly ChargeWindow[]): ChargeWindow[] {
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
 * Die Entities, die der Feed führen könnte — und `&amp;` **zuletzt**.
 *
 * Die Reihenfolge ist kein Zufall: Wer `&amp;` zuerst ersetzt, macht aus
 * `&amp;lt;` erst `&lt;` und dann `<` — also aus dem *Text* „&lt;" ein
 * Kleinerzeichen. Das ist der klassische Weg, wie eine doppelt kodierte
 * Eingabe wieder zu Markup wird.
 */
const ENTITIES: readonly (readonly [RegExp, string])[] = [
  [/&nbsp;/gi, ' '],
  [/&lt;/gi, '<'],
  [/&gt;/gi, '>'],
  [/&quot;/gi, '"'],
  [/&#39;/g, "'"],
  [/&amp;/gi, '&'],
]

/**
 * Entfernt Markup aus einem Attributwert.
 *
 * `vti_url` trägt in allen 42 Bereichen **HTML in einem Datenfeld**:
 * `<a href="…" target="_blank" class="regelbereiche">weitere Informationen</a>`.
 * Das ist fremde Eingabe in der Form, die am ehesten irgendwo als Markup
 * landet. Sie wird deshalb hier zu Text gemacht — an einer Stelle, mit Tests —
 * statt an jeder Stelle, an der sie später auftaucht.
 *
 * React setzt Text ohnehin escaped ein; darauf allein zu bauen hiesse aber,
 * die nächste Ausgabeform (Telegram-Antwort, Log, meta.json, ein CSV-Export)
 * jedes Mal neu zu pruefen. Die Rohform gehört gar nicht erst weitergereicht.
 */
export function stripHtml(raw: string | null | undefined): string {
  if (raw === null || raw === undefined) return ''
  // Ein Attributwert dieser Größe ist kein Hinweistext mehr. Wie in den
  // Parsern: fremde Eingabe wird begrenzt, bevor irgendetwas sie anfasst.
  if (raw.length > 2000) return ''
  const decoded = ENTITIES.reduce(
    (text, [pattern, character]) => text.replace(pattern, character),
    raw.replace(/<[^>]*>/g, ' ')
  )
  return decoded.replace(/\s+/g, ' ').trim()
}

/** Rohzeile eines Bewohnerparkbereichs, so weit wir sie lesen. */
export interface FrankfurtZoneProperties {
  /** In allen 42 Bereichen `null`. Steht hier, damit ein künftiger Wert ankommt. */
  name?: string | null
  description?: string | null
  /** 0–41. Die einzige Identität, die der Feed vergibt. */
  nummer?: number | null
  /** HTML in einem Attribut. Nur über `stripHtml` weiterreichen. */
  vti_url?: string | null
  /** 1 in 11 von 42 Bereichen, sonst `null`. Was `null` heisst, sagt der Feed nicht. */
  mitparkraumbewirtschaftung?: number | null
}

/** Rohzeile eines Parkscheinautomaten. */
export interface FrankfurtAutomatProperties {
  /**
   * Nummer eines Bewohnerparkbereichs — als **Zahl**, 418-mal `null`.
   *
   * Gefunden, weil hier zuerst `string | null` stand: Die Zonen-Kennung in der
   * Ausgabe ist eine Zeichenkette, und ein `claimed === label` hätte
   * stillschweigend nie gepasst. Der Datenbau ist stattdessen mit
   * `claimed.trim is not a function` abgebrochen, weil er trimmen wollte — ein
   * Glücksfall: Ein Interface ist eine Behauptung über eine JSON-Datei, kein
   * Beweis, und TypeScript prüft sie nicht. Ein Vergleich, der immer falsch
   * ist, wäre hier gar nicht aufgefallen.
   */
  bewohnerparkzone?: number | null
  strassenname?: string | null
  /** `1 h`, `2 h` … oder `-` für „keine". */
  maximal_parkdauer?: string | null
  /** `2 €/h`, `4 €/h` oder leer. */
  gebuehrenzone?: string | null
  /** `Mo-Fr 7-19`, `Mo-Fr 8-18 Sa 8-14`, `Tgl. 9-18` … */
  gebuehrenzeit?: string | null
}

/**
 * Die Kennung eines Bereichs, wie sie in der Oberfläche steht.
 *
 * `name` und `description` sind in allen 42 Bereichen `null`; Identität trägt
 * nur `nummer`. Die Zahl als Zeichenkette ist damit alles, was die Quelle
 * hergibt — jede schönere Beschriftung wäre erfunden.
 */
export function frankfurtZoneLabel(properties: FrankfurtZoneProperties): string {
  const nummer = properties.nummer
  return typeof nummer === 'number' && Number.isInteger(nummer) ? String(nummer) : '?'
}

/**
 * Was der Feed über einen Bereich sonst noch sagt — oder `null`.
 *
 * Heute: nichts. `name` und `description` sind durchweg leer, und `vti_url`
 * enthält nach dem Entfernen des Markups nur die Linkbeschriftung „weitere
 * Informationen", die für sich allein keine Auskunft ist. Genau deshalb gibt
 * es diese Funktion trotzdem: Sobald die Stadt eines der beiden Felder füllt,
 * steht es ohne weitere Änderung in der Anzeige — und die Boilerplate bleibt
 * draussen, statt als vermeintliche Zusatzinformation zu erscheinen.
 *
 * Die Adresse aus `vti_url` wird bewusst NICHT zu einem Link ausgebaut: Der
 * Wert ist ein Pfad ohne Host (`/wir-fuer-sie/bewohnerparken/…`), und den Host
 * dazuzudichten hiesse, jemandem eine Adresse anzubieten, die niemand geprüft
 * hat. Aus dieser Arbeitsumgebung antwortet `www.frankfurt.de` mit 403.
 */
const NOTE_BOILERPLATE = /^(weitere informationen|mehr informationen|hier klicken)$/i

export function frankfurtZoneNote(properties: FrankfurtZoneProperties): string | null {
  const parts = [stripHtml(properties.name), stripHtml(properties.description)]
    .map((part) => part.trim())
    .filter((part) => part !== '')

  const linkText = stripHtml(properties.vti_url).trim()
  if (linkText !== '' && !NOTE_BOILERPLATE.test(linkText)) parts.push(linkText)

  return parts.length === 0 ? null : parts.join(' — ')
}
