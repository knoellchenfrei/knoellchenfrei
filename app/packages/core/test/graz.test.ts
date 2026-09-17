import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import type { Weekday } from '../src/berlin-time.js'
import {
  GRAZ_ZONE_KIND_LABEL,
  GrazParseError,
  grazDeletedMarker,
  grazZoneKey,
  grazZoneNote,
  isGrazStreetwise,
  parseGrazFee,
  parseGrazMaxStay,
  parseGrazMaxStayProse,
  parseGrazSchedule,
  type GrazZoneKind,
  type GrazZoneProperties,
} from '../src/graz.js'
import { holidaysFor } from '../src/holidays.js'
import { isChargeable, type ParkingZone } from '../src/tariff.js'

/**
 * Die echten Zeilen beider Ebenen, abgerufen am 16. September 2026.
 *
 * Wie bei den sieben Städten davor: Fixtures sind der Feed, nicht ausgedachte
 * Beispiele. Ein Test, der eine Schreibweise prüft, die es nicht gibt, prüft
 * nichts.
 */
const read = (name: string): GrazZoneProperties[] =>
  JSON.parse(readFileSync(fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url)), 'utf8')) as GrazZoneProperties[]

const BLAU = read('graz-kurzparkzonen-2026-09-16.json')
const GRUEN = read('graz-parkzonen-2026-09-16.json')
const ALLE = [...BLAU, ...GRUEN]

const MO_FR: readonly Weekday[] = [1, 2, 3, 4, 5]
const SA: readonly Weekday[] = [6]
const ALL: readonly Weekday[] = [0, 1, 2, 3, 4, 5, 6]

const BLAU_ZEIT =
  'Werktags, Montag bis Freitag, von 9.00 Uhr bis 20.00 Uhr und Samstag von 9.00 Uhr bis 13.00 Uhr'
const GRUEN_ZEIT = 'Werktags, Montag bis Freitag von 9.00 bis 20.00 Uhr.'
const EUROPAPLATZ_ZEIT = 'Täglich von 8.00 Uhr bis 22.00 Uhr'
const BLAU_GEBUEHR = 'Mindestgebühr (halbe Stunde): € 1,30 bis € 7,80 je nach maximaler Parkdauer'
const GRUEN_GEBUEHR =
  'Mindestgebühr (halbe Stunde): € 1,00 Tagesticket (24 Stunden): € 11,00 bis 5-Tages-Ticket: € 55,00'

function zaehle(rows: readonly GrazZoneProperties[], field: keyof GrazZoneProperties): Map<string, number> {
  const counts = new Map<string, number>()
  for (const row of rows) {
    const value = String(row[field] ?? '')
    counts.set(value, (counts.get(value) ?? 0) + 1)
  }
  return counts
}

describe('parseGrazSchedule', () => {
  it('liest die blaue Schreibweise als zwei Fenster: Montag bis Freitag und Samstag', () => {
    expect(parseGrazSchedule(BLAU_ZEIT)).toEqual([
      { weekdays: MO_FR, fromMinute: 540, toMinute: 1200 },
      { weekdays: SA, fromMinute: 540, toMinute: 780 },
    ])
  })

  it('liest die grüne Schreibweise — ohne Komma, ohne erstes „Uhr", mit Punkt am Ende', () => {
    expect(parseGrazSchedule(GRUEN_ZEIT)).toEqual([{ weekdays: MO_FR, fromMinute: 540, toMinute: 1200 }])
  })

  it('liest „Täglich" als alle sieben Tage', () => {
    expect(parseGrazSchedule(EUROPAPLATZ_ZEIT)).toEqual([{ weekdays: ALL, fromMinute: 480, toMinute: 1320 }])
  })

  // Die drei Schreibweisen des Abzugs, mit Zähler: Kommt eine vierte dazu,
  // fällt es hier auf, nicht erst im Datenbau.
  it('kennt genau die drei Schreibweisen des Abzugs, 89 + 1 + 75', () => {
    const blau = zaehle(BLAU, 'GELTUNGSZEIT')
    const gruen = zaehle(GRUEN, 'GELTUNGSZEIT')
    expect([...blau.entries()].sort()).toEqual([
      [EUROPAPLATZ_ZEIT, 1],
      [BLAU_ZEIT, 89],
    ])
    expect([...gruen.entries()]).toEqual([[GRUEN_ZEIT, 75]])
  })

  it('liest jeden Wert, den der Feed wirklich trägt', () => {
    for (const row of ALLE) {
      const windows = parseGrazSchedule(row.GELTUNGSZEIT as string)
      expect(windows.length, String(row.OBJECTID)).toBeGreaterThan(0)
    }
  })

  it('liest einen einzelnen Tag und eine Spanne bis Sonntag', () => {
    expect(parseGrazSchedule('Sonntag von 9.00 bis 12.00 Uhr')).toEqual([
      { weekdays: [0], fromMinute: 540, toMinute: 720 },
    ])
    expect(parseGrazSchedule('Montag bis Sonntag von 9.00 bis 12.00 Uhr')[0]?.weekdays).toEqual([
      1, 2, 3, 4, 5, 6, 0,
    ])
  })

  it('bildet die Endstunde 24 auf Minute 1440 ab, nicht auf 0', () => {
    expect(parseGrazSchedule('Täglich von 9.00 Uhr bis 24.00 Uhr')).toEqual([
      { weekdays: ALL, fromMinute: 540, toMinute: 1440 },
    ])
  })

  // „Werktags" allein wäre eine Deutung (Mo–Sa? Mo–Fr?); der Feed nennt die
  // Tage immer dazu, und nur die werden gelesen.
  it('weist „Werktags" ohne Tagesaufzählung ab, statt es zu deuten', () => {
    expect(() => parseGrazSchedule('Werktags von 9.00 bis 20.00 Uhr')).toThrow(GrazParseError)
  })

  it('weist eine umgedrehte Tagesspanne mit der eigenen Fehlerklasse ab', () => {
    expect(() => parseGrazSchedule('Freitag bis Montag von 9.00 bis 20.00 Uhr')).toThrow(GrazParseError)
  })

  it('weist alles ab, was es nicht kennt, statt zu raten', () => {
    for (const raw of [
      '',
      'Mo-Fr 9-20 Uhr',
      'Werktags, Montag bis Freitag',
      'Montag bis Freitag von 9.00 bis 20.00 Uhr und',
      'Mondtag bis Freitag von 9.00 bis 20.00 Uhr',
      'Täglich von 9.60 bis 20.00 Uhr',
      'Täglich von 25.00 bis 26.00 Uhr',
      'Täglich von 20.00 bis 9.00 Uhr',
      'Täglich von 9.00 bis 9.00 Uhr',
    ]) {
      expect(() => parseGrazSchedule(raw), raw).toThrow(GrazParseError)
    }
  })

  it('begrenzt seine Eingabe, wie die anderen Parser', () => {
    expect(() => parseGrazSchedule(`${BLAU_ZEIT} und `.repeat(3))).toThrow(GrazParseError)
  })
})

describe('parseGrazFee', () => {
  it('rechnet die blaue Mindestgebühr je halbe Stunde auf 2,60 € je Stunde um', () => {
    expect(parseGrazFee(BLAU_GEBUEHR)).toEqual({
      fee: { kind: 'exact', centsPerHour: 260 },
      maxTotalCents: 780,
      tickets: [],
    })
  })

  it('liest die grüne Mindestgebühr samt Tages- und 5-Tages-Ticket', () => {
    expect(parseGrazFee(GRUEN_GEBUEHR)).toEqual({
      fee: { kind: 'exact', centsPerHour: 200 },
      maxTotalCents: null,
      tickets: [
        { label: 'Tagesticket (24 Stunden)', cents: 1100 },
        { label: '5-Tages-Ticket', cents: 5500 },
      ],
    })
  })

  it('behandelt null und ein leeres Feld als „nicht genannt"', () => {
    expect(parseGrazFee(null).fee).toEqual({ kind: 'unknown' })
    expect(parseGrazFee(undefined).fee).toEqual({ kind: 'unknown' })
    expect(parseGrazFee('  ').fee).toEqual({ kind: 'unknown' })
  })

  it('weist einen Nullbetrag ab, statt kostenlos zu melden', () => {
    expect(() => parseGrazFee('Mindestgebühr (halbe Stunde): € 0,00 bis € 7,80 je nach maximaler Parkdauer')).toThrow(
      GrazParseError
    )
  })

  // 7,00 € wären fünfeinhalb halbe Stunden — dann wäre der Tarif nicht linear
  // und „Mindestgebühr × 2" kein Stundensatz.
  it('weist eine Obergrenze ab, die nicht auf halbe Stunden aufgeht', () => {
    expect(() => parseGrazFee('Mindestgebühr (halbe Stunde): € 1,30 bis € 7,00 je nach maximaler Parkdauer')).toThrow(
      GrazParseError
    )
    expect(() => parseGrazFee('Mindestgebühr (halbe Stunde): € 1,30 bis € 1,00 je nach maximaler Parkdauer')).toThrow(
      GrazParseError
    )
  })

  it('weist Tickets ab, die zum Stundensatz nicht passen', () => {
    expect(() =>
      parseGrazFee('Mindestgebühr (halbe Stunde): € 1,00 Tagesticket (24 Stunden): € 0,00 bis 5-Tages-Ticket: € 55,00')
    ).toThrow(GrazParseError)
    expect(() =>
      parseGrazFee('Mindestgebühr (halbe Stunde): € 1,00 Tagesticket (24 Stunden): € 60,00 bis 5-Tages-Ticket: € 55,00')
    ).toThrow(GrazParseError)
    expect(() =>
      parseGrazFee('Mindestgebühr (halbe Stunde): € 1,00 Tagesticket (24 Stunden): € 11,00 bis 5-Tages-Ticket: € 10,00')
    ).toThrow(GrazParseError)
  })

  it('weist alles ab, was nach der Mindestgebühr weder Obergrenze noch Tickets nennt', () => {
    for (const raw of ['Mindestgebühr (halbe Stunde): € 1,30', '1,30 € je Stunde', '€ 1,30 bis € 7,80', 'x'.repeat(200)]) {
      expect(() => parseGrazFee(raw), raw).toThrow(GrazParseError)
    }
  })

  it('kennt genau die zwei Werte des Abzugs, einen je Ebene', () => {
    expect([...zaehle(BLAU, 'PARK_GEBUEHR').entries()]).toEqual([[BLAU_GEBUEHR, 90]])
    expect([...zaehle(GRUEN, 'PARK_GEBUEHR').entries()]).toEqual([[GRUEN_GEBUEHR, 75]])
  })

  // Die Website der Stadt (gps.graz.at, 16. September 2026) nennt 1,30 Euro
  // je 30 Minuten in der Blauen und 1 Euro je halbe Stunde in der Grünen Zone
  // — der Feed ist preislich aktuell.
  it('trägt die Sätze, die die Stadt am selben Tag auf ihrer Seite nennt', () => {
    expect(parseGrazFee(BLAU_GEBUEHR).fee).toEqual({ kind: 'exact', centsPerHour: 260 })
    expect(parseGrazFee(GRUEN_GEBUEHR).fee).toEqual({ kind: 'exact', centsPerHour: 200 })
  })
})

describe('parseGrazMaxStay und parseGrazMaxStayProse', () => {
  it('liest Minuten aus „180 min" und aus dem Satz dazu', () => {
    expect(parseGrazMaxStay('180 min')).toBe(180)
    expect(parseGrazMaxStay('90 min')).toBe(90)
    expect(parseGrazMaxStayProse('Die maximale Parkdauer beträgt 90 Minuten (1,5 Stunden)')).toBe(90)
    expect(parseGrazMaxStayProse('Die maximale Parkdauer beträgt 60 Minuten (1 Stunde)')).toBe(60)
  })

  it('liest „Ohne Beschränkung" und ein leeres Feld als keine Grenze', () => {
    expect(parseGrazMaxStay('Ohne Beschränkung')).toBeUndefined()
    expect(parseGrazMaxStay(null)).toBeUndefined()
    expect(parseGrazMaxStay('')).toBeUndefined()
    expect(parseGrazMaxStayProse('Ohne zeitliche Beschränkung')).toBeUndefined()
    expect(parseGrazMaxStayProse(undefined)).toBeUndefined()
  })

  it('weist null Minuten ab — das hiesse Parken verboten, nicht unbegrenzt', () => {
    expect(() => parseGrazMaxStay('0 min')).toThrow(GrazParseError)
    expect(() => parseGrazMaxStayProse('Die maximale Parkdauer beträgt 0 Minuten (0 Stunden)')).toThrow(GrazParseError)
  })

  it('weist einen Satz ab, dessen Klammer nicht zu den Minuten passt', () => {
    expect(() => parseGrazMaxStayProse('Die maximale Parkdauer beträgt 90 Minuten (2 Stunden)')).toThrow(
      GrazParseError
    )
  })

  it('weist alles ab, was keine Minutenzahl ist', () => {
    for (const raw of ['3 h', '180', 'drei Stunden', 'x'.repeat(200)]) {
      expect(() => parseGrazMaxStay(raw), raw).toThrow(GrazParseError)
      expect(() => parseGrazMaxStayProse(raw), raw).toThrow(GrazParseError)
    }
  })

  // Der Feed führt die Angabe zweimal; beide müssen dasselbe sagen — auf
  // jeder der 165 Zeilen. Der Datenbau bricht sonst ab.
  it('stimmt auf jeder Zeile des Abzugs mit dem Satz überein', () => {
    for (const row of ALLE) {
      expect(parseGrazMaxStay(row.PARKDAUER), String(row.OBJECTID)).toBe(parseGrazMaxStayProse(row.PARK_DAUER))
    }
    expect([...zaehle(BLAU, 'PARKDAUER').entries()].sort()).toEqual([
      ['180 min', 84],
      ['60 min', 1],
      ['90 min', 5],
    ])
    expect([...zaehle(GRUEN, 'PARKDAUER').entries()]).toEqual([['Ohne Beschränkung', 75]])
  })
})

describe('die Felder der Fläche', () => {
  it('liest einen Löschvermerk nur, wo einer steht — Platzhalter zählen nicht', () => {
    expect(grazDeletedMarker({ DELETED: ' ' })).toBeNull()
    expect(grazDeletedMarker({ DELETED: '' })).toBeNull()
    expect(grazDeletedMarker({ DELETED: null })).toBeNull()
    expect(grazDeletedMarker({})).toBeNull()
    expect(grazDeletedMarker({ DELETED: '<Null>' })).toBeNull()
    expect(grazDeletedMarker({ DELETED: 'J' })).toBe('J')
  })

  it('findet im Abzug keine einzige gelöschte Fläche', () => {
    expect(ALLE.filter((row) => grazDeletedMarker(row) !== null)).toHaveLength(0)
    // Die drei Platzhalter, die vorkommen: Leerzeichen, leer, `<Null>`.
    expect([...zaehle(ALLE, 'DELETED').keys()].sort()).toEqual(['', ' ', '<Null>'])
  })

  it('nimmt den Zonenschlüssel der Stadt und wirft ohne ihn', () => {
    expect(grazZoneKey({ BEZEICHNUNG: ' 02 ' })).toBe('02')
    expect(() => grazZoneKey({ BEZEICHNUNG: '' })).toThrow(GrazParseError)
    expect(() => grazZoneKey({ OBJECTID: 7 })).toThrow(GrazParseError)
  })

  it('kennt die Schlüssel beider Ebenen, und sie überschneiden sich nicht', () => {
    const blau = [...new Set(BLAU.map(grazZoneKey))].sort()
    const gruen = [...new Set(GRUEN.map(grazZoneKey))].sort()
    expect(blau).toEqual(['01', '02', '03', '05', '06', '07', '08', '09', '10', '11', 'S1', 'S2'])
    expect(gruen).toEqual(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'S', 'S3'])
    expect(blau.filter((key) => gruen.includes(key))).toEqual([])
  })

  it('unterscheidet Straßenzüge von Gebieten über TYP', () => {
    expect(isGrazStreetwise({ TYP: 'Straßenzugsweise' })).toBe(true)
    expect(isGrazStreetwise({ TYP: 'Flächendeckend' })).toBe(false)
    expect(isGrazStreetwise({})).toBe(false)
    expect(BLAU.filter(isGrazStreetwise)).toHaveLength(69)
    expect(GRUEN.filter(isGrazStreetwise)).toHaveLength(53)
  })

  it('schreibt die Farbe, den Ort und die Tickets in den Satz unter der Zone', () => {
    const blau = parseGrazFee(BLAU_GEBUEHR)
    const gruen = parseGrazFee(GRUEN_GEBUEHR)
    expect(grazZoneNote('kurzparkzone', { NAME: 'Lend', TYP: 'Flächendeckend' }, blau)).toBe(
      'Blaue Zone Lend, flächendeckend'
    )
    expect(
      grazZoneNote('kurzparkzone', { NAME: 'Straßenzugsweise Kurzparkzone 180 min.', TYP: 'Straßenzugsweise' }, blau)
    ).toBe('Blaue Zone, straßenzugsweise')
    expect(grazZoneNote('parkzone', { NAME: 'Messe', TYP: 'Flächendeckend' }, gruen)).toBe(
      'Grüne Zone Messe, flächendeckend — Tagesticket (24 Stunden) 11,00 € — 5-Tages-Ticket 55,00 €'
    )
    expect(grazZoneNote('parkzone', { TYP: 'Flächendeckend' }, gruen)).toMatch(/^Grüne Zone, flächendeckend/)
    const kinds: GrazZoneKind[] = ['kurzparkzone', 'parkzone']
    expect(kinds.map((kind) => GRAZ_ZONE_KIND_LABEL[kind])).toEqual(['Blaue Zone', 'Grüne Zone'])
  })
})

describe('eine Grazer Zone im gemeinsamen Tarifmodell', () => {
  function zoneFrom(row: GrazZoneProperties): ParkingZone {
    const maxStay = parseGrazMaxStay(row.PARKDAUER)
    return {
      id: grazZoneKey(row),
      name: row.NAME ?? '?',
      land: 'AT-ST',
      fee: parseGrazFee(row.PARK_GEBUEHR).fee,
      windows: parseGrazSchedule(row.GELTUNGSZEIT as string),
      ...(maxStay === undefined ? {} : { maxStayMinutes: maxStay }),
    }
  }

  const blau = zoneFrom({ BEZEICHNUNG: '02', GELTUNGSZEIT: BLAU_ZEIT, PARK_GEBUEHR: BLAU_GEBUEHR, PARKDAUER: '180 min' })
  const gruen = zoneFrom({ BEZEICHNUNG: 'D', GELTUNGSZEIT: GRUEN_ZEIT, PARK_GEBUEHR: GRUEN_GEBUEHR, PARKDAUER: 'Ohne Beschränkung' })

  // Dienstag, 15. September 2026, 10:00 Wiener Zeit (Sommerzeit, UTC+2).
  const tuesdayMorning = Date.UTC(2026, 8, 15, 8)
  const saturdayNoon = Date.UTC(2026, 8, 19, 10)
  const saturdayAfternoon = Date.UTC(2026, 8, 19, 12)
  const sundayNoon = Date.UTC(2026, 8, 20, 10)

  it('kassiert in der Blauen Zone werktags, samstags bis 13 Uhr und sonntags nicht', () => {
    expect(isChargeable(blau, tuesdayMorning)).toBe(true)
    expect(isChargeable(blau, saturdayNoon)).toBe(true)
    expect(isChargeable(blau, saturdayAfternoon)).toBe(false)
    expect(isChargeable(blau, sundayNoon)).toBe(false)
    expect(blau.maxStayMinutes).toBe(180)
  })

  it('kassiert in der Grünen Zone samstags gar nicht', () => {
    expect(isChargeable(gruen, tuesdayMorning)).toBe(true)
    expect(isChargeable(gruen, saturdayNoon)).toBe(false)
    expect(gruen.maxStayMinutes).toBeUndefined()
  })

  // Genau dafür hängt der Kalender am Land: Der 26. Oktober ist Österreichs
  // Nationalfeiertag und in Deutschland ein Werktag; der 3. Oktober ist es
  // andersherum — 2026 ein Samstag, an dem die Blaue Zone bis 13 Uhr kassiert.
  it('ist am Nationalfeiertag frei und am Tag der Deutschen Einheit nicht', () => {
    const nationalfeiertag = Date.UTC(2026, 9, 26, 9) // Montag, 10:00 Winterzeit
    expect(isChargeable(blau, nationalfeiertag)).toBe(false)
    expect(isChargeable({ ...blau, land: 'BE' }, nationalfeiertag)).toBe(true)
    const einheit = Date.UTC(2026, 9, 3, 8) // Samstag, 10:00 Sommerzeit
    expect(isChargeable(blau, einheit)).toBe(true)
    expect(isChargeable({ ...blau, land: 'BE' }, einheit)).toBe(false)
  })

  // Karfreitag ist in Österreich seit 2019 kein gesetzlicher Feiertag mehr;
  // die Kurzparkzonen gelten. 2027 fällt er auf den 26. März.
  it('kassiert am Karfreitag, an dem jede deutsche Stadt frei hätte', () => {
    const karfreitag = Date.UTC(2027, 2, 26, 9)
    expect(holidaysFor('AT-ST', 2027).has('2027-03-26')).toBe(false)
    expect(isChargeable(blau, karfreitag)).toBe(true)
    expect(isChargeable({ ...blau, land: 'BE' }, karfreitag)).toBe(false)
  })

  it('baut jede der 165 Flächen des Feeds, ohne zu werfen', () => {
    expect(ALLE).toHaveLength(165)
    for (const row of ALLE) {
      expect(() => zoneFrom(row), String(row.OBJECTID)).not.toThrow()
    }
    expect(ALLE.map(zoneFrom).filter((zone) => zone.fee.kind === 'exact')).toHaveLength(165)
  })
})
