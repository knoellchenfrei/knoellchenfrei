import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'

import { beforeEach, describe, expect, it } from 'vitest'

/**
 * Das Zählwerk **gegen echtes SQLite**, nicht gegen eine Attrappe.
 *
 * `worker.test.ts` daneben schreibt Anweisungen mit, statt sie auszuführen —
 * es kann prüfen, *welche* Abfrage läuft, nicht *was* sie tut. Genau dort liegt
 * aber der Fehler, den man nicht sieht: Beim Deckel für `/visits` hielt die
 * erste Fassung mit der Grenze auch das Auffrischen vorhandener Zeilen an, und
 * das fiel erst gegen SQLite auf.
 *
 * D1 ist SQLite; `node:sqlite` liegt seit Node 22.5 bei. Das ist der billigste
 * Weg zu einer Zusicherung, die trägt — `@cloudflare/vitest-pool-workers` mit
 * Miniflare wäre der vollständigere und ist ein eigener Schritt.
 */

const MIGRATION = readFileSync(join(import.meta.dirname, '../migrations/0002_events.sql'), 'utf8')

const EVENTS_PER_DAY = 20

/** Genau die Anweisungen, die der Worker fährt. */
const RESERVIEREN =
  'INSERT INTO event_budget (day, n) VALUES (?, ?)' +
  ' ON CONFLICT (day) DO UPDATE SET n = event_budget.n + excluded.n'
const ZAEHLEN =
  'INSERT INTO events (day, hour, city, name, value, n) SELECT ?, ?, ?, ?, ?, ?' +
  ' WHERE (SELECT n FROM event_budget WHERE day = ?) <= ?' +
  ' ON CONFLICT (day, hour, city, name, value) DO UPDATE SET n = events.n + excluded.n'

let db: DatabaseSync

function bündel(tag: string, ereignisse: [string, number, string, string, number][]): void {
  const gesamt = ereignisse.reduce((summe, e) => summe + e[4], 0)
  db.prepare(RESERVIEREN).run(tag, gesamt)
  for (const [name, hour, city, value, n] of ereignisse) {
    db.prepare(ZAEHLEN).run(tag, hour, city, name, value, n, tag, EVENTS_PER_DAY)
  }
}

const zahl = (tag: string, name: string, value = ''): number =>
  (db.prepare('SELECT COALESCE(SUM(n), 0) AS n FROM events WHERE day = ? AND name = ? AND value = ?')
    .get(tag, name, value) as { n: number }).n

beforeEach(() => {
  db = new DatabaseSync(':memory:')
  db.exec(MIGRATION)
})

describe('das Zählwerk', () => {
  it('legt eine Zeile an und zählt sie danach hoch', () => {
    bündel('2026-09-07', [['app.open', 14, 'berlin', '', 1]])
    expect(zahl('2026-09-07', 'app.open')).toBe(1)
    bündel('2026-09-07', [['app.open', 14, 'berlin', '', 3]])
    expect(zahl('2026-09-07', 'app.open')).toBe(4)
  })

  it('hält Stunden auseinander', () => {
    bündel('2026-09-07', [['app.open', 9, 'berlin', '', 1], ['app.open', 10, 'berlin', '', 2]])
    expect(zahl('2026-09-07', 'app.open')).toBe(3)
    const proStunde = db
      .prepare('SELECT hour, n FROM events WHERE name = ? ORDER BY hour')
      .all('app.open') as { hour: number; n: number }[]
    expect(proStunde).toEqual([{ hour: 9, n: 1 }, { hour: 10, n: 2 }])
  })

  it('hält Städte auseinander', () => {
    bündel('2026-09-07', [['app.open', 9, 'berlin', '', 1], ['app.open', 9, 'muenchen', '', 5]])
    const proStadt = db
      .prepare('SELECT city, n FROM events ORDER BY city')
      .all() as { city: string; n: number }[]
    expect(proStadt).toEqual([{ city: 'berlin', n: 1 }, { city: 'muenchen', n: 5 }])
  })

  // Die Regel aus `core/events.ts`: Ort oder Zeit, nie beides. `-1` ist Teil
  // des Schlüssels, kein Fehlwert.
  it('legt Ortsereignisse auf -1 und mischt sie nicht mit Stundenzeilen', () => {
    bündel('2026-09-07', [
      ['zone.open', -1, 'muenchen', 'Volkartstraße', 2],
      ['app.open', 14, 'muenchen', '', 1],
    ])
    const tagesgang = db
      .prepare('SELECT COALESCE(SUM(n), 0) AS n FROM events WHERE hour >= 0')
      .get() as { n: number }
    expect(tagesgang.n).toBe(1)
    expect(zahl('2026-09-07', 'zone.open', 'Volkartstraße')).toBe(2)
  })

  it('nimmt Zonennamen mit Umlaut und Leerzeichen', () => {
    bündel('2026-09-07', [['zone.open', -1, 'muenchen', 'Schönstraße Nord', 1]])
    expect(zahl('2026-09-07', 'zone.open', 'Schönstraße Nord')).toBe(1)
  })
})

describe('das Tagesbudget', () => {
  it('hält an, sobald es aufgebraucht ist', () => {
    bündel('2026-09-07', [['app.open', 9, 'berlin', '', EVENTS_PER_DAY]])
    expect(zahl('2026-09-07', 'app.open')).toBe(EVENTS_PER_DAY)
    // Der nächste Versuch reserviert noch, schreibt aber nichts mehr.
    bündel('2026-09-07', [['app.open', 9, 'berlin', '', 5]])
    expect(zahl('2026-09-07', 'app.open')).toBe(EVENTS_PER_DAY)
  })

  it('gilt je Tag, nicht über alle', () => {
    bündel('2026-09-07', [['app.open', 9, 'berlin', '', EVENTS_PER_DAY]])
    bündel('2026-09-08', [['app.open', 9, 'berlin', '', 3]])
    expect(zahl('2026-09-08', 'app.open')).toBe(3)
  })

  it('zählt das Angenommene, auch wenn nichts geschrieben wurde', () => {
    bündel('2026-09-07', [['app.open', 9, 'berlin', '', EVENTS_PER_DAY]])
    bündel('2026-09-07', [['app.open', 9, 'berlin', '', 7]])
    const budget = db.prepare('SELECT n FROM event_budget WHERE day = ?').get('2026-09-07') as { n: number }
    expect(budget.n).toBe(EVENTS_PER_DAY + 7)
  })

  /**
   * Nachgemessen statt geglaubt — und die Annahme war falsch.
   *
   * Verbreitet ist die Regel, `ON CONFLICT` brauche nach einem
   * `INSERT … SELECT` zwingend eine WHERE-Klausel, sonst sei die Anweisung
   * mehrdeutig. Das gilt nur, wenn der SELECT eine Tabelle nennt: Dann kann
   * `ON` der Anfang eines JOINs sein. Ein SELECT aus reinen Werten ist
   * eindeutig, und SQLite 3.51 nimmt ihn an.
   *
   * Das WHERE steht hier also nicht aus Syntaxgründen, sondern weil es das
   * Budget ist. Der Test hält beides fest, damit niemand es später als
   * überflüssig streicht.
   */
  it('nimmt ON CONFLICT auch ohne WHERE an — das WHERE ist das Budget, nicht Syntax', () => {
    expect(() =>
      db.prepare(
        'INSERT INTO events (day, hour, city, name, value, n) SELECT ?, ?, ?, ?, ?, ?' +
          ' ON CONFLICT (day, hour, city, name, value) DO UPDATE SET n = events.n + excluded.n'
      )
    ).not.toThrow()
    expect(() => db.prepare(ZAEHLEN)).not.toThrow()
  })
})

describe('die Zusicherungen im Schema', () => {
  it('weist eine unmögliche Stunde ab', () => {
    expect(() => bündel('2026-09-07', [['app.open', 24, 'berlin', '', 1]])).toThrow()
    expect(() => bündel('2026-09-07', [['app.open', -2, 'berlin', '', 1]])).toThrow()
  })

  it('weist eine Anzahl von null ab', () => {
    expect(() => bündel('2026-09-07', [['app.open', 9, 'berlin', '', 0]])).toThrow()
  })
})
