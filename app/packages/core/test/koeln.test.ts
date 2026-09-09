import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import type { Weekday } from '../src/berlin-time.js'
import type { BoundingBox } from '../src/geo.js'
import { holidaysFor, type Land } from '../src/holidays.js'
import {
  KOELN_CSV_COLUMNS,
  KoelnParseError,
  koelnAutomatPosition,
  koelnMaxStayCode,
  koelnSpaces,
  koelnZoneLabel,
  koelnZoneNote,
  mergeKoelnWindows,
  parseKoelnAutomats,
  parseKoelnFee,
  parseKoelnMaxStay,
  parseKoelnSchedule,
  type KoelnZoneProperties,
} from '../src/koeln.js'
import { isChargeable, type ParkingZone } from '../src/tariff.js'

/**
 * Die echten Quellen, abgerufen am 8. September 2026.
 *
 * Wie bei den vier Städten davor: Fixtures sind der Feed, nicht ausgedachte
 * Beispiele. Bei Köln kommt dazu, dass die Sachauskunft aus einer **CSV**
 * stammt — deshalb steht in der Fixture nicht nur eine Auszählung, sondern ein
 * wörtlicher Auszug der Datei samt ihrer Anführungszeichen und ihrer CRLF.
 * Ausgedachte CSV-Zeilen sind immer die, die der Leser schon kann.
 */
interface PsaFixture {
  abgerufenAm: string
  quelle: string
  automatenGesamt: number
  automatenOhneKoordinate: number
  automatenAusserhalbKoeln: number
  gebuehrenzeiten: { text: string; anzahl: number }[]
  gebuehren: { text: string; anzahl: number }[]
  hoechstparkdauern: { text: string; anzahl: number }[]
  tagesgebuehr: { text: string; anzahl: number }[]
  csvAuszug: string
}

interface ZoneFixture {
  abgerufenAm: string
  quelle: string
  numberMatched: number
  gebiete: KoelnZoneProperties[]
  ersterStuetzpunktUtm: [number, number]
  ersterStuetzpunktGebiet: string
}

const PSA = JSON.parse(
  readFileSync(fileURLToPath(new URL('./fixtures/koeln-psa-2026-09-08.json', import.meta.url)), 'utf8')
) as PsaFixture

const ZONES = JSON.parse(
  readFileSync(
    fileURLToPath(new URL('./fixtures/koeln-gebiete-2026-09-08.json', import.meta.url)),
    'utf8'
  )
) as ZoneFixture

const MO_FR: readonly Weekday[] = [1, 2, 3, 4, 5]
const MO_SA: readonly Weekday[] = [1, 2, 3, 4, 5, 6]
const ALL: readonly Weekday[] = [0, 1, 2, 3, 4, 5, 6]
const SA: readonly Weekday[] = [6]

/** Der Rahmen, den `City.reportBounds` für Köln tragen soll. */
const KOELN_BOUNDS: BoundingBox = { minLon: 6.75, minLat: 50.82, maxLon: 7.18, maxLat: 51.1 }

interface Expectation {
  raw: string
  /** Wie oft der Abzug diese Schreibweise führt. */
  count: number
  windows: { weekdays: readonly Weekday[]; from: number; to: number }[]
  unmodelled?: string[]
}

/**
 * 14 der 46 Schreibweisen, einzeln mit dem Ergebnis, das sie haben müssen.
 *
 * Nicht „läuft durch, ohne zu werfen": Ein Parser, der
 * `Mo-Fr 09:00 - 21:00 + Sa 10:00 - 15:00` klaglos als **ein** Fenster von 9
 * bis 21 an sechs Tagen liest, wirft auch nicht — er lässt nur samstags eine
 * Stunde früher kassieren, als die Stadt es tut, und samstags um 21:30 sagt er
 * „gebührenpflichtig", wo längst niemand mehr kassiert.
 *
 * Ausgewählt sind die häufigsten und **alle** Sonderfälle: beide Bedeutungen
 * des `+`, das Semikolon, der Sonntag, die Fenster über Mitternacht, der
 * uneindeutige Beginn und das eine überzählige „Uhr".
 */
const SCHEDULES: readonly Expectation[] = [
  // --- die vier häufigsten, zusammen 1.515 Automaten
  { raw: 'Mo-Sa 09:00 - 23:00', count: 878, windows: [{ weekdays: MO_SA, from: 540, to: 1380 }] },
  { raw: 'Mo-Sa 09:00 - 18:00', count: 338, windows: [{ weekdays: MO_SA, from: 540, to: 1080 }] },
  {
    // Über Mitternacht, und mit 159 Automaten kein Randfall.
    raw: 'Mo-Sa 09:00 - 01:00',
    count: 159,
    windows: [
      { weekdays: MO_SA, from: 540, to: 1440 },
      { weekdays: [0, 2, 3, 4, 5, 6], from: 0, to: 60 },
    ],
  },
  { raw: 'Mo-Sa 09:00 - 21:00', count: 140, windows: [{ weekdays: MO_SA, from: 540, to: 1260 }] },

  // --- `+` als Trenner zweier vollständiger Klauseln
  {
    raw: 'Mo-Fr 09:00 - 21:00 + Sa 10:00 - 15:00',
    count: 139,
    windows: [
      { weekdays: MO_FR, from: 540, to: 1260 },
      { weekdays: SA, from: 600, to: 900 },
    ],
  },
  {
    raw: 'Mo-Fr 11:00 - 21:00 + Sa 10:00 - 15:00',
    count: 56,
    windows: [
      { weekdays: MO_FR, from: 660, to: 1260 },
      { weekdays: SA, from: 600, to: 900 },
    ],
  },

  // --- der Sonntag, ausgeschrieben und ernst gemeint
  { raw: 'Mo-So 09:00 - 23:00', count: 68, windows: [{ weekdays: ALL, from: 540, to: 1380 }] },
  {
    raw: 'Mo-So 09:00 - 01:00',
    count: 1,
    windows: [
      { weekdays: ALL, from: 540, to: 1440 },
      { weekdays: ALL, from: 0, to: 60 },
    ],
  },

  // --- `+` als Verbinder zweier Wochentage, im selben Wert wie `;` als Trenner
  {
    raw: 'Mo-Mi+Fr 09:00 - 20:00; Do + Sa 15:00 - 20:00',
    count: 3,
    windows: [
      { weekdays: [1, 2, 3, 5], from: 540, to: 1200 },
      { weekdays: [4, 6], from: 900, to: 1200 },
    ],
  },
  // Der schwierigste Wert des Abzugs: `+` bedeutet hier beides, in einer Zeile.
  {
    raw: 'Mo-Mi+Fr 09:00 - 18:00; Do 14:00 - 18:00 + Sa 09:00 - 14:00',
    count: 2,
    windows: [
      { weekdays: [1, 2, 3, 5], from: 540, to: 1080 },
      { weekdays: [4], from: 840, to: 1080 },
      { weekdays: SA, from: 540, to: 840 },
    ],
  },
  {
    raw: 'Mo-Di+Do-Fr 09:00 - 20:00; Mi+Sa 14:00 - 20:00',
    count: 1,
    windows: [
      { weekdays: [1, 2, 4, 5], from: 540, to: 1200 },
      { weekdays: [3, 6], from: 840, to: 1200 },
    ],
  },
  // `;` trennt auch ohne `+` daneben.
  {
    raw: 'Mo-Fr 09:00 - 18:00; Sa 09:00 - 14:00',
    count: 1,
    windows: [
      { weekdays: MO_FR, from: 540, to: 1080 },
      { weekdays: SA, from: 540, to: 840 },
    ],
  },

  // --- das eine überzählige „Uhr" in 2.315 Zeilen
  {
    raw: 'Mo-Fr 09:00 - 21:00 + Sa 09:00 - 13:00 Uhr',
    count: 1,
    windows: [
      { weekdays: MO_FR, from: 540, to: 1260 },
      { weekdays: SA, from: 540, to: 780 },
    ],
  },

  // --- der uneindeutige Beginn: kein Fenster, dafür ein Vermerk
  {
    raw: 'Mo-Sa 12:00/18:00 - 20:00',
    count: 4,
    windows: [],
    unmodelled: ['Beginn laut Quelle uneindeutig: 12:00/18:00 Uhr'],
  },
]

describe('parseKoelnSchedule', () => {
  for (const expectation of SCHEDULES) {
    it(`liest ${JSON.stringify(expectation.raw)}`, () => {
      const schedule = parseKoelnSchedule(expectation.raw)
      expect(schedule.windows).toEqual(
        expectation.windows.map((window) => ({
          weekdays: window.weekdays,
          fromMinute: window.from,
          toMinute: window.to,
        }))
      )
      expect(schedule.unmodelled).toEqual(expectation.unmodelled ?? [])
    })
  }

  it('deckt mit den Erwartungen oben die Schreibweisen ab, die es wirklich gibt', () => {
    // Ein Test gegen einen erfundenen Wert prüft den Parser, nicht die Quelle.
    const inFeed = new Map(PSA.gebuehrenzeiten.map((entry) => [entry.text, entry.anzahl]))
    for (const expectation of SCHEDULES) {
      expect(inFeed.get(expectation.raw), expectation.raw).toBe(expectation.count)
    }
  })

  it('liest alle 46 Schreibweisen des Abzugs', () => {
    expect(PSA.gebuehrenzeiten).toHaveLength(46)
    for (const entry of PSA.gebuehrenzeiten) {
      expect(() => parseKoelnSchedule(entry.text), entry.text).not.toThrow()
    }
  })

  /**
   * Der Test hinter der Annahme, die dieser Parser **nicht** trifft.
   *
   * München muss raten, welche Tage gelten, wenn der Text schweigt — 3.909
   * Abschnitte tun das. Köln schweigt nie: Jeder der 46 Werte beginnt mit
   * einer Tagesangabe. Deshalb hat dieser Parser keine Vorgabe, und dieser
   * Test hält fest, dass er auch keine braucht.
   */
  it('nennt in jeder Schreibweise Wochentage, also gibt es nichts anzunehmen', () => {
    for (const entry of PSA.gebuehrenzeiten) {
      expect(entry.text, entry.text).toMatch(/^(?:Mo|Di|Mi|Do|Fr|Sa|So)/)
    }
  })

  /**
   * Sonntag kostet in Köln wirklich Geld — aber nur, wo die Quelle ihn nennt.
   *
   * 87 Automaten tragen `Mo-So`, und sie stehen dort, wo die Stadt selbst die
   * Ausnahme beschreibt: in Deutz (LANXESS arena), an der Zoobrücke und auf
   * der Riehler Straße (Zoo und Flora). Ein Sonntagsfenster ohne `So` im Text
   * wäre der teuerste stille Fehler dieses Parsers.
   */
  it('legt ein Fenster nur auf den Sonntag, wenn der Text ihn nennt', () => {
    for (const entry of PSA.gebuehrenzeiten) {
      const schedule = parseKoelnSchedule(entry.text)
      const sunday = schedule.windows.some(
        // Ein Fenster, das um Mitternacht in den Sonntag läuft, zählt nicht:
        // Es entsteht aus dem Samstagabend, nicht aus einer Sonntagsregel.
        (window) => window.weekdays.includes(0) && window.fromMinute > 0
      )
      if (sunday) expect(entry.text, entry.text).toContain('So')
    }
  })

  it('bleibt in jedem Fenster innerhalb eines Tages', () => {
    for (const entry of PSA.gebuehrenzeiten) {
      for (const window of parseKoelnSchedule(entry.text).windows) {
        expect(window.fromMinute, entry.text).toBeGreaterThanOrEqual(0)
        expect(window.toMinute, entry.text).toBeLessThanOrEqual(1440)
        expect(window.fromMinute, entry.text).toBeLessThan(window.toMinute)
        expect(window.weekdays.length, entry.text).toBeGreaterThan(0)
      }
    }
  })

  it('normalisiert Leerraum, statt an ihm zu scheitern', () => {
    expect(parseKoelnSchedule('  Mo-Sa   09:00  -  23:00 ').raw).toBe('Mo-Sa 09:00 - 23:00')
  })
})

/**
 * Das `+` ist in diesem Feed **zweierlei**, und das ist die eine Stelle, an
 * der er nicht trivial ist.
 *
 * Wer es fest als Trenner liest, macht aus `Mo-Mi+Fr 09:00 - 20:00` zwei
 * Klauseln ohne Zeit und ohne Tage; wer es fest als Tagesverbinder liest,
 * hängt `Sa 10:00 - 15:00` an dieselbe Spanne wie `Mo-Fr 09:00 - 21:00`.
 * Beide Fehler stehen hier nebeneinander.
 */
describe('das doppeldeutige Plus', () => {
  it('trennt, wenn die laufende Klausel ihre Spanne schon hat', () => {
    const schedule = parseKoelnSchedule('Mo-Fr 09:00 - 21:00 + Sa 10:00 - 15:00')
    expect(schedule.windows).toHaveLength(2)
    expect(schedule.windows[0]?.weekdays).toEqual(MO_FR)
    expect(schedule.windows[1]?.weekdays).toEqual(SA)
    expect(schedule.windows[1]?.fromMinute).toBe(600)
  })

  it('verbindet, solange die Klausel noch keine Spanne hat', () => {
    const schedule = parseKoelnSchedule('Mo-Mi+Fr 09:00 - 20:00')
    expect(schedule.windows).toEqual([{ weekdays: [1, 2, 3, 5], fromMinute: 540, toMinute: 1200 }])
  })

  it('lässt einen Tag nach vollständiger Spanne eine neue Klausel beginnen', () => {
    // `Mo-Fr 09:00 - 18:00; Sa 09:00 - 14:00` kommt ohne `+` aus — der Tag
    // allein muss den Schnitt setzen, sonst hinge Samstag an der ersten
    // Spanne.
    const schedule = parseKoelnSchedule('Mo-Fr 09:00 - 18:00 Sa 09:00 - 14:00')
    expect(schedule.windows).toHaveLength(2)
    expect(schedule.windows[1]).toEqual({ weekdays: SA, fromMinute: 540, toMinute: 840 })
  })
})

describe('über Mitternacht', () => {
  /**
   * 163 Automaten schließen um 1 Uhr. Der zweite Teil gehört dem Folgetag —
   * bei `Mo-Sa` heißt das: auch Sonntag von 0 bis 1 Uhr. Beides in ein Fenster
   * zu schreiben hiesse laut `windowCovers` „nie".
   */
  it('legt den zweiten Teil auf den Folgetag', () => {
    expect(parseKoelnSchedule('Mo-Sa 19:00 - 01:00').windows).toEqual([
      { weekdays: MO_SA, fromMinute: 1140, toMinute: 1440 },
      { weekdays: [0, 2, 3, 4, 5, 6], fromMinute: 0, toMinute: 60 },
    ])
  })

  it('nimmt den Sonntagmorgen mit, obwohl der Text nur bis Samstag geht', () => {
    const sunday = parseKoelnSchedule('Mo-Sa 09:00 - 01:00').windows.find((window) =>
      window.weekdays.includes(0)
    )
    expect(sunday).toEqual({ weekdays: [0, 2, 3, 4, 5, 6], fromMinute: 0, toMinute: 60 })
  })
})

describe('parseKoelnSchedule — was abbrechen muss', () => {
  it('weist eine leere Angabe ab statt sie als "keine Gebührenzeit" durchzulassen', () => {
    expect(() => parseKoelnSchedule('')).toThrow(KoelnParseError)
    expect(() => parseKoelnSchedule('   ')).toThrow(KoelnParseError)
    expect(() => parseKoelnSchedule(null)).toThrow(KoelnParseError)
    expect(() => parseKoelnSchedule(undefined)).toThrow(KoelnParseError)
  })

  it('begrenzt fremde Eingabe, bevor irgendetwas sie anfasst', () => {
    expect(() => parseKoelnSchedule('Mo-Sa 09:00 - 23:00 + '.repeat(20))).toThrow(/Zeichen/)
  })

  // Der eigentliche Punkt: Ein Rest, den niemand gelesen hat, ist im Zweifel
  // eine Regel, die niemand gesehen hat.
  it('bricht bei einem unbekannten Wort ab, statt es zu überlesen', () => {
    expect(() => parseKoelnSchedule('werktags 09:00 - 23:00')).toThrow(/nicht gelesen/)
    expect(() => parseKoelnSchedule('Mo-Sa 09:00 - 23:00 ausser feiertags')).toThrow(
      /nicht gelesen/
    )
  })

  it('weist eine Uhrzeit ab, die keine ist', () => {
    expect(() => parseKoelnSchedule('Mo-Sa 25:00 - 23:00')).toThrow(/Uhrzeit/)
    expect(() => parseKoelnSchedule('Mo-Sa 09:70 - 23:00')).toThrow(/Uhrzeit/)
  })

  it('weist eine leere Spanne ab', () => {
    expect(() => parseKoelnSchedule('Mo-Sa 09:00 - 09:00')).toThrow(/leer/)
  })

  it('weist eine Spanne ohne Tag und einen Tag ohne Spanne ab', () => {
    expect(() => parseKoelnSchedule('09:00 - 23:00')).toThrow(/ohne Wochentag/)
    expect(() => parseKoelnSchedule('Mo-Sa')).toThrow(/ohne Zeitspanne/)
    expect(() => parseKoelnSchedule('Mo-Fr 09:00 - 18:00; Sa')).toThrow(/ohne Zeitspanne/)
  })

  it('weist eine halbe Spanne ab', () => {
    expect(() => parseKoelnSchedule('Mo-Sa 09:00 -')).toThrow(/keine Endzeit/)
    expect(() => parseKoelnSchedule('Mo-Sa 09:00 23:00')).toThrow(/kein Bindestrich/)
  })

  // Zwei Spannen ohne Trenner: Ohne diesen Abbruch fiele die zweite unter den
  // Tisch, und zwar leise — die erste stünde als einziges Fenster da.
  it('weist eine zweite Spanne ohne Trenner ab', () => {
    expect(() => parseKoelnSchedule('Mo-Sa 09:00 - 18:00 19:00 - 20:00')).toThrow(
      /zweite Spanne ohne Trenner/
    )
  })
})

describe('parseKoelnFee', () => {
  /**
   * Die Umrechnung, die der Spaltenname vorgibt: `Gebühr je 20 Minuten`.
   *
   * Der Wert wird bewusst nicht ausgeliefert — er ist veraltet, und die Datei
   * belegt das selbst. Getestet wird er trotzdem: Er ist der Schalter, den
   * jemand umlegt, sobald die Stadt die Datei fortschreibt.
   */
  it('rechnet 20 Minuten auf die Stunde hoch', () => {
    expect(parseKoelnFee('0,50 €')).toEqual({ kind: 'exact', centsPerHour: 150 })
    expect(parseKoelnFee('1,00 €')).toEqual({ kind: 'exact', centsPerHour: 300 })
    expect(parseKoelnFee('2,50 €')).toEqual({ kind: 'exact', centsPerHour: 750 })
  })

  it('kennt genau die zwei Beträge, die im Abzug stehen', () => {
    expect(PSA.gebuehren.map((entry) => entry.text)).toEqual(['0,50 €', '1,00 €'])
    for (const entry of PSA.gebuehren) {
      expect(parseKoelnFee(entry.text).kind, entry.text).toBe('exact')
    }
  })

  it('macht aus fehlend, leer und Strich ein "unbekannt" statt einer Null', () => {
    expect(parseKoelnFee(null)).toEqual({ kind: 'unknown' })
    expect(parseKoelnFee(undefined)).toEqual({ kind: 'unknown' })
    expect(parseKoelnFee('')).toEqual({ kind: 'unknown' })
    expect(parseKoelnFee('-')).toEqual({ kind: 'unknown' })
  })

  // Dieselbe Regel wie in Berlin, Hamburg und Frankfurt: `exact` mit 0 Cent
  // liefert `priced: true` und wäre der einzige Weg, ein „0,00 €" auf den
  // Schirm zu bringen.
  it('bricht bei einem Betrag von null ab', () => {
    expect(() => parseKoelnFee('0,00 €')).toThrow(/0,00/)
  })

  it('begrenzt fremde Eingabe, bevor irgendetwas sie anfasst', () => {
    expect(() => parseKoelnFee('0,50 € '.repeat(40))).toThrow(/Zeichen/)
  })

  it('weist alles ab, was kein Betrag ist', () => {
    expect(() => parseKoelnFee('kostenlos')).toThrow(KoelnParseError)
    expect(() => parseKoelnFee('0,50')).toThrow(KoelnParseError)
    expect(() => parseKoelnFee('0,50 Euro')).toThrow(KoelnParseError)
    expect(() => parseKoelnFee('€')).toThrow(KoelnParseError)
  })

  // 20 teilt 60 ohne Rest, die Umrechnung ist also exakt. Was passiert, wenn
  // die Stadt die Bezugsdauer ändert, fängt nicht dieser Parser, sondern die
  // Kopfprüfung: Die Dauer steht im Spaltennamen.
  it('rechnet ohne Rundung — 20 Minuten teilen die Stunde glatt', () => {
    expect(parseKoelnFee('0,33 €')).toEqual({ kind: 'exact', centsPerHour: 99 })
    expect(parseKoelnFee('0,01 €')).toEqual({ kind: 'exact', centsPerHour: 3 })
  })
})

describe('parseKoelnMaxStay', () => {
  it('liest die nackte Stundenzahl als Minuten', () => {
    expect(parseKoelnMaxStay('2')).toBe(120)
    expect(parseKoelnMaxStay('4')).toBe(240)
    expect(parseKoelnMaxStay(' 14 ')).toBe(840)
  })

  /**
   * Die vier Nullen im Abzug.
   *
   * Wie Hamburgs `9999` ein Platzhalter, dessen Bedeutung der Datensatz nicht
   * nennt. Als echte Null gelesen hiesse das „Höchstparkdauer 0 Minuten", also
   * Parken verboten — und das steht dort nicht: Alle vier Zeilen tragen eine
   * gewöhnliche Gebührenzeit und eine gewöhnliche Gebühr.
   */
  it('behandelt die Null als Platzhalter, nicht als Parkverbot', () => {
    expect(parseKoelnMaxStay('0')).toBeUndefined()
    const zeros = PSA.hoechstparkdauern.find((entry) => entry.text === '0')
    expect(zeros?.anzahl).toBe(4)
  })

  it('macht aus fehlend und leer ein "keine Angabe"', () => {
    expect(parseKoelnMaxStay(null)).toBeUndefined()
    expect(parseKoelnMaxStay(undefined)).toBeUndefined()
    expect(parseKoelnMaxStay('')).toBeUndefined()
  })

  it('liest jeden Wert des Abzugs', () => {
    expect(PSA.hoechstparkdauern).toHaveLength(12)
    for (const entry of PSA.hoechstparkdauern) {
      const minutes = parseKoelnMaxStay(entry.text)
      if (entry.text === '0') expect(minutes).toBeUndefined()
      else expect(minutes, entry.text).toBe(Number(entry.text) * 60)
    }
  })

  it('weist Unfug und unmögliche Dauern ab', () => {
    expect(() => parseKoelnMaxStay('vier')).toThrow(KoelnParseError)
    expect(() => parseKoelnMaxStay('2,5')).toThrow(KoelnParseError)
    expect(() => parseKoelnMaxStay('-1')).toThrow(KoelnParseError)
    expect(() => parseKoelnMaxStay('99')).toThrow(/Höchstparkdauer/)
  })
})

describe('koelnMaxStayCode', () => {
  it('schreibt volle Stunden als Stunden und den Rest als Minuten', () => {
    expect(koelnMaxStayCode(120)).toBe('2h')
    expect(koelnMaxStayCode(840)).toBe('14h')
    expect(koelnMaxStayCode(30)).toBe('30min')
  })
})

/**
 * Die CSV — und warum ein `split(';')` hier acht Zeilen zerstört.
 *
 * Sieben der 2.315 Zeilen tragen die Gebührenzeit in Anführungszeichen, weil
 * sie selbst ein Semikolon enthält; eine achte schreibt ein verdoppeltes
 * Anführungszeichen. Es sind ausgerechnet die interessantesten Werte des
 * ganzen Datensatzes, und ein naiver Leser zerlegt sie leise falsch: Aus einer
 * Gebührenzeit werden zwei Felder, alles dahinter rutscht um eins, und die
 * Koordinate landet in der Spalte der Höchstparkdauer.
 */
describe('parseKoelnAutomats', () => {
  const rows = parseKoelnAutomats(PSA.csvAuszug)

  it('liest jede Zeile des Auszugs', () => {
    expect(rows).toHaveLength(15)
    expect(rows[0]).toEqual({
      number: '1',
      location: 'Deutzer Freiheit 53',
      area: 'Deutz I',
      spaces: 10,
      rawHours: 'Mo-Sa 09:00 - 21:00',
      rawFee: '0,50 €',
      rawMaxStay: '2',
      dayRate: false,
      rawNorth: '50,93686078',
      rawEast: '6,97249396',
    })
  })

  it('hält ein Semikolon innerhalb von Anführungszeichen zusammen', () => {
    const liverpool = rows.find((row) => row.number === '5')
    expect(liverpool?.rawHours).toBe('Mo-Mi+Fr 09:00 - 20:00; Do + Sa 15:00 - 20:00')
    // Und die Felder dahinter sind nicht verrutscht.
    expect(liverpool?.rawFee).toBe('0,50 €')
    expect(liverpool?.rawMaxStay).toBe('4')
    expect(liverpool?.rawEast).toBe('6,898092')
  })

  it('liest ein verdoppeltes Anführungszeichen als eines', () => {
    // Zeile 1508, Feld `Abschnitt bis`: `"""Hagen""-Gelände"`. Die Spalte
    // selbst wird nicht ausgeliefert — aber wer sie falsch liest, verschiebt
    // alles dahinter.
    const hagen = rows.find((row) => row.number === '1508')
    expect(hagen?.rawHours).toBe('Mo-Fr 09:00 - 18:00')
    expect(hagen?.rawNorth).toBe('50,9320429')
  })

  it('kommt mit CRLF und mit einer leeren letzten Zeile zurecht', () => {
    expect(PSA.csvAuszug).toContain('\r\n')
    expect(parseKoelnAutomats(PSA.csvAuszug.replace(/\r\n/g, '\n'))).toHaveLength(15)
    expect(parseKoelnAutomats(`${PSA.csvAuszug}\r\n\r\n`)).toHaveLength(15)
  })

  it('übersetzt die Tagesgebühr in ein Ja oder Nein', () => {
    expect(rows.every((row) => row.dayRate === false)).toBe(true)
    const [header, first] = PSA.csvAuszug.split('\r\n')
    const withDayRate = (first as string).replace(';;50,93686078', ';JA;50,93686078')
    expect(parseKoelnAutomats(`${header as string}\r\n${withDayRate}\r\n`)[0]?.dayRate).toBe(true)
  })

  /**
   * Der Kopf wird geprüft, nicht geglaubt.
   *
   * Eine umbenannte Spalte ergäbe sonst überall den leeren Wert — und leer
   * heißt bei drei der vier Parsern „keine Angabe". Der Datenbau liefe durch
   * und lieferte 47 Gebiete ohne Zeiten aus, ohne Fehler und ohne Hinweis.
   * Dazu kommt: Die Bezugsdauer der Gebühr steht **im Spaltennamen**. Würde
   * daraus `Gebühr je 30 Minuten`, wäre jede Umrechnung falsch, und nichts am
   * Wert selbst verriete es.
   */
  it('bricht ab, wenn eine Spalte fehlt oder umbenannt wurde', () => {
    const broken = PSA.csvAuszug.replace('Gebühr je 20 Minuten', 'Gebühr je 30 Minuten')
    expect(() => parseKoelnAutomats(broken)).toThrow(/Gebühr je 20 Minuten/)
    expect(() => parseKoelnAutomats('')).toThrow(/leere Datei/)
  })

  it('bricht bei einer zu kurzen Zeile ab, statt sie zu verschieben', () => {
    const [header] = PSA.csvAuszug.split('\r\n')
    expect(() => parseKoelnAutomats(`${header as string}\r\n1;Musterweg\r\n`)).toThrow(/Feldern/)
  })

  it('begrenzt eine Datei aus fremder Hand — nach Länge und nach Zeilen', () => {
    expect(() => parseKoelnAutomats('x'.repeat(9 * 1024 * 1024))).toThrow(/Zeichen/)
    const [header, first] = PSA.csvAuszug.split('\r\n')
    const many = [header as string, ...Array.from({ length: 50_001 }, () => first as string)]
    expect(() => parseKoelnAutomats(`${many.join('\r\n')}\r\n`)).toThrow(/Zeilen/)
  })

  // Ein BOM steht heute nicht in der Datei. Käme er, wäre er Teil des ersten
  // Spaltennamens — die Kopfprüfung schlüge fehl, und die Meldung nennte einen
  // Namen, der auf dem Bildschirm richtig aussieht.
  it('überliest ein Byte-Order-Mark, statt daran zu scheitern', () => {
    expect(parseKoelnAutomats(`﻿${PSA.csvAuszug}`)).toHaveLength(15)
  })

  it('nennt genau die Spalten, auf die sich der Datenbau stützt', () => {
    for (const column of KOELN_CSV_COLUMNS) {
      expect(PSA.csvAuszug.split('\r\n')[0], column).toContain(column)
    }
  })
})

/**
 * Feldwerte sind Behauptungen über eine Datei, und ein Interface prüft sie
 * nicht.
 *
 * In Frankfurt stand `bewohnerparkzone` als `string | null` im Interface und
 * ist im Feed eine Zahl. Hier wird deshalb gegen den wörtlichen Auszug
 * geprüft, ob die Annahmen über die Spalten stimmen — statt sie zu glauben.
 */
describe('koelnAutomatPosition', () => {
  const rows = parseKoelnAutomats(PSA.csvAuszug)

  it('liest Nord als Breite und Ost als Länge — und gibt Länge zuerst zurück', () => {
    // Die Datei schreibt Breite vor Länge, GeoJSON umgekehrt. Wer das
    // verwechselt, legt Köln nach Somalia; beide Zahlen sind einstellig
    // plausibel, und die Karte sähe dabei nur leer aus.
    const position = koelnAutomatPosition(rows[0] as { rawNorth: string; rawEast: string }, KOELN_BOUNDS)
    expect(position).toEqual([6.97249396, 50.93686078])
  })

  it('gibt null zurück, wo die Datei keine Koordinate führt', () => {
    const empty = rows.find((row) => row.number === '167')
    expect(empty?.rawNorth).toBe('')
    expect(koelnAutomatPosition(empty as { rawNorth: string; rawEast: string }, KOELN_BOUNDS)).toBeNull()
  })

  /**
   * Die Reparatur, die nicht stattfindet.
   *
   * Zeile 2111 trägt `7008383` als Ostwert — das fehlende Dezimalkomma von
   * `7,008383`, und die Adresse (Graf-Adolf-Str. in Mülheim) macht die
   * Lesart geradezu offensichtlich. Sie ist trotzdem geraten. Ein Automat,
   * den man an einen plausiblen Ort repariert hat, trägt seine Zeiten in das
   * Gebiet, in dem er nach der Reparatur liegt.
   */
  it('verwirft eine unplausible Koordinate, statt sie zu reparieren', () => {
    const broken = rows.find((row) => row.number === '2111')
    expect(broken?.rawEast).toBe('7008383')
    expect(koelnAutomatPosition(broken as { rawNorth: string; rawEast: string }, KOELN_BOUNDS)).toBeNull()
  })

  it('verwirft, was außerhalb des Rahmens liegt oder keine Zahl ist', () => {
    for (const [north, east] of [
      ['90,94144', '6,9553'], // eine Ziffer daneben
      ['0,93180819', '6,91700844'], // führende Fünf fehlt
      ['50,3736', '6,9413'], // 60 km zu weit südlich
      ['50,94', 'sechs'],
      ['50.94', '6.95'], // Punkt statt Komma — die Datei benutzt das Komma
      ['', ''],
    ]) {
      expect(
        koelnAutomatPosition({ rawNorth: north as string, rawEast: east as string }, KOELN_BOUNDS),
        `${north as string}/${east as string}`
      ).toBeNull()
    }
  })

  it('zählt im Abzug 106 Zeilen ohne und 19 mit unbrauchbarer Koordinate', () => {
    // Zusammen 125 von 2.315, also 5,4 % — die Zahl, gegen die die Schranke
    // im Datenbau gesetzt ist.
    expect(PSA.automatenOhneKoordinate).toBe(106)
    expect(PSA.automatenAusserhalbKoeln).toBe(19)
    expect(PSA.automatenGesamt).toBe(2315)
  })
})

describe('koelnSpaces', () => {
  it('liest die Zahl aus der Zeichenkette', () => {
    expect(koelnSpaces('10')).toBe(10)
    expect(koelnSpaces(' 165 ')).toBe(165)
  })

  it('macht aus fehlend, leer und Unfug eine Null statt eines Abbruchs', () => {
    expect(koelnSpaces(null)).toBe(0)
    expect(koelnSpaces(undefined)).toBe(0)
    expect(koelnSpaces('')).toBe(0)
    expect(koelnSpaces('viele')).toBe(0)
    expect(koelnSpaces('-3')).toBe(0)
    expect(koelnSpaces('2,5')).toBe(0)
    expect(koelnSpaces('99999')).toBe(0)
  })
})

describe('mergeKoelnWindows', () => {
  it('wirft doppelte heraus und lässt die Reihenfolge stehen', () => {
    const window = { weekdays: MO_SA, fromMinute: 540, toMinute: 1380 }
    const other = { weekdays: SA, fromMinute: 540, toMinute: 960 }
    expect(mergeKoelnWindows([window, other, { ...window }])).toEqual([window, other])
  })

  // Aus 09:00-18:00 und 18:00-23:00 ein 09:00-23:00 zu machen hiesse, einem
  // Teil des Gebiets fünf Stunden anzudichten, die dort niemand verlangt.
  it('verschmilzt benachbarte Fenster NICHT', () => {
    expect(
      mergeKoelnWindows([
        { weekdays: MO_SA, fromMinute: 540, toMinute: 1080 },
        { weekdays: MO_SA, fromMinute: 1080, toMinute: 1380 },
      ])
    ).toHaveLength(2)
  })
})

describe('die Gebiete', () => {
  it('führt 47 Gebiete mit 47 verschiedenen Namen', () => {
    expect(ZONES.numberMatched).toBe(47)
    expect(ZONES.gebiete).toHaveLength(47)
    const labels = ZONES.gebiete.map(koelnZoneLabel)
    // Der Name ist zugleich der Schlüssel, unter dem das Gebiet ausgeliefert
    // wird. Zwei gleiche hiessen: eines verschwindet, und zwar lautlos.
    expect(new Set(labels).size).toBe(47)
    expect(labels).not.toContain('?')
  })

  it('gibt ein Fragezeichen aus, wo der Feed keinen Namen führt', () => {
    expect(koelnZoneLabel({})).toBe('?')
    expect(koelnZoneLabel({ Name: '  ' })).toBe('?')
  })

  it('nennt das Kürzel, weil es auf dem Automaten steht', () => {
    expect(koelnZoneNote({ Name: 'Belgisches Viertel', 'Abkürzung': 'BELG' })).toBe(
      'Kürzel auf dem Automaten: BELG'
    )
  })

  // `Deutz I` heißt auch in der Abkürzung `Deutz I` — das sagt nichts
  // Zusätzliches und gehört nicht ins Panel.
  it('lässt ein Kürzel weg, das nur der Name selbst ist', () => {
    expect(koelnZoneNote({ Name: 'Deutz I', 'Abkürzung': 'Deutz I' })).toBeNull()
  })

  // Das Panel hat für einen Link keine Stelle, und eine nackte URL im
  // Fließtext ist keiner.
  it('nennt die Gebietsseite, ohne die Adresse in den Text zu schreiben', () => {
    const note = koelnZoneNote({
      Name: 'Deutz I',
      'Abkürzung': 'Deutz I',
      Weitere_Informationen: 'https://www.stadt-koeln.de/artikel/03965/index.html',
    })
    expect(note).toBe('Gebietsseite bei stadt-koeln.de')
    expect(note).not.toContain('https://')
  })

  it('gibt null zurück, wenn der Feed gar nichts sagt', () => {
    expect(koelnZoneNote({})).toBeNull()
  })

  it('führt zu jedem Gebiet eine Adresse bei stadt-koeln.de', () => {
    for (const zone of ZONES.gebiete) {
      expect(zone.Weitere_Informationen, zone.Name ?? '').toMatch(/^https:\/\/www\.stadt-koeln\.de\//)
    }
  })

  /**
   * Der Beleg dafür, dass umgerechnet werden muss.
   *
   * Der erste Stützpunkt des ersten Gebiets steht in der Fixture so, wie der
   * Dienst ihn liefert: `[366433.216, 5638278.57]`. Das sind Meter in
   * EPSG:25832, und zwar auch dann, wenn man `srsName=EPSG:4326` anfragt —
   * der Dienst beschriftet die Geometrie dann mit 4326 und rechnet trotzdem
   * nicht um. Die Umrechnung steht in `packages/ingest/src/utm32.ts` und wird
   * dort gegen amtliche Punktpaare gemessen.
   */
  it('liefert die Geometrie in UTM-Metern, nicht in Grad', () => {
    const [easting, northing] = ZONES.ersterStuetzpunktUtm
    expect(easting).toBeGreaterThan(180)
    expect(northing).toBeGreaterThan(90)
    expect(ZONES.ersterStuetzpunktGebiet).toBe('Porz-Grengel')
  })
})

/**
 * Beschuss mit Unfug.
 *
 * Dieselbe Zusicherung, die `fuzz.test.ts` für die vier anderen Städte hält:
 * Bei beliebigen Zeichenketten wirft jeder Parser **nur** seine eigene
 * Fehlerklasse oder liefert ein gültiges Ergebnis. Wer `instanceof` prüft, um
 * „unlesbare Zeile" von „kaputtem Parser" zu unterscheiden, bekommt sonst für
 * genau eine Schreibweise die falsche Antwort — in Berlin war das
 * `parseSchedule("Fr-Mo 9-20 Uhr")`.
 */
describe('Beschuss', () => {
  const ALPHABET = 'MoDiMwFrSaSo0123456789:-+;/ Uhr€,.()äöüß\t\n"'

  function noise(seed: number): string {
    // Ein billiger, aber reproduzierbarer Zufall: derselbe Lauf erzeugt
    // dieselben Zeichenketten, also ist ein Fehlschlag nachstellbar.
    let state = seed * 2654435761
    let text = ''
    const length = (seed % 40) + 1
    for (let index = 0; index < length; index += 1) {
      state = (state * 1103515245 + 12345) & 0x7fffffff
      text += ALPHABET[state % ALPHABET.length]
    }
    return text
  }

  const inputs = [
    ...Array.from({ length: 2000 }, (_unused, seed) => noise(seed + 1)),
    ...PSA.gebuehrenzeiten.map((entry) => entry.text),
    ...PSA.gebuehren.map((entry) => entry.text),
    ...PSA.hoechstparkdauern.map((entry) => entry.text),
    '',
    ' ',
    'Mo-So',
    '00:00 - 00:00',
    ' ',
    '99:99 - 99:99',
  ]

  it('wirft aus parseKoelnSchedule nur KoelnParseError', () => {
    for (const input of inputs) {
      try {
        const schedule = parseKoelnSchedule(input)
        for (const window of schedule.windows) {
          expect(window.fromMinute, input).toBeLessThan(window.toMinute)
          expect(window.toMinute, input).toBeLessThanOrEqual(1440)
        }
      } catch (error) {
        expect(error, input).toBeInstanceOf(KoelnParseError)
      }
    }
  })

  it('wirft aus parseKoelnFee nur KoelnParseError — und nie einen Preis von null', () => {
    for (const input of inputs) {
      try {
        const fee = parseKoelnFee(input)
        if (fee.kind === 'exact') expect(fee.centsPerHour, input).toBeGreaterThan(0)
      } catch (error) {
        expect(error, input).toBeInstanceOf(KoelnParseError)
      }
    }
  })

  it('wirft aus parseKoelnMaxStay nur KoelnParseError', () => {
    for (const input of inputs) {
      try {
        const minutes = parseKoelnMaxStay(input)
        if (minutes !== undefined) {
          expect(minutes, input).toBeGreaterThan(0)
          expect(minutes, input).toBeLessThanOrEqual(24 * 60)
        }
      } catch (error) {
        expect(error, input).toBeInstanceOf(KoelnParseError)
      }
    }
  })

  it('wirft aus parseKoelnAutomats nur KoelnParseError', () => {
    for (const input of inputs) {
      try {
        parseKoelnAutomats(input)
      } catch (error) {
        expect(error, input).toBeInstanceOf(KoelnParseError)
      }
    }
  })
})

/**
 * Was am Ende in der Zone ankommt.
 *
 * Der Parser allein sagt nichts über die Anzeige; erst `isChargeable`
 * verbindet Fenster, Wochentag und Feiertag zu der einen Antwort, für die es
 * diese App gibt.
 */
describe('eine Kölner Zone in der Zeit', () => {
  /**
   * Das Bundesland steht hier als `HE`, und das ist ein Platzhalter.
   *
   * `holidaysFor` kennt heute nur BE, HH, HE und BY — Nordrhein-Westfalen
   * fehlt, und der Eintrag gehört nicht in diese Aufgabe (siehe
   * `docs/staedte-koeln.md`). Für die geprüften Septembertage ist der Kalender
   * gleichgültig; sobald `NW` in `holidays.ts` steht, gehört es hierher.
   * Hessen ist der nächste Verwandte: dieselben zehn Feiertage wie NRW, nur
   * ohne Allerheiligen.
   */
  const zone: ParkingZone = {
    id: 'Belgisches Viertel',
    name: 'Belgisches Viertel',
    land: 'NW',
    fee: { kind: 'unknown' },
    windows: parseKoelnSchedule('Mo-Sa 09:00 - 01:00').windows,
  }

  it('kassiert werktags von 9 Uhr an', () => {
    // Dienstag, 8. September 2026, 10:00 Ortszeit.
    expect(isChargeable(zone, new Date('2026-09-08T08:00:00Z'))).toBe(true)
    // Derselbe Tag um 8 Uhr.
    expect(isChargeable(zone, new Date('2026-09-08T06:00:00Z'))).toBe(false)
  })

  it('kassiert bis nach Mitternacht — und danach nicht mehr', () => {
    // Mittwoch, 9. September 2026, 00:30 Ortszeit: der Dienstagabend läuft
    // hinein.
    expect(isChargeable(zone, new Date('2026-09-08T22:30:00Z'))).toBe(true)
    // 01:30 Ortszeit.
    expect(isChargeable(zone, new Date('2026-09-08T23:30:00Z'))).toBe(false)
  })

  it('kassiert sonntags nur die Stunde, die aus dem Samstag stammt', () => {
    // Sonntag, 13. September 2026, 00:30 Ortszeit.
    expect(isChargeable(zone, new Date('2026-09-12T22:30:00Z'))).toBe(true)
    // Derselbe Sonntag, 10:00 Ortszeit.
    expect(isChargeable(zone, new Date('2026-09-13T08:00:00Z'))).toBe(false)
  })

  it('kassiert sonntags, wo die Quelle den Sonntag nennt', () => {
    const deutz: ParkingZone = {
      ...zone,
      id: 'Deutz I',
      name: 'Deutz I',
      windows: parseKoelnSchedule('Mo-So 09:00 - 23:00').windows,
    }
    expect(isChargeable(deutz, new Date('2026-09-13T08:00:00Z'))).toBe(true)
  })

  /**
   * Der Feiertagskalender für Nordrhein-Westfalen — seit dem 9. September
   * eingetragen, mit dem Wortlaut aus § 2 Abs. 1 des Feiertagsgesetzes NW als
   * Beleg in `holidays.ts`. Bis dahin stand hier der Stolperdraht, der das
   * Fehlen laut machte. Gehalten wird, was für eine Kölner Zone zählt: An
   * Fronleichnam und Allerheiligen wird nicht kassiert, am Frauentag schon.
   */
  it('kassiert an Fronleichnam nicht, am Berliner Frauentag aber sehr wohl', () => {
    const nw: ParkingZone = { ...zone, land: 'NW' }
    // Fronleichnam 2026: Donnerstag, 4. Juni, 12:00 Ortszeit.
    expect(isChargeable(nw, new Date('2026-06-04T10:00:00Z'))).toBe(false)
    // Allerheiligen 2026 ist ein Sonntag; 2027 ein Montag, 12:00 Ortszeit.
    expect(isChargeable(nw, new Date('2027-11-01T11:00:00Z'))).toBe(false)
    // Der 8. März 2027 ist ein Montag — Feiertag nur in Berlin.
    expect(isChargeable(nw, new Date('2027-03-08T11:00:00Z'))).toBe(true)
  })
})
