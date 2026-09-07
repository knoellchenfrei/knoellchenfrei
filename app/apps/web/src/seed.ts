import { berlinWallClock, HISTORY_DAYS, markFor, type HeatMark } from '@knoellchenfrei/core'

import { CITY } from './city.js'
import type { StoredSighting } from './storage.js'

/**
 * Seeded demo sightings.
 *
 * A crowdsourced layer with no crowd renders as an empty map, which demonstrates
 * nothing. These are generated, spread over the loaded city's centre, and
 * labelled as demo data in the UI — they are never presented as real reports.
 *
 * Die Punkte stehen als **Abstand zum Stadtmittelpunkt**, nicht als
 * Koordinaten. Vorher waren es Berliner Koordinaten, fest im Code: In München
 * lagen die sechs Beispielmeldungen damit 500 km neben der Karte — unsichtbar,
 * und die Sichtungsliste zeigte trotzdem sechs Einträge, die nirgends
 * hinzeigten. Das Muster stammt weiter aus Berlin (Potsdamer Platz,
 * Alexanderplatz, Kottbusser Tor …); übrig davon ist die Streuung, nicht der
 * Ort.
 */
const SPOTS: [number, number, number][] = [
  // Abstand zum Mittelpunkt in Grad (Länge, Breite), dann: vor wie vielen Minuten
  [-0.0161, -0.0031, 8],
  [0.0082, 0.0019, 22],
  [0.0221, -0.0205, 41],
  [-0.0629, -0.0135, 63],
  [0.0451, -0.0079, 15],
  [-0.0398, -0.0266, 74],
]

export function seedSightings(now: number): StoredSighting[] {
  return SPOTS.map(([dLon, dLat, minutesAgo], index) => ({
    id: `seed-${index}`,
    lon: CITY.center[0] + dLon,
    lat: CITY.center[1] + dLat,
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
  // Abstand zum Mittelpunkt in Grad (Länge, Breite), dann: an wie vielen der
  // letzten 28 Tage gemeldet. Dieselbe Umstellung wie bei SPOTS oben und aus
  // demselben Grund — in einer anderen Stadt zeigte die Kontrolldichte sonst
  // acht Berliner Ecken, und die Liste „am häufigsten kontrolliert" nannte
  // dreimal „Außerhalb der Zonen".
  [-0.0161, -0.0031, 19], // Muster: Potsdamer Platz
  [0.0082, 0.0019, 16], // Alexanderplatz
  [0.0221, -0.0205, 12], // Kottbusser Tor
  [-0.0768, -0.0137, 8], // Savignyplatz
  [0.0451, -0.0079, 5], // Frankfurter Allee
  [-0.0398, -0.0266, 4], // Bergmannkiez
  [-0.1204, -0.0443, 2], // Steglitz
  [0.0662, 0.0242, 1], // Weissensee
]

/**
 * Metres, roughly, in degrees at Berlin's latitude — enough to land in a
 * neighbouring cell. Bleibt für alle Städte dieselbe Zahl: Die Streuung soll
 * eine Nachbarzelle treffen, und ob sie dabei 250 oder 280 Meter weit reicht,
 * ändert an Demodaten nichts.
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
  for (const [dLon, dLat, activeDays] of HOTSPOTS) {
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
      marks.push(
        markFor(
          [
            CITY.center[0] + dLon + dx * SPREAD_LON,
            CITY.center[1] + dLat + dy * SPREAD_LAT,
          ],
          at,
        ),
      )
    }
  }
  return marks
}
