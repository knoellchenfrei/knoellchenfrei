-- Migration 0004: Langzeitmuster der Kontrollen.
--
-- Eine Zeile je (Stadt, Einheit, Quartal, Wochentag, Stunde) mit Zählern.
-- KEIN Datum: Das Quartal ist die feinste Zeitangabe, und ein Quartal hat
-- dreizehn gleiche Wochentage. KEINE Koordinate: Die Einheit ist die Zone,
-- oder der Bezirk, wo eine Zone ein Strassenstück ist (Karlsruhe, 126 m²
-- im Median; `packages/ingest/src/zone-units.ts`). KEINE Kennung, keine
-- Stimme, kein Bezug zur Sichtung. Damit ist jede Zeile in jeder Dimension
-- gröber als eine Strichliste in `marks` (Datum, Stunde, 250-m-Zelle,
-- 28 Tage) — sie liegt nur länger: zwölf Quartale.
--
-- Warum überhaupt: „Wann wird hier typischerweise kontrolliert?" braucht
-- Wochen, nicht Tage — die Zelle Zone × Wochentag × Stunde hat bei 20
-- Meldungen am Tag nach 28 Tagen 0,06 Meldungen. Die Sichtungen länger zu
-- halten wäre die falsche Antwort (Koordinate, Minute, Client-Hash: ein
-- Bewegungsprotokoll der Meldenden); diese Tabelle ist die richtige.
--
-- Befüllt vom stündlichen Lauf aus den Sichtungen, die er im selben Bündel
-- löscht (`src/harvest.ts`): Nur dort sind die Stimmen endgültig, und nur
-- die Atomarität des Bündels macht die Ernte idempotent. `slots` zählt
-- Zeitfenster, nicht Meldungen — drei Leute, die denselben Beamten sehen,
-- sind ein Ereignis, und ein Vielmelder belegt eine Wochenstunde je Woche
-- höchstens einmal.
CREATE TABLE IF NOT EXISTS kontrollen_langzeit (
  city      TEXT    NOT NULL,
  unit      TEXT    NOT NULL,   -- Zonenschlüssel | 'bezirk:<name>' | '' = in keiner Einheit
  quarter   TEXT    NOT NULL,   -- YYYY-Qn, Berliner Ortszeit
  weekday   INTEGER NOT NULL,   -- 0..6, Sonntag 0; Feiertage liegen auf 0
  hour      INTEGER NOT NULL,   -- 0..23
  slots     INTEGER NOT NULL,   -- Tage mit >= 1 Meldung in dieser Wochenstunde
  reports   INTEGER NOT NULL,
  confirmed INTEGER NOT NULL,   -- Laplace-Zustimmung (c+1)/(c+d+2) >= 0,62 bei Ablauf
  disputed  INTEGER NOT NULL,   -- mehr Widersprüche als Bestätigungen
  weight    REAL    NOT NULL,   -- Summe der Laplace-Zustimmung
  PRIMARY KEY (city, unit, quarter, weekday, hour),
  CHECK (weekday BETWEEN 0 AND 6),
  CHECK (hour BETWEEN 0 AND 23),
  CHECK (slots >= 1),
  CHECK (reports >= slots),
  CHECK (confirmed + disputed <= reports),
  CHECK (quarter GLOB '[0-9][0-9][0-9][0-9]-Q[1-4]')
) WITHOUT ROWID;

-- Nutzungsintensität als Nenner für Phase 2: aus `events.app.open`, also mit
-- demselben Widerspruchsschalter und GPC — kein zweiter Zählpfad. Ort nur
-- Stadt, Zeit nur Quartal, Wochentag und Stunde. Befüllt vom täglichen
-- Lauf für den Vortag, bevor `events` nach 90 Tagen verfällt.
CREATE TABLE IF NOT EXISTS kontrollen_nutzung (
  city       TEXT    NOT NULL,
  quarter    TEXT    NOT NULL,
  weekday    INTEGER NOT NULL,
  hour       INTEGER NOT NULL,
  opens      INTEGER NOT NULL,   -- Summe der Öffnungen
  hours_used INTEGER NOT NULL,   -- Stunden mit >= 1 Öffnung
  PRIMARY KEY (city, quarter, weekday, hour),
  CHECK (weekday BETWEEN 0 AND 6),
  CHECK (hour BETWEEN 0 AND 23)
) WITHOUT ROWID;

-- Verlauf je Stadt und ISO-Woche: Datum ja (die Woche), Ort nur Stadt.
-- Die Frage „wie hat sich die Kontrolldichte entwickelt" — drei Jahre.
CREATE TABLE IF NOT EXISTS kontrollen_verlauf (
  city      TEXT    NOT NULL,
  week      TEXT    NOT NULL,   -- YYYY-Www
  reports   INTEGER NOT NULL,
  slots     INTEGER NOT NULL,
  confirmed INTEGER NOT NULL,
  disputed  INTEGER NOT NULL,
  opens     INTEGER NOT NULL,
  PRIMARY KEY (city, week)
) WITHOUT ROWID;

-- Erster Erntetag je Stadt: Der Nenner (beobachtete Wochen) kommt aus dem
-- Kalender, und ein Quartal ohne Meldungen hat Wochen, aber keine Zeilen.
-- `nutzung_bis` merkt, bis zu welchem Tag die Nutzung übernommen ist —
-- ein Tag wird nie zweimal aufaddiert.
CREATE TABLE IF NOT EXISTS kontrollen_meta (
  city        TEXT PRIMARY KEY,
  since       TEXT NOT NULL,           -- YYYY-MM-DD
  nutzung_bis TEXT                     -- YYYY-MM-DD, NULL bis zum ersten Tageslauf
) WITHOUT ROWID;
