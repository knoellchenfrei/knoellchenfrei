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

  test('lässt die Kopfzeile bei einer Zeile', async ({ page }) => {
    await ready(page)
    const topbar = await page.locator('.topbar').boundingBox()
    // Suchfeld plus Ränder; die zweite Zeile mit Marke, Zahl und Standort ist
    // weg. 112 Pixel waren es vorher.
    expect(topbar!.height).toBeLessThan(80)
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
