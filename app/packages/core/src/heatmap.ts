/**
 * Where enforcement is seen often, and where it is not.
 *
 * The live sighting layer answers "is someone there right now" and forgets
 * everything after 90 minutes — deliberately, so no movement profile can form.
 * A heatmap asks the opposite question and needs weeks of it, so it uses a
 * different data shape rather than a longer retention on the same one:
 *
 *   a mark is {day, hour, cell} — nothing else.
 *
 * No minute, no reporter, no link between two marks. A cell is 250 m, a
 * day is a Berlin calendar day, and marks older than the window are deleted.
 * That is strictly coarser than what the live layer already publishes (10 m,
 * 5 minutes) in every dimension except how long it is kept, and a tally of how
 * many marks fell in a square is a histogram, not a trace of anyone.
 */

import { berlinDateKey, berlinWallClock } from './berlin-time.js'
import type { Position } from './geo.js'

/**
 * Edge length of a grid cell, in metres.
 *
 * 250 m is roughly a Berlin block: fine enough that "this corner" and "two
 * streets over" are different cells, coarse enough that a single mark does not
 * point at a parking space. Changing it invalidates stored marks — the cell id
 * encodes the grid.
 */
export const CELL_SIZE_M = 250

/** How far back the heatmap looks. Marks older than this are deleted. */
export const HISTORY_DAYS = 28

/**
 * Recent days weigh more: enforcement patterns shift when a zone's hours change
 * or a district reassigns staff. 10 days means a mark from four weeks ago still
 * counts about a seventh of one from today — visible, not decisive.
 */
export const HALF_LIFE_DAYS = 10

/**
 * Below this many marks in the window the map shows nothing but a note.
 *
 * Three reports scattered over a city do not describe where enforcement
 * concentrates, and drawing them as a heatmap dresses noise up as knowledge.
 */
export const MIN_MARKS_FOR_PATTERN = 12

/**
 * One anonymous tally mark: a day, an hour, a grid cell. Nothing else.
 *
 * `hour` was added after the fact and is optional, so marks written before it
 * still count towards the map — they simply cannot contribute to the
 * time-of-day chart. Enforcement works shifts, so the hour is the difference
 * between "this corner is checked" and "this corner is checked at ten".
 *
 * It is the one field that made this dataset more revealing than the original
 * {day, cell}, and the trade is stated in SECURITY.md rather than buried: a
 * mark still carries no id, no reporter and no link to any other mark, and the
 * live sighting layer already publishes 10 m and five minutes to everyone. What
 * the hour adds is duration, not precision.
 */
export interface HeatMark {
  /** Berlin calendar day, `YYYY-MM-DD`. */
  day: string
  /** Grid cell id, `<x>_<y>`. */
  cell: string
  /** Berlin hour of day, 0-23. Absent on marks written before this existed. */
  hour?: number
}

/** An occupied cell with its decayed weight. */
export interface HeatCell {
  cell: string
  /** Cell centre, lon/lat. */
  centre: Position
  /** Marks in the window, undecayed. */
  marks: number
  /** Distinct days on which this cell was marked. */
  days: number
  /** Decayed weight, 0..1, normalised so the busiest cell is 1. */
  weight: number
}

export interface HeatmapOptions {
  /** Evaluation time, epoch ms. Injected so the model stays pure and testable. */
  now: number
  historyDays?: number
  halfLifeDays?: number
  /**
   * Das Raster der Stadt — `buildHeatmap` braucht es, um Zellen zu verorten;
   * `heatActivity` zählt nur Tage und Stunden und lässt es liegen.
   */
  grid?: HeatGrid
}

/**
 * Das Raster einer Stadt.
 *
 * Bis zum 9. September gab es genau eines: Ursprung 13,0/52,3 und die Breite
 * eines Längengrads auf 52,52° — Berlin. Die Zelle war damit überall 250 m
 * hoch, in Ost-West-Richtung aber in Hamburg 244 m, in Frankfurt 264 m, in
 * München 274 m breit (nachgemessen, nicht geschätzt). Für „wo wird
 * **innerhalb dieser Stadt** häufiger kontrolliert" reichte das; richtig war
 * es nicht. Seitdem trägt jede Stadt ihr Raster in `City.heatGrid`.
 *
 * Der Name steht **im Zellschlüssel** (`hamburg:12_34`), und das ist die
 * Migration: Eine Markierung aus einem anderen Raster wird beim Lesen
 * verworfen, statt an einer falschen Stelle gezeichnet — auch dann, wenn die
 * D1-Migration, die alte Zeilen löscht, noch nicht gelaufen ist. Berlins
 * Raster ist das alte und trägt keinen Namen: Seine Schlüssel bleiben Byte für
 * Byte, was sie waren (`109_97` für die Stadtmitte), und die gespeicherten
 * Berliner Markierungen gelten weiter.
 *
 * Der Ursprung ist fest und steht in der Konfiguration, nie aus den Daten
 * abgeleitet: Ein Ursprung, der mit der ersten Meldung wandert, legte dieselbe
 * Strasse bei jedem Deploy in eine andere Zelle. Und die 250 gehören nicht als
 * Meterwert in die Oberfläche — sie sind ein Rastermass, keine Messung.
 */
export interface HeatGrid {
  /** Präfix der Zellschlüssel. Leer nur für Berlin, das alte Raster. */
  readonly id: string
  readonly originLon: number
  readonly originLat: number
  /** Breitengrad, auf dem die Zelle 250 m breit ist — die Mitte der Stadt. */
  readonly latitude: number
}

const LAT_DEG_PER_M = 1 / 111_320
const lonDegPerMetre = (grid: HeatGrid): number =>
  1 / (111_320 * Math.cos((grid.latitude * Math.PI) / 180))

const DAY_MS = 86_400_000

/** `<x>_<y>`, davor bei allen Städten ausser Berlin `<raster>:`. */
const CELL_ID = /^(?:([a-z]+):)?(-?\d+)_(-?\d+)$/

/** The cell a coordinate falls in. Throws on values the grid cannot place. */
export function cellOf(point: Position, grid: HeatGrid): string {
  const [lon, lat] = point
  if (!Number.isFinite(lon) || !Number.isFinite(lat)) {
    throw new RangeError(`cellOf needs finite coordinates, got ${lon},${lat}`)
  }
  const x = Math.floor((lon - grid.originLon) / (CELL_SIZE_M * lonDegPerMetre(grid)))
  const y = Math.floor((lat - grid.originLat) / (CELL_SIZE_M * LAT_DEG_PER_M))
  return grid.id === '' ? `${x}_${y}` : `${grid.id}:${x}_${y}`
}

/**
 * Centre of a cell, for placing the heat point.
 *
 * Wirft, wenn der Schlüssel zu einem anderen Raster gehört: Eine Hamburger
 * Zelle mit Berlins Ursprung gerechnet läge in Berlin, und die Karte sähe
 * dabei nur nach einer Meldung aus, nicht nach einem Fehler.
 */
export function cellCentre(cell: string, grid: HeatGrid): Position {
  const match = CELL_ID.exec(cell)
  if (match === null) throw new RangeError(`not a cell id: ${cell}`)
  const prefix = match[1] ?? ''
  if (prefix !== grid.id) {
    throw new RangeError(`cell ${cell} belongs to grid "${prefix}", not "${grid.id}"`)
  }
  const x = Number(match[2])
  const y = Number(match[3])
  if (!Number.isInteger(x) || !Number.isInteger(y)) {
    throw new RangeError(`not a cell id: ${cell}`)
  }
  return [
    grid.originLon + (x + 0.5) * CELL_SIZE_M * lonDegPerMetre(grid),
    grid.originLat + (y + 0.5) * CELL_SIZE_M * LAT_DEG_PER_M,
  ]
}

/** The mark a report at this point and time produces. */
export function markFor(point: Position, at: Date | number, grid: HeatGrid): HeatMark {
  const clock = berlinWallClock(at)
  return {
    day: berlinDateKey(clock),
    cell: cellOf(point, grid),
    hour: Math.floor(clock.minuteOfDay / 60),
  }
}

/** 0 = Sunday, matching `Date#getDay`, derived from a `YYYY-MM-DD` key. */
export function weekdayOf(day: string): number | null {
  const at = Date.parse(`${day}T12:00:00Z`)
  if (!Number.isFinite(at)) return null
  return new Date(at).getUTCDay()
}

/** The oldest day still inside the window, as a `YYYY-MM-DD` key. */
export function windowStart(options: HeatmapOptions): string {
  const days = options.historyDays ?? HISTORY_DAYS
  return berlinDateKey(berlinWallClock(options.now - (days - 1) * DAY_MS))
}

/**
 * Age of a day key in whole days, relative to `now`.
 *
 * Computed from the calendar keys rather than from timestamps, because a mark
 * carries no time: subtracting epoch values would make a mark written at 23:00
 * a day older than one written at 01:00 on the same date.
 */
function ageInDays(day: string, now: number): number {
  const today = berlinDateKey(berlinWallClock(now))
  const asUtc = (key: string): number => Date.parse(`${key}T00:00:00Z`)
  const a = asUtc(day)
  const b = asUtc(today)
  if (!Number.isFinite(a) || !Number.isFinite(b)) return Number.POSITIVE_INFINITY
  return Math.round((b - a) / DAY_MS)
}

export interface Heatmap {
  cells: readonly HeatCell[]
  /** Marks inside the window, across all cells. */
  totalMarks: number
  /** True once there is enough to describe a pattern rather than noise. */
  hasPattern: boolean
  /** Days actually covered by the marks, 0 when empty. */
  daysCovered: number
}

/** What the report needs beyond the map: how many, how recent, and when. */
export interface HeatActivity {
  /** Marks on today's and yesterday's calendar days within 24 rolling hours. */
  last24h: number
  /** Marks in the current Berlin hour. */
  lastHour: number
  /**
   * Marks per calendar day across the window, oldest first, `historyDays`
   * entries. Needs no hour, so it is the one chart that works on marks written
   * before the hour existed — and the reason the report is not blank for
   * anyone who reported early.
   */
  byDay: readonly number[]
  /** Marks per hour of day, 24 entries, across the whole window. */
  byHour: readonly number[]
  /** The same for one weekday only; the "typical Sunday" of the report. */
  byHourOnWeekday: readonly number[]
  /** Busiest hour of `byHourOnWeekday`, or null when it is empty. */
  peakHour: number | null
  /**
   * First hour after the peak from which nothing was ever reported, or null
   * when reports run to midnight. "Meist ruhig ab 20 Uhr".
   */
  quietFrom: number | null
  /** Marks that carry an hour at all; the chart is meaningless below a few. */
  hourlyMarks: number
}

const HOURS = 24

/**
 * Time-of-day view of the same marks.
 *
 * Deliberately separate from `buildHeatmap`: the map needs a decayed spatial
 * weight, the report needs raw counts. Mixing them would make a bar chart whose
 * bars mean "recency-adjusted something" — a number nobody can read off a page.
 */
export function heatActivity(
  marks: readonly HeatMark[],
  options: HeatmapOptions,
): HeatActivity {
  const days = options.historyDays ?? HISTORY_DAYS
  const clock = berlinWallClock(options.now)
  const today = berlinDateKey(clock)
  const nowHour = Math.floor(clock.minuteOfDay / 60)
  const weekday = clock.weekday

  const byDay = new Array<number>(days).fill(0)
  const byHour = new Array<number>(HOURS).fill(0)
  const byHourOnWeekday = new Array<number>(HOURS).fill(0)
  let last24h = 0
  let lastHour = 0
  let hourlyMarks = 0

  for (const mark of marks) {
    if (typeof mark?.day !== 'string' || typeof mark?.cell !== 'string') continue
    const age = ageInDays(mark.day, options.now)
    if (!Number.isFinite(age) || age < 0 || age >= days) continue

    // Oldest on the left, today on the right — the order a reader expects of a
    // time axis, and the order the bars are drawn in.
    const slot = days - 1 - age
    byDay[slot] = (byDay[slot] ?? 0) + 1

    const hour = mark.hour
    if (typeof hour !== 'number' || !Number.isInteger(hour) || hour < 0 || hour >= HOURS) {
      continue
    }
    hourlyMarks += 1
    byHour[hour] = (byHour[hour] ?? 0) + 1
    if (weekdayOf(mark.day) === weekday) {
      byHourOnWeekday[hour] = (byHourOnWeekday[hour] ?? 0) + 1
    }

    // Rolling 24 hours, not "since midnight": at 00:30 a calendar-day count
    // would read 0 and suggest nothing had happened all night.
    if (mark.day === today ? hour <= nowHour : age === 1 && hour > nowHour) last24h += 1
    if (mark.day === today && hour === nowHour) lastHour += 1
  }

  let peakHour: number | null = null
  for (let hour = 0; hour < HOURS; hour += 1) {
    const count = byHourOnWeekday[hour] ?? 0
    if (count > 0 && (peakHour === null || count > (byHourOnWeekday[peakHour] ?? 0))) {
      peakHour = hour
    }
  }

  // The hour after the last one that ever saw a report. Found from the end
  // rather than by walking forward from the peak: the first empty hour after
  // the peak is usually a lull, not the end of the shift, and reporting it as
  // "ruhig ab 11" while reports continue at 14 would be plainly wrong.
  let quietFrom: number | null = null
  if (peakHour !== null) {
    let lastActive = HOURS - 1
    while (lastActive >= 0 && (byHourOnWeekday[lastActive] ?? 0) === 0) lastActive -= 1
    if (lastActive >= 0 && lastActive < HOURS - 1) quietFrom = lastActive + 1
  }

  return { last24h, lastHour, byDay, byHour, byHourOnWeekday, peakHour, quietFrom, hourlyMarks }
}

/**
 * Fold marks into weighted cells.
 *
 * Marks outside the window, and marks dated in the future, are dropped rather
 * than clamped: a clamped future mark would sit permanently at full weight,
 * the same bug the live sighting model had.
 */
export function buildHeatmap(
  marks: readonly HeatMark[],
  options: HeatmapOptions & { grid: HeatGrid },
): Heatmap {
  const days = options.historyDays ?? HISTORY_DAYS
  const halfLife = options.halfLifeDays ?? HALF_LIFE_DAYS

  const perCell = new Map<string, { marks: number; days: Set<string>; score: number }>()
  const seenDays = new Set<string>()
  let totalMarks = 0

  for (const mark of marks) {
    if (typeof mark?.day !== 'string' || typeof mark?.cell !== 'string') continue
    const age = ageInDays(mark.day, options.now)
    if (!Number.isFinite(age) || age < 0 || age >= days) continue

    let entry = perCell.get(mark.cell)
    if (entry === undefined) {
      entry = { marks: 0, days: new Set(), score: 0 }
      perCell.set(mark.cell, entry)
    }
    entry.marks += 1
    entry.days.add(mark.day)
    entry.score += Math.pow(0.5, age / halfLife)
    seenDays.add(mark.day)
    totalMarks += 1
  }

  let peak = 0
  for (const entry of perCell.values()) peak = Math.max(peak, entry.score)

  const cells: HeatCell[] = []
  for (const [cell, entry] of perCell) {
    let centre: Position
    try {
      centre = cellCentre(cell, options.grid)
    } catch {
      // A malformed id can only come from a corrupt store or a hostile write —
      // or, seit dem 9. September, aus einem anderen Raster: die Zeilen der
      // anderen Städte von vor der Umstellung. Sie werden verworfen, nicht
      // an einer falschen Stelle gezeichnet.
      continue
    }
    cells.push({
      cell,
      centre,
      marks: entry.marks,
      days: entry.days.size,
      weight: peak > 0 ? entry.score / peak : 0,
    })
  }

  // Busiest first, then by id so the order is stable for equal weights.
  cells.sort((a, b) => b.weight - a.weight || (a.cell < b.cell ? -1 : 1))

  return {
    cells,
    totalMarks,
    hasPattern: totalMarks >= MIN_MARKS_FOR_PATTERN,
    daysCovered: seenDays.size,
  }
}

/** Marks that have aged out and should be deleted. */
export function expiredMarks<T extends HeatMark>(
  marks: readonly T[],
  options: HeatmapOptions,
): T[] {
  const days = options.historyDays ?? HISTORY_DAYS
  return marks.filter((mark) => {
    if (typeof mark?.day !== 'string') return true
    const age = ageInDays(mark.day, options.now)
    return !Number.isFinite(age) || age >= days
  })
}
