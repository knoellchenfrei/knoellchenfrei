import { ZONE_UNITS } from '@knoellchenfrei/core'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import worker, { DAILY_CRON, type Env } from '../src/worker.js'
import { harvestBoundary, planHarvest } from '../src/harvest.js'
import { unitAt } from '../src/units.js'
import { d1AusSqlite } from './d1-sqlite.js'

/**
 * Die Langzeitmuster gegen echtes SQLite: Ernte im Bündel mit der Löschung,
 * Fensterzählung, Feiertag als Sonntag, Einheit aus der Position, der
 * Rückfall bei gescheiterter Ernte, das Tagesmodell und seine Fristen.
 */
const START = Date.parse('2026-09-08T10:30:00+02:00')
const BERLIN: [number, number] = [13.405, 52.52]

let env: Env
let db: ReturnType<typeof d1AusSqlite>['db']
let kv: Map<string, string>

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(START)
  const sqlite = d1AusSqlite()
  db = sqlite.db
  kv = new Map()
  env = {
    DB: sqlite.d1,
    CACHE: {
      get: async (key: string) => kv.get(key) ?? null,
      put: async (key: string, value: string) => {
        kv.set(key, value)
      },
    } as unknown as KVNamespace,
    CLIENT_SALT: 'salz',
    ALLOWED_ORIGINS: 'https://knoellchenfrei.de',
  }
})

afterEach(() => vi.useRealTimers())

function sichtung(id: string, at: number, patch: Partial<{ lon: number; lat: number; city: string; c: number; d: number }> = {}) {
  db.prepare(
    'INSERT INTO sightings (id, lon, lat, city, reported_at, confirmations, disputes, client_hash) VALUES (?, ?, ?, ?, ?, ?, ?, NULL)',
  ).run(id, patch.lon ?? BERLIN[0], patch.lat ?? BERLIN[1], patch.city ?? 'berlin', at, patch.c ?? 0, patch.d ?? 0)
}

const langzeit = () =>
  db.prepare('SELECT city, unit, quarter, weekday, hour, slots, reports, confirmed, disputed, weight FROM kontrollen_langzeit ORDER BY unit, weekday, hour').all()
const stundenLauf = () => worker.scheduled(undefined, env)
const tagesLauf = () => worker.scheduled({ cron: DAILY_CRON } as ScheduledController, env)

describe('die Grenze der Ernte', () => {
  it('ist die volle Stunde vor jetzt minus 90 Minuten', () => {
    expect(harvestBoundary(Date.parse('2026-09-08T11:07:00+02:00'))).toBe(Date.parse('2026-09-08T09:00:00+02:00'))
    expect(harvestBoundary(Date.parse('2026-09-08T11:37:00+02:00'))).toBe(Date.parse('2026-09-08T10:00:00+02:00'))
  })
})

describe('die Einheit aus der Position', () => {
  it('trifft in Berlin eine Zone, die die App genauso kennt', () => {
    const unit = unitAt('berlin', BERLIN)
    expect(unit).not.toBe('')
    expect(ZONE_UNITS.berlin![unit]).toBe(unit)
  })

  it('ist in Karlsruhe der Bezirk der nächsten Reihe, und weit weg von allem leer', () => {
    // Mitten im Rahmen der Durlacher Reihen: der Bezirk, nicht eine Reihe.
    expect(unitAt('karlsruhe', [8.467, 48.999])).toBe('bezirk:Durlach')
    // Mehr als 300 m von jeder Reihe: keine Einheit.
    expect(unitAt('karlsruhe', [8.30, 49.10])).toBe('')
    expect(unitAt('berlin', [13.05, 52.65])).toBe('')
    expect(() => unitAt('atlantis', BERLIN)).toThrow()
  })
})

describe('planHarvest', () => {
  it('zählt je Wochenstunde Fenster, Meldungen, Zustimmung — und lässt Jüngeres liegen', () => {
    const now = Date.parse('2026-09-08T13:07:00+02:00')
    const rows = [
      { lon: BERLIN[0], lat: BERLIN[1], city: 'berlin', reported_at: START, confirmations: 1, disputes: 0 },
      { lon: BERLIN[0], lat: BERLIN[1], city: 'berlin', reported_at: START + 5 * 60_000, confirmations: 0, disputes: 2 },
      { lon: BERLIN[0], lat: BERLIN[1], city: 'berlin', reported_at: START - 7 * 86_400_000, confirmations: 0, disputes: 0 },
      { lon: BERLIN[0], lat: BERLIN[1], city: 'berlin', reported_at: now - 10 * 60_000, confirmations: 0, disputes: 0 },
    ]
    const plan = planHarvest(rows, now)
    expect(plan.tallies).toHaveLength(1)
    const t = plan.tallies[0]!
    expect(t).toMatchObject({ city: 'berlin', quarter: '2026-Q3', weekday: 2, hour: 10, reports: 3, confirmed: 1, disputed: 1 })
    expect(t.days.size).toBe(2)
    expect(t.weight).toBeCloseTo(2 / 3 + 1 / 4 + 1 / 2, 10)
    expect([...plan.weeks.values()].map((w) => [w.week, w.reports, w.slots])).toEqual([
      ['2026-W37', 2, 1],
      ['2026-W36', 1, 1],
    ])
    expect(plan.since.get('berlin')).toBe('2026-09-01')
  })
})

describe('der stündliche Lauf erntet und löscht in einem Bündel', () => {
  it('macht aus einer abgelaufenen Meldung einen Zähler und löscht sie', async () => {
    sichtung('a', START, { c: 1 })
    vi.setSystemTime(Date.parse('2026-09-08T13:07:00+02:00'))
    await stundenLauf()
    expect(db.prepare('SELECT COUNT(*) AS n FROM sightings').get()).toEqual({ n: 0 })
    const zeilen = langzeit() as Record<string, unknown>[]
    expect(zeilen).toHaveLength(1)
    expect(zeilen[0]).toMatchObject({ city: 'berlin', quarter: '2026-Q3', weekday: 2, hour: 10, slots: 1, reports: 1, confirmed: 1, disputed: 0 })
    expect(zeilen[0]!.unit).toBe(unitAt('berlin', BERLIN))
    expect(db.prepare('SELECT city, week, reports, slots FROM kontrollen_verlauf').all()).toEqual([
      { city: 'berlin', week: '2026-W37', reports: 1, slots: 1 },
    ])
    expect(db.prepare('SELECT city, since FROM kontrollen_meta').all()).toEqual([{ city: 'berlin', since: '2026-09-08' }])
  })

  it('lässt eine Meldung liegen, deren Stunde noch nicht voll ist — sichtbar ist sie ohnehin nur 90 Minuten', async () => {
    sichtung('a', Date.parse('2026-09-08T11:05:00+02:00'))
    vi.setSystemTime(Date.parse('2026-09-08T13:07:00+02:00'))
    await stundenLauf()
    expect(db.prepare('SELECT COUNT(*) AS n FROM sightings').get()).toEqual({ n: 1 })
    vi.setSystemTime(Date.parse('2026-09-08T14:07:00+02:00'))
    await stundenLauf()
    expect(db.prepare('SELECT COUNT(*) AS n FROM sightings').get()).toEqual({ n: 0 })
  })

  it('addiert auf bestehende Zeilen: zwei Tage, dieselbe Wochenstunde, zwei Fenster', async () => {
    sichtung('a', START)
    sichtung('b', START + 60_000)
    vi.setSystemTime(Date.parse('2026-09-08T13:07:00+02:00'))
    await stundenLauf()
    sichtung('c', START + 7 * 86_400_000)
    vi.setSystemTime(Date.parse('2026-09-15T13:07:00+02:00'))
    await stundenLauf()
    // Ein zweiter Lauf ohne Sichtungen ändert nichts.
    await stundenLauf()
    expect(langzeit()).toMatchObject([{ slots: 2, reports: 3 }])
  })

  it('legt einen Feiertag auf den Sonntag', async () => {
    // 3. Oktober 2026, ein Samstag.
    sichtung('a', Date.parse('2026-10-03T11:00:00+02:00'))
    vi.setSystemTime(Date.parse('2026-10-03T14:07:00+02:00'))
    await stundenLauf()
    expect(langzeit()).toMatchObject([{ quarter: '2026-Q4', weekday: 0, hour: 11 }])
  })

  it('löscht auch dann, wenn die Ernte scheitert — und wirft am Ende', async () => {
    sichtung('kaputt', START, { city: 'atlantis' })
    vi.setSystemTime(Date.parse('2026-09-08T13:07:00+02:00'))
    await expect(stundenLauf()).rejects.toThrow(/ernten und löschen/)
    expect(db.prepare('SELECT COUNT(*) AS n FROM sightings').get()).toEqual({ n: 0 })
    expect(langzeit()).toEqual([])
  })
})

describe('der Tageslauf', () => {
  it('rechnet je Stadt einen Stand in den KV, den /patterns ausliefert', async () => {
    sichtung('a', START, { c: 1 })
    vi.setSystemTime(Date.parse('2026-09-08T13:07:00+02:00'))
    await stundenLauf()
    const vorher = await worker.fetch(new Request('https://api.example/patterns?city=berlin'), env)
    expect(vorher.status).toBe(404)

    vi.setSystemTime(Date.parse('2026-09-09T05:37:00+02:00'))
    await tagesLauf()
    const antwort = await worker.fetch(new Request('https://api.example/patterns?city=berlin'), env)
    expect(antwort.status).toBe(200)
    expect(antwort.headers.get('Cache-Control')).toBe('public, max-age=3600')
    const stand = (await antwort.json()) as { city: string; since: string; units: Record<string, { windows: number; levels: number[] }>; guete: unknown; n: number[] }
    expect(stand.city).toBe('berlin')
    expect(stand.since).toBe('2026-09-08')
    const unit = unitAt('berlin', BERLIN)
    expect(stand.units[unit]!.windows).toBe(1)
    expect(stand.units[unit]!.levels).toHaveLength(168)
    // Ein Tag Beobachtung: überall Stufe 0, kein Rückwärtstest.
    expect(new Set(stand.units[unit]!.levels)).toEqual(new Set([0]))
    expect(stand.guete).toBeNull()
    expect(stand.n[2]).toBe(1)
    expect((await worker.fetch(new Request('https://api.example/patterns?city=atlantis'), env)).status).toBe(400)
    expect((await worker.fetch(new Request('https://api.example/patterns?city=hamburg'), env)).status).toBe(200)
  })

  it('übernimmt die Nutzung des Vortags genau einmal', async () => {
    sichtung('a', START)
    vi.setSystemTime(Date.parse('2026-09-08T13:07:00+02:00'))
    await stundenLauf()
    db.prepare("INSERT INTO events (day, hour, city, name, value, n) VALUES ('2026-09-08', 10, 'berlin', 'app.open', '', 7)").run()
    db.prepare("INSERT INTO events (day, hour, city, name, value, n) VALUES ('2026-09-08', -1, 'berlin', 'zone.open', '12', 3)").run()
    vi.setSystemTime(Date.parse('2026-09-09T05:37:00+02:00'))
    await tagesLauf()
    await tagesLauf()
    expect(db.prepare('SELECT city, quarter, weekday, hour, opens, hours_used FROM kontrollen_nutzung').all()).toEqual([
      { city: 'berlin', quarter: '2026-Q3', weekday: 2, hour: 10, opens: 7, hours_used: 1 },
    ])
    expect(db.prepare('SELECT opens FROM kontrollen_verlauf WHERE city = ? AND week = ?').get('berlin', '2026-W37')).toEqual({ opens: 7 })
    expect(db.prepare('SELECT nutzung_bis FROM kontrollen_meta').get()).toEqual({ nutzung_bis: '2026-09-08' })
  })

  it('hält die Fristen: zwölf Quartale Zähler, drei Jahre Verlauf', async () => {
    const zeile = db.prepare(
      'INSERT INTO kontrollen_langzeit (city, unit, quarter, weekday, hour, slots, reports, confirmed, disputed, weight) VALUES (?, ?, ?, 1, 9, 1, 1, 0, 0, 0.5)',
    )
    zeile.run('berlin', '12', '2023-Q3')
    zeile.run('berlin', '12', '2023-Q4')
    db.prepare('INSERT INTO kontrollen_verlauf (city, week, reports, slots, confirmed, disputed, opens) VALUES (?, ?, 1, 1, 0, 0, 0)').run('berlin', '2023-W30')
    db.prepare('INSERT INTO kontrollen_verlauf (city, week, reports, slots, confirmed, disputed, opens) VALUES (?, ?, 1, 1, 0, 0, 0)').run('berlin', '2024-W30')
    await tagesLauf()
    expect(db.prepare('SELECT quarter FROM kontrollen_langzeit').all()).toEqual([{ quarter: '2023-Q4' }])
    expect(db.prepare('SELECT week FROM kontrollen_verlauf').all()).toEqual([{ week: '2024-W30' }])
  })
})

describe('die Zusicherungen des Schemas', () => {
  it('weist unmögliche Zähler ab', () => {
    const zeile = (weekday: number, slots: number, reports: number, confirmed: number) => () =>
      db
        .prepare('INSERT INTO kontrollen_langzeit (city, unit, quarter, weekday, hour, slots, reports, confirmed, disputed, weight) VALUES (?, ?, ?, ?, 9, ?, ?, ?, 0, 0.5)')
        .run('berlin', '12', '2026-Q3', weekday, slots, reports, confirmed)
    expect(zeile(7, 1, 1, 0)).toThrow()
    expect(zeile(1, 0, 1, 0)).toThrow()
    expect(zeile(1, 2, 1, 0)).toThrow()
    expect(zeile(1, 1, 1, 2)).toThrow()
    expect(zeile(1, 1, 1, 1)).not.toThrow()
  })
})
