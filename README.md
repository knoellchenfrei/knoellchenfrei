# knoellchenfrei

![build](docs/badges/build.svg)
![tests](docs/badges/tests.svg)
![e2e](docs/badges/e2e.svg)
![coverage](docs/badges/coverage.svg)
![security](docs/badges/security.svg)
![licence](docs/badges/licence.svg)
![data](docs/badges/data.svg)

Wo stehe ich, kostet Parken hier gerade etwas, wie viel, wie lange darf ich
stehen — und wo wurde zuletzt das Ordnungsamt gesehen.

Eine PWA auf den amtlichen Geodaten der Städte. **Berlin und Hamburg**,
umschaltbar in den Einstellungen — eine Stadt zur Zeit, die Daten der anderen
werden erst beim Wechsel geladen. Läuft im Browser, auf dem Homescreen
installierbar, ohne Server.

![Übersicht über Berlin mit Parkzonen, Umweltzone und Ladepunkten](docs/images/overview.png)

## Was sie kann

| | |
| --- | --- |
| **Zone finden** | Standort oder Tippen auf die Karte. 103 Zonen in Berlin, 145 Bewohnerparkgebiete in Hamburg. Farbe trägt eine Aussage: Orange füllt, wenn kassiert wird, gebührenfreie Zonen bleiben als leise Kontur stehen — sonst wäre an einem Sonntag ganz Berlin eingefärbt und die eine Fläche, auf die es ankommt, ginge unter. |
| **Kosten** | Tarif, Geltungszeiten, „noch bis" / „frei bis". Berücksichtigt Feiertage und Sommerzeit — je Bundesland, nicht pauschal. Kein Betrag ist nicht null Euro: Hamburgs Parkscheibengebiete kosten nichts und verlangen trotzdem etwas, und die App sagt das statt „0,00 €". |
| **Stadt wechseln** | In den Einstellungen, nach FreiFahrens Vorbild. Die Wahl liegt im Browser, nicht im Build; ein unbekannter Stadtschlüssel fällt **nicht** still auf Berlin zurück, sondern bricht ab. |
| **Parkuhr** | Auto-Position merken, Laufzeit, Erinnerung. Marker verschiebbar. Übersteht Neuladen. |
| **Umfeld** | 385 Ladepunkte, 84 Carsharing-Plätze, 108 P+R-Anlagen, 923 Behindertenparkplätze, Umweltzone — **in Berlin**. Hamburg liefert diese Ebenen nicht mit; die App blendet sie dort aus, statt eine leere Karte als Ergebnis auszugeben. |
| **Ordnungsamt** | Melde-Sheet mit Ortswahl (angetippt, Standort, in der Nähe, Suche), Bestätigung durch andere, Sterne-Bewertung, Verfall nach 90 Minuten. |
| **Live-Zahlen** | Wie viele die App gerade offen haben, wie viele heute, wie viele Meldungen aktiv sind. Nur was zählbar ist — sonst gar nichts. |
| **Kontrolldichte** | Heatmap der letzten 28 Tage plus Report: letzte 24 h, Histogramm über 28 Tage, Stundenprofil des Wochentags, häufigste Zonen. Aus anonymen `{Tag, Stunde, 250-m-Feld}`-Strichlisten. Zeigt nichts, solange zu wenige Meldungen da sind. |
| **Einstellungen** | Ein Sheet mit stehendem Hinweis, sieben häufigen Fragen zu genau den Stellen, an denen die Anzeige überrascht, Mitmachen-Wegen und den rechtlichen Links. |
| **Ruhetag erklärt** | Wenn auffällig wenige Zonen kassieren, sagt die App warum — Wochentage und Stunden aus den Daten abgeleitet, nicht fest verdrahtet. Wegklickbar. |
| **Standort** | Erklärt sich, bevor der Browser fragt — „Später" löst den nativen Dialog gar nicht erst aus, die Berechtigung bleibt also abrufbar. |
| **Feedback** | Idee, Fehler oder Sonstiges als Freitext. Kein Kontaktfeld, keine Antwort — dafür auch keine gespeicherte Adresse. Nur der Betreiber liest, deshalb nur mit eigenem Server. |
| **Offline** | Service Worker, Daten eingefroren. Funktioniert in der Tiefgarage. |
| **Als App ablegen** | Manifest mit eigenem und zuschnittsicherem Symbol, Bildern für die Installations-Karte und drei Verknüpfungen im Symbol-Menü (Melden, Standort, Kontrollen). Der Hinweis kommt erst ab dem zweiten Besuch und nie wieder, wenn er weggeklickt wurde; auf iOS steht der Weg übers Teilen-Menü. |
| **Geschlossene Beta** | Bis der Trägerverein eingetragen ist: `noindex` und eine sperrende `robots.txt`, eine Beta-Pille in der Kopfzeile und ein Absatz in den Einstellungen. Hängt an einem Schalter, nicht an einem Gedächtnis — `PUBLIC_LAUNCH=1 pnpm build` hebt beides auf. |
| **Telegram** | Ein Bot am selben Worker: Standort schicken, Meldung steht auf der Karte. Kein zweiter Dienst, dieselbe Datenbank, dieselbe Meldegrenze. Die Nutzerkennung wird gehasht wie eine IP-Adresse, die Chat-Kennung gar nicht gespeichert. |
| **Updates** | Eine neue Version übernimmt nicht selbst — sie meldet sich in der Kopfzeile und wartet. Ein Wechsel mitten im Melden würde Eingaben verlieren. |

<p align="center">
  <img src="docs/images/mobile-start.png" alt="Startansicht auf dem Handy" width="240">
  <img src="docs/images/mobile-zone.png" alt="Zonendetails auf dem Handy" width="240">
  <img src="docs/images/mobile-timer.png" alt="Parkuhr mit Erinnerung" width="240">
</p>

## Herkunft

Das Projekt begann 2012 als Java/Spring-Anwendung. Sie ist beim Umzug am
6. September 2026 im alten Repository geblieben — die Domäne ist dieselbe, der
Code teilt keine Zeile. Von 2,8 MB waren nur 256 KB eigener Quelltext, der Rest
Bezirksgrenzen in doppelter Ausfertigung, einkopierte Fremdbibliotheken und eine
Excel-Add-in-Datei mit Makros.

Was den Neubau nötig machte: Die Zonendaten von damals waren von Hand in
ScribbleMaps gezeichnet (der Commit heißt wörtlich `ParkZonen invented`), und
Koordinaten waren durchgängig lat/lon vertauscht — zweimal, sodass es sich
aufhob. Die Ideenliste von 2012 ist dagegen gut gealtert und war die Vorlage für
den Funktionsumfang — sie zieht als kommentiertes Dokument mit um:
[docs/ideen-2012.md](docs/ideen-2012.md).

## Daten

Zwei Länder, zwei Dienste, zwei Lizenzen — und der Unterschied ist keine
Formalie:

| | Quelle | Lizenz | Bestand |
| --- | --- | --- | --- |
| **Berlin** | [GDI Berlin](https://gdi.berlin.de), WFS 2.0.0 | [DL-DE/Zero 2.0](https://www.govdata.de/dl-de/zero-2-0) — Namensnennung *optional* | 103 Zonen, 45.917 Abschnitte, **210.527 bewirtschaftete Stellplätze**, 1.499 Orte, 97 Ortsteile |
| **Hamburg** | [LGV Hamburg](https://geodienste.hamburg.de), WFS 2.0.0 | [DL-DE/Namensnennung 2.0](https://www.govdata.de/dl-de/by-2-0) — Namensnennung ist **Lizenzbedingung** | 145 aktive Bewohnerparkgebiete, 104 Stadtteile |

Deshalb trägt `City.attribution` ein `attributionRequired`-Flag bis in die
Oberfläche: Eine Hamburg-Ansicht ohne Quellenangabe verletzt die Lizenz, eine
Berlin-Ansicht ohne sie nicht.

Vollständige Liste mit Endpunkten, Lizenzen und geprüften Negativbefunden:
[docs/data-sources.md](docs/data-sources.md).

Daten werden zur Buildzeit eingefroren, nicht zur Laufzeit aus dem WFS geladen:
Berlins Segment-Layer ist ~49 MB, ein Snapshot macht die App offlinefähig, und
Zonendaten ändern sich über Monate — ein täglicher Rebuild ist frischer als die
Quelle sich bewegt. CORS wäre kein Hinderungsgrund, `gdi.berlin.de` sendet
`Access-Control-Allow-Origin: *`. Die eingefrorenen Dateien liegen je Stadt
unter `public/data/<stadt>/` und werden vom Browser geholt — ein Stadtwechsel
braucht deshalb keinen zweiten Build.

## Was an den Daten schwierig ist

Zeiten und Gebühren kommen als **Freitext**. Allein in den beiden Berliner
Feeds sind es 28 Schreibweisen für rund zehn tatsächliche Fahrpläne:

```
Mo-Fr 9-20 Uhr / Sa 9-18 Uhr      Mo-Sa, 9-22 Uhr
Mo-Sa / 9-20 Uhr                  Mo-Fr 09:00-20:00 Uhr, Sa 09:00-18:00 Uhr
Mo-Sa 9-22 UhrMo-Sa 9-22 Uhr      Mo-Fr 9-17 Uhr, Sa 9 -14 Uhr/ Advents-Sa 9 -17 Uhr
```

Der Parser **scheitert laut statt zu raten**: Eine unbekannte Schreibweise
bricht den Datenbuild ab, statt still einen falschen Preis auszuliefern. Die
Fallstricke im Detail stehen in [docs/architecture.md](docs/architecture.md).

### Wo die App bewusst nichts behauptet

- **`Advents-Sa`** (Zonen 10–13): Die Quelle sagt nicht, welche Samstage gemeint
  sind. An diesen Tagen zeigt die App „unsicher", nicht „gebührenfrei".
- **Gebührenspannen** (`2,00-3,00 Euro`): bleiben Spannen. Auf einen Wert zu
  reduzieren verschätzt den Fahrer um bis zu 50 %.
- **Höchstparkdauer**: ist auf 1–2 % der Abschnitte gesetzt, nicht zonenweit. Die
  App nennt den Wert samt tatsächlicher Abdeckung statt ihn als Zonenregel
  auszugeben.
- **„Keine Gebühr" heißt nicht „Parken erlaubt"**: Halteverbote und
  Bewohnerplätze gelten unabhängig davon weiter, und die App sagt das.

### Hamburg ist an der Oberfläche einfacher und im Detail anders

Zehn Schreibweisen statt achtzehn, die Höchstparkdauer als Zahl statt als Prosa
— und trotzdem vier Dinge, die Berlin nicht kennt. Sie stehen hier, weil jedes
davon still falsch geht:

- **Die Achsenreihenfolge ist vertauscht.** Auf dieselbe Anfrage
  (`urn:ogc:def:crs:EPSG::4326`) antwortet Berlin `[lon, lat]` und Hamburg
  `[lat, lon]`. Ungedreht landen Hamburgs Gebiete im Golf von Guinea, und die
  Karte sieht dabei nur leer aus, nicht kaputt. Die Reihenfolge steht deshalb
  in der Konfiguration, nie in einer Heuristik: In Hamburg sind beide Zahlen
  zweistellig und plausibel.
- **„werktags" schließt den Samstag ein** — Mo–Sa, nach § 3 Abs. 2 BUrlG und
  ständiger Rechtsprechung. Andersherum gelesen meldete die App an 31 Gebieten
  samstags „gebührenfrei".
- **Fenster laufen über Mitternacht** (`täglich 9-2 Uhr`). Ein einzelnes
  Zeitfenster kann das nicht — Anfang nach Ende heißt in der Prüfung „nie".
  Wird in zwei Fenster zerlegt, das zweite am Folgetag.
- **Platzhalter in der Höchstparkdauer:** `0` und `9999` heißen beide
  „unbegrenzt". Ungeprüft übernommen stünde in der App „6 Tage 22 Stunden".

Beide Feeds haben deshalb **eigene Parser**, keinen gemeinsamen:
`parse-schedule.ts`/`parse-fee.ts` sind Berlin, `hamburg.ts` ist Hamburg. Sie
teilen sich außer der Domäne nichts, und ein Parser für beide wäre bei jeder
Änderung an einer Stadt für die andere gefährlich.

## Ordnungsamt-Meldungen

Nach dem Vorbild von [blitzer.de](https://www.blitzer.de/article/blitzer-und-gefahren-melden/):
melden, von anderen bestätigen lassen, Sterne-Bewertung, automatischer Verfall.
Der Konfidenzwert kombiniert ein Laplace-geglättetes Zustimmungsverhältnis mit
exponentiellem Zeitverfall (Halbwertszeit 30 Minuten), harter Cutoff nach 90
Minuten. Positionen werden auf ~10 m gerundet, Zeitstempel auf 5-Minuten-Raster.
Es wird keine Historie geführt.

Rechtlicher Rahmen: § 23 Abs. 1c StVO richtet sich an Fahrzeugführende während
der Fahrt, nicht an Betreiber — deshalb existieren Dienste wie blitzer.de legal.
Das ist keine Rechtsberatung; für einen öffentlichen Betrieb gehört das
anwaltlich geprüft.

## Aufbau

```
app/
  packages/core      Domänenlogik, framework-frei — Tarife, Feiertage, Parser, Geo, Sichtungen
  packages/ingest    WFS → eingefrorene Web-Assets, Geometrie-Vereinfachung, Artifact-Bundle
  apps/web           PWA: React 19, Vite 7, MapLibre GL 6
  apps/api           Cloudflare Worker: WFS-Cache + geteilte Meldungen (optional)
```

`core` hängt von keinem Framework ab und hat keine Laufzeit-Abhängigkeiten. Ein
späterer nativer Client wäre ein zusätzliches Frontend, kein Rewrite.

Zwei Dateien darin tragen die Mehrstädtigkeit: `core/city.ts` hält jede
Stadtgrenze **genau einmal** — vorher stand sie an sechs Stellen als Zahlenpaar,
und laufen zwei davon auseinander, nimmt die App eine Meldung an, die der Server
danach verwirft, ohne dass im Log etwas nach einem Fehler aussieht.
`core/holidays.ts` kennt Berlin und Hamburg; ein Bundesland ohne hinterlegte
Tabelle wirft, statt eine leere Menge zu liefern — sonst forderte die App an
Karfreitag zum Zahlen auf.

## Entwickeln

```bash
cd app
pnpm install
pnpm test                              # 190 Unit-Tests
pnpm test:coverage                     # Schwellwerte: 85 % Zeilen, 80 % Zweige
pnpm typecheck
pnpm --filter @knoellchenfrei/web dev
cd apps/web && npx playwright test     # 105 End-to-End-Tests
```

Bringt die Umgebung einen Chromium mit, den Playwright nicht selbst
installiert hat, zeigt `PLAYWRIGHT_CHROMIUM=/pfad/zu/chromium` darauf.

Daten neu ziehen:

```bash
pnpm --filter @knoellchenfrei/ingest fetch-data
pnpm --filter @knoellchenfrei/ingest build-data
```

`gdi.berlin.de` wird von der *Telekom Security TLS RSA Root 2023* signiert, die
in manchen Container-Images fehlt. Node bringt seinen eigenen Wurzelspeicher mit
und ist davon nicht betroffen; **curl** dagegen schon — dort ein aktuelles
Mozilla-Bundle per `--cacert` übergeben
(`python3 -c 'import certifi; print(certifi.where())'`), nicht die Verifikation
abschalten. Hinter einem Proxy braucht Node umgekehrt `NODE_USE_ENV_PROXY=1`:
Sein `fetch` ignoriert `HTTPS_PROXY`, und direkt hinaus antwortet
`geodienste.hamburg.de` mit einem 403, das nach einer Sperre der Behörde
aussieht und keine ist. Das `fetch-data`-Skript setzt die Variable selbst.

## Qualität

| | |
| --- | --- |
| Unit-Tests | 190, davon 25 Regressionstests für konkrete gefundene Fehler |
| End-to-End | 105 bestanden über Desktop und Handy, gegen den Produktions-Build (ein 106. läuft nur in der Handy-Variante) |
| Coverage | 96,1 % Zeilen, 90,3 % Zweige, 98,4 % Funktionen (`packages/core`) |
| Typprüfung | `strict` inkl. `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes` |
| Abhängigkeiten | `pnpm audit`: keine bekannten Lücken. Aktuell gehalten von **Dependabot** — wöchentlich, Minor und Patch gebündelt, Hauptversionen einzeln, mit Wartezeit gegen übernommene Paketpflegerschaften. Konfiguration und der pnpm-Fallstrick dahinter: [`.github/dependabot.yml`](.github/dependabot.yml). |

Die Badges oben werden vom CI aus den echten Messwerten generiert — kein
externer Dienst, damit sie auch in einem privaten Repository funktionieren.

Sicherheitsmaßnahmen und Bedrohungsmodell: [SECURITY.md](SECURITY.md).

## Betrieb

Drei Wege, alle kostenlos: als Claude Artifact (läuft bereits), statisch auf
GitHub Pages oder Cloudflare Pages, oder mit eigenem Worker für geteilte
Meldungen und Live-Daten. Details, Kostenrahmen und Einrichtung:
[docs/hosting.md](docs/hosting.md).

Vorgesehen ist **Cloudflare** — Pages fürs Frontend, Worker plus D1 für die
Meldungen, R2 für die Kartenkacheln; derselbe Aufbau wie bei FreiFahren. Die
eigenen Domains gehören dorthin und nicht zu GitHub Pages: Ein Hostname kann
nur an einer Stelle liegen. `setup-cloudflare.yml` legt KV, D1 und Schema an,
sobald zwei Secrets hinterlegt sind — die Reihenfolge steht in
[docs/todo.md](docs/todo.md).

## Grenzen

- Keine Bezahlfunktion. Handyparken läuft über die geschlossene Plattform
  *smartparking*; ohne Vertrag ist kein Parkticket lösbar.
- Erinnerungen laufen nur, solange die Seite geöffnet ist. Zeitgesteuerte lokale
  Benachrichtigungen kann das Web nicht.
- Kein Hintergrund-Geofencing — das gibt es nur nativ.
- Bewohnerparkausweise sind nicht abgebildet; die App weist darauf hin, dass der
  Preis für Besucher gilt.
- Kartenkacheln kommen im Auslieferungszustand von OpenStreetMap, was die
  OSM-Kachelrichtlinie für ausgelieferte Anwendungen nicht deckt. Der Ausweg ist
  eingebaut: Mit `VITE_TILES_URL` zeichnet die App aus einem eigenen
  PMTiles-Archiv. Es fehlt nur der R2-Eimer.
- **Verbindlich ist die Beschilderung vor Ort.** Die Quelle sagt selbst, dass
  Gebühren und Zeiten abschnittsweise abweichen können.

## Dank

**[FreiFahren](https://freifahren.org)** ist das Vorbild dieses Projekts —
dieselbe Idee für den Berliner Nahverkehr, seit Jahren im Betrieb und als
gemeinnütziger Verein getragen. Übernommen ist mehr als eine Anregung:

- der **Aufbau** — Cloudflare Worker, D1 je Stadt, Pages fürs Frontend;
- das **Kartenhosting** ohne Kachelserver: ein PMTiles-Archiv in R2, das der
  Browser per Range-Request liest;
- mehrere **Dialoge** — Melde-Blatt mit Ortswahl als Formularfeld,
  Einstellungen, Standort-Vordialog, Rückmeldeformular;
- die **Trägerschaft** als e. V., spendenfinanziert, ohne Werbung.

Kein Code ist kopiert; die Domäne ist eine andere. Was wir uns abgeschaut haben,
ist die Frage, wie so ein Projekt gebaut und getragen wird — und die hatten sie
zuerst beantwortet.

## Lizenz

Code: [MIT](LICENSE). Berliner Geodaten: DL-DE/Zero-2.0, keine Namensnennung
erforderlich. Hamburger Geodaten: DL-DE/Namensnennung-2.0 — dort ist die
Quellenangabe Bedingung, nicht Höflichkeit. Kartenkacheln:
© OpenStreetMap-Mitwirkende, ODbL — auch deren Namensnennung in der App ist
Lizenzbedingung.

Mitmachen: [CONTRIBUTING.md](CONTRIBUTING.md) ·
[Verhaltensregeln](CODE_OF_CONDUCT.md).

Welche weiteren Städte in Frage kämen und woran es jeweils hängt, samt der
Prüfliste für die nächste: [docs/staedte.md](docs/staedte.md). Bilder,
Beschreibungstexte und Namensschema: [docs/marke.md](docs/marke.md). Die
Ideensammlung von 2012, mit dem was daraus wurde:
[docs/ideen-2012.md](docs/ideen-2012.md).

Der Werkbericht zum Umbau — was entschieden, gebaut und wieder repariert wurde:
[docs/bericht/index.html](docs/bericht/index.html) (im Browser öffnen).

Warum die Dinge so sind, wie sie sind — mit Quellen:
[docs/entscheidungen.md](docs/entscheidungen.md).

Was als Nächstes ansteht und wer es tun kann: [docs/todo.md](docs/todo.md) —
darunter die Gründung eines Trägervereins nach dem Vorbild von FreiFahren e.V.

Vor einer Veröffentlichung: [docs/oeffentlich-machen.md](docs/oeffentlich-machen.md)
trennt, was im Repository erledigt ist, von dem, was nur der Betreiber tun kann —
Impressum, Cloudflare-Konto, und die Entscheidung über ein Passwort von 2012 in
der Git-Historie.
