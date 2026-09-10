import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { MAX_FEEDBACK_LENGTH } from '@knoellchenfrei/core'

/**
 * `feedback.ts` — die heikelste Datenart der App, und bis heute ohne Test.
 *
 * Der Kopfkommentar der Datei macht eine Zusage: **Das Formular gibt es nur
 * mit eigenem Server.** Im Artifact-Speicher liesse sich „niemand ausser dem
 * Betreiber liest mit" nicht ausdrücken — dort darf Lesen nie strenger sein
 * als Schreiben. Der Worker kann es, indem es schlicht keinen Lese-Endpunkt
 * gibt. Fiele `openFeedback` ohne `VITE_API_BASE` nicht auf `null` zurück,
 * stünde ein Formular auf dem Schirm, dessen Versprechen die Ablage nicht
 * hält — und das wäre schlechter als eine fehlende Funktion.
 *
 * Dazu die Dinge, die `sighting-backend.ts` schon gelernt hat und die hier
 * genauso gelten: Inhaltstyp am Rumpf, und eine Antwort, die nicht `ok` ist,
 * wirft. Ein `fetch` ist erfolgreich, sobald irgendeine Antwort kommt.
 *
 * **Der erste Anlauf erfand zwei Arten, die es nicht gibt** — `bug` und
 * `daten` statt `idee`, `fehler`, `sonstiges`. Alle neun Tests waren grün:
 * Zur Laufzeit geht jede Zeichenkette durch, und der Worker prüft mit
 * `isFeedbackKind` erst auf seiner Seite. Gefangen hat es der Typcheck über
 * `test/`, den es seit dem 9. September gibt. Ein Test, der eine Art
 * behauptet, die das Formular nie schickt, prüft nichts.
 */

interface Aufruf {
  url: string
  init?: RequestInit
}

let aufrufe: Aufruf[]

function stelleFetch(antwort: { ok?: boolean; status?: number } = {}): void {
  aufrufe = []
  vi.stubGlobal('fetch', (url: string, init?: RequestInit) => {
    aufrufe.push({ url, ...(init === undefined ? {} : { init }) })
    return Promise.resolve({
      ok: antwort.ok ?? true,
      status: antwort.status ?? 200,
      statusText: 'Testantwort',
    })
  })
}

const rumpf = (): { kind: string; text: string } =>
  JSON.parse(String(aufrufe[0]?.init?.body)) as { kind: string; text: string }

beforeEach(() => {
  vi.resetModules()
  vi.unstubAllEnvs()
  stelleFetch()
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

describe('ohne eigenen Server gibt es das Formular nicht', () => {
  it('ohne VITE_API_BASE kommt kein Rückweg zurück', async () => {
    vi.stubEnv('VITE_API_BASE', '')
    const { openFeedback } = await import('../src/feedback.js')
    expect(openFeedback()).toBeNull()
  })

  it('ein nachgestellter Schrägstrich verdoppelt sich nicht', async () => {
    vi.stubEnv('VITE_API_BASE', 'https://api.example///')
    const { openFeedback } = await import('../src/feedback.js')
    await openFeedback()?.send('fehler', 'Text')
    expect(aufrufe[0]?.url).toBe('https://api.example/feedback')
  })
})

describe('was hinausgeht, ist aufgeräumt', () => {
  const laden = async () => {
    vi.stubEnv('VITE_API_BASE', 'https://api.example')
    const { openFeedback } = await import('../src/feedback.js')
    const rueckweg = openFeedback()
    expect(rueckweg).not.toBeNull()
    return rueckweg!
  }

  it('unsichtbare Zeichen und Zeilenwildwuchs werden entfernt', async () => {
    const r = await laden()
    await r.send('idee', '  Hallo​\r\n\n\n\nWelt  ')
    expect(rumpf().text).toBe('Hallo\n\nWelt')
  })

  it('länger als erlaubt wird gekürzt, nicht abgewiesen', async () => {
    const r = await laden()
    await r.send('fehler', 'x'.repeat(MAX_FEEDBACK_LENGTH + 500))
    expect(rumpf().text).toHaveLength(MAX_FEEDBACK_LENGTH)
  })

  it('die Art geht unverändert mit', async () => {
    const r = await laden()
    await r.send('sonstiges', 'Zone 42 stimmt nicht')
    expect(rumpf().kind).toBe('sonstiges')
  })

  it('der Inhaltstyp steht am Rumpf', async () => {
    const r = await laden()
    await r.send('fehler', 'Text')
    const kopf = aufrufe[0]?.init?.headers as Record<string, string>
    expect(kopf['Content-Type']).toBe('application/json')
  })
})

describe('eine Antwort, die nicht ok ist, wirft', () => {
  const laden = async () => {
    vi.stubEnv('VITE_API_BASE', 'https://api.example')
    const { openFeedback } = await import('../src/feedback.js')
    const rueckweg = openFeedback()
    expect(rueckweg).not.toBeNull()
    return rueckweg!
  }

  it('429 bekommt einen Satz, den man jemandem zeigen kann', async () => {
    const r = await laden()
    stelleFetch({ ok: false, status: 429 })
    await expect(r.send('fehler', 'Text')).rejects.toThrow(/zu viele Rückmeldungen/)
  })

  it('jeder andere Fehlerstatus nennt die Zahl', async () => {
    const r = await laden()
    stelleFetch({ ok: false, status: 500 })
    await expect(r.send('fehler', 'Text')).rejects.toThrow(/HTTP 500/)
  })
})
