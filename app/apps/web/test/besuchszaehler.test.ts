import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { visitRowId } from '../src/presence.js'

/**
 * Die Zeilenkennung des Besuchszählers — und der Fehler, den sie hatte.
 *
 * Der Worker weist eine Kennung ab, deren Tag nicht der heutige ist
 * (`422 stale day`); das muss er, sonst liesse sich ein vergangener Tag
 * aufblähen. Die App bildete die Kennung aber **einmal** beim Aufsetzen. Ein
 * Tab, der um 23:55 offen war, schickte ab 00:00 stundenlang die Kennung von
 * gestern — jeder Ping ein 422.
 *
 * Sichtbar war davon **nichts**: Ein fehlgeschlagener Ping bleibt absichtlich
 * still („dann gelten die vorigen Zahlen"), also stand auf dem Schirm die
 * ganze Nacht die Zahl von kurz vor Mitternacht. Eine tote Zahl, die aussieht
 * wie eine lebende — und das Gerät fehlte im Tageszähler, obwohl es offen war.
 */

function speicherAttrappe() {
  const inhalt: Record<string, string> = {}
  return {
    localStorage: {
      getItem: (k: string) => inhalt[k] ?? null,
      setItem: (k: string, v: string) => {
        inhalt[k] = v
      },
      removeItem: (k: string) => {
        delete inhalt[k]
      },
    },
  }
}

beforeEach(() => {
  vi.stubGlobal('window', speicherAttrappe())
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

/** 23:55 Berliner Zeit am 7. September 2026 — fünf Minuten vor der Grenze. */
const KURZ_VOR = Date.parse('2026-09-07T21:55:00Z')

describe('die Zeilenkennung des Besuchszählers', () => {
  it('trägt den Berliner Tag vorn', () => {
    expect(visitRowId(KURZ_VOR)).toMatch(/^2026-09-07-[\w-]{1,32}$/)
  })

  it('bleibt innerhalb desselben Tages gleich', () => {
    const erste = visitRowId(KURZ_VOR)
    expect(visitRowId(KURZ_VOR + 60_000)).toBe(erste)
    expect(visitRowId(KURZ_VOR + 4 * 60_000)).toBe(erste)
  })

  it('wechselt um Mitternacht auf den neuen Tag', () => {
    const vorher = visitRowId(KURZ_VOR)
    // Zehn Minuten später ist es der 8. September, Berliner Zeit.
    const nachher = visitRowId(KURZ_VOR + 10 * 60_000)
    expect(nachher).toMatch(/^2026-09-08-/)
    expect(nachher).not.toBe(vorher)
  })

  it('vergibt nach dem Wechsel eine neue Zufallskennung, nicht die alte mit neuem Datum', () => {
    // Sonst liesse sich ein Gerät über Tage hinweg wiedererkennen — genau das,
    // was die tägliche Neuvergabe verhindern soll.
    const alt = visitRowId(KURZ_VOR).split('-').slice(3).join('-')
    const neu = visitRowId(KURZ_VOR + 10 * 60_000).split('-').slice(3).join('-')
    expect(neu).not.toBe(alt)
  })

  it('zählt auch ohne Gerätespeicher weiter, statt zu werfen', () => {
    vi.stubGlobal('window', {
      localStorage: {
        getItem: () => {
          throw new Error('SecurityError')
        },
        setItem: () => {
          throw new Error('SecurityError')
        },
        removeItem: () => undefined,
      },
    })
    expect(() => visitRowId(KURZ_VOR)).not.toThrow()
    expect(visitRowId(KURZ_VOR)).toMatch(/^2026-09-07-/)
  })
})
