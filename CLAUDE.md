# Hinweise für Claude

Kurzfassung des Projekts steht in [README.md](README.md). Diese Datei enthält
das, was eine neue Sitzung sonst durch Ausprobieren herausfinden müsste.

## Was das ist

Eine PWA, die für Berliner Parkzonen sagt, ob gerade Gebührenpflicht gilt, was
es kostet und wie lange man stehen darf — aus dem amtlichen WFS der GDI Berlin.
Dazu gemeldete Ordnungsamt-Sichtungen und eine Heatmap der Kontrolldichte.
Vorbild in Aufbau, Hosting und Haltung ist
[FreiFahren](https://github.com/FreiFahren/FreiFahren).

Der Stand ist **geschlossener Testbetrieb**, nicht öffentlich. Warum, und was
davor noch passieren muss, steht in [docs/todo.md](docs/todo.md) — das ist die
verbindliche Liste, nicht dieser Absatz.

## Befehle

```bash
pnpm -r typecheck                                   # alles, streng
pnpm --filter @parkingzone/core test                # 179 Unit-Tests
pnpm --filter @parkingzone/core test:coverage       # Coverage-Bericht
pnpm --filter @parkingzone/web build                # Web-Build
pnpm artifact                                       # Einzeldatei fürs Artifact
cd apps/web && npx playwright test                  # 101 End-to-End-Tests
```

`pnpm test` im Wurzelverzeichnis läuft über alle Pakete, aber nur `core` hat
Tests. `npx vitest run` von dort greift versehentlich die Playwright-Dateien
ab und scheitert — nicht der Code ist kaputt, der Aufruf ist falsch.

Erzeugte Dateien, nur bei Bedarf neu bauen:

```bash
cd apps/web
node scripts/make-icons.mjs                         # Symbole aus einer SVG-Quelle
node scripts/make-screenshots.mjs                   # Bilder für die Installations-Karte
node scripts/make-docs-images.mjs                   # Bilder für README und Doku
cd ../../packages/ingest
TEST_COUNT=179 E2E_COUNT=101 npx tsx src/build-badges.ts
scripts/build-tiles.sh 20260730                     # PMTiles-Ausschnitt Berlin
```

## Eigenheiten der Umgebung

Diese kosten sonst je eine halbe Stunde Fehlersuche:

| | |
| --- | --- |
| **Playwright** | Der vorinstallierte Chromium passt nicht zur erwarteten Build-Nummer. Immer mit `PLAYWRIGHT_CHROMIUM=/opt/pw-browsers/chromium-1194/chrome-linux/chrome` aufrufen (die Nummer kann sich ändern, `ls /opt/pw-browsers`). Die Skripte oben lesen dieselbe Variable. |
| **Kartenkacheln** | Der Egress-Proxy hat `tile.openstreetmap.org` zeitweise gesperrt; seit dem 6. September 2026 ist er offen. Was bleibt: Bilder in `public/screenshots/` und `docs/images/` sind noch ohne Hintergrundkarte aufgenommen. |
| **Node und der Proxy** | Node ist hier anders als curl: Sein `fetch` ignoriert `HTTPS_PROXY`. Direkt hinaus antwortet `geodienste.hamburg.de` mit **403** — kein Netzwerkfehler, keine TLS-Meldung, nur ein Verbot, das nach einer Sperre der Behörde aussieht. Abhilfe: `NODE_USE_ENV_PROXY=1`, das `fetch-data`-Skript setzt es. Für curl gilt umgekehrt: `gdi.berlin.de` braucht `--cacert $(python3 -c 'import certifi; print(certifi.where())')`, weil dem System-Bundle die Telekom-Wurzel fehlt. |
| **`pnpm fetch`** | Ist ein **eingebautes pnpm-Kommando** und lief still statt des Projektskripts. Das Skript heißt deshalb `fetch-data`. |
| **Artifact** | Die Sicherheitsrichtlinie des Artifact-Sandkastens blockiert **jede** Bildanfrage an fremde Adressen. Im veröffentlichten Artifact gibt es prinzipiell keine Hintergrundkarte. Auch das ist kein Fehler. |
| **E2E und die Karte** | `ready()` in `e2e/app.spec.ts` wartet auch darauf, dass `.loading` verschwindet. Ohne das klickten drei Tests auf eine Karte, an der noch keine Klick-Handler hingen: Mit gesperrtem Kachelserver kommt `styledata` nie, und `withMapReady` in `App.tsx` greift erst nach seinem 10-Sekunden-Rückfall. Auf einem kalten Lauf gingen sie durch, auf jedem weiteren fielen sie. |
| **Weitere Sperren** | `download.geofabrik.de`, RDAP- und Whois-Dienste, `abfelbaum.dev`. `api.github.com` geht, ist aber auf die Repositories dieser Sitzung beschränkt. |
| **add_repo** | Ein Repository unter einem *anderen* Eigentümer lässt sich nicht nachladen („cross-tier adds are not supported"). Dafür braucht es eine neue Sitzung mit diesem Repository als Quelle. |

## Regeln, die aus Fehlern entstanden sind

Jede hat einen Vorfall hinter sich. Sie stehen hier, damit er sich nicht
wiederholt.

- **Das Artifact wird mit `pnpm artifact` gebaut, nie durch Einpacken von
  `dist/`.** Der aufgeteilte Build importiert den MapLibre-Teil relativ; in
  einer eingebetteten Datei löst dieser Import nicht auf, und die Seite bleibt
  schwarz. `assertSelfContained` in `packages/ingest/src/build-artifact.ts`
  bricht seitdem ab, statt das auszuliefern.
- **Keine mehrzeiligen Commit-Nachrichten in einem `run: |`-Block einer
  Workflow-Datei.** Das bricht zweimal aus dem YAML-Blockskalar aus und hat
  zweimal kaputte Workflows gepusht. Zwei `-m`-Flags benutzen.
  `lint-workflows.yml` prüft seitdem jede Workflow-Datei.
- **Bei Skript-Ketten mit `&&` prüfen, ob das Skript wirklich abgebrochen hat.**
  Ein fehlgeschlagenes Python-Heredoc hat die Kette nicht gestoppt; der Commit
  ging raus und der Erfolg wurde gemeldet, obwohl nichts geändert war.
- **Nach einem Eingriff in die Oberfläche die volle E2E-Suite laufen lassen,
  bevor committet wird.** Ein zweiter `.callout` in den Einstellungen hat einen
  bestehenden Strict-Mode-Test gebrochen; der Commit war da schon draußen.
- **Nichts an Rohdaten speichern, was eine Person zurückverfolgbar macht.**
  IP-Adressen und Telegram-Kennungen werden mit `CLIENT_SALT` gehasht,
  Koordinaten gerundet, Zeiten auf fünf Minuten gebucketet, Chat-Kennungen gar
  nicht gespeichert. Freitext-Feedback hat **keinen** Lesepfad — es ist
  absichtlich nur für den Betreiber.
- **Die Historie des alten Repositories nicht umschreiben.** In den Commits von
  2012 steht ein Passwort; der Weg ist ein neues Repository mit einem Commit,
  nicht ein `filter-repo` über bestehende Klone. `scripts/umzug.sh` macht das.
- **Eine unbekannte Stadt fällt nicht auf Berlin zurück, sie wirft.**
  `cityByKey`, `holidaysFor` und `citySources` brechen bei einem Schlüssel ab,
  den sie nicht kennen. Ein stiller Rückfall wäre die schlechteste Antwort: Eine
  Hamburg-Instanz mit einem Tippfehler in der Konfiguration würde Berliner
  Grenzen anlegen und jede Hamburger Meldung mit „position outside" abweisen —
  im Log stünde nichts, was nach einem Fehler aussieht. Der einzige erlaubte
  Rückfall ist eine *fehlende* Angabe: Ohne `VITE_CITY` bzw. `CITY` bleibt es
  Berlin, weil das die Stadt ist, die heute ausgeliefert wird.
- **Stadtgrenzen stehen genau einmal, in `core/city.ts`.** Sie standen vorher
  an sechs Stellen als Zahlenpaar — im Browser-Speicher zweimal, beim Merken des
  Parkplatzes, im Worker und im Telegram-Parser. Laufen zwei davon auseinander,
  nimmt die App eine Meldung an, die der Server danach verwirft, und niemand
  erfährt, warum.
- **Zwei Feeds, zwei Parser — nie ein gemeinsamer.** Berlins und Hamburgs
  Dienste teilen sich außer der Domäne nichts: andere Felder, andere
  Schreibweisen, anderes Ausgabeformat, andere Achsenreihenfolge. Ein Parser
  für beide wäre bei jeder Änderung an einer Stadt für die andere gefährlich.
  `parse-schedule.ts`/`parse-fee.ts` sind Berlin, `hamburg.ts` ist Hamburg.
- **Die Achsenreihenfolge steht in der Konfiguration, nie in einer Heuristik.**
  Auf dieselbe Anfrage (`urn:ogc:def:crs:EPSG::4326`) antwortet Berlin mit
  `[lon, lat]` und Hamburg mit `[lat, lon]`. In Hamburg sind beide Zahlen
  zweistellig und plausibel — geraten landen die Gebiete im Golf von Guinea,
  und die Karte sieht dabei nur leer aus, nicht kaputt.
- **Kein Betrag ist nicht null Euro.** Hamburgs Parkscheibengebiete kosten
  nichts und verlangen trotzdem etwas; wer ohne Scheibe steht, zahlt.
  `Fee` hat dafür `disc` und `unknown`, und `CostEstimate.priced` zwingt die
  Oberfläche, etwas anderes zu sagen als „0,00 €".
- **Der Beta-Riegel ist die Voreinstellung.** Ohne `PUBLIC_LAUNCH=1` baut Vite
  `noindex` und eine sperrende `robots.txt` ein. Solange das Impressum auf eine
  Privatperson läuft, entscheidet dieser Schalter, ob die Anschrift in Indizes
  und Archiven landet.

## Stil

- **Kommentare erklären das Warum, nicht das Was.** Der Bestand ist so
  geschrieben; deutsche Kommentare bei neuem Code, die englischen im Bestand
  bleiben stehen. Wo ein Kommentar einen konkreten Fehler festhält, gehört der
  Fehler hinein — er ist die Begründung.
- **Für jeden gefundenen Fehler ein Test.** 24 der Unit-Tests sind genau das.
- **TypeScript streng**, inklusive `noUncheckedIndexedAccess` und
  `exactOptionalPropertyTypes`. Kein `any`, keine nicht begründeten Casts.
- **`packages/core` bleibt frei von Frameworks und ohne Laufzeit-Abhängigkeiten.**
  Alles, was fremde Eingaben zerlegt, gehört dorthin — dort lässt es sich mit
  Unfug beschießen. Der Telegram-Parser ist das jüngste Beispiel.
- **Berlin darf nicht fest verdrahtet werden.** Eine zweite Stadt ist stehende
  Anforderung. Was heute noch Berlin-spezifisch ist, steht in
  [docs/oeffentlich-machen.md](docs/oeffentlich-machen.md).

## Wo was steht

| Datei | Inhalt |
| --- | --- |
| [docs/neue-sitzung.md](docs/neue-sitzung.md) | Womit eine frische Sitzung anfängt |
| [docs/todo.md](docs/todo.md) | Die Handover-Liste: was offen ist, und wer es tun kann |
| [docs/entscheidungen.md](docs/entscheidungen.md) | Getroffene Entscheidungen mit Begründung und Quellen |
| [docs/hosting.md](docs/hosting.md) | Cloudflare, Worker, D1, Telegram, PMTiles — mit Befehlen |
| [docs/architecture.md](docs/architecture.md) | Aufbau und die Fallstricke im Detail |
| [docs/data-sources.md](docs/data-sources.md) | Woher die Daten kommen, was sie taugen |
| [docs/staedte.md](docs/staedte.md) | Zweite Stadt: Datenlage, Prüfliste, Hamburg im Einzelnen |
| [docs/marke.md](docs/marke.md) | Bilder, Beschreibungstexte, Namensschema — und was davon von Hand geht |
| [docs/sitzungsstatistik.md](docs/sitzungsstatistik.md) | Gemessene Kennzahlen der Sitzungen: Modell, Tokens, Werkzeuge, Agenten |
| [SECURITY.md](SECURITY.md) | Bedrohungsmodell und Maßnahmen |
