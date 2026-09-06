import { describe, expect, it } from 'vitest'

import {
  buildHeatmap,
  cellCentre,
  cellOf,
  CELL_SIZE_M,
  distanceMetres,
  expiredMarks,
  heatActivity,
  HISTORY_DAYS,
  markFor,
  MIN_MARKS_FOR_PATTERN,
  windowStart,
  type HeatMark,
} from '../src/index.js'

const DAY = 86_400_000
/** A Wednesday, 12:00 Berlin time (summer, UTC+2). */
const NOW = Date.UTC(2026, 8, 2, 10, 0)

/** Same day, different cells, so a test can name a spread. */
const ALEX: [number, number] = [13.4132, 52.5219]
const KOTTI: [number, number] = [13.4183, 52.4991]

function marksAt(point: [number, number], days: readonly number[]): HeatMark[] {
  return days.map((back) => markFor(point, NOW - back * DAY))
}

describe('grid', () => {
  it('places a point in a cell whose centre is within half a diagonal', () => {
    const cell = cellOf(ALEX)
    const centre = cellCentre(cell)
    // Worst case is a corner: half the diagonal of a square cell.
    expect(distanceMetres(ALEX, centre)).toBeLessThan((CELL_SIZE_M * Math.SQRT2) / 2)
  })

  it('round-trips a cell centre back to the same cell', () => {
    const cell = cellOf(KOTTI)
    expect(cellOf(cellCentre(cell))).toBe(cell)
  })

  it('separates points a block apart and keeps close points adjacent', () => {
    expect(cellOf(ALEX)).not.toBe(cellOf(KOTTI))
    // ~20 m east: the same cell, or the neighbouring one when the point sits on
    // a boundary — never further. Asserting "same cell" would encode where the
    // grid lines happen to fall rather than the guarantee we care about.
    const nearby: [number, number] = [ALEX[0] + 0.0003, ALEX[1]]
    expect(distanceMetres(cellCentre(cellOf(ALEX)), cellCentre(cellOf(nearby)))).toBeLessThanOrEqual(
      CELL_SIZE_M + 1,
    )
  })

  it('rejects coordinates it cannot place, rather than inventing a cell', () => {
    expect(() => cellOf([Number.NaN, 52.5])).toThrow(RangeError)
    expect(() => cellCentre('nonsense')).toThrow(RangeError)
  })
})

describe('marks', () => {
  it('carries a day, an hour and a cell — and nothing else', () => {
    const mark = markFor(ALEX, NOW)
    expect(Object.keys(mark).sort()).toEqual(['cell', 'day', 'hour'])
    expect(mark.day).toBe('2026-09-02')
  })

  it('keys the day by Berlin wall time, not UTC', () => {
    // 23:30 Berlin on 2 September is 21:30 UTC — a UTC key would still say the
    // 2nd here, so use the case that actually differs: 00:30 Berlin on the 3rd
    // is 22:30 UTC on the 2nd.
    const justAfterMidnight = Date.UTC(2026, 8, 2, 22, 30)
    expect(markFor(ALEX, justAfterMidnight).day).toBe('2026-09-03')
  })
})

describe('buildHeatmap', () => {
  it('is empty and admits it when there is nothing', () => {
    const heat = buildHeatmap([], { now: NOW })
    expect(heat.cells).toEqual([])
    expect(heat.totalMarks).toBe(0)
    expect(heat.hasPattern).toBe(false)
    expect(heat.daysCovered).toBe(0)
  })

  it('withholds a pattern until there is enough to describe one', () => {
    const few = marksAt(ALEX, [0, 1, 2])
    expect(buildHeatmap(few, { now: NOW }).hasPattern).toBe(false)

    const enough = marksAt(ALEX, Array.from({ length: MIN_MARKS_FOR_PATTERN }, (_, i) => i))
    expect(buildHeatmap(enough, { now: NOW }).hasPattern).toBe(true)
  })

  it('normalises the busiest cell to 1 and ranks the others below it', () => {
    const heat = buildHeatmap([...marksAt(ALEX, [0, 0, 1, 2]), ...marksAt(KOTTI, [3])], {
      now: NOW,
    })
    expect(heat.cells).toHaveLength(2)
    expect(heat.cells[0]?.weight).toBe(1)
    expect(heat.cells[0]?.cell).toBe(cellOf(ALEX))
    expect(heat.cells[1]?.weight).toBeLessThan(1)
    expect(heat.cells[1]?.weight).toBeGreaterThan(0)
  })

  it('weighs a recent mark above an old one', () => {
    const recent = buildHeatmap(marksAt(ALEX, [0]), { now: NOW })
    const old = buildHeatmap([...marksAt(ALEX, [20]), ...marksAt(KOTTI, [0])], { now: NOW })
    // Alone, either normalises to 1; the comparison has to be within one map.
    expect(recent.cells[0]?.weight).toBe(1)
    expect(old.cells[0]?.cell).toBe(cellOf(KOTTI))
  })

  it('counts distinct days separately from marks', () => {
    // Four reports, two of them on the same day: a corner checked on two days
    // is weaker evidence than one checked on four.
    const heat = buildHeatmap(marksAt(ALEX, [0, 0, 0, 5]), { now: NOW })
    expect(heat.cells[0]?.marks).toBe(4)
    expect(heat.cells[0]?.days).toBe(2)
  })

  it('drops marks that have aged out of the window', () => {
    const heat = buildHeatmap(marksAt(ALEX, [0, HISTORY_DAYS, HISTORY_DAYS + 40]), { now: NOW })
    expect(heat.totalMarks).toBe(1)
  })

  it('drops a mark dated in the future instead of clamping it', () => {
    // Clamping is what made a forged live sighting immortal; the same mistake
    // here would let one bogus mark own the map for four weeks.
    const heat = buildHeatmap([...marksAt(ALEX, [-3]), ...marksAt(KOTTI, [0])], { now: NOW })
    expect(heat.totalMarks).toBe(1)
    expect(heat.cells[0]?.cell).toBe(cellOf(KOTTI))
  })

  it('ignores malformed rows rather than failing the whole map', () => {
    const hostile = [
      { day: '2026-09-02', cell: '../elsewhere' },
      { day: 'not-a-day', cell: cellOf(ALEX) },
      null,
      { cell: cellOf(ALEX) },
    ] as unknown as HeatMark[]
    const heat = buildHeatmap([...hostile, ...marksAt(ALEX, [0])], { now: NOW })
    expect(heat.cells).toHaveLength(1)
    expect(heat.cells[0]?.marks).toBe(1)
  })

  it('orders equal weights deterministically', () => {
    const a = buildHeatmap([...marksAt(ALEX, [0]), ...marksAt(KOTTI, [0])], { now: NOW })
    const b = buildHeatmap([...marksAt(KOTTI, [0]), ...marksAt(ALEX, [0])], { now: NOW })
    expect(a.cells.map((cell) => cell.cell)).toEqual(b.cells.map((cell) => cell.cell))
  })
})

describe('retention', () => {
  it('names exactly the marks past the window', () => {
    const marks = marksAt(ALEX, [0, 27, 28, 400])
    const gone = expiredMarks(marks, { now: NOW })
    expect(gone).toHaveLength(2)
    expect(gone.every((mark) => marks.includes(mark))).toBe(true)
  })

  it('treats an unparseable day as expired, so junk cannot accumulate', () => {
    expect(expiredMarks([{ day: 'whenever', cell: '1_1' }], { now: NOW })).toHaveLength(1)
  })

  it('reports a window start the store can filter on', () => {
    expect(windowStart({ now: NOW })).toBe('2026-08-06')
    expect(windowStart({ now: NOW, historyDays: 1 })).toBe('2026-09-02')
  })
})

describe('heatActivity', () => {
  /** Marks at a given hour, `back` days ago. */
  function at(hour: number, back: number, point = ALEX): HeatMark {
    return markFor(point, NOW - back * DAY - (12 - hour) * 3_600_000)
  }

  it('is empty and says nothing when no mark carries an hour', () => {
    const legacy = [{ day: '2026-09-02', cell: cellOf(ALEX) }]
    const activity = heatActivity(legacy, { now: NOW })
    expect(activity.hourlyMarks).toBe(0)
    expect(activity.peakHour).toBeNull()
    expect(activity.byHour.every((count) => count === 0)).toBe(true)
  })

  it('records the Berlin hour a report was made', () => {
    // NOW is 12:00 Berlin.
    expect(markFor(ALEX, NOW).hour).toBe(12)
    expect(markFor(ALEX, NOW - 5 * 3_600_000).hour).toBe(7)
  })

  it('counts a rolling 24 hours, not the calendar day', () => {
    // 23:00 yesterday is inside 24 rolling hours of 12:00 today; 06:00
    // yesterday is not. A "since midnight" count would miss the first.
    const marks = [at(23, 1), at(6, 1), at(9, 0)]
    const activity = heatActivity(marks, { now: NOW })
    expect(activity.last24h).toBe(2)
  })

  it('separates the current hour from the rest of the day', () => {
    const activity = heatActivity([at(12, 0), at(12, 0), at(9, 0)], { now: NOW })
    expect(activity.lastHour).toBe(2)
  })

  it('builds a per-weekday profile, not just an overall one', () => {
    // NOW is a Wednesday. Marks seven days back land on a Wednesday too;
    // marks one day back do not.
    const marks = [at(10, 0), at(10, 7), at(15, 1)]
    const activity = heatActivity(marks, { now: NOW })
    expect(activity.byHour[10]).toBe(2)
    expect(activity.byHour[15]).toBe(1)
    expect(activity.byHourOnWeekday[10]).toBe(2)
    expect(activity.byHourOnWeekday[15]).toBe(0)
    expect(activity.peakHour).toBe(10)
  })

  it('calls a day quiet only once it stays quiet', () => {
    // A gap at 12 with reports again at 14 is a gap, not the end of a shift.
    const marks = [at(9, 0), at(10, 0), at(10, 0), at(14, 0)]
    const activity = heatActivity(marks, { now: NOW })
    expect(activity.peakHour).toBe(10)
    expect(activity.quietFrom).toBe(15)
  })

  it('reports no quiet hour when the day runs to midnight', () => {
    const marks = [at(10, 0), ...Array.from({ length: 13 }, (_, i) => at(11 + i, 0))]
    expect(heatActivity(marks, { now: NOW }).quietFrom).toBeNull()
  })

  it('ignores an out-of-range hour rather than widening the chart', () => {
    const hostile = [
      { day: '2026-09-02', cell: cellOf(ALEX), hour: 24 },
      { day: '2026-09-02', cell: cellOf(ALEX), hour: -1 },
      { day: '2026-09-02', cell: cellOf(ALEX), hour: 9.5 },
    ] as HeatMark[]
    expect(heatActivity(hostile, { now: NOW }).hourlyMarks).toBe(0)
  })
})

describe('heatActivity.byDay', () => {
  it('counts per calendar day, oldest first, today last', () => {
    const marks = [
      ...marksAt(ALEX, [0, 0]),
      ...marksAt(ALEX, [1]),
      ...marksAt(KOTTI, [HISTORY_DAYS - 1]),
    ]
    const { byDay } = heatActivity(marks, { now: NOW })
    expect(byDay).toHaveLength(HISTORY_DAYS)
    expect(byDay[HISTORY_DAYS - 1]).toBe(2)
    expect(byDay[HISTORY_DAYS - 2]).toBe(1)
    expect(byDay[0]).toBe(1)
  })

  it('works on marks that carry no hour at all', () => {
    // The case that made the report blank for anyone who reported before the
    // hour existed: a day histogram needs no time of day.
    const legacy = [
      { day: '2026-09-02', cell: cellOf(ALEX) },
      { day: '2026-09-01', cell: cellOf(ALEX) },
    ]
    const activity = heatActivity(legacy, { now: NOW })
    expect(activity.hourlyMarks).toBe(0)
    expect(activity.byDay.reduce((sum, count) => sum + count, 0)).toBe(2)
  })
})
