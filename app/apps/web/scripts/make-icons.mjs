/**
 * Erzeugt Symbol-Quelle und Symbol-Bitmaps der App.
 *
 * Warum überhaupt PNG: iOS ignoriert SVG-Symbole beim Ablegen auf dem
 * Homescreen vollständig, und Chrome verlangt für die ausführliche
 * Installations-Karte mindestens ein 512er-Bitmap. Ein SVG allein ergibt auf
 * dem iPhone eine leere graue Kachel.
 *
 * Warum zwei Motive: `purpose: "maskable"` wird auf Android in eine vom
 * Hersteller gewählte Form geschnitten — Kreis, Squircle, Tropfen. Sicher ist
 * nur der innere Kreis mit 80 % Durchmesser. Ein Symbol als "any maskable" zu
 * deklarieren, wie es hier vorher stand, ist der übliche Fehler: Android
 * schneidet dann die runden Ecken samt einem Stück des P ab, während iOS
 * dieselbe Datei ungeschnitten mit doppelt gerundeten Ecken zeigt.
 *
 * Die Ergebnisse liegen im Repository, damit weder Build noch CI einen Browser
 * brauchen. Neu erzeugen nur, wenn sich das Motiv ändert:
 *   node scripts/make-icons.mjs
 */
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from '@playwright/test'

const here = dirname(fileURLToPath(import.meta.url))
const out = join(here, '..', 'public')

const GLYPH =
  'M172 118h104c62 0 104 40 104 100s-42 100-104 100h-40v76h-64V118zm64 60v80h36c26 0 42-15 42-40s-16-40-42-40h-36z'
const BLUE = '#1d4ed8'

/**
 * Der Pfad ist von Hand gesetzt und in seinem Kasten nicht zentriert: Er reicht
 * von 172 bis 380 waagerecht und von 118 bis 394 senkrecht. Ohne Ausgleich
 * steht das P sichtbar links oben — auf dem Homescreen zwischen lauter zentriert
 * gesetzten Symbolen fällt das auf.
 */
const BOX = { x0: 172, y0: 118, x1: 380, y1: 394 }
const CENTER = { x: (BOX.x0 + BOX.x1) / 2, y: (BOX.y0 + BOX.y1) / 2 }

/**
 * @param {{ rounded: boolean, scale: number }} options
 */
function icon({ rounded, scale }) {
  const dx = 256 - scale * CENTER.x
  const dy = 256 - scale * CENTER.y
  const plate = rounded
    ? `<rect width="512" height="512" rx="96" fill="${BLUE}"/>`
    : `<rect width="512" height="512" fill="${BLUE}"/>`
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  ${plate}
  <g transform="translate(${round(dx)} ${round(dy)}) scale(${scale})">
    <path d="${GLYPH}" fill="#fff"/>
  </g>
</svg>`
}

function round(value) {
  return Number(value.toFixed(2))
}

/**
 * Der Zuschnitt darf höchstens den inneren Kreis mit 80 % Durchmesser
 * beanspruchen. Bei Maßstab 1,1 liegt die entfernteste Ecke des P 190 px vom
 * Mittelpunkt — der sichere Radius ist 205 px.
 */
const MASKABLE_SCALE = 1.1

const SOURCE = icon({ rounded: true, scale: 1 })

const JOBS = [
  { file: 'icon-192.png', size: 192, svg: SOURCE },
  { file: 'icon-512.png', size: 512, svg: SOURCE },
  { file: 'icon-maskable-512.png', size: 512, svg: icon({ rounded: false, scale: MASKABLE_SCALE }) },
  // iOS rundet selbst und mag keine Transparenz: randlose Fläche, Motiv wie sonst.
  { file: 'apple-touch-icon.png', size: 180, svg: icon({ rounded: false, scale: 1 }) },
]

// Dieselbe Weiche wie in `playwright.config.ts`: Wo ein Browser vorinstalliert
// ist, passt der von Playwright erwartete Build oft nicht.
const executablePath = process.env.PLAYWRIGHT_CHROMIUM
const browser = await chromium.launch(executablePath !== undefined ? { executablePath } : {})
try {
  await mkdir(out, { recursive: true })
  await writeFile(join(out, 'icon.svg'), `${SOURCE}\n`)
  console.log('icon.svg')
  for (const job of JOBS) {
    const page = await browser.newPage({
      viewport: { width: job.size, height: job.size },
      deviceScaleFactor: 1,
    })
    await page.setContent(
      `<style>html,body{margin:0;padding:0;background:transparent}svg{display:block;width:${job.size}px;height:${job.size}px}</style>${job.svg}`,
    )
    const shot = await page.screenshot({ omitBackground: true, type: 'png' })
    await writeFile(join(out, job.file), shot)
    await page.close()
    console.log(`${job.file}  ${job.size}×${job.size}  ${shot.length} B`)
  }
} finally {
  await browser.close()
}
