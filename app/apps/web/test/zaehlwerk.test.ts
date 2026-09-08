import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Der Zähler in der App — die Hälfte, die vorher keinen Test hatte.
 *
 * `apps/api` prüft, was der Worker mit einem Bündel macht. Ob überhaupt eins
 * losgeschickt wird, entscheidet aber diese Datei, und zwar an vier Stellen:
 * drei Gründe, aus denen gar nichts gesendet wird, und die Zusammenfassung,
 * die aus einer Folge eine Summe macht. Genau diese Zusammenfassung ist das
 * Datenschutzversprechen — „keine Reihenfolge" ist keine Absichtserklärung,
 * sondern eine Eigenschaft des Codes, und Eigenschaften gehören geprüft.
 *
 * Ohne jsdom: `track.ts` fragt jede Browser-Fähigkeit ab, bevor es sie
 * benutzt, und lässt sich deshalb mit gestellten Globals prüfen. Eine
 * DOM-Attrappe als Abhängigkeit wäre für vier Objekte zu viel.
 */

interface Bündel {
  city: string
  events: { name: string; value: string; n: number }[]
}

let gesendet: Bündel[] = []

/**
 * Lädt das Modul frisch — `API_BASE` wird beim Import einmal ausgewertet.
 *
 * `null` und nicht `undefined` für „keine Adresse": `laden(undefined)` würde
 * den Vorgabewert einsetzen, und der Test hätte dann genau das Gegenteil
 * dessen geprüft, was sein Name behauptet. Beim Schreiben dieser Datei ist
 * genau das passiert.
 */
async function laden(basis: string | null = 'https://api.example') {
  vi.resetModules()
  vi.stubEnv('VITE_API_BASE', basis === null ? '' : basis)
  return import('../src/track.js')
}

function speicherAttrappe(inhalt: Record<string, string> = {}) {
  return {
    getItem: (k: string) => inhalt[k] ?? null,
    setItem: (k: string, v: string) => {
      inhalt[k] = v
    },
    removeItem: (k: string) => {
      delete inhalt[k]
    },
  }
}

beforeEach(() => {
  gesendet = []
  vi.stubGlobal('fetch', (_url: string, init: { body: string }) => {
    gesendet.push(JSON.parse(init.body) as Bündel)
    return Promise.resolve(new Response('{}'))
  })
  vi.stubGlobal('localStorage', speicherAttrappe())
  vi.stubGlobal('navigator', {})
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

describe('was hinausgeht', () => {
  it('zählt zusammen, statt eine Folge zu schicken', async () => {
    const { track, trackNow, setTrackCity } = await laden()
    setTrackCity('berlin')
    track('app.open')
    track('zone.open', '34')
    track('app.open')
    trackNow('locate', 'use')

    expect(gesendet).toHaveLength(1)
    const bündel = gesendet[0] as Bündel
    expect(bündel.city).toBe('berlin')
    // Drei Einträge für vier Ereignisse: „geöffnet, Zone 34, geöffnet" wird zu
    // `app.open: 2`. Was in welcher Reihenfolge passiert ist, verlässt das
    // Gerät nicht.
    expect(bündel.events).toHaveLength(3)
    expect(bündel.events.find((e) => e.name === 'app.open')?.n).toBe(2)
    expect(bündel.events.find((e) => e.name === 'zone.open')?.value).toBe('34')
  })

  it('schickt keinen Zeitstempel und keine Kennung mit', async () => {
    const { trackNow, setTrackCity } = await laden()
    setTrackCity('hamburg')
    trackNow('app.open')
    const roh = JSON.stringify(gesendet[0])
    // Nicht „es steht nichts Verdächtiges drin", sondern: Es stehen genau die
    // Felder drin, die dokumentiert sind.
    expect(Object.keys(gesendet[0] as object).sort()).toEqual(['city', 'events'])
    expect(Object.keys((gesendet[0] as Bündel).events[0] as object).sort()).toEqual([
      'n',
      'name',
      'value',
    ])
    expect(roh).not.toMatch(/time|stamp|session|client|id"/i)
  })

  it('leert den Puffer vor dem Senden — eine doppelte Zahl wäre schlimmer als eine fehlende', async () => {
    const { trackNow, setTrackCity } = await laden()
    setTrackCity('berlin')
    trackNow('app.open')
    trackNow('app.open')
    expect(gesendet).toHaveLength(2)
    expect((gesendet[0] as Bündel).events[0]?.n).toBe(1)
    expect((gesendet[1] as Bündel).events[0]?.n).toBe(1)
  })

  it('sendet nichts, solange keine Stadt gesetzt ist', async () => {
    const { trackNow } = await laden()
    trackNow('app.open')
    expect(gesendet).toHaveLength(0)
  })
})

describe('die drei Gründe, aus denen gar nichts gesendet wird', () => {
  it('ohne VITE_API_BASE ist jeder Aufruf ein No-op', async () => {
    const { track, trackNow, setTrackCity } = await laden(null)
    setTrackCity('berlin')
    track('app.open')
    trackNow('locate', 'use')
    expect(gesendet).toHaveLength(0)
  })

  it('nach Widerspruch in den Einstellungen', async () => {
    const { track, trackNow, setStatistikAus, statistikAus, setTrackCity } = await laden()
    setTrackCity('berlin')
    setStatistikAus(true)
    expect(statistikAus()).toBe(true)
    track('app.open')
    trackNow('app.open')
    expect(gesendet).toHaveLength(0)

    // Und wieder an: Der Schalter muss in beide Richtungen wirken. Die
    // Ausschaltbox war in der Oberfläche schon einmal falsch herum verdrahtet.
    setStatistikAus(false)
    expect(statistikAus()).toBe(false)
    trackNow('app.open')
    expect(gesendet).toHaveLength(1)
  })

  it('bei globalPrivacyControl, ohne dass jemand etwas einstellen muss', async () => {
    vi.stubGlobal('navigator', { globalPrivacyControl: true })
    const { trackNow, statistikAus, setTrackCity } = await laden()
    setTrackCity('berlin')
    expect(statistikAus()).toBe(true)
    trackNow('app.open')
    expect(gesendet).toHaveLength(0)
  })

  it('nimmt einen gesperrten Gerätespeicher hin, statt die Anzeige mitzunehmen', async () => {
    // In eingebetteten Zusammenhängen wirft `localStorage` schon beim Lesen.
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('SecurityError')
      },
      setItem: () => {
        throw new Error('SecurityError')
      },
      removeItem: () => {
        throw new Error('SecurityError')
      },
    })
    const { trackNow, statistikAus, setStatistikAus, setTrackCity } = await laden()
    setTrackCity('berlin')
    expect(statistikAus()).toBe(false)
    expect(() => setStatistikAus(true)).not.toThrow()
    expect(() => trackNow('app.open')).not.toThrow()
    expect(gesendet).toHaveLength(1)
  })
})

describe('was der Katalog nicht kennt', () => {
  it('wird verworfen und gemeldet — ein Tippfehler erzeugt sonst eine Dimension für 90 Tage', async () => {
    const warnungen: unknown[] = []
    vi.stubGlobal('console', { ...console, warn: (m: unknown) => warnungen.push(m) })
    const { track, trackNow, setTrackCity } = await laden()
    setTrackCity('berlin')
    track('app.opne' as never)
    trackNow('app.open')
    expect(warnungen).toHaveLength(1)
    expect((gesendet[0] as Bündel).events).toHaveLength(1)
    expect((gesendet[0] as Bündel).events[0]?.name).toBe('app.open')
  })
})
