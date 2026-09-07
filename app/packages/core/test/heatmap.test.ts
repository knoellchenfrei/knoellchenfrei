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
  weekdayOf,
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
  it('legt einen Punkt in eine Zelle, deren Mittelpunkt keine halbe Diagonale entfernt ist', () => {
    const cell = cellOf(ALEX)
    const centre = cellCentre(cell)
    // Worst case is a corner: half the diagonal of a square cell.
    expect(distanceMetres(ALEX, centre)).toBeLessThan((CELL_SIZE_M * Math.SQRT2) / 2)
  })

  it('führt einen Zellmittelpunkt in dieselbe Zelle zurück', () => {
    const cell = cellOf(KOTTI)
    expect(cellOf(cellCentre(cell))).toBe(cell)
  })

  it('trennt Punkte einen Block auseinander und hält nahe Punkte benachbart', () => {
    expect(cellOf(ALEX)).not.toBe(cellOf(KOTTI))
    // ~20 m east: the same cell, or the neighbouring one when the point sits on
    // a boundary — never further. Asserting "same cell" would encode where the
    // grid lines happen to fall rather than the guarantee we care about.
    const nearby: [number, number] = [ALEX[0] + 0.0003, ALEX[1]]
    expect(distanceMetres(cellCentre(cellOf(ALEX)), cellCentre(cellOf(nearby)))).toBeLessThanOrEqual(
      CELL_SIZE_M + 1,
    )
  })

  it('weist Koordinaten ab, die es nicht einordnen kann, statt eine Zelle zu erfinden', () => {
    expect(() => cellOf([Number.NaN, 52.5])).toThrow(RangeError)
    expect(() => cellCentre('nonsense')).toThrow(RangeError)
  })
})

describe('marks', () => {
  it('trägt einen Tag, eine Stunde und eine Zelle — und sonst nichts', () => {
    const mark = markFor(ALEX, NOW)
    expect(Object.keys(mark).sort()).toEqual(['cell', 'day', 'hour'])
    expect(mark.day).toBe('2026-09-02')
  })

  it('schlüsselt den Tag nach Berliner Ortszeit, nicht nach UTC', () => {
    // 23:30 Berlin on 2 September is 21:30 UTC — a UTC key would still say the
    // 2nd here, so use the case that actually differs: 00:30 Berlin on the 3rd
    // is 22:30 UTC on the 2nd.
    const justAfterMidnight = Date.UTC(2026, 8, 2, 22, 30)
    expect(markFor(ALEX, justAfterMidnight).day).toBe('2026-09-03')
  })
})

describe('buildHeatmap', () => {
  it('ist leer und sagt das auch, wenn nichts da ist', () => {
    const heat = buildHeatmap([], { now: NOW })
    expect(heat.cells).toEqual([])
    expect(heat.totalMarks).toBe(0)
    expect(heat.hasPattern).toBe(false)
    expect(heat.daysCovered).toBe(0)
  })

  it('hält ein Muster zurück, bis genug da ist, um eines zu beschreiben', () => {
    const few = marksAt(ALEX, [0, 1, 2])
    expect(buildHeatmap(few, { now: NOW }).hasPattern).toBe(false)

    const enough = marksAt(ALEX, Array.from({ length: MIN_MARKS_FOR_PATTERN }, (_, i) => i))
    expect(buildHeatmap(enough, { now: NOW }).hasPattern).toBe(true)
  })

  it('normiert die belebteste Zelle auf 1 und ordnet die anderen darunter ein', () => {
    const heat = buildHeatmap([...marksAt(ALEX, [0, 0, 1, 2]), ...marksAt(KOTTI, [3])], {
      now: NOW,
    })
    expect(heat.cells).toHaveLength(2)
    expect(heat.cells[0]?.weight).toBe(1)
    expect(heat.cells[0]?.cell).toBe(cellOf(ALEX))
    expect(heat.cells[1]?.weight).toBeLessThan(1)
    expect(heat.cells[1]?.weight).toBeGreaterThan(0)
  })

  it('gewichtet einen frischen Strich höher als einen alten', () => {
    const recent = buildHeatmap(marksAt(ALEX, [0]), { now: NOW })
    const old = buildHeatmap([...marksAt(ALEX, [20]), ...marksAt(KOTTI, [0])], { now: NOW })
    // Alone, either normalises to 1; the comparison has to be within one map.
    expect(recent.cells[0]?.weight).toBe(1)
    expect(old.cells[0]?.cell).toBe(cellOf(KOTTI))
  })

  it('zählt verschiedene Tage getrennt von den Strichen', () => {
    // Four reports, two of them on the same day: a corner checked on two days
    // is weaker evidence than one checked on four.
    const heat = buildHeatmap(marksAt(ALEX, [0, 0, 0, 5]), { now: NOW })
    expect(heat.cells[0]?.marks).toBe(4)
    expect(heat.cells[0]?.days).toBe(2)
  })

  it('wirft Striche weg, die aus dem Fenster gealtert sind', () => {
    const heat = buildHeatmap(marksAt(ALEX, [0, HISTORY_DAYS, HISTORY_DAYS + 40]), { now: NOW })
    expect(heat.totalMarks).toBe(1)
  })

  it('wirft einen Strich aus der Zukunft weg, statt ihn zu klemmen', () => {
    // Clamping is what made a forged live sighting immortal; the same mistake
    // here would let one bogus mark own the map for four weeks.
    const heat = buildHeatmap([...marksAt(ALEX, [-3]), ...marksAt(KOTTI, [0])], { now: NOW })
    expect(heat.totalMarks).toBe(1)
    expect(heat.cells[0]?.cell).toBe(cellOf(KOTTI))
  })

  it('übergeht fehlerhafte Zeilen, statt die ganze Karte scheitern zu lassen', () => {
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

  it('ordnet gleiche Gewichte vorhersagbar', () => {
    const a = buildHeatmap([...marksAt(ALEX, [0]), ...marksAt(KOTTI, [0])], { now: NOW })
    const b = buildHeatmap([...marksAt(KOTTI, [0]), ...marksAt(ALEX, [0])], { now: NOW })
    expect(a.cells.map((cell) => cell.cell)).toEqual(b.cells.map((cell) => cell.cell))
  })
})

describe('retention', () => {
  it('nennt genau die Striche jenseits des Fensters', () => {
    const marks = marksAt(ALEX, [0, 27, 28, 400])
    const gone = expiredMarks(marks, { now: NOW })
    expect(gone).toHaveLength(2)
    expect(gone.every((mark) => marks.includes(mark))).toBe(true)
  })

  it('behandelt einen unlesbaren Tag als verfallen, damit sich kein Unrat ansammelt', () => {
    expect(expiredMarks([{ day: 'whenever', cell: '1_1' }], { now: NOW })).toHaveLength(1)
  })

  it('meldet einen Fensteranfang, nach dem der Speicher filtern kann', () => {
    expect(windowStart({ now: NOW })).toBe('2026-08-06')
    expect(windowStart({ now: NOW, historyDays: 1 })).toBe('2026-09-02')
  })
})

describe('heatActivity', () => {
  /** Marks at a given hour, `back` days ago. */
  function at(hour: number, back: number, point = ALEX): HeatMark {
    return markFor(point, NOW - back * DAY - (12 - hour) * 3_600_000)
  }

  it('ist leer und sagt nichts, wenn kein Strich eine Stunde trägt', () => {
    const legacy = [{ day: '2026-09-02', cell: cellOf(ALEX) }]
    const activity = heatActivity(legacy, { now: NOW })
    expect(activity.hourlyMarks).toBe(0)
    expect(activity.peakHour).toBeNull()
    expect(activity.byHour.every((count) => count === 0)).toBe(true)
  })

  it('hält die Berliner Stunde fest, in der gemeldet wurde', () => {
    // NOW is 12:00 Berlin.
    expect(markFor(ALEX, NOW).hour).toBe(12)
    expect(markFor(ALEX, NOW - 5 * 3_600_000).hour).toBe(7)
  })

  it('zählt 24 rollende Stunden, nicht den Kalendertag', () => {
    // 23:00 yesterday is inside 24 rolling hours of 12:00 today; 06:00
    // yesterday is not. A "since midnight" count would miss the first.
    const marks = [at(23, 1), at(6, 1), at(9, 0)]
    const activity = heatActivity(marks, { now: NOW })
    expect(activity.last24h).toBe(2)
  })

  it('trennt die laufende Stunde vom Rest des Tages', () => {
    const activity = heatActivity([at(12, 0), at(12, 0), at(9, 0)], { now: NOW })
    expect(activity.lastHour).toBe(2)
  })

  it('baut ein Profil je Wochentag, nicht nur ein Gesamtprofil', () => {
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

  it('nennt einen Tag erst ruhig, wenn er ruhig bleibt', () => {
    // A gap at 12 with reports again at 14 is a gap, not the end of a shift.
    const marks = [at(9, 0), at(10, 0), at(10, 0), at(14, 0)]
    const activity = heatActivity(marks, { now: NOW })
    expect(activity.peakHour).toBe(10)
    expect(activity.quietFrom).toBe(15)
  })

  it('meldet keine ruhige Stunde, wenn der Tag bis Mitternacht läuft', () => {
    const marks = [at(10, 0), ...Array.from({ length: 13 }, (_, i) => at(11 + i, 0))]
    expect(heatActivity(marks, { now: NOW }).quietFrom).toBeNull()
  })

  it('übergeht eine Stunde außerhalb des Bereichs, statt das Diagramm zu weiten', () => {
    const hostile = [
      { day: '2026-09-02', cell: cellOf(ALEX), hour: 24 },
      { day: '2026-09-02', cell: cellOf(ALEX), hour: -1 },
      { day: '2026-09-02', cell: cellOf(ALEX), hour: 9.5 },
    ] as HeatMark[]
    expect(heatActivity(hostile, { now: NOW }).hourlyMarks).toBe(0)
  })
})

describe('heatActivity.byDay', () => {
  it('zählt je Kalendertag, ältester zuerst, heute zuletzt', () => {
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

  it('kommt mit Strichen zurecht, die gar keine Stunde tragen', () => {
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

/**
 * Was aus einem kaputten oder feindlichen Speicher kommen kann.
 *
 * Die Markierungen liegen in D1 und werden von einem Worker geschrieben, den
 * nicht dieselbe Auslieferung erzeugt haben muss wie die lesende Seite. Eine
 * einzelne unbrauchbare Zeile darf deshalb die ganze Karte nicht kippen — und
 * sie darf auch nicht mitgezählt werden, denn dann stünde unter der Karte eine
 * Zahl, die die Punkte nicht erklären.
 */
describe('heatActivity mit unbrauchbaren Zeilen', () => {
  const junk = [
    { day: '2026-09-02', cell: 42 },
    { day: 20260902, cell: '10_10' },
    { cell: '10_10' },
    { day: '2026-09-02' },
    null,
    undefined,
  ] as unknown as HeatMark[]

  it('überspringt sie, statt sie zu zählen oder zu werfen', () => {
    const good = markFor(ALEX, NOW)
    const activity = heatActivity([...junk, good], { now: NOW })
    expect(activity.hourlyMarks).toBe(1)
    expect(activity.byDay.reduce((sum, count) => sum + count, 0)).toBe(1)
    expect(buildHeatmap([...junk, good], { now: NOW }).totalMarks).toBe(1)
  })

  // Eine Markierung von morgen ist kein alter Datenstand, sondern eine falsch
  // gestellte Uhr oder ein Schreibversuch. Sie ans Fensterende zu klemmen
  // hiesse, sie dauerhaft ganz oben stehen zu lassen.
  it('lässt eine Markierung aus der Zukunft und eine aus der Vorzeit liegen', () => {
    const activity = heatActivity(
      [markFor(ALEX, NOW + DAY), markFor(ALEX, NOW - 400 * DAY), markFor(ALEX, NOW)],
      { now: NOW }
    )
    expect(activity.hourlyMarks).toBe(1)
  })

  it('zählt eine Stunde ausserhalb 0-23 nicht mit, lässt den Tag aber stehen', () => {
    const broken = { ...markFor(ALEX, NOW), hour: 24 }
    const activity = heatActivity([broken], { now: NOW })
    expect(activity.hourlyMarks).toBe(0)
    expect(activity.byDay[activity.byDay.length - 1]).toBe(1)
    expect(activity.peakHour).toBeNull()
    expect(activity.quietFrom).toBeNull()
  })
})

describe('weekdayOf', () => {
  it('liest den Wochentag aus einem Tagesschlüssel', () => {
    // 2. September 2026 ist ein Mittwoch.
    expect(weekdayOf('2026-09-02')).toBe(3)
    expect(weekdayOf('2026-09-06')).toBe(0)
  })

  // Der Schlüssel kommt aus der Datenbank, nicht aus dieser Datei. `new
  // Date(NaN).getUTCDay()` wäre NaN und stimmte danach mit keinem Wochentag
  // überein — der Tagesprofil-Chart bliebe stumm, ohne dass jemand erführe warum.
  it('gibt für einen unlesbaren Schlüssel null zurück statt NaN', () => {
    expect(weekdayOf('kein Datum')).toBeNull()
    expect(weekdayOf('')).toBeNull()
    expect(weekdayOf('2026-13-45')).toBeNull()
  })
})

describe('Aufbewahrung mit unbrauchbaren Zeilen', () => {
  // `expiredMarks` sagt dem Worker, was er löschen darf. Eine Zeile, deren Tag
  // keine Zeichenkette ist, kann nie wieder in ein Fenster fallen — sie bliebe
  // sonst für immer liegen.
  it('nennt eine Zeile ohne brauchbaren Tag als löschbar', () => {
    const junk = [{ cell: '1_1' }, { day: 7, cell: '1_1' }, null] as unknown as HeatMark[]
    expect(expiredMarks(junk, { now: NOW })).toHaveLength(3)
    expect(expiredMarks([markFor(ALEX, NOW)], { now: NOW })).toEqual([])
  })
})

describe('entartete Halbwertszeit', () => {
  /**
   * `halfLifeDays: 0` lässt jedes Gewicht auf 0 fallen — auch das des besten
   * Feldes. Die Normierung teilt danach durch die Spitze; ohne die Prüfung
   * `peak > 0` stünde in jedem Feld `NaN` statt einer Zahl zwischen 0 und 1,
   * und die Karte zeichnete gar nichts, ohne leer zu sein.
   */
  it('liefert Gewicht 0 statt NaN, wenn jede Markierung auf null zerfällt', () => {
    const marks = marksAt(ALEX, [1, 2, 3])
    const map = buildHeatmap(marks, { now: NOW, halfLifeDays: 0 })
    expect(map.cells).toHaveLength(1)
    expect(map.cells[0]?.weight).toBe(0)
    expect(map.totalMarks).toBe(3)
  })
})

describe('Spitzenstunde', () => {
  /**
   * Die Spitze ist die grösste Stunde, nicht die erste mit Meldungen.
   *
   * Die Suche merkt sich die bisherige Spitze und muss sie ersetzen, sobald
   * eine spätere Stunde mehr trägt. Ohne diesen Vergleich stünde in der
   * Auswertung die erste Stunde des Tages — „meist kontrolliert um 8" für ein
   * Viertel, in dem nachmittags dreimal so viel gemeldet wird.
   */
  it('nennt die grösste Stunde, auch wenn eine kleinere früher liegt', () => {
    const at = (hour: number): HeatMark => ({ ...markFor(ALEX, NOW), hour })
    const activity = heatActivity([at(8), at(15), at(15), at(15), at(9)], { now: NOW })
    expect(activity.peakHour).toBe(15)
    expect(activity.byHourOnWeekday[15]).toBe(3)
    // Nach 15 Uhr wird nichts mehr gemeldet — ab 16 ist Ruhe.
    expect(activity.quietFrom).toBe(16)
  })
})
