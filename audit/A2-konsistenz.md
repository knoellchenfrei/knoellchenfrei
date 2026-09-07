# A2 — Konsistenz

Repository `knoellchenfrei/knoellchenfrei`, Commit `fceadca` (identisch mit
`origin/main`; die Arbeitskopie steht auf `claude/parkingzone-migration-18g8fo`).
Grundgesamtheit: `audit/inventory.json`, 176 Dateien. Read-only; einzige
Schreibung ist diese Datei. Keine Anfragen an Produktivsysteme.

## Zusammenfassung

Der Code hält seinen Stil de facto ein (keine Tabs, keine Semikolons, einfache
Anführungszeichen, `strict` überall per `tsconfig.base.json`) — aber nichts
erzwingt das: kein Prettier, kein ESLint, keine `.editorconfig`, kein shellcheck,
nichts davon im CI. Die Regel „Stadtgrenzen genau einmal" ist an zwei Stellen
verletzt (`heatmap.ts`, `build-tiles.sh`), Letztere warnt im eigenen Kommentar
genau davor. Zwei Doku-Widersprüche sind betriebsrelevant: der Telegram-Bot heißt
laut Skript `@knoellchen_bot`, laut vier Doku-Stellen und demselben Skript
`@knoellchenfrei_bot`; und `CONTRIBUTING.md` nennt `pnpm … fetch`, das laut
CLAUDE.md still das Falsche tut. Token-Rechte und Ressourcennamen stehen drei-
bzw. zweifach. Sprache: Commits sauber ASCII-deutsch; Umlaut-Schreibweise,
Testtitel und Bezeichner sind innerhalb einzelner Dateien gemischt.

Findings: 0 critical, 2 high, 7 medium, 9 low, 5 info. Coverage 79 % (139/176
inhaltlich; alle 176 nach Dateiname).

## Findings

### High

```
ID: A2-001
Titel: Telegram-Bot-Name widerspricht sich zwischen Skript und Doku
Severity: high
Confidence: confirmed (Widerspruch); unverified (welcher Name stimmt — kein Zugriff auf api.telegram.org)
Evidenz:
  scripts/einrichten.sh:662-663  "dass der Bot @knoellchen_bot heisst und nicht @knoellchenfrei_bot, wie ueberall in der Doku stand"
  scripts/einrichten.sh:729      hinweis "  @knoellchenfrei_bot  docs/brand/telegram-bot-512.png"
  docs/marke.md:17, :35, :194    `@knoellchenfrei_bot`
  docs/todo.md:355               `@knoellchenfrei_bot`. Am 6. September 2026 waren alle vier frei.
  docs/entscheidungen.md:200     `@knoellchenfrei_bot` für den Meldeweg
Wirkung: Wer der Doku folgt (Bild setzen, Gruppe verlinken, Nutzern den Bot nennen), trifft einen anderen oder nicht existierenden Bot. Das Skript hat den Fehler erkannt und die Erkenntnis nur in einen Kommentar geschrieben — 66 Zeilen später gibt es selbst den alten Namen aus.
Empfehlung: Eine Stelle als Wahrheit festlegen (z. B. `docs/marke.md`, Abschnitt Namensschema) und dort ausdrücklich unterscheiden: „geplantes Schema" vs. „tatsächlich registriert". Alle anderen Stellen verlinken statt wiederholen. Das Skript soll den Namen aus `getMe` ausgeben, den es ohnehin abfragt (Z. 665-670), statt ihn hart zu codieren.
Aufwand: S
```

```
ID: A2-002
Titel: CONTRIBUTING.md nennt `pnpm … fetch` (eingebautes pnpm-Kommando) und 62 Unit-Tests
Severity: high
Confidence: confirmed
Evidenz:
  CONTRIBUTING.md:62   pnpm --filter @knoellchenfrei/ingest fetch
  CONTRIBUTING.md:8    pnpm test          # 62 Unit-Tests
  app/packages/ingest/package.json  scripts: "fetch-data": "NODE_USE_ENV_PROXY=1 tsx src/fetch.ts"  (kein Skript "fetch")
  CLAUDE.md, Tabelle „Eigenheiten": „`pnpm fetch` ist ein eingebautes pnpm-Kommando und lief still statt des Projektskripts. Das Skript heißt deshalb `fetch-data`."
  README.md:195  pnpm --filter @knoellchenfrei/ingest fetch-data   (richtig)
  Lauf: pnpm --filter @knoellchenfrei/core test → "Tests 190 passed (190)"
Wirkung: Genau der dokumentierte Vorfall wiederholt sich für jeden, der der Mitmach-Anleitung folgt: der Befehl läuft ohne Fehler durch und holt keine Daten. Die Testzahl 62 ist drei Generationen alt (62 → 129 → 190) und untergräbt das Vertrauen in die übrige Anleitung.
Empfehlung: `fetch` → `fetch-data`; Testzahl entweder nachziehen oder — besser — in CONTRIBUTING gar keine Zahl nennen und auf README verweisen (siehe A2-007).
Aufwand: S
```

### Medium

```
ID: A2-003
Titel: Berliner Stadtgrenzen stehen dreimal, nicht „genau einmal"
Severity: medium
Confidence: confirmed
Evidenz:
  app/packages/core/src/city.ts:89        reportBounds: { minLon: 13.0, minLat: 52.3, maxLon: 13.8, maxLat: 52.7 }
  app/packages/core/src/heatmap.ts:108-109  const ORIGIN_LON = 13.0 / const ORIGIN_LAT = 52.3
  app/packages/core/src/heatmap.ts:100     LON_DEG_PER_M = 1 / (111_320 * Math.cos((52.52 * Math.PI) / 180))   (Berliner Breite fest)
  app/packages/ingest/scripts/build-tiles.sh:36  BBOX="13.0,52.3,13.8,52.7"
  app/packages/ingest/scripts/build-tiles.sh:33-35  Kommentar: „Dieselben Grenzen, die der Worker für Meldungen durchsetzt — eine zweite Zahlenreihe, die auseinanderläuft, wäre eine Fehlerquelle ohne Nutzen."
  CLAUDE.md, Regel „Stadtgrenzen stehen genau einmal, in core/city.ts"
  Befehl: grep -rnE '\b(13\.0|52\.3|13\.8|52\.7|9\.7|53\.35)\b' app/apps app/packages/core app/packages/ingest scripts docs .github (ohne public/data) → genau diese vier Code-Treffer
Wirkung: `heatmap.ts` nimmt Berlins Südwestecke als Rasterursprung und Berlins Breite für die Meter-Umrechnung; Hamburger Zellen sind damit ~1,5 % verzerrt und der Ursprung liegt 130 km entfernt (funktioniert, ist aber Berlin-Verdrahtung, die CLAUDE.md verbietet). `build-tiles.sh` trägt die Zahlenreihe, vor der sein eigener Kommentar warnt — die Hamburg-Kacheln müssten dort von Hand ein zweites Mal eingetragen werden.
Empfehlung: `heatmap.ts`: Ursprung und Kosinus aus `City` beziehen (Parameter oder `cityByKey`), Hamburg-Fall testen. `build-tiles.sh`: BBOX aus `core/city.ts` erzeugen (`node -e` / `tsx -e` mit `reportBounds`) oder als Argument `--city` mit Nachschlag in `core`. Ein Unit-Test, der die Konstanten in `heatmap.ts` gegen `BERLIN.reportBounds` prüft, wäre der billigste Riegel.
Aufwand: M
```

```
ID: A2-004
Titel: Token-Rechtelisten dreifach gepflegt, DNS-Rechte mit zwei Benennungen
Severity: medium
Confidence: confirmed
Evidenz:
  Setup-Token (5 Rechte), drei Stellen:
    scripts/einrichten.sh:325-326
    docs/hosting.md:225-226
    docs/todo.md:18-20
  DNS-Rechte, zwei Stellen, unterschiedlich benannt:
    scripts/einrichten.sh:972-973  "Zone:Read, DNS:Edit — … Zone:Dynamic Redirect:Edit sowie Account:Account Rulesets:Edit"
    docs/hosting.md:227-230        "Zone:Read, DNS:Edit, Single Redirect:Edit sowie Account Rulesets:Edit" (mit Erklärung, dass die API die Sache anders nennt)
  CI-Token (2 Rechte), zwei Stellen, konsistent:
    .github/workflows/deploy.yml:145
    docs/hosting.md:233-238
Wirkung: Beim nächsten Recht (z. B. *Workers Routes:Edit*, das hosting.md:251-253 schon ankündigt) muss jemand drei Stellen finden. Die DNS-Liste im Skript nennt die API-Namen, die Doku die Oberflächennamen — wer das Token in der Oberfläche anlegt, findet „Dynamic Redirect" dort nicht.
Empfehlung: Eine Quelle (hosting.md, Abschnitt „Zwei Token"), das Skript und todo.md verlinken sie per Anker. Im Skript beide Benennungen nennen (Oberfläche + API), wie hosting.md es tut.
Aufwand: S
```

```
ID: A2-005
Titel: Worker-, D1- und Pages-Name je zweimal: wrangler.toml/deploy.yml und einrichten.sh
Severity: medium
Confidence: confirmed
Evidenz:
  app/apps/api/wrangler.toml:1     name = "knoellchenfrei-api"
  scripts/einrichten.sh:154        WORKER_NAME="knoellchenfrei-api"      (benutzt Z. 743)
  app/apps/api/wrangler.toml:15    database_name = "knoellchenfrei"
  scripts/einrichten.sh:155        D1_NAME="knoellchenfrei"              (benutzt Z. 352, 357, 369)
  .github/workflows/deploy.yml:128 --project-name=knoellchenfrei
  scripts/einrichten.sh:156        PAGES_PROJEKT="knoellchenfrei"        (benutzt Z. 417-422)
  docs/hosting.md:379              VITE_API_BASE = https://knoellchenfrei-api.<konto>.workers.dev
Wirkung: Eine Umbenennung (der letzte Vorfall: parkingzone → knoellchenfrei, CLAUDE.md-Regel) muss an fünf Stellen greifen; ein vergessener Eintrag legt eine zweite Datenbank oder ein zweites Pages-Projekt an und meldet Erfolg.
Empfehlung: `einrichten.sh` liest `name` und `database_name` aus `wrangler.toml` (ein `grep -E '^name ='` reicht bei dieser Datei) und der Pages-Name steht einmal als Variable in `deploy.yml` (`env:`) — oder, umgekehrt, `einrichten.sh` ist die Quelle und schreibt sie. Wichtig ist nur: eine Stelle.
Aufwand: S
```

```
ID: A2-006
Titel: Kein Formatter, kein Linter, kein shellcheck — nichts erzwungen
Severity: medium
Confidence: confirmed
Evidenz:
  Befehl: find . -name '.prettierrc*' -o -name 'prettier.config.*' -o -name 'eslint.config.*' -o -name '.eslintrc*' -o -name '.editorconfig' -o -name 'biome.json*' -o -name '.shellcheckrc' (ohne node_modules) → keine Treffer
  Befehl: grep -rnE 'prettier|eslint|biome|shellcheck|editorconfig' package.json app/**/package.json .github/workflows/*.yml CONTRIBUTING.md → keine Treffer
  .github/workflows/ci.yml: Jobs check/e2e/security — typecheck, test, coverage, build, audit, Secret-Grep; kein Lint-Schritt
  .github/workflows/lint-workflows.yml:32-35: prüft nur, ob YAML parst
  shellcheck (nachinstalliert): einrichten.sh 14 Hinweise (13× SC2015 „A && B || C is not if-then-else", z. B. Z. 395, 397, 423, 451; 1× SC2086 Z. 1345); umzug.sh, fetch-parkzonen.sh, build-tiles.sh: 0. `bash -n` für alle vier: sauber.
  De-facto-Stil (gemessen über apps/web/src, apps/api/src, packages/*/src, scripts, e2e): 0 Dateien mit Tab-Einrückung; 1 Zeile mit Semikolon-Ende (city.ts:105, in einem Kommentar); 0 Imports mit doppelten Anführungszeichen; 19 Zeilen > 120 Zeichen (überwiegend Strings/SQL, z. B. App.tsx:794, worker.ts:318); kein CRLF; kein Trailing Whitespace
Wirkung: Der Stil ist heute konsistent, weil ein Autor ihn hält. Dependabot-PRs, Fremdbeiträge (CONTRIBUTING lädt dazu ein) oder eine neue Sitzung haben keinen Riegel. SC2015 ist in einem 1.373-Zeilen-Skript mit `set -e` ein echtes Fehlerbild: der `||`-Zweig läuft auch, wenn `B` scheitert.
Empfehlung: Minimalvariante ohne neue Werkzeugkette: `.editorconfig` (2 Spaces, LF, trim) + `shellcheck` als Schritt in `lint-workflows.yml` (Ubuntu-Runner hat es). Wenn ein Formatter, dann Prettier mit `semi: false, singleQuote: true, printWidth: 100` — das entspricht dem Bestand und erzeugt keinen Diff-Berg. `pnpm lint` in `ci.yml` vor `typecheck`.
Aufwand: M
```

```
ID: A2-007
Titel: Testzahlen an sieben Stellen gepflegt, drei davon veraltet; Regressionszahl 24 vs. 25
Severity: medium
Confidence: confirmed
Evidenz:
  Aktuell (Lauf): 190 Unit, 108 E2E gelistet (`playwright test --list`: "Total: 108 tests in 2 files"; 54 × 2 Projekte desktop/phone), 96,13 % Zeilen / 90,35 % Zweige / 98,46 % Funktionen (`test:coverage`)
  Stimmig:  README.md:182,186,213-215 · CLAUDE.md:22,26,41 · docs/badges/tests.svg (190), e2e.svg (107), coverage.svg (96.1%) · docs/sitzungsstatistik.md:368-369 · docs/bericht/index.html:1257
  Veraltet: CONTRIBUTING.md:8 (62) · docs/neue-sitzung.md:32-33 (129 Unit, 93 E2E, 96,3 %) · docs/bericht/index.html:226 (129 / 92 — Kopfkachel des Berichts)
  Widerspruch: README.md:213 „davon 25 Regressionstests" vs. CLAUDE.md:228 „24 der Unit-Tests sind genau das" — keine Markierung im Testcode, aus der sich die Zahl ableiten ließe (grep -i regression: 5 Treffer, 1 in einem Testtitel)
Wirkung: Die Zahl ist ein Qualitätsversprechen im README; drei Stellen widersprechen ihm. 24/25 ist nicht prüfbar — die Zahl ist Behauptung, nicht Messung.
Empfehlung: Zahlen nur dort, wo sie erzeugt werden (Badges via `build-badges.ts`); README/CLAUDE.md verweisen auf die Badges statt Zahlen zu wiederholen. `build-badges.ts` soll `TEST_COUNT`/`E2E_COUNT` selbst aus dem Vitest-JSON-Reporter bzw. `playwright test --list` lesen statt aus Env-Variablen (Z. 94-95). Regressionstests im Code markieren (z. B. `describe('regression: …')`), damit die Zahl zählbar wird — oder die Zahl streichen. `neue-sitzung.md` als historisches Zitat kennzeichnen oder aktualisieren.
Aufwand: S (Doku) / M (Badges automatisieren)
```

```
ID: A2-008
Titel: todo.md verweist auf `migrations/001-stadt.sql`, die seit 736897e nicht mehr existiert
Severity: medium
Confidence: confirmed
Evidenz:
  docs/todo.md:503-504   pnpm --filter @knoellchenfrei/api exec wrangler d1 execute knoellchenfrei --file=migrations/001-stadt.sql --remote
  git log --follow --name-status -- app/apps/api/migrations: 736897e  A 0001_schema.sql / D 001-stadt.sql
  ls app/apps/api/migrations → 0001_schema.sql (einzige Datei; Schema NNNN_name.sql eingehalten)
  CLAUDE.md, Regel „D1-Migrationen laufen über `wrangler d1 migrations apply`, nie über `d1 execute`"
Wirkung: Der Befehl in todo.md verstößt gegen zwei Regeln zugleich (falscher Dateiname, falsches Werkzeug). Wer ihn aus dem Verlauf kopiert, bekommt „file not found" — oder, nach Anpassung des Namens, ein `d1 execute`, das `d1_migrations` nicht fortschreibt.
Empfehlung: Den Block in todo.md als erledigt/historisch markieren und durch `wrangler d1 migrations apply knoellchenfrei --remote` ersetzen — oder streichen, weil `einrichten.sh:363-385` das tut.
Aufwand: S
```

```
ID: A2-009
Titel: pnpm-Versionsangaben laufen auseinander: Wurzel ^12, Workspace 10.33, CI 10
Severity: medium
Confidence: likely
Evidenz:
  package.json (Wurzel):        {"dependencies": {"pnpm": "^12.3.4"}}
  app/package.json:5            "packageManager": "pnpm@10.33.0"
  .github/workflows/ci.yml:24,55,82 / deploy.yml:28 / pages.yml:36   pnpm/action-setup version: 10
  scripts/einrichten.sh:95      Kommentar: „`packageManager: pnpm@10.33.0` … corepack haelt"
  .gitignore:16-19              „Fällt an, wenn jemand `npm install` im Wurzelverzeichnis ausführt (etwa um pnpm zu installieren)"
  app/pnpm-workspace.yaml:39-41 Wiedervorlage bei pnpm 11 (minimumReleaseAgeStrict)
Wirkung: Wer der Wurzel-`package.json` folgt, bekommt pnpm 12 und arbeitet dann in einem Workspace, der 10.33 festschreibt; Lockfile-Format und das in `pnpm-workspace.yaml` beschriebene Verhalten (`minimumReleaseAge`) sind versionsabhängig. Die Datei widerspricht außerdem ihrem eigenen Zweck laut `.gitignore` (das Projekt „hat hier keine Abhängigkeiten").
Empfehlung: Wurzel-`package.json` auf `pnpm@10.33.0` festnageln oder entfernen und stattdessen `corepack enable` in README/CONTRIBUTING nennen (das `packageManager`-Feld reicht). Bei Sprung auf 11/12 alle vier Stellen zusammen ändern — Dependabot-Gruppe für `pnpm/action-setup` deckt das nicht ab.
Aufwand: S
```

### Low

```
ID: A2-010
Titel: Umlaut-Schreibweise innerhalb einzelner Dateien gemischt (ä/ö/ü neben ae/oe/ue)
Severity: low
Confidence: confirmed
Evidenz (Auswahl, je Datei ein Paar):
  .github/workflows/deploy.yml:35 "Abhängigkeiten" · :66 "traegt noch Platzhalter … laeuft nicht hier"
  .github/workflows/ci.yml:5-6 "laeuft … fuer" · :90 "Abhängigkeiten" · :97 "Mögliches"
  scripts/einrichten.sh:25 "Geschrieben für die Bash" · :211 "Ausfuehren … ueberall"  (116 Umlaut-Zeilen, 34 ASCII-Zeilen)
  app/apps/web/e2e/pwa.spec.ts:8 "führt" · :69 "haelt kein ./index.html" · :80 "traegt"
  app/packages/ingest/scripts/build-tiles.sh:33 "großzügig … für" · :47 "laeuft irgendwann auseinander"
  app/packages/core/src/telegram.ts:61 "waere" (sonst 16 Zeilen mit Umlauten)
  ebenso: sw-template.js, build-artifact.ts, build-data.ts, build-data-hamburg.ts, umzug.sh
  Konvention: CLAUDE.md verlangt ASCII nur für Commit-Nachrichten; für Kommentare/Doku gibt es keine Regel.
Wirkung: Kosmetisch, aber sichtbar; `grep` nach „läuft" findet „laeuft" nicht — bei 1.373 Zeilen einrichten.sh ist das ein echter Suchverlust.
Empfehlung: Regel in CLAUDE.md ergänzen („Kommentare und Ausgaben mit Umlauten; ASCII nur in Commit-Betreffen") und die genannten Dateien einmal durchziehen. Kein Werkzeug nötig.
Aufwand: S
```

```
ID: A2-011
Titel: Testtitel gemischt deutsch/englisch — innerhalb derselben Datei und derselben describe-Gruppe
Severity: low
Confidence: confirmed
Evidenz:
  app/apps/web/e2e/pwa.spec.ts:36  test.describe('der Service Worker') · :43 'jede Datei, die er vorab holt, gibt es auch' · :69 'haelt kein ./index.html vor …' · :80 'traegt eine ersetzte Build-Kennung …'
  app/apps/web/e2e/pwa.spec.ts:88  test.describe('the manifest') · :151 'shortcuts from the app icon' · :200 'putting it on the home screen' · :256 'the closed beta'
  app/apps/web/e2e/app.spec.ts:537 test.describe('die zweite Stadt') mit englischen Tests :546 'offers both cities…', :555 'switches to Hamburg…', :573, :588
  app/apps/web/e2e/app.spec.ts:51-521  alle übrigen 22 describe-Gruppen englisch
  Unit-Tests: alle it()-Titel englisch, auch in den nach dem Umzug neu geschriebenen city.test.ts:14-34 und hamburg.test.ts:31-64 — bei durchgehend deutschen Kommentaren in denselben Dateien
Wirkung: Der Playwright-Report liest sich zweisprachig; wer nach einem Test sucht, muss beide Sprachen probieren. Die Konvention (Bezeichner englisch, Prosa deutsch) gibt für Testtitel keine Antwort.
Empfehlung: Entscheiden und in CLAUDE.md festhalten. Vorschlag: Titel folgen den Kommentaren (deutsch bei neuem Code), Bestand bleibt. Die vier deutschen Titel in pwa.spec.ts und die Gruppe 'die zweite Stadt' zeigen, dass das schon die Praxis ist — nur nicht durchgehend.
Aufwand: S
```

```
ID: A2-012
Titel: Bezeichner in neu geschriebenen Dateien gemischt deutsch/englisch
Severity: low
Confidence: confirmed
Evidenz:
  app/apps/web/scripts/make-brand.mjs (neu, e08f34f): GLYPH:38, BLUE:40, BOX:44, CENTER:45, round:47, glyph:50 (englisch) neben DUNKEL:43, KREIS_SICHER:114, marke:128, tgFlaeche:141, glyphFarbe:148, Parameter `farbe`, `inhalt`, `hintergrund`, `groesse` (deutsch)
  .github/workflows/deploy.yml:46-95: Step-IDs gate/worker/api, Env TOKEN/ACCOUNT (englisch) neben AUS_SECRET/AUS_DEPLOY:88-89 und Shell-Variablen basis/quelle:91-95 (deutsch)
  app/packages/ingest/src/build-data-hamburg.ts:163 `bezirk` (spiegelt das Feed-Feld `bezirk_name` — vertretbar)
  Gegenbeispiel, konsistent: scripts/einrichten.sh — alle 50 Funktionen und Variablen deutsch (ok/fehlt/schlimm/hinweis/frage/…); app/packages/core/src/city.ts und hamburg.ts — alle Bezeichner englisch
Wirkung: Gering; `glyphFarbe` neben `glyph` und `KREIS_SICHER` neben `CENTER` ist in einer 194-Zeilen-Datei auffällig, nicht gefährlich.
Empfehlung: Regel präzisieren: Bezeichner in .ts/.tsx/.mjs englisch (auch in neuem Code), Shell-Skripte deutsch. make-brand.mjs und deploy.yml einmal angleichen.
Aufwand: S
```

```
ID: A2-013
Titel: Datei- und Ordnernamen zweisprachig ohne erkennbare Regel
Severity: low
Confidence: confirmed
Evidenz:
  docs/: architecture.md, data-sources.md, hosting.md (englisch) neben entscheidungen.md, staedte.md, marke.md, todo.md, neue-sitzung.md, oeffentlich-machen.md, sitzungsstatistik.md, org-profil.md, datenschutz.md, impressum.md, ideen-2012.md (deutsch)
  Ordner: docs/bericht (deutsch) neben docs/brand, docs/badges, docs/images (englisch)
  app/apps/web/public/screenshots/: desktop.png + handy.png (gemischt im selben Ordner); docs/images/: mobile-start.png, overview.png (englisch)
  Skripte: scripts/einrichten.sh, umzug.sh (deutsch, Konvention) · app/packages/ingest/scripts/build-tiles.sh (englisch, aber deutsche Kommentare) · app/scripts/fetch-parkzonen.sh (gemischt, englische Kommentare, Bestand)
  Migration: 0001_schema.sql — Schema `NNNN_name.sql` eingehalten
  Tests: packages/core/test/*.test.ts vs. apps/web/e2e/*.spec.ts — zwei Endungen, werkzeugüblich (Vitest/Playwright), kein Finding
  Hook-Datei useZoneStatus.ts (camelCase) neben data-source.ts, map-style.ts (kebab-case) — React-Konvention, kein Finding
Wirkung: Kosmetisch. Die drei englischen docs-Namen sind Bestand aus der Umzugszeit; alles Neuere ist deutsch. Der Auftrag prüft, ob die Skript-Konvention „deutsch" durchgehalten ist: für scripts/ ja, für die zwei Skripte unter app/ nein.
Empfehlung: Nichts umbenennen (Links brechen); die Regel in CLAUDE.md so fassen, wie sie gelebt wird: „neue Doku-Dateien und Skripte deutsch, Bestand bleibt". `handy.png` → `phone.png` wäre die einzige Änderung, die keinem Link weh tut (manifest.webmanifest prüfen).
Aufwand: S
```

```
ID: A2-014
Titel: Commit-Nachrichten: ASCII eingehalten, drei Abweichungen von „deutsch"
Severity: low
Confidence: confirmed
Evidenz:
  Befehl: git log --format=%s -80 | cat -A | grep 'M-' → keine Treffer (alle 80 Betreffe ASCII); Bodies: 0 Zeilen mit Umlauten
  d3a8935 (Thomas Kamann): "Remove Profil der Organisation" — gemischt
  11 Dependabot-Commits englisch ("ci: bump …", "deps-dev: bump …") — fremder Autor, erwartbar
  16 Merge-Commits mit git-Standardtext, davon 9 "Merge npm_and_yarn/app/…" / "Merge github_actions/…" — von Hand ausgelöst (CLAUDE.md-Regel: lokal mergen), hätten deutsch betitelt werden können
  Autoren: Claude 50, Thomas Kamann 17, dependabot 11, github-actions 2
Wirkung: Der Verlauf ist lesbar und konsistent; die Abweichungen sind erklärbar. Kein Handlungsdruck.
Empfehlung: Optional `git merge --no-ff -m "Dependabot: vite 8.2.1 uebernehmen"` in der CLAUDE.md-Regel zu Workflow-Merges nennen.
Aufwand: S
```

```
ID: A2-015
Titel: Copy-Paste in einrichten.sh: getMe zweimal roh trotz vorhandenem tg_api(), zwei curl-Zweige in cf_api()
Severity: low
Confidence: confirmed
Evidenz:
  scripts/einrichten.sh:529-533   tg_api() { curl -sS -X POST "https://api.telegram.org/bot$1/$2" … }
  scripts/einrichten.sh:571-577   zustand="$(curl -sS --max-time 20 "https://api.telegram.org/bot$token/getMe" | python3 -c "…")"
  scripts/einrichten.sh:665-670   wer="$(curl -sS --max-time 20 "https://api.telegram.org/bot$token/getMe" | python3 -c "…")"
  scripts/einrichten.sh:708       dritter roher curl (getWebhookInfo)
  scripts/einrichten.sh:866-873   cf_api(): zwei curl-Aufrufe, die sich nur in `-H Content-Type -d "$daten"` unterscheiden
  wr() (Z. 193): 23 Aufrufe — das ist Nutzung eines Helfers, kein Duplikat. json_text (Z. 607): 3 Aufrufe, ebenso.
  tg_ok() Z. 535 prüft mit `grep -q '"ok":true'` — dasselbe Muster, das cf_geklappt() Z. 886-893 als Fehlerquelle beschreibt (dort wegen Leerzeichen im JSON; Telegram antwortet ohne, daher heute korrekt)
Wirkung: Zwei getMe-Blöcke mit je eigenem Inline-Python-Parser; ändert sich das Timeout oder die Fehlerbehandlung, muss es zweimal geschehen. Das inkonsistente JSON-Lesen (Python bei Cloudflare, grep bei Telegram) ist ein Drift-Risiko, kein Fehler.
Empfehlung: Eine Funktion `tg_getme <token> <feld>` mit dem Python-Parser; `cf_api` mit Array-Argumenten (`args=(); [ -n "$daten" ] && args+=(-H … -d "$daten")`). `tg_ok` auf denselben Python-Leser umstellen wie `cf_geklappt`.
Aufwand: S
```

```
ID: A2-016
Titel: CLAUDE.md-Befehle setzen `app/` als Arbeitsverzeichnis voraus, sagen es aber nicht
Severity: low
Confidence: confirmed
Evidenz:
  CLAUDE.md:21-26   pnpm -r typecheck / pnpm --filter … / cd apps/web && npx playwright test   (kein `cd app`)
  CLAUDE.md:36-42   cd apps/web … cd ../../packages/ingest … scripts/build-tiles.sh   (relativ zu app/)
  README.md:180     cd app  (vorhanden)
  CONTRIBUTING.md:6, :49  cd app  (vorhanden)
  Wurzel: package.json ohne scripts; `pnpm -r typecheck` dort läuft ins Leere
Wirkung: Eine frische Sitzung (CLAUDE.md ist deren Einstieg) führt die Befehle im Wurzelverzeichnis aus und bekommt „No projects matched the filters" — der in `.gitignore:21-26` beschriebene Fallstrick (pnpm erzeugt eine falsche `pnpm-workspace.yaml`) liegt genau auf diesem Weg.
Empfehlung: Erste Zeile des Blocks: `cd app`. Oder Kommentar „alle Befehle aus `app/`".
Aufwand: S
```

```
ID: A2-017
Titel: hosting.md fordert, ALLOWED_ORIGINS zu setzen — es ist gesetzt; r2-cors.json und wrangler.toml stimmen überein
Severity: low
Confidence: confirmed
Evidenz:
  docs/hosting.md:315     "Danach `ALLOWED_ORIGINS` in `wrangler.toml` auf die Domain der Web-App setzen."
  app/apps/api/wrangler.toml:49   ALLOWED_ORIGINS = "https://knoellchenfrei.pages.dev,https://knoellchenfrei.de,https://www.knoellchenfrei.de"
  app/apps/api/r2-cors.json:5-10  dieselben drei Origins + http://localhost:5173, http://localhost:4173
  Domainliste dritte Stelle: scripts/einrichten.sh:163 DOMAINS="knoellchenfrei.de xn--… knoellchenfrei.org" (Registrar-Domains, anderer Zweck)
Wirkung: Der Satz in hosting.md ist eine Anweisung für einen erledigten Schritt; wer ihn befolgt, sucht einen Wert, der schon steht. Die Origin-Listen selbst sind konsistent (die zwei localhost-Einträge in R2 sind für lokale Entwicklung plausibel — aber nicht begründet; wrangler.toml begründet in Z. 33-48 jede Entscheidung, r2-cors.json gar keine, weil JSON keine Kommentare kennt).
Empfehlung: hosting.md:315 → „`ALLOWED_ORIGINS` steht in `wrangler.toml`; beim Domainwechsel dort und in `r2-cors.json` nachziehen". Für die localhost-Begründung ein Satz in hosting.md neben dem R2-Abschnitt (Z. 203).
Aufwand: S
```

```
ID: A2-018
Titel: lint-workflows.yml wird von Dateien ausgelöst, die es nicht prüft
Severity: low
Confidence: confirmed
Evidenz:
  .github/workflows/lint-workflows.yml:15,17   paths: ['.github/**.yml']   (trifft auch .github/ISSUE_TEMPLATE/*.yml)
  .github/workflows/lint-workflows.yml:32-35   files = glob('.github/workflows/*.yml') + dependabot.yml
  ls .github/ISSUE_TEMPLATE/ → bug.yml, config.yml, data.yml
Wirkung: Ein Tippfehler in `bug.yml` löst den Lauf aus, der dann grün meldet, ohne die Datei gelesen zu haben — dieselbe Klasse stiller Fehler, die der Workflow laut seinem Kopfkommentar (Z. 1-10) verhindern will; GitHub ignoriert kaputte Issue-Formulare ebenfalls still.
Empfehlung: `glob('.github/**/*.yml')` — eine Zeile.
Aufwand: S
```

### Info

```
ID: A2-019
Titel: Glyph-Pfad in make-icons.mjs und make-brand.mjs — bewusstes Duplikat, Begründung tragfähig, aber ungesichert
Severity: info
Confidence: confirmed
Evidenz:
  app/apps/web/scripts/make-icons.mjs:28-29 und make-brand.mjs:38-39: identischer Pfad-String (Vergleich der Konstanten: gleich)
  make-brand.mjs:34-37  „Bewusst kopiert statt geteilt: Ein gemeinsames Modul zwischen zwei Skripten, die beide nur bei einer Änderung des Motivs laufen, wäre mehr Bindung als Nutzen — und wenn das Motiv sich ändert, ändern sich ohnehin beide."
  make-brand.mjs:6      erklärt zusätzlich, warum die Datei getrennt ist
Bewertung: Die Begründung ist nachvollziehbar (zwei Wegwerf-Generatoren, kein Laufzeitcode). Was fehlt, ist der Riegel: „ändern sich ohnehin beide" ist eine Erwartung, keine Prüfung. Beide Skripte laufen selten und von Hand; ein auseinandergelaufenes Motiv fiele erst beim Vergleich von Icon und Avatar auf.
Empfehlung: Kein gemeinsames Modul (die Begründung dagegen steht). Stattdessen drei Zeilen in make-brand.mjs: den Pfad aus make-icons.mjs per Regex lesen und bei Ungleichheit abbrechen — das kostet keine Bindung und ersetzt die Prosa durch eine Messung.
Aufwand: S
```

```
ID: A2-020
Titel: Kommentarsprache im Bestand gemischt — konventionskonform, zur Kenntnis
Severity: info
Confidence: confirmed
Evidenz (Heuristik: deutsche vs. englische Funktionswörter in Kommentaren je Datei):
  gemischt: apps/api/src/worker.ts (de 236 / en 118), apps/web/src/App.tsx (112 / 327), vite.config.ts (56 / 32), styles.css (74 / 90), e2e/app.spec.ts (63 / 81), packages/core/src/tariff.ts (20 / 90), holidays.ts (50 / 24), sw-template.js (41 / 31), 0001_schema.sql (78 / 45)
  rein deutsch, alle nach dem Umzug neu: core/city.ts, core/hamburg.ts, web/city.ts, make-brand.mjs, build-data-hamburg.ts, city.test.ts, hamburg.test.ts, einrichten.sh (273 Kommentarzeilen, 0 englische)
  rein englisch (Bestand): heatmap.ts, parse-schedule.ts, sighting.ts, seed.ts, presence.ts, fetch-parkzonen.sh u. a.
Bewertung: Genau das, was CLAUDE.md vorschreibt („deutsche Kommentare bei neuem Code, die englischen im Bestand bleiben stehen"). Kein Finding. 0001_schema.sql ist ein Grenzfall: Kopf deutsch (Z. 1-23), Tabellendefinitionen englisch (Z. 25 ff.) — Bestand aus schema.sql, in eine neue Datei übernommen.
Empfehlung: keine.
Aufwand: —
```

```
ID: A2-021
Titel: Historische E2E-Zahl für denselben Stand dreimal verschieden: 91 / 92 / 93
Severity: info
Confidence: unverified (welche stimmt — der alte Stand ist nicht mehr auscheckbar)
Evidenz:
  docs/bericht/index.html:226   „129 Unit-Tests, 92 End-to-End-Tests" (Kopfkachel der ersten Nacht)
  docs/neue-sitzung.md:32       „129 Unit-Tests, 93 E2E"
  (außerhalb der Grundgesamtheit: /home/user/parkingzone/CLAUDE.md:26 „91 End-to-End-Tests" für denselben Stand)
Bewertung: Alle drei sind Vergangenheit; der aktuelle Stand (107/108) ist konsistent. Vermutlich derselbe Zähl-Unterschied wie heute (bestanden vs. gelistet vs. nur-Handy).
Empfehlung: Nichts ändern; wenn der Bericht je überarbeitet wird, die Zählweise nennen wie README.md:214 es tut.
Aufwand: —
```

```
ID: A2-022
Titel: Worker-Adresse mit Konto-Slug im Bericht, mit Platzhalter in hosting.md
Severity: info
Confidence: confirmed
Evidenz:
  docs/bericht/index.html:878   knoellchenfrei-api.k-tommy.workers.dev
  docs/hosting.md:379           https://knoellchenfrei-api.<konto>.workers.dev
Bewertung: Kein Konsistenzproblem — der Bericht dokumentiert einen Ist-Zustand, die Doku ein Muster. Der Slug ist ein Kontoname; ob er im öffentlichen Repository stehen soll, ist eine Frage für den Sicherheits-Agenten, nicht für diesen Report. Zur Weitergabe.
Empfehlung: an A-Sicherheit.
Aufwand: —
```

```
ID: A2-023
Titel: Audit-Rahmen nennt Branch `main`, Arbeitskopie steht auf dem Migrationsbranch
Severity: info
Confidence: confirmed
Evidenz:
  git branch --show-current → claude/parkingzone-migration-18g8fo
  git rev-parse --short origin/main → fceadca; git branch -r --contains fceadca → origin/main, origin/claude/parkingzone-migration-18g8fo
Bewertung: Inhaltlich identisch; alle Befunde gelten für `main`.
Empfehlung: keine.
Aufwand: —
```

## Was in Ordnung ist (geprüft, kein Finding)

- Commit-Betreffe: 80/80 ASCII, Bodies ohne Umlaute.
- `tsconfig`: alle vier Pakete erben von `tsconfig.base.json` mit `strict`,
  `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes` — eine Quelle.
- `ALLOWED_ORIGINS` (wrangler.toml) und `r2-cors.json`: dieselben drei Origins.
- CI-Token-Rechte: deploy.yml und hosting.md nennen dieselben zwei.
- Migrationen: Schema `NNNN_name.sql` eingehalten (eine Datei).
- Coverage: Badge 96.1 %, README 96,1/90,3/98,4, Lauf 96,13/90,35/98,46 —
  konsistent; Schwellwerte 85/80 in README und CONTRIBUTING gleich der
  `vitest.config.ts` (die zusätzlich `functions: 85` setzt, was die Doku nicht
  nennt — vernachlässigbar).
- Node 22 und pnpm 10 in allen fünf Workflow-Stellen gleich.
- `bash -n`: alle vier Shell-Skripte sauber. shellcheck: drei von vier ohne
  Hinweis.
- Stadtgrenzen Hamburg: nur in `core/city.ts:119`.
- `index.html` `lang="de"`, Manifest `lang: de`, alle Shortcut-Namen deutsch.

## Coverage

| Klasse | Inventar | Geprüft | Übersprungen (Grund) | Nicht erreicht |
| --- | ---: | ---: | ---: | ---: |
| ci | 9 | 9 | 0 | 0 |
| config | 20 | 15 | 5 — `pnpm-lock.yaml` (erzeugt), `hamburg/meta.json` (erzeugt, Berlin-Pendant gelesen), 3 Test-Fixtures (Rohdaten) | 0 |
| doc | 16 | 16 | 0 | 0 |
| legal | 5 | 5 | 0 | 0 |
| iac | 3 | 3 | 0 | 0 |
| code | 82 | 82 | 0 | 0 |
| other | 2 | 2 | 0 | 0 |
| asset | 39 | 7 (Badges, Inhalt) | 32 — PNG (binär), GeoJSON (Daten), Brand-SVGs (Grafik); Dateinamen aller 32 geprüft (A2-013) | 0 |
| **Summe** | **176** | **139** | **37** | **0** |

**Coverage: 79,0 %** inhaltlich (139/176); 100 % nach Dateiname.

Prüftiefe: alle 82 Code-Dateien liefen durch drei Skripte (Kommentarsprache,
Umlaut-Mischung, Stadtgrenzen-Zahlen) und die Stil-Messung (Tabs, Semikolons,
Anführungszeichen, Zeilenlänge, CRLF, Trailing Whitespace); die vier
Shell-Skripte zusätzlich durch `bash -n` und shellcheck. Von Hand gelesen: alle
vier Workflows, `wrangler.toml`, `r2-cors.json`, `0001_schema.sql` (Kopf),
`einrichten.sh` (Funktionsliste und acht Ausschnitte), `make-brand.mjs`/
`make-icons.mjs` (Glyph-Teil), `city.ts`, `heatmap.ts`, `build-tiles.sh`
(Grenzen-Teil), die 15 Test-Dateien (Titel), `pnpm-workspace.yaml`, alle
`package.json`/`tsconfig`. Doku und Legal: Volltext-Grep nach Testzahlen,
Domains, Worker-/Bot-/Datenbanknamen, Token-Rechten, Migrationsnamen und
Befehlen; Ausschnitte gelesen, wo ein Treffer lag. `docs/bericht/index.html`
(Bericht) nur per Grep — 1.300 Zeilen Prosa, für Konsistenz nur die Zahlen und
Adressen relevant.

Nicht geprüft, weil außerhalb des Auftrags: fachliche Richtigkeit der
Doku-Aussagen, Sicherheitsrelevanz (A2-022 weitergegeben), Funktion des Codes.
