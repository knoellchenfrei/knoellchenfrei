/**
 * Der Geraer Feed-Dialekt — Klasse C, und der erste Feed, in dem Fläche und
 * Straße in **einer** Ebene liegen.
 *
 * Datensatz: `gera:geom_portal_anwohnerparken` („Anwohnerparkzonen") im
 * GeoServer-WFS 2.0.0 des Geoportals der Stadt Gera
 * (`geoportal.gera.de/geoserver/gera/wfs`), abgerufen am 17. September 2026.
 * 148 Features mit sechs Feldern: `mslink` (laufende Nummer, eindeutig),
 * `infostring` (`L - Calvinstraße`), `anwohnerparkzone` (`A` … `L`), dazu
 * `entity`, `feature` und `mapid` aus dem Kartensystem der Stadt. Keine
 * Zeiten, kein Betrag, keine Höchstparkdauer, keine Lizenzangabe. Fixtures:
 * `test/fixtures/gera-anwohnerparken-2026-09-17.json` (die zehn Flächen und
 * sechs Linien) und `gera-behindertenparkplaetze-2026-09-17.json`.
 *
 * Was die Recherche vom 16. September übersehen hat und die Messung zeigt:
 * Die Ebene hat **nicht** 148 Linien, sondern 138 `LineString` und
 * **10 `Polygon`** — je Zonenbuchstabe genau eine Fläche (`B - Innenstadt
 * (Nord)`, `K - Innenstadt (Süd)`, …), und die Linien sind die Straßen
 * darin. Nachgemessen am 17. September: Von 138 Linien liegen 128 ganz in
 * der Fläche ihres Buchstabens, die übrigen zehn höchstens 4,8 m daneben
 * (Schillerstraße, Zone C). Die Flächen **sind** damit die Zonen, und die
 * Linien brauchen kein Band, wie es Wiens Geschäftsstraßen bekommen — sie
 * werden zur Straßenliste der Zone. Der Datenbau prüft die Nähe trotzdem:
 * Eine Linie, die weiter als zwölf Meter von ihrer Fläche wegläuft, ist ein
 * Zeichen, dass die Flächen die Zonen nicht mehr decken, und bricht den Bau
 * ab, statt eine Straße stumm zu verlieren.
 *
 * Der Buchstabe ist der Zonenschlüssel. Zehn Werte kommen vor: `A`, `B`, `C`,
 * `D`, `E`, `G`, `H`, `K`, `L` — und einmal **`C/G`**, die Zschochernstraße
 * mit Ziegelberg, eine Fläche, die zu zwei Zonen gehört; die Stadtseite zum
 * Bewohnerparken nennt genau diese Straße mit „(Zone C und G)". Der Parser
 * liest den Schrägstrich als „gehört zu beiden" und gibt die Buchstaben
 * einzeln zurück; ein Wert wie `c`, `AB` oder `C/C` wird abgewiesen, denn ein
 * Feed, der morgen anders schreibt, soll im Datenbau auffallen und nicht als
 * Zone „AB" auf der Karte stehen.
 *
 * Deshalb gibt es hier keinen Zeit- und keinen Gebührenparser. Jede Zone geht
 * als `scheduleUnknown` mit `fee: { kind: 'unknown' }` hinaus; die
 * Gebührenordnung der Stadt (`Parkgebuehrenordnung_12.12.2022.pdf` im
 * Ortsrecht) ist ein PDF und keine Ebene — `docs/staedte-gera.md`.
 */

export class GeraParseError extends Error {
  constructor(
    readonly raw: string,
    reason: string
  ) {
    super(`Geraer Feed: ${JSON.stringify(raw)} — ${reason}`)
    this.name = 'GeraParseError'
  }
}

/**
 * Der längste `infostring` des Abzugs hat 44 Zeichen
 * („C - Ziegelberg, Zschochern-, Bauvereinstraße"). 120 lässt Luft für eine
 * Aufzählung mehr; was darüber liegt, ist kein Straßenname, sondern Text,
 * der irgendwo hineingeraten ist.
 */
const MAX_INPUT_LENGTH = 120

/** Ein Großbuchstabe — oder zwei, mit Schrägstrich, für eine geteilte Fläche. */
const ZONE_KEY = /^([A-Z])(?:\/([A-Z]))?$/

export interface GeraZoneKey {
  /** So, wie die Quelle ihn schreibt: `B` oder `C/G`. Das ist der Zonenschlüssel. */
  key: string
  /** Die Buchstaben einzeln — `['C', 'G']` für die geteilte Fläche, sonst einer. */
  letters: readonly string[]
}

function guard(raw: unknown, what: string): string {
  if (typeof raw !== 'string') throw new GeraParseError(String(raw), `kein Text (${what})`)
  if (raw.length > MAX_INPUT_LENGTH) {
    throw new GeraParseError(raw.slice(0, 40), `länger als ${MAX_INPUT_LENGTH} Zeichen — kein ${what}`)
  }
  return raw.replace(/\s+/g, ' ').trim()
}

/**
 * Liest `anwohnerparkzone`.
 *
 * Wirft **nur** `GeraParseError` — die Zusicherung aus `fuzz.test.ts`, wie
 * bei jedem anderen Parser: Der Datenbau unterscheidet „unlesbarer Wert" von
 * „kaputter Parser" am Typ des Fehlers.
 */
export function parseGeraZoneKey(raw: unknown): GeraZoneKey {
  const tidy = guard(raw, 'Zonenbuchstabe')
  if (tidy === '') throw new GeraParseError(String(raw), 'leer — ohne Buchstaben hat die Fläche keine Zone')
  const match = ZONE_KEY.exec(tidy)
  if (match === null) {
    throw new GeraParseError(tidy, 'kein Zonenbuchstabe der Form „B" oder „C/G"')
  }
  const first = match[1] as string
  const second = match[2]
  if (second === undefined) return { key: first, letters: [first] }
  // `C/C` wäre keine geteilte Fläche, sondern ein Tippfehler; `G/C` steht im
  // Abzug nicht, und eine zweite Schreibweise derselben Fläche wäre auf der
  // Statistikseite eine zweite Zone.
  if (second === first) throw new GeraParseError(tidy, 'derselbe Buchstabe zweimal')
  if (second < first) throw new GeraParseError(tidy, `Buchstaben nicht aufsteigend — die Quelle schreibt „${first}/${second}" als „${second}/${first}"`)
  return { key: `${first}/${second}`, letters: [first, second] }
}

/**
 * Was ein `infostring` sagt: den Buchstaben und den Namen dahinter.
 *
 * Der Buchstabe vorn muss zum Feld `anwohnerparkzone` passen — der Datenbau
 * vergleicht beide, denn ein Feed, in dem die Zeile „E - Schuhgasse" in Zone
 * K steht, hat einen Fehler, den nur dieser Vergleich sieht.
 */
export interface GeraInfostring {
  /** Der Buchstabe vor dem Trennstrich, wie `parseGeraZoneKey` ihn liest. */
  zone: GeraZoneKey
  /**
   * Der Name dahinter: ein Straßenname (`Calvinstraße`), eine Aufzählung
   * (`Ziegelberg, Zschochern-, Bauvereinstraße`) oder bei den Flächen der
   * Gebietsname (`Innenstadt (Nord)`).
   */
  name: string
}

/** Buchstaben, Ziffern, Leerzeichen, Punkt, Komma, Bindestrich, Schrägstrich, Klammern — was ein Straßenname braucht, sonst nichts. */
const NAME = /^[\p{L}\d][\p{L}\d .,\-/()]*$/u

/** Liest `infostring` (`L - Calvinstraße`); wirft nur `GeraParseError`. */
export function parseGeraInfostring(raw: unknown): GeraInfostring {
  const tidy = guard(raw, 'Infotext')
  const parts = tidy.split(' - ')
  if (parts.length !== 2) throw new GeraParseError(tidy, 'kein Infotext der Form „B - Name"')
  const [head, name] = parts as [string, string]
  const zone = parseGeraZoneKey(head)
  const trimmed = name.trim()
  if (trimmed === '') throw new GeraParseError(tidy, 'kein Name hinter dem Trennstrich')
  if (!NAME.test(trimmed)) throw new GeraParseError(tidy, 'Name mit Zeichen, die in keinem Straßennamen stehen')
  if (/[-,/]$/.test(trimmed)) throw new GeraParseError(tidy, 'Name endet auf ein Trennzeichen')
  return { zone, name: trimmed }
}

/**
 * Der Name, unter dem die Zone in Suche und Panel steht: `Zone B —
 * Innenstadt (Nord)`. Für die geteilte Fläche `Zone C/G — Zschochernstraße /
 * Ziegelberg`; die Stadt selbst schreibt „Zone C und G".
 */
export function geraZoneName(zone: GeraZoneKey, areaName: string): string {
  return `Zone ${zone.key} — ${areaName}`
}

/** Rohzeile eines Features der Ebene `geom_portal_anwohnerparken`, jedes Feld kann fehlen. */
export interface GeraZoneProperties {
  /** Laufende Nummer, im Abzug eindeutig (148 Werte). Kein fachlicher Schlüssel. */
  mslink?: number | null
  /** `L - Calvinstraße` bei Linien, `B - Innenstadt (Nord)` bei Flächen — nur über `parseGeraInfostring` lesen. */
  infostring?: string | null
  /** Bei allen 148 `0`. Bedeutung unbekannt; nicht verwendet. */
  entity?: number | null
  /**
   * `62637` bei den zehn Flächen, `62638` bei den 138 Linien — ein Code des
   * Kartensystems. Der Datenbau entscheidet Fläche oder Linie an der
   * **Geometrie**, nicht an dieser Zahl; die Fixture hält nur fest, dass
   * beide zusammenfallen.
   */
  feature?: number | null
  /** Bei allen 148 `2885`. Nicht verwendet. */
  mapid?: number | null
  /** `A` … `L`, einmal `C/G` — nur über `parseGeraZoneKey` lesen. */
  anwohnerparkzone?: string | null
}

/** Rohzeile eines Behindertenparkplatzes (`geom_portal_behindertenparkplaetze`, 12 Punkte). */
export interface GeraAccessibleProperties {
  mslink?: number | null
  entity?: number | null
  feature?: number | null
  mapid?: number | null
  /** `Am Bärenweg (1 Platz)`, `Küchengartenallee (5 Plätze)` — nur über `parseGeraAccessible` lesen. */
  infostring?: string | null
  /** Darstellungsgröße im Portal, bei allen `40`. Nicht verwendet. */
  click_size?: number | null
}

export interface GeraAccessible {
  /** Der Ort ohne die Klammer: `Am Bärenweg`. */
  label: string
  /** Die Zahl aus der Klammer, `1` bei „(1 Platz)". */
  spaces: number
}

/**
 * Liest `infostring` eines Behindertenparkplatzes: `<Ort> (<n> Platz|Plätze)`.
 *
 * Die Klammer ist Pflicht: Alle zwölf Punkte des Abzugs tragen sie, und ein
 * Punkt ohne Zahl wäre auf der Karte ein Platz ohne Aussage. `Plätze` vor
 * `Platz` in der Alternative — die lange Endung zuerst, wie überall hier.
 * Null Plätze sind kein Parkplatz.
 */
export function parseGeraAccessible(raw: unknown): GeraAccessible {
  const tidy = guard(raw, 'Behindertenparkplatz')
  const match = /^(.+?)\s*\((\d{1,3}) (?:Plätze|Platz)\)$/u.exec(tidy)
  if (match === null) throw new GeraParseError(tidy, 'kein Eintrag der Form „Ort (n Platz)"')
  const label = (match[1] as string).trim()
  if (!NAME.test(label)) throw new GeraParseError(tidy, 'Ort mit Zeichen, die in keinem Straßennamen stehen')
  const spaces = Number(match[2])
  if (spaces === 0) throw new GeraParseError(tidy, 'null Plätze sind kein Parkplatz')
  return { label, spaces }
}
