/**
 * Erzeugt die Bilder für die Installations-Karte des Browsers.
 *
 * Ohne `screenshots` im Manifest zeigt Chrome beim Ablegen nur einen schmalen
 * Streifen mit Symbol und Namen; mit ihnen die ausführliche Karte, in der man
 * sieht, was man sich da installiert. Zwei Formate sind nötig, weil Chrome
 * `narrow` und `wide` getrennt auswählt und ein fehlendes Format die
 * ausführliche Karte auf dem jeweiligen Gerät wieder abschaltet.
 *
 * Aufnahme vom gebauten Stand, nicht vom Entwicklungsserver — sonst zeigt das
 * Bild eine Version, die so nie ausgeliefert wurde:
 *   pnpm --filter @knoellchenfrei/web build && node scripts/make-screenshots.mjs
 */
import { createReadStream } from 'node:fs'
import { mkdir, stat, writeFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import { dirname, extname, join, normalize } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from '@playwright/test'

const here = dirname(fileURLToPath(import.meta.url))
const dist = join(here, '..', 'dist')
const out = join(here, '..', 'public', 'screenshots')

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.geojson': 'application/geo+json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webmanifest': 'application/manifest+json',
}

const server = createServer((request, response) => {
  const path = new URL(request.url ?? '/', 'http://localhost').pathname
  // `normalize` allein reicht nicht: Ein führendes `..` bleibt stehen.
  const relative = normalize(path).replace(/^(\.\.[/\\])+/, '')
  const file = join(dist, relative === '/' ? 'index.html' : relative)
  stat(file)
    .then((info) => {
      if (!info.isFile()) throw new Error('not a file')
      response.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' })
      createReadStream(file).pipe(response)
    })
    .catch(() => {
      response.writeHead(404).end('not found')
    })
})

await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
const { port } = server.address()
const base = `http://127.0.0.1:${port}/`

const SHOTS = [
  { file: 'handy.png', width: 390, height: 844 },
  { file: 'desktop.png', width: 1280, height: 800 },
]

const executablePath = process.env.PLAYWRIGHT_CHROMIUM
const browser = await chromium.launch(executablePath !== undefined ? { executablePath } : {})
try {
  await mkdir(out, { recursive: true })
  for (const shot of SHOTS) {
    const context = await browser.newContext({
      viewport: { width: shot.width, height: shot.height },
      deviceScaleFactor: 1,
      locale: 'de-DE',
      timezoneId: 'Europe/Berlin',
    })
    // Feste Uhrzeit, aus demselben Grund wie in `make-docs-images.mjs`:
    // Sonst zeigt das Bild, was zufaellig gerade gilt. Die Aufnahme vom
    // 9. September um 00:08 hätte „0 von 103 kassieren" gezeigt — die App in
    // ihrem seltensten Zustand. Dienstag 10:30 Berliner Zeit kassiert die
    // gesamte Zonenfläche.
    await context.clock.setFixedTime(new Date('2026-09-08T08:30:00Z'))
    const page = await context.newPage()
    await page.goto(base)
    // Die Herkunftszeile stammt aus meta.json und erscheint erst, wenn die
    // Daten geparst sind — dasselbe Signal, auf das die End-to-End-Tests warten.
    await page.waitForSelector('.provenance', { state: 'attached', timeout: 45_000 })
    // Der Standort-Vordialog liegt über der Karte und gehört nicht ins Bild.
    const later = page.locator('.prompt').getByRole('button', { name: 'Später' })
    if ((await later.count()) > 0) await later.click()
    await page.waitForTimeout(1500)
    const buffer = await page.screenshot({ type: 'png' })
    await writeFile(join(out, shot.file), buffer)
    console.log(`${shot.file}  ${shot.width}×${shot.height}  ${buffer.length} B`)
    await context.close()
  }
} finally {
  await browser.close()
  server.close()
}
