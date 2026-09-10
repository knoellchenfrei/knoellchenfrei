import { describe, expect, it } from 'vitest'

import { d1AusSqlite } from './d1-sqlite.js'

/**
 * Die Zusicherungen, die das Schema selbst trägt — `CHECK`-Klauseln aus
 * `migrations/0002_events.sql`, eingespielt wie in D1.
 *
 * Bis zum 10. September hiess diese Datei `events-sql.test.ts` und trug 20
 * Tests über eine **Abschrift** der Worker-Anweisungen: Die SQL stand als
 * Zeichenkette im Test, die Reihenfolge im `batch` war im Helfer nachgebaut.
 * `COALESCE` aus dem Worker entfernen und die Reservierung wieder zuerst
 * setzen — beides Regeln aus CLAUDE.md — überlebten, weil die Tests den
 * Fehler nur gefunden hätten, wenn jemand ihn auch in die Abschrift schreibt.
 * Was der Worker tut, steht seitdem in `worker-sqlite.test.ts` gegen den
 * Worker selbst; hier bleibt, was nur das Schema zusichert.
 */
describe('die Zusicherungen im Schema', () => {
  const einfuegen = (hour: number, n: number) => {
    const { db } = d1AusSqlite()
    return () =>
      db
        .prepare('INSERT INTO events (day, hour, city, name, value, n) VALUES (?, ?, ?, ?, ?, ?)')
        .run('2026-09-07', hour, 'berlin', 'app.open', '', n)
  }

  it('weist eine unmögliche Stunde ab — -1 ist der Tag, alles darunter ein Fehler', () => {
    expect(einfuegen(24, 1)).toThrow()
    expect(einfuegen(-2, 1)).toThrow()
    expect(einfuegen(-1, 1)).not.toThrow()
  })

  it('weist eine Anzahl von null ab', () => {
    expect(einfuegen(9, 0)).toThrow()
  })
})
