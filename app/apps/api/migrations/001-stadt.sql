-- Migration 001: die Stadt in die Zeilen.
--
-- Für **bestehende** Datenbanken. Eine frisch angelegte braucht sie nicht:
-- schema.sql führt `city` bereits im `CREATE TABLE`.
--
-- Warum als eigene Datei und nicht als Kommentar in schema.sql: Der
-- Einrichtungs-Workflow spielt schema.sql erneut ein, aber
-- `CREATE TABLE IF NOT EXISTS` ist auf einer vorhandenen Tabelle ein No-op,
-- und SQLite kennt kein `ADD COLUMN IF NOT EXISTS`. Eine auskommentierte
-- Anweisung wäre also nie gelaufen, und der Worker liefe gegen eine Tabelle
-- ohne die Spalte — `no such column: city` bei jeder Meldung.
--
-- Einspielen:
--
--   cd app
--   pnpm --filter @knoellchenfrei/api exec wrangler d1 execute knoellchenfrei \
--     --file=migrations/001-stadt.sql --remote
--
-- **Genau einmal.** SQLite hat kein `ADD COLUMN IF NOT EXISTS`; ein zweiter
-- Lauf bricht mit `duplicate column name: city` ab. Das ist kein Schaden — die
-- Anweisung davor ist dann bereits durch —, sieht aber wie ein Fehler aus.
--
-- Von Hand muss das ohnehin niemand: Der Workflow *Cloudflare einrichten*
-- spielt `migrations/*.sql` mit ein, **vor** `schema.sql`, und nimmt genau die
-- beiden harmlosen Meldungen hin — `duplicate column name` (schon migriert)
-- und `no such table` (frische Datenbank, gleich legt schema.sql sie an).
-- Andersherum ging es am 6. September schief: `schema.sql` legt einen Index
-- auf `city` an, den es auf einer unmigrierten Tabelle nicht geben kann —
-- `no such column: city`.

-- Der Vorgabewert ist nicht Bequemlichkeit, sondern die Tatsache: Bis zu
-- dieser Änderung nahm der Worker ausschließlich Positionen innerhalb der
-- Berliner Box an — jede bestehende Zeile *ist* eine Berliner.
ALTER TABLE sightings ADD COLUMN city TEXT NOT NULL DEFAULT 'berlin';
ALTER TABLE marks ADD COLUMN city TEXT NOT NULL DEFAULT 'berlin';

-- Die Lesepfade filtern jetzt zusätzlich nach Stadt.
CREATE INDEX IF NOT EXISTS sightings_city_time ON sightings (city, reported_at);
CREATE INDEX IF NOT EXISTS marks_city_day ON marks (city, day);

-- `visits` bekommt bewusst keine Spalte: Ein Ping trägt keine Position, die
-- Stadt wäre vom Client behauptet statt abgeleitet. Begründung bei
-- `recordVisit` in src/worker.ts.
