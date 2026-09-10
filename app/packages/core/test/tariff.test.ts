import { describe, expect, it } from 'vitest'

import { parseFee } from '../src/parse-fee.js'
import { parseSchedule } from '../src/parse-schedule.js'
import { chargeableAt, estimateCost, isChargeable, type ParkingZone } from '../src/tariff.js'

/**
 * Fixtures are built from the literal strings the WFS serves, so a test can
 * never assert behaviour for a zone that does not exist. Zone 1 and zone 29 are
 * real; SYNTHETIC_MAX_STAY is explicitly marked because no zone in the feed
 * carries a structured maximum stay.
 */
function zoneFrom(id: string, zeiten: string, gebuehr: string): ParkingZone {
  const schedule = parseSchedule(zeiten)
  return {
    id,
    name: id,
    land: 'BE',
    fee: parseFee(gebuehr),
    windows: schedule.windows,
    unmodelledRules: schedule.unmodelledRules,
  }
}

// Zone 1, Mitte — "Mo-Sa 9-22 Uhr", "4,00 Euro".
const zone1 = zoneFrom('1', 'Mo-Sa 9-22 Uhr', '4,00 Euro')
// Zone 29, Mitte — the only zone in Berlin that charges on Sundays.
const zone29 = zoneFrom('29', 'Mo-So 9-24 Uhr', '4,00 Euro')
// Zones 41-Pankow/42/43 — the source states a range, not one rate.
const zoneRanged = zoneFrom('42', 'Mo-Sa 9-24 Uhr', '2,00-3,00 Euro')

const SYNTHETIC_MAX_STAY: ParkingZone = { ...zone1, maxStayMinutes: 120 }

// Berlin is UTC+2 in summer, UTC+1 in winter.
const summerMon = (h: number, m = 0) => Date.UTC(2026, 8, 7, h - 2, m) // Mon 7 Sep 2026
const summerSun = (h: number, m = 0) => Date.UTC(2026, 8, 6, h - 2, m) // Sun 6 Sep 2026
const winterMon = (h: number, m = 0) => Date.UTC(2026, 11, 7, h - 1, m) // Mon 7 Dec 2026

describe('isChargeable', () => {
  it('kassiert im Fenster an einem Werktag', () => {
    expect(isChargeable(zone1, summerMon(10))).toBe(true)
  })

  it('ist frei davor und wieder, sobald geschlossen ist', () => {
    expect(isChargeable(zone1, summerMon(8, 59))).toBe(false)
    expect(isChargeable(zone1, summerMon(22))).toBe(false)
  })

  it('ist sonntags frei bei einer Mo-Sa-Zone', () => {
    expect(isChargeable(zone1, summerSun(10))).toBe(false)
  })

  it('KASSIERT sonntags bei Zone 29, die Mo-So läuft', () => {
    // Regression guard: a blanket Sunday rule reported this free and quoted
    // 0 EUR for a stay that really costs 4.00 EUR/h.
    expect(isChargeable(zone29, summerSun(10))).toBe(true)
    expect(isChargeable(zone29, summerSun(23, 59))).toBe(true)
  })

  it('behandelt einen Feiertag unter der Woche als frei', () => {
    // Fri 1 May 2026, 10:00 local — Tag der Arbeit.
    expect(isChargeable(zone1, Date.UTC(2026, 4, 1, 8))).toBe(false)
  })

  it('liest die Ortszeit unter Winterzeit richtig', () => {
    expect(isChargeable(zone1, winterMon(10))).toBe(true)
    expect(isChargeable(zone1, winterMon(8, 59))).toBe(false)
  })

  it('deckt 23:59 ab bei einer Zone, die um 24 Uhr schließt', () => {
    // An end hour of 24 must map to minute 1440, not 0.
    expect(isChargeable(zoneRanged, summerMon(23, 59))).toBe(true)
  })
})

describe('chargeableAt', () => {
  it('meldet, wann die laufende freie Zeit endet', () => {
    const result = chargeableAt(zone1, summerMon(7))
    expect(result.chargeable).toBe(false)
    expect(result.changesAt?.getTime()).toBe(summerMon(9))
  })

  it('überspringt einen Feiertag bei der Suche nach der nächsten kostenpflichtigen Minute', () => {
    // Thu 30 Apr 2026 22:00 local; Friday is a holiday, so the next charged
    // minute is Saturday 09:00, not Friday 09:00.
    const result = chargeableAt(zone1, Date.UTC(2026, 3, 30, 20))
    expect(result.chargeable).toBe(false)
    expect(result.changesAt?.getTime()).toBe(Date.UTC(2026, 4, 2, 7))
  })
})

describe('estimateCost', () => {
  it('rechnet eine volle kostenpflichtige Stunde ab', () => {
    const result = estimateCost(zone1, summerMon(10), 60)
    expect(result.minCents).toBe(400)
    expect(result.maxCents).toBe(400)
    expect(result.exact).toBe(true)
  })

  it('rechnet nur den kostenpflichtigen Teil eines Aufenthalts ab, der über den Schluss hinausgeht', () => {
    // 21:00 + 120 min: only 60 min fall before 22:00.
    const result = estimateCost(zone1, summerMon(21), 120)
    expect(result.chargedMinutes).toBe(60)
    expect(result.maxCents).toBe(400)
  })

  it('kostet nichts, wenn der ganze Aufenthalt frei ist', () => {
    expect(estimateCost(zone1, summerMon(23), 120).maxCents).toBe(0)
  })

  it('liefert eine Spanne statt einer Zahl, wenn die Quelle eine Spanne nennt', () => {
    const result = estimateCost(zoneRanged, summerMon(10), 60)
    expect(result.exact).toBe(false)
    expect(result.minCents).toBe(200)
    expect(result.maxCents).toBe(300)
  })

  it('markiert einen Aufenthalt über der Höchstparkdauer der Zone', () => {
    expect(estimateCost(SYNTHETIC_MAX_STAY, summerMon(10), 121).exceedsMaxStay).toBe(true)
    expect(estimateCost(SYNTHETIC_MAX_STAY, summerMon(10), 120).exceedsMaxStay).toBe(false)
  })
})

describe('chargeableAt ohne Wechsel', () => {
  /**
   * Eine Zone ohne Fenster wechselt nie — und `changesAt: null` ist die einzige
   * ehrliche Antwort. Ein Datum zu liefern hiesse „ab dann wird kassiert“, und
   * die Oberfläche schriebe „gebührenfrei bis 09:00“ über eine Zone, in der nie
   * etwas fällig wird.
   */
  it('liefert null, wenn sich in einer Woche nichts ändert', () => {
    const never: ParkingZone = { ...zone1, windows: [] }
    const result = chargeableAt(never, summerMon(10))
    expect(result.chargeable).toBe(false)
    expect(result.changesAt).toBeNull()
  })

  it('liefert auch für eine durchgehend kassierende Zone null', () => {
    const always: ParkingZone = {
      ...zone1,
      // Rund um die Uhr, alle sieben Tage — und ohne Feiertagsbefreiung, sonst
      // wäre der 3. Oktober der Wechsel.
      windows: [{ weekdays: [0, 1, 2, 3, 4, 5, 6], fromMinute: 0, toMinute: 1440 }],
      freeOnHolidays: false,
    }
    const result = chargeableAt(always, summerMon(10))
    expect(result.chargeable).toBe(true)
    expect(result.changesAt).toBeNull()
  })
})

describe('isUncertainAt am Feiertag', () => {
  /**
   * Ein Adventssamstag, der zugleich ein Feiertag ist, ist nicht unsicher —
   * er ist frei.
   *
   * Die Adventsregel verlängert die Bewirtschaftung; ein Feiertag hebt sie
   * ganz auf, und das eine schlägt das andere. „Unsicher" darüberzuschreiben
   * hiesse, jemanden zum Ticketautomaten zu schicken, an einem Tag, an dem
   * dort nichts zu zahlen ist. Der Fall ist über `extraHolidays` konstruiert —
   * dasselbe Feld, mit dem München Mariä Himmelfahrt trägt.
   */
  it('meldet frei statt unsicher, wenn der Adventssamstag ein Feiertag ist', () => {
    const spandau = zoneFrom('10', 'Mo-Fr 9-17 Uhr, Sa 9 -14 Uhr/ Advents-Sa 9 -17 Uhr', '2,00 Euro')
    const adventSaturday = Date.UTC(2026, 11, 5, 15) // 5. Dezember 2026, 16:00 Ortszeit
    expect(chargeableAt(spandau, adventSaturday).uncertain).toBe(true)

    const withHoliday: ParkingZone = { ...spandau, extraHolidays: ['12-05'] }
    expect(chargeableAt(withHoliday, adventSaturday).uncertain).toBe(false)
    expect(isChargeable(withHoliday, adventSaturday)).toBe(false)
  })
})

// Aus dem Test-Audit vom 10. September: `Math.ceil` → `Math.floor` in der
// Rechnung überlebte — keine angebrochene Stunde wäre je bezahlt worden.
describe('estimateCost an den Rändern', () => {
  it('rechnet eine halbe Stunde als halben Stundensatz und eine Minute nach oben', () => {
    expect(estimateCost(zone1, summerMon(10), 30).maxCents).toBe(200)
    expect(estimateCost(zone1, summerMon(10), 1).maxCents).toBe(7)
    expect(estimateCost(zone1, summerMon(10), 0.5).maxCents).toBe(7)
  })

  it('liefert für null Minuten null Cent, ohne zu werfen', () => {
    const result = estimateCost(zone1, summerMon(10), 0)
    expect(result.chargedMinutes).toBe(0)
    expect(result.maxCents).toBe(0)
    expect(result.priced).toBe(true)
    expect(() => estimateCost(zone1, summerMon(10), -1)).toThrow(RangeError)
  })
})
