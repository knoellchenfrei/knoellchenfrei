// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { SearchBox } from '../src/components/SearchBox.js'
import { loadZones, type ZoneFeature } from '../src/zones.js'

/**
 * Das Suchfeld: Zonen und Bezirke vom Gerät, Straßen von Photon. Zwei Regeln
 * hängen daran, die vorher nur im Quelltext standen: Hamburgs Quell-Kennungen
 * (`DE.HH.…`) sind keine Namen — auf „de" kämen sonst 44 Treffer —, und eine
 * Straßenanfrage geht erst, wenn die Tastatur 300 ms ruht.
 */
afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.restoreAllMocks()
})

function flaeche(zone: string, district: string): ZoneFeature {
  return {
    properties: {
      zone,
      district,
      rawHours: 'Mo-Sa 9-20 Uhr',
      rawFee: '2,00 Euro',
      note: null,
      windows: [],
      fee: { kind: 'exact', centsPerHour: 200 },
      unmodelledRules: [],
      sourceDefect: null,
      spaces: null,
      maxStay: null,
      maxStayShare: 0,
      maxStayValues: [],
      chargingPoints: 0,
      carsharing: 0,
    },
    geometry: {
      type: 'Polygon',
      coordinates: [
        [
          [13.4, 52.5],
          [13.41, 52.5],
          [13.41, 52.51],
          [13.4, 52.51],
          [13.4, 52.5],
        ],
      ],
    },
  } as unknown as ZoneFeature
}

const zones = loadZones({
  features: [
    flaeche('12', 'Mitte'),
    flaeche('120', 'Pankow'),
    flaeche('DE.HH.UP_BEWOHNERPARKGEBIETE_31973', 'Altona'),
    flaeche('DE.HH.UP_BEWOHNERPARKGEBIETE_31974', 'Altona'),
  ],
})

function zeichne() {
  const onPick = vi.fn()
  const onPickStreet = vi.fn()
  render(<SearchBox zones={zones} onPick={onPick} onPickStreet={onPickStreet} />)
  const feld = screen.getByRole('searchbox', { name: /Zone, Bezirk oder Straße/ })
  return { onPick, onPickStreet, feld }
}

const treffer = () => screen.queryAllByRole('button').map((b) => b.textContent)

describe('SearchBox', () => {
  beforeEach(() => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(Response.json({ features: [] }))
  })

  it('findet Zonen an der Nummer und Bezirke am Namen, und die Auswahl räumt das Feld', () => {
    const { onPick, feld } = zeichne()
    fireEvent.change(feld, { target: { value: '12' } })
    expect(treffer()).toEqual(['Zone 12Mitte', 'Zone 120Pankow'])
    fireEvent.change(feld, { target: { value: 'alto' } })
    expect(treffer()).toHaveLength(2)
    fireEvent.click(screen.getAllByRole('button')[0]!)
    expect(onPick).toHaveBeenCalledWith(expect.objectContaining({ properties: expect.objectContaining({ district: 'Altona' }) }))
    expect((feld as HTMLInputElement).value).toBe('')
  })

  it('findet Hamburger Flächen nicht über ihre Quell-Kennung', () => {
    const { feld } = zeichne()
    fireEvent.change(feld, { target: { value: 'de' } })
    expect(treffer()).toEqual([])
    expect(screen.getByRole('status').textContent).toBe('Keine Treffer')
  })

  it('fragt Photon erst nach 300 ms Ruhe und nur einmal je Eingabefolge', async () => {
    vi.useFakeTimers()
    const { feld } = zeichne()
    fireEvent.change(feld, { target: { value: 'Tor' } })
    fireEvent.change(feld, { target: { value: 'Tors' } })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(299)
    })
    expect(fetch).not.toHaveBeenCalled()
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1)
    })
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(new URL(String(vi.mocked(fetch).mock.calls[0]?.[0])).searchParams.get('q')).toBe('Tors')
  })

  it('zeigt Straßen unter einer Gruppenzeile, wenn es auch Zonen gibt, und reicht den Treffer durch', async () => {
    vi.useFakeTimers()
    vi.mocked(fetch).mockResolvedValue(
      Response.json({
        features: [{ geometry: { coordinates: [13.4, 52.53] }, properties: { name: 'Torstraße', district: 'Mitte' } }],
      }),
    )
    const { onPickStreet, feld } = zeichne()
    fireEvent.change(feld, { target: { value: 'mit' } })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300)
    })
    expect(screen.getByText('Straßen')).toBeTruthy()
    const strasse = screen.getByRole('button', { name: /Torstraße/ })
    fireEvent.click(strasse)
    expect(onPickStreet).toHaveBeenCalledWith({ name: 'Torstraße', detail: 'Mitte', position: [13.4, 52.53] })
  })
})
