// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'

/**
 * Der Länderschalter in der Web-App (30. September): Ohne Wert zeigt die
 * Auslieferung nur Deutschland — die anderen Städte bleiben im Bündel, sind
 * aber nicht wählbar, und eine gemerkte Stadt aus einem abgeschalteten Land
 * fällt auf die Vorgabe zurück und löst die Frage beim Start wieder aus.
 * Alle anderen Tests laufen mit `VITE_COUNTRIES=alle` (vitest.config.ts).
 */
afterEach(() => {
  vi.unstubAllEnvs()
  vi.resetModules()
  localStorage.clear()
})

async function stadtModul(wert: string) {
  vi.stubEnv('VITE_COUNTRIES', wert)
  vi.resetModules()
  return import('../src/city.js')
}

describe('Länderschalter', () => {
  it('zeigt ohne Wert nur deutsche Städte, mit „alle" alle', async () => {
    const nurDe = await stadtModul('')
    expect(nurDe.COUNTRIES).toEqual(['DE'])
    const staedte = nurDe.selectableCities()
    expect(staedte.length).toBeGreaterThanOrEqual(13)
    expect(staedte.some((c) => c.key === 'wien')).toBe(false)
    expect(staedte.some((c) => c.key === 'berlin')).toBe(true)

    const alle = await stadtModul('alle')
    expect(alle.selectableCities().some((c) => c.key === 'wien')).toBe(true)
  })

  it('lässt eine gemerkte Stadt aus einem abgeschalteten Land fallen und fragt wieder', async () => {
    localStorage.setItem('knoellchenfrei:city', 'wien')
    const modul = await stadtModul('')
    expect(modul.CITY.key).toBe('berlin')
    expect(modul.cityChosen()).toBe(false)
  })

  it('behält eine gemerkte deutsche Stadt', async () => {
    localStorage.setItem('knoellchenfrei:city', 'hamburg')
    const modul = await stadtModul('')
    expect(modul.CITY.key).toBe('hamburg')
    expect(modul.cityChosen()).toBe(true)
  })

  it('bricht bei einem unbekannten Kürzel den Start ab, statt still ein Land wegzulassen', async () => {
    await expect(stadtModul('DE,AU')).rejects.toThrow(/Unbekanntes Land/)
  })
})
