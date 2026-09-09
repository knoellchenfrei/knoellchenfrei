import { expect, test, type Page } from '@playwright/test'

/**
 * Was der Mobile-Audit vom 9. September gefunden und geändert hat.
 *
 * Jeder Test hier hält einen gemessenen Befund fest — Screenshots auf sechs
 * Viewports, dazu Tippflächen und freie Kartenfläche —, damit er sich nicht
 * wiederholt. Die Begründung steht in `docs/mobile-ux-audit-2026-09.md`.
 */

/** Dieselbe Bereitschaft wie in `app.spec.ts`, ohne den Vordialog. */
async function ready(page: Page): Promise<void> {
  await page.goto('/')
  await expect(page.locator('.panel-toggle')).toBeVisible({ timeout: 30_000 })
  await expect(page.locator('.provenance')).toBeAttached({ timeout: 45_000 })
  await expect(page.locator('.loading')).toHaveCount(0, { timeout: 30_000 })
  await page.waitForTimeout(600)
  const later = page.locator('.prompt').getByRole('button', { name: 'Später' })
  if ((await later.count()) > 0) await later.click()
}

async function openPanel(page: Page): Promise<void> {
  const body = page.locator('.sidebar__body')
  if (!(await body.isVisible())) await page.locator('.panel-toggle').click()
  await expect(body).toBeVisible()
}

test.describe('Zurück schließt das Blatt, nicht die App', () => {
  /**
   * Regression: Es gab keinen Verlaufseintrag. Auf Android schloss „Zurück"
   * bei offenen Einstellungen die ganze PWA — die einzige Geste, die dort
   * jede App zum Schließen eines Dialogs kennt.
   */
  test('legt beim Öffnen einen Eintrag an und räumt ihn beim Schließen ab', async ({ page }) => {
    await ready(page)
    expect(await page.evaluate(() => history.state)).toBeNull()

    await page.getByRole('button', { name: 'Einstellungen' }).click()
    const dialog = page.getByRole('dialog', { name: 'Einstellungen' })
    await expect(dialog).toBeVisible()
    expect(await page.evaluate(() => history.state)).not.toBeNull()

    await page.goBack()
    await expect(dialog).toHaveCount(0)
    // Die Adresse bleibt: Der Eintrag war einer der App, kein Seitenwechsel.
    expect(new URL(page.url()).pathname).toBe('/')

    // Über den Knopf geschlossen: Der Eintrag ist trotzdem weg, sonst wäre
    // der nächste Druck auf „Zurück" ein Druck ins Leere.
    await page.getByRole('button', { name: 'Einstellungen' }).click()
    await expect(dialog).toBeVisible()
    await dialog.getByRole('button', { name: 'Schließen' }).click()
    await expect(dialog).toHaveCount(0)
    await expect.poll(() => page.evaluate(() => history.state)).toBeNull()
  })

  test('räumt auch das Melde-Blatt über Zurück ab', async ({ page }) => {
    await ready(page)
    await openPanel(page)
    await page.locator('button', { hasText: 'Hier gesehen' }).click()
    const dialog = page.getByRole('dialog', { name: 'Sichtung melden' })
    await expect(dialog).toBeVisible()
    await page.goBack()
    await expect(dialog).toHaveCount(0)
  })
})

test.describe('das Blatt auf dem Handy', () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== 'phone', 'Nur das Handy hat das Blatt unten.')
  })

  /**
   * Regression: Der Griff scrollte mit dem Inhalt weg. Wer bis zur
   * Herkunftsangabe gelesen hatte, fand keinen Knopf zum Schließen mehr.
   */
  test('behält den Griff beim Scrollen im Bild', async ({ page }) => {
    await ready(page)
    await openPanel(page)
    const grip = page.locator('.panel-toggle')
    const before = await grip.boundingBox()
    await page.locator('.sidebar__body').evaluate((el) => {
      el.scrollTo({ top: el.scrollHeight, behavior: 'instant' })
    })
    await page.waitForTimeout(200)
    const after = await grip.boundingBox()
    expect(after).not.toBeNull()
    expect(Math.round(after!.y)).toBe(Math.round(before!.y))
    await expect(grip).toBeInViewport()
    // Und der Inhalt ist wirklich gescrollt, nicht nur der Griff geblieben.
    await expect(page.locator('.provenance')).toBeInViewport()
  })

  test('hält den Standort-Knopf über dem Blatt, zu wie offen', async ({ page }) => {
    await ready(page)
    const locate = page.getByRole('button', { name: 'Wo bin ich?' })
    const sheet = page.locator('.sidebar')
    // Zugeklappt: knapp über dem Griff, in der unteren rechten Ecke.
    let button = await locate.boundingBox()
    let panel = await sheet.boundingBox()
    expect(button!.y + button!.height).toBeLessThanOrEqual(panel!.y + 1)
    expect(button!.y).toBeGreaterThan(panel!.y - 80)
    expect(button!.width).toBeGreaterThanOrEqual(44)
    expect(button!.height).toBeGreaterThanOrEqual(44)

    await openPanel(page)
    await page.waitForTimeout(400)
    button = await locate.boundingBox()
    panel = await sheet.boundingBox()
    expect(button!.y + button!.height).toBeLessThanOrEqual(panel!.y + 1)
  })

  test('lässt sich am Griff hochziehen und wieder zuwischen', async ({ page }) => {
    await ready(page)
    const grip = page.locator('.panel-toggle')
    const body = page.locator('.sidebar__body')
    await expect(body).toBeHidden()

    const swipe = async (dy: number): Promise<void> => {
      // Das Blatt rastet mit einem Übergang von 220 ms; wer den Griff
      // mittendrin misst, tippt danach auf die Karte.
      await page.waitForTimeout(400)
      const box = await grip.boundingBox()
      const x = box!.x + box!.width / 2
      const y = box!.y + box!.height / 2
      const cdp = await page.context().newCDPSession(page)
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] })
      for (let step = 1; step <= 6; step++) {
        await cdp.send('Input.dispatchTouchEvent', {
          type: 'touchMove',
          touchPoints: [{ x, y: y + (dy * step) / 6 }],
        })
      }
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
      await cdp.detach()
    }

    // Hoch: zu → halb.
    await swipe(-120)
    await expect(body).toBeVisible()
    const half = (await page.locator('.sidebar').boundingBox())!.height
    // Noch einmal hoch: halb → ganz.
    await swipe(-120)
    await expect(page.locator('.sidebar')).toHaveClass(/sidebar--full/)
    await expect.poll(async () => (await page.locator('.sidebar').boundingBox())!.height).toBeGreaterThan(half + 40)
    // Runter: ganz → halb → zu.
    await swipe(120)
    await expect(page.locator('.sidebar')).not.toHaveClass(/sidebar--full/)
    await expect(body).toBeVisible()
    await swipe(120)
    await expect(body).toBeHidden()
    // Ein Tipp ist weiterhin ein Tipp.
    await grip.click()
    await expect(body).toBeVisible()
  })

  test('lässt die Kopfzeile bei Suche und Meldeknopf', async ({ page }) => {
    await ready(page)
    const topbar = await page.locator('.topbar').boundingBox()
    // Suchfeld plus der rote Meldeknopf darunter (seit dem 9. September
    // abends, auf Wunsch des Betreibers) — und sonst nichts: Marke, Zahl und
    // Standort stehen nicht mehr hier, die waren die vierzeilige Kopfzeile
    // von vor dem Audit. Zwei Zeilen sind 116 Pixel.
    expect(topbar!.height).toBeLessThan(130)
    await expect(page.locator('.topbar__row')).toHaveCount(2)
    await expect(page.locator('.live')).toContainText('kassieren')
  })
})

test.describe('Meldung und Suchtreffer', () => {
  /**
   * Regression: Die Meldung lag über der Trefferliste (z-index 7 gegen 5),
   * und der erste Treffer war nicht zu treffen, solange sie stand.
   */
  test('legt die Meldung nicht über die Suchtreffer', async ({ page }) => {
    // Ohne Berechtigung antwortet der kopflose Browser gar nicht — auch nicht
    // nach dem Zeitlimit. Die Ablehnung wird deshalb nachgestellt.
    await page.addInitScript(() => {
      navigator.geolocation.getCurrentPosition = (_ok, fail) => {
        fail?.({ code: 1, message: 'denied', PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3 })
      }
    })
    await ready(page)
    await page.getByRole('button', { name: 'Wo bin ich?' }).click()
    await expect(page.locator('.toast')).toBeVisible()
    await page.locator('.search__input').fill('Mitte')
    // Playwright klickt nur, was oben liegt — läge die Meldung darüber,
    // scheiterte der Klick am Zeitlimit.
    await page.locator('.search__results button').first().click({ timeout: 5_000 })
    await expect(page.locator('#zone-panel-title')).toBeVisible()
  })
})

test.describe('Einstellungen als Dialog', () => {
  test('macht den Rest der Seite inert und schließt über den Schleier', async ({ page }, testInfo) => {
    await ready(page)
    await page.getByRole('button', { name: 'Einstellungen' }).click()
    const dialog = page.getByRole('dialog', { name: 'Einstellungen' })
    await expect(dialog).toBeVisible()
    // Tab läuft nicht in die Karte hinter dem Dialog.
    expect(await page.locator('.sidebar').getAttribute('inert')).not.toBeNull()
    expect(await page.locator('.topbar').getAttribute('inert')).not.toBeNull()
    test.skip(testInfo.project.name !== 'desktop', 'Der Schleier ist nur neben dem Blatt zu treffen.')
    await page.locator('.scrim').click({ position: { x: 20, y: 300 } })
    await expect(dialog).toHaveCount(0)
    expect(await page.locator('.sidebar').getAttribute('inert')).toBeNull()
  })
})

test.describe('Folgepunkte aus dem Audit', () => {
  /**
   * Punkt 2 der Empfehlung: Auf dem Handy scrollt die Chip-Zeile seitlich,
   * und ob rechts noch Chips liegen, sah man nur, wenn der letzte zufällig
   * angeschnitten war. Der Verlauf hängt an einer Messung, nicht an einer
   * Vermutung: `scrollWidth > clientWidth`, und nicht ganz rechts.
   *
   * Zwei Dinge, die der Test nebenbei festhält: Der Verlauf belegt keinen
   * Platz in der Zeile (sonst verschöbe er die Messung, die ihn einblendet),
   * und auf dem Desktop, wo die Zeile wickelt, gibt es ihn nie.
   */
  test('zeigt am rechten Rand der Chip-Zeile, dass dort mehr liegt', async ({ page }, testInfo) => {
    // Auf 320 Pixeln: Seit die Kontrolldichte keinen Chip mehr hat, passen
    // die fünf Berliner Chips auf ein 412 Pixel breites Handy in die Zeile,
    // und nichts läuft über. Das schmalste Gerät hat den Überlauf sicher.
    if (testInfo.project.name === 'phone') await page.setViewportSize({ width: 320, height: 568 })
    await ready(page)
    const legend = page.locator('.legend')
    // Zu: nur der eine Chip, nichts läuft über, kein Verlauf.
    await expect(legend).not.toHaveClass(/legend--more/)
    await page.getByRole('button', { name: /Ebenen/ }).click()
    // Offen: mehr als der eine Umschalter.
    await expect.poll(() => page.locator('.legend .chip').count()).toBeGreaterThan(1)

    const measure = () =>
      legend.evaluate((el) => ({
        overflow: el.scrollWidth - el.clientWidth,
        scrollLeft: el.scrollLeft,
        fade: getComputedStyle(el, '::after').opacity,
      }))

    if (testInfo.project.name !== 'phone') {
      // Wickelnd, nicht scrollend: nichts anzudeuten.
      expect((await measure()).overflow).toBeLessThanOrEqual(1)
      await expect(legend).not.toHaveClass(/legend--more/)
      return
    }

    expect((await measure()).overflow).toBeGreaterThan(1)
    await expect(legend).toHaveClass(/legend--more/)
    await expect.poll(async () => (await measure()).fade).toBe('1')

    // Ganz nach rechts: Der Verlauf verschwindet, und die Zeile ist danach
    // nicht breiter geworden — der Verlauf selbst hat keinen Platz belegt.
    const before = (await measure()).overflow
    await legend.evaluate((el) => el.scrollTo({ left: el.scrollWidth, behavior: 'instant' }))
    await expect(legend).not.toHaveClass(/legend--more/)
    await expect.poll(async () => (await measure()).fade).toBe('0')
    expect((await measure()).overflow).toBe(before)

    // Und zurück an den Anfang: wieder da.
    await legend.evaluate((el) => el.scrollTo({ left: 0, behavior: 'instant' }))
    await expect(legend).toHaveClass(/legend--more/)
  })

  /**
   * Punkt 3 der Empfehlung: Der eingeklappte Griff sagte „Zone 29 ·
   * einblenden" — den Weg zur Antwort statt der Antwort. Jetzt steht sie
   * selbst dort, mit denselben Wörtern wie im Panel: Zonenname aus
   * `zone-label.ts`, Statuswort und Betrag aus `format.ts`. Der Test liest
   * beides aus dem Panel und verlangt den Griff als dessen Abschrift, statt
   * die Wörter ein drittes Mal hinzuschreiben.
   */
  /**
   * Der Tablet-Befund aus „Verbleibende Probleme": Bei 768 Pixeln bleiben der
   * Karte neben der Seitenleiste 372 Pixel, und der ausgeklappte
   * Quellenstreifen (201 Pixel) lag über dem untersten Chip. Eingeklappt ist
   * er ein „i" von 36 Pixeln. Auf dem Desktop bleibt er ausgeklappt, bis die
   * Karte berührt wird — so wie MapLibre es vorsieht.
   */
  test('klappt die Quellenangabe überall ein, auch auf dem Desktop', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'Die Breite wird hier selbst gesetzt.')
    await page.setViewportSize({ width: 768, height: 1024 })
    await ready(page)
    const attrib = page.locator('.maplibregl-ctrl-attrib')
    await expect(attrib).not.toHaveClass(/maplibregl-compact-show/)
    // Und der Streifen steht nicht mehr über der Chip-Zeile.
    await page.getByRole('button', { name: /Ebenen/ }).click()
    const chips = await page.locator('.legend').boundingBox()
    const info = await attrib.boundingBox()
    expect(info!.x).toBeGreaterThanOrEqual(chips!.x + chips!.width - 1)

    // Seit dem 9. September abends auch auf dem Desktop zu: Der Betreiber
    // will das „i" nie ausgefahren sehen; wer die Quellen will, tippt.
    await page.setViewportSize({ width: 1280, height: 860 })
    await ready(page)
    await expect(page.locator('.maplibregl-ctrl-attrib')).not.toHaveClass(/maplibregl-compact-show/)
  })

  /**
   * Die „kaputte Pille" vom iPhone des Betreibers, 9. September: Die
   * Handy-Regel macht das „i" 36 Pixel gross, MapLibre rechnet die Pille mit
   * 24. Zugeklappt ragte der Knopf 12 Pixel links aus Pille und Schirm,
   * aufgeklappt 8 Pixel rechts aus der Pille. Gehalten wird die Geometrie:
   * Der Knopf liegt in der Pille, die Pille im Schirm — in beiden Zuständen.
   */
  test('hält das „i" der Quellenangabe in der Pille und im Schirm', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'phone', 'Nur der grobe Zeiger vergrössert das „i".')
    await ready(page)
    const pille = page.locator('.maplibregl-ctrl-attrib')
    const knopf = page.locator('.maplibregl-ctrl-attrib-button')
    const drin = async (): Promise<void> => {
      const p = (await pille.boundingBox())!
      const k = (await knopf.boundingBox())!
      expect(p.x).toBeGreaterThanOrEqual(0)
      expect(k.x).toBeGreaterThanOrEqual(p.x)
      expect(k.x + k.width).toBeLessThanOrEqual(p.x + p.width + 0.5)
      expect(k.y).toBeGreaterThanOrEqual(p.y)
      expect(k.y + k.height).toBeLessThanOrEqual(p.y + p.height + 0.5)
      expect(k.width).toBeGreaterThanOrEqual(36)
    }
    await expect(pille).not.toHaveClass(/maplibregl-compact-show/)
    await drin()
    await knopf.click()
    await expect(pille).toHaveClass(/maplibregl-compact-show/)
    await expect(page.locator('.maplibregl-ctrl-attrib-inner')).toBeVisible()
    await drin()
  })

  test('trägt im eingeklappten Griff Zone, Status und Betrag', async ({ page }) => {
    // Dienstag 10:30 Berliner Zeit: die Stunde, in der jede Zone kassiert —
    // damit sicher ein Betrag zu sehen ist, nicht nur meistens.
    await page.clock.setFixedTime(new Date('2026-09-08T10:30:00+02:00'))
    await ready(page)
    await openPanel(page)
    await page.locator('.search__input').fill('Mitte')
    await page.locator('.search__results button').first().click()
    const title = page.locator('#zone-panel-title')
    await expect(title).toBeVisible()

    const zone = (await title.textContent())!.replace(/^Parkzone /, 'Zone ')
    const status = (await page.locator('.panel__head .badge').textContent())!.trim()
    const cost = (await page.locator('.cost strong').first().textContent())!.trim()
    expect(status).toBe('gebührenpflichtig')
    expect(cost).toMatch(/€$/)

    await page.locator('.panel-toggle').click()
    await expect(page.locator('.sidebar__body')).toBeHidden()
    const label = page.locator('.panel-toggle__label')
    await expect(label).toHaveText(`${zone} · ${status} · ${cost}/Std.`)
    // Eine Zeile, auch auf 320 Pixeln: Was nicht passt, wird abgeschnitten,
    // statt den Griff höher zu machen.
    const box = await label.boundingBox()
    expect(box!.height).toBeLessThan(28)
  })
})

test.describe('der Meldeknopf auf dem Handy', () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== 'phone', 'Die Lage über dem Blatt gibt es nur auf dem Handy.')
  })

  /**
   * Oben rechts unter dem Zahnrad, seit dem 9. September abends: Der Knopf
   * gehört zur Kopfzeile, die ihn mitmisst, und die Chips stehen darunter —
   * auch auf 320 Pixeln, wo die erste Chip-Zeile fast die Breite füllt.
   */
  test('steht unter dem Zahnrad und schiebt die Chips unter sich', async ({ page }) => {
    await ready(page)
    const fab = (await page.locator('.report-fab').boundingBox())!
    const gear = (await page.getByRole('button', { name: 'Einstellungen' }).boundingBox())!
    const overlay = (await page.locator('.overlay').boundingBox())!
    const size = page.viewportSize()!
    expect(fab.y).toBeGreaterThanOrEqual(gear.y + gear.height)
    expect(fab.x + fab.width).toBeLessThanOrEqual(size.width)
    expect(overlay.y).toBeGreaterThanOrEqual(fab.y + fab.height)
  })
})

test.describe('die Safe-Area des iPhones', () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== 'phone', 'Einrückungen gibt es nur auf dem Handy.')
  })

  /**
   * Der Betreiber, 9. September, mit Bildschirmfoto: Chips im Suchfeld,
   * Meldeknopf auf dem Griff, Karte unter der Pille. Ursache: Die Safe-Area
   * kommt in der abgelegten App als Padding und erst nach dem ersten Layout
   * — und ein ResizeObserver meldet in der Vorgabe nur die Content-Box. Die
   * gemessenen Variablen blieben bei 64 und 48 Pixeln stehen. Chromium kann
   * die Einrückung über CDP nachstellen; hier kommt sie absichtlich **nach**
   * dem Laden.
   */
  test('folgt einer Einrückung, die erst nach dem Laden kommt', async ({ page, context }) => {
    await ready(page)
    const cdp = await context.newCDPSession(page)
    await cdp.send('Emulation.setSafeAreaInsetsOverride', {
      insets: { top: 59, left: 0, bottom: 34, right: 0 },
    })
    await page.waitForTimeout(400)

    const box = async (s: string) => (await page.locator(s).first().boundingBox())!
    const topbar = await box('.topbar')
    const overlay = await box('.overlay')
    // Die Kopfzeile ist gewachsen, die Chips stehen darunter, nicht darin.
    expect(topbar.height).toBeGreaterThan(100)
    expect(overlay.y).toBeGreaterThanOrEqual(topbar.y + topbar.height)

    const toggle = await box('.panel-toggle')
    const fab = await box('.report-fab')
    const size = page.viewportSize()!
    // Der Griff reicht blau bis zur Kante, und der Meldeknopf steht über ihm.
    expect(Math.round(toggle.y + toggle.height)).toBe(size.height)
    expect(fab.y + fab.height).toBeLessThanOrEqual(toggle.y)
  })
})

test.describe('die Seite zoomt nicht, nur die Karte', () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== 'phone', 'Nur der grobe Zeiger zoomt beim Fokus.')
  })

  /**
   * Der Betreiber, 9. September: „Ich kann in den Layer zoomen, der bleibt
   * dann in dem Zustand" und „wenn ich das Suchfeld nutze, wird reingezoomt".
   * Ersteres hält die Viewport-Angabe, letzteres die Schriftgrösse: iOS
   * zoomt in jedes Feld unter 16 Pixeln hinein.
   */
  test('sperrt das Aufziehen der Seite und hält Eingabefelder bei 16 Pixeln', async ({ page }) => {
    await ready(page)
    const viewport = await page.locator('meta[name="viewport"]').getAttribute('content')
    expect(viewport).toContain('maximum-scale=1')
    expect(viewport).toContain('user-scalable=no')
    const size = async (s: string) =>
      Number.parseFloat(await page.locator(s).first().evaluate((el) => getComputedStyle(el).fontSize))
    expect(await size('.search__input')).toBeGreaterThanOrEqual(16)
    await page.getByRole('button', { name: 'Kontrolle melden' }).click()
    expect(await size('.sheet__search')).toBeGreaterThanOrEqual(16)
    expect(await page.locator('body').evaluate((el) => getComputedStyle(el).touchAction)).toBe('pan-x pan-y')
  })
})

test.describe('die Live-Zahlen als eine Karte', () => {
  /**
   * Der Betreiber, 9. September, mit Bildschirmfoto: fünf Pillen in vier
   * Zeilen, „sieht UI/UX-mässig nicht perfekt aus". Jetzt eine Karte mit
   * drei Spalten — und sie bleibt auf 320 Pixeln schmaler als die Karte.
   */
  test('zeigt drei Kennzahlen in einer Reihe, nicht fünf Pillen untereinander', async ({ page }, testInfo) => {
    if (testInfo.project.name === 'phone') await page.setViewportSize({ width: 320, height: 568 })
    await ready(page)
    const live = page.locator('.live')
    await expect(live.locator('.live__item')).toHaveCount(3)
    const boxes = await live.locator('.live__item').evaluateAll((els) => els.map((el) => el.getBoundingClientRect().top))
    // Alle drei auf einer Höhe: keine Zeile bricht.
    expect(Math.max(...boxes) - Math.min(...boxes)).toBeLessThan(2)
    const box = (await live.boundingBox())!
    expect(box.width).toBeLessThanOrEqual(page.viewportSize()!.width - 24)
    await expect(live).toContainText('kassieren')
    await expect(live).not.toContainText('heute')
  })
})
