import { describe, expect, it } from 'vitest'

import { berlinWallClock } from '../src/berlin-time.js'
import { countryOf, holidaysFor, isHoliday } from '../src/holidays.js'
import { chargeableAt, currencyOf, estimateCost, isChargeable, type ParkingZone } from '../src/tariff.js'

/**
 * Was am 16. September mit den Ländern dazukam: ein Staat hinter jedem
 * Landeskürzel, ein nationaler Kalender je Staat, eine Währung am Tarif und
 * ein drittes Wort für Zonen, deren Quelle keine Zeiten nennt.
 */
describe('countryOf', () => {
  it('liest den Staat aus dem Präfix, und ohne Präfix ist es Deutschland', () => {
    expect(countryOf('BE')).toBe('DE')
    expect(countryOf('BW')).toBe('DE')
    expect(countryOf('AT-W')).toBe('AT')
    expect(countryOf('AT-T')).toBe('AT')
  })
})

describe('der österreichische Kalender', () => {
  // Der Fehler, den die Aufteilung verhindert: Ein Wiener Kalender aus der
  // deutschen Bundesliste hätte am 3. Oktober frei und am 26. Oktober
  // (Nationalfeiertag) kassiert.
  it('kennt den Nationalfeiertag und nicht den Tag der Deutschen Einheit', () => {
    const wien = holidaysFor('AT-W', 2026)
    expect(wien.has('2026-10-26')).toBe(true)
    expect(wien.has('2026-10-03')).toBe(false)
    expect(holidaysFor('BE', 2026).has('2026-10-03')).toBe(true)
  })

  it('zählt dreizehn Tage nach § 7 Abs. 2 Feiertagsruhegesetz', () => {
    const wien = holidaysFor('AT-W', 2026)
    for (const tag of [
      '2026-01-01', // Neujahr
      '2026-01-06', // Heilige Drei Könige
      '2026-04-06', // Ostermontag
      '2026-05-01', // Staatsfeiertag
      '2026-05-14', // Christi Himmelfahrt
      '2026-05-25', // Pfingstmontag
      '2026-06-04', // Fronleichnam
      '2026-08-15', // Mariä Himmelfahrt
      '2026-10-26', // Nationalfeiertag
      '2026-11-01', // Allerheiligen
      '2026-12-08', // Mariä Empfängnis
      '2026-12-25',
      '2026-12-26',
    ]) {
      expect(wien.has(tag), tag).toBe(true)
    }
    expect(wien.size).toBe(13)
  })

  // Seit 2019 nur ein „persönlicher Feiertag" (BGBl. I Nr. 22/2019) — die
  // Kurzparkzonen gelten. Wer Karfreitag aus der deutschen Liste übernähme,
  // meldete Wien an diesem Tag frei.
  it('hält Karfreitag nicht für frei', () => {
    expect(holidaysFor('AT-W', 2026).has('2026-04-03')).toBe(false)
    expect(isHoliday('AT-W', berlinWallClock(Date.UTC(2026, 3, 3, 10)))).toBe(false)
  })

  it('kennt für die Landespatrone keinen freien Tag', () => {
    expect(holidaysFor('AT-W', 2026).has('2026-11-15')).toBe(false) // Leopold
    expect(holidaysFor('AT-S', 2026).has('2026-09-24')).toBe(false) // Rupert
    expect(holidaysFor('AT-ST', 2026).has('2026-03-19')).toBe(false) // Josef
    expect(holidaysFor('AT-T', 2026)).toEqual(holidaysFor('AT-W', 2026))
  })
})

describe('die Währung am Tarif', () => {
  it('ist Euro, wo keine steht, und Franken, wo der Parser sie hinschreibt', () => {
    expect(currencyOf({ kind: 'exact', centsPerHour: 200 })).toBe('EUR')
    expect(currencyOf({ kind: 'exact', centsPerHour: 200, currency: 'CHF' })).toBe('CHF')
    expect(currencyOf({ kind: 'range', minCentsPerHour: 100, maxCentsPerHour: 200, currency: 'CHF' })).toBe('CHF')
    expect(currencyOf({ kind: 'disc' })).toBe('EUR')
    expect(currencyOf({ kind: 'unknown' })).toBe('EUR')
  })

  it('reist mit der Kostenschätzung', () => {
    const zone: ParkingZone = {
      id: 'z',
      name: 'z',
      land: 'BE',
      fee: { kind: 'exact', centsPerHour: 250, currency: 'CHF' },
      windows: [{ weekdays: [1, 2, 3, 4, 5], fromMinute: 0, toMinute: 1440 }],
    }
    const estimate = estimateCost(zone, Date.UTC(2026, 8, 15, 10), 60)
    expect(estimate.currency).toBe('CHF')
    expect(estimate.maxCents).toBe(250)
    expect(estimateCost({ ...zone, fee: { kind: 'exact', centsPerHour: 250 } }, Date.UTC(2026, 8, 15, 10), 60).currency).toBe('EUR')
  })
})

describe('eine Zone, deren Quelle keine Zeiten nennt', () => {
  const zone: ParkingZone = {
    id: 'e1',
    name: 'Bewohnerparkbereich 1',
    land: 'NW',
    fee: { kind: 'unknown' },
    windows: [],
    scheduleUnknown: true,
  }

  // Vorher wäre das „keine Gebühr" mit „Frei bis: unverändert" gewesen — eine
  // Behauptung über einen Ort, über den die Daten nichts sagen.
  it('antwortet mit unknown statt mit frei', () => {
    const status = chargeableAt(zone, Date.UTC(2026, 8, 15, 10))
    expect(status).toEqual({ chargeable: false, uncertain: false, unknown: true, changesAt: null })
    expect(isChargeable(zone, Date.UTC(2026, 8, 15, 10))).toBe(false)
  })

  it('bleibt bei einer Zone mit Zeiten aus', () => {
    const mitZeiten: ParkingZone = {
      ...zone,
      windows: [{ weekdays: [1, 2, 3, 4, 5], fromMinute: 540, toMinute: 1200 }],
    }
    delete (mitZeiten as { scheduleUnknown?: true }).scheduleUnknown
    expect(chargeableAt(mitZeiten, Date.UTC(2026, 8, 15, 10)).unknown).toBe(false)
  })

  it('rechnet keine Kosten', () => {
    const estimate = estimateCost(zone, Date.UTC(2026, 8, 15, 10), 120)
    expect(estimate.priced).toBe(false)
    expect(estimate.chargedMinutes).toBe(0)
  })
})

describe('die Kalender der Nachbarländer', () => {
  it('Niederlande: Koningsdag weicht vom Sonntag auf den Samstag aus', () => {
    expect(holidaysFor('NL-UT', 2025).has('2025-04-26')).toBe(true)
    expect(holidaysFor('NL-UT', 2025).has('2025-04-27')).toBe(false)
    expect(holidaysFor('NL-UT', 2026).has('2026-04-27')).toBe(true)
  })

  it('Niederlande: Goede Vrijdag und Bevrijdingsdag sind keine freien Tage', () => {
    const utrecht = holidaysFor('NL-UT', 2026)
    expect(utrecht.has('2026-04-03')).toBe(false)
    expect(utrecht.has('2026-05-05')).toBe(false)
    expect(utrecht.has('2026-04-06')).toBe(true) // Tweede Paasdag
    expect(utrecht.has('2026-05-14')).toBe(true) // Hemelvaart
    expect(utrecht.has('2026-05-25')).toBe(true) // Tweede Pinksterdag
    expect(utrecht.size).toBe(7)
  })

  it('Frankreich: elf national, im Bas-Rhin dreizehn', () => {
    const strasbourg = holidaysFor('FR-67', 2026)
    expect(strasbourg.has('2026-04-03')).toBe(true) // Vendredi saint
    expect(strasbourg.has('2026-12-26')).toBe(true) // Saint-Étienne
    expect(strasbourg.has('2026-07-14')).toBe(true)
    expect(strasbourg.has('2026-11-11')).toBe(true)
    expect(strasbourg.size).toBe(13)
  })

  it('Polen: zwölf Tage ausser den zwei Sonntagen, samt Wigilia seit 2025', () => {
    const krakow = holidaysFor('PL-MA', 2026)
    expect(krakow.has('2026-12-24')).toBe(true)
    expect(krakow.has('2026-05-03')).toBe(true)
    expect(krakow.has('2026-06-04')).toBe(true) // Boże Ciało
    expect(krakow.has('2026-10-03')).toBe(false)
    expect(krakow.size).toBe(12)
  })

  it('kennt den Staat jedes Präfixes', () => {
    expect(countryOf('NL-ZH')).toBe('NL')
    expect(countryOf('FR-67')).toBe('FR')
    expect(countryOf('PL-MA')).toBe('PL')
  })
})
