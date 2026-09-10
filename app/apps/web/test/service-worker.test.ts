import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it, vi } from 'vitest'

/**
 * Der Service Worker, ausgeführt statt gegrept: `sw-template.js` läuft hier
 * in einem gestellten `self`, und die Regeln aus CLAUDE.md werden am Verhalten
 * gemessen — `cache.add` je Eintrag statt `addAll` (eine 308 kostet einen
 * Eintrag, nicht alle), kein `skipWaiting` beim Installieren, und die
 * Statistikseite bleibt aus dem Vorrat.
 */
const QUELLE = readFileSync(fileURLToPath(new URL('../src/sw-template.js', import.meta.url)), 'utf8')
  .replaceAll('__BUILD_ID__', 'test')
  .replace('__SHELL_ASSETS__', "'./assets/index-test.js', './data/berlin/zones.geojson'")

type Handler = (event: Record<string, unknown>) => void

function starte(options: { scheitert?: string[]; vorrat?: Record<string, Response> } = {}) {
  const handlers = new Map<string, Handler>()
  const abgelegt: string[] = []
  const gelegt: string[] = []
  const geloescht: string[] = []
  const cache = {
    add: (pfad: string) =>
      options.scheitert?.includes(pfad) ? Promise.reject(new Error('308')) : (abgelegt.push(pfad), Promise.resolve()),
    put: (request: Request) => (gelegt.push(request.url), Promise.resolve()),
  }
  const caches = {
    open: () => Promise.resolve(cache),
    keys: () => Promise.resolve(['knoellchenfrei-alt', 'knoellchenfrei-test', 'fremd']),
    delete: (key: string) => (geloescht.push(key), Promise.resolve(true)),
    match: (request: Request) => Promise.resolve(options.vorrat?.[new URL(request.url).pathname]),
  }
  const self = {
    addEventListener: (name: string, handler: Handler) => handlers.set(name, handler),
    skipWaiting: vi.fn(),
    clients: { claim: vi.fn() },
    location: { origin: 'https://knoellchenfrei.de' },
  }
  const warn = vi.fn()
  new Function('self', 'caches', 'console', QUELLE)(self, caches, { warn })
  const feuere = async (name: string, event: Record<string, unknown> = {}) => {
    let warten: Promise<unknown> = Promise.resolve()
    let antwort: Promise<Response> | undefined
    handlers.get(name)!({
      ...event,
      waitUntil: (p: Promise<unknown>) => {
        warten = p
      },
      respondWith: (p: Promise<Response>) => {
        antwort = p
      },
    })
    await warten
    return antwort
  }
  return { self, feuere, abgelegt, gelegt, geloescht, warn }
}

describe('der Service Worker', () => {
  it('legt jeden Vorratspfad einzeln ab — ein Fehlschlag kostet einen Eintrag, nicht alle', async () => {
    const { abgelegt, warn, feuere } = starte({ scheitert: ['./index.html', './'] })
    await feuere('install')
    expect(abgelegt).toContain('./manifest.webmanifest')
    expect(abgelegt).toContain('./data/berlin/zones.geojson')
    expect(abgelegt).not.toContain('./')
    expect(warn).toHaveBeenCalledWith('[sw] nicht vorgehalten:', './')
  })

  it('übernimmt nicht beim Installieren, sondern erst auf die Nachricht der Seite', async () => {
    const { self, feuere } = starte()
    await feuere('install')
    expect(self.skipWaiting).not.toHaveBeenCalled()
    await feuere('message', { data: { type: 'irgendwas' } })
    expect(self.skipWaiting).not.toHaveBeenCalled()
    await feuere('message', { data: { type: 'skip-waiting' } })
    expect(self.skipWaiting).toHaveBeenCalledTimes(1)
  })

  it('räumt beim Aktivieren die Vorräte anderer Builds ab und übernimmt die offenen Seiten', async () => {
    const { self, geloescht, feuere } = starte()
    await feuere('activate')
    expect(geloescht).toEqual(['knoellchenfrei-alt', 'fremd'])
    expect(self.clients.claim).toHaveBeenCalledTimes(1)
  })

  it('beantwortet nur eigene GET-Anfragen auf Vorratspfade — die Statistikseite nie', async () => {
    const { feuere } = starte()
    const anfrage = (url: string, method = 'GET') => ({ request: new Request(url, { method }) })
    expect(await feuere('fetch', anfrage('https://knoellchenfrei.de/data/berlin/meta.json', 'POST'))).toBeUndefined()
    expect(await feuere('fetch', anfrage('https://photon.komoot.io/api/'))).toBeUndefined()
    expect(await feuere('fetch', anfrage('https://knoellchenfrei.de/statistik/'))).toBeUndefined()
    expect(await feuere('fetch', anfrage('https://knoellchenfrei.de/sightings?city=berlin'))).toBeUndefined()
  })

  it('liefert aus dem Vorrat, holt sonst vom Netz und legt nur Erfolgreiches ab', async () => {
    const vorrat = { '/data/berlin/meta.json': new Response('{"a":1}') }
    const { feuere, gelegt } = starte({ vorrat })
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response('ok', { status: 200 }))
      .mockResolvedValueOnce(new Response('weg', { status: 404 }))
    const treffer = await feuere('fetch', { request: new Request('https://knoellchenfrei.de/data/berlin/meta.json') })
    expect(await treffer?.text()).toBe('{"a":1}')
    expect(fetchMock).not.toHaveBeenCalled()
    await feuere('fetch', { request: new Request('https://knoellchenfrei.de/assets/neu.js') })
    await feuere('fetch', { request: new Request('https://knoellchenfrei.de/assets/fehlt.js') })
    await new Promise((r) => setTimeout(r, 0))
    expect(gelegt).toEqual(['https://knoellchenfrei.de/assets/neu.js'])
    fetchMock.mockRestore()
  })
})
