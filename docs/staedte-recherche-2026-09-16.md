# Städte-Recherche, zweite Runde: 86 Städte (16. September 2026)

Fortsetzung von [staedte-recherche-2026-09.md](staedte-recherche-2026-09.md)
(7. September, 24 Städte). Vier Recherche-Agenten haben am 16. September 2026
zwischen 10:26 und 12:49 MESZ **86 weitere Städte** geprüft — je Stadt zwei
Fragen, messend statt aus dem Gedächtnis: Gibt es Parkraumbewirtschaftung mit
Zonen (Beleg: die Seite der Stadt), und gibt es dafür eine offene
Web-Schnittstelle (Beleg: `GetCapabilities`/`GetFeature` oder die Datei
selbst, Felder gesehen)? Die vier Einzelberichte stehen unverändert unten;
dieser Kopf fasst zusammen.

Klassen: **A** Zonen mit Geometrie, Tarif und Zeiten offen abrufbar ·
**B** Geometrie und Zeiten, kein Betrag (wie München, Düsseldorf) · **C** nur
Geometrie (wie Dresden) · **D** Zonen existieren, aber keine offene
Schnittstelle (PDF, Straßenliste, Kartenbild) · **E** keine
Parkraumbewirtschaftung mit Zonen bekannt.

## Zählung

| Gebiet | Städte | A | B | C | D | E | offen |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Nordrhein-Westfalen | 23 | 0 | 0 | 2 | 20 | 1 | 0 |
| Süden (BW, BY, HE, RP, SL) | 26 | 1 | 1 | 2 (+1 belegt) | 21 | 0 | 0 |
| Norden und Osten | 24 | 3 | 0 | 3 | 18 | 0 | 0 |
| Österreich und Schweiz | 13 | 2 | 4 | 3 | 3 | 0 | 1 |
| **Summe** | **86** | **6** | **5** | **10** | **62** | **1** | **1** |

Mit den 24 Städten vom 7. September sind damit **110 Städte** geprüft. Das
Bild ist dasselbe wie damals, nur größer: Fast jede Stadt bewirtschaftet, fast
keine veröffentlicht die Regeln maschinenlesbar. Die Zonen liegen als PDF,
als Straßenliste oder als Kartenbild auf der Stadtseite — Klasse D ist mit
62 von 86 die Regel.

## Kandidaten mit offener Schnittstelle (Klasse A und B), nach Eignung

| # | Stadt | Einw. | Klasse | Was es gibt | Was fehlt oder stört | Lizenz |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | **Freiburg** | 0,23 Mio | A | WFS `geoportal.freiburg.de/wfs/gut_parken/gut_parken`: 37 Gebührenzonen-Polygone mit `parkgebuehr_je_stunde` (1,80/3,50/4,20 €) und Zeiten, 538 Automaten mit Tarif, Laufzeiten und Höchstparkdauer, 33 Bewohnerparkgebiete; seit 3/2025, modified 8/2026 | Ohne `srsName` still EPSG:25832 (wie Frankfurt); 7 bzw. 17 Zeit-Schreibweisen mit Tippfehlern; eine Zone trägt „Beschilderung beachten!" statt einer Zeit. Korrigiert den Negativbefund vom 7. September (damals nur das Parkleitsystem gefunden) | DL-DE/BY-2.0 |
| 2 | **Rostock** | 0,21 Mio | A | WFS + GeoJSON `geo.sv.rostock.de`: 111 Automaten mit Tarif als Zahl, Zeiten (5 Schreibweisen), Höchstparkdauer mit Einheitenfeld, 10 Bewohnerparkgebiete; aktualisiert 7/2026 | Tarifzonen nur als Punkte (wie Frankfurt); 83 Automaten mit `08:00-19:00` ohne Wochentag; WFS liefert `[lat, lon]`, Download `[lon, lat]` | CC0 |
| 3 | **Wien** | 2,0 Mio | B | GeoServer-WFS `data.wien.gv.at`: 81 Kurzparkzonen-Flächen + 795 Geschäftsstraßen-Streifen, Zeiten (3 bzw. 23 Schreibweisen), Höchstdauer | Kein Betrag im Feed (stadtweit 3,40 €/h, aus der Verordnung); Lizenz WFS CC BY 3.0 AT vs. Katalog CC BY 4.0; anderer Feiertagskalender, anderes Recht | CC BY |
| 4 | **Graz** | 0,30 Mio | A | ArcGIS FeatureServer `geodaten.graz.at`: 90 Kurzparkzonen + 75 Grüne Zonen mit Betrag, Zeiten, Dauer im Feature | Lizenz am Dienst nicht ausgewiesen — vor Nutzung klären; Österreich | offen |
| 5 | **Schwerin** | 0,10 Mio | A− | MapServer-WFS beim Landkreis: 143 Automaten mit Gebühr (3 Schreibweisen), Zeiten, Höchstparkdauer; 15 Zonenpolygone | Polygone ohne jedes Attribut; nur EPSG:25833, jedes `srsName=4326` → „Invalid SRS"; kein GeoJSON; klein | DL-DE/BY-2.0 |
| 6 | **Salzburg** | 0,16 Mio | B | WFS: 41 Zonen mit Gebührenpflicht-Text und Höchstparkdauer | Betrag stadtweit (2,20 €/h) nicht im Feed; Host aus dieser Umgebung nur über einen Umweg erreichbar; Lizenz BY vs. BY-SA unklar; Österreich | CC BY |
| 7 | **Zürich** | 0,43 Mio | B | `data.stadt-zuerich.ch`, CC0: 2 Hochtarif-Polygone + 46.282 Parkplatz-Punkte | Punkte Stand 2021, Tarif nur im Erlass, QGIS-Server-WFS mit urn-`srsName` + JSON → HTTP 500; CHF, kantonale Feiertage | CC0 |
| 8 | **Innsbruck** | 0,13 Mio | A | ArcGIS Online: 21 Zonenpolygone mit allem in einem Freitext `INFO` | Freitext mit Dezimalpunkt, keine Lizenz, neue Parkabgabeverordnung ab 2.11.2026 — der Stand verfällt | offen |
| 9 | **Cottbus** | 0,10 Mio | A− | ArcGIS FeatureServer: 5 Bewohnerparkzonen, 44 Automaten mit strukturierten Zeiten und Zone | `gebuehr` nennt die seit 1.6.2025 abgelösten Beträge (der Köln-Fall); keine Höchstparkdauer; klein | DL-DE/BY-2.0 |
| 10 | **Linz** | 0,21 Mio | B (belegt) | Shapefiles 2022 auf `data.linz.gv.at` | Host aus dieser Umgebung gesperrt, nicht abgerufen; statisch, alt | offen |
| 11 | **Heidelberg** | 0,16 Mio | B− | EasyPark-Erhebung 2022/23: 25.862 Liniensegmente mit Zeiten und Zeitlimit | Kein Betrag, keine Zonenpolygone, überholt durch das Parkraumkonzept seit 10/2024 — nur als Meldestadt | CC BY 4.0 |

Nur Geometrie (**Klasse C**, als Meldestadt möglich, für die Abfrage
unbrauchbar): Essen (9 Bewohnerparkbereiche, 2022), Bonn (Straßenabschnitte
und Hausnummern, keine Flächen, 2022), Saarbrücken (27 Polygone ohne
Attribute), Kassel (29 Bewohnerparkbezirke, nur Name, keine Lizenz),
Chemnitz (Polygone nur im internen Themenstadtplan, Lizenz „nur mit
schriftlicher Zustimmung"), Hildesheim (7 Zonen A–G), Gera (148 Linien mit
Zonenbuchstabe), Genf (53 Macaron-Zonen + 12.731 Parkierungslinien, täglich
aktualisiert — die reichste C-Quelle), Bern (42 Parkkartenzonen), St. Gallen
(3.232 Parkflächen). Dazu **belegt, nicht abgerufen:** Wiesbaden (WFS
`Bewohnerparkgebiete` in der VC-Map-Konfiguration, Host von hier gesperrt —
mit Attributen wäre es B).

## Zonen ohne offene Schnittstelle (Klasse D)

**Deutschland, 59 Städte:** Dortmund (14 Zonen als PDF-Lagepläne, 821
Datensätze im Portal, keiner davon Zonen), Duisburg, Bochum (13 Zonen als
Straßenlisten), Gelsenkirchen (131 Automatenpunkte offen, keine Zonen),
Bottrop, Herne (Zonen A–F als PDF, Automaten im GeoServer), Hamm (11 Zonen,
PDF), Mönchengladbach, Oberhausen, Leverkusen (12 Zonen), Neuss, Paderborn,
Recklinghausen, Mülheim, Siegen, Solingen, Remscheid, Hagen, Bergisch
Gladbach, Bergheim · Augsburg (Bewohnerparkgebiete als ArcGIS-Layer
**fertig**, Abfrage gesperrt, Lizenz proprietär — die lohnendste Anfrage),
Mannheim, Mainz, Darmstadt, Würzburg, Regensburg, Ulm, Ingolstadt, Heilbronn
(Neuordnung 7/2026), Pforzheim, Reutlingen, Offenbach, Fürth, Erlangen
(Portal hinter Basic Auth), Koblenz, Trier (Layer nur als Kachelbild),
Kaiserslautern, Ludwigshafen, Konstanz, Tübingen, Bamberg · Bremen
(ASV-Textliste mit Zeiten; MetaVer antwortet weiter 429), Hannover
(PDF-Bezirke), Braunschweig, Magdeburg, Halle, Erfurt, Lübeck
(Parktarifzonen-PDF), Jena, Flensburg, Oldenburg, Osnabrück, Göttingen,
Wolfsburg, Bremerhaven, Zwickau, Lüneburg, Salzgitter, Greifswald.

**Österreich und Schweiz, 3 Städte:** Klagenfurt (nur Web-GIS), Basel
(Parkflächen mit Zeiten und Tarifgebiet, aber ohne Geometrie; Tarifgebiete
seit 2025 abgeschafft), Winterthur (flächendeckende Blaue Zone). **Offen:**
Luzern (Geodienste laut Stadt vorhanden, aus dieser Umgebung nicht
erreichbar).

**Keine Zonen (Klasse E):** Hürth (stellt keine Anwohnerparkausweise aus).

## Was daraus folgt

- **Für die Zonenabfrage** kommen aus Deutschland **Freiburg** und
  **Rostock** in Frage — beide klein, beide mit sauberen Feldern; Freiburg
  hat als einzige Stadt neben Frankfurt und Karlsruhe Tarif *und* Zeiten
  *und* Höchstparkdauer an einem Dienst. Schwerin und Cottbus sind Klasse A
  nur dem Buchstaben nach (100.000 Einwohner, Attribute fehlen bzw. Preise
  veraltet).
- **Österreich** ist datenseitig besser als Deutschland (Wien, Graz,
  Salzburg, Innsbruck), kostet aber je Stadt einen eigenen Feiertagskalender,
  ein anderes Recht für den Datenschutztext und bei Graz/Innsbruck eine
  Lizenzklärung. Der nationale Zugangspunkt `mobilitaetsdaten.gv.at` bündelt
  die Kurzparkzonen aller sechs Städte mit Preisen, aber nur per
  ÖAMTC-Mustervertrag — kein Open Data.
- **Als Meldestadt** (ohne Zonenabfrage, siehe `staedte.md`, „Zwei Stufen")
  wären die zehn C-Städte und alle D-Städte sofort möglich; das ist der
  Grund, warum die Entkopplung „Meldestadt statt Zonenstadt" in `todo.md`
  steht.
- **Die lohnendsten Anfragen** an Städte, deren Daten fertig, aber nicht
  frei sind: Augsburg (Layer fertig, Lizenz fehlt), Gelsenkirchen (offener
  GeoServer, Ansprechpartner im Katalog), Wiesbaden (WFS vorhanden, von hier
  nicht erreichbar), Dortmund (größte D-Stadt, `bewohnerparkzonen@stadtdo.de`),
  Konstanz und Reutlingen (aktive Open-Data-Teams).

## Umgebung

Aus dieser Cloud-Umgebung nicht erreichbar (kein Beweis, dass es sie nicht
gibt): `ckan.open.nrw.de` (govdata spiegelt es vollständig),
`daten.hessen.de`, `metaver.de` (429, auch CSW), `daten.sachsen-anhalt.de`,
`opendata.thueringen.de`, `opendata-mv.de`, `ni-opendata.de`,
`opendata.niedersachsen.de`, `gdi1.geo.bremen.de`, `opendata.swiss` (403),
`data.gv.at`-CKAN (abgeschaltet, piveau-API geht), dazu etliche
`geoportal.<stadt>.de`. Brauchbarer Ersatz: der GDI-DE-Katalog
`gdk.gdi-de.org` (CSW), die globale ArcGIS-Hub-Suche
`hub.arcgis.com/api/v3/datasets?q=Bewohnerparken`, `ckan.govdata.de` und
`opendata.ruhr` (CKAN des RVR mit allen Ruhrgebietsstädten).

---

## Bericht: Nordrhein-Westfalen

### Kopf

Alle Abrufe am **16. September 2026 zwischen 10:26 und 10:52 UTC** (12:26–12:52 MESZ),
mit `curl --cacert /root/.ccr/ca-bundle.crt -A Mozilla/5.0` und `WebFetch`.
Zahlen sind Messungen dieses Zeitfensters, keine Abschriften.

Befragt:

| Portal / API | Ergebnis |
| --- | --- |
| `ckan.open.nrw.de/api/3/action/package_search` | **aus dieser Umgebung nicht erreichbar**: `Recv failure: Connection reset by peer` bei jedem Versuch (mit und ohne Browser-Kennung, beide CA-Bundles). `open.nrw` selbst (HTML) antwortet 200, aber `/suche?q=` ignoriert den Suchbegriff und liefert immer dieselben zehn Datensätze. Ersatz: govdata erntet Open.NRW vollständig (Kontributor `openNRW` in jedem Treffer). |
| `ckan.govdata.de/api/3/action/package_search` | offen; 8 Suchbegriffe (`bewohnerparken`, `parkzone`, `parkraum`, `parkscheinautomat`, `anwohnerparken`, `parkraumbewirtschaftung`, `parkschein`, `parkgebühr` → 500) und je Stadt 8 Begriffe (`<Stadt> AND park|parken|parkzone|parkraum|bewohnerparken|parkschein|parkscheinautomat|parkplatz`) |
| **`opendata.ruhr/api/3/action/…`** — CKAN 2.10.5 des Regionalverbands Ruhr | **Neufund.** Ein Portal für Bochum (104 Datensätze), Bottrop (140), Dortmund (765), Duisburg (103), Essen (111), Gelsenkirchen (308), Hagen (11), Hamm (143), Herne (136), Mülheim (0), Oberhausen (61), Recklinghausen (120), Kreis Recklinghausen, Moers (484), Wesel u. a. — je Stadt als Subdomain (`gelsenkirchen.opendata.ruhr`) und als `fq=organization:<name>`. Die Stadtportale `opendata.gelsenkirchen.de` leiten dorthin um. |
| `daten.geoportal.ruhr/srv/ger/q?any=…` (GeoNetwork des RVR) | offen; `bewohnerparken` 3 Treffer (alle MobilitätsAtlas Gelsenkirchen), `parkzone`/`parkraumbewirtschaftung`/`anwohnerparken` 0, `parkscheinautomat` 1 (Gelsenkirchen) |
| `www.offenesdatenportal.de/api/3` (KRZN: Moers, Kleve, Wesel, Krefeld, Bottrop 0) | `park` → 0 Treffer für meine Städte |
| `opendata.essen.de/data.json`, `opendata-duisburg.de/data.json`, `opendata.bonn.de/data.json` (DKAN; `/api/3` antwortet dort 404) | 110 / 102 / 296 Datensätze, lokal nach `park|bewohner|anwohner|gebühr` gefiltert |
| `open-data.dortmund.de/api/explore/v2.1/catalog/datasets` (Opendatasoft, 821 Datensätze), `moenchengladbach.opendatasoft.com` (29) | alle `dataset_id` gezogen und gefiltert |
| `www.arcgis.com/sharing/rest/search`, `hub.arcgis.com/api/v3/datasets` | 10 bzw. 6 Begriffe; kein Treffer für eine NRW-Stadt außer Wuppertal (schon geprüft) |
| Dienste direkt: `gis.bottrop.de` (ArcGIS WFS), `geodaten.herne.de` (GeoServer), `maps.gelsenkirchen.de` (GeoServer, OGC API Features), `gdi.gelsenkirchen.de` (WFS), `geoportal.duisburg.de/arcgisserver` (REST), `geoweb1.digistadtdo.de/doris_gdi/geoserver` (WFS+WMS, Dortmund), `geoportal.remscheid.de/masterportal` (config.json), `stadtplan.bonn.de/geojson` | GetCapabilities/Layerlisten gelesen, bei Treffern `resultType=hits` und `count=3` |

Nicht erreichbar (`connect_rejected` des Egress-Proxys oder Timeout): `geodaten.essen.de`,
`geodaten.bochum.de`, `geodaten.gelsenkirchen.de`, `geoportal.bochum.de`,
`geoportal.dortmund.de`, `geoportal.gelsenkirchen.de`, `geoportal.paderborn.de`,
`geoportal.siegen.de`, `geoportal.neuss.de`, `geoportal.hagen.de`, `geo.hamm.de`,
`geoportal.muelheim-ruhr.de`, `opendata.bochum.de`, `opendata.duisburg.de`
(richtig ist `opendata-duisburg.de`). `geoportal.moenchengladbach.de` antwortet 503,
`www.bonn.de` wechselnd 503/200, `www.gelsenkirchen.de` beim ersten Versuch 000,
beim zweiten 200 — bei diesen dreien vor „gibt es nicht" zweimal fragen.

Stufen wie im Auftrag: **geprüft** (Dienst/Datei abgerufen, Felder gesehen),
**belegt** (im Portal nachgewiesen), **Hinweis**.

### Tabelle

Einwohner grob (Stand 2024, gerundet). „Zonen" = Bewohnerparkzonen oder
gebührenpflichtige Straßenzonen laut Stadtseite. Alle Beleg-URLs am 16.09.2026
mit HTTP 200 abgerufen, sofern nicht anders vermerkt.

| Stadt | Land | Einw. | Zonen? (Beleg) | Schnittstelle | Geom. | Tarif | Zeiten | Höchstpd. | Lizenz | Aktualität | Stufe | Klasse |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Essen | NW | 0,59 Mio | ja, 6 Tarifzonen + Bewohnerparkbereiche: <https://www.essen.de/leben/sicherheit_und_ordnung/verkehrsueberwachung/parken___parkzonen.de.html> | `https://opendata.essen.de/sites/default/files/Bewohnerparkbereiche.geojson` (DKAN-Datei, dazu Shape ETRS89/EPSG 4647) | ja, **9 Polygone** | nein | nein | nein | DL-DE/BY-2.0 | modified 2022-11-09 | geprüft | **C** |
| Bonn | NW | 0,34 Mio | ja, Bewohnerparkgebiete A–Z (17) + Parkraumkonzept Nordstadt: <https://www.bonn.de/themen-entdecken/verkehr-mobilitaet/parkraumkonzept-nordstadt.php> | `https://stadtplan.bonn.de/geojson?OD=4767` (Straßenabschnitte) und `?OD=4705` (Hausnummern) | teilweise: **295 Linien + 6.341 Punkte**, keine Flächen | nein | nein | nein | CC0 (`opendefinition.org/licenses/cc-zero`) | modified 2022-01-25 | geprüft | **C** |
| Gelsenkirchen | NW | 0,27 Mio | ja (Bewohnerparken, Zonen mit Adressabgleich): <https://www.gelsenkirchen.de/de/_meta/buergerservice/onlinedienste/bewohnerparken.aspx>, <https://bwp-online.gelsenkirchen.de/> | nur Automaten: `https://maps.gelsenkirchen.de/geoserver/infrastrukturdatenbank/ogc/features/v1/collections/parkscheinautomat/items?f=json` (131 Punkte) und WFS `https://gdi.gelsenkirchen.de/wss/service/WFSMobilitaet/guest?` (`MobilitaetWFS:Parkscheinautomat`); **keine Zonenebene** | nur Punkte | nein (`Info` leer) | nein | nein | DL-DE/Zero-2.0 | `Stand` 2020-05/06 | geprüft | **D** (Automatenpunkte offen) |
| Dortmund | NW | 0,60 Mio | ja, 14 Bewohnerparkzonen: <https://www.dortmund.de/themen/mobilitaet-und-verkehr/mobilitaetsplanung/parken/bewohnerparkzonen/> | keine (821 ODS-Datensätze, davon Parken nur `park-and-ride`, `parkhauser`, `parkplatzsensoren`; GeoServer-WFS 46 Typen, WMS 311 KB: kein `park`/`bewohn` außer `fb61_park_ride_bike`) | — | — | — | — | — | — | geprüft (Negativ) | **D** |
| Duisburg | NW | 0,50 Mio | ja, Zonen B, G, H, N1, N2, P1 …: <https://www.duisburg.de/microsites/pbv/verkehr/bewohnerparkzonen> | keine (DKAN 102 Datensätze: nur „Smart-Parking-Vorgänge"; ArcGIS-Server `OpenData/OpenData`, `Masterportal/WFS_Fachdaten_MP`, `WFS_POIs`: keine Zonenebene, nur `Parkplatz`/`Parkhaus`-POIs) | — | — | — | — | — | — | geprüft (Negativ) | **D** |
| Bochum | NW | 0,37 Mio | ja, 13 Zonen A–S: <https://www.bochum.de/Buergerbuero/Dienstleistungen-und-Infos/Bewohnerparkausweis> | keine (opendata.ruhr, `organization:stadt-bochum`, 104 Datensätze: nur Behindertenparkplätze) | — | — | — | — | — | — | belegt (Negativ) | **D** |
| Mönchengladbach | NW | 0,27 Mio | ja, 4 Zonen + Westend-West seit 1.8.2025: <https://service.moenchengladbach.de/suche/-/egov-bis-detail/dienstleistung/1377/show> | keine (Opendatasoft 29 Datensätze, alle Statistik; Geoportal 503) | — | — | — | — | — | — | belegt (Negativ) | **D** |
| Oberhausen | NW | 0,21 Mio | ja (Parkraumkonzept, Bewohnerparkausweis 30,70 €/Jahr): <https://www.oberhausen.de/parkraumkonzept>, <https://serviceportal.oberhausen.de/suche/-/egov-bis-detail/dienstleistung/26715/show> | keine (opendata.ruhr `oberhausen` 61 Datensätze: nichts) | — | — | — | — | — | — | belegt (Negativ) | **D** |
| Leverkusen | NW | 0,17 Mio | ja, 12 Zonen in Opladen, Schlebusch, Wiesdorf: <https://leverkusen.kommunalportal.nrw/detail/-/vr-bis-detail/dienstleistung/11171/show> | keine (kein Open-Data-Portal gefunden; Geoportal = GIS-Consult-Viewer ohne WFS-Adresse) | — | — | — | — | — | — | Hinweis (Negativ) | **D** |
| Neuss | NW | 0,16 Mio | ja, Zone A Innenstadt, Zone B Dreikönigenviertel seit 1.11.2025: <https://www.neuss.de/news/2025/10/14/start-des-bewohnerparkens-im-dreikoenigenviertel> | keine (govdata für Neuss: nur Wanderwege) | — | — | — | — | — | — | belegt (Negativ) | **D** |
| Paderborn | NW | 0,16 Mio | ja (Bewohnerparkzonen, >3.000 Ausweise): <https://mein-digiport.de/suche/-/vr-bis-detail/dienstleistung/280/show> | keine (Portal nicht erreichbar, govdata 0) | — | — | — | — | — | — | Hinweis (Negativ) | **D** |
| Recklinghausen | NW | 0,11 Mio | ja, Altstadt + Röntgenstraße: <https://www.recklinghausen.de/redirect/bso.asp?dienstleistung=2757> | keine (opendata.ruhr `recklinghausen` 120 Datensätze: nichts) | — | — | — | — | — | — | belegt (Negativ) | **D** |
| Bottrop | NW | 0,12 Mio | ja (Bewohnerparkzonen mit Adressabgleich im Serviceportal): <https://www.bottrop.de/vv/produkte/dezernat3/33/Bewohnerparkausweis.php> | nur Parkplätze: `https://gis.bottrop.de/arcgis/services/Themenkarten/Parkplaetze/MapServer/WFSServer` (`Parkmöglichkeiten_Innenstadt__Polygone_`, 15 Flächen, mit `Gebühr`, `Gebuehrnpflichtige_Zeiten…`, `Hoechstparkdauer`) — **Parkplätze, keine Straßenzonen** | Parkplatz-Polygone | ja (Freitext) | ja (Freitext) | ja | DL-DE/Zero-2.0 | modified 2026-09-07 | geprüft | **D** |
| Hamm | NW | 0,18 Mio | ja, 11 Zonen (A/B, C, D, E, F, G, H, K, S, W, W1) mit PDF-Karten: <https://www.hamm.de/bewohnerparken> | keine (opendata.ruhr `hamm` 143 Datensätze: nichts) | — | — | — | — | — | — | belegt (Negativ) | **D** |
| Mülheim a. d. Ruhr | NW | 0,17 Mio | ja, Zonen A Altstadt, B Südviertel: <https://cms.muelheim-ruhr.de/rathaus/aemter-und-einrichtungen/ordnungsamt/strassenverkehrsbehoerde/besondere-parkregelungen-0> | keine (opendata.ruhr `mulheim-a-d-ruhr`: **0** Datensätze) | — | — | — | — | — | — | belegt (Negativ) | **D** |
| Herne | NW | 0,16 Mio | ja, 6 Zonen A–F (E, F neu 2026): <https://www.herne.de/Wirtschaft-und-Infrastruktur/Verkehr/Parkraumbewirtschaftung/> | nur Parkplatz-POIs: `https://geodaten.herne.de/geoserver/verkehr/parkmoeglichkeiten` (65 Punkte, `infotxt` = „gebührenpflichtig"/„kostenlos") | Punkte | nein | nein | nein | (keine Angabe) | 2025-09-15 | geprüft | **D** |
| Siegen | NW | 0,10 Mio | ja: <https://www.siegen.de/rathaus-politik/stadtverwaltung/dienstleistungen-a-bis-z/detailseite/bewohnerparken> | keine (Portal nicht erreichbar, govdata 0) | — | — | — | — | — | — | Hinweis (Negativ) | **D** |
| Solingen | NW | 0,16 Mio | ja (u. a. Zone E, 251 Ausweise auf 124 Plätze): <https://service.solingen.de/detail/-/vr-bis-detail/dienstleistung/3451/show> | keine | — | — | — | — | — | — | Hinweis (Negativ) | **D** |
| Remscheid | NW | 0,11 Mio | ja, Straßenliste als PDF (ab 17.04.2026): <https://www.remscheid.de/vv/produkte/3.32/146380100000146363.php> | keine (Masterportal `geo_explorer/config.json`: nur `Parkplatz`, `Parkhaus`) | — | — | — | — | — | — | geprüft (Negativ) | **D** |
| Bergisch Gladbach | NW | 0,11 Mio | ja, 2 Tarifzonen mit Automaten, **kein** Bewohnerparken: <https://www.bergischgladbach.de/parken-in-bergisch-gladbach.aspx> | keine | — | — | — | — | — | — | belegt (Negativ) | **D** |
| Hagen | NW | 0,19 Mio | ja, Zonen F (1.4.2024), H (1.8.2024), G geplant: <https://serviceportal.hagen.de/leistung/parkausweis-bewohnerparkausweis-69.html> | keine (opendata.ruhr `hagen` 11 Datensätze: nur P+R) | — | — | — | — | — | — | belegt (Negativ) | **D** |
| Bergheim | NW | 0,06 Mio | teilweise: gebührenpflichtige Bereiche Mitte und Quadrath-Ichendorf, kein Bewohnerparken: <https://www.bergheim.de/vv/produkte/parken-im-stadtgebiet-bergheim.php> | keine | — | — | — | — | — | — | belegt (Negativ) | **D** (schwach) |
| Hürth | NW | 0,06 Mio | **nein** — „Anwohnerparkausweise werden nicht ausgestellt": <https://www.huerth.de/vv/produkte/rathaus/dezernat3/ordnungsamt/anwohnerparkausweis.php> | keine | — | — | — | — | — | — | belegt | **E** |

### Städte der Klasse A/B

**Keine.** In 23 Städten Nordrhein-Westfalens (außerhalb der schon geprüften
Köln, Düsseldorf, Aachen, Wuppertal, Krefeld, Bielefeld, Münster, Moers) gibt
es keinen einzigen Datensatz, der Zonengeometrie **und** Zeiten offen abrufbar
macht — geschweige denn einen Betrag. Die zwei Klasse-C-Funde im Einzelnen,
damit die nächste Runde nicht dieselben Dateien noch einmal öffnet:

**Essen — `Bewohnerparkbereiche.geojson`, 25.371 Bytes, 9 Polygone.**
Felder `FID` (0–8), `Id` (immer 0), `NameGebiet`: `Ostviertel`, `Ostviertel 2`,
`Innenstadt Nord`, `Innenstadt Süd`, `Sternviertel (I)`, `Museum-Nord (II)`,
`Museum-Ost (III)`, `Museum-West (IV)`, `Museum-Süd (V)`. CRS im Kopf
`EPSG:4326`, Achsen `[lon, lat]` (erste Koordinate `7.0214, 51.4543`). Kein
Tarif, keine Zeiten, keine Höchstparkdauer, kein Zonenschlüssel. Quelle laut
Beschreibung „FB 66 – Amt für Straßen und Verkehr / FB 62 – Amt für
Geoinformation, Vermessung und Kataster", Lizenz DL-DE/BY-2.0, modified
2022-11-09. Die Tarife stehen nur auf der Stadtseite: sechs Tarifzonen,
Zone 1 (City) 90 Min., bis 0,90 €/15 Min., Deckel 5,00 €, Mo–Sa 10–20 Uhr;
Zone 2 120 Min., bis 0,60 €/15 Min., Deckel 3,90 €, Mo–Fr 10–19, Sa 10–16;
Zone 3 Parkscheibe 30–120 Min.; Zone 6 (Bewohnerparken) 240 Min., Deckel
8,70 €; Zone 4 „noch nicht eingerichtet". **Diese sechs Tarifzonen gibt es
nicht als Geometrie** — die neun Polygone sind die Bewohnerparkbereiche, nicht
die Tarifzonen. Mit 9 Flächen zudem sichtbar unvollständig gegenüber der
Stadtseite (Parkraumbewirtschaftung seit 1.1.2025 „erweitert").

**Bonn — zwei GeoJSON-Abfragen auf `stadtplan.bonn.de`.** `OD=4767`
(240 KB): 295 Straßenabschnitte, 259 `MultiLineString`, 31 `LineString`,
**5 ohne Geometrie**; Felder `bewohnerpark_id` (1–295), `parkgebiet_name`
(17 Werte, Schreibweise `K = Venusberg`, `A = Südstadt - 1 ` mit
Leerzeichen am Ende), `parkgebiet_buchstabe` (A, B, C, D, E, F, G, H, K, L,
M, O, S, T, V, W, Z), `bereich` (Straße mit Hausnummernspanne,
`Adenauerallee 1 - 111`). `OD=4705` (1,6 MB): 6.341 Adresspunkte mit
`parkgebiet` (1–17), `parkgebiet_name`, `strasse` (Schlüssel), `langname`,
`hausnr`, `komplett_str` (`True`/`False`/`None`). CRS
`urn:ogc:def:crs:EPSG::4326`, Achsen trotzdem `[lon, lat]` (`7.1018,
50.7047`) — die Hamburg-Falle in umgekehrter Richtung. Lizenz CC0, modified
2022-01-25. **Keine Flächen**, kein Tarif, keine Zeiten. Was die Stadt selbst
schreibt (Parkraumkonzept Nordstadt): Gebiet I „ein Euro je angefangene
halbe Stunde", Gebiet D „zwei Euro je angefangene halbe Stunde",
Bewohnerparkausweis 360 €/Jahr, ab 2027 120 €/Jahr. Ob die zwei
Nordstadt-Gebiete von November 2024 in der Datei von Januar 2022 überhaupt
enthalten sind, ist damit fraglich: `D = innere Nordstadt` ja (29 Abschnitte),
ein Gebiet `I` **fehlt** in beiden Dateien.

### Städte der Klasse D — wo die Zonen stehen

- **Dortmund** (0,60 Mio): 14 Zonen (Hafen-Ost, Weingartenstraße,
  Gerichtsviertel, Mühlenstraße, Joseph-Scherer-Straße,
  Geschwister-Scholl-Straße, City, Klinikviertel, Hörde, Chemnitzer Straße
  I–IV, Gutenbergstraße, Löwenstraße, Hainallee, Westerbleichstraße) als
  **PDF-Lagepläne** je Zone, City als PNG, plus Gesamtübersicht
  „Untersuchungsbereiche" als PDF. Amt: Stadtplanungs- und Bauordnungsamt,
  `bewohnerparkzonen@stadtdo.de`. Ausweis 30,70 €/Jahr. Zwei neue Zonen je
  Jahr geplant (Ratsbeschluss, ab 2026 Hörde). Das Geoportal
  (`geoweb1.digistadtdo.de`, map.apps) hat eine Gruppe `parken_group` in der
  App „verkehr" — der dahinterliegende GeoServer führt in WFS **und** WMS
  keine Bewohnerpark-Ebene, nur `fb61_park_ride_bike`. **Anzeichen für einen
  Datensatz: keine**; 821 Datensätze im Opendatasoft-Portal, das Thema fehlt.
- **Duisburg** (0,50 Mio): Übersichtskarte „Stand November 2019" auf der
  Stadtseite, dazu Straßensuche und Flyer-PDFs je Zone (`FLYER_fuer_ZONE_N2.pdf`).
  Amt für Stadtentwicklung und Projektmanagement. ArcGIS-Server öffentlich,
  aber ohne Zonenebene. Keine Anzeichen.
- **Bochum** (0,37 Mio): 13 Zonen (A, B, C, D, E, F, G, H, J, K, O, R, S)
  als **Straßenlisten im Fließtext**, keine Karte. Büro für
  Kfz-Angelegenheiten. Drei neue Zonen (Hamme, Innenstadt-West, Bergmannsheil)
  und fünf Erweiterungen laufen (Grüne Bochum, 9.1.2025). Ausweis 90 €/Jahr.
  Keine Anzeichen.
- **Gelsenkirchen** (0,27 Mio): Zonen nur über den Adressabgleich in
  `bwp-online.gelsenkirchen.de`; keine Karte. Aber: die Stadt hat mit der
  Infrastrukturdatenbank (`maps.gelsenkirchen.de`, OGC API Features, 97
  Collections, DL-DE/Zero) und dem MobilitätsAtlas-WFS (`gdi.gelsenkirchen.de`,
  30 Typen) die **technisch beste Grundlage** meiner Liste — nur eben ohne
  Zonen. `parkplatz` (34 Punkte) trägt Tarife als Freitext in
  `Internetbeschreibung` („Mo. - Fr.: 08.00 - 18:00 … € 1,00 je angefangene
  Std"), aber das sind Parkplätze der Verkehrsgesellschaft. Ansprechpartner
  laut GeoNetwork: Stadt Gelsenkirchen, `patrick.ambe…` (Datensatz
  `9b2871d5-258c-4392-9f7e-ed9874e53390`). **Beste Adresse für eine
  Rückfrage nach einer Zonenebene.**
- **Mönchengladbach** (0,27 Mio): 4 Zonen (Altstadt, Gründerzeitviertel Ost
  und West, Bethesda) + Westend-West seit 1.8.2025; Regel dort „Mo–Sa 9–22 Uhr
  max. 3 h mit Parkscheibe". Nur Serviceportal-Text. Keine Anzeichen.
- **Hamm** (0,18 Mio): 11 Zonen mit **Übersichtskarte und PDF-Einzelplänen**
  (Mitte, Süden, Westen, Hövel, Marienhospital); Parkscheiben- plus
  Bewohnerregelung. Verkehrsplanung, Tel. 02381 17-4109. Die Stadt liefert
  bereits WFS-Dienste ins RVR-Portal (`Essbare Stadt Hamm`) — die Hürde wäre
  klein.
- **Herne** (0,16 Mio): 6 Zonen A–F, Übersichtskarten als PDF (C, E, F) und
  „Adressenlisten der einzelnen Zonen" (PDF, 170 KB). Herne hat einen
  öffentlichen GeoServer (`geodaten.herne.de`), der schon `verkehr:parkmoeglichkeit`
  und `E-Scooter No-Parking-Zonen` ausliefert — auch hier wäre eine Zonenebene
  nur eine Frage des Freischaltens. Fachbereich Bürgerdienste, `einwohneramt@herne.de`.
- **Oberhausen** (0,21 Mio): Seite „Parkraumkonzept" (Verkehrsplanung und
  Signalwesen), Zonen im Serviceportal; 30,70 €/Jahr. Keine Anzeichen.
- **Leverkusen** (0,17 Mio): 12 Zonen (Opladen, Schlebusch, Wiesdorf),
  Fachbereich 36, nur Kommunalportal-Text. Keine Anzeichen.
- **Neuss** (0,16 Mio): Zone A Innenstadt (10 €/Monat), Zone B
  Dreikönigenviertel seit 1.11.2025 (12 €/Jahr, Testphase ein Jahr, Fremde
  werktags 7–19 Uhr 2 h mit Parkscheibe). Pressemeldungen, keine Karte.
- **Paderborn** (0,16 Mio): Zonen nur im DigiPort-Text; Bestandsanalyse des
  IMOK (Planersocietät 2020) als PDF. Keine Anzeichen.
- **Recklinghausen** (0,11 Mio): Altstadt + Umfeld und Röntgenstraße;
  Ansprechpartnerin im Bürgerservice, Stadthaus A. Keine Anzeichen.
- **Bottrop** (0,12 Mio): Bewohnerparkzonen mit Adressabgleich im Serviceportal,
  keine Karte. Das Amt für Informationsverarbeitung (Kontakt L. Lüsebrink)
  veröffentlicht schon Parkplatz-Polygone mit Gebühren-Freitext (`0,05 Euro je
  angefangene 6 Minuten`, `Mo - Fr 09:00 - 17:00 außer an Feiertagen`) —
  dieselbe Stelle könnte die Zonen liefern.
- **Mülheim** (0,17 Mio): Zonen A und B als **Abbildung** auf der Seite,
  Straßenverkehrsbehörde; Ausweis 150 €/Jahr. Organisation im RVR-Portal
  angelegt, aber leer.
- **Siegen** (0,10 Mio), **Solingen** (0,16 Mio; Gebühr steigt 2026 von 30,70
  auf 120 €), **Remscheid** (0,11 Mio; Straßenliste-PDF ab 17.04.2026, 180 €/Jahr,
  Fremde 9–19 Uhr 2 h mit Scheibe), **Hagen** (0,19 Mio; Zonen F, H, G; FB 32):
  nur Serviceportal-Texte bzw. PDF-Listen. Keine Anzeichen.
- **Bergisch Gladbach** (0,11 Mio): zwei **Tarifzonen** für Parkplätze mit
  Automaten (Zone 1: 0,50 €/20 Min., Zone 2: 0,50 €/30 Min., Mo–Fr 9–20, Sa
  9–14 Uhr, Adventssamstage frei), ausdrücklich **kein** Bewohnerparkausweis —
  nur Ausnahmegenehmigungen für einzelne Straßen (12 €/Monat). Allgemeine
  Ordnungsbehörde, `verkehrsueberwachung@stadt-gl.de`.
- **Bergheim** (0,06 Mio): gebührenpflichtig in Mitte und Quadrath-Ichendorf
  seit 1.3.2016, 0,50 € je angefangene halbe Stunde bis 3 h, Tagesticket 5 €,
  E-Fahrzeuge frei; kein Bewohnerparken. Verkehr und Mobilität, Tel. 02271 89649.

### Negativbefunde

- **Hürth** — Klasse E. Die Stadt schreibt selbst, Anwohnerparkausweise
  würden nicht ausgestellt.
- **`ckan.open.nrw.de`** — aus dieser Umgebung nicht erreichbar (Connection
  reset). Da govdata alle Open.NRW-Datensätze mit Kontributor `openNRW` führt
  und `opendata.ruhr` die Ruhrgebietsstädte direkt hält, fehlt dadurch nichts
  Nachweisbares; wer es nachprüfen will, tut es aus einer anderen Umgebung.
- **`daten.geoportal.ruhr`** kennt für 11 Ruhrgebietsstädte **keinen** Datensatz
  zu `parkzone`, `parkraumbewirtschaftung` oder `anwohnerparken`.
- **ArcGIS Online / Hub**: Für deutsche Suchbegriffe erscheinen Goslar,
  Cottbus, Chemnitz, Parchim, Innsbruck, Wuppertal, Karlsruhe — keine der
  23 Städte. Ein `Parkscheinautomaten`-Feature-Service des Nutzers `S.Hormes`
  ist ohne Ortsangabe und wurde nicht weiterverfolgt.
- **`osm-daten-parkscheinautomaten-nrw`** (Kreis Viersen, `geo.kreis-viersen.de/ows/osm-daten`,
  nächtlich aus OSM): landesweite Automatenpunkte aus OpenStreetMap, kein
  amtlicher Datensatz — Weg B, nicht Weg A.
- **Freiburg** (nicht mein Auftrag, Nebenfund): govdata führt seit dem
  17.07.2026 `parkgebuhrenzonen-der-stadt-freiburg-i-br` mit WFS/WMS. Die
  Recherche vom 7. September hatte für Freiburg „Parkhäuser statt Straßenraum"
  notiert. **Nachprüfen** — das wäre die einzige Änderung gegenüber der ersten
  Runde.
- Städte, die im RVR-Portal eine Organisation haben, aber unter „park" nur
  Parkhäuser, P+R oder Behindertenparkplätze liefern: Dortmund, Gelsenkirchen,
  Bottrop, Herne, Hagen, Bochum. Dieselbe Verteilung wie in `staedte-recherche-2026-09.md`,
  Abschnitt 3: **Bewirtschaftungszonen sind in NRW außerhalb von Köln,
  Düsseldorf, Aachen, Wuppertal, Krefeld und Moers nicht Teil des
  Open-Data-Angebots** — obwohl mindestens Dortmund, Hamm, Herne und Duisburg
  die Karten intern als PDF vorhalten.

### Zählung und Rangliste

| Klasse | Anzahl | Städte |
| --- | --- | --- |
| A | **0** | — |
| B | **0** | — |
| C | **2** | Essen (9 Polygone), Bonn (Linien + Hausnummern) |
| D | **20** | Dortmund, Duisburg, Bochum, Gelsenkirchen, Mönchengladbach, Oberhausen, Leverkusen, Neuss, Paderborn, Recklinghausen, Bottrop, Hamm, Mülheim, Herne, Siegen, Solingen, Remscheid, Bergisch Gladbach, Hagen, Bergheim |
| E | **1** | Hürth |

Rangliste nach Einwohnern × Datenqualität: **leer für A/B.** Als Meldestadt
(Klasse C) käme allenfalls **Essen** in Frage (0,59 Mio, echte Flächen,
DL-DE/BY-2.0) — mit dem Vorbehalt, dass 9 Polygone von 2022 den seit 2025
erweiterten Bestand kaum abbilden; **Bonn** danach (0,34 Mio, CC0, aber ohne
Flächen und mit einem Gebiet, das in der Datei fehlt). Wenn eine NRW-Stadt
angefragt werden soll, dann in dieser Reihenfolge: **Gelsenkirchen** (offener
GeoServer mit 97 Collections unter DL-DE/Zero, Ansprechpartner im Katalog),
**Herne** und **Hamm** (beide liefern schon WFS ins RVR-Portal), **Dortmund**
(größte Stadt, PDF-Pläne je Zone liegen vor, Amt mit Funktionsadresse).



## Bericht: Süden: Baden-Württemberg, Bayern, Hessen, Rheinland-Pfalz, Saarland

Agent `sued`. Alle Abrufe am **16. September 2026, 12:26–12:49 Uhr MESZ**
(10:26–10:49 UTC), mit `curl --cacert $(python3 -c 'import certifi; …')`.
Stufen wie im Auftrag: **geprüft** (Dienst/Datei selbst abgerufen, Felder
gesehen), **belegt** (Datensatz im Portal nachgewiesen), **Hinweis**.

### Befragte Portale und APIs

| Portal | Weg | Ergebnis |
| --- | --- | --- |
| `ckan.govdata.de` | `package_search`, je Stadt `<Stadt> park` und generisch `bewohnerpark`, `anwohnerpark`, `parkraumbewirtschaftung`, `parkzone`, `parkscheinautomat`, `parklizenz`, `parkgebühren` | offen, vollständige CKAN-API; fand Freiburg, sonst für die 25 Städte nichts Zonen-bezogenes |
| `mobidata-bw.de` | CKAN unter `https://mobidata-bw.de/api/3/action/package_search` (`www.` leitet mit 301 um) | Karlsruhe, Freiburg, Heidelberg, Konstanz, Friedrichshafen; keine Zonen für die BW-Städte des Auftrags |
| `open.bydata.de` | piveau `GET /api/hub/search/search?q=…&filter=dataset` (JSON; die CKAN-Adresse `/api/3/action/…` liefert nur HTML) | einziger Bewohnerpark-Treffer bayernweit: Kempten (bekannt); Würzburg nur Parkhäuser |
| `daten.hessen.de` | CKAN-API | **aus dieser Umgebung nicht erreichbar** (`CONNECT tunnel failed, 502`); Hessen über govdata (Harvesting) mitgeprüft: nichts |
| `open.rlp.de` (= daten.rlp.de) | `/api/3/action/…` → **403**, Suche nur als HTML-Formular (`/de/suchergebnisse`); RLP-Datensätze laufen als Organisation „Land Rheinland-Pfalz" über govdata mit | nichts zu Parkzonen |
| Saarland | `opendata.saarland.de` existiert nicht (DNS); `www.saarland.de/opendata` 403; `geoportal.saarland.de` erreichbar (Mapbender) | Stadtportal `opendata.saarbruecken.de` (CKAN 2.11.4) ist die Quelle |
| ArcGIS Online `arcgis.com/sharing/rest/search` | `Bewohnerparken`, `Bewohnerparkzonen`, `Parkraumbewirtschaftung`, `Parkzonen`, `Parkscheinautomaten`, je Stadt | Augsburg (Document Link ins Geoportal), sonst nur Cottbus/Chemnitz/Goslar u. a. |
| Stadtportale | `mannheim.opendatasoft.com` (22 Datensätze), `mannheim-opendata.hub.arcgis.com` (Katalog **privat**, API 401), `ckan.datenplattform.heidelberg.de`, `offenedaten-konstanz.de` + `open-geodaten-konstanz-gis.opendata.arcgis.com`, `opendata.darmstadt.de` (`data.json`, 39 Datensätze), `opendata.wuerzburg.de` (Opendatasoft), `opendata.saarbruecken.de`, `portal.ulm.de/solr-admin`, `geodaten.augsburg.de` (ArcGIS Enterprise), `geoportal.kassel.de` (ArcGIS Server), `geoportal.freiburg.de` (WFS) | siehe Tabelle |

Nicht erreichbar / gesperrt: `daten.hessen.de` (502), `geoportal.wiesbaden.de`
(CONNECT abgelehnt — trägt den Bewohnerpark-WFS, siehe Wiesbaden),
`ludwigshafen.de` und `opendata.ludwigshafen.de` (Myra-Cloud-Block, 503),
`geoportal.kaiserslautern.de` (503), `geoportal.regensburg.de` (503),
`datenkatalog-kassel-geoportal.hub.arcgis.com` (403), `fuerth.de`
(Cloudflare-Challenge, 403; die PDFs darunter gehen), `opendata.erlangen.de`
(401 Basic Auth — nicht öffentlich). DNS-Fehlanzeigen (Host gibt es nicht):
`opendata.mannheim.de`, `opendata.augsburg.de`, `geoportal.mainz.de`,
`geoportal.ingolstadt.de`, `geoportal.wuerzburg.de`, `geoportal.darmstadt.de`,
`geoportal.reutlingen.de`, `geoportal.heidelberg.de`.

### 1. Tabelle

Einwohner grob (Mio). „Beleg" ist die Seite der Stadt, am 16. September
abgerufen. „Aktualität" bei Diensten: `modified` im Metadatensatz bzw. Datum
auf dem Dokument.

| Stadt | Land | Einw. | Zonen? (Beleg) | Schnittstelle | Geom. | Tarif | Zeiten | Höchstpd. | Lizenz | Aktualität | Stufe | Klasse |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| **Freiburg** (Nachprüfung) | BW | 0,23 | ja, 3 Gebührenzonen + 33 Bewohnerparkgebiete (<https://www.freiburg.de/pb/1268180.html>) | WFS 2.0 `https://geoportal.freiburg.de/wfs/gut_parken/gut_parken` — `ms:parkgebzonen` (37), `ms:bewohnerparken` (33), `ms:psa` (538) | ja | **ja** (`1,80 €`, `3,50 €`, `4,20 €` je Stunde + Tagespauschale) | **ja** (7 Schreibweisen Zonen, 17 Automaten) | ja (Automaten, `hoechstparkdauer_in_h`) | DL-DE/BY-2.0, Vermerk „Datengrundlage: Stadt Freiburg, www.freiburg.de" (Capabilities) | modified 2026-07-02 (Zonen), 2026-08-11 (Automaten); govdata 2026-09-15 | geprüft | **A** |
| Heidelberg | BW | 0,16 | ja, 6 Stadtteile, gesamtstädtische Ausweitung seit 10/2024 (<https://www.heidelberg.de/HD/Leben/parkraumbewirtschaftung.html>) | GeoJSON/SHP „On-Street Parkplätze" `ckan.datenplattform.heidelberg.de` (33,7 MB, 25.862 Straßensegmente) | Linien, keine Zonen | nein | ja, je Segment (`Bewirtscha`, `Erlaubnisz`, 8 bzw. 131 Schreibweisen), nur 220 bzw. 2.541 Segmente belegt | ja (`Zeitlimit`: 30/60/120/180 min) | CC BY 4.0 | Erhebung 11/2022–05/2023 (EasyPark), Metadaten 2025-03-31 | geprüft | **B−** (Erhebung, veraltet; Zonen als Polygone fehlen) |
| Saarbrücken | SL | 0,18 | ja, Zonen A–U (<https://www.saarbruecken.de/rathaus/buergerservice/kfz_angelegenheiten/bewohnerparkausweis/uebersicht_ueber_die_parkzonen>) | CKAN `opendata.saarbruecken.de/dataset/parkzonen`: `parkzonen_fl.geojson` (27 MultiPolygone), `parkzonen_txt_pos.geojson` (30 Beschriftungspunkte) | ja | nein | nein | nein | „datenliz-de" (Datenlizenz Deutschland, Variante im Portal nicht ausgeschrieben) | 2026-08-27 | geprüft | **C** |
| Kassel | HE | 0,20 | ja, Parkgebührenzonen I/II, Bewohnerparkbezirke, seit 1.5.2026 verdoppelt (<https://www.kassel.de/buerger/verkehr_und_mobilitaet/mit-dem-auto/inhaltsseiten/gebuehrenpflichte-parkzonen.php>) | ArcGIS REST `https://geoportal.kassel.de/arcgis/rest/services/Service_Daten/Verkehr_Mobilitaet/MapServer/27` „Bewohnerparkbezirke" (29 Polygone, Query/Data) | ja | nein (Zonenkarte nur als PDF) | nein | nein | **keine** (`licenseInfo` leer, Copyright „Stadt Kassel, Vermessung und Geoinformation") | Layer o. Datum; PDFs 2026-02-04 / 2026-03-17 | geprüft | **C** (ohne Lizenz eher D) |
| Wiesbaden | HE | 0,28 | ja, 17 Zonen, Mo–Fr 9–22 Uhr (<https://www.wiesbaden.de/bewohnerparken>) | VC-Map-Konfiguration nennt WFS-GeoJSON `https://geoportal.wiesbaden.de/cgi-bin/mapserv.fcgi?map=d:/openwimap/umn/map/3d/verkehr_wfs.map&…&TYPENAME=Bewohnerparkgebiete` + WMS `verkehr.fcgi` | ja (lt. Konfig) | ? | ? | ? | unbekannt | — | **belegt**, Host aus dieser Umgebung nicht erreichbar | **C?** (nachprüfen) |
| Augsburg | BY | 0,30 | ja, Bewohnerparkgebiete Innenstadt (<https://www.augsburg.de/buergerservice-rathaus/verkehr/parken-neu/bewohnerparken-co>) | ArcGIS `https://geodaten.augsburg.de/server/rest/services/Geoportal_Projekte/Verkehr_Mobilität/MapServer/5` „Bewohnerparkgebiete" (Polygon, Felder `NAM`, `BESCHRIEB`, `UEB_DAT`) — **Query abgelehnt** („capability not supported"), nur Kartenbild | Bild | nein | nein | nein | **proprietär** („Jegliche Nutzung … bedarf einer vorherigen, schriftlichen E[rlaubnis]", AGO-Item `79a7db26…`) | Item 2022-06 | geprüft | **D** |
| Mannheim | BW | 0,32 | ja, 17 Zonen 1.1–5.0 (<https://www.mannheim.de/de/buerger-sein/bewohnerparken>) | keine; Opendatasoft (22 Datensätze) ohne Parken, ArcGIS-Hub-Katalog privat | — | — | — | — | — | Zonen-PDFs 2026-02 | geprüft (Portale) | **D** |
| Mainz | RP | 0,22 | ja, Kartenübersicht (<https://www.mainz.de/geoinformationen/verkehr/bewohnerparken-kartenuebersicht>) | Mapbender-2-Viewer `gint.mainz.de/gint1` (Layer `bewohnerpark`), WMS-Kennung nicht ermittelbar; kein Open-Data-Eintrag | Bild | — | — | — | — | — | geprüft | **D** |
| Darmstadt | HE | 0,16 | ja, Zonen i, K, JO, BE1/2, MA, WO, WA1/2 …, 6–22 Uhr, 2 h (<https://www.darmstadt.de/leben/mobilitaet/auto-und-parken/parken>) | keine (`opendata.darmstadt.de`: nur Verkehrszählungen) | — | — | — | — | — | PDF-Übersicht 07/2025 | geprüft | **D** |
| Würzburg | BY | 0,13 | ja, Zonen I „Bischofshut", Z Zellerau u. a. (<https://www.wuerzburg.de/themen/verkehr--mobilitaet/parken-in-wuerzburg>) | keine (`opendata.wuerzburg.de` nur „Parkplatzdaten" = Parkhäuser) | — | — | — | — | — | — | geprüft | **D** |
| Regensburg | BY | 0,16 | ja, 13 Bewohnerparkzonen (<https://www.regensburg.de/leben/verkehr-u-mobilitaet/parken>) | keine; PDF `bewohnerparkbezirke-uebersicht-082025.pdf`; Geoportal 503 | — | — | — | — | — | 08/2025 | geprüft | **D** |
| Ulm | BW | 0,13 | ja, Zonen A–H, Mischparken (<https://www.ulm.de/leben-in-ulm/verkehr-und-mobilitaet/individualverkehr/parken-in-ulm/parkraummanagement>) | keine (`portal.ulm.de` Solr-Katalog: nur „Parkhäuser und P+R") | — | — | — | — | — | Zonen D–H seit 1.2.2026 | geprüft | **D** |
| Ingolstadt | BY | 0,14 | ja (<https://www.ingolstadt.de/Rathaus/Verkehr/Parken/Parken-im-öffentlichen-Straßenraum/>) | keine (bydata: nur Baustellen, Wetter) | — | — | — | — | — | — | geprüft | **D** |
| Heilbronn | BW | 0,13 | ja, Neuordnung 1.7.2026 (<https://www.heilbronn.de/umwelt-mobilitaet/mobilitaet/parken/bewohnerparken.html>) | keine; PDFs `Anlage_2_Plan_Bewohnerparkzonen_Innenstadt_Stand_02_2026.pdf`, `RVO_Bewohnerparken_05.05.2026.pdf` | — | — | — | — | — | 05/2026 | geprüft | **D** |
| Pforzheim | BW | 0,13 | ja (Bewohnerparkausweis, <https://www.pforzheim.de/kontakt/anfahrtparken/parkmoeglichkeiten.html>) | keine; Hub `opendata-pforzheim.hub.arcgis.com` ohne DCAT-Feed; Parkplan PDF | — | — | — | — | — | — | geprüft | **D** |
| Reutlingen | BW | 0,12 | ja, Zonen A, E, G, H, T, K, L, P (<https://www.reutlingen.de/bewohnerparken>) | keine; Geoportal „Mobilität und Verkehr" (Bewohnerparken abgebildet, kein OGC-Endpunkt gefunden); Open-Data-Seite nur ALKIS + MobiData | — | — | — | — | — | — | geprüft | **D** |
| Offenbach | HE | 0,13 | ja, Bezirke A, B, F, G, L, M, N, O (<https://www.offenbach.de/buerger_innen/verkehr-mobilitaet/mit-dem-auto/bewohnerparken.php>) | keine; PDF `Bewohnerparkbezirke_2023.pdf` | — | — | — | — | — | 2023 | geprüft | **D** |
| Fürth | BY | 0,13 | ja (Straßenverzeichnis-PDF <https://www.fuerth.de/fileadmin/redaktion/02-Bauen-Mobilitaet/02-Dokumente-Allgemein/Bewohnerparken-Strassen-Verzeichnis-Fuerth.pdf>) | keine | — | — | — | — | — | — | belegt (Seite 403, PDF 200) | **D** |
| Erlangen | BY | 0,12 | ja, Bewohnerparkgebiete, Zone I/III der Parkgebührenordnung 2 €/h (<https://erlangen.de/aktuelles/parken-in-erlangen>) | keine öffentliche; `opendata.erlangen.de` 401; PDFs `150_00_parkgebuehren_plan.pdf`, `lageplan_parkgebuehrenverordnung.pdf` | — | — | — | — | — | — | geprüft | **D** |
| Koblenz | RP | 0,11 | ja, Zonen 7A–11 (<https://www.koblenz.de/umwelt-und-planung/mobilitaet/parken-in-koblenz/bewohnerparkausweis/>) | keine; Geoportal nur Parkleitsystem (conwee) | — | — | — | — | — | — | geprüft | **D** |
| Trier | RP | 0,11 | ja, Zonen N, M, S seit 7/2020 (<https://www.trier.de/leben-in-trier/verkehr-mobilitaet/parken/bewohnerparken/1933.Bewohnerparkzonen.html>) | Geoportal-Layer `bewohnerparkzonen` nur als TMS-Kacheln (`service.geoportal-trier.de/mapcache/tms/`); PDF `4657_bewohnerparkzonen_2025.pdf` | Bild | — | — | — | — | 02/2025 | geprüft | **D** |
| Kaiserslautern | RP | 0,10 | ja, Zonen 1–12, Kern 1 €/30 min, Rand 1 €/60 min, Mo–Sa 8–19 (<https://www.kaiserslautern.de/sozial_leben_wohnen/verkehr_parken/autos_und_co/parken/zonen/index.html.de>) | keine; PDF `parkzonen__gebuehren_ab_mai_2023.pdf`; Geoportal 503 | — | — | — | — | — | 05/2023 | geprüft | **D** |
| Ludwigshafen | RP | 0,17 | ja (Suchtreffer <https://ludwigshafen.de/buergerservice/dienstleistungen/bewohnerparken>; Seite selbst blockt) | keine erreichbar | — | — | — | — | — | — | Hinweis (Host gesperrt) | **D** |
| Konstanz | BW | 0,09 | ja, Altstadt/Paradies/Petershausen u. a. (<https://www.konstanz.de/leben+in+konstanz/mobilitaet/parkleitsystem>, PDFs) | keine für Zonen; ArcGIS Hub nur „Parkplätze" (Parkhäuser, `has_fee`, `fee_descr`) | — | — | — | — | CC0 (Hub) | — | geprüft | **D** |
| Tübingen | BW | 0,09 | ja, Gebiete 30–51, Gebührenzonen 1–3 (<https://www.tuebingen.de/Dateien/461_parkraumbewirtschaftung_anlage.pdf>) | keine; Stadtplan `#parkraumgebiete` ohne offenen Dienst | — | — | — | — | — | — | geprüft | **D** |
| Bamberg | BY | 0,08 | ja, Parklizenzgebiete, Zone 1 = 600 m um Maxplatz (<https://www.stadt.bamberg.de/Schnellnavigation/Suche/Parkraummanagement.php?object=tx,2730.1686.1>) | keine | — | — | — | — | — | — | geprüft | **D** |

### 2. Klasse A/B im Einzelnen

#### Freiburg — geprüft, geeignet (Klasse A)

Die Recherche vom 7. September hatte Freiburg als „Parkhäuser statt
Straßenraum" abgehakt. Das war der falsche Datensatz: Neben `gdm_pls` gibt es
seit dem 31. März 2025 (`issued`) den WFS **`gut_parken`** des Garten- und
Tiefbauamts, Titel „Parkzonen", der auf govdata und MobiData BW als
„Parkgebührenzonen der Stadt Freiburg i. Br." und „Parkscheinautomaten der
Stadt Freiburg i. Br." katalogisiert ist.

- **Dienst:** `https://geoportal.freiburg.de/wfs/gut_parken/gut_parken`
  (MapServer, WFS 2.0.0, `OUTPUTFORMAT=geojson|geopackage|shapezip`). Sechs
  Typnamen: `ms:parkgebzonen`, `ms:bewohnerparken`, `ms:psa`,
  `ms:behindertenparkplatz_detail`, `ms:behindertenparkpl_uebersicht`,
  `ms:gesperrte_flaechen_pr`. Auch WMS unter `/wms/gut_parken/gut_parken`.
- **`parkgebzonen`** — `numberMatched="37"`, Polygone. Felder: `fid`,
  `parkgebuehrenzone` (1/2/3), `zonenname` (`Zone 1`…`Zone 3`),
  `parkgebuehr_je_stunde` (`4,20 €` / `3,50 €` / `1,80 €` / `--`),
  `tages-parkpauschale` (`21,00 €` / `17,50 €` / `9,00 €` /
  `9,00 € oder ÖPNV-Ticket`), `zeit_der_gebuehrenpflicht`. Verteilung:
  Zone 1 ×1, Zone 2 ×2, Zone 3 ×34; sechs Zone-3-Flächen haben `--` als
  Betrag mit `durchgehend` als Zeit (Pauschalplätze, ÖPNV-Ticket gilt).
  Die Beträge stimmen mit der Stadtseite überein (Zone 1: 4,20 €/21 €, 9–23
  Uhr; Zone 2: 3,50 €/17,50 €, 9–19; Zone 3: 1,80 €/9 €, 9–19).
- **Zeiten der Zonen, 7 Schreibweisen:** `werktags 09:00-19:00 Uhr` (26),
  `durchgehend` (6), `werktags 08:00-18:00 Uhr`, `werktags 07:00-19:00 Uhr`,
  `Montag - Freitag 07:30-19:00 Uhr; Samstag 09:00-19:00 Uhr`,
  `werktags 09:00-19:00 Uhrä` (**Tippfehler im Feed**) und
  `Beschilderung beachten!` — und das steht ausgerechnet an der **einzigen
  Zone-1-Fläche**. Die Zeit für Zone 1 (9–23 Uhr) steht also nicht am
  Polygon, sondern nur an den Automaten (`laufzeiten` = `werktags 09:00 -
  23:00` bei 93 der 110 Zone-1-Automaten). Der Datenbau muss Zone 1 aus den
  Automaten oder der Satzung nehmen.
- **`psa`** — `numberMatched="538"`, Punkte. Felder: `gid`, `standort`,
  `stadtteil` (16), `gebiet` (35, davon 57 leer), `gebuehrenzone` (1/2/3),
  `tarif_in_euro_h` (1.8/3.5/4.2, Zahl) und `tarif_e_h` (Text `1.80`),
  `laufzeiten` (**17 Schreibweisen**, mit Zeilenumbrüchen:
  `werktags\n09:00 - 19:00` (324), `werktags\n09:00 - 23:00` (87), `täglich
  00:00 - 24:00` (15), `werktags 9-19 Uhr` (13), `9 - 19 Uhr`,
  `Mo-Fr 07:30-19:00; Sa 09-19`, `werktags 05:30 - 20:45` …),
  `hoechstparkdauer_in_h` (24/1/2/4; 506× `24`), `handyparkzone`,
  `kartenzahlung`, `aktiv` (alle `True`).
- **`bewohnerparken`** — 33 Polygone: `nummer` (32 distinkt, Nr. 31 doppelt),
  `gebiet` (`Annaplatz / AP`), `beschreibung` (Straßenring als Freitext),
  `gebart`/`prinzip` (`Trennprinzip` ×10, `Mischprinzip` ×23). Kein Betrag,
  keine Zeit — Bewohnerparken kostet Besucher nichts Eigenes; die Gebühr
  kommt aus der Gebührenzone darüber.
- **Fallen:** Ohne `SRSNAME` antwortet der Dienst still in **EPSG:25832**
  (`[412031.0, 5317230.4]`), genau wie Frankfurt; mit
  `SRSNAME=urn:ogc:def:crs:EPSG::4326` kommt **`[lon, lat]`**
  (`[7.8207, 48.0023]`). GeoJSON ohne `crs`-Objekt. Die Portal-Links im
  Katalog setzen `SRSNAME=EPSG:25832` fest. Betrag mit Komma und Leerzeichen
  vor `€`; im PSA-Feed als Punkt-Dezimalzahl. Zonen-Polygone tragen keinen
  Bewohnerpark-Bezug, die Automaten tragen `gebiet` als Freitext, der nicht
  eins zu eins auf `bewohnerparken.gebiet` passt (`Sternwald Quartier` vs.
  `Sternwaldquartier`).
- **Lizenz:** `<Fees>` in den Capabilities: „Dieser Datensatz/Dienst kann
  gemäß der 'Datenlizenz Deutschland - Namensnennung - Version 2.0'
  (https://www.govdata.de/dl-de/by-2-0) genutzt werden. 'Datengrundlage:
  Stadt Freiburg, www.freiburg.de'". Dieselbe Lizenz wie Hamburg und
  Frankfurt. Ansprechpartner lt. Metadaten: Stadt Freiburg i. Br. — Garten-
  und Tiefbauamt; Provider im Dienst: Stabsstelle Digitales Bauen und GeoIT.
- **Aktualität:** `modified` 2026-07-02 (Zonen), 2026-08-11 (Automaten);
  Beschreibung: „Der Datensatz wird laufend aktualisiert."

#### Heidelberg — geprüft, mit Vorbehalt (Klasse B−)

„On-Street Parkplätze Heidelberg" (`ckan.datenplattform.heidelberg.de`, Amt
für Mobilität, CC BY 4.0) ist eine **Parkraumerhebung der Firma EasyPark**,
Datenerfassung 2022-11 bis 2023-05, Metadaten zuletzt 2025-03-31. 25.862
`LineString`-Segmente in **EPSG:25832** (JSON ohne `crs`, ein zweites Feld
`Position_a` trägt dieselbe Geometrie als WKT), 15 Stadtteile. Felder:
`Parkwinkel` (Parkverbot 17.229, Parallel 7.759, Senkrecht 705, Diagonal 169),
`Kapazität`, `Erlaubnis` (90 Ausprägungen, z. B.
`außer_für_Bewohner, ohne_Beschilderung, Parkuhr, Parkverbots…`),
`Erlaubnisz` (131, z. B. `Parkuhr:Mo, Di, Mi, Do, Fr, Sa 7-19,Parkverbot:…`),
`Bewirtscha` (8, z. B. `Sa 8-14 Mo, Di, Mi, Do, Fr 8-19`, nur 220 Segmente
belegt), `Zeitlimit` (`Parkuhr:120 min`, 9 Ausprägungen), `Zeitlimitz`.
**Kein Betrag, keine Zonenpolygone**, und die Stadt hat seit Oktober 2024 ein
gesamtstädtisches Konzept in Umsetzung (Bahnstadt/Bergheim zuerst) — die
Erhebung ist damit überholt. Für die Abfrage ungeeignet, als Kartengrundlage
für Meldungen brauchbar. Die Bewohnerparkzonen selbst gibt es nur als PDF-
Dokumentation je Stadtteil und im Geoportal `geoweb.heidelberg.de` (Osiris,
kein OGC-Endpunkt gefunden).

### 3. Klasse C

- **Saarbrücken** — `opendata.saarbruecken.de/dataset/parkzonen`
  (Ordnungsamt, 2026-08-27, Lizenz `datenliz-de`): `parkzonen_fl.geojson`
  hat 27 MultiPolygone mit **genau einem Attribut `ID = 0`** — die
  Zonenbuchstaben stehen nur in `parkzonen_txt_pos.geojson` (30 Punkte,
  `Text` = `A1`, `B2`, `I1`…, drei ohne Text) als CAD-Beschriftung
  (`Layer-Ezs`, `Text-Rot`, `Text-Hoehe`). Koordinaten `[lon, lat]`
  (`[7.0028, 49.2308]`). Zuordnung Fläche → Zone nur geometrisch (Punkt in
  Polygon). Tarif und Zeiten stehen in den Zonen-PDFs der Stadt
  (`saarbruecken.de/media/download-…` je Zone).
- **Kassel** — `Verkehr_Mobilitaet/MapServer/27` „Bewohnerparkbezirke",
  29 Polygone, einziges Feld `Name` (`BW1`…, `VW5`…), Query und Data-Export
  offen (`f=geojson&outSR=4326` liefert `[lon, lat]`). Layer 8 „Parken" sind
  12 Parkhäuser. **Keine Lizenzangabe** (`licenseInfo` leer), der geoHub der
  Stadt (`datenkatalog-kassel-geoportal.hub.arcgis.com`) antwortet von hier
  mit 403 — dort stünde die Lizenz. Parkgebührenzonen nur als PDF
  (`Parkgebuehrenzonen-A0 2026-02-04`, `Uebersichtskarte-Bewohnerparken-A3
  2026-03-17`); Tarif Zone II 1 €/h, 6 €/Tag lt. Stadtseite.
- **Wiesbaden (belegt, nicht abrufbar)** — Die Stadtseite bindet eine VC Map
  ein; deren Konfiguration (`wiesbaden.virtualcitymap.de/I_P/configs/867e….json`)
  nennt einen GeoJSON-Layer „Bewohnerparkgebiete" aus
  `geoportal.wiesbaden.de/cgi-bin/mapserv.fcgi?map=…/verkehr_wfs.map&SERVICE=WFS&TYPENAME=Bewohnerparkgebiete`
  und einen WMS `cgi-bin/verkehr.fcgi` (Layer `Bewohnerparken Nummern`). Der
  Host ist vom Egress-Proxy gesperrt. **Aus einer anderen Umgebung
  `GetCapabilities` abrufen** — mit Attributen (Nummer, Zeiten 9–22) wäre
  das B, ohne C. Lizenz unbekannt.

### 4. Klasse D — wo die Zonen stehen

| Stadt | Wo | Amt / Kontakt | Anzeichen für Datensatz |
| --- | --- | --- | --- |
| Augsburg | Geoportal-Layer „Bewohnerparkgebiete" (ArcGIS MapServer, nur Bild; Felder `NAM`, `BESCHRIEB`, `UEB_DAT` sichtbar, Query gesperrt) | Geodatenamt; Verkehrsplanung `verkehrsplanung.mtba@augsburg.de` | Daten liegen fertig im GIS, Lizenz verbietet Nutzung ohne schriftliche Erlaubnis — eine Anfrage könnte reichen |
| Mannheim | 17 Zonen-PDFs `BW 1.1_0.pdf` … `BW 5.0_0.pdf` (2026-02) | Fachbereich Sicherheit und Ordnung; Mannheimer Parkhausbetriebe (Besucherkarten) | Opendatasoft-Portal aktiv (DL-DE/BY-2.0), ArcGIS-Hub privat; keine Spur |
| Mainz | Mapbender-2-Viewer `gint.mainz.de` mit Layer `bewohnerpark` (öffentlicher Gast-Login) | Stadtplanungsamt | Viewer ist WMS-basiert, Kennung nicht ohne Session ermittelbar; kein Open-Data-Portal |
| Darmstadt | PDF `071825_PRBW_Übersicht.pdf` + Flyer je Zone | Mobilitätsamt / Digitales Rathaus | `opendata.darmstadt.de` (CKAN-artig via `data.json`) hat Verkehrszählungen, keine Zonen |
| Würzburg | Stadtseite (Zone I Bischofshut, Zellerau Z); Gebührenverordnung 2022 | Bürgerbüro `bewohnerparken@stadt.wuerzburg.de` | Opendatasoft-Portal aktiv, „Parkplatzdaten" = Parkhäuser (CC BY 4.0, 2026-09-16) |
| Regensburg | PDF `bewohnerparkbezirke-uebersicht-082025.pdf` (13 Zonen) | Stadtplanungsamt (Parkraumkonzept) | Geoportal 503; bydata ohne Regensburg |
| Ulm | Stadtseite, Zonen A–H mit Zeiten (A–C: Mo–Sa 9–22, 2 h; D–H: 9–20, 4 h) | Verkehrsplanung | `portal.ulm.de` Metadatenkatalog: nur Parkhäuser/P+R |
| Ingolstadt | Stadtseite, Geoportal (Inhalt per JS) | Amt für Verkehrsmanagement und Geoinformation, Tel. 0841 305-2333 | keine |
| Heilbronn | PDFs `Anlage_2_Plan_Bewohnerparkzonen_Innenstadt_Stand_02_2026.pdf`, `Anlage_3_…_Stadtteile.pdf`, `RVO_Bewohnerparken_05.05.2026.pdf`; `geoportal.heilbronn.de` (JS-App, kein Endpunkt gefunden) | Amt für Straßenwesen | Neuordnung 7/2026 „digital" angekündigt (echo24) — nachfragen |
| Pforzheim | Parkplan-PDF, ArcGIS-Experience-App | Bürgercenter | Hub `opendata-pforzheim.hub.arcgis.com` existiert, ohne DCAT |
| Reutlingen | Stadtseite je Gebiet, Geoportal „Mobilität und Verkehr" (Bewohnerparken abgebildet) | Amt für Stadtentwicklung und Vermessung | Open-Data-Seite im Geoportal (ALKIS, MobiData) — Nachfrage lohnt |
| Offenbach | PDF `Bewohnerparkbezirke_2023.pdf` | Ordnungsamt | keine |
| Fürth | PDFs Straßenverzeichnis, Außenbereiche | Straßenverkehrsamt | keine |
| Erlangen | PDFs `150_00_parkgebuehren_plan.pdf`, `lageplan_parkgebuehrenverordnung.pdf`; Online-Karte Behindertenparkplätze | Straßenverkehrsbehörde | `opendata.erlangen.de` existiert hinter Basic Auth (401) — im Aufbau? |
| Koblenz | Stadtseite (Zonen 7A–11), Geoportal nur Parkleitsystem | Ordnungsamt | keine |
| Trier | Geoportal-Layer `bewohnerparkzonen` (TMS-Kacheln), PDF `4657_bewohnerparkzonen_2025.pdf` | Amt Bürgerdienste; Geoinformation | Layer existiert als Vektor im Geoportal, nur nicht als Dienst |
| Kaiserslautern | PDF `parkzonen__gebuehren_ab_mai_2023.pdf` (Zonen 1–12 mit Tarif) | Referat Tiefbau | Geoportal 503 |
| Ludwigshafen | Stadtseite (Host gesperrt), Zonen seit 2017–2022 fortgeschrieben | `bewohnerparken@ludwigshafen.de`, Tel. 0621 504-3840 | nicht prüfbar |
| Konstanz | PDFs (`MerkblattBewohnerparkgebieteÜbersicht.pdf`, `Parkraumbewirtschaftung_Paradies.pdf`) | Team Offene Daten Konstanz (aktives Portal, CC0) | Portal hat Verkehr-Hub mit Parkhäusern; Zonen fehlen — Nachfrage lohnt, das Team ist erreichbar |
| Tübingen | PDF `461_parkraumbewirtschaftung_anlage.pdf` (Gebiete + Gebührenzonen 1–3), Stadtplan `#parkraumgebiete` | Fachabteilung Verkehrsplanung | keine |
| Bamberg | Stadtseite Parkraummanagement, Parklizenzierung | Stadtplanungsamt / Straßenverkehrsamt | keine |

### 5. Negativbefunde

- **Klasse E: keine.** Alle 26 Städte betreiben Bewohnerparken oder
  Parkraumbewirtschaftung mit Zonen — die Frage „gibt es Zonen" ist in dieser
  Größenklasse durchweg mit ja beantwortet; die Datenlage ist das Problem.
- **Landesportale liefern für diese Städte nichts.** `open.bydata.de` kennt
  bayernweit genau einen Bewohnerpark-Datensatz (Kempten). `mobidata-bw.de`
  kennt Karlsruhe und Freiburg. Hessen ist von hier nicht prüfbar, über
  govdata aber leer. RLP-Portal ohne API.
- **ArcGIS Online** als Querschnittssuche findet keine der 25 Städte mit
  einem offenen Feature Service zu Parkzonen; Cottbus und Chemnitz (nicht
  mein Los) tauchen dort auf.
- **Konstanz „Parkplätze"** (`services-eu1.arcgis.com/cgMeYTGtzFtnxdsx/…/Verkehr/FeatureServer/0`)
  hat `has_fee`, `fee_descr`, `max_stay`, `opening_h` — aber nur für
  Parkhäuser und Plätze, nicht für Straßenraum.
- **Mannheim ArcGIS Hub** (`mannheim-opendata.hub.arcgis.com`) ist als Site
  erreichbar, der Katalog aber privat („private org id … is not
  accessible"); die Suche dort liefert nur globale Fremdtreffer.

### 6. Zählung und Rangliste

| Klasse | Anzahl | Städte |
| --- | --- | --- |
| A | **1** | Freiburg |
| B | **1** (B−) | Heidelberg |
| C | **2** (+1 belegt) | Saarbrücken, Kassel; Wiesbaden nicht abrufbar |
| D | **21** | Augsburg, Mannheim, Mainz, Darmstadt, Würzburg, Regensburg, Ulm, Ingolstadt, Heilbronn, Pforzheim, Reutlingen, Offenbach, Fürth, Erlangen, Koblenz, Trier, Kaiserslautern, Ludwigshafen, Konstanz, Tübingen, Bamberg |
| E | 0 | — |

**Rangliste A/B (Einwohner × Datenqualität):**

1. **Freiburg** (0,23 Mio, A) — Zonen mit Betrag, Zeiten und Tagespauschale,
   538 Automaten mit Höchstparkdauer, 33 Bewohnerparkgebiete, DL-DE/BY-2.0,
   gepflegt (07/2026). Nach Frankfurt die sauberste Quelle der bisher 40
   geprüften Städte; die einzige Falle ist die Zone-1-Fläche mit
   „Beschilderung beachten!" statt einer Zeit. Anschlusskosten wie Frankfurt
   (Polygone + Punkte, `assertDegrees`, Zeiten-Parser mit 7 + 17
   Schreibweisen).
2. **Heidelberg** (0,16 Mio, B−) — nur als Meldestadt oder Kartengrundlage;
   für „kostet es hier gerade" fehlen Betrag und aktuelle Zonen.

Nachzuprüfen aus einer Umgebung ohne Proxy-Sperre: **Wiesbaden** (0,28 Mio,
WFS-Endpunkt bekannt, Attribute unbekannt) und **Kassel** (Lizenz im geoHub).
Anfragen, die sich lohnen: Augsburg (Daten fertig, Lizenz fehlt), Konstanz
und Reutlingen (aktive Open-Data-Teams), Heilbronn (Neuordnung 2026).



## Bericht: Norden und Osten

### 1. Kopf

Abrufe am **16. September 2026, 10:26–10:55 UTC** (12:26–12:55 MESZ), mit
`curl --cacert $(python3 -c 'import certifi; …')`, Browser-Kennung, 40 s
Zeitlimit. Befragt:

- **CKAN-APIs:** `ckan.govdata.de` (nationale Sammelstelle; spiegelt Freistaat
  Sachsen, Land Sachsen-Anhalt, Open Data Brandenburg, Land SH, OpenData HRO,
  Mobilithek, GDI-DE), `opendata.schleswig-holstein.de`, `www.opendata-hro.de`,
  `opendata.greifswald.de`, `opendata.gera.de` (leer, 0 Pakete)
- **Katalogdienste:** GDI-DE Geodatenkatalog `gdk.gdi-de.org` (CSW 2.0.2,
  AnyText-Suche nach Bewohnerpark/Parkzone/Parkscheinautomat/
  Parkraumbewirtschaftung/Anwohnerpark), Hannover GeoNetwork (CSW, 28
  Datensätze insgesamt), ArcGIS Hub `hub.arcgis.com/api/v3/datasets`
  (global), DCAT-Feeds von Chemnitz und Oldenburg (ArcGIS Hub),
  `opendata.braunschweig.de/catalog.json` (75 Datensätze),
  `opendata.luebeck.de` (~30 Datensätze, kein API)
- **Dienste direkt:** WFS/FeatureServer von Rostock, Schwerin, Cottbus,
  Chemnitz, Hildesheim, Gera (`GetCapabilities`, `resultType=hits`, Abruf
  mit und ohne `srsName`, Felder und Wertehäufigkeiten gezählt)
- **Stadtseiten** als Beleg, jede mit HTTP-Status abgerufen (Tabelle)

**Nicht erreichbar aus dieser Umgebung** (kein Befund, sondern Sperre):
`metaver.de` — **429 auf jede Anfrage**, auch CSW `GetCapabilities`, dreimal
über 20 Minuten verteilt, nginx-Kopf nennt als erlaubte Frame-Ancestors u. a.
`geodatenportal.sachsen-anhalt.de`; `daten.sachsen-anhalt.de`,
`opendata.thueringen.de`, `www.opendata-mv.de`, `ni-opendata.de`,
`gdi1.geo.bremen.de`, `geoportal.sachsen-anhalt.de` — `CONNECT tunnel failed,
502`; `opendata.niedersachsen.de` — TLS `handshake failure`;
`www.erfurt.de`, `www.braunschweig.de`, `www2.salzgitter.de` — `Connection
reset by peer` (curl) bzw. 503 (WebFetch); `opendataportal.cottbus.de` DCAT-Feed
— 403. `www.opendata.sachsen.de` und `datenadler.de` haben **keine CKAN-API
mehr** (404 bzw. SPA-Hülle); ihre Inhalte stehen in `ckan.govdata.de`, das war
der Ersatz. **Weimar und Halberstadt** nicht bearbeitet (govdata: 0 Treffer,
mehr Zeit nicht verdient).

Stufen wie im Auftrag: **geprüft** (Dienst abgerufen, Felder gesehen),
**belegt** (Datensatz nachgewiesen, nicht abgerufen), **Hinweis**.

### 2. Tabelle

Einwohner grob (Zensus/Fortschreibung, gerundet). „Beleg" = Stadtseite, alle
am 16.9.2026 mit HTTP 200 abgerufen, außer wo vermerkt.

| Stadt | Land | Einw. | Zonen? (Beleg) | Schnittstelle | Geom./Tarif/Zeiten/Höchstpd. | Lizenz | Aktualität | Stufe | Klasse |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| **Rostock** | MV | 0,21 Mio | ja — <https://rathaus.rostock.de/de/wirtschaft_verkehr/mobilitaet/verkehrsbehoerdliche_aufgaben/bewohnerparkgebiete/251517>, Parkgebührenordnung mit Zonenkarten unter <https://rathaus.rostock.de/de/service/aemter/amt_fuer_stadtentwicklung_stadtplanung_und_mobilitaet/mobilitaet/parken/271943> | WFS 2.0 `geo.sv.rostock.de/geodienste/parkscheinautomaten/wfs` (111) und `…/bewohnerparkgebiete/wfs` (10); GeoJSON/CSV/GML-Download `geo.sv.rostock.de/download/opendata/<name>/<name>.json`; CKAN `opendata-hro.de` | Polygone (Bewohnerparkgebiete) + Punkte (Automaten) / **ja, numerisch** / **ja** / **ja** | **CC0 1.0** (`cc-zero`, `is_free_to_use: true`) | Automaten aktualisiert 2026-07-02, Gebiete 2026-05-27 | geprüft | **A** |
| **Schwerin** | MV | 0,10 Mio | ja — <https://www.schwerin.de/mein-schwerin/leben/ordnung-sicherheit-verkehr/verkehr-mobilitaet/mit-dem-kfz/parken/> (Parkzone 1: 2,50 €/h, Parkzone 2: 1,50 €/h seit 1.7.2024; Bewohnerparkzonen) | WFS 2.0 (MapServer) `geoportal.kreis-lup.de/ows/masterportal/parken-sn`, Typen `masterportal:Parkzonen` (15), `masterportal:Parkscheinautomaten` (143); WMS gleicher Pfad; GDK-Eintrag „Parken in der Landeshauptstadt Schwerin (WFS)" | Polygone **ohne Attribute** + Punkte / ja (Text) / ja (Text) / ja (Text) | DL-DE/**BY**-2.0, „Quellenvermerk: Landeshauptstadt Schwerin" (aus `AccessConstraints`) | GDK modified 2026-09-03/07; Beträge stimmen mit Verordnung 7/2024 | geprüft | **A mit Einschränkung** (Polygone ohne Attribute, nur EPSG:25833) |
| **Cottbus** | BB | 0,10 Mio | ja — <https://cottbus.de/allgemein/kostenfreies-kurzzeitparken-und-neue-parkgebuehren-in-kraft/> (Tarifzone 1: 2,00 €/h, Tarifzone 2: 1,00 €/h seit 1.6.2025); Bewohnerparkzonen II–VI | ArcGIS FeatureServer `datenportal.cottbus.de/server/rest/services/FB32/Bewohnerparkzonen/FeatureServer/7` (5) und `…/FB32/Parkscheinautomaten/FeatureServer/1` (44); Hub `opendataportal.cottbus.de`; GDK-Eintrag „Bewohnerparkzonen II bis V in der Stadt Cottbus" | Polygone (Bewohnerparkzonen) + Punkte / ja, **veraltet** / ja / nein | DL-DE/**BY**-2.0 (Hub-Items beider Datensätze) | Hub-Item 2025-11-14; **Betrag ist der Stand vor dem 1.6.2025** | geprüft | **A mit Einschränkung** — Preisfeld falsch (Köln-Fall) |
| **Chemnitz** | SN | 0,25 Mio | ja — <https://www.chemnitz.de/de/unsere-stadt/verkehr/auto-krad-lkw/parken/parkraumkonzept> (Gebührenzone I Mo–Fr 8–20, Sa 8–14; Zone II Mo–Fr 8–18, Sa 8–12; Bewohnerparken A–H) | Open-Data-Hub `portal-chemnitz.opendata.arcgis.com`: nur **Parkscheinautomaten** (567 Punkte, `services6.arcgis.com/jiszdsDupTUO3fSM/…/Parkscheinautomaten_FL_1/FeatureServer/0`). Zonen nur im **internen** Themenstadtplan-Dienst `www-11.stadt-chemnitz.de/wss/service/ags-relay/prod-ags/guest/arcgis/rest/services/Themenbaum/Parken/MapServer` (Layer 2 Parkraumbewirtschaftung: 2 Polygone, Layer 3 Bewohnerparkzonen: 8) | Polygone + Punkte / nein / nein / nein | Automaten: DL-DE/BY-2.0; **Zonen: „(C) Stadt Chemnitz – nur mit vorheriger schriftlicher Zustimmung"** (MetaDoku) | Automaten-Daten 2024-11-04; Zonen 2021-06-16 (`AKTDATUM`), Metadaten 2022-12-12 | geprüft | **C** (Zonen nicht offen lizenziert) |
| **Hildesheim** | NI | 0,10 Mio | ja — <https://www.stadt-hildesheim.de/portal/seiten/parken-karte-im-geoportal-900004318-33610.html>, Zonen A–G, Infoblatt-PDF | WFS 1.1 (MapServer) `gdi.stadt-hildesheim.de/interface/wfs-ms/Bewohnerparkzonen`, Typ `Bewohnerparkzonen` (7); WMS `…/interface/wms/Bewohnerparkzonen` | Polygone / nein / nein / nein | DL-DE/BY-2.0 laut Nutzungsbedingungen des Geoportals, Vermerk „Geodaten © Stadt Hildesheim" | keine Datumsangabe im Dienst | geprüft | **C** |
| **Gera** | TH | 0,09 Mio | ja — <https://www.gera.de/leben-in-gera/mobilitaet-verkehr-rad/parkplaetze>, Bewohnerparkausweis im Serviceportal; Karte <https://geoportal.gera.de/map/gera-map-parken.html> | GeoServer WFS 2.0 `geoportal.gera.de/geoserver/gera/wfs`, Typ `gera:geom_portal_anwohnerparken` (148 Linien, Zonen A–L) | **Linien** je Straßenabschnitt / nein / nein / nein | **nicht angegeben** (`Fees: NONE`, `AccessConstraints: NONE`, kein Katalogeintrag) | keine Angabe | geprüft | **C** |
| **Bremen** | HB | 0,57 Mio | ja — <https://www.asv.bremen.de/verkehrsthemen/bewohnerparken/parkgebiete-9260> (Zonen A–O, 21C–E, **mit Zeiten im Text**, z. B. „Zone D (Mo.–Fr. 8:00–22:00, Sa/So 0–24 Uhr)") | keine: govdata `Bremen park` = 5 Klimakarten; GDK „Bewohnerpark" → für Bremen nur der VMZ-Eintrag „LKW-Führungshöhen"; `geo.bremen.de` Open-Data-Produktübersicht ohne Parkprodukt; MetaVer 429, `gdi1.geo.bremen.de` 502 | — | — | — | geprüft (Portale), Hinweis (MetaVer offen) | **D** |
| **Hannover** | NI | 0,55 Mio | ja — <https://www.hannover.de/Service/Mobil-in-Hannover/Parken/Bewohner*innenparken>, Bezirke A–E, K als PDF <https://www.hannover.de/content/download/639293/file/Bewohnerparkbezirke-aktualisiert.pdf>; neue Zonen ab Mai 2026 | keine: GeoNetwork `e-government.hannover-stadt.de` führt **28** Datensätze (Orthophotos, Stadtkarten, DGM, Wahlen, Straßenverzeichnis), keiner zum Parken; govdata `Hannover park` = 2 Lkw-Parkplätze (Bosch) | — | — | — | geprüft | **D** |
| **Braunschweig** | NI | 0,25 Mio | ja — <https://www.braunschweig.de/parkraummanagement> (Zonen A–C, 330B, 331 …; **Seite aus dieser Umgebung nicht abrufbar**, Beleg über Suchtreffer und `service.braunschweig.de`) | keine: `opendata.braunschweig.de/catalog.json` 75 Datensätze, Parkbezug nur „E-Tretroller Parkverbotszonen"; Hub „Stadt Braunschweig" nur Radzähler/Grundwasser | — | — | — | belegt | **D** |
| **Magdeburg** | ST | 0,24 Mio | ja — <https://www.magdeburg.de/bewohnerparkausweis> („gilt nur für eine speziell ausgewiesene Zone", 30,70 €) | keine: govdata/GDK 0 Treffer; Open-Data-Seite der Stadt ohne Parkdatensatz; `daten.sachsen-anhalt.de` 502 | — | — | — | geprüft (govdata), Hinweis (Landesportal) | **D** |
| **Halle (Saale)** | ST | 0,24 Mio | ja — <https://halle.de/leben-in-halle/tiefbau-und-verkehr/bewohnerparkzonen>, Übersichtskarte als PDF `Bewohnerparken_Ist_2025.pdf` (3,9 MB) | keine: `daten.halle.de` ohne API; `geodienste.halle.de/halgis` ohne WFS-Endpunkt; govdata 0 | — | — | — | geprüft | **D** |
| **Erfurt** | TH | 0,21 Mio | ja — Bewohnerparkgebiete 1–5, <https://www.erfurt.de/ef/de/leben/verkehr/mobil/auto/bewohnerparken/index.html> (**Host aus dieser Umgebung nicht erreichbar**, Beleg über Suchtreffer) | keine für Zonen: Geoportal-Open-Data `geoportal.erfurt.de/gis/pub/download/thematik/parken.zip` (DL-DE/BY-2.0, Stand 5.2.2024) = 251 Punkte (Parkhäuser, P+R, Behinderte …) mit nur `LAYER`/`THEMA` | Punkte, andere Sache | — | — | geprüft | **D** |
| **Lübeck** | SH | 0,22 Mio | ja — <https://www.luebeck.de/de/rathaus/verwaltung/ordnungsamt/parkregeln-in-luebeck>; Parktarifzonen I–IV als PDF <https://www.luebeck.de/file/anlage_parkzonen_luebeck_travemuende.pdf>; Bewohnerparkbezirke als Bekanntmachung | keine: `opendata.schleswig-holstein.de` 389 Lübeck-Datensätze, keiner zu Parken; `opendata.luebeck.de` (Statistik, Baumkataster, Baustellen) | — | — | — | geprüft | **D** |
| **Jena** | TH | 0,11 Mio | ja — <https://mobilitaet.jena.de/de/bewohnerparken> („zur Zeit 7 Bewohnerparkzonen", Karte im Kartenportal), Straßenliste als PDF | keine für Zonen: „Parkdaten Jena" (Mobilithek, Kommunalservice Jena) = Parkhäuser/Parkplätze statisch+dynamisch; `wissensallmende.jena.de` SPA ohne API; `kartenportal.jena.de` ohne erkennbaren WFS | — | — | — | geprüft | **D** |
| **Flensburg** | SH | 0,09 Mio | ja — <https://www.flensburg.de/verkehr-mobilitaet/mit-dem-auto/bewohnerparken-und-parkausweise/index.php> (Gebiete mit Buchstaben, z. B. „D" Duburg); Parkraumkonzept in Arbeit | keine: SH-Portal 860 Flensburg-Datensätze, keiner zu Parken; `geoportal.flensburg.de` ohne Parkthema | — | — | — | geprüft | **D** |
| **Oldenburg** | NI | 0,17 Mio | ja — <https://www.oldenburg.de/startseite/stadtraum/verkehr-mobilitaet/parken.html> („900 gebührenpflichtige Parkplätze und 152 Parkscheinautomaten"); Bewohnerparken mit neuer Zone Haarenesch 2026 (Presse) | keine: Hub „openGEOdata – Stadt Oldenburg" 18 Datensätze ohne Parken; GDK „Oldenburg" 2 663 Treffer, nur Bebauungspläne | — | — | — | geprüft | **D** |
| **Osnabrück** | NI | 0,17 Mio | ja — <https://mobil.osnabrueck.de/de/individuell-unterwegs/parken-be-und-entladen/parken-mit-dem-auto/> („sogenannte Bewohnerparkzonen", Parkscheibe Mo–Sa 8–20) | keine: govdata nur „Belegtstatus Behindertenparkplätze" (SWO Netz); `opendata.osnabrueck.de` nicht erreichbar | — | — | — | geprüft | **D** |
| **Göttingen** | NI | 0,12 Mio | ja — <https://www.goettingen.de/portal/seiten/parkraummanagement-900000895-25480.html> (Parkzone I 2,40 €/h, II 1,20 €/h; Ostviertel seit 7/2025) | keine: `opendata.goettingen.de` 403; govdata 0 | — | — | — | geprüft | **D** |
| **Wolfsburg** | NI | 0,13 Mio | ja — <https://www.wolfsburg.de/mobilitaetverkehr/parken> (Bewohnerzonen A–H plus Fallersleben, Vorsfelde) | keine: `opendata.wolfsburg.de` nicht erreichbar; govdata/GDK 0 | — | — | — | belegt | **D** |
| **Bremerhaven** | HB | 0,11 Mio | schwach — <https://www.bremerhaven.de/de/leben-arbeiten-gesundheit/mobilitaet/parkplaetze.25896.html> nennt nur Parkhäuser/STÄPARK; „Anwohner- und Besucherparkausweis" nur im Bundesportal-Leistungsverzeichnis | keine: GDK 233 Bremerhaven-Treffer ohne Parken; Bremer Landesportale gesperrt (s. o.) | — | — | — | Hinweis | **D** |
| **Zwickau** | SN | 0,09 Mio | ja — <https://www.zwickau.de/de/politik/verwaltung/aemter/dezernat1/ordnungsamt/sg_od/dienstleistungen/32_30_004.php> (Parkraumbewirtschaftung, Tarifzonen I–III) | keine: govdata `Zwickau parken` = Chemnitzer Automaten; `opendata.zwickau.de` nicht erreichbar | — | — | — | geprüft | **D** |
| **Lüneburg** | NI | 0,08 Mio | ja — <https://www.hansestadt-lueneburg.de/bauen-und-mobilitaet/mobilitaet/autoverkehr/parken.html> („insgesamt acht Bewohnerparkbereiche", Parkgebietssuche im Serviceportal) | keine: govdata/GDK 0 | — | — | — | geprüft | **D** |
| **Salzgitter** | NI | 0,10 Mio | teils — <https://www.salzgitter.de/rathaus/fachdienste/tiefbau/parken.php> (**nicht abrufbar**), laut Suchtreffer markierte Bewohnerparkplätze in Lebenstedt und Bad | keine: govdata/GDK 0 | — | — | — | Hinweis | **D** (eher E für Gebührenzonen) |
| **Greifswald** | MV | 0,06 Mio | ja — <https://www.greifswald.de/de/mein-greifswald/mobil-in-greifswald/parken/> („derzeit 12 Bewohnerparkbereiche"), je Bereich ein PDF des Stadtbauamts (Amt 60), Übersichtsplan 2021-07 (1,6 MB); Tarife bei `parken-greifswald.de` | keine für Zonen: CKAN `opendata.greifswald.de` 37 Pakete ohne Parken; GDK „Parkplätze der Universitäts- und Hansestadt Greifswald" = Parkplätze mit Gebühren, keine Zonen | — | — | — | geprüft | **D** |

### 3. Städte der Klasse A

#### Rostock — geprüft, geeignet

Zwei Datensätze, beide **CC0**, beide über WFS 2.0 (deegree-ähnlich, Fees
`none`) und als fertige Downloads (GeoJSON, CSV, GML, KML, XLSX) unter
`https://geo.sv.rostock.de/download/opendata/<name>/<name>.json`. Kontakt
`geodienste@rostock.de`, Autor „Hanse- und Universitätsstadt Rostock".

**Parkscheinautomaten** (`hro.parkscheinautomaten.parkscheinautomaten`,
`numberMatched="111"`, aktualisiert 2026-07-02). 24 Felder, die wichtigen
sind **typisiert statt Freitext**:

- `zone`: `B` 47, `W` 27, `C` 23, `A` 9, `D` 4, `X` 1; `tarif`: 18 Werte
  (`B1` 40, `C1` 19, `W2` 17, …, `Bus` 3, `Kunsthalle` 1);
  `handyparkzone`: 31 Nummern
- `bewirtschaftungszeiten`: **5 Schreibweisen** — `08:00-19:00` (83),
  `08:00-18:00` (22), `Mo-Fr 08:00-18:00` (4), `08:00-20:00` (1),
  `Mo-Fr,So 08:00-19:00; Sa 15:00-19:00` (1)
- `normaltarif_gebuehren_pro_stunde`: **Zahl** — `1.5` 46, `3.0` 26,
  `1.0` 21, `2.0` 8, `0.5` 4, `5.0` 3, `0.6` 1, `null` 2;
  `normaltarif_gebuehrenschritte`: `4 min = 0,10 €` (46), `2 min = 0,10 €`
  (26), … 7 Schreibweisen; `normaltarif_gebuehren_max`: 80× `null`, sonst
  `5.0` 19, `8.0` 5, `15.0` 3 …
- `normaltarif_parkdauer_max` + `_einheit`: `2 h` 62, `24 h` 28, `1 h` 7,
  `6 h` 7, `4 h` 3, `3 h` 2, `30 min` 2, `1 d` 1 — **Einheit ist ein
  eigenes Feld** (`h` 108, `min` 2, `d` 1), nicht im Text
- dazu ein vollständiger Satz `veranstaltungstarif_*` (84 Automaten haben
  einen: `2.0`/`1.0`/`5.0` je Stunde), `zugelassene_muenzen`,
  `stellplaetze_pkw`, `bewohnerparkgebiet` (48 gesetzt: `A1` 9, `W1` 10,
  `A4` 7, `B2` 5, `H1` 5 …)

**Bewohnerparkgebiete** (`hro.bewohnerparkgebiete.bewohnerparkgebiete`,
`numberMatched="10"`, aktualisiert 2026-05-27): Polygone mit `uuid`,
`bezeichnung` (`A3 – Östliche Altstadt`, `H1 – Thünenviertel/Hansaviertel`
…) und `adressen` (Straßenliste mit Hausnummernspannen, `;`-getrennt).
**Keine Zeiten, kein Betrag** — die hängen an den Automaten.

Fallen, gemessen:

- **Tarifzonen A–D/W haben keine Polygone.** Wie in Frankfurt hängen Tarif,
  Zeiten und Höchstparkdauer an Punkten; die Bewohnerparkgebiete sind
  andere Flächen (10 Gebiete, 48 Automaten ordnen sich ihnen zu, 63 nicht).
  Die Zonenkarten gibt es nur als PDF-Anlagen der Parkgebührenordnung.
- **`08:00-19:00` ohne Wochentage** ist die häufigste Zeitangabe (83 von
  111). Ob das Mo–So oder Mo–Sa heißt, steht nicht im Feld; das ist gegen die
  Parkgebührenordnung zu klären, bevor ein Parser es „täglich" liest.
- **Achsenreihenfolge:** WFS antwortet auf `srsName=urn:ogc:def:crs:EPSG::4326`
  mit **`[lat, lon]`** (`<gml:pos>54.087699 12.145634`), ohne `srsName` in
  **EPSG:25833** (Voreinstellung). Der GeoJSON-Download ist `[lon, lat]`
  ohne `crs`-Element. `outputFormat=application/json` am WFS wird mit
  `InvalidParameterValue` abgelehnt — also Download nehmen oder GML parsen.
- Zwei Automaten ohne Betrag (`null`) sind Sonderfälle (`Bus`, `Kunsthalle`);
  `Fee.unknown` ist da schon die richtige Antwort.

#### Schwerin — geprüft, geeignet mit Einschränkung

Ein Dienst, gehostet **nicht von der Stadt, sondern vom Landkreis
Ludwigslust-Parchim** (`geoportal.kreis-lup.de/ows/masterportal/parken-sn`,
MapServer; Titel „Parken in der Landeshauptstadt Schwerin",
`AccessConstraints`: „Datenlizenz Deutschland – Namensnennung – 2.0.
Quellenvermerk: Landeshauptstadt Schwerin"). GDK führt ihn mit
`modified` 2026-09-03 (Datensatz) / 2026-09-07 (WMS).

- `masterportal:Parkscheinautomaten` — `numberMatched="143"`, Punkte,
  Felder `Bezeichnung`, `Standort`, `Bewirtschaftungszeit`,
  `Hoechstparkdauer`, `Gebuehr`, `Tagesticket`, `Kurzparkticket`,
  `Bemerkung`. Werte: `Gebuehr` **3 Schreibweisen** — `2.50 Euro je Std.`
  (134), `1.50 Euro je Std.` (7), leer (2); `Bewirtschaftungszeit`
  **5 Schreibweisen** — `Mo - Sa 8-20 h` (125), `Mo - Fr 8-18 h` (7),
  `Mo - So 8-21 h` (5), `Mo - So 0-24 h` (4), `Mo - So 8-18 h` (2);
  `Hoechstparkdauer` — `ohne` (104), `2 h` (25), `4 h` (13), leer (1).
  Die Beträge decken sich mit der Parkgebührenverordnung vom 1.7.2024
  (Parkzone 1: 2,50 €, Parkzone 2: 1,50 €) — **aktuell**.
- `masterportal:Parkzonen` — `numberMatched="15"`, 16 Polygone/1
  MultiSurface, **ohne ein einziges Attribut** (nur `msGeometry`). Welche
  Zone welche ist, steht nirgends im Feature; die Zuordnung zu Beträgen
  liefe über einen räumlichen Join mit den Automaten (wie Karlsruhe).
- WMS nennt zusätzlich Bewohnerparkzonen, `Parkplaetze_SN` wirft im WFS
  einen MapServer-Fehler, `P_and_R` ist leer (0).

Fallen: **Nur EPSG:25833.** `srsName=urn:ogc:def:crs:EPSG::4326`,
`EPSG:4326`, `EPSG:4258` und `CRS:84` enden alle in `Invalid SRS`; die
Capabilities nennen keinen `OtherCRS`. Umrechnung muss im Datenbau passieren
(proj-Definition für UTM 33N). Kein GeoJSON (`'geojson' is not a permitted
output format`), nur GML 3.2 mit `posList` in Easting/Northing.

#### Cottbus — geprüft, geeignet mit Einschränkung (Preisfeld veraltet)

ArcGIS Enterprise der Stadt, `datenportal.cottbus.de/server/rest/services/FB32`
(FB 32 = Fachbereich Ordnung und Sicherheit), Hub-Items mit
„Datenlizenz Deutschland – Namensnennung – Version 2.0". `outSR=4326` und
`f=geojson` funktionieren am **FeatureServer** (der MapServer daneben lehnt
`query` ab: „Requested operation is not supported").

- `Bewohnerparkzonen/FeatureServer/7` — 5 Polygone `Parkzone II`…`VI`
  (`bem`: `Z2`…`Z6`), dazu `tel`, `mail`
  (`strassenverkehrsbehoerde@cottbus.de`), `url` (Stadtbüro-Vorgang 3490),
  `ansprechpa`; `geaendert_am` überall `null`. Eine Zone I gibt es im
  Datensatz nicht (Titel im GDK: „II bis V").
- `Parkscheinautomaten/FeatureServer/1` — 44 Punkte, **Zeiten strukturiert**
  in sechs Feldern (`wt` = `Mo - Fr`, `wt_bew_beginn` = `08:00`,
  `wt_bew_ende` = `19:00`, `woende` = `Sa`, `09:00`–`15:00`; alle 44 gleich),
  `zone` = `Zone 1` (40) / `Zone 2` (4), `gebuehr` = `1` (40) / `0.5` (4),
  `mind_gebuehr` = `0.2` / `0.1` (Fließkomma-Rauschen `0.200000003`), dazu
  Stellplatzzahlen. **Keine Höchstparkdauer** (laut Stadt 3 h).
- **Der Betrag ist der alte.** Die Stadt schreibt zum 1.6.2025: Tarifzone 1
  „von 1,00 EUR pro Stunde auf 2,00 EUR", Tarifzone 2 „von 0,50 EUR auf
  1,00 EUR". Der Datensatz nennt exakt die abgelösten Werte; das Hub-Item
  wurde am 14.11.2025 angefasst, `editingInfo` ist leer. Derselbe Fall wie
  Köln: Feed sieht richtig aus und nennt die Hälfte.
- Tarifzonen 1/2 haben **keine Polygone** — nur die Bewohnerparkzonen.

### 4. Städte der Klasse C und D

**Chemnitz (C).** Zonen existieren als Geodaten, sind aber weder im
Open-Data-Hub noch offen lizenziert: Layer 2 `Parkraumbewirtschaftung` (2
Polygone, `ZONENBEZ` `Zone I`/`Zone II`, `SATZUNG` „Parkgebührenordnung",
`AKTDATUM` 2021-06-16) und Layer 3 `Bewohnerparkzonen` (8 Polygone, `A -
Innenstadt` … `H - Kassberg`) liegen im Themenstadtplan-Relay
(`www-11.stadt-chemnitz.de/wss/service/ags-relay/prod-ags/…/Themenbaum/Parken/MapServer`,
`f=geojson` dort gesperrt, `f=json` geht). Die GIS-Doku der Stadt nennt als
Lizenz „(C) Stadt Chemnitz – … nur mit vorheriger schriftlicher Zustimmung",
Herausgeber Amt 66 (`tiefbauamt@stadt-chemnitz.de`), technisch Amt 18
(`gdi@stadt-chemnitz.de`). Offen (DL-DE/BY-2.0) sind nur die
**Parkscheinautomaten** im Hub: 567 Punkte, davon `TYPE` `Parkscheinautomat`
480 und `Parkscheinautomat geplant` 87, Felder nur `NAME`, `TYPE`,
`ORIENTATION`; Daten-Stand 2024-11-04. Zeiten und Beträge stehen auf der
Stadtseite (zwei Zonen) — der Weg wäre eine Anfrage an Amt 66 nach
Freigabe der Zonen; Anzeichen für einen kommenden Datensatz: keine.

**Hildesheim (C).** 7 Polygone `Zone A`…`Zone G` über MapServer-WFS 1.1
(`DefaultSRS` 25832, `OtherSRS` 4326; mit `SRSNAME=urn:…:4326` kommt
`srsName="EPSG:4326"` und **`[lat, lon]`**). Felder nur `ID`, `Zone`, und
ein durchgereichter Windows-Pfad `I:/GDI-HI/WebGIS/…/Besucherparkzonen/Zone
D_A.shp` (die Quelle nennt sie Besucherparkzonen). Lizenz aus den
Nutzungsbedingungen des Geoportals: DL-DE/BY-2.0, Vermerk „Geodaten © Stadt
Hildesheim". Zeiten/Beträge nur im Infoblatt-PDF (Nov. 2024).

**Gera (C).** `gera:geom_portal_anwohnerparken` liefert 148 **LineStrings**
(Straßenabschnitte) mit `anwohnerparkzone` `A`…`L` (10 Werte, einmal `C/G`)
und `infostring` (`L - Calvinstraße`), keine Flächen, keine Zeiten, keine
Lizenzangabe. `geom_portal_parken_alles` sind 26 Parkhäuser/-plätze.

**Klasse D — wo die Zonen stehen:**

| Stadt | Form | Stelle | Anzeichen für Datensatz |
| --- | --- | --- | --- |
| Bremen | Textliste je Zone mit Zeiten und Straßen (14 Zonen + 3) | Amt für Straßen und Verkehr (ASV) | keine; Landesamt GeoInformation gibt seit 6/2024 Geobasisdaten frei, Produktübersicht ohne Parken. MetaVer bleibt offen |
| Hannover | PDF „Bewohnerparkbezirke-aktualisiert" (86 KB), Bezirke A–E, K; FAQ-PDF 1/2026 | LHH, Fachbereich Tiefbau (OE 66) | Umbau ab Mai 2026 („Neue Bewohner*innen-Parkzonen"); Open GeoData bleibt Kartographie |
| Braunschweig | Stadtseite Parkraummanagement, Zonen A–C u. a. | Stadt, FB 32 | keine (75 OD-Datensätze) |
| Magdeburg | Dienstleistungsseite, PDF-Antrag | Bürgerservice | keine |
| Halle | PDF-Übersichtskarte `Bewohnerparken_Ist_2025.pdf`, je Quartier Anlagen | FB Tiefbau/Verkehrsplanung, `verkehrsplanung@halle.de` | keine; Portal `daten.halle.de` ohne API |
| Erfurt | fünf Gebietsseiten + Flyer-PDF | Stadtverwaltung | Geoportal liefert Open Data nur für Parkplätze (Punkte) |
| Lübeck | PDF „Parktarifzonen" (1,9 MB), Bekanntmachung Bewohnerparkbezirke | Ordnungsamt / Straßenverkehrsbehörde | keine |
| Jena | Straßenlisten-PDF (2019), Karte im Kartenportal (JS, kein WFS gefunden) | Team Bürgerservice | Mobilithek-Feed nur Parkhäuser |
| Flensburg | Stadtseite; Parkraumkonzept „inklusive Gebietsabgrenzungen" angekündigt | Stadt Flensburg | **ja, vage**: Parkraumkonzept soll Abgrenzungen liefern |
| Oldenburg | Stadtseite, Straßenverzeichnis-PDF | Amt für Verkehr und Straßenbau | keine |
| Osnabrück | Stadtseite `mobil.osnabrueck.de`, Serviceportal | Stadt | keine (nur Behindertenparkplatz-Belegung) |
| Göttingen | Stadtseite (Parkzone I/II, Beträge), Meldungen | Straßenverkehrsabteilung | keine |
| Wolfsburg | Stadtseite, Zonen A–H | Stadt | keine |
| Bremerhaven | nur Parkhäuser (STÄPARK); Anwohnerparkausweis über Bundesportal | STÄPARK / Stadt | keine |
| Zwickau | Stadtseite Parkraumbewirtschaftung, Tarifzonen I–III | Ordnungsamt | keine |
| Lüneburg | Stadtseite, „Parkgebietssuche" im Serviceportal (Adressabfrage, keine Karte) | Hansestadt | keine |
| Salzgitter | Stadtseite (nicht abrufbar) | FD Tiefbau | keine |
| Greifswald | 12 Bereichs-PDFs + Übersichtsplan 2021-07 | Stadtbauamt (Amt 60) | keine (CKAN 37 Pakete) |

### 5. Negativbefunde kurz

- **Länderportale:** Sachsen-Anhalt, Thüringen, MV, Niedersachsen und Bremen
  waren aus dieser Umgebung gesperrt (502/TLS); ihre Inhalte stehen aber in
  `ckan.govdata.de`, und dort gibt es zu allen 24 Städten **keinen** Zonen-
  oder Automatendatensatz außer Chemnitz (Automaten) und Rostock. Das
  SH-Portal (erreichbar, gut gepflegt) kennt Parkzonen nur für Kiel,
  Norderstedt und Elmshorn.
- **GDI-DE-Katalog** ist der brauchbarste Ersatz für MetaVer: 49 Treffer zu
  „Bewohnerpark", davon aus meinem Gebiet nur Cottbus, Schwerin, Chemnitz
  (nicht offen) und Greifswald (Parkplätze). Der GDK-CSW bricht gelegentlich
  mit `Connection reset` ab; `--http1.1` und Wiederholung helfen.
- **ArcGIS Hub global** (`hub.arcgis.com/api/v3/datasets?q=…`) findet
  Bewohnerparken-Datensätze bundesweit in einem Aufruf (Karlsruhe, Kempten,
  Goslar, Cottbus, Chemnitz) — schneller als jede Portalsuche, aber ohne
  Stadtfilter.
- Schwerins Landkreis-Masterportal sperrt die Wurzel `…/ows/gdimrh` (403),
  der Dienstpfad selbst ist offen.

### 6. Zählung und Rangliste

| Klasse | Anzahl | Städte |
| --- | --- | --- |
| A | **3** | Rostock; Schwerin und Cottbus je „mit Einschränkung" |
| B | 0 | — |
| C | **3** | Chemnitz, Hildesheim, Gera |
| D | **18** | Bremen, Hannover, Braunschweig, Magdeburg, Halle, Erfurt, Lübeck, Jena, Flensburg, Oldenburg, Osnabrück, Göttingen, Wolfsburg, Bremerhaven, Zwickau, Lüneburg, Salzgitter, Greifswald |
| E | 0 | — |

**Rangliste A/B nach Einwohnern × Datenqualität:**

1. **Rostock** (0,21 Mio) — CC0, Betrag als Zahl, Zeiten in 5 Schreibweisen,
   Höchstparkdauer mit Einheitenfeld, aktualisiert Juli 2026, WFS und
   GeoJSON. Beste Datenqualität dieser Runde und nach Frankfurt die
   zweite Stadt, in der Tarif, Zeiten und Höchstparkdauer maschinenlesbar
   und aktuell sind. Kosten: Zonenflächen der Tarifzonen fehlen (nur
   Bewohnerparkgebiete), Wochentage in 83 Zeitangaben implizit.
2. **Schwerin** (0,10 Mio) — DL-DE/BY, Betrag/Zeiten/Höchstparkdauer als
   Text mit 3/5/4 Schreibweisen, aktuell (Verordnung 7/2024 bestätigt),
   15 Polygone ohne Attribute, Dienst nur in EPSG:25833 beim Landkreis.
3. **Cottbus** (0,10 Mio) — DL-DE/BY, Zeiten sauber strukturiert, aber
   Betrag zwei Erhöhungen alt, keine Höchstparkdauer, Zone I fehlt. Erst nach
   Rückfrage bei FB 32 (`strassenverkehrsbehoerde@cottbus.de`).

Die beiden großen Städte des Gebiets — Bremen und Hannover — haben mit
0,57 und 0,55 Mio Einwohnern die Zonen, die Zeiten und die Listen, aber
nichts davon als Geodaten; das ist derselbe Befund wie am 7. September, nur
diesmal mit GDK, Hannovers eigenem GeoNetwork (28 Datensätze, gezählt) und
Bremens Produktübersicht als Beleg statt als Vermutung. MetaVer bleibt der
einzige ungeprüfte Ort.



## Bericht: Österreich und Schweiz

### Zeitpunkt und Weg der Abrufe

Alle Abrufe am **16. September 2026 zwischen 10:26 und 10:47 UTC** (12:26–12:47 MESZ).
Werkzeug: `curl --cacert $(python3 -c 'import certifi; print(certifi.where())')`,
Rohdaten liegen unter `scratchpad/staedte/dach/`. Wo curl am Egress-Proxy scheiterte,
wurde derselbe Aufruf über den WebFetch-Weg wiederholt (anderer Ausgang); das ist je
Stadt vermerkt, weil dort nur eine Zusammenfassung ankam und keine Rohdatei.

Befragte Portale und APIs:

| Portal | Weg | Ergebnis |
| --- | --- | --- |
| `data.gv.at` (CKAN `…/katalog/api/3/action/package_search`) | curl | **404 auf jeder Variante**, auch die Startseite liefert nur eine 5.122-Byte-Sperrseite des Proxys; `ckan.data.gv.at` → `CONNECT tunnel failed, 502`. Das Portal ist seit 2025 piveau, nicht mehr CKAN. |
| `data.gv.at` piveau-API `…/api/hub/search/search?q=…&filter=dataset` | WebFetch | **geht** (JSON); `…/api/hub/search/datasets?q=` → 400 |
| `ckan.opendata.swiss` und `opendata.swiss` | curl + WebFetch | **403 Forbidden** (nginx) auf beiden Wegen |
| `data.wien.gv.at/daten/geo` (GeoServer WFS 2.0) | curl | geprüft |
| `data.stadt-zuerich.ch` (CKAN), `www.ogd.stadt-zuerich.ch/wfs` (QGIS Server) | curl | geprüft |
| `data.bs.ch`, `daten.stadt.sg.ch` (Opendatasoft Explore v2.1) | curl | geprüft |
| `wfs.geo.bs.ch`, `wms.geo.bs.ch` | curl | geprüft; `data.geo.bs.ch` → 502 |
| `data.stadt-salzburg.at/geodaten/wfs` | curl → `connect_rejected`; **WebFetch geht** | geprüft, nur über WebFetch |
| `data.linz.gv.at` | curl: Sperrseite; WebFetch: 302 auf `data.gv.at/auftritte/stadt-linz` (leer) | Dateien nicht abrufbar |
| `data.graz.gv.at` (WordPress, kein CKAN), `geodaten.graz.at/gisportal` (ArcGIS Portal) + `…/mapping/rest` | curl | geprüft |
| `geohub-1-magibk.hub.arcgis.com` + `services8.arcgis.com` (Innsbruck) | curl | geprüft |
| `vector.sitg.ge.ch` (ArcGIS REST + WFS, Genf) | curl | geprüft |
| `map.bern.ch/arcgis/rest` | curl | geprüft |
| `map.stadtluzern.ch` | curl: `Connection reset`; WebFetch: 503 | **nicht erreichbar** |
| `stadtplan.winterthur.ch` | curl: 502 / WFS-Pfad 500 | **nicht erreichbar** |
| `maps.zh.ch/wfs/OGDZHWFS` (Kanton Zürich) | curl | geprüft, keine Parkierungsebene |
| `mobilitaetsdaten.gv.at` (nationaler Zugangspunkt) | curl | geprüft, siehe Negativbefund ÖAMTC |

Stufen wie im Vorbild: **geprüft** (Dienst/Datei abgerufen, Felder gesehen),
**belegt** (im Portal nachgewiesen, nicht abgerufen), **Hinweis** (nicht widerlegt).

**Zusatzaufwand, der für alle 13 gilt** (kein Stadtproblem, darum einmal hier):

- **Feiertage.** `holidaysFor(land, jahr)` kennt deutsche Länder. Österreich hat 13
  bundesweite Feiertage (Feiertagsruhegesetz) plus Landespatrone, die *keine*
  gesetzlichen Feiertage sind, aber lokal wie welche behandelt werden (Wien:
  Leopold 15.11., Salzburg: Rupert 24.9., Kärnten: 10.10., Tirol/Steiermark:
  Josef 19.3., OÖ: Florian 4.5.) — ob die Kurzparkzone an diesen Tagen gilt,
  steht in keiner der geprüften Quellen; die Wiener Schreibweise `(werkt.)` heißt
  Mo–Sa ohne Feiertag. Die Schweiz regelt Feiertage **kantonal**, teils halbtags
  (Zürich: Sechseläuten, Knabenschiessen; Genf: Jeûne genevois, Restauration
  31.12.; Basel: Fasnachtstage sind keine Feiertage). Das ist eine neue
  Dimension `Land → Staat` in `core/holidays`, nicht ein weiterer Eintrag.
- **Währung.** `Fee` rechnet in Cent ohne Währung. Die Schweiz kostet in Rappen;
  ohne Währungsfeld stünde „3,00 €" über Zürich. Vor der ersten Schweizer Stadt
  braucht `Fee` eine Währung, und `CostEstimate`/Formatierung müssen sie tragen.
- **Rechtsbegriffe.** Österreich: Kurzparkzone nach § 25 StVO, Parkometerabgabe,
  „Parkpickerl"; „gebührenfreie Kurzparkzone" verlangt eine **Parkscheibe** —
  das ist Hamburgs `disc`, nicht `unknown`. Schweiz: „Blaue Zone" ist Parkscheibe
  mit 1 h (+ angebrochene halbe Stunde, Mittagsregel 11:30–13:29 → bis 14:30 in
  Basel und Winterthur), „weiss" ist entweder gebührenpflichtig oder frei;
  Parkkarte/Bewilligung hebt die Zeitbeschränkung auf. Beides kann `Fee.disc`
  schon; die Mittagsregel kann `parse-schedule` nicht.
- **Achsen.** Alle vier geprüften GML-Ausgaben (Wien, Zürich, Genf ×2) liefern
  mit `urn:ogc:def:crs:EPSG::4326` **[lat, lon]**; alle GeoJSON-Ausgaben
  **[lon, lat]**. Ohne `srsName` antworten Wien in EPSG:31256 (MGI/GK M34,
  `[759.8, 345262.9]`), Salzburg in 31255, Genf in 2056, Zürich in 2056 — alles
  plausible Zahlen, keine Grade. `assertDegrees` bleibt Pflicht.

---

### 1. Tabelle

| Stadt | Land | Einw. | Zonen? (Beleg) | Schnittstelle | Geom. | Tarif | Zeiten | Höchstdauer | Lizenz | Aktualität | Stufe | Klasse |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| **Wien** | AT | 2,0 Mio | ja, bezirksweise flächendeckend (<https://www.wien.gv.at/verkehr/parken/kurzparkzonen/>, 16.9.) | WFS 2.0 `https://data.wien.gv.at/daten/geo`, `ogdwien:KURZPARKZONEOGD` (81 Polygone), `ogdwien:KURZPARKSTREIFENOGD` (795 Linien), dazu `PARKENGELTUNGOGD` (238), `PARKENBERECHTOGD` (24), `PARKENANRAINEROGD` (1.356), `PARKENAUTOMATOGD` (206) | ja | **nein im Feed**, stadtweit ein Tarif (3,40 €/h, 15 min gratis, seit 1.1.2026) | **ja** (`ZEITRAUM`, 3 bzw. 23 Schreibweisen) | **ja** (`DAUER`: `2 h`, `1,5 h`) | WFS-Caps: `CC BY 3.0 AT`; data.gv.at-Katalog: `CC BY 4.0` | Katalog modified 2025-11-20; `GUELTIG_VON` bis 2025-04-09 | geprüft | **B** (faktisch A: ein Tarif, aus der Verordnung) |
| **Graz** | AT | 0,30 Mio | ja, Blaue Zone flächendeckend/straßenzugsweise + Grüne Zone (<https://www.gps.graz.at/cms/beitrag/10072106/9154670/>, 16.9.) | ArcGIS FeatureServer `https://geodaten.graz.at/mapping/rest/services/1_3_Verkehrswesen/Grazer_Parkzonen/FeatureServer` Layer 0 „Kurzparkzonen aktuell" (90 Polygone), Layer 1 „Parkzonen aktuell" (75) | ja | **ja** (`PARK_GEBUEHR`: `Mindestgebühr (halbe Stunde): € 1,30 …`) | **ja** (`GELTUNGSZEIT`, 2 Schreibweisen) | **ja** (`PARKDAUER`: `180 min`/`90 min`/`60 min`, grün: `Ohne Beschränkung`) | **am Dienst nicht ausgewiesen** (`licenseInfo: null`, `access: public`); OGD-Portal Graz: CC BY 4.0 „Datenquelle: Stadt Graz – data.graz.gv.at", Parkzonen dort aber **nicht gelistet** | `ZONEN_PLAN` verweist auf `Parkzonen_online_2023.pdf`; Dienst ohne Datumsfeld | geprüft | **A** (Lizenz zu klären) |
| **Linz** | AT | 0,21 Mio | ja, flächendeckende Kurzparkzone Innenstadt + Urfahr (<https://www.linz.at/serviceguide/viewchapter.php?chapter_id=122157>, 16.9.) | Shapefiles auf `https://data.linz.gv.at/katalog/geodata/kurzparkzonen/2022/Kurzparkzone_{30min,90min_Area,90min_Line,180min,Grenze}_20220621.shp` (data.gv.at `bb992195-…`), dazu `bewohnerparkzonen/2023/BBV_Bewohnerparkzonen_20230221` und Parkscheinautomaten 2022/2023 | ja (je Dauer eine Datei) | nein, stadtweit 1 €/30 min | nein, stadtweit Mo–Fr 8–18:30, Sa 8–12 (Bahnhof täglich) | ja, implizit über den Dateinamen | CC BY 4.0 (Katalog) | Stand 21.6.2022, Katalog modified 2023-03-28 | **belegt** (Host aus dieser Umgebung gesperrt) | **B**, statisch |
| **Salzburg** | AT | 0,16 Mio | ja, gebietsweise: dunkelblau gebührenpflichtig, hellblau Parkscheibe (<https://www.stadt-salzburg.at/kurzparkzone>, 16.9.) | WFS 2.0 `https://data.stadt-salzburg.at/geodaten/wfs`, `ogdsbg:kurzparkzone` (41 MultiPolygone), `ogdsbg:bewohnerparkzone` (13), `ogdsbg:parkscheinautomat` | ja | nein im Feed, stadtweit 2,20 €/h, max 3 h = 6,60 € | **ja** (`GEBUEHRENPFLICHT`, 4 Schreibweisen) | **ja** (`MAXIMALE_PARKDAUER`: `3 Stunden`) | WFS-Caps: „Datenquelle: Stadt Salzburg – data.stadt-salzburg.at; Nutzungsbedingungen: CC BY 3.0 AT"; Katalog (2016): CC BY-**SA** 3.0 AT | `GILT_VON` bis 2023-07-02; Katalog modified 2016-12-09 | geprüft (über WebFetch) | **B** (faktisch A) |
| **Innsbruck** | AT | 0,13 Mio | ja, 20 Parkzonen + Parkstraßen (<https://www.innsbruck.gv.at/parken>, 16.9.) | ArcGIS Online `https://services8.arcgis.com/LxSaGwss445axp1E/arcgis/rest/services/Parkzonen_WGS84/FeatureServer/0` (21 Polygone), Eigentümer `geoHub_Innsbruck` / Stadtmagistrat Innsbruck | ja | **ja** im Freitext `INFO` (`EUR 1.10 erste halbe Stunde … höchstens EUR 9 pro Kalendertag`) | **ja** (in `INFO`, 7 Schreibweisen) | **ja** (in `BEZEICH`: `Kurzparkzone 180 min`) | **nicht ausgewiesen** (`licenseInfo` leer); data.gv.at-Eintrag `8ffd16df-…` nicht mehr auffindbar | `dataLastEditDate` 2026-06-18; **neue Parkabgabeverordnung ab 2.11.2026** | geprüft | **A** (Lizenz zu klären; Stand läuft am 2.11. ab) |
| **Klagenfurt** | AT | 0,10 Mio | ja, eine gebührenpflichtige Zone Innenstadt + Parkstraßen (<https://www.klagenfurt.at/parken>, 16.9.) | **keine**; Karte nur im „GIS Klagenfurt" (`mapps.hxdr.app`, Web-App) | — | 0,90 €/30 min, Tagesticket 7 € (Website) | Mo–Fr 8–18, Sa 8–12 (Website) | 3 h (Website) | — | — | geprüft (Negativ) | **D** |
| **Zürich** | CH | 0,43 Mio | ja, Blaue Zone stadtweit, gebührenpflichtige Plätze in Hoch-/Niedertarifzone (<https://data.stadt-zuerich.ch/dataset/geo_gebietseinteilung_parkierungsgebuehren>, Erlass 551.330, 16.9.) | WFS 1.1 (QGIS Server) `https://www.ogd.stadt-zuerich.ch/wfs/geoportal/Gebietseinteilung_Parkierungsgebuehren` → `tarifzonen` (**2** Polygone, beide Hochtarif „Innenstadt und Oerlikon"); `…/Oeffentlich_zugaengliche_Strassenparkplaetze_OGD` → `view_pp_ogd` (**46.282** Punkte) | ja | nein im Feed; Erlass 551.330: Hochtarif Kontrollgebühr 0,50 Fr./20 min + ab 31. Minute 0,50 Fr./10 min (≈ 3 Fr./h), übrige Stadt 0,50 Fr./h | **ja**, nur Hochtarif (`bedienungszeiten`: `Montag - Samstag, 9:00 - 20:00 Uhr`, 1 Schreibweise) | **ja** an den Punkten (`parkdauer` in Minuten, 14 Werte) | CC0 (`cc-zero`) | Tarifzonen `dateLastUpdated` 15.03.2024; Punkte **Stand 31.12.2021, „werden nicht mehr aktualisiert"** | geprüft | **B** (Tarif aus Erlass; Punkte veraltet) |
| **Bern** | CH | 0,13 Mio | ja, 42 Parkkartenzonen, Blaue Zone, gebührenpflichtige Felder (<https://www.bern.ch/themen/mobilitat-und-verkehr/motorrad-und-auto/parkieren/parkkartenzonen>, 16.9.) | ArcGIS REST `https://map.bern.ch/arcgis/rest/services/Geoportal/Parkkartenzonen/MapServer/1` (42 Polygone), `…/Geoportal/Parkplaetze_oeffentlich/MapServer/11` Parkfeld_Gebuehrenpflichtig (455), `/12` blau APK (3.003), `/13` weiss APK (469), `/14` weiss Kurzzeit (81) | ja | nein | nein (`Info_beschrieb`: `Auch Sonntags` bei 4 Zonen, sonst `unbekannt`/`nicht definiert`) | nein | `copyrightText: Geodaten Stadt Bern`; OGD laut Geoportal, Nutzungsbedingungen nicht abgerufen (opendata.swiss 403) | `Letzte_Aenderung` bis 2025-01-14 | geprüft | **C** |
| **Basel** | CH | 0,17 Mio | ja, Blaue Zone Mo–Sa 8–19, gebührenpflichtige Plätze (<https://www.bs.ch/themen/mobilitaet/fahren-und-parkieren/wo-parkieren-basel>, 16.9.) | `https://data.bs.ch/api/explore/v2.1/catalog/datasets/100329` „Parkflächen" (7.815 Zeilen) — **ohne Geometriefeld**; `wfs.geo.bs.ch` führt keine Parkflächen-Ebene (1.210 Typen, nur `VM_Parkverbotszone`, `PB_Parkplatzauslastung`); `data.geo.bs.ch` von hier 502 | **nein** (nur PDF-Kataster und MapBS) | teilweise (`tarif_gebiet` A/B/C, `tarif_code` A1…C9 — Gebiete laut Regierungsrat **seit 1.1.2025 abgeschafft**, Tarif je Parkuhr 1–4 Fr./h) | **ja** (`gebpflicht`: `MO-SA: 08:00-19:00`, 9 Schreibweisen) | **ja** (`maxparkz` Minuten) | CC BY 4.0 | modified 2026-09-13 | geprüft | **D** (Tabelle ohne Geometrie) |
| **Genf** | CH | 0,20 Mio | ja, 53 Macaron-Zonen mit zone bleue, payant per horodateur (<https://www.geneve.ch/themes/mobilite-transport/stationnement-places-parking-geneve>, 16.9.) | ArcGIS REST + WFS 2.0 `https://vector.sitg.ge.ch/arcgis/rest/services/OTC_MACARON/MapServer/0` (53 Polygone), `…/OTC_STATIONNEMENT_V_PUBLIQUE/MapServer/0` (**12.731** Linien) | ja | nein | nein | teilweise (`TYPE_STATIONNEMENT`: `Payant 90 min`, `Gratuit 60 min` … 27 Werte) | SITG Stufe „A – Accès libre (Open Data)", Quellenangabe „Données SITG" Pflicht | Macaron: täglich nachgeführt, publiziert 12.06.2025 | geprüft | **C** |
| **Luzern** | CH | 0,08 Mio | ja, Parkbewilligungszonen A–R + 3 Tarifzonen (<https://www.stadtluzern.ch/dienstleistungeninformation/42>, 16.9.) | laut Stadt „über 200 Datensätze auf opendata.swiss, alle Themen als Geodienste" (`stadtluzern.ch/opengovernmentdata`); `map.stadtluzern.ch/server/rest/services` | ? | Zone 1: 3 Fr./h, Zone 2: 2 Fr./h, Zone 3: 7–19 kostenpflichtig (Website) | Website | Zone 1: 60 min (Website) | opendata.swiss-Nutzungsbedingungen (Quellenangabe) | ? | **Hinweis** (beide Hosts aus dieser Umgebung nicht erreichbar) | **offen**, vermutlich B/C |
| **Winterthur** | CH | 0,12 Mio | ja, **flächendeckende Blaue Zone** seit 1.11.2025, Mo–Sa 8–19 (<https://stadt.winterthur.ch/themen/leben-in-winterthur/verkehr-mobilitaet/flaechendeckende-blaue-zone>, 16.9.) | **keine gefunden**: Parkkartenzonen nur im Stadtplan (`stadtplan.winterthur.ch`, von hier 502); Kantons-WFS ohne Parkierung; opendata.swiss 403 | — | — | Website | 1 h Parkscheibe (Website) | — | — | geprüft (Negativ) | **D** |
| **St. Gallen** | CH | 0,08 Mio | ja, Erweiterte Blaue Zone (Bewilligung) + weiss bewirtschaftet (<https://www.stadt.sg.ch/home/mobilitaet-verkehr/parkieren.html>, 16.9.) | `https://daten.stadt.sg.ch/api/explore/v2.1/catalog/datasets/ppv-parkflaeche` (3.232 Polygone) | ja | nein | nein | nein (nur `markierungsart`: `Erweiterte Blaue Zone` 1.871, `Weiss (bewirtschaftet)` 781, 12 Werte; `anzahl_pp`) | CC BY | modified 2023-07-05 | geprüft | **C** |

---

### 2. Die Städte der Klassen A und B im Einzelnen

#### Wien — geprüft, B (ein Tarif für die ganze Stadt)

**Sieben Ebenen, ein GeoServer.** `GetCapabilities` (371 KB) nennt 14 Typen mit
„PARK" im Namen; relevant sind sechs. `KURZPARKZONEOGD` („Kurzparkzone (Fläche)",
`V_OGD_KURZPARK_F`): 81 Features, 49 Polygone + 32 MultiPolygone, DefaultCRS
`urn:ogc:def:crs:EPSG::31256`, WGS84-Box 16,20–16,55 / 48,12–48,31.

Felder: `BEZIRK` (int), `BEZIRK2` (int, bei 3 Flächen gesetzt — 5 und 15, so
tauchen Bezirk 5 und die Stadthallenzone auf; **`BEZIRK` allein listet 22 der 23
Bezirke, Margareten steht nur in `BEZIRK2`**), `ZEITRAUM`, `DAUER`, `GUELTIG_VON`
(`2022-02-28Z`, 12 Werte, jüngster `2025-04-06Z`), `WEBLINK2`, `SE_SDO_ROWID`.
Beispiel: `{BEZIRK: 19, ZEITRAUM: "Mo.-Fr. (werkt.) v. 9-22 Uhr", DAUER: "2 h"}`.

**Schreibweisen der Zeiten: 3** auf den Flächen — `Mo.-Fr. (werkt.) v. 9-22 Uhr`
(78), `Mo.-Fr. (werkt.) v. 8-11 Uhr` (2, Donaustadt-Stadtrand), `Mo.-Fr. (werkt.)
v. 8-18 Uhr; Sa. (werkt.) v. 8-12 Uhr` (1). **`DAUER`: 2** — `2 h` (80), `1,5 h` (1).
Das ist der homogenste Feed dieser Recherche. Dazu `KURZPARKSTREIFENOGD` (795
Linien, `STRNAM`, `GELTUNGSBEREICH` als Hausnummernspanne `76 bis 78`): die
Geschäftsstraßen mit eigener Regelung — **23 Schreibweisen**, davon
`Mo.-Fr. (w.) v. 8-18h, Sa. (w.) v. 8-12h` 666-mal; Varianten mit `8:30-18h`,
`10.30-15h` (Punkt statt Doppelpunkt), `(werkt.) v.9-22h` ohne Leerzeichen,
`Mo.-Sa. (w.)`. `DAUER` dort `1,5 h` (792) / `2 h` (3). Die Streifen liegen
**innerhalb** der Bezirksflächen; wer nur die Fläche fragt, sagt in der
Ottakringer Straße „bis 22 Uhr, 2 h" statt „bis 18 Uhr, 1,5 h" — der Streifen
muss die Fläche überstimmen (Punkt-in-Linie-Nähe, nicht Punkt-in-Polygon).

**Tarif:** kein Feld. Stadtweit einheitlich, Website vom 16.9.: 15 min gratis,
30 min 1,70 €, 60 min 3,40 €, 90 min 5,10 €, 120 min 6,80 € (seit 1.1.2026; 2025
waren es 1,30/2,60/3,90/5,20 €). Ein Wert in der Konfiguration statt im Feed —
wie München, nur dass hier die Zahl bekannt ist. `PARKENAUTOMATOGD` (206 Punkte)
sind **Verkaufsstellen** der Wiener Linien, keine Parkscheinautomaten; Wien hat
keine Automaten am Straßenrand.

**Fallen.** (1) Ohne `srsName`: `[759.79775, 345262.9085]` — MGI/Gauß-Krüger
M34, Meter um den Nullpunkt bei Wien, sieht nach einem Fehler aus, ist keiner.
(2) GML mit `srsName=urn:ogc:def:crs:EPSG::4326` liefert `<gml:posList>48.245
16.342 …` → **[lat, lon]**; JSON (`outputFormat=json`) liefert `[16.342, 48.245]`
mit `crs.name = urn:ogc:def:crs:EPSG::4326`. (3) Lizenz steht zweimal
verschieden: WFS-Caps `ows:Fees` = `creativecommons.org/licenses/by/3.0/at`, der
Katalog sagt CC BY 4.0. Beide Namensnennung, aber vor dem Eintrag in
`City.attribution` gehört das nachgefragt. (4) `PARKENGELTUNGOGD` (238) und
`PARKENBERECHTOGD` (24) tragen `TEXT_RECHT: "…haben keine Rechtsgültigkeit"` —
die Kurzparkzonen-Flächen tragen so einen Satz nicht, aber die Website sagt es
sinngemäß für die Karte. (5) `BEZIRK` ist bei den Flächen `int`, bei den
Geltungsbereichen `string` (`'15'`). Gleicher Name, anderer Typ.

#### Graz — geprüft, A (Lizenz am Dienst offen)

**Nicht im OGD-Portal, sondern im GIS-Portal.** `data.graz.gv.at` ist WordPress
ohne API, und der OGD-ArcGIS-Dienst `OGD/OGD_WFS` führt 47 Ebenen ohne Parkzonen
(nur `Behindertenparkplaetze`). Gefunden über
`geodaten.graz.at/gisportal/sharing/rest/search?q=parkzone` (7 Treffer, alle
`access: public`): FeatureServer `1_3_Verkehrswesen/Grazer_Parkzonen` mit Layer 0
„Kurzparkzonen aktuell" (**90** Polygone) und Layer 1 „Parkzonen aktuell" (**75**
Polygone, Grüne Zone); daneben `Parkzonen_Gebiete`. Kein `copyrightText`, kein
`licenseInfo`. Das OGD-Portal stellt alles unter CC BY 4.0 „Datenquelle: Stadt Graz
– data.graz.gv.at" — ob das den GIS-Portal-Dienst einschließt, muss das
Stadtvermessungsamt sagen.

Felder (beide Layer gleich): `BEZEICHNUNG` (`01`…`11`, `S1`, `S2` bzw. `A`…`K`,
`S3`), `NAME`, `TYP` (`Flächendeckend` 21 / `Straßenzugsweise` 69; grün 22/53),
`PARKDAUER` (`180 min` 84, `90 min` 5, `60 min` 1; grün `Ohne Beschränkung`),
`GELTUNGSZEIT`, `PARK_DAUER` (Satzform), `PARK_GEBUEHR`, `AG_BEWOHNER_INFO`,
`ZONEN_PLAN` (PDF je Zone), `HANDYPARKEN_CODE`, `DELETED` (`' '`, einmal `None`,
einmal `<Null>` als Zeichenkette). Beispiel: `{BEZEICHNUNG: "02", NAME: "Lend",
TYP: "Flächendeckend", PARKDAUER: "180 min", GELTUNGSZEIT: "Werktags, Montag bis
Freitag, von 9.00 Uhr bis 20.00 Uhr und Samstag von 9.00 Uhr bis 13.00 Uhr",
PARK_GEBUEHR: "Mindestgebühr (halbe Stunde): € 1,30 bis € 7,80 je nach maximaler
Parkdauer"}`.

**Schreibweisen:** Zeiten **2** (blau: die eine oben 89-mal, `Täglich von 8.00 Uhr
bis 22.00 Uhr` 1-mal am Europaplatz; grün: `Werktags, Montag bis Freitag von 9.00
bis 20.00 Uhr.` 75-mal — mit Punkt am Ende und ohne „Uhr" nach 9.00). Gebühr **1**
je Layer: blau `€ 1,30` je halbe Stunde (= 2,60 €/h), grün `Mindestgebühr (halbe
Stunde): € 1,00 Tagesticket (24 Stunden): € 11,00 bis 5-Tages-Ticket: € 55,00`. Die
Website (gps.graz.at, 16.9.) bestätigt 1,30 € und 9–20/9–13.

**Fallen.** (1) 69 der 90 blauen Flächen sind „straßenzugsweise" — schmale
Polygone (`Shape__Area` 784 m²) entlang einzelner Straßen, die **in** den
flächendeckenden Gebieten liegen können; Punkt-in-Polygon trifft dann zwei
Flächen. (2) `PARK_GEBUEHR` nennt eine Spanne (`bis € 7,80`), der Stundensatz muss
aus „halbe Stunde" gerechnet werden — ein eigener Parser, wie bei jeder Stadt.
(3) Nach `outSR=4326` kommt GeoJSON in `[lon, lat]`; `f=geojson` ist ArcGIS,
kein WFS — `resultType=hits` heißt hier `returnCountOnly=true`.

#### Innsbruck — geprüft, A (Lizenz offen, Stand endet am 2.11.2026)

**Zwei Fallen vor dem ersten Feature.** Die Suche im geoHub Innsbruck
(`…/api/v3/datasets?q=parkzonen`) liefert als ersten Treffer „Parkzonen" auf
`services.arcgis.com/aiZ6IleXsHSbsd6b/…/Parkenplatz/FeatureServer/1` — 14
Polygone mit `anzeigenam: "Tarif-Zone 4"`, `text2: "1,00 / Tag"` und einem Extent
in **EPSG:25832 bei 455.655/5.749.165**, das ist 8,38° O / 51,91° N,
Nordrhein-Westfalen. Die Hub-Suche ist nicht auf Innsbruck begrenzt (dieselbe
Abfrage mit `q=park` bringt Mississauga, Seattle, Odessa). Der echte Datensatz
steht auf der Seite `datasets/parkzonen-wgs84/about` (Item
`22d0f281143d4b08970b3dcb275b66e0`, Eigentümer `geoHub_Innsbruck`, Organisation
„Stadtmagistrat Innsbruck", Extent 11,32–11,43 / 47,25–47,29):
`services8.arcgis.com/LxSaGwss445axp1E/arcgis/rest/services/Parkzonen_WGS84/FeatureServer/0`,
**21 Polygone**, `dataLastEditDate` 2026-06-18.

Felder: `FID`, `BEZEICH` (**6 Werte**: `Parkstraße kostenpflichtig (werktags)` 6,
`Parkstraße kostenpflichtig (täglich)` 5, `Kurzparkzone 180 min kostenpflichtig` 5,
`Kurzparkzone 90 min kostenpflichtig` 2, `Kurzparkzone kostenfrei 180 min 1-5 Uhr`
2, `Parkstraße kostenpflichtig (werktags/täglich)` 1), `INFO` (**7 Werte**), z. B.
`werktags Mo-Fr von 9-19 Uhr, EUR 1.10 erste halbe Stunde, danach gleicher Tarif in
EUR 0.10 - Schritten, jedoch höchstens EUR 9 pro Kalendertag` (6), `werktags Mo-Fr
von 9-21 Uhr und Sa von 9-13 Uhr, EUR 1.10 …` (2), `täglich von 1-5 Uhr, kostenfrei`
(2), eine Saisonregel `täglich (1.5. bis 31.8.) bzw. werktags Mo-Fr (1.9. bis
30.4.) von 9-19 Uhr …`, eine mit `EUR 0.50 erste halbe Stunde … ab 4. Stunde EUR 1
je halbe Stunde`. Zeiten, Betrag, Deckel und Dauer stehen also in **einem**
Freitextfeld mit Dezimalpunkt (`1.10`) statt Komma — der Parser darf `parse-fee`
nicht wiederverwenden.

**Lizenz:** `licenseInfo` leer, `accessInformation` null; der data.gv.at-Eintrag
„Parkzonen" (`8ffd16df-…`) ist über die piveau-Suche `q=Parkzonen` nicht mehr
auffindbar (nur Linz). Und: die Stadtseite kündigt eine **neue
Parkabgabeverordnung ab 2. November 2026** an („neue Parkzonen, Parkzeiten"). Wer
im Oktober anschließt, baut gegen einen Stand, der sechs Wochen später falsch ist.

#### Salzburg — geprüft über WebFetch, B (ein Tarif für die ganze Stadt)

`data.stadt-salzburg.at` lehnt den CONNECT aus dieser Umgebung ab
(`connect_rejected`); über den WebFetch-Weg antwortete der WFS 2.0 (GeoServer):
Typen `ogdsbg:kurzparkzone` „Kurzparkzone", `ogdsbg:bewohnerparkzone`,
`ogdsbg:parkscheinautomat`, `ogdsbg:parkplatz`, `ogdsbg:behindertenstellplatz`;
`Fees: NONE`, `AccessConstraints: Datenquelle: Stadt Salzburg –
data.stadt-salzburg.at; Nutzungsbedingungen: CC BY 3.0 AT`; DefaultCRS
`urn:ogc:def:crs:EPSG::31255`. `resultType=hits`: **41** (timeStamp
2026-09-16T10:38:32Z); Bewohnerparkzonen **13**. Mit `srsName=…4326` und
`outputFormat=application/json`: MultiPolygon, erste Koordinate `[13.0520,
47.7925]` → [lon, lat].

Felder: `ID`, `NAME` (17 Werte, teils Großschrift `NONNTAL-OST`, teils
`Kurzparkzone (Bewohnerparkzone E)`, teils Straßenkürzel `B1 INNSBRUCKER BNDSTR.
12-20`), `ART` (**2 Werte**: `Gebührenfreie Kurzparkzone` 28, `Gebährenpflichtige
Kurzparkzone` 13 — **Tippfehler im Feed**, „Gebähren"; ein Vergleich auf
„Gebührenpflichtig" findet null Flächen), `GEBUEHRENPFLICHT` (**4 Schreibweisen**:
`gebührenpflichtig (Gebühreneinhebung mit Parkscheinautomat) werktags Montag bis
Freitag 9-19 Uhr; gebührenfrei (aber Parkuhrenpflicht) Samstag 9-16 Uhr` 13,
`gebührenfrei (aber Parkuhrenpflicht) werktags Montag bis Freitag 9-19 Uhr` 21,
dieselbe `… und Samstag 9-16 Uhr` 6, `… - gilt nicht zum Dauerparken mit
Ausnahmebewilligung` 1), `MAXIMALE_PARKDAUER` (`3 Stunden`, 41-mal),
`GILT_VON`/`GILT_BIS` (bis `2049-12-30T23:00:00Z`), `STATUS` (`aktiv`),
`KEIN_BEWOHNERPARKEN` (`Ja` 1), `GRUPPE` (Bewohnerzonen-Buchstabe, 23-mal null),
`DOWNLOAD_URL` (`/common/legend/Kurzparkzonen.pdf`).

**Tarif:** kein Feld; Website 16.9.: 1 h = 2,20 €, max 3 h = 6,60 €, Mo–Fr 9–19,
Samstag 9–16 gratis mit Parkscheibe. Die 28 gebührenfreien Zonen sind Hamburgs
`disc`. **Lizenz zweimal verschieden:** WFS sagt CC BY 3.0 AT, der
data.gv.at-Eintrag von 2016 CC BY-**SA** 3.0 AT — SA wäre für dieses Projekt ein
neues Lizenzverhalten; klären, welche gilt.

#### Zürich — geprüft, B (Tarif im Erlass, Punkte von 2021)

CKAN-Suche `q=park`: 79 Treffer, davon drei tragen: `geo_gebietseinteilung_parkierungsgebuehren`
(„Hoch- und Niedertarifzonen … sowie die Spezialregelung für die PP beim Zoo",
`dateLastUpdated` 15.03.2024, Rechtsgrundlage 551.330), `geo_oeffentlich_zugaengliche_strassenparkplaetze_ogd`
(**Stand Ende 2021, „werden nicht mehr aktualisiert"**) und die Statistik
`sid_dav_pb_anwohnerparkkarten_*` (CSV ohne Geometrie). Alle `cc-zero`.

`tarifzonen`: **2** Polygone, beide `tarifzone: "Hochtarifzone"`,
`zone_bezeichnung: "Innenstadt und Oerlikon"`, `bedienungszeiten: "Montag -
Samstag, 9:00 - 20:00 Uhr"`. Der Niedertarif ist nicht als Fläche da — er ist
„alles andere", und der Zoo-Sonderfall aus der Beschreibung fehlt im Feed.
`view_pp_ogd`: **46.282** Punkte mit `art` (7 Werte: `Blaue Zone` 31.977, `Weiss
markiert` 13.392, `Nur mit Geh-Behindertenausweis` 413 …), `gebuehrenpflichtig`
(`gebührenpflichtig` 11.136 / `nicht gebührenpflichtig` 35.146), `parkdauer`
(Minuten als Zeichenkette, 14 Werte: `60` 32.891, `120` 4.830, `None` 2.097, `900`
1.579, `2880` 240, `8` 1).

**Tarif** aus 551.330 (PDF, Stand V3): Art. 3 Parkuhrkontrollgebühr Fr. –.50 pro 20
Minuten in den Gebieten nach Art. 2; Art. 4 ab der 31. Minute zusätzlich Fr. –.50
je 10 Minuten in den ersten zwei Stunden, danach Fr. –.50/h; Art. 5 übrige Stadt
Fr. –.50 für 1 Stunde. Presse (Suche) nennt nach der Erhöhung 3 Fr./h Hochtarif;
die Verordnung selbst ist die Quelle, nicht die Presse.

**Fallen.** (1) Der WFS ist **QGIS Server 1.1.0**: `resultType=hits` liefert
`numberOfFeatures`, nicht `numberMatched`; `srsName=urn:ogc:def:crs:EPSG::4326`
mit `outputFormat=application/json` → **HTTP 500 mit HTML-Seite**, `srsName=EPSG:4326`
geht; GML `lowerCorner 47.364 8.518` → [lat, lon], JSON `[8.548, 47.378]` →
[lon, lat], `crs` im JSON fehlt. (2) 46.282 Punkte à 12 MB sind kein
Zonenfeed; die App braucht Flächen. Die Blaue Zone ist stadtweit, ihre Regel
(1 h Parkscheibe, Anwohnerkarte) steht nirgends als Attribut. (3) Zwei
Datenstände: Tarifzonen 2024, Punkte 2021.

#### Linz — belegt, B (statische Shapefiles von 2022)

Über die piveau-API: „Kurzparkzonen Standorte 2022 (Linz)", CC BY 4.0, issued
2022-07-18, modified 2023-03-28, „Kurzparkzonen 30, 90 und 180 Minuten sowie
Gebührenzonen-Grenzen"; 24 Dateien unter
`data.linz.gv.at/katalog/geodata/kurzparkzonen/2022/` (`Kurzparkzone_30min`,
`_90min_Area`, `_90min_Line`, `_180min`, `_Grenze`, je `.shp/.dbf/.shx/.prj/.cpg`).
Dazu „BewohnerInnen-Parkzonen (Linz)" (2023-02-24) und „Parkscheinautomaten
Standorte 2022/2023". Der Host `data.linz.gv.at` ist aus dieser Umgebung gesperrt
(curl: Sperrseite; WebFetch: 302 auf eine leere data.gv.at-Seite), die Felder sind
also **nicht gesehen**. Was die Stadt selbst sagt (16.9.): flächendeckende
Kurzparkzone Innenstadt seit Oktober 2001 und Urfahr, Mo–Fr 8–18:30, Sa 8–12,
Bahnhof täglich; Gebühr **einheitlich 1 € je angefangene halbe Stunde**; Dauer 30/90/
180 min laut Beschilderung; Kontakt `parkservice@mag.linz.at`. Kein Dienst, kein
Aktualisierungsversprechen — ein Abzug, der seit Juni 2022 steht.

---

### 3. Klasse D: wo die Zonen stehen

**Klagenfurt.** `klagenfurt.at/parken` (16.9.): *eine* gebührenpflichtige Zone
innerhalb/entlang des Rings (rund 3.800 Stellplätze), 0,90 €/30 min, Mo–Fr 8–18,
Sa 8–12, Sonn-/Feiertag frei, 15 min gratis mit Zettel, 5 min Toleranz, max 3 h;
Parkstraßen mit Tagesticket 7 €; Sonderzeiten Ostbucht. Karte: „GIS Klagenfurt"
(`mapps.hxdr.app/AppEngine/?tenant=klagenfurt`, eine Web-App ohne dokumentierte
Schnittstelle). data.gv.at kennt zu `Klagenfurt Parken` nur Linzer Haushaltsposten
und eine Kärntner Förderzusage; `data.ktn.gv.at` (Land) → 502 von hier. Amt:
Straßenverkehr/Parkraumbewirtschaftung Magistrat Klagenfurt. Kein Anzeichen für
einen kommenden Datensatz. Der nationale Zugangspunkt führt Klagenfurt im
ÖAMTC-Datensatz (Abschnitt 4).

**Basel.** Die Zonen stehen (a) tabellarisch in `data.bs.ch/100329` „Parkflächen"
(7.815 Zeilen, `strasse`, `anzahl_parkfelder`, `typ` mit 29 Werten — `Blaue Zone`
4.406, `Parkplätze gebührenpflichtig` 587 in 21 `tarif_code`s, `Parkverbotsfelder
zeitw. gebührenpflicht` 43 in 3 weiteren —, `gebpflicht` in 9 Schreibweisen wie `MO-SA:
08:00-19:00`, `MO-FR: 18:30-24:00 / SO: 08:00-24:00`, `MO-SA:19:00-06:00/ SO
00:00-24:00`, `maxparkz` 30…1080 Minuten, `wov_name`/`bez_name`), aber **ohne
Geometrie** — kein `geo_shape`, kein `geo_point_2d`, Export als GeoJSON liefert
`geometry: null`; (b) als PDF „Parkplatzkataster Stadt Basel, Stand 13.11.2025"
(`media.bs.ch/…/parkplatzkataster-stadt-basel-stand-13-11-2025.pdf`, 97 KB, ohne
Poppler hier nicht lesbar); (c) im MapBS (`map.geo.bs.ch`, Gruppen „Parkierung",
„Grundlagen der Parkraumbewirtschaftung" — im WMS enthalten diese Gruppen nur
`XP_Parkhausauslastung`, `PB_Parkplatzauslastung`, `PB_Erschliessungsqualitaet`).
Der Kantons-WFS (1.210 Typen) hat keine Parkflächen. `data.geo.bs.ch` (der
Download-Host der offenen Geodaten) → 502 aus dieser Umgebung — **dort könnte die
Geometrie liegen; aus einer anderen Umgebung nachprüfen.** Amt: Amt für
Mobilität (Bau- und Verkehrsdepartement), `opendata@bs.ch`. Und der Tarif
wandert: Verordnung über die Parkraumbewirtschaftung (SG 952.560) seit 1.1.2025,
Parkuhrentarif je Standort 1–4 Fr./h, „die bisherigen Gebührenzonen entfallen"
(Medienmitteilung) — `tarif_gebiet` A/B/C im Datensatz ist damit ein Feld, das
etwas Abgeschafftes beschreibt, obwohl der Datensatz vom 13.9.2026 ist.

**Winterthur.** Flächendeckende Blaue Zone seit 1.11.2025 (Ausnahmen:
Zentrumszonen, einzelne Aussenwachten), Mo–Sa 8–19, 1 h + Mittagsregel;
Parkkartenzonen „im Stadtplan" (`stadtplan.winterthur.ch?topic=…`, 502 von hier).
Weder das städtische OGD (Seite 404) noch der Kantons-WFS `OGDZHWFS` (828 KB
Capabilities, Treffer nur Veloparkieranlagen und Richtplan-Parkierungsanlagen)
noch die Zürcher CKAN führen einen Winterthurer Parkdatensatz. Kontakt
`parkkarten@win.ch`. Kein Anzeichen für einen Datensatz.

---

### 4. Negativbefunde

**ÖAMTC über den nationalen Zugangspunkt — ein Datensatz für 59 Städte, aber kein
offener.** `mobilitaetsdaten.gv.at` listet „Kurzparkzonen / Parkraumbewirtschaftete
Zonen in Österreich (JSON/KML)": detaillierte Polygone mit Gültigkeitszeiten,
max. Parkdauer, **Preisen**, Bezahlanbietern und Ausnahmen für Wien, Graz, Linz,
Salzburg, Innsbruck, Klagenfurt und 53 weitere; Quelle „offizielle Verordnungen
der Kommunen", Aktualisierung quartalsweise, Wien alle zwei Wochen. Zugang aber
über „Mustervertrag" (`OEAMTC_Mustervereinbarung_shorttermparking.pdf`) und
REST-API nach Vereinbarung — ein Lizenzvertrag mit dem Autofahrerclub, keine
offene Lizenz. Das ist genau der kommerzielle Aggregator aus `staedte.md`, Weg C,
in amtlicher Verpackung. Beispieldatei: `OEAMTC_shorttermparking_Testdata.json`.

**Luzern — nicht erreichbar.** `map.stadtluzern.ch` bricht die Verbindung ab
(`Recv failure: Connection reset by peer`, dreimal) bzw. antwortet über WebFetch
503; `opendata.swiss` 403. Die Stadt selbst (16.9.): Parkbewilligungszonen A–R
(A/D nur Parkuhren, weiss), drei Tarifzonen (Zone 1: 3 Fr./h, max 60 min 7–19;
Zone 2: 2 Fr./h rund um die Uhr; Zone 3: 7–19 kostenpflichtig), „rund 200
Datensätze auf opendata.swiss, alle Themen als Geodienste", Karten „Zonenplan für
Parkbewilligung" und „Gebührenpflichtige Parkplätze mit Tarifzonen" auf
`map.stadtluzern.ch/citymap`. Das riecht nach B, ist aber nicht gemessen —
**aus einer anderen Umgebung prüfen.**

**data.gv.at (CKAN) und opendata.swiss** sind von hier nicht befragbar (oben);
was diese Recherche über österreichische Kataloge sagt, kommt aus der
piveau-API von data.gv.at über WebFetch — drei Abfragen, je eine Zusammenfassung.

**St. Gallen, Bern, Genf** sind keine Negativbefunde, aber Klasse C: Geometrie mit
Typ (St. Gallen `markierungsart`, Bern `Parkfeld_typ_beschrieb` / Subgruppe
`Gebührenpflichtig`, Genf `TYPE_STATIONNEMENT` inklusive Dauer: `Payant 90 min`
818 Linien mit 4.092 Plätzen, `Gratuit 60 min` 5.114 Linien mit 27.195 Plätzen),
aber weder Zeiten noch Beträge. Genf ist davon der beste: 12.731 Linien,
täglich nachgeführt, WFS 2.0 (`numberMatched="12731"`, GML [lat, lon]) und
ArcGIS REST, Lizenzstufe A. Bern: `Info_beschrieb` ist bei 28 von 42 Zonen
`unbekannt`/`nicht definiert`.

---

### 5. Zählung und Rangliste

| Klasse | Anzahl | Städte |
| --- | --- | --- |
| A | **2** | Graz, Innsbruck |
| B | **4** | Wien, Salzburg, Zürich, Linz (belegt) |
| C | **3** | Genf, Bern, St. Gallen |
| D | **3** | Klagenfurt, Basel, Winterthur |
| offen | **1** | Luzern (nicht erreichbar) |

Rangliste A/B nach Einwohnern × Datenqualität:

| # | Stadt | Einw. | Warum hier |
| --- | --- | --- | --- |
| 1 | **Wien** | 2,0 Mio | Größte Stadt der Recherche, GeoServer-WFS mit 81 Flächen + 795 Streifen, nur 3 bzw. 23 Schreibweisen, ein stadtweiter Tarif (3,40 €/h), Pflege bis 2025. Kostet: Streifen-über-Fläche-Logik, Feiertage AT, Lizenzfrage 3.0/4.0. |
| 2 | **Graz** | 0,30 Mio | Einzige Stadt mit Betrag, Zeiten und Dauer **im Feature** (wie Frankfurt), 165 Flächen, 2 Zeitschreibweisen. Kostet: Lizenz am GIS-Portal nicht ausgewiesen, Spannenbetrag parsen. |
| 3 | **Zürich** | 0,43 Mio | CC0, aber nur 2 Tarifflächen und 46.282 Punkte von 2021; Tarif aus dem Erlass; Blaue Zone ohne Attribut. Erst mit Währung in `Fee`. |
| 4 | **Salzburg** | 0,16 Mio | 41 Flächen mit Zeiten und Dauer, ein Tarif; Feed-Tippfehler, Lizenz BY vs. BY-SA offen, Host von hier gesperrt. |
| 5 | **Innsbruck** | 0,13 Mio | Betrag und Zeiten im Feed, aber alles in einem Freitext mit Dezimalpunkt; keine Lizenz; **Regelwerk wechselt am 2.11.2026** — vorher nicht anschließen. |
| 6 | **Linz** | 0,21 Mio | Shapefiles von 2022 ohne Dienst, Felder ungesehen. |

Was das über die beiden Länder sagt: Österreich kodiert die Kurzparkzone als
Fläche mit Zeiten und Dauer, weil die StVO sie so verordnet — vier von sechs
Städten liefern das, und der Tarif ist meist eine stadtweite Zahl. Die Schweiz
kodiert **Parkfelder** (Punkte/Linien mit Typ) und **Bewilligungszonen**; Zeiten
und Beträge stehen an der Parkuhr, nicht im Datensatz. Für diese App ist das
Österreich-Modell das Berliner, das Schweizer Modell das Dresdner.
