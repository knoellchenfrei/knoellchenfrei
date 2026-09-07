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
  it('liest das schlichte Tagesfenster', () => {
    expect(parseHamburgSchedule('täglich 9-20 Uhr')).toEqual([
      { weekdays: [0, 1, 2, 3, 4, 5, 6], fromMinute: 540, toMinute: 1200 },
    ])
  })

  // Der teuerste mögliche Fehler in dieser Datei: "werktags" schließt den
  // Samstag EIN. Läse man es als Mo-Fr, meldete die App an 31 Gebieten
  // samstags "gebührenfrei".
  it('zählt Samstag als Werktag', () => {
    const [window] = parseHamburgSchedule('werktags 9-20 Uhr')
    expect(window?.weekdays).toEqual([1, 2, 3, 4, 5, 6])
    expect(window?.weekdays).not.toContain(0)
  })

  it('bildet die Endstunde 24 auf Minute 1440 ab, nicht auf 0', () => {
    expect(parseHamburgSchedule('täglich 9-24 Uhr')).toEqual([
      { weekdays: [0, 1, 2, 3, 4, 5, 6], fromMinute: 540, toMinute: 1440 },
    ])
  })

  // "täglich 9-2 Uhr" — fünf Gebiete. Ein einzelnes ChargeWindow kann das
  // nicht: fromMinute > toMinute hiesse in `windowCovers` schlicht "nie".
  it('teilt ein Fenster, das über Mitternacht läuft', () => {
    expect(parseHamburgSchedule('täglich 9-2 Uhr')).toEqual([
      { weekdays: [0, 1, 2, 3, 4, 5, 6], fromMinute: 540, toMinute: 1440 },
      { weekdays: [1, 2, 3, 4, 5, 6, 0], fromMinute: 0, toMinute: 120 },
    ])
  })

  // Kommt im Feed nicht vor, wäre aber die Falle: Der Samstagabend läuft in
  // den Sonntag, der Sonntag ist aber kein Werktag. Die Tage des zweiten
  // Fensters müssen deshalb mitwandern.
  it('verschiebt die Tage nach Mitternacht bei einem werktags-Fenster um eins', () => {
    expect(parseHamburgSchedule('werktags 22-1 Uhr')).toEqual([
      { weekdays: [1, 2, 3, 4, 5, 6], fromMinute: 1320, toMinute: 1440 },
      { weekdays: [2, 3, 4, 5, 6, 0], fromMinute: 0, toMinute: 60 },
    ])
  })

  it('weist alles ab, was es nicht kennt, statt zu raten', () => {
    for (const raw of ['', 'Mo-Sa 9-20 Uhr', 'täglich 9-20', 'immer', 'täglich 9-20 Uhr extra']) {
      expect(() => parseHamburgSchedule(raw)).toThrow(HamburgParseError)
    }
  })

  it('weist gleichen Anfang und gleiches Ende ab, statt einen leeren Tag auszugeben', () => {
    expect(() => parseHamburgSchedule('täglich 9-9 Uhr')).toThrow(/gleich/)
  })

  it('begrenzt seine Eingabe, wie die Berliner Parser', () => {
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
  it('liest einen Betrag mit €-Zeichen und der genannten Zeitspanne', () => {
    expect(parseHamburgFee('3,50 € je Stunde')).toEqual({ kind: 'exact', centsPerHour: 350 })
    expect(parseHamburgFee('4,00 € je Stunde')).toEqual({ kind: 'exact', centsPerHour: 400 })
  })

  // Nicht als 0 Cent: Wer im Parkscheibengebiet ohne Scheibe steht, zahlt.
  it('behandelt die Parkscheibe als eigene Art, nicht als Preis von null', () => {
    expect(parseHamburgFee('Parkscheibe')).toEqual({ kind: 'disc' })
  })

  it('behandelt Strich, leere Zeichenkette und null als „nicht genannt"', () => {
    for (const raw of ['-', '', '   ', null, undefined]) {
      expect(parseHamburgFee(raw)).toEqual({ kind: 'unknown' })
    }
  })

  it('weist einen Betrag ohne Zeitspanne ab — Berlin schreibt sie, Hamburg nicht', () => {
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
  it('trägt die seit dem 1. Juli 2026 geltenden Tarife', () => {
    const rates = new Set(
      ROWS.map((row) => parseHamburgFee(row.gebuehrenzone))
        .filter((fee) => fee.kind === 'exact')
        .map((fee) => (fee as { centsPerHour: number }).centsPerHour)
    )
    expect([...rates].sort((a, b) => a - b)).toEqual([200, 300, 350, 400])
  })
})

describe('parseHamburgMaxStay', () => {
  it('liest Minuten', () => {
    expect(parseHamburgMaxStay('180')).toBe(180)
    expect(parseHamburgMaxStay('660')).toBe(660)
  })

  // 9999 ist der Platzhalter des Feeds. Ungeprüft übernommen stünde in der
  // App "6 Tage 22 Stunden" — eine Zahl, die aussieht, als wäre sie gemeint.
  it('behandelt 9999 und 0 als „keine Grenze", nicht als echte Werte', () => {
    expect(parseHamburgMaxStay('9999')).toBeUndefined()
    expect(parseHamburgMaxStay('0')).toBeUndefined()
  })

  it('behandelt ein leeres Feld als keine Grenze', () => {
    expect(parseHamburgMaxStay('')).toBeUndefined()
    expect(parseHamburgMaxStay(null)).toBeUndefined()
  })

  it('weist alles ab, was keine schlichte Minutenzahl ist', () => {
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
  it('nimmt nur den Wert an, den der Feed für die vorhandenen Zonen benutzt', () => {
    expect(isActiveHamburgZone({ geplant_aktiv: 2 })).toBe(true)
    expect(isActiveHamburgZone({ geplant_aktiv: 3 })).toBe(false)
    expect(isActiveHamburgZone({})).toBe(false)
  })

  it('wirft genau eines der 146 Gebiete im aktuellen Feed weg', () => {
    expect(ROWS.filter(isActiveHamburgZone)).toHaveLength(ROWS.length - 1)
  })
})

describe('eine Hamburger Zone im gemeinsamen Tarifmodell', () => {
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

  it('kassiert an einem Samstag, wo die Quelle werktags sagt, und sonntags nicht', () => {
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
  it('ist am 31. Oktober frei, an dem Berlin kassiert', () => {
    const reformationstag = Date.UTC(2026, 9, 31, 10)
    const hh = zoneFrom({
      bwp_code: 'Z',
      bewirtschaftungszeit: 'täglich 9-20 Uhr',
      gebuehrenzone: '3,50 € je Stunde',
    })
    expect(isChargeable(hh, reformationstag)).toBe(false)
    expect(isChargeable({ ...hh, land: 'BE' }, reformationstag)).toBe(true)
  })

  it('kassiert um 01:00 noch, wo das Fenster bis 2 Uhr läuft', () => {
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

  it('baut jedes aktive Gebiet des Feeds, ohne zu werfen', () => {
    const active = ROWS.filter(isActiveHamburgZone).filter(
      (row) => typeof row.bewirtschaftungszeit === 'string'
    )
    expect(active.length).toBeGreaterThan(140)
    for (const row of active) {
      expect(() => zoneFrom(row), row.bwp_code ?? '?').not.toThrow()
    }
  })

  it('prüft die Ortszeit auch für Hamburg in Berliner Zeit', () => {
    // Beide Städte liegen in Europe/Berlin; der Name der Funktion ist historisch.
    expect(berlinWallClock(sundayNoon).minuteOfDay).toBe(12 * 60)
  })
})

describe('Hamburger Parser an den Rändern', () => {
  // Wie in Berlin: Minuten über 59 würden stillschweigend in die nächste
  // Stunde rollen — aus „9:75" würde 10:15, eine Zeit, die niemand geschrieben
  // hat.
  it('weist Minuten über 59 ab, statt sie in die nächste Stunde zu rollen', () => {
    expect(() => parseHamburgSchedule('täglich 9:75-20:00 Uhr')).toThrow(HamburgParseError)
    expect(() => parseHamburgSchedule('werktags 9:00-20:75 Uhr')).toThrow(/Minuten über 59/)
  })

  it('weist eine Stunde jenseits des Tages ab', () => {
    expect(() => parseHamburgSchedule('täglich 25-30 Uhr')).toThrow(/unplausible Spanne/)
    expect(() => parseHamburgSchedule('täglich 0-0 Uhr')).toThrow(/unplausible Spanne/)
  })

  // Anfang gleich Ende ist keine Spanne über Mitternacht, sondern entweder
  // „immer" oder „nie" — und welches davon, sagt der Feed nicht.
  it('weist eine Spanne ab, deren Enden gleich sind', () => {
    expect(() => parseHamburgSchedule('täglich 9-9 Uhr')).toThrow(/Anfang und Ende sind gleich/)
  })

  it('begrenzt auch die Gebührenangabe auf 120 Zeichen', () => {
    expect(parseHamburgFee(`3,50 € je Stunde${' '.repeat(104)}`)).toEqual({
      kind: 'exact',
      centsPerHour: 350,
    })
    try {
      parseHamburgFee(`3,50 € je Stunde${' '.repeat(105)}`)
      expect.unreachable('hätte werfen müssen')
    } catch (error) {
      expect(error).toBeInstanceOf(HamburgParseError)
      expect((error as HamburgParseError).raw).toHaveLength(40)
    }
  })

  /**
   * Ein Nullbetrag ist kein Tarif — dieselbe Begründung wie in Berlin.
   *
   * Hamburg hat für „kostenlos, aber Scheibe" das Wort `Parkscheibe` und für
   * „die Quelle sagt nichts" den Strich. `0,00 € je Stunde` wäre keins von
   * beidem, ergäbe aber `priced: true` und damit ein „0,00 €" auf dem Schirm.
   */
  it('weist einen Nullbetrag ab, statt kostenlos zu melden', () => {
    expect(() => parseHamburgFee('0,00 € je Stunde')).toThrow(/kein Tarif/)
    expect(parseHamburgFee('Parkscheibe')).toEqual({ kind: 'disc' })
    expect(parseHamburgFee('-')).toEqual({ kind: 'unknown' })
  })

  it('weist eine Minutenzahl ab, die keine ist', () => {
    expect(() => parseHamburgMaxStay('zwei Stunden')).toThrow(/keine Minutenzahl/)
    expect(() => parseHamburgMaxStay('120 min')).toThrow(HamburgParseError)
    expect(() => parseHamburgMaxStay('123456')).toThrow(HamburgParseError)
  })
})
