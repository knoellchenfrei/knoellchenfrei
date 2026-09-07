# Datenquellen

Alle in der App verwendeten Daten mit Herkunft, Lizenz und Abrufweg. Stand der
Erhebung: 6. September 2026 für Berlin und Hamburg, 7. September 2026 für
Frankfurt am Main. Drei Städte, drei Behörden, **zwei verschiedene Lizenzen** —
der Unterschied steht bei Hamburg.

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
