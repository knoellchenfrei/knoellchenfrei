// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { BERLIN, type City } from '@knoellchenfrei/core'

/**
 * Der bewusste Wechsel über eine Landesgrenze (Betreiber, 16. September):
 * In der Stadtwahl steht erst das Land, dann die Stadt; der Standort-
 * Vorschlag nennt das Land, sobald es ein anderes ist.
 */
const WIEN: City = {
  ...BERLIN,
  key: 'wien',
  name: 'Wien',
  land: 'AT-W',
  center: [16.37, 48.21],
  reportBounds: { minLon: 16.1, minLat: 48.1, maxLon: 16.6, maxLat: 48.35 },
  sessionBounds: { minLon: 16.0, minLat: 48.0, maxLon: 16.7, maxLat: 48.45 },
}

vi.mock('../src/city.js', () => ({
  CITY: BERLIN,
  selectableCities: () => [BERLIN, WIEN],
  switchCity: vi.fn(),
  recentCities: () => [],
}))

// Das Einstellungsblatt liest `__BETA__`, das Vite zur Bauzeit setzt; im
// Test gibt es keinen Bau, also den Schalter selbst setzen.
;(globalThis as { __BETA__?: boolean }).__BETA__ = true

afterEach(cleanup)

describe('CitySuggestion', () => {
  it('nennt das Land, sobald der Vorschlag über eine Grenze geht', async () => {
    const { CitySuggestion } = await import('../src/components/CitySuggestion.js')
    render(<CitySuggestion city={WIEN} current={BERLIN} onSwitch={() => {}} onStay={() => {}} />)
    expect(screen.getByText(/Dein Standort liegt in Wien \(Österreich\)\./)).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Zu Wien (Österreich) wechseln' })).toBeTruthy()
    expect(screen.getByText(/für Berlin \(Deutschland\)/)).toBeTruthy()
  })

  it('lässt das Land weg, wenn beide Städte im selben liegen', async () => {
    const { CitySuggestion } = await import('../src/components/CitySuggestion.js')
    const hamburg: City = { ...BERLIN, key: 'hamburg', name: 'Hamburg', land: 'HH' }
    render(<CitySuggestion city={hamburg} current={BERLIN} onSwitch={() => {}} onStay={() => {}} />)
    expect(screen.getByRole('button', { name: 'Zu Hamburg wechseln' })).toBeTruthy()
    expect(screen.queryByText(/Deutschland/)).toBeNull()
  })
})

describe('die Stadtwahl in den Einstellungen', () => {
  it('zeigt erst das Land der aktuellen Stadt und Wien erst nach dem Wechsel auf Österreich', async () => {
    const { SettingsSheet } = await import('../src/components/SettingsSheet.js')
    render(
      <SettingsSheet
        onClose={() => {}}
        onFeedback={() => {}}
        imprintUrl="https://example.org/impressum"
        privacyUrl="https://example.org/datenschutz"
        source="Test"
        licence="Test"
        licenceUrl="https://example.org/lizenz"
        geprueftAm={null}
      />,
    )
    const land = screen.getByRole('combobox', { name: 'Land' }) as HTMLSelectElement
    expect(land.value).toBe('DE')
    expect(screen.getByRole('option', { name: 'Deutschland' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Wien' })).toBeNull()
    expect(screen.getByRole('button', { name: /Berlin/ })).toBeTruthy()

    fireEvent.change(land, { target: { value: 'AT' } })
    expect(screen.getByRole('button', { name: /Wien/ })).toBeTruthy()
    expect(screen.queryByRole('button', { name: /^Berlin/ })).toBeNull()
  })
})
