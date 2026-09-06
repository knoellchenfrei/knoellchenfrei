import type { LayerSpecification, StyleSpecification } from 'maplibre-gl'

/**
 * Der Kartenhintergrund — in drei Ausbaustufen.
 *
 * 1. **Ohne Kacheln.** Im veröffentlichten Artifact blockiert die
 *    Sicherheitsrichtlinie jede Bildanfrage an fremde Adressen. Es gibt dort
 *    keinen Hintergrund, und der Stil ist absichtlich so gebaut, dass die
 *    Zonen auch auf der nackten Hintergrundfarbe lesbar bleiben.
 * 2. **OpenStreetMap-Rasterkacheln.** Ohne Schlüssel, ohne Vertrag, gut genug
 *    zum Zeigen. Für den Dauerbetrieb aber nicht gedeckt: Die Kachelrichtlinie
 *    der OSM Foundation schließt ausgelieferte Anwendungen aus, und die
 *    IP-Adressen aller Nutzer gehen an einen Dritten.
 * 3. **Eigene Vektorkacheln aus einem PMTiles-Archiv.** Ein Objekt in R2, kein
 *    laufender Kachelserver; der Browser holt per Range-Request genau die
 *    Bytes, die er braucht. Derselbe Weg, den FreiFahren geht.
 *
 * Welche Stufe gilt, entscheidet `VITE_TILES_URL` zur Bauzeit. Ohne den Wert
 * bleibt alles wie bisher — die Umstellung ist damit eine Einstellung, kein
 * Umbau.
 */

/**
 * Zur Bauzeit gesetzt, z. B. `https://tiles.knoellchenfrei.de/berlin.pmtiles`.
 *
 * Bewusst ohne Hilfsfunktion: Vite ersetzt den Ausdruck durch eine Konstante,
 * und nur dann kann der Bündler den ganzen Vektor-Zweig samt PMTiles-Leser
 * herauswerfen, wenn keine eigenen Kacheln eingerichtet sind.
 */
const RAW_TILES_URL = import.meta.env.VITE_TILES_URL
export const TILES_URL: string | undefined =
  typeof RAW_TILES_URL === 'string' && RAW_TILES_URL.trim().length > 0
    ? RAW_TILES_URL.trim()
    : undefined

/**
 * Die Ebenen des Vektor-Themes — nachgereicht, nicht importiert.
 *
 * `protomaps-themes-base` wiegt rund 40 kB. Statisch eingebunden läge es in
 * jedem Bündel, auch in dem der Artifact-Fassung, die gar keine Kacheln laden
 * darf. `main.tsx` lädt es nach und reicht es hier herein, bevor die erste
 * Karte entsteht.
 */
let vectorLayers: LayerSpecification[] | null = null

export function installVectorBasemap(layers: LayerSpecification[]): void {
  vectorLayers = layers
}

const BACKGROUND = {
  id: 'background',
  type: 'background' as const,
  paint: { 'background-color': '#0f1216' },
}

/**
 * Aus dem Archiv wird ein vollständiger Stil.
 *
 * Die Ebenen kommen aus `protomaps-themes-base` — dieselbe Grundlage, auf der
 * die Protomaps-Karten aufbauen. Sie selbst zu schreiben hieße, 56 Ebenen für
 * Wasser, Wege, Grün und Beschriftung von Hand zu pflegen; die Zeit gehört in
 * die Parkzonen.
 *
 * `dark` passt zur restlichen Oberfläche, `de` beschriftet auf Deutsch.
 */
function vectorStyle(url: string): StyleSpecification {
  return {
    version: 8,
    // Ohne Glyphen bleibt jede Beschriftung leer — der häufigste Fehler beim
    // Umstieg von Raster auf Vektor.
    glyphs: 'https://protomaps.github.io/basemaps-assets/fonts/{fontstack}/{range}.pbf',
    sprite: 'https://protomaps.github.io/basemaps-assets/sprites/v4/dark',
    sources: {
      protomaps: {
        type: 'vector',
        // Das Präfix schaltet MapLibre auf den PMTiles-Leser um; angemeldet
        // wird er in main.tsx, bevor die erste Karte entsteht.
        url: `pmtiles://${url}`,
        attribution: '© OpenStreetMap-Mitwirkende, © Protomaps',
      },
    },
    layers: vectorLayers ?? [],
  }
}

export function baseStyle(withTiles: boolean): StyleSpecification {
  if (!withTiles) {
    // Keine fremden Anfragen erlaubt: Die später ergänzten Bezirksgrenzen
    // tragen dann die geografische Orientierung.
    return { version: 8, sources: {}, layers: [BACKGROUND] }
  }

  // Beides oder keins: Ohne die nachgeladenen Ebenen ergäbe der Vektorstil eine
  // leere Karte, und dann sind die Rasterkacheln das bessere Ergebnis.
  if (TILES_URL !== undefined && vectorLayers !== null) return vectorStyle(TILES_URL)

  return {
    version: 8,
    sources: {
      osm: {
        type: 'raster',
        tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
        tileSize: 256,
        maxzoom: 19,
        attribution: '© OpenStreetMap-Mitwirkende',
      },
    },
    layers: [
      BACKGROUND,
      {
        id: 'osm',
        type: 'raster',
        source: 'osm',
        paint: { 'raster-opacity': 0.5, 'raster-saturation': -0.75, 'raster-brightness-max': 0.8 },
      },
    ],
  }
}

export const BERLIN_CENTER: [number, number] = [13.404954, 52.520008]
