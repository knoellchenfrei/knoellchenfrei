import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import { berlinWallClock } from '../src/berlin-time.js'
import {
  HamburgParseError,
  isActiveHamburgZone,
  parseHamburgFee,
  parseHamburgMaxStay,
  parseHamburgSchedule,
  type HamburgZoneProperties,
} from '../src/hamburg.js'
import { isChargeable, type ParkingZone } from '../src/tariff.js'

/**
 * Die echten Zeilen des Dienstes, abgerufen am 6. September 2026.
 *
 * Wie bei Berlin: Fixtures sind der Feed, nicht ausgedachte Beispiele. Ein
 * Test, der eine Schreibweise prüft, die es nicht gibt, prüft nichts.
 */
const ROWS = JSON.parse(
  readFileSync(
    fileURLToPath(new URL('./fixtures/hh-bewohnerparkgebiete-2026-09-06.json', import.meta.url)),
    'utf8'
  )
) as HamburgZoneProperties[]

describe('parseHamburgSchedule', () => {
  it('reads the plain daily window', () => {
    expect(parseHamburgSchedule('täglich 9-20 Uhr')).toEqual([
      { weekdays: [0, 1, 2, 3, 4, 5, 6], fromMinute: 540, toMinute: 1200 },
    ])
  })

  // Der teuerste mögliche Fehler in dieser Datei: "werktags" schließt den
  // Samstag EIN. Läse man es als Mo-Fr, meldete die App an 31 Gebieten
  // samstags "gebührenfrei".
  it('counts Saturday as a Werktag', () => {
    const [window] = parseHamburgSchedule('werktags 9-20 Uhr')
    expect(window?.weekdays).toEqual([1, 2, 3, 4, 5, 6])
    expect(window?.weekdays).not.toContain(0)
  })

  it('maps an end hour of 24 to minute 1440, not to 0', () => {
    expect(parseHamburgSchedule('täglich 9-24 Uhr')).toEqual([
      { weekdays: [0, 1, 2, 3, 4, 5, 6], fromMinute: 540, toMinute: 1440 },
    ])
  })

  // "täglich 9-2 Uhr" — fünf Gebiete. Ein einzelnes ChargeWindow kann das
  // nicht: fromMinute > toMinute hiesse in `windowCovers` schlicht "nie".
  it('splits a window that runs past midnight', () => {
    expect(parseHamburgSchedule('täglich 9-2 Uhr')).toEqual([
      { weekdays: [0, 1, 2, 3, 4, 5, 6], fromMinute: 540, toMinute: 1440 },
      { weekdays: [1, 2, 3, 4, 5, 6, 0], fromMinute: 0, toMinute: 120 },
    ])
  })

  // Kommt im Feed nicht vor, wäre aber die Falle: Der Samstagabend läuft in
  // den Sonntag, der Sonntag ist aber kein Werktag. Die Tage des zweiten
  // Fensters müssen deshalb mitwandern.
  it('shifts the after-midnight days by one for a werktags window', () => {
    expect(parseHamburgSchedule('werktags 22-1 Uhr')).toEqual([
      { weekdays: [1, 2, 3, 4, 5, 6], fromMinute: 1320, toMinute: 1440 },
      { weekdays: [2, 3, 4, 5, 6, 0], fromMinute: 0, toMinute: 60 },
    ])
  })

  it('rejects anything it does not recognise instead of guessing', () => {
    for (const raw of ['', 'Mo-Sa 9-20 Uhr', 'täglich 9-20', 'immer', 'täglich 9-20 Uhr extra']) {
      expect(() => parseHamburgSchedule(raw)).toThrow(HamburgParseError)
    }
  })

  it('refuses an identical start and end rather than emitting an empty day', () => {
    expect(() => parseHamburgSchedule('täglich 9-9 Uhr')).toThrow(/gleich/)
  })

  it('bounds its input, like the Berlin parsers', () => {
    expect(() => parseHamburgSchedule('täglich 9-20 Uhr'.padEnd(500, ' '))).toThrow(/Zeichen/)
  })

  it('parses every value the feed actually carries', () => {
    const values = new Set(
      ROWS.map((row) => row.bewirtschaftungszeit).filter((v): v is string => typeof v === 'string')
    )
    expect(values.size).toBeGreaterThan(5)
    for (const value of values) {
      expect(() => parseHamburgSchedule(value), value).not.toThrow()
    }
  })
})

describe('parseHamburgFee', () => {
  it('reads an amount with the € sign and the stated period', () => {
    expect(parseHamburgFee('3,50 € je Stunde')).toEqual({ kind: 'exact', centsPerHour: 350 })
    expect(parseHamburgFee('4,00 € je Stunde')).toEqual({ kind: 'exact', centsPerHour: 400 })
  })

  // Nicht als 0 Cent: Wer im Parkscheibengebiet ohne Scheibe steht, zahlt.
  it('treats Parkscheibe as its own kind, not as a price of zero', () => {
    expect(parseHamburgFee('Parkscheibe')).toEqual({ kind: 'disc' })
  })

  it('treats a dash, an empty string and null as "not stated"', () => {
    for (const raw of ['-', '', '   ', null, undefined]) {
      expect(parseHamburgFee(raw)).toEqual({ kind: 'unknown' })
    }
  })

  it('refuses an amount without a period, which Berlin writes and Hamburg does not', () => {
    expect(() => parseHamburgFee('3,50 €')).toThrow(HamburgParseError)
    expect(() => parseHamburgFee('4,00 Euro')).toThrow(HamburgParseError)
  })

  it('parses every value the feed actually carries', () => {
    const values = new Set(ROWS.map((row) => row.gebuehrenzone))
    for (const value of values) {
      expect(() => parseHamburgFee(value), String(value)).not.toThrow()
    }
  })

  // Der Feed selbst ist aktuell — veraltet ist nur die Beschreibung des
  // Dienstes in den Metadaten (drei Zonen zu 3/2/1 €). Dieser Test hält fest,
  // welche Sätze wirklich drinstehen, damit eine Gebührenänderung auffällt.
  it('carries the rates in force since 1 July 2026', () => {
    const rates = new Set(
      ROWS.map((row) => parseHamburgFee(row.gebuehrenzone))
        .filter((fee) => fee.kind === 'exact')
        .map((fee) => (fee as { centsPerHour: number }).centsPerHour)
    )
    expect([...rates].sort((a, b) => a - b)).toEqual([200, 300, 350, 400])
  })
})

describe('parseHamburgMaxStay', () => {
  it('reads minutes', () => {
    expect(parseHamburgMaxStay('180')).toBe(180)
    expect(parseHamburgMaxStay('660')).toBe(660)
  })

  // 9999 ist der Platzhalter des Feeds. Ungeprüft übernommen stünde in der
  // App "6 Tage 22 Stunden" — eine Zahl, die aussieht, als wäre sie gemeint.
  it('treats 9999 and 0 as "no limit", not as real values', () => {
    expect(parseHamburgMaxStay('9999')).toBeUndefined()
    expect(parseHamburgMaxStay('0')).toBeUndefined()
  })

  it('treats an empty field as no limit', () => {
    expect(parseHamburgMaxStay('')).toBeUndefined()
    expect(parseHamburgMaxStay(null)).toBeUndefined()
  })

  it('refuses anything that is not a plain minute count', () => {
    for (const raw of ['180 Min.', '3h', '-1', '1e3']) {
      expect(() => parseHamburgMaxStay(raw)).toThrow(HamburgParseError)
    }
  })

  it('parses every value the feed actually carries', () => {
    for (const row of ROWS) {
      expect(() => parseHamburgMaxStay(row.hoechstparkdauer), String(row.hoechstparkdauer)).not.toThrow()
    }
  })
})

describe('isActiveHamburgZone', () => {
  it('accepts only the value the feed uses for the zones that exist', () => {
    expect(isActiveHamburgZone({ geplant_aktiv: 2 })).toBe(true)
    expect(isActiveHamburgZone({ geplant_aktiv: 3 })).toBe(false)
    expect(isActiveHamburgZone({})).toBe(false)
  })

  it('drops exactly one of the 146 areas in the current feed', () => {
    expect(ROWS.filter(isActiveHamburgZone)).toHaveLength(ROWS.length - 1)
  })
})

describe('a Hamburg zone in the shared tariff model', () => {
  function zoneFrom(row: HamburgZoneProperties): ParkingZone {
    const maxStay = parseHamburgMaxStay(row.hoechstparkdauer)
    return {
      id: row.bwp_code ?? '?',
      name: row.bwp_name ?? '?',
      land: 'HH',
      fee: parseHamburgFee(row.gebuehrenzone),
      windows: parseHamburgSchedule(row.bewirtschaftungszeit as string),
      ...(maxStay === undefined ? {} : { maxStayMinutes: maxStay }),
    }
  }

  // Sonntag, 6. September 2026, 12:00 Berliner Zeit. Hamburgs "täglich"
  // kassiert auch sonntags — anders als Berlins 102 von 103 Zonen.
  const sundayNoon = Date.UTC(2026, 8, 6, 10)
  const saturdayNoon = Date.UTC(2026, 8, 5, 10)

  it('charges on a Sunday where the source says täglich', () => {
    const zone = zoneFrom({
      bwp_code: 'X',
      bewirtschaftungszeit: 'täglich 9-20 Uhr',
      gebuehrenzone: '3,50 € je Stunde',
      hoechstparkdauer: '180',
    })
    expect(isChargeable(zone, sundayNoon)).toBe(true)
  })

  it('charges on a Saturday where the source says werktags, and not on a Sunday', () => {
    const zone = zoneFrom({
      bwp_code: 'Y',
      bewirtschaftungszeit: 'werktags 9-20 Uhr',
      gebuehrenzone: '3,50 € je Stunde',
      hoechstparkdauer: '180',
    })
    expect(isChargeable(zone, saturdayNoon)).toBe(true)
    expect(isChargeable(zone, sundayNoon)).toBe(false)
  })

  // Reformationstag ist in Hamburg gesetzlicher Feiertag und in Berlin nicht.
  // Genau dafür hängt der Kalender am Bundesland.
  it('is free on 31 October, which Berlin charges', () => {
    const reformationstag = Date.UTC(2026, 9, 31, 10)
    const hh = zoneFrom({
      bwp_code: 'Z',
      bewirtschaftungszeit: 'täglich 9-20 Uhr',
      gebuehrenzone: '3,50 € je Stunde',
    })
    expect(isChargeable(hh, reformationstag)).toBe(false)
    expect(isChargeable({ ...hh, land: 'BE' }, reformationstag)).toBe(true)
  })

  it('still charges at 01:00 where the window runs to 2 Uhr', () => {
    const zone = zoneFrom({
      bwp_code: 'N',
      bewirtschaftungszeit: 'täglich 9-2 Uhr',
      gebuehrenzone: '3,50 € je Stunde',
    })
    // 01:00 Berliner Zeit am Montag, 7. September 2026 (Sommerzeit, UTC+2).
    expect(isChargeable(zone, Date.UTC(2026, 8, 6, 23))).toBe(true)
    // 03:00 — draussen.
    expect(isChargeable(zone, Date.UTC(2026, 8, 7, 1))).toBe(false)
  })

  it('builds every active area of the feed without throwing', () => {
    const active = ROWS.filter(isActiveHamburgZone).filter(
      (row) => typeof row.bewirtschaftungszeit === 'string'
    )
    expect(active.length).toBeGreaterThan(140)
    for (const row of active) {
      expect(() => zoneFrom(row), row.bwp_code ?? '?').not.toThrow()
    }
  })

  it('checks the wall clock in Berlin time for Hamburg too', () => {
    // Beide Städte liegen in Europe/Berlin; der Name der Funktion ist historisch.
    expect(berlinWallClock(sundayNoon).minuteOfDay).toBe(12 * 60)
  })
})
