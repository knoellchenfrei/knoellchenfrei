# Düsseldorf als weitere Stadt — gemessen, entschieden, offen

> **Stand 8. September 2026.** Parser, Tests, Fixtures und Datenbau liegen im
> Arbeitsbaum; angeschlossen ist Düsseldorf damit **noch nicht**. Was dafür
> fehlt, steht unten in Abschnitt 4 — vier Dateien, die dieser Arbeitsschritt
> bewusst nicht angefasst hat.

Alle Zahlen hier sind an diesem Tag gegen die Dienste selbst gemessen, nicht
aus [staedte-recherche-2026-09.md](staedte-recherche-2026-09.md) übernommen.
Der Unterschied ist diesmal kein Detail: Die Recherche beschreibt einen
anderen, älteren und kleineren Datenbestand als den, der wirklich da ist.
Abschnitt 2 zählt die Abweichungen einzeln auf.

Vorbild in Umfang und Ton ist [staedte-koeln.md](staedte-koeln.md).

## 1. Was gemessen wurde

### Der Dienst, den die Recherche nicht kennt

Düsseldorf hat einen **WFS 2.0.0**, und zwar zwei. Die Recherche nennt nur
statische Dateien im offenen Datenportal.

| | |
| --- | --- |
| **Verkehrsthemen** | `https://maps.duesseldorf.de/services/verkehr/wfs`, 17 Ebenen |
| **Grenzen** | `https://maps.duesseldorf.de/services/grenzen/wfs`, 3 Ebenen |
| Ausgabeformat | `application/json` (GeoServer-Form, wie Berlin, Frankfurt und München) |
| `DefaultCRS` | `urn:ogc:def:crs:EPSG::25832` bei **jeder** Ebene — `srsName` ist Pflicht |
| Achsenreihenfolge | `[lon, lat]`, gemessen; siehe unten |
| Herausgeber | Landeshauptstadt Düsseldorf, Vermessungs- und Katasteramt (`maps@duesseldorf.de`), Datenpflege Amt für Verkehrsmanagement |
| `ows:Fees` / `ows:AccessConstraints` | beides `NONE` — und das ist **keine** Lizenz |

Gefunden wurde er nicht durch Raten von Adressen, sondern über den
Portal-Datensatz „Allgemeine Behindertenparkplätze in Düsseldorf": Dessen
Distributionen sind wörtlich zwei Aufrufe dieses WFS. Erst danach war klar,
dass es ihn gibt. Geratene Namen brachten vorher `maps.duesseldorf.de/geoserver`
und `geodaten.duesseldorf.de` (404 beziehungsweise gar keine Auflösung) — der
Weg über den Katalog ist derselbe wie bei Frankfurts Stadtteilen und Münchens
Stadtbezirken.

### Die Ebenen, gezählt mit `resultType=hits`

| Typname | `numberMatched` | genommen |
| --- | --- | --- |
| `verkehr:bewohnerparken` | **65** (= 44 Gebiete) | ja |
| `verkehr:parkscheinautomaten` | **732** | Zeiten ja, Betrag nein — siehe Abschnitt 3 |
| `verkehr:behindertenparkplatz` | 340 | ja, als POI |
| `verkehr:park_ride` | 48 | ja, als POI |
| `verkehr:umweltzone` | 1 | ja |
| `grenzen:stadtteile` | 50 | ja |
| `grenzen:stadtbezirke` | 10 | nein — 50 Stadtteile verorten feiner |
| `grenzen:stadtgrenze` | 1 | nur zur Messung der Box |
| `verkehr:parkhaus` | 44 | nein |
| `verkehr:quartiersgaragen` | 77 | nein |
| `verkehr:feierabendparken` | 25 | nein |
| `verkehr:sharingstationen_point` | 331 | nein — siehe Abschnitt 3 |
| `verkehr:mobilitaetsstation` | 32 | nein |
| `verkehr:motorradstellplatz` | 12 | nein |

Nicht gezählt: `bahnhof`, `flughafen`, `lichtzeichenanlagen`,
`sharing_parkverbotszone`, `sharingstationen_area`, `verkehrsueberwachung`.
Sie beantworten andere Fragen als „was kostet Parken hier".

### `srsName` ist Pflicht, und das Ergebnis ist nachgemessen

Dreimal dieselbe Anfrage an `verkehr:bewohnerparken`, nur der `srsName`
verschieden:

| Anfrage | `crs` der Antwort | erste Koordinate | Bytes |
| --- | --- | --- | --- |
| **ohne** `srsName` | `urn:ogc:def:crs:EPSG::25832` | `[345550.30, 5676562.02]` | 303.715 |
| `srsName=EPSG:4326` | `urn:ogc:def:crs:EPSG::4326` | `[6.78833837, 51.21952816]` | 224.287 |
| `srsName=urn:ogc:def:crs:EPSG::4326` | `urn:ogc:def:crs:EPSG::4326` | `[6.78833837, 51.21952816]` | 224.287 |

Zwei Befunde daraus:

1. **Ohne den Parameter kommen UTM-Meter** — dieselbe Falle wie in Frankfurt
   und München. Anders als dort beschriftet Düsseldorf sie ehrlich, was aber
   nichts hilft: `345550` und `5676562` sind plausible Zahlen, nur keine Grade,
   und die Karte sähe dabei nur leer aus. `wfsUrl` setzt den Parameter,
   `assertDegrees` im Datenbau misst trotzdem nach.
2. **Die Beschriftung der Antwort ist falsch.** Der Dienst schreibt
   `urn:ogc:def:crs:EPSG::4326` an die Geometrie — die URN-Form, die die
   **Breite zuerst** vorschreibt, und genau die, an die Hamburg sich hält — und
   liefert dann `[lon, lat]`. Wer der Beschriftung glaubt und dreht, legt
   Düsseldorf bei 6° Nord, 51° Ost ab, im Golf von Guinea. Die Achsenreihenfolge
   gehört deshalb auch hier in die Konfiguration und wird nicht aus dem
   `crs`-Feld gelesen.

`wfsUrl` aus `ingest/sources.ts` funktioniert unverändert; beide Dienste
akzeptieren die Form mit `typeNames` und URL-kodiertem `srsName`.

### 65 Merkmale sind 44 Gebiete

Die wichtigste Falle dieses Feeds. `verkehr:bewohnerparken` liefert 65
Merkmale, aber nur **44** verschiedene `kuerzel` und 44 verschiedene `name`.
Elf Gebiete kommen in mehreren Stücken:

```
O (Immermannstraße) 8×, N (Friedrichstadt) 4×, L (Klosterstraße) 3×,
LP (Lessingplatz) 3×, HO, R, GS, MÜ, B, CH, V je 2×
```

Jedes Stück hat eine eigene `_uuid` und **dieselben** Sachdaten — nachgemessen
über alle 65, kein einziger Widerspruch. Wer auf `_uuid` gruppiert, liefert 65
Zonen aus, davon 21 Doppelgänger mit demselben Namen; auf der Statistikseite
stünde Immermannstraße achtmal. Die Identität eines Gebiets ist `kuerzel`. Ein
Test hält das gegen die Fixture fest, und der Datenbau meldet laut, wenn zwei
Stücke eines Tages Verschiedenes sagen.

### Die Felder

**Gebiet** (`verkehr:bewohnerparken`, 65 Zeilen):

| Feld | Werte |
| --- | --- |
| `_uuid` | 65 verschiedene — Kennung des **Merkmals**, nicht des Gebiets |
| `name` | 44 verschiedene: `Altstadt`, `Unterbilk`, `Wersten - Düsseldörfchen` |
| `kuerzel` | 44 verschiedene: `A`, `MÜ`, `LB`, `NV` — der Buchstabe auf dem Schild |
| `zeitraum` | **12** Schreibweisen, keine leer |
| `url` | Sprungmarke in die Gebietsliste der Stadt, 44 verschiedene, lückenlos |
| `_last_update` | `2026-06-19` in allen 65 |

**Automat** (`verkehr:parkscheinautomaten`, 732 Zeilen):

| Feld | Werte |
| --- | --- |
| `psa_nr` | 732 verschiedene, als **Zeichenkette** (`"101"`), nicht als Zahl |
| `standort` | `Carlstor ggü. 2` — 731 verschiedene, oft mit angehängtem Leerzeichen |
| `tarifzeiten` | **drei**: `Werktags 09:00 - 20:00` (549), `Werktags 09:00 - 22:00` (174), `Täglich 07:00 - 20:00` (9) |
| `tarifgebuehr` | **drei**: `4,50 € pro Stunde` (439), `3,00 € pro Stunde` (284), `2,00 € pro Stunde` (9) |
| `hoechstparkzeit` | `ohne` (558), `2 h` (174) |
| `kartenzahlung_moeglich` | `ja` (339), leer (372), `null` (21) — drei Zustände, zwei ohne Bedeutung |
| `app_sms_zone` | elf Werte, `402100`–`402109` und `404771` — Zone der Park-App, nicht des Bewohnerparkens |
| `email` | Störungsadresse mit `?subject=` daran |
| `_last_update` | `2026-05-19` in allen 732 |

Das ist, gemessen an den vier angeschlossenen Städten, der **sauberste Feed des
Projekts**: drei Zeitschreibweisen gegen Berlins 18, Hamburgs 10, Frankfurts 30
und Münchens 291.

### Die zwölf Schreibweisen von `zeitraum`

```
33  werktags, 9 bis 20 Uhr
14  werktags, 9 bis 22 Uhr
 4  montags bis sonntags, 24 Stunden
 3  montags bis sonntags, 11 bis 15 Uhr
 2  werktags, 9 bis 20 Uhr / teils 9 bis 22 Uhr
 2  montags bis freitags, 9 bis 15 Uhr
 2  montags bis sonntags, 7 bis 20 Uhr
 1  sonntags, 10 bis 17 Uhr
 1  montags bis sonntags, 8 bis 18 Uhr
 1  montags bis sonntags, 1 bis 15 Uhr
 1  montags bis sonntags, 10 bis 17 Uhr
 1  m bis fr, 8 bis 18 Uhr, sa 8 bis 14 Uhr
```

Vier davon sind eigene Fälle:

**Das Komma ist Trenner und Bindeglied zugleich.** In `werktags, 9 bis 20 Uhr`
verbindet es die Tagesangabe mit der Spanne; in
`m bis fr, 8 bis 18 Uhr, sa 8 bis 14 Uhr` trennt das mittlere zwei Klauseln —
und die alte Schreibweise derselben Regel,
`montags bis freitags, 8 bis 18 Uhr, samstags, 8 bis 14 Uhr`, tut beides
zweimal. Das ist wörtlich Kölns Problem mit dem `+`, nur mit einem anderen
Zeichen. Wer stur an `,` splittet, bekommt Bruchstücke, von denen das eine
keine Zeit und das andere keine Tage hat. Aufgelöst wird es durch die Form,
nicht durch eine Heuristik: Eine Klausel ist `Tagesangabe [,] Spanne`, und der
Abtaster läuft lückenlos über die Zeichenkette, so dass am Ende nichts
unbesehen liegen bleibt.

**Ein einzelnes `m` für Montag.** Hasselsstraße ist die einzige Zeile mit
Abkürzungen, und sie kürzt Montag auf einen Buchstaben. Das ist genau die
Lage, in der Münchens Parser zweimal gescheitert ist: Ohne hintere Wortgrenze
fände `m` das „m" in **mittwochs** und `so` das „so" in **sonntags**. `\b`
taugt dafür nicht, weil `sa 8 bis 14 Uhr` zwischen Buchstabe und Ziffer keine
braucht; richtig ist `(?![\p{L}])`. Und in der Alternative steht die lange Form
vor der kurzen, sonst liest der Ausdruck aus `montags` ein `mo`.

**`24 Stunden` statt einer Spanne.** Vier Gebiete — Christophstraße,
Moorenplatz, Moorenstraße und im Dateiabzug auch Kaiserswerth. Als 0–0
gespeichert hieße das „nie", also das genaue Gegenteil.

**`sonntags, 10 bis 17 Uhr`.** Lichtenbroich, das Gebiet an der Arena
(Rhein-Fire-Straße), ist **nur sonntags** bewirtschaftet. Das ist Berlins Zone
29 in umgekehrter Richtung und der Beleg dafür, dass eine pauschale
Sonntagsregel im Tarifmodell falsch wäre — sie ist dort auch keine.

### Der Dateiabzug ist überholt

Die Recherche stützt sich auf `Bewohnerparken_2025_0.geojson` im offenen
Datenportal. Die Datei existiert, ist 221.335 Bytes groß, trägt intern
`timeStamp: 2025-12-11T10:28:54Z` und in allen 44 Merkmalen
`_last_update: 2024-12-06`. Der Dienst sagt heute `2026-06-19`. Gegenüber der
Datei haben **18 der 44 Gebiete** eine andere Zeitangabe, und drei, die in der
Datei `zeitraum: null` tragen, haben jetzt eine:

| Gebiet | Datei, 11.12.2025 | Dienst, 8.9.2026 |
| --- | --- | --- |
| Altstadt, Altstadt-Nord, Immermannstraße, Klosterstraße, Pempelforter Straße | `werktags, 9 bis 20 Uhr` | `werktags, 9 bis 22 Uhr` |
| Friedrichstadt, Inselstraße, Venloer Straße, Blücherstraße, Derendorfer Straße | `montags bis freitags, 9 bis 20 Uhr` | `werktags, 9 bis 20 Uhr` |
| Oberkassel Ost/West, Niederkassel | `montags bis freitags, 8 bis 20 Uhr` | `werktags, 9 bis 20 Uhr` |
| Neuwerker-, Viersener Straße | `montags bis freitags, 9 bis 16 Uhr` | `werktags, 9 bis 20 Uhr` |
| Daimler | `montags bis sonntags, 24 Stunden` | `werktags, 9 bis 20 Uhr` |
| Kaiserswerth | `montags bis sonntags, 24 Stunden` | `montags bis sonntags, 7 bis 20 Uhr` |
| Unterrath - West | `montags bis sonntags, 11 bis 15 Uhr` | `montags bis sonntags, 8 bis 18 Uhr` |
| Flughafen | `montags bis sonntags, 11 bis 15 Uhr` | `montags bis sonntags, 1 bis 15 Uhr` |
| Unterbilk | `montags bis freitags, 9 bis 18 Uhr / teilweise …, 9 bis 23 Uhr*` | `werktags, 9 bis 20 Uhr / teils 9 bis 22 Uhr` |
| Hasselsstraße | `montags bis freitags, 8 bis 18 Uhr, samstags, 8 bis 14 Uhr` | `m bis fr, 8 bis 18 Uhr, sa 8 bis 14 Uhr` |
| Ahnfeldstraße, Feuerbachstraße, Schillerplatz | `null` | `werktags, 9 bis 20 Uhr` |

Wer aus der Datei baut, sagt in fünf Innenstadtgebieten „ab 20 Uhr frei", wo
seit dem Sommer bis 22 Uhr kassiert wird. Das kostet ein Knöllchen. Der
Dienst gewinnt.

Die CSV (`Bewohnerparken_2025.csv`, 2.168 Bytes, 44 Zeilen, UTF-8 mit CRLF) ist
inhaltlich mit dem GeoJSON identisch — Feld für Feld nachgemessen, null
Abweichungen. Anders als in Köln hat sie **keine** eingebetteten Trennzeichen
und keine Anführungszeichen; ein `split(';')` wäre hier ausnahmsweise
unschädlich. Gebraucht wird sie trotzdem nicht.

### Die Zuordnung Automat → Gebiet

Über die Geometrie, und hier gibt es gar keine Wahl: Der Automat nennt kein
Gebiet. `app_sms_zone` hat elf Werte für 44 Gebiete und ist die Zone der
Park-App, nicht des Bewohnerparkens.

```
622 von 732 Automaten einem Gebiet zugeordnet
110 liegen in keinem Gebiet
 19 liegen in zweien
 29 von 44 Gebieten haben mindestens einen Automaten
 15 haben keinen
```

Die 110 außerhalb sind kein Fehler: Düsseldorf bewirtschaftet auch außerhalb
der Bewohnerparkgebiete, und für diese Flächen führt der Dienst kein Polygon.
Das ist die wichtigste inhaltliche Grenze des Bestands — dieselbe wie in Köln
(288 von 2.315) und Frankfurt (113 von 921).

### Zwei Gebiete überlappen sich wirklich

Ein Rastertest über die gesamte Fläche der 44 Gebiete, 10-Meter-Zellen:

```
Gesamtfläche der Gebiete (Vereinigung):  14,23 km²
davon in mehr als einem Gebiet:           0,0502 km² = 0,35 %
und zwar ausschließlich: Blücherstraße (S) / Derendorfer Straße (W)
```

Vier weitere Paare (G/S, OK/Z, P/W, C/Q) haben Stützpunkte im jeweils anderen
Polygon, aber **keine** gemeinsame Fläche — das sind geteilte Grenzen, kein
Überlapp.

S/W ist echt und aus zweiter Quelle bestätigt: Die Straßenliste der Stadt führt
**Eulerstraße** und **Prinz-Georg-Straße** in beiden Gebieten, bei der
Eulerstraße sogar mit überlappenden Hausnummern (S: `2-46, 3-45`, W: `2–46,
3–51`). Der Streifen liegt bei 6,7864–6,7881 / 51,2327–51,2439, also rund
1,2 km lang und 120 m breit. Beide Gebiete nennen **dieselbe** Zeitangabe, die
Antwort der App hängt also nicht daran, welches `zoneAt` zuerst findet. Der
Datenbau zählt die Fälle trotzdem (19 Automaten), damit ein Auseinanderlaufen
auffällt.

### Stadtteile und Box

`grenzen:stadtteile` liefert 50 Stadtteile mit `name`, `stadtteil` (Nummer) und
`stadtbezirk`. **44 von 44 Gebieten** treffen über ihren Mittelpunkt einen
Stadtteil, verteilt auf 22 verschiedene. Ein Rückfall auf „Düsseldorf" als
Bezirk ist nicht nötig.

Ein Fallstrick dabei, der nach einem Fehler aussieht und keiner ist: Das
Bewohnerparkgebiet **Niederkassel** liegt vollständig im Stadtteil
**Oberkassel**. Beide Angaben sind richtig; die Stadt hat das Gebiet nach der
Straße benannt, nicht nach dem Stadtteil.

Zwei Rahmen, gemessen:

```
Stadtgrenze (grenzen:stadtgrenze):   6,6888–6,9399 / 51,1244–51,3525
44 Bewohnerparkgebiete:              6,7275–6,8742 / 51,1733–51,3027
```

Die Box gehört aus der **Stadtgrenze**, nicht aus den Gebieten — dieselbe
Begründung wie in Köln und München: Wer sie aus den Parkflächen nähme, wiese
eine Meldung aus Garath oder Kalkum als „außerhalb" ab, obwohl dort
bewirtschaftet werden kann und nur kein Bewohnerparkgebiet liegt.

### Der Probelauf

```
Düsseldorf — Daten bauen …
  districts.geojson: 52 KB
  zones.geojson: 60 KB
  poi.geojson: 67 KB
  umweltzone.geojson: 16 KB
  meta.json: 0 KB

44 Gebiete aus 65 Merkmalen (21 Stücke zusammengelegt, 0 widersprüchlich),
  0 ohne Stadtteil-Treffer
622 von 732 Automaten einem Gebiet zugeordnet, 110 liegen in keinem, 19 in zweien
29 Gebiete mit Automaten, 15 ohne — davon 4 mit einem Fenster, das nur die
  Automaten nennen
Tarif gerechnet, aber NICHT ausgeliefert (Lizenz nicht belegt): 24 Gebiete mit
  einem Betrag, 5 mit einer Spanne
388 POI, 50 Stadtteile, 1 Umweltzone
```

In 25 der 29 Gebiete mit Automaten sagen Gebiet und Automat **dasselbe**
Zeitfenster; in vieren fügen die Automaten ein zweites hinzu. Genau diese vier
sind die, deren `zeitraum` ein „teils" trägt oder deren Innenstadtlage zwei
Tarifzeiten mischt (Unterbilk, Friedrichstadt, Hauptbahnhof-Ost, Pempelforter
Straße).

> **Wie dieser Lauf zustande kam.** `build-data-duesseldorf.ts` importiert aus
> `@knoellchenfrei/core` Namen, die es dort ohne die Einträge aus Abschnitt 4
> nicht gibt; es lässt sich deshalb heute weder übersetzen noch starten. Für
> den Probelauf lief eine Kopie mit **ausschließlich** umgeschriebenem
> Importblock (relative Pfade statt Paketname, `DUESSELDORF` als lokale
> Konstante mit genau den Werten aus Abschnitt 4). Der Rumpf ist Zeichen für
> Zeichen derselbe.

### Lizenz und Ansprechpartner

| | |
| --- | --- |
| Datensatz | „Bewohnerparkgebiete in Düsseldorf", <https://opendata.duesseldorf.de/dataset/bewohnerparkgebiete-d%C3%BCsseldorf> |
| Bezeichner | `aec4ca40-92b7-409b-8980-05b55253850e` |
| Lizenz | **Datenlizenz Deutschland Zero 2.0**, in allen vier Distributionen als `dcat-ap.de/def/licenses/dl-zero-de/2.0` |
| Herausgeber | `Landeshauptstadt Düsseldorf – Amt für Verkehrsmanagement` |
| Ansprechpartner | Open-Data-Team, `opendata@duesseldorf.de`; für die Dienste `maps@duesseldorf.de` |
| Portal-Nutzungsbedingungen | „Für die Datensätze gilt, soweit nicht anders gekennzeichnet, die Datenlizenz Deutschland - Zero - Version 2.0." |

Zero verlangt keine Nennung; der Quellenvermerk steht trotzdem, wie bei Berlin
und Köln — freiwillig ist nicht verboten.

**Eine gemischte Lizenz im selben Datensatz**, als Warnung für den, der weitere
Ebenen nimmt: Bei „Parkhäuser in Düsseldorf" stehen CSV, JSON und KML unter
Zero, die **GeoJSON-Distribution aber unter DL-DE/Namensnennung 2.0**. Die
Lizenz hängt an der Distribution, nicht am Datensatz.

### Feiertage: Nordrhein-Westfalen, mit Wortlaut

Der Beleg, der bei Köln noch gefehlt hat, liegt vor. Die Norm ist das *Gesetz
über die Sonn- und Feiertage* (SGV. NRW. 113). Die von der Aufgabe genannte
Adresse `recht.nrw.de/lmi/owa/br_bes_text?…` leitet auf eine JavaScript-Maske
um und gibt an einen Abruf nur Navigation heraus; das neue Portal legt die
konsolidierten Fassungen aber als **statisches HTML** ab, zu finden über
`recht.nrw.de/robots.txt` und den Sitemap-Index:

<https://recht.nrw.de/lrgv/gesetz/01012000-bekanntmachung-der-neufassung-des-gesetzes-ueber-die-sonn-und-feiertage>

Dort steht wörtlich, abgerufen am 8. September 2026:

> **§ 2 Feiertage**
>
> (1) Feiertage sind:
> 1. der Neujahrstag,
> 2. der Karfreitag,
> 3. der Ostermontag,
> 4. der 1. Mai als Tag des Bekenntnisses zu Freiheit und Frieden, sozialer
>    Gerechtigkeit, Völkerversöhnung und Menschenwürde,
> 5. der Christi-Himmelfahrts-Tag,
> 6. der Pfingstmontag,
> 7. der Fronleichnamstag (Donnerstag nach dem Sonntag Trinitatis),
> 8. der 3. Oktober als Tag der Deutschen Einheit,
> 9. der Allerheiligentag (1. November),
> 10. der 1. Weihnachtstag,
> 11. der 2. Weihnachtstag.

Elf Feiertage: die neun bundesweiten plus **Fronleichnam** (Ostersonntag + 60)
und **Allerheiligen** (1. November). Kein Reformationstag, kein Buß- und
Bettag, kein Frauentag.

**Keine gemeindeweise Regelung.** § 2 kennt keinen Vorbehalt wie Art. 1 Abs. 1
Nr. 2 BayFTG. Die einzige gemeindebezogene Vorschrift des Gesetzes ist § 8
Abs. 3, und sie betrifft **kirchliche** Feiertage — nach § 8 Abs. 1
ausdrücklich die Tage *außer* den in § 2 genannten, und sie werden nur nach § 5
Abs. 1 geschützt (Veranstaltungsverbot zur Gottesdienstzeit), nicht arbeitsfrei
gestellt. `City.holidays` bleibt für Düsseldorf also leer; ein
`Record<Land, …>`-Eintrag reicht.

Zusatzbeleg für die Verkündung: `recht.nrw.de/system/files/GV_Archiv/4122-xmmgvb8919.pdf`
(GV. NW. 1989 S. 222). Dort steht § 2 noch mit „der 17. Juni als Tag der
deutschen Einheit" und „der Buß- und Bettag"; beide sind durch die Gesetze vom
17. 4. 1991 und 20. 12. 1994 entfallen — die konsolidierte Fassung oben ist die
geltende.

### Wohin das abgeschleppte Auto kommt

Belegt auf <https://www.duesseldorf.de/ordnungsamt/verkehrueb/schlepp>, Stand
8. September 2026, wörtlich auf genau dieser Seite:

> Rufen Sie zuerst in der nächsten Polizeidienststelle an (Telefon 0211 870-0).
> […] Falls Sie dort nicht durchkommen sollten, können Sie auch bei der
> Leitstelle des Ordnungsamtes (Telefon 0211 89-94000) nachfragen.

Zuständig ist also das **Ordnungsamt**, nicht das Amt für Verkehrsmanagement.
Eine städtische Verwahrstelle gibt es nicht — die Fahrzeuge stehen beim
beauftragten Abschleppunternehmen.

## 2. Wo die Recherche falsch lag

[staedte-recherche-2026-09.md](staedte-recherche-2026-09.md) ist am
7. September entstanden und stützt sich für Düsseldorf allein auf das offene
Datenportal. Neun Punkte, jeder am 8. September gegen den Dienst gemessen.

1. **„Kein WFS. Statische Datei."** — Falsch. Es gibt zwei WFS 2.0.0 mit
   zusammen 20 Ebenen. Der Fehler ist verständlich: Das Portal verlinkt bei
   den Bewohnerparkgebieten nur Dateien. Nur bei den Behindertenparkplätzen
   *ist* die Distribution der WFS, und darüber war er zu finden.
2. **„Ein Parkscheinautomaten-Datensatz existiert für Düsseldorf nicht"** — Als
   Aussage über einen *katalogisierten Datensatz* stimmt das und ist am
   8. September nachgeprüft: `ckan.open.nrw.de` findet 23 Treffer zu
   „parkscheinautomaten", keiner davon aus Düsseldorf; GovData findet einen,
   und der ist OSM. Als Aussage über *Daten* ist es falsch:
   `verkehr:parkscheinautomaten` führt **732** Automaten mit Tarif, Tarifzeit
   und Höchstparkdauer. Genau diese Unterscheidung ist der Kern von Abschnitt 3.
3. **„Gebühr nein"** und in der Rangliste „geeignet mit Einschränkung — kein
   Betrag"** — Der Betrag ist da, dreifach gestaffelt: 4,50 €, 3,00 € und
   2,00 € je Stunde. Was fehlt, ist nicht der Wert, sondern der Lizenzbeleg.
   Die Einschränkung bleibt, aber aus einem anderen Grund — und dieser Grund
   lässt sich mit einer E-Mail ausräumen, der andere nicht.
4. **„Höchstparkdauer nein"** — Sie steht am Automaten: `2 h` in 174 Fällen,
   `ohne` in 558.
5. **„44 MultiPolygone"** — Der Dienst liefert **65 Merkmale** für 44 Gebiete.
   Die Datei fasst sie zusammen, der Dienst nicht. Wer den Dienst nimmt und die
   Zahl 44 erwartet, baut 21 Doppelgänger.
6. **„`_last_update` in allen 44 Merkmalen: 2024-12-06"** — Das stimmt für die
   Datei und ist zugleich der irreführendste Wert des ganzen Datensatzes: Die
   Datei selbst wurde am **11. Dezember 2025** erzeugt (ihr eigenes
   `timeStamp`-Feld), das Portal weist sie als am **8. Juni 2026** angepasst
   aus, und der Dienst sagt **19. Juni 2026**. Vier Daten, drei Bedeutungen.
   Inhaltlich sind 18 der 44 Zeitangaben seit der Datei geändert.
7. **„Zwölf Schreibweisen von `zeitraum`, drei davon `null`"** — Zwölf stimmt,
   aber es sind nicht dieselben zwölf, und **keine** ist mehr `null`. Die drei
   Lücken (Ahnfeldstraße, Feuerbachstraße, Schillerplatz) sind gefüllt.
8. **„Zwei Sonderfälle"** — Es sind drei. Der Sternchen-Fall lautet jetzt
   `/ teils 9 bis 22 Uhr` ohne Sternchen und betrifft zwei Gebiete statt
   einem; dazu kommt die abgekürzte Form
   `m bis fr, 8 bis 18 Uhr, sa 8 bis 14 Uhr`, die den Parser härter fordert als
   beide anderen zusammen.
9. **Nicht erwähnt, aber vorhanden:** Stadtteil- und Stadtbezirksgrenzen als
   eigener WFS, die Umweltzone als Polygon, 340 Behindertenparkplätze und 48
   P+R-Anlagen. Düsseldorf ist damit nach Berlin und München die dritte Stadt
   mit Umweltzonen-Geometrie im Abzug.

Eine Kleinigkeit noch, die niemandem schadet und trotzdem falsch ist: Die
Beschreibung des Datensatzes im Portal nennt die Spalten
`Bewohnerparkgebiet`, `Kennbuchstabe` und `Gültigkeit`. Der Kopf der CSV lautet
`name;kuerzel;zeitraum`. Wer den Kopf gegen die Beschreibung prüft — wie es der
Kölner Datenbau tut, aus gutem Grund —, bricht ab.

## 3. Entscheidungen und ihre Begründung

### Der Dienst gewinnt gegen die Datei

Begründet in Abschnitt 1: Die Datei ist in 18 von 44 Gebieten inhaltlich
überholt, und in fünf Innenstadtgebieten in der teuren Richtung. Der Preis
dafür ist, dass die 44 Gebiete aus 65 Merkmalen zusammengesetzt werden müssen.

### Gruppiert wird auf `kuerzel`, nicht auf `_uuid`

Siehe oben. Der Datenbau meldet laut, wenn zwei Stücke eines Gebiets
verschiedene Sachdaten tragen — heute tut das keines, und wenn es eines Tages
eines tut, ist das eine neue Aussage der Stadt und kein Grund, still das erste
Stück gewinnen zu lassen.

### `werktags` ist Montag bis Samstag — und der Beleg kommt aus dem Feed

Bei Hamburg stand für dieselbe Festlegung die Legaldefinition in § 3 Abs. 2
BUrlG und die Rechtsprechung des BGH. Düsseldorf liefert den Beleg selbst, und
er ist stärker als jede Auslegung: Der Feed führt **alle drei** Angaben
nebeneinander — `montags bis freitags`, `werktags` und `montags bis sonntags`.
Zwei davon sind vergeben; für `werktags` bleibt nur Montag bis Samstag übrig.
Wäre `werktags` gleich Montag bis Freitag, hätte der Dienst zwei Wörter für
dieselbe Menge und keines für Montag bis Samstag.

Die Gegenprobe liefert der Vergleich mit der Datei: Acht Gebiete, die im
Dezember `montags bis freitags` hießen, heißen jetzt `werktags`. Die Stadt hat
dort den Samstag hinzugenommen und dafür das Wort gewechselt.

Andersherum gelesen meldete die App an 47 der 65 Merkmale samstags
„gebührenfrei".

### Zwei Notationen, zwei Parser

Das Gebiet schreibt `werktags, 9 bis 20 Uhr`, der Automat zwanzig Meter daneben
`Werktags 09:00 - 22:00`. Dieselbe Behörde, dieselbe Art von Aussage, zwei
Schreibweisen. Ein gemeinsamer Parser müsste `werktags, 09:00 - 20:00`
ebenfalls annehmen — eine Schreibweise, die es nirgends gibt und deren
Bedeutung damit niemand geprüft hat. Getrennt bleibt jeder von beiden so eng,
wie seine Quelle wirklich ist; ein Test hält fest, dass keiner die Notation des
anderen durchwinkt.

### Die Fenster beider Ebenen werden vereinigt

`windowCovers` fragt ohnehin nur, ob *irgendein* Fenster passt. Die Vereinigung
ist damit die Richtung, in der ein Fehler eine überflüssige Warnung kostet und
kein Knöllchen. Sie ist auch die einzige Lesart, die den Zusatz „teils 9 bis 22
Uhr" auflöst: In Unterbilk stehen wirklich Automaten beider Tarifzeiten.

Was **nicht** passiert: benachbarte Fenster verschmelzen. `9–20` und `9–22` als
`9–22` auszugeben hieße, dem halben Gebiet zwei Stunden Gebührenpflicht
anzudichten, die dort niemand verlangt.

### Der Tarif wird gerechnet und nicht ausgeliefert

**Die folgenreichste Entscheidung, und sie hat nichts mit den Daten zu tun.**
`verkehr:parkscheinautomaten` liegt auf einem öffentlichen WFS, führt drei
saubere Tarife und steht am 8. September 2026 in **keinem Datenkatalog**: nicht
im Portal der Stadt, nicht in `ckan.open.nrw.de`, nicht in GovData. Sein
ISO-Metadatensatz im Geoportal NRW
(`74078052-8f33-44d9-8801-a275c3bb20d1`) enthält **keine**
`resourceConstraints` — kein Lizenzfeld, weder gefüllt noch leer. Der Dienst
selbst sagt `ows:Fees: NONE` und `ows:AccessConstraints: NONE`, und das heißt:
Er kostet kein Geld und beschränkt den Zugang nicht. Es heißt nicht, dass die
Daten unter einer offenen Lizenz stehen.

Die Portal-Nutzungsbedingungen („für die Datensätze gilt, soweit nicht anders
gekennzeichnet, DL-DE/Zero-2.0") helfen nicht: Sie gelten für Datensätze *auf*
opendata.duesseldorf.de, und dieser ist keiner.

Deshalb steht in `build-data-duesseldorf.ts`
`const AUTOMATS_LICENCE_CONFIRMED = false`. Solange er `false` ist, wird der
Betrag **gerechnet und ins Log geschrieben, aber nicht ausgeliefert**: `fee`
bleibt `unknown`, `rawFee` leer, `meta.json` trägt `fee` unter `absent`, und
`sourceDefect` sagt in einem Satz, dass die Stadt einen Tarif nennt und warum
er hier fehlt. Ohne diesen Satz hielte jemand, der den Dienst selbst öffnet,
die App für unvollständig — dieselbe Begründung wie in Köln, nur mit
umgekehrtem Vorzeichen: Dort *irrt* die Quelle, hier *schweigt der Katalog*.

Der Code ist fertig und getestet. Was fehlt, ist eine Antwort von
`opendata@duesseldorf.de` oder `maps@duesseldorf.de`; danach ist es eine Zeile.

Warum die **Zeiten** derselben Ebene trotzdem mitkommen: Die Gebiete sagen ihre
Zeiten selbst, aus einer Ebene mit belegter Lizenz, und die Automaten
bestätigen sie in 25 von 29 Fällen wörtlich. Fiele die Ebene ganz weg, bliebe
jede Aussage über Zeiten bestehen; nur der Zusatz „teils" bliebe unaufgelöst.
Wer auch das draußen haben will, setzt `USE_AUTOMAT_HOURS = false` — dann baut
das Skript allein aus `zeitraum`.

Ein Gebührenparser existiert trotzdem und ist geprüft, wie Kölns
`parseKoelnFee`: `parseDuesseldorfFee` liest `4,50 € pro Stunde` und **bricht
bei `0,00 € pro Stunde` ab**. Das ist die Regel aus vier vorangegangenen
Parsern: Ein Nullbetrag wäre ein `exact` mit 0 Cent und damit `priced: true` —
der einzige Weg, an `CostEstimate.priced` vorbei ein „0,00 €" auf den Schirm zu
bringen. Was ein Nullbetrag im Feed bedeutete, weiß niemand, und „kostenlos"
ist die eine Lesart, die er sicher nicht verdient. Ebenso: Ein leeres Feld und
ein Strich ergeben `unknown`, nicht null.

### `ohne` heißt keine, nicht null Minuten

558 der 732 Automaten tragen das Wort in `hoechstparkzeit`. Als 0 gelesen hieße
es „Höchstparkdauer 0 Minuten", also Parken verboten — und das steht dort
nicht. Dieselbe Falle wie Hamburgs `9999`, Frankfurts `-` und Kölns `0`;
Düsseldorf ist die einzige der fünf Städte, die sie ausschreibt.
`parseDuesseldorfMaxStay('0 h')` bricht trotzdem ab.

**`maxStayMinutes` bleibt null.** Die Höchstparkdauer steht je Automat, und in
vier der 29 Gebiete mit Automaten stehen `2 h` und `ohne` nebeneinander. Sie
als Gebietsregel auszugeben wäre genau der Fehler, der in Berlin schon einmal
passiert ist; der Weg ist derselbe wie dort und in Frankfurt: Wert, Anteil und
alle Ausprägungen.

### „teils" bekommt kein Fenster

`werktags, 9 bis 20 Uhr / teils 9 bis 22 Uhr` sagt, dass für einen Teil des
Gebiets etwas anderes gilt — und **welchen Teil, sagt die Quelle nicht**. In
der Fassung vom Dezember hing an derselben Stelle ein Sternchen, dessen Fußnote
nirgends mitgeliefert wird. Der Zusatz landet deshalb wörtlich in
`unmodelledRules`, wie Berlins „Advents-Sa" und Münchens „an Schultagen", und
erzeugt kein Fenster aus dem Text. Das zweite Fenster entsteht trotzdem — aber
aus den Automaten, die es einzeln belegen, und nicht aus dem Wort „teils".

### `1 bis 15 Uhr` wird nicht repariert

Das Gebiet Flughafen trägt `montags bis sonntags, 1 bis 15 Uhr`; im Dezember
stand dort `11 bis 15 Uhr`. Eine verlorene Ziffer ist die naheliegende
Erklärung und bei keiner einzigen Zeile belegt. Die Reparatur wäre eine
Behauptung über eine Uhrzeit, und sie sähe auf der Karte nach nichts aus.
`1 bis 15 Uhr` ist eine syntaktisch gültige Spanne, der Parser nimmt sie, und
die Rückfrage steht unten in Abschnitt 5.

### Zuordnung zum Stadtteil über die Geometrie

44 von 44 treffen. Es gibt keine Alternative — weder Gebiet noch Automat nennt
einen Stadtteil. Die Zuordnung läuft gegen die **unvereinfachte** Geometrie;
vereinfachte Grenzen wandern um Dutzende Meter, und ein Gebiet an der Grenze
bekäme den Nachbarn zugeschrieben. Zwei der 44 Mittelpunkte liegen nicht im
eigenen Polygon (mehrteilige, konkave Gebiete); beide treffen trotzdem den
richtigen Stadtteil, weil der Stadtteil größer ist als das Gebiet.

### Die Gebietskennung nennt Namen und Buchstaben

`Unterbilk (R)`. Der Name verortet, der Buchstabe steht auf dem Schild und im
Bewohnerparkausweis. Hamburg hält es genauso, dort steckt der Code schon im
Namen (`N 101 Flughafenstraße`). 44 verschiedene Kennungen, keine mit
Fragezeichen.

### Keine Stellplatzzahlen

Weder das Gebiet noch der Automat zählt Plätze; `spaces` bleibt null. Eine
geschätzte Zahl wäre schlechter als keine.

### Zwei POI-Arten, nicht vier

`accessible` (340) und `park_and_ride` (48) passen ohne eine Zeile Änderung an
der Oberfläche. **Nicht** genommen: `verkehr:sharingstationen_point` (331
Punkte). Die Ebene mischt Auto-, Rad- und Rollersharing, und welcher Punkt
welches ist, sagen ihre Attribute nicht sauber. Als `carsharing` auszugeben
hieße, ein Symbol zu setzen, das etwas anderes behauptet — dieselbe Begründung,
mit der Frankfurts 113 Automaten ohne Bereich draußen bleiben. Lieber zwei
Arten richtig als vier halb.

Die P+R-Ebene reicht über die Stadtgrenze hinaus: zwölf verschiedene Werte in
`stadt`, darunter Meerbusch und Langenfeld. Das ist Absicht der Stadt — ein
P+R-Platz nützt gerade dort, wo man noch nicht in Düsseldorf ist — und deshalb
bleiben sie drin.

### Kein Parkscheiben-Zustand behauptet

Die Beschreibung des Datensatzes sagt: „Im Zentrum sowie in einigen
angrenzenden Gebieten ist das Parken für Nichtbewohnerinnen und Nichtbewohner
in den jeweiligen Bereichen nur mit einem Parkschein zulässig. In den übrigen
Stadtgebieten wird das Parken zunächst mit Parkscheibe für die Dauer von zwei
Stunden zugelassen."

Das sieht nach `Fee.disc` für die 15 Gebiete ohne Automaten aus, und es wäre
geraten: Der Satz nennt keine Gebiete, „einige angrenzende" ist keine Liste,
und die 15 Gebiete ohne Automaten sind nicht dasselbe wie „die übrigen
Stadtgebiete". Sie bekommen `unknown`. Kein Betrag ist nicht null Euro — und
eine Parkscheibenpflicht, die man aus einem Fließtext ableitet, ist keine
gelesene Tatsache.

## 4. Was einzutragen bleibt

Vier Dateien sind hier bewusst nicht angefasst worden. Solange sie fehlen,
schlägt `pnpm --filter @knoellchenfrei/ingest typecheck` mit **zwölf**
`TS2305`-Fehlern fehl, alle in `build-data-duesseldorf.ts`, alle in der Form
*Module `"@knoellchenfrei/core"` has no exported member …*:

```
Zeile 49  DUESSELDORF                       Zeile 57  parseDuesseldorfFee
Zeile 50  duesseldorfExtraRules             Zeile 58  parseDuesseldorfMaxStay
Zeile 51  duesseldorfMaxStayCode            Zeile 59  parseDuesseldorfSchedule
Zeile 52  duesseldorfZoneLabel              Zeile 61  DuesseldorfAutomatProperties
Zeile 53  mergeDuesseldorfFees              Zeile 62  DuesseldorfZoneProperties
Zeile 54  mergeDuesseldorfWindows
Zeile 56  parseDuesseldorfAutomatSchedule
```

Elf davon verschwinden mit der Zeile aus Vorschlag 1, der zwölfte
(`DUESSELDORF`) mit Vorschlag 3. Die Reihenfolge ist: Feiertage, dann `index`,
dann `city`, dann `sources` — `land: 'NW'` übersetzt nicht ohne den
Feiertagseintrag.

Alles unten ist **Vorschlag**, nicht eingetragen.

### 1. `app/packages/core/src/index.ts`

```ts
export * from './duesseldorf.js'
```

(alphabetisch zwischen `cors.js` und `events.js`)

### 2. `app/packages/core/src/holidays.ts`

Im Typ:

```ts
export type Land = 'BE' | 'HH' | 'HE' | 'BY' | 'NW'
```

In `REGIONAL`:

```ts
NW: { fixed: ['11-01'], fromEaster: [60] }, // Allerheiligen, Fronleichnam
```

Und in den Belegblock über `REGIONAL`:

```
 * - **NW** — Nordrhein-Westfalen hat **elf**: die neun bundesweiten plus
 *   Fronleichnam und Allerheiligen. Kein Reformationstag, kein Buß- und
 *   Bettag, kein Frauentag — und, anders als in Bayern, **keine gemeindeweise
 *   Regelung**: § 2 des Gesetzes über die Sonn- und Feiertage (SGV. NRW. 113)
 *   kennt keinen Vorbehalt wie Art. 1 Abs. 1 Nr. 2 BayFTG; die einzige
 *   gemeindebezogene Vorschrift ist § 8 Abs. 3 und betrifft *kirchliche*
 *   Feiertage, die nach § 5 Abs. 1 nur zur Gottesdienstzeit geschützt und
 *   nicht arbeitsfrei sind. Wörtlich, § 2 Abs. 1: „der Neujahrstag, der
 *   Karfreitag, der Ostermontag, der 1. Mai …, der Christi-Himmelfahrts-Tag,
 *   der Pfingstmontag, der Fronleichnamstag (Donnerstag nach dem Sonntag
 *   Trinitatis), der 3. Oktober als Tag der Deutschen Einheit, der
 *   Allerheiligentag (1. November), der 1. Weihnachtstag, der
 *   2. Weihnachtstag". Quelle: <https://recht.nrw.de/lrgv/gesetz/01012000-bekanntmachung-der-neufassung-des-gesetzes-ueber-die-sonn-und-feiertage>,
 *   abgerufen am 8. September 2026.
```

Mit diesem Eintrag ist auch Kölns offener Punkt 1 erledigt — der Eintrag ist
derselbe.

**Ein Test gehört dabei ersetzt:** `duesseldorf.test.ts` hält heute unter
„Feiertage" fest, dass `holidaysFor('NW' as Land, 2026)` **wirft**. Das ist der
laute Zustand, den dieses Projekt einem stillen vorzieht — aber sobald der
Eintrag steht, gehört daraus ein Test über Fronleichnam und Allerheiligen.

### 3. `app/packages/core/src/city.ts`

```ts
/**
 * Düsseldorf.
 *
 * Die Box ist gemessen, nicht geschätzt: Der Umriss der Stadt aus
 * `grenzen:stadtgrenze` (abgerufen am 8. September 2026) misst
 * 6,6888–6,9399 / 51,1244–51,3525; nach außen gerundet steht das unten. Die
 * 44 Bewohnerparkgebiete reichen nur 6,7275–6,8742 / 51,1733–51,3027 — wer die
 * Box daraus nähme, wiese eine Meldung aus Garath oder Kalkum als „außerhalb"
 * ab, obwohl dort bewirtschaftet werden kann und nur kein
 * Bewohnerparkgebiet liegt.
 *
 * **Achtung bei Köln.** Kölns vorgeschlagene `reportBounds` enden im Norden
 * bei 51,10, Düsseldorfs beginnen bei 51,11 — 0,01°, also gut einen
 * Kilometer. Die beiden Boxen überschneiden sich damit nicht, und der Test in
 * `city.test.ts` bleibt grün; wer eine der beiden nach außen erweitert, macht
 * `cityAt` zum Zufall.
 *
 * Der Mittelpunkt ist die Mitte des Rahmens der 44 Gebiete, nicht die
 * Altstadt: Bei Zoom 12 (Frankfurts Wert, rund 0,40° × 0,21°) liegen damit
 * alle 44 im Bild, und ihre Nord-Süd-Ausdehnung von 0,130° passt gerade so
 * hinein. Vom Altstadt-Zentroid (6,7706 / 51,2211) aus fiele der Flughafen im
 * Norden knapp heraus.
 */
export const DUESSELDORF: City = {
  key: 'duesseldorf',
  name: 'Düsseldorf',
  land: 'NW',
  center: [6.8009, 51.238],
  zoom: 12,
  reportBounds: { minLon: 6.66, minLat: 51.11, maxLon: 6.96, maxLat: 51.37 },
  sessionBounds: { minLon: 6.4, minLat: 50.9, maxLon: 7.25, maxLat: 51.6 },
  attribution: {
    // DL-DE/Zero-2.0 verlangt keine Nennung; der Quellenvermerk steht
    // trotzdem — freiwillig ist nicht verboten, und Berlin hält es genauso.
    // Belegt am DCAT-AP.de-Datensatz `aec4ca40-…`: `dct:license` ist
    // `dl-zero-de/2.0` in allen vier Distributionen, `dct:publisher` ist
    // „Landeshauptstadt Düsseldorf – Amt für Verkehrsmanagement".
    source: 'Landeshauptstadt Düsseldorf, Amt für Verkehrsmanagement — opendata.duesseldorf.de',
    datasetUrl: 'https://maps.duesseldorf.de/services/verkehr/wfs',
    licence: 'Datenlizenz Deutschland Zero 2.0',
    licenceUrl: 'https://www.govdata.de/dl-de/zero-2-0',
    attributionRequired: false,
  },
  // Belegt auf der Seite des Ordnungsamts, wörtlich und mit beiden Nummern.
  // Zuständig ist das Ordnungsamt, nicht das Amt für Verkehrsmanagement; eine
  // städtische Verwahrstelle gibt es nicht, die Fahrzeuge stehen beim
  // beauftragten Abschleppunternehmen.
  towedVehicles: {
    authority: 'Leitstelle des Ordnungsamtes der Landeshauptstadt Düsseldorf',
    url: 'https://www.duesseldorf.de/ordnungsamt/verkehrueb/schlepp',
    phone: '0211 89-94000',
    checkedOn: '2026-09',
    note:
      'Die Stadt rät, zuerst die nächste Polizeidienststelle zu fragen ' +
      '(0211 870-0): Dort ist bekannt, zu welchem Abschleppunternehmen das ' +
      'Fahrzeug gebracht wurde.',
  },
}
```

und in der Liste:

```ts
export const CITIES: readonly City[] = [BERLIN, HAMBURG, FRANKFURT, MUENCHEN, DUESSELDORF]
```

### 4. `app/packages/ingest/src/sources.ts`

```ts
/**
 * Düsseldorf — Landeshauptstadt Düsseldorf, DL-DE/Zero-2.0.
 *
 * Zahlen und Typnamen sind am 8. September 2026 mit `resultType=hits` gegen
 * die Dienste selbst geprüft, nicht aus Metadaten übernommen.
 *
 * Zwei Dienste, weil der Verkehrs-WFS keine Verwaltungsgrenzen führt — wie in
 * Frankfurt und München. Gefunden wurden beide über den Katalog: Der
 * Portal-Datensatz „Allgemeine Behindertenparkplätze" hat als Distribution
 * wörtlich einen Aufruf von `services/verkehr/wfs`; von dort führt der
 * Sitemap-Nachbar `services/grenzen/wfs` zu den Stadtteilen. Geratene Namen
 * (`geodaten.duesseldorf.de`, `/geoserver/ows`) ergaben 404.
 *
 * **`srsName` ist Pflicht.** `DefaultCRS` ist bei jeder Ebene EPSG:25832;
 * ohne den Parameter kommen UTM-Meter (`[345550.30, 5676562.02]`). Und die
 * Antwort ist FALSCH beschriftet: Der Dienst schreibt
 * `urn:ogc:def:crs:EPSG::4326` an die Geometrie — die Form, die die Breite
 * zuerst vorschreibt — und liefert dann `[lon, lat]`. Deshalb steht die
 * Reihenfolge hier und wird nicht aus der Antwort gelesen.
 *
 * Bewusst NICHT abgerufen: `verkehr:sharingstationen_point` (331 Punkte,
 * mischt Auto-, Rad- und Rollersharing ohne sauberes Unterscheidungsmerkmal),
 * `verkehr:parkhaus` (44), `verkehr:quartiersgaragen` (77),
 * `verkehr:feierabendparken` (25), `verkehr:motorradstellplatz` (12) und die
 * sechs Ebenen, die gar nichts mit Parken zu tun haben. Details in
 * `docs/staedte-duesseldorf.md`.
 */
const DUESSELDORF_VERKEHR = 'https://maps.duesseldorf.de/services/verkehr/wfs'

const DUESSELDORF_DEFAULTS = {
  outputFormat: 'application/json',
  axisOrder: 'lon,lat',
} as const

const DUESSELDORF_SOURCES: readonly Source[] = [
  // 65 Merkmale für 44 Gebiete: Elf Gebiete kommen in mehreren Stücken, jedes
  // mit eigener `_uuid` und gleichen Sachdaten. `build-data-duesseldorf.ts`
  // gruppiert deshalb auf `kuerzel`.
  {
    key: 'zones',
    service: DUESSELDORF_VERKEHR,
    typeName: 'verkehr:bewohnerparken',
    expectedFeatures: 65,
    ...DUESSELDORF_DEFAULTS,
  },
  // Tarif, Tarifzeit und Höchstparkdauer. Der Betrag wird heute NICHT
  // ausgeliefert — der Datensatz steht in keinem Katalog, und der Dienst
  // beantwortet die Lizenzfrage nicht. Siehe `AUTOMATS_LICENCE_CONFIRMED`.
  {
    key: 'automats',
    service: DUESSELDORF_VERKEHR,
    typeName: 'verkehr:parkscheinautomaten',
    expectedFeatures: 732,
    ...DUESSELDORF_DEFAULTS,
  },
  {
    key: 'accessible',
    service: DUESSELDORF_VERKEHR,
    typeName: 'verkehr:behindertenparkplatz',
    expectedFeatures: 340,
    ...DUESSELDORF_DEFAULTS,
  },
  // Reicht über die Stadtgrenze hinaus (Meerbusch, Langenfeld, Neuss) — das
  // ist Absicht der Stadt und bleibt so.
  {
    key: 'parkAndRide',
    service: DUESSELDORF_VERKEHR,
    typeName: 'verkehr:park_ride',
    expectedFeatures: 48,
    ...DUESSELDORF_DEFAULTS,
  },
  // Ein Polygon, seit 2009, seit 2013 erweitert. Düsseldorf ist damit nach
  // Berlin und München die dritte Stadt mit Umweltzonen-Geometrie im Abzug.
  {
    key: 'lowEmissionZone',
    service: DUESSELDORF_VERKEHR,
    typeName: 'verkehr:umweltzone',
    expectedFeatures: 1,
    ...DUESSELDORF_DEFAULTS,
  },
  // Dieselbe Rolle wie Berlins Ortsteile: Ohne Hintergrundkarte schweben die
  // Gebiete sonst im Nichts. Anderer Dienst, anderes Amt (Statistik und
  // Wahlen), dieselbe Lizenz. Die zehn Stadtbezirke wären die gröbere Wahl;
  // 50 Stadtteile verorten „Unterbilk" besser als „Stadtbezirk 3".
  {
    key: 'districts',
    service: 'https://maps.duesseldorf.de/services/grenzen/wfs',
    typeName: 'grenzen:stadtteile',
    expectedFeatures: 50,
    ...DUESSELDORF_DEFAULTS,
  },
]
```

und in `BY_CITY`:

```ts
const BY_CITY: Record<string, readonly Source[]> = {
  berlin: BERLIN_SOURCES,
  hamburg: HAMBURG_SOURCES,
  frankfurt: FRANKFURT_SOURCES,
  muenchen: MUENCHEN_SOURCES,
  duesseldorf: DUESSELDORF_SOURCES,
}
```

`wfsUrl` funktioniert unverändert; beide Dienste akzeptieren die Form mit
`typeNames` und URL-kodiertem `srsName`, nachgemessen mit genau der Zeichenkette,
die `wfsUrl` erzeugt.

Der Abruf braucht anders als in Köln **keinen** zweiten Ast für Dateien: Alles
kommt aus WFS.

### 5. Danach

```bash
cd app
pnpm --filter @knoellchenfrei/ingest exec tsx src/fetch-data.ts   # CITY=duesseldorf
CITY=duesseldorf npx tsx src/build-data-duesseldorf.ts
cd packages/ingest && npx tsx src/build-zone-keys.ts              # ALL_ZONE_KEYS je Stadt
```

`build-zone-keys.ts` liest die ausgelieferten `zones.geojson` und muss danach
laufen — sonst weist der Worker jede Düsseldorfer Zonenkennung ab, und auf der
Statistikseite stünde Düsseldorf mit null Zonenöffnungen da, was nach „wird
dort nicht benutzt" aussähe.

## 5. Was offen bleibt

1. **Die Lizenz der Parkscheinautomaten.** Der wichtigste Punkt, und er ist
   eine E-Mail an `opendata@duesseldorf.de` (fachlich `maps@duesseldorf.de`):
   Unter welcher Lizenz steht `verkehr:parkscheinautomaten`, und kann der
   Datensatz ins offene Datenportal? Sobald die Antwort da ist, wird
   `AUTOMATS_LICENCE_CONFIRMED` auf `true` gesetzt, und Düsseldorf hat als
   fünfte Stadt einen echten Tarif — 24 Gebiete mit einem Betrag, fünf mit
   einer Spanne. **Die Frage ist nicht gestellt.**
2. **Die Lizenz der übrigen WFS-Ebenen, sauber belegt.** Für
   `bewohnerparken`, `behindertenparkplatz`, `park_ride`, `umweltzone` und
   `stadtteile` gibt es je einen Portal-Datensatz unter DL-DE/Zero-2.0 mit
   demselben Inhalt und demselben Herausgeber; nur bei den
   Behindertenparkplätzen ist die **Distribution** wörtlich dieser WFS. Der
   Rest ist ein sehr naheliegender Schluss und kein Beleg im Sinne dieses
   Projekts. Dieselbe E-Mail erledigt das mit.
3. **`montags bis sonntags, 1 bis 15 Uhr` am Flughafen.** Im Dezember stand
   dort `11 bis 15 Uhr`. Tippfehler oder Absicht? Rückfrage nötig; repariert
   wird nichts.
4. **Was „teils 9 bis 22 Uhr" meint.** Zwei Gebiete, und die Quelle nennt den
   Teil nicht. Die Automaten lösen es faktisch auf; eine Antwort der Stadt
   wäre trotzdem besser als ein Schluss.
5. **Der Überlapp Blücherstraße / Derendorfer Straße.** 50.200 m², und die
   Straßenliste der Stadt führt Eulerstraße und Prinz-Georg-Straße in beiden
   Gebieten. Heute harmlos, weil beide dieselbe Zeit nennen. Rückfrage steht
   aus.
6. **Die bewirtschaftete Fläche außerhalb der Bewohnerparkgebiete.** 110 der
   732 Automaten (15 %) liegen in keinem der 44 Polygone. Für sie kennt die
   App keine Fläche, also auch keine Zone. Ob es dafür einen weiteren Datensatz
   gibt, ist ungeprüft.
7. **Die Nachbarschaft zu Köln.** Wenn beide Städte kommen, liegen ihre
   `reportBounds` 0,01° auseinander. Das trägt, ist aber knapp; wer eine der
   beiden Boxen erweitert, muss die andere ansehen. Auf Dauer ist das ein
   Argument für die in [staedte.md](staedte.md) skizzierte Punkt-in-Polygon-
   Suche statt rechteckiger Rahmen.
8. **PMTiles-Kacheln.** `scripts/build-tiles.sh` braucht einen Ausschnitt für
   Düsseldorf; er kommt aus `DUESSELDORF.reportBounds`, sobald der Eintrag
   steht.
9. **`verkehr:sharingstationen_point`.** 331 Punkte, drei Verkehrsmittel in
   einer Ebene. Wenn sich ein Attribut findet, das Auto- von Rad- und
   Rollersharing trennt, wäre das die dritte POI-Art ohne Änderung an der
   Oberfläche.
10. **Ladepunkte.** Dieser Dienst führt keine. Ob die Stadtwerke oder die
    Bundesnetzagentur eine brauchbare Quelle für Düsseldorf haben, ist
    ungeprüft.

## Prüfstand

```bash
cd app
pnpm --filter @knoellchenfrei/core typecheck     # grün
pnpm --filter @knoellchenfrei/core test          # grün, 584 Tests, davon 37 für Düsseldorf
cd .. && ./scripts/sprache-pruefen.sh            # grün
node scripts/doku-pruefen.mjs                    # grün
```

`pnpm --filter @knoellchenfrei/ingest typecheck` ist rot, mit genau den zwölf
`TS2305`-Fehlern aus Abschnitt 4, und bleibt es, bis die Einträge stehen.

## Dateien

| Datei | Inhalt |
| --- | --- |
| `app/packages/core/src/duesseldorf.ts` | Zeit-, Gebühren- und Dauerparser, Zusammenlegung, Gebietsfelder |
| `app/packages/core/test/duesseldorf.test.ts` | 37 Tests gegen die Fixtures, inklusive Beschuss mit Unfug |
| `app/packages/core/test/fixtures/dus-bewohnerparken-2026-09-08.json` | alle 65 Merkmale ohne Geometrie, dazu die Auszählung von `zeitraum` |
| `app/packages/core/test/fixtures/dus-parkscheinautomaten-2026-09-08.json` | Auszählung der 732 Automaten und je Wertkombination eine wörtliche Zeile |
| `app/packages/ingest/src/build-data-duesseldorf.ts` | der Datenbau |
