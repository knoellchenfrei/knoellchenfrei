/**
 * Der St. Galler Feed-Dialekt.
 *
 * Datensatz: `ppv-parkflaeche` („Parkplätze und Parkflächen der Stadt
 * St.Gallen") im Open-Data-Portal der Stadt (`daten.stadt.sg.ch`, Opendatasoft),
 * 3.232 Polygone, abgerufen am 17. September 2026 als GeoJSON-Export.
 * Fixture: `test/fixtures/sg-parkflaechen-2026-09-17.json`. Dazu die 31
 * statistischen Quartiere (`wohnviertel`), Fixture
 * `test/fixtures/sg-wohnviertel-2026-09-17.json`.
 *
 * Was dieser Feed anders macht als Bern und Genf, die beiden Schweizer Städte
 * davor: **Er kennt keine Zonen, nur Parkfelder.** Jedes Polygon ist eine
 * Reihe von ein bis 80 Parkplätzen (Median 27 m², 1,6 m breit), und das
 * einzige Sachfeld, das etwas über das Regime sagt, ist `markierungsart` mit
 * zwölf Werten — `Erweiterte Blaue Zone` (1.871), `Weiss (bewirtschaftet)`
 * (781), dazu Kunden-, Invaliden-, Taxi- und Carparkplätze, Garagen,
 * Güterumschlag, Hotelhalt und drei Arten von „nichts". Weder Zeiten noch
 * Beträge noch der EBZ-Sektor, für den eine Anwohnerbewilligung gilt. Das ist
 * Klasse C der Recherche vom 16. September; der Datenbau setzt
 * `scheduleUnknown: true`, `windows: []` und `fee: { kind: 'unknown' }`.
 *
 * Woraus dann eine „Zone" wird: aus der Markierungsart. Die Stadt kennt genau
 * zwei bewirtschaftete Regime im Strassenraum — die **Erweiterte Blaue Zone**
 * (Parkscheibe tagsüber, Bewilligung für Anwohner, Sektoren nur für die
 * Bewilligung) und die **weiss markierten Parkfelder mit Parkuhr**. Beide
 * gelten stadtweit gleich; der Sektor der EBZ steht in keinem offenen
 * Datensatz (nur als Ebene `ebz` im Stadtplan der Stadt, ohne Dienst
 * dahinter). Deshalb zwei Zonenschlüssel, `EBZ` und `Parkuhr`, und jede
 * Reihe bleibt ein eigenes Stück davon — wie Hamburgs Stücke und Karlsruhes
 * Reihen; die App nummeriert Flächen selbst und nennt den Abstand, wenn die
 * Ortung eine Reihe knapp verfehlt (`zoneSnapMetres`). Ein Schlüssel je
 * Quartier („EBZ Rotmonten") wäre eine Zone, die es laut Stadt nicht gibt.
 *
 * Alles andere ist keine Zone: Kundenparkplätze gehören Läden, Garagen
 * liegen unter der Erde, die 33 Felder der `Weissen Zone (nicht
 * bewirtschaftet)` sind frei, und was `unbekannt` oder `Ohne Markierung`
 * heisst, sagt nichts. Die Invalidenparkplätze wandern als POI auf die Karte,
 * wie Genfs `places handicapées`.
 */

export class StGallenParseError extends Error {
  constructor(
    readonly raw: string,
    reason: string
  ) {
    super(`St. Galler Feed: ${JSON.stringify(raw)} — ${reason}`)
    this.name = 'StGallenParseError'
  }
}

/**
 * Der längste Wert des Abzugs ist `Weisse Zone (nicht bewirtschaftet)` mit
 * 34 Zeichen; 120 lässt Luft für einen neuen und hält Unfug draussen.
 */
const MAX_INPUT_LENGTH = 120

function bounded(raw: string, what: string): string {
  if (raw.length > MAX_INPUT_LENGTH) {
    throw new StGallenParseError(raw.slice(0, MAX_INPUT_LENGTH), `${what} ist länger als ${MAX_INPUT_LENGTH} Zeichen`)
  }
  return raw.replace(/\s+/g, ' ').trim()
}

/**
 * Die Rohfelder einer Parkfläche, wie der GeoJSON-Export von Opendatasoft sie
 * schreibt und `fixture-shape.test.ts` sie beobachtet: `geo_point_2d` ist der
 * Schwerpunkt als Objekt (kein Array, anders als GeoJSON-Positionen),
 * `anzahl_pp` ist eine ganze Zahl und in drei Zeilen `null`.
 */
export interface StGallenAreaProperties {
  geo_point_2d?: { lon: number; lat: number } | null
  markierungsart?: string | null
  zutrittsart?: string | null
  anzahl_pp?: number | null
}

/** Die Rohfelder eines statistischen Quartiers (`wohnviertel`). */
export interface StGallenQuarterProperties {
  geo_point_2d?: { lon: number; lat: number } | null
  /** Dreistellig: erste Ziffer der Stadtkreis (1 Westen, 2 Centrum, 3 Osten). */
  nummer?: number | null
  kreis?: string | null
  quartiergr?: string | null
  /** Der Quartiername — das Feld heisst im Export abgeschnitten `statistisc`. */
  statistisc?: string | null
}

/**
 * Die zwölf Markierungsarten des Abzugs, als Schlüssel ohne Umlaute.
 *
 * `ebz` und `parkuhr` werden Zonen; alles andere wird gezählt und bleibt
 * draussen (`invaliden` als POI). Die Menge ist geschlossen: Eine
 * dreizehnte Art im nächsten Abzug soll jemand lesen, bevor sie als
 * „keine Zone" durchgeht — oder, schlimmer, als eine.
 */
export type StGallenMarking =
  | 'ebz'
  | 'parkuhr'
  | 'kunden'
  | 'invaliden'
  | 'gueterumschlag'
  | 'garage'
  | 'weissFrei'
  | 'unbekannt'
  | 'ohneMarkierung'
  | 'taxi'
  | 'hotel'
  | 'car'

const MARKINGS: Readonly<Record<string, StGallenMarking>> = {
  'erweiterte blaue zone': 'ebz',
  'weiss (bewirtschaftet)': 'parkuhr',
  kundenparkplatz: 'kunden',
  invalidenparkplatz: 'invaliden',
  güterumschlag: 'gueterumschlag',
  'unterirdisch, garage': 'garage',
  'weisse zone (nicht bewirtschaftet)': 'weissFrei',
  unbekannt: 'unbekannt',
  'ohne markierung': 'ohneMarkierung',
  taxistandplatz: 'taxi',
  hotelhalt: 'hotel',
  carparkplatz: 'car',
}

/**
 * Die Markierungsart. Nur die zwölf Werte des Abzugs, Gross-/Kleinschreibung
 * und Leerraum verziehen; alles andere wirft.
 */
export function parseStGallenMarking(raw: string): StGallenMarking {
  const text = bounded(raw, 'die Markierungsart').toLowerCase()
  const marking = MARKINGS[text]
  if (marking === undefined) throw new StGallenParseError(raw, 'keine der zwölf Markierungsarten des Abzugs')
  return marking
}

/**
 * Der Zonenschlüssel zu einer Markierungsart — oder `null`, wenn die Fläche
 * keine Zone ist.
 *
 * `EBZ` und `Parkuhr` sind die Wörter, die die Stadt selbst benutzt
 * („Erweiterte Blaue Zone (EBZ)", „Parkplätze mit Parkuhren"); sie stehen
 * als Ausprägung in `zone-keys.generated.ts` und in der Nutzungsstatistik.
 */
export function stGallenZoneKey(marking: StGallenMarking): 'EBZ' | 'Parkuhr' | null {
  if (marking === 'ebz') return 'EBZ'
  if (marking === 'parkuhr') return 'Parkuhr'
  return null
}

/**
 * Die Zutrittsart. Alle 3.232 Zeilen sagen `öffentlich`; ein anderer Wert
 * wäre eine Fläche, die nicht jeder benutzen darf, und die gehört nicht
 * stillschweigend auf die Karte.
 */
export function parseStGallenAccess(raw: string): 'public' {
  const text = bounded(raw, 'die Zutrittsart').toLowerCase()
  if (text === 'öffentlich') return 'public'
  throw new StGallenParseError(raw, 'nicht öffentlich')
}

/**
 * Die Platzzahl. `null` und `0` sind beide „nicht angegeben" — im Abzug
 * dreimal `null` und zweimal `0`, und eine Reihe mit null Plätzen gibt es
 * nicht. Alles, was keine ganze Zahl ab 1 ist, wirft: Ein `2.5` oder ein
 * negativer Wert wäre ein neuer Fall, kein Platzhalter.
 */
export function parseStGallenSpaces(raw: number | null | undefined): number | null {
  if (raw === null || raw === undefined || raw === 0) return null
  if (typeof raw !== 'number' || !Number.isInteger(raw) || raw < 1 || raw > 10_000) {
    throw new StGallenParseError(String(raw), 'keine Platzzahl')
  }
  return raw
}

/**
 * Der Satz unter der Zone: das Regime in Worten, dazu die Platzzahl der
 * Reihe. Kein Satz über Zeiten oder Beträge — die stehen nicht in den Daten,
 * und die Oberfläche sagt das an anderer Stelle.
 */
export function stGallenZoneNote(key: 'EBZ' | 'Parkuhr', spaces: number | null): string {
  const regime =
    key === 'EBZ'
      ? 'Erweiterte Blaue Zone: blau markierte Parkfelder, tagsüber mit Parkscheibe, mit Bewilligung unbeschränkt'
      : 'Weiss markierte, bewirtschaftete Parkfelder mit Parkuhr'
  if (spaces === null) return `${regime} — Platzzahl nicht angegeben`
  return `${regime} — ${spaces} ${spaces === 1 ? 'Platz' : 'Plätze'} in dieser Reihe`
}

/**
 * Der Quartiername und die Zeile darüber, aus den drei Feldern des
 * Quartier-Exports. Wirft, wenn eines fehlt: Ein Quartier ohne Namen wäre
 * in der Kopfzeile des Panels ein leerer Platz.
 */
export function stGallenQuarter(p: StGallenQuarterProperties): { name: string; bezirk: string } {
  const name = bounded(p.statistisc ?? '', 'der Quartiername')
  const gruppe = bounded(p.quartiergr ?? '', 'die Quartiergruppe')
  const kreis = bounded(p.kreis ?? '', 'der Stadtkreis')
  if (name === '' || gruppe === '' || kreis === '') {
    throw new StGallenParseError(JSON.stringify(p), 'Quartier ohne Namen, Gruppe oder Kreis')
  }
  return { name, bezirk: `${gruppe}, Kreis ${kreis}` }
}
