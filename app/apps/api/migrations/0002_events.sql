-- Migration 0002: das Zählwerk der Nutzungsstatistik.
--
-- Zwei Tabellen, und die zweite ist keine Bequemlichkeit.
--
-- `events` ist ein **Zählwerk, kein Ereignisprotokoll**: eine Zeile je
-- (Tag, Stunde, Stadt, Ereignis, Ausprägung) mit einem Zähler darauf. Es gibt
-- keine Kennung, keine Sitzung, keine Reihenfolge und keine Minute — die Frage
-- „was hat diese Person getan" ist darin nicht formulierbar.
--
-- Das allein reicht aber nicht. Anonymität ist eine Eigenschaft der **Zahlen**,
-- nicht der Tabelle: Bei zweistelliger Leserzahl wäre eine Zeile
-- (Tag, Stunde, Stadt, zone.open, Volkartstraße, 1) ein Einzelereignis mit Ort
-- UND Zeit, und sie stünde neben `sightings` und `marks` in derselben
-- Datenbank. Deshalb die Regel im Katalog (`core/events.ts`): Ereignisse, deren
-- Ausprägung ein Ort ist, bekommen `hour = -1` — es zählt nur der Tag. Alle
-- anderen bekommen die Stunde. Ort **oder** Zeit, nie beides.
--
-- `hour = -1` ist deshalb kein Fehlwert, sondern Teil des Schlüssels. Jede
-- Leseabfrage über den Tagesgang muss `hour >= 0` filtern, sonst steht dort ein
-- 25. Balken.
--
-- `WITHOUT ROWID`, weil die Tabelle ausschliesslich über ihren
-- Primärschlüssel geschrieben und gelesen wird. Ein zusätzlicher Index auf
-- `day` wäre überflüssig — der Schlüssel beginnt damit — und kostete bei jedem
-- Zählschritt eine zweite Indexschreibung.
CREATE TABLE IF NOT EXISTS events (
  day   TEXT    NOT NULL,   -- YYYY-MM-DD, Berliner Ortszeit, vom SERVER gestempelt
  hour  INTEGER NOT NULL,   -- 0..23, oder -1 für „über den ganzen Tag"
  city  TEXT    NOT NULL,   -- Stadtschlüssel aus core/city.ts
  name  TEXT    NOT NULL,   -- Ereignisname aus core/events.ts
  value TEXT    NOT NULL,   -- geprüfte Ausprägung, oder ''
  n     INTEGER NOT NULL,
  PRIMARY KEY (day, hour, city, name, value),
  CHECK (hour BETWEEN -1 AND 23),
  CHECK (n > 0)
) WITHOUT ROWID;

-- Das Tagesbudget.
--
-- Warum eine eigene Tabelle und nicht `SUM(n) FROM events WHERE day = ?` im
-- Prädikat: D1 rechnet **gelesene Zeilen** gegen ein Budget von 5 Mio. am Tag
-- ab. Eine Summe über den ganzen Tag, je Ereignis ausgeführt, liest bei 2.000
-- Zeilen und 400 Bündeln zu je 25 Ereignissen 20 Millionen Zeilen — das
-- Prädikat sieht billig aus und ist es nicht. Hier ist es **eine** Zeile,
-- gelesen über den Primärschlüssel.
--
-- Gezählt wird das **Angenommene**, nicht das Geschriebene. Die Abweichung
-- geht damit in die vorsichtige Richtung.
--
-- Warum es die Grenze überhaupt braucht: `events` wird über eine offene
-- Adresse geschrieben. Die Grenze bei `visits` zählt nur *neue* Zeilen — D1
-- zählt aber jedes `ON CONFLICT DO UPDATE` als geschriebene Zeile. Ohne diese
-- Tabelle schriebe ein Aufrufer unbegrenzt auf bestehende Zeilen, und wenn das
-- Schreibbudget fällt, fallen die Meldungen mit.
CREATE TABLE IF NOT EXISTS event_budget (
  day TEXT PRIMARY KEY,
  n   INTEGER NOT NULL
) WITHOUT ROWID;
