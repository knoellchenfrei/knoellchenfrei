/**
 * Nimmt die Bilder für README und Dokumentation auf.
 *
 * Von Hand aufgenommene Bilder veralten still: Sie zeigen noch die Kopfzeile
 * von vorletzter Woche, und niemandem fällt es auf, weil sie ja „ein Bild der
 * App" sind. Ein Skript macht das Nachziehen zu einem Befehl.
 *
 *   pnpm --filter @parkingzone/web build && node scripts/make-docs-images.mjs
 *
 * Ohne Zugang zu tile.openstreetmap.org fehlt die Hintergrundkarte. Das ist
 * kein Fehler des Skripts — die Zonen sind eigene Daten und zeichnen sich
 * ohnehin —, aber die Bilder sehen dann karger aus als die App in freier
 * Wildbahn.
 */
import { createReadStream } from 'node:fs'
import { mkdir, stat, writeFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import { dirname, extname, join, normalize } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from '@playwright/test'

const here = dirname(fileURLToPath(import.meta.url))
const dist = join(here, '..', 'dist')
const out = join(here, '..', '..', '..', '..', 'docs', 'images')

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
const base = `http://127.0.0.1:${server.address().port}/`

const executablePath = process.env.PLAYWRIGHT_CHROMIUM
const browser = await chromium.launch(executablePath !== undefined ? { executablePath } : {})

/** Wartet auf dasselbe Signal wie die End-to-End-Tests: die Herkunftszeile. */
async function open(size, scale) {
  const context = await browser.newContext({
    viewport: size,
    deviceScaleFactor: scale,
    locale: 'de-DE',
    timezoneId: 'Europe/Berlin',
  })
  const page = await context.newPage()
  await page.goto(base)
  await page.waitForSelector('.provenance', { state: 'attached', timeout: 45_000 })
  const later = page.locator('.prompt').getByRole('button', { name: 'Später' })
  if ((await later.count()) > 0) await later.click()
  await page.waitForTimeout(1200)
  return { context, page }
}

async function openPanel(page) {
  const body = page.locator('.sidebar__body')
  if (!(await body.isVisible())) await page.locator('.panel-toggle').click()
  await page.waitForTimeout(400)
}

/** Tippt mitten auf die Karte — dort liegt zuverlässig eine Zone. */
async function pickZone(page, size) {
  await page.mouse.click(size.width * 0.42, size.height * 0.45)
  await page.waitForTimeout(700)
}

async function shot(page, name) {
  const buffer = await page.screenshot({ type: 'png' })
  await writeFile(join(out, name), buffer)
  console.log(`${name}  ${buffer.length} B`)
}

const PHONE = { width: 390, height: 844 }
const DESKTOP = { width: 1280, height: 800 }

try {
  await mkdir(out, { recursive: true })

  {
    const { context, page } = await open(DESKTOP, 1)
    await shot(page, 'overview.png')
    await pickZone(page, DESKTOP)
    await shot(page, 'zone-detail.png')
    await context.close()
  }

  {
    const { context, page } = await open(PHONE, 3)
    await shot(page, 'mobile-start.png')

    await pickZone(page, PHONE)
    await openPanel(page)
    await shot(page, 'mobile-zone.png')

    // Der Parkplatz-Knopf braucht einen gesetzten Punkt — den hat der Klick
    // eben gesetzt.
    const park = page.getByRole('button', { name: 'Hier geparkt' })
    if ((await park.count()) > 0) {
      await park.click()
      await page.waitForTimeout(900)
    }
    await shot(page, 'mobile-timer.png')
    await context.close()
  }
} finally {
  await browser.close()
  server.close()
}
