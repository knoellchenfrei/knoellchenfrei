import { describe, expect, it } from 'vitest'

import { BERLIN, cellOf, zoneStats, type HeatMark, type PolygonRings } from '../src/index.js'

const GRID = BERLIN.heatGrid
/** Ein Mittwoch, 12:00 Berliner Zeit (Sommer, UTC+2). */
const NOW = Date.UTC(2026, 8, 2, 10, 0)
const DAY = 86_400_000

/** Ein Rechteck um den Alexanderplatz, etwa 1,3 × 0,9 km. */
const ZONE: PolygonRings[] = [
  [
    [
      [13.405, 52.518],
      [13.425, 52.518],
      [13.425, 52.526],
      [13.405, 52.526],
      [13.405, 52.518],
    ],
  ],
]
const ALEX: [number, number] = [13.4132, 52.5219]
const FERN: [number, number] = [13.3777, 52.5163] // Brandenburger Tor, ausserhalb

const dayKey = (offset: number): string =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin' }).format(new Date(NOW - offset * DAY))

const mark = (point: [number, number], offset: number, hour?: number): HeatMark => ({
  day: dayKey(offset),
  cell: cellOf(point, GRID),
  ...(hour === undefined ? {} : { hour }),
})

describe('zoneStats', () => {
  it('zählt nur Felder, deren Mittelpunkt in der Zone liegt', () => {
    const marks = [mark(ALEX, 0, 9), mark(ALEX, 0, 11), mark(FERN, 0, 10)]
    const stats = zoneStats(marks, ZONE, { now: NOW, grid: GRID })
    expect(stats.today).toBe(2)
    expect(stats.days7).toBe(2)
    expect(stats.days28).toBe(2)
  })

  it('teilt heute, sieben und 28 Tage sauber und legt die Balken ältester zuerst', () => {
    const marks = [
      mark(ALEX, 0, 9),
      mark(ALEX, 1, 9),
      mark(ALEX, 6, 9),
      mark(ALEX, 7, 9), // ausserhalb der sieben, innerhalb der 28
      mark(ALEX, 27, 9),
      mark(ALEX, 28, 9), // ausserhalb des Fensters
    ]
    const stats = zoneStats(marks, ZONE, { now: NOW, grid: GRID })
    expect(stats.today).toBe(1)
    expect(stats.days7).toBe(3)
    expect(stats.days28).toBe(5)
    expect(stats.byDay).toEqual([1, 0, 0, 0, 0, 1, 1])
  })

  it('nennt den jüngsten Strich, mit Stunde wenn eine da ist', () => {
    const marks = [mark(ALEX, 2, 15), mark(ALEX, 1), mark(ALEX, 1, 8), mark(ALEX, 1, 17)]
    const stats = zoneStats(marks, ZONE, { now: NOW, grid: GRID })
    expect(stats.last).toEqual({ day: dayKey(1), hour: 17, ageDays: 1 })
  })

  it('ist ohne Striche leer statt kaputt', () => {
    const stats = zoneStats([], ZONE, { now: NOW, grid: GRID })
    expect(stats).toEqual({ today: 0, days7: 0, days28: 0, byDay: [0, 0, 0, 0, 0, 0, 0], last: null })
  })

  it('ignoriert Striche eines fremden Rasters und kaputte Zeilen', () => {
    const marks = [
      { day: dayKey(0), cell: 'hamburg:12_34', hour: 9 },
      { day: 'nicht-ein-tag', cell: cellOf(ALEX, GRID) },
      { day: dayKey(0), cell: 'kein_raster' },
      mark(ALEX, 0, 9),
    ] as HeatMark[]
    expect(zoneStats(marks, ZONE, { now: NOW, grid: GRID }).today).toBe(1)
  })
})
