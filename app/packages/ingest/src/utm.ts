/**
 * UTM Nord (ETRS89) nach WGS 84 — für jede Zone, die eine Stadt braucht.
 *
 * Bis zum 16. September 2026 stand die Rechnung in `utm32.ts`, fest auf
 * Zone 32 verdrahtet, weil Köln die einzige Stadt war, deren Dienst nicht
 * umrechnet. Schwerin ist die zweite — und liegt in **Zone 33**
 * (EPSG:25833): Sein Dienst beim Landkreis Ludwigslust-Parchim antwortet auf
 * jedes `srsName` ausser 25833 mit `Invalid SRS`. Zwei Zonen unterscheiden
 * sich in genau einer Zahl, dem Mittelmeridian (9° gegen 15°); die Reihe,
 * das Ellipsoid, der Maßstab und der falsche Ostwert sind dieselben. Eine
 * zweite Datei mit denselben vierzig Zeilen und einer anderen Konstante
 * wäre die Kopie, die irgendwann auseinanderläuft — deshalb steht die
 * Rechnung hier einmal, mit der Zone als Parameter, und `utm32.ts` ist
 * seitdem ein dünner Aufruf, damit Kölns Datenbau und seine Tests
 * unverändert bleiben.
 *
 * Was hier steht, ist die Krüger-Reihe in der Form, die Karney 2011
 * aufgeschrieben hat („Transverse Mercator with an accuracy of a few
 * nanometers"): vom Gitterpunkt über die konforme Breite zur geodätischen.
 * Vier Reihenglieder genügen für Millimeter, solange ein Punkt nur wenige
 * Grad neben dem Mittelmeridian liegt — Köln 2°, Schwerin 3,6°, Berlin 1,6°.
 * Belegt ist die Rechnung in `test/utm32.test.ts` (Zone 32, 20 amtliche
 * Punktpaare des Landes NRW) und `test/utm.test.ts` (Zone 33, Punktpaare
 * aus Berlins und Schwerins Diensten).
 *
 * Ellipsoid ist **GRS 80**, nicht WGS 84: EPSG:25832 und 25833 sind
 * ETRS89/UTM, und ETRS89 rechnet auf GRS 80. Der Unterschied der Abplattung
 * liegt in der elften Nachkommastelle; er steht hier trotzdem richtig, weil
 * eine Konstante, die man „ungefähr" wählt, später niemand mehr nachprüft.
 * Der Datumsübergang ETRS89 → WGS 84 wird bewusst nicht gerechnet: wenige
 * Zentimeter, weit unter der Genauigkeit einer Handy-Ortung.
 *
 * Ohne Fremdbibliothek, aus demselben Grund wie zuvor: `proj4` wiegt rund
 * 200 KB für 4.000 Koordinatensysteme, gebraucht werden zwei — und diese
 * Zeilen lassen sich gegen amtliche Punktpaare messen, eine Bibliothek
 * müsste man glauben. In `ingest` und nicht in `core`, weil umprojiziert
 * einmal beim Bauen wird; im Browser kommen ausschließlich Grad an.
 */

/** Die Zonen, für die es amtliche Punktpaare in den Tests gibt. */
export type UtmZone = 32 | 33

/** Große Halbachse des GRS-80-Ellipsoids, in Metern. */
const A_AXIS = 6378137.0

/** Abplattung des GRS-80-Ellipsoids. */
const FLATTENING = 1 / 298.257222101

/** Maßstabsfaktor am Mittelmeridian, für UTM festgelegt. */
const SCALE = 0.9996

/** Falscher Ostwert, damit in der Zone keine negativen Zahlen auftreten. */
const FALSE_EASTING = 500000.0

/** Dritte Abplattung — der Reihenparameter. */
const N = FLATTENING / (2 - FLATTENING)

/** Meridianbogen-Radius, gemittelt. */
const RECTIFYING_RADIUS = (A_AXIS / (1 + N)) * (1 + N ** 2 / 4 + N ** 4 / 64)

/**
 * Beta — vom Gitterpunkt zur konformen Breite.
 *
 * Vier Glieder. Das fünfte trüge auf deutscher Breite noch etwa einen
 * Nanometer bei und wäre damit kleiner als die Rechengenauigkeit von
 * `Number`.
 */
const BETA: readonly number[] = [
  N / 2 - (2 * N ** 2) / 3 + (37 * N ** 3) / 96 - N ** 4 / 360,
  N ** 2 / 48 + N ** 3 / 15 - (437 * N ** 4) / 1440,
  (17 * N ** 3) / 480 - (37 * N ** 4) / 840,
  (4397 * N ** 4) / 161280,
]

/** Delta — von der konformen zur geodätischen Breite. */
const DELTA: readonly number[] = [
  2 * N - (2 * N ** 2) / 3 - 2 * N ** 3 + (116 * N ** 4) / 45,
  (7 * N ** 2) / 3 - (8 * N ** 3) / 5 - (227 * N ** 4) / 45,
  (56 * N ** 3) / 15 - (136 * N ** 4) / 35,
  (4279 * N ** 4) / 630,
]

const DEG = 180 / Math.PI

/**
 * Der Mittelmeridian einer UTM-Zone, in Grad: Zone 32 → 9°, Zone 33 → 15°.
 *
 * Die Formel gilt für alle sechzig Zonen; der Typ lässt trotzdem nur die
 * beiden zu, für die es Punktpaare in den Tests gibt. Eine Zone, gegen die
 * nie gemessen wurde, ist eine Behauptung — und ein falscher Mittelmeridian
 * verschiebt eine Stadt um 660 km, ohne dass eine einzige Zahl unplausibel
 * aussähe.
 */
function centralMeridianRad(zone: UtmZone): number {
  return (zone * 6 - 183) / DEG
}

/**
 * Plausibilitätsgrenzen für einen Ostwert in einer UTM-Zone.
 *
 * Sie fangen zwei Verwechslungen, und beide sind hier realistisch.
 *
 * Die erste: **schon in Grad.** Wer eine bereits umgerechnete Liste ein
 * zweites Mal durch diese Funktion schickt, bekäme sonst Zahlen zurück, die
 * aussehen wie Koordinaten und keine sind.
 *
 * Die zweite: **vertauschte Achsen.** Kölns Dienst dreht die Reihenfolge nach
 * dem angefragten System — mit `srsName=urn:ogc:def:crs:EPSG::4326` schreibt
 * er Nord vor Ost, in UTM-Metern. Käme das hier an, stünde ein Nordwert von
 * rund 5,64 Millionen im Ostwert und läge damit weit über 900.000. Der Abbruch
 * ist kostenlos und die einzige Prüfung, die diesen Fall überhaupt bemerkt:
 * Beide Zahlen sind für sich genommen plausible UTM-Werte.
 */
const MIN_EASTING = 100_000
const MAX_EASTING = 900_000

/** Vom Äquator bis zum Nordpol, grob — die Zone reicht nicht weiter. */
const MIN_NORTHING = 0
const MAX_NORTHING = 10_000_000

export class UtmError extends Error {
  constructor(zone: number, easting: number, northing: number, reason: string) {
    super(`UTM ${zone}N ${easting}/${northing} — ${reason}`)
    this.name = 'UtmError'
  }
}

/**
 * Ein Punkt in EPSG:258xx nach `[Länge, Breite]` in Grad.
 *
 * Die Rückgabe ist GeoJSON-Reihenfolge — Länge zuerst —, weil der Datenbau
 * die Zahlen genau so weiterreicht. Die Eingabe ist Ost, dann Nord: die
 * Reihenfolge, in der Kölns und Schwerins Dienste sie schreiben.
 */
export function utmToWgs84(easting: number, northing: number, zone: UtmZone): [number, number] {
  if (!Number.isFinite(easting) || !Number.isFinite(northing)) {
    throw new UtmError(zone, easting, northing, 'keine Zahlen')
  }
  if (easting < MIN_EASTING || easting > MAX_EASTING) {
    throw new UtmError(zone, easting, northing, 'Ostwert liegt außerhalb der Zone — schon in Grad?')
  }
  if (northing < MIN_NORTHING || northing > MAX_NORTHING) {
    throw new UtmError(zone, easting, northing, 'Nordwert liegt außerhalb der Zone — schon in Grad?')
  }

  const xi = northing / (SCALE * RECTIFYING_RADIUS)
  const eta = (easting - FALSE_EASTING) / (SCALE * RECTIFYING_RADIUS)

  let xiPrime = xi
  let etaPrime = eta
  for (let j = 1; j <= BETA.length; j += 1) {
    const beta = BETA[j - 1] as number
    xiPrime -= beta * Math.sin(2 * j * xi) * Math.cosh(2 * j * eta)
    etaPrime -= beta * Math.cos(2 * j * xi) * Math.sinh(2 * j * eta)
  }

  // Konforme Breite: die Hilfsgröße, auf der die Reihe beruht.
  const chi = Math.asin(Math.sin(xiPrime) / Math.cosh(etaPrime))
  const lambda = centralMeridianRad(zone) + Math.atan2(Math.sinh(etaPrime), Math.cos(xiPrime))

  let phi = chi
  for (let j = 1; j <= DELTA.length; j += 1) {
    phi += (DELTA[j - 1] as number) * Math.sin(2 * j * chi)
  }

  return [lambda * DEG, phi * DEG]
}

/**
 * Rechnet eine verschachtelte GeoJSON-Koordinatenliste um.
 *
 * Rekursiv wie `toGeoJsonAxes` in `sources.ts` und aus demselben Grund:
 * Dieselbe Funktion muss Punkte, Linien, Polygone und Multipolygone treffen.
 * Eine dritte Zahl (Höhe) bliebe unverändert stehen — sie ist in Metern und
 * in beiden Systemen dieselbe.
 */
export function utmCoordinatesToWgs84(coordinates: unknown, zone: UtmZone): unknown {
  if (!Array.isArray(coordinates)) return coordinates
  if (typeof coordinates[0] === 'number' && typeof coordinates[1] === 'number') {
    const [easting, northing, ...rest] = coordinates as number[]
    const [lon, lat] = utmToWgs84(easting as number, northing as number, zone)
    return [lon, lat, ...rest]
  }
  return coordinates.map((node) => utmCoordinatesToWgs84(node, zone))
}
