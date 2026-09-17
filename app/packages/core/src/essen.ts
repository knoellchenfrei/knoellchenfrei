/**
 * Der Essener Feed-Dialekt — und der kürzeste, den es gibt.
 *
 * Datensatz: „Bewohnerparkbereiche Essen" auf `opendata.essen.de` (DKAN),
 * Datei `Bewohnerparkbereiche.geojson`, **9 Polygone**, Stand laut Katalog
 * 9. November 2022, abgerufen am 17. September 2026. Lizenz Datenlizenz
 * Deutschland Namensnennung 2.0, Quelle laut Beschreibung „FB 66 - Amt für
 * Straßen und Verkehr / FB 62 - Amt für Geoinformation, Vermessung und
 * Kataster". Fixture: `test/fixtures/essen-bewohnerparkbereiche-2026-09-17.json`.
 *
 * Was dieser Feed anders macht als alle sechzehn Städte davor: **Er sagt
 * nichts.** Drei Felder je Fläche — `FID` (0 bis 8, die Zeilennummer der
 * Datei), `Id` (bei allen neun `0`) und `NameGebiet` — und sonst nichts. Keine
 * Zeiten, kein Betrag, keine Höchstparkdauer, kein Zonenschlüssel. Die sechs
 * Parkzonen der Stadt mit ihren Tarifen stehen nur auf der Stadtseite
 * (`docs/staedte-essen.md`), und **die neun Flächen sind nicht diese
 * Zonen**: Es sind die Bewohnerparkbereiche, in deren Teilen „gegen Zahlung
 * einer Gebühr geparkt werden" kann — in welchen Teilen, sagt weder der Feed
 * noch die Seite.
 *
 * Deshalb gibt es hier keinen Zeit- und keinen Gebührenparser. Jede Zone
 * geht als `scheduleUnknown` mit `fee: { kind: 'unknown' }` hinaus, und die
 * App sagt „Zeiten unbekannt" statt „frei" — die eine Antwort, die die
 * Daten hergeben. Was der Parser liest, ist der **Name**: Er ist der einzige
 * Schlüssel, den die Quelle hat, und er trägt bei fünf der neun Flächen eine
 * römische Ziffer in Klammern („Museum-Nord (II)"), die der Ausweis der
 * Stadt so nennt. Einen Namen, der nicht nach diesem Muster aussieht, weist
 * der Parser ab — ein Feed, der morgen ein Feld leer lässt, soll im Datenbau
 * laut scheitern und nicht als „Zone " auf der Karte stehen.
 */

export class EssenParseError extends Error {
  constructor(
    readonly raw: string,
    reason: string
  ) {
    super(`Essener Feed: ${JSON.stringify(raw)} — ${reason}`)
    this.name = 'EssenParseError'
  }
}

/**
 * Der längste Name des Abzugs hat 16 Zeichen („Museum-West (IV)"). 80 lässt
 * Luft für einen längeren Stadtteilnamen; alles darüber ist kein Name mehr,
 * sondern Text, der irgendwo hineingeraten ist.
 */
const MAX_INPUT_LENGTH = 80

/**
 * Ein Name aus Buchstaben, Ziffern, Leerzeichen, Bindestrich und Punkt —
 * dahinter wahlweise eine römische Ziffer I bis XII in Klammern.
 *
 * Buchstaben als `\p{L}`, nicht `[A-Za-z]`: „Innenstadt Süd" trägt ein ü, und
 * ein ASCII-Muster hätte den Namen an der einen Stelle abgeschnitten, an der
 * er sich von „Innenstadt Nord" unterscheidet. Die Ziffer ist eigens
 * begrenzt (`I{1,3}|IV|V|VI{0,3}|IX|X|XI|XII`) statt `[IVX]+`: „IIII" oder
 * „VX" wären keine römischen Zahlen, und ein Name mit so etwas in Klammern
 * ist im Zweifel ein Tippfehler im Feed, den jemand sehen soll.
 */
const AREA_NAME = /^([\p{L}][\p{L}\d .-]*?)(?:\s*\((I{1,3}|IV|V|VI{0,3}|IX|X|XI|XII)\))?$/u

export interface EssenAreaName {
  /** Der Name ohne Ziffer, z. B. `Museum-Nord`. */
  name: string
  /** Die römische Ziffer aus den Klammern, z. B. `II` — oder `null`, wenn keine dasteht. */
  numeral: string | null
  /**
   * Der Name so, wie er auf dem Ausweis steht, mit Ziffer: `Museum-Nord (II)`.
   * Das ist der Zonenschlüssel — die Quelle hat keinen anderen, und wie in
   * Köln („Porz-City") und Düsseldorf („Unterbilk (R)") ist ein lesbarer
   * Name als Schlüssel besser als eine Zeilennummer, die beim nächsten
   * Export anders sortiert sein kann.
   */
  label: string
}

/**
 * Liest `NameGebiet`.
 *
 * Wirft **nur** `EssenParseError` — die Zusicherung aus `fuzz.test.ts`, wie
 * bei jedem anderen Parser: Der Datenbau unterscheidet „unlesbarer Wert" von
 * „kaputter Parser" am Typ des Fehlers.
 */
export function parseEssenAreaName(raw: string): EssenAreaName {
  if (typeof raw !== 'string') throw new EssenParseError(String(raw), 'kein Text')
  if (raw.length > MAX_INPUT_LENGTH) {
    throw new EssenParseError(raw.slice(0, 40), `${raw.length} Zeichen sind kein Gebietsname`)
  }
  const tidy = raw.replace(/\s+/g, ' ').trim()
  if (tidy === '') throw new EssenParseError(raw, 'leer — der Feed hat keinen anderen Schlüssel als den Namen')
  const match = AREA_NAME.exec(tidy)
  if (match === null) throw new EssenParseError(raw, 'kein Gebietsname der Form „Name" oder „Name (II)"')
  const name = (match[1] as string).trim()
  // Der Name selbst darf nicht auf ein Trennzeichen enden; „Museum-" wäre
  // ein abgeschnittener Wert, kein Gebiet.
  if (/[-.]$/.test(name)) throw new EssenParseError(raw, 'endet auf ein Trennzeichen')
  const numeral = match[2] ?? null
  return { name, numeral, label: numeral === null ? name : `${name} (${numeral})` }
}

/** Rohzeile einer Fläche, so weit wir sie lesen — es gibt nicht mehr. */
export interface EssenZoneProperties {
  /** Zeilennummer der Datei, 0 bis 8. Kein stabiler Schlüssel. */
  FID?: number | null
  /** Bei allen neun Flächen `0`. Bedeutung unbekannt; nicht verwendet. */
  Id?: number | null
  /** `Ostviertel`, `Innenstadt Süd`, `Museum-Nord (II)` … — nur über `parseEssenAreaName` lesen. */
  NameGebiet?: string | null
}
