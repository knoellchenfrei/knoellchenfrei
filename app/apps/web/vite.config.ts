import { createHash } from 'node:crypto'
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

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
    // `writeBundle` statt `closeBundle`, und die index.html aus dem Bundle
    // statt von der Platte: Unter Vite 8 (rolldown) lief `closeBundle`, bevor
    // die Dateien geschrieben waren, und der Build brach mit
    // `ENOENT … dist/index.html` ab. Das Bundle-Objekt hat den Inhalt ohnehin
    // schon — der Umweg über das Dateisystem war nie nötig. Der Rückfall auf
    // die Datei bleibt für den Fall, dass ein anderer Plugin-Lauf die
    // index.html erst danach einhängt.
    writeBundle(_options, bundle) {
      // A published artifact is one file with no origin to register a worker
      // against, and its build writes to its own directory — stamping here
      // would read the wrong index.html and overwrite the real build's worker.
      if (singleBundle) return
      const swPath = join(outDir, 'sw.js')
      const source = readFileSync(join(process.cwd(), 'src/sw-template.js'), 'utf8')
      const emitted = bundle['index.html']
      const indexHtml =
        emitted !== undefined && emitted.type === 'asset'
          ? typeof emitted.source === 'string'
            ? emitted.source
            : new TextDecoder().decode(emitted.source)
          : readFileSync(join(outDir, 'index.html'), 'utf8')
      const id = createHash('sha256').update(indexHtml).digest('hex').slice(0, 12)
      // Precache the hashed bundles and the data files so the very first visit
      // is enough to work offline.
      const assets = [
        ...indexHtml.matchAll(/(?:src|href)="(\.\/assets\/[^"]+)"/g),
      ].map((match) => match[1])
      // Die Datendateien liegen seit der zweiten Stadt unter
      // `data/<stadt>/`, nicht mehr flach unter `data/`. Die fest
      // verdrahtete Liste zeigte danach auf fünf Pfade, die es nicht gibt —
      // und weil `cache.addAll` schon an einer einzigen 404 scheitert und der
      // Worker den Fehler verschluckt, wurde daraufhin **gar nichts**
      // vorgehalten. Die App sah dabei völlig gesund aus und war nur nicht
      // mehr offlinefähig. Deshalb wird die Liste jetzt aus dem Verzeichnis
      // gelesen statt aufgeschrieben.
      const cityKey = process.env.VITE_CITY ?? 'berlin'
      const cityDir = join(process.cwd(), 'public/data', cityKey)
      const data = readdirSync(cityDir)
        .filter((name) => name.endsWith('.json') || name.endsWith('.geojson'))
        .sort()
        .map((name) => `./data/${cityKey}/${name}`)
      if (data.length === 0) {
        throw new Error(`keine Datendateien unter public/data/${cityKey}`)
      }
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

/**
 * Schreibt `_headers` für Cloudflare Pages — Sicherheits-Kopfzeilen samt CSP.
 *
 * Die App hatte keine (Audit-Punkt M-043). Sie ist zwar frei von
 * `innerHTML`-Senken und die einzige HTML-Konstruktion maskiert jeden Wert,
 * aber eine CSP ist die Grenze, die auch dann noch hält, wenn irgendwann doch
 * jemand eine Senke einbaut.
 *
 * **Erzeugt, nicht geschrieben.** Die erlaubten Ziele sind dieselben, die der
 * Build ohnehin kennt: `VITE_API_BASE` und `VITE_TILES_URL`. Eine `_headers`
 * von Hand wäre am Tag der ersten eigenen Worker-Domain falsch — und zwar so,
 * dass die App aufhört zu laden, ohne dass jemand die Ursache sieht. Dieselbe
 * Begründung wie bei der Vorratsliste des Service Workers.
 *
 * Was die Richtlinie erlaubt und warum:
 *
 * - `script-src 'self'` — der Build enthält **kein** Inline-Skript, geprüft.
 * - `worker-src 'self' blob:` — **nachgemessen, nicht angenommen.** Der erste
 *   Entwurf stand auf `blob:` allein, weil MapLibre das früher so tat. Version 6
 *   lädt den Worker als eigene Datei von der eigenen Herkunft, und der Browser
 *   meldete prompt „Creating a worker … violates … worker-src blob:".
 *   Nachtrag vom 7. September: Die Datei, die der Browser damals holen wollte,
 *   **gab es gar nicht** — die Ursache dafür, dass die Karte nie etwas
 *   zeichnete, steht in `main.tsx` bei `setWorkerUrl`. Seitdem legt Vite sie
 *   unter einem Namen mit Prüfsumme ab; `'self'` deckt beides. `blob:` bleibt
 *   stehen: MapLibre nimmt diesen Weg, sobald der Worker von fremder Herkunft
 *   käme, und der PMTiles-Teil kann ihn ebenfalls nehmen.
 * - `style-src 'unsafe-inline'` — MapLibre setzt Stile direkt an Elemente
 *   (Marker, Popups). Das ist unvermeidbar, solange die Bibliothek das tut,
 *   und deutlich weniger wert als eine Lücke bei `script-src`.
 * - `img-src data: blob:` — Symbole und Kartenkacheln entstehen zur Laufzeit.
 * - `frame-ancestors 'none'` — die App gehört in kein fremdes Fenster.
 */
function securityHeaders(singleBundle: boolean): Plugin {
  let outDir = join(process.cwd(), 'dist')
  return {
    name: 'security-headers',
    configResolved(config) {
      outDir = join(config.root, config.build.outDir)
    },
    closeBundle() {
      // Ein Artifact liegt nicht auf Cloudflare Pages; dort gilt die CSP des
      // Sandkastens, und eine `_headers` läge nur herum.
      if (singleBundle) return

      const herkunft = (wert: string | undefined): string => {
        if (wert === undefined || wert.trim() === '') return ''
        try {
          return new URL(wert).origin
        } catch {
          // Ein unbrauchbarer Wert soll den Build anhalten, nicht still eine
          // Richtlinie erzeugen, die die App aussperrt.
          throw new Error(`Unbrauchbare Adresse in der Build-Umgebung: ${wert}`)
        }
      }
      const api = herkunft(process.env.VITE_API_BASE)
      const kacheln = herkunft(process.env.VITE_TILES_URL)
      // `protomaps.github.io` stand hier bis zum 7. September für die Schriften
      // der Vektorkarte. Sie liegen jetzt im eigenen Eimer neben den Kacheln,
      // also darf die Adresse aus der Richtlinie verschwinden — eine erlaubte
      // Herkunft, die niemand mehr braucht, ist eine zu viel.
      const osm = 'https://tile.openstreetmap.org'

      const verbinden = ["'self'", api, kacheln].filter((wert) => wert !== '')
      const bilder = ["'self'", 'data:', 'blob:', osm, kacheln].filter(
        (wert) => wert !== '',
      )

      const csp = [
        "default-src 'self'",
        "base-uri 'self'",
        "object-src 'none'",
        "frame-ancestors 'none'",
        "form-action 'self'",
        "script-src 'self'",
        "worker-src 'self' blob:",
        "style-src 'self' 'unsafe-inline'",
        `img-src ${bilder.join(' ')}`,
        "font-src 'self'",
        `connect-src ${verbinden.join(' ')}`,
        "manifest-src 'self'",
      ].join('; ')

      writeFileSync(
        join(outDir, '_headers'),
        [
          '# Erzeugt von vite.config.ts — nicht von Hand ändern.',
          '/*',
          `  Content-Security-Policy: ${csp}`,
          '  X-Content-Type-Options: nosniff',
          '  Referrer-Policy: no-referrer',
          '  Cross-Origin-Opener-Policy: same-origin',
          '  Permissions-Policy: geolocation=(self), camera=(), microphone=(), payment=()',
          '',
        ].join('\n'),
      )
    },
  }
}

/**
 * Hält den Build an, wenn `VITE_TILES_URL` noch auf eine **Datei** zeigt.
 *
 * Bis zum 7. September war das die richtige Form. Seit die App vier Städte
 * kennt, ist es die falsche: Der eine Pfad landete unabhängig von der
 * geladenen Stadt im Kartenstil, und in drei von vier Städten blieb der
 * Hintergrund leer — ohne Fehlermeldung, weil eine leere Karte wie eine noch
 * ladende aussieht.
 *
 * Deshalb hier und nicht zur Laufzeit: Ein Build, der mit dem alten Wert
 * durchläuft, liefert eine App aus, die für drei Städte kaputt ist. Ein Build,
 * der anhält, kostet eine Minute.
 */
function pruefeKachelAdresse(): void {
  const wert = (process.env.VITE_TILES_URL ?? '').trim()
  if (wert === '') return
  if (/\.pmtiles$/i.test(wert)) {
    throw new Error(
      `VITE_TILES_URL zeigt auf eine Datei: ${wert}\n` +
        'Seit vier Städten muss die Variable auf das VERZEICHNIS zeigen, in dem\n' +
        'die Archive liegen — die App hängt <stadt>.pmtiles selbst an. Also z. B.\n' +
        '  https://tiles.knoellchenfrei.de/v20260904/\n' +
        'Mit dem alten Wert bliebe die Karte in drei von vier Städten leer.',
    )
  }
}

// The artifact build must produce ONE module: a published artifact runs under a
// CSP that blocks external requests, so a second chunk pulled in by an ES import
// would simply fail to load.
const singleBundle = process.env.BUILD_TARGET === 'artifact'

// Voreinstellung ist die Beta. Zum Start: PUBLIC_LAUNCH=1 pnpm build
const beta = process.env.PUBLIC_LAUNCH !== '1'

pruefeKachelAdresse()

export default defineConfig({
  plugins: [
    react(),
    stampServiceWorker(singleBundle),
    betaGuard(beta),
    securityHeaders(singleBundle),
  ],
  base: './',
  define: {
    __BETA__: JSON.stringify(beta),
  },
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 1500,
    rollupOptions: {
      // Zwei Seiten — aber **nur** im gewöhnlichen Build.
      //
      // Die Statistikseite ist ein eigener Eingang: kein React, keine Karte,
      // und das App-Bündel wächst um null Byte. Im Artifact-Build darf sie
      // nicht dabei sein, und das ist keine Geschmacksfrage:
      // `inlineDynamicImports` verträgt genau **einen** Eingang, und der
      // Artifact-Bau bräche mit „Invalid value for option
      // output.inlineDynamicImports" ab. Ausserdem hätte sie dort nichts zu
      // zeigen — ein Artifact hat keinen Server, den es fragen könnte.
      ...(singleBundle
        ? {}
        : {
            input: {
              index: resolve(import.meta.dirname, 'index.html'),
              statistik: resolve(import.meta.dirname, 'statistik/index.html'),
            },
          }),
      output: singleBundle
        ? { inlineDynamicImports: true }
        : // MapLibre is by far the largest dependency and changes rarely;
          // splitting it keeps the app chunk small enough to re-download on
          // every deploy.
          //
          // Als Funktion, nicht als Objekt: rolldown (Vite 8) ruft
          // `manualChunks` auf, statt die Objektform zu lesen, und bricht sonst
          // mit `TypeError: manualChunks is not a function` ab. Die Funktion
          // versteht auch Rollup — sie ist die Form, die beide kennen.
          {
            manualChunks: (id: string) =>
              id.includes('maplibre-gl') ? 'maplibre' : undefined,
          },
    },
  },
})
