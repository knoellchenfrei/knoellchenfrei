/**
 * Der Berliner Zeitparser an seinen Rändern.
 *
 * `parse-real-data.test.ts` prüft, dass alle 103 Zeilen des Feeds durchgehen.
 * Das ist die eine Hälfte. Diese Datei prüft die andere: was passieren muss,
 * wenn eine Zeile *nicht* durchgeht. Ein Parser, der bei Unfug irgendetwas
 * zurückgibt, ist gefährlicher als einer, der gar nicht liest — die Zahl steht
 * dann plausibel auf dem Schirm und niemand fragt nach.
 */
import { describe, expect, it } from 'vitest'

import { ScheduleParseError, parseSchedule } from '../src/parse-schedule.js'

describe('parseSchedule — Grenzen der Eingabe', () => {
  // Die Begrenzung ist das, was das Backtracking-Risiko wirklich nimmt; das
  // Muster allein reichte nicht.
  it('nimmt 200 Zeichen an und weist 201 ab', () => {
    const padding = ' '.repeat(200 - 'Mo-Fr 9-20 Uhr'.length)
    expect(parseSchedule(`Mo-Fr 9-20 Uhr${padding}`).windows).toHaveLength(1)
    expect(() => parseSchedule(`Mo-Fr 9-20 Uhr${padding} `)).toThrow(ScheduleParseError)
  })

  it('nennt im Fehler nur einen Ausschnitt, nicht die ganze Eingabe', () => {
    const hostile = 'x'.repeat(5000)
    try {
      parseSchedule(hostile)
      expect.unreachable('hätte werfen müssen')
    } catch (error) {
      expect(error).toBeInstanceOf(ScheduleParseError)
      expect((error as ScheduleParseError).raw).toHaveLength(60)
      expect((error as Error).message).toContain('5000 characters')
    }
  })
})

describe('parseSchedule — was abbrechen muss', () => {
  it('weist eine Spanne ab, die nicht nach ihrem Anfang endet', () => {
    expect(() => parseSchedule('Mo 20-9 Uhr')).toThrow(/implausible time range/)
  })

  // Stunde 24 ist Minute 1440 und die Obergrenze. 25 wäre eine Uhrzeit, die es
  // nicht gibt, und 1500 Minuten ein Fenster, das in den Folgetag hängt, ohne
  // dass jemand das entschieden hätte.
  it('weist eine Endstunde über 24 ab, statt in den Folgetag zu laufen', () => {
    expect(() => parseSchedule('Mo 9-25 Uhr')).toThrow(/implausible time range/)
    expect(parseSchedule('Mo 9-24 Uhr').windows[0]?.toMinute).toBe(1440)
  })

  it('weist eine umgedrehte Tagesspanne ab — mit der eigenen Fehlerklasse', () => {
    // Der konkrete Fehler: `expandDays` warf hier ein blankes `Error`. Wer
    // `instanceof ScheduleParseError` prüft, um eine unlesbare Feed-Zeile von
    // einem kaputten Parser zu unterscheiden, bekam für `Fr-Mo` die falsche
    // Antwort — und im Fehler fehlte die Rohzeile.
    expect(() => parseSchedule('Fr-Mo 9-20 Uhr')).toThrow(ScheduleParseError)
    try {
      parseSchedule('So-Sa 9-20 Uhr')
      expect.unreachable('hätte werfen müssen')
    } catch (error) {
      expect(error).toBeInstanceOf(ScheduleParseError)
      expect((error as ScheduleParseError).raw).toBe('So-Sa 9-20 Uhr')
    }
  })

  it('weist einen Text ohne Tag-und-Stunden-Angabe ab', () => {
    expect(() => parseSchedule('ganztägig gebührenpflichtig')).toThrow(
      /no recognisable day-and-hours clause/
    )
  })

  // Eine Zeile, die NUR eine Adventsregel trägt, liefert kein einziges Fenster.
  // Sie als leeren Fahrplan durchzulassen hiesse: „hier ist nie etwas fällig".
  it('weist eine Zeile ab, die nur aus einer Adventsregel besteht', () => {
    expect(() => parseSchedule('Advents-Sa 9-17 Uhr')).toThrow(
      /no recognisable day-and-hours clause/
    )
  })

  // Der Rest ist der eigentliche Schutz: Alles, was keine Klausel war und auch
  // kein Trennzeichen, ist eine Regel, die dieses Modell nicht kennt.
  it('weist einen unverstandenen Rest ab, statt ihn stillschweigend zu verlieren', () => {
    try {
      parseSchedule('Mo-Fr 9-20 Uhr ausser an Feiertagen')
      expect.unreachable('hätte werfen müssen')
    } catch (error) {
      expect((error as Error).message).toContain('unrecognised remainder')
      expect((error as Error).message).toContain('ausseranFeiertagen')
    }
  })
})

describe('parseSchedule — was durchgehen muss', () => {
  it('liest Minuten, wenn der Feed welche schreibt', () => {
    expect(parseSchedule('Mo-Fr 09:00-20:30 Uhr').windows).toEqual([
      { weekdays: [1, 2, 3, 4, 5], fromMinute: 540, toMinute: 1230 },
    ])
  })

  it('liest einen einzelnen Tag ohne Spanne', () => {
    expect(parseSchedule('So 9-24 Uhr').windows).toEqual([
      { weekdays: [0], fromMinute: 540, toMinute: 1440 },
    ])
  })

  // Sonntag steht im Feed am Ende der Woche, `Weekday` zählt ihn als 0. Eine
  // Spanne über den Sonntag hinweg gibt es nicht, aber `Mo-So` schon.
  it('setzt den Sonntag ans Ende der Feed-Woche und auf Weekday 0', () => {
    expect(parseSchedule('Mo-So 9-24 Uhr').windows[0]?.weekdays).toEqual([1, 2, 3, 4, 5, 6, 0])
  })

  it('meldet die verdoppelte Quellzeile als Defekt, statt sie zweimal zu lesen', () => {
    const parsed = parseSchedule('Mo-Sa 9-22 UhrMo-Sa 9-22 Uhr')
    expect(parsed.windows).toHaveLength(1)
    expect(parsed.sourceDefect).toBe('source string was duplicated')
  })

  // `undouble` darf nur greifen, wenn die Zeile wirklich exakt doppelt ist —
  // sonst verschluckte sie die zweite Klausel echter Zeilen.
  it('lässt zwei verschiedene Klauseln in Ruhe', () => {
    const parsed = parseSchedule('Mo-Fr 9-20 Uhr / Sa 9-18 Uhr')
    expect(parsed.windows).toHaveLength(2)
    expect(parsed.sourceDefect).toBeUndefined()
  })

  it('trennt Tagesangabe und Stunden auch dann, wenn der Schrägstrich dazwischen steht', () => {
    expect(parseSchedule('Mo-Sa / 9-20 Uhr').windows).toEqual([
      { weekdays: [1, 2, 3, 4, 5, 6], fromMinute: 540, toMinute: 1200 },
    ])
  })
})

describe('parseSchedule bei Resten und Nullfenstern', () => {
  it('weist auch einen einzelnen unverstandenen Buchstaben ab', () => {
    expect(() => parseSchedule('Mo-Fr 9-20 Uhr x')).toThrow(/unrecognised remainder/)
  })

  it('weist eine Spanne ab, deren Enden gleich sind', () => {
    expect(() => parseSchedule('Mo 9-9 Uhr')).toThrow(ScheduleParseError)
  })
})
