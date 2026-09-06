import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'

/**
 * Builds the service worker from src/sw-template.js, stamping in a per-build
 * cache name and the hashed asset paths.
 *
 * The template deliberately does NOT live in public/: Vite copies that directory
 * over the output after this hook runs, which silently reverted the stamped file
 * and shipped a worker still containing the literal placeholders.
 */
function stampServiceWorker(singleBundle: boolean): Plugin {
  let outDir = join(process.cwd(), 'dist')
  return {
    name: 'stamp-service-worker',
    configResolved(config) {
      outDir = join(config.root, config.build.outDir)
    },
    closeBundle() {
      // A published artifact is one file with no origin to register a worker
      // against, and its build writes to its own directory — stamping here
      // would read the wrong index.html and overwrite the real build's worker.
      if (singleBundle) return
      const swPath = join(outDir, 'sw.js')
      const source = readFileSync(join(process.cwd(), 'src/sw-template.js'), 'utf8')
      const indexHtml = readFileSync(join(outDir, 'index.html'), 'utf8')
      const id = createHash('sha256').update(indexHtml).digest('hex').slice(0, 12)
      // Precache the hashed bundles and the data files so the very first visit
      // is enough to work offline.
      const assets = [
        ...indexHtml.matchAll(/(?:src|href)="(\.\/assets\/[^"]+)"/g),
      ].map((match) => match[1])
      const data = ['zones.geojson', 'poi.geojson', 'districts.geojson', 'umweltzone.geojson', 'meta.json']
        .map((name) => `./data/${name}`)
      const stamped = source
        .replaceAll('__BUILD_ID__', id)
        .replaceAll('__SHELL_ASSETS__', JSON.stringify([...assets, ...data]))

      // Fail the build rather than ship a worker that still contains a
      // placeholder: it would look fine and silently never update.
      if (stamped.includes('__BUILD_ID__') || stamped.includes('__SHELL_ASSETS__')) {
        throw new Error('service worker still contains an unreplaced placeholder')
      }
      writeFileSync(swPath, stamped)
    },
  }
}

/**
 * Hält die geschlossene Beta aus den Suchmaschinen heraus.
 *
 * Der Grund ist nicht Bescheidenheit: Solange das Impressum auf eine
 * Privatperson läuft, entscheidet dieser Schalter, ob diese Anschrift in Index
 * und Archiven landet. Einmal drin, bleibt sie drin. Deshalb ist der Riegel die
 * Voreinstellung und muss zum Start bewusst gelöst werden — nicht umgekehrt.
 */
function betaGuard(beta: boolean): Plugin {
  let outDir = join(process.cwd(), 'dist')
  return {
    name: 'beta-guard',
    configResolved(config) {
      outDir = join(config.root, config.build.outDir)
    },
    transformIndexHtml(html) {
      if (!beta) return html
      return html.replace(
        '</head>',
        '    <meta name="robots" content="noindex, nofollow, noarchive" />\n  </head>',
      )
    },
    closeBundle() {
      // Ein Artifact hat keine eigene Herkunft, unter der eine robots.txt
      // gälte — die Datei ginge dort ins Leere.
      if (singleBundle) return
      writeFileSync(
        join(outDir, 'robots.txt'),
        beta
          ? '# Geschlossene Beta. Bis der Trägerverein eingetragen ist, läuft das\n' +
            '# Impressum auf eine Privatperson — die gehört nicht in einen Index.\n' +
            'User-agent: *\nDisallow: /\n'
          : 'User-agent: *\nAllow: /\n',
      )
    },
  }
}

// The artifact build must produce ONE module: a published artifact runs under a
// CSP that blocks external requests, so a second chunk pulled in by an ES import
// would simply fail to load.
const singleBundle = process.env.BUILD_TARGET === 'artifact'

// Voreinstellung ist die Beta. Zum Start: PUBLIC_LAUNCH=1 pnpm build
const beta = process.env.PUBLIC_LAUNCH !== '1'

export default defineConfig({
  plugins: [react(), stampServiceWorker(singleBundle), betaGuard(beta)],
  base: './',
  define: {
    __BETA__: JSON.stringify(beta),
  },
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 1500,
    rollupOptions: {
      output: singleBundle
        ? { inlineDynamicImports: true }
        : // MapLibre is by far the largest dependency and changes rarely;
          // splitting it keeps the app chunk small enough to re-download on
          // every deploy.
          { manualChunks: { maplibre: ['maplibre-gl'] } },
    },
  },
})
