import { describe, expect, it } from 'vitest'

import { GEMERKT, merken, nutzungenLesen, vorText, zuletztGenutzt } from '../src/zuletzt.js'

/** „Zuletzt genutzt" in der Stadtwahl — für Pendler, auf Wunsch des Betreibers (18. September). */
const T = 24 * 60 * 60 * 1000

describe('merken', () => {
  it('setzt den neuen Wechsel nach vorn, hält jede Stadt einmal und begrenzt die Länge', () => {
    let liste = merken([], 'berlin', 1)
    liste = merken(liste, 'wien', 2)
    liste = merken(liste, 'berlin', 3)
    expect(liste.map((n) => n.key)).toEqual(['berlin', 'wien'])
    for (let i = 0; i < 10; i++) liste = merken(liste, `stadt${i}`, 10 + i)
    expect(liste).toHaveLength(GEMERKT)
    expect(liste[0]?.key).toBe('stadt9')
  })
})

describe('zuletztGenutzt', () => {
  it('lässt die aktuelle Stadt weg, sortiert neueste zuerst und zeigt höchstens drei', () => {
    const liste = [
      { key: 'wien', at: 5 },
      { key: 'berlin', at: 9 },
      { key: 'graz', at: 1 },
      { key: 'genf', at: 7 },
      { key: 'bern', at: 3 },
    ]
    expect(zuletztGenutzt(liste, 'berlin').map((n) => n.key)).toEqual(['genf', 'wien', 'bern'])
  })

  it('verwirft Einträge ohne brauchbare Zeit', () => {
    expect(zuletztGenutzt([{ key: 'wien', at: Number.NaN }], 'berlin')).toEqual([])
  })
})

describe('vorText', () => {
  it('sagt grob, wann — nie auf die Minute', () => {
    const jetzt = Date.UTC(2026, 8, 18, 10, 0)
    expect(vorText(jetzt - 5 * 60 * 1000, jetzt)).toBe('gerade eben')
    expect(vorText(jetzt - 3 * 60 * 60 * 1000, jetzt)).toBe('heute')
    expect(vorText(jetzt - T, jetzt)).toBe('gestern')
    expect(vorText(jetzt - 3 * T, jetzt)).toBe('vor 3 Tagen')
    expect(vorText(jetzt - 20 * T, jetzt)).toBe('vor 2 Wochen')
  })
})

describe('nutzungenLesen', () => {
  it('nimmt nur, was wie ein Eintrag aussieht — der Speicher kann alles enthalten', () => {
    expect(nutzungenLesen('{kaputt')).toEqual([])
    expect(nutzungenLesen([{ key: 'wien', at: 1 }, { key: 3 }, null, 'x'])).toEqual([{ key: 'wien', at: 1 }])
  })
})
