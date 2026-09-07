# A6 — Open Source: Lizenz, Community-Set, Contributor-Erfahrung, OpenSSF

Repository `knoellchenfrei/knoellchenfrei`, Branch `main`, Commit `fceadca5221c20dbde4084c450c0f8c777333c23`.
Geprüft am 6./7. September 2026, read-only. Grundgesamtheit: `audit/inventory.json` (176 Dateien).
GitHub-API nur lesend; keine Requests gegen Produktivsysteme (Worker, Pages, Behörden-WFS).

## Zusammenfassung

1. Der Code ist sauber MIT-lizenziert, die Laufzeit-Abhängigkeiten sind ausnahmslos MIT/ISC/BSD — kein Copyleft. Im Build-Werkzeug stecken MPL-2.0 (`lightningcss`) und LGPL-3.0 (`sharp-libvips`), beides wird nicht ausgeliefert.
2. GitHub meldet trotzdem `NOASSERTION`: Der deutsche Datenlizenz-Anhang in `LICENSE` drückt die Textähnlichkeit auf 82 % (licensee-Schwelle 98 %). Ohne den Anhang wären es 100 %.
3. Die Hamburger Daten (DL-DE/BY-2.0, Nennungspflicht) liegen im Repository, aber `LICENSE` und das Daten-Badge nennen nur Berlin unter DL-DE/Zero.
4. Der Sicherheits-Meldeweg ist tot: `SECURITY.md` verweist auf Private Vulnerability Reporting, die API sagt `enabled: false`. Kein Fallback.
5. Der Code of Conduct hat statt einer Kontaktadresse einen Platzhalter.
6. Kein Branch-Schutz, kein Review menschlicher Commits, keine Releases/Tags/CHANGELOG, kein SAST, kein CODEOWNERS — für ein Ein-Personen-Projekt im geschlossenen Testbetrieb erklärbar, für den öffentlichen Start eine Liste.
7. Contributor-Erfahrung: frischer Klon bis grün (Install + Typecheck + 190 Unit-Tests) in **6,9 s** (warmer pnpm-Store) bzw. **~12 s** (kalter Store); Web-Build 1,8 s. `CONTRIBUTING.md` ist an vier Stellen veraltet.
8. Findings: 0 critical, 1 high, 6 medium, 9 low, 6 info.

---

## Findings nach Severity

### High

```
ID: A6-001
Titel: Sicherheits-Meldeweg zeigt auf abgeschaltetes Private Vulnerability Reporting
Severity: high
Confidence: confirmed
Evidenz:
  SECURITY.md:5-6 — „Nutze stattdessen GitHub Security Advisories
    (https://github.com/knoellchenfrei/knoellchenfrei/security/advisories/new)"
  .github/ISSUE_TEMPLATE/config.yml:3-5 — Kontaktlink auf dieselbe Adresse
  .github/ISSUE_TEMPLATE/bug.yml:6-8 — verweist auf SECURITY.md
  GET /repos/knoellchenfrei/knoellchenfrei/private-vulnerability-reporting → HTTP 200, {"enabled": false}
  docs/todo.md:415-420 — der Punkt „Dependabot-Warnungen und Sicherheitsupdates einschalten" ist
    offen; PVR steht nirgends als Aufgabe.
  Kein zweiter Kanal: grep nach E-Mail-Adressen in README/SECURITY/CONTRIBUTING/CODE_OF_CONDUCT/docs → 0 Treffer.
Wirkung: Wer eine Lücke privat melden will, landet auf einer Seite, die ohne aktiviertes PVR
  für Externe nicht funktioniert. Es gibt keinen Ersatzweg; die realistische Folge ist ein
  öffentliches Issue oder gar keine Meldung. Die zugesagten Fristen (3/10 Tage) sind damit
  nicht einlösbar.
Empfehlung: PVR in Settings → Advanced Security einschalten (nur über die Weboberfläche —
  der Egress-Proxy sperrt PATCH auf Repo-Einstellungen, siehe CLAUDE.md). Zusätzlich eine
  E-Mail-Adresse als Fallback in SECURITY.md, idealerweise `security@knoellchenfrei.de`.
  Danach den Link einmal abgemeldet im Browser prüfen.
Aufwand: S
```

### Medium

```
ID: A6-002
Titel: GitHub erkennt die MIT-Lizenz nicht (NOASSERTION) — Ursache ist der Datenlizenz-Anhang
Severity: medium
Confidence: confirmed
Evidenz:
  GET /repos/knoellchenfrei/knoellchenfrei → license: {"key":"other","spdx_id":"NOASSERTION"}
  GET /repos/…/community/profile → files.license.spdx_id "NOASSERTION"
  LICENSE:1-21 — MIT-Text; LICENSE:23-31 — Trenner `---` und zwei deutsche Absätze zu
    DL-DE/Zero und ODbL
  diff gegen choosealicense.com/_licenses/mit.txt (Referenz): einzige Abweichungen sind die
    Copyright-Zeile (LICENSE:3, „2012-2026 Thomas Kamann and contributors") und die
    angehängten Zeilen 22-31. Der eigentliche MIT-Block ist wortgleich.
  licensee-Nachrechnung (Dice-Koeffizient über Wort-Bigramme, Copyright-Zeile entfernt wie
    bei licensee): LICENSE gesamt 82,1 %; nur der Teil vor `---`: 100,0 %.
    licensee akzeptiert ab 98 % (CONFIDENCE_THRESHOLD). Die Zeile „and contributors" ist
    unschuldig — licensee ignoriert Copyright-Zeilen.
  docs/badges/licence.svg — Badge sagt „MIT"; Quelle build-badges.ts:105 (hart kodiert)
Wirkung: Lizenzfilter auf GitHub, SPDX-/SBOM-Werkzeuge, Scorecard (License 9/10 statt 10/10),
  Dependents und Paket-Scanner sehen „Other". Für Nachnutzer sieht das nach einer
  Eigenlizenz aus, obwohl es MIT ist.
Empfehlung: `LICENSE` auf den reinen MIT-Text kürzen. Den Datenhinweis nach
  `NOTICE.md` (oder `LICENSE-DATA.md`) verschieben und aus README verlinken — dort gehört
  er ohnehin um Hamburg ergänzt (A6-003). Alternativ REUSE: `LICENSES/MIT.txt` +
  `LICENSES/DL-DE-ZERO-2.0.txt` + `LICENSES/DL-DE-BY-2.0.txt` und `REUSE.toml`;
  SPDX kennt beide DL-DE-Kennungen.
Aufwand: S
```

```
ID: A6-003
Titel: Hamburger Geodaten (Nennungspflicht) liegen im Repository, LICENSE und Daten-Badge nennen nur Berlin
Severity: medium
Confidence: confirmed
Evidenz:
  app/apps/web/public/data/hamburg/{zones,districts}.geojson — 181 kB / 158 kB eingefrorene Kopien
  app/apps/web/public/data/hamburg/meta.json — "licence":"Datenlizenz Deutschland Namensnennung 2.0",
    "attributionRequired":true, "source":"Freie und Hansestadt Hamburg, Landesbetrieb
    Geoinformation und Vermessung, WFS 2.0.0"
  app/packages/core/src/city.ts:121-126 — HAMBURG.attribution.attributionRequired = true, mit
    Kommentar Z. 43-46: „eine Oberfläche, die sie weglässt, verletzt sie"
  LICENSE:25-28 — nur „Die Berliner Geodaten … Datenlizenz Deutschland Zero 2.0 … erfordern
    keine Namensnennung". Hamburg fehlt.
  docs/badges/data.svg — aria-label „data: DL-DE/Zero-2.0"; build-badges.ts:106 hart kodiert
  README.md:275-279 — nennt Hamburg korrekt (DL-DE/Namensnennung-2.0, „Quellenangabe
    Bedingung, nicht Höflichkeit"); docs/data-sources.md:60-66 ebenso; docs/org-profil.md:33-34 ebenso.
  Die App selbst nennt die Quelle: SettingsSheet.tsx:305-320 (Lizenzlink, Pflichthinweis bei
    attributionRequired).
Wirkung: Die Weitergabe der Daten im Repository ist selbst eine Nutzung im Sinne der
  DL-DE/BY-2.0 und verlangt den Quellenvermerk. Er steht in README und in der App, aber nicht
  in der Datei, die als Lizenzdatei gilt, und das Badge ist für Hamburg falsch. Wer nur
  `LICENSE` liest (Forks, Paketierer, Scanner), sieht „keine Namensnennung".
Empfehlung: In `NOTICE.md`/`LICENSE` je Stadt einen Absatz mit dem exakten Quellenvermerk
  laut Lizenz („Datenlizenz Deutschland – Namensnennung – Version 2.0", Herausgeber,
  Abrufdatum, Änderungsvermerk „vereinfachte Geometrie" — `simplify.ts` verändert die Daten,
  die DL-DE/BY verlangt bei Änderungen einen Hinweis). Badge auf „DL-DE Zero · BY" oder
  Badge je Stadt aus `meta.json` erzeugen statt aus einer Konstante.
Aufwand: S
```

```
ID: A6-004
Titel: Code of Conduct ohne Kontaktadresse — Platzhalter statt Meldeweg
Severity: medium
Confidence: confirmed
Evidenz:
  CODE_OF_CONDUCT.md:14 — „**Meldung:** ⟨E-Mail-Adresse des Betreibers eintragen⟩."
  CODE_OF_CONDUCT.md:3-4 — bezieht sich auf Contributor Covenant 2.1; dessen Abschnitt
    „Enforcement" verlangt eine benannte Kontaktstelle („reported to the community leaders
    responsible for enforcement at [INSERT CONTACT METHOD]").
  GET /repos/…/community/profile → code_of_conduct.key "other" (GitHub erkennt keinen
    Covenant-Text, weil nur eine Kurzfassung steht)
  docs/todo.md:411-413 — bewusst keine private E-Mail im Profil; eine Projektadresse ist
    aber nicht dasselbe.
Wirkung: Die Verhaltensregeln sind nicht durchsetzbar, weil niemand weiß, wohin eine Meldung
  geht. Für Betroffene ist ein Platzhalter schlechter als kein CoC — er verspricht
  Vertraulichkeit und liefert keinen Kanal.
Empfehlung: Eine Rollenadresse eintragen (`conduct@knoellchenfrei.de` oder die Adresse aus
  dem künftigen Impressum). Wer den Covenant vollständig einbindet (Datei mit Originaltext,
  Kurzfassung davor), bekommt zusätzlich die GitHub-Erkennung.
Aufwand: S
```

```
ID: A6-005
Titel: Kein Branch-Schutz auf main; menschliche Änderungen ohne Review
Severity: medium
Confidence: likely
Evidenz:
  GET /repos/…/rules/branches/main → HTTP 200, [] (keine Rulesets)
  GET /repos/…/branches/main/protection → HTTP 403 „Resource not accessible by integration"
    (klassischer Branch-Schutz mit diesem Token nicht prüfbar — daher „likely", nicht „confirmed")
  git log --first-parent origin/main: 65 Commits, davon 15 Merges; 0 Commits „Merge pull
    request"; die 15 Merges sind `Merge remote-tracking branch 'origin/main' into
    claude/…` (Arbeitsbranch-Sync, kein Review).
  GET /repos/…/pulls?state=all → 11 PRs, alle von dependabot[bot]; die menschlichen 71 Commits
    (claude 54, herbeus 17) gingen ohne PR auf main.
  ci.yml:2-10 läuft bei push und pull_request — es gibt also Status-Checks, die ein Ruleset
    verlangen könnte.
Wirkung: Ein kompromittiertes Konto oder ein Token mit `contents: write` kann direkt auf
  main pushen; `deploy.yml` und `pages.yml` rollen jeden Push auf main sofort aus
  (deploy.yml:11-13, pages.yml:4-9). Scorecard Branch-Protection 0/10, Code-Review 0/10.
Empfehlung: Ruleset für `main`: PR erforderlich, Status-Check „CI" erforderlich, Force-Push
  und Löschen verboten; Bypass-Liste für den Eigentümer, damit Solo-Arbeit möglich bleibt.
  Spätestens vor dem öffentlichen Start.
Aufwand: S
```

```
ID: A6-006
Titel: GitHub-Actions nur per Tag gepinnt, nicht per Commit-SHA
Severity: medium
Confidence: confirmed
Evidenz:
  grep "uses:" .github/workflows/*.yml → 22 Verwendungen, alle in der Form `@v4`…`@v7`:
    actions/checkout@v7, actions/setup-node@v7, pnpm/action-setup@v6,
    actions/upload-artifact@v4, actions/upload-pages-artifact@v5, actions/deploy-pages@v4,
    cloudflare/wrangler-action@v4 (deploy.yml:74,124 — läuft mit CLOUDFLARE_API_TOKEN)
  Gegenbeispiel positiv: npm-Abhängigkeiten sind über app/pnpm-lock.yaml und
    `pnpm install --frozen-lockfile` (ci.yml:29, deploy.yml:33, pages.yml:44) fixiert.
  .github/dependabot.yml:120-137 — Dependabot pflegt github-actions; SHA-Pins würde es
    ebenfalls aktualisieren (inkl. Versionskommentar).
Wirkung: Ein verschobenes Tag (tj-actions-Vorfall, März 2025) läuft mit den Rechten des
  Workflows — bei deploy.yml mit dem Cloudflare-Token. Scorecard Pinned-Dependencies teilweise.
Empfehlung: `uses: actions/checkout@<sha> # v7.x.y`; Dependabot hält die Pins aktuell.
Aufwand: S
```

```
ID: A6-007
Titel: Drittanbieter-Lizenzhinweise (BSD) fehlen im ausgelieferten Bundle
Severity: medium
Confidence: confirmed
Evidenz:
  pnpm licenses list --json --prod (frischer Klon, app/): 29 Laufzeitpakete, davon
    BSD-3-Clause: @mapbox/vector-tile@3.0.0, maplibre-gl@6.4.0, pbf@5.1.2, pmtiles@4.5.0,
    protomaps-themes-base@4.5.0; BSD-2-Clause: @mapbox/tiny-sdf@2.2.0, @mapbox/unitbezier@1.0.0
  Web-Build im Klon (`pnpm --filter @knoellchenfrei/web build`, Vite 8/rolldown):
    dist/assets/maplibre-cauwxC8K.js (960 kB) u. a.;
    grep -i "@license|Copyright|MapLibre GL JS" dist/assets/*.js → 0 Treffer
  grep nach rollup-plugin-license / legalComments / THIRD-PARTY in app/ → 0 Treffer
  SettingsSheet.tsx nennt OSM (Z. 308) und die Stadtquelle, aber keine Bibliothek.
Wirkung: BSD-2/3-Clause verlangen, dass Copyright-Hinweis und Lizenztext „in the
  documentation and/or other materials provided with the distribution" erscheinen. Das
  ausgelieferte Bundle enthält nichts davon, und die App verlinkt auch keine Liste. Die
  Quellen auf GitHub erfüllen das nur für Leute, die dort nachsehen.
Empfehlung: Beim Build eine `THIRD-PARTY-NOTICES.txt` aus `pnpm licenses list` erzeugen und
  nach `dist/` legen; in den Einstellungen unter „Rechtliches" verlinken. Alternativ
  Legal-Comments im Minifier erhalten (rolldown: `output.legalComments: 'inline'`).
Aufwand: S
```

### Low

```
ID: A6-008
Titel: `license`-Feld fehlt in allen fünf package.json
Severity: low
Confidence: confirmed
Evidenz:
  app/package.json, app/apps/web/package.json, app/apps/api/package.json,
  app/packages/core/package.json, app/packages/ingest/package.json — kein Schlüssel `license`
  (alle `"private": true`); package.json im Wurzelverzeichnis ebenfalls ohne.
  Zum Vergleich pnpm licenses list: Pakete ohne Feld erscheinen dort als „Unknown".
Wirkung: SBOM-Generatoren (CycloneDX, syft) und `pnpm licenses` sehen für die eigenen
  Workspace-Pakete keine Lizenz; wer `@knoellchenfrei/core` je veröffentlicht, veröffentlicht
  es „UNLICENSED".
Empfehlung: `"license": "MIT"` in alle fünf Dateien.
Aufwand: S
```

```
ID: A6-009
Titel: CONTRIBUTING.md in vier Angaben veraltet, eine davon führt in den bekannten pnpm-fetch-Fallstrick
Severity: low
Confidence: confirmed
Evidenz:
  CONTRIBUTING.md:8 — „pnpm test # 62 Unit-Tests"; tatsächlich 190 (vitest run im Klon:
    „Tests 190 passed"; README.md:181 sagt 190; docs/badges/tests.svg „190 passing")
  CONTRIBUTING.md:38 — „React 19, Vite 7, MapLibre GL 5"; app/apps/web/package.json:16,25 —
    maplibre-gl ^6.4.0, vite ^8.2.1 (README.md:162 sagt korrekt „MapLibre GL 6")
  CONTRIBUTING.md:40-41 — „ParkingZone/ Java-Original von 2012"; `git ls-files | grep -ci
    'parkingzone\|\.java'` → 0; das Verzeichnis ist beim Umzug nicht mitgekommen
    (SECURITY.md:139-141, scripts/umzug.sh)
  CONTRIBUTING.md:62 — „pnpm --filter @knoellchenfrei/ingest fetch"; das Skript heißt
    `fetch-data` (app/packages/ingest/package.json:7); CLAUDE.md-Tabelle „pnpm fetch":
    „ist ein eingebautes pnpm-Kommando und lief still statt des Projektskripts"
  Zusätzlich: CONTRIBUTING.md:52 nennt nur Zeilen/Zweige; vitest.config.ts:12-17 schwellt
    auch functions 85 und statements 85 (nicht falsch, aber unvollständig).
Wirkung: Erste Anlaufstelle für Fremde widerspricht README und CLAUDE.md; der falsche
  Skriptname läuft still durch und liefert keine Daten — genau der Vorfall aus CLAUDE.md.
Empfehlung: Zahlen aus den Badges referenzieren statt hart schreiben; Struktur-Block auf
  den Stand von README.md:158-166 bringen; `fetch` → `fetch-data`.
Aufwand: S
```

```
ID: A6-010
Titel: Keine Releases, Tags, Versionen oder CHANGELOG — Auslieferung ist „jeder Push auf main"
Severity: low
Confidence: confirmed
Evidenz:
  GET /repos/…/releases → []; GET /repos/…/tags → []
  alle vier Workspace-Pakete "version": "0.1.0" (unverändert seit Anlage)
  `git ls-files | grep -i changelog` → nichts
  deploy.yml:11-13 und pages.yml:4-9: Deploy bei jedem Push auf main, ohne Versionsmarke
  Kein Dokument beschreibt eine Versionierungspolitik (grep „release|version" in
    CONTRIBUTING.md, docs/todo.md → nur Unverwandtes)
Wirkung: Nutzer und Sicherheitsforscher können keinen Stand benennen („in welcher Version
  tritt das auf?"); OpenSSF Best Practices `version_unique` und `release_notes` (beides
  MUST) sind nicht erfüllt; Scorecard Signed-Releases ist nicht anwendbar.
Empfehlung: Vor dem öffentlichen Start: `v0.1.0`-Tag, GitHub-Release mit Notizen, CHANGELOG
  (Keep a Changelog); Version in `manifest.webmanifest`/Service-Worker-Cache-Name
  sichtbar machen. Deploy weiter bei Push, aber Releases als Marken.
Aufwand: M
```

```
ID: A6-011
Titel: ci.yml ohne top-level `permissions`
Severity: low
Confidence: confirmed
Evidenz:
  .github/workflows/ci.yml — kein `permissions:`-Block (grep über Workflows: nur
    deploy.yml:18, lint-workflows.yml:19, pages.yml:17 haben einen)
  ci.yml läuft auch für `pull_request` (Z. 10) und lädt Artefakte hoch (Z. 38, 65)
  Repository-Standard für GITHUB_TOKEN (read-only vs. read/write) ist per API nicht
    abfragbar → welche Rechte der Token tatsächlich hat, ist nicht verifiziert.
Wirkung: Bei restriktiver Repo-Voreinstellung harmlos; bei permissiver hat ein Job mit
  `pnpm install` und Playwright-Browser-Download Schreibrechte, die er nicht braucht.
  Scorecard Token-Permissions: teilweise.
Empfehlung: `permissions: contents: read` oben in ci.yml.
Aufwand: S
```

```
ID: A6-012
Titel: Kein CODEOWNERS, keine MAINTAINERS-Angabe
Severity: low
Confidence: confirmed
Evidenz:
  GET /repos/…/codeowners/errors → HTTP 404 (keine CODEOWNERS-Datei)
  `git ls-files` → keine CODEOWNERS/MAINTAINERS/AUTHORS
  Verantwortliche Person nur aus LICENSE:3 und `git log` ableitbar; README.md:281-285
    („Mitmachen") nennt niemanden.
Wirkung: Ohne CODEOWNERS greift die automatische Reviewer-Zuweisung nicht, und Fremde
  wissen nicht, wer entscheidet. Best Practices verlangt keine Datei, Scorecard auch
  nicht — aber ein Ruleset mit „Review von Codeowner" (A6-005) braucht sie.
Empfehlung: `.github/CODEOWNERS` mit `* @herbeus`; ein Satz „Maintainer" in README oder
  CONTRIBUTING.
Aufwand: S
```

```
ID: A6-013
Titel: Keine Issues, keine Good-First-Issues, obwohl Labels und eine lange To-do-Liste existieren
Severity: low
Confidence: confirmed
Evidenz:
  GET /repos/…/labels → 13 Labels, darunter `good first issue`, `help wanted` (GitHub-
    Standardsatz) plus eigenes `daten` (aus data.yml:3) — wobei `daten` nicht in der
    Label-Liste der API steht, d. h. das Template würde beim ersten Issue ein Label
    referenzieren, das es nicht gibt (GitHub legt es dann nicht automatisch an).
  GET /repos/…/issues?labels=good%20first%20issue&state=all → []
  GET /repos/…/issues?state=all → 11 Einträge, alle PRs von Dependabot; 0 echte Issues
  docs/todo.md — hunderte Zeilen offener `- [ ]`-Punkte, keiner als Issue
  has_discussions: false (bewusst, docs/todo.md:411-413)
Wirkung: Der Einstieg für Fremde führt in eine leere Issue-Liste, während die eigentliche
  Arbeitsliste in einer Markdown-Datei liegt, die kein GitHub-Mechanismus findet.
Empfehlung: 3–5 abgegrenzte Punkte aus todo.md als Issues mit `good first issue`
  (z. B. Feiertagstabellen weiterer Länder, THIRD-PARTY-NOTICES, CONTRIBUTING-Korrekturen).
  Label `daten` anlegen, damit data.yml es setzen kann.
Aufwand: S
```

```
ID: A6-014
Titel: Kein Linter/SAST jenseits des TypeScript-Compilers
Severity: low
Confidence: confirmed
Evidenz:
  grep -ri "eslint|codeql|semgrep" in app/apps, app/packages, .github → 0 Treffer
  ci.yml:31-35 — nur typecheck, test, coverage, build; ci.yml:90-100 — `pnpm audit
    --audit-level moderate` und ein grep auf Secret-Muster im Bundle
  app/tsconfig.base.json (laut CLAUDE.md „Stil": strict, noUncheckedIndexedAccess,
    exactOptionalPropertyTypes) — ein „safe language mode" im Sinne der Best Practices
  GET /repos/…/code-scanning/alerts → 403 (Code-Scanning-Status nicht prüfbar)
Wirkung: Scorecard SAST 0/10; Best Practices `static_analysis` (MUST: „beyond compiler
  warnings and safe language modes") nicht erfüllt. Inhaltlich fängt tsc strict viel,
  aber keine XSS-/Injection-Muster in JSX/Worker-Code.
Empfehlung: CodeQL Default Setup (Weboberfläche, kostenlos für öffentliche Repos) —
  erfüllt SAST und Vulnerabilities in einem Schritt; optional eslint mit
  `eslint-plugin-security`/`react-hooks`.
Aufwand: S
```

```
ID: A6-015
Titel: Badges werden nicht von der CI erzeugt; `build` und `security` sind Konstanten
Severity: low
Confidence: confirmed
Evidenz:
  app/packages/ingest/src/build-badges.ts:4-8 — „These are plain files the CI regenerates"
  grep "build-badges|badges" .github/ → 0 Treffer; kein Workflow ruft das Skript auf
  build-badges.ts:99-107 — `build: 'passing'`, `security: 'audited'`, `licence: 'MIT'`,
    `data: 'DL-DE/Zero-2.0'` sind Literale; nur `coverage` wird gemessen, `tests`/`e2e`
    kommen aus Umgebungsvariablen (TEST_COUNT/E2E_COUNT — CLAUDE.md-Befehl)
  docs/badges/*.svg — letzter Stand: tests 190, e2e 107, coverage 96,1 %
    (stimmt mit dem gemessenen Lauf überein; 190 Tests, 54 `test(`-Aufrufe × 2 Projekte = 108
    Playwright-Fälle ≈ 107 laut Badge — nicht nachgemessen, Suite ~9 min)
Wirkung: Ein roter CI-Lauf ändert kein Badge; „security: audited" bleibt grün, auch wenn
  `pnpm audit` in ci.yml:91 rot wird. Das Badge behauptet einen Zustand, den nichts
  verknüpft.
Empfehlung: Badges im CI-Job nach `test:coverage` erzeugen und committen (oder als
  Pages-Artefakt ausliefern), `build`/`security` an den Job-Status binden — oder die Konstanten
  ehrlich in „licence"/„data" beschränken und `build`/`security` weglassen.
Aufwand: S
```

```
ID: A6-016
Titel: Wurzel-package.json verlangt pnpm ^12, Workspace ist auf pnpm 10.33 festgelegt
Severity: low
Confidence: confirmed
Evidenz:
  package.json:1-5 (Wurzel) — "dependencies": {"pnpm": "^12.3.4"}
  app/package.json:5 — "packageManager": "pnpm@10.33.0"; app/package.json:6-8 —
    engines.node ">=22"
  .gitignore:16-19 — die Wurzel-Datei existiert genau dafür: „wenn jemand `npm install` im
    Wurzelverzeichnis ausführt (etwa um pnpm zu installieren)"
  .github/dependabot.yml:44-45 — „unterstützt sind pnpm 7 bis 10, das Projekt steht auf 10.33"
  app/pnpm-workspace.yaml:38-40 — Wiedervorlage „mit dem Sprung auf 11"
  Kein .nvmrc/.node-version; README.md:178-186 nennt keine Voraussetzungen (Node ≥ 22,
    pnpm 10 / corepack).
Wirkung: Wer der `.gitignore`-Anleitung folgt, bekommt pnpm 12 — zwei Hauptversionen über
  dem, was Lockfile, Dependabot-Support und die `minimumReleaseAge`-Begründung annehmen.
  Corepack (vorhanden: 0.34.6) würde über `packageManager` korrekt 10.33.0 wählen — nur steht
  das nirgends.
Empfehlung: Wurzel-`package.json` auf `pnpm@10.33.0` (exakt) oder entfernen und stattdessen
  `corepack enable` in README/CONTRIBUTING als ersten Schritt nennen; `.nvmrc` mit `22`.
Aufwand: S
```

### Info

```
ID: A6-017
Titel: Lizenz-Kompatibilität der Abhängigkeiten: Laufzeit sauber, Copyleft nur im Werkzeug
Severity: info
Confidence: confirmed
Evidenz:
  Befehl (frischer Klon, app/): pnpm licenses list --json [--prod|--dev]
  Gesamt 178 Pakete / 11 Lizenzschlüssel. Laufzeit (--prod, identisch für
    `--filter @knoellchenfrei/web`): 29 Pakete — MIT 13, ISC 8, BSD-3-Clause 5,
    BSD-2-Clause 2, (MIT OR Apache-2.0) 1 (@maplibre/mlt). Kein Copyleft.
  @knoellchenfrei/api --prod: „No licenses in packages found" — der Worker hat außer dem
    Workspace-Paket `core` keine Laufzeitabhängigkeit (app/apps/api/package.json:14-16).
  Dev/Build: MPL-2.0 `lightningcss@1.33.0` (+ linux-x64-gnu) über vite@7.3.6 ← vitest
    (pnpm why); LGPL-3.0-or-later `@img/sharp-libvips-linux-x64@1.3.1` über
    wrangler → miniflare@5.20260903.0-alpha → sharp@0.35.2 (pnpm-lock.yaml:2838-2841).
    Beides läuft nur auf dem Entwicklerrechner/CI, nichts davon landet im Bundle.
  BlueOak-1.0.0 (5 Pakete, dev) — permissiv. CC0-1.0 (@speed-highlight/core, dev).
  Registry-Metadaten: maplibre-gl BSD-3-Clause; pmtiles@4.5.0 BSD-3-Clause;
    protomaps-themes-base@4.5.0 BSD-3-Clause, **deprecated** („migrated to
    @protomaps/basemaps"); wrangler MIT OR Apache-2.0; Cloudflare-Pakete MIT OR Apache-2.0.
Wirkung: Keine Lizenzkonflikte mit MIT. Die Deprecation von protomaps-themes-base
  (exakt gepinnt, app/apps/web/package.json:18) heißt: keine Fixes mehr, Dependabot
  schlägt nichts vor, weil es keine neue Version unter diesem Namen gibt.
Empfehlung: Migration auf `@protomaps/basemaps` einplanen (docs/hosting.md:488 nennt
  das alte Paket). Sonst nichts zu tun.
Aufwand: S
```

```
ID: A6-018
Titel: Datenlizenzen: OSM/ODbL korrekt behandelt, DL-DE-Änderungsvermerk fehlt
Severity: info
Confidence: confirmed
Evidenz:
  map-style.ts:79,105 — Attribution „© OpenStreetMap-Mitwirkende, © Protomaps" bzw.
    „© OpenStreetMap-Mitwirkende"; App.tsx:288 attributionControl aktiv;
    SettingsSheet.tsx:308 nennt ODbL; LICENSE:30-31 „darf nicht entfernt werden"
  docs/data-sources.md:32-40 — ODbL-Share-alike bei OSM-Parkhäusern erkannt und deshalb
    getrennt gehalten; Tile-Usage-Policy benannt.
  Kein OSM-Datenbestand im Repository (nur Kacheln zur Laufzeit) → kein ODbL-Derivat.
  app/packages/ingest/src/simplify.ts — Geometrien werden vereinfacht; DL-DE/BY-2.0 § 2
    verlangt bei Änderungen einen Hinweis; meta.json trägt keinen.
Wirkung: ODbL ist sauber. Für Hamburg fehlt neben dem Quellenvermerk (A6-003) der
  Änderungsvermerk.
Empfehlung: `meta.json` um `modified: "Geometrie vereinfacht (Douglas-Peucker, …)"`
  ergänzen und in den Einstellungen anzeigen.
Aufwand: S
```

```
ID: A6-019
Titel: pnpm-Warnung „Ignored build scripts" beim ersten Install ist nirgends erklärt
Severity: info
Confidence: confirmed
Evidenz:
  Install-Log (frischer Klon): „Ignored build scripts: esbuild@0.28.1, esbuild@0.28.2,
    workerd@1.20260903.1. Run pnpm approve-builds …"
  app/pnpm-workspace.yaml — kein `onlyBuiltDependencies`/`ignoredBuiltDependencies`
  README.md:178-186, CONTRIBUTING.md:5-11, CLAUDE.md — kein Hinweis
  Typecheck, Tests und Web-Build laufen trotzdem durch (gemessen).
Wirkung: Kein Fehler, aber die erste Warnung, die ein Neuer sieht, und sie fordert zu
  einer Handlung auf, die nicht nötig ist (und Postinstall-Skripte freischaltet).
Empfehlung: `ignoredBuiltDependencies: [esbuild, workerd]` in pnpm-workspace.yaml mit
  Kommentar, oder ein Satz in CONTRIBUTING.
Aufwand: S
```

```
ID: A6-020
Titel: Community-Profil: Issue-Templates werden von GitHub nicht gezählt
Severity: info
Confidence: unverified
Evidenz:
  GET /repos/…/community/profile → health_percentage 100, files.issue_template: null
  GET /repos/…/contents/.github/ISSUE_TEMPLATE → bug.yml, config.yml, data.yml (auf main)
  Ursache nicht ermittelt: GitHubs Profil-Check kennt Formulare (`.yml`) laut Doku; ob es
    an der fehlenden `.md`-Variante, an Cache-Verzug (`updated_at: null`) oder am
    Label `daten` liegt, ließ sich lesend nicht feststellen.
  Nebenbefund: `documentation` zeigt auf `tree/master/docs` — GitHub-Artefakt, kein
    Repo-Fehler.
Wirkung: Kosmetisch (Score ist 100 %). Die Formulare selbst sind inhaltlich gut:
  bug.yml verlangt Schritte und Gerät, data.yml Zone/App/Schild — passend zur Domäne.
Empfehlung: Nach ein paar Tagen erneut abfragen; falls weiter null, ein
  `.github/ISSUE_TEMPLATE/feature.md` als Minimal-Template ergänzen.
Aufwand: S
```

```
ID: A6-021
Titel: Dokumentation ausschließlich Deutsch
Severity: info
Confidence: confirmed
Evidenz:
  README.md, CONTRIBUTING.md, SECURITY.md, CODE_OF_CONDUCT.md, Issue-/PR-Templates,
    Workflow-Kommentare — durchgehend Deutsch; Code-Kommentare im Bestand teils Englisch
    (CLAUDE.md „Stil")
  OpenSSF Best Practices `english`: SHOULD („provide documentation in English and be able
    to accept bug reports … in English")
Wirkung: Bewusste Entscheidung für ein Berlin/Hamburg-Projekt; kostet den Badge-Punkt
  nicht (SHOULD), schränkt aber den Kreis möglicher Beitragender und Sicherheitsmelder ein.
Empfehlung: Ein englischer Absatz in README („For non-German speakers") und in SECURITY.md
  („Reports in English are welcome") reichen.
Aufwand: S
```

```
ID: A6-022
Titel: Nicht bei OpenSSF Scorecard oder Best Practices registriert
Severity: info
Confidence: confirmed
Evidenz:
  GET https://api.securityscorecards.dev/projects/github.com/knoellchenfrei/knoellchenfrei → 404
  GET https://www.bestpractices.dev/en/projects.json?pq=knoellchenfrei → []
Wirkung: Erwartbar für ein Repository, das seit einem Tag öffentlich ist; die Tabelle
  unten ist deshalb eine Handbewertung, kein Scan.
Empfehlung: Nach dem öffentlichen Start `ossf/scorecard-action` als Workflow und die
  Best-Practices-Selbstauskunft; beides kostet nichts.
Aufwand: S
```

---

## Contributor-Erfahrung: gemessen

Umgebung: Node v22.22.2, pnpm 10.33.0 (`/opt/node22/bin/pnpm`), corepack 0.34.6, Linux.

| Schritt | Befehl | Zeit | Ergebnis |
| --- | --- | --- | --- |
| Klon + Install + Typecheck + Unit-Tests, **warmer** pnpm-Store | `git clone … && cd app && pnpm install --frozen-lockfile && pnpm -r typecheck && pnpm --filter @knoellchenfrei/core test` | **6,9 s** real | grün; 193 Pakete „reused", 190 Tests, 13 Dateien |
| Klon + Install, **kalter** Store (`--store-dir` leer) | `pnpm install --frozen-lockfile --store-dir <leer>` | **6,4 s** real | 193 Pakete geladen (über Proxy) |
| Web-Build im Klon | `pnpm --filter @knoellchenfrei/web build` | **1,8 s** | dist mit 6 Assets, index.html |
| Zeit bis zum ersten grünen Build, kalt (Summe) | | **≈ 12 s** | |

Nicht gemessen: Playwright-Suite (107 Fälle, ~9 min laut ci.yml-Kommentar; braucht
`PLAYWRIGHT_CHROMIUM` in dieser Umgebung, playwright.config.ts:33-35 liest die Variable, README.md:188-189 erklärt sie).

Stolpersteine, die ein Fremder trifft:

1. **Voraussetzungen stehen nirgends** (Node ≥ 22, pnpm 10 über corepack) — README.md:178 beginnt mit `pnpm install`. Die Wurzel-`package.json` würde pnpm 12 installieren (A6-016).
2. **pnpm-Warnung „Ignored build scripts"** (A6-019) — folgenlos, aber unerklärt.
3. **CONTRIBUTING.md widerspricht README** in Zahlen, Versionen, Verzeichnissen und einem Skriptnamen (A6-009).
4. **`pnpm dev` braucht keine Daten** — die eingefrorenen GeoJSON liegen unter `app/apps/web/public/data/{berlin,hamburg}` im Repository; `fetch-data` ist nur für Aktualisierung nötig. Positiv.
5. **Keine `.env.example`** in `app/`, `apps/web`, `apps/api` — welche Variablen es gibt (`VITE_API_BASE`, `VITE_TILES_URL`, `VITE_CITY`, `PUBLIC_LAUNCH`, `CLIENT_SALT`, `ALLOWED_ORIGINS`), muss man aus vite.config.ts:58,122,125 und deploy.yml zusammensuchen. Für den reinen Web-Build ohne Backend ist keine nötig.
6. **Kein DCO/CLA** — CONTRIBUTING verlangt keine Sign-off-Zeile; `git log` zeigt 0 `Signed-off-by`. Für MIT ohne Verein vertretbar; mit dem Verein als Träger sollte die Frage (Inbound = Outbound) einmal entschieden und in CONTRIBUTING notiert werden.
7. **Kein Prozess beschrieben**: CONTRIBUTING sagt, was vor einem PR zu prüfen ist (Z. 46-56), aber nicht Fork → Branch → PR, wer reviewt, wie schnell.

Gut gelöst: Playwright-Pfadvariable dokumentiert; `fetch-data` statt `fetch` mit Begründung; Coverage-Schwellen im PR-Template; `deploy.yml` scheitert bei Forks ohne Secrets nicht rot (deploy.yml:1-6).

---

## OpenSSF Scorecard — Handbewertung je Check

Scorecard hat das Repository nicht gescannt (A6-022). Bewertung nach `docs/checks.md` (ossf/scorecard main, abgerufen 7.9.2026).

| Check | Status | Evidenz |
| --- | --- | --- |
| Binary-Artifacts | **erfüllt** | `git ls-files` + `file --mime`: einzige Nicht-Text-Dateien sind 17 PNG (Icons, Screenshots, Brand); keine ausführbaren Binaries, `*.pmtiles` in .gitignore:10 |
| Branch-Protection | **nicht** (likely) | `/rules/branches/main` → `[]`; `/branches/main/protection` → 403; 65 direkte First-Parent-Commits (A6-005) |
| CI-Tests | **erfüllt** | ci.yml:10 `pull_request`; Runs auf allen 11 PRs; letzter main-Lauf: Jobs „Typen, Tests, Coverage", „End-to-End", „Sicherheit" alle `success` |
| CII-Best-Practices | **nicht** | bestpractices.dev → `[]` |
| Code-Review | **nicht** | 0 „Merge pull request"-Commits; 71 menschliche Commits ohne PR; Dependabot-PRs (#1-#11) gemerged, Review-Status nicht geprüft |
| Contributors | **unverified** | 2 menschliche Konten (claude 54, herbeus 17) + 2 Bots; Scorecard wertet das `Company`-Feld der Profile — nicht abgefragt. Realistisch: nicht erfüllt (eine Person) |
| Dangerous-Workflow | **erfüllt** | grep über .github: kein `pull_request_target`, kein `workflow_run`, keine `${{ github.event.* }}`-Interpolation in `run:`; deploy.yml interpoliert nur eigene `steps.*.outputs` |
| Dependency-Update-Tool | **erfüllt** | .github/dependabot.yml (npm + github-actions); 11 Dependabot-PRs am 6.9.2026 |
| Fuzzing | **nicht** | grep „fuzz|fast-check" → 0; hardening.test.ts (11 Tests) ist gezielt, nicht generativ |
| License | **teilweise** (9/10) | LICENSE top-level vorhanden (6+3 Punkte), aber GitHub-API `NOASSERTION` → FSF/OSI-Punkt fehlt (A6-002) |
| Maintained | **erfüllt / jung** | 84 Commits, alle 6.9.2026; Scorecard verlangt Aktivität über 90 Tage — Historie ist einen Tag alt (Repo-Neuanlage per scripts/umzug.sh) |
| Packaging | **n/a** | Kein Paket veröffentlicht; Auslieferung als PWA über Pages/Cloudflare — Scorecard würde 0 vergeben, inhaltlich nicht anwendbar |
| Pinned-Dependencies | **teilweise** | npm: Lockfile + `--frozen-lockfile` in allen drei Install-Schritten; Actions: 22× Tag statt SHA (A6-006); `playwright install --with-deps chromium` (ci.yml:58) lädt die zur gepinnten Playwright-Version gehörende Browser-Build; `python3 … import yaml` (lint-workflows.yml:26-40) nutzt Runner-PyYAML ungepinnt |
| SAST | **nicht** | kein CodeQL/eslint/semgrep (A6-014); `/code-scanning/alerts` → 403 |
| SBOM | **nicht** | kein SBOM-Artefakt, kein Release |
| Security-Policy | **erfüllt (formal)** | SECURITY.md mit Meldeweg, Fristen, Bedrohungsmodell — Scorecard prüft Text/Links, nicht ob PVR aktiv ist (A6-001) |
| Signed-Releases | **n/a** | keine Releases/Tags; Commits unsigniert (`git log --format=%G?` → N) |
| Token-Permissions | **teilweise** | top-level `permissions` in deploy.yml:18, lint-workflows.yml:19, pages.yml:17; ci.yml ohne (A6-011) |
| Vulnerabilities | **unverified / likely erfüllt** | Kein OSV-Scan ausgeführt; `pnpm audit --audit-level moderate` im letzten CI-Lauf `success`; `/dependabot/alerts` → 403 |
| Webhooks | **unverified** | Endpunkt nicht abgefragt (Admin-Recht) |

Zählung: erfüllt 6, teilweise 4, nicht 7, n/a 2, unverified 3 (Doppelnennungen bei „likely").

## OpenSSF Best Practices Badge (Passing) — Abweichungen

Kriterien nach `docs/criteria.md` (coreinfrastructure/best-practices-badge main). Nur Abweichungen und Unsicheres; alles andere ist erfüllt (Basics, HTTPS, Issue-Tracker, Build, Tests, CI, Coverage 96,1 %, Testpflicht in CONTRIBUTING:24-27 und PR-Template, `warnings`/`warnings_strict` über tsc strict).

| Kriterium | Stufe | Status | Evidenz |
| --- | --- | --- | --- |
| `contribution` (Prozess: PRs? Wie?) | MUST | **teilweise** | CONTRIBUTING.md:46 nur „Vor einem Pull Request"; kein Fork/Branch/Review-Ablauf |
| `english` | SHOULD | **nicht** | A6-021 |
| `version_unique` | MUST | **nicht** | keine Tags/Releases (A6-010) |
| `version_semver` | SUGGESTED | **nicht** | dito |
| `release_notes` | MUST | **nicht** | kein CHANGELOG, keine Releases |
| `vulnerability_report_process` | MUST | **erfüllt formal** | SECURITY.md:3-9 |
| `vulnerability_report_private` | MUST | **nicht wirksam** | PVR `enabled: false` (A6-001) |
| `vulnerability_report_response` | MUST | **unverified** | noch keine Meldung eingegangen |
| `report_responses`, `enhancement_responses` | MUST/SHOULD | **unverified** | 0 Issues bisher |
| `static_analysis` | MUST | **nicht** | nur tsc (A6-014); Kriterium verlangt Werkzeug „beyond compiler warnings and safe language modes" |
| `static_analysis_common_vulnerabilities` | SUGGESTED | **nicht** | dito |
| `dynamic_analysis` | SUGGESTED | **nicht** | kein Fuzzing; Playwright ist funktional, nicht sicherheitsgerichtet |
| `know_secure_design`, `know_common_errors` | MUST | **unverified** | personenbezogen; SECURITY.md:11-25 (Bedrohungsmodell) und :98-134 (Maßnahmen: Längengrenzen, XSS-Escaping, gebundene SQL-Werte) sprechen dafür |
| `crypto_*` | MUST/N/A | **außerhalb A6** | Hashing mit `CLIENT_SALT` (CLAUDE.md) — Algorithmus in A5 prüfen |
| `no_leaked_credentials` | MUST | **erfüllt (Repo-Historie)** | SECURITY.md:138-143: altes Passwort ist in der neuen Historie nicht enthalten (Neuanlage mit einem Commit); nicht per Scanner geprüft — A5 |
| `floss_license_osi`, `license_location` | SUGGESTED/MUST | **erfüllt, aber unerkannt** | MIT in LICENSE; GitHub-Erkennung scheitert (A6-002) |
| `documentation_interface` | MUST (N/A erlaubt) | **unverified** | Worker-API in docs/architecture.md/hosting.md nicht auf Vollständigkeit geprüft |

Fazit: Passing wäre mit vier Handgriffen erreichbar — PVR einschalten, Release taggen + Notizen, ein Static-Analysis-Werkzeug, Contribution-Prozess in drei Sätzen.

---

## Coverage

Grundgesamtheit `audit/inventory.json`: 176 Dateien.

| Klasse | Gesamt | Geprüft | Übersprungen (Grund) | Nicht erreicht |
| --- | --- | --- | --- | --- |
| ci | 9 | 9 (alle vollständig gelesen) | 0 | 0 |
| legal | 5 | 5 (LICENSE, CODE_OF_CONDUCT, SECURITY vollständig; impressum.md und datenschutz.md nur auf Kontaktweg/Platzhalter geprüft — Inhalt ist A7/Datenschutz-Scope) | 0 | 0 |
| doc | 16 | 12 (CLAUDE.md, CONTRIBUTING.md, README.md, data-sources.md vollständig; hosting.md, staedte.md, entscheidungen.md, todo.md, oeffentlich-machen.md, org-profil.md, neue-sitzung.md, marke.md per gezieltem grep auf Lizenz/Kontakt/Version) | 4: architecture.md, ideen-2012.md, sitzungsstatistik.md (nicht OSS-relevant), bericht/index.html (generierter Werkbericht) | 0 |
| config | 20 | 12 (alle 5 package.json, package.json Wurzel, pnpm-workspace.yaml, pnpm-lock.yaml [sharp/lightningcss-Herkunft], beide .gitignore, beide meta.json, vitest.config.ts via Klasse code) | 8: 4 tsconfig*.json, 3 Test-Fixtures (Daten, Lizenz über meta.json abgedeckt), 1 tsconfig.base.json (Strict-Flags laut CLAUDE.md, nicht nachgelesen) | 0 |
| iac | 3 | 0 | 3: wrangler.toml, r2-cors.json, 0001_schema.sql — Scope A3/A5 | 0 |
| other | 2 | 0 | 2: index.html, manifest.webmanifest — keine Lizenz-/Community-Relevanz | 0 |
| asset | 39 | 39 (alle per `git ls-files`/`file --mime` auf Binary-Artifacts geprüft; 7 Badges inhaltlich; 8 GeoJSON auf Herkunft/Lizenz über meta.json; 5 Brand-SVG auf eingebettete Fonts — nur Namensreferenzen, keine Font-Daten) | 0 | 0 |
| code | 82 | 82 auf Lizenz-Header/SPDX geprüft (grep über alle .ts/.tsx/.mjs/.sh; keine SPDX-Header, 10 Treffer „Copyright/Licence" nur als Wortverwendung); inhaltlich gelesen: build-badges.ts, city.ts (Attribution), playwright.config.ts, vitest.config.ts, map-style.ts/SettingsSheet.tsx/App.tsx (Attribution, grep), vite.config.ts (Env-Variablen, grep) | 0 (Codeinhalt ist Scope A1–A5) | 0 |
| **Summe** | **176** | **159** | **17** | **0** |

Externe Quellen, gelesen: choosealicense.com `_licenses/mit.txt`, spdx `text/MIT.txt`, ossf/scorecard `docs/checks.md`, best-practices-badge `docs/criteria.md`, npm-Registry-Metadaten (protomaps-themes-base, pmtiles, maplibre-gl, react, wrangler), api.securityscorecards.dev, bestpractices.dev.
GitHub-API (lesend): repo, community/profile, rules/branches/main, branches/main/protection (403), releases, tags, issues, labels, pulls, private-vulnerability-reporting, codeowners/errors, contributors, commits, actions/runs + jobs, dependabot/alerts (403), code-scanning/alerts (403), secret-scanning/alerts (Proxy 403), `knoellchenfrei/.github` (403, nicht in der Sitzung freigeschaltet).

Arbeitsverzeichnis unverändert; Klone und Installationen nur im Scratchpad.
