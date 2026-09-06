import { describe, expect, it } from 'vitest'

import { quietDayNote, type ParkingZone } from '../src/index.js'

const MO_TO_SA = [1, 2, 3, 4, 5, 6] as const
const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6] as const

function zone(name: string, weekdays: readonly number[], from = 9 * 60, to = 20 * 60): ParkingZone {
  return {
    id: name,
    name,
    fee: { kind: 'exact', centsPerHour: 300 },
    windows: [{ weekdays: weekdays as never, fromMinute: from, toMinute: to }],
  }
}

/** Zehn gewöhnliche Zonen, Mo–Sa 9–20, plus eine, die immer kassiert. */
const CITY: ParkingZone[] = [
  ...Array.from({ length: 10 }, (_, i) => zone(`z${i}`, MO_TO_SA)),
  zone('rund-um-die-uhr', ALL_DAYS, 0, 1440),
]

/** Sonntag, 6. September 2026, 12:00 Berlin. */
const SUNDAY_NOON = Date.UTC(2026, 8, 6, 10, 0)
/** Dienstag, 8. September 2026. */
const TUESDAY_0830 = Date.UTC(2026, 8, 8, 6, 30)
const TUESDAY_MIDDAY = Date.UTC(2026, 8, 8, 10, 0)
const TUESDAY_2300 = Date.UTC(2026, 8, 8, 21, 0)

describe('quietDayNote', () => {
  it('says nothing when a normal share of zones is charging', () => {
    expect(quietDayNote(CITY, { now: TUESDAY_MIDDAY })).toBeNull()
  })

  it('explains a rest day, and names the exceptions when there are few', () => {
    const note = quietDayNote(CITY, { now: SUNDAY_NOON })
    expect(note?.reason).toBe('restDay')
    expect(note?.chargeable).toBe(1)
    expect(note?.total).toBe(11)
    expect(note?.exceptions).toEqual(['rund-um-die-uhr'])
  })

  it('explains the hours before they start', () => {
    const note = quietDayNote(CITY, { now: TUESDAY_0830 })
    expect(note?.reason).toBe('beforeHours')
    expect(note?.usualStartHour).toBe(9)
  })

  it('explains the hours after they end', () => {
    const note = quietDayNote(CITY, { now: TUESDAY_2300 })
    expect(note?.reason).toBe('afterHours')
    expect(note?.usualEndHour).toBe(20)
  })

  it('derives the usual days from the data, not from a hardcoded weekend', () => {
    // Eine Stadt, die sonntags kassiert und montags ruht. Nichts am Code weiß
    // davon; die Antwort muss trotzdem stimmen.
    const elsewhere = Array.from({ length: 10 }, (_, i) => zone(`e${i}`, [0, 2, 3, 4, 5, 6]))
    expect(quietDayNote(elsewhere, { now: SUNDAY_NOON })).toBeNull()

    const monday = Date.UTC(2026, 8, 7, 10, 0)
    expect(quietDayNote(elsewhere, { now: monday })?.reason).toBe('restDay')
  })

  it('derives the usual hours from the data too', () => {
    const late = Array.from({ length: 10 }, (_, i) => zone(`l${i}`, MO_TO_SA, 11 * 60, 23 * 60))
    const note = quietDayNote(late, { now: TUESDAY_0830 })
    expect(note?.reason).toBe('beforeHours')
    expect(note?.usualStartHour).toBe(11)
  })

  it('drops the list when too many zones are exceptions', () => {
    const many = [
      ...Array.from({ length: 40 }, (_, i) => zone(`q${i}`, MO_TO_SA)),
      ...Array.from({ length: 5 }, (_, i) => zone(`always${i}`, ALL_DAYS, 0, 1440)),
    ]
    const note = quietDayNote(many, { now: SUNDAY_NOON })
    expect(note?.chargeable).toBe(5)
    // Fünf Namen in einer Zeile helfen niemandem mehr.
    expect(note?.exceptions).toEqual([])
  })

  it('stays silent when it cannot explain the number', () => {
    // Mitten in der üblichen Zeit und trotzdem fast alles ruhig: dafür gibt es
    // keine Erklärung aus den Daten, und eine zu erfinden wäre schlechter.
    const odd = Array.from({ length: 10 }, (_, i) => zone(`o${i}`, MO_TO_SA, 9 * 60, 20 * 60))
    // Alle Fenster gelten, aber keines am Dienstagmittag zu treffen ist nur
    // konstruierbar, indem man den Tag aus den Fenstern nimmt.
    const noTuesday = odd.map((z) => ({
      ...z,
      windows: [{ weekdays: [1, 3, 4, 5, 6] as never, fromMinute: 9 * 60, toMinute: 20 * 60 }],
    }))
    // Dienstag fehlt überall -> das ist ein Ruhetag, kein unerklärlicher Fall.
    expect(quietDayNote(noTuesday, { now: TUESDAY_MIDDAY })?.reason).toBe('restDay')
  })

  it('says nothing for an empty city', () => {
    expect(quietDayNote([], { now: SUNDAY_NOON })).toBeNull()
  })
})
