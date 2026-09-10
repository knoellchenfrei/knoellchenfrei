import { describe, expect, it } from 'vitest'
import { EVENT_NAMES } from '@knoellchenfrei/core'

import { nieGezaehlt } from '../statistik/luecken.js'

describe('nieGezaehlt', () => {
  it('nennt jedes Katalogereignis, das im Stand fehlt, in Katalogreihenfolge', () => {
    // Fast alles gezählt, drei Lücken quer über den Katalog — das Ergebnis
    // steht als Literal, nicht als Filter über den Katalog: Ein Filter hätte
    // dieselbe Logik wie die Funktion und könnte nie rot werden.
    const gezaehlt = EVENT_NAMES.filter(
      (name) => name !== 'zone.answer' && name !== 'city.suggest' && name !== 'tow.open',
    )
    const stand = [...gezaehlt.map((name) => ({ name })), { name: 'unbekannt' }]
    expect(nieGezaehlt(stand)).toEqual(['zone.answer', 'city.suggest', 'tow.open'])
  })

  it('ist leer, wenn alles gezählt wurde — und voll, wenn nichts', () => {
    expect(nieGezaehlt(EVENT_NAMES.map((name) => ({ name })))).toEqual([])
    expect(nieGezaehlt([])).toEqual([...EVENT_NAMES])
  })
})
