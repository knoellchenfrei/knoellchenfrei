/**
 * Erzeugt die Bilder, die außerhalb der App gebraucht werden: das Bild der
 * GitHub-Organisation und die Vorschaukarte, die Twitter, Mastodon, Slack und
 * GitHub selbst anzeigen, wenn jemand den Link teilt.
 *
 * Warum getrennt von `make-icons.mjs`: Das dort sind Symbole für einen
 * Homescreen — quadratisch, klein, ohne Text. Diese hier sind Bilder für
 * Verzeichnisse und Zeitleisten; sie tragen den Namen mit und haben andere
 * Seitenverhältnisse.
 *
 * **Randlos, nicht abgerundet.** `icon.svg` hat runde Ecken und außen
 * Transparenz — auf dem Homescreen richtig, denn das Betriebssystem rundet
 * selbst. GitHub rundet ebenfalls selbst; ein bereits gerundetes Bild bekommt
 * dort doppelt gerundete Ecken, und durch die transparenten Ecken scheint der
 * Seitenhintergrund. Im Dunkelmodus sieht das aus wie ein Darstellungsfehler.
 *
 * Das Motiv bleibt das **P** der App. Es ist das internationale Parkzeichen und
 * sagt in einem Zeichen, worum es geht; ein „K" für den Namen sagt nichts und
 * stünde außerdem im Widerspruch zu dem Symbol, das schon auf Homescreens
 * liegt. Ein Buchstabenwechsel ist eine Entscheidung über die Wiedererkennung,
 * keine über den Namen.
 *
 * Neu erzeugen nur, wenn sich das Motiv ändert:
 *   node scripts/make-brand.mjs
 */
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from '@playwright/test'

const here = dirname(fileURLToPath(import.meta.url))
const out = join(here, '..', '..', '..', '..', 'docs', 'brand')

// Dieselbe Geometrie wie in make-icons.mjs. Bewusst kopiert statt geteilt: Ein
// gemeinsames Modul zwischen zwei Skripten, die beide nur bei einer Änderung
// des Motivs laufen, wäre mehr Bindung als Nutzen — und wenn das Motiv sich
// ändert, ändern sich ohnehin beide.
const GLYPH =
  'M172 118h104c62 0 104 40 104 100s-42 100-104 100h-40v76h-64V118zm64 60v80h36c26 0 42-15 42-40s-16-40-42-40h-36z'
const BLUE = '#1d4ed8'
const BOX = { x0: 172, y0: 118, x1: 380, y1: 394 }
const CENTER = { x: (BOX.x0 + BOX.x1) / 2, y: (BOX.y0 + BOX.y1) / 2 }

const round = (value) => Number(value.toFixed(2))

/** Das Zeichen allein, in einem 512er-Kasten zentriert, ohne Fläche. */
function glyph(scale = 1) {
  const dx = 256 - scale * CENTER.x
  const dy = 256 - scale * CENTER.y
  return `<g transform="translate(${round(dx)} ${round(dy)}) scale(${scale})"><path d="${GLYPH}" fill="#fff"/></g>`
}

/** Bild der Organisation: randlos, damit GitHub selbst runden kann. */
const AVATAR = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <rect width="512" height="512" fill="${BLUE}"/>
  ${glyph(1)}
</svg>`

/**
 * Vorschaukarte, 1280×640.
 *
 * GitHub verlangt für „Social preview" mindestens 640×320 und empfiehlt
 * 1280×640; dieselbe Datei taugt als `og:image`. Die Schrift steht großzügig
 * innen, weil Mastodon und Slack die Karte beschneiden statt sie zu skalieren.
 */
const SOCIAL = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 640" width="1280" height="640">
  <rect width="1280" height="640" fill="#0d1113"/>
  <g transform="translate(96 176) scale(0.56)">
    <rect width="512" height="512" rx="96" fill="${BLUE}"/>
    ${glyph(1)}
  </g>
  <text x="416" y="290" font-family="Archivo, Helvetica Neue, Arial, sans-serif" font-size="86" font-weight="700" letter-spacing="-3" fill="#e3ebee">knoellchenfrei</text>
  <text x="418" y="360" font-family="Helvetica Neue, Arial, sans-serif" font-size="36" fill="#9aa8ae">Was Parken hier gerade kostet, und wie lange.</text>
  <text x="418" y="416" font-family="Helvetica Neue, Arial, sans-serif" font-size="29" fill="#74aae4">Berlin · Hamburg · amtliche Daten · offener Quelltext</text>
</svg>`

const JOBS = [
  { file: 'org-avatar-512.png', width: 512, height: 512, svg: AVATAR },
  { file: 'social-preview-1280x640.png', width: 1280, height: 640, svg: SOCIAL },
]

// Dieselbe Weiche wie in `playwright.config.ts`: Wo ein Browser vorinstalliert
// ist, passt der von Playwright erwartete Build oft nicht.
const executablePath = process.env.PLAYWRIGHT_CHROMIUM
const browser = await chromium.launch(executablePath !== undefined ? { executablePath } : {})
try {
  await mkdir(out, { recursive: true })
  await writeFile(join(out, 'org-avatar.svg'), `${AVATAR}\n`)
  await writeFile(join(out, 'social-preview.svg'), `${SOCIAL}\n`)
  for (const job of JOBS) {
    const page = await browser.newPage({
      viewport: { width: job.width, height: job.height },
      deviceScaleFactor: 1,
    })
    await page.setContent(
      `<style>html,body{margin:0;padding:0}svg{display:block}</style>${job.svg}`
    )
    await page.screenshot({ path: join(out, job.file), omitBackground: false })
    await page.close()
    console.log(`${job.file}  ${job.width}×${job.height}`)
  }
} finally {
  await browser.close()
}
