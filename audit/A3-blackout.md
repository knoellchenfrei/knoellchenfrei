# A3 — Blackout / Disaster Recovery

Agent A3 des Multi-Agent-Audits. Reine Dokumenten- und Konfig-Analyse gegen
`knoellchenfrei/knoellchenfrei`, Commit `fceadca` (lokaler Arbeitsbranch
`claude/parkingzone-migration-18g8fo`, Merge mit `origin/main`; siehe A3-016).
Kein Live-Test, keine Anfrage an Produktivsysteme, kein `wrangler`-Aufruf.
Die Cloudflare-Dokumentation (`developers.cloudflare.com`) war vom
Egress-Proxy gesperrt (`EGRESS_BLOCKED`); alles, was sich nur daraus belegen
ließe, ist als `unverified` markiert.

**Szenario:** Cloudflare-Konto (Worker, D1, KV, R2, Pages, Zonen) und die
GitHub-Organisation sind weg. Es bleiben ein lokaler Klon und der Rechner des
Betreibers.

## Zusammenfassung

1. **Der Code und die Anlegelogik sind gut abgedeckt** — `scripts/einrichten.sh` legt KV, D1, Migrationen, Pages-Projekt, Salz, CI-Secrets, R2 samt CORS und Domain, fünf Zonen, Redirect Rules und die DNS-Einträge der Weiterleitungsdomains an. Datensnapshots liegen im Repository, das Kachelarchiv ist aus einer öffentlichen Quelle reproduzierbar.
2. **Daten werden nirgends gesichert.** Für D1 gibt es keinen Export, kein Ziel, keinen Zeitplan. Das ist für Sichtungen (90 min) und Besuche (2 Tage) per Design belanglos, für die Heatmap (28 Tage) ein Rückfall auf Null, für Freitext-Feedback (90 Tage, absichtlich ohne Lesepfad) ein echter Verlust.
3. **Es gibt kein Runbook, kein RTO/RPO, keinen Restore-Test.** Der Wiederaufbau ist aus vier Dokumenten rekonstruierbar, die sich in ihrem „Stand"-Teil widersprechen und an drei Stellen auf Gelöschtes verweisen (Setup-Workflow, `migrations/001-stadt.sql`).
4. **Das Einrichtungsskript würde nach einem Blackout die Datenbank nicht neu anlegen**, weil es „Kennung steht in `wrangler.toml`" als „existiert" liest — der Wiederaufbau beginnt mit einem Handgriff, der nirgends steht.
5. **Die Domains sind das einzige nicht reproduzierbare Gut** — und der Registrar steht nur in einer Commit-Nachricht, Auto-Renew ist offen, ein zweiter Zugang existiert nicht.
6. **Bus-Faktor 1** für jedes Konto: Registrar, Cloudflare, GitHub-Org, Telegram, Impressum-Dienstleister. Die Git-Historie kennt genau eine menschliche Identität.
7. Geschätzter RTO aus der Doku: **3–5 Arbeitsstunden** bis die App auf `*.pages.dev`/`*.workers.dev` läuft, **24–48 h** bis die eigenen Domains aktiv sind. Nirgends dokumentiert, nie geprobt.

Findings: 1 critical, 4 high, 6 medium, 2 low, 4 info (17).

## 1. Ressourcen und Automatisierungsgrad

Legende: `automated` = läuft ohne Mensch (Workflow, Cron); `scripted` = ein
Skript tut es, ein Mensch stößt an; `manual` = nur Klick oder Chat, aber
dokumentiert; `undefined` = weder Code noch Doku sagt, wie es entsteht.

| Ressource | Grad | Beleg | Bemerkung |
| --- | --- | --- | --- |
| Cloudflare-Konto | manual | `docs/oeffentlich-machen.md:68`, `docs/todo.md:17` | Konto-Identität (E-Mail, 2FA, Recovery-Codes) nirgends dokumentiert → A3-008 |
| API-Token Betreiber (Rechte) | manual, Rechte dokumentiert | `docs/hosting.md:224-230`; Skript prüft Annahme `scripts/einrichten.sh:980` | Ablaufdatum gefordert (`hosting.md:242`), aber nicht notiert |
| API-Token CI (2 Rechte) | manual erzeugen, scripted hinterlegen | `docs/hosting.md:232-238`; `scripts/einrichten.sh:461-501` | Wert nur im GitHub-Secret; nach Blackout ohnehin ungültig |
| `CLOUDFLARE_ACCOUNT_ID` | scripted | `scripts/einrichten.sh:490-493` | aus `wrangler whoami` |
| KV-Namespace `CACHE` | scripted | `scripts/einrichten.sh:335-346` | reiner TTL-Cache, nichts zu sichern (`worker.ts:249-292`) → A3-014 |
| D1-Datenbank (EU) | scripted | `scripts/einrichten.sh:158,348-361` | `--jurisdiction eu` im Skript verankert |
| D1-Schema | automated (Migrationen) | `app/apps/api/migrations/0001_schema.sql`; `einrichten.sh:363-383` | nur eine Migrationsdatei; Verweis auf `001-stadt.sql` ins Leere → A3-005 |
| **D1-Daten** | **undefined** | grep ohne Treffer (Abschnitt 2) | kein Export, kein Backup → A3-002 |
| Worker-Code / Deploy | automated | `.github/workflows/deploy.yml:71-78` | Cron-Trigger in `wrangler.toml:24-25` |
| `CLIENT_SALT` | scripted, bewusst nicht gesichert | `einrichten.sh:427-442` | Verlust folgenlos → A3-013 |
| `TELEGRAM_TOKEN` | manual (BotFather) + scripted setzen | `einrichten.sh:652-679` | existiert nur im Worker → A3-006 |
| `TELEGRAM_SECRET` | scripted | `einrichten.sh:678,680` | Zufall, bei Restore neu |
| Telegram-Webhook | scripted | `einrichten.sh:695-703` | Worker-Adresse aus `deployments list` (`:741-746`) |
| Telegram-Bot-Profiltexte | scripted | `einrichten.sh:519-556` | About, Beschreibung, Befehlsmenü |
| Telegram-Bot-Bilder, `/setjoingroups`, `/setprivacy` | manual, geprüft vom Skript | `einrichten.sh:558-601`; `docs/marke.md:77-87` | |
| Telegram-Gruppen (4 Namen) | manual | `docs/todo.md:350-360` | welche angelegt sind, ist unbekannt → A3-006 |
| Pages-Projekt | scripted | `einrichten.sh:415-424` | |
| Pages-Deploy | automated | `deploy.yml:122-128` | |
| `VITE_API_BASE` | automated (aus Deploy-Ausgabe) | `deploy.yml:84-103` | `hosting.md:376-380` nennt stattdessen Pages-Env-Var → A3-005 |
| `VITE_TILES_URL` | manual (GitHub-Variable) | `deploy.yml:119`; `einrichten.sh:852-854` | Wert nur in GitHub → A3-009 |
| Pages Custom Domain `knoellchenfrei.de`/`www` | **undefined** | Skript kennt keinen Schritt; Commit `4fdfe31`: „Pages trägt beim Verbinden selbst ein" | → A3-007 |
| R2-Eimer `knoellchenfrei-tiles` | scripted | `einrichten.sh:759-770` | |
| R2-CORS | scripted, als Code | `app/apps/api/r2-cors.json`; `einrichten.sh:775-785` | |
| R2-Domain `tiles.knoellchenfrei.de` | scripted | `einrichten.sh:792-823` | wartet auf aktive Zone |
| Kachelarchiv (88,8 MB) | scripted, Quelle extern | `build-tiles.sh:74-118`; `.gitignore:4-10` | Protomaps hält ~1 Woche Archive → A3-011 |
| DNS-Zonen (5) | scripted | `einrichten.sh:1001-1022` | |
| Nameserver beim Registrar | manual | `einrichten.sh:1026-1034` | |
| Redirect Rules (4 Zonen) | scripted | `einrichten.sh:1051-1099` | |
| DNS-Einträge Weiterleitungsdomains (A, MX, SPF, DMARC) | scripted, als Code | `einrichten.sh:1173-1178` | die einzigen DNS-Einträge, die als Code vorliegen |
| DNS-Einträge Hauptdomain | **undefined** | `einrichten.sh:1157` (`continue`), `:1114-1137` (nur Aufräumen) | → A3-007 |
| `api.knoellchenfrei.de` | undefined / nicht vorgesehen | `hosting.md:250-255`; keine `routes` in `wrangler.toml` | Worker bleibt auf `workers.dev` |
| Domains beim Registrar | manual, Registrar nur in Commit | `docs/entscheidungen.md:38-43`; `git show 4fdfe31` („INWX-Parkseite") | Auto-Renew offen `todo.md:209` → A3-001 |
| GitHub-Organisation | manual | `docs/todo.md:238-241` | Owner-Liste unbekannt → A3-017 |
| Org-Avatar, Social Preview | manual, Bilder scripted | `docs/marke.md:110-113,165-170`; `make-brand.mjs` | API-los, dokumentiert |
| Profil-README (`.github`-Repo) | scripted, Inhalt versioniert | `docs/marke.md:130-135`; `docs/org-profil.md` | |
| Repo-Beschreibung, Topics, Wiki/Projects, Pages, Dependabot-Schalter | scripted | `einrichten.sh:1209-1297` | |
| GitHub-Secrets/-Variablen | scripted (Secrets) / manual (Var) | `einrichten.sh:461-501`; `deploy.yml:119` | |
| Branch-Schutz | nicht gesetzt | `docs/todo.md:267-268` | bewusst |
| Dependabot-Konfiguration | automated | `.github/dependabot.yml` | |
| Datensnapshots Berlin/Hamburg | automated | `app/apps/web/public/data/*/meta.json`; `pages.yml:44-50` | im Repo, täglich erneuert |
| Claude-Artifacts (App, Bericht) | manual | `docs/neue-sitzung.md:299-305` | eigene Laufzeit außerhalb des Szenarios → A3-015 |
| Impressum-Dienstleister | manual, noch nicht gebucht | `docs/todo.md:177-187` | |

## 2. Backup — was, wohin, wie oft

**Nichts.** Nachgemessen:

```
$ grep -rn -iE "backup|sicherung|time.?travel|restore|wiederherstell|RTO|RPO|disaster|notfall" \
    --include=*.md --include=*.sh --include=*.toml --include=*.yml --include=*.ts . | grep -v node_modules | grep -v audit/
→ 0 Treffer, die eine Sicherung beschreiben (alle Treffer sind `export`-Keywords im TypeScript)
```

- `scripts/einrichten.sh:1329` — `SCHRITTE="werkzeuge cloudflare ci telegram botprofil kacheln dns github"`, kein Sicherungsschritt.
- `app/apps/api/src/worker.ts:828-858` — der Cron löscht (`DELETE`, `UPDATE … NULL`), nichts wird exportiert.
- Kein Workflow ruft `wrangler d1 export` auf (`.github/workflows/*.yml` vollständig gelesen).

Je Datensatz:

| Daten | Aufbewahrung (Code) | Backup | Verlust im Szenario |
| --- | --- | --- | --- |
| `sightings`, `votes` | 90 min (`worker.ts:140`) | keins | belanglos; nach 90 min wäre es ohnehin weg |
| `visits` | 2 Tage (`hosting.md:429`) | keins | belanglos |
| `marks` (Heatmap) | 28 Tage (`heatmap.ts:32`) | keins | Heatmap startet leer; erst ab 12 Strichen je Zelle wieder ein Muster (`heatmap.ts:47`), also 2–4 Wochen ohne Aussage |
| `feedback` | 90 Tage (`worker.ts:450`) | keins | **echter Verlust.** Der einzige Lesepfad ist ein manueller `wrangler d1 execute … SELECT` (`0001_schema.sql:127-128`). „Kein Lesepfad" bedeutet: Es gibt auch keinen Pfad, über den ein Backup entstehen könnte, und keinen, über den es zurückgespielt würde. |
| KV `CACHE` | TTL je Layer (`worker.ts:292`) | keins nötig | Cache füllt sich beim ersten Aufruf |
| R2 `berlin.pmtiles` | unbegrenzt | keins; lokale Kopie ist gitignored (`.gitignore:10`) | reproduzierbar aus Protomaps, sofern ein Tagesarchiv erreichbar ist |
| Datensnapshots | im Repo | Git selbst | kein Verlust |

**Secrets:**

| Secret | Außerhalb des Workers? | Verlustfolge |
| --- | --- | --- |
| `CLIENT_SALT` | nein, absichtlich (`einrichten.sh:428,435`) | keine: Hashes werden nach 1 h genullt (`worker.ts:830-835,851-853`), tägliche Rotation ist vorgesehen (`worker.ts:46-47`). Ein Salzwechsel bricht höchstens das laufende Rate-Limit-Fenster. |
| `TELEGRAM_TOKEN` | nein (`einrichten.sh:618,645`: „hat ihn gesetzt, nicht behalten") | Bot ist erreichbar nur über das Telegram-Konto des Betreibers (BotFather `/token` bzw. `/revoke`). Kein Verlust des Bots, aber Bus-Faktor 1. |
| `TELEGRAM_SECRET` | nein | keine: wird beim Neusetzen des Webhooks frisch erzeugt |
| CI-Token, Account-ID | nur GitHub-Secret | nach Blackout wertlos; neu erzeugen |
| Betreiber-Token | Klartextdatei `$HOME/.knoellchenfrei-cf-token` (`einrichten.sh:204`) | nach Blackout wertlos; die Datei bleibt zurück |

**Verschlüsselung, Restore-Key:** entfällt, weil es kein Backup gibt.

**Cloudflare-seitige Netze (unverified, Doku gesperrt):** D1 *Time Travel*
(Point-in-Time-Restore, nach meinem Kenntnisstand 30 Tage, alle Pläne) und
`wrangler d1 export` existieren — beide setzen ein bestehendes Konto und eine
bestehende Datenbank voraus und helfen im Blackout-Szenario nicht. Sie decken
nur den Fall „versehentlich gelöscht/überschrieben" ab, und selbst der ist
nirgends im Projekt erwähnt.

## 3. Findings nach Severity

### critical

```
ID: A3-001
Titel: Domains — Registrar nur in einer Commit-Nachricht, Auto-Renew offen, kein zweiter Zugang
Severity: critical
Confidence: confirmed
Evidenz:
  - docs/entscheidungen.md:38-43 — „Registrar-Empfehlung war INWX … Gekauft wurde bei einem anderen Anbieter; das ist unerheblich" (Anbieter nicht genannt)
  - git show 4fdfe31 — Commit-Text: „drei A-Eintraege auf 185.181.104.242 mit, die INWX-Parkseite" → der Registrar ist INWX, das steht ausschließlich dort
  - scripts/einrichten.sh:1120 — parkadressen = {'185.181.104.242'} (Registrar nur als IP kodiert)
  - docs/todo.md:75-76 — „Auto-Renew … Der einzige Punkt auf dieser Liste, an dem ein Versäumnis nicht reparierbar ist"; :209 offene Checkbox
  - scripts/einrichten.sh:1190-1194 — Skript kann es nur anmahnen
  - kein Dokument nennt Registrar-Konto, Kontakt-E-Mail, Ablaufdaten, Auth-Codes oder eine zweite berechtigte Person (grep „registrar|inwx|auto.?renew" → nur die drei Stellen oben)
Wirkung: Die fünf Domains sind das einzige Gut, das sich nach einem Verlust nicht aus dem Repository neu erzeugen lässt. Im Szenario „Cloudflare weg" sind sie der Anker, an dem alles neu aufgehängt wird — Nameserver müssen beim Registrar umgestellt werden (einrichten.sh:1026-1028). Fällt zusätzlich der Betreiber aus oder läuft die Hauptdomain ab, ist der Name weg („binnen Stunden von Drop-Catchern gegriffen", todo.md:210).
Empfehlung: Ein Abschnitt „Registrar" in docs/hosting.md oder einem neuen docs/notfall.md: Anbieter, Kundennummer (ohne Zugangsdaten), hinterlegte E-Mail, Ablaufdaten aller fünf Domains, Stand Auto-Renew (nachgeprüft, mit Datum), Ort des Auth-Codes. Zweite Kontaktperson/Vollmacht beim Registrar, sobald der Verein existiert. Auto-Renew jetzt einschalten und den Haken in todo.md setzen.
Aufwand: S
```

### high

```
ID: A3-002
Titel: Keine Sicherung der D1-Daten — Feedback ist der Datensatz, der dabei wirklich verloren geht
Severity: high
Confidence: confirmed
Evidenz:
  - grep-Lauf (Abschnitt 2): kein Dokument, kein Skript, kein Workflow beschreibt einen Export
  - scripts/einrichten.sh:1329 — Schrittliste ohne Sicherung
  - app/apps/api/src/worker.ts:828-858 — scheduled() nur DELETE/UPDATE
  - app/apps/api/migrations/0001_schema.sql:121-131 — feedback: „keinen Lese-Endpunkt", Lesen nur über manuellen wrangler-Befehl
  - CLAUDE.md, Regel „Freitext-Feedback hat keinen Lesepfad — es ist absichtlich nur für den Betreiber"
  - docs/datenschutz.md:157-164 — Aufbewahrung 90 Tage für Rückmeldungen
  - WebFetch developers.cloudflare.com → EGRESS_BLOCKED (Time Travel/Export nicht nachprüfbar; helfen bei Kontoverlust ohnehin nicht)
Wirkung: Bei Verlust des Kontos sind bis zu 90 Tage Nutzerrückmeldungen weg — der einzige Kanal, über den Testnutzer Fehler und Ideen melden, und der einzige Datensatz ohne natürliche Kurzlebigkeit. Die Heatmap fällt auf Null und ist 2–4 Wochen ohne Muster (heatmap.ts:32,47). Das Design „nur der Betreiber liest" ist mit einem Backup vereinbar: Ein Export, den nur der Betreiber entschlüsseln kann, verletzt es nicht; ein fehlender Export verletzt dagegen die Sorgfalt gegenüber denen, die geschrieben haben.
Empfehlung: (1) Entscheiden und aufschreiben, welche Tabellen ein Backup wert sind — vermutlich nur `feedback` und `marks`. (2) Ein Skript-Schritt `sichern` in einrichten.sh oder ein eigenes `scripts/sichern.sh`: `wrangler d1 export knoellchenfrei --remote --table feedback --output …`, mit `age`/`gpg` an einen Betreiber-Schlüssel verschlüsselt, Ablage außerhalb Cloudflare und GitHub (z. B. lokaler Rechner + ein zweiter Ort). (3) Rhythmus dokumentieren (wöchentlich reicht bei 90 Tagen Aufbewahrung; RPO dann ≤ 7 Tage). (4) Restore-Befehl (`wrangler d1 execute --file`) daneben. (5) In der Datenschutzerklärung erwähnen, dass Sicherungskopien existieren und wie lange.
Aufwand: M
```

```
ID: A3-003
Titel: Einrichtungsskript hält tote Kennungen in wrangler.toml für vorhandene Ressourcen — der Wiederaufbau beginnt mit einem Handgriff, der nirgends steht
Severity: high
Confidence: confirmed
Evidenz:
  - scripts/einrichten.sh:389-406 — `if grep -q 'REPLACE_WITH_' "$TOML"; then … anlegen … else ok "KV und D1 stehen in wrangler.toml"; fi`
  - app/apps/api/wrangler.toml:11,16 — echte Kennungen eingetragen (f9e9b42d…, 733e1c3b-…)
  - scripts/einrichten.sh:412 — danach `migrationen_anwenden` gegen die eingetragene D1
  - .github/workflows/deploy.yml:65-68 — dieselbe Platzhalter-Prüfung im Deploy
  - docs/todo.md:48-49 — der Platzhalter-Mechanismus ist beschrieben, aber nur als Aufräum-Anweisung nach dem ersten Fehllauf, nicht als Restore-Schritt
Wirkung: Nach einem Blackout läuft `./scripts/einrichten.sh` durch, meldet „KV und D1 stehen in wrangler.toml", versucht Migrationen gegen eine Datenbank, die es nicht gibt, und scheitert mit einer Fehlermeldung, die nach Rechteproblem aussieht. Es legt nichts neu an. Niemand hat aufgeschrieben, dass man die Kennungen zuerst auf `REPLACE_WITH_KV_ID`/`REPLACE_WITH_D1_ID` zurücksetzen muss.
Empfehlung: Das Skript soll „Kennung eingetragen" von „Ressource existiert" unterscheiden: `wr d1 list --json` bzw. `wr kv namespace list` gegen die eingetragene ID prüfen; fehlt sie, warnen und (nach Rückfrage) neu anlegen und die toml überschreiben. Zusätzlich eine Option `--neuaufbau`, die die Platzhalter zurücksetzt. Bis dahin: den Handgriff als ersten Schritt ins Runbook.
Aufwand: S
```

```
ID: A3-004
Titel: Kein Runbook, kein RTO/RPO, kein Restore-Test
Severity: high
Confidence: confirmed
Evidenz:
  - grep „RTO|RPO|notfall|disaster|wiederherstell|restore" über docs/, scripts/, .github/ → 0 Treffer
  - CLAUDE.md „Wo was steht" — zehn Dokumente, keines für den Notfall
  - docs/datenschutz.md:157-164 — die einzige Aufbewahrungstabelle; sie beschreibt Löschfristen, nicht Verlusttoleranz
  - docs/sitzungsstatistik.md:373-378 und Commit 561a52b — das Skript lief genau einmal, gegen ein frisches Konto (Greenfield), mit acht Fehlbefunden; ein Wiederaufbau aus dem Klon wurde nie geprobt
  - docs/oeffentlich-machen.md:86-90 — „Ungetestet. Der Einrichtungs-Workflow …" (veraltet, Workflow gelöscht; zeigt aber, dass der Testzustand nie nachgeführt wurde)
Wirkung: Der Wiederaufbau ist rekonstruierbar (Abschnitt 4), aber nur von jemandem, der vier Dokumente und ein 1.374-Zeilen-Skript liest und die Widersprüche darin auflöst. Ob ein Datenverlust hingenommen wird, ist eine implizite Folge des Löschdesigns, keine getroffene Entscheidung. Entscheidungen, die nur implizit sind, werden im Ernstfall neu diskutiert.
Empfehlung: docs/notfall.md nach dem Skelett in Abschnitt 5: Voraussetzungen (Konten, Werkzeuge), Reihenfolge, je Schritt Automatisierungsgrad und wer ihn kann, RTO-Ziel, RPO je Tabelle als bewusste Entscheidung („Sichtungen: Totalverlust akzeptiert, weil …"). Einmal proben: neues Cloudflare-Konto (kostenlos), Klon, Skript — und die Zeit messen. Ergebnis in entscheidungen.md.
Aufwand: M
```

```
ID: A3-005
Titel: Der dokumentierte „Stand" widerspricht sich und verweist auf Gelöschtes — im Notfall führt das in die Irre
Severity: high
Confidence: confirmed
Evidenz:
  - docs/hosting.md:21-25 — „Offen sind der erste erfolgreiche Worker-Deploy, VITE_API_BASE und der R2-Eimer" (Absatz aus Commit 2745f9b, 18:54 UTC)
  - docs/sitzungsstatistik.md:366 — „Worker, Pages, D1, KV, R2 und Kacheln laufen; Telegram-Bot samt Webhook" (23:25 Uhr)
  - Commits 3e358c0 („R2-CORS … gegen den echten Eimer geprueft"), 37e4fa2 („VITE_TILES_URL im Deploy durchreichen") — bestätigen den späteren Stand
  - docs/todo.md:51-59 — „Danach macht den Rest ein Workflow … Actions → Cloudflare einrichten → Run workflow"; :48-49 „der Einrichtungs-Workflow füllt beide neu" — dieser Workflow ist gelöscht (CLAUDE.md: „setup-cloudflare.yml ist deshalb gelöscht"; ls .github/workflows zeigt 4 Dateien ohne ihn)
  - docs/todo.md:495-510 und app/apps/api/migrations/0001_schema.sql:83 — verweisen auf `migrations/001-stadt.sql`; `ls app/apps/api/migrations/` → nur `0001_schema.sql`
  - docs/hosting.md:373-380 — VITE_API_BASE „in Cloudflare Pages unter Settings → Environment variables"; tatsächlich baut GitHub Actions und reicht den Wert durch (deploy.yml:105-120); die Pages-Variable wäre wirkungslos
  - docs/oeffentlich-machen.md:86-90 — „Ungetestet. Der Einrichtungs-Workflow ist geschrieben …" (Workflow existiert nicht mehr)
Wirkung: Wer im Ernstfall todo.md folgt, sucht einen Workflow, den es nicht gibt, und eine Migrationsdatei, die es nicht gibt; wer hosting.md folgt, setzt eine Variable an einer Stelle, die nichts bewirkt. Jeder dieser Umwege kostet im Notfall die halbe Stunde, die CLAUDE.md sonst zu vermeiden versucht.
Empfehlung: Den „Stand"-Absatz in hosting.md nachführen (oder streichen und auf `./scripts/einrichten.sh --pruefen` verweisen — das Skript misst, die Doku rät). todo.md Punkt 2 und 8 auf das Skript umschreiben; den Verweis auf 001-stadt.sql in todo.md und im SQL-Kommentar entfernen. hosting.md „Frontend an den Worker hängen" auf deploy.yml umstellen. oeffentlich-machen.md §3 letzten Absatz löschen.
Aufwand: S
```

### medium

```
ID: A3-006
Titel: Telegram — Token nur im Worker, Bot-Name in der gesamten Doku falsch, Gruppenstand unbekannt
Severity: medium
Confidence: confirmed
Evidenz:
  - scripts/einrichten.sh:618 — „Das Skript kennt den Token nicht — es hat ihn gesetzt, nicht behalten"; :645 dito
  - scripts/einrichten.sh:662-663 — „der Bot @knoellchen_bot heisst und nicht @knoellchenfrei_bot, wie ueberall in der Doku stand"
  - docs/marke.md:17,35,194; docs/entscheidungen.md:200; docs/todo.md:355; einrichten.sh:729 — alle nennen @knoellchenfrei_bot
  - docs/todo.md:350-355 — „Eine Gruppe ist am 6. September angelegt; welche der vier Namen damit belegt sind, kann ich nicht nachsehen"
  - docs/marke.md:52-54 — Profilbilder nur über BotFather (manual)
Wirkung: Nach einem Blackout muss der Webhook neu angemeldet werden (neue Worker-Adresse). Das geht nur mit dem Token, und den hat nur das Telegram-Konto des Betreibers (BotFather). Ein Restore-Runbook, das den falschen Bot-Namen trägt, lässt jemanden im Ernstfall am falschen Bot arbeiten oder einen zweiten anlegen. Der Bot selbst ist nicht in Gefahr — Telegram ist im Szenario nicht betroffen —, aber Bus-Faktor 1 und ein falscher Name in fünf Dokumenten.
Empfehlung: Den tatsächlichen Bot-Namen einmal nachprüfen und in marke.md, entscheidungen.md, todo.md und einrichten.sh:729 berichtigen (oder den Bot umbenennen, falls das Schema gelten soll — BotFather /setname ändert nur den Anzeigenamen, der Username ist fix; also Doku anpassen). Tabelle „Telegram-Bestand" mit Bot-Username, Gruppen (welche existieren), und Hinweis, dass der Token bei BotFather per /token jederzeit erneut abrufbar ist. Prüfen, ob BotFather eine Übertragung des Bots an ein zweites Konto erlaubt (Transfer Ownership), und das für den Verein vormerken.
Aufwand: S
```

```
ID: A3-007
Titel: DNS der Hauptdomain und Pages-Custom-Domain existieren nur als Klick, nicht als Code
Severity: medium
Confidence: confirmed
Evidenz:
  - scripts/einrichten.sh:1156-1157 — Schleife für DNS-Einträge: `[ "$d" = "$HAUPTDOMAIN" ] && continue`
  - scripts/einrichten.sh:1101-1137 — für die Hauptdomain nur das Löschen bekannter Parkeinträge
  - git show 4fdfe31 — „die Zone ist jetzt leer, und Pages traegt beim Verbinden der Custom Domain selbst ein" — das Verbinden selbst ist kein Skriptschritt (grep „pages" in schritt_dns/schritt_cloudflare: kein `pages project domain`/`custom domain`-Aufruf)
  - docs/hosting.md:250-255 — api.knoellchenfrei.de bewusst nicht in `routes`; „Wer die Domain nur im Dashboard einträgt" — also Dashboard
  - app/apps/api/wrangler.toml:43-49 — ALLOWED_ORIGINS enthält die Domains bereits
  - docs/todo.md:212-219 — Zonen und Redirects beschrieben, Pages-Verbindung nicht
Wirkung: Der Teil des DNS, der Nutzern die App zeigt (Apex + www → Pages), ist im Skript nicht enthalten und in keinem Dokument als Befehl notiert. Nach einem Wiederaufbau stünde die Zone leer, die Weiterleitungsdomains liefen sauber auf eine Hauptdomain, die nichts ausliefert. Sollte später eine Vereins-Mailadresse an knoellchenfrei.de hängen (einrichten.sh:1154-1155), wären auch MX/SPF/DKIM der Hauptdomain nur Klickzustand.
Empfehlung: Schritt im Skript: `wr pages project … domain add` (bzw. REST `/pages/projects/<name>/domains`) für `knoellchenfrei.de` und `www.knoellchenfrei.de`, danach die CNAME-Einträge prüfen/anlegen. Alternativ die Zonen einmal als Export ablegen (Cloudflare bietet BIND-Export je Zone; ein `dns/` Verzeichnis im Repo mit fünf Zonendateien, ohne Geheimnisse) und im Runbook den Import nennen. Für die Hauptdomain jeden künftigen Mail-Eintrag ebenfalls dort führen.
Aufwand: S
```

```
ID: A3-008
Titel: Cloudflare-Konto und Token sind nicht inventarisiert — Identität, 2FA, Ablaufdaten unbekannt; Betreiber-Token liegt als Klartextdatei
Severity: medium
Confidence: confirmed
Evidenz:
  - grep „2fa|zwei-faktor|two-factor|passkey|recovery|1password|bitwarden|keepass|passwort.?manager" über docs/ → 0 Treffer
  - docs/hosting.md:240-242 — „Ein Ablaufdatum gehört dazu" — Datum nirgends notiert
  - scripts/einrichten.sh:202-209 — Token aus `$HOME/.knoellchenfrei-cf-token`, Klartext; :971 empfiehlt `chmod 600`, das Skript erzwingt es nicht
  - docs/todo.md:80-84 — „API-Token um Workers Scripts:Edit ergänzt" — es existiert also mindestens ein Token mit mehr Rechten als das CI-Token; welche Token es gibt, steht nirgends
Wirkung: Für das Szenario selbst egal (Konto weg = Token weg). Für das benachbarte Szenario „Betreiber fällt aus, Konto besteht" entscheidend: Ohne Wissen um Konto-E-Mail, 2FA-Methode und Recovery-Codes kommt niemand mehr hinein — und dann ist der Zustand derselbe wie im Blackout, nur mit laufenden Kosten und Domains, die auf ein unerreichbares Konto zeigen. Ein abgelaufenes CI-Token fällt erst beim nächsten Push auf, als roter Deploy.
Empfehlung: Konto-Inventar (ohne Geheimnisse): Cloudflare-Konto-E-Mail, 2FA-Art, Ort der Recovery-Codes, Liste der Token mit Zweck/Rechten/Ablauf. Ablauf des CI-Tokens als Kalendereintrag oder als Prüfung im Skript (`/user/tokens/verify` liefert `expires_on`). Die Tokendatei nach Gebrauch löschen oder das Skript `chmod 600` prüfen lassen.
Aufwand: S
```

```
ID: A3-009
Titel: GitHub-Organisation — Owner, Secrets und Variablen nicht inventarisiert; VITE_TILES_URL lebt nur in einer GitHub-Variable
Severity: medium
Confidence: confirmed
Evidenz:
  - .github/workflows/deploy.yml:112-119 — `VITE_TILES_URL: ${{ vars.VITE_TILES_URL }}`
  - scripts/einrichten.sh:851-854 — „Zuletzt VITE_TILES_URL setzen" — Hinweis, kein Schritt; Wert steht nur am Ende der Ausgabe von build-tiles.sh (:149)
  - .github/workflows/deploy.yml:145-149 — nennt CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID, VITE_API_BASE; VITE_TILES_URL fehlt in dieser Aufzählung
  - docs/todo.md:238-241 — Organisation angelegt, Zugriff über Claude-GitHub-App; keine Owner-Liste, kein zweiter Owner erwähnt
  - docs/todo.md:267-268 — kein Branch-Schutz (bewusst)
  - Positiv: docs/org-profil.md und docs/marke.md:130-135 machen das `.github`-Repository reproduzierbar; make-brand.mjs die Bilder
Wirkung: Nach Verlust der Organisation müssen Secrets und Variablen neu gesetzt werden. Die drei Secrets sind dokumentiert und vom Skript gesetzt; die Variable ist es nicht, und ihr Wert hängt am Build-Datum des Kachelarchivs — nach einem Neubau ist es ohnehin ein anderer. Das ist verkraftbar, aber nirgends gesagt. Ohne zweiten Owner ist die Organisation an eine Person gebunden; GitHub löscht Organisationen nicht bei Inaktivität, aber ein verlorener Login ist dasselbe Ergebnis.
Empfehlung: Inventar „GitHub" im Runbook: Owner, Secrets (3), Variablen (1), Pages-Quelle, Dependabot-Schalter, Social Preview. VITE_TILES_URL als Skriptschritt (`gh variable set`) am Ende von `schritt_kacheln`, gespeist aus der Ausgabe von build-tiles.sh. Zweiten Owner, sobald es eine zweite Person gibt.
Aufwand: S
```

```
ID: A3-010
Titel: Feste Namen (pages.dev, workers.dev, Org) sind nach einer Löschung möglicherweise nicht wieder verfügbar
Severity: medium
Confidence: unverified
Evidenz:
  - scripts/einrichten.sh:153-157 — WORKER_NAME, D1_NAME, PAGES_PROJEKT, R2_EIMER fest
  - app/apps/api/wrangler.toml:49 — ALLOWED_ORIGINS enthält `https://knoellchenfrei.pages.dev`
  - app/apps/api/r2-cors.json:6 — dito
  - docs/entscheidungen.md:97-98 — Organisation und Repository heißen `knoellchenfrei`
  - Cloudflare-/GitHub-Richtlinien zur Wiederverwendung gelöschter Namen nicht prüfbar (Egress gesperrt)
Wirkung: `<projekt>.pages.dev` ist global eindeutig; ob ein gelöschtes Projekt seinen Namen sofort freigibt, ist nicht belegt. Ebenso die `workers.dev`-Subdomain eines neuen Kontos (die Worker-Adresse ändert sich mit dem Konto ohnehin — Webhook und ggf. VITE_API_BASE müssen nachgezogen werden, was deploy.yml:84-103 automatisch tut). Ein GitHub-Org-Name nach Löschung kann gesperrt sein. Wenn ein Name nicht mehr verfügbar ist, stimmen ALLOWED_ORIGINS und r2-cors.json nicht mehr, und die App scheitert geschlossen (CORS) — ohne sichtbaren Fehler in der Karte.
Empfehlung: Im Runbook als Prüfpunkt: Nach Anlegen von Pages-Projekt und Worker die tatsächlichen Adressen mit ALLOWED_ORIGINS und r2-cors.json abgleichen; die eigenen Domains sind dort bereits enthalten, sodass der Produktivweg über knoellchenfrei.de unabhängig vom pages.dev-Namen funktioniert. Die pages.dev-Adresse aus beiden Listen entfernen, sobald die Custom Domain ausliefert.
Aufwand: S
```

```
ID: A3-017
Titel: Bus-Faktor 1 auf jedem Konto, und SECURITY.md verspricht Reaktionszeiten ohne Vertretung
Severity: medium
Confidence: confirmed
Evidenz:
  - git log --format='%an <%ae>' → genau eine menschliche Identität (Thomas Kamann), sonst Claude, dependabot, github-actions
  - docs/todo.md:9-10 — „du = geht nur mit deinem Konto, deiner Unterschrift oder deinem Geld"
  - docs/todo.md:86-97 — Begründung, warum Konten nicht delegierbar sind
  - SECURITY.md:8-9 — „Eingangsbestätigung innerhalb von drei Tagen, Ersteinschätzung innerhalb von zehn"
  - docs/todo.md:99-111 — der Verein als Lösung („Wenn du keine Lust mehr hast: Projekt ist tot / Vorstand wechselt") ist erkannt, aber Wochen bis Monate entfernt
Wirkung: Registrar, Cloudflare, GitHub-Org, Telegram-BotFather, Impressum-Dienstleister, Claude-Artifacts — jeder Wiederaufbauschritt, der ein Konto braucht, hängt an einer Person. Das ist im geschlossenen Testbetrieb hinnehmbar und in todo.md richtig als Vereinsfrage eingeordnet; es ist aber nirgends als Betriebsrisiko festgehalten, und die Zusage in SECURITY.md hat keinen Vertretungsfall.
Empfehlung: Im Runbook eine Spalte „wer kann das" je Schritt (siehe Abschnitt 5). Bis zum Verein: eine zweite Person als Notfallkontakt mit versiegeltem Zugang (Passwort-Manager-Notfallzugriff) — oder ehrlich in SECURITY.md: „Ein-Personen-Projekt; bei Ausfall des Betreibers keine Reaktion." Mit Vereinsgründung: zweiter Owner/Admin auf allen fünf Konten.
Aufwand: S (Doku) / M (zweite Person)
```

### low

```
ID: A3-011
Titel: Kachelarchiv reproduzierbar, aber nur aus einer externen Quelle mit Wochenfenster — die lokale Kopie wird nicht als Sicherung behandelt
Severity: low
Confidence: confirmed
Evidenz:
  - app/packages/ingest/scripts/build-tiles.sh:64-73 — „Protomaps hält nur ein kurzes Fenster an Tagesarchiven vor … 20260903 und alles ab 20260828 abwärts mit 404"
  - build-tiles.sh:74-91 — Skript sucht bis 60 Tage zurück
  - .gitignore:4-10 — `*.pmtiles` gitignored: „Zuhause ist die Datei in R2, nicht in git"
  - CLAUDE.md, Regel „Kein Datum aus einer Anleitung abtippen — Protomaps' Archive verfallen"
  - build-tiles.sh:59-62 — pmtiles-CLI Voraussetzung; einrichten.sh:108-111 installiert nur über brew
Wirkung: Nach einem Blackout ist R2 leer. Der Neubau braucht ein erreichbares Protomaps-Tagesarchiv und die pmtiles-CLI; fällt Protomaps aus oder ändert das Format, gibt es keine zweite Quelle, und die App fällt still auf OSM-Rasterkacheln zurück (deploy.yml:117-118) — was die Datenschutzerklärung wieder ändert (datenschutz.md:150). Die 89-MB-Datei liegt nach jedem Bau lokal vor und wäre eine Sicherung zum Nulltarif.
Empfehlung: Die zuletzt hochgeladene `berlin.pmtiles` auf dem Betreiberrechner (und im Backup-Ziel aus A3-002) behalten, mit dem Build-Datum im Namen; im Runbook: „Wenn vorhanden, direkt hochladen, sonst neu bauen". Die R2-Objektliste (welche v<datum>-Pfade existieren, welcher ist aktiv) einmal in hosting.md festhalten, damit VITE_TILES_URL rekonstruierbar ist.
Aufwand: S
```

```
ID: A3-012
Titel: Der Restore-Pfad hängt an Werkzeugen auf dem Betreiberrechner, die das Skript nur für macOS/brew installiert
Severity: low
Confidence: confirmed
Evidenz:
  - scripts/einrichten.sh:25-26 — „Geschrieben für die Bash, die auf macOS liegt (3.2)"
  - scripts/einrichten.sh:90-114 — pmtiles nur via brew; gh via brew/apt; pnpm via corepack
  - scripts/einrichten.sh:58,65 — `read … </dev/tty` (interaktiv, nicht in CI/Container lauffähig)
  - app/package.json:4 — `packageManager: pnpm@10.33.0`; engines node ≥ 22
Wirkung: Das Skript ist bewusst ein Arbeitsplatz-Werkzeug (CLAUDE.md „Bootstrap ist nicht Deployment"). Im Szenario ist der Betreiberrechner vorhanden — dann kein Problem. Steht nur ein anderer Rechner zur Verfügung (Linux ohne brew, Windows), fehlt pmtiles, und die Fehlermeldung nennt zwar die Release-Seite, aber nicht die Version, mit der das Skript getestet wurde.
Empfehlung: Werkzeugliste mit Versionen ins Runbook (node, pnpm, wrangler aus dem Lockfile, gh, pmtiles, python3, openssl, curl). Für pmtiles den Download-Pfad je Plattform nennen.
Aufwand: S
```

### info

```
ID: A3-013
Titel: CLIENT_SALT braucht kein Backup — das ist belegt und sollte so festgehalten werden
Severity: info
Confidence: confirmed
Evidenz:
  - scripts/einrichten.sh:427-435 — Salz erzeugt, „der Wert wird nirgends ausgegeben"
  - app/apps/api/src/worker.ts:46-47 — „Set it, and rotate it daily"
  - worker.ts:830-835,851-853 — client_hash nach 1 h auf NULL
  - worker.ts:182 — `env.CLIENT_SALT ?? ''` (ohne Salz läuft der Worker, nur unsicher)
Wirkung: Ein Verlust oder Wechsel des Salzes bricht höchstens das laufende Rate-Limit-Fenster einer Stunde; eine tägliche Rotation ist sogar vorgesehen, aber nicht automatisiert (kein Cron, kein Skriptschritt). Nichts zu sichern — das gehört als Satz ins Runbook, damit niemand im Notfall nach dem alten Wert sucht.
Empfehlung: Satz ins Runbook. Optional: die vorgesehene tägliche Rotation umsetzen oder den Kommentar in worker.ts:46 an die Realität anpassen.
Aufwand: S
```

```
ID: A3-014
Titel: KV ist ein reiner TTL-Cache — nichts zu sichern
Severity: info
Confidence: confirmed
Evidenz:
  - app/apps/api/src/worker.ts:249-256,292 — `CACHE.get(key)`, `CACHE.put(key, body, { expirationTtl })`
  - docs/hosting.md:9 — „WFS-Cache in KV"
Wirkung: Nach Neuanlage füllt sich der Cache beim ersten Aufruf aus den WFS-Diensten. Kein Verlust, kein Handlungsbedarf.
Empfehlung: Satz ins Runbook.
Aufwand: S
```

```
ID: A3-015
Titel: Zwei Claude-Artifacts sind eine dritte Laufzeit außerhalb des Szenarios — Quelle im Repo, Adresse nur in einem Dokument
Severity: info
Confidence: confirmed
Evidenz:
  - docs/neue-sitzung.md:299-305 — zwei Artifact-URLs (App, Bericht); „werden mit dem Parameter url aktualisiert, sonst entsteht ein zweites"
  - app/package.json:10 — `pnpm artifact`; docs/bericht/index.html
  - docs/hosting.md:74-97 — Artifact hält Meldungen in eigener `db`
Wirkung: Nicht betroffen vom Szenario, aber das Artifact-`db` (Meldungen der Artifact-Nutzer) hat ebenfalls kein Backup und ist an das Claude-Konto des Betreibers gebunden. Die Quelle ist vollständig im Repo; die URL-Bindung ginge verloren, ein neues Artifact entstünde.
Empfehlung: Beide URLs im Runbook-Inventar führen; klarstellen, dass das Artifact ein Demo-Kanal ohne Sicherung ist.
Aufwand: S
```

```
ID: A3-016
Titel: Der lokale Klon trägt keine main-Ref — nur den Arbeitsbranch mit dem Merge
Severity: info
Confidence: confirmed
Evidenz:
  - `git branch -a` → `* claude/parkingzone-migration-18g8fo`, `deps-merge`, remotes nur Arbeits- und Dependabot-Branches; kein `main`, kein `origin/main`
  - `git rev-parse main` → „unknown revision"
  - `git log -1` → fceadca „Merge remote-tracking branch 'origin/main' into claude/…" — Inhalt entspricht main, die Ref fehlt
  - .gitignore / app/.gitignore — `.raw/`, `*.pmtiles`, `.wrangler/`, `dist/` nicht im Klon (alle reproduzierbar)
Wirkung: Für den Inhalt unerheblich (fceadca enthält origin/main). Für ein Runbook, das „Branch main auschecken" sagt, stolpert der erste Schritt. Ein Klon als einzige Kopie sollte alle Refs tragen (`git clone --mirror`), sonst gehen Tags, Dependabot-Branches und die Ref-Namen mit dem Host verloren.
Empfehlung: Für die Sicherung `git clone --mirror` (oder `git fetch --all --tags` regelmäßig) statt eines Arbeitsklons; im Runbook den Commit-Hash, nicht nur den Branch-Namen nennen.
Aufwand: S
```

## 4. Restore-Pfad, rekonstruiert aus der Doku

Reihenfolge, wie sie aus `scripts/einrichten.sh:1329` und den Abhängigkeiten
im Skript folgt. Zeit = Arbeitszeit einer geübten Person; Wartezeit getrennt.
„Nur im Kopf" = Schritt, den kein Dokument nennt.

| # | Schritt | Grad | Wer | Quelle | Zeit | Anmerkung |
| --- | --- | --- | --- | --- | --- | --- |
| 0 | Klon prüfen: Commit, Refs, Werkzeuge (node 22, pnpm 10.33 via corepack, gh, pmtiles, python3, openssl) | manual | jeder | `einrichten.sh:254-331` prüft, `app/package.json:4-7` | 15 min | Klon hat keine main-Ref (A3-016) |
| 1 | **Kennungen in `wrangler.toml` auf `REPLACE_WITH_KV_ID`/`REPLACE_WITH_D1_ID` zurücksetzen** | manual, **nur im Kopf** | jeder | keine; nur indirekt `todo.md:48` | 2 min | **A3-003** — ohne diesen Schritt legt das Skript nichts an |
| 2 | Cloudflare-Konto anlegen, 2FA | manual | Betreiber (E-Mail) | `oeffentlich-machen.md:68`, `todo.md:17` | 10 min | Konto-Identität nicht dokumentiert (A3-008) |
| 3 | Betreiber-Token mit 9 Rechten erzeugen, in `$HOME/.knoellchenfrei-cf-token` | manual, Rechte dokumentiert | Betreiber | `hosting.md:224-230`, `einrichten.sh:966-973` | 10 min | |
| 4 | `wrangler login` oder Token exportieren | manual | Betreiber | `einrichten.sh:296-330` | 2 min | Skript misst, ob das Token auch Workers darf (`:300-309`) |
| 5 | GitHub-Organisation und Repository neu anlegen, Push des Klons | manual + git | Betreiber (Org-Owner) | `entscheidungen.md:97-110`, `umzug.sh` (Muster) | 15 min | Org-Name evtl. nicht frei (A3-010); Claude-GitHub-App neu berechtigen (`todo.md:240-241`) |
| 6 | `./scripts/einrichten.sh cloudflare` → KV, D1 (EU), Migrationen, Pages-Projekt, CLIENT_SALT, toml-Commit + Push | scripted | Betreiber | `einrichten.sh:385-457` | 5 min | CLIENT_SALT scheitert vor dem ersten Deploy (`:437-438`) → Schritt 8 wiederholen |
| 7 | CI-Token (2 Rechte) erzeugen; `./scripts/einrichten.sh ci` setzt Secrets | manual + scripted | Betreiber | `hosting.md:232-242`, `einrichten.sh:461-501` | 10 min | Ablaufdatum notieren (A3-008) |
| 8 | Push auf main → `deploy.yml`: Worker + Pages | automated | — | `deploy.yml` | 5–10 min Wartezeit | Worker-Adresse steht danach in der Zusammenfassung |
| 9 | `./scripts/einrichten.sh cloudflare` erneut → CLIENT_SALT | scripted | Betreiber | `einrichten.sh:429-442` | 1 min | |
| 10 | Zonen: `./scripts/einrichten.sh dns` → 5 Zonen, 4 Redirect Rules, DNS der Weiterleitungsdomains, Parkeinträge löschen | scripted | Betreiber | `einrichten.sh:963-1195` | 5 min | Hauptdomain-Einträge **nicht** enthalten (A3-007) |
| 11 | Nameserver beim Registrar (INWX) auf die fünf Zonen umstellen | manual | **nur Betreiber** (Registrar-Login) | `einrichten.sh:1026-1034`, `todo.md:212-213` | 15 min + **2–48 h Wartezeit** | Registrar nur in Commit belegt (A3-001) |
| 12 | Custom Domain `knoellchenfrei.de` + `www` an Pages-Projekt hängen | manual, **nur im Kopf** | Betreiber | Commit `4fdfe31` (Hinweis), sonst nichts | 5 min | A3-007 |
| 13 | `./scripts/einrichten.sh kacheln` → R2-Eimer, CORS, `tiles.`-Domain (braucht aktive Zone), Archiv bauen + hochladen | scripted, extern abhängig | Betreiber | `einrichten.sh:750-855`, `build-tiles.sh` | 10–20 min | Protomaps-Fenster (A3-011); lokale Kopie ginge schneller |
| 14 | `VITE_TILES_URL` als GitHub-Variable setzen, erneuter Deploy | manual | Betreiber/Org-Admin | `deploy.yml:119`, `build-tiles.sh:149` | 5 min | nicht im Skript (A3-009) |
| 15 | Telegram: Token bei BotFather (`/token`), `./scripts/einrichten.sh telegram` → Secrets, Webhook auf **neue** Worker-Adresse, Profiltexte | manual + scripted | **nur Betreiber** (Telegram-Konto) | `einrichten.sh:625-735` | 10 min | Bot heißt `@knoellchen_bot`, nicht wie dokumentiert (A3-006) |
| 16 | GitHub: `./scripts/einrichten.sh github` → Beschreibung, Topics, Wiki/Projects aus, Pages, Dependabot; Avatar + Social Preview von Hand; `.github`-Repo mit Profil-README | scripted + manual | Org-Owner | `einrichten.sh:1199-1310`, `marke.md:104-170` | 15 min | |
| 17 | Datenrestore D1 | — | — | **existiert nicht** | — | A3-002: nichts vorhanden, nichts zu tun außer akzeptieren |
| 18 | Nachprüfen: `./scripts/einrichten.sh --pruefen`; ALLOWED_ORIGINS/r2-cors gegen tatsächliche Adressen | scripted/manual | jeder | `einrichten.sh:21`, `wrangler.toml:49`, `r2-cors.json` | 10 min | A3-010 |
| 19 | Claude-Artifacts neu publizieren (optional) | manual | Betreiber (Claude-Konto) | `neue-sitzung.md:299-305` | 10 min | A3-015 |

**Nur im Kopf** (Schritt ohne Dokument): 1, 12. **Nur mit Betreiberkonto**
(Bus-Faktor 1): 2, 3, 5, 7, 11, 12, 14, 15, 16, 19 — also alles außer dem
Skriptinneren.

## RTO / RPO

| | Dokumentiert | Plausibel (aus der Doku abgeleitet) | Getestet |
| --- | --- | --- | --- |
| RTO bis App auf `pages.dev`/`workers.dev` mit Meldungen | nein | **3–5 h** Arbeitszeit (Schritte 0–9, 15) | nein — das Skript lief einmal greenfield (`sitzungsstatistik.md:373-378`, Commit 561a52b), nie als Wiederaufbau aus dem Klon |
| RTO bis eigene Domains und Kacheln | nein | **+ 24–48 h** Wartezeit auf die Delegation (`einrichten.sh:806-816` verlangt Zone `active`), Arbeitszeit 1 h | nein |
| RPO Sichtungen/Stimmen | nein (nur Löschfrist `datenschutz.md:159`) | Totalverlust, per Design belanglos (90 min) | — |
| RPO Besuche | nein | Totalverlust, belanglos (2 Tage) | — |
| RPO Heatmap | nein | Totalverlust; 2–4 Wochen bis wieder ein Muster (`heatmap.ts:32,47`) | — |
| RPO Feedback | nein | **Totalverlust bis 90 Tage** — der einzige echte Schaden | — |
| RPO Kachelarchiv | nein | reproduzierbar, sofern Protomaps liefert; sonst OSM-Rückfall | — |
| RPO Zonendaten | — | kein Verlust (im Repo, täglich erneuert) | — |

Was ein Datenverlust hier bedeutet, ist im Repository gut *begründet* (kein
Bewegungsprofil, Löschen statt Archivieren — `SECURITY.md:23-53`,
`0001_schema.sql:27-29`), aber nirgends als *Verlusttoleranz* ausgesprochen.
Der Satz „Wir akzeptieren den Verlust aller Sichtungen, Stimmen und Besuche;
Heatmap und Feedback sichern wir wöchentlich" fehlt — und er ist der Kern
eines RPO.

## 5. Ziel-Runbook — Skelett

```
# Notfall: Wiederaufbau von knoellchenfrei

## 0. Inventar (ohne Geheimnisse)
- Cloudflare-Konto: E-Mail [LÜCKE: nicht dokumentiert], 2FA [LÜCKE], Recovery-Codes bei [LÜCKE]
- Token: Betreiber-Token (9 Rechte, hosting.md:224-230), Ablauf [LÜCKE]; CI-Token (2 Rechte), Ablauf [LÜCKE]
- Registrar: INWX (nur aus Commit 4fdfe31), Kundennummer [LÜCKE], Kontakt-E-Mail [LÜCKE],
  Domains (5) mit Ablaufdatum [LÜCKE], Auto-Renew [LÜCKE: offen laut todo.md:209]
- GitHub-Org knoellchenfrei: Owner [LÜCKE], Secrets (CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID, VITE_API_BASE optional),
  Variablen (VITE_TILES_URL), .github-Repo (docs/org-profil.md)
- Telegram: Bot-Username [LÜCKE: @knoellchen_bot laut einrichten.sh:662, Doku sagt @knoellchenfrei_bot],
  Gruppen angelegt: [LÜCKE], Telegram-Konto des Betreibers
- Claude-Artifacts: zwei URLs (neue-sitzung.md:299-305), Konto [LÜCKE]
- Impressum-Dienstleister: [LÜCKE: noch nicht gebucht]
- Backup-Ziel und Schlüssel: [LÜCKE: kein Backup vorhanden]
- Zweite berechtigte Person je Konto: [LÜCKE: keine]

## 1. Voraussetzungen
- Klon mit allen Refs (git clone --mirror) [LÜCKE: aktueller Klon ohne main-Ref]
- Werkzeuge mit Versionen: node ≥22, pnpm 10.33 (corepack), gh, pmtiles [LÜCKE: Version], python3, openssl, curl
- Letztes berlin.pmtiles lokal [LÜCKE: wird nicht aufgehoben]

## 2. Reihenfolge (Zeit / wer / Grad)
 1. wrangler.toml: Kennungen auf REPLACE_WITH_* zurücksetzen  — 2 min / jeder / manual  [LÜCKE: steht nirgends; A3-003]
 2. Cloudflare-Konto + Betreiber-Token                        — 20 min / Betreiber / manual
 3. GitHub-Org + Repo + Push                                   — 15 min / Org-Owner / manual  [LÜCKE: Namensverfügbarkeit]
 4. ./scripts/einrichten.sh cloudflare                         — 5 min / Betreiber / scripted
 5. CI-Token + ./scripts/einrichten.sh ci                      — 10 min / Betreiber / manual+scripted
 6. Push → deploy.yml                                          — 10 min Wartezeit / automated
 7. ./scripts/einrichten.sh cloudflare (CLIENT_SALT)           — 1 min / scripted
 8. ./scripts/einrichten.sh dns                                — 5 min / scripted
 9. Nameserver bei INWX umstellen                              — 15 min + 2–48 h / nur Betreiber / manual
10. Pages Custom Domain knoellchenfrei.de + www                — 5 min / Betreiber / manual  [LÜCKE: kein Befehl dokumentiert; A3-007]
11. ./scripts/einrichten.sh kacheln (oder lokale Kopie hochladen) — 20 min / scripted  [LÜCKE: Protomaps-Verfügbarkeit]
12. gh variable set VITE_TILES_URL … ; erneuter Deploy         — 5 min / Org-Admin / manual  [LÜCKE: nicht im Skript]
13. BotFather /token → ./scripts/einrichten.sh telegram        — 10 min / nur Betreiber / manual+scripted
14. ./scripts/einrichten.sh github + Avatar/Social Preview     — 15 min / Org-Owner / scripted+manual
15. Datenrestore: feedback, marks aus Backup                   — [LÜCKE: kein Backup, kein Restore-Befehl; A3-002]
16. ./scripts/einrichten.sh --pruefen; ALLOWED_ORIGINS/r2-cors abgleichen — 10 min / jeder
17. Artifacts neu publizieren (optional)                       — 10 min / Betreiber

## 3. Ziele
- RTO: [LÜCKE: nicht festgelegt; Schätzung 3–5 h + 24–48 h Delegation]
- RPO je Tabelle: sightings/votes/visits = Totalverlust akzeptiert [LÜCKE: nicht als Entscheidung festgehalten];
  marks = [LÜCKE]; feedback = [LÜCKE]
- Letzte Probe: [LÜCKE: nie]

## 4. Bekannte Fallen
- Skript hält eingetragene Kennungen für existierende Ressourcen (A3-003)
- CLIENT_SALT braucht kein Backup (worker.ts:830-835)
- KV ist Cache (worker.ts:292)
- hosting.md „Stand" und todo.md Punkt 2/8 sind veraltet (A3-005)
- pages.dev-Name evtl. vergeben → ALLOWED_ORIGINS, r2-cors.json (A3-010)
- Bot-Username weicht von der Doku ab (A3-006)
```

## 6. Bus-Faktor — was nur eine Person kann

| Schritt | Konto | Person | Ersatzweg |
| --- | --- | --- | --- |
| Nameserver, Auto-Renew, Auth-Codes | Registrar (INWX) | Betreiber | keiner; Vollmacht erst mit Verein |
| Konto, Token, Zonen aktivieren | Cloudflare | Betreiber | Konto-Mitglied mit Admin — nicht vorhanden |
| Org, Repo, Secrets, Variablen, Pages, Avatar | GitHub-Org-Owner | Betreiber | zweiter Owner — nicht vorhanden |
| Bot-Token, Bilder, Schalter, Gruppen | Telegram / BotFather | Betreiber | Bot-Übertragung an zweites Konto — nicht geprüft |
| Impressum-Adresse, Vereinsanmeldung | Dienstleister / Notar | Betreiber (Identität) | keiner |
| Artifact-URLs | Claude-Konto | Betreiber | keiner; neues Artifact |
| Sicherheitsmeldungen in 3/10 Tagen | GitHub Security Advisories | Betreiber | keiner (SECURITY.md:8-9) |

Alles, was **nicht** an ein Konto hängt — Skript ausführen, Build, Deploy,
Kacheln bauen, Migrationen — kann jede Person mit dem Klon und den Werkzeugen,
sobald sie ein Token in die Hand bekommt.

## 7. Coverage

Grundgesamtheit: `audit/inventory.json`, 176 Dateien, Commit `fceadca`.

| Status | Zahl | Was |
| --- | --- | --- |
| **geprüft** (gelesen oder gezielt nach DR-Inhalt durchsucht) | **41** | doc 14 (CLAUDE, README, CONTRIBUTING, hosting, todo, entscheidungen, marke, org-profil, neue-sitzung, oeffentlich-machen, sitzungsstatistik, architecture, data-sources, bericht/index.html); legal 3 (SECURITY, datenschutz, impressum); iac 3 (wrangler.toml, 0001_schema.sql, r2-cors.json); ci 5 (dependabot.yml, 4 Workflows); code 8 (einrichten.sh, umzug.sh, worker.ts, build-tiles.sh, fetch.ts, sources.ts, vite.config.ts, sw-template.js); config 8 (.gitignore ×2, package.json ×3, pnpm-workspace.yaml, meta.json ×2) |
| **übersprungen mit Grund** | **135** | asset 39 — Bilder, Badges, Brand-Grafiken: erzeugte Dateien, per `make-*.mjs` reproduzierbar, kein Konfig-Inhalt · code 74 — Web-Komponenten, Core-Logik, Tests, E2E, Build-/Bild-Skripte: enthalten keine Infrastruktur- oder Betriebsangaben (worker.ts, Ingest-Fetch und SW wurden geprüft) · config 12 — tsconfig ×5, Paket-`package.json` ×3, Lockfile, Test-Fixtures ×3: keine DR-Relevanz · ci 4 — Issue-/PR-Vorlagen: kein Betriebsinhalt · doc 2 — staedte.md, ideen-2012.md: Datenlage bzw. Historie · legal 2 — LICENSE, CODE_OF_CONDUCT · other 2 — index.html, manifest.webmanifest |
| **nicht erreicht** | **0** | — |

Außerhalb des Inventars herangezogen: `git log`/`git show` (Commits 4fdfe31,
884e182, 2745f9b, 561a52b, 37e4fa2, 3e358c0), `git branch -a`. Nicht
erreichbar: `developers.cloudflare.com` (Egress gesperrt) — betrifft
ausschließlich die als `unverified` markierten Aussagen zu D1 Time Travel,
D1-Export und Namensfreigabe.
