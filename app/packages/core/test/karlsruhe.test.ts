import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import type { PolygonRings, Position } from '../src/geo.js'
import { holidaysFor, type Land } from '../src/holidays.js'
import {
  KARLSRUHE_JOIN_RADIUS_M,
  KarlsruheParseError,
  isKarlsruheMachine,
  isKarlsruheMachineNearArea,
  karlsruheAreaLabel,
  karlsruheMaxStayCode,
  mergeKarlsruheFees,
  mergeKarlsruheWindows,
  parseKarlsruheFee,
  parseKarlsruheMaxStay,
  parseKarlsruheSchedule,
  type KarlsruheAreaProperties,
  type KarlsruheMachineProperties,
} from '../src/karlsruhe.js'
import { isChargeable, type ParkingZone } from '../src/tariff.js'

/**
 * Die echten Zeilen des Dienstes, abgerufen am 8. September 2026.
 *
 * Wie bei den vier anderen Städten: Fixtures sind der Feed, nicht ausgedachte
 * Beispiele. Ein Test, der eine Schreibweise prüft, die es nicht gibt, prüft
 * nichts.
 *
 * Bewusst **alle 638** Zeilen und nicht nur die 281 Karlsruher: Der Filter auf
 * `gemeinde` ist selbst eine Entscheidung, und ohne die übrigen 357 Zeilen —
 * darunter 73 französische aus Haguenau und Saverne — ließe sich nicht
 * zeigen, wovor er schützt.
 */
const MACHINES = JSON.parse(
  readFileSync(
    fileURLToPath(new URL('./fixtures/ka-parkscheinautomaten-2026-09-08.json', import.meta.url)),
    'utf8'
  )
) as KarlsruheMachineProperties[]

const AREAS = JSON.parse(
  readFileSync(
    fileURLToPath(new URL('./fixtures/ka-flaechen-2026-09-08.json', import.meta.url)),
    'utf8'
  )
) as KarlsruheAreaProperties[]

/**
 * Vier echte Stellplatzflächen mit Geometrie und die Automaten um sie herum.
 *
 * Ausgesucht, nicht gegriffen — jede trägt eine gemessene Eigenheit:
 * 130 und 271 haben einen **fremd betriebenen** Automaten als nächsten
 * Nachbarn (18 m bzw. 3 m), der nächste städtische steht 81 m bzw. 99 m
 * entfernt; 202 hat zwei Automaten, von denen nur einer eine Tagespauschale
 * nennt; 287 hat drei, darunter einen mit einem völlig anderen Fenster.
 */
const GEOMETRY = JSON.parse(
  readFileSync(
    fileURLToPath(new URL('./fixtures/ka-flaechen-geometrie-2026-09-08.json', import.meta.url)),
    'utf8'
  )
) as {
  flaechen: {
    id: number
    gemeinde: string
    geometry: { type: string; coordinates: number[][][] | number[][][][] }
  }[]
  automaten: (KarlsruheMachineProperties & { point: Position })[]
}

const KARLSRUHE_MACHINES = MACHINES.filter(isKarlsruheMachine)

function polygonsOf(geometry: {
  type: string
  coordinates: number[][][] | number[][][][]
}): PolygonRings[] {
  return geometry.type === 'Polygon'
    ? [geometry.coordinates as unknown as PolygonRings]
    : (geometry.coordinates as unknown as PolygonRings[])
}

function areaById(id: number): PolygonRings[] {
  const found = GEOMETRY.flaechen.find((area) => area.id === id)
  if (found === undefined) throw new Error(`Fläche ${id} fehlt in der Fixture`)
  return polygonsOf(found.geometry)
}

function machineByStandort(standort: string): KarlsruheMachineProperties & { point: Position } {
  const found = GEOMETRY.automaten.find((machine) => machine.standort === standort)
  if (found === undefined) throw new Error(`Automat ${standort} fehlt in der Fixture`)
  return found
}

describe('parseKarlsruheSchedule', () => {
  it('liest das schlichte Werktagsfenster', () => {
    expect(parseKarlsruheSchedule('werktags 8 bis 20 Uhr')).toEqual({
      windows: [{ weekdays: [1, 2, 3, 4, 5, 6], fromMinute: 480, toMinute: 1200 }],
      unmodelledRules: [],
    })
  })

  // Der teuerste mögliche Fehler in dieser Datei, und er wiegt hier schwerer
  // als in Hamburg: 229 der 278 Karlsruher Automaten tragen genau dieses Wort.
  // Als Mo-Fr gelesen meldete die App samstags über fast der ganzen Innenstadt
  // "gebührenfrei".
  it('zählt Samstag als Werktag', () => {
    const { windows } = parseKarlsruheSchedule('werktags 8 bis 20 Uhr')
    expect(windows[0]?.weekdays).toEqual([1, 2, 3, 4, 5, 6])
    expect(windows[0]?.weekdays).not.toContain(0)
  })

  it('bildet die Endstunde 24 auf Minute 1440 ab, nicht auf 0', () => {
    expect(parseKarlsruheSchedule('täglich 6 bis 24 Uhr').windows).toEqual([
      { weekdays: [0, 1, 2, 3, 4, 5, 6], fromMinute: 360, toMinute: 1440 },
    ])
  })

  // Elf Automaten am Hauptbahnhof und am Zoo schreiben das. Auf 0-0 abgebildet
  // hieße es "nie" — das genaue Gegenteil.
  it('liest „täglich 0 bis 24 Uhr" als den ganzen Tag und nicht als leeres Fenster', () => {
    expect(parseKarlsruheSchedule('täglich 0 bis 24 Uhr').windows).toEqual([
      { weekdays: [0, 1, 2, 3, 4, 5, 6], fromMinute: 0, toMinute: 1440 },
    ])
  })

  it('trennt zwei Klauseln am Semikolon', () => {
    expect(parseKarlsruheSchedule('Mo-Fr 9 bis 18 Uhr; Sa 9 bis 13 Uhr').windows).toEqual([
      { weekdays: [1, 2, 3, 4, 5], fromMinute: 540, toMinute: 1080 },
      { weekdays: [6], fromMinute: 540, toMinute: 780 },
    ])
  })

  /**
   * „Tagespauschale" ist kein Zeitfenster.
   *
   * Sie steht an 34 Karlsruher Automaten hinter einem Semikolon und sagt, dass
   * es neben dem Stundensatz eine Tageskarte gibt. Als Fenster gelesen ergäbe
   * sie Unsinn, weggeworfen verlöre die App eine Aussage der Quelle.
   */
  it('hebt die Tagespauschale als Zusatzregel heraus, statt sie als Fenster zu lesen', () => {
    const parsed = parseKarlsruheSchedule('werktags 8 bis 20 Uhr; Tagespauschale')
    expect(parsed.windows).toEqual([
      { weekdays: [1, 2, 3, 4, 5, 6], fromMinute: 480, toMinute: 1200 },
    ])
    expect(parsed.unmodelledRules).toEqual(['Tagespauschale'])
  })

  it('weist eine Zeile ab, die nur aus Zusätzen besteht', () => {
    expect(() => parseKarlsruheSchedule('Tagespauschale')).toThrow(/keine einzige Zeitangabe/)
  })

  // Positivliste statt "alles ohne Ziffern": Ein neues Wort im Feed soll den
  // Datenbau anhalten, damit jemand nachsieht, was es bedeutet.
  it('weist eine unbekannte Zusatzregel ab, statt sie zu schlucken', () => {
    expect(() => parseKarlsruheSchedule('werktags 8 bis 20 Uhr; Anwohner frei')).toThrow(
      KarlsruheParseError
    )
  })

  /**
   * Die Lehre aus München: `Fr` fand dort das „fr" in **free floating**.
   *
   * Hier kann das nicht passieren, weil die Tagesangabe von beiden Seiten
   * verankert geprüft wird — und genau das hält dieser Test fest. „Freitag"
   * ist keine Abkürzung des Feeds und wird abgewiesen, statt als `Fr` mit dem
   * Rest „eitag" gelesen zu werden.
   */
  it('liest „Freitag" nicht als das Kürzel „Fr"', () => {
    expect(() => parseKarlsruheSchedule('Freitag 8 bis 20 Uhr')).toThrow(/unbekannte Tagesangabe/)
  })

  it('weist Minutenangaben ab, statt eine Schreibweise zu erfinden', () => {
    for (const raw of ['werktags 8:30 bis 20 Uhr', 'werktags 8.30 bis 20 Uhr']) {
      expect(() => parseKarlsruheSchedule(raw)).toThrow(KarlsruheParseError)
    }
  })

  it('weist eine Spanne ab, die nicht nach ihrem Anfang endet', () => {
    expect(() => parseKarlsruheSchedule('täglich 20 bis 8 Uhr')).toThrow(
      /endet nicht nach ihrem Anfang/
    )
    expect(() => parseKarlsruheSchedule('täglich 9 bis 9 Uhr')).toThrow(
      /endet nicht nach ihrem Anfang/
    )
  })

  it('weist eine Stunde jenseits des Tages ab', () => {
    expect(() => parseKarlsruheSchedule('täglich 8 bis 25 Uhr')).toThrow(/Stunde über 24/)
  })

  it('weist alles ab, was es nicht kennt, statt zu raten', () => {
    for (const raw of ['', '   ', 'werktags 8 bis 20', 'immer', 'Mo-Sa 9-20 Uhr']) {
      expect(() => parseKarlsruheSchedule(raw)).toThrow(KarlsruheParseError)
    }
  })

  it('begrenzt seine Eingabe, wie die vier anderen Parser', () => {
    expect(() => parseKarlsruheSchedule('werktags 8 bis 20 Uhr'.padEnd(500, ' '))).toThrow(
      /Zeichen/
    )
  })

  it('liest jede Schreibweise, die der Karlsruher Feed wirklich trägt', () => {
    const values = new Set(
      KARLSRUHE_MACHINES.map((row) => row.parkzeit).filter(
        (value): value is string => typeof value === 'string'
      )
    )
    // Zehn, nicht elf: Die elfte Schreibweise ist `null` und gehört dem
    // Parkplatz P6, den `isKarlsruheMachine` schon aussortiert hat.
    expect(values.size).toBe(10)
    for (const value of values) {
      expect(() => parseKarlsruheSchedule(value), value).not.toThrow()
    }
  })

  /**
   * Der Beleg dafür, dass der `gemeinde`-Filter trägt.
   *
   * Ohne ihn liefe der Datenbau in 334 der 360 übrigen Zeilen auf eine
   * Schreibweise, die dieser Parser nicht kennt — `Du lundi au samedi 9h-12h
   * et 14h-19h` aus Haguenau, `9h-12h / 14h-19h` aus Saverne. 26 Zeilen aus
   * Ettlingen und Rastatt läsen sich sogar sauber und wären trotzdem falsch:
   * andere Stadt, anderes Preisniveau, derselbe Feiertagskalender nur zufällig.
   */
  it('scheitert an den Zeilen der anderen Gemeinden — dafür gibt es den Filter', () => {
    const others = MACHINES.filter((row) => !isKarlsruheMachine(row))
    expect(others).toHaveLength(360)
    let rejected = 0
    for (const row of others) {
      try {
        parseKarlsruheSchedule(row.parkzeit ?? '')
      } catch (error) {
        expect(error).toBeInstanceOf(KarlsruheParseError)
        rejected += 1
      }
    }
    expect(rejected).toBe(334)
  })
})

describe('parseKarlsruheFee', () => {
  /**
   * Die zwei Treppen, und warum sie der Grund für diesen Parser sind.
   *
   * **Beide fangen mit `= 1,50 €` an.** Die eine bei 30 Minuten, die andere
   * bei 15 — 3 €/h gegen 6 €/h. Wer die erste Zahl liest und sie für einen
   * Stundensatz hält, nennt 94 Automaten in der Tarifzone 1 den halben Preis.
   */
  it('liest die Treppe der Tarifzone 2 als 3,00 € je Stunde', () => {
    expect(
      parseKarlsruheFee('30 min = 1,50 €; 60 min = 3,00 €; 90 min = 4,50 €; 120 min = 6,00 €')
    ).toEqual({ kind: 'exact', centsPerHour: 300 })
  })

  it('liest dieselbe erste Zahl in der Tarifzone 1 als den doppelten Satz', () => {
    expect(
      parseKarlsruheFee('15 min = 1,50 €; 30 min = 3,00 €; 45 min = 4,50 €; 60 min = 6,00 €')
    ).toEqual({ kind: 'exact', centsPerHour: 600 })
  })

  it('übergeht die Tagespauschale bei der Rechnung', () => {
    expect(
      parseKarlsruheFee(
        '30 min = 1,50 €; 60 min = 3,00 €; 90 min = 4,50 €; 120 min = 6,00 €; Tagespauschale = 22,50 €'
      )
    ).toEqual({ kind: 'exact', centsPerHour: 300 })
  })

  /**
   * Zwei Automaten am Stadtgarten tragen nur eine Tagespauschale.
   *
   * 22,50 € durch 24 Stunden wären 0,94 € je Stunde — eine Zahl, die niemand
   * zahlt und die niemand geschrieben hat. „Unbekannt" heißt hier
   * „gebührenpflichtig, Satz nicht in der Quelle", dieselbe ehrliche Antwort
   * wie in ganz München.
   */
  it('meldet „unbekannt", wo nur eine Tagespauschale steht, statt sie umzurechnen', () => {
    expect(parseKarlsruheFee('Tagespauschale = 22,50 €')).toEqual({ kind: 'unknown' })
  })

  /**
   * Die Rastatter Treppe ist progressiv — und genau deshalb wird gerechnet.
   *
   * `15 min = 0,10 €` sind 0,40 €/h, `60 min = 0,80 €` sind 0,80 €/h. Es gibt
   * dort keinen Stundensatz; jeden einzelnen Wert daraus auszuliefern wäre
   * falsch. In Karlsruhe ist heute jede Treppe linear, aber ein Parser, der
   * das nicht prüft, verlässt sich darauf, dass es so bleibt.
   */
  it('weist eine progressive Treppe ab, statt einen ihrer Sätze zu wählen', () => {
    expect(() => parseKarlsruheFee('15 min = 0,10 €; 60 min = 0,80 €')).toThrow(/nicht linear/)
  })

  // Die Rastatter Zeile im Wortlaut. Sie bricht schon eine Stufe früher ab —
  // 0,50 € je 45 min ergeben 66,67 Cent je Stunde, also keinen ganzen Satz.
  // Beide Bremsen greifen also, und das ist Absicht: Wer nur auf Linearität
  // prüfte, ginge davon aus, dass jede einzelne Stufe für sich aufgeht.
  it('weist die Rastatter Zeile im Wortlaut ab', () => {
    expect(() =>
      parseKarlsruheFee('15 min = 0,10 €; 30 min = 0,20 €; 45 min = 0,50 €; 60 min = 0,80 €')
    ).toThrow(KarlsruheParseError)
  })

  /**
   * Ein Nullbetrag ist kein Tarif — dieselbe Begründung wie in Berlin,
   * Hamburg und Frankfurt. `exact` mit 0 Cent wäre `priced: true` und damit
   * der einzige Weg, an `CostEstimate.priced` vorbei ein „0,00 €" auf den
   * Schirm zu bringen.
   */
  it('weist einen Nullbetrag ab, statt kostenlos zu melden', () => {
    expect(() => parseKarlsruheFee('30 min = 0,00 €')).toThrow(/kein Tarif/)
    expect(() => parseKarlsruheFee('30 min = 1,50 €; 60 min = 0,00 €')).toThrow(/kein Tarif/)
  })

  it('weist eine Stufe über null Minuten ab', () => {
    expect(() => parseKarlsruheFee('0 min = 1,50 €')).toThrow(/0 Minuten sind keine Stufe/)
  })

  it('behandelt Strich, leere Zeichenkette und null als „nicht genannt"', () => {
    for (const raw of ['-', '', '   ', null, undefined]) {
      expect(parseKarlsruheFee(raw)).toEqual({ kind: 'unknown' })
    }
  })

  // 1,00 € je 7 min wären 857,14… Cent je Stunde. Zu runden hieße, einen
  // Preis zu nennen, den niemand geschrieben hat; der Befund gehört gemeldet.
  it('weist einen Satz ab, der keine ganzen Cent je Stunde ergibt', () => {
    expect(() => parseKarlsruheFee('7 min = 1,00 €')).toThrow(/ganzen Cent-Satz/)
  })

  it('weist eine Schreibweise ab, die keine Stufe ist', () => {
    for (const raw of ['3,00 €', '3 €/h', '3,00 € je Stunde', 'je 30 min = 0,25 €']) {
      expect(() => parseKarlsruheFee(raw)).toThrow(KarlsruheParseError)
    }
  })

  it('begrenzt auch die Gebührenangabe', () => {
    const long = '30 min = 1,50 €'.padEnd(200, ' ')
    try {
      parseKarlsruheFee(long)
      expect.unreachable('hätte werfen müssen')
    } catch (error) {
      expect(error).toBeInstanceOf(KarlsruheParseError)
      expect((error as KarlsruheParseError).raw).toHaveLength(40)
    }
  })

  it('liest jede Schreibweise, die der Karlsruher Feed wirklich trägt', () => {
    const values = new Set(KARLSRUHE_MACHINES.map((row) => row.gebuehren))
    // Fünf: zwei Treppen, zwei davon noch einmal mit Tagespauschale (15,00 €
    // bzw. 22,50 €), und eine Zeile, die nur die Tagespauschale nennt.
    expect(values.size).toBe(5)
    for (const value of values) {
      expect(() => parseKarlsruheFee(value), String(value)).not.toThrow()
    }
  })

  /**
   * Welche Sätze wirklich drinstehen, damit eine Gebührenänderung auffällt —
   * derselbe Test wie in Hamburg.
   */
  it('trägt genau zwei Sätze: 3,00 € und 6,00 € je Stunde', () => {
    const rates = new Set(
      KARLSRUHE_MACHINES.map((row) => parseKarlsruheFee(row.gebuehren))
        .filter((fee) => fee.kind === 'exact')
        .map((fee) => (fee as { centsPerHour: number }).centsPerHour)
    )
    expect([...rates].sort((a, b) => a - b)).toEqual([300, 600])
  })

  /**
   * Der Satz hängt an `tarifzone`, und zwar durchgehend.
   *
   * Nachgemessen, nicht angenommen: Kein Automat der Zone 1 nennt 3 €/h und
   * keiner der Zone 2 nennt 6 €/h. Damit ist die Tarifzone eine Kontrolle für
   * den Parser — läse er eine Treppe falsch, fiele dieser Test.
   */
  it('deckt sich mit der Tarifzone des Automaten', () => {
    const byZone = new Map<string, Set<number>>()
    for (const row of KARLSRUHE_MACHINES) {
      const fee = parseKarlsruheFee(row.gebuehren)
      if (fee.kind !== 'exact') continue
      const zone = row.tarifzone ?? '?'
      const set = byZone.get(zone) ?? new Set<number>()
      set.add(fee.centsPerHour)
      byZone.set(zone, set)
    }
    expect([...(byZone.get('1') ?? [])]).toEqual([600])
    expect([...(byZone.get('2') ?? [])]).toEqual([300])
  })
})

describe('parseKarlsruheMaxStay', () => {
  it('liest Stunden in den Schreibweisen des Feeds', () => {
    expect(parseKarlsruheMaxStay('1 Std.')).toBe(60)
    expect(parseKarlsruheMaxStay('2 Std.')).toBe(120)
    expect(parseKarlsruheMaxStay('24 h')).toBe(1440)
  })

  /**
   * In einer Endungs-Alternative steht die lange Endung vor der kurzen.
   *
   * `(?:Stunde|Stunden)` läse bei „2 Stunden" nur „Stunde" und ließe ein „n"
   * liegen — der Ausdruck ist verankert, also fiele die Zeile durch. Dreizehn
   * Münchner Abschnitte sind genau daran abgebrochen.
   */
  it('liest die lange Endung vor der kurzen', () => {
    expect(parseKarlsruheMaxStay('2 Stunden')).toBe(120)
    expect(parseKarlsruheMaxStay('1 Stunde')).toBe(60)
    expect(parseKarlsruheMaxStay('2 Std')).toBe(120)
  })

  it('behandelt leeres Feld, Strich und null als keine Grenze', () => {
    for (const raw of ['', '   ', '-', null, undefined]) {
      expect(parseKarlsruheMaxStay(raw)).toBeUndefined()
    }
  })

  /**
   * Vier Schreibweisen anderer Gemeinden, jede mit einer eigenen offenen
   * Frage: `1 Monat` (Bretten — was heißt das für eine App, die Stunden
   * zeigt?), `3h30` (Landau — halbe Stunden in einer Schreibweise, die
   * Karlsruhe nicht benutzt), `max. 3,50€` (ein **Betrag** im Dauerfeld) und
   * `im Bau` (gar keine Angabe). Sie werfen, statt geraten zu werden.
   */
  it('weist die Schreibweisen der anderen Gemeinden ab', () => {
    for (const raw of ['1 Monat', '3h30', 'max. 3,50€', 'im Bau', '2 Std. werktags']) {
      expect(() => parseKarlsruheMaxStay(raw), raw).toThrow(KarlsruheParseError)
    }
  })

  it('weist 0 Stunden ab — das hieße Parken verboten, und das steht dort nicht', () => {
    expect(() => parseKarlsruheMaxStay('0 Std.')).toThrow(/keine Höchstparkdauer/)
  })

  it('weist mehr als einen Tag ab', () => {
    expect(() => parseKarlsruheMaxStay('48 h')).toThrow(/keine Höchstparkdauer/)
  })

  it('liest jede Schreibweise, die der Karlsruher Feed wirklich trägt', () => {
    const values = new Set(KARLSRUHE_MACHINES.map((row) => row.max_parkdauer))
    expect(values.size).toBe(3)
    for (const value of values) {
      expect(() => parseKarlsruheMaxStay(value), String(value)).not.toThrow()
    }
    expect([...values].sort()).toEqual(['1 Std.', '2 Std.', '24 h'])
  })
})

describe('karlsruheMaxStayCode', () => {
  it('schreibt die Form, die `maxStayLabel` im Web versteht', () => {
    expect(karlsruheMaxStayCode(60)).toBe('1h')
    expect(karlsruheMaxStayCode(120)).toBe('2h')
    expect(karlsruheMaxStayCode(1440)).toBe('24h')
    expect(karlsruheMaxStayCode(90)).toBe('90min')
  })
})

describe('isKarlsruheMachine', () => {
  it('lässt 278 der 638 Zeilen übrig', () => {
    expect(MACHINES).toHaveLength(638)
    expect(KARLSRUHE_MACHINES).toHaveLength(278)
  })

  it('nimmt nur Zeilen, deren `gemeinde` Karlsruhe ist', () => {
    expect(new Set(KARLSRUHE_MACHINES.map((row) => row.gemeinde))).toEqual(new Set(['Karlsruhe']))
  })

  /**
   * Die drei fremd betriebenen Parkplätze.
   *
   * P4, P6 und P7 am Hauptbahnhof stehen unter `tarifzone` „0", tragen weder
   * Gebühr noch Höchstparkdauer und verweisen in der `bemerkung` auf
   * contipark.de bzw. parken-in-karlsruhe.de. Sie stehen **näher** an zwei
   * Stellplatzflächen als jeder städtische Automat; ohne diesen Filter erbte
   * die Fläche ihren leeren Tarif.
   */
  it('wirft die drei fremd betriebenen Parkplätze heraus', () => {
    const dropped = MACHINES.filter(
      (row) => row.gemeinde === 'Karlsruhe' && !isKarlsruheMachine(row)
    )
    expect(dropped).toHaveLength(3)
    for (const row of dropped) {
      expect(row.tarifzone).toBe('0')
      expect(row.gebuehren).toBeNull()
      expect(row.standort).toMatch(/^Parkplatz P[467]/)
    }
  })

  it('nimmt eine Zeile ohne `gemeinde` nicht an', () => {
    expect(isKarlsruheMachine({})).toBe(false)
    expect(isKarlsruheMachine({ gemeinde: null, tarifzone: '2' })).toBe(false)
    expect(isKarlsruheMachine({ gemeinde: 'karlsruhe', tarifzone: '2' })).toBe(false)
  })
})

/**
 * Formprobe gegen die Fixture, nicht nur gegen das Interface.
 *
 * Ein Feldtyp über einer JSON-Datei ist eine Behauptung, kein Beweis —
 * `FrankfurtAutomatProperties.bewohnerparkzone` stand als `string | null` da
 * und war im Feed eine Zahl. TypeScript prüft eine gelesene JSON-Datei nicht.
 */
describe('die Form des Karlsruher Feeds', () => {
  it('führt `tarifzone` als Zeichenkette, nicht als Zahl', () => {
    const types = new Set(MACHINES.map((row) => (row.tarifzone === null ? 'null' : typeof row.tarifzone)))
    expect(types).toEqual(new Set(['string', 'null']))
  })

  it('führt `stellplaetze` als Zahl, nicht als Zeichenkette', () => {
    expect(new Set(MACHINES.map((row) => typeof row.stellplaetze))).toEqual(new Set(['number']))
  })

  /**
   * Die Flächen tragen **nichts** außer Kennung, Gemeinde und Stand.
   *
   * Das ist die Eigenheit, die den ganzen Datenbau bestimmt, und sie steht
   * deshalb als Test da und nicht nur als Satz in einem Kommentar: Sobald die
   * Stadt ein Sachfeld ergänzt, fällt dieser Test, und der Abstands-Verschnitt
   * gehört dann noch einmal überdacht.
   */
  it('führt an den 282 Flächen kein einziges Sachdatum', () => {
    expect(AREAS).toHaveLength(282)
    const keys = new Set(AREAS.flatMap((area) => Object.keys(area)))
    expect([...keys].sort()).toEqual(['gemeinde', 'id', 'stand'])
    expect(new Set(AREAS.map((area) => area.gemeinde))).toEqual(new Set(['Karlsruhe']))
  })
})

describe('isKarlsruheMachineNearArea', () => {
  it('ordnet der Fläche den Automaten zu, der an ihr steht', () => {
    const area = areaById(287)
    const near = machineByStandort('Victor-Gollancz-Straße 4')
    expect(isKarlsruheMachineNearArea(area, near.point)).toBe(true)
  })

  /**
   * Der eigentliche Grund für den Filter auf `tarifzone`.
   *
   * An Fläche 271 steht der fremd betriebene Parkplatz P4 drei Meter entfernt,
   * der nächste städtische Automat 99 m. Wer nur „der nächste gewinnt" rechnet
   * und nicht filtert, gibt der Fläche den leeren Tarif eines fremden
   * Betreibers — und die App sagte „bewirtschaftet, Preis unbekannt", wo die
   * Stadt 3 € je Stunde nimmt.
   */
  it('erreicht an Fläche 271 nur den fremd betriebenen Automaten, keinen städtischen', () => {
    const area = areaById(271)
    const privateMachine = machineByStandort('Parkplatz P4 (Poststraße)')
    expect(isKarlsruheMachineNearArea(area, privateMachine.point)).toBe(true)
    expect(isKarlsruheMachine(privateMachine)).toBe(false)

    const municipal = GEOMETRY.automaten.filter(isKarlsruheMachine)
    expect(municipal.filter((machine) => isKarlsruheMachineNearArea(area, machine.point))).toEqual(
      []
    )
  })

  it('weist einen Automaten jenseits des Radius ab', () => {
    const area = areaById(202)
    const far = machineByStandort('Ettlinger Straße 5')
    expect(isKarlsruheMachineNearArea(area, far.point)).toBe(false)
    // Weit genug aufgemacht kommt er an — der Radius wirkt, er verhindert
    // nicht grundsätzlich einen Treffer.
    expect(isKarlsruheMachineNearArea(area, far.point, 100)).toBe(true)
  })

  /**
   * Zur Kante, nicht zum nächsten Stützpunkt.
   *
   * Karlsruhes Flächen haben im Median zwölf Stützpunkte, ihre längste Kante
   * misst 114 m. Ein Punkt in der Mitte einer solchen Kante wäre über die
   * Stützpunkte gerechnet 57 m entfernt und fiele durch — obwohl er die Fläche
   * berührt. Das Rechteck unten ist 200 m lang und hat nur vier Ecken; der
   * Punkt liegt fünf Meter neben seiner Mitte.
   */
  it('misst den Abstand zur Kante und nicht zum nächsten Stützpunkt', () => {
    const long: PolygonRings[] = [
      [
        [
          [8.4, 49.0],
          [8.4027, 49.0],
          [8.4027, 49.00009],
          [8.4, 49.00009],
          [8.4, 49.0],
        ],
      ],
    ]
    // Mitte der langen Südkante, rund fünf Meter darunter. Zur nächsten Ecke
    // sind es rund 100 m.
    const beside: Position = [8.40135, 48.999955]
    expect(isKarlsruheMachineNearArea(long, beside)).toBe(true)
  })

  it('nimmt eine Position ohne Zahlen nicht an, statt NaN zu vergleichen', () => {
    const area = areaById(287)
    expect(isKarlsruheMachineNearArea(area, [Number.NaN, 49])).toBe(false)
    expect(isKarlsruheMachineNearArea(area, [8.4, Number.POSITIVE_INFINITY])).toBe(false)
  })

  it('nimmt einen entarteten Ring hin, ohne zu werfen', () => {
    expect(isKarlsruheMachineNearArea([[[]]], [8.4, 49.0])).toBe(false)
    expect(isKarlsruheMachineNearArea([[[[8.4, 49.0]]]], [8.4, 49.0])).toBe(false)
    expect(isKarlsruheMachineNearArea([], [8.4, 49.0])).toBe(false)
  })

  it('hält den gemessenen Radius fest', () => {
    expect(KARLSRUHE_JOIN_RADIUS_M).toBe(20)
  })
})

describe('mergeKarlsruheFees', () => {
  it('macht aus gleichen Sätzen einen', () => {
    expect(
      mergeKarlsruheFees([
        { kind: 'exact', centsPerHour: 300 },
        { kind: 'exact', centsPerHour: 300 },
      ])
    ).toEqual({ kind: 'exact', centsPerHour: 300 })
  })

  // Die beiden Karlsruher Sätze nebeneinander. Auf einen zu reduzieren
  // verschätzte jemanden um 100 %.
  it('macht aus verschiedenen Sätzen eine Spanne', () => {
    expect(
      mergeKarlsruheFees([
        { kind: 'exact', centsPerHour: 300 },
        { kind: 'exact', centsPerHour: 600 },
      ])
    ).toEqual({ kind: 'range', minCentsPerHour: 300, maxCentsPerHour: 600 })
  })

  it('lässt einen Automaten ohne Betrag die Spanne nicht nach unten ziehen', () => {
    expect(
      mergeKarlsruheFees([{ kind: 'unknown' }, { kind: 'exact', centsPerHour: 300 }])
    ).toEqual({ kind: 'exact', centsPerHour: 300 })
  })

  it('bleibt unbekannt, wenn kein einziger Automat etwas sagt', () => {
    expect(mergeKarlsruheFees([{ kind: 'unknown' }, { kind: 'disc' }])).toEqual({
      kind: 'unknown',
    })
    expect(mergeKarlsruheFees([])).toEqual({ kind: 'unknown' })
  })
})

describe('mergeKarlsruheWindows', () => {
  it('wirft doppelte Fenster heraus und hält die Reihenfolge', () => {
    const a = { weekdays: [1, 2, 3, 4, 5, 6] as const, fromMinute: 480, toMinute: 1200 }
    const b = { weekdays: [0, 1, 2, 3, 4, 5, 6] as const, fromMinute: 360, toMinute: 1440 }
    expect(mergeKarlsruheWindows([a, b, { ...a }])).toEqual([a, b])
  })

  // Absichtlich NICHT verschmelzen: `8 bis 20` und `6 bis 24` als `6 bis 24`
  // auszugeben hieße, der halben Fläche vier Stunden Gebührenpflicht
  // anzudichten, die dort niemand verlangt.
  it('verschmilzt benachbarte Fenster nicht', () => {
    const merged = mergeKarlsruheWindows([
      { weekdays: [1, 2, 3, 4, 5, 6], fromMinute: 480, toMinute: 1200 },
      { weekdays: [1, 2, 3, 4, 5, 6], fromMinute: 360, toMinute: 1440 },
    ])
    expect(merged).toHaveLength(2)
  })
})

describe('karlsruheAreaLabel', () => {
  it('nimmt die Kennung, die die Quelle vergibt', () => {
    expect(karlsruheAreaLabel({ id: 287 })).toBe('287')
  })

  it('erfindet nichts, wo die Quelle nichts sagt', () => {
    expect(karlsruheAreaLabel({})).toBe('?')
    expect(karlsruheAreaLabel({ id: null })).toBe('?')
  })
})

/**
 * Die Parser dürfen nur ihre eigene Fehlerklasse werfen.
 *
 * Dieselbe Zusicherung, die `fuzz.test.ts` für die vier anderen Städte hält —
 * hier, weil `karlsruhe.ts` dort noch nicht eingetragen ist. Sie hat einen
 * Vorfall hinter sich: `parseSchedule("Fr-Mo 9-20 Uhr")` warf ein blankes
 * `Error`, weil `expandDays` die Rohzeile nicht kannte. Wer `instanceof`
 * prüft, um „unlesbare Zeile" von „kaputtem Parser" zu unterscheiden, bekam
 * für genau diese eine Schreibweise die falsche Antwort.
 */
describe('Beschuss der Karlsruher Parser mit Unfug', () => {
  const ALPHABET = [
    ...'0123456789 ;-=.,:€%\n\t',
    ...'abcdefghijklmnopqrstuvwxyzäöüß',
    ...'ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÜ',
    'werktags',
    'täglich',
    'Mo',
    'Fr',
    'Sa',
    'bis',
    'Uhr',
    'min',
    'Std.',
    'Stunden',
    'h',
    'Tagespauschale',
    'Tageskarte',
    '1,50',
    '0,00',
    '9999',
  ]

  /** Deterministisch, damit ein Fehlschlag reproduzierbar ist. */
  function pseudoRandom(seed: number): () => number {
    let state = seed >>> 0
    return () => {
      state = (state * 1_664_525 + 1_013_904_223) >>> 0
      return state / 0x1_0000_0000
    }
  }

  it('wirft ausschließlich KarlsruheParseError oder liefert ein gültiges Ergebnis', () => {
    const random = pseudoRandom(20_260_908)
    for (let round = 0; round < 4000; round += 1) {
      const parts: string[] = []
      const length = Math.floor(random() * 12)
      for (let i = 0; i < length; i += 1) {
        parts.push(ALPHABET[Math.floor(random() * ALPHABET.length)] as string)
      }
      const raw = parts.join('')

      for (const parse of [parseKarlsruheSchedule, parseKarlsruheFee, parseKarlsruheMaxStay]) {
        try {
          parse(raw)
        } catch (error) {
          expect(error, JSON.stringify(raw)).toBeInstanceOf(KarlsruheParseError)
        }
      }
    }
  })

  it('gibt aus jedem gültigen Ergebnis ein brauchbares Fenster zurück', () => {
    const random = pseudoRandom(4711)
    for (let round = 0; round < 4000; round += 1) {
      const parts: string[] = []
      const length = Math.floor(random() * 8)
      for (let i = 0; i < length; i += 1) {
        parts.push(ALPHABET[Math.floor(random() * ALPHABET.length)] as string)
      }
      const raw = parts.join('')
      let parsed
      try {
        parsed = parseKarlsruheSchedule(raw)
      } catch {
        continue
      }
      expect(parsed.windows.length, raw).toBeGreaterThan(0)
      for (const window of parsed.windows) {
        expect(window.weekdays.length, raw).toBeGreaterThan(0)
        expect(window.fromMinute, raw).toBeLessThan(window.toMinute)
        expect(window.toMinute, raw).toBeLessThanOrEqual(1440)
        expect(window.fromMinute, raw).toBeGreaterThanOrEqual(0)
      }
    }
  })

  it('liefert nie einen Nullbetrag als Gebühr', () => {
    const random = pseudoRandom(1234)
    for (let round = 0; round < 4000; round += 1) {
      const parts: string[] = []
      const length = Math.floor(random() * 10)
      for (let i = 0; i < length; i += 1) {
        parts.push(ALPHABET[Math.floor(random() * ALPHABET.length)] as string)
      }
      const raw = parts.join('')
      let fee
      try {
        fee = parseKarlsruheFee(raw)
      } catch {
        continue
      }
      if (fee.kind === 'exact') expect(fee.centsPerHour, raw).toBeGreaterThan(0)
      if (fee.kind === 'range') expect(fee.minCentsPerHour, raw).toBeGreaterThan(0)
    }
  })
})

/**
 * Eine Karlsruher Fläche im gemeinsamen Tarifmodell.
 *
 * **`land` steht hier auf `'BY'` und nicht auf `'BW'`, und das ist kein
 * Versehen.** `Land` in `holidays.ts` kennt Baden-Württemberg noch nicht, und
 * diese Aufgabe durfte die Datei nicht anfassen. Bayern steht stellvertretend,
 * weil beide Länder **denselben** Zusatzkalender haben: die neun bundesweiten
 * Feiertage plus Heilige Drei Könige, Fronleichnam und Allerheiligen — für
 * Baden-Württemberg § 1 Abs. 1 FTG BW und die Feiertagsseite des
 * Innenministeriums (<https://im.baden-wuerttemberg.de/de/service/feiertage>,
 * abgerufen am 8. September 2026), für Bayern Art. 1 Abs. 1 Nr. 1 BayFTG. Der
 * Unterschied liegt woanders: Bayerns Mariä Himmelfahrt gilt gemeindeweise und
 * hängt deshalb an `City.holidays`; Baden-Württemberg kennt keine solche
 * Regelung, Karlsruhe braucht also **kein** `holidays`-Feld.
 *
 * Der fertige `REGIONAL`-Eintrag steht in `docs/staedte-karlsruhe.md`.
 */
describe('eine Karlsruher Fläche im gemeinsamen Tarifmodell', () => {
  function zoneFrom(row: KarlsruheMachineProperties): ParkingZone {
    const parsed = parseKarlsruheSchedule(row.parkzeit as string)
    const maxStay = parseKarlsruheMaxStay(row.max_parkdauer)
    return {
      id: String(row.id ?? '?'),
      name: row.standort ?? '?',
      land: 'BW',
      fee: parseKarlsruheFee(row.gebuehren),
      windows: parsed.windows,
      unmodelledRules: parsed.unmodelledRules,
      ...(maxStay === undefined ? {} : { maxStayMinutes: maxStay }),
    }
  }

  // Samstag und Sonntag, 5. und 6. September 2026, 12:00 Berliner Zeit.
  const saturdayNoon = Date.UTC(2026, 8, 5, 10)
  const sundayNoon = Date.UTC(2026, 8, 6, 10)

  it('kassiert samstags, wo die Quelle „werktags" sagt, und sonntags nicht', () => {
    const zone = zoneFrom({
      standort: 'Kaiserstraße',
      parkzeit: 'werktags 8 bis 20 Uhr',
      gebuehren: '30 min = 1,50 €; 60 min = 3,00 €',
      max_parkdauer: '2 Std.',
    })
    expect(isChargeable(zone, saturdayNoon)).toBe(true)
    expect(isChargeable(zone, sundayNoon)).toBe(false)
  })

  it('kassiert auch sonntags, wo die Quelle „täglich" sagt', () => {
    const zone = zoneFrom({
      standort: 'Bahnhofplatz Süd 1',
      parkzeit: 'täglich 0 bis 24 Uhr',
      gebuehren: '30 min = 1,50 €; 60 min = 3,00 €',
      max_parkdauer: null,
    })
    expect(isChargeable(zone, sundayNoon)).toBe(true)
    // Und um drei Uhr nachts genauso — `0 bis 24` heißt wirklich immer.
    expect(isChargeable(zone, Date.UTC(2026, 8, 6, 1))).toBe(true)
  })

  /**
   * Eine Zusatzregel macht die Auskunft nicht unsicher.
   *
   * `isUncertainAt` sieht seit München nur noch auf Regeln, die den Advent
   * erwähnen. Ohne diese Änderung stünde über jeder Karlsruher Fläche mit
   * Tagespauschale an einem Adventssamstag „unsicher" — und in der Erklärung
   * ein Berliner Adventssamstag.
   */
  it('bleibt an einem Adventssamstag sicher, obwohl eine Zusatzregel dranhängt', () => {
    const zone = zoneFrom({
      standort: 'Ettlinger Straße 4',
      parkzeit: 'werktags 8 bis 20 Uhr; Tagespauschale',
      gebuehren: '30 min = 1,50 €; 60 min = 3,00 €; Tagespauschale = 22,50 €',
      max_parkdauer: '24 h',
    })
    expect(zone.unmodelledRules).toEqual(['Tagespauschale'])
    // Samstag, 5. Dezember 2026 — der zweite Advent ist der 6. Dezember.
    const adventSaturday = Date.UTC(2026, 11, 5, 11)
    expect(isChargeable(zone, adventSaturday)).toBe(true)
  })

  it('baut jeden Karlsruher Automaten des Feeds, ohne zu werfen', () => {
    const withHours = KARLSRUHE_MACHINES.filter((row) => typeof row.parkzeit === 'string')
    expect(withHours).toHaveLength(278)
    for (const row of withHours) {
      expect(() => zoneFrom(row), row.standort ?? '?').not.toThrow()
    }
  })

  /**
   * Der Kalender für Baden-Württemberg, gegen § 1 Abs. 1 FTG BW gehalten
   * (Beleg in `holidays.ts`). Bis zum 9. September stand hier ein
   * Stolperdraht, der das Fehlen des Eintrags laut machte; mit dem Anschalten
   * von Karlsruhe ist aus dem Draht die Messung geworden.
   */
  it('kennt die zwölf Feiertage Baden-Württembergs — und nicht den Reformationstag', () => {
    const land: Land = 'BW'
    const tage = holidaysFor(land, 2026)
    expect(tage.has('2026-01-06')).toBe(true) // Heilige Drei Könige
    expect(tage.has('2026-06-04')).toBe(true) // Fronleichnam, Ostersonntag 5. April + 60
    expect(tage.has('2026-11-01')).toBe(true) // Allerheiligen
    expect(tage.has('2026-10-31')).toBe(false) // Reformationstag: schulfrei, kein Feiertag
    expect(tage.has('2026-11-18')).toBe(false) // Buß- und Bettag: kirchlich, nicht arbeitsfrei
    expect(tage.has('2026-08-15')).toBe(false) // Mariä Himmelfahrt: nur in Bayern, gemeindeweise
    expect(tage.size).toBe(12)
  })
})
