# Architektur

## Überblick

```mermaid
flowchart TB
    subgraph quellen["Geodateninfrastruktur Berlin · WFS 2.0.0 · DL-DE/Zero-2.0"]
        Q1["parkzonen<br/>103 Zonen"]
        Q2["parkplaetze<br/>45.917 Segmente"]
        Q3["park_and_ride<br/>49 + 59 Anlagen"]
        Q4["behindertenparkplaetze<br/>923 Standorte"]
        Q5["umweltzone<br/>1 Polygon"]
        Q6["alkis_ortsteile<br/>97 Ortsteile"]
    end

    subgraph build["Buildzeit"]
        F["ingest/fetch<br/>lädt, prüft Umfang"]
        B["ingest/build-data<br/>parst, aggregiert, vereinfacht"]
        C["core<br/>Parser + Domänenlogik"]
        A["ingest/build-artifact<br/>bündelt alles in eine Datei"]
    end

    subgraph laufzeit["Laufzeit"]
        W["apps/web<br/>React 19 · MapLibre GL 5"]
        S["Sichtungs-Backend<br/>db-Capability oder Worker"]
    end

    Q1 & Q2 & Q3 & Q4 & Q5 & Q6 --> F --> B
    C -.->|"parst zeiten/gebuehr"| B
    B -->|"zones · poi · districts<br/>umweltzone · meta"| W
    B --> A --> W
    C -.->|"Tarif · Feiertage · Geo"| W
    W <--> S
```

Die dicke Trennlinie liegt zwischen Build- und Laufzeit. Alles, was aus einer
fremden Quelle kommt, wird beim Bauen geprüft und eingefroren — nicht im Browser
des Nutzers.

## Warum die Daten eingefroren werden

Der naheliegende Einwand: Warum nicht live abfragen? Vier Gründe, in dieser
Reihenfolge:

1. **Größe.** Der Segment-Layer ist ~49 MB. Was die App davon braucht — Kapazität
   und Höchstparkdauer je Zone — sind wenige Kilobyte Aggregat.
2. **Offline.** Eine Parkplatzsuche endet oft im Funkloch einer Tiefgarage.
3. **Reproduzierbarkeit.** Ein Build von heute lässt sich morgen identisch
   wiederholen.
4. **Rücksicht.** Jede Live-Abfrage trifft die Infrastruktur einer Behörde.

**Nicht** der Grund ist CORS: `gdi.berlin.de` sendet
`Access-Control-Allow-Origin: *`. Eine frühere Fassung dieser Datei behauptete
das Gegenteil; die Messung widerlegt es.

Die Daten altern langsam. Zonengrenzen und Tarife ändern sich über Monate — die
neuen Zonen 58 und 68 in Friedrichshain-Kreuzberg brauchten ein ganzes Frühjahr.
Ein nächtlicher Rebuild ist frischer als die Quelle sich bewegt.

## Paketgrenzen

```mermaid
flowchart LR
    core["packages/core<br/>keine Laufzeit-Abhängigkeit"]
    ingest["packages/ingest<br/>Node"]
    web["apps/web<br/>Browser"]
    api["apps/api<br/>Cloudflare Worker"]

    ingest --> core
    web --> core
    api -.->|"gleiche Regeln,<br/>eigene Implementierung"| core

    style core fill:#1d4ed8,color:#fff
```

`core` kennt weder React noch Node noch MapLibre. Das ist keine Ästhetik: Die
Tarifberechnung ist der Teil, bei dem ein Fehler den Nutzer Geld kostet, und sie
soll ohne Browser prüfbar sein — 62 Unit-Tests laufen in 1,5 Sekunden.

Ein späterer nativer Client wäre ein zusätzliches Frontend gegen dasselbe `core`,
kein Rewrite.

## Der schwierige Teil: halbstrukturierte Quelldaten

Der Feed liefert Zeiten und Gebühren als **Freitext**. 28 verschiedene
Schreibweisen über beide Berliner Dienste für rund zehn tatsächliche Fahrpläne:

```
Mo-Fr 9-20 Uhr / Sa 9-18 Uhr      Mo-Fr 09:00-20:00 Uhr, Sa 09:00-18:00 Uhr
Mo-Sa, 9-22 Uhr                   Mo-Sa / 9-20 Uhr
Mo-Fr 9-20 / Sa 9-18 Uhr          Mo-Sa 9-22 UhrMo-Sa 9-22 Uhr
Mo-Fr 9-17 Uhr, Sa 9 -14 Uhr/ Advents-Sa 9 -17 Uhr
```

Der zentrale Fallstrick: **`/` und `,` sind überladen.** In
`Mo-Fr 9-20 Uhr / Sa 9-18 Uhr` trennen sie zwei Klauseln, in `Mo-Sa / 9-20 Uhr`
trennen sie Tagesangabe und Uhrzeit derselben Klausel. Ein Split am Trennzeichen
zerstört vier Zonen. Der Parser sucht deshalb nach vollständigen
Tag-plus-Zeit-Klauseln und behandelt jeden Rest als Fehler.

```mermaid
flowchart TD
    IN["Rohstring aus dem Feed"] --> LEN{"länger als<br/>200 Zeichen?"}
    LEN -->|ja| ERR["ScheduleParseError"]
    LEN -->|nein| DUP["Selbstverdopplung<br/>zusammenfalten"]
    DUP --> SCAN["Klauseln scannen<br/>(Tag + Zeitbereich)"]
    SCAN --> ADV{"Advents-<br/>Präfix?"}
    ADV -->|ja| UNM["als nicht<br/>modellierte Regel<br/>ausweisen"]
    ADV -->|nein| WIN["ChargeWindow"]
    SCAN --> REST{"Rest außer<br/>Trennzeichen?"}
    REST -->|ja| ERR
    REST -->|nein| OK["ParsedSchedule"]
    WIN --> OK
    UNM --> OK

    style ERR fill:#b4232a,color:#fff
    style OK fill:#1a7f37,color:#fff
```

Ein Fehler bricht den **Datenbuild** ab, nicht erst die Laufzeit. Eine still
falsch geparste Zone würde jemandem einen Preis nennen, für den er ein Knöllchen
bekommt.

## Was bewusst nicht berechnet wird

| Fall | Warum nicht | Was die App stattdessen tut |
| --- | --- | --- |
| `Advents-Sa` (Zonen 10–13) | Die Quelle definiert nicht, welche Samstage gemeint sind | Status „unsicher", Hinweis auf den Automaten |
| Gebührenspanne `2,00-3,00 Euro` | Kein Wert ist für die ganze Zone richtig | Zeigt die Spanne, nie einen Mittelwert |
| Höchstparkdauer | Auf 1–2 % der Abschnitte gesetzt, nicht zonenweit | Nennt den Wert samt tatsächlicher Abdeckung |
| Bewohnerparkausweis | Nicht in den Daten | Sagt, dass der Preis für Besucher gilt |

Der gemeinsame Nenner: Lieber eine Lücke benennen als sie plausibel füllen.

## Zeitrechnung

Parkregeln stehen in lokaler Wanduhrzeit („Mo–Sa 9–20"). Berlin hat Sommerzeit,
also ist ein UTC-Vergleich ein halbes Jahr lang falsch. Die Umrechnung läuft über
`Intl.DateTimeFormat` mit `timeZone: 'Europe/Berlin'` — ohne Datumsbibliothek,
weil Temporal auf Node 22 noch nicht stabil ist.

Feiertage sind kein Detail: **Ein Werktagsfeiertag zählt wie Sonntag,
gebührenfrei.** Ohne diese Regel sagt die App am Karfreitag „zahlen". Bewegliche
Feiertage kommen aus dem Gregorianischen Osteralgorithmus; die feste Liste
enthält den 8. März (Berliner Besonderheit) und **nicht** Reformationstag oder
Buß- und Bettag.

Eine Zone widerlegt die naheliegende Vereinfachung: **Zone 29 in Mitte ist
`Mo-So 9-24 Uhr`** und kassiert sonntags. Eine pauschale Sonntagsregel meldete
dort „gebührenfrei" und schätzte 0 € für einen Aufenthalt, der 4 €/h kostet.

## Sichtungen

Nach dem Vorbild von blitzer.de, nicht von FreiFahren: Meldungen landen auf
freien Koordinaten, nicht auf Knoten eines Liniennetzes. Es gibt also keine Linie,
auf die man eine Bewegungsrichtung projizieren könnte — die Bestätigung durch
andere ist das einzige verfügbare Signal.

```
Konfidenz = Zustimmungsverhältnis × Zeitverfall

  Zustimmung = (Bestätigungen + 1) / (Bestätigungen + Widersprüche + 2)
  Verfall    = 0,5 ^ (Alter / 30 min)
  Cutoff     = 90 min, danach hart 0
```

Die Laplace-Glättung ist der Punkt: Eine frische Meldung ohne Rückmeldung landet
bei 0,5 — ein Vielleicht, keine Tatsache. Der Schwellwert für „bestätigt" liegt
bei 0,62, nicht 0,6: Der häufige Fall „zwei bestätigen, einer widerspricht"
ergibt exakt 3/5, und ein Schwellwert genau auf einem häufigen Wert entscheidet
echte Meldungen per Float-Vergleich.

## Zwei Datensätze für zwei Fragen

„Steht gerade jemand da?" und „wo wird oft kontrolliert?" sehen verwandt aus und
brauchen gegensätzliche Aufbewahrung. Statt die Sichtungen länger zu halten,
schreibt eine Meldung eine zweite, gröbere Zeile:

```
Meldung ──┬─► Sichtung   {lon, lat, Zeit, Zähler}   ~10 m · 5 min · 90 Minuten
          └─► Strichliste {Tag, Zelle}              250 m · Tag  · 28 Tage
```

Die Strichliste trägt keine ID der Sichtung und keinen Client-Hash — sie lässt
sich nicht zurückverfolgen, und zwei Striche desselben Tages sind untereinander
nicht verknüpfbar. Was entsteht, ist ein Histogramm, kein Weg.

Das Raster ist metrisch und hat einen **festen Ursprung**: ein aus den Daten
abgeleiteter Ursprung würde dieselbe Straße nach jedem Deploy in eine andere
Zelle legen. Aus demselben Grund ist die Rasterfunktion die einzige Regel, die
der Worker aus `core` importiert statt sie nachzubauen — eine um einen Meter
abweichende zweite Implementierung würde vier Wochen Striche still auf
Nachbarzellen streuen.

Zwei Dinge zeigt die Ebene bewusst nicht: Sie bleibt leer, solange weniger als
zwölf Meldungen im Fenster liegen — eine Heatmap aus vier Punkten sieht nach
Wissen aus und ist Rauschen. Und sie färbt **relativ** zur meistgemeldeten
Stelle, nie absolut: ohne bekannte Nutzerzahl sagt eine absolute Häufigkeit
nichts.

Der Radius ist in Bildschirmpunkten angegeben, nicht in Metern. Der erste Versuch
zeichnete die echten 250 m — bei Stadtzoom unter drei Pixel, also eine unsichtbare
Ebene. Die Zahlen, die die Farbe nicht tragen kann, stehen im Panel daneben.

## Backends

```mermaid
flowchart LR
    W["apps/web"] --> D{"Welcher<br/>Speicher?"}
    D -->|"VITE_API_BASE gesetzt"| CF["Cloudflare Worker<br/>D1 + KV"]
    D -->|"als Artifact publiziert"| AR["db-Capability<br/>geteilt"]
    D -->|"sonst"| LS["localStorage<br/>nur dieses Gerät"]
```

Drei Möglichkeiten, eine Schnittstelle (`subscribe` / `report` / `vote`). Die
Oberfläche sagt, welche gerade gilt — „Geteilt" oder „Nur auf diesem Gerät" —
statt geteilten Zustand vorzutäuschen, den es nicht gibt.

Eine frühere Fassung presste die REST-Variante in die Form des Dokumentspeichers
und verlor dabei die Richtung einer Stimme: Jedes „weg" wurde als „gesehen"
gesendet.

## Zwei Fehler, die nur im echten Build auftreten

Beide wurden erst durch das Ausführen der gebauten App gefunden, nicht beim
Lesen des Codes:

**Der Kartencontainer hatte Höhe 0.** `maplibre-gl.css` setzt
`.maplibregl-map { position: relative }` bei gleicher Spezifität wie die eigene
Regel und wurde danach importiert — es gewann auf Reihenfolge.

**MapLibre wandelt verschachtelte GeoJSON-Properties in Strings.** Ein Klick
las `windows` als Array, bekam Text, und ohne Error Boundary riss das die ganze
App mit. Die geparste Zone lag die ganze Zeit im Speicher; der Klick schlägt sie
jetzt per ID nach.

## Herkunft

Das Repository begann 2012 als Java/Spring-Anwendung. Die liegt unverändert
unter `ParkingZone/` und wird nicht gebaut. Zwei Befunde aus dem Altcode haben
den Neubau geprägt:

Die Zonendaten waren **von Hand gezeichnet** — der Commit heißt wörtlich
`ParkZonen invented`, mit Polygonen namens „Schwierige Parkplatzsituation".

Koordinaten waren **durchgängig vertauscht**: `new Coordinate(lat, lng)` erwartet
in JTS `(x=lon, y=lat)`, und das Importskript drehte jeden Punkt beim Einlesen
ein zweites Mal. Zwei Fehler, die sich aufhoben. Ein Test in `geo-real.test.ts`
prüft heute explizit, dass vertauschte Koordinaten **nichts** finden.
