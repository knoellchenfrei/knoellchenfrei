/**
 * Der Krakauer Feed-Dialekt.
 *
 * Datensatz: die Sektoren des Obszar Płatnego Parkowania (OPP, bis 2026
 * „Strefa Płatnego Parkowania", SPP) der Gmina Miejska Kraków, gepflegt vom
 * Zarząd Transportu Publicznego (ZTP) im ArcGIS Online der Stadt
 * (`services-eu1.arcgis.com/svTzSt3AvH7sK6q9`). Drei Ebenen, alle am
 * 17. September 2026 abgerufen, Fixtures unter `test/fixtures/krk-*`:
 *
 *  - `Granice_Stref_2026/FeatureServer/1` — **23** Sektorpolygone, die Ebene,
 *    die die amtliche Karte des Zarząd Dróg Miasta Krakowa (ZDMK) heute
 *    zeichnet („Mapa ZDMK v2", Stand 6. August 2026). Sie ist die Quelle
 *    der Flächen.
 *  - `Poszerzenie_OPP_od_10_08_2026/FeatureServer/0` — **4** Polygone der
 *    Erweiterung vom 10. August 2026 (`Uwagi: "Od 10 sierpnia 2026"`); sie
 *    sagt, welche Sektoren neu oder erweitert sind.
 *  - `Sektory_SPP_wyświetlenie/FeatureServer/37` — **26** Polygone, der
 *    als „Dane Otwarte" beschriebene Datensatz mit Stand 9. Dezember 2024:
 *    20 geltende Sektoren und sechs mit Präfix `n` aus Anhang 2 der Uchwała
 *    CV/2851/23 — geplante Sektoren, von denen vier seit dem 10. August
 *    2026 gelten und zwei (32, 33) noch nicht. Nur zur Gegenprobe.
 *
 * Was dieser Feed anders macht als alle Städte davor: **Er sagt nichts als
 * den Buchstaben.** Kein Feld nennt Zeiten, Beträge oder eine Höchstparkdauer;
 * das steht allein in der Uchwała LXXXIX/2177/17 der Rada Miasta Krakowa
 * samt Änderungen und auf den Seiten des ZDMK (Podstrefa A täglich, B und C
 * Montag bis Samstag, je 9–22 Uhr; 9/8/7 zł für die erste Stunde, ansteigend
 * bis zur dritten). Nichts davon steht hier als Konstante: Das Modell kennt
 * weder Złoty noch die Handelssonntage (niedziele handlowe), an denen die
 * Podstrefa A sonntags nichts verlangt, noch den Rabatt der Karta Krakowska.
 * Jede Krakauer Zone trägt deshalb `scheduleUnknown: true` und
 * `fee: { kind: 'unknown' }` — Klasse C. Was dieser Parser leistet, ist
 * das, was der Feed wirklich sagt: Podstrefa und Sektornummer prüfen, den
 * Schlüssel bilden, den die Stadt selbst benutzt („sektor B30"), und die
 * Datumsangabe der Erweiterung lesen.
 *
 * Zwei Fallen aus dem Abzug:
 *
 *  1. **Dasselbe Attribut heißt in den Ebenen verschieden.** Die Ebene 37
 *     schreibt `Podstrefa_spp`, die beiden jüngeren `Podstrefa_` — ArcGIS
 *     kürzt Feldnamen beim Export auf zehn Zeichen. `krakauSektor` liest
 *     beide und wirft, wenn keines da ist oder beide sich widersprechen.
 *  2. **Der Wert `' '` ist ein Platzhalter.** `Uwagi` trägt in
 *     `Granice_Stref_2026` ein Leerzeichen, in der Ebene 37 `null`, in der
 *     Erweiterung den Satz. Ein Leerzeichen ist keine Bemerkung.
 */

export class KrakauParseError extends Error {
  constructor(
    readonly raw: string,
    reason: string
  ) {
    super(`Krakauer Feed: ${JSON.stringify(raw)} — ${reason}`)
    this.name = 'KrakauParseError'
  }
}

/**
 * Das längste Feld des Abzugs ist die Bemerkung „Od 10 sierpnia 2026" mit
 * 19 Zeichen; die Ebene erlaubt 256. 80 hält Unfug draußen und lässt einer
 * längeren Bemerkung Platz.
 */
const MAX_INPUT_LENGTH = 80

/**
 * Die Podstrefa, wie die Ebene 37 sie als Wertebereich (`codedValues`) führt:
 * A, B, C, D. Eine Podstrefa D gibt es heute nicht; sie steht im
 * Wertebereich und wird deshalb angenommen — was der Dienst erlaubt, ist
 * kein Unfug, sondern eine Ankündigung.
 */
export type KrakauPodstrefa = 'A' | 'B' | 'C' | 'D'

const PODSTREFY: readonly KrakauPodstrefa[] = ['A', 'B', 'C', 'D']

export interface KrakauSektor {
  podstrefa: KrakauPodstrefa
  nr: number
  /**
   * Präfix `n` — „sektorów wyznaczonych dodatkowo w Załączniku nr 2":
   * zusätzlich in Anhang 2 ausgewiesen, also beschlossen, aber nicht in
   * Kraft. Eine geplante Fläche als geltend auszuliefern wäre eine Warnung
   * vor einer Bewirtschaftung, die es nicht gibt; der Datenbau lässt sie aus.
   */
  planned: boolean
}

/**
 * Liest den Podstrefa-Code: `A`, `B`, `C`, `D` oder mit Präfix `n`.
 *
 * Genau der Wertebereich der Ebene 37 — nichts weiter. Kleinbuchstaben
 * (`a`) oder Leerzeichen drumherum kommen im Abzug nicht vor und werden
 * trotzdem angenommen, weil sie dieselbe Aussage sind; ein `AB` oder ein
 * `Podstrefa A` nicht, weil es sie nicht ist.
 */
export function parseKrakauPodstrefa(raw: string): { podstrefa: KrakauPodstrefa; planned: boolean } {
  if (raw.length > MAX_INPUT_LENGTH) throw new KrakauParseError(raw, 'zu lang')
  const match = /^(n?)([A-Da-d])$/u.exec(raw.trim())
  if (match === null) throw new KrakauParseError(raw, 'keine Podstrefa (A–D, optional mit n)')
  const letter = (match[2] ?? '').toUpperCase() as KrakauPodstrefa
  if (!PODSTREFY.includes(letter)) throw new KrakauParseError(raw, 'keine Podstrefa')
  return { podstrefa: letter, planned: match[1] === 'n' }
}

/**
 * Die Sektornummer ist im Feed eine ganze Zahl (`esriFieldTypeInteger`).
 *
 * Als `unknown` genommen, weil eine gelesene JSON-Datei alles sein kann:
 * Eine Zeichenkette `"12"` wäre derselbe Schlüssel und ein anderer Typ, und
 * `12 === '12'` ist stillschweigend falsch — der Frankfurter Vorfall.
 */
export function parseKrakauSektorNr(raw: unknown): number {
  if (typeof raw !== 'number' || !Number.isInteger(raw) || raw < 1 || raw > 999) {
    throw new KrakauParseError(String(raw), 'keine Sektornummer (ganze Zahl 1–999)')
  }
  return raw
}

/**
 * Rohzeile der Ebene 37 (`Sektory_SPP_wyświetlenie`).
 *
 * Jedes Feld optional und nullbar — ein Interface über einer JSON-Datei ist
 * eine Behauptung; `fixture-shape.test.ts` misst, was wirklich ankommt.
 */
export interface KrakauSektorProperties {
  OBJECTID?: number | null
  /** `A`, `B`, `C`, `nB`, `nC` im Abzug; Wertebereich A–D mit und ohne `n`. */
  Podstrefa_spp?: string | null
  Nr_sektora?: number | null
  /** Im Abzug durchweg `null`. */
  Uwagi?: string | null
  Shape__Area?: number | null
  Shape__Length?: number | null
}

/**
 * Rohzeile von `Granice_Stref_2026` und `Poszerzenie_OPP_od_10_08_2026` —
 * dieselben Felder, nur heißt die Podstrefa hier `Podstrefa_`.
 */
export interface KrakauGranicaProperties {
  OBJECTID?: number | null
  Podstrefa_?: string | null
  Nr_sektora?: number | null
  /** `' '` in den Grenzen, `Od 10 sierpnia 2026` in der Erweiterung. */
  Uwagi?: string | null
  Shape__Area?: number | null
  Shape__Length?: number | null
}

/** Podstrefa und Nummer einer Zeile, aus welcher Ebene sie auch kommt. */
export function krakauSektor(properties: KrakauSektorProperties & KrakauGranicaProperties): KrakauSektor {
  const spp = properties.Podstrefa_spp
  const kurz = properties.Podstrefa_
  let raw: string
  if (typeof spp === 'string' && typeof kurz === 'string' && spp.trim() !== kurz.trim()) {
    throw new KrakauParseError(`${spp}/${kurz}`, 'Podstrefa_spp und Podstrefa_ widersprechen sich')
  } else if (typeof spp === 'string') {
    raw = spp
  } else if (typeof kurz === 'string') {
    raw = kurz
  } else {
    throw new KrakauParseError(String(properties.OBJECTID ?? '?'), 'Zeile ohne Podstrefa')
  }
  const { podstrefa, planned } = parseKrakauPodstrefa(raw)
  return { podstrefa, nr: parseKrakauSektorNr(properties.Nr_sektora), planned }
}

/**
 * Der Schlüssel, wie die Stadt selbst schreibt: „sektor B30", „sektor C7"
 * (Uchwała LXXXIX/2177/17, Anhang 1). Ohne das `n` — ob ein Sektor gilt,
 * entscheidet der Datenbau, nicht der Schlüssel.
 */
export function krakauZoneKey(sektor: KrakauSektor): string {
  return `${sektor.podstrefa}${sektor.nr}`
}

/** Die polnischen Monatsnamen im Genitiv, wie ein Datum sie schreibt. */
const MONTHS: Readonly<Record<string, number>> = {
  stycznia: 1,
  lutego: 2,
  marca: 3,
  kwietnia: 4,
  maja: 5,
  czerwca: 6,
  lipca: 7,
  sierpnia: 8,
  września: 9,
  października: 10,
  listopada: 11,
  grudnia: 12,
}

/**
 * Liest „Od 10 sierpnia 2026" als `2026-08-10`.
 *
 * Die eine Schreibweise des Abzugs, viermal. Der Tag wird gegen den
 * Kalender geprüft: Ein „31 lutego" ist kein Datum, und `Date.UTC` würde es
 * stillschweigend in den März schieben.
 */
export function parseKrakauSince(raw: string): string {
  if (raw.length > MAX_INPUT_LENGTH) throw new KrakauParseError(raw, 'zu lang')
  const match = /^od\s+(\d{1,2})\s+(\p{L}+)\s+(\d{4})$/iu.exec(raw.trim())
  if (match === null) throw new KrakauParseError(raw, 'kein Datum der Form „Od <Tag> <Monat> <Jahr>"')
  const day = Number(match[1])
  const month = MONTHS[(match[2] ?? '').toLowerCase()]
  const year = Number(match[3])
  if (month === undefined) throw new KrakauParseError(raw, `unbekannter Monat „${match[2] ?? ''}"`)
  if (year < 2000 || year > 2100) throw new KrakauParseError(raw, 'Jahr ausserhalb 2000–2100')
  const date = new Date(Date.UTC(year, month - 1, day))
  if (date.getUTCDate() !== day || date.getUTCMonth() !== month - 1) {
    throw new KrakauParseError(raw, 'diesen Tag gibt es in diesem Monat nicht')
  }
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

/**
 * Die Bemerkung einer Zeile: `null` für Platzhalter, sonst das Datum.
 *
 * Alles, was weder leer noch ein lesbares Datum ist, wirft — eine Bemerkung
 * des ZTP, die niemand gelesen hat, gehört nicht stillschweigend
 * ausgeliefert, sondern beim nächsten Abzug angesehen.
 */
export function krakauNote(raw: string | null | undefined): string | null {
  if (raw === null || raw === undefined || raw.trim() === '') return null
  return parseKrakauSince(raw)
}

const MONTH_NAMES_DE = [
  'Januar',
  'Februar',
  'März',
  'April',
  'Mai',
  'Juni',
  'Juli',
  'August',
  'September',
  'Oktober',
  'November',
  'Dezember',
]

/** `2026-08-10` als „10. August 2026" — für den Satz unter der Zone. */
export function krakauDatumDeutsch(iso: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/u.exec(iso)
  if (match === null) throw new KrakauParseError(iso, 'kein ISO-Datum')
  const month = MONTH_NAMES_DE[Number(match[2]) - 1]
  if (month === undefined) throw new KrakauParseError(iso, 'kein Monat')
  return `${Number(match[3])}. ${month} ${match[1]}`
}

/**
 * Der Satz unter der Zone: Sektor und Podstrefa ausgeschrieben, und was die
 * Erweiterung vom 10. August 2026 an diesem Sektor geändert hat.
 *
 * `since` kommt aus der Erweiterungsebene, `extended` sagt, ob der Sektor
 * dort nur ein Stück ist (B30: der alte Sektor plus Błonia) oder ganz
 * (C23, C24, C31: vorher gab es ihn nicht).
 */
export function krakauZoneNote(sektor: KrakauSektor, since: string | null, extended: boolean): string {
  const head = `Sektor ${sektor.nr}, Podstrefa ${sektor.podstrefa}`
  if (since === null) return head
  const datum = krakauDatumDeutsch(since)
  return extended ? `${head} — seit ${datum} erweitert` : `${head} — neu seit ${datum}`
}
