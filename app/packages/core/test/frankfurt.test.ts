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
  it('covers every spelling the feed carries, with the right counts', () => {
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

  it('maps an end hour of 24 to minute 1440, not to 0', () => {
    // `Mo-So 0-24` steht sechsmal im Feed. Auf 0 abgebildet hiesse das "nie".
    expect(parseFrankfurtSchedule('Mo-So 0-24')[0]?.toMinute).toBe(1440)
  })

  it('gives Mo-So and Tgl. the same seven days', () => {
    expect(parseFrankfurtSchedule('Mo-So 9-18')).toEqual(parseFrankfurtSchedule('Tgl. 9-18'))
  })

  it('reads a single weekday', () => {
    expect(parseFrankfurtSchedule('Sa 9-14')).toEqual([
      { weekdays: [6], fromMinute: 540, toMinute: 840 },
    ])
    expect(parseFrankfurtSchedule('So 9-14')[0]?.weekdays).toEqual([0])
  })

  // Kommt im Feed nicht vor. Eine leere Wochentagsliste waere aber "nie
  // gebuehrenpflichtig" — die teuerste stille Antwort dieses Parsers.
  it('wraps a day range that runs across Sunday', () => {
    expect(parseFrankfurtSchedule('Sa-Mo 9-14')[0]?.weekdays).toEqual([0, 1, 6])
  })

  it('rejects anything it does not recognise instead of guessing', () => {
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

  // Ueber Mitternacht kommt im Feed nicht vor. Zu raten, wie es gemeint ist,
  // waere schlimmer als anzuhalten: Ein Fenster mit from > to heisst in
  // `windowCovers` schlicht "nie".
  it('refuses a span that does not end after it starts', () => {
    expect(() => parseFrankfurtSchedule('Mo-Fr 22-2')).toThrow(/endet nicht/)
    expect(() => parseFrankfurtSchedule('Mo-Fr 9-9')).toThrow(/endet nicht/)
  })

  it('bounds its input, like the Berlin and Hamburg parsers', () => {
    expect(() => parseFrankfurtSchedule('Mo-Fr 7-19'.padEnd(500, ' '))).toThrow(/Zeichen/)
  })
})

describe('parseFrankfurtFee', () => {
  it('reads the two rates the feed uses', () => {
    expect(parseFrankfurtFee('2 €/h')).toEqual({ kind: 'exact', centsPerHour: 200 })
    expect(parseFrankfurtFee('4 €/h')).toEqual({ kind: 'exact', centsPerHour: 400 })
  })

  it('accepts the same notation with cents, so a rate change does not stop the build', () => {
    expect(parseFrankfurtFee('2,50 €/h')).toEqual({ kind: 'exact', centsPerHour: 250 })
  })

  // Kein Betrag ist NICHT null Euro. Genau ein Automat laesst das Feld leer.
  it('treats an empty field, a dash and null as "not stated"', () => {
    for (const raw of ['', '   ', '-', null, undefined]) {
      expect(parseFrankfurtFee(raw)).toEqual({ kind: 'unknown' })
    }
  })

  it('refuses the Berlin and Hamburg spellings, which mean the same and parse differently', () => {
    expect(() => parseFrankfurtFee('2,00 Euro')).toThrow(FrankfurtParseError)
    expect(() => parseFrankfurtFee('3,50 € je Stunde')).toThrow(FrankfurtParseError)
    expect(() => parseFrankfurtFee('2 €')).toThrow(FrankfurtParseError)
  })

  it('bounds its input', () => {
    expect(() => parseFrankfurtFee('2 €/h'.padEnd(500, '0'))).toThrow(/Zeichen/)
  })

  it('parses every value the feed actually carries', () => {
    const values = new Set(AUTOMATS.map((row) => row.gebuehrenzone))
    expect(values.size).toBe(3) // 2 €/h, 4 €/h, null
    for (const value of values) {
      expect(() => parseFrankfurtFee(value), String(value)).not.toThrow()
    }
  })

  it('pins the two rates in force, so a fee change fails the build', () => {
    const rates = new Set(
      AUTOMATS.map((row) => parseFrankfurtFee(row.gebuehrenzone))
        .filter((fee) => fee.kind === 'exact')
        .map((fee) => (fee as { centsPerHour: number }).centsPerHour)
    )
    expect([...rates].sort((a, b) => a - b)).toEqual([200, 400])
  })
})

describe('parseFrankfurtMaxStay', () => {
  it('reads hours as minutes', () => {
    expect(parseFrankfurtMaxStay('1 h')).toBe(60)
    expect(parseFrankfurtMaxStay('5 h')).toBe(300)
  })

  // 579 der 921 Automaten tragen den Strich. Als 0 gelesen hiesse das
  // "Hoechstparkdauer null Minuten", also Parken verboten.
  it('treats a dash as "no limit", not as zero minutes', () => {
    expect(parseFrankfurtMaxStay('-')).toBeUndefined()
    expect(parseFrankfurtMaxStay('')).toBeUndefined()
    expect(parseFrankfurtMaxStay(null)).toBeUndefined()
    expect(parseFrankfurtMaxStay(undefined)).toBeUndefined()
  })

  it('refuses anything that is not an hour count', () => {
    for (const raw of ['60', '1h30', '1 Std.', '90 min', 'eine Stunde', '0 h']) {
      expect(() => parseFrankfurtMaxStay(raw), raw).toThrow(FrankfurtParseError)
    }
  })

  it('bounds its input', () => {
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
  it('writes the code the web label understands', () => {
    expect(frankfurtMaxStayCode(60)).toBe('1h')
    expect(frankfurtMaxStayCode(300)).toBe('5h')
    expect(frankfurtMaxStayCode(30)).toBe('30min')
  })
})

describe('mergeFrankfurtFees', () => {
  it('collapses one rate to exact', () => {
    expect(mergeFrankfurtFees([{ kind: 'exact', centsPerHour: 200 }, { kind: 'exact', centsPerHour: 200 }])).toEqual({
      kind: 'exact',
      centsPerHour: 200,
    })
  })

  // Bereiche 15 und 18 tragen beide Saetze. Auf einen zu reduzieren
  // verschaetzte jemanden dort um 100 %.
  it('keeps two rates as a range, like Berlins zones 41-43', () => {
    expect(
      mergeFrankfurtFees([
        { kind: 'exact', centsPerHour: 200 },
        { kind: 'exact', centsPerHour: 400 },
      ])
    ).toEqual({ kind: 'range', minCentsPerHour: 200, maxCentsPerHour: 400 })
  })

  it('flattens a range that is already one', () => {
    expect(
      mergeFrankfurtFees([{ kind: 'range', minCentsPerHour: 200, maxCentsPerHour: 400 }])
    ).toEqual({ kind: 'range', minCentsPerHour: 200, maxCentsPerHour: 400 })
  })

  // "Die Quelle sagt hier nichts" darf die Spanne nicht nach unten ziehen —
  // sonst stuende bei einem Bereich mit einem stummen Automaten "0,00-4,00 €".
  it('ignores machines that state no rate at all', () => {
    expect(mergeFrankfurtFees([{ kind: 'unknown' }, { kind: 'exact', centsPerHour: 400 }])).toEqual({
      kind: 'exact',
      centsPerHour: 400,
    })
    expect(mergeFrankfurtFees([{ kind: 'disc' }, { kind: 'unknown' }])).toEqual({ kind: 'unknown' })
  })

  it('says unknown for an empty area rather than zero', () => {
    expect(mergeFrankfurtFees([])).toEqual({ kind: 'unknown' })
  })
})

describe('mergeFrankfurtWindows', () => {
  it('drops duplicates so 92 identical machines leave one window', () => {
    const windows = parseFrankfurtSchedule('Mo-Fr 7-19')
    expect(mergeFrankfurtWindows([...windows, ...windows, ...windows])).toHaveLength(1)
  })

  it('keeps genuinely different windows side by side', () => {
    const merged = mergeFrankfurtWindows([
      ...parseFrankfurtSchedule('Mo-Fr 7-19'),
      ...parseFrankfurtSchedule('Mo-Fr 7-22'),
    ])
    expect(merged).toHaveLength(2)
  })

  // Verschmelzen waere falsch: Wer 7-19 zu 7-22 zieht, dichtet dem halben
  // Bereich drei Stunden Gebuehrenpflicht an.
  it('does not widen one window into another', () => {
    const merged = mergeFrankfurtWindows([
      ...parseFrankfurtSchedule('Mo-Fr 7-19'),
      ...parseFrankfurtSchedule('Mo-Fr 7-22'),
    ])
    expect(merged.map((window) => window.toMinute).sort((a, b) => a - b)).toEqual([1140, 1320])
  })

  it('returns an empty list unchanged', () => {
    expect(mergeFrankfurtWindows([])).toEqual([])
  })
})

describe('stripHtml', () => {
  // `vti_url` traegt in allen 42 Bereichen Markup in einem Datenfeld. Das ist
  // die Form fremder Eingabe, die am ehesten irgendwo als Markup landet.
  it('turns the feeds anchor into its text', () => {
    expect(
      stripHtml('<a href="/wir-fuer-sie/bewohnerparken/regelungsbereich-0" target="_blank" class="regelbereiche">weitere Informationen</a>')
    ).toBe('weitere Informationen')
  })

  it('leaves nothing executable behind', () => {
    expect(stripHtml('<script>alert(1)</script>Text')).toBe('alert(1) Text')
    expect(stripHtml('<img src=x onerror=alert(1)>')).toBe('')
    expect(stripHtml('a<b>c</b>d')).toBe('a c d')
  })

  it('decodes the entities the feed could carry', () => {
    expect(stripHtml('Stra&amp;szlig; &lt;x&gt; &quot;y&quot; &#39;z&#39;')).toBe(
      'Stra&szlig; <x> "y" \'z\''
    )
    expect(stripHtml('a&nbsp;b')).toBe('a b')
  })

  it('treats null, undefined and an oversized value as nothing', () => {
    expect(stripHtml(null)).toBe('')
    expect(stripHtml(undefined)).toBe('')
    expect(stripHtml('<b>x</b>'.padEnd(5000, 'y'))).toBe('')
  })
})

describe('frankfurtZoneLabel', () => {
  it('uses the number, the only identity the feed gives', () => {
    expect(frankfurtZoneLabel({ nummer: 0 })).toBe('0')
    expect(frankfurtZoneLabel({ nummer: 41 })).toBe('41')
  })

  it('does not invent one when the number is missing', () => {
    expect(frankfurtZoneLabel({})).toBe('?')
    expect(frankfurtZoneLabel({ nummer: null })).toBe('?')
  })

  it('labels all 42 areas of the feed distinctly', () => {
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
  it('says nothing where the feed says nothing', () => {
    for (const row of ZONES) expect(frankfurtZoneNote(row), frankfurtZoneLabel(row)).toBeNull()
  })

  it('passes on a name or description as soon as the city fills one in', () => {
    expect(frankfurtZoneNote({ nummer: 3, name: 'Nordend-West' })).toBe('Nordend-West')
    expect(frankfurtZoneNote({ nummer: 3, name: 'A', description: 'B' })).toBe('A — B')
  })

  it('strips markup out of whatever it passes on', () => {
    expect(frankfurtZoneNote({ description: '<b>Bockenheim</b>' })).toBe('Bockenheim')
  })

  it('keeps a link text that is not boilerplate', () => {
    expect(frankfurtZoneNote({ vti_url: '<a href="/x">Bewohnerparken Nordend</a>' })).toBe(
      'Bewohnerparken Nordend'
    )
  })
})

describe('a Frankfurt area in the shared tariff model', () => {
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

  it('charges on the Saturday named in the second clause', () => {
    expect(isChargeable(zoneFrom([machine]), saturdayNoon)).toBe(true)
  })

  // Der Fehler, den die zweite Klausel verhindert: Wer nur `Mo-Fr 8-18` liest,
  // sagt samstags um 12 "keine Gebuehr" — und das kostet ein Knoellchen.
  it('would say free on that Saturday without the second clause', () => {
    const truncated = zoneFrom([{ ...machine, gebuehrenzeit: 'Mo-Fr 8-18' }])
    expect(isChargeable(truncated, saturdayNoon)).toBe(false)
  })

  it('is free on Sunday where no clause names it', () => {
    expect(isChargeable(zoneFrom([machine]), sundayNoon)).toBe(false)
  })

  // Fronleichnam ist in Hessen gesetzlicher Feiertag, in Berlin und Hamburg
  // nicht. Genau dafuer haengt der Kalender am Bundesland.
  it('is free on Fronleichnam, which Berlin and Hamburg charge', () => {
    // Donnerstag, 4. Juni 2026, 12:00 Berliner Zeit.
    const fronleichnam = Date.UTC(2026, 5, 4, 10)
    const he = zoneFrom([machine])
    expect(isChargeable(he, fronleichnam)).toBe(false)
    expect(isChargeable({ ...he, land: 'BE' }, fronleichnam)).toBe(true)
    expect(isChargeable({ ...he, land: 'HH' }, fronleichnam)).toBe(true)
  })

  it('takes the range where two machines in one area disagree on the rate', () => {
    const zone = zoneFrom([machine, { ...machine, gebuehrenzone: '4 €/h' }])
    expect(zone.fee).toEqual({ kind: 'range', minCentsPerHour: 200, maxCentsPerHour: 400 })
  })

  it('builds every machine of the feed without throwing', () => {
    for (const row of AUTOMATS) {
      expect(() => zoneFrom([row]), row.strassenname ?? '?').not.toThrow()
    }
  })
})
