/**
 * UTM-Zone 32 Nord (EPSG:25832) nach WGS 84 — Kölns Umprojektion.
 *
 * ## Warum sie überhaupt existiert
 *
 * Fast alle Städte liefern Grad, sobald man `srsName` setzt. Kölns WFS
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
 * ## Wo die Rechnung steht
 *
 * Seit dem 16. September 2026 in `utm.ts`, mit der Zone als Parameter —
 * Schwerin braucht dieselbe Reihe für Zone 33. Diese Datei ist der Aufruf
 * für Zone 32, damit `build-data-koeln.ts` und `test/utm32.test.ts` so
 * bleiben, wie sie gemessen wurden: 4.508 Stützpunkte der Kölner Stadtgrenze
 * aus dem WFS des Landes Nordrhein-Westfalen, größte Abweichung
 * **0,7 Mikrometer**. Die Begründung für Ellipsoid, Reihe und den Verzicht
 * auf `proj4` steht dort.
 */

import { UtmError, utmCoordinatesToWgs84, utmToWgs84 } from './utm.js'

/**
 * Derselbe Fehler wie in `utm.ts`, unter dem Namen, den Kölns Tests kennen.
 * Ein `instanceof Utm32Error` bleibt damit wahr.
 */
export { UtmError as Utm32Error }

/**
 * Ein Punkt in EPSG:25832 nach `[Länge, Breite]` in Grad.
 *
 * Die Rückgabe ist GeoJSON-Reihenfolge — Länge zuerst —, weil der Datenbau
 * die Zahlen genau so weiterreicht. Die Eingabe ist Ost, dann Nord: die
 * Reihenfolge, in der Kölns Dienst sie schreibt.
 */
export function utm32ToWgs84(easting: number, northing: number): [number, number] {
  return utmToWgs84(easting, northing, 32)
}

/**
 * Dreht eine verschachtelte GeoJSON-Koordinatenliste an Ort und Stelle um.
 *
 * Rekursiv wie `toGeoJsonAxes` in `sources.ts` und aus demselben Grund:
 * Dieselbe Funktion muss Punkte, Linien, Polygone und Multipolygone treffen.
 */
export function utm32CoordinatesToWgs84(coordinates: unknown): unknown {
  return utmCoordinatesToWgs84(coordinates, 32)
}
