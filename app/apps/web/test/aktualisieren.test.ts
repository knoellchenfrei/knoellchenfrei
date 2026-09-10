import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it, vi } from 'vitest'

const lies = (pfad: string): string =>
  readFileSync(fileURLToPath(new URL(pfad, import.meta.url)), 'utf8')

/**
 * Die Nachricht, mit der die Seite die wartende Version übernimmt.
 *
 * Es sind zwei Dateien, die sich auf eine Zeichenkette einigen müssen:
 * `src/pwa.ts` schickt `postMessage({ type: 'skip-waiting' })`, und
 * `src/sw-template.js` hört darauf. Beide sind für sich richtig, und keine
 * merkt es, wenn die andere umbenannt wird — der Knopf „Aktualisieren"
 * verschwindet dann nicht, er **tut nur nichts mehr**. Danach hängt jede
 * bereits installierte App auf ihrer alten Version, bis der Browser den
 * Worker von sich aus ersetzt.
 *
 * Genau die Form, an der dieses Projekt mehrfach hing: etwas meldet Erfolg
 * und bewirkt nichts. Deshalb steht der Name hier einmal ausgeschrieben, und
 * beide Seiten werden dagegen gehalten.
 */
const NACHRICHT = 'skip-waiting'

/** Block- und Zeilenkommentare heraus — sie erwähnen, was sie erklären. */
const ohneKommentare = (quelle: string): string =>
  quelle.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

describe('die Seite und der Service Worker einigen sich auf dieselbe Nachricht', () => {
  const pwa = lies('../src/pwa.ts')
  const sw = lies('../src/sw-template.js')

  it('pwa.ts schickt genau diese Nachricht', () => {
    expect(pwa).toContain(`postMessage({ type: '${NACHRICHT}' })`)
  })

  it('der Service Worker hört auf genau diese Nachricht', () => {
    expect(sw).toMatch(/addEventListener\('message'/)
    expect(sw).toContain(`event.data.type === '${NACHRICHT}'`)
    expect(sw).toContain('self.skipWaiting()')
  })

  // Ob der Worker beim Installieren die Finger vom `skipWaiting` lässt, prüft
  // `service-worker.test.ts` am laufenden Skript; hier nur der Vertrag über
  // die Zeichenkette.
})

/**
 * Die Seite, ausgeführt: `registerServiceWorker` gegen einen gestellten
 * `navigator.serviceWorker`. Bis zum 10. September stand hier ein Grep nach
 * `addEventListener(\n    'controllerchange'` — vier Leerzeichen Einrückung
 * als Zusicherung, und ein Formatierer hätte die Suite gebrochen.
 */
describe('die Seite lädt erst neu, wenn der neue Worker das Ruder hat', () => {
  async function stelle(wartend: boolean) {
    vi.resetModules()
    const worker = { postMessage: vi.fn() }
    const registration = {
      waiting: wartend ? worker : null,
      installing: null,
      addEventListener: vi.fn(),
    }
    const swHandlers = new Map<string, () => void>()
    const winHandlers = new Map<string, () => void>()
    const reload = vi.fn()
    vi.stubGlobal('navigator', {
      serviceWorker: {
        register: vi.fn(() => Promise.resolve(registration)),
        addEventListener: (name: string, handler: () => void) => swHandlers.set(name, handler),
        controller: null,
      },
      userAgent: 'test',
    })
    vi.stubGlobal('window', {
      addEventListener: (name: string, handler: () => void) => winHandlers.set(name, handler),
      location: { reload },
      matchMedia: () => ({ matches: false }),
      navigator: {},
    })
    const pwa = await import('../src/pwa.js')
    pwa.registerServiceWorker()
    winHandlers.get('load')?.()
    await new Promise((r) => setTimeout(r, 0))
    return { pwa, worker, swHandlers, reload }
  }

  afterEach(() => vi.unstubAllGlobals())

  it('meldet eine wartende Version, schickt auf Wunsch die Nachricht und lädt erst nach der Übernahme', async () => {
    const { pwa, worker, swHandlers, reload } = await stelle(true)
    const bereit = vi.fn()
    pwa.watchUpdate(bereit)
    expect(bereit).toHaveBeenLastCalledWith(true)
    pwa.applyUpdate()
    expect(worker.postMessage).toHaveBeenCalledWith({ type: NACHRICHT })
    expect(reload).not.toHaveBeenCalled()
    swHandlers.get('controllerchange')?.()
    expect(reload).toHaveBeenCalledTimes(1)
  })

  it('tut ohne wartende Version nichts', async () => {
    const { pwa, worker, reload } = await stelle(false)
    const bereit = vi.fn()
    pwa.watchUpdate(bereit)
    expect(bereit).toHaveBeenLastCalledWith(false)
    pwa.applyUpdate()
    expect(worker.postMessage).not.toHaveBeenCalled()
    expect(reload).not.toHaveBeenCalled()
  })

})
