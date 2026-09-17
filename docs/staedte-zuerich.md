# Zürich als elfte Stadt — gemessen, entschieden, offen

> **Wo der Code liegt.** `app/packages/core/src/zuerich.ts` (Parser und der
> Erlass als Konstante), `app/packages/ingest/src/build-data-zuerich.ts`
> (Datenbau), `app/apps/web/public/data/zuerich/` (der Abzug), Tests in
> `core/test/zuerich.test.ts` und in den gemeinsamen Testdateien.

> **Stand 17. September 2026.** Zürich ist angeschlossen: Parser, Datenbau,
> Stadt-Konstante, Feiertagskalender `CH-ZH`, Abzug und Einträge in den
> gemeinsamen Dateien liegen auf dem Zweig. Es ist die erste Stadt ausserhalb
> Deutschlands und Österreichs, die erste in Franken und die erste, deren
> Tarif nicht im Feed, sondern **nur im Erlass** steht. Was offen bleibt,
> steht unten — vor allem 70 Hochtarif-Parkuhren, für die die Stadt keine
> Fläche veröffentlicht.

Alle Zahlen hier sind an diesem Tag gegen die Dienste selbst gemessen, nicht
aus [docs/staedte-recherche-2026-09-16.md](staedte-recherche-2026-09-16.md)
übernommen. Wo die Messung von der Recherche abweicht, steht es dabei — an
zwei Stellen tut sie das, und beide sind Gewinne: Die Recherche kannte nur
den Parkplatz-Datensatz von **2021**; im Katalog liegt daneben der Datensatz
der Dienstabteilung Verkehr, **täglich** nachgeführt, mit einer Tarifzeile je
Parkuhr. Und die Recherche nannte den Hochtarif „≈ 3 Fr./h"; der Erlass nennt
eine Staffel, die nur in der ersten Stunde 3 Franken ergibt.

## Die Quellen

| | Tarifzonen | Parkuhren | Parkfelder | Quartiere |
| --- | --- | --- | --- | --- |
| Art | WFS 1.1.0, QGIS Server | WFS 1.1.0, QGIS Server | dieselbe | WFS 1.1.0, QGIS Server |
| Adresse | `https://www.ogd.stadt-zuerich.ch/wfs/geoportal/Gebietseinteilung_Parkierungsgebuehren` | `…/wfs/geoportal/oeffentlich_zugaengliche_Parkplaetze_DAV` | dieselbe | `…/wfs/geoportal/Statistische_Quartiere` |
| Typname | `tarifzonen` | `oeff_strassenparkierung_spuzpu` | `oeff_strassenparkierung_dav_p` | `adm_statistische_quartiere_v` |
| Umfang | `numberOfFeatures="2"`, Polygone, 3.598 Bytes | `numberOfFeatures="1397"`, Punkte, 1,0 MB | `numberOfFeatures="13272"`, MultiPoints, 7,1 MB | `numberOfFeatures="34"`, Polygone, 0,9 MB |
| Inhalt | `tarifzone` (`Hochtarifzone`), `zone_bezeichnung` (`Innenstadt und Oerlikon`), `bedienungszeiten` — **kein Betrag** | `tarif` (`HOCH 2h Mo-Sa 09:00-20:00`), `typ` (SPU/ZPU), `parkierungzonename` (566 verschiedene), LV95-Koordinaten als Zahl | `art` (11 Werte), `gebpflicht` (`1`/`0`), `parkdauer` (Minuten, 9 Werte und `null`), `kategorie` (OPU/SPU/ZPU) | `qname`, `kname` (`Kreis 1` … `Kreis 12`), `qnr`, `knr` |
| Katalog | `geo_gebietseinteilung_parkierungsgebuehren`, Autor „Kundendienst, Dienstabteilung Verkehr, Sicherheitsdepartement" | `geo_oeffentlich_zugaengliche_parkplaetze_dav`, Autor „Dienstabteilung Verkehr, Sicherheitsdepartement" | derselbe | `geo_statistische_quartiere`, Autor „Statistik Stadt Zürich, Präsidialdepartement" |
| Lizenz | `license_id: cc-zero`, `license_title: Creative Commons CCZero` | dieselbe, dazu der Wortlaut im geocat.ch-Metadatensatz (unten) | dieselbe | dieselbe |
| Aktualität | `dateLastUpdated` 15.03.2024, „sporadisch oder unregelmaessig" | `dateLastUpdated` 17.09.2026, `updateInterval: taeglich`, `stand` an jedem Punkt `2026-09-17` | dieselbe | `dateLastUpdated` 11.09.2026 |

Der Lizenztext, wörtlich aus dem geocat.ch-Metadatensatz
`809a40eb-32a5-4873-aac9-fa9776c0a687` („öffentlich zugängliche Parkplätze
DAV", abgerufen am 17. September 2026 über
`https://www.geocat.ch/geonetwork/srv/api/records/809a40eb-32a5-4873-aac9-fa9776c0a687/formatters/xml`):

> 1. Nutzungsbestimmung
> Diese Geodaten stehen unter der international gültigen
> Creative-Commons-Zero-Lizenz (CC-0). Sie dürfen:
> - vervielfältigt, verbreitet und weiter zugänglich gemacht werden,
> - angereichert und bearbeitet werden,
> - kommerziell genutzt werden.
> Eine Quellenangabe (CC-BY) wird empfohlen: Sie lautet: „Quelle: Stadt Zürich".
> 2. Haftungsausschluss
> Die in der Verwaltung der Stadt Zürich zuständige Stelle gemäss Art. 8
> Abs. 1 GeoIG (SR 510.62) schliesst jede Haftung für direkte und indirekte
> Schäden durch die Nutzung der Geodaten [Nutzung der Geodienste] aus. […]
> 3. Rahmenbedingungen
> - Reglement über offene Verwaltungsdaten, AS 170.410
> - Städtisches Geoinformationsreglement (StGeoIR), AS 704.100

Der Katalog `https://data.stadt-zuerich.ch/api/3/action/package_show?id=geo_gebietseinteilung_parkierungsgebuehren`
bestätigt es für die Tarifzonen: `license_id: cc-zero`, `license_url:
http://www.opendefinition.org/licenses/cc-zero`, `isopen: true`. Deshalb
`licenceFamily: 'cc0'`, `attributionRequired: false`, und der empfohlene
Vermerk steht trotzdem in `City.attribution.source`.

Gefunden wurden alle vier Ebenen über den Katalog
(`package_search?q=park` liefert 79 Treffer, davon tragen drei), nicht durch
Raten. Der Katalogeintrag der Tarifzonen nennt als Rechtsgrundlage wörtlich
„Vorschriften über die Parkierungs- und Parkuhrenkontrollgebühren (551.330)"
und verlinkt die Amtliche Sammlung — von dort kommt der Erlass unten.

Daneben zwei Dokumente, die keine Daten sind, aber die Daten erklären:

- **Vorschriften über die Parkierungs- und Parkuhrkontrollgebühren**
  (AS 551.330), Gemeindebeschluss vom 25. September 1994 mit Änderungen bis
  GRB vom 23. März 2016, in Kraft seit dem 1. April 2017, kein
  Ausserkrafttreten vermerkt. PDF
  `551.330_Parkierungs- und Parkuhrkontrollgebühren17_V3.pdf`, verlinkt von
  <https://www.stadt-zuerich.ch/de/politik-und-verwaltung/politik-und-recht/amtliche-sammlung/5/551/330.html>.
- **Ruhetags- und Ladenöffnungsgesetz** des Kantons Zürich (RLG, LS 822.4),
  Nachtrag 045, in Kraft seit dem 1. Mai 2004 — Beleg für den Feiertagskalender
  `CH-ZH` (unten).

## Die Eigenheit, die alles bestimmt: Der Tarif steht im Erlass, nicht im Feed

Kein Feld irgendeiner Ebene nennt Franken. Die Tarifflächen sagen „Hochtarif",
die Parkuhren sagen `HOCH` oder `NIEDER`; was das kostet, steht allein im
Erlass. Wörtlich, Art. 3 bis 5 (Art. 3 und 4 in der Fassung vom 23. März
2016):

> Art. 1 Das mehr als 30 Minuten dauernde Parkieren auf mit Parkuhren oder
> zentralen Parkuhren versehenen Parkplätzen gilt in den in Art. 2
> umschriebenen Gebieten als gebührenpflichtiger gesteigerter Gemeingebrauch.
> Art. 3 Die Parkuhrkontrollgebühr beträgt Fr. –.50 pro 20 Minuten in den in
> Art. 2 aufgeführten Gebieten.
> Art. 4 Für das mehr als 30 Minuten dauernde Parkieren in den in Art. 2
> aufgeführten Gebieten beträgt die Parkierungsgebühr in den ersten beiden
> Stunden Fr. –.50 für jeweils 10 Minuten, danach Fr. –.50 pro Stunde.
> Art. 5 In den übrigen Gebieten der Stadt Zürich wird eine blosse
> Parkuhrkontrollgebühr von Fr. –.50 für 1 Stunde erhoben.
> Art. 7 Für das Bedienen der Parkuhren sind die bundesrechtlichen
> Bestimmungen massgebend. Das Festlegen der Höchstparkierungsdauer und der
> Betriebszeit der Parkuhren liegt in der Zuständigkeit des
> Polizeidepartements.

Der Hochtarif ist damit eine **Staffel**, kein Stundensatz:

| Minute | Grenzsatz | Betrag bis dahin |
| --- | --- | --- |
| 1–30 | Art. 3 allein: 0,50 Fr. je 20 min = 1,50 Fr./h | 30 min: 0,75 Fr. |
| 31–120 | Art. 3 + Art. 4: 1,50 + 3,00 = 4,50 Fr./h | 1 h: 3,00 Fr., 2 h: 7,50 Fr. |
| ab 121 | Art. 3 + Art. 4 zweiter Halbsatz: 1,50 + 0,50 = 2,00 Fr./h | 3 h: 9,50 Fr. |

Und Art. 7 sagt, warum die **Zeiten** nicht im Erlass stehen: Die Betriebszeit
setzt das Polizeidepartement fest. Sie kommt aus dem Feed — an der Fläche als
`bedienungszeiten`, an jeder Parkuhr in der Tarifzeile.

Art. 2 umschreibt drei Gebiete strassenweise: die Innenstadt (Abs. 1, von der
Breitingerstrasse über Parkring, Sihlquai, Neumühlequai und Rämistrasse bis
zur Kreuzstrasse, „alle inklusive"), das Zentrum von Oerlikon (Abs. 2) und
das Gebiet Zürich-West (Abs. 3, Sihlquai, Escher-Wyss-Platz, Hard-, Gerold-
und Viaduktstrasse). Der Feed führt **zwei** Flächen, beide mit derselben
`zone_bezeichnung` „Innenstadt und Oerlikon". Zürich-West fehlt; die
Ankerpunkte Escher-Wyss-Platz, Hardbrücke und Prime Tower liegen in keiner
der beiden Flächen. Art. 2bis und 4bis regeln das Gebiet „Zoo Zürich" mit
einer eigenen Tabelle für Sonn- und Feiertage; im Feed ist es nur als
Sonderbezeichnung an 102 Parkuhren zu sehen.

## Die Zeitangabe

**An der Fläche** eine Schreibweise, an beiden Flächen gleich:

| `bedienungszeiten` | Anzahl |
| --- | --- |
| `Montag - Samstag, 9:00 - 20:00 Uhr` | 2 |

**An den Parkuhren** 33 Schreibweisen des Felds `tarif`, alle 1.397 gezählt:

| `tarif` | Anzahl | | `tarif` | Anzahl |
| --- | --- | --- | --- | --- |
| `HOCH 2h Mo-Sa 09:00-20:00` | 533 | | `NIEDER 4h Mo-So 08:00-19:00` | 13 |
| `NIEDER 2h Mo-Sa 09:00-20:00` | 287 | | `NIEDER 6h Mo-So 00:00-24:00` | 10 |
| `NIEDER 1h Mo-Sa 09:00-20:00` | 177 | | `HOCH 2h Mo-So 08:00-21:00` | 9 |
| `Zoo ganze Woche` | 66 | | `Kreis 5 Spezial 2h` | 7 |
| `Saisonal Baeder` | 45 | | `NIEDER 8h Mo-Sa 09:00-20:00` | 7 |
| `NIEDER 0.5h Mo-Sa 09:00-20:00` | 39 | | `Hafendamm Enge` | 4 |
| `Adlisbergstrasse (Zoo)` | 36 | | `Theater 11` | 4 |
| `HOCH 0.5h Mo-Sa 09:00-20:00` | 34 | | `NIEDER 2h Mo-So 08:00-19:00` | 3 |
| `HOCH 3h Mo-Sa 09:00-20:00` | 27 | | `NIEDER 48h Mo-So 00:00-24:00`, `NIEDER 4h Mo-So 00:00-24:00`, `NIEDER 6h Mo-So 09:00-20:00`, `HOCH 15h Mo-Sa 09:00-20:00`, `HOCH 0.5h Mo-So 00:00-24:00`, `NIEDER 15h Mo-So 08:00-19:00`, `NIEDER 6h Mo-So 08:00-22:00` | je 2 |
| `NIEDER 3h Mo-Sa 09:00-20:00` | 22 | | `NIEDER 1h Mo-So 00:00-24:00`, `NIEDER 2h Mo-So 08:00-18:00`, `NIEDER 8h Mo-So 08:00-19:00`, `Balgrist spezial`, `NIEDER 15h Mo-So 08:00-22:00` | je 1 |
| `Kreis 5 Spezial 4h` | 19 | | | |
| `NIEDER 15h Mo-Sa 09:00-20:00`, `NIEDER 6h Mo-Sa 09:00-20:00` | je 18 | | | |

25 davon folgen dem Muster `<HOCH|NIEDER> <Dauer>h <Tag>-<Tag> <HH:MM>-<HH:MM>`
(1.215 Parkuhren), acht sind Sonderbezeichnungen ohne lesbare Zeit (182
Parkuhren). `parseZuerichMeterTariff` liest die 25 und gibt die acht
**wörtlich** als `special` zurück — eine neunte, unbekannte Bezeichnung wirft,
weil sie eine neue Regel oder ein neues Muster sein kann. `Mo-So
00:00-24:00` ist der ganze Tag (Minute 0 bis 1440), kein Fehler.

**Die Gegenprobe**, Parkuhren in den Flächen, Punkt-in-Polygon gegen die
unvereinfachte Geometrie:

| Fläche | Parkuhren | einig mit der Fläche | abweichend |
| --- | --- | --- | --- |
| Innenstadt | 495 | 475 (`HOCH … Mo-Sa 09:00-20:00`: 447 × 2 h, 24 × 0,5 h, 4 × 3 h) | 9 × `HOCH 2h Mo-So 08:00-21:00` (Car-Parkplätze Stadthausquai, Bahnhofquai, Pelikanstrasse, St. Annagasse), 10 × `NIEDER` (Nordrand: Unterstrass, Oberstrass, Seebahnstrasse), 1 × `HOCH 0.5h Mo-So 00:00-24:00` (Kasernenstrasse) |
| Oerlikon | 58 | 52 (46 × 2 h, 6 × 0,5 h) | 4 × `Theater 11`, 2 × `NIEDER` (Schaffhauserstrasse, Wattstrasse) |

Die Fläche gilt; die Abweichungen stehen gezählt im `note` der Zone. Sagte
die **Mehrheit** der Parkuhren etwas anderes als die Fläche, bräche der Bau
ab — dann wäre die Fläche veraltet, nicht die Parkuhr.

## Die Höchstparkdauer

Aus den Parkfeldern in der Fläche (`parkdauer`, Minuten), nur Felder mit
Parkuhr — wie in Berlin und Frankfurt als Anteil, weil sie je Feld gilt:

| Fläche | Felder mit Parkuhr | häufigster Wert | Anteil | weitere Werte |
| --- | --- | --- | --- | --- |
| Innenstadt | 2.482 | 2 h | 93,6 % | 30 min (111), 3 h (37), 1 h (12) |
| Oerlikon | 404 | 4 h | 45,0 % | 2 h (177), 30 min (45) |

`null` steht an 4.829 Feldern — exakt den 4.829 mit `gebpflicht: "0"` und
`kategorie: "OPU"` (ohne Parkuhr); der Parser liefert dafür `undefined`,
nicht einen Abbruch. Eine Null wirft.

## Die Entscheidung zur Gebühr

Drei Wege standen offen:

1. **Klasse C** (`scheduleUnknown`, `fee: unknown`) — ehrlich, aber falsch:
   Die Zeiten stehen im Feed, an der Fläche und an 1.215 Parkuhren, und der
   Betrag steht in einem amtlichen, datierten Erlass mit genau zwei Stufen.
2. **Ein Stundensatz** „3,00 CHF/h" — die Zahl der Presse. Sie stimmt für die
   erste Stunde und für sonst nichts: Zwei Stunden kosten 7,50 Fr., nicht 6.
3. **Die Spanne der Grenzsätze**, gewählt: `{ kind: 'range', 150, 450,
   currency: 'CHF' }`. Jede Schätzung der App liegt damit um den wahren
   Betrag — 30 min: 0,75–2,25 (wahr 0,75), 1 h: 1,50–4,50 (3,00), 2 h:
   3,00–9,00 (7,50), 3 h: 4,50–13,50 (9,50) —, und `rawFee` nennt die
   Staffel wörtlich mit Fundstelle. Ein Test rechnet die vier Beträge nach.

Der Niedertarif (Art. 5) ist ein Satz, `exact` 50 Rappen — er hat heute nur
keine Fläche, an der er stünde. Beide tragen `currency: 'CHF'`; ohne das Feld
stünde „3,00 €" über Zürich, und `currencyOf` reicht es bis in die
Kostenschätzung.

## Die Achsenreihenfolge und der 500, gemessen

`www.ogd.stadt-zuerich.ch` ist ein QGIS Server; `GetCapabilities` nennt WFS
1.1.0 und 1.0.0, kein 2.0.0, und als Ausgabeformate `text/xml;
subtype=gml/3.1.1` und `application/vnd.geo+json`. Gemessen an `tarifzonen`
am 17. September 2026:

| Anfrage | Antwort |
| --- | --- |
| `SRSNAME=urn:ogc:def:crs:EPSG::4326&OUTPUTFORMAT=application/json` | **HTTP 500**, `text/html`, 5.980 Bytes — die Fehlerseite der Stadt |
| `SRSNAME=EPSG:4326&OUTPUTFORMAT=application/json` | 200, `application/vnd.geo+json`, 3.598 Bytes, `[8.548, 47.378]` |
| `SRSNAME=EPSG:4326&OUTPUTFORMAT=geojson` | dieselben 3.598 Bytes |
| ohne `SRSNAME`, JSON | dieselben 3.598 Bytes — der Dienst liefert im GeoJSON ohnehin Grad |
| `SRSNAME=urn:ogc:def:crs:EPSG::4326`, GML | 200, `lowerCorner 47.364075 8.518163` — **[lat, lon]** |

Also: `[lon, lat]` im GeoJSON, `[lat, lon]` im GML, und die URN-Form bricht
den JSON-Weg. `wfsUrl` setzt für alle Städte 2.0.0 und die URN-Form; Zürich
steht deshalb mit leerer WFS-Liste und vier fertigen Adressen in
`ZUERICH_FILES` (`sources.ts`), `fetch.ts` zählt sie an `expectedFeatures`.
Das Layer-CRS ist EPSG:2056 (LV95) — die Parkuhren tragen `hochwert`
1.243.681 und `rechtswert` 2.683.177 als Zahl neben der Geometrie; ohne
Umrechnung kämen solche Werte. `assertDegrees` prüft die Grade,
`assertInZuerich` den Rahmen: Vertauscht lägen die Flächen bei 8° Nord,
47° Ost in Somalia, und `assertDegrees` sähe dabei gültige Grade.

Der fertige GeoJSON-Download aus dem Katalog (`…/geodaten/download/…?format=geojson_link`)
antwortet mit einer HTML-Seite der Geodaten-Anwendung, nicht mit der Datei —
deshalb der WFS.

## Der Probelauf

`CITY=zuerich pnpm --filter @knoellchenfrei/ingest fetch-data` holt vier
Dateien (3.598 Bytes, 1.014.315 Bytes, 7.052.405 Bytes, 870.998 Bytes; 2,
1.397, 13.272, 34 Features — alle genau `expectedFeatures`).
`build-data-zuerich` meldet:

```
2 Flächen übernommen (Innenstadt, Oerlikon); ohne Fläche im Feed: Zürich-West (Art. 2 Abs. 3)
553 von 1397 Parkuhren in einer Fläche — 527 einig mit ihr, 26 abweichend; 844 ausserhalb, 182 mit Sonderbezeichnung
Parkuhren ausserhalb der Flächen, nach Tarif:
  283 × Niedertarif, 2 h (0,50 CHF je erste Stunde)
  175 × Niedertarif, 1 h …
  66 × Zoo ganze Woche
  45 × Saisonal Baeder
  40 × Hochtarif, 2 h (3,00 CHF je erste Stunde)
  …
2'886 gebührenpflichtige Parkfelder in den Flächen (stadtweit 8'443 von 13'272)
34 Quartiere
```

Ergebnis: `zones.geojson` 4 KB (2 Flächen: Innenstadt mit 2.482 Feldern,
Oerlikon mit 404), `districts.geojson` 46 KB (34 Quartiere als
„Lindenhof (Kreis 1)"), `poi.geojson` und `umweltzone.geojson` leer,
`meta.json` mit `absent: ['poi', 'umweltzone', 'segments']` und
`managedSpaces: 2886`.

## Der Rahmen, der Mittelpunkt, die Auskunftsstelle

`reportBounds` kommt aus den 34 Quartieren (Hülle 8,446892–8,627209 /
47,319034–47,43514, identisch mit den zwölf Stadtkreisen), nach aussen
gerundet: 8,44–8,63 / 47,31–47,44. Die Flächen allein reichen nur
8,518–8,552 / 47,364–47,414 — Altstetten, Höngg, Witikon und der Zoo lägen
draussen, und dort stehen Parkuhren. `sessionBounds` 8,2–8,9 / 47,15–47,6.
`heatGrid` mit Ursprung 8,44 / 47,31 und Breite 47,38. Mittelpunkt
8,54 / 47,389 zwischen Innenstadt (Schwerpunkt 8,534 / 47,377) und Oerlikon
(8,547 / 47,410), Zoom 12 wie in Rostock — bei 13 wäre Oerlikon vom
Hauptbahnhof aus nicht im Bild.

Der Schlüssel jeder Fläche kommt aus dem Erlass: das Gebiet aus Art. 2,
dessen Ankerpunkt sie enthält — Paradeplatz (8,5391 / 47,3699) → Innenstadt,
Marktplatz Oerlikon (8,5464 / 47,4098) → Oerlikon. Enthält eine Fläche keinen
oder zwei Anker, bricht der Bau ab. Das Quartier der Zone ist das am Anker,
nicht am Schwerpunkt: Der Schwerpunkt der Innenstadt-Fläche liegt im Quartier
Langstrasse (Kreis 4).

**Kein `towedVehicles`.** Auf stadt-zuerich.ch fand sich am 17. September
keine Seite, die eine Auskunftsstelle für abgeschleppte Fahrzeuge mit Namen
und Nummer nennt (`/de/mobilitaet/parkieren/…` verlinkt Bewilligungen,
Parkhäuser, Parkplätze; die geratenen Adressen unter `/de/sicherheit/polizei/`
antworten 404). Fehlt das Feld, zeigt die App den Abschnitt nicht; `zuerich`
steht in `OHNE_BELEG` in `city.test.ts`.

## Feiertage: Kanton Zürich

Die Schweiz regelt Feiertage kantonal; der Bund kennt nur den 1. August
(Art. 110 Abs. 3 BV, `NATIONWIDE.CH`). Für Zürich gilt § 1 des Ruhetags- und
Ladenöffnungsgesetzes vom 26. Juni 2000 (RLG, LS 822.4), gelesen am
17. September 2026 als PDF aus der Loseblattsammlung
(`https://www.notes.zh.ch/appl/zhlex_r.nsf/WebView/663A7F8F1929F218C1256EB7002E6A05/$File/822.4_26.6.00_45.pdf`,
verlinkt von
<https://www.zh.ch/de/politik-staat/gesetze-beschluesse/gesetzessammlung/zhlex-ls/erlass-822_4-2000_06_26-2004_05_01-045.html>):

> § 1. 1 Öffentliche Ruhetage sind: a. Sonntage, b. Neujahrstag, Karfreitag,
> Ostermontag, 1. Mai, Auffahrtstag, Pfingstmontag, 1. August, Weihnachtstag
> und Stephanstag (26. Dezember).
> 2 Hohe Feiertage sind: Karfreitag, Ostersonntag, Pfingstsonntag,
> Eidgenössischer Bettag und Weihnachtstag.
> 3 Die in Abs. 1 lit. b genannten öffentlichen Ruhetage werden im Sinne des
> Arbeitsgesetzes den Sonntagen gleichgestellt.

Also **neun** Tage: `REGIONAL['CH-ZH']` trägt Neujahr, 1. Mai, Weihnachten
und Stephanstag fest und Karfreitag, Ostermontag, Auffahrt, Pfingstmontag
österlich; der 1. August liegt national darunter. Was bewusst fehlt: der
**Berchtoldstag** (2. Januar) — die Aufgabe nannte ihn, das Gesetz nicht; er
ist in Zürich ein Tag, an dem Betriebe schliessen, kein öffentlicher Ruhetag.
**Sechseläuten** (dritter Montag im April) und **Knabenschiessen** (zweiter
Montag im September) sind freie Nachmittage der Stadt, ebenfalls ohne
Grundlage im RLG; halbe Tage kann die Tabelle ohnehin nicht ausdrücken, und
ob die Parkuhren an diesen Nachmittagen aussetzen, sagt keine Quelle. Der
Eidgenössische Bettag ist ein Sonntag. Tests in `core/test/laender.test.ts`:
neun Tage, Unterschied zu Berlin genau drei (Frauentag und 3. Oktober nur
dort, 1. August nur hier), und in `zuerich.test.ts` die Tarifrechnung am
Karfreitag (frei), am 1. August (frei) und am Berchtoldstag (kassiert).

## Was einzutragen bleibt

Nichts — alle Einträge sind auf diesem Zweig gemacht. Zum Mergen die Liste
der **gemeinsamen** Dateien mit Zürich-Zeilen: `core/src/city.ts` (Konstante
`ZUERICH`, `CITIES`), `core/src/holidays.ts` (`CH-ZH` in `Land` und
`REGIONAL`, Belegabsatz), `core/src/index.ts`, `ingest/src/sources.ts`
(`ZUERICH_SOURCES`, `ZUERICH_FILES`, `zuerichQuery`, `BY_CITY`,
`FILES_BY_CITY`), `ingest/package.json`, `core/test/city.test.ts`
(Import, `cityByKey`, `OHNE_BELEG`, Block „Zürich"), `core/test/laender.test.ts`
(`countryOf`, Block „der Zürcher Kalender"), `core/test/fuzz.test.ts`
(Import, zwei Blöcke, Zeitbudget), `core/test/fixture-shape.test.ts`
(Import, Block „Zürcher Fixtures"), `ingest/test/quellen.test.ts` (Block
`cityFiles`, Stadtliste), `apps/web/statistik/main.ts` (`STADTNAMEN`),
`NOTICE`, `README.md` (Zeile „Zone finden", Quellentabelle),
`docs/staedte.md` (Kopf, Tabelle), `docs/data-sources.md` (Abschnitt),
`docs/todo.md`; erzeugt: `zone-keys.generated.ts`, `zone-units.generated.ts`,
`zone-units.generated.json`. Nicht angefasst, weil aus `CITIES` abgeleitet
oder zentral: `deploy.yml`, `kacheln.yml`, `flaechenpunkt`/`quellen`/`zone-units`-Stadtlisten,
`index.html`, `manifest.webmanifest`, `login-page.ts`, `CLAUDE.md` (der
Satz verweist seit dem 16. September auf `docs/staedte.md`).

## Was offen bleibt

1. **70 Hochtarif-Parkuhren ohne Fläche.** Sie stehen in der Enge
   (Genferstrasse 20, Parkring, Gutenbergstrasse, Alfred-Escher-Strasse,
   Bodmer-, Dreikönig-, Gotthard-, Splügen-, Ulmberg-, Stocker-,
   Freigutstrasse, General-Guisan-Quai, Tessinerplatz), im Seefeld und
   Mühlebach (Dufour-, Kreuz-, Seefeld-, Seehof-, Seerosen-, Holbein-,
   Klarastrasse) und dreimal an der Regensbergstrasse in Oerlikon — genau die
   Strassen, die Art. 2 Abs. 1 und 2 „alle inklusive" zu den Gebieten zählen.
   Die Fläche der Stadt (Stand 15.03.2024, Datengrundlage „Orellfüssli-
   Stadtplan") ist also **kleiner als der Erlass**, und die App sagt an
   diesen 70 Parkuhren „ausserhalb der Parkraumbewirtschaftung", wo 3 Franken
   je Stunde gelten. Weg: die Dienstabteilung Verkehr fragen
   (`dav-parkierung@zuerich.ch`, aus dem geocat-Metadatensatz), ob die
   Fläche nachgeführt wird — oder, wie in Karlsruhe, Kleinflächen je Parkuhr
   mit `zoneSnapMetres`, ehrlich nur, wenn das Panel den Abstand sagt.
2. **Der Niedertarif hat keine Fläche.** 774 reguläre Parkuhren ausserhalb
   der Flächen sagen `NIEDER` mit eigener Zeit und Dauer (283 × 2 h Mo–Sa
   9–20, 175 × 1 h, 38 × 0,5 h, dazu 62 mit `Mo-So`) — 0,50 Fr. je Stunde,
   Art. 5. Ohne Fläche fehlen sie; ein Puffer um die Parkuhr wäre eine
   Behauptung über Strassen, die niemand geprüft hat. Die 566
   `parkierungzonename` der Parkuhren sind Strassennamen, keine Gebiete.
3. **Zürich-West** (Art. 2 Abs. 3) fehlt im Feed als Fläche, und in den
   Parkuhren steht dort kein `HOCH` — nur `Kreis 5 Spezial 4h/2h` (26
   Parkuhren, Sonderbezeichnung ohne lesbare Regel). Ob Zürich-West heute
   Hochtarif ist, sagt keine Quelle; die Stadt fragen.
4. **Feiertage an Parkuhren.** Die Fläche sagt „Montag - Samstag" und nichts
   zu Feiertagen; die Regel dieses Projekts (`isFreeDay`) macht jeden
   Ruhetag nach § 1 RLG gebührenfrei. Für Zürich heisst das an bis zu neun
   Tagen im Jahr „frei" — ob die Parkuhren der Stadt an Ruhetagen wirklich
   aussetzen, steht in keiner geprüften Quelle (Art. 4bis nennt Sonn- und
   Feiertage nur für den Zoo). Und der Berchtoldstag ist bewusst **kein**
   Feiertag; gilt er an den Parkuhren doch, ist das ein Zusatzdatum an
   `City.holidays`, mit Beleg.
5. **Der Erlass selbst.** Die Fassung V3 mit Änderungen bis 23. März 2016 ist
   die in der Amtlichen Sammlung ohne Ausserkrafttreten — geprüft am
   17. September 2026. Der Gemeinderat kann die Gebühren ändern (Art. 6:
   Teuerung); `ZUERICH_ORDINANCE.validFrom` und `url` sind die Stelle, an der
   das nachzuziehen wäre.
6. **Behindertenparkplätze** (`geo_behindertenparkplaetze`, Stand 2017,
   `art: Invalid` an 268 Parkfeldern der DAV-Ebene) könnten wie in Frankfurt
   als POI mitkommen; nicht gemacht, weil der eigene Datensatz neun Jahre alt
   ist und die DAV-Felder keinen Namen tragen.
7. **Kachelarchiv** (`kacheln.yml`) und die **Beschreibungstexte** der App
   laufen zentral; Zürich kommt über `CITIES` in beide Stadtlisten.

## Prüfstand

Alle am 17. September 2026 grün, aus `app/` bzw. der Wurzel:
`pnpm -r typecheck`, `pnpm test` (core 1110, ingest, api, web),
`./scripts/sprache-pruefen.sh`, `node scripts/doku-pruefen.mjs`,
`./scripts/namen-pruefen.sh`, `./scripts/commit-pruefen.sh`. Nicht gelaufen:
die E2E-Suite (läuft zentral), der Kachelbau.

## Dateien

| Datei | Inhalt |
| --- | --- |
| `app/packages/core/src/zuerich.ts` | Parser: Bedienungszeit, Tarifzeile der Parkuhr, Tarifstufe, Parkdauer; der Erlass als Konstante mit Ankerpunkten |
| `app/packages/core/test/zuerich.test.ts` | Parser gegen jeden Wert des Abzugs plus Unfug, die Staffel nachgerechnet, Tarifrechnung am Karfreitag, 1. August und Berchtoldstag |
| `app/packages/core/test/fixtures/zh-tarifzonen-2026-09-17.json` | beide Flächen, Sachdaten und erster Stützpunkt |
| `app/packages/core/test/fixtures/zh-parkuhren-2026-09-17.json` | je Schreibweise von `tarif` eine Parkuhr (33) und die Zählung aller 1.397 |
| `app/packages/core/test/fixtures/zh-parkfelder-2026-09-17.json` | je Kombination aus Art, Gebührenpflicht, Kategorie und Parkdauer ein Feld (33) und die Zählungen aller 13.272 |
| `app/packages/core/test/fixtures/zh-quartiere-2026-09-17.json` | alle 34 Quartiere, Sachdaten |
| `app/packages/ingest/src/build-data-zuerich.ts` | Datenbau: Quartiere, Flächen mit Schlüssel aus dem Erlass, Parkuhren als Gegenprobe, Parkfelder als Zählung |
| `app/apps/web/public/data/zuerich/` | `zones.geojson` (2), `districts.geojson` (34), `poi.geojson` und `umweltzone.geojson` (leer), `meta.json` |
| `docs/staedte-zuerich.md` | dieser Bericht |
