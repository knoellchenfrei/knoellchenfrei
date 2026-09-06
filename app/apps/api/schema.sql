-- Sightings of parking enforcement.
--
-- No history is kept: rows past the confidence model's hard cutoff are deleted
-- rather than archived, so the table never becomes a record of where officials
-- have been.
CREATE TABLE IF NOT EXISTS sightings (
  id            TEXT PRIMARY KEY,
  lon           REAL NOT NULL,
  lat           REAL NOT NULL,
  reported_at   INTEGER NOT NULL,
  confirmations INTEGER NOT NULL DEFAULT 0,
  disputes      INTEGER NOT NULL DEFAULT 0,
  -- Coarse client fingerprint, used only to rate-limit and to stop one client
  -- confirming its own report. Never returned by the API.
  client_hash   TEXT
);

-- Reads are always "everything still alive", so the age index carries them.
CREATE INDEX IF NOT EXISTS sightings_reported_at ON sightings (reported_at);

CREATE TABLE IF NOT EXISTS votes (
  sighting_id TEXT NOT NULL,
  client_hash TEXT NOT NULL,
  voted_at    INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (sighting_id, client_hash)
);

-- Votes are rate-limited per client per hour, which is this lookup.
CREATE INDEX IF NOT EXISTS votes_client_time ON votes (client_hash, voted_at);

-- Anonymous tallies behind the heatmap.
--
-- Deliberately a different table from `sightings`, not a longer retention on
-- it: a mark carries only the Berlin calendar day and a 250 m grid cell, so it
-- has no time of day, no client hash, and nothing that could join it back to
-- the report that produced it. Marks live 28 days; sightings live 90 minutes.
CREATE TABLE IF NOT EXISTS marks (
  id   TEXT PRIMARY KEY,
  day  TEXT NOT NULL,   -- YYYY-MM-DD, Berlin wall time
  cell TEXT NOT NULL,   -- <x>_<y> in the fixed 250 m grid
  hour INTEGER          -- 0-23, Berlin wall time; NULL on rows written before
                        -- the time-of-day report existed
);

-- Existing deployments: the column was added after the first release.
-- ALTER TABLE marks ADD COLUMN hour INTEGER;

-- Reads are always "everything inside the window", which this index carries;
-- so is the nightly delete.
CREATE INDEX IF NOT EXISTS marks_day ON marks (day);


-- Devices that opened the app, for the live figures.
--
-- Exactly one row per device per day: the client sends the same id all day and
-- the write REPLACEs, so the table holds each device's LATEST activity and
-- never a sequence of visits. `seen_at` therefore answers "is this device here
-- now", not "when was it here"; there is no session trace to reconstruct.
--
-- The id is `<day>-<nonce>` with a nonce the client mints fresh every day, so
-- two days of rows cannot be linked to the same device either.
CREATE TABLE IF NOT EXISTS visits (
  id      TEXT PRIMARY KEY,
  day     TEXT NOT NULL,      -- YYYY-MM-DD, Berlin wall time
  seen_at INTEGER NOT NULL    -- epoch ms of the most recent ping
);

CREATE INDEX IF NOT EXISTS visits_day ON visits (day);
CREATE INDEX IF NOT EXISTS visits_seen ON visits (seen_at);


-- Freitext-Rückmeldungen.
--
-- Die einzige Tabelle mit Freitext von Fremden, und deshalb die einzige, für
-- die es **keinen Lese-Endpunkt gibt**. Sichtungen sind für alle sichtbar;
-- eine Rückmeldung ist es ausdrücklich nicht. Gelesen wird sie über
--
--   npx wrangler d1 execute parkingzone --remote \
--     --command "SELECT created_at, kind, text FROM feedback ORDER BY created_at DESC LIMIT 50"
--
-- Kein Kontaktfeld: Wer keine Adresse abfragt, speichert auch keine.
CREATE TABLE IF NOT EXISTS feedback (
  id          TEXT PRIMARY KEY,
  kind        TEXT NOT NULL,     -- idee | fehler | sonstiges
  text        TEXT NOT NULL,     -- serverseitig auf 1000 Zeichen gekürzt
  created_at  INTEGER NOT NULL,  -- auf die Stunde gerundet
  -- Nur fürs Rate-Limit, wird vom stündlichen Job auf NULL gesetzt.
  client_hash TEXT
);

CREATE INDEX IF NOT EXISTS feedback_created ON feedback (created_at);
