# Krakau als fünfzehnte Stadt — gemessen, entschieden, offen

> **Wo der Code liegt.** Leser des Feeds in `app/packages/core/src/krakau.ts`,
> Datenbau in `app/packages/ingest/src/build-data-krakau.ts`, Quellen in
> `sources.ts` als `KRAKAU_FILES`, Stadt als `KRAKAU` in `core/city.ts`,
> Tests in `core/test/krakau.test.ts` (26) und in `fixture-shape.test.ts`,
> `fuzz.test.ts`, `city.test.ts`, `ingest/test/quellen.test.ts`. Die Daten
> liegen eingecheckt unter `app/apps/web/public/data/krakau/`.

> **Stand 17. September 2026.** Krakau ist angeschlossen — die erste Stadt in
> Polen und die erste der **Klasse C**: Die Quelle nennt Sektorgrenzen und den
> Buchstaben der Podstrefa, sonst nichts. Jede Zone trägt `scheduleUnknown`,
> die App sagt „Zeiten unbekannt" und färbt grau statt frei. Was fehlt, steht
> unter „Was offen bleibt": die Lizenz, die der Datensatz nicht nennt, und ein
> Modell für Złoty, Tarifstaffeln und Handelssonntage, bevor Zeiten und
> Tarif aus der Uchwała eingetragen werden können.

Alle Zahlen hier sind an diesem Tag gegen die Dienste selbst gemessen; die
Vormessung vom 16. September steht im Auslandsbericht der Recherche. Wo die
Messung davon abweicht, steht es dabei.

## Die Quellen

Alle vier aus demselben ArcGIS Online der Stadt
(`https://services-eu1.arcgis.com/svTzSt3AvH7sK6q9/arcgis/rest/services`, 390
Dienste), abgerufen mit `query?where=1%3D1&outFields=*&f=geojson&outSR=4326`.

| | Sektorgrenzen (die Flächen) | Erweiterung | Beschriebener Datensatz | Dzielnice |
| --- | --- | --- | --- | --- |
| Dienst / Ebene | `Granice_Stref_2026/FeatureServer/1` („Granice Stref") | `Poszerzenie_OPP_od_10_08_2026/FeatureServer/0` | `Sektory_SPP_wyświetlenie/FeatureServer/37` (`sektory_spp_krk`) | `Dzielnice_Krakowa/FeatureServer/10` (`F07_DZIELN_2014_polyg`) |
| Item | `b19237777c4e42fe8e05636cb0536515`, Eigentümer `mazelak1` | `ed865cc962e748eb82e8125ff480ce3c`, derselbe | `d9e0ef7c33cd4f4a99c4e7d8024d3956`, derselbe; Titel „Strefa Płatnego Parkowania w Krakowie", Tags `ZTP`, `Kraków`, `Dane Otwarte` | `e4de069bb2574615bc795705d8777edc`, Eigentümer `spytkowskig_1`, „pobrana z ISDP" |
| Umfang | **23** Polygone (22 `Polygon`, A20 als `MultiPolygon`), 3.784 Stützpunkte | **4** Polygone, 348 Stützpunkte | **26** Polygone, alle `Polygon` | **18** Polygone, 23.286 Stützpunkte |
| Felder | `OBJECTID`, `Podstrefa_`, `Nr_sektora`, `Uwagi`, `Shape__Area`, `Shape__Length` | dieselben | dieselben, nur `Podstrefa_spp` statt `Podstrefa_`; Wertebereich A, B, C, D, nA, nB, nC, nD | `NAZWA`, `NAZWA_PELN`, `NR_DZIELNI`, `OPIS` (die Uchwała je Dzielnica), `DATA_AKTUA` |
| Werte | A ×7, B ×5, C ×11; `Uwagi` durchweg `' '` | B30, C23, C24, C31; `Uwagi` viermal `Od 10 sierpnia 2026` | A ×7, B ×5, C ×8, nB ×1, nC ×5; `Uwagi` durchweg `null` | I Stare Miasto … XVIII Nowa Huta |
| Rahmen | 19,8953–19,9761 / 50,0282–50,0822 | 19,9004–19,9658 / 50,0282–50,0701 | 19,8876–19,9761 / 50,0282–50,0830 | 19,7922–20,2173 / 49,9677–50,1261 |
| Aktualität | `dataLastEditDate` 2026-08-06 | 2026-07-31 | **2024-12-09** (Schema 2026-07-06) | 2023-08-09 (Daten von 2014, `DATA_AKTUA` 2014-03-31) |
| Lizenz | nichts (`licenseInfo: ""`) | nichts | nur der Vorbehalt, wörtlich unten | nichts |

Dazu, nur für den Rahmen: `Granice_Miasta_Krakowa/FeatureServer/2`
(`F07_MIASTO_polyg`, aus dem ISDP, ein Polygon `NAZWA: Kraków`, 8.729
Stützpunkte, `DATA_AKTUA` 2021-09-03), Rahmen 19,7928–20,2179 /
49,9671–50,1255 → `reportBounds` 19,79–20,22 / 49,96–50,13.

**Zwei Korrekturen an der Vormessung.** Erstens: Die Ebene 37 ist nicht die
Karte. Sie hat den Datenstand vom 9. Dezember 2024 und führt die Erweiterung
vom August 2026 nur als sechs geplante Sektoren mit Präfix `n` (Anhang 2 der
Uchwała CV/2851/23, laut Item-Beschreibung „zastosowano dodatkowo literę n w
celu wyróżnienia"). Die amtliche Karte des Zarząd Dróg Miasta Krakowa
(`zdmk.krakow.pl/parkowanie/strefa-platnego-parkowania/mapy/mapa-strefy/`,
ArcGIS-Instant-App `cfc0b353a65b4bf29164f73d6e3ef8b8`, Web Map „Mapa ZDMK v2"
`1af7545a17494f6297b82455cfed7b6e`, Stand 6. August 2026) zeichnet als
„Obszar Płatnego Parkowania" die Ebene **`Granice_Stref_2026/1`** — 23
Sektoren, darunter die drei neuen und der erweiterte B30. Die Flächen kommen
deshalb von dort. Zweitens: Die Erweiterung ist **nicht** in den 26 enthalten.
Kein Polygon der Erweiterung hat dieselbe Punktmenge wie sein `n`-Gegenstück
(nC23: 121 gegen 68 Stützpunkte, 50,2 gegen 53,4 Hektar; nB30 ist nur das
neue Stück, die Karte führt B30 als Vereinigung mit 75,8 Hektar), und die
Sektoren nC32 und nC33 der Ebene 37 gelten nicht — sie fehlen in der Karte und
in der Erweiterung. Sogar die 20 unveränderten Sektoren sind in keiner Ebene
vertexgleich (C8: 203 gegen 176 Stützpunkte, A20 in der Karte ein
MultiPolygon); die Ebene 37 ist eine ältere Zeichnung derselben Grenzen.

## Die Lizenz, und warum sie offen ist

Gesucht an fünf Stellen, alle am 17. September abgerufen:

1. **Das Item des beschriebenen Datensatzes**
   (`www.arcgis.com/sharing/rest/content/items/d9e0ef7c33cd4f4a99c4e7d8024d3956`):
   `access: public`, `accessInformation: "Zarząd Transportu Publicznego w
   Krakowie"`, Tag „Dane Otwarte" — und als `licenseInfo` wörtlich:

   > Warstwa nie jest załącznikiem do Uchwały, została narysowana na
   > podstawie interpretacji słownego opisu granic i ma charakter
   > poglądowy. Informacje na niej zawarte nie mogą być podstawą do
   > jakichkolwiek roszczeń.

   („Die Ebene ist kein Anhang der Uchwała, sie wurde nach der Deutung der
   wörtlichen Grenzbeschreibung gezeichnet und ist orientierend. Die
   Angaben darin können keine Grundlage für irgendwelche Ansprüche sein.")
   Ein Haftungsvorbehalt, keine Freigabe. Die Beschreibung nennt die
   Grundlage (Anhang 1 und 2 der Uchwała CV/2851/23 vom 22. Februar 2023)
   und die zuständige Stelle: „Jednostką odpowiedzialną za obsługę SPP jest
   Zarząd Dróg Miasta Krakowa".
2. **Die Items der Karte, der Erweiterung und der Dzielnice**: `licenseInfo`
   leer, `accessInformation` leer. Die Web Map „Mapa ZDMK v2" sagt dasselbe
   in einem Satz: „Mapa ma charakter poglądowy i nie może być podstawą
   roszczeń."
3. **Der Dienst selbst** (`…/FeatureServer?f=json`, alle Ebenen):
   `copyrightText: ""`, `description: ""`.
4. **Die ZDMK-Karte** (`mapa-strefy`): „Mapa ma charakter wyłącznie
   poglądowy i nie może służyć do określania granic poszczególnych podstref
   i sektorów. W tym celu należy się zapoznać z uchwałą …" — die Stadt
   selbst verweist für die Grenzen auf den Beschluss, nicht auf ihre Karte.
5. **Der nationale Katalog `dane.gov.pl`** kennt laut Vormessung nur Lublin
   und Kielce; das Krakauer Portal `otwartedane.krakow.pl` lag am 16. September
   nicht auf dem Weg dieser Umgebung. Nicht prüfbar von hier.

Ergebnis: `licenceFamily: 'unklar'`, `attributionRequired: true` (die
strengere Lesart), `licence: 'nicht ausgewiesen'`, `licenceUrl` auf das Item,
`licenceOpen` mit dem Vorbehalt und der Anschrift. Zu fragen ist der **Zarząd
Transportu Publicznego w Krakowie** (ul. Wielopole 1, 31-072 Kraków, Eingang
ul. Starowiślna; `sekretariat@ztp.krakow.pl` — von `ztp.krakow.pl/urzad/kontakt`),
der Eigentümer der Ebenen; fachlich zuständig für den Obszar Płatnego
Parkowania ist der Zarząd Dróg Miasta Krakowa (Biuro Strefy Płatnego
Parkowania, ul. Władysława Reymonta 20, 30-059 Kraków, `strefa@zdmk.krakow.pl`).

## Die Eigenheit, die alles bestimmt: ein Buchstabe und sonst nichts

Kein Feld des Feeds nennt Zeiten, Beträge oder eine Höchstparkdauer. Was die
Stadt erhebt, steht in der Uchwała LXXXIX/2177/17 der Rada Miasta Krakowa vom
22. November 2017 samt acht Änderungen (die Liste steht auf
`zdmk.krakow.pl/parkowanie/strefa-platnego-parkowania/informacje-ogolne-i-oplaty/`)
und, konsolidiert, auf derselben Seite des ZDMK — **Stand 30. April 2026**:

| Podstrefa | Tage | Zeit | 1. Stunde | 2. Stunde | 3. Stunde | ab der 4. |
| --- | --- | --- | --- | --- | --- | --- |
| A | Montag bis Sonntag | 9.00–22.00 | 9,00 zł | 10,00 zł | 11,00 zł | 9,00 zł |
| B | Montag bis Samstag | 9.00–22.00 | 8,00 zł | 9,00 zł | 10,00 zł | 8,00 zł |
| C | Montag bis Samstag | 9.00–22.00 | 7,00 zł | 8,00 zł | 9,00 zł | 7,00 zł |

(Beträge aus `stawki-oplat-w-strefie_od-30-kwietnia-2026_aktualizacja.pdf`
des ZDMK; für Inhaber der Karta Krakowska 6/7/8/6, 5/6/7/5 und 4/4/4/4 zł.)
Dazu drei Regeln, die nur für die Podstrefa A gelten: An **Handelssonntagen**
(niedziele handlowe nach der ustawa z 10 stycznia 2018 r. o ograniczeniu
handlu w niedziele) ist sie frei; an allen anderen Sonntagen kassiert sie —
ausser für Inhaber eines aktiven Status der Karta Krakowska, die ihr
Kennzeichen hinterlegt haben. Gebührenfrei in allen Podstrefen sind die
gesetzlichen Feiertage; die Liste des ZDMK (1.1., 6.1., Ostersonntag und
-montag, 1.5., 3.5., Pfingstsonntag, Fronleichnam, 15.8., 1.11., 11.11.,
24.–26.12.) ist genau die des Kalenders `PL-MA` — ein Test in
`krakau.test.ts` hält das fest. Nichtzahlung kostet 400 zł, binnen sieben
Tagen 200 zł.

Der konsolidierte Text der Uchwała (`scalone-uchwaly_OPP.pdf`, Mai 2026,
55 Seiten) trägt in seinem Grundtext noch „od poniedziałku do soboty w dni
robocze, w godz. 10.00–20.00"; die Änderungen, die daraus 9–22 Uhr und den
Sonntag in A gemacht haben (XLIV/899/25 vom 17. Dezember 2025, XLVII/1005/26
vom 19. März 2026), liegen beim ZDMK nur als **Scan ohne Textebene**. Der
Wortlaut ist von hier deshalb nicht zitierbar; die Seite des ZDMK ist die
Aussage des Betreibers und deckt sich mit dem Tarifblatt.

**Warum nichts davon im Code steht.** Cottbus und Salzburg tragen ihren
Tarif als Konstante aus der Verordnung — in Euro, als Stundensatz, mit
Feiertagen aus dem Kalender. Krakau bräuchte drei Dinge, die es nicht gibt:
`Fee.currency` kennt nur `EUR` und `CHF`; ein Stundensatz kann eine Staffel
9/10/11/9 nicht ausdrücken (`estimateCost` rechnete 3 Stunden zu 27 statt
30 zł); und der Sonntag der Podstrefa A hängt an einem Kalender der
Handelssonntage, den `holidaysFor` nicht führt — die App würde an einem
Handelssonntag „kostet" sagen und an einem gewöhnlichen Sonntag ebenso, nur
einmal zu Recht. Deshalb ist Krakau **Klasse C**: `windows: []`,
`fee: { kind: 'unknown' }`, `scheduleUnknown: true`, `rawHours: ''`,
`rawFee: ''`, und `meta.absent` führt `schedule` und `fee`. Die Oberfläche
sagt „Zeiten unbekannt", färbt grau, zeigt keine Kosten und keinen
Umschaltzeitpunkt. Das Feld `note` trägt, was der Feed weiß: „Sektor 30,
Podstrefa B — seit 10. August 2026 erweitert".

## Drei Ebenen für eine Aussage

Der Datenbau liest die Karte als Flächen, die Erweiterung als Datum und die
Ebene 37 als Gegenprobe:

1. **Karte** (`zones.json`, 23): Jede Zeile wird mit `krakauSektor` gelesen
   (Podstrefa A–D, optional `n`; Nummer als ganze Zahl), der Schlüssel ist
   Buchstabe plus Nummer — so schreibt die Stadt selbst („sektor B30",
   „sektor C7 zaczął funkcjonować od 31 lipca 2020 r."). Eine Zeile mit `n`
   wäre ein geplanter Sektor auf der amtlichen Karte und wird ausgelassen,
   gezählt im Log; heute kommt keine vor.
2. **Erweiterung** (`extension.json`, 4): `Uwagi` wird mit `parseKrakauSince`
   gelesen („Od 10 sierpnia 2026" → `2026-08-10`; zwölf polnische Monate im
   Genitiv, Tag gegen den Kalender geprüft). Ein Polygon ohne Datum wirft.
   Liegt das Datum nach dem Bautag (`KRAKAU_STICHTAG`, Vorgabe heute), wird
   der Sektor nicht ausgeliefert — der tägliche Datenbau holt ihn am Stichtag
   von selbst. Ob ein Sektor **neu** oder **erweitert** ist, entscheidet die
   Fläche: B30 in der Karte hat 75,8 Hektar, das Stück in der Erweiterung
   54,4 — der Sektor gab es schon, Błonia kam dazu. C23, C24 und C31 sind so
   gross wie ihr Stück: neu.
3. **Ebene 37** (`sectors.json`, 26): Geltende und geplante Schlüssel werden
   gezählt und gegen die Karte gehalten. Was die Karte kennt und die Ebene 37
   nicht, steht im Log (heute null); was die Ebene 37 als geplant führt und
   die Karte nicht zeigt, ebenso (heute C32 und C33). Nichts davon ändert die
   Daten — die Karte ist die jüngere Aussage.

Die **Dzielnice** kommen aus dem ISDP der Stadt; `name` ist der polnische
Name (`Stare Miasto`), `bezirk` die römische Nummer (`Dzielnica I`), so wie
Hamburg und Graz das Feld führen. Jeder Sektor bekommt den Bezirk, in dem sein
Mittelpunkt liegt; alle 23 treffen einen (Stare Miasto 5, Grzegórzki 4,
Krowodrza 5, Podgórze 5, Dębniki 2, Zwierzyniec 2).

Was der Datenbau **nicht** liest, obwohl es die Dienste haben:
`Strefa_ulice/0` (571 Straßenlinien mit `Podstrefa`, darunter 20 mit zwei
Buchstaben und dem Warntext „Ulica w części przynależna do podstrefy B (sektor
B10) i podstrefy C (sektor C9)"), `Oznakowanie_strefy_płatnego_parkowania/0`
(145 Schilderpunkte), `Parkomaty_Ewidencja/1` (die Automaten der ZDMK-Karte),
`Tereny_newralgiczne_OPP/1` (eine Warnfläche: „Ulica Wrocławska objęta jest
dwoma różnymi strefami"). Alle sagen dasselbe wie die Sektoren, nur feiner —
und keiner nennt Zeiten oder Tarif.

## Die Zeitangabe, die Höchstparkdauer, die Gebühr

Alle drei: **nicht im Feed.** Es gibt keine Schreibweise zu zählen. Die
Zusicherung, dass das so bleibt, steht in `fixture-shape.test.ts`: Genau
sechs Felder je Ebene, in genau diesen Typen — kommt ein siebtes dazu, fällt
es dort auf, nicht im Datenbau. Und die Werte sind gezählt: A ×7, B ×5,
C ×11 in der Karte; B ×1, C ×3 in der Erweiterung; A ×7, B ×5, C ×8, nB ×1,
nC ×5 in der Ebene 37. Der Wertebereich der Ebene 37 kennt auch `D` und
`nD`; `parseKrakauPodstrefa` nimmt sie an, weil der Dienst sie ankündigt.

## Der Probelauf

```
Krakau — Daten bauen … (Stichtag 2026-09-17)
  districts.geojson: 55 KB
  zones.geojson: 32 KB
  poi.geojson: 0 KB
  umweltzone.geojson: 0 KB
  meta.json: 1 KB

23 Sektoren (7× Podstrefa A, 5× Podstrefa B, 11× Podstrefa C), 18 Dzielnice —
3 neu und 1 erweitert seit der Erweiterung, 0 geplante und 0 künftige
ausgelassen, 0 ohne Bezirks-Treffer
Gegenprobe Ebene 37: 20 geltende und 6 geplante Sektoren; 0 Sektoren der
Karte kennt sie nicht; geplant und nicht ausgeliefert: C32, C33
```

Und mit `KRAKAU_STICHTAG=2026-08-09`, dem Tag vor der Erweiterung: 19
Sektoren, „Sektor B30 gilt in seiner erweiterten Form erst ab 2026-08-10 —
nicht ausgeliefert", C23, C24, C31 ebenso. Dass B30 dann ganz fehlt statt in
seiner alten Grenze, ist eine Grenze der Quelle: Die Karte führt nur die
vereinigte Fläche, die alte steht nirgends. Lieber ein Sektor zu wenig als
eine Fläche, die noch nicht kassiert.

`fetch-data` holt vier Dateien (140.372 + 13.441 + 157.655 + 839.577 Bytes);
der Abruf der Ebene 37 ist **byteweise identisch** mit dem vom 16. September.
`assertDegrees` läuft über alle vier Ebenen; ohne `outSR=4326` antwortet der
Dienst in PUWG 1992 (`wkid 2180`, `xmin 556686.86`, `ymin 235725.04`).

## Feiertage: Małopolska

`PL-MA` stand seit dem 16. September in `holidays.ts` — alles Bundesrecht
(ustawa z dnia 18 stycznia 1951 r. o dniach wolnych od pracy, t.j. Dz. U. z
2025 r. poz. 296, mit Wigilia seit 2025), keine Woiwodschaftsfeiertage. Der
Test `laender.test.ts` misst zwölf Tage; `krakau.test.ts` hält die Liste des
ZDMK dagegen, die dieselben Tage nennt (plus Oster- und Pfingstsonntag, die
das Modell als Sonntage ohnehin nicht führt). Was der Kalender **nicht**
kann: die Handelssonntage der Podstrefa A — siehe „Was offen bleibt".

## Die Auskunftsstelle

Belegt auf `zdmk.krakow.pl/zalatw-sprawe/odholowany-samochod-co-dalej/`
(abgerufen am 17. September): Zuerst die Straż Miejska unter 986 fragen, ob
das Fahrzeug abgeschleppt wurde; die Fahrzeuge stehen auf dem bewachten
Parkplatz ul. Jerzego Turowicza 9, rund um die Uhr (601 213 722), Abholung
nur nach vorheriger Kontaktaufnahme und mit der Freigabe der anordnenden
Stelle; zuständig beim ZDMK der Dział Utrzymania Obiektów Inżynierskich,
12 616 7502 oder 12 616 7535. Eingetragen mit Landesvorwahl (`+48 12 616 7502`),
wie `city.test.ts` es für Städte ausserhalb Deutschlands verlangt.

## Was eingetragen ist

Alle Einträge sind auf diesem Zweig gemacht; hier die Liste, damit ein Merge
weiß, wo er anstößt:

| Datei | Eintrag |
| --- | --- |
| `app/packages/core/src/city.ts` | `KRAKAU`, in `CITIES` |
| `app/packages/core/src/index.ts` | `export * from './krakau.js'` |
| `app/packages/ingest/src/sources.ts` | `krakau: []` in `BY_CITY`, `KRAKAU_ARCGIS`, `KRAKAU_FILES`, `FILES_BY_CITY` |
| `app/packages/ingest/package.json` | `build-data-krakau` |
| `app/packages/core/test/fuzz.test.ts` | Import, Beschuss von `parseKrakauPodstrefa` und `parseKrakauSince`, beide im Zeitbudget |
| `app/packages/core/test/fixture-shape.test.ts` | „Krakauer Fixtures" (drei Ebenen) |
| `app/packages/core/test/city.test.ts` | Rynek Główny, Nowa Huta; Bochnia und Myślenice nicht |
| `app/packages/ingest/test/quellen.test.ts` | „cityFiles für Krakau" |
| `app/apps/web/statistik/main.ts` | `STADTNAMEN.krakau` |
| `NOTICE`, `README.md`, `docs/staedte.md`, `docs/data-sources.md`, `docs/todo.md`, `CLAUDE.md` | Zeile bzw. Abschnitt |
| erzeugt | `core/src/zone-keys.generated.ts`, `core/src/zone-units.generated.ts`, `apps/api/src/zone-units.generated.json` |

Nicht angefasst, wie verabredet: `index.html`, `manifest.webmanifest`,
`login-page.ts`, die Stadtlisten in `deploy.yml`/`kacheln.yml` und die Tests
`flaechenpunkt`/`quellen`/`zone-units` (alle aus `CITIES`).

## Was offen bleibt

1. **Die Lizenz.** Eine Anfrage an den ZTP (oben), ob die Sektorenebenen
   nachgenutzt werden dürfen und unter welchem Vermerk — der Tag „Dane
   Otwarte" am Item deutet es an, der Vorbehalt sagt es nicht. Kommt ein Ja:
   `licence`, `licenceUrl`, `licenceFamily` eintragen, `licenceOpen`
   entfernen, NOTICE und README nachziehen. Kommt ein Nein: Krakau aus
   `CITIES` nehmen; der Abzug bleibt bis dahin hinter dem Beta-Riegel.
2. **Zeiten und Tarif als Modell.** Drei Erweiterungen in `core`, alle
   stadtübergreifend und deshalb hier nicht entschieden: `Fee.currency`
   um `PLN` (und `formatCents` um einen Złoty-Formatierer), eine Staffel
   (`steps: [{ bisMinute, betrag }]`) statt eines Stundensatzes — dieselbe
   Lücke wie bei Paris und Strasbourg im Auslandsbericht — und ein Kalender
   der Handelssonntage für die Podstrefa A (ustawa z 10 stycznia 2018 r. o
   ograniczeniu handlu w niedziele i święta, mehrfach geändert: eine
   Handvoll Sonntage im Jahr, an Monatsenden und vor Ostern und Weihnachten
   festgemacht — wie Buss- und Bettag eine bewegliche Regel, siehe den
   Kommentar über `REGIONAL`; der Wortlaut der geltenden Fassung ist vor dem
   Eintragen zu lesen, nicht zu erinnern). Erst dann kommen die Werte aus
   der Tabelle oben als Konstante, mit Quellenvermerk wie in Cottbus.
3. **Sektoren 32 und 33.** In der Ebene 37 geplant, auf der Karte nicht.
   Erscheinen sie in `Granice_Stref_2026`, baut der tägliche Lauf sie mit
   und `fetch-data` meldet „+2 gegenüber sources.ts" — dann
   `expectedFeatures: 23` nachziehen. Ein Datum dafür nennt keine Quelle.
4. **Die alte Grenze eines erweiterten Sektors.** Vor dem Stichtag einer
   künftigen Erweiterung fehlt ein erweiterter Sektor ganz (siehe
   Probelauf). Käme die Stadt mit einer weiteren Erweiterung, wäre die
   Ebene 37 — falls sie dann nachgezogen ist — die Quelle der alten Grenze.
5. **Die Straßenlinien.** `Strefa_ulice/0` weiß, welche Straßenseite zu
   welcher Podstrefa gehört, und warnt bei zwanzig Straßen mit zwei
   Podstrefen. Für den Klick auf die Karte wäre das die genauere Auskunft
   als das Sektorpolygon; für die Ortung nicht (Linien treffen nichts).
6. **`otwartedane.krakow.pl`.** Aus dieser Umgebung nicht erreichbar. Steht
   der Datensatz dort mit Lizenz, wäre das die Antwort auf Punkt 1 — von
   einem Rechner mit freiem Netz in fünf Minuten nachzusehen.
7. **PMTiles-Kacheln.** `scripts/build-tiles.sh` nimmt den Ausschnitt aus
   `KRAKAU.reportBounds`; gebaut und hochgeladen ist noch nichts.

## Prüfstand

```bash
cd app
pnpm -r typecheck                                  # grün, alle vier Pakete
pnpm test                                          # grün
CITY=krakau pnpm --filter @knoellchenfrei/ingest fetch-data          # 4 Dateien
CITY=krakau pnpm --filter @knoellchenfrei/ingest build-data-krakau   # 23 Sektoren, 18 Dzielnice
cd .. && ./scripts/sprache-pruefen.sh && node scripts/doku-pruefen.mjs \
  && ./scripts/namen-pruefen.sh && ./scripts/commit-pruefen.sh      # grün
```

Nicht gelaufen: die E2E-Suite (läuft zentral) und der Kachelbau.

## Dateien

| Datei | Inhalt |
| --- | --- |
| `app/packages/core/src/krakau.ts` | Podstrefa- und Nummernleser, Schlüssel, Datum der Erweiterung, Satz unter der Zone, Rohfeld-Typen zweier Feldschemata |
| `app/packages/core/test/krakau.test.ts` | 26 Tests: jeder Wert der drei Ebenen, Unfug, die drei Ebenen gegeneinander, Klasse C im Tarifmodell, Feiertage gegen die Liste des ZDMK |
| `app/packages/core/test/fixtures/krk-granice-stref-2026-09-17.json` | alle 23 Attributzeilen der Karte, wörtlich |
| `app/packages/core/test/fixtures/krk-poszerzenie-2026-09-17.json` | alle 4 Zeilen der Erweiterung |
| `app/packages/core/test/fixtures/krk-sektory-2026-09-17.json` | alle 26 Zeilen der Ebene 37 |
| `app/packages/ingest/src/build-data-krakau.ts` | der Datenbau, mit `KRAKAU_STICHTAG` |
| `app/apps/web/public/data/krakau/` | `zones.geojson`, `districts.geojson`, leere `poi.geojson` und `umweltzone.geojson`, `meta.json` |
