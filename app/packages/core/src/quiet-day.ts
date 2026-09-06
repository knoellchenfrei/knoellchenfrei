/**
 * Warum gerade so wenige Zonen kassieren.
 *
 * „1 von 103 Zonen kassieren gerade" sieht an einem Sonntagvormittag aus wie
 * ein Fehler und ist doch richtig. Die Zahl braucht also gelegentlich einen
 * Satz daneben — aber nur dann, und ohne dass irgendwo „Berlin" oder „Sonntag"
 * im Code steht.
 *
 * Alles hier wird **aus den geladenen Fahrplänen abgeleitet**: an welchen
 * Wochentagen die Mehrheit überhaupt kassiert und ab wann. Eine zweite Stadt
 * mit anderen Gewohnheiten bekommt denselben Hinweis mit ihren eigenen Zahlen,
 * ohne dass eine Zeile geändert wird. Genau deshalb steht das hier und nicht
 * als Text in der Oberfläche.
 */

import { berlinWallClock, type Weekday } from './berlin-time.js'
import { isChargeable, type ParkingZone } from './tariff.js'

export type QuietReason =
  /** Heute ist kein üblicher Kassiertag — Sonntag in Berlin, anderswo anders. */
  | 'restDay'
  /** Üblicher Tag, aber die Bewirtschaftung hat noch nicht begonnen. */
  | 'beforeHours'
  /** Üblicher Tag, aber sie ist vorbei. */
  | 'afterHours'

export interface QuietDay {
  reason: QuietReason
  /** Wie viele Zonen gerade kassieren. */
  chargeable: number
  total: number
  /** Übliche Start- bzw. Endstunde der Mehrheit, für die Textbausteine. */
  usualStartHour: number
  usualEndHour: number
  /**
   * Die Zonen, die trotzdem kassieren — aber nur, wenn es so wenige sind, dass
   * eine Aufzählung hilft. Sonst leer.
   */
  exceptions: readonly string[]
}

export interface QuietDayOptions {
  now: number
  /**
   * Bis zu welchem Anteil kassierender Zonen die Zahl erklärungsbedürftig ist.
   * Darüber ist ein normaler Betriebszustand und der Hinweis nur im Weg.
   */
  quietBelow?: number
  /** Ab wie vielen Ausnahmen die Aufzählung mehr verwirrt als hilft. */
  maxExceptions?: number
}

const DEFAULT_QUIET_BELOW = 0.15
const DEFAULT_MAX_EXCEPTIONS = 3

/** Ein Wochentag gilt als üblich, wenn ihn die Mehrheit der Zonen bewirtschaftet. */
const USUAL_DAY_SHARE = 0.5

function median(values: number[]): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0
    ? Math.round(((sorted[middle - 1] as number) + (sorted[middle] as number)) / 2)
    : (sorted[middle] as number)
}

/**
 * Erklärt eine auffällig niedrige Zahl kassierender Zonen — oder gibt `null`
 * zurück, wenn es nichts zu erklären gibt.
 *
 * `null` ist der Normalfall und wichtiger als die Erklärung: Ein Hinweis, der
 * immer dasteht, wird zu Tapete und nimmt Platz weg, den auf einem Handy die
 * Karte braucht.
 */
export function quietDayNote(
  zones: readonly ParkingZone[],
  options: QuietDayOptions,
): QuietDay | null {
  const total = zones.length
  if (total === 0) return null

  const quietBelow = options.quietBelow ?? DEFAULT_QUIET_BELOW
  const maxExceptions = options.maxExceptions ?? DEFAULT_MAX_EXCEPTIONS

  const charging = zones.filter((zone) => isChargeable(zone, options.now))
  if (charging.length / total > quietBelow) return null

  const clock = berlinWallClock(options.now)
  const today = clock.weekday

  // Fenster, die den heutigen Wochentag abdecken — daraus ergibt sich beides:
  // ob heute überhaupt ein Kassiertag ist, und ab wann.
  const todaysWindows = zones.flatMap((zone) =>
    zone.windows.filter((window) => window.weekdays.includes(today)),
  )
  const zonesWithToday = zones.filter((zone) =>
    zone.windows.some((window) => window.weekdays.includes(today)),
  ).length

  const exceptions =
    charging.length > 0 && charging.length <= maxExceptions
      ? charging.map((zone) => zone.name)
      : []

  // Für die Stunden zählt der übliche Wochentag, nicht der heutige: An einem
  // Ruhetag gibt es keine heutigen Fenster, die Antwort „ab wann sonst" ist
  // aber genau die interessante.
  const referenceWindows =
    todaysWindows.length > 0
      ? todaysWindows
      : zones.flatMap((zone) => [...zone.windows])
  const usualStartHour = Math.floor(median(referenceWindows.map((w) => w.fromMinute)) / 60)
  const usualEndHour = Math.floor(median(referenceWindows.map((w) => w.toMinute)) / 60)

  const base = { chargeable: charging.length, total, usualStartHour, usualEndHour, exceptions }

  if (zonesWithToday / total <= USUAL_DAY_SHARE) {
    return { ...base, reason: 'restDay' }
  }
  if (clock.minuteOfDay < median(todaysWindows.map((w) => w.fromMinute))) {
    return { ...base, reason: 'beforeHours' }
  }
  if (clock.minuteOfDay >= median(todaysWindows.map((w) => w.toMinute))) {
    return { ...base, reason: 'afterHours' }
  }
  // Mitten in der üblichen Zeit und trotzdem fast nichts aktiv: dafür haben wir
  // keine Erklärung, und eine zu erfinden wäre schlechter als zu schweigen.
  return null
}
