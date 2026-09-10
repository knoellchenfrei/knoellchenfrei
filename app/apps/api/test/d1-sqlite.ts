import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'

/**
 * D1 über echtem SQLite — die Attrappe, die dem Worker gefehlt hat.
 *
 * Bis zum 10. September antwortete die Datenbank-Attrappe der Worker-Tests auf
 * jedes `first()` mit `null`. Damit war alles hinter dem ersten `SELECT`
 * unerreichbar: Jede Stimme endete in 404, jede Ratengrenze bei null, und
 * der Primärschlüssel in `votes` — die Zusicherung hinter M-047 — lief nie.
 * Der Test-Audit hat es gemessen: 30 von 48 Mutanten im Worker überlebten,
 * darunter die ganze Stimmen-Route.
 *
 * Diese Datei reicht `prepare().bind().run()/first()/all()` und `batch()` an
 * `node:sqlite` durch und spielt vorher die Migrationen aus `migrations/`
 * ein — dieselben Dateien, die `wrangler d1 migrations apply` fährt. Was
 * hier läuft, läuft gegen das Schema, nicht gegen eine Abschrift davon.
 */
const MIGRATIONEN = join(import.meta.dirname, '../migrations')

export function d1AusSqlite(): { d1: D1Database; db: DatabaseSync } {
  const db = new DatabaseSync(':memory:')
  for (const datei of readdirSync(MIGRATIONEN).filter((n) => n.endsWith('.sql')).sort()) {
    db.exec(readFileSync(join(MIGRATIONEN, datei), 'utf8'))
  }

  const meta = (changes: number | bigint) => ({
    changes: Number(changes),
    duration: 0,
    last_row_id: 0,
    rows_read: 0,
    rows_written: 0,
    size_after: 0,
    changed_db: Number(changes) > 0,
  })

  type Werte = (string | number | bigint | null)[]
  const fahre = (sql: string, werte: Werte) => {
    const anweisung = db.prepare(sql)
    if (/^\s*select/i.test(sql)) {
      const results = anweisung.all(...werte) as Record<string, unknown>[]
      return { success: true as const, results, meta: meta(0) }
    }
    const { changes } = anweisung.run(...werte)
    return { success: true as const, results: [] as Record<string, unknown>[], meta: meta(changes) }
  }

  const gebunden = (sql: string, werte: Werte) => ({
    bind: (...neu: Werte) => gebunden(sql, neu),
    run: async () => fahre(sql, werte),
    all: async () => fahre(sql, werte),
    first: async (spalte?: string) => {
      const zeile = (db.prepare(sql).get(...werte) as Record<string, unknown> | undefined) ?? null
      if (zeile === null) return null
      return spalte === undefined ? zeile : (zeile[spalte] ?? null)
    },
    raw: async () => fahre(sql, werte).results.map((zeile) => Object.values(zeile)),
    // Nur für `batch` unten: die gebundene Form ausführbar machen.
    __fahre: () => fahre(sql, werte),
  })

  const d1 = {
    prepare: (sql: string) => gebunden(sql, []),
    batch: async (anweisungen: { __fahre: () => unknown }[]) => {
      // D1 fährt ein Bündel als eine Transaktion, der Reihe nach — genau die
      // Eigenschaft, an der die Reihenfolge der Budget-Reservierung hing.
      db.exec('BEGIN')
      try {
        const ergebnisse = anweisungen.map((a) => a.__fahre())
        db.exec('COMMIT')
        return ergebnisse
      } catch (fehler) {
        db.exec('ROLLBACK')
        throw fehler
      }
    },
    exec: async (sql: string) => {
      db.exec(sql)
      return { count: 0, duration: 0 }
    },
    dump: async () => new ArrayBuffer(0),
  }
  return { d1: d1 as unknown as D1Database, db }
}
