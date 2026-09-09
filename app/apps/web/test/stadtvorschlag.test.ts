import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { CITIES } from '@knoellchenfrei/core'

/**
 * Der Standort-Vorschlag — die Schicht mit Gedächtnis.
 *
 * Die Entscheidung selbst (`suggestCity`) steht in `core` und wird dort
 * beschossen. Hier steht, was ohne Browser keinen Sinn ergibt, und genau das
 * hatte **0 % Abdeckung**: was jemand weggeklickt hat, und welche Städte diese
 * Auslieferung überhaupt anbieten darf.
 *
 * Der teuerste Fehler dieser Art steht als Begründung in `city.ts`: einen
 * Vorschlag anzubieten, dessen Annahme in „Diese Fassung enthält muenchen
 * nicht" endet — sichtbar erst nach dem Neuladen, und dann als leere Seite.
 * Im Artifact ist genau das der Normalfall: Dort kann nichts nachgeladen
 * werden, es gibt nur die eingebetteten Städte.
 */

const KEY = 'knoellchenfrei:city-suggestion-dismissed'

let inhalt: Record<string, string>

/**
 * Stellt Speicher und Fenster.
 *
 * `eingebettet` bildet das Artifact nach: Ist es gesetzt, kennt
 * `availableCities()` nur diese Schlüssel; ist es `null`, ist es ein
 * statischer Host, der jede Stadt nachlädt.
 */
function stelle(eingebettet: string[] | null, stadt = 'berlin'): void {
  inhalt = { 'knoellchenfrei:city': stadt }
  const speicher = {
    getItem: (k: string) => inhalt[k] ?? null,
    setItem: (k: string, v: string) => {
      inhalt[k] = v
    },
    removeItem: (k: string) => {
      delete inhalt[k]
    },
  }
  const fenster: Record<string, unknown> = { localStorage: speicher }
  if (eingebettet !== null) {
    fenster['__PARKINGZONE_DATA__'] = Object.fromEntries(eingebettet.map((k) => [k, {}]))
  }
  vi.stubGlobal('localStorage', speicher)
  vi.stubGlobal('window', fenster)
  vi.stubGlobal('navigator', {})
}

const mitte = (key: string): readonly [number, number] => {
  const stadt = CITIES.find((c) => c.key === key)
  if (stadt === undefined) throw new Error(`unbekannt: ${key}`)
  return stadt.center
}

beforeEach(() => {
  vi.resetModules()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('was diese Auslieferung nicht laden kann, schlägt sie nicht vor', () => {
  it('auf einem statischen Host wird München vorgeschlagen', async () => {
    stelle(null, 'berlin')
    const { suggestionAt } = await import('../src/city-suggestion.js')
    const [lon, lat] = mitte('muenchen')
    expect(suggestionAt(lon, lat)?.key).toBe('muenchen')
  })

  it('im Artifact ohne München bleibt der Vorschlag aus', async () => {
    stelle(['berlin', 'hamburg'], 'berlin')
    const { suggestionAt } = await import('../src/city-suggestion.js')
    const [lon, lat] = mitte('muenchen')
    expect(suggestionAt(lon, lat)).toBeNull()
  })

  it('die eigene Stadt schlägt sich nicht selbst vor', async () => {
    stelle(null, 'berlin')
    const { suggestionAt } = await import('../src/city-suggestion.js')
    const [lon, lat] = mitte('berlin')
    expect(suggestionAt(lon, lat)).toBeNull()
  })

  it('mitten im Nirgendwo gibt es keinen Vorschlag', async () => {
    stelle(null, 'berlin')
    const { suggestionAt } = await import('../src/city-suggestion.js')
    expect(suggestionAt(0, 0)).toBeNull()
  })
})

describe('was weggeklickt wurde, kommt nicht wieder', () => {
  it('nach dem Merken bleibt der Vorschlag aus', async () => {
    stelle(null, 'berlin')
    const modul = await import('../src/city-suggestion.js')
    const [lon, lat] = mitte('hamburg')
    expect(modul.suggestionAt(lon, lat)?.key).toBe('hamburg')
    modul.rememberSuggestionDismissed('hamburg')
    expect(modul.suggestionAt(lon, lat)).toBeNull()
  })

  it('eine Ablehnung gilt der Stadt, nicht dem Hinweis', async () => {
    stelle(null, 'berlin')
    const modul = await import('../src/city-suggestion.js')
    modul.rememberSuggestionDismissed('hamburg')
    const [lon, lat] = mitte('muenchen')
    expect(modul.suggestionAt(lon, lat)?.key).toBe('muenchen')
  })

  it('zweimal dasselbe wegklicken schreibt nicht zweimal', async () => {
    stelle(null, 'berlin')
    const modul = await import('../src/city-suggestion.js')
    modul.rememberSuggestionDismissed('hamburg')
    modul.rememberSuggestionDismissed('hamburg')
    expect(JSON.parse(inhalt[KEY] as string)).toEqual(['hamburg'])
  })
})

describe('der Speicher wird auf dem Rückweg nicht geglaubt', () => {
  it.each([
    ['kein JSON', '{kaputt'],
    ['keine Liste', '"hamburg"'],
    ['null', 'null'],
    ['ein Objekt', '{"hamburg":true}'],
  ])('%s ergibt „noch nichts abgelehnt"', async (_name, roh) => {
    stelle(null, 'berlin')
    inhalt[KEY] = roh
    const { dismissedSuggestions } = await import('../src/city-suggestion.js')
    expect(dismissedSuggestions()).toEqual([])
  })

  it('Nicht-Zeichenketten in der Liste fallen einzeln heraus', async () => {
    stelle(null, 'berlin')
    inhalt[KEY] = JSON.stringify(['hamburg', 42, null, { a: 1 }, 'muenchen'])
    const { dismissedSuggestions } = await import('../src/city-suggestion.js')
    expect(dismissedSuggestions()).toEqual(['hamburg', 'muenchen'])
  })

  it('ein gesperrter Speicher wirft nicht durch', async () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('privates Fenster')
      },
      setItem: () => {
        throw new Error('privates Fenster')
      },
    })
    vi.stubGlobal('window', {})
    vi.stubGlobal('navigator', {})
    const modul = await import('../src/city-suggestion.js')
    expect(modul.dismissedSuggestions()).toEqual([])
    expect(() => modul.rememberSuggestionDismissed('hamburg')).not.toThrow()
  })
})
