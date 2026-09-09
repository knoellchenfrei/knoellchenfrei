# Hosting

Drei Wege, aufsteigend nach Aufwand. Alle drei kosten bei dieser Last **null Euro**.

## Kurzfassung

**Für einen Demo-Link, den beliebige Leute öffnen können und der einen geteilten
Datenstand zeigt: Cloudflare.** Frontend auf Pages, API als Worker, Daten in D1,
WFS-Cache in KV — ein Konto, eine Domain, kein Server, kein Euro. Der
Artifact-Link ist bequemer, setzt beim Gegenüber aber einen Claude-Zugang
voraus.

| | Artifact | GitHub Pages | **Cloudflare** |
| --- | --- | --- | --- |
| Öffentlich teilbar | nur mit Claude-Zugang | ja | **ja** |
| Geteilte Meldungen | ja (`db`) | nein | **ja (D1)** |
| Live-Zähler | ja (`room`) | nein | **ja (`/visits`)** |
| Kartenkacheln | nein (CSP) | ja | **ja** |
| Live-Daten (WFS, Ladepunkte) | nein | nein | **ja (Worker)** |

**Stand am 7. September 2026, nachgemessen:** Alles läuft. Worker
(`/health` antwortet), Cloudflare Pages unter `knoellchenfrei.de` und `www.`,
D1 mit eingespielten Migrationen, R2 mit dem Kachelarchiv
(`tiles.knoellchenfrei.de/v20260904/berlin.pmtiles` → `206`), Telegram-Bot mit
Webhook. **GitHub Pages ist abgeschaltet** — davor lässt sich kein
Zugangsriegel setzen, und die App ist geschlossener Testbetrieb.

Zwei Dinge sind offen und stehen in [todo.md](todo.md): Kacheln gibt es nur
für Berlin, in den drei anderen Städten bleibt der Hintergrund leer; und ein
Token, das lesen darf — ohne das lässt sich nicht prüfen, ob KV und D1 noch
existieren.

## Wie FreiFahren es macht

Das Vorbild für die Sichtungsfunktion ist auch beim Hosting die beste
Referenz — und der Aufbau ist öffentlich einsehbar
([FreiFahren/FreiFahren](https://github.com/FreiFahren/FreiFahren), Monorepo,
`packages/`). Nachgesehen am 6. September 2026:

| Baustein | Bei FreiFahren |
| --- | --- |
| API | **Cloudflare Worker**, Hono + Drizzle, Route `api.freifahren.org/*` |
| Datenbank | **Cloudflare D1** (SQLite), eine je Stadt: `api-worker-db-eu`, `…-hamburg-eu`, `…-leipzig` |
| Frontend | Vite-App, per `wrangler.jsonc` ebenfalls auf Cloudflare; Capacitor macht daraus die native App |
| Kartenkacheln | **Kein Kachelserver.** Ein `.pmtiles`-Archiv je Stadt in **R2** hinter `tiles.freifahren.org`, das der Browser per HTTP-Range-Request liest |
| Meldungseingang | eigener `telegram-worker` — Meldungen kommen auch aus Telegram-Gruppen |
| Missbrauchsschutz | separater Dienst `report-gate`, als Service-Binding vor die Schreibpfade gehängt |
| Weiteres | `feedback-notifier`, `capgo-worker` (OTA-Updates der App), `warehouse-export` |

Nachgemessen: `api.freifahren.org` antwortet mit `server: cloudflare` und
`access-control-allow-origin: *`.

Zwei Dinge sind daran bemerkenswert:

**Das `compose.yaml` im Wurzelverzeichnis ist nur die Entwicklungsumgebung**
(Postgres + Frontend). Produktiv läuft nichts davon — die Datenhaltung ist D1.
Wer nur die Compose-Datei ansieht, zieht den falschen Schluss.

**Der Kachelserver ist keiner.** Eine einzige PMTiles-Datei je Stadt liegt als
Objekt in R2, unter einem unveränderlichen, commit-versionierten Pfad
`/v<sha>/<stadt>.pmtiles`; nur die Style-Datei ist veränderlich (60 s TTL). Der
Browser holt sich per Range-Request genau die Bytes, die er braucht. Kein
Prozess, der laufen muss, keine Skalierung, kein Egress-Preis.

### Was wir davon übernehmen

Unser Weg 3 unten ist derselbe Aufbau. Zwei Punkte lohnen zusätzlich:

1. **PMTiles in R2 löst unseren letzten Produktionsblocker.** Die
   [OSM-Kachelrichtlinie](https://operations.osmfoundation.org/policies/tiles/)
   deckt ausgelieferte Anwendungen nicht ab; bisher stand hier „eigene
   Kachelquelle nötig" ohne Weg. R2 kostet im Free Tier nichts (10 GB Speicher,
   1 Mio. Schreib-, 10 Mio. Leseoperationen im Monat) und berechnet
   **grundsätzlich keinen Egress**. Der Weg steht als Skript bereit — siehe
   unten.
2. **Schreibpfade hinter einen eigenen Dienst.** Wir haben Rate-Limits inline
   im Worker; FreiFahren hat dafür einen getrennten `report-gate`. Für unsere
   Last unnötig, aber die richtige Grenze, falls es je ernst wird.

## 1. Claude Artifact — läuft bereits

Die App ist als Artifact publiziert und über einen Link teilbar. Kein Deploy,
kein Account, keine Domain.

**Grenze für eine Demo:** Der Link ist kein öffentlicher Link. Er setzt beim
Gegenüber einen Claude-Zugang voraus, und die Anwesenheitsfunktion verbindet
laut Laufzeit-Vertrag nur angemeldete Betrachter derselben Organisation. Für
„schick ich mal rum" an beliebige Leute ist deshalb Cloudflare der Weg.

Was dabei mitkommt: die `db`-Capability des Artifact-Runtimes hält die
Ordnungsamt-Meldungen serverseitig und teilt sie zwischen allen, die den Link
öffnen. Das ist ein echtes Backend, ohne dass irgendwo ein Server läuft.

Was fehlt: Ein Artifact darf keine externen Requests stellen. Deshalb keine
OpenStreetMap-Kacheln — stattdessen zeichnen die Ortsteilgrenzen den
geografischen Kontext — und keine Live-Abfrage des WFS; die Daten sind zum
Build-Zeitpunkt eingefroren.

Aktualisieren: `pnpm --filter @knoellchenfrei/ingest fetch-data && … build-data`,
dann `pnpm artifact` und dieselbe Datei erneut publizieren — **nie** durch
Einpacken von `dist/`, das ergibt eine schwarze Seite. Die URL bleibt.
Das Artifact trägt beide Städte: 103 Berliner Zonen und 145 Hamburger Gebiete
in einer Datei von 2,17 MB.

## 2. Statisches Hosting — volle App, keine Kosten

Für die vollständige Fassung mit Kartenkacheln.

| Anbieter | Kostenlos | Grenzen |
| --- | --- | --- |
| **Cloudflare Pages** | ja, unbegrenzt Traffic | 500 Builds/Monat |
| **GitHub Pages** | ja | Bei privatem Repo nur mit GitHub Pro/Team — hier öffentlich, also frei |
| **Netlify** | ja | 100 GB Traffic/Monat |

### GitHub Pages — am 7. September wieder abgeschaltet

Es lief einen Tag. `.github/workflows/pages.yml` rollte den Build nach
`https://knoellchenfrei.github.io/knoellchenfrei/` aus; der Schalter dafür war
*Settings → Pages → Build and deployment → Source* auf **GitHub Actions**.

Abgeschaltet wurde es aus einem Grund, der nichts mit GitHub zu tun hat:
**Dort lässt sich kein Zugangsriegel davorsetzen.** Ein öffentlich erreichbarer
Stand ohne Impressum und Datenschutzerklärung ist genau das, was der
Beta-Riegel verhindern soll (Audit-Punkt M-006) — und eine zweite offene Tür
macht die erste sinnlos.

Der Workflow ist gelöscht. Der **Schalter im Repository gehört noch umgelegt**:
*Settings → Pages → Build and deployment → Source* auf **None**. Ohne das
bleibt der zuletzt ausgerollte Stand abrufbar, auch wenn kein Workflow mehr
läuft — eine gelöschte Automatik nimmt nichts zurück, was sie schon
veröffentlicht hat.

Der tägliche Datenabzug, der an `pages.yml` hing, ist nach `deploy.yml`
gewandert und holt jetzt alle vier Städte statt nur Berlin (Audit-Punkt M-031).
Dort war er ohnehin halb wirkungslos: Er frischte die Kopie auf GitHub Pages
auf, während Cloudflare Pages weiter den eingecheckten Stand auslieferte.
Scheitert ein Dienst, steht das jetzt in der Zusammenfassung des Laufs, statt
unter `continue-on-error` zu verschwinden.

Falls das Repository je wieder privat wird: Dann braucht Pages einen bezahlten
Plan (GitHub Pro, Team oder Enterprise), und die Einstellungsseite zeigt das
Feature schlicht nicht an. Cloudflare Pages kennt diese Grenze nicht.

Build-Kommando: `pnpm install && pnpm --filter @knoellchenfrei/web build`,
Ausgabeverzeichnis `app/apps/web/dist`.

### Der Beta-Riegel

Solange der Trägerverein nicht steht, läuft das Impressum auf eine
Privatperson. Deshalb ist die App nicht öffentlich — und `noindex` allein ist
dafür zu wenig: Es hält Suchmaschinen ab, keine Menschen.

Der Riegel ist eine **Cloudflare-Pages-Funktion**,
`app/apps/web/functions/_middleware.ts`. Sie läuft bei jeder Anfrage, *bevor*
eine Datei aus `dist` ausgeliefert wird. Wer das Passwort nicht hat, bekommt
weder das Bündel noch die Zonendaten noch das Manifest, sondern eine Seite mit
einem Formular. Ein Login *in* der App wäre wirkungslos gewesen — die Dateien
lägen weiter offen, und rechtlich bliebe das Angebot öffentlich.

Passwort setzen oder wechseln:

```bash
cd app && pnpm install
pnpm --filter @knoellchenfrei/api exec wrangler pages secret put BETA_PASSWORD \
  --project-name=knoellchenfrei
```

**Danach ein neuer Deploy — sonst passiert gar nichts.** Ein Secret gilt für
die Auslieferungen, die **nach** dem Setzen entstehen; die laufende kennt
weiter den alten Wert. Am 7. September abends hat genau das eine halbe Stunde
gekostet: Das Passwort war im Dashboard geändert, die Seite nahm trotzdem nur
das alte an, und das sah nach einem Fehler im Riegel aus. Es war keiner.

```bash
gh workflow run Deploy --ref main     # eine Zeile, rund zwei Minuten
```

Ein Passwortwechsel entwertet dann alle ausgegebenen Zugänge sofort: Die
Cookies sind mit dem alten Passwort signiert und werden nicht mehr angenommen.
Das ist zugleich der Weg, jemanden wieder auszusperren.

Zwei Wege hinein, beide enden im selben Cookie:

| Weg | Wofür |
| --- | --- |
| Formular auf der Startseite | Der Hauptweg. Einmal eingeben, 30 Tage Ruhe auf dem Gerät. |
| `https://knoellchenfrei.de/?invite=<passwort>` | Für Telegram: ein Klick statt einer Anleitung. Die Adresse wird sofort bereinigt; im Verlauf des Browsers bleibt das Passwort trotzdem stehen. |

**Fehlt das Secret, fällt der Riegel zu, nicht auf.** Eine Auslieferung ohne
`BETA_PASSWORD` antwortet mit `503` und einer Seite, die sagt, was fehlt. Das
ist Absicht: Andersherum öffnete ein vergessenes Secret stillschweigend die
Beta, und niemandem fiele es auf.

Was der Riegel **nicht** abdeckt, damit niemand mehr hineinliest, als dasteht:
der API-Worker unter seiner eigenen Adresse und das Kachelarchiv unter
`tiles.knoellchenfrei.de`. Beide tragen keine personenbezogenen Daten und haben
eigene Grenzen (Rate-Limits, `ALLOWED_ORIGINS`), aber sie liegen nicht hinter
dem Formular.

Im Deploy steht deshalb `pages deploy dist --cwd app/apps/web`. Nicht
`workingDirectory:` der Action: Die installiert wrangler im Arbeitsverzeichnis
und nimmt dort mangels Sperrdatei npm — das bricht an `workspace:*` ab.

Die Prüflogik steht in `packages/core/src/beta-gate.ts` und wird in
`test/beta-gate.test.ts` mit Unfug beschossen — sie zerlegt einen
`Cookie`-Header aus fremder Hand, und das gehört dorthin, wo es getestet wird.

## 3. Cloudflare Worker — Live-Daten und geteilte Meldungen

`app/apps/api/` enthält den Worker. Er löst zwei Dinge:

- **Caching.** `gdi.berlin.de` sendet `Access-Control-Allow-Origin: *`, ein
  Browser dürfte also direkt zugreifen — der Worker ist kein CORS-Proxy, sondern
  schützt die Infrastruktur einer Behörde davor, pro App-Start getroffen zu
  werden, und kann große Layer als kleine abgeleitete Antwort ausliefern.
  Für Quellen mit unklarem CORS (etwa die Live-Ladepunkte auf
  `api.viz.berlin.de`) ist er zusätzlich der einzige Weg.
- **Geteilte Meldungen** in D1, mit Rate-Limit, einer Stimme pro Client und
  stündlichem Löschjob.

### Kostenrahmen (Free Tier, geprüft am 6. September 2026)

| Ressource | Frei | Unser Verbrauch |
| --- | --- | --- |
| Statische Auslieferung (Pages) | unbegrenzt, kein Traffic-Limit | die ganze App |
| Pages-Builds | 500/Monat | 1 pro Push plus 1 nächtlich |
| Worker-Requests | 100.000/Tag | 1 pro App-Start, 30/Std. je offenem Tab, 1 pro Meldung |
| Worker-CPU | 10 ms je Aufruf | Millisekunden |
| D1-Zeilen gelesen | 5 Mio./Tag | ~3 Zeilen je Anfrage |
| D1-Zeilen geschrieben | 100.000/Tag | 1 pro Meldung, 1 pro Gerät und Tag |
| D1-Speicher | 5 GB | Kilobytes |

**Neu und wichtig:** Seit dem 1. September 2026 werden die D1-Tagesgrenzen im
Free-Plan tatsächlich **durchgesetzt** — Abfragen darüber schlagen mit einem
Fehler fehl, bis die Grenze um Mitternacht UTC zurückgesetzt wird. Vorher
wurden sie nur gezählt.
([Changelog](https://developers.cloudflare.com/changelog/post/2026-09-01-d1-free-tier-limit-enforcement/))

Der Engpass ist der Live-Zähler, nicht die Meldungen: Jeder offene Tab pingt
alle zwei Minuten. 100.000 Requests/Tag reichen für rund 130 dauerhaft offene
Tabs — oder, realistischer, einige tausend Besuche am Tag. Wer das reißt, hat
andere Sorgen als 5 $/Monat für den Workers-Paid-Plan.

### Datenschutz: wo die Daten liegen

D1 legt die Datenbank standardmäßig dort an, wo `wrangler` läuft. Für ein
Berliner Projekt gehört sie nach Europa:

```bash
pnpm --filter @knoellchenfrei/api exec wrangler d1 create knoellchenfrei --location weur   # Standort-Hinweis
pnpm --filter @knoellchenfrei/api exec wrangler d1 create knoellchenfrei --jurisdiction eu # verbindlich, DSGVO
```

`--jurisdiction eu` ist die stärkere Zusage: Sie **beschränkt** Speicherung und
Abfrage **dieser Datenbank** auf die EU, und ein gesetzter `--location`-Hinweis
wird dann ignoriert. Für alles, was über eine Demo hinausgeht, ist das die
richtige Wahl.

**Sie gilt aber nur für D1 — nicht für den Rest.** Das war hier zu weit
formuliert (Audit-Punkt M-055), und es ist der Unterschied, auf den es in einer
Datenschutzerklärung ankommt:

| | Wo |
| --- | --- |
| D1 `knoellchenfrei` | EU, verbindlich durch `--jurisdiction eu` |
| KV-Namespace `CACHE` | **weltweit repliziert** — Cloudflare kennt für KV keine Jurisdiktionsbindung |
| Ausführung des Workers | **am nächstgelegenen Rand-Knoten**, also dort, wo der Aufrufer sitzt |
| Pages, R2-Kachelarchiv | Auslieferung über dasselbe weltweite Netz |

Warum das trotzdem trägt: Im KV liegen ausschließlich zwischengespeicherte
**Behördendaten** — Parkzonen aus offenen WFS, nichts Personenbezogenes. Und der
Worker verarbeitet am Rand zwar eine IP-Adresse, schreibt sie aber nie: Was in
die Datenbank geht, ist der gesalzene Hash aus `clientHash`, und der entsteht
vor dem Schreiben. Die eine Stelle mit personenbezogenem Bezug ist damit
tatsächlich in der EU. Was hier nicht steht, wäre eine Zusage, die niemand
halten kann.

### Einrichten

**Ein Befehl:**

```bash
./scripts/einrichten.sh
```

Er **erledigt**, was sich erledigen lässt, statt es aufzuzählen:

| | |
| --- | --- |
| Werkzeuge | `pnpm` über corepack, `gh`, `pmtiles` — fehlend? Wird angeboten und installiert |
| Cloudflare | KV-Namespace, D1-Datenbank, Migrationen, Pages-Projekt, `CLIENT_SALT` |
| CI | `CLOUDFLARE_API_TOKEN` und `CLOUDFLARE_ACCOUNT_ID` als Repository-Secrets |
| Telegram | Token entgegennehmen, `TELEGRAM_SECRET` erzeugen, Webhook anmelden |
| R2 | Eimer, CORS aus `apps/api/r2-cors.json`, `tiles.knoellchenfrei.de` verbinden, Archiv bauen und hochladen |
| DNS | alle fünf Zonen anlegen, 301-Weiterleitungen als Redirect Rules |
| GitHub | Beschreibung, zwölf Themen, Pages einschalten, Dependabot-Warnungen und Sicherheitsupdates, Wiki und Projects aus |
| Repository | geänderte `wrangler.toml` committen und pushen |

**Was übrig bleibt, kann keine Schnittstelle** — und das sagt das Skript auch so,
statt „fehlt" zu melden: Cloudflare-Konto anlegen, das Token erzeugen,
BotFather anschreiben, die Nameserver beim Registrar umstellen, Auto-Renew
einschalten, Organisationsbild und Vorschaubild hochladen (für beide gibt es in
der GitHub-API keinen Endpunkt). Jedes davon mit Adresse; danach prüft das
Skript nach.

`--pruefen` berichtet nur und ändert nichts. Ein einzelner Schritt geht auch:
`./scripts/einrichten.sh telegram`. Zweimal laufen ist ungefährlich; das
Skript fragt nur nach dem, was fehlt.

#### Zwei Token, zwei Rechtemengen

Sie werden gern verwechselt, und die Verwechslung kostet jedes Mal einen roten
Lauf.

**Dein Token** (auf dem Rechner, für `einrichten.sh`) legt Ressourcen an und
braucht entsprechend viel: *Workers Scripts:Edit*, *Workers KV Storage:Edit*,
*D1:Edit*, *Cloudflare Pages:Edit*, *Workers R2 Storage:Edit* — und für die
Domains zusätzlich *Zone:Read*, *DNS:Edit*, *Single Redirect:Edit* sowie
*Account Rulesets:Edit*. (In der Oberfläche heißt die Regelmenge für
Weiterleitungen **Single Redirect**; die API nennt dieselbe Sache
`http_request_dynamic_redirect`.)

**Das CI-Token** (im GitHub-Secret, für `deploy.yml`) tut genau zwei Dinge —
`wrangler deploy` und `pages deploy` — und braucht deshalb genau zwei Rechte:

```
Workers Scripts:Edit
Cloudflare Pages:Edit
```

Alles darüber ist zu viel. Gerade hier zählt das: Der Token liegt in einem
fremden System, wird unbeaufsichtigt benutzt und lässt sich nach einem Leck
nicht zurückrufen, nur rollen. Ein Ablaufdatum gehört dazu.

**Nicht** nötig sind KV, D1 und R2 — die CI fasst sie nicht an, seit die
Einrichtung lokal läuft — und **Workers Routes** ebenfalls nicht, solange
`wrangler.toml` keine `routes` deklariert. Nachgesehen, vollständig (bis zum
7. September nannte diese Aufzählung drei Einträge zu wenig, Audit-Punkt
M-082): `name`, `main`, `compatibility_date`, die Bindings für KV und D1 samt
`migrations_dir`, ein Cron-Trigger, `[observability]` und `[vars]` mit
`ALLOWED_ORIGINS`. Keine `routes` — der Worker liegt auf der
`workers.dev`-Adresse.

`[observability] enabled = true` schaltet **Workers Logs** ein: Cloudflare hält
Anfrageprotokolle des Workers vor, und die enthalten IP-Adressen. Das ist beim
Fehlersuchen Gold wert und in der Datenschutzerklärung bisher nicht erwähnt
(Audit-Punkt M-056) — es gehört dort hinein oder abgeschaltet, und zwar bevor
die App öffentlich wird.

> **Das ändert sich mit einer eigenen Domain.** Trägst du
> `api.knoellchenfrei.de` als `routes` in die `wrangler.toml`, braucht die CI
> *Workers Routes:Edit* — und ohne das scheitert der Deploy mit einem
> Rechte-Fehler, der wie ein Konfigurationsproblem aussieht. Wer die Domain nur
> im Dashboard einträgt und die Datei in Ruhe lässt, bleibt bei den zwei
> Rechten.

#### Warum von deinem Rechner und nicht als Workflow

Das ist die verbreitete Aufteilung, und sie hat einen Grund: **Bootstrap ist
nicht Deployment.** Einmalige Ressourcenerzeugung läuft von einem Arbeitsplatz
aus, selten und von Hand — ihr Zweck ist, CI/CD überhaupt zu ermöglichen.
Danach macht die Pipeline den Rest ohne Menschen.

Hier kam dazu: Ein Token gehört in ein Terminal, nicht erst durch eine
GitHub-Secret-Maske und dann durch einen Workflow-Lauf. Und der Zustand darf
nur an *einer* Stelle stehen. Es gab kurzzeitig beides — ein Skript, das
Workflows anstieß, die Ressourcen anlegten. Das waren zwei halbe Wahrheiten.

**Was das Skript bewusst nicht ist: Infrastructure as Code.** Der Lehrbuchweg
für „welche Ressourcen existieren" wäre Terraform/OpenTofu mit dem
Cloudflare-Provider — deklarativ, mit Zustand, idempotent von Bauart. Das
Skript stellt Idempotenz von Hand her, indem es prüft, bevor es anlegt. Für
fünf Ressourcen auf dem Free Tier ist der Zusatz aus State-Backend, Werkzeug
und Provider-Zugangsdaten nicht verdient. **Wann es kippt:** sobald eine zweite
Umgebung dazukommt (Staging, eine eigene Datenbank je Stadt) oder jemand außer
dem Betreiber das betreibt.

#### Einzelne Befehle, falls du es von Hand willst

**Immer aus `app/` heraus und über den Workspace**, nie mit einem nackten
`npx wrangler` aus `apps/api`. Zwei Gründe, beide sind schon passiert:
`npx` zieht irgendeine wrangler-Version aus seinem Zwischenspeicher statt der
im Lockfile festgelegten, und ohne ein `pnpm install` im Wurzelverzeichnis
fehlt der Verweis auf `@knoellchenfrei/core` — der Build bricht dann mit
`Could not resolve "@knoellchenfrei/core"` ab, was nach einem kaputten Import
aussieht und keiner ist.

```bash
cd app
pnpm install                                          # legt die Workspace-Verweise an
W="pnpm --filter @knoellchenfrei/api exec wrangler"

$W kv namespace create CACHE                          # ID in wrangler.toml eintragen
$W d1 create knoellchenfrei --jurisdiction eu         # ID in wrangler.toml eintragen
$W d1 migrations apply knoellchenfrei --remote
$W pages project create knoellchenfrei --production-branch main
$W deploy
```

#### Migrationen

`wrangler d1 migrations apply` führt in der Datenbank eine Tabelle
`d1_migrations` mit und spielt nur ein, was dort noch nicht steht. Zweimal
laufen ist deshalb folgenlos, und der Stand ist eine Tatsache in der Datenbank
statt einer Vermutung im Skript.

Das ist nicht selbstverständlich, weil es hier kurzzeitig anders war: eine
`schema.sql` plus eine Datei mit `ALTER TABLE`, eingespielt von einem Skript,
das `duplicate column name` und `no such table` hinnahm, um zweimal laufen zu
können. Ein Nachbau dessen, was D1 mitbringt — und ein schlechterer: Er kannte
den Zustand nicht, er erriet ihn aus Fehlermeldungen, und einmal lag er daneben
(`no such column: city`, weil die Reihenfolge vertauscht war). Neue Migrationen
kommen als `migrations/NNNN_name.sql` dazu, aufsteigend nummeriert. Stand
8. September: `0001_init.sql` und `0002_events.sql`.

Seit dem 7. September ruft der Deploy-Workflow `migrations apply` selbst, bevor
er den Worker ausrollt — mit `continue-on-error`, damit ein Migrationsfehler
den Rollout nicht blockiert. Vorher lief es überhaupt nicht: Der Worker war
grün, und die Tabelle war nicht da.

> **Er lief bis zum 8. September nicht durch** — behoben, nachdem das Recht am
> Token hing; der Probelauf danach meldet `✅ No migrations to apply!`. Der
> Befund bleibt hier stehen, weil die Form wiederkommt: Ein Schritt mit
> `continue-on-error` kann jahrelang scheitern, ohne dass ein Lauf rot wird.
> Nachgesehen im Log des Laufs vom 8. September, 02:51:
>
> ```text
> A request to the Cloudflare API (/accounts/***/d1/database/…/query) failed.
>   The given account is not valid or is not authorized to access this service
>   [code: 7403]
> ```
>
> Dem CI-Token fehlte **`D1:Edit`** — es trug bis dahin nur *Workers
> Scripts:Edit* und *Cloudflare Pages:Edit* (siehe
> [notfall.md](notfall.md#zwei-zugangsdaten-und-sie-können-verschiedenes)). Der
> Schritt wurde eingebaut, ohne das Token zu erweitern. Wegen
> `continue-on-error` steht darüber nur eine gelbe Warnung, und der Lauf ist
> grün — genau die Sorte „meldet Erfolg und tut nichts", gegen die dieses
> Projekt sonst Prüfungen baut. Dass das Schema trotzdem stimmt, liegt daran,
> dass `0002_events.sql` von Hand eingespielt wurde.
>
> **Solange das Recht fehlt, gehört jede neue Migration von Hand eingespielt** —
> heute nicht mehr nötig, aber der Befehl bleibt für den Fall, dass ein Token
> einmal enger geschnitten wird:
>
> ```bash
> cd app && pnpm install
> pnpm --filter @knoellchenfrei/api exec wrangler d1 migrations apply knoellchenfrei --remote
> ```

Danach `ALLOWED_ORIGINS` in `wrangler.toml` auf die Domain der Web-App setzen.
Ohne diesen Wert antwortet der Worker ohne CORS-Header — er scheitert
absichtlich geschlossen statt mit einem Wildcard zu öffnen.

Und den Salz-Wert setzen, bevor die erste Meldung eingeht:

```bash
pnpm --filter @knoellchenfrei/api exec wrangler secret put CLIENT_SALT   # beliebig
```

Ohne ihn ist der gespeicherte Hash über den IPv4-Raum in Minuten
zurückrechenbar — dann steht neben jedem Ort ein Pseudonym für eine
IP-Adresse statt eines anonymen Merkmals.

### Nach dem Deploy nachmessen

```bash
./scripts/ausgeliefert-pruefen.sh
```

Prüft ohne Argument **beide** ausgelieferten Adressen — `knoellchenfrei.de`
und `knoellchenfrei.pages.dev` —, mit Argument die angegebene. Dass beide
geprüft werden, ist seit dem 9. September so: Die eigene Domain hängt an einer
Zuordnung, die ein Deploy nicht mitbringt, und vorher stand als Vorgabe
ausgerechnet die Adresse, die niemand eintippt.

Geprüft wird: dass der Riegel vor Startseite,
Statistikseite, Zonendaten, Manifest und Service Worker steht (je `401`), dass
die Anmeldeseite ihre eigenen Sicherheits-Kopfzeilen trägt, und dass ein
Einladungslink mit falschem Passwort keine Weiterleitung erzeugt.

Warum das nicht die E2E-Suite tut: Die misst gegen `vite preview`, und der
kennt weder die Pages-Funktion noch Cloudflares Weiterleitungen. Zwei Fehler
dieses Projekts waren genau deshalb unsichtbar — der `308` auf `/index.html`,
der `cache.addAll` scheitern liess, und die fehlende MapLibre-Worker-Datei, die
`index.html` mit `200 OK` zurückbekam. Beide meldeten Erfolg; das Skript sieht
deshalb auf Status **und** Content-Type.

### Läuft der stündliche Aufräumlauf wirklich?

Die Löschfristen aus [datenschutz.md](datenschutz.md) hängen an einem
`scheduled()`-Handler mit `crons = ["7 * * * *"]`. Ob der **läuft**, sagt keine
Konfiguration — das sagt nur sein Ergebnis. Der Rollup, den derselbe Lauf
schreibt, trägt den Zeitpunkt:

```bash
curl -s "$VITE_API_BASE/stats" | python3 -c 'import sys,json; print(json.load(sys.stdin)["erzeugtAm"])'
```

Am 9. September um 01:29 Berliner Zeit kam `2026-09-08T23:07:06.825Z` zurück —
22 Minuten alt, auf der Minute des Takts. Der Lauf arbeitet also, und mit ihm
die Löschungen.

Zwei Dinge, die dabei aufgefallen sind und beim nächsten Mal Zeit sparen:
Die Worker-Adresse steht als **GitHub-Secret** `VITE_API_BASE` und ist deshalb
im Deploy-Log maskiert — obwohl es ein öffentlicher Wert ist (Audit-Punkt
A4-021). Und der lokale API-Token darf D1 lesen, aber **nicht KV**: Ein
`wrangler kv key get` auf denselben Schlüssel antwortet mit `401`. Der Weg über
den öffentlichen Endpunkt ist also nicht nur kürzer, er ist der einzige, der
ohne weitere Rechte funktioniert.

**Seit dem 8. September läuft dasselbe Skript auch im Deploy**, gegen die
Vorschauadresse genau dieses Deploys. Das war die grösste offene Stelle des
Workflows: Ohne `--cwd` findet wrangler das Verzeichnis `functions/` nicht,
der Deploy klappt trotzdem, und die geschlossene Beta steht offen — der
Kommentar an jener Stelle sagte das seit dem 7. September und **niemand hat es
geprüft**. Dasselbe gälte für ein fehlendes `BETA_PASSWORD` (dann antwortet
die Funktion mit `503`). Jetzt wird der Lauf rot.

> **Zwei rote Läufe, beide im Prüfschritt und nicht an der Seite.** Eine
> Vorschauadresse von Cloudflare Pages antwortet in der ersten Minute mit
> `404`; das erste Warten prüfte nur, ob **irgendein** Status kommt, und `404`
> ist einer. Danach wartete es auf `/` — und die Adresse breitet sich **je
> Pfad** aus: `/` gab schon 401, während `/sw.js` noch 404 lieferte.
>
> Gewartet wird deshalb jetzt auf das **Gesamtergebnis**: Der ganze Durchgang
> wird wiederholt, bis er grün ist oder zwei Minuten um sind. Ein `200` auf `/`
> bricht sofort ab, statt ausgesessen zu werden — das ist der schlimmste Fall
> (die Seite liefert aus, ohne dass der Riegel davorsteht) und gehört beim
> Namen gemeldet, nicht als „antwortet nicht". Waren mehrere Durchgänge nötig,
> sagt das Ergebnis es dazu.

### Telegram anschließen

Der Bot ist kein zweiter Dienst: Er hängt als Route `/telegram` an demselben
Worker und schreibt über denselben Pfad in dieselben Tabellen wie die Web-App.
Ein eigener Worker wäre eine zweite Betriebsumgebung für eine Funktion, die
sich mit der ersten alles teilt.

1. **Den Token des bestehenden Bots holen** — nicht `/newbot`.
   `@knoellchen_bot` gibt es seit dem 6. September; `getMe` hat ihn damals
   beim Einrichten zurückgegeben, und so steht er in
   [entscheidungen.md](entscheidungen.md#telegram-und-der-name),
   [notfall.md](notfall.md) und [marke.md](marke.md). Ein zweiter Bot daneben
   verbrennt den Namen im Schema, und ein umbenannter Telegram-Link ist ein
   toter Link in jedem Beitrag, der ihn je geteilt hat.

   In Telegram: **@BotFather → `/mybots` → `@knoellchen_bot` → API Token.**
   Ist der alte Token verloren, stellt *Revoke* einen neuen aus und macht den
   alten ungültig — folgenlos, solange nirgends einer gesetzt ist. Genau so
   steht es auch in `notfall.md`: „Token **nein** — neu ausstellen."

   *(Hier stand bis zum 8. September „`/newbot`, Namen vergeben". Das war am
   6. September richtig, bevor der Bot existierte, und ist danach nie
   nachgezogen worden — aufgefallen durch die Rückfrage des Betreibers,
   nicht beim Lesen.)*
2. Ein zweites Geheimnis frei erfinden — es weist Telegram gegenüber dem Worker
   aus. Die Webhook-Adresse ist sonst nur durch Unkenntnis geschützt, und
   „niemand kennt sie" ist keine Zugangskontrolle.
3. Beides hinterlegen und den Webhook anmelden:

```bash
cd app                                      # nicht apps/api, siehe „Einrichten"
W="pnpm --filter @knoellchenfrei/api exec wrangler"
$W secret put TELEGRAM_TOKEN                # von @BotFather
$W secret put TELEGRAM_SECRET               # selbst ausgedacht

curl -X POST "https://api.telegram.org/bot<TOKEN>/setWebhook" \
  -H 'Content-Type: application/json' \
  -d '{"url":"https://<worker>/telegram","secret_token":"<TELEGRAM_SECRET>","allowed_updates":["message"]}'
```

`allowed_updates` ist keine Feinheit: Ohne die Einschränkung schickt Telegram
jede Bearbeitung, jeden Beitritt und jede Reaktion an den Worker, sobald der
Bot in einer Gruppe liegt.

Solange eines der beiden Geheimnisse fehlt, antwortet `/telegram` mit 404 —
dieselbe Regel wie beim Feedback: Was nicht eingerichtet ist, existiert auch
nicht als Endpunkt.

4. Optional, ein drittes Geheimnis: der **Admin-Kanal** für Rückmeldungen aus
   dem Formular. Einen privaten Kanal oder eine private Gruppe anlegen, den Bot
   als Mitglied hinzufügen, dort eine Nachricht schreiben und die Chat-Kennung
   aus `getUpdates` lesen — bei Kanälen und Gruppen ist sie **negativ**
   (`-100…`). Dann:

```bash
$W secret put TELEGRAM_ADMIN_CHAT           # die Zahl, nicht der @-Name
```

Ab dem nächsten Deploy schickt der Worker jede Rückmeldung nach dem Schreiben
in die Datenbank als Nachricht dorthin — Kategorie und Text, ohne den Hash.
Ein Fehlschlag beim Senden steht im Log und kippt die Antwort nicht; die
Rückmeldung liegt dann weiterhin in D1. Der Kanal ist ein Empfänger im Sinne
von `datenschutz.md`, Abschnitt 3.

Was der Bot kann: einen gesendeten Standort als Meldung eintragen, `/hilfe`
beantworten, und sonst höflich erklären, dass er nur Standorte versteht.
Meldungen aus Gruppen mitzulesen ist ausdrücklich **nicht** enthalten — dafür
bräuchte es einen Missbrauchsfilter vor dem Schreibpfad (FreiFahren betreibt
dafür einen eigenen Dienst) und einen Absatz in der Datenschutzerklärung.

Gespeichert wird auch hier nur der gerundete Ort und die auf fünf Minuten
gerundete Zeit. Die Telegram-Nutzerkennung wird wie eine IP-Adresse gehasht und
nur zum Durchsetzen der Meldegrenze benutzt; die Chat-Kennung wird gar nicht
gespeichert.

### Frontend an den Worker hängen

Die Web-App spricht den Worker nur an, wenn sie zur **Buildzeit** weiß, wo er
steht. Der Build läuft in **GitHub Actions**, nicht bei Cloudflare — die
Umgebungsvariablen im Pages-Dashboard sind also der falsche Ort und wirken
nicht (Audit-Punkt M-025).

Normalerweise ist gar nichts zu setzen: `deploy.yml` nimmt die Adresse aus der
Ausgabe des Worker-Deploys, der unmittelbar davor gelaufen ist. Ein Secret
`VITE_API_BASE` unter *Settings → Secrets and variables → Actions* braucht es
nur, wenn der Worker hinter einer eigenen Domain liegt; dann gewinnt es.

```
VITE_API_BASE   Secret, optional — nur bei eigener Worker-Domain
VITE_TILES_URL  Variable, kein Secret — die Adresse des Kachelarchivs
```

`VITE_TILES_URL` ist bewusst eine **Variable** und kein Secret: Die Adresse
steht ohnehin in jedem Netzwerk-Request der App. Als Secret wäre sie im
Protokoll maskiert, und man suchte im Dunkeln nach einem öffentlichen Wert.

Ohne diese Variable läuft die App im lokalen Modus: Meldungen bleiben auf dem
Gerät, und die Live-Zähler zeigen „nur dieses Gerät". Das ist kein Fehler,
sondern die ehrliche Anzeige dessen, was ohne Backend zählbar ist.

### Zwei Städte im Worker

Bis zum 6. September 2026 war der Worker auf **eine** Stadt konfiguriert
(`Env.CITY`, ohne Wert Berlin), während die App bereits zwischen Berlin und
Hamburg umschaltete. Eine Hamburger Meldung bekam
**`422 position outside Berlin`** — in der App sah das aus, als sei das Melden
kaputt. Das ist behoben; `CITY` gibt es nicht mehr.

Entschieden wurde die **Spalte**, nicht eine Datenbank je Stadt. FreiFahren
fährt je Stadt eine eigene D1 (`api-worker-db-eu`, `…-hamburg-eu`,
`…-leipzig`) *und* je einen Worker; für zwei Städte auf dem Free Tier ist das
n-mal Betrieb ohne Gegenwert.

Wie es jetzt läuft:

- **Schreiben:** Die Stadt kommt aus der Position (`cityAt` in
  `core/city.ts`) — sie liegt in einer der `reportBounds` oder in keiner. In
  keiner heißt `422 position outside Berlin, Hamburg`; die Meldung nennt alle
  bekannten Städte, statt von der Ursache wegzuführen.
- **Lesen:** `GET /sightings` und `GET /marks` nehmen `?city=<schlüssel>`.
  Ein **fehlender** Parameter bleibt Berlin — der einzige erlaubte Rückfall,
  weil das die Stadt ist, die heute ausgeliefert wird. Ein **unbekannter**
  Schlüssel ist ein `400` mit den bekannten Schlüsseln im Text, kein stiller
  Rückfall.
- **Telegram:** Ein gesendeter Standort trägt keine Stadt im Kontext, also
  wird sie aus dem Punkt abgeleitet; `parseTelegramUpdate` bekommt alle Städte
  statt einer.
- **`visits` bleibt ohne Stadt.** Ein Ping trägt keine Position — die Stadt
  wäre nicht abgeleitet, sondern vom Client behauptet, und das prüft der
  Worker nirgends sonst. Die Zahl beantwortet ohnehin „wie viele benutzen
  knoellchenfrei gerade", nicht „wie viele in Berlin".

Die Web-App schickt `?city=` bei beiden Aufrufen mit (`sighting-backend.ts`);
ohne den Parameter fiele der Worker auf Berlin zurück, und ein Hamburg-Nutzer
läse Berliner Meldungen — auf der Karte unsichtbar, in den Zählern falsch.

### Was im Worker liegt

| Tabelle | Inhalt | Aufbewahrung |
| --- | --- | --- |
| `sightings` | Position (~10 m), Stadt, Zeit (5-Min-Raster), Zähler | 90 Minuten |
| `votes` | eine Stimme je Client und Meldung | solange die Meldung lebt |
| `marks` | `{Tag, Stunde, Stadt, 250-m-Feld}` für Heatmap und Report | 28 Tage |
| `visits` | eine Zeile je Gerät und Tag, Zeitstempel wird überschrieben | 2 Tage |
| `feedback` | Freitext, gehashter Client für die Stundengrenze | 90 Tage |
| `events` | `{Tag, Stunde, Stadt, Name, Ausprägung} → Anzahl` | 90 Tage |
| `event_budget` | eine Zeile je Tag: wie viel schon gezählt wurde | 2 Tage |

`visits` beantwortet beide Live-Zahlen ohne Anwesenheitskanal: „gerade offen"
sind Zeilen, die in den letzten fünf Minuten aktualisiert wurden, „heute" sind
Zeilen mit dem heutigen Datum. Weil jeder Ping dieselbe Zeile überschreibt,
entsteht **kein** Verlauf — die Zeile hält den letzten Ping, nie eine Folge.
Der stündliche Cron-Job löscht, was aus dem Fenster fällt.

`events` ist ein Zählwerk, kein Protokoll: Der Primärschlüssel ist die ganze
Zeile bis auf die Anzahl, und dieselbe Kombination wird hochgezählt statt neu
angelegt. Ereignisse mit Ortsbezug liegen auf `hour = -1` — Ort **oder** Zeit,
nie beides. Wie das zusammenhängt, steht in
[architecture.md](architecture.md#nutzungsstatistik-ein-zählwerk-kein-protokoll);
was davon in der Datenschutzerklärung steht, in
[datenschutz.md](datenschutz.md).

### Die Statistikseite

`GET /stats` liefert **keine** Abfrage, sondern einen fertigen Stand aus dem
KV (`stats:v1`). Gerechnet wird er einmal je Stunde im selben Cron, der
aufräumt. Der Grund ist eine Abrechnungseigenheit von D1: Es zählt **gelesene**
Zeilen gegen ein eigenes Tagesbudget, und sechs `GROUP BY` über 28 Tage lesen je
Aufruf fünfstellig viele. Bei einem öffentlichen Endpunkt mit Neuladen wäre das
Budget vor dem Mittag weg; so kostet die Auswertung 24 Läufe am Tag, egal wie
oft jemand hinsieht.

Ausgeliefert wird sie unter `/statistik` als **zweiter Vite-Eintrag** — kein
React, keine Karte, kein Router. Das App-Bündel wächst dadurch um null Byte.
Der Service Worker hält die Seite bewusst nicht vor (`isCacheable` gibt für
`/statistik` `false` zurück): Eine Statistik aus dem Vorrat wäre eine falsche
Zahl, die aussieht wie eine richtige.

Ein Deckel schützt beide Seiten: 5.000 gezählte Ereignisse je Tag, 25 je
Anfrage, 50 je Ereignis. Ist der Tag voll, antwortet der Worker mit `200` und
`written: 0` statt mit `429` — der Aufrufer soll seinen Puffer verwerfen und
nicht wiederholen, denn ein Fehler wäre nicht seiner.

## 4. Eigene Kartenkacheln

**Läuft, für alle vier Städte.** Die App zeichnet Vektorkacheln aus PMTiles-
Archiven in R2, hinter `tiles.knoellchenfrei.de`. Ohne `VITE_TILES_URL` fällt
sie auf die Rasterkacheln von OpenStreetMap zurück — das ist der Weg für lokale
Bauten und die Testsuite, nicht für die Auslieferung.

### Archiv bauen

Kein eigener OSM-Import nötig. Protomaps veröffentlicht täglich eine globale
Basiskarte; daraus schneidet das Skript per Range-Request nur die Rahmen der
Städte heraus. Die Rahmen kommen aus `core/city.ts` (`reportBounds`), nicht aus
dem Skript.

```bash
app/packages/ingest/scripts/build-tiles.sh --hochladen     # alle vier
app/packages/ingest/scripts/build-tiles.sh muenchen --hochladen
```

**Ohne Datum aufrufen.** Protomaps hält nur ein kurzes Fenster an Tagesarchiven
vor; ein Datum aus einer Anleitung ist eine Falle mit Verfallsdatum und endet in
`HTTP error: 404`, was nach einem kaputten Skript aussieht. Das Skript sucht das
neueste selbst.

Gemessene Größen (7. September 2026, bis Zoom 15): Berlin 89 MB, Hamburg 65 MB,
Frankfurt 32 MB, München 32 MB.

### Von Hand ist es nur der Ausnahmefall

Der reguläre Weg ist der Workflow **Kacheln**
([`.github/workflows/kacheln.yml`](../.github/workflows/kacheln.yml)):
sonntags um 03:41 UTC, dazu auf Knopfdruck über *Actions → Kacheln → Run
workflow*. Er braucht das Secret `CLOUDFLARE_R2_TOKEN` mit genau einem Recht,
*Workers R2 Storage: Edit* — der Deploy-Token kann absichtlich kein R2.

Jedes Archiv geht an **zwei** Stellen:

| Pfad | Wofür |
| --- | --- |
| `v<datum>/<stadt>.pmtiles` | bleibt liegen, ist der Rückweg |
| `aktuell/<stadt>.pmtiles` | darauf zeigt die App |

Der stabile Pfad ist der Grund, warum der Bau überhaupt allein laufen kann: Ein
versionierter Pfad verlangte nach jedem Bau, `VITE_TILES_URL` umzusetzen und neu
auszurollen — und Repository-Variablen darf GitHubs `GITHUB_TOKEN` nicht
schreiben.

Zurück auf einen älteren Stand:

```bash
gh variable set VITE_TILES_URL --body 'https://tiles.knoellchenfrei.de/v<datum>/'
```

### Eimer einrichten

```bash
cd app && pnpm --filter @knoellchenfrei/api exec wrangler r2 bucket create knoellchenfrei-tiles
```

Zwei Einstellungen entscheiden, ob überhaupt ein Byte ankommt:

- **CORS** für die Domain der Web-App. Ohne das lehnt der Browser jede
  Kachelanfrage ab, ohne dass die Karte einen Fehler zeigt — sie bleibt
  einfach leer. Nachmessen mit gesetztem `Origin`, nicht ohne:

  ```bash
  curl -s -D- -o /dev/null -r 0-99 -H 'Origin: https://knoellchenfrei.de' \
    https://tiles.knoellchenfrei.de/aktuell/berlin.pmtiles | grep -i access-control
  ```

- **Range-Requests** müssen durchgereicht werden — darauf beruht das ganze
  Verfahren. Die richtige Antwort ist `206`, nicht `200`.

Die Regel ist bewusst eng: Sie lässt nur `https://knoellchenfrei.de` zu. Wer
Bilder aufnimmt oder lokal gegen echte Kacheln bauen will, lädt das Archiv
herunter und liefert es selbst aus, statt die Regel aufzumachen — der Weg steht
in [todo.md](todo.md).

### Die Adresse ist ein Verzeichnis

```
VITE_TILES_URL=https://tiles.knoellchenfrei.de/aktuell/
```

**Nie eine Datei.** Bis zum 7. September stand dort ein voller Pfad auf
`berlin.pmtiles`, und der landete unabhängig von der geladenen Stadt im
Kartenstil: In Hamburg, Frankfurt und München lag der Ausschnitt außerhalb des
Archivs, und die Karte blieb leer — so, dass es nach „lädt noch" aussah statt
nach einem Fehler. Eine gesetzte Variable war damit schlechter als keine. Die
App hängt `<stadt>.pmtiles` selbst an, und `vite.config.ts` hält den Build an,
wenn der Wert auf `.pmtiles` endet.

### Was dadurch anders ist

| | Rasterkacheln | PMTiles |
| --- | --- | --- |
| Wer sieht die Nutzer-IPs | openstreetmap.org | niemand außer Cloudflare |
| Beschriftung | im Bild eingebrannt, englisch gemischt | Vektor, auf Deutsch |
| Aussehen | fremdbestimmt, nachträglich abgedunkelt | eigener Stil, passt zur Oberfläche |
| Kosten | keine, aber nicht gedeckt | keine, und gedeckt |

Der Stil kommt aus `@protomaps/basemaps` (Styles 5.7.2; das alte
`protomaps-themes-base` ist abgekündigt) und wird erst nachgeladen, wenn
`VITE_TILES_URL` gesetzt ist — sonst läge er in jedem Bündel, auch in dem der
Artifact-Fassung, die gar keine Kacheln laden darf. Die Kachelversion läuft
getrennt davon (Tiles 4.15.2); die beiden Stränge gehören zusammen, ein
Stil-Update erzwingt keinen neuen Kachelbau.

**Die Schriften liegen seit dem 7. September im selben Eimer** — unter
`glyphs/{fontstack}/{range}.pbf`, gespiegelt von
`packages/ingest/scripts/schriften-spiegeln.sh`. Damit macht die Vektorkarte
keinen einzigen fremden Abruf mehr. Gespiegelt werden die drei Schnitte, die
der Stil wirklich benutzt (nachgemessen an seinen 71 Ebenen), und von den 256
Unicode-Bereichen die 131, in denen etwas steht: 11 MB. Ein fehlender leerer
Bereich kostet eine 404 im Protokoll und kein Zeichen auf der Karte. Ein Sprite
gibt es nicht — FreiFahren hat auch keins.

## Wann sich Live-Abruf lohnt — und wann nicht

**Nicht sinnvoll live:** Parkzonen, Tarife, Geltungszeiten, P+R-Anlagen,
Behindertenparkplätze. Diese Daten ändern sich in Monaten. Ein täglicher
Snapshot ist frischer als die Quelle sich bewegt, und jede Live-Abfrage
belastet die Infrastruktur einer Behörde ohne Gegenwert.

**Sinnvoll live, soweit es die Quellen hergeben:**

| Was | Lage in Berlin |
| --- | --- |
| Ladepunkt-Belegung | Die e-Infoplattform der VIZ liefert seit Januar 2026 echten Status je Ladepunkt: `api.viz.berlin.de/e-infoplattform/chargecloud/lade-standort/geojsondps`. Deckt Berliner Stadtwerke, Qwello und Ubitricity ab. Lizenz im Dienst nicht ausgewiesen — vor produktiver Nutzung bei der SenMVKU klären. Aus dieser Umgebung nicht abrufbar, daher ungetestet. |
| Parkhaus-Belegung | **Existiert nicht als offene Quelle.** Die Parkhaus-Layer der VIZ sind statisch von 2021 (INRIX). ParkAPI/ParkenDD deckt Berlin nicht ab, APCOA liefert nur Stammdaten, TomTom nur gegen Vertrag, die DB-API ist abgekündigt. |
| Carsharing | Im GBFS-Register steht für Berlin nur Getaround. MILES und Free2Move veröffentlichen kein offenes Feed. |
| P+R-Auslastung | Das Feld `auslastung` ist ein statischer Erfahrungswert zur Hauptverkehrszeit, keine Echtzeit. |

Für alles davon ist der Worker mit kurzer TTL (30–120 Sekunden) der richtige
Ort — nicht der Browser des Nutzers.

**Immer live:** die Ordnungsamt-Meldungen. Sie sind nur Minuten gültig.

