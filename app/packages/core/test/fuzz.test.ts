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
import {
  FreiburgParseError,
  parseFreiburgAutomatFee,
  parseFreiburgFee,
  parseFreiburgSchedule,
} from '../src/freiburg.js'
import {
  RostockParseError,
  parseRostockAreaName,
  parseRostockFee,
  parseRostockMaxStay,
  parseRostockSchedule,
} from '../src/rostock.js'
import {
  CottbusParseError,
  parseCottbusDays,
  parseCottbusFee,
  parseCottbusSchedule,
  parseCottbusTariffZone,
  parseCottbusTime,
} from '../src/cottbus.js'
import {
  SchwerinParseError,
  parseSchwerinFee,
  parseSchwerinMaxStay,
  parseSchwerinSchedule,
} from '../src/schwerin.js'
import {
  GrazParseError,
  parseGrazFee,
  parseGrazMaxStay,
  parseGrazMaxStayProse,
  parseGrazSchedule,
} from '../src/graz.js'
import { SalzburgParseError, parseSalzburgMaxStay, parseSalzburgRule } from '../src/salzburg.js'
import {
  InnsbruckParseError,
  parseInnsbruckFee,
  parseInnsbruckInfo,
  parseInnsbruckMaxStay,
  parseInnsbruckSchedule,
} from '../src/innsbruck.js'
import {
  ZuerichParseError,
  parseZuerichMaxStay,
  parseZuerichMeterTariff,
  parseZuerichSchedule,
  parseZuerichTariffZone,
} from '../src/zuerich.js'
import { WienParseError, parseWienMaxStay, parseWienSchedule, wienAreaKey, wienStripKey } from '../src/wien.js'
import {
  NprParseError,
  nprDateKey,
  parseNprFare,
  parseNprMaxDuration,
  parseNprTime,
  parseNprTimeFrame,
  parseNprWkt,
} from '../src/npr.js'
import { GenfParseError, genfMaxStayCode, genfStreetLabel, genfZoneKey, parseGenfTypeStationnement } from '../src/genf.js'
import {
  BernParseError,
  bernZoneNameFromPlz,
  parseBernFieldType,
  parseBernInfo,
  parseBernZoneName,
} from '../src/bern.js'
import { KrakauParseError, parseKrakauPodstrefa, parseKrakauSince } from '../src/krakau.js'
import {
  StrasbourgParseError,
  parseStrasbourgColour,
  parseStrasbourgTariff,
  strasbourgFee,
  strasbourgHourlyRates,
  strasbourgMaxStay,
  strasbourgZoneKey,
} from '../src/strasbourg.js'
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

  it('Rostock wirft nur RostockParseError und liefert nur gültige Fenster', () => {
    fuzz(20260916, 120, RostockParseError, (input) => {
      expectValidWindows(parseRostockSchedule(input), input)
    })
  })

  // Die Gebietsbezeichnung ist der zweite Rostocker Textparser: Aus ihr wird
  // der Zonenschlüssel. Ein Kürzel aus Unfug wäre eine Zone, die es nicht gibt.
  it('Rostocks Gebietsbezeichnung wirft nur RostockParseError und liefert nur Kürzel', () => {
    fuzz(20260917, 120, RostockParseError, (input) => {
      const { code, name } = parseRostockAreaName(input)
      expect(code, input).toMatch(/^[A-Z]\d{1,2}$/)
      expect(name.length, input).toBeGreaterThan(0)
    })
  })

  it('Schwerin wirft nur SchwerinParseError und liefert nur gültige Fenster', () => {
    fuzz(20260916, 120, SchwerinParseError, (input) => {
      expectValidWindows(parseSchwerinSchedule(input), input)
  // Salzburg liefert zwei Fensterlisten — kassiert und nur Scheibe —, und
  // beide müssen die Invariante halten.
    })
  })

  it('Salzburg wirft nur SalzburgParseError und liefert nur gültige Fenster', () => {
    fuzz(2026, 200, SalzburgParseError, (input) => {
      const rule = parseSalzburgRule(input)
      expectValidWindows([...rule.windows, ...rule.discWindows], input)
    })
  })

  it('München wirft nur MuenchenParseError und liefert nur gültige Fenster', () => {
    fuzz(20260910, 200, MuenchenParseError, (input) => {
      const rule = parseMuenchenRule(input)
      expectValidWindows(muenchenParkingWindows(rule), input)
      for (const clause of rule.clauses) expectValidWindows(clause.windows, input)
    })
  })

  it('Freiburg wirft nur FreiburgParseError und liefert nur gültige Fenster', () => {
    fuzz(20260916, 120, FreiburgParseError, (input) => {
      expectValidWindows(parseFreiburgSchedule(input), input)
    })
  })

  // Zürich liest zwei Sätze: die Bedienungszeit der Fläche und die Tarifzeile
  // der Parkuhr, die Stufe, Dauer und Zeiten in einer Zeile trägt.
  it('Zürich wirft nur ZuerichParseError und liefert nur gültige Fenster', () => {
    fuzz(20260921, 120, ZuerichParseError, (input) => {
      expectValidWindows(parseZuerichSchedule(input), input)
    })
    fuzz(20260922, 120, ZuerichParseError, (input) => {
      const tariff = parseZuerichMeterTariff(input)
      if (tariff.kind === 'regular') {
        expectValidWindows(tariff.windows, input)
        expect(tariff.maxStayMinutes > 0, input).toBe(true)
      }
      parseZuerichTariffZone(input)
    })
  })

  // Cottbus liest sechs Felder statt eines Satzes. Der Unfug geht deshalb in
  // jedes Feld einzeln und in alle drei Felder einer Gruppe zugleich.
  it('Cottbus wirft nur CottbusParseError und liefert nur gültige Fenster', () => {
    fuzz(20260916, 40, CottbusParseError, (input) => {
      expectValidWindows(parseCottbusSchedule({ wt: input, wt_bew_beginn: '08:00', wt_bew_ende: '20:00' }), input)
      expectValidWindows(parseCottbusSchedule({ wt: 'Mo - Fr', wt_bew_beginn: input, wt_bew_ende: '20:00' }), input)
      expectValidWindows(parseCottbusSchedule({ woende: 'Sa', woen_bew_beginn: '09:00', woen_bew_ende: input }), input)
      expectValidWindows(
        parseCottbusSchedule({ wt: input, wt_bew_beginn: input, wt_bew_ende: input, woende: input }),
        input
      )
      parseCottbusDays(input)
      parseCottbusTime(input)
    })
  })

  it('Graz wirft nur GrazParseError und liefert nur gültige Fenster', () => {
    fuzz(20260916, 200, GrazParseError, (input) => {
      expectValidWindows(parseGrazSchedule(input), input)
  // Innsbruck: Zeit und Gebühr stehen in einem Feld; beschossen werden der
  // Zeitteil allein und das ganze Feld, weil der Schnitt am Komma selbst
  // eine Stelle ist, an der etwas anderes als die eigene Klasse fliegen kann.
    })
  })

  it('Innsbruck wirft nur InnsbruckParseError und liefert nur gültige Fenster', () => {
    fuzz(20260916, 300, InnsbruckParseError, (input) => {
      expectValidWindows(parseInnsbruckSchedule(input).windows, input)
    })
    fuzz(20260917, 300, InnsbruckParseError, (input) => {
      const info = parseInnsbruckInfo(input)
      expectValidWindows(info.windows, input)
      expectValidFee(info.fee, input)
  // Wien: Klauseln mit `(werkt.)`/`(w.)`, Trenner `;` und `,`, Minuten mit
  // `:` oder `.`. Die Bausteine oben treffen das nur selten — deshalb dazu
  // Bruchstücke aus dem Wiener Feed, damit der Beschuss die Klausel erreicht.
    })
  })

  it('Wien wirft nur WienParseError und liefert nur gültige Fenster', () => {
    fuzz(20260921, 120, WienParseError, (input) => {
      expectValidWindows(parseWienSchedule(input), input)
    })
    const next = lcg(20260922)
    const WIEN_TOKENS = ['Mo.-Fr.', 'Sa.', 'Mo.-Sa.', 'So.-Mo.', '(werkt.)', '(w.)', 'v.', 'v. ', '9-22', '8-18h', '8:30-18h', '10.30-15h', ' Uhr', 'h', ';', ', ', '24-24h', '0-24 Uhr', '9-9h', 'Xx.']
    for (let i = 0; i < ITERATIONS; i += 1) {
      const pieces = next() % 8
      const input = Array.from({ length: pieces }, () => WIEN_TOKENS[next() % WIEN_TOKENS.length] as string).join(next() % 2 === 0 ? ' ' : '')
      try {
        expectValidWindows(parseWienSchedule(input), input)
      } catch (error) {
        if (!(error instanceof WienParseError)) throw error
      }
    }
  })

  it('Wiens Schlüssel werfen nur WienParseError', () => {
    fuzz(20260923, 120, WienParseError, (input) => {
      expect(wienStripKey({ STRNAM: input, GELTUNGSBEREICH: input }).length).toBeGreaterThan(0)
      wienAreaKey({ BEZIRK: Number(input), BEZIRK2: input.length % 3 === 0 ? Number(input.slice(1)) : null })
    })
  })
})

describe('NPR unter Beschuss', () => {
  // Das NPR hat keinen Satz zu zerlegen, aber vier Felder, die Zahlen sein
  // sollen und aus einer fremden Tabelle kommen. Jedes wird einzeln und im
  // Verbund beschossen; Datumsprüfung und WKT dazu.
  it('Zeiten und Fenster werfen nur NprParseError und liefern nur gültige Fenster', () => {
    fuzz(20260917, 40, NprParseError, (input) => {
      parseNprTime(input)
      const frame = parseNprTimeFrame({ daytimeframe: 'MAANDAG', starttimetimeframe: input, endtimetimeframe: '2100' })
      expect(frame.fromMinute).toBeLessThan(frame.toMinute)
      parseNprTimeFrame({ daytimeframe: input, starttimetimeframe: '900', endtimetimeframe: input, maxdurationright: input })
    })
  })

  it('Datum, Höchstdauer und WKT werfen nur NprParseError', () => {
    fuzz(20260918, 60, NprParseError, (input) => {
      const key = nprDateKey(input)
      if (key !== null) expect(key).toMatch(/^\d{8}$/)
      const minutes = parseNprMaxDuration(input)
      if (minutes !== undefined) expect(minutes).toBeGreaterThan(0)
      parseNprWkt(`POLYGON ((${input}))`)
      parseNprWkt(input)
    })
  })

  it('Tarifteile werfen nur NprParseError und beziffern nie eine Null', () => {
    fuzz(20260919, 40, NprParseError, (input) => {
      const fare = parseNprFare([
        { startdurationfarepart: '0', enddurationfarepart: '999999', amountfarepart: input, stepsizefarepart: '1' },
      ])
      if (fare.kind !== 'free') expectValidFee(fare.fee, input)
      const staffel = parseNprFare([
        { startdurationfarepart: '0', enddurationfarepart: input, amountfarepart: '0.20', stepsizefarepart: input },
        { startdurationfarepart: input, enddurationfarepart: '999999', amountfarepart: '0.56', stepsizefarepart: '15' },
      ])
      if (staffel.kind !== 'free') expectValidFee(staffel.fee, input)
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

  it('Freiburg wirft nur FreiburgParseError, für Flächen wie für Automaten', () => {
    fuzz(20260917, 120, FreiburgParseError, (input) => {
      expectValidFee(parseFreiburgFee(input), input)
    })
    fuzz(20260918, 120, FreiburgParseError, (input) => {
      expectValidFee(parseFreiburgAutomatFee(input), input)
    })
  })

  // Rostocks Betrag ist eine Zahl. Beschossen wird er deshalb doppelt: mit
  // Zeichenketten, die laut Typ gar nicht ankommen dürften (eine JSON-Datei
  // hält sich nicht an Typen), und mit den Zahlen, die `Number` daraus macht
  // — NaN, Unendlich, Negatives, Bruchteile eines Cents.
  it('Rostock wirft nur RostockParseError und beziffert nie eine Null', () => {
    fuzz(20260918, 120, RostockParseError, (input) => {
      expectValidFee(parseRostockFee(input as unknown as number), input)
    })
    fuzz(20260919, 120, RostockParseError, (input) => {
      expectValidFee(parseRostockFee(Number(input)), input)
    })
  })

  it('Cottbus wirft nur CottbusParseError — für Zeichenketten und für Zahlen', () => {
    fuzz(20260917, 40, CottbusParseError, (input) => {
      expectValidFee(parseCottbusFee(input), input)
      parseCottbusTariffZone(input)
    })
    // Der Feed liefert Zahlen; auch die können Unfug sein.
    for (const value of [0, -0, -1, 0.001, 0.004, 0.005, 1e-9, 1e9, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, Number.MAX_SAFE_INTEGER]) {
      try {
        expectValidFee(parseCottbusFee(value), String(value))
      } catch (error) {
        if (!(error instanceof CottbusParseError)) throw error
      }
    }
  })
  // Schwerin schreibt den Dezimalpunkt; `0.00 Euro je Std.` ist trotzdem
  // eine Null und muss abbrechen wie `0,00 Euro` in Berlin.
  it('Schwerin wirft nur SchwerinParseError und beziffert nie eine Null', () => {
    fuzz(20260917, 120, SchwerinParseError, (input) => {
      expectValidFee(parseSchwerinFee(input), input)
    })
  })

  it('Graz wirft nur GrazParseError, und seine Tickets sind nie null', () => {
    fuzz(20260917, 120, GrazParseError, (input) => {
      const tariff = parseGrazFee(input)
      expectValidFee(tariff.fee, input)
      for (const ticket of tariff.tickets) expect(ticket.cents, input).toBeGreaterThan(0)
    })
  })

  it('Innsbruck wirft nur InnsbruckParseError und beziffert nie eine Null', () => {
    fuzz(20260918, 300, InnsbruckParseError, (input) => {
      expectValidFee(parseInnsbruckFee(input), input)
    })
  })
})

// Krakau hat weder Zeit- noch Gebührenparser — der Feed nennt beides nicht.
// Beschossen werden die zwei Leser, die er hat: der Podstrefa-Code und das
// Datum der Erweiterung. Beide dürfen nur ihre eigene Klasse werfen und nur
// Gültiges liefern.
describe('die Krakauer Leser unter Beschuss', () => {
  it('Podstrefa: nur KrakauParseError, und nur A–D mit oder ohne n', () => {
    fuzz(20260920, 300, KrakauParseError, (input) => {
      const { podstrefa, planned } = parseKrakauPodstrefa(input)
      expect(['A', 'B', 'C', 'D'], input).toContain(podstrefa)
      expect(typeof planned).toBe('boolean')
    })
  })

  it('Datum: nur KrakauParseError, und nur ein Kalendertag als ISO-Datum', () => {
    fuzz(20260921, 300, KrakauParseError, (input) => {
      const iso = parseKrakauSince(input)
      expect(iso, input).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      const date = new Date(`${iso}T00:00:00Z`)
      expect(date.toISOString().slice(0, 10), input).toBe(iso)
    })
  })
})

// Straßburg hat keinen Zeitparser — die Zeiten stehen in der Beschreibung.
// Beschossen werden die Staffel und die zwei Leser daneben. Die Staffel
// muss, wenn sie durchgeht, eine Spanne ohne Null und ohne Betrag über der
// letzten Stufe ergeben, und eine Höchstparkdauer von mindestens einer Stunde.
describe('die Straßburger Staffel unter Beschuss', () => {
  it('Tarif: nur StrasbourgParseError, und nur eine Spanne ohne Null aus steigenden Stufen', () => {
    fuzz(20260925, 200, StrasbourgParseError, (input) => {
      const tariff = parseStrasbourgTariff(input)
      expect(tariff.steps.length, input).toBeGreaterThan(0)
      for (let i = 1; i < tariff.steps.length; i += 1) {
        expect(tariff.steps[i]?.minutes, input).toBeGreaterThan(tariff.steps[i - 1]?.minutes ?? 0)
        expect(tariff.steps[i]?.cents, input).toBeGreaterThan(tariff.steps[i - 1]?.cents ?? 0)
      }
      expectValidFee(strasbourgFee(tariff), input)
      for (const rate of strasbourgHourlyRates(tariff)) expect(rate, input).toBeGreaterThan(0)
      expect(strasbourgMaxStay(tariff), input).toBeGreaterThanOrEqual(60)
    })
  })

  it('Farbe und Schlüssel: nur StrasbourgParseError, nur die drei Farben', () => {
    fuzz(20260926, 120, StrasbourgParseError, (input) => {
      expect(['rouge', 'orange', 'vert'], input).toContain(parseStrasbourgColour(input))
    })
    fuzz(20260927, 120, StrasbourgParseError, (input) => {
      const key = strasbourgZoneKey({ couleur: input, id_zone_visiteur: input.length })
      expect(key, input).toMatch(/^(rouge|orange|vert) [1-9]\d*$/)
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
    // Zahl und Einheit aus derselben Eingabe: die Zahl vorn, der Rest als
    // Einheit. So trifft der Beschuss beide Felder und ihr Zusammenspiel.
    fuzz(20260920, 120, RostockParseError, (input) => {
      const number = Number.parseInt(input, 10)
      const minutes = parseRostockMaxStay(
        Number.isNaN(number) ? null : number,
        input.replace(/^\s*-?\d+/, '')
      )
    fuzz(20260916, 120, SalzburgParseError, (input) => {
      const minutes = parseSalzburgMaxStay(input)
      if (minutes === undefined) return
      expect(Number.isInteger(minutes)).toBe(true)
      expect(minutes).toBeGreaterThan(0)
    })
    fuzz(20260918, 120, SchwerinParseError, (input) => {
      const minutes = parseSchwerinMaxStay(input)
      if (minutes === undefined) return
      expect(Number.isInteger(minutes)).toBe(true)
      expect(minutes).toBeGreaterThan(0)
    })
    for (const parse of [parseGrazMaxStay, parseGrazMaxStayProse]) {
      fuzz(20260918, 120, GrazParseError, (input) => {
        const minutes = parse(input)
        if (minutes === undefined) return
        expect(Number.isInteger(minutes)).toBe(true)
        expect(minutes).toBeGreaterThan(0)
      })
    }
    fuzz(20260919, 300, InnsbruckParseError, (input) => {
      const minutes = parseInnsbruckMaxStay(input)
      if (minutes === undefined) return
      expect(Number.isInteger(minutes)).toBe(true)
      expect(minutes).toBeGreaterThan(0)
      expect(minutes).toBeLessThanOrEqual(1440)
    })
  })
})

})

describe('Zürcher Parkdauer unter Beschuss', () => {
  // Eine Zahl oder eine Zeichenkette, nie eine Null und nie mehr als eine
  // Woche — sonst stünde „0 min" oder „999 h" als Höchstparkdauer im Panel.
  it('wirft nur ZuerichParseError und liefert nur Minuten über null', () => {
    fuzz(20260923, 20, ZuerichParseError, (input) => {
      for (const value of [input, Number(input)]) {
        const minutes = parseZuerichMaxStay(value)
        if (minutes !== undefined) {
          expect(Number.isInteger(minutes), input).toBe(true)
          expect(minutes > 0 && minutes <= 7 * 24 * 60, input).toBe(true)
        }
      }
    })
  })
})

describe('Wiens Höchstparkdauer unter Beschuss', () => {
  it('wirft nur WienParseError und liefert nur Minuten zwischen 6 und 180', () => {
    fuzz(20260924, 120, WienParseError, (input) => {
      const minutes = parseWienMaxStay(input)
      expect(Number.isInteger(minutes), input).toBe(true)
      expect(minutes > 0 && minutes <= 180, input).toBe(true)
    })
  })
})

describe('Genfer Stellplatzarten unter Beschuss', () => {
  // Genf hat keinen Zeit- und keinen Gebührenparser — die Quelle nennt
  // beides nicht. Was fremde Eingabe zerlegt, ist die Stellplatzart, und
  // die liefert entweder eine Autoreihe mit positiver Dauer oder ohne, oder
  // etwas anderes, oder wirft die eigene Klasse.
  it('wirft nur GenfParseError und liefert nie eine Dauer von null', () => {
    fuzz(20260917, 60, GenfParseError, (input) => {
      const type = parseGenfTypeStationnement(input)
      if (type.vehicles === 'other') {
        expect(type.label.length, input).toBeGreaterThan(0)
        return
      }
      if (type.maxStayMinutes === null) return
      expect(Number.isInteger(type.maxStayMinutes), input).toBe(true)
      expect(type.maxStayMinutes, input).toBeGreaterThan(0)
      expect(type.maxStayMinutes, input).toBeLessThanOrEqual(1440)
      expect(genfMaxStayCode(type.maxStayMinutes), input).toMatch(/^\d+(min|h)$/)
    })
  })

  it('der Zonenschlüssel wirft nur GenfParseError, der Straßenname nie', () => {
    fuzz(20260918, 60, GenfParseError, (input) => {
      const key = genfZoneKey({ ZONE_MACARON: input })
      expect(key, input).toMatch(/^[A-Z0-9]{1,4}$/)
      expect(genfStreetLabel(input).length, input).toBeLessThanOrEqual(input.length + 1)
/**
 * Bern hat keinen Zeit- und keinen Gebührenparser — der Feed nennt beides
 * nicht. Beschossen werden die Feldparser, aus denen Schlüssel, Art und
 * Regel einer Zone entstehen: Ein Schlüssel aus Unfug wäre eine Zone, die es
 * nicht gibt, und stünde in `zone-keys.generated.ts` als gültige Ausprägung.
 */
    })
  })
})

describe('Berner Feldparser unter Beschuss', () => {
  it('Bern wirft nur BernParseError und liefert nur Zonennamen, zwei Arten und einen Hinweis', () => {
    fuzz(20260917, 120, BernParseError, (input) => {
      expect(parseBernZoneName(input), input).toMatch(/^\d{4}(\/[1-9]\d?)?$/)
    })
    fuzz(20260918, 120, BernParseError, (input) => {
      expect(['blau', 'weiss'], input).toContain(parseBernFieldType(input))
    })
    fuzz(20260919, 120, BernParseError, (input) => {
      expect([null, 'Auch Sonntags'], input).toContain(parseBernInfo(input))
    })
    fuzz(20260920, 120, BernParseError, (input) => {
      expect(bernZoneNameFromPlz(input, 'kein Zusatz'), input).toMatch(/^\d{4}$/)
    })
    fuzz(20260921, 120, BernParseError, (input) => {
      expect(bernZoneNameFromPlz('3006', input), input).toMatch(/^3006(\/[1-9]\d?)?$/)
    })
  })
})

describe('Zeitbudget', () => {
  /**
   * Die Begrenzung der Eingabelänge ist das, was das Zurückverfolgen unmöglich
   * macht — nicht die Muster selbst. Eine Regression daran fiele sonst erst
   * auf, wenn der Datenbau minutenlang steht.
   */
  it('bleibt für 1500 Eingaben je Parser unter 300 Millisekunden', () => {
    const next = lcg(4711)
    const inputs = Array.from({ length: ITERATIONS }, () => fuzzString(next, 200))
    const parsers: readonly ((input: string) => unknown)[] = [
      parseSchedule,
      parseHamburgSchedule,
      parseFrankfurtSchedule,
      parseMuenchenRule,
      parseFreiburgSchedule,
      parseSalzburgRule,
      parseFee,
      parseHamburgFee,
      parseFrankfurtFee,
      parseFreiburgFee,
      parseRostockSchedule,
      (input) => parseRostockFee(Number(input)),
      parseCottbusDays,
      parseCottbusFee,
      parseSchwerinSchedule,
      parseSchwerinFee,
      parseGrazSchedule,
      parseGrazFee,
      parseInnsbruckInfo,
      parseInnsbruckMaxStay,
      parseZuerichSchedule,
      parseZuerichMeterTariff,
      parseWienSchedule,
      parseWienMaxStay,
      parseNprTime,
      nprDateKey,
      (input) => parseNprWkt(`POLYGON ((${input}))`),
      parseGenfTypeStationnement,
      (input) => genfZoneKey({ ZONE_MACARON: input }),
      parseBernZoneName,
      parseBernInfo,
      parseKrakauPodstrefa,
      parseKrakauSince,
      parseStrasbourgTariff,
      parseStrasbourgColour,
    ]
    // Je Parser gemessen, nicht in Summe: Mit 25 Parsern (Stand 17. September)
    // lag die Summe unter Last bei 1,1 s, ohne dass ein einzelner langsam
    // war — die Summe wuchs mit jeder Stadt, die Schranke nicht. Ein
    // katastrophales Backtracking zeigt sich in Sekunden je Parser, nicht in
    // Millisekunden; 300 ms für 1500 Eingaben ist das Zehnfache des Üblichen.
    for (const parse of parsers) {
      const started = performance.now()
      for (const input of inputs) {
        try {
          parse(input)
        } catch {
          // Das Werfen ist hier der Normalfall; gemessen wird die Zeit.
        }
      }
      expect(performance.now() - started, parse.name).toBeLessThan(300)
    }
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
