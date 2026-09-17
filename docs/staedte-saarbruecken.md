# Saarbrücken als sechzehnte Stadt — gemessen, entschieden, offen

> **Wo der Code liegt.** Leser der Beschriftungen in
> `app/packages/core/src/saarbruecken.ts`, Datenbau in
> `app/packages/ingest/src/build-data-saarbruecken.ts`, Quellen in
> `sources.ts` als `SAARBRUECKEN_FILES`, Stadt als `SAARBRUECKEN` in
> `core/city.ts`, das Land `SL` in `core/holidays.ts`, Tests in
> `core/test/saarbruecken.test.ts` (26) und in `fixture-shape.test.ts`,
> `fuzz.test.ts`, `city.test.ts`, `holidays.test.ts`,
> `ingest/test/quellen.test.ts`. Die Daten liegen eingecheckt unter
> `app/apps/web/public/data/saarbruecken/`.

> **Stand 17. September 2026.** Saarbrücken ist angeschlossen — die erste
> Stadt im Saarland und die erste deutsche Stadt der **Klasse C**: Die Quelle
> nennt 27 Bewohnerparkzonen als Flächen und, in einer zweiten Datei, ihre
> Buchstaben; sonst nichts. Jede Zone trägt `scheduleUnknown`, die App sagt
> „Zeiten unbekannt" und färbt grau statt frei. Was fehlt, steht unter „Was
> offen bleibt": die Variante der Datenlizenz Deutschland, die das Portal
> nicht nennt, und die Gebührenordnung der Stadt, die die Kurzparkzonen
> regelt und nicht diese Bewohnerparkzonen.

Alle Zahlen hier sind an diesem Tag gegen das Portal selbst gemessen; die
Vormessung vom 16. September steht in der Recherche der zweiten Runde
(Abschnitt „Klasse C"). Sie stimmt bis auf eine Ergänzung: Die Recherche
nannte nur die Zonen-Dateien; Stadtteile und Distrikte liegen im selben
Portal.

## Die Quellen

Alle aus dem Open-Data-Portal der Landeshauptstadt
(`https://opendata.saarbruecken.de`, CKAN 2.11.4, zehn Datensätze), als
statische GeoJSON-Dateien — kein WFS, kein ArcGIS. Jeder Datensatz kommt
**paarweise**: `<name>_fl.geojson` mit den Flächen, `<name>_txt(_pos).geojson`
mit den Beschriftungspunkten aus dem CAD.

| | Parkzonen, Flächen | Parkzonen, Beschriftung | Stadtteile, Flächen | Stadtteile, Beschriftung |
| --- | --- | --- | --- | --- |
| Datensatz | `dataset/parkzonen` (Ordnungsamt) | dito | `dataset/stadtteile` (Hauptamt) | dito |
| Datei | `parkzonen_fl.geojson`, 89.469 Bytes | `parkzonen_txt_pos.geojson`, 10.179 Bytes | `stadtteile_fl.geojson`, 521.295 Bytes | `stadtteile_txt.geojson`, 6.912 Bytes |
| Umfang | **27 MultiPolygone**, je ein Teil, keine Löcher | 30 Punkte, 27 mit `Text`, 3 leer (alle auf `[6.98306, 49.23975]`) | 20 MultiPolygone, dritte Koordinate `0.0` | 20 Punkte, `PGIS_TXT` = `11 Alt-Saarbrücken` … `48 Bübingen` |
| Sachdaten | **nur `ID: 0`** | `Text`, `Layer-Ezs`, `Text-Attr`, `Text-Rot`, `Text-Hoehe` — alles Text | nur `ID: 0` | `PGIS_TXT`, `PGIS_ANG`, `PGIS_R`, `PGIS_H` (Rechts-/Hochwert UTM, Meter) |
| Koordinaten | `[lon, lat]`, erster Stützpunkt `[7.0028, 49.2308]`; kein `crs`-Feld | dito | dito, Rahmen 6,8270–7,1380 / 49,1722–49,3222 | dito |
| Lizenz | `license_id: "datenliz-de"`, `license_url: null` — siehe unten | dito | dito | dito |
| Aktualität | `metadata_modified` 2026-08-27, Ressourcen `last_modified` 2026-08-27 | dito | 2026-08-27 | dito |

Nicht abgerufen: `dataset/distrikte` (57 Distrikte, Beschriftung nur eine
Nummer wie `453` — für die Kopfzeile des Panels sind die 20 benannten
Stadtteile die richtige Ebene), `wahlbezirke`, `postleitzahl`,
`geocodierte-hausnummern`, `radrouten`, `sportflaechen`. Das Portal führt
**keinen** Datensatz zu Parkscheinautomaten, Kurzparkzonen oder Tarifen; die
Suche nach `bezirk`, `stadtteil`, `distrikt`, `grenze` über die API liefert
0 Treffer, weil der Volltextindex leer ist — `package_list` nennt die zehn
Namen.

## Die Lizenz, und warum sie offen ist

Das Portal sagt an drei Stellen dasselbe Wort und sonst nichts:

1. `package_show?id=parkzonen`: `"license_id": "datenliz-de"`,
   `"license_title": "datenliz-de"`, `"license_url": null`.
2. Die Datensatzseite `dataset/parkzonen` zeigt unter „Lizenz" wörtlich
   `datenliz-de` — ein Schlüssel, kein Name, kein Link.
3. `license_list` des Portals kennt fünfzehn Lizenzen (`notspecified`,
   `odc-pddl`, `cc-zero`, `cc-by`, …) und **`datenliz-de` ist nicht darunter**.
   Deshalb kann CKAN weder Titel noch Adresse dazu anzeigen.

„Datenlizenz Deutschland" gibt es in zwei Varianten, und sie unterscheiden
sich genau in der Auflage, an der die Oberfläche hängt: **Zero 2.0** lässt die
Nennung frei, **Namensnennung 2.0** macht sie zur Bedingung und verlangt den
Verweis auf den Datensatz (§ 2). Welche gemeint ist, sagt das Portal nicht.
GovData (`govdata.de/ckan/api/3/action/package_search?q=parkzonen saarbruecken`)
führt den Datensatz nicht, dort stünde sonst die Variante; die „Über
uns"-Seite des Portals sagt nur, die Daten stünden „– soweit rechtlich möglich –
zur freien Nutzung bereit".

Ergebnis: `licenceFamily: 'unklar'`, `attributionRequired: true` (die
strengere Lesart), `licence: 'Datenlizenz Deutschland, Variante nicht
ausgewiesen („datenliz-de")'`, `licenceUrl` auf die Datensatzseite,
`licenceOpen` mit dem Befund. Zu fragen ist das **Ordnungsamt** als
`maintainer` des Datensatzes über die Kontaktadresse des Portals,
`opendata@saarbruecken.de`.

## Die Eigenheit, die alles bestimmt: die Fläche weiß nichts

`parkzonen_fl.geojson` hat 27 MultiPolygone, und jedes trägt als Sachdaten
genau `{"ID": 0}`. Kein Buchstabe, kein Name, kein Stadtteil. Die Buchstaben
liegen als CAD-Beschriftung in `parkzonen_txt_pos.geojson`: 30 Punkte mit
`Text` (`A1`, `B2`, `J`, `U` …), `Layer-Ezs` und `Text-Attr` immer `1495`,
`Text-Rot` immer `0`, `Text-Hoehe` immer `15` — und drei Punkte, bei denen
jedes Feld `null` ist, alle drei auf derselben Koordinate.

Der Datenbau legt jeden beschrifteten Punkt in die Flächen (Punkt in Polygon,
`multiPolygonContains` aus `core`) und verlangt eine **Eins-zu-eins-Zuordnung**
in beiden Richtungen: Eine Fläche ohne Punkt wäre eine Zone ohne Namen, zwei
Punkte in einer Fläche zwei Zonen in einer, ein Punkt ohne Fläche eine Zone,
die es laut Quelle gibt und niemand sieht. Jeder dieser Fälle bricht den Bau
ab. Am 17. September: 27 Flächen, 27 Beschriftungen, 27 Treffer, keine
Mehrfachtreffer, kein Punkt ohne Fläche. Die Zuordnung ist damit **belegt**,
nicht geraten — eine fortlaufende Nummerierung, wie sie bei attributlosen
Flächen sonst nötig wäre, braucht Saarbrücken nicht.

Die 27 Buchstaben sind genau die, die die Stadtseite „Übersicht über die
Parkzonen" (`saarbruecken.de/rathaus/buergerservice/kfz_angelegenheiten/bewohnerparkausweis/uebersicht_ueber_die_parkzonen`)
mit Straßenlisten und je einem PDF führt: A1–A3, B1–B2, C1–C2, D1–D2, E1–E2,
F1–F3, H1–H2, I1–I2, J, L1–L3, N1–N3, R, U. Die Datensatzbeschreibung nennt
dazu ein **G** („Die Parkzonen werden in A, B, C, D, E, F, G, H, I, J, L, N,
R und U unterteilt") — es hat weder Fläche noch Beschriftung noch Seite. Der
Leser `parseSaarbrueckenZoneLabel` nimmt G an, weil es zum Wertebereich der
Quelle gehört, und ein Test hält fest, dass es im Abzug fehlt; alle anderen
Buchstaben (K, M, O, P, Q, S, T, V …) wirft er ab.

Die Stadtseite bestätigt auch die Lage: „Parkzone A: Stadtteile Malstatt und
St. Johann" — im Datenbau liegt A1 in Malstatt, A2 und A3 in St. Johann;
„Parkzone U: Stadtteil Dudweiler" — U ist die eine Zone außerhalb des
Bezirks Mitte. Insgesamt 17 Zonen in St. Johann, 8 in Alt-Saarbrücken, eine
in Malstatt, eine in Dudweiler; keine ohne Stadtteil-Treffer.

## Die Stadtteile, paarweise wie die Zonen

Dasselbe Muster: 20 Flächen mit `ID: 0`, 20 Beschriftungen `PGIS_TXT` in der
Form `11 Alt-Saarbrücken`, `13 St.Johann` (ohne Leerzeichen), `16 St. Arnual`
(mit). Die Zehnerstelle ist der Stadtbezirk, und das ist belegt über die vier
Bezirksseiten der Stadt (`rathaus/stadtpolitik/bezirksraete_und_bezirksbuergermeisterinnen/stadtbezirk_<name>`,
gelesen am 17. September): **Mitte** „Alt-Saarbrücken, St. Arnual, St.
Johann, Eschberg und Malstatt" (11–16), **West** „Altenkessel, Burbach,
Gersweiler und Klarenthal" (21–24), **Dudweiler** „Dudweiler, Jägersfreude,
Herrensohr und Scheidt" (31–34), **Halberg** „Bischmisheim, Brebach-Fechingen,
Bübingen, Ensheim, Eschringen, Güdingen und Schafbrücke" (42–48).
`parseSaarbrueckenStadtteil` liest Ziffer und Name und prüft beide
gegeneinander; ein Name, der in keiner Bezirksliste steht, wirft. Die
Stadtteil-Dateien tragen eine dritte Koordinate `0.0` an jedem Stützpunkt,
die `simplifyGeometry` beim Runden abstreift; `PGIS_R`/`PGIS_H` daneben sind
UTM-Meter (`359302.683`, `5451151.203`) und werden nicht gelesen.

## Die Zeitangabe, die Höchstparkdauer, die Gebühr

**Nirgends in den Daten.** Kein Feld in einer der vier Dateien nennt eine
Zeit, eine Dauer oder einen Betrag. Deshalb je Zone `scheduleUnknown: true`,
`windows: []`, `fee: { kind: 'unknown' }`, `rawHours: ''`, `rawFee: ''`, und
`meta.absent` führt `schedule` und `fee`; die App sagt „Zeiten unbekannt"
und färbt grau.

Was die Stadt regelt, steht in der **Gebührenordnung für das Parken auf
öffentlichen Straßen und Plätzen sowie die Festsetzung von Gebühren in der
Landeshauptstadt Saarbrücken**, zuletzt geändert durch die 1. Änderungsordnung
vom 19. Januar 2026, in Kraft seit dem 1. März 2026 (öffentliche
Bekanntmachung `saarbruecken.de/…/bekanntmachungen_detail/article-697c7f2847977`):
„0,90 € je angefangene halbe Stunde" in der Zone 1, in den übrigen Zonen
„0,40 € für eine Gesamtparkzeit von bis zu 30 Minuten, bei längerer Parkdauer
0,50 € je angefangener halber Stunde", und „Eine Höchstparkdauer von 3
Stunden darf nicht überschritten werden." Die gebührenpflichtigen Zeiten
stehen nicht in der Ordnung — „Die jeweilige Betriebszeit der
Parkscheinautomaten (gebührenpflichtige Zeiten) sowie die Höchstdauer der
zulässigen Parkzeit sind von der Straßenverkehrsbehörde nach den örtlichen
Bedürfnissen festzulegen" —, sondern in der Pressemeldung vom 23. Januar 2026
(„Landeshauptstadt Saarbrücken ordnet Parkgebühren teilweise neu"): bisher
„Montag bis Freitag 8 bis 20 Uhr, Samstag 8 bis 16 Uhr", ab 1. März „Montag
bis Samstag 8 bis 20 Uhr".

Warum das trotzdem nicht in die Daten kommt: Die Ordnung regelt die
**Kurzparkzonen** mit Parkscheinautomaten, der Datensatz zeichnet die
**Bewohnerparkzonen** — zwei Ebenen, die sich in der Innenstadt überlagern
und deren Zuschnitt niemand hier kennt. Welche Straße innerhalb von „A1"
ein Automat bewirtschaftet und welche nur Bewohnerparken ist, sagt keine
Quelle; „Zone 1" der Ordnung ist nicht „A1" des Datensatzes. Ein
Stadt-Tarif an den Bewohnerparkzonen wäre eine Aussage über das Recht,
nicht über die Daten, und für die Straßen ohne Automat falsch.

## Der Probelauf

```
CITY=saarbruecken pnpm --filter @knoellchenfrei/ingest fetch-data
  zones (Datei) … 89469 Bytes, 27 Features
  zoneLabels (Datei) … 10179 Bytes, 30 Features
  districts (Datei) … 521295 Bytes, 20 Features
  districtLabels (Datei) … 6907 Bytes, 20 Features
CITY=saarbruecken pnpm --filter @knoellchenfrei/ingest build-data-saarbruecken
  districts.geojson: 39 KB
  zones.geojson: 27 KB
  poi.geojson: 0 KB
  umweltzone.geojson: 0 KB
  meta.json: 1 KB
27 Zonen aus 27 Flächen und 27 Beschriftungen (3 leere Beschriftungen
übergangen), 20 Stadtteile — 0 Zonen ohne Stadtteil-Treffer
  Zonen je Stadtteil: St. Johann ×17, Alt-Saarbrücken ×8, Malstatt ×1, Dudweiler ×1
```

`zone-keys.generated.ts` kennt seitdem 27 Saarbrücker Kennungen (`A1` … `U`),
2.106 insgesamt.

## Feiertage: Saarland

`SL` ist neu in `core/holidays.ts`. § 2 Abs. 1 des Gesetzes über die Sonn-
und Feiertage (Feiertagsgesetz – SFG) vom 18. Februar 1976 (ABl. S. 213),
zuletzt geändert durch das Gesetz vom 13. Oktober 2015 (Amtsbl. I S. 790),
wörtlich: „der Neujahrstag, der Karfreitag, der Ostermontag, der 1. Mai, der
Tag Christi Himmelfahrt, der Pfingstmontag, der Fronleichnamstag, der Maria
Himmelfahrtstag (15. August), der Tag der Deutschen Einheit (3. Oktober), der
Allerheiligentag (1. November), der 1. Weihnachtstag (25. Dezember), der
2. Weihnachtstag (26. Dezember)". Zwölf Tage; in der Tabelle stehen die drei
über die bundesweiten hinaus: Fronleichnam (`fromEaster: [60]`), Mariä
Himmelfahrt und Allerheiligen (`fixed: ['08-15', '11-01']`). Das Saarland
ist das einzige Land, in dem der 15. August **landesweit** gilt — in Bayern
hängt er gemeindeweise an `City.holidays`; die Tests messen den Unterschied
zu NW (genau der 15. August) und zu BY (15. August gegen Drei Könige).

Das Landesrechtsportal (`recht.saarland.de/bssl/document/jlr-FeiertGSL1976V6P2`)
liefert an einen Abruf ohne JavaScript nur die Hülle „Bürgerservice
Saarland"; gelesen wurde der wortgleiche Abdruck im Rechtsportal der
Evangelischen Kirche im Rheinland (`kirchenrecht-ekir.de/document/2954`) am
17. September 2026.

## Die Auskunftsstelle

Kein `towedVehicles`: Eine amtliche Seite der Stadt oder der Polizei mit
Name, Nummer und Adresse für abgeschleppte Fahrzeuge in Saarbrücken wurde
nicht gelesen; `saarbruecken` steht deshalb in `OHNE_BELEG` in
`city.test.ts`, und die App zeigt den Abschnitt nicht.

## Was eingetragen ist

Alle Einträge sind auf diesem Zweig gemacht; hier die Liste, damit ein Merge
weiß, wo er anstößt:

| Datei | Eintrag |
| --- | --- |
| `app/packages/core/src/city.ts` | `SAARBRUECKEN`, in `CITIES` |
| `app/packages/core/src/holidays.ts` | `'SL'` in `Land`, `REGIONAL.SL` mit Beleg |
| `app/packages/core/src/index.ts` | `export * from './saarbruecken.js'` |
| `app/packages/ingest/src/sources.ts` | `saarbruecken: []` in `BY_CITY`, `SAARBRUECKEN_CKAN`, `SAARBRUECKEN_FILES`, `FILES_BY_CITY` |
| `app/packages/ingest/package.json` | `build-data-saarbruecken` |
| `app/packages/core/test/fuzz.test.ts` | Import, Beschuss von `parseSaarbrueckenZoneLabel` und `parseSaarbrueckenStadtteil` |
| `app/packages/core/test/fixture-shape.test.ts` | „Saarbrücker Fixtures" (drei Teilmengen einer Fixture) |
| `app/packages/core/test/city.test.ts` | St. Johanner Markt, Bübingen; Neunkirchen, Lebach, Saargemünd nicht; `saarbruecken` in `OHNE_BELEG` |
| `app/packages/core/test/holidays.test.ts` | „Saarland", fünf Tests |
| `app/packages/ingest/test/quellen.test.ts` | „cityFiles für Saarbrücken" |
| `app/apps/web/statistik/main.ts` | `STADTNAMEN.saarbruecken` |
| `NOTICE`, `README.md`, `docs/staedte.md`, `docs/data-sources.md`, `docs/todo.md`, `CLAUDE.md` | Zeile bzw. Abschnitt |
| erzeugt | `core/src/zone-keys.generated.ts`, `core/src/zone-units.generated.ts`, `apps/api/src/zone-units.generated.json` |

Nicht angefasst, wie verabredet: `index.html`, `manifest.webmanifest`,
`login-page.ts`, die Stadtlisten in `deploy.yml`/`kacheln.yml` und die Tests
`flaechenpunkt`/`quellen`/`zone-units` (alle aus `CITIES`).

## Was offen bleibt

1. **Die Lizenzvariante.** Eine Anfrage an `opendata@saarbruecken.de`
   (Ordnungsamt als `maintainer`), ob `datenliz-de` Zero 2.0 oder
   Namensnennung 2.0 meint. Kommt Zero: `licence`, `licenceUrl`
   (`govdata.de/dl-de/zero-2-0`), `licenceFamily: 'dl-de-zero'`,
   `attributionRequired: false`, `licenceOpen` entfernen. Kommt
   Namensnennung: `dl-de-by`, `attributionRequired` bleibt, Quellenvermerk
   in der Form, die die Stadt nennt. NOTICE und README nachziehen.
2. **Zeiten und Tarif.** Sie stehen in der Gebührenordnung (oben), gelten
   aber für die Kurzparkzonen, deren Zuschnitt in keiner offenen Quelle
   liegt. Der Weg: beim Ordnungsamt nach einem Datensatz der
   Parkscheinautomaten oder Kurzparkzonen fragen — mit Automaten wäre
   Saarbrücken Klasse A wie Köln, ohne bleibt es C.
3. **Zone G.** Steht in der Datensatzbeschreibung, nirgends sonst. Taucht
   im Abzug einmal eine Beschriftung `G` oder `G1` auf, liest der Datenbau
   sie; taucht eine 28. Fläche ohne Beschriftung auf, bricht er ab und
   `fetch-data` meldet „+1 gegenüber sources.ts".
4. **Die Auskunftsstelle für abgeschleppte Fahrzeuge.** Eine amtliche Seite
   mit Nummer lesen, dann `towedVehicles` mit `checkedOn` eintragen und
   `saarbruecken` aus `OHNE_BELEG` nehmen.
5. **PMTiles-Kacheln.** `scripts/build-tiles.sh` nimmt den Ausschnitt aus
   `SAARBRUECKEN.reportBounds`; gebaut und hochgeladen ist noch nichts.
6. **Die Distrikte.** 57 Flächen mit Nummer, feiner als die Stadtteile; ohne
   Namen für die Kopfzeile unbrauchbar, für eine Statistik je Distrikt
   später vielleicht nicht.

## Prüfstand

```bash
cd app
pnpm -r typecheck                                  # grün, alle vier Pakete
pnpm test                                          # grün
CITY=saarbruecken pnpm --filter @knoellchenfrei/ingest fetch-data                 # 4 Dateien
CITY=saarbruecken pnpm --filter @knoellchenfrei/ingest build-data-saarbruecken    # 27 Zonen, 20 Stadtteile
cd .. && ./scripts/sprache-pruefen.sh && node scripts/doku-pruefen.mjs \
  && ./scripts/namen-pruefen.sh && ./scripts/commit-pruefen.sh      # grün
```

Nicht gelaufen: die E2E-Suite (läuft zentral) und der Kachelbau.

## Dateien

| Datei | Inhalt |
| --- | --- |
| `app/packages/core/src/saarbruecken.ts` | Leser für Zonenbeschriftung und Stadtteil-Beschriftung, Name und Satz der Zone, Rohfeld-Typen dreier Feldschemata |
| `app/packages/core/test/saarbruecken.test.ts` | 26 Tests: jeder Wert der Fixture, die Stadtseite als Gegenprobe, Unfug, Klasse C im Tarifmodell, die Stadt |
| `app/packages/core/test/fixtures/saarbruecken-parkzonen-2026-09-17.json` | alle 27 Flächen-Sachdaten, alle 30 Beschriftungen mit Punkt, alle 20 Stadtteil-Beschriftungen, wörtlich |
| `app/packages/ingest/src/build-data-saarbruecken.ts` | der Datenbau mit `matchLabels` |
| `app/apps/web/public/data/saarbruecken/` | `zones.geojson`, `districts.geojson`, leere `poi.geojson` und `umweltzone.geojson`, `meta.json` |
