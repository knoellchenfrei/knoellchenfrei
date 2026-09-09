/**
 * Klickt die App wie drei Nutzer durch — gegen einen **lokalen Worker**.
 *
 * Die E2E-Suite misst den lokalen Modus („nur dieses Gerät"): Sie kann nicht
 * sehen, ob eine Meldung beim Worker ankommt, ob eine zweite Stimme desselben
 * Clients verworfen wird oder ob der Client-Hash zwei Sitzungen auseinanderhält.
 * Genau dort lagen am 9. September zwei Fehler, die kein Test sah: Die App
 * behielt nach dem Melden 45 Sekunden lang ihre lokale Kennung (eine Stimme
 * darauf war ein 404), und eine nicht gezählte Stimme blieb in der Anzeige.
 *
 * Voraussetzungen, drei Fenster:
 *
 *   cd app/apps/api && printf 'CLIENT_SALT=lokal\nALLOWED_ORIGINS=http://localhost:4173\n' > .dev.vars
 *   cd app && pnpm --filter @knoellchenfrei/api exec wrangler d1 migrations apply knoellchenfrei --local
 *   cd app && pnpm --filter @knoellchenfrei/api exec wrangler dev --local --port 8787 --test-scheduled
 *
 *   cd app/apps/web && VITE_API_BASE=http://127.0.0.1:8787 pnpm build && pnpm preview --port 4173
 *
 *   cd app/apps/web && PLAYWRIGHT_CHROMIUM=… node scripts/durchklicken.mjs
 *
 * `.dev.vars` ist nicht in `.gitignore` — danach löschen. Das Skript endet mit
 * Rückgabewert 1, sobald ein Aufruf an den Worker mit 4xx/5xx antwortet oder
 * eine Seite einen Fehler in die Konsole schreibt; Kachelfehler zählen nicht,
 * die Rasterkacheln von OpenStreetMap sind hier oft gesperrt.
 *
 * Die Falle des Aufbaus, einmal gefunden und deshalb hier festgehalten: Der
 * Worker bildet den Client-Hash aus `CF-Connecting-IP`. Als `extraHTTPHeaders`
 * im Browser gesetzt, erzwingt der Kopf für **jede** Anfrage einen Preflight,
 * den der Worker nur für `Content-Type` beantwortet — alles scheitert mit
 * „Failed to fetch", und das sieht aus wie ein CORS-Fehler der App. Der Kopf
 * gehört unter die CORS-Schicht, über `context.route`, so wie ihn die
 * Cloudflare-Kante setzt.
 */
import { chromium, devices } from '@playwright/test'

const BASE = process.env.BASE ?? 'http://localhost:4173/'
const WORKER = process.env.WORKER ?? 'http://127.0.0.1:8787'

const executablePath = process.env.PLAYWRIGHT_CHROMIUM
const browser = await chromium.launch(executablePath !== undefined ? { executablePath } : {})
const befunde = []
const log = (...teile) => console.log(...teile)

async function nutzer(name, ip, handy) {
  const context = await browser.newContext({
    ...(handy ? devices['Pixel 7'] : { viewport: { width: 1280, height: 860 } }),
    locale: 'de-DE',
    timezoneId: 'Europe/Berlin',
  })
  await context.route(`${WORKER}/**`, (route) =>
    route.continue({ headers: { ...route.request().headers(), 'cf-connecting-ip': ip } }),
  )
  const page = await context.newPage()
  page.on('console', (m) => {
    if (m.type() !== 'error') return
    const text = m.text()
    if (/tile\.openstreetmap\.org|ERR_CONNECTION_RESET/.test(text)) return
    befunde.push(`[${name}] console.error: ${text.slice(0, 200)}`)
  })
  page.on('pageerror', (e) => befunde.push(`[${name}] pageerror: ${String(e).slice(0, 200)}`))
  page.on('response', (r) => {
    if (r.url().startsWith(WORKER) && r.status() >= 400) {
      befunde.push(`[${name}] ${r.request().method()} ${r.url().slice(WORKER.length)} -> ${r.status()}`)
    }
  })
  return { name, page, context }
}

async function bereit(page) {
  await page.goto(BASE)
  await page.locator('.panel-toggle').waitFor({ timeout: 30_000 })
  await page.locator('.provenance').waitFor({ state: 'attached', timeout: 45_000 })
  await page.waitForFunction(() => document.querySelectorAll('.loading').length === 0, null, {
    timeout: 30_000,
  })
  await page.waitForTimeout(800)
  const nachher = page.locator('.prompt').getByRole('button', { name: 'Später' })
  if (await nachher.count()) await nachher.click()
}

async function blattAuf(page) {
  const body = page.locator('.sidebar__body')
  if (!(await body.isVisible())) await page.locator('.panel-toggle').click()
  await body.waitFor()
}

async function sichtungen(page) {
  const zeilen = page.locator('.sightings__item')
  const n = await zeilen.count()
  const rows = []
  for (let i = 0; i < n; i++) rows.push((await zeilen.nth(i).innerText()).replace(/\s+/g, ' '))
  const kopf = await page
    .locator('section[aria-label="Ordnungsamt-Sichtungen"] .panel__title')
    .innerText()
  return `${kopf}: ${rows.join(' | ')}`
}

async function toast(page) {
  const t = page.locator('.toast')
  return (await t.count()) ? (await t.first().innerText()).replace(/\s+/g, ' ') : null
}

async function melden(nutzerin, x, y) {
  const size = nutzerin.page.viewportSize()
  await nutzerin.page.mouse.click(size.width * x, size.height * y)
  await nutzerin.page.waitForTimeout(500)
  await blattAuf(nutzerin.page)
  await nutzerin.page.locator('button', { hasText: 'Hier gesehen' }).click()
  const dialog = nutzerin.page.getByRole('dialog', { name: 'Sichtung melden' })
  await dialog.waitFor()
  await dialog.locator('.sheet__submit').click()
  await nutzerin.page.waitForTimeout(1500)
  await blattAuf(nutzerin.page)
}

function erwarte(bedingung, text) {
  if (!bedingung) befunde.push(`erwartet: ${text}`)
  log(`${bedingung ? '  ok  ' : '  WEH '} ${text}`)
}

try {
  // A meldet vom Handy und darf die eigene Meldung nicht bewerten.
  const A = await nutzer('A', '10.1.0.1', true)
  await bereit(A.page)
  await melden(A, 0.5, 0.4)
  log('A:', await sichtungen(A.page))
  erwarte((await toast(A.page)) === null, 'A: Melden ohne Fehlermeldung')
  const eigene = A.page.locator('.sightings__item').first()
  erwarte((await eigene.locator('.sightings__own').count()) === 1, 'A: eigene Meldung markiert')
  erwarte((await eigene.locator('button').count()) === 0, 'A: keine Stimmknöpfe auf der eigenen Meldung')

  // B sieht sie, bestätigt, tippt noch einmal — der Server zählt nur einmal.
  const B = await nutzer('B', '10.1.0.2', false)
  await bereit(B.page)
  await blattAuf(B.page)
  const zeileB = B.page.locator('.sightings__item').first()
  const sterneVorher = await zeileB.locator('.stars').innerText()
  await zeileB.getByRole('button', { name: /bestätigen$/ }).click()
  await B.page.waitForTimeout(1500)
  const sterneNachher = await zeileB.locator('.stars').innerText()
  erwarte(sterneNachher.length > sterneVorher.length, `B: Bestätigung hebt die Sterne (${sterneVorher} → ${sterneNachher})`)
  await zeileB.getByRole('button', { name: /bestätigen$/ }).click()
  await B.page.waitForTimeout(1500)
  erwarte((await zeileB.locator('.stars').innerText()) === sterneNachher, 'B: zweite Stimme ändert nichts')
  erwarte((await toast(B.page)) === null, 'B: keine Fehlermeldung')
  // Der Serverstand, beim Worker nachgelesen statt aus den Sternen geraten:
  // Die Konfidenz verfällt mit dem Alter, ein Vergleich der Sterne über
  // Minuten hinweg misst die Uhr, nicht die Stimme.
  const stand = async () => {
    const antwort = await fetch(`${WORKER}/sightings?city=berlin`)
    const body = await antwort.json()
    return body.sightings[0]
  }
  const nachStimme = await stand()
  erwarte(nachStimme.confirmations === 1, `B: der Worker zählt eine Bestätigung (${nachStimme.confirmations})`)
  await B.page.reload()
  await bereit(B.page)
  await blattAuf(B.page)
  log('B:', await sichtungen(B.page))

  // C sagt „weg" und meldet eine zweite Stelle.
  const C = await nutzer('C', '10.1.0.3', false)
  await bereit(C.page)
  await blattAuf(C.page)
  await C.page.locator('.sightings__item').first().getByRole('button', { name: /weg melden$/ }).click()
  await C.page.waitForTimeout(1500)
  erwarte((await toast(C.page)) === null, 'C: „weg" ohne Fehlermeldung')
  const nachWeg = await stand()
  erwarte(nachWeg.disputes === 1, `C: der Worker zählt einen Widerspruch (${nachWeg.disputes})`)
  await melden(C, 0.35, 0.6)
  log('C:', await sichtungen(C.page))

  // A lädt neu: zwei Meldungen, und die Live-Zeile zählt drei Geräte.
  await A.page.reload()
  await bereit(A.page)
  await blattAuf(A.page)
  log('A:', await sichtungen(A.page))
  const live = (await A.page.locator('.live').innerText()).replace(/\s+/g, ' ')
  log('Live-Zeile:', live)
  // Mindestens drei: Das Fenster „gerade offen" ist fünf Minuten weit, ein
  // Lauf kurz nach dem vorigen zählt dessen Geräte noch mit.
  const offen = Number(/(\d+) gerade offen/.exec(live)?.[1] ?? 0)
  erwarte(offen >= 3, `mindestens drei Geräte gerade offen (${offen})`)

  // Kontrolldichte: Grafiken vorhanden, Schalter und Chip synchron.
  const heat = B.page.locator('section[aria-label="Kontrolldichte"]')
  log('Kontrolldichte:', await heat.locator('.panel__title').innerText())
  const knopf = heat.locator('header button')
  if (await knopf.isEnabled()) {
    erwarte((await heat.locator('.chart--days .chart__bar').count()) === 28, '28 Tagesbalken')
    await knopf.click()
    await B.page.waitForTimeout(500)
    const gesetzt = await knopf.getAttribute('aria-pressed')
    await B.page.getByRole('button', { name: /Ebenen/ }).click()
    const chip = await B.page.locator('.legend .chip', { hasText: 'Kontrolldichte' }).getAttribute('aria-pressed')
    erwarte(gesetzt === chip, `Kartenschalter (${gesetzt}) und Chip (${chip}) stimmen überein`)
  } else {
    log('  --   noch kein Muster (unter der Schwelle), Grafiken nicht prüfbar')
  }

  for (const u of [A, B, C]) await u.context.close()

  // Aufräumlauf, dann die Statistikseite.
  const lauf = await fetch(`${WORKER}/__scheduled?cron=7+*+*+*+*`)
  erwarte(lauf.status === 200, 'Aufräumlauf angestoßen')
  const S = await nutzer('S', '10.1.0.9', false)
  await S.page.goto(`${BASE}statistik/`)
  await S.page.waitForTimeout(2500)
  const abschnitte = await S.page.locator('h2').allInnerTexts()
  log('Statistik:', abschnitte.join(' | '))
  erwarte(abschnitte.length >= 5, 'Statistikseite zeichnet ihre Abschnitte')
  await S.context.close()
} finally {
  await browser.close()
}

log('')
if (befunde.length === 0) {
  log('✓ Durchklick ohne Befund')
} else {
  log('Befunde:')
  for (const b of befunde) log('  ' + b)
  process.exitCode = 1
}
