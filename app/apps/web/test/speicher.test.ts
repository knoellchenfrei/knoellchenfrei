import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * `storage.ts` — die Schicht, die `localStorage` **beim Lesen** prüft, statt
 * ihm zu glauben. 194 Zeilen, bis zum 8. September ohne Test; gemessen mit v8
 * bei **0 %**.
 *
 * Der Grund, warum es diese Prüfungen überhaupt gibt, steht im Quelltext: Ein
 * gespeichertes `remindAt: 9e15` ist eine gültige Zahl und kein gültiges
 * Datum. `Intl.DateTimeFormat` wirft darauf — und weil der Wert im Speicher
 * blieb, riss er die App bei **jedem** Laden mit, auch beim Neuladen, das der
 * Fehlerbildschirm vorschlägt. Ein zweiter Fall: `startedAt = 1` zeigte auf der
 * Parkuhr „496850 Std.".
 *
 * `localStorage` gibt es in Node nicht; es wird gestellt. Das ist kein
 * Behelf — die Datei kapselt jeden Zugriff ohnehin, weil er in eingebetteten
 * Zusammenhängen schon beim Lesen wirft.
 */

const SESSION_KEY = 'knoellchenfrei.session'

let inhalt: Record<string, string>

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

beforeEach(() => {
  inhalt = {}
  vi.stubGlobal('localStorage', speicher())
  vi.stubGlobal('window', { localStorage: speicher() })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

/** Eine gültige Sitzung mitten in Berlin, vor einer Stunde begonnen. */
const basis = (patch: Record<string, unknown> = {}) => ({
  lon: 13.405,
  lat: 52.52,
  startedAt: Date.now() - 3_600_000,
  zone: '34',
  remindAt: Date.now() + 1_800_000,
  ...patch,
})

const legeAb = (wert: unknown): void => {
  inhalt[SESSION_KEY] = JSON.stringify(wert)
}

describe('die gemerkte Parksitzung', () => {
  it('kommt unverändert zurück, solange sie plausibel ist', async () => {
    const { loadSession } = await import('../src/storage.js')
    const sitzung = basis()
    legeAb(sitzung)
    const geladen = loadSession()
    expect(geladen?.zone).toBe('34')
    expect(geladen?.startedAt).toBe(sitzung.startedAt)
  })

  /**
   * Der Vorfall: `remindAt: 9e15` ist endlich und trotzdem kein Datum. Geprüft
   * wird deshalb auf **Schranken**, nicht auf `Number.isFinite`.
   */
  it('wirft eine unmögliche Erinnerung weg, statt an ihr zu zerbrechen', async () => {
    const { loadSession } = await import('../src/storage.js')
    legeAb(basis({ remindAt: 9e15 }))
    const geladen = loadSession()
    // Die Sitzung bleibt — nur die Erinnerung ist weg. Alles zu verwerfen
    // wäre die härtere Strafe für denselben Fehler.
    expect(geladen).not.toBeNull()
    expect(geladen?.remindAt).toBeNull()
    // Und der Wert muss sich formatieren lassen, sonst war nichts gewonnen.
    expect(() => new Intl.DateTimeFormat('de-DE').format(new Date(geladen?.startedAt ?? 0))).not.toThrow()
  })

  it('verwirft einen Beginn vor der Zeit des Projekts — „496850 Std." war einer', async () => {
    const { loadSession } = await import('../src/storage.js')
    legeAb(basis({ startedAt: 1 }))
    expect(loadSession()).toBeNull()
  })

  it('verwirft einen Beginn in der Zukunft', async () => {
    const { loadSession } = await import('../src/storage.js')
    legeAb(basis({ startedAt: Date.now() + 3_600_000 }))
    expect(loadSession()).toBeNull()
  })

  it('verwirft eine Position ausserhalb der geladenen Stadt', async () => {
    const { loadSession } = await import('../src/storage.js')
    // Golf von Guinea — dorthin fallen vertauschte Achsen.
    legeAb(basis({ lon: 0, lat: 0 }))
    expect(loadSession()).toBeNull()
  })

  it('verwirft, was gar keine Zahlen sind', async () => {
    const { loadSession } = await import('../src/storage.js')
    for (const unfug of [
      { lon: 'dreizehn', lat: 52.5, startedAt: Date.now() },
      { lon: 13.4, lat: null, startedAt: Date.now() },
      { lon: 13.4, lat: 52.5, startedAt: 'gestern' },
      'eine Zeichenkette',
      42,
      null,
    ]) {
      legeAb(unfug)
      expect(loadSession(), JSON.stringify(unfug)).toBeNull()
    }
  })

  it('übersteht kaputtes JSON', async () => {
    const { loadSession } = await import('../src/storage.js')
    inhalt[SESSION_KEY] = '{das ist kein JSON'
    expect(() => loadSession()).not.toThrow()
    expect(loadSession()).toBeNull()
  })

  it('kürzt eine masslos lange Zonenkennung weg, statt sie anzuzeigen', async () => {
    const { loadSession } = await import('../src/storage.js')
    legeAb(basis({ zone: 'A'.repeat(500) }))
    expect(loadSession()?.zone).toBeNull()
  })

  it('nimmt einen gesperrten Speicher hin', async () => {
    const werfend = {
      getItem: () => {
        throw new Error('SecurityError')
      },
      setItem: () => {
        throw new Error('SecurityError')
      },
      removeItem: () => {
        throw new Error('SecurityError')
      },
    }
    vi.stubGlobal('localStorage', werfend)
    vi.stubGlobal('window', { localStorage: werfend })
    const { loadSession, saveSession } = await import('../src/storage.js')
    expect(loadSession()).toBeNull()
    expect(() => saveSession(null)).not.toThrow()
  })
})
