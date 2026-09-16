# Freiburg im Breisgau als achte Stadt — gemessen, entschieden, offen

> **Wo der Code liegt.** Parser in `app/packages/core/src/freiburg.ts`,
> Datenbau in `app/packages/ingest/src/build-data-freiburg.ts`, der Abzug
> unter `app/apps/web/public/data/freiburg/`. Anders als bei Köln und
> Karlsruhe sind die gemeinsamen Dateien (`city.ts`, `sources.ts`, `index.ts`
> und die Listen) in diesem Arbeitsschritt **mit** eingetragen — die Stadt
> ist damit angeschlossen, sobald der Zweig gemergt ist.

> **Stand 16. September 2026.** Alle Zahlen hier sind an diesem Tag gegen
> die Dienste selbst gemessen, nicht aus
> [staedte-recherche-2026-09-16.md](staedte-recherche-2026-09-16.md)
> übernommen. Wo die Messung von der Recherche abweicht, steht es dabei.
> Was fehlt: eine Auskunftsstelle für abgeschleppte Fahrzeuge (kein Beleg
> gefunden) und die Bewohnerparkgebiete (bewusst nicht ausgeliefert, unten
> begründet).

## Die Quellen

Zwei WFS auf demselben MapServer `geoportal.freiburg.de`, beide von der
Stabsstelle Digitales Bauen und GeoIT betrieben. Der zweite wurde über den
GeoNetwork-Katalog der Stadt gefunden
(`https://geodaten.freiburg.de/geonetwork/srv/api/search/records/_search`,
Suche nach „Stadtteil"; der ältere `q`-Endpunkt antwortet nur noch „Use ES
search instead"), nicht durch Raten.

| | Parkgebührenzonen | Parkscheinautomaten | Behindertenparkplätze | Stadtteile |
| --- | --- | --- | --- | --- |
| Art | WFS 2.0.0 (MapServer) | derselbe Dienst | derselbe Dienst | WFS 2.0.0 (MapServer) |
| Adresse | `https://geoportal.freiburg.de/wfs/gut_parken/gut_parken` | | | `https://geoportal.freiburg.de/wfs/abi_gliederung/abi_gliederung` |
| Typname | `ms:parkgebzonen` | `ms:psa` | `ms:behindertenparkpl_uebersicht` | `ms:stadtteile` |
| Umfang | `numberMatched="37"`, 37 Polygone | `numberMatched="538"`, 538 Punkte | `numberMatched="195"`, 195 Punkte | `numberMatched="28"`, 28 Polygone |
| Inhalt | Zone 1/2/3, Betrag je Stunde, Tagespauschale, Zeit der Gebührenpflicht | Laufzeiten, Tarif (zweimal), Höchstparkdauer, Gebiet, Stadtteil, Handyparkzone, Kartenzahlung, aktiv | Straße, Hausnummer, Anzahl, Hinweis, Stadtteil | `nr`, `name`, Fläche, Umfang |
| Lizenz | DL-DE/BY-2.0, wörtlich in `ows:Fees` (unten) | dieselbe | dieselbe | dieselbe, zeichengleich |
| Aktualität | Katalog: `modified` 2026-07-02 (laut Recherche) | 2026-08-11 (laut Recherche) | — | — |

Der Lizenztext, wörtlich aus `ows:Fees` der `GetCapabilities` beider Dienste
(`?SERVICE=WFS&REQUEST=GetCapabilities&VERSION=2.0.0`):

```
Dieser Datensatz/Dienst kann gemäß der 'Datenlizenz Deutschland - Namensnennung - Version 2.0'
(https://www.govdata.de/dl-de/by-2-0) genutzt werden. 'Datengrundlage: Stadt Freiburg, www.freiburg.de'
```

`ows:AccessConstraints` sagt „Es gelten keine Zugriffsbeschränkungen". Der
Quellenvermerk ist damit der in den inneren Anführungszeichen, und so steht
er in `City.attribution.source`. Der Katalog-Metadatensatz der Zonen ist
`d7efdf6d-fe03-4db6-8e11-a41470ca3d0e`, der der Automaten
`09071df0-8773-4e8d-b91d-406289233151` (`MetadataURL` in den Capabilities).

Der Dienst `gut_parken` führt sechs Typnamen. Nicht abgerufen: `ms:bewohnerparken`
(33 Polygone, Begründung unten), `ms:behindertenparkplatz_detail` (328
Polygone, je Stellplatz eines — die Übersicht mit 195 Standorten reicht für
ein Symbol) und `ms:gesperrte_flaechen_pr` (6 gesperrte Flächen auf
P+R-Anlagen). Der Dienst `abi_gliederung` führt daneben `ms:stadtbezirke`
(42), `ms:statistische_bezirke`, `ms:baubloecke`, `ms:stadtbereiche`,
`ms:stadtteile_out`; die 28 Stadtteile sind die geläufige Gliederung.

Für den Stadtumriss ein dritter Dienst, nur einmal für die Konfiguration
abgefragt: `gdm_gemarkung/gdm_gemarkung`, Typname `ms:stadtkreis`, ein
Polygon, `7,6619–7,9309 / 47,9036–48,0710`. Daraus die `reportBounds`.

## Die Eigenheit, die alles bestimmt: die Fläche weiß es selbst

Anders als Frankfurt, Köln und Karlsruhe tragen Freiburgs Flächen Betrag
**und** Zeit als eigene Felder — wie Hamburg. Die 538 Automaten sind deshalb
nicht die Sachauskunft, sondern die **Gegenprobe**. Der Datenbau ordnet jeden
Automaten geometrisch der Fläche zu, in der er steht, und zählt:

| | Zahl |
| --- | --- |
| Automaten in einer Fläche | 515 von 538; keiner in zweien, 23 in keiner |
| Automaten-Attribut `gebuehrenzone` einig mit `parkgebuehrenzone` der Fläche | 510, uneins 5 |
| Automaten mit derselben Zeit wie ihre Fläche | 383; 23 mit einer anderen; 1 unlesbar |
| Automaten mit demselben Tarif wie ihre Fläche | 497, uneins 5 |
| Flächen ohne Automaten | 21 von 37 — alle Zone 3, alle mit eigener Zeit und eigenem Betrag |

Die 23 abweichenden Zeiten liegen an drei Flächen, alle im Log des Datenbaus:

- Fläche 40 (Zone 3, `werktags 09:00-19:00 Uhr`): 20 Automaten sagen
  `werktags 09:00 - 23:00`.
- Fläche 6 (Zone 2, `werktags 09:00-19:00 Uhr`): einer `werktags 09:00 - 23:00`,
  einer `werktags 05:30 - 20:45` (Standort „Rotlaubgarage").
- Fläche 5 (Zone 2, `werktags 09:00-19:00 Uhr`): einer
  `Mo-Fr 07:30-19:00; Sa 09-19` (Walter-Eucken-Gymnasium).

**Entscheidung:** Die Fläche gilt. Sie ist die amtliche Aussage über die
Fläche; ein Automat sagt, was an seinem Standort gilt, und ein
Schulparkplatz mit eigenen Zeiten ist kein Grund, die ganze Zone 2 mit 7:30
beginnen zu lassen. Die Zahlen stehen im Log, damit ein neuer Abzug auffällt,
wenn sich das Verhältnis dreht.

## Die Zeitangabe

### An den Flächen: sieben Schreibweisen

| Schreibweise | Anzahl | Ergebnis |
| --- | --- | --- |
| `werktags 09:00-19:00 Uhr` | 26 | Mo–Sa 9–19 |
| `durchgehend` | 6 | täglich 0–24 |
| `werktags 08:00-18:00 Uhr` | 1 | Mo–Sa 8–18 |
| `werktags 07:00-19:00 Uhr` | 1 | Mo–Sa 7–19 |
| `Montag - Freitag 07:30-19:00 Uhr; Samstag 09:00-19:00 Uhr` | 1 | Mo–Fr 7:30–19, Sa 9–19 |
| `werktags 09:00-19:00 Uhrä` | 1 | **Tippfehler** — abgewiesen, wörtlich korrigiert, `sourceDefect` |
| `Beschilderung beachten!` | 1 | **keine Zeit** — die Altstadt, unten |

„werktags" ist Montag bis Samstag, wie in Hamburg (§ 3 Abs. 2 BUrlG). Der
Tippfehler wird nicht vom Parser geschluckt: `freiburgScheduleTypo` kennt
genau diese eine Zeichenkette und ihre Korrektur; die Fläche bekommt
`sourceDefect: die Quelle schreibt „werktags 09:00-19:00 Uhrä"; gelesen als
„werktags 09:00-19:00 Uhr"`. Ein Muster („Uhr plus ein Buchstabe") wäre der
Anfang eines Parsers, der auch die Tippfehler liest, die eine Stunde
verändern.

### An den Automaten: siebzehn Schreibweisen

| Schreibweise | Anzahl |
| --- | --- |
| `werktags\n09:00 - 19:00` | 324 |
| `werktags\n09:00 - 23:00` | 87 |
| `werktags 09:00 - 19:00` | 50 |
| `werktags 09:00 - 23:00` | 26 |
| `täglich\n00:00 - 24:00` | 15 |
| `werktags 9-19 Uhr` | 13 |
| `täglich\n09:00 - 19:00` | 8 |
| `werktags 9:00 - 19:00` | 4 |
| `täglich\n09:00 - 23:00` | 3 |
| `werktags 9:00 - 23:00` | 1 |
| `werktags\n09:00 - 19:00\n` | 1 |
| `werktags\n05:30 - 20:45` | 1 |
| `Mo-Fr 07:30-19:00; Sa 09-19` | 1 |
| `werktags 09:00 - 18:00` | 1 |
| `täglich\n08:00 - 19:00` | 1 |
| `werktags 07:30 - 23:00` | 1 |
| `9 - 19 Uhr` | 1 — **ohne Tag**, abgewiesen |

Derselbe Parser liest beides: Zeilenumbrüche werden zu Leerzeichen, „Uhr"
ist optional, Minuten sind optional, Klauseln trennt ein Semikolon,
Tagesnamen gehen ausgeschrieben und abgekürzt. Der eine Automat ohne
Tagesangabe („Bürgerhaus Zähringen") bleibt unlesbar und wird gezählt; er
steht in Zone 3 und trägt für keine Fläche die Zeit.

### Die Altstadt: „Beschilderung beachten!"

Die einzige Fläche der Gebührenzone 1 (4,20 € je Stunde, Tagespauschale
21 €) nennt keine Zeit. Die Stadtseite
<https://www.freiburg.de/pb/1268180.html> nennt für Zone 1 „werktags 9–23
Uhr" (abgerufen am 16. September 2026, Tabelle „Parkgebühren im öffentlichen
Straßenraum": Zone 1 4,20 Euro / 21 Euro / 9–23 Uhr, Zone 2 3,50 / 17,50 /
9–19, Zone 3 1,80 / 9 / 9–19). In der Fläche stehen 109 Automaten:

| Laufzeit | Anzahl |
| --- | --- |
| `werktags 09:00 - 23:00` (in drei Schreibweisen) | 93 |
| `täglich 09:00 - 19:00` | 7 |
| `werktags 09:00 - 19:00` | 5 |
| `täglich 09:00 - 23:00` | 3 |
| `werktags 07:30 - 23:00` | 1 |

**Entscheidung:** Wie Frankfurt — die Fläche bekommt die **Vereinigung** der
Fenster ihrer Automaten (fünf verschiedene), `rawHours` nennt jede
Schreibweise mit ihrer Zahl, und `sourceDefect` sagt, dass die Fläche selbst
keine Zeit nennt. Die Alternative — die Fläche auslassen — hätte ausgerechnet
die Altstadt als „nicht bewirtschaftet" gezeigt. Die zweite Alternative — nur
die Mehrheit (93) — hätte an den zehn „täglich"-Automaten sonntags „frei"
gesagt. Was die Vereinigung kostet: Sonntags meldet die App für die ganze
Altstadt Gebührenpflicht 9–23 Uhr, obwohl 99 der 109 Automaten werktags
laufen. Das ist die billigere Richtung; die Zahlen stehen im Panel.

Gebührenpflicht sonntags in Zone 1 ist also **nicht** von der Stadtseite
gedeckt, sondern nur von zehn Automaten — steht unter „Was offen bleibt".

## Die Höchstparkdauer

Steht nur am Automaten (`hoechstparkdauer_in_h`, Zahl): 24 (506-mal), 1
(30), 2 (1), 4 (1). **24 gilt als „keine Begrenzung"** — das ist das
Tagesticket, nicht eine Regel, die nach 24 Stunden greift. Wie in Frankfurt
wird sie nie als Regel der Fläche ausgegeben (`maxStayMinutes: null`),
sondern als `maxStay`/`maxStayShare`/`maxStayValues`: In der Altstadt 29-mal
„1h" und einmal „2h" neben 79-mal keine, Anteil 0,275; in Fläche 6 einmal
„1h" von 134, Anteil 0,007. Die 21 Flächen ohne Automaten haben keinen Wert.

## Die Entscheidung zur Gebühr

Der Betrag kommt von der Fläche: `1,80 €` (28), `3,50 €` (2), `4,20 €` (1),
`--` (6). Komma, Leerzeichen, Eurozeichen — die Automaten schreiben denselben
Betrag als `1.80` in `tarif_e_h` und als Zahl `1.8` in `tarif_in_euro_h`;
`parseFreiburgAutomatFee` liest die Zeichenkette nur für die Gegenprobe (497
einig, 5 uneins — die fünf Automaten, deren `gebuehrenzone` nicht zur Fläche
passt).

Die sechs `--`-Flächen sind Park-and-Ride-Plätze (Bissierstraße, Munzinger
Straße, Breisgauer Straße, Gundelfinger Straße, …): Zeit `durchgehend`,
Tagespauschale `9,00 € oder ÖPNV-Ticket`, Automaten `täglich 00:00 - 24:00`.
Sie bekommen `Fee.unknown` und die Notiz „Tagespauschale 9,00 € oder
ÖPNV-Ticket" — nicht 0,00 €, nicht 9,00 € je Stunde. Ein Nullbetrag (`0,00 €`,
`0.00`) ist in beiden Parsern ein Abbruch; im Abzug steht keiner.

## Die Bewohnerparkgebiete: gemessen, nicht ausgeliefert

`ms:bewohnerparken`: 33 Polygone, `nummer` (32 verschieden — Nr. 31
„Neuburg / NE" zweimal, in zwei Stücken), `gebiet` („Annaplatz / AP"),
`gebart` 0/1, `prinzip` (`Mischprinzip` 23, `Trennprinzip` 10),
`beschreibung` (Straßenring als Freitext, bis 700 Zeichen). Kein Betrag,
keine Zeit. 31 der 33 liegen mit ihrem Zentroid in einer Gebührenzonen-Fläche;
480 der 538 Automaten stehen in einem Bewohnerparkgebiet.

**Entscheidung: gar nicht.** Die Frage dieser App ist „kostet Parken hier
gerade etwas" — und die beantworten die Gebührenzonen vollständig. Ein
Bewohnerparkgebiet sagt, wo ein **Ausweis** gilt; wer einen hat, kennt sein
Gebiet. Hamburg liefert seine Bewohnerparkgebiete aus, weil dort Zeit und
Betrag **an ihnen** hängen; in Freiburg hängen sie an der Gebührenzone
darüber. Eine zweite Ebene ohne Tarif würde auf der Karte aussehen wie eine
zweite Bewirtschaftung. Der Automat trägt sein Gebiet im Feld `gebiet` (35
Werte, 57 leer, mit Schreibvarianten wie `Sternwald Quartier` neben
`Sternwaldquartier`); es wird nicht ausgeliefert.

## Der Probelauf

`CITY=freiburg pnpm --filter @knoellchenfrei/ingest fetch-data`: vier
Quellen, 37 / 538 / 195 / 28 Features, keine Abweichung von `sources.ts`.
`CITY=freiburg pnpm --filter @knoellchenfrei/ingest build-data-freiburg`:

```
37 von 37 Flächen übernommen — 0 mit unlesbarer Zeit ausgelassen,
  0 mit „Beschilderung beachten!" ohne Automaten ausgelassen, 0 ohne Stadtteil-Treffer
515 von 538 Automaten einer Fläche zugeordnet, 23 liegen in keiner, 0 nicht aktiv
Attribut gebuehrenzone: 510 mal einig mit der Fläche, 5 mal uneins
Zeiten: 383 Automaten sagen dasselbe wie ihre Fläche, 23 etwas anderes, 1 unlesbar („9 - 19 Uhr" ×1)
Betrag: 497 Automaten einig mit ihrer Fläche, 5 uneins
195 Behindertenparkplatz-Standorte, 28 Stadtteile
```

Dateien: `zones.geojson` 43 KB, `districts.geojson` 39 KB, `poi.geojson`
32 KB, `umweltzone.geojson` leer (Freiburg hat seit 2010 eine Umweltzone; der
Dienst führt ihre Geometrie nicht — `absent` heißt „nicht in diesem Abzug"),
`meta.json` mit `absent: ['umweltzone', 'segments']`. Die 37 Flächen
verteilen sich auf 16 der 28 Stadtteile; `zone-keys.generated.ts` führt 37
Kennungen für Freiburg.

Der Zonenschlüssel ist `<Zone> (Fläche <fid>)`, also `3 (Fläche 12)` — „Zone
3" allein tragen 34 Flächen, und ein Schlüssel, der 34-mal vorkommt, war in
Hamburg der Fehler mit den 44 Strichen.

## Feiertage: Baden-Württemberg

Der `BW`-Eintrag steht seit Karlsruhe in `holidays.ts`, belegt mit § 1 Abs. 1
FTG BW und der Feiertagsseite des Innenministeriums: zwölf Feiertage, Heilige
Drei Könige, Fronleichnam und Allerheiligen landesweit, **keine**
gemeindeweise Regelung. Freiburg braucht deshalb kein `holidays`-Feld. Der
Test in `freiburg.test.ts` rechnet Fronleichnam 2026 an einer Zone-3-Fläche
gebührenfrei und in Berlin gebührenpflichtig.

## Was einzutragen bleibt

Nichts — dieser Arbeitsschritt hat die gemeinsamen Dateien eingetragen. Zur
Kenntnis für den Merge, Datei für Datei:

| Datei | Eintrag |
| --- | --- |
| `app/packages/core/src/city.ts` | `FREIBURG` und in `CITIES` |
| `app/packages/core/src/index.ts` | `export * from './freiburg.js'` |
| `app/packages/ingest/src/sources.ts` | `FREIBURG_SOURCES`, `BY_CITY.freiburg` |
| `app/packages/ingest/package.json` | Skript `build-data-freiburg` |
| `app/packages/core/test/city.test.ts` | `OHNE_BELEG` um `freiburg` |
| `app/packages/core/test/fuzz.test.ts` | drei Beschuss-Blöcke, zwei Parser im Zeitbudget |
| `app/packages/core/test/fixture-shape.test.ts` | Abschnitt „Freiburger Fixtures" |
| `app/packages/ingest/test/quellen.test.ts` | `freiburg` in der srsName-Liste |
| `app/apps/web/statistik/main.ts` | `STADTNAMEN.freiburg` |
| `.github/workflows/deploy.yml`, `kacheln.yml` | Stadtlisten (in `kacheln.yml` beide) |
| `NOTICE`, `README.md`, `docs/staedte.md`, `docs/data-sources.md`, `CLAUDE.md` | je eine Zeile bzw. ein Abschnitt |
| erzeugt | `zone-keys.generated.ts`, `zone-units.generated.ts`, `apps/api/src/zone-units.generated.json` |

Nicht angefasst, absichtlich: `index.html`, `manifest.webmanifest`,
`login-page.ts` (Beschreibungstexte), `docs/todo.md`.

## Was offen bleibt

1. **Sonntags in der Altstadt.** Zehn der 109 Automaten in Zone 1 sagen
   „täglich", die Stadtseite sagt „werktags 9–23 Uhr". Die App meldet
   sonntags Gebührenpflicht für die ganze Fläche. Weg: beim Garten- und
   Tiefbauamt nachfragen, ob die zehn Standorte (Sedanquartier, Moltkestraße,
   Werthmannstraße) Sonderflächen sind — dann gehörten sie als eigene Fläche
   in den Feed, oder die App nimmt die Mehrheit und nennt die zehn in der
   Notiz.
2. **Fläche 40 (Zone 3) mit 20 Automaten bis 23 Uhr.** Die Fläche sagt
   9–19, ein Viertel ihrer Automaten 9–23. Entweder ist die Fläche zu grob
   geschnitten oder die Automaten sind falsch beschriftet; die App folgt der
   Fläche. Dieselbe Rückfrage.
3. **Der Tippfehler `Uhrä`** (Fläche 32, Wiehre) gehört der Stadt gemeldet.
   Verschwindet er, bleibt `KNOWN_TYPOS` als leere Tabelle stehen — oder wird
   gelöscht.
4. **Abschleppen.** Auf freiburg.de fand sich keine Seite, die eine
   Verwahrstelle mit Namen und Nummer nennt; „Parkverstoß" verweist nur auf
   Gemeindevollzugsdienst und Polizei. `towedVehicles` fehlt, `OHNE_BELEG`
   führt `freiburg`. Weg: Amt für öffentliche Ordnung fragen.
5. **Umweltzone.** Freiburg hat eine; ihre Geometrie liegt in keinem der
   drei geprüften Dienste. Weg: Katalogsuche „Umweltzone" — nicht gemacht.
6. **`kacheln.yml`** führt Freiburg jetzt in beiden Listen; das Kachelarchiv
   `freiburg.pmtiles` muss einmal gebaut und hochgeladen werden
   (`scripts/build-tiles.sh freiburg --hochladen`), sonst bleibt die
   Hintergrundkarte leer.
7. **`expectedFeatures`** stehen auf dem Stand vom 16. September. Die
   Automaten wachsen laut Katalog laufend (`modified` 2026-08-11); ein
   Zuwachs meldet sich im Log von `fetch-data` von selbst.

## Prüfstand

```bash
cd app
pnpm -r typecheck                                  # grün
pnpm --filter @knoellchenfrei/core test            # grün, davon 82 Tests für Freiburg
pnpm test                                          # grün
cd .. && ./scripts/sprache-pruefen.sh && node scripts/doku-pruefen.mjs \
  && ./scripts/namen-pruefen.sh && ./scripts/commit-pruefen.sh
```

## Dateien

| Datei | Inhalt |
| --- | --- |
| `app/packages/core/src/freiburg.ts` | Zeit-, Gebühren- (Fläche und Automat), Dauer-Parser, Tippfehler-Tabelle, Flächenfelder, Automatenfelder |
| `app/packages/core/test/freiburg.test.ts` | 82 Tests: jede Schreibweise mit Zählung, Unfug, bis zur Antwort |
| `app/packages/core/test/fixtures/fr-parkgebzonen-2026-09-16.json` | alle 37 Flächen-Attribute, wörtlich |
| `app/packages/core/test/fixtures/fr-parkscheinautomaten-2026-09-16.json` | Auszählung der 538 Automaten und 18 Vertreter-Zeilen |
| `app/packages/ingest/src/build-data-freiburg.ts` | der Datenbau |
| `app/apps/web/public/data/freiburg/` | der Abzug: fünf Dateien |
