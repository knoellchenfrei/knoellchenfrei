/**
 * Der Berliner Gebührenparser an seinen Rändern.
 *
 * Der teuerste Fehler dieser Datei wäre kein Absturz, sondern eine Zahl: Wer
 * eine Spanne auf einen Wert zusammenzieht, verschätzt jemanden um bis zu 50 %,
 * und wer eine Null ausliefert, sagt „kostenlos" über einen Platz, der
 * kostenpflichtig ist. Beides sieht auf dem Schirm gleich plausibel aus.
 */
import { describe, expect, it } from 'vitest'

import { FeeParseError, parseFee } from '../src/parse-fee.js'
import { estimateCost, type ParkingZone } from '../src/tariff.js'
import { parseSchedule } from '../src/parse-schedule.js'

describe('parseFee — die Schreibweisen des Feeds', () => {
  it('liest den gewöhnlichen Betrag', () => {
    expect(parseFee('2,00 Euro')).toEqual({ kind: 'exact', centsPerHour: 200 })
  })

  // Zone 51 schreibt es ohne Leerzeichen. Das Leerzeichen im Muster zu
  // verlangen kostete genau diese eine Zone.
  it('liest den Betrag auch ohne Leerzeichen vor der Währung', () => {
    expect(parseFee('4,00Euro')).toEqual({ kind: 'exact', centsPerHour: 400 })
  })

  it('hält eine Spanne als Spanne fest', () => {
    expect(parseFee('2,00-3,00 Euro')).toEqual({
      kind: 'range',
      minCentsPerHour: 200,
      maxCentsPerHour: 300,
    })
  })

  it('liest die Währung unabhängig von der Schreibweise', () => {
    expect(parseFee('3,00 EURO')).toEqual({ kind: 'exact', centsPerHour: 300 })
    expect(parseFee('  3,00 euro  ')).toEqual({ kind: 'exact', centsPerHour: 300 })
  })
})

describe('parseFee — was abbrechen muss', () => {
  // Ohne Währung ist die Einheit geraten. „2,00" könnte ein Betrag, eine
  // Höchstparkdauer oder eine Zonennummer sein.
  it('weist eine Zahl ohne Währung ab, statt Euro anzunehmen', () => {
    expect(() => parseFee('2,00')).toThrow(/no currency token/)
    expect(() => parseFee('gratis')).toThrow(FeeParseError)
  })

  it('weist eine Währung ohne Zahl ab', () => {
    expect(() => parseFee('Euro')).toThrow(/found 0/)
  })

  it('weist eine absteigende Spanne ab', () => {
    expect(() => parseFee('3,00-2,00 Euro')).toThrow(/range is not ascending/)
  })

  // Zwei gleiche Zahlen sind keine Spanne, und welche der beiden gälte, sagt
  // die Zeile nicht.
  it('weist eine Spanne ab, deren Enden gleich sind', () => {
    expect(() => parseFee('2,00-2,00 Euro')).toThrow(/range is not ascending/)
  })

  it('weist drei Beträge ab, statt sich zwei davon auszusuchen', () => {
    expect(() => parseFee('1,00-2,00-3,00 Euro')).toThrow(/found 3/)
  })

  /**
   * Der gefundene Fehler: `0,00 Euro` ergab `exact` mit 0 Cent.
   *
   * Das ist der einzige Weg, an `CostEstimate.priced` vorbei ein „0,00 €" auf
   * den Schirm zu bringen — die Marke, deren ganze Aufgabe es ist, genau das zu
   * verhindern. Im Berliner Abzug steht kein Nullbetrag; käme einer, wäre
   * „kostenlos" die eine Auslegung, die er sicher nicht verdient.
   */
  it('weist einen Nullbetrag ab, statt ihn als Preis auszuliefern', () => {
    expect(() => parseFee('0,00 Euro')).toThrow(/0,00 is not a tariff/)
    expect(() => parseFee('0,00-3,00 Euro')).toThrow(/0,00 is not a tariff/)
  })

  it('begrenzt die Eingabe auf 100 Zeichen und nennt nur einen Ausschnitt', () => {
    expect(parseFee(`2,00 Euro${' '.repeat(91)}`)).toEqual({ kind: 'exact', centsPerHour: 200 })
    try {
      parseFee(`2,00 Euro${' '.repeat(92)}`)
      expect.unreachable('hätte werfen müssen')
    } catch (error) {
      expect(error).toBeInstanceOf(FeeParseError)
      expect((error as FeeParseError).raw).toHaveLength(40)
    }
  })
})

/**
 * Was der Parser NICHT liefert, und was das für die Rechnung heisst.
 *
 * `disc` und `unknown` entstehen nur in Hamburg, Frankfurt und München. Der
 * Berliner Parser kennt sie nicht — aber `estimateCost` muss sie können, denn
 * dort landen sie alle in derselben Zone.
 */
describe('Fee ohne Betrag in der Rechnung', () => {
  const withFee = (fee: ParkingZone['fee']): ParkingZone => ({
    id: '1',
    name: '1',
    land: 'BE',
    fee,
    windows: parseSchedule('Mo-Sa 9-20 Uhr').windows,
  })

  // Dienstag, 8. September 2026, 10:00 Berlin — mitten im Fenster.
  const TUESDAY_1000 = Date.UTC(2026, 8, 8, 8)

  it('rechnet ein Parkscheibengebiet nicht auf 0,00 €, sondern auf „kein Preis“', () => {
    const cost = estimateCost(withFee({ kind: 'disc' }), TUESDAY_1000, 60)
    expect(cost.chargedMinutes).toBe(60)
    expect(cost.priced).toBe(false)
    expect(cost.exact).toBe(false)
    expect([cost.minCents, cost.maxCents]).toEqual([0, 0])
  })

  it('behandelt „Quelle sagt nichts“ genauso', () => {
    expect(estimateCost(withFee({ kind: 'unknown' }), TUESDAY_1000, 60).priced).toBe(false)
  })

  // Zum Vergleich: Ein echter Betrag ist bepreist, und eine Spanne bleibt eine.
  it('bepreist einen echten Betrag und lässt eine Spanne eine Spanne', () => {
    const exact = estimateCost(withFee(parseFee('4,00 Euro')), TUESDAY_1000, 60)
    expect([exact.priced, exact.exact, exact.minCents, exact.maxCents]).toEqual([true, true, 400, 400])
    const range = estimateCost(withFee(parseFee('2,00-3,00 Euro')), TUESDAY_1000, 60)
    expect([range.priced, range.exact, range.minCents, range.maxCents]).toEqual([true, false, 200, 300])
  })
})
