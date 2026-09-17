# Wien als elfte Stadt — gemessen, entschieden, offen

> **Wo der Code liegt.** `app/packages/core/src/wien.ts` (Parser, Zonenschlüssel
> und die Parkometerabgabeverordnung als Konstante),
> `app/packages/ingest/src/build-data-wien.ts` (Datenbau) mit
> `app/packages/ingest/src/linien-puffer.ts` (das Band um eine Geschäftsstraße),
> `app/apps/web/public/data/wien/` (der Abzug), Tests in `core/test/wien.test.ts`,
> `ingest/test/linien-puffer.test.ts`, `web/test/schmale-flaeche.test.ts` und in
> den gemeinsamen Testdateien.

> **Stand 17. September 2026.** Wien ist angeschlossen: Parser, Datenbau,
> Stadt-Konstante, Abzug und Einträge in den gemeinsamen Dateien liegen im
> Repository; der Kalender `AT-W` stand seit dem 16. September bereit. Es ist
> die erste Stadt außerhalb Deutschlands. Was offen bleibt, steht unten — vor
> allem, dass die Stadt selbst nirgends schreibt, dass die Kurzparkzone an
> Feiertagen nicht gilt; der Parser liest es aus dem Wort „werktags" auf den
> Schildern.

Alle Zahlen hier sind an diesem Tag gegen den Dienst selbst gemessen, nicht
aus [docs/staedte-recherche-2026-09-16.md](staedte-recherche-2026-09-16.md)
übernommen. Wo die Messung von der Recherche abweicht, steht es dabei: Es sind
**796** Streifen, nicht 795, und die WFS-Angabe zur Lizenz ist nur eine von
zwei.

## Die Quellen

Drei Typnamen, ein GeoServer: `https://data.wien.gv.at/daten/geo`, WFS 2.0.0,
Arbeitsbereich `ogdwien`. Abgerufen als `application/json` mit
`srsName=urn:ogc:def:crs:EPSG::4326`.

| | Kurzparkzone (Fläche) | Kurzparkzone (Linie) | Bezirksgrenzen |
| --- | --- | --- | --- |
| Typname | `ogdwien:KURZPARKZONEOGD` (`V_OGD_KURZPARK_F`) | `ogdwien:KURZPARKSTREIFENOGD` (`V_OGD_KURZPARK_L`) | `ogdwien:BEZIRKSGRENZEOGD` (`V_OGD_BEZIRK_F`) |
| Umfang | `resultType=hits` → 81; Abruf 81 (49 Polygone, 32 MultiPolygone), 9.912.233 Bytes, 383.289 Stützpunkte | hits → **796**; Abruf 796 (795 LineStrings, 1 MultiLineString), 338.233 Bytes, 2.077 Stützpunkte | hits → 23; Abruf 23 Polygone, 3.071.039 Bytes |
| Inhalt | `BEZIRK` (int), `BEZIRK2` (int, 3-mal), `ZEITRAUM`, `DAUER`, `GUELTIG_VON`, `WEBLINK1` (immer null), `WEBLINK2`, `SE_SDO_ROWID`, `SE_ANNO_CAD_DATA` | `BEZIRK` (int), `STRNAM`, `GELTUNGSBEREICH` (6-mal null), `ZEITRAUM`, `DAUER`, `GUELTIG_VON`, `SE_SDO_ROWID`, `SE_ANNO_CAD_DATA` | `NAMEK`, `BEZNR`, `NAMEK_NUM`, `BEZ_RZ`, Statistik-Codes, `FLAECHE`, `UMFANG`, `AKT_TIMESTAMP` |
| Lizenz | siehe unten — CC BY 4.0 laut Nutzungsbedingungen und Katalog, CC BY 3.0 AT laut `ows:Fees` des WFS | dieselbe | dieselbe; Katalogeintrag „Bezirksgrenzen Wien" (`2ee6b8bf-…`) |
| Aktualität | `GUELTIG_VON` 12 Werte, 56-mal `2022-02-28Z` (die flächendeckende Einführung am 1. März 2022), jüngster `2025-04-06Z`; Katalog `modified` 2025-11-20 | `GUELTIG_VON` 127 Werte, jüngster `2026-03-22Z`; zweimal der Platzhalter `1111-11-10Z` | `AKT_TIMESTAMP` `2026-09-01Z` |

**Die Lizenz, zweimal verschieden.** `GetCapabilities` (371 KB) sagt
`<ows:Fees>https://creativecommons.org/licenses/by/3.0/at/deed.de</ows:Fees>`
und `<ows:AccessConstraints>https://data.wien.gv.at/nutzungsbedingungen</ows:AccessConstraints>`.
Diese Adresse leitet auf `https://digitales.wien.gv.at/ogd-nutzungsbedingungen/`
weiter (Seite zuletzt geändert 2021-07-05), und dort steht wörtlich:

> Open Government Data der Stadt Wien stehen unter einer „Creative Commons
> Namensnennung 4.0 Lizenz" (CC BY 4.0). LizenznehmerInnen dürfen die Daten
> unter Beachtung folgenden Bedingungen vervielfältigen, verbreiten,
> öffentlich zugänglich machen, kommerziell nutzen, sowie Abwandlungen und
> Bearbeitungen des Werkes bzw. des Inhalts anfertigen. Die Namensnennung der
> Stadt Wien als Rechteinhaberin hat in folgender Weise zu erfolgen:
> „Datenquelle: Stadt Wien – data.wien.gv.at"

Der Katalog `data.gv.at` (Hub-API, `/api/hub/search/datasets/6858b208-62bc-424e-9d7b-c89b74d3d3e3`,
Datensatz „Kurzparkzonen Wien", Herausgeber „Stadt Wien", `open@post.wien.gv.at`)
führt an jeder der 19 Verteilungen `license: https://creativecommons.org/licenses/by/4.0/deed.de`.
Beide Fassungen verlangen die Nennung; 4.0 verlangt dazu den Hinweis auf den
Gewährleistungsausschluss (§ 3 a) 1) A) iv)), 3.0 AT nicht. Die App hält sich
an **4.0**, die strengere und die von der Stadt selbst benannte:
`licenceFamily: 'cc-by'`, `attributionRequired: true`, `source` wörtlich
„Datenquelle: Stadt Wien – data.wien.gv.at". Die 3.0-Angabe im WFS ist
vermutlich ein Rest von vor 2018; die Rückfrage steht unter „Was offen bleibt".

**Nicht abgerufen:** `PARKENGELTUNGOGD` (238 Geltungsbereiche) und
`PARKENBERECHTOGD` (24 Berechtigungszonen) tragen `TEXT_RECHT: "…haben keine
Rechtsgültigkeit"` und beantworten die Parkpickerl-Frage, nicht die
Gebührenfrage; `PARKENANRAINEROGD` (1.356 Anrainerparkplätze);
`PARKENAUTOMATOGD` (206 Punkte) sind **Verkaufsstellen** der Wiener Linien —
Wien hat keine Parkscheinautomaten am Straßenrand, gezahlt wird mit
vorgekauftem Parkschein oder HANDYPARKEN.

**Zwei Abrufe, ein Unterschied.** Der `curl`-Abruf um 18:18 Uhr und der
`fetch-data`-Abzug um 18:34 Uhr sind in Kennungen, Geometrie und Sachdaten
identisch — bis auf `timeStamp` im Kopf und `SE_ANNO_CAD_DATA`, das bei drei
Flächen und mehreren Bezirken einen Oracle-Objektnamen wie `[B@1d3aabc`
trägt, der sich je Anfrage ändert. Das Feld ist keine Aussage über die Zone,
und der Datenbau liest es nicht.

## Die Eigenheit, die alles bestimmt: Die Geschäftsstraße überstimmt die Fläche

Die 81 Flächen sind die **flächendeckenden** Kurzparkzonen, je Bezirk ein
oder mehrere Stücke (Hernals 10, Meidling und Landstraße je 9). Sie decken den
bebauten Stadtraum ab; nur am Rand — Donaustadt östlich der Raffineriestraße,
Liesing im Süden — liegt Stadtgebiet außerhalb jeder Fläche, und dort gilt
laut Stadt tatsächlich keine oder eine abweichende Regelung.

Die 796 Streifen sind die **Geschäftsstraßen**: „Geschäftsstraßen sind aus der
flächendeckenden Kurzparkzone in Wien ausgenommen" (Stadt Wien,
`wien.gv.at/verkehr/kurzparkzonen-geschaeftsstrassen`, 17. September 2026).
Sie liegen **innerhalb** der Bezirksflächen — 795 von 796 mit ihrem ersten
Stützpunkt im genannten Bezirk, einer auf der Bezirksgrenze — und tragen
eigene Zeiten und eine eigene Höchstparkdauer: meist bis 18 Uhr statt 22, 1,5
statt 2 Stunden, dafür auch samstags. Wer in der Währinger Straße 121 um
19 Uhr nur die Fläche fragt, hört „kostet bis 22 Uhr, 2 h" — und die Stadt
sagt dort „seit 18 Uhr frei".

Der Datenbau löst das an zwei Stellen, und beide sind gemessen:

1. **Aus Linien werden Bänder.** Die App kennt nur Polygone (`loadZones`
   nimmt `Polygon` und `MultiPolygon`, `zoneAt` rechnet Punkt-in-Polygon).
   `bufferLine` in `linien-puffer.ts` legt um jede Linie ein Band von
   **2 × 12 m** mit Gehrungsecken (Streckung auf das Vierfache begrenzt) und
   flachen Enden. Die Streifen sind im Median 53 m lang (5 bis 348 m), 627 von
   796 haben genau zwei Stützpunkte, die Summe ist 49 km. Zwölf Meter: Eine
   Wiener Geschäftsstraße ist mit Gehsteigen 15 bis 25 m breit, die Parkspur
   also 5 bis 10 m von der Achse entfernt, und eine Ortung liegt noch einmal
   bis zu 10 m daneben; 20 m zögen Ortungen aus der Querstraße herein, die zur
   Bezirkszone gehören. Die Bänder sind 797 Stück (Erdberger Lände ist ein
   MultiLineString aus zwei Teilen).
2. **Bänder stehen vor Flächen.** `zoneAt` nimmt den **ersten** Treffer in
   `zones.geojson`; die 796 Bänder stehen deshalb vor den 105 Flächenstücken.
   Wer die Reihenfolge umdreht, macht jede Geschäftsstraße unsichtbar, und
   nichts würde rot. Geprüft am Probebau: Währinger Straße 121
   (16,3402 / 48,2270) → `Währinger Straße 121 bis 123`, Stephansplatz → `1`,
   Elterleinplatz → `17`, Reinprechtsdorfer Straße → `4+5`.

Auf der Karte liegen die Bänder als schmale Streifen über den Bezirksflächen
und färben sich nach ihrer eigenen Zeit — um 19 Uhr an einem Werktag also
frei über einer Fläche, die noch kassiert. Das ist die richtige Aussage.

**Ein Stück je Feature.** 32 der 81 Flächen sind MultiPolygone, und eines
davon (Meidling, `KURZPARKZONEOGD.44534`) besteht aus fünf Stücken von 850 bis
27.000 m², verstreut über einen Rahmen von 2,1 × 2,6 km. `representativePoint`
im Web sucht auf einem 13 × 13-Raster über dem Rahmen — bei 175 m Schrittweite
traf es keines der Stücke. Der Datenbau zerlegt deshalb jedes MultiPolygon in
seine Stücke: 81 Flächen werden **105** Features mit demselben Schlüssel, wie
Hamburgs Stücke einer Zone. Ein 1-m²-Splitter in Meidling fällt beim
Vereinfachen weg.

**Und ein Stück, das schmaler ist als das Raster.** Hernals führt einen
Straßenzug von rund 800 m Länge und 6 m Breite, schräg in einem Rahmen von
617 × 496 m — bei 50 m Schrittweite trifft keiner der 169 Rasterpunkte. Der
alte Rückfall in `representativePoint` gab den ersten Stützpunkt zurück,
„wenigstens auf der Kante"; für `zoneAt` heißt auf der Kante nicht drin, und
„hier geparkt" aus dem Panel lag neben der Fläche. Seit dem 17. September
versetzt die Funktion jede Kantenmitte um 0,1 m und 1 m nach innen und nimmt
den ersten Treffer; `web/test/schmale-flaeche.test.ts` baut den Fall nach,
`flaechenpunkt.test.ts` hält ihn über alle 901 Wiener Flächen.

## Die Zeitangabe

**26 Schreibweisen**, alle gezählt, alle gelesen — 3 auf den Flächen, 23 auf
den Streifen:

| Flächen (`ZEITRAUM`) | Anzahl |
| --- | --- |
| `Mo.-Fr. (werkt.) v. 9-22 Uhr` | 78 |
| `Mo.-Fr. (werkt.) v. 8-11 Uhr` | 2 (Donaustadt, Döbling — Stadtrand) |
| `Mo.-Fr. (werkt.) v. 8-18 Uhr; Sa. (werkt.) v. 8-12 Uhr` | 1 (Hietzing) |

| Streifen (`ZEITRAUM`) | Anzahl |
| --- | --- |
| `Mo.-Fr. (w.) v. 8-18h, Sa. (w.) v. 8-12h` | 667 |
| `Mo.-Fr. (w.) v. 9-18h, Sa. (w.) v. 9-12h` | 34 |
| `Mo.-Fr. (w.) v. 9-19h, Sa. (w.) v. 9-12h` | 22 |
| `Mo.-Fr. (w.) v. 9-18h` | 16 |
| `Sa. (w.) v. 8-12h` | 14 |
| `Mo.-Fr. (w.) v. 8-20h, Sa. (w.) v. 8-12h` | 13 |
| `Mo.-Fr. (w.) v. 8-18h` | 6 |
| `Mo.-Sa. (w.) v. 8-18h` | 3 |
| `Sa. (w.) v. 8-13h` | 3 |
| `Sa. (w.) v. 8-18h` | 2 |
| `Mo.-Fr. (werkt.) v.9-22h` | 2 |
| `Mo.-Fr. (w.) v. 8:30-18h, Sa. (w.) v. 8:30-12h` | 2 |
| `Mo.-Fr. (w.) v. 9-18h, Sa. (w.) v. 8-12h` | 2 |
| `Mo.-Fr. (w.) v. 7-19h` | 1 |
| `Mo.-Fr. (w.) v. 8-17h` | 1 |
| `Mo.-Fr. (w.) v. 13-18h, Sa. (w.) v. 10-12h` | 1 |
| `Mo.-Fr. (w.) v. 9-15h, Sa. (w.) v. 9-12h` | 1 |
| `Mo.-Fr. (w.) v. 10-15h, Sa. (w.) v. 8-12h` | 1 |
| `Mo.-Fr. (werkt.) v. 8-18h` | 1 |
| `Mo.-Fr. (werkt.) v. 8-18h, Sa. (werkt.) v. 8-12h` | 1 |
| `Mo.-Fr. (w.) v. 8:30-15h, Sa. (w.) v. 8:30-12h` | 1 |
| `Mo.-Fr. (w.) v. 10.30-15h, Sa. (w.) v. 8-12h` | 1 |
| `Mo.-Fr. (w.) v. 6-18h, Sa. (w.) v. 6-12h` | 1 |

Die Grammatik: Klauseln getrennt durch `;` (Flächen) oder `,` (Streifen),
jede Klausel aus Tageskürzel mit Punkt (einzeln oder als Spanne, `Mo.-Fr.`),
der Klammer `(werkt.)` oder `(w.)`, dann `v.`, Anfang und Ende als Stunde mit
optionalen Minuten nach Doppelpunkt oder Punkt, und `Uhr` oder `h` am Schluss.
Minuten kommen mit Doppelpunkt (`8:30`, zweimal) **und** mit Punkt (`10.30`,
einmal); das Leerzeichen nach `v.` fehlt zweimal. `parseWienSchedule` liest
alle 26; was nicht dieser Form folgt — Berlins `Mo-Fr 9-22 Uhr`, Hamburgs
`werktags 9-20 Uhr`, eine Klausel ohne `(werkt.)`, eine Spanne über
Mitternacht — bricht mit `WienParseError` ab. Die Klammer `(werkt.)` ist
Pflicht, weil an ihr `freeOnHolidays` hängt (siehe Feiertage).

Die Zeit gilt je Fläche, nicht je Bezirk: Hietzing, Döbling und Donaustadt
führen je zwei verschiedene Zeiten in verschiedenen Stücken. Der Zonenschlüssel
ist trotzdem die Bezirksnummer — `zoneAt` findet das Stück, und das Stück
trägt seine Zeit.

## Die Höchstparkdauer

`DAUER`, zwei Schreibweisen: `2 h` (80 Flächen, 3 Streifen) und `1,5 h`
(1 Fläche, 793 Streifen). `parseWienMaxStay` liest Stunden mit höchstens einer
Nachkommastelle und deutschem Komma; `0 h` und alles über 3 h bricht ab —
§ 25 Abs. 1 StVO 1960: „Die Kurzparkdauer darf nicht weniger als 30 Minuten
und nicht mehr als 3 Stunden betragen" (RIS, Bundesnormen 10011336). Der
Wert steht als `maxStayMinutes` an jeder Zone; er ist hier eine Regel des
Gebiets wie in Hamburg, nicht eine Eigenschaft einzelner Abschnitte wie in
Berlin.

## Die Entscheidung zur Gebühr

**Kein Betrag im Feed**, in keinem der Felder. Wien hat einen einzigen Tarif
für die ganze Stadt, und der steht in einer Verordnung mit Fundstelle:

> Verordnung des Wiener Gemeinderats, mit der für das Abstellen von
> mehrspurigen Kraftfahrzeugen in Kurzparkzonen die Entrichtung einer Abgabe
> vorgeschrieben wird (Parkometerabgabeverordnung), ABl. der Stadt Wien
> 2005/51, zuletzt geändert durch ABl. 2025/41 (kundgemacht 9. Oktober 2025).
> § 1: „Für das Abstellen von mehrspurigen Kraftfahrzeugen in Kurzparkzonen
> (§ 25 StVO 1960) ist eine Abgabe zu entrichten." § 2: „Die Abgabe beträgt
> für jede halbe Stunde Abstellzeit 1,70 Euro, wobei für angefangene halbe
> Stunden der volle Abgabenbetrag zu entrichten ist. Beträgt die gesamte
> Abstellzeit nicht mehr als fünfzehn Minuten, ist ein Abgabenbetrag nicht zu
> entrichten […]"

Gelesen im RIS, Gemeinderecht Wien, Dokument
`GEMRE_WI_90101_F420_040_2026` (`https://www.ris.bka.gv.at/Dokumente/Gemeinderecht/GEMRE_WI_90101_F420_040_2026/GEMRE_WI_90101_F420_040_2026.html`),
verlinkt von der Stadt unter `wien.gv.at/verkehr/parken/strafen/gesetze.html`.
Gegenprobe: die Tariftabelle der Stadt (`wien.gv.at/verkehr/parkgebuehren`,
„gültig seit 1. Januar 2026"): 15 Minuten gratis, 30 Minuten 1,70 Euro,
60 Minuten 3,40 Euro, 90 Minuten 5,10 Euro, 120 Minuten 6,80 Euro. Die
Vorgängerfassung (ABl. 2022/39) nannte 1,25 Euro je halbe Stunde — die
Erhöhung ist die vom 1. Jänner 2026.

Drei Wege standen offen, wie in Cottbus:

1. `fee: unknown` wie München — ehrlich, aber Wien stünde ohne Betrag da,
   obwohl er in einer datierten Verordnung steht und für jede Zone derselbe ist.
2. Den Betrag raten — ausgeschlossen.
3. **Die Verordnung ausliefern**, als Konstante `WIEN_ORDINANCE` in
   `core/wien.ts` mit Fundstelle; `wienFee()` gibt `exact` 340 Cent je Stunde
   (2 × 1,70 €), `WIEN_RAW_FEE` steht als `rawFee` im Panel: „laut
   Parkometerabgabeverordnung: 1,70 € je angefangene halbe Stunde, die ersten
   15 Minuten gratis (nicht im Datensatz)". Gewählt — wie Salzburg es im
   Bericht der Recherche hält. Anders als in Cottbus widerspricht der Feed
   nicht, er schweigt; deshalb kein `sourceDefect`, und `meta.absent` führt
   `fee` nicht.

Was das Modell nicht ausdrückt: die fünfzehn gebührenfreien Minuten und die
Abrechnung je angefangene halbe Stunde. `Fee` kennt nur einen Stundensatz;
`estimateCost` rechnet damit linear. Beides steht in `rawFee`, und für die
Frage „kostet es hier gerade" ist der Stundensatz die richtige Antwort.

## Der Probelauf

`CITY=wien pnpm --filter @knoellchenfrei/ingest fetch-data` und
`… build-data-wien`, 17. September 2026:

```
zones … 81 features
strips … 796 features
districts … 23 features
  districts.geojson: 46 KB
  zones.geojson: 1100 KB
81 Bezirksflächen in 105 Stücken (3 für zwei Bezirke) und 796 Geschäftsstraßen
  (797 Bänder à 24 m, 1 mit erstem Stützpunkt außerhalb ihres Bezirks), 23 Bezirke
```

`zones.geojson` ist mit 1,1 MB die größte Zonendatei des Projekts (Karlsruhe
247 KB): 901 Features, davon 796 Bänder mit je rund 600 Bytes Sachdaten — die
Geometrie der Flächen ist nach der Vereinfachung mit 1e-5 nur 330 KB (aus
9,9 MB). Wer die Datei kleiner braucht, kürzt `rawFee` und `note` je Band;
gzip über die Kante bringt die Wiederholungen ohnehin auf einen Bruchteil.
`meta.json`: `zones: 901`, `areas: 81`, `strips: 796`, `districts: 23`,
`absent: ['poi', 'lowEmissionZone', 'segments']`. Die Einheiten der
Langzeitmuster: 23 Zonen (die Bezirksschlüssel, alle über 2 ha) und 22
Bezirke (die Bänder, alle unter 2 ha, zählen für ihren Bezirk) — 45 Einheiten.

## Der Rahmen der Stadt

`reportBounds` aus den 23 Bezirksgrenzen: 16,1818–16,5775 / 48,1179–48,3227,
nach außen gerundet 16,18–16,58 / 48,11–48,33. Die 81 Flächen reichen
16,1999–16,5527 / 48,1210–48,3054 — fast dasselbe, weil die Kurzparkzone
flächendeckend ist. Mittelpunkt Stephansplatz (16,3725 / 48,2083), Zoom 11,5
wie Berlin: 0,40° × 0,20°, bei 12 fielen Floridsdorf und Liesing aus dem
ersten Bild. `sessionBounds` 15,9–16,9 / 47,9–48,55. Keine Überschneidung mit
einer anderen Stadt; München liegt 3° westlich. Was das Rechteck nicht
trennt: Schwechat und Klosterneuburg liegen im Rahmen um die Bezirke — wie in
jeder Stadt, ein Rechteck ist keine Stadtgrenze.

## Feiertage: Wien

Der Kalender `AT-W` stand seit dem 16. September in `holidays.ts`, mit
Beleg: § 7 Abs. 2 Feiertagsruhegesetz 1957, dreizehn Tage, alle Bundesrecht,
Karfreitag keiner. Neu ist nur die Frage, ob die Kurzparkzone an diesen Tagen
gilt — und die Antwort steht nicht bei der Stadt, sondern auf dem Schild:

- Jede der 26 Zeitangaben trägt `(werkt.)` oder `(w.)`, und die Stadt
  schreibt die Regel als „Montag bis Freitag (werktags) von 9 bis 22 Uhr"
  (`wien.gv.at/verkehr/kurzparkzonen`). Ein gesetzlicher Feiertag ist kein
  Werktag; das Feiertagsruhegesetz stellt ihn dem Sonntag gleich.
- Der ÖAMTC sagt es ausdrücklich (OTS-Aussendung vom 4. Dezember 2005,
  „Keine Kurzparkzone am Feiertag in den Landeshauptstädten"): die
  Kurzparkzonen treten „an einem gesetzlichen Feiertag außer Kraft" — mit den
  Ausnahmen „Bahnhofs-, Spitalsbereiche und in Wien die Abend-Kurzparkzone
  rund um die Stadthalle". Dieselbe Auskunft in der Presse zu jedem 8.
  Dezember und 24. Dezember (der ein Werktag ist und kassiert).
- Die Seiten der Stadt selbst nennen weder Sonntag noch Feiertag; der Leser
  soll es aus „werktags" schließen.

Deshalb `freeOnHolidays: true` an jeder Wiener Zone, und der Parser verlangt
die Klammer: Eine Klausel ohne `(werkt.)` sagte etwas anderes, und was, weiß
niemand. Die Stadthalle-Abendzone (Samstag, Sonn- und Feiertag 18–22 Uhr laut
ÖAMTC) steht **nicht** im Feed — die 81 Flächen kennen keine Sonn- oder
Feiertagsklausel; siehe „Was offen bleibt". Der 15. November (Leopold) ist
kein gesetzlicher Feiertag und kassiert; getestet in `laender.test.ts`.

## Was einzutragen bleibt

Nichts — alles ist in diesem Zweig eingetragen. Die Stellen, die beim
Zusammenführen Konflikte machen können:

| Datei | Eintrag |
| --- | --- |
| `app/packages/core/src/city.ts` | `WIEN` und `CITIES` |
| `app/packages/core/src/index.ts` | `export * from './wien.js'` |
| `app/packages/ingest/src/sources.ts` | `WIEN_SOURCES`, `BY_CITY` |
| `app/packages/ingest/package.json` | `build-data-wien` |
| `app/packages/core/test/{city,fixture-shape,fuzz}.test.ts` | je ein Block; in `city.test.ts` dazu das Muster der Telefonnummer (`+43`) |
| `app/packages/ingest/test/quellen.test.ts` | Block „die Wiener Quellen", `wien` in der Liste |
| `app/apps/web/src/zones.ts` | Rückfall in `representativePoint` (Kantenmitte nach innen) |
| `app/apps/web/statistik/main.ts` | `STADTNAMEN.wien` |
| `NOTICE`, `README.md`, `docs/staedte.md`, `docs/data-sources.md`, `docs/todo.md`, `CLAUDE.md` | je eine Zeile bzw. ein Abschnitt |
| erzeugt | `core/src/zone-keys.generated.ts`, `core/src/zone-units.generated.ts`, `apps/api/src/zone-units.generated.json` |

Die Stadtlisten in `deploy.yml`/`kacheln.yml` und die Tests `flaechenpunkt`,
`quellen`, `zone-units` kommen aus `CITIES`. Nicht angefasst, wie vereinbart:
`index.html`, `manifest.webmanifest`, `login-page.ts`.

## Was offen bleibt

1. **Lizenzangabe im WFS.** `ows:Fees` nennt CC BY 3.0 AT, Nutzungsbedingungen
   und Katalog CC BY 4.0. Rückfrage an `open@post.wien.gv.at`, ob die
   3.0-Angabe im `GetCapabilities` ein Rest ist; bis dahin gilt 4.0, die
   strengere.
2. **Feiertage, von der Stadt bestätigt.** Keine Seite auf wien.gv.at sagt
   „an Feiertagen gilt die Kurzparkzone nicht"; belegt ist es über das Wort
   „werktags" und den ÖAMTC. Rückfrage an die MA 46 (Verkehrsorganisation)
   oder MA 67 (Parkraumüberwachung), am besten mit der Bitte um den Satz auf
   der Kurzparkzonen-Seite.
3. **Die Abend-Kurzparkzone Stadthalle** (laut ÖAMTC auch Samstag, Sonn- und
   Feiertag 18–22 Uhr) steht nicht im Feed; die Flächen 14+15 tragen
   `Mo.-Fr. (werkt.) v. 9-22 Uhr`. Ob die Regel noch gilt und wo genau, muss
   die MA 46 sagen; bis dahin liefert die App den Feed aus.
4. **Fünfzehn gebührenfreie Minuten und Halbstundentakt** kennt `Fee` nicht;
   `estimateCost` rechnet linear mit 3,40 €/h. Für „kostet es gerade" ohne
   Folge, für „was kostet eine Stunde und zehn Minuten" um 1,70 € zu wenig.
   Ein `Fee`-Feld für Taktung und Freiminuten wäre der Weg; Cottbus und
   Karlsruhe (Mindestgebühr) hätten denselben Nutzen.
5. **Die Bandbreite von 12 m** ist begründet, nicht gemessen. Wer eine
   Straßenbreiten-Ebene der Stadt findet (`STRASSENGRAPHOGD` führt keine
   Breite), kann sie je Streifen setzen.
6. **`zones.geojson` mit 1,1 MB** — die größte Zonendatei; siehe Probelauf.
7. **Kachelarchiv.** `wien.pmtiles` muss über `kacheln.yml` gebaut und nach R2
   geladen werden; Protomaps deckt Österreich ab.
8. **Beschreibungstexte** in `index.html`, `manifest.webmanifest` und
   `login-page.ts` nennen Wien noch nicht (zentral).

## Prüfstand

Am 17. September 2026 in diesem Worktree grün: `pnpm -r typecheck`,
`pnpm test` (core 1118, api 101, ingest 62, web 308),
`./scripts/sprache-pruefen.sh`, `node scripts/doku-pruefen.mjs`,
`./scripts/namen-pruefen.sh`, `./scripts/commit-pruefen.sh`. E2E-Suite und
Kachelbau laufen zentral.

## Dateien

| Datei | Inhalt |
| --- | --- |
| `app/packages/core/src/wien.ts` | Zeit- und Höchstparkdauer-Parser, Zonenschlüssel für Flächen und Streifen, `WIEN_ORDINANCE`, `wienFee`, `WIEN_RAW_FEE`, Rohfeldtypen |
| `app/packages/core/test/wien.test.ts` | Parser gegen jede der 26 Schreibweisen und gegen Unfug, Schlüssel, der echte Abzug, eine Zone im Modell gegen `AT-W` |
| `app/packages/core/test/fixtures/wien-kurzparkzonen-2026-09-17.json` | alle 81 Flächen, Sachdaten wörtlich, Zählung, erster Stützpunkt |
| `app/packages/core/test/fixtures/wien-geschaeftsstrassen-2026-09-17.json` | 32 Streifen (je Schreibweise einer plus Sonderfälle), Zählung aller 796 |
| `app/packages/core/test/fixtures/wien-bezirke-2026-09-17.json` | alle 23 Bezirke, Sachdaten ohne Geometrie |
| `app/packages/ingest/src/build-data-wien.ts` | Datenbau: Bezirke, Bänder vor Flächen, ein Stück je Feature, fünf Ausgabedateien |
| `app/packages/ingest/src/linien-puffer.ts` | `bufferLine`: das Band um eine Linie, Gehrung gedeckelt |
| `app/packages/ingest/test/linien-puffer.test.ts` | Bandbreite, Knick, spitze Kehre, Entartungen |
| `app/apps/web/test/schmale-flaeche.test.ts` | der Hernalser Straßenzug, nachgebaut |
| `app/apps/web/public/data/wien/` | der Abzug |
