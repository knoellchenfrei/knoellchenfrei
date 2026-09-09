/**
 * UTM-Zone 32 Nord (EPSG:25832) nach WGS 84 — die einzige Umprojektion des
 * Projekts.
 *
 * ## Warum sie überhaupt existiert
 *
 * Vier der fünf Städte liefern Grad, sobald man `srsName` setzt. Kölns WFS
 * **ignoriert den Parameter** — und zwar nicht stillschweigend, sondern
 * hinterhältig: Am 8. September 2026 gemessen, an
 * `ms:bewohnerparkgebiete_zonen`,
 * <https://geoportal.stadt-koeln.de/wss/service/bewohnerparken_wfs/guest>:
 *
 * | Anfrage | Antwort |
 * | --- | --- |
 * | ohne `srsName`, GeoJSON | `[366433.216, 5638278.57]` |
 * | `srsName=EPSG:4326`, GeoJSON | **byteweise dieselbe Datei** |
 * | `srsName=urn:ogc:def:crs:EPSG::4326`, GeoJSON | **byteweise dieselbe Datei** |
 * | `srsName=urn:ogc:def:crs:EPSG::4326`, GML | `srsName="urn:ogc:def:crs:EPSG::4326"` und darin `5638278.570000 366433.216000` |
 * | `srsName=urn:ogc:def:crs:EPSG::3857`, GML | `srsName="…::3857"` und darin `366433.216000 5638278.570000` |
 *
 * Der Dienst **dreht die Achsen** nach der Reihenfolge des angeforderten
 * Systems und **schreibt dessen Namen** an die Geometrie — er rechnet nur
 * nicht um. Ein Leser, der dem `srsName` glaubt, legt Köln bei 5.638.278° Nord
 * ab; die Karte sähe dabei nur leer aus. Frankfurts und Münchens stiller
 * UTM-Rückfall war die Vorstufe davon, `assertDegrees` die Antwort darauf.
 * Hier reicht `assertDegrees` nicht, weil es gar keine Anfrage gibt, die Grad
 * liefert: Es muss gerechnet werden.
 *
 * ## Warum ohne Fremdbibliothek
 *
 * `proj4` wiegt rund 200 KB und kann 4.000 Koordinatensysteme; gebraucht wird
 * genau eines, und die Reihenentwicklung dafür passt in vierzig Zeilen. Der
 * Ausschlag gibt aber nicht die Größe, sondern die Prüfbarkeit: Eine
 * Bibliothek müsste man glauben, diese Zeilen lassen sich gegen amtliche
 * Punktpaare messen — und genau das tut `utm32.check.ts` an 4.508 Stützpunkten
 * der Kölner Stadtgrenze aus dem WFS des Landes Nordrhein-Westfalen.
 * Größte Abweichung dort: **0,7 Mikrometer**.
 *
 * ## Warum in `ingest` und nicht in `core`
 *
 * `packages/core` bleibt frei von Laufzeit-Abhängigkeiten *und* von allem, was
 * nur der Datenbau braucht. Umprojiziert wird einmal beim Bauen; im Browser
 * kommen ausschließlich Grad an. Eine Trigonometrie-Reihe in `core` wäre
 * Ballast in jedem Bündel.
 *
 * ## Das Verfahren
 *
 * Die Krüger-Reihe in der Form, die Karney 2011 aufgeschrieben hat
 * („Transverse Mercator with an accuracy of a few nanometers"): vom
 * Gitterpunkt über die konforme Breite zur geodätischen. Vier Reihenglieder
 * genügen für Millimeter, und Köln liegt mit 6,8°–7,2° nur zwei Grad neben dem
 * Mittelmeridian — dort ist die Reihe am genauesten.
 *
 * Ellipsoid ist **GRS 80**, nicht WGS 84: EPSG:25832 ist ETRS89/UTM 32N, und
 * ETRS89 rechnet auf GRS 80. Der Unterschied der Abplattung liegt in der
 * elften Nachkommastelle und macht auf Kölner Breite deutlich weniger als
 * einen Millimeter aus — er steht hier trotzdem richtig, weil eine Konstante,
 * die man „ungefähr" wählt, später niemand mehr nachprüft. Der Datumsübergang
 * ETRS89 → WGS 84 wird bewusst **nicht** gerechnet: Er beträgt in Deutschland
 * wenige Zentimeter pro Jahrzehnt Kontinentaldrift und liegt weit unter der
 * Genauigkeit, mit der ein Handy seinen Standort kennt.
 */

/** Große Halbachse des GRS-80-Ellipsoids, in Metern. */
const A_AXIS = 6378137.0

/** Abplattung des GRS-80-Ellipsoids. */
const FLATTENING = 1 / 298.257222101

/** Maßstabsfaktor am Mittelmeridian, für UTM festgelegt. */
const SCALE = 0.9996

/** Falscher Ostwert, damit in der Zone keine negativen Zahlen auftreten. */
const FALSE_EASTING = 500000.0

/** Mittelmeridian der Zone 32, in Grad. */
const CENTRAL_MERIDIAN = 9.0

/** Dritte Abplattung — der Reihenparameter. */
const N = FLATTENING / (2 - FLATTENING)

/** Meridianbogen-Radius, gemittelt. */
const RECTIFYING_RADIUS = (A_AXIS / (1 + N)) * (1 + N ** 2 / 4 + N ** 4 / 64)

/**
 * Beta — vom Gitterpunkt zur konformen Breite.
 *
 * Vier Glieder. Das fünfte trüge auf Kölner Breite noch etwa einen
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
const CENTRAL_MERIDIAN_RAD = CENTRAL_MERIDIAN / DEG

/**
 * Plausibilitätsgrenzen für einen Ostwert in Zone 32.
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

export class Utm32Error extends Error {
  constructor(easting: number, northing: number, reason: string) {
    super(`UTM 32N ${easting}/${northing} — ${reason}`)
    this.name = 'Utm32Error'
  }
}

/**
 * Ein Punkt in EPSG:25832 nach `[Länge, Breite]` in Grad.
 *
 * Die Rückgabe ist GeoJSON-Reihenfolge — Länge zuerst —, weil der Datenbau
 * die Zahlen genau so weiterreicht. Die Eingabe ist Ost, dann Nord: die
 * Reihenfolge, in der Kölns Dienst sie schreibt.
 */
export function utm32ToWgs84(easting: number, northing: number): [number, number] {
  if (!Number.isFinite(easting) || !Number.isFinite(northing)) {
    throw new Utm32Error(easting, northing, 'keine Zahlen')
  }
  if (easting < MIN_EASTING || easting > MAX_EASTING) {
    throw new Utm32Error(easting, northing, 'Ostwert liegt außerhalb der Zone — schon in Grad?')
  }
  if (northing < MIN_NORTHING || northing > MAX_NORTHING) {
    throw new Utm32Error(easting, northing, 'Nordwert liegt außerhalb der Zone — schon in Grad?')
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
  const lambda = CENTRAL_MERIDIAN_RAD + Math.atan2(Math.sinh(etaPrime), Math.cos(xiPrime))

  let phi = chi
  for (let j = 1; j <= DELTA.length; j += 1) {
    phi += (DELTA[j - 1] as number) * Math.sin(2 * j * chi)
  }

  return [lambda * DEG, phi * DEG]
}

/**
 * Dreht eine verschachtelte GeoJSON-Koordinatenliste an Ort und Stelle um.
 *
 * Rekursiv wie `toGeoJsonAxes` in `sources.ts` und aus demselben Grund:
 * Dieselbe Funktion muss Punkte, Linien, Polygone und Multipolygone treffen.
 * Eine dritte Zahl (Höhe) führt Kölns Dienst nicht; käme sie, bliebe sie
 * unverändert stehen — sie ist in Metern und in beiden Systemen dieselbe.
 */
export function utm32CoordinatesToWgs84(coordinates: unknown): unknown {
  if (!Array.isArray(coordinates)) return coordinates
  if (typeof coordinates[0] === 'number' && typeof coordinates[1] === 'number') {
    const [easting, northing, ...rest] = coordinates as number[]
    const [lon, lat] = utm32ToWgs84(easting as number, northing as number)
    return [lon, lat, ...rest]
  }
  return coordinates.map(utm32CoordinatesToWgs84)
}
