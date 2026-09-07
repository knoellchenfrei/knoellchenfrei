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
// Derselbe Grund wie in der Vorschaukarte — der Bot bekommt ihn, damit er sich
// vom Dach unterscheidet, ohne die Palette zu verlassen.
const DUNKEL = '#0d1113'
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

/**
 * Bilder für Telegram: der Bot und die drei Gruppen.
 *
 * Telegram verlangt ein **Quadrat**, empfohlen 512×512 (Minimum 300×300),
 * PNG oder JPEG. Der Haken ist die doppelte Darstellung: In Chatlisten und
 * neben jeder Nachricht wird **rund** beschnitten, in der Profilansicht bleibt
 * das Quadrat. Beides muss stimmen — also Fläche randlos bis in die Ecken,
 * Motiv aber innerhalb des einbeschriebenen Kreises.
 *
 * Deshalb steht das P hier auf 0.78 statt 1: Bei voller Größe schneidet der
 * Kreis die Serifenkanten an, und das sieht nicht nach Zuschnitt aus, sondern
 * nach einem schlecht gezeichneten Buchstaben.
 *
 * Die Unterscheidung der vier ist bewusst grob, weil die Bilder meistens
 * 24 Pixel groß sind:
 *
 * - **Dach** (`@knoellchenfrei`): die Marke selbst, blaue Fläche, weißes P.
 * - **Bot** (`@knoellchenfrei_bot`): dieselbe Marke auf dem dunklen Grund der
 *   Vorschaukarte. Ein Helligkeitswechsel ist auf 24 Pixeln das Einzige, was
 *   verlässlich trägt; ein zusätzliches Zeichen wäre dort ein Fleck. **Nicht**
 *   weiß, obwohl das der naheliegende Gegenpol wäre: In einer hellen Chatliste
 *   hätte ein weißes Bild keinen Rand, und das P schwebte ohne Fläche.
 * - **Berlin / Hamburg**: dieselbe Marke plus das **Kfz-Kennzeichen** unten
 *   rechts — `B` und `HH`. Klein verschmilzt es zu einem Punkt und stört
 *   nicht; groß beantwortet es die Frage, in welcher Gruppe man ist.
 *   Ausgeschriebene Städtenamen wären bei dieser Größe unlesbar — ein Wort,
 *   das niemand entziffert, ist Dekoration.
 *
 *   Das Kennzeichen und nicht der Ländercode: Die App handelt von Autos, und
 *   ein Unterscheidungszeichen ist das, was auf jedem davon steht. **Nicht zu
 *   verwechseln** mit `Land` in `core/holidays.ts` — dort steht `BE` für
 *   Berlin, weil das der ISO-Code des Bundeslands ist. Zwei Kürzel für
 *   dieselbe Stadt, und sie meinen Verschiedenes.
 */
const KREIS_SICHER = 0.78

/**
 * Kürzel in einem Kreis unten rechts.
 *
 * Drei Maße, die alle drei aus einem ersten Versuch stammen, der falsch war:
 * Der Kreis saß auf dem Schaft des P, und die zwei Buchstaben liefen rechts
 * aus ihm heraus. Jetzt sitzt er weiter außen, trägt einen Ring in der
 * Flächenfarbe als Abstandhalter zum P, und die Schrift ist so klein, dass
 * zwei Zeichen samt Innenabstand hineinpassen.
 *
 * Weiter nach außen geht nicht: Telegram beschneidet rund, und der äußerste
 * Punkt des Kreises muss innerhalb des einbeschriebenen Kreises bleiben.
 */
function marke(text) {
  // Ein Zeichen darf größer stehen als zwei — sonst sieht `B` verloren aus in
  // einem Kreis, der für `HH` bemessen ist.
  const groesse = text.length > 1 ? 62 : 84
  return `<g>
    <circle cx="374" cy="374" r="90" fill="${BLUE}"/>
    <circle cx="374" cy="374" r="78" fill="#fff"/>
    <text x="374" y="376" text-anchor="middle" dominant-baseline="central"
          font-family="Archivo, Helvetica Neue, Arial, sans-serif"
          font-size="${groesse}" font-weight="700" letter-spacing="-2" fill="${BLUE}">${text}</text>
  </g>`
}

const tgFlaeche = (inhalt, hintergrund = BLUE) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <rect width="512" height="512" fill="${hintergrund}"/>
  ${inhalt}
</svg>`

/** Wie `glyph`, nur in einer wählbaren Farbe. */
function glyphFarbe(scale, farbe) {
  const dx = 256 - scale * CENTER.x
  const dy = 256 - scale * CENTER.y
  return `<g transform="translate(${round(dx)} ${round(dy)}) scale(${scale})"><path d="${GLYPH}" fill="${farbe}"/></g>`
}

const TG_DACH    = tgFlaeche(glyphFarbe(KREIS_SICHER, '#fff'))
const TG_BOT     = tgFlaeche(glyphFarbe(KREIS_SICHER, '#fff'), DUNKEL)
const TG_BERLIN  = tgFlaeche(`${glyphFarbe(KREIS_SICHER, '#fff')}${marke('B')}`)
const TG_HAMBURG = tgFlaeche(`${glyphFarbe(KREIS_SICHER, '#fff')}${marke('HH')}`)
// Kfz-Kuerzel wie auf dem Nummernschild, nicht ISO: F und M, siehe docs/marke.md.
const TG_FRANKFURT = tgFlaeche(`${glyphFarbe(KREIS_SICHER, '#fff')}${marke('F')}`)
const TG_MUENCHEN  = tgFlaeche(`${glyphFarbe(KREIS_SICHER, '#fff')}${marke('M')}`)

const JOBS = [
  { file: 'telegram-dach-512.png', width: 512, height: 512, svg: TG_DACH },
  { file: 'telegram-bot-512.png', width: 512, height: 512, svg: TG_BOT },
  { file: 'telegram-berlin-512.png', width: 512, height: 512, svg: TG_BERLIN },
  { file: 'telegram-hamburg-512.png', width: 512, height: 512, svg: TG_HAMBURG },
  { file: 'telegram-frankfurt-512.png', width: 512, height: 512, svg: TG_FRANKFURT },
  { file: 'telegram-muenchen-512.png', width: 512, height: 512, svg: TG_MUENCHEN },
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
  await writeFile(join(out, 'telegram-dach.svg'), `${TG_DACH}\n`)
  await writeFile(join(out, 'telegram-bot.svg'), `${TG_BOT}\n`)
  await writeFile(join(out, 'telegram-berlin.svg'), `${TG_BERLIN}\n`)
  await writeFile(join(out, 'telegram-hamburg.svg'), `${TG_HAMBURG}\n`)
  await writeFile(join(out, 'telegram-frankfurt.svg'), `${TG_FRANKFURT}\n`)
  await writeFile(join(out, 'telegram-muenchen.svg'), `${TG_MUENCHEN}\n`)
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
