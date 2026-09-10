import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import type { Weekday } from '../src/berlin-time.js'
import { MUENCHEN } from '../src/city.js'
import {
  MUENCHEN_PARKING_GROUPS,
  MuenchenParseError,
  isMuenchenParkingGroup,
  isMuenchenZoneActive,
  mergeMuenchenWindows,
  muenchenMaxStay,
  muenchenMaxStayCode,
  muenchenParkingWindows,
  muenchenSpaces,
  muenchenZoneLabel,
  muenchenZoneNote,
  parseMuenchenRule,
  type MuenchenSideProperties,
  type MuenchenZoneProperties,
} from '../src/muenchen.js'
import { isChargeable, type ParkingZone } from '../src/tariff.js'

/**
 * Der echte Feed, abgerufen am 7. September 2026 — alle 291 verschiedenen
 * Regeltexte, alle 82 Gebiets-Attribute und 21 vollständige Rohzeilen.
 *
 * Wie bei Berlin, Hamburg und Frankfurt: Fixtures sind der Feed, nicht
 * ausgedachte Beispiele. Bei München wiegt das schwerer als bei den anderen
 * drei, weil hier nicht ein Feld je Aussage steht, sondern ein Satz — und
 * ausgedachte Sätze sind immer die, die der Parser schon kann.
 */
interface Fixture {
  abschnitteGesamt: number
  abschnitteOhneRegeltext: number
  regeln: { text: string; gruppe: string; anzahl: number }[]
  gebiete: MuenchenZoneProperties[]
  beispielAbschnitte: Record<string, unknown>[]
}

const FIXTURE = JSON.parse(
  readFileSync(
    fileURLToPath(new URL('./fixtures/muc-parkseiten-2026-09-07.json', import.meta.url)),
    'utf8'
  )
) as Fixture

const MO_FR: readonly Weekday[] = [1, 2, 3, 4, 5]
const MO_SA: readonly Weekday[] = [1, 2, 3, 4, 5, 6]
const ALL: readonly Weekday[] = [0, 1, 2, 3, 4, 5, 6]
const SA: readonly Weekday[] = [6]
const SA_SO: readonly Weekday[] = [0, 6]

interface Expectation {
  raw: string
  /** Wie oft der Abzug diese Schreibweise führt. */
  count: number
  windows: { weekdays: readonly Weekday[]; from: number; to: number }[]
  maxStay?: number
  unmodelled?: string[]
}

/**
 * 36 der 291 Schreibweisen, einzeln mit dem Ergebnis, das sie haben müssen.
 *
 * Nicht „läuft durch, ohne zu werfen": Ein Parser, der
 * `Mischparken 18-23 Montag bis Freitag und 9-23 Uhr Samstag` klaglos als ein
 * Fenster von 18 bis 23 an sechs Tagen liest, wirft auch nicht — er verschweigt
 * nur, dass samstags schon um neun kassiert wird, und wer dann dort steht,
 * bekommt ein Knöllchen und eine App, die „keine Gebühr" sagt.
 *
 * Ausgewählt sind die häufigsten und alle Sonderfälle: Halbstunden, fehlende
 * Leerzeichen, Wochentagslisten, `werktags`, Klammerformen, Spannen über
 * Mitternacht, `sonst`, Schultage, ein Tippfehler der Quelle.
 */
const RULES: readonly Expectation[] = [
  // --- die vier häufigsten, zusammen 7.925 Abschnitte
  {
    raw: 'Mischparken 9-23 Uhr',
    count: 3909,
    windows: [{ weekdays: MO_SA, from: 540, to: 1380 }],
  },
  {
    raw: 'Bewohnerparken 9-23 Uhr',
    count: 1968,
    windows: [{ weekdays: MO_SA, from: 540, to: 1380 }],
  },
  // Ein Halteverbot ist kein Gebührenfenster — sonst wäre die Karte eine
  // Halteverbotskarte.
  { raw: 'Absolutes Halteverbot 0-24 Uhr', count: 1801, windows: [] },
  // Das schließende „mit Parkscheibe" ist eine Klausel der Art `disc` und
  // trotzdem kein Parkplatz. Ohne Zeitangabe gibt sie kein Fenster.
  {
    raw: 'E-Ladeinfrastruktur AC (Normalladen 22kW) nur E-Fahrzeuge im Ladezustand 8-20 Uhr 4h mit Parkscheibe',
    count: 1171,
    windows: [],
  },

  // --- Regeln ohne jede Zeitangabe
  { raw: 'Carsharing free floating', count: 847, windows: [] },
  { raw: '0-24 Uhr keine Regelung', count: 85, windows: [] },
  {
    raw: 'Behindertenparken allgemein (zeitliche Einschränkung unbekannt)',
    count: 75,
    windows: [],
    unmodelled: ['Zeit laut Quelle unbekannt'],
  },
  // Ein Tarif ohne Stunden: die Quelle sagt, was gilt, nicht wann.
  {
    raw: 'Hauptbahnhoftarif Kurzzeitparken 2h, mit Ausnahme frei',
    count: 41,
    windows: [],
    maxStay: 120,
  },

  // --- Parkscheibe, Kurzzeitparken, Höchstparkdauer
  {
    raw: 'Parkscheibe 4h 9-23 Uhr, Bewohner frei',
    count: 495,
    windows: [{ weekdays: MO_SA, from: 540, to: 1380 }],
    maxStay: 240,
  },
  {
    raw: 'Mischparken 9-18 Uhr, Bewohnerparken 18-23 Uhr',
    count: 398,
    windows: [
      { weekdays: MO_SA, from: 540, to: 1080 },
      { weekdays: MO_SA, from: 1080, to: 1380 },
    ],
  },
  {
    raw: 'Kurzzeitparken 2h 9-18 Uhr, Mischparken 18-23 Uhr',
    count: 258,
    windows: [
      { weekdays: MO_SA, from: 540, to: 1080 },
      { weekdays: MO_SA, from: 1080, to: 1380 },
    ],
    maxStay: 120,
  },
  {
    raw: 'Altstadttarif 8-23 Uhr',
    count: 231,
    windows: [{ weekdays: MO_SA, from: 480, to: 1380 }],
  },
  // Halbe Stunde, mit Komma geschrieben.
  {
    raw: 'Kurzzeitparken 0,5h 9-18 Uhr, Mischparken 18-23 Uhr',
    count: 1,
    windows: [
      { weekdays: MO_SA, from: 540, to: 1080 },
      { weekdays: MO_SA, from: 1080, to: 1380 },
    ],
    maxStay: 30,
  },
  // „Bewohner frei" ist die Ausnahme für Bewohner, keine Regel für Besucher:
  // eigenes Fenster gibt es dafür nicht.
  {
    raw: 'Parkscheibe 1h 9-23 Uhr, Bewohner frei 18-23 Uhr',
    count: 19,
    windows: [{ weekdays: MO_SA, from: 540, to: 1380 }],
    maxStay: 60,
  },
  // Die Höchstparkdauer des Behindertenparkplatzes ist die von jemand anderem
  // und zählt nicht; die 2h des Kurzzeitparkens schon.
  {
    raw: 'Behindertenparkplatz max. 2 Stunden 9-19 Uhr, Kurzzeitparken 2h 19-23 Uhr, Bewohner frei',
    count: 3,
    windows: [{ weekdays: MO_SA, from: 1140, to: 1380 }],
    maxStay: 120,
  },

  // --- der einzige Sonntag im Feed, und er steht ausgeschrieben da
  {
    raw: 'Parkscheibe 2h 9-18 Uhr Montag bis Sonntag, sonst freies Parken, Blaue Zone Messestadt Riem',
    count: 136,
    windows: [{ weekdays: ALL, from: 540, to: 1080 }],
    maxStay: 120,
  },
  {
    raw: 'Absolutes Halteverbot 7-13:30 Uhr Montag bis Freitag an Schultagen, Blaue Zone Messestadt Riem 13:30-18 Uhr Montag bis Freitag und 9-18 Uhr Samstag bis Sonntag',
    count: 1,
    windows: [
      { weekdays: MO_FR, from: 810, to: 1080 },
      { weekdays: SA_SO, from: 540, to: 1080 },
    ],
    unmodelled: ['Regelung nur an Schultagen'],
  },

  // --- zwei Zeitgruppen mit verschiedenen Tagen
  {
    raw: 'Eingeschränktes Halteverbot 7-18 Uhr Montag bis Freitag, Mischparken 18-23 Montag bis Freitag und 9-23 Uhr Samstag',
    count: 85,
    windows: [
      { weekdays: MO_FR, from: 1080, to: 1380 },
      { weekdays: SA, from: 540, to: 1380 },
    ],
  },
  {
    raw: 'Absolutes Halteverbot 7-14 Uhr Montag bis Freitag, Mischparken 14-23 Uhr Montag bis Freitag und 9-23 Uhr Samstag',
    count: 5,
    windows: [
      { weekdays: MO_FR, from: 840, to: 1380 },
      { weekdays: SA, from: 540, to: 1380 },
    ],
  },
  {
    raw: 'Behindertenparkplatz 8-18 Uhr Montag bis Freitag, Mischparken 18-23 Uhr Montag bis Freitag, Mischparken 9-23 Uhr Samstag',
    count: 28,
    windows: [
      { weekdays: MO_FR, from: 1080, to: 1380 },
      { weekdays: SA, from: 540, to: 1380 },
    ],
  },
  // Halbe Stunden auf beiden Seiten, und `Mischparken13-23` OHNE Leerzeichen —
  // ein Wortende hinter der Regelphrase hätte die ganze Samstagsklausel
  // verschluckt.
  {
    raw: 'Eingeschränktes Halteverbot 9-18:30 Uhr Montag bis Freitag und 8:30-13 Uhr Samstag, Mischparken 18:30-23:00 Uhr Montag bis Freitag, Mischparken13-23 Uhr Samstag',
    count: 1,
    windows: [
      { weekdays: MO_FR, from: 1110, to: 1380 },
      { weekdays: SA, from: 780, to: 1380 },
    ],
  },

  // --- Wochentagslisten mit Komma: der Grund, warum nicht am Komma getrennt wird
  {
    raw: 'Absolutes Halteverbot 7-14 Uhr Dienstag, Mittwoch, Freitag, Mischparken 14-23  Dienstag, Mittwoch, Freitag und 9-23 Montag, Donnerstag, Samstag',
    count: 1,
    windows: [
      { weekdays: [2, 3, 5], from: 840, to: 1380 },
      { weekdays: [1, 4, 6], from: 540, to: 1380 },
    ],
  },

  // --- `werktags`, allein und einschränkend
  {
    raw: 'Eingeschränktes Halteverbot 6-11 Uhr werktags, gebührenpflichtiges Kurzzeitparken 2h 11-18 Uhr werktags, Mischparken 18-23 Uhr werktags',
    count: 1,
    windows: [
      { weekdays: MO_SA, from: 660, to: 1080 },
      { weekdays: MO_SA, from: 1080, to: 1380 },
    ],
    maxStay: 120,
  },
  {
    raw: 'Mischparken 9-18 Uhr (werktags), Kurzzeitparken 2h 18-23 Uhr (werktags), Bewohner frei',
    count: 4,
    windows: [
      { weekdays: MO_SA, from: 540, to: 1080 },
      { weekdays: MO_SA, from: 1080, to: 1380 },
    ],
    maxStay: 120,
  },
  {
    raw: 'Eingeschränktes Halteverbot 7-18 Uhr werktags, Eingeschränktes Halteverbot 7-14 Uhr samstags, sonst frei',
    count: 8,
    windows: [],
  },

  // --- `sonst X` sagt welche Regel, nicht wann: kein Fenster
  { raw: 'Eingeschränktes Halteverbot 7-20 Uhr, sonst Mischparken', count: 25, windows: [] },
  { raw: 'Absolutes Halteverbot 6:30-20 Uhr werktags, sonst Mischparken', count: 5, windows: [] },
  {
    raw: 'Mischparken 9-18 Uhr, sonst freies Parken',
    count: 36,
    windows: [{ weekdays: MO_SA, from: 540, to: 1080 }],
  },
  // Tippfehler der Quelle: „Eingeschränktes" ohne „Halteverbot".
  {
    raw: 'Eingeschränktes Halteverbot 7-19 Uhr Montag bis Freitag, Eingeschränktes 7-16 Uhr Samstag, sonst Mischparken',
    count: 1,
    windows: [],
  },

  // --- zusammengesetzte Halteverbote, mit und ohne Abendfenster
  {
    raw: 'Absolutes Halteverbot 6:30-8:30 Uhr und 16-19 Uhr, Eingeschränktes Halteverbot 8:30-16 Uhr, Mischparken 19-23 Uhr',
    count: 6,
    windows: [{ weekdays: MO_SA, from: 1140, to: 1380 }],
  },
  // Über Mitternacht (`19-6:30`) — und trotzdem kein Gebührenfenster, weil es
  // ein Halteverbot ist.
  {
    raw: 'Absolutes Halteverbot 6:30-8:30 Uhr und 16-19 Uhr, Eingeschränktes Halteverbot 8:30-16 Uhr und 19-6:30 Uhr',
    count: 12,
    windows: [],
  },
  { raw: 'Absolutes Halteverbot 9-19 Uhr, Taxiparken 19-9 Uhr', count: 1, windows: [] },
  {
    raw: 'Mischparken 9-17 Uhr Montag bis Freitag, Taxi 17-5 Uhr Montag bis Freitag, Mischparken 9-15 Uhr Samstag, Taxi 15-5 Uhr Samstag und Sonntag',
    count: 1,
    windows: [
      { weekdays: MO_FR, from: 540, to: 1020 },
      { weekdays: SA, from: 540, to: 900 },
    ],
  },

  // --- was das Modell nicht ausdrücken kann
  {
    raw: 'Absolutes Halteverbot 7-16 Uhr an Schultagen, Mischparken 16-23 Uhr und 9-23 Uhr an nicht Schultagen',
    count: 1,
    windows: [
      { weekdays: MO_SA, from: 960, to: 1380 },
      { weekdays: MO_SA, from: 540, to: 1380 },
    ],
    unmodelled: ['Regelung nur an Schultagen'],
  },
  {
    raw: 'Mischparken mit Parkscheibe 3h bis 19Uhr, Abends freies Parken',
    count: 1,
    windows: [],
    maxStay: 180,
    unmodelled: ['Zeitangabe ohne Anfang oder Ende'],
  },
]

describe('parseMuenchenRule — die Schreibweisen einzeln', () => {
  for (const expectation of RULES) {
    it(`liest ${JSON.stringify(expectation.raw.slice(0, 70))}`, () => {
      const rule = parseMuenchenRule(expectation.raw)
      expect(muenchenParkingWindows(rule)).toEqual(
        expectation.windows.map((window) => ({
          weekdays: window.weekdays,
          fromMinute: window.from,
          toMinute: window.to,
        }))
      )
      expect(muenchenMaxStay(rule)).toBe(expectation.maxStay)
      expect(rule.unmodelled).toEqual(expectation.unmodelled ?? [])
    })
  }

  // Die Zahlen in der Tabelle sind Behauptungen über den Abzug. Laufen sie
  // auseinander, ist entweder die Fixture erneuert oder die Tabelle falsch —
  // beides will man wissen, bevor man den Erwartungen glaubt.
  it('nennt für jede Schreibweise die Zahl, die im Abzug steht', () => {
    for (const expectation of RULES) {
      const entry = FIXTURE.regeln.find((rule) => rule.text === expectation.raw)
      expect(entry, expectation.raw).toBeDefined()
      expect(entry?.anzahl, expectation.raw).toBe(expectation.count)
    }
  })
})

describe('parseMuenchenRule — der ganze Abzug', () => {
  it('liest alle 291 Schreibweisen ohne Abbruch', () => {
    expect(FIXTURE.regeln).toHaveLength(291)
    for (const rule of FIXTURE.regeln) {
      expect(() => parseMuenchenRule(rule.text), rule.text).not.toThrow()
    }
  })

  it('deckt mit den 291 Texten alle bis auf einen Abschnitt ab', () => {
    const covered = FIXTURE.regeln.reduce((sum, rule) => sum + rule.anzahl, 0)
    expect(covered + FIXTURE.abschnitteOhneRegeltext).toBe(FIXTURE.abschnitteGesamt)
    // Genau eine Zeile führt gar keinen Regeltext. Wächst diese Zahl, ist es
    // kein Rundungsfehler, sondern eine Änderung an der Quelle.
    expect(FIXTURE.abschnitteOhneRegeltext).toBe(1)
  })

  it('gibt nur Fenster aus, die ein Tag und eine Spanne wirklich hergeben', () => {
    for (const rule of FIXTURE.regeln) {
      for (const window of muenchenParkingWindows(parseMuenchenRule(rule.text))) {
        expect(window.weekdays.length, rule.text).toBeGreaterThan(0)
        expect(new Set(window.weekdays).size, rule.text).toBe(window.weekdays.length)
        for (const day of window.weekdays) expect(day, rule.text).toBeGreaterThanOrEqual(0)
        for (const day of window.weekdays) expect(day, rule.text).toBeLessThanOrEqual(6)
        expect(window.fromMinute, rule.text).toBeGreaterThanOrEqual(0)
        expect(window.toMinute, rule.text).toBeLessThanOrEqual(1440)
        // Eine Spanne, die nicht nach ihrem Anfang endet, hiesse laut
        // `windowCovers` "nie" — die teuerste stille Antwort.
        expect(window.fromMinute, rule.text).toBeLessThan(window.toMinute)
      }
    }
  })

  /**
   * Der Test hinter der folgenreichsten Annahme dieses Parsers.
   *
   * Ohne Tagesangabe gilt Montag bis Samstag. Wäre die Vorgabe „alle sieben
   * Tage", verlangte die App in ganz München sonntags Gebühren; wäre sie
   * „Montag bis Freitag", ließe sie samstags 4.000 Abschnitte kostenlos
   * aussehen. Der Beleg steht im Feed selbst: Ein Sonntagsfenster entsteht nur
   * dort, wo der Text den Sonntag auch nennt.
   */
  it('legt ein Fenster nur auf den Sonntag, wenn der Text ihn nennt', () => {
    const namesSunday = /Sonntag|-So\b/
    for (const rule of FIXTURE.regeln) {
      const sunday = muenchenParkingWindows(parseMuenchenRule(rule.text)).some((window) =>
        window.weekdays.includes(0)
      )
      if (sunday) expect(rule.text, rule.text).toMatch(namesSunday)
    }
  })

  it('legt ein Fenster nur dann NICHT auf den Samstag, wenn der Text Tage nennt', () => {
    const namesDays = /Montag|Dienstag|Mittwoch|Donnerstag|Freitag|Samstag|Sonntag|Mo-|Fr-|samstags/
    for (const rule of FIXTURE.regeln) {
      const windows = muenchenParkingWindows(parseMuenchenRule(rule.text))
      if (windows.length === 0) continue
      const everyWindowSkipsSaturday = windows.every((window) => !window.weekdays.includes(6))
      if (everyWindowSkipsSaturday) expect(rule.text, rule.text).toMatch(namesDays)
    }
  })

  it('vergibt eine Höchstparkdauer nur, wo eine im Text steht', () => {
    for (const rule of FIXTURE.regeln) {
      const minutes = muenchenMaxStay(parseMuenchenRule(rule.text))
      if (minutes !== undefined) {
        expect(rule.text, rule.text).toMatch(/\d+(?:,\d)?\s*(?:h\b|Stunde)/)
        expect(minutes, rule.text).toBeGreaterThan(0)
        expect(minutes, rule.text).toBeLessThanOrEqual(24 * 60)
      }
    }
  })
})

describe('Regelgruppen', () => {
  it('nimmt sieben der achtzehn Gruppen auf', () => {
    expect(MUENCHEN_PARKING_GROUPS.size).toBe(7)
  })

  it('lässt die Gruppen ohne Parkbezug draußen', () => {
    for (const gruppe of [
      'Absolutes Halteverbot (0-24 Uhr)',
      'E-Parken',
      'Carsharing',
      'Behindertenparken',
      'Taxi',
      'Busparken',
      'Baustelle',
      'keine Regelung 0 - 24 Uhr',
      'Kraftfahrzeugparken allgemein',
    ]) {
      expect(isMuenchenParkingGroup(gruppe), gruppe).toBe(false)
    }
    expect(isMuenchenParkingGroup(null)).toBe(false)
    expect(isMuenchenParkingGroup(undefined)).toBe(false)
  })

  it('kennt jede Gruppe, die der Abzug führt', () => {
    // Kein Tippfehler in der Liste: Jede aufgenommene Gruppe muss auch
    // wirklich im Feed vorkommen, sonst filtert sie nichts.
    const inFeed = new Set(FIXTURE.regeln.map((rule) => rule.gruppe))
    for (const gruppe of MUENCHEN_PARKING_GROUPS) expect(inFeed.has(gruppe), gruppe).toBe(true)
  })

  it('lässt 5.256 der 13.714 Abschnitte draußen', () => {
    const kept = FIXTURE.regeln
      .filter((rule) => isMuenchenParkingGroup(rule.gruppe))
      .reduce((sum, rule) => sum + rule.anzahl, 0)
    expect(kept).toBe(8458)
    expect(FIXTURE.abschnitteGesamt - FIXTURE.abschnitteOhneRegeltext - kept).toBe(5255)
  })
})

describe('parseMuenchenRule — was abbrechen muss', () => {
  it('weist eine leere Angabe ab statt sie als "keine Regel" durchzulassen', () => {
    expect(() => parseMuenchenRule('')).toThrow(MuenchenParseError)
    expect(() => parseMuenchenRule('   ')).toThrow(MuenchenParseError)
    expect(() => parseMuenchenRule(null)).toThrow(MuenchenParseError)
    expect(() => parseMuenchenRule(undefined)).toThrow(MuenchenParseError)
  })

  it('begrenzt fremde Eingabe, bevor irgendetwas sie anfasst', () => {
    expect(() => parseMuenchenRule('Mischparken 9-23 Uhr '.repeat(40))).toThrow(/Zeichen/)
  })

  // Der eigentliche Punkt der Grammatik: Ein Rest, den niemand gelesen hat,
  // ist im Zweifel eine Regel, die niemand gesehen hat.
  it('bricht bei einem unbekannten Wort ab, statt es zu überlesen', () => {
    expect(() => parseMuenchenRule('Mischparken 9-23 Uhr, Anwohnerparken 18-23 Uhr')).toThrow(
      /nicht gelesen/
    )
    expect(() => parseMuenchenRule('Quatschparken 9-23 Uhr')).toThrow(/keine bekannte Regelart/)
  })

  it('bricht auch bei einem Rest am Ende ab', () => {
    expect(() => parseMuenchenRule('Mischparken 9-23 Uhr Vollmond')).toThrow(/nicht gelesen/)
  })

  it('bricht ab, wenn vor der ersten Regel etwas steht', () => {
    expect(() => parseMuenchenRule('Irgendwas Mischparken 9-23 Uhr')).toThrow(
      /vor der ersten Klausel/
    )
  })

  it('weist eine Uhrzeit ab, die keine ist', () => {
    expect(() => parseMuenchenRule('Mischparken 9-25 Uhr')).toThrow(/Uhrzeit/)
    expect(() => parseMuenchenRule('Mischparken 9:70-23 Uhr')).toThrow(/Uhrzeit/)
  })

  it('weist eine leere Spanne ab', () => {
    expect(() => parseMuenchenRule('Mischparken 9-9 Uhr')).toThrow(/leer/)
  })

  // Eine leere Wochentagsliste hiesse "nie gebührenpflichtig" — schweigen
  // wäre hier die teuerste Antwort.
  it('weist einen Widerspruch in der Tagesangabe ab', () => {
    expect(() => parseMuenchenRule('Mischparken 9-23 Uhr werktags Sonntag')).toThrow(/leer/)
  })
})

describe('über Mitternacht', () => {
  // Kommt im Abzug achtmal vor und in keiner Gebührenklausel — aber das ist
  // ein Befund von heute und keine Zusicherung der Quelle. Geprüft wird an
  // einer Taxiklausel, deren Fenster danach ohnehin verworfen werden.
  it('legt den zweiten Teil auf den Folgetag', () => {
    const rule = parseMuenchenRule('Taxi 15-5 Uhr Samstag')
    const taxi = rule.clauses[0]
    expect(taxi?.windows).toEqual([
      { weekdays: [6], fromMinute: 900, toMinute: 1440 },
      { weekdays: [0], fromMinute: 0, toMinute: 300 },
    ])
  })
})

describe('mergeMuenchenWindows', () => {
  it('wirft doppelte heraus und lässt die Reihenfolge stehen', () => {
    const window = { weekdays: MO_SA, fromMinute: 540, toMinute: 1380 }
    const other = { weekdays: SA, fromMinute: 540, toMinute: 1080 }
    expect(mergeMuenchenWindows([window, other, { ...window }])).toEqual([window, other])
  })

  // Aus 9-18 und 18-23 ein 9-23 zu machen hiesse, einem Teil des Gebiets fünf
  // Stunden anzudichten, die dort niemand verlangt.
  it('verschmilzt benachbarte Fenster NICHT', () => {
    const merged = mergeMuenchenWindows([
      { weekdays: MO_SA, fromMinute: 540, toMinute: 1080 },
      { weekdays: MO_SA, fromMinute: 1080, toMinute: 1380 },
    ])
    expect(merged).toHaveLength(2)
  })
})

describe('muenchenSpaces', () => {
  // Der Feed schreibt "5", nicht 5. Ein `typeof === 'number'` hätte hier still
  // null Plätze gezählt und jedes Gebiet mit 0 Stellplätzen ausgeliefert.
  it('liest die Zahl aus der Zeichenkette', () => {
    expect(muenchenSpaces('5')).toBe(5)
    expect(muenchenSpaces(' 114 ')).toBe(114)
  })

  it('macht aus fehlend, leer und Unfug eine Null statt eines Abbruchs', () => {
    expect(muenchenSpaces(null)).toBe(0)
    expect(muenchenSpaces(undefined)).toBe(0)
    expect(muenchenSpaces('')).toBe(0)
    expect(muenchenSpaces('viele')).toBe(0)
    expect(muenchenSpaces('-3')).toBe(0)
    expect(muenchenSpaces('2,5')).toBe(0)
    expect(muenchenSpaces('99999')).toBe(0)
  })
})

describe('muenchenMaxStayCode', () => {
  it('schreibt volle Stunden als Stunden und den Rest als Minuten', () => {
    expect(muenchenMaxStayCode(60)).toBe('1h')
    expect(muenchenMaxStayCode(240)).toBe('4h')
    expect(muenchenMaxStayCode(30)).toBe('30min')
    expect(muenchenMaxStayCode(20)).toBe('20min')
  })
})

describe('die Gebiete', () => {
  it('führt alle 82 als in Betrieb', () => {
    expect(FIXTURE.gebiete).toHaveLength(82)
    for (const zone of FIXTURE.gebiete) expect(isMuenchenZoneActive(zone)).toBe(true)
  })

  it('erkennt ein geplantes oder aufgehobenes Gebiet als nicht in Betrieb', () => {
    expect(isMuenchenZoneActive({ status: 'in Planung' })).toBe(false)
    expect(isMuenchenZoneActive({ status: null })).toBe(false)
    expect(isMuenchenZoneActive({})).toBe(false)
  })

  // Anders als in Berlin und Frankfurt ist die Kennung ein Name, keine Nummer.
  // Doppelte Namen wären hier fatal: Sie sind zugleich der Schlüssel, über den
  // die Straßenseiten ihrem Gebiet zugeordnet werden.
  it('vergibt 82 verschiedene, nicht leere Namen', () => {
    const labels = FIXTURE.gebiete.map(muenchenZoneLabel)
    expect(new Set(labels).size).toBe(82)
    expect(labels).not.toContain('?')
  })

  it('nennt zu jedem Gebiet Maßnahme und Überwachung', () => {
    for (const zone of FIXTURE.gebiete) {
      const note = muenchenZoneNote(zone)
      expect(note, zone.name ?? '').not.toBeNull()
      expect(note, zone.name ?? '').toContain('Überwachung: ')
    }
  })

  it('schreibt KVÜ aus, weil die Abkürzung außerhalb der Verwaltung niemand kennt', () => {
    expect(muenchenZoneNote({ massnahme: 'Lizenzgebiet in Betrieb', ueberwachung: 'KVÜ' })).toBe(
      'Lizenzgebiet in Betrieb · Überwachung: Kommunale Verkehrsüberwachung'
    )
  })

  // Die Adresse selbst wird nicht ausgegeben: Das Panel hat für einen Link
  // keine Stelle, und eine nackte URL im Fließtext ist keiner.
  it('nennt die Einzelübersicht, ohne die Adresse in den Text zu schreiben', () => {
    const note = muenchenZoneNote({
      massnahme: 'Lizenzgebiet in Betrieb',
      ueberwachung: 'Polizei',
      einzeluebersicht_link: 'https://muenchenunterwegs.de/downloads/Beispiel.pdf',
    })
    expect(note).toContain('Einzelübersicht')
    expect(note).not.toContain('https://')
  })

  it('gibt null zurück, wenn der Feed gar nichts sagt', () => {
    expect(muenchenZoneNote({})).toBeNull()
  })
})

/**
 * Feldtypen sind Behauptungen über eine JSON-Datei, und TypeScript prüft sie
 * nicht.
 *
 * In Frankfurt stand `bewohnerparkzone` als `string | null` im Interface und
 * ist im Feed eine Zahl; der Datenbau brach mit `claimed.trim is not a
 * function` ab. Hier wird dieselbe Annahme deshalb gegen echte Rohzeilen
 * gehalten, statt sie zu glauben.
 */
describe('die Rohzeilen der Straßenseiten', () => {
  const rows = FIXTURE.beispielAbschnitte as unknown as MuenchenSideProperties[]

  it('führt angebot als Zeichenkette oder null, nie als Zahl', () => {
    for (const row of rows) {
      expect(['string', 'undefined'], JSON.stringify(row)).toContain(
        row.angebot === null ? 'undefined' : typeof row.angebot
      )
    }
    expect(rows.some((row) => typeof row.angebot === 'string')).toBe(true)
    expect(rows.some((row) => row.angebot === null)).toBe(true)
  })

  it('führt prm_name und parkregel_beschreibung als Zeichenkette oder null', () => {
    for (const row of rows) {
      for (const value of [row.prm_name, row.parkregel_beschreibung, row.parkregel_gruppe]) {
        expect(value === null || typeof value === 'string', JSON.stringify(row)).toBe(true)
      }
    }
    expect(rows.some((row) => row.prm_name === null)).toBe(true)
    expect(rows.some((row) => row.parkregel_beschreibung === null)).toBe(true)
  })
})

/**
 * Was am Ende in der Zone ankommt.
 *
 * Der Parser allein sagt nichts über die Anzeige; erst `isChargeable`
 * verbindet Fenster, Wochentag und Feiertag zu der einen Antwort, für die es
 * diese App gibt.
 */
describe('eine Münchner Zone in der Zeit', () => {
  const zone: ParkingZone = {
    id: 'Glockenbachviertel',
    name: 'Glockenbachviertel',
    land: MUENCHEN.land,
    ...(MUENCHEN.holidays === undefined ? {} : { extraHolidays: MUENCHEN.holidays }),
    fee: { kind: 'unknown' },
    windows: muenchenParkingWindows(parseMuenchenRule('Mischparken 9-23 Uhr')),
  }

  it('kassiert werktags zwischen 9 und 23 Uhr', () => {
    // Dienstag, 8. September 2026, 10:00 Ortszeit.
    expect(isChargeable(zone, new Date('2026-09-08T08:00:00Z'))).toBe(true)
    // Derselbe Tag um 8 Uhr.
    expect(isChargeable(zone, new Date('2026-09-08T06:00:00Z'))).toBe(false)
  })

  it('kassiert samstags, weil der Feed den Samstag nennt, wo er Tage nennt', () => {
    // Samstag, 12. September 2026, 10:00 Ortszeit.
    expect(isChargeable(zone, new Date('2026-09-12T08:00:00Z'))).toBe(true)
  })

  it('kassiert sonntags nicht', () => {
    // Sonntag, 13. September 2026, 10:00 Ortszeit.
    expect(isChargeable(zone, new Date('2026-09-13T08:00:00Z'))).toBe(false)
  })

  /**
   * Der Feiertag, der nur in dieser Stadt gilt.
   *
   * Art. 1 Abs. 1 Nr. 2 BayFTG macht Mariä Himmelfahrt zum Feiertag „in
   * Gemeinden mit überwiegend katholischer Bevölkerung"; das Landesamt für
   * Statistik führt München mit ja, Nürnberg mit nein. Eine Zone, die nur
   * `land: 'BY'` kennt, verlangte am 15. August Gebühren.
   */
  it('ist an Mariä Himmelfahrt frei — dem Feiertag, den nur die Stadt kennt', () => {
    // Samstag, 15. August 2026, 10:00 Ortszeit. Ein Samstag, damit der Tag
    // nicht schon aus einem anderen Grund frei ist.
    expect(isChargeable(zone, new Date('2026-08-15T08:00:00Z'))).toBe(false)
    const withoutCityHoliday: ParkingZone = { ...zone }
    delete (withoutCityHoliday as { extraHolidays?: readonly string[] }).extraHolidays
    expect(isChargeable(withoutCityHoliday, new Date('2026-08-15T08:00:00Z'))).toBe(true)
  })

  it('ist an Fronleichnam frei, dem bayerischen Landesfeiertag', () => {
    // Donnerstag, 4. Juni 2026 — Ostern fiel auf den 5. April.
    expect(isChargeable(zone, new Date('2026-06-04T08:00:00Z'))).toBe(false)
  })
})

describe('parseMuenchenRule bei Unfug in der Dauer', () => {
  it('weist 0 h ab — das hiesse Parken verboten, nicht Parkscheibe', () => {
    expect(() => parseMuenchenRule('Parkscheibe 0 h')).toThrow(MuenchenParseError)
    expect(() => parseMuenchenRule('Mischparken 9-20 Uhr Montag bis Freitag mit Parkscheibe 0 h')).toThrow(MuenchenParseError)
  })

  it('begrenzt seine Eingabe genau bei der Grenze', () => {
    const gerade = 'Mischparken 9-20 Uhr Montag bis Freitag'.padEnd(400, ' ')
    expect(() => parseMuenchenRule(gerade)).not.toThrow()
    expect(() => parseMuenchenRule(`${gerade} `)).toThrow(MuenchenParseError)
  })
})
