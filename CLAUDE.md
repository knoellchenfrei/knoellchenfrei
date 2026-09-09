# Hinweise für Claude

Kurzfassung des Projekts steht in [README.md](README.md). Diese Datei enthält
das, was eine neue Sitzung sonst durch Ausprobieren herausfinden müsste.

## Was das ist

Eine PWA, die für Parkzonen sagt, ob gerade Gebührenpflicht gilt, was es
kostet und wie lange man stehen darf — aus den amtlichen WFS der Städte.
Angeschlossen sind Berlin, Hamburg, Frankfurt am Main, München, Köln,
Düsseldorf und Karlsruhe — die letzten drei seit dem 9. September, siehe
`docs/staedte-koeln.md`, `docs/staedte-duesseldorf.md`, `docs/staedte-karlsruhe.md`.
Ausgeliefert wird sie hinter einem Passwort-Riegel — der Stand ist geschlossener
Testbetrieb, siehe `apps/web/functions/_middleware.ts` und `docs/hosting.md`.
Dazu gemeldete Ordnungsamt-Sichtungen und eine Heatmap der Kontrolldichte.
Vorbild in Aufbau, Hosting und Haltung ist
[FreiFahren](https://github.com/FreiFahren/FreiFahren).

Der Stand ist **geschlossener Testbetrieb**, nicht öffentlich. Warum, und was
davor noch passieren muss, steht in [docs/todo.md](docs/todo.md) — das ist die
verbindliche Liste, nicht dieser Absatz.

## Befehle

**Alles hier läuft aus `app/`, nicht aus dem Wurzelverzeichnis.** Das ist kein
Stil, sondern eine Falle: Im Wurzelverzeichnis gibt es absichtlich keine
`package.json` und keine `pnpm-workspace.yaml`, und `pnpm install` **legt sich
die zweite selbst an** — von da an findet pnpm von hier aus den falschen
Workspace. Die `.gitignore` sperrt beide Dateien aus genau diesem Grund.

```bash
cd app
pnpm -r typecheck                                   # alles, streng
pnpm test                                           # 1117 Unit-Tests (core, api, web)
pnpm --filter @knoellchenfrei/core test:coverage       # Coverage-Bericht (99,9 % Zeilen)
pnpm --filter @knoellchenfrei/web build                # Web-Build
pnpm artifact                                       # Einzeldatei fürs Artifact
cd apps/web && npx playwright test                  # 196 End-to-End-Tests
```

Und fünf Prüfungen, die kein Compiler ist — **vom Wurzelverzeichnis aus**, nicht
aus `app/`. Alle fünf laufen in der CI, und jede hat einen Vorfall hinter sich:

```bash
./scripts/sprache-pruefen.sh    # Prosa mit Umlauten, Bezeichner ohne
node scripts/doku-pruefen.mjs   # Abschnitte lückenlos, Verweise tragen, nichts verwaist
./scripts/namen-pruefen.sh      # Ressourcennamen stimmen überein
./scripts/geheimnisse-pruefen.sh  # keine Secrets im gebauten Bündel
shellcheck scripts/*.sh app/packages/ingest/scripts/*.sh   # die Shell-Skripte
```

**`shellcheck` stand bis zum 9. September nur in der CI und in keiner
Anleitung** — und genau deshalb ging ein neues Skript rot hinaus, ohne dass es
jemand vor dem Push gesehen hätte. Zweimal `SC2016`: Backticks in einer
einfach gequoteten `printf`-Zeichenkette, für shellcheck eine
Kommandosubstitution, die nicht expandiert. Nur ein Hinweis, aber die Prüfung
bricht trotzdem ab. Auf macOS liegt das Werkzeug über Homebrew, in der CI kommt
es aus `apt`; beide finden dasselbe.

Und **zwei weitere von Hand**, absichtlich nicht in der CI — beide brauchen
etwas, das ein Workflow nicht hat:

```bash
./scripts/ausgeliefert-pruefen.sh    # beide Adressen: Riegel, Kopfzeilen, keine offene Weiterleitung
./scripts/einstellungen-pruefen.sh   # die Sicherheitsschalter bei GitHub
```

Und ein dritter Handlauf, der einen **lokalen Worker** braucht:
`apps/web/scripts/durchklicken.mjs` klickt die App wie drei Nutzer durch
(melden, bestätigen, „weg", Kontrolldichte, Statistik) — der Weg steht in
`CONTRIBUTING.md` unter „Gegen einen lokalen Worker". Die E2E-Suite sieht den
Worker nie; zwei Fehler vom 9. September lagen genau dort.

Die erste braucht die echte Adresse, die ein Fork nicht hätte. Die zweite
braucht ein Token mit Verwaltungsrecht: Das `GITHUB_TOKEN` eines Workflows darf
`security_and_analysis` gar nicht lesen und bekäme für jedes Feld `null` — dort
wäre die Prüfung immer „nicht prüfbar" und damit Dekoration. Sie unterscheidet
das ausdrücklich vom Erfolg: ohne `gh`, ohne Anmeldung oder ohne Recht endet
sie mit Rückgabewert **2**, nicht 0. Ihr Anlass steht in `SECURITY.md`.

Sie schliesst die Lücke, die dieses Projekt zweimal getroffen hat: Die
E2E-Suite misst gegen `vite preview`, und der kennt weder die Pages-Funktion
mit dem Riegel noch Cloudflares Weiterleitungen. Der **308** auf
`/index.html` und die **fehlende MapLibre-Worker-Datei** waren beide nur an der
ausgelieferten Adresse zu sehen — beide mit einem Status, der Erfolg meldet.
Das Skript sieht deshalb auf Status **und** Content-Type.

`pnpm test` in `app/` läuft über alle Pakete — seit dem 8. September haben
**alle vier** Tests: `core` (778), `apps/api` (86, Worker und Zählwerk),
`apps/web` (237, Beta-Riegel, Zähler, Besuchszähler, Flächenkennung, Namen,
Formatierung, Speicher, Datenquelle, Flächenpunkt, Aktualisieren,
Stadtwahl, drei Komponenten mit jsdom) und `packages/ingest` (16, die zwei
Wächter des Artifact-Baus und der Datenstand). Die drei letzten haben eine eigene `vitest.config.ts`, die eng
auf `test/` schneidet — ohne diese Grenze greift Vitest in `apps/web` die
Playwright-Dateien unter `e2e/` ab. `npx vitest run` von dort greift versehentlich die Playwright-Dateien
ab und scheitert — nicht der Code ist kaputt, der Aufruf ist falsch.

Erzeugte Dateien, nur bei Bedarf neu bauen:

```bash
cd app/apps/web
node scripts/make-icons.mjs                         # Symbole aus einer SVG-Quelle
node scripts/kacheln-lokal.mjs /tmp/kacheln 4190    # Kachelarchiv lokal, für die zwei Zeilen darunter
node scripts/make-screenshots.mjs                   # Bilder für die Installations-Karte
node scripts/make-docs-images.mjs                   # Bilder für README und Doku
cd ../../packages/ingest
TEST_COUNT=1117 E2E_COUNT=196 npx tsx src/build-badges.ts
npx tsx src/build-notices.ts                        # Lizenztexte der Abhängigkeiten
# Passt der eingecheckte Abzug noch zum Code? Neu bauen und vergleichen:
#   CITY=berlin OUT_DIR=/tmp/neubau pnpm --filter @knoellchenfrei/ingest build-data
#   diff -rq /tmp/neubau/berlin ../../apps/web/public/data/berlin
# Am 9. September für alle vier Städte gemacht: byteweise identisch.
scripts/build-tiles.sh --hochladen                  # PMTiles je Stadt, nach R2
# Wie alt der Abzug je Stadt ist (geprueftAm in meta.json), vom Wurzelverzeichnis:
#   node scripts/datenstand-pruefen.mjs
```

## Eigenheiten der Umgebung

Diese kosten sonst je eine halbe Stunde Fehlersuche:

| | |
| --- | --- |
| **Playwright** | Der vorinstallierte Chromium passt nicht zur erwarteten Build-Nummer. Immer mit `PLAYWRIGHT_CHROMIUM=/opt/pw-browsers/chromium-1194/chrome-linux/chrome` aufrufen (die Nummer kann sich ändern, `ls /opt/pw-browsers`). Die Skripte oben lesen dieselbe Variable. |
| **Kartenkacheln** | Der Egress-Proxy hat `tile.openstreetmap.org` zeitweise gesperrt; seit dem 6. September 2026 ist er offen. Die Bilder in `public/screenshots/` und `docs/images/` sind seit dem 7. September mit Karte aufgenommen — mit dem **eigenen Vektorarchiv**, lokal ausgeliefert. Direkt gegen `tiles.knoellchenfrei.de` zu bauen geht nicht: Die R2-CORS-Regel lässt nur `https://knoellchenfrei.de` zu, die Aufnahme läuft gegen `127.0.0.1`, und das Ergebnis sieht aus wie eine leere Karte statt wie ein Fehler. Der Weg steht in `docs/todo.md`. |
| **Node und der Proxy** | Node ist hier anders als curl: Sein `fetch` ignoriert `HTTPS_PROXY`. Direkt hinaus antwortet `geodienste.hamburg.de` mit **403** — kein Netzwerkfehler, keine TLS-Meldung, nur ein Verbot, das nach einer Sperre der Behörde aussieht. Abhilfe: `NODE_USE_ENV_PROXY=1`, das `fetch-data`-Skript setzt es. Für curl gilt umgekehrt: `gdi.berlin.de` braucht `--cacert $(python3 -c 'import certifi; print(certifi.where())')`, weil dem System-Bundle die Telekom-Wurzel fehlt. |
| **pnpm 8 ignoriert das Lockfile still** | `pnpm install` mit einer zu alten Version meldet nur `WARN Ignoring broken lockfile … not compatible with current pnpm` — und **löst dann frisch auf**. Damit ist jede Festschreibung weg, und der Lauf sieht erfolgreich aus. Gemeldet am 7. September mit pnpm 8.15.9; unser Lockfile ist `lockfileVersion 9.0`. Seitdem steht `engines.pnpm: ">=10"` in `app/package.json` — nachgemessen, dass pnpm das **erzwingt** und nicht nur warnt. Richtig ist `corepack enable`; dann liest pnpm `packageManager: pnpm@10.33.0` und holt sich selbst die passende Version. |
| **`pnpm fetch`** | Ist ein **eingebautes pnpm-Kommando** und lief still statt des Projektskripts. Das Skript heißt deshalb `fetch-data`. |
| **Artifact** | Die Sicherheitsrichtlinie des Artifact-Sandkastens blockiert **jede** Bildanfrage an fremde Adressen. Im veröffentlichten Artifact gibt es prinzipiell keine Hintergrundkarte. Auch das ist kein Fehler. |
| **E2E und die Karte** | `ready()` in `e2e/app.spec.ts` wartet auch darauf, dass `.loading` verschwindet. Ohne das klickten drei Tests auf eine Karte, an der noch keine Klick-Handler hingen: Mit gesperrtem Kachelserver kommt `styledata` nie, und `withMapReady` in `App.tsx` greift erst nach seinem 10-Sekunden-Rückfall. Auf einem kalten Lauf gingen sie durch, auf jedem weiteren fielen sie. |
| **GitHub-Einstellungen** | Zwei getrennte Sperren, die gern verwechselt werden — und die erste gilt **nur in der Cloud-Sitzung**. Dort lehnt der Egress-Proxy jedes `PATCH /repos/…` ab: **„Repository settings writes are not permitted through this proxy"** — Beschreibung, Topics, Pages, Dependabot-Alerts gehen dort also auch mit einem berechtigten Token nicht. **Aus einer Sitzung auf dem Rechner des Betreibers geht es** — am 7. September sind Secret Scanning, Push Protection und Private Vulnerability Reporting genau so eingeschaltet worden. Vor „geht nicht" also nachsehen, wo die Sitzung läuft. Und für das **Organisationsbild** existiert in der GitHub-API gar kein Endpunkt; das kann ausschließlich die Weboberfläche. Ein Browser läuft hier zwar, aber kopflos und ohne Eingabekanal für den Nutzer — Anmelden ist keine Option. |
| **Workflow-Dateien** | Ein Merge über die REST-API scheitert an `refusing to allow a GitHub App to create or update workflow … without \`workflows\` permission`, sobald der PR eine Datei unter `.github/workflows/` anfasst. Der Git-Push kann es. Also: Dependabot-PRs an Workflows lokal mergen (`git merge --no-ff origin/dependabot/…`) und pushen — der PR schließt sich dann von selbst als *merged*. |
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
- **Ein leeres `${{ }}` in einer Workflow-Datei ist ein Syntaxfehler — auch im
  Kommentar.** GitHub wertet die Ausdruck-Klammern an *jeder* Stelle der Datei
  aus, und ein `run: |`-Block schützt nicht davor. Am 7. September stand die
  leere Form in einem Kommentar als Beispiel („nicht als `${…}` direkt in die
  Zeile"), und der Lauf scheiterte nach **null Sekunden** mit *„This run likely
  failed because of a workflow file issue"* — ohne Zeilennummer, ohne Log, ohne
  Job, und im Lauf steht statt des Workflow-Namens der Dateipfad. `js-yaml`
  findet das nicht, die Datei ist gültiges YAML. `lint-workflows.yml` sucht
  seitdem danach — und trat dabei prompt in dieselbe Falle: Die Fundmeldung
  enthielt die Klammern als Beispiel, diesmal maskiert für Pythons
  f-string (`${{{{ }}}}`), und GitHub las die erste Hälfte davon wieder als
  Ausdruck. **In dieser Datei darf die Zeichenfolge gar nicht vorkommen**, auch
  nicht maskiert, auch nicht in einer Fehlermeldung. Wer über sie schreiben
  will, umschreibt sie.
- **Commit-Nachrichten gehen über ein Heredoc mit gequotetem Begrenzer, nicht
  über `-m "…"`.** In einem doppelt gequoteten Argument führt die Shell alles
  aus, was zwischen Backticks steht — und Backticks sind in diesem Projekt die
  übliche Auszeichnung für Code. Am 8. September verschwand so ein
  `` `const gueltig =` `` aus einer Commit-Nachricht und hinterliess ein Loch
  mitten im Satz; gemerkt hat es nur, wer die Nachricht danach noch einmal
  gelesen hat. `git commit -F -` mit `<<'MSG'` schützt jedes Zeichen.
- **Keine mehrzeiligen Commit-Nachrichten in einem `run: |`-Block einer
  Workflow-Datei.** Das bricht zweimal aus dem YAML-Blockskalar aus und hat
  zweimal kaputte Workflows gepusht. Zwei `-m`-Flags benutzen.
  `lint-workflows.yml` prüft seitdem jede Workflow-Datei.
- **Bei Skript-Ketten mit `&&` prüfen, ob das Skript wirklich abgebrochen hat.**
  Ein fehlgeschlagenes Python-Heredoc hat die Kette nicht gestoppt; der Commit
  ging raus und der Erfolg wurde gemeldet, obwohl nichts geändert war.
  **Zweiter Vorfall am 8. September, andere Ursache, gleiche Wirkung:**
  `./scripts/sprache-pruefen.sh | tail -1 && git commit …`. Eine Pipeline hat
  den Status ihres **letzten** Glieds, und `tail` gelingt immer — die rote
  Prüfung ging als grün durch, der Commit lag draussen, bevor die Meldung
  gelesen war. Ein Prüfskript wird nie in eine Pipe gehängt; wer die Ausgabe
  kürzen will, nimmt `set -o pipefail` oder ruft es getrennt auf.

  **Dritter Vorfall, eine Stunde später, und diesmal die volle Wirkung:**
  `npx playwright test 2>&1 | tail -5`. Die Zusammenfassung von Playwright
  nennt die Fehlschläge in der **ersten** Zeile ihres Blocks — `tail -5`
  schneidet genau die ab und zeigt „1 skipped / 149 passed". Dazu ein
  `exited with code 0`, das `tail` gehörte. **Vier rote Tests sahen aus wie ein
  grüner Lauf.** Aufgefallen ist es nur daran, dass 149 + 1 nicht 154 ergibt.
  Die Suite wird deshalb in eine Datei geschrieben und die Zusammenfassung
  daraus gelesen: `npx playwright test --reporter=list > lauf.txt 2>&1`,
  danach `grep -E '[0-9]+ (passed|failed)' lauf.txt`. **Und die Testzahl wird
  nachgerechnet** — eine Suite, die plötzlich weniger Tests meldet, hat keine
  verloren, sondern welche verschwiegen.
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
  Rückfall ist eine *fehlende* Angabe: Ohne `VITE_CITY` bleibt es Berlin, weil
  das die Stadt ist, die heute ausgeliefert wird. Im Worker gibt es dafür seit
  dem 6. September **keine** Variable mehr — er liest die Stadt aus der
  Anfrage, weil eine Instanz alle vier bedient.
- **Stadtgrenzen stehen genau einmal, in `core/city.ts`.** Sie standen vorher
  an sechs Stellen als Zahlenpaar — im Browser-Speicher zweimal, beim Merken des
  Parkplatzes, im Worker und im Telegram-Parser. Laufen zwei davon auseinander,
  nimmt die App eine Meldung an, die der Server danach verwirft, und niemand
  erfährt, warum.
- **Demodaten sind auch Daten — sie hängen an der Stadt.** *(Seit dem
  9. September gibt es keine Demodaten mehr, siehe die Regel darunter; die
  Lehre gilt für alles, was an der Stadt hängt.)* `seed.ts` streute
  sechs Beispielmeldungen und acht Heatmap-Ecken über feste **Berliner**
  Koordinaten. In München lagen sie damit 500 km neben der Karte: nichts zu
  sehen, kein Fehler im Log, und die einzige sichtbare Spur war die Liste „am
  häufigsten kontrolliert", die dreimal „Außerhalb der Zonen" nannte — was wie
  eine Aussage über München aussah und eine über Berlin war. Sie stehen jetzt
  als Abstand zu `CITY.center`. Denselben Fehler machte ein Satz: „Außerhalb
  der Parkraumbewirtschaftung — hier ist Parken gebührenfrei" behauptet etwas
  über den Ort und wusste etwas über die geladenen Daten. Er entfällt seitdem,
  sobald die Position in einer anderen bekannten Stadt liegt.
- **Ein Feed, ein Parser — nie ein gemeinsamer.** Die vier Dienste teilen sich
  außer der Domäne nichts: andere Felder, andere Schreibweisen, anderes
  Ausgabeformat, andere Achsenreihenfolge. Berlin schreibt `Mo-Sa 9-20 Uhr` und
  `2,00 Euro`, Hamburg `werktags 9-20 Uhr` und `3,50 € je Stunde`, Frankfurt
  `Mo-Sa 9-20` ohne „Uhr" und `2 €/h`, München
  `Mischparken 18-23 Uhr Montag bis Freitag und 9-23 Uhr Samstag` und gar
  keinen Betrag. Ein Parser für alle wäre bei jeder Änderung an einer Stadt für
  die anderen gefährlich. `parse-schedule.ts`/`parse-fee.ts` sind Berlin,
  `hamburg.ts` ist Hamburg, `frankfurt.ts` ist Frankfurt, `muenchen.ts` ist
  München.
- **Die Achsenreihenfolge steht in der Konfiguration, nie in einer Heuristik.**
  Auf dieselbe Anfrage (`urn:ogc:def:crs:EPSG::4326`) antwortet Berlin mit
  `[lon, lat]`, Hamburg mit `[lat, lon]`, Frankfurt und München wieder mit
  `[lon, lat]`.
  In Hamburg sind beide Zahlen zweistellig und plausibel — geraten landen die
  Gebiete im Golf von Guinea, und die Karte sieht dabei nur leer aus, nicht
  kaputt.
- **`srsName` ist Pflicht, und das Ergebnis wird nachgemessen.** Frankfurts WFS
  antwortet **ohne** den Parameter stillschweigend in EPSG:25832:
  `[477189.85, 5550859.91]` — plausible Zahlen, nur keine Grade. Kein Fehler,
  keine Warnung, kein leeres Ergebnis; auf der Karte sähe es nur nach „leer"
  aus. `wfsUrl` setzt den Parameter für alle Städte, und `assertDegrees` im
  Frankfurter Datenbau bricht trotzdem ab, sobald ein Wert über 180 bzw. 90
  ankommt. Eine Konfiguration, deren Fehlen man nicht bemerkt, gehört geprüft
  und nicht geglaubt. Münchens GeoServer verhält sich genauso; `assertDegrees`
  steht deshalb auch in seinem Datenbau.
- **Ein Feldtyp über einer JSON-Datei ist eine Behauptung, kein Beweis.**
  `FrankfurtAutomatProperties.bewohnerparkzone` stand als `string | null` da
  und ist im Feed eine **Zahl**. TypeScript prüft eine gelesene JSON-Datei
  nicht; der Datenbau brach mit `claimed.trim is not a function` ab — ein
  Glücksfall, denn er *wollte* trimmen. Hätte er nur verglichen, wäre
  `19 === '19'` stillschweigend immer falsch gewesen, alle 921 Automaten wären
  „ohne Bereich" geblieben, und die Zahl im Log hätte plausibel ausgesehen.
  Jede Annahme über eine Fixture gehört deshalb in einen Test gegen die
  Fixture, nicht nur ins Interface.
- **Fehlt eine Ebene im Dienst, ist sie nicht weg — sie liegt woanders.**
  Frankfurts Parken-Dienst führt keine Verwaltungsgrenzen; sein
  `GetCapabilities` kennt genau drei Typnamen. Endpunkte zu raten
  (`/Stadtteile`, `/Verwaltungsgrenzen`, …) brachte sechsmal 404. Gefunden
  wurden die 46 Stadtteile über den **Metadatenkatalog** der Stadt: Die
  Wurzel des Dienst-Hosts leitet auf ein Geoportal um, das auf einen
  GeoNetwork-Katalog zeigt, dessen Suche den zweiten WFS nennt — samt Lizenz
  und Quellenvermerk. Der Weg dauert zehn Minuten und ersetzt einen Rückfall
  auf „Stadtname als Bezirk".
- **Kein Betrag ist nicht null Euro.** Hamburgs Parkscheibengebiete kosten
  nichts und verlangen trotzdem etwas; wer ohne Scheibe steht, zahlt.
  `Fee` hat dafür `disc` und `unknown`, und `CostEstimate.priced` zwingt die
  Oberfläche, etwas anderes zu sagen als „0,00 €".
- **Und null Euro sind auch kein Betrag.** Die Regel darüber hatte ein Loch:
  `parseFee("0,00 Euro")` ergab `exact` mit 0 Cent und damit `priced: true` —
  der einzige Weg, an der Marke vorbei doch ein „0,00 €" auf den Schirm zu
  bringen. Dasselbe in Hamburg (`0,00 € je Stunde`) und Frankfurt (`0 €/h`),
  wo `mergeFrankfurtFees` die Spanne eines ganzen Bereichs auf „0,00–4,00 €"
  heruntergezogen hätte. Alle drei Parser brechen jetzt ab, wie Frankfurt es
  mit `0 h` schon hielt: Was ein Nullbetrag im Feed bedeutete, weiß niemand,
  und „kostenlos" ist die eine Lesart, die er sicher nicht verdient. In keinem
  der vier Abzüge steht einer. Gefunden hat es der Beschuss in
  `test/fuzz.test.ts`.
- **Ein Parser wirft nur seine eigene Fehlerklasse.** `parseSchedule("Fr-Mo
  9-20 Uhr")` warf ein blankes `Error`: `expandDays` kannte die Rohzeile nicht
  und konnte deshalb keinen `ScheduleParseError` bauen. Eine umgedrehte
  Tagesspanne ist aber Feed-Inhalt und kein Fehler des Parsers — wer
  `instanceof` prüft, um „unlesbare Zeile" von „kaputtem Parser" zu
  unterscheiden, bekam für genau diese eine Schreibweise die falsche Antwort,
  und im Fehler fehlte die Zeile, um die es ging. Die Zusicherung steht jetzt
  als Eigenschaft in `fuzz.test.ts`: Bei beliebigen Zeichenketten wirft jeder
  der vier Zeit- und drei Gebührenparser **nur** seine eigene `*ParseError`
  oder liefert ein gültiges Ergebnis.
- **Ein Zeitstempel aus fremder Hand kann NaN sein.** `confidenceOf` klammerte
  die Zähler einer Sichtung, nicht aber `reportedAt`. Mit `NaN` darin wurden
  `ageMs` und `score` zu `NaN`. Der Status fiel dabei zufällig richtig aus —
  jeder Vergleich mit `NaN` ist falsch, also fiel er durch beide Schwellen —,
  aber die zugesicherte Spanne 0..1 galt nicht mehr, und aus `ageMs` hätte die
  Oberfläche „vor NaN Min." geschrieben. Ein unlesbarer Zeitstempel heißt
  jetzt unendlich alt.
- **Eine Regelphrase braucht eine Wortgrenze auf BEIDEN Seiten — und `\b`
  taugt nur auf der vorderen.** Münchens Regeltexte werden an Phrasen wie
  `Mischparken` und `frei` in Klauseln zerschnitten. Ohne hintere Grenze fand
  `frei` das „Frei" in **Freitag**: `Mischparken 18-23 Uhr Montag bis Freitag`
  zerfiel in zwei Klauseln, die zweite hieß „frei" und hatte den Rest „tag",
  und die erste verlor ihre Tagesangabe. 176 der 291 Texte brachen daran ab.
  Dasselbe eine Ebene tiefer bei den Wochentagsabkürzungen: Mit `i`-Flag las
  `Mi` das „mi" in **mit**, `Fr` das „fr" in **free floating**, `So` das „so"
  in **sonst**, `Mo` das „Mo" in **(Motorradparken)**. Und `\b` als hintere
  Grenze geht nicht, weil die Quelle `Mischparken13-23 Uhr` ohne Leerzeichen
  schreibt — zwischen `n` und `1` steht keine Wortgrenze. Richtig ist
  `(?![\p{L}])`: Ziffer erlaubt, Buchstabe nicht. Beide Fälle brachen laut ab;
  der leise wäre eine Klausel gewesen, deren Fenster plötzlich am Sonntag hängt.
- **In einer Endungs-Alternative steht die lange Endung vor der kurzen.**
  `Schultag(?:e|en|s)?` liest bei „Schultagen" nur „Schultage" und lässt ein
  „n" liegen — dreizehn Abschnitte sind genau daran abgebrochen.
  `(?:en|es|e|s)` ist richtig. Reguläre Ausdrücke nehmen die erste passende
  Alternative, nicht die längste.
- **Im `u`-Modus sind `\-` und `\/` ungültige Escapes.** Eine
  Maskier-Funktion, die wie üblich `[.*+?^${}()|[\]\\/-]` ersetzt, lässt einen
  `RegExp` mit `u`-Flag gar nicht erst entstehen: `SyntaxError: Invalid regular
  expression: … Invalid escape`. Beide Zeichen brauchen außerhalb einer
  Zeichenklasse keine Maskierung. Aufgefallen an `Duales Parken Sommer/Winter`
  und `E-Carsharing`.
- **Ein Feiertag kann an der Stadt hängen statt am Land.** Mariä Himmelfahrt
  gilt nach Art. 1 Abs. 1 Nr. 2 BayFTG „in Gemeinden mit überwiegend
  katholischer Bevölkerung" — in 1.708 der 2.056 bayerischen Gemeinden, also in
  München und nicht in Nürnberg; Augsburg hat zusätzlich das Friedensfest.
  `Record<Land, …>` kann das nicht ausdrücken und hätte für die eine oder die
  andere Stadt zwangsläufig unrecht. Deshalb `City.holidays`,
  `holidaysFor(land, jahr, extraFixed)` und `ParkingZone.extraHolidays`. Ein
  Zusatzdatum, das nicht `MM-TT` ist, **wirft** — ein Tippfehler wie `15-08`
  passte sonst auf keinen Schlüssel und bewirkte stillschweigend nichts.
  Belegt wird so etwas gegen die amtliche Feststellung, hier die
  Gemeindeabfrage des Bayerischen Landesamts für Statistik, nicht gegen ein
  Gefühl.
- **Eine Zusatzregel ist nicht automatisch die, die man kennt.**
  `isUncertainAt` in `tariff.ts` fragte nur, ob `unmodelledRules` irgendetwas
  enthält — und bis München war jede solche Regel Berlins „Advents-Sa". München
  schreibt „Regelung nur an Schultagen" hinein; an einem Adventssamstag hätte
  die App über jedem Münchner Gebiet damit „unsicher" gezeigt und in der
  Erklärung den Adventssamstag genannt. Die Funktion filtert seitdem auf
  Regeln, die Advent überhaupt erwähnen (`adventRulesOf`), und der Satz im
  Panel nennt die Regel wörtlich statt eine Jahreszeit.
- **Bei einem Feed, der aus mehreren Ebenen besteht, entscheidet die
  Ebenen-Gruppe, WAS gezählt wird, und der Parser, WAS gilt.** Münchens
  `E-Ladeinfrastruktur … 4h mit Parkscheibe` endet auf eine echte
  Parkscheiben-Klausel und ist trotzdem ein Ladeplatz — 1.171-mal. Ohne den
  Filter über `parkregel_gruppe` zählte er bei den Stellplätzen mit und stünde
  unter „Zeiten laut Quelle" ganz oben. Umgekehrt liefern
  Behindertenparkplätze mit Abendfenster sehr wohl ein gültiges
  Gebührenfenster für das Gebiet. Zwei Fragen, zwei Filter.
- **Ein fehlendes Feld ist kein Beweis, dass es das Feld nicht gibt.**
  `get_session` → `external_metadata.usage` (Tokens und Kosten der Sitzung)
  wird **mit Verzug** geschrieben: um 16:02 fehlte der Block, um 16:21 war er
  da. Ich hatte daraus geschlossen und aufgeschrieben, für diese Sitzung gebe
  es keine Abrechnung. Vor „gibt es nicht" also noch einmal fragen. Für eine
  *fremde* Sitzung desselben Kontos geht derselbe Aufruf mit `session_id` —
  so lässt sich eine Vorgängersitzung nachprüfen, statt ihre Zahlen zu glauben.
- **Abhängigkeiten aktualisiert Dependabot, nicht Renovate.** Begründung und
  Konfiguration in `.github/dependabot.yml`. Zwei Dinge daraus, die man leicht
  falsch annimmt: `cooldown` gilt **nur für Versionsupdates**, nie für
  Sicherheitsupdates. Und ohne gesetzten `cooldown` wartet Dependabot trotzdem
  drei Tage — die Vorgabe ist nicht abwählbar, sie wird auch dann an pnpm
  durchgereicht.
- **Dependabots `cooldown` braucht mit pnpm eine Ausnahmeliste.** Er wird in
  pnpms `minimumReleaseAge` übersetzt und über den ganzen Auflösungslauf
  gelegt; pnpm prüft aber erst nach dem Auflösen und **fällt nicht auf eine
  ältere passende Version zurück**, sondern bricht ab. Ein einziges Paket im
  Baum, das jünger ist als das Fenster, lässt jedes Update scheitern — beim
  ersten Lauf `@playwright/test`, 41 Stunden alt und im Lockfile längst
  festgeschrieben. Den Cooldown *herauszunehmen* half nicht: Dependabot reicht
  auch seine eingebaute Drei-Tage-Vorgabe durch. Die Abhilfe ist
  `minimumReleaseAgeExclude: ['*']` in `app/pnpm-workspace.yaml` — wirkungslos
  lokal, weil wir `minimumReleaseAge` selbst nie setzen. Warum der Stern und
  keine Namensliste: nachgemessen, die Ausnahme für `typescript` verschob den
  Abbruch nur auf eine transitive Abhängigkeit. Offene Konflikte:
  `dependabot-core#13165`, `pnpm#11203`. Wiedervorlage bei pnpm 11, das
  `minimumReleaseAgeStrict: false` kennt.
- **Was `tsc` an Typen findet, gehört deklariert — sonst hängt es an einem
  fremden Peer.** `packages/core` hatte nie ein eigenes `@types/node`. Sichtbar
  waren die Node-Typen trotzdem: Vitest 3 führte `@types/node` als Peer,
  `autoInstallPeers: true` legte es nach `app/node_modules/@types/`, und von
  dort las `tsc` es beim Hochlaufen mit. Vitest 4 hat den Peer nicht mehr — und
  auf einmal standen **29 Typfehler** in einem Paket, an dem niemand etwas
  geändert hatte: `crypto`, `TextEncoder`, `URL`, `performance`, `node:fs`,
  alles „Cannot find name". Das sieht nach einem kaputten Testwerkzeug aus und
  ist ein fehlender Eintrag in der eigenen `package.json`; im CI-Log des
  Dependabot-Laufs stand exakt dieselbe Liste. Seitdem steht `@types/node` dort
  als devDependency und `"types": ["node"]` in der `tsconfig.json` — so, wie
  `packages/ingest` und `apps/api` es längst halten. Die Nebenwirkung gehört
  dazu: Mit Node-Typen im Paket würde ein `import 'node:fs'` in `core/src`
  nicht mehr am Compiler scheitern. Diese Sperre war ein Zufall und ist jetzt
  ein Test — `packages/core/test/kein-node-in-core.test.ts`, mit Gegenprobe
  nachgemessen.
- **Ein `200` auf ein `PATCH` ist keine Änderung.** Am 9. September sollte
  `secret_scanning_non_provider_patterns` eingeschaltet werden.
  `gh api -X PATCH repos/… -F 'security_and_analysis[…][status]=enabled'`
  antwortete mit **200 und dem vollständigen Repository-Objekt** — in dem das
  Feld weiter auf `disabled` stand. Kein Fehler, keine Warnung, kein Hinweis
  auf eine fehlende Berechtigung; die Antwort sah aus wie ein Erfolg und war
  ein Verwerfen. Aufgefallen ist es nur, weil direkt danach gemessen wurde.

  Die Ursache lag eine Ebene höher: Die Organisation führt eine
  Sicherheitskonfiguration („GitHub recommended", `enforcement: unenforced`),
  in der das Feld `enabled` ist — sie ist auf dieses Repository nur nicht
  angewandt. Deshalb fehlt der Schalter auch in der Oberfläche. Ein einzelnes
  Feld gegen eine Konfiguration zu setzen, die es nicht gibt, ist wirkungslos,
  und die API sagt das nicht.

  **Nach jedem Schreibzugriff auf eine Einstellung wird gelesen.** Dafür gibt
  es `./scripts/einstellungen-pruefen.sh`; sie ist an genau diesem Fall
  gewachsen.

- **Ein Test, den kein Compiler ansieht, behauptet mehr, als er prüft.**
  `tsc` sah bis zum 9. September nur `packages/core/test/`. In `apps/web`,
  `apps/api` und `packages/ingest` stand `test` nicht im `include` — **180 der
  750 Tests** waren damit nie typgeprüft. Gefunden hat es die Umstellung
  prompt: In `zaehlwerk.test.ts` las eine Zusicherung `feature.id` auf einem
  Objektliteral, das gar kein `id` hat. Der Test lief grün, weil Vitest die
  Typen nicht braucht.

  Der Worker geht dabei einen eigenen Weg, und der Grund ist gemessen: Sein
  `src` steht auf `@cloudflare/workers-types` **allein**, denn damit ist
  `import … from 'node:fs'` ein Typfehler — mit `@types/node` daneben ist es
  keiner mehr. Seine Tests brauchen aber `node:sqlite`, um den Worker gegen
  echtes SQLite zu rechnen. Deshalb zwei Läufe: `tsc --noEmit` für `src`,
  `tsc -p tsconfig.test.json` für `test`. Was dabei **nicht** hilft: `Buffer`
  und `process` kennt `workers-types` selbst, die bleiben so oder so erlaubt.

- **Eine Abdeckungszahl gehört zu dem Werkzeug, das sie gemessen hat.** Mit
  Vitest 4 fielen `core`s Zeilen von 1828 auf 812 und die Statements von 1828
  auf 953 — dieselbe Testmenge, dasselbe `src/`. Kein Verlust: Vitest 3 rechnete
  die V8-Rohdaten zeilenweise um, deshalb waren Statements und Zeilen dort auf
  die Einheit gleich; Vitest 4 rechnet AST-genau. Die Gegenprobe steht in den
  **Funktionen**: 117 vorher, **164** nachher — die genauere Rechnung sieht mehr,
  nicht weniger. Der Prozentwert blieb bei 99,9 %. Wer zwei Abdeckungszahlen
  vergleicht, vergleicht also erst die Werkzeuge.
- **In einem `on: push` nie `branches` und `branches-ignore` zusammen.**
  GitHub Actions lehnt das ab, und der Workflow läuft dann gar nicht — ohne
  roten Haken. Negativmuster gehören in die Liste: `['**', '!dependabot/**']`.
  `lint-workflows.yml` prüft nur, ob die Datei *parst*, nicht ob das Schema
  stimmt; es hätte das nicht gefunden.
- **Wer eine Farbe ändert, ändert auch die Sätze, die sie nennen.** Am
  9. September wurde die Zonenfüllung von Orange auf Messing umgestellt — und
  der Standort-Hinweis sagte weiter „Orange bedeutet: diese Zone kassiert
  gerade". Die App hätte eine Farbe erklärt, die es nicht mehr gibt. Aufgefallen
  ist es **auf dem neu aufgenommenen Bildschirmfoto**, nicht im Code; `grep`
  nach dem Farbwort findet es, aber nur, wenn man daran denkt. Dazu hingen zwei
  Stellen am selben Token, die nichts mit Gebühren zu tun haben (der heutige
  Balken im Tagesdiagramm, der Lebendpunkt der Live-Zahlen) — sie wären
  stillschweigend mitgewandert und haben jetzt eigene Werte.
- **Bilder, die an der Systemuhr hängen, sind nicht vergleichbar.**
  `make-screenshots.mjs` und `make-docs-images.mjs` nahmen auf, was gerade galt:
  Die Aufnahme vom 7. September zeigte „103 von 103 kassieren", die vom
  9. September um 00:08 „0 von 103" — zwei Bilder derselben App, die nichts
  miteinander zu tun haben, und die Farbänderung war auf dem zweiten gar nicht
  zu sehen. Beide Skripte stellen die Uhr jetzt auf Dienstag 10:30 Berliner Zeit
  (`context.clock.setFixedTime`), die Stunde, in der die gesamte Zonenfläche
  kassiert.
- **Ein Zonenschlüssel ist keine Kennung einer Fläche.** Die Karte färbte über
  `setFeatureState({ source, id })` mit `promoteId: 'zone'`. In Hamburg tragen
  **44 von 145 Flächen** den Schlüssel `-` — es sind die Flächen ohne
  Bewohnerparkrecht, für die die Quelle im Feld `bwp_code` keine Nummer führt —,
  dazu kommen vier Zonen in mehreren Stücken mit verschiedenen Zeiten
  (A103: 9–20 und 9–23 Uhr) und eine mit verschiedenen Beträgen (E315: 3,50 €
  und 3,00 €). Alle Flächen mit gleichem Schlüssel teilten sich **einen**
  Zustandsplatz: Die Schleife schrieb 44-mal hinein, der letzte gewann, und
  alle 44 bekamen dessen Farbe. Um 21 Uhr stand „frei" über Flächen, die bis
  22 Uhr kassieren.

  **Korrektur eine Stunde später, und sie gehört hierher:** Ich hatte
  geschrieben, das Panel sei nicht betroffen, weil `zoneAt` geometrisch sucht.
  Das gilt für Standort und Tipp ins Leere — **nicht** für den Klick auf eine
  Zonenfläche. Der Handler schlug über `loaded.find(z => z.properties.zone ===
  id)` nach und nahm damit die **erste** Fläche mit diesem Schlüssel: Ein Klick
  auf irgendeine der 44 zeigte die Zeiten der ersten, bei A103 9–20 statt 9–23
  Uhr. Auch er nimmt jetzt die Flächenkennung.
  `loadZones` stempelt seitdem jeder Fläche eine laufende Nummer auf, auch in
  das Objekt, das an `addSource` geht; `promoteId` ist weg.

  **Dieselbe Verwechslung noch an zwei weiteren Stellen:** Der Zonenschlüssel
  war auch der **React-Schlüssel** in der Suche und im Meldedialog. Stehen
  mehrere `-`-Flächen gleichzeitig in einer Liste, sind die Schlüssel doppelt,
  und React darf beim Umsortieren den falschen Knoten wiederverwenden — die
  Auswahl springt auf eine andere Zeile als die angeklickte. Beide nehmen
  jetzt `zone.id`. Und die Wortwahl gehört dazu: In der Oberfläche stand an
  neun Stellen „Zone -", weil der Platzhalter der Quelle durchgereicht wurde.
  `src/zone-label.ts` spricht ihn aus, statt ihn weiterzugeben. Seit dem
  9. September ist der Strich auch als **Schlüssel** weg: Der Datenbau nimmt
  die GML-Kennung der Quelle (`DE.HH.UP_BEWOHNERPARKGEBIETE_<objectid>`),
  damit 44 Flächen in der Nutzungsstatistik nicht mehr eine Zone sind.

  **Und die Lehre über den Fehler hinaus:** Ich hatte zuerst behauptet, die
  Stücke unterschieden sich nur im Stadtteil — vier Beispiele angesehen und
  verallgemeinert. Der Test auf diese Behauptung fiel sofort. Vier Beispiele
  sind keine Messung.
- **Die MapLibre-Worker-Datei gehört von Hand in den Vorrat — sie kommt dort
  nicht von selbst hinein.** Die Liste entsteht aus den `src=`/`href=` der
  index.html, und MapLibre 6 baut die Adresse seines Workers zur Laufzeit
  zusammen; sie steht in keinem Attribut. Dieselbe Unsichtbarkeit, die dazu
  geführt hat, dass der Bündler die Datei gar nicht erst abgelegt hat, liess
  sie danach auch aus dem Vorrat fallen. Ohne sie holt eine frisch abgelegte
  App sie erst beim ersten Kartenaufbau nach — wer vorher offline geht, bekommt
  eine App ohne Karte **und ohne Parkzonen**, weil MapLibre ohne seinen Worker
  gar nichts parst. Und offline ist der Fall, für den diese App den Vorrat hat.
  `vite.config.ts` bricht seitdem ab, wenn die Datei im Bundle fehlt, und ein
  E2E-Test hält fest, dass sie im Vorrat steht und dort etwas liefert.
- **Was der Service Worker vorab holt, wird gelesen, nicht aufgeschrieben.**
  Die Liste stand als fünf Dateinamen in `vite.config.ts`. Mit der zweiten
  Stadt wanderten die Daten nach `data/<stadt>/`, und die Liste zeigte auf
  fünf Pfade, die es nicht mehr gab. `cache.addAll` bricht schon an einer
  einzigen 404 ab, der Worker verschluckt den Fehler
  (`.catch(() => undefined)`) — vorgehalten wurde daraufhin **nichts**, die
  Offlinefähigkeit war weg, und zu sehen war davon nichts. Sie kommt jetzt aus
  `readdirSync(public/data/<stadt>)`, und zwei E2E-Tests rufen jeden Pfad aus
  `sw.js` ab.
- **Vite 8 baut mit rolldown, und zwei Dinge sind dort anders.** `closeBundle`
  läuft, **bevor** die Dateien geschrieben sind — wer die fertige
  `dist/index.html` braucht, nimmt `writeBundle` und liest sie aus dem
  Bundle-Objekt. Und `output.manualChunks` wird **aufgerufen**, die Objektform
  ergibt `TypeError: manualChunks is not a function`; die Funktionsform
  verstehen beide Bundler.
- **Der Name ist `knoellchenfrei`, nicht `parkingzone`.** Der Arbeitstitel steckte
  im npm-Scope, im Worker-Namen, in der D1-Datenbank, im Pages-Projekt, im
  Cache-Namen des Service Workers und in sieben `localStorage`-Schlüsseln. Alles
  umbenannt; ohne Übernahmecode, weil die App noch bei niemandem lief. Stehen
  bleiben darf `parkingzone` nur da, wo es eine **historische Tatsache** ist:
  die Adresse `herbeus/parkingzone` und die JDBC-Zeile von 2012.
- **`wrangler` immer über den Workspace, nie als nacktes `npx`.**
  `npx wrangler` zieht irgendeine Version aus seinem Zwischenspeicher (gesehen:
  4.97 statt der festgelegten 4.129), und ohne `pnpm install` im
  Wurzelverzeichnis `app/` fehlt der Verweis auf `@knoellchenfrei/core` — der
  Build bricht mit `Could not resolve "@knoellchenfrei/core"` ab. Das sieht
  nach einem kaputten Import aus und ist ein fehlender Symlink. Richtig:
  `cd app && pnpm install && pnpm --filter @knoellchenfrei/api exec wrangler …`.
  Die Befehle in `docs/hosting.md` waren die Fehlerquelle und sind korrigiert.
- **Bootstrap ist nicht Deployment, und der Zustand steht an einer Stelle.**
  Die Einrichtung läuft als `scripts/einrichten.sh` von einem Rechner, an dem
  jemand sitzt; die Workflows machen nur CI und Deploy. Es gab am 6. September
  kurzzeitig beides — ein Skript, das Workflows anstieß, die Ressourcen
  anlegten. Zwei halbe Wahrheiten. `setup-cloudflare.yml` ist deshalb gelöscht.
  Was das Skript **nicht** ist: Infrastructure as Code. Der Lehrbuchweg wäre
  Terraform/OpenTofu mit dem Cloudflare-Provider; für fünf Ressourcen auf dem
  Free Tier ist der Zusatz nicht verdient. Wiedervorlage, sobald eine zweite
  Umgebung dazukommt oder jemand außer dem Betreiber das betreibt.
- **D1-Migrationen laufen über `wrangler d1 migrations apply`, nie über
  `d1 execute`.** Das Werkzeug führt eine Tabelle `d1_migrations` mit und
  überspringt, was schon eingespielt ist — der Stand ist damit eine Tatsache in
  der Datenbank statt einer Vermutung. Ich hatte das erst von Hand nachgebaut
  (`schema.sql` plus `ALTER TABLE`, mit Hinnehmen von `duplicate column name`)
  und lag damit prompt einmal daneben: `schema.sql` legt einen Index auf `city`
  an, den es vor der Migration nicht geben kann — `no such column: city`.
  Neue Migrationen heißen `migrations/NNNN_name.sql`, aufsteigend.
- **OIDC statt langlebiger Token geht bei Cloudflare noch nicht.**
  `cloudflare/workers-sdk#11434` und `cloudflare/wrangler-action#402` sind
  offen; die Doku verlangt für CI weiterhin einen API-Token. Also: eng
  schneiden, Ablaufdatum setzen — und die Frage bei Gelegenheit neu stellen,
  statt sie für beantwortet zu halten.
- **Kein Datum aus einer Anleitung abtippen — Protomaps' Archive verfallen.**
  `build-tiles.sh 20260730` lief in `HTTP error: 404`, was nach einem kaputten
  Skript aussieht und ein abgelaufenes Archiv ist. Gemessen am 6. September
  2026: `20260904` und `20260901` antworteten, `20260903` und alles ab
  `20260828` abwärts nicht. Das Skript sucht das neueste jetzt selbst und
  prüft ein angegebenes Datum, bevor `pmtiles` minutenlang läuft. Aufrufen
  also **ohne** Datum.
- **`cache.addAll` ist atomar — deshalb wird einzeln abgelegt.** Eine 404 oder
  eine **Weiterleitung** unter den Vorratspfaden, und *nichts* wird
  vorgehalten. Zweimal ist genau das passiert, beide Male unsichtbar: erst
  durch Pfade, die nach der zweiten Stadt nicht mehr stimmten, dann durch den
  **308**, mit dem Cloudflare Pages auf `/index.html` antwortet. Der lokale
  `vite preview` liefert dort 200 — die E2E-Suite kann das also gar nicht
  sehen, sie misst gegen den Preview-Server. Gefunden wurde es an der
  ausgelieferten Adresse. Seitdem: `cache.add` je Eintrag mit
  `Promise.allSettled`, ein Fehler kostet einen Eintrag statt aller, und was
  scheitert, steht in der Konsole.
- **Wer Zeitstempel gröber speichert, als er sie vergleicht, zählt falsch.**
  `feedback.created_at` steht auf die Stunde abgerundet in der Datenbank — die
  genaue Minute sagt über einen Vorschlag nichts und grenzt ein, wer ihn
  geschrieben haben kann. Gezählt wurde gegen ein rollendes Fenster
  `jetzt − 1 h`, und damit fiel eine um 10:59 geschriebene Zeile (Stempel
  10:00) um 11:01 heraus: vier Rückmeldungen um 10:59 plus vier um 11:01 sind
  acht in zwei Minuten bei einer Grenze von vier. Die Rechnung steht jetzt als
  `countingWindowStart` in `core/rate-limit.ts` und ist auf genau diesen
  Stundenwechsel getestet (Audit-Punkt M-045).
- **Ein `fetch` ist erfolgreich, sobald irgendeine Antwort kommt.** 415, 429
  und 500 landen alle im `then`. Die Stimmen der Web-App gingen deshalb
  monatelang ins Leere: `vote` schickte `POST` **ohne**
  `Content-Type: application/json`, der Worker antwortete mit `415` — und weil
  niemand den Status ansah, zählte die Anzeige hoch und die Datenbank nicht
  (Audit-Punkt M-046). Schreibzugriffe auf den Worker laufen seitdem über
  `send()` in `sighting-backend.ts`, das bei `!response.ok` wirft; die
  Aufrufer in `App.tsx` nehmen ihren optimistischen Eintrag dann zurück.
- **Was ein Kommentar verspricht, muss der Code auch tun.** Der Schema-Text zu
  `sightings.client_hash` sagte, die Spalte halte „one client confirming its
  own report" auf — geprüft wurde es nie (Audit-Punkt M-047). Eine selbst
  bestätigte Meldung sieht für jeden anderen aus wie eine von zwei Leuten
  bestätigte, und genau diese Zahl trägt die Konfidenz.
- **`VITE_TILES_URL` zeigt auf ein Verzeichnis, nie auf eine Datei.** Bis zum
  7. September stand dort `…/v20260904/berlin.pmtiles`, und dieser eine Pfad
  landete unabhängig von der geladenen Stadt im Kartenstil. In Hamburg,
  Frankfurt und München lag der Ausschnitt damit außerhalb des Archivs: Der
  Hintergrund blieb leer, und zwar so, dass es nach „lädt noch" aussah statt
  nach einem Fehler — **eine gesetzte Variable war schlechter als keine**, weil
  ohne sie die Rasterkacheln von OpenStreetMap eingesprungen wären. Die App
  hängt `<stadt>.pmtiles` jetzt selbst an, und `vite.config.ts` bricht den
  Build ab, wenn der Wert auf `.pmtiles` endet. Die Rahmen der Ausschnitte
  kommen aus `core/city.ts` — im Skript standen sie als zweite Kopie von
  Berlins `reportBounds`, und mit vier Städten wären es acht Zahlen geworden,
  die auseinanderlaufen können.
- **Gegen fremde Daten hilft die Karte des Anbieters selbst.** „Da sind Löcher
  in den Parkzonen, das glaube ich nicht" liess sich am 7. September in zehn
  Minuten beantworten, ohne eine einzige Vermutung: Der Dienst hat neben dem
  WFS einen **WMS**, und `GetMap` auf `layers=parkzonen` liefert Berlins eigene
  Darstellung als PNG. Sie zeigt dieselben Löcher — Tiergarten mit Zoo,
  Gleisdreieck — also liegt es nicht an uns. Dazu drei Zahlen, die den Verdacht
  vollends ausräumten: `resultType=hits` nennt `numberMatched="103"`, ein
  frischer Abruf ist **byteweise identisch** mit dem Bestand (299.224 Bytes),
  und die Geometrie keiner einzigen Zone hat sich geändert. Bei „unsere Daten
  sehen falsch aus" also erst den Anbieter zeichnen lassen, dann die eigene
  Kette prüfen.
  Zwei Fallen dabei: Der WMS-Layer heisst `parkzonen`, nicht
  `parkraumbewirtschaftung:parkzonen` — mit dem Präfix antwortet er
  `LayerNotDefined` als XML mit **HTTP 200**. Und `curl` braucht für
  `gdi.berlin.de` nur dann `--cacert`, wenn das System-Bundle die
  Telekom-Wurzel nicht kennt; auf macOS geht es ohne.
- **Ein 206 ist noch kein Bild — und ein 200 ist noch kein Skript.** Die
  Kachelarchive antworteten mit `206`, der PMTiles-Leser lieferte im Browser
  eine 172-KB-Kachel, das TileJSON war vollständig — und die Karte blieb leer,
  weil MapLibre nie eine Kachel *anforderte*: genau eine Anfrage
  (`bytes=0-16383`, der Kopf), auch nach dreimal Hineinzoomen, ohne einen
  einzigen Konsolenfehler. Zwei Tage Verdacht lagen auf PMTiles, dem Archiv,
  dem Stil, CORS und der abgekündigten `protomaps-themes-base`. Die Ursache lag
  eine Ebene tiefer: **MapLibre 6 startet zur Laufzeit einen Worker aus einer
  eigenen Datei** und setzt deren Adresse selbst zusammen
  (`new URL('./maplibre-gl-worker.mjs', import.meta.url)`). Der Dateiname steht
  in einer Variablen, also kann kein Bundler ihn statisch erkennen — rolldown
  legte die Datei nie ab, die Anfrage lief in die SPA-Rückfalladresse und bekam
  **`index.html` mit `200 OK` und `text/html`**. Kein 404, kein
  `map.on('error')`, keine Meldung; ohne Worker parst MapLibre **weder
  Vektorkacheln noch GeoJSON**, also fehlten auch die Parkzonen, und
  `withMapReady` lief jedes Mal in seinen 10-Sekunden-Rückfall. Die Messung,
  die gefehlt hat, war die banalste: *Gibt es die Datei, die der Browser holen
  will — und was steht in ihrem `content-type`?* Behoben mit `setWorkerUrl` und
  einer Adresse aus `?worker&url` (`apps/web/src/main.tsx`); das Artifact
  bekommt denselben Worker als eingebettete Zeichenkette, weil es keine zweite
  Datei hat. Ein E2E-Test prüft seitdem den `content-type`, nicht den Status.
- **Ein Pages-Secret gilt erst für den nächsten Deploy.** `wrangler pages
  secret put` oder das Dashboard ändern den Wert, aber **nicht** die laufende
  Auslieferung — die trägt den Stand von ihrem Deploy. Am 7. September abends
  war `BETA_PASSWORD` geändert, und die Seite nahm weiter nur das alte an; das
  sah nach einem kaputten Riegel aus und war keiner. `gh workflow run Deploy
  --ref main` ist die ganze Behebung, rund zwei Minuten. Dasselbe gilt für
  jedes andere Secret der Pages-Funktion.
- **Der Beta-Riegel ist die Voreinstellung.** Ohne `PUBLIC_LAUNCH=1` baut Vite
  `noindex` und eine sperrende `robots.txt` ein. Solange das Impressum auf eine
  Privatperson läuft, entscheidet dieser Schalter, ob die Anschrift in Indizes
  und Archiven landet.
- **`noindex` ist kein Zugangsschutz — der Riegel steht vor der Auslieferung.**
  Suchmaschinen hält `noindex` ab, Menschen nicht; rechtlich blieb das Angebot
  damit öffentlich, ohne Impressum und ohne Datenschutzerklärung (Audit-Punkt
  M-006). Seit dem 7. September steht deshalb
  `apps/web/functions/_middleware.ts` als Cloudflare-Pages-Funktion **vor**
  `dist`: Ohne gültiges Cookie geht weder Bündel noch Zonendatei noch Manifest
  hinaus. Ein Login *in* der React-App wäre wirkungslos gewesen — die Dateien
  lägen weiter offen. Zwei Folgen, die man leicht übersieht: Der Deploy braucht
  `pages deploy dist --cwd app/apps/web`, weil `wrangler` das Verzeichnis
  `functions/` relativ zum Arbeitsverzeichnis sucht (steht es falsch, rollt der
  Deploy erfolgreich und ungeschützt aus), und GitHub Pages ist abgeschaltet,
  weil sich dort kein Riegel davorsetzen lässt.
- **`workingDirectory:` der `wrangler-action` geht nicht auf ein Paket mit
  `workspace:`-Abhängigkeiten.** Die Action installiert wrangler *im*
  Arbeitsverzeichnis und wählt das Werkzeug anhand einer Sperrdatei; in
  `app/apps/web` liegt keine, also nimmt sie npm — und npm bricht an
  `"@knoellchenfrei/core": "workspace:*"` ab:
  `EUNSUPPORTEDPROTOCOL: Unsupported URL Type "workspace:"`. Der Lauf vom
  7. September ist genau daran gescheitert. Der Ausweg ist wranglers eigenes
  `--cwd`: Die Action installiert weiter im Wurzelverzeichnis, wrangler
  arbeitet trotzdem im Paket.
- **In einem `batch` liest jede Anweisung, was die vorherige geschrieben hat.**
  Das Zählwerk reservierte sein Tagesbudget in der **ersten** Anweisung; die
  Zählanweisungen dahinter prüften daraufhin gegen den bereits erhöhten Stand.
  Ein Bündel, das den Deckel überschritt, schrieb damit **gar nichts** — auch
  nicht den Teil, der noch gepasst hätte — und die Antwort meldete trotzdem
  `written: n`. Gemessen gegen SQLite: Deckel 20, Stand 18, Bündel mit 5 →
  Budget 23, geschrieben 0, gemeldet 2. Die Reservierung steht jetzt zuletzt.
  Die Umstellung macht eine zweite Falle auf, und die ist teurer: Am **ersten**
  Bündel eines Tages gibt es die Budgetzeile noch nicht, `NULL < 5000` ist
  NULL, und ohne `COALESCE(…, 0)` würde täglich das erste Bündel verworfen.
- **Eine erzeugte Datei, die niemand nachrechnet, läuft irgendwann
  auseinander.** `zone-keys.generated.ts` entsteht von Hand aus den
  `zones.geojson`, der Datenbau läuft im Deploy automatisch — und die Liste ist
  die einzige Grenze, die der Worker gegen die Ausprägung von `zone.open` hat.
  Laufen sie auseinander, passiert **nichts Sichtbares**: Zählungen für neue
  Zonen werden mit `written: 0` verworfen, und „diese Zone sieht sich niemand
  an" ist von „diese Zone wird verworfen" nicht zu unterscheiden. Ein Test in
  `core/test/zone-keys-aktuell.test.ts` hält beide Richtungen gegen die
  ausgelieferten Daten und nennt im Fehlerfall den Befehl.
- **Eine Liste, die je Stadt erzeugt wird, wird auch je Stadt geprüft.** Der
  Worker prüfte die Zonenkennung gegen `ALL_ZONE_KEYS` — die vier Listen
  flachgeklopft. Berlin und Frankfurt nummerieren beide durch und teilen sich
  dadurch 20 Kennungen; in München wären 193 der 275 angenommenen Werte
  solche, die es dort nicht gibt. Auf der Statistikseite sähe das aus wie eine
  Zone, die jemand angesehen hat — sie existiert nur nicht.
- **Was eine Frist einhält, darf nicht hinter etwas stehen, das scheitern
  darf.** Der Aufräumlauf war eine Kette aus zehn `await` mit `rollupStats`
  mittendrin; dahinter standen die Löschungen für `events`, `event_budget` und
  `feedback`. Eine Statistik, die nicht gerechnet werden konnte, verhinderte
  damit, dass Daten gelöscht werden — die Frist ist ein Versprechen aus
  `docs/datenschutz.md`, die Statistik ist Beiwerk. Jeder Schritt läuft jetzt
  für sich, und was scheitert, wird **am Ende geworfen**: Ein stiller `catch`
  wäre die schlechtere Hälfte der Korrektur, der Lauf bliebe grün, und niemand
  erführe, dass eine Frist gerissen ist.
- **„Nur der Pfad" ist kein Schutz vor einer offenen Weiterleitung.**
  `new URL('https://knoellchenfrei.de//evil.com/').pathname` ist `//evil.com/`,
  und als `Location` ist das keine Pfadangabe, sondern eine protokollrelative
  Adresse — der Browser geht nach `https://evil.com/`. Über `\` dasselbe. Beide
  Anmeldewege des Beta-Riegels hatten das; `sameOriginPath` in `core` schneidet
  es ab. Die Zusicherung steht als Eigenschaft im Test: Was die Funktion
  zurückgibt, muss sich gegen **jede** Basis zu genau dieser Basis auflösen —
  „fängt mit einem Schrägstrich an" wäre nur die halbe Miete.
- **Was der Server je Tag prüft, muss der Client je Ping bilden.** Der
  Besuchszähler weist eine Kennung ab, deren Tag nicht der heutige ist
  (`422 stale day`) — sonst liesse sich ein vergangener Tag aufblähen. Die App
  bildete die Kennung aber **einmal** beim Aufsetzen. Ein Tab, der um 23:55
  offen war, schickte ab 00:00 stundenlang die Kennung von gestern, jeder Ping
  ein 422. Sichtbar war davon nichts: Ein fehlgeschlagener Ping bleibt
  absichtlich still („dann gelten die vorigen Zahlen"), also stand die ganze
  Nacht die Zahl von kurz vor Mitternacht auf dem Schirm — eine tote Zahl, die
  aussieht wie eine lebende, und das Gerät fehlte im Tageszähler, obwohl es
  offen war. `visitRowId(at)` bildet sie jetzt bei jedem Ping neu.
- **Eine Anleitung altert mit dem, was sie einrichtet.** In `hosting.md` stand
  bis zum 8. September „@BotFather anschreiben, `/newbot`, Namen vergeben" —
  geschrieben am 6. September, **bevor** der Bot existierte. Anderthalb Seiten
  weiter, in `entscheidungen.md`, `notfall.md` und `marke.md`, steht seit
  demselben Tag `@knoellchen_bot` als Tatsache, mit `getMe` belegt. Wer der
  Anleitung gefolgt wäre, hätte einen zweiten Bot angelegt und den Namen im
  Schema verbrannt; ein umbenannter Telegram-Link ist ein toter Link in jedem
  Beitrag, der ihn je geteilt hat. Aufgefallen ist es an der Rückfrage des
  Betreibers („wieso einen neuen Bot?"), nicht beim Lesen — und `doku-pruefen.mjs`
  kann so etwas nicht finden: Der Verweis war intakt, nur der Inhalt überholt.
  **Eine Einrichtungsanweisung wird nach dem Einrichten noch einmal gelesen.**
- **Ein Katalogeintrag ohne Aufrufstelle ist eine leere Spalte.** Drei der
  zwölf Ereignisse (`layer.on`, `city.suggest`, `tow.open`) standen in
  `core/events.ts` und in keiner Zeile der App — auf der Statistikseite hätten
  sie als Dauer-Null gestanden, ausgerechnet `layer.on` als Antwort auf „welche
  Ebenen werden benutzt". Nichts war dabei kaputt, und genau das ist das
  Problem: Eine Dimension ohne Werte ist von einer kaputten nicht zu
  unterscheiden. Ein Test in `apps/web/test/zaehlwerk.test.ts` liest seitdem
  die Quelle und verlangt für jeden Katalognamen eine Stelle, die ihn auslöst.
  Zwei Regeln aus dem Nachziehen: Gezählt wird nur das **Einschalten** einer
  Ebene, nicht jedes Umlegen — wer an- und ausschaltet, hat sie einmal benutzt.
  Und der Zähler steht **vor** dem `setState`, nie in dessen
  Aktualisierungsfunktion: Die läuft unter StrictMode zweimal.
- **Ein Werkzeug, das ohne Messung läuft, überschreibt nichts.**
  `build-badges.ts` ersetzte das Coverage-Abzeichen durch „unknown", wenn keine
  Messung vorlag. Genau das ist passiert: ein Lauf, bei dem es nur um die
  Testzahl ging, meldete Erfolg und überschrieb dabei die eine Zahl, die
  niemand nachrechnet. Ohne Messung bleibt das Abzeichen jetzt stehen.
- **Zeilenbasiertes Ersetzen in Markdown frisst Abschnitte.** Vier sind so aus
  `docs/todo.md` verschwunden (`## 3.`, `## 5.`, `## 6.`, `## 8.`), jedes Mal
  leise, gefunden erst durch Nachzählen. `scripts/doku-pruefen.mjs` prüft
  seitdem, dass nummerierte Abschnitte lückenlos aufsteigen, dass relative
  Verweise auf existierende Dateien und Überschriften zeigen, und dass **auf
  jede Datei etwas zeigt** — und prüft sich vorher selbst. Die dritte Regel
  fand sofort zwei Fälle: `THIRD-PARTY-NOTICES.md`, eine Lizenzliste, die ihren
  Zweck nur erfüllt, wenn man sie findet, und die sechs Einzelberichte des
  Audits, auf die nur ihre eigene Zusammenfassung nicht zeigte. Der erste Lauf fand zwei Verweise auf `öffentlich-machen.md`;
  die Datei heißt `oeffentlich-machen.md`, und kaputtgegangen war der Link
  ausgerechnet in dem Commit, der die Sprachregel eingeführt hat. **Ein
  Dateiname ist ein Bezeichner, keine Prosa.**
- **Solange Hintergrundagenten in denselben Baum schreiben, wird benannt
  hinzugefügt.** Ein `git add -A` hat 220 KB fremder Rohdaten in einen Commit
  über Testabdeckung genommen. Kein Schaden, aber der Commit behauptete etwas
  anderes, als er tat.
- **Ein Riegel fällt zu, wenn seine Konfiguration fehlt, nicht auf.** Ohne
  `BETA_PASSWORD` antwortet die Pages-Funktion mit `503` statt durchzulassen.
  Die bequeme Richtung wäre genau der Fehler, den dieses Projekt dreimal
  gemacht hat — `cache.addAll`, das Einrichtungsskript, `pnpm fetch`: etwas
  meldet Erfolg und tut nichts. Ein vergessenes Secret öffnete sonst
  stillschweigend die Beta. Dazu ein gefundener Fehler aus derselben Ecke:
  `crypto.subtle.importKey` nimmt einen **Schlüssel der Länge 0** nicht an und
  warf einen blanken `OperationError` — ausgerechnet der wahrscheinlichste
  Betriebsfehler sah damit aus wie ein Fehler in der Kryptografie. Signieren
  wirft jetzt mit Begründung, Prüfen sagt `false`, ohne die Kryptografie
  überhaupt anzufassen.
- **Eine optimistische Kennung ist keine Kennung.** Die App zeigte eine neue
  Meldung sofort unter einer selbst erfundenen Kennung und liess sie stehen,
  bis die nächste Abfrage nach 45 Sekunden die Liste ersetzte — obwohl der
  Worker die echte mit `201 { id }` längst zurückgegeben hatte. Wer in der
  Zeit die eigene Meldung bewertete, schickte eine Kennung, die der Server nie
  vergeben hatte, und bekam „http://…/confirm antwortete 404 Not Found" in
  den Toast: falscher Grund (verfallen statt eigene), rohe Adresse, und der
  Knopf dafür hätte gar nicht da sein dürfen, denn die eigene Meldung ist
  seit M-047 nicht bewertbar. Gefunden am 9. September beim Durchklicken mit
  drei Sitzungen gegen einen lokalen Worker. `report` gibt die Kennung
  seitdem zurück, die App tauscht sie ein, merkt sich ihre eigenen Meldungen
  und zeigt dort „deine Meldung"; `fehlerText` übersetzt die Antworten des
  Workers in einen Satz. Und der Prüfaufbau hat eine eigene Falle: Ein
  `CF-Connecting-IP` als `extraHTTPHeaders` im Browser erzwingt für **jede**
  Anfrage einen Preflight, den der Worker nur für `Content-Type` beantwortet
  — alles scheitert mit „Failed to fetch", und das sieht aus wie ein
  CORS-Fehler der App. Der Kopf gehört unter die CORS-Schicht
  (`context.route` → `route.continue({ headers })`), so wie ihn die Kante
  setzt.
- **Erzeugte Daten sehen aus wie echte — also gibt es keine mehr.** Bis zum
  9. September füllte `seed.ts` eine leere Sichtungsliste mit sechs erzeugten
  Meldungen und die Kontrolldichte mit einem erzeugten Muster, jeweils mit
  Hinweis. Der Betreiber sah auf dem Handy „4 Meldungen" und wollte wissen,
  welche — es waren keine. Ein Hinweis unter einer Liste ist keine Antwort
  auf die Frage, die die Liste stellt. Seitdem zeigt die App, was gemeldet
  wurde, oder sagt, dass nichts gemeldet wurde; und ein leerer gemeinsamer
  Speicher leert auch die Anzeige, statt Reste stehen zu lassen. Was ein
  Test zum Zeichnen braucht, legt er selbst ab (`mitStrichen` in
  `app.spec.ts`), im Format von `saveMarks`.
- **Was eine Sitzung über sich weiß, weiß das Gerät — sonst weiß es nach dem
  Neuladen nichts.** Die Kennungen der eigenen Meldungen standen in einem
  `useRef`, mit der Begründung, eine Meldung lebe nur 90 Minuten. Der
  Betreiber lud neu, „deine Meldung" war weg, jede Zeile bot wieder
  „gesehen" und „weg" an — und wer drückte, bekam auf die eigene Meldung
  einen 403 und auf eine schon bewertete ein stilles `counted: false`: Die
  Anzeige ging hoch und wieder zurück, was aussah, als würde die Stimme
  nicht angenommen. Der Server hält je Meldung und Client genau eine Stimme
  (Primärschlüssel in `votes`); das Gerät merkt sich jetzt dasselbe
  (`loadOwn`/`saveOwn` in `storage.ts`, drei Stunden Frist), und die Zeile
  sagt „du: gesehen" statt zwei Knöpfe zu zeigen. Ein 403 auf eine Stimme
  trägt die Meldung nachträglich als eigene ein — der Speicher kann geleert
  worden sein, der Server weiß es noch. Was bleibt: Zwei Browser hinter
  derselben Adresse sind für den Worker **ein** Client.
- **Ein `ResizeObserver` sieht in der Vorgabe nur die Content-Box — Padding
  ist ihm unsichtbar.** Kopfzeile und Blatt werden gemessen und als
  `--topbar-height` und `--sheet-height` weitergegeben. Die Safe-Area des
  iPhones kommt als Padding (`env(safe-area-inset-*)`) und in der abgelegten
  App erst **nach** dem ersten Layout: Die Kopfzeile wuchs von 64 auf
  113 Pixel, das Blatt von 48 auf 82 — und kein Beobachter feuerte. Die
  Chip-Zeile lag im Suchfeld, der Meldeknopf auf dem Griff, unter der Pille
  schien Karte durch. Vom Betreiber am 9. September fotografiert, per CDP
  (`Emulation.setSafeAreaInsetsOverride` nach dem Laden) nachgestellt, seither
  `observe(element, { box: 'border-box' })` und ein E2E-Test, der die
  Einrückung absichtlich spät setzt. Die Lehre darüber hinaus: Sieben
  Viewports ohne Einrückung sind keine Messung für ein Gerät mit einer.
- **Was altert, ist die Sichtung — nicht die Zustimmung.** `confidenceOf`
  leitete Status *und* Sichtbarkeit aus demselben verfallenen Wert ab. Damit
  war „bestätigt" ein Zustand, den es praktisch nicht gab: Eine saubere
  Bestätigung hielt ihn drei Minuten, zwei acht, drei Bestätigungen standen
  nach 27 Minuten bei 0,43 als „unbestätigt" — während der Kommentar über
  der Schwelle versprach, eine einzige saubere Bestätigung stufe hoch. Der
  Betreiber sah am 9. September drei eigene „du: gesehen" neben dreimal
  „unbestätigt" und fragte, ob die noch eine extra Bestätigung brauchen. Sie
  hätten nie gereicht. Seitdem entscheidet der Verfall, ob eine Sichtung
  sichtbar bleibt (und wie viele Sterne sie hat), und die Zustimmung allein,
  ob sie bestätigt ist. Nachgerechnet, nicht gefühlt: die Tabelle mit neun
  Fällen steht in `core/test/sighting.test.ts`.

## Stil

- **Kommentare erklären das Warum, nicht das Was.** Der Bestand ist so
  geschrieben; deutsche Kommentare bei neuem Code, die englischen im Bestand
  bleiben stehen. Wo ein Kommentar einen konkreten Fehler festhält, gehört der
  Fehler hinein — er ist die Begründung.
- **Prosa mit Umlauten, Bezeichner ohne.** Die Regel steht ausführlich in
  [CONTRIBUTING.md](CONTRIBUTING.md) und wird von
  `./scripts/sprache-pruefen.sh` gehalten: Kommentare, Doku, Testtitel und
  Ausgabetexte schreiben `ä ö ü ß`; Bezeichner, Dateinamen, Schlüssel,
  Feldnamen, Schalter und Commit-Betreffs bleiben ASCII (`muenchen`,
  `staedte.md`, `--pruefen`). Zwei Fallen aus dem Lauf vom 7. September:
  `taeglich` und `ueberwachung` sind **Feed-Werte** aus München und Frankfurt
  — als Umlaut geschrieben brechen zwei Parser lautlos. Und was in
  Grave-Akzenten steht, ist ein Zitat, kein Befund; sonst schlägt die Prüfung
  auf der Regel an, die sie durchsetzt.

  **Und sie unterscheidet Bezeichner nicht von Prosa.** Ein `const gueltig =`
  wird angestrichen, obwohl ein Bezeichner nach der Regel ASCII bleiben *soll*.
  Das ist kein Fehler der Prüfung, sondern die sichere Richtung: Sie kann
  „Ersatzschreibung in einem Kommentar" von „Ersatzschreibung in einem Namen"
  nicht zuverlässig trennen, und lieber ein Name zu viel umbenannt als ein
  Kommentar zu wenig. Der Ausweg ist ein Name ohne `ae/oe/ue` (`basis` statt
  `gueltig`), nicht eine Ausnahme im Skript.
- **Für jeden gefundenen Fehler ein Test.** Wie viele es sind, stand hier
  einmal als 30 und in `README.md` als 58 — zwei Zahlen für dieselbe Sache,
  keine davon aus einer Regel abgeleitet. Nachzählbar ist der Abschnitt
  darüber: **74 Regeln, jede aus einem Vorfall**. Die Testzahl bleibt
  ungenannt, bis es eine Marke im Quelltext gibt, an der man sie zählen kann.
- **TypeScript streng**, inklusive `noUncheckedIndexedAccess` und
  `exactOptionalPropertyTypes`. Kein `any`, keine nicht begründeten Casts.
- **`packages/core` bleibt frei von Frameworks und ohne Laufzeit-Abhängigkeiten.**
  Alles, was fremde Eingaben zerlegt, gehört dorthin — dort lässt es sich mit
  Unfug beschießen. Der Telegram-Parser ist das jüngste Beispiel.
  Dass dort nichts aus Node importiert wird, prüft
  `test/kein-node-in-core.test.ts` — vorher hing es daran, dass der
  Compiler die Node-Typen gar nicht kannte.
- **Berlin darf nicht fest verdrahtet werden.** Eine weitere Stadt ist stehende
  Anforderung. Was heute noch Berlin-spezifisch ist, steht in
  [docs/oeffentlich-machen.md](docs/oeffentlich-machen.md).

## Wo was steht

| Datei | Inhalt |
| --- | --- |
| [docs/neue-sitzung.md](docs/neue-sitzung.md) | Womit eine frische Sitzung anfängt |
| [docs/todo.md](docs/todo.md) | Die Handover-Liste: was offen ist, und wer es tun kann |
| [docs/ideen.md](docs/ideen.md) | Was gebaut werden könnte und noch niemand aufgeschrieben hat — nichts davon entschieden |
| [docs/entscheidungen.md](docs/entscheidungen.md) | Getroffene Entscheidungen mit Begründung und Quellen |
| [docs/hosting.md](docs/hosting.md) | Cloudflare, Worker, D1, Telegram, PMTiles — mit Befehlen |
| [docs/notfall.md](docs/notfall.md) | Was läuft, was bei Verlust weg ist, in welcher Reihenfolge es zurückkommt |
| [docs/architecture.md](docs/architecture.md) | Aufbau und die Fallstricke im Detail |
| [docs/data-sources.md](docs/data-sources.md) | Woher die Daten kommen, was sie taugen |
| [docs/staedte.md](docs/staedte.md) | Weitere Städte: Datenlage, Prüfliste, Hamburg, Frankfurt und München im Einzelnen; Köln, Düsseldorf und Karlsruhe in eigenen Berichten |
| [docs/staedte-recherche-2026-09.md](docs/staedte-recherche-2026-09.md) | 24 geprüfte Städte, Rangliste und Negativbefunde |
| [docs/marke.md](docs/marke.md) | Bilder, Beschreibungstexte, Namensschema — und was davon von Hand geht |
| [docs/sitzungsstatistik.md](docs/sitzungsstatistik.md) | Gemessene Kennzahlen der Sitzungen: Modell, Tokens, Werkzeuge, Agenten |
| [docs/nachtplan-2026-09-08.md](docs/nachtplan-2026-09-08.md) | Der Plan der Nacht zum 8. September und was jeder Abschnitt ergeben hat |
| [docs/staedte-koeln.md](docs/staedte-koeln.md), [docs/staedte-karlsruhe.md](docs/staedte-karlsruhe.md) | Zwei vorbereitete Städte — Messung, Entscheidungen, was einzutragen bleibt |
| [docs/mobile-ux-audit-2026-09.md](docs/mobile-ux-audit-2026-09.md) | Der Mobile-Audit: sieben Viewports vermessen, was geändert wurde und was bewusst nicht |
| [SECURITY.md](SECURITY.md) | Bedrohungsmodell, Maßnahmen — und welche vier Netze nachgemessen statt erinnert werden |
