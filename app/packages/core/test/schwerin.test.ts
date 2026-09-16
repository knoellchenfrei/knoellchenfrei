import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import type { Weekday } from '../src/berlin-time.js'
import { multiPolygonContains, type PolygonRings } from '../src/geo.js'
import { holidaysFor } from '../src/holidays.js'
import {
  SCHWERIN_ZONE_ANCHORS,
  SchwerinParseError,
  mergeSchwerinFees,
  mergeSchwerinWindows,
  parseSchwerinFee,
  parseSchwerinMaxStay,
  parseSchwerinSchedule,
  planarArea,
  schwerinAutomatNote,
  schwerinMaxStayCode,
  schwerinZoneLetters,
  type SchwerinAutomatProperties,
  type SchwerinZoneAnchor,
} from '../src/schwerin.js'
import { isChargeable, type ParkingZone } from '../src/tariff.js'

/**
 * Die echte Quelle, abgerufen am 16. September 2026 — gelesen mit demselben
 * GML-Leser, der im Datenbau läuft, damit die Fixture wörtlich das ist, was
 * der Datenbau sieht: jedes Feld eine Zeichenkette, leer statt `null`.
 */
interface Zaehlung {
  text: string
  anzahl: number
}

interface PsaFixture {
  abgerufenAm: string
  quelle: string
  numberMatched: number
  srsName: string
  bewirtschaftungszeiten: Zaehlung[]
  gebuehren: Zaehlung[]
  hoechstparkdauern: Zaehlung[]
  tagesticket: Zaehlung[]
  kurzparkticket: Zaehlung[]
  bemerkungen: Zaehlung[]
  auszug: { id: string; properties: SchwerinAutomatProperties; positionUtm: [number, number] }[]
}

interface ZonenFixture {
  abgerufenAm: string
  numberMatched: number
  srsName: string
  flaechen: {
    id: string | null
    properties: Record<string, string>
    geometry: { type: 'Polygon' | 'MultiPolygon'; coordinates: unknown }
  }[]
}

const read = <T>(name: string): T =>
  JSON.parse(readFileSync(fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url)), 'utf8')) as T

const PSA = read<PsaFixture>('sn-parkscheinautomaten-2026-09-16.json')
const ZONEN = read<ZonenFixture>('sn-parkzonen-2026-09-16.json')

const MO_FR: readonly Weekday[] = [1, 2, 3, 4, 5]
const MO_SA: readonly Weekday[] = [1, 2, 3, 4, 5, 6]
const ALL: readonly Weekday[] = [0, 1, 2, 3, 4, 5, 6]

const summe = (zaehlung: readonly Zaehlung[]): number => zaehlung.reduce((sum, { anzahl }) => sum + anzahl, 0)

describe('die Fixture selbst', () => {
  it('zählt 143 Automaten in EPSG:25833, und jede Zählung geht auf', () => {
    expect(PSA.numberMatched).toBe(143)
    expect(PSA.srsName).toBe('urn:ogc:def:crs:EPSG::25833')
    for (const zaehlung of [PSA.bewirtschaftungszeiten, PSA.gebuehren, PSA.hoechstparkdauern, PSA.tagesticket, PSA.kurzparkticket, PSA.bemerkungen]) {
      expect(summe(zaehlung)).toBe(143)
    }
  })

  it('führt im Auszug jede Schreibweise von Zeit, Betrag und Dauer mindestens einmal', () => {
    const werte = (feld: keyof SchwerinAutomatProperties): Set<string> =>
      new Set(PSA.auszug.map((automat) => automat.properties[feld] ?? ''))
    for (const { text } of PSA.bewirtschaftungszeiten) expect(werte('Bewirtschaftungszeit')).toContain(text)
    for (const { text } of PSA.gebuehren) expect(werte('Gebuehr')).toContain(text)
    for (const { text } of PSA.hoechstparkdauern) expect(werte('Hoechstparkdauer')).toContain(text)
  })

  // Der Grund für die Ankerpunkte: Die Zonen haben keine Kennung und kein
  // Feld. Wer hier einen Wert findet, hat einen neuen Abzug — und dann gehört
  // `SCHWERIN_ZONE_ANCHORS` gegen das neue Feld geprüft, nicht weitergeführt.
  it('führt 15 Zonenflächen ohne Kennung und ohne ein einziges Sachfeld', () => {
    expect(ZONEN.numberMatched).toBe(15)
    expect(ZONEN.flaechen).toHaveLength(15)
    for (const flaeche of ZONEN.flaechen) {
      expect(flaeche.id).toBeNull()
      expect(flaeche.properties).toEqual({})
    }
  })
})

describe('parseSchwerinSchedule', () => {
  /**
   * Alle fünf Schreibweisen des Abzugs, mit dem Ergebnis, das sie haben
   * müssen, und mit der Anzahl aus der Fixture — sinkt die Zählung, ist eine
   * Schreibweise dazugekommen, die hier nicht steht.
   */
  const ERWARTET: readonly { raw: string; count: number; weekdays: readonly Weekday[]; from: number; to: number }[] = [
    { raw: 'Mo - Sa 8-20 h', count: 125, weekdays: MO_SA, from: 480, to: 1200 },
    { raw: 'Mo - Fr 8-18 h', count: 7, weekdays: MO_FR, from: 480, to: 1080 },
    { raw: 'Mo - So 8-21 h', count: 5, weekdays: ALL, from: 480, to: 1260 },
    { raw: 'Mo - So 0-24 h', count: 4, weekdays: ALL, from: 0, to: 1440 },
    { raw: 'Mo - So 8-18 h', count: 2, weekdays: ALL, from: 480, to: 1080 },
  ]

  it.each(ERWARTET)('liest $raw als ein Fenster', ({ raw, weekdays, from, to }) => {
    expect(parseSchwerinSchedule(raw)).toEqual([{ weekdays, fromMinute: from, toMinute: to }])
  })

  it('deckt jede Schreibweise des Abzugs ab — mit der Zählung der Fixture', () => {
    const tabelle = new Map(ERWARTET.map((e) => [e.raw, e.count]))
    expect(PSA.bewirtschaftungszeiten.map((z) => z.text).sort()).toEqual([...tabelle.keys()].sort())
    for (const { text, anzahl } of PSA.bewirtschaftungszeiten) expect(anzahl, text).toBe(tabelle.get(text))
  })

  it('lässt Leerraum um die Bindestriche und am Rand frei — dieselbe Schreibweise', () => {
    expect(parseSchwerinSchedule('  Mo-Sa  8 - 20  h ')).toEqual(parseSchwerinSchedule('Mo - Sa 8-20 h'))
  })

  it('liest eine Tagesspanne über den Sonntag als Rundlauf statt als leere Liste', () => {
    expect(parseSchwerinSchedule('Sa - Mo 8-20 h')[0]?.weekdays).toEqual([0, 1, 6])
    expect(parseSchwerinSchedule('Mo - Mo 8-20 h')[0]?.weekdays).toEqual([1])
  })

  it.each([
    ['', 'leere Zeitangabe'],
    ['   ', 'leere Zeitangabe'],
    ['Mo 8-20 h', 'ein einzelner Tag kommt im Abzug nicht vor'],
    ['Mo - Sa 8-20 Uhr', 'Berlins „Uhr" statt Schwerins „h"'],
    ['Mo-Sa 9-20', 'Frankfurt ohne Einheit'],
    ['werktags 9-20 Uhr', 'Hamburg'],
    ['Mo - Sa 8:00-20:00 h', 'Minuten schreibt der Feed nie'],
    ['Mo - Xx 8-20 h', 'unbekannter Tag'],
    ['Mo - Sa 20-8 h', 'über Mitternacht — nicht im Abzug, keine geprüfte Lesart'],
    ['Mo - Sa 8-8 h', 'Anfang gleich Ende'],
    ['Mo - Sa 8-25 h', 'Stunde über 24'],
    ['Mo - Sa 8-20 h Sa 8-14 h', 'zweite Klausel — kommt nicht vor'],
  ])('wirft bei %j (%s) nur SchwerinParseError', (raw) => {
    expect(() => parseSchwerinSchedule(raw)).toThrow(SchwerinParseError)
  })

  it('begrenzt die Eingabe, bevor ein Muster sie sieht', () => {
    const lang = `Mo - Sa 8-20 h${' '.repeat(200)}`
    expect(() => parseSchwerinSchedule(lang)).toThrow(/Zeichen/)
    expect(() => parseSchwerinSchedule(lang)).toThrow(SchwerinParseError)
  })
})

describe('parseSchwerinFee', () => {
  it('liest beide Beträge des Abzugs — Dezimalpunkt, „Euro je Std."', () => {
    expect(parseSchwerinFee('2.50 Euro je Std.')).toEqual({ kind: 'exact', centsPerHour: 250 })
    expect(parseSchwerinFee('1.50 Euro je Std.')).toEqual({ kind: 'exact', centsPerHour: 150 })
    expect(parseSchwerinFee(' 2.50  Euro  je  Std ')).toEqual({ kind: 'exact', centsPerHour: 250 })
  })

  it('deckt jede Schreibweise des Abzugs ab', () => {
    expect(PSA.gebuehren.map((z) => z.text).sort()).toEqual(['', '1.50 Euro je Std.', '2.50 Euro je Std.'])
    expect(PSA.gebuehren.find((z) => z.text === '')?.anzahl).toBe(2)
    for (const { text } of PSA.gebuehren) expect(() => parseSchwerinFee(text)).not.toThrow()
  })

  // Zwei Automaten (Am Marstall, Zoo) lassen das Feld leer. Das ist keine
  // Gebühr von null — der eine ist ein Privatparkplatz mit Sonderregelung,
  // der andere verkauft nur Tagestickets.
  it('liest leer, Strich, null und undefined als „die Quelle sagt nichts"', () => {
    for (const raw of ['', '  ', '-', null, undefined]) expect(parseSchwerinFee(raw)).toEqual({ kind: 'unknown' })
  })

  it('bricht bei einem Nullbetrag ab, statt 0,00 € auszuliefern', () => {
    expect(() => parseSchwerinFee('0.00 Euro je Std.')).toThrow(/0.00 Euro/)
    expect(() => parseSchwerinFee('0.00 Euro je Std.')).toThrow(SchwerinParseError)
  })

  it.each([
    '2,50 Euro je Std.',
    '2.50 €',
    '2.50 Euro',
    '2.50 Euro je Stunde',
    '2 €/h',
    '3,50 € je Stunde',
    '2.5 Euro je Std.',
    'Parkscheibe',
  ])('wirft bei %j nur SchwerinParseError', (raw) => {
    expect(() => parseSchwerinFee(raw)).toThrow(SchwerinParseError)
  })

  it('begrenzt die Eingabe', () => {
    expect(() => parseSchwerinFee(`2.50 Euro je Std.${' '.repeat(200)}`)).toThrow(/Zeichen/)
  })
})

describe('parseSchwerinMaxStay', () => {
  it('liest die vier Werte des Abzugs', () => {
    expect(PSA.hoechstparkdauern.map((z) => z.text).sort()).toEqual(['', '2 h', '4 h', 'ohne'])
    expect(parseSchwerinMaxStay('ohne')).toBeUndefined()
    expect(parseSchwerinMaxStay('')).toBeUndefined()
    expect(parseSchwerinMaxStay('2 h')).toBe(120)
    expect(parseSchwerinMaxStay('4 h')).toBe(240)
    expect(parseSchwerinMaxStay(' Ohne ')).toBeUndefined()
    expect(parseSchwerinMaxStay('12h')).toBe(720)
    expect(parseSchwerinMaxStay(null)).toBeUndefined()
    expect(parseSchwerinMaxStay(undefined)).toBeUndefined()
  })

  it('wirft bei 0 h und bei allem, was keine Stundenzahl ist', () => {
    for (const raw of ['0 h', '30 min', '2', 'keine', '2 Std.', '999 h']) {
      expect(() => parseSchwerinMaxStay(raw), raw).toThrow(SchwerinParseError)
    }
    expect(() => parseSchwerinMaxStay(`2 h${' '.repeat(200)}`)).toThrow(/Zeichen/)
  })

  it('schreibt den Code so, wie die Oberfläche ihn kennt', () => {
    expect(schwerinMaxStayCode(120)).toBe('2h')
    expect(schwerinMaxStayCode(240)).toBe('4h')
    expect(schwerinMaxStayCode(90)).toBe('90min')
  })
})

describe('mergeSchwerinFees und mergeSchwerinWindows', () => {
  it('macht aus lauter gleichen Beträgen einen, aus zwei eine Spanne, aus keinem unknown', () => {
    const f250 = parseSchwerinFee('2.50 Euro je Std.')
    const f150 = parseSchwerinFee('1.50 Euro je Std.')
    expect(mergeSchwerinFees([f250, f250, { kind: 'unknown' }])).toEqual({ kind: 'exact', centsPerHour: 250 })
    expect(mergeSchwerinFees([f250, f150])).toEqual({ kind: 'range', minCentsPerHour: 150, maxCentsPerHour: 250 })
    expect(mergeSchwerinFees([{ kind: 'unknown' }, { kind: 'disc' }])).toEqual({ kind: 'unknown' })
    expect(mergeSchwerinFees([{ kind: 'range', minCentsPerHour: 100, maxCentsPerHour: 200 }, f250])).toEqual({
      kind: 'range',
      minCentsPerHour: 100,
      maxCentsPerHour: 250,
    })
  })

  // Zone A: zehn Automaten Mo–Sa 8–20, vier Mo–So 8–21, einer Mo–So 8–18.
  // Die Fenster werden vereinigt, nicht nach Mehrheit entschieden — und nicht
  // zu „8–21" verschmolzen.
  it('vereinigt widersprüchliche Fenster einer Zone, ohne sie zu verschmelzen', () => {
    const fenster = mergeSchwerinWindows([
      ...parseSchwerinSchedule('Mo - Sa 8-20 h'),
      ...parseSchwerinSchedule('Mo - Sa 8-20 h'),
      ...parseSchwerinSchedule('Mo - So 8-21 h'),
      ...parseSchwerinSchedule('Mo - So 8-18 h'),
    ])
    expect(fenster).toHaveLength(3)
    expect(fenster[0]).toEqual({ weekdays: MO_SA, fromMinute: 480, toMinute: 1200 })
    expect(fenster[1]).toEqual({ weekdays: ALL, fromMinute: 480, toMinute: 1260 })
  })
})

describe('schwerinAutomatNote', () => {
  it('reicht Auskünfte weiter und lässt die Notiz des Amts an sich selbst weg', () => {
    expect(schwerinAutomatNote({ Bemerkung: 'nur Tagesticket für 4 Euro' })).toBe('nur Tagesticket für 4 Euro')
    expect(schwerinAutomatNote({ Bemerkung: 'Sonderregelung:  Privatparkplatz Landesregierung, ab Fr 17.00 Uhr bis So öffentlich\n' })).toBe(
      'Sonderregelung: Privatparkplatz Landesregierung, ab Fr 17.00 Uhr bis So öffentlich'
    )
    expect(schwerinAutomatNote({ Bemerkung: 'Lage kontrollieren' })).toBeNull()
    expect(schwerinAutomatNote({ Bemerkung: '' })).toBeNull()
    expect(schwerinAutomatNote({})).toBeNull()
  })

  it('kennt die drei Bemerkungen des Abzugs', () => {
    expect(PSA.bemerkungen.map((z) => z.text.trim()).sort()).toEqual([
      '',
      'Lage kontrollieren',
      'Sonderregelung:  Privatparkplatz Landesregierung, ab Fr 17.00 Uhr bis So öffentlich',
      'nur Tagesticket für 4 Euro',
    ])
  })
})

describe('die Zonenbuchstaben aus den Ankerpunkten', () => {
  const polygons = ZONEN.flaechen.map((flaeche): PolygonRings[] =>
    flaeche.geometry.type === 'Polygon'
      ? [flaeche.geometry.coordinates as PolygonRings]
      : (flaeche.geometry.coordinates as PolygonRings[])
  )

  /**
   * Das Ergebnis der Messung vom 16. September 2026 gegen die WMS-Darstellung,
   * in der Reihenfolge der WFS-Antwort. Der Test hält es fest, damit eine
   * Umsortierung der Antwort **oder** ein verschobener Anker auffällt — die
   * Anker sind an die Fläche gebunden, nicht an die Reihenfolge.
   */
  it('gibt den 15 Flächen der Fixture die Buchstaben der Legende', () => {
    expect(schwerinZoneLetters(polygons)).toEqual([
      'J', 'L', 'O', 'C/D', 'V', 'C/O', 'A/C', 'A', 'C', 'D', 'H', 'G', 'F', 'A/F', 'A/D',
    ])
  })

  it('vergibt jeden Buchstaben genau einmal, und jeder Anker liegt in seiner Fläche', () => {
    const letters = schwerinZoneLetters(polygons)
    expect(new Set(letters).size).toBe(15)
    for (const anchor of SCHWERIN_ZONE_ANCHORS) {
      const index = letters.indexOf(anchor.zone)
      expect(index, anchor.zone).toBeGreaterThanOrEqual(0)
      expect(multiPolygonContains(polygons[index] as PolygonRings[], [anchor.easting, anchor.northing]), anchor.zone).toBe(true)
    }
  })

  // A/C liegt vollständig in A: Der Anker von A/C liegt in beiden, und die
  // kleinere gewinnt. Ohne diese Regel bekäme A den Buchstaben zweimal.
  it('gibt einen Anker, der in zwei Flächen liegt, der kleineren', () => {
    const ac = SCHWERIN_ZONE_ANCHORS.find((anchor) => anchor.zone === 'A/C') as SchwerinZoneAnchor
    const containing = polygons.map((rings, index) => (multiPolygonContains(rings, [ac.easting, ac.northing]) ? index : -1)).filter((i) => i >= 0)
    expect(containing).toEqual([6, 7])
    expect(planarArea(polygons[6] as PolygonRings[])).toBeLessThan(planarArea(polygons[7] as PolygonRings[]))
  })

  it('bricht ab, wenn eine Fläche fehlt oder dazukommt', () => {
    expect(() => schwerinZoneLetters(polygons.slice(1))).toThrow(/14 Zonenflächen, aber 15 Ankerpunkte/)
    expect(() => schwerinZoneLetters([...polygons, polygons[0] as PolygonRings[]])).toThrow(SchwerinParseError)
  })

  it('bricht ab, wenn ein Anker in keiner Fläche liegt', () => {
    const verschoben = SCHWERIN_ZONE_ANCHORS.map((anchor) =>
      anchor.zone === 'J' ? { ...anchor, easting: anchor.easting + 5000 } : anchor
    )
    expect(() => schwerinZoneLetters(polygons, verschoben)).toThrow(/"J".*keiner Zonenfläche/)
  })

  it('bricht ab, wenn zwei Anker dieselbe kleinste Fläche treffen', () => {
    const j = SCHWERIN_ZONE_ANCHORS.find((anchor) => anchor.zone === 'J') as SchwerinZoneAnchor
    const doppelt = SCHWERIN_ZONE_ANCHORS.map((anchor) =>
      anchor.zone === 'L' ? { ...anchor, easting: j.easting, northing: j.northing } : anchor
    )
    expect(() => schwerinZoneLetters(polygons, doppelt)).toThrow(/dieselbe Fläche wie "J"/)
  })

  it('rechnet die ebene Fläche in den Einheiten der Koordinaten', () => {
    const quadrat: PolygonRings = [[[0, 0], [100, 0], [100, 100], [0, 100], [0, 0]]]
    expect(planarArea([quadrat])).toBe(10_000)
    const mitLoch: PolygonRings = [quadrat[0] as PolygonRings[number], [[10, 10], [20, 10], [20, 20], [10, 20], [10, 10]]]
    expect(planarArea([mitLoch])).toBe(9_900)
    expect(planarArea([[[[0, 0], [1, 1]]]])).toBe(0)
  })
})

describe('Beschuss mit Unfug', () => {
  // Ein eigener kleiner Generator neben `fuzz.test.ts`, damit dieser Test
  // die Schweriner Bausteine kennt — echte Bruchstücke, die fast passen.
  function lcg(seed: number): () => number {
    let state = seed >>> 0
    return () => {
      state = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0
      return state
    }
  }
  const TOKENS = ['Mo', 'Sa', 'So', 'Fr', ' - ', '-', ' ', '8', '20', '24', '0', '25', 'h', ' h', 'Euro', 'je', 'Std.', 'Std', '.', ',', '2.50', '1.50', '0.00', 'ohne', '2 h', ' ', 'ß', '{', '\n']
  const next = lcg(20260916)
  const inputs = Array.from({ length: 800 }, () => {
    const parts: string[] = []
    const n = next() % 10
    for (let i = 0; i < n; i += 1) parts.push(TOKENS[next() % TOKENS.length] as string)
    return parts.join('')
  })

  it('jeder der drei Parser wirft nur SchwerinParseError oder liefert etwas Gültiges', () => {
    for (const input of inputs) {
      for (const parse of [parseSchwerinSchedule, parseSchwerinFee, parseSchwerinMaxStay]) {
        try {
          const result = parse(input)
          if (Array.isArray(result)) {
            for (const window of result) expect(window.fromMinute).toBeLessThan(window.toMinute)
          } else if (typeof result === 'number') {
            expect(result).toBeGreaterThan(0)
          } else if (result !== undefined && result.kind === 'exact') {
            expect(result.centsPerHour).toBeGreaterThan(0)
          }
        } catch (error) {
          expect(error, JSON.stringify(input)).toBeInstanceOf(SchwerinParseError)
        }
      }
    }
  })
})

describe('eine Schweriner Zone in der Zeit', () => {
  const zone: ParkingZone = {
    id: 'A',
    name: 'A',
    land: 'MV',
    fee: parseSchwerinFee('2.50 Euro je Std.'),
    windows: mergeSchwerinWindows([...parseSchwerinSchedule('Mo - Sa 8-20 h'), ...parseSchwerinSchedule('Mo - So 8-21 h')]),
  }

  it('kassiert werktags von 8 Uhr an', () => {
    // Dienstag, 15. September 2026, 10:00 Ortszeit.
    expect(isChargeable(zone, new Date('2026-09-15T08:00:00Z'))).toBe(true)
    // Derselbe Tag, 7:30.
    expect(isChargeable(zone, new Date('2026-09-15T05:30:00Z'))).toBe(false)
  })

  it('kassiert sonntags, weil vier Automaten den Sonntag nennen — die Vereinigung gilt', () => {
    // Sonntag, 20. September 2026, 10:00 Ortszeit.
    expect(isChargeable(zone, new Date('2026-09-20T08:00:00Z'))).toBe(true)
    // Samstag 20:30: das Mo–Sa-Fenster ist zu, das Mo–So-Fenster läuft bis 21.
    expect(isChargeable(zone, new Date('2026-09-19T18:30:00Z'))).toBe(true)
    // Samstag 21:30: beide zu.
    expect(isChargeable(zone, new Date('2026-09-19T19:30:00Z'))).toBe(false)
  })

  /**
   * Der Grund für den Eintrag `MV` in `holidays.ts`: Mecklenburg-Vorpommern
   * ist das einzige Land mit Frauentag **und** Reformationstag. Eine
   * Schweriner Zone mit Hamburgs Kalender kassierte am 8. März, eine mit
   * Berlins am 31. Oktober.
   */
  it('kassiert weder am Reformationstag noch am Frauentag, aber an Fronleichnam', () => {
    // Samstag, 31. Oktober 2026, 12:00 Ortszeit — sonst ein Zahltag.
    expect(isChargeable(zone, new Date('2026-10-31T11:00:00Z'))).toBe(false)
    // Montag, 8. März 2027, 12:00 Ortszeit.
    expect(isChargeable(zone, new Date('2027-03-08T11:00:00Z'))).toBe(false)
    // Fronleichnam 2026, Donnerstag, 4. Juni — in MV kein Feiertag.
    expect(isChargeable(zone, new Date('2026-06-04T10:00:00Z'))).toBe(true)
    expect(holidaysFor('MV', 2026).size).toBe(11)
  })
})
