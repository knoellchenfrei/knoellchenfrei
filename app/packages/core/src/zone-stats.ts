import { berlinDateKey, berlinWallClock } from './berlin-time.js'
import { multiPolygonContains, type PolygonRings } from './geo.js'
import { cellCentre, HISTORY_DAYS, type HeatGrid, type HeatMark } from './heatmap.js'

/**
 * Die Kontrollen **einer Zone**, gerechnet aus der Strichliste des Rasters —
 * das Stationsblatt von FreiFahren, übertragen auf Parkzonen (9. September,
 * nachts, Betreiber: „inkl. Statistiken").
 *
 * Es gibt keine Striche je Zone; die Strichliste kennt nur 250-m-Felder. Eine
 * Zone bekommt die Striche der Felder, deren **Mittelpunkt** in ihr liegt.
 * Das ist grob — ein Feld am Rand zählt ganz zur einen Seite —, aber es ist
 * dieselbe Grobheit wie auf der Karte, und feiner speichert der Server nicht,
 * mit Absicht (`docs/datenschutz.md`).
 */
export interface ZoneStats {
  /** Striche am heutigen Berliner Kalendertag. */
  today: number
  /** Striche in den letzten sieben Kalendertagen, heute eingeschlossen. */
  days7: number
  /** Striche im ganzen Fenster (`HISTORY_DAYS`). */
  days28: number
  /** Je Kalendertag der letzten sieben, ältester zuerst, heute zuletzt. */
  byDay: readonly number[]
  /**
   * Der jüngste Strich als Berliner Tag und Stunde; die Stunde fehlt bei
   * Strichen, die vor der Stundenzählung entstanden sind. `null` ohne Striche.
   */
  last: { day: string; hour: number | null; ageDays: number } | null
}

export interface ZoneStatsOptions {
  now: number | Date
  grid: HeatGrid
  historyDays?: number
}

const DAY_MS = 86_400_000

function ageInDays(day: string, today: string): number {
  const asUtc = (key: string): number => Date.parse(`${key}T00:00:00Z`)
  const a = asUtc(day)
  const b = asUtc(today)
  if (!Number.isFinite(a) || !Number.isFinite(b)) return Number.POSITIVE_INFINITY
  return Math.round((b - a) / DAY_MS)
}

export function zoneStats(
  marks: readonly HeatMark[],
  polygons: readonly PolygonRings[],
  options: ZoneStatsOptions,
): ZoneStats {
  const days = options.historyDays ?? HISTORY_DAYS
  const now = typeof options.now === 'number' ? options.now : options.now.getTime()
  const today = berlinDateKey(berlinWallClock(now))
  const byDay = new Array<number>(7).fill(0)
  let todayCount = 0
  let days7 = 0
  let days28 = 0
  let last: ZoneStats['last'] = null

  // Ein Feld liegt drin oder nicht — einmal je Feld gerechnet, nicht je Strich:
  // Bei 300 Strichen in vier Feldern sind das vier Polygon-Tests statt 300.
  const inside = new Map<string, boolean>()
  const contains = (cell: string): boolean => {
    let hit = inside.get(cell)
    if (hit === undefined) {
      let centre: readonly [number, number]
      try {
        centre = cellCentre(cell, options.grid)
      } catch {
        // Ein Feld eines anderen Rasters (andere Stadt) liegt nirgends.
        inside.set(cell, false)
        return false
      }
      hit = multiPolygonContains(polygons, centre)
      inside.set(cell, hit)
    }
    return hit
  }

  for (const mark of marks) {
    if (typeof mark?.day !== 'string' || typeof mark?.cell !== 'string') continue
    const age = ageInDays(mark.day, today)
    if (!Number.isFinite(age) || age < 0 || age >= days) continue
    if (!contains(mark.cell)) continue

    days28 += 1
    if (age < 7) {
      days7 += 1
      byDay[6 - age] = (byDay[6 - age] ?? 0) + 1
    }
    if (age === 0) todayCount += 1

    const hour =
      typeof mark.hour === 'number' && Number.isInteger(mark.hour) && mark.hour >= 0 && mark.hour < 24
        ? mark.hour
        : null
    if (
      last === null ||
      age < last.ageDays ||
      (age === last.ageDays && (last.hour === null ? hour !== null : hour !== null && hour > last.hour))
    ) {
      last = { day: mark.day, hour, ageDays: age }
    }
  }

  return { today: todayCount, days7, days28, byDay, last }
}
