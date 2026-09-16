import { currencyOf, type CostEstimate, type Currency, type Fee } from '@knoellchenfrei/core'

/**
 * Ein Formatierer je Währung. Bis zum 16. September gab es nur den Euro;
 * Zürich zahlt Franken, und „2,50 €" für einen Zürcher Tarif wäre eine
 * Zahl mit der falschen Einheit — schlimmer als keine.
 */
const MONEY: Record<Currency, Intl.NumberFormat> = {
  EUR: new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }),
  CHF: new Intl.NumberFormat('de-CH', { style: 'currency', currency: 'CHF' }),
}
const CLOCK = new Intl.DateTimeFormat('de-DE', {
  timeZone: 'Europe/Berlin',
  hour: '2-digit',
  minute: '2-digit',
})
const WEEKDAY_CLOCK = new Intl.DateTimeFormat('de-DE', {
  timeZone: 'Europe/Berlin',
  weekday: 'short',
  hour: '2-digit',
  minute: '2-digit',
})

export const money = (cents: number, currency: Currency = 'EUR'): string =>
  MONEY[currency].format(cents / 100)
/** Nur noch für Beträge, die sicher Euro sind (der Parkzähler in Berlin). */
export const euro = (cents: number): string => money(cents, 'EUR')
export const clock = (at: Date): string => CLOCK.format(at)

/**
 * "bis 20:00" for today, "bis Sa 09:00" once it crosses into another day.
 *
 * Midnight is written as 24:00 of the day before rather than 00:00 of the next:
 * a zone that charges until midnight reads "bis 24:00" on the parking sign, and
 * "bis Mo 00:00" on a Sunday evening looks like a different day entirely.
 */
export function until(at: Date, from: Date): string {
  if (CLOCK.format(at) === '00:00') {
    const before = new Date(at.getTime() - 60_000)
    const sameDayAsFrom =
      new Intl.DateTimeFormat('de-DE', { timeZone: 'Europe/Berlin', day: 'numeric' }).format(
        before
      ) === new Intl.DateTimeFormat('de-DE', { timeZone: 'Europe/Berlin', day: 'numeric' }).format(from)
    if (sameDayAsFrom) return '24:00'
  }
  return untilRaw(at, from)
}

function untilRaw(at: Date, from: Date): string {
  const sameDay = CLOCK.resolvedOptions().timeZone
    ? new Intl.DateTimeFormat('de-DE', { timeZone: 'Europe/Berlin', day: 'numeric' }).format(at) ===
      new Intl.DateTimeFormat('de-DE', { timeZone: 'Europe/Berlin', day: 'numeric' }).format(from)
    : false
  return sameDay ? CLOCK.format(at) : WEEKDAY_CLOCK.format(at)
}

/**
 * A fee range must read as a range — quoting one figure misprices by up to 50%.
 *
 * „Parkscheibe" und „nicht angegeben" bekommen Worte statt einer Null: 0,00 €
 * läse sich als „hier ist nichts zu beachten", und beides heißt das Gegenteil.
 */
export function feeLabel(fee: Fee): string {
  switch (fee.kind) {
    case 'exact':
      return `${money(fee.centsPerHour, currencyOf(fee))}/Std.`
    case 'range':
      return `${money(fee.minCentsPerHour, currencyOf(fee))}–${money(fee.maxCentsPerHour, currencyOf(fee))}/Std.`
    case 'disc':
      return 'Parkscheibe'
    case 'unknown':
      return 'Tarif nicht angegeben'
  }
}

export function duration(ms: number): string {
  const totalMinutes = Math.max(0, Math.floor(ms / 60000))
  // "0 Min." reads as "no time at all" when there is still most of a minute
  // left, which matters on a countdown.
  if (totalMinutes === 0) return 'unter einer Minute'
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  // "1 Std. 0 Min." on the hour reads like a rounding artefact; "1 Std." does not.
  if (hours > 0) return minutes === 0 ? `${hours} Std.` : `${hours} Std. ${minutes} Min.`
  return `${minutes} Min.`
}

/**
 * Die Codes, die in den Zonendaten stehen, als Minuten.
 *
 * `5h` kam mit Frankfurt dazu (Bereich 26, zwei Automaten am Riedhof). Es
 * fehlen zu lassen hätte nichts sichtbar kaputt gemacht: `toParkingZone` hätte
 * dort still keine Höchstparkdauer gesetzt, die Anzeige hätte sie trotzdem
 * genannt, und nur die Kostenschätzung wäre unbegrenzt weitergelaufen.
 */
export const MAX_STAY_MINUTES: Record<string, number> = {
  '30min': 30,
  '1h': 60,
  '2h': 120,
  '3h': 180,
  '4h': 240,
  '5h': 300,
}

/** "4h" → "4 Std.", "30min" → "30 Min." — the feed's codes are not German prose. */
export function maxStayLabel(code: string): string {
  const match = /^(\d+)(min|h)$/.exec(code)
  if (match === null) return code
  return match[2] === 'h' ? `${match[1]} Std.` : `${match[1]} Min.`
}

/**
 * The POI feed writes "1 Plätze" and pads some opening hours with double
 * spaces; both are the source's, but neither should reach the popup as is.
 */
export function tidyPoiDetail(detail: string): string {
  return detail.replace(/^1 Plätze\b/, '1 Platz').replace(/\s{2,}/g, ' ').trim()
}

/**
 * Das eine Wort über den Zustand einer Zone: „unsicher", „gebührenpflichtig"
 * oder „keine Gebühr" — die Marke im Panel und die Peek-Zeile im
 * eingeklappten Griff sagen dasselbe, weil sie hierher greifen. Vorher stand
 * die Dreifachweiche nur im Panel; eine zweite Abschrift wäre die Stelle, an
 * der die Wortwahl eines Tages auseinanderläuft.
 *
 * „unsicher" gewinnt gegen beides: Eine Regel, die die App nicht rechnen kann,
 * macht auch aus „gebührenpflichtig" eine Vermutung.
 */
export function statusLabel(status: {
  chargeable: boolean
  uncertain: boolean
  unknown?: boolean
}): string {
  // „Zeiten unbekannt" gewinnt gegen alles: Wo die Quelle keine Zeiten
  // nennt, ist „keine Gebühr" keine Auskunft, sondern eine Behauptung.
  if (status.unknown === true) return 'Zeiten unbekannt'
  return status.uncertain ? 'unsicher' : status.chargeable ? 'gebührenpflichtig' : 'keine Gebühr'
}

/**
 * Der Betrag für die nächste Stunde, wie das Panel ihn nennt: eine Zahl bei
 * festem Satz, eine Spanne, wenn die Quelle eine nennt. Nur für `priced`
 * gedacht — bei Parkscheibe oder fehlendem Tarif sind beide Werte 0, und die
 * Aufrufer sagen dann etwas anderes statt „0,00 €" (siehe `feeLabel`).
 */
export function costLabel(
  estimate: Pick<CostEstimate, 'minCents' | 'maxCents' | 'exact'> & Partial<Pick<CostEstimate, 'currency'>>
): string {
  const currency = estimate.currency ?? 'EUR'
  return estimate.exact
    ? money(estimate.maxCents, currency)
    : `${money(estimate.minCents, currency)}–${money(estimate.maxCents, currency)}`
}
