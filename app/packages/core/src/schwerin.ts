/**
 * Der Schweriner Feed-Dialekt.
 *
 * Der achte Parser, und wieder ein eigener: Schwerin schreibt
 * `Mo - Sa 8-20 h` mit Leerzeichen um den Bindestrich und einem nackten „h",
 * `2.50 Euro je Std.` mit **Dezimalpunkt** und die Höchstparkdauer als
 * `ohne` oder `2 h`. Keine der sieben anderen Grammatiken liest auch nur
 * eine dieser drei Formen; ein gemeinsamer Parser müsste alle acht kennen
 * und wäre bei jeder Änderung an einer Stadt für sieben andere gefährlich.
 *
 * Datensatz: `masterportal:Parkscheinautomaten` (143 Punkte) und
 * `masterportal:Parkzonen` (15 Polygone) aus
 * <https://geoportal.kreis-lup.de/ows/masterportal/parken-sn>, abgerufen am
 * 16. September 2026 — gehostet vom Landkreis Ludwigslust-Parchim, Quelle
 * laut `ows:AccessConstraints` die Landeshauptstadt Schwerin. Fixtures:
 * `test/fixtures/sn-*-2026-09-16.json`.
 *
 * Die eine Eigenheit, die alles andere bestimmt: **Die Zonenpolygone tragen
 * kein einziges Attribut.** Nicht einmal eine Kennung — MapServer schreibt
 * `WARNING: No featureid defined for typename 'Parkzonen'` als Kommentar in
 * die Antwort. Welche Zone welche ist, steht nur in der **Kartendarstellung**
 * desselben Dienstes: Der WMS zeichnet die 15 Flächen in 15 Farben und
 * beschriftet sie in seiner Legende mit `Parkzone A` bis `Parkzone V`, dazu
 * fünf Mischflächen (`A/F`, `A/D`, `C/D`, `C/O`, `A/C`). Es sind Schwerins
 * **Bewohnerparkzonen** — die Stadt führt auf ihrer Parkseite genau diese
 * zehn Buchstaben (`ZoneA.pdf` … `ZoneV.pdf`). Tarif, Zeiten und
 * Höchstparkdauer stehen an den Automaten darin, wie in Frankfurt.
 *
 * Wie die Buchstaben an die Polygone kommen, steht bei `SCHWERIN_ZONE_ANCHORS`.
 */

import type { Weekday } from './berlin-time.js'
import { multiPolygonContains, type PolygonRings, type Position } from './geo.js'
import type { Fee } from './parse-fee.js'
import type { ChargeWindow } from './tariff.js'

export class SchwerinParseError extends Error {
  constructor(
    readonly raw: string,
    reason: string
  ) {
    super(`Schweriner Feed: ${JSON.stringify(raw)} — ${reason}`)
    this.name = 'SchwerinParseError'
  }
}

/** Wie in den anderen Parsern: fremde Eingabe wird zuerst begrenzt. */
const MAX_INPUT_LENGTH = 120

/** Die Kürzel des Feeds. Sonntag ist 0, wie in `berlin-time.ts`. */
const DAY_NAMES: Record<string, Weekday> = {
  so: 0,
  mo: 1,
  di: 2,
  mi: 3,
  do: 4,
  fr: 5,
  sa: 6,
}

/**
 * `Mo - Sa 8-20 h`: Tagesspanne mit Leerzeichen um den Bindestrich, dann eine
 * Stundenspanne **ohne** Leerzeichen, dann ein nacktes „h".
 *
 * Fünf Schreibweisen im Abzug vom 16. September 2026, und alle fünf haben
 * genau diese Form: `Mo - Sa 8-20 h` (125), `Mo - Fr 8-18 h` (7),
 * `Mo - So 8-21 h` (5), `Mo - So 0-24 h` (4), `Mo - So 8-18 h` (2). Der
 * Ausdruck lässt die Leerzeichen um beide Bindestriche frei, weil das
 * dieselbe Schreibweise ist; er verlangt aber die Tagesspanne, weil kein
 * Wert ohne eine auskommt — ein einzelner Tag käme still als Sonntag heraus,
 * wenn man ihn zuliesse, ohne ihn je gesehen zu haben.
 */
const CLAUSE = /^([A-Za-z]{2})\s*-\s*([A-Za-z]{2})\s+(\d{1,2})\s*-\s*(\d{1,2})\s*h$/

function parseDays(raw: string, fromSpec: string, toSpec: string): readonly Weekday[] {
  const from = DAY_NAMES[fromSpec.toLowerCase()]
  const to = DAY_NAMES[toSpec.toLowerCase()]
  if (from === undefined || to === undefined) {
    throw new SchwerinParseError(raw, `unbekannte Tagesangabe ${JSON.stringify(`${fromSpec} - ${toSpec}`)}`)
  }
  // Rundlauf statt `for (d = from; d <= to)`, wie in Frankfurt: `Sa - Mo`
  // ergäbe sonst eine leere Liste, und leer hiesse „nie gebührenpflichtig".
  const span = (to - from + 7) % 7
  const days: Weekday[] = []
  for (let step = 0; step <= span; step += 1) days.push(((from + step) % 7) as Weekday)
  return days.sort((a, b) => a - b)
}

/**
 * Zerlegt `Bewirtschaftungszeit` in genau ein Fenster.
 *
 * `0-24` heißt Minute 0 bis 1440, nie 0 bis 0 — auf 0 abgebildet wäre
 * `Mo - So 0-24 h` das genaue Gegenteil dessen, was am Marstall und am Zoo
 * steht. Eine Spanne über Mitternacht kommt im Abzug nicht vor und wird
 * abgewiesen: Sie stillschweigend als ein Fenster zu speichern hiesse
 * „nie" (`windowCovers` verlangt `from < to`), sie zu zerlegen hiesse, eine
 * Lesart zu erfinden, die niemand geprüft hat.
 */
export function parseSchwerinSchedule(raw: string): ChargeWindow[] {
  if (raw.length > MAX_INPUT_LENGTH) {
    throw new SchwerinParseError(raw.slice(0, 40), `${raw.length} Zeichen sind keine Zeitangabe`)
  }
  const text = raw.trim().replace(/\s+/g, ' ')
  if (text === '') throw new SchwerinParseError(raw, 'leere Zeitangabe')
  const match = CLAUSE.exec(text)
  if (match === null) throw new SchwerinParseError(raw, 'keine erkennbare Tag-und-Stunden-Angabe')

  const weekdays = parseDays(raw, match[1] as string, match[2] as string)
  const fromHour = Number(match[3])
  const toHour = Number(match[4])
  if (fromHour > 24 || toHour > 24) {
    throw new SchwerinParseError(raw, `Stunde über 24 in ${JSON.stringify(text)}`)
  }
  const from = fromHour * 60
  const to = toHour * 60
  if (from >= to) {
    throw new SchwerinParseError(raw, `Spanne ${fromHour}-${toHour} endet nicht nach ihrem Anfang`)
  }
  return [{ weekdays, fromMinute: from, toMinute: to }]
}

/**
 * Beträge im Feed: `2.50 Euro je Std.` (134) und `1.50 Euro je Std.` (7) —
 * mit **Dezimalpunkt**, als einzige Stadt. Ein Komma wird nicht angenommen:
 * Wechselt die Quelle die Schreibweise, soll der Datenbau anhalten und nicht
 * eine Form durchwinken, die nie gegen den Abzug gemessen wurde.
 *
 * Die beiden Beträge sind die der Parkgebührenverordnung vom 1. Juli 2024
 * (Parkzone 1: 2,50 €, Parkzone 2: 1,50 €) — der Feed ist preislich aktuell.
 */
const SCHWERIN_AMOUNT = /^(\d{1,3})\.(\d{2})\s*Euro\s*je\s*Std\.?$/i

/**
 * Zerlegt `Gebuehr`.
 *
 * Zwei Automaten lassen das Feld leer (Am Marstall, Zoo) — der eine ein
 * Privatparkplatz der Landesregierung mit Sonderregelung, der andere „nur
 * Tagesticket für 4 Euro". Beides ist **kein** Betrag von null: `unknown`
 * sagt, dass die Quelle je Stunde nichts nennt, und die Oberfläche sagt es
 * weiter. Ein Nullbetrag bricht ab, wie in allen anderen Gebührenparsern.
 */
export function parseSchwerinFee(raw: string | null | undefined): Fee {
  if (raw === null || raw === undefined) return { kind: 'unknown' }
  if (raw.length > MAX_INPUT_LENGTH) {
    throw new SchwerinParseError(raw.slice(0, 40), `${raw.length} Zeichen sind keine Gebühr`)
  }
  const text = raw.trim()
  if (text === '' || text === '-') return { kind: 'unknown' }
  const match = SCHWERIN_AMOUNT.exec(text)
  if (match === null) throw new SchwerinParseError(raw, 'kein erkennbarer Betrag je Stunde')
  const centsPerHour = Number(match[1]) * 100 + Number(match[2])
  if (centsPerHour === 0) throw new SchwerinParseError(raw, 'ein Betrag von 0.00 Euro ist kein Tarif')
  return { kind: 'exact', centsPerHour }
}

/**
 * Zerlegt `Hoechstparkdauer`: `ohne` (104), `2 h` (25), `4 h` (13), leer (1).
 *
 * `ohne` und leer heißen beide „keine Begrenzung" und nicht null Minuten —
 * null Minuten hiesse Parken verboten, und das steht dort nicht. `0 h`
 * bricht ab, weil unklar ist, was es meinte.
 */
export function parseSchwerinMaxStay(raw: string | null | undefined): number | undefined {
  if (raw === null || raw === undefined) return undefined
  if (raw.length > MAX_INPUT_LENGTH) {
    throw new SchwerinParseError(raw.slice(0, 40), `${raw.length} Zeichen sind keine Parkdauer`)
  }
  const text = raw.trim()
  if (text === '' || /^ohne$/i.test(text)) return undefined
  const match = /^(\d{1,2})\s*h$/i.exec(text)
  if (match === null) throw new SchwerinParseError(raw, 'keine Stundenangabe')
  const hours = Number(match[1])
  if (hours === 0) throw new SchwerinParseError(raw, '0 h ist keine Hoechstparkdauer')
  return hours * 60
}

/** Der Code, unter dem die Oberfläche eine Höchstparkdauer beschriftet — wie in Frankfurt. */
export function schwerinMaxStayCode(minutes: number): string {
  return minutes % 60 === 0 ? `${minutes / 60}h` : `${minutes}min`
}

/**
 * Legt die Gebühren mehrerer Automaten zu einer Aussage über ihre Zone
 * zusammen — Frankfurts Regel, hier noch einmal, weil sie Frankfurts ist.
 *
 * Im Abzug vom 16. September nennt keine Zone zwei Beträge: 2,50 € in allen
 * zwölf Zonen mit Automaten der Innenstadt, 1,50 € in Zone O. Die Spanne
 * bleibt trotzdem der Weg für den Tag, an dem sich das ändert. Automaten
 * ohne Betrag zählen nicht mit.
 */
export function mergeSchwerinFees(fees: readonly Fee[]): Fee {
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
 * Vereinigt die Fenster mehrerer Automaten, doppelte heraus, Reihenfolge
 * stabil.
 *
 * Und damit die Antwort auf die Frage, was gilt, wenn Automaten in einer
 * Zone einander widersprechen — in Zone A stehen `Mo - Sa 8-20 h` (zehn
 * Automaten), `Mo - So 8-21 h` (vier) und `Mo - So 8-18 h` (einer)
 * nebeneinander. Die Fenster werden **vereinigt**, nicht gemittelt und nicht
 * nach Mehrheit entschieden: `windowCovers` fragt, ob *irgendeines* passt,
 * und die App warnt damit sonntags um 20 Uhr in Zone A vor einer Gebühr,
 * die an vier von fünfzehn Automaten wirklich anfällt. Der andere Fehler —
 * die Mehrheit nehmen und sonntags „frei" sagen — kostet jemanden am
 * Pfaffenteich ein Knöllchen. Was wirklich an den Automaten steht, zeigt das
 * Panel wörtlich, mit Zähler je Schreibweise.
 *
 * Nicht verschmolzen werden benachbarte Fenster: `8-20` und `8-21` als
 * `8-21` auszugeben hiesse, zehn Automaten eine Stunde anzudichten.
 */
export function mergeSchwerinWindows(windows: readonly ChargeWindow[]): ChargeWindow[] {
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
 * Rohfelder eines Parkscheinautomaten, so wie `gml.ts` sie liefert: jedes
 * Feld eine Zeichenkette, leer statt `null`, weil MapServer ein leeres Feld
 * als leeres Element schreibt. `?:` trotzdem, weil ein Feld auch fehlen kann,
 * und `null`, weil `fixture-shape.test.ts` den Unterschied kennt.
 */
export interface SchwerinAutomatProperties {
  /** `PA 41` … `PA 143`; **`PA 138` steht zweimal** (Amtstraße 21 und Zoo). */
  Bezeichnung?: string | null
  /** 140-mal leer; sonst „Lage kontrollieren", „nur Tagesticket für 4 Euro", eine Sonderregelung. */
  Bemerkung?: string | null
  Standort?: string | null
  /** `Mo - Sa 8-20 h` und vier weitere. */
  Bewirtschaftungszeit?: string | null
  /** `ohne`, `2 h`, `4 h`, leer. */
  Hoechstparkdauer?: string | null
  /** `2.50 Euro je Std.`, `1.50 Euro je Std.`, leer. */
  Gebuehr?: string | null
  /** `ja` / `nein`. */
  Tagesticket?: string | null
  /** `ja` / `nein`. */
  Kurzparkticket?: string | null
}

/**
 * Was der Feed über einen Automaten sonst noch sagt — oder `null`.
 *
 * „Lage kontrollieren" ist eine Notiz des Amts an sich selbst und keine
 * Auskunft an Parkende; sie bleibt draussen. Die Sonderregelung am Marstall
 * und das Tagesticket am Zoo sind Auskünfte und kommen mit.
 */
const INTERNAL_NOTE = /^lage kontrollieren$/i

export function schwerinAutomatNote(properties: SchwerinAutomatProperties): string | null {
  const text = (properties.Bemerkung ?? '').replace(/\s+/g, ' ').trim()
  if (text === '' || INTERNAL_NOTE.test(text)) return null
  return text
}

/**
 * Ein Ankerpunkt je Zone: ein Ort in EPSG:25833, der in genau dieser Fläche
 * liegt, mit dem Buchstaben, den der Dienst selbst dort zeichnet.
 *
 * ## Woher die Buchstaben kommen
 *
 * Der WFS gibt für die 15 Polygone keine Attribute heraus; der **WMS
 * desselben Dienstes** beschriftet sie. Gemessen am 16. September 2026:
 * `GetLegendGraphic` für `Parkzonen` liefert 15 Farbfelder mit den Titeln
 * `Parkzone A`, `A/F`, `A/D`, `C`, `C/D`, `D`, `F`, `G`, `H`, `J`, `L`, `O`,
 * `V`, `C/O`, `A/C`; `GetMap` als `image/svg+xml` liefert die 15 Flächen als
 * Pfade mit genau diesen Füllfarben. Jeder Pfad wurde stützpunktweise mit den
 * WFS-Polygonen verglichen — gleiche Stützpunktzahl, mittlerer Abstand
 * 0,71 m (die Rasterung des Bildes) —, und so bekam jedes Polygon seinen
 * Buchstaben. Die Stadt bestätigt die zehn Grundbuchstaben auf ihrer
 * Parkseite: `Uebersicht-Bewohnerparkzonen.pdf`, `ZoneA.pdf` … `ZoneV.pdf`
 * (<https://www.schwerin.de/mein-schwerin/leben/ordnung-sicherheit-verkehr/verkehr-mobilitaet/mit-dem-kfz/parken/>).
 * Die fünf Mischflächen beschriftet nur der Dienst; was `A/F` genau bedeutet
 * (beide Ausweise gelten, vermutlich), sagt keine Quelle, deshalb steht der
 * Name so da, wie der Dienst ihn schreibt, und nicht ausgeschrieben.
 *
 * ## Warum Ankerpunkte und nicht Reihenfolge
 *
 * Die Features haben keine Kennung, und die Reihenfolge einer WFS-Antwort ist
 * keine Zusicherung. Ein Punkt *in* der Fläche überlebt jede Umsortierung
 * und jede Nachbearbeitung der Grenzen um ein paar Meter; erst wenn die
 * Stadt eine Zone verschiebt oder auflöst, fällt er heraus — und dann
 * **bricht der Datenbau ab**, statt einer Fläche einen falschen Buchstaben
 * zu geben (`schwerinZoneLetters`).
 *
 * ## Warum die kleinste Fläche gewinnt
 *
 * Die Mischflächen liegen **in** oder **auf** den Grundzonen: `A/C` (0,1 ha)
 * vollständig in `A`, `A/F` überlappt `F`, `A/D` überlappt `D`. Ein Anker in
 * `A/C` liegt zwangsläufig auch in `A`; er gehört der kleineren Fläche.
 * Dieselbe Regel gilt später auf der Karte: Die Zonen werden nach Fläche
 * aufsteigend ausgeliefert, damit `zoneAt` — „erste Fläche, die den Punkt
 * enthält" — die Mischfläche findet und nicht die Grundzone darunter.
 */
export interface SchwerinZoneAnchor {
  /** Der Buchstabe aus der Legende des Dienstes, wörtlich. */
  zone: string
  /** Ostwert in EPSG:25833, Meter. */
  easting: number
  /** Nordwert in EPSG:25833, Meter. */
  northing: number
}

export const SCHWERIN_ZONE_ANCHORS: readonly SchwerinZoneAnchor[] = [
  { zone: 'A', easting: 262961.5, northing: 5948151.1 },
  { zone: 'A/C', easting: 263332.9, northing: 5948076.9 },
  { zone: 'A/D', easting: 262831.5, northing: 5948442.3 },
  { zone: 'A/F', easting: 262825.6, northing: 5947838.3 },
  { zone: 'C', easting: 263176.1, northing: 5948758.9 },
  { zone: 'C/D', easting: 262803.1, northing: 5949157.1 },
  { zone: 'C/O', easting: 263615.4, northing: 5949300.6 },
  { zone: 'D', easting: 262619.8, northing: 5948663.3 },
  { zone: 'F', easting: 262394.0, northing: 5947621.4 },
  { zone: 'G', easting: 261999.8, northing: 5947940.3 },
  { zone: 'H', easting: 262065.0, northing: 5948566.8 },
  { zone: 'J', easting: 262318.0, northing: 5948986.6 },
  { zone: 'L', easting: 262501.1, northing: 5947188.4 },
  { zone: 'O', easting: 263750.1, northing: 5948799.1 },
  { zone: 'V', easting: 261792.7, northing: 5948061.9 },
]

/**
 * Ebene Fläche eines Multipolygons in den Einheiten seiner Koordinaten —
 * Gauß'sche Trapezformel, Löcher abgezogen. In UTM-Metern sind das
 * Quadratmeter; `areaSquareMetres` in `geo.ts` rechnet Grad um und wäre
 * hier falsch.
 */
export function planarArea(polygons: readonly PolygonRings[]): number {
  let total = 0
  for (const rings of polygons) {
    rings.forEach((ring, index) => {
      let sum = 0
      for (let i = 0; i < ring.length; i += 1) {
        const a = ring[i] as Position
        const b = ring[(i + 1) % ring.length] as Position
        sum += a[0] * b[1] - b[0] * a[1]
      }
      const area = Math.abs(sum) / 2
      total += index === 0 ? area : -area
    })
  }
  return Math.max(0, total)
}

/**
 * Der Buchstabe je Polygon, in der Reihenfolge der Polygone.
 *
 * Bricht ab, sobald die Zuordnung nicht mehr eindeutig ist: ein Anker in
 * keiner Fläche, zwei Anker in derselben kleinsten Fläche, eine Fläche ohne
 * Anker, oder eine andere Zahl von Flächen als Ankern. Jeder dieser Fälle
 * heißt, dass die Stadt ihre Zonen verändert hat — und dann gehört die
 * Tabelle oben neu gemessen, nicht die Ausgabe geraten.
 */
export function schwerinZoneLetters(
  polygons: readonly (readonly PolygonRings[])[],
  anchors: readonly SchwerinZoneAnchor[] = SCHWERIN_ZONE_ANCHORS
): string[] {
  if (polygons.length !== anchors.length) {
    throw new SchwerinParseError(
      String(polygons.length),
      `${polygons.length} Zonenflächen, aber ${anchors.length} Ankerpunkte — die Tabelle SCHWERIN_ZONE_ANCHORS gehört neu gemessen`
    )
  }
  const areas = polygons.map(planarArea)
  const letters: (string | undefined)[] = polygons.map(() => undefined)
  for (const anchor of anchors) {
    const point: Position = [anchor.easting, anchor.northing]
    let chosen = -1
    polygons.forEach((rings, index) => {
      if (!multiPolygonContains(rings, point)) return
      if (chosen < 0 || (areas[index] as number) < (areas[chosen] as number)) chosen = index
    })
    if (chosen < 0) {
      throw new SchwerinParseError(anchor.zone, 'der Ankerpunkt liegt in keiner Zonenfläche')
    }
    const taken = letters[chosen]
    if (taken !== undefined) {
      throw new SchwerinParseError(anchor.zone, `dieselbe Fläche wie ${JSON.stringify(taken)}`)
    }
    letters[chosen] = anchor.zone
  }
  return letters.map((letter, index) => {
    if (letter === undefined) {
      throw new SchwerinParseError(String(index), 'Zonenfläche ohne Ankerpunkt')
    }
    return letter
  })
}
