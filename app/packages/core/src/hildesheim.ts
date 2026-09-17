/**
 * Der Hildesheimer Feed-Dialekt — Klasse C, wie Essen und Kassel: Die Quelle
 * nennt Grenzen und sonst nichts.
 *
 * Datensatz: MapServer-WFS `Bewohnerparkzonen` der GDI der Stadt Hildesheim
 * (`gdi.stadt-hildesheim.de/interface/wfs-ms/Bewohnerparkzonen`, Typname
 * `ms:Bewohnerparkzonen`), abgerufen am 17. September 2026: **7 Polygone**,
 * `numberMatched="7"`. Vier Felder je Fläche, alle als Zeichenkette:
 * `_feature_id` (GML-Kennung, `3379215` …), `ID` (`1` … `7`), `Zone`
 * (`Zone A` … `Zone G`) und `path` — ein durchgereichter Windows-Pfad der
 * Quell-Shapedatei (`I:/GDI-HI/WebGIS/…/Besucherparkzonen/Zone D_A.shp`), der
 * nebenbei verrät, dass die Stadt die Ebene intern „Besucherparkzonen"
 * nennt. Keine Zeiten, kein Betrag, keine Höchstparkdauer: Die stehen in
 * der Gebührenordnung für das Parken an Parkscheinautomaten und an den
 * Schildern, nicht im Dienst. Jede Zone geht deshalb mit
 * `scheduleUnknown: true` und `fee: { kind: 'unknown' }` hinaus, und die App
 * sagt „Zeiten unbekannt" statt „frei".
 *
 * Fixtures: `test/fixtures/hildesheim-zonen-2026-09-17.json` (die sieben
 * Sachdatensätze, wörtlich) und `test/fixtures/hildesheim-zone-d-2026-09-17.json`
 * (eine vollständige Fläche mit Loch — Zone D, 191 + 33 Stützpunkte).
 *
 * Was hier gelesen wird, ist der **Buchstabe**: `Zone D` → `D`. Er ist der
 * Zonenschlüssel, denn er ist das, was auf dem Bewohnerparkausweis und auf
 * den Infoblättern der Stadt steht („Bewohnerparkzone D"). `ID` wäre nur
 * die Zeilennummer der Shapedatei und ist in der Quelle nicht in derselben
 * Reihenfolge wie die Buchstaben (ID 1 ist Zone D, ID 7 ist Zone C) — ein
 * Schlüssel, den niemand auf einem Schild wiederfindet. Was nicht die Form
 * `Zone <Großbuchstabe>` hat, wird abgewiesen: Ein Feed, der morgen
 * `Zone D neu` oder ein leeres Feld liefert, soll im Datenbau laut
 * scheitern und nicht als „Zone " auf der Karte stehen.
 */

export class HildesheimParseError extends Error {
  constructor(
    readonly raw: string,
    reason: string
  ) {
    super(`Hildesheimer Feed: ${JSON.stringify(raw)} — ${reason}`)
    this.name = 'HildesheimParseError'
  }
}

/**
 * Der längste echte Wert ist `Zone G` mit sechs Zeichen. 40 lässt Luft für
 * eine spätere Schreibweise wie `Bewohnerparkzone G`; alles darüber ist kein
 * Zonenname mehr, sondern Text, der in das falsche Feld geraten ist.
 */
const MAX_INPUT_LENGTH = 40

/**
 * `Zone A` bis `Zone Z` — genau ein Großbuchstabe nach dem Wort, mit
 * beliebig viel Leerraum dazwischen. Kleinbuchstaben und Umlaute sind
 * ausgeschlossen: Die Stadt vergibt die Zonen als lateinische Großbuchstaben
 * (heute A bis G), und ein `Zone ä` wäre ein Tippfehler, den jemand sehen
 * soll.
 */
const ZONE_NAME = /^Zone\s+([A-Z])$/u

export interface HildesheimZoneName {
  /** Der Buchstabe, z. B. `D` — er ist der Zonenschlüssel. */
  letter: string
  /** Wie die Stadt die Zone nennt: `Bewohnerparkzone D`. */
  label: string
}

/**
 * Liest das Feld `Zone`.
 *
 * Wirft **nur** `HildesheimParseError` — die Zusicherung aus `fuzz.test.ts`,
 * wie bei jedem anderen Parser: Der Datenbau unterscheidet „unlesbarer Wert"
 * von „kaputter Parser" am Typ des Fehlers.
 */
export function parseHildesheimZoneName(raw: string | null | undefined): HildesheimZoneName {
  if (typeof raw !== 'string') throw new HildesheimParseError(String(raw), 'kein Text')
  if (raw.length > MAX_INPUT_LENGTH) {
    throw new HildesheimParseError(raw.slice(0, MAX_INPUT_LENGTH), `länger als ${MAX_INPUT_LENGTH} Zeichen`)
  }
  const tidy = raw.replace(/\s+/gu, ' ').trim()
  if (tidy === '') throw new HildesheimParseError(raw, 'Zone ohne Namen')
  const match = ZONE_NAME.exec(tidy)
  if (match === null) throw new HildesheimParseError(raw, 'kein Zonenname der Form „Zone A"')
  const letter = match[1] as string
  return { letter, label: `Bewohnerparkzone ${letter}` }
}

/**
 * Was im Panel unter der Zone steht. Die Zeiten- und Gebührenlücke sagt die
 * Oberfläche selbst (`scheduleUnknown`); hier steht nur, was für ein Gebiet
 * das ist und wo der Betrag stünde, wenn man ihn wüsste.
 */
export function hildesheimZoneNote(name: HildesheimZoneName): string {
  return (
    `${name.label} — Zeiten und Beträge stehen in der Gebührenordnung für das Parken ` +
    'an Parkscheinautomaten der Stadt Hildesheim und am Schild, nicht im Dienst'
  )
}

/**
 * Rohzeile einer Fläche, so weit wir sie lesen — es gibt nicht mehr. Alle
 * vier Felder kommen als Zeichenkette, auch `ID`; `fixture-shape.test.ts`
 * hält das fest, damit ein Wechsel zu Zahlen auffällt.
 */
export interface HildesheimZoneProperties {
  /** GML-Kennung des Dienstes, z. B. `3379215`. Stabil je Abzug, aber kein Name. */
  _feature_id?: string | null
  /** Zeilennummer der Shapedatei, `1` bis `7` — nicht in Buchstabenreihenfolge. */
  ID?: string | null
  /** `Zone A` … `Zone G` — nur über `parseHildesheimZoneName` lesen. */
  Zone?: string | null
  /** Windows-Pfad der Quell-Shapedatei, durchgereicht. Nicht verwendet. */
  path?: string | null
}
