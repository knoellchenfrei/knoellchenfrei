# Gera als Stadt der Klasse C — gemessen, entschieden, offen

> **Wo der Code liegt.** Parser in `app/packages/core/src/gera.ts` (nur
> Zonenbuchstabe, Infotext und Behindertenparkplatz — es gibt keine Zeiten
> und keinen Betrag zu lesen), Datenbau in
> `app/packages/ingest/src/build-data-gera.ts`, Abzug unter
> `app/apps/web/public/data/gera/`, Stadtkonstante `GERA` in
> `app/packages/core/src/city.ts`, `TH` in `app/packages/core/src/holidays.ts`.
> Angeschlossen — die erste Stadt in Thüringen, Klasse C: Jede Zone trägt
> `scheduleUnknown`, die App sagt „Zeiten unbekannt" statt „frei".

> **Stand 17. September 2026.** Alle Zahlen hier sind an diesem Tag gegen den
> Dienst selbst gemessen, nicht aus
> [staedte-recherche-2026-09-16.md](staedte-recherche-2026-09-16.md)
> übernommen. Wo die Messung von der Recherche abweicht, steht es dabei —
> und sie weicht an der einen Stelle ab, die alles bestimmt. Was fehlt:
> Zeiten und Tarif (die stehen in der Parkgebührenordnung als PDF und am
> Schild, nicht im Dienst), die Lizenz (der Dienst nennt keine) und der
> Wortlaut des Thüringer Feiertagsgesetzes — alles unten unter „Was offen
> bleibt".

## Die Quellen

| | Anwohnerparkzonen | Ortsteile | Behindertenparkplätze | Stadtgrenze |
| --- | --- | --- | --- | --- |
| Art | GeoServer-WFS 2.0.0, `outputFormat=application/json` | dito | dito | dito, nur zum Messen des Rahmens |
| Adresse | `https://geoportal.gera.de/geoserver/gera/wfs` | dito | dito | dito |
| Typname | `gera:geom_portal_anwohnerparken` („Anwohnerparkzonen") | `gera:geom_portal_ortsteile` | `gera:geom_portal_behindertenparkplaetze` | `gera:geom_stadtgrenze_und_flaeche` |
| Umfang | `resultType=hits` → `numberMatched="148"`; Abruf 148 Features: **10 `Polygon`, 138 `LineString`** | **27** Polygone | **12** Punkte, 30 Plätze | 2 Polygone: 15.219,79 ha und eine 2,02-ha-Exklave bei 12,155/50,868 |
| Inhalt | `mslink` (148 eindeutige Nummern), `infostring` (`L - Calvinstraße`, 67 verschiedene), `anwohnerparkzone` (`A`…`L`, 10 Werte), `entity` (immer 0), `feature` (62637 bei den Flächen, 62638 bei den Linien), `mapid` (immer 2885) — **keine Zeiten, kein Betrag** | `ortsteil`, `mslink`, `entity`, `feature`, `mapid` | `infostring` (`Am Bärenweg (1 Platz)`), `click_size` (immer 40), Kennfelder | `flaeche_ha`, `flaeche_qm`, Kennfelder |
| CRS | `DefaultCRS urn:ogc:def:crs:EPSG::25833`; mit `srsName=urn:ogc:def:crs:EPSG::4326` Grad in `[lon, lat]` (erster Stützpunkt `[12.0917, 50.8787]`), **ohne** stillschweigend Meter (`[295415.59, 5640369.99]`) | dito | dito | dito |
| Lizenz | **nicht ausgewiesen** — `GetCapabilities` von WFS und WMS: `<ows:Fees>NONE</ows:Fees>`, `<ows:AccessConstraints>NONE</ows:AccessConstraints>`, `<Abstract/>` leer, kein `MetadataURL`; `ows:ProviderName` „Stadtverwaltung Gera", Kontakt „Sachbearbeiter Zentrales GIS", Telefon 0365 838-1224 | dito | dito | dito |
| Aktualität | Dienst ohne Datumsfeld, `timeStamp` der Antwort ist die Abrufzeit | dito | dito | dito |

**Was die Recherche sagte und was stimmt.** 148 Features, Felder
`anwohnerparkzone` und `infostring`, zehn Zonenwerte mit einem `C/G`, keine
Zeiten, keine Lizenz: stimmt. **Nicht** stimmt „148 LineStrings": Zehn der
148 sind **Polygone**, und zwar je Zonenbuchstabe genau eines — die Recherche
hat nur den ersten Geometrietyp gelesen. Das ändert die Entscheidung zur
Geometrie vollständig (nächster Abschnitt).

**Wo die Lizenz stehen müsste und nicht steht**, alles am 17. September
abgerufen: `opendata.gera.de` ist ein CKAN mit **null** Datensätzen („Wir
haben noch keinen Inhalt hier"); `geoportal.gera.de` ist eine
JavaScript-Anwendung ohne lesbaren Impressums- oder Nutzungstext, die
Karte `map/gera-map-parken.html` schreibt nur „Daten: © Stadt Gera"; das
Impressum von `gera.de` sagt „©gera.de Alle Rechte vorbehalten —
Vervielfältigung nur mit unserer Genehmigung" (und meint die Website). Kein
Eintrag im GDI-DE-Katalog zur Ebene. Deshalb `licenceFamily: 'unklar'`, die
App zeigt den Banner mit `licenceOpen`.

## Die Eigenheit, die alles bestimmt: Fläche und Straße in einer Ebene

Die Aufgabe hatte, der Recherche folgend, vorgesehen, 148 Linien je
Zonenbuchstabe zu Bändern zu puffern (Wiens `linien-puffer.ts`, 2 × 12 m)
und je Buchstabe zu einer Zone zu vereinigen. Die Messung sagt etwas
anderes:

| | Anzahl | Befund |
| --- | --- | --- |
| Flächen (`Polygon`) | 10 | je Buchstabe **eine**: A (4,8 ha, Bielitzstraße), B (38,9 ha, Innenstadt Nord), C (4,7 ha), C/G (0,9 ha, Zschochernstraße / Ziegelberg), D (2,5 ha, Hinter der Mauer), E (11,9 ha, Innenstadt Zentrum), G (15,5 ha, Ostviertel Nord), H (2,8 ha, Tivolistraße/Ernst-Toller-Straße), K (41,7 ha, Innenstadt Süd), L (26,6 ha, Ostviertel Süd) |
| Linien (`LineString`) | 138 | Straßenabschnitte, 4 bis 218 m, im Median 50 m, 8.012 m in Summe; 121 mit genau zwei Stützpunkten, längste mit 11 |
| Linien ganz in der Fläche ihres Buchstabens | 128 | — |
| Linien ganz in einer *anderen* Fläche | 6 | alle in der geteilten Fläche C/G oder an der gemeinsamen Grenze B/G/C (Ziegelberg, Laasener Straße, Zschochernstraße) |
| Linien teilweise oder ganz außerhalb jeder Fläche | 4 | Schillerstraße (C) **4,8 m**, Neue Straße (H) 2,2 m und 0,8 m, Louis-Schlutter-Straße (K) 0,1 m |
| Weitester Stützpunkt neben der eigenen Fläche | **4,8 m** | ein Bordstein, keine Straße |

Die Flächen decken die Linien. Ein Band um die Linien hätte keine Fläche
hinzugefügt, die nicht schon da ist, und es hätte 138 schmale Bänder erzeugt,
die auf der Karte über den Flächen liegen. Deshalb: **Die Flächen sind die
Zonen**, so wie die Quelle sie zeichnet, und die Linien sind die Straßen
darin — sie stehen als Straßenliste im `note` der Zone („Straßen laut
Quelle: …"), sonst ginge die eine Sachauskunft verloren, die die Ebene hat.
Der Datenbau wacht darüber: Jeder Stützpunkt jeder Linie muss in oder
höchstens **12 m** neben einer Fläche seines Buchstabens liegen (die halbe
Bandbreite aus Wien); die geteilte Fläche C/G zählt für C und für G. Eine
Linie weiter draußen hiesse, die Flächen decken die Zonen nicht mehr — dann
bricht der Bau ab, statt eine Straße stumm zu verlieren, und dann wäre der
Tag, an dem `linien-puffer.ts` doch gebraucht wird.

Die **geteilte Fläche `C/G`** bleibt eine eigene Zone mit diesem Schlüssel:
So schreibt es die Quelle, und die Stadtseite zum Bewohnerparken nennt
dieselbe Straße als „Zschochernstraße (Zone C und G)". Sie zu C oder zu G zu
schlagen wäre eine Entscheidung, die die Stadt nicht getroffen hat.

Kein `zoneSnapMetres`: Anders als Karlsruhes Stellplatzreihen sind die
Flächen ganze Quartiere (0,9 bis 41,7 ha); eine Ortung trifft sie.

## Der Zonenbuchstabe und der Infotext

Zehn Werte in `anwohnerparkzone`: `K` (28 Features), `B` (25), `G` (22),
`L` (19), `C` (17), `E` (14), `D` (9), `A` (8), `H` (5), `C/G` (1). Die
Buchstaben F, I und J kommen nicht vor. `parseGeraZoneKey` liest einen
Großbuchstaben oder zwei mit Schrägstrich (aufsteigend, verschieden) und
weist alles andere ab — `c`, `AB`, `C/C`, `G/C`, `Zone B`.

`infostring` hat bei allen 148 die Form `<Buchstabe> - <Name>`, und der
Buchstabe stimmt bei allen 148 mit dem Feld überein (der Datenbau vergleicht
und bricht sonst ab). Der Name ist bei den Flächen der Gebietsname
(`Innenstadt (Nord)`), bei den Linien der Straßenname; 67 verschiedene
Namen, der längste mit 44 Zeichen (`C - Ziegelberg, Zschochern-,
Bauvereinstraße`). Vier Schreibweisen fallen auf und werden durchgereicht,
nicht korrigiert: `Kurt-Keicher-Straße/Laasener Straße` und
`Tivolistraße/Ernst-Toller-Straße` (zwei Straßen in einem Abschnitt),
`Laasenerstraße` neben `Laasener Straße` (dieselbe Straße, zwei
Schreibweisen in Zone G), und sechs Straßen, die in zwei Zonen liegen
(Calvinstraße L/G, Laasener Straße G/B, Ziegelberg G/C/B, Schillerstraße
L/C, Bauvereinstraße L/C, Zschochernstraße C/G) — Zonengrenzen laufen durch
Straßen.

## Die Zeitangabe

Keine. Kein Feld der Ebene nennt eine Zeit, keins einen Betrag, keins eine
Höchstparkdauer; `fixture-shape.test.ts` hält fest, dass kein Feldname nach
`zeit|gebühr|tarif|dauer|preis|euro` aussieht. Jede der zehn Zonen geht mit
`scheduleUnknown: true`, `windows: []`, `rawHours: ''` hinaus.

## Die Höchstparkdauer

Keine — siehe oben.

## Die Entscheidung zur Gebühr

`fee: { kind: 'unknown' }`, `rawFee: ''`, `meta.absent` führt `fee`. Was
gilt, steht in der **„Gebührenordnung zur Erhebung von Parkgebühren und das
Ausstellen von Bewohnerparkausweisen"** der Stadt Gera, im Ortsrecht unter
„Bau, Verkehr und Straßen" als PDF
(`cms.gera.de/…/Ortsrecht_Bau__Verkehr_und_Strassen/Parkgebuehrenordnung_12.12.2022.pdf`,
78 KB, Stand 12. Dezember 2022). Die Datei ist abgerufen, ihr Text war aus
dieser Umgebung nicht lesbar (kein `pdftotext`, `pypdf` ohne
Kryptobibliothek, die Textströme mit eingebetteter Schrift) — sie ist der
erste Punkt unter „Was offen bleibt". Was die Stadtseite zum Bewohnerparken
(`gera.de/…/stadtservice-h35/bewohnerparken`) sagt: Der Bewohnerparkausweis
kostet **90,00 Euro**, gilt für Fahrzeuge bis 5 m Länge (bis 5,2 m mit der
Auflage, nur bestimmte Längs- und Querstellplätze zu nutzen: Bielitzstraße
Zone A, Clara-Zetkin-Straße und R.-Diener-Straße Zone B, Zschochernstraße
„Zone C und G", Innenhof Schuhgasse Zone E, Dr.-Friedrich-Wolf-Straße,
Schülerstraße, Karl-Schurz-Straße, Heinrich-Knauf-Straße Zone K), Ausnahme
Zone D. Das bestätigt die Buchstaben des Feeds; einen Besuchertarif oder
Zeiten nennt die Seite nicht.

## Der Probelauf

`CITY=gera pnpm --filter @knoellchenfrei/ingest fetch-data` am 17. September
2026: `zones … 148 features`, `districts … 27 features`, `accessible … 12
features`, alle drei Adressen mit `srsName`. Danach
`CITY=gera pnpm --filter @knoellchenfrei/ingest build-data-gera`:

```
10 Zonenflächen aus 148 Features (138 Straßenlinien, weitester Stützpunkt
4.8 m neben seiner Fläche), alle ohne Zeiten und Tarif — 0 ohne
Ortsteil-Treffer; 27 Ortsteile, 12 Behindertenparkplätze
```

Dateien: `zones.geojson` 10 KB (10 Flächen, 8 bis 41 Stützpunkte nach
Vereinfachung auf 1e-5), `districts.geojson` 59 KB, `poi.geojson` 2 KB,
`umweltzone.geojson` leer, `meta.json` mit `absent: ['schedule', 'fee',
'umweltzone', 'segments']`. Ortsteile der Zonen: A, C, D, E, H, K in
„Zentrum Süd", B und C/G in „Zentrum Nord", G und L in „Ostviertel,
Leumnitz und Südhang".

## Der Rahmen, der Mittelpunkt

`reportBounds` aus der Stadtgrenze (11,9981–12,1695 / 50,7985–50,9766, nach
außen auf zwei Stellen gerundet: 11,99–12,17 / 50,79–50,98); die 27
Ortsteile füllen exakt denselben Rahmen. Bad Köstritz (12,0159 / 50,9291)
liegt in diesem Rechteck, ist aber keine Geraer Gemeinde — ein
achsenparalleler Rahmen kann das nicht ausschliessen; eine Meldung von dort
wird angenommen und liegt in keiner Zone. Jena, Zeitz und Greiz liegen
draußen. Die zehn Zonen liegen in einem Rechteck von 1,7 × 1,8 km
(12,0732–12,0969 / 50,8692–50,8855); Mittelpunkt ist dessen Mitte, Zoom 13
wie in Kassel und Essen. `heatGrid` mit Ursprung an der Südwestecke des
Rahmens und Breite 50,88.

## Feiertage: Thüringen

`TH` ist neu in `holidays.ts`: die neun bundesweiten Tage plus
**Weltkindertag** (20. September, seit 2019 — nur Thüringen hat ihn) und
**Reformationstag** (31. Oktober) — § 2 Abs. 1 ThürFtG; elf Tage, gegen
Brandenburg gemessen (genau ein Tag Unterschied). **Fronleichnam** steht in
§ 2 Abs. 2 und gilt nur in Gemeinden mit überwiegend katholischer
Bevölkerung, die die Landesregierung durch Rechtsverordnung bestimmt — das
Eichsfeld und Teile des Unstrut-Hainich- und Wartburgkreises, **nicht Gera**.
Wie Mariä Himmelfahrt in Bayern gehört er deshalb an `City.holidays` einer
Stadt, die ihn hat, nicht in die Landestabelle; `GERA.holidays` bleibt leer.
Der **Wortlaut** war aus dieser Umgebung nicht abrufbar:
`landesrecht.thueringen.de` (juris) liefert nur die Hülle seiner
React-Anwendung, die Dokumentadresse bricht die Verbindung ab, die
Feiertagsseite des Innenministeriums ist ebenso eine Hülle, Wikisource und
Kirchenrecht-Portale kennen das Gesetz nicht. Der Eintrag ist wie bei MV aus
dem Gedächtnis belegt; `holidays.test.ts` hält elf Tage fest — offener
Punkt 3.

## Was eingetragen ist

Anders als bei Köln und Karlsruhe sind die Einträge in den gemeinsamen Dateien
gemacht, nicht nur vorbereitet:

| Datei | Eintrag |
| --- | --- |
| `app/packages/core/src/city.ts` | `GERA` und Eintrag in `CITIES` |
| `app/packages/core/src/holidays.ts` | `'TH'` in `Land`, `REGIONAL.TH` mit Beleg |
| `app/packages/core/src/index.ts` | `export * from './gera.js'` |
| `app/packages/ingest/src/sources.ts` | `GERA_SOURCES` (drei WFS-Ebenen), `BY_CITY.gera` |
| `app/packages/ingest/package.json` | `build-data-gera` |
| `app/packages/core/test/city.test.ts` | `GERA` in den Importen, `gera` in `OHNE_BELEG`, Block „Gera" |
| `app/packages/core/test/holidays.test.ts` | Block „Thüringen" |
| `app/packages/core/test/fuzz.test.ts` | drei Parser im Beschuss und im Zeitbudget |
| `app/packages/core/test/fixture-shape.test.ts` | Block „Geraer Fixtures" |
| `app/packages/ingest/test/quellen.test.ts` | `gera` in der Liste „keine Stadt ohne Quelle" |
| `app/apps/web/statistik/main.ts` | `gera: 'Gera'` |
| `NOTICE`, `README.md`, `docs/staedte.md`, `docs/data-sources.md`, `docs/todo.md`, `CLAUDE.md` | je eine Zeile bzw. ein Abschnitt |
| erzeugt | `zone-keys.generated.ts`, `zone-units.generated.ts`, `zone-units.generated.json` |

Nicht angefasst, wie vereinbart: `index.html`, `manifest.webmanifest`,
`login-page.ts`; `deploy.yml`, `kacheln.yml` und die Tests
`flaechenpunkt`/`quellen`/`zone-units` lesen `CITIES`.

## Was offen bleibt

1. **Die Parkgebührenordnung lesen.** Das PDF vom 12. Dezember 2022 liegt
   vor; mit `pdftotext` sind Zeiten, Beträge und die Zuordnung zu den Zonen
   in fünf Minuten herausgeschrieben. Erst dann lässt sich entscheiden, ob
   Gera von Klasse C zu einem Tarif aus der Satzung (wie Wien) aufsteigt —
   voraussichtlich sind die Gebührenzonen dort *nicht* die
   Bewohnerparkzonen A bis L, dann bleibt es bei `scheduleUnknown`.
2. **Die Lizenz klären.** Anfrage an das Zentrale GIS der Stadtverwaltung
   Gera (Kontakt in `GetCapabilities`, Telefon 0365 838-1224): unter welcher
   Lizenz die Ebene `geom_portal_anwohnerparken` weitergegeben werden darf.
   Bis dahin `licenceFamily: 'unklar'` und der Banner. Fällt die Antwort
   DL-DE/BY aus, wird `licenceOpen` gestrichen und die Familie gesetzt —
   sonst nichts.
3. **Den Wortlaut des ThürFtG lesen** (§ 2 Abs. 1 und 2 und das
   Änderungsgesetz zum Weltkindertag) und gegen die elf Tage in
   `holidays.test.ts` prüfen — mit einem Browser eine Minute.
4. **Keine Auskunftsstelle für abgeschleppte Fahrzeuge.** Weder die Seite
   des Vollzugsdienstes noch die des Straßenverkehrs auf `gera.de` nennt am
   17. September eine Stelle mit Namen und Nummer; `towedVehicles` fehlt,
   `gera` steht in `OHNE_BELEG`.
5. **Die Kachelkarte.** `kacheln.yml` liest `CITIES`; das PMTiles-Archiv für
   Gera entsteht beim nächsten Lauf.
6. **Die Straßenliste im `note`** ist die einzige Stelle, an der die 138
   Linien sichtbar sind. Ob die App sie je Zone als eigene Ebene zeichnen
   soll (wie Berlins Abschnitte), ist eine Entscheidung für später;
   `segments` steht in `absent`.

## Prüfstand

Am 17. September 2026 im Worktree grün: `pnpm -r typecheck`, `pnpm test`
(core mit `gera.test.ts`, `holidays.test.ts` „Thüringen", `fuzz.test.ts`,
`fixture-shape.test.ts`, `city.test.ts`; ingest `quellen.test.ts`),
`./scripts/sprache-pruefen.sh`, `node scripts/doku-pruefen.mjs`,
`./scripts/namen-pruefen.sh`, `./scripts/commit-pruefen.sh`. Einmal fiel im
vollen Lauf das Zeitbudget in `fuzz.test.ts` für `parseZuerichMeterTariff`
(313 ms statt 300, unter Last der vier parallelen Pakete) — nicht Gera, im
Einzellauf dreimal grün.

## Dateien

| Datei | Inhalt |
| --- | --- |
| `app/packages/core/src/gera.ts` | `GeraParseError`, `parseGeraZoneKey`, `parseGeraInfostring`, `geraZoneName`, `parseGeraAccessible`, Rohtypen |
| `app/packages/core/test/gera.test.ts` | Parser gegen jeden Wert der Fixture, Unfug, die Flächen-Linien-Messung, eine Zone im Tarifmodell |
| `app/packages/core/test/fixtures/gera-anwohnerparken-2026-09-17.json` | die zehn Flächen und sechs Linien, wörtlich |
| `app/packages/core/test/fixtures/gera-behindertenparkplaetze-2026-09-17.json` | alle zwölf Punkte |
| `app/packages/ingest/src/build-data-gera.ts` | Datenbau mit `assertDegrees`, `assertInGera`, der 12-m-Wache und der Straßenliste |
| `app/apps/web/public/data/gera/` | `zones.geojson`, `districts.geojson`, `poi.geojson`, `umweltzone.geojson` (leer), `meta.json` |
