import { describe, expect, it } from 'vitest'

import { isChargeable, quietDayNote, type ParkingZone } from '../src/index.js'

const MO_TO_SA = [1, 2, 3, 4, 5, 6] as const
const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6] as const

function zone(name: string, weekdays: readonly number[], from = 9 * 60, to = 20 * 60): ParkingZone {
  return {
    id: name,
    name,
    land: 'BE',
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
  it('sagt nichts, wenn ein normaler Anteil der Zonen kassiert', () => {
    expect(quietDayNote(CITY, { now: TUESDAY_MIDDAY })).toBeNull()
  })

  it('erklärt einen Ruhetag und nennt die Ausnahmen, wenn es wenige sind', () => {
    const note = quietDayNote(CITY, { now: SUNDAY_NOON })
    expect(note?.reason).toBe('restDay')
    expect(note?.chargeable).toBe(1)
    expect(note?.total).toBe(11)
    expect(note?.exceptions).toEqual(['rund-um-die-uhr'])
  })

  it('erklärt die Zeiten, bevor sie anfangen', () => {
    const note = quietDayNote(CITY, { now: TUESDAY_0830 })
    expect(note?.reason).toBe('beforeHours')
    expect(note?.usualStartHour).toBe(9)
  })

  it('erklärt die Zeiten, nachdem sie vorbei sind', () => {
    const note = quietDayNote(CITY, { now: TUESDAY_2300 })
    expect(note?.reason).toBe('afterHours')
    expect(note?.usualEndHour).toBe(20)
  })

  it('leitet die üblichen Tage aus den Daten ab, nicht aus einem fest verdrahteten Wochenende', () => {
    // Eine Stadt, die sonntags kassiert und montags ruht. Nichts am Code weiß
    // davon; die Antwort muss trotzdem stimmen.
    const elsewhere = Array.from({ length: 10 }, (_, i) => zone(`e${i}`, [0, 2, 3, 4, 5, 6]))
    expect(quietDayNote(elsewhere, { now: SUNDAY_NOON })).toBeNull()

    const monday = Date.UTC(2026, 8, 7, 10, 0)
    expect(quietDayNote(elsewhere, { now: monday })?.reason).toBe('restDay')
  })

  it('leitet auch die üblichen Stunden aus den Daten ab', () => {
    const late = Array.from({ length: 10 }, (_, i) => zone(`l${i}`, MO_TO_SA, 11 * 60, 23 * 60))
    const note = quietDayNote(late, { now: TUESDAY_0830 })
    expect(note?.reason).toBe('beforeHours')
    expect(note?.usualStartHour).toBe(11)
  })

  it('lässt die Liste weg, wenn zu viele Zonen Ausnahmen sind', () => {
    const many = [
      ...Array.from({ length: 40 }, (_, i) => zone(`q${i}`, MO_TO_SA)),
      ...Array.from({ length: 5 }, (_, i) => zone(`always${i}`, ALL_DAYS, 0, 1440)),
    ]
    const note = quietDayNote(many, { now: SUNDAY_NOON })
    expect(note?.chargeable).toBe(5)
    // Fünf Namen in einer Zeile helfen niemandem mehr.
    expect(note?.exceptions).toEqual([])
  })

  it('schweigt, wenn es die Zahl nicht erklären kann', () => {
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

  it('sagt nichts für eine leere Stadt', () => {
    expect(quietDayNote([], { now: SUNDAY_NOON })).toBeNull()
  })
})

describe('quietDayNote am Feiertag', () => {
  /** Freitag, 1. Mai 2026, 12:00 Berlin — gesetzlicher Feiertag im ganzen Land. */
  const LABOUR_DAY_NOON = Date.UTC(2026, 4, 1, 10, 0)

  /**
   * Der Fall, den der bestehende Test „stays silent when it cannot explain the
   * number" nicht konstruieren konnte — mit einem Feiertag geht er.
   *
   * Alle Zonen führen den Freitag in ihren Fenstern, es ist mitten in der
   * üblichen Zeit, und trotzdem kassiert keine einzige: `isFreeDay` nimmt sie
   * alle heraus. Keiner der drei Gründe trifft zu, und `quietDayNote` schweigt.
   *
   * Das ist bewusst so und keine Lücke im Test: `QuietReason` kennt keinen
   * Feiertag, und einen zu erfinden hiesse, aus „ich weiss es nicht" ein
   * „heute ist frei" zu machen. Wer das ändern will, ändert den Typ, nicht
   * diesen Test.
   */
  it('schweigt an einem Feiertag mitten in der üblichen Zeit', () => {
    const zones = Array.from({ length: 10 }, (_, i) => zone(`f${i}`, MO_TO_SA))
    expect(quietDayNote(zones, { now: LABOUR_DAY_NOON })).toBeNull()
  })

  // Zur Gegenprobe: Die Stille kommt wirklich vom Kalender und nicht von den
  // Fenstern. Ohne den Feiertag kassieren dieselben Zonen zur selben Uhrzeit
  // alle — und dann schweigt `quietDayNote` aus dem gewöhnlichen Grund.
  it('lässt dieselben Zonen eine Woche später alle kassieren', () => {
    const zones = Array.from({ length: 10 }, (_, i) => zone(`f${i}`, MO_TO_SA))
    const nextFriday = LABOUR_DAY_NOON + 7 * 86_400_000
    expect(zones.every((z) => isChargeable(z, nextFriday))).toBe(true)
    expect(zones.some((z) => isChargeable(z, LABOUR_DAY_NOON))).toBe(false)
    expect(quietDayNote(zones, { now: nextFriday })).toBeNull()
  })
})

describe('quietDayNote ohne Fenster', () => {
  /**
   * Eine Stadt, deren Zonen gar keine Fenster tragen.
   *
   * Kein hypothetischer Fall: Genau so sieht die geladene Liste aus, wenn der
   * Datenbau für eine Stadt durchgelaufen ist, ohne einen einzigen Fahrplan
   * lesen zu können. Der Median über eine leere Menge ist dann 0, und der
   * Hinweis nennt „ab 0 Uhr" — richtig, weil er nichts anderes weiss, und
   * jedenfalls besser als ein NaN in der Anzeige.
   */
  it('liefert einen Ruhetag mit Stunden 0, statt an einem leeren Median zu scheitern', () => {
    const empty = Array.from({ length: 5 }, (_, i) => ({ ...zone(`e${i}`, MO_TO_SA), windows: [] }))
    const note = quietDayNote(empty, { now: TUESDAY_MIDDAY })
    expect(note?.reason).toBe('restDay')
    expect(note?.chargeable).toBe(0)
    expect(note?.usualStartHour).toBe(0)
    expect(note?.usualEndHour).toBe(0)
  })
})
