/**
 * Parser for the WFS `zeiten` field.
 *
 * The authoritative Berlin feed carries opening hours as free text, not
 * structured data: 103 zones, 18 distinct spellings of roughly 10 real
 * schedules. Everything here is driven by strings that actually occur in the
 * feed — see test/fixtures/parkzonen-2026-09-06.json.
 *
 * The central trap is that "/" and "," are OVERLOADED. In "Mo-Fr 9-20 Uhr / Sa
 * 9-18 Uhr" the slash separates two clauses; in "Mo-Sa / 9-20 Uhr" it separates
 * the day spec from the hours of a single clause. Splitting on the separator
 * therefore destroys four zones (46, 65, 68, 69). Instead we scan for whole
 * day-plus-hours matches and treat anything left over as a parse failure.
 */

import type { Weekday } from './berlin-time.js'
import type { ChargeWindow } from './tariff.js'

/** Feed spellings, in feed order Mo..So. Index maps to Weekday via DAY_TO_WEEKDAY. */
const DAY_TOKENS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'] as const
const DAY_TO_WEEKDAY: readonly Weekday[] = [1, 2, 3, 4, 5, 6, 0]

/**
 * One clause: an optional "Advents-" qualifier, a day or day range, an optional
 * separator standing between day spec and hours, then an hour range and an
 * optional "Uhr".
 *
 * `\s*-\s*` inside the time range is load-bearing: zones 10-13 spell it "9 -14"
 * with a space before the hyphen. Collapsing whitespace beforehand does NOT fix
 * that — it is a single space, not a run.
 *
 * Minutes are optional because the two Berlin feeds disagree: the zone service
 * writes "9-20", the street-segment service writes "09:00-20:00" for the same
 * schedule.
 */
const CLAUSE = new RegExp(
  String.raw`(Advents)?-?\s*` +
    String.raw`(Mo|Di|Mi|Do|Fr|Sa|So)` +
    String.raw`(?:\s*-\s*(Mo|Di|Mi|Do|Fr|Sa|So))?` +
    String.raw`[\s,/]*` +
    String.raw`(\d{1,2})(?::(\d{2}))?\s*-\s*(\d{1,2})(?::(\d{2}))?` +
    String.raw`\s*(?:Uhr)?`,
  'g'
)

export interface ParsedSchedule {
  windows: ChargeWindow[]
  /**
   * Rules present in the source that ChargeWindow cannot express, kept so the UI
   * can disclose them instead of quoting an end time that is wrong for part of
   * the year.
   */
  unmodelledRules: string[]
  /** Set when the source string was itself malformed but still readable. */
  sourceDefect?: string
}

export class ScheduleParseError extends Error {
  constructor(
    readonly raw: string,
    reason: string
  ) {
    super(`Cannot parse zeiten ${JSON.stringify(raw)}: ${reason}`)
    this.name = 'ScheduleParseError'
  }
}

/**
 * `raw` nur, um im Fehlerfall die richtige Klasse werfen zu koennen.
 *
 * Gefunden beim Beschuss mit Zufallszeichenketten: `Fr-Mo 9-20 Uhr` warf ein
 * blankes `Error`, kein `ScheduleParseError` — und eine umgedrehte Tagesspanne
 * ist Feed-Inhalt, kein Fehler des Parsers. Wer `catch (e) { if (e instanceof
 * ScheduleParseError) ... }` schreibt, haette genau diese eine Feed-Schreibweise
 * als Absturz statt als unlesbare Zeile behandelt, und `raw` fehlte im Fehler
 * obendrein.
 */
function expandDays(raw: string, from: string, to: string | undefined): Weekday[] {
  const start = DAY_TOKENS.indexOf(from as (typeof DAY_TOKENS)[number])
  if (start < 0) throw new ScheduleParseError(raw, `unknown day token ${from}`)
  if (to === undefined) return [DAY_TO_WEEKDAY[start] as Weekday]

  const end = DAY_TOKENS.indexOf(to as (typeof DAY_TOKENS)[number])
  if (end < start) throw new ScheduleParseError(raw, `inverted day range ${from}-${to}`)
  return DAY_TOKENS.slice(start, end + 1).map(
    (_, offset) => DAY_TO_WEEKDAY[start + offset] as Weekday
  )
}

/**
 * Collapse a string that is exactly itself twice.
 * Zone 54 reads "Mo-Sa 9-22 UhrMo-Sa 9-22 Uhr" — a data-entry error in the feed.
 */
function undouble(raw: string): { text: string; defect?: string } {
  const half = raw.length / 2
  if (raw.length % 2 === 0 && raw.slice(0, half) === raw.slice(half)) {
    return { text: raw.slice(0, half), defect: 'source string was duplicated' }
  }
  return { text: raw }
}

/**
 * Longest input treated as a schedule.
 *
 * The longest real value in either Berlin feed is 51 characters. Bounding the
 * input is what actually removes the backtracking risk — tightening the pattern
 * helped, but a 100k-character string still took seconds to reject, and this
 * parser runs over data we do not control.
 */
const MAX_INPUT_LENGTH = 200

export function parseSchedule(raw: string): ParsedSchedule {
  if (raw.length > MAX_INPUT_LENGTH) {
    throw new ScheduleParseError(
      raw.slice(0, 60),
      `input is ${raw.length} characters; no real schedule exceeds ${MAX_INPUT_LENGTH}`
    )
  }
  const { text, defect } = undouble(raw.trim())

  const windows: ChargeWindow[] = []
  const unmodelledRules: string[] = []
  let match: RegExpExecArray | null

  CLAUSE.lastIndex = 0
  while ((match = CLAUSE.exec(text)) !== null) {
    const [whole, advents, dayFrom, dayTo, fromHour, fromMin, toHour, toMin] = match
    const from = Number(fromHour) * 60 + Number(fromMin ?? 0)
    const to = Number(toHour) * 60 + Number(toMin ?? 0)
    // An end hour of 24 means midnight-end, i.e. minute 1440 — never 0. Ten
    // zones close at 24; mapping it to 0 would zero their whole evening.
    // Minutes above 59 would silently roll into the next hour.
    if (Number(fromMin ?? 0) > 59 || Number(toMin ?? 0) > 59) {
      throw new ScheduleParseError(raw, `invalid minutes in ${whole.trim()}`)
    }
    if (!(from >= 0 && from < to && to <= 1440)) {
      throw new ScheduleParseError(raw, `implausible time range ${fromHour}-${toHour}`)
    }

    const weekdays = expandDays(raw, dayFrom as string, dayTo)

    if (advents !== undefined) {
      // "Advents-Sa" restricts a window to Advent Saturdays. ChargeWindow has no
      // date qualifier, and which Saturdays count is not defined by the source,
      // so we record it rather than guess. Emitting it unqualified would
      // over-charge on ~48 ordinary Saturdays a year.
      unmodelledRules.push(whole.trim())
      continue
    }

    windows.push({ weekdays, fromMinute: from, toMinute: to })
  }

  if (windows.length === 0) {
    throw new ScheduleParseError(raw, 'no recognisable day-and-hours clause')
  }

  // Everything not consumed by a clause must be separator noise. Anything else
  // means the feed carries a rule we have not modelled — fail loudly rather than
  // silently dropping it.
  const leftover = text.replace(CLAUSE, '').replace(/[\s,/]/g, '')
  if (leftover.length > 0) {
    throw new ScheduleParseError(raw, `unrecognised remainder ${JSON.stringify(leftover)}`)
  }
  return defect === undefined
    ? { windows, unmodelledRules }
    : { windows, unmodelledRules, sourceDefect: defect }
}
