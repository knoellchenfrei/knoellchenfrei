# Graz als achte Stadt — gemessen, entschieden, offen

> **Wo der Code liegt.** Parser in `app/packages/core/src/graz.ts`, Datenbau
> in `app/packages/ingest/src/build-data-graz.ts`, Abzug unter
> `app/apps/web/public/data/graz/`, Stadtkonstante `GRAZ` in
> `app/packages/core/src/city.ts`. Angeschlossen — die erste Stadt außerhalb
> Deutschlands und die erste, deren Quelle **keine Lizenz nennt**.

> **Stand 16. September 2026.** Alle Zahlen hier sind an diesem Tag gegen die
> Dienste selbst gemessen, nicht aus
> [staedte-recherche-2026-09-16.md](staedte-recherche-2026-09-16.md)
> übernommen. Wo die Messung von der Recherche abweicht, steht es dabei. Was
> fehlt: die Lizenzklärung mit dem Stadtvermessungsamt (unten, „Was offen
> bleibt", Punkt 1).

## Die Quellen

| | Kurzparkzonen (Blaue Zone) | Parkzonen (Grüne Zone) | Bezirksgrenzen |
| --- | --- | --- | --- |
| Art | ArcGIS FeatureServer, REST, `f=geojson` | dito | dito, anderer Dienst |
| Adresse | `https://geodaten.graz.at/mapping/rest/services/1_3_Verkehrswesen/Grazer_Parkzonen/FeatureServer/0` | `…/Grazer_Parkzonen/FeatureServer/1` | `https://geodaten.graz.at/mapping/rest/services/OGD_WFS/FeatureServer/44` |
| Ebenenname | „Kurzparkzonen aktuell" | „Parkzonen aktuell" | „Bezirksgrenzen" |
| Umfang | `returnCountOnly` → **90**, 90 Polygone | **75**, 74 Polygone + 1 Multipolygon | **17** Polygone |
| Inhalt | Schlüssel, Name, Typ, Höchstparkdauer (zweimal), Geltungszeit, Gebühr, Links zu Zonenplan und Bewohnerinfo, Handyparken-Code | dieselben 13 Felder | `BEZ_NR`, `BEZ_NAME` |
| Lizenz | **nicht ausgewiesen** — `licenseInfo: null`; `accessInformation`: „© Magistrat Graz \| Stadtvermessungsamt \| Referat für Geoinformation \| Kein Rechtsanspruch aus der Karte ableitbar!" | dito (derselbe Dienst) | **CC BY 4.0** über das OGD-Portal: „Open Government Data Graz der Stadt Graz steht unter einer Creative Commons Namensnennung 4.0 International" — `data.graz.gv.at/graz/nutzungsbedingungen/`; Quellenvermerk „Datenquelle: Stadt Graz – data.graz.gv.at" |
| Aktualität | Dienst ohne Datumsfeld; Portal-Eintrag `modified` 23. Februar 2026; `ZONEN_PLAN` verweist auf PDFs `KPZ_<Zone>.pdf` und `PZ_<Zone>.PDF` | dito | Portal-Eintrag ohne Datum |

Der Abruf ist der aus `sources.ts` (`GRAZ_FILES`, über `arcgisQueryUrl`):
`query?where=1%3D1&outFields=*&f=geojson&outSR=4326`. `maxRecordCount` ist
2000, `exceededTransferLimit` bleibt bei 90 Features aus — `fetch.ts` und der
Datenbau prüfen das Feld trotzdem, weil der Dienst ein abgeschnittenes
Ergebnis nur so meldet.

**Was die Recherche sagte und was stimmt.** Featurezahlen (90/75), Felder,
die beiden Gebührentexte und die drei Zeitschreibweisen stimmen. Eine
Ergänzung: `DELETED` ist in der grünen Ebene einmal `null` (die Recherche
schrieb `None`, das ist dasselbe, Python-seitig gelesen) und einmal wörtlich
`<Null>`; alle übrigen 163 Zeilen tragen ein Leerzeichen. Keine Zeile trägt
einen Wert, der nach einem Löschvermerk aussieht.

## Die Lizenz, und warum sie offen ist

Gesucht wurde an fünf Stellen, jede am 16. September abgerufen:

1. **Der Dienst selbst** (`…/Grazer_Parkzonen/FeatureServer?f=pjson` und
   beide Ebenen): `copyrightText: ""`, `description: ""`. Nichts.
2. **Der Portal-Eintrag** (`gisportal/sharing/rest/content/items/150ea5bc2262464abfde7392cd0b3fea`):
   `licenseInfo: null`, `access: public`, `accessInformation` wie oben. Ein
   Urheberrechtsvermerk mit Haftungsvorbehalt, keine Freigabe. Der
   Nachbar-Dienst `Parkzonen_Gebiete` (die zu Gebieten zusammengefassten
   Flächen) hat nicht einmal das: `accessInformation: null`.
3. **Das OGD-Portal `data.graz.gv.at`** (WordPress, keine API): Die
   Nutzungsbedingungen stellen „Open Government Data Graz" unter CC BY 4.0 mit
   dem Vermerk „Datenquelle: Stadt Graz – data.graz.gv.at". Die Suche nach
   „Parkzonen" liefert **keinen** Datensatz. Die Freigabe gilt nach ihrem
   Wortlaut für das, was das Portal veröffentlicht — und die Parkzonen
   veröffentlicht es nicht.
4. **Der OGD-Dienst `OGD_WFS`** (`copyrightText: "© Stadt Graz"`, 66 Ebenen):
   führt unter „Verkehr" Behindertenparkplätze, E-Ladestellen, Parkgaragen,
   Park & Ride und TIM-Standorte — **keine Parkzonen**. Dafür Bezirksgrenzen
   (Ebene 44) und Stadtgrenze (Ebene 45); die kommen deshalb von dort.
5. **Der nationale Katalog `data.gv.at`**: Die CKAN-API antwortet unter
   `/katalog/api/3/action/…` mit 404 (das Portal ist umgebaut), die
   Datensatzsuche ebenso. Nicht prüfbar aus dieser Umgebung.

Ergebnis: `licenceFamily: 'unklar'`, `attributionRequired: true` (die
strengere Lesart), `licence: 'nicht ausgewiesen'`, `licenceUrl` auf den
Portal-Eintrag, und `licenceOpen` mit dem Satz, was fehlt und wen man fragt.
Die App zeigt ihn über der Karte. Zu fragen ist das **Stadtvermessungsamt**
(Europaplatz 20, 8020 Graz, +43 316 872-4101, stadtvermessung@stadt.graz.at —
von der Seite der Stadt, `graz.at/cms/ziel/8044336/DE`), Referat
Geoinformation; für das OGD-Portal die Präsidialabteilung, Referat für
Statistik (`ogd@stadt.graz.at`, aus dem Impressum des Portals).

## Zwei Ebenen, ein Feld-Schema, zwei Tarife

Blau und Grün unterscheiden sich in **allem, was die App sagt** — und in
keinem Feldnamen:

| | Blaue Zone (Kurzparkzone) | Grüne Zone (Parkzone) |
| --- | --- | --- |
| Zeit | Mo–Fr 9–20 Uhr **und Sa 9–13 Uhr** (89), Europaplatz täglich 8–22 Uhr (1) | Mo–Fr 9–20 Uhr (75) |
| Gebühr | 1,30 € je halbe Stunde = **2,60 €/h**, Obergrenze 7,80 € | 1,00 € je halbe Stunde = **2,00 €/h**; Tagesticket 11 €, 5-Tages-Ticket 55 € |
| Höchstparkdauer | 180 min (84), 90 min (5), 60 min (1) | keine (75) |
| Schlüssel | `01`…`11`, `S1`, `S2` | `A`…`K`, `S`, `S3` |
| flächendeckend / straßenzugsweise | 21 / 69 | 22 / 53 |

Welche Farbe eine Fläche hat, sagt kein Attribut — nur die Ebene. Der
Datenbau reicht sie als `GrazZoneKind` hinein, und `grazZoneNote` schreibt
sie in den Satz unter der Zone: „Blaue Zone Lend, flächendeckend", „Grüne
Zone, straßenzugsweise — Tagesticket (24 Stunden) 11,00 € — 5-Tages-Ticket
55,00 €". Der **Zonenschlüssel** bleibt der der Stadt (`BEZEICHNUNG`); die
beiden Schlüsselmengen überschneiden sich nicht, ein Test hält das fest.

## Die Straßenzüge

122 der 165 Flächen sind „straßenzugsweise": Streifen entlang einzelner
Straßen. Aus Fläche (`Shape__Area`) und Umfang (aus den Stützpunkten, Rechteck
angenommen) gerechnet: blau im Median **6,7 m** breit (3,4 bis 10,7), grün
**3,7 m** (1,9 bis 7,4). Das ist Karlsruhes Lage (4,8 m), und die Antwort ist
dieselbe: `zoneSnapMetres: 20`. Strikt trifft `zoneAt` die 43 flächendeckenden
Gebiete; der Rückfall auf die nächste Fläche greift nur, wo kein Gebiet den
Punkt enthält.

Zehn der 69 blauen Streifen liegen **innerhalb** eines flächendeckenden
Gebiets (Mittelpunkt im Polygon). Nachgemessen: Alle zehn tragen dieselbe
Zeit, dieselbe Gebühr und dieselbe Höchstparkdauer wie das Gebiet; nur der
Schlüssel weicht dreimal ab (Streifen „07" im Gebiet „06 Münzgraben", „05" in
„06 Klosterwiese"). Der Datenbau schreibt deshalb Gebiete zuerst und Streifen
zuletzt: `zoneAt` nimmt die erste Fläche (das Gebiet), die Karte zeichnet den
Streifen obenauf und der Klick trifft ihn — beide Antworten sind richtig,
weil die Regel dieselbe ist. Zwischen Blau und Grün gibt es keine
Überlappung (0 Mittelpunkte der einen Ebene in der anderen), und
flächendeckende Gebiete überlappen einander nicht.

## Die Zeitangabe: drei Schreibweisen

```
89×  Werktags, Montag bis Freitag, von 9.00 Uhr bis 20.00 Uhr und Samstag von 9.00 Uhr bis 13.00 Uhr
75×  Werktags, Montag bis Freitag von 9.00 bis 20.00 Uhr.
 1×  Täglich von 8.00 Uhr bis 22.00 Uhr
```

Die grüne Schreibweise unterscheidet sich in drei Kleinigkeiten von der
blauen: kein Komma vor „von", kein „Uhr" nach der ersten Zeit, ein Punkt am
Ende. `parseGrazSchedule` macht beides optional und schneidet den Punkt ab;
Klauseln trennt „und". **„Werktags" wird nicht gedeutet**: Der Feed nennt die
Tage immer dazu, und nur die werden gelesen — „Werktags von 9.00 bis 20.00
Uhr" ohne Aufzählung wirft. Ein Fenster über Mitternacht kommt nicht vor und
wirft ebenfalls; die Website der Stadt (gps.graz.at) bestätigt 9–20/9–13 und
den Europaplatz mit „täglich von 8-22 Uhr".

## Die Höchstparkdauer

Sie steht zweimal: `PARKDAUER` als `180 min` und `PARK_DAUER` als Satz „Die
maximale Parkdauer beträgt 180 Minuten (3 Stunden)". Zwei Parser lesen beide;
`parseGrazMaxStayProse` rechnet die Klammer gegen die Minuten (1,5 Stunden =
90), und der Datenbau bricht ab, wenn die beiden Felder auseinanderlaufen —
heute auf keiner der 165 Zeilen. `maxStayMinutes` wird gesetzt, weil es wie in
Hamburg eine Regel der Fläche ist, nicht eine Eigenschaft von Automaten. `0
min` wäre „Parken verboten" und wirft.

## Die Entscheidung zur Gebühr

Die Quelle nennt die **Mindestgebühr je halbe Stunde**, nicht einen
Stundensatz. Dass daraus ein Stundensatz wird, hat zwei Belege:

1. Die Stadt schreibt auf gps.graz.at: „Mindestgebühr (30 Minuten): 1,30
   Euro zahlbar in 10-Cent-Schritten bis zur max. Parkdauer" — linear ab der
   Mindestgebühr.
2. Die Obergrenze im selben Satz, „bis € 7,80", ist genau 6 × 1,30, also drei
   Stunden zum Halbstundensatz. `parseGrazFee` rechnet das nach und wirft, wenn
   die Obergrenze kein Vielfaches ist; der Datenbau prüft zusätzlich, dass die
   Höchstparkdauer zum Stundensatz nie über der Obergrenze liegt (bei 90 und
   60 min steht derselbe Satz — „je nach maximaler Parkdauer").

Die Grüne Zone nennt daneben zwei Tickets, die `Fee` nicht ausdrücken kann.
Sie stehen als `tickets` am `GrazTariff` und in der `note`; die
Kostenschätzung der App rechnet weiter linear (24 Stunden wären 48 € statt
11 €) — das ist ein bekannter Rest, siehe „Was offen bleibt". Ein Nullbetrag
wirft, ein Tagesticket über 24 Stundensätzen oder ein 5-Tages-Ticket unter dem
Tagesticket auch.

Beide Sätze sind die, die die Stadt am 16. September auf ihrer Seite nennt;
der Feed ist preislich aktuell. Währung: Euro, `Fee.currency` bleibt leer.

## Der Probelauf

```
CITY=graz pnpm --filter @knoellchenfrei/ingest fetch-data
  kurzparkzonen (Datei) … 278308 Bytes, 90 features
  parkzonen (Datei) … 182008 Bytes, 75 features
  districts (Datei) … 573795 Bytes, 17 features
CITY=graz pnpm --filter @knoellchenfrei/ingest build-data-graz
  districts.geojson: 37 KB · zones.geojson: 183 KB · poi/umweltzone: leer · meta.json
  165 Flächen (43 flächendeckend, 122 straßenzugsweise), 17 Bezirke
  — 0 mit Löschvermerk ausgelassen, 0 ohne Bezirks-Treffer
```

Bezirke je Fläche: Jakomini 34, St. Leonhard 23, Lend 21, Eggenberg 20, Gries
19, Geidorf 12, Innere Stadt 11, St. Peter 8, Mariatrost 6, Waltendorf 5,
Andritz 4, Puntigam 1, Liebenau 1. `build-zone-keys.ts` zählt 24 Schlüssel,
`build-zone-units.ts` 23 Einheiten (20 Zonen, 3 Bezirke).

`assertDegrees` läuft über jede Geometrie: Mit `outSR=4326` kommt
`[15.4478, 47.0711]`; ohne den Parameter antwortet der Dienst in seinem
Landessystem MGI / Austria GK M34 (`wkid 31256`, Extent −75.000…−60.000 /
208.000…223.000 Meter) — plausible Zahlen, nur keine Grade, dieselbe Falle wie
Frankfurts UTM.

## Feiertage: Steiermark

`AT-ST` steht seit dem 16. September in `holidays.ts` (Commit „Laender,
Waehrung am Tarif, Zeiten unbekannt, Lizenz unklar"): alle dreizehn Tage nach
§ 7 Abs. 2 Feiertagsruhegesetz 1957 (BGBl. Nr. 153/1957) als
`NATIONWIDE.AT`, kein regionaler Zusatz. Der Landespatron Josef (19. März)
ist kein gesetzlicher Feiertag, Karfreitag seit 2019 nur ein „persönlicher
Feiertag". `graz.test.ts` misst den Unterschied zu Berlin an drei Tagen: 26.
Oktober frei (Nationalfeiertag), 3. Oktober **nicht** frei (2026 ein Samstag,
die Blaue Zone kassiert bis 13 Uhr), Karfreitag 2027 **nicht** frei.
Stadtfeiertage (`City.holidays`) gibt es nicht.

## Die Auskunftsstelle

Die Seite der Stadt „Abschleppung von Kraftfahrzeugen und Fahrrädern"
(`graz.at/cms/beitrag/10211713/7749726/…`, abgerufen 16. September 2026) nennt
für Kraftfahrzeuge „ATSW 24h Service Franz Wuthe, Triester Straße 25, 8020
Graz", „Tel.: +43 316 721111", „Die Abholung ist rund um die Uhr möglich",
und als städtischen Ansprechpartner das Straßenamt, +43 316 872-3602. Beides
steht in `towedVehicles`; die Nummer in der Inlandsschreibweise `0316 721111`,
weil der Test in `city.test.ts` ein `+` nicht kennt (siehe „Was offen
bleibt", Punkt 5).

## Was eingetragen ist

Alle Einträge sind auf diesem Zweig gemacht; hier die Liste, damit ein Merge
weiß, wo er anstößt:

| Datei | Eintrag |
| --- | --- |
| `app/packages/core/src/city.ts` | `GRAZ`, in `CITIES` |
| `app/packages/core/src/index.ts` | `export * from './graz.js'` |
| `app/packages/ingest/src/sources.ts` | `GRAZ_SOURCES` (leer), `GRAZ_FILES`, `arcgisQueryUrl`, `FileSource.expectedFeatures`, `FILES_BY_CITY` |
| `app/packages/ingest/src/fetch.ts` | Dateien mit `expectedFeatures`: Featurezahl und `exceededTransferLimit` |
| `app/packages/ingest/package.json` | `build-data-graz` |
| `app/packages/core/test/fuzz.test.ts` | Zeit-, Gebühren- und beide Parkdauer-Parser; Zeitbudget mit neun Parsern |
| `app/packages/core/test/fixture-shape.test.ts` | „Grazer Fixtures" |
| `app/packages/core/test/city.test.ts` | Hauptplatz, Andritz, Puntigam; Leibnitz und Gleisdorf nicht |
| `app/packages/ingest/test/quellen.test.ts` | `graz` in der Liste, `arcgisQueryUrl` |
| `app/packages/ingest/test/zone-units.test.ts`, `app/apps/web/test/flaechenpunkt.test.ts` | Stadtlisten auf acht |
| `app/apps/web/statistik/main.ts` | `STADTNAMEN.graz` |
| `.github/workflows/deploy.yml`, `kacheln.yml` | Stadtlisten (in `kacheln.yml` beide) |
| `NOTICE`, `README.md`, `docs/staedte.md`, `docs/data-sources.md`, `CLAUDE.md` | Zeile bzw. Abschnitt |
| erzeugt | `core/src/zone-keys.generated.ts`, `core/src/zone-units.generated.ts`, `apps/api/src/zone-units.generated.json` |

Nicht angefasst, wie verabredet: `index.html`, `manifest.webmanifest`,
`login-page.ts`.

## Was offen bleibt

1. **Die Lizenz.** Eine Anfrage an das Stadtvermessungsamt (oben) mit der
   Frage, ob der Dienst `Grazer_Parkzonen` unter denselben Bedingungen steht
   wie das OGD-Portal (CC BY 4.0). Kommt ein Ja mit Quellenvermerk: `licence`,
   `licenceUrl`, `licenceFamily: 'cc-by'` und den Vermerk in `source`
   eintragen, `licenceOpen` entfernen, NOTICE und README nachziehen. Kommt ein
   Nein: Graz aus `CITIES` nehmen; der Abzug bleibt bis dahin hinter dem
   Beta-Riegel.
2. **Die Tickets der Grünen Zone in der Kostenschätzung.** `Fee` kennt keine
   Tagesobergrenze; die App rechnet 24 Stunden zu 2 €/h als 48 € statt 11 €.
   Der Weg: ein optionales `dayCapCents` an `Fee.exact`, in `estimateCost`
   gedeckelt — gehört in `core`, betrifft alle Städte und ist deshalb hier
   nicht entschieden. Bis dahin steht das Ticket in der `note`.
3. **POI.** Der OGD-Dienst führt Behindertenparkplätze (Ebene 38),
   E-Ladestellen (39), Parkgaragen (40) und Park & Ride (41) — belegt CC BY
   4.0. `poi.geojson` ist heute leer; die vier Ebenen wären ein Nachmittag.
4. **`Parkzonen_Gebiete`.** Der Nachbar-Dienst fasst die Flächen zu Gebieten
   zusammen (Ebenen „Parkzonen aktuell Gebiete", „Kurzparkzonen aktuell
   Gebiete"). Nicht abgerufen: Die Sachdaten stehen an den Flächen, und die
   Gebiete wären eine zweite Geometrie derselben Auskunft. Für die
   Nutzungsstatistik könnten sie die 20 Zonen-Einheiten sauberer schneiden.
5. **Die Telefonnummer.** `city.test.ts` verlangt eine Nummer ohne `+`
   („und dann eine deutsche"). Für Österreich steht sie in der
   Inlandsschreibweise; wer aus Deutschland anruft, braucht `+43 316 721111`.
   Der Test sollte das Landeskürzel kennen, sobald die zweite ausländische
   Stadt kommt.
6. **`data.gv.at`.** Aus dieser Umgebung nicht prüfbar (404 auf die CKAN-API).
   Steht der Datensatz dort mit Lizenz, wäre das die Antwort auf Punkt 1 —
   von einem Rechner mit freiem Netz in fünf Minuten nachzusehen.
7. **PMTiles-Kacheln.** `scripts/build-tiles.sh` nimmt den Ausschnitt aus
   `GRAZ.reportBounds`; gebaut und hochgeladen ist noch nichts (`kacheln.yml`
   kennt die Stadt).

## Prüfstand

```bash
cd app
pnpm -r typecheck                                  # grün, alle vier Pakete
pnpm test                                          # grün: core 906, api 101, web 304, ingest 56
CITY=graz pnpm --filter @knoellchenfrei/ingest fetch-data          # 3 Dateien
CITY=graz pnpm --filter @knoellchenfrei/ingest build-data-graz     # 165 Flächen, 17 Bezirke
cd .. && ./scripts/sprache-pruefen.sh && node scripts/doku-pruefen.mjs \
  && ./scripts/namen-pruefen.sh && ./scripts/commit-pruefen.sh      # grün
```

Nicht gelaufen: die E2E-Suite (läuft zentral) und der Kachelbau.

## Dateien

| Datei | Inhalt |
| --- | --- |
| `app/packages/core/src/graz.ts` | Zeit-, Gebühren- und zwei Parkdauer-Parser, Löschvermerk, Schlüssel, Satz unter der Zone, Rohfeld-Typen |
| `app/packages/core/test/graz.test.ts` | 37 Tests: jeder Wert des Abzugs, Unfug, Tarifmodell mit Feiertagen |
| `app/packages/core/test/fixtures/graz-kurzparkzonen-2026-09-16.json` | alle 90 Attributzeilen der Blauen Zone, wörtlich |
| `app/packages/core/test/fixtures/graz-parkzonen-2026-09-16.json` | alle 75 Attributzeilen der Grünen Zone, wörtlich |
| `app/packages/ingest/src/build-data-graz.ts` | der Datenbau |
| `app/apps/web/public/data/graz/` | `zones.geojson`, `districts.geojson`, leere `poi.geojson` und `umweltzone.geojson`, `meta.json` |
