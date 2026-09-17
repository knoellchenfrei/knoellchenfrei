import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import type { Weekday } from '../src/berlin-time.js'
import { holidaysFor } from '../src/holidays.js'
import { isChargeable, type ParkingZone } from '../src/tariff.js'
import {
  WIEN_ORDINANCE,
  WIEN_RAW_FEE,
  WienParseError,
  parseWienMaxStay,
  parseWienSchedule,
  wienAreaDistricts,
  wienAreaKey,
  wienFee,
  wienStripKey,
  type WienAreaProperties,
  type WienDistrictProperties,
  type WienStripProperties,
} from '../src/wien.js'

/**
 * Die echten Quellen, abgerufen am 17. September 2026.
 *
 * Wie bei den Städten davor: Fixtures sind der Feed, nicht ausgedachte
 * Beispiele. Die 81 Flächen und die 23 Bezirke stehen vollständig darin; von
 * den 796 Streifen je Schreibweise einer, dazu die Sonderfälle — und die
 * Zählung aller 796, damit „jede Schreibweise" wirklich jede ist.
 */
interface AreaFixture {
  abgerufenAm: string
  anzahl: number
  zeitraum: Record<string, number>
  dauer: Record<string, number>
  flaechen: (WienAreaProperties & { id: string; geometryType: string; firstPoint: [number, number] })[]
}

interface StripFixture {
  anzahlGesamt: number
  anzahlAuszug: number
  zeitraum: Record<string, number>
  dauer: Record<string, number>
  geometrie: Record<string, number>
  streifen: (WienStripProperties & { id: string; geometryType: string; firstPoint: [number, number] })[]
}

interface DistrictFixture {
  anzahl: number
  bezirke: (WienDistrictProperties & { id: string; geometryType: string })[]
}

const read = <T>(name: string): T =>
  JSON.parse(readFileSync(fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url)), 'utf8')) as T

const AREAS = read<AreaFixture>('wien-kurzparkzonen-2026-09-17.json')
const STRIPS = read<StripFixture>('wien-geschaeftsstrassen-2026-09-17.json')
const DISTRICTS = read<DistrictFixture>('wien-bezirke-2026-09-17.json')

const MO_FR: readonly Weekday[] = [1, 2, 3, 4, 5]
const SA: readonly Weekday[] = [6]

describe('parseWienSchedule', () => {
  it('liest die Bezirkszeit: Montag bis Freitag 9 bis 22 Uhr', () => {
    expect(parseWienSchedule('Mo.-Fr. (werkt.) v. 9-22 Uhr')).toEqual([
      { weekdays: MO_FR, fromMinute: 540, toMinute: 1320 },
    ])
  })

  it('liest die Geschäftsstraßen-Form mit Komma, „(w.)" und „h"', () => {
    expect(parseWienSchedule('Mo.-Fr. (w.) v. 8-18h, Sa. (w.) v. 8-12h')).toEqual([
      { weekdays: MO_FR, fromMinute: 480, toMinute: 1080 },
      { weekdays: SA, fromMinute: 480, toMinute: 720 },
    ])
  })

  it('liest die Flächen-Form mit Semikolon und „Uhr"', () => {
    expect(parseWienSchedule('Mo.-Fr. (werkt.) v. 8-18 Uhr; Sa. (werkt.) v. 8-12 Uhr')).toEqual([
      { weekdays: MO_FR, fromMinute: 480, toMinute: 1080 },
      { weekdays: SA, fromMinute: 480, toMinute: 720 },
    ])
  })

  it('liest Minuten mit Doppelpunkt und mit Punkt', () => {
    expect(parseWienSchedule('Mo.-Fr. (w.) v. 8:30-18h, Sa. (w.) v. 8:30-12h')).toEqual([
      { weekdays: MO_FR, fromMinute: 510, toMinute: 1080 },
      { weekdays: SA, fromMinute: 510, toMinute: 720 },
    ])
    expect(parseWienSchedule('Mo.-Fr. (w.) v. 10.30-15h, Sa. (w.) v. 8-12h')).toEqual([
      { weekdays: MO_FR, fromMinute: 630, toMinute: 900 },
      { weekdays: SA, fromMinute: 480, toMinute: 720 },
    ])
  })

  it('kommt ohne das Leerzeichen nach „v." aus — zwei Streifen schreiben es so', () => {
    expect(parseWienSchedule('Mo.-Fr. (werkt.) v.9-22h')).toEqual([{ weekdays: MO_FR, fromMinute: 540, toMinute: 1320 }])
  })

  it('liest „Mo.-Sa." als sechs Tage und einen einzelnen Samstag als einen', () => {
    expect(parseWienSchedule('Mo.-Sa. (w.) v. 8-18h')).toEqual([{ weekdays: [1, 2, 3, 4, 5, 6], fromMinute: 480, toMinute: 1080 }])
    expect(parseWienSchedule('Sa. (w.) v. 8-13h')).toEqual([{ weekdays: SA, fromMinute: 480, toMinute: 780 }])
  })

  it('läuft bei einer Spanne über den Sonntag rund, statt leer zu bleiben', () => {
    expect(parseWienSchedule('Sa.-Mo. (w.) v. 8-12h')[0]?.weekdays).toEqual([6, 0, 1])
  })

  it('ist unempfindlich gegen Groß-/Kleinschreibung und doppelten Leerraum', () => {
    expect(parseWienSchedule('  MO.-FR.  (WERKT.)  V.  9-22  UHR ')).toEqual(parseWienSchedule('Mo.-Fr. (werkt.) v. 9-22 Uhr'))
  })

  it('liest 24 Uhr als Minute 1440, nie als 0', () => {
    expect(parseWienSchedule('Mo.-Fr. (w.) v. 18-24h')).toEqual([{ weekdays: MO_FR, fromMinute: 1080, toMinute: 1440 }])
  })

  it('verlangt das Wort „werktags" — ohne es sagte die Klausel etwas anderes', () => {
    expect(() => parseWienSchedule('Mo.-Fr. v. 9-22 Uhr')).toThrow(WienParseError)
    expect(() => parseWienSchedule('Mo.-Fr. (täglich) v. 9-22 Uhr')).toThrow(WienParseError)
  })

  it('weist die Schreibweisen der anderen Städte ab', () => {
    for (const fremd of ['Mo-Fr 9-22 Uhr', 'werktags 9-20 Uhr', 'Mo-Sa 9-20', 'Mischparken 18-23 Uhr Montag bis Freitag', '08:00-19:00']) {
      expect(() => parseWienSchedule(fremd), fremd).toThrow(WienParseError)
    }
  })

  it('weist unbekannte Tage, Stunden über 24, Minuten über 59 und leere Spannen ab', () => {
    expect(() => parseWienSchedule('Xx.-Fr. (w.) v. 9-22h')).toThrow(WienParseError)
    expect(() => parseWienSchedule('Mo.-Fr. (w.) v. 9-25h')).toThrow(WienParseError)
    expect(() => parseWienSchedule('Mo.-Fr. (w.) v. 9:60-22h')).toThrow(WienParseError)
    expect(() => parseWienSchedule('Mo.-Fr. (w.) v. 9-9h')).toThrow(WienParseError)
  })

  it('bricht bei einer Spanne über Mitternacht ab, statt eine Lesart zu erfinden', () => {
    expect(() => parseWienSchedule('Mo.-Fr. (w.) v. 22-2h')).toThrow(/endet nicht nach ihrem Anfang/)
  })

  it('weist Leeres und Überlanges ab, bevor irgendetwas es anfasst', () => {
    expect(() => parseWienSchedule('')).toThrow(WienParseError)
    expect(() => parseWienSchedule('; ,')).toThrow(WienParseError)
    expect(() => parseWienSchedule('Mo.-Fr. (w.) v. 8-18h, '.repeat(10))).toThrow(/Zeichen/)
  })

  it('nennt im Fehler die Rohzeile', () => {
    try {
      parseWienSchedule('Mo.-Fr. 9-22 Uhr')
      expect.unreachable()
    } catch (error) {
      expect(error).toBeInstanceOf(WienParseError)
      expect((error as WienParseError).raw).toBe('Mo.-Fr. 9-22 Uhr')
      expect((error as Error).message).toContain('Wiener Feed')
    }
  })
})

describe('parseWienMaxStay', () => {
  it('liest die beiden Werte des Abzugs', () => {
    expect(parseWienMaxStay('2 h')).toBe(120)
    expect(parseWienMaxStay('1,5 h')).toBe(90)
  })

  it('nimmt auch 3 h, 1 h, 0,5 h und die Form ohne Leerzeichen', () => {
    expect(parseWienMaxStay('3 h')).toBe(180)
    expect(parseWienMaxStay('1 h')).toBe(60)
    expect(parseWienMaxStay('0,5 h')).toBe(30)
    expect(parseWienMaxStay('2h')).toBe(120)
  })

  it('weist 0 h ab — ein Parkverbot ist keine Höchstparkdauer', () => {
    expect(() => parseWienMaxStay('0 h')).toThrow(/0 h/)
    expect(() => parseWienMaxStay('0,0 h')).toThrow(WienParseError)
  })

  it('weist mehr als drei Stunden ab — § 25 Abs. 1 StVO erlaubt sie nicht', () => {
    expect(() => parseWienMaxStay('3,5 h')).toThrow(/3 h/)
    expect(() => parseWienMaxStay('24 h')).toThrow(WienParseError)
  })

  it('weist andere Einheiten, Dezimalpunkte und Unfug ab', () => {
    for (const fremd of ['90 min', '2 Std.', '1.5 h', '2,50 h', '', 'h', '2 h 30', 'unbegrenzt']) {
      expect(() => parseWienMaxStay(fremd), fremd).toThrow(WienParseError)
    }
    expect(() => parseWienMaxStay('2 h'.padEnd(200, ' '))).toThrow(/Zeichen/)
  })
})

describe('der Stadttarif aus der Parkometerabgabeverordnung', () => {
  it('ergibt 3,40 € je Stunde aus 1,70 € je halber Stunde', () => {
    expect(WIEN_ORDINANCE.centsPerHalfHour).toBe(170)
    expect(wienFee()).toEqual({ kind: 'exact', centsPerHour: 340 })
  })

  it('sagt im Rohtext, dass der Betrag nicht aus dem Datensatz stammt', () => {
    expect(WIEN_RAW_FEE).toContain('1,70 €')
    expect(WIEN_RAW_FEE).toContain('15 Minuten')
    expect(WIEN_RAW_FEE).toContain('nicht im Datensatz')
    expect(WIEN_ORDINANCE.freeMinutes).toBe(15)
    expect(WIEN_ORDINANCE.validFrom).toBe('2026-01-01')
  })

  it('gibt jedes Mal ein neues Objekt zurück, damit niemand den Tarif aller Zonen zugleich ändert', () => {
    expect(wienFee()).not.toBe(wienFee())
  })
})

describe('wienAreaKey', () => {
  it('nimmt die Bezirksnummer als Schlüssel', () => {
    expect(wienAreaKey({ BEZIRK: 17, BEZIRK2: null })).toBe('17')
    expect(wienAreaKey({ BEZIRK: 1 })).toBe('1')
  })

  it('nennt beide Bezirke, wenn die Fläche für zwei gilt', () => {
    expect(wienAreaKey({ BEZIRK: 4, BEZIRK2: 5 })).toBe('4+5')
    expect(wienAreaKey({ BEZIRK: 14, BEZIRK2: 15 })).toBe('14+15')
    expect(wienAreaDistricts({ BEZIRK: 14, BEZIRK2: 15 })).toEqual([14, 15])
    expect(wienAreaDistricts({ BEZIRK: 14, BEZIRK2: 14 })).toEqual([14])
  })

  it('weist alles ab, was kein Wiener Bezirk ist', () => {
    for (const falsch of [0, 24, -1, 1.5, null, undefined, Number.NaN]) {
      expect(() => wienAreaKey({ BEZIRK: falsch as number }), String(falsch)).toThrow(WienParseError)
    }
    expect(() => wienAreaKey({ BEZIRK: '17' as unknown as number })).toThrow(WienParseError)
    expect(() => wienAreaKey({ BEZIRK: 4, BEZIRK2: 99 })).toThrow(WienParseError)
  })
})

describe('wienStripKey', () => {
  it('setzt Straße und Hausnummernspanne zusammen und trimmt', () => {
    expect(wienStripKey({ STRNAM: 'Währinger Straße', GELTUNGSBEREICH: '121 bis 123' })).toBe('Währinger Straße 121 bis 123')
    expect(wienStripKey({ STRNAM: 'Erbpostgasse', GELTUNGSBEREICH: '30 ' })).toBe('Erbpostgasse 30')
    expect(wienStripKey({ STRNAM: '  Am  Spitz ', GELTUNGSBEREICH: ' 1 ' })).toBe('Am Spitz 1')
  })

  it('bleibt beim Straßennamen, wenn die Spanne fehlt', () => {
    expect(wienStripKey({ STRNAM: 'Kettenbrücke', GELTUNGSBEREICH: null })).toBe('Kettenbrücke')
    expect(wienStripKey({ STRNAM: 'Kettenbrücke' })).toBe('Kettenbrücke')
  })

  it('wirft ohne Straßennamen und bei Überlänge', () => {
    expect(() => wienStripKey({ STRNAM: null, GELTUNGSBEREICH: '1' })).toThrow(WienParseError)
    expect(() => wienStripKey({ STRNAM: '   ' })).toThrow(WienParseError)
    expect(() => wienStripKey({ STRNAM: 'x'.repeat(200) })).toThrow(/Zeichen/)
  })
})

describe('der echte Abzug vom 17. September 2026', () => {
  it('trägt die 81 Flächen, 23 Bezirke und die Zählung der 796 Streifen', () => {
    expect(AREAS.anzahl).toBe(81)
    expect(AREAS.flaechen).toHaveLength(81)
    expect(DISTRICTS.anzahl).toBe(23)
    expect(DISTRICTS.bezirke).toHaveLength(23)
    expect(STRIPS.anzahlGesamt).toBe(796)
    expect(Object.values(STRIPS.zeitraum).reduce((n, k) => n + k, 0)).toBe(796)
    expect(STRIPS.streifen).toHaveLength(STRIPS.anzahlAuszug)
  })

  it('liest jede Fläche und jeden Streifen des Auszugs ohne Ausnahme', () => {
    for (const area of AREAS.flaechen) {
      expect(parseWienSchedule(area.ZEITRAUM ?? '').length, area.id).toBeGreaterThan(0)
      expect(parseWienMaxStay(area.DAUER ?? ''), area.id).toBeGreaterThan(0)
      expect(wienAreaKey(area), area.id).toMatch(/^\d{1,2}(\+\d{1,2})?$/)
    }
    for (const strip of STRIPS.streifen) {
      expect(parseWienSchedule(strip.ZEITRAUM ?? '').length, strip.id).toBeGreaterThan(0)
      expect(parseWienMaxStay(strip.DAUER ?? ''), strip.id).toBeGreaterThan(0)
      expect(wienStripKey(strip).length, strip.id).toBeGreaterThan(0)
    }
  })

  it('liest jede der 26 Schreibweisen — auch die, für die kein Streifen im Auszug steht', () => {
    for (const text of [...Object.keys(AREAS.zeitraum), ...Object.keys(STRIPS.zeitraum)]) {
      expect(parseWienSchedule(text).length, text).toBeGreaterThan(0)
    }
    for (const text of [...Object.keys(AREAS.dauer), ...Object.keys(STRIPS.dauer)]) {
      expect(parseWienMaxStay(text), text).toBeGreaterThan(0)
    }
  })

  it('nagelt die Schreibweisen fest, damit eine Feed-Änderung die CI rot macht', () => {
    expect(AREAS.zeitraum).toEqual({
      'Mo.-Fr. (werkt.) v. 9-22 Uhr': 78,
      'Mo.-Fr. (werkt.) v. 8-11 Uhr': 2,
      'Mo.-Fr. (werkt.) v. 8-18 Uhr; Sa. (werkt.) v. 8-12 Uhr': 1,
    })
    expect(AREAS.dauer).toEqual({ '2 h': 80, '1,5 h': 1 })
    expect(Object.keys(STRIPS.zeitraum)).toHaveLength(23)
    expect(STRIPS.zeitraum['Mo.-Fr. (w.) v. 8-18h, Sa. (w.) v. 8-12h']).toBe(667)
    expect(STRIPS.dauer).toEqual({ '1,5 h': 793, '2 h': 3 })
    expect(STRIPS.geometrie).toEqual({ LineString: 795, MultiLineString: 1 })
    // Die Zählung der Flächen im Auszug stimmt mit der Zählung überein.
    const gezaehlt: Record<string, number> = {}
    for (const area of AREAS.flaechen) gezaehlt[area.ZEITRAUM ?? ''] = (gezaehlt[area.ZEITRAUM ?? ''] ?? 0) + 1
    expect(gezaehlt).toEqual(AREAS.zeitraum)
  })

  it('kennt 22 Bezirke über BEZIRK und Margareten nur über BEZIRK2', () => {
    const erste = new Set(AREAS.flaechen.map((area) => area.BEZIRK))
    expect(erste.size).toBe(22)
    expect(erste.has(5)).toBe(false)
    const zweite = AREAS.flaechen.filter((area) => area.BEZIRK2 !== null && area.BEZIRK2 !== undefined)
    expect(zweite.map((area) => wienAreaKey(area)).sort()).toEqual(['14+15', '14+15', '4+5'])
    const alle = new Set(AREAS.flaechen.flatMap((area) => wienAreaDistricts(area)))
    expect([...alle].sort((a, b) => a - b)).toEqual(Array.from({ length: 23 }, (_, i) => i + 1))
  })

  it('führt die Bezirke 1 bis 23 je einmal, mit Namen', () => {
    expect(DISTRICTS.bezirke.map((b) => b.BEZNR)).toEqual(Array.from({ length: 23 }, (_, i) => i + 1))
    expect(DISTRICTS.bezirke.find((b) => b.BEZNR === 17)?.NAMEK).toBe('Hernals')
    expect(DISTRICTS.bezirke.find((b) => b.BEZNR === 5)?.NAMEK).toBe('Margareten')
    expect(DISTRICTS.bezirke.find((b) => b.BEZNR === 1)?.NAMEK_NUM).toBe('1., Innere Stadt')
  })

  it('liefert die Geometrie in Grad und in GeoJSON-Reihenfolge — Länge zuerst', () => {
    for (const row of [...AREAS.flaechen, ...STRIPS.streifen]) {
      const [lon, lat] = row.firstPoint
      expect(lon, row.id).toBeGreaterThan(16.1)
      expect(lon, row.id).toBeLessThan(16.6)
      expect(lat, row.id).toBeGreaterThan(48.1)
      expect(lat, row.id).toBeLessThan(48.35)
    }
  })

  it('führt die Sonderfälle der Streifen: ohne Spanne, als MultiLineString, mit Platzhalterdatum', () => {
    expect(STRIPS.streifen.filter((s) => s.GELTUNGSBEREICH === null)).toHaveLength(6)
    expect(STRIPS.streifen.filter((s) => s.geometryType === 'MultiLineString').map((s) => s.STRNAM)).toEqual(['Erdberger Lände'])
    expect(STRIPS.streifen.filter((s) => s.GUELTIG_VON === '1111-11-10Z')).toHaveLength(2)
  })
})

/**
 * Eine Wiener Zone im Modell — gegen den Kalender `AT-W`.
 */
describe('eine Wiener Zone im Modell', () => {
  const bezirk: ParkingZone = {
    id: '17',
    name: '17',
    land: 'AT-W',
    fee: wienFee(),
    windows: parseWienSchedule('Mo.-Fr. (werkt.) v. 9-22 Uhr'),
    maxStayMinutes: parseWienMaxStay('2 h'),
    freeOnHolidays: true,
  }
  const geschaeftsstrasse: ParkingZone = {
    ...bezirk,
    id: 'Währinger Straße 121 bis 123',
    name: 'Währinger Straße 121 bis 123',
    windows: parseWienSchedule('Mo.-Fr. (w.) v. 8-18h, Sa. (w.) v. 8-12h'),
    maxStayMinutes: parseWienMaxStay('1,5 h'),
  }
  // Mittwoch, 16. September 2026, 19:30 MESZ = 17:30 UTC.
  const mittwochAbend = Date.UTC(2026, 8, 16, 17, 30)
  // Samstag, 19. September 2026, 10:00 MESZ.
  const samstagVormittag = Date.UTC(2026, 8, 19, 8)

  it('kassiert im Bezirk am Mittwochabend, in der Geschäftsstraße nicht mehr', () => {
    expect(isChargeable(bezirk, mittwochAbend)).toBe(true)
    expect(isChargeable(geschaeftsstrasse, mittwochAbend)).toBe(false)
  })

  it('kassiert samstags nur in der Geschäftsstraße', () => {
    expect(isChargeable(bezirk, samstagVormittag)).toBe(false)
    expect(isChargeable(geschaeftsstrasse, samstagVormittag)).toBe(true)
  })

  it('kassiert am Nationalfeiertag und an Fronleichnam nicht, am Karfreitag schon', () => {
    // 26. Oktober 2026 ist ein Montag, 4. Juni 2026 ein Donnerstag, 3. April 2026 ein Freitag.
    expect(holidaysFor('AT-W', 2026).has('2026-10-26')).toBe(true)
    expect(isChargeable(bezirk, Date.UTC(2026, 9, 26, 10))).toBe(false)
    expect(isChargeable(bezirk, Date.UTC(2026, 5, 4, 10))).toBe(false)
    expect(isChargeable(bezirk, Date.UTC(2026, 3, 3, 10))).toBe(true)
  })

  it('kassiert am 3. Oktober — der deutsche Feiertag gilt in Wien nicht', () => {
    // 3. Oktober 2028 ist ein Dienstag.
    expect(isChargeable(bezirk, Date.UTC(2028, 9, 3, 10))).toBe(true)
  })
})
