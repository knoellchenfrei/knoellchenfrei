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
  ' WHERE COALESCE((SELECT n FROM event_budget WHERE day = ?), 0) < ?' +
  ' ON CONFLICT (day, hour, city, name, value) DO UPDATE SET n = events.n + excluded.n'

let db: DatabaseSync

const budget = (tag: string): number =>
  (db.prepare('SELECT n FROM event_budget WHERE day = ?').get(tag) as { n: number } | undefined)
    ?.n ?? 0

/**
 * Ein Bündel, genau wie der Worker es fährt: erst die Vorprüfung, dann die
 * Zählanweisungen, **zuletzt** die Reservierung.
 *
 * Gibt zurück, was die Antwort behaupten würde — damit ein Test die Behauptung
 * gegen die Tabelle halten kann. Genau dort lag der Fehler.
 */
function bündel(tag: string, ereignisse: [string, number, string, string, number][]): number {
  if (budget(tag) >= EVENTS_PER_DAY) return 0
  for (const [name, hour, city, value, n] of ereignisse) {
    db.prepare(ZAEHLEN).run(tag, hour, city, name, value, n, tag, EVENTS_PER_DAY)
  }
  const gesamt = ereignisse.reduce((summe, e) => summe + e[4], 0)
  db.prepare(RESERVIEREN).run(tag, gesamt)
  return ereignisse.length
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

  it('reserviert nichts mehr, sobald die Vorprüfung ablehnt', () => {
    bündel('2026-09-07', [['app.open', 9, 'berlin', '', EVENTS_PER_DAY]])
    expect(budget('2026-09-07')).toBe(EVENTS_PER_DAY)
    // Vorher wurde auch das Abgelehnte noch aufaddiert; das Budget wuchs dann
    // den ganzen Tag weiter, ohne dass es etwas bedeutet hätte.
    expect(bündel('2026-09-07', [['app.open', 9, 'berlin', '', 7]])).toBe(0)
    expect(budget('2026-09-07')).toBe(EVENTS_PER_DAY)
  })

  /**
   * Der Fehler, den die Reihenfolge im `batch` machte — gemessen, nicht
   * gelesen.
   *
   * Zuerst stand die Reservierung an erster Stelle. Ein `batch` läuft der
   * Reihe nach in einer Transaktion, also lasen die Zählanweisungen bereits
   * den erhöhten Stand: Deckel 20, Stand 18, ein Bündel mit 5 → Budget 23,
   * `23 <= 20` falsch, **null** Zeilen geschrieben. Die Antwort meldete
   * trotzdem `written: 2`. Nicht die Menge war das Problem, sondern dass die
   * Antwort etwas anderes sagte als die Tabelle.
   */
  it('schreibt das Bündel, das über den Deckel läuft — statt es still zu verwerfen', () => {
    bündel('2026-09-07', [['app.open', 9, 'berlin', '', 18]])
    const gemeldet = bündel('2026-09-07', [
      ['app.open', 10, 'berlin', '', 3],
      ['app.open', 11, 'berlin', '', 2],
    ])
    expect(gemeldet).toBe(2)
    expect(zahl('2026-09-07', 'app.open')).toBe(23)
    // Und der Deckel greift ab dem nächsten Aufruf, nicht mitten im Bündel.
    expect(bündel('2026-09-07', [['app.open', 12, 'berlin', '', 9]])).toBe(0)
    expect(zahl('2026-09-07', 'app.open')).toBe(23)
  })

  /**
   * Die Falle, die die Umstellung aufgemacht hätte.
   *
   * Steht die Reservierung zuletzt, gibt es beim **ersten** Bündel eines Tages
   * noch keine Budgetzeile. `(SELECT n FROM event_budget WHERE day = ?)` ist
   * dann NULL, und `NULL < 5000` ist NULL — also falsch. Ohne `COALESCE(…, 0)`
   * würde an jedem Tag das erste Bündel verworfen: täglich, still, und
   * ausgerechnet die Zeilen der ersten Stunde.
   */
  it('schreibt das erste Bündel eines Tages, obwohl es noch keine Budgetzeile gibt', () => {
    expect(budget('2026-09-09')).toBe(0)
    expect(bündel('2026-09-09', [['app.open', 0, 'berlin', '', 2]])).toBe(1)
    expect(zahl('2026-09-09', 'app.open')).toBe(2)
    expect(budget('2026-09-09')).toBe(2)
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

describe('die Auswertung', () => {
  const STATS_MIN_ZONE = 5

  /** Die k-Schwelle, wörtlich wie im Worker. */
  const zonen = (seit: string) =>
    db
      .prepare(
        "SELECT city, CASE WHEN roh >= ? THEN value ELSE '' END AS zone, SUM(roh) AS n FROM (" +
          ' SELECT city, value, SUM(n) AS roh FROM events' +
          " WHERE day >= ? AND hour = -1 AND name = 'zone.open' GROUP BY city, value" +
          ') GROUP BY city, zone ORDER BY city, n DESC'
      )
      .all(STATS_MIN_ZONE, seit) as { city: string; zone: string; n: number }[]

  /**
   * Regression, und der Test hat den Fehler gefunden, nicht das Lesen:
   *
   * Die Spalte hiess zuerst `value` wie die Quellspalte. SQLite löst
   * `GROUP BY value` dann gegen die **innere** Spalte auf statt gegen den
   * `CASE`-Ausdruck — die seltenen Zonen blieben einzeln stehen, jede mit
   * ihrer eigenen Zeile und leerem Namen. Die Schwelle war wirkungslos und sah
   * dabei aus, als wirkte sie: In der Antwort stand überall `''`.
   */
  it('nennt eine Zone erst ab der Schwelle beim Namen', () => {
    bündel('2026-09-07', [
      ['zone.open', -1, 'berlin', '34', 9],
      ['zone.open', -1, 'berlin', '29', 1],
      ['zone.open', -1, 'berlin', '7', 2],
    ])
    const ergebnis = zonen('2026-09-01')
    expect(ergebnis.find((z) => z.zone === '34')?.n).toBe(9)
    expect(ergebnis.find((z) => z.zone === '29')).toBeUndefined()
    // Die seltenen landen zusammengefasst in einer Zeile — weggelassen wird
    // nichts, sonst stimmte die Stadtsumme nicht mehr.
    expect(ergebnis.find((z) => z.zone === '')?.n).toBe(3)
  })

  it('lässt die Stadtsumme trotz Schwelle exakt', () => {
    bündel('2026-09-07', [
      ['zone.open', -1, 'muenchen', 'Volkartstraße', 1],
      ['zone.open', -1, 'muenchen', 'Ridlerstraße', 2],
      ['zone.open', -1, 'muenchen', 'TU-Viertel', 8],
    ])
    const summe = zonen('2026-09-01')
      .filter((z) => z.city === 'muenchen')
      .reduce((s, z) => s + z.n, 0)
    expect(summe).toBe(11)
  })

  // Ortsereignisse liegen auf -1. Ohne den Filter stünde dort ein 25. Balken,
  // und er trüge ausgerechnet die Zahlen mit Ortsbezug.
  it('lässt Ortsereignisse aus dem Tagesgang heraus', () => {
    bündel('2026-09-07', [
      ['zone.open', -1, 'berlin', '34', 5],
      ['app.open', 8, 'berlin', '', 3],
      ['app.open', 9, 'berlin', '', 4],
    ])
    const tagesgang = db
      .prepare(
        "SELECT hour, SUM(n) AS n FROM events WHERE day >= ? AND hour >= 0 AND name = 'app.open'" +
          ' GROUP BY hour ORDER BY hour'
      )
      .all('2026-09-01') as { hour: number; n: number }[]
    expect(tagesgang).toEqual([{ hour: 8, n: 3 }, { hour: 9, n: 4 }])
    expect(tagesgang.some((z) => z.hour < 0)).toBe(false)
  })
})

describe('die Gegenprobe', () => {
  /**
   * Sie ist die einzige Zahl, die etwas über die Statistik selbst sagt.
   * Bleiben Bündel liegen, sinken alle anderen Zahlen einfach — und das sieht
   * aus wie weniger Nutzung statt nach einem Fehler.
   */
  it('vergleicht Öffnungen mit Besuchszeilen', () => {
    db.exec(
      'CREATE TABLE visits (id TEXT PRIMARY KEY, day TEXT NOT NULL, seen_at INTEGER NOT NULL)'
    )
    for (const id of ['a', 'b', 'c']) {
      db.prepare('INSERT INTO visits (id, day, seen_at) VALUES (?, ?, ?)').run(
        id,
        '2026-09-07',
        1
      )
    }
    bündel('2026-09-07', [['app.open', 9, 'berlin', '', 5]])

    const geraete = (
      db.prepare('SELECT COUNT(*) AS n FROM visits WHERE day = ?').get('2026-09-07') as {
        n: number
      }
    ).n
    const oeffnungen = zahl('2026-09-07', 'app.open')
    expect(geraete).toBe(3)
    expect(oeffnungen).toBe(5)
    // Jedes Gerät, das eine Zeile anlegt, hat die App geöffnet.
    expect(oeffnungen).toBeGreaterThanOrEqual(geraete)
  })

  it('schlägt an, wenn Zählungen fehlen', () => {
    db.exec(
      'CREATE TABLE visits (id TEXT PRIMARY KEY, day TEXT NOT NULL, seen_at INTEGER NOT NULL)'
    )
    for (const id of ['a', 'b', 'c', 'd']) {
      db.prepare('INSERT INTO visits (id, day, seen_at) VALUES (?, ?, ?)').run(id, '2026-09-07', 1)
    }
    bündel('2026-09-07', [['app.open', 9, 'berlin', '', 1]])
    const geraete = 4
    expect(zahl('2026-09-07', 'app.open')).toBeLessThan(geraete)
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

describe('die Aufschlüsselung nach Ausprägung', () => {
  /** Wörtlich wie im Worker — inklusive der Positivliste. */
  const werte = (seit: string) =>
    db
      .prepare(
        'SELECT name, value, SUM(n) AS n FROM events' +
          " WHERE day >= ? AND name IN ('layer.on', 'zone.answer', 'zone.source', 'app.open', 'city.suggest')" +
          ' GROUP BY name, value ORDER BY name, n DESC'
      )
      .all(seit) as { name: string; value: string; n: number }[]

  it('trennt die Ebenen, statt sie zu einer Zahl zu summieren', () => {
    bündel('2026-09-07', [
      ['layer.on', 9, 'berlin', 'heat', 5],
      ['layer.on', 9, 'berlin', 'charging', 2],
      ['layer.on', 10, 'berlin', 'heat', 3],
    ])
    const ergebnis = werte('2026-09-01').filter((z) => z.name === 'layer.on')
    // Über die Stunden zusammengezählt, nach Ebene getrennt: genau das, was
    // „welche Ebenen werden benutzt" beantwortet.
    expect(ergebnis).toEqual([
      { name: 'layer.on', value: 'heat', n: 8 },
      { name: 'layer.on', value: 'charging', n: 2 },
    ])
  })

  /**
   * Die Zusicherung, auf die es ankommt: Die Liste ist eine **Positivliste**.
   *
   * `zone.open` und `city.switch` tragen Ortsangaben als Wert. Stünden sie
   * hier mit drin, ginge die Zone ohne k-Schwelle hinaus — und die Schwelle
   * ist der einzige Grund, warum eine einmal angesehene Zone niemanden
   * beschreibt. Eine Positivliste kann nicht dadurch undicht werden, dass
   * jemand dem Katalog ein Ereignis hinzufügt.
   */
  it('lässt jedes Ereignis draussen, dessen Wert ein Ort ist', () => {
    bündel('2026-09-07', [
      ['zone.open', -1, 'berlin', '34', 9],
      ['city.switch', -1, 'berlin', 'hamburg', 4],
      ['zone.answer', 9, 'berlin', 'pflichtig', 1],
    ])
    const namen = werte('2026-09-01').map((z) => z.name)
    expect(namen).not.toContain('zone.open')
    expect(namen).not.toContain('city.switch')
    expect(namen).toContain('zone.answer')
  })
})
