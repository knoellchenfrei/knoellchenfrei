import { describe, expect, it } from 'vitest'

import { berlinWallClock } from '../src/berlin-time.js'
import { BERLIN } from '../src/city.js'
import { markFor, windowStart } from '../src/heatmap.js'
import { countingWindowStart } from '../src/rate-limit.js'
import { isChargeable, type ParkingZone } from '../src/tariff.js'

/**
 * Die zwei Nächte im Jahr, in denen die Uhr springt.
 *
 * Zweimal jährlich hat ein Berliner Tag **23 oder 25 Stunden**, und die App
 * rechnet durchgehend in Berliner Ortszeit: Tarife, Feiertage, die Tage der
 * Heatmap, das Rate-Limit-Fenster, die Stunde der Nutzungsstatistik. Bisher
 * gab es dafür keinen einzigen Test — die Umstellung ist der Fall, den man
 * nicht sieht, weil er nur an zwei Tagen eintritt und dann jahrelang nicht
 * wieder.
 *
 * Die Zeitpunkte hier sind in **UTC** angegeben und einzeln nachgerechnet:
 *
 * - **29. März 2026, 01:00 UTC** — in Berlin springt die Uhr von 02:00 auf
 *   03:00. Die Stunde 2 gibt es an diesem Tag nicht.
 * - **25. Oktober 2026, 01:00 UTC** — in Berlin ist es zum zweiten Mal 02:00.
 *   Die Stunde 2 gibt es zweimal.
 */

/**
 * Eine Zone, die Mo-Sa von 9 bis 20 Uhr kassiert — Berlins Normalfall.
 *
 * Der 29. März 2026 ist ein Sonntag und der 25. Oktober auch: An beiden
 * Umstellungstagen kassiert diese Zone also **nicht**. Genau deshalb steht
 * hier `weekdays: [0, …, 6]` — die Frage ist, ob die Ortszeit stimmt, nicht ob
 * der Wochentag zählt.
 */
const zone: ParkingZone = {
  id: 'probe',
  name: 'Probe',
  land: 'BE',
  windows: [{ weekdays: [0, 1, 2, 3, 4, 5, 6], fromMinute: 9 * 60, toMinute: 20 * 60 }],
  fee: { kind: 'unknown' },
  unmodelledRules: [],
}

describe('der Tag, an dem eine Stunde fehlt (29. März)', () => {
  it('springt von 01:59 auf 03:00 Ortszeit', () => {
    const vorher = berlinWallClock(Date.UTC(2026, 2, 29, 0, 59))
    const nachher = berlinWallClock(Date.UTC(2026, 2, 29, 1, 0))
    expect(vorher.minuteOfDay).toBe(1 * 60 + 59)
    expect(nachher.minuteOfDay).toBe(3 * 60)
  })

  it('bleibt derselbe Kalendertag', () => {
    const vorher = berlinWallClock(Date.UTC(2026, 2, 29, 0, 59))
    const nachher = berlinWallClock(Date.UTC(2026, 2, 29, 1, 0))
    expect(vorher.day).toBe(29)
    expect(nachher.day).toBe(29)
  })

  it('lässt den Tarif weiterlaufen — 09:00 Ortszeit bleibt 09:00', () => {
    // 07:00 UTC ist an diesem Tag 09:00 in Berlin, weil die Uhr schon
    // vorgestellt ist.
    expect(isChargeable(zone, Date.UTC(2026, 2, 29, 7, 0))).toBe(true)
    expect(isChargeable(zone, Date.UTC(2026, 2, 29, 6, 59))).toBe(false)
  })
})

describe('der Tag, an dem eine Stunde doppelt ist (25. Oktober)', () => {
  it('zeigt zweimal dieselbe Ortszeit', () => {
    const erstesMal = berlinWallClock(Date.UTC(2026, 9, 25, 0, 30))
    const zweitesMal = berlinWallClock(Date.UTC(2026, 9, 25, 1, 30))
    expect(erstesMal.minuteOfDay).toBe(2 * 60 + 30)
    expect(zweitesMal.minuteOfDay).toBe(2 * 60 + 30)
  })

  /**
   * Genau hier zählt das Zählwerk der Nutzungsstatistik zweimal auf dieselbe
   * Stunde — und das ist richtig so: Es addiert, es überschreibt nicht. Die
   * Statistikseite darf daraus nur keinen Ausreisser machen.
   */
  it('gibt beiden Durchgängen dieselbe Stunde und denselben Tag', () => {
    const a = berlinWallClock(Date.UTC(2026, 9, 25, 0, 30))
    const b = berlinWallClock(Date.UTC(2026, 9, 25, 1, 30))
    expect(Math.floor(a.minuteOfDay / 60)).toBe(Math.floor(b.minuteOfDay / 60))
    expect(a.day).toBe(b.day)
  })

  it('lässt den Tarif weiterlaufen — 09:00 Ortszeit bleibt 09:00', () => {
    // 08:00 UTC ist an diesem Tag 09:00 in Berlin, weil die Uhr zurückgestellt
    // ist. Am Tag davor wären es noch 07:00 UTC gewesen.
    expect(isChargeable(zone, Date.UTC(2026, 9, 25, 8, 0))).toBe(true)
    expect(isChargeable(zone, Date.UTC(2026, 9, 25, 7, 59))).toBe(false)
  })
})

describe('was an beiden Tagen NICHT springen darf', () => {
  /**
   * Das Fenster der Heatmap ist in Tagen gerechnet, nicht in Millisekunden mal
   * 24. Ginge es über die Umstellung, verschöbe sich der Anfang um eine
   * Stunde — und an einem Tag mit 25 Stunden fiele der älteste Tag zu früh
   * heraus.
   */
  it('bleibt der Fensteranfang der Heatmap ein Kalendertag', () => {
    const vorUmstellung = windowStart({ now: Date.UTC(2026, 9, 20, 12, 0) })
    const nachUmstellung = windowStart({ now: Date.UTC(2026, 9, 30, 12, 0) })
    expect(vorUmstellung).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(nachUmstellung).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(nachUmstellung > vorUmstellung).toBe(true)
  })

  it('legt eine Markierung an beiden Tagen auf denselben Kalendertag', () => {
    for (const zeitpunkt of [Date.UTC(2026, 2, 29, 1, 0), Date.UTC(2026, 9, 25, 1, 30)]) {
      const mark = markFor([13.4, 52.5], zeitpunkt, BERLIN.heatGrid)
      expect(mark.day).toBe(
        `${berlinWallClock(zeitpunkt).year}-${String(berlinWallClock(zeitpunkt).month).padStart(2, '0')}-${String(berlinWallClock(zeitpunkt).day).padStart(2, '0')}`
      )
    }
  })

  /**
   * Das Rate-Limit rechnet in absoluten Millisekunden und darf sich von der
   * Ortszeit **nicht** beirren lassen: Eine Stunde ist eine Stunde, auch wenn
   * die Uhr dazwischen springt. Sonst dürfte in der Umstellungsnacht jemand
   * doppelt so viel abladen — oder halb so wenig.
   */
  it('bleibt das Rate-Limit-Fenster eine echte Stunde lang', () => {
    const inDerNacht = Date.UTC(2026, 9, 25, 1, 30)
    const anfang = countingWindowStart(inDerNacht, 3_600_000, 3_600_000)
    expect(inDerNacht - anfang).toBeLessThanOrEqual(2 * 3_600_000)
    expect(inDerNacht - anfang).toBeGreaterThanOrEqual(3_600_000)
  })
})
