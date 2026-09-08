/**
 * Packs the built PWA into a single self-contained HTML file for publishing as
 * a Claude Artifact.
 *
 * An artifact runs under a CSP that blocks every external request: no tile
 * server, no data fetch, no CDN beyond a short allowlist. So the bundle, the
 * stylesheet and all four data files are inlined, and the app falls back to
 * district outlines instead of a basemap (see data-source.ts).
 *
 * The wrapper adds no doctype, html, head or body: the artifact host supplies
 * those and expects page content directly.
 */

import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { CITIES } from '@knoellchenfrei/core'

// Die beiden Wächter stehen in einer eigenen Datei, damit sie ohne einen
// gebauten `dist` geprüft werden können — siehe `artifact-guards.ts`.
import { assertSelfContained, safeJson } from './artifact-guards.js'

const DIST = process.env.DIST_DIR ?? join(process.cwd(), '../../apps/web/dist')
const OUT = process.env.ARTIFACT_OUT ?? join(process.cwd(), '../../apps/web/artifact.html')

const html = readFileSync(join(DIST, 'index.html'), 'utf8')

/** Asset paths Vite wrote into index.html, in document order. */
function assets(pattern: RegExp): string[] {
  return [...html.matchAll(pattern)].map((match) => (match[1] as string).replace(/^\.?\//, ''))
}

const scripts = assets(/<script[^>]+src="([^"]+)"/g)
const styles = assets(/<link[^>]+rel="stylesheet"[^>]+href="([^"]+)"/g)

if (scripts.length === 0) throw new Error('no script tags found in built index.html')

/**
 * Alle Städte, die im Bündel liegen, kommen mit ins Artifact.
 *
 * Nicht nur die voreingestellte: Das Artifact lädt nichts nach — seine
 * Sicherheitsrichtlinie blockiert jede fremde Anfrage —, und ein Umschalter,
 * der auf eine Stadt zeigt, die nicht eingebettet ist, wäre ein Knopf, der
 * die Seite kaputt macht. `availableCities()` im Web liest genau diese
 * Schlüssel und blendet den Rest aus.
 */
const data = Object.fromEntries(
  CITIES.map((city) => [
    city.key,
    {
      zones: JSON.parse(readFileSync(join(DIST, `data/${city.key}/zones.geojson`), 'utf8')),
      poi: JSON.parse(readFileSync(join(DIST, `data/${city.key}/poi.geojson`), 'utf8')),
      districts: JSON.parse(readFileSync(join(DIST, `data/${city.key}/districts.geojson`), 'utf8')),
      umweltzone: JSON.parse(readFileSync(join(DIST, `data/${city.key}/umweltzone.geojson`), 'utf8')),
      meta: JSON.parse(readFileSync(join(DIST, `data/${city.key}/meta.json`), 'utf8')),
    },
  ])
)

const read = (name: string): string => readFileSync(join(DIST, name), 'utf8')

const bundles = scripts.map((name) => {
  const source = read(name)
  assertSelfContained(name, source)
  return `<script type="module">\n${source}\n</script>`
})

/**
 * MapLibres Worker, mitgeliefert statt nachgeladen.
 *
 * MapLibre 6 startet zur Laufzeit einen Worker aus einer eigenen Datei. Im
 * Artifact gibt es keine zweite Datei — und ohne Worker parst MapLibre weder
 * Vektorkacheln noch GeoJSON, die Karte bliebe also **leer**, obwohl alle
 * Zonen eingebettet sind. Genau das war jahrelang der Fall, ohne dass es
 * jemandem auffiel: Die Karte zeigte Umrisse aus dem Rückfall und sonst
 * nichts, und im Log stand kein Wort.
 *
 * Deshalb wandert die gebündelte Worker-Datei als Zeichenkette mit hinein;
 * `main.tsx` macht daraus ein Blob und übergibt es an `setWorkerUrl`. Der
 * Umweg über den Text ist nötig, weil ein Blob mit einem *relativen* Import
 * wieder ins Leere zeigte — Vite bündelt den Worker deshalb mit `?worker&url`
 * vollständig, samt `maplibre-gl-shared.mjs`.
 */
function maplibreWorkerSource(): string | null {
  const treffer = readdirSync(join(DIST, 'assets')).filter((name) =>
    /^maplibre-gl-worker-.*\.js$/.test(name),
  )
  if (treffer.length === 0) return null
  if (treffer.length > 1) {
    throw new Error(`Mehr als ein MapLibre-Worker in dist/assets: ${treffer.join(', ')}`)
  }
  return read(join('assets', treffer[0] as string))
}

const workerSource = maplibreWorkerSource()
if (workerSource === null) {
  // Laut, nicht still: Ohne diese Datei sähe das Artifact aus wie immer — eine
  // Karte, auf der nichts steht — und niemand käme auf den Worker.
  throw new Error(
    'Kein maplibre-gl-worker-*.js in dist/assets. Ohne ihn zeichnet die Karte im ' +
      'Artifact nichts; siehe setWorkerUrl in apps/web/src/main.tsx.',
  )
}

const parts = [
  '<title>knoellchenfrei</title>',
  ...styles.map((name) => `<style>\n${read(name)}\n</style>`),
  '<div id="root"></div>',
  `<script>window.__PARKINGZONE_DATA__ = ${safeJson(data)};</script>`,
  `<script>window.__MAPLIBRE_WORKER__ = ${safeJson(workerSource)};</script>`,
  ...bundles,
]

const output = parts.join('\n')
writeFileSync(OUT, output)

console.log(`artifact.html: ${(output.length / 1024 / 1024).toFixed(2)} MB`)
console.log(`  ${scripts.length} script(s), ${styles.length} stylesheet(s)`)
for (const city of CITIES) {
  const bundled = data[city.key] as {
    zones: { features: unknown[] }
    poi: { features: unknown[] }
    districts: { features: unknown[] }
  }
  console.log(
    // „Flächen", nicht „Zonen": Hamburg liefert 145 Flächen für 63 Gebiete,
    // weil die Quelle sie je Stadtteil schneidet. Genau diese Verwechslung
    // steckte hinter dem Kartenfehler vom 8. September — sie gehört auch aus
    // der Bau-Ausgabe heraus, sonst lernt man sie hier wieder.
    `  ${city.name}: ${bundled.zones.features.length} Flächen, ` +
      `${bundled.poi.features.length} POI, ${bundled.districts.features.length} Ortsteile`
  )
}
