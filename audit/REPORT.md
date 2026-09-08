# Audit-Report — knoellchenfrei @ `fceadca`


> **Die sechs Einzelberichte** liegen daneben und sind die Quelle dieser
> Zusammenfassung — jeder Befund steht dort mit Beleg:
> [A1 Dokumentation](A1-dokumentation.md) ·
> [A2 Konsistenz](A2-konsistenz.md) ·
> [A3 Ausfall und Wiederherstellung](A3-blackout.md) ·
> [A4 Sicherheit](A4-security.md) ·
> [A5 Rechtliches](A5-rechtlich.md) ·
> [A6 Open Source](A6-opensource.md)
Zusammenführung der sechs Agent-Reports A1–A6 (Phase 2). Read-only; einzige
Schreibung ist diese Datei. Grundgesamtheit `audit/inventory.json`, 176 Dateien.
Stand 7. September 2026. Die Reports sind redigiert; Kennungen und Geheimnisse
bleiben es hier. Zielpublikum: Maintainer und externe Contributor.

## Executive Summary

134 Findings aus sechs Reports (A1 32, A2 23, A3 17, A4 24, A5 16, A6 22), nach Dedup **102**: 1 critical, 10 high, 31 medium, 40 low, 20 info. 32 Ursprungs-Findings waren Mehrfachfunde; die größten Cluster: `docs/todo.md` (6 IDs aus vier Reports), Wurzel-`package.json` (4), CONTRIBUTING.md (3), `CLIENT_SALT` (3), Hamburg-Namensnennung (3).

Drei Dinge, die ein Maintainer heute wissen muss:

1. **Das Einzige, was sich nicht aus dem Repository neu erzeugen lässt, ist am schlechtesten dokumentiert:** die fünf Domains — Registrar nur in einer Commit-Nachricht (und dort anders als in entscheidungen.md), Auto-Renew offen, kein zweiter Zugang (M-001). Dazu kein D1-Backup, kein Runbook, ein Einrichtungsskript, das nach Kontoverlust nichts neu anlegt (M-008 bis M-010).
2. **Produktion hängt an einem ungeschützten `main`:** jeder Push rollt mit dem Cloudflare-Token aus — vermutlich dem breiten Einrichtungs-Token — über Actions auf Major-Tags (M-002, M-012, M-013). Der Meldeweg in SECURITY.md zeigt auf ein abgeschaltetes Feature (M-003).
3. **Die App ist öffentlich erreichbar ohne Impressum und Datenschutzerklärung;** der Beta-Riegel ist `noindex`, kein Zugangsschutz, und die DSE-Entwürfe haben acht Anwaltsfragen (M-006, M-007, M-019, M-020).

Für einen Contributor: Die Doku hinkt dem Code um eine Sitzung hinterher — `docs/todo.md` und CONTRIBUTING.md führen in bekannte Fallstricke —, und 49 der 82 Nicht-Info-Findings sind ohne Betreiberkonto und ohne Anwalt behebbar, die meisten in Minuten.

## Top 10 nach Severity × Aufwand

Reihenfolge: critical vor high; innerhalb gleicher Severity S vor M. Bei gleicher
Severity und gleichem Aufwand nach Reichweite der Wirkung (Produktivsystem >
Rechtsrisiko > Betrieb/Doku). Elf Findings sind critical oder high; M-010
(Runbook, Aufwand M) fällt als elftes aus der Tabelle, steht aber in derselben
Klasse wie M-008.

| Rang | M-ID | Titel | Severity | Aufwand | Ursprung | Empfehlung |
| ---: | --- | --- | --- | --- | --- | --- |
| 1 | M-001 | Domains: Registrar nur in einer Commit-Nachricht (und dort anders als in entscheidungen.md), Auto-Renew offen, kein zweiter Zugang | critical | S | A3-001 | Abschnitt „Registrar" in hosting.md oder docs/notfall.md (Anbieter, Kundennummer ohne Zugangsdaten, Ablaufdaten, Auth-Code-Ort); Auto-Renew jetzt einschalten und den Haken in todo.md setzen |
| 2 | M-002 | `main` ohne Branch-Schutz; jeder Push rollt automatisch mit dem Cloudflare-Token aus | high | S | A4-001, A6-005 | Ruleset für `main`: Force-Push/Löschen verbieten, Required Status Checks, PR-Pflicht mit Bypass für den Eigentümer; `environment:` in deploy.yml |
| 3 | M-003 | Sicherheits-Meldeweg tot: SECURITY.md zeigt auf Private Vulnerability Reporting, das abgeschaltet ist; kein Fallback | high | S | A6-001, A3-017 (Teil: Fristen ohne Vertretung) | PVR in Settings → Advanced Security einschalten (nur Weboberfläche, Proxy sperrt PATCH); E-Mail-Fallback in SECURITY.md |
| 4 | M-011 | Telegram-Bot-Name: Skript weiß `@knoellchen_bot`, gibt aber selbst und die Doku fünffach `@knoellchenfrei_bot` aus; Token nur bei BotFather, Gruppenstand unbekannt | high | S | A2-001, A3-006 | Namen per `getMe` nachprüfen und eine Stelle (marke.md) als Wahrheit festlegen; Skript gibt den Namen aus `getMe` aus statt hart kodiert |
| 5 | M-004 | docs/todo.md — die „verbindliche Liste" — verweist auf den gelöschten Setup-Workflow, auf `migrations/001-stadt.sql` per verbotenem `d1 execute` und führt Erledigtes (`?city=`, drei Dependabot-PRs) als offen | high | S | A1-001, A1-002, A1-014, A2-008, A3-005 (Teil), A4-002 (Teil) | Schritt 2 und Punkt 1a auf `./scripts/einrichten.sh` umschreiben; Punkt 8 und 9 auf [x] bzw. Befehl `wrangler d1 migrations apply`; alte Blöcke als Historie markieren |
| 6 | M-005 | CONTRIBUTING.md auf dem Stand vor dem Umzug: 62 Unit-Tests, `pnpm … fetch` (pnpm-Builtin, läuft still), Vite 7 / MapLibre 5, `ParkingZone/` | high | S | A1-003, A2-002, A6-009 | `fetch` → `fetch-data`; Zahlen und Struktur-Block aus README verlinken statt duplizieren; `ParkingZone/`-Zeile streichen |
| 7 | M-007 | Datenschutzerklärung: Auftragsverarbeitung mit Cloudflare und Drittlandtransfer (Cloudflare, Telegram, Anthropic) nicht adressiert | high | S | A5-002 | Cloudflare-DPA im Dashboard annehmen, Datum in entscheidungen.md; DSE Abschnitt 3 um Transfer-Rechtsgrundlage ergänzen |
| 8 | M-009 | einrichten.sh hält eingetragene Kennungen in wrangler.toml für existierende Ressourcen — der Wiederaufbau beginnt mit einem Handgriff, der nirgends steht | high | S | A3-003 | „Kennung eingetragen" von „Ressource existiert" trennen (`wr d1 list`/`kv namespace list` gegen die ID); Option `--neuaufbau`; bis dahin Schritt 1 im Runbook |
| 9 | M-006 | App öffentlich erreichbar (GitHub Pages + Cloudflare Pages) ohne Impressum und Datenschutzerklärung — Beta-Riegel ist noindex, kein Zugangsschutz; § 18 Abs. 1 MStV in der Doku nicht geprüft | high | M | A5-001, A5-010 (verwandt) | Entweder echte Zugangssperre (Cloudflare Access, GitHub-Pages-Deploy aus) oder Impressum/DSE veröffentlichen und beide Build-Variablen setzen; Anwaltsfrage, ob „geschlossener Test" DDG/MStV/Art. 13 aufschiebt |
| 10 | M-008 | Keine Sicherung der D1-Daten; Freitext-Feedback (90 Tage, absichtlich ohne Lesepfad) geht bei Kontoverlust real verloren, Heatmap fällt auf Null | high | M | A3-002 | Entscheiden, welche Tabellen ein Backup wert sind (feedback, marks); `wrangler d1 export` verschlüsselt an einen Betreiber-Schlüssel, Rhythmus und Restore-Befehl dokumentieren, DSE ergänzen |

**Warum Platz 1 Platz 1 ist:** Es ist das einzige critical, das einzige Gut, das
kein Skript und kein Klon zurückbringt, und laut todo.md:75-76 „der einzige
Punkt, an dem ein Versäumnis nicht reparierbar ist" — und die Behebung kostet
einen Abschnitt Doku und einen Schalter beim Registrar.

## Vollständige Findings-Tabelle

Sortiert nach Severity, dann Aufwand. Severity ist jeweils die höchste der
Ursprungs-IDs; „(Teil)" markiert eine Ursprungs-ID, die auf mehrere M-Findings
verteilt wurde. Zuständigkeit: *Maintainer* (braucht Projektkontext oder eine
Entscheidung), *Contributor-geeignet* (abgegrenzt, ohne Konto lösbar), *Anwalt*,
*Betreiber-Konto* (nur mit Cloudflare/GitHub/Registrar/Telegram-Zugang).

| M-ID | Titel | Severity | Confidence | Aufwand | Ursprung | Evidenz | Zuständigkeit |
| --- | --- | --- | --- | --- | --- | --- | --- |
| M-001 | Domains: Registrar nur in einer Commit-Nachricht (und dort anders als in entscheidungen.md), Auto-Renew offen, kein zweiter Zugang | critical | confirmed (Lage) / unverified (welcher Registrar) | S | A3-001 | docs/todo.md:75-76, :209 (Auto-Renew offen); docs/entscheidungen.md:38-43 („Gekauft wurde bei einem anderen Anbieter" als INWX); git 4fdfe31 („die INWX-Parkseite"); scripts/einrichten.sh:1120 | Betreiber-Konto |
| M-002 | `main` ohne Branch-Schutz; jeder Push rollt automatisch mit dem Cloudflare-Token aus | high | confirmed (A4: Branch-Liste `protected: false`) / likely (A6: Protection-Endpunkt 403) | S | A4-001, A6-005 | GitHub-API branches → main `protected: false`, rulesets `[]`; .github/workflows/deploy.yml:9-11, :73-77; 71 menschliche Commits ohne PR | Betreiber-Konto |
| M-003 | Sicherheits-Meldeweg tot: SECURITY.md zeigt auf Private Vulnerability Reporting, das abgeschaltet ist; kein Fallback | high | confirmed | S | A6-001, A3-017 (Teil: Fristen ohne Vertretung) | SECURITY.md:5-6, :8-9; .github/ISSUE_TEMPLATE/config.yml:3-5; API `private-vulnerability-reporting` → `enabled: false`; keine E-Mail-Adresse im Repo | Betreiber-Konto |
| M-011 | Telegram-Bot-Name: Skript weiß `@knoellchen_bot`, gibt aber selbst und die Doku fünffach `@knoellchenfrei_bot` aus; Token nur bei BotFather, Gruppenstand unbekannt | high | confirmed (Widerspruch) / unverified (welcher Name stimmt) | S | A2-001, A3-006 | scripts/einrichten.sh:662-663 vs. :729; docs/marke.md:17, :35, :194; docs/todo.md:355; docs/entscheidungen.md:200; todo.md:350-355 (Gruppen unbekannt) | Betreiber-Konto (Name prüfen), dann Contributor-geeignet (Doku) |
| M-004 | docs/todo.md — die „verbindliche Liste" — verweist auf den gelöschten Setup-Workflow, auf `migrations/001-stadt.sql` per verbotenem `d1 execute` und führt Erledigtes (`?city=`, drei Dependabot-PRs) als offen | high | confirmed | S | A1-001, A1-002, A1-014, A2-008, A3-005 (Teil), A4-002 (Teil) | docs/todo.md:48-49, :53-59, :495-516, :526-543; `ls .github/workflows` → 4 Dateien ohne setup-cloudflare.yml; `ls app/apps/api/migrations` → nur 0001_schema.sql; sighting-backend.ts:237, :251 schickt `?city=` | Contributor-geeignet |
| M-005 | CONTRIBUTING.md auf dem Stand vor dem Umzug: 62 Unit-Tests, `pnpm … fetch` (pnpm-Builtin, läuft still), Vite 7 / MapLibre 5, `ParkingZone/` | high | confirmed | S | A1-003, A2-002, A6-009 | CONTRIBUTING.md:8, :38, :40-41, :62 (Stichprobe: A1 nennt :6/:59, richtig sind :8/:62); app/packages/ingest/package.json (nur `fetch-data`); Lauf: 190 Tests | Contributor-geeignet |
| M-007 | Datenschutzerklärung: Auftragsverarbeitung mit Cloudflare und Drittlandtransfer (Cloudflare, Telegram, Anthropic) nicht adressiert | high | confirmed | S | A5-002 | docs/datenschutz.md:1-6, :148-156 (Platzhalter „AVV erforderlich"); grep AVV/DPA/SCC → nur der Platzhalter; app/apps/api/wrangler.toml:1-50 | Anwalt + Betreiber-Konto |
| M-009 | einrichten.sh hält eingetragene Kennungen in wrangler.toml für existierende Ressourcen — der Wiederaufbau beginnt mit einem Handgriff, der nirgends steht | high | confirmed | S | A3-003 | scripts/einrichten.sh:389-406 (`grep -q REPLACE_WITH_`), :412; app/apps/api/wrangler.toml:11, :16 (echte IDs); deploy.yml:65-68 | Maintainer |
| M-006 | App öffentlich erreichbar (GitHub Pages + Cloudflare Pages) ohne Impressum und Datenschutzerklärung — Beta-Riegel ist noindex, kein Zugangsschutz; § 18 Abs. 1 MStV in der Doku nicht geprüft | high | confirmed | M | A5-001, A5-010 (verwandt) | .github/workflows/pages.yml:1-70; deploy.yml:40-130; kein `VITE_IMPRINT_URL`/`VITE_PRIVACY_URL` in Workflows; App.tsx:1055-1056, :1452-1466; vite.config.ts:89-125; worker.ts:179-189 (IP-Verarbeitung) | Anwalt + Betreiber-Konto |
| M-008 | Keine Sicherung der D1-Daten; Freitext-Feedback (90 Tage, absichtlich ohne Lesepfad) geht bei Kontoverlust real verloren, Heatmap fällt auf Null | high | confirmed | M | A3-002 | grep backup/sicherung/restore → 0 Treffer; scripts/einrichten.sh:1329 (Schrittliste ohne Sicherung); worker.ts:828-858 (Cron nur DELETE/UPDATE); 0001_schema.sql:121-131 | Maintainer |
| M-010 | Kein Runbook, kein RTO/RPO, kein Restore-Test — der Wiederaufbau ist aus vier widersprüchlichen Dokumenten und einem 1.374-Zeilen-Skript rekonstruierbar, sonst nirgends | high | confirmed | M | A3-004 | grep RTO/RPO/notfall/restore → 0; CLAUDE.md „Wo was steht" ohne Notfalldokument; docs/sitzungsstatistik.md:373-378 (Skript lief einmal greenfield); A3 Abschnitt 4 (19 Schritte, 2 „nur im Kopf") | Maintainer |
| M-012 | CI-Token vermutlich das breite Einrichtungs-Token statt des geforderten Zwei-Rechte-Tokens; Token-Rechtelisten dreifach gepflegt, DNS-Rechte zweifach benannt | medium | likely | S | A4-002, A2-004 | docs/hosting.md:21-23, :225-230, :232-238; docs/todo.md:18-20, :83-84; scripts/einrichten.sh:325-326, :461-498, :972-973; Rechteumfang des Secrets nicht prüfbar (403) | Betreiber-Konto + Maintainer |
| M-013 | Alle 22 GitHub-Actions nur auf Major-Tag gepinnt, darunter `cloudflare/wrangler-action@v4` mit dem Cloudflare-Token | medium | confirmed | S | A4-003, A6-006 | .github/workflows/deploy.yml:25, :27, :29, :74, :124; ci.yml:21-25, :38, :65; pages.yml:33-37, :56, :68; dependabot.yml:93-107 (würde SHA-Pins pflegen) | Contributor-geeignet |
| M-014 | `CLIENT_SALT` fehlt still (`?? ''`) — Hash dann ungesalzen; „täglich rotieren" steht im Code und in SECURITY.md, ohne Mechanismus | medium | confirmed | S | A4-005, A5-005, A3-013 (ergänzend: kein Backup nötig) | worker.ts:46-48, :182, :674 (Stichprobe bestätigt); scripts/einrichten.sh:429-443 (prüft nur Existenz); wrangler.toml:24-25 (einziger Cron löscht nur); datenschutz.md:136-141 | Maintainer |
| M-015 | `/visits` ohne Rate-Limit — unbegrenzte Zeilen, D1-Schreibbudget (1.000/Tag Free Tier) erschöpfbar, „heute geöffnet" aufblähbar | medium | confirmed | S | A4-004 | worker.ts:407-445 (kein clientHash/countRecent, anders als :466, :512, :602), :433, :437-442; rejectsCrossSite :199-210 lässt Anfragen ohne Origin durch | Contributor-geeignet |
| M-016 | Hamburg (DL-DE/BY 2.0): Quellenvermerk ohne Datensatz-URI und ohne Änderungshinweis (Geometrien vereinfacht); LICENSE und data-Badge nennen nur Berlin | medium | confirmed | S | A5-006, A6-003, A6-018 | SettingsSheet.tsx:298-317; public/data/hamburg/meta.json (kein datasetUrl/modified); build-data-hamburg.ts:170, :236 + simplify.ts; LICENSE:25-28; build-badges.ts:106; Lizenztext § 2/§ 3 (govdata, abgerufen 6.9.2026) | Contributor-geeignet |
| M-017 | Nach der Kachel-Umstellung fließen Nutzer-IPs weiter an protomaps.github.io (Glyphen, Sprites); DSE sagt, der Abfluss „entfällt" | medium | confirmed | S | A5-003, A4-006 (Teil: Fonts von fremden Hosts) | app/apps/web/src/map-style.ts:71-72, :102; docs/datenschutz.md:153; docs/todo.md:285-289 | Maintainer (+ Anwalt für DSE-Text) |
| M-018 | Werkbericht lädt Google Fonts (fonts.googleapis.com / fonts.gstatic.com) | medium | confirmed | S | A5-004, A4-023 | docs/bericht/index.html:2-4; pages.yml:58 deployt nur app/apps/web/dist (heute nicht ausgeliefert); als Artifact veröffentlicht (neue-sitzung.md:48) | Contributor-geeignet |
| M-019 | DSE weicht an vier Stellen vom Code ab: Votes tragen Client-Hash mit Millisekunden-Zeit und werden nie genullt; Feedback-Hash unerwähnt; acht statt drei localStorage-Schlüssel; Telegram-Hilfetext widerspricht der DSE | medium | confirmed | S | A5-007, A5-016 | worker.ts:618-621 (`Date.now()`), :493-497, :646, :673-676, :828-858 (Cron nullt sightings/feedback, nicht votes — Stichprobe bestätigt); storage.ts:41-46; presence.ts:54; web/city.ts:27; datenschutz.md:30-36, :44-48, :64-67 | Maintainer (+ Anwalt für Formulierung) |
| M-020 | § 25 TDDDG: Tages-Zufallskennung im localStorage dient der Besuchszählung des Betreibers, nicht dem vom Nutzer gewünschten Dienst | medium | likely | S | A5-008 | presence.ts:54, :77-90, :112-126; worker.ts:407-445; datenschutz.md:30-36 (stützt alles auf § 25 Abs. 2 Nr. 2) | Anwalt (technisch Maintainer) |
| M-021 | GitHub erkennt die MIT-Lizenz nicht (`NOASSERTION`) — Ursache ist der deutsche Datenlizenz-Anhang in LICENSE (Ähnlichkeit 82 % statt ≥ 98 %) | medium | confirmed | S | A6-002 | LICENSE:22-31; API repo `license.spdx_id: NOASSERTION`; Diff gegen choosealicense MIT: nur Anhang; docs/badges/licence.svg sagt „MIT" | Contributor-geeignet |
| M-022 | Code of Conduct nennt als Meldeweg einen Platzhalter | medium | confirmed | S | A6-004 | CODE_OF_CONDUCT.md:14 („⟨E-Mail-Adresse des Betreibers eintragen⟩"); community/profile → code_of_conduct „other" | Betreiber-Konto (Adresse) + Contributor-geeignet |
| M-023 | BSD-Lizenzhinweise (MapLibre, pmtiles, pbf u. a.) fehlen im ausgelieferten Bundle | medium | confirmed | S | A6-007 | `pnpm licenses list --prod`: 5× BSD-3, 2× BSD-2; grep @license/Copyright in dist/assets/*.js → 0; kein THIRD-PARTY-NOTICES | Contributor-geeignet |
| M-024 | Betriebsstand (Worker-Deploy, R2, Kacheln, Telegram) in vier Dokumenten widersprüchlich — „R2-Eimer fehlt" gegen „R2 und Kacheln laufen" | medium | likely | S | A1-005, A3-005 (Teil) | docs/hosting.md:21-25, :439; README.md:249-252; docs/todo.md:280, :361; dagegen docs/sitzungsstatistik.md:366 und Commits 3e358c0, 37e4fa2; Produktivsysteme nicht abgefragt | Maintainer |
| M-025 | hosting.md nennt für `VITE_API_BASE` den falschen Ort (Cloudflare-Pages-Umgebungsvariablen) — der Build läuft in GitHub Actions; Ort von `VITE_TILES_URL` fehlt ganz | medium | confirmed | S | A1-010, A3-005 (Teil) | docs/hosting.md:375-380, :472-477; deploy.yml:66-101 (Secret oder Deploy-Ausgabe), :89-96 (`vars.VITE_TILES_URL`) | Contributor-geeignet |
| M-026 | docs/oeffentlich-machen.md: vier überholte Abschnitte, darunter eine Architekturempfehlung („Datenbank je Stadt"), die der getroffenen Entscheidung (Spalte `city`) widerspricht | medium | confirmed | S | A1-006, A3-005 (Teil), A3-004 (Teil) | docs/oeffentlich-machen.md:23-48, :86-90, :165-172; dagegen docs/todo.md:464, docs/hosting.md:394, migrations/0001_schema.sql:42 | Contributor-geeignet |
| M-028 | README behauptet CI-generierte Badges; kein Workflow erzeugt sie, `build`/`security` sind Konstanten, `tests`/`e2e` kommen aus Umgebungsvariablen | medium | confirmed | S | A1-007, A6-015, A2-007 (Teil: Badges automatisieren) | README.md:221-222; grep build-badges in .github → 0; app/packages/ingest/src/build-badges.ts:94-107 | Contributor-geeignet |
| M-029 | README nennt keine Voraussetzungen (Node ≥ 22, pnpm 10 über corepack, Playwright-Browser); pnpm-Warnung „Ignored build scripts" unerklärt | medium | confirmed | S | A1-008, A6-016 (Teil), A6-019 | README.md:169-181; app/package.json:5-7; ci.yml:57 (`playwright install --with-deps`); scripts/einrichten.sh:93-100 (corepack nur dort); A6 Contributor-Messung ≈ 12 s kalt | Contributor-geeignet |
| M-030 | Wurzel-package.json verlangt `pnpm ^12.3.4` — gegen `packageManager: pnpm@10.33.0`, CI (`version: 10`), Dependabot-Support (7–10) und die eigene .gitignore | medium | confirmed | S | A1-009, A2-009, A4-013 (Teil), A6-016 | package.json:1-5 (Stichprobe bestätigt); app/package.json:5; .gitignore:16-21; ci.yml:24; dependabot.yml:44-48; einziger Commit f3b08a3 erwähnt die Datei nicht | Contributor-geeignet |
| M-031 | pages.yml erneuert täglich nur Berliner Daten; hosting.md verspricht „nie älter als 24 Stunden"; `continue-on-error` lässt auch Berlin still altern | medium | confirmed | S | A1-011, A4-020 (Teil) | .github/workflows/pages.yml:44-50; app/packages/ingest/src/build-data.ts:26-28 (bricht für Hamburg ab); docs/hosting.md:132-135 | Contributor-geeignet |
| M-032 | Kein CHANGELOG, keine Releases, keine Tags; Auslieferung ist „jeder Push auf main", Version 0.1.0 ohne Marke | medium | confirmed | S (CHANGELOG) / M (Releases) | A1-012, A6-010 | `ls` Wurzel ohne CHANGELOG; API releases `[]`, tags `[]`; 84 Commits; app/apps/web/package.json:3 | Maintainer |
| M-033 | Drei Stellen empfehlen `npx wrangler` — entgegen der CLAUDE.md-Regel und dem Einrichtungsskript | medium | confirmed | S | A1-013 | docs/hosting.md:460; app/apps/api/migrations/0001_schema.sql:127-128; app/packages/ingest/scripts/build-tiles.sh:18; Regel CLAUDE.md „wrangler immer über den Workspace" | Contributor-geeignet |
| M-035 | Worker-, D1- und Pages-Name je zweimal (wrangler.toml/deploy.yml und einrichten.sh) — Umbenennung muss fünf Stellen treffen | medium | confirmed | S | A2-005, A3-010 (verwandt) | app/apps/api/wrangler.toml:1, :15; scripts/einrichten.sh:154-156; .github/workflows/deploy.yml:128; docs/hosting.md:379 | Contributor-geeignet |
| M-037 | Testzahlen an sieben Stellen gepflegt, drei veraltet (62 / 129 / 129); Regressionszahl „24" (CLAUDE.md) vs. „25" (README) nicht nachzählbar | medium | confirmed (Widerspruch) / unverified (welche Zahl) | S | A2-007, A1-015, A2-021 | README.md:213; CLAUDE.md:228; docs/neue-sitzung.md:32-33; docs/bericht/index.html:226; hardening.test.ts hat 11 `it(`; keine Regressions-Markierung im Testcode | Contributor-geeignet |
| M-038 | DNS der Hauptdomain und Pages-Custom-Domain existieren nur als Klick, nicht als Code — nach Wiederaufbau stünde die Zone leer | medium | confirmed | S | A3-007 | scripts/einrichten.sh:1156-1157 (`continue` für Hauptdomain), :1101-1137; Commit 4fdfe31 („Pages trägt beim Verbinden selbst ein"); docs/todo.md:212-219 | Maintainer |
| M-039 | Cloudflare-Konto und Token nicht inventarisiert (Identität, 2FA, Recovery, Ablaufdaten); Betreiber-Token als Klartextdatei; Rotation des CI-Tokens undokumentiert, Skript kann Secrets nur anlegen, nicht ersetzen | medium | confirmed | S | A3-008, A4-007 | grep 2fa/recovery/passwort-manager in docs → 0; docs/hosting.md:240-242 (Ablauf gefordert, nicht notiert); scripts/einrichten.sh:202-209, :476-487 (`[ -z "$fehlende" ] && return 0`), :971 | Betreiber-Konto + Maintainer |
| M-040 | GitHub-Organisation: Owner, Secrets, Variablen nicht inventarisiert; `VITE_TILES_URL` lebt nur als GitHub-Variable und ist kein Skriptschritt | medium | confirmed | S | A3-009 | .github/workflows/deploy.yml:112-119, :145-149 (Aufzählung ohne VITE_TILES_URL); scripts/einrichten.sh:851-854; docs/todo.md:238-241 | Maintainer |
| M-041 | Feste Namen (`knoellchenfrei.pages.dev`, workers.dev, Org-Name) sind nach einer Löschung möglicherweise nicht wieder verfügbar — ALLOWED_ORIGINS und r2-cors.json hängen daran | medium | unverified | S | A3-010 | scripts/einrichten.sh:153-157; app/apps/api/wrangler.toml:49; r2-cors.json:6; Cloudflare-/GitHub-Richtlinien nicht abrufbar (Egress) | Maintainer |
| M-042 | Bus-Faktor 1 auf jedem Konto (Registrar, Cloudflare, GitHub-Org, BotFather, Claude); SECURITY.md verspricht 3/10-Tage-Fristen ohne Vertretung | medium | confirmed | S (Doku) / M (zweite Person) | A3-017, A6-012 (verwandt) | `git log` → eine menschliche Identität (17 Commits); docs/todo.md:9-10, :86-97, :99-111; SECURITY.md:8-9 | Betreiber-Konto |
| M-027 | docs/architecture.md beschreibt den Stand vor Hamburg und vor dem Umzug (MapLibre 5, 62 Tests, `ParkingZone/`, feste Feiertagsliste, Diagramm ohne Hamburg/Telegram) | medium | confirmed | M | A1-004 | docs/architecture.md:5-34, :24, :78, :144-146, :180, :239-240; core/holidays.ts:97; migrations/0001_schema.sql:42 | Contributor-geeignet |
| M-034 | Berliner Stadtgrenzen stehen dreimal, nicht „genau einmal": `heatmap.ts` (Ursprung und Kosinus fest auf Berlin) und `build-tiles.sh` (BBOX) neben `core/city.ts` | medium | confirmed | M | A2-003 | app/packages/core/src/heatmap.ts:100, :108-109; app/packages/ingest/scripts/build-tiles.sh:33-36 (Kommentar warnt selbst); core/city.ts:89 | Contributor-geeignet |
| M-036 | Kein Formatter, kein Linter, kein shellcheck, kein SAST — nichts erzwungen; einrichten.sh hat 13× SC2015 unter `set -e` | medium | confirmed | M | A2-006, A6-014 | find prettier/eslint/editorconfig/shellcheckrc → 0; ci.yml ohne Lint-Schritt; shellcheck einrichten.sh: 14 Hinweise (u. a. :395, :397, :423, :451); code-scanning/alerts → 403 | Contributor-geeignet |
| M-044 | ci.yml ohne `permissions:`; pages.yml gibt schon dem Build-Job `pages: write` und `id-token: write` | low | confirmed | S | A4-008, A6-011 | .github/workflows/ci.yml (kein Block); pages.yml:17-20; Repo-Default für GITHUB_TOKEN nicht abfragbar (403) | Contributor-geeignet |
| M-045 | Feedback-Rate-Limit durch Stundenrundung plus Cron-NULLing auf Minuten reduzierbar (bis 8 statt 4 pro Stunde) | low | confirmed | S | A4-009 | worker.ts:497 (Stichprobe: auf volle Stunde gerundet), :235-241, :850-854 | Contributor-geeignet |
| M-046 | Stimmen aus der Web-App scheitern am Worker mit 415 (kein Content-Type); Meldungen prüfen den Antwortstatus nicht; keine Worker-Tests | low | confirmed | S | A4-010 | app/apps/web/src/sighting-backend.ts:302-317; worker.ts:200-203, :598-599; packages/core/test deckt worker.ts nicht ab | Contributor-geeignet |
| M-047 | Eigene Meldung kann vom Melder bestätigt werden; der Schema-Kommentar behauptet das Gegenteil | low | confirmed | S | A4-011 | app/apps/api/migrations/0001_schema.sql:45-46; worker.ts:591-634 (kein Vergleich der Hashes) | Contributor-geeignet |
| M-048 | `minimumReleaseAgeExclude: ['*']` hebt den Cooldown für transitive Pakete in Dependabot-PRs auf — die Begründung in der Datei nennt das „Nebenwirkung", A4 „Teil des Schutzes" | low | confirmed (Mechanismus) / offen (Bewertung, siehe W1) | S | A4-012 | app/pnpm-workspace.yaml:31-34, :39-40 (Stichprobe bestätigt); .github/dependabot.yml:57-65 (3/7/21 Tage); CLAUDE.md-Regel übernimmt die Begründung | Maintainer |
| M-050 | R2-CORS erlaubt `localhost`-Origins am Produktiv-Bucket, unbegründet; hosting.md fordert, `ALLOWED_ORIGINS` zu setzen — es ist gesetzt | low | confirmed | S | A4-014, A2-017 | app/apps/api/r2-cors.json:9-10; wrangler.toml:49; docs/hosting.md:315 | Contributor-geeignet |
| M-051 | Telegram-Token und -Secret erscheinen in `curl`-Prozessargumenten von einrichten.sh | low | confirmed | S | A4-015 | scripts/einrichten.sh:531, :571, :665, :695-697 | Contributor-geeignet |
| M-052 | Kein DCO oder CLA für Beiträge Dritter; kein Beitragsprozess (Fork → Branch → PR, Review) beschrieben | low | confirmed | S | A5-009, A6 (Stolperstein 6/7, kein Finding) | CONTRIBUTING.md:1-73; LICENSE:3; `git log` → 0 Signed-off-by | Maintainer |
| M-053 | Impressum-Entwurf zitiert § 18 Abs. 2 MStV (journalistisch-redaktionell) statt Abs. 1 | low | likely | S | A5-010 | docs/impressum.md:27, :43; grep MStV in docs → nur Abs. 2 | Anwalt |
| M-054 | Betroffenenrechte bei Freitext-Feedback: „kein Lesepfad" ist nicht „keine Verarbeitung"; Art.-11-Absatz nennt Feedback nicht, Kontaktweg außerhalb GitHubs fehlt | low | confirmed | S | A5-011 | docs/datenschutz.md:64-79, :170-178; worker.ts:770-826 (kein GET), :493-497, :848-857; SECURITY.md:3-6 | Anwalt + Maintainer |
| M-055 | EU-Jurisdiktion gilt nur für D1, nicht für KV und Worker-Ausführung — hosting.md und DSE überzeichnen | low | likely | S | A5-012 | scripts/einrichten.sh:158, :350-352; app/apps/api/wrangler.toml:10-17; docs/hosting.md:183-185; docs/datenschutz.md:152 | Maintainer |
| M-056 | Workers Observability eingeschaltet, in der DSE nicht erwähnt | low | unverified | S | A5-013 | app/apps/api/wrangler.toml:27-28; grep observab/Workers Logs in docs → 0; datenschutz.md:130-141 | Betreiber-Konto (Dashboard) + Anwalt |
| M-057 | Artifact-Variante: Anthropic als Empfänger fehlt in der DSE; Artifact-`db` ohne Sicherung und an das Claude-Konto des Betreibers gebunden | low | confirmed | S | A5-014, A3-015 | app/apps/web/src/presence.ts:164-200; sighting-backend.ts:336-338; docs/datenschutz.md:76-86; docs/neue-sitzung.md:299-305; docs/hosting.md:74-97 | Maintainer + Anwalt |
| M-058 | `license`-Feld fehlt in allen fünf package.json | low | confirmed | S | A6-008 | app/package.json, apps/web, apps/api, packages/core, packages/ingest — kein `license` | Contributor-geeignet |
| M-059 | Kein CODEOWNERS, keine MAINTAINERS-Angabe | low | confirmed | S | A6-012 | API codeowners/errors → 404; `git ls-files` ohne CODEOWNERS/MAINTAINERS/AUTHORS | Maintainer |
| M-060 | Keine Issues, keine Good-First-Issues; Label `daten` aus data.yml existiert im Repo nicht | low | confirmed | S | A6-013 | API issues → nur 11 Dependabot-PRs; labels ohne `daten`; docs/todo.md mit hunderten offenen Punkten | Maintainer |
| M-061 | Kachelarchiv nur aus dem Protomaps-Wochenfenster reproduzierbar; die lokale 89-MB-Kopie wird nicht als Sicherung behandelt | low | confirmed | S | A3-011 | app/packages/ingest/scripts/build-tiles.sh:64-91; .gitignore:4-10; deploy.yml:117-118 (OSM-Rückfall) | Maintainer |
| M-062 | einrichten.sh: python3 wird 13× gebraucht, aber nicht geprüft und in hosting.md nicht genannt; pmtiles nur über brew — Restore-Pfad hängt am macOS-Rechner | low | confirmed | S | A1-023, A3-012 | scripts/einrichten.sh:25-26, :90-114, :259 (prüft nur node curl openssl git), :571, :608, :665 (Aufrufe mit `2>/dev/null`); docs/hosting.md:199 | Contributor-geeignet |
| M-063 | Umlaut-Schreibweise innerhalb einzelner Dateien gemischt (ä/ö/ü neben ae/oe/ue) | low | confirmed | S | A2-010 | deploy.yml:35 vs. :66; ci.yml:5-6 vs. :90; einrichten.sh:25 vs. :211; pwa.spec.ts:8 vs. :69 | Contributor-geeignet |
| M-064 | Testtitel deutsch/englisch gemischt, auch innerhalb derselben describe-Gruppe | low | confirmed | S | A2-011 | e2e/pwa.spec.ts:36-88; e2e/app.spec.ts:537-588; Unit-Tests durchgehend englisch bei deutschen Kommentaren | Contributor-geeignet |
| M-065 | Bezeichner in neu geschriebenen Dateien deutsch/englisch gemischt | low | confirmed | S | A2-012 | app/apps/web/scripts/make-brand.mjs:38-148; deploy.yml:46-95 | Contributor-geeignet |
| M-066 | Datei- und Ordnernamen zweisprachig ohne erkennbare Regel | low | confirmed | S | A2-013 | docs/ (architecture, data-sources, hosting vs. Rest); docs/bericht vs. docs/brand; screenshots/desktop.png + handy.png | Maintainer |
| M-067 | Commit-Nachrichten: ASCII eingehalten, drei Abweichungen von „deutsch" (ein gemischter Betreff, Dependabot, Merge-Standardtexte) | low | confirmed | S | A2-014 | `git log --format=%s`; d3a8935; 9 „Merge npm_and_yarn/…" | Maintainer |
| M-068 | Copy-Paste in einrichten.sh: getMe zweimal roh trotz `tg_api()`, zwei curl-Zweige in `cf_api()`, `tg_ok` mit dem grep-Muster, das `cf_geklappt` als Fehlerquelle beschreibt | low | confirmed | S | A2-015 | scripts/einrichten.sh:529-533, :571-577, :665-670, :708, :866-873, :886-893 | Contributor-geeignet |
| M-069 | CLAUDE.md: Befehlsblock ohne `cd app` (führt in den .gitignore-Fallstrick), Projektbeschreibung nur Berlin, Regel nennt die entfernte `CITY`-Variable des Workers | low | confirmed | S | A1-020, A2-016 | CLAUDE.md:8-9, :20-27, :36-42, :115-116; .gitignore:21-32; worker.ts:69-75; docs/todo.md:485-486 | Contributor-geeignet |
| M-070 | lint-workflows.yml wird von `.github/**.yml` ausgelöst, prüft aber nur `workflows/*.yml` + dependabot.yml — Issue-Formulare bleiben ungeprüft und grün | low | confirmed | S | A2-018 | .github/workflows/lint-workflows.yml:15-17, :32-35; ISSUE_TEMPLATE/{bug,config,data}.yml | Contributor-geeignet |
| M-071 | README zählt 84 Carsharing-Plätze, die Daten 83 | low | confirmed | S | A1-016 | README.md:27; Counter über public/data/berlin/poi.geojson → carsharing 83; docs/ideen-2012.md:29 | Contributor-geeignet |
| M-072 | README „Aufbau" nennt Vite 7 | low | confirmed | S | A1-017 | README.md:162; app/apps/web/package.json (`vite ^8.2.1`) | Contributor-geeignet |
| M-073 | „fünf Workflow-Dateien" — es sind vier | low | confirmed | S | A1-018 | .github/dependabot.yml:6, :89; docs/entscheidungen.md:211, :265 | Contributor-geeignet |
| M-074 | data-sources.md: doppelte Überschrift (bricht den Anker), „Sämtliche Geodaten … Berlin" neben dem Hamburg-Abschnitt, `python` statt `python3` | low | confirmed | S | A1-019 | docs/data-sources.md:9-10, :87, :197 | Contributor-geeignet |
| M-075 | SECURITY.md beschreibt die Grenzprüfung als „Berliner Bereich"; index.html-Beschreibung nennt nur Berlin, das Manifest beide Städte | low | confirmed | S | A1-021, A1-022 | SECURITY.md:18, :89-90; worker.ts:533 (`cityAt`); app/apps/web/index.html:7 vs. public/manifest.webmanifest:5 | Contributor-geeignet |
| M-076 | Screenshots in README und Installations-Karte ohne Hintergrundkarte, obwohl der Kachelserver wieder erreichbar ist | low | confirmed | S | A1-024 | `git log -- docs/images public/screenshots` → nur f733c36; CLAUDE.md:44; docs/todo.md:520-524 | Contributor-geeignet |
| M-077 | hosting.md Kachel-Abschnitt: irreführender Kommentar über einem Aufruf ohne Datum und verfallenes Beispieldatum `v20260730` | low | confirmed | S | A1-025 | docs/hosting.md:449-450, :454, :476; CLAUDE.md:206-212 | Contributor-geeignet |
| M-078 | `app/scripts/fetch-parkzonen.sh` ist nirgends dokumentiert oder referenziert — zweiter Abrufweg neben fetch.ts | low | confirmed | S | A1-026 | grep fetch-parkzonen über *.md/*.json/*.yml → 0; app/scripts/fetch-parkzonen.sh:1-15 | Maintainer |
| M-079 | Code-Kommentare nennen `fetch` statt `fetch-data` und die nicht existierende `migrations/001-stadt.sql` | low | confirmed | S | A1-027, A3-005 (Teil) | app/packages/ingest/src/fetch.ts:9; app/apps/api/migrations/0001_schema.sql:83 | Contributor-geeignet |
| M-080 | staedte.md widerspricht sich innerhalb eines Abschnitts (Tabelle „ja" direkt vor dreimal „Erledigt", „Zwei sind erledigt") | low | confirmed | S | A1-028 | docs/staedte.md:230-269; docs/oeffentlich-machen.md:144-155 (dieselbe Tabelle, anders) | Contributor-geeignet |
| M-081 | neue-sitzung.md: Kachelserver-Aussage überholt, Abschnitt gibt sich als aktuell | low | confirmed | S | A1-029 | docs/neue-sitzung.md:65-67; CLAUDE.md:44 | Contributor-geeignet |
| M-082 | hosting.md beschreibt den Inhalt der wrangler.toml unvollständig | low | confirmed | S | A1-030 | docs/hosting.md:246-248; app/apps/api/wrangler.toml:3, :21, :27-28 | Contributor-geeignet |
| M-043 | Keine Content-Security-Policy, keine Sicherheits-Header (kein `_headers`, kein nosniff im Worker) | low | confirmed | M | A4-006 | app/apps/web/index.html:1-27; kein public/_headers; worker.ts:160-165; positiv: keine innerHTML-Senken, `setHTML` mit escapeHtml (App.tsx:67-73, :528-532) | Contributor-geeignet |
| M-049 | `protomaps-themes-base` ist deprecated (→ `@protomaps/basemaps`); Major-Rückstand bei vitest (3 → 5), MapLibre 6.4 → 6.7 | low | confirmed | M | A4-013 (Teil), A6-017 | `pnpm outdated -r`; app/pnpm-lock.yaml:1543; app/apps/web/package.json:18 (exakt gepinnt, Dependabot schlägt nichts vor); docs/hosting.md:488 | Contributor-geeignet |
| M-084 | E2E-Lauf 107 bestanden / 1 übersprungen stimmt mit README, CLAUDE.md und Badge überein — zwei Tests hängen an Wochentag/Uhrzeit, was die Doku nicht sagt | info | confirmed | S | A1-032 | e2e/app.spec.ts:219, :278, :291 (bedingte Skips); A2: `playwright test --list` → 108 | Contributor-geeignet |
| M-085 | Glyph-Pfad in make-icons.mjs und make-brand.mjs bewusst dupliziert — Begründung tragfähig, aber ohne Riegel | info | confirmed | S | A2-019 | app/apps/web/scripts/make-icons.mjs:28-29; make-brand.mjs:34-39 | Contributor-geeignet |
| M-088 | Klon-Refs: Arbeitsbranch `claude/parkingzone-migration-18g8fo` = `origin/main` = fceadca; lokale Ref `main` fehlt (A3 sah auch kein `origin/main`, siehe W5) | info | confirmed | S | A2-023, A3-016 | Stichprobe 7.9.2026: `git branch -a` → `remotes/origin/main` vorhanden, `git rev-parse main` → fatal | Maintainer |
| M-089 | KV ist reiner TTL-Cache — nichts zu sichern | info | confirmed | S | A3-014 | worker.ts:249-256, :292 | — |
| M-090 | KV-/D1-Kennungen im Repository sind keine Geheimnisse — Einschätzung des Projekts trägt; alte Kennung in todo.md ist stale | info | confirmed | S | A4-016 | wrangler.toml:11, :16; docs/todo.md:40; Historie c38e271 | Contributor-geeignet |
| M-091 | Secret-Scan im CI ist eine schwache Regex (fängt keine Cloudflare-/Telegram-Token); GitHub Secret Scanning/Push Protection nicht prüfbar | info | unverified | S | A4-017 | ci.yml:96; /secret-scanning/alerts → 403; docs/oeffentlich-machen.md:45-48 | Betreiber-Konto + Contributor-geeignet |
| M-092 | Fehlermeldungen von Upstream und Laufzeit werden nach außen gereicht (502-`detail`, ErrorBoundary `<pre>`) | info | confirmed | S | A4-018 | worker.ts:285-289; app/apps/web/src/components/ErrorBoundary.tsx:40 | Contributor-geeignet |
| M-093 | Supply-Chain-Basis solide (Lockfile, frozen-lockfile, pnpm 10 ohne Build-Skripte, nur npmjs/jsr); keine SBOM, keine Provenance | info | confirmed | S | A4-019 | ci.yml:30, :61, :88; deploy.yml:37; pages.yml:42; pnpm-lock.yaml lockfileVersion 9.0, 341 integrity | — |
| M-095 | `VITE_API_BASE` als Secret statt `vars` — öffentlicher Wert wird maskiert, erschwert Diagnose; kein Leck | info | confirmed | S | A4-021 | deploy.yml:85-103, :137 | Contributor-geeignet |
| M-097 | CORS-Randfall: ohne `Origin` und ohne `ALLOWED_ORIGINS` steht ein leerer Eintrag in der Allowlist; sonst exakter Abgleich mit `Vary: Origin` | info | confirmed | S | A4-024 | worker.ts:146-158, :199-210 | Contributor-geeignet |
| M-099 | pnpm-Warnung „Ignored build scripts: esbuild, workerd" beim ersten Install ist nirgends erklärt | info | confirmed | S | A6-019 | Install-Log frischer Klon; app/pnpm-workspace.yaml ohne `ignoredBuiltDependencies` | Contributor-geeignet |
| M-100 | Community-Profil zählt die Issue-Formulare nicht (`issue_template: null` trotz drei Dateien); Ursache nicht ermittelt | info | unverified | S | A6-020 | API community/profile; .github/ISSUE_TEMPLATE/{bug,config,data}.yml | Betreiber-Konto |
| M-101 | Dokumentation ausschließlich Deutsch (OpenSSF `english` SHOULD) | info | confirmed | S | A6-021 | README, CONTRIBUTING, SECURITY, CoC, Templates durchgehend deutsch | Contributor-geeignet |
| M-102 | Nicht bei OpenSSF Scorecard oder Best Practices registriert; Handbewertung: erfüllt 6, teilweise 4, nicht 7, n/a 2, unverified 3 | info | confirmed | S | A6-022 | api.securityscorecards.dev → 404; bestpractices.dev → [] | Maintainer |
| M-094 | Täglicher Pages-Build zieht Behördendaten und rollt sie ungeprüft aus (bewusst akzeptiert); nur Parser-Abbruch, keine Plausibilitätsgrenzen | info | confirmed | M | A4-020 | pages.yml:13-14, :44-50, :52-54 | Contributor-geeignet |
| M-083 | Externe Links: Stichprobe ohne tote Links; gdi.berlin.de nur mit certifi-Bundle erreichbar (bestätigt README und Zonenzahl 103) | info | confirmed | — | A1-031 | `curl -I -L` über Proxy; github.com-Links wegen Egress-403 nicht bewertbar | — |
| M-086 | Kommentarsprache im Bestand gemischt — konventionskonform (deutsch bei neuem Code, englischer Bestand bleibt) | info | confirmed | — | A2-020 | worker.ts (de 236 / en 118), App.tsx (112 / 327); alle nach dem Umzug neuen Dateien rein deutsch | — |
| M-087 | Worker-Adresse mit Konto-Slug (`knoellchenfrei-api.<slug>.workers.dev`, Wert im Bericht ausgeschrieben) im Werkbericht, Platzhalter in hosting.md — von A2 an A4 weitergegeben, von A4 nicht bewertet | info | confirmed | — | A2-022 | docs/bericht/index.html:878; docs/hosting.md:379; A4-Secrets-Inventar führt den Slug nicht | Maintainer |
| M-096 | Git-Historie sauber: 84 Commits ab Orphan f733c36, keine Token-Muster, 2012er-Passwort nicht enthalten; Wurzel-Lockfile einmal versehentlich committet (edb23a3) | info | confirmed | — | A4-022 | `git log --all -S` für ghp_/AKIA/BEGIN/sk-/github_pat_ → 0; Altrepository herbeus/parkingzone existiert weiter | — |
| M-098 | Rechtlich in Ordnung (belegt): keine externen Skripte/Cookies/Analytics, Badges selbst erzeugt, Haftungsausschluss dreifach, OSM-Attribution, DL-DE/Zero korrekt, Gesetzesverweise aktuell (DDG/TDDDG/MStV), Standortabfrage nur auf Aktion, Beta-Riegel getestet | info | confirmed | — | A5-015 | index.html:1-27; build-badges.ts:1-9; App.tsx:1431-1434; map-style.ts:79, :105; core/city.ts:95; e2e/pwa.spec.ts:257-265 | — |

## Widersprüche zwischen Agents

Nicht aufgelöst, sondern nebeneinandergestellt. Stichproben sind eigene
Dateiaufrufe vom 7. September 2026 gegen `fceadca`.

### W1 — `minimumReleaseAgeExclude: ['*']`: Nebenwirkung oder Teil des Schutzes?

- **Position A (A4-012, low, confirmed):** Dependabot filtert serverseitig nur die *direkt* aktualisierte Version; pnpm löst den Rest des Baums ohne Altersprüfung auf. Der „restliche Baum ist nicht Nebenwirkung, sondern der Teil des Schutzes, der jetzt fehlt." Evidenz: `app/pnpm-workspace.yaml:31-34`, `.github/dependabot.yml:57-65`.
- **Position B (CLAUDE.md-Regel, `pnpm-workspace.yaml:31-34`; von A1 und A2 unkommentiert übernommen):** „Dependabots eigene Wartezeit bleibt wirksam … Aufgehoben wird also nur die Nebenwirkung auf den restlichen Baum, nicht der Schutz."
- **Stichprobe:** Beide Zitate stimmen wörtlich. Über den *Mechanismus* sind sich beide Seiten einig (Dependabot wählt die direkte Version, pnpm schreibt das Lockfile); sie bewerten nur anders, ob transitive Neuauflösungen in einem Dependabot-PR schutzwürdig sind. Kein Agent hat einen Dependabot-Lockfile-Diff auf tatsächlich neu hereingekommene, junge transitive Pakete geprüft — die Größe des Fensters ist unbelegt.
- **Wer entscheidet:** Maintainer (Risikoakzeptanz). Prüfbar am nächsten Dependabot-PR: Lockfile-Diff auf neue Pakete und deren Alter.

### W2 — `CLIENT_SALT`: „braucht kein Backup" gegen „nie rotiert, Fehlen nicht erzwungen"

- **A3-013 (info):** Verlust oder Wechsel des Salzes ist folgenlos — Hashes werden nach 1 h genullt; nichts zu sichern. Evidenz: `worker.ts:830-835, :851-853`, `einrichten.sh:427-435`.
- **A4-005 / A5-005 (medium):** `env.CLIENT_SALT ?? ''` läuft ohne Salz still weiter (dann ist der Hash ein IP-Pseudonym, gegen die DSE); „täglich rotieren" steht im Code, ohne Mechanismus. Evidenz: `worker.ts:46-48, :182, :674`.
- **Stichprobe:** `worker.ts:182` und `:674` enthalten `?? ''`; `:46-48` verlangt tägliche Rotation; `scheduled()` (`:828-858`) rotiert nichts. A3 sagt selbst „tägliche Rotation ist vorgesehen, aber nicht automatisiert".
- **Befund:** Kein Widerspruch — zwei Aussagen auf zwei Ebenen. A3: Der *Wert* ist entbehrlich (DR). A4/A5: Das *Vorhandensein* wird nicht erzwungen und die *Zusage* nicht eingelöst. Beide gelten; zusammengeführt in M-014 mit A3-013 als Ergänzung. Nichts zu entscheiden.

### W3 — Coverage-Zahlen sind je Agent anders gerechnet

| Agent | Bezugsmenge | „geprüft" heißt | Prozent |
| --- | --- | --- | ---: |
| A1 | 127 „relevante" (doc, ci, config, code) | vollständig gelesen oder gezielt gegen eine Doku-Aussage abgefragt | 57 % |
| A2 | 176 | von Hand gelesen **oder** durch drei Stil-/Grenzen-Skripte gelaufen (alle 82 Code-Dateien) | 79 % |
| A3 | 176 | gelesen oder nach DR-Inhalt durchsucht | 23 % |
| A4 | 176 | vollständig/gezielt (67) plus Senken-Grep (16, getrennt ausgewiesen) | 38 % (47 %) |
| A5 | 176 | gelesen auf Rechtstexte, Datenflüsse, Fremdadressen | 37 % |
| A6 | 176 | gelesen **oder** per Lizenz-Header-Grep (alle 82 Code) bzw. `file --mime` (alle 39 Assets) | 90 % |

Nicht vereinheitlicht: Dieselbe Datei (`core/tariff.ts`) ist bei A2 und A6
„geprüft", bei A1, A4, A5 „übersprungen" — inhaltlich gelesen hat sie keiner
(siehe Gesamtsicht unten). Die Prozentzahlen sind nur innerhalb eines Agents
vergleichbar. Wer entscheidet: der Leser des Reports; deshalb steht unten die
Gesamtsicht über die 176 Dateien.

### W4 — A4 „Datensparsamkeit umgesetzt wie dokumentiert" gegen A5 „vier DSE-Abweichungen"

- **A4 (Positiv-Liste):** Rundung 1e-4, 5-Minuten-Bucket, Stunden-Bucket Feedback, `client_hash → NULL` nach 1 h, Löschjobs — „umgesetzt wie dokumentiert". Evidenz: `worker.ts:213-215, :497, :572-575, :832-857`.
- **A5-007 (medium):** DSE nennt bei Votes nur „Zähler" (Code: Hash + Millisekunden, nie genullt), bei Feedback keinen Hash, drei statt acht localStorage-Schlüssel; Telegram-Hilfetext sagt weniger als die DSE. Evidenz: `worker.ts:618-621, :493-497, :646, :673-676`; `storage.ts:41-46`; `datenschutz.md:30-36, :44-48, :64-67`.
- **Stichprobe:** `worker.ts:621` bindet `Date.now()` für `voted_at`; `:497` rundet Feedback auf die Stunde; `scheduled()` nullt `sightings` und `feedback`, **nicht** `votes`. Alles, was A4 als umgesetzt nennt, ist umgesetzt; alles, was A5 als fehlend nennt, fehlt.
- **Befund:** Beide haben recht, auf verschiedenen Ebenen. A4 hat die Maßnahmen aus SECURITY.md/CLAUDE.md gegen den Code geprüft (Mechanismen existieren). A5 hat die DSE gegen den Code auf *Vollständigkeit* geprüft (Text nennt nicht alles, was gespeichert wird) — und mit `votes` einen Datensatz gefunden, den A4s Liste nicht abdeckt. A5-016 sagt das selbst: „stimmen überein — mit einer Ausnahme (Votes)". Wer entscheidet: Maintainer (votes bucketen und nullen, M-019), Anwalt (DSE-Formulierung).

### W5 — Gibt es `origin/main` im Klon?

- **A3-016:** „`git branch -a` → remotes nur Arbeits- und Dependabot-Branches; kein `main`, kein `origin/main`".
- **A2-023 / A4:** „`git rev-parse --short origin/main` → fceadca", „`git log origin/main..HEAD` leer".
- **Stichprobe 7.9.:** `remotes/origin/main` ist vorhanden und zeigt auf fceadca; eine *lokale* Ref `main` fehlt (`fatal: Needed a single revision`). A3s Beobachtung passt zu einem früheren Fetch-Stand oder einem anderen Klon (A6 hat im Scratchpad geklont). A3s Empfehlung (`git clone --mirror` für eine Sicherung) gilt unabhängig davon. Wer entscheidet: niemand; erledigt, vermerkt in M-088.

### W6 — Registrar: INWX oder „ein anderer Anbieter"? (innerhalb von A3)

- `docs/entscheidungen.md:38-43`: „Registrar-Empfehlung war INWX … Gekauft wurde bei einem anderen Anbieter; das ist unerheblich."
- Commit `4fdfe31`: „drei A-Einträge auf 185.181.104.242 …, die INWX-Parkseite" — A3-001 schließt daraus: der Registrar *ist* INWX.
- **Stichprobe:** Beide Texte stimmen wörtlich. Die Quellen widersprechen sich; A3s Schluss ist plausibel (Parkseiten-IP), aber nicht belegt. Das ändert nichts an M-001 — es verschärft es: Nicht einmal der Name des Registrars ist konsistent dokumentiert. Wer entscheidet: Betreiber (weiß es), trägt es in die Doku ein.

### W7 — Kleinere Abweichungen, per Stichprobe geklärt

| Punkt | A | B | Stichprobe |
| --- | --- | --- | --- |
| Branch-Schutz Confidence | A4-001 „confirmed" (Branch-Liste `protected: false`) | A6-005 „likely" (`/protection` → 403) | A4s Beleg ist der stärkere; kein Widerspruch in der Sache. M-002 führt beide. |
| Autoren-Zählung | A2-014 „Claude 50, Thomas Kamann 17" | A6-005 „claude 54, herbeus 17" | `git log --format=%an` über alle 84 Commits: Claude 54, Thomas Kamann 17, dependabot 11, github-actions 2. A2 hat mit `-80` nur 80 Commits gezählt. |
| CONTRIBUTING-Zeilen | A1-003 „:6", „:59" | A2-002/A6-009 „:8", „:62" | `grep -n`: 62 Tests steht in Zeile 8, `fetch` in Zeile 62. A1 ist um 2–3 Zeilen versetzt; Inhalt identisch. |
| A4-Findingzahl | A4-Zusammenfassung „22 (8 low)" | IDs A4-001 … A4-024 | 24 Findings, davon 10 low. Dieser Report rechnet mit 24. |
| Google Fonts Severity | A5-004 medium | A4-023 info | Beide sagen: heute nicht ausgeliefert, als Artifact veröffentlicht. Höchste Severity behalten (M-018). |

Offene Übergabe: A2-022 hat den Konto-Slug in der Worker-Adresse des
Werkberichts an A4 weitergereicht; A4s Secrets-Inventar führt ihn nicht. Keine
Bewertung liegt vor (M-087).

## Coverage-Tabelle je Agent

| Agent | Bezugsmenge (wie vom Agent definiert) | geprüft | übersprungen | nicht erreicht | Prozent |
| --- | --- | ---: | ---: | ---: | ---: |
| A1 Dokumentation | 127 relevante Dateien (doc 16, ci 9, config 20, code 82); Assets nur Existenz, legal an A5/A6 | 72 | 55 | 0 | 57 % |
| A2 Konsistenz | 176 | 139 | 37 (Lockfile, hamburg/meta.json, 3 Fixtures, 32 Assets) | 0 | 79 % |
| A3 Blackout | 176 | 41 | 135 (39 Assets, 74 Code, 12 Config, 4 CI-Vorlagen, 2 Doc, 2 Legal, 2 Other) | 0 (extern: developers.cloudflare.com gesperrt) | 23 % |
| A4 Security | 176 | 67 (+16 nur Grep) | 93 (39 Assets, 36 Code, 10 Config, 5 Doc, 3 Legal) | 0 (extern: 6 GitHub-Endpunkte 403) | 38 % (47 % mit Grep) |
| A5 Rechtlich | 176 | 65 | 111 (50 Code, 33 Assets, 18 Config, 7 CI, 3 Doc) | 0 | 37 % |
| A6 Open Source | 176 | 159 | 17 (4 Doc, 8 Config, 3 IaC, 2 Other) | 0 (extern: 4 GitHub-Endpunkte 403) | 90 % |

### Gesamtsicht über die 176 Dateien

**Von keinem Agent inhaltlich geprüft — not reached (audit-weit), nach den sechs
Coverage-Tabellen (überall als übersprungen geführt):** 3 Dateien.

| Datei | Klasse | Bemerkung |
| --- | --- | --- |
| `app/packages/core/test/fixtures/hh-bewohnerparkgebiete-2026-09-06.json` | config | Von A5-006 als Lizenzfrage *benannt* (Weitergabe unter DL-DE/BY 2.0), Inhalt nicht gelesen |
| `app/packages/core/test/fixtures/parkzonen-2026-09-06.json` | config | — |
| `app/packages/core/test/fixtures/zone-geometry-sample.json` | config | — |

Ob sie unkritisch sind, ist nicht bewertet; es sind Rohdaten aus Behörden-Feeds,
und A5-006 stellt für die Hamburger Datei eine Lizenzfrage, ohne sie geöffnet zu
haben.

**Nur durch automatisierte Läufe berührt, von keinem Agent gelesen.** A2 und A6
zählen alle 82 Code-Dateien als „geprüft", weil Stil-Skripte bzw. ein
Lizenz-Header-Grep über sie liefen; A6 zählt alle 39 Assets, weil `file --mime`
sie klassifiziert hat. Aus den *benannten* Leselisten der sechs Reports
abgeleitet, hat folgende 57 Dateien niemand geöffnet (Herleitung: Skript im
Scratchpad, Listen aus den Coverage-Abschnitten):

| Gruppe | Dateien | Was darüber lief |
| --- | --- | --- |
| Core-Fachlogik (8) | `core/src/berlin-time.ts`, `geo.ts`, `hamburg.ts`, `index.ts`, `parse-fee.ts`, `parse-schedule.ts`, `quiet-day.ts`, `tariff.ts` | A2 Stil-Skripte, A6 Header-Grep. A4 nennt ausdrücklich: „ReDoS-Grenzen laut SECURITY.md nicht nachgemessen". `hamburg.ts` ist der zweite Parser, der laut CLAUDE.md nie mit dem Berliner verschmelzen darf — sein Inhalt ist ungeprüft. |
| Web-Module (4) | `web/src/format.ts`, `globals.d.ts`, `styles.css`, `types.ts` | A2 Stil-Skripte, A6 Header-Grep; A4 hat sie ausdrücklich übersprungen |
| Web-Komponenten und -Module (11) | `HeatPanel`, `InstallHint`, `LiveStats`, `ParkingTimer`, `QuietDayNote`, `SearchBox`, `SightingPanel`, `UpdateBar`, `main.tsx`, `useZoneStatus.ts`, `zones.ts` | zusätzlich A4 Senken-Grep (innerHTML/eval/fetch/target) — eine Sicherheitsprüfung, keine inhaltliche |
| Unit-Tests (10) | `feedback`, `geo-real`, `geo`, `hamburg`, `heatmap`, `holidays`, `parse-real-data`, `quiet-day`, `sighting`, `tariff` (`.test.ts`) | A2 nur die Titel (Sprache), A1 nur gezählt |
| PNG (17) | alle Icons, Screenshots, Brand- und Doku-Bilder | A6 `file --mime`, A1 Existenz. Binär; A1-024 stellt fest, dass sie ohne Hintergrundkarte sind — aus CLAUDE.md, nicht aus dem Bild. |
| GeoJSON (7) | alle außer `berlin/poi.geojson` (A1 hat dort die Kinds gezählt) | A6 über `meta.json` (Herkunft), nicht die Datei; A6-003 nennt Größen |

Die drei Fixtures kommen dazu: **60 von 176 Dateien** wurden inhaltlich von
niemandem gelesen. Nicht in dieser Liste, aber dünn: `core/src/holidays.ts` (nur
A1, gegen die architecture.md-Aussage), `core/src/heatmap.ts` (A2 Grenzen-Teil,
A5 Zellgröße), `ingest/src/simplify.ts` (nur A5, zur Lizenzfrage).

## Nicht prüfbar / Annahmen getroffen

**Nicht erreichbar aus der Umgebung**

| Was | Wer | Folge |
| --- | --- | --- |
| `developers.cloudflare.com` (EGRESS_BLOCKED) | A3 | D1 Time Travel, `d1 export`, Wiederverwendung gelöschter `pages.dev`-/`workers.dev`-Namen: unverified (M-041) |
| GitHub `/actions/secrets`, `/actions/permissions/workflow`, `/dependabot/alerts`, `/secret-scanning/alerts`, `/branches/main/protection`, Environments (403) | A4, A6 | Namen und Rechteumfang der Secrets, GITHUB_TOKEN-Default, Secret-Scanning-Status, klassischer Branch-Schutz: unverified (M-012, M-044, M-091); `/code-scanning/alerts` 403 (M-036) |
| `knoellchenfrei/.github`-Repository (403) | A6 | Profil-README nicht gegen docs/org-profil.md geprüft |
| `github.com/…`-Links, community.cloudflare.com (Egress-403) | A1 | Link-Stichprobe für diese Ziele nicht bewertbar |
| `api.telegram.org` | A2, A3 | Welcher Bot-Name stimmt: unverified (M-011) |
| Cloudflare-Dashboard (DPA-Status, D1-Jurisdiktion, Workers-Logs-Felder, Token-Ablauf) | A5, A4, A3 | M-007, M-055, M-056, M-039 bleiben in ihrer Tatsachenbasis offen |
| Produktivsysteme (Worker, Pages, D1, R2, Telegram, GitHub-Pages-Adresse) | alle, auftragsgemäß | Betriebsstand (M-024) nur aus Doku und Commits; A5-001 „öffentlich erreichbar" aus Workflows und todo.md abgeleitet, nicht per Aufruf |
| Alter Stand (129 Tests / 91–93 E2E) | A2 | nicht mehr auscheckbar (M-037) |

**Als `unverified` oder `likely` markiert:** M-001 (Registrar-Identität), M-002
(A6-Anteil), M-011 (Bot-Name), M-012 (Token-Umfang), M-020 (§ 25 TDDDG),
M-024 (Betriebsstand), M-030 (A2: likely), M-037 (24 vs. 25), M-041, M-053,
M-055, M-056, M-091, M-100; A6-Scorecard: Contributors, Webhooks,
Vulnerabilities.

**Annahmen der Agents**

- `fceadca` entspricht `origin/main` — von A2 und A4 verifiziert, von allen übernommen (W5).
- A1: Badges sind nicht CI-generiert — per grep über `.github/` belegt, nicht per Actions-Log.
- A3: RTO 3–5 h ist aus dem Skript und der Doku *geschätzt*; das Skript lief laut sitzungsstatistik.md genau einmal, greenfield, mit acht Fehlbefunden. Nie als Wiederaufbau geprobt.
- A4: Das CI-Token ist das breite Token — aus hosting.md:21-23 und todo.md:83-84 geschlossen („um Workers Scripts:Edit *ergänzt*"), nicht aus dem Secret.
- A5: `CLIENT_SALT` ist in Produktion gesetzt, weil einrichten.sh es setzt — nicht prüfbar; die DSE-Aussage „keine IP rekonstruierbar" hängt daran (M-014).
- A5: Rechtsquellen (DDG, MStV, TDDDG, DL-DE) wurden am 6.9.2026 abgerufen, nicht aus dem Gedächtnis zitiert; die Bewertung ist ausdrücklich keine Rechtsberatung — acht Punkte sind „zu klären mit Anwalt" (M-006, M-007, M-018 falls öffentlich, M-020, M-053, M-054; dazu § 23 StVO und § 52 AO aus der Doku selbst).
- A6: `tsconfig.base.json` mit strict-Flags laut CLAUDE.md angenommen, nicht gelesen; Playwright-Suite nicht gelaufen (A1 hat sie gefahren: 107/1).
- A6: Scorecard-Tabelle ist eine Handbewertung nach `docs/checks.md`, kein Scan.
- Dieser Report: Die Gesamtsicht über 176 Dateien leitet „gelesen" aus den *benannten* Listen ab; wo ein Agent Dateien nur summarisch nannte („übrige Komponenten"), wurde die Restmenge rechnerisch bestimmt. Fehler in dieser Ableitung gehen zulasten dieses Reports, nicht der Agents.

## Methodik

Read-only gegen `fceadca`; einzige Schreibung ist `audit/REPORT.md`, keine
Netzanfragen. Alle 134 Findings tragen dasselbe Schema (ID, Titel, Severity,
Confidence, Evidenz als `pfad:zeile`, Wirkung, Empfehlung, Aufwand); jeder Report
hat eine Coverage-Tabelle über dieselben 176 Dateien. Dedup-Regel: gleiche
Sache über Agents hinweg → eine `M-NNN`, höchste Severity bleibt, alle
Ursprungs-IDs verlinkt, „(Teil)" wo ein Ursprungs-Finding mehrere Sachen
bündelte; keine Neubewertung, Stichproben nur bei Widersprüchen und für die
Zeilenangaben der Top-10. Ein Contributor kann die Spalte „Zuständigkeit"
filtern: 49 Findings sind *Contributor-geeignet* — abgegrenzt, ohne Konto,
mit Evidenz und Empfehlung als Arbeitsauftrag; die Ursprungs-IDs führen zum
vollen Wortlaut in `audit/A1-…A6-*.md`.
