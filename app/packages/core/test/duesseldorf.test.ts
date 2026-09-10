/**
 * Düsseldorf — gegen die echten Abzüge vom 8. September 2026.
 *
 * Nicht gegen ausgedachte Zeichenketten: Jede Behauptung über den Feed steht
 * hier als Prüfung gegen die Fixture, weil ein Interface über einer JSON-Datei
 * eine Behauptung ist und kein Beweis. Der Vorfall dahinter ist Frankfurts
 * `bewohnerparkzone`, das als `string | null` deklariert war und im Feed eine
 * Zahl ist.
 *
 * Die Fixtures sind Auszüge der beiden WFS-Ebenen ohne Geometrie — geprüft
 * wird das Zerlegen von Text, nicht das Zeichnen von Flächen.
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import {
  DuesseldorfParseError,
  duesseldorfExtraRules,
  duesseldorfMaxStayCode,
  duesseldorfZoneLabel,
  mergeDuesseldorfFees,
  mergeDuesseldorfWindows,
  parseDuesseldorfAutomatSchedule,
  parseDuesseldorfFee,
  parseDuesseldorfMaxStay,
  parseDuesseldorfSchedule,
  type DuesseldorfAutomatProperties,
  type DuesseldorfZoneProperties,
} from '../src/duesseldorf.js'
import { holidaysFor, type Land } from '../src/holidays.js'

const read = <T>(name: string): T =>
  JSON.parse(
    readFileSync(fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url)), 'utf8')
  ) as T

interface Census {
  wert: string | null
  anzahl: number
}

interface ZoneFixture {
  merkmale: number
  gebiete: number
  zeitraumWerte: Census[]
  zeilen: DuesseldorfZoneProperties[]
}

interface AutomatFixture {
  automaten: number
  tarifzeiten: Census[]
  tarifgebuehr: Census[]
  hoechstparkzeit: Census[]
  kartenzahlung_moeglich: Census[]
  zeilen: DuesseldorfAutomatProperties[]
}

const zones = read<ZoneFixture>('dus-bewohnerparken-2026-09-08.json')
const automats = read<AutomatFixture>('dus-parkscheinautomaten-2026-09-08.json')

/** `null` ist eine eigene Antwort, kein `object` — deshalb nicht `typeof`. */
function labelOf(value: unknown): string {
  if (value === null) return 'null'
  if (Array.isArray(value)) return 'array'
  return typeof value
}

function shapeOf(rows: readonly Record<string, unknown>[]): Record<string, string[]> {
  const fields = new Set<string>()
  for (const row of rows) for (const field of Object.keys(row)) fields.add(field)
  const observed: Record<string, string[]> = {}
  for (const field of [...fields].sort()) {
    const seen = new Set<string>()
    for (const row of rows) seen.add(field in row ? labelOf(row[field]) : 'absent')
    observed[field] = [...seen].sort()
  }
  return observed
}

describe('Fixture der Bewohnerparkgebiete', () => {
  it('führt 65 Merkmale für 44 Gebiete — die Identität ist das Kürzel, nicht die UUID', () => {
    expect(zones.zeilen).toHaveLength(65)
    expect(zones.merkmale).toBe(65)
    const kuerzel = new Set(zones.zeilen.map((row) => row.kuerzel))
    const uuids = new Set(zones.zeilen.map((row) => row._uuid))
    expect(kuerzel.size).toBe(44)
    expect(uuids.size).toBe(65)
    expect(zones.gebiete).toBe(44)
  })

  it('gibt allen Stücken eines Gebiets dieselben Sachdaten', () => {
    const byCode = new Map<string, Set<string>>()
    for (const row of zones.zeilen) {
      const code = String(row.kuerzel)
      const facts = JSON.stringify([row.name, row.zeitraum, row.url])
      byCode.set(code, (byCode.get(code) ?? new Set<string>()).add(facts))
    }
    const split = [...byCode.entries()].filter(([, facts]) => facts.size > 1)
    expect(split).toEqual([])
    // Elf Gebiete kommen in mehreren Stücken; wer auf `_uuid` gruppiert,
    // liefert 21 Doppelgänger mit demselben Namen aus.
    const multipart = [...byCode.keys()].filter(
      (code) => zones.zeilen.filter((row) => row.kuerzel === code).length > 1
    )
    expect(multipart).toHaveLength(11)
  })

  it('hat genau die Felder und Typen, die der Parser annimmt', () => {
    expect(shapeOf(zones.zeilen as unknown as Record<string, unknown>[])).toEqual({
      _last_update: ['string'],
      _uuid: ['string'],
      kuerzel: ['string'],
      name: ['string'],
      url: ['string'],
      zeitraum: ['string'],
    })
  })

  it('nennt zwölf Schreibweisen von zeitraum, und alle lassen sich lesen', () => {
    expect(zones.zeitraumWerte).toHaveLength(12)
    const summe = zones.zeitraumWerte.reduce((total, entry) => total + entry.anzahl, 0)
    expect(summe).toBe(65)
    for (const entry of zones.zeitraumWerte) {
      const text = entry.wert
      expect(text, 'kein zeitraum ist null im Abzug vom 8. September').not.toBeNull()
      const windows = parseDuesseldorfSchedule(text as string)
      expect(windows.length, text as string).toBeGreaterThan(0)
      for (const window of windows) {
        expect(window.weekdays.length).toBeGreaterThan(0)
        expect(window.fromMinute).toBeLessThan(window.toMinute)
        expect(window.toMinute).toBeLessThanOrEqual(1440)
      }
    }
  })

  /**
   * Der Beleg für „werktags = Montag bis Samstag", und er kommt aus dem Feed
   * selbst: Alle drei Tagesangaben stehen nebeneinander. Zwei Wörter für
   * dieselbe Menge wären eine Redundanz, die der Dienst sonst nirgends hat.
   */
  it('unterscheidet montags-bis-freitags, werktags und montags-bis-sonntags', () => {
    const texte = zones.zeitraumWerte.map((entry) => entry.wert ?? '')
    expect(texte.some((text) => text.startsWith('werktags'))).toBe(true)
    expect(texte.some((text) => text.startsWith('montags bis freitags'))).toBe(true)
    expect(texte.some((text) => text.startsWith('montags bis sonntags'))).toBe(true)
  })
})

describe('parseDuesseldorfSchedule', () => {
  it('liest werktags als Montag bis Samstag, ohne Sonntag', () => {
    expect(parseDuesseldorfSchedule('werktags, 9 bis 20 Uhr')).toEqual([
      { weekdays: [1, 2, 3, 4, 5, 6], fromMinute: 540, toMinute: 1200 },
    ])
  })

  it('liest 24 Stunden als 0 bis 1440 und nicht als „nie"', () => {
    expect(parseDuesseldorfSchedule('montags bis sonntags, 24 Stunden')).toEqual([
      { weekdays: [0, 1, 2, 3, 4, 5, 6], fromMinute: 0, toMinute: 1440 },
    ])
  })

  /**
   * Lichtenbroich, das Gebiet an der Arena: gebührenpflichtig **nur** sonntags.
   * Eine pauschale Sonntagsregel im Tarifmodell hätte hier unrecht — dieselbe
   * Lage wie Berlins Zone 29, nur andersherum.
   */
  it('macht aus sonntags einen Sonntag und nichts sonst', () => {
    expect(parseDuesseldorfSchedule('sonntags, 10 bis 17 Uhr')).toEqual([
      { weekdays: [0], fromMinute: 600, toMinute: 1020 },
    ])
  })

  it('trennt zwei Klauseln am Komma, in beiden Schreibweisen der Quelle', () => {
    const kurz = parseDuesseldorfSchedule('m bis fr, 8 bis 18 Uhr, sa 8 bis 14 Uhr')
    const lang = parseDuesseldorfSchedule(
      'montags bis freitags, 8 bis 18 Uhr, samstags, 8 bis 14 Uhr'
    )
    expect(kurz).toEqual([
      { weekdays: [1, 2, 3, 4, 5], fromMinute: 480, toMinute: 1080 },
      { weekdays: [6], fromMinute: 480, toMinute: 840 },
    ])
    // Der Dateiabzug vom 11. Dezember 2025 schrieb dieselbe Regel lang aus.
    // Beide Schreibweisen müssen dasselbe ergeben, sonst hinge die Aussage der
    // App daran, welchen Abzug jemand gerade gebaut hat.
    expect(lang).toEqual(kurz)
  })

  it('liest das Komma zwischen Tagesangabe und Spanne, nicht nur zwischen Klauseln', () => {
    // Wer stur an `,` splittet, bekommt hier zwei Bruchstücke, von denen das
    // eine keine Zeit und das andere keine Tage hat.
    expect(parseDuesseldorfSchedule('werktags, 9 bis 22 Uhr')).toHaveLength(1)
  })

  it('verwechselt kein Kürzel mit dem Anfang eines langen Wortes', () => {
    // Der Münchner Vorfall: `mi` fand das „mi" in „mit", `fr` das „fr" in
    // „free floating". Hier prüft es sich an den eigenen langen Formen.
    expect(parseDuesseldorfSchedule('mittwochs, 9 bis 20 Uhr')[0]?.weekdays).toEqual([3])
    expect(parseDuesseldorfSchedule('montags, 9 bis 20 Uhr')[0]?.weekdays).toEqual([1])
    expect(parseDuesseldorfSchedule('sonntags, 9 bis 20 Uhr')[0]?.weekdays).toEqual([0])
    expect(parseDuesseldorfSchedule('donnerstags, 9 bis 20 Uhr')[0]?.weekdays).toEqual([4])
  })

  it('lässt eine Ziffer direkt hinter dem Kürzel zu', () => {
    // `sa 8 bis 14 Uhr` hat zwischen Buchstabe und Ziffer nur ein Leerzeichen;
    // eine Wortgrenze `\b` wäre hier trotzdem richtig, `(?![\p{L}])` auch —
    // dieser Test hält fest, dass die Grenze keine Ziffer verbietet.
    expect(parseDuesseldorfSchedule('sa 8 bis 14 Uhr')[0]?.weekdays).toEqual([6])
  })

  it('schneidet den Teil hinter dem Schrägstrich ab, statt ihn zu raten', () => {
    const raw = 'werktags, 9 bis 20 Uhr / teils 9 bis 22 Uhr'
    expect(parseDuesseldorfSchedule(raw)).toEqual([
      { weekdays: [1, 2, 3, 4, 5, 6], fromMinute: 540, toMinute: 1200 },
    ])
    expect(duesseldorfExtraRules(raw)).toEqual(['teils 9 bis 22 Uhr'])
  })

  it('behandelt die alte Schreibweise mit Sternchen genauso', () => {
    const raw =
      'montags bis freitags, 9 bis 18 Uhr / teilweise montags bis sonntags, 9 bis 23 Uhr*'
    expect(parseDuesseldorfSchedule(raw)).toEqual([
      { weekdays: [1, 2, 3, 4, 5], fromMinute: 540, toMinute: 1080 },
    ])
    expect(duesseldorfExtraRules(raw)).toEqual([
      'teilweise montags bis sonntags, 9 bis 23 Uhr*',
    ])
  })

  it('kennt keine Zusatzregel ohne Schrägstrich', () => {
    expect(duesseldorfExtraRules('werktags, 9 bis 20 Uhr')).toEqual([])
    expect(duesseldorfExtraRules(null)).toEqual([])
    expect(duesseldorfExtraRules(undefined)).toEqual([])
    expect(duesseldorfExtraRules('werktags, 9 bis 20 Uhr /   ')).toEqual([])
  })

  it('weist zurück, was die Quelle so nicht schreibt', () => {
    const unfug = [
      '',
      '   ',
      'werktags',
      '9 bis 20 Uhr',
      'werktags, 9 bis 20',
      'werktags 09:00 - 20:00',
      'werktags, 22 bis 2 Uhr',
      'werktags, 9 bis 9 Uhr',
      'werktags, 9 bis 25 Uhr',
      'werktags, 9:70 bis 20 Uhr',
      'freitags, 9 bis 20 Uhr sonntags, 9 bis 12 Uhr',
      'mondays, 9 bis 20 Uhr',
      'a'.repeat(200),
    ]
    for (const text of unfug) {
      expect(() => parseDuesseldorfSchedule(text), text).toThrow(DuesseldorfParseError)
    }
  })

  /**
   * Dieselbe Zusicherung, die `fuzz.test.ts` für die anderen sieben Parser
   * hält: Bei beliebigen Zeichenketten wirft dieser Parser **nur** seine
   * eigene Fehlerklasse oder liefert ein gültiges Ergebnis. Ein blankes
   * `Error` hiesse „der Parser ist kaputt" und nicht „die Zeile ist unlesbar",
   * und wer `instanceof` prüft, bekäme die falsche Antwort.
   */
  it('wirft bei Unfug nur die eigene Fehlerklasse', () => {
    const zeichen = ' ,/-:0123456789abcmisofrtuhnwegäöü'
    let seed = 20260908
    const next = (): number => {
      seed = (seed * 1103515245 + 12345) % 2147483648
      return seed / 2147483648
    }
    for (let round = 0; round < 3000; round += 1) {
      const length = Math.floor(next() * 40)
      let text = ''
      for (let index = 0; index < length; index += 1) {
        text += zeichen[Math.floor(next() * zeichen.length)]
      }
      try {
        const windows = parseDuesseldorfSchedule(text)
        for (const window of windows) {
          expect(window.fromMinute).toBeLessThan(window.toMinute)
          expect(window.toMinute).toBeLessThanOrEqual(1440)
          expect(window.weekdays.length).toBeGreaterThan(0)
        }
      } catch (error) {
        expect(error, JSON.stringify(text)).toBeInstanceOf(DuesseldorfParseError)
      }
    }
  })
})

describe('Fixture der Parkscheinautomaten', () => {
  it('führt 732 Automaten mit drei Tarifzeiten und drei Beträgen', () => {
    expect(automats.automaten).toBe(732)
    expect(automats.tarifzeiten).toHaveLength(3)
    expect(automats.tarifgebuehr).toHaveLength(3)
    expect(automats.hoechstparkzeit).toHaveLength(2)
    expect(automats.tarifzeiten.reduce((sum, entry) => sum + entry.anzahl, 0)).toBe(732)
  })

  it('hat genau die Felder und Typen, die der Parser annimmt', () => {
    expect(shapeOf(automats.zeilen as unknown as Record<string, unknown>[])).toEqual({
      _last_update: ['string'],
      _uuid: ['string'],
      app_sms_zone: ['string'],
      email: ['string'],
      hoechstparkzeit: ['string'],
      kartenzahlung_moeglich: ['null', 'string'],
      psa_nr: ['string'],
      standort: ['string'],
      tarifgebuehr: ['string'],
      tarifzeiten: ['string'],
    })
  })

  it('führt psa_nr als Zeichenkette, nicht als Zahl', () => {
    // Der Frankfurter Vorfall in einem Satz: Ein Vergleich zwischen `19` und
    // `'19'` ist stillschweigend immer falsch.
    for (const row of automats.zeilen) expect(typeof row.psa_nr).toBe('string')
  })

  it('unterscheidet drei Zustände von kartenzahlung_moeglich', () => {
    // `ja`, leer und `null` sind nicht dasselbe, und was leer heisst, sagt der
    // Feed nicht — deshalb wird das Feld nirgends ausgewertet.
    const werte = automats.kartenzahlung_moeglich.map((entry) => entry.wert)
    expect(new Set(werte)).toEqual(new Set(['ja', '', null]))
  })

  it('liest alle drei Tarifzeiten', () => {
    for (const entry of automats.tarifzeiten) {
      const windows = parseDuesseldorfAutomatSchedule(entry.wert as string)
      expect(windows, entry.wert as string).toHaveLength(1)
    }
    expect(parseDuesseldorfAutomatSchedule('Werktags 09:00 - 22:00')).toEqual([
      { weekdays: [1, 2, 3, 4, 5, 6], fromMinute: 540, toMinute: 1320 },
    ])
    expect(parseDuesseldorfAutomatSchedule('Täglich 07:00 - 20:00')).toEqual([
      { weekdays: [0, 1, 2, 3, 4, 5, 6], fromMinute: 420, toMinute: 1200 },
    ])
  })

  it('nimmt die Schreibweise des Gebiets-Feldes nicht an, und umgekehrt', () => {
    // Zwei Notationen derselben Behörde, und keiner der beiden Parser darf die
    // andere durchwinken: Eine Schreibweise, die es nirgends gibt, hat auch
    // niemand geprüft.
    expect(() => parseDuesseldorfAutomatSchedule('werktags, 9 bis 20 Uhr')).toThrow(
      DuesseldorfParseError
    )
    expect(() => parseDuesseldorfSchedule('Werktags 09:00 - 20:00')).toThrow(
      DuesseldorfParseError
    )
  })

  it('weist unlesbare Tarifzeiten ab', () => {
    for (const text of ['', 'Werktags', '09:00 - 20:00', 'Werktags 09:00 - 09:00', 'x'.repeat(200)]) {
      expect(() => parseDuesseldorfAutomatSchedule(text), text).toThrow(DuesseldorfParseError)
    }
  })
})

describe('parseDuesseldorfFee', () => {
  it('liest die drei Beträge des Abzugs', () => {
    const cents = automats.tarifgebuehr.map((entry) => parseDuesseldorfFee(entry.wert))
    expect(cents).toEqual([
      { kind: 'exact', centsPerHour: 450 },
      { kind: 'exact', centsPerHour: 300 },
      { kind: 'exact', centsPerHour: 200 },
    ])
  })

  it('nennt kein Fehlen einen Preis von null', () => {
    expect(parseDuesseldorfFee(null)).toEqual({ kind: 'unknown' })
    expect(parseDuesseldorfFee(undefined)).toEqual({ kind: 'unknown' })
    expect(parseDuesseldorfFee('')).toEqual({ kind: 'unknown' })
    expect(parseDuesseldorfFee('-')).toEqual({ kind: 'unknown' })
  })

  it('bricht bei einem Nullbetrag ab', () => {
    // Der einzige Weg, an `CostEstimate.priced` vorbei ein „0,00 €" auf den
    // Schirm zu bringen. Alle fünf Gebührenparser halten es so.
    expect(() => parseDuesseldorfFee('0,00 € pro Stunde')).toThrow(DuesseldorfParseError)
  })

  it('weist fremde Schreibweisen ab', () => {
    for (const text of [
      '4,50 €',
      '4,50 € je Stunde',
      '4 €/h',
      '4,50 Euro pro Stunde',
      '4,5 € pro Stunde',
      'kostenlos',
    ]) {
      expect(() => parseDuesseldorfFee(text), text).toThrow(DuesseldorfParseError)
    }
  })
})

describe('parseDuesseldorfMaxStay', () => {
  it('liest „ohne" als keine Begrenzung, nicht als null Minuten', () => {
    // 558 der 732 Automaten tragen das Wort. Als 0 gelesen hiesse es „Parken
    // verboten", und das steht dort nicht.
    expect(parseDuesseldorfMaxStay('ohne')).toBeUndefined()
    expect(parseDuesseldorfMaxStay('2 h')).toBe(120)
  })

  it('liest beide Werte des Abzugs', () => {
    const werte = automats.hoechstparkzeit.map((entry) => parseDuesseldorfMaxStay(entry.wert))
    expect(new Set(werte)).toEqual(new Set([undefined, 120]))
  })

  it('bricht bei 0 h ab und bei allem, was keine Stundenangabe ist', () => {
    expect(() => parseDuesseldorfMaxStay('0 h')).toThrow(DuesseldorfParseError)
    expect(() => parseDuesseldorfMaxStay('120 Minuten')).toThrow(DuesseldorfParseError)
    expect(() => parseDuesseldorfMaxStay('z'.repeat(200))).toThrow(DuesseldorfParseError)
    expect(parseDuesseldorfMaxStay(null)).toBeUndefined()
    expect(parseDuesseldorfMaxStay('')).toBeUndefined()
    expect(parseDuesseldorfMaxStay('-')).toBeUndefined()
  })

  it('schreibt die Höchstparkdauer in Berlins Code', () => {
    expect(duesseldorfMaxStayCode(120)).toBe('2h')
    expect(duesseldorfMaxStayCode(90)).toBe('90min')
  })
})

describe('Zusammenlegen', () => {
  it('macht aus zwei Beträgen eine Spanne und aus einem einen Wert', () => {
    expect(mergeDuesseldorfFees([])).toEqual({ kind: 'unknown' })
    expect(mergeDuesseldorfFees([{ kind: 'unknown' }])).toEqual({ kind: 'unknown' })
    expect(
      mergeDuesseldorfFees([
        { kind: 'exact', centsPerHour: 300 },
        { kind: 'exact', centsPerHour: 300 },
      ])
    ).toEqual({ kind: 'exact', centsPerHour: 300 })
    expect(
      mergeDuesseldorfFees([
        { kind: 'exact', centsPerHour: 450 },
        { kind: 'unknown' },
        { kind: 'exact', centsPerHour: 300 },
      ])
    ).toEqual({ kind: 'range', minCentsPerHour: 300, maxCentsPerHour: 450 })
    expect(
      mergeDuesseldorfFees([{ kind: 'range', minCentsPerHour: 200, maxCentsPerHour: 450 }])
    ).toEqual({ kind: 'range', minCentsPerHour: 200, maxCentsPerHour: 450 })
    expect(mergeDuesseldorfFees([{ kind: 'disc' }])).toEqual({ kind: 'unknown' })
  })

  it('wirft doppelte Fenster weg und verschmilzt benachbarte nicht', () => {
    const bis20 = { weekdays: [1, 2, 3, 4, 5, 6] as const, fromMinute: 540, toMinute: 1200 }
    const bis22 = { weekdays: [1, 2, 3, 4, 5, 6] as const, fromMinute: 540, toMinute: 1320 }
    expect(mergeDuesseldorfWindows([bis20, bis20, bis22])).toEqual([bis20, bis22])
  })
})

describe('duesseldorfZoneLabel', () => {
  it('nennt Namen und Kennbuchstaben, weil beide auf dem Schild stehen', () => {
    expect(duesseldorfZoneLabel({ name: 'Unterbilk', kuerzel: 'R' })).toBe('Unterbilk (R)')
    expect(duesseldorfZoneLabel({ name: '', kuerzel: 'R' })).toBe('R')
    expect(duesseldorfZoneLabel({ name: 'Unterbilk', kuerzel: null })).toBe('Unterbilk')
    expect(duesseldorfZoneLabel({})).toBe('?')
  })

  it('vergibt 44 verschiedene Kennungen über den ganzen Abzug', () => {
    const labels = new Set(zones.zeilen.map((row) => duesseldorfZoneLabel(row)))
    expect(labels.size).toBe(44)
    expect([...labels].some((label) => label.includes('?'))).toBe(false)
  })
})

describe('Feiertage', () => {
  /**
   * Der Kalender für Nordrhein-Westfalen, gegen § 2 Abs. 1 des Gesetzes über
   * die Sonn- und Feiertage gehalten (Beleg in `holidays.ts`). Bis zum
   * 9. September stand hier der laute Zustand — `NW` warf —, mit dem
   * Anschalten von Düsseldorf und Köln ist daraus die Messung geworden.
   */
  it('kennt die elf Feiertage Nordrhein-Westfalens — und nicht den Frauentag', () => {
    const land: Land = 'NW'
    const tage = holidaysFor(land, 2026)
    expect(tage.has('2026-06-04')).toBe(true) // Fronleichnam, Ostersonntag 5. April + 60
    expect(tage.has('2026-11-01')).toBe(true) // Allerheiligen
    expect(tage.has('2026-01-06')).toBe(false) // Drei Könige: nur BW, BY, ST
    expect(tage.has('2026-03-08')).toBe(false) // Frauentag: Berlin, nicht NW
    expect(tage.has('2026-10-31')).toBe(false) // Reformationstag: nicht NW
    expect(tage.size).toBe(11)
  })
})

describe('parseDuesseldorfSchedule an der Eingabegrenze', () => {
  // Der Test-Audit fand `>` → `>=` in sechs von sieben Parsern unentdeckt:
  // Alle prüften 500 Zeichen, keiner die Grenze selbst.
  it('nimmt genau 160 Zeichen und weist 161 ab', () => {
    const gerade = 'werktags, 9 bis 20 Uhr'.padEnd(160, ' ')
    expect(() => parseDuesseldorfSchedule(gerade)).not.toThrow()
    expect(() => parseDuesseldorfSchedule(`${gerade} `)).toThrow(DuesseldorfParseError)
  })
})
