# A4 SECURITY — knoellchenfrei/knoellchenfrei @ `fceadca`

Read-only-Audit, 2026-09-06/07. Geprüft wurden Code, Konfiguration, Git-Historie
und öffentliche Doku; die GitHub-API nur lesend. Keine Anfragen an
Produktivsysteme, kein `wrangler` mit Konto.

Hinweis zum Stand: Der ausgecheckte Branch heißt `claude/parkingzone-migration-18g8fo`,
zeigt aber auf denselben Commit wie `origin/main` (`fceadca`, `git log origin/main..HEAD` leer).

## Zusammenfassung

- **Keine Geheimnisse im Arbeitsbaum oder in der Historie.** Alle Muster-Suchen
  (`ghp_`, `AKIA`, `-----BEGIN`, `sk-`, Telegram-/Cloudflare-Token-Formate,
  32/40-Hex, Base64-32B) treffen nur Cloudflare-Ressourcenkennungen und
  `integrity`-Hashes. Das 2012er-Passwort ist nicht enthalten (`-S jdbc` trifft
  nur eine Doku-Erwähnung ohne Passwort, `-S password` nur die CI-Regex).
- Die Historie beginnt mit dem Orphan-Commit `f733c36` und hat seitdem 84 Commits — die
  Doku-Aussage „beginnt mit einem einzigen Commit" stimmt.
- **Größte Lücke: `main` ist ungeschützt** (API: `protected: false`, keine Rulesets),
  und jeder Push auf `main` rollt automatisch mit dem Cloudflare-Token aus.
- Das CI-Token ist laut Doku-Stand wahrscheinlich das *breite* Einrichtungs-Token
  (KV/D1/R2/Pages/Workers), nicht das in `hosting.md` geforderte Zwei-Rechte-Token.
- Sieben GitHub-Actions nur auf Major-Tag gepinnt, darunter `cloudflare/wrangler-action@v4`,
  das das Cloudflare-Token erhält.
- Worker: solide (gebundenes SQL, Origin-Prüfung, Konstantzeit-Vergleich, Löschjobs),
  aber `/visits` ist ohne Rate-Limit und nimmt beliebig viele client-gewählte Kennungen an;
  `CLIENT_SALT` fehlt still (`?? ''`) statt laut.
- Supply Chain: Lockfile + `--frozen-lockfile` überall, pnpm 10 ignoriert Build-Skripte,
  `pnpm audit` sauber. `minimumReleaseAgeExclude: ['*']` hebt den Cooldown für transitive
  Pakete in Dependabot-PRs auf — die Begründung in der Datei unterschätzt das.
- Ergebnis: 1 high, 4 medium, 8 low, 9 info.

## Secrets-Inventar (redigiert)

| # | Geheimnis / Kennung | Ort | Zweck | Owner | Wert im Repo? | Bewertung |
| --- | --- | --- | --- | --- | --- | --- |
| S1 | `CLOUDFLARE_API_TOKEN` | GitHub Actions Secret (Name in `deploy.yml:76,126`) | `wrangler deploy`, `pages deploy` | Betreiber | nein | Existenz per API nicht prüfbar (`/actions/secrets` → 403 Proxy). Rechteumfang: siehe A4-002 |
| S2 | `CLOUDFLARE_ACCOUNT_ID` | GitHub Actions Secret (`deploy.yml:77,127`) | Kontozuordnung | Betreiber | nein | Kein echtes Geheimnis, Maskierung unschädlich |
| S3 | `VITE_API_BASE` | optionales GitHub Secret (`deploy.yml:88`) | Worker-Adresse zur Buildzeit | Betreiber | nein | Öffentlicher Wert, als Secret gespeichert → Log-Maskierung (A4-021) |
| S4 | `VITE_TILES_URL` | GitHub Actions Variable (`deploy.yml:119`) | Kachel-Archiv | Betreiber | nein | Öffentlich, korrekt als `vars` |
| S5 | `CLIENT_SALT` | Worker-Secret (`worker.ts:50`, gesetzt in `einrichten.sh:434` via `openssl rand -base64 32`) | Salz für IP-/Telegram-Hash | niemand kennt ihn | nein | Keine Zuweisung in der Historie (`-S CLIENT_SALT` nur Code/Doku). Fehlt still, s. A4-005 |
| S6 | `TELEGRAM_TOKEN` | Worker-Secret (`worker.ts:56`, `einrichten.sh:679`) | Bot-API | Betreiber (BotFather) | nein | Kein Treffer für das Format `\d+:[A-Za-z0-9_-]{35}` in der Historie |
| S7 | `TELEGRAM_SECRET` | Worker-Secret (`einrichten.sh:678` `openssl rand -hex 24`) | `secret_token` des Webhooks | erzeugt vom Skript | nein | Konstantzeit-Vergleich `worker.ts:656-663` |
| S8 | DNS-/Zonen-Token | lokale Datei `~/.knoellchenfrei-cf-token` (`einrichten.sh:205`) | Cloudflare-REST für Zonen/DNS | Betreiber | nein | Skript empfiehlt `chmod 600` (`:970`) |
| S9 | `GITHUB_TOKEN` | automatisch je Workflow | Checkout, Pages-Deploy | GitHub | — | `ci.yml` ohne `permissions:` (A4-008) |
| S10 | `gh`-Anmeldung | lokale gh-CLI (`einrichten.sh:476-498`) | `gh secret set`, `gh api PATCH` | Betreiber | nein | — |
| K1 | KV-Namespace-ID `f9e9…` | `app/apps/api/wrangler.toml:11` | Binding `CACHE` | — | ja | Keine Geheimnisse: ohne Konto-Token nicht nutzbar; die Einschätzung des Projekts trägt (A4-016) |
| K2 | D1-Datenbank-ID `733e…` | `wrangler.toml:16` | Binding `DB` | — | ja | wie K1 |
| K3 | alte KV-ID `5206…`, alte D1-ID `b9d6…` | `docs/todo.md:40`; Historie `c38e271` | Aufräumhinweis | — | ja | wie K1, zusätzlich stale (Ressourcen sollen gelöscht sein) |
| K4 | Artifact-URLs `b870…`, `32d8…` | `docs/neue-sitzung.md:47-48` | Verweis auf Claude-Artifacts | — | ja | Artifacts sind standardmäßig privat; URL allein gewährt keinen Zugriff |

Entfernte Dateien in der Historie (`--diff-filter=D`): `pnpm-lock.yaml`/`pnpm-workspace.yaml` (Wurzel, versehentlich),
`setup-cloudflare.yml`, `migrations/001-stadt.sql`, `.github/profile/README.md`, `public/data/meta.json` — keine davon sensibel.

## Findings

### High

```
ID: A4-001
Titel: `main` ohne Branch-Schutz, jeder Push rollt automatisch mit dem Cloudflare-Token aus
Severity: high
Confidence: confirmed
Evidenz:
  GET /repos/knoellchenfrei/knoellchenfrei/branches → main: "protected": false
  GET /repos/…/rulesets → [] ; GET /repos/…/rules/branches/main → []
  GET /repos/…/branches/main/protection → 403 (Integration), Branch-Liste reicht als Beleg
  .github/workflows/deploy.yml:9-11 (on: push: branches: [main]) und :73-77 (wrangler-action mit secrets.CLOUDFLARE_API_TOKEN)
  Repo-JSON: allow_auto_merge=false, delete_branch_on_merge=false, web_commit_signoff_required=false
Wirkung: Jeder Account oder jedes Token mit Schreibrecht (auch eine kompromittierte Sitzung, ein
  fehlgeleitetes `git push`, ein Dependabot-Merge über die REST-API) verändert Worker und Web-App
  in Produktion ohne Review und ohne dass CI vorher grün sein muss. `deploy.yml` prüft zwar
  typecheck+test, aber nicht E2E; ein Force-Push kann Historie überschreiben.
Empfehlung: Ruleset für `main`: Force-Push und Löschen verbieten, Required Status Checks
  (`Typen, Tests, Coverage`, `Sicherheit`, ggf. `End-to-End`), PR-Pflicht (mit Ausnahme für den
  Betreiber, solange es nur einen gibt), `include administrators`. Zusätzlich `environment:`
  in `deploy.yml` mit Required Reviewer oder Wait-Timer.
Aufwand: S
```

### Medium

```
ID: A4-002
Titel: CI-Token vermutlich überprivilegiert — Doku zu Token-Rechten widerspricht sich
Severity: medium
Confidence: likely
Evidenz:
  docs/hosting.md:232-238 fordert für das CI-Token „genau zwei Rechte": Workers Scripts:Edit, Cloudflare Pages:Edit
  docs/hosting.md:21-23: „das API-Token hat seit dem Nachtrag unten auch `Workers Scripts:Edit`" — d.h. das
    vorhandene Token (KV/D1/Pages/R2, docs/todo.md:17-20) wurde erweitert, kein zweites angelegt
  docs/todo.md:83-84: „das API-Token um `Workers Scripts:Edit` ergänzt"
  docs/todo.md:51-57 beschreibt noch den gelöschten Workflow „Cloudflare einrichten → Run workflow"
    (CLAUDE.md: `setup-cloudflare.yml` gelöscht; Historie 736897e)
  scripts/einrichten.sh:461-498 (`schritt_ci`): fragt ein Token ab und setzt es als CLOUDFLARE_API_TOKEN,
    ohne zu sagen, dass es ein *anderes, engeres* Token als das lokale sein soll
  docs/oeffentlich-machen.md:69-71 nennt nur die breite Rechteliste
  Tatsächlicher Rechteumfang des Secrets: nicht prüfbar (/actions/secrets → 403; Cloudflare nicht abfragbar)
Wirkung: Bei einem Leck aus dem Workflow (kompromittierte Action, s. A4-003) kann ein Angreifer
  KV, D1 (alle Meldungen, Feedback-Freitext) und R2 lesen/ändern statt nur zu deployen.
Empfehlung: Zweites Token mit genau den zwei Rechten und Ablaufdatum anlegen, das bisherige aus dem
  GitHub-Secret nehmen. `einrichten.sh schritt_ci` soll das explizit verlangen und `docs/todo.md`
  den gelöschten Workflow nicht mehr beschreiben. Bis dahin gilt A4-002 als offen.
Aufwand: S
```

```
ID: A4-003
Titel: Alle GitHub-Actions nur auf Major-Tag gepinnt, darunter die mit Cloudflare-Token
Severity: medium
Confidence: confirmed
Evidenz:
  .github/workflows/deploy.yml:25 actions/checkout@v7, :27 pnpm/action-setup@v6, :29 actions/setup-node@v7,
    :74 und :124 cloudflare/wrangler-action@v4 (erhält secrets.CLOUDFLARE_API_TOKEN)
  ci.yml:21-25,52-56,79-83 (checkout, action-setup, setup-node), :38 und :65 actions/upload-artifact@v4
  pages.yml:33-37, :56 actions/upload-pages-artifact@v5, :68 actions/deploy-pages@v4
  lint-workflows.yml:26 actions/checkout@v7
  .github/dependabot.yml:93-107: github-actions-Ökosystem ist konfiguriert (Dependabot würde SHA-Pins nachziehen)
Wirkung: Ein bewegtes Tag (Maintainer-Übernahme, wie bei tj-actions 2025) liefert beliebigen Code in
  den Lauf, der das Cloudflare-Token und den `GITHUB_TOKEN` hält.
Empfehlung: Auf Commit-SHA pinnen mit Versionskommentar (`uses: cloudflare/wrangler-action@<sha> # v4.x`);
  Dependabot hält die Kommentare aktuell. Zuerst `wrangler-action` und `checkout`.
Aufwand: S
```

```
ID: A4-004
Titel: `/visits` ohne Rate-Limit — unbegrenzte Zeilen, D1-Schreibbudget und Zählerinflation
Severity: medium
Confidence: confirmed
Evidenz:
  app/apps/api/src/worker.ts:407-445 recordVisit: nur rejectsCrossSite + Regex `^(\d{4}-\d{2}-\d{2})-[\w-]{1,32}$`,
    kein clientHash/countRecent (anders als :466, :512, :602)
  worker.ts:422-423 Kommentar behauptet, das Format verhindere, „an unbounded number" zu erfinden — der
    Nonce-Teil ist frei wählbar
  worker.ts:433 INSERT OR REPLACE je Aufruf; :437-442 zwei COUNT(*) je Aufruf
  worker.ts:606-608 nennt selbst das Schreibbudget (1.000/Tag Free Tier) als Grund für Vorabprüfungen an anderer Stelle
  rejectsCrossSite (worker.ts:199-210) lässt Anfragen ohne `Origin` durch — curl reicht
Wirkung: Ein Skript erzeugt beliebig viele `visits`-Zeilen (bis zum Cron-Löschen nach 2 Tagen),
  bläht „heute geöffnet" auf und erschöpft das D1-Schreibkontingent, wodurch echte Meldungen
  scheitern (Verfügbarkeit des Kernpfads).
Empfehlung: `countRecent`-artiges Limit je clientHash (z. B. 60/h) oder Nonce serverseitig an den
  clientHash binden; alternativ Cloudflare Rate Limiting Rule auf `/visits` und `/sightings`.
Aufwand: S
```

```
ID: A4-005
Titel: `CLIENT_SALT` fehlt still — Hash wird dann ungesalzen gespeichert; „täglich rotieren" ohne Mechanismus
Severity: medium
Confidence: confirmed
Evidenz:
  worker.ts:182 `env.CLIENT_SALT ?? ''` und :674 dito — kein Fehler, kein Log, keine 503
  worker.ts:46-48 „Set it, and rotate it daily"; SECURITY.md „rotierbares Geheimnis"; docs/hosting.md:322
    „beliebig"; docs/datenschutz.md:138 „gesalzener Hashwert" — nirgends ein Rotationsablauf
  scripts/einrichten.sh:429-443 prüft nur, ob das Secret existiert, rotiert nie
  wrangler.toml:24-25 einziger Cron (`7 * * * *`) löscht nur; kein Rotationspfad
Wirkung: Ohne Salt ist der 64-Bit-Hash über den IPv4-Raum offline rückrechenbar (das Projekt sagt
  das selbst) — der gespeicherte Wert wäre dann ein IP-Pseudonym, im Widerspruch zur
  Datenschutzerklärung. Der Zustand ist von außen nicht erkennbar.
Empfehlung: Bei fehlendem `CLIENT_SALT` schreibende Endpunkte mit 503 ablehnen (wie beim Telegram-
  Webhook: „was nicht eingerichtet ist, existiert nicht"). Rotation entweder dokumentiert weglassen
  (Kommentar in worker.ts anpassen) oder als Ablauf beschreiben: `wrangler secret put CLIENT_SALT`;
  Folgen: alle Rate-Limit-Zähler und die Ein-Stimme-Sperre (`votes` PK) setzen sich zurück,
  lebende Meldungen können einmal erneut bewertet werden — bei 90-Minuten-Lebensdauer hinnehmbar.
Aufwand: S
```

### Low

```
ID: A4-006
Titel: Keine Content-Security-Policy und keine Sicherheits-Header für die Web-App
Severity: low
Confidence: confirmed
Evidenz:
  app/apps/web/index.html:1-27 ohne `<meta http-equiv="Content-Security-Policy">`
  app/apps/web/public/ ohne `_headers` (ls: nicht vorhanden) — Cloudflare Pages liefert dann keine
    CSP, kein X-Content-Type-Options, kein Referrer-Policy
  worker.ts:160-165 JSON-Antworten ohne `X-Content-Type-Options: nosniff`
  Positiv: keine `innerHTML`/`dangerouslySetInnerHTML`-Senken (grep über src/), einziges `setHTML`
    in App.tsx:528-532 mit escapeHtml (App.tsx:67-73)
Wirkung: Verteidigung in der Tiefe fehlt: Ein künftiger XSS-Fehler (etwa in Feed-Eigenschaften der
  GeoJSON, die über Popups laufen) hätte freie Hand; Kacheln/Fonts könnten von beliebigen Hosts
  nachgeladen werden.
Empfehlung: `public/_headers` mit CSP (`default-src 'self'; img-src 'self' data: blob:
  https://tile.openstreetmap.org https://tiles.knoellchenfrei.de; connect-src 'self' <worker>
  <tiles>; worker-src 'self' blob:`), `X-Content-Type-Options: nosniff`, `Referrer-Policy:
  strict-origin-when-cross-origin`. Für GitHub Pages ersatzweise als `<meta>`.
Aufwand: M
```

```
ID: A4-007
Titel: Rotation des `CLOUDFLARE_API_TOKEN` undokumentiert; das Skript kann Secrets nur anlegen, nicht ersetzen
Severity: low
Confidence: confirmed
Evidenz:
  scripts/einrichten.sh:476-487: `[ -z "$fehlende" ] && return 0` — vorhandene Secrets werden nie überschrieben
  docs/hosting.md:240-242 „lässt sich nach einem Leck nicht zurückrufen, nur rollen. Ein Ablaufdatum gehört dazu"
    — kein Ablauf, kein Ablaufdatum genannt; ob das Token eines hat: nicht prüfbar (unverified)
  docs/oeffentlich-machen.md:79-84 dito, nur Absicht
  Telegram dagegen: einrichten.sh:647 bietet „Neu setzen?" inkl. Webhook-Neuanmeldung (:695-697) — dokumentiert
Wirkung: Im Leckfall dauert der Austausch länger und läuft von Hand; ein fehlendes Ablaufdatum lässt
  ein geleaktes Token unbegrenzt gültig.
Empfehlung: Abschnitt „Rotation" in hosting.md: Token neu anlegen (2 Rechte, Ablauf ≤ 1 Jahr),
  `gh secret set CLOUDFLARE_API_TOKEN`, altes Token widerrufen, Deploy per `workflow_dispatch`
  prüfen. `einrichten.sh ci --neu` als Pfad zum Überschreiben.
Aufwand: S
```

```
ID: A4-008
Titel: `ci.yml` ohne `permissions:`; `pages.yml` gibt dem Build-Job `pages: write` und `id-token: write`
Severity: low
Confidence: confirmed
Evidenz:
  .github/workflows/ci.yml: kein `permissions`-Block (Zeilen 1-90); deploy.yml:18-19 und lint-workflows.yml:19-20 haben ihn
  pages.yml:17-20 auf Workflow-Ebene; der `build`-Job (:26-58) braucht nur `contents: read`
  Repo-Default für GITHUB_TOKEN: nicht abfragbar (/actions/permissions/workflow → 403 Proxy) → Wirkung unverified
  Positiv: nur `pull_request`, kein `pull_request_target`; Fork-PRs bekommen keine Secrets
Wirkung: Falls der Repo-Default noch „read and write" ist, laufen `checkout`, `setup-node`, `upload-artifact`
  mit Schreibrechten auf Inhalte/Packages — unnötige Angriffsfläche für A4-003.
Empfehlung: `permissions: contents: read` in ci.yml; in pages.yml die Schreibrechte nur dem `deploy`-Job geben.
Aufwand: S
```

```
ID: A4-009
Titel: Feedback-Rate-Limit durch Stundenrundung und Cron-NULLing auf Minuten reduzierbar
Severity: low
Confidence: confirmed
Evidenz:
  worker.ts:497 `created_at` = auf volle Stunde abgerundet; worker.ts:235-241 zählt `created_at > now-1h`
  worker.ts:850-854 Cron setzt `client_hash = NULL` für `created_at <= now-1h` — bei Stundenrundung greift
    das für eine um HH:59 abgegebene Rückmeldung schon beim Cron um HH+1:07
Wirkung: Statt 4/h sind bis zu 8 in wenigen Minuten um den Stundenwechsel möglich und nach jedem Cron-Lauf
  wieder 4. Für Freitext an den Betreiber (Spam) unangenehm, kein Datenrisiko.
Empfehlung: Rate-Limit-Zeitpunkt getrennt von `created_at` führen (z. B. `limited_until`), oder Cron-NULLing
  auf `created_at <= now - 2h` setzen.
Aufwand: S
```

```
ID: A4-010
Titel: Stimmen aus der Web-App scheitern am Worker mit 415; Meldungen ignorieren den Antwortstatus
Severity: low
Confidence: confirmed
Evidenz:
  app/apps/web/src/sighting-backend.ts:314-317 `fetch(…/confirm|dispute, { method: 'POST' })` — kein Content-Type
  worker.ts:598-599 voteOnSighting → rejectsCrossSite; :200-203 verlangt `application/json`, sonst 415
  sighting-backend.ts:302-311 report: `await fetch(...)` ohne `response.ok`-Prüfung (Feedback prüft, feedback.ts:40-46)
  Keine Tests für worker.ts (packages/core/test/* decken nur core ab; E2E läuft ohne VITE_API_BASE)
Wirkung: Die Ein-Stimme-pro-Client-Integrität und das Bewertungsmodell sind im Worker-Betrieb nie erreicht
  worden; ein 429/422 beim Melden sieht für den Nutzer wie Erfolg aus. Zeigt, dass der Worker
  ungetestet ausgeliefert wird.
Empfehlung: `headers: {'Content-Type': 'application/json'}` und Statusprüfung im Client; Worker-Tests mit
  `@cloudflare/vitest-pool-workers` oder mindestens ein Smoke-E2E gegen `wrangler dev`.
Aufwand: S
```

```
ID: A4-011
Titel: Eigene Meldung kann vom Melder bestätigt werden — Schema-Kommentar behauptet das Gegenteil
Severity: low
Confidence: confirmed
Evidenz:
  app/apps/api/migrations/0001_schema.sql:45-46 „used only to rate-limit and to stop one client confirming its own report"
  worker.ts:591-634: kein Vergleich von `sightings.client_hash` mit dem Stimmen-Hash
Wirkung: Ein Melder kann seiner Meldung sofort +1 geben (Bewertung 0→höher); mit A4-004-artiger IP-Rotation
  ohnehin umgehbar, aber die Doku verspricht eine Prüfung, die es nicht gibt.
Empfehlung: Entweder `WHERE id = ? AND (client_hash IS NULL OR client_hash != ?)` beim Vote oder den Kommentar
  streichen.
Aufwand: S
```

```
ID: A4-012
Titel: `minimumReleaseAgeExclude: ['*']` hebt den Cooldown für transitive Abhängigkeiten in Dependabot-PRs auf
Severity: low
Confidence: confirmed
Evidenz:
  app/pnpm-workspace.yaml:39-40 (`minimumReleaseAgeExclude: ['*']`) mit Begründung :3-38
  Begründung :28-33: „Aufgehoben wird also nur die Nebenwirkung auf den restlichen Baum, nicht der Schutz"
  .github/dependabot.yml:57-65 cooldown 3/7/21 Tage
Wirkung: Dependabot filtert serverseitig nur die *direkt* aktualisierte Version. Wird beim Auflösen eines
  Dependabot-PRs eine transitive Abhängigkeit neu aufgelöst (Range-Bump), darf pnpm dafür eine
  Stunden-alte Version ins Lockfile schreiben — genau das Fenster, das der Cooldown schließen soll.
  Der „restliche Baum" ist nicht Nebenwirkung, sondern der Teil des Schutzes, der jetzt fehlt.
  Für lokale/CI-Installs ist die Zeile wirkungslos (`--frozen-lockfile`), das ist korrekt beschrieben.
  Abgemildert durch: menschliches Review der PRs, pnpm 10 ohne Build-Skripte (A4-019), CI vor Merge.
Empfehlung: Begründung korrigieren; in Dependabot-PRs den Lockfile-Diff auf neu hinzugekommene Pakete
  prüfen (Review-Checkliste). Wiedervorlage pnpm 11 `minimumReleaseAgeStrict: false` beibehalten.
Aufwand: S
```

```
ID: A4-013
Titel: Deprecated Laufzeitabhängigkeit, Major-Rückstand, ungepinntes pnpm im Wurzel-`package.json`
Severity: low
Confidence: confirmed
Evidenz:
  `pnpm outdated -r` (app/): protomaps-themes-base 4.5.0 → Deprecated (migriert zu @protomaps/basemaps,
    pnpm-lock.yaml:1543); maplibre-gl 6.4.0 → 6.7.0; vitest/@vitest/coverage-v8 3.2.7 → 5.0.0;
    @cloudflare/workers-types 5.20260816.1 → 5.20260906.1
  /package.json: `"pnpm": "^12.3.4"` ohne Lockfile (package-lock.json in .gitignore:19) vs.
    app/package.json `packageManager: pnpm@10.33.0`; CI nutzt `pnpm/action-setup@v6 version: 10`
  `pnpm audit --audit-level moderate`: „No known vulnerabilities found"
Wirkung: Eine deprecated Laufzeitabhängigkeit bekommt keine Sicherheitsfixes mehr; die pnpm-Angabe im
  Wurzelverzeichnis widerspricht der Pin und ist unreproduzierbar.
Empfehlung: Auf `@protomaps/basemaps` umstellen; Wurzel-`package.json` entfernen oder auf `10.33.0` pinnen.
Aufwand: M
```

```
ID: A4-014
Titel: R2-CORS erlaubt `localhost`-Origins am Produktiv-Bucket
Severity: low
Confidence: confirmed
Evidenz: app/apps/api/r2-cors.json:9-10 (`http://localhost:5173`, `http://localhost:4173`), angewendet
  via einrichten.sh:780 auf den Bucket `knoellchenfrei-tiles`
Wirkung: Nur GET/HEAD auf öffentliche Kacheln — praktisch harmlos, aber jede lokal laufende Seite auf
  diesen Ports kann den Bucket abfragen; Kachelbudget ist begrenzt.
Empfehlung: Entwicklung gegen eine lokale Kopie oder die `pages.dev`-Vorschau; localhost aus der
  Produktivregel nehmen.
Aufwand: S
```

```
ID: A4-015
Titel: Telegram-Token und -Secret erscheinen in Prozessargumenten von `curl`
Severity: low
Confidence: confirmed
Evidenz: scripts/einrichten.sh:531 (`bot$1/$2` in URL), :571, :665 (`bot$token/getMe`), :695-697
  (`-d "{…\"secret_token\":\"$geheim\"…}"`)
Wirkung: Auf Mehrbenutzer-Rechnern sind URL und Body per `ps`/`/proc` für andere lokale Nutzer sichtbar;
  ggf. auch in Proxy-Logs (URL). Der Einrichtungsrechner ist laut Doku der private Rechner des Betreibers.
Empfehlung: `curl --config -` bzw. `-d @-` mit Body über stdin; Token nicht in die URL, sondern per
  `-H "Authorization"` ist bei Telegram nicht möglich — daher zumindest Body über stdin.
Aufwand: S
```

### Info

```
ID: A4-016
Titel: KV-/D1-Kennungen im Repository sind keine Geheimnisse — Einschätzung des Projekts trägt
Severity: info
Confidence: confirmed
Evidenz: wrangler.toml:11,16; einrichten.sh:450 (Commit-Begründung); docs/todo.md:40 (alte KV-ID);
  Historie c38e271 (alte D1-ID). Cloudflare-Ressourcen-IDs sind nur zusammen mit Account-ID und
  API-Token nutzbar; FreiFahren veröffentlicht sie ebenso.
Wirkung: Keine. Nutzen für Angreifer: Zielliste, aber kein Zugriff.
Empfehlung: Beibehalten. Alte Kennung in todo.md nach dem Aufräumen entfernen.
Aufwand: S
```

```
ID: A4-017
Titel: Secret-Scan im CI ist eine schwache Regex; GitHub Secret Scanning/Push Protection nicht prüfbar
Severity: info
Confidence: unverified
Evidenz: ci.yml:96 Regex verlangt `key|secret|password|token` + `[:=]` + Anführungszeichen — erfasst keine
  Cloudflare-Token (40 Base62 ohne Präfix), keine Telegram-Token, keine PEM-Blöcke.
  /secret-scanning/alerts → 403 (Proxy); Repo-JSON `security_and_analysis: None` (Feld für dieses Token nicht sichtbar)
  docs/oeffentlich-machen.md:45-48 empfiehlt das Einschalten — ob geschehen, nicht messbar
Wirkung: Der CI-Check gibt ein falsches Gefühl von Abdeckung.
Empfehlung: `gitleaks`-Action (SHA-gepinnt) auf den Diff; Secret Scanning + Push Protection im Repo bestätigen.
Aufwand: S
```

```
ID: A4-018
Titel: Fehlermeldungen von Upstream und Laufzeit werden nach außen gereicht
Severity: info
Confidence: confirmed
Evidenz: worker.ts:285-289 (`detail: (error as Error).message` bei 502); ErrorBoundary.tsx:40 `<pre>{error.message}</pre>`
Wirkung: Geringe Informationspreisgabe (Upstream-URL-Fragmente, Stack-nahe Texte). Kein Geheimnis darunter.
Empfehlung: `detail` nur ins Log, nicht in die Antwort; ErrorBoundary generisch.
Aufwand: S
```

```
ID: A4-019
Titel: Supply-Chain-Basis solide; keine SBOM/Provenance
Severity: info
Confidence: confirmed
Evidenz: `pnpm install --frozen-lockfile` in ci.yml:30,61,88, deploy.yml:37, pages.yml:42; app/pnpm-lock.yaml
  lockfileVersion 9.0, 341 `integrity: sha512`, keine tarball-/git-Quellen; `packageManager` gepinnt;
  node_modules/.modules.yaml `ignoredBuilds: [esbuild, workerd]` (pnpm-10-Voreinstellung, keine Postinstall-Skripte);
  registries nur npmjs + jsr. Keine SBOM, keine Sigstore/npm-Provenance-Prüfung.
Empfehlung: Optional `pnpm sbom`/CycloneDX-Artefakt im CI; `pnpm audit signatures` sobald verfügbar.
Aufwand: S
```

```
ID: A4-020
Titel: Täglicher Pages-Build zieht Fremddaten und rollt sie ungeprüft aus (bewusst akzeptiert)
Severity: info
Confidence: confirmed
Evidenz: pages.yml:13-14 (cron), :44-50 (`fetch-data`/`build-data` mit `continue-on-error: true`), :52-54 Tests vor Deploy
Wirkung: Ein kompromittierter oder fehlerhafter Behörden-Feed landet ohne Review auf GitHub Pages; der
  Parser bricht bei nicht parsbaren Zonen ab (SECURITY.md), inhaltlich falsche aber parsbare Daten nicht.
Empfehlung: Plausibilitätsgrenzen (Zonenanzahl ±20 %, Bounding-Box) als Build-Abbruch; Snapshot-Diff im Step-Summary.
Aufwand: M
```

```
ID: A4-021
Titel: Öffentliche Werte als Secret gespeichert (VITE_API_BASE) → Maskierung erschwert Diagnose; kein Leck
Severity: info
Confidence: confirmed
Evidenz: deploy.yml:85-103 gibt `VITE_API_BASE=$basis` aus (:103) und schreibt `steps.api.outputs.base` ins Summary
  (:137). Als Secret wird der Wert von GitHub maskiert; als Ausgabe des Worker-Deploys ist er öffentlich.
  Kein `set -x`, keine Secret-Echos, `${{ }}`-Interpolation in `run:` nur mit betreiberkontrollierten Werten
  (:130-138) — kein Injection-Vektor durch Fremde.
Empfehlung: `VITE_API_BASE` als `vars` führen (wie `VITE_TILES_URL`, Begründung deploy.yml:112-118 gilt gleichermaßen).
Aufwand: S
```

```
ID: A4-022
Titel: Git-Historie sauber; Wurzel-Lockfile einmal versehentlich committet
Severity: info
Confidence: confirmed
Evidenz: 84 Commits ab Orphan f733c36; `git log --all -S` für ghp_/AKIA/BEGIN/sk-/github_pat_: 0; `-S jdbc`: nur
  docs/ideen-2012.md (URL ohne Passwort); `-S password`: nur ci.yml-Regex; 9 Base64-Treffer = `integrity`
  einer Wurzel-`pnpm-lock.yaml` (gelöscht in edb23a3); keine `.env`/`.pem`/Credential-Dateien je committet.
  Das Altrepository `herbeus/parkingzone` mit dem 2012er-Passwort existiert weiter (SECURITY.md „Bekannte Grenzen").
Empfehlung: Keine. Optional das Altrepository archivieren/privat stellen.
Aufwand: S
```

```
ID: A4-023
Titel: `docs/bericht/index.html` lädt Google Fonts — Drittanbieter, falls die Seite je ausgeliefert wird
Severity: info
Confidence: confirmed
Evidenz: docs/bericht/index.html:2-4 (`fonts.googleapis.com`, `fonts.gstatic.com`); pages.yml:58 deployt nur `app/apps/web/dist`
Wirkung: Derzeit keine (nicht ausgeliefert). Bei Veröffentlichung DSGVO-relevant (IP an Google).
Empfehlung: Fonts einbetten oder Systemschriften, bevor der Bericht öffentlich gehostet wird.
Aufwand: S
```

```
ID: A4-024
Titel: CORS-Randfälle: leerer Origin-Wert in der Allowlist; sonst korrekt exakter Abgleich
Severity: info
Confidence: confirmed
Evidenz: worker.ts:146-158: Ohne `Origin`-Header und ohne `ALLOWED_ORIGINS` ist `''` in `['']` → Header
  `Access-Control-Allow-Origin: ` (leer) — von Browsern nicht nutzbar. Ein abschließendes Komma in
  `ALLOWED_ORIGINS` erzeugt denselben Leereintrag. Abgleich sonst wörtlich (kein Wildcard, kein Suffix-Match),
  `Vary: Origin` gesetzt; `rejectsCrossSite` :199-210 erzwingt Preflight für Schreibzugriffe.
Empfehlung: `.filter(Boolean)` auf die Liste; Kosmetik.
Aufwand: S
```

## Positiv (belegt, keine Findings)

- SQL nur mit Bindings; einzige interpolierte Bezeichner aus Literal-Union (`worker.ts:224-243, 625-627`).
- Telegram-Webhook: 404 ohne Konfiguration, Konstantzeit-Vergleich, `allowed_updates` eingeschränkt, immer 200 nach Auth.
- `parseTelegramUpdate` (core/telegram.ts) prüft Typen streng, `Number.isSafeInteger` für IDs, `cityAt` mit `isFinite`.
- Datensparsamkeit umgesetzt wie dokumentiert: Rundung 1e-4 (`:213-215, :572-573`), 5-Minuten-Bucket (`:575`),
  Stunden-Bucket Feedback (`:497`), `client_hash → NULL` nach 1 h (`:832-836, :850-854`), Löschjobs (`:837-857`).
- `localStorage` wird beim Lesen validiert (storage.ts, presence.ts, city.ts über `cityByKey`, das wirft).
- Service Worker cached nur `/assets/`, `/data/`, Shell; keine API-Antworten (`sw-template.js:46-57`).
- Artifact-Build escaped `<` und `-->` beim JSON-Inlining (`build-artifact.ts:62-63`).
- Alle externen Links `rel="noreferrer"`; keine TLS-Abschaltung in Skripten (`fetch-parkzonen.sh:10-16`).
- D1 mit `--jurisdiction eu` (`einrichten.sh:158,350`).
- Kein `pull_request_target`; Fork-PRs laufen ohne Secrets.

## Coverage

Grundgesamtheit: `audit/inventory.json`, 176 Dateien.

| Klasse | Gesamt | Vollständig oder gezielt geprüft | Nur per Grep (Senken/Muster) | Übersprungen (Grund) |
| --- | ---: | ---: | ---: | --- |
| ci | 9 | 9 | 0 | — |
| config | 20 | 10 (.gitignore ×2, package.json ×5, pnpm-workspace, pnpm-lock (Quellen/Integrity), tsconfig.base nein) | 0 | 10: tsconfig ×5 (keine Sicherheitsrelevanz), meta.json ×2 und fixtures ×3 (Testdaten) |
| doc | 16 | 11 (CLAUDE, README, CONTRIBUTING, architecture, bericht, entscheidungen, hosting, ideen-2012, neue-sitzung, oeffentlich-machen, todo) | 0 | 5: data-sources, marke, org-profil, sitzungsstatistik, staedte (kein Sicherheitsbezug) |
| legal | 5 | 2 (SECURITY, datenschutz) | 0 | 3: LICENSE, CODE_OF_CONDUCT, impressum (A6 / kein Sicherheitsbezug) |
| iac | 3 | 3 | 0 | — |
| code | 82 | 30 (worker, telegram, city, feedback ×2, App (Popup/Escape), sighting-backend, storage, presence, seed, data-source, pwa, city (web), sw-template, vite.config, ErrorBoundary, SettingsSheet/TowInfo (Links), build-artifact, fetch, sources, build-tiles, fetch-parkzonen, einrichten, umzug, make-*.mjs ×4) | 16 (übrige Komponenten und web-Module: innerHTML/eval/fetch/target-Grep) | 36: 13 Unit-Tests + 2 E2E + vitest/playwright-Config (Testcode); 11 core-Datenlogik (berlin-time, geo, hamburg, heatmap, holidays, index, parse-fee, parse-schedule, quiet-day, sighting, tariff — ReDoS-Grenzen laut SECURITY.md nicht nachgemessen); 4 ingest (build-badges, build-data ×2, simplify); 4 web (format, globals.d, styles.css, types) |
| other | 2 | 2 | 0 | — |
| asset | 39 | 0 | 0 | 39 (Binär-/Geodaten; Popup-Escaping deckt GeoJSON-Properties ab) |
| **Summe** | **176** | **67** | **16** | **93** |

Nicht erreicht (extern, 403 über Proxy/Integration): Branch-Protection-Detail (Branch-Liste reicht als Beleg),
Actions-Secrets/-Variablen-Namen, Workflow-Token-Default, Dependabot-Alerts, Secret-Scanning-Status,
Environments. Tatsächlicher Rechteumfang und Ablaufdatum des Cloudflare-Tokens: nicht prüfbar ohne Konto.
