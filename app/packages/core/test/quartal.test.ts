import { describe, expect, it } from 'vitest'

import { berlinWallClock } from '../src/berlin-time.js'
import {
  isoWeekOf,
  observedDays,
  patternWeekday,
  quarterAt,
  quarterBefore,
  quarterEnd,
  quarterIndex,
  quarterOf,
  quarterStart,
} from '../src/quarter.js'

describe('Quartale', () => {
  it('ordnet Monate den vier Quartalen zu, in Berliner Zeit', () => {
    expect(quarterOf(berlinWallClock(Date.parse('2026-01-01T00:30:00+01:00')))).toBe('2026-Q1')
    expect(quarterOf(berlinWallClock(Date.parse('2026-03-31T23:59:00+02:00')))).toBe('2026-Q1')
    expect(quarterOf(berlinWallClock(Date.parse('2026-04-01T00:00:00+02:00')))).toBe('2026-Q2')
    expect(quarterAt(Date.parse('2026-12-31T23:30:00+01:00'))).toBe('2026-Q4')
    // Um 23:30 UTC am 31. Dezember ist es in Berlin schon der 1. Januar.
    expect(quarterAt(Date.parse('2026-12-31T23:30:00Z'))).toBe('2027-Q1')
  })

  it('zählt fortlaufend über den Jahreswechsel', () => {
    expect(quarterIndex('2027-Q1') - quarterIndex('2026-Q4')).toBe(1)
    expect(quarterBefore('2027-Q1', 1)).toBe('2026-Q4')
    expect(quarterBefore('2026-Q1', 12)).toBe('2023-Q1')
    expect(quarterBefore('2026-Q4', -1)).toBe('2027-Q1')
    expect(() => quarterIndex('2026-Q5')).toThrow(RangeError)
    expect(() => quarterIndex('2026-3')).toThrow(RangeError)
  })

  it('kennt ersten und letzten Tag', () => {
    expect(quarterStart('2026-Q3')).toBe('2026-07-01')
    expect(quarterEnd('2026-Q3')).toBe('2026-09-30')
    expect(quarterEnd('2026-Q4')).toBe('2026-12-31')
    expect(quarterEnd('2028-Q1')).toBe('2028-03-31')
  })
})

describe('ISO-Wochen', () => {
  it('legt die Jahreswende nach der Regel des Donnerstags', () => {
    expect(isoWeekOf(berlinWallClock(Date.parse('2026-01-01T12:00:00+01:00')))).toBe('2026-W01')
    expect(isoWeekOf(berlinWallClock(Date.parse('2027-01-01T12:00:00+01:00')))).toBe('2026-W53')
    expect(isoWeekOf(berlinWallClock(Date.parse('2026-09-08T12:00:00+02:00')))).toBe('2026-W37')
    expect(isoWeekOf(berlinWallClock(Date.parse('2024-12-30T12:00:00+01:00')))).toBe('2025-W01')
  })
})

describe('beobachtete Tage je Wochentag', () => {
  it('zählt die Kalendertage des Quartals zwischen Erntebeginn und gestern', () => {
    const tage = observedDays('2026-Q3', { since: '2026-09-01', until: '2026-09-30', land: 'BE' })
    expect(tage.reduce((s, v) => s + v, 0)).toBe(30)
    // September 2026: Dienstage am 1., 8., 15., 22., 29.
    expect(tage[2]).toBe(5)
    // Sonntage am 6., 13., 20., 27. — und keine Feiertage in Berlin.
    expect(tage[0]).toBe(4)
  })

  it('schlägt Feiertage dem Sonntag zu und zieht sie vom Wochentag ab', () => {
    // 3. Oktober 2026 ist ein Samstag: in Berlin ein Feiertag.
    const tage = observedDays('2026-Q4', { since: '2026-10-01', until: '2026-10-31', land: 'BE' })
    expect(tage[6]).toBe(4)
    expect(tage[0]).toBe(5)
    expect(tage.reduce((s, v) => s + v, 0)).toBe(31)
  })

  it('kennt die Stadtfeiertage: Mariä Himmelfahrt nur mit Zusatzdatum', () => {
    const ohne = observedDays('2026-Q3', { since: '2026-08-01', until: '2026-08-31', land: 'BY' })
    const mit = observedDays('2026-Q3', { since: '2026-08-01', until: '2026-08-31', land: 'BY', extraHolidays: ['08-15'] })
    // 15. August 2026 ist ein Samstag.
    expect(ohne[6]).toBe(5)
    expect(mit[6]).toBe(4)
    expect(mit[0]).toBe(ohne[0]! + 1)
  })

  it('ist leer ausserhalb des Quartals und schneidet an beiden Enden', () => {
    expect(observedDays('2026-Q1', { since: '2026-09-01', until: '2026-09-30', land: 'BE' })).toEqual([0, 0, 0, 0, 0, 0, 0])
    const tage = observedDays('2026-Q3', { since: '2026-06-01', until: '2027-01-01', land: 'BE' })
    expect(tage.reduce((s, v) => s + v, 0)).toBe(92)
  })
})

describe('der Wochentag einer Meldung', () => {
  it('ist am Feiertag der Sonntag', () => {
    const tagDerEinheit = berlinWallClock(Date.parse('2026-10-03T11:00:00+02:00'))
    expect(tagDerEinheit.weekday).toBe(6)
    expect(patternWeekday(tagDerEinheit, 'BE')).toBe(0)
    expect(patternWeekday(berlinWallClock(Date.parse('2026-10-06T11:00:00+02:00')), 'BE')).toBe(2)
  })
})
