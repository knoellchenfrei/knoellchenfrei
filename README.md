# ParkingZone Berlin

![build](docs/badges/build.svg)
![tests](docs/badges/tests.svg)
![e2e](docs/badges/e2e.svg)
![coverage](docs/badges/coverage.svg)
![security](docs/badges/security.svg)
![licence](docs/badges/licence.svg)
![data](docs/badges/data.svg)

Wo stehe ich, kostet Parken hier gerade etwas, wie viel, wie lange darf ich
stehen — und wo wurde zuletzt das Ordnungsamt gesehen.

Eine PWA auf Basis der amtlichen Berliner Geodaten. Läuft im Browser, auf dem
Homescreen installierbar, ohne Server.

![Übersicht über Berlin mit Parkzonen, Umweltzone und Ladepunkten](docs/images/overview.png)

## Was sie kann

| | |
| --- | --- |
| **Zone finden** | Standort oder Tippen auf die Karte. 103 amtliche Zonen. Farbe trägt eine Aussage: Orange füllt, wenn kassiert wird, gebührenfreie Zonen bleiben als leise Kontur stehen — sonst wäre an einem Sonntag ganz Berlin eingefärbt und die eine Fläche, auf die es ankommt, ginge unter. |
| **Kosten** | Tarif, Geltungszeiten, „noch bis" / „frei bis". Berücksichtigt Feiertage und Sommerzeit. |
| **Parkuhr** | Auto-Position merken, Laufzeit, Erinnerung. Marker verschiebbar. Übersteht Neuladen. |
| **Umfeld** | 385 Ladepunkte, 84 Carsharing-Plätze, 108 P+R-Anlagen, 923 Behindertenparkplätze, Umweltzone. |
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

Dieses Repository begann 2012 als Java/Spring-Anwendung (`ParkingZone/`). Die
liegt unverändert daneben und wird nicht mehr gebaut — die Domäne ist dieselbe,
der Code teilt keine Zeile. Beim Umzug ins neue Repository bleibt sie zurück:
Von 2,8 MB waren nur 256 KB eigener Quelltext, der Rest Bezirksgrenzen in
doppelter Ausfertigung, einkopierte Fremdbibliotheken und eine
Excel-Add-in-Datei mit Makros.

Was den Neubau nötig machte: Die Zonendaten von damals waren von Hand in
ScribbleMaps gezeichnet (der Commit heißt wörtlich `ParkZonen invented`), und
Koordinaten waren durchgängig lat/lon vertauscht — zweimal, sodass es sich
aufhob. Die Ideenliste von 2012 ist dagegen gut gealtert und war die Vorlage für
den Funktionsumfang — sie zieht als kommentiertes Dokument mit um:
[docs/ideen-2012.md](docs/ideen-2012.md).

## Daten

Alles von der [Geodateninfrastruktur Berlin](https://gdi.berlin.de), WFS 2.0.0,
Lizenz [Datenlizenz Deutschland Zero 2.0](https://www.govdata.de/dl-de/zero-2-0)
— keine Namensnennung erforderlich. **210.527 bewirtschaftete Stellplätze** in
103 Zonen.

Vollständige Liste mit Endpunkten, Lizenzen und geprüften Negativbefunden:
[docs/data-sources.md](docs/data-sources.md).

Daten werden zur Buildzeit eingefroren, nicht zur Laufzeit geladen: Der
Segment-Layer ist ~49 MB, ein Snapshot macht die App offlinefähig, und
Zonendaten ändern sich über Monate — ein täglicher Rebuild ist frischer als die
Quelle sich bewegt. CORS wäre kein Hinderungsgrund, `gdi.berlin.de` sendet
`Access-Control-Allow-Origin: *`.

## Was an den Daten schwierig ist

Zeiten und Gebühren kommen als **Freitext** — 28 Schreibweisen über beide
Berliner Feeds für rund zehn tatsächliche Fahrpläne:

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
  apps/web           PWA: React 19, Vite 7, MapLibre GL 5
  apps/api           Cloudflare Worker: WFS-Cache + geteilte Meldungen (optional)
ParkingZone/         Java-Original von 2012, nicht gebaut, zieht nicht mit um
```

`core` hängt von keinem Framework ab. Ein späterer nativer Client wäre ein
zusätzliches Frontend, kein Rewrite.

## Entwickeln

```bash
cd app
pnpm install
pnpm test                              # 129 Unit-Tests
pnpm test:coverage                     # Schwellwerte: 85 % Zeilen, 80 % Zweige
pnpm typecheck
pnpm --filter @parkingzone/web dev
cd apps/web && npx playwright test     # 94 End-to-End-Tests
```

Bringt die Umgebung einen Chromium mit, den Playwright nicht selbst
installiert hat, zeigt `PLAYWRIGHT_CHROMIUM=/pfad/zu/chromium` darauf.

Daten neu ziehen:

```bash
pnpm --filter @parkingzone/ingest fetch
pnpm --filter @parkingzone/ingest build-data
```

`gdi.berlin.de` wird von der *Telekom Security TLS RSA Root 2023* signiert, die
in manchen Container-Images fehlt. Bei einem Zertifikatsfehler ein aktuelles
Mozilla-Bundle anhängen (`python -c 'import certifi; print(certifi.where())'`)
und per `--cacert` übergeben — nicht die Verifikation abschalten.

## Qualität

| | |
| --- | --- |
| Unit-Tests | 129, davon 24 Regressionstests für konkrete gefundene Fehler |
| End-to-End | 93 bestanden über Desktop und Handy, gegen den Produktions-Build (ein 94. läuft nur in der Handy-Variante) |
| Coverage | 96,3 % Zeilen, 89,8 % Zweige, 98,0 % Funktionen (`packages/core`) |
| Typprüfung | `strict` inkl. `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes` |
| Abhängigkeiten | `pnpm audit`: keine bekannten Lücken |

Die Badges oben werden vom CI aus den echten Messwerten generiert — kein
externer Dienst, damit sie auch in einem privaten Repository funktionieren.

Sicherheitsmaßnahmen und Bedrohungsmodell: [SECURITY.md](SECURITY.md).

## Betrieb

Drei Wege, alle kostenlos: als Claude Artifact (läuft bereits), statisch auf
GitHub Pages oder Cloudflare Pages, oder mit eigenem Worker für geteilte
Meldungen und Live-Daten. Details, Kostenrahmen und Einrichtung:
[docs/hosting.md](docs/hosting.md).

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
erforderlich. Kartenkacheln: © OpenStreetMap-Mitwirkende, ODbL — die
Namensnennung in der App ist Lizenzbedingung.

Mitmachen: [CONTRIBUTING.md](CONTRIBUTING.md) ·
[Verhaltensregeln](CODE_OF_CONDUCT.md).

Welche weiteren Städte in Frage kämen und woran es jeweils hängt:
[docs/staedte.md](docs/staedte.md). Die Ideensammlung von 2012, mit dem was
daraus wurde: [docs/ideen-2012.md](docs/ideen-2012.md).

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
