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

**Stand am 6. September 2026, abends:** Das Repository ist öffentlich, GitHub
Pages ist eingeschaltet und liefert aus, das Cloudflare-Konto steht, und das
API-Token hat seit dem Nachtrag unten auch `Workers Scripts:Edit`. Offen sind
der erste erfolgreiche Worker-Deploy, `VITE_API_BASE` und der R2-Eimer für die
Kacheln.

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

### GitHub Pages — eingeschaltet am 6. September

Bis dahin baute der Workflow sauber durch und scheiterte erst am letzten
Schritt:

> `Failed to create deployment (status: 404) … Ensure GitHub Pages has been enabled`

Das war kein Fehler im Workflow, sondern ein Schalter im Repository:
*Settings → Pages → Build and deployment → Source* auf **GitHub Actions**.
Seither ist der Lauf grün. Die App liegt unter
`https://knoellchenfrei.github.io/knoellchenfrei/`. **Ins Feld *Custom domain*
gehört nichts:** `knoellchenfrei.de` ist für Cloudflare Pages vorgesehen, und
ein Hostname kann nur an einer Stelle liegen. Die Begründung im Einzelnen
steht in [todo.md](todo.md#7-auftritt--du-vorbereitet-ist-alles).

Der Vollständigkeit halber, falls das Repository je wieder privat wird: Dann
braucht Pages einen bezahlten Plan (GitHub Pro, Team oder Enterprise), und die
Einstellungsseite zeigt das Feature schlicht nicht an. Cloudflare Pages kennt
diese Grenze nicht.

Build-Kommando: `pnpm install && pnpm --filter @knoellchenfrei/web build`,
Ausgabeverzeichnis `app/apps/web/dist`.

Der Workflow unter `.github/workflows/pages.yml` zieht die Daten vor jedem
Deploy frisch und läuft zusätzlich täglich um 04:17 UTC. Damit ist der
Datenstand nie älter als 24 Stunden — bei Zonendaten, die sich über Monate
ändern, ist das reichlich.

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

`--jurisdiction eu` ist die stärkere Zusage: Sie **beschränkt** Ausführung und
Speicherung auf die EU, und ein gesetzter `--location`-Hinweis wird dann
ignoriert. Für alles, was über eine Demo hinausgeht, ist das die richtige Wahl.

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
`wrangler.toml` keine `routes` deklariert. Nachgesehen: Dort stehen nur `name`,
`main`, Bindings, Cron-Trigger und Vars; der Worker liegt auf der
`workers.dev`-Adresse.

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
kommen als `migrations/NNNN_name.sql` dazu, aufsteigend nummeriert.

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

### Telegram anschließen

Der Bot ist kein zweiter Dienst: Er hängt als Route `/telegram` an demselben
Worker und schreibt über denselben Pfad in dieselben Tabellen wie die Web-App.
Ein eigener Worker wäre eine zweite Betriebsumgebung für eine Funktion, die
sich mit der ersten alles teilt.

1. In Telegram **@BotFather** anschreiben, `/newbot`, Namen vergeben. Am Ende
   steht ein Token.
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
steht. In Cloudflare Pages unter *Settings → Environment variables*:

```
VITE_API_BASE = https://knoellchenfrei-api.<konto>.workers.dev
```

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

`visits` beantwortet beide Live-Zahlen ohne Anwesenheitskanal: „gerade offen"
sind Zeilen, die in den letzten fünf Minuten aktualisiert wurden, „heute" sind
Zeilen mit dem heutigen Datum. Weil jeder Ping dieselbe Zeile überschreibt,
entsteht **kein** Verlauf — die Zeile hält den letzten Ping, nie eine Folge.
Der stündliche Cron-Job löscht, was aus dem Fenster fällt.

## 4. Eigene Kartenkacheln

Vorbereitet, nicht scharf geschaltet: Die App kann Vektorkacheln aus einem
PMTiles-Archiv zeichnen, sobald es eins gibt. Ohne `VITE_TILES_URL` bleibt alles
wie bisher bei den Rasterkacheln von OpenStreetMap.

### Archiv bauen

Kein eigener OSM-Import nötig. Protomaps veröffentlicht täglich eine globale
Basiskarte; daraus wird per Range-Request nur Berlin herausgeschnitten:

```bash
# Datum eines Tagesarchivs von https://maps.protomaps.com/builds
app/packages/ingest/scripts/build-tiles.sh
```

Das Skript nennt am Ende den Upload-Befehl. Der Pfad im Eimer trägt das Datum
(`/v20260730/berlin.pmtiles`), damit ein Zwischenstand nie eine laufende Version
überschreibt und der Browser beliebig lange cachen darf.

### Eimer einrichten

```bash
npx wrangler r2 bucket create knoellchenfrei-tiles
```

Zwei Einstellungen entscheiden, ob überhaupt ein Byte ankommt:

- **CORS** für die Domain der Web-App. Ohne das lehnt der Browser jede
  Kachelanfrage ab, ohne dass die Karte einen Fehler zeigt — sie bleibt
  einfach leer.
- **Range-Requests** müssen durchgereicht werden. Genau darauf beruht das
  Verfahren: Der Browser lädt nie die ganze Datei, sondern die Bytes des
  sichtbaren Ausschnitts.

Danach eine eigene Domain vor den Eimer hängen (`tiles.knoellchenfrei.de`) und
die Web-App darauf zeigen lassen — Buildzeit, nicht Laufzeit:

```
VITE_TILES_URL=https://tiles.knoellchenfrei.de/v20260730/berlin.pmtiles
```

### Was dann anders ist

| | Rasterkacheln (heute) | PMTiles (danach) |
| --- | --- | --- |
| Wer sieht die Nutzer-IPs | openstreetmap.org | niemand außer Cloudflare |
| Beschriftung | im Bild eingebrannt, englisch gemischt | Vektor, auf Deutsch |
| Aussehen | fremdbestimmt, nachträglich abgedunkelt | eigener Stil, passt zur Oberfläche |
| Kosten | keine, aber nicht gedeckt | keine, und gedeckt |

Der Stil kommt aus `protomaps-themes-base` und wird erst nachgeladen, wenn
`VITE_TILES_URL` gesetzt ist — sonst läge er in jedem Bündel, auch in dem der
Artifact-Fassung, die gar keine Kacheln laden darf.

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

