import { afterEach, describe, expect, it, vi } from 'vitest'

import { forgetStaleLayer, layerOf, syncLayer, type HistoryLike } from '../src/layer-history.js'
import { keyboardInset } from '../src/viewport.js'

/** Ein Verlauf aus Einträgen, der `back()` sofort ausführt. */
function fakeHistory(): HistoryLike & { entries: unknown[]; calls: string[] } {
  const entries: unknown[] = [null]
  const calls: string[] = []
  return {
    entries,
    calls,
    get state() {
      return entries[entries.length - 1]
    },
    pushState(state) {
      calls.push('push')
      entries.push(state)
    },
    replaceState(state) {
      calls.push('replace')
      entries[entries.length - 1] = state
    },
    back() {
      calls.push('back')
      entries.pop()
    },
  }
}

describe('Verlaufseintrag für offene Blätter', () => {
  it('legt beim Öffnen einen Eintrag an und räumt ihn beim Schließen ab', () => {
    const history = fakeHistory()
    syncLayer(history, null, 'einstellungen')
    expect(layerOf(history.state)).toBe('einstellungen')
    syncLayer(history, 'einstellungen', null)
    expect(history.entries).toEqual([null])
    expect(history.calls).toEqual(['push', 'back'])
  })

  it('ersetzt den Eintrag beim Wechsel von Blatt zu Blatt, statt zu stapeln', () => {
    const history = fakeHistory()
    syncLayer(history, null, 'einstellungen')
    syncLayer(history, 'einstellungen', 'feedback')
    expect(history.entries).toHaveLength(2)
    expect(layerOf(history.state)).toBe('feedback')
    expect(history.calls).toEqual(['push', 'replace'])
  })

  it('geht nach einem „Zurück" nicht ein zweites Mal zurück', () => {
    const history = fakeHistory()
    syncLayer(history, null, 'melden')
    // Der Browser hat den Eintrag schon abgeräumt; die Oberfläche zieht nach.
    history.entries.pop()
    syncLayer(history, 'melden', null)
    expect(history.calls).toEqual(['push'])
    expect(history.entries).toEqual([null])
  })

  it('tut nichts, wenn sich nichts geändert hat', () => {
    const history = fakeHistory()
    syncLayer(history, null, null)
    syncLayer(history, 'feedback', 'feedback')
    expect(history.calls).toEqual([])
  })

  it('liest fremde Zustände als Grundansicht', () => {
    expect(layerOf(null)).toBeNull()
    expect(layerOf('einstellungen')).toBeNull()
    expect(layerOf({ etwas: 'anderes' })).toBeNull()
    expect(layerOf({ knoellchenfreiBlatt: 3 })).toBeNull()
  })

  it('vergisst nach dem Neuladen einen übrig gebliebenen Eintrag', () => {
    const history = fakeHistory()
    history.pushState({ knoellchenfreiBlatt: 'einstellungen' }, '')
    forgetStaleLayer(history)
    expect(layerOf(history.state)).toBeNull()
    expect(history.calls).toEqual(['push', 'replace'])
    // Ohne Eintrag wird auch nichts angefasst.
    forgetStaleLayer(fakeHistory())
  })
})

describe('Tastatur-Inset', () => {
  it('meldet die Differenz erst, wenn sie nach Tastatur aussieht', () => {
    expect(keyboardInset(844, 844)).toBe(0)
    // Die eingeblendete Adressleiste ist keine Tastatur.
    expect(keyboardInset(844, 760)).toBe(0)
    expect(keyboardInset(844, 508)).toBe(336)
    expect(keyboardInset(844, 507.6)).toBe(336)
  })
})

/**
 * `watchKeyboard` — die andere Hälfte von `viewport.ts`.
 *
 * `keyboardInset` ist eine reine Funktion und oben geprüft. Was fehlte, ist
 * das Stück, das sie mit dem Fenster verbindet: Es schreibt zwei
 * CSS-Variablen ans Wurzelelement, und das Blatt nimmt sie als Höhe und
 * Oberkante. Schreibt es sie nicht, liegt der Fuss mit dem Absenden-Knopf auf
 * dem iPhone hinter der Tastatur — wer etwas geschrieben hat, sieht nicht,
 * dass es einen Knopf gibt.
 *
 * Wichtig ist auch die Gegenrichtung: Verschwindet die Tastatur, müssen die
 * Variablen **weg**. Ein stehengebliebenes `--vv-height` liesse das Blatt für
 * den Rest der Sitzung zu kurz.
 */
describe('die Bildschirmtastatur als CSS-Variablen', () => {
  interface Notiz {
    gesetzt: Record<string, string>
    entfernt: string[]
  }

  /** Stellt Fenster und Wurzelelement; gibt den Auslöser und das Mitgeschriebene. */
  function stelle(innerHeight: number): {
    notiz: Notiz
    ausloesen: (hoehe: number, oben?: number) => void
  } {
    const notiz: Notiz = { gesetzt: {}, entfernt: [] }
    let hoehe = innerHeight
    let oben = 0
    const hoerer: (() => void)[] = []
    const viewport = {
      get height() {
        return hoehe
      },
      get offsetTop() {
        return oben
      },
      addEventListener: (_name: string, fn: () => void) => hoerer.push(fn),
    }
    vi.stubGlobal('window', { visualViewport: viewport, innerHeight })
    vi.stubGlobal('document', {
      documentElement: {
        style: {
          setProperty: (k: string, v: string) => {
            notiz.gesetzt[k] = v
            notiz.entfernt = notiz.entfernt.filter((name) => name !== k)
          },
          removeProperty: (k: string) => {
            notiz.entfernt.push(k)
            delete notiz.gesetzt[k]
          },
        },
      },
    })
    return {
      notiz,
      ausloesen: (neueHoehe, neuesOben = 0) => {
        hoehe = neueHoehe
        oben = neuesOben
        for (const fn of hoerer) fn()
      },
    }
  }

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('setzt Höhe und Oberkante, sobald die Tastatur aufgeht', async () => {
    const { notiz, ausloesen } = stelle(800)
    const { watchKeyboard } = await import('../src/viewport.js')
    watchKeyboard()
    ausloesen(450, 12)
    expect(notiz.gesetzt).toEqual({ '--vv-height': '450px', '--vv-top': '12px' })
  })

  it('räumt sie wieder weg, wenn die Tastatur zugeht', async () => {
    const { notiz, ausloesen } = stelle(800)
    const { watchKeyboard } = await import('../src/viewport.js')
    watchKeyboard()
    ausloesen(450, 12)
    ausloesen(800, 0)
    expect(notiz.gesetzt).toEqual({})
    expect(notiz.entfernt).toContain('--vv-height')
    expect(notiz.entfernt).toContain('--vv-top')
  })

  it('lässt eine kleine Differenz in Ruhe — das ist eine Leiste, keine Tastatur', async () => {
    const { notiz, ausloesen } = stelle(800)
    const { watchKeyboard } = await import('../src/viewport.js')
    watchKeyboard()
    ausloesen(720)
    expect(notiz.gesetzt).toEqual({})
  })

  it('tut nichts, wo es kein visualViewport gibt', async () => {
    vi.stubGlobal('window', {})
    vi.stubGlobal('document', {
      documentElement: {
        style: {
          setProperty: () => {
            throw new Error('darf nicht angefasst werden')
          },
          removeProperty: () => {
            throw new Error('darf nicht angefasst werden')
          },
        },
      },
    })
    const { watchKeyboard } = await import('../src/viewport.js')
    expect(() => watchKeyboard()).not.toThrow()
  })
})
