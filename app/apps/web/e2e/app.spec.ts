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

/** Öffnet die Einstellungen. Weiter oben als früher: zwei Gruppen brauchen sie. */
async function openSettings(page: Page) {
  await page.getByRole('button', { name: 'Einstellungen' }).click()
  const sheet = page.getByRole('dialog', { name: 'Einstellungen' })
  await expect(sheet).toBeVisible()
  return sheet
}

async function openPanel(page: Page): Promise<void> {
  const body = page.locator('.sidebar__body')
  if (!(await body.isVisible())) await page.locator('.panel-toggle').click()
  await expect(body).toBeVisible()
}

test.describe('was ausserhalb der Zonen steht', () => {
  /**
   * Regression: Die App behauptete „hier ist Parken gebührenfrei", sobald
   * keine Zone getroffen war — und das ist **falsch**, nicht nur unscharf.
   *
   * Nachgemessen an Berlins eigenen Daten am 7. September: 421
   * Straßenabschnitte mit 2.363 Stellplätzen liegen in keinem Zonenpolygon
   * und tragen trotzdem eine Gebühr und Bewirtschaftungszeiten, bis zu
   * 3,00 Euro je Stunde. Die Zonenebene und die Abschnittsebene desselben
   * Anbieters widersprechen sich; 354 dieser Abschnitte behaupten sogar
   * zugleich `zone = "nicht bewirtschaftet"`. Wer nach dem alten Satz ohne
   * Ticket stehen blieb, zahlte.
   *
   * Geprüft wird deshalb das Wort, nicht die Formulierung: Wo keine Zone
   * liegt, darf nirgends „gebührenfrei" oder „Gebühren fallen nicht an"
   * stehen.
   */
  test('verspricht nirgends, dass Parken ohne Zone nichts kostet', async ({ page }) => {
    await ready(page)
    const box = await page.locator('.map').boundingBox()
    expect(box).not.toBeNull()
    // Weit oben links: ausserhalb der bewirtschafteten Flaeche, aber noch in
    // der Stadt — genau der Fall, um den es geht.
    await page.mouse.click(box!.x + 30, box!.y + 30)
    await page.waitForTimeout(1200)
    await openPanel(page)
    const text = await page.locator('#root').innerText()
    expect(text).not.toContain('hier ist Parken gebührenfrei')
    expect(text).not.toContain('Gebühren fallen nicht an')
  })
})

test.describe('die Nutzungsstatistik', () => {
  /**
   * Ohne `VITE_API_BASE` ist `track` ein No-op — die Testsuite baut ohne den
   * Wert, sähe also nie einen Aufruf. Deshalb wird der Endpunkt hier
   * abgefangen und geprüft, **was** hinausginge.
   */
  test('schickt ohne eingerichteten Server gar nichts', async ({ page }) => {
    const anfragen: string[] = []
    await page.route('**/events', async (route) => {
      anfragen.push(route.request().postData() ?? '')
      await route.fulfill({ status: 200, body: '{"written":0}' })
    })
    await ready(page)
    const box = await page.locator('.map').boundingBox()
    await page.mouse.click(box!.x + box!.width * 0.4, box!.y + box!.height * 0.45)
    await page.waitForTimeout(1500)
    expect(anfragen).toEqual([])
  })

  // Der Widerspruch nach Art. 21 DSGVO. Er steht in den Einstellungen, weil
  // die Rechtsgrundlage das berechtigte Interesse ist — und dazu gehört, dass
  // man ihn ausüben kann, ohne jemanden zu fragen.
  test('lässt sich in den Einstellungen abschalten', async ({ page }) => {
    await ready(page)
    const sheet = await openSettings(page)
    const schalter = sheet.getByRole('checkbox', { name: /mitzählen/i })
    await expect(schalter).toBeVisible()
    await expect(schalter).toBeChecked()
    await schalter.uncheck()
    await expect(schalter).not.toBeChecked()

    const gemerkt = await page.evaluate(() =>
      localStorage.getItem('knoellchenfrei.statistik.aus.v1')
    )
    expect(gemerkt).toBe('1')
  })

  test('sagt, was gezählt wird und was nicht', async ({ page }) => {
    await ready(page)
    const sheet = await openSettings(page)
    await expect(sheet).toContainText('Keine Koordinaten')
    await expect(sheet).toContainText('keine Kennung')
  })
})

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

test.describe('Karte und Zonen', () => {
  test('zeichnet den Kartenbehälter in voller Höhe', async ({ page }) => {
    await ready(page)
    // Regression: maplibre-gl.css once won the cascade and collapsed this to 0.
    const height = await page.evaluate(() => document.querySelector('.map')?.clientHeight ?? 0)
    expect(height).toBeGreaterThan(300)
  })

  test('eine Zone von der Karte zu wählen zeigt ihre Einzelheiten, ohne abzustürzen', async ({ page }) => {
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

  test('die Suche findet eine Zone und öffnet ihre Tafel', async ({ page }) => {
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

  test('nennt den Tarif und die Zeiten laut Quelle', async ({ page }) => {
    await ready(page)
    await page.locator('.search__input').fill('1')
    await page.locator('.search__results button').first().click()
    await openPanel(page)
    await expect(page.locator('.facts')).toContainText('Tarif')
    await expect(page.locator('.facts')).toContainText('/Std.')
  })
})

test.describe('Parkvorgang', () => {
  test('merkt sich einen Platz ohne Ortung und behält ihn über ein Neuladen', async ({ page }) => {
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

  test('setzt eine Erinnerung und bietet an, sie abzubrechen', async ({ page }) => {
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

test.describe('Ebenen und Sonderziele', () => {
  test('schaltet eine Ebene ein und wieder aus', async ({ page }) => {
    await ready(page)
    await page.locator('.chip--toggle').click()
    const charging = page.locator('.chip', { hasText: 'Ladepunkte' })
    await charging.click()
    await expect(charging).toHaveClass(/chip--on/)
    // The count badge on the collapsed toggle reflects active layers.
    //
    // Eine, seit dem 9. September: Die Kontrolldichte zählt nicht mehr mit,
    // weil sie keinen Schalter mehr hat — sie liegt, sobald sie ein Muster
    // hat, und ist keine Ebene, die jemand wählt.
    await page.locator('.chip--toggle').click()
    await expect(page.locator('.chip__count')).toHaveText('1')

    await page.locator('.chip--toggle').click()
    await charging.click()
    await expect(charging).not.toHaveClass(/chip--on/)
  })

  test('zeigt in Berlin jede Ebene, für die es Daten gibt', async ({ page }) => {
    await ready(page)
    await page.locator('.chip--toggle').click()
    const chips = page.locator('#legend-layers .chip')
    // Ohne Kontrolldichte, seit dem 9. September: Sie liegt immer, sobald sie
    // ein Muster hat, und ist nichts, was jemand abschaltet.
    await expect(chips).toHaveText([
      'Umweltzone',
      'Ladepunkte',
      'Carsharing',
      'P+R',
      'Behindertenparkplätze',
    ])
  })

  test('zeigt die Umweltzone als eigene Ebene', async ({ page }) => {
    await ready(page)
    await page.locator('.chip--toggle').click()
    const lez = page.locator('.chip', { hasText: 'Umweltzone' })
    await lez.scrollIntoViewIfNeeded()
    await lez.click()
    await expect(lez).toHaveClass(/chip--on/)
  })
})

test.describe('gemeldete Sichtungen', () => {
  test('meldet eine Sichtung, verankert an einem Tippen auf die Karte', async ({ page }) => {
    await ready(page)
    const box = await page.locator('.map').boundingBox()
    await page.mouse.click(box!.x + box!.width * 0.4, box!.y + box!.height * 0.45)
    await page.waitForTimeout(1000)
    await openPanel(page)

    const sightings = page.locator('section[aria-label="Ordnungsamt-Sichtungen"]')
    // Leer, und ehrlich leer: keine erzeugten Zeilen mehr.
    await expect(sightings.locator('.sightings__item')).toHaveCount(0)

    // The button opens the report sheet; the tapped point is offered first.
    await page.locator('button', { hasText: 'Hier gesehen' }).click()
    await expect(page.locator('.sheet')).toBeVisible()
    await page.locator('.sheet__submit').click()
    await expect(page.locator('.sheet')).toHaveCount(0)
    await page.waitForTimeout(600)

    await expect(sightings.locator('.sightings__item')).toHaveCount(1)
    await expect(sightings.locator('.demo-note')).not.toContainText('erzeugt')
  })

  /**
   * Bis zum 9. September stand hier „kennzeichnet erzeugte Meldungen als
   * Demodaten": Eine leere Liste bekam sechs erzeugte Sichtungen, mit
   * Hinweis. Der Betreiber will echte Daten sehen — also ist eine Liste ohne
   * Meldungen jetzt leer und sagt das, statt etwas zu zeigen, das aussieht
   * wie eine Aussage über die Stadt.
   */
  test('erfindet ohne Meldungen keine — die Liste ist leer und sagt es', async ({ page }) => {
    await ready(page)
    await openPanel(page)
    const sightings = page.locator('section[aria-label="Ordnungsamt-Sichtungen"]')
    await expect(sightings).toContainText('0 aktiv')
    await expect(sightings).toContainText('Keine aktuellen Sichtungen')
    await expect(sightings.locator('.sightings__item')).toHaveCount(0)
    await expect(sightings).not.toContainText('erzeugt')
  })

  /**
   * Die eigene Meldung trägt keine Stimmknöpfe. Der Worker weist eine Stimme
   * darauf mit 403 ab (M-047); am 9. September lief sie beim Durchklicken
   * sogar in ein 404, weil die App noch ihre lokale Kennung schickte. Ein
   * Knopf, der nur einen Fehler auslöst, ist kein Knopf.
   */
  test('bietet auf der eigenen Meldung keine Stimme an', async ({ page }) => {
    await ready(page)
    const box = await page.locator('.map').boundingBox()
    await page.mouse.click(box!.x + box!.width * 0.4, box!.y + box!.height * 0.45)
    await page.waitForTimeout(1000)
    await openPanel(page)
    await page.locator('button', { hasText: 'Hier gesehen' }).click()
    await page.locator('.sheet__submit').click()
    await expect(page.locator('.sheet')).toHaveCount(0)

    const own = page.locator('section[aria-label="Ordnungsamt-Sichtungen"] .sightings__item').first()
    await expect(own).toContainText('deine Meldung')
    await expect(own.locator('button')).toHaveCount(0)
  })

  /**
   * Der Betreiber, 9. September, mit Bildschirmfoto: „Nach dem Reload
   * verschwindet die Anzeige, dass ich diese gemeldet habe." Die Kennungen
   * standen nur in einem Ref. Jetzt im Speicher des Geräts.
   */
  test('weiss nach dem Neuladen noch, welche Meldung die eigene ist', async ({ page }) => {
    await ready(page)
    await page.locator('.report-fab').click()
    await page.locator('.sheet__option').first().click()
    await page.locator('.sheet__submit').click()
    await expect(page.locator('.sheet')).toHaveCount(0)

    await page.reload()
    await ready(page)
    await openPanel(page)
    const own = page.locator('section[aria-label="Ordnungsamt-Sichtungen"] .sightings__item').first()
    await expect(own).toContainText('deine Meldung')
    await expect(own.locator('button')).toHaveCount(0)
  })

  /**
   * Zweite Hälfte desselben Befunds: „Wenn ich dann alle drei anklicke, hab
   * ich das Gefühl, dass nicht alle als gesehen akzeptiert werden." Der
   * Server zählt je Meldung und Client eine Stimme; die zweite ging still
   * zurück. Die Zeile sagt jetzt, was dieses Gerät schon gestimmt hat, und
   * sagt es auch nach dem Neuladen noch.
   */
  test('merkt sich die eigene Stimme und bietet keine zweite an', async ({ page }) => {
    // Eine fremde Meldung, vor fünf Minuten, mitten in der Stadt.
    await page.addInitScript(() => {
      localStorage.setItem(
        'knoellchenfrei.sightings',
        JSON.stringify([
          { id: 'fremd-1', lon: 13.405, lat: 52.52, reportedAt: Date.now() - 300_000, confirmations: 0, disputes: 0 },
        ]),
      )
    })
    await ready(page)
    await openPanel(page)
    const row = page.locator('section[aria-label="Ordnungsamt-Sichtungen"] .sightings__item').first()
    await row.getByRole('button', { name: /bestätigen$/ }).click()
    await expect(row).toContainText('du: gesehen')
    await expect(row.locator('button')).toHaveCount(0)

    await page.reload()
    await ready(page)
    await openPanel(page)
    const again = page.locator('section[aria-label="Ordnungsamt-Sichtungen"] .sightings__item').first()
    await expect(again).toContainText('du: gesehen')
    await expect(again.locator('button')).toHaveCount(0)
  })
})

test.describe('der Meldeknopf auf der Karte', () => {
  /**
   * Bis zum 9. September war Melden drei unsichtbare Schritte: Karte
   * antippen, Blatt öffnen, den kleinen Knopf im Kopf des Abschnitts finden.
   * Der Betreiber hat ihn nicht gefunden. Jetzt steht er auf der Karte, neben
   * dem Standort — und braucht keinen Tipp vorher, das Blatt bietet die Nähe an.
   */
  test('öffnet das Meldeblatt ohne vorherigen Tipp auf die Karte', async ({ page }) => {
    await ready(page)
    const fab = page.getByRole('button', { name: 'Kontrolle melden' })
    await expect(fab).toBeVisible()
    await fab.click()
    const sheet = page.getByRole('dialog', { name: 'Sichtung melden' })
    await expect(sheet).toBeVisible()
    await expect(sheet).toContainText('In der Nähe')
    await page.locator('.sheet__option').first().click()
    await page.locator('.sheet__submit').click()
    await expect(sheet).toHaveCount(0)
    await openPanel(page)
    await expect(
      page.locator('section[aria-label="Ordnungsamt-Sichtungen"] .sightings__item'),
    ).toHaveCount(1)
  })

  // Seit dem 9. September abends rechts in der Zeile der Ebenen, unter den
  // Live-Zahlen, rechtsbündig mit dem Zahnrad — auf dem Handy. Auf dem
  // Desktop liegt die Zeile unten links, dort zählt nur die Zeile selbst.
  test('steht rechts neben den Ebenen, unter den Live-Zahlen', async ({ page }, testInfo) => {
    await ready(page)
    const fab = (await page.locator('.report-fab').boundingBox())!
    const live = (await page.locator('.live').boundingBox())!
    const ebenen = (await page.locator('.chip--toggle').boundingBox())!
    expect(fab.y).toBeGreaterThanOrEqual(live.y + live.height)
    expect(Math.abs(fab.y - ebenen.y)).toBeLessThan(2)
    expect(ebenen.x + ebenen.width).toBeLessThanOrEqual(fab.x)
    if (testInfo.project.name === 'phone') {
      const gear = (await page.getByRole('button', { name: 'Einstellungen' }).boundingBox())!
      expect(Math.abs(fab.x + fab.width - (gear.x + gear.width))).toBeLessThan(2)
    }
  })
})

test.describe('Melden scheitert nie still', () => {
  const sightings = 'section[aria-label="Ordnungsamt-Sichtungen"]'

  test('bietet einen Ort zum Melden auch ohne jede Geste auf der Karte', async ({ page }) => {
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

  test('gibt die Karte frei, wenn das Meldeblatt auf dem Handy aufgeht', async ({ page }, testInfo) => {
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

  test('nimmt die Meldung zurück und sagt es, wenn der gemeinsame Speicher sie abweist', async ({ page }) => {
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

test.describe('einen ruhigen Tag erklären', () => {
  test('sagt, warum so wenige Zonen kassieren, und verschwindet auf Wunsch', async ({ page }) => {
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

  test('nennt im ausgelieferten Code weder Stadt noch Wochentag', async ({ page }) => {
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

test.describe('nach dem Standort fragen', () => {
  test('erklärt sich vor dem Browser-Dialog und lässt sich vertagen', async ({ page }) => {
    await ready(page, { keepPrompt: true })
    const prompt = page.locator('.prompt')
    await expect(prompt).toBeVisible()
    // The native dialog says nothing about why. This one does, and names the
    // way that always works.
    await expect(prompt).toContainText('Karte tippen')

    await prompt.getByRole('button', { name: 'Später' }).click()
    await expect(prompt).toHaveCount(0)
  })

  test('fragt nicht noch einmal, nachdem geantwortet wurde', async ({ page }) => {
    await ready(page, { keepPrompt: true })
    await page.locator('.prompt').getByRole('button', { name: 'Später' }).click()
    await page.reload()
    await expect(page.locator('.panel-toggle')).toBeVisible({ timeout: 30_000 })
    await page.waitForTimeout(1500)
    await expect(page.locator('.prompt')).toHaveCount(0)
  })
})

test.describe('Einstellungen', () => {
  test('trägt den stehenden Vorbehalt und beantwortet, was die Daten aufwerfen', async ({ page }) => {
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
  test('beantwortet nur, was in der geladenen Stadt gilt', async ({ page }) => {
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

  test('bietet keinen Spendenknopf an', async ({ page }) => {
    await ready(page)
    await page.getByRole('button', { name: 'Einstellungen' }).click()
    // There is no association and no account behind it; a "support us" that
    // leads nowhere would be a claim rather than a feature.
    await expect(page.getByRole('dialog', { name: 'Einstellungen' })).not.toContainText(
      /Spende|Unterstütz/,
    )
  })
})

test.describe('Rückmeldungen', () => {
  test('wird nur dort angeboten, wo das Versprechen zu halten ist', async ({ page }) => {
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

test.describe('Zahlen im Betrieb', () => {
  test('nennt immer die Meldungen und behauptet den Rest nur, wenn es ihn zählen kann', async ({
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

  test('verschluckt keine Tipper auf die Karte', async ({ page }) => {
    await ready(page)
    // The legend once covered the map across its full width without
    // pointer-events: none; the strip must not repeat it.
    await expect(page.locator('.live')).toHaveCSS('pointer-events', 'none')
  })
})

/**
 * Striche im lokalen Speicher, wie sie eigene Meldungen der letzten Tage
 * hinterlassen — damit die Tafel etwas zu zeichnen hat. Seit dem 9. September
 * erzeugt die App selbst keine Demodaten mehr; was ein Test zum Zeichnen
 * braucht, legt er hier ab, als Datei mit demselben Format, das `saveMarks`
 * schreibt. Die Zellen sind Berliner Innenstadtzellen des 250-m-Rasters.
 */
async function mitStrichen(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const zellen = ['109_97', '109_97', '110_97', '109_98', '108_96']
    const stunden = [8, 9, 10, 10, 11, 14, 17]
    const tag = (vorTagen: number): string =>
      new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin' }).format(
        new Date(Date.now() - vorTagen * 86_400_000),
      )
    const striche: { day: string; cell: string; hour: number }[] = []
    for (let d = 0; d < 12; d += 1) {
      for (let i = 0; i <= d % 3; i += 1) {
        striche.push({ day: tag(d), cell: zellen[(d + i) % zellen.length]!, hour: stunden[(d + i) % stunden.length]! })
      }
    }
    localStorage.setItem('knoellchenfrei.marks.v1', JSON.stringify(striche))
  })
}

test.describe('Kontrolldichte', () => {
  const heatPanel = 'section[aria-label="Kontrolldichte"]'

  /**
   * Bis zum 9. September stand hier „sagt, worauf das Bild beruht, und dass
   * es erzeugt ist" — ein Beispielmuster mit Hinweis. Ohne Meldungen gibt es
   * jetzt kein Bild und keinen Ersatz dafür, nur den Satz, wie viele fehlen.
   */
  test('erfindet ohne Meldungen kein Muster', async ({ page }) => {
    await ready(page)
    await openPanel(page)
    await expect(page.locator(heatPanel)).toContainText('Noch keine Auswertung')
    await expect(page.locator(heatPanel)).toContainText(/Noch \d+ Meldungen bis sich ein Muster/)
    await expect(page.locator(`${heatPanel} .demo-note`)).toHaveCount(0)
    await expect(page.locator(`${heatPanel} header button`)).toHaveCount(0)
  })

  /**
   * Kein Schalter mehr, seit dem 9. September: Die Ebene liegt, sobald sie
   * ein Muster hat (Betreiber: „muss man nicht ausschalten können"). Weder im
   * Blatt noch in der Chip-Zeile gibt es dafür einen Knopf.
   */
  test('liegt von Anfang an auf der Karte und hat keinen Schalter', async ({ page }) => {
    await mitStrichen(page)
    await ready(page)
    await openPanel(page)
    await expect(page.locator(heatPanel)).toContainText('Meldungen ·')
    await expect(page.locator(`${heatPanel} header button`)).toHaveCount(0)
    await page.getByRole('button', { name: /Ebenen/ }).click()
    await expect(page.getByRole('button', { name: 'Kontrolldichte' })).toHaveCount(0)
    const visible = await page.evaluate(() => {
      const map = (window as unknown as { __map?: { getLayoutProperty: (id: string, key: string) => string } }).__map
      return map?.getLayoutProperty('heat-density', 'visibility') ?? 'missing'
    })
    expect(['visible', 'missing']).toContain(visible)
  })

  test('nennt die Zahlen, die die Farbe nicht tragen kann', async ({ page }) => {
    await mitStrichen(page)
    await ready(page)
    await openPanel(page)
    const panel = page.locator('section[aria-label="Kontrolldichte"]')
    await expect(panel).toContainText('Letzte 24 Stunden')
    await expect(panel).toContainText('Häufige Stellen')
    // Named by zone: a ranked list of unnamed cells says nothing about where.
    await expect(panel.locator('.heat-top strong').first()).toContainText(/Zone|Außerhalb/)
  })

  test('zeichnet das Tagesdiagramm immer — es braucht keine Uhrzeit', async ({ page }) => {
    await mitStrichen(page)
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

  test('zeichnet ein Stundenprofil mit einer Marke für die laufende Stunde', async ({ page }) => {
    await mitStrichen(page)
    await ready(page)
    await openPanel(page)
    const panel = page.locator('section[aria-label="Kontrolldichte"]')
    await expect(panel.locator('.chart:not(.chart--days) .chart__bar')).toHaveCount(24)
    // One line, always present — a coloured bar disappeared at an hour with no
    // reports, which is exactly when the marker matters.
    await expect(panel.locator('.chart__now')).toHaveCount(1)
  })
})

test.describe('Widerstandsfähigkeit', () => {
  test('übersteht kaputten gespeicherten Zustand', async ({ page }) => {
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

  test('meldet in einer gewöhnlichen Sitzung keine Konsolenfehler', async ({ page }) => {
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

  test('scrollt nie waagerecht', async ({ page }) => {
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

test.describe('Herkunft', () => {
  test('nennt Quelle und Lizenz', async ({ page }) => {
    await ready(page)
    await openPanel(page)
    await expect(page.locator('.provenance')).toContainText('gdi.berlin.de')
    await expect(page.locator('.provenance')).toContainText('Datenlizenz Deutschland Zero 2.0')
  })

  test('warnt, dass das aufgestellte Schild gilt', async ({ page }) => {
    await ready(page)
    await openPanel(page)
    await expect(page.locator('.provenance__warn')).toContainText('Beschilderung', {
      timeout: 15_000,
    })
  })
})

test.describe('die weiteren Städte', () => {
  /** Öffnet die Einstellungen und liefert das Dialog-Locator zurück. */
  test('bietet jede Stadt an und markiert die aktuelle', async ({ page }) => {
    await ready(page)
    const sheet = await openSettings(page)
    await expect(sheet.getByRole('button', { name: 'Berlin' })).toBeDisabled()
    await expect(sheet.getByRole('button', { name: 'Hamburg' })).toBeEnabled()
    await expect(sheet.getByRole('button', { name: 'Frankfurt am Main' })).toBeEnabled()
    await expect(sheet.getByRole('button', { name: 'München' })).toBeEnabled()
  })

  // Der eigentliche Punkt: Nach dem Wechsel stehen ANDERE Daten auf der Karte.
  // Ein Umschalter, der nur eine Beschriftung ändert, wäre schlimmer als keiner.
  test('schaltet auf Hamburg um und lädt Hamburger Zonen', async ({ page }) => {
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

  /**
   * Regression: Die Ebenen-Chips standen für alle vier POI-Arten und die
   * Umweltzone da, gleich ob dahinter Daten lagen.
   *
   * Nachgemessen am 7. September in `public/data/<stadt>/`: Hamburg hat
   * **keinen einzigen** POI und keine Umweltzone, Frankfurt nur die 458
   * Behindertenparkplätze. In Hamburg waren damit fünf von sechs Schaltern
   * Attrappen — und ein Schalter, der nichts tut, liest sich als Aussage über
   * die Stadt („hier gibt es keine Ladepunkte") statt als eine über die Daten.
   */
  test('nennt in Hamburg die Hamburger Auskunftsstelle, nicht die Berliner', async ({ page }) => {
    await ready(page)
    const sheet = await openSettings(page)
    await sheet.getByRole('button', { name: 'Hamburg' }).click()
    await expect(page.locator('.panel-toggle')).toBeVisible({ timeout: 30_000 })
    await expect(page.locator('.provenance')).toBeAttached({ timeout: 45_000 })
    await expect(page.locator('.loading')).toHaveCount(0, { timeout: 30_000 })
    await dismissPrompt(page)
    await openPanel(page)

    await page.getByRole('button', { name: /Auto weg\?/ }).click()
    const body = page.locator('#tow-info-body')
    await expect(body).toContainText('Polizei Hamburg')
    await expect(body).not.toContainText('Polizei Berlin')
    // Die Berliner Nummer stand hier bis zum 7. September auch in Hamburg.
    await expect(body).not.toContainText('030')
  })

  test('zeigt in Hamburg keine Ebene, hinter der nichts liegt', async ({ page }) => {
    await ready(page)
    const sheet = await openSettings(page)
    await sheet.getByRole('button', { name: 'Hamburg' }).click()
    await expect(page.locator('.panel-toggle')).toBeVisible({ timeout: 30_000 })
    await expect(page.locator('.provenance')).toBeAttached({ timeout: 45_000 })
    await expect(page.locator('.loading')).toHaveCount(0, { timeout: 30_000 })
    await dismissPrompt(page)

    // Hamburg hat weder Umweltzone noch POI-Ebenen, und die Kontrolldichte
    // hat keinen Schalter mehr — also gibt es hier gar keinen Ebenen-Knopf,
    // statt eines, der eine leere Liste aufklappt.
    await expect(page.locator('.chip--toggle')).toHaveCount(0)
  })

  test('nennt die Hamburger Lizenz als Bedingung, nicht als Fußnote', async ({ page }) => {
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

  // Dasselbe für die dritte Stadt, und aus demselben Grund: Ein Umschalter,
  // der nur eine Beschriftung ändert, wäre schlimmer als keiner.
  test('schaltet auf Frankfurt um und lädt Frankfurter Zonen', async ({ page }) => {
    await ready(page)
    const sheet = await openSettings(page)
    await sheet.getByRole('button', { name: 'Frankfurt am Main' }).click()

    await expect(page.locator('.panel-toggle')).toBeVisible({ timeout: 30_000 })
    await expect(page.locator('.provenance')).toBeAttached({ timeout: 45_000 })
    await expect(page.locator('.loading')).toHaveCount(0, { timeout: 30_000 })

    // Über den Stadtteil, nicht über die Zonennummer: Frankfurts Bereiche
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
  // wörtlich in `city.ts`; dieser Test hält fest, dass sie auch wörtlich
  // ankommt und nicht unterwegs umformuliert wird.
  test('nennt die Frankfurter Lizenz als Bedingung und den Quellenvermerk wörtlich', async ({ page }) => {
    await ready(page)
    let sheet = await openSettings(page)
    await sheet.getByRole('button', { name: 'Frankfurt am Main' }).click()
    await expect(page.locator('.panel-toggle')).toBeVisible({ timeout: 30_000 })
    await expect(page.locator('.loading')).toHaveCount(0, { timeout: 30_000 })

    sheet = await openSettings(page)
    await expect(sheet).toContainText('Datenlizenz Deutschland Namensnennung 2.0')
    await expect(sheet).toContainText('verlangt')
    await expect(sheet).toContainText('Stadt Frankfurt am Main, www.frankfurt.de')
    // Datenlizenz Deutschland kennt keinen Gewährleistungs-Hinweis — der
    // Satz gehört nur zu Creative Commons und darf hier nicht stehen.
    await expect(sheet).not.toContainText('ohne Gewährleistung')
  })

  // Karlsruhe ist die einzige Stadt unter Creative Commons. CC BY 4.0
  // § 3 a) 1) A) iv) verlangt einen Hinweis auf den Gewährleistungsausschluss,
  // den die Datenlizenz Deutschland nicht kennt (`docs/staedte-karlsruhe.md`,
  // 5.3). Der Satz hängt an `licenceFamily`, nicht am Lizenznamen.
  test('nennt in Karlsruhe den Gewährleistungsausschluss von CC BY', async ({ page }) => {
    await ready(page)
    let sheet = await openSettings(page)
    await sheet.getByRole('button', { name: 'Karlsruhe' }).click()
    await expect(page.locator('.panel-toggle')).toBeVisible({ timeout: 30_000 })
    await expect(page.locator('.loading')).toHaveCount(0, { timeout: 30_000 })

    sheet = await openSettings(page)
    await expect(sheet).toContainText('CC BY 4.0')
    await expect(sheet).toContainText('verlangt')
    await expect(sheet).toContainText('ohne Gewährleistung')
  })

  /**
   * Seit dem 9. September trägt `meta.json` den Zeitpunkt des letzten
   * erfolgreichen Abrufs, und die Einstellungen nennen ihn: Ein Abzug von
   * vor drei Wochen hat für „kostet das gerade etwas" eine andere
   * Verlässlichkeit als einer von gestern — und ein Behördendienst, der
   * schweigt, lässt den alten Abzug stehen. Das soll er, nur sichtbar.
   */
  test('nennt in den Einstellungen, wann die Daten zuletzt geprüft wurden', async ({ page }) => {
    await ready(page)
    const sheet = await openSettings(page)
    await expect(sheet).toContainText('zuletzt geprüft am')
    // Ein Datum, kein „Invalid Date": „09.09.2026, 16:12" in Berliner Zeit.
    await expect(sheet).toContainText(/geprüft am \d{2}\.\d{2}\.\d{4}, \d{2}:\d{2}\./)
  })

  // Und dasselbe für die vierte Stadt. Muenchen ist der interessanteste der
  // vier Fälle: Seine Gebiete heissen nicht "19" oder "N10", sondern
  // "Glockenbachviertel" -- ein Treffer darauf beweist andere Daten, ohne dass
  // man den Stadtteil dazunehmen müsste.
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
    // Über die Kennung, nicht über die Klasse: `.panel__title` tragen auch
    // die Sichtungs- und die Heatmap-Karte, und Playwrights Strict Mode bricht
    // bei drei Treffern ab.
    await expect(page.locator('#zone-panel-title')).toContainText('Glockenbachviertel')
    await expect(page.locator('.panel__eyebrow').first()).toContainText(
      'Ludwigsvorstadt-Isarvorstadt'
    )
    await expect(page.locator('.provenance')).toContainText('München')
  })

  // Der eine Satz, den nur Muenchen auslöst: Die Quelle nennt für kein
  // einziges der 82 Gebiete einen Betrag. „0,00 €" wäre dort die falscheste
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
  test('schaltet zurück nach Berlin', async ({ page }) => {
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

  test('merkt sich „Hier bleiben“ über ein Neuladen', async ({ page }) => {
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

  test('sagt nichts, wenn die Position in der geladenen Stadt liegt', async ({ page }) => {
    await standAt(page, BERLIN)
    await ready(page)
    await locate(page)
    await page.waitForTimeout(1500)
    await expect(page.locator('.city-hint')).toHaveCount(0)
  })
})

test.describe('Danksagung', () => {
  test('nennt FreiFahren sichtbar für Nutzende und verweist dorthin', async ({ page }) => {
    await ready(page)
    await page.getByRole('button', { name: 'Einstellungen' }).click()
    const sheet = page.getByRole('dialog', { name: 'Einstellungen' })
    const link = sheet.getByRole('link', { name: /FreiFahren/ })
    await expect(link).toBeVisible()
    // Der Dank ist der Link. Zeigt er ins Leere, ist er keiner.
    await expect(link).toHaveAttribute('href', 'https://freifahren.org')
  })
})

test.describe('Standort beim Melden und beim Gehen', () => {
  /** Potsdamer Platz, mitten in einer Zone. */
  const START = { latitude: 52.5096, longitude: 13.3765 }

  /**
   * Der Betreiber, 9. September: „Kontrolle melden" soll den Standort selbst
   * holen und kurz zeigen, damit man ihn bestätigt — so, als hätte man erst
   * „Wo bin ich?" gedrückt. Der Vordialog gilt als beantwortet; sonst fragt
   * die App nie nach dem Standort, und das soll sie auch hier nicht.
   */
  test('holt beim Kartenknopf den Standort und stellt ihn zur Bestätigung vor', async ({ page }) => {
    await page.context().grantPermissions(['geolocation'])
    await page.context().setGeolocation(START)
    await page.addInitScript(() => localStorage.setItem('knoellchenfrei.locationAsked.v1', 'true'))
    await ready(page)
    await page.getByRole('button', { name: 'Kontrolle melden' }).click()
    const sheet = page.getByRole('dialog', { name: 'Sichtung melden' })
    await expect(sheet).toBeVisible()
    const erste = sheet.locator('.sheet__option').first()
    await expect(erste).toContainText('mein Standort', { timeout: 10_000 })
    await expect(erste).toHaveClass(/sheet__option--on/)
    await expect(sheet.locator('.sheet__submit')).toBeEnabled()
    await expect(sheet.locator('.sheet__submit')).toContainText(/^Melden — Zone/)
  })

  /**
   * Und danach folgt der Punkt: Wer einmal „Wo bin ich?" gedrückt hat, soll
   * beim Gehen nicht wieder drücken müssen. Playwright meldet einen neuen
   * Standort an `watchPosition`, und der Marker hat zu wandern.
   */
  test('lässt den blauen Punkt mitlaufen, ohne dass man erneut drückt', async ({ page }) => {
    await page.context().grantPermissions(['geolocation'])
    await page.context().setGeolocation(START)
    await ready(page)
    await page.getByRole('button', { name: 'Wo bin ich?' }).click()
    const marker = page.locator('.marker--me')
    await expect(marker).toBeVisible({ timeout: 15_000 })
    await page.waitForTimeout(800)
    const vorher = (await marker.boundingBox())!

    await page.context().setGeolocation({ latitude: START.latitude, longitude: START.longitude + 0.003 })
    await expect
      .poll(async () => (await marker.boundingBox())!.x - vorher.x, { timeout: 10_000 })
      .toBeGreaterThan(20)
  })
})
