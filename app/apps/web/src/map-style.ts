import type { LayerSpecification, StyleSpecification } from 'maplibre-gl'

import { CITY } from './city.js'

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
 * Zur Bauzeit gesetzt — das **Verzeichnis** mit den Archiven, nicht eine Datei:
 * `https://tiles.knoellchenfrei.de/v20260904/`.
 *
 * Bis zum 7. September zeigte die Variable auf `…/berlin.pmtiles`, und dieser
 * eine Pfad landete unabhängig von der geladenen Stadt im Stil. In Hamburg,
 * Frankfurt und München lag der Kartenausschnitt damit außerhalb des Archivs:
 * Der Hintergrund blieb leer, und zwar so, dass es nach „noch nicht geladen"
 * aussah statt nach einem Fehler. Ohne die Variable wäre es sogar richtig
 * gewesen, weil die App dann auf Rasterkacheln zurückfällt — eine gesetzte
 * Variable war schlechter als keine.
 *
 * Ein Wert, der noch auf eine Datei zeigt, hält jetzt den **Build** an; die
 * Prüfung steht in `vite.config.ts`. Ein stiller Rückfall auf Berlin wäre die
 * schlechteste Antwort, aus demselben Grund wie bei `cityByKey`.
 *
 * Bewusst ohne Hilfsfunktion beim Lesen: Vite ersetzt den Ausdruck durch eine
 * Konstante, und nur dann kann der Bündler den ganzen Vektor-Zweig samt
 * PMTiles-Leser herauswerfen, wenn keine eigenen Kacheln eingerichtet sind.
 */
const RAW_TILES_URL = import.meta.env.VITE_TILES_URL
export const TILES_BASE: string | undefined =
  typeof RAW_TILES_URL === 'string' && RAW_TILES_URL.trim().length > 0
    ? RAW_TILES_URL.trim().replace(/\/*$/, '/')
    : undefined

/** Das Archiv einer Stadt: `<verzeichnis>/<schlüssel>.pmtiles`. */
export function tilesUrlFor(cityKey: string): string | undefined {
  return TILES_BASE === undefined ? undefined : `${TILES_BASE}${cityKey}.pmtiles`
}

/**
 * Die Ebenen des Vektor-Themes — nachgereicht, nicht importiert.
 *
 * `@protomaps/basemaps` wiegt rund 40 kB. Statisch eingebunden läge es in
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
 * Die Ebenen kommen aus `@protomaps/basemaps` — dieselbe Grundlage, auf der
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
    // Kein `sprite`. FreiFahren hat auch keins — nachgesehen in ihrem
    // ausgelieferten Stil (`tiles.freifahren.org/styles/berlin.json`, 89
    // Ebenen, kein Sprite). Vier der 71 Ebenen tragen ein `icon-image` und
    // zeichnen ihr Symbol dann nicht; das ist der Preis, und er ist klein
    // gegen eine weitere Adresse, an die die IP jedes Betrachters geht.
    //
    // Die Schriften kommen noch von protomaps.github.io. Das ist der letzte
    // fremde Abruf der Karte und steht als offener Punkt in `docs/todo.md`:
    // FreiFahren liefert sie vom eigenen Server aus, und der Weg dahin ist
    // derselbe wie bei den Kacheln — eine Datei mehr in R2.
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
  const archiv = tilesUrlFor(CITY.key)
  if (archiv !== undefined && vectorLayers !== null) return vectorStyle(archiv)

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

