import {
  multiPolygonContains,
  boundsOf,
  withinBounds,
  type BoundingBox,
  type PolygonRings,
  type Position,
} from '@knoellchenfrei/core'

import type { ZoneProperties } from './types.js'

export interface LoadedZone {
  /**
   * Die Kennung dieser **Fläche** auf der Karte — nicht die der Zone.
   *
   * Der Unterschied ist der Fehler, gegen den es sie gibt. Die Karte färbt
   * über `setFeatureState({ source, id })`, und `id` kam bis zum 8. September
   * aus `promoteId: 'zone'`, also aus dem Zonenschlüssel. In Hamburg tragen
   * **44 von 145 Flächen** den Schlüssel `-` — es sind die Flächen ohne
   * Bewohnerparkrecht, für die die Quelle im Feld `bwp_code` keine Nummer
   * führt —, und weitere vier Zonen kommen in mehreren Stücken mit
   * *verschiedenen* Zeiten (A103: 9–20 und 9–23 Uhr; E315 sogar mit
   * verschiedenen Beträgen).
   *
   * Alle Flächen mit demselben Schlüssel teilten sich damit **einen**
   * Zustandsplatz: Die Schleife schrieb 44-mal in denselben, der letzte
   * gewann, und alle 44 Flächen bekamen die Farbe der letzten — unabhängig von
   * ihren eigenen Zeiten. Um 21 Uhr an einem Werktag heisst das: Flächen, die
   * bis 22 Uhr kassieren, standen auf „frei", oder umgekehrt. Rund ein Drittel
   * der Hamburger Flächen konnte die falsche Farbe zeigen.
   *
   * Für Standort und Tipp ins Leere stimmte das Panel: `zoneAt` sucht
   * geometrisch und liest die Merkmale der getroffenen Fläche. **Für den Klick
   * auf eine Zonenfläche nicht** — der Handler schlug über `properties.zone`
   * nach und nahm die erste Fläche mit diesem Schlüssel. Auch er nimmt jetzt
   * diese Kennung.
   *
   * Deshalb eine laufende Nummer je Fläche statt des Zonenschlüssels. Sie ist
   * ein Zeiger auf die Kartenfläche und darf **nirgends** als fachliche
   * Kennung benutzt werden; dafür bleibt `properties.zone`.
   */
  id: number
  properties: ZoneProperties
  polygons: PolygonRings[]
  bounds: BoundingBox
}

export interface ZoneFeature {
  /** Von `loadZones` gesetzt, damit MapLibre je Fläche einen Zustand führt. */
  id?: number | string
  properties: ZoneProperties
  geometry: { type: 'Polygon' | 'MultiPolygon'; coordinates: number[][][] | number[][][][] }
}

/**
 * Liest die Flächen — und **stempelt jeder eine eindeutige Kennung auf**,
 * bevor MapLibre sie zu sehen bekommt.
 *
 * Der Stempel landet absichtlich auch im übergebenen Objekt: Genau dieses geht
 * gleich als `data` an `addSource`, und MapLibre nimmt eine `id` am Feature
 * gegenüber `promoteId` vorrangig. So sind die Kennungen auf beiden Seiten
 * dieselben, ohne dass irgendwo eine zweite Zuordnung gepflegt werden muss.
 *
 * Berlin brachte bisher als einzige Stadt eine eigene `id` mit (den
 * Zonenschlüssel); Hamburg, Frankfurt und München gar keine. Diese Funktion
 * überschreibt sie alle einheitlich — eine Kennung, die in einer Stadt etwas
 * anderes bedeutet als in der nächsten, ist keine.
 */
export function loadZones(collection: { features: ZoneFeature[] }): LoadedZone[] {
  return collection.features.map((feature, index) => {
    const polygons =
      feature.geometry.type === 'MultiPolygon'
        ? (feature.geometry.coordinates as number[][][][])
        : [feature.geometry.coordinates as number[][][]]
    // Der einzige Doppel-Cast im Anwendungscode, und er braucht eine
    // Begründung — die Regel dieses Projekts verlangt sie.
    //
    // GeoJSON schreibt Koordinaten als `number[]`, `Position` in `core` ist
    // ein Tupel `readonly [number, number]`. Ein `number[]` ist einem Tupel
    // nicht zuweisbar, also käme man ohne Cast hier nicht durch, ohne jeden
    // Punkt einzeln umzubauen — bei 103 Zonen mit Tausenden Stützpunkten je
    // Zone ist das eine Kopie des gesamten Bestands beim Laden, für nichts.
    //
    // Was der Cast behauptet: dass jede Koordinate genau zwei Zahlen hat. Das
    // ist nicht geprüft, und es muss auch nicht sein — `boundsOf` und
    // `multiPolygonContains` lesen ausschliesslich `[0]` und `[1]`. Ein Feed
    // mit einer dritten Zahl (Höhe) käme also durch und rechnete richtig; das
    // ist der Grund, warum hier keine Laufzeitprüfung steht und nicht
    // Bequemlichkeit. Die Datenbauten liefern ohnehin 2D.
    const rings = polygons as unknown as PolygonRings[]
    feature.id = index
    return { id: index, properties: feature.properties, polygons: rings, bounds: boundsOf(rings) }
  })
}

/**
 * The zone a coordinate falls in.
 *
 * Bounding boxes are checked first so the expensive ray cast runs only for the
 * handful of zones whose box the point is in — 103 zones with thousands of
 * vertices each are otherwise noticeable on every location update.
 */
export function zoneAt(zones: readonly LoadedZone[], point: Position): LoadedZone | null {
  for (const zone of zones) {
    if (!withinBounds(point, zone.bounds)) continue
    if (multiPolygonContains(zone.polygons, point)) return zone
  }
  return null
}

/**
 * A point that is actually inside the zone, for anchoring "park here" after a
 * search pick.
 *
 * The bounding-box centre was used before and is wrong for three zones: 11 and
 * 91 are L-shaped, so their box centre lies on an unmetered street, and 132
 * wraps around 133, whose territory the centre falls in. Parking from the panel
 * of zone 132 then recorded the car in zone 133. Candidates are tried from the
 * centre outwards on a grid; the first inside point nearest the centre wins.
 */
export function representativePoint(zone: LoadedZone): Position {
  const { minLon, minLat, maxLon, maxLat } = zone.bounds
  const centre: Position = [(minLon + maxLon) / 2, (minLat + maxLat) / 2]
  if (multiPolygonContains(zone.polygons, centre)) return centre

  const STEPS = 12
  let best: Position | null = null
  let bestDistance = Infinity
  for (let i = 0; i <= STEPS; i += 1) {
    for (let j = 0; j <= STEPS; j += 1) {
      const candidate: Position = [
        minLon + ((maxLon - minLon) * i) / STEPS,
        minLat + ((maxLat - minLat) * j) / STEPS,
      ]
      if (!multiPolygonContains(zone.polygons, candidate)) continue
      const distance = (candidate[0] - centre[0]) ** 2 + (candidate[1] - centre[1]) ** 2
      if (distance < bestDistance) {
        bestDistance = distance
        best = candidate
      }
    }
  }
  if (best !== null) return best
  // A sliver thinner than the grid: fall back to a vertex, which is at least on
  // the zone's edge rather than in a neighbour.
  return zone.polygons[0]?.[0]?.[0] ?? centre
}
