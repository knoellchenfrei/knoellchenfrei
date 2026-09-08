# Köln als fünfte Stadt — gemessen, entschieden, offen

> **Wo der Code liegt.** Dieser Bericht steht auf dem Arbeitszweig, der
> zugehörige Code auf `staedte/koeln-karlsruhe-vorbereitet`. Getrennt, weil die
> Datenbauten Namen aus `core` importieren, die es ohne die drei einzutragenden
> Dateien nicht gibt — auf dem Arbeitszweig wäre `pnpm -r typecheck` dauerhaft
> rot, und ein dauerhaft roter Typecheck macht das nächste echte Problem
> unsichtbar.

> **Stand 8. September 2026.** Parser, Umprojektion, Datenbau und Tests liegen
> im Repository; angeschlossen ist Köln damit **noch nicht**. Was dafür fehlt,
> steht unten unter „Was einzutragen bleibt" — drei Dateien, die dieser
> Arbeitsschritt bewusst nicht angefasst hat, weil parallel an Karlsruhe
> gearbeitet wurde.

Alle Zahlen hier sind an diesem Tag gegen die Dienste selbst gemessen, nicht
aus [docs/staedte-recherche-2026-09.md](staedte-recherche-2026-09.md)
übernommen. Wo die Messung von der Recherche abweicht, steht es dabei.

## Die zwei Quellen

| | Bewohnerparkgebiete | Parkscheinautomaten |
| --- | --- | --- |
| Art | WFS 2.0.0 (MapServer) | CSV |
| Adresse | `https://geoportal.stadt-koeln.de/wss/service/bewohnerparken_wfs/guest` | `https://www.offenedaten-koeln.de/sites/default/files/distribution/psa_2016.csv` |
| Typname / Datei | `ms:bewohnerparkgebiete_zonen` | `psa_2016.csv`, 302 KB, UTF-8, CRLF |
| Umfang | `numberMatched="47"` | 2.315 Zeilen |
| Inhalt | Name, Kürzel, Gebietsseite, Polygon | Adresse, Stellplätze, Gebührenzeit, Gebühr, Höchstparkdauer, Tagesgebühr, Koordinaten |
| Lizenz | DL-DE/Zero-2.0, wörtlich in `ows:AccessConstraints`; `ows:Fees: keine` | DL-DE/Zero-2.0 laut Portalseite |
| Aktualität | — | Portal: „Aktualisierung: 27.11.2025", Veröffentlichung 10.05.2024, Rhythmus jährlich |

Der Dienst führt eine zweite Ebene, `ms:bewohnerparkgebiete_weiche_grenzen`
mit **15** Linien (die Recherche nannte keine Zahl). Ihr Attribut `Gebiete`
nennt je zwei benachbarte Gebiete — es sind die „weichen Grenzen", an denen ein
Bewohnerausweis beidseitig gilt. Für die Frage „kostet Parken hier gerade
etwas" trägt die Ebene nichts bei; der Datenbau holt sie nicht.

**Eine Korrektur an der Recherche:** Ansprechpartner ist laut Portalseite das
**Amt für Verkehrsmanagement**, `verkehrsmanagement@stadt-koeln.de` (als
Autor, Bearbeiter und Urheber). Das Amt für nachhaltige Mobilitätsentwicklung
steht dort als *Verwalter*.

## Der Dienst rechnet nicht um — und behauptet das Gegenteil

Die Recherche schrieb, der WFS „ignoriert `srsName` vollständig". Gemessen ist
es schlimmer als das:

| Anfrage | Antwort |
| --- | --- |
| ohne `srsName`, GeoJSON | `[366433.216, 5638278.57]` |
| `srsName=EPSG:4326`, GeoJSON | **byteweise dieselbe Datei** (242.711 Bytes) |
| `srsName=urn:ogc:def:crs:EPSG::4326`, GeoJSON | **byteweise dieselbe Datei** |
| `srsName=urn:ogc:def:crs:EPSG::4326`, GML | `srsName="urn:ogc:def:crs:EPSG::4326"`, darin `5638278.570000 366433.216000` |
| `srsName=urn:ogc:def:crs:EPSG::3857`, GML | `srsName="…::3857"`, darin `366433.216000 5638278.570000` |

Der Dienst **dreht die Achsen** nach der Reihenfolge des angeforderten Systems
und **schreibt dessen Namen** an die Geometrie — er rechnet nur nicht um. Wer
dem `srsName` glaubt, legt Köln bei 5.638.278° Nord ab, und die Karte sieht
dabei nur leer aus. Das ist die Steigerung von Frankfurts und Münchens stillem
UTM-Rückfall: Dort fehlte eine Angabe, hier ist eine da und sie ist falsch.

Zwei Folgen für den Code:

1. Köln braucht als einzige Stadt eine eigene Umprojektion,
   `packages/ingest/src/utm32.ts`.
2. `build-data-koeln.ts` prüft mit `assertUtm`, dass wirklich Meter ankommen —
   die Umkehrung von `assertDegrees`. Fängt die Stadt eines Tages an,
   `srsName` zu beachten, bricht der Lauf ab, statt ein zweites Mal
   umzurechnen.

Und eine dritte, die leicht übersehen wird: Sollte der Dienst im **GeoJSON**
eines Tages auch die Achsen drehen (im GML tut er es schon), käme `[Nord, Ost]`
an. `utm32ToWgs84` fängt das, weil ein Nordwert von 5,64 Millionen weit über
der Zonengrenze von 900.000 für den Ostwert liegt. Beide Zahlen sind für sich
plausible UTM-Werte; das ist die einzige Prüfung, die den Fall bemerkt.

## Die Umprojektion, und wie sie belegt ist

`utm32ToWgs84` ist die Krüger-Reihe in Karneys Form, vier Reihenglieder, auf
dem GRS-80-Ellipsoid (ETRS89, nicht WGS 84 — der Unterschied liegt in der
elften Nachkommastelle der Abplattung). Ohne Fremdbibliothek: `proj4` wiegt
rund 200 KB für 4.000 Koordinatensysteme, gebraucht wird eines.

Belegt wird sie **gegen eine andere Behörde als die geprüfte** — der Kölner
Dienst taugt als Referenz ja gerade nicht. Der WFS des Landes
Nordrhein-Westfalen für die Verwaltungsgebiete
(`https://www.wfs.nrw.de/geobasis/wfs_nw_dvg`, Typname `dvg:nw_dvg1_gem`)
rechnet korrekt um und führt dieselbe Stadt. Dieselbe Anfrage einmal in
EPSG:25832 und einmal in EPSG:4326 liefert die Stadtgrenze Kölns mit **4.508
Stützpunkten in derselben Reihenfolge** — also 4.508 Punktpaare desselben
Punktes in beiden Systemen, gerechnet von der Landesvermessung.

Der vollständige Abgleich über alle 4.508 Paare ergab als größte Abweichung
**6,8 · 10⁻⁷ Meter**, also 0,7 Mikrometer. Zwanzig davon — die vier
Extrempunkte der Stadtgrenze und sechzehn gleichmäßig über den Umriss verteilte
— stehen in `packages/ingest/src/utm32.check.ts` und laufen dort gegen eine
Schranke von einem Millimeter:

```
cd app/packages/ingest && npx tsx src/utm32.check.ts
  ✓ 20 amtliche Punktpaare, größte Abweichung 6.8e-7 m (südlichster Punkt
    der Stadtgrenze), Schranke 0.001 m
  ✓ 3 von 3 Fehleingaben abgewiesen
```

Die Aufgabe verlangte „drei bekannte Kölner Punkte auf wenige Meter genau".
Zwanzig amtliche Paare über 43 km Ost-West und 28 km Nord-Süd, auf einen
Millimeter, sind das Tausendfache davon — und sie fangen jeden Fehler, den es
hier geben kann: falsches Ellipsoid, falscher Mittelmeridian, falscher
Maßstabsfaktor, vertauschte Achsen, ein fehlendes Reihenglied.

Die zweite Probe läuft über die Daten selbst: Rechnet man die 47 Gebietspolygone
um und hält die 2.190 brauchbaren Automatenkoordinaten aus der CSV (die schon in
Grad vorliegen) dagegen, fallen **1.902** in ein Gebiet und **45 von 47**
Gebieten werden getroffen. Eine Umprojektion, die auch nur 50 Meter daneben
läge, ließe die Automaten an den Gebietsrändern reihenweise herausfallen.

## Die Zeitangabe: 46 Schreibweisen, und das Plus bedeutet zweierlei

Die Spalte `Gebührenzeit` hat 46 verschiedene Werte. Die Recherche nannte das
`+` als „Trenner für zusammengesetzte" — gemessen ist es **beides**:

```
Mo-Fr 09:00 - 21:00 + Sa 10:00 - 15:00           ← + trennt zwei Klauseln
Mo-Mi+Fr 09:00 - 20:00; Do + Sa 15:00 - 20:00    ← + verbindet Wochentage
Mo-Mi+Fr 09:00 - 18:00; Do 14:00 - 18:00 + Sa 09:00 - 14:00   ← beides, eine Zeile
```

Wer `+` fest als Trenner liest, macht aus `Mo-Mi+Fr 09:00 - 20:00` zwei
Klauseln, von denen die eine keine Zeit und die andere keine Tage hat. Wer es
fest als Tagesverbinder liest, hängt `Sa 10:00 - 15:00` an dieselbe Spanne wie
`Mo-Fr 09:00 - 21:00` und lässt samstags eine Stunde früher kassieren, als die
Stadt es tut.

Die Auflösung braucht keine Heuristik, nur die Reihenfolge: **Ein `+` trennt
genau dann, wenn die laufende Klausel ihre Spanne schon hat.** Dasselbe gilt
für einen Wochentag nach vollständiger Spanne — `Mo-Fr 09:00 - 18:00; Sa 09:00
- 14:00` kommt ohne `+` aus. Das `;` trennt immer. Damit gehen alle 46 Werte
durch, ohne Sonderfall.

Weitere gemessene Eigenheiten:

- **`;` als zweiter Trenner** — in der Recherche nicht erwähnt, sieben Zeilen.
- **Fenster über Mitternacht**: `09:00 - 01:00` (159 Automaten),
  `19:00 - 01:00` (3), `Mo-So 09:00 - 01:00` (1). Der zweite Teil landet auf
  dem **Folgetag**; bei `Mo-Sa` heißt das: auch Sonntag von 0 bis 1 Uhr.
- **`Mo-So`, 87 Automaten.** Der Sonntag ist wörtlich gemeint, und die Stadt
  bestätigt es aus zweiter Quelle: Auf „Parken rund um die Uhr" schreibt sie,
  an Sonn- und Feiertagen sei das Parken frei — „Ausnahmen sind der Nahbereich
  der LANXESS arena, am Kölner Zoo und an der Koelnmesse". Genau dort stehen
  die 87: Deutz (45), Zoobrücke und Riehler Straße (6), Agnesviertel,
  Hohenlind, Chorweiler, Belgisches Viertel.
- **Ein überzähliges „Uhr"** in genau einer Zeile.
- **Jeder der 46 Werte beginnt mit einer Tagesangabe.** Anders als München
  schweigt Köln nie über die Wochentage — deshalb hat dieser Parser **keine**
  Vorgabe und braucht auch keine. Ein Test hält das fest.

### Der uneindeutige Beginn

Sieben Automaten auf der Frankfurter Straße in Mülheim tragen einen
Schrägstrich:

```
Mo-Sa 12:00/18:00 - 20:00   (4×)
Mo-Sa 09:00/18:00 - 20:00   (2×)
Mo-Sa 09:00/12:00 - 20:00   (1×)
```

Zwei Anfangszeiten, und die Quelle sagt nicht, wann welche gilt. Die spätere zu
nehmen ließe eine Stunde gebührenfrei aussehen, die es nicht ist; die frühere
behauptete eine Gebühr, die vielleicht nicht anfällt. Die Klausel ergibt
deshalb **kein Fenster** und landet in `unmodelled` — dieselbe Behandlung wie
Berlins „Advents-Sa". Das Gebiet Mülheim trägt seine Zeiten ohnehin aus 67
weiteren Automaten.

## Die Höchstparkdauer

Zwölf Werte über den Abzug, als nackte Stundenzahl: 4 (1.697×), 9 (189), 12
(157), 2 (93), 14 (92), 7 (44), 10 (23), 11 (5), 16 (4), 8 (4), 1 (3) — und
**0**, viermal. Wie Hamburgs `9999` ein Platzhalter, dessen Bedeutung der
Datensatz nicht nennt. Die vier Zeilen (Josefstr. 6 in Porz, Olpener Str. 9-13
in Kalk, Geibelstr. 29 in Lindenthal-Süd, Elstergasse 3 am Neumarkt) tragen
alle eine gewöhnliche Gebührenzeit und eine gewöhnliche Gebühr; es fehlt nur
diese eine Angabe. `parseKoelnMaxStay('0')` liefert deshalb `undefined` und
nicht 0 — 0 Minuten hieße „Parken verboten", und das steht dort nicht.

## Die Entscheidung zur Gebühr

**Köln zeigt keinen Betrag.** Jedes Gebiet bekommt `Fee = { kind: 'unknown' }`,
`rawFee` bleibt leer, und `sourceDefect` sagt in einem Satz, dass die Quelle
einen Betrag nennt und warum er nicht angezeigt wird.

Der Datensatz kennt genau zwei Werte: `0,50 €` (1.313 Automaten) und `1,00 €`
(1.002) je 20 Minuten, also **1,50 €** und **3,00 €** je Stunde. Vier Belege,
dass das nicht der geltende Tarif ist:

1. **Die Datei widerspricht der Stadt in einer Spalte, die sie selbst
   beschriftet.** Ihre elfte Spalte heißt wörtlich `Tagesgebühr 4,00 €`. Auf
   der Seite „Parken rund um die Uhr" schreibt die Stadt Köln heute (abgerufen
   am 8. September 2026): „Auf etwa 13.300 Stellflächen … beträgt die
   Parkgebühr für 24 Stunden **5 Euro**." Das ist kein Indiz, sondern ein
   Widerspruch zwischen zwei Aussagen derselben Behörde, gemessen am selben
   Tag.
2. **Weder der neue noch der vorherige Stundensatz taucht im Datensatz auf.**
   Die Pressemitteilung zur Parkgebührenordnung
   (<https://www.stadt-koeln.de/politik-und-verwaltung/presse/mitteilungen/27174/index.html>,
   22. November 2024, abgerufen am 8. September 2026) nennt für das
   Kurzzeitparken 5 € je Stunde in Innenstadt/Deutz „vormals 4 Euro" und 2,50 €
   in den Stadtbezirken 2 bis 9 „vormals 2 Euro". 1,50 € und 3,00 € sind
   keines von vieren.
3. **Der Dateiname.** Die Distribution heißt `psa_2016.csv`. Das Portal weist
   sie zugleich als am 27. November 2025 aktualisiert aus — die Pflege trifft
   also andere Spalten als die Gebühr. Eine Datei, die nachweislich
   fortgeschrieben wird und trotzdem einen Tarif von vorgestern führt, ist der
   schlechtestmögliche Fall: Sie sieht frisch aus.
4. **Der Umfang stimmt auch nicht.** Die Stadt nennt auf ihrer Seite
   „Parkscheinautomaten in Köln" **2.750** Automaten; die Datei führt 2.315.

Warum nicht der naheliegende Ausweg, den Wert als „Stand 2016" zu beschriften:
Das Panel dieser App beantwortet die Frage „was kostet das hier gerade". Eine
Zahl mit Jahreszahl daneben wird als Preis gelesen und nicht als Fußnote — und
sie wäre um den Faktor 1,7 bis 3,3 zu niedrig. Das Projekt hat für diesen Fall
zwei Regeln, und beide zeigen in dieselbe Richtung: „Nicht raten, wenn die
Quelle schweigt" (hier: wenn sie nachweislich Veraltetes sagt) und „Kein Betrag
ist nicht null Euro" — `Fee.unknown` ist genau dafür da, und die Oberfläche
kann damit umgehen, weil München seit dem 7. September denselben Zustand hat.

Der Unterschied zu München gehört trotzdem festgehalten: Dort **schweigt** die
Quelle, hier **irrt** sie. Deshalb bekommt Köln zusätzlich einen
`sourceDefect`-Satz; ohne ihn hielte jemand, der die CSV selbst öffnet, die App
für unvollständig.

`parseKoelnFee` existiert trotzdem, mit Tests: Sie rechnet 20 Minuten auf die
Stunde hoch und ist der Schalter, den jemand umlegt, sobald die Stadt die Datei
fortschreibt. Was fehlt, ist der Beleg, nicht der Code. Und wie in den drei
anderen Gebührenparsern bricht sie bei `0,00 €` ab — der einzige Weg, an
`CostEstimate.priced` vorbei ein „0,00 €" auf den Schirm zu bringen.

## Die CSV ist keine Liste von Semikolons

Sieben der 2.315 Zeilen tragen die Gebührenzeit in Anführungszeichen, weil sie
selbst ein Semikolon enthält:

```
5;Liverpooler Platz A;50765;Chorweiler;…;"Mo-Mi+Fr 09:00 - 20:00; Do + Sa 15:00 - 20:00";0,50 €;4;;51,021261;6,898092
```

Eine achte Zeile schreibt ein verdoppeltes Anführungszeichen
(`"""Hagen""-Gelände"`). Ein `line.split(';')` zerlegt genau diese acht falsch,
und zwar leise: Aus einer Gebührenzeit werden zwei Felder, alles dahinter
rutscht um eins, und die Koordinate landet in der Spalte der Höchstparkdauer.
Es sind ausgerechnet die interessantesten Werte des ganzen Datensatzes.

Deshalb liest `parseKoelnAutomats` nach RFC 4180 statt zu splitten — in
`packages/core`, weil das fremde Eingaben zerlegt. Die Datei ist UTF-8 ohne BOM
mit CRLF; der Leser kommt mit beidem und mit LF zurecht.

Der **Dateikopf wird geprüft**, nicht geglaubt. Zwei Gründe: Eine umbenannte
Spalte ergäbe überall den leeren Wert, und leer heißt bei drei der vier Parsern
„keine Angabe" — der Datenbau liefe durch und lieferte 47 Gebiete ohne Zeiten
aus. Und die Bezugsdauer der Gebühr steht **im Spaltennamen**: Würde daraus
`Gebühr je 30 Minuten`, wäre jede Umrechnung falsch, und nichts am Wert selbst
verriete es.

## Die kaputten Koordinaten

Die CSV führt die Koordinaten bereits in Grad (WGS 84), mit Dezimalkomma, in
zwei Spalten, **Nord vor Ost** — also Breite vor Länge, umgekehrt zu GeoJSON.

- **106 Zeilen** lassen beide Spalten leer.
- **19 Zeilen** stehen erkennbar nicht in Köln:

| Fall | Zeilen | Beispiel |
| --- | --- | --- |
| Dezimalkomma im Ostwert fehlt | 12 | `50,957921` / `7008383` (Graf-Adolf-Str., Mülheim) |
| Eine Ziffer vertippt | 6 | `90,94144` (Burgmauer 8), `9,95552` (Richartzstr.), `50,3736` (Pfeilstr.) |
| Führende Fünf fehlt | 1 | `0,93180819` (Biggestr.) |

Bei jeder einzelnen ist die Reparatur naheliegend und bei keiner belegt. Ein
Automat, den man an einen plausiblen Ort repariert hat, trägt seine Zeiten in
das Gebiet, in dem er *nach* der Reparatur liegt — und das sähe auf der Karte
nach nichts aus. `koelnAutomatPosition` gibt deshalb `null` zurück.

Zusammen 125 von 2.315, also **5,4 %**. Der Datenbau bricht ab, wenn der Anteil
über 10 % steigt: Einzeln wegzuwerfen ist richtig, stillschweigend die Hälfte
wegzuwerfen wäre es nicht.

## Die Zuordnung Automat → Gebiet

Über die **Geometrie**, wie in Frankfurt und anders als in München. Gemessen:

| | Punkt-in-Polygon | Spalte `Bezirk/Gebiet` |
| --- | --- | --- |
| zugeordnete Automaten | **1.902** von 2.315 | 1.638 |
| erreichte Gebiete | 45 von 47 | 25 von 47 |

`Bezirk/Gebiet` ist kein Schlüssel, sondern eine Beschriftung: Sie schreibt
`City/Martinsviertel`, wo das Gebiet `City-Martinsviertel` heißt,
`Lindenthal Süd I` gegen `Lindenthal-Süd I`, `Ehrenfeld` für vier Gebiete auf
einmal und `lrh. ohne BWP` für alles linksrheinisch außerhalb. Die zweite
Kandidatin, `Roter Punkt` (das Kürzel auf dem Automaten), ist noch schlechter:
530 Zeilen lassen sie leer, sie schreibt `DEUTZ I` neben `Deutz I` und trägt
Mehrfachwerte wie `EIGEL+ AGN I`. Eine Namensangleichung wäre möglich und wäre
geraten; der Punkt ist die Aussage der Stadt über den Ort des Automaten.

Die Gegenprobe steht im Log: 1.096 der 1.902 Zuordnungen nennen in
`Bezirk/Gebiet` dasselbe Gebiet. Läuft das eines Tages weit auseinander, fällt
es auf.

**288 Automaten liegen in keinem Gebiet**, und das ist kein Fehler: Köln
bewirtschaftet auch außerhalb der Bewohnerparkgebiete — die Spalte sagt das
selbst, mit Werten wie `lrh. ohne BWP`, `rrh. ohne BWP`, `Chorweiler` und
`Rodenkirchen`. Diese Automaten gehören zu keinem Polygon, das dieser Dienst
führt. Das ist die wichtigste inhaltliche Grenze des Kölner Datenbestands: Die
App kennt die 47 Bewohnerparkgebiete, nicht die ganze bewirtschaftete Fläche.

**Zwei Gebiete haben keinen einzigen Automaten** — Porz-Grengel und
Lindenthal-Nord III/Piusstraße — und werden ausgelassen, nach demselben
Kriterium wie Hamburgs „ohne Zeitangabe" und Münchens „ohne Abschnitt mit
Parkbezug". Ausgeliefert werden **45** Gebiete mit zusammen **34.498**
Stellplätzen.

## Der Probelauf

```
Köln — Daten bauen …
  zones.geojson: 77 KB
  districts.geojson: 0 KB
  poi.geojson: 0 KB
  umweltzone.geojson: 0 KB
  meta.json: 0 KB

45 von 47 Gebieten übernommen — 2 ohne einen einzigen Automaten
1902 von 2315 Automaten einem Gebiet zugeordnet, 288 außerhalb aller Gebiete,
125 ohne brauchbare Koordinate (5.4 %, Schranke 10 %)
Gegenprobe Name: 1096 von 1902 Zuordnungen nennen dasselbe Gebiet
34.498 Stellplätze an zugeordneten Automaten
```

Die drei leeren Sammlungen sind Absicht: `loadData` in der Web-App holt alle
fünf Dateien und bricht ab, wenn eine fehlt — Frankfurts leere
`umweltzone.geojson` ist dafür der Vorgänger. Köln hat in diesem Dienst weder
Stadtbezirke noch Umweltzone noch POI.

## Feiertage: Nordrhein-Westfalen fehlt

`holidaysFor` kennt heute `'BE' | 'HH' | 'HE' | 'BY'`. **`holidays.ts` ist in
diesem Arbeitsschritt nicht angefasst worden**; hier steht nur, wie der Eintrag
aussähe.

Nordrhein-Westfalen hat **elf** gesetzliche Feiertage: die neun bundesweiten
plus **Fronleichnam** (Ostersonntag + 60) und **Allerheiligen** (1. November).
Kein Reformationstag, kein Buß- und Bettag, kein Frauentag — und, anders als in
Bayern, **keine gemeindeweise Regelung**: Der Eintrag hängt vollständig am
Land, `City.holidays` bleibt für Köln leer.

```ts
// in REGIONAL, holidays.ts
NW: { fixed: ['11-01'], fromEaster: [60] }, // Allerheiligen, Fronleichnam
```

und im Typ:

```ts
export type Land = 'BE' | 'HH' | 'HE' | 'BY' | 'NW'
```

Strukturell ist das der einfachste Eintrag der Tabelle — er braucht dieselbe
Erweiterung um einen österlichen Landesfeiertag, die Hessen schon eingeführt
hat, und sonst nichts.

**Was fehlt, ist der Beleg in der Form, die dieses Projekt verlangt.** Die
Recherche vom 7. September nennt `https://recht.nrw.de` als erreichbar; am
8. September führt der dort verlinkte Weg ins Leere: Die Deep-Links der Form
`br_text_anzeigen?v_id=…` leiten inzwischen auf **fremde** Dokumente um (der
Link aus der Recherche landet bei einer Verwaltungsvorschrift über die Prüfung
von Feuerwehrgeräten), die Slug-URLs antworten mit 404, und die Suche des
Portals läuft über JavaScript. Bevor `NW` in `holidays.ts` steht, gehört § 2
Abs. 1 des Feiertagsgesetzes NW im Wortlaut zitiert — so wie es bei BayFTG und
beim hessischen Innenministerium geschehen ist. Endpunkte zu raten hat hier
sechsmal 404 ergeben; der Weg ist derselbe wie bei Frankfurts Stadtteilen: über
den Katalog, nicht über die Adresszeile.

Bis dahin ist der Zustand **laut**: Eine Zone mit `land: 'NW'` bricht heute mit
`Kein Feiertagskalender für "NW" hinterlegt` ab, statt an Fronleichnam still
zum Zahlen aufzufordern. Ein Test in `koeln.test.ts` hält genau das fest und
gehört ersetzt, sobald der Eintrag steht.

## Was einzutragen bleibt

Drei Dateien sind hier bewusst nicht angefasst worden. Solange die erste Zeile
fehlt, schlägt `pnpm --filter @knoellchenfrei/ingest typecheck` mit zehn
`TS2305`-Fehlern fehl — `build-data-koeln.ts` importiert Symbole, die das
Bündel noch nicht ausgibt.

### 1. `app/packages/core/src/index.ts`

```ts
export * from './koeln.js'
```

(alphabetisch zwischen `holidays.js` und `muenchen.js`)

### 2. `app/packages/core/src/city.ts`

```ts
/**
 * Köln — die fünfte Stadt.
 *
 * Die Box ist gemessen, nicht geschätzt: Der Umriss der Gemeinde Köln aus
 * `dvg:nw_dvg1_gem` des Landes-WFS (4.508 Stützpunkte, abgerufen am
 * 8. September 2026) misst 6,7726–7,1620 / 50,8304–51,0850; nach außen
 * gerundet steht das unten. Die 47 Bewohnerparkgebiete reichen nur
 * 6,8278–7,1075 / 50,8755–50,9752 — wer die Box daraus nähme, wiese eine
 * Meldung aus Chorweiler oder Rodenkirchen als „außerhalb" ab, obwohl dort
 * bewirtschaftet wird und nur kein Bewohnerparkgebiet liegt.
 *
 * Der Mittelpunkt ist der Dom. Der Zoom ist Berlins, Hamburgs und Münchens:
 * 0,39° Länge und 0,25° Breite liegen zwischen Frankfurts 0,40°/0,21° bei
 * Zoom 12 und Hamburgs 0,65°/0,45° bei 11,5 — und Kölns Nord-Süd-Ausdehnung
 * ist die größere von beiden, weil die Stadt von Worringen bis Godorf 28 km
 * misst. Bei 12 fielen Chorweiler im Norden und Porz im Süden aus dem Bild,
 * und in beiden stehen Automaten.
 */
export const KOELN: City = {
  key: 'koeln',
  name: 'Köln',
  land: 'NW',
  center: [6.9583, 50.9413],
  zoom: 11.5,
  reportBounds: { minLon: 6.75, minLat: 50.82, maxLon: 7.18, maxLat: 51.1 },
  sessionBounds: { minLon: 6.45, minLat: 50.6, maxLon: 7.5, maxLat: 51.35 },
  attribution: {
    // DL-DE/Zero-2.0 verlangt keine Nennung; der Quellenvermerk steht
    // trotzdem — freiwillig ist nicht verboten, und Berlin hält es genauso.
    // Wörtlich aus `ows:AccessConstraints` des WFS: „Bereitstellung als
    // OpenData unter Datenlizenz Deutschland - Zero - Version 2.0."
    source: 'Stadt Köln, Amt für Verkehrsmanagement — offenedaten-koeln.de',
    datasetUrl: 'https://geoportal.stadt-koeln.de/wss/service/bewohnerparken_wfs/guest',
    licence: 'Datenlizenz Deutschland Zero 2.0',
    licenceUrl: 'https://www.govdata.de/dl-de/zero-2-0',
    attributionRequired: false,
  },
  // `towedVehicles` fehlt mit Absicht: Für die Kölner Verwahrstelle ließ sich
  // am 8. September keine amtliche Seite mit Namen und Nummer belegen. Fehlt
  // das Feld, zeigt die App den Abschnitt nicht — eine Nummer aus zweiter
  // Hand wäre schlechter als keine.
}
```

und in der Liste:

```ts
export const CITIES: readonly City[] = [BERLIN, HAMBURG, FRANKFURT, MUENCHEN, KOELN]
```

`land: 'NW'` setzt den Eintrag in `holidays.ts` voraus — ohne ihn übersetzt es
nicht, und das ist die richtige Reihenfolge.

Kölns `reportBounds` überschneidet sich mit keiner der vier bestehenden Boxen;
der Test in `city.test.ts`, der das prüft, sollte grün bleiben.

### 3. `app/packages/ingest/src/sources.ts`

Der WFS-Teil passt in die bestehende Form:

```ts
/**
 * Köln — Stadt Köln, DL-DE/Zero-2.0.
 *
 * Die einzige Stadt, deren Dienst `srsName` **nicht** beachtet. Er dreht die
 * Achsen nach dem angefragten System und beschriftet die Geometrie damit,
 * rechnet aber nie um: Es kommen immer UTM-Meter in EPSG:25832.
 * `build-data-koeln.ts` rechnet deshalb selbst (`utm32.ts`) und prüft mit
 * `assertUtm`, dass wirklich Meter ankommen. Details in
 * `docs/staedte-koeln.md`.
 *
 * Bewusst NICHT abgerufen: `ms:bewohnerparkgebiete_weiche_grenzen` (15
 * Linien). Sie markieren, wo ein Bewohnerausweis beidseitig gilt — eine
 * Auskunft für Bewohner, nicht für die Frage „kostet Parken hier gerade
 * etwas".
 */
const KOELN_SOURCES: readonly Source[] = [
  {
    key: 'zones',
    service: 'https://geoportal.stadt-koeln.de/wss/service/bewohnerparken_wfs/guest',
    typeName: 'ms:bewohnerparkgebiete_zonen',
    expectedFeatures: 47,
    // MapServer, und der Wert trägt Semikolon und Leerzeichen — er muss
    // URL-kodiert in die Anfrage. `URLSearchParams` in `wfsUrl` tut das.
    outputFormat: 'application/json; subtype=geojson',
    // Gemessen, nicht geraten: Im GeoJSON kommt [Ost, Nord], und zwar mit und
    // ohne `srsName` byteweise identisch. Im GML dreht der Dienst sehr wohl —
    // sollte er das eines Tages auch im GeoJSON tun, bricht `utm32ToWgs84` ab,
    // weil ein Nordwert im Ostwert die Zonengrenze sprengt.
    axisOrder: 'lon,lat',
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
  koeln: KOELN_SOURCES,
}
```

Die CSV passt **nicht** in `Source` — sie hat keinen Typnamen, kein
Ausgabeformat und keine Achsenreihenfolge. `build-data-koeln.ts` liest sie
deshalb heute schlicht als `.raw/koeln/automats.csv`; der Abruf steht als
`curl`-Zeile im Kopf des Skripts. Wer ihn in `fetch.ts` haben will, braucht
dort einen zweiten Ast — Vorschlag, ungetestet, deshalb hier und nicht im Code:

```ts
// sources.ts
/** Dateien, die kein WFS sind: eine Adresse, ein Dateiname, mehr nicht. */
export interface FileSource {
  key: string
  url: string
  /** Dateiname unter `.raw/<stadt>/`. */
  file: string
}

const KOELN_FILES: readonly FileSource[] = [
  {
    key: 'automats',
    url: 'https://www.offenedaten-koeln.de/sites/default/files/distribution/psa_2016.csv',
    file: 'automats.csv',
  },
]

export function cityFiles(cityKey: string): readonly FileSource[] {
  return cityKey === 'koeln' ? KOELN_FILES : []
}
```

In `fetch.ts` danach eine zweite Schleife über `cityFiles(CITY_KEY)`, die den
Rumpf unverändert schreibt — **ohne** die JSON-Prüfung, die dort für WFS-
Antworten steht: Eine CSV beginnt nicht mit `{`, und `JSON.parse` würde sie
verwerfen.

## Was offen bleibt

1. **Der Feiertagseintrag `NW`** samt Beleg aus dem Feiertagsgesetz NW. Ohne
   ihn übersetzt `land: 'NW'` nicht. Siehe oben.
2. **Die Stadtbezirke.** Köln hat neun; für keinen ließ sich ein Dienst
   belegen. Der Geoportal-Server antwortet auf jeden geratenen Dienstnamen mit
   `403` — auch auf einen erfundenen (`gibtesnicht_wfs`), Raten bringt also
   nichts. Das offene Datenportal ist seit dem Umbau auf Drupal nicht mehr über
   die CKAN-API erreichbar (`/api/3/action/package_show` → 404) und seine Suche
   läuft über JavaScript. Der Weg ist derselbe wie bei Frankfurts Stadtteilen:
   über den Metadatenkatalog. Bis dahin steht in jedem Gebiet `Köln` als
   `district`.
3. **`towedVehicles`.** Keine belegbare Seite gefunden; das Feld fehlt, und die
   App zeigt den Abschnitt dann nicht.
4. **Die Gebühr.** Sobald die Stadt `psa_2016.csv` mit aktuellen Beträgen
   fortschreibt oder einen zweiten Datensatz mit der Gebührenordnung
   veröffentlicht, ist der Schalter `parseKoelnFee` fertig und getestet. Eine
   Rückfrage an `verkehrsmanagement@stadt-koeln.de` wäre der kürzere Weg — sie
   ist nicht gestellt.
5. **Die bewirtschaftete Fläche außerhalb der Bewohnerparkgebiete.** 288
   Automaten (13 % der zugeordneten) liegen in keinem der 47 Polygone. Für sie
   kennt die App keine Fläche, also auch keine Zone. Ob es dafür einen weiteren
   Datensatz gibt, ist ungeprüft.
6. **PMTiles-Kacheln.** `scripts/build-tiles.sh` braucht einen Ausschnitt für
   Köln; er kommt aus `KOELN.reportBounds`, sobald der Eintrag steht.
7. **Restzweige ohne Test.** `koeln.ts` erreicht 100 % Zeilen und 97,9 %
   Zweige. Die vier offenen sind Schutzabfragen, die heute nicht eintreten
   können: der `?? {}`-Rückfall auf `match.groups`, die Prüfung, dass jede
   gefundene Marke einer Art zugeordnet ist, der Abbruch in `dayOf` und der
   `?? ''`-Rückfall in `cell`. Sie stehen dort für den Tag, an dem Muster und
   Tabelle auseinanderlaufen — dieselbe Sorte wie die zwei offenen Zweige in
   `muenchen.ts`.

## Prüfstand

```bash
cd app
pnpm --filter @knoellchenfrei/core typecheck     # grün
pnpm --filter @knoellchenfrei/core test          # grün, davon 82 Tests für Köln
cd packages/ingest && npx tsx src/utm32.check.ts # 20 amtliche Punktpaare
cd ../../.. && ./scripts/sprache-pruefen.sh      # grün
```

`pnpm --filter @knoellchenfrei/ingest typecheck` ist rot, bis die Zeile aus
Abschnitt 1 in `index.ts` steht.

## Dateien

| Datei | Inhalt |
| --- | --- |
| `app/packages/core/src/koeln.ts` | Zeit-, Gebühren-, Dauer- und CSV-Parser, Gebietsfelder |
| `app/packages/core/test/koeln.test.ts` | 82 Tests, inklusive Beschuss mit Unfug |
| `app/packages/core/test/fixtures/koeln-psa-2026-09-08.json` | Auszählung der CSV und ein wörtlicher Auszug ihrer schwierigsten 15 Zeilen |
| `app/packages/core/test/fixtures/koeln-gebiete-2026-09-08.json` | die 47 Gebiets-Attribute, dazu ein Stützpunkt in UTM als Beleg |
| `app/packages/ingest/src/utm32.ts` | UTM 32N → WGS 84, Krüger-Reihe, ohne Fremdbibliothek |
| `app/packages/ingest/src/utm32.check.ts` | die Messung gegen 20 amtliche Punktpaare |
| `app/packages/ingest/src/build-data-koeln.ts` | der Datenbau |
