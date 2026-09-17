# Kassel als Stadt der Klasse C — gemessen, entschieden, offen

> **Wo der Code liegt.** Parser in `app/packages/core/src/kassel.ts`
> (nur der Zonenname und die Esri-Ringe — es gibt keine Zeiten und keinen
> Betrag zu lesen), Datenbau in `app/packages/ingest/src/build-data-kassel.ts`,
> Abzug unter `app/apps/web/public/data/kassel/`, Stadtkonstante `KASSEL` in
> `app/packages/core/src/city.ts`. Angeschlossen — die zweite Stadt in Hessen
> und die **erste, deren Quelle nur Grenzen nennt**: Jede Zone trägt
> `scheduleUnknown`, die App sagt „Zeiten unbekannt" statt „frei".

> **Stand 17. September 2026.** Alle Zahlen hier sind an diesem Tag gegen die
> Dienste selbst gemessen, nicht aus
> [staedte-recherche-2026-09-16.md](staedte-recherche-2026-09-16.md)
> übernommen. Wo die Messung von der Recherche abweicht, steht es dabei. Was
> fehlt: Zeiten und Tarif (die stehen in der Parkgebührenordnung und am
> Schild, nicht im Dienst) und die Lizenzklärung mit dem Amt für Vermessung
> und Geoinformation — beides unten unter „Was offen bleibt".

## Die Quellen

| | Bewohnerparkbezirke | Ortsbezirke (Stadtteile) | Gemeindegrenze |
| --- | --- | --- | --- |
| Art | ArcGIS MapServer, REST, **`identify`** mit `f=json` | ArcGIS MapServer, REST, `query` mit `f=geojson` | dito, nur zum Messen des Rahmens |
| Adresse | `https://geoportal.kassel.de/arcgis/rest/services/Service_Daten/Verkehr_Mobilitaet/MapServer/27` | `…/Service_Daten/Politik_Verwaltung/MapServer/0` | `…/Politik_Verwaltung/MapServer/8` |
| Ebenenname | „Bewohnerparkbezirke" | „Ortsbezirke Kassel (Stadtteile)" | „Gemeindegrenzen (Landkreis)" |
| Umfang | `returnCountOnly` → **29**; `identify` über den Gemeindeumriss → 29 Ergebnisse, 28 Polygone mit einem Ring, VW7 mit einem Loch | **24** Flächen: 23 Ortsbezirke und `25 Dönchelandschaft (ortsbezirksfrei)`, 22 Polygone + 2 Multipolygone | 39 Flächen des Landkreises, darunter „Stadt Kassel" als MultiPolygon aus zwei Teilen |
| Inhalt | `OBJECTID`, `Name` — **sonst nichts** | `OBZ` (Nummer), `OBZ_Name`, Fläche, Umfang | `name`, `gemeindename`, `gkz_gem`, `PLZ`, `link` |
| Lizenz | **nicht ausgewiesen** — Ebene und Dienst: `copyrightText: ""` bzw. „Stadt Kassel, Vermessung und Geoinformation"; ArcGIS-Online-Eintrag des Dienstes (`244e07e4…`): `licenseInfo: null` | **DL-DE/BY 2.0**, wörtlich aus dem ArcGIS-Online-Eintrag `b9456e1211c64c0eb5b6a85252d52a07`: „Open Data Datenlizenz Deutschland Namensnennung 2.0 "Stadt Kassel, Vermessung und Geoinformation, 2025"" | kein Eintrag gefunden; nur gemessen, nicht ausgeliefert |
| Aktualität | Dienst ohne Datumsfeld; die Stadtseite datiert die Bezirkskarte auf den 17. März 2026 (`Uebersichtskarte-Bewohnerparken-A3-2026-03-17.pdf`), die neuen Bezirke gelten seit dem 1. Mai 2026 | Eintrag `modified` 13. Februar 2025 | — |

**Was die Recherche sagte und was stimmt.** 29 Polygone, ein Feld `Name`,
keine Lizenz: stimmt. **Nicht** mehr stimmt der Abruf: Die Recherche schrieb,
`query?…&f=geojson&outSR=4326` liefere `[lon, lat]`. Am 17. September liefert
`query` bei dieser Ebene in jedem Format **`geometry: null`** — 2.489 Bytes für
29 Bezirke, vollständige Sachdaten, keine Fehlermeldung. Die Feldliste der
Ebene führt kein Geometriefeld (nur `OBJECTID` und `Name`), anders als die
Ortsbezirke mit ihrem `Shape`. Die Geometrie gibt der Dienst nur über
`identify` heraus (und je Objekt unter `/27/<OBJECTID>`, dann aber in
EPSG:25832). Der geoHub der Stadt (`datenkatalog-kassel-geoportal.hub.arcgis.com`),
den die Recherche mit 403 sah, antwortet heute mit 200 — enthält aber keinen
Eintrag zu den Bezirken und hat seine Feeds abgeschaltet („Feeds have been
disabled for this site").

## Die Eigenheit, die alles bestimmt: nur Grenzen

Der Feed sagt zu jedem Bezirk genau eines: seinen Namen. Keine Zeiten, kein
Betrag, keine Höchstparkdauer, kein Feld, das eine Gebührenzone nennt. Was
gilt, steht in der **Parkgebührenordnung der Stadt Kassel** (3.18, „Vom
19. Mai 2014 in der Fassung der Dritten Änderung vom 29. September 2025",
`kassel.de/satzungen/3.18-parkgebuehrenordnung.php`) — und die nennt Beträge
je Gebührenzone und **Straßenliste**, nicht je Bewohnerparkbezirk:

- § 2 Abs. 1, **Parkgebührenzone Zentrum**: „eine Parkgebühr von 1,00 Euro für
  eine Parkzeit bis zu ½ Stunde, 1,50 Euro für eine Parkzeit bis zu ¾ Stunde,
  2,00 Euro für eine Parkzeit bis zu 1 Stunde, […] 6,00 Euro für eine Parkzeit
  bis zu 3 Stunden"; Abs. 3 zählt 46 Straßen und Plätze auf.
- § 3 Abs. 1, **Parkgebührenzone Zentrum II Bad Wilhelmshöhe**: dieselbe
  Staffel bis „4,00 Euro für eine Parkzeit bis zu 2 Stunden"; Abs. 2 nennt vier
  Straßen.
- § 4 Willy-Brandt-Platz, § 5 Graf-Bernadotte-Platz (Tagestarife bis 16 Tage).
- § 6 Abs. 1, **Parkgebührenzone II**: „eine Gebühr von 0,50 Euro für eine
  Parkdauer bis zu einer ½ Stunde, 1,00 Euro für eine Parkdauer bis zu 1 Stunde,
  […] 6,00 Euro für eine Parkdauer bis zu 9 Stunden"; Abs. 2 zählt mehrere
  hundert Straßen auf, viele davon abschnittsweise („zwischen … und …").

**Zeiten nennt die Ordnung nirgends.** Sie regelt, was ein Parkschein kostet,
nicht wann er gebraucht wird — das steht am Schild und am Automaten. Und die
Zuordnung Bezirk → Gebührenzone steht nur in der **Legende des Dienstes**:
Der `uniqueValue`-Renderer der Ebene 27 färbt 28 Namen als
„Parkgebührenzone II" und `Zentrum` als eigene Klasse. Das ist eine
Darstellungsregel, kein Sachdatum; ein Bezirk kann Straßen enthalten, die in
§ 6 Abs. 2 nicht stehen, und die Stadt schreibt, die erweiterte Zone werde
„schrittweise in den einzelnen Stadtteilen umgesetzt" — die Gebührenpflicht
gilt „mit dem Tag der Beschilderung und der Inbetriebnahme der neuen
Parkscheinautomaten". Einen Betrag an die Fläche zu schreiben hieße raten.

Deshalb Klasse C, so wie es seit dem 16. September in `core` vorgesehen ist:
`scheduleUnknown: true`, `windows: []`, `fee: {kind: 'unknown'}`, `rawHours`
und `rawFee` leer, `meta.absent` mit `schedule` und `fee`. Das Panel sagt „Die
Stadt veröffentlicht für dieses Gebiet keine Zeiten und keinen Tarif, nur seine
Grenze", die Karte färbt grau. Die `note` je Zone nennt die Namensform und
verweist auf die Gebührenordnung, ohne einen Betrag zu behaupten.

## Der Zonenname: drei Formen

Alle 29 Werte des Abzugs, gezählt:

| Form | Muster | Anzahl | Werte |
| --- | --- | --- | --- |
| Quartierskürzel mit Ziffer | `[A-ZÄÖÜ]{2}[1-9]` | 21 | BW1–3, RO1–4, SÜ1–2, UN1–2, VW2–7, WH1–3, WT1 |
| römische Nummer | `II` … `XII` (ausdrückliche Liste) | 7 | II, III, IV, V, VI, VIII, IX — **I und VII fehlen** |
| Zentrum | wörtlich | 1 | Zentrum |

`SÜ1`/`SÜ2` tragen den Umlaut im Feed; er ist Teil des Schlüssels und bleibt
es (`zone-keys.generated.ts` führt ihn so, der Worker prüft dagegen). Die
Kürzel decken sich mit den Ortsbezirken, in denen die Flächen liegen — gemessen
über den Schwerpunkt jedes Bezirks gegen die 24 Ortsbezirke, nicht aus dem
Namen geraten: BW1–3 in Bad Wilhelmshöhe, VW2–7 im Vorderen Westen, WH1–3 in
Wehlheiden, SÜ1–2 in der Südstadt, UN1–2 in der Unterneustadt, WT1 in Wesertor,
RO2–4 in Rothenditmold — und **RO1 in Nord-Holland**, III im Vorderen Westen,
IX in Wesertor, II/IV/Zentrum in Mitte, V/VI/VIII in Nord-Holland. Kein Bezirk
bleibt ohne Ortsbezirk. Das Feld `district` kommt aus dieser Messung.

Was der Parser abweist: leere Namen, Kleinschreibung (`bw1`), Ziffer 0,
zweistellige Ziffern, Buchstaben ohne Ziffer, `IIII`, alles jenseits von XII,
„Zentrum II", Zahlen, Prosa. Ein Tippfehler im Dienst soll auffallen, nicht
als neue Zone durchrutschen. Unter Beschuss (`fuzz.test.ts`) wirft er nur
`KasselParseError`.

## Die Geometrie: Esri-Ringe, nicht GeoJSON

`identify` antwortet in Esri-JSON: `results[].geometry.rings` als flache
Liste von Ringen, dazu `attributes` **als Zeichenketten** — auch `OBJECTID`
(`"1"`), anders als bei `query`, wo dieselbe Nummer eine Zahl ist.
`fixture-shape.test.ts` hält beides fest.

Außenringe laufen bei Esri im Uhrzeigersinn (Schnürformel negativ), Löcher
dagegen. Gemessen an allen 29: 29 Außenringe, alle geschlossen, Flächen
zwischen 11 und 106 Millionstel Quadratgrad; **ein** Loch, in VW7, fünf
Stützpunkte, 0,7 Millionstel. `esriRingsToPolygons` in `core/kassel.ts`
macht daraus GeoJSON-Polygone (Außenring zuerst, Löcher dahinter, jedes Loch
zu dem Außenring, der seinen ersten Stützpunkt enthält) und wirft bei offenen,
zu kurzen oder flächenlosen Ringen und bei Löchern ohne Außenring. Die
Fixture `kassel-bezirk-vw7-2026-09-17.json` ist das vollständige Ergebnis für
VW7, wörtlich.

**`sr=4326` wird nachgemessen.** Das `identify`-Rechteck ist
`KASSEL.reportBounds` in Grad, `sr=4326` gilt für Ein- und Ausgabe; die
Antwort trägt `spatialReference: {wkid: 4326}` und Stützpunkte wie
`[9.4459, 51.3155]`. Ohne den Parameter kämen Meter in ETRS89 / UTM 32N
(`[531078.79, 5685006.78]`), und `assertDegrees` im Datenbau bräche ab.
`quellen.test.ts` hält das Rechteck mit dem Rahmen in `core/city.ts` gleich —
liefe es davon, fehlten Bezirke am Rand, und niemand sähe es.

## Der Rahmen, der Mittelpunkt, die Auskunftsstelle

- **`reportBounds`** aus der Gemeindegrenze (Ebene 8 des Dienstes
  `Politik_Verwaltung`, „Stadt Kassel", MultiPolygon aus zwei Teilen):
  9,351023–9,570084 / 51,260381–51,369403; die Hülle der 24 Ortsbezirke ist
  auf sechs Stellen dieselbe. Nach außen gerundet: 9,35–9,58 / 51,26–51,37.
  Die Bezirke selbst liegen nur zwischen 9,4289 und 9,5184 / 51,2974 und
  51,3318. Vellmar liegt in einer Bucht der Stadtgrenze und damit innerhalb
  des Rechtecks — das kann kein Rahmen ausdrücken; Baunatal und Kaufungen
  liegen draußen (`city.test.ts`).
- **`center`** ist die Mitte des Rahmens der 29 Bezirke, `[9.474, 51.315]`,
  nicht der Königsplatz: Bad Wilhelmshöhe liegt fünf Kilometer westlich der
  Innenstadt. **Zoom 13** wie Schwerin — die Bezirke spannen 0,09° × 0,03°,
  bei 12 wären sie ein Fleck.
- **Kein `towedVehicles`.** Die Suche auf kassel.de nach „abgeschleppt" und
  „Abschleppen" liefert keinen Treffer; die Parkzonen-Seite nennt nur die
  Leitstelle des Ordnungsamts (0561 787-3061) für Automatendefekte. Kassel
  steht in `OHNE_BELEG`.

## Der Probelauf

```
Kassel — Daten bauen …
  districts.geojson: 35 KB
  zones.geojson: 60 KB
  poi.geojson: 0 KB
  umweltzone.geojson: 0 KB
  meta.json: 1 KB

29 Bewohnerparkbezirke (1 mit Loch, 0 mehrteilig), 24 Ortsbezirke — 0 ohne Ortsbezirks-Treffer
Namensformen:
  21× quartier
  7× nummer
  1× zentrum
Ortsbezirke der Bezirke:
  7× Vorderer Westen
  4× Nord-Holland
  3× Bad Wilhelmshöhe
  3× Wehlheiden
  3× Rothenditmold
  3× Mitte
  2× Südstadt
  2× Unterneustadt
  2× Wesertor
```

`fetch-data` holt 250.236 Bytes (`bezirke.json`) und 363.240 Bytes
(`districts.json`, 24 Features gegen `expectedFeatures: 24`). Die Zählung der
Bezirke macht der Datenbau selbst — `expectedFeatures` in `fetch.ts` gilt nur
für FeatureCollections, und ein `identify`-Ergebnis ist keine —, mit
derselben 95-%-Schwelle; dazu bricht er ab, wenn ein Ergebnis aus einer
anderen Ebene als 27 kommt oder ein Name zweimal vorkommt.

## Feiertage: Hessen

`HE` steht seit Frankfurt in `holidays.ts` (Fronleichnam nach § 1 HFeiertagsG,
kein Reformationstag). Kassel braucht keinen Stadtfeiertag. Solange keine
Zeiten im Feed stehen, entscheidet der Kalender ohnehin nichts — er ist
eingetragen, damit er beim ersten Fenster stimmt.

## Die Lizenz, und warum sie offen ist

Gesucht wurde an sechs Stellen, jede am 17. September abgerufen:

1. **Die Ebene und der Dienst** (`…/MapServer/27?f=pjson`,
   `…/MapServer?f=pjson`): `copyrightText: ""` an der Ebene, „Stadt Kassel,
   Vermessung und Geoinformation" am Dienst. Ein Quellenvermerk, keine
   Freigabe.
2. **ArcGIS Online der Stadt** (`orgid:XCfWVChM4NvhAjyy`, 67 Einträge): Der
   Kartendienst `Verkehr_Mobilitaet` (`244e07e4069d43b0b59251c1746ddb06`) und
   sein WMS (`7d63b8f8…`) führen `licenseInfo: null`. Ein eigener Eintrag für
   die Bewohnerparkbezirke existiert nicht (Suche „Bewohnerparkbezirke Kassel":
   0 Treffer). **Dreizehn andere Ebenen** derselben Stadt tragen dagegen
   wörtlich „Open Data Datenlizenz Deutschland Namensnennung 2.0 "Stadt Kassel,
   Vermessung und Geoinformation, 2025"" — darunter die Ortsbezirke
   (`b9456e12…`), Bebauungspläne, Wahlbezirke, Postleitzahlbereiche; die
   Statistischen Bezirke sogar CC0.
3. **Der geoHub** (`datenkatalog-kassel-geoportal.hub.arcgis.com`,
   Site-Eintrag `b8d5c081…`): `licenseInfo: null`, Feeds abgeschaltet, Suche
   nach „Bewohnerparkbezirke" 0 Treffer. Der Hub verlinkt auf das Impressum
   von kassel.de und die Kontaktseite des Sachgebiets 623 Geoinformation.
4. **Das Enterprise-Portal** (`geoportal.kassel.de/portal/sharing/rest`):
   Suche nach „Bewohnerpark" 0 Treffer; der Dienst-Eintrag dort ohne Lizenz.
5. **kassel.de**: Die Seitensuche nach „Datenlizenz", „Open Data" und
   „Geoportal" liefert nichts; `opendata.kassel.de` leitet auf die Startseite;
   das Impressum nennt „Urheberrechte und Haftung" nur für die Website.
6. **govdata.de**: kein Eintrag zu Kasseler Parkzonen (Suche
   „Kassel Bewohnerpark").

Ergebnis: `licenceFamily: 'unklar'`, `attributionRequired: true` (die
strengere Lesart), `licence: 'nicht ausgewiesen'`, `licenceUrl` auf den
ArcGIS-Online-Eintrag des Dienstes, `licenceOpen` mit dem Satz, was fehlt
und wen man fragt. Die App zeigt ihn über der Karte. Zu fragen ist das **Amt
für Vermessung und Geoinformation, Sachgebiet 623 Geoinformation** (Obere
Königsstraße 8 / Rathaus, 34117 Kassel, Telefon 0561 115, vermgeo@kassel.de
— von der Kontaktseite, auf die der geoHub verlinkt). Die Frage ist konkret:
Gilt die DL-DE/BY 2.0, unter der die Stadt ihre Ortsbezirke und ein Dutzend
weitere Ebenen ausweist, auch für die Ebene „Bewohnerparkbezirke" des
Dienstes `Verkehr_Mobilitaet`? Die **Ortsbezirke** sind belegt DL-DE/BY 2.0
und stünden auch ohne die Antwort.

## Was eingetragen ist

Alle Einträge sind auf diesem Zweig gemacht; hier die Liste, damit ein Merge
weiß, wo er anstößt:

| Datei | Eintrag |
| --- | --- |
| `app/packages/core/src/city.ts` | `KASSEL`, in `CITIES` (nach `ZUERICH`) |
| `app/packages/core/src/index.ts` | `export * from './kassel.js'` |
| `app/packages/ingest/src/sources.ts` | `kassel: []` in `BY_CITY`, `arcgisIdentifyUrl`, `KASSEL_FILES`, `FILES_BY_CITY` |
| `app/packages/ingest/package.json` | `build-data-kassel` |
| `app/packages/core/test/fuzz.test.ts` | `parseKasselZoneName` unter Beschuss und im Zeitbudget |
| `app/packages/core/test/fixture-shape.test.ts` | „Kasseler Fixtures" |
| `app/packages/core/test/city.test.ts` | Kassel war dort das Gegenbeispiel („Bundesland macht keine Stadt") und ist jetzt eine; `OHNE_BELEG`; Königsplatz, Bahnhof Wilhelmshöhe, Harleshausen, Waldau; Baunatal und Kaufungen nicht |
| `app/packages/ingest/test/quellen.test.ts` | `cityFiles('kassel')`, Rechteck gleich `KASSEL.reportBounds`, `arcgisIdentifyUrl` |
| `app/apps/web/statistik/main.ts` | `STADTNAMEN.kassel` |
| `NOTICE`, `README.md`, `docs/staedte.md`, `docs/data-sources.md`, `docs/todo.md` | Zeile bzw. Abschnitt |
| erzeugt | `core/src/zone-keys.generated.ts`, `core/src/zone-units.generated.ts`, `apps/api/src/zone-units.generated.json` |

Nichts einzutragen in `deploy.yml`, `kacheln.yml`, `flaechenpunkt.test.ts`,
`zone-units.test.ts` — die Stadtlisten kommen aus `CITIES`. Nicht angefasst,
wie verabredet: `index.html`, `manifest.webmanifest`, `login-page.ts`,
`CLAUDE.md` (der Satz dort verweist schon auf diese Liste).

## Was offen bleibt

1. **Die Lizenz.** Eine Anfrage an vermgeo@kassel.de (oben) mit der Frage,
   ob die DL-DE/BY 2.0 der übrigen Ebenen auch für die Bewohnerparkbezirke
   gilt. Kommt ein Ja: `licence`, `licenceUrl`
   (`https://www.govdata.de/dl-de/by-2-0`), `licenceFamily: 'dl-de-by'` und
   den Quellenvermerk mit Jahr in `source` eintragen, `licenceOpen` entfernen,
   NOTICE und README nachziehen. Kommt ein Nein: Kassel aus `CITIES` nehmen;
   der Abzug bleibt bis dahin hinter dem Beta-Riegel.
2. **Zeiten und Tarif.** Sie stehen nirgends maschinenlesbar. Zwei Wege: die
   Stadt fragen, ob es die Parkscheinautomaten als Ebene gibt (das Geoportal
   führt Ebene 8 „Parken" — zwölf Parkhäuser, keine Automaten); oder die
   Straßenlisten der §§ 2, 3 und 6 gegen ein Straßennetz legen. Beides ist
   eine eigene Arbeit; bis dahin ist „Zeiten unbekannt" die ehrliche Antwort.
   Die Legende des Dienstes (28 Bezirke „Parkgebührenzone II", einer
   „Zentrum") ist ein Hinweis darauf, welche Staffel gälte — nicht mehr.
3. **`identify` als Abrufweg.** Er hängt an `mapExtent`/`imageDisplay`, die
   der Dienst verlangt und bei Toleranz null nicht braucht, und an der
   Ebenennummer 27. Fällt `query` eines Tages Geometrie aus, ist
   `arcgisQueryUrl` der bessere Weg; der Datenbau prüft die Ebenennummer und
   die Zahl, damit ein Wechsel auffällt.
4. **Die Bezirkskarte der Stadt als PDF** (`Uebersichtskarte-Bewohnerparken-A3-2026-03-17.pdf`,
   22,9 MB) und die Parkgebührenzonen (`Parkgebuehrenzonen-A0-__2026-02-04.pdf`,
   11,6 MB) sind nicht abgerufen — sie wären die Gegenprobe, ob die 29 Flächen
   des Dienstes die 29 Bezirke der Karte sind, und die einzige Quelle für die
   Umrisse der Gebührenzonen.
5. **PMTiles-Kacheln.** `scripts/build-tiles.sh` nimmt den Ausschnitt aus
   `KASSEL.reportBounds`; gebaut und hochgeladen ist noch nichts.

## Prüfstand

```bash
cd app
pnpm -r typecheck                                  # grün, alle vier Pakete
pnpm test                                          # grün: core 1371, api 101, web 312, ingest 110
CITY=kassel pnpm --filter @knoellchenfrei/ingest fetch-data          # 2 Dateien
CITY=kassel pnpm --filter @knoellchenfrei/ingest build-data-kassel   # 29 Bezirke, 24 Ortsbezirke
cd .. && ./scripts/sprache-pruefen.sh && node scripts/doku-pruefen.mjs \
  && ./scripts/namen-pruefen.sh && ./scripts/commit-pruefen.sh      # grün
```

Nicht gelaufen: die E2E-Suite (läuft zentral) und der Kachelbau.

## Dateien

| Datei | Inhalt |
| --- | --- |
| `app/packages/core/src/kassel.ts` | Namensparser, Esri-Ringe → GeoJSON, Satz unter der Zone, Rohfeld-Typen des `identify` |
| `app/packages/core/test/kassel.test.ts` | Tests: jeder Name des Abzugs, Unfug, VW7 mit Loch, Ringregeln, Klasse C in der Tarifrechnung, Kalender |
| `app/packages/core/test/fixtures/kassel-bezirke-2026-09-17.json` | die 29 Sachdatensätze aus `identify`, wörtlich |
| `app/packages/core/test/fixtures/kassel-bezirk-vw7-2026-09-17.json` | ein vollständiges `identify`-Ergebnis mit Loch, wörtlich |
| `app/packages/ingest/src/build-data-kassel.ts` | der Datenbau |
| `app/apps/web/public/data/kassel/` | `zones.geojson`, `districts.geojson`, leere `poi.geojson` und `umweltzone.geojson`, `meta.json` |
