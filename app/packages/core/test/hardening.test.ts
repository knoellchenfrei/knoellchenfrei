/**
 * Regression tests for defects found by adversarial review.
 * Each one failed before the fix it guards.
 */
import { describe, expect, it } from 'vitest'

import { adventSaturdays, isAdventSaturday } from '../src/holidays.js'
import { berlinWallClock } from '../src/berlin-time.js'
import { parseSchedule } from '../src/parse-schedule.js'
import { activeSightings, confidenceOf } from '../src/sighting.js'
import {
  adventRulesOf,
  estimateCost,
  isUncertainAt,
  MAX_PRICED_MINUTES,
  type ParkingZone,
} from '../src/tariff.js'
import { parseFee } from '../src/parse-fee.js'

const zone: ParkingZone = {
  id: '1',
  name: '1',
  land: 'BE',
  fee: parseFee('4,00 Euro'),
  windows: parseSchedule('Mo-Sa 9-22 Uhr').windows,
}

const spandau: ParkingZone = (() => {
  const parsed = parseSchedule('Mo-Fr 9-17 Uhr, Sa 9 -14 Uhr/ Advents-Sa 9 -17 Uhr')
  return {
    id: '10',
    name: '10',
    land: 'BE',
    fee: parseFee('2,00 Euro'),
    windows: parsed.windows,
    unmodelledRules: parsed.unmodelledRules,
  }
})()

describe('estimateCost an den Grenzen', () => {
  it('weist eine nicht endliche Dauer ab, statt ewig zu kreisen', () => {
    expect(() => estimateCost(zone, Date.UTC(2026, 8, 7, 8), Infinity)).toThrow(RangeError)
    expect(() => estimateCost(zone, Date.UTC(2026, 8, 7, 8), Number.NaN)).toThrow(RangeError)
  })

  it('weist eine negative Dauer ab, statt null als Tatsache zu nennen', () => {
    expect(() => estimateCost(zone, Date.UTC(2026, 8, 7, 8), -60)).toThrow(RangeError)
  })

  it('deckelt eine absurde Dauer bei einer Woche, statt den Thread zu blockieren', () => {
    const result = estimateCost(zone, Date.UTC(2026, 8, 7, 8), 10_000_000)
    expect(result.chargedMinutes).toBeLessThanOrEqual(MAX_PRICED_MINUTES)
  })
})

describe('Konfidenz mit feindseligen Zählern', () => {
  const base = { id: 'x', lat: 52.5, lon: 13.4, reportedAt: 0 }

  it('bleibt nie über 1, auch nicht bei negativen Widersprüchen', () => {
    const result = confidenceOf({ ...base, confirmations: 0, disputes: -5 }, { now: 0 })
    expect(result.score).toBeLessThanOrEqual(1)
    expect(result.status).not.toBe('confirmed')
  })

  it('macht aus nicht endlichen Zählern kein NaN', () => {
    const result = confidenceOf(
      { ...base, confirmations: Number.POSITIVE_INFINITY, disputes: 0 },
      { now: 0 }
    )
    expect(Number.isFinite(result.score)).toBe(true)
  })
})

describe('parseSchedule gegen feindselige Eingabe', () => {
  it('weist eine lange Leerraumkette schnell ab, statt zurückzusetzen', () => {
    const hostile = `Mo 9${' '.repeat(50_000)}-${' '.repeat(50_000)}x`
    const started = performance.now()
    expect(() => parseSchedule(hostile)).toThrow()
    expect(performance.now() - started).toBeLessThan(1000)
  })

  it('weist unmögliche Minuten ab, statt sie überlaufen zu lassen', () => {
    expect(() => parseSchedule('Mo-Fr 9:75-20:00 Uhr')).toThrow()
  })
})

describe('Adventssamstage', () => {
  it('findet die vier Einkaufssamstage von 2026', () => {
    // First Advent 2026 is 29 November, so the Saturdays are 28 Nov, 5, 12, 19 Dec.
    expect([...adventSaturdays(2026)].sort()).toEqual([
      '2026-11-28',
      '2026-12-05',
      '2026-12-12',
      '2026-12-19',
    ])
  })

  it('liefert immer Samstage', () => {
    for (let year = 2020; year <= 2040; year += 1) {
      for (const date of adventSaturdays(year)) {
        expect(new Date(`${date}T12:00:00Z`).getUTCDay()).toBe(6)
      }
    }
  })

  it('markiert eine Spandauer Zone am Adventssamstag als unsicher, an einem gewöhnlichen nicht', () => {
    const adventSaturday = Date.UTC(2026, 11, 5, 15) // 5 Dec 2026, 16:00 local
    const plainSaturday = Date.UTC(2026, 8, 5, 14)
    expect(isAdventSaturday(berlinWallClock(adventSaturday))).toBe(true)
    expect(isUncertainAt(spandau, adventSaturday)).toBe(true)
    expect(isUncertainAt(spandau, plainSaturday)).toBe(false)
  })

  it('lässt Zonen ohne unmodellierte Regel sicher', () => {
    expect(isUncertainAt(zone, Date.UTC(2026, 11, 5, 15))).toBe(false)
  })

  /**
   * Gefunden beim Anschluss Münchens.
   *
   * `isUncertainAt` fragte vorher nur, ob `unmodelledRules` **irgendetwas**
   * enthält — und Advent war die einzige Zusatzregel, die es gab. München
   * schreibt „Regelung nur an Schultagen" hinein. An einem Adventssamstag
   * hätte die App über jedem solchen Gebiet „unsicher" gezeigt und in der
   * Erklärung den Adventssamstag genannt, für eine Regel, die mit Advent
   * nichts zu tun hat. Ein Schulkalender steht in keiner Quelle dieses
   * Projekts; die Regel bleibt deshalb dauerhaft ein Hinweis und wird nie zu
   * einer Tagesaussage.
   */
  it('bleibt sicher bei einer unmodellierten Regel, die mit Advent nichts zu tun hat', () => {
    const muenchen: ParkingZone = {
      ...zone,
      unmodelledRules: ['Regelung nur an Schultagen', 'Zeit laut Quelle unbekannt'],
    }
    expect(isUncertainAt(muenchen, Date.UTC(2026, 11, 5, 15))).toBe(false)
    expect(adventRulesOf(muenchen)).toEqual([])
    expect(adventRulesOf(spandau)).toEqual(['Advents-Sa 9 -17 Uhr'])
  })
})

/**
 * Zweite Runde, gefunden beim Beschuss mit Zufallswerten (`fuzz.test.ts`).
 * Wieder gilt: Jeder Test hier ist einmal fehlgeschlagen.
 */
describe('Konfidenz mit kaputtem Zeitstempel', () => {
  const base = { id: 'x', lat: 52.5, lon: 13.4, confirmations: 2, disputes: 0 }

  /**
   * `reportedAt: NaN` ergab `score: NaN` und `ageMs: NaN`.
   *
   * Der Status fiel dabei zufällig richtig auf 'expired' — jeder Vergleich mit
   * NaN ist falsch, also fiel er durch beide Schwellen. Die zugesicherte Spanne
   * 0..1 galt trotzdem nicht mehr, und `ageMs` war in der Ausgabe unbrauchbar:
   * Die Oberfläche schreibt daraus „vor 12 Min." und hätte „vor NaN Min."
   * geschrieben.
   */
  it('behandelt einen unlesbaren Zeitstempel als unendlich alt, nicht als NaN', () => {
    for (const reportedAt of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
      const result = confidenceOf({ ...base, reportedAt }, { now: 1_757_000_000_000 })
      expect(Number.isFinite(result.score), String(reportedAt)).toBe(true)
      expect(result.score).toBe(0)
      expect(result.status).toBe('expired')
      expect(result.ageMs).toBeGreaterThanOrEqual(0)
    }
  })

  it('hält eine solche Sichtung aus der aktiven Liste heraus', () => {
    const broken = { ...base, reportedAt: Number.NaN }
    expect(activeSightings([broken], { now: 1_757_000_000_000 })).toEqual([])
  })

  // Gegenstück zum bestehenden Test über nicht endliche Bestätigungen: Der
  // zweite Zähler wird genauso geklammert, und beide kommen aus fremden Clients.
  it('rechnet auch mit einem nicht endlichen Widerspruch weiter', () => {
    const result = confidenceOf(
      { ...base, reportedAt: 0, disputes: Number.NaN },
      { now: 0 }
    )
    expect(Number.isFinite(result.score)).toBe(true)
    expect(result.score).toBeGreaterThan(0)
  })
})
