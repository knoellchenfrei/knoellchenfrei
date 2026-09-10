import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import worker, { type Env } from '../src/worker.js'
import { d1AusSqlite } from './d1-sqlite.js'

/**
 * Der Worker gegen echtes SQLite — alles hinter dem ersten `SELECT`.
 *
 * Die Attrappe in `worker.test.ts` antwortet auf jedes `first()` mit `null`;
 * dort stehen Router, CORS und Riegel. Hier steht, was die Datenbank
 * entscheidet: die eigene Meldung ist nicht bewertbar (M-047), eine zweite
 * Stimme zählt nicht (Primärschlüssel in `votes`), die siebte Meldung in
 * der Stunde bekommt 429, Koordinaten und Zeiten landen gerundet, das
 * Tagesbudget der Ereignisse wird zuletzt reserviert (und das erste Bündel
 * eines Tages ohne Budgetzeile geschrieben), der Aufräumlauf löscht wirklich.
 */

/** Dienstag, 8. September 2026, 10:30 Berliner Zeit. */
const START = Date.parse('2026-09-08T10:30:00+02:00')
const BERLIN = { lon: 13.40512345, lat: 52.52098765 }

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

afterEach(() => {
  vi.useRealTimers()
})

const anfrage = (pfad: string, ip: string, body: unknown, method = 'POST'): Request =>
  new Request(`https://api.example${pfad}`, {
    method,
    headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': ip },
    body: JSON.stringify(body),
  })

const rufe = (pfad: string, ip: string, body: unknown = {}) => worker.fetch(anfrage(pfad, ip, body), env)

async function melde(ip: string, position = BERLIN): Promise<string> {
  const antwort = await rufe('/sightings', ip, position)
  expect(antwort.status).toBe(201)
  return ((await antwort.json()) as { id: string }).id
}

const zeile = <T>(sql: string, ...werte: (string | number)[]): T => db.prepare(sql).get(...werte) as T
const anzahl = (sql: string, ...werte: (string | number)[]): number =>
  zeile<{ n: number }>(`SELECT COUNT(*) AS n FROM ${sql}`, ...werte).n

describe('eine Meldung', () => {
  it('landet gerundet in der Tabelle: 4 Stellen, 5-Minuten-Raster, Stadt aus der Position', async () => {
    const id = await melde('10.0.0.1')
    const gespeichert = zeile<{ lon: number; lat: number; city: string; reported_at: number; client_hash: string }>(
      'SELECT lon, lat, city, reported_at, client_hash FROM sightings WHERE id = ?',
      id,
    )
    expect(gespeichert.lon).toBe(13.4051)
    expect(gespeichert.lat).toBe(52.521)
    expect(gespeichert.city).toBe('berlin')
    expect(gespeichert.reported_at).toBe(Date.parse('2026-09-08T10:30:00+02:00'))
    expect(gespeichert.client_hash).toMatch(/^[0-9a-f]{16}$/)
  })

  it('schreibt zugleich den Strich der Heatmap — ohne Koordinate, mit Tag, Stunde und Stadt', async () => {
    await melde('10.0.0.1', { lon: 9.99, lat: 53.55 })
    const strich = zeile<{ day: string; hour: number; city: string; cell: string }>(
      'SELECT day, hour, city, cell FROM marks',
    )
    expect(strich).toEqual({ day: '2026-09-08', hour: 10, city: 'hamburg', cell: expect.stringMatching(/^hamburg:\d+_\d+$/) })
  })

  it('hasht den Client aus Adresse und Salz — zwei Adressen, zwei Salze, vier Hashes', async () => {
    const hash = async (ip: string): Promise<string> => {
      const id = await melde(ip)
      return zeile<{ client_hash: string }>('SELECT client_hash FROM sightings WHERE id = ?', id).client_hash
    }
    const a = await hash('10.0.0.1')
    const b = await hash('10.0.0.2')
    expect(a).not.toBe(b)
    expect(await hash('10.0.0.1')).toBe(a)
    env.CLIENT_SALT = 'anderes-salz'
    expect(await hash('10.0.0.1')).not.toBe(a)
  })

  it('die siebte in der Stunde bekommt 429, nach einer Stunde geht es weiter', async () => {
    for (let i = 0; i < 6; i++) await melde('10.0.0.1')
    expect((await rufe('/sightings', '10.0.0.1', BERLIN)).status).toBe(429)
    // Ein anderer Client ist davon nicht betroffen.
    expect((await rufe('/sightings', '10.0.0.2', BERLIN)).status).toBe(201)
    vi.setSystemTime(START + 61 * 60_000)
    expect((await rufe('/sightings', '10.0.0.1', BERLIN)).status).toBe(201)
  })
})

describe('eine Stimme', () => {
  it('auf die eigene Meldung ist verboten, auf eine fremde zählt sie genau einmal', async () => {
    const id = await melde('10.0.0.1')
    expect((await rufe(`/sightings/${id}/confirm`, '10.0.0.1')).status).toBe(403)

    const erste = await rufe(`/sightings/${id}/confirm`, '10.0.0.2')
    expect(erste.status).toBe(200)
    expect(await erste.json()).toEqual({ ok: true, counted: true })

    // Dieselbe Person noch einmal, auch mit anderer Meinung: der
    // Primärschlüssel (sighting_id, client_hash) lässt genau eine Stimme zu.
    const zweite = await rufe(`/sightings/${id}/dispute`, '10.0.0.2')
    expect(await zweite.json()).toEqual({ ok: true, counted: false })

    const dritte = await rufe(`/sightings/${id}/dispute`, '10.0.0.3')
    expect(await dritte.json()).toEqual({ ok: true, counted: true })

    expect(zeile('SELECT confirmations, disputes FROM sightings WHERE id = ?', id)).toEqual({
      confirmations: 1,
      disputes: 1,
    })
    expect(anzahl('votes')).toBe(2)
  })

  it('kennt genau zwei Arten und nur Kennungen, die ins Muster passen', async () => {
    const id = await melde('10.0.0.1')
    const stimme = (kennung: string, art: string) => rufe(`/sightings/${encodeURIComponent(kennung)}/${art}`, '10.0.0.2')
    for (const art of ['vielleicht', 'CONFIRM', 'confirm2', '']) {
      expect((await stimme(id, art)).status, art).toBe(404)
    }
    for (const kennung of ['../etc', 'a b', "a'or'1", 'a'.repeat(65), '']) {
      expect((await stimme(kennung, 'confirm')).status, kennung).toBe(404)
    }
    expect(anzahl('votes')).toBe(0)
    expect((await stimme(id, 'confirm')).status).toBe(200)
  })

  it('auf eine unbekannte oder verfallene Meldung ist 404 — und schreibt nichts', async () => {
    const id = await melde('10.0.0.1')
    expect((await rufe('/sightings/gibt-es-nicht/confirm', '10.0.0.2')).status).toBe(404)
    vi.setSystemTime(START + 91 * 60_000)
    expect((await rufe(`/sightings/${id}/confirm`, '10.0.0.2')).status).toBe(404)
    expect(anzahl('votes')).toBe(0)
  })

  it('auf eine Meldung ohne Client-Hash (Telegram) darf jeder abgeben', async () => {
    db.prepare(
      'INSERT INTO sightings (id, lon, lat, city, reported_at, confirmations, disputes, client_hash) VALUES (?, ?, ?, ?, ?, 0, 0, NULL)',
    ).run('tg', 13.4, 52.5, 'berlin', START)
    const antwort = await rufe('/sightings/tg/confirm', '10.0.0.1')
    expect(await antwort.json()).toEqual({ ok: true, counted: true })
  })
})

describe('die Sichtungsliste', () => {
  it('nennt nur lebende Meldungen der gefragten Stadt, nie den Client-Hash', async () => {
    const berlin = await melde('10.0.0.1')
    await melde('10.0.0.1', { lon: 9.99, lat: 53.55 })
    vi.setSystemTime(START + 91 * 60_000)
    const spaet = await melde('10.0.0.1')
    const antwort = await worker.fetch(new Request('https://api.example/sightings?city=berlin'), env)
    const body = (await antwort.json()) as { sightings: Record<string, unknown>[] }
    expect(body.sightings.map((s) => s.id)).toEqual([spaet])
    expect(body.sightings.map((s) => s.id)).not.toContain(berlin)
    expect(Object.keys(body.sightings[0]!)).not.toContain('client_hash')
    expect(Object.keys(body.sightings[0]!)).not.toContain('clientHash')
  })
})

describe('eine Rückmeldung', () => {
  const schicke = (ip: string) => rufe('/feedback', ip, { kind: 'idee', text: 'Mehr Städte bitte' })

  it('steht auf die Stunde gerundet in der Tabelle', async () => {
    expect((await schicke('10.0.0.1')).status).toBe(201)
    expect(zeile<{ created_at: number }>('SELECT created_at FROM feedback').created_at).toBe(
      Date.parse('2026-09-08T10:00:00+02:00'),
    )
  })

  // M-045: Das Fenster reicht eine Stunde weiter zurück, weil der Stempel
  // gerundet ist — vier um 10:59 und vier um 11:01 wären sonst acht.
  it('die fünfte in der Stunde bekommt 429, auch über den Stundenwechsel hinweg', async () => {
    vi.setSystemTime(Date.parse('2026-09-08T10:59:00+02:00'))
    for (let i = 0; i < 4; i++) expect((await schicke('10.0.0.1')).status).toBe(201)
    expect((await schicke('10.0.0.1')).status).toBe(429)
    vi.setSystemTime(Date.parse('2026-09-08T11:01:00+02:00'))
    expect((await schicke('10.0.0.1')).status).toBe(429)
    vi.setSystemTime(Date.parse('2026-09-08T12:01:00+02:00'))
    expect((await schicke('10.0.0.1')).status).toBe(201)
  })
})

describe('der Besuchszähler', () => {
  const ping = (id: string) => rufe('/visits', '10.0.0.1', { id })
  const seen = (id: string) => zeile<{ seen_at: number }>('SELECT seen_at FROM visits WHERE id = ?', id).seen_at

  it('zählt ein heutiges Gerät und antwortet mit beiden Zahlen', async () => {
    const antwort = await ping('2026-09-08-abc')
    expect(antwort.status).toBe(200)
    expect(await antwort.json()).toEqual({ today: 1, online: 1 })
    expect((await ping('2026-09-07-abc')).status).toBe(422)
  })

  it('frischt eine Zeile erst nach drei Minuten auf — sonst kostet jeder Ping eine Schreibung', async () => {
    await ping('2026-09-08-abc')
    vi.setSystemTime(START + 2 * 60_000)
    await ping('2026-09-08-abc')
    expect(seen('2026-09-08-abc')).toBe(START)
    vi.setSystemTime(START + 4 * 60_000)
    await ping('2026-09-08-abc')
    expect(seen('2026-09-08-abc')).toBe(START + 4 * 60_000)
  })

  it('nimmt bei vollem Tag kein neues Gerät mehr an, frischt bekannte aber weiter auf', async () => {
    const einfuegen = db.prepare('INSERT INTO visits (id, day, seen_at) VALUES (?, ?, ?)')
    for (let i = 0; i < 20_000; i++) einfuegen.run(`2026-09-08-n${i}`, '2026-09-08', START - 10 * 60_000)
    expect(await (await ping('2026-09-08-neu')).json()).toEqual({ today: 20_000, online: 0 })
    expect(await (await ping('2026-09-08-n7')).json()).toEqual({ today: 20_000, online: 1 })
  })
})

describe('das Zählwerk der Ereignisse', () => {
  const buendel = (events: { name: string; value?: string; n?: number }[]) =>
    rufe('/events', '10.0.0.1', { city: 'berlin', events })
  const gezaehlt = (name: string) =>
    zeile<{ n: number }>("SELECT COALESCE(SUM(n), 0) AS n FROM events WHERE name = ?", name).n

  it('schreibt das erste Bündel eines Tages, obwohl es noch keine Budgetzeile gibt', async () => {
    expect(await (await buendel([{ name: 'app.open', n: 2 }])).json()).toEqual({ written: 1 })
    expect(gezaehlt('app.open')).toBe(2)
    expect(zeile('SELECT n FROM event_budget WHERE day = ?', '2026-09-08')).toEqual({ n: 2 })
  })

  it('zählt dieselbe Zeile hoch statt eine zweite anzulegen — und hält Stunden und Städte auseinander', async () => {
    await buendel([{ name: 'app.open', n: 2 }])
    await buendel([{ name: 'app.open', n: 3 }])
    vi.setSystemTime(START + 60 * 60_000)
    await buendel([{ name: 'app.open', n: 1 }])
    await rufe('/events', '10.0.0.1', { city: 'hamburg', events: [{ name: 'app.open', n: 4 }] })
    expect(db.prepare('SELECT city, hour, n FROM events ORDER BY city, hour').all()).toEqual([
      { city: 'berlin', hour: 10, n: 5 },
      { city: 'berlin', hour: 11, n: 1 },
      { city: 'hamburg', hour: 11, n: 4 },
    ])
  })

  it('legt Ortsereignisse auf Stunde -1 und Zeitereignisse auf die Stunde', async () => {
    await buendel([{ name: 'zone.open', value: '12' }, { name: 'zone.answer', value: 'frei' }])
    expect(db.prepare('SELECT name, hour FROM events ORDER BY name').all()).toEqual([
      { name: 'zone.answer', hour: 10 },
      { name: 'zone.open', hour: -1 },
    ])
  })

  // Die Reservierung steht ZULETZT im batch: Ein Bündel, das über den Deckel
  // läuft, wird ganz geschrieben, und erst das nächste wird verworfen. Stand
  // sie zuerst, las jede Zählanweisung den schon erhöhten Stand und schrieb
  // nichts — bei einer Antwort, die trotzdem `written: n` sagte.
  it('schreibt das Bündel, das über den Deckel läuft, und verwirft erst das nächste', async () => {
    const volle = () => buendel(Array.from({ length: 4 }, () => ({ name: 'app.open', n: 50 })))
    for (let i = 0; i < 24; i++) expect(await (await volle()).json()).toEqual({ written: 4 })
    expect(gezaehlt('app.open')).toBe(4800)
    expect(await (await buendel([{ name: 'app.open', n: 50 }, { name: 'park.start', n: 50 }, { name: 'tow.open', n: 50 }, { name: 'zone.outside', n: 50 }])).json()).toEqual({ written: 4 })
    expect(gezaehlt('app.open') + gezaehlt('park.start') + gezaehlt('tow.open') + gezaehlt('zone.outside')).toBe(5000)
    expect(await (await buendel([{ name: 'app.open', n: 1 }])).json()).toEqual({ written: 0 })
    expect(gezaehlt('app.open')).toBe(4850)
  })
})

describe('der Aufräumlauf', () => {
  const sichtung = (id: string, vorMinuten: number, hash: string | null = 'h') =>
    db
      .prepare(
        'INSERT INTO sightings (id, lon, lat, city, reported_at, confirmations, disputes, client_hash) VALUES (?, 13.4, 52.5, ?, ?, 0, 0, ?)',
      )
      .run(id, 'berlin', START - vorMinuten * 60_000, hash)

  it('nimmt nach einer Stunde das Pseudonym, nach 90 Minuten die Meldung samt Stimmen', async () => {
    sichtung('frisch', 10)
    sichtung('mittel', 61)
    sichtung('alt', 91)
    db.prepare('INSERT INTO votes (sighting_id, client_hash, voted_at) VALUES (?, ?, ?)').run('alt', 'x', START)
    db.prepare('INSERT INTO votes (sighting_id, client_hash, voted_at) VALUES (?, ?, ?)').run('frisch', 'x', START)
    await worker.scheduled({} as ScheduledController, env)
    expect(db.prepare('SELECT id, client_hash FROM sightings ORDER BY id').all()).toEqual([
      { id: 'frisch', client_hash: 'h' },
      { id: 'mittel', client_hash: null },
    ])
    expect(db.prepare('SELECT sighting_id FROM votes').all()).toEqual([{ sighting_id: 'frisch' }])
  })

  it('hält die Fristen der übrigen Tabellen: 28 Tage Striche, 2 Tage Besuche, 90 Tage Rückmeldungen und Ereignisse', async () => {
    const tagVor = (n: number) => {
      const d = new Date(START - n * 86_400_000)
      return d.toISOString().slice(0, 10)
    }
    const strich = db.prepare('INSERT INTO marks (id, day, cell, city, hour) VALUES (?, ?, ?, ?, ?)')
    strich.run('jung', tagVor(27), 'berlin:1_1', 'berlin', 10)
    strich.run('alt', tagVor(29), 'berlin:1_1', 'berlin', 10)
    const besuch = db.prepare('INSERT INTO visits (id, day, seen_at) VALUES (?, ?, ?)')
    besuch.run(`${tagVor(1)}-a`, tagVor(1), START - 47 * 3_600_000)
    besuch.run(`${tagVor(3)}-b`, tagVor(3), START - 49 * 3_600_000)
    const rueck = db.prepare('INSERT INTO feedback (id, kind, text, created_at, client_hash) VALUES (?, ?, ?, ?, ?)')
    rueck.run('neu', 'idee', 't', START - 2 * 3_600_000, 'h')
    rueck.run('alt', 'idee', 't', START - 91 * 86_400_000, 'h')
    const ereignis = db.prepare('INSERT INTO events (day, hour, city, name, value, n) VALUES (?, ?, ?, ?, ?, 1)')
    ereignis.run(tagVor(89), 1, 'berlin', 'app.open', '')
    ereignis.run(tagVor(91), 1, 'berlin', 'app.open', '')

    await worker.scheduled({} as ScheduledController, env)

    expect(db.prepare('SELECT id FROM marks').all()).toEqual([{ id: 'jung' }])
    expect(db.prepare('SELECT id FROM visits').all()).toEqual([{ id: `${tagVor(1)}-a` }])
    expect(db.prepare('SELECT id, client_hash FROM feedback').all()).toEqual([{ id: 'neu', client_hash: null }])
    expect(db.prepare('SELECT day FROM events').all()).toEqual([{ day: tagVor(89) }])
  })

  // Die k-Schwelle und die Ebenen-Aufschlüsselung standen bis zum 10. September
  // als SQL-Abschrift in `events-sql.test.ts` — hier laufen sie über den
  // Worker selbst, gegen den Stand, den die Statistikseite liest.
  it('nennt eine Zone erst ab der Schwelle, lässt die Stadtsumme exakt und Orte aus dem Tagesgang', async () => {
    const heute = new Date(START).toISOString().slice(0, 10)
    const ereignis = db.prepare('INSERT INTO events (day, hour, city, name, value, n) VALUES (?, ?, ?, ?, ?, ?)')
    ereignis.run(heute, -1, 'berlin', 'zone.open', '34', 9)
    ereignis.run(heute, -1, 'berlin', 'zone.open', '29', 2)
    ereignis.run(heute, -1, 'berlin', 'zone.open', '7', 1)
    ereignis.run(heute, 8, 'berlin', 'app.open', '', 3)
    ereignis.run(heute, 9, 'berlin', 'app.open', '', 4)
    ereignis.run(heute, 10, 'berlin', 'layer.on', 'charging', 2)
    ereignis.run(heute, 10, 'berlin', 'layer.on', 'carsharing', 1)
    ereignis.run(heute, -1, 'berlin', 'city.switch', 'hamburg', 1)
    await worker.scheduled({} as ScheduledController, env)
    const stand = JSON.parse(kv.get('stats:v1')!) as {
      proZone: { city: string; zone: string; n: number }[]
      proStunde: { hour: number; n: number }[]
      proWert: { name: string; value: string; n: number }[]
    }
    expect(stand.proZone).toEqual([
      { city: 'berlin', zone: '34', n: 9 },
      { city: 'berlin', zone: '', n: 3 },
    ])
    expect(stand.proStunde).toEqual([
      { hour: 8, n: 3 },
      { hour: 9, n: 4 },
    ])
    expect(stand.proWert).toEqual([
      { name: 'app.open', value: '', n: 7 },
      { name: 'layer.on', value: 'charging', n: 2 },
      { name: 'layer.on', value: 'carsharing', n: 1 },
    ])
  })

  it('rechnet die Auswertung mit Zeilen: Kopfzahlen aus drei Tagen', async () => {
    const tagVor = (n: number) => new Date(START - n * 86_400_000).toISOString().slice(0, 10)
    const ereignis = db.prepare('INSERT INTO events (day, hour, city, name, value, n) VALUES (?, ?, ?, ?, ?, ?)')
    ereignis.run(tagVor(0), 10, 'berlin', 'app.open', '', 3)
    ereignis.run(tagVor(1), 9, 'hamburg', 'app.open', '', 5)
    ereignis.run(tagVor(10), 9, 'berlin', 'app.open', '', 7)
    ereignis.run(tagVor(40), 9, 'berlin', 'app.open', '', 100)
    await worker.scheduled({} as ScheduledController, env)
    const stand = JSON.parse(kv.get('stats:v1')!) as { kopf: { heute: number; tage7: number; tage28: number } }
    expect(stand.kopf).toEqual({ heute: 3, tage7: 8, tage28: 15 })
  })
})
