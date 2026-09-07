/**
 * Beschuss mit Unfug — deterministisch, ohne neue Abhängigkeit.
 *
 * `packages/core` ist die Stelle, an der fremde Eingaben zerlegt werden: der
 * WFS von vier Städten und der Telegram-Webhook. Für keine dieser Quellen gibt
 * es eine Zusicherung, dass morgen dasselbe drinsteht wie heute. Die
 * Schreibweisen-Tests prüfen, was der Feed *heute* enthält; diese Datei prüft,
 * was passieren muss, wenn er etwas anderes enthält.
 *
 * Zugesichert wird keine Bedeutung, sondern eine Form:
 *
 *  1. Jeder Parser wirft **nur seine eigene** `*ParseError` — oder liefert ein
 *     Ergebnis, das die Invarianten seines Typs erfüllt. Ein `TypeError` aus
 *     dem Inneren heisst, dass jemand einen Feldzugriff nicht geprüft hat, und
 *     er käme im Datenbau als „kaputter Parser“ an statt als „unlesbare Zeile“.
 *  2. Kein Lauf hängt. Die Muster laufen über Text, den niemand kontrolliert;
 *     ein zurückverfolgendes Muster ist dort kein theoretisches Risiko.
 *
 * Der Zufall ist ein LCG mit festem Startwert: Ein Fehlschlag ist damit
 * reproduzierbar und die Laufzeit von Lauf zu Lauf dieselbe. Ein Generator
 * ohne Startwert machte aus jedem CI-Lauf ein anderes Experiment — und aus
 * einem roten Haken eine Meldung, die niemand nachstellen kann.
 */
import { describe, expect, it } from 'vitest'

import { FeeParseError, parseFee, type Fee } from '../src/parse-fee.js'
import { ScheduleParseError, parseSchedule } from '../src/parse-schedule.js'
import {
  HamburgParseError,
  parseHamburgFee,
  parseHamburgMaxStay,
  parseHamburgSchedule,
} from '../src/hamburg.js'
import {
  FrankfurtParseError,
  parseFrankfurtFee,
  parseFrankfurtMaxStay,
  parseFrankfurtSchedule,
} from '../src/frankfurt.js'
import { MuenchenParseError, muenchenParkingWindows, parseMuenchenRule } from '../src/muenchen.js'
import { BERLIN, HAMBURG } from '../src/city.js'
import { parseTelegramUpdate } from '../src/telegram.js'
import { MAX_FEEDBACK_LENGTH, isFeedbackKind, tidyFeedback } from '../src/feedback.js'
import { activeSightings, confidenceOf, type Sighting } from '../src/sighting.js'
import type { ChargeWindow } from '../src/tariff.js'

/** Numerical Recipes' LCG. Klein, ganzzahlig, und ohne Abhängigkeit. */
function lcg(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0
    return state
  }
}

/**
 * Bausteine, aus denen die Zeichenketten entstehen.
 *
 * Nicht nur Rauschen: Reines Rauschen fällt in jedem Parser an der ersten
 * Prüfung durch und erreicht die interessanten Zweige nie. Deshalb überwiegen
 * Bruchstücke, die *fast* richtig aussehen — echte Tagesangaben, echte
 * Trennzeichen, echte Schlüsselwörter — dazwischen Steuerzeichen, unsichtbare
 * Zeichen, Unicode und Zahlen, die zu gross sind.
 */
const TOKENS: readonly string[] = [
  'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So', 'Mo-Fr', 'Mo-Sa', 'Mo-So', 'Fr-Mo', 'So-Sa',
  'täglich', 'taeglich', 'werktags', 'Tgl.', 'Montag bis Freitag', 'Samstag',
  'Mischparken', 'Bewohnerparken', 'Kurzzeitparken', 'mit Parkscheibe', 'frei', 'sonst',
  'Uhr', 'Euro', 'euro', '€', '€/h', '€ je Stunde', 'h', 'min', 'Std',
  '-', '–', '/', ',', '.', ':', ' ', '  ', '\t', '\n',
  '0', '1', '9', '12', '24', '25', '60', '99', '999', '9999', '00', '75',
  '9-20', '0-24', '20-9', '9:00-20:00', '9 -14', '9:75-20:00', '2,00', '0,00', '4,00Euro',
  'Advents', 'Advents-Sa', 'Parkscheibe', 'ganztägig', 'außer', 'Feiertag',
  '\u00a0', '\u200b', '\u202e', '\ufeff', '\u2066', '\u0007', '\u001b', '\u007f',
  '\u{1f600}', 'ß', 'Ä', 'ö', '"', '\\', '{', '}', '[', ']',
  'NaN', 'Infinity', '-1', '1e309', '٩', '一', 'x',
]

/** Eine Zeichenkette von höchstens `maxLength` Zeichen aus den Bausteinen. */
function fuzzString(next: () => number, maxLength: number): string {
  const parts: string[] = []
  let length = 0
  const pieces = next() % 12
  for (let i = 0; i < pieces; i += 1) {
    const token = TOKENS[next() % TOKENS.length] as string
    if (length + token.length > maxLength) break
    parts.push(token)
    length += token.length
  }
  return parts.join('')
}

/** Feste Zahl, damit die Laufzeit dieser Datei nicht vom Zufall abhängt. */
const ITERATIONS = 1500

/**
 * Die Invariante jedes Fensters.
 *
 * `toMinute` darf 1440 sein („bis Mitternacht“), `fromMinute` nie darüber
 * liegen. Ein Fenster mit `from >= to` heisst in `windowCovers` schlicht „nie“
 * — es sähe im Datensatz aus wie eine Regel und wäre keine.
 */
function expectValidWindows(windows: readonly ChargeWindow[], raw: string): void {
  const where = JSON.stringify(raw)
  for (const window of windows) {
    expect(Array.isArray(window.weekdays), where).toBe(true)
    for (const day of window.weekdays) {
      expect(Number.isInteger(day), where).toBe(true)
      expect(day >= 0 && day <= 6, where).toBe(true)
    }
    expect(Number.isInteger(window.fromMinute), where).toBe(true)
    expect(Number.isInteger(window.toMinute), where).toBe(true)
    expect(window.fromMinute >= 0, where).toBe(true)
    expect(window.fromMinute < window.toMinute, where).toBe(true)
    expect(window.toMinute <= 1440, where).toBe(true)
  }
}

/** Ein Betrag ist ganzzahlig und grösser als null; eine Spanne steigt echt an. */
function expectValidFee(fee: Fee, raw: string): void {
  const where = JSON.stringify(raw)
  if (fee.kind === 'exact') {
    expect(Number.isInteger(fee.centsPerHour), where).toBe(true)
    expect(fee.centsPerHour > 0, where).toBe(true)
  } else if (fee.kind === 'range') {
    expect(Number.isInteger(fee.minCentsPerHour), where).toBe(true)
    expect(Number.isInteger(fee.maxCentsPerHour), where).toBe(true)
    expect(fee.minCentsPerHour > 0, where).toBe(true)
    expect(fee.minCentsPerHour < fee.maxCentsPerHour, where).toBe(true)
  }
}

/**
 * Ruft `run` auf jede erzeugte Zeichenkette und lässt nur `expected` durch.
 *
 * Jede andere Ausnahme wird mit der auslösenden Eingabe weitergereicht — ohne
 * sie wäre ein roter Haken hier eine Meldung ohne Anhaltspunkt.
 */
function fuzz(
  seed: number,
  maxLength: number,
  expected: new (...args: never[]) => Error,
  run: (input: string) => void
): void {
  const next = lcg(seed)
  for (let i = 0; i < ITERATIONS; i += 1) {
    const input = fuzzString(next, maxLength)
    try {
      run(input)
    } catch (error) {
      if (error instanceof expected) continue
      throw new Error(
        `${expected.name} erwartet, ${(error as Error).name} bekommen für ${JSON.stringify(input)}: ${(error as Error).message}`,
        { cause: error }
      )
    }
  }
}

describe('Zeitparser unter Beschuss', () => {
  it('Berlin wirft nur ScheduleParseError und liefert nur gültige Fenster', () => {
    fuzz(20260907, 200, ScheduleParseError, (input) => {
      expectValidWindows(parseSchedule(input).windows, input)
    })
  })

  it('Hamburg wirft nur HamburgParseError und liefert nur gültige Fenster', () => {
    fuzz(20260908, 120, HamburgParseError, (input) => {
      expectValidWindows(parseHamburgSchedule(input), input)
    })
  })

  it('Frankfurt wirft nur FrankfurtParseError und liefert nur gültige Fenster', () => {
    fuzz(20260909, 120, FrankfurtParseError, (input) => {
      expectValidWindows(parseFrankfurtSchedule(input), input)
    })
  })

  it('München wirft nur MuenchenParseError und liefert nur gültige Fenster', () => {
    fuzz(20260910, 200, MuenchenParseError, (input) => {
      const rule = parseMuenchenRule(input)
      expectValidWindows(muenchenParkingWindows(rule), input)
      for (const clause of rule.clauses) expectValidWindows(clause.windows, input)
    })
  })
})

describe('Gebührenparser unter Beschuss', () => {
  it('Berlin wirft nur FeeParseError und beziffert nie eine Null', () => {
    fuzz(20260911, 100, FeeParseError, (input) => {
      expectValidFee(parseFee(input), input)
    })
  })

  it('Hamburg wirft nur HamburgParseError', () => {
    fuzz(20260912, 120, HamburgParseError, (input) => {
      expectValidFee(parseHamburgFee(input), input)
    })
  })

  it('Frankfurt wirft nur FrankfurtParseError', () => {
    fuzz(20260913, 120, FrankfurtParseError, (input) => {
      expectValidFee(parseFrankfurtFee(input), input)
    })
  })
})

describe('Höchstparkdauer unter Beschuss', () => {
  // `undefined` heisst „keine Begrenzung“, `0` hiesse „Parken verboten“ — der
  // Unterschied ist der ganze Punkt dieser beiden Funktionen.
  it('liefert entweder nichts oder eine positive ganze Minutenzahl', () => {
    fuzz(20260914, 120, HamburgParseError, (input) => {
      const minutes = parseHamburgMaxStay(input)
      if (minutes === undefined) return
      expect(Number.isInteger(minutes)).toBe(true)
      expect(minutes).toBeGreaterThan(0)
    })
    fuzz(20260915, 120, FrankfurtParseError, (input) => {
      const minutes = parseFrankfurtMaxStay(input)
      if (minutes === undefined) return
      expect(Number.isInteger(minutes)).toBe(true)
      expect(minutes).toBeGreaterThan(0)
    })
  })
})

describe('Zeitbudget', () => {
  /**
   * Die Begrenzung der Eingabelänge ist das, was das Zurückverfolgen unmöglich
   * macht — nicht die Muster selbst. Eine Regression daran fiele sonst erst
   * auf, wenn der Datenbau minutenlang steht.
   */
  it('bleibt für 1500 Eingaben durch sieben Parser unter einer Sekunde', () => {
    const next = lcg(4711)
    const inputs = Array.from({ length: ITERATIONS }, () => fuzzString(next, 200))
    const parsers: readonly ((input: string) => unknown)[] = [
      parseSchedule,
      parseHamburgSchedule,
      parseFrankfurtSchedule,
      parseMuenchenRule,
      parseFee,
      parseHamburgFee,
      parseFrankfurtFee,
    ]
    const started = performance.now()
    for (const input of inputs) {
      for (const parse of parsers) {
        try {
          parse(input)
        } catch {
          // Das Werfen ist hier der Normalfall; gemessen wird die Zeit.
        }
      }
    }
    expect(performance.now() - started).toBeLessThan(1000)
  })
})

/**
 * Der Telegram-Parser sieht als einziger fremdes **JSON**, nicht fremden Text.
 * Er darf deshalb überhaupt nicht werfen: Ein Webhook, der mit 500 antwortet,
 * wird von Telegram wiederholt — und zwar mit demselben Unfug.
 */
describe('Telegram-Parser unter Beschuss', () => {
  const CITIES = [BERLIN, HAMBURG]

  /** Baut verschachtelten Unfug: falsche Typen, riesige Zahlen, NaN, Unicode. */
  function fuzzValue(next: () => number, depth: number): unknown {
    switch (next() % (depth > 2 ? 8 : 12)) {
      case 0:
        return null
      case 1:
        return undefined
      case 2:
        return next() % 2 === 0
      case 3:
        return Number.NaN
      case 4:
        return next() % 2 === 0 ? Number.MAX_SAFE_INTEGER + (next() % 1000) : -(next() % 1e9)
      case 5:
        return 1e309
      case 6:
        return fuzzString(next, 60)
      case 7:
        return next() / 1000
      case 8:
        return Array.from({ length: next() % 4 }, () => fuzzValue(next, depth + 1))
      case 9:
        return { latitude: fuzzValue(next, depth + 1), longitude: fuzzValue(next, depth + 1) }
      case 10:
        return { id: fuzzValue(next, depth + 1) }
      default:
        return {
          message: {
            from: fuzzValue(next, depth + 1),
            chat: fuzzValue(next, depth + 1),
            location: fuzzValue(next, depth + 1),
            text: fuzzValue(next, depth + 1),
          },
        }
    }
  }

  /**
   * Ein Update, das *fast* echt aussieht.
   *
   * Reiner Unfug fällt an der ersten Prüfung durch und erreicht weder den
   * Standort- noch den Befehlszweig. Deshalb überwiegen hier gültige Absender
   * und Punkte, die in einer der beiden Städte liegen — und dazwischen bleibt
   * jedes Feld ein Kandidat für Unfug.
   */
  function fuzzUpdate(next: () => number): unknown {
    if (next() % 6 === 0) return fuzzValue(next, 0)

    const message: Record<string, unknown> = {
      from: next() % 8 === 0 ? fuzzValue(next, 1) : { id: next() % 1_000_000 },
      chat: next() % 8 === 0 ? fuzzValue(next, 1) : { id: next() % 1_000_000 },
    }
    switch (next() % 4) {
      case 0:
        // Punkt in Berlin bzw. Hamburg — der einzige Weg zu einer Meldung.
        message.location =
          next() % 2 === 0
            ? { longitude: 13.2 + (next() % 400) / 1000, latitude: 52.4 + (next() % 200) / 1000 }
            : { longitude: 9.8 + (next() % 400) / 1000, latitude: 53.5 + (next() % 200) / 1000 }
        break
      case 1:
        message.location = fuzzValue(next, 1)
        break
      case 2:
        message.text = ['/start', '/hilfe@parkbot', '/help mir', '/HILFE', 'hallo', ' '][
          next() % 6
        ]
        break
      default:
        message.text = fuzzValue(next, 1)
    }
    return { message }
  }

  it('gibt für jeden Unfug eine der vier Absichten zurück, ohne zu werfen', () => {
    const next = lcg(20260916)
    const kinds = new Set<string>()
    for (let i = 0; i < ITERATIONS; i += 1) {
      const update = fuzzUpdate(next)
      const parsed = parseTelegramUpdate(update, CITIES)
      expect(['help', 'report', 'unknown', 'ignore']).toContain(parsed.intent.kind)
      kinds.add(parsed.intent.kind)
      if (parsed.intent.kind === 'report') {
        // Eine Meldung trägt immer eine Stadt, und der Punkt liegt in ihr.
        expect(Number.isFinite(parsed.intent.lon)).toBe(true)
        expect(Number.isFinite(parsed.intent.lat)).toBe(true)
        expect(CITIES).toContain(parsed.intent.city)
        const box = parsed.intent.city.reportBounds
        expect(parsed.intent.lon).toBeGreaterThanOrEqual(box.minLon)
        expect(parsed.intent.lon).toBeLessThanOrEqual(box.maxLon)
        expect(parsed.intent.lat).toBeGreaterThanOrEqual(box.minLat)
        expect(parsed.intent.lat).toBeLessThanOrEqual(box.maxLat)
      }
      // Eine Kennung wird nie erfunden und nie gerundet.
      if (parsed.sender !== null) {
        expect(Number.isSafeInteger(parsed.sender.userId)).toBe(true)
        expect(Number.isSafeInteger(parsed.sender.chatId)).toBe(true)
      }
      // Ohne Absender gibt es nichts zu tun — und nichts zu antworten.
      if (parsed.sender === null) expect(parsed.intent.kind).toBe('ignore')
    }
    // Der Beschuss muss die interessanten Zweige auch wirklich erreichen.
    expect([...kinds].sort()).toEqual(['help', 'ignore', 'report', 'unknown'])
  })
})

describe('Freitext unter Beschuss', () => {
  /** Dieselbe Menge wie `INVISIBLE` in `feedback.ts` — hier als Gegenprobe. */
  const INVISIBLE =
    /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f\u200b-\u200f\u202a-\u202e\u2066-\u2069\ufeff]/

  it('liefert immer eine Zeichenkette innerhalb der Grenze, ohne unsichtbare Zeichen', () => {
    const next = lcg(20260917)
    for (let i = 0; i < ITERATIONS; i += 1) {
      const input = fuzzString(next, 300).repeat(1 + (next() % 5))
      const tidy = tidyFeedback(input)
      expect(typeof tidy).toBe('string')
      expect(tidy.length).toBeLessThanOrEqual(MAX_FEEDBACK_LENGTH)
      expect(INVISIBLE.test(tidy)).toBe(false)
      expect(tidy).not.toMatch(/\r/)
      expect(tidy).not.toMatch(/\n{3}/)
    }
  })

  it('erkennt nur die drei Arten, die das Formular anbietet', () => {
    const next = lcg(20260918)
    for (let i = 0; i < ITERATIONS; i += 1) {
      const value = fuzzString(next, 40)
      expect(isFeedbackKind(value)).toBe(['idee', 'fehler', 'sonstiges'].includes(value))
    }
    for (const value of [null, undefined, 0, 1, {}, [], ['idee'], true]) {
      expect(isFeedbackKind(value)).toBe(false)
    }
  })
})

/**
 * Zähler und Zeitstempel einer Sichtung kommen aus fremden Clients. Ein NaN
 * darunter machte die Sortierung in `activeSightings` nichtdeterministisch —
 * die Karte zeigte dieselben Daten bei jedem Aufruf anders geordnet.
 */
describe('Sichtungen unter Beschuss', () => {
  it('liefert immer einen endlichen Wert zwischen 0 und 1', () => {
    const next = lcg(20260919)
    const numbers = [
      0, 1, -1, 1e9, -1e9, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY,
      Number.MAX_SAFE_INTEGER, 0.5, -0.5, 1_757_000_000_000, 1_757_000_000_000 + 1e7,
    ]
    const now = 1_757_000_000_000
    const sightings: Sighting[] = []
    for (let i = 0; i < ITERATIONS; i += 1) {
      const sighting: Sighting = {
        id: `s${i}`,
        lat: 52.5,
        lon: 13.4,
        reportedAt: numbers[next() % numbers.length] as number,
        confirmations: numbers[next() % numbers.length] as number,
        disputes: numbers[next() % numbers.length] as number,
      }
      sightings.push(sighting)
      const confidence = confidenceOf(sighting, { now })
      expect(Number.isFinite(confidence.score)).toBe(true)
      expect(confidence.score).toBeGreaterThanOrEqual(0)
      expect(confidence.score).toBeLessThanOrEqual(1)
      expect([0, 1, 2, 3]).toContain(confidence.stars)
      expect(confidence.ageMs).toBeGreaterThanOrEqual(0)
    }
    // Und die Liste bleibt sortierbar: gleiche Eingabe, gleiche Reihenfolge.
    const once = activeSightings(sightings, { now }).map((entry) => entry.sighting.id)
    const twice = activeSightings(sightings, { now }).map((entry) => entry.sighting.id)
    expect(once).toEqual(twice)
  })
})
