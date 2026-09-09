# Karlsruhe — Prüfbericht

> **Wo der Code liegt.** Dieser Bericht steht auf dem Arbeitszweig, der
> zugehörige Code auf `staedte/koeln-karlsruhe-vorbereitet`. Getrennt, weil die
> Datenbauten Namen aus `core` importieren, die es ohne die drei einzutragenden
> Dateien nicht gibt — auf dem Arbeitszweig wäre `pnpm -r typecheck` dauerhaft
> rot, und ein dauerhaft roter Typecheck macht das nächste echte Problem
> unsichtbar.

Vorbereitet am **8. September 2026**. Diese Datei ergänzt
[staedte.md](staedte.md) und [staedte-recherche-2026-09.md](staedte-recherche-2026-09.md)
um das, was beim Anschluss von Karlsruhe wirklich herauskam — abgerufen, nicht
abgeschrieben. Wo die Recherche vom 7. September danebenlag, steht das hier als
Befund und nicht als Fußnote.

Geliefert sind: `packages/core/src/karlsruhe.ts` (Parser),
`packages/core/test/karlsruhe.test.ts` (69 Tests),
`packages/core/test/fixtures/ka-*-2026-09-08.json` (drei Fixtures) und
`packages/ingest/src/build-data-karlsruhe.ts` (Datenbau). **Nicht** geliefert,
weil ein zweiter Agent parallel an Köln arbeitete: die Einträge in
`core/city.ts`, `core/index.ts`, `core/holidays.ts`, `ingest/src/sources.ts`
und `ingest/package.json`. Sie stehen unten als fertige Schnipsel.

---

## 1. Was gemessen wurde

Alle Abrufe am 8. September 2026 gegen
`https://mobil.trk.de/geoserver/TBA/ows` (GeoServer, WFS 2.0.0) und gegen die
CKAN-Schnittstelle von `transparenz.karlsruhe.de`. Der Dienst antwortete ohne
Zertifikatsprobleme; `--cacert` war anders als bei `gdi.berlin.de` nicht nötig.

### 1.1 Zahlen je Typname (`resultType=hits`)

| Typname | `numberMatched` | Geometrie | Recherche 7.9. | Befund |
| --- | --- | --- | --- | --- |
| `TBA:parkscheinautomaten` | **638** | Point | 638 | stimmt |
| `TBA:parkscheinautomaten_flaechen` | **282** | Polygon / MultiPolygon | 282 | stimmt |
| `TBA:parkscheiben` | **363** | Point | 363 | stimmt |
| `TBA:bewohnerparken` | **157** | **Polygon / MultiPolygon** | „**sind Punkte**" | **falsch** |
| `TBA:behinderten_parkplaetze` | 694 | Point | nicht geprüft | neu |
| `TBA:freies_parken` | 74 | — | nicht geprüft | neu |
| `TBA:park_ride` | 171 | Point | nicht geprüft | neu |

Der Dienst führt insgesamt **41 Typnamen**. `GetCapabilities` liefert zu keinem
davon einen `Title` oder ein `Abstract`, das über den Namen hinausginge — die
Ebenen sind nur über ihre Datensatzseite im Transparenzportal zu deuten.

### 1.2 Achsenreihenfolge und `srsName`

- `DefaultCRS` ist **EPSG:25832**. **Ohne `srsName` antwortet der Dienst in
  UTM**: `[460417.47, 5427328.97]` — plausible Zahlen, nur keine Grade.
  Dieselbe stille Falle wie in Frankfurt und München. `wfsUrl` setzt den
  Parameter für alle Städte; `assertDegrees` steht trotzdem auch im Karlsruher
  Datenbau.
- Mit `srsName=urn:ogc:def:crs:EPSG::4326` **und** mit der Kurzform
  `EPSG:4326` kommt `[8.45885518, 48.99759018]`, also **`lon,lat`** — wie
  Berlin, Frankfurt und München, anders als Hamburg. Die Recherche lag hier
  richtig.
- `outputFormat`: `application/json` ist richtig. Hamburgs
  `application/geo+json` quittiert der Dienst mit **HTTP 400** und einem
  `application/xml`-Rumpf.

### 1.3 Die 638 Automaten, nach Gemeinde

| Gemeinde | Automaten | | Gemeinde | Automaten |
| --- | --- | --- | --- | --- |
| **Karlsruhe** | **281** | | Baden-Baden | 15 |
| Landau | 150 | | Gaggenau | 7 |
| Rastatt | 74 | | Bruchsal | 4 |
| **Haguenau (F)** | 54 | | Bretten | 4 |
| Ettlingen | 27 | | Germersheim | 3 |
| **Saverne (F)** | 19 | | | |

Die Recherche hatte das richtig. Was sie **unterschätzt** hat, ist die Wirkung:
Von den 360 Zeilen, die nicht Karlsruhe sind, kann `parseKarlsruheSchedule`
**334** nicht lesen (`Du lundi au samedi 9h-12h et 14h-19h`,
`9h-12h / 14h-19h`). Die übrigen **26** — aus Ettlingen und Rastatt — läsen
sich sauber und wären trotzdem falsch: andere Stadt, anderes Preisniveau. Der
Filter schützt also nicht nur vor einem Abbruch, sondern auch vor einem stillen
Fehler.

### 1.4 Die 281 Karlsruher Zeilen im Einzelnen

Hier weicht der Befund deutlich von der Recherche ab, und zwar **zugunsten**
Karlsruhes: Die dort genannten „29 Schreibweisen" Zeiten, „25" Gebühren und
„15" Höchstparkdauer sind Zahlen für den **ganzen** Feed. Auf Karlsruhe
gefiltert bleibt ein sehr ordentlicher Datensatz übrig.

**`parkzeit` — 11 Schreibweisen (nicht 29):**

| Anzahl | Wert |
| --- | --- |
| 229 | `werktags 8 bis 20 Uhr` |
| 22 | `werktags 8 bis 20 Uhr; Tagespauschale` |
| 10 | `täglich 6 bis 24 Uhr; Tagespauschale` |
| 9 | `täglich 0 bis 24 Uhr` |
| 2 | `Mo-Fr 8 bis 16 Uhr` · `Mo-Fr 9 bis 18 Uhr; Sa 9 bis 13 Uhr` · `täglich 0 bis 24 Uhr; Tagespauschale` · `Mo-Fr 8 bis 18 Uhr` |
| 1 | `Mo-Fr 8 bis 17 Uhr` · `täglich 6 bis 24 Uhr` · `null` |

**`gebuehren` — 6 Schreibweisen (nicht 25):**

| Anzahl | Wert | ergibt |
| --- | --- | --- |
| 149 | `30 min = 1,50 €; 60 min = 3,00 €; 90 min = 4,50 €; 120 min = 6,00 €` | **3,00 €/h** |
| 94 | `15 min = 1,50 €; 30 min = 3,00 €; 45 min = 4,50 €; 60 min = 6,00 €` | **6,00 €/h** |
| 20 | dieselbe wie Zeile 1, plus `Tagespauschale = 15,00 €` | 3,00 €/h |
| 13 | dieselbe wie Zeile 1, plus `Tagespauschale = 22,50 €` | 3,00 €/h |
| 3 | `null` | — |
| 2 | `Tagespauschale = 22,50 €` | **kein Stundensatz** |

**`max_parkdauer` — 4 Schreibweisen (nicht 15):** `2 Std.` (149), `1 Std.`
(94), `24 h` (35), `null` (3).

**`tarifzone` — 3 Werte:** `"2"` (184), `"1"` (94), `"0"` (3). Als
**Zeichenkette**, nicht als Zahl — gegen die Fixture geprüft, nicht nur
behauptet (die Frankfurter Lehre aus `bewohnerparkzone`).

**`stand`:** 2026-06-11 (186) und 2026-06-10 (95). Der Datensatz ist **drei
Monate alt**, nicht anderthalb Jahre; die Portal-Metadaten (`2025-02-19`) sagen
nur, wann zuletzt jemand die Beschreibung angefasst hat.

### 1.5 Der Befund, der alles bestimmt: die Flächen sind keine Gebiete

Die Recherche schreibt, die Flächen trügen keine Attribute. Das stimmt —
`{id, gemeinde, stand}`, sonst nichts, in allen 282. Aber sie sagt nicht, **was
die Flächen sind**, und das ist die eigentliche Nachricht:

| gemessen | Wert |
| --- | --- |
| Flächen gesamt | 282, **alle** in Karlsruhe |
| Fläche im Median | **128 m²** (p10 68 m², p90 225 m²) |
| Breite im Median | **4,8 m** (p10 3,3 m, p90 7,8 m) |
| Summe aller Flächen | **4,8 ha** — 0,03 % des 173 km² großen Stadtgebiets |
| ausgewiesene Stellplätze (Summe `stellplaetze`) | 3.367 |
| rechnerisch bei 12 m² je Platz | rund 4.000 |
| Abstand zum nächsten Automaten (Kante) | Median 8 m, p90 18 m |

Die Datensatzbeschreibung im Transparenzportal sagt es selbst: „Dieser
Datensatz enthält Flächen mit kostenpflichtige Parkschein-Parkplätzen in
Karlsruhe." Es sind die **Stellplatzreihen am Bordstein**, nicht
Bewirtschaftungsgebiete. Sie decken die Karlsruher Parkraumbewirtschaftung
vollständig ab (4.000 gegen 3.367 ausgewiesene Plätze) — aber als *Zonen* im
Sinne dieser App sind sie 4,8 Meter breit.

### 1.6 Was `TBA:bewohnerparken` wirklich ist

Die Recherche: „sind Punkte, keine Flächen (157 Stück, Felder `gemeinde`,
`bewohnerparkzone`, `kennziffer`) — für eine Zonenabfrage unbrauchbar."

Gemessen: **Polygone und MultiPolygone**, mit den Feldern `id`, `gemeinde`,
`stadtteil`, `bewohnerparkzone`, `kennziffer`, `parkplaetze`, `bemerkung`,
`stand`. Davon liegen **21 in Karlsruhe**, zwischen 14.000 und 280.000 m² groß
— echte Quartiersflächen, in denen eine Ortung landet.

Sie sind trotzdem nicht die Antwort, und zwar aus zwei gemessenen Gründen:

1. `bewohnerparkzone` ist in **allen 21** Karlsruher Zeilen `null`; Identität
   trägt nur `kennziffer` (`A1`, `B3`, `J2`, …).
2. Nur **148 der 281** Automaten liegen in einem dieser Gebiete, und **4 der
   21** Gebiete enthalten gar keinen. Ein Bewohnerparkgebiet ist eben kein
   Gebührengebiet: Es umschließt die Wohnstraßen, die Automaten stehen an den
   Geschäftsstraßen. Wer die 21 Polygone als Zonen ausliefert, sagt an 133
   Automatenstandorten „außerhalb der Parkraumbewirtschaftung" — und zieht
   gleichzeitig eine Gebietsgrenze, die die Quelle so nicht behauptet.

### 1.7 `tarifzone = "0"` — drei fremd betriebene Parkplätze

Ein Befund, den die Recherche nicht hat und der ohne Nachmessen unsichtbar
bleibt. Drei Karlsruher Zeilen tragen `tarifzone: "0"`, keine `gebuehren`,
keine `max_parkdauer` — und in `bemerkung` einen Link:

| `standort` | `bemerkung` |
| --- | --- |
| Parkplatz P7 (Hinterm Hauptbahnhof) | `contipark.de/…/parkplatz-schwarzwaldstrasse-p7/` |
| Parkplatz P4 (Poststraße) | `contipark.de/…/parkplatz-hauptbahnhof-vorplatz-p4/` |
| Parkplatz P6 | `parken-in-karlsruhe.de/parkhaus/parkplatz-p6-am-hauptbahnhof/` |

Sie sind keine Straßenstellplätze der Stadt. Und sie stehen **näher an zwei
Stellplatzflächen als jeder städtische Automat**: 3 m bzw. 18 m gegen 99 m und
81 m. Ohne den Filter erbten diese beiden Flächen einen leeren Tarif von einem
Betreiber, der für sie nicht zuständig ist — die App sagte
„bewirtschaftet, Preis unbekannt", wo die Stadt 3 € je Stunde nimmt. Der Test
`erreicht an Fläche 271 nur den fremd betriebenen Automaten` hält genau das
fest.

---

## 2. Was entschieden wurde, und warum

### 2.1 Die Zonen sind die Stellplatzflächen — nicht die Bewohnerparkgebiete

Beide Kandidaten sind falsch, aber **verschieden** falsch, und das entscheidet:

- Mit den **Bewohnerparkgebieten** wäre jede Aussage der App über eine
  *Fläche* eine Behauptung, die die Quelle nicht deckt: Der Rand des Gebiets
  ist nicht der Rand der Gebührenpflicht, und 47 % der Automaten liegen
  draußen. Falsch an der Stelle, an der jemand steht.
- Mit den **Stellplatzflächen** ist jede Aussage **wahr, wo sie steht**: Das
  Polygon ist tatsächlich gebührenpflichtig, und der Tarif kommt von einem
  Automaten acht Meter daneben. Der Preis dafür ist **Abdeckung**, nicht
  Richtigkeit — man muss in der Reihe stehen, um getroffen zu werden.

Die Regel dieses Projekts entscheidet das eindeutig: „Nicht raten, wenn die
Quelle schweigt", „Laut scheitern statt still falsch liegen". Wahr mit Lücken
schlägt plausibel und falsch. Der Preis steht als offener Punkt in Abschnitt 5
— und er ist **blockierend**.

### 2.2 Die Zuordnung Automat → Fläche läuft über den Abstand

Frankfurt entscheidet das mit Punkt-in-Polygon, weil seine Polygone
Bewohnerparkbereiche sind. Karlsruhes Polygone sind die Reihen selbst; ein
Automat steht am Bordstein daneben, fast nie darin. Punkt-in-Polygon fände hier
nahezu nichts, und die Ausgabe wäre leer, ohne dass etwas nach einem Fehler
aussähe.

Der Radius ist **gemessen, nicht gewählt**. Abstand Punkt zu **Kante** (nicht
zum Schwerpunkt und nicht zum nächsten Stützpunkt — die längste Kante misst
114 m):

| Radius | Flächen ohne Automat | mit mehreren | uneins über den Rohtext der Gebühr | Automaten ohne Fläche |
| --- | --- | --- | --- | --- |
| 10 m | 6 | 13 | 0 | **3** |
| 15 m | 4 | 45 | 0 | 0 |
| **20 m** | **3** | 77 | 1 | 0 |
| 30 m | 3 | 122 | 2 | 0 |
| 40 m | 3 | 158 | 3 | 0 |
| 75 m | 3 | 221 | 19 | 0 |

20 m ist die Stelle, an der beide Kurven flach werden: Jeder Automat hat eine
Fläche, und die Zahl der Flächen ohne Automaten erreicht ihren Boden von drei.
Diese drei liegen am Bahnhofplatz und am Stadtgarten, ihr nächster städtischer
Automat steht 81, 99 und 101 m entfernt — sie gehören zu etwas anderem. Weiter
aufzumachen kauft keine einzige Fläche und handelt sich nur Widersprüche ein.

Nach dem Parsen bleibt bei 20 m **kein einziger** Widerspruch übrig: Die eine
Fläche mit zwei verschiedenen Rohtexten hat zweimal `werktags 8 bis 20 Uhr` und
zweimal 3 €/h, nur einmal mit und einmal ohne den Zusatz `Tagespauschale`.

### 2.3 Die Preistreppe wird gerechnet, nicht abgelesen

**Karlsruhe nennt keinen Stundensatz.** Es nennt vier Stützstellen, und der
Satz steckt in ihrem Verhältnis. Beide Karlsruher Treppen fangen mit
`= 1,50 €` an — die eine bei 30 Minuten (3 €/h), die andere bei 15 (6 €/h).
Wer die erste Zahl nimmt, nennt 94 Automaten der Tarifzone 1 **den halben
Preis**.

`parseKarlsruheFee` liest deshalb **jede** Stufe und hält sie gegen die
anderen. Ist die Treppe nicht linear, bricht der Parser ab, statt einen Wert zu
wählen — in Rastatt steht
`15 min = 0,10 €; 30 min = 0,20 €; 45 min = 0,50 €; 60 min = 0,80 €`, also
0,40 €/h an der ersten und 0,80 €/h an der letzten Stufe. In Karlsruhe ist
heute jede Treppe linear; ein Parser, der das nicht prüft, verlässt sich
darauf, dass es so bleibt.

Zwei weitere Bremsen aus derselben Ecke:

- **Ein Nullbetrag wird abgewiesen**, nicht als „kostenlos" gemeldet —
  dieselbe Begründung wie in `parse-fee.ts`, `hamburg.ts` und `frankfurt.ts`.
- **Ein Satz, der keine ganzen Cent je Stunde ergibt, wird abgewiesen.** Zu
  runden hieße, einen Preis zu nennen, den niemand geschrieben hat.

### 2.4 Die Tagespauschale ist eine Zusatzregel, kein Fenster und kein Tarif

`werktags 8 bis 20 Uhr; Tagespauschale` mischt zwei Arten von Aussage in einem
Feld. `parseKarlsruheSchedule` gibt deshalb als einziger der fünf Parser eine
Struktur statt einer Liste zurück:

```ts
export interface KarlsruheSchedule {
  windows: ChargeWindow[]
  unmodelledRules: string[]   // heute nur ['Tagespauschale']
}
```

Die Regel landet in `ParkingZone.unmodelledRules` und damit als Satz im Panel.
Das ist erst seit München sicher: `isUncertainAt` filtert über `adventRulesOf`
auf Regeln, die den Advent erwähnen. Vor dieser Änderung stünde über jeder
Karlsruher Fläche mit Tagespauschale an einem Adventssamstag „unsicher" — und
in der Erklärung ein Berliner Adventssamstag. Ein Test hält das fest.

`22,50 €` je Tag durch 24 Stunden wären 0,94 €/h. Die zwei Automaten, die *nur*
eine Tagespauschale nennen, bekommen deshalb `{ kind: 'unknown' }` —
„gebührenpflichtig, Satz nicht in der Quelle", dieselbe ehrliche Antwort wie in
ganz München. Der Rohtext steht als `rawFee` wörtlich im Panel, es geht also
nichts verloren.

### 2.5 „werktags" ist Montag bis **Samstag**

Dieselbe Auslegung und derselbe Beleg wie in `hamburg.ts` (§ 3 Abs. 2 BUrlG).
Hier wiegt sie schwerer als irgendwo sonst: **229 der 278** Karlsruher
Automaten tragen genau dieses Wort. Andersherum gelesen meldete die App
samstags über fast der ganzen Innenstadt „gebührenfrei".

### 2.6 Die Höchstparkdauer wird nie als Regel der Fläche ausgegeben

Frankfurts Weg, aus demselben Grund: Sie steht je Automat, und eine Fläche kann
mehrere haben (eine der 279 hat `2h` und `24h` nebeneinander). `maxStayMinutes`
bleibt `null`; `maxStay`, `maxStayShare` und `maxStayValues` tragen den Befund.

`24 h` ist dabei **kein Platzhalter** wie Hamburgs `9999`: Die 35 Automaten,
die ihn tragen, sind genau die mit Tagespauschale. Wer dort 25 Stunden steht,
steht zu lange.

### 2.7 `rawHours` und `rawFee` werden mit `·` verbunden, nicht mit `;`

Ein im Probelauf gefundener Fehler. Frankfurt verbindet die Rohtexte mehrerer
Automaten mit `'; '` — in Karlsruhe ist das Semikolon aber der Trenner
**innerhalb** eines Wertes. Eine Fläche mit zwei Automaten sah so aus:

```
werktags 8 bis 20 Uhr; werktags 8 bis 20 Uhr; Tagespauschale
```

Daran ist nicht mehr zu erkennen, wo der eine Automat aufhört. Betroffen war
genau eine der 279 Flächen; bei den Preistreppen wäre es jede mit zwei Tarifen
gewesen.

### 2.8 Der Stadtteil kommt aus dem Automaten

Der Dienst führt keine Verwaltungsgrenzen, das Transparenzportal auch nicht
(Abschnitt 5). Die Automaten tragen aber `stadtteil` — 13 Werte über die
Karlsruher Zeilen, von Innenstadt-West (75) bis Nordstadt (1). **Alle 279**
ausgelieferten Flächen bekommen darüber einen Stadtteil; keine bleibt ohne.

---

## 3. Was der Datenbau erzeugt

Probelauf am 8. September 2026 gegen die echten Abzüge:

```
279 von 282 Stellplatzflächen übernommen — 3 ohne Automaten innerhalb von 20 m
    ausgelassen, 0 ohne Stadtteil-Angabe
278 städtische Automaten benutzt, 360 Zeilen anderer Gemeinden oder fremder
    Betreiber verworfen (von 638)
243 POI (Behindertenparkplätze und Park-and-Ride)
```

| Datei | Größe | Inhalt |
| --- | --- | --- |
| `zones.geojson` | 238 KB | 279 Stellplatzflächen |
| `poi.geojson` | 42 KB | 224 Behindertenparkplätze, 19 Park-and-Ride |
| `districts.geojson` | 0 KB | **leer** — es gibt keine Quelle |
| `umweltzone.geojson` | 0 KB | leer, siehe Abschnitt 5 |

Verteilung der Tarife über die 279 Flächen: 184 × 3,00 €/h, 93 × 6,00 €/h,
2 × unbekannt. Höchstparkdauer: 148 × `2h`, 93 × `1h`, 37 × `24h`, 1 × beides.
`unmodelledRules`: 36 Flächen mit `Tagespauschale`, 243 ohne.

---

## 4. Die Schnipsel — bitte hier eintragen

> **Eingetragen am 9. September 2026**, auf Anweisung des Betreibers — die
> Schnipsel unten stehen seitdem so im Code. Der Abschnitt bleibt als Beleg
> dafür, was wie begründet ist.

### 4.1 `app/packages/core/src/city.ts`

Einfügen nach `MUENCHEN`, und `CITIES` erweitern.

```ts
/**
 * Karlsruhe — die fünfte Stadt, und die erste unter einer dritten
 * Lizenzfamilie: Creative Commons Namensnennung 4.0 statt Datenlizenz
 * Deutschland.
 *
 * Die Box ist gemessen, nicht geschätzt, und sie stammt **nicht** aus der
 * Parkebene: Die bewirtschafteten Flächen liegen zwischen 8,3421 und 8,4764
 * Länge — wer die Box daraus nähme, wiese eine Meldung aus Neureut oder
 * Grötzingen als „außerhalb" ab, obwohl sie mitten in Karlsruhe liegt. Der
 * Umriss kommt aus den 188 Wahlbezirken des Wahlkreises „Karlsruhe-Stadt"
 * (Transparenzportal, Datensatz `bundestagswahl-2017`, GeoJSON in CRS84): Sie
 * decken das ganze Stadtgebiet ab und messen 8,2774–8,5418 / 48,9405–49,0912.
 * Nach außen gerundet steht das unten; es entspricht der amtlichen Ausdehnung
 * von rund 19 km Ost-West und 16 km Nord-Süd.
 *
 * Der Mittelpunkt ist der Marktplatz mit der Pyramide. Der Zoom ist Frankfurts
 * 12 und nicht Berlins 11,5: 0,28° Länge sind weniger als Frankfurts 0,40°,
 * und die 279 Stellplatzflächen liegen in einem Band von 9,8 × 5,3 km zwischen
 * Mühlburg und Durlach.
 *
 * `holidays` fehlt mit Absicht: Baden-Württemberg kennt anders als Bayern
 * keine gemeindeweise geregelten Feiertage (Begründung in `holidays.ts` beim
 * neuen `BW`-Eintrag).
 */
export const KARLSRUHE: City = {
  key: 'karlsruhe',
  name: 'Karlsruhe',
  land: 'BW',
  center: [8.4037, 49.0094],
  zoom: 12,
  reportBounds: { minLon: 8.27, minLat: 48.93, maxLon: 8.55, maxLat: 49.1 },
  sessionBounds: { minLon: 8.0, minLat: 48.7, maxLon: 8.9, maxLat: 49.35 },
  attribution: {
    /**
     * Anders als Frankfurt und München nennt der Metadatensatz **keinen**
     * wörtlichen Quellenvermerk. Was er nennt: die herausgebende Stelle
     * (`organization.title` = „Stadt Karlsruhe"), den Urheber
     * (`author` = „Digitale Mobilität") und das Portal. CC BY 4.0 § 3 a) 1) A)
     * verlangt die Nennung des Urhebers „in any reasonable manner"; beides
     * zusammen ist die belegbare Form.
     */
    source: 'Stadt Karlsruhe (Digitale Mobilität), transparenz.karlsruhe.de',
    // Die Adresse, die der Datenbau wirklich abruft — nicht die Portalseite.
    datasetUrl: 'https://mobil.trk.de/geoserver/TBA/ows',
    licence: 'Creative Commons Namensnennung 4.0 International (CC BY 4.0)',
    licenceUrl: 'https://creativecommons.org/licenses/by/4.0/',
    attributionRequired: true,
  },
  // Bewusst ohne `towedVehicles`: Aus dieser Sitzung liess sich keine
  // Karlsruher Verwahrstelle aus einer amtlichen Seite belegen. Fehlt das
  // Feld, zeigt die Oberfläche den Abschnitt nicht — kein Rückfall auf Berlin.
}

export const CITIES: readonly City[] = [BERLIN, HAMBURG, FRANKFURT, MUENCHEN, KARLSRUHE]
```

Geprüft: Die Box überschneidet sich mit **keiner** der vier vorhandenen
`reportBounds` (der Test in `city.test.ts` bleibt grün), und alle 4.773
Stützpunkte der erzeugten `zones.geojson` und `poi.geojson` liegen darin. Was
sie mit einschließt, ist der Nordrand von **Ettlingen** — eine Box ist keine
Gemarkungsgrenze, und `reportBounds` ist als Plausibilitätsschranke gedacht,
nicht als Verwaltungsgrenze. Dasselbe gilt in Berlin für Teile von Potsdam.

### 4.2 `app/packages/core/src/index.ts`

Eine Zeile, alphabetisch zwischen `holidays.js` und `muenchen.js`:

```ts
export * from './karlsruhe.js'
```

### 4.3 `app/packages/core/src/holidays.ts`

Zwei Änderungen. Erstens der Typ:

```ts
export type Land = 'BE' | 'HH' | 'HE' | 'BY' | 'BW'
```

Zweitens der Eintrag in `REGIONAL`:

```ts
  BW: { fixed: ['01-06', '11-01'], fromEaster: [60] }, // Drei Könige, Allerheiligen, Fronleichnam
```

Und in den Kommentar über `REGIONAL`, in der Liste der Belege:

```
 * - **BW** — Baden-Württemberg hat **zwölf** landesweite Feiertage: die neun
 *   bundesweiten plus Heilige Drei Könige, Fronleichnam und Allerheiligen.
 *   Der Eintrag ist damit **zeichengleich mit dem bayerischen** — und
 *   trotzdem eine eigene Zeile, weil er einen eigenen Beleg hat und weil sich
 *   die beiden Länder jederzeit auseinanderentwickeln können. Der Unterschied
 *   liegt woanders: Bayerns Mariä Himmelfahrt gilt gemeindeweise und hängt
 *   deshalb an `City.holidays`; Baden-Württemberg kennt **keine**
 *   gemeindeweise Regelung, Karlsruhe braucht also kein `holidays`-Feld.
 *   Reformationstag und Buß- und Bettag sind in Baden-Württemberg
 *   ausdrücklich **keine** gesetzlichen Feiertage, sondern kirchliche (der
 *   31. Oktober ist schulfrei, mehr nicht) — wer sie mitnimmt, meldet an zwei
 *   Werktagen im Jahr „gebührenfrei". Quellen: § 1 Abs. 1 FTG BW und die
 *   Feiertagsseite des Innenministeriums,
 *   <https://im.baden-wuerttemberg.de/de/service/feiertage>, abgerufen am
 *   8. September 2026.
```

**Achtung:** In `karlsruhe.test.ts` steht ein Stolperdraht, der beim Eintragen
**rot wird** — und zwar mit Absicht:

```ts
it('kennt Baden-Württemberg noch nicht — und sagt es laut', () => {
  expect(() => holidaysFor('BW' as Land, 2026)).toThrow(/Kein Feiertagskalender/)
})
```

Sobald `BW` in `REGIONAL` steht, gehört dieser Test durch einen ersetzt, der
den Kalender gegen die Quelle hält, und `land: 'BY'` im Block „eine Karlsruher
Fläche im gemeinsamen Tarifmodell" wird zu `land: 'BW'` (der Kommentar dort
erklärt, warum bis dahin Bayern stellvertretend steht).

### 4.4 `app/packages/ingest/src/sources.ts`

Einfügen vor `BY_CITY`:

```ts
/**
 * Karlsruhe — Stadt Karlsruhe über die TechnologieRegion, CC BY 4.0.
 *
 * Zahlen und Typnamen sind am 8. September 2026 mit `resultType=hits` gegen den
 * Dienst selbst geprüft, nicht aus Metadaten übernommen.
 *
 * **Ein Dienst, 41 Typnamen — und keiner davon nur für Karlsruhe.**
 * `mobil.trk.de` gehört der TechnologieRegion und führt elf Gemeinden bis nach
 * Haguenau und Saverne im Elsass. Der Filter sitzt deshalb nicht hier, sondern
 * im Datenbau: `isKarlsruheMachine` in `@knoellchenfrei/core`. Eine
 * WFS-Filterabfrage wäre der elegantere Weg, macht die Adresse aber von der
 * Filtersyntax des Servers abhängig — und `expectedFeatures` unten prüft dann
 * nicht mehr, ob der Abruf still abgeschnitten wurde.
 *
 * Bewusst NICHT abgerufen: `TBA:carsharing_stationen` (führt keine `gemeinde`
 * und reicht bis Kaiserslautern), `TBA:parkscheiben` (363 Punkte,
 * Parkscheibenzonen — eine eigene Frage, die diese App heute nicht stellt),
 * `TBA:umweltzonen` (TRK-weit, ohne `gemeinde`, ungeprüft) und die 34 übrigen
 * Ebenen (Baustellen, Blitzer, Fähren, Traumrouten …).
 */
const KARLSRUHE_TBA = 'https://mobil.trk.de/geoserver/TBA/ows'

const KARLSRUHE_DEFAULTS = {
  // GeoServer wie in Berlin, Frankfurt und München: `application/json`.
  // Hamburgs `application/geo+json` quittiert dieser Dienst mit HTTP 400.
  outputFormat: 'application/json',
  // `DefaultCRS` ist EPSG:25832 — ohne `srsName` kämen also UTM-Meter.
  // `wfsUrl` setzt ihn; die Antwort ist dann `[8.4589, 48.9976]`, also
  // `[lon, lat]` wie überall ausser in Hamburg.
  axisOrder: 'lon,lat',
} as const

const KARLSRUHE_SOURCES: readonly Source[] = [
  // Die „Zonen" sind hier die Stellplatzflächen selbst — 282 Polygone von im
  // Median 128 m². Sie tragen kein einziges Sachdatum; Begründung und
  // Messungen in `docs/staedte-karlsruhe.md`.
  {
    key: 'zones',
    service: KARLSRUHE_TBA,
    typeName: 'TBA:parkscheinautomaten_flaechen',
    expectedFeatures: 282,
    ...KARLSRUHE_DEFAULTS,
  },
  // Die eigentliche Sachauskunft. Wie in Frankfurt und München hängen Tarif und
  // Zeiten nicht an der Fläche, sondern am Automaten daneben.
  {
    key: 'machines',
    service: KARLSRUHE_TBA,
    typeName: 'TBA:parkscheinautomaten',
    expectedFeatures: 638,
    ...KARLSRUHE_DEFAULTS,
  },
  {
    key: 'accessible',
    service: KARLSRUHE_TBA,
    typeName: 'TBA:behinderten_parkplaetze',
    expectedFeatures: 694,
    ...KARLSRUHE_DEFAULTS,
  },
  {
    key: 'parkAndRide',
    service: KARLSRUHE_TBA,
    typeName: 'TBA:park_ride',
    expectedFeatures: 171,
    ...KARLSRUHE_DEFAULTS,
  },
]
```

Und in `BY_CITY`:

```ts
  karlsruhe: KARLSRUHE_SOURCES,
```

**Kein `districts`-Eintrag.** Das ist kein Vergessen — siehe Abschnitt 5.

### 4.5 `app/packages/ingest/package.json`

```json
    "build-data-karlsruhe": "tsx src/build-data-karlsruhe.ts",
```

---

## 5. Was offen bleibt

### 5.1 **Blockierend:** Eine 4,8 m breite Zone trifft keine Ortung

> **Beantwortet am 9. September mit Frage 1:** `zoneAt` bleibt strikt, daneben
> steht `zoneNear` mit dem Radius aus `City.zoneSnapMetres` — für Karlsruhe
> 20 m, derselbe gemessene Wert wie bei der Zuordnung Automat → Fläche in
> Abschnitt 2.2. Nur Städte mit dem Feld bekommen den Rückfall; in Berlin,
> Hamburg, Frankfurt und München ändert sich nichts. Das Panel sagt den
> Abstand („nächste Fläche, etwa 12 m entfernt"). Frage 2, die Rückfrage an
> das Tiefbauamt, bleibt lohnend und ist nicht gestellt.

`zoneAt` in `apps/web/src/zones.ts` fragt strikt Punkt-in-Polygon, ohne
Rückfall. Karlsruhes Zonen sind im Median 128 m² groß und 4,8 m breit; eine
Ortung im Stadtgebiet ist auf 10 bis 20 m genau. Die App würde also an einem
Karlsruher Parkscheinautomaten der Reihe nach „außerhalb der
Parkraumbewirtschaftung" sagen — genau die Antwort, die dieses Projekt schon
einmal ausgebaut hat, weil sie etwas über den Ort behauptet, das sie nicht
weiß.

**Karlsruhe darf deshalb nicht ausgeliefert werden, bevor eine der beiden
Fragen beantwortet ist:**

1. Bekommt `zoneAt` einen Rückfall „nächste Zone innerhalb von *R* Metern"?
   Das ist eine Änderung an der geteilten Oberfläche und betrifft alle fünf
   Städte; für Berlin, Hamburg, Frankfurt und München ändert sie nichts (dort
   liegt die Ortung im Polygon), für Karlsruhe entscheidet sie alles. Der
   Radius wäre wieder zu messen — nicht zu wählen.
2. Oder: Führt die Stadt eine Ebene mit Bewirtschaftungs**gebieten**, die der
   WFS nicht zeigt? Das ist eine Rückfrage an das Tiefbauamt bzw. an
   `digitale-mobilitaet@trk.de`, und sie ist billiger als jede Notlösung.

Bis dahin ist die Arbeit hier **vorbereitet und nicht angeschlossen** — genau
der Zustand, in dem Hamburg lange stand.

### 5.2 Keine Verwaltungsgrenzen

Der Dienst führt 41 Typnamen, keinen mit Stadtteil- oder Gemarkungsgeometrie.
Die CKAN-Suche über `transparenz.karlsruhe.de` findet zu „stadtteil" 34
Datensätze, davon **keinen** mit Grenzgeometrie — die
„Stadtteilprofile" sind PDF. Was es gibt: die 188 Wahlbezirke des Wahlkreises
Karlsruhe-Stadt als GeoJSON (aus `bundestagswahl-2017`). Sie sind für die
Stadtgrenze benutzt worden (Abschnitt 4.1), taugen aber nicht als
Kartenhintergrund: Wahlbezirke sind keine Stadtteile, und eine Ebene, die
danach aussieht, wäre schlechter als keine.

Folge: `districts.geojson` bleibt leer, `absent` nennt es, und **ohne
Hintergrundkarte schweben die 279 Stellplatzreihen im Nichts**. Mit
Hintergrundkarte ist das kein Problem — aber die Kartenkacheln sind selbst noch
ein offener Punkt (`docs/todo.md`, „Ein 206 ist noch kein Bild").

### 5.3 CC BY 4.0 — was der `Attribution`-Typ trägt und was nicht

**Der vorhandene Typ trägt Karlsruhe.** `source`, `licence`, `licenceUrl`,
`datasetUrl` und `attributionRequired` reichen aus; es ist **keine
Typänderung nötig**, um die Stadt anzuschließen. Was die Oberfläche heute
zeigt, deckt vier der fünf Punkte aus CC BY 4.0 § 3 a) 1) ab:

| CC BY 4.0 § 3 a) 1) | verlangt | heute in `SettingsSheet.tsx` |
| --- | --- | --- |
| A) i) | Nennung des Urhebers | ✅ `source` |
| A) ii) | Urheberrechtsvermerk, falls mitgeliefert | — keiner mitgeliefert |
| A) iii) | **Hinweis auf diese Lizenz** | ✅ `licence` + `licenceUrl` |
| A) iv) | **Hinweis auf den Gewährleistungsausschluss** | ❌ **fehlt** |
| A) v) | Verweis auf das Material (URI) | ✅ `datasetUrl` |
| B) | **Hinweis auf Veränderungen** | ✅ der Satz „Die Daten sind verändert" |

Der einzige echte Unterschied zur Datenlizenz Deutschland ist **A) iv)**: Die
DL-DE verlangt keinen Hinweis auf den Gewährleistungsausschluss, CC BY 4.0
schon („a notice that refers to the disclaimer of warranties"). Der Satz gilt
außerdem nur für CC-BY-Städte — Berlin, Hamburg, Frankfurt und München
brauchen ihn nicht.

Der saubere Weg dafür wäre ein Feld, das die Lizenz*familie* benennt, statt in
der Oberfläche auf die Zeichenkette `licence` zu prüfen:

```ts
export interface Attribution {
  // … wie bisher …
  /**
   * Welche Lizenzfamilie — nicht welche Lizenz.
   *
   * Der Unterschied ist keine Formalie, sondern ein Satz mehr in der
   * Oberfläche: CC BY 4.0 § 3 a) 1) A) iv) verlangt einen Hinweis auf den
   * Gewährleistungsausschluss, die Datenlizenz Deutschland nicht. Auf den
   * Text von `licence` zu prüfen wäre der bequeme Weg und die falsche
   * Abstraktion — er ist ein Anzeigename und kann sich ändern, ohne dass sich
   * die Auflage ändert.
   */
  licenceFamily: 'dl-de-zero' | 'dl-de-by' | 'cc-by'
}
```

Und in `SettingsSheet.tsx`, hinter dem vorhandenen `attributionRequired`-Block:

```tsx
{CITY.attribution.licenceFamily === 'cc-by' && (
  <p className="sheet__hint">
    Creative Commons verlangt zusätzlich den Hinweis, dass die Daten{' '}
    <strong>ohne Gewährleistung</strong> bereitgestellt werden — soweit
    rechtlich zulässig, „wie besehen".
  </p>
)}
```

Das ist **nicht** dringend genug, um den Anschluss aufzuhalten, und es rührt an
einen Typ, den vier Städte benutzen. Es gehört in einen eigenen Schritt.

### 5.4 Kleineres

- **`TBA:parkscheiben`** — 363 Punkte, davon 154 in Karlsruhe:
  Parkscheibenzonen mit `parkzeit` und `max_parkdauer`, ohne Gebühr. `Fee` hat
  dafür `disc`, und Hamburg beantwortet die Frage schon. Karlsruhe könnte das
  auch — es ist aber ein zweiter Zonentyp mit einer eigenen Geometriefrage
  (auch hier sind es Punkte, keine Flächen) und gehört nicht in denselben
  Schritt.
- **Umweltzone** — Karlsruhe hat seit 2009 eine, und `TBA:umweltzonen` führt
  sie. Die Ebene ist TRK-weit und ohne `gemeinde`; sie zu übernehmen hieße, sie
  über die Box zu filtern, und das ist geraten. `absent` in `meta.json` sagt
  deshalb ausdrücklich „nicht in diesem Abzug" und nicht „gibt es nicht".
- **Stellplatzzahlen** — `stellplaetze` steht am Automaten und zählt, was
  *er* bedient; ein Automat bedient oft mehrere Flächen. Die Zahlen zu
  addieren zählte dieselben Plätze mehrfach, die eines einzelnen zu übernehmen
  schriebe einer 30-Meter-Reihe die 250 Plätze eines ganzen Parkplatzes zu.
  `spaces` bleibt `null`. In der Summe über alle Automaten ist die Zahl aber
  belastbar: **3.367 bewirtschaftete Stellplätze**.
- **`bemerkung`** — sieben Werte in Karlsruhe, darunter drei nackte URLs
  (die fremd betriebenen Parkplätze) und
  `Sonderbetriebszeit wegen Notariat`. Der Datenbau liest das Feld heute nicht;
  wer es aufnimmt, muss die URLs abfangen, statt sie in einen Hinweistext zu
  schreiben.
- **Der Datensatz ist regional, nicht städtisch.** Wenn die App eines Tages
  Ettlingen, Rastatt oder Bruchsal will, liegt alles schon im selben Dienst —
  nötig wären dann je Stadt eigene Boxen, eigene Gebührentabellen und, für
  Haguenau und Saverne, ein französischer Parser samt französischem
  Feiertagskalender. Das ist keine Erweiterung von `karlsruhe.ts`, sondern eine
  eigene Datei; die Regel „ein Feed, ein Parser" gilt auch innerhalb eines
  Dienstes, sobald die Sprache wechselt.

---

## 6. Stand der Prüfungen

```
pnpm --filter @knoellchenfrei/core typecheck   ✓
pnpm --filter @knoellchenfrei/core test        ✓  606 Tests (25 Dateien), davon 69 neu
./scripts/sprache-pruefen.sh                   ✓
```

`pnpm --filter @knoellchenfrei/ingest typecheck` meldet **zwölf** Fehler, alle
in `build-data-karlsruhe.ts` und alle derselben Art: `Module
'"@knoellchenfrei/core"' has no exported member 'KARLSRUHE'`, `…
'parseKarlsruheSchedule'` und so weiter. Sie verschwinden mit den beiden
Schnipseln aus 4.1 und 4.2. Der Datenbau selbst ist am 8. September gegen die
echten Abzüge durchgelaufen — mit lokal gestellten Konstanten, damit keine
Datei angefasst werden musste, an der der Köln-Agent parallel gearbeitet hat.
