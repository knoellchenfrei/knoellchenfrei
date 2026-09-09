import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Woher die App weiß, welche Stadt sie zeigt — und was sie tut, wenn dort
 * Unsinn steht.
 *
 * Der Grundsatz steht in `CLAUDE.md` und ist nicht symmetrisch, mit Absicht:
 *
 * * Ein unbekannter Schlüssel **aus dem Speicher** wird verworfen. Dort kann
 *   alles stehen — `localStorage` übersteht Deploys und lässt sich von Hand
 *   ändern. Eine Ausnahme durch den Modulstart zu tragen hiesse: schwarze
 *   Seite, und niemand kommt an die Einstellungen, um es zurückzustellen.
 * * Ein unbekannter Schlüssel **aus der Bauzeit** wirft. Ein Tippfehler in
 *   der Deployment-Konfiguration soll den Build anhalten, statt still Berlin
 *   auszuliefern: Eine Hamburg-Instanz mit `VITE_CITY=hambrug` legte sonst
 *   Berliner Grenzen an und wiese jede Hamburger Meldung ab — im Log stünde
 *   nichts, was nach einem Fehler aussieht.
 *
 * Beides war bis zum 9. September ungeprüft. `cityByKey` in `core` hat Tests;
 * dass diese Datei sie an zwei Stellen verschieden benutzt, hatte keine.
 */

const SPEICHER = 'knoellchenfrei:city'

function stelleUmgebung(gespeichert: string | null): void {
  const inhalt: Record<string, string> = {}
  if (gespeichert !== null) inhalt[SPEICHER] = gespeichert
  const speicher = {
    getItem: (k: string) => inhalt[k] ?? null,
    setItem: (k: string, v: string) => {
      inhalt[k] = v
    },
    removeItem: (k: string) => {
      delete inhalt[k]
    },
  }
  vi.stubGlobal('localStorage', speicher)
  vi.stubGlobal('window', { localStorage: speicher })
  vi.stubGlobal('navigator', {})
}

beforeEach(() => {
  vi.resetModules()
  vi.unstubAllEnvs()
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

describe('welche Stadt die Ansicht zeigt', () => {
  it('ohne alles: Berlin, weil damit angefangen wurde', async () => {
    stelleUmgebung(null)
    const { CITY } = await import('../src/city.js')
    expect(CITY.key).toBe('berlin')
  })

  it('der Speicher gewinnt gegen die Bauzeit — er ist die jüngere Aussage', async () => {
    vi.stubEnv('VITE_CITY', 'frankfurt')
    stelleUmgebung('muenchen')
    const { CITY } = await import('../src/city.js')
    expect(CITY.key).toBe('muenchen')
  })

  it('die Bauzeit gilt, wenn im Speicher nichts steht', async () => {
    vi.stubEnv('VITE_CITY', 'hamburg')
    stelleUmgebung(null)
    const { CITY } = await import('../src/city.js')
    expect(CITY.key).toBe('hamburg')
  })

  it('ein leeres VITE_CITY ist wie keines', async () => {
    vi.stubEnv('VITE_CITY', '')
    stelleUmgebung(null)
    const { CITY } = await import('../src/city.js')
    expect(CITY.key).toBe('berlin')
  })

  it('Unsinn im Speicher wird verworfen, nicht geworfen', async () => {
    stelleUmgebung('hambrug')
    const { CITY } = await import('../src/city.js')
    expect(CITY.key).toBe('berlin')
  })

  it('Unsinn im Speicher lässt die Bauzeit gelten', async () => {
    vi.stubEnv('VITE_CITY', 'frankfurt')
    stelleUmgebung('hambrug')
    const { CITY } = await import('../src/city.js')
    expect(CITY.key).toBe('frankfurt')
  })

  it('ein gesperrter Speicher endet in der Voreinstellung, nicht im Absturz', async () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('privates Fenster')
      },
    })
    vi.stubGlobal('window', {})
    vi.stubGlobal('navigator', {})
    const { CITY } = await import('../src/city.js')
    expect(CITY.key).toBe('berlin')
  })

  it('Unsinn aus der Bauzeit wirft — der Build soll anhalten', async () => {
    vi.stubEnv('VITE_CITY', 'hambrug')
    stelleUmgebung(null)
    await expect(import('../src/city.js')).rejects.toThrow(/hambrug/)
  })
})
