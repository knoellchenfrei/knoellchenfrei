# Salzburg als achte Stadt — gemessen, entschieden, offen

> **Wo der Code liegt.** Parser in `app/packages/core/src/salzburg.ts`,
> Datenbau in `app/packages/ingest/src/build-data-salzburg.ts`, Abzug unter
> `app/apps/web/public/data/salzburg/`, Tests in
> `app/packages/core/test/salzburg.test.ts`. Die gemeinsamen Dateien
> (`city.ts`, `sources.ts`, `index.ts`, Workflows, `NOTICE`, `README.md`) sind
> eingetragen; Salzburg ist damit **angeschlossen**, nicht nur vorbereitet.

> **Stand 16. September 2026.** Die erste Stadt außerhalb Deutschlands und die
> erste unter CC BY **3.0**. Was offen bleibt, steht unten — vor allem die
> Frage, ob der Katalogeintrag mit „BY-SA" oder der Dienst mit „BY" recht hat.

Alle Zahlen hier sind an diesem Tag gegen den Dienst selbst gemessen, nicht
aus [docs/staedte-recherche-2026-09-16.md](staedte-recherche-2026-09-16.md)
übernommen. Wo die Messung von der Recherche abweicht, steht es dabei — und
sie weicht dreimal ab: Der Host war erreichbar, der Tippfehler im Feed war
behoben, und die Zählung der Arten hatte sich verschoben.

## Die Quellen

Ein Dienst, ein Arbeitsbereich, 81 Typnamen — anders als Frankfurt, München
und Düsseldorf liegen die Stadtteile im selben Dienst wie die Parkzonen.

| | Kurzparkzonen | Stadtteile | Behindertenstellplätze |
| --- | --- | --- | --- |
| Art | WFS 2.0.0 (GeoServer) | dito | dito |
| Adresse | `https://data.stadt-salzburg.at/geodaten/wfs` | dito | dito |
| Typname | `ogdsbg:kurzparkzone` | `ogdsbg:stadtteil` | `ogdsbg:behindertenstellplatz` |
| Umfang | `numberMatched="41"` (timeStamp 2026-09-16T16:40:21Z) | 145, davon 132 in Salzburg | 185 |
| Inhalt | Name, Art, Zeiten als Satz, Höchstparkdauer, Geltung, Bewohnerparkzone, MultiPolygon | Gemeinde, Stadtteil, Ortsteil, Landschaftsraum, MultiPolygon | Bezeichnung, Adresse, Plätze, Euroschlüssel, Punkt |
| Lizenz | `ows:AccessConstraints`: „Datenquelle: Stadt Salzburg – data.stadt-salzburg.at; Nutzungsbedingungen: CC BY 3.0 AT (https://creativecommons.org/licenses/by/3.0/at/deed.de)"; `ows:Fees: NONE` | dito (ein Dienst, eine Angabe) | dito |
| Aktualität | `GILT_VON` bis 2026-04-12, `GILT_BIS` durchweg 2049-12-30; Katalog `modified` 2016-12-09 | — | — |

`DefaultCRS` ist bei jeder Ebene `urn:ogc:def:crs:EPSG::31255` (MGI /
Gauß-Krüger M31). Ausgabeformate laut `GetCapabilities`: `application/json`,
`json`, `csv`, `SHAPE-ZIP`, `KML`, GML 2/3/3.2 — Hamburgs
`application/geo+json` steht nicht darin.

**Drei Korrekturen an der Recherche vom Vormittag:**

1. **Der Host war erreichbar.** Um 10:38 UTC lehnte der Egress-Proxy den
   CONNECT nach `data.stadt-salzburg.at` ab (`connect_rejected`), und die
   Recherche lief über WebFetch. Um 16:40 UTC antworteten `curl` (mit dem
   certifi-Bundle) und Nodes `fetch` mit `NODE_USE_ENV_PROXY=1` beide mit 200
   — und Nodes `fetch` **ohne** das Flag auch. `fetch-data` hat die drei Ebenen
   ohne Umweg geholt; der Abzug in `.raw/salzburg/` und die Dateien unter
   `public/data/salzburg/` stammen aus genau diesem Lauf, nicht aus einer
   Kopie. Sollte der Proxy wieder zumachen, lässt der Deploy den eingecheckten
   Abzug stehen; das ist dort so vorgesehen.
2. **Der Tippfehler war weg.** Am Vormittag stand in `ART` 13-mal
   „Gebährenpflichtige Kurzparkzone"; am Nachmittag 11-mal
   „Gebührenpflichtige Kurzparkzone". Die Stadt hat den Feed zwischen den
   beiden Abrufen angefasst — auch die Zählung ist anders (28/13 → 30/11,
   Zeitangaben 21/13/6/1 → 24/11/5/1), bei gleicher Gesamtzahl 41.
   `salzburgArtMatchesRule` hält beide Felder trotzdem gegeneinander, und der
   Test führt die alte Schreibweise als Beispiel dafür, was er finden soll.
3. **`STATUS_HINWEIS` und `UNTERGRUPPE`** gibt es auch; die Recherche nannte
   sie nicht. Das erste ist 41-mal null, das zweite 22-mal null, 14-mal
   „Gemeindestraße", 5-mal „Landesstraße".

## Die Eigenheit, die alles bestimmt: der Tarif steht in der Verordnung

Kein Feld der 41 Zonen nennt einen Betrag. Die Stadt legt ihn per Verordnung
für die ganze Stadt fest, und die Verordnung ist öffentlich:

> **Parkgebührenverordnung der Stadt Salzburg (Parkgebührenverordnung 1990)
> idF der 22. Novelle, Abl Nr 98/2025**
> § 2 Höhe der Parkgebühr — (1) Die Höhe der Parkgebühr wird mit 1,10 € für
> jede halbe Stunde festgesetzt.
> § 7 Inkrafttreten — Diese Verordnung tritt mit 1. Jänner 2026 in Kraft.

Quelle: <https://www.stadt-salzburg.at/fileadmin/user_upload/04013/parkgebuehrenverordnung_homepage_-_version_22._novelle_ohne_plaene.pdf>
(PDF, 2 Seiten, 67.766 Bytes, abgerufen am 16. September 2026; verlinkt von
<https://www.stadt-salzburg.at/gesetz-parken/>, die noch auf die 21. Novelle
zeigt). Die Bürgerseite <https://www.stadt-salzburg.at/kurzparkzone> sagt
dasselbe in Prosa: „Preis: 1 Stunde = 2,20 Euro. Maximale Parkzeit: 3 Stunden
= 6,60 Euro" und „Die Gebührenpflicht gilt von Montag bis Freitag jeweils von
9–19 Uhr. An Samstagen können Sie in gebührenpflichtigen Kurzparkzonen gratis
parken – von 9-16 Uhr aber maximal 3 Stunden lang. Sie benötigen in dieser Zeit
eine korrekt eingestellte Parkscheibe. An Sonn- und Feiertagen können Sie gratis
und ohne Zeitlimit parken."

Die Ermächtigung ist § 1 Abs. 1 Salzburger Parkgebührengesetz (LGBl. Nr.
48/1991); § 1 Abs. 2 der Verordnung nennt die neun gebührenpflichtigen
Kurzparkzonen (teils „ein Teil der KPZ …") mit Lageplänen als Anlage 1 bis 9.

**Entscheidung:** Jede gebührenpflichtige Zone bekommt
`{ kind: 'exact', centsPerHour: 220 }` aus `SALZBURG_TARIFF` in
`core/salzburg.ts`, wo die Fundstelle als Kommentar und als Feld `basis`
steht; `rawFee` lautet an diesen Zonen „laut Verordnung: 1,10 € je halbe
Stunde (nicht im Datensatz)". Das ist etwas anderes als München (`unknown`,
weil die Quelle schweigt und die Gebührenordnung je Gebiet verschieden ist) und
etwas anderes als Köln (`unknown`, weil die Quelle nachweislich Veraltetes
sagt): Hier gibt es **einen** Satz, per Verordnung, mit Datum. Ändert die
Stadt ihn, ändert sich eine Zeile samt Fundstelle. Die Gefahr, die bleibt, ist
die von Innsbruck: eine neue Novelle, die niemand bemerkt — deshalb steht der
Satz mit `inKraftSeit` da und nicht als nackte Zahl, und `docs/todo.md`-Leser
finden ihn unter „Was offen bleibt".

**Warum Verordnung und Feed nicht auf denselben Namen kommen:** § 1 Abs. 2
zählt „Elisabeth-Vorstadt Ost/West", „Nonntal Ost/West", „L 118
Elisabethstraße" und „B 150 Dr.-Franz-Rehrl-Platz" als gebührenpflichtig; im
Feed sind `NONNTAL-OST` (190) und `NONNTAL-WEST` (189) **gebührenfrei**, und
die elf gebührenpflichtigen Flächen heißen `INNENSTADT-RIEDENBURG-LEHENSÜD`
(4×), `Kurzparkzone (Bewohnerparkzone E)` (3×), `Kurzparkzone (Bewohnerparkzone
K)` (2×), `SCHALLMOOS`, `LEHEN-NORD`. Der Datenbau ordnet die drei
E-Flächen den Stadtteilen Nonntal und Elisabeth Vorstadt zu — die Verordnung
nennt also die Kurzparkzone, der Feed das Teilstück darin. Ohne die Lagepläne
der Anlagen lässt sich das nicht Fläche für Fläche prüfen; `ART` und
`GEBUEHRENPFLICHT` des Feeds sind das, was die App ausliefert, und beide sagen
in allen 41 Fällen dasselbe.

## Die Zeitangabe: vier Schreibweisen, und der Samstag ist ein Zwitter

`GEBUEHRENPFLICHT` hat genau vier Werte:

| Anzahl | Text |
| --- | --- |
| 24 | `gebührenfrei (aber Parkuhrenpflicht) werktags Montag bis Freitag 9-19 Uhr` |
| 11 | `gebührenpflichtig (Gebühreneinhebung mit Parkscheinautomat) werktags Montag bis Freitag 9-19 Uhr; gebührenfrei (aber Parkuhrenpflicht) Samstag 9-16 Uhr` |
| 5 | `gebührenfrei (aber Parkuhrenpflicht) werktags Montag bis Freitag 9-19 Uhr und Samstag 9-16 Uhr` |
| 1 | `gebührenfrei (aber Parkuhrenpflicht) werktags Montag bis Freitag 9-19 Uhr - gilt nicht zum Dauerparken mit Ausnahmebewilligung` |

Die Grammatik: Klauseln durch `;`, jede beginnt mit der Art (`gebührenpflichtig
(…)` oder `gebührenfrei (…)`), dann eine oder mit „und" zwei
Tag-und-Stunden-Angaben, dahinter optional ein Nachsatz nach ` - ` (mit
Leerzeichen — der Bindestrich der Spanne `9-19` hat keine). `parseSalzburgRule`
nimmt genau das.

Drei Entscheidungen daraus:

1. **„gebührenfrei (aber Parkuhrenpflicht)" ist Hamburgs `disc`.** Die
   „Parkuhr" ist in Österreich die Parkscheibe. 30 Zonen kosten nichts und
   verlangen die Scheibe und höchstens drei Stunden; ihre Fenster sind die
   Zeiten, in denen die Scheibe verlangt ist — dieselbe Lesart wie in Hamburg.
2. **Der Samstag einer kassierenden Zone ist kein Gebührenfenster.**
   `ChargeWindow` heißt „hier wird kassiert". Elf Zonen kassieren Mo–Fr 9–19
   Uhr und verlangen samstags 9–16 Uhr nur die Scheibe. Als Fenster gelesen
   stünde samstags „2,20 €/Std." über einer Zone, die gratis ist. Der Parser
   legt diese Fenster deshalb nach `discWindows`, und
   `salzburgUnmodelledRules` macht daraus den Satz „Sa 9–16 Uhr gebührenfrei,
   aber mit Parkscheibe, höchstens 3 Std.", den das Panel als Zusatzregel
   wörtlich nennt. Die App sagt samstags „frei", und der Satz sagt, was
   trotzdem verlangt ist.
3. **„werktags Montag bis Freitag" ist Mo–Fr, nicht Hamburgs Mo–Sa.** Der
   Feed nennt die Tage ausdrücklich; „werktags" trägt nur die Einschränkung,
   die das Tarifmodell ohnehin macht — an Feiertagen nicht. Der Parser kennt
   genau zwei Tagesangaben, `werktags Montag bis Freitag` und `Samstag`, und
   weist `werktags` allein, `täglich` und `Sonntag` ab.

Der Nachsatz „gilt nicht zum Dauerparken mit Ausnahmebewilligung" (Zone 605,
`KEIN_BEWOHNERPARKEN = Ja`) geht wörtlich nach `unmodelledRules`.

## Die Höchstparkdauer

`MAXIMALE_PARKDAUER` hat einen Wert: `3 Stunden`, 41-mal. `parseSalzburgMaxStay`
liest Stunden und Minuten, weist `0` ab (null Minuten hieße Parken verboten,
und einen Platzhalter wie Hamburgs `9999` kennt dieser Feed nicht) und alles
über einem Tag. `maxStayMinutes: 180` steht an jeder Zone; `estimateCost`
schlägt bei 240 Minuten an, und drei Stunden ergeben 660 Cent — die 6,60 € der
Bürgerseite.

## Die Stadtteile: Flächenstücke, keine Stadtteile

`ogdsbg:stadtteil` ist keine Liste von Stadtteilen, sondern eine Zerlegung des
Rahmens in 145 Stücke: 132 mit `GEMEINDE = Salzburg`, 13 mit Anif, Puch (2),
Freilassing, Koppl, Plainfeld, Wals-Siezenheim, Grödig, Elixhausen, Hallwang,
Elsbethen, Eugendorf, Bergheim. Von den 132 tragen 87 einen `STADTTEIL` (24
Namen); die übrigen 45 sind unbesiedelte Teile — Mönchsberg, Kapuzinerberg,
Festungsberg, Gaisberg, Kommunalfriedhof, Flughafen — und führen den Namen
ihres Stadtteils in `LANDSCHAFTSRAUM` (Altstadt, Gneis, Maxglan …) plus vier
eigene: Gaisberg, Heuberg, Hellbrunn, Salzachseen.

`salzburgDistrictName` nimmt `STADTTEIL`, fällt auf `LANDSCHAFTSRAUM` zurück
und gibt für fremde Gemeinden null. Der Datenbau fasst die Stücke je Name zu
einem MultiPolygon zusammen: **28 Stadtteile aus 248 Polygonen**. Der Grund
ist `zone-units.ts`, das je Stadtteilname genau eine Fläche hält — mit 132
Einzelstücken hätte es jeden Stadtteil auf sein letztes Stück verkürzt. Die
Stücke teilen sich Kanten; auf der Karte sind die als Linien im Stadtteil zu
sehen, für Punkt-in-Fläche ist es einerlei.

Alle 40 ausgelieferten Zonen treffen einen Stadtteil: Nonntal, Maxglan und
Schallmoos je 5, Lehen 4, Parsch, Elisabeth Vorstadt und Itzling je 3, Salzburg
Süd, Gnigl, Aigen, Altstadt und Liefering je 2, Langwied und Riedenburg je 1.

## Die Fläche, die keine ist

Zone **546** (`INNENSTADT-RIEDENBURG-LEHENSÜD`, gebührenpflichtig, Gruppe F)
ist ein Dreieck aus drei Stützpunkten innerhalb von rund vier Metern:
`[13.03552, 47.80866] [13.03553, 47.80862] [13.03553, 47.80862]`. Beim
Vereinfachen auf fünf Nachkommastellen fällt der Ring unter vier Punkte, und
`simplifyGeometry` gibt null. Die erste Fassung des Datenbaus überging das
stumm — 40 Zonen im Log, 41 im Feed, und nur das Nachzählen hat es gefunden.
Jetzt steht die Zone mit Grund im Log („Fläche fällt beim Vereinfachen
zusammen"), und die Zählung nennt sie unter „ohne brauchbare Fläche". Sie
bleibt draußen: Auf der Karte wäre sie ein Strich, in der Suche ein fünftes
„INNENSTADT-RIEDENBURG-LEHENSÜD". Ob es ein Rest einer Umzeichnung ist, weiß
nur die Stadt (Punkt 3 unten).

## Die Lizenz: BY am Dienst, BY-SA im Katalog

Drei Fundstellen, zwei Aussagen:

| Fundstelle | Wortlaut | Stand |
| --- | --- | --- |
| WFS `GetCapabilities`, `ows:AccessConstraints` | „Datenquelle: Stadt Salzburg – data.stadt-salzburg.at; Nutzungsbedingungen: CC BY 3.0 AT (https://creativecommons.org/licenses/by/3.0/at/deed.de)" | live, 16. September 2026 |
| OGD-Seite der Stadt, <https://www.stadt-salzburg.at/ogd/> | „Die Daten werden unter der CC BY 3.0 AT Lizenz zur Verfügung gestellt." — verlinkt auf `creativecommons.org/licenses/by/3.0/at/deed.de` | live, 16. September 2026 |
| data.gv.at, Datensatz `200e7304-f01d-4acd-91ff-1becafe98641` „Kurzparkzonen in der Stadt Salzburg", Herausgeber Stadt Salzburg | jede der sechs Distributionen: `license: https://creativecommons.org/licenses/by-sa/3.0/at/deed.en` | `issued`/`modified` 2016-12-09; Katalog-Harvest 2026-02-12 |

Der Katalogeintrag ist von 2016 und wurde seitdem nicht angefasst; der Dienst
und die Portalseite sind die eigenen, aktuellen Angaben derselben Stadt, und
der Dienst ist genau die Adresse, die der Datenbau abruft. **Entscheidung:
Familie `cc-by`**, Lizenzname „Creative Commons Namensnennung 3.0 Österreich
(CC BY 3.0 AT)", Nennung als Bedingung, Quellenvermerk wörtlich wie am Dienst.

Was ein BY-SA bedeutet hätte, damit die Frage nicht offen aussieht wie eine
Sperre: Share-alike greift bei Bearbeitungen. `zones.geojson` ist eine —
vereinfachte Geometrie, eigenes Schema. Sie müsste dann unter CC BY-SA 3.0 AT
stehen; der Code des Projekts (MIT) ist davon nicht berührt, die Datei ließe
sich getrennt kennzeichnen, und die Anzeige selbst ist keine Weitergabe. Es
wäre tragbar, nur ein neues Lizenzverhalten für eine Stadt. Der Weg, es zu
klären, ist eine Frage an `informationszentrum@stadt-salzburg.at`
(Kontakt des Katalogeintrags) oder `e-service@stadt-salzburg.at` (OGD-Seite);
sie ist nicht gestellt (Punkt 1 unten).

CC BY 3.0 verlangt wie 4.0 die Nennung des Urhebers, der Lizenz und einen
Hinweis auf Veränderungen (§ 4 b); die Oberfläche tut das für die Familie
`cc-by` schon seit Karlsruhe.

## Der Probelauf

```
Salzburg — Daten bauen …
  districts.geojson: 125 KB
  ausgelassen 546 (INNENSTADT-RIEDENBURG-LEHENSÜD): Fläche fällt beim Vereinfachen zusammen
  zones.geojson: 74 KB
  poi.geojson: 32 KB
  umweltzone.geojson: 0 KB
  meta.json: 1 KB

40 Kurzparkzonen (10 gebührenpflichtig, 30 mit Parkscheibe), 28 Stadtteile aus 248 Stücken,
185 Behindertenstellplätze — 0 nicht aktiv, 0 unlesbar, 1 ohne brauchbare Fläche,
0 ohne Stadtteil-Treffer, 0 mit widersprüchlichem ART, 13 Stücke fremder Gemeinden
```

`fetch-data` davor: `zones … 41 features`, `districts … 145 features`,
`accessible … 185 features`, alle drei genau auf `expectedFeatures`.
`meta.json`: `geprueftAm 2026-09-16T16:53:00.000Z`, `absent: ['umweltzone',
'segments']` — der Tarif fehlt nicht, er steht mit Fundstelle an der Zone.

Die Behindertenstellplätze kommen als POI `accessible` mit `BEZEICHNUNG`
(„Altstadt, Gstättengasse 23") als Label und Plätzen plus Euroschlüssel (5 der
185) als Detail. Die Achsen: GeoJSON `[13.0537, 47.7971]` für den ersten
Stützpunkt, GML derselben Anfrage `47.79709248 13.05371923`, ohne `srsName`
`[-20891.7, 295427.09]` — `assertDegrees` steht deshalb an allen drei Ebenen.

## Feiertage: Salzburg (AT-S)

Alle österreichischen Feiertage sind Bundesrecht — § 7 Abs. 2
Feiertagsruhegesetz 1957, in `holidays.ts` seit dem 16. September als
`NATIONWIDE.AT` mit `AT-S` als leerer Landeszeile. Für Salzburg heißt das:

- **Rupertitag (24. September)** ist Landesfeiertag ohne Feiertagsruhe — die
  Kurzparkzonen gelten. Die Stadt schreibt „An Sonn- und Feiertagen … gratis",
  und ein Landespatron ist keiner davon. `salzburg.test.ts` hält fest, dass
  am Donnerstag, 24. September 2026 kassiert wird.
- **Karfreitag** ist seit 2019 kein Feiertag mehr (BGBl. I Nr. 22/2019) —
  kassiert; in Bayern wäre derselbe Tag frei.
- **3. Oktober** kassiert, **26. Oktober** (Nationalfeiertag) nicht — in Berlin
  umgekehrt. Beides getestet.
- **Fronleichnam**, Mariä Himmelfahrt, Allerheiligen, Mariä Empfängnis: frei,
  wie in Bayern.

`City.holidays` fehlt mit Absicht: Es gibt keinen gemeindeweisen Feiertag.

## Die Auskunftsstelle für umgesetzte Fahrzeuge

Belegt auf <https://www.stadt-salzburg.at/verkehr-und-strassenraum/fahrzeugabschleppung>
(Verkehrs- und Straßenrechtsamt, Markus-Sittikus-Straße 4, abgerufen am
16. September 2026), wörtlich: „Wenn Ihr Fahrzeug abgeschleppt wurde, wenden
Sie sich bitte an die nächste Polizeiinspektion oder an das Abschleppunternehmen
Car & Transport GmbH, Tel. +43 (0)676 44 44 650" — „Fahrzeugabholung: Car &
Transport GmbH, Mayrwiesstrasse 7a, 5300 Hallwang, NACHTS NUR NACH
telefonischem Kontakt". Kosten: 318 € Abschleppung bis 2,8 t, 42 €
Ausfolgegebühr, 15 € Lagergebühr je Kalendertag. Fahrzeuge **ohne** Kennzeichen
stehen bei BAS in Hallein; die App nennt den Fall mit Kennzeichen.

Die Nummer steht mit Landesvorwahl, und `city.test.ts` verlangt das jetzt
genau für Städte außerhalb Deutschlands — eine österreichische Nummer ohne
`+43` wäre von Deutschland aus falsch gewählt.

## Was eingetragen ist

Im Unterschied zu Köln und Karlsruhe sind die gemeinsamen Dateien in
demselben Zweig angefasst; die Liste steht hier für den Merge:

| Datei | Eintrag |
| --- | --- |
| `app/packages/core/src/city.ts` | `SALZBURG` mit Begründung, `CITIES` um ihn erweitert |
| `app/packages/core/src/index.ts` | `export * from './salzburg.js'` |
| `app/packages/ingest/src/sources.ts` | `SALZBURG_SOURCES` (drei Ebenen), `BY_CITY.salzburg` |
| `app/packages/ingest/package.json` | Skript `build-data-salzburg` |
| `app/packages/core/test/fuzz.test.ts` | Zeitparser, Höchstparkdauer, Zeitbudget (acht Parser) |
| `app/packages/core/test/fixture-shape.test.ts` | Block „Salzburger Fixture" |
| `app/packages/core/test/city.test.ts` | Telefonnummer mit Landesvorwahl außerhalb Deutschlands |
| `app/packages/ingest/test/quellen.test.ts`, `zone-units.test.ts` | `salzburg` in den Stadtlisten |
| `app/apps/web/test/flaechenpunkt.test.ts`, `stadtfeiertage.test.ts` | acht Städte, `AT-S` |
| `app/apps/web/statistik/main.ts` | `STADTNAMEN.salzburg` |
| `.github/workflows/deploy.yml`, `kacheln.yml` | `salzburg` in beiden Listen (kacheln.yml zweimal) |
| `NOTICE`, `README.md`, `CLAUDE.md`, `docs/staedte.md`, `docs/data-sources.md` | Zeile bzw. Abschnitt |
| erzeugt | `zone-keys.generated.ts` (40 Kennungen), `zone-units.generated.ts`, `apps/api/src/zone-units.generated.json` (38 Einheiten: 32 Zonen, 6 Bezirke) |

Nicht angefasst, wie vereinbart: `index.html`, `manifest.webmanifest`,
`login-page.ts`.

## Was offen bleibt

1. **BY oder BY-SA.** Dienst und Portalseite sagen BY, der Katalogeintrag von
   2016 BY-SA. Die App liefert unter BY aus, weil das die aktuelle Angabe der
   Stadt am abgerufenen Dienst ist. Eine Mail an
   `informationszentrum@stadt-salzburg.at` schließt die Frage; ist die Antwort
   BY-SA, bekommt `zones.geojson` eine eigene Lizenzkennzeichnung, sonst
   ändert sich nichts.
2. **Die 23. Novelle.** Die 22. gilt seit dem 1. Jänner 2026; Pressemeldungen
   vom Sommer kündigen für 2027 eine weitere Erhöhung an. `SALZBURG_TARIFF`
   trägt `inKraftSeit`; wer im Dezember einen Blick auf
   <https://www.stadt-salzburg.at/gesetz-parken/> wirft, sieht die nächste
   Fassung. Ein Test, der das Netz fragt, gehört nicht in die Suite.
3. **Zone 546.** Ein Vier-Meter-Dreieck als gebührenpflichtige Fläche. Ob es
   ein Rest ist, weiß die Stadt; bis dahin bleibt es draußen, mit Logzeile.
4. **Verordnung gegen Feed bei den Namen.** § 1 Abs. 2 nennt neun
   gebührenpflichtige Kurzparkzonen; der Feed elf Flächen mit anderen Namen.
   Ohne die Lagepläne (Anlage 1 bis 9, in der PDF-Fassung „ohne Pläne") ist
   das nicht Fläche für Fläche prüfbar. Die Zonen `NONNTAL-OST` und
   `NONNTAL-WEST` sind im Feed gebührenfrei, in der Verordnung „ein Teil"
   gebührenpflichtig — vermutlich sind das die drei E-Flächen, die der
   Datenbau nach Nonntal legt.
5. **Innere Kanten der Stadtteile.** 28 MultiPolygone aus 248 Stücken; auf der
   Karte sind die Stückgrenzen als Linien zu sehen. Ein echtes Auflösen der
   Kanten bräuchte eine Polygonvereinigung, die dieses Projekt nicht hat.
6. **Kacheln.** `build-tiles.sh salzburg --hochladen` ist nicht gelaufen; der
   Ausschnitt kommt aus `SALZBURG.reportBounds`, sobald der Workflow läuft.
7. **E2E.** Die Suite ist hier nicht gelaufen (läuft zentral). Zu erwarten
   ist nichts Stadtspezifisches; die Stadtwahl gruppiert seit dem
   16. September nach Staat, und Salzburg ist die erste Stadt in der zweiten
   Gruppe.

## Prüfstand

```bash
cd app
pnpm -r typecheck                                # grün
pnpm test                                        # grün: core 928, ingest 53, api 101, web 304
pnpm --filter @knoellchenfrei/web build          # grün
cd .. && ./scripts/sprache-pruefen.sh            # grün
node scripts/doku-pruefen.mjs                    # grün
./scripts/namen-pruefen.sh                       # grün
```

Davon 62 Tests für Salzburg in `salzburg.test.ts`, dazu je einer in
`fuzz.test.ts` (Zeitparser, Höchstparkdauer), `fixture-shape.test.ts` (zwei)
und die Stadt in jedem Test, der über `CITIES` läuft.

## Dateien

| Datei | Inhalt |
| --- | --- |
| `app/packages/core/src/salzburg.ts` | Regel-, Dauer-, Aktiv-, Namens- und Stadtteilparser, Stadttarif mit Fundstelle |
| `app/packages/core/test/salzburg.test.ts` | 62 Tests, inklusive Beschuss mit Unfug und Feiertagsvergleich |
| `app/packages/core/test/fixtures/sbg-kurzparkzonen-2026-09-16.json` | die 41 Zonen-Attribute, Zählungen, drei Stützpunkt-Schreibweisen, Stadtteil-Zählung |
| `app/packages/ingest/src/build-data-salzburg.ts` | der Datenbau |
| `app/apps/web/public/data/salzburg/` | `zones` (40), `districts` (28), `poi` (185), `umweltzone` (leer), `meta.json` |
