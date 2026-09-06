import { berlinWallClock, HISTORY_DAYS, markFor, type HeatMark } from '@parkingzone/core'

import type { StoredSighting } from './storage.js'

/**
 * Seeded demo sightings.
 *
 * A crowdsourced layer with no crowd renders as an empty map, which demonstrates
 * nothing. These are generated, spread over central Berlin, and labelled as demo
 * data in the UI — they are never presented as real reports.
 */
const SPOTS: [number, number, number][] = [
  // lon, lat, minutes ago
  [13.3889, 52.5169, 8],
  [13.4132, 52.5219, 22],
  [13.4271, 52.4995, 41],
  [13.3421, 52.5065, 63],
  [13.4501, 52.5121, 15],
  [13.3652, 52.4934, 74],
]

export function seedSightings(now: number): StoredSighting[] {
  return SPOTS.map(([lon, lat, minutesAgo], index) => ({
    id: `seed-${index}`,
    lon,
    lat,
    reportedAt: now - minutesAgo * 60_000,
    confirmations: index % 3,
    disputes: index === 4 ? 2 : 0,
  }))
}

/**
 * Seeded demo marks for the heatmap.
 *
 * Same reasoning as the sightings above, but the shape matters more here: four
 * weeks of an empty grid shows nothing at all, and the whole point of the layer
 * is the contrast between a corner that is checked most days and one that is
 * not. Generated from a fixed pattern so the picture is the same on every
 * device, and labelled as demo data wherever it is shown.
 *
 * The weights are deliberately uneven: three hotspots around the inner-city
 * zones, a middle band, and outer spots that are touched once or twice.
 */
const HOTSPOTS: [number, number, number][] = [
  // lon, lat, how many of the last 28 days it was reported on
  [13.3889, 52.5169, 19], // Potsdamer Platz
  [13.4132, 52.5219, 16], // Alexanderplatz
  [13.4271, 52.4995, 12], // Kottbusser Tor
  [13.3282, 52.5063, 8], // Savignyplatz
  [13.4501, 52.5121, 5], // Frankfurter Allee
  [13.3652, 52.4934, 4], // Bergmannkiez
  [13.2846, 52.4757, 2], // Steglitz
  [13.4712, 52.5442, 1], // Weissensee
]

/**
 * Metres, roughly, in degrees at Berlin's latitude — enough to land in a
 * neighbouring cell.
 */
const SPREAD_LON = 0.0037
const SPREAD_LAT = 0.0022

/**
 * Hours a demo mark can fall on, weighted by repetition.
 *
 * Berlin enforcement runs roughly with the charging hours (from 9), with a
 * late-morning and a late-afternoon concentration. Repeating an hour in this
 * list is how it gets more weight — the distribution is the point, not the
 * exact numbers.
 */
const SHIFT_HOURS = [9, 10, 10, 11, 11, 11, 12, 12, 13, 14, 15, 16, 16, 17, 17, 18, 19, 20]

export function seedMarks(now: number): HeatMark[] {
  const marks: HeatMark[] = []
  for (const [lon, lat, activeDays] of HOTSPOTS) {
    for (let day = 0; day < HISTORY_DAYS; day += 1) {
      // Spread the active days across the window instead of clustering them at
      // one end, so the decay does not make a busy corner look dead.
      if ((day * activeDays) % HISTORY_DAYS >= activeDays) continue
      // A warden works a few blocks, not one corner. Without this spread every
      // hotspot was a single cell and the layer rendered as a handful of dots
      // that no colour ramp could turn into a density.
      const ring = day % 5
      const dx = ring === 1 ? 1 : ring === 3 ? -1 : 0
      const dy = ring === 2 ? 1 : ring === 4 ? -1 : 0
      // Placed at an hour from the shift pattern below, not at "now". Every
      // demo mark landing on the current hour made the time-of-day chart read
      // "peak 9, quiet from 10" — a single spike that describes nothing.
      //
      // The instant is computed against the BERLIN clock, not the device's:
      // `setHours` is local, so a viewer in another timezone saw a shifted demo
      // day — and the build machine, on UTC, already did.
      const hour = SHIFT_HOURS[(day * 7 + activeDays) % SHIFT_HOURS.length] as number
      const base = now - day * 86_400_000
      const at = base + (hour * 60 + 30 - berlinWallClock(base).minuteOfDay) * 60_000
      // Never ahead of the clock: today's later shift hours have not happened
      // yet, and a mark dated in the future is exactly what buildHeatmap drops.
      if (at > now) continue
      marks.push(markFor([lon + dx * SPREAD_LON, lat + dy * SPREAD_LAT], at))
    }
  }
  return marks
}
