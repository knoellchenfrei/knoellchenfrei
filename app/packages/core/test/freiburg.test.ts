import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import type { Weekday } from '../src/berlin-time.js'
import {
  FreiburgParseError,
  freiburgAccessibleCount,
  freiburgMaxStayCode,
  freiburgScheduleTypo,
  freiburgZoneLabel,
  freiburgZoneNote,
  isActiveFreiburgAutomat,
  isFreiburgSignageOnly,
  mergeFreiburgWindows,
  parseFreiburgAutomatFee,
  parseFreiburgFee,
  parseFreiburgMaxStay,
  parseFreiburgSchedule,
  type FreiburgAutomatProperties,
  type FreiburgZoneProperties,
} from '../src/freiburg.js'
import { isChargeable, type ParkingZone } from '../src/tariff.js'

/**
 * Die echten Zeilen des Dienstes, abgerufen am 16. September 2026.
 *
 * Wie bei den sieben Städten davor: Fixtures sind der Feed, nicht
 * ausgedachte Beispiele. Die Flächen stehen vollständig (37 Zeilen), die
 * Automaten als Auszählung aller Schreibweisen plus je ein Vertreter.
 */
const read = <T>(name: string): T =>
  JSON.parse(readFileSync(fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url)), 'utf8')) as T

interface AutomatFixture {
  abgerufenAm: string
  automatenGesamt: number
  laufzeiten: { text: string; anzahl: number }[]
  hoechstparkdauern: { text: string; anzahl: number }[]
  gebuehrenzonen: { text: string; anzahl: number }[]
  tarife: { text: string; anzahl: number }[]
  automaten: FreiburgAutomatProperties[]
}

const ZONES = read<FreiburgZoneProperties[]>('fr-parkgebzonen-2026-09-16.json')
const PSA = read<AutomatFixture>('fr-parkscheinautomaten-2026-09-16.json')

const MO_FR: readonly Weekday[] = [1, 2, 3, 4, 5]
const MO_SA: readonly Weekday[] = [1, 2, 3, 4, 5, 6]
const ALL: readonly Weekday[] = [0, 1, 2, 3, 4, 5, 6]
const SA: readonly Weekday[] = [6]

type Expected = { weekdays: readonly Weekday[]; from: number; to: number }[]

/**
 * Alle sieben Schreibweisen der Flächen, einzeln als Erwartung.
 *
 * Nicht „geht durch, ohne zu werfen": Ein Parser, der `werktags` als Mo–Fr
 * liest, wirft auch nicht — er verschweigt nur den Samstag. Deshalb steht
 * hier jede Schreibweise mit dem Ergebnis, das sie haben muss, und der Zahl,
 * wie oft der Feed sie führt. Zwei davon haben kein Ergebnis: der Verweis
 * auf die Beschilderung und der Tippfehler.
 */
const ZONE_SCHEDULES: readonly { raw: string; count: number; windows: Expected | 'signage' | 'typo' }[] = [
  { raw: 'werktags 09:00-19:00 Uhr', count: 26, windows: [{ weekdays: MO_SA, from: 540, to: 1140 }] },
  { raw: 'durchgehend', count: 6, windows: [{ weekdays: ALL, from: 0, to: 1440 }] },
  { raw: 'werktags 08:00-18:00 Uhr', count: 1, windows: [{ weekdays: MO_SA, from: 480, to: 1080 }] },
  { raw: 'werktags 07:00-19:00 Uhr', count: 1, windows: [{ weekdays: MO_SA, from: 420, to: 1140 }] },
  {
    raw: 'Montag - Freitag 07:30-19:00 Uhr; Samstag 09:00-19:00 Uhr',
    count: 1,
    windows: [
      { weekdays: MO_FR, from: 450, to: 1140 },
      { weekdays: SA, from: 540, to: 1140 },
    ],
  },
  { raw: 'werktags 09:00-19:00 Uhrä', count: 1, windows: 'typo' },
  { raw: 'Beschilderung beachten!', count: 1, windows: 'signage' },
]

/** Alle 17 Schreibweisen der Automaten — mit den Zeilenumbrüchen der Quelle. */
const AUTOMAT_SCHEDULES: readonly { raw: string; count: number; windows: Expected | 'unreadable' }[] = [
  { raw: 'werktags\n09:00 - 19:00', count: 324, windows: [{ weekdays: MO_SA, from: 540, to: 1140 }] },
  { raw: 'werktags\n09:00 - 23:00', count: 87, windows: [{ weekdays: MO_SA, from: 540, to: 1380 }] },
  { raw: 'werktags 09:00 - 19:00', count: 50, windows: [{ weekdays: MO_SA, from: 540, to: 1140 }] },
  { raw: 'werktags 09:00 - 23:00', count: 26, windows: [{ weekdays: MO_SA, from: 540, to: 1380 }] },
  { raw: 'täglich\n00:00 - 24:00', count: 15, windows: [{ weekdays: ALL, from: 0, to: 1440 }] },
  { raw: 'werktags 9-19 Uhr', count: 13, windows: [{ weekdays: MO_SA, from: 540, to: 1140 }] },
  { raw: 'täglich\n09:00 - 19:00', count: 8, windows: [{ weekdays: ALL, from: 540, to: 1140 }] },
  { raw: 'werktags 9:00 - 19:00', count: 4, windows: [{ weekdays: MO_SA, from: 540, to: 1140 }] },
  { raw: 'täglich\n09:00 - 23:00', count: 3, windows: [{ weekdays: ALL, from: 540, to: 1380 }] },
  { raw: 'werktags 9:00 - 23:00', count: 1, windows: [{ weekdays: MO_SA, from: 540, to: 1380 }] },
  { raw: 'werktags\n09:00 - 19:00\n', count: 1, windows: [{ weekdays: MO_SA, from: 540, to: 1140 }] },
  { raw: 'werktags\n05:30 - 20:45', count: 1, windows: [{ weekdays: MO_SA, from: 330, to: 1245 }] },
  {
    raw: 'Mo-Fr 07:30-19:00; Sa 09-19',
    count: 1,
    windows: [
      { weekdays: MO_FR, from: 450, to: 1140 },
      { weekdays: SA, from: 540, to: 1140 },
    ],
  },
  { raw: 'werktags 09:00 - 18:00', count: 1, windows: [{ weekdays: MO_SA, from: 540, to: 1080 }] },
  { raw: 'täglich\n08:00 - 19:00', count: 1, windows: [{ weekdays: ALL, from: 480, to: 1140 }] },
  { raw: 'werktags 07:30 - 23:00', count: 1, windows: [{ weekdays: MO_SA, from: 450, to: 1380 }] },
  // Ohne Tagesangabe: ob täglich oder werktags, sagt die Zeile nicht.
  { raw: '9 - 19 Uhr', count: 1, windows: 'unreadable' },
]

const toWindows = (expected: Expected) =>
  expected.map((window) => ({ weekdays: window.weekdays, fromMinute: window.from, toMinute: window.to }))

describe('Freiburger Zeitangabe an den Flächen', () => {
  it('die Tabelle deckt jede Schreibweise des Abzugs ab, und die Zählung stimmt', () => {
    const counts = new Map<string, number>()
    for (const zone of ZONES) {
      const raw = zone.zeit_der_gebuehrenpflicht ?? ''
      counts.set(raw, (counts.get(raw) ?? 0) + 1)
    }
    expect([...counts.keys()].sort()).toEqual(ZONE_SCHEDULES.map((entry) => entry.raw).sort())
    for (const entry of ZONE_SCHEDULES) expect(counts.get(entry.raw), entry.raw).toBe(entry.count)
    expect(ZONE_SCHEDULES.reduce((sum, entry) => sum + entry.count, 0)).toBe(37)
  })

  for (const entry of ZONE_SCHEDULES) {
    if (entry.windows === 'signage') {
      it(`"${entry.raw}" ist ein Verweis auf die Beschilderung und keine Zeit`, () => {
        expect(isFreiburgSignageOnly(entry.raw)).toBe(true)
        expect(() => parseFreiburgSchedule(entry.raw)).toThrow(FreiburgParseError)
      })
      continue
    }
    if (entry.windows === 'typo') {
      it(`"${entry.raw}" ist der eine bekannte Tippfehler: abgewiesen, aber wörtlich korrigierbar`, () => {
        expect(() => parseFreiburgSchedule(entry.raw)).toThrow(FreiburgParseError)
        const typo = freiburgScheduleTypo(entry.raw)
        expect(typo).toEqual({ corrected: 'werktags 09:00-19:00 Uhr' })
        expect(parseFreiburgSchedule(typo?.corrected ?? '')).toEqual([
          { weekdays: MO_SA, fromMinute: 540, toMinute: 1140 },
        ])
      })
      continue
    }
    const windows = entry.windows
    it(`"${entry.raw}" (${entry.count}×)`, () => {
      expect(parseFreiburgSchedule(entry.raw)).toEqual(toWindows(windows))
    })
  }

  it('kennt den Tippfehler nur wörtlich — nicht als Muster', () => {
    expect(freiburgScheduleTypo('werktags 09:00-19:00 Uhr')).toBeNull()
    expect(freiburgScheduleTypo('werktags 09:00-23:00 Uhrä')).toBeNull()
    expect(freiburgScheduleTypo(null)).toBeNull()
    expect(freiburgScheduleTypo('  werktags 09:00-19:00 Uhrä ')).toEqual({ corrected: 'werktags 09:00-19:00 Uhr' })
  })

  it('erkennt den Verweis auf die Beschilderung nur als ganze Zeile', () => {
    expect(isFreiburgSignageOnly('Beschilderung beachten!')).toBe(true)
    expect(isFreiburgSignageOnly(' beschilderung beachten ')).toBe(true)
    expect(isFreiburgSignageOnly('werktags 9-19 Uhr, Beschilderung beachten!')).toBe(false)
    expect(isFreiburgSignageOnly(null)).toBe(false)
    expect(isFreiburgSignageOnly('')).toBe(false)
  })
})

describe('Freiburger Zeitangabe an den Automaten', () => {
  it('die Tabelle deckt jede Schreibweise des Abzugs ab, und die Zählung stimmt', () => {
    expect(PSA.laufzeiten.map((entry) => entry.text).sort()).toEqual(
      AUTOMAT_SCHEDULES.map((entry) => entry.raw).sort()
    )
    for (const entry of AUTOMAT_SCHEDULES) {
      expect(PSA.laufzeiten.find((row) => row.text === entry.raw)?.anzahl, entry.raw).toBe(entry.count)
    }
    expect(AUTOMAT_SCHEDULES.reduce((sum, entry) => sum + entry.count, 0)).toBe(PSA.automatenGesamt)
    expect(PSA.automatenGesamt).toBe(538)
  })

  for (const entry of AUTOMAT_SCHEDULES) {
    if (entry.windows === 'unreadable') {
      it(`${JSON.stringify(entry.raw)} hat keine Tagesangabe und wird abgewiesen`, () => {
        expect(() => parseFreiburgSchedule(entry.raw)).toThrow(FreiburgParseError)
      })
      continue
    }
    const windows = entry.windows
    it(`${JSON.stringify(entry.raw)} (${entry.count}×)`, () => {
      expect(parseFreiburgSchedule(entry.raw)).toEqual(toWindows(windows))
    })
  }

  it('liest jede Vertreter-Zeile der Fixture genau wie ihre Schreibweise in der Tabelle', () => {
    for (const automat of PSA.automaten) {
      const entry = AUTOMAT_SCHEDULES.find((candidate) => candidate.raw === automat.laufzeiten)
      expect(entry, automat.laufzeiten ?? '').toBeDefined()
      if (entry?.windows === 'unreadable') continue
      expect(parseFreiburgSchedule(automat.laufzeiten ?? '')).toEqual(toWindows(entry?.windows ?? []))
    }
  })
})

describe('parseFreiburgSchedule — was nicht durchgeht', () => {
  it.each([
    ['', 'leer'],
    ['   ', 'nur Leerraum'],
    ['werktags', 'ohne Stunden'],
    ['9-19 Uhr', 'ohne Tag, ohne Leerzeichen'],
    ['werktags 19:00-09:00 Uhr', 'über Mitternacht — kommt im Feed nicht vor'],
    ['werktags 09:00-09:00 Uhr', 'Anfang gleich Ende'],
    ['werktags 09:60-19:00 Uhr', 'Minuten über 59'],
    ['werktags 09:00-25:00 Uhr', 'Stunde über 24'],
    ['werktags 24:00-24:30 Uhr', 'Anfang um Mitternacht des Folgetags'],
    ['Fr-Mo 09:00-19:00 Uhr', 'umgekehrte Tagesspanne'],
    ['Mittwochs 09:00-19:00 Uhr', 'unbekannter Tagesname'],
    ['werktags 09:00-19:00 Uhr!', 'Zeichen hinter Uhr'],
    ['werktags 09:00-19:00 Uhr; ', 'leere zweite Klausel ist erlaubt, aber nicht mit Rest'],
  ])('%s — %s', (raw, reason) => {
    if (reason.startsWith('leere zweite Klausel')) {
      // Ein Semikolon am Ende ist kein Fehler: Die zweite Klausel ist leer
      // und fällt weg.
      expect(parseFreiburgSchedule(raw)).toHaveLength(1)
      return
    }
    expect(() => parseFreiburgSchedule(raw)).toThrow(FreiburgParseError)
  })

  it('begrenzt die Eingabe, bevor ein Muster sie ansieht', () => {
    const long = `werktags 09:00-19:00 Uhr${'!'.repeat(200)}`
    expect(() => parseFreiburgSchedule(long)).toThrow(/Zeichen sind keine Zeitangabe/)
  })

  it('liest Tagesspannen bis Sonntag richtig herum', () => {
    // In Wochenreihenfolge, Sonntag zuletzt — deshalb nicht `ALL`.
    expect(parseFreiburgSchedule('Mo-So 8-20')).toEqual([
      { weekdays: [1, 2, 3, 4, 5, 6, 0], fromMinute: 480, toMinute: 1200 },
    ])
    expect(parseFreiburgSchedule('Sa-So 8-20 Uhr')).toEqual([{ weekdays: [6, 0], fromMinute: 480, toMinute: 1200 }])
    expect(parseFreiburgSchedule('So 8-20')).toEqual([{ weekdays: [0], fromMinute: 480, toMinute: 1200 }])
  })

  it('hält den Tippfehler des Feeds für einen Fehler', () => {
    // Der Anlass für die strikte Grenze am Zeilenende: `Uhrä` geht nicht
    // still als `Uhr` durch, sondern über `freiburgScheduleTypo`.
    expect(() => parseFreiburgSchedule('werktags 09:00-19:00 Uhrä')).toThrow(/keine erkennbare/)
  })
})

describe('mergeFreiburgWindows', () => {
  it('legt gleiche Fenster zusammen und lässt verschiedene stehen', () => {
    const a = parseFreiburgSchedule('werktags\n09:00 - 23:00')
    const b = parseFreiburgSchedule('werktags 09:00 - 23:00')
    const c = parseFreiburgSchedule('täglich\n09:00 - 23:00')
    expect(mergeFreiburgWindows([...a, ...b, ...c, ...a])).toEqual([...a, ...c])
  })
})

describe('parseFreiburgFee — die Flächen', () => {
  it('die Tabelle deckt jeden Betrag des Abzugs ab', () => {
    const counts = new Map<string, number>()
    for (const zone of ZONES) {
      const raw = zone.parkgebuehr_je_stunde ?? ''
      counts.set(raw, (counts.get(raw) ?? 0) + 1)
    }
    expect([...counts.entries()].sort()).toEqual([
      ['--', 6],
      ['1,80 €', 28],
      ['3,50 €', 2],
      ['4,20 €', 1],
    ])
  })

  it.each([
    ['1,80 €', 180],
    ['3,50 €', 350],
    ['4,20 €', 420],
  ])('%s → %i Cent', (raw, cents) => {
    expect(parseFreiburgFee(raw)).toEqual({ kind: 'exact', centsPerHour: cents })
  })

  it('liest den Strich, das leere Feld und null als „Quelle sagt nichts"', () => {
    expect(parseFreiburgFee('--')).toEqual({ kind: 'unknown' })
    expect(parseFreiburgFee('-')).toEqual({ kind: 'unknown' })
    expect(parseFreiburgFee('')).toEqual({ kind: 'unknown' })
    expect(parseFreiburgFee(null)).toEqual({ kind: 'unknown' })
    expect(parseFreiburgFee(undefined)).toEqual({ kind: 'unknown' })
  })

  it('bricht bei 0,00 € ab, statt einen Preis von null zu behaupten', () => {
    expect(() => parseFreiburgFee('0,00 €')).toThrow(FreiburgParseError)
    expect(() => parseFreiburgFee('0,00 €')).toThrow(/0,00 €/)
  })

  it('weist die Schreibweisen der anderen Städte ab', () => {
    for (const raw of ['1,80 Euro', '1.80 €', '3,50 € je Stunde', '4 €/h', '1,8 €', 'kostenlos', 'Parkscheibe']) {
      expect(() => parseFreiburgFee(raw), raw).toThrow(FreiburgParseError)
    }
  })

  it('der Strich steht genau an den sechs durchgehenden Flächen mit ÖPNV-Pauschale', () => {
    const dashed = ZONES.filter((zone) => zone.parkgebuehr_je_stunde === '--')
    expect(dashed).toHaveLength(6)
    for (const zone of dashed) {
      expect(zone.zeit_der_gebuehrenpflicht).toBe('durchgehend')
      expect(zone['tages-parkpauschale']).toBe('9,00 € oder ÖPNV-Ticket')
      expect(zone.parkgebuehrenzone).toBe('3')
    }
  })
})

describe('parseFreiburgAutomatFee — die Gegenprobe', () => {
  it('liest die drei Tarife des Abzugs', () => {
    expect(PSA.tarife.map((entry) => entry.text).sort()).toEqual(['1.80', '3.50', '4.20'])
    expect(parseFreiburgAutomatFee('1.80')).toEqual({ kind: 'exact', centsPerHour: 180 })
    expect(parseFreiburgAutomatFee('3.50')).toEqual({ kind: 'exact', centsPerHour: 350 })
    expect(parseFreiburgAutomatFee('4.20')).toEqual({ kind: 'exact', centsPerHour: 420 })
  })

  it('bricht bei 0.00 ab und weist die Flächen-Schreibweise ab', () => {
    expect(() => parseFreiburgAutomatFee('0.00')).toThrow(FreiburgParseError)
    expect(() => parseFreiburgAutomatFee('1,80 €')).toThrow(FreiburgParseError)
    expect(parseFreiburgAutomatFee(null)).toEqual({ kind: 'unknown' })
    expect(parseFreiburgAutomatFee('')).toEqual({ kind: 'unknown' })
  })

  it('Fixture: `tarif_e_h` und `tarif_in_euro_h` sagen an jedem Vertreter dasselbe', () => {
    for (const automat of PSA.automaten) {
      const fee = parseFreiburgAutomatFee(automat.tarif_e_h)
      expect(fee.kind).toBe('exact')
      if (fee.kind === 'exact') expect(fee.centsPerHour).toBe(Math.round((automat.tarif_in_euro_h ?? 0) * 100))
    }
  })
})

describe('parseFreiburgMaxStay', () => {
  it('die Fixture kennt genau 24, 1, 2 und 4 Stunden', () => {
    expect(PSA.hoechstparkdauern.map((entry) => entry.text).sort()).toEqual(['1', '2', '24', '4'])
    expect(PSA.hoechstparkdauern.find((entry) => entry.text === '24')?.anzahl).toBe(506)
  })

  it('24 Stunden sind keine Begrenzung — das ist das Tagesticket', () => {
    expect(parseFreiburgMaxStay(24)).toBeUndefined()
    expect(parseFreiburgMaxStay(48)).toBeUndefined()
  })

  it.each([
    [1, 60],
    [2, 120],
    [4, 240],
  ])('%i h → %i Minuten', (hours, minutes) => {
    expect(parseFreiburgMaxStay(hours)).toBe(minutes)
  })

  it('macht aus fehlend nichts und aus Unfug einen Abbruch', () => {
    expect(parseFreiburgMaxStay(null)).toBeUndefined()
    expect(parseFreiburgMaxStay(undefined)).toBeUndefined()
    expect(() => parseFreiburgMaxStay(0)).toThrow(FreiburgParseError)
    expect(() => parseFreiburgMaxStay(-1)).toThrow(FreiburgParseError)
    expect(() => parseFreiburgMaxStay(1.5)).toThrow(FreiburgParseError)
    expect(() => parseFreiburgMaxStay(Number.NaN)).toThrow(FreiburgParseError)
  })

  it('schreibt Kurzformen wie Frankfurt', () => {
    expect(freiburgMaxStayCode(60)).toBe('1h')
    expect(freiburgMaxStayCode(240)).toBe('4h')
    expect(freiburgMaxStayCode(90)).toBe('90min')
  })
})

describe('Flächen: Schlüssel, Notiz, Aktivität', () => {
  it('vergibt jeden Schlüssel genau einmal — „Zone 3" allein wäre 34-mal da', () => {
    const labels = ZONES.map(freiburgZoneLabel)
    expect(new Set(labels).size).toBe(ZONES.length)
    expect(labels.filter((label) => label.startsWith('3 '))).toHaveLength(34)
    expect(freiburgZoneLabel({ fid: 7, parkgebuehrenzone: '1' })).toBe('1 (Fläche 7)')
    expect(freiburgZoneLabel({})).toBe('? (Fläche ?)')
  })

  it('nennt die Tagespauschale als Notiz, auch die mit ÖPNV-Ticket', () => {
    expect(freiburgZoneNote({ 'tages-parkpauschale': '9,00 €' })).toBe('Tagespauschale 9,00 €')
    expect(freiburgZoneNote({ 'tages-parkpauschale': '9,00 € oder ÖPNV-Ticket' })).toBe(
      'Tagespauschale 9,00 € oder ÖPNV-Ticket'
    )
    expect(freiburgZoneNote({ 'tages-parkpauschale': '--' })).toBeNull()
    expect(freiburgZoneNote({})).toBeNull()
    for (const zone of ZONES) expect(freiburgZoneNote(zone), String(zone.fid)).not.toBeNull()
  })

  it('zählt nur Automaten mit aktiv === true', () => {
    expect(isActiveFreiburgAutomat({ aktiv: true })).toBe(true)
    expect(isActiveFreiburgAutomat({ aktiv: false })).toBe(false)
    expect(isActiveFreiburgAutomat({})).toBe(false)
    for (const automat of PSA.automaten) expect(isActiveFreiburgAutomat(automat)).toBe(true)
  })

  it('Fixture: die Zonennummer der Fläche ist eine Zeichenkette, die des Automaten eine Zahl', () => {
    for (const zone of ZONES) expect(['1', '2', '3']).toContain(zone.parkgebuehrenzone)
    for (const automat of PSA.automaten) expect([1, 2, 3]).toContain(automat.gebuehrenzone)
    expect(ZONES.filter((zone) => zone.parkgebuehrenzone === '1')).toHaveLength(1)
    expect(ZONES.find((zone) => zone.parkgebuehrenzone === '1')?.zeit_der_gebuehrenpflicht).toBe(
      'Beschilderung beachten!'
    )
  })
})

describe('freiburgAccessibleCount', () => {
  it.each([
    ['1', 1],
    ['2', 2],
    ['1 von 2', 2],
    ['2 von 2', 2],
    ['1von 2', 2],
    ['12 von 12', 12],
    ['', null],
    ['zwei', null],
    [null, null],
  ])('%s → %s', (raw, expected) => {
    expect(freiburgAccessibleCount(raw)).toBe(expected)
  })
})

/**
 * Einmal durch bis zur Antwort: Aus einer Fläche des Feeds wird eine
 * `ParkingZone`, und die rechnet richtig — Samstag kostet („werktags"),
 * Sonntag nicht, Fronleichnam nicht (Baden-Württemberg), und in Berlin
 * derselbe Tag schon.
 */
describe('von der Fläche zur Antwort', () => {
  const zone3 = ZONES.find((zone) => zone.fid === 42) as FreiburgZoneProperties
  const parking: ParkingZone = {
    id: freiburgZoneLabel(zone3),
    name: freiburgZoneLabel(zone3),
    land: 'BW',
    fee: parseFreiburgFee(zone3.parkgebuehr_je_stunde),
    windows: parseFreiburgSchedule(zone3.zeit_der_gebuehrenpflicht ?? ''),
  }

  it('Dienstag 10:30 kostet 1,80 €, 19:30 nicht mehr', () => {
    expect(parking.fee).toEqual({ kind: 'exact', centsPerHour: 180 })
    expect(isChargeable(parking, Date.UTC(2026, 8, 15, 8, 30))).toBe(true)
    expect(isChargeable(parking, Date.UTC(2026, 8, 15, 17, 30))).toBe(false)
  })

  it('Samstag kostet — werktags ist Montag bis Samstag', () => {
    expect(isChargeable(parking, Date.UTC(2026, 8, 19, 8, 30))).toBe(true)
  })

  it('Sonntag nicht', () => {
    expect(isChargeable(parking, Date.UTC(2026, 8, 20, 8, 30))).toBe(false)
  })

  it('Fronleichnam 2026 nicht — in Baden-Württemberg, nicht in Berlin', () => {
    const fronleichnam = Date.UTC(2026, 5, 4, 8, 30)
    expect(isChargeable(parking, fronleichnam)).toBe(false)
    expect(isChargeable({ ...parking, land: 'BE' }, fronleichnam)).toBe(true)
  })

  it('die durchgehenden Flächen kosten auch sonntags nachts — mit unbekanntem Stundensatz', () => {
    const pr = ZONES.find((zone) => zone.fid === 12) as FreiburgZoneProperties
    const parkAndRide: ParkingZone = {
      id: freiburgZoneLabel(pr),
      name: freiburgZoneLabel(pr),
      land: 'BW',
      fee: parseFreiburgFee(pr.parkgebuehr_je_stunde),
      windows: parseFreiburgSchedule(pr.zeit_der_gebuehrenpflicht ?? ''),
    }
    expect(parkAndRide.fee).toEqual({ kind: 'unknown' })
    expect(isChargeable(parkAndRide, Date.UTC(2026, 8, 20, 1, 0))).toBe(true)
  })
})
