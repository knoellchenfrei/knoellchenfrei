# Innsbruck als achte Stadt — gemessen, entschieden, offen

> **Wo der Code liegt.** Parser in `app/packages/core/src/innsbruck.ts`,
> Datenbau in `app/packages/ingest/src/build-data-innsbruck.ts`, Quellen in
> `sources.ts` als `INNSBRUCK_FILES`, Stadt als `INNSBRUCK` in `core/city.ts`,
> Tests in `core/test/innsbruck.test.ts` (51) und in `fixture-shape.test.ts`,
> `fuzz.test.ts`, `city.test.ts`, `ingest/test/quellen.test.ts`. Die Daten
> liegen eingecheckt unter `app/apps/web/public/data/innsbruck/`.

> **Stand 16. September 2026.** Innsbruck ist angeschlossen — die erste Stadt
> außerhalb Deutschlands und die erste ohne WFS. Was fehlt, steht unter „Was
> offen bleibt": eine E-Mail an die Stadt, die die Nutzungsbedingung verlangt,
> und der 2. November 2026, an dem der heutige Stand verfällt.

Alle Zahlen hier sind an diesem Tag gegen die Dienste selbst gemessen, nicht
aus [staedte-recherche-2026-09-16.md](staedte-recherche-2026-09-16.md)
übernommen. Wo die Messung von der Recherche abweicht, steht es dabei.

## Die Quellen

| | Parkzonen | Stadtteile | Gemeindegrenze (nur für den Rahmen) |
| --- | --- | --- | --- |
| Art | ArcGIS FeatureServer, `f=geojson&outSR=4326` | ArcGIS FeatureServer, ebenso | ArcGIS MapServer, `returnExtentOnly` |
| Adresse | `https://services8.arcgis.com/LxSaGwss445axp1E/arcgis/rest/services/Parkzonen_WGS84/FeatureServer/0` | `…/statistik_06_v/FeatureServer/0` | `https://gis.tirol.gv.at/arcgis/rest/services/Service_Public/ogd_basis/MapServer/45` |
| Eigentümer | `geoHub_Innsbruck`, Organisation „Stadtmagistrat Innsbruck", Item `22d0f281143d4b08970b3dcb275b66e0` | derselbe Hub, Ebene `stadtteile` | Land Tirol, tiris, Ebene „Gemeinden" |
| Umfang | **21** Polygone (20 `Polygon`, 1 `MultiPolygon`), 15.712 Stützpunkte | **20** Stadtteile, 9.201 Stützpunkte | 1 Polygon, `GEMOESTAT` 70101, 3.029 Stützpunkte |
| Inhalt | `FID`, `BEZEICH`, `INFO`, `Shape__Area`, `Shape__Length` | `OBJECTID`, `STNEU`, `Stadtteil_1`, `Area_km2` | `GEMNAME`, `BEZNAME`, `STAND` |
| Lizenz | Nutzungsbedingung des Hubs, wörtlich unten | dieselbe | nicht übernommen — nur vier Zahlen gerundet |
| Aktualität | `dataLastEditDate` 2026-06-18 (Layer), Item `modified` 2021-09-28 | `dataLastEditDate` 2024-05-27 | `STAND` 2026-03-31 |

**Zwei Korrekturen an der Recherche.** Erstens: Die Lizenz ist **belegt**, nur
nicht am Item. `licenseInfo` und `accessInformation` des ArcGIS-Items sind
leer, und der data.gv.at-Eintrag `8ffd16df-…` ist über die piveau-Suche des
Portals (`/api/hub/search/search?q=Parkzonen`) nicht mehr auffindbar — drei
Treffer, alle aus Linz; die Stadt Innsbruck hat dort 40 Datensätze, aber keine
Parkzonen. Die Bedingungen stehen eine Ebene höher: Der Hub hat eine Seite
`nutzungsbed` (Item `88ed2c88e37e4b3ab4d2676214acc213`), und deren Text
beginnt mit „Die Daten der Stadt Innsbruck". Zweitens: Der zweite ArcGIS-Host
der Recherche (`services.arcgis.com/aiZ6IleXsHSbsd6b/…/Parkenplatz`) ist
**Gütersloh**, nicht Innsbruck — die Suche eines ArcGIS-Hubs ist nicht auf die
eigene Organisation begrenzt; das Kriterium ist der Eigentümer.

## Die Lizenz, wörtlich

Aus <https://geohub-1-magibk.hub.arcgis.com/pages/nutzungsbed>, abgerufen am
16. September 2026:

> Die Daten der Stadt Innsbruck stehen unter einer offenen Lizenz vergleichbar
> mit "Creative Commons Namensnennung 4.0" (CC-BY 4.0). Bei Verwendung der
> Datensätze ist die Landeshauptstadt Innsbruck als Datenquelle anzugeben. Die
> Namensnennung der Stadt Innsbruck als Rechteinhaber hat in folgender Weise
> zu erfolgen: "Datenquelle: Stadt Innsbruck"
>
> Lizenznehmer, die Daten / Pläne der Stadt Innsbruck für ihre öffentlichen
> Anwendungen / Dienste verwenden, verpflichten sich, die Stadt Innsbruck
> unter post.vermessung-gis@innsbruck.gv.at darüber zu informieren, wo diese
> Anwendungen / Dienste zu finden sind und wofür die Nutzung erfolgt.
>
> Daten / Pläne der Stadt Innsbruck dürfen nicht für Anwendungen oder
> Veröffentlichungen verwendet werden, die im Nahebereich von kriminellen,
> illegalen, rassistischen, diskriminierenden, verleumderischen oder
> pornographischen Aktivitäten positioniert sind.
>
> Alle Informationen zu und aus der Bereitstellung der Daten erfolgen ohne
> jegliche Gewähr und Haftungsansprüche. Datenfehler können nie gänzlich
> ausgeschlossen werden.

Das Impressum desselben Hubs (Item `b1c6419654204e72910c3d591f3fe67f`) nennt
als Medieninhaber die „Landeshauptstadt Stadt Innsbruck, Maria-Theresien-Straße
18, 6020 Innsbruck", als Umsetzer das Referat Vermessung-GIS und als
Datenpartner für „Parkzonen" die **Parkraumbewirtschaftung (Stadt Innsbruck)**.

**Die Entscheidung:** `licenceFamily: 'cc-by'`, nicht `'unklar'`. Die
Nutzungsbedingung ist keine der bekannten Lizenzen wörtlich, aber sie ist da,
sie nennt CC BY 4.0 als Maß, und die beiden Auflagen, an denen die Oberfläche
hängt, sind dieselben: Nennung in vorgeschriebener Form
(`attribution.source` = `Datenquelle: Stadt Innsbruck`, wörtlich) und der
Hinweis auf fehlende Gewähr. Ein Banner „Lizenz ungeklärt" wäre hier eine
falsche Aussage — geklärt ist sie; was CC BY nicht kennt, ist die
**Mitteilungspflicht**, und die ist eine Handlung des Betreibers, nicht eine
Unklarheit der Lizenz. `city.test.ts` kennt die Seite deshalb ausdrücklich als
`cc-by`-Beleg; `licenceUrl` zeigt auf die Nutzungsbedingung, nicht auf
creativecommons.org.

## Die Eigenheit, die alles bestimmt: ein Feld für alles

Der Feed hat fünf Felder, und zwei davon tragen alles:

| `BEZEICH` | Anzahl |
| --- | --- |
| `Parkstraße kostenpflichtig (werktags)` | 6 |
| `Kurzparkzone 180 min kostenpflichtig` | 5 |
| `Parkstraße kostenpflichtig (täglich)` | 5 |
| `Kurzparkzone 90 min kostenpflichtig` | 2 |
| `Kurzparkzone kostenfrei 180 min 1-5 Uhr` | 2 |
| `Parkstraße kostenpflichtig (werktags/täglich)` | 1 |

| `INFO` | Anzahl |
| --- | --- |
| `werktags Mo-Fr von 9-19 Uhr, EUR 1.10 erste halbe Stunde, danach gleicher Tarif in EUR 0.10 - Schritten, jedoch höchstens EUR 9 pro Kalendertag` | 6 |
| `werktags Mo-Fr von 9-19 Uhr, EUR 1.10 erste halbe Stunde, danach gleicher Tarif in EUR 0.10 - Schritten` | 5 |
| `täglich von 9-19 Uhr, EUR 1.10 erste halbe Stunde, danach gleicher Tarif in EUR 0.10 - Schritten, jedoch höchstens EUR 9 pro Kalendertag` | 4 |
| `werktags Mo-Fr von 9-21 Uhr und Sa von 9-13 Uhr, EUR 1.10 erste halbe Stunde, danach gleicher Tarif in EUR 0.10 - Schritten` | 2 |
| `täglich von 1-5 Uhr, kostenfrei` | 2 |
| `täglich (1.5. bis 31.8.) bzw. werktags Mo-Fr (1.9. bis 30.4.) von 9-19 Uhr, EUR 1.10 erste halbe Stunde, danach gleicher Tarif in EUR 0.10 - Schritten, jedoch höchstens EUR 9 pro Kalendertag` | 1 |
| `täglich von 9-19 Uhr, EUR 0.50 erste halbe Stunde, danach gleicher Tarif in EUR 0.10 - Schritten, ab 4. Stunde EUR 1 je halbe Stunde in EUR 0.10 - Schritten (auch dann, wenn Parkvorgang über abgabenfreie Zeit hinaus fortgesetzt wird)` | 1 |

Sieben Werte, 21 Zonen, der längste 233 Zeichen. Kein eigenes Zeitfeld, kein
eigenes Gebührenfeld, kein Name — `FID` (132 bis 152) ist der einzige
Schlüssel. Der Schnitt zwischen Zeit und Gebühr liegt am **Komma nach
„Uhr"**; davor der Zeitteil, dahinter der Betrag oder „kostenfrei".
`parseInnsbruckInfo` macht diesen Schnitt, `parseInnsbruckSchedule` und
`parseInnsbruckTariff` lesen die Hälften, jede mit eigener Grammatik, und
jede Zone des Abzugs geht durch — der Test hält alle sieben Werte mit ihrer
Häufigkeit fest.

## Die Zeitangabe: vier Schreibweisen

| Zeitteil | Zonen | Fenster |
| --- | --- | --- |
| `werktags Mo-Fr von 9-19 Uhr` | 11 | Mo–Fr 9–19 |
| `täglich von 9-19 Uhr` | 5 | Mo–So 9–19 |
| `werktags Mo-Fr von 9-21 Uhr und Sa von 9-13 Uhr` | 2 | Mo–Fr 9–21, Sa 9–13 |
| `täglich von 1-5 Uhr` | 2 | Mo–So 1–5 |
| `täglich (1.5. bis 31.8.) bzw. werktags Mo-Fr (1.9. bis 30.4.) von 9-19 Uhr` | 1 | Mo–So 9–19 **plus Saisonregel** |

**„werktags" ist hier Montag bis Freitag.** Der Feed schreibt die Spanne dazu
(`werktags Mo-Fr`), und die Stadt sagt es auf `innsbruck.gv.at/parken`
(16. September): „Die 180-Minuten-Kurzparkzonen sind von Montag bis Freitag von
9.00 bis 19.00 Uhr kostenpflichtig." Hamburgs Lesart — „werktags" schließt den
Samstag ein — wäre hier an elf Zonen falsch. Ein nacktes `werktags` ohne
Spanne weist der Parser deshalb mit Begründung ab, statt eine der beiden
Lesarten zu wählen; ein Test hält das fest. Und die Bezeichnung liefert eine
Gegenprobe: `(täglich)` in `BEZEICH` muss zu einem Fenster mit Sonntag führen,
`(werktags)` zu einem ohne — für alle 21 Zeilen geprüft.

### Die Saisonregel

Eine Zone — `FID` 134, 1,13 km², in Pradl, laut Pressemitteilung die „Zone N
(Tivoli)" — kassiert im Sommer täglich und im Winter nur Mo–Fr. `ChargeWindow`
kennt keinen Kalender. Drei Wege standen offen:

1. **Nur Mo–Fr** (das Ganzjährige) und die Klausel als Zusatzregel: Im Sommer
   sagte die App am Wochenende „frei", wo kassiert wird — das kostet ein
   Knöllchen.
2. **Täglich** (die Vereinigung) und die Klausel als Zusatzregel: Im Winter
   sagt die App am Wochenende „kostet", wo es frei ist — das kostet niemanden
   etwas außer einen Blick auf das Schild.
3. Die Zone auslassen: Dann sagte die App an jedem Werktag „außerhalb der
   Parkraumbewirtschaftung" — die schlechteste der drei Antworten.

Genommen ist der zweite Weg. Die Klausel steht wörtlich in `unmodelledRules`,
das Panel zeigt sie als „Zusatzregel, die hier nicht berechnet wird", und
`isUncertainAt` schlägt nicht an, weil das Berlins Adventsregel vorbehalten
ist. Der saubere Weg wäre ein Gültigkeitszeitraum am Fenster
(`ChargeWindow.validFrom`/`validTo` als `MM-TT`) — eine Änderung an `core`,
dem Web und den Fuzz-Invarianten, für eine Zone. Sie steht unter „Was offen
bleibt".

## Die Höchstparkdauer

Sie steht nicht im `INFO`, sondern in `BEZEICH`: `180 min` (7 Zonen), `90 min`
(2), nichts (12 Parkstraßen — dort darf man stehen, solange man zahlt; das ist
`undefined`, nicht 0). `parseInnsbruckMaxStay` liest `min` nur als eigenes
Wort (`(?![\p{L}])`, Münchens Lehre), weist `0 min` als „Parken verboten" und
mehr als 1440 als „keine Kurzparkzone" ab.

## Die Entscheidung zur Gebühr

**Der Betrag gilt je halbe Stunde.** „EUR 1.10 erste halbe Stunde, danach
gleicher Tarif in EUR 0.10 - Schritten" heißt 2,20 € je Stunde; wer 1,10 als
Stundensatz läse, hielte Innsbruck für halb so teuer. Drei Tarife im Abzug:

| Tarif | Zonen | `Fee` |
| --- | --- | --- |
| 1,10 € je halbe Stunde | 18 | `exact`, 220 Cent/h |
| 0,50 € je halbe Stunde bis zur 3., ab der 4. Stunde 1,00 € (Waldparkplatz, `FID` 132) | 1 | `range`, 100–200 Cent/h |
| kostenfrei | 2 | `disc` |

Der **Tagesdeckel** „jedoch höchstens EUR 9 pro Kalendertag" (11 Zonen) hat im
Modell keinen Platz; er steht als Satz in `note` („höchstens 9,00 € je
Kalendertag"), ebenso der Tarifsprung. Der Gebührenteil wird Baustein für
Baustein abgetragen — nicht an Kommas zerschnitten, weil der Nebensatz „(auch
dann, wenn Parkvorgang über abgabenfreie Zeit hinaus fortgesetzt wird)" selbst
ein Komma trägt —, und was übrig bleibt und kein Baustein ist, wirft. Ein
Dezimalkomma wirft ebenfalls: Der Feed schreibt Punkt, und eine neue
Schreibweise soll auffallen.

**„kostenfrei" ist nicht null Euro.** Die beiden Zonen „Kurzparkzone kostenfrei
180 min 1-5 Uhr" in den Gewerbegebieten Roßau und Mühlau/Arzl sind nachts
Kurzparkzonen mit drei Stunden Höchstparkdauer; die Ankunft ist nach § 1 der
Kurzparkzonen-Überwachungsverordnung (BGBl. Nr. 857/1994 i. d. F. BGBl. II
Nr. 145/2008, RIS-Dokument `NOR40097866`) mit einem Kurzparknachweis zu
belegen — „1. Parkscheibe, 2. Parkschein, … 6. elektronische
Kurzparknachweise". Das ist Hamburgs `disc`, mit derselben Begründung: Wer
ohne Scheibe steht, zahlt. Ein Betrag von `EUR 0` bricht ab, wie in jedem
anderen Gebührenparser dieses Projekts.

Die Währung ist der Euro; `Fee.currency` bleibt leer, wie bei den deutschen
Städten. Die Stadt bestätigt den Tarif auf ihrer Seite nicht in Zahlen — sie
verweist auf den Stadtplan, der genau diesen Feed zeichnet.

## Die Stadtteile und der Rahmen

Der Hub führt die 20 statistischen Stadtteile in **sechzehn** Ebenen — je eine
Statistik (`statistik_01_v` bis `statistik_14`) mit ihren Kennzahlen, dazu
`statistik_06_v/0` als `stadtteile` ohne Beiwerk. Genommen ist die letzte.
Ihr Umriss deckt das ganze Gemeindegebiet: 11,3016–11,4560 / 47,2108–47,3601,
auf vier Stellen dieselben Zahlen wie die Gemeindegrenze aus tiris
(11,3006–11,4580 / 47,2107–47,3606). Der Datenbau trifft mit jedem der 21
Zonen-Mittelpunkte einen Stadtteil: Hötting 3, Pradl 3, Hötting West 3,
Wilten 2, Saggen 2, Amras, Hungerburg, Dreiheiligen - Schlachthof, Innenstadt,
Gewerbegebiet Roßau, Gewerbegebiet Mühlau / Arzl, Sieglanger - Mentlberg,
Mühlau je 1.

`reportBounds` kommt aus der Gemeindegrenze, nach außen gerundet:
11,30–11,46 / 47,21–47,37. Die Parkzonen reichen nur bis 47,29° Nord; wer den
Rahmen daraus nähme, wiese Igls und die Hungerburg ab — und die Hungerburg
wird am 2. November selbst eine Parkstraße. Zu München (ab 48,05° Nord) bleibt
fast ein Grad Abstand; der Paartest in `city.test.ts` ist grün.

## Der Probelauf

```
CITY=innsbruck pnpm --filter @knoellchenfrei/ingest fetch-data
  Stadt: innsbruck — 0 Quellen nach …/.raw/innsbruck
  zones (Datei) … 569579 Bytes
  districts (Datei) … 333886 Bytes

CITY=innsbruck pnpm --filter @knoellchenfrei/ingest build-data-innsbruck
  Innsbruck — Daten bauen …
    districts.geojson: 29 KB
    zones.geojson: 72 KB
    poi.geojson: 0 KB
    umweltzone.geojson: 0 KB
    meta.json: 1 KB

  21 von 21 Zonen übernommen, 20 Stadtteile — 0 unlesbar ausgelassen,
  1 mit Saisonregel, 0 ohne Stadtteil-Treffer
```

`fetch-data` prüft bei den beiden Dateien seit heute dieselbe 95-%-Schwelle
wie bei WFS-Quellen (`FileSource.expectedFeatures`) und bricht ab, wenn der
Dienst `exceededTransferLimit` setzt — ein ArcGIS-Server kürzt bei
`maxRecordCount` still und sagt es nur in diesem Feld. Der Datenbau hält mit
`assertDegrees`, dass Grade kommen: Ohne `outSR=4326` antwortet die
Stadtteil-Ebene in Web Mercator (`wkid` 102100), mit Zahlen um 1.268.000, die
nach nichts Falschem aussehen.

Eine unlesbare Zone wird **ausgelassen und mit Grund genannt**, nicht
geraten und nicht zum Abbruch — bei 21 Zonen ist jede Auslassung im Log ein
Grund nachzusehen, und eine neue Formulierung im Feed soll eine Zone kosten,
nicht die Stadt.

## Feiertage: Tirol

Alles Bundesrecht — § 7 Abs. 2 Feiertagsruhegesetz 1957, dreizehn Tage, in
`holidays.ts` seit dem 16. September als `NATIONWIDE.AT` mit leerem
regionalen Eintrag für `AT-T`. Der Tiroler Landespatron Josef (19. März) ist
kein gesetzlicher Feiertag nach diesem Gesetz, Karfreitag seit 2019 nur ein
„persönlicher Feiertag". Beides steht als Test: Am 19. März 2027 (Freitag) und
am Karfreitag 2027 kassiert die Kurzparkzone; am 26. Oktober 2026
(Nationalfeiertag, Montag) ist sie frei, und dieselbe Zone mit `land: 'BE'`
kassierte. Nichts an `holidays.ts` war zu ändern.

## Was einzutragen war

Alles ist eingetragen; die Liste, damit der Merge weiß, wo:

| Datei | Eintrag |
| --- | --- |
| `core/src/city.ts` | `INNSBRUCK`, in `CITIES` als achte |
| `core/src/index.ts` | `export * from './innsbruck.js'` |
| `ingest/src/sources.ts` | `FileSource.expectedFeatures?`, `INNSBRUCK_FILES`, `FILES_BY_CITY`, `innsbruck: []` in `BY_CITY` |
| `ingest/src/fetch.ts` | Schwelle und `exceededTransferLimit` für Dateien mit `expectedFeatures` |
| `ingest/package.json` | `build-data-innsbruck` |
| `core/test/city.test.ts` | Nutzungsbedingung als `cc-by`-Beleg, `OHNE_BELEG` um `innsbruck`, Hall in Tirol / Goldenes Dachl |
| `core/test/fuzz.test.ts` | vier Beschuss-Läufe, Zeitbudget über neun Parser |
| `core/test/fixture-shape.test.ts` | „Innsbrucker Fixture", fünf Felder |
| `ingest/test/quellen.test.ts` | `innsbruck` in der srsName-Liste, `describe('cityFiles')` |
| `ingest/test/zone-units.test.ts` | Stadtliste um `innsbruck` |
| `apps/web/test/flaechenpunkt.test.ts` | Stadtliste um `innsbruck`, Untergrenze 700 |
| `apps/web/statistik/main.ts` | `STADTNAMEN.innsbruck` |
| `.github/workflows/deploy.yml`, `kacheln.yml` | Stadtlisten (in `kacheln.yml` beide) |
| `NOTICE`, `README.md`, `docs/staedte.md`, `docs/data-sources.md`, `docs/todo.md`, `CLAUDE.md` | Zeile bzw. Abschnitt |
| erzeugt | `zone-keys.generated.ts`, `zone-units.generated.ts`, `apps/api/src/zone-units.generated.json` |

Nicht angefasst, wie verabredet: `index.html`, `manifest.webmanifest`,
`login-page.ts`.

## Was offen bleibt

1. **Die Mitteilung an die Stadt.** Die Nutzungsbedingung verlangt sie von
   jedem, der die Daten in einer öffentlichen Anwendung nutzt: eine E-Mail an
   `post.vermessung-gis@innsbruck.gv.at` mit Adresse und Zweck. Sie gehört
   vor das Öffnen des Riegels und steht in [todo.md](todo.md) beim Betreiber.
2. **Der 2. November 2026.** Die Pressemitteilung vom 16. Juli 2026
   („Innsbruck stellt die Parkraumbewirtschaftung neu auf",
   `presse.innsbruck.gv.at`, `id=245290`) nennt: Kurzparkzonen und
   Parkstraßen **Mo–Fr 8–21 Uhr, Sa 8–18 Uhr**; drei neue Parkstraßen Arzl,
   Olympisches Dorf, Kranebitten, Tageskarte dort 9 €; Kurzparkzonentarife
   unverändert; Schloss Ambras, Alpenzoo, Hungerburg, Waldparkplatz Hawaii,
   Parkplatz Kranebitten und Zone N (Tivoli, 1.5. bis 31.8.) „täglich von
   8.00 bis 21.00 Uhr"; Anwohnerparkkarte von 6,18 auf 9,96 € je Monat. Die
   Stadtseite sagt dazu: „Die folgenden Informationen auf dieser Seite gelten
   noch bis 2. November 2026." Ausgeliefert wird, was heute gilt — der Feed
   trägt die alten Zeiten, und ein Datenbau, der Beträge aus einer
   Pressemitteilung nähme, wäre der Fehler, den Köln gerade vermeidet. Am
   Stichtag: `fetch-data`, die sieben `INFO`-Werte neu zählen, den Parser
   gegen die neuen Texte halten. Zieht die Stadt den Feed nicht nach, sagt
   die App ab 8 Uhr „frei", wo kassiert wird — dann gehört Innsbruck aus
   `CITIES`, bis er stimmt.
3. **Ein Kalender am Fenster** für die Saisonregel der Zone am Tivoli
   (`ChargeWindow.validFrom`/`validTo`). Bis dahin die Vereinigung der Tage
   plus Zusatzregel, siehe oben.
4. **Keine Auskunftsstelle für umgesetzte Fahrzeuge.** Die Suche auf
   `innsbruck.gv.at` liefert zu „abgeschleppt" keine Seite; die Seite der
   Parkraumbewirtschaftung sagt „Nicht zuständig für: Strafen". Ohne Beleg
   fehlt `towedVehicles`, die App zeigt den Abschnitt nicht.
5. **Kein Katalogeintrag mehr.** Der data.gv.at-Eintrag ist verschwunden;
   sollte die Stadt den Datensatz dort neu einstellen, trägt er vermutlich eine
   maschinenlesbare Lizenz — dann `licence`/`licenceUrl` nachziehen.
6. **Der Zonenschlüssel ist `FID`.** Über den Abzug eindeutig, über
   Neuausgaben nicht garantiert. `zone-keys-aktuell.test.ts` bemerkt einen
   Sprung; was dann mit gezählten Meldungen geschieht, ist dieselbe Frage wie
   bei Hamburgs Flächenkennungen.

## Prüfstand

Am 16. September 2026 in diesem Worktree grün:

```
cd app && pnpm -r typecheck          # alle vier Pakete
cd app && pnpm test                  # core 918, ingest 55, api 101, web 304
./scripts/sprache-pruefen.sh
node scripts/doku-pruefen.mjs
./scripts/namen-pruefen.sh
./scripts/commit-pruefen.sh
```

Nicht gelaufen, absichtlich: die E2E-Suite (läuft zentral) und der Kachelbau.

## Dateien

| Datei | Inhalt |
| --- | --- |
| `app/packages/core/src/innsbruck.ts` | Parser: `parseInnsbruckInfo`, `parseInnsbruckSchedule`, `parseInnsbruckTariff`/`parseInnsbruckFee`, `parseInnsbruckMaxStay`, `innsbruckZoneNote`, `InnsbruckParseError`, `InnsbruckZoneProperties` |
| `app/packages/core/test/innsbruck.test.ts` | 51 Tests: jeder Wert des Abzugs, Unfug, Tarifmodell, Feiertage, Stadtgrenzen |
| `app/packages/core/test/fixtures/ibk-parkzonen-2026-09-16.json` | Der ganze Sachdatenteil des Abzugs (21 Zeilen), ohne Geometrie |
| `app/packages/ingest/src/build-data-innsbruck.ts` | Datenbau |
| `app/apps/web/public/data/innsbruck/` | `zones.geojson` (21), `districts.geojson` (20), leere `poi.geojson` und `umweltzone.geojson`, `meta.json` |
