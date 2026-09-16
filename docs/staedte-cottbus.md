# Cottbus als achte Stadt — gemessen, entschieden, offen

> **Wo der Code liegt.** `app/packages/core/src/cottbus.ts` (Parser und die
> Parkgebührenordnung als Konstante), `app/packages/ingest/src/build-data-cottbus.ts`
> (Datenbau), `app/apps/web/public/data/cottbus/` (der Abzug), Tests in
> `core/test/cottbus.test.ts` und in den gemeinsamen Testdateien.

> **Stand 16. September 2026.** Cottbus ist angeschlossen: Parser, Datenbau,
> Stadt-Konstante, Feiertagskalender `BB`, Abzug und Einträge in den
> gemeinsamen Dateien liegen im Repository. Was offen bleibt, steht unten —
> vor allem eine Rückfrage an den Fachbereich 32, warum der Datensatz Betrag
> und Zeiten von 2014 führt.

Alle Zahlen hier sind an diesem Tag gegen die Dienste selbst gemessen, nicht
aus [docs/staedte-recherche-2026-09-16.md](staedte-recherche-2026-09-16.md)
übernommen. Wo die Messung von der Recherche abweicht, steht es dabei — an
einer Stelle tut sie das, und die ist entscheidend: Die Recherche nannte den
Betrag als veraltet; veraltet ist auch die **Uhrzeit**.

## Die Quellen

| | Bewohnerparkzonen | Parkscheinautomaten |
| --- | --- | --- |
| Art | ArcGIS FeatureServer (ArcGIS Enterprise 11.5) | ArcGIS FeatureServer |
| Adresse | `https://datenportal.cottbus.de/server/rest/services/FB32/Bewohnerparkzonen/FeatureServer/7` | `…/FB32/Parkscheinautomaten/FeatureServer/1` |
| Abfrage | `query?where=1%3D1&outFields=*&f=geojson&outSR=4326` | dieselbe |
| Umfang | `returnCountOnly` → 5; Abruf 5 Polygone, 26.519 Bytes | `returnCountOnly` → 44; Abruf 44 Punkte, 33.145 Bytes, einer ohne Geometrie |
| Inhalt | `name` (`Parkzone II` … `VI`), `bem` (`Z2` … `Z6`), Telefon, Mail, Antragslink, `geaendert_am` überall `null` | Standort, Stellplätze (`pkw`, `behin_stellpl`, `krad`), `zone` (`Zone 1`/`Zone 2`), sechs Zeitfelder, `mind_gebuehr`, `gebuehr` als Zahl |
| Lizenz | DL-DE/BY-2.0 — `licenseInfo` des ArcGIS-Online-Items `22eacadca78940b4b43d1d4c9ab77863` (Feature Service) und `c68e0859c7b7420da1f7cb88a4d17301` (Map Service) | DL-DE/BY-2.0 — `licenseInfo` des Items `157cb566b0bf429c8eeffa04d564b27f` (Map Service, derselbe Dienst); ein eigenes Item für den Feature Service gibt es nicht |
| Aktualität | Item angelegt 4. August 2026; `editingInfo` leer; `geaendert_am` leer | Item zuletzt 14. November 2025; Inhalt Stand **2014** (siehe unten) |

Der Lizenztext, wörtlich aus `licenseInfo` (abgerufen am 16. September 2026
über `https://www.arcgis.com/sharing/rest/content/items/22eacadca78940b4b43d1d4c9ab77863?f=json`):

> Es gelten die Lizenzbedingungen "Datenlizenz Deutschland - Namensnennung -
> Version 2.0" bzw. "dl-de/by-2-0" (https://www.govdata.de/dl-de/by-2-0) mit
> den dort geforderten Angaben zum Quellenvermerk. Als Rechteinhaber und
> Bereitsteller ist "Stadt Cottbus/Chóśebuz", sowie das Jahr des Datenbezugs
> in Klammern anzugeben. Beispiel für Quellenvermerk: Stadt Cottbus/Chóśebuz
> (2025) "Datenlizenz Deutschland - Namensnennung - Version 2.0" bzw.
> "dl-de/by-2-0" (https://www.govdata.de/dl-de/by-2-0)

Deshalb steht in `City.attribution.source` das Jahr in Klammern:
`Stadt Cottbus/Chóśebuz (2026)`. Der Hub-API-Eintrag
(`opendataportal.cottbus.de/api/v3/datasets`) nennt für den Map-Service-Layer
der Automaten `license: "none"` und für den Feature-Service-Layer der Zonen
`license: "custom"` — das ist die abgeleitete Kurzform des Hubs, der
Lizenztext selbst steht in beiden Items.

**Kein WFS.** Der Ordner `FB32` führt jeden Dienst doppelt, als FeatureServer
und als MapServer; nur der FeatureServer beantwortet `query`. Ohne `outSR`
antwortet der Dienst im GeoJSON ebenfalls in Grad (`[14.313, 51.743]`, also
`[lon, lat]`); das Layer-CRS ist trotzdem EPSG:25833 (`wkid: 25833`,
`extent` in Metern). Der Parameter bleibt gesetzt, und `assertDegrees` im
Datenbau misst nach. `maxRecordCount` ist 2000, `exceededTransferLimit` fehlt
in beiden Antworten. Weil ein FeatureServer auf alles mit 200 antwortet —
auch mit `{"error":…}` —, prüft `fetch.ts` seit Cottbus JSON-Dateien mit
`expectedFeatures` auf Fehlerobjekt, Abschneiden und die 95-%-Schranke.

Der Ordner enthält außerdem `Parkplätze`, `Fahrradboxen`, `Taxistandplätze`
und `vw_baustellen_aktuell` — andere Fragen. Verwaltungsgrenzen liegen in
`Daten_Admin/Ortsteile` (19 Polygone, `ortsteil` zweisprachig wie
`Ströbitz/Strobice`), `Daten_Admin/Stadtgebiete` (5), `FB33/Bezirke` (79) und
`FB33/Stadtgrenze` (1 Multipolygon) — siehe „Was offen bleibt".

## Die Eigenheit, die alles bestimmt: Der Feed nennt den Stand von 2014

Die 44 Automaten tragen **eine** Schreibweise für die Zeit und zwei Beträge:

| Feld | Wert | Anzahl |
| --- | --- | --- |
| `wt`, `wt_bew_beginn`, `wt_bew_ende` | `Mo - Fr`, `08:00`, `19:00` | 44 |
| `woende`, `woen_bew_beginn`, `woen_bew_ende` | `Sa`, `09:00`, `15:00` | 44 |
| `zone`, `gebuehr` | `Zone 1`, `1` | 40 |
| `zone`, `gebuehr` | `Zone 2`, `0.5` | 4 |
| `mind_gebuehr` | `0.200000003` (Zone 1), `0.100000001` (Zone 2) | 40 / 4 |

Die Parkgebührenordnung der Stadt sagt seit dem **1. Juni 2025** etwas
anderes. Wörtlich aus dem amtlichen Text
(<https://cottbus.de/download/23796/fachbereich-32-ordnung-und-sicherheit/165743/parkgebuehrenordnung-2025.pdf>,
verlinkt von <https://cottbus.de/wpfd_file/parkgebuehrenordnung-2025/>,
beschlossen von der Stadtverordnetenversammlung am 26. Februar 2025,
abgerufen am 16. September 2026):

> § 3 Höhe der Parkgebühren und Bewirtschaftungszeiten
> (1) Die Höhe der Parkgebühren in der Stadt Cottbus/Chóśebuz beträgt von
> Montag bis Freitag in der Zeit von 08:00 - 20:00 Uhr, Samstag in der Zeit
> von 09:00 - 15:00 Uhr in Zone 1: Parkgebühr: 1 Stunde = 2,00 €
> Mindestgebühr: 0,50 €, danach Erhöhung in 0,10 €-Schritten, in Zone 2:
> Parkgebühr: 1 Stunde = 1,00 € Mindestgebühr: 0,20 €, danach Erhöhung in
> 0,10 €-Schritten.
> (2) Abweichend von Absatz 1 behält sich die Stadt Cottbus/Chóśebuz das
> Recht vor zu Zeiten von Großveranstaltungen, wie dem Stadtfest oder dem
> Weihnachtsmarkt, von Montag bis Sonntag in der Zeit von 08:00 - 20:00 Uhr
> folgende Parkgebühren zu erheben: in Zone 1: Parkgebühr: 1 Stunde = 2,00 €
> […]
> (5) […] kann die Höchstparkdauer auf gebührenpflichtigen Parkplätzen
> individuell festgelegt werden. Die Angaben an den jeweiligen
> Parkscheinautomaten sind hierbei zu beachten.
> § 4 Inkrafttreten
> Diese Gebührenordnung tritt am 01.06.2025 in Kraft; gleichzeitig tritt die
> Parkgebührenordnung vom 01.01.2014 außer Kraft.

Die Werte des Feeds sind exakt die der abgelösten Ordnung von 2014. Belegt
über den Beschlussbericht zu deren Einführung (Niederlausitz aktuell,
<https://www.niederlausitz-aktuell.de/cottbus/32352/cottbus-aendert-parkgebuehren-und.html>,
abgerufen am 16. September 2026): „Eine Anpassung der Bewirtschaftungszeiten
von Montag bis Freitag in der Zeit von 08:00 bis 19:00 Uhr (bisher 07:00 bis
18:00 Uhr) und Samstag in der Zeit von 09:00 bis 15:00 Uhr (bisher keine
Bewirtschaftung)", „Parkgebührenerhöhung auf 1,00 Euro pro Stunde",
Kurzzeitparkplatz am Bahnhof „mit dem Gebührentarif der Zone 2". Und über die
Mitteilung der Stadt vom 21. Mai 2025
(<https://cottbus.de/allgemein/kostenfreies-kurzzeitparken-und-neue-parkgebuehren-in-kraft/>):
„Tarifzone 1 (Innenstadt): Die bisherige Gebühr von 1,00 EUR pro Stunde wird
auf 2,00 EUR pro Stunde angehoben. […] Tarifzone 2 (insbesondere Hauptbahnhof
und Klinikum): Hier steigt die Gebühr von 0,50 EUR auf 1,00 EUR pro Stunde."
Der Text der Ordnung von 2014 selbst war nicht mehr abrufbar
(`cottbus.de/Storage:file:27576/` → 404); der Entwurf der Änderung im
Ratsinformationssystem (`session.cottbus.de/oparl/bodies/0001/downloadfiles/00021817.pdf`)
sah noch „Montag bis Samstag 08:00 - 20:00" vor, beschlossen wurde die Fassung
oben mit Samstag 09:00–15:00.

Die Recherche vom Vormittag nannte den Betrag als „Köln-Fall" — Feed nennt die
Hälfte, also `fee: unknown`. Die Messung ergibt mehr: Auch das
**Wochentagsende** ist alt, 19:00 statt 20:00 Uhr. Das ändert die
Entscheidung.

## Die Entscheidung zu Gebühr und Zeiten

Drei Wege standen offen:

1. **Den Feed ausliefern.** Die App sagte an jedem Werktag um 19:30 Uhr
   „gebührenfrei", wo die Stadt bis 20 Uhr kassiert. Das ist der teuerste
   Fehler, den dieses Projekt machen kann — genau der, vor dem jede
   Parser-Regel in `CLAUDE.md` warnt. Ausgeschlossen.
2. **Nichts ausliefern.** `fee: unknown` wie in Köln, dazu seit dem
   16. September `scheduleUnknown: true`. Ehrlich, aber Cottbus würde als
   Stadt ohne Zeiten dastehen, obwohl eine amtliche, datierte, unterschriebene
   Ordnung mit genau zwei Zonen und genau einem Zeitfenster vorliegt.
3. **Die Ordnung ausliefern, gemessen am Feed.** Gewählt. Die Ordnung steht
   als Konstante `COTTBUS_ORDINANCE` in `core/cottbus.ts`, mit Fundstelle und
   Datum; `cottbusTariffFor` vergleicht den Feed dagegen und hat drei
   Ausgänge:
   - Feed nennt die Ordnung von 2025 → der Feed gilt, ohne Vermerk. Der Tag,
     an dem die Stadt ihren Datensatz nachzieht, macht das zum Normalfall.
   - Feed nennt exakt den Stand von 2014 (`COTTBUS_FEED_2014`) → die Ordnung
     gilt, `sourceDefect` nennt beides, `rawHours`/`rawFee` nennen beides.
   - Feed nennt etwas Drittes → **Abbruch** des Datenbaus. Ein Feed, der von
     beiden bekannten Ständen abweicht, hat sich geändert, und ob das eine
     dritte Ordnung oder ein Tippfehler ist, weiß nur ein Mensch.

Warum das nicht „raten" ist: Die Ordnung ist die Rechtsquelle, aus der der
Feed abgeleitet ist, nicht umgekehrt. Und warum Köln anders entschieden
wurde: Dort lag keine Ordnung mit Betrag je Zone vor, nur ein Tagesticket auf
einer Webseite; und dort war nur der Betrag alt, nicht die Stunde.

Was das in der Oberfläche heißt: Das Panel zeigt 2,00 € bzw. 1,00 € und
Mo–Fr 08:00–20:00, Sa 09:00–15:00, dazu den Hinweis „Die Quellangabe dieser
Zone ist fehlerhaft (der Datensatz der Stadt nennt noch die
Parkgebührenordnung von 2014 …)". In der Nutzungsstatistik zählt die Zone als
`quelldefekt`, nicht als `frei`/`pflichtig` — das ist die bestehende Regel für
`sourceDefect` und hier richtig: Die Antwort hängt an einer Konstante, nicht am
Feed. Wer die Entscheidung umdrehen will, ändert eine Funktion:
`cottbusTariffFor` gibt für den Stand 2014 dann `fee: { kind: 'unknown' }` und
`windows: []` mit `scheduleUnknown` zurück; alles andere bleibt.

§ 3 Abs. 2 (Großveranstaltungen, Mo–So 08:00–20:00 in Zone 1) hat keinen
Kalender und steht als `unmodelledRules` an den Zone-1-Zonen — wie Berlins
Adventssamstage, nur dass `isUncertainAt` sie nicht als Advent erkennt und die
App deshalb nicht „unsicher" zeigt. Das Panel nennt die Regel.

## Die Zonen: Bewohnerparkzonen, Tarif aus den Automaten

Die Frage aus dem Auftrag: Sind die fünf Bewohnerparkzonen die „Zonen", oder
sind Automatengebiete zu bilden? Gemessen:

| Bewohnerparkzone | Automaten darin | Tarifzone der Automaten | Pkw-Plätze |
| --- | --- | --- | --- |
| II | 17 | alle Zone 1 | 555 |
| III | 6 | alle Zone 1 | 146 |
| IV | 2 | alle Zone 1 | 50 |
| V | 11 | alle Zone 1 | 285 |
| VI | 2 | alle Zone 2 (Leipziger Straße, Klinikum) | 18 |
| außerhalb | 5 | Zone 1: Goethestraße, Ostrower Platz, Ostrower Straße; Zone 2: Bahnhof (2) | — |
| ohne Geometrie | 1 | Dreifertstraße, Zone 1 | — |

Jede Bewohnerparkzone liegt in **genau einer** Tarifzone, und alle Automaten
sagen dieselbe Zeit. Die fünf Polygone sind damit die Zonen; der Datenbau
bricht ab, wenn eine Bewohnerparkzone eines Tages Automaten aus zwei
Tarifzonen oder mit zwei Zeitangaben enthält. Automatengebiete zu bilden
(Voronoi oder Puffer) hätte für die fünf Automaten außerhalb Flächen
erfunden, die die Quelle nicht führt; die Tarifzone 1 der Ordnung ist als
Straßenliste beschrieben („im Norden: Nordstraße, Bonnaskenstraße …"), nicht
als Polygon. Die Automaten am Bahnhof und am Ostrower Platz bleiben deshalb
ohne Fläche — wie in Köln die Automaten außerhalb der Bewohnerparkgebiete.

Der Zonenschlüssel ist die römische Zahl aus `name` (`II` … `VI`), nicht
`bem` (`Z2`): So heißen die Zonen auf den Schildern und im Antrag der Stadt
(Stadtbüro-Vorgang 3490). Eine Zone I gibt es im Datensatz nicht; der Titel
im GeoDatenKatalog („Bewohnerparkzonen II bis V") ist selbst veraltet, VI ist
da.

## Die Zeitangabe

Eine Schreibweise, sechs Felder, 44-mal gleich: `Mo - Fr` `08:00` `19:00` /
`Sa` `09:00` `15:00`. `parseCottbusSchedule` liest die zwei Dreiergruppen
Tage/Beginn/Ende; eine Gruppe ist entweder ganz leer (kein Fenster) oder ganz
gefüllt, halb gefüllt ist ein Abbruch. Tagesspannen (`Mo - Fr`, auch über den
Sonntag), Uhrzeiten `HH:MM` mit 24:00 = 1440, Fenster über Mitternacht als
zwei Fenster — alles abgedeckt, obwohl der Abzug nur die eine Form zeigt: Ein
Feed, der Zeiten als Felder führt, kann jederzeit andere eintragen.

## Die Höchstparkdauer

Der Feed führt keine. Die Ordnung (§ 3 Abs. 5) überlässt sie dem einzelnen
Automaten. Die Stadtseite nennt drei Stunden; das ist eine Aussage über
einzelne Automaten, nicht über eine Zone, und steht deshalb nirgends im
Abzug. `maxStayMinutes` bleibt `null`, `maxStayValues` leer.

## Der Probelauf

`CITY=cottbus pnpm --filter @knoellchenfrei/ingest fetch-data` und
`… build-data-cottbus`, 16. September 2026:

```
zones (Datei) … 26519 Bytes, 5 Features
automats (Datei) … 33102 Bytes, 44 Features
5 von 5 Zonen übernommen — 0 ohne einen einzigen Automaten, 5 mit Quellvermerk (Feed nennt Stand 2014)
38 von 43 Automaten einer Zone zugeordnet, 5 außerhalb aller Zonen, 1 ohne Geometrie, 0 ohne Zeitangabe
1.054 Pkw-Stellplätze an zugeordneten Automaten
```

`zones.geojson` 10 KB, die drei übrigen Ebenen leer, `meta.absent` =
`districts`, `poi`, `lowEmissionZone`, `segments`. Die Zonen-Antwort des
Node-Abrufs ist byteweise identisch mit dem `curl`-Abruf vom Vormittag.

## Der Rahmen der Stadt

`reportBounds` aus `FB33/Stadtgrenze/FeatureServer/1` (ein Multipolygon,
2.775 Stützpunkte, `gemeinde_key` 12052000, `ort` „Cottbus [Chósebuz]"):
14,2733–14,5013 / 51,6926–51,8642, nach außen gerundet 14,27–14,51 /
51,69–51,87. Die 19 Ortsteile ergeben denselben Umriss (14,2732–14,5013 /
51,6926–51,8642). Die fünf Zonen liegen bei 14,3130–14,3404 /
51,7429–51,7656 — wer die Box daraus nähme, wiese den Bahnhof (14,3271 /
51,7504, außerhalb jeder Zone, mit zwei Automaten) als „außerhalb" ab.

Mittelpunkt: Altmarkt, 14,3341 / 51,7607 (OSM über Photon). Zoom 13, enger
als Karlsruhes 12: 0,23° Länge, und die Zonen liegen in einem Band von
1,9 × 2,5 km. `sessionBounds` 14,0–14,8 / 51,45–51,99 — der Nordrand endet
absichtlich unter Berlins Sitzungsrahmen (52,0).

## Feiertage: Brandenburg

Neu in `holidays.ts` als `BB`. § 2 Abs. 1 des Gesetzes über die Sonn- und
Feiertage (Feiertagsgesetz – FTG) vom 21. März 1991 (GVBl. S. 44), zuletzt
geändert durch Gesetz vom 30. April 2015 (GVBl. I Nr. 13), zählt zwölf
gesetzlich anerkannte Feiertage: Neujahrstag, Karfreitag, **Ostersonntag**,
Ostermontag, 1. Mai, Christi Himmelfahrt, **Pfingstsonntag**, Pfingstmontag,
Tag der deutschen Einheit, **Reformationsfest (31. Oktober)**, 1. und
2. Weihnachtsfeiertag. Ostersonntag und Pfingstsonntag fallen immer auf einen
Sonntag und sind für das Modell unerheblich; der Eintrag hat deshalb zehn
Daten (neun bundesweite plus Reformationstag). Kein Frauentag, kein
Fronleichnam, kein Buß- und Bettag, keine gemeindeweise Regelung.

Beleg: Der amtliche Text liegt unter <https://bravors.brandenburg.de/gesetze/ftg>
(am 16. September 2026 aus dieser Umgebung nur als JavaScript-Hülle bzw. mit
503 abrufbar); gelesen wurde der wortgleiche Auszug „822 Brandenburgisches
Feiertagsgesetz (FTG)" im Rechtsportal der Evangelischen Kirche
Berlin-Brandenburg-schlesische Oberlausitz,
<https://www.kirchenrecht-ekbo.de/document/16> (PDF `/pdf/16.pdf`, Stand
7. Februar 2022). Tests in `core/test/holidays.test.ts` messen den Unterschied
zu Berlin: gleich groß, Frauentag gegen Reformationstag.

## Was einzutragen bleibt

Nichts — alles ist in diesem Zweig eingetragen. Zur Übersicht die Stellen, die
beim Zusammenführen Konflikte machen können:

| Datei | Eintrag |
| --- | --- |
| `app/packages/core/src/city.ts` | `COTTBUS` und `CITIES` |
| `app/packages/core/src/holidays.ts` | `Land` um `'BB'`, `REGIONAL.BB`, Beleg im Kommentar |
| `app/packages/core/src/index.ts` | `export * from './cottbus.js'` |
| `app/packages/ingest/src/sources.ts` | `COTTBUS_SOURCES` (leer), `BY_CITY`, `FileSource.expectedFeatures`, `COTTBUS_FILES`, `FILES_BY_CITY` |
| `app/packages/ingest/src/fetch.ts` | `pruefeArcGisAntwort` für Dateien mit `expectedFeatures` |
| `app/packages/ingest/package.json` | `build-data-cottbus` |
| `app/packages/core/test/{city,holidays,fixture-shape,fuzz}.test.ts`, `ingest/test/quellen.test.ts` | je ein Block |
| `app/apps/web/statistik/main.ts` | `STADTNAMEN.cottbus` |
| `.github/workflows/deploy.yml`, `kacheln.yml` | Stadtlisten (in `kacheln.yml` beide) |
| `NOTICE`, `README.md`, `docs/staedte.md`, `docs/data-sources.md`, `docs/todo.md`, `CLAUDE.md` | je eine Zeile bzw. ein Abschnitt |
| erzeugt | `core/src/zone-keys.generated.ts`, `core/src/zone-units.generated.ts`, `apps/api/src/zone-units.generated.json` |

Nicht angefasst, wie vereinbart: `index.html`, `manifest.webmanifest`,
`login-page.ts`.

## Was offen bleibt

1. **Rückfrage an FB 32** (`strassenverkehrsbehoerde@cottbus.de`, Tel.
   0355 6124731 laut Zonendatensatz): Warum führt der Datensatz Betrag und
   Zeiten von 2014, und wird er nachgezogen? Sobald er die Ordnung von 2025
   nennt, liefert `cottbusTariffFor` den Feed ohne Vermerk aus — ohne
   Codeänderung. Nennt er etwas Drittes, bricht der Datenbau ab und nennt
   die Werte.
2. **Ortsteile ohne Lizenzvermerk.** `Daten_Admin/Ortsteile` (19 Polygone,
   zweisprachig) wäre die Stadtteil-Ebene; im Open-Data-Portal gibt es dafür
   kein Item, das Geocoding-Item „Ortsteile" trägt `licenseInfo: null`, das
   Stadtgrenzen-Item ist leer. Die Automaten tragen `id_ortsteile`, die
   genau auf diese Ebene zeigen. Weg: den GIS-Administrator
   (`GIS_Admin_Cottbus`) um ein Hub-Item mit demselben DL-DE/BY-Vermerk
   bitten; bis dahin `district: "Cottbus"` und `absent: ['districts']`.
3. **Automaten ohne Fläche.** Fünf Automaten liegen außerhalb der
   Bewohnerparkzonen (Bahnhof, Ostrower Platz, Ostrower Straße,
   Goethestraße), einer hat keine Geometrie (Dreifertstraße). Dort gilt die
   Ordnung genauso, die App sagt aber „außerhalb". Ein Polygon der
   Tarifzone 1 nach der Straßenliste in § 2 der Ordnung zu zeichnen wäre
   möglich und wäre unsere Geometrie, nicht die der Stadt — deshalb nicht.
4. **`towedVehicles` fehlt.** Keine amtliche Seite mit Verwahrstelle und
   Nummer gefunden; die Polizeiinspektion Cottbus (Juri-Gagarin-Straße 16)
   ist eine allgemeine Nummer, keine Auskunft über umgesetzte Fahrzeuge.
   `OHNE_BELEG` in `city.test.ts`.
5. **Kachelarchiv.** `cottbus.pmtiles` muss über `kacheln.yml` gebaut und
   nach R2 geladen werden; die Nachmessung im Workflow prüft es.
6. **Beschreibungstexte** in `index.html`, `manifest.webmanifest` und
   `login-page.ts` nennen Cottbus noch nicht (zentral).

## Prüfstand

Am 16. September 2026 in diesem Worktree grün: `pnpm -r typecheck`,
`pnpm test` (alle Pakete), `./scripts/sprache-pruefen.sh`,
`node scripts/doku-pruefen.mjs`, `./scripts/namen-pruefen.sh`,
`./scripts/commit-pruefen.sh`. E2E-Suite und Kachelbau laufen zentral.

## Dateien

| Datei | Inhalt |
| --- | --- |
| `app/packages/core/src/cottbus.ts` | Parser für Tage, Uhrzeiten, sechs Zeitfelder, Betrag als Zahl, Tarifzone; `COTTBUS_ORDINANCE`, `COTTBUS_FEED_2014`, `cottbusTariffFor`; Rohfeldtypen |
| `app/packages/core/test/cottbus.test.ts` | 46 Tests, darunter jeder Wert des Abzugs und die Stunde, die der Feed verschweigt |
| `app/packages/core/test/fixtures/cottbus-bewohnerparkzonen-2026-09-16.json` | alle fünf Zonen, Sachdaten wörtlich, erster Stützpunkt je Zone |
| `app/packages/core/test/fixtures/cottbus-parkscheinautomaten-2026-09-16.json` | alle 44 Automaten, Sachdaten wörtlich, Auszählung je Feld |
| `app/packages/ingest/src/build-data-cottbus.ts` | Datenbau: Zuordnung über die Geometrie, Ordnung gegen Feed, fünf Ausgabedateien |
| `app/apps/web/public/data/cottbus/` | der Abzug |
