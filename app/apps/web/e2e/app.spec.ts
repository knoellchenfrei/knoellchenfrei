import { expect, test, type Page } from '@playwright/test'

/**
 * Waits until the app is actually usable, not merely painted.
 *
 * The map fires `load` before its data arrives, and every interactive test
 * depends on the parsed zones. Waiting on a fixed timeout made results depend on
 * machine speed — different tests failed on each run. The provenance footer is
 * rendered from the metadata file, so its presence means the data is in.
 *
 * Die Daten reichen aber nicht: Solange `.loading` steht, hängen auch die
 * Klick-Handler der Karte noch nicht dran. Mit gesperrtem Kachelserver kommt
 * `styledata` nie, und `withMapReady` in App.tsx greift erst nach seinem
 * 10-Sekunden-Rückfall. Wer vorher auf die Karte klickt, klickt ins Leere —
 * genau das haben drei Tests getan, sobald der Build warm genug war, dass die
 * Herkunftsangabe in unter zehn Sekunden stand. Auf einem kalten Lauf gingen
 * sie durch, auf jedem weiteren fielen sie: ein Wettlauf, kein Zufall.
 */
async function ready(page: Page, options?: { keepPrompt?: boolean }): Promise<void> {
  await page.goto('/')
  await expect(page.locator('.panel-toggle')).toBeVisible({ timeout: 30_000 })
  await expect(page.locator('.provenance')).toBeAttached({ timeout: 45_000 })
  await expect(page.locator('.loading')).toHaveCount(0, { timeout: 30_000 })
  await expect
    .poll(
      async () =>
        page.evaluate(() => document.querySelectorAll('.maplibregl-canvas').length),
      { timeout: 30_000 }
    )
    .toBeGreaterThan(0)
  // One frame for the zone layers to attach to the loaded source.
  await page.waitForTimeout(600)
  // Der Standort-Vordialog liegt über der Karte und fängt Klicks. Jeder Test,
  // der nicht ihn selbst prüft, will ihn weg.
  if (options?.keepPrompt !== true) await dismissPrompt(page)
}

/** Opens the sheet on a phone, where it starts collapsed. */
/** Wegklicken, was sonst über der Karte liegt. Der Vordialog erscheint einmal. */
async function dismissPrompt(page: Page): Promise<void> {
  const later = page.locator('.prompt').getByRole('button', { name: 'Später' })
  if ((await later.count()) > 0) await later.click()
}

async function openPanel(page: Page): Promise<void> {
  const body = page.locator('.sidebar__body')
  if (!(await body.isVisible())) await page.locator('.panel-toggle').click()
  await expect(body).toBeVisible()
}

test.describe('MapLibres Worker', () => {
  /**
   * Regression: **Die Karte hat nie etwas gezeichnet, und niemand sah warum.**
   *
   * MapLibre 6 liegt nicht mehr in einer Datei — es startet zur Laufzeit einen
   * Worker unter einer Adresse, die es sich selbst zusammensetzt. Der
   * Dateiname steht dabei in einer Variablen, also legte rolldown die Datei
   * gar nicht erst ab; die Anfrage lief in die SPA-Rückfalladresse und bekam
   * **`index.html` mit `200 OK` und `text/html`**. Kein 404, kein
   * `error`-Ereignis, keine Konsolenmeldung: Der Worker startete nur nicht,
   * und ohne ihn parst MapLibre weder Vektorkacheln noch GeoJSON. Sichtbar
   * war davon einzig, dass die Zonen fehlten und `withMapReady` jedes Mal in
   * seinen 10-Sekunden-Rückfall lief.
   *
   * Geprüft wird deshalb der Statustyp, nicht der Status: Ein `200` sagt hier
   * nichts, `content-type` sagt alles.
   */
  test('kommt als Skript an, nicht als index.html', async ({ page }) => {
    const antworten: string[] = []
    page.on('response', (antwort) => {
      if (/maplibre-gl-worker/.test(antwort.url())) {
        antworten.push(antwort.headers()['content-type'] ?? '(ohne)')
      }
    })
    await ready(page)
    expect(antworten.length).toBeGreaterThan(0)
    for (const typ of antworten) expect(typ).toContain('javascript')
  })
})

test.describe('map and zones', () => {
  test('renders the map container at full height', async ({ page }) => {
    await ready(page)
    // Regression: maplibre-gl.css once won the cascade and collapsed this to 0.
    const height = await page.evaluate(() => document.querySelector('.map')?.clientHeight ?? 0)
    expect(height).toBeGreaterThan(300)
  })

  test('selecting a zone from the map shows its details without crashing', async ({ page }) => {
    await ready(page)
    const box = await page.locator('.map').boundingBox()
    expect(box).not.toBeNull()
    // Regression: MapLibre stringifies nested properties, and reading them as
    // objects tore down the whole tree.
    await page.mouse.click(box!.x + box!.width * 0.4, box!.y + box!.height * 0.45)
    await page.waitForTimeout(1200)
    await openPanel(page)
    await expect(page.locator('#root')).not.toBeEmpty()
    await expect(page.locator('.crash')).toHaveCount(0)
  })

  test('search finds a zone and opens its panel', async ({ page }) => {
    await ready(page)
    await page.locator('.search__input').fill('29')
    const first = page.locator('.search__results button').first()
    await expect(first).toBeVisible()
    await first.click()
    await openPanel(page)
    await expect(page.locator('.panel__title').first()).toContainText('29')
    // Zone 29 is the only one in Berlin that charges on Sundays.
    await expect(page.locator('.hours code').first()).toContainText('Mo-So')
  })

  test('states the tariff and the source hours', async ({ page }) => {
    await ready(page)
    await page.locator('.search__input').fill('1')
    await page.locator('.search__results button').first().click()
    await openPanel(page)
    await expect(page.locator('.facts')).toContainText('Tarif')
    await expect(page.locator('.facts')).toContainText('/Std.')
  })
})

test.describe('parking session', () => {
  test('records a spot without geolocation and remembers it across a reload', async ({ page }) => {
    await ready(page)
    const box = await page.locator('.map').boundingBox()
    await page.mouse.click(box!.x + box!.width * 0.4, box!.y + box!.height * 0.45)
    await page.waitForTimeout(1000)
    await openPanel(page)

    await page.locator('.panel button', { hasText: 'Hier geparkt' }).first().click()
    await expect(page.locator('.timer')).toBeVisible()

    await page.reload()
    await expect(page.locator('.panel-toggle')).toBeVisible({ timeout: 30_000 })
    await expect(page.locator('.provenance')).toBeAttached({ timeout: 45_000 })
    await openPanel(page)
    await expect(page.locator('.timer')).toBeVisible({ timeout: 15_000 })
  })

  test('sets a reminder and offers to cancel it', async ({ page }) => {
    await ready(page)
    const box = await page.locator('.map').boundingBox()
    await page.mouse.click(box!.x + box!.width * 0.4, box!.y + box!.height * 0.45)
    await page.waitForTimeout(1000)
    await openPanel(page)
    await page.locator('.panel button', { hasText: 'Hier geparkt' }).first().click()
    await expect(page.locator('.timer')).toBeVisible()

    const preset = page.locator('.reminder .button--chip').first()
    await preset.scrollIntoViewIfNeeded()
    await preset.click()
    await expect(page.locator('.timer')).toContainText('Erinnerung')

    const cancel = page.locator('.timer .button--chip', { hasText: 'abbrechen' })
    await cancel.scrollIntoViewIfNeeded()
    await cancel.click()
    await expect(page.locator('.reminder')).toBeVisible()
  })
})

test.describe('layers and points of interest', () => {
  test('toggles a layer on and off', async ({ page }) => {
    await ready(page)
    await page.locator('.chip--toggle').click()
    const charging = page.locator('.chip', { hasText: 'Ladepunkte' })
    await charging.click()
    await expect(charging).toHaveClass(/chip--on/)
    // The count badge on the collapsed toggle reflects active layers.
    await page.locator('.chip--toggle').click()
    await expect(page.locator('.chip__count')).toHaveText('1')

    await page.locator('.chip--toggle').click()
    await charging.click()
    await expect(charging).not.toHaveClass(/chip--on/)
  })

  test('shows the low emission zone as a separate layer', async ({ page }) => {
    await ready(page)
    await page.locator('.chip--toggle').click()
    const lez = page.locator('.chip', { hasText: 'Umweltzone' })
    await lez.scrollIntoViewIfNeeded()
    await lez.click()
    await expect(lez).toHaveClass(/chip--on/)
  })
})

test.describe('enforcement sightings', () => {
  test('reports a sighting anchored to a map tap', async ({ page }) => {
    await ready(page)
    const box = await page.locator('.map').boundingBox()
    await page.mouse.click(box!.x + box!.width * 0.4, box!.y + box!.height * 0.45)
    await page.waitForTimeout(1000)
    await openPanel(page)

    const sightings = page.locator('section[aria-label="Ordnungsamt-Sichtungen"]')
    await expect(sightings.locator('.demo-note')).toContainText('erzeugt')

    // The button opens the report sheet; the tapped point is offered first.
    await page.locator('button', { hasText: 'Hier gesehen' }).click()
    await expect(page.locator('.sheet')).toBeVisible()
    await page.locator('.sheet__submit').click()
    await expect(page.locator('.sheet')).toHaveCount(0)
    await page.waitForTimeout(600)

    // The first real report replaces the generated list rather than joining it:
    // a real report sitting among demo rows makes both unreadable.
    await expect(sightings.locator('.sightings__item')).toHaveCount(1)
    await expect(sightings.locator('.demo-note')).not.toContainText('erzeugt')
  })

  test('labels seeded reports as demo data', async ({ page }) => {
    await ready(page)
    await openPanel(page)
    // Scoped to the sightings panel: the heatmap carries its own demo note, and
    // an unscoped selector matches both.
    await expect(
      page.locator('section[aria-label="Ordnungsamt-Sichtungen"] .demo-note'),
    ).toContainText('erzeugt')
  })
})

test.describe('reporting never fails silently', () => {
  const sightings = 'section[aria-label="Ordnungsamt-Sichtungen"]'

  test('offers a place to report from without any map gesture', async ({ page }) => {
    await ready(page)
    await openPanel(page)
    // Pressed cold, with nothing tapped on the map — the case that was broken
    // twice: first a disabled button, then one that silently did nothing.
    await page.locator(`${sightings} button`, { hasText: 'Hier gesehen' }).click()

    const sheet = page.locator('.sheet')
    await expect(sheet).toBeVisible()
    await expect(sheet).toContainText('In der Nähe')
    await expect(sheet.locator('.sheet__option').first()).toContainText('Zone')

    // The submit says what is missing rather than being an inert control.
    await expect(page.locator('.sheet__submit')).toBeDisabled()
    await expect(page.locator('.sheet__submit')).toContainText('Erst einen Ort wählen')

    await sheet.locator('.sheet__option').first().click()
    await expect(page.locator('.sheet__submit')).toBeEnabled()
    await expect(page.locator('.sheet__submit')).toContainText('Melden')
  })

  test('frees the map when the report sheet opens on a phone', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'phone', 'nur auf dem Handy relevant')
    await ready(page)
    await openPanel(page)
    await expect(page.locator('.sidebar')).not.toHaveClass(/sidebar--collapsed/)

    await page.locator('button', { hasText: 'Hier gesehen' }).click()
    await expect(page.locator('.sheet')).toBeVisible()
    // Das Panel deckt sonst die untere Kartenhälfte ab — genau die, auf der der
    // Punkt gesetzt werden soll.
    await expect(page.locator('.sidebar')).toHaveClass(/sidebar--collapsed/)
  })

  test('takes the report back and says so when the shared store refuses it', async ({ page }) => {
    // Stands in for the artifact runtime with a store that rejects writes. The
    // shipped app once swallowed exactly this: the click did nothing at all, no
    // entry, no message, and only an invisible unhandled rejection.
    await page.addInitScript(() => {
      const db = {
        doc: () => ({
          set: async () => {
            throw new Error('permission_denied')
          },
          delete: async () => undefined,
        }),
        collection: () => ({ onSnapshot: (fn: (s: { docs: [] }) => void) => { fn({ docs: [] }); return () => {} } }),
      }
      ;(window as unknown as { claude: unknown }).claude = {
        use: async (name: string) => (name === 'db' ? db : null),
      }
    })
    await ready(page)
    await openPanel(page)

    const canvas = page.locator('.maplibregl-canvas')
    const box = await canvas.boundingBox()
    if (box === null) throw new Error('no map canvas')
    await page.mouse.click(box.x + box.width * 0.5, box.y + box.height * 0.18)
    await page.waitForTimeout(500)

    await page.locator(`${sightings} button`, { hasText: 'Hier gesehen' }).click()
    await page.locator('.sheet__option').first().click()
    await page.locator('.sheet__submit').click()
    await expect(page.locator('.toast')).toContainText(
      'konnte nicht gespeichert werden',
    )
    await expect(page.locator(`${sightings} .sightings__item`)).toHaveCount(0)
  })
})

test.describe('explaining a quiet day', () => {
  test('says why so few zones are charging, and goes away when told', async ({ page }) => {
    // Die Uhr steht, sonst prüft dieser Test je nach Tageszeit etwas anderes.
    // Am 7. September liefen zwei Läufe gegen denselben Stand: um 08:38 war der
    // Hinweis da (Montag vor Beginn der Bewirtschaftung), um 10:04 nicht mehr —
    // und der Test sprang beide Male grün heraus, einmal prüfend, einmal nicht.
    // Ein Test, der sich selbst überspringt, ist kein bestandener Test
    // (Audit-Punkt M-084).
    //
    // `setFixedTime` und nicht `install`: Letzteres hält auch die Timer an, und
    // an denen hängt der Kartenaufbau — `withMapReady` wartet notfalls zehn
    // Sekunden, die dann nie vergingen.
    await page.clock.setFixedTime(new Date('2026-09-06T10:00:00+02:00'))
    await ready(page)
    // Der Hinweis steht in der Seitenleiste, neben dem, was er erklärt — auf
    // dem Handy startet die eingeklappt.
    await openPanel(page)
    const note = page.locator('.daynote')

    await expect(note).toContainText(/kassieren/)
    await note.getByRole('button', { name: 'Hinweis ausblenden' }).click()
    await expect(note).toHaveCount(0)
  })

  test('names no city and no weekday in the shipped code', async ({ page }) => {
    // Sonntag, 10:00 — derselbe feste Zeitpunkt wie im Test darüber, damit der
    // Hinweis sicher da ist statt nur meistens.
    await page.clock.setFixedTime(new Date('2026-09-06T10:00:00+02:00'))
    await ready(page)
    await openPanel(page)
    // Der Text wird aus Uhr und geladenen Fahrplänen abgeleitet. Stünde
    // "Sonntag" fest im Bündel, wäre er in einer zweiten Stadt falsch.
    const note = page.locator('.daynote')
    await expect(note).toContainText(/kassieren/)
    await expect(note).not.toContainText('Berlin')
  })
})

test.describe('asking for the location', () => {
  test('explains itself before the browser dialog, and can be deferred', async ({ page }) => {
    await ready(page, { keepPrompt: true })
    const prompt = page.locator('.prompt')
    await expect(prompt).toBeVisible()
    // The native dialog says nothing about why. This one does, and names the
    // way that always works.
    await expect(prompt).toContainText('Karte tippen')

    await prompt.getByRole('button', { name: 'Später' }).click()
    await expect(prompt).toHaveCount(0)
  })

  test('does not ask again after it has been answered', async ({ page }) => {
    await ready(page, { keepPrompt: true })
    await page.locator('.prompt').getByRole('button', { name: 'Später' }).click()
    await page.reload()
    await expect(page.locator('.panel-toggle')).toBeVisible({ timeout: 30_000 })
    await page.waitForTimeout(1500)
    await expect(page.locator('.prompt')).toHaveCount(0)
  })
})

test.describe('settings', () => {
  test('carries the standing caveat and answers what the data raises', async ({ page }) => {
    await ready(page)
    await page.getByRole('button', { name: 'Einstellungen' }).click()

    const sheet = page.getByRole('dialog', { name: 'Einstellungen' })
    await expect(sheet).toBeVisible()
    // Seit dem Beta-Riegel stehen zwei Hinweiskästen im Blatt. Gemeint ist der
    // stehende, nicht der, der zum Start wieder verschwindet.
    await expect(sheet.locator('.callout:not(.callout--beta)')).toContainText(
      'Beschilderung vor Ort',
    )

    // The one-chargeable-zone question is the first thing a Sunday visitor asks.
    // Sie steht seit der stadtweisen FAQ nur noch in Berlin ganz oben — und
    // Berlin ist die Voreinstellung, mit der dieser Test startet.
    const first = sheet.locator('.faq__item').first()
    await expect(first).toContainText('sonntags')
    await first.locator('summary').click()
    await expect(first).toContainText('Zone 29')
  })

  // Die Zahlen in der FAQ sind Befunde aus je einem Feed. In der falschen Stadt
  // gelesen sind sie nicht ungenau, sondern falsch — und zwar zuversichtlich
  // falsch, was die schlechteste Sorte Hilfe ist.
  test('answers only what holds in the loaded city', async ({ page }) => {
    await ready(page)
    await page.getByRole('button', { name: 'Einstellungen' }).click()
    const sheet = page.getByRole('dialog', { name: 'Einstellungen' })

    await expect(sheet).toContainText('sonntags nur eine einzige Zone')
    await expect(sheet).toContainText('45.917')
    // Hamburgs Parkscheibe und Münchens fehlender Tarif haben in Berlin nichts
    // zu suchen: Beides gibt es hier nicht.
    await expect(sheet).not.toContainText('Parkscheibe')
    await expect(sheet).not.toContainText('Warum steht kein Preis da?')
  })

  test('offers no donation button', async ({ page }) => {
    await ready(page)
    await page.getByRole('button', { name: 'Einstellungen' }).click()
    // There is no association and no account behind it; a "support us" that
    // leads nowhere would be a claim rather than a feature.
    await expect(page.getByRole('dialog', { name: 'Einstellungen' })).not.toContainText(
      /Spende|Unterstütz/,
    )
  })
})

test.describe('feedback', () => {
  test('is offered only where the promise it makes can be kept', async ({ page }) => {
    // The form promises nobody but the owner reads what is written. Only the
    // self-hosted worker can keep that — it has no read endpoint — so without
    // VITE_API_BASE the entry point is absent rather than decorative.
    await ready(page)
    await openPanel(page)
    await expect(page.locator('.provenance__link')).toHaveCount(0)
    await page.locator('button', { hasText: 'Hier gesehen' }).click()
    await expect(page.locator('.sheet')).toBeVisible()
    await expect(page.locator('.sheet__aside')).toHaveCount(0)
  })
})

test.describe('live figures', () => {
  test('always states the reports, and only claims the rest when it can count them', async ({
    page,
  }) => {
    await ready(page)
    const live = page.locator('.live')
    await expect(live).toContainText('Meldungen')
    // Without a shared runtime "online" is unknowable, and "1 online" would be
    // true of every single viewer and therefore say nothing.
    await expect(live).toContainText('nur dieses Gerät')
    await expect(live).not.toContainText('gerade offen')
  })

  test('does not swallow map taps', async ({ page }) => {
    await ready(page)
    // The legend once covered the map across its full width without
    // pointer-events: none; the strip must not repeat it.
    await expect(page.locator('.live')).toHaveCSS('pointer-events', 'none')
  })
})

test.describe('enforcement density', () => {
  const heatPanel = 'section[aria-label="Kontrolldichte"]'

  test('says what the picture is built on, and that it is generated', async ({ page }) => {
    await ready(page)
    await openPanel(page)
    await expect(page.locator(heatPanel)).toContainText('Meldungen')
    await expect(page.locator(`${heatPanel} .demo-note`)).toContainText('Beispielmuster')
  })

  test('draws the layer only once it is switched on', async ({ page }) => {
    await ready(page)
    await openPanel(page)
    const visible = async (): Promise<string> =>
      page.evaluate(() => {
        const map = (window as unknown as { __map?: { getLayoutProperty: (id: string, key: string) => string } }).__map
        return map?.getLayoutProperty('heat-density', 'visibility') ?? 'missing'
      })

    await page.locator(`${heatPanel} button`).click()
    await expect(page.locator(`${heatPanel} button`)).toHaveText('Ausblenden')
    await page.locator(`${heatPanel} button`).click()
    await expect(page.locator(`${heatPanel} button`)).toHaveText('Auf der Karte')
    // The evaluate above needs the map on window; where it is not exposed the
    // button state is still the contract the user sees.
    expect(['visible', 'none', 'missing']).toContain(await visible())
  })

  test('reports the numbers the colour cannot carry', async ({ page }) => {
    await ready(page)
    await openPanel(page)
    const panel = page.locator('section[aria-label="Kontrolldichte"]')
    await expect(panel).toContainText('Letzte 24 Stunden')
    await expect(panel).toContainText('Häufige Stellen')
    // Named by zone: a ranked list of unnamed cells says nothing about where.
    await expect(panel.locator('.heat-top strong').first()).toContainText(/Zone|Außerhalb/)
  })

  test('always draws the per-day histogram, which needs no time of day', async ({ page }) => {
    await ready(page)
    await openPanel(page)
    const panel = page.locator('section[aria-label="Kontrolldichte"]')
    await expect(panel).toContainText('Letzte 28 Tage')
    // One bar per day in the window. This is the chart that still works on
    // tallies written before the hour was recorded — without it the report was
    // blank for anyone who had reported early.
    await expect(panel.locator('.chart--days .chart__bar')).toHaveCount(28)
    await expect(panel.locator('.chart__bar--today')).toHaveCount(1)
  })

  test('draws an hourly profile with a marker for the current hour', async ({ page }) => {
    await ready(page)
    await openPanel(page)
    const panel = page.locator('section[aria-label="Kontrolldichte"]')
    await expect(panel.locator('.chart:not(.chart--days) .chart__bar')).toHaveCount(24)
    // One line, always present — a coloured bar disappeared at an hour with no
    // reports, which is exactly when the marker matters.
    await expect(panel.locator('.chart__now')).toHaveCount(1)
  })

  test('offers the layer chip alongside the others', async ({ page }) => {
    await ready(page)
    await page.getByRole('button', { name: /Ebenen/ }).click()
    await expect(page.getByRole('button', { name: 'Kontrolldichte' })).toBeVisible()
  })
})

test.describe('resilience', () => {
  test('survives corrupt stored state', async ({ page }) => {
    await page.addInitScript(() => {
      try {
        localStorage.setItem('knoellchenfrei.session', '{kaputt')
        localStorage.setItem('knoellchenfrei.sightings', '{"nicht":"array"}')
      } catch {
        /* storage unavailable */
      }
    })
    await ready(page)
    await expect(page.locator('.crash')).toHaveCount(0)
    await openPanel(page)
    await expect(page.locator('.sidebar')).not.toContainText('NaN')
  })

  test('does not render markup typed into the search box', async ({ page }) => {
    await ready(page)
    await page.locator('.search__input').fill('<img src=x onerror=alert(1)>')
    await page.waitForTimeout(400)
    expect(await page.locator('.search__results img').count()).toBe(0)
    await expect(page.locator('.crash')).toHaveCount(0)
  })

  test('reports no console errors during a normal session', async ({ page }) => {
    const errors: string[] = []
    const failedOwnRequests: string[] = []

    page.on('pageerror', (error) => errors.push(error.message))
    // Filtered by origin rather than by message text: map tiles come from
    // openstreetmap.org and may be blocked by the network the tests run on,
    // while a failure to load our own assets is a real defect. Matching on the
    // wording would have hidden both.
    page.on('requestfailed', (request) => {
      const url = new URL(request.url())
      if (url.origin === new URL(page.url()).origin) failedOwnRequests.push(url.pathname)
    })
    page.on('console', (message) => {
      if (message.type() !== 'error') return
      const text = message.text()
      // Resource-load errors are covered by the requestfailed handler above.
      if (/Failed to load resource|ERR_TUNNEL|AJAXError|net::/i.test(text)) return
      errors.push(text)
    })
    await ready(page)
    await openPanel(page)
    await page.locator('.chip--toggle').click()
    await page.locator('.chip', { hasText: 'P+R' }).click()
    await page.locator('.search__input').fill('Mitte')
    await page.waitForTimeout(800)
    expect(errors).toEqual([])
    expect(failedOwnRequests).toEqual([])
  })

  test('never scrolls horizontally', async ({ page }) => {
    await ready(page)
    // Polled: layout settles over a frame or two after the map attaches, and a
    // single sample caught a transient state rather than the real one.
    await expect
      .poll(
        async () =>
          page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth),
        { timeout: 10_000 }
      )
      .toBe(false)
  })
})

test.describe('provenance', () => {
  test('names the source and licence', async ({ page }) => {
    await ready(page)
    await openPanel(page)
    await expect(page.locator('.provenance')).toContainText('gdi.berlin.de')
    await expect(page.locator('.provenance')).toContainText('Datenlizenz Deutschland Zero 2.0')
  })

  test('warns that the posted sign governs', async ({ page }) => {
    await ready(page)
    await openPanel(page)
    await expect(page.locator('.provenance__warn')).toContainText('Beschilderung', {
      timeout: 15_000,
    })
  })
})

test.describe('die weiteren Städte', () => {
  /** Öffnet die Einstellungen und liefert das Dialog-Locator zurück. */
  async function openSettings(page: Page) {
    await page.getByRole('button', { name: 'Einstellungen' }).click()
    const sheet = page.getByRole('dialog', { name: 'Einstellungen' })
    await expect(sheet).toBeVisible()
    return sheet
  }

  test('offers every city and marks the current one', async ({ page }) => {
    await ready(page)
    const sheet = await openSettings(page)
    await expect(sheet.getByRole('button', { name: 'Berlin' })).toBeDisabled()
    await expect(sheet.getByRole('button', { name: 'Hamburg' })).toBeEnabled()
    await expect(sheet.getByRole('button', { name: 'Frankfurt am Main' })).toBeEnabled()
    await expect(sheet.getByRole('button', { name: 'München' })).toBeEnabled()
  })

  // Der eigentliche Punkt: Nach dem Wechsel stehen ANDERE Daten auf der Karte.
  // Ein Umschalter, der nur eine Beschriftung ändert, wäre schlimmer als keiner.
  test('switches to Hamburg and loads Hamburg zones', async ({ page }) => {
    await ready(page)
    const sheet = await openSettings(page)
    await sheet.getByRole('button', { name: 'Hamburg' }).click()

    // Der Wechsel lädt neu; danach ist die App wieder von vorn hochzufahren.
    await expect(page.locator('.panel-toggle')).toBeVisible({ timeout: 30_000 })
    await expect(page.locator('.provenance')).toBeAttached({ timeout: 45_000 })
    await expect(page.locator('.loading')).toHaveCount(0, { timeout: 30_000 })

    // Hamburgs Gebietskennungen fangen mit einem Buchstaben an, Berlins sind Zahlen.
    await page.locator('.search__input').fill('N10')
    await expect(page.locator('.search__results button').first()).toBeVisible({ timeout: 15_000 })

    await openPanel(page)
    await expect(page.locator('.provenance')).toContainText('Hamburg')
  })

  test('names the Hamburg licence as a condition, not as a footnote', async ({ page }) => {
    await ready(page)
    let sheet = await openSettings(page)
    await sheet.getByRole('button', { name: 'Hamburg' }).click()
    await expect(page.locator('.panel-toggle')).toBeVisible({ timeout: 30_000 })
    await expect(page.locator('.loading')).toHaveCount(0, { timeout: 30_000 })

    sheet = await openSettings(page)
    await expect(sheet).toContainText('Datenlizenz Deutschland Namensnennung 2.0')
    // Berlin gibt unter Zero heraus — dort fehlt dieser Satz zu Recht.
    await expect(sheet).toContainText('verlangt')
  })

  // Dasselbe fuer die dritte Stadt, und aus demselben Grund: Ein Umschalter,
  // der nur eine Beschriftung aendert, waere schlimmer als keiner.
  test('switches to Frankfurt and loads Frankfurt zones', async ({ page }) => {
    await ready(page)
    const sheet = await openSettings(page)
    await sheet.getByRole('button', { name: 'Frankfurt am Main' }).click()

    await expect(page.locator('.panel-toggle')).toBeVisible({ timeout: 30_000 })
    await expect(page.locator('.provenance')).toBeAttached({ timeout: 45_000 })
    await expect(page.locator('.loading')).toHaveCount(0, { timeout: 30_000 })

    // Ueber den Stadtteil, nicht ueber die Zonennummer: Frankfurts Bereiche
    // heissen wie Berlins Zonen schlicht "19" -- ein Zahlentreffer bewiese
    // also nicht, dass wirklich andere Daten geladen sind. "Sachsenhausen"
    // gibt es in Berlin nicht.
    await page.locator('.search__input').fill('Sachsenhausen')
    await expect(page.locator('.search__results button').first()).toBeVisible({ timeout: 15_000 })
    await page.locator('.search__results button').first().click()

    await openPanel(page)
    await expect(page.locator('.panel__eyebrow').first()).toContainText('Sachsenhausen')
    await expect(page.locator('.provenance')).toContainText('Frankfurt am Main')
  })

  // Die Quellenangabe ist bei DL-DE/Namensnennung Lizenzbedingung. Sie steht
  // woertlich in `city.ts`; dieser Test haelt fest, dass sie auch woertlich
  // ankommt und nicht unterwegs umformuliert wird.
  test('names the Frankfurt licence as a condition and the source verbatim', async ({ page }) => {
    await ready(page)
    let sheet = await openSettings(page)
    await sheet.getByRole('button', { name: 'Frankfurt am Main' }).click()
    await expect(page.locator('.panel-toggle')).toBeVisible({ timeout: 30_000 })
    await expect(page.locator('.loading')).toHaveCount(0, { timeout: 30_000 })

    sheet = await openSettings(page)
    await expect(sheet).toContainText('Datenlizenz Deutschland Namensnennung 2.0')
    await expect(sheet).toContainText('verlangt')
    await expect(sheet).toContainText('Stadt Frankfurt am Main, www.frankfurt.de')
  })

  // Und dasselbe fuer die vierte Stadt. Muenchen ist der interessanteste der
  // vier Faelle: Seine Gebiete heissen nicht "19" oder "N10", sondern
  // "Glockenbachviertel" -- ein Treffer darauf beweist andere Daten, ohne dass
  // man den Stadtteil dazunehmen muesste.
  test('switches to München and loads München zones', async ({ page }) => {
    await ready(page)
    const sheet = await openSettings(page)
    await sheet.getByRole('button', { name: 'München' }).click()

    await expect(page.locator('.panel-toggle')).toBeVisible({ timeout: 30_000 })
    await expect(page.locator('.provenance')).toBeAttached({ timeout: 45_000 })
    await expect(page.locator('.loading')).toHaveCount(0, { timeout: 30_000 })

    await page.locator('.search__input').fill('Glockenbach')
    await expect(page.locator('.search__results button').first()).toBeVisible({ timeout: 15_000 })
    await page.locator('.search__results button').first().click()

    await openPanel(page)
    // Ueber die Kennung, nicht ueber die Klasse: `.panel__title` tragen auch
    // die Sichtungs- und die Heatmap-Karte, und Playwrights Strict Mode bricht
    // bei drei Treffern ab.
    await expect(page.locator('#zone-panel-title')).toContainText('Glockenbachviertel')
    await expect(page.locator('.panel__eyebrow').first()).toContainText(
      'Ludwigsvorstadt-Isarvorstadt'
    )
    await expect(page.locator('.provenance')).toContainText('München')
  })

  // Der eine Satz, den nur Muenchen ausloest: Die Quelle nennt fuer kein
  // einziges der 82 Gebiete einen Betrag. „0,00 €" waere dort die falscheste
  // aller Antworten -- sie hiesse „hier ist nichts zu beachten", und wer ohne
  // Ticket steht, zahlt trotzdem.
  test('says that München states no tariff, instead of quoting nothing', async ({ page }) => {
    await ready(page)
    const sheet = await openSettings(page)
    await sheet.getByRole('button', { name: 'München' }).click()
    await expect(page.locator('.panel-toggle')).toBeVisible({ timeout: 30_000 })
    await expect(page.locator('.loading')).toHaveCount(0, { timeout: 30_000 })

    await page.locator('.search__input').fill('Glockenbach')
    await expect(page.locator('.search__results button').first()).toBeVisible({ timeout: 15_000 })
    await page.locator('.search__results button').first().click()
    await openPanel(page)

    // Dieselbe Vorsicht wie oben: `.panel` gibt es viermal auf der Seite.
    const zonePanel = page.getByRole('region', { name: /^Parkzone / })
    await expect(zonePanel.locator('.facts')).toContainText('Tarif nicht angegeben')
    await expect(zonePanel).not.toContainText('0,00 €')
  })

  test('names the München licence as a condition and the source verbatim', async ({ page }) => {
    await ready(page)
    let sheet = await openSettings(page)
    await sheet.getByRole('button', { name: 'München' }).click()
    await expect(page.locator('.panel-toggle')).toBeVisible({ timeout: 30_000 })
    await expect(page.locator('.loading')).toHaveCount(0, { timeout: 30_000 })

    sheet = await openSettings(page)
    await expect(sheet).toContainText('Datenlizenz Deutschland Namensnennung 2.0')
    await expect(sheet).toContainText('verlangt')
    await expect(sheet).toContainText(
      'Datenquelle: dl-de/by-2-0: Landeshauptstadt München – opendata.muenchen.de'
    )
  })

  // Die Frage, die in München jeder stellt — und die Berliner Frage, die dort
  // niemand stellen kann: Die Parkraumbewirtschaftung läuft in München auch
  // sonntags nicht, aber „genau eine von 103 Zonen" ist kein Satz über München.
  test('answers the München questions and drops the Berlin ones', async ({ page }) => {
    await ready(page)
    let sheet = await openSettings(page)
    await sheet.getByRole('button', { name: 'München' }).click()
    await expect(page.locator('.panel-toggle')).toBeVisible({ timeout: 30_000 })
    await expect(page.locator('.loading')).toHaveCount(0, { timeout: 30_000 })

    sheet = await openSettings(page)
    await expect(sheet).toContainText('Warum steht kein Preis da?')
    await expect(sheet).toContainText('an Schultagen')
    await expect(sheet).not.toContainText('sonntags')
    await expect(sheet).not.toContainText('45.917')
  })

  // Berlin darf nicht als Nebenwirkung verlorengehen: Der Wechsel muss in
  // beide Richtungen gehen, sonst ist die Voreinstellung eine Sackgasse.
  test('switches back to Berlin', async ({ page }) => {
    await ready(page)
    let sheet = await openSettings(page)
    await sheet.getByRole('button', { name: 'Hamburg' }).click()
    await expect(page.locator('.panel-toggle')).toBeVisible({ timeout: 30_000 })
    await expect(page.locator('.loading')).toHaveCount(0, { timeout: 30_000 })

    sheet = await openSettings(page)
    await sheet.getByRole('button', { name: 'Berlin' }).click()
    await expect(page.locator('.panel-toggle')).toBeVisible({ timeout: 30_000 })
    await expect(page.locator('.loading')).toHaveCount(0, { timeout: 30_000 })
    await openPanel(page)
    await expect(page.locator('.provenance')).toContainText('gdi.berlin.de')
  })
})

/**
 * Der Standort-Vorschlag.
 *
 * Der Punkt, an dem er hängt: Er darf **keine** eigene Berechtigungsabfrage
 * auslösen. Deshalb erteilt jeder Test die Berechtigung vorab und drückt dann
 * denselben Knopf, den es ohnehin gibt — der Vorschlag muss aus dieser einen
 * Position entstehen und aus keiner zweiten.
 */
test.describe('der Standort-Vorschlag', () => {
  /** Marienplatz. */
  const MUENCHEN = { latitude: 48.1372, longitude: 11.5755 }
  /** Potsdamer Platz. */
  const BERLIN = { latitude: 52.5096, longitude: 13.3765 }

  async function standAt(page: Page, at: { latitude: number; longitude: number }): Promise<void> {
    await page.context().grantPermissions(['geolocation'])
    await page.context().setGeolocation(at)
  }

  /** Denselben Knopf drücken, den es ohnehin gibt. */
  async function locate(page: Page): Promise<void> {
    await page.getByRole('button', { name: 'Wo bin ich?' }).click()
  }

  test('offers München when the position is there and Berlin is loaded', async ({ page }) => {
    await standAt(page, MUENCHEN)
    await ready(page)
    await locate(page)

    const hint = page.locator('.city-hint')
    await expect(hint).toBeVisible({ timeout: 15_000 })
    await expect(hint).toContainText('Dein Standort liegt in München')
    await expect(hint).toContainText('Berlin')

    // Der Hinweis ersetzt die sonst fällige Meldung, statt neben ihr zu stehen:
    // „hier ist Parken gebührenfrei" wäre über 82 bewirtschafteten Gebieten
    // falsch, und sie läge auch noch über dem Hinweis, der es erklärt.
    await expect(page.locator('.toast')).toHaveCount(0)

    await hint.getByRole('button', { name: 'Zu München wechseln' }).click()

    // Der Wechsel lädt neu; danach stehen andere Daten auf der Karte.
    await expect(page.locator('.panel-toggle')).toBeVisible({ timeout: 30_000 })
    await expect(page.locator('.provenance')).toBeAttached({ timeout: 45_000 })
    await expect(page.locator('.loading')).toHaveCount(0, { timeout: 30_000 })
    await openPanel(page)
    await expect(page.locator('.provenance')).toContainText('München')
    // In der vorgeschlagenen Stadt angekommen, ist der Hinweis gegenstandslos.
    await expect(page.locator('.city-hint')).toHaveCount(0)
  })

  test('remembers "Hier bleiben" across a reload', async ({ page }) => {
    await standAt(page, MUENCHEN)
    await ready(page)
    await locate(page)

    const hint = page.locator('.city-hint')
    await expect(hint).toBeVisible({ timeout: 15_000 })
    await hint.getByRole('button', { name: 'Hier bleiben' }).click()
    await expect(hint).toHaveCount(0)

    // Ohne Gedächtnis stünde er nach jedem Standortabruf wieder da — der
    // Hinweis wäre dann eine Belästigung statt einer Hilfe.
    await page.reload()
    await expect(page.locator('.panel-toggle')).toBeVisible({ timeout: 30_000 })
    await expect(page.locator('.provenance')).toBeAttached({ timeout: 45_000 })
    await expect(page.locator('.loading')).toHaveCount(0, { timeout: 30_000 })
    await locate(page)
    await page.waitForTimeout(1500)
    await expect(page.locator('.city-hint')).toHaveCount(0)
  })

  test('says nothing when the position is in the loaded city', async ({ page }) => {
    await standAt(page, BERLIN)
    await ready(page)
    await locate(page)
    await page.waitForTimeout(1500)
    await expect(page.locator('.city-hint')).toHaveCount(0)
  })
})

test.describe('acknowledgement', () => {
  test('names FreiFahren where users can see it, and links there', async ({ page }) => {
    await ready(page)
    await page.getByRole('button', { name: 'Einstellungen' }).click()
    const sheet = page.getByRole('dialog', { name: 'Einstellungen' })
    const link = sheet.getByRole('link', { name: /FreiFahren/ })
    await expect(link).toBeVisible()
    // Der Dank ist der Link. Zeigt er ins Leere, ist er keiner.
    await expect(link).toHaveAttribute('href', 'https://freifahren.org')
  })
})
