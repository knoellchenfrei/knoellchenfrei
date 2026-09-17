# Datenquellen

Alle in der App verwendeten Daten mit Herkunft, Lizenz und Abrufweg. Stand der
Erhebung: 6. September 2026 für Berlin und Hamburg, 7. September 2026 für
Frankfurt am Main und München, 16. September 2026 für Salzburg. Acht Städte,
zwei Staaten, **drei Lizenzfamilien** — der Unterschied steht bei Hamburg und
bei Salzburg.

## Verwendet

Die **Berliner** Geodaten stammen von der **Geodateninfrastruktur Berlin**
(`gdi.berlin.de`), WFS 2.0.0, Lizenz **[Datenlizenz Deutschland Zero
2.0](https://www.govdata.de/dl-de/zero-2-0)** — freie Nutzung, keine
Namensnennung erforderlich, keine Weitergabebedingungen.

| Layer | Umfang | Verwendung in der App |
| --- | --- | --- |
| `parkraumbewirtschaftung:parkzonen` | 103 Zonen | Polygone, Geltungszeiten, Tarife |
| `parkplaetze:parkplaetze` | 45.917 Segmente | Höchstparkdauer, Kapazität, Ladepunkte, Carsharing — je Zone aggregiert |
| `park_and_ride:park_and_ride` | 49 Anlagen | P+R-Layer |
| `park_and_ride:park_and_ride_umland` | 59 Anlagen | P+R-Layer (Umland) |
| `behindertenparkplaetze:bpark` | 923 Standorte | Behindertenparkplätze |
| `umweltzone:umweltzone` | 1 Polygon | Umweltzonen-Umriss |
| `alkis_ortsteile:ortsteile` | 97 Ortsteile | Kartenkontext ohne externe Kacheln |

Abruf: `pnpm --filter @knoellchenfrei/ingest fetch-data`. Die Endpunkte stehen in
[`app/packages/ingest/src/sources.ts`](../app/packages/ingest/src/sources.ts).

Kartenkacheln: **OpenStreetMap** (`tile.openstreetmap.org`), © OpenStreetMap-Mitwirkende,
[ODbL](https://www.openstreetmap.org/copyright). Die Namensnennung ist in der App
sichtbar und Lizenzbedingung. Für einen produktiven Betrieb wäre eine eigene
Kachelquelle nötig — die
[Tile Usage Policy](https://operations.osmfoundation.org/policies/tiles/) der OSM
Foundation deckt ausgelieferte Anwendungen nicht ab. Der belegte Weg dorthin
steht in [docs/hosting.md](hosting.md): ein PMTiles-Archiv in Objektspeicher,
kein laufender Kachelserver — so macht es FreiFahren.

## Die Löcher in den Berliner Parkzonen — geprüft, nicht unsere

Am 7. September fiel auf, dass die Zonenkarte Löcher hat, das grösste rund
6 km² zwischen Zoologischem Garten und Tiergarten. Der Verdacht lag auf dem
eigenen Datenbau. Er trifft nicht zu, und der Weg dahin gehört aufgeschrieben,
weil er beim nächsten Zweifel wieder trägt.

| Geprüft | Ergebnis |
| --- | --- |
| `resultType=hits` gegen den Dienst | `numberMatched="103"` — genau so viele wie im Bestand |
| Frischer Abruf gegen die vorhandene Datei | **byteweise identisch**, 299.224 Bytes |
| Zonen, deren Geometrie sich geändert hat | **0** |
| Innenringe in den 103 Polygonen | **0** — es sind Lücken zwischen Flächen, keine ausgestanzten Löcher |
| Vereinfachung im Datenbau | `1e-6` Grad, rund 10 cm — erzeugt keine sichtbaren Lücken |
| Berlins **eigene** Darstellung (WMS `GetMap`, `layers=parkzonen`) | zeigt dieselben Löcher |
| Umschlossene Lücken im Innenstadtring | 12, jede davon Park oder Bahngelände |
| Strassenabschnitte im grössten Loch | 810, davon sagen **762 selbst** `nicht bewirtschaftet` |

Der WMS ist dabei das schärfste Werkzeug: Derselbe Anbieter zeichnet denselben
Datensatz, und wenn seine Karte aussieht wie unsere, liegt es nicht an uns.

```bash
curl -o berlin.png 'https://gdi.berlin.de/services/wms/parkraumbewirtschaftung?service=WMS&version=1.3.0&request=GetMap&layers=parkzonen&styles=&crs=EPSG:4326&bbox=52.49,13.30,52.53,13.40&width=1000&height=400&format=image/png'
```

Der Layer heisst dort **`parkzonen`**, nicht `parkraumbewirtschaftung:parkzonen`
— mit Präfix antwortet der Dienst `LayerNotDefined` als XML, und zwar mit
`HTTP 200`.

**Was dabei wirklich schief ist**, und zwar in der Quelle: 421 Strassen-
abschnitte tragen eine Gebühr und Bewirtschaftungszeiten, liegen aber in keinem
Zonenpolygon; 354 davon behaupten zugleich `zone = "nicht bewirtschaftet"`.
Schwerpunkte sind Reinickendorf, Steglitz-Zehlendorf und Tempelhof-Schöneberg —
Gegenden, in denen die Bewirtschaftung neu ist. Die Folge in der App steht als
Befund in [todo.md](todo.md).

**Zur Zahl 103:** Die Zonen*nummern* laufen von 1 bis **138**, 39 Nummern
dazwischen gibt es nicht, und acht Zonen tragen einen Bezirkszusatz (`9-CW`,
`9-TS`, `17-CW`, `17-TS`, `41-Mitte`, `41-Pankow`, `51-Arena Süd`,
`51-OberbaumCity`). Wer die höchste Nummer für die Anzahl hält, erwartet mehr
als 103. Hamburg hat 145 Gebiete, München 82, Frankfurt 27 — auch das eine
Quelle für „das waren doch mehr".

## Bewusst nicht verwendet

| Quelle | Umfang | Warum nicht |
| --- | --- | --- |
| `parkplaetze:parkplaetze_aussen` | **214.173** Segmente | Jede Zeile meldet `zone = "nicht bewirtschaftet"`. Der Layer beantwortet für ~190 MB eine Frage, die die App ohne ihn beantwortet: Findet der Zonen-Lookup nichts, ist Parken dort gebührenfrei. |
| Parkscheinautomaten | Nur Bezirk Pankow, Stand 2021 | Ein Bezirk, fünf Jahre alt, und CC-BY statt DL-DE/Zero — der Lizenzwechsel brächte eine Namensnennungspflicht für wenig Nutzen. Kein WFS, nur CSV/XLSX. |
| `eladeinfrastruktur` | 25 Features | Enthält keine Ladesäulen-Standorte, nur Planungshilfen. Das Feld `ladesaeule` im Segment-Layer ist die bessere Quelle. |
| OpenStreetMap Parkhäuser | unbestimmt | Die einzige Quelle für Tiefgaragen in Berlin, aber ODbL mit Share-alike: Ein Snapshot, der OSM-Daten mit den Berliner Segmenten verschmilzt, wäre eine abgeleitete Datenbank und müsste selbst unter ODbL stehen. Machbar als **getrennter** Layer, bisher nicht umgesetzt. |

## Verwendet — Hamburg

Abgerufen am 6. September 2026 von der **Freien und Hansestadt Hamburg**,
Landesbetrieb Geoinformation und Vermessung, über `geodienste.hamburg.de`,
WFS 2.0.0. Zwei Ebenen:

| Ebene | Typname | Umfang |
| --- | --- | --- |
| Bewohnerparkgebiete | `de.hh.up:bewohnerparkgebiete` | 146, davon 145 aktiv |
| Stadtteile | `app:stadtteile` | 104, nur als Kartenkontext |

**Lizenz: [Datenlizenz Deutschland Namensnennung 2.0](https://www.govdata.de/dl-de/by-2-0).**
Das ist der Unterschied zu Berlin, und er ist keine Formalie: Berlin gibt unter
*Zero* heraus, Nennung freiwillig; bei Hamburg ist die Quellenangabe
**Lizenzbedingung**. `City.attribution.attributionRequired` trägt sie bis in
die Einstellungen, wo sie als Bedingung benannt wird und nicht als Fußnote.

Zwei Dinge, die man erst im Feed sieht und die deshalb hier stehen:

- **Das Ausgabeformat heißt `application/geo+json`**, nicht `application/json`
  wie in Berlin. Falsch angefragt antwortet der Dienst nicht mit einem Fehler,
  sondern mit GML — gültigem XML, an dem `JSON.parse` scheitert, mit einer
  Meldung, die nach kaputten Daten aussieht statt nach einer falschen Anfrage.
- **Die Achsenreihenfolge ist umgekehrt.** Auf dieselbe Anfrage
  (`srsName=urn:ogc:def:crs:EPSG::4326`) antwortet Berlin `[lon, lat]` und
  Hamburg `[lat, lon]`. Hamburg folgt der URN-Form, Berlin der
  GeoJSON-Konvention; beides ist verteidigbar. Ungedreht liegen die Gebiete im
  Golf von Guinea, und die Karte sieht dabei nur leer aus.

**Die Beschreibung des Dienstes nennt veraltete Preise** — drei Zonen zu 3, 2
und 1 € je Stunde. Der Feed selbst trägt 4,00 / 3,50 / 3,00 / 2,00 €, die
Sätze seit dem 1. Juli 2026. Wer den Tarif aus dem Metadatentext liest statt
aus dem Feature, liefert falsche Preise aus.

Nicht abgerufen: **`de.hh.up:parkraum`** mit 203.283 Polygonen, je Stellplatz
eines. Ohne Tarif, mit leerem Zeitfeld — für „kostet das hier gerade etwas"
trägt die Ebene nichts bei, was die 146 Gebiete nicht schon sagen. Ebenso
fehlen POI und Umweltzone: Die einen liegen in anderen Diensten, die andere
gibt es in Hamburg nicht. `meta.json` führt beides unter `absent`.

Vollständige Feldanalyse in [staedte.md](staedte.md#hamburg-im-einzelnen).

## Verwendet — Frankfurt am Main

Abgerufen am 7. September 2026 von der **Stadt Frankfurt am Main** über
`geowebdienste.frankfurt.de`, WFS 2.0.0. Vier Ebenen aus **zwei** Diensten:

| Ebene | Dienst / Typname | Umfang |
| --- | --- | --- |
| Bewohnerparken | `/Parken`, `opendata:Bewohnerparken` | 42 Polygone, davon 27 mit Automaten |
| Parkscheinautomaten | `/Parken`, `opendata:Parkscheinautomaten` | 921 Punkte — Tarif, Zeiten, Höchstparkdauer |
| Behindertenparkplätze | `/Parken`, `opendata:Behindertenparkplaetze` | 458 Punkte, als POI |
| Stadtteile | `/WFS_Stadtgebietsgliederung`, `Stadtgebietsgliederung:Stadtteile` | 46, als Kartenkontext |

**Lizenz: [Datenlizenz Deutschland Namensnennung 2.0](https://www.govdata.de/dl-de/by-2-0)**,
wie Hamburg. Der Quellenvermerk steht im ISO-Metadatensatz wörtlich als
`Stadt Frankfurt am Main, www.frankfurt.de` und wird genau so ausgeliefert —
umformuliert erfüllt er die Bedingung nicht mehr sicher. Für die Stadtteil-Ebene
gilt derselbe Vermerk; sie ist damit unter denselben Bedingungen nutzbar.

Vier Dinge, die man erst im Feed sieht:

- **Der Tarif hängt am Automaten, nicht am Bereich.** Ein Bewohnerparkbereich
  trägt nichts als eine Nummer; `name` und `description` sind in allen 42
  Bereichen `null`. Was gilt, entsteht aus den Automaten *im* Polygon.
- **Ohne `srsName` antwortet der Dienst in EPSG:25832** — `[477189.85,
  5550859.91]`, plausible Zahlen, nur keine Grade. Mit
  `srsName=urn:ogc:def:crs:EPSG::4326` kommen `[lon, lat]` wie in Berlin.
- **Das Ausgabeformat heißt `application/json`**, nicht `application/geo+json`
  wie in Hamburg — darauf antwortet dieser Dienst mit einem
  `ows:ExceptionReport`. Der Stadtteil-Dienst läuft dagegen auf MapServer und
  nennt das Format `GEOJSON`.
- **`vti_url` trägt HTML in einem Attributwert.** Ein vollständiges
  `<a href=…>`-Element in einem Datenfeld; es wird über `stripHtml` zu Text
  gemacht, bevor irgendetwas anderes es anfasst.

Nicht abgerufen: nichts — der Parken-Dienst führt genau diese drei Typnamen.
Nicht *ausgeliefert* werden dagegen die **113 Automaten, die in keinem
Bewohnerparkbereich stehen** (über das Attribut `bewohnerparkzone` wären es
418; die geometrische Zuordnung schrumpft die Lücke auf 12 %). Eine
Umweltzonen-Geometrie fehlt ebenfalls — Frankfurt *hat* eine Umweltzone, dieser
Dienst führt sie nur nicht. `meta.json` führt beides unter `absent`; bei
Frankfurt heißt das „nicht in diesem Abzug", nicht „gibt es nicht".

Vollständige Feldanalyse in
[staedte.md](staedte.md#frankfurt-am-main-im-einzelnen).

## Verwendet — München

Abgerufen am 7. September 2026 von der **Landeshauptstadt München** über
`geoportal.muenchen.de`, WFS 2.0.0 (GeoServer). Acht Ebenen aus **zwei**
Arbeitsbereichen desselben Servers:

| Ebene | Arbeitsbereich / Typname | Umfang |
| --- | --- | --- |
| Parkraummanagementgebiete | `mor_wfs:ruhver_prm_gebiete_poly` | 82 Polygone, alle „in Betrieb" |
| Parkseiten | `mor_wfs:ruhver_parkseiten_line` | 13.714 Linien — Regel, Stellplätze, Gebietsname |
| Umweltzone | `mor_wfs:miv_umweltzone_poly` | 12 Flächen (Zone + 11 Transferflächen) |
| Behindertenparkplätze | `mor_wfs:behindertenparkplaetze` | 556 Punkte, als POI |
| Carsharing | `mor_wfs:ruhver_carsharing` | 710 Flächen, als POI |
| Ladeinfrastruktur | `mor_wfs:ruhver_els_standort_point` | 369 Punkte, als POI |
| Park und Ride | `mor_wfs:park_ride_standorte` | 25 Anlagen, als POI |
| Stadtbezirke | `gsm_wfs:vablock_stadtbezirk` | 25 Bezirke in 27 Polygonen, als Kartenkontext |

**Lizenz: [Datenlizenz Deutschland Namensnennung 2.0](https://www.govdata.de/dl-de/by-2-0)**,
wie Hamburg und Frankfurt — und hier **je Ebene einzeln geprüft**: Zu jedem
Typnamen führt `GetCapabilities` einen `MetadataURL` auf einen ISO-Datensatz im
GeoNetwork der Stadt, und jeder dieser acht Datensätze wurde abgerufen und
gelesen. Alle nennen `dl-de-by-2.0`. Der Quellenvermerk der sieben
Mobilitätsebenen lautet wörtlich:

```
Datenquelle: dl-de/by-2-0: Landeshauptstadt München – opendata.muenchen.de
```

Die Stadtbezirke weichen ab und nennen den GeodatenService:
`Datenquelle: Landeshauptstadt München - GeodatenService,
https://www.muenchen.de/rathaus/Stadtverwaltung/Kommunalreferat/geodatenservice`.
`City.attribution` trägt einen Vermerk, und das ist der der Parkdaten.

Fünf Dinge, die man erst im Feed sieht:

- **Die Regel ist ein Satz, kein Feld.** `parkregel_beschreibung` hat **291**
  verschiedene Werte, zusammengesetzt aus bis zu vier Klauseln mit eigenen
  Zeiten und Tagesangaben. Berlin hat 18 Schreibweisen, Hamburg 10,
  Frankfurt 30.
- **Ein Betrag steht nirgends.** Weder `€` noch `Euro` noch `EUR` kommt in den
  291 Texten vor. Der Tarif steht nur in der Gebührenordnung; alle 82 Gebiete
  bekommen `Fee.unknown`.
- **Ohne `srsName` antwortet der Dienst in EPSG:25832**, wie Frankfurt. Mit
  `srsName=urn:ogc:def:crs:EPSG::4326` kommen `[lon, lat]`.
- **Die Sammel-Adresse `/geoserver/ows` ist abgeschaltet** — sie antwortet mit
  `ServiceUnavailable: Service WFS is disabled`. Jeder Arbeitsbereich muss
  einzeln angefragt werden.
- **`angebot` ist eine Zeichenkette**, nicht eine Zahl: `"5"`, 44-mal `null`.

Nicht abgerufen: `ruhver_els_saeule_point` (592 Ladesäulen; dieselben Orte wie
die 369 Standorte, nur feiner gezählt), `ruhver_carsharing_station` (197
stationsbasierte Plätze neben den 710 allgemeinen) und die 40 übrigen Ebenen
des Dienstes — Radwege, Ampeln, Baustellen, Bushaltestellen. Nicht
*ausgeliefert* werden die **1.307 Straßenseiten ohne Gebietsnamen** (sie liegen
außerhalb der 82 Gebiete) und 42 weitere, die auf ein Gebiet zeigen, zu dem es
kein Polygon gibt.

Vollständige Feldanalyse in [staedte.md](staedte.md#münchen-im-einzelnen).

## Verwendet — Freiburg im Breisgau

Abgerufen am 16. September 2026 von der **Stadt Freiburg i. Br.** über
`geoportal.freiburg.de`, WFS 2.0.0 (MapServer). Vier Ebenen aus **zwei**
Diensten desselben Servers:

| Ebene | Dienst / Typname | Umfang |
| --- | --- | --- |
| Parkgebührenzonen | `gut_parken` / `ms:parkgebzonen` | 37 Polygone — Zone 1/2/3, Betrag je Stunde, Tagespauschale, Zeit |
| Parkscheinautomaten | `gut_parken` / `ms:psa` | 538 Punkte — Laufzeiten, Tarif, Höchstparkdauer; Gegenprobe zur Fläche |
| Behindertenparkplätze | `gut_parken` / `ms:behindertenparkpl_uebersicht` | 195 Standorte, als POI |
| Stadtteile | `abi_gliederung` / `ms:stadtteile` | 28 Polygone, als Kartenkontext |

**Lizenz: [Datenlizenz Deutschland Namensnennung 2.0](https://www.govdata.de/dl-de/by-2-0)**,
wie Hamburg, Frankfurt und München. Beide Dienste nennen sie wörtlich in
`ows:Fees` ihrer `GetCapabilities`:

```
Dieser Datensatz/Dienst kann gemäß der 'Datenlizenz Deutschland - Namensnennung - Version 2.0'
(https://www.govdata.de/dl-de/by-2-0) genutzt werden. 'Datengrundlage: Stadt Freiburg, www.freiburg.de'
```

Vier Dinge, die man erst im Feed sieht:

- **Die Fläche trägt Zeit und Betrag selbst** — wie Hamburg. Die Automaten
  sind Gegenprobe: 383 von 406 Automaten in einer Fläche mit lesbarer Zeit
  sagen dasselbe wie die Fläche.
- **Eine Fläche nennt keine Zeit**, sondern `Beschilderung beachten!` — die
  einzige der Zone 1 (Altstadt, 4,20 €). Ihre Zeiten kommen aus den 109
  Automaten darin (93 davon `werktags 9–23 Uhr`, was auch die Stadtseite
  nennt), und `sourceDefect` sagt es.
- **Ohne `srsName` antwortet der Dienst in EPSG:25832** — anders als Frankfurt
  mit `crs`-Objekt im GeoJSON, also angekündigt. Mit
  `srsName=urn:ogc:def:crs:EPSG::4326` kommen `[lon, lat]`.
- **Das Ausgabeformat braucht den ganzen Wert aus `GetCapabilities`**:
  `application/json; subtype=geojson; charset=utf-8`. Ohne `charset` (Kölns
  Form) antwortet der Dienst mit HTTP 400.

Nicht abgerufen: `ms:bewohnerparken` (33 Bewohnerparkgebiete ohne Zeit und
Betrag), `ms:behindertenparkplatz_detail` (328 Einzelplätze als Polygone),
`ms:gesperrte_flaechen_pr` (6). Bericht mit allen Messungen in
[staedte-freiburg.md](staedte-freiburg.md).
## Verwendet — Rostock

Abgerufen am 16. September 2026 von der **Hanse- und Universitätsstadt
Rostock** über `geo.sv.rostock.de`, WFS 2.0.0 — ein Dienst je Datensatz, alle
über den CKAN-Katalog `opendata-hro.de` gefunden:

| Ebene | Dienst / Typname | Umfang |
| --- | --- | --- |
| Bewohnerparkgebiete | `geodienste/bewohnerparkgebiete/wfs`, `hro.bewohnerparkgebiete.bewohnerparkgebiete` | 10 Polygone — die einzigen Flächen; ohne Zeiten und Betrag |
| Parkscheinautomaten | `geodienste/parkscheinautomaten/wfs`, `hro.parkscheinautomaten.parkscheinautomaten` | 111 Punkte — Zone, Tarif, Zeiten, Betrag als Zahl, Höchstparkdauer mit Einheitenfeld |
| Ortsteile | `geodienste/ortsteile/wfs`, `hro.ortsteile.ortsteile` | 31 Polygone, als Kartenkontext und Rahmen |

**Lizenz: [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/deed.de)**,
wörtlich in `ows:AccessConstraints` aller drei Dienste und im Katalog als
`license_id: cc-zero` — die vierte Lizenzfamilie des Projekts, ohne
Nennungspflicht. Der Quellenvermerk steht trotzdem.

Drei Dinge, die man erst im Feed sieht:

- **Die Tarifzonen A–D und W haben keine Geometrie.** Zone, Zeiten und
  Betrag hängen am Automaten; die Flächen sind die Bewohnerparkgebiete. 52
  der 111 Automaten stehen in einem, **59 nicht** — für die gibt es keine
  Fläche und deshalb keine Auskunft.
- **`08:00-19:00` ohne Wochentag** bei 83 Automaten heißt täglich: § 4 Abs. 2
  und 3 der Parkgebührenordnung (2022) nennt für W, A, B und C „täglich",
  nur für D „werktags Montag - Freitag" — und genau D schreibt der Feed mit
  `Mo-Fr`.
- **Die Achsen kommen als `[lat, lon]`** mit `srsName`, als `[lon, lat]` ohne
  — beides in Grad. Und ein leeres Feld **fehlt** im WFS, statt `null` zu
  tragen.

Nicht abgerufen: die fertigen Downloads (`download/opendata/<name>/<name>.json`,
ohne `bezeichnung`) und ein möglicher Datensatz der Behindertenparkplätze.
Vollständiger Bericht in [staedte-rostock.md](staedte-rostock.md).
## Verwendet — Cottbus

Abgerufen am 16. September 2026 von der **Stadt Cottbus/Chóśebuz**,
Fachbereich Ordnung und Sicherheit, über `datenportal.cottbus.de` — ein
**ArcGIS FeatureServer**, kein WFS. Zwei Ebenen im Ordner `FB32`:

| Ebene | Adresse | Umfang |
| --- | --- | --- |
| Bewohnerparkzonen | `FB32/Bewohnerparkzonen/FeatureServer/7` | 5 Polygone, `Parkzone II` bis `VI` |
| Parkscheinautomaten | `FB32/Parkscheinautomaten/FeatureServer/1` | 44 Punkte, einer ohne Geometrie |

**Lizenz: [Datenlizenz Deutschland Namensnennung 2.0](https://www.govdata.de/dl-de/by-2-0).**
Die Hub-Einträge beider Ebenen verlangen wörtlich, „als Rechteinhaber und
Bereitsteller ist ‚Stadt Cottbus/Chóśebuz', sowie das Jahr des Datenbezugs in
Klammern anzugeben" — der Quellenvermerk lautet deshalb
`Stadt Cottbus/Chóśebuz (2026)`.

Drei Dinge, die man erst im Feed sieht:

- **Der Feed nennt den Stand von 2014.** `gebuehr` = 1 bzw. 0,5 Euro je
  Stunde und `wt_bew_ende` = `19:00` sind die Werte der Parkgebührenordnung
  vom 1. Januar 2014. Seit dem 1. Juni 2025 gelten 2,00 bzw. 1,00 € und
  Montag bis Freitag bis **20:00** Uhr. Ausgeliefert wird die Ordnung, mit
  `sourceDefect` je Zone; der Datenbau bricht ab, sobald der Feed etwas
  Drittes nennt. Begründung in [staedte-cottbus.md](staedte-cottbus.md).
- **Die Abfrage ist keine WFS-Anfrage.** `…/query?where=1%3D1&outFields=*&f=geojson&outSR=4326`;
  ohne `outSR` bleibt das Layer-CRS EPSG:25833. Ein FeatureServer antwortet
  auf Fehler mit **200** und `{"error":…}`, und auf mehr als
  `maxRecordCount` (2000) mit einem abgeschnittenen Ergebnis und
  `exceededTransferLimit: true` — `fetch.ts` prüft beides.
- **Die Automaten tragen keinen Verweis auf die Bewohnerparkzone.** Die
  Zuordnung läuft über die Geometrie: 38 der 44 liegen in einer Zone, fünf
  außerhalb (Bahnhof, Ostrower Platz, Goethestraße), einer ohne Geometrie.

Nicht abgerufen: `Daten_Admin/Ortsteile` (19 Polygone) und
`FB33/Stadtgrenze` — beide ohne Lizenzvermerk im Portal; die Stadtgrenze
diente nur zum Messen der Meldebox. Keine Umweltzone (Cottbus hat keine),
keine POI. `meta.json` führt alles unter `absent`.
## Verwendet — Schwerin

Abgerufen am 16. September 2026 von der **Landeshauptstadt Schwerin** über das
Geoportal des Landkreises Ludwigslust-Parchim (`geoportal.kreis-lup.de`),
WFS 2.0.0 (MapServer), **als GML 3.2 in EPSG:25833** — der Dienst kann weder
JSON noch Grad. Vier Ebenen aus zwei Diensten:

| Ebene | Dienst / Typname | Umfang |
| --- | --- | --- |
| Parkzonen | `parken-sn`, `masterportal:Parkzonen` | 15 Polygone **ohne ein einziges Attribut** — Schwerins Bewohnerparkzonen A bis V |
| Parkscheinautomaten | `parken-sn`, `masterportal:Parkscheinautomaten` | 143 Punkte — Zeiten, Betrag, Höchstparkdauer, Tages- und Kurzparkticket |
| Behindertenparkplätze | `parken-sn`, `masterportal:Behindertenparkplatz` | 64 Punkte, als POI |
| Stadtteile | `raumgliederung-sn`, `ms:Stadtteilgrenzen_Schwerin` | 27, als Kartenkontext |

**Lizenz: [Datenlizenz Deutschland Namensnennung 2.0](https://www.govdata.de/dl-de/by-2-0)**,
wörtlich aus `ows:AccessConstraints` beider Dienste: „Datenlizenz Deutschland -
Namensnennung - 2.0. Quellenvermerk: Landeshauptstadt Schwerin". Der
Quellenvermerk ist Lizenzbedingung und steht so in `City.attribution`.

Vier Dinge, die man erst im Feed sieht — ausführlich in
[staedte-schwerin.md](staedte-schwerin.md):

- **Die Zonen tragen keinen Namen.** Welche Fläche welche Zone ist, sagt nur
  der **WMS** desselben Dienstes: Legende und Karte beschriften die 15 Flächen
  mit `A` bis `V` und fünf Mischflächen (`A/F`, `A/D`, `C/D`, `C/O`, `A/C`).
  `SCHWERIN_ZONE_ANCHORS` in `core` hält je Zone einen Punkt, der in ihr liegt.
- **Nur GML, nur EPSG:25833.** `gml.ts` liest die Antwort, `utm.ts` rechnet
  Zone 33 um — gegen 159 Berliner und 2.259 Schweriner Punktpaare gemessen.
- **Automaten widersprechen sich.** Zone A trägt `Mo - Sa 8-20 h` (10×),
  `Mo - So 8-21 h` (4×) und `Mo - So 8-18 h`; die Fenster werden vereinigt,
  das Panel zeigt alle drei mit Zähler.
- **Sieben Automaten liegen in keiner Zone** (Zoo, Zippendorf, Werder,
  Marstall) und werden nicht ausgeliefert; fünf Zonen haben keinen Automaten
  und ebenso wenig.

Nicht abgerufen: `masterportal:Parken` (40 Parkplätze und Parkhäuser),
`masterportal:Wohnmobilstellplaetze` (11), `masterportal:P_and_R` (leer),
`masterportal:Parkplaetze_SN` (Serverfehler) und die Bezirks- und
Baublockgrenzen des Raumgliederungs-Dienstes.
## Verwendet — Graz

Abgerufen am 16. September 2026 vom **Magistrat Graz, Stadtvermessungsamt**
über `geodaten.graz.at`, ArcGIS Enterprise 11.5 — kein WFS, sondern der
REST-Dienst mit `query?where=1%3D1&outFields=*&f=geojson&outSR=4326`. Drei
Ebenen aus **zwei** Diensten:

| Ebene | Dienst / Ebene | Umfang |
| --- | --- | --- |
| Kurzparkzonen aktuell (Blaue Zone) | `1_3_Verkehrswesen/Grazer_Parkzonen/FeatureServer/0` | 90 Polygone — 21 flächendeckend, 69 straßenzugsweise |
| Parkzonen aktuell (Grüne Zone) | `1_3_Verkehrswesen/Grazer_Parkzonen/FeatureServer/1` | 75 Polygone — 22 flächendeckend, 53 straßenzugsweise |
| Bezirksgrenzen | `OGD_WFS/FeatureServer/44` | 17 Bezirke, als Kartenkontext und für die Zuordnung |

**Lizenz: für die Parkzonen nicht ausgewiesen.** Der Dienst führt
`licenseInfo: null` und als `accessInformation` nur „© Magistrat Graz |
Stadtvermessungsamt | Referat für Geoinformation | Kein Rechtsanspruch aus
der Karte ableitbar!". Das OGD-Portal `data.graz.gv.at` stellt seine Daten
unter [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) („Datenquelle:
Stadt Graz – data.graz.gv.at"), listet die Parkzonen aber nicht; der
OGD-Dienst `OGD_WFS` führt sie ebenfalls nicht. Die App trägt deshalb
`licenceFamily: 'unklar'` und zeigt den Banner; die Bezirksgrenzen kommen aus
dem OGD-Dienst und sind damit belegt CC BY 4.0. Details und der Weg zur
Klärung in [staedte-graz.md](staedte-graz.md).

Vier Dinge, die man erst im Feed sieht:

- **Tarif, Zeiten und Höchstparkdauer stehen je Fläche** — als Prosa in
  `PARK_GEBUEHR`, `GELTUNGSZEIT` und `PARKDAUER`, dazu `PARK_DAUER` als Satz.
  Zwei Gebührentexte, drei Zeitschreibweisen, vier Parkdauern in 165 Flächen.
- **Die Gebühr steht je halbe Stunde.** „Mindestgebühr (halbe Stunde):
  € 1,30" ist 2,60 €/h; die Stadt bestätigt auf gps.graz.at, dass in
  10-Cent-Schritten linear weitergezahlt wird.
- **Ohne `outSR=4326` antwortet der Dienst in MGI / Austria GK M34** (`wkid
  31256`, Meter um −67.000 / 215.000) — dieselbe Falle wie Frankfurts UTM.
- **122 der 165 Flächen sind Straßenzüge**, im Median 6,7 m (blau) bzw.
  3,7 m (grün) breit — wie Karlsruhes Stellplatzreihen, deshalb
  `zoneSnapMetres: 20`.

Nicht abgerufen: `Parkzonen_Gebiete` (die zu Gebieten zusammengefassten
Flächen — dieselbe Auskunft, gröber) und die Ebenen des OGD-Dienstes zu
Behindertenparkplätzen, P+R, Parkgaragen und E-Ladestellen; sie wären der
nächste Schritt für `poi.geojson`.
## Verwendet — Salzburg

Abgerufen am 16. September 2026 von der **Stadtgemeinde Salzburg** über
`data.stadt-salzburg.at/geodaten/wfs`, WFS 2.0.0 (GeoServer, Arbeitsbereich
`ogdsbg`). Die erste Stadt außerhalb Deutschlands. Drei Ebenen aus **einem**
Dienst:

| Ebene | Typname | Umfang |
| --- | --- | --- |
| Kurzparkzonen | `ogdsbg:kurzparkzone` | 41, davon 40 ausgeliefert — eine Fläche von vier Metern fällt beim Vereinfachen zusammen |
| Stadtteile | `ogdsbg:stadtteil` | 145 Flächenstücke, davon 132 in Salzburg → 28 Stadtteile, als Kartenkontext |
| Behindertenstellplätze | `ogdsbg:behindertenstellplatz` | 185 Punkte, als POI |

**Lizenz: [Creative Commons Namensnennung 3.0 Österreich](https://creativecommons.org/licenses/by/3.0/at/deed.de).**
Wörtlich aus `ows:AccessConstraints` des Dienstes: „Datenquelle: Stadt
Salzburg – data.stadt-salzburg.at; Nutzungsbedingungen: CC BY 3.0 AT". Der
Katalogeintrag bei data.gv.at von 2016 nennt CC BY-**SA** 3.0 AT; warum die
Angabe des Dienstes und der OGD-Seite der Stadt gilt, steht in
[staedte-salzburg.md](staedte-salzburg.md).

Drei Dinge, die man erst im Feed sieht:

- **Der Tarif steht nicht im Feed.** Kein Feld nennt einen Betrag. § 2 Abs. 1
  der Parkgebührenverordnung der Stadt (22. Novelle, Abl Nr 98/2025) setzt
  1,10 € je halbe Stunde für die ganze Stadt fest; die App liefert ihn mit
  Fundstelle aus (`SALZBURG_TARIFF` in `core/salzburg.ts`).
- **30 der 41 Zonen sind Parkscheibenzonen** („gebührenfrei (aber
  Parkuhrenpflicht)"), Hamburgs `disc`. Die elf gebührenpflichtigen verlangen
  samstags nur die Scheibe — das steht als Zusatzregel an der Zone, nicht als
  Gebührenfenster.
- **Ohne `srsName` antwortet der Dienst in EPSG:31255** (Gauß-Krüger M31,
  `[-20891.7, 295427.09]`); mit `srsName=urn:ogc:def:crs:EPSG::4326` kommt
  GeoJSON als `[lon, lat]`, GML als `[lat, lon]`.

Nicht abgerufen: `ogdsbg:bewohnerparkzone` (13 Bewohnerzonen — eine
Berechtigung, keine Gebührenfrage; ihr Buchstabe steht schon an den
Kurzparkzonen), `ogdsbg:anwohnerzone` (57 Schilder), `ogdsbg:parkscheinautomat`
(180 Punkte ohne Tarif), `ogdsbg:parkplatz` (32). Eine Umweltzone gibt es in
Salzburg nicht.

Vollständige Feldanalyse in [staedte-salzburg.md](staedte-salzburg.md).
## Verwendet — Innsbruck

Abgerufen am 16. September 2026 von der **Stadt Innsbruck** über ihr ArcGIS
Online („geoHub Innsbruck", Eigentümer `geoHub_Innsbruck`, Organisation
„Stadtmagistrat Innsbruck"). Kein WFS: Beide Ebenen sind
ArcGIS-FeatureServer-Abfragen (`query?where=1=1&outFields=*&f=geojson&outSR=4326`),
in `sources.ts` als `FileSource` geführt.

| Ebene | Adresse | Umfang |
| --- | --- | --- |
| Parkzonen | `…/Parkzonen_WGS84/FeatureServer/0` | 21 Polygone (Kurzparkzonen und Parkstraßen) |
| Stadtteile | `…/statistik_06_v/FeatureServer/0` | 20 statistische Stadtteile, nur als Kartenkontext und Ortsangabe |

**Lizenz: [Nutzungsbedingung der Stadt Innsbruck](https://geohub-1-magibk.hub.arcgis.com/pages/nutzungsbed).**
Das ArcGIS-Item selbst hat ein leeres `licenseInfo` und steht in keinem
Katalog mehr — der Eintrag auf data.gv.at, den die Recherche nannte, ist
verschwunden. Die Bedingungen stehen eine Ebene höher, auf der Seite des Hubs,
wörtlich: „Die Daten der Stadt Innsbruck stehen unter einer offenen Lizenz
vergleichbar mit "Creative Commons Namensnennung 4.0" (CC-BY 4.0). Bei
Verwendung der Datensätze ist die Landeshauptstadt Innsbruck als Datenquelle
anzugeben. Die Namensnennung der Stadt Innsbruck als Rechteinhaber hat in
folgender Weise zu erfolgen: "Datenquelle: Stadt Innsbruck"". Dazu eine
Auflage, die CC BY nicht kennt: Wer die Daten „für ihre öffentlichen
Anwendungen / Dienste" verwendet, teilt der Stadt unter
`post.vermessung-gis@innsbruck.gv.at` mit, wo und wofür — eine E-Mail des
Betreibers, geführt in [todo.md](todo.md#5-weitere-städte--vier-laufen--ich).

Drei Dinge, die man erst im Feed sieht:

- **Alles steht in einem Freitextfeld.** `INFO` trägt Zeiten, Betrag je
  halbe Stunde, Tagesdeckel und Tarifsprung in einem Satz, mit
  **Dezimalpunkt** (`EUR 1.10`); `BEZEICH` trägt die Höchstparkdauer
  („Kurzparkzone 180 min kostenpflichtig"). Sieben `INFO`-Werte über 21
  Zonen, alle gezählt in [staedte-innsbruck.md](staedte-innsbruck.md).
- **„werktags" heißt hier Mo–Fr**, ausgeschrieben als `werktags Mo-Fr` —
  anders als in Hamburg. Ein nacktes „werktags" weist der Parser ab.
- **Der Stand verfällt am 2. November 2026.** Der Gemeinderat hat am
  16. Juli 2026 eine neue Parkabgabeverordnung beschlossen: Mo–Fr 8–21 Uhr,
  Sa 8–18 Uhr in allen Zonen, drei neue Parkstraßen (Arzl, Olympisches Dorf,
  Kranebitten). Der Feed trägt heute den alten Stand.

Nicht im Feed: Behindertenparkplätze und Parkscheinautomaten führt der Hub nur
als Karten, nicht als Ebenen mit Sachdaten; POI und Umweltzone (Innsbruck hat
keine) fehlen, `meta.json` führt beides unter `absent`.

## Verwendet — Zürich

Abgerufen am 17. September 2026 von der **Stadt Zürich** über
`www.ogd.stadt-zuerich.ch/wfs/geoportal/…` — ein **QGIS Server** mit WFS
**1.1.0**, gefunden über den CKAN-Katalog `data.stadt-zuerich.ch`. Vier
Ebenen aus drei Datensätzen:

| Ebene | Dienst / Typname | Umfang |
| --- | --- | --- |
| Tarifzonen | `Gebietseinteilung_Parkierungsgebuehren` → `tarifzonen` | 2 Polygone, beide Hochtarif „Innenstadt und Oerlikon", `bedienungszeiten` |
| Parkuhren | `oeffentlich_zugaengliche_Parkplaetze_DAV` → `oeff_strassenparkierung_spuzpu` | 1.397 Sammel- und Zentralparkuhren, `tarif` wie `HOCH 2h Mo-Sa 09:00-20:00` |
| Parkfelder | dieselbe → `oeff_strassenparkierung_dav_p` | 13.272 gebühren- oder bewilligungspflichtige Parkfelder, `gebpflicht`, `parkdauer` |
| Quartiere | `Statistische_Quartiere` → `adm_statistische_quartiere_v` | 34 Polygone mit `qname` und `kname` |

**Lizenz: [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/deed.de).**
Alle Datensätze tragen im Katalog `license_id: cc-zero`; der
geocat.ch-Metadatensatz der Parkplätze sagt wörtlich: „Diese Geodaten stehen
unter der international gültigen Creative-Commons-Zero-Lizenz (CC-0). […] Eine
Quellenangabe (CC-BY) wird empfohlen: Sie lautet: „Quelle: Stadt Zürich"."

Drei Dinge, die man erst im Feed sieht:

- **Kein Feld nennt einen Betrag.** Der Tarif kommt aus den Vorschriften über
  die Parkierungs- und Parkuhrkontrollgebühren (AS 551.330, in Kraft seit dem
  1. April 2017), in Franken und gestaffelt: 0,50 Fr. je 20 Minuten
  Kontrollgebühr, ab der 31. Minute 0,50 Fr. je 10 Minuten in den ersten zwei
  Stunden, danach 0,50 Fr. je Stunde — eine Stunde 3,00 Fr. Ausgeliefert als
  Spanne der Grenzsätze 1,50–4,50 CHF/h, mit `currency: 'CHF'`. Begründung
  in [staedte-zuerich.md](staedte-zuerich.md).
- **Die URN-Form von `srsName` bricht den Dienst.** Mit
  `srsName=urn:ogc:def:crs:EPSG::4326` und JSON antwortet der QGIS Server mit
  **HTTP 500** und einer HTML-Seite; mit `SRSNAME=EPSG:4326` kommt GeoJSON in
  `[lon, lat]`. Deshalb vier fertige Adressen in `ZUERICH_FILES` statt
  `wfsUrl`.
- **Der Niedertarif hat keine Fläche.** 844 der 1.397 Parkuhren stehen
  ausserhalb beider Flächen, darunter 70 mit `HOCH` in der Enge und im
  Seefeld — Strassen, die Art. 2 des Erlasses wörtlich zur Innenstadt zählt.
  Für sie gibt es keine Fläche; sie fehlen mit Zählung.

Nicht abgerufen: `Oeffentlich_zugaengliche_Strassenparkplaetze_OGD`
(`view_pp_ogd`, 46.282 Punkte, „Datenstand per Ende 2021 und werden nicht
mehr aktualisiert"), die drei übrigen DAV-Ebenen (Blaue Zone als Linien und
Punkte, Güterumschlag), `geo_behindertenparkplaetze` (Stand 2017),
`geo_stadtkreise` (die Quartiere tragen den Kreis). Keine Umweltzone (die
Schweiz kennt keine), keine POI. `meta.json` führt alles unter `absent`.

## Verwendet — Wien

Abgerufen am 17. September 2026 von der **Stadt Wien** (Open Government Data
Wien) über den GeoServer-WFS `https://data.wien.gv.at/daten/geo`, WFS 2.0.0,
Arbeitsbereich `ogdwien`, als `application/json` mit
`srsName=urn:ogc:def:crs:EPSG::4326` — die erste Quelle außerhalb Deutschlands.

| Ebene | Typname | Umfang |
| --- | --- | --- |
| Kurzparkzone (Fläche) — die flächendeckenden Kurzparkzonen je Bezirk | `ogdwien:KURZPARKZONEOGD` | 81 Flächen (49 Polygone, 32 MultiPolygone; im Datenbau 105 Stücke), 9,9 MB |
| Kurzparkzone (Linie) — die Geschäftsstraßen mit eigener Regelung | `ogdwien:KURZPARKSTREIFENOGD` | 796 Linien, im Median 53 m; im Datenbau Bänder von 2 × 12 m |
| Bezirksgrenzen | `ogdwien:BEZIRKSGRENZEOGD` | 23 Bezirke |

**Lizenz: [Creative Commons Namensnennung 4.0](https://creativecommons.org/licenses/by/4.0/deed.de).**
Die Nutzungsbedingungen der Stadt (`digitales.wien.gv.at/ogd-nutzungsbedingungen/`,
wohin `data.wien.gv.at/nutzungsbedingungen` aus den `ows:AccessConstraints`
des Dienstes weiterleitet) verlangen wörtlich: „Die Namensnennung der Stadt
Wien als Rechteinhaberin hat in folgender Weise zu erfolgen: ‚Datenquelle:
Stadt Wien – data.wien.gv.at'". Der Katalog `data.gv.at` führt den Datensatz
„Kurzparkzonen Wien" (`6858b208-…`, modified 2025-11-20) mit derselben Lizenz;
nur `ows:Fees` des WFS nennt noch CC BY 3.0 AT — die App hält sich an 4.0.

Drei Dinge, die man erst im Feed sieht:

- **Kein Betrag.** Kein Feld nennt einen Tarif; Wien hat einen für die ganze
  Stadt, § 2 Parkometerabgabeverordnung (ABl. 2025/41): 1,70 Euro je
  angefangene halbe Stunde, die ersten fünfzehn Minuten frei. Ausgeliefert
  als 3,40 €/h mit dem Vermerk „nicht im Datensatz" in `rawFee`.
- **Die Geschäftsstraße überstimmt die Fläche.** Die 796 Linien liegen in den
  Bezirksflächen und tragen eigene Zeiten (meist bis 18 Uhr, 1,5 h, dafür
  samstags). Der Datenbau macht Bänder daraus und stellt sie in
  `zones.geojson` **vor** die Flächen, weil `zoneAt` den ersten Treffer nimmt.
- **Ohne `srsName` antwortet der Dienst in EPSG:31256** (MGI / Gauß-Krüger
  M34, Meter um einen Nullpunkt bei Wien); mit `srsName` im JSON `[lon, lat]`.
  Und `SE_ANNO_CAD_DATA` trägt einen Oracle-Objektnamen (`[B@1d3aabc`), der
  sich je Anfrage ändert — kein Inhalt.

Nicht abgerufen: `PARKENGELTUNGOGD` und `PARKENBERECHTOGD` („haben keine
Rechtsgültigkeit", Parkpickerl-Frage), `PARKENANRAINEROGD` (1.356
Anrainerparkplätze), `PARKENAUTOMATOGD` (206 Verkaufsstellen der Wiener
Linien, keine Automaten am Straßenrand). Keine Umweltzone, keine POI.
Vollständiger Bericht in [staedte-wien.md](staedte-wien.md).

## Verwendet — Niederlande (Utrecht, Den Haag, Rotterdam, Groningen, Nijmegen, Eindhoven)

Abgerufen am 17. September 2026 von der **RDW**, „Open Data Parkeren" auf
`opendata.rdw.nl` — das Nationaal Parkeer Register (NPR), eine Socrata-
Instanz mit acht Tabellen, die über `areamanagerid` (= CBS-Gemeindecode)
zusammenhängen. Die Stadt ist ein Parameter, der Datenbau
(`build-data-npr.ts`) für alle sechs derselbe:

| Tabelle | Kennung | Inhalt |
| --- | --- | --- |
| GEBIED | `adw6-9hsg` | Gebiete mit Beschreibung und Gültigkeit |
| GEOMETRIE GEBIED | `nsk3-v9n7` | WKT `POLYGON`/`MULTIPOLYGON` in EPSG:4326, versioniert |
| GEBIED REGELING | `qtex-qwd8` | Regelung je Gebiet, Nutzungszweck (`BETAALDP`, `VERGUNP`, …) |
| REGELING | `yefi-qfiq` | Basis- (`B`) und Zusatzregelungen (`A`) |
| TIJDVAK | `ixf8-gtwq` | Zeitfenster je Tagestyp als `900`/`2100`, Tarifcode, Höchstdauer |
| TARIEFDEEL | `534e-5vdg` | Tarifstaffel: Betrag je Schrittweite von–bis Minute |
| TARIEFBEREKENING | `nfzq-8g7y` | Klartext des Tarifs |
| SPECIALE DAG | `hpi4-mynq` | Feiertage und Ereignistage je Gemeinde |

**Lizenz: [Creative Commons Zero 1.0](https://creativecommons.org/publicdomain/zero/1.0/).**
Metadatenfeld jeder Tabelle: `Licentie: Creative Commons 0 (CC0)`; die
Socrata-Felder `license` und `attribution` sind leer. Stadtteile aus den
**CBS Wijken en Buurten 2024** über PDOK (`service.pdok.nl/cbs/wijkenbuurten`),
laut `ows:AccessConstraints` ebenfalls CC0.

Drei Dinge, die man erst in den Daten sieht:

- **Jede Zeile trägt Gültigkeit, in drei Datumsformaten.** `20150501`,
  `20150501000000`, `2015-05-01T00:00:00.000`; offen ist `29991231`,
  `2099-01-01` oder fehlend. Rotterdams TIJDVAK hat 5.425 Zeilen, 1.341 gelten.
- **Der Feiertagskalender liegt in der Quelle** — und ist je Gemeinde anders
  gepflegt: Rotterdam und Groningen führen 2026, Utrecht und Eindhoven enden
  2022, Den Haag hat gar keine Zeile. Wo die Quelle keinen Sondertag kennt,
  gilt der Wochentag, und die Zone trägt `freeOnHolidays: false`.
- **Der Tarif ist eine Staffel.** `0.08900000` je Minute ist 5,34 €/h;
  Eindhovens „0,30 starttarief, 4,50 per uur" sind drei Teile. Der Parser
  rechnet die ersten drei Stunden und liefert `exact` nur, wenn sie gleich sind.

Nicht ausgeliefert: Vergunninggebiete (`VERGUNP`, Fenster ohne Tarif),
Bezoekersregelungen, Garagen, P+R, Amsterdam und Maastricht (Geometrie
unvollständig). Vollständiger Bericht in
[staedte-niederlande.md](staedte-niederlande.md).
## Verwendet — Genf

Abgerufen am 17. September 2026 vom **SITG** (Système d'information du
territoire à Genève, Etat de Genève) über `vector.sitg.ge.ch`, ArcGIS REST —
kein WFS, sondern `query?where=1%3D1&outFields=*&f=geojson&outSR=4326`, in
`sources.ts` als `GENF_FILES` geführt. Die erste Stadt in der Schweiz und die
erste der **Klasse C**: Die Quelle nennt Zonengrenzen, aber weder Zeiten noch
Beträge. Vier Ebenen aus **einem** Server:

| Ebene | Dienst | Umfang |
| --- | --- | --- |
| Macaron-Zonen | `OTC_MACARON/MapServer/0` | 53 Polygone im ganzen Kanton, davon **17** (`A`–`Q`) in der Ville de Genève ausgeliefert |
| Stellplatzreihen | `OTC_STATIONNEMENT_V_PUBLIQUE/MapServer/0` | **13.236** Linien, seitenweise geholt (`maxRecordCount` 4.000); 6.213 in den 17 Zonen |
| Behindertenparkplätze | `OTC_PLACE_HANDICAPE/MapServer/0` | 599 Punkte, 297 in der Ville, als POI |
| Quartiere | `VDG_QUARTIER_VILLE/MapServer/0` | 8 Quartiere der Ville, Kartenkontext, Ortsangabe und Filter |

**Lizenz: [Conditions d'utilisation des données du Portail SITG](https://sitg.ge.ch/ressources/conditions-utilisation-donnees), Stufe „A – Accès libre (Open Data)".**
Jedes ArcGIS-Online-Item der vier Ebenen (`sitg.maps.arcgis.com`) trägt
`licenseInfo: "Accès libre"` und `accessInformation: "© 2026 SITG"`. Die
Stufe wörtlich: „Vous pouvez utiliser ce jeu de données à des fins privées.
Vous pouvez utiliser ce jeu de données à des fins commerciales. Vous devez
obligatoirement indiquer la source (ex : « Données SITG », date/fréquence
d'extraction) et, le cas échéant, les traitements effectués sur le jeu de
données." Die vollständigen Bedingungen (Fassung vom 19. Mai 2026, PDF unter
`media.sitg.ge.ch`) geben die Daten in Ziffer 4.4.1 „en l'état et telles que
disponibles, sans garantie d'aucune sorte". Familie `cc-by`, aus demselben
Grund wie Innsbruck: Nennung in vorgeschriebener Form, Hinweis auf fehlende
Gewähr. Details in [staedte-genf.md](staedte-genf.md).

Vier Dinge, die man erst im Feed sieht:

- **Weder Zeiten noch Beträge.** Die Zone hat einen Buchstaben, einen Sektor
  und ein Datum der Inbetriebnahme (1997 bis 2005). Jede Zone trägt
  `scheduleUnknown`, `fee: unknown`, `meta.absent` führt `schedule` und
  `fee`. Was gilt — Parkuhren der Fondation des Parkings, Blaue Zone mit
  Parkscheibe —, steht auf `geneve.ch`, nicht in einem Datensatz.
- **Die Stellplatzreihen tragen die Art:** `Gratuit 60 min` (5.114 Reihen,
  die Blaue Zone), `Payant 90 min` (818), `Gratuit illimité`, `Cases 2
  roues`, `Vélos`, `Gratuit jaune` … 28 Werte und dreimal null, alle gezählt
  in [staedte-genf.md](staedte-genf.md). Daraus kommen je Zone Platzzahl
  und Höchstdauern; die Reihe gehört zu der Zone, in der ihr Mittelpunkt
  liegt.
- **Der Kanton ist nicht die Stadt.** 35 der 53 Zonen liegen in Carouge,
  Lancy, Vernier, Meyrin, Versoix und 17 weiteren Gemeinden, eine hat keinen
  Buchstaben. Der Datenbau behält, was in einem der acht Quartiere liegt,
  und nennt den Rest im Log.
- **Ohne `outSR=4326` antwortet der Dienst in EPSG:2056** (Schweizer
  Landeskoordinaten, Meter um 2.500.000 / 1.120.000); der WFS desselben
  Servers liefert mit `urn:ogc:def:crs:EPSG::4326` GML in `[lat, lon]`.
  `assertDegrees` im Datenbau hält, dass Grade kommen.

Nicht abgerufen: `OTC_PARKING` (534 Parkhäuser und -plätze — keine
`PoiKind`), `AGGLO_STATION_AUTOPARTAGE` (Carsharing, ungeprüft),
`OCS_SECTEURS_STATISTIQUES` (61 Sektoren des Kantons) und `CAD_COMMUNE`
(48 Polygone, nur für den Rahmen gemessen). Eine Umweltzone gibt es in Genf
nicht.
## Verwendet — Bern

Abgerufen am 17. September 2026 von der **Stadt Bern** über ihren
ArcGIS-Server `map.bern.ch` — die erste Stadt in der Schweiz und die erste
der **Klasse C**: Die Quelle nennt Zonengrenzen, aber weder Zeiten noch
Beträge. Kein WFS (der Dienst hat einen, `…/MapServer/WFSServer`, aber die
REST-Abfrage `query?where=1%3D1&outFields=*&f=geojson&outSR=4326` liefert
GeoJSON direkt); drei Ebenen aus drei Diensten, in `sources.ts` als
`BERN_FILES`:

| Ebene | Dienst / Ebene | Umfang |
| --- | --- | --- |
| Parkkartenzonen | `Geoportal/Parkkartenzonen/MapServer/1` („Parkkartenzone_Umrandung") | 42 Polygone, davon 34 mit Namen für 31 Zonen; 8 ohne jede Sachangabe werden ausgelassen |
| Statistische Bezirke | `Geoportal/Statistische_Bezirke/MapServer/0` | 32 Bezirke, „eine offizielle Stadteinteilung", als Kartenkontext und Ortsangabe |
| Stadtteile | `Geoportal/Stadtteile/MapServer/0` | 6 Stadtteile, nur damit jeder Bezirk seinen Stadtteil nennt |

**Lizenz: [Nutzungsbedingungen betreffend Geodaten der Stadt Bern, Version 1.0](https://map.bern.ch/geoportal/data/Nutzungsbedingungen_Geodaten_Stadt-Bern_1.0.pdf)**
(Januar 2020, Geoinformation Stadt Bern). Wörtlich, Ziffer 3: „Die Geodaten
dürfen grundsätzlich von jedermann kostenlos genutzt werden. […] Es wird ein
nicht ausschliessliches Nutzungsrecht gewährt." Ziffer 5: „Auf sämtlichen
Publikationen ist die Quellenangabe "Geodaten Stadt Bern" anzugeben (Art. 22,
Abs. 1, Bst. c, Kantonale Geoinformationsverordnung vom 11. November 2015;
KGeoIV; BSG 215.341.2)." Ziffer 6 A: „Öffentlich zugängliche Geodaten dürfen
mit gut sichtbarem Quellenhinweis beliebig reproduziert werden." Ziffer 7:
„Die Stadt leistet für die Richtigkeit, Genauigkeit, Aktualität,
Zuverlässigkeit und Vollständigkeit der Geodaten keine Gewähr." Dass alle
drei Ebenen **öffentlich zugängliche** Geodaten sind (Stufe A — für Stufe B
verböte Ziffer 6 B die Weitergabe), sagt der Geodatenkatalog der Stadt
(`map.bern.ch/geoportal/rest/api/GeoDataSet/read_produkt.php?name=Parkkartenzonen&status=4`):
`zugangsberechtigungsstufe: "A: öffentlich zugänglich"`, `nutzungsbedingungen:
"Freie Nutzung. Quellenangabe ist Pflicht."`, `quellenangabe: "Geodaten Stadt
Bern"`. Die App führt die Familie `cc-by` — Nennung in vorgeschriebener Form
und Hinweis auf die fehlende Gewähr — und nennt den Zeitstand
(`meta.geprueftAm`), wie Ziffer 10 es empfiehlt.

Drei Dinge, die man erst im Feed sieht:

- **Kein Zeit- und kein Gebührenfeld.** Der Datensatz ist der „Basisdatensatz
  für die Parkkartenbewirtschaftung" — er sagt, wo eine Anwohner-Parkkarte
  gilt. Jede Zone trägt `scheduleUnknown: true`, `meta.absent` führt
  `schedule` und `fee`; die App sagt „Zeiten unbekannt" und färbt grau. Die
  einzige Zeitaussage ist `Info_beschrieb: Auch Sonntags` bei vier Flächen —
  sie steht wörtlich in `unmodelledRules`. Blaue Zone und Parkuhr-Tarif
  (3.30 Fr./h seit der Abstimmung vom 18. Juni 2023) stehen als Zitat in
  [staedte-bern.md](staedte-bern.md), nicht in den Daten.
- **Acht der 42 Flächen tragen keine einzige Sachangabe**, fünf davon
  innerhalb benannter Zonen. Sie werden ausgelassen und im Log genannt.
- **Ohne `outSR=4326` antwortet der Dienst in LV95** (`wkid` 2056, Meter um
  2.600.000 / 1.200.000) — dieselbe Falle wie Frankfurts UTM; der Datenbau
  misst mit `assertDegrees` nach.

Nicht abgerufen: `Geoportal/Parkplaetze_oeffentlich` mit den Parkfeldern
(455 gebührenpflichtige, 3.002 blaue und 469 + 81 weisse Felder als
Polygone) — die Ebenen tragen ebenfalls weder Zeiten noch Beträge, nur Art,
Zahl und Status der Felder; sie wären der nächste Schritt, sobald die App
Stellplatzreihen ohne Tarif sinnvoll zeigen kann.
## Verwendet — Krakau

Abgerufen am 17. September 2026 vom **Zarząd Transportu Publicznego w Krakowie**
(ZTP, Gmina Miejska Kraków) über das ArcGIS Online der Stadt
(`services-eu1.arcgis.com/svTzSt3AvH7sK6q9`, 390 Dienste) — kein WFS, sondern
`query?where=1%3D1&outFields=*&f=geojson&outSR=4326`. Vier Ebenen:

| Ebene | Dienst / Ebene | Umfang |
| --- | --- | --- |
| Sektorgrenzen der amtlichen Karte | `Granice_Stref_2026/FeatureServer/1` | **23** Polygone, Podstrefa A/B/C und `Nr_sektora`; die Ebene, die die ZDMK-Karte („Mapa ZDMK v2", Stand 6. August 2026) zeichnet — **die Flächen** |
| Erweiterung vom 10. August 2026 | `Poszerzenie_OPP_od_10_08_2026/FeatureServer/0` | 4 Polygone (C23, C24, C31 neu; B30 um die Błonia erweitert), `Uwagi: "Od 10 sierpnia 2026"` |
| Beschriebener Datensatz „Strefa Płatnego Parkowania w Krakowie" | `Sektory_SPP_wyświetlenie/FeatureServer/37` | 26 Polygone, Stand 9. Dezember 2024: 20 geltende und sechs geplante mit Präfix `n` — nur zur Gegenprobe im Log |
| Dzielnice | `Dzielnice_Krakowa/FeatureServer/10` (aus dem ISDP der Stadt) | 18 Bezirke, `NAZWA`, `NR_DZIELNI` (römisch) |

**Lizenz: nicht ausgewiesen.** Das Item `d9e0ef7c33cd4f4a99c4e7d8024d3956`
trägt `accessInformation: "Zarząd Transportu Publicznego w Krakowie"`, den
Tag „Dane Otwarte" und als `licenseInfo` nur den Vorbehalt: „Warstwa nie
jest załącznikiem do Uchwały, została narysowana na podstawie interpretacji
słownego opisu granic i ma charakter poglądowy. Informacje na niej zawarte
nie mogą być podstawą do jakichkolwiek roszczeń." Die jüngeren Ebenen und
die Dzielnice haben gar keinen Vermerk. Die App trägt deshalb
`licenceFamily: 'unklar'` und zeigt den Banner; Details und der Weg zur
Klärung in [staedte-krakau.md](staedte-krakau.md).

Was der Feed **nicht** sagt, und warum hier nichts erfunden wird:

- **Keine Zeiten, kein Tarif, keine Höchstparkdauer** in irgendeinem Feld —
  nur der Buchstabe der Podstrefa. Beides steht in der Uchwała
  LXXXIX/2177/17 der Rada Miasta Krakowa samt Änderungen (die jüngsten,
  XLIV/899/25 und XLVII/1005/26, liegen beim ZDMK nur als Scan ohne
  Textebene) und auf den Seiten des ZDMK: A Montag bis Sonntag, B und C
  Montag bis Samstag, je 9–22 Uhr; ansteigende Stundensätze in Złoty.
  Das Modell kennt weder PLN noch Staffeln noch Handelssonntage; jede Zone
  trägt `scheduleUnknown: true`, `fee: { kind: 'unknown' }`, und `meta.json`
  führt `schedule` und `fee` unter `absent`.
- **Ohne `outSR=4326` antwortet der Dienst in PUWG 1992** (`wkid 2180`,
  Meter um 565.000 / 243.000) — dieselbe Falle wie Frankfurts UTM.
- **Die drei Sektorebenen sind nicht identisch**, auch nicht in den 20
  unveränderten Sektoren: Kein einziges Polygon der Ebene 37 hat dieselbe
  Punktmenge wie sein Gegenstück in der Karte (C8: 203 zu 176 Stützpunkte,
  A20 in der Karte ein MultiPolygon). Die Karte ist die jüngere Fassung und
  deshalb die Quelle; die Ebene 37 sagt im Log, was sie anders kennt.

Nicht abgerufen: `Strefa_ulice/FeatureServer/0` (571 Straßenlinien mit
Podstrefa, darunter 20 mit zwei Podstrefen und Warntext),
`Oznakowanie_strefy_płatnego_parkowania/0` (145 Beschilderungspunkte),
`Parkomaty_Ewidencja/1` (Parkautomaten der ZDMK-Karte), `Tereny_newralgiczne_OPP/1`
(eine Warnfläche an der ul. Wrocławska) — alle ohne Zeiten und Tarif.

## Verwendet — Saarbrücken

Abgerufen am 17. September 2026 von der **Landeshauptstadt Saarbrücken** über
ihr Open-Data-Portal (`opendata.saarbruecken.de`, CKAN 2.11.4) — die erste
Stadt im Saarland und die erste deutsche Stadt der **Klasse C**: Die Quelle
nennt Zonengrenzen und Buchstaben, aber weder Zeiten noch Beträge. Kein
Dienst, sondern vier statische GeoJSON-Dateien, in `sources.ts` als
`SAARBRUECKEN_FILES`:

| Ebene | Datei | Umfang |
| --- | --- | --- |
| Parkzonen, Flächen | `dataset/parkzonen` → `parkzonen_fl.geojson` (Ordnungsamt) | **27** MultiPolygone mit den Sachdaten `{"ID": 0}` — sonst nichts |
| Parkzonen, Beschriftung | `parkzonen_txt_pos.geojson` | 30 CAD-Beschriftungspunkte, 27 mit `Text` (`A1` … `U`), drei leer; der Datenbau legt sie in die Flächen, eins zu eins |
| Stadtteile, Flächen | `dataset/stadtteile` → `stadtteile_fl.geojson` (Hauptamt) | 20 MultiPolygone ohne Attribut, dritte Koordinate `0.0` |
| Stadtteile, Beschriftung | `stadtteile_txt.geojson` | 20 Punkte `11 Alt-Saarbrücken` … `48 Bübingen`; die Zehnerstelle ist der Stadtbezirk (Mitte, West, Dudweiler, Halberg), gegen die Bezirksseiten der Stadt geprüft |

**Lizenz: Datenlizenz Deutschland, Variante nicht ausgewiesen.** Das Portal
führt an jedem Datensatz `"license_id": "datenliz-de"` mit
`"license_url": null`; die Lizenzliste des Portals kennt den Schlüssel nicht,
die Datensatzseite zeigt ihn wörtlich, GovData führt den Datensatz nicht. Ob
Zero 2.0 oder Namensnennung 2.0 gemeint ist, sagt niemand. Die App trägt
deshalb `licenceFamily: 'unklar'`, verlangt bis zur Klärung die Nennung und
zeigt den Banner; Details und der Weg zur Klärung in
[staedte-saarbruecken.md](staedte-saarbruecken.md).

Was der Feed **nicht** sagt, und warum hier nichts erfunden wird:

- **Keine Zeiten, kein Tarif, keine Höchstparkdauer** in irgendeinem Feld.
  Die Gebührenordnung der Stadt (1. Änderungsordnung vom 19. Januar 2026, in
  Kraft seit 1. März 2026: 0,90 € je angefangene halbe Stunde in Zone 1,
  sonst 0,40/0,50 €, Höchstparkdauer 3 Stunden, laut Pressemeldung Mo–Sa
  8–20 Uhr) regelt die **Kurzparkzonen** mit Parkscheinautomaten — nicht die
  Bewohnerparkzonen des Datensatzes, und wie sich beide überlagern, sagt
  keine offene Quelle. Jede Zone trägt `scheduleUnknown: true`,
  `fee: { kind: 'unknown' }`, und `meta.json` führt `schedule` und `fee`
  unter `absent`.
- **Die Fläche weiß nichts über sich.** Ein Zonenbuchstabe kommt nur über
  Punkt-in-Polygon aus der zweiten Datei; der Datenbau bricht ab, sobald
  eine Fläche keinen oder mehr als einen Punkt trägt oder ein Punkt in
  keiner Fläche liegt. Am 17. September: 27 zu 27.
- **Zone G** steht in der Datensatzbeschreibung („A, B, C, D, E, F, G, H,
  I, J, L, N, R und U") und hat weder Fläche noch Beschriftung noch Seite
  bei der Stadt.

Nicht abgerufen: `dataset/distrikte` (57 Distrikte, nur mit Nummer),
`wahlbezirke`, `postleitzahl`, `geocodierte-hausnummern`, `radrouten`,
`sportflaechen`. Parkscheinautomaten, Kurzparkzonen oder Tarife führt das
Portal nicht. Eine Umweltzone gibt es in Saarbrücken nicht in den Daten.
## Geprüft und nicht verfügbar

Recherche vom 6. September 2026. Diese Negativbefunde sind festgehalten, damit
sie nicht erneut untersucht werden:

**Parkhaus-Belegung in Echtzeit — existiert nicht als offene Quelle.**
Die Parkhaus-Layer der Berliner Verkehrsinformationszentrale sind statisch von
2021 (INRIX-Basis) und enthalten kein Belegungsfeld. Laut Schriftlicher Anfrage
im Abgeordnetenhaus gibt es in Berlin kein aktives Parkleitsystem für öffentliche
Parkplätze; der Senat hat Belegungsdaten von zwölf Parkhäusern zweier Betreiber,
für die kein maschinenlesbarer Endpunkt auffindbar war.
[ParkAPI/ParkenDD](https://github.com/ParkenDD/parkapi-sources-v3) — der offene
deutsche Aggregator — deckt Berlin nicht ab. APCOA liefert laut dessen Konverter
ausdrücklich nur Stammdaten. Die TomTom Parking Availability API ist nicht im
kostenlosen Kontingent. Die DB-BahnPark-API ist abgekündigt.

**Carsharing in Echtzeit — nur ein Anbieter.**
Im [GBFS-Register von MobilityData](https://github.com/MobilityData/gbfs/blob/master/systems.csv)
steht für Berlin beim Carsharing nur Getaround. MILES, Free2Move (vormals
SHARE NOW), WeShare und Sixt share veröffentlichen keinen offenen Feed.

**P+R-Auslastung — kein Echtzeitwert.**
Das Feld `auslastung` im P+R-Layer ist ein statischer Erfahrungswert zur
Hauptverkehrszeit.

**Kontrolldaten der Parkraumüberwachung — existieren nicht als offene Quelle.**
Recherche vom 6. September 2026, mehrfach gegengeprüft. `daten.berlin.de` hat
**null** Datensätze zu Verwarnungsgeldern, Bußgeldern, Ordnungswidrigkeiten,
Parkverstößen oder Parkraumüberwachung — geprüft über die serverseitige
Facettensuche mit Singular, Plural und Komposita einzeln, gegen Kontrollbegriffe
plausibilisiert. Es gibt für Berlin **keinen Datensatz mit Zeitstempeln** von
Kontrollen oder Verstößen und **keine straßen- oder zonenscharfen** Vollzugszahlen.
Der einzige Bezirk mit regelmäßigen Zahlen ist Friedrichshain-Kreuzberg, als
HTML-Pressemitteilung, eine Zahl je Quartal
([Jahresbilanz 2025](https://www.berlin.de/ba-friedrichshain-kreuzberg/aktuelles/pressemitteilungen/2026/pressemitteilung.1631620.php)).
Das
[LK-Argus-Gutachten zur Wirtschaftlichkeit der Parkraumbewirtschaftung](https://difu.de/sites/default/files/bericht_lk_argus_wirtschaftlichkeit_der_prb.pdf)
hält fest, dass zonenscharfe Zahlen zu Verwarnungsgeldern und Überwachungskosten
der Verwaltung selbst nicht in ausreichender Detailtiefe vorlagen. Das
Scancar-Modellprojekt, das Ort und Zeit erfasst hätte, wurde 2025 mangels
Rechtsgrundlage
[eingestellt](https://www.berlin.de/ba-mitte/aktuelles/pressemitteilungen/2025/pressemitteilung.1529765.php);
seine Daten waren nie offen. [weg.li](https://github.com/weg-li/weg-li)
veröffentlicht keine Meldungsdaten. Andere Städte tun es sehr wohl — etwa
[Aachen](https://offenedaten.aachen.de/dataset/verwarn-und-bussgelder-ruhender-verkehr-parkverstoesse-2021-der-stadt-aachen)
mit Datum, Uhrzeit und Tatort je Fall; es ist also möglich, Berlin tut es nur nicht.

Deshalb ist die Kontrolldichte-Ebene **crowdgesourct**, nicht amtlich — und die
App sagt das an der Ebene selbst.

**Zwei Quellen, die nah dran sind und es doch nicht tun.**
[Ordnungsamt-Online](https://daten.berlin.de/datensaetze/ordnungsamt-online)
(DL-DE/BY-2.0, JSON unter `ordnungsamt.berlin.de/frontend.webservice.opendata/api/meldungen`)
enthält Bürgermeldungen statt behördlicher Kontrollen, führt im Metadatensatz
räumliche und zeitliche Granularität mit „Keine" und hält nur offene Vorgänge
vor. Ob je Meldung Koordinaten und Zeitstempel enthalten sind, ließ sich aus
dieser Umgebung nicht prüfen — die Domain war nicht erreichbar. **Offen und
zuerst zu prüfen, falls die Ebene je eine amtliche Grundlage bekommen soll.**
[FID-MOVE „Parkverstöße in Berlin"](https://data.fid-move.de/dataset/parkverstobe-in-berlin-basierend-auf-bildbefahrungsdaten-2019)
(CC BY 4.0) hat mit ~116-m-Straßenabschnitten die passende Auflösung, misst aber
Falschparken statt Kontrolle und ist eine einmalige Aufnahme von 2019.

**Ladepunkt-Belegung — vorhanden, aber ungeprüft.**
Die e-Infoplattform der VIZ Berlin liefert seit Januar 2026 echten Status je
Ladepunkt und deckt nach Presseangaben rund 80 % der öffentlichen Ladepunkte ab
(Berliner Stadtwerke, Qwello, Ubitricity). Der Dienst weist keine Lizenz aus und
war aus der Entwicklungsumgebung nicht erreichbar; der Worker sieht ihn vor, er
ist aber nicht getestet. Vor produktiver Nutzung bei der SenMVKU klären.

Die Bundesnetzagentur führt nur Stammdaten ohne Belegung. Die Mobilithek als
nationaler Zugangspunkt verlangt Client-Zertifikate (mTLS) und ist damit aus
einem Browser nicht erreichbar.

## Fachliche Referenzen

Für Regeln, die nicht in den Daten stehen:

- [Parkraumbewirtschaftung Berlin (Senatsverwaltung)](https://www.berlin.de/sen/uvk/mobilitaet-und-verkehr/verkehrsplanung/strassen-und-kfz-verkehr/parkraumbewirtschaftung/)
- [Parkraumbewirtschaftung Bezirk Mitte](https://www.berlin.de/ba-mitte/politik-und-verwaltung/aemter/ordnungsamt/parkraumbewirtschaftung/) — Feiertage werden wie Sonntage behandelt
- [Höchstparkdauer rund um den Gendarmenmarkt](https://www.berlin.de/ba-mitte/aktuelles/pressemitteilungen/2024/pressemitteilung.1468929.php) — vier Stunden, seit 1. Oktober 2024, nur in Teilen der Zonen 1, 2 und 15
- [Bewohnerparkausweis](https://www.berlin.de/ba-mitte/politik-und-verwaltung/aemter/amt-fuer-buergerdienste/buergeraemter/artikel.244758.php) — 20,40 € für bis zu zwei Jahre
- [Auskunfts- und Fahndungsstelle der Polizei Berlin](https://www.berlin.de/polizei/service/auto-fahrrad-bus/auto-wiederfinden/) — abgeschleppte Fahrzeuge
- [§ 23 Abs. 1c StVO](https://www.gesetze-im-internet.de/stvo_2013/__23.html) — Geräte zur Anzeige von Verkehrsüberwachung

## Vorbilder

Die Sichtungs-Funktion folgt zwei bestehenden Diensten:

- [blitzer.de](https://www.blitzer.de/article/blitzer-und-gefahren-melden/) — Meldung, Bestätigung durch andere, Sterne-Bewertung, automatischer Verfall. Punktbasiert, deshalb hier das passendere Vorbild.
- [FreiFahren](https://github.com/FreiFahren/freifahren) (MIT) — Meldefluss und Zeitverfall. Deren Risikomodell setzt einen Netzgraphen voraus, den es beim Ordnungsamt nicht gibt.

## Reproduzierbarkeit

Jede Angabe in dieser Datei lässt sich nachvollziehen:

```bash
# Feature-Anzahl eines Layers prüfen
curl -s "https://gdi.berlin.de/services/wfs/parkraumbewirtschaftung?service=WFS\
&version=2.0.0&request=GetFeature\
&typeNames=parkraumbewirtschaftung:parkzonen&resultType=hits" | grep -o 'numberMatched="[0-9]*"'

# Frankfurt: OHNE srsName kommt UTM, MIT srsName kommen Grade. Der Unterschied
# ist an den Zahlen zu sehen, nicht an einer Fehlermeldung.
curl -s "https://geowebdienste.frankfurt.de/Parken?service=WFS&version=2.0.0\
&request=GetFeature&typeNames=opendata:Parkscheinautomaten\
&outputFormat=application/json&count=1" | head -c 200
curl -s "https://geowebdienste.frankfurt.de/Parken?service=WFS&version=2.0.0\
&request=GetFeature&typeNames=opendata:Parkscheinautomaten\
&outputFormat=application/json&srsName=urn:ogc:def:crs:EPSG::4326&count=1" | head -c 200

# München: dieselbe UTM-Falle wie Frankfurt, und die Ebenen einzeln zählen
curl -s "https://geoportal.muenchen.de/geoserver/mor_wfs/ows?service=WFS&version=2.0.0\
&request=GetFeature&typeNames=mor_wfs:ruhver_parkseiten_line&resultType=hits" \
  | grep -o 'numberMatched="[0-9]*"'

# München: die Lizenz einer Ebene aus ihrem ISO-Metadatensatz lesen. Die
# Adresse steht als MetadataURL im GetCapabilities der Ebene.
curl -s "https://geoportal.muenchen.de/metadata/srv/api/records/\
752539b9-7f8c-4be4-a051-0d893bb3749b/formatters/xml" | grep -o 'dl-de-by-2.0'

# CORS-Header nachmessen
curl -sD- -o /dev/null -H "Origin: https://example.com" \
  "https://gdi.berlin.de/services/wfs/parkraumbewirtschaftung?service=WFS&request=GetCapabilities" \
  | grep -i access-control
```

**Hinweis zu TLS:** `gdi.berlin.de` wird von der *Telekom Security TLS RSA Root
2023* signiert, die in manchen Container-Images fehlt. Bei einem
Zertifikatsfehler ein aktuelles Mozilla-Bundle anhängen
(`python3 -c 'import certifi; print(certifi.where())'`) und per `--cacert`
übergeben — nicht die Verifikation abschalten.
