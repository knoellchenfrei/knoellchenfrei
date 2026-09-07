import { expect, test, type Page } from '@playwright/test'

/**
 * Die Seite als abgelegte App.
 *
 * Das meiste daran ist nicht sichtbar, sondern eine Datei, die stimmen muss:
 * Ein Manifest mit einem Symbol, das es nicht gibt, sieht im Quelltext richtig
 * aus und führt auf dem Homescreen zu einer leeren grauen Kachel — genau die
 * Art Fehler, die niemand bemerkt, weil niemand die App zweimal installiert.
 */

async function ready(page: Page): Promise<void> {
  await expect(page.locator('.panel-toggle')).toBeVisible({ timeout: 30_000 })
  await expect(page.locator('.provenance')).toBeAttached({ timeout: 45_000 })
  const later = page.locator('.prompt').getByRole('button', { name: 'Später' })
  if ((await later.count()) > 0) await later.click()
}

interface Manifest {
  id: string
  name: string
  start_url: string
  scope: string
  display: string
  icons: { src: string; sizes: string; type: string; purpose?: string }[]
  screenshots: { src: string; sizes: string; form_factor: string }[]
  shortcuts: { name: string; url: string; icons?: { src: string }[] }[]
}

async function manifest(page: Page): Promise<Manifest> {
  const response = await page.request.get('/manifest.webmanifest')
  expect(response.status()).toBe(200)
  return (await response.json()) as Manifest
}

test.describe('der Service Worker', () => {
  // Gefunden beim Sprung auf Vite 8, verursacht hat es die zweite Stadt: Die
  // Datendateien wanderten nach `data/<stadt>/`, die Vorabliste im Worker
  // zeigte weiter auf `data/zones.geojson`. `cache.addAll` scheitert an einer
  // einzigen 404 und der Worker verschluckt den Fehler — vorgehalten wurde
  // danach **nichts**, und die App sah dabei gesund aus. Ein Test, der jeden
  // Pfad abruft, hätte das sofort gezeigt.
  test('jede Datei, die er vorab holt, gibt es auch', async ({ page }) => {
    const response = await page.request.get('/sw.js')
    expect(response.status()).toBe(200)
    const source = await response.text()

    // Beide Anführungsarten: Das Grundgeruest steht als Quelltext in einfachen,
    // die eingesetzte Liste kommt als JSON in doppelten. Nur die doppelten zu
    // nehmen liesse genau die Hälfte ungeprüft — die handgeschriebene.
    const paths = [...source.matchAll(/['"](\.\/[^'"]*)['"]/g)].map((match) => match[1] as string)
    // Acht feste Einträge plus die gehashten Bündel plus die Daten. Fällt die
    // Liste unter diese Größe, ist die Ersetzung schiefgegangen.
    expect(paths.length).toBeGreaterThan(14)
    expect(paths.some((path) => path.includes('/assets/'))).toBe(true)
    expect(paths.some((path) => path.includes('/data/'))).toBe(true)

    for (const path of paths) {
      const asset = await page.request.get(path.replace(/^\.\//, '/'))
      expect(asset.status(), `${path} fehlt — cache.addAll bricht daran ab`).toBe(200)
    }
  })

  // Der lokale Preview-Server liefert /index.html mit 200, Cloudflare Pages mit
  // einem 308 auf /. Der Test oben kann das deshalb nicht sehen — er misst
  // gegen den Preview-Server. Also wird die Ursache geprüft statt der Wirkung:
  // Dieser eine Pfad gehört nicht in den Vorrat, weil `cache.addAll` an einer
  // Weiterleitung scheitert und `cache.add` sie einzeln verliert.
  test('hält kein ./index.html vor — Pages leitet den Pfad um', async ({ page }) => {
    const source = await (await page.request.get('/sw.js')).text()
    // Kommentare heraus, bevor gesucht wird. Der erste Anlauf dieses Tests
    // schlug fehl, weil er den Pfad im *Kommentar* fand, der erklärt, warum er
    // nicht im Vorrat steht — dieselbe Falle, die hier schon einmal einen
    // Platzhalter in einem Kommentar getroffen hat.
    const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
    expect(code).toContain("'./'")
    expect(code).not.toMatch(/['"]\.\/index\.html['"]/)
  })

  test('trägt eine ersetzte Build-Kennung, keinen Platzhalter', async ({ page }) => {
    const source = await (await page.request.get('/sw.js')).text()
    expect(source).not.toContain('__BUILD_ID__')
    expect(source).not.toContain('__SHELL_ASSETS__')
    expect(source).toMatch(/const CACHE = 'knoellchenfrei-[0-9a-f]{12}'/)
  })
})

test.describe('das Manifest', () => {
  test('jede Datei, die es nennt, gibt es auch', async ({ page }) => {
    const data = await manifest(page)
    const referenced = [
      ...data.icons.map((icon) => icon.src),
      ...data.screenshots.map((shot) => shot.src),
      ...data.shortcuts.flatMap((shortcut) => (shortcut.icons ?? []).map((icon) => icon.src)),
    ]
    expect(referenced.length).toBeGreaterThan(5)
    for (const src of referenced) {
      const response = await page.request.get(src.replace(/^\.\//, '/'))
      expect(response.status(), `${src} fehlt`).toBe(200)
      const body = await response.body()
      // Eine leere oder als Platzhalter angelegte Datei liefert ebenfalls 200
      // und ergibt auf dem Homescreen dieselbe graue Kachel.
      expect(body.length, `${src} ist leer`).toBeGreaterThan(200)
      if (src.endsWith('.png')) {
        // Die acht Bytes am Anfang jeder PNG-Datei. Fängt eine umbenannte
        // SVG-Datei, die der Browser stillschweigend verwirft.
        expect(body.subarray(0, 8).toString('hex'), `${src} ist kein PNG`).toBe(
          '89504e470d0a1a0a',
        )
      }
    }
  })

  test('bietet ein schlichtes und ein maskierbares Symbol an, nie eines für beides', async ({ page }) => {
    const data = await manifest(page)
    // „any maskable" an einem Symbol ist der übliche Fehler: Android schneidet
    // dann die Ecken der Kachel samt Motiv weg.
    for (const icon of data.icons) {
      expect(icon.purpose ?? 'any').not.toContain(' ')
    }
    const purposes = data.icons.map((icon) => icon.purpose ?? 'any')
    expect(purposes).toContain('maskable')
    expect(purposes).toContain('any')
    // Chrome verlangt für die ausführliche Installations-Karte ein 512er-Bitmap.
    const large = data.icons.find((icon) => icon.sizes === '512x512' && icon.type === 'image/png')
    expect(large).toBeDefined()
  })

  test('zeigt für beide Bildschirmformen ein Bild', async ({ page }) => {
    const data = await manifest(page)
    const shapes = data.screenshots.map((shot) => shot.form_factor)
    // Fehlt eines der beiden, fällt Chrome auf dem betroffenen Gerät auf die
    // knappe Installationsleiste zurück.
    expect(shapes).toContain('narrow')
    expect(shapes).toContain('wide')
  })

  test('bleibt in seinem eigenen Verzeichnis', async ({ page }) => {
    const data = await manifest(page)
    // Alles relativ: Die App liegt je nach Hosting unter einem Unterpfad, und
    // ein führender Schrägstrich würde sie dort ins Leere zeigen lassen.
    for (const value of [data.id, data.start_url, data.scope]) {
      expect(value.startsWith('/')).toBe(false)
    }
    for (const shortcut of data.shortcuts) {
      expect(shortcut.url.startsWith('./')).toBe(true)
    }
  })
})

test.describe('Kurzbefehle vom App-Symbol', () => {
  test('?start=melden öffnet das Meldeblatt und räumt die Adresse auf', async ({ page }) => {
    await page.goto('/?start=melden')
    await ready(page)
    await expect(page.getByRole('dialog', { name: 'Sichtung melden' })).toBeVisible()
    // Bliebe der Parameter stehen, öffnete jedes Neuladen wieder den Dialog.
    expect(new URL(page.url()).searchParams.get('start')).toBeNull()
  })

  test('?start=kontrollen schaltet die Heatmap ein', async ({ page }) => {
    await page.goto('/?start=kontrollen')
    await ready(page)
    if (!(await page.locator('.sidebar__body').isVisible())) await page.locator('.panel-toggle').click()
    // Der Knopf heißt „Ausblenden", solange die Ebene liegt — das ist der
    // einzige sichtbare Beleg dafür, dass die Verknüpfung mehr getan hat als
    // die Seite zu öffnen.
    const panel = page.locator('section[aria-label="Kontrolldichte"]')
    await expect(panel.getByRole('button', { name: 'Ausblenden' })).toBeVisible({ timeout: 15_000 })
  })

  test('ein unbekannter Wert tut schlicht nichts', async ({ page }) => {
    await page.goto('/?start=unfug')
    await ready(page)
    await expect(page.locator('.sheet')).toHaveCount(0)
  })
})

/**
 * Chrome feuert `beforeinstallprompt` nur unter Bedingungen, die im Testlauf
 * nicht herstellbar sind (HTTPS, Nutzungsdauer, kein bereits abgelegtes
 * Exemplar). Das Ereignis wird deshalb nachgestellt — geprüft wird, was die App
 * damit macht, nicht ob der Browser es schickt.
 */
async function fakeInstallOffer(page: Page): Promise<void> {
  await page.evaluate(() => {
    const event = new Event('beforeinstallprompt') as Event & {
      prompt?: () => Promise<void>
      userChoice?: Promise<{ outcome: string }>
    }
    const seen = window as unknown as { __installPrompted?: boolean }
    event.prompt = () => {
      seen.__installPrompted = true
      return Promise.resolve()
    }
    event.userChoice = Promise.resolve({ outcome: 'accepted' })
    window.dispatchEvent(event)
  })
}

test.describe('Ablegen auf dem Startbildschirm', () => {
  test('die Einstellungen sagen wie, auch bevor der Browser etwas anbietet', async ({ page }) => {
    await page.goto('/')
    await ready(page)
    await page.getByRole('button', { name: 'Einstellungen' }).click()
    const sheet = page.getByRole('dialog', { name: 'Einstellungen' })
    await expect(sheet.locator('.install')).toBeVisible()
  })

  test('macht aus dem Angebot des Browsers einen Knopf, der den Dialog öffnet', async ({ page }) => {
    await page.goto('/')
    await ready(page)
    await fakeInstallOffer(page)
    await page.getByRole('button', { name: 'Einstellungen' }).click()
    const button = page
      .getByRole('dialog', { name: 'Einstellungen' })
      .getByRole('button', { name: 'Auf dem Homescreen ablegen' })
    await expect(button).toBeVisible()
    await button.click()
    expect(await page.evaluate(() => (window as unknown as { __installPrompted?: boolean }).__installPrompted)).toBe(true)
  })

  test('hält den Hinweis beim ersten Besuch zurück und lässt ihn fallen, sobald er weggeklickt ist', async ({ page }) => {
    await page.goto('/')
    await ready(page)
    await fakeInstallOffer(page)
    if (!(await page.locator('.sidebar__body').isVisible())) await page.locator('.panel-toggle').click()
    // Wer eine App noch nicht kennt, will sie nicht installieren.
    await expect(page.locator('.installbar')).toHaveCount(0)

    await page.goto('/')
    await ready(page)
    await fakeInstallOffer(page)
    if (!(await page.locator('.sidebar__body').isVisible())) await page.locator('.panel-toggle').click()
    const bar = page.locator('.installbar')
    await expect(bar).toBeVisible()

    await bar.getByRole('button', { name: 'Hinweis ausblenden' }).click()
    await expect(bar).toHaveCount(0)

    await page.goto('/')
    await ready(page)
    await fakeInstallOffer(page)
    if (!(await page.locator('.sidebar__body').isVisible())) await page.locator('.panel-toggle').click()
    // Einmal weggeklickt heißt weggeklickt, nicht „beim nächsten Mal wieder".
    await expect(page.locator('.installbar')).toHaveCount(0)
  })
})

/**
 * Der Beta-Riegel.
 *
 * Solange das Impressum auf eine Privatperson läuft, entscheidet dieser Riegel,
 * ob diese Anschrift in Suchindizes und Archiven landet. Einmal drin, bleibt sie
 * drin — deshalb wird er geprüft und nicht bloß eingebaut.
 */
test.describe('die geschlossene Beta', () => {
  test('sagt Suchmaschinen, dass sie wegbleiben sollen — in der Seite und in robots.txt', async ({ page }) => {
    await page.goto('/')
    const robots = page.locator('meta[name="robots"]')
    await expect(robots).toHaveAttribute('content', /noindex/)

    const file = await page.request.get('/robots.txt')
    expect(file.status()).toBe(200)
    expect(await file.text()).toContain('Disallow: /')
  })

  test('sagt auf der Seite, dass es ein Testbetrieb ist', async ({ page }) => {
    await page.goto('/')
    await ready(page)
    await expect(page.locator('.beta')).toBeVisible()

    await page.getByRole('button', { name: 'Einstellungen' }).click()
    await expect(
      page.getByRole('dialog', { name: 'Einstellungen' }).locator('.callout--beta'),
    ).toContainText('Testbetrieb')
  })
})

/**
 * Die Sicherheits-Kopfzeilen liegen als `_headers` im Ausgabeverzeichnis und
 * werden von Cloudflare Pages ausgewertet — der Vorschauserver dieser Suite
 * tut das nicht. Geprüft wird deshalb die **Datei**, nicht ihre Wirkung: dass
 * sie überhaupt entsteht, und dass die Richtlinie die Ziele nennt, die die App
 * wirklich braucht.
 *
 * Warum das einen Test wert ist: Eine CSP, die eine Herkunft vergisst, macht
 * die App nicht kaputt, sondern leer — die Karte bleibt schwarz, und im
 * Protokoll steht nichts, was nach einem Fehler aussieht. Genau dieser Fall
 * ist beim Bauen aufgetreten: `worker-src blob:` allein sperrte MapLibre 6 aus.
 */
test.describe('die Sicherheits-Kopfzeilen', () => {
  test('_headers entsteht und nennt die nötigen Herkünfte', async ({ page }) => {
    const response = await page.request.get('/_headers')
    expect(response.status()).toBe(200)
    const text = await response.text()

    const csp = /Content-Security-Policy: (.+)/.exec(text)?.[1] ?? ''
    expect(csp).toContain("default-src 'self'")
    expect(csp).toContain("frame-ancestors 'none'")
    expect(csp).toContain("object-src 'none'")
    // Ohne `'self'` bleibt die Karte schwarz: MapLibre 6 lädt seinen Worker
    // als eigene Datei, nicht als Blob.
    expect(csp).toContain("worker-src 'self' blob:")
    // Umgekehrte Zusicherung seit dem 7. September: `protomaps.github.io` darf
    // **nicht** mehr dastehen. Die Schriften liegen im eigenen Eimer, und eine
    // erlaubte Herkunft, die niemand mehr braucht, ist eine zu viel — sie
    // stünde auch weiterhin als Empfänger in der Datenschutzerklärung.
    expect(csp).not.toContain('protomaps.github.io')

    expect(text).toContain('X-Content-Type-Options: nosniff')
    expect(text).toContain('Referrer-Policy: no-referrer')
    // Der Standort ist die einzige Berechtigung, die diese App je anfragt.
    expect(text).toContain('geolocation=(self)')
  })
})
