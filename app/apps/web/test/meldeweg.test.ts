import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * `sighting-backend.ts` — jeder Schreibzugriff auf den Worker läuft hier
 * durch, und drei der Zusicherungen darin sind Versprechen an den Nutzer.
 * Bis zum 9. September hatte das Modul **3,2 % Abdeckung**.
 *
 * Was hier geprüft wird, und warum jedes einen Vorfall hinter sich hat:
 *
 * 1. **`send` wirft bei einer Antwort, die nicht `ok` ist.** Ein `fetch` ist
 *    erfolgreich, sobald irgendeine Antwort kommt — 415, 429 und 500 landen
 *    alle im `then`. Die Stimmen der App gingen deshalb monatelang ins Leere
 *    (Audit-Punkt M-046).
 * 2. **Der Inhaltstyp steht auch am leeren Rumpf.** Genau sein Fehlen war die
 *    Ursache: Der Worker verlangt `application/json`, weil erst der einen
 *    Preflight erzwingt. Ohne ihn kam 415, die Anzeige zählte hoch, die
 *    Datenbank nicht.
 * 3. **`?city=` steht an beiden Lesepfaden.** Ohne den Parameter fällt der
 *    Worker auf Berlin zurück; ein Hamburg-Nutzer läse Berliner Meldungen —
 *    auf der Karte unsichtbar, weil 250 km dazwischen liegen.
 * 4. **Gemeldet wird die gerundete Position, nicht die echte.** „Auf ~10 m
 *    gerundet" steht in `docs/datenschutz.md`. Wahr ist es nur, wenn die
 *    Rundung auch auf der Leitung landet.
 */

interface Aufruf {
  url: string
  init?: RequestInit
}

let aufrufe: Aufruf[]

/** `fetch`, das mitschreibt und antwortet, wie man es ihm sagt. */
function stelleFetch(antwort: { ok?: boolean; status?: number; koerper?: unknown } = {}): void {
  aufrufe = []
  vi.stubGlobal('fetch', (url: string, init?: RequestInit) => {
    aufrufe.push({ url, ...(init === undefined ? {} : { init }) })
    return Promise.resolve({
      ok: antwort.ok ?? true,
      status: antwort.status ?? 200,
      statusText: 'Testantwort',
      json: () => Promise.resolve(antwort.koerper ?? {}),
    })
  })
}

function stelleStadt(key: string): void {
  const inhalt: Record<string, string> = { 'knoellchenfrei:city': key }
  const speicher = {
    getItem: (k: string) => inhalt[k] ?? null,
    setItem: () => undefined,
    removeItem: () => undefined,
  }
  vi.stubGlobal('localStorage', speicher)
  vi.stubGlobal('window', { localStorage: speicher })
  vi.stubGlobal('navigator', {})
}

async function backend(stadt = 'berlin') {
  vi.stubEnv('VITE_API_BASE', 'https://api.example/')
  stelleStadt(stadt)
  const { openSightingBackend } = await import('../src/sighting-backend.js')
  const b = await openSightingBackend()
  expect(b).not.toBeNull()
  return b!
}

beforeEach(() => {
  vi.resetModules()
  vi.unstubAllEnvs()
  stelleFetch()
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

describe('Schreibzugriffe scheitern laut, nicht still', () => {
  it('eine Meldung mit 415 wirft, statt Erfolg zu melden', async () => {
    const b = await backend()
    stelleFetch({ ok: false, status: 415 })
    await expect(b.report(13.4, 52.5)).rejects.toThrow(/415/)
  })

  it('eine Stimme mit 429 wirft ebenfalls', async () => {
    const b = await backend()
    stelleFetch({ ok: false, status: 429 })
    await expect(
      b.vote({ id: 'abc', lon: 13.4, lat: 52.5, reportedAt: Date.now(), confirmations: 0, disputes: 0 }, 'confirm')
    ).rejects.toThrow(/429/)
  })

  it('die Fehlermeldung nennt die Adresse — sonst weiss niemand, welcher Aufruf', async () => {
    const b = await backend()
    stelleFetch({ ok: false, status: 500 })
    await expect(b.report(13.4, 52.5)).rejects.toThrow(/api\.example/)
  })
})

describe('der Inhaltstyp steht auch am leeren Rumpf', () => {
  it('bei der Meldung', async () => {
    const b = await backend()
    stelleFetch()
    await b.report(13.4, 52.5)
    const kopf = aufrufe[0]?.init?.headers as Record<string, string>
    expect(kopf['Content-Type']).toBe('application/json')
  })

  it('bei der Stimme, deren Rumpf nur `{}` ist', async () => {
    const b = await backend()
    stelleFetch()
    await b.vote(
      { id: 'abc', lon: 13.4, lat: 52.5, reportedAt: Date.now(), confirmations: 0, disputes: 0 },
      'dispute'
    )
    expect(aufrufe[0]?.init?.body).toBe('{}')
    const kopf = aufrufe[0]?.init?.headers as Record<string, string>
    expect(kopf['Content-Type']).toBe('application/json')
    expect(aufrufe[0]?.url).toMatch(/\/sightings\/abc\/dispute$/)
  })
})

describe('die Stadt steht an jedem Lesepfad', () => {
  it('beim Abruf der Meldungen', async () => {
    const b = await backend('hamburg')
    stelleFetch({ koerper: { sightings: [] } })
    const stop = b.subscribe(() => undefined)
    stop()
    expect(aufrufe[0]?.url).toContain('city=hamburg')
  })

  it('beim Abruf der Kontrolldichte', async () => {
    const b = await backend('muenchen')
    stelleFetch({ koerper: { marks: [] } })
    // `subscribeMarks` ist in der Schnittstelle **optional** — das Artifact
    // kennt keine Kontrolldichte. Der Worker muss sie führen, also wird das
    // hier zugesichert statt weggecastet. Aufgefallen ist es dem Typcheck,
    // nicht dem Testlauf: Ein `b.subscribeMarks(...)` auf `undefined` wäre
    // erst zur Laufzeit aufgefallen, und zwar nur, wenn dieser Zweig läuft.
    const abo = b.subscribeMarks
    expect(abo).toBeTypeOf('function')
    const stop = abo!(() => undefined)
    stop()
    expect(aufrufe[0]?.url).toContain('city=muenchen')
    expect(aufrufe[0]?.url).toMatch(/since=\d{4}-\d{2}-\d{2}/)
  })
})

describe('gemeldet wird die gerundete Position', () => {
  it('rundet auf vier Nachkommastellen, bevor etwas hinausgeht', async () => {
    const b = await backend()
    stelleFetch()
    await b.report(13.404123456, 52.520987654)
    const rumpf = JSON.parse(String(aufrufe[0]?.init?.body)) as { lon: number; lat: number }
    expect(rumpf).toEqual({ lon: 13.4041, lat: 52.521 })
  })

  it('die volle Genauigkeit steht nirgends im Rumpf', async () => {
    const b = await backend()
    stelleFetch()
    await b.report(13.404123456, 52.520987654)
    expect(String(aufrufe[0]?.init?.body)).not.toContain('13.404123456')
  })
})
