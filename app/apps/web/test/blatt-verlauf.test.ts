import { describe, expect, it } from 'vitest'

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
