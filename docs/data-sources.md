# Datenquellen

Alle in der App verwendeten Daten mit Herkunft, Lizenz und Abrufweg. Stand der
Erhebung: 6. September 2026.

## Verwendet

Sämtliche Geodaten stammen von der **Geodateninfrastruktur Berlin**
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

Abruf: `pnpm --filter @parkingzone/ingest fetch`. Die Endpunkte stehen in
[`app/packages/ingest/src/sources.ts`](../app/packages/ingest/src/sources.ts).

Kartenkacheln: **OpenStreetMap** (`tile.openstreetmap.org`), © OpenStreetMap-Mitwirkende,
[ODbL](https://www.openstreetmap.org/copyright). Die Namensnennung ist in der App
sichtbar und Lizenzbedingung. Für einen produktiven Betrieb wäre eine eigene
Kachelquelle nötig — die
[Tile Usage Policy](https://operations.osmfoundation.org/policies/tiles/) der OSM
Foundation deckt ausgelieferte Anwendungen nicht ab. Der belegte Weg dorthin
steht in [docs/hosting.md](hosting.md): ein PMTiles-Archiv in Objektspeicher,
kein laufender Kachelserver — so macht es FreiFahren.

## Bewusst nicht verwendet

| Quelle | Umfang | Warum nicht |
| --- | --- | --- |
| `parkplaetze:parkplaetze_aussen` | **214.173** Segmente | Jede Zeile meldet `zone = "nicht bewirtschaftet"`. Der Layer beantwortet für ~190 MB eine Frage, die die App ohne ihn beantwortet: Findet der Zonen-Lookup nichts, ist Parken dort gebührenfrei. |
| Parkscheinautomaten | Nur Bezirk Pankow, Stand 2021 | Ein Bezirk, fünf Jahre alt, und CC-BY statt DL-DE/Zero — der Lizenzwechsel brächte eine Namensnennungspflicht für wenig Nutzen. Kein WFS, nur CSV/XLSX. |
| `eladeinfrastruktur` | 25 Features | Enthält keine Ladesäulen-Standorte, nur Planungshilfen. Das Feld `ladesaeule` im Segment-Layer ist die bessere Quelle. |
| OpenStreetMap Parkhäuser | unbestimmt | Die einzige Quelle für Tiefgaragen in Berlin, aber ODbL mit Share-alike: Ein Snapshot, der OSM-Daten mit den Berliner Segmenten verschmilzt, wäre eine abgeleitete Datenbank und müsste selbst unter ODbL stehen. Machbar als **getrennter** Layer, bisher nicht umgesetzt. |

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

# CORS-Header nachmessen
curl -sD- -o /dev/null -H "Origin: https://example.com" \
  "https://gdi.berlin.de/services/wfs/parkraumbewirtschaftung?service=WFS&request=GetCapabilities" \
  | grep -i access-control
```

**Hinweis zu TLS:** `gdi.berlin.de` wird von der *Telekom Security TLS RSA Root
2023* signiert, die in manchen Container-Images fehlt. Bei einem
Zertifikatsfehler ein aktuelles Mozilla-Bundle anhängen
(`python -c 'import certifi; print(certifi.where())'`) und per `--cacert`
übergeben — nicht die Verifikation abschalten.
