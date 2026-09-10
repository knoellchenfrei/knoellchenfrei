import {
  berlinDateKey,
  berlinWallClock,
  cityByKey,
  isoWeekOf,
  patternWeekday,
  quarterOf,
  CONFIRMED_THRESHOLD,
  DEFAULT_MAX_AGE_MS,
} from '@knoellchenfrei/core'

import { unitAt } from './units.js'

/**
 * Die Ernte: aus den ablaufenden Sichtungen die Zähler der Langzeitmuster,
 * im selben Bündel wie ihre Löschung.
 *
 * Warum aus `sightings` und nicht aus `marks`: Nur die Sichtung trägt bei
 * Ablauf die endgültigen Stimmen und die Koordinate für die Einheit; ein
 * Strich kennt nur die Zelle und keine Qualität. Und nur hier, einmal, für
 * Web und Telegram.
 *
 * Die Grenze ist **stundenbündig**, nicht `jetzt − 90 Minuten`: Sonst würde
 * die Stunde 9 auf zwei Läufe verteilt (09:00–09:37 in diesem, 09:38–09:59
 * im nächsten), und ein Fenster mit Meldungen um 09:05 und 09:50 zählte
 * zweimal als belegt. Preis: Eine Meldung von 09:00 liegt bis 12:07 in der
 * Datenbank (187 Minuten statt vorher höchstens 150); sichtbar und bewertbar
 * ist sie unverändert nur 90 Minuten — `listSightings` und `voteOnSighting`
 * filtern selbst. `docs/datenschutz.md` sagt das.
 *
 * Idempotenz kommt aus der Atomarität: `batch` läuft als Transaktion.
 * Scheitert eine Anweisung, bleiben die Sichtungen stehen, und der nächste
 * Lauf holt dieselbe Stunde noch einmal. Eine Merkspalte braucht es nicht.
 */
const HOUR_MS = 3_600_000

interface Row {
  lon: number
  lat: number
  city: string
  reported_at: number
  confirmations: number
  disputes: number
}

interface Tally {
  city: string
  unit: string
  quarter: string
  weekday: number
  hour: number
  days: Set<string>
  reports: number
  confirmed: number
  disputed: number
  weight: number
}

export interface HarvestPlan {
  /** Sichtungen mit `reported_at < boundary` werden geerntet und gelöscht. */
  boundary: number
  tallies: Tally[]
  /** Je Stadt und ISO-Woche die Summen für den Verlauf. */
  weeks: Map<string, { city: string; week: string; reports: number; slots: number; confirmed: number; disputed: number }>
  /** Je Stadt der früheste Erntetag in diesem Lauf. */
  since: Map<string, string>
}

/** Die Grenze: die volle Stunde vor `now − 90 min`. */
export function harvestBoundary(now: number): number {
  return Math.floor((now - DEFAULT_MAX_AGE_MS) / HOUR_MS) * HOUR_MS
}

/** Laplace-Zustimmung — dieselbe Form wie im Konfidenzmodell, ohne Verfall. */
export const agreementOf = (confirmations: number, disputes: number): number =>
  (confirmations + 1) / (confirmations + disputes + 2)

/** Rein: aus Zeilen die Zähler. Getestet ohne Datenbank. */
export function planHarvest(rows: readonly Row[], now: number): HarvestPlan {
  const boundary = harvestBoundary(now)
  const tallies = new Map<string, Tally>()
  const weeks: HarvestPlan['weeks'] = new Map()
  const since = new Map<string, string>()
  const slotSeen = new Set<string>()

  for (const row of rows) {
    if (!(row.reported_at < boundary)) continue
    const city = cityByKey(row.city)
    const clock = berlinWallClock(row.reported_at)
    const day = berlinDateKey(clock)
    const unit = unitAt(city.key, [row.lon, row.lat])
    const quarter = quarterOf(clock)
    const weekday = patternWeekday(clock, city.land, city.holidays ?? [])
    const hour = Math.floor(clock.minuteOfDay / 60)
    const key = [city.key, unit, quarter, weekday, hour].join('|')
    const tally = tallies.get(key) ?? {
      city: city.key,
      unit,
      quarter,
      weekday,
      hour,
      days: new Set<string>(),
      reports: 0,
      confirmed: 0,
      disputed: 0,
      weight: 0,
    }
    const agreement = agreementOf(row.confirmations, row.disputes)
    const confirmed = agreement >= CONFIRMED_THRESHOLD
    const disputed = row.disputes > row.confirmations
    tally.days.add(day)
    tally.reports += 1
    if (confirmed) tally.confirmed += 1
    if (disputed) tally.disputed += 1
    tally.weight += agreement
    tallies.set(key, tally)

    const week = isoWeekOf(clock)
    const weekKey = `${city.key}|${week}`
    const w = weeks.get(weekKey) ?? { city: city.key, week, reports: 0, slots: 0, confirmed: 0, disputed: 0 }
    w.reports += 1
    if (confirmed) w.confirmed += 1
    if (disputed) w.disputed += 1
    // Ein Fenster je (Stadt, Tag, Stunde, Einheit) auch im Verlauf.
    const slotKey = `${key}|${day}`
    if (!slotSeen.has(slotKey)) {
      slotSeen.add(slotKey)
      w.slots += 1
    }
    weeks.set(weekKey, w)

    const first = since.get(city.key)
    if (first === undefined || day < first) since.set(city.key, day)
  }
  return { boundary, tallies: [...tallies.values()], weeks, since }
}

const UPSERT_LANGZEIT =
  'INSERT INTO kontrollen_langzeit (city, unit, quarter, weekday, hour, slots, reports, confirmed, disputed, weight)' +
  ' VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)' +
  ' ON CONFLICT (city, unit, quarter, weekday, hour) DO UPDATE SET' +
  ' slots = slots + excluded.slots, reports = reports + excluded.reports,' +
  ' confirmed = confirmed + excluded.confirmed, disputed = disputed + excluded.disputed,' +
  ' weight = weight + excluded.weight'
const UPSERT_VERLAUF =
  'INSERT INTO kontrollen_verlauf (city, week, reports, slots, confirmed, disputed, opens)' +
  ' VALUES (?, ?, ?, ?, ?, ?, 0)' +
  ' ON CONFLICT (city, week) DO UPDATE SET' +
  ' reports = reports + excluded.reports, slots = slots + excluded.slots,' +
  ' confirmed = confirmed + excluded.confirmed, disputed = disputed + excluded.disputed'
const INSERT_META = 'INSERT OR IGNORE INTO kontrollen_meta (city, since, nutzung_bis) VALUES (?, ?, NULL)'

/**
 * Ernten und löschen — ein Bündel. Wirft, wenn die Vorbereitung scheitert
 * (unbekannte Stadt, Geometrie fehlt); der Aufrufer löscht dann ohne Ernte,
 * denn die Frist geht vor (`CLAUDE.md`: „Was eine Frist einhält, darf nicht
 * hinter etwas stehen, das scheitern darf").
 */
export async function harvestAndDelete(db: D1Database, now: number): Promise<{ harvested: number; deleted: number }> {
  const boundary = harvestBoundary(now)
  const { results } = await db
    .prepare('SELECT lon, lat, city, reported_at, confirmations, disputes FROM sightings WHERE reported_at < ?')
    .bind(boundary)
    .all<Row>()
  const plan = planHarvest(results ?? [], now)
  const statements: D1PreparedStatement[] = []
  for (const t of plan.tallies) {
    statements.push(
      db
        .prepare(UPSERT_LANGZEIT)
        .bind(t.city, t.unit, t.quarter, t.weekday, t.hour, t.days.size, t.reports, t.confirmed, t.disputed, t.weight),
    )
  }
  for (const w of plan.weeks.values()) {
    statements.push(db.prepare(UPSERT_VERLAUF).bind(w.city, w.week, w.reports, w.slots, w.confirmed, w.disputed))
  }
  for (const [city, day] of plan.since) statements.push(db.prepare(INSERT_META).bind(city, day))
  statements.push(db.prepare('DELETE FROM sightings WHERE reported_at < ?').bind(boundary))
  const ergebnisse = await db.batch(statements)
  const deleted = ergebnisse[ergebnisse.length - 1]?.meta?.changes ?? 0
  return { harvested: results?.length ?? 0, deleted }
}
