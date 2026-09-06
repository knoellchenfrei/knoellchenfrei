/**
 * Wall-clock helpers for Europe/Berlin.
 *
 * Parking rules are written in local wall-clock terms ("Mo-Sa 9-20"), so every
 * comparison has to happen in Berlin time, not UTC. Berlin observes DST, which
 * rules out a fixed offset. Intl gives us the correct local parts for an instant
 * without pulling in a date library, and Temporal is not stable on Node 22 yet.
 */

const BERLIN_PARTS = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/Berlin',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
  weekday: 'short',
})

/** 0 = Sunday, matching Date#getDay. */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6

const WEEKDAYS: Record<string, Weekday> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
}

export interface BerlinWallClock {
  year: number
  /** 1-12. */
  month: number
  /** 1-31. */
  day: number
  weekday: Weekday
  /** Minutes since local midnight. */
  minuteOfDay: number
}

export function berlinWallClock(instant: Date | number): BerlinWallClock {
  const parts = BERLIN_PARTS.formatToParts(new Date(instant))
  const get = (type: Intl.DateTimeFormatPartTypes): string => {
    const part = parts.find((candidate) => candidate.type === type)
    if (part === undefined) throw new Error(`Intl did not return a "${type}" part`)
    return part.value
  }

  const weekday = WEEKDAYS[get('weekday')]
  if (weekday === undefined) throw new Error(`Unknown weekday "${get('weekday')}"`)

  return {
    year: Number(get('year')),
    month: Number(get('month')),
    day: Number(get('day')),
    weekday,
    minuteOfDay: Number(get('hour')) * 60 + Number(get('minute')),
  }
}

/** Local calendar date as `YYYY-MM-DD`, for keying holidays. */
export function berlinDateKey(clock: BerlinWallClock): string {
  const month = String(clock.month).padStart(2, '0')
  const day = String(clock.day).padStart(2, '0')
  return `${clock.year}-${month}-${day}`
}
