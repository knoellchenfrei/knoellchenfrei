/**
 * Der Salzburger Feed-Dialekt — die erste Stadt außerhalb Deutschlands.
 *
 * Was `hamburg.ts` für Hamburg tut, tut diese Datei für Salzburg, und wieder
 * getrennt: Der Feed teilt mit keinem der sieben anderen ein einziges Muster.
 * Hamburg schreibt `werktags 9-20 Uhr`, Salzburg
 * `gebührenfrei (aber Parkuhrenpflicht) werktags Montag bis Freitag 9-19 Uhr`
 * — die Art der Bewirtschaftung und ihre Zeiten in **einem** Satz, mit
 * Semikolon zwischen zwei Klauseln, wenn Samstag anders gilt als die Woche.
 *
 * Datensatz: `ogdsbg:kurzparkzone` aus dem WFS 2.0.0 der Stadt Salzburg
 * (<https://data.stadt-salzburg.at/geodaten/wfs>), 41 Kurzparkzonen,
 * abgerufen am 16. September 2026. Fixture:
 * `test/fixtures/sbg-kurzparkzonen-2026-09-16.json`.
 *
 * Drei Eigenheiten bestimmen alles Weitere, und alle drei sind nachgemessen:
 *
 *  1. **Der Tarif steht nicht im Feed.** Kein Feld nennt einen Betrag. Er
 *     steht in § 2 Abs. 1 der Parkgebührenverordnung der Stadt Salzburg
 *     (Parkgebührenverordnung 1990, idF der 22. Novelle, Abl Nr 98/2025,
 *     in Kraft seit 1. Jänner 2026): „Die Höhe der Parkgebühr wird mit
 *     1,10 € für jede halbe Stunde festgesetzt." Das ist ein Satz für die
 *     ganze Stadt, kein Satz je Zone — deshalb steht er hier als Konstante
 *     mit Fundstelle (`SALZBURG_TARIFF`) und nicht als Parser.
 *  2. **„gebührenfrei (aber Parkuhrenpflicht)" ist Hamburgs Parkscheibe.**
 *     30 der 41 Zonen kosten nichts und verlangen trotzdem etwas: die Scheibe
 *     und höchstens drei Stunden. Ein Preis von null wäre die falsche Antwort.
 *  3. **Der Samstag ist in den gebührenpflichtigen Zonen ein Zwitter.** Elf
 *     Zonen kassieren Montag bis Freitag und verlangen samstags nur die
 *     Scheibe. `ChargeWindow` heißt „hier wird kassiert" — das Samstagsfenster
 *     ist deshalb **kein** Fenster, sondern eine Zusatzregel, die das Panel
 *     wörtlich nennt. Als Fenster gelesen stünde samstags „2,20 €" über einer
 *     Zone, die gratis ist.
 *
 * Und eine, die keine Fehlermeldung gibt: Ohne `srsName` antwortet der Dienst
 * in EPSG:31255 (MGI / Gauß-Krüger M31, `[-20891.7, 295427.09]`) — plausible
 * Zahlen, keine Grade. Mit `srsName=urn:ogc:def:crs:EPSG::4326` kommt GeoJSON
 * als `[lon, lat]`, GML dagegen als `[lat, lon]`. `build-data-salzburg.ts`
 * prüft die Grade nach.
 */

import type { Weekday } from './berlin-time.js'
import type { Fee } from './parse-fee.js'
import type { ChargeWindow } from './tariff.js'

export class SalzburgParseError extends Error {
  constructor(
    readonly raw: string,
    reason: string
  ) {
    super(`Salzburger Feed: ${JSON.stringify(raw)} — ${reason}`)
    this.name = 'SalzburgParseError'
  }
}

/**
 * Wie in den anderen Parsern: fremde Eingabe wird zuerst begrenzt. Der
 * längste Wert des Abzugs hat 151 Zeichen; 200 lässt einer weiteren Klausel
 * Platz, ohne dass ein Kilobyte Unfug durch die Muster läuft.
 */
const MAX_INPUT_LENGTH = 200

const MO_FR: readonly Weekday[] = [1, 2, 3, 4, 5]
const SA: readonly Weekday[] = [6]

/**
 * Der Stadttarif — belegt, nicht aus dem Feed gelesen.
 *
 * Fundstelle: Parkgebührenverordnung der Stadt Salzburg (Parkgebührenverordnung
 * 1990) idF der 22. Novelle, Abl Nr 98/2025, § 2 Abs. 1, wörtlich: „Die Höhe
 * der Parkgebühr wird mit 1,10 € für jede halbe Stunde festgesetzt." § 7:
 * „Diese Verordnung tritt mit 1. Jänner 2026 in Kraft." Abgerufen am
 * 16. September 2026 von
 * <https://www.stadt-salzburg.at/fileadmin/user_upload/04013/parkgebuehrenverordnung_homepage_-_version_22._novelle_ohne_plaene.pdf>;
 * die Seite <https://www.stadt-salzburg.at/kurzparkzone> nennt dasselbe als
 * „1 Stunde = 2,20 Euro, Maximale Parkzeit: 3 Stunden = 6,60 Euro".
 *
 * Warum eine Konstante und kein `unknown`: München bekommt `unknown`, weil dort
 * die Quelle schweigt und die Gebührenordnung je Gebiet verschieden ist. In
 * Salzburg gibt es **einen** Satz für alle gebührenpflichtigen Kurzparkzonen,
 * per Verordnung — das ist eine gelesene Tatsache, keine Vermutung. Ändert
 * die Stadt den Satz, ändert sich diese Zeile samt Fundstelle; `rawFee` an
 * jeder Zone sagt, dass der Betrag aus der Verordnung stammt.
 */
export const SALZBURG_TARIFF = {
  centsPerHalfHour: 110,
  centsPerHour: 220,
  basis: 'Parkgebührenverordnung 1990 idF der 22. Novelle, Abl Nr 98/2025, § 2 Abs. 1',
  inKraftSeit: '2026-01-01',
} as const

/** Was in `rawFee` steht — der Leser soll sehen, dass der Betrag nicht aus dem Feed kommt. */
export const SALZBURG_RAW_FEE = 'laut Verordnung: 1,10 € je halbe Stunde (nicht im Datensatz)'

/**
 * Was eine Zeile über eine Zone sagt, nachdem sie gelesen ist.
 *
 * `kind` ist die Art der Bewirtschaftung: `paid` kassiert, `disc` verlangt
 * nur die Scheibe. `windows` sind bei `paid` die Fenster, in denen kassiert
 * wird, bei `disc` die Fenster, in denen die Scheibe verlangt ist — dieselbe
 * Lesart wie Hamburgs Parkscheibengebiete. `discWindows` gibt es nur bei
 * `paid`: die Stunden, in denen nichts kassiert, aber die Scheibe verlangt
 * wird (im Abzug: Samstag 9–16 Uhr).
 */
export interface SalzburgRule {
  kind: 'paid' | 'disc'
  windows: ChargeWindow[]
  discWindows: ChargeWindow[]
  /** Nachsätze, die das Modell nicht ausdrückt — wörtlich, für das Panel. */
  notes: string[]
}

/** Die zwei Arten, mit denen jede Klausel des Feeds beginnt. */
const KINDS: readonly { marker: RegExp; kind: SalzburgRule['kind'] }[] = [
  { marker: /^gebührenpflichtig \(Gebühreneinhebung mit Parkscheinautomat\)\s+/i, kind: 'paid' },
  { marker: /^gebührenfrei \(aber Parkuhrenpflicht\)\s+/i, kind: 'disc' },
]

/**
 * Tagesangaben des Feeds. „werktags Montag bis Freitag" ist nicht Hamburgs
 * „werktags": Der Feed nennt die Tage ausdrücklich, und Samstag steht — wo er
 * gilt — als eigene Angabe daneben. „werktags" trägt hier nur die
 * Einschränkung, die das Tarifmodell ohnehin macht: an Feiertagen nicht.
 */
const DAY_SPECS: Record<string, readonly Weekday[]> = {
  'werktags montag bis freitag': MO_FR,
  samstag: SA,
}

const SPAN =
  /^(werktags Montag bis Freitag|Samstag)\s+(\d{1,2})(?::(\d{2}))?\s*-\s*(\d{1,2})(?::(\d{2}))?\s*Uhr$/i

function parseSpan(raw: string, text: string): ChargeWindow {
  const match = SPAN.exec(text.trim())
  if (match === null) throw new SalzburgParseError(raw, `keine erkennbare Tag-und-Stunden-Angabe: ${text}`)
  const [, daySpec, fromHour, fromMin, toHour, toMin] = match
  const weekdays = DAY_SPECS[(daySpec as string).toLowerCase().replace(/\s+/g, ' ')]
  if (weekdays === undefined) throw new SalzburgParseError(raw, `unbekannte Tagesangabe ${daySpec}`)
  if (Number(fromMin ?? 0) > 59 || Number(toMin ?? 0) > 59) {
    throw new SalzburgParseError(raw, 'Minuten über 59')
  }
  const from = Number(fromHour) * 60 + Number(fromMin ?? 0)
  const to = Number(toHour) * 60 + Number(toMin ?? 0)
  // Stunde 24 heißt Minute 1440, nie 0. Und kein Fenster über Mitternacht:
  // Der Abzug kennt keines, und eine Kurzparkzone, die nachts kassiert, wäre
  // eine Nachricht, keine Schreibweise.
  if (!(from >= 0 && from < to && to <= 1440)) {
    throw new SalzburgParseError(raw, `unplausible Spanne ${fromHour}-${toHour}`)
  }
  return { weekdays, fromMinute: from, toMinute: to }
}

/**
 * Zerlegt `GEBUEHRENPFLICHT`.
 *
 * Vier Schreibweisen über 41 Zonen, und alle vier passen auf eine Grammatik:
 * Klauseln durch `;` getrennt, jede beginnt mit der Art, dann eine oder — mit
 * „und" — zwei Tag-und-Stunden-Angaben, dahinter optional ein Nachsatz nach
 * ` - `. Der Parser nimmt genau das und weist alles andere ab, statt zu
 * raten: Eine still falsch gelesene Zeit nennt jemandem eine Stunde, in der er
 * ein Knöllchen bekommt.
 *
 * Kassiert eine Klausel, ist die Zone `paid`, und die Fenster der
 * Scheiben-Klauseln wandern nach `discWindows` (siehe `SalzburgRule`). Sonst
 * ist die Zone `disc`, und alle Fenster sind Scheibenfenster.
 */
export function parseSalzburgRule(raw: string): SalzburgRule {
  if (raw.length > MAX_INPUT_LENGTH) {
    throw new SalzburgParseError(raw.slice(0, 40), `${raw.length} Zeichen sind keine Zeitangabe`)
  }
  const text = raw.trim().replace(/\s+/g, ' ')
  if (text === '') throw new SalzburgParseError(raw, 'leer')

  const paid: ChargeWindow[] = []
  const disc: ChargeWindow[] = []
  const notes: string[] = []

  for (const clauseRaw of text.split(';')) {
    const clause = clauseRaw.trim()
    if (clause === '') throw new SalzburgParseError(raw, 'leere Klausel')
    const kindMatch = KINDS.find((entry) => entry.marker.test(clause))
    if (kindMatch === undefined) {
      throw new SalzburgParseError(raw, `Klausel beginnt weder mit gebührenpflichtig noch mit gebührenfrei: ${clause}`)
    }
    const rest = clause.replace(kindMatch.marker, '')

    // Der Nachsatz steht nach ` - ` — mit Leerzeichen auf beiden Seiten, im
    // Unterschied zum Bindestrich der Stundenspanne (`9-19`).
    const [spans, ...noteParts] = rest.split(/\s-\s/)
    const note = noteParts.join(' - ').trim()
    if (note !== '') notes.push(note)

    const target = kindMatch.kind === 'paid' ? paid : disc
    for (const span of (spans ?? '').split(/\s+und\s+/i)) {
      target.push(parseSpan(raw, span))
    }
  }

  if (paid.length === 0) return { kind: 'disc', windows: disc, discWindows: [], notes }
  return { kind: 'paid', windows: paid, discWindows: disc, notes }
}

/**
 * Der Tarif zu einer Regel.
 *
 * `disc` ist keine Gebühr von null: Wer ohne Scheibe steht, zahlt. Für `paid`
 * gilt der Stadttarif aus der Verordnung — siehe `SALZBURG_TARIFF`.
 */
export function salzburgFee(rule: Pick<SalzburgRule, 'kind'>): Fee {
  if (rule.kind === 'disc') return { kind: 'disc' }
  return { kind: 'exact', centsPerHour: SALZBURG_TARIFF.centsPerHour }
}

const DAY_NAMES: Record<Weekday, string> = {
  0: 'So',
  1: 'Mo',
  2: 'Di',
  3: 'Mi',
  4: 'Do',
  5: 'Fr',
  6: 'Sa',
}

function hourText(minute: number): string {
  const h = Math.floor(minute / 60)
  const m = minute % 60
  return m === 0 ? String(h) : `${h}:${String(m).padStart(2, '0')}`
}

function daysText(weekdays: readonly Weekday[]): string {
  if (weekdays.length === 1) return DAY_NAMES[weekdays[0] as Weekday]
  const first = weekdays[0] as Weekday
  const last = weekdays[weekdays.length - 1] as Weekday
  return `${DAY_NAMES[first]}–${DAY_NAMES[last]}`
}

/**
 * Was in `unmodelledRules` steht: die Scheibenfenster einer kassierenden Zone
 * als Satz, dazu die Nachsätze der Quelle wörtlich.
 *
 * Das Panel schreibt davor „Zusatzregel, die hier nicht berechnet wird" und
 * dahinter, dass vor Ort das Schild gilt. Für den Samstag ist das die
 * richtige Auskunft: Die App sagt „frei", und der Satz sagt, was trotzdem
 * verlangt ist. `maxStayMinutes` kommt mit hinein, weil die Scheibe ohne
 * Höchstdauer keinen Sinn ergibt — und die Quelle sie an jeder Zone nennt.
 */
export function salzburgUnmodelledRules(
  rule: Pick<SalzburgRule, 'discWindows' | 'notes'>,
  maxStayMinutes: number | undefined
): string[] {
  const rules: string[] = []
  for (const window of rule.discWindows) {
    const dauer =
      maxStayMinutes === undefined
        ? ''
        : `, höchstens ${maxStayMinutes % 60 === 0 ? `${maxStayMinutes / 60} Std.` : `${maxStayMinutes} Min.`}`
    rules.push(
      `${daysText(window.weekdays)} ${hourText(window.fromMinute)}–${hourText(window.toMinute)} Uhr gebührenfrei, aber mit Parkscheibe${dauer}`
    )
  }
  return [...rules, ...rule.notes]
}

/** Obergrenze, ab der eine Höchstparkdauer keine mehr ist: ein voller Tag. */
const MAX_STAY_LIMIT_MINUTES = 24 * 60

/**
 * Zerlegt `MAXIMALE_PARKDAUER` — im Abzug 41-mal „3 Stunden".
 *
 * Minuten sind erlaubt, weil sie die naheliegende zweite Schreibweise wären;
 * alles andere wird abgewiesen. `0` ist kein Wert: Null Minuten hieße Parken
 * verboten, und das steht dort nicht — Hamburgs `0` ist ein Platzhalter für
 * „keine Grenze", Salzburgs Feed kennt keinen Platzhalter, also wirft er.
 */
export function parseSalzburgMaxStay(raw: string | null | undefined): number | undefined {
  if (raw === null || raw === undefined) return undefined
  if (raw.length > MAX_INPUT_LENGTH) {
    throw new SalzburgParseError(raw.slice(0, 40), `${raw.length} Zeichen sind keine Dauer`)
  }
  const text = raw.trim().replace(/\s+/g, ' ')
  if (text === '') return undefined
  const match = /^(\d{1,3}) (Stunden|Stunde|Minuten|Minute)$/i.exec(text)
  if (match === null) throw new SalzburgParseError(raw, 'keine erkennbare Dauer')
  const amount = Number(match[1])
  const minutes = /^Stunde/i.test(match[2] as string) ? amount * 60 : amount
  if (minutes === 0) throw new SalzburgParseError(raw, 'eine Dauer von null ist keine Höchstparkdauer')
  if (minutes > MAX_STAY_LIMIT_MINUTES) throw new SalzburgParseError(raw, 'länger als ein Tag')
  return minutes
}

/** Rohzeile des Feeds, so weit wir sie lesen — jedes Feld darf fehlen oder null sein. */
export interface SalzburgZoneProperties {
  ID?: number | null
  NAME?: string | null
  /** „Gebührenpflichtige Kurzparkzone" oder „Gebührenfreie Kurzparkzone". */
  ART?: string | null
  GEBUEHRENPFLICHT?: string | null
  MAXIMALE_PARKDAUER?: string | null
  GILT_VON?: string | null
  GILT_BIS?: string | null
  STATUS?: string | null
  STATUS_HINWEIS?: string | null
  /** „Ja", wenn Bewohner hier nicht mit Parkkarte stehen dürfen. */
  KEIN_BEWOHNERPARKEN?: string | null
  /** Buchstabe der Bewohnerparkzone, in der die Kurzparkzone liegt. */
  GRUPPE?: string | null
  /** „Gemeindestraße" oder „Landesstraße" — oder nichts. */
  UNTERGRUPPE?: string | null
  DOWNLOAD_URL?: string | null
}

/**
 * Ob eine Zone heute gilt.
 *
 * Der Feed führt drei Felder dafür: `STATUS` („aktiv"), `GILT_VON` und
 * `GILT_BIS`. Im Abzug vom 16. September sind alle 41 aktiv, das jüngste
 * `GILT_VON` ist der 13. April 2026, alle `GILT_BIS` liegen im Jahr 2049. Die
 * Prüfung ist trotzdem kein Selbstzweck: Eine Zone, die die Stadt mit einem
 * künftigen `GILT_VON` einstellt, ist bis dahin keine — und eine, deren
 * `GILT_BIS` verstrichen ist, auch nicht mehr. Ein unlesbares Datum zählt als
 * „gilt nicht": Über die Zone zu warnen wäre nur richtig, wenn sie gilt.
 */
export function isActiveSalzburgZone(properties: SalzburgZoneProperties, now: number = Date.now()): boolean {
  if ((properties.STATUS ?? '').trim().toLowerCase() !== 'aktiv') return false
  const from = Date.parse(properties.GILT_VON ?? '')
  const to = Date.parse(properties.GILT_BIS ?? '')
  if (!Number.isFinite(from) || !Number.isFinite(to)) return false
  return from <= now && now <= to
}

/**
 * Ob `ART` und `GEBUEHRENPFLICHT` dasselbe sagen.
 *
 * Zwei Felder, eine Aussage — und die Recherche vom Vormittag fand in `ART`
 * noch den Tippfehler „Gebährenpflichtige", der am Nachmittag behoben war.
 * Der Datenbau liest die Zeiten aus `GEBUEHRENPFLICHT` und hält `ART`
 * dagegen; laufen sie auseinander, steht das als `sourceDefect` an der Zone,
 * statt dass eines der Felder stillschweigend gewinnt.
 */
export function salzburgArtMatchesRule(art: string | null | undefined, rule: Pick<SalzburgRule, 'kind'>): boolean {
  const text = (art ?? '').trim().toLowerCase()
  if (rule.kind === 'paid') return text.startsWith('gebührenpflichtig')
  return text.startsWith('gebührenfrei')
}

/**
 * Der Name, wie ihn die Quelle führt, mit Leerraum normalisiert — mehr nicht.
 *
 * Der Feed schreibt teils Großschrift (`NONNTAL-OST`), teils
 * `Kurzparkzone (Bewohnerparkzone E)`, teils Straßenkürzel
 * (`B1 INNSBRUCKER BNDSTR. 12-20`). Eine Umschreibung in Groß-/Kleinschrift
 * müsste `LEHENSÜD` und `BNDSTR.` kennen; ein Name, der so auf dem Plan der
 * Stadt steht, ist die ehrlichere Auskunft.
 */
export function salzburgZoneLabel(properties: Pick<SalzburgZoneProperties, 'NAME'>): string {
  const name = (properties.NAME ?? '').replace(/\s+/g, ' ').trim()
  return name === '' ? '?' : name
}

/**
 * Was die Quelle über die Zone sonst noch sagt: die Bewohnerparkzone, in der
 * sie liegt, und ob Bewohner hier ausgenommen sind. Nur, wenn der Name es
 * nicht schon sagt — `Kurzparkzone (Bewohnerparkzone E)` braucht kein
 * zweites „Bewohnerparkzone E".
 */
export function salzburgZoneNote(properties: SalzburgZoneProperties): string | null {
  const parts: string[] = []
  const gruppe = (properties.GRUPPE ?? '').trim()
  const name = properties.NAME ?? ''
  if (gruppe !== '' && !name.includes(`Bewohnerparkzone ${gruppe}`)) {
    parts.push(`in Bewohnerparkzone ${gruppe}`)
  }
  if ((properties.KEIN_BEWOHNERPARKEN ?? '').trim().toLowerCase() === 'ja') {
    parts.push('kein Bewohnerparken')
  }
  const untergruppe = (properties.UNTERGRUPPE ?? '').trim()
  if (untergruppe !== '') parts.push(untergruppe)
  return parts.length === 0 ? null : parts.join(' · ')
}

/** Rohzeile der Stadtteil-Ebene `ogdsbg:stadtteil`, so weit wir sie lesen. */
export interface SalzburgDistrictProperties {
  ID?: number | null
  GEMEINDE?: string | null
  STADTTEIL?: string | null
  ORTSTEIL?: string | null
  LANDSCHAFTSRAUM?: string | null
  TEILLANDSCHAFTSRAUM?: string | null
  SIEDLUNG?: string | null
}

/**
 * Der Stadtteilname einer Fläche der Ebene `ogdsbg:stadtteil` — oder null.
 *
 * Die Ebene ist keine Stadtteilliste, sondern eine Zerlegung des
 * Stadtgebiets in 132 Flächen **und** 13 Flächen der Nachbargemeinden
 * (Anif, Wals-Siezenheim, Freilassing …), die im selben Rahmen liegen. Von
 * den 132 tragen 87 einen `STADTTEIL`; die übrigen 45 sind unbesiedelte
 * Teile — Mönchsberg, Gaisberg, Kommunalfriedhof, Flughafen — und führen den
 * Namen ihres Stadtteils im Feld `LANDSCHAFTSRAUM`. Zusammen ergibt das 28
 * Namen. Eine fremde Gemeinde ergibt null, und der Datenbau lässt sie aus:
 * Ein Salzburger Stadtteil namens „Freilassing" läge in Bayern.
 */
export function salzburgDistrictName(properties: SalzburgDistrictProperties): string | null {
  if ((properties.GEMEINDE ?? '').trim() !== 'Salzburg') return null
  const name = (properties.STADTTEIL ?? properties.LANDSCHAFTSRAUM ?? '').replace(/\s+/g, ' ').trim()
  return name === '' ? null : name
}
