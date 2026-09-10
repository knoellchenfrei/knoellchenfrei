import { describe, expect, it } from 'vitest'

import {
  DEFAULT_PATTERN_PARAMS,
  decayWeight,
  fitModel,
  fitPatterns,
  levelOf,
  type PatternRow,
} from '../src/pattern.js'
import { backtest } from '../src/pattern-backtest.js'
import { hourRanges, patternSentence } from '../src/pattern-text.js'

/**
 * Das Modell an Handfällen (`docs/…`: Berlin nach zwei Quartalen, 20
 * Meldungen am Tag) und an Eigenschaften, die für jede Eingabe gelten müssen.
 */
const row = (patch: Partial<PatternRow>): PatternRow => ({
  unit: '12',
  quarter: '2026-Q4',
  weekday: 2,
  hour: 10,
  slots: 1,
  reports: 1,
  confirmed: 0,
  disputed: 0,
  weight: 0.5,
  ...patch,
})

/** Zwei Quartale, je 13 Wochen, kein Feiertag: 16 Wochen je Wochentag nach Verfall (13 + 13·0,5 ≈ 19,5 → hier bewusst 16 wie im Papier). */
const OBSERVED = { '2026-Q3': [7, 7, 7, 7, 7, 7, 7], '2026-Q4': [12, 12, 12, 12, 12, 12, 12] }

describe('Verfall', () => {
  it('wiegt das laufende Quartal voll, zwei Quartale später halb, die Zukunft gar nicht', () => {
    expect(decayWeight('2026-Q4', '2026-Q4', 2)).toBe(1)
    expect(decayWeight('2026-Q2', '2026-Q4', 2)).toBeCloseTo(0.5, 10)
    expect(decayWeight('2027-Q1', '2026-Q4', 2)).toBe(0)
  })
})

describe('fitModel', () => {
  it('ohne Zeilen ist alles null — und keine Einheit bekommt ein Muster', () => {
    const model = fitModel({ rows: [], observed: OBSERVED, currentQuarter: '2026-Q4', unitCount: 103 })
    expect(model.base).toBe(0)
    expect(model.units.size).toBe(0)
    expect(model.rateFor('12', 58)).toBe(0)
  })

  it('eine Einheit ohne eigene Zeilen bekommt das Stadtprofil', () => {
    const rows = [row({ unit: '7', slots: 5 }), row({ unit: '7', weekday: 3, slots: 2 })]
    const model = fitModel({ rows, observed: OBSERVED, currentQuarter: '2026-Q4', unitCount: 10 })
    expect(model.rateFor('12', 2 * 24 + 10)).toBe(model.profile[2 * 24 + 10])
    expect(model.rateFor('7', 2 * 24 + 10)).toBeGreaterThan(model.profile[2 * 24 + 10]!)
  })

  it('ist monoton: mehr Fenster in derselben Zelle heben die Rate, nie senken sie sie', () => {
    let previous = 0
    for (let k = 0; k <= 12; k += 1) {
      const rows = k === 0 ? [] : [row({ slots: k })]
      const model = fitModel({ rows, observed: OBSERVED, currentQuarter: '2026-Q4', unitCount: 50 })
      const p = model.rateFor('12', 2 * 24 + 10)
      expect(p).toBeGreaterThanOrEqual(previous)
      expect(p).toBeGreaterThanOrEqual(0)
      expect(p).toBeLessThan(1)
      previous = p
    }
  })

  it('rechnet das Handbeispiel: eine belegte Zone ist um Grössenordnungen über einer stillen', () => {
    // Zone 12: 120 Fenster über 168 Wochenstunden, davon 5 am Dienstag um 10.
    // Zone 77: 2 Fenster. Stadt: 60 Fenster am Dienstag um 10 insgesamt.
    const rows: PatternRow[] = []
    for (let cell = 0; cell < 168; cell += 1) {
      const weekday = Math.floor(cell / 24)
      const hour = cell % 24
      if (hour >= 8 && hour <= 19) {
        const slots = weekday === 2 && hour === 10 ? 5 : cell % 3 === 0 ? 1 : 0
        if (slots > 0) rows.push(row({ unit: '12', weekday, hour, slots, reports: slots }))
      }
    }
    rows.push(row({ unit: '77', weekday: 1, hour: 9, slots: 2, reports: 2 }))
    // Vierzig gewöhnliche Zonen mit je 24 Fenstern über den Tag verteilt —
    // der Stadtdurchschnitt, gegen den die beiden gemessen werden.
    for (let u = 0; u < 40; u += 1) {
      for (let cell = 0; cell < 168; cell += 1) {
        if ((cell + u) % 7 === 0 && cell % 24 >= 8 && cell % 24 <= 19) {
          rows.push(row({ unit: `s${u}`, weekday: Math.floor(cell / 24), hour: cell % 24, slots: 1, reports: 1 }))
        }
      }
      rows.push(row({ unit: `s${u}`, weekday: 2, hour: 10, slots: 1, reports: 1 }))
    }
    const model = fitModel({ rows, observed: OBSERVED, currentQuarter: '2026-Q4', unitCount: 103 })
    const zelle = 2 * 24 + 10
    const belebt = model.rateFor('12', zelle)
    const still = model.rateFor('77', zelle)
    expect(belebt).toBeGreaterThan(0.15)
    expect(belebt).toBeLessThan(0.5)
    expect(still).toBeLessThan(0.02)
    expect(belebt / still).toBeGreaterThan(10)
    expect(model.units.get('12')!.factor).toBeGreaterThan(3)
    expect(model.units.get('77')!.factor).toBeLessThan(0.7)
  })
})

describe('levelOf', () => {
  it('sagt „zu wenig Daten" unter vier Wochen oder unter fünfzig Fenstern der Stadt', () => {
    expect(levelOf(6, 16, 0.01, 3, 500)).toBe(0)
    expect(levelOf(6, 16, 0.01, 16, 49)).toBe(0)
    expect(levelOf(6, 16, 0.01, 16, 50)).not.toBe(0)
  })

  it('braucht für „häufig" und „ruhig" auch das Quantil, sonst bleibt es „üblich"', () => {
    // Zone 12 aus dem Papier: α 6,19, β 15,81, Basis 0,007 → häufig.
    expect(levelOf(6.19, 15.81, 0.007, 16, 2000)).toBe(3)
    // Zone 77: α 0,06, β 22 → ruhig, das 80-%-Quantil liegt unter der Basis.
    expect(levelOf(0.06, 22, 0.007, 16, 2000)).toBe(1)
    // Rate über 2·Basis, aber breite Unsicherheit: das 20-%-Quantil fällt darunter.
    expect(levelOf(0.5, 20, 0.007, 16, 2000)).toBe(2)
    // Genau auf der Basis: üblich.
    expect(levelOf(7, 993, 0.007, 16, 2000)).toBe(2)
  })
})

describe('fitPatterns', () => {
  it('liefert je Einheit 168 Stufen, Fenster und die Bestätigungsquote erst ab 20 Meldungen', () => {
    const rows = [
      row({ slots: 3, reports: 19, confirmed: 10 }),
      row({ unit: '9', slots: 4, reports: 21, confirmed: 7 }),
    ]
    const stand = fitPatterns({ rows, observed: OBSERVED, currentQuarter: '2026-Q4', unitCount: 20 })
    expect(stand.units['12']!.levels).toHaveLength(168)
    expect(stand.units['12']!.windows).toBe(3)
    expect(stand.units['12']!.confirmedShare).toBeNull()
    expect(stand.units['9']!.confirmedShare).toBeCloseTo(0.33, 2)
    expect(stand.n).toHaveLength(7)
    expect(stand.cityWindows).toBe(7)
    // Unter fünfzig Fenstern: überall Stufe 0.
    expect(new Set(stand.units['12']!.levels)).toEqual(new Set([0]))
  })
})

describe('der Rückwärtstest', () => {
  /** Ein fester Zufallsgenerator (LCG), damit das Ergebnis reproduzierbar ist. */
  function zufall(seed: number): () => number {
    let s = seed >>> 0
    return () => {
      s = (Math.imul(1_664_525, s) + 1_013_904_223) >>> 0
      return s / 2 ** 32
    }
  }

  function synthetisch(raten: (unit: string, cell: number) => number, seed: number): PatternRow[] {
    const rnd = zufall(seed)
    const rows: PatternRow[] = []
    for (const quarter of ['2026-Q1', '2026-Q2', '2026-Q3']) {
      for (let u = 0; u < 20; u += 1) {
        for (let cell = 0; cell < 168; cell += 1) {
          let slots = 0
          for (let week = 0; week < 13; week += 1) if (rnd() < raten(`z${u}`, cell)) slots += 1
          if (slots > 0) {
            rows.push(row({ unit: `z${u}`, quarter, weekday: Math.floor(cell / 24), hour: cell % 24, slots, reports: slots }))
          }
        }
      }
    }
    return rows
  }
  const observed = { '2026-Q1': Array(7).fill(13), '2026-Q2': Array(7).fill(13), '2026-Q3': Array(7).fill(13) }

  it('findet Struktur, wo welche ist: Skill gegen Basis und Profil positiv', () => {
    const rows = synthetisch((unit, cell) => {
      const hour = cell % 24
      const busy = Number(unit.slice(1)) < 5
      return (hour >= 9 && hour <= 17 ? 0.04 : 0.005) * (busy ? 6 : 0.5)
    }, 7)
    const ergebnis = backtest({ rows, observed, currentQuarter: '2026-Q4' })!
    expect(ergebnis.quarter).toBe('2026-Q3')
    expect(ergebnis.skill).toBeGreaterThan(0.05)
    expect(ergebnis.skillProfile).toBeGreaterThan(0.02)
    expect(ergebnis.calibration).toHaveLength(5)
  })

  it('findet keine Struktur in Rauschen: Skill nahe null, nie deutlich negativ', () => {
    const rows = synthetisch(() => 0.02, 11)
    const ergebnis = backtest({ rows, observed, currentQuarter: '2026-Q4' })!
    expect(Math.abs(ergebnis.skill)).toBeLessThan(0.05)
    expect(ergebnis.skillProfile).toBeGreaterThan(-0.05)
  })

  it('gibt ohne Vorquartal oder ohne Zielquartal nichts zurück', () => {
    expect(backtest({ rows: [row({ quarter: '2026-Q3' })], observed, currentQuarter: '2026-Q4' })).toBeNull()
    expect(backtest({ rows: [row({ quarter: '2026-Q2' })], observed, currentQuarter: '2026-Q4' })).toBeNull()
    expect(backtest({ rows: [], observed: {}, currentQuarter: '2026-Q4' })).toBeNull()
  })
})

describe('die Sätze', () => {
  const levels = new Array(168).fill(2) as (0 | 1 | 2 | 3)[]
  for (let h = 9; h < 12; h += 1) levels[2 * 24 + h] = 3
  for (let h = 19; h < 24; h += 1) levels[2 * 24 + h] = 1
  const unit = { levels, k: new Array(168).fill(0).map((_, i) => (i === 2 * 24 + 10 ? 5 : 0)), p: new Array(168).fill(10), factor: 5.25, windows: 120, reports: 140, confirmedShare: 0.41 }
  const n = [16, 16, 16, 16, 16, 15, 15]

  it('fasst Stunden zu Bereichen zusammen', () => {
    expect(hourRanges(levels, 2, 3)).toEqual(['9–12 Uhr'])
    expect(hourRanges(levels, 2, 1)).toEqual(['19–24 Uhr'])
    expect(hourRanges(levels, 3, 3)).toEqual([])
  })

  it('nennt Wochentag, Bereiche und die Zahlen hinter der Stunde', () => {
    const satz = patternSentence(unit, 2, 10, n)
    expect(satz.day).toBe('Dienstags meist 9–12 Uhr gemeldet, 19–24 Uhr selten.')
    expect(satz.now).toBe('Jetzt: häufig — in 5 von 16 Dienstagen um 10 Uhr gemeldet.')
    expect(satz.level).toBe(3)
    expect(patternSentence(unit, 3, 10, n).day).toBe('Mittwochs keine Häufung — gemeldet wird hier wie überall in der Stadt.')
  })

  it('sagt ohne Muster und bei Stufe 0, dass die Daten fehlen', () => {
    expect(patternSentence(null, 2, 10, n).now).toBe('In 16 Dienstagen wurde hier nichts gemeldet.')
    expect(patternSentence(null, 2, 10, [2, 2, 2, 2, 2, 2, 2]).now).toBe('Zu wenig Daten.')
    const leer = { ...unit, levels: new Array(168).fill(0) as (0 | 1 | 2 | 3)[] }
    expect(patternSentence(leer, 2, 10, n).level).toBe(0)
    expect(patternSentence(leer, 2, 10, n).day).toBe('Zu wenig Daten für ein Muster an Dienstagen.')
  })
})

describe('die Vorgaben', () => {
  it('sind die fünf benannten Parameter aus dem Papier', () => {
    expect(DEFAULT_PATTERN_PARAMS).toEqual({ halfLifeQuarters: 2, m2: 20, m3: 5, m4: 3, m5: 6, minWeeks: 4, minCityWindows: 50 })
  })
})
