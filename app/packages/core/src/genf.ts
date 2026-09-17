/**
 * Der Genfer Feed-Dialekt.
 *
 * Datensätze des SITG (Système d'information du territoire à Genève, Etat de
 * Genève), abgerufen am 17. September 2026 über die ArcGIS-REST-Dienste auf
 * `vector.sitg.ge.ch`:
 *
 * - `OTC_MACARON` — 53 „zones de parcage avec macaron", die
 *   Bewohnerparkzonen des ganzen Kantons. Fixture:
 *   `test/fixtures/genf-macaron-2026-09-17.json` (alle 53 Sachdatenzeilen).
 * - `OTC_STATIONNEMENT_V_PUBLIQUE` — 13.236 Parkierungslinien, je eine
 *   Stellplatzreihe mit Art und Platzzahl. Fixture:
 *   `test/fixtures/genf-stationnement-2026-09-17.json` (je Art eine Zeile).
 *
 * Was dieser Feed anders macht als die Städte davor: **Er nennt weder Zeiten
 * noch Beträge.** Die Zone hat einen Buchstaben (`ZONE_MACARON`), einen
 * Sektor und ein Datum — sonst nichts. Genf ist damit die erste Stadt der
 * Klasse C (`docs/staedte-recherche-2026-09-16.md`): jede Zone trägt
 * `scheduleUnknown`, die App sagt „Zeiten unbekannt" und färbt grau. Was die
 * Stellplatzreihen dazu sagen, ist die **Art** der Plätze — `Payant 90 min`,
 * `Gratuit 60 min` (die Blaue Zone), `Gratuit illimité` — und daraus kommen
 * je Zone die Platzzahl und die Höchstparkdauern, nicht mehr.
 *
 * Die Feldwerte bleiben französisch. Sie sind Zitat der Quelle; übersetzt
 * wird in der Oberfläche, nicht im Parser.
 */

export class GenfParseError extends Error {
  constructor(
    readonly raw: string,
    reason: string
  ) {
    super(`Genfer Feed: ${JSON.stringify(raw)} — ${reason}`)
    this.name = 'GenfParseError'
  }
}

/**
 * Der längste `TYPE_STATIONNEMENT`-Wert des Abzugs hat 22 Zeichen
 * (`Stationnement interdit`), das Feld ist im Dienst auf 30 begrenzt. 60
 * lässt Luft und hält Unfug draußen.
 */
const MAX_INPUT_LENGTH = 60

/** Die Sachdaten einer Macaron-Zone, so wie `OTC_MACARON/0` sie liefert. */
export interface GenfZoneProperties {
  /** Buchstabe in der Ville de Genève (`A`–`Q`), Nummer in den übrigen Gemeinden (`43B`). Einmal null. */
  ZONE_MACARON?: string | null
  /** Der Sektor, in Genf ein Quartiername — einmal ein Leerzeichen. */
  NOM_SECTEUR?: string | null
  /** Inbetriebnahme als Unix-Millisekunden; die erste Zone 1997. */
  MISE_EN_SERVICE?: number | null
  'SITG_ADM.OTC_MACARON.FID'?: number | null
  'SHAPE.AREA'?: number | null
  'SHAPE.LEN'?: number | null
}

/** Die Sachdaten einer Parkierungslinie, so wie `OTC_STATIONNEMENT_V_PUBLIQUE/0` sie liefert. */
export interface GenfLineProperties {
  OBJECTID?: number | null
  NOM_RUES?: string | null
  /** Art und Dauer in einem Wort: `Payant 90 min`, `Gratuit 60 min`, `Vélos` … 28 Werte und null. */
  TYPE_STATIONNEMENT?: string | null
  NOMBRE_PLACES?: number | null
  'SHAPE.LEN'?: number | null
  /** Nur bei Zweiradplätzen: Bügel, Etrier, Glissière. */
  TYPE_SUPPORT?: string | null
  NOMBRE_ARCEAUX?: number | null
}

/**
 * Was eine Stellplatzreihe ist.
 *
 * Zwei Fälle, nicht drei: Entweder die Reihe ist für Autos und trägt ein
 * Regime — bezahlt (Parkuhr, `Payant`) oder unbezahlt (`Gratuit`, das ist die
 * Blaue Zone mit Parkscheibe oder ein Platz ohne Beschränkung) — mit einer
 * Höchstdauer oder ohne (`illimité`). Oder sie ist etwas anderes: Zweiräder,
 * Velos, Motorräder, Polizei, Ambulanz, Reisebusse, Carsharing, Ladeplätze,
 * gelb markierte Sonderplätze, Halteverbot. Für „was kostet Parken hier" ist
 * nur der erste Fall eine Auskunft; der zweite wird gezählt und benannt.
 */
export type GenfPlaceType =
  | { vehicles: 'car'; regime: 'payant' | 'gratuit'; maxStayMinutes: number | null }
  | { vehicles: 'other'; label: string }

/**
 * Die Werte, die keine Autoreihe mit Regime sind — alle 14 aus dem Abzug,
 * wörtlich. Ein Wert, der hier nicht steht und nicht `Payant …`/`Gratuit …`
 * heißt, ist neu, und der Datenbau soll ihn zählen statt ihn zu raten.
 *
 * `Gratuit jaune` steht hier und nicht bei den Autoreihen: Gelb markierte
 * Plätze sind in der Schweiz Plätze mit Sonderberechtigung (Lieferanten,
 * bestimmte Fahrzeuge), keine freien Plätze — „gratuit" wäre die eine
 * Lesart, die sicher falsch ist.
 */
const OTHER_TYPES: ReadonlySet<string> = new Set([
  'Cases 2 roues',
  'Vélos',
  'Vélo cargo',
  'Moto',
  'Stationnement interdit',
  'Police',
  'Ambulance',
  'Cars',
  'Mobility',
  'Electrique',
  'Autre',
  'Habitant / nuit',
  'Gratuit jaune',
  'Gratuit jaune spécial',
])

/** `Payant 90 min`, `Gratuit 15 heures`, `Payant illimité` — Groß-/Kleinschreibung wie im Feed. */
const CAR_TYPE = /^(?<regime>Payant|Gratuit) (?:(?<amount>\d{1,3}) (?<unit>min|heures?)|(?<unlimited>illimité))$/u

/**
 * Zerlegt `TYPE_STATIONNEMENT`.
 *
 * Wirft nur `GenfParseError`: bei leerem oder fehlendem Wert, bei einem
 * unbekannten Wort und bei einer Dauer von null. Eine Dauer von null wäre
 * dieselbe Falle wie ein Betrag von null in Berlin — niemand weiß, was sie
 * im Feed bedeutete, und „keine Beschränkung" ist die Lesart, die sie sicher
 * nicht verdient.
 */
export function parseGenfTypeStationnement(raw: string | null | undefined): GenfPlaceType {
  if (raw === null || raw === undefined) throw new GenfParseError('', 'kein TYPE_STATIONNEMENT')
  if (raw.length > MAX_INPUT_LENGTH) {
    throw new GenfParseError(raw.slice(0, 40), `${raw.length} Zeichen sind keine Stellplatzart`)
  }
  const text = raw.trim().replace(/\s+/g, ' ')
  if (text === '') throw new GenfParseError(raw, 'leer')
  if (OTHER_TYPES.has(text)) return { vehicles: 'other', label: text }

  const match = CAR_TYPE.exec(text)
  if (match?.groups === undefined) throw new GenfParseError(raw, 'keine bekannte Stellplatzart')
  const regime = match.groups['regime'] === 'Payant' ? 'payant' : 'gratuit'
  if (match.groups['unlimited'] !== undefined) return { vehicles: 'car', regime, maxStayMinutes: null }

  const amount = Number(match.groups['amount'])
  const minutes = match.groups['unit'] === 'min' ? amount : amount * 60
  if (minutes === 0) throw new GenfParseError(raw, 'eine Dauer von null ist keine Höchstparkdauer')
  if (minutes > 24 * 60) throw new GenfParseError(raw, 'länger als ein Tag')
  return { vehicles: 'car', regime, maxStayMinutes: minutes }
}

/**
 * Der Zonenschlüssel: `ZONE_MACARON`, nichts sonst.
 *
 * Der Buchstabe steht auf dem Macaron und auf dem Schild; er ist das, was
 * jemand ausspricht. `FID` wäre stabil, aber niemand parkt „in Zone 26".
 * Ohne Buchstaben (eine der 53 Zonen, Sektor ` `) gibt es keinen Schlüssel —
 * werfen, nicht raten; der Datenbau zählt die Zone als ausgelassen.
 */
export function genfZoneKey(properties: { ZONE_MACARON?: string | null | undefined }): string {
  const key = (properties.ZONE_MACARON ?? '').trim()
  if (key === '') throw new GenfParseError(key, 'Zone ohne ZONE_MACARON')
  if (!/^[A-Z0-9]{1,4}$/u.test(key)) throw new GenfParseError(key, 'kein Zonenbuchstabe und keine Zonennummer')
  return key
}

/**
 * Die Höchstparkdauer als Schlüssel der Oberfläche: `90min`, `1h`, `4h`.
 *
 * Dieselbe Form wie Berlins Abschnittsauswertung (`maxStayValues`), damit
 * `maxStayLabel` in der Web-App daraus „90 Min." und „4 Std." macht, ohne
 * eine Genfer Ausnahme zu kennen.
 */
export function genfMaxStayCode(minutes: number): string {
  if (!Number.isInteger(minutes) || minutes <= 0) {
    throw new GenfParseError(String(minutes), 'keine Dauer in Minuten')
  }
  return minutes % 60 === 0 ? `${minutes / 60}h` : `${minutes}min`
}

/**
 * Der Straßenname, wie ein Mensch ihn liest.
 *
 * Der Feed schreibt `Comte-GÉRAUD, Rue du` und `Mont-Blanc, Rue du`: den
 * Namen zuerst, den Straßentyp nach dem Komma, wie ein Register. Auf dem
 * Schild steht `Rue du Comte-Géraud`. Gedreht wird nur die eine Form mit
 * genau einem Komma; alles andere bleibt, wie es ist — lieber ein
 * Registername als ein falsch gedrehter.
 */
export function genfStreetLabel(raw: string | null | undefined): string {
  const text = (raw ?? '').replace(/\s+/g, ' ').trim()
  const match = /^([^,]+), ([^,]+)$/u.exec(text)
  if (match === null) return text
  return `${(match[2] as string).trim()} ${(match[1] as string).trim()}`
}
