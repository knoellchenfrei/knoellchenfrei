# Schwerin als achte Stadt — gemessen, entschieden, offen

> **Wo der Code liegt.** `app/packages/core/src/schwerin.ts` (Parser und
> Ankerpunkte), `app/packages/ingest/src/gml.ts` (GML-Leser),
> `app/packages/ingest/src/utm.ts` (UTM-Umrechnung mit Zone als Parameter),
> `app/packages/ingest/src/build-data-schwerin.ts` (Datenbau), dazu die
> Einträge in `city.ts`, `holidays.ts`, `sources.ts`, `fetch.ts`.

> **Stand 16. September 2026.** Angeschlossen: 10 Bewohnerparkzonen mit
> Zeiten und Beträgen, 143 Parkscheinautomaten als Sachdatenquelle, 64
> Behindertenparkplätze, 27 Stadtteile. Was fehlt, steht unter „Was offen
> bleibt" — vor allem der Wortlaut des Feiertagsgesetzes M-V, der aus dieser
> Arbeitsumgebung nicht abrufbar war.

Alle Zahlen hier sind an diesem Tag gegen die Dienste selbst gemessen, nicht
aus [staedte-recherche-2026-09-16.md](staedte-recherche-2026-09-16.md)
übernommen. Wo die Messung von der Recherche abweicht, steht es dabei.

## Die Quellen

| | Parkzonen | Parkscheinautomaten | Behindertenparkplätze | Stadtteile |
| --- | --- | --- | --- | --- |
| Art | WFS 2.0.0 (MapServer) | derselbe Dienst | derselbe Dienst | WFS 2.0.0 (MapServer), zweiter Dienst |
| Adresse | `https://geoportal.kreis-lup.de/ows/masterportal/parken-sn` | | | `https://geoportal.kreis-lup.de/ows/masterportal/raumgliederung-sn` |
| Typname | `masterportal:Parkzonen` | `masterportal:Parkscheinautomaten` | `masterportal:Behindertenparkplatz` | `ms:Stadtteilgrenzen_Schwerin` |
| Umfang | `numberMatched="15"`, 16 Polygone (eine `MultiSurface`) | `numberMatched="143"` | `numberMatched="64"` | `numberMatched="27"`, 30 Polygone |
| Inhalt | **nur Geometrie** — kein Feld, keine Kennung | `Bezeichnung`, `Standort`, `Bewirtschaftungszeit`, `Hoechstparkdauer`, `Gebuehr`, `Tagesticket`, `Kurzparkticket`, `Bemerkung` | `Bezeichnung`, `Standort`, `Stellplaetze`, `Kategorie` (leer) | `stt_bezeich`, `stbez`, `ags`, `flaeche` … |
| Lizenz | `ows:AccessConstraints`, wörtlich: „Datenlizenz Deutschland - Namensnennung - 2.0. Quellenvermerk: Landeshauptstadt Schwerin" | dito | dito | dito, wortgleich |
| Ausgabeformat | **nur GML** — `application/gml+xml; version=3.2` und drei ältere GML-Fassungen | | | dito |
| Koordinaten | **nur EPSG:25833** | | | EPSG:25833 voreingestellt, EPSG:4326 als `OtherCRS` möglich |

Betreiber beider Dienste ist laut `ows:ProviderName` die „Vermessungs- und
Geoinformationsbehoerde des Landkreises Ludwigslust-Parchim und der
Landeshauptstadt Schwerin", `geodatenmanagement@kreis-lup.de`. Der
Raumgliederungs-Dienst ist über den GDI-DE-Katalog gefunden (CSW-Suche
„Schwerin Stadtteil", Treffer „Raumgliederung der Landeshauptstadt
Schwerin"); geratene Namen (`verwaltungsgrenzen-sn`, `stadtteile-sn`)
ergaben 404, die Dienstwurzel `…/ows/masterportal/` 403.

Nicht abgerufen: `masterportal:Parken` (40 Parkplätze und Parkhäuser mit
`Stellplaetze` — die App hat keine POI-Art dafür), `Wohnmobilstellplaetze`
(11), `P_and_R` (`numberMatched="0"`), `Parkplaetze_SN` (HTTP 400,
`ms_error->code not found`), sowie `Bezirksgrenzen_Schwerin` (4) und
`Baublockgrenzen_Schwerin` aus dem zweiten Dienst.

**Eine Korrektur an der Recherche:** Sie nannte die Ebene „15 Zonenpolygone
ohne jedes Attribut" richtig, aber nicht, *was* die Polygone sind. Es sind
Schwerins **Bewohnerparkzonen** — nicht die Tarifzonen 1 und 2 der
Parkgebührenverordnung. Siehe den nächsten Abschnitt.

## Die Eigenheit, die alles bestimmt: die Karte weiß mehr als der Dienst

Der WFS liefert die 15 Polygone ohne ein einziges Feld. MapServer sagt es
selbst, als Kommentar in der Antwort: `WARNING: No featureid defined for
typename 'Parkzonen'`. Ein `GetFeatureInfo` des WMS liefert dieselbe Leere
(`Feature 12:` ohne Attribut).

Der **WMS** desselben Dienstes zeichnet die Flächen aber in 15 Farben und
beschriftet sie. `GetLegendGraphic` für `Parkzonen` nennt, in dieser
Reihenfolge: `Parkzone A`, `A/F`, `A/D`, `C`, `C/D`, `D`, `F`, `G`, `H`,
`J`, `L`, `O`, `V`, `C/O`, `A/C`. Die Stadt bestätigt die zehn
Grundbuchstaben auf ihrer Parkseite
(<https://www.schwerin.de/mein-schwerin/leben/ordnung-sicherheit-verkehr/verkehr-mobilitaet/mit-dem-kfz/parken/>,
Dokumente `Uebersicht-Bewohnerparkzonen.pdf` und `ZoneA.pdf` … `ZoneV.pdf`).
Die fünf Mischflächen kennt nur der Dienst.

Die Zuordnung Fläche → Buchstabe ist so gemessen:

1. `GetLegendGraphic` als `image/svg+xml`: 15 Farbfelder, von oben nach unten
   in der Reihenfolge der Legende, je mit ihrer Füllfarbe (`rgb(…)`).
2. `GetMap` der Ebene `Parkzonen` als `image/svg+xml`, 2700 × 2500 Punkte in
   EPSG:25833: 15 gefüllte Pfade mit genau diesen Farben.
3. Jeder Pfad zurück in Meter gerechnet und stützpunktweise mit den 15
   WFS-Polygonen verglichen: **gleiche Stützpunktzahl** (24, 16/17, 35, 5, 28,
   5, 5, 27, 30, 38, 19, 25, 36, 10, 13) und ein **mittlerer Abstand von
   0,71 m** — die Rasterung der Zeichnung, nichts sonst.

Ergebnis, in der Reihenfolge der WFS-Antwort:

| # | Zone | Fläche | Automaten | # | Zone | Fläche | Automaten |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 0 | J | 24,5 ha | 7 | 8 | C | 43,4 ha | 19 |
| 1 | L | 5,3 ha | 0 | 9 | D | 29,5 ha | 15 |
| 2 | O | 19,0 ha | 3 | 10 | H | 29,2 ha | 25 |
| 3 | C/D | 0,4 ha | 0 | 11 | G | 22,8 ha | 12 |
| 4 | V | 7,6 ha | 0 | 12 | F | 61,4 ha | 40 |
| 5 | C/O | 0,1 ha | 0 | 13 | A/F | 3,2 ha | 4 |
| 6 | A/C | 0,1 ha | 0 | 14 | A/D | 1,9 ha | 3 |
| 7 | A | 24,2 ha | 15 | | | | |

Im Code steht das nicht als Reihenfolge, sondern als **Ankerpunkt je Zone**
(`SCHWERIN_ZONE_ANCHORS`): ein Punkt in EPSG:25833, der in genau dieser
Fläche liegt. Die Features haben keine Kennung, und die Reihenfolge einer
WFS-Antwort ist keine Zusicherung; ein Punkt in der Fläche überlebt jede
Umsortierung. Liegt ein Anker in keiner Fläche, in derselben kleinsten
Fläche wie ein anderer, oder stimmt die Zahl der Flächen nicht mit der Zahl
der Anker überein, **bricht der Datenbau ab** — dann hat die Stadt ihre Zonen
verändert, und die Tabelle gehört neu gemessen, nicht die Ausgabe geraten.

### Die Zonen liegen übereinander

`A/C` (0,1 ha) liegt vollständig in `A`; `A/F` überlappt `F`, `A/D`
überlappt `D`. Sieben Automaten stehen deshalb in zwei Zonen zugleich
(PA 1, 2, 9 in D und A/D; PA 17, 37, 38, 39 in F und A/F). Zwei Folgen:

- Der Anker einer Mischfläche liegt zwangsläufig auch in der Grundzone. Es
  gewinnt die **kleinste** Fläche, die ihn enthält (`planarArea`).
- Die Zonen werden **nach Fläche aufsteigend** ausgeliefert. `zoneAt` in der
  App nimmt die erste Fläche, die den Punkt enthält — so findet ein Tipp in
  `A/F` die Mischfläche und nicht das große `F` darunter.

Ein Automat in beiden zählt für beide. Das ist keine Doppelzählung, sondern
die Aussage der Karte: An dieser Stelle gelten beide.

## Nur GML, nur UTM 33

Gemessen am 16. September 2026 an `masterportal:Parkzonen`:

| Anfrage | Antwort |
| --- | --- |
| `outputFormat=application/json` | `'application/json' is not a permitted output format for layer 'Parkzonen', review wfs_getfeature_formatlist setting` |
| `application/geo+json`, `GEOJSON`, `geojson`, `application/json; subtype=geojson` | dieselbe Meldung, je mit dem Wert |
| `srsName=urn:ogc:def:crs:EPSG::4326`, `EPSG:4326`, `CRS:84`, `EPSG:4258`, `EPSG:3857` | `InvalidParameterValue`, locator `srsname`: „Invalid SRS" |
| ohne `srsName`, GML | `srsName="urn:ogc:def:crs:EPSG::25833"`, `262237.215592 5949291.058336` — Ost vor Nord |

Die Recherche hatte beides richtig. Was daraus folgt:

1. **`gml.ts`** — ein Leser für WFS-2.0-Antworten in GML 3.2, ohne
   Fremdbibliothek: Punkte, Polygone mit Löchern, `MultiSurface`,
   `MultiPoint`, Sachfelder als Text, Entities, `ExceptionReport` als Fehler.
   Gemessen an zwei wörtlichen Auszügen der Antworten
   (`ingest/test/fixtures/sn-*-auszug-2026-09-16.gml`); ein leeres Feld ist
   eine leere Zeichenkette, kein `null`, weil MapServer es so schreibt.
2. **`utm.ts`** — die Krüger-Reihe aus `utm32.ts`, mit der Zone als
   Parameter; `utm32.ts` ist seitdem ein Aufruf für Zone 32, Kölns Tests
   laufen unverändert. Gemessen in Zone 33 gegen zwei Behörden: 159
   Stützpunkte der **Berliner** Parkzonen (`gdi.berlin.de`, acht
   Nachkommastellen; Abweichung gleichmäßig 3,6–4,5 mm, vermutlich ein
   Datumsübergang, den GeoServer rechnet und wir bewusst nicht) und 2.259
   Stützpunkte der **Schweriner** Stadtgrenze aus dem Raumgliederungs-Dienst,
   der EPSG:4326 kann (sechs Nachkommastellen, also ein Dezimeter; gemessen
   unter 15 cm). Vierzehn und acht davon stehen in `ingest/test/utm.test.ts`.
3. **`sources.ts`** kennt seitdem `encoding: 'gml'` und `srsName` je Quelle;
   `fetch.ts` zählt bei GML die `wfs:member` statt `features` und legt
   `<key>.gml` ab. Der Datenbau prüft die Antwort dreifach: `srsName` der
   Antwort muss 25833 sein, `assertUtm` verlangt Meter, `assertDegrees`
   prüft das Ergebnis der Umrechnung.

## Die Zeitangabe: fünf Schreibweisen, alle mit Tagesspanne

`Bewirtschaftungszeit` über 143 Automaten:

| Wert | Anzahl |
| --- | --- |
| `Mo - Sa 8-20 h` | 125 |
| `Mo - Fr 8-18 h` | 7 |
| `Mo - So 8-21 h` | 5 |
| `Mo - So 0-24 h` | 4 |
| `Mo - So 8-18 h` | 2 |

Eine Form, ohne Ausnahme: Tagesspanne mit Leerzeichen um den Bindestrich,
Stundenspanne ohne, ein nacktes „h". `parseSchwerinSchedule` liest genau
das — und **nur** das: kein einzelner Tag, keine Minuten, keine zweite
Klausel, kein Fenster über Mitternacht. Nichts davon kommt vor, und eine
Schreibweise, die nie gegen den Abzug gemessen wurde, soll den Datenbau
anhalten statt durchlaufen. `0-24` ist Minute 0 bis 1440.

### Was gilt, wenn Automaten einer Zone einander widersprechen

Sieben der zehn Zonen tragen mehr als eine Zeitangabe. Zone A: `Mo - Sa 8-20 h`
(10 Automaten), `Mo - So 8-21 h` (4), `Mo - So 8-18 h` (1). Zone D:
`Mo - Sa 8-20 h` (10), `Mo - Fr 8-18 h` (3), `Mo - So 0-24 h` (2).

Entschieden wie in Frankfurt: **Die Fenster werden vereinigt.** `windowCovers`
fragt, ob *irgendeines* passt; die App warnt damit sonntags um 20 Uhr in Zone
A vor einer Gebühr, die an vier von fünfzehn Automaten wirklich anfällt. Die
Alternativen sind beide schlechter: Die Mehrheit nehmen hiesse, sonntags am
Pfaffenteich „frei" zu sagen, wo vier Automaten kassieren — ein Knöllchen.
Die Fenster zu `8-21` verschmelzen hiesse, zehn Automaten eine Stunde
anzudichten. Was wirklich an den Automaten steht, zeigt das Panel wörtlich,
je Schreibweise mit Zähler (`rawHours`: `Mo - Sa 8-20 h (10×); Mo - So
8-21 h (4×); Mo - So 8-18 h`).

## Die Höchstparkdauer

`ohne` (104), `2 h` (25), `4 h` (13), leer (1 — der Marstall). `ohne` und leer
heißen „keine Begrenzung", nicht null Minuten; `0 h` bräche ab. Wie in
Frankfurt, Köln und Karlsruhe wird sie **nie** als Regel der Zone ausgegeben:
In sieben Zonen stehen „ohne" und „2 h" nebeneinander. `maxStay` nennt den
häufigsten begrenzten Wert, `maxStayShare` den Anteil (Zone D: `2h` an 93 %,
Zone A: `4h` an 40 %), `maxStayValues` alle.

## Die Entscheidung zur Gebühr

`Gebuehr`: `2.50 Euro je Std.` (134), `1.50 Euro je Std.` (7), leer (2). Mit
**Dezimalpunkt** — als einzige Stadt. Ein Komma wird nicht angenommen; wechselt
die Quelle die Schreibweise, hält der Datenbau an.

Die Beträge decken sich mit der Parkgebührenverordnung vom 1. Juli 2024
(Stadtseite: „in der gesamten Innenstadt (Parkzone 1) 2,50 Euro pro Stunde.
Für das restliche Stadtgebiet (Parkzone 2) … 1,50 Euro"). Die 1,50 € stehen an
den sieben Automaten außerhalb der Innenstadt (Zoo, Zippendorf, Werdervorstadt,
Werder); drei davon liegen in Zone O — die einzige ausgelieferte Zone mit
1,50 €. **Keine Zone nennt zwei Beträge**; `mergeSchwerinFees` bleibt
trotzdem eine Spanne für den Tag, an dem sich das ändert.

Die zwei leeren Beträge sind kein Nullbetrag: **PA 12, Am Marstall**
(`Bemerkung`: „Sonderregelung: Privatparkplatz Landesregierung, ab Fr 17.00
Uhr bis So öffentlich", `Mo - So 0-24 h`, keine Höchstparkdauer) und
**PA 138, Zoo** („nur Tagesticket für 4 Euro"). Beide liegen in keiner Zone.
`Fee.unknown`, und `schwerinAutomatNote` reicht die Bemerkung weiter — „Lage
kontrollieren" (PA 70) dagegen nicht, das ist eine Notiz des Amts an sich
selbst.

Eine Kuriosität: **`PA 138` steht zweimal** (Amtstraße 21 und Zoo, zwei
Features, zwei Orte). Die Bezeichnung ist also keine Kennung; der Datenbau
benutzt sie nirgends als solche.

## Die Zuordnung Automat → Zone

Über die Geometrie, wie in Frankfurt: Punkt-in-Polygon nach der Umrechnung.
Gemessen am 16. September 2026:

| | |
| --- | --- |
| Automaten mindestens einer Zone zugeordnet | **136** von 143 |
| davon in zwei Zonen | 7 |
| Zuordnungen insgesamt | 143 |
| in keiner Zone | **7**: PA 41 Am Strand, PA 138 Zoo, PA 142 Bornhövedstraße, PA 141 Am Werder, PA 138 Amtstraße, PA 58 Werderstraße, PA 12 Am Marstall |
| Zonen ohne Automaten | **5**: L, V, C/D, C/O, A/C |

Die sieben außerhalb sind die Parkzone-2-Automaten (1,50 €) am Zoo, in
Zippendorf und am Werder, dazu der Marstall und die Werderstraße. Sie werden
nicht ausgeliefert — das POI-Schema kennt keine Art dafür, wie in Frankfurt
(113) und Köln (288). Die fünf Zonen ohne Automaten werden ausgelassen, nach
demselben Kriterium wie überall: Ein Polygon ohne Antwort wäre schlechter
als kein Polygon. In L und V stehen keine Automaten (reines Bewohnerparken
oder Parkscheibe — die Quelle sagt es nicht); C/D, C/O und A/C sind
Mischflächen von 0,1 bis 0,4 ha.

## Stadtteile und Box

Die 27 Stadtteile (`stt_bezeich`: Altstadt, Feldstadt, Paulsstadt,
Schelfstadt, Werdervorstadt, … Schweriner See) treffen alle zehn Zonen: A und
A/F in der Altstadt, C und A/D in der Schelfstadt, D, G, H und J in der
Paulsstadt, F in der Feldstadt, O in der Werdervorstadt.

`reportBounds` kommt aus `ms:Stadtgrenzen_Schwerin` (ein Feature, 2.259
Stützpunkte, in EPSG:4326 abgerufen): 11,2960–11,5055 / 53,5443–53,6873,
nach außen gerundet `{ 11.29, 53.54, 11.51, 53.69 }`. Die Zonen selbst liegen
nur zwischen 11,39 und 11,43 Länge — wer die Box daraus nähme, wiese eine
Meldung aus Lankow oder Mueß als „außerhalb" ab. Hamburg endet bei 10,35°
Ost; der Paar-Test in `city.test.ts` bleibt grün. Zoom **13**: 0,22° Länge,
und alle Zonen in 2,5 × 2,4 km um die Altstadt.

## Der Probelauf

```
Schwerin — Daten bauen …
  districts.geojson: 52 KB
  zones.geojson: 10 KB
  poi.geojson: 11 KB
  umweltzone.geojson: 0 KB
  meta.json: 1 KB

10 von 15 Zonen übernommen — ohne Automaten ausgelassen: A/C, C/O, C/D, L, V, 0 ohne Stadtteil-Treffer
136 von 143 Automaten mindestens einer Zone zugeordnet, 7 liegen in keiner (143 Zuordnungen insgesamt)
64 Behindertenparkplätze, 27 Stadtteile
```

`umweltzone.geojson` ist leer und heißt hier wirklich „gibt es nicht": In
Mecklenburg-Vorpommern gibt es keine Umweltzone. `absent`:
`['umweltzone', 'segments']`. Die Einheiten der Langzeitmuster: 10 (9 Zonen,
1 Bezirk — `A/D` mit 1,9 ha liegt unter der 2-ha-Grenze und geht in die
Schelfstadt).

## Feiertage: Mecklenburg-Vorpommern

Neu in `holidays.ts` als `MV`: die neun bundesweiten plus **Internationaler
Frauentag** (8. März, seit 2023) und **Reformationstag** (31. Oktober) — elf.
Kein Fronleichnam, kein Allerheiligen, kein Buß- und Bettag, keine
gemeindeweise Regelung. Damit ist MV das einzige Land mit Berlins Frauentag
*und* Hamburgs Reformationstag; die Tests messen den Eintrag gegen beide
Nachbarn, und `schwerin.test.ts` hält fest, dass Zone A am 31. Oktober 2026
(Samstag) und am 8. März 2027 (Montag) nicht kassiert, an Fronleichnam aber
schon.

**Der Beleg ist nicht in der Form, die dieses Projekt verlangt.** Fundstelle
ist § 2 Abs. 1 des Gesetzes über Sonn- und Feiertage (Feiertagsgesetz M-V);
der Frauentag kam durch das Erste Gesetz zur Änderung des Feiertagsgesetzes
vom 5. Dezember 2022 (GVOBl. M-V S. 484) hinzu. Der **Wortlaut** liess sich
aus dieser Arbeitsumgebung nicht abrufen: `landesrecht-mv.de` (juris) liefert
an einen Abruf nur die leere Hülle einer React-Anwendung
(`jlr-FeiertGMVrahmen`, 5.559 Bytes ohne Gesetzestext) und setzt die
Verbindung bei jedem zweiten Versuch zurück; die Seiten des Innenministeriums
(`regierung-mv.de/…/Feiertage`) antworten mit 404, `dejure.org` mit 402. Die
Aufzählung ist damit aus dem Gedächtnis belegt, nicht zitiert — anders als
bei BayFTG, Hessen, NRW und BW. Ein Browser mit JavaScript zeigt den Text in
einer Minute; bis dahin ist der Zustand laut: Ein Test hält elf Tage fest.

## Wohin das abgeschleppte Auto kommt

Belegt auf der Seite des Kommunalen Ordnungsdienstes
(<https://www.schwerin.de/mein-schwerin/leben/ordnung-sicherheit-verkehr/ordnung-sicherheit/kommunaler-ordnungsdienst/>,
abgerufen am 16. September 2026), wörtlich: „Auskünfte darüber, ob Ihr
Fahrzeug vom Kommunalen Ordnungsdienst des Fachdienstes Gewerbe und
Ordnungsdienst abgeschleppt wurde und wo es abzuholen ist, erhalten Sie unter
der Telefonnummer: +49 385 545-1830. Nach Abschluss von Abschleppmaßnahmen
gehen entsprechende Informationen an die Leitstelle der Polizei, so dass dann
alternativ auch dort Auskünfte möglich sind unter der Telefonnummer: +49 3820
8888 2224". `towedVehicles` trägt beides.

## Was einzutragen bleibt

Nichts — alle gemeinsamen Dateien sind in diesem Zweig eingetragen. Für den
Merge, damit Konflikte bekannt sind:

| Datei | Eintrag |
| --- | --- |
| `core/src/city.ts` | `SCHWERIN`, in `CITIES` als achte |
| `core/src/holidays.ts` | `Land` um `'MV'`, `REGIONAL.MV`, Beleg im Kommentar |
| `core/src/index.ts` | `export * from './schwerin.js'` |
| `ingest/src/sources.ts` | `Source.encoding?`, `Source.srsName?`, `SCHWERIN_SOURCES`, `BY_CITY.schwerin`, `wfsUrl` liest `srsName` |
| `ingest/src/fetch.ts` | GML-Zweig (zählt `wfs:member`, schreibt `.gml`) |
| `ingest/src/utm32.ts` | dünner Aufruf von `utm.ts` |
| `ingest/package.json` | `build-data-schwerin` |
| `core/test/{city,fuzz,fixture-shape,holidays}.test.ts`, `ingest/test/{quellen,zone-units}.test.ts`, `web/test/flaechenpunkt.test.ts` | je ein Block bzw. `schwerin` in der Stadtliste |
| `web/statistik/main.ts` | `STADTNAMEN.schwerin` |
| `.github/workflows/deploy.yml`, `kacheln.yml` | `schwerin` in allen drei Stadtlisten |
| `NOTICE`, `README.md`, `docs/staedte.md`, `docs/data-sources.md`, `CLAUDE.md` | je eine Zeile bzw. ein Abschnitt |
| erzeugt | `zone-keys.generated.ts`, `zone-units.generated.ts`, `zone-units.generated.json`, `apps/web/public/data/schwerin/` |

Nicht angefasst, wie vereinbart: `index.html`, `manifest.webmanifest`,
`login-page.ts`, `docs/todo.md`.

## Was offen bleibt

1. **Der Wortlaut von § 2 FTG M-V.** Siehe „Feiertage". Ein Browser genügt;
   danach gehört das Zitat in den Kommentar zu `MV` in `holidays.ts`, und
   dieser Absatz wird kürzer.
2. **Was `A/F`, `A/D`, `C/D`, `C/O`, `A/C` bedeuten.** Nur der Dienst kennt
   die Mischflächen; die Stadt nennt auf ihrer Seite zehn Buchstaben. Die
   naheliegende Lesart — beide Ausweise gelten — steht nirgends, deshalb heißt
   die Zone im Panel so, wie der Dienst sie beschriftet, ohne Erklärung. Eine
   Rückfrage bei `geodatenmanagement@kreis-lup.de` oder beim Fachdienst
   Verkehr der Stadt klärt es.
3. **Die sieben Automaten außerhalb der Zonen** und die Parkzone 2 der
   Gebührenverordnung. Die App kennt die zehn Bewohnerparkzonen, nicht die
   Tarifzonen; wer am Zoo oder in Zippendorf steht, bekommt „außerhalb". Die
   Lagepläne der Verordnung liegen als PDF bei der Stadt
   (`20251104Parkgeb.pdf`, 143 KB; `Parkgebuehrenverordnung-2024.pdf`) und
   liessen sich aus dieser Umgebung nicht lesen (kein `pdftoppm`, `pypdf`
   ohne `cryptography`).
4. **Fünf Zonen ohne Automaten** (L, V, C/D, C/O, A/C). Ob dort Parkscheibe
   oder reines Bewohnerparken gilt, sagt die Quelle nicht; ausgelassen statt
   geraten.
5. **Der Datumsübergang.** Berlins Punktpaare liegen gleichmäßig 4 mm neben
   der Reihe. Vermutung: GeoServer rechnet ETRS89 → WGS 84, `utm.ts` bewusst
   nicht. Unter jeder Ortungsgenauigkeit, aber ungeklärt; die Schranke im Test
   steht deshalb bei einem Zentimeter und nicht bei zwei Millimetern.
6. **PMTiles.** `scripts/build-tiles.sh` kennt Schwerin über `CITIES`; der
   Kachelbau läuft zentral.

## Prüfstand

```bash
cd app
pnpm -r typecheck                                  # grün, vier Pakete
pnpm test                                          # grün — core 913, ingest 98, api 101, web 298
cd .. && ./scripts/sprache-pruefen.sh              # grün
node scripts/doku-pruefen.mjs                      # grün
./scripts/namen-pruefen.sh                         # grün
./scripts/commit-pruefen.sh                        # grün
```

## Dateien

| Datei | Inhalt |
| --- | --- |
| `app/packages/core/src/schwerin.ts` | Zeit-, Gebühren-, Dauer-Parser, Zusammenlegen, Ankerpunkte, `schwerinZoneLetters` |
| `app/packages/core/test/schwerin.test.ts` | 55 Tests, inklusive Beschuss und einer Zone in der Zeit |
| `app/packages/core/test/fixtures/sn-parkscheinautomaten-2026-09-16.json` | Zählung aller Felder und 13 Automaten wörtlich, mit UTM-Position |
| `app/packages/core/test/fixtures/sn-parkzonen-2026-09-16.json` | alle 15 Flächen in EPSG:25833 — die Messlatte der Ankerpunkte |
| `app/packages/ingest/src/gml.ts`, `test/gml.test.ts`, `test/fixtures/sn-*-auszug-2026-09-16.gml` | der GML-Leser und zwei wörtliche Auszüge |
| `app/packages/ingest/src/utm.ts`, `test/utm.test.ts` | die Umrechnung mit Zone, 22 Punktpaare in Zone 33 |
| `app/packages/ingest/src/build-data-schwerin.ts` | der Datenbau |
| `app/apps/web/public/data/schwerin/` | der eingecheckte Abzug |
