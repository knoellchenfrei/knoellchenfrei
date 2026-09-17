# St. Gallen als Stadt der Klasse C — gemessen, entschieden, offen

> **Wo der Code liegt.** Feldparser in `app/packages/core/src/stgallen.ts`,
> Datenbau in `app/packages/ingest/src/build-data-stgallen.ts`, Quellen in
> `sources.ts` als `STGALLEN_FILES`, Stadt als `STGALLEN` in `core/city.ts`,
> Kanton als `CH-SG` in `core/holidays.ts`. Tests in
> `core/test/stgallen.test.ts` (31) und in `laender.test.ts`,
> `fixture-shape.test.ts`, `fuzz.test.ts`, `city.test.ts`,
> `ingest/test/quellen.test.ts`, `ingest/test/zone-units.test.ts`. Die Daten
> liegen eingecheckt unter `app/apps/web/public/data/stgallen/`.

> **Stand 17. September 2026.** St. Gallen ist angeschlossen — die vierte
> Stadt in der Schweiz und die erste, deren Quelle **keine Zonen kennt,
> sondern Parkfelder**: 3.232 Reihen mit einer Markierungsart, ohne Zeiten,
> ohne Beträge, ohne den Sektor der Erweiterten Blauen Zone. Zwei
> Markierungsarten werden Zonen (`EBZ`, `Parkuhr`), jede Reihe bleibt ein
> Stück davon, die App sagt „Zeiten unbekannt" und färbt grau. Was fehlt,
> steht unter „Was offen bleibt": die EBZ-Sektoren, die es nur im Stadtplan
> gibt, und die Zeiten, die nur auf der Stadtseite stehen.

Alle Zahlen hier sind an diesem Tag gegen das Portal selbst gemessen, nicht
aus [staedte-recherche-2026-09-16.md](staedte-recherche-2026-09-16.md)
übernommen. Wo die Messung von der Recherche abweicht, steht es dabei.

## Die Quellen

| | Parkplätze und Parkflächen | Wohnviertel (statistische Quartiere) |
| --- | --- | --- |
| Art | Opendatasoft-Portal, **GeoJSON-Export** `…/exports/geojson?limit=-1` | ebenso |
| Adresse | `https://daten.stadt.sg.ch/api/explore/v2.1/catalog/datasets/ppv-parkflaeche/exports/geojson` | `…/datasets/wohnviertel/exports/geojson` |
| Datensatz | `ppv-parkflaeche` — „Parkplätze und Parkflächen der Stadt St.Gallen", „Der Datensatz zeigt die öffentlichen Parkflächen in der Stadt St.Gallen." | `wohnviertel` — „Wohnviertel der Stadt St.Gallen (Statistische Quartiere)" |
| Umfang | **3.232** Polygone, 1.536.709 Bytes | **31** Polygone, 322.451 Bytes |
| Inhalt | `markierungsart` (12 Werte), `zutrittsart` (nur `öffentlich`), `anzahl_pp` (int, 3× `null`), `geo_point_2d` | `nummer` (101–308), `kreis` (Westen 13, Centrum 10, Osten 8), `quartiergr` (14), `statistisc` (Quartiername) |
| Herausgeber | `publisher`: „Rauminformationszentrum (RIZ) Stadt St.Gallen", `creator`: „Rauminformationszentrum (RIZ), Stadt St.Gallen", Kontakt `opendata@stadt.sg.ch` | dieselbe Stelle |
| Lizenz | `license: "CC BY"`, `license_url: https://creativecommons.org/licenses/by/4.0/` — wörtlich unten | dieselbe, `license_url …/by/4.0/deed.de` |
| Aktualität | `data_processed` und `modified` **2023-07-05**, `metadata_processed` 2026-02-23; keine `accrualperiodicity` | `modified` 2025-12-13 |

Die Antwort ist WGS84 in `[lon, lat]`, erster Stützpunkt `[9.302686616,
47.4042848673]`; die Sachfelder tragen zusätzlich `geo_point_2d` als Objekt
`{lon, lat}` — den Schwerpunkt, kein GeoJSON, und `fixture-shape.test.ts`
hält den Typ `object` fest. `assertDegrees` im Datenbau misst trotzdem nach.
Der Export liefert ohne `limit` alle Zeilen (3.232 von 3.232 nachgemessen);
`limit=-1` steht in `sources.ts`, weil Opendatasoft es als „alles"
definiert und ein künftiger Vorgabewert sonst still kürzen könnte.

**Was die Recherche sagte und was stimmt.** 3.232 Polygone, `markierungsart`
mit 1.871 und 781, „CC BY", „modified 2023-07-05": stimmt alles. Neu: die
zwölf Werte im Einzelnen, die drei `null`-Platzzahlen, die 31 Quartiere als
Bezirksebene, und dass die **EBZ-Sektoren** — die Stadt führt 17 (1–10, 12,
15–20), je Sektor eine Broschüre vom 29. Oktober 2024 — in keinem Datensatz
des Portals stehen (151 Datensätze durchsucht, Suche nach `ebz`, `sektor`,
`blaue`, `parkkarte`, `bewilligung`: nichts). Sie existieren nur als Ebene
`ebz` im Stadtplan `map.stadt.sg.ch/stadtplan/ext/?…&layers=ebz` — eine
tydac-MapPlus-Anwendung mit OpenLayers 2.13, deren Dienst dahinter sich aus
dieser Umgebung nicht finden liess (`/arcgis/rest`, `/server/rest`, `/wms`,
`/geoserver`, `/mapserv`: 404; `geoportal.stadt.sg.ch` und
`gis.stadt.sg.ch`: 502 am Proxy).

## Die Lizenz, wörtlich

Der Datensatz selbst nennt `license: "CC BY"`,
`license_url: "https://creativecommons.org/licenses/by/4.0/"` und in den
DCAT-AP-CH-Feldern `rights:
"NonCommercialAllowed-CommercialAllowed-ReferenceRequired"`, `license:
"terms_by"` — die opendata.swiss-Stufe „Freie Nutzung. Quellenangabe ist
Pflicht" (der Datensatz trägt das Schlagwort `opendata.swiss`; das Portal
selbst antwortet aus dieser Umgebung mit 403).

Die Nutzungsbedingungen des Portals
(<https://daten.stadt.sg.ch/terms/terms-and-conditions/>, gelesen am
17. September 2026) sagen dasselbe, wörtlich: „Die Nutzung ist nur
entsprechend den angegebenen Nutzungsbedingungen der einzelnen Datensätze
erlaubt (siehe Reiter «Informationen» bei einem Datensatz). Für die meisten
Daten gilt die «Freie Nutzung mit Quellenangabe». Das heisst, die Daten
dürfen sowohl für nicht kommerzielle als auch kommerzielle Zwecke genutzt
werden, sofern die Quelle angegeben wird." Und unter Haftungsausschluss:
„Wir übernehmen keine Haftung für Richtigkeit, Aktualität und Vollständigkeit
der Informationen auf dieser Website. Die aufgeführten Daten stellen
insbesondere keine rechtsverbindliche Auskunft des Kantons St.Gallen bzw. der
St.Galler Gemeinden dar." Dazu eine Auflage, die CC BY nicht kennt: Es darf
nicht „der Eindruck vermittelt … werden, dass eine Anwendung oder ein Dienst
Dritter die Bewilligung, Zugehörigkeit oder Unterstützung des Kantons
St.Gallen oder der Stadt St.Gallen hat."

Die App führt die Familie `cc-by`, nennt als Quelle „Stadt St.Gallen,
Rauminformationszentrum (RIZ) — Open Data Stadt St.Gallen
(daten.stadt.sg.ch)" — `publisher` und `creator` des Metadatensatzes, ein
vorgeschriebener Wortlaut fehlt — und den Zeitstand (`meta.geprueftAm`).
Beide Ebenen tragen dieselbe Lizenz.

## Die Eigenheit, die alles bestimmt: Parkfelder, keine Zonen

Bern und Genf liefern Zonengrenzen ohne Zeiten. St. Gallen liefert **nicht
einmal Zonen**: Jedes der 3.232 Polygone ist eine Reihe von Parkplätzen —
im Median 27 m² gross, 34 m Umfang, **1,6 m breit** (Fläche und Umfang aus
dem Abzug, Rechteck angenommen), 5 Stützpunkte, 1 bis 80 Plätze. Das einzige
Feld, das etwas über das Regime sagt, ist `markierungsart`:

| `markierungsart` | Reihen | Plätze | Median m² | wird |
| --- | --- | --- | --- | --- |
| `Erweiterte Blaue Zone` | **1.871** | 6.263 | 27 | Zone `EBZ` |
| `Weiss (bewirtschaftet)` | **781** | 2.959 | 20 | Zone `Parkuhr` |
| `Kundenparkplatz` | 205 | 2.263 | 57 | nichts — gehört Läden |
| `Invalidenparkplatz` | 114 | 242 | 17 | POI `accessible` |
| `Güterumschlag` | 85 | 171 | 20 | nichts |
| `Unterirdisch, Garage` | 56 | 7.064 | 660 | nichts — unter der Erde |
| `Weisse Zone (nicht bewirtschaftet)` | 33 | 97 | 20 | nichts — frei |
| `unbekannt` | 26 | 80 | 10 | nichts |
| `Ohne Markierung` | 21 | 28 | 10 | nichts |
| `Taxistandplatz` | 17 | 60 | 33 | nichts |
| `Hotelhalt` | 13 | 53 | 24 | nichts |
| `Carparkplatz` | 10 | 22 | 74 | nichts (Tarif nur auf der Stadtseite) |

`zutrittsart` ist in allen 3.232 Zeilen `öffentlich`; `parseStGallenAccess`
wirft bei jedem anderen Wert, weil eine nicht öffentliche Fläche nicht
stillschweigend auf die Karte gehört. `anzahl_pp` ist dreimal `null`
(Kundenparkplatz, unbekannt, EBZ) und zweimal `0` (EBZ, Garage); beides
heisst „nicht angegeben", `spaces: null`.

**Was daraus eine Zone wird — die Entscheidung.** Die Stadt kennt im
Strassenraum genau zwei bewirtschaftete Regime: die Erweiterte Blaue Zone
(Parkscheibe tagsüber, Bewilligung für Anwohner) und die weiss markierten
Parkfelder mit Parkuhr. Beide gelten stadtweit gleich; die 17 EBZ-Sektoren
sind Bewilligungsgebiete, keine Regime, und stehen in keinem Datensatz.
Deshalb **zwei Zonenschlüssel**, `EBZ` und `Parkuhr` — die Wörter der Stadt
selbst —, und jede Reihe bleibt ein eigenes Stück davon (2.652 Features in
`zones.geojson`), wie Hamburgs Stücke und Karlsruhes Reihen: Klick und
Ortung treffen die richtige Reihe, `zoneSnapMetres: 20` fängt eine Ortung
neben der 1,6-m-Reihe, und die Oberfläche nennt den Abstand. Zwei Wege
wurden verworfen:

1. **Ein Schlüssel je Quartier** („EBZ Rotmonten", 27 × 2 Schlüssel). Das
   wäre eine Zone, die es laut Stadt nicht gibt — die Statistik zählte
   Gebiete, die niemand auf einem Schild liest.
2. **Vereinigung je Regime zu zwei MultiPolygonen.** Kleiner, aber Klick
   und `setFeatureState` färbten alle 1.871 Reihen als eine; genau der
   Hamburger Fehler vom 9. September.

Die Kosten: `zones.geojson` hat 1,7 MB (2.652 Reihen mit je einem vollen
Eigenschaftenblock; Wien hat 1,1 MB). Die Geometrie ist auf **sechs**
Stellen gerundet, Toleranz 1e-7 — bei 1,6 m Breite macht die fünfte Stelle
(1,1 m) aus einem Viereck einen Strich, und `simplifyGeometry` liesse die
Reihe fallen. Gepackt sind die Eigenschaften fast frei, die Datei geht als
`gzip` über die Kante.

Und dieselbe Frage noch einmal für die **Langzeitmuster**: Die Einheit je
Schlüssel ist genau eine, und die Summe der 1.871 Reihen (6,8 ha) hätte
`EBZ` zum „Gebiet" gemacht — dessen Geometrie die 8-m-Vereinfachung auf
**29 Punkte** zusammenschob: eine Einheit, in der nie eine Meldung gelegen
hätte, leise. `zone-units.ts` kennt seitdem `isRows` (kein Stück ≥ 2 ha, der
Median unter 500 m²): Solche Schlüssel bleiben Reihen mit Fangradius, unter
dem Zonenschlüssel statt dem Bezirk, weil sie über 27 Quartiere verteilt
sind — und als Raster von Kästchen (0,002°, rund 150 × 220 m) statt 13.482
Stützpunkten, weil das Worker-Bündel sonst 1,26 MB hätte statt unter 1 MB.
Für alle anderen Städte ändert sich nichts; nachgemessen am erzeugten JSON.

## Die Zeitangabe und der Betrag

Nirgends im Datensatz. Deshalb Klasse C und das Modell vom 16. September:
jede Zone mit `scheduleUnknown: true`, `windows: []`, `fee: { kind: 'unknown'
}`, `rawHours: ''`, `rawFee: ''`; `meta.absent` führt `schedule` und `fee`.
Die App sagt „Zeiten unbekannt" statt „frei" oder „kostet";
`stgallen.test.ts` hält fest, dass es an Allerheiligen dabei bleibt.

**Was nicht getan wurde, mit Absicht:** die Zeiten der Stadtseite in die
Daten schreiben. Was die Stadt sagt, zitiert, damit es niemand raten muss
(<https://www.stadt.sg.ch/home/mobilitaet-verkehr/parkieren/parkzonen.html>,
17. September 2026):

> Kennzeichnung: Blaue Bodenmarkierung und Signal «Parkieren mit
> Parkscheibe» mit dem Zusatz des Sektors und der Beschränkung Montag bis
> Samstag, mit Bewilligung uneingeschränkt, bewilligungspflichtiges
> Nachtparkieren. Bewilligungspflichtige Zeiten: In der Erweiterten Blauen
> Zone besteht grundsätzlich eine Bewilligungspflicht. Es wird unterschieden
> zwischen dem Tag und der Nacht. Tag: 8 Uhr bis 19 Uhr. Nacht: 19 Uhr bis
> 8 Uhr. Ausnahmen: Von der Bewilligungspflicht ausgenommen ist der Sonn-
> und Feiertag in der Zeit von 8 – 19 Uhr. Während dieser Zeit kann gratis
> in der EBZ parkiert werden. Einmal pro Kalenderwoche kann über Nacht
> (19 Uhr bis morgens 8 Uhr) ohne Bewilligung parkiert werden. Ab dem
> zweiten Mal ist eine Bewilligung erforderlich. Parkscheibe: Mit der
> Parkscheibe kann in der EBZ tagsüber zeitlich beschränkt (mindestens eine
> Stunde) parkiert werden.

Anwohnerbewilligung CHF 30.00 pro Monat (nur Tag) bzw. 40.00 (Tag und
Nacht), Nachtparkbewilligung CHF 30.00, Pendlerbewilligung CHF 150.00 bzw.
160.00 (ohne Sektor 20). Die Seite „Parkplätze mit Parkuhren" nennt **keinen
Tarif** — nur Bezahlwege (ParkingPay, EasyPark, Twint). Der einzige Betrag
im Strassenraum steht auf der Parkieren-Übersicht: Carparkplätze
Spelteriniplatz und Museumstrasse seit dem 1. November 2024 CHF 5.00 pro
Stunde tagsüber, CHF 3.00 nachts (ab Mitternacht bis 7 Uhr) und sonntags.

Ein Fenster „Mo–Sa 8–19" für die EBZ wäre eine Aussage über die Stadtseite,
nicht über die Daten, und die „mindestens eine Stunde" der Parkscheibe ist
je Reihe anders signalisiert. Ob es als Stadtregel in die Daten soll, ist
eine Entscheidung des Betreibers (todo.md, Abschnitt 5) — dieselbe wie bei
Bern.

## Die Höchstparkdauer

Nirgends. Die Parkscheibe gilt laut Stadt „zeitlich beschränkt (mindestens
eine Stunde)", die Dauer steht am Signal je Reihe. `maxStayMinutes: null`,
`maxStayValues: []`.

## Die Quartiere und der Rahmen

31 statistische Quartiere in 14 Quartiergruppen und 3 Stadtkreisen; die
Nummer trägt den Kreis in der ersten Ziffer (1 Westen, 2 Centrum, 3 Osten —
`stgallen.test.ts` prüft das für alle 31). `districts.geojson` führt den
Quartiernamen als `name` und „Quartiergruppe, Kreis X" als `bezirk`. Alle
2.652 Reihen mit Regime treffen ein Quartier (0 ohne Treffer); die meisten
liegen in St.Jakob (277), Langgass-Heiligkreuz (266) und St.Fiden-Krontal
(263).

Der Rahmen kommt aus dem Umriss der 31 Quartiere: 9,291516–9,435247 /
47,395155–47,453073. swisstopos `swissBOUNDARIES3D` nennt für die politische
Gemeinde St. Gallen (BFS-Nr. 3203, Stand 2026, 39,38 km²) auf sechs Stellen
**dieselben** vier Zahlen — die Quartiere decken die ganze Gemeinde. Nach
aussen gerundet: 9,29–9,44 / 47,39–47,46. Die Parkebene wäre die falsche
Quelle: Sie reicht nur von 9,294 bis 9,427. Gossau (9,248), Herisau (47,386),
Wittenbach (47,461) und Rorschach (9,495) liegen draussen; `city.test.ts`
hält es fest.

## Feiertage: Kanton St. Gallen

Das Kürzel `CH-SG` ist neu in `holidays.ts`, mit Beleg. Die Liste steht im
**Gesetz über Ruhetag und Ladenöffnung (RLG, sGS 552.1)** vom 29. Juni 2004,
in Vollzug seit dem 1. Juli 2004, aktuelle Fassung seit dem 22. Januar 2008
(Version 228), gelesen am 17. September 2026 über die Schnittstelle des
Portals (`gesetzessammlung.sg.ch/api/de/texts_of_law/552.1`; die
Weboberfläche liefert nur eine JavaScript-Hülle), kanonisch
<https://www.gesetzessammlung.sg.ch/app/de/texts_of_law/552.1>. Art. 2
Abs. 1, wörtlich:

> Die öffentlichen Ruhetage sind: a) der Sonntag; b) die Feiertage Neujahr,
> Karfreitag, Ostermontag, Auffahrt, Pfingstmontag, Bundesfeiertag,
> Allerheiligen, Weihnachtstag und Stefanstag.

Art. 3: „Die hohen Feiertage sind Karfreitag, Ostersonntag, Pfingstsonntag,
Eidgenössischer Bettag und Weihnachtstag." — eine Stufe innerhalb der
Ruhetage, kein zusätzlicher Tag; der Bettag ist ein Sonntag. Der
Bundesfeiertag liegt in `NATIONWIDE.CH`, bleiben **acht** kantonale Tage:
Neujahr, Karfreitag, Ostermontag, Auffahrt, Pfingstmontag, Allerheiligen,
Weihnachtstag, Stefanstag — mit dem 1. August neun. **Kein Berchtoldstag,
kein 1. Mai** — beide stehen nicht im Gesetz, geprüft, nicht vermutet —,
dafür **Allerheiligen**, das weder Bern noch Zürich hat. `laender.test.ts`
misst den Unterschied zu beiden: je genau zwei Tage. Die Abkürzung RLG
tragen zwei verschiedene Erlasse (Zürich LS 822.4, St. Gallen sGS 552.1);
der Kommentar in `holidays.ts` sagt es. Für St. Gallen ändert das heute
nichts — eine Zone mit `scheduleUnknown` bleibt an jedem Tag „unbekannt" —,
aber die Tabelle gilt für den Tag, an dem die EBZ Zeiten bekommt: Die
Stadtseite nimmt „Sonn- und Feiertag" von der Bewilligungspflicht aus.

## Der Probelauf

```
CITY=stgallen pnpm --filter @knoellchenfrei/ingest fetch-data
  Stadt: stgallen — 0 Quellen nach …/.raw/stgallen
  zones (Datei) … 1536709 Bytes, 3232 Features
  districts (Datei) … 322451 Bytes, 31 Features

CITY=stgallen pnpm --filter @knoellchenfrei/ingest build-data-stgallen
  St. Gallen — Daten bauen …
    districts.geojson: 35 KB
    zones.geojson: 1671 KB
    poi.geojson: 18 KB
    umweltzone.geojson: 0 KB
    meta.json: 1 KB

  2652 von 3232 Parkfeldern als Zonenstücke übernommen (1871 EBZ mit 6263
  Plätzen, 781 Parkuhr mit 2959 Plätzen; 2 ohne Platzzahl, 0 ohne
  Quartier-Treffer, 0 zu klein), 114 Behindertenparkplätze, 31 Quartiere
  Markierungsarten: ebz ×1871, parkuhr ×781, kunden ×205, invaliden ×114,
  gueterumschlag ×85, garage ×56, weissFrei ×33, unbekannt ×26,
  ohneMarkierung ×21, taxi ×17, hotel ×13, car ×10
```

`meta.absent` ist `["schedule", "fee", "umweltzone", "segments"]`,
`managedSpaces` 9.222. `zone-keys.generated.ts` führt zwei St. Galler
Kennungen, `zone-units` zwei Einheiten der Art `reihen` (EBZ 360 Kästchen,
Parkuhr 140).

## Was eingetragen ist

Alles ist eingetragen; die Liste, damit der Merge weiss, wo:

| Datei | Eintrag |
| --- | --- |
| `core/src/holidays.ts` | `'CH-SG'` in der `Land`-Union, Zeile in `REGIONAL`, Beleg im Kommentar |
| `core/src/city.ts` | `STGALLEN`, in `CITIES` als letzte |
| `core/src/index.ts` | `export * from './stgallen.js'` |
| `ingest/src/sources.ts` | `STGALLEN_FILES`, `FILES_BY_CITY`, `stgallen: []` in `BY_CITY` |
| `ingest/src/zone-units.ts` | `isRows`, `ROW_MAX_AREA_M2`, `rasterised` — die Reihen-Einheit unter dem Zonenschlüssel |
| `ingest/package.json` | `build-data-stgallen` |
| `core/test/laender.test.ts` | `describe('der St. Galler Kalender')`, vier Tests |
| `core/test/city.test.ts` | `OHNE_BELEG` um `stgallen`, Gossau / Herisau / Marktplatz |
| `core/test/fuzz.test.ts` | `describe('St. Galler Feldparser unter Beschuss')`, Zeitbudget um zwei Parser |
| `core/test/fixture-shape.test.ts` | „St. Galler Fixtures", zwei Ebenen |
| `ingest/test/quellen.test.ts` | `stgallen` in der Liste „keine Stadt ohne Quelle", `describe('cityFiles für St. Gallen')` |
| `ingest/test/zone-units.test.ts` | die Reihen-Einheit, `ROW_MAX_AREA_M2` |
| `apps/web/statistik/main.ts` | `STADTNAMEN.stgallen` |
| `NOTICE`, `README.md`, `docs/staedte.md`, `docs/data-sources.md`, `docs/todo.md`, `CLAUDE.md` | Zeile bzw. Abschnitt |
| erzeugt | `zone-keys.generated.ts`, `zone-units.generated.ts`, `apps/api/src/zone-units.generated.json` |

Nichts einzutragen, weil aus `CITIES` erzeugt: `deploy.yml`, `kacheln.yml`,
`flaechenpunkt.test.ts`, `zone-units.test.ts` (die Stadtliste). Nicht
angefasst, wie verabredet: `index.html`, `manifest.webmanifest`,
`login-page.ts`.

## Was offen bleibt

1. **Die EBZ-Sektoren.** 17 Bewilligungssektoren mit je einer Broschüre,
   sichtbar nur im Stadtplan (`layers=ebz`), in keinem Datensatz des
   Portals. Der Weg: die OGD-Koordinationsstelle fragen
   (`opendata@stadt.sg.ch`), ob die Ebene ins Portal kommt — oder den
   Dienst hinter dem Stadtplan mit einem Browser finden (Netzwerk-Reiter,
   die MapPlus-Anwendung lädt ihre Ebenen über einen eigenen Pfad). Mit den
   Sektoren als Polygone würde aus `EBZ` eine Zone je Sektor, wie Berns
   Parkkartenzonen, und die Reihen könnten bleiben oder als
   Stellplatzreihen darunterliegen.
2. **Zeiten und Tarif als Stadtregel — eine Entscheidung, keine Messung.**
   Die Bewilligungspflicht Mo–Sa 8–19 Uhr steht auf der Stadtseite, ein
   Parkuhrtarif nirgends. Wenn der Betreiber es will: ein Feld
   `City.defaultWindows` mit Fundstelle, als „laut Stadtseite, nicht laut
   Daten" ausgewiesen — dieselbe Frage wie bei Bern (todo.md, Abschnitt 5).
   Der Parkuhrtarif bräuchte das Gebührenreglement der Stadt
   (`stadt.sg.ch`, Rechtssammlung), das hier nicht gesucht wurde.
3. **Der Datenstand ist 2023-07-05.** Der Datensatz trägt keine
   Aktualisierungsfrequenz; `metadata_processed` 2026-02-23 sagt nur, dass
   die Metadaten angefasst wurden. Ob die Reihen noch stimmen, kann das RIZ
   sagen; die App nennt den Abrufzeitpunkt, nicht den Stand der Quelle.
4. **1,7 MB `zones.geojson`.** 2.652 Reihen mit je einem vollen
   Eigenschaftenblock. Gepackt klein, aber die grösste Zonendatei im
   Projekt. Wenn das stört: ein kompakteres Zonenschema für Klasse-C-Reihen
   (die leeren Felder weglassen) — eine Änderung an `loadZones`, nicht an
   St. Gallen.
5. **Ladestationen als POI.** `ladestationen-fur-elektroautos-im-kanton-stgallen`
   (258 Punkte, Bundesamt für Energie über ich-tanke-strom.ch, CC BY) wäre
   die `charging`-Ebene — ein zweiter Herausgeber, eine zweite Lizenzzeile.
   Nicht gemacht, damit St. Gallen nicht mehr Auflagen trägt als nötig.
6. **Kein `towedVehicles`.** Die Seiten der Stadtpolizei (Schalter
   Verkehrsbewilligungen, `+41 71 224 61 00`) nennen keine Auskunftsstelle
   für abgeschleppte Fahrzeuge; `OHNE_BELEG` in `city.test.ts`.
7. **`opendata.swiss`** antwortet aus dieser Umgebung mit 403. Der Eintrag
   der Stadt dort wäre eine zweite Fundstelle für die Lizenz; gebraucht wird
   er nicht, die DCAT-AP-CH-Felder des Portals sind die erste Hand.

## Prüfstand

Am 17. September 2026 in diesem Worktree grün:

```
cd app && pnpm -r typecheck          # alle vier Pakete
cd app && pnpm test                  # core 1651, ingest 126, api 101, web 325
./scripts/sprache-pruefen.sh
node scripts/doku-pruefen.mjs
./scripts/namen-pruefen.sh
./scripts/commit-pruefen.sh
```

Nicht gelaufen, absichtlich: die E2E-Suite (läuft zentral) und der Kachelbau.

## Dateien

| Datei | Inhalt |
| --- | --- |
| `app/packages/core/src/stgallen.ts` | `parseStGallenMarking`, `stGallenZoneKey`, `parseStGallenAccess`, `parseStGallenSpaces`, `stGallenZoneNote`, `stGallenQuarter`, `StGallenParseError`, `StGallenAreaProperties`, `StGallenQuarterProperties` |
| `app/packages/core/test/stgallen.test.ts` | 31 Tests: jede Art des Abzugs, Unfug, die Reihe im Tarifmodell, Stadtgrenzen, Lizenz |
| `app/packages/core/test/fixtures/sg-parkflaechen-2026-09-17.json` | Zählung über alle 3.232 Reihen, 17 Zeilen wörtlich (je Art die erste, jede ohne Platzzahl) |
| `app/packages/core/test/fixtures/sg-wohnviertel-2026-09-17.json` | alle 31 Quartiere, wörtlich, ohne Geometrie |
| `app/packages/ingest/src/build-data-stgallen.ts` | der Datenbau |
| `app/apps/web/public/data/stgallen/` | `zones.geojson` (2.652), `districts.geojson` (31), `poi.geojson` (114), leere `umweltzone.geojson`, `meta.json` |
