/**
 * Der Saarbrücker Feed-Dialekt.
 *
 * Datensatz: „Parkzonen" im Open-Data-Portal der Landeshauptstadt Saarbrücken
 * (`opendata.saarbruecken.de/dataset/parkzonen`, Ordnungsamt, CKAN), zwei
 * GeoJSON-Dateien, abgerufen am 17. September 2026. Fixture:
 * `test/fixtures/saarbruecken-parkzonen-2026-09-17.json`.
 *
 * Was dieser Feed anders macht als alle Städte davor: **Die Flächen tragen
 * kein einziges Attribut.** `parkzonen_fl.geojson` hat 27 MultiPolygone, und
 * jedes hat als Sachdaten genau `{"ID": 0}` — die Zonenbuchstaben stehen in
 * einer zweiten Datei, `parkzonen_txt_pos.geojson`, als 30 Beschriftungs-
 * punkte aus dem CAD (`Text`, dazu `Layer-Ezs`, `Text-Rot`, `Text-Hoehe`),
 * drei davon ohne Text und alle drei auf demselben Punkt. Der Datenbau legt
 * die Punkte in die Flächen (Punkt in Polygon) und verlangt genau einen
 * Treffer je Fläche; 27 Flächen, 27 beschriftete Punkte, am 17. September
 * nachgemessen eins zu eins. Das ist Klasse C der Recherche vom
 * 16. September: Geometrie mit Namen, sonst nichts — weder Zeiten noch
 * Beträge. Jede Zone bekommt `scheduleUnknown: true`, `windows: []` und
 * `fee: { kind: 'unknown' }`; die App sagt „Zeiten unbekannt" und färbt
 * grau, statt „frei" zu behaupten.
 *
 * Was hier gelesen wird:
 *
 *  1. **Der Zonenbuchstabe** (`Text` der Beschriftung): ein Großbuchstabe,
 *     wahlweise mit einer Ziffer — `A1`, `B2`, `J`, `U`. Die Buchstaben
 *     sind die, die der Datensatz selbst nennt („Die Parkzonen werden in A,
 *     B, C, D, E, F, G, H, I, J, L, N, R und U unterteilt"); die Stadtseite
 *     „Übersicht über die Parkzonen" führt dieselben 27 Zonen mit ihren
 *     Straßen. `G` steht in der Beschreibung und hat weder Fläche noch
 *     Beschriftung noch Seite — der Buchstabe bleibt erlaubt, weil er zum
 *     Wertebereich der Quelle gehört, und der Test hält fest, dass er im
 *     Abzug fehlt.
 *  2. **Der Stadtteil** (`PGIS_TXT` der Stadtteil-Beschriftung, Datensatz
 *     „Stadtteile" desselben Portals): `11 Alt-Saarbrücken`, `48 Bübingen`
 *     — Nummer und Name in einem Feld. Die Zehnerstelle ist der
 *     Stadtbezirk (1 Mitte, 2 West, 3 Dudweiler, 4 Halberg); belegt über
 *     die vier Bezirksseiten der Stadt, und der Leser prüft Ziffer und Name
 *     gegeneinander, statt einer von beiden zu glauben.
 */

export class SaarbrueckenParseError extends Error {
  constructor(
    readonly raw: string,
    reason: string
  ) {
    super(`Saarbrücker Feed: ${JSON.stringify(raw)} — ${reason}`)
    this.name = 'SaarbrueckenParseError'
  }
}

/**
 * Die längste echte Eingabe ist `45 Brebach-Fechingen` mit 20 Zeichen. 120
 * lässt Luft für einen längeren Stadtteilnamen und hält Unfug draußen.
 */
const MAX_INPUT_LENGTH = 120

function bounded(raw: string, what: string): string {
  if (raw.length > MAX_INPUT_LENGTH) {
    throw new SaarbrueckenParseError(
      raw.slice(0, MAX_INPUT_LENGTH),
      `${what} ist länger als ${MAX_INPUT_LENGTH} Zeichen`
    )
  }
  return raw.replace(/\s+/g, ' ').trim()
}

/** Die Sachdaten einer Zonenfläche: genau ein Feld, und es sagt nichts. */
export interface SaarbrueckenZoneProperties {
  ID?: number | null
}

/**
 * Die Beschriftungspunkte der Zonen, wie das CAD sie exportiert hat. Alles
 * ist Text, auch die Zahlen (`'1495'`, `'15'`); bei den drei leeren Punkten
 * ist jedes Feld `null`.
 */
export interface SaarbrueckenLabelProperties {
  Text?: string | null
  'Layer-Ezs'?: string | null
  'Text-Attr'?: string | null
  'Text-Rot'?: string | null
  'Text-Hoehe'?: string | null
}

/**
 * Die Beschriftungspunkte der Stadtteile: `PGIS_TXT` ist der Text, `PGIS_R`
 * und `PGIS_H` sind Rechts- und Hochwert in UTM (Zone 32, Meter) — die
 * Geometrie des Punkts steht daneben in Grad, mit einer dritten Koordinate
 * `0.0`, die der Datenbau fallen lässt.
 */
export interface SaarbrueckenStadtteilLabelProperties {
  PGIS_TXT?: string | null
  PGIS_ANG?: number | null
  PGIS_R?: number | null
  PGIS_H?: number | null
}

/**
 * Die Buchstaben, die der Datensatz selbst als Wertebereich nennt. Ein
 * Buchstabe außerhalb wirft: Eine Beschriftung `K1` wäre eine Zone, die die
 * Stadt nicht kennt, und stünde sonst in `zone-keys.generated.ts` als
 * gültige Ausprägung.
 */
const ZONE_LETTERS = 'ABCDEFGHIJLNRU'

const ZONE_LABEL = /^([A-Z])([1-9])?$/

/**
 * Der Zonenbuchstabe mit Ziffer, wie er auf dem Schild steht: `A1`, `J`.
 *
 * Streng, weil er der Zonenschlüssel wird. Leerraum und Kleinschreibung
 * werden vergeben, mehr nicht — eine `0` oder eine zweite Ziffer gibt es im
 * Wertebereich nicht.
 */
export function parseSaarbrueckenZoneLabel(raw: string): string {
  const text = bounded(raw, 'die Zonenbeschriftung').toUpperCase()
  const match = ZONE_LABEL.exec(text)
  if (match === null) {
    throw new SaarbrueckenParseError(raw, 'keine Zonenbeschriftung der Form A1 oder J')
  }
  const letter = match[1] as string
  if (!ZONE_LETTERS.includes(letter)) {
    throw new SaarbrueckenParseError(raw, `Buchstabe ${letter} gehört nicht zu den Parkzonen A–U der Stadt`)
  }
  return text
}

/** Ob ein Beschriftungspunkt leer ist — die drei Punkte ohne Text. */
export function isSaarbrueckenLabelEmpty(p: SaarbrueckenLabelProperties): boolean {
  return (p.Text ?? null) === null
}

/** Der Name, wie ihn die Stadtseite schreibt: „Parkzone A1". */
export function saarbrueckenZoneName(label: string): string {
  return `Parkzone ${label}`
}

/**
 * Der Satz unter der Zone. Kein Satz über Zeiten oder Beträge — die kennt
 * der Feed nicht, und die Oberfläche sagt das an anderer Stelle. Genannt
 * wird die Zonengruppe, weil der Bewohnerparkausweis für den Buchstaben
 * gilt, nicht für die Ziffer.
 */
export function saarbrueckenZoneNote(label: string): string {
  const letter = label.slice(0, 1)
  return (
    `Bewohnerparkzone ${letter} der Landeshauptstadt Saarbrücken; ob und wann hier ` +
    'Parkgebühren gelten, nennt der Datensatz nicht'
  )
}

/** Die vier Stadtbezirke, aus der Zehnerstelle der Stadtteilnummer. */
export type SaarbrueckenBezirk = 'Mitte' | 'West' | 'Dudweiler' | 'Halberg'

const BEZIRK_BY_DIGIT: Readonly<Record<string, SaarbrueckenBezirk>> = {
  '1': 'Mitte',
  '2': 'West',
  '3': 'Dudweiler',
  '4': 'Halberg',
}

/**
 * Welcher Stadtteil zu welchem Bezirk gehört — von den vier Bezirksseiten
 * der Stadt (`saarbruecken.de/rathaus/stadtpolitik/bezirksraete_und_bezirksbuergermeisterinnen/stadtbezirk_<name>`,
 * gelesen am 17. September 2026): Mitte „Alt-Saarbrücken, St. Arnual,
 * St. Johann, Eschberg und Malstatt", West „Altenkessel, Burbach, Gersweiler
 * und Klarenthal", Dudweiler „Dudweiler, Jägersfreude, Herrensohr und
 * Scheidt", Halberg „Bischmisheim, Brebach-Fechingen, Bübingen, Ensheim,
 * Eschringen, Güdingen und Schafbrücke". Die Schreibweise `St.Johann` ohne
 * Leerzeichen ist die des Feeds.
 */
const BEZIRK_BY_NAME: Readonly<Record<string, SaarbrueckenBezirk>> = {
  'Alt-Saarbrücken': 'Mitte',
  Malstatt: 'Mitte',
  'St.Johann': 'Mitte',
  Eschberg: 'Mitte',
  'St. Arnual': 'Mitte',
  Gersweiler: 'West',
  Klarenthal: 'West',
  Altenkessel: 'West',
  Burbach: 'West',
  Dudweiler: 'Dudweiler',
  Jägersfreude: 'Dudweiler',
  Herrensohr: 'Dudweiler',
  Scheidt: 'Dudweiler',
  Schafbrücke: 'Halberg',
  Bischmisheim: 'Halberg',
  Ensheim: 'Halberg',
  'Brebach-Fechingen': 'Halberg',
  Eschringen: 'Halberg',
  Güdingen: 'Halberg',
  Bübingen: 'Halberg',
}

export interface SaarbrueckenStadtteil {
  /** Die amtliche Nummer, `11` bis `48`. */
  number: number
  /** Der Name, wie ihn die Oberfläche zeigt — `St.Johann` wird zu `St. Johann`. */
  name: string
  bezirk: SaarbrueckenBezirk
}

const STADTTEIL_LABEL = /^([1-4][1-9]) (\S.*)$/

/**
 * `11 Alt-Saarbrücken` → Nummer, Name, Bezirk.
 *
 * Zwei Quellen für den Bezirk — die Zehnerstelle und die Namensliste — und
 * beide müssen dasselbe sagen. Ein Name, den die Liste nicht kennt, wirft:
 * Ein neuer Stadtteil wäre eine Nachricht, und ein Tippfehler im Feed soll
 * gelesen werden, statt als zwanzigster Stadtteil auf der Karte zu stehen.
 */
export function parseSaarbrueckenStadtteil(raw: string): SaarbrueckenStadtteil {
  const text = bounded(raw, 'die Stadtteilbeschriftung')
  const match = STADTTEIL_LABEL.exec(text)
  if (match === null) {
    throw new SaarbrueckenParseError(raw, 'keine Stadtteilbeschriftung der Form „11 Alt-Saarbrücken"')
  }
  const number = match[1] as string
  const name = match[2] as string
  const byDigit = BEZIRK_BY_DIGIT[number.slice(0, 1)]
  const byName = BEZIRK_BY_NAME[name]
  if (byDigit === undefined || byName === undefined) {
    throw new SaarbrueckenParseError(raw, `Stadtteil ${name} steht in keiner Bezirksliste der Stadt`)
  }
  if (byDigit !== byName) {
    throw new SaarbrueckenParseError(
      raw,
      `Nummer ${number} gehört zum Bezirk ${byDigit}, der Name ${name} zum Bezirk ${byName}`
    )
  }
  return { number: Number(number), name: name.replace(/^St\.(?=\S)/, 'St. '), bezirk: byDigit }
}
