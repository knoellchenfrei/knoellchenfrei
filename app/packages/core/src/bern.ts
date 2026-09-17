/**
 * Der Berner Feed-Dialekt.
 *
 * Datensatz: `Geoportal/Parkkartenzonen/MapServer/1` („Parkkartenzone_Umrandung")
 * im ArcGIS-Server der Stadt Bern (`map.bern.ch`), 42 Polygone, abgerufen am
 * 17. September 2026. Fixture: `test/fixtures/bern-parkkartenzonen-2026-09-17.json`.
 *
 * Was dieser Feed anders macht als alle Städte davor: **Er nennt weder
 * Zeiten noch Beträge.** Die Ebene ist der „Basisdatensatz für die
 * Parkkartenbewirtschaftung" — sie sagt, in welcher Zone eine Anwohner-
 * Parkkarte gilt, nicht, wann die Parkscheibe läuft oder was die Parkuhr
 * kostet. Das ist Klasse C der Recherche vom 16. September: Geometrie mit
 * Typ, sonst nichts. Der Datenbau setzt deshalb `scheduleUnknown: true`,
 * `windows: []` und `fee: { kind: 'unknown' }` an jede Zone; die App sagt
 * „Zeiten unbekannt" und färbt grau, statt „frei" zu behaupten.
 *
 * Was der Feed trotzdem sagt, und was hier gelesen wird:
 *
 *  1. **Der Zonenname** (`PKZ_name`) ist eine Postleitzahl, bei geteilten
 *     Zonen mit Zusatz: `3006`, `3008/1`, `3018/11`. Er ist der Schlüssel —
 *     und er ist **nicht eindeutig**: drei Namen tragen je zwei Flächen
 *     (`3000`, `3008/1`, `3008/3`). Dasselbe wie Hamburgs Stücke; die App
 *     nummeriert Flächen selbst. `PLZ_beschrieb` und `PLZ_zusatz_beschrieb`
 *     führen dieselbe Auskunft noch einmal in zwei Feldern; der Datenbau
 *     prüft, dass beide Schreibweisen zusammenpassen.
 *  2. **Die Parkfeldart** (`Parkfeld_typ_beschrieb`): `blau mit Markierung`
 *     (30 Flächen) oder `weiss mit Markierung` (4). Blau ist die Blaue Zone
 *     mit Parkscheibe, weiss sind gebührenpflichtige oder freie Felder —
 *     was davon, sagt der Feed nicht.
 *  3. **Der Hinweis** (`Info_beschrieb`): `unbekannt` (18), `nicht
 *     definiert` (10), leer (10) — und viermal `Auch Sonntags`. Das ist die
 *     einzige Zeitaussage des ganzen Datensatzes, und sie ist eine halbe:
 *     Sie sagt, dass sonntags etwas gilt, nicht was. Sie wandert deshalb
 *     wörtlich in `unmodelledRules`, wo die Oberfläche sie als Regel nennt,
 *     die hier nicht berechnet wird.
 *
 * Und **acht der 42 Flächen tragen gar nichts**: kein Name, keine Art, kein
 * Hinweis, nur `Objectid` und ein Änderungsdatum. Fünf davon liegen
 * innerhalb benannter Zonen. Sie werden im Datenbau ausgelassen und gezählt —
 * eine Fläche ohne Aussage wäre auf der Karte eine Zone, die es laut Quelle
 * nicht gibt, und innerhalb einer benannten Zone ein Klickziel, das die
 * falsche Auskunft zeigt.
 */

export class BernParseError extends Error {
  constructor(
    readonly raw: string,
    reason: string
  ) {
    super(`Berner Feed: ${JSON.stringify(raw)} — ${reason}`)
    this.name = 'BernParseError'
  }
}

/**
 * `PKZ_name` ist im Dienst auf 40 Zeichen begrenzt, die Beschriebe auf 255.
 * 120 lässt Luft für einen längeren Hinweis und hält Unfug draußen.
 */
const MAX_INPUT_LENGTH = 120

function bounded(raw: string, what: string): string {
  if (raw.length > MAX_INPUT_LENGTH) {
    throw new BernParseError(raw.slice(0, MAX_INPUT_LENGTH), `${what} ist länger als ${MAX_INPUT_LENGTH} Zeichen`)
  }
  return raw.replace(/\s+/g, ' ').trim()
}

/**
 * Die Rohfelder des Feeds, wie `fixture-shape.test.ts` sie beobachtet:
 * jedes Feld kann `null` sein, und bei acht Flächen sind alle Sachfelder
 * `null`. Die beiden `Shape.*`-Felder sind ArcGIS-Rechenfelder in
 * Quadrat- und Laufmetern des Landessystems (LV95), keine Grade.
 */
export interface BernZoneProperties {
  Objectid?: number | null
  PKZ_name?: string | null
  Parkfeld_typ?: number | null
  Parkfeld_typ_beschrieb?: string | null
  PLZ?: number | null
  PLZ_beschrieb?: string | null
  PLZ_zusatz?: number | null
  PLZ_zusatz_beschrieb?: string | null
  Bemerkung?: string | null
  Info?: number | null
  Info_beschrieb?: string | null
  /** Unix-Millisekunden, wie ArcGIS `esriFieldTypeDate` sie in GeoJSON schreibt. */
  Letzte_Aenderung?: number | null
  'Shape.STArea()'?: number | null
  'Shape.STLength()'?: number | null
}

/** `blau`: Blaue Zone mit Parkscheibe. `weiss`: weiss markierte Felder. */
export type BernFieldType = 'blau' | 'weiss'

/**
 * Der Zonenname: eine vierstellige Postleitzahl, wahlweise mit `/`-Zusatz.
 *
 * Streng, weil der Name der Zonenschlüssel wird: Ein Schlüssel aus Unfug
 * wäre eine Zone, die es nicht gibt, und die stünde in
 * `zone-keys.generated.ts` als gültige Ausprägung.
 */
const ZONE_NAME = /^\d{4}(?:\/[1-9]\d?)?$/

export function parseBernZoneName(raw: string): string {
  const text = bounded(raw, 'der Zonenname')
  // Der Zusatz beginnt nie mit einer Null: `/0` wäre kein Zusatz, `/01`
  // dieselbe Zone wie `/1` unter einem zweiten Schlüssel.
  if (!ZONE_NAME.test(text)) {
    throw new BernParseError(raw, 'kein Zonenname der Form 3006 oder 3008/1')
  }
  return text
}

/**
 * Der Zonenname, wie ihn `PLZ_beschrieb` und `PLZ_zusatz_beschrieb` zusammen
 * ergeben — die zweite Schreibweise derselben Auskunft. Der Datenbau
 * vergleicht sie mit `PKZ_name`; laufen die beiden auseinander, ist der
 * Feed in sich widersprüchlich, und das soll auffallen, nicht raten.
 */
export function bernZoneNameFromPlz(plz: string, zusatz: string): string {
  const base = bounded(plz, 'die Postleitzahl')
  if (!/^\d{4}$/.test(base)) throw new BernParseError(plz, 'keine vierstellige Postleitzahl')
  const suffix = bounded(zusatz, 'der Zusatz')
  if (suffix === 'kein Zusatz') return base
  if (!/^\/[1-9]\d?$/.test(suffix)) {
    throw new BernParseError(zusatz, 'weder „kein Zusatz" noch ein Zusatz der Form /1')
  }
  return parseBernZoneName(`${base}${suffix}`)
}

const FIELD_TYPES: Readonly<Record<string, BernFieldType>> = {
  'blau mit markierung': 'blau',
  'weiss mit markierung': 'weiss',
}

/**
 * Die Parkfeldart. Nur die zwei Werte des Abzugs; alles andere wirft, damit
 * eine neue Art („gelb", „ohne Markierung") gelesen wird, bevor sie als
 * Blaue Zone auf der Karte steht.
 */
export function parseBernFieldType(raw: string): BernFieldType {
  const text = bounded(raw, 'die Parkfeldart').toLowerCase()
  const kind = FIELD_TYPES[text]
  if (kind === undefined) throw new BernParseError(raw, 'weder blau noch weiss mit Markierung')
  return kind
}

/**
 * Der Hinweis der Quelle. `unbekannt` und `nicht definiert` sind zwei
 * Schreibweisen für „nichts"; `Auch Sonntags` ist die eine Zeitaussage des
 * Feeds und kommt wörtlich zurück, weil das Modell sie nicht ausdrücken
 * kann — sie sagt nicht, was sonntags gilt. Alles andere wirft: Ein neuer
 * Hinweis soll gelesen werden, nicht stillschweigend als „nichts" gelten.
 */
export function parseBernInfo(raw: string): string | null {
  const text = bounded(raw, 'der Hinweis')
  const lower = text.toLowerCase()
  if (lower === '' || lower === 'unbekannt' || lower === 'nicht definiert') return null
  if (lower === 'auch sonntags') return 'Auch Sonntags'
  throw new BernParseError(raw, 'unbekannter Hinweis')
}

/**
 * Ob eine Fläche keine einzige Sachangabe trägt — die acht Flächen ohne
 * Namen. Geprüft werden alle vier Beschriebe, nicht nur der Name: Eine
 * Fläche mit Art, aber ohne Namen, wäre ein neuer Fall, den der Datenbau
 * mit einer Ausnahme melden soll, statt sie leise auszulassen.
 */
export function isBernZoneUnattributed(p: BernZoneProperties): boolean {
  return (
    (p.PKZ_name ?? null) === null &&
    (p.Parkfeld_typ_beschrieb ?? null) === null &&
    (p.PLZ_beschrieb ?? null) === null &&
    (p.Info_beschrieb ?? null) === null
  )
}

/**
 * Der Satz unter der Zone: Art der Parkfelder in Worten, dazu der Hinweis
 * der Quelle, falls sie einen hat. Kein Satz über Zeiten oder Beträge — die
 * kennt der Feed nicht, und die Oberfläche sagt das an anderer Stelle.
 */
export function bernZoneNote(kind: BernFieldType, rule: string | null): string {
  const fields =
    kind === 'blau'
      ? 'Blaue Zone: blau markierte Parkfelder mit Parkscheibe, Parkkarte hebt die Beschränkung auf'
      : 'Weiss markierte Parkfelder; ob gebührenpflichtig, sagt die Quelle nicht'
  return rule === null ? fields : `${fields} — Hinweis der Quelle: „${rule}"`
}
