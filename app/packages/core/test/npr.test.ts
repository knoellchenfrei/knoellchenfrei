/**
 * Der NPR-Dialekt gegen jede Ausprägung der sechs Städte — und gegen den
 * ausgelieferten Abzug.
 *
 * Die Fixtures sind wörtliche Auszüge des Abrufs vom 17. September 2026
 * (`fixtures/npr-*-2026-09-17.json`), je Tabelle so gewählt, dass jede
 * Schreibweise einmal vorkommt: drei Datumsformate, `2400`, `0–100`, `1130`,
 * `1`, `202`, jeder Tagestyp, jede Tarifklasse.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { CITIES, cityByKey } from '../src/city.js'
import { holidaysFor } from '../src/holidays.js'
import {
  NPR_WEEKDAYS,
  NprParseError,
  mergeNprFees,
  nprChargeWindow,
  nprDateKey,
  nprDayKind,
  nprEventRule,
  nprExtraFreeDays,
  nprFareCostCents,
  nprFeeText,
  nprHolidayFindings,
  nprHolidayRule,
  nprIsoDate,
  nprScheduleText,
  nprValidOn,
  nprWeekdayName,
  parseNprFare,
  parseNprFarePart,
  parseNprMaxDuration,
  parseNprTime,
  parseNprTimeFrame,
  parseNprWkt,
  type NprFarePartRow,
  type NprGeometryRow,
  type NprSpecialDayRow,
  type NprTimeFrame,
  type NprTimeFrameRow,
} from '../src/npr.js'
import type { ChargeWindow } from '../src/tariff.js'

const read = <T>(name: string): T =>
  JSON.parse(readFileSync(join(import.meta.dirname, 'fixtures', name), 'utf8')) as T

const TIJDVAK = read<NprTimeFrameRow[]>('npr-tijdvak-2026-09-17.json')
const TARIEFDEEL = read<NprFarePartRow[]>('npr-tariefdeel-2026-09-17.json')
const GEOMETRIE = read<NprGeometryRow[]>('npr-geometrie-2026-09-17.json')
const SPECIALEDAG = read<NprSpecialDayRow[]>('npr-specialedag-2026-09-17.json')

const teile = (stadt: string, code: string): NprFarePartRow[] =>
  TARIEFDEEL.filter(
    (row) => row.areamanagerid === stadt && row.farecalculationcode === code && row.enddatefarepart === '29991231'
  )

describe('nprDateKey', () => {
  it('liest die drei Schreibweisen des Feeds auf JJJJMMTT', () => {
    expect(nprDateKey('20150501')).toBe('20150501')
    expect(nprDateKey('20230918142140')).toBe('20230918')
    expect(nprDateKey('2026-03-30T00:00:00.000')).toBe('20260330')
    expect(nprDateKey('2099-01-01')).toBe('20990101')
  })

  it('gibt für ein fehlendes Datum null zurück — das offene Ende der Geometrie-Tabelle', () => {
    expect(nprDateKey(null)).toBeNull()
    expect(nprDateKey(undefined)).toBeNull()
    expect(nprDateKey('  ')).toBeNull()
  })

  it('wirft bei allem anderen seine eigene Fehlerklasse', () => {
    for (const raw of ['2026', '1.5.2026', '20261301x', 'gestern', '2026-09-17T', '2026091']) {
      expect(() => nprDateKey(raw), raw).toThrow(NprParseError)
    }
  })
})

describe('nprValidOn', () => {
  it('nimmt, was begonnen hat und nicht geendet ist', () => {
    expect(nprValidOn('20230501', '29991231', '20260917')).toBe(true)
    expect(nprValidOn('2026-03-30T00:00:00.000', '2099-01-01T00:00:00.000', '20260917')).toBe(true)
    expect(nprValidOn('20230918142140', null, '20260917')).toBe(true)
  })

  it('weist Fassungen ab, die in der Zukunft beginnen oder am Stichtag enden', () => {
    // Utrechts Gebiet 21400 mit REG08 ab dem 1. November 2026 steht schon im Abzug.
    expect(nprValidOn('20261101000000', '29991231235959', '20260917')).toBe(false)
    expect(nprValidOn('20230501', '20260917', '20260917')).toBe(false)
    expect(nprValidOn(null, '29991231', '20260917')).toBe(false)
  })

  it('verlangt einen Stichtag in JJJJMMTT', () => {
    expect(() => nprValidOn('20230501', null, '2026-09-17')).toThrow(NprParseError)
  })

  it('erkennt in der Fixture genau die eine abgelaufene Tarifzeile (Utrechts TAR03 von vor 2026)', () => {
    expect(TIJDVAK.every((row) => nprValidOn(row.startdatetimeframe, row.enddatetimeframe, '20260917'))).toBe(true)
    const abgelaufen = TARIEFDEEL.filter((row) => !nprValidOn(row.startdatefarepart, row.enddatefarepart, '20260917'))
    expect(abgelaufen.map((row) => [row.farecalculationcode, row.amountfarepart])).toEqual([['TAR03', '0.03816667']])
  })
})

describe('parseNprTime', () => {
  it('liest uumm — 0, 900, 1130, 2400 und Den Haags 1 und 202', () => {
    expect(parseNprTime('0')).toBe(0)
    expect(parseNprTime('900')).toBe(540)
    expect(parseNprTime('1130')).toBe(690)
    expect(parseNprTime('930')).toBe(570)
    expect(parseNprTime('2400')).toBe(1440)
    expect(parseNprTime('1')).toBe(1)
    expect(parseNprTime('202')).toBe(122)
  })

  it('wirft bei Minuten über 59, Stunden über 24 und Nicht-Zahlen', () => {
    for (const raw of ['960', '2401', '2500', '9:00', '', ' ', '-1', '12345', 'NaN']) {
      expect(() => parseNprTime(raw), raw).toThrow(NprParseError)
    }
    expect(() => parseNprTime(null)).toThrow(NprParseError)
  })

  it('liest jede Zeit der Fixture', () => {
    for (const row of TIJDVAK) {
      expect(parseNprTime(row.starttimetimeframe)).toBeLessThan(parseNprTime(row.endtimetimeframe))
    }
  })
})

describe('parseNprTimeFrame', () => {
  it('liest Utrechts REG03: Mo–Sa 9–21 mit TAR03', () => {
    const rows = TIJDVAK.filter((row) => row.regulationid === 'REG03')
    expect(rows.length).toBe(6)
    const frames = rows.map(parseNprTimeFrame)
    expect(new Set(frames.map((frame) => frame.dayType))).toEqual(
      new Set(['MAANDAG', 'DINSDAG', 'WOENSDAG', 'DONDERDAG', 'VRIJDAG', 'ZATERDAG'])
    )
    for (const frame of frames) {
      expect(frame).toMatchObject({ kind: 'weekday', fromMinute: 540, toMinute: 1260, fareCode: 'TAR03', claimable: true })
      expect(frame.maxDurationMinutes).toBeUndefined()
    }
    const windows = frames.map(nprChargeWindow)
    expect(windows.map((window) => window?.weekdays[0]).sort()).toEqual([1, 2, 3, 4, 5, 6])
  })

  it('lässt Fenster über Mitternacht so, wie die Quelle sie schreibt: zwei Zeilen desselben Tages', () => {
    const samstag = TIJDVAK.filter((row) => row.regulationid === 'REG01' && row.daytimeframe === 'ZATERDAG').map(parseNprTimeFrame)
    expect(samstag.map((frame) => [frame.fromMinute, frame.toMinute])).toEqual([
      [0, 60],
      [420, 1440],
    ])
  })

  it('liest Höchstdauer, fehlenden Tarifcode und „nicht erwerbbar"', () => {
    const mitDauer = parseNprTimeFrame(TIJDVAK.find((row) => row.maxdurationright === '540') as NprTimeFrameRow)
    expect(mitDauer.maxDurationMinutes).toBe(540)
    const ohneCode = parseNprTimeFrame(TIJDVAK.find((row) => row.regulationid === 'GVBOSRIJK') as NprTimeFrameRow)
    expect(ohneCode.fareCode).toBeNull()
    expect(ohneCode.claimable).toBe(true)
    const gesperrt = parseNprTimeFrame(TIJDVAK.find((row) => row.claimrightpossible === 'N') as NprTimeFrameRow)
    expect(gesperrt.claimable).toBe(false)
  })

  it('gibt für Feiertags- und Ereignistypen kein ChargeWindow', () => {
    for (const row of TIJDVAK) {
      const frame = parseNprTimeFrame(row)
      const window = nprChargeWindow(frame)
      expect(window === null, row.daytimeframe ?? '').toBe(frame.kind !== 'weekday')
    }
  })

  it('wirft, wenn Anfang und Ende nicht in der Reihenfolge stehen oder der Tagestyp fehlt', () => {
    expect(() => parseNprTimeFrame({ daytimeframe: 'MAANDAG', starttimetimeframe: '2100', endtimetimeframe: '900' })).toThrow(NprParseError)
    expect(() => parseNprTimeFrame({ daytimeframe: 'MAANDAG', starttimetimeframe: '900', endtimetimeframe: '900' })).toThrow(NprParseError)
    expect(() => parseNprTimeFrame({ daytimeframe: '', starttimetimeframe: '900', endtimetimeframe: '2100' })).toThrow(NprParseError)
  })
})

describe('nprDayKind', () => {
  it('kennt die Wochentage, die Feiertagstypen aller sechs Städte und den Tippfehler aus Rotterdam', () => {
    for (const name of Object.keys(NPR_WEEKDAYS)) expect(nprDayKind(name)).toBe('weekday')
    for (const type of [
      'FEESTDAG', 'FEESTDAG 2E', 'ZONFEESTDAG', 'FEEST GRAT', 'FEEST ZOND', '1E KERSTDAG', '2E KERSTDAG',
      '1E PAASDAG', '2E PAASDAG', '1E PINKSTERDAG', '2E PINKERSTERDAG', 'HEMELVAARTSDAG', 'KONINGSDAG',
      'NIEUWJAARSDAG', 'BEVRIJDINGSDAG',
    ]) {
      expect(nprDayKind(type), type).toBe('holiday')
    }
    for (const type of ['VOETBAL1430', 'AHOY_ZATERDAG', 'AHOY900_WOENSDAG', 'EVENEMENT', 'OPENDAG', 'MONSTERJAM', 'KOOPZONDAG', 'KOOPAVOND', 'VB2045NATL']) {
      expect(nprDayKind(type), type).toBe('event')
    }
  })

  it('ordnet jeden Tagestyp der Fixture einer der drei Sorten zu', () => {
    const typen = new Set(TIJDVAK.map((row) => row.daytimeframe ?? ''))
    expect(typen.size).toBeGreaterThan(15)
    for (const type of typen) expect(['weekday', 'holiday', 'event']).toContain(nprDayKind(type))
  })
})

describe('parseNprMaxDuration', () => {
  it('liest 0 als keine Grenze, alles andere als Minuten', () => {
    expect(parseNprMaxDuration('0')).toBeUndefined()
    expect(parseNprMaxDuration('120')).toBe(120)
    expect(parseNprMaxDuration('1440')).toBe(1440)
    expect(parseNprMaxDuration(null)).toBeUndefined()
    expect(parseNprMaxDuration('')).toBeUndefined()
    expect(() => parseNprMaxDuration('2h')).toThrow(NprParseError)
  })
})

describe('parseNprFare', () => {
  it('Utrecht TAR03: 0,089 je Minute sind 5,34 € je Stunde, mit Rundungsrest', () => {
    const fare = parseNprFare(teile('344', 'TAR03'))
    expect(fare).toMatchObject({ kind: 'hourly', fee: { kind: 'exact', centsPerHour: 534 }, hourCents: [534, 534, 534] })
  })

  it('Rotterdam TAR01: 1,07 je 10 Minuten sind 6,42 € je Stunde', () => {
    expect(parseNprFare(teile('599', 'TAR01')).kind === 'hourly' && parseNprFare(teile('599', 'TAR01'))).toMatchObject({
      fee: { kind: 'exact', centsPerHour: 642 },
    })
  })

  it('Den Haag 400: 0,10 je 60 Minuten sind 0,10 € je Stunde — kein Nullbetrag', () => {
    expect(parseNprFare(teile('518', '400'))).toMatchObject({ fee: { kind: 'exact', centsPerHour: 10 } })
  })

  it('Rotterdam TAR04 Nultarief ist frei, kein Betrag von 0', () => {
    expect(parseNprFare(teile('599', 'TAR04'))).toEqual({ kind: 'free' })
  })

  it('Rotterdam TAR05 Stop en Shop: 0,20 für 30 Minuten, dann Niedrigtarif — 1,32 / 2,24 / 2,24', () => {
    const fare = parseNprFare(teile('599', 'TAR05'))
    expect(fare).toMatchObject({ kind: 'hourly', hourCents: [132, 224, 224], fee: { kind: 'range', minCentsPerHour: 132, maxCentsPerHour: 224 } })
  })

  it('Den Haag PROG2: zwei Stunden zu 1 €, dann steigend — Spanne 1,00–2,75', () => {
    const fare = parseNprFare(teile('518', 'PROG2'))
    expect(fare).toMatchObject({ hourCents: [100, 100, 275], fee: { kind: 'range', minCentsPerHour: 100, maxCentsPerHour: 275 } })
  })

  it('Groningen TAR09: erste 90 Minuten 0,50, dann 2,70 — die Spanne beginnt über null', () => {
    const fare = parseNprFare(teile('14', 'TAR09'))
    expect(fare).toMatchObject({ hourCents: [33, 152, 270], fee: { kind: 'range', minCentsPerHour: 33, maxCentsPerHour: 270 } })
  })

  it('Eindhoven TAR01: Starttarif 0,30 plus 4,50 je Stunde — die erste Stunde ist die teure', () => {
    const fare = parseNprFare(teile('772', 'TAR01'))
    expect(fare).toMatchObject({ hourCents: [480, 450, 450], fee: { kind: 'range', minCentsPerHour: 450, maxCentsPerHour: 480 } })
  })

  it('Pauschalen: Nijmegen 1,00 je 3 Stunden und Eindhoven 22,75 je 900 Minuten', () => {
    expect(parseNprFare(teile('268', 'TAR05'))).toEqual({
      kind: 'flat',
      stepMinutes: 180,
      stepCents: 100,
      fee: { kind: 'range', minCentsPerHour: 33, maxCentsPerHour: 100 },
    })
    expect(parseNprFare(teile('772', 'TAR06'))).toMatchObject({
      kind: 'flat',
      stepCents: 2275,
      fee: { kind: 'range', minCentsPerHour: 152, maxCentsPerHour: 2275 },
    })
  })

  it('rechnet angefangene Schritte, wie das NPR bucht', () => {
    const parts = teile('599', 'TAR01').map(parseNprFarePart)
    expect(nprFareCostCents(parts, 1)).toBe(107)
    expect(nprFareCostCents(parts, 10)).toBe(107)
    expect(nprFareCostCents(parts, 11)).toBe(214)
    expect(nprFareCostCents(parts, 0)).toBe(0)
  })

  it('wirft bei Lücken in der Staffel, negativer Dauer und leerer Liste', () => {
    const parts = teile('518', 'PROG2').map(parseNprFarePart)
    expect(() => nprFareCostCents(parts.filter((part) => part.fromMinute !== 120), 60)).toThrow(NprParseError)
    expect(() => nprFareCostCents(parts.slice(0, 2), 60)).toThrow(NprParseError)
    expect(() => nprFareCostCents(parts, -1)).toThrow(NprParseError)
    expect(() => parseNprFare([])).toThrow(NprParseError)
  })

  it('wirft bei Schrittweite 0, verkehrter Dauer und Nicht-Zahlen', () => {
    const basis = { startdurationfarepart: '0', enddurationfarepart: '999999', amountfarepart: '0.05', stepsizefarepart: '1' }
    expect(() => parseNprFarePart({ ...basis, stepsizefarepart: '0' })).toThrow(NprParseError)
    expect(() => parseNprFarePart({ ...basis, enddurationfarepart: '0' })).toThrow(NprParseError)
    expect(() => parseNprFarePart({ ...basis, amountfarepart: '-1' })).toThrow(NprParseError)
    expect(() => parseNprFarePart({ ...basis, amountfarepart: '1,07' })).toThrow(NprParseError)
    expect(() => parseNprFarePart({ ...basis, stepsizefarepart: '1.5' })).toThrow(NprParseError)
    expect(() => parseNprFarePart({ ...basis, amountfarepart: null })).toThrow(NprParseError)
  })

  it('beziffert nie eine Null: jeder Tarif der Fixture ist frei oder über null', () => {
    const codes = new Set(TARIEFDEEL.map((row) => `${row.areamanagerid}:${row.farecalculationcode}`))
    for (const key of codes) {
      const [stadt, code] = key.split(':') as [string, string]
      const fare = parseNprFare(teile(stadt, code))
      if (fare.kind === 'free') continue
      if (fare.fee.kind === 'exact') expect(fare.fee.centsPerHour).toBeGreaterThan(0)
      if (fare.fee.kind === 'range') {
        expect(fare.fee.minCentsPerHour).toBeGreaterThan(0)
        expect(fare.fee.minCentsPerHour).toBeLessThan(fare.fee.maxCentsPerHour)
      }
    }
  })
})

describe('mergeNprFees', () => {
  it('lässt einen Satz stehen und macht aus zweien eine Spanne', () => {
    expect(mergeNprFees([{ kind: 'exact', centsPerHour: 275 }])).toEqual({ kind: 'exact', centsPerHour: 275 })
    expect(mergeNprFees([{ kind: 'exact', centsPerHour: 275 }, { kind: 'exact', centsPerHour: 275 }])).toEqual({ kind: 'exact', centsPerHour: 275 })
    expect(mergeNprFees([{ kind: 'exact', centsPerHour: 275 }, { kind: 'range', minCentsPerHour: 100, maxCentsPerHour: 275 }])).toEqual({
      kind: 'range',
      minCentsPerHour: 100,
      maxCentsPerHour: 275,
    })
    expect(mergeNprFees([{ kind: 'exact', centsPerHour: 224 }, { kind: 'exact', centsPerHour: 642 }])).toEqual({
      kind: 'range',
      minCentsPerHour: 224,
      maxCentsPerHour: 642,
    })
  })

  it('sagt unbekannt, wenn kein Betrag dabei ist', () => {
    expect(mergeNprFees([])).toEqual({ kind: 'unknown' })
    expect(mergeNprFees([{ kind: 'unknown' }, { kind: 'disc' }])).toEqual({ kind: 'unknown' })
  })
})

describe('nprFeeText', () => {
  it('nennt Beschreibung und Ergebnis der Staffel', () => {
    expect(nprFeeText('kortparkeertarief gebied 3', parseNprFare(teile('344', 'TAR03')))).toBe('kortparkeertarief gebied 3 — 5,34 €/h')
    expect(nprFeeText('A1: 0,30 starttarief, 4,50 per uur (2026)', parseNprFare(teile('772', 'TAR01')))).toBe(
      'A1: 0,30 starttarief, 4,50 per uur (2026) — 1. Stunde 4,80 €, 2. Stunde 4,50 €, 3. Stunde 4,50 €'
    )
    expect(nprFeeText('1,00  per 3 uur', parseNprFare(teile('268', 'TAR05')))).toBe('1,00  per 3 uur — Pauschale 1,00 € je 180 Minuten')
    expect(nprFeeText(null, { kind: 'free' })).toBe('ohne Gebühr')
  })
})

describe('parseNprWkt', () => {
  it('liest Utrechts Polygon 10100 als geschlossenen Ring in Grad', () => {
    const row = GEOMETRIE.find((entry) => entry.areaid === '10100') as NprGeometryRow
    const geometry = parseNprWkt(row.areageometryastext)
    expect(geometry.type).toBe('Polygon')
    const rings = geometry.coordinates as [number, number][][]
    expect(rings.length).toBe(1)
    const ring = rings[0] as [number, number][]
    expect(ring.length).toBe(14)
    expect(ring[0]).toEqual([5.099391278, 52.082558253])
    expect(ring[0]).toEqual(ring[ring.length - 1])
  })

  it('liest Rotterdams MultiPolygon in seine Teile', () => {
    const row = GEOMETRIE.find((entry) => entry.areageometryastext?.startsWith('MULTIPOLYGON')) as NprGeometryRow
    const geometry = parseNprWkt(row.areageometryastext)
    expect(geometry.type).toBe('MultiPolygon')
    const polygons = geometry.coordinates as [number, number][][][]
    expect(polygons.length).toBeGreaterThan(1)
    for (const polygon of polygons) {
      expect(polygon.length).toBeGreaterThan(0)
      for (const ring of polygon) expect(ring.length).toBeGreaterThanOrEqual(4)
    }
  })

  it('schliesst einen offenen Ring und wirft bei zwei Punkten', () => {
    const geometry = parseNprWkt('POLYGON ((4.4 51.9, 4.5 51.9, 4.5 52.0, 4.4 52.0))')
    expect((geometry.coordinates as number[][][])[0]?.length).toBe(5)
    // Drei Punkte sind nach dem Schließen ein Dreieck; zwei bleiben eine Linie.
    expect((parseNprWkt('POLYGON ((4.4 51.9, 4.5 51.9, 4.5 52.0))').coordinates as number[][][])[0]?.length).toBe(4)
    expect(() => parseNprWkt('POLYGON ((4.4 51.9, 4.5 51.9))')).toThrow(NprParseError)
  })

  it('weist Punkte, Meter und Unfug ab', () => {
    expect(() => parseNprWkt('POINT (6.86 53.33)')).toThrow(NprParseError)
    expect(() => parseNprWkt('POLYGON ((477189.85 5550859.91, 477190 5550860, 477191 5550861, 477189.85 5550859.91))')).toThrow(NprParseError)
    expect(() => parseNprWkt('POLYGON ((a b, c d, e f, a b))')).toThrow(NprParseError)
    expect(() => parseNprWkt('POLYGON (())')).toThrow(NprParseError)
    expect(() => parseNprWkt(null)).toThrow(NprParseError)
    expect(() => parseNprWkt('')).toThrow(NprParseError)
  })
})

describe('nprScheduleText', () => {
  const window = (weekdays: ChargeWindow['weekdays'], from: number, to: number): ChargeWindow => ({ weekdays, fromMinute: from, toMinute: to })

  it('fasst gleiche Tage zu Spannen zusammen und hängt Uhr an', () => {
    expect(nprScheduleText([1, 2, 3, 4, 5, 6].map((day) => window([day as 1], 540, 1260)))).toBe('Mo–Sa 9–21 Uhr')
    expect(nprScheduleText([...[1, 2, 3, 4, 5, 6].map((day) => window([day as 1], 540, 1380)), window([0], 720, 1380)])).toBe(
      'Mo–Sa 9–23, So 12–23 Uhr'
    )
  })

  it('ordnet mehrere Fenster eines Tages nach der Uhrzeit, nicht nach der Zeichenkette', () => {
    expect(nprScheduleText([window([1], 900, 1380), window([1], 540, 900)])).toBe('Mo 9–15 und 15–23 Uhr')
    expect(nprScheduleText([window([6], 0, 60), window([6], 420, 1440)])).toBe('Sa 0–1 und 7–24 Uhr')
  })

  it('schreibt zwei Tage mit Komma, Minuten mit Doppelpunkt und nichts für keine Fenster', () => {
    expect(nprScheduleText([window([5], 600, 1440), window([6], 600, 1440)])).toBe('Fr, Sa 10–24 Uhr')
    expect(nprScheduleText([window([0], 690, 1440)])).toBe('So 11:30–24 Uhr')
    expect(nprScheduleText([])).toBe('')
  })
})

/**
 * Der Feiertagsabgleich — gegen die SPECIALE-DAG-Fixture der Städte und den
 * Kalender aus `holidays.ts`. Was die Gemeinde in der Quelle tut, entscheidet;
 * der Kalender stellt nur die Frage.
 */
describe('Feiertage gegen die Quelle', () => {
  const specialDays = (stadt: string): Map<string, string> =>
    new Map(
      SPECIALEDAG.filter((row) => row.areamanagerid === stadt).map((row) => [
        nprIsoDate(nprDateKey(row.datespecialday) as string),
        row.namespecialday as string,
      ])
    )
  const frame = (dayType: string, from: number, to: number, fareCode: string | null = 'TAR'): NprTimeFrame => ({
    dayType,
    kind: nprDayKind(dayType),
    fromMinute: from,
    toMinute: to,
    fareCode,
    claimable: true,
    maxDurationMinutes: undefined,
  })
  const moSa = ['MAANDAG', 'DINSDAG', 'WOENSDAG', 'DONDERDAG', 'VRIJDAG', 'ZATERDAG'].map((day) => frame(day, 540, 1380))

  it('nprWeekdayName kennt den Wochentag eines Datums', () => {
    expect(nprWeekdayName('2026-04-27')).toBe('MAANDAG')
    expect(nprWeekdayName('2026-12-26')).toBe('ZATERDAG')
    expect(nprWeekdayName('2026-04-05')).toBe('ZONDAG')
    expect(() => nprWeekdayName('20260427')).toThrow(NprParseError)
  })

  it('Utrecht führt keinen Sondertag 2026 — jeder Feiertag auf Mo–Sa wird kassiert, ein Sonntag nicht', () => {
    const findings = nprHolidayFindings(holidaysFor('NL-UT', 2026), specialDays('344'), moSa)
    expect(findings.map((finding) => [finding.date, finding.outcome])).toEqual([
      ['2026-01-01', 'wochentag'],
      ['2026-04-06', 'wochentag'],
      ['2026-04-27', 'wochentag'],
      ['2026-05-14', 'wochentag'],
      ['2026-05-25', 'wochentag'],
      ['2026-12-25', 'wochentag'],
      ['2026-12-26', 'wochentag'],
    ])
    expect(findings.every((finding) => finding.dayType === null)).toBe(true)
    // Dieselbe Zone nur Mo–Fr: der 26. Dezember ist ein Samstag und damit frei.
    const moFr = nprHolidayFindings(holidaysFor('NL-UT', 2026), specialDays('344'), moSa.slice(0, 5))
    expect(moFr.find((finding) => finding.date === '2026-12-26')?.outcome).toBe('frei')
    expect(nprHolidayRule(moFr, 2026)).toBe(
      'Feiertage 2026 laut Quelle: frei am 26.12.; gebührenpflichtig wie am Wochentag am 01.01., 06.04., 27.04., 14.05., 25.05., 25.12.'
    )
  })

  it('Rotterdam: FEEST GRAT ist frei, FEEST ZOND hat die Sonntagszeiten, der 26. Dezember fehlt', () => {
    const frames = [...moSa, frame('ZONDAG', 720, 1380), frame('FEEST ZOND', 720, 1380)]
    const findings = nprHolidayFindings(holidaysFor('NL-ZH', 2026), specialDays('599'), frames)
    const byDate = new Map(findings.map((finding) => [finding.date, finding]))
    expect(byDate.get('2026-01-01')).toMatchObject({ dayType: 'FEEST GRAT', outcome: 'frei' })
    expect(byDate.get('2026-04-27')).toMatchObject({ dayType: 'FEEST ZOND', outcome: 'anders' })
    expect(byDate.get('2026-12-25')).toMatchObject({ dayType: 'FEEST GRAT', outcome: 'frei' })
    expect(byDate.get('2026-12-26')).toMatchObject({ dayType: null, outcome: 'wochentag' })
    expect(nprHolidayRule(findings, 2026)).toBe(
      'Feiertage 2026 laut Quelle: frei am 01.01., 25.12.; gebührenpflichtig wie am Wochentag am 26.12.; mit eigenen Zeiten (hier nicht gerechnet) am 06.04., 27.04., 14.05., 25.05.'
    )
    // Ohne Sonntagsfenster ist „wie Sonntag" frei.
    const ohneSonntag = nprHolidayFindings(holidaysFor('NL-ZH', 2026), specialDays('599'), moSa)
    expect(ohneSonntag.find((finding) => finding.date === '2026-04-27')?.outcome).toBe('frei')
  })

  it('Groningen: FEESTDAG und FEESTDAG 2E sind frei, Koningsdag fehlt in der Quelle', () => {
    const findings = nprHolidayFindings(holidaysFor('NL-GR', 2026), specialDays('14'), moSa)
    expect(findings.filter((finding) => finding.outcome === 'wochentag').map((finding) => finding.date)).toEqual(['2026-04-27'])
    expect(findings.filter((finding) => finding.outcome === 'frei').length).toBe(6)
    // Mit einem Fenster für FEESTDAG 2E (Groningen: 12–17 Uhr, TAR01) werden die zweiten Tage „anders".
    const mit2E = nprHolidayFindings(holidaysFor('NL-GR', 2026), specialDays('14'), [...moSa, frame('FEESTDAG 2E', 720, 1020)])
    expect(mit2E.filter((finding) => finding.outcome === 'anders').map((finding) => finding.date)).toEqual([
      '2026-04-06',
      '2026-05-14',
      '2026-05-25',
      '2026-12-26',
    ])
  })

  it('findet Tage, die die Quelle frei gibt und der Kalender nicht kennt — nur wo der Wochentag kassiert', () => {
    // Groningen: Goede Vrijdag (3. April) als FEESTDAG 2E ohne Fenster.
    expect(nprExtraFreeDays(holidaysFor('NL-GR', 2026), specialDays('14'), moSa, [2026])).toEqual([
      { date: '2026-04-03', dayType: 'FEESTDAG 2E' },
    ])
    // Rotterdam mit Sonntagsfenster: Ostersonntag und Pfingstsonntag sind FEEST GRAT.
    const mitSonntag = [...moSa, frame('ZONDAG', 720, 1380)]
    const rotterdam = nprExtraFreeDays(holidaysFor('NL-ZH', 2026), specialDays('599'), mitSonntag, [2026])
    expect(rotterdam.map((day) => day.date)).toContain('2026-04-05')
    expect(rotterdam.map((day) => day.date)).toContain('2026-05-24')
    // Ereignistage zählen nicht als frei — und ohne Sonntagsfenster ist der Ostersonntag keine Nachricht.
    expect(rotterdam.every((day) => nprDayKind(day.dayType) === 'holiday')).toBe(true)
    expect(nprExtraFreeDays(holidaysFor('NL-ZH', 2026), specialDays('599'), moSa, [2026]).map((day) => day.date)).not.toContain('2026-04-05')
  })

  it('nennt nichts, wenn jeder Feiertag frei ist', () => {
    const alleFrei = nprHolidayFindings(holidaysFor('NL-GR', 2026), specialDays('14'), moSa.slice(0, 5))
    expect(nprHolidayRule(alleFrei.filter((finding) => finding.date !== '2026-04-27'), 2026)).toBeNull()
  })

  it('nprEventRule gruppiert Rotterdams Anstoßzeiten und schweigt ohne Ereignistage', () => {
    expect(nprEventRule(['MAANDAG', 'VOETBAL1430', 'VOETBAL2100', 'AHOY_ZATERDAG', 'AHOY_ZONDAG', 'EVENEMENT', 'FEEST GRAT'])).toBe(
      'Ereignistage laut Quelle mit eigenen Zeiten, hier nicht gerechnet: AHOY… (2 Sorten), EVENEMENT, VOETBAL… (2 Sorten)'
    )
    expect(nprEventRule(['MAANDAG', 'FEESTDAG'])).toBeNull()
  })
})

/**
 * Der ausgelieferte Abzug jeder niederländischen Stadt — dieselbe Prüfung,
 * die `parse-real-data.test.ts` für Berlin macht: Was im Bündel liegt, ist
 * lesbar, hat gültige Fenster, nie einen Nullbetrag, und sagt an Feiertagen
 * das, was die Quelle sagt.
 */
describe('die ausgelieferten niederländischen Zonen', () => {
  const DATEN = join(import.meta.dirname, '../../../apps/web/public/data')
  const NL = CITIES.filter((city) => city.land.startsWith('NL-'))
  interface Zone {
    zone: string
    district: string
    rawHours: string
    rawFee: string
    windows: ChargeWindow[]
    fee: { kind: string; centsPerHour?: number; minCentsPerHour?: number; maxCentsPerHour?: number }
    unmodelledRules: string[]
    freeOnHolidays?: boolean
    maxStayMinutes: number | null
  }
  const zones = (key: string): Zone[] =>
    (JSON.parse(readFileSync(join(DATEN, key, 'zones.geojson'), 'utf8')) as { features: { properties: Zone }[] }).features.map(
      (feature) => feature.properties
    )

  it('sind sechs Städte mit den gemessenen Flächenzahlen', () => {
    expect(NL.map((city) => city.key)).toEqual(['utrecht', 'denhaag', 'rotterdam', 'groningen', 'nijmegen', 'eindhoven'])
    expect(Object.fromEntries(NL.map((city) => [city.key, zones(city.key).length]))).toEqual({
      utrecht: 68,
      denhaag: 93,
      rotterdam: 149,
      groningen: 42,
      nijmegen: 31,
      eindhoven: 71,
    })
  })

  it('haben in jeder Fläche gültige Fenster, einen Betrag über null und Zeiten als Text', () => {
    for (const city of NL) {
      for (const zone of zones(city.key)) {
        const where = `${city.key}/${zone.zone}`
        expect(zone.windows.length, where).toBeGreaterThan(0)
        for (const window of zone.windows) {
          expect(window.fromMinute, where).toBeLessThan(window.toMinute)
          expect(window.toMinute, where).toBeLessThanOrEqual(1440)
        }
        expect(['exact', 'range'], where).toContain(zone.fee.kind)
        expect((zone.fee.centsPerHour ?? zone.fee.minCentsPerHour ?? 0) > 0, where).toBe(true)
        expect(zone.rawHours, where).toMatch(/Uhr$/)
        expect(zone.rawFee.length, where).toBeGreaterThan(3)
        if (zone.maxStayMinutes !== null) expect(zone.maxStayMinutes, where).toBeGreaterThan(0)
      }
    }
  })

  it('kassieren laut Quelle in allen sechs Städten an mindestens einem Feiertag — und sagen es', () => {
    const kassiert: Record<string, number> = {}
    for (const city of NL) {
      const alle = zones(city.key)
      for (const zone of alle) {
        // Das Feld und der Satz gehören zusammen: keines ohne das andere.
        const satz = zone.unmodelledRules.some((rule) => rule.startsWith('Feiertage 2026 laut Quelle'))
        expect(zone.freeOnHolidays === false, `${city.key}/${zone.zone}`).toBe(satz)
      }
      kassiert[city.key] = alle.filter((zone) => zone.freeOnHolidays === false).length
    }
    // Eine Rotterdamer Fläche (Mo–Fr ohne Samstag, Feiertage als FEEST GRAT) bleibt frei.
    expect(kassiert).toEqual({ utrecht: 68, denhaag: 93, rotterdam: 148, groningen: 42, nijmegen: 31, eindhoven: 71 })
    // Groningen gibt jeden Kalenderfeiertag frei außer Koningsdag — den führt die Quelle nicht.
    const groningen = zones('groningen')
    expect(groningen.filter((zone) => zone.unmodelledRules.some((rule) => rule.includes('wie am Wochentag am 27.04.'))).length).toBe(41)
    // Rotterdam: nur zwei Flächen (Ahoy) tragen Ereignistage; Nijmegen eine (Koopavond).
    expect(zones('rotterdam').filter((zone) => zone.unmodelledRules.some((rule) => rule.startsWith('Ereignistage'))).length).toBe(2)
    expect(zones('nijmegen').filter((zone) => zone.unmodelledRules.some((rule) => rule.includes('KOOPAVOND'))).length).toBe(1)
  })

  it('tragen den Stadtteil aus den CBS-Wijken, fast nie den Stadtnamen', () => {
    for (const city of NL) {
      const alle = zones(city.key)
      const ohne = alle.filter((zone) => zone.district === cityByKey(city.key).name)
      expect(ohne.length, city.key).toBeLessThanOrEqual(1)
    }
  })
})
