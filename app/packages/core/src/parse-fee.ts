/**
 * Parser for the WFS `gebuehr` field.
 *
 * Five distinct spellings across 103 zones: "2,00 Euro", "3,00 Euro",
 * "4,00 Euro", "4,00Euro" (missing space, zone 51) and "2,00-3,00 Euro"
 * (a RANGE, zones 41-Pankow/42/43).
 *
 * Two things the source does NOT say, and which we therefore must not present as
 * parsed fact:
 *   - No row states a period. "per hour" is an out-of-band assumption, correct
 *     for Berlin parking but not derivable from the string.
 *   - For a range, no single figure is true for every street in the zone.
 *     Collapsing it to either bound misquotes a driver by up to 50%, so the
 *     range stays a range and the UI has to show it as one.
 */

/**
 * Cents per hour. `kind` says how much the source actually committed to.
 *
 * `disc` und `unknown` kamen mit Hamburg dazu und sind bewusst **nicht** als
 * `exact` mit 0 Cent modelliert. Ein Parkscheibengebiet ist nicht kostenlos im
 * Sinne von „hier musst du nichts beachten“ — wer ohne Scheibe steht, zahlt.
 * Und „die Quelle sagt nichts“ ist keine Aussage über den Preis.
 */
export type Fee =
  | { kind: 'exact'; centsPerHour: number }
  | { kind: 'range'; minCentsPerHour: number; maxCentsPerHour: number }
  /** Keine Gebühr, aber Parkscheibe — und damit fast immer eine Höchstparkdauer. */
  | { kind: 'disc' }
  /** Die Quelle nennt keinen Tarif. Nicht raten, sondern sagen. */
  | { kind: 'unknown' }

export class FeeParseError extends Error {
  constructor(
    readonly raw: string,
    reason: string
  ) {
    super(`Cannot parse gebuehr ${JSON.stringify(raw)}: ${reason}`)
    this.name = 'FeeParseError'
  }
}

/** German decimal comma; the space before "Euro" is optional in the feed. */
const AMOUNT = /(\d{1,3}),(\d{2})/g

function toCents(euros: string, cents: string): number {
  return Number(euros) * 100 + Number(cents)
}

/** Same reasoning as the schedule parser: bound untrusted input. */
const MAX_INPUT_LENGTH = 100

export function parseFee(raw: string): Fee {
  if (raw.length > MAX_INPUT_LENGTH) {
    throw new FeeParseError(raw.slice(0, 40), `input is ${raw.length} characters`)
  }
  const text = raw.trim()
  if (!/Euro/i.test(text)) {
    throw new FeeParseError(raw, 'no currency token; unit cannot be assumed')
  }

  AMOUNT.lastIndex = 0
  const amounts = [...text.matchAll(AMOUNT)].map((m) => toCents(m[1] as string, m[2] as string))

  if (amounts.length === 1) {
    return { kind: 'exact', centsPerHour: amounts[0] as number }
  }
  if (amounts.length === 2) {
    const [low, high] = amounts as [number, number]
    if (low >= high) throw new FeeParseError(raw, `range is not ascending: ${low}-${high}`)
    return { kind: 'range', minCentsPerHour: low, maxCentsPerHour: high }
  }
  throw new FeeParseError(raw, `expected one or two amounts, found ${amounts.length}`)
}
