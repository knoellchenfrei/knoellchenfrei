// @vitest-environment jsdom
import { BERLIN, HAMBURG, WIEN } from '@knoellchenfrei/core'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { CityPicker } from '../src/components/CityPicker.js'

/**
 * „Zuletzt genutzt" in der Stadtwahl — freigegeben vom Betreiber am
 * 18. September nach einer Attrappe: höchstens drei, ohne die aktuelle
 * Stadt, mit grober Zeitangabe, und nur Städte, die es im Bündel gibt.
 */
const jetzt = Date.now()
const T = 24 * 60 * 60 * 1000
vi.mock('../src/city.js', () => ({
  CITY: BERLIN,
  selectableCities: () => [BERLIN, HAMBURG, WIEN],
  switchCity: vi.fn(),
  recentCities: () => [
    { key: 'berlin', at: jetzt - 1 },
    { key: 'wien', at: jetzt - 3 * T },
    { key: 'hamburg', at: jetzt - T },
    { key: 'atlantis', at: jetzt },
  ],
}))

afterEach(cleanup)

describe('CityPicker: zuletzt genutzt', () => {
  it('zeigt die zuletzt gewechselten Städte oben, ohne die aktuelle und ohne unbekannte', () => {
    const onPick = vi.fn()
    render(<CityPicker onPick={onPick} />)
    expect(screen.getByText('Zuletzt genutzt')).toBeTruthy()
    expect(screen.getByText('Alle Städte')).toBeTruthy()
    const zuletzt = document.querySelector('.rows--recent')!
    const zeilen = Array.from(zuletzt.querySelectorAll('button')).map((b) => b.textContent)
    expect(zeilen).toEqual(['Hamburggestern→', 'Wienvor 3 Tagen→'])
    fireEvent.click(zuletzt.querySelector('button')!)
    expect(onPick).toHaveBeenCalledWith(expect.objectContaining({ key: 'hamburg' }))
  })
})
