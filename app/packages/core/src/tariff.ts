/**
 * Chargeability and cost for a parking zone.
 *
 * Zones are set by the individual Bezirk, so hours and rates differ between them
 * and even between neighbouring zones — nothing here may hardcode a city-wide
 * schedule. In the September 2026 Berlin feed rates run from 2.00 to 4.00 EUR
 * per hour; Hamburg charges 2.00 to 4.00 EUR over four zones since 1 July 2026.
 * Both fit the same model, which is the point: nothing below knows the city.
 */

import { berlinWallClock, type BerlinWallClock, type Weekday } from './berlin-time.js'
import { isAdventSaturday, isHoliday, type Land } from './holidays.js'
import type { Fee } from './parse-fee.js'

/** A chargeable window on a set of weekdays, in local minutes since midnight. */
export interface ChargeWindow {
  weekdays: readonly Weekday[]
  fromMinute: number
  /** Minutes since midnight; 1440 means "until midnight", never 0. */
  toMinute: number
}

export interface ParkingZone {
  id: string
  /** District-assigned label, e.g. "58". Unique across all 103 zones. */
  name: string
  /**
   * Bundesland der Stadt, in der die Zone liegt — entscheidet den
   * Feiertagskalender.
   *
   * Pflichtfeld ohne Vorgabewert. Ein Vorgabewert waere hier immer "BE", und
   * damit haette die erste Hamburger Zone am 8. Maerz stillschweigend
   * Berliner Feiertage benutzt: gebuehrenfrei gemeldet an einem Tag, an dem
   * Hamburg kassiert.
   */
  land: Land
  /**
   * Feste Feiertage, die zusätzlich zum Länderkalender gelten, als `MM-TT`.
   *
   * Kommt aus `City.holidays` und ist dort begründet: In Bayern gilt Mariä
   * Himmelfahrt gemeindeweise, also in München und nicht in Nürnberg. Ohne
   * dieses Feld hätte die Zone nur `land: 'BY'` — und die App verlangte am
   * 15. August in München Gebühren an einem gesetzlichen Feiertag.
   */
  extraHolidays?: readonly string[]
  fee: Fee
  windows: readonly ChargeWindow[]
  /** Maximum stay in minutes, where the zone sets one. */
  maxStayMinutes?: number
  /**
   * Whether statutory holidays are free here. True for every zone we know of,
   * but kept per-zone rather than global: the source states hours per zone, so a
   * zone that charges on holidays cannot be ruled out by the feed.
   */
  freeOnHolidays?: boolean
  /**
   * Rules the source states that this model cannot express — e.g. the Spandau
   * "Advents-Sa" extension. Non-empty means any quoted end time is incomplete
   * and the UI must say so.
   */
  unmodelledRules?: readonly string[]
}

export interface ChargeableAt {
  chargeable: boolean
  /**
   * True when a rule this model cannot express applies today, so the answer
   * above may be wrong. Set for the Spandau zones on Advent Saturdays, where
   * the source states longer hours without defining the dates.
   */
  uncertain: boolean
  /**
   * Instant at which this answer changes, or null when nothing in the next week
   * changes it. Drives "free until 09:00" and "pay until 20:00" in the UI.
   */
  changesAt: Date | null
}

const MINUTES_PER_DAY = 1440

/**
 * Statutory holidays are free.
 *
 * Sunday is deliberately NOT hardcoded here. Zone 29 (Mitte) is "Mo-So 9-24 Uhr"
 * and really does charge on Sundays; a blanket Sunday rule reported it free and
 * quoted 0 EUR for a stay that costs 4.00 EUR/h. The other 102 zones simply do
 * not list Sunday in their windows, so they stay free without a special case.
 *
 * Consequence worth stating: Easter Sunday and Whit Sunday are not statutory
 * holidays in Berlin, so zone 29 is treated as chargeable on those two days.
 * That follows from the law rather than from the feed, which says nothing about
 * holidays — it is the honest reading, not a verified one.
 */
function isFreeDay(zone: ParkingZone, clock: BerlinWallClock): boolean {
  return (zone.freeOnHolidays ?? true) && isHoliday(zone.land, clock, zone.extraHolidays)
}

function windowCovers(window: ChargeWindow, clock: BerlinWallClock): boolean {
  return (
    window.weekdays.includes(clock.weekday) &&
    clock.minuteOfDay >= window.fromMinute &&
    clock.minuteOfDay < window.toMinute
  )
}

export function isChargeable(zone: ParkingZone, at: Date | number): boolean {
  const clock = berlinWallClock(at)
  if (isFreeDay(zone, clock)) return false
  return zone.windows.some((window) => windowCovers(window, clock))
}

/**
 * Die einzige Zusatzregel, für die dieses Modul einen Kalender hat.
 *
 * `unmodelledRules` sammelt Regeln, die `ChargeWindow` nicht ausdrücken kann —
 * und das ist von Stadt zu Stadt etwas anderes. Berlin schreibt „Advents-Sa"
 * in vier Spandauer Zonen; München schreibt „an Schultagen" in 15
 * Straßenseiten. Nur für die erste Sorte lässt sich sagen, ob sie *heute*
 * greift; einen Schulkalender hat diese Datei nicht und soll sie nicht haben.
 *
 * Gefunden beim Anschluss Münchens: `isUncertainAt` fragte vorher nur, ob die
 * Liste **irgendetwas** enthält, und hätte damit an einem Adventssamstag über
 * jedem Münchner Gebiet mit Schultagsregel „unsicher" angezeigt und in der
 * Erklärung den Adventssamstag genannt — für eine Regel, die mit Advent
 * nichts zu tun hat. Der Filter macht die Kopplung sichtbar, statt sie
 * vorauszusetzen.
 */
const ADVENT_RULE = /advent/i

export function adventRulesOf(zone: ParkingZone): readonly string[] {
  return (zone.unmodelledRules ?? []).filter((rule) => ADVENT_RULE.test(rule))
}

/**
 * Whether today carries a rule the windows do not cover.
 *
 * Only "Advents-Sa" qualifies today. Saying "no fee" on those four Saturdays in
 * Spandau would be wrong at exactly the times the extra rule exists, and
 * applying it unconditionally would overcharge on the other ~48 Saturdays — so
 * the answer is marked uncertain and the UI says why.
 */
export function isUncertainAt(zone: ParkingZone, at: Date | number): boolean {
  if (adventRulesOf(zone).length === 0) return false
  const clock = berlinWallClock(at)
  if (isFreeDay(zone, clock)) return false
  return isAdventSaturday(clock)
}

/**
 * Chargeability plus the next transition.
 *
 * Scans forward one minute at a time rather than solving analytically: windows
 * are few and the search is capped at a week, and a scan stays correct across
 * DST shifts and holidays without special cases.
 */
export function chargeableAt(zone: ParkingZone, at: Date | number): ChargeableAt {
  const start = new Date(at)
  const chargeable = isChargeable(zone, start)
  const uncertain = isUncertainAt(zone, start)

  // Step to the next whole minute, then walk one minute at a time.
  let cursor = start.getTime() + (60 - start.getSeconds()) * 1000 - start.getMilliseconds()
  const limit = start.getTime() + 7 * MINUTES_PER_DAY * 60 * 1000

  while (cursor <= limit) {
    if (isChargeable(zone, cursor) !== chargeable) {
      return { chargeable, uncertain, changesAt: new Date(cursor) }
    }
    cursor += 60 * 1000
  }

  return { chargeable, uncertain, changesAt: null }
}

export interface CostEstimate {
  /** Lower bound in cents; equal to maxCents when the zone states one rate. */
  minCents: number
  maxCents: number
  /** False when the source gives a range, so the UI must not quote one figure. */
  exact: boolean
  /**
   * False, wenn die Quelle gar keinen Betrag nennt — Parkscheibe oder
   * Fehlanzeige. Dann sind `minCents` und `maxCents` beide 0, und das ist
   * **kein Preis**: Die Oberfläche darf daraus keine „0,00 €“ machen, sondern
   * muss sagen, was stattdessen gilt.
   */
  priced: boolean
  /** Minutes actually charged, excluding free periods. */
  chargedMinutes: number
  /** True when the stay exceeds the zone's maximum. */
  exceedsMaxStay: boolean
}

/**
 * Cost of parking for `durationMinutes` starting at `from`.
 *
 * Only chargeable minutes are billed, so a stay running past 20:00 or into a
 * Sunday costs less than its wall-clock length suggests.
 *
 * A zone whose source states a range yields a range. Collapsing it to one figure
 * would misquote by up to 50% in one direction or the other, and the feed gives
 * no basis for choosing.
 */
/**
 * Longest stay this will price: one week.
 *
 * The loop below walks a minute at a time, so an unbounded duration is an
 * unbounded loop. `Infinity` hung the thread outright and a million minutes
 * blocked it for seconds — both reachable the moment a duration comes from user
 * input rather than a constant.
 */
export const MAX_PRICED_MINUTES = 7 * 24 * 60

export function estimateCost(
  zone: ParkingZone,
  from: Date | number,
  durationMinutes: number
): CostEstimate {
  if (!Number.isFinite(durationMinutes) || durationMinutes < 0) {
    throw new RangeError(`durationMinutes must be a non-negative finite number, got ${durationMinutes}`)
  }
  const minutes = Math.min(Math.ceil(durationMinutes), MAX_PRICED_MINUTES)

  const start = new Date(from).getTime()
  let chargedMinutes = 0

  for (let offset = 0; offset < minutes; offset += 1) {
    if (isChargeable(zone, start + offset * 60 * 1000)) chargedMinutes += 1
  }

  const bill = (centsPerHour: number): number => Math.ceil((chargedMinutes * centsPerHour) / 60)
  const fee = zone.fee
  // Ohne Betrag wird nicht gerechnet. Ein Parkscheibengebiet mit 0 Cent zu
  // beziffern hiesse: "kostet nichts" — und wer dort ohne Scheibe steht, zahlt
  // trotzdem. `priced: false` zwingt die Oberflaeche, etwas anderes zu sagen.
  const [minCents, maxCents] =
    fee.kind === 'exact'
      ? [bill(fee.centsPerHour), bill(fee.centsPerHour)]
      : fee.kind === 'range'
        ? [bill(fee.minCentsPerHour), bill(fee.maxCentsPerHour)]
        : [0, 0]

  return {
    minCents,
    maxCents,
    exact: fee.kind === 'exact',
    priced: fee.kind === 'exact' || fee.kind === 'range',
    chargedMinutes,
    exceedsMaxStay: zone.maxStayMinutes !== undefined && minutes > zone.maxStayMinutes,
  }
}
