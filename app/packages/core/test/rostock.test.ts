import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import type { Weekday } from '../src/berlin-time.js'
import { ROSTOCK } from '../src/city.js'
import { holidaysFor } from '../src/holidays.js'
import {
  RostockParseError,
  mergeRostockFees,
  mergeRostockWindows,
  parseRostockAreaName,
  parseRostockFee,
  parseRostockMaxStay,
  parseRostockSchedule,
  rostockMaxStayCode,
  type RostockAutomatProperties,
  type RostockZoneProperties,
} from '../src/rostock.js'
import { isChargeable, type ParkingZone } from '../src/tariff.js'

/**
 * Die echten Quellen, abgerufen am 16. September 2026 — Auszüge aus der
 * WFS-Antwort, nicht ausgedachte Beispiele: elf Automaten, die zusammen jede
 * Schreibweise der Zeiten, beide Automaten ohne Betrag, alle drei Einheiten
 * der Höchstparkdauer, die Busplätze und die Kunsthalle abdecken, und alle
 * zehn Bewohnerparkgebiete.
 */
const read = <T>(name: string): T =>
  JSON.parse(
    readFileSync(fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url)), 'utf8')
  ) as T

const AUTOMATS = read<RostockAutomatProperties[]>('hro-parkscheinautomaten-2026-09-16.json')
const AREAS = read<RostockZoneProperties[]>('hro-bewohnerparkgebiete-2026-09-16.json')

const MO_FR: readonly Weekday[] = [1, 2, 3, 4, 5]
const ALL: readonly Weekday[] = [0, 1, 2, 3, 4, 5, 6]

describe('parseRostockSchedule', () => {
  /**
   * Alle fünf Schreibweisen des Abzugs, mit dem Ergebnis, das sie haben
   * müssen, und wie oft sie vorkommen (111 Automaten).
   */
  const SCHEDULES: {
    raw: string
    count: number
    windows: { weekdays: readonly Weekday[]; from: number; to: number }[]
  }[] = [
    // Ohne Tagesangabe: täglich, nach § 4 Abs. 2 und 3 der Parkgebührenordnung.
    { raw: '08:00-19:00', count: 83, windows: [{ weekdays: ALL, from: 480, to: 1140 }] },
    { raw: '08:00-18:00', count: 22, windows: [{ weekdays: ALL, from: 480, to: 1080 }] },
    { raw: '08:00-20:00', count: 1, windows: [{ weekdays: ALL, from: 480, to: 1200 }] },
    // Zone D — die einzige, die die Gebührenordnung auf Montag bis Freitag
    // beschränkt, und die einzige, die der Feed mit Tag schreibt.
    { raw: 'Mo-Fr 08:00-18:00', count: 4, windows: [{ weekdays: MO_FR, from: 480, to: 1080 }] },
    // Der Strandweg in Warnemünde: Komma als Gruppentrenner, Semikolon als
    // Klauseltrenner, Samstag mit eigenem Fenster.
    {
      raw: 'Mo-Fr,So 08:00-19:00; Sa 15:00-19:00',
      count: 1,
      windows: [
        { weekdays: [0, 1, 2, 3, 4, 5], from: 480, to: 1140 },
        { weekdays: [6], from: 900, to: 1140 },
      ],
    },
  ]

  for (const expectation of SCHEDULES) {
    it(`liest ${JSON.stringify(expectation.raw)}`, () => {
      const windows = parseRostockSchedule(expectation.raw)
      expect(windows).toHaveLength(expectation.windows.length)
      windows.forEach((window, index) => {
        const wanted = expectation.windows[index]
        expect(window.weekdays).toEqual(wanted?.weekdays)
        expect(window.fromMinute).toBe(wanted?.from)
        expect(window.toMinute).toBe(wanted?.to)
      })
    })
  }

  it('deckt die Fixture ohne Ausnahme ab, und die Zählung stimmt', () => {
    const seen = new Set<string>()
    for (const automat of AUTOMATS) {
      const raw = automat.bewirtschaftungszeiten ?? ''
      expect(() => parseRostockSchedule(raw)).not.toThrow()
      seen.add(raw)
    }
    expect([...seen].sort()).toEqual(SCHEDULES.map((s) => s.raw).sort())
    expect(SCHEDULES.reduce((sum, s) => sum + s.count, 0)).toBe(111)
  })

  it('verträgt Leerraum am Rand und doppelte Leerzeichen', () => {
    expect(parseRostockSchedule('  Mo-Fr   08:00 - 18:00 ')).toEqual([
      { weekdays: MO_FR, fromMinute: 480, toMinute: 1080 },
    ])
  })

  it('liest Stunde 24 als Minute 1440, nie als 0', () => {
    expect(parseRostockSchedule('00:00-24:00')).toEqual([
      { weekdays: ALL, fromMinute: 0, toMinute: 1440 },
    ])
  })

  it('läuft bei einer Spanne über den Sonntag rund, statt leer zu bleiben', () => {
    expect(parseRostockSchedule('Sa-Mo 08:00-12:00')[0]?.weekdays).toEqual([0, 1, 6])
  })

  // Eine tagelose Klausel neben einer mit Tag ist widersprüchlich — welche
  // gilt samstags? Im Feed kommt sie nicht vor, und geraten wird nicht.
  it('weist eine tagelose Klausel neben einer mit Tagesangabe ab', () => {
    expect(() => parseRostockSchedule('08:00-19:00; Sa 15:00-19:00')).toThrow(RostockParseError)
  })

  it('weist ab, was der Feed nicht schreibt, statt es zu raten', () => {
    for (const raw of [
      '',
      '   ',
      ';',
      '8:00-19:00', // einstellig — nicht die Schreibweise des Feeds
      '08-19', // ohne Minuten
      '08:00-19:00 Uhr',
      'täglich 08:00-19:00',
      'Mo-Fr 08:60-18:00',
      'Mo-Fr 25:00-26:00',
      '19:00-08:00', // über Mitternacht
      '08:00-08:00',
      'Mo-Fr-Sa 08:00-18:00',
      'Xx 08:00-18:00',
      'Mo,, 08:00-18:00',
      'Mo-Fr 08:00-18:00 Sa 09:00-14:00', // Klauseln ohne Semikolon
    ]) {
      expect(() => parseRostockSchedule(raw), raw).toThrow(RostockParseError)
    }
  })

  it('begrenzt die Eingabelänge, bevor ein Muster sie sieht', () => {
    expect(() => parseRostockSchedule(`${'Mo-Fr 08:00-18:00; '.repeat(20)}`)).toThrow(
      RostockParseError
    )
  })
})

describe('parseRostockFee', () => {
  it('liest jede Zahl des Abzugs als Cent je Stunde', () => {
    expect(parseRostockFee(1.5)).toEqual({ kind: 'exact', centsPerHour: 150 })
    expect(parseRostockFee(3)).toEqual({ kind: 'exact', centsPerHour: 300 })
    expect(parseRostockFee(0.5)).toEqual({ kind: 'exact', centsPerHour: 50 })
    // Die Kunsthalle: 0,60 €. `0.6 * 100` ist in Gleitkomma 60.00000000000001;
    // ohne Rundung wäre das kein ganzer Cent.
    expect(parseRostockFee(0.6)).toEqual({ kind: 'exact', centsPerHour: 60 })
    expect(parseRostockFee(5)).toEqual({ kind: 'exact', centsPerHour: 500 })
  })

  it('liest null und ein fehlendes Feld als unbekannt, nicht als null Euro', () => {
    expect(parseRostockFee(null)).toEqual({ kind: 'unknown' })
    expect(parseRostockFee(undefined)).toEqual({ kind: 'unknown' })
  })

  it('bricht bei einem Betrag von 0,00 ab, statt ihn zu beziffern', () => {
    expect(() => parseRostockFee(0)).toThrow(RostockParseError)
    expect(() => parseRostockFee(-0)).toThrow(RostockParseError)
  })

  it('weist ab, was keine Zahl in Euro ist', () => {
    for (const raw of [Number.NaN, Number.POSITIVE_INFINITY, -1.5, 0.005, 1.234, 1e9]) {
      expect(() => parseRostockFee(raw), String(raw)).toThrow(RostockParseError)
    }
    // Eine Zeichenkette ist laut Typ ausgeschlossen — die JSON-Datei hält sich
    // nicht an Typen (Frankfurts `bewohnerparkzone` war die Lehre).
    expect(() => parseRostockFee('1.5' as unknown as number)).toThrow(RostockParseError)
  })

  it('liest jeden Betrag der Fixture — zwei sind unbekannt, keiner null', () => {
    let unknown = 0
    for (const automat of AUTOMATS) {
      const fee = parseRostockFee(automat.normaltarif_gebuehren_pro_stunde)
      if (fee.kind === 'unknown') unknown += 1
      else expect(fee.kind).toBe('exact')
    }
    expect(unknown).toBe(2)
  })
})

describe('parseRostockMaxStay', () => {
  it('rechnet Zahl und Einheit in Minuten um', () => {
    expect(parseRostockMaxStay(2, 'h')).toBe(120)
    expect(parseRostockMaxStay(30, 'min')).toBe(30)
    expect(parseRostockMaxStay(4, 'd')).toBe(5760)
    expect(parseRostockMaxStay(24, ' H ')).toBe(1440)
  })

  it('liefert nichts, wenn beides fehlt', () => {
    expect(parseRostockMaxStay(null, null)).toBeUndefined()
    expect(parseRostockMaxStay(undefined, undefined)).toBeUndefined()
    expect(parseRostockMaxStay(null, '')).toBeUndefined()
  })

  it('bricht ab, wenn nur eines von beiden da ist — Stunden zu raten wäre raten', () => {
    expect(() => parseRostockMaxStay(2, null)).toThrow(RostockParseError)
    expect(() => parseRostockMaxStay(null, 'h')).toThrow(RostockParseError)
  })

  it('weist 0, Brüche, fremde Einheiten und Monate ab', () => {
    expect(() => parseRostockMaxStay(0, 'h')).toThrow(RostockParseError)
    expect(() => parseRostockMaxStay(-2, 'h')).toThrow(RostockParseError)
    expect(() => parseRostockMaxStay(1.5, 'h')).toThrow(RostockParseError)
    expect(() => parseRostockMaxStay(2, 'Stunden')).toThrow(RostockParseError)
    expect(() => parseRostockMaxStay(40, 'd')).toThrow(RostockParseError)
    expect(() => parseRostockMaxStay('2' as unknown as number, 'h')).toThrow(RostockParseError)
  })

  it('liest jede Höchstparkdauer der Fixture', () => {
    for (const automat of AUTOMATS) {
      const minutes = parseRostockMaxStay(
        automat.normaltarif_parkdauer_max,
        automat.normaltarif_parkdauer_max_einheit
      )
      expect(minutes, String(automat.nummer)).toBeGreaterThan(0)
    }
  })

  it('beschriftet in der Form, die maxStayLabel im Web kennt', () => {
    expect(rostockMaxStayCode(120)).toBe('2h')
    expect(rostockMaxStayCode(30)).toBe('30min')
    expect(rostockMaxStayCode(1440)).toBe('24h')
  })
})

describe('parseRostockAreaName', () => {
  it('trennt Kürzel und Namen am Halbgeviertstrich', () => {
    expect(parseRostockAreaName('A3 – Östliche Altstadt')).toEqual({
      code: 'A3',
      name: 'Östliche Altstadt',
    })
    expect(parseRostockAreaName('H1 – Thünenviertel/Hansaviertel')).toEqual({
      code: 'H1',
      name: 'Thünenviertel/Hansaviertel',
    })
  })

  it('liest jede der zehn Bezeichnungen der Fixture, mit zehn verschiedenen Kürzeln', () => {
    const codes = AREAS.map((area) => parseRostockAreaName(area.bezeichnung ?? '').code)
    expect(codes).toHaveLength(10)
    expect(new Set(codes).size).toBe(10)
    for (const code of codes) expect(code).toMatch(/^[ABHW]\d$/)
  })

  it('weist ab, was keine Bezeichnung dieses Feeds ist', () => {
    for (const raw of ['', 'Östliche Altstadt', 'A3', 'A3 –', '– Altstadt', 'a3 – x', 'A3–Altstadt']) {
      expect(() => parseRostockAreaName(raw), raw).toThrow(RostockParseError)
    }
  })
})

describe('mergeRostockFees', () => {
  it('macht aus zwei Sätzen eine Spanne und aus einem einen Betrag', () => {
    expect(mergeRostockFees([parseRostockFee(1.5), parseRostockFee(2), parseRostockFee(1.5)])).toEqual(
      { kind: 'range', minCentsPerHour: 150, maxCentsPerHour: 200 }
    )
    expect(mergeRostockFees([parseRostockFee(3), parseRostockFee(3)])).toEqual({
      kind: 'exact',
      centsPerHour: 300,
    })
  })

  it('lässt Automaten ohne Betrag die Spanne nicht nach unten ziehen', () => {
    expect(mergeRostockFees([parseRostockFee(null), parseRostockFee(2)])).toEqual({
      kind: 'exact',
      centsPerHour: 200,
    })
    expect(mergeRostockFees([parseRostockFee(null)])).toEqual({ kind: 'unknown' })
    expect(mergeRostockFees([])).toEqual({ kind: 'unknown' })
  })
})

describe('mergeRostockWindows', () => {
  it('wirft Doppelte heraus und verschmilzt Nachbarn nicht', () => {
    const windows = mergeRostockWindows([
      ...parseRostockSchedule('08:00-19:00'),
      ...parseRostockSchedule('08:00-19:00'),
      ...parseRostockSchedule('08:00-18:00'),
    ])
    expect(windows).toHaveLength(2)
    expect(windows.map((w) => w.toMinute)).toEqual([1140, 1080])
  })
})

/**
 * Die Regel, die den Parser trägt, gegen die Tarifrechnung: Ein Gebiet mit
 * `08:00-19:00` kassiert am Sonntag. Das ist § 4 Abs. 2 der
 * Parkgebührenordnung („täglich 8 - 19 Uhr"), und die Rechnung soll es so
 * sagen — sonst stünde am Sonntag in der Altstadt „frei", und das kostet ein
 * Knöllchen.
 */
describe('ein Rostocker Gebiet in der Tarifrechnung', () => {
  const zone: ParkingZone = {
    id: 'A3',
    name: 'A3',
    land: ROSTOCK.land,
    fee: parseRostockFee(1.5),
    windows: parseRostockSchedule('08:00-19:00'),
  }

  it('kassiert am Sonntagmittag und am Dienstagmittag, nicht um 20 Uhr', () => {
    // Sonntag, 20. September 2026, 12:00 MESZ = 10:00 UTC
    expect(isChargeable(zone, Date.UTC(2026, 8, 20, 10, 0))).toBe(true)
    // Dienstag, 22. September 2026, 12:00 MESZ
    expect(isChargeable(zone, Date.UTC(2026, 8, 22, 10, 0))).toBe(true)
    // Dienstag, 20:00 MESZ = 18:00 UTC
    expect(isChargeable(zone, Date.UTC(2026, 8, 22, 18, 0))).toBe(false)
  })

  it('kennt am Reformationstag und am Frauentag den Kalender von Mecklenburg-Vorpommern', () => {
    expect(holidaysFor(ROSTOCK.land, 2026).has('2026-10-31')).toBe(true)
    expect(holidaysFor(ROSTOCK.land, 2026).has('2026-03-08')).toBe(true)
    // Samstag, 31. Oktober 2026, 12:00 MEZ = 11:00 UTC — Feiertag, also frei
    // nach der Regel dieses Projekts (`isFreeDay`), obwohl das Fenster den
    // Samstag enthält. Ob Rostock an Feiertagen kassiert, sagt die Quelle
    // nicht; der Punkt steht in `docs/staedte-rostock.md`.
    expect(isChargeable(zone, Date.UTC(2026, 9, 31, 11, 0))).toBe(false)
  })
})
