import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import type { Weekday } from '../src/berlin-time.js'
import {
  FrankfurtParseError,
  frankfurtMaxStayCode,
  frankfurtZoneLabel,
  frankfurtZoneNote,
  mergeFrankfurtFees,
  mergeFrankfurtWindows,
  parseFrankfurtFee,
  parseFrankfurtMaxStay,
  parseFrankfurtSchedule,
  stripHtml,
  type FrankfurtAutomatProperties,
  type FrankfurtZoneProperties,
} from '../src/frankfurt.js'
import { isChargeable, type ParkingZone } from '../src/tariff.js'

/**
 * Die echten Zeilen des Dienstes, abgerufen am 7. September 2026.
 *
 * Wie bei Berlin und Hamburg: Fixtures sind der Feed, nicht ausgedachte
 * Beispiele. Ein Test, der eine Schreibweise prüft, die es nicht gibt, prüft
 * nichts — und übersieht dafür die eine, die es gibt.
 */
const read = <T>(name: string): T =>
  JSON.parse(readFileSync(fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url)), 'utf8')) as T

const AUTOMATS = read<FrankfurtAutomatProperties[]>('ffm-parkscheinautomaten-2026-09-07.json')
const ZONES = read<FrankfurtZoneProperties[]>('ffm-bewohnerparken-2026-09-07.json')

const MO_FR: readonly Weekday[] = [1, 2, 3, 4, 5]
const MO_SA: readonly Weekday[] = [1, 2, 3, 4, 5, 6]
const ALL: readonly Weekday[] = [0, 1, 2, 3, 4, 5, 6]
const SA: readonly Weekday[] = [6]

/**
 * Alle 30 Schreibweisen von `gebuehrenzeit`, einzeln als Erwartung.
 *
 * Nicht „geht durch, ohne zu werfen": Ein Parser, der `Mo-Fr 8-18 Sa 8-14`
 * klaglos als *ein* Fenster von 8 bis 18 an fünf Tagen liest, wirft auch
 * nicht — er verschweigt nur den Samstag, und wer samstags um 9 dort steht,
 * bekommt ein Knöllchen und eine App, die „keine Gebühr" sagt. Deshalb steht
 * hier jede Schreibweise mit dem Ergebnis, das sie haben muss, und die Zahl,
 * wie oft der Feed sie führt.
 */
const SCHEDULES: readonly {
  raw: string
  count: number
  windows: { weekdays: readonly Weekday[]; from: number; to: number }[]
}[] = [
  { raw: 'Mo-Fr 7-19', count: 351, windows: [{ weekdays: MO_FR, from: 420, to: 1140 }] },
  { raw: 'Mo-Fr 7-22', count: 206, windows: [{ weekdays: MO_FR, from: 420, to: 1320 }] },
  { raw: 'Mo-Sa 9-20', count: 105, windows: [{ weekdays: MO_SA, from: 540, to: 1200 }] },
  { raw: 'Mo-Fr 9-17', count: 57, windows: [{ weekdays: MO_FR, from: 540, to: 1020 }] },
  {
    raw: 'Mo-Fr 8-18 Sa 8-14',
    count: 52,
    windows: [
      { weekdays: MO_FR, from: 480, to: 1080 },
      { weekdays: SA, from: 480, to: 840 },
    ],
  },
  { raw: 'Mo-Fr 8-17', count: 48, windows: [{ weekdays: MO_FR, from: 480, to: 1020 }] },
  { raw: 'Mo-Fr 8-18', count: 29, windows: [{ weekdays: MO_FR, from: 480, to: 1080 }] },
  {
    raw: 'Mo-Fr 9-17 Sa 8-14',
    count: 12,
    windows: [
      { weekdays: MO_FR, from: 540, to: 1020 },
      { weekdays: SA, from: 480, to: 840 },
    ],
  },
  { raw: 'Tgl. 9-18', count: 8, windows: [{ weekdays: ALL, from: 540, to: 1080 }] },
  { raw: 'Mo-Sa 9-17', count: 6, windows: [{ weekdays: MO_SA, from: 540, to: 1020 }] },
  { raw: 'Mo-So 0-24', count: 6, windows: [{ weekdays: ALL, from: 0, to: 1440 }] },
  { raw: 'Tgl. 7-21', count: 6, windows: [{ weekdays: ALL, from: 420, to: 1260 }] },
  { raw: 'Mo-Sa 9-16', count: 5, windows: [{ weekdays: MO_SA, from: 540, to: 960 }] },
  { raw: 'Mo-Fr 9-22', count: 4, windows: [{ weekdays: MO_FR, from: 540, to: 1320 }] },
  { raw: 'Mo-Sa 8-16', count: 3, windows: [{ weekdays: MO_SA, from: 480, to: 960 }] },
  { raw: 'Mo-Sa 8-20', count: 3, windows: [{ weekdays: MO_SA, from: 480, to: 1200 }] },
  { raw: 'Mo-Fr 8-16', count: 2, windows: [{ weekdays: MO_FR, from: 480, to: 960 }] },
  { raw: 'Mo-Fr 8-20', count: 2, windows: [{ weekdays: MO_FR, from: 480, to: 1200 }] },
  {
    raw: 'Mo-Fr 9-17 Sa 9-14',
    count: 2,
    windows: [
      { weekdays: MO_FR, from: 540, to: 1020 },
      { weekdays: SA, from: 540, to: 840 },
    ],
  },
  { raw: 'Mo-Sa 10-20', count: 2, windows: [{ weekdays: MO_SA, from: 600, to: 1200 }] },
  { raw: 'Tgl. 8-18', count: 2, windows: [{ weekdays: ALL, from: 480, to: 1080 }] },
  { raw: 'Tgl. 8-20', count: 2, windows: [{ weekdays: ALL, from: 480, to: 1200 }] },
  {
    raw: 'Mo-Fr 8-18 Sa 8-13',
    count: 1,
    windows: [
      { weekdays: MO_FR, from: 480, to: 1080 },
      { weekdays: SA, from: 480, to: 780 },
    ],
  },
  {
    raw: 'Mo-Fr 9-17 Sa 8-17',
    count: 1,
    windows: [
      { weekdays: MO_FR, from: 540, to: 1020 },
      { weekdays: SA, from: 480, to: 1020 },
    ],
  },
  // Die einzige Zeile mit Komma statt Leerzeichen. Sie ist der Grund, warum
  // der Parser an beidem trennt.
  {
    raw: 'Mo-Fr 9-17, Sa 9-14',
    count: 1,
    windows: [
      { weekdays: MO_FR, from: 540, to: 1020 },
      { weekdays: SA, from: 540, to: 840 },
    ],
  },
  { raw: 'Mo-Fr 9-18', count: 1, windows: [{ weekdays: MO_FR, from: 540, to: 1080 }] },
  { raw: 'Mo-Sa 0-24', count: 1, windows: [{ weekdays: MO_SA, from: 0, to: 1440 }] },
  { raw: 'Mo-Sa 7-20', count: 1, windows: [{ weekdays: MO_SA, from: 420, to: 1200 }] },
  { raw: 'Mo-Sa 8-18', count: 1, windows: [{ weekdays: MO_SA, from: 480, to: 1080 }] },
  { raw: 'Tgl. 9-20', count: 1, windows: [{ weekdays: ALL, from: 540, to: 1200 }] },
]

describe('parseFrankfurtSchedule', () => {
  it.each(SCHEDULES)('reads $raw', ({ raw, windows }) => {
    expect(parseFrankfurtSchedule(raw)).toEqual(
      windows.map((window) => ({
        weekdays: window.weekdays,
        fromMinute: window.from,
        toMinute: window.to,
      }))
    )
  })

  // Der Gegentest zur Tabelle: Sie muss den Feed vollständig abdecken, sonst
  // prüft sie nur, was jemand zufällig abgeschrieben hat.
  it('deckt jede Schreibweise des Feeds ab, mit den richtigen Zahlen', () => {
    const counts = new Map<string, number>()
    for (const row of AUTOMATS) {
      const raw = row.gebuehrenzeit ?? ''
      counts.set(raw, (counts.get(raw) ?? 0) + 1)
    }
    expect(counts.size).toBe(30)
    expect([...counts.values()].reduce((sum, n) => sum + n, 0)).toBe(921)
    for (const entry of SCHEDULES) {
      expect(counts.get(entry.raw), entry.raw).toBe(entry.count)
    }
    expect(new Set(SCHEDULES.map((entry) => entry.raw)).size).toBe(counts.size)
  })

  it('bildet die Endstunde 24 auf Minute 1440 ab, nicht auf 0', () => {
    // `Mo-So 0-24` steht sechsmal im Feed. Auf 0 abgebildet hiesse das "nie".
    expect(parseFrankfurtSchedule('Mo-So 0-24')[0]?.toMinute).toBe(1440)
  })

  it('gibt Mo-So und Tgl. dieselben sieben Tage', () => {
    expect(parseFrankfurtSchedule('Mo-So 9-18')).toEqual(parseFrankfurtSchedule('Tgl. 9-18'))
  })

  it('liest einen einzelnen Wochentag', () => {
    expect(parseFrankfurtSchedule('Sa 9-14')).toEqual([
      { weekdays: [6], fromMinute: 540, toMinute: 840 },
    ])
    expect(parseFrankfurtSchedule('So 9-14')[0]?.weekdays).toEqual([0])
  })

  // Kommt im Feed nicht vor. Eine leere Wochentagsliste wäre aber "nie
  // gebuehrenpflichtig" — die teuerste stille Antwort dieses Parsers.
  it('schlägt eine Tagesspanne um, die über den Sonntag läuft', () => {
    expect(parseFrankfurtSchedule('Sa-Mo 9-14')[0]?.weekdays).toEqual([0, 1, 6])
  })

  it('weist alles ab, was es nicht kennt, statt zu raten', () => {
    for (const raw of [
      '',
      '   ',
      'Mo-Fr',
      '7-19',
      'Mo-Fr 7-19 Uhr',
      'werktags 9-20',
      'Xy-Fr 7-19',
      'Mo-Xy 7-19',
      'Mo-Fr 9:30-17',
      'Mo-Fr 25-26',
    ]) {
      expect(() => parseFrankfurtSchedule(raw), raw).toThrow(FrankfurtParseError)
    }
  })

  // Über Mitternacht kommt im Feed nicht vor. Zu raten, wie es gemeint ist,
  // wäre schlimmer als anzuhalten: Ein Fenster mit from > to heisst in
  // `windowCovers` schlicht "nie".
  it('weist eine Spanne ab, die nicht nach ihrem Anfang endet', () => {
    expect(() => parseFrankfurtSchedule('Mo-Fr 22-2')).toThrow(/endet nicht/)
    expect(() => parseFrankfurtSchedule('Mo-Fr 9-9')).toThrow(/endet nicht/)
  })

  it('begrenzt seine Eingabe, wie die Berliner und Hamburger Parser', () => {
    expect(() => parseFrankfurtSchedule('Mo-Fr 7-19'.padEnd(500, ' '))).toThrow(/Zeichen/)
  })
})

describe('parseFrankfurtFee', () => {
  it('liest die zwei Tarife, die der Feed benutzt', () => {
    expect(parseFrankfurtFee('2 €/h')).toEqual({ kind: 'exact', centsPerHour: 200 })
    expect(parseFrankfurtFee('4 €/h')).toEqual({ kind: 'exact', centsPerHour: 400 })
  })

  it('nimmt dieselbe Schreibweise mit Cent an, damit eine Tarifänderung den Bau nicht anhält', () => {
    expect(parseFrankfurtFee('2,50 €/h')).toEqual({ kind: 'exact', centsPerHour: 250 })
  })

  // Kein Betrag ist NICHT null Euro. Genau ein Automat lässt das Feld leer.
  it('behandelt leeres Feld, Strich und null als „nicht genannt"', () => {
    for (const raw of ['', '   ', '-', null, undefined]) {
      expect(parseFrankfurtFee(raw)).toEqual({ kind: 'unknown' })
    }
  })

  it('weist die Berliner und Hamburger Schreibweisen ab, die dasselbe bedeuten und anders gelesen werden', () => {
    expect(() => parseFrankfurtFee('2,00 Euro')).toThrow(FrankfurtParseError)
    expect(() => parseFrankfurtFee('3,50 € je Stunde')).toThrow(FrankfurtParseError)
    expect(() => parseFrankfurtFee('2 €')).toThrow(FrankfurtParseError)
  })

  it('begrenzt seine Eingabe', () => {
    expect(() => parseFrankfurtFee('2 €/h'.padEnd(500, '0'))).toThrow(/Zeichen/)
  })

  it('parses every value the feed actually carries', () => {
    const values = new Set(AUTOMATS.map((row) => row.gebuehrenzone))
    expect(values.size).toBe(3) // 2 €/h, 4 €/h, null
    for (const value of values) {
      expect(() => parseFrankfurtFee(value), String(value)).not.toThrow()
    }
  })

  it('nagelt die zwei geltenden Tarife fest, damit eine Gebührenänderung den Bau anhält', () => {
    const rates = new Set(
      AUTOMATS.map((row) => parseFrankfurtFee(row.gebuehrenzone))
        .filter((fee) => fee.kind === 'exact')
        .map((fee) => (fee as { centsPerHour: number }).centsPerHour)
    )
    expect([...rates].sort((a, b) => a - b)).toEqual([200, 400])
  })
})

describe('parseFrankfurtMaxStay', () => {
  it('liest Stunden als Minuten', () => {
    expect(parseFrankfurtMaxStay('1 h')).toBe(60)
    expect(parseFrankfurtMaxStay('5 h')).toBe(300)
  })

  // 579 der 921 Automaten tragen den Strich. Als 0 gelesen hiesse das
  // "Hoechstparkdauer null Minuten", also Parken verboten.
  it('behandelt einen Strich als „keine Grenze", nicht als null Minuten', () => {
    expect(parseFrankfurtMaxStay('-')).toBeUndefined()
    expect(parseFrankfurtMaxStay('')).toBeUndefined()
    expect(parseFrankfurtMaxStay(null)).toBeUndefined()
    expect(parseFrankfurtMaxStay(undefined)).toBeUndefined()
  })

  it('weist alles ab, was keine Stundenzahl ist', () => {
    for (const raw of ['60', '1h30', '1 Std.', '90 min', 'eine Stunde', '0 h']) {
      expect(() => parseFrankfurtMaxStay(raw), raw).toThrow(FrankfurtParseError)
    }
  })

  it('begrenzt seine Eingabe', () => {
    expect(() => parseFrankfurtMaxStay('1 h'.padEnd(500, ' '))).toThrow(/Zeichen/)
  })

  it('parses every value the feed actually carries', () => {
    const values = new Set(AUTOMATS.map((row) => row.maximal_parkdauer))
    expect(values).toEqual(new Set(['-', '1 h', '2 h', '3 h', '4 h', '5 h']))
    for (const value of values) {
      expect(() => parseFrankfurtMaxStay(value), String(value)).not.toThrow()
    }
  })
})

describe('frankfurtMaxStayCode', () => {
  it('schreibt den Code, den die Beschriftung im Web versteht', () => {
    expect(frankfurtMaxStayCode(60)).toBe('1h')
    expect(frankfurtMaxStayCode(300)).toBe('5h')
    expect(frankfurtMaxStayCode(30)).toBe('30min')
  })
})

describe('mergeFrankfurtFees', () => {
  it('zieht einen einzelnen Tarif auf genau zusammen', () => {
    expect(mergeFrankfurtFees([{ kind: 'exact', centsPerHour: 200 }, { kind: 'exact', centsPerHour: 200 }])).toEqual({
      kind: 'exact',
      centsPerHour: 200,
    })
  })

  // Bereiche 15 und 18 tragen beide Sätze. Auf einen zu reduzieren
  // verschätzte jemanden dort um 100 %.
  it('behält zwei Tarife als Spanne, wie Berlins Zonen 41-43', () => {
    expect(
      mergeFrankfurtFees([
        { kind: 'exact', centsPerHour: 200 },
        { kind: 'exact', centsPerHour: 400 },
      ])
    ).toEqual({ kind: 'range', minCentsPerHour: 200, maxCentsPerHour: 400 })
  })

  it('flacht eine Spanne ab, die schon eine ist', () => {
    expect(
      mergeFrankfurtFees([{ kind: 'range', minCentsPerHour: 200, maxCentsPerHour: 400 }])
    ).toEqual({ kind: 'range', minCentsPerHour: 200, maxCentsPerHour: 400 })
  })

  // "Die Quelle sagt hier nichts" darf die Spanne nicht nach unten ziehen —
  // sonst stünde bei einem Bereich mit einem stummen Automaten "0,00-4,00 €".
  it('übergeht Automaten, die gar keinen Tarif nennen', () => {
    expect(mergeFrankfurtFees([{ kind: 'unknown' }, { kind: 'exact', centsPerHour: 400 }])).toEqual({
      kind: 'exact',
      centsPerHour: 400,
    })
    expect(mergeFrankfurtFees([{ kind: 'disc' }, { kind: 'unknown' }])).toEqual({ kind: 'unknown' })
  })

  it('sagt unbekannt für ein leeres Gebiet, nicht null', () => {
    expect(mergeFrankfurtFees([])).toEqual({ kind: 'unknown' })
  })
})

describe('mergeFrankfurtWindows', () => {
  it('wirft Doppelte weg, damit von 92 gleichen Automaten ein Fenster bleibt', () => {
    const windows = parseFrankfurtSchedule('Mo-Fr 7-19')
    expect(mergeFrankfurtWindows([...windows, ...windows, ...windows])).toHaveLength(1)
  })

  it('behält wirklich verschiedene Fenster nebeneinander', () => {
    const merged = mergeFrankfurtWindows([
      ...parseFrankfurtSchedule('Mo-Fr 7-19'),
      ...parseFrankfurtSchedule('Mo-Fr 7-22'),
    ])
    expect(merged).toHaveLength(2)
  })

  // Verschmelzen wäre falsch: Wer 7-19 zu 7-22 zieht, dichtet dem halben
  // Bereich drei Stunden Gebuehrenpflicht an.
  it('weitet ein Fenster nicht in ein anderes hinein', () => {
    const merged = mergeFrankfurtWindows([
      ...parseFrankfurtSchedule('Mo-Fr 7-19'),
      ...parseFrankfurtSchedule('Mo-Fr 7-22'),
    ])
    expect(merged.map((window) => window.toMinute).sort((a, b) => a - b)).toEqual([1140, 1320])
  })

  it('gibt eine leere Liste unverändert zurück', () => {
    expect(mergeFrankfurtWindows([])).toEqual([])
  })
})

describe('stripHtml', () => {
  // `vti_url` trägt in allen 42 Bereichen Markup in einem Datenfeld. Das ist
  // die Form fremder Eingabe, die am ehesten irgendwo als Markup landet.
  it('macht aus dem Anker des Feeds seinen Text', () => {
    expect(
      stripHtml('<a href="/wir-fuer-sie/bewohnerparken/regelungsbereich-0" target="_blank" class="regelbereiche">weitere Informationen</a>')
    ).toBe('weitere Informationen')
  })

  it('lässt nichts Ausführbares zurück', () => {
    expect(stripHtml('<script>alert(1)</script>Text')).toBe('alert(1) Text')
    expect(stripHtml('<img src=x onerror=alert(1)>')).toBe('')
    expect(stripHtml('a<b>c</b>d')).toBe('a c d')
  })

  it('löst die Entitäten auf, die der Feed tragen könnte', () => {
    expect(stripHtml('Stra&amp;szlig; &lt;x&gt; &quot;y&quot; &#39;z&#39;')).toBe(
      'Stra&szlig; <x> "y" \'z\''
    )
    expect(stripHtml('a&nbsp;b')).toBe('a b')
  })

  it('behandelt null, undefined und einen übergroßen Wert als nichts', () => {
    expect(stripHtml(null)).toBe('')
    expect(stripHtml(undefined)).toBe('')
    expect(stripHtml('<b>x</b>'.padEnd(5000, 'y'))).toBe('')
  })
})

// Gefundener Fehler, deshalb ein Test: Das Feld trägt eine **Zahl**, nicht
// eine Zeichenkette. Das Interface behauptete zuerst das Gegenteil, und
// TypeScript prüft eine JSON-Datei nicht -- der Datenbau brach mit
// `claimed.trim is not a function` ab. Wäre stattdessen nur verglichen
// worden, hätte der Vergleich stillschweigend nie gepasst, und alle 921
// Automaten wären "ohne Bereich" gewesen.
describe('bewohnerparkzone im Feed', () => {
  it('ist eine Zahl, nie eine Zeichenkette', () => {
    for (const row of AUTOMATS) {
      const zone = row.bewohnerparkzone
      if (zone === null || zone === undefined) continue
      expect(typeof zone, JSON.stringify(row)).toBe('number')
    }
  })

  it('zeigt auf Nummern, die die Gebietsebene wirklich hat', () => {
    const known = new Set(ZONES.map(frankfurtZoneLabel))
    const claimed = new Set(
      AUTOMATS.map((row) => row.bewohnerparkzone).filter((zone): zone is number => zone !== null && zone !== undefined)
    )
    expect(claimed.size).toBe(21)
    for (const zone of claimed) expect(known.has(String(zone)), String(zone)).toBe(true)
  })

  it('fehlt bei 418 der 921 Automaten', () => {
    const without = AUTOMATS.filter(
      (row) => row.bewohnerparkzone === null || row.bewohnerparkzone === undefined
    )
    expect(without).toHaveLength(418)
  })
})

describe('frankfurtZoneLabel', () => {
  it('nimmt die Nummer, die einzige Identität, die der Feed hergibt', () => {
    expect(frankfurtZoneLabel({ nummer: 0 })).toBe('0')
    expect(frankfurtZoneLabel({ nummer: 41 })).toBe('41')
  })

  it('erfindet keine, wenn die Nummer fehlt', () => {
    expect(frankfurtZoneLabel({})).toBe('?')
    expect(frankfurtZoneLabel({ nummer: null })).toBe('?')
  })

  it('beschriftet alle 42 Gebiete des Feeds unterscheidbar', () => {
    const labels = ZONES.map(frankfurtZoneLabel)
    expect(labels).toHaveLength(42)
    expect(new Set(labels).size).toBe(42)
    expect(labels).not.toContain('?')
  })
})

describe('frankfurtZoneNote', () => {
  // Alle 42 Bereiche tragen dieselbe Linkbeschriftung und sonst nichts. Sie
  // als "Hinweis" auszuliefern hiesse, dem Leser Boilerplate als Auskunft zu
  // verkaufen.
  it('sagt nichts, wo der Feed nichts sagt', () => {
    for (const row of ZONES) expect(frankfurtZoneNote(row), frankfurtZoneLabel(row)).toBeNull()
  })

  it('reicht Namen oder Beschreibung durch, sobald die Stadt eine einträgt', () => {
    expect(frankfurtZoneNote({ nummer: 3, name: 'Nordend-West' })).toBe('Nordend-West')
    expect(frankfurtZoneNote({ nummer: 3, name: 'A', description: 'B' })).toBe('A — B')
  })

  it('entfernt Auszeichnung aus allem, was es durchreicht', () => {
    expect(frankfurtZoneNote({ description: '<b>Bockenheim</b>' })).toBe('Bockenheim')
  })

  it('behält einen Verweistext, der keine Floskel ist', () => {
    expect(frankfurtZoneNote({ vti_url: '<a href="/x">Bewohnerparken Nordend</a>' })).toBe(
      'Bewohnerparken Nordend'
    )
  })
})

describe('ein Frankfurter Gebiet im gemeinsamen Tarifmodell', () => {
  function zoneFrom(rows: FrankfurtAutomatProperties[]): ParkingZone {
    return {
      id: '19',
      name: '19',
      land: 'HE',
      fee: mergeFrankfurtFees(rows.map((row) => parseFrankfurtFee(row.gebuehrenzone))),
      windows: mergeFrankfurtWindows(
        rows.flatMap((row) => parseFrankfurtSchedule(row.gebuehrenzeit ?? ''))
      ),
    }
  }

  const machine: FrankfurtAutomatProperties = {
    gebuehrenzeit: 'Mo-Fr 8-18 Sa 8-14',
    gebuehrenzone: '2 €/h',
    maximal_parkdauer: '-',
  }

  // Samstag, 5. September 2026, 12:00 Berliner Zeit (Sommerzeit, UTC+2).
  const saturdayNoon = Date.UTC(2026, 8, 5, 10)
  const sundayNoon = Date.UTC(2026, 8, 6, 10)

  it('kassiert an dem Samstag, den die zweite Klausel nennt', () => {
    expect(isChargeable(zoneFrom([machine]), saturdayNoon)).toBe(true)
  })

  // Der Fehler, den die zweite Klausel verhindert: Wer nur `Mo-Fr 8-18` liest,
  // sagt samstags um 12 "keine Gebuehr" — und das kostet ein Knoellchen.
  it('würde ohne die zweite Klausel an diesem Samstag frei sagen', () => {
    const truncated = zoneFrom([{ ...machine, gebuehrenzeit: 'Mo-Fr 8-18' }])
    expect(isChargeable(truncated, saturdayNoon)).toBe(false)
  })

  it('ist sonntags frei, wo keine Klausel ihn nennt', () => {
    expect(isChargeable(zoneFrom([machine]), sundayNoon)).toBe(false)
  })

  // Fronleichnam ist in Hessen gesetzlicher Feiertag, in Berlin und Hamburg
  // nicht. Genau dafür hängt der Kalender am Bundesland.
  it('ist an Fronleichnam frei, an dem Berlin und Hamburg kassieren', () => {
    // Donnerstag, 4. Juni 2026, 12:00 Berliner Zeit.
    const fronleichnam = Date.UTC(2026, 5, 4, 10)
    const he = zoneFrom([machine])
    expect(isChargeable(he, fronleichnam)).toBe(false)
    expect(isChargeable({ ...he, land: 'BE' }, fronleichnam)).toBe(true)
    expect(isChargeable({ ...he, land: 'HH' }, fronleichnam)).toBe(true)
  })

  it('nimmt die Spanne, wo zwei Automaten eines Gebiets beim Tarif uneins sind', () => {
    const zone = zoneFrom([machine, { ...machine, gebuehrenzone: '4 €/h' }])
    expect(zone.fee).toEqual({ kind: 'range', minCentsPerHour: 200, maxCentsPerHour: 400 })
  })

  it('baut jeden Automaten des Feeds, ohne zu werfen', () => {
    for (const row of AUTOMATS) {
      expect(() => zoneFrom([row]), row.strassenname ?? '?').not.toThrow()
    }
  })
})

describe('parseFrankfurtFee an der Null', () => {
  /**
   * Ein Nullbetrag ist kein Tarif — dieselbe Begründung wie in Berlin und
   * Hamburg. Hier wiegt sie sogar schwerer: `mergeFrankfurtFees` bildet die
   * Spanne eines Bereichs aus allen seinen Automaten, und ein einziger
   * Automat mit `0 €/h` zöge sie auf „0,00-4,00 €" herunter. Genau das
   * verhindert der Test „ignores machines that state no rate at all" für den
   * stummen Automaten; über die Null wäre er zu umgehen gewesen.
   */
  it('weist 0 €/h ab, statt einen Preis von null zu melden', () => {
    expect(() => parseFrankfurtFee('0 €/h')).toThrow(FrankfurtParseError)
    expect(() => parseFrankfurtFee('0,00 €/h')).toThrow(/kein Tarif/)
  })

  it('lässt den stummen Automaten weiter „unbekannt" sein', () => {
    expect(parseFrankfurtFee('')).toEqual({ kind: 'unknown' })
    expect(parseFrankfurtFee('-')).toEqual({ kind: 'unknown' })
    expect(parseFrankfurtFee(null)).toEqual({ kind: 'unknown' })
  })
})

describe('parseFrankfurtSchedule an der Tagesgrenze', () => {
  it('weist eine Stunde jenseits des Tages ab und nimmt 24 als Mitternacht', () => {
    expect(() => parseFrankfurtSchedule('Mo-Fr 9-25')).toThrow(FrankfurtParseError)
    expect(parseFrankfurtSchedule('Mo-Fr 9-24')[0]?.toMinute).toBe(24 * 60)
  })

  it('begrenzt seine Eingabe genau bei der Grenze, nicht irgendwo darüber', () => {
    const gerade = 'Mo-Fr 9-20'.padEnd(120, ' ')
    expect(parseFrankfurtSchedule(gerade)).toHaveLength(1)
    expect(() => parseFrankfurtSchedule(`${gerade} `)).toThrow(/Zeichen/)
  })
})
