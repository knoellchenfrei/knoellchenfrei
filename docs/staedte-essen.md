# Essen als sechzehnte Stadt — gemessen, entschieden, offen

> **Wo der Code liegt.** Parser `app/packages/core/src/essen.ts` (nur der
> Gebietsname — mehr gibt der Feed nicht her), Datenbau
> `app/packages/ingest/src/build-data-essen.ts`, Abzug
> `app/apps/web/public/data/essen/`, Tests `app/packages/core/test/essen.test.ts`
> und in den gemeinsamen Testdateien — alles auf demselben Zweig wie dieser
> Bericht, mit allen Einträgen in den gemeinsamen Dateien.

> **Stand 17. September 2026.** Essen ist die **erste Stadt der Klasse C**:
> Die Stadt veröffentlicht neun Bewohnerparkbereiche als Flächen und sonst
> nichts — keine Zeiten, keinen Tarif, keine Höchstparkdauer. Jede Zone geht
> mit `scheduleUnknown` und `fee: unknown` hinaus; die App zeigt die Grenze,
> färbt grau und sagt „Zeiten unbekannt". Dazu 50 Stadtteile und die
> Umweltzone aus demselben Portal, Lizenz DL-DE/BY-2.0 belegt. **Nicht**
> angeschlossen, weil es sie nicht als Daten gibt: die sechs Parkzonen der
> Parkgebührenordnung mit ihren Tarifen — sie stehen unten als das, was fehlt.

Alle Zahlen hier sind an diesem Tag gegen die Dateien selbst gemessen, nicht
aus [staedte-recherche-2026-09-16.md](staedte-recherche-2026-09-16.md)
übernommen. Die Recherche hat sich in jedem Punkt bestätigt: 9 Polygone,
25.371 Bytes, drei Felder, `[lon, lat]`, DL-DE/BY-2.0, `modified` 2022-11-09.
Neu gegenüber der Recherche: Die Verwaltungsgrenzen und die Umweltzone liegen
im selben Portal unter derselben Lizenz, und der Katalog führt **keinen**
Datensatz mit Parkscheinautomaten oder Tarifzonen — Essen bleibt Klasse C.

## Die Quellen

| | Bewohnerparkbereiche | Stadtteile | Umweltzone | Stadtgrenze |
| --- | --- | --- | --- | --- |
| Art | GeoJSON-Datei (DKAN-Download) | GeoJSON-Datei | GeoJSON-Datei | GeoJSON-Datei — **nur zum Messen** |
| Adresse | `https://opendata.essen.de/sites/default/files/Bewohnerparkbereiche.geojson` | `…/files/Stadtteile_WGS84.geojson` | `…/files/Umweltzone_Essen_0.geojson` | `…/files/Stadtgrenze_WGS84.geojson` |
| Datensatz | [bewohnerparkbereiche-essen](https://opendata.essen.de/dataset/bewohnerparkbereiche-essen) | „Verwaltungsgrenzen der Stadt Essen" | [umweltzone-essen](https://opendata.essen.de/dataset/umweltzone-essen) | „Verwaltungsgrenzen der Stadt Essen" |
| Umfang | **9 Polygone**, 25.371 Bytes, 237 Stützpunkte | 50 Polygone, 8,8 MB, 67.933 Stützpunkte | 3 Polygone, 317 KB | 1 Polygon, 6.552 Stützpunkte |
| Inhalt | `FID` (0–8), `Id` (überall 0), `NameGebiet` — **keine Zeiten, kein Betrag, keine Höchstparkdauer** | `STADTTEILE`, `STAT_NR`, `STADTBEZ`, `LDS`, `STADTT`, Flächenmaße | `ID`, `OBJECTID`, Flächenmaße | Flächenmaße |
| CRS | `crs: EPSG:4326` im Kopf, `[lon, lat]` (erste Koordinate `7,0214 / 51,4543`) | kein `crs`, `[lon, lat]` | `crs: EPSG:4326`, `[lon, lat]` | kein `crs`, `[lon, lat]` |
| Quelle laut Katalog | „FB 66 - Amt für Straßen und Verkehr / FB 62 - Amt für Geoinformation, Vermessung und Kataster" | „FB12 - Amt für Statistik, Stadtforschung und Wahlen / FB 62" | „FB 62 / FB 59 - Umweltamt" | wie Stadtteile |
| Lizenz | DL-DE/BY-2.0 (wörtlich unten) | dieselbe | dieselbe | dieselbe |
| Aktualität | Katalog `modified` **2022-11-09** | `modified` 2024-07-02 | `modified` 2024-07-02 | `modified` 2024-07-02 |

Der Lizenzbeleg, zweifach: Auf der Datensatzseite
`https://opendata.essen.de/dataset/bewohnerparkbereiche-essen` steht wörtlich
„Lizenz **Datenlizenz Deutschland Namensnennung 2.0**" mit dem Verweis auf
`https://www.govdata.de/dl-de/by-2-0`; im Katalogexport
`https://opendata.essen.de/data.json` trägt der Datensatz
(`identifier: 4b8798cf-1830-4233-848f-26529c0f158a`) das Feld
`license: https://www.govdata.de/dl-de/by-2-0`. Alle 110 Datensätze des
Portals tragen dieselbe Lizenz. Namensnennung ist damit **Lizenzbedingung**;
der Quellenvermerk in `ESSEN.attribution.source` ist der Wortlaut aus der
Datensatzbeschreibung.

Gefunden wurden alle Dateien über `data.json` (110 Datensätze, lokal nach
`park|bewohner|anwohner|gebühr|stadtteil|stadtbezirk|umweltzone` gefiltert),
nicht durch Raten. Das Geodatenportal der Stadt (`geodaten.essen.de`) ist aus
dieser Umgebung nicht erreichbar (`CONNECT tunnel failed, 502`);
`geoportal.essen.de` antwortet, führt aber nur Kartenanwendungen
(Stadtplan, Ladestationen, Carsharing …) und keinen Dienst zum Parken. Die
Suche im Regionalportal `opendata.ruhr` (`organization:essen`, 111
Datensätze, `q=park`) liefert **null** Treffer.

Daneben ein Dokument der Stadt, das keine Daten sind, aber sagt, was fehlt:
die Seite **„Parkzonen und Parkgebühren"** der Verkehrsüberwachung
(`https://www.essen.de/leben/sicherheit_und_ordnung/verkehrsueberwachung/parken___parkzonen.de.html`,
abgerufen am 17. September 2026, HTTP 200). Sie steht unten wörtlich.

## Die Eigenheit, die alles bestimmt: Die Flächen sind nicht die Zonen

Die Stadtseite beginnt mit dem Satz: „Das Parkraumkonzept der Stadt Essen
sieht eine Zuordnung der bewirtschafteten Stellplätze zu drei Parkzonen vor.
Außerdem kann in Teilen der Bewohnerparkgebiete, in denen Bewohner\*innen mit
Parkausweis privilegiert sind, gegen Zahlung einer Gebühr geparkt werden."

Das ist die ganze Lage in zwei Sätzen. Die **Parkzonen** 1, 2, 3, 5 und 6
tragen Zeiten, Tarif und Höchstparkdauer — und es gibt sie nirgends als
Geometrie. Die **neun Flächen** im Feed sind die Bewohnerparkbereiche, und
für die sagt die Seite nur, dass „in Teilen" davon gegen Gebühr geparkt
werden kann (Parkzone 6, „Bewohnerparken"). In welchen Teilen, mit welchen
Zeiten, steht weder im Feed noch auf der Seite.

Deshalb keine Zuordnung. Parkzone 6 an alle neun Flächen zu hängen, hiesse:
„Mo–Fr 10–19, Sa 10–16 Uhr, 0,60 € je 15 Minuten" über einem Bereich, der zu
unbekannten Teilen reines Bewohnerparken ist — an einem Dienstag um 11 Uhr
stünde dort „kostet", wo ohne Ausweis gar nicht geparkt werden darf, und
„frei" um 20 Uhr, wo das Bewohnerparken weitergilt. Die andere Lesart wäre
genauso falsch. Was der Feed hergibt, ist die Grenze; was die App sagt, ist
„Zeiten unbekannt" (`scheduleUnknown: true`, `windows: []`,
`fee: { kind: 'unknown' }`, `meta.absent` mit `schedule` und `fee`). Das
Panel schreibt: „Die Stadt veröffentlicht für dieses Gebiet keine Zeiten und
keinen Tarif, nur seine Grenze. Was gilt, steht am Schild oder am Automaten."

Die neun Namen, wörtlich aus `NameGebiet`, mit dem Stadtteil, den der
Datenbau über den Mittelpunkt trifft:

| `FID` | `NameGebiet` | Stadtteil |
| --- | --- | --- |
| 0 | `Ostviertel` | Ostviertel |
| 1 | `Ostviertel 2` | Ostviertel |
| 2 | `Innenstadt Nord` | Stadtkern |
| 3 | `Museum-Süd (V)` | Rüttenscheid |
| 4 | `Museum-West (IV)` | Holsterhausen |
| 5 | `Museum-Nord (II)` | Südviertel |
| 6 | `Sternviertel (I)` | Südviertel |
| 7 | `Museum-Ost (III)` | Rüttenscheid |
| 8 | `Innenstadt Süd` | Stadtkern |

Der Name ist der Zonenschlüssel — wie in Köln („Porz-City") und Düsseldorf
(„Unterbilk (R)"). `FID` ist die Zeilennummer der Datei und beim nächsten
Export nicht sicher dieselbe; `Id` ist bei allen neun `0`. Die römischen
Ziffern I bis V gehören zu den fünf Bereichen um das Museum Folkwang; die
Stadtseite nennt für die Kombiparkplätze der Parkzone 5 zwei Ausweise
„Zentrum – Nord" und „Zentrum – Süd", die zu keinem der neun Namen wörtlich
passen — auch das eine Zuordnung, die nicht in den Daten steht.

Alle neun Flächen liegen zwischen 6,9971 und 7,0247 Länge, 51,4367 und
51,4642 Breite — ein Rechteck von 2 × 3 km um den Hauptbahnhof. Der
Flächenpunkt jeder Fläche liegt in ihr selbst (`flaechenpunkt.test.ts`,
gegen den echten Abzug).

## Die Zeitangabe

**Keine.** Kein Feld der Datei nennt eine Uhrzeit oder einen Wochentag; die
Fixture-Prüfung (`fixture-shape.test.ts`, „nennt kein Feld für Zeiten,
Betrag oder Höchstparkdauer") hält das fest, damit ein nachgeliefertes Feld
als Erstes dort auffällt.

Was die Stadt **auf ihrer Seite** nennt — wörtlich, damit die nächste Runde
weiss, was ein Datensatz enthalten müsste:

| Parkzone | Wo | Bewirtschaftung | Höchstparkdauer | Gebühren | Zeiten |
| --- | --- | --- | --- | --- | --- |
| 1 | „Citykernbereich" | Parkscheinautomaten | 90 Minuten | 1.–15. Min. 0,00 €, 16.–30. Min. 0,90 €, 31.–45. Min. 1,10 €, 46.–60. Min. 1,20 €, 61.–90. Min. 0,90 € „(je angefangene 15 Minuten)", Höchstparkgebühr 5,00 € | „bis auf wenige Ausnahmen von montags bis samstags zwischen 10 Uhr und 20 Uhr" |
| 2 | „erweiterter Citybereich und Kernbereiche der größeren Stadtteilzentren" | Parkscheinautomaten | 120 Minuten | 16.–30. Min. 0,40 €, 31.–45. Min. 0,50 €, 46.–60. Min. 0,60 €, 61.–120. Min. 0,60 €, Höchstparkgebühr 3,90 € | „montags bis freitags zwischen 10 Uhr und 19 Uhr und samstags von 10 Uhr bis 16 Uhr" |
| 3 | „Cityrandlage, Randbereiche größere Stadtteilzentren sowie kleinere Stadtteilzentren" | Parkscheiben, „Das Parken ist gebührenfrei" | 30–120 Minuten | — | Mo–Fr 10–19 Uhr, Sa 10–16 Uhr |
| 4 | — | „Derzeit nicht eingerichtet" | — | — | — |
| 5 | „Durch besondere Beschilderung ausgewiesene Flächen im Citykernbereich" | wie Tarifzone 1; Kombiparkplätze für Ausweise „Zentrum – Nord" und „Zentrum – Süd" | wie 1 | wie 1 | Mo–Sa 10–20 Uhr |
| 6 | „Parkzone 6 / Bewohnerparken" | Parkscheinautomaten | 240 Minuten | wie Zone 2 bis zur 60. Minute, 61.–240. Min. 0,60 €, Höchstparkgebühr 8,70 € | „montags bis freitags zwischen 10 Uhr und 19 Uhr und samstags von 10 Uhr bis 16 Uhr" |

Vier Dinge daran, die selbst ein perfekter Datensatz erst lesbar machen
müsste: Die Tarife sind **Viertelstundenstaffeln mit freier erster
Viertelstunde und Deckel**, kein Stundensatz — `Fee` müsste sie wie Zürichs
Staffel als Spanne ausdrücken; „bis auf wenige Ausnahmen" ist eine Regel
ohne Liste; die Seite sagt „drei Parkzonen" und führt sechs Nummern; und
Parkzone 6 gilt „in Teilen der Bewohnerparkgebiete". Nichts davon ist heute
ein Problem des Parsers, weil es keinen gibt.

## Die Höchstparkdauer

**Keine im Feed.** Auf der Seite je Parkzone (90, 120, 30–120, 240 Minuten),
siehe Tabelle. `maxStayMinutes` bleibt `null`, `maxStayShare` 0.

## Die Entscheidung zur Gebühr

`fee: { kind: 'unknown' }` an allen neun Flächen, `meta.absent` mit `fee`.
Nicht „0,00 €", nicht Parkzone 6, nicht eine Spanne über alle Zonen —
jeder dieser Werte wäre eine Behauptung über einen Ort, über den die Daten
nichts sagen (CLAUDE.md, „Kein Betrag ist nicht null Euro"). Das Panel sagt
„Tarif nicht angegeben" wie in München, dazu den Klasse-C-Satz.

## Die Achsenreihenfolge, gemessen

Alle drei Dateien schreiben `[lon, lat]`: Bewohnerparkbereiche
`[7,0214, 51,4543]`, Stadtteile `[7,0…, 51,4…]`, Umweltzone ebenso. Die
Stadtteile tragen **kein** `crs`, die beiden anderen `EPSG:4326` — das
Portal exportiert dieselbe Kette also nicht immer gleich. Der Datenbau prüft
deshalb zweimal: `assertDegrees` (keine UTM-Meter — die Shape-Fassung daneben
liegt in ETRS89/UTM 32 mit Zonenkennziffer, EPSG 4647) und `assertInEssen`
(jede Koordinate im Rahmen der Stadt — gedreht läge die Innenstadt bei
7° Nord, 51° Ost, vor Somalia, mit gültigen Graden). Die Zonen müssen im
Melderahmen liegen, Stadtteile und Umweltzone im Sitzungsrahmen; warum die
beiden Rahmen sich unterscheiden, steht unter „Der Rahmen".

## Der Probelauf

```
$ CITY=essen pnpm --filter @knoellchenfrei/ingest fetch-data
Stadt: essen — 0 Quellen nach …/app/.raw/essen
zones (Datei) … 25369 Bytes, 9 Features
districts (Datei) … 8839913 Bytes, 50 Features
lowEmissionZone (Datei) … 317371 Bytes, 3 Features

$ CITY=essen pnpm --filter @knoellchenfrei/ingest build-data-essen
Essen — Daten bauen …
  districts.geojson: 89 KB
  zones.geojson: 8 KB
  umweltzone.geojson: 34 KB
  poi.geojson: 0 KB
  meta.json: 1 KB

9 von 9 Bewohnerparkbereichen übernommen, alle ohne Zeiten und Tarif — 0 ohne Stadtteil-Treffer; 50 Stadtteile, Umweltzone in 3 Flächen
```

`meta.json`: `zones: 9`, `districts: 50`, `lowEmissionZone: true`,
`absent: ["poi", "segments", "schedule", "fee"]`. Die erzeugten Listen:
`zone-keys.generated.ts` kennt neun Essener Kennungen, `zone-units` neun
Einheiten mit 137 Punkten.

Der erste Lauf brach ab — an Kettwig, und das gehört hierher: Die
Stadtteile reichen bis 51,3476 Süd, der Melderahmen endet bei 51,351, und
`assertInEssen` prüfte alles gegen den Melderahmen. Seitdem prüft es Zonen
gegen den Melderahmen und Kartenebenen gegen den Sitzungsrahmen. Der Grund
für die 380 m steht im nächsten Abschnitt.

## Der Rahmen, der Mittelpunkt, die Auskunftsstelle

`reportBounds` kommt aus der **Stadtgrenze** (6,8944–7,1376 /
51,3476–51,5342, nach außen gerundet: 6,89–7,14 / 51,351–51,54), nicht aus den
neun Flächen (6,997–7,025 / 51,437–51,464): Steele, Borbeck, Werden und
Kettwig lägen sonst „außerhalb".

**Die Südkante ist die eine Stelle, an der der Rahmen enger ist als die
Stadt, und der Grund ist Düsseldorf.** Düsseldorfs Stadtgrenze
(`grenzen:stadtgrenze`, am 17. September neu abgerufen, 10.250 Stützpunkte)
reicht bei Wittlaer bis 51,3525 Nord, Essens bei Kettwig vor der Brücke bis
51,3476 Süd. Die beiden Umrisse überlappen sich also um 545 m in der Breite —
obwohl die Stellen 15 km auseinanderliegen (Wittlaer bei 6,75 Ost, Kettwig bei
6,96). Zwei achsenparallele Rahmen können das nicht beide vollständig fassen,
und `cityAt` verlangt, dass sie sich nicht schneiden (Test „hält die Rahmen
auseinander"); ein zweiter Test verlangt 0,001° Luft über jeder Ecke. Die
Trennlinie liegt deshalb bei **51,349 / 51,351**:

| | vorher | jetzt | verliert |
| --- | --- | --- | --- |
| Düsseldorf `maxLat` | 51,37 (2 km Luft über der Grenze) | **51,349** | 390 m Rheinufer und Angerwiesen nördlich von Bockum und Angermund (Umriss-Punkte über 51,349: 141, zwischen 6,74 und 6,81 Ost) |
| Essen `minLat` | — | **51,351** | 380 m Ruhrhang südlich von Kettwig vor der Brücke (Ortsmitte laut Photon 51,3601; Umriss-Punkte unter 51,351: rund 450, zwischen 6,92 und 6,98 Ost) |

In keinem der beiden Streifen liegt eine Parkzone oder ein Automat; eine
Meldung von dort wird abgewiesen, statt der falschen Stadt zugeschrieben. Die
Rechnung steht als Kommentar an `ESSEN` und `DUESSELDORF` in `core/city.ts`,
der Test „trennt Düsseldorf und Essen zwischen 51,349 und 51,351" in
`city.test.ts`. Düsseldorfs Raster (`heatGrid`) ist nicht betroffen — sein
Ursprung ist die Südwestecke.

Was der Rahmen **nicht** ausschließen kann: Gelsenkirchen. Dessen
Hauptbahnhof (7,1018 / 51,5049) liegt im Essener Rechteck, wie Leverkusen im
Kölner. Eine Meldung von dort wird angenommen und liegt in keiner Zone; ein
Rahmen, der das verhindert, wäre kein Rechteck mehr.

Der Mittelpunkt (7,011 / 51,4504) ist die Mitte des Rahmens der neun Flächen,
südlich des Hauptbahnhofs. Zoom **13** wie in Schwerin: Die neun Flächen
liegen in einem Rechteck von 2 × 3 km; bei 12 wären sie ein Fleck.

`towedVehicles` fehlt mit Absicht. Die Seiten der Verkehrsüberwachung nennen
eine Leitstelle für defekte Parkscheinautomaten (+49 201 88-32447) und zwei
Ansprechpartnerinnen für die Parkraumbewirtschaftung — keine Stelle, die
sagt, wohin ein Fahrzeug gebracht wurde. Eine Nummer aus zweiter Hand wäre
schlechter als keine; `OHNE_BELEG` in `city.test.ts` führt Essen.

## Feiertage: Nordrhein-Westfalen

Nichts Neues: `NW` steht seit Köln in `holidays.ts` mit Beleg (§ 2 Abs. 1 des
Gesetzes über die Sonn- und Feiertage, SGV. NRW. 113 — Fronleichnam und
Allerheiligen zu den neun bundesweiten).
Essen braucht kein `holidays`-Feld; eine gemeindeweise Regelung wie in Bayern
kennt das Land nicht. Der Kalender ist für eine Klasse-C-Stadt ohnehin ohne
Wirkung: Ohne Fenster gibt es nichts, was ein Feiertag freischalten könnte.

## Was einzutragen bleibt

Nichts — alle Einträge sind auf diesem Zweig gemacht. Zum Mergen die Liste
der **gemeinsamen** Dateien mit Essen-Zeilen: `core/src/city.ts` (Konstante
`ESSEN`, `CITIES`, **und Düsseldorfs `maxLat` 51,37 → 51,349** mit Kommentar),
`core/src/index.ts`, `ingest/src/sources.ts` (`ESSEN_FILES`, `FILES_BY_CITY`,
`BY_CITY`), `ingest/package.json`, `core/test/city.test.ts` (Import
`DUESSELDORF`, `ESSEN`; `OHNE_BELEG`; Block „Essen"),
`core/test/fuzz.test.ts`, `core/test/fixture-shape.test.ts`,
`ingest/test/quellen.test.ts`, `apps/web/statistik/main.ts`, `NOTICE`,
`README.md`, `CLAUDE.md`, `docs/staedte.md`, `docs/data-sources.md`,
`docs/todo.md`, `docs/release-notes.md`, `docs/staedte-duesseldorf.md`
(Rahmen); erzeugt: `zone-keys.generated.ts`, `zone-units.generated.ts`,
`zone-units.generated.json`. Die Stadtlisten in `deploy.yml`, `kacheln.yml`
und den Tests `flaechenpunkt`, `quellen`, `zone-units` kommen aus `CITIES`.
Nicht angefasst, weil zentral: `index.html`, `manifest.webmanifest`,
`login-page.ts`.

## Was offen bleibt

1. **Zeiten und Tarif** — die Frage an die Stadt. Die Parkzonen 1 bis 6 mit
   ihren Tarifen gibt es nur als Text; der Katalog (`opendata@essen.de`,
   Kontakt des Datensatzes „Verwaltungsgrenzen") führt weder Tarifzonen noch
   Parkscheinautomaten. Weg: FB 66 (Amt für Straßen und Verkehr) fragen, ob
   die Parkzonen als Geometrie oder die Automaten mit Zone und Zeiten als
   Datensatz veröffentlicht werden können. Sobald ein solcher Datensatz da
   ist, ist Essen keine Klasse C mehr: `scheduleUnknown` fällt, ein Parser
   kommt, und `fixture-shape.test.ts` meldet das neue Feld als Erstes.
2. **Stand 2022.** Der Datensatz ist am 9. November 2022 zuletzt geändert.
   Die Recherche vom 16. September notiert eine seit dem 1. Januar 2025
   „erweiterte" Parkraumbewirtschaftung; ob die neun Flächen noch der
   heutige Zuschnitt sind, sagt nur die Stadt. Weg: dieselbe Rückfrage.
3. **`geodaten.essen.de`** ist aus dieser Umgebung nicht erreichbar. Dort
   könnte ein WFS liegen, der die Bewohnerparkbereiche frischer führt als
   die DKAN-Datei — von einem anderen Rechner prüfen, bevor die Rückfrage
   an FB 66 geht.
4. **Gelsenkirchen im Rahmen.** Der Hauptbahnhof Gelsenkirchen liegt im
   Essener Rechteck (oben). Sobald Gelsenkirchen selbst angeschlossen würde
   (Klasse D, nur Automaten), müssten beide Rahmen neu geschnitten werden —
   derselbe Fall wie Düsseldorf/Essen, nur ohne 15 km Abstand.
5. **Düsseldorfs Nordkante** ist um zwei Kilometer nach Süden gerückt, davon
   390 m innerhalb der Stadtgrenze. Wer dort eine Zone findet, muss die
   Trennlinie neu verhandeln.
6. **Auskunftsstelle für abgeschleppte Fahrzeuge** — nicht belegt, siehe oben.
7. **Kachelarchiv** (`kacheln.yml`) und die **Beschreibungstexte** der App
   laufen zentral; Essen steht über `CITIES` in beiden Stadtlisten.

## Prüfstand

Alle am 17. September 2026 grün, aus `app/` bzw. der Wurzel:
`pnpm -r typecheck`, `pnpm test` (core 1373, ingest 108, api 101, web 312),
`./scripts/sprache-pruefen.sh`, `node scripts/doku-pruefen.mjs`,
`./scripts/namen-pruefen.sh`, `./scripts/commit-pruefen.sh`. Nicht gelaufen:
die E2E-Suite (läuft zentral), der Kachelbau.

## Dateien

| Datei | Inhalt |
| --- | --- |
| `app/packages/core/src/essen.ts` | Parser für den Gebietsnamen (der einzige Schlüssel), Fehlerklasse, Roh-Feldtypen |
| `app/packages/core/test/essen.test.ts` | Parser gegen jeden Namen der Fixture plus Unfug, Klasse-C-Zone im Tarifmodell, Rahmen umschließt alle neun Flächen, Lizenz |
| `app/packages/core/test/fixtures/essen-bewohnerparkbereiche-2026-09-17.json` | alle neun Flächen, wörtlich, mit Geometrie |
| `app/packages/ingest/src/build-data-essen.ts` | Datenbau: Stadtteile, Zonen mit `scheduleUnknown`, Umweltzone; `assertDegrees`, `assertInEssen` |
| `app/apps/web/public/data/essen/` | `zones.geojson` (9), `districts.geojson` (50), `umweltzone.geojson` (3), `poi.geojson` (leer), `meta.json` |
| `docs/staedte-essen.md` | dieser Bericht |
