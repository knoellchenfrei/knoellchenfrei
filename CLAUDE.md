# Hinweise für Claude

Kurzfassung des Projekts steht in [README.md](README.md). Diese Datei enthält
das, was eine neue Sitzung sonst durch Ausprobieren herausfinden müsste.

## Was das ist

Eine PWA, die für Parkzonen sagt, ob gerade Gebührenpflicht gilt, was es
kostet und wie lange man stehen darf — aus den amtlichen WFS der Städte.
Angeschlossen sind Berlin, Hamburg, Frankfurt am Main und München.
Ausgeliefert wird sie hinter einem Passwort-Riegel — der Stand ist geschlossener
Testbetrieb, siehe `apps/web/functions/_middleware.ts` und `docs/hosting.md`.
Dazu gemeldete Ordnungsamt-Sichtungen und eine Heatmap der Kontrolldichte.
Vorbild in Aufbau, Hosting und Haltung ist
[FreiFahren](https://github.com/FreiFahren/FreiFahren).

Der Stand ist **geschlossener Testbetrieb**, nicht öffentlich. Warum, und was
davor noch passieren muss, steht in [docs/todo.md](docs/todo.md) — das ist die
verbindliche Liste, nicht dieser Absatz.

## Befehle

```bash
pnpm -r typecheck                                   # alles, streng
pnpm --filter @knoellchenfrei/core test                # 489 Unit-Tests
pnpm --filter @knoellchenfrei/core test:coverage       # Coverage-Bericht (99,9 % Zeilen)
pnpm --filter @knoellchenfrei/web build                # Web-Build
pnpm artifact                                       # Einzeldatei fürs Artifact
cd apps/web && npx playwright test                  # 128 End-to-End-Tests
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
TEST_COUNT=489 E2E_COUNT=128 npx tsx src/build-badges.ts
scripts/build-tiles.sh                              # PMTiles-Ausschnitt Berlin
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
| **GitHub-Einstellungen** | Zwei getrennte Sperren, die gern verwechselt werden. Der Egress-Proxy lehnt jedes `PATCH /repos/…` ab: **„Repository settings writes are not permitted through this proxy"** — Beschreibung, Topics, Pages, Dependabot-Alerts gehen also auch mit einem berechtigten Token nicht. Und für das **Organisationsbild** existiert in der GitHub-API gar kein Endpunkt; das kann ausschließlich die Weboberfläche. Ein Browser läuft hier zwar, aber kopflos und ohne Eingabekanal für den Nutzer — Anmelden ist keine Option. |
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
- **Demodaten sind auch Daten — sie hängen an der Stadt.** `seed.ts` streute
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
- **In einem `on: push` nie `branches` und `branches-ignore` zusammen.**
  GitHub Actions lehnt das ab, und der Workflow läuft dann gar nicht — ohne
  roten Haken. Negativmuster gehören in die Liste: `['**', '!dependabot/**']`.
  `lint-workflows.yml` prüft nur, ob die Datei *parst*, nicht ob das Schema
  stimmt; es hätte das nicht gefunden.
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
  lägen weiter offen. Zwei Folgen, die man leicht übersieht: `deploy.yml`
  braucht `workingDirectory: app/apps/web`, weil `wrangler pages deploy` das
  Verzeichnis `functions/` relativ zum Arbeitsverzeichnis sucht (steht es
  falsch, rollt der Deploy erfolgreich und ungeschützt aus), und GitHub Pages
  ist abgeschaltet, weil sich dort kein Riegel davorsetzen lässt.
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

## Stil

- **Kommentare erklären das Warum, nicht das Was.** Der Bestand ist so
  geschrieben; deutsche Kommentare bei neuem Code, die englischen im Bestand
  bleiben stehen. Wo ein Kommentar einen konkreten Fehler festhält, gehört der
  Fehler hinein — er ist die Begründung.
- **Für jeden gefundenen Fehler ein Test.** 30 der Unit-Tests sind genau das.
- **TypeScript streng**, inklusive `noUncheckedIndexedAccess` und
  `exactOptionalPropertyTypes`. Kein `any`, keine nicht begründeten Casts.
- **`packages/core` bleibt frei von Frameworks und ohne Laufzeit-Abhängigkeiten.**
  Alles, was fremde Eingaben zerlegt, gehört dorthin — dort lässt es sich mit
  Unfug beschießen. Der Telegram-Parser ist das jüngste Beispiel.
- **Berlin darf nicht fest verdrahtet werden.** Eine weitere Stadt ist stehende
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
| [docs/staedte.md](docs/staedte.md) | Weitere Städte: Datenlage, Prüfliste, Hamburg, Frankfurt und München im Einzelnen |
| [docs/staedte-recherche-2026-09.md](docs/staedte-recherche-2026-09.md) | 24 geprüfte Städte, Rangliste und Negativbefunde |
| [docs/marke.md](docs/marke.md) | Bilder, Beschreibungstexte, Namensschema — und was davon von Hand geht |
| [docs/sitzungsstatistik.md](docs/sitzungsstatistik.md) | Gemessene Kennzahlen der Sitzungen: Modell, Tokens, Werkzeuge, Agenten |
| [SECURITY.md](SECURITY.md) | Bedrohungsmodell und Maßnahmen |
