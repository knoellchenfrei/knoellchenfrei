import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import type { Weekday } from '../src/berlin-time.js'
import { INNSBRUCK, cityAt, cityCountry, withinCity } from '../src/city.js'
import { holidaysFor } from '../src/holidays.js'
import {
  InnsbruckParseError,
  innsbruckZoneNote,
  parseInnsbruckFee,
  parseInnsbruckInfo,
  parseInnsbruckMaxStay,
  parseInnsbruckSchedule,
  parseInnsbruckTariff,
  type InnsbruckZoneProperties,
} from '../src/innsbruck.js'
import { chargeableAt, estimateCost, isChargeable, type ParkingZone } from '../src/tariff.js'

/**
 * Der echte Abruf vom 16. September 2026 — alle 21 Zonen, ohne Geometrie.
 *
 * Wie bei den sieben Städten davor: Fixtures sind der Feed, nicht ausgedachte
 * Beispiele. Bei 21 Zonen passt der ganze Sachdatenteil in die Fixture, und
 * damit prüft „jeder Wert liest sich" wirklich jeden Wert.
 */
interface Fixture {
  abgerufenAm: string
  quelle: string
  anzahl: number
  geometrieTypen: Record<string, number>
  ersterStuetzpunkt: [number, number]
  laengsterInfoText: number
  zonen: InnsbruckZoneProperties[]
}

const FIXTURE = JSON.parse(
  readFileSync(fileURLToPath(new URL('./fixtures/ibk-parkzonen-2026-09-16.json', import.meta.url)), 'utf8')
) as Fixture
const ROWS = FIXTURE.zonen

const ALL: readonly Weekday[] = [0, 1, 2, 3, 4, 5, 6]
const MO_FR: readonly Weekday[] = [1, 2, 3, 4, 5]
const SA: readonly Weekday[] = [6]

/** Die sieben `INFO`-Werte des Abzugs, mit ihrer Häufigkeit — gezählt, nicht geschätzt. */
const INFO_VALUES: readonly { text: string; count: number }[] = [
  {
    text: 'werktags Mo-Fr von 9-19 Uhr, EUR 1.10 erste halbe Stunde, danach gleicher Tarif in EUR 0.10 - Schritten, jedoch höchstens EUR 9 pro Kalendertag',
    count: 6,
  },
  {
    text: 'werktags Mo-Fr von 9-19 Uhr, EUR 1.10 erste halbe Stunde, danach gleicher Tarif in EUR 0.10 - Schritten',
    count: 5,
  },
  {
    text: 'täglich von 9-19 Uhr, EUR 1.10 erste halbe Stunde, danach gleicher Tarif in EUR 0.10 - Schritten, jedoch höchstens EUR 9 pro Kalendertag',
    count: 4,
  },
  {
    text: 'werktags Mo-Fr von 9-21 Uhr und Sa von 9-13 Uhr, EUR 1.10 erste halbe Stunde, danach gleicher Tarif in EUR 0.10 - Schritten',
    count: 2,
  },
  { text: 'täglich von 1-5 Uhr, kostenfrei', count: 2 },
  {
    text: 'täglich (1.5. bis 31.8.) bzw. werktags Mo-Fr (1.9. bis 30.4.) von 9-19 Uhr, EUR 1.10 erste halbe Stunde, danach gleicher Tarif in EUR 0.10 - Schritten, jedoch höchstens EUR 9 pro Kalendertag',
    count: 1,
  },
  {
    text: 'täglich von 9-19 Uhr, EUR 0.50 erste halbe Stunde, danach gleicher Tarif in EUR 0.10 - Schritten, ab 4. Stunde EUR 1 je halbe Stunde in EUR 0.10 - Schritten (auch dann, wenn Parkvorgang über abgabenfreie Zeit hinaus fortgesetzt wird)',
    count: 1,
  },
]

describe('die Fixture', () => {
  it('ist der ganze Abzug: 21 Zonen, 20 Polygone und ein Multipolygon, in Grad', () => {
    expect(FIXTURE.anzahl).toBe(21)
    expect(ROWS).toHaveLength(21)
    expect(FIXTURE.geometrieTypen).toEqual({ Polygon: 20, MultiPolygon: 1 })
    // `[lon, lat]`: Innsbruck liegt bei 11° Ost, 47° Nord. Vertauscht läge
    // die Stadt im Indischen Ozean, und die Karte sähe nur leer aus.
    const [lon, lat] = FIXTURE.ersterStuetzpunkt
    expect(lon).toBeGreaterThan(11)
    expect(lon).toBeLessThan(12)
    expect(lat).toBeGreaterThan(47)
    expect(lat).toBeLessThan(48)
  })

  it('führt genau die sieben INFO-Werte in genau diesen Häufigkeiten', () => {
    const counts = new Map<string, number>()
    for (const row of ROWS) counts.set(row.INFO ?? '', (counts.get(row.INFO ?? '') ?? 0) + 1)
    expect(counts.size).toBe(INFO_VALUES.length)
    for (const { text, count } of INFO_VALUES) expect(counts.get(text), text).toBe(count)
    expect(INFO_VALUES.reduce((sum, v) => sum + v.count, 0)).toBe(21)
  })

  it('führt genau die sechs BEZEICH-Werte', () => {
    const labels = new Map<string, number>()
    for (const row of ROWS) labels.set(row.BEZEICH ?? '', (labels.get(row.BEZEICH ?? '') ?? 0) + 1)
    expect([...labels.entries()].sort()).toEqual([
      ['Kurzparkzone 180 min kostenpflichtig', 5],
      ['Kurzparkzone 90 min kostenpflichtig', 2],
      ['Kurzparkzone kostenfrei 180 min 1-5 Uhr', 2],
      ['Parkstraße kostenpflichtig (täglich)', 5],
      ['Parkstraße kostenpflichtig (werktags)', 6],
      ['Parkstraße kostenpflichtig (werktags/täglich)', 1],
    ])
  })

  it('vergibt jede FID genau einmal — sie ist der einzige Schlüssel des Feeds', () => {
    const ids = ROWS.map((row) => row.FID)
    expect(new Set(ids).size).toBe(ids.length)
    for (const id of ids) expect(Number.isInteger(id)).toBe(true)
  })

  // Die Grenze im Parser ist an dieser Zahl bemessen; wächst der Feed
  // darüber hinaus, soll das hier auffallen und nicht im Datenbau.
  it('hat keinen INFO-Text über 233 Zeichen', () => {
    expect(Math.max(...ROWS.map((row) => (row.INFO ?? '').length))).toBe(FIXTURE.laengsterInfoText)
    expect(FIXTURE.laengsterInfoText).toBe(233)
  })
})

describe('parseInnsbruckSchedule', () => {
  it('liest täglich von 9-19 Uhr', () => {
    expect(parseInnsbruckSchedule('täglich von 9-19 Uhr')).toEqual({
      windows: [{ weekdays: ALL, fromMinute: 540, toMinute: 1140 }],
      unmodelledRules: [],
    })
  })

  // Der Unterschied zu Hamburg, und der teuerste Fehler dieser Datei: Dort
  // ist „werktags" Mo–Sa. Innsbruck schreibt die Spanne dazu, und die Stadt
  // sagt auf ihrer Seite ausdrücklich „von Montag bis Freitag".
  it('liest werktags Mo-Fr als Montag bis Freitag, ohne Samstag', () => {
    const { windows } = parseInnsbruckSchedule('werktags Mo-Fr von 9-19 Uhr')
    expect(windows).toEqual([{ weekdays: MO_FR, fromMinute: 540, toMinute: 1140 }])
    expect(windows[0]?.weekdays).not.toContain(6)
  })

  it('weist ein nacktes werktags ab, statt eine der beiden Lesarten zu raten', () => {
    expect(() => parseInnsbruckSchedule('werktags von 9-19 Uhr')).toThrow(/Mo-Sa wäre die andere Lesart/)
  })

  it('trennt zwei Klauseln an „und" — die 90-Minuten-Zonen mit Samstagsfenster', () => {
    expect(parseInnsbruckSchedule('werktags Mo-Fr von 9-21 Uhr und Sa von 9-13 Uhr')).toEqual({
      windows: [
        { weekdays: MO_FR, fromMinute: 540, toMinute: 1260 },
        { weekdays: SA, fromMinute: 540, toMinute: 780 },
      ],
      unmodelledRules: [],
    })
  })

  it('liest das nächtliche Fenster der kostenfreien Kurzparkzonen', () => {
    expect(parseInnsbruckSchedule('täglich von 1-5 Uhr').windows).toEqual([
      { weekdays: ALL, fromMinute: 60, toMinute: 300 },
    ])
  })

  /**
   * Die Saisonregel der Zone am Tivoli. Das Modell hat keinen Kalender;
   * genommen wird die Vereinigung der Tage (täglich), und die Klausel steht
   * wörtlich in `unmodelledRules`. Die Richtung ist gewählt, nicht zufällig:
   * Im Winter am Wochenende „kostet" zu sagen, wo es frei ist, kostet
   * niemanden ein Knöllchen — die andere Lesart täte das im Sommer.
   */
  it('nimmt bei einer Saisonregel alle Tage und legt die Klausel wörtlich ab', () => {
    const raw = 'täglich (1.5. bis 31.8.) bzw. werktags Mo-Fr (1.9. bis 30.4.) von 9-19 Uhr'
    expect(parseInnsbruckSchedule(raw)).toEqual({
      windows: [{ weekdays: ALL, fromMinute: 540, toMinute: 1140 }],
      unmodelledRules: [raw],
    })
  })

  it('weist ein Saisondatum ab, das kein Datum ist', () => {
    expect(() => parseInnsbruckSchedule('täglich (1.13. bis 31.8.) bzw. Sa (1.9. bis 30.4.) von 9-19 Uhr')).toThrow(
      /kein Datum/
    )
    expect(() => parseInnsbruckSchedule('täglich (0.5. bis 31.8.) bzw. Sa (1.9. bis 30.4.) von 9-19 Uhr')).toThrow(
      InnsbruckParseError
    )
  })

  it('bildet die Endstunde 24 auf Minute 1440 ab, nicht auf 0', () => {
    expect(parseInnsbruckSchedule('täglich von 9-24 Uhr').windows).toEqual([
      { weekdays: ALL, fromMinute: 540, toMinute: 1440 },
    ])
  })

  // Kommt im Abzug nicht vor; Hamburg hat es, und ein Fenster mit from > to
  // hiesse in `windowCovers` schlicht „nie".
  it('teilt ein Fenster über Mitternacht und dreht die Tage des zweiten Teils', () => {
    expect(parseInnsbruckSchedule('werktags Mo-Fr von 22-1 Uhr').windows).toEqual([
      { weekdays: MO_FR, fromMinute: 1320, toMinute: 1440 },
      { weekdays: [2, 3, 4, 5, 6], fromMinute: 0, toMinute: 60 },
    ])
  })

  it('weist alles ab, was es nicht kennt, statt zu raten', () => {
    for (const raw of [
      '',
      'Mo-Fr 9-19 Uhr',
      'täglich 9-19 Uhr',
      'täglich von 9-19',
      'immer',
      'täglich von 9-19 Uhr extra',
      'feiertags von 9-19 Uhr',
      'täglich von 9:75-19 Uhr',
      'täglich von 25-26 Uhr',
      'täglich von 9-9 Uhr',
    ]) {
      expect(() => parseInnsbruckSchedule(raw), raw).toThrow(InnsbruckParseError)
    }
  })

  it('begrenzt seine Eingabe, wie die anderen Parser', () => {
    expect(() => parseInnsbruckSchedule('täglich von 9-19 Uhr'.padEnd(500, ' '))).toThrow(/Zeichen/)
  })
})

describe('parseInnsbruckTariff', () => {
  // Der Betrag gilt je halbe Stunde. Wer 1,10 als Stundensatz läse, hielte
  // Innsbruck für halb so teuer, wie es ist.
  it('rechnet die erste halbe Stunde auf die Stunde hoch', () => {
    expect(
      parseInnsbruckTariff('EUR 1.10 erste halbe Stunde, danach gleicher Tarif in EUR 0.10 - Schritten')
    ).toEqual({ fee: { kind: 'exact', centsPerHour: 220 } })
  })

  it('liest den Tagesdeckel mit', () => {
    expect(
      parseInnsbruckTariff(
        'EUR 1.10 erste halbe Stunde, danach gleicher Tarif in EUR 0.10 - Schritten, jedoch höchstens EUR 9 pro Kalendertag'
      )
    ).toEqual({ fee: { kind: 'exact', centsPerHour: 220 }, dailyCapCents: 900 })
  })

  // Der Waldparkplatz: 0,50 je halbe Stunde bis zur dritten, dann 1,00 —
  // die einzige Spanne des Feeds.
  it('macht aus dem Tarifsprung ab der vierten Stunde eine Spanne', () => {
    expect(
      parseInnsbruckTariff(
        'EUR 0.50 erste halbe Stunde, danach gleicher Tarif in EUR 0.10 - Schritten, ab 4. Stunde EUR 1 je halbe Stunde in EUR 0.10 - Schritten (auch dann, wenn Parkvorgang über abgabenfreie Zeit hinaus fortgesetzt wird)'
      )
    ).toEqual({
      fee: { kind: 'range', minCentsPerHour: 100, maxCentsPerHour: 200 },
      higherFromHour: 4,
    })
  })

  it('macht aus einem Sprung auf denselben Satz keine Spanne', () => {
    expect(
      parseInnsbruckTariff('EUR 1 erste halbe Stunde, ab 4. Stunde EUR 1 je halbe Stunde in EUR 0.10 - Schritten').fee
    ).toEqual({ kind: 'exact', centsPerHour: 200 })
  })

  // Nicht als 0 Cent: In den kostenfreien Kurzparkzonen gilt die Parkscheibe
  // (§ 1 Kurzparkzonen-Überwachungsverordnung), und wer ohne steht, zahlt.
  it('behandelt kostenfrei als Parkscheibe, nicht als Preis von null', () => {
    expect(parseInnsbruckTariff('kostenfrei')).toEqual({ fee: { kind: 'disc' } })
    expect(parseInnsbruckFee('Kostenfrei')).toEqual({ kind: 'disc' })
  })

  // Der eine Weg, an `CostEstimate.priced` vorbei „0,00 €" auf den Schirm zu
  // bringen — in jedem Gebührenparser dieses Projekts ein Abbruch.
  it('bricht bei einem Betrag von 0 ab', () => {
    expect(() => parseInnsbruckTariff('EUR 0.00 erste halbe Stunde')).toThrow(/0 €/)
    expect(() => parseInnsbruckTariff('EUR 0 erste halbe Stunde')).toThrow(InnsbruckParseError)
    expect(() =>
      parseInnsbruckTariff('EUR 1.10 erste halbe Stunde, jedoch höchstens EUR 0 pro Kalendertag')
    ).toThrow(InnsbruckParseError)
  })

  // Der Feed schreibt Dezimalpunkt. Ein Komma wäre eine neue Schreibweise,
  // und die soll auffallen, statt als „1" durchzugehen.
  it('weist Dezimalkomma und fremde Bausteine ab', () => {
    expect(() => parseInnsbruckTariff('EUR 1,10 erste halbe Stunde')).toThrow(InnsbruckParseError)
    expect(() => parseInnsbruckTariff('1,10 € je Stunde')).toThrow(/erste halbe Stunde/)
    expect(() => parseInnsbruckTariff('EUR 1.10 erste halbe Stunde, danach Parkscheibe')).toThrow(
      /unbekannter Gebührenbaustein/
    )
    expect(() => parseInnsbruckTariff('EUR 1.10 erste Stunde')).toThrow(InnsbruckParseError)
    expect(() => parseInnsbruckTariff('')).toThrow(InnsbruckParseError)
  })

  it('weist einen Tarifsprung ab der ersten Stunde ab', () => {
    expect(() =>
      parseInnsbruckTariff('EUR 1.10 erste halbe Stunde, ab 1. Stunde EUR 2 je halbe Stunde in EUR 0.10 - Schritten')
    ).toThrow(/ergibt keinen Sinn/)
  })
})

describe('parseInnsbruckInfo', () => {
  it('trennt Zeiten und Gebühr am Komma nach Uhr und gibt beide Rohteile zurück', () => {
    const info = parseInnsbruckInfo('täglich von 9-19 Uhr, EUR 1.10 erste halbe Stunde, danach gleicher Tarif in EUR 0.10 - Schritten')
    expect(info.rawHours).toBe('täglich von 9-19 Uhr')
    expect(info.rawFee).toBe('EUR 1.10 erste halbe Stunde, danach gleicher Tarif in EUR 0.10 - Schritten')
    expect(info.windows).toHaveLength(1)
    expect(info.fee).toEqual({ kind: 'exact', centsPerHour: 220 })
  })

  it('weist ein Feld ohne Gebührenteil ab', () => {
    expect(() => parseInnsbruckInfo('täglich von 9-19 Uhr')).toThrow(/kein Komma nach "Uhr"/)
    expect(() => parseInnsbruckInfo('EUR 1.10 erste halbe Stunde')).toThrow(InnsbruckParseError)
    expect(() => parseInnsbruckInfo('')).toThrow(InnsbruckParseError)
  })

  it('liest jeden der sieben INFO-Werte des Abzugs', () => {
    for (const { text } of INFO_VALUES) {
      expect(() => parseInnsbruckInfo(text), text).not.toThrow()
    }
  })

  it('liest jede Zeile des Abzugs, ohne zu werfen', () => {
    for (const row of ROWS) {
      expect(() => parseInnsbruckInfo(row.INFO ?? ''), String(row.FID)).not.toThrow()
    }
  })

  // Die Bezeichnung sagt „(täglich)" oder „(werktags)" — eine zweite Aussage
  // der Quelle über dieselbe Zone. Läuft sie dem Zeitteil zuwider, ist eine
  // von beiden falsch, und das soll hier auffallen und nicht beim Nutzer.
  it('stimmt in jeder Zeile mit der Klammer in BEZEICH überein', () => {
    for (const row of ROWS) {
      const label = row.BEZEICH ?? ''
      const { windows } = parseInnsbruckInfo(row.INFO ?? '')
      const sunday = windows.some((window) => window.weekdays.includes(0))
      if (label.includes('(täglich)')) expect(sunday, label).toBe(true)
      if (label.includes('(werktags)')) expect(sunday, label).toBe(false)
    }
  })

  it('trägt genau eine Saisonregel im Abzug, und zwar in der Zone am Tivoli', () => {
    const seasonal = ROWS.filter((row) => parseInnsbruckInfo(row.INFO ?? '').unmodelledRules.length > 0)
    expect(seasonal.map((row) => row.FID)).toEqual([134])
    expect(seasonal[0]?.BEZEICH).toBe('Parkstraße kostenpflichtig (werktags/täglich)')
  })

  it('kennt im Abzug genau drei Tarife: 2,20 €/h, die Spanne 1,00–2,00 €/h und die Parkscheibe', () => {
    const fees = new Set(ROWS.map((row) => JSON.stringify(parseInnsbruckInfo(row.INFO ?? '').fee)))
    expect([...fees].sort()).toEqual(
      [
        { kind: 'exact', centsPerHour: 220 },
        { kind: 'range', minCentsPerHour: 100, maxCentsPerHour: 200 },
        { kind: 'disc' },
      ]
        .map((fee) => JSON.stringify(fee))
        .sort()
    )
  })
})

describe('parseInnsbruckMaxStay', () => {
  it('liest die Minuten aus der Bezeichnung', () => {
    expect(parseInnsbruckMaxStay('Kurzparkzone 180 min kostenpflichtig')).toBe(180)
    expect(parseInnsbruckMaxStay('Kurzparkzone 90 min kostenpflichtig')).toBe(90)
    expect(parseInnsbruckMaxStay('Kurzparkzone kostenfrei 180 min 1-5 Uhr')).toBe(180)
  })

  // Parkstraßen nennen keine Dauer: Dort darf man stehen, solange man zahlt.
  // Das ist `undefined`, nicht 0 — 0 hiesse „Parken verboten".
  it('liefert für Parkstraßen nichts', () => {
    expect(parseInnsbruckMaxStay('Parkstraße kostenpflichtig (werktags)')).toBeUndefined()
    expect(parseInnsbruckMaxStay('')).toBeUndefined()
    expect(parseInnsbruckMaxStay(null)).toBeUndefined()
    expect(parseInnsbruckMaxStay(undefined)).toBeUndefined()
  })

  it('weist 0 min, mehr als einen Tag und „min" ohne Zahl ab', () => {
    expect(() => parseInnsbruckMaxStay('Kurzparkzone 0 min')).toThrow(/verboten/)
    expect(() => parseInnsbruckMaxStay('Kurzparkzone 1500 min')).toThrow(/keine Kurzparkzone/)
    expect(() => parseInnsbruckMaxStay('Kurzparkzone min')).toThrow(/ohne Zahl/)
  })

  // „min" in „Minuten" oder „Terminal" ist keine Einheit — die hintere
  // Wortgrenze ist dieselbe Lehre wie bei Münchens „Freitag".
  it('liest min nur als eigenes Wort', () => {
    expect(parseInnsbruckMaxStay('Kurzparkzone 180 minuten')).toBeUndefined()
    expect(parseInnsbruckMaxStay('Terminal 3 mind. frei')).toBeUndefined()
  })

  it('liest jede Bezeichnung des Abzugs', () => {
    const values = ROWS.map((row) => parseInnsbruckMaxStay(row.BEZEICH))
    expect(values.filter((v) => v === 180)).toHaveLength(7)
    expect(values.filter((v) => v === 90)).toHaveLength(2)
    expect(values.filter((v) => v === undefined)).toHaveLength(12)
  })
})

describe('innsbruckZoneNote', () => {
  it('nennt Bezeichnung, Deckel und Tarifsprung', () => {
    const tariff = parseInnsbruckTariff(
      'EUR 0.50 erste halbe Stunde, ab 4. Stunde EUR 1 je halbe Stunde in EUR 0.10 - Schritten'
    )
    expect(innsbruckZoneNote({ BEZEICH: 'Parkstraße kostenpflichtig (täglich)' }, tariff)).toBe(
      'Parkstraße kostenpflichtig (täglich) — bis zur 3. Stunde 1,00 €/h, ab der 4. Stunde 2,00 €/h'
    )
    expect(innsbruckZoneNote({ BEZEICH: 'Kurzparkzone 180 min kostenpflichtig' }, { fee: { kind: 'exact', centsPerHour: 220 }, dailyCapCents: 900 })).toBe(
      'Kurzparkzone 180 min kostenpflichtig — höchstens 9,00 € je Kalendertag'
    )
  })

  it('gibt ohne Bezeichnung und ohne Zusätze nichts zurück', () => {
    expect(innsbruckZoneNote({}, { fee: { kind: 'disc' } })).toBeNull()
    expect(innsbruckZoneNote({ BEZEICH: '  ' }, { fee: { kind: 'exact', centsPerHour: 220 } })).toBeNull()
  })
})

describe('eine Innsbrucker Zone im gemeinsamen Tarifmodell', () => {
  function zoneFrom(row: InnsbruckZoneProperties): ParkingZone {
    const info = parseInnsbruckInfo(row.INFO ?? '')
    const maxStay = parseInnsbruckMaxStay(row.BEZEICH)
    return {
      id: String(row.FID ?? '?'),
      name: String(row.FID ?? '?'),
      land: INNSBRUCK.land,
      fee: info.fee,
      windows: info.windows,
      unmodelledRules: info.unmodelledRules,
      ...(maxStay === undefined ? {} : { maxStayMinutes: maxStay }),
    }
  }

  const kurzparkzone180 = zoneFrom({
    FID: 138,
    BEZEICH: 'Kurzparkzone 180 min kostenpflichtig',
    INFO: 'werktags Mo-Fr von 9-19 Uhr, EUR 1.10 erste halbe Stunde, danach gleicher Tarif in EUR 0.10 - Schritten, jedoch höchstens EUR 9 pro Kalendertag',
  })

  // Freitag, 18. September 2026, 12:00 Berliner Zeit (Sommerzeit, UTC+2).
  const fridayNoon = Date.UTC(2026, 8, 18, 10)
  const saturdayNoon = Date.UTC(2026, 8, 19, 10)

  it('kassiert freitags und nicht samstags, wo die Quelle werktags Mo-Fr sagt', () => {
    expect(isChargeable(kurzparkzone180, fridayNoon)).toBe(true)
    expect(isChargeable(kurzparkzone180, saturdayNoon)).toBe(false)
  })

  // Der Grund für den Länderkalender: Der 26. Oktober ist Nationalfeiertag
  // und ein Montag; der 3. Oktober (deutsche Einheit) ist in Innsbruck ein
  // gewöhnlicher Samstag — aber in derselben Zone mit `land: 'BE'` frei.
  it('ist am Nationalfeiertag frei und hält den 3. Oktober nicht für einen Feiertag', () => {
    const nationalfeiertag = Date.UTC(2026, 9, 26, 10) // Montag
    expect(isChargeable(kurzparkzone180, nationalfeiertag)).toBe(false)
    expect(isChargeable({ ...kurzparkzone180, land: 'BE' }, nationalfeiertag)).toBe(true)
    expect(holidaysFor(INNSBRUCK.land, 2026).has('2026-10-03')).toBe(false)
  })

  // Der Landespatron Josef (19. März) ist kein Feiertag nach dem
  // Feiertagsruhegesetz; 2027 fällt er auf einen Freitag, und die Zone
  // kassiert. Karfreitag ebenso (seit 2019 nur „persönlicher Feiertag").
  it('kassiert am Josefitag und am Karfreitag', () => {
    expect(isChargeable(kurzparkzone180, Date.UTC(2027, 2, 19, 10))).toBe(true) // Freitag
    expect(isChargeable(kurzparkzone180, Date.UTC(2027, 2, 26, 10))).toBe(true) // Karfreitag 2027
  })

  it('kassiert in der 90-Minuten-Zone samstags bis 13 Uhr und dann nicht mehr', () => {
    const zone = zoneFrom({
      FID: 143,
      BEZEICH: 'Kurzparkzone 90 min kostenpflichtig',
      INFO: 'werktags Mo-Fr von 9-21 Uhr und Sa von 9-13 Uhr, EUR 1.10 erste halbe Stunde, danach gleicher Tarif in EUR 0.10 - Schritten',
    })
    expect(isChargeable(zone, saturdayNoon)).toBe(true)
    expect(isChargeable(zone, Date.UTC(2026, 8, 19, 12))).toBe(false) // 14:00
    expect(zone.maxStayMinutes).toBe(90)
    expect(chargeableAt(zone, saturdayNoon).changesAt?.toISOString()).toBe('2026-09-19T11:00:00.000Z')
  })

  it('rechnet zwei Stunden in der Kurzparkzone mit 4,40 € in Euro', () => {
    const estimate = estimateCost(kurzparkzone180, fridayNoon, 120)
    expect(estimate.priced).toBe(true)
    expect(estimate.minCents).toBe(440)
    expect(estimate.maxCents).toBe(440)
    expect(estimate.currency).toBe('EUR')
    expect(estimate.exceedsMaxStay).toBe(false)
    expect(estimateCost(kurzparkzone180, fridayNoon, 240).exceedsMaxStay).toBe(true)
  })

  it('nennt für die kostenfreie Nachtzone keinen Preis, aber ein Fenster und eine Dauer', () => {
    const zone = zoneFrom({
      FID: 145,
      BEZEICH: 'Kurzparkzone kostenfrei 180 min 1-5 Uhr',
      INFO: 'täglich von 1-5 Uhr, kostenfrei',
    })
    // 03:00 Berliner Zeit am Sonntag, 20. September 2026.
    const night = Date.UTC(2026, 8, 20, 1)
    expect(isChargeable(zone, night)).toBe(true)
    expect(estimateCost(zone, night, 60).priced).toBe(false)
    expect(zone.maxStayMinutes).toBe(180)
    expect(isChargeable(zone, saturdayNoon)).toBe(false)
  })

  it('kassiert in der Tivoli-Zone auch am Wintersonntag — und sagt die Saisonregel dazu', () => {
    const zone = zoneFrom({
      FID: 134,
      BEZEICH: 'Parkstraße kostenpflichtig (werktags/täglich)',
      INFO: 'täglich (1.5. bis 31.8.) bzw. werktags Mo-Fr (1.9. bis 30.4.) von 9-19 Uhr, EUR 1.10 erste halbe Stunde, danach gleicher Tarif in EUR 0.10 - Schritten, jedoch höchstens EUR 9 pro Kalendertag',
    })
    const wintersonntag = Date.UTC(2027, 0, 17, 11)
    expect(isChargeable(zone, wintersonntag)).toBe(true)
    expect(zone.unmodelledRules).toHaveLength(1)
    // Keine Adventsregel — die Anzeige „unsicher" gehört Berlin.
    expect(chargeableAt(zone, wintersonntag).uncertain).toBe(false)
  })

  it('baut jede Zone des Abzugs, ohne zu werfen', () => {
    for (const row of ROWS) expect(() => zoneFrom(row), String(row.FID)).not.toThrow()
  })
})

describe('Innsbruck als Stadt', () => {
  it('liegt in Österreich, mit Tiroler Landeskürzel', () => {
    expect(INNSBRUCK.land).toBe('AT-T')
    expect(cityCountry(INNSBRUCK)).toBe('AT')
  })

  it('nimmt das Goldene Dachl, Igls und die Hungerburg an', () => {
    expect(cityAt(11.3934, 47.2685)).toBe(INNSBRUCK)
    expect(withinCity(INNSBRUCK, 11.4103, 47.2311)).toBe(true) // Igls
    expect(withinCity(INNSBRUCK, 11.3956, 47.2881)).toBe(true) // Hungerburg
  })

  // Die Box kommt aus der Gemeindegrenze, nicht aus der Parkebene — die 21
  // Zonen reichen nur bis 47,29° Nord, die Stadt bis 47,36°.
  it('weist Hall in Tirol, Salzburg und München ab', () => {
    expect(cityAt(11.5086, 47.2814)).toBeUndefined() // Hall in Tirol
    expect(cityAt(13.0433, 47.8095)).toBeUndefined() // Salzburg
    expect(cityAt(11.5755, 48.1372)?.key).toBe('muenchen')
  })

  it('umschliesst jede Zone des Abzugs', () => {
    const { minLon, minLat, maxLon, maxLat } = INNSBRUCK.reportBounds
    const [lon, lat] = FIXTURE.ersterStuetzpunkt
    expect(lon).toBeGreaterThan(minLon)
    expect(lon).toBeLessThan(maxLon)
    expect(lat).toBeGreaterThan(minLat)
    expect(lat).toBeLessThan(maxLat)
  })

  it('verlangt die Nennung in der vorgeschriebenen Form', () => {
    expect(INNSBRUCK.attribution.source).toBe('Datenquelle: Stadt Innsbruck')
    expect(INNSBRUCK.attribution.attributionRequired).toBe(true)
    expect(INNSBRUCK.attribution.licenceFamily).toBe('cc-by')
    expect(INNSBRUCK.licenceOpen).toBeUndefined()
  })
})
