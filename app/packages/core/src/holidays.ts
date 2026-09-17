/**
 * Statutory holidays, by Bundesland.
 *
 * Relevant because a weekday holiday is treated like a Sunday: no parking fee is
 * due. Getting this wrong makes the app tell people to pay on Good Friday.
 *
 * Was hier bewusst fehlt: die zwölf übrigen Bundesländer. Die Tabelle ist
 * leicht zu erweitern — aber nur mit einem Beleg je Eintrag, und aus dieser
 * Arbeitsumgebung sind fast alle amtlichen Seiten gesperrt. Ein unbekanntes
 * Land wirft deshalb, statt eine leere Menge zu liefern: Eine Stadt ohne
 * Feiertage würde an Karfreitag zum Zahlen auffordern und dabei nach nichts
 * aussehen. Zwei Fallstricke für den, der die Tabelle erweitert, stehen bei
 * `REGIONAL`.
 *
 * Easter Sunday and Whit Sunday are omitted deliberately — they always fall on a
 * Sunday, which the schedule already treats as free.
 */

import { berlinDateKey, type BerlinWallClock } from './berlin-time.js'

/**
 * Amtliche Kürzel der Bundesländer, so weit belegt — und seit dem
 * 16. September auch die Länder Österreichs und die Kantone der Schweiz, mit
 * dem Staat als Präfix (`AT-W`, `CH-ZH`). Der Präfix ist kein Schmuck: Er
 * entscheidet in `countryOf`, welcher **nationale** Kalender darunterliegt.
 * Ohne ihn hätte Wien den 3. Oktober frei und den 26. Oktober nicht.
 */
export type Land =
  | 'BE'
  | 'HH'
  | 'HE'
  | 'BY'
  | 'NW'
  | 'BW'
  | 'MV'
  | 'BB'
  | 'AT-W'
  | 'AT-ST'
  | 'AT-S'
  | 'AT-T'
  | 'NL-UT'
  | 'NL-ZH'
  | 'NL-GR'
  | 'NL-GE'
  | 'NL-NB'
  | 'FR-67'
  | 'PL-MA'

/** Der Staat, dessen Feiertage und Währung gelten. */
export type Country = 'DE' | 'AT' | 'CH' | 'NL' | 'FR' | 'PL'

/**
 * Welcher Staat hinter einem Landeskürzel steht.
 *
 * Aus dem Präfix gelesen und nicht aus einer zweiten Tabelle, damit es
 * keine zwei Stellen gibt, die auseinanderlaufen können. Ein Kürzel ohne
 * Präfix ist deutsch — das ist die Konvention der ersten sechs Länder, und
 * sie bleibt, weil jede Stadt, die heute ausgeliefert wird, sie nutzt.
 */
export function countryOf(land: Land): Country {
  if (land.startsWith('AT-')) return 'AT'
  if (land.startsWith('CH-')) return 'CH'
  if (land.startsWith('NL-')) return 'NL'
  if (land.startsWith('FR-')) return 'FR'
  if (land.startsWith('PL-')) return 'PL'
  return 'DE'
}

/**
 * Easter Sunday for a Gregorian year, as a UTC calendar date.
 * Anonymous Gregorian algorithm (Meeus/Jones/Butcher).
 */
function easterSunday(year: number): { month: number; day: number } {
  const a = year % 19
  const b = Math.floor(year / 100)
  const c = year % 100
  const d = Math.floor(b / 4)
  const e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4)
  const k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const month = Math.floor((h + l - 7 * m + 114) / 31)
  const day = ((h + l - 7 * m + 114) % 31) + 1
  return { month, day }
}

function shiftFromEaster(year: number, offsetDays: number): string {
  const easter = easterSunday(year)
  const date = new Date(Date.UTC(year, easter.month - 1, easter.day + offsetDays))
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  const day = String(date.getUTCDate()).padStart(2, '0')
  return `${date.getUTCFullYear()}-${month}-${day}`
}

/**
 * Die Feiertage, die im ganzen Staat gelten — je Staat eine Zeile.
 *
 * Feste Daten als `MM-TT`, bewegliche als Abstand zum Ostersonntag.
 *
 * **Deutschland:** die neun Tage, die in allen sechzehn Ländern gelten.
 *
 * **Österreich:** § 7 Abs. 2 Feiertagsruhegesetz 1957 (BGBl. Nr. 153/1957,
 * i. d. g. F.) nennt dreizehn Tage: Neujahr, Heilige Drei Könige,
 * Ostermontag, Staatsfeiertag (1. Mai), Christi Himmelfahrt, Pfingstmontag,
 * Fronleichnam, Mariä Himmelfahrt, Nationalfeiertag (26. Oktober),
 * Allerheiligen, Mariä Empfängnis (8. Dezember), Weihnachten und
 * Stephanstag. **Karfreitag ist keiner** — er war bis 2019 nur für
 * evangelische Arbeitnehmer frei und ist seitdem ein „persönlicher
 * Feiertag" (BGBl. I Nr. 22/2019); die Kurzparkzonen gelten. Die
 * Landespatrone (Leopold in Wien, Rupert in Salzburg, Josef in der
 * Steiermark und Tirol) stehen nicht im Feiertagsruhegesetz; die Stadt
 * Wien sagt ausdrücklich, dass die Kurzparkzonen am 15. November gelten.
 * Deshalb hat kein österreichisches Land einen regionalen Eintrag.
 *
 * **Schweiz:** Der Bund kennt nur den 1. August (Art. 110 Abs. 3 BV, seit
 * 1994 ein den Sonntagen gleichgestellter Feiertag); alles andere ist
 * kantonal und steht bei `REGIONAL`, mit Beleg je Kanton.
 */
interface RegionalHolidays {
  /** Feste Daten als `MM-TT`. */
  readonly fixed: readonly string[]
  /** Bewegliche Daten als Abstand in Tagen zum Ostersonntag. */
  readonly fromEaster: readonly number[]
  /**
   * Bewegliche Daten, die weder fest noch österlich sind — je Regel eine
   * Funktion vom Jahr auf `JJJJ-MM-TT`. Koningsdag weicht auf den Samstag
   * aus, wenn der 27. April ein Sonntag ist; der Jeûne genevois ist der
   * Donnerstag nach dem ersten Sonntag im September; Buss- und Bettag der
   * Mittwoch vor dem 23. November. Bis zum 16. September gab es dafür
   * keinen Platz, und der Kommentar über `REGIONAL` warnte nur davor.
   */
  readonly custom?: readonly ((year: number) => string)[]
}

/** `JJJJ-MM-TT` eines UTC-Datums. */
function dateKey(date: Date): string {
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  const day = String(date.getUTCDate()).padStart(2, '0')
  return `${date.getUTCFullYear()}-${month}-${day}`
}

/**
 * Koningsdag: 27. April — fällt der auf einen Sonntag, wird am Samstag,
 * dem 26., gefeiert (Koninklijk Besluit vom 30. Oktober 2013, Art. 1). So
 * war es 2025, und so wird es 2031 sein.
 */
export function koningsdag(year: number): string {
  const date = new Date(Date.UTC(year, 3, 27))
  if (date.getUTCDay() === 0) date.setUTCDate(26)
  return dateKey(date)
}

const NATIONWIDE: Record<Country, RegionalHolidays> = {
  DE: {
    fixed: ['01-01', '05-01', '10-03', '12-25', '12-26'],
    fromEaster: [
      -2, // Karfreitag
      1, // Ostermontag
      39, // Christi Himmelfahrt
      50, // Pfingstmontag
    ],
  },
  AT: {
    fixed: ['01-01', '01-06', '05-01', '08-15', '10-26', '11-01', '12-08', '12-25', '12-26'],
    fromEaster: [
      1, // Ostermontag
      39, // Christi Himmelfahrt
      50, // Pfingstmontag
      60, // Fronleichnam
    ],
  },
  CH: { fixed: ['08-01'], fromEaster: [] },
  /**
   * Niederlande: die „algemeen erkende feestdagen" der Algemene termijnenwet
   * (Art. 3): Nieuwjaarsdag, Tweede Paasdag, Koningsdag, Hemelvaartsdag,
   * Tweede Pinksterdag, Eerste en Tweede Kerstdag. **Goede Vrijdag** steht
   * dort, ist aber kein Tag, an dem die Gemeinden das Parken freigeben —
   * Amsterdam kassiert an ihm; er fehlt deshalb. **Bevrijdingsdag** (5. Mai)
   * ist nur alle fünf Jahre arbeitsfrei und je Gemeinde verschieden
   * (Amsterdam führt den 5. Mai 2026 im NPR als Sonntag) — eine Stadt, die
   * ihn freigibt, trägt ihn an `City.holidays`. Der Feiertagskalender liegt
   * in den Niederlanden **in der Quelle** (NPR `SPECIALE DAG`); der Datenbau
   * gleicht ihn je Stadt gegen diese Liste ab und meldet Abweichungen.
   */
  NL: { fixed: ['01-01', '12-25', '12-26'], fromEaster: [1, 39, 50], custom: [koningsdag] },
  /**
   * Frankreich: die elf „jours fériés" nach Art. L3133-1 Code du travail.
   * Alsace-Moselle hat zwei mehr (Art. L3134-13): Vendredi saint und
   * 26. Dezember — die stehen bei `FR-67`, nicht hier.
   */
  FR: {
    fixed: ['01-01', '05-01', '05-08', '07-14', '08-15', '11-01', '11-11', '12-25'],
    fromEaster: [1, 39, 50],
  },
  /**
   * Polen: Ustawa z dnia 18 stycznia 1951 r. o dniach wolnych od pracy,
   * Art. 1, in der Fassung seit 2025 (Wigilia, 24. Dezember, seit dem
   * 1. Februar 2025 frei; Dz.U. 2024 poz. 1965). Ostersonntag und
   * Pfingstsonntag stehen im Gesetz, sind aber Sonntage.
   */
  PL: {
    fixed: ['01-01', '01-06', '05-01', '05-03', '08-15', '11-01', '11-11', '12-24', '12-25', '12-26'],
    fromEaster: [1, 60],
  },
}

/**
 * Was ein Land über die neun bundesweiten hinaus hat.
 *
 * **Zwei Listen, nicht eine.** Bis Hessen dazukam, hielt `REGIONAL` nur *feste*
 * Daten als `MM-TT`, und alles Bewegliche stand global in
 * `NATIONWIDE`. Fronleichnam ist beides zugleich — beweglich
 * (Ostersonntag + 60) und **nicht** bundesweit. In der alten Struktur ließ er
 * sich nur falsch unterbringen: als festes Datum wäre er jedes Jahr um Wochen
 * daneben, in der globalen Osterliste bekämen ihn Berlin und Hamburg mit, wo er
 * keiner ist. Ein Land, das keinen beweglichen Zusatzfeiertag hat, trägt hier
 * eine leere Liste; im Ergebnis ändert sich für BE und HH dadurch nichts, und
 * ein Test hält genau das fest.
 *
 * Zwei Fallstricke, bevor jemand hier ein Land ergänzt:
 *
 * - **Manche Feiertage gelten nur in Teilen eines Landes.** Mariä Himmelfahrt
 *   ist in Bayern gemeindeweise geregelt, Fronleichnam in Sachsen und
 *   Thüringen ebenso. Eine Tabelle je Land kann das nicht ausdrücken; für
 *   München gehört der Eintrag deshalb an die Stadt, nicht ans Land.
 * - **Buß- und Bettag ist beweglich, aber nicht österlich.** Er ist der
 *   Mittwoch vor dem 23. November und braucht eine eigene Regel, weder ein
 *   festes Datum noch einen Oster-Abstand.
 *
 * Belege für die drei Einträge unten:
 *
 * - **BE** — Der Internationale Frauentag am 8. März ist seit 2019 in Berlin
 *   gesetzlicher Feiertag; außer Berlin führt ihn nur Mecklenburg-Vorpommern.
 *   Reformationstag und Buß- und Bettag sind in Berlin keine Feiertage.
 * - **HH** — Der Reformationstag am 31. Oktober ist seit 2018 gesetzlicher
 *   Feiertag; damit hat Hamburg zehn. Der 8. März ist keiner, Fronleichnam
 *   auch nicht. Nachgesehen am 6. September 2026.
 * - **HE** — Hessen hat zehn: die neun bundesweiten plus **Fronleichnam**,
 *   und sonst nichts. Kein Reformationstag, kein Allerheiligen, kein Buß- und
 *   Bettag, keine gemeindeweise Regelung. Quelle: Hessisches Ministerium des
 *   Innern, <https://innen.hessen.de/buerger-staat/feiertage>, abgerufen am
 *   7. September 2026.
 * - **BY** — Bayern hat **zwölf** landesweite: die neun bundesweiten plus
 *   Heilige Drei Könige, Fronleichnam und Allerheiligen. Das ist der lange
 *   Eintrag dieser Tabelle und trotzdem der unvollständige — Mariä Himmelfahrt
 *   gilt in Bayern *gemeindeweise* und steht deshalb nicht hier, sondern an
 *   der Stadt (`City.holidays`, siehe `extraFixed` unten). Wörtlich, Art. 1
 *   Abs. 1 Nr. 1 BayFTG: „Neujahr, Heilige Drei Könige (Epiphanias),
 *   Karfreitag, Ostermontag, der 1. Mai, Christi Himmelfahrt, Pfingstmontag,
 *   Fronleichnam, der 3. Oktober als Tag der Deutschen Einheit, Allerheiligen,
 *   Erster Weihnachtstag, Zweiter Weihnachtstag". Abs. 2 gibt zusätzlich der
 *   **Stadt Augsburg** den 8. August (Friedensfest) — auch das eine Sache der
 *   Stadt, nicht des Landes. Quelle:
 *   <https://www.gesetze-bayern.de/Content/Document/BayFTG-1>, abgerufen am
 *   7. September 2026.
 * - **NW** — Nordrhein-Westfalen hat **elf**: die neun bundesweiten plus
 *   Fronleichnam und Allerheiligen. Kein Reformationstag, kein Buß- und
 *   Bettag, kein Frauentag — und, anders als in Bayern, **keine gemeindeweise
 *   Regelung**: § 2 des Gesetzes über die Sonn- und Feiertage (SGV. NRW. 113)
 *   kennt keinen Vorbehalt wie Art. 1 Abs. 1 Nr. 2 BayFTG; die einzige
 *   gemeindebezogene Vorschrift ist § 8 Abs. 3 und betrifft *kirchliche*
 *   Feiertage, die nach § 5 Abs. 1 nur zur Gottesdienstzeit geschützt und
 *   nicht arbeitsfrei sind. Wörtlich, § 2 Abs. 1: „der Neujahrstag, der
 *   Karfreitag, der Ostermontag, der 1. Mai …, der Christi-Himmelfahrts-Tag,
 *   der Pfingstmontag, der Fronleichnamstag (Donnerstag nach dem Sonntag
 *   Trinitatis), der 3. Oktober als Tag der Deutschen Einheit, der
 *   Allerheiligentag (1. November), der 1. Weihnachtstag, der
 *   2. Weihnachtstag". Quelle: <https://recht.nrw.de/lrgv/gesetz/01012000-bekanntmachung-der-neufassung-des-gesetzes-ueber-die-sonn-und-feiertage>,
 *   abgerufen am 8. September 2026. Gilt für Köln und Düsseldorf.
 * - **BW** — Baden-Württemberg hat **zwölf** landesweite Feiertage: die neun
 *   bundesweiten plus Heilige Drei Könige, Fronleichnam und Allerheiligen.
 *   Der Eintrag ist damit **zeichengleich mit dem bayerischen** — und
 *   trotzdem eine eigene Zeile, weil er einen eigenen Beleg hat und weil sich
 *   die beiden Länder jederzeit auseinanderentwickeln können. Der Unterschied
 *   liegt woanders: Bayerns Mariä Himmelfahrt gilt gemeindeweise und hängt
 *   deshalb an `City.holidays`; Baden-Württemberg kennt **keine**
 *   gemeindeweise Regelung, Karlsruhe braucht also kein `holidays`-Feld.
 *   Reformationstag und Buß- und Bettag sind in Baden-Württemberg
 *   ausdrücklich **keine** gesetzlichen Feiertage, sondern kirchliche (der
 *   31. Oktober ist schulfrei, mehr nicht) — wer sie mitnimmt, meldet an zwei
 *   Werktagen im Jahr „gebührenfrei". Quellen: § 1 Abs. 1 FTG BW und die
 *   Feiertagsseite des Innenministeriums,
 *   <https://im.baden-wuerttemberg.de/de/service/feiertage>, abgerufen am
 *   8. September 2026.
 * - **MV** — Mecklenburg-Vorpommern hat **elf**: die neun bundesweiten plus
 *   den **Frauentag** (8. März) und den **Reformationstag** (31. Oktober).
 *   § 2 Abs. 1 des Gesetzes über Sonn- und Feiertage (Feiertagsgesetz
 *   Mecklenburg-Vorpommern – FTG M-V) in der Fassung der Bekanntmachung vom
 *   8. März 2002 (GVOBl. M-V S. 145). Der Reformationstag steht dort seit
 *   dem ersten Gesetz von 1992 (Landtags-Drucksache 1/1870, § 2 Abs. 1
 *   Nr. 8: „der Reformationstag (31. Oktober)"). Der Frauentag kam mit dem
 *   Vierten Gesetz zur Änderung des Feiertagsgesetzes vom 7. Juli 2022
 *   (GVOBl. M-V Nr. 31 vom 12. Juli 2022, S. 427), Artikel 1 Nr. 1
 *   wörtlich: „Nach Nummer 1 wird folgende Nummer 2 eingefügt: ‚2. der
 *   Frauentag (8. März),'. Die bisherigen Nummern 2 bis 10 werden die
 *   Nummern 3 bis 11." — in Kraft am Tag nach der Verkündung, also erstmals
 *   am 8. März 2023. Aus der Umnummerierung folgt die Zahl: elf. Buß- und
 *   Bettag war nur im Entwurf von 1992 dabei (Nr. 9) und ist seit 1995 in
 *   allen Ländern ausser Sachsen abgeschafft; Fronleichnam, Allerheiligen
 *   und Heilige Drei Könige kennt das Land nicht. Beide Belegtexte sind am
 *   16. September 2026 als PDF gelesen worden (`dokumentation.landtag-mv.de`,
 *   `regierung-mv.de`); das Landesrechtsportal selbst antwortet ohne
 *   JavaScript nur mit einer leeren Seite. Gilt für Rostock.
 * - **BB** — Brandenburg hat **zehn** Feiertage, die auf einen Werktag fallen
 *   können: die neun bundesweiten plus den **Reformationstag**. § 2 Abs. 1
 *   des Gesetzes über die Sonn- und Feiertage (Feiertagsgesetz – FTG) vom
 *   21. März 1991 (GVBl. S. 44), zuletzt geändert durch Gesetz vom
 *   30. April 2015 (GVBl. I Nr. 13), zählt **zwölf** „gesetzlich anerkannte
 *   Feiertage": „der Neujahrstag (1. Januar), der Karfreitag, der
 *   Ostersonntag, der Ostermontag, der 1. Mai (Tag der Arbeit), der Christi
 *   Himmelfahrtstag, der Pfingstsonntag, der Pfingstmontag, der Tag der
 *   deutschen Einheit (3. Oktober), das Reformationsfest (31. Oktober), der
 *   1. Weihnachtsfeiertag (25. Dezember), der 2. Weihnachtsfeiertag
 *   (26. Dezember)". Zwei davon — Ostersonntag und Pfingstsonntag — führt
 *   Brandenburg anders als die übrigen Länder ausdrücklich als gesetzliche
 *   Feiertage; für dieses Modell sind sie unerheblich, weil sie immer auf
 *   einen Sonntag fallen und der Sonntag ohnehin gebührenfrei ist (siehe den
 *   Kopfkommentar). Deshalb zehn Einträge statt zwölf. Kein Frauentag (nur
 *   BE und MV), kein Fronleichnam, kein Buß- und Bettag, keine gemeindeweise
 *   Regelung — § 2 kennt keinen Vorbehalt wie Art. 1 Abs. 1 Nr. 2 BayFTG.
 *   Der amtliche Text steht unter <https://bravors.brandenburg.de/gesetze/ftg>
 *   (am 16. September 2026 aus dieser Umgebung nur als JavaScript-Hülle
 *   abrufbar); gelesen wurde der wortgleiche Auszug im Rechtsportal der
 *   Evangelischen Kirche Berlin-Brandenburg-schlesische Oberlausitz,
 *   <https://www.kirchenrecht-ekbo.de/document/16>, abgerufen am
 *   16. September 2026. Gilt für Cottbus.
 */
const REGIONAL: Record<Land, RegionalHolidays> = {
  BE: { fixed: ['03-08'], fromEaster: [] }, // Internationaler Frauentag
  HH: { fixed: ['10-31'], fromEaster: [] }, // Reformationstag
  HE: { fixed: [], fromEaster: [60] }, // Fronleichnam
  BY: { fixed: ['01-06', '11-01'], fromEaster: [60] }, // Drei Könige, Allerheiligen, Fronleichnam
  NW: { fixed: ['11-01'], fromEaster: [60] }, // Allerheiligen, Fronleichnam
  BW: { fixed: ['01-06', '11-01'], fromEaster: [60] }, // Drei Könige, Allerheiligen, Fronleichnam
  MV: { fixed: ['03-08', '10-31'], fromEaster: [] }, // Frauentag, Reformationstag
  BB: { fixed: ['10-31'], fromEaster: [] }, // Reformationstag; Oster- und Pfingstsonntag sind Sonntage
  // Österreich: alles Bundesrecht, siehe `NATIONWIDE`.
  'AT-W': { fixed: [], fromEaster: [] },
  'AT-ST': { fixed: [], fromEaster: [] },
  'AT-S': { fixed: [], fromEaster: [] },
  'AT-T': { fixed: [], fromEaster: [] },
  // Niederlande: keine Provinzfeiertage; alles national, siehe `NATIONWIDE`.
  'NL-UT': { fixed: [], fromEaster: [] },
  'NL-ZH': { fixed: [], fromEaster: [] },
  'NL-GR': { fixed: [], fromEaster: [] },
  'NL-GE': { fixed: [], fromEaster: [] },
  'NL-NB': { fixed: [], fromEaster: [] },
  // Bas-Rhin (Strasbourg): Alsace-Moselle, Art. L3134-13 Code du travail —
  // Vendredi saint und Saint-Étienne (26. Dezember).
  'FR-67': { fixed: ['12-26'], fromEaster: [-2] },
  // Małopolska (Kraków): keine Woiwodschaftsfeiertage; alles national.
  'PL-MA': { fixed: [], fromEaster: [] },
}

/**
 * Ein stadtspezifisches Datum, wie `City.holidays` es führt: `MM-TT`.
 *
 * Streng geprüft, statt einfach angehängt: Ein Tippfehler wie `15-08` oder
 * `15.08.` würde sonst nie auf einen Datumsschlüssel passen und damit
 * **stillschweigend nichts** bewirken — die App verlangte am 15. August in
 * München Gebühren, und in der Konfiguration stünde ein Eintrag, der aussieht,
 * als sei die Sache erledigt. Das ist derselbe Fehler wie ein stiller
 * Rückfall auf Berlin, nur an einem anderen Feld.
 */
const FIXED_DATE = /^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/

const cache = new Map<string, ReadonlySet<string>>()

/**
 * Feiertage eines Landes in einem Jahr, als `YYYY-MM-DD`-Schlüssel.
 *
 * `extraFixed` sind feste Daten, die **nicht am Land** hängen. Das ist kein
 * Sonderweg für einen Einzelfall, sondern die Form, die das Bayerische
 * Feiertagsgesetz vorgibt: Mariä Himmelfahrt gilt nach Art. 1 Abs. 1 Nr. 2
 * BayFTG „in Gemeinden mit überwiegend katholischer Bevölkerung", das
 * Friedensfest nach Abs. 2 nur in Augsburg. Eine Tabelle `Record<Land, …>`
 * kann das nicht ausdrücken — sie hätte für Bayern die Wahl zwischen
 * „München zahlt am 15. August" und „Nürnberg zahlt am 15. August nicht", und
 * beide Antworten wären für die halbe Stadtliste falsch.
 *
 * Der Zuschnitt als *Parameter* statt als zweite Tabelle ist Absicht: Er lässt
 * `Record<Land, …>` unverändert, und für BE, HH und HE ändert sich nichts,
 * solange niemand etwas übergibt.
 */
export function holidaysFor(
  land: Land,
  year: number,
  extraFixed: readonly string[] = []
): ReadonlySet<string> {
  // Die Zusatztage gehören in den Cache-Schlüssel: Sonst bekäme der zweite
  // Aufruf für dasselbe Land und Jahr die Menge des ersten zurück, und ob
  // der 15. August dabei ist, hinge daran, welche Stadt zuerst gefragt hat.
  const extras = [...extraFixed].sort()
  const cacheKey = extras.length === 0 ? `${land}:${year}` : `${land}:${year}:${extras.join('+')}`
  const cached = cache.get(cacheKey)
  if (cached !== undefined) return cached

  // Ausdrücklich als "kann fehlen" typisiert: Zur Übersetzungszeit deckt
  // `Record<Land, …>` jeden Fall ab, zur Laufzeit kommt `land` aber aus
  // Konfiguration und damit aus einer Datei, die niemand geprüft hat.
  const regional: RegionalHolidays | undefined = REGIONAL[land]
  if (regional === undefined) {
    throw new Error(`Kein Feiertagskalender für "${land}" hinterlegt`)
  }

  for (const date of extras) {
    if (!FIXED_DATE.test(date)) {
      throw new Error(`"${date}" ist kein festes Feiertagsdatum der Form MM-TT`)
    }
  }

  const nationwide = NATIONWIDE[countryOf(land)]
  const dates = new Set<string>(
    [...nationwide.fixed, ...regional.fixed, ...extras].map((date) => `${year}-${date}`),
  )
  for (const offset of [...nationwide.fromEaster, ...regional.fromEaster]) {
    dates.add(shiftFromEaster(year, offset))
  }
  for (const rule of [...(nationwide.custom ?? []), ...(regional.custom ?? [])]) {
    dates.add(rule(year))
  }

  cache.set(cacheKey, dates)
  return dates
}

export function isHoliday(
  land: Land,
  clock: BerlinWallClock,
  extraFixed?: readonly string[]
): boolean {
  return holidaysFor(land, clock.year, extraFixed).has(berlinDateKey(clock))
}

/**
 * The four Saturdays commonly called "Advents-Samstage".
 *
 * First Advent is the fourth Sunday before Christmas, so it falls between
 * 27 November and 3 December. The four shopping Saturdays are the Saturdays
 * preceding each Advent Sunday.
 *
 * The Berlin parking feed writes "Advents-Sa" in four Spandau zones without
 * defining which Saturdays it means, and no published rule settles it. This is
 * the everyday retail reading; because it is a reading and not the source's own
 * definition, callers should treat these dates as *uncertain* rather than
 * charging on them outright.
 */
export function adventSaturdays(year: number): ReadonlySet<string> {
  // Walk back from Christmas Eve to the preceding Sunday: that is 4th Advent.
  const christmas = new Date(Date.UTC(year, 11, 24))
  const fourthAdvent = new Date(christmas)
  fourthAdvent.setUTCDate(christmas.getUTCDate() - christmas.getUTCDay())

  const dates = new Set<string>()
  for (let week = 0; week < 4; week += 1) {
    // The Saturday before that Advent Sunday.
    const saturday = new Date(fourthAdvent)
    saturday.setUTCDate(fourthAdvent.getUTCDate() - week * 7 - 1)
    const month = String(saturday.getUTCMonth() + 1).padStart(2, '0')
    const day = String(saturday.getUTCDate()).padStart(2, '0')
    dates.add(`${saturday.getUTCFullYear()}-${month}-${day}`)
  }
  return dates
}

export function isAdventSaturday(clock: BerlinWallClock): boolean {
  return clock.weekday === 6 && adventSaturdays(clock.year).has(berlinDateKey(clock))
}
