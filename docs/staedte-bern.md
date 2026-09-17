# Bern als Stadt der Klasse C — gemessen, entschieden, offen

> **Wo der Code liegt.** Feldparser in `app/packages/core/src/bern.ts`,
> Datenbau in `app/packages/ingest/src/build-data-bern.ts`, Quellen in
> `sources.ts` als `BERN_FILES`, Stadt als `BERN` in `core/city.ts`, Kanton
> als `CH-BE` in `core/holidays.ts`. Tests in `core/test/bern.test.ts` (30)
> und in `laender.test.ts`, `fixture-shape.test.ts`, `fuzz.test.ts`,
> `city.test.ts`, `ingest/test/quellen.test.ts`. Die Daten liegen eingecheckt
> unter `app/apps/web/public/data/bern/`.

> **Stand 17. September 2026.** Bern ist angeschlossen — die erste Stadt in
> der Schweiz und die erste, deren Quelle **weder Zeiten noch Beträge**
> nennt. Die App sagt über jeder Zone „Zeiten unbekannt" und färbt grau, statt
> „frei" zu behaupten. Was fehlt, steht unter „Was offen bleibt": die
> Wortlaute von Signalisationsverordnung und Gebührenreglement, beide aus
> dieser Umgebung nur als JavaScript-Hülle abrufbar.

Alle Zahlen hier sind an diesem Tag gegen die Dienste selbst gemessen, nicht
aus [staedte-recherche-2026-09-16.md](staedte-recherche-2026-09-16.md)
übernommen. Wo die Messung von der Recherche abweicht, steht es dabei.

## Die Quellen

| | Parkkartenzonen | Statistische Bezirke | Stadtteile | Gemeindegrenze (nur für den Rahmen) |
| --- | --- | --- | --- | --- |
| Art | ArcGIS **MapServer**, `query?…&f=geojson&outSR=4326` | ebenso | ebenso | ebenso, `Amtliche_Vermessung_Kontur/MapServer/78` |
| Adresse | `https://map.bern.ch/arcgis/rest/services/Geoportal/Parkkartenzonen/MapServer/1` | `…/Geoportal/Statistische_Bezirke/MapServer/0` | `…/Geoportal/Stadtteile/MapServer/0` | `…/Geoportal/Amtliche_Vermessung_Kontur/MapServer/78` |
| Ebenenname | „Parkkartenzone_Umrandung" (Ebene 2 „Flaechenfuellung" führt dieselben 42 mit denselben Feldern) | „Statistischer_Bezirk" | „Stadtteil" | „Gemeindegrenze" |
| Umfang | **42** Polygone, davon **34** mit Namen für **31** Zonen | **32** Polygone | **6** Polygone | 1 Linienzug, 54.107 m, `Lineattr_beschrieb: Rechtskräftig` |
| Inhalt | `PKZ_name`, `Parkfeld_typ(_beschrieb)`, `PLZ(_beschrieb)`, `PLZ_zusatz(_beschrieb)`, `Bemerkung`, `Info(_beschrieb)`, `Letzte_Aenderung` | `Nummer`, `Name`, `Stadtteil_fid`, Wikipedia-Link | `Nummer`, `Nummer_roem`, `Name`, `…fid` | — |
| Zuständig (Geodatenkatalog) | Tiefbau Stadt Bern, `tiefbau@bern.ch` | Statistik Stadt Bern, `statistik@bern.ch` | dieselbe | Geoinformation Stadt Bern |
| Lizenz | Nutzungsbedingungen der Stadt, Stufe A — wörtlich unten | dieselbe, Stufe A | dieselbe, Stufe A | nicht übernommen, nur vier Zahlen gerundet |
| Aktualität | `letzte_aktualisierung` 14.01.2025, „Laufend"; `Letzte_Aenderung` je Fläche 2014-08 bis 2025-01 | 05.09.2022, „Unregelmässig" | 05.09.2022 | `Letzte_Aenderung` 2026-08 |

Der Dienst liegt in **LV95** (`wkid` 2056, Meter um 2.600.000 / 1.200.000).
`outSR=4326` in der Abfrage ist deshalb Pflicht, und `build-data-bern.ts`
misst mit `assertDegrees` nach — ohne den Parameter kämen plausible Zahlen,
die auf der Karte nur nach „leer" aussähen, dieselbe Falle wie Frankfurts
UTM. `maxRecordCount` ist 1000; bei 42 Merkmalen bleibt
`exceededTransferLimit` aus, `fetch.ts` und der Datenbau prüfen das Feld
trotzdem. Die Antwort kommt in `[lon, lat]`, erster Stützpunkt
`[7.3955, 46.9471]`.

**Was die Recherche sagte und was stimmt.** 42 Polygone, die Felder, die
vier Werte von `Info_beschrieb` und „Auch Sonntags bei 4 Zonen": stimmt. Zwei
Ergänzungen: Von den 42 Flächen tragen **acht keinen Namen** und keine andere
Sachangabe, und drei Namen kommen je zweimal vor — die Recherche zählte
Flächen, nicht Zonen. Und die blauen Parkfelder des Dienstes
`Parkplaetze_oeffentlich` sind heute **3.002**, nicht 3.003.

## Die Lizenz, wörtlich

Der Dienst selbst sagt nur `copyrightText: "Geodaten Stadt Bern"`. Die
Bedingungen stehen zwei Ebenen höher — und beide waren zu finden:

**Erstens die Nutzungsbedingungen**, verlinkt vom Geoportal
(`map.bern.ch/geoportal`, „Bedingungen lesen"):
<https://map.bern.ch/geoportal/data/Nutzungsbedingungen_Geodaten_Stadt-Bern_1.0.pdf>,
„Nutzungsbedingungen betreffend Geodaten, die in der Zuständigkeit der Stadt
Bern liegen, Version 1.0 | Januar 2020", Herausgeberin Direktion für Tiefbau,
Verkehr und Stadtgrün, Geoinformation Stadt Bern, `geoinformation@bern.ch`.
Gelesen am 17. September 2026:

> 3. Umfang der Nutzung — Die Stadt Bern fördert die breite Nutzung der in
> ihrer Zuständigkeit liegenden Geodaten. Die Geodaten dürfen grundsätzlich
> von jedermann kostenlos genutzt werden. Einschränkungen sind möglich, wo
> überwiegende öffentliche oder private Interessen entgegenstehen. Es wird ein
> nicht ausschliessliches Nutzungsrecht gewährt. […]
> A. Öffentlich zugängliche Geodaten können vorbehältlich
> datenschutzrechtlicher Bestimmungen sowie unter Berücksichtigung der
> vorliegenden Nutzungsbedingungen uneingeschränkt genutzt werden. Weder das
> kantonale noch das stadtbernische Recht machen eine Unterscheidung zwischen
> privater und gewerblicher Nutzung.
>
> 5. Quellenhinweis — Auf sämtlichen Publikationen ist die Quellenangabe
> "Geodaten Stadt Bern" anzugeben (Art. 22, Abs. 1, Bst. c, Kantonale
> Geoinformationsverordnung vom 11. November 2015; KGeoIV; BSG 215.341.2).
>
> 6. Veröffentlichung, Reproduktion und Weitergabe — A. Öffentlich
> zugängliche Geodaten dürfen mit gut sichtbarem Quellenhinweis beliebig
> reproduziert werden. B. Beschränkt öffentlich zugängliche Geodaten bedürfen
> einer expliziten Einwilligung zur Reproduktion durch die für die
> entsprechenden Geodaten zuständige Stelle. Werden Geodaten weitergegeben,
> gelten die Pflichten der Nutzerinnen und Nutzer auch für die empfangenden
> Dritten. Die Empfängerinnen und Empfänger sind über die Nutzungsbedingungen
> zu orientieren. Beschränkt öffentlich zugängliche Geodaten dürfen nicht
> weitergegeben werden (Art. 22, Abs. 2, KGeoIV).
>
> 7. Rechtswirkung und Haftung — Die Geodaten entfalten keine Rechtswirkung.
> Sie haben bloss informativen Charakter. […] Die Stadt leistet für die
> Richtigkeit, Genauigkeit, Aktualität, Zuverlässigkeit und Vollständigkeit
> der Geodaten keine Gewähr.
>
> 10. Aktualität — Bei Publikationen - in digitaler oder analoger Form - wird
> empfohlen, den Zeitstand (Datum der letzten Nachführung) der Geodaten –
> soweit ersichtlich – explizit anzugeben.

Damit hängt alles an einer Frage: Sind die Parkkartenzonen Stufe **A**
(öffentlich zugänglich) oder **B** (beschränkt)? Für B verböte Ziffer 6 die
Weitergabe, und ein Abzug in diesem Repository wäre genau das.

**Zweitens der Geodatenkatalog**, der die Frage beantwortet. Die
Weboberfläche ist eine Knockout-Anwendung; ihre Daten kommen aus
`rest/api/GeoDataSet/read_produkt.php?name=<Produkt>&status=4` (der Wert 4
steht in `js/custom/JSCodeStart.js`; ohne ihn antwortet der Server mit 500,
mit 1 mit 401). Am 17. September 2026 für alle drei Produkte abgerufen,
wörtlich für die Parkkartenzonen:

```
"zugangsberechtigungsstufe": "A: öffentlich zugänglich",
"nutzungsbedingungen":       "Freie Nutzung. Quellenangabe ist Pflicht.",
"quellenangabe":             "Geodaten Stadt Bern",
"letzte_aktualisierung":     "14.01.2025",
"nachfuehrungsfrequenz":     "Laufend",
"kostenpflichtig":           false,
"datenbezug_text":           "keine Prüfung",
"zustaendigestelle":         "Tiefbau Stadt Bern", tiefbau@bern.ch, +41 31 321 64 75,
"geocat_url":                …/metadata/d8f4e1bf-5f68-4dd1-b8b5-542eb247192c
```

Statistische Bezirke und Stadtteile: dieselben drei Zeilen, zuständig
Statistik Stadt Bern.

Ergebnis: `licenceFamily: 'cc-by'`, `attributionRequired: true`,
`source: 'Geodaten Stadt Bern'` — wörtlich die vorgeschriebene Form. Die
Familie ist wie bei Innsbruck eine Zuordnung, keine Lizenznennung: Die zwei
Auflagen, an denen die Oberfläche hängt (Nennung in vorgeschriebener Form,
Hinweis auf die fehlende Gewähr), sind dieselben wie bei CC BY. Was CC BY
nicht kennt und hier dazukommt: Empfänger weitergegebener Daten sind über die
Bedingungen zu orientieren (Ziffer 6 — der Lizenzhinweis in der App und
`NOTICE` tun das), und der Zeitstand soll genannt werden (Ziffer 10 —
`meta.geprueftAm`). `opendata.swiss`, wo die Stadt ihre Daten ebenfalls
listet, antwortet aus dieser Umgebung mit 403; gebraucht wurde es nicht.

## Die Eigenheit, die alles bestimmt: keine Zeiten, keine Beträge

Der Datensatz ist laut `serviceDescription` der „Basisdatensatz für die
Parkkartenbewirtschaftung in der Stadt Bern. Die kostenpflichtigen Parkkarten
ermöglichen zeitlich unbeschränktes Parkieren in der Zone, in der sich die
Wohnadresse des Inhabers oder der Inhaberin befindet." Er sagt, **wo eine
Parkkarte gilt** — nicht, wann die Parkscheibe läuft oder was die Parkuhr
kostet. Es gibt kein Zeit- und kein Gebührenfeld, und der Dienst
`Parkplaetze_oeffentlich` daneben (455 gebührenpflichtige, 3.002 blaue,
469 + 81 weisse Parkfelder als Polygone) hat auch keins: Seine Felder sind
Gruppe, Subgruppe (`Gebührenpflichtig`), Art (`nummeriert`), Anzahl,
Überdeckung, Status, Lage, Bemerkung.

Deshalb Klasse C, und deshalb das Modell vom 16. September: jede Zone mit
`scheduleUnknown: true`, `windows: []`, `fee: { kind: 'unknown' }`,
`rawHours: ''`, `rawFee: ''`; `meta.absent` führt `schedule` und `fee`. Die
App antwortet mit „Zeiten unbekannt" statt mit „frei" oder „kostet" — das
dritte Wort, das `chargeableAt` seit dem 16. September kennt, und
`bern.test.ts` hält fest, dass es auch am Berchtoldstag dabei bleibt.

**Was nicht getan wurde, mit Absicht:** ein stadtweites Fenster aus dem Recht
eintragen. Die Signalisationsverordnung des Bundes regelt die Blaue Zone für
alle Städte gleich, und das Gebührenreglement der Stadt nennt einen Tarif.
Beides wäre eine Aussage über das Recht, nicht über die Daten — und für die
vier weiss markierten Flächen (`3006/1`, `3006/2`, `3006/3`, `3027/2`)
schlicht falsch. Was sich belegen liess, steht unten unter „Blaue Zone und
Parkuhr-Tarif, zitiert"; ob es als Stadtregel in die Daten soll, ist eine
Entscheidung des Betreibers (todo.md, Abschnitt 5).

## Die Felder, gezählt

Alle 42 Zeilen stehen in `core/test/fixtures/bern-parkkartenzonen-2026-09-17.json`,
ohne Geometrie; `fixture-shape.test.ts` hält die Typmenge je Feld als
Gleichheit fest.

| Feld | Werte |
| --- | --- |
| `PKZ_name` | 31 Namen auf 34 Flächen: `3000` ×2, `3003`, `3004`, `3004/1`–`/3`, `3005`, `3006`, `3006/1`–`/6`, `3007/1`–`/4`, `3008/1` ×2, `3008/2`, `3008/3` ×2, `3011`, `3012`, `3013`, `3014`, `3014/1`, `3018`, `3018/11`, `3027`, `3027/2`, `3027/3`; **8 × `null`** |
| `Parkfeld_typ_beschrieb` | `blau mit Markierung` 30, `weiss mit Markierung` 4, `null` 8 (Codes 1002 / 1000) |
| `PLZ` / `PLZ_beschrieb` | `PLZ` ist ein **Code** der Wertetabelle (1001–1015), die Postleitzahl steht als Text in `PLZ_beschrieb` (`3000`–`3027`); 14 Werte, `null` 8 |
| `PLZ_zusatz_beschrieb` | `kein Zusatz` 12, `/1` 6, `/3` 6, `/2` 5, `/4` 2, `/5`, `/6`, `/11` je 1, `null` 8 |
| `Info_beschrieb` | `unbekannt` 18, `nicht definiert` 10, `null` 10 (die 8 namenlosen plus `3013` und `3014/1`), **`Auch Sonntags` 4** (`3006/2`, `3006/3`, `3008/3`, `3014`) — Codes 0 / 1000 / 1001 |
| `Bemerkung` | 42 × `null` |
| `Letzte_Aenderung` | 18 Werte, Unix-Millisekunden, 2014-08-19 bis 2025-01-14 |

Drei Entscheidungen daraus:

1. **Der Zonenname ist der Schlüssel**, wie er dasteht (`3008/1`). Er ist
   nicht eindeutig — `3000`, `3008/1` und `3008/3` bestehen aus je zwei
   Stücken —, und das ist in Ordnung: Die App nummeriert Flächen selbst, seit
   Hamburgs 44 Flächen mit dem Schlüssel `-`. Bei `3008/3` unterscheiden sich
   die beiden Stücke sogar im Hinweis (`Auch Sonntags` / `nicht definiert`);
   jedes trägt seinen eigenen. `parseBernZoneName` verlangt die Form
   `\d{4}(/[1-9]\d?)?` — ein Schlüssel aus Unfug wäre eine Zone, die es nicht
   gibt, und stünde in `zone-keys.generated.ts`.
2. **Der Name steht zweimal, und beide Schreibweisen werden verglichen.**
   `bernZoneNameFromPlz(PLZ_beschrieb, PLZ_zusatz_beschrieb)` ergibt in allen
   34 Zeilen dasselbe wie `PKZ_name`; der Datenbau bricht ab, sobald das nicht
   mehr gilt — wie Graz mit seinen zwei Parkdauern.
3. **`Auch Sonntags` wird wörtlich zur Zusatzregel.** Es ist die einzige
   Zeitaussage des Datensatzes, und eine halbe: Sie sagt, dass sonntags etwas
   gilt, nicht was. Sie steht in `unmodelledRules`, wo das Panel sie als
   „Zusatzregel, die hier nicht berechnet wird" nennt. `unbekannt`, `nicht
   definiert` und leer sind drei Schreibweisen für nichts; ein fünfter Wert
   bricht den Bau ab, statt als nichts zu gelten.

## Die acht Flächen ohne Sachangaben

`Objectid` 14745, 15111, 15470, 15472, 15481, 15482, 15486, 15489 — kein
Name, keine Art, keine PLZ, kein Hinweis; nur ein Änderungsdatum (2014-08,
2017-01, 2022-02, 2022-08, 2023-11, 2024-06, 2025-01). Gemessen mit einem
Punkt-in-Polygon-Test gegen die benannten Flächen:

| Objectid | Fläche | Bezirk | liegt in |
| --- | --- | --- | --- |
| 14745 | 21.317 m² | Bethlehem | keiner benannten Zone |
| 15111 | 10.530 m² | Brunnadern | `3006` |
| 15470 | 31.402 m² | Schosshalde | `3006/6` |
| 15472 | 38.146 m² | Mattenhof | keiner benannten Zone |
| 15481 | 4.717 m² | Breitenrain | `3014` |
| 15482 | 1.324 m² | Lorraine | `3013` |
| 15486 | 9.804 m² | Murifeld | `3006/6` |
| 15489 | 7.089 m² | Mattenhof | keiner benannten Zone |

Sie werden **ausgelassen und im Log genannt**. Auf der Karte wären sie
Zonen, die es laut Quelle nicht gibt; die fünf innerhalb benannter Zonen
wären dazu Klickziele, die statt der Zone eine leere Fläche zeigen. Was sie
sind — Aussparungen, geplante Zonen, Altbestand —, sagt der Feed nicht;
`isBernZoneUnattributed` prüft alle vier Beschriebe, damit eine Fläche mit
Art, aber ohne Namen als **neuer Fall** auffällt und nicht leise mit
ausgelassen wird.

## Die Bezirke und der Rahmen

Der Server führt drei Stadteinteilungen: 6 Stadtteile („in der amtlichen
Vermessung spricht man von Kreisen"), 32 statistische Bezirke („eine
offizielle Stadteinteilung") und 114 gebräuchliche Quartiere. Genommen sind
die **32 Bezirke** — sechs wären für die Kopfzeile des Panels zu grob, 114 zu
fein. Jeder Bezirk trägt über `Stadtteil_fid` seinen Stadtteil, und der steht
als `bezirk` in `districts.geojson` („Stadtteil III Mattenhof-Weissenbühl"),
wie in Hamburg. Der Datenbau trifft mit jedem der 34 Zonen-Mittelpunkte einen
Bezirk: Beundenfeld 4, Sandrain, Felsenau, Schosshalde, Bethlehem je 3,
Schwarzes Quartier, Holligen, Weissenstein, Bümpliz je 2, zehn weitere je 1.

`reportBounds` kommt aus der **Gemeindegrenze** der amtlichen Vermessung
(Ebene 78, ein rechtskräftiger Linienzug von 54 km): 7,2943–7,4956 /
46,9190–46,9902, nach außen gerundet 7,29–7,50 / 46,91–47,00. Die 32 Bezirke
haben auf sechs Stellen denselben Rahmen. Die Parkebene wäre die falsche
Quelle: Die Zonen reichen nur von 7,373 bis 7,484, und Bümpliz-Oberbottigen im
Westen hat keine einzige. Die Box ist grob — Köniz und Ostermundigen liegen mit
darin, wie Leverkusen in Kölns Box; solange keine zweite Stadt daneben liegt,
entscheidet sie nur „Bern oder nichts". Thun, Burgdorf und Fribourg liegen
draußen, `city.test.ts` und `bern.test.ts` halten es fest. Mittelpunkt ist
der Zytglogge, Zoom 12 zeigt alle Zonen auf einem Telefon.

## Blaue Zone und Parkuhr-Tarif, zitiert

Nichts davon steht in den Daten; es steht hier, damit der Betreiber
entscheiden kann, ob es als Stadtregel hinein soll. Alles am 17. September
2026 von `bern.ch` gelesen.

**Die Parkkarte und die Blaue Zone** — Stadt Bern, „Parkkarten Quartiere"
(<https://www.bern.ch/themen/mobilitat-und-verkehr/motorrad-und-auto/parkieren/parkkartenzonen>):

> Die Stadt Bern ist in Parkkartenzonen unterteilt. Parkkarten gelten jeweils
> in der bewilligten Zone. Bitte beachten Sie die Signalisation vor dem
> Parkieren. […] Wo ist die Parkkarte gültig? Die Parkkarte erlaubt das
> zeitlich unbeschränkte Parkieren auf Parkplätzen mit Parkscheibenpflicht in
> der auf der Karte gedruckten Zone […] Wo gilt sie nicht? Gebührenpflichtige
> Parkplätze / Parkplätze ohne Parkscheibenpflicht / Reservierte Parkfelder
> […] Berechtigte mit Wohn- oder Geschäftssitz in der Stadt Bern: Fr. 264.00
> pro Jahr. Wochenaufenthalterinnen und Wochenaufenthalter: Fr. 660.00 pro
> Jahr.

**Besucherkarten** — „Parkkarten für Besucherinnen und Besucher": „Die 4-
oder 24-Stunden-Parkkarten erlauben das Parkieren in allen entsprechend
signalisierten Zonen mit Parkscheibenpflicht in der Stadt Bern. Gilt nicht auf
gebührenpflichtigen Parkfeldern. Kosten: 4 Stunden-Karte: Fr. 9.00, 24
Stunden-Karte: Fr. 16.00."

**Innenstadt** — „Parkkarten Innenstadt": Für die Obere Altstadt „werden
keine Parkierbewilligungen erteilt"; in der Unteren Altstadt gelten
Parkkarten für Private „für max. 48 Stunden" (Fr. 960.00 pro Jahr) und für
Geschäfte mit Lieferbereitschaft „beschränkt auf die Zeit von Montag bis
Mittwoch sowie am Freitag, 08.00 bis 19.30 Uhr, am Donnerstag von 08.00 bis
21.30 Uhr sowie Samstagen und vor öffentlichen Feiertagen von 08.00 bis
17.30 Uhr". Grundlage ist die „Verordnung über Fahr- und
Parkierbeschränkungen in der Oberen und Unteren Altstadt".

**Der Parkuhr-Tarif** — Gebührenreglement der Stadt Bern (GebR), Anhang III
Ziffer 4.8, zitiert nach dem Stadtratsvortrag „Erhöhung Parkiergebühren und
Gebührenbefreiung Giveboxen" vom August 2021 (PDF auf bern.ch, Mediencenter),
Spalte „bisher":

> 4.8 Für das Abstellen eines Motorwagens auf mit Parkuhren oder zentralen
> Parkuhren versehenen Parkplätzen auf öffentlichem Grund werden bei Beginn
> des Parkiervorgangs eine einmalige und für das Parkieren von über 30 Minuten
> Parkiergebühren gemäss den Ziffern 4.8.1–4.8.6 erhoben. Die
> Parkuhrkontrollgebühr beträgt jeweils die Hälfte der für eine Stunde
> geschuldeten Kontrollgebühr.
> 4.8.1 Untere Altstadt und Matte von 00.00–24.00 Uhr pro Stunde (werktags
> zwischen 19.00 Uhr und 08.00 Uhr gilt keine zeitliche Beschränkung der
> Parkplätze) — 2.20
> 4.8.2 Obere Altstadt in der Zeit zwischen 07.00 Uhr und 19.00 Uhr — 2.20
> 4.8.3 Übrige Quartiere; in Zonen mit Parkscheibenpflicht pro Stunde in
> beschränkten Zeiten — 2.20
> 4.8.4.1 Park + Ride Allmend, rund um die Uhr; pro Stunde — 1.10
> 4.8.4.2 Übrige offene Park + Ride-Plätze, zwischen 07.00 und 19.00 Uhr; pro
> Stunde — 1.10

Der Vortrag beantragte 3.00 Franken; der Stadtrat ging darüber hinaus, und die
Stimmberechtigten haben es am **18. Juni 2023** bestätigt — Medienmitteilung
„Städtische Abstimmungen: Ja zu allen Vorlagen":

> Ja zu höheren Parkiergebühren auf öffentlichen Parkplätzen. Mit 60,78
> Prozent Ja-Stimmen (25'832 Ja- zu 16'669 Nein-Stimmen) hat die
> Stimmbevölkerung auch der Erhöhung der städtischen Parkiergebühren
> zugestimmt. Neu kostet das Parkieren mit Personenwagen auf weissen
> Parkfeldern auf öffentlichem Grund 3.30 Franken pro Stunde, auf nicht
> überdachten Park+Ride-Plätzen 2.50 Franken pro Stunde. […] Der Gemeinderat
> bestimmt in einem nächsten Schritt den Zeitpunkt der Inkraftsetzung.

Der Tarif ist also **3.30 Franken je Stunde** auf weissen Feldern, 2.50 auf
P+R; das Datum der Inkraftsetzung und der heutige Wortlaut des Anhangs III
stehen auf `stadtrecht.bern.ch` (SSSB 152.03) — eine ExtJS-Anwendung, die an
einen Abruf 3,9 KB Hülle ohne Text liefert. Was die Blaue Zone selbst
verlangt (Parkscheibe, Höchstparkzeit, Zeiten), regelt Art. 48 der
Signalisationsverordnung des Bundes (SSV, SR 741.21); Fedlex antwortet aus
dieser Umgebung ebenfalls nur mit der Hülle. Beides steht deshalb hier als
Fundstelle, nicht als Zitat.

## Feiertage: Kanton Bern

Das Kürzel `CH-BE` ist neu in `holidays.ts`, mit Beleg. Der Bund kennt nur
den 1. August (Art. 110 Abs. 3 BV); alles andere ist kantonal, und im Kanton
Bern steht es **nicht** im Gesetz über Handel und Gewerbe (HGG, BSG 930.1),
das man zuerst vermutet — dessen Art. 11 regelt die Ladenöffnung „an
öffentlichen Feiertagen" und setzt den Begriff voraus; keine seiner vier
Fassungen seit 2014 enthält eine Liste (alle vier als PDF über
`belex.sites.be.ch/api/de/versions/<id>/pdf_file_with_annexes` gelesen). Die
Liste steht im **Gesetz über die Ruhe an öffentlichen Feiertagen (FRG, BSG
555.1)** vom 1. Dezember 1996, Stand 1. April 2021, gefunden über den
`lightweight_index` der Schnittstelle des Portals (die Weboberfläche liefert
nur eine JavaScript-Hülle). Art. 2, wörtlich:

> Öffentliche Feiertage sind a die Sonntage, b die hohen Festtage, nämlich
> Karfreitag, Ostern, Auffahrt, Pfingsten, Eidgenössischer Dank-, Buss- und
> Bettag und Weihnachten, c die übrigen öffentlichen Feiertage, nämlich der
> Neujahrstag, der 2. Januar, der Ostermontag, der Pfingstmontag, der
> Bundesfeiertag und der 26. Dezember.

Ostern, Pfingsten und der Bettag (dritter Sonntag im September) sind Sonntage
und fehlen in der Tabelle mit Absicht. Bleiben acht kantonale Tage plus der
1. August: **neun**. Kein 1. Mai, kein Fronleichnam, kein Allerheiligen,
keine Drei Könige — Art. 12 FRG erlaubte sie allein der Gemeinde Vellerat,
die seit 1996 zum Kanton Jura gehört. `laender.test.ts` misst den Unterschied
zum deutschen `BE`: dazu kommen der 2. Januar und der 1. August, es fehlen
Frauentag, 1. Mai und 3. Oktober. Für Bern selbst ändert das heute nichts —
eine Zone mit `scheduleUnknown` bleibt an jedem Tag „unbekannt" —, aber die
Tabelle ist für die nächsten Berner Städte (Thun, Biel) und für den Tag, an
dem Bern Zeiten bekommt.

## Der Probelauf

```
CITY=bern pnpm --filter @knoellchenfrei/ingest fetch-data
  Stadt: bern — 0 Quellen nach …/.raw/bern
  zones (Datei) … 176154 Bytes, 42 Features
  districts (Datei) … 304924 Bytes, 32 Features
  stadtteile (Datei) … 151594 Bytes, 6 Features

CITY=bern pnpm --filter @knoellchenfrei/ingest build-data-bern
  Bern — Daten bauen …
    districts.geojson: 27 KB
    ohne Sachangaben ausgelassen: Objectid 14745, 15111, 15470, 15472, 15481, 15482, 15486, 15489
    zones.geojson: 50 KB
    poi.geojson: 0 KB
    umweltzone.geojson: 0 KB
    meta.json: 1 KB

  34 von 42 Flächen übernommen (30 blau, 4 weiss, 4 mit „Auch Sonntags"),
  32 Bezirke — 8 ohne Sachangaben und 0 unlesbar ausgelassen,
  0 ohne Bezirks-Treffer
  Hinweise der Quelle: unbekannt ×18, Auch Sonntags ×4, nicht definiert ×10, (leer) ×2
```

`meta.absent` ist `["schedule", "fee", "poi", "umweltzone", "segments"]`.
`zone-keys.generated.ts` führt 31 Berner Kennungen, `zone-units` 31 Einheiten
(alle Zonen sind Gebiete über 2 ha, keine fällt auf den Bezirk zurück).

## Was eingetragen ist

Alles ist eingetragen; die Liste, damit der Merge weiß, wo:

| Datei | Eintrag |
| --- | --- |
| `core/src/holidays.ts` | `'CH-BE'` in der `Land`-Union, Zeile in `REGIONAL`, Beleg im Kommentar |
| `core/src/city.ts` | `BERN`, in `CITIES` als letzte |
| `core/src/index.ts` | `export * from './bern.js'` |
| `ingest/src/sources.ts` | `BERN_FILES`, `FILES_BY_CITY`, `bern: []` in `BY_CITY` |
| `ingest/package.json` | `build-data-bern` |
| `core/test/laender.test.ts` | `describe('der Berner Kalender')`, fünf Tests |
| `core/test/city.test.ts` | Nutzungsbedingungen als `cc-by`-Beleg, `OHNE_BELEG` um `bern`, Thun / Fribourg / Zytglogge |
| `core/test/fuzz.test.ts` | `describe('Berner Feldparser unter Beschuss')`, Zeitbudget um zwei Parser |
| `core/test/fixture-shape.test.ts` | „Berner Fixture", vierzehn Felder, PLZ-Code, acht leere Zeilen |
| `ingest/test/quellen.test.ts` | `bern` in der Liste „keine Stadt ohne Quelle", `describe('cityFiles für Bern')` |
| `apps/web/statistik/main.ts` | `STADTNAMEN.bern` |
| `NOTICE`, `README.md`, `docs/staedte.md`, `docs/data-sources.md`, `docs/todo.md` | Zeile bzw. Abschnitt |
| erzeugt | `zone-keys.generated.ts`, `zone-units.generated.ts`, `apps/api/src/zone-units.generated.json` |

Nichts einzutragen, weil aus `CITIES` erzeugt: `deploy.yml`, `kacheln.yml`,
`flaechenpunkt.test.ts`, `zone-units.test.ts`. Nicht angefasst, wie
verabredet: `index.html`, `manifest.webmanifest`, `login-page.ts`,
`CLAUDE.md` (der Satz dort verweist schon auf `docs/staedte.md`).

## Was offen bleibt

1. **Zeiten und Tarif als Stadtregel — eine Entscheidung, keine Messung.**
   Die Blaue Zone gilt nach Bundesrecht stadtweit gleich, der Tarif nach
   Gebührenreglement stadtweit 3.30 Fr./h. Beides in die Daten zu schreiben
   hiesse, für 30 blaue Flächen etwas zu sagen, was die Quelle nicht sagt,
   und für vier weisse etwas Falsches. Wenn der Betreiber es will: ein
   Feld `City.defaultWindows`/`defaultFee` mit Fundstelle, das die App als
   „laut Recht, nicht laut Daten" ausweist — und vorher die Wortlaute lesen:
   Art. 48 SSV (Fedlex) und Anhang III Ziffer 4.8 GebR mit
   Inkraftsetzungsdatum (`stadtrecht.bern.ch`, SSSB 152.03). Beide Portale
   liefern aus dieser Umgebung nur JavaScript; mit einem Browser sind es
   zehn Minuten.
2. **Die Parkfelder von `Parkplaetze_oeffentlich`.** 455 gebührenpflichtige
   und 3.002 blaue Felder als Polygone, ohne Zeiten und Beträge. Sie würden
   zeigen, *wo* in einer Zone Parkuhren stehen — als POI oder als
   Stellplatzreihen wie in Karlsruhe. Erst sinnvoll, wenn Punkt 1
   entschieden ist; sonst sind es 3.500 graue Flächen.
3. **Die acht Flächen ohne Sachangaben.** Was sie sind, kann Tiefbau Stadt
   Bern sagen (`tiefbau@bern.ch`). Bis dahin bleiben sie draußen; ein neuer
   Abzug, in dem eine von ihnen einen Namen bekommt, nimmt sie von selbst
   mit.
4. **Kein `towedVehicles`.** Die Suche auf `bern.ch` nach abgeschleppten
   Fahrzeugen findet nur das „Handbuch Polizeiaufgaben der Gemeinden";
   zuständig ist die Kantonspolizei Bern, deren Seiten nicht durchsucht
   wurden. `OHNE_BELEG` in `city.test.ts`.
5. **`opendata.swiss`** antwortet aus dieser Umgebung mit 403 (CKAN-API und
   Weboberfläche). Der Eintrag der Stadt dort wäre eine zweite Fundstelle für
   die Lizenz; gebraucht wird er nicht, der Geodatenkatalog der Stadt ist
   die erste Hand.

## Prüfstand

Am 17. September 2026 in diesem Worktree grün:

```
cd app && pnpm -r typecheck          # alle vier Pakete
cd app && pnpm test                  # core 1341, ingest 106, api 101, web 311
./scripts/sprache-pruefen.sh
node scripts/doku-pruefen.mjs
./scripts/namen-pruefen.sh
./scripts/commit-pruefen.sh
```

Nicht gelaufen, absichtlich: die E2E-Suite (läuft zentral) und der Kachelbau.

## Dateien

| Datei | Inhalt |
| --- | --- |
| `app/packages/core/src/bern.ts` | `parseBernZoneName`, `bernZoneNameFromPlz`, `parseBernFieldType`, `parseBernInfo`, `isBernZoneUnattributed`, `bernZoneNote`, `BernParseError`, `BernZoneProperties` |
| `app/packages/core/test/bern.test.ts` | 30 Tests: jeder Wert des Abzugs, Unfug, die Zone im Tarifmodell, Stadtgrenzen, Lizenz |
| `app/packages/core/test/fixtures/bern-parkkartenzonen-2026-09-17.json` | alle 42 Attributzeilen, wörtlich, ohne Geometrie |
| `app/packages/ingest/src/build-data-bern.ts` | der Datenbau |
| `app/apps/web/public/data/bern/` | `zones.geojson` (34), `districts.geojson` (32), leere `poi.geojson` und `umweltzone.geojson`, `meta.json` |
