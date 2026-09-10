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

/** Das Meldungen-Blatt hinter der Karte unten links (seit dem 9. September nachts). */
async function openReports(page: Page): Promise<void> {
  // Mit offenem Blatt ist die Karte auf dem Handy weg (`docs/design.md`,
  // Abschnitt 8); also erst zu, dann öffnen.
  const body = page.locator('.sidebar__body')
  if (await body.isVisible()) {
    await page.locator('.panel-toggle').click()
    await expect(body).toBeHidden()
    await page.waitForTimeout(300)
  }
  await page.locator('.reports-card').click()
  await expect(page.getByRole('dialog', { name: 'Meldungen' })).toBeVisible()
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
    await page.locator('.fab').click()
    const dialog = page.getByRole('dialog', { name: 'Sichtung melden' })
    await expect(dialog).toBeVisible()
    await page.goBack()
    await expect(dialog).toHaveCount(0)
  })

  /**
   * Android-Audit vom 10. September, A-001 bis A-003 und A-012: Bei offenem
   * Ebenen-Menü, offenem Meldungen-Blatt, halb offenem Detail-Blatt und
   * offenen Suchtreffern verliess „Zurück" die App (`about:blank`) — und
   * beim Meldungen-Blatt ging der Eintrag, das Blatt blieb.
   */
  test('schließt über Zurück das Ebenen-Menü, das Meldungen-Blatt und die Suchtreffer', async ({ page }) => {
    await ready(page)
    await page.getByRole('button', { name: /Ebenen/ }).click()
    await expect(page.locator('.legend--open')).toBeVisible()
    await page.goBack()
    await expect(page.locator('.legend--open')).toHaveCount(0)
    expect(new URL(page.url()).pathname).toBe('/')

    await openReports(page)
    const meldungen = page.getByRole('dialog', { name: 'Meldungen' })
    await page.goBack()
    await expect(meldungen).toHaveCount(0)
    await expect.poll(() => page.evaluate(() => history.state)).toBeNull()
    expect(new URL(page.url()).pathname).toBe('/')

    await page.locator('.search__input').fill('Mitte')
    await expect(page.locator('.search__results')).toBeVisible()
    await page.goBack()
    await expect(page.locator('.search__results')).toHaveCount(0)
    expect(new URL(page.url()).pathname).toBe('/')
  })

  test('schließt über Zurück das Detail-Blatt — ein Eintrag je Öffnen, nicht je Zone', async ({ page }, testInfo) => {
    await ready(page)
    const body = page.locator('.sidebar__body')
    if (testInfo.project.name === 'desktop') {
      // Die Seitenleiste steht auf dem Desktop beim Start offen — ohne
      // Eintrag, sonst schlösse „Zurück" erst sie und dann die Seite.
      await expect(body).toBeVisible()
      expect(await page.evaluate(() => history.state)).toBeNull()
      return
    }
    await page.locator('.panel-toggle').click()
    await expect(body).toBeVisible()
    expect(await page.evaluate(() => history.state)).not.toBeNull()
    // Ein zweiter Zonentipp legt keinen zweiten Eintrag an.
    const laenge = await page.evaluate(() => history.length)
    await page.locator('.search__input').fill('Mitte')
    await page.locator('.search__results button').first().click()
    await expect(page.locator('#zone-panel-title')).toBeVisible()
    expect(await page.evaluate(() => history.length)).toBe(laenge)
    await page.goBack()
    await expect(body).toBeHidden()
    expect(new URL(page.url()).pathname).toBe('/')
    await expect.poll(() => page.evaluate(() => history.state)).toBeNull()
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
    // Das Blatt fährt seit dem 9. September nachts in 220 ms auf; gemessen
    // wird, wenn es steht.
    await page.waitForTimeout(400)
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

  test('lässt die Kopfzeile bei einer Zeile', async ({ page }) => {
    await ready(page)
    const topbar = await page.locator('.topbar').boundingBox()
    // Suchfeld, Beta-Marke und Zahnrad in einer Zeile. 112 Pixel waren es
    // einmal — und 116 noch einmal am 9. September abends, als der
    // Meldeknopf kurz eine eigene Zeile bekam.
    expect(topbar!.height).toBeLessThan(80)
    await expect(page.locator('.live')).toContainText('heute')
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
   * Punkt 2 der Empfehlung war ein Verlauf am Rand der seitlich scrollenden
   * Chip-Zeile. Der Betreiber schickte am 9. September abends ein Foto, auf
   * dem der Verlauf ein dunkler Block auf dem letzten Chip war und
   * „Behindertenparkplätze" auf drei Buchstaben endete. Seitdem sind die
   * Ebenen ein Menü unter dem Knopf: Es wächst nach unten, schneidet nichts
   * ab und verbreitert die Zeile nicht. Auf dem Desktop liegt die Zeile
   * unten links, dort öffnet es nach oben.
   */
  test('öffnet die Ebenen als Menü, das nichts abschneidet', async ({ page }, testInfo) => {
    if (testInfo.project.name === 'phone') await page.setViewportSize({ width: 320, height: 568 })
    await ready(page)
    const size = page.viewportSize()!
    // Zu: kein Menü, keine Box, die Karte darunter ist frei.
    await expect(page.locator('.legend__layers')).toBeHidden()
    const toggle = (await page.locator('.legend__toggle').boundingBox())!
    await page.getByRole('button', { name: /Ebenen/ }).click()
    const menu = page.locator('.legend__layers')
    await expect(menu).toBeVisible()
    const rows = page.locator('.legend__layers .chip')
    expect(await rows.count()).toBeGreaterThan(1)
    const box = (await menu.boundingBox())!
    // Ganz im Schirm, und jede Zeile ganz im Menü — kein Name endet auf „Abs".
    expect(box.x).toBeGreaterThanOrEqual(0)
    expect(box.x + box.width).toBeLessThanOrEqual(size.width)
    expect(box.y + box.height).toBeLessThanOrEqual(size.height)
    for (const row of await rows.all()) {
      const r = (await row.boundingBox())!
      expect(r.x + r.width).toBeLessThanOrEqual(box.x + box.width)
      expect(await row.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true)
      if (testInfo.project.name === 'phone') expect(r.height).toBeGreaterThanOrEqual(40)
    }
    // Unter dem Knopf, auf jedem Gerät — die Spalte hängt seit dem
    // 9. September nachts überall unter der Kopfzeile.
    expect(box.y).toBeGreaterThanOrEqual(toggle.y + toggle.height)

    // Auch über dem offenen Blatt: Die volle Suite fand am 9. September,
    // dass „P+R" hinter dem Griff lag und nicht zu treffen war.
    if (testInfo.project.name === 'phone') {
      await openPanel(page)
      const last = rows.last()
      await expect(last).toBeVisible()
      await last.click({ trial: true })
      // Der Griff liegt jetzt unter dem Menü; erst das Menü zu, dann das Blatt.
      await page.getByRole('button', { name: /Ebenen/ }).click()
      await expect(menu).toBeHidden()
      await page.locator('.panel-toggle').click()
      await expect(page.locator('.sidebar__body')).toBeHidden()
      await page.getByRole('button', { name: /Ebenen/ }).click()
      await expect(menu).toBeVisible()
    }
    // Ein Tipp auf die Karte schliesst es, ein zweiter auf „Ebenen" auch.
    // (160, 375): unter dem Menü (bis 354), über der Meldungen-Karte (ab
    // 397), links der Kreise — auf 320 × 568 gemessen, auf dem Desktop frei.
    await page.locator('.map canvas').click({ position: { x: 160, y: 375 } })
    await expect(menu).toBeHidden()
    await page.getByRole('button', { name: /Ebenen/ }).click()
    await expect(menu).toBeVisible()
    await page.getByRole('button', { name: /Ebenen/ }).click()
    await expect(menu).toBeHidden()
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
    // Und der Streifen steht nicht im Ebenen-Menü: das eine oben rechts
    // unter dem Zahnrad, das andere unten links.
    await page.getByRole('button', { name: /Ebenen/ }).click()
    const menu = (await page.locator('.legend__layers').boundingBox())!
    const info = (await attrib.boundingBox())!
    expect(info.y).toBeGreaterThanOrEqual(menu.y + menu.height)

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
      // 24 Pixel, seit dem 9. September nachts: klein wie bei FreiFahren.
      expect(k.width).toBeGreaterThanOrEqual(24)
    }
    await expect(pille).not.toHaveClass(/maplibregl-compact-show/)
    await drin()
    await knopf.click()
    await expect(pille).toHaveClass(/maplibregl-compact-show/)
    await expect(page.locator('.maplibregl-ctrl-attrib-inner')).toBeVisible()
    await drin()
  })

  test('trägt im eingeklappten Griff Zone, Status und Betrag', async ({ page }, testInfo) => {
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
    // Der Griff selbst bleibt eine Zeile hoch, und der Ziehgriff ist ein
    // 32-Pixel-Balken, keine Linie über die ganze Breite (Android-Audit
    // A-013, A-014).
    const grip = (await page.locator('.panel-toggle').boundingBox())!
    expect(grip.height).toBeLessThan(60)
    if (testInfo.project.name !== 'phone') return
    const balken = await page.locator('.panel-toggle__grip').evaluate((el) => {
      const s = getComputedStyle(el, '::before')
      return { width: s.width, display: s.display }
    })
    expect(balken).toEqual({ width: '32px', display: 'block' })
  })
})

test.describe('der Meldeknopf auf dem Handy', () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== 'phone', 'Die Lage über dem Blatt gibt es nur auf dem Handy.')
  })

  /**
   * Seit dem 9. September nachts (`docs/design.md`): Zahnrad rechts neben der
   * Suche, der Ebenen-Knopf darunter am rechten Rand, die Kennzahlen-Leiste
   * daneben bis zum Rand — und der Meldeknopf ist der rote Kreis unten
   * rechts über dem Standort. Auf 320 Pixeln bleibt alles im Schirm.
   */
  test('Zahnrad, Ebenen-Knopf und Leiste stehen auf 320 Pixeln im Raster', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 568 })
    await ready(page)
    const gear = (await page.getByRole('button', { name: 'Einstellungen' }).boundingBox())!
    const ebenen = (await page.locator('.legend__toggle').boundingBox())!
    const live = (await page.locator('.live').boundingBox())!
    const fab = (await page.locator('.fab').boundingBox())!
    // Ebenen rechts unter dem Zahnrad, bündig; die Leiste links daneben.
    expect(Math.abs(ebenen.x + ebenen.width - (gear.x + gear.width))).toBeLessThan(2)
    expect(ebenen.y).toBeGreaterThanOrEqual(gear.y + gear.height)
    expect(Math.abs(live.y - ebenen.y)).toBeLessThan(2)
    expect(live.x + live.width).toBeLessThanOrEqual(ebenen.x)
    expect(ebenen.width).toBeGreaterThanOrEqual(44)
    // Der Ebenen-Knopf trägt kein Wort, nur das Symbol.
    expect((await page.locator('.legend__toggle').innerText()).trim()).toBe('')
    expect(fab.x + fab.width).toBeLessThanOrEqual(320)

    // Offen liegt das Menü unter dem Knopf, rechtsbündig, und im Schirm.
    await page.getByRole('button', { name: /Ebenen/ }).click()
    const menu = (await page.locator('.legend__layers').boundingBox())!
    expect(menu.y).toBeGreaterThanOrEqual(ebenen.y + ebenen.height)
    expect(Math.abs(menu.x + menu.width - (ebenen.x + ebenen.width))).toBeLessThan(2)
    expect(menu.x).toBeGreaterThanOrEqual(0)
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
    const fab = await box('.fab')
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
    // Lokal zwei Spalten (Meldungen heute, „nur dieses Gerät"), geteilt drei.
    await expect(live.locator('.live__item')).toHaveCount(2)
    const boxes = await live.locator('.live__item').evaluateAll((els) => els.map((el) => el.getBoundingClientRect().top))
    // Alle drei auf einer Höhe: keine Zeile bricht.
    expect(Math.max(...boxes) - Math.min(...boxes)).toBeLessThan(2)
    const box = (await live.boundingBox())!
    expect(box.width).toBeLessThanOrEqual(page.viewportSize()!.width - 24)
    await expect(live).toContainText('Meldungen heute')
    await expect(live).not.toContainText('kassieren')
  })
})

test.describe('das Querformat auf dem Handy', () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== 'phone', 'Gedreht wird nur das Handy.')
  })
  test.use({ viewport: { width: 852, height: 393 } })

  /**
   * Der Betreiber, 9. September: „Im Querformat ist die Seite ja
   * schrecklich!" Gemessen auf 852×393 mit je 59 Pixeln Safe-Area seitlich:
   * Suchfeld auf „Zone oder Bezir" gestutzt, Live-Karte und Meldeknopf unten
   * links auf dem Standort-Knopf, das „i" der Quellenangabe auf dem
   * Standort-Knopf, offene Chips über der Karte. Verhindern lässt sich das
   * Drehen nur in der abgelegten Android-App (`orientation` im Manifest);
   * Safari dreht immer. Also drei Spalten: Leiste links, Karte, Blatt rechts.
   */
  test('drei Spalten, und keine zwei Knöpfe aufeinander', async ({ page, context }) => {
    await ready(page)
    const cdp = await context.newCDPSession(page)
    await cdp.send('Emulation.setSafeAreaInsetsOverride', {
      insets: { top: 0, left: 59, bottom: 21, right: 59 },
    })
    await page.waitForTimeout(400)
    // Rechts von Leiste und Meldungen-Karte, links vom Blatt.
    await page.locator('.map canvas').click({ position: { x: 440, y: 250 } })
    await expect(page.locator('.panel__title').first()).toBeVisible()
    await page.getByRole('button', { name: /Ebenen/ }).click()
    await expect(page.locator('.legend--open')).toBeVisible()

    const box = async (s: string) => (await page.locator(s).first().boundingBox())!
    const overlap = (a: { x: number; y: number; width: number; height: number }, b: typeof a) =>
      a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height

    const search = await box('.search__input')
    // Das Suchfeld trägt seinen Platzhalter ganz, 16 Pixel Schrift eingerechnet.
    expect(search.width).toBeGreaterThanOrEqual(180)

    const sidebar = await box('.sidebar')
    const overlay = await box('.overlay')
    const fab = await box('.fab')
    const locate = await box('.locate')
    const attrib = await box('.maplibregl-ctrl-attrib')
    const size = page.viewportSize()!
    // Leiste links, Blatt rechts, dazwischen bleibt Karte.
    expect(overlay.x + overlay.width).toBeLessThan(sidebar.x - 40)
    expect(sidebar.x + sidebar.width).toBeLessThanOrEqual(size.width - 59)
    // Der Meldeknopf steht über dem Standort, beide links vom Blatt.
    expect(fab.y + fab.height).toBeLessThanOrEqual(locate.y + 1)
    expect(fab.x + fab.width).toBeLessThanOrEqual(sidebar.x)
    // Sechs Dinge, von denen vorher je zwei aufeinanderlagen.
    const card = await box('.reports-card')
    const named = { overlay, locate, attrib, sidebar, fab, card }
    const keys = Object.keys(named) as (keyof typeof named)[]
    for (const a of keys) for (const b of keys) if (a < b) expect(overlap(named[a], named[b]), `${a} über ${b}`).toBe(false)
  })
})
