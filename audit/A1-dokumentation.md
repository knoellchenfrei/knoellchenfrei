# A1 — Dokumentation

Repository `/home/user/knoellchenfrei`, Branch `main`, Commit `fceadca`. Read-only-Audit am 6./7. September 2026. Grundgesamtheit: `audit/inventory.json` (176 Dateien).

## Zusammenfassung

Die harten Zahlen stimmen: 190 Unit-Tests, Coverage 96,13 / 90,35 / 98,46 %, Typecheck sauber, Web-Build und `pnpm artifact` (2,17 MB) laufen durch, 107 E2E bestanden (1 übersprungen) — alles selbst ausgeführt. Die Datenzahlen in README (103/145 Zonen, 1.499 Orte, 97/104 Ortsteile, 385 Ladepunkte, 108 P+R, 923 Behindertenparkplätze), die Sichtungs-Parameter (90 min, 30 min, 0,62), die Rate-Limits (6/h, 40/h) und der Cron (04:17 UTC) decken sich mit dem Code. `pnpm dev` läuft ohne `fetch-data`, weil die Daten eingecheckt sind.

Das Problem ist die **Aktualität**, nicht die Existenz: Die Sitzung vom 6. September hat in wenigen Stunden Workflow gelöscht, Schema verschoben, Worker mehrstädtig gemacht, Dependabot-PRs gemerged und `?city=` durchgezogen — und die Doku hinkt an rund 30 Stellen hinterher. Am schwersten wiegt das in `docs/todo.md`, das CLAUDE.md zur „verbindlichen Liste" erklärt: Es verweist auf einen gelöschten Workflow, eine nicht existierende Migrationsdatei, ein per Regel verbotenes `d1 execute` und auf drei Dependabot-PRs als „rot", die längst zusammengeführt sind. CONTRIBUTING.md und docs/architecture.md stehen noch auf dem Stand von 62 Unit-Tests, Vite 7, MapLibre 5 und einem `ParkingZone/`-Ordner, den es nicht mehr gibt. Der Hosting-Stand ist in sich widersprüchlich (hosting.md/README/todo: „R2-Eimer fehlt" — sitzungsstatistik.md: „R2 und Kacheln laufen"). Ein CHANGELOG fehlt. README behauptet CI-generierte Badges, die kein Workflow erzeugt.

Findings: 3 high, 11 medium, 16 low, 2 info.

## Findings

### High

```
ID: A1-001
Titel: todo.md verweist auf den gelöschten Workflow „Cloudflare einrichten" als Pflichtschritt
Severity: high
Confidence: confirmed
Evidenz: docs/todo.md:53-59 („Danach macht den Rest ein Workflow … Actions → Cloudflare einrichten → Run workflow"), docs/todo.md:48-49 („der Einrichtungs-Workflow füllt beide neu"), docs/todo.md:48 („wrangler.toml trägt wieder REPLACE_WITH_KV_ID"). Gegenbelege: `ls .github/workflows` → ci.yml, deploy.yml, lint-workflows.yml, pages.yml (kein setup-cloudflare.yml); CLAUDE.md:178-183 („setup-cloudflare.yml ist deshalb gelöscht"); docs/hosting.md:189-193 (Einrichtung = `./scripts/einrichten.sh`); app/apps/api/wrangler.toml:11,16 trägt echte KV-/D1-Kennungen, keine Platzhalter.
Wirkung: Die Datei, die CLAUDE.md:14-15 zur verbindlichen Handover-Liste erklärt, schickt den Betreiber in seiner „halben Stunde" (Schritt 2) zu einem Workflow, den es nicht gibt, und beschreibt für 1a einen Zustand der wrangler.toml, der nicht mehr besteht. Wer nur todo.md liest, sucht in Actions nach etwas Gelöschtem.
Empfehlung: Abschnitt „Deine halbe Stunde" Schritt 2 und Punkt 1a auf `./scripts/einrichten.sh` umschreiben (bzw. 1a als erledigt streichen, da wrangler.toml die neuen Kennungen trägt); den Kasten „Am 6. September waren das noch sechs Schritte" als Historie markieren.
Aufwand: S
```

```
ID: A1-002
Titel: todo.md Punkt 8 führt zwei erledigte Punkte als offen — mit einem verbotenen Befehl auf eine nicht existierende Datei
Severity: high
Confidence: confirmed
Evidenz: docs/todo.md:495-510 (Migration per `wrangler d1 execute knoellchenfrei --file=migrations/001-stadt.sql --remote`); `ls app/apps/api/migrations` → nur `0001_schema.sql`; CLAUDE.md:186-194 („D1-Migrationen laufen über `wrangler d1 migrations apply`, nie über `d1 execute`"); docs/todo.md:511-516 und docs/hosting.md:418-420 („Die Web-App schickt `?city=` noch nicht mit") vs. app/apps/web/src/sighting-backend.ts:237 (`/sightings?city=${encodeURIComponent(CITY.key)}`) und :251 (`/marks?since=…&city=…`).
Wirkung: Ein Betreiber, der Punkt 8 abarbeitet, tippt einen Befehl, der mit „file not found" scheitert, und verstößt dabei gegen die Regel, die aus genau diesem Vorfall entstanden ist. Der zweite Punkt lässt jemanden nach einem Fehler suchen, der behoben ist.
Empfehlung: Beide Punkte in todo.md auf [x] setzen bzw. streichen; Migrationsbefehl durch `pnpm --filter @knoellchenfrei/api exec wrangler d1 migrations apply knoellchenfrei --remote` ersetzen; hosting.md:418-420 entfernen. Verweise auf `schema.sql` (todo.md:460,491,497) als Historie kennzeichnen.
Aufwand: S
```

```
ID: A1-003
Titel: CONTRIBUTING.md ist auf dem Stand vor dem Umzug: falsche Testzahl, falscher Skriptname, falsche Versionen, nicht existierendes Verzeichnis
Severity: high
Confidence: confirmed
Evidenz: CONTRIBUTING.md:6 („62 Unit-Tests") vs. `pnpm --filter @knoellchenfrei/core test` → „Tests 190 passed (190)"; CONTRIBUTING.md:59 (`pnpm --filter @knoellchenfrei/ingest fetch`) vs. app/packages/ingest/package.json:8 (Skript heißt `fetch-data`) und CLAUDE.md:47 (`pnpm fetch` ist ein eingebautes pnpm-Kommando und lief still statt des Projektskripts); CONTRIBUTING.md:38 („Vite 7, MapLibre GL 5") vs. app/apps/web/package.json (`vite ^8.2.1`, `maplibre-gl ^6.4.0`); CONTRIBUTING.md:40-41 (`ParkingZone/ Java-Original von 2012`) vs. `ls` Wurzelverzeichnis (kein solches Verzeichnis; scripts/umzug.sh:56-59 hat es entfernt).
Wirkung: Die erste Datei, die ein Beitragender liest, nennt ein Kommando, das etwas anderes tut als beschrieben (pnpm-Builtin statt Projektskript, ohne Fehlermeldung), und beschreibt eine Struktur, die es nicht gibt.
Empfehlung: Testzahl, Versionen und Struktur-Block gegen README angleichen (oder aus README verlinken statt duplizieren); `fetch` → `fetch-data`; `ParkingZone/`-Zeile streichen.
Aufwand: S
```

### Medium

```
ID: A1-004
Titel: docs/architecture.md beschreibt in vier Punkten den Stand vor Hamburg und vor dem Umzug
Severity: medium
Confidence: confirmed
Evidenz: docs/architecture.md:24 („MapLibre GL 5") vs. maplibre-gl ^6.4.0; :78 („62 Unit-Tests laufen in 1,5 Sekunden") vs. 190 Tests / 2,07 s (unit.log); :239-240 („Die liegt unverändert unter `ParkingZone/` und wird nicht gebaut") vs. Verzeichnis existiert nicht; :144-146 („die feste Liste enthält den 8. März … und nicht Reformationstag") vs. app/packages/core/src/holidays.ts:97 `holidaysFor(land, year)` mit HH-Tabelle inkl. Reformationstag (docs/todo.md:305-306). Das Überblicksdiagramm :5-34 kennt nur Berliner Quellen, keinen Hamburg-Feed, keinen Telegram-Pfad; :180 Sichtungs-Datensatz ohne `city`-Feld (vgl. migrations/0001_schema.sql:42).
Wirkung: Das Pflichtdokument ARCHITECTURE führt in die Irre, sobald jemand den zweiten Parser oder den Feiertagskalender sucht.
Empfehlung: Diagramm um Hamburg-Quellen und `/telegram` ergänzen, Abschnitt Zeitrechnung auf `holidaysFor` umschreiben, Herkunft auf „bleibt in herbeus/parkingzone" ändern, Versionen und Testzahl aktualisieren (oder Testzahl weglassen — sie veraltet mit jedem Commit).
Aufwand: M
```

```
ID: A1-005
Titel: Der Betriebsstand (Worker, R2, Kacheln, Telegram) wird in vier Dokumenten widersprüchlich angegeben
Severity: medium
Confidence: likely
Evidenz: docs/hosting.md:21-25 („Offen sind der erste erfolgreiche Worker-Deploy, VITE_API_BASE und der R2-Eimer"), :439 („Vorbereitet, nicht scharf geschaltet"); README.md:249-252 („Es fehlt nur der R2-Eimer"); docs/todo.md:280 (R2-Eimer unerledigt), :361 (Token/Webhook unerledigt). Dagegen docs/sitzungsstatistik.md:366 („Worker, Pages, D1, KV, R2 und Kacheln laufen; Telegram-Bot samt Webhook") und Commit-Historie `git log`: 3e358c0 „R2-CORS … gegen den echten Eimer geprueft", 561a52b „Das Einrichtungsskript einmal wirklich laufen lassen", app/apps/api/wrangler.toml:11,16 mit echten Kennungen. Produktivsysteme wurden auftragsgemäß nicht abgefragt — deshalb „likely".
Wirkung: Ein Nachfolger weiß nicht, ob der nächste Schritt „R2-Eimer anlegen" oder „VITE_TILES_URL setzen" heißt; die widersprüchlichen Stände lassen sich nur durch Anmelden bei Cloudflare klären.
Empfehlung: Einen einzigen Stands-Abschnitt (z. B. in hosting.md) führen, datiert, und die anderen Stellen darauf verweisen. `./scripts/einrichten.sh --pruefen` liefert den Befund maschinell; sein Output gehört als Datum in die Doku.
Aufwand: S
```

```
ID: A1-006
Titel: docs/oeffentlich-machen.md enthält vier überholte Abschnitte, darunter eine Architekturempfehlung, die der getroffenen Entscheidung widerspricht
Severity: medium
Confidence: confirmed
Evidenz: docs/oeffentlich-machen.md:86-90 („**Ungetestet.** Der Einrichtungs-Workflow ist geschrieben, aber nie … gelaufen") — Workflow gelöscht (CLAUDE.md:182), Skript real gelaufen (sitzungsstatistik.md:374-377); :23-41 (Passwort-Entscheidung, `git filter-repo`, „Solange das Repository privat ist") — neues Repository hat diese Historie nicht (SECURITY.md:135-139, todo.md:245-253), Repository ist öffentlich (hosting.md:21); :43-48 („Repository öffentlich schalten") — erledigt; :165-172 („sobald Meldungen für Hamburg hereinkommen sollen, ist es dieser Weg [Datenbank je Stadt] und nicht eine gemeinsame Tabelle mit einer Stadtspalte") vs. docs/todo.md:464 und docs/hosting.md:394 („Geworden ist es eine Spalte `city`, keine Datenbank je Stadt") und migrations/0001_schema.sql:42.
Wirkung: README verlinkt die Datei als Vorbereitungsliste zur Veröffentlichung; sie fordert Schritte, die erledigt oder gegenstandslos sind, und empfiehlt eine Architektur, die verworfen wurde.
Empfehlung: Abschnitte 1–3 als erledigt zusammenfassen oder streichen; den Absatz „Offen bleibt eine Datenbank je Stadt" durch die Spalten-Entscheidung mit Verweis auf entscheidungen.md ersetzen.
Aufwand: S
```

```
ID: A1-007
Titel: README behauptet CI-generierte Badges; kein Workflow erzeugt sie
Severity: medium
Confidence: confirmed
Evidenz: README.md:221-222 („Die Badges oben werden vom CI aus den echten Messwerten generiert"); `grep -rn "build-badges\|badges" .github/workflows/` → keine Treffer (Exit 1); CLAUDE.md:36 (`TEST_COUNT=190 E2E_COUNT=107 npx tsx src/build-badges.ts` als manueller Befehl); app/packages/ingest/src/build-badges.ts:94-95 liest `TEST_COUNT`/`E2E_COUNT` aus der Umgebung — von Hand.
Wirkung: Die Badges sind eingecheckte SVGs mit handeingetragenen Zahlen. Sie zeigen den Stand des letzten manuellen Laufs, nicht den der CI; die README-Aussage suggeriert eine Prüfung, die nicht existiert.
Empfehlung: Entweder `build-badges` in ci.yml nach Tests/Coverage laufen lassen und committen (oder als Artifact ablegen), oder den Satz in README auf „werden mit `pnpm … build-badges` aus dem letzten lokalen Lauf erzeugt" ändern.
Aufwand: S
```

```
ID: A1-008
Titel: README nennt keine Voraussetzungen (Node, pnpm, corepack, Playwright-Browser)
Severity: medium
Confidence: confirmed
Evidenz: README.md:169-181 („Entwickeln": beginnt mit `cd app && pnpm install`, nennt nur `PLAYWRIGHT_CHROMIUM` für Sonderfälle); app/package.json:5-7 (`packageManager: pnpm@10.33.0`, `engines.node >= 22`); .github/workflows/ci.yml:57 (`playwright install --with-deps chromium` als eigener CI-Schritt, in README nicht erwähnt); scripts/einrichten.sh:93-100 zeigt den corepack-Weg — nur dort. Gegenprobe der Reproduzierbarkeit: `node v22.22.2`, `pnpm 10.33.0`, `pnpm install` → „Already up to date", `pnpm --filter @knoellchenfrei/web dev --port 5199` → HTTP 200 auf `/` und `/data/berlin/meta.json` ohne vorheriges `fetch-data` (Daten sind eingecheckt).
Wirkung: Auf einem frischen Rechner ohne pnpm/corepack scheitert `pnpm install` schon am Aufruf; `npx playwright test` scheitert ohne installierten Browser mit einer Meldung, die in der README nicht vorkommt. Wer Node 20 hat, bekommt Fehler in `tsx`/`vite`, die nicht auf die Node-Version zeigen.
Empfehlung: Vor dem Codeblock zwei Zeilen: „Node ≥ 22, pnpm 10 über `corepack enable pnpm` (Version aus `packageManager`)"; im E2E-Block `pnpm exec playwright install chromium` ergänzen. Erwähnen, dass die Daten eingecheckt sind und `fetch-data` nur zum Aktualisieren nötig ist.
Aufwand: S
```

```
ID: A1-009
Titel: Root-package.json deklariert `pnpm ^12.3.4` — widerspricht `packageManager: pnpm@10.33.0` und der eigenen .gitignore
Severity: medium
Confidence: confirmed
Evidenz: package.json:1-5 (Wurzel: `"dependencies": {"pnpm": "^12.3.4"}`); app/package.json:5 (`packageManager: pnpm@10.33.0`); .gitignore:19-21 („Fällt an, wenn jemand `npm install` im Wurzelverzeichnis ausführt … Das Projekt selbst hat hier keine Abhängigkeiten"); .github/dependabot.yml:47-48 („unterstützt sind pnpm 7 bis 10"); `git log -- package.json` → einziger Commit f3b08a3, dessen Nachricht die Datei nicht erwähnt; `npm view pnpm@12 version` → 12.3.3, 12.3.4 existieren.
Wirkung: `npm install` im Wurzelverzeichnis holt pnpm 12 — eine andere Hauptversion als die, mit der Lockfile, CI (`pnpm/action-setup version: 10`) und Dependabot arbeiten. Die Datei ist offenbar ein Nebenprodukt eines `npm install pnpm` und nirgends dokumentiert; die .gitignore verneint ihre Existenz.
Empfehlung: Datei entfernen (oder, falls gewollt, auf `pnpm@10.33.0` pinnen und in README/CLAUDE.md begründen). In A2/A3 gegenprüfen, ob sie Build-Tools beeinflusst.
Aufwand: S
```

```
ID: A1-010
Titel: hosting.md nennt für VITE_API_BASE den falschen Ort (Cloudflare-Pages-Umgebungsvariablen); der Build läuft in GitHub Actions
Severity: medium
Confidence: confirmed
Evidenz: docs/hosting.md:375-380 („In Cloudflare Pages unter *Settings → Environment variables*: `VITE_API_BASE = …`"); .github/workflows/deploy.yml:66-101 (Adresse aus Secret `VITE_API_BASE` oder `steps.worker.outputs.deployment-url`, Build mit `pnpm --filter @knoellchenfrei/web build` im Actions-Runner), :103-108 (`pages deploy app/apps/web/dist` lädt fertiges Verzeichnis hoch); deploy.yml:89-96 liest `VITE_TILES_URL` aus `vars.VITE_TILES_URL` (Repository-Variable) — docs/hosting.md:472-477 sagt nur „Buildzeit, nicht Laufzeit", nicht wo.
Wirkung: Wer der Anleitung folgt, setzt die Variable in einem Pages-Projekt, das nie baut; die App läuft weiter im lokalen Modus, und nichts meldet den Fehler. Für die Kacheln fehlt die Angabe „Settings → Secrets and variables → Actions → Variables" ganz.
Empfehlung: Abschnitt „Frontend an den Worker hängen" auf den tatsächlichen Mechanismus umschreiben (Secret optional, Adresse aus Deploy-Ausgabe); bei VITE_TILES_URL den Ort als Repository-Variable nennen.
Aufwand: S
```

```
ID: A1-011
Titel: pages.yml erneuert nur Berliner Daten; hosting.md verspricht einen Datenstand „nie älter als 24 Stunden"
Severity: medium
Confidence: confirmed
Evidenz: .github/workflows/pages.yml:44-50 (`fetch-data`, `build-data` ohne `CITY`); app/packages/ingest/src/sources.ts:130 (`CITY_KEY = process.env.CITY ?? 'berlin'`); app/packages/ingest/src/build-data.ts:26-28 (bricht für Hamburg ab: „Dieses Skript baut nur Berlin. Fuer Hamburg: … build-data-hamburg"); docs/hosting.md:132-135 („zieht die Daten vor jedem Deploy frisch … Damit ist der Datenstand nie älter als 24 Stunden"). Weder pages.yml noch deploy.yml rufen `build-data-hamburg`.
Wirkung: Hamburgs 145 Gebiete bleiben auf dem Snapshot vom 6. September eingefroren (staedte.md:196-203 belegt, dass Hamburg Tarife ändert); die Doku behauptet das Gegenteil. Zusätzlich: `continue-on-error: true` (pages.yml:46,50) heißt, auch Berlin wird still alt, wenn der WFS nicht antwortet — hosting.md erwähnt das nicht.
Empfehlung: In pages.yml `CITY=hamburg … fetch-data && build-data-hamburg` ergänzen oder in hosting.md „Berlin täglich, Hamburg beim Commit" schreiben; den `continue-on-error`-Rückfall dokumentieren.
Aufwand: S
```

```
ID: A1-012
Titel: Kein CHANGELOG
Severity: medium
Confidence: confirmed
Evidenz: `ls` Wurzelverzeichnis → CLAUDE.md, CODE_OF_CONDUCT.md, CONTRIBUTING.md, LICENSE, README.md, SECURITY.md; `git log --oneline | wc -l` → 84 Commits; docs/bericht/index.html (Werkbericht, 86 KB Erzählung) und docs/sitzungsstatistik.md ersetzen kein versioniertes Änderungsprotokoll; app/apps/web/package.json:3 `version: 0.1.0` ohne Tag.
Wirkung: Ein Nutzer der PWA (UpdateBar meldet „neue Version") oder ein Beitragender kann nicht nachvollziehen, was sich zwischen zwei Ständen geändert hat, ohne 84 Commit-Nachrichten zu lesen.
Empfehlung: `CHANGELOG.md` nach Keep-a-Changelog mit einem Eintrag „Unreleased" und dem Stand 0.1.0 (6. September) anlegen; oder in README ausdrücklich festhalten, dass die Commit-Historie das Changelog ist.
Aufwand: S
```

```
ID: A1-013
Titel: Drei Stellen empfehlen `npx wrangler` — entgegen der eigenen Regel und dem Einrichtungsskript
Severity: medium
Confidence: confirmed
Evidenz: docs/hosting.md:460 (`npx wrangler r2 bucket create knoellchenfrei-tiles`); app/apps/api/migrations/0001_schema.sql:127-128 (`npx wrangler d1 execute knoellchenfrei --remote --command …`); app/packages/ingest/scripts/build-tiles.sh:18 (`wrangler: npx wrangler --version`). Regel: CLAUDE.md:170-177 („`wrangler` immer über den Workspace, nie als nacktes `npx` … gesehen: 4.97 statt der festgelegten 4.129"), docs/hosting.md:280-286 (dieselbe Regel, 180 Zeilen darüber), scripts/einrichten.sh:172-177.
Wirkung: Genau der dokumentierte Fehler (falsche wrangler-Version, `Could not resolve "@knoellchenfrei/core"`) wird an drei Stellen wieder angeleitet — hosting.md widerspricht sich selbst.
Empfehlung: Auf `pnpm --filter @knoellchenfrei/api exec wrangler …` (aus `app/`) umschreiben.
Aufwand: S
```

```
ID: A1-014
Titel: todo.md Punkt 9 führt drei Dependabot-PRs als „rot und offen", die zusammengeführt sind
Severity: medium
Confidence: confirmed
Evidenz: docs/todo.md:526-543 („Drei Dependabot-PRs, die Code brauchen. Sie sind rot … Vite 8 (PR #6) … plugin-react 6 (PR #10) … MapLibre GL 6 (PR #9)"); app/apps/web/package.json (`vite ^8.2.1`, `@vitejs/plugin-react ^6.0.5`, `maplibre-gl ^6.4.0`); docs/entscheidungen.md:284-316 (alle drei behoben, mit Begründung); docs/sitzungsstatistik.md:363 („11 Dependabot-PRs, alle zusammengeführt; MapLibre 6, Vite 8, TypeScript 7"); Build-Log: „vite v8.2.2 building".
Wirkung: Die verbindliche Liste nennt Arbeit als offen, die erledigt ist; wer sie abarbeitet, sucht nach nicht mehr existierenden PRs.
Empfehlung: Punkt auf [x] setzen mit Verweis auf entscheidungen.md, oder streichen.
Aufwand: S
```

### Low

```
ID: A1-015
Titel: Zahl der Regressionstests widersprüchlich (README 25, CLAUDE.md 24) und nicht nachzählbar
Severity: low
Confidence: confirmed (Widerspruch); unverified (welche Zahl stimmt)
Evidenz: README.md:213 („190, davon 25 Regressionstests"); CLAUDE.md:228 („24 der Unit-Tests sind genau das"); CONTRIBUTING.md:26-27 („Jeder Regressionstest in `hardening.test.ts`"); `grep -cE "^\s*(it|test)\(" app/packages/core/test/hardening.test.ts` → 11; `grep -rli regression app/packages/core/test/*.ts` → 4 Dateien, keine einheitliche Markierung.
Wirkung: Beide Zahlen können nicht stimmen; ohne Markierung (Tag, Dateiname, Kommentar-Präfix) lässt sich keine davon prüfen — es fehlt der Beleg für eine Aussage, die README als Qualitätsmerkmal führt.
Empfehlung: Regressionstests einheitlich kennzeichnen (z. B. `describe('Regression: …')`) und die Zahl per Skript in die Badges/README ziehen — oder die Zahl streichen.
Aufwand: S
```

```
ID: A1-016
Titel: README zählt 84 Carsharing-Plätze, die Daten 83
Severity: low
Confidence: confirmed
Evidenz: README.md:27 („84 Carsharing-Plätze"); Auswertung `apps/web/public/data/berlin/poi.geojson` (python3, Counter über `properties.kind`) → `carsharing: 83`, charging 385, park_and_ride 108, accessible 923; docs/ideen-2012.md:29 („83 Stationen").
Wirkung: Kleine Falschzahl in der Funktionsübersicht; deutet darauf hin, dass die README-Zahlen von Hand gepflegt werden.
Empfehlung: Auf 83 korrigieren oder die Zahlen aus `meta.json` generieren.
Aufwand: S
```

```
ID: A1-017
Titel: README „Aufbau" nennt Vite 7
Severity: low
Confidence: confirmed
Evidenz: README.md:162 („apps/web PWA: React 19, Vite 7, MapLibre GL 6"); app/apps/web/package.json (`vite ^8.2.1`); build.log („vite v8.2.2"); CLAUDE.md:155-160 beschreibt bereits die Vite-8-Eigenheiten.
Wirkung: Inkonsistent mit CLAUDE.md und Code; MapLibre wurde an derselben Zeile aktualisiert, Vite vergessen.
Empfehlung: „Vite 8".
Aufwand: S
```

```
ID: A1-018
Titel: „fünf Workflow-Dateien" — es sind vier
Severity: low
Confidence: confirmed
Evidenz: .github/dependabot.yml:6,89; docs/entscheidungen.md:211,265; `ls .github/workflows | wc -l` → 4 (setup-cloudflare.yml gelöscht, CLAUDE.md:182).
Wirkung: Kosmetisch, aber in der Begründung einer Sicherheitsentscheidung (Actions-Updates).
Empfehlung: Zahl weglassen („die Workflows") oder korrigieren.
Aufwand: S
```

```
ID: A1-019
Titel: data-sources.md: doppelte Überschrift, Berlin-Absolutaussage, `python` statt `python3`
Severity: low
Confidence: confirmed
Evidenz: docs/data-sources.md:87 („## Geprüft und nicht verfügbar## Geprüft und nicht verfügbar"); :9-10 („Sämtliche Geodaten stammen von der Geodateninfrastruktur Berlin") vs. Abschnitt „Verwendet — Hamburg" :45-85; :197 (`python -c 'import certifi…'`) vs. README.md:180 und CLAUDE.md:46 (`python3`).
Wirkung: Die doppelte Überschrift bricht den Anker (`#geprüft-und-nicht-verfügbar` existiert so nicht); `python` fehlt auf vielen Systemen.
Empfehlung: Überschrift reparieren, „Sämtliche" → „Die Berliner", `python3`.
Aufwand: S
```

```
ID: A1-020
Titel: CLAUDE.md: Projektbeschreibung nur Berlin, entfernte `CITY`-Variable, Befehlsblock ohne `cd app`
Severity: low
Confidence: confirmed
Evidenz: CLAUDE.md:8-9 („für Berliner Parkzonen") vs. README:14 („Berlin und Hamburg"); CLAUDE.md:115-116 („Ohne `VITE_CITY` bzw. `CITY` bleibt es Berlin") vs. app/apps/api/src/worker.ts:69-75 („Bis zum 6. September 2026 stand hier `CITY` … Eine Zeile ohne Stadt entsteht nicht mehr") und docs/todo.md:485-486 („`CITY` ist weg"); CLAUDE.md:20-27 Befehlsblock ohne Verzeichnisangabe, .gitignore:23-32 warnt ausdrücklich vor `pnpm` im Wurzelverzeichnis (erzeugt eine zweite `pnpm-workspace.yaml`).
Wirkung: Eine neue Sitzung, die den Befehlsblock aus der Wurzel ausführt, erzeugt genau die Datei, vor der die .gitignore warnt; die `CITY`-Aussage widerspricht der Regel „unbekannte Stadt wirft" (der Worker hat keinen Rückfall mehr, außer beim Lesen per `?city=`).
Empfehlung: `cd app` vor den Block; `CITY` aus der Regel streichen (nur `VITE_CITY` in apps/web/src/city.ts:44 und `CITY` in ingest/sources.ts:130 existieren noch); „Berlin und Hamburg" in die Beschreibung.
Aufwand: S
```

```
ID: A1-021
Titel: SECURITY.md beschreibt die Grenzprüfung noch als „Berliner Bereich"
Severity: low
Confidence: confirmed
Evidenz: SECURITY.md:18 (Tabellenzeile „Berliner Geodaten"), :89-90 („Koordinaten müssen im Berliner Bereich liegen, sonst wird der Datensatz verworfen"); app/apps/api/src/worker.ts:533 (`const city = cityAt(lon, lat)` → Berlin oder Hamburg, sonst 422); docs/todo.md:468-474.
Wirkung: Das Bedrohungsmodell ist für Hamburg-Meldungen unvollständig beschrieben (Lizenzfrage/Impressum: A5/A6; hier nur die technische Aussage).
Empfehlung: „im Bereich einer konfigurierten Stadt (`core/city.ts`)".
Aufwand: S
```

```
ID: A1-022
Titel: index.html-Beschreibung nennt nur Berlin, Manifest beide Städte
Severity: low
Confidence: confirmed
Evidenz: app/apps/web/index.html:7 (`<meta name="description" content="Berliner Parkzonen: …">`); app/apps/web/public/manifest.webmanifest:5 („Parkzonen in Berlin und Hamburg: …"); docs/todo.md:334-337 („Produktname entberlinert … überall").
Wirkung: Suchmaschinen-/Link-Vorschau (sobald `PUBLIC_LAUNCH=1`) zeigt eine Beschreibung, die der App widerspricht.
Empfehlung: Text aus dem Manifest übernehmen.
Aufwand: S
```

```
ID: A1-023
Titel: einrichten.sh braucht python3, prüft es aber nicht und hosting.md nennt es nicht
Severity: low
Confidence: confirmed
Evidenz: `grep -c python3 scripts/einrichten.sh` → 13 (u. a. :571, :608, :665, :895, :920, :1057); scripts/einrichten.sh:259 prüft nur `node curl openssl git`; docs/hosting.md:199 („Werkzeuge: pnpm über corepack, gh, pmtiles"); scripts/einrichten.sh:25-26 zielt ausdrücklich auf macOS-Bash 3.2 — macOS liefert seit 12.3 kein `python3` ohne Xcode-CLT aus. Die Aufrufe enden mit `2>/dev/null` (z. B. :576, :670, :899).
Wirkung: Ohne python3 liefern `cf_geklappt`, `zonen_id`, `json_text` leere Ergebnisse; das Skript meldet „Zone fehlt"/„Token ungültig" — also erfundene Befunde, die das Skript laut eigenem Kopf (:17-18) vermeiden will.
Empfehlung: `python3` in die Pflichtliste :259 aufnehmen und in hosting.md nennen.
Aufwand: S
```

```
ID: A1-024
Titel: Screenshots in README und Installations-Karte ohne Hintergrundkarte, obwohl der Kachelserver wieder erreichbar ist
Severity: low
Confidence: confirmed
Evidenz: `git log -- docs/images app/apps/web/public/screenshots` → nur f733c36 (Stand vor dem Umzug); CLAUDE.md:44 („seit dem 6. September 2026 ist er offen. Was bleibt: Bilder … sind noch ohne Hintergrundkarte"); docs/todo.md:520-524 (offener Punkt); README.md:18,63-67 bindet die Bilder ein; Befehle liegen bereit (app/apps/web/scripts/make-screenshots.mjs:10-12, make-docs-images.mjs).
Wirkung: Das erste Bild der README zeigt Zonen auf schwarzem Grund — für Außenstehende sieht die App kaputt aus.
Empfehlung: `pnpm --filter @knoellchenfrei/web build && node scripts/make-screenshots.mjs && node scripts/make-docs-images.mjs` mit `PLAYWRIGHT_CHROMIUM` laufen lassen und committen.
Aufwand: S
```

```
ID: A1-025
Titel: hosting.md Kachel-Abschnitt: irreführender Kommentar und verfallenes Beispieldatum
Severity: low
Confidence: confirmed
Evidenz: docs/hosting.md:449-450 (Kommentar „# Datum eines Tagesarchivs von https://maps.protomaps.com/builds" über einem Aufruf ohne Datum); :454 und :476 (`/v20260730/berlin.pmtiles`); CLAUDE.md:206-212 („`build-tiles.sh 20260730` lief in `HTTP error: 404` … Aufrufen also **ohne** Datum"); build-tiles.sh:21-27.
Wirkung: Wer das Beispiel abtippt, setzt `VITE_TILES_URL` auf einen Pfad, der nie im Eimer liegt.
Empfehlung: Kommentar streichen, Beispielpfad als `/v<datum>/berlin.pmtiles` schreiben und auf die Ausgabe von build-tiles.sh verweisen.
Aufwand: S
```

```
ID: A1-026
Titel: app/scripts/fetch-parkzonen.sh ist nirgends dokumentiert oder referenziert
Severity: low
Confidence: confirmed
Evidenz: `grep -rn fetch-parkzonen --include=*.md --include=*.json --include=*.yml .` → keine Treffer; app/scripts/fetch-parkzonen.sh:1-15 dupliziert Zweck und TLS-Hinweis von app/packages/ingest/src/fetch.ts; CLAUDE.md „Befehle" und README „Daten neu ziehen" nennen nur `fetch-data`.
Wirkung: Zwei Abrufwege, einer davon unbekannt; welcher gepflegt wird, sagt keine Doku.
Empfehlung: Entweder löschen oder in data-sources.md als curl-Alternative erwähnen.
Aufwand: S
```

```
ID: A1-027
Titel: Code-Kommentare nennen den Skriptnamen `fetch` statt `fetch-data` und eine nicht existierende Migrationsdatei
Severity: low
Confidence: confirmed
Evidenz: app/packages/ingest/src/fetch.ts:9 („`CITY=hamburg pnpm --filter @knoellchenfrei/ingest fetch`"); app/apps/api/migrations/0001_schema.sql:83 („stehen ausführbar in migrations/001-stadt.sql") — `ls app/apps/api/migrations` → nur 0001_schema.sql; CLAUDE.md:47 (`pnpm fetch` = Builtin).
Wirkung: Der Kommentar in fetch.ts leitet genau den stillen Fehlaufruf an, den CLAUDE.md beschreibt.
Empfehlung: `fetch-data`; den Migrationskommentar auf 0001_schema.sql anpassen.
Aufwand: S
```

```
ID: A1-028
Titel: staedte.md widerspricht sich innerhalb eines Abschnitts (Tabelle „ja" direkt vor „Erledigt")
Severity: low
Confidence: confirmed
Evidenz: docs/staedte.md:230-240 (Tabelle: Feiertagskalender **ja**, Datenquelle **ja**, Kartenausschnitt **ja**, „Der Stand heute, aus oeffentlich-machen.md") vs. :242-269 („Drei Aufgaben waren das. Zwei sind erledigt … ~~…~~ Erledigt" ×3) und docs/oeffentlich-machen.md:144-155 (dieselbe Tabelle mit „nein mehr").
Wirkung: Zwei Fassungen derselben Tabelle in zwei Dateien, eine davon veraltet — und „zwei sind erledigt" über drei durchgestrichenen Punkten.
Empfehlung: Tabelle in staedte.md durch Verweis auf oeffentlich-machen.md ersetzen; „Zwei" → „Alle drei".
Aufwand: S
```

```
ID: A1-029
Titel: neue-sitzung.md: Kachelserver-Aussage überholt
Severity: low
Confidence: confirmed
Evidenz: docs/neue-sitzung.md:65-67 („In dieser Umgebung ist `tile.openstreetmap.org` gesperrt"); CLAUDE.md:44 („seit dem 6. September 2026 ist er offen"). Das Dokument ist :3-13 als abgeschlossen markiert.
Wirkung: Gering — Historie; aber der Abschnitt „Was die neue Sitzung nicht wissen kann" gibt sich als aktuell.
Empfehlung: Abschnitt streichen oder auf CLAUDE.md verweisen.
Aufwand: S
```

```
ID: A1-030
Titel: hosting.md beschreibt den Inhalt der wrangler.toml unvollständig
Severity: low
Confidence: confirmed
Evidenz: docs/hosting.md:246-248 („Dort stehen nur `name`, `main`, Bindings, Cron-Trigger und Vars"); app/apps/api/wrangler.toml:3 (`compatibility_date`), :21 (`migrations_dir`), :27-28 (`[observability]`).
Wirkung: Kosmetisch; die Kernaussage (keine `routes`) stimmt.
Empfehlung: „u. a." einfügen.
Aufwand: S
```

### Info

```
ID: A1-031
Titel: Externe Links — Stichprobe
Severity: info
Confidence: confirmed
Evidenz: `curl -I -L` (über Proxy): 200 für govdata dl-de/zero-2-0 und by-2-0, operations.osmfoundation.org/policies/tiles, developers.cloudflare.com D1-Changelog, freifahren.org/impressum, maps.protomaps.com/builds, blitzer.de-Artikel, data.fid-move.de, parkraum.osm-verkehrswende.org, gesetze-im-internet § 23 StVO, geodienste.hamburg.de. 403 für alle `github.com/…`-Links und community.cloudflare.com (Egress-Proxy, nicht bewertbar). `gdi.berlin.de` ohne `--cacert` → Verbindungsfehler, mit certifi-Bundle → 200 und `numberMatched="103"` — bestätigt die TLS-Aussage in README:176-181 und die Zonenzahl.
Wirkung: Keine toten externen Links in der Stichprobe gefunden.
Empfehlung: —
Aufwand: —
```

```
ID: A1-032
Titel: End-to-End-Lauf
Severity: info
Confidence: confirmed
Evidenz: `cd app/apps/web && PLAYWRIGHT_CHROMIUM=/opt/pw-browsers/chromium-1194/chrome-linux/chrome npx playwright test` → „107 passed, 1 skipped (8.5m)", E2E_EXIT=0 (e2e.log). Badge `e2e.svg` = „107 passing" ✓. Erwartung laut README.md:214 „107 bestanden … (ein 108. läuft nur in der Handy-Variante)", e2e/app.spec.ts:219 (`test.skip(... !== 'phone')`); zwei weitere bedingte Skips (app.spec.ts:278,291 bei fehlendem Ruhetags-Hinweis).
Wirkung: README:214, CLAUDE.md:25 und Badge stimmen mit dem Lauf überein. Die 107 hängen aber an Uhrzeit und Wochentag (bedingte Skips bei fehlendem Ruhetags-Hinweis), was die Doku nicht sagt.
Empfehlung: In README erwähnen, dass zwei Tests vom Wochentag/der Uhrzeit abhängen (Ruhetags-Hinweis) und die Zahl 107 deshalb schwanken kann.
Aufwand: S
```

## Was geprüft wurde und stimmt

- `pnpm -r typecheck` → alle vier Pakete „Done" (typecheck.log).
- `pnpm --filter @knoellchenfrei/core test` → 13 Dateien, 190 Tests bestanden, 2,07 s. README:171, CLAUDE.md:22, Badge `tests.svg` = 190 ✓.
- `test:coverage` → Statements 96,13 %, Branches 90,35 %, Functions 98,46 %, Lines 96,13 %; README:215 (96,1 / 90,3 / 98,4) ✓; Schwellen 85/85/80/85 in vitest.config.ts, README:172 und CONTRIBUTING:51 ✓.
- `pnpm --filter @knoellchenfrei/web build` ✓; `pnpm artifact` → „artifact.html: 2.17 MB, Berlin 103/1499/97, Hamburg 145/0/104" = hosting.md:96-97 ✓.
- `pnpm audit --audit-level moderate` → „No known vulnerabilities found" (README:217, SECURITY.md:126) ✓.
- `meta.json` Berlin: zones 103, segments 45.917, managedSpaces 210.527, poi 1.499, districts 97; Hamburg: zones 145, districts 104, `absent: [poi, umweltzone, segments]` — README:27,80-81 ✓ (bis auf Carsharing, A1-016).
- Sichtungen: `DEFAULT_HALF_LIFE_MS = 30 min`, `DEFAULT_MAX_AGE_MS = 90 min`, `CONFIRMED_THRESHOLD = 0.62` (core/sighting.ts:43-54) = README:125-127, architecture.md:159-171 ✓. Rate-Limits 6/h, 40/h (worker.ts:142,144) = SECURITY.md:117 ✓. Feedback 90 Tage (worker.ts:450) = SECURITY.md:21 ✓. Ping alle 2 min (presence.ts:112) = hosting.md:169, SECURITY.md:69 ✓.
- FAQ: 7 Einträge (SettingsSheet.tsx:44-106) = README:31 ✓. `ready()` wartet auf `.loading` (app.spec.ts:23) = CLAUDE.md:48 ✓.
- Cron `17 4 * * *` (pages.yml:15) = hosting.md:133 ✓. Migrationen `migrations_dir` und `d1 migrations apply` in einrichten.sh:369 ✓. `einrichten.sh --pruefen/--liste/<schritt>` (:1341-1350) = hosting.md:215-216 ✓; Schrittliste (:1329) deckt die Tabelle hosting.md:197-206.
- Interne Links und Anker: 20 Markdown-Dateien geprüft (Skript), alle Dateipfade und Anker vorhanden; alle Bilder in README/docs vorhanden.
- Pflicht-Set: README ✓, ARCHITECTURE (docs/architecture.md, veraltet: A1-004) ✓, CONTRIBUTING (veraltet: A1-003) ✓, ADRs (docs/entscheidungen.md, aktuell) ✓, Runbook (docs/hosting.md + scripts/einrichten.sh) ✓, CHANGELOG ✗ (A1-012).
- Verwaiste Bezeichner: `@knoellchenfrei_BE` kommt nirgends mehr vor (nur `@FreiFahren_BE`/`freifahren_BE` als Fremdbeispiel); `parkingzone` nur noch als historische Adresse `herbeus/parkingzone`, in todo.md 1a (Aufräum-Anleitung) und als `__PARKINGZONE_DATA__` in build-artifact.ts:93 (Code, kein Doku-Bezug — an A2 weitergereicht).

## Coverage

Relevante Klassen: `doc` (16), `config` (20), `ci` (9), `code` soweit Doku-Bezug (82). Geprüft heißt: vollständig gelesen oder gezielt gegen Doku-Aussagen abgefragt (grep/Ausführung).

| Klasse | gesamt | geprüft | übersprungen (Grund) | nicht erreicht |
| --- | ---: | ---: | --- | ---: |
| doc | 16 | 16 | — (docs/bericht/index.html nur per grep auf Zahlen/Bezeichner, nicht als Fließtext) | 0 |
| ci | 9 | 9 | — | 0 |
| config | 20 | 16 | app/pnpm-lock.yaml (Lockfile, kein Doku-Bezug); 3 Test-Fixtures unter packages/core/test/fixtures (Rohdaten) | 0 |
| code (Doku-Bezug) | 82 | 31 | 51 ohne Doku-Bezug: React-Komponenten (außer SettingsSheet), styles.css, types.ts, format.ts, storage.ts, seed.ts, pwa.ts, useZoneStatus.ts, zones.ts, data-source.ts, globals.d.ts, main.tsx, ErrorBoundary u. a.; core: berlin-time, geo, heatmap, parse-fee, parse-schedule, quiet-day, tariff, hamburg, index, telegram (nur Testzahlen gezählt); ingest: simplify, build-data-hamburg; Tests außer hardening/telegram/city (nur gezählt); make-brand/make-icons/make-docs-images (Existenz geprüft) | 0 |
| **Summe relevant** | **127** | **72** | 55 | 0 |

Geprüfte Code-Dateien (31): apps/web/vite.config.ts, playwright.config.ts, index.html, public/manifest.webmanifest, src/sighting-backend.ts, src/city.ts, src/presence.ts, src/feedback.ts, src/map-style.ts, src/App.tsx (Env-Grep), src/sw-template.js, src/components/SettingsSheet.tsx, e2e/app.spec.ts, e2e/pwa.spec.ts, scripts/make-screenshots.mjs; apps/api/src/worker.ts, migrations/0001_schema.sql, wrangler.toml, r2-cors.json; packages/core/src/city.ts, holidays.ts, sighting.ts, vitest.config.ts, test/hardening.test.ts, test/telegram.test.ts, test/city.test.ts; packages/ingest/src/sources.ts, fetch.ts, build-data.ts, build-artifact.ts, build-badges.ts, scripts/build-tiles.sh; app/scripts/fetch-parkzonen.sh; scripts/einrichten.sh, scripts/umzug.sh.

Nicht zuständig, nur auf Existenz/Verlinkung geprüft: LICENSE, CODE_OF_CONDUCT.md, docs/impressum.md, docs/datenschutz.md (A5/A6); SECURITY.md gelesen, weil sie Befehle und Zahlen enthält (A1-021). Assets (39): Existenz aller in Doku referenzierten Bilder geprüft, Badge-Texte gelesen; docs/brand/* nur Existenz.

**Coverage: 72 / 127 = 57 % der relevanten Dateien geprüft; 100 % der Klassen doc und ci; nichts unerreicht.** Übersprungen wurde ausschließlich, was keine Doku-Aussage berührt.

## Ausgeführte Befehle (Belege)

```
cd app && pnpm install                                   # Already up to date, pnpm 10.33.0, node v22.22.2
pnpm -r typecheck                                        # TYPECHECK_EXIT=0
pnpm --filter @knoellchenfrei/core test                  # 190 passed
pnpm --filter @knoellchenfrei/core test:coverage         # 96.13 / 90.35 / 98.46 / 96.13
pnpm --filter @knoellchenfrei/web build                  # BUILD_EXIT=0, vite 8.2.2
pnpm artifact                                            # artifact.html: 2.17 MB
pnpm --filter @knoellchenfrei/web dev --port 5199        # HTTP 200 auf / und /data/berlin/meta.json
pnpm audit --audit-level moderate                        # No known vulnerabilities found
cd apps/web && PLAYWRIGHT_CHROMIUM=… npx playwright test # siehe A1-032
git status --short                                       # nur ?? audit/
```

Logs im Scratchpad: typecheck.log, unit.log, coverage.log, build.log, artifact.log, e2e.log, dev.log.
