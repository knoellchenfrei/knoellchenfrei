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

/**
 * Die zweite Hälfte der Datei — bis zum 9. September ungeprüft.
 *
 * `loadSession` hatte Tests, weil dort die beiden Werte standen, die die App
 * bei **jedem** Laden mitrissen. Die übrigen vier Leser hatten keine, obwohl
 * sie denselben Speicher lesen und dieselbe Regel tragen: Was zurückkommt,
 * wird geprüft, nicht geglaubt.
 */

const SIGHTINGS_KEY = 'knoellchenfrei.sightings'
const MARKS_KEY = 'knoellchenfrei.marks.v1'
const VISITS_KEY = 'knoellchenfrei.visits.v1'

/** Eine gültige Meldung in Berlin, vor zehn Minuten. */
const meldung = (patch: Record<string, unknown> = {}) => ({
  id: 'abc-123',
  lon: 13.405,
  lat: 52.52,
  reportedAt: Date.now() - 600_000,
  confirmations: 1,
  disputes: 0,
  ...patch,
})

describe('die gemerkten Meldungen', () => {
  const laden = async () => (await import('../src/storage.js')).loadSightings()

  it('kommen unverändert zurück, solange sie plausibel sind', async () => {
    inhalt[SIGHTINGS_KEY] = JSON.stringify([meldung()])
    expect(await laden()).toHaveLength(1)
  })

  it.each([
    ['kein JSON', '{kaputt'],
    ['keine Liste', '{"a":1}'],
    ['null', 'null'],
  ])('%s ergibt eine leere Liste', async (_name, roh) => {
    inhalt[SIGHTINGS_KEY] = roh
    expect(await laden()).toEqual([])
  })

  it.each([
    ['eine Kennung mit Sonderzeichen', { id: 'a b/c' }],
    ['eine leere Kennung', { id: '' }],
    ['eine Position ausserhalb der Stadt', { lon: 2.35, lat: 48.85 }],
    ['ein Zeitpunkt in der Zukunft', { reportedAt: Date.now() + 3_600_000 }],
    ['Koordinaten, die keine Zahlen sind', { lon: 'dreizehn' }],
  ])('verwirft %s — einzeln, nicht die ganze Liste', async (_name, patch) => {
    inhalt[SIGHTINGS_KEY] = JSON.stringify([meldung(), meldung(patch)])
    expect(await laden()).toHaveLength(1)
  })

  it('deckelt Zählerstände, statt Bewertungen über 100 Prozent zu erlauben', async () => {
    inhalt[SIGHTINGS_KEY] = JSON.stringify([meldung({ confirmations: 9_000, disputes: -5 })])
    const [erste] = await laden()
    expect(erste?.confirmations).toBe(500)
    expect(erste?.disputes).toBe(0)
  })
})

describe('die gemerkten Markierungen der Kontrolldichte', () => {
  const laden = async () => (await import('../src/storage.js')).loadMarks()

  it('gibt bei allem, was keine Liste ist, nichts zurück', async () => {
    inhalt[MARKS_KEY] = '"kaputt"'
    expect(await laden()).toEqual([])
  })

  it('wirft Einträge weg, die keine Markierung sind', async () => {
    // Der Tag wird gerechnet, nicht eingetragen: Ein festes Datum wäre morgen
    // abgelaufen, und der Test prüfte dann etwas anderes als heute.
    const { berlinDateKey, berlinWallClock } = await import('@knoellchenfrei/core')
    const heute = berlinDateKey(berlinWallClock(Date.now()))
    const gut = { day: heute, cell: '12_34', hour: 10 }
    inhalt[MARKS_KEY] = JSON.stringify([gut, 42, null, { day: 'gestern' }, {}, { cell: '1_1' }])
    expect(await laden()).toEqual([gut])
  })

  it('hebt genau die letzten 5.000 auf, nicht die ersten', async () => {
    const { saveMarks, loadMarks } = await import('../src/storage.js')
    const { berlinDateKey, berlinWallClock } = await import('@knoellchenfrei/core')
    const heute = berlinDateKey(berlinWallClock(Date.now()))
    saveMarks(Array.from({ length: 6_000 }, (_, i) => ({ day: heute, cell: `${i}_1`, hour: 10 })))
    // Gedeckelt wird auf beiden Seiten: beim Schreiben, und beim Lesen noch
    // einmal — eine von Hand geschriebene Zeile nimmt den Schreibweg gar nicht.
    const geladen = loadMarks()
    expect(geladen).toHaveLength(5_000)
    // Die **letzten**, weil die jüngsten die interessanten sind.
    expect(geladen[0]?.cell).toBe('1000_1')
    expect(geladen[4_999]?.cell).toBe('5999_1')
  })
})

describe('der Besuchszähler für den Installationshinweis', () => {
  it('zählt hoch', async () => {
    const { countVisit } = await import('../src/storage.js')
    expect(countVisit()).toBe(1)
    expect(countVisit()).toBe(2)
  })

  it('deckelt bei 99 — es ist ein Merker, kein Verlauf', async () => {
    inhalt[VISITS_KEY] = '99'
    const { countVisit } = await import('../src/storage.js')
    expect(countVisit()).toBe(99)
  })

  it.each([['Text', '"viele"'], ['kaputt', '{'], ['unendlich', '1e999']])(
    'fängt bei %s wieder bei eins an',
    async (_name, roh) => {
      inhalt[VISITS_KEY] = roh
      const { countVisit } = await import('../src/storage.js')
      expect(countVisit()).toBe(1)
    },
  )

  it('zählt auch ohne Speicher, nur ohne Gedächtnis', async () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('privates Fenster')
      },
      setItem: () => {
        throw new Error('privates Fenster')
      },
    })
    const { countVisit } = await import('../src/storage.js')
    expect(countVisit()).toBe(1)
    expect(countVisit()).toBe(1)
  })
})

describe('die beiden Merker sind wahr oder gar nichts', () => {
  /**
   * Beide Leser fragen auf `=== true`, nicht auf „irgendwas Wahrheitsähnliches".
   * Der Unterschied zählt: Eine Zeichenkette `"true"` aus einer älteren Form
   * ist in JavaScript wahr, und `locationAsked` würde damit behaupten, jemand
   * sei schon gefragt worden — der Vordialog bliebe für immer aus.
   */
  it.each([
    ['nichts gespeichert', undefined, false],
    ['die Zeichenkette "true"', '"true"', false],
    ['die Zahl 1', '1', false],
    ['echtes true', 'true', true],
  ])('%s', async (_name, roh, erwartet) => {
    const { locationAsked, installHidden } = await import('../src/storage.js')
    if (roh !== undefined) {
      inhalt['knoellchenfrei.locationAsked.v1'] = roh
      inhalt['knoellchenfrei.installHidden.v1'] = roh
    }
    expect(locationAsked()).toBe(erwartet)
    expect(installHidden()).toBe(erwartet)
  })

  it('was gemerkt wurde, kommt als true zurück', async () => {
    const modul = await import('../src/storage.js')
    modul.rememberLocationAsked()
    modul.hideInstall()
    expect(modul.locationAsked()).toBe(true)
    expect(modul.installHidden()).toBe(true)
  })
})
