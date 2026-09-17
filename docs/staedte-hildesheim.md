# Hildesheim als Stadt der Klasse C — gemessen, entschieden, offen

> **Wo der Code liegt.** Parser in `app/packages/core/src/hildesheim.ts`
> (nur der Zonenbuchstabe — es gibt keine Zeiten und keinen Betrag zu
> lesen), Datenbau in `app/packages/ingest/src/build-data-hildesheim.ts`,
> Abzug unter `app/apps/web/public/data/hildesheim/`, Stadtkonstante
> `HILDESHEIM` in `app/packages/core/src/city.ts`, das Land `NI` in
> `app/packages/core/src/holidays.ts`. Angeschlossen — die erste Stadt in
> Niedersachsen und die dritte, deren Quelle nur Grenzen nennt: Jede Zone
> trägt `scheduleUnknown`, die App sagt „Zeiten unbekannt" statt „frei".

> **Stand 17. September 2026.** Alle Zahlen hier sind an diesem Tag gegen
> die Dienste selbst gemessen, nicht aus
> [staedte-recherche-2026-09-16.md](staedte-recherche-2026-09-16.md)
> übernommen. Wo die Messung von der Recherche abweicht, steht es dabei. Was
> fehlt: Zeiten und Tarif (die stehen in der Gebührenordnung für das Parken
> an Parkscheinautomaten und am Schild, nicht im Dienst — und die Ordnung
> war an diesem Tag unter ihrer Adresse nicht abrufbar) und die
> Lizenzklärung mit der Stadt, deren Nutzungsbedingungen sich selbst
> widersprechen — beides unten unter „Was offen bleibt".

## Die Quellen

| | Bewohnerparkzonen | Ortschaften |
| --- | --- | --- |
| Art | MapServer-WFS 2.0.0, `GetFeature` mit `outputFormat=application/json` | dito, eigener Dienstpfad |
| Adresse | `https://gdi.stadt-hildesheim.de/interface/wfs-ms/Bewohnerparkzonen` | `https://gdi.stadt-hildesheim.de/interface/wfs-ms/Ortschaften` |
| Typname | `ms:Bewohnerparkzonen` (der einzige des Dienstes) | `ms:Ortschaften` (der einzige des Dienstes) |
| Umfang | `resultType=hits` → `numberMatched="7"`; Abruf 7 Polygone, 154 KB | `numberMatched="14"`; 14 Polygone, 304 KB |
| Inhalt | `_feature_id`, `ID`, `Zone` (`Zone A` … `Zone G`), `path` — **sonst nichts**, alle vier Zeichenketten | `ID`, `DBS`, `Area`, `Name`, `Name_lang`, `Wohnbaufläche`, `Gemischte_Flächen`, `Industrie_und_Gewerbe` — alle Zeichenketten |
| CRS | `DefaultCRS` EPSG:25832, `OtherCRS` EPSG:4326; mit `srsName=urn:ogc:def:crs:EPSG::4326` kommt **`[lon, lat]`** in Grad, ohne `srsName` UTM-Meter (`[565150.07, 5777739.93]`, `crs` im Kopf) | dito |
| Lizenz | **widersprüchlich** — Nutzungsbedingungen des Geoportals: „unter der Lizenz L-DE->BY-2.0 (https://www.govdata.de/dl-de/by-2-0)" und zugleich „nicht gestattet … für kommerzielle Zwecke zu nutzen"; Vermerk „Geodaten © Stadt Hildesheim" verlangt; der Dienst selbst: `ows:Fees` „None", `ows:AccessConstraints` leer, `ows:ProviderName` leer | dieselben Nutzungsbedingungen |
| Aktualität | Dienst ohne Datumsfeld; `timeStamp` der Antwort ist die Abrufzeit; die Infoblätter der Stadt datieren auf den 13. November 2024, der Bewohnerparkzonenplan auf den 18. Mai 2019 | Dienst ohne Datumsfeld |

**Was die Recherche sagte und was stimmt.** 7 Polygone `Zone A` … `Zone G`,
Felder `ID`, `Zone`, `path` mit dem Windows-Pfad, Lizenz aus den
Nutzungsbedingungen, Zeiten nur im Infoblatt: stimmt — bis auf zwei Dinge.
Erstens die **Achsenreihenfolge**: Die Recherche notierte für
`SRSNAME=urn:…:4326` **`[lat, lon]`** — gemessen im GML von WFS 1.1.0. Das
GeoJSON von 2.0.0, das `wfsUrl` anfragt, kommt **`[lon, lat]`**: erster
Stützpunkt von Zone D `[9.952128, 52.146320]`. MapServer dreht im GML die
Achsen nach der EPSG-Definition, im GeoJSON nicht. `sources.ts` sagt deshalb
`lon,lat`, und `assertInHildesheim` im Datenbau misst nach — gedreht läge die
Altstadt bei 9,9° Nord, 52,1° Ost, im Tschad. Zweitens die **Infoblätter**:
Sie nennen keine Zeiten und keine Beträge (dazu unten). Dazu ein fünftes
Feld, das die Recherche nicht sah: `_feature_id`, die GML-Kennung
(`3379215` … `3379221`).

**Der Weg zu den Ortschaften** war kein Raten: Die Viewer-Konfiguration
(`/api/v2/viewer/view/99683c2f-…/config`) der Karte „Verkehr" listet ihre
Ebenen mit Namen — `Ortschaften` und `Stadtgrenze` unter den
Hintergrundkarten —, und `wfs-ms/Ortschaften` antwortet. `wfs-ms/Stadtgrenze`,
`wfs-ms/Ortsteile`, `wfs-ms/Stadtteile` antworten „Layer not found" (404);
die Stadtgrenze gibt es nur als `/interface/geojson/<uuid>` in EPSG:25832
ohne `srsName`-Parameter. Die 14 Ortschaften decken dieselbe Fläche, also
sind sie der Rahmen.

## Die Eigenheit, die alles bestimmt: nur Grenzen

Der Feed sagt zu jeder Zone genau eines: ihren Buchstaben. Keine Zeiten, kein
Betrag, keine Höchstparkdauer, kein Feld, das eine Gebührenzone nennt. Und
der durchgereichte Pfad `I:/GDI-HI/WebGIS/Verkehr und Sicherheit/Input/
Besucherparkzonen/Zone D_A.shp` verrät, dass die Stadt die Ebene intern
„Besucherparkzonen" nennt — die Flächen sind die Bewohnerparkzonen aus Sicht
der Besucher, die dort einen Parkschein brauchen.

Was gilt, steht in der **„Gebührenordnung für das Parken an
Parkscheinautomaten in der Stadt Hildesheim"** — so heißt sie im Stadtrecht
der Stadt (`stadt-hildesheim.de/portal/seiten/stadtrecht-900004309-33610.html`,
Rubrik der Satzungen und Gebührenordnungen), und so nennt sie auch die
Suchmaschine mit dem Ausschnitt, dass an den Parkscheinautomaten „am
Neustädter Markt, in der Bahnhofsallee, auf dem Parkplatz Alte Zingel, in der
Hannoverschen Straße und in der Speicherstraße" über eine Sondertaste ein
Tagesparkschein für Bewohner gelöst werden kann. **Der Download-Link der
Ordnung** (`stadt-hildesheim.de/downloads/datei/MmE5M2Ji…`) antwortet am
17. September 2026 mit **HTTP 410 Gone** und einer Fehlerseite „Fehler404"
— zweimal, mit und ohne Browser-Kennung. Was darin steht — die
Gebührenzonen, ihre Beträge je angefangene Zeiteinheit, die Zeiten der
Gebührenpflicht —, ist damit an diesem Tag **nicht belegt**. Ein
Suchergebnis nennt „Gebührenzone A 0,30 € je 10 Minuten, Gebührenzone B
0,15 € je 10 Minuten" — ohne Fundstelle, und deshalb steht es hier nur als
das, was jemand mit der Ordnung in der Hand nachprüfen muss, nicht als Zahl
im Abzug.

Die fünf **Informationsblätter zum Bewohnerparken** der Stadt (Stand
13. November 2024, `2024_11_13_bewohner_a_b_c.pdf`, `…_d.pdf`, `…_e_.pdf`,
`…_f_.pdf`, `…_g.pdf`, verlinkt von der Dienstleistungsseite
„Bewohnerparkausweis") sind abgerufen und gelesen: Sie beschreiben, **wer**
einen Ausweis bekommt und **wo** er gilt, nicht **wann** und **was** ein
Fremder zahlt. Wörtlich aus dem Blatt für A, B und C: „Innerhalb der
Bewohnerparkstraßen dürfen Inhaber des sie berechtigenden
Bewohnerparkausweises auf den entsprechend beschilderten Flächen kostenfrei
und ohne zeitliche Begrenzung parken. Für alle anderen Fahrzeuge besteht in
diesem Bereich ein Haltverbot." Und: „In Zone B wurden westlich der
Kardinal-Bertram-Straße (im Umfeld von St. Michaelis) zusätzliche
Parkscheingeber aufgestellt, an denen Bewohner mit ausgelegtem
Bewohnerparkausweis der Zone B bei entsprechender
Verkehrszeichenbeschilderung kostenfrei parken dürfen. Für die Parkplätze
der bereits vorhandenen Parkscheingeber an der Schuhstraße, der Dammstraße
und des Pfaffenstieges gilt diese Regelung zum Schutz der vorhandenen
Geschäfte und Gaststätten nicht." Kein „Uhr", kein „Euro" in keinem der
fünf Blätter — gezählt, nicht überflogen.

Deshalb Klasse C, so wie es seit dem 16. September in `core` vorgesehen ist:
`scheduleUnknown: true`, `windows: []`, `fee: {kind: 'unknown'}`, `rawHours`
und `rawFee` leer, `meta.absent` mit `schedule` und `fee`. Das Panel sagt „Die
Stadt veröffentlicht für dieses Gebiet keine Zeiten und keinen Tarif, nur
seine Grenze", die Karte färbt grau. Die `note` je Zone nennt die Zone und
verweist auf die Gebührenordnung, ohne einen Betrag zu behaupten.

## Der Zonenname: ein Buchstabe

Sieben Werte im Feld `Zone`, jeder genau einmal: `Zone A`, `Zone B`,
`Zone C`, `Zone D`, `Zone E`, `Zone F`, `Zone G`. `parseHildesheimZoneName`
liest `^Zone\s+([A-Z])$` nach Glätten des Leerraums und liefert den
Buchstaben als Schlüssel und `Bewohnerparkzone <Buchstabe>` als Namen — so
steht es auf dem Ausweis und auf den Infoblättern. Abgewiesen wird alles
andere: `Zone d`, `Zone DD`, `Zone D neu`, `Zone 1`, `Zone Ä`, ein leeres
Feld, ein Wert über 40 Zeichen — und nur mit `HildesheimParseError`, die
Zusicherung aus `fuzz.test.ts`.

Warum nicht `ID`: Sie ist die Zeilennummer der Shapedatei und läuft nicht
mit den Buchstaben — ID 1 ist Zone D, ID 2 Zone G, ID 3 Zone A, ID 4 Zone B,
ID 5 Zone E, ID 6 Zone F, ID 7 Zone C. Eine Nummer, die niemand auf einem
Schild wiederfindet, wäre der schlechtere Schlüssel; die Oberfläche schreibt
über `zoneLabel` „Zone D", genau wie die Stadt.

## Die Geometrie: Außenring und Löcher

Jede Zone ist **ein** Polygon: ein Außenring im Uhrzeigersinn (so zeichnet
die Shapedatei Außenringe) und null bis 18 Innenringe dagegen — die
Baublöcke zwischen den Straßen. Gemessen am 17. September mit der
Schnürformel und einem Punkt-in-Polygon-Test je Innenring:

| Zone | Stützpunkte Außenring | Innenringe | jeder Innenring im Außenring |
| --- | --- | --- | --- |
| A | 89 | 8 | ja |
| B | 310 | 18 | ja |
| C | 140 | 16 | ja |
| D | 191 | 1 | ja |
| E | 265 | 1 (4 Stützpunkte, Fläche ≈ 0) | ja |
| F | 356 | 2 | ja |
| G | 214 | 4 (zwei davon 4 Stützpunkte, Fläche ≈ 0) | ja |

Das ist gültiges GeoJSON — anders als Kassels flache Esri-Ringe wird hier
nichts sortiert. Drei Innenringe mit vier Stützpunkten und Fläche nahe null
(E, zweimal G) sind Artefakte der Digitalisierung; `simplifyGeometry` lässt
sie stehen, sie zeichnen nichts. Ausdehnung aller sieben Zonen:
9,927200–9,958903 / 52,144836–52,159446 — 2,2 × 1,6 km um die Altstadt. Die
Ortschaftszuordnung über den Schwerpunkt trifft sechs Zonen in
„Stadtmitte/Neustadt" und Zone E in „Moritzberg/Bockfeld"; null ohne
Treffer.

## Der Rahmen, der Mittelpunkt, die Auskunftsstelle

`reportBounds` 9,84–10,05 / 52,09–52,20 aus der Hülle der 14 Ortschaften
(9,846585–10,042798 / 52,093304–52,193905), nach außen gerundet; die
`WGS84BoundingBox` der Ebene im GetCapabilities (9,844003–10,046531 /
52,090628–52,196575) ist die gröbere Hülle derselben Fläche.
`sessionBounds` 9,6–10,3 / 51,9–52,4. Keine Überschneidung mit einer
anderen Stadt — die nächste im Bestand ist Kassel, 90 km südwestlich;
Hannover (Kröpcke 9,7377 / 52,3744) liegt 20 km nördlich der Nordkante,
Sarstedt (52,2359) 4 km. Giesen (9,90 / 52,195) liegt knapp innerhalb, wie
Gelsenkirchen in Essens Rahmen: Eine Meldung von dort wird angenommen und
liegt in keiner Zone. `heatGrid` mit Ursprung an der Südwestecke (9,84 /
52,09) und `latitude` 52,15.

Mittelpunkt `[9.943, 52.152]`, die Mitte des Zonenrahmens (Altstadt zwischen
Hauptbahnhof und Dom), Zoom 13 wie in Kassel und Essen — die Zonen spannen
0,03° × 0,015°.

`towedVehicles` fehlt, mit Absicht: Auf `stadt-hildesheim.de` nennt die
Parkseite nur „33.2 Ordnung und Gewerbe, Markt 2, 05121 3010" mit
Adressen für Bußgeldstelle und Sondernutzung; eine Auskunftsstelle für
abgeschleppte Fahrzeuge mit Namen und Nummer fand sich nicht.
`city.test.ts` führt Hildesheim deshalb in `OHNE_BELEG`.

## Der Probelauf

```
$ CITY=hildesheim pnpm --filter @knoellchenfrei/ingest fetch-data
Stadt: hildesheim — 2 Quellen nach …/app/.raw/hildesheim
zones … 7 features
districts … 14 features

$ CITY=hildesheim pnpm --filter @knoellchenfrei/ingest build-data-hildesheim
Hildesheim — Daten bauen …
  districts.geojson: 23 KB
  zones.geojson: 31 KB
  poi.geojson: 0 KB
  umweltzone.geojson: 0 KB
  meta.json: 1 KB

7 von 7 Bewohnerparkzonen übernommen (A, B, C, D, E, F, G), alle ohne Zeiten
und Tarif — 0 ohne Ortschafts-Treffer; 14 Ortschaften
```

Die Ortschaften heißen im Abzug nach `Name_lang`, nicht nach `Name`: Das
Kurzfeld ist bei „Neuhof/Hildesheimer Wald/Marienrode" auf 30 Zeichen
abgeschnitten (`Neuhof/HildesheimerWald/Marien`) und schreibt „Bavenstadt"
statt Bavenstedt. Die 14: Stadtmitte/Neustadt, Oststadt/Stadtfeld,
Nordstadt, Marienburger Höhe/Galgenberg, Moritzberg/Bockfeld, Achtum-Uppen,
Bavenstedt, Drispenstedt, Einum, Itzum-Marienburg, Himmelsthür,
Neuhof/Hildesheimer Wald/Marienrode, Ochtersum, Sorsum.

## Feiertage: Niedersachsen

`NI` ist neu in `core/holidays.ts`, mit Beleg: § 2 Abs. 1 des
Niedersächsischen Gesetzes über die Feiertage (NFeiertagsG), Fassung ab dem
29. Juni 2018, wörtlich „Staatlich anerkannte Feiertage sind:
a) Neujahrstag, b) Karfreitag, c) Ostermontag, d) der 1. Mai,
e) Himmelfahrtstag, f) Pfingstmontag, g) der 3. Oktober, als Tag der
Deutschen Einheit, h) der 31. Oktober, als Reformationstag,
i) 1. Weihnachtstag, j) 2. Weihnachtstag." Gelesen in NI-VORIS
(`voris.wolterskluwer-online.de/browse/document/f74bc6e7-6ded-3c2c-9afb-b34620456e56`)
und auf der Seite „Feiertagsrecht" des Innenministeriums, die zum
Buchstaben h sagt: „Der 31. Oktober wurde als Reformationstag durch
Änderungsgesetz vom 22. Juni 2018 neu als staatlich anerkannter Feiertag in
das NFeiertagsG aufgenommen." Damit hat Niedersachsen zehn Feiertage, die
auf einen Werktag fallen können — derselbe Kalender wie Hamburg und
Brandenburg; `holidays.test.ts` misst die Gleichheit und den Unterschied zu
Hessen (Reformationstag gegen Fronleichnam). Keine gemeindeweise Regelung,
kein Stadtfeiertag.

## Die Lizenz, und warum sie offen ist

Die Nutzungsbedingungen des Geoportals
(`geoportal.stadt-hildesheim.de/portal/seiten/nutzungsbedingungen-geoportal-900004129-33610.html`,
abgerufen am 17. September 2026) sagen unter „Nutzungsbedingungen":

> Die von der Stadt Hildesheim angebotenen und in ihrem Eigentum
> befindlichen Daten und Dienste des Geoportals werden unter der Lizenz
> L-DE->BY-2.0 ( https://www.govdata.de/dl-de/by-2-0 ) bereitgestellt. […]
> Für Veröffentlichungen (z.B. für Werbung, Broschüren, Internet, usw.) ist
> im Sinne dieser Nutzungsbedingungen der Urheberrechtsvermerk anzubringen:
> Geodaten © Stadt Hildesheim

„L-DE->BY-2.0" ist ein Tippfehler für DL-DE/BY-2.0; der Link ist eindeutig.
Vier Absätze weiter, unter „Nutzungseinschränkungen und Änderungen der
Nutzungsbedingungen":

> Es ist nicht gestattet, das Geoportal oder seine Inhalte für kommerzielle
> Zwecke zu nutzen, es sei denn, es liegt eine ausdrückliche Genehmigung der
> Stadt Hildesheim vor.

Die Datenlizenz Deutschland Namensnennung 2.0 erlaubt in Nr. 1 ausdrücklich
die Nutzung „insbesondere … kommerziell und nicht kommerziell". Zwei Sätze
auf einer Seite, die sich widersprechen; welcher gilt, kann nur die Stadt
sagen. Der Dienst selbst hilft nicht: `ows:Fees` „None",
`ows:AccessConstraints` leer, `ows:ProviderName` leer, und der WFS führt kein
Metadatenfeld. Der Viewer nennt in seiner Konfiguration nur „© BKG (2025) |
© geodaten" und dieselben Nutzungsbedingungen als `tos`.

Deshalb Familie `unklar`, `attributionRequired: true` (die strengste
Lesart), `source` mit dem verlangten Vermerk „Geodaten © Stadt Hildesheim",
`licenceUrl` die Seite mit beiden Sätzen, und `licenceOpen` mit dem Satz,
den die App als Banner zeigt. Die Anfrage geht an die Stadt Hildesheim
(anfrage@stadt-hildesheim.de, Markt 1, 31134 Hildesheim — das Impressum des
Geoportals nennt keine fachliche Stelle) oder über das Kontaktformular des
Geoportals. Kommt ein „die Lizenz gilt, der Vorbehalt betrifft das Portal":
`licenceFamily: 'dl-de-by'`, `licence: 'Datenlizenz Deutschland
Namensnennung 2.0'`, `licenceUrl: 'https://www.govdata.de/dl-de/by-2-0'`,
`licenceOpen` entfernen, NOTICE und README nachziehen. Kommt ein „der
Vorbehalt gilt": Hildesheim bleibt hinter dem Beta-Riegel, solange das
Projekt nicht kommerziell ist, und `licenceOpen` sagt das.

## Was eingetragen ist

Alle Einträge sind auf diesem Zweig gemacht; hier die Liste, damit ein Merge
weiß, wo er anstößt:

| Datei | Eintrag |
| --- | --- |
| `app/packages/core/src/city.ts` | `HILDESHEIM`, in `CITIES` (nach `ESSEN`) |
| `app/packages/core/src/holidays.ts` | `'NI'` in `Land`, `NI` in `REGIONAL`, Beleg im Kommentar (nach BB, vor CH-ZH) |
| `app/packages/core/src/index.ts` | `export * from './hildesheim.js'` |
| `app/packages/ingest/src/sources.ts` | `HILDESHEIM_WFS`, `HILDESHEIM_DEFAULTS`, `HILDESHEIM_SOURCES`, `hildesheim:` in `BY_CITY` (nach `essen`) |
| `app/packages/ingest/package.json` | `build-data-hildesheim` |
| `app/packages/core/test/fuzz.test.ts` | `parseHildesheimZoneName` unter Beschuss und im Zeitbudget |
| `app/packages/core/test/fixture-shape.test.ts` | „Hildesheimer Fixture" |
| `app/packages/core/test/city.test.ts` | Import, `OHNE_BELEG`, Block „Hildesheim" am Ende |
| `app/packages/core/test/holidays.test.ts` | Block „Niedersachsen" am Ende |
| `app/packages/ingest/test/quellen.test.ts` | „die Hildesheimer Quellen" vor `nprFiles` |
| `app/apps/web/statistik/main.ts` | `STADTNAMEN.hildesheim` |
| `NOTICE`, `README.md`, `docs/staedte.md`, `docs/data-sources.md`, `docs/todo.md`, `docs/release-notes.md` | Zeile bzw. Abschnitt |
| erzeugt | `core/src/zone-keys.generated.ts`, `core/src/zone-units.generated.ts`, `apps/api/src/zone-units.generated.json` |

Nichts einzutragen in `deploy.yml`, `kacheln.yml`, `flaechenpunkt.test.ts`,
`quellen.test.ts` (Stadtliste), `zone-units.test.ts` — die Stadtlisten kommen
aus `CITIES`. Nicht angefasst, wie verabredet: `index.html`,
`manifest.webmanifest`, `login-page.ts`, `CLAUDE.md` (der Satz dort
verweist schon auf diese Liste), und die eine Zeile „Zone finden" in
`README.md`.

## Was offen bleibt

1. **Die Lizenz.** Eine Anfrage an die Stadt (oben) mit der Frage, ob der
   Vorbehalt gegen kommerzielle Nutzung die WFS-Daten betrifft oder nur das
   Portal. Beide Antworten haben oben ihren Weg.
2. **Die Gebührenordnung.** Der Download-Link im Stadtrecht antwortet mit
   410; die Ordnung ist damit weder gelesen noch zitiert. Wer sie hat
   (Amtsblatt des Landkreises Hildesheim, oder die Stadt), trägt Beträge und
   Zeiten in diesen Bericht ein — **nicht** in den Abzug, solange die
   Zuordnung Bewohnerparkzone → Gebührenzone nicht belegt ist: Die
   Bewohnerparkzonen A–G sind laut Infoblatt Ausweisgebiete, die
   Gebührenzonen der Ordnung (A und B, wenn das Suchergebnis stimmt) etwas
   anderes.
3. **Automaten als Ebene.** Die Karte „Verkehr" des Geoportals führt keine
   Parkscheinautomaten; die Infoblätter nennen Standorte in Prosa
   (Neustädter Markt, Bahnhofsallee, Alte Zingel, Hannoversche Straße,
   Speicherstraße). Eine Rückfrage beim Fachbereich 61.2 (Stadtentwicklung,
   Mobilität und Statistik, laut Viewer-Kontakt der Lärmkartierung), ob es
   die Automaten als Vektorebene gibt, wäre der Weg zu Klasse B.
4. **POI.** `Schwerbehindertenparkplätze` und `Park and Ride` stehen im
   Viewer, aber nur als Mapproxy-Kachel bzw. Viewer-Ebene ohne gefundenen
   `wfs-ms`-Pfad. Die Viewer-Konfiguration nennt je Ebene eine UUID; ob
   `/interface/wfs/<uuid>` (WFS 1.x, Capabilities antworten) `srsName` in
   Grad kann, ist nicht gemessen.
5. **PMTiles-Kacheln.** `scripts/build-tiles.sh` nimmt den Ausschnitt aus
   `HILDESHEIM.reportBounds`; gebaut und hochgeladen ist noch nichts.

## Prüfstand

```bash
cd app
pnpm -r typecheck                                  # grün, alle vier Pakete
pnpm test                                          # grün: core 1667, api 101, web 326, ingest 127
CITY=hildesheim pnpm --filter @knoellchenfrei/ingest fetch-data              # 2 Quellen
CITY=hildesheim pnpm --filter @knoellchenfrei/ingest build-data-hildesheim   # 7 Zonen, 14 Ortschaften
cd .. && ./scripts/sprache-pruefen.sh && node scripts/doku-pruefen.mjs \
  && ./scripts/namen-pruefen.sh && ./scripts/commit-pruefen.sh      # grün
```

Nicht gelaufen: die E2E-Suite (läuft zentral) und der Kachelbau. Ein
Zeitbudget-Test in `fuzz.test.ts` (`parseZuerichMeterTariff`, 314 ms statt
300) fiel einmal, als Typprüfung und Tests gleichzeitig liefen — allein
gelaufen grün; er misst Zürichs Parser, nicht diesen.

## Dateien

| Datei | Inhalt |
| --- | --- |
| `app/packages/core/src/hildesheim.ts` | Buchstabenparser, Satz unter der Zone, Rohfeld-Typen |
| `app/packages/core/test/hildesheim.test.ts` | Tests: jeder Name des Abzugs, Unfug, Zone D mit Loch im Rahmen, Achsen, Klasse C in der Tarifrechnung, Kalender, Lizenz |
| `app/packages/core/test/fixtures/hildesheim-zonen-2026-09-17.json` | die sieben Sachdatensätze, wörtlich, mit `numberMatched` |
| `app/packages/core/test/fixtures/hildesheim-zone-d-2026-09-17.json` | Zone D vollständig — Außenring und ein Loch, wörtlich |
| `app/packages/ingest/src/build-data-hildesheim.ts` | der Datenbau |
| `app/apps/web/public/data/hildesheim/` | `zones.geojson`, `districts.geojson`, leere `poi.geojson` und `umweltzone.geojson`, `meta.json` |
