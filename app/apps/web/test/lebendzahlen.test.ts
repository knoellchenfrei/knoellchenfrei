import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * `presence.ts` — die Zahlen „gerade offen" und „heute", und der Ping, der sie
 * holt. Bis zum 9. September bei 17 % Abdeckung, obwohl dort ein Fehler saß,
 * den man nur um Mitternacht sieht.
 *
 * Der Worker weist eine Kennung ab, deren Tag nicht der heutige ist
 * (`422 stale day`) — sonst liesse sich ein vergangener Tag aufblähen. Die App
 * bildete die Kennung aber **einmal** beim Aufsetzen. Ein Tab, der um 23:55
 * offen war, schickte ab 00:00 stundenlang die Kennung von gestern: jeder Ping
 * ein 422, und weil ein fehlgeschlagener Ping absichtlich still bleibt, stand
 * die ganze Nacht die Zahl von kurz vor Mitternacht auf dem Schirm. Eine tote
 * Zahl, die aussieht wie eine lebende.
 *
 * `visitRowId(at)` bildet sie seitdem bei jedem Ping neu. Genau das wird hier
 * gehalten — mit einer Uhr, die über Mitternacht gestellt wird.
 */

const VISIT_KEY = 'knoellchenfrei.visit.v1'

let inhalt: Record<string, string>
let aufrufe: { url: string; init?: RequestInit }[]

function speicher() {
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

/** Sichtbares Fenster mit Speicher; `sichtbar: false` bildet den weggeschobenen Tab nach. */
function stelleUmgebung(sichtbar = true): void {
  inhalt = {}
  aufrufe = []
  const s = speicher()
  vi.stubGlobal('localStorage', s)
  vi.stubGlobal('window', { localStorage: s })
  vi.stubGlobal('document', { visibilityState: sichtbar ? 'visible' : 'hidden' })
  vi.stubGlobal('crypto', { randomUUID: () => '0123abcd-0000-0000-0000-000000000000' })
  vi.stubGlobal('fetch', (url: string, init?: RequestInit) => {
    aufrufe.push({ url, ...(init === undefined ? {} : { init }) })
    return Promise.resolve({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ today: 7, online: 2 }),
    })
  })
}

const gesendeteKennung = (i: number): string =>
  (JSON.parse(String(aufrufe[i]?.init?.body)) as { id: string }).id

beforeEach(() => {
  vi.resetModules()
  vi.unstubAllEnvs()
  vi.useFakeTimers()
  stelleUmgebung()
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

describe('die Kennung trägt den Tag, an dem sie geschickt wird', () => {
  it('wechselt über Mitternacht, ohne dass jemand neu lädt', async () => {
    // 23:58 Berliner Zeit am 8. September ist 21:58 UTC.
    vi.setSystemTime(new Date('2026-09-08T21:58:00Z'))
    const { visitRowId } = await import('../src/presence.js')
    const vorher = visitRowId(Date.now())
    expect(vorher.startsWith('2026-09-08-')).toBe(true)

    vi.setSystemTime(new Date('2026-09-08T22:05:00Z'))
    const nachher = visitRowId(Date.now())
    expect(nachher.startsWith('2026-09-09-')).toBe(true)
    expect(nachher).not.toBe(vorher)
  })

  it('bleibt innerhalb desselben Tages dieselbe', async () => {
    vi.setSystemTime(new Date('2026-09-08T10:00:00Z'))
    const { visitRowId } = await import('../src/presence.js')
    const erst = visitRowId(Date.now())
    vi.setSystemTime(new Date('2026-09-08T14:00:00Z'))
    expect(visitRowId(Date.now())).toBe(erst)
  })

  it('nimmt eine gespeicherte Kennung mit fremdem Tag nicht', async () => {
    vi.setSystemTime(new Date('2026-09-08T10:00:00Z'))
    inhalt[VISIT_KEY] = JSON.stringify({ day: '2026-01-01', id: 'altesalteskennung' })
    const { visitRowId } = await import('../src/presence.js')
    expect(visitRowId(Date.now())).not.toContain('altesalteskennung')
  })

  it('nimmt eine gespeicherte Kennung mit unmöglicher Form nicht', async () => {
    vi.setSystemTime(new Date('2026-09-08T10:00:00Z'))
    inhalt[VISIT_KEY] = JSON.stringify({ day: '2026-09-08', id: 'x'.repeat(99) })
    const { visitRowId } = await import('../src/presence.js')
    expect(visitRowId(Date.now())).not.toContain('xxxxx')
  })

  it('kommt ohne Speicher aus', async () => {
    vi.setSystemTime(new Date('2026-09-08T10:00:00Z'))
    vi.stubGlobal('window', {
      localStorage: {
        getItem: () => {
          throw new Error('gesperrt')
        },
      },
    })
    const { visitRowId } = await import('../src/presence.js')
    expect(visitRowId(Date.now())).toMatch(/^2026-09-08-/)
  })
})

describe('der Ping bildet die Kennung jedes Mal neu', () => {
  const starte = async () => {
    vi.stubEnv('VITE_API_BASE', 'https://api.example')
    const { openLiveStats } = await import('../src/presence.js')
    return openLiveStats(() => undefined)
  }

  it('schickt über Mitternacht die Kennung des NEUEN Tages', async () => {
    vi.setSystemTime(new Date('2026-09-08T21:58:00Z'))
    const stop = await starte()
    expect(aufrufe).toHaveLength(1)
    expect(gesendeteKennung(0)).toMatch(/^2026-09-08-/)

    // Zwei Ping-Abstände weiter, jenseits von Mitternacht.
    vi.setSystemTime(new Date('2026-09-08T22:03:00Z'))
    await vi.advanceTimersByTimeAsync(4 * 60_000)
    stop()

    expect(aufrufe.length).toBeGreaterThan(1)
    expect(gesendeteKennung(aufrufe.length - 1)).toMatch(/^2026-09-09-/)
  })

  it('ein weggeschobener Tab ist kein Betrachter', async () => {
    vi.setSystemTime(new Date('2026-09-08T10:00:00Z'))
    stelleUmgebung(false)
    const stop = await starte()
    await vi.advanceTimersByTimeAsync(10 * 60_000)
    stop()
    expect(aufrufe).toHaveLength(0)
  })

  it('nach dem Abräumen wird nicht weitergepingt', async () => {
    vi.setSystemTime(new Date('2026-09-08T10:00:00Z'))
    const stop = await starte()
    stop()
    const bisher = aufrufe.length
    await vi.advanceTimersByTimeAsync(30 * 60_000)
    expect(aufrufe).toHaveLength(bisher)
  })
})

describe('was der Ping zurückbringt, wird geprüft', () => {
  const starteMit = async (koerper: unknown, ok = true) => {
    vi.stubEnv('VITE_API_BASE', 'https://api.example')
    vi.stubGlobal('fetch', () =>
      Promise.resolve({ ok, status: ok ? 200 : 500, json: () => Promise.resolve(koerper) }),
    )
    const { openLiveStats } = await import('../src/presence.js')
    const gesehen: Partial<{ today: number | null; online: number | null }>[] = []
    const stop = openLiveStats((patch) => gesehen.push(patch))
    await vi.advanceTimersByTimeAsync(0)
    stop()
    return gesehen
  }

  beforeEach(() => {
    vi.setSystemTime(new Date('2026-09-08T10:00:00Z'))
  })

  it('nimmt zwei Zahlen an', async () => {
    expect(await starteMit({ today: 7, online: 2 })).toEqual([{ today: 7, online: 2 }])
  })

  it.each([
    ['Text statt Zahl', { today: 'sieben', online: 2 }, { online: 2 }],
    ['unendlich', { today: Infinity, online: 2 }, { online: 2 }],
    ['fehlendes Feld', { online: 2 }, { online: 2 }],
  ])('verwirft %s einzeln', async (_n, koerper, erwartet) => {
    expect(await starteMit(koerper)).toEqual([erwartet])
  })

  it('ein fehlgeschlagener Ping lässt die vorigen Zahlen stehen', async () => {
    expect(await starteMit({ today: 7, online: 2 }, false)).toEqual([])
  })
})
