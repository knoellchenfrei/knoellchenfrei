import { describe, expect, it } from 'vitest'
import { EVENT_NAMES } from '@knoellchenfrei/core'

import { nieGezaehlt } from '../statistik/luecken.js'

describe('nieGezaehlt', () => {
  it('nennt jedes Katalogereignis, das im Stand fehlt, in Katalogreihenfolge', () => {
    const stand = [{ name: 'app.open' }, { name: 'zone.open' }, { name: 'unbekannt' }]
    const luecken = nieGezaehlt(stand)
    expect(luecken).not.toContain('app.open')
    expect(luecken).not.toContain('zone.open')
    expect(luecken).toContain('tow.open')
    expect(luecken).toEqual(EVENT_NAMES.filter((n) => n !== 'app.open' && n !== 'zone.open'))
  })

  it('ist leer, wenn alles gezählt wurde — und voll, wenn nichts', () => {
    expect(nieGezaehlt(EVENT_NAMES.map((name) => ({ name })))).toEqual([])
    expect(nieGezaehlt([])).toEqual([...EVENT_NAMES])
  })
})
