# Die Ideenliste von 2012

Die Datei `doc/Ideen.txt` stammt aus dem ursprünglichen Projekt von 2012 — eine lose Sammlung aus Links, Datenquellen und Einfällen, mit der alles
anfing. Sie ist erstaunlich gut gealtert: Der Funktionsumfang der heutigen App
steht dort in Stichworten, gut ein Jahrzehnt bevor es die Daten dafür gab.

Deshalb wandert sie mit ins neue Repository — nicht als Textdatei im Anhang,
sondern hier, mit dem Vermerk, was daraus geworden ist.

**Zwei Änderungen gegenüber dem Original:** Die damals notierten Namen,
Telefonnummern und dienstlichen E-Mail-Adressen zweier Mitarbeiter der
Senatsverwaltung sind entfernt. Sie waren 2012 als fachliche und technische
Ansprechpartner im FIS-Broker ausgewiesen; sie 2026 in einem öffentlichen
Repository weiterzuverbreiten wäre eine Veröffentlichung personenbezogener Daten
ohne jeden Zweck. Außerdem sind tote Links als solche gekennzeichnet — die
meisten der 2012er Adressen existieren nicht mehr.

## Was daraus geworden ist

| Idee von 2012 | Heute |
| --- | --- |
| „Anstatt Google Maps zu benutzen lieber OpenStreetMap?" | **Ja.** MapLibre auf OSM-Kacheln, demnächst auf eigenen Vektorkacheln. |
| Parkraumbewirtschaftung Übersicht | **Kern der App.** 103 Zonen aus dem amtlichen WFS. |
| Tarifübersicht | **Ja**, inklusive Zeitfenster, Feiertagen und Höchstparkdauer. |
| Park & Ride | **Ja**, 108 Anlagen als eigene Ebene. |
| CarSharing | **Ja**, 83 Stationen. |
| E-Mobilität, Ladestationen Berlin | **Ja**, 385 Ladepunkte. |
| Umweltzone | **Ja**, als einblendbarer Umriss. |
| Ortsteile-Geometrien Berlin | **Ja**, 97 Ortsteile als geografische Orientierung. |
| „GPS Position speichern um das Auto wieder zu finden" | **Ja**, die Parkuhr merkt sich den Ort und übersteht das Neuladen. |
| „Notifizierung wenn der Parkschein abgelaufen ist" | **Teilweise.** Erinnerung läuft, solange die Seite offen ist. Zeitgesteuerte Benachrichtigungen bei geschlossener Seite kann das Web nicht. |
| Hotline für abgeschleppte Fahrzeuge | **Ja**, direkter Weg zur Auskunftsstelle der Polizei Berlin. |
| Parkhäuser | **Nein.** Belegungsdaten existieren in Berlin nicht als offene Quelle — siehe [data-sources.md](data-sources.md). |
| „Parkgebühren mit dem Handy bezahlen" | **Nein und auf absehbare Zeit nicht.** Handyparken läuft über eine geschlossene Plattform. |
| Fahrradverleihstationen | **Nein.** Bewusst weggelassen: Diese App handelt vom Auto. |
| „Foto hochladen vom Parkautomat wg. der Parkkosten-Daten" | **Nein** — die Tarife stehen inzwischen im amtlichen Feed. Die Idee war für ihre Zeit richtig. |
| „Fotoalbum vom Parkautomaten (weltweit)" | **Nein.** Charmant, aber ein anderes Projekt. |
| Wien als Vorbild für offene Daten | **Übernommen im Prinzip**, nicht in der Quelle. |

Nicht auf der Liste von 2012, aber heute da: die gemeldeten Ordnungsamt-Sichtungen
und die Heatmap der Kontrolldichte.

## Das Original

Wortlaut wie 2012, nur um die personenbezogenen Angaben gekürzt. Links stehen
so, wie sie damals notiert wurden; fast alle sind inzwischen tot.

```text
Parkraumbewirtschaftung Übersicht (http://www.stadtentwicklung.berlin.de/verkehr/lenkung/behoerden/de/bezirke.shtml#adressen)

Anstatt Google Maps zu benutzen lieber OpenStreetMap?
Google Polyline: http://gmaps-samples-v3.googlecode.com/svn/trunk/poly/poly_edit.html
Parkhäuser (http://www.berlin.de/special/auto-und-motor/adressen-und-service/893408-605935-4a6d6ffb.html)
Park & Ride (http://www.vbbonline.de/index.php?cat=1&sCat=9&par=486&area=Berlin)
Parkgebühren mit dem Handy bezahlen (http://www.mobil-parken.de/cms/berlin.html)
Tarifübersichert (http://www.mobil-parken.de/cms/tarifuebersicht.html)
Hotline für abgeschleppte Fahrzeuge Unter der Rufnummer (030) 4664-98 7800 erfahren Sie, ob und wohin Ihr Auto umgesetzt wurde.
Umgesetzte und sichergestellte Fahrzeuge (http://www.berlin.de/polizei/service/ausfast.html)
Kosten der Umgesetzten Fahrzeuge (http://www.berlin.de/polizei/verkehr/umsetzung.html)
GPS Position speichern um das Auto wieder zu finden.
Überblick über die Parkraumzonen in Mitte (http://www.berlin.de/ba-mitte/org/sga/strassenbau/parken_karte_gesamt.html)
Parkzonen Berlin bei Google Maps als KML (http://maps.google.de/maps/ms?msid=...)
CarSharing
Fahrradverleistationen
Parkhäuser (http://www.vmzberlin.de/)
Umweltzone
Foto hochladen vom Partkautomat wg. der Parktkosten-Daten
Fotoalbum vom Parkautomaten (weltweit)
Ortsteile Geometrien Berlin (http://daten.berlin.de/datensaetze/ortsteil-geometrien-berlin)
Geo-Tools (http://docs.geotools.org/latest/userguide/tutorial/quickstart/index.html)
KML to MySQL (http://blog.thecodingfrog.com/2009/09/kml-kmz-import-into-mysql-for-use-with.html)
SQL Query: SELECT polygon_id, name FROM tbl_demo_polygons WHERE MBRContains(polygon,GeomFromText('POINT(52.554646 13.461582)'))
Notifizierung wenn der Parkschein abgelaufen ist.
Wien (http://data.wien.gv.at/)
Berlin:
http://opendataberlin.wordpress.com/
http://berlin.opendataday.de/
http://opendata-network.org/
http://offenedaten.de/dataset

http://www.geoportal.de/

E-Mobilität (Ladestationen in Berlin)
http://daten.berlin.de/datensaetze/emobility-ladestationen-berlin

JavaScript GeoLib: https://github.com/manuelbieh/geolib

FIS Broker
http://fbinter.stadt-berlin.de/fb/index.jsp?loginkey=showMap&mapId=parkraumbewirt@senstadt
Kontakt: [zwei namentliche Ansprechpartner der Senatsverwaltung — entfernt]

http://fbinter.stadt-berlin.de/fb/berlin/service.jsp?id=parkraumbewirt@senstadt&type=WMS
http://fbinter.stadt-berlin.de/fb/wms/senstadt/parkraumbewirt?REQUEST=GetCapabilities&SERVICE=WMS&VERSION=1.1.1&browser=true
```

Der FIS-Broker, mit dem die Liste endet, ist übrigens der Vorläufer genau der
Schnittstelle, aus der die App heute ihre Daten zieht. Der Weg von dieser Datei
zur heutigen `zones.geojson` ist kürzer, als vierzehn Jahre vermuten lassen.
