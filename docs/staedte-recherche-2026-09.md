# Städte-Recherche, September 2026

Diese Datei **ergänzt** [staedte.md](staedte.md); sie ersetzt sie nicht. Dort
stehen die Kriterien, die Prüfliste und die Fallstudie Hamburg. Hier steht, was
beim Nachsehen in den Portalen und beim Abruf der Dienste herauskam — für
sechzehn Städte. Die meisten davon stehen in `staedte.md` bisher gar nicht oder
nur als Zeile „Portal vorhanden, Parkdatensatz nicht nachgewiesen".

Der Unterschied zur ersten Fassung von `staedte.md` ist derselbe wie damals bei
Hamburg: **Die Einträge unten sind abgerufen, nicht abgeschrieben.** Drei der
wichtigsten Befunde stehen in keinem Metadatensatz — Kölns veralteter
Gebührenwert, Frankfurts stille UTM-Antwort ohne `srsName` und Münchens 292
Schreibweisen. Sie zeigen sich erst, wenn man die Zeilen liest.

## Zeitpunkt der Abrufe

Alle Abrufe in dieser Datei liefen am **7. September 2026 zwischen 01:46 und
02:30 Uhr MESZ** (6. September, 23:46 UTC bis 7. September, 00:30 UTC). Portale
ändern sich; wer diese Datei später liest, prüft die Zahlen nach, statt sie zu
glauben.

Gesucht wurde über die CKAN-Schnittstellen von `ckan.govdata.de` (der
nationalen Sammelstelle), `ckan.open.nrw.de`, `opendata.muenchen.de`,
`opendata.stuttgart.de`, `opendata.leipzig.de` und `transparenz.karlsruhe.de`,
über die piveau-Suche von `open.bydata.de` sowie direkt über
`GetCapabilities`/`GetFeature` gegen die gefundenen Dienste. Abgerufen wurde mit
`curl --cacert $(python3 -c 'import certifi; print(certifi.where())')` — dem
System-Bundle fehlen mehrere Wurzeln, die Behördenserver benutzen.

Stufen wie in `staedte.md`: **geprüft** (Dienst selbst abgerufen, Felder
gesehen), **belegt** (Datensatz im Portal nachgewiesen), **Hinweis**.

---

## 1. Rangliste und Empfehlung

Sortiert nach Nutzen für diese App, nicht nach Einwohnerzahl. „Tarif" heißt: ein
Betrag steht **im Datensatz**, nicht in einer PDF daneben.

| # | Stadt | Einw. | Geometrie | Tarif | Zeiten | Höchstparkdauer | Lizenz | Stufe | Bewertung |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | **Frankfurt a. M.** | 0,77 Mio | 42 Polygone + 921 Punkte | **ja** (`2 €/h`, `4 €/h`) | **ja** (30 Schreibweisen) | **ja** (`1 h`…`5 h`) | DL-DE/**BY**-2.0 | geprüft | **geeignet** |
| 2 | **München** | 1,51 Mio | 82 Polygone + 13.714 Linien | nein | **ja** (292 Schreibweisen) | teilweise, im Text | DL-DE/**BY**-2.0 | geprüft | **geeignet mit Einschränkung** — kein Betrag |
| 3 | **Köln** | 1,09 Mio | 47 Polygone + 2.315 Punkte | ja, aber **veraltet** | ja (46 Schreibweisen) | ja (Stunden) | DL-DE/**Zero**-2.0 | geprüft | **geeignet mit Einschränkung** — Preisfeld falsch |
| 4 | **Karlsruhe** | 0,31 Mio | 282 Polygone + 638 Punkte | **ja** (Freitext) | **ja** (29 Schreibweisen) | **ja** (15 Schreibweisen) | CC BY 4.0 | geprüft | **geeignet mit Einschränkung** — Polygone ohne Attribute |
| 5 | **Düsseldorf** | 0,63 Mio | 44 Polygone | nein | **ja** (12 Schreibweisen) | nein | DL-DE/**Zero**-2.0 | geprüft | geeignet mit Einschränkung — kein Betrag |
| 6 | **Aachen** | 0,25 Mio | 28 Polygone + 547 Punkte | ja (3 Tarife) | ja (4 Schreibweisen) | ja (4 Werte) | DL-DE/**BY**-2.0 | geprüft | geeignet mit Einschränkung — Stand 2021 |
| 7 | **Moers** | 0,10 Mio | 41 Polygone + 3 Tabellen | **ja**, tabellarisch | **ja**, je Wochentag | **ja** | DL-DE/**Zero**-2.0 | geprüft | **Vorbild-Schema**, aber zu klein |
| — | Dresden | 0,56 Mio | 15 Polygone | nein | nein | nein | none/„keine" | geprüft | **ungeeignet** |
| — | Kiel, Wuppertal, Krefeld, Bielefeld, Norderstedt, Kempten, Ettlingen u. a. | | Polygone bzw. Punkte | nein | nein | nein | gemischt | geprüft/belegt | **ungeeignet**, Abschnitt 3 |
| — | Stuttgart, Leipzig, Bremen, Hannover, Nürnberg, Münster, Potsdam, Freiburg | | **keiner** | | | | | geprüft | **kein Datensatz**, Abschnitt 3 |

### Empfehlung: Frankfurt am Main, danach München

**Frankfurt zuerst.** Es ist die einzige **Großstadt** unter den sechzehn
geprüften, die alle vier Anforderungen aus `staedte.md` **maschinenlesbar**,
aktuell und richtig erfüllt: Geometrie, offene Lizenz, Tarif und Zeiten.
Karlsruhe, Aachen und Moers erfüllen sie ebenfalls, scheitern aber an
Aktualität, Größe oder Zuschnitt (Abschnitt 3, „Was das über die Datenlage
sagt"). Der Tarif steht als `4 €/h` im Feature, nicht
als Verweis auf eine Gebührenordnung; die Zeiten stehen daneben als
`Mo-Sa 9-20`, die Höchstparkdauer als `1 h`. Dazu drei Dinge, die den Anschluss
billig machen:

- **Die Lizenz ist dieselbe wie Hamburgs** — Datenlizenz Deutschland
  Namensnennung 2.0. `City.attribution.attributionRequired` gibt es schon, es
  kommt kein neues Lizenzverhalten dazu. Der Quellenvermerk steht wörtlich im
  Metadatensatz: `Stadt Frankfurt am Main, www.frankfurt.de`.
- **Ein Dienst, drei Ebenen.** `geowebdienste.frankfurt.de/Parken` liefert
  Bewohnerparkbereiche, Parkscheinautomaten und Behindertenparkplätze — die
  Berliner Aufteilung auf sieben Dienste entfällt.
- **Der Datensatz wird gepflegt.** Zuletzt geändert am 4. September 2026, drei
  Tage vor diesem Abruf.

Was Frankfurt kostet: Tarif und Zeiten hängen an **Punkten** (den Automaten),
nicht an den Flächen. Der Datenbau muss beides verbinden, wie er in Hamburg die
Gebiete gegen die Stadtteile hält. Das ist bekannte Arbeit, kein neues Problem.

**München danach**, aus zwei gegenläufigen Gründen. Dafür spricht: Es ist die
größte Stadt nach Berlin, `ruhver_parkseiten_line` ist mit 13.714
Straßenseitenabschnitten der **detaillierteste Parkdatensatz Deutschlands nach
Berlins**, und er wurde am Tag dieses Abrufs aktualisiert. Dagegen spricht: **Er
enthält keinen einzigen Betrag.** In 292 verschiedenen Regeltexten steht kein
`€`. München wäre die erste Stadt, in der `Fee` durchgehend `unknown` ist — die
App sagte „gebührenpflichtig, Betrag nicht in der Quelle". Das ist eine ehrliche
Antwort und `CostEstimate.priced` kann sie schon; eine aus der Gebührenordnung
abgetippte wäre keine.

**Warum nicht Köln, obwohl es größer ist.** Köln hat auf dem Papier alles:
1,09 Mio Einwohner, 47 Gebietspolygone unter DL-DE/**Zero** (die bequemste
Lizenz), 2.315 Parkscheinautomaten mit Gebührenzeit, Gebühr und
Höchstparkdauer. Aber das Gebührenfeld ist **falsch**. Der Datensatz nennt
`0,50 €` bzw. `1,00 € je 20 Minuten`, also 1,50 € und 3,00 € je Stunde. Die
Stadt Köln selbst schreibt in ihrer Mitteilung zur neuen Parkgebührenordnung
von **5 € je Stunde** für Innenstadt/Deutz „vormals 4 Euro" und **2,50 €** für
die Bezirke 2 bis 9 „vormals 2 Euro". Schon der jeweils *vorherige* Wert steht
also nicht im Datensatz — er ist mindestens eine, dem Wortlaut nach zwei
Erhöhungen alt. Die Datei heißt intern noch `psa_2016.csv`.

Das ist genau der Fehler, den `staedte.md` bei Hamburg festgehalten hat — nur
schlimmer: Dort log die *Beschreibung* des Dienstes und der Feed stimmte, hier
lügt der **Feed**. Wer ihn ungeprüft ausliefert, nennt jemandem für die
Innenstadt 1,50 € statt 5 € je Stunde, und nichts daran sieht nach einem Fehler
aus.
Köln ist deshalb nicht die zweite Stadt, sondern eine, bei der zuerst das Amt
für Verkehrsmanagement zu fragen ist.

---

## 2. Die Städte im Einzelnen

### Frankfurt am Main — geprüft, geeignet

| Kriterium | Befund |
| --- | --- |
| **Datensatz** | „WFS Parken in der Stadt Frankfurt am Main", Portal: <https://www.govdata.de/suche/daten/wfs-parken-in-der-stadt-frankfurt-am-main> |
| **Dienst** | `https://geowebdienste.frankfurt.de/Parken`, WFS 2.0.0 (GeoServer, dahinter `mainziel.de`) |
| **Typnamen** | `opendata:Bewohnerparken` (42 Polygone), `opendata:Parkscheinautomaten` (**921** Punkte), `opendata:Behindertenparkplaetze` (458 Punkte) |
| **Inhalt** | Zonen-Geometrie **ja**; Gebühr, Geltungszeit und Höchstparkdauer **ja, am Automaten**; Bewohnerparken und Parkscheinzone getrennt und über `bewohnerparkzone` ↔ `nummer` verbunden |
| **Lizenz** | **Datenlizenz Deutschland Namensnennung 2.0**, <https://www.govdata.de/dl-de/by-2-0>. Namensnennung ist Bedingung. Quellenvermerk laut ISO-Metadatensatz wörtlich: `quelle: Stadt Frankfurt am Main, www.frankfurt.de` |
| **Aktualität** | Metadaten geändert **2026-09-04**; ISO-Datestamp 2025-07-29; Fortführung `asNeeded` |
| **Ansprechpartner** | Straßenverkehrsamt, `SVA.GDI@stadt-frankfurt.de`, <https://www.strassenverkehrsamt.frankfurt.de> |
| **Zugriff** | HTTP 200 auf `GetCapabilities`, `resultType=hits` und `GetFeature`. `numberMatched="42"` / `"921"` / `"458"` |

Ein Parkscheinautomat sieht so aus:

```json
{ "bewohnerparkzone": null, "strassenname": "Alte Mainzer Gasse 4",
  "maximal_parkdauer": "1 h", "gebuehrenzone": "4 €/h",
  "gebuehrenzeit": "Mo-Sa 9-20" }
```

Ein Bewohnerparkbereich so — und hier fängt die erste Eigenheit an:

```json
{ "name": null, "description": null, "nummer": 0,
  "vti_url": "<a href=\"/wir-fuer-sie/bewohnerparken/regelungsbereich-0\" …>weitere Informationen</a>",
  "mitparkraumbewirtschaftung": null }
```

**Eigenheiten, gemessen:**

1. **Ohne `srsName` antwortet der Dienst in EPSG:25832 — stillschweigend.**
   Dieselbe Anfrage mit `outputFormat=application/json` und ohne `srsName`
   liefert `[477189.85, 5550859.91]`. Das sind plausible Zahlen, nur keine
   Grade. Mit `srsName=EPSG:4326` **und** mit `srsName=urn:ogc:def:crs:EPSG::4326`
   kommt `[8.68099495, 50.10955097]` — also **`[lon, lat]`**, wie Berlin und
   anders als Hamburg. Die Achsenreihenfolge gehört wie immer in die
   Konfiguration; das `srsName` gehört in die Abfrage, sonst liegt Frankfurt im
   Nichts.
2. **Das Ausgabeformat heißt `application/json`, nicht `application/geo+json`.**
   Hamburgs Wert quittiert dieser Dienst mit einem `ows:ExceptionReport` — immerhin
   ein Fehler, nicht wie in Berlin stilles GML. Ohne `outputFormat` kommt GML 3.2.
3. **`name` und `description` sind in allen 42 Bereichen `null`.** Identität
   trägt nur `nummer` (0–41). Der Anzeigename müsste aus `vti_url` kommen, und
   die trägt **HTML-Markup** in einem Attributwert — fremde Eingabe, die als
   Text zu behandeln ist, nicht als Markup.
4. **`mitparkraumbewirtschaftung`** ist in 11 von 42 Bereichen `1`, sonst `null`.
   Das ist Frankfurts Gegenstück zu Hamburgs `geplant_aktiv`: Der Feed sagt
   nicht, was `null` heißt. Vorsichtige Lesart wie in Hamburg.
5. **418 der 921 Automaten haben keine `bewohnerparkzone`.** Sie stehen in
   bewirtschafteten Bereichen ohne Bewohnerparken. Für die knapp die Hälfte der
   Automaten gibt es also **kein Polygon** — die Zonenabfrage deckt sie nicht ab.
   Das ist die eine ernste Lücke des Frankfurter Datensatzes.

**Die Werte im Einzelnen** (alle 921 Automaten ausgezählt):

| Feld | Werte |
| --- | --- |
| `gebuehrenzone` | `2 €/h` (699), `4 €/h` (221), leer (1) — **zwei Tarife, kein Freitext-Zoo** |
| `gebuehrenzeit` | **30** Schreibweisen. Häufigste: `Mo-Fr 7-19` (351), `Mo-Fr 7-22` (206), `Mo-Sa 9-20` (105). Sonderfälle: `Mo-Fr 8-18 Sa 8-14`, `Tgl. 9-18`, `Mo-So 0-24`, `Mo-Fr 9-17, Sa 9-14` (einmal mit Komma statt Leerzeichen) |
| `maximal_parkdauer` | `-` (579), `1 h` (242), `2 h` (74), `3 h` (22), `4 h`/`5 h` (je 2). **`-` ist „keine", nicht null Minuten** |
| `bewohnerparkzone` | 22 verschiedene Nummern, 418-mal `null` |

### München — geprüft, geeignet mit Einschränkung

| Kriterium | Befund |
| --- | --- |
| **Datensätze** | „Parkraummanagementgebiete", <https://opendata.muenchen.de/dataset/opendata_ruhver_prm_gebiete_poly> — und, im Portal **nicht** als eigener Datensatz geführt, die Ebene `mor_wfs:ruhver_parkseiten_line` desselben GeoServers |
| **Dienst** | `https://geoportal.muenchen.de/geoserver/mor_wfs/ows`, WFS 2.0.0 |
| **Typnamen** | `mor_wfs:ruhver_prm_gebiete_poly` (**82** Polygone), `mor_wfs:ruhver_parkseiten_line` (**13.714** Linien) |
| **Inhalt** | Geometrie **ja, zweifach**; Gebühr **nein**; Zeiten **ja, je Straßenseite**; Höchstparkdauer nur im Regeltext (`Kurzzeitparken 2h 9-18 Uhr`) |
| **Lizenz** | **Datenlizenz Deutschland Namensnennung 2.0**. Quellenvermerk laut Portal wörtlich: `dl-de/by-2-0: Landeshauptstadt München – opendata.muenchen.de` |
| **Aktualität** | Portal-Metadaten geändert **2026-09-06**, GeoPortal-Stand 2026-05-27; Rhythmus `AS_NEEDED` |
| **Ansprechpartner** | MOR-GB1, `gb1-23.mor@muenchen.de` |
| **Zugriff** | HTTP 200, `numberMatched="82"` bzw. `"13714"` |

Ein Gebiet:

```json
{ "status": "in Betrieb", "massnahme": "Lizenzgebiet in Betrieb",
  "name": "TU-Viertel", "ueberwachung": "Polizei", "eroeffnung": "04.12.2007",
  "einzeluebersicht_link": "https://muenchenunterwegs.de/…/TU-Viertel.pdf" }
```

Eine Straßenseite:

```json
{ "angebot": "5", "parkregel_beschreibung": "Mischparken 9-23 Uhr",
  "parkregel_gruppe": "Mischparken", "parkregel_id": 24,
  "parkregel_name": "M 9-23", "prm_name": "Südliche Au", "strasse": "Falkenstr." }
```

**Eigenheiten, gemessen:**

1. **Achsenreihenfolge `[lon, lat]`** bei `srsName=urn:ogc:def:crs:EPSG::4326`
   — erste Koordinate `[11.573, 48.156]`. Wie Berlin, anders als Hamburg.
2. **Kein Betrag, nirgends.** In den 292 verschiedenen Werten von
   `parkregel_beschreibung` kommt weder `€` noch `Euro` noch `EUR` vor. Der
   Tarif steht ausschließlich in der Gebührenordnung: 2 € je Stunde im
   Parklizenzgebiet, Tagesticket 11 €, Altstadttarif abweichend. Das ist eine
   PDF-Auskunft, keine Datenquelle.
3. **292 Schreibweisen der Regel.** Zum Vergleich: Berlin 18, Hamburg 10. Und
   sie sind nicht nur zahlreich, sondern **zusammengesetzt**:
   `Absolutes Halteverbot 6:30-8:30 Uhr und 16-19 Uhr, Eingeschränktes
   Halteverbot 8:30-16 Uhr, Mischparken 19-23 Uhr` ist ein Wert. Ein Parser
   dafür ist eine kleine Grammatik, kein regulärer Ausdruck.
4. **Regeln, die aus Daten nicht auflösbar sind.** Mehrere Werte lauten
   `… an Schultagen, … an nicht Schultagen`. Ein Schulkalender ist keine
   Feiertagstabelle; er ist je Bundesland und Jahr anders und in der Quelle
   nicht enthalten. Solche Abschnitte gehören in `unmodelledRules`, nicht in
   `windows`.
5. **Achtzehn Regelgruppen, davon acht ohne Parkbezug.** 1.916 Abschnitte sind
   `Absolutes Halteverbot (0-24 Uhr)`, 825 Behindertenparken, 901 Carsharing,
   1.171 E-Parken. Wer die Ebene ungefiltert nimmt, baut eine Halteverbotskarte.
6. **1.307 Abschnitte ohne `prm_name`** — sie liegen außerhalb der 82 Gebiete.
   Die Zuordnung Linie → Gebiet ist also nicht vollständig.
7. **Der Feed ist reich an Nebenebenen**: `miv_umweltzone_poly` (Umweltzone —
   anders als Hamburg hat München eine), `behindertenparkplaetze`,
   `park_ride_standorte`, `ruhver_els_standort_point` (Ladeinfrastruktur),
   `ruhver_carsharing`. Das deckt praktisch alle Berliner Nebenebenen ab.

### Köln — geprüft, geeignet mit Einschränkung (Preisfeld veraltet)

| Kriterium | Befund |
| --- | --- |
| **Datensätze** | „Bewohnerparkgebiete – Stadt Köln", <https://www.govdata.de/suche/daten/bewohnerparkgebiete-stadt-koln> · „Parkscheinautomaten in Koeln", <https://www.offenedaten-koeln.de/dataset/parkscheinautomaten-koeln> |
| **Dienste** | WFS `https://geoportal.stadt-koeln.de/wss/service/bewohnerparken_wfs/guest` (MapServer, WFS 2.0.0) · CSV `https://www.offenedaten-koeln.de/sites/default/files/distribution/psa_2016.csv` |
| **Typnamen** | `ms:bewohnerparkgebiete_zonen` (**47**), `ms:bewohnerparkgebiete_weiche_grenzen` |
| **Inhalt** | Geometrie **ja**; Gebühr/Zeiten/Höchstparkdauer **nur in der PSA-CSV**, nicht im WFS |
| **Lizenz** | **DL-DE/Zero-2.0** für beide. Im WFS-`GetCapabilities` wörtlich: „Bereitstellung als OpenData unter Datenlizenz Deutschland - Zero - Version 2.0." `ows:Fees: keine` |
| **Aktualität** | WFS-Metadaten `modified 2026-02-20`; PSA-CSV `modified 2025-11-27`, Rhythmus „jährlich". **Der Gebührenwert ist trotzdem veraltet, siehe unten** |
| **Ansprechpartner** | Amt für nachhaltige Mobilitätsentwicklung, `nachhaltige-mobilitaetsentwicklung@stadt-koeln.de` |
| **Zugriff** | HTTP 200, `numberMatched="47"`; CSV 2.315 Zeilen, 302 KB |

Ein Gebiet, und ein Automat:

```json
{ "gid": "7", "Name": "Porz-Grengel", "Abkürzung": "Grengel",
  "Weitere_Informationen": "https://www.stadt-koeln.de/artikel/03982/index.html" }
```

```
PSA-Nr;Aufstellort;PLZ;Bezirk/Gebiet;…;Gebührenzeit;Gebühr je 20 Minuten;Höchstparkdauer;…;GeoKoordinateNord;GeoKoordinateOst
1;Deutzer Freiheit 53;50679;Deutz I;…;Mo-Sa 09:00 - 21:00;0,50 €;2;;50,93686078;6,97249396
```

**Eigenheiten, gemessen:**

1. **Der WFS ignoriert `srsName` vollständig.** Weder `EPSG:4326` noch
   `urn:ogc:def:crs:EPSG::4326` ändern etwas; es kommt immer
   `[366433.216, 5638278.57]`, also EPSG:25832. Köln ist damit die einzige
   geprüfte Stadt, für die der Datenbau **selbst umprojizieren** muss — und
   `packages/core` ist absichtlich abhängigkeitsfrei, eine
   Reprojektionsbibliothek wäre dort ein Bruch. Die Umrechnung UTM 32N → WGS 84
   müsste im `ingest`-Paket liegen.
2. **Das Ausgabeformat heißt `application/json; subtype=geojson`** — mit
   Semikolon und Leerzeichen im Wert, also URL-kodiert anzufragen.
3. **Das Gebührenfeld ist mindestens eine Erhöhungsrunde alt.** Der Datensatz
   kennt genau zwei Werte: `0,50 €` (1.313 Automaten) und `1,00 €` je 20 Minuten
   (1.002), also 1,50 € und 3,00 € je Stunde. Die Stadt Köln nennt in ihrer
   Mitteilung zur neuen Parkgebührenordnung 5 € je Stunde für Innenstadt/Deutz
   („vormals 4 Euro") und 2,50 € für die Bezirke 2 bis 9 („vormals 2 Euro") —
   <https://www.stadt-koeln.de/politik-und-verwaltung/presse/mitteilungen/27174/index.html>,
   abgerufen mit `curl` am 7. September 2026. Weder der neue noch der vorherige
   Wert steht im Datensatz.
4. **Die Koordinaten stehen als deutsche Dezimalzahlen in zwei Spalten**
   (`50,93686078` / `6,97249396`) und heißen `Nord`/`Ost` — die Reihenfolge im
   Dateikopf ist Breite vor Länge.
5. **46 Schreibweisen der `Gebührenzeit`**, darunter Fenster über Mitternacht
   (`Mo-Sa 09:00 - 01:00`, 159-mal) und zusammengesetzte
   (`Mo-Fr 09:00 - 21:00 + Sa 10:00 - 15:00`) — das `+` als Trenner.
6. **`Höchstparkdauer` ist eine nackte Zahl in Stunden** (`4`, `9`, `12`, `14`),
   und `0` kommt viermal vor. Wie Hamburgs `9999` ein Platzhalter, dessen
   Bedeutung der Datensatz nicht nennt.

### Karlsruhe — geprüft, geeignet mit Einschränkung

| Kriterium | Befund |
| --- | --- |
| **Datensätze** | „Parkscheinautomaten", <https://transparenz.karlsruhe.de/dataset/parkscheinautomaten> · „Parkscheinautomatenflächen" · „Parkscheiben Parkplätze" · „Bewohnerparken" |
| **Dienst** | `https://mobil.trk.de/geoserver/TBA/ows`, WFS 2.0.0 (GeoServer) |
| **Typnamen** | `TBA:parkscheinautomaten` (**638** Punkte), `TBA:parkscheinautomaten_flaechen` (**282** MultiPolygone), `TBA:parkscheiben` (**363** Punkte), `TBA:bewohnerparken` (**157** Punkte) |
| **Inhalt** | Geometrie ja; Gebühr **ja, als Freitext**; Zeiten ja; Höchstparkdauer ja; Parkscheibenflächen getrennt geführt |
| **Lizenz** | **CC BY 4.0**, <http://creativecommons.org/licenses/by/4.0/>. Namensnennung Bedingung — **eine dritte Lizenzfamilie** neben DL-DE/Zero und DL-DE/BY |
| **Aktualität** | Portal-Metadaten 2025-02-19; Feldwert `stand` je Automat, gesehen bis **2026-06-11** |
| **Zugriff** | HTTP 200, `numberMatched` wie oben |

```json
{ "gemeinde": "Karlsruhe", "stadtteil": "Durlach", "standort": "Raiherwiesenstraße",
  "tarifzone": "2", "parkzeit": "werktags 8 bis 20 Uhr", "max_parkdauer": "2 Std.",
  "stellplaetze": 6,
  "gebuehren": "30 min = 1,50 €; 60 min = 3,00 €; 90 min = 4,50 €; 120 min = 6,00 €",
  "stand": "2026-06-11T22:00:00Z" }
```

**Eigenheiten, gemessen:**

1. **Der Datensatz ist nicht Karlsruhe, sondern die TechnologieRegion.** Von
   638 Automaten stehen 281 in Karlsruhe; der Rest verteilt sich auf Landau
   (150), Rastatt (74), **Haguenau (54)**, Ettlingen, **Saverne (19)**,
   Baden-Baden, Gaggenau, Bruchsal, Bretten, Germersheim. Haguenau und Saverne
   liegen im Elsass — **in Frankreich**. Deren Zeilen sind französisch:
   `Du lundi au samedi 9h-12h et 14h-19h`, `15 min = frei ; 30 cts par 1/4
   d'heure`. Ein Parser für dieses Feed müsste zwei Sprachen und zwei
   Feiertagskalender kennen, oder `gemeinde` filtern. Filtern ist die Antwort.
2. **`gebuehren` ist eine Preistreppe, kein Stundensatz.** 25 Schreibweisen,
   davon 154 leer. `parse-fee.ts` erwartet einen Betrag; hier stehen vier
   Stützstellen, und `30 min = 1,50 €` heißt 3 €/h, `15 min = 1,50 €` aber
   6 €/h. Wer nur die erste Zahl liest, halbiert den Preis.
3. **Die Flächen tragen keine Attribute** — `{"id": 1, "gemeinde": "Karlsruhe",
   "stand": …}`. Tarif und Zeiten müssten über einen räumlichen Verschnitt
   Punkt→Fläche zugeordnet werden, ohne dass der Datensatz die Zuordnung
   bestätigt.
4. **`TBA:bewohnerparken` sind Punkte, keine Flächen** (157 Stück, Felder
   `gemeinde`, `bewohnerparkzone`, `kennziffer`) — für eine Zonenabfrage
   unbrauchbar.
5. **Achsenreihenfolge `[lon, lat]`** bei `urn:ogc:def:crs:EPSG::4326`.

### Düsseldorf — geprüft, geeignet mit Einschränkung

| Kriterium | Befund |
| --- | --- |
| **Datensatz** | „Bewohnerparkgebiete in Düsseldorf", <https://opendata.duesseldorf.de/dataset/bewohnerparkgebiete-d%C3%BCsseldorf> |
| **Dienst** | Kein WFS. Statische Datei: `https://opendata.duesseldorf.de/sites/default/files/Bewohnerparken_2025_0.geojson` (216 KB), dazu CSV und KML |
| **Inhalt** | **44** MultiPolygone; Zeiten **ja**; Gebühr nein; Höchstparkdauer nein |
| **Lizenz** | **DL-DE/Zero-2.0**, <https://www.govdata.de/dl-de/zero-2-0> |
| **Aktualität** | `_last_update` in allen 44 Merkmalen: **2024-12-06**. Portal `modified 2026-06-08` |
| **Zugriff** | HTTP 200, 44 Merkmale, `crs: urn:ogc:def:crs:EPSG::4326`, Koordinaten `[6.775, 51.223]` = `[lon, lat]` |

```json
{ "name": "Altstadt", "kuerzel": "A", "zeitraum": "werktags, 9 bis 20 Uhr",
  "url": "https://www.duesseldorf.de/verkehrsmanagement/service/bewohnerparkgebiete#c158816",
  "_last_update": "2024-12-06" }
```

Zwölf Schreibweisen von `zeitraum`, alle auf einem Muster („Tagesangabe, Komma,
Stundenspanne, ‚Uhr'"), drei davon `null`. Zwei Sonderfälle:
`montags bis freitags, 8 bis 18 Uhr, samstags, 8 bis 14 Uhr` (zwei Klauseln in
einem Feld) und
`montags bis freitags, 9 bis 18 Uhr / teilweise montags bis sonntags, 9 bis 23
Uhr*` — ein Sternchen mit einer Fußnote, die nicht mitgeliefert wird. Das ist
ein Kandidat für `unmodelledRules`, nicht für ein `ChargeWindow`.

Ein Parkscheinautomaten-Datensatz existiert für Düsseldorf **nicht** — geprüft
über `ckan.open.nrw.de` mit `parkschein`, `parkzone`, `parkraum` und
`Düsseldorf park`. Damit fehlt der Tarif ganz.

### Aachen — geprüft, geeignet mit Einschränkung (Stand 2021)

| Kriterium | Befund |
| --- | --- |
| **Datensätze** | „Parkscheinautomaten Stadt Aachen", <https://open.nrw/dataset/parkscheinautomaten-stadt-aachen-ac> · „Bewohnerparkzonen Stadt Aachen" |
| **Dienste** | `https://geoserver.aachen.de/opendata/parkscheinautomaten/ows` · `https://geoserver.aachen.de/opendata/bewohnerparkzonen/ows` |
| **Inhalt** | **28** Zonenpolygone (`{"id": 1, "zone": "B"}`), **547** Automaten mit Tarif, Bedienzeit, Höchstparkdauer und Zonenbezug (`descriptio: "Parkzone V"`) |
| **Lizenz** | **DL-DE/BY-2.0** |
| **Aktualität** | Portal 2026-05-27, aber `check_date` je Automat aus **2021** (198-mal 2021-03-07, 118-mal leer) |
| **Zugriff** | HTTP 200, `numberMatched="28"`, CSV mit 547 Zeilen |

```
psa_nr,name,descriptio,check_date,tarif,bedienzeit,tagesticke,hpd
,"Dammstr. 13","Parkzone BU1",2021-09-13,"0,50 € je 20 Minuten","Mo - Fr 9.00 - 19.00 Uhr, Sa 9.00 - 14.00 Uhr","-","2 Stunden"
```

Bemerkenswert sauber: **nur vier** Schreibweisen der Bedienzeit und **drei**
Tarife im ganzen Stadtgebiet — der einfachste Feed der ganzen Recherche. Die
Geometrie steht als WKT in einer CSV-Spalte, in EPSG:25832. Was gegen Aachen
spricht, ist allein die Aktualität: Ein Prüfdatum von 2021 nennt 2026 falsche
Preise, und `staedte.md` hat dafür eine eigene Zeile in der Prüfliste. Aachen
hat außerdem als eine der wenigen Städte **Verwarngelddaten des ruhenden
Verkehrs** veröffentlicht — das steht schon in `data-sources.md`.

### Dresden — geprüft, ungeeignet

| Kriterium | Befund |
| --- | --- |
| **Datensatz** | „Parkraumbewirtschaftungszonen – BUFFER1", <https://www.govdata.de/suche/daten/parkraumbewirtschaftungszonen-buffer1abe1a> |
| **Dienst** | `https://kommisdd.dresden.de/net3/public/ogc.ashx?NodeId=916`, WFS 2.0.0, Typname `cls:L704`, `outputFormat=application/geo+json` |
| **Inhalt** | **15** Polygone. Attribute: `bezeichnung` (`PRBZ(5)`, `PRBZ Sternplatz`), `aktiv` (15× `true`), `tsp`. **Kein Tarif, keine Zeit, keine Höchstparkdauer** |
| **Lizenz** | `ows:Fees: none`, `ows:AccessConstraints: none` — keine benannte Lizenz im Dienst; INSPIRE-Verweis auf `geoportal.sachsen.de` |
| **Aktualität** | `issued 2016-12-20`, `modified 2026-08-27` |
| **Zugriff** | HTTP 200, 15 Merkmale, `[13.7465, 51.0622]` = `[lon, lat]` |

Fünfzehn Zonen, keine davon mit Preis oder Zeit — Dresden fällt an Punkt 3 und 4
der Prüfliste durch. Weitere Dresdner Parkdatensätze wurden über `ckan.govdata.de`
gesucht (`Dresden AND (Parkraum OR Parkschein OR Bewohnerpark OR Parkgebühr)`,
0 Treffer) und nicht gefunden.

### Moers — das Vorbild-Schema

Moers hat 104.000 Einwohner und ist für diese App zu klein. Der Datensatz
gehört trotzdem hierher, weil er zeigt, wie eine Kommune Parkdaten
veröffentlichen sollte — **relational statt als Freitext**:

| Datei | Inhalt |
| --- | --- |
| `tarifparkzonen_moers.geojson` | 41 Polygone, ein einziges Attribut: `{"ZoneGIS": "TP1"}` |
| `00_parkzonen_in_moers_opendata.csv` | Verbindungstabelle: `ZoneGIS;Tarif;Zeitgruppe;Handyparkzone;Bewirtschaftungsart;Parkplatzart;Stellplatzanzahl;Bereiche` |
| `01_tarifzonen.csv` | `Tarif;Gebühr;pro_Zeiteinheit;Sondertarif` — z. B. `A;1,00 €;je 30 Minuten` |
| `02_zeitgruppen_bewirtschaftungszeiten.csv` | `Zeitgruppe;Mo;Di;Mi;Do;Fr;Sa;So_u_Feiertags;Höchstparkdauer` — je Wochentag ein `09:00-19:00`, und `So_u_Feiertags: keine` |

Portal: <https://www.offenesdatenportal.de/dataset/tarifparkzonen-moers>,
Kontakt `FB8@Moers.de`, Metadaten geändert 2026-08-25. Kein Parser nötig,
keine Schreibweisen zu raten, und die Feiertagsregel steht als eigene Spalte
im Datensatz. Wenn dieses Projekt je einer Kommune ein Schema vorschlagen
soll, ist das hier die Vorlage.

Die CSVs sind **CP1252-kodiert**, nicht UTF-8 — `Gebühr` kommt sonst als
`Geb?hr` an.

### Kurz geprüft, für eine Zonenabfrage unbrauchbar

| Stadt | Datensatz | Befund |
| --- | --- | --- |
| **Kiel** | `Bewohnerparken`, WFS `ims.kiel.de/…/LHKielWmsWfs/MapServer/WFSServer` | **11** MultiPolygone, Attribute `Name`, `Kurzbezeichnung`, `Kontakt`. Kein Tarif, keine Zeit |
| **Wuppertal** | `City-Parkzonen` / `City-Parkflächen`, `daten.wuppertal.de` | **3** Zonen und **61** Flächen, Attribute nur `ID` und `NAME`. CC BY 4.0 |
| **Krefeld** | `Bewohnerparken Krefeld`, GeoJSON | Antrags- und Parkbereiche, kein Tarif, keine Zeit (belegt, nicht abgerufen) |
| **Bielefeld** | `Bewohnerparkzonen`, WFS/WMS/CSV über `open-data.bielefeld.de` | Adressbereiche für den Ausweisantrag, nicht die bewirtschaftete Fläche; `modified 2023-07-05` |
| **Norderstedt** | `vkr:parkzone`, GeoServer WFS mit GeoJSON | Stand 01.08.2022; Zonen ohne Tarif |
| **Kempten (Allgäu)** | `Parkzonen für Bewohnerparken`, GeoJSON, open.bydata | 2025-10-20; einzige bayerische Stadt neben München mit einem Parkzonen-Datensatz |
| **Ettlingen, Rastatt, Landau, Bretten** | `TBA:bewohnerparken` (siehe Karlsruhe) | Punkte statt Flächen |
| **Moers (Bewohnerparkzonen)** | zwei konkurrierende Einträge, einer „Andere geschlossene Lizenz" | Der Tarifparkzonen-Datensatz oben ist der brauchbare |

---

## 3. Nicht geeignet, und warum

Damit niemand dieselbe Suche ein zweites Mal macht. Das Muster von
`data-sources.md`: Negativbefunde sind Arbeitsergebnisse.

**Stuttgart — kein eigener Parkdatensatz.**
`opendata.stuttgart.de` führt 141 Datensätze; genau einer heißt „Parken", und er
enthält keine Daten, sondern einen Verweis auf MobiData BW
(<https://www.mobidata-bw.de/dataset/gebuendelte-parkdaten-bw>), CC BY 4.0.
Bewohnerparkzonen der Stadt Stuttgart sind dort nicht enthalten. Geprüft am
7. September 2026 über `package_list` und `package_search`.

**Leipzig — nur Park+Ride.**
`opendata.leipzig.de` (CKAN) liefert auf `q=park` sechs Treffer: drei
Park+Ride-Datensätze samt Belegung, ein Baumkataster und zwei Haushaltsposten.
Kein Bewohnerparken, keine Parkraumbewirtschaftung, keine Parkscheinautomaten.

**Bremen — kein Datensatz auffindbar.**
`ckan.govdata.de` liefert für `Bremen AND park` fünf Treffer, alle
Klimabewertungskarten. Das Landesamt GeoInformation gibt seit 9. Juni 2024
Geodaten frei, führt aber in der Open-Data-Produktübersicht keinen
Parkdatensatz. `gdi1.geo.bremen.de` war aus dieser Umgebung nicht erreichbar
(`CONNECT tunnel failed, 502`), `transparenz.bremen.de/suche` antwortet mit 404,
und `metaver.de` — der Metadatenkatalog für Bremen, Hamburg und Niedersachsen —
lehnt jede Anfrage aus dieser Umgebung mit **HTTP 429** ab, offenbar wegen der
geteilten Proxy-Adresse. Die Bewohnerparkgebiete stehen beim Amt für Straßen und
Verkehr als Textliste (<https://www.asv.bremen.de/verkehrsthemen/bewohnerparken/parkgebiete-9260>).
**Offen: aus einer anderen Umgebung noch einmal über MetaVer prüfen.**

**Hannover — kein Datensatz auffindbar.**
`ckan.govdata.de` liefert für `Hannover AND park` vier Treffer, davon zwei
Lkw-Parkplätze und zwei Bochumer Radrouten. Landeshauptstadt und Region
betreiben getrennte Geodatenportale (`e-government.hannover-stadt.de/geonetwork`
bzw. das Geodatenportal der Region); ein Parkzonen-Datensatz war über die
Suche nicht zu finden. Stufe: **Hinweis**, nicht widerlegt.

**Nürnberg — kein Datensatz.**
`open.bydata.de` (das bayerische Portal) kennt zu `parkzone`,
`bewohnerparken` und `parkscheinautomat` je genau einen bzw. keinen Treffer,
und keiner davon ist Nürnberg. Zu `parken` sind es 89 Treffer, davon Nürnberg:
null. `opendata.nuernberg.de` leitet auf `www.nuernberg.de/internet/opendata`
um, dort steht kein Parkdatensatz.

**Münster, Potsdam — kein Datensatz.**
Münster: `ckan.open.nrw.de` und `ckan.govdata.de` kennen für Münster nur
E-Scooter-Abstellflächen und Parkhausbelegung. Potsdam: `Open Data Brandenburg`
liefert auf `Potsdam AND Park` ausschließlich historische Parkpläne der
Stiftung Preußische Schlösser und Gärten — „Park" im anderen Sinn.

**Freiburg — Parkhäuser statt Straßenraum.**
„Parkdaten Freiburg im Breisgau" ist der Echtzeit-Belegungsfeed des
Parkleitsystems: dreißig Anzeigetafeln, drei Zonen, Parkhäuser. WFS unter
`geoportal.freiburg.de/wfs/gdm_pls/gdm_pls`, zusätzlich über ParkAPI/ParkenDD.
Für „kostet das hier gerade etwas" trägt er nichts bei.

**MobiData BW ParkAPI — Punkte, keine Zonen.**
`https://api.mobidata-bw.de/park-api/api/public/v3/parking-sites` antwortet mit
HTTP 200 und meldet **30.979** Parkmöglichkeiten in Baden-Württemberg unter
einem einheitlichen Schema. Das klingt nach der Abkürzung für ein ganzes
Bundesland und ist keine: In einer Stichprobe von 500 Einträgen hatten
**240** ein `opening_hours`, **233** ein `has_fee` und nur **31** ein
`fee_description`; `type=ON_STREET` traf auf 29 zu, der Rest sind Parkhäuser,
Parkplätze und P+R. Es gibt keine Flächen, nur `lat`/`lon`, und keinen
Stundensatz. Als Quelle für Parkhäuser brauchbar, als Zonenquelle nicht.
Gleiches gilt für „Gebündelte Daten Parken NRW" auf der Mobilithek.

**Kommerzielle Aggregatoren.** Unverändert ausgeschlossen, Begründung in
`staedte.md`, Weg C.

### Was das über die Datenlage sagt

Die sechzehn Städte, die diese Recherche im Einzelnen geprüft hat — die
vierzehn aus dem Auftrag plus Aachen und Moers, die dabei aufgetaucht sind —
verteilen sich so:

| Was die Stadt veröffentlicht | Anzahl | welche |
| --- | --- | --- |
| gar nichts zur Parkraumbewirtschaftung | **8** | Stuttgart, Leipzig, Bremen, Hannover, Nürnberg, Münster, Potsdam, Freiburg |
| nur Geometrie | **1** | Dresden |
| Geometrie und Zeiten, **kein Betrag** | **2** | München, Düsseldorf |
| Geometrie, Zeiten und Betrag | **5** | Frankfurt, Köln, Karlsruhe, Aachen, Moers |

Und von den letzten fünf bleibt nach der Prüfliste **eine** übrig, die zugleich
groß genug, aktuell und richtig ist: Kölns Betrag ist mindestens eine Erhöhung
alt, Aachens Prüfdatum ist von 2021, Moers hat 104.000 Einwohner, Karlsruhes
Feed reicht bis ins Elsass und nennt Preistreppen statt Stundensätzen. Übrig
bleibt Frankfurt.

Berlins Feed, in dem Geometrie, Tarif und Zeiten in derselben Zeile stehen, ist
damit nicht der Normalfall, sondern die Ausnahme. `staedte.md` hat das
vermutet; jetzt ist es gezählt.

---

## 4. Was die Umsetzung je Stadt braucht

Gemeinsam für alle: ein Eintrag in `core/city.ts` (Mittelpunkt, Zoom,
`reportBounds`, `sessionBounds`, `land`, `attribution`), ein Eintrag in
`ingest/sources.ts` (`service`, `typeName`, `expectedFeatures`, `outputFormat`,
`axisOrder`), ein Feiertagseintrag in `core/holidays.ts` und ein
`build-data-<stadt>.ts`. Und, nach der Regel **zwei Feeds, zwei Parser**: eine
eigene Parserdatei je Stadt. Keine der drei Grammatiken unten ist mit
`parse-schedule.ts` oder `hamburg.ts` verwandt.

### Frankfurt am Main

| `ZoneOut` | kommt aus |
| --- | --- |
| `zone` | `opendata:Bewohnerparken.nummer` (0–41), formatiert. `name` ist durchweg `null` |
| `district` | fehlt im Feed — wie in Hamburg über den Mittelpunkt gegen **unvereinfachte** Stadtteilgrenzen zu bestimmen; die Ebene ist noch zu suchen |
| `rawFee` / `fee` | `Parkscheinautomaten.gebuehrenzone` (`"4 €/h"`) der Automaten **in** diesem Polygon. Bei mehreren Werten: `Fee.range`, wie Berlins Zonen 41–43 |
| `rawHours` / `windows` | `Parkscheinautomaten.gebuehrenzeit` (`"Mo-Sa 9-20"`), 30 Schreibweisen |
| `maxStayMinutes` | `Parkscheinautomaten.maximal_parkdauer` (`"1 h"`); **`"-"` ist „keine", nicht 0** |
| `spaces` | nicht im Feed |
| `note` | `vti_url`, nach Entfernen des HTML |
| `unmodelledRules` | die 418 Automaten ohne `bewohnerparkzone` |

**Eigener Parser** `frankfurt.ts`: Tagesangabe (`Mo-Fr`, `Mo-Sa`, `Mo-So`,
`Tgl.`), Stundenspanne ohne Minuten, optional eine zweite Klausel
(`Mo-Fr 8-18 Sa 8-14`, einmal mit Komma). Der Gebührentext ist mit
`parse-fee.ts` **nicht** zu lesen: dort ist `Euro` Pflicht, hier steht `€/h`.
Entweder `parse-fee.ts` um das Zeichen erweitern — mit Test, weil Berlin davon
betroffen wäre — oder eine eigene Funktion in `frankfurt.ts`. Die zweite Lösung
folgt der Regel.

**Feiertage — Hessen (`HE`).** Zehn gesetzliche Feiertage: die neun bundesweiten
plus **Fronleichnam** (Ostersonntag + 60). Kein Reformationstag, kein
Allerheiligen, kein Buß- und Bettag, keine gemeindeweise Regelung. Quelle:
Hessisches Ministerium des Innern, <https://innen.hessen.de/buerger-staat/feiertage>
(abgerufen 7. September 2026; das Landesrechtsportal
`rv.hessenrecht.hessen.de` antwortete zeitweise mit `Connection reset`).
Für `holidays.ts` heißt das eine Strukturänderung: `REGIONAL` hält heute nur
**feste** Daten als `MM-TT`, alles Bewegliche steht global in
`NATIONWIDE_FROM_EASTER`. Fronleichnam ist beides zugleich — beweglich
(Ostersonntag + 60) und **nicht** bundesweit. Es braucht also eine zweite
Länderliste mit Oster-Abständen. Hessen wäre `HE: { fest: [], ostern: [60] }`
oder ein gleichwertiger Zuschnitt. Kleine Änderung, aber sie geht keiner der
drei Kandidatenstädte aus dem Weg: Hessen, Nordrhein-Westfalen und Bayern
brauchen alle drei genau diese Erweiterung.

**Attribution:** `Stadt Frankfurt am Main, www.frankfurt.de`, DL-DE/BY-2.0,
`attributionRequired: true`.

**Quellen-Konfiguration:** `outputFormat: 'application/json'`,
`axisOrder: 'lon,lat'` — und `srsName` ist Pflicht, sonst kommt UTM.

### München

| `ZoneOut` | kommt aus |
| --- | --- |
| `zone` | `ruhver_prm_gebiete_poly.name` (`"TU-Viertel"`) |
| `district` | fehlt; über Stadtbezirksgrenzen aus dem GeoPortal zu ergänzen |
| `rawFee` / `fee` | **nirgends.** `Fee = { kind: 'unknown' }` für alle 82 Gebiete |
| `rawHours` / `windows` | aus `ruhver_parkseiten_line.parkregel_beschreibung`, je Gebiet über `prm_name` gebündelt |
| `maxStayMinutes` | aus demselben Text (`Kurzzeitparken 2h 9-18 Uhr`) |
| `spaces` | Summe von `angebot` über die Abschnitte des Gebiets |
| `unmodelledRules` | Halteverbote, Carsharing, E-Parken, `an Schultagen` |

**Eigener Parser** `muenchen.ts`, und er ist der aufwendigste der drei: 292
Schreibweisen, zusammengesetzte Klauseln mit Komma und `und`, Tagesangaben in
vier Formen (`Montag bis Freitag`, `Mo-Fr` gibt es nicht, `werktags`,
Wochentagslisten wie `Dienstag, Mittwoch, Freitag`), Uhrzeiten mit
Halbstunden (`6:30`), und mehrere Regelarten in einem Feld. Was er **nicht**
kann und auch nicht können soll: `an Schultagen` auflösen.

Zu klären vor der Umsetzung: ob `ruhver_parkseiten_line` überhaupt als Open Data
gilt. Die Ebene liegt im selben GeoServer unter derselben Lizenzangabe, ist im
Portal aber **nicht** als eigener Datensatz geführt. Rückfrage an
`gb1-23.mor@muenchen.de`.

**Feiertage — Bayern (`BY`), und hier lauert der Fallstrick, den `holidays.ts`
schon benennt.** Art. 1 Abs. 1 Nr. 2 des Bayerischen Feiertagsgesetzes:
gesetzlicher Feiertag „in Gemeinden mit überwiegend katholischer Bevölkerung
Mariä Himmelfahrt"; Abs. 3: das Landesamt für Statistik stellt fest, welche
Gemeinden das sind. Abs. 2: „In der Stadt Augsburg ist außerdem der 8. August
(Friedensfest) gesetzlicher Feiertag." Quelle:
<https://www.gesetze-bayern.de/Content/Document/BayFTG-1> (abgerufen
7. September 2026). Beides ist **gemeindeweise** und passt deshalb nicht in
`Record<Land, …>`. Der Eintrag gehört an die *Stadt*, nicht ans Land — dafür
müsste `City` ein optionales Feld für stadtspezifische Feiertage bekommen.
Bayern hat außerdem Heilige Drei Könige, Fronleichnam und Allerheiligen; ohne
Mariä Himmelfahrt sind das zwölf, mit dreizehn.

**Attribution:** `dl-de/by-2-0: Landeshauptstadt München – opendata.muenchen.de`,
`attributionRequired: true`.

### Köln — erst nach einer Rückfrage

| `ZoneOut` | kommt aus |
| --- | --- |
| `zone` | `ms:bewohnerparkgebiete_zonen.Name` / `.Abkürzung` |
| `rawFee` / `fee` | `psa_2016.csv`, Spalte `Gebühr je 20 Minuten` — **erst nach Klärung**, sonst `unknown` |
| `rawHours` | Spalte `Gebührenzeit`, 46 Schreibweisen mit `+` als Klauseltrenner |
| `maxStayMinutes` | Spalte `Höchstparkdauer`, Stunden als nackte Zahl; `0` ist ein Platzhalter |
| `spaces` | Spalte `Stellplätze` |

Zusätzlich nötig und sonst nirgends: **eine Umprojektion EPSG:25832 → EPSG:4326**
im `ingest`-Paket, weil der Kölner WFS `srsName` ignoriert. `packages/core`
bleibt davon frei.

**Feiertage — Nordrhein-Westfalen (`NW`)**, ebenso für Düsseldorf, Aachen,
Wuppertal, Krefeld, Bielefeld, Moers: die neun bundesweiten plus Fronleichnam
und Allerheiligen, also elf. Landesrecht über <https://recht.nrw.de>
(erreichbar, HTTP 200). Keine gemeindeweise Regelung. Der Eintrag ist damit
einfacher als Bayerns — aber er braucht dieselbe Erweiterung um einen
landesbezogenen österlichen Feiertag wie Hessen.

**Attribution:** DL-DE/Zero-2.0 — wie Berlin, `attributionRequired: false`. Der
Quellenvermerk bliebe trotzdem stehen; freiwillig ist nicht verboten.

### Karlsruhe, falls es doch soweit kommt

**Feiertage — Baden-Württemberg (`BW`)**: bundesweite neun plus Heilige Drei
Könige, Fronleichnam und Allerheiligen, also zwölf. Landesrecht über
<https://www.landesrecht-bw.de> (erreichbar, HTTP 200). Für Haguenau und
Saverne im selben Datensatz gilt gar kein deutsches Recht: Sie liegen im
Département Bas-Rhin, und dort gelten die französischen Feiertage — ein anderer
Satz, mit 14. Juli, 8. Mai, 11. November, dazu lokal Karfreitag und der
26. Dezember. Eine `Land`-Angabe kann das nicht ausdrücken. Das ist der stärkste
Grund, den Feed auf `gemeinde` zu filtern, statt ihn ganz zu nehmen.

**Attribution:** CC BY 4.0. Das ist eine **dritte** Lizenzfamilie;
`Attribution` trägt `licence` und `licenceUrl` schon als Text, es käme also kein
neuer Typ dazu — aber die Oberfläche müsste den Text prüfen, nicht nur den
Schalter.

---

## 5. Nebenbefund: Hamburg hat einen zweiten Feed, den wir nicht nutzen

Der wichtigste Einzelfund dieser Recherche betrifft nicht eine neue Stadt,
sondern die schon angeschlossene.

`https://geodienste.hamburg.de/HH_WFS_Parkscheinautomaten`, Typname
`de.hh.up:parkscheinautomaten`, **2.003** Automaten, `outputFormat`
`application/geo+json` oder `text/csv`. Herausgeber laut `ows:Fees` wörtlich:
„Datenlizenz Deutschland Namensnennung 2.0, Quellenvermerk: Freie und
Hansestadt Hamburg, **Landesbetrieb Verkehr**" — ein anderer Herausgeber als
der LGV, der die Bewohnerparkgebiete liefert. Abgerufen am 7. September 2026,
HTTP 200.

```json
{ "strasse": "ABC-Straße", "bezirk": "Hamburg-Mitte", "stadtteil": "Neustadt",
  "status": "aktiv", "tarifzone": "1", "handyparken": "nein",
  "handyparkzone": "111", "hoechstparkdauer": "120",
  "movon": "09:00", "mobis": "20:00", "divon": "09:00", "dibis": "20:00",
  … "savon": "09:00", "sabis": "20:00", "psanr": "11721" }
```

Warum das zählt:

- **Die Zeiten sind strukturiert, nicht Freitext.** Vierzehn Felder
  `movon`/`mobis` … `sovon`/`sobis`. Kein Parser nötig — was in Hamburgs
  Bewohnerparkgebieten zehn Schreibweisen und eine eigene Datei kostet, steht
  hier als Feldpaar je Wochentag. 28 verschiedene Wochenmuster insgesamt.
- **Es bestätigt drei Befunde aus `staedte.md` unabhängig.** Die
  Achsenreihenfolge ist auch hier `[lat, lon]` (`[53.5547, 9.9880]`) — die
  Konfiguration in `sources.ts` stimmt also nicht nur für einen Dienst.
  `hoechstparkdauer` benutzt wieder **`9999` als Platzhalter** (12 Automaten).
  Und Fenster laufen über Mitternacht: 102 Automaten stehen auf `09:00`–`02:00`.
- **Es füllt die Lücke, die die Bewohnerparkgebiete lassen.** Dort ist die
  `gebuehrenzone` in zehn Gebieten „Parkscheibe" oder leer; hier steht zu jedem
  Automaten eine `tarifzone` (2: 1.743, 1: 162, 4: 98). Der Eurobetrag steht
  allerdings auch hier **nicht** im Feed — er müsste weiter aus
  `bewohnerparkgebiete.gebuehrenzone` kommen, über die Tarifzone verbunden.
- **`handyparken`/`handyparkzone`** ist eine Angabe, die kein anderer geprüfter
  deutscher Feed führt (außer Moers).

Ob die Ebene aufgenommen wird, ist eine offene Entscheidung, keine Empfehlung
dieser Datei. Sie gehört auf die Liste in `todo.md`, zusammen mit der Frage, ob
2.003 Punkte gegenüber 146 Gebieten genug Neues sagen, um ihr Gewicht in
`public/data/hamburg/` zu rechtfertigen.

Zwei weitere Hamburger Ebenen fielen dabei an und sind für diese App uninteressant:
`Reisebusparkplätze` und `Motorradstellplätze`.

---

## 6. Was aus dieser Umgebung nicht erreichbar war

Damit die nächste Sitzung nicht dieselbe halbe Stunde verliert. Ergänzt die
Tabelle in `CLAUDE.md`:

| | |
| --- | --- |
| **`metaver.de`** | Antwortet auf **jede** Anfrage mit **HTTP 429 Too Many Requests** (nginx), auch auf die erste und mit gesetztem User-Agent. Der Metadatenkatalog für Bremen, Hamburg, Niedersachsen und Schleswig-Holstein ist damit aus dieser Umgebung nicht durchsuchbar. Über `WebFetch` meldet der Egress-Proxy die Domain zusätzlich als blockiert |
| **`www.bmi.bund.de`** | HTTP **400** auf jede Seite, auch mit Browser-Kennung. Die Feiertagsübersicht des Bundes ist nicht abrufbar; die Landesrechtsportale sind der Ersatz |
| **`www.muenchen.de`, `muenchenunterwegs.de`, `www.stadt-koeln.de`** | Über `WebFetch` vom Egress-Proxy blockiert — **über `curl` mit Browser-Kennung erreichbar**. Wer nur `WebFetch` versucht, hält die Seiten fälschlich für gesperrt |
| **`rv.hessenrecht.hessen.de`** | `Connection reset by peer`, dann beim zweiten Versuch HTTP 200. Unzuverlässig, nicht gesperrt |
| **`gdi1.geo.bremen.de`** | `CONNECT tunnel failed, response 502` |
| **`overpass-api.de`** | `Connection reset by peer` auf allen Endpunkten, auch `/api/status`. **`overpass.kumi.systems` funktioniert** und ist der Ersatz |
| **`stadt.muenchen.de`** | Antwortet mit 200, liefert aber eine leere Hülle — der Inhalt wird per JavaScript nachgeladen. Kein Fehler, nur nutzlos für `curl` |

Und eine Sache, die überrascht hat: **`ckan.govdata.de` ist offen und liefert
die vollständige CKAN-API.** Die nationale Suche über alle Länderportale ist
damit ein einziger `package_search`-Aufruf und ist der schnellste Weg zu einer
Stadt. Die meisten kommunalen Portale sind dagegen **keine** CKAN-Instanzen
mehr (Köln, Frankfurt, Düsseldorf, Dresden, Münster, Bonn, Potsdam, Freiburg
antworten alle mit 404 auf `/api/3/action/…`); nur München, Stuttgart, Leipzig,
Karlsruhe und Aachen haben noch eine.

---

## 7. Weg B (OpenStreetMap), nachgemessen

`staedte.md` beschreibt OSM als den Weg, der skaliert, und nennt die Übertragung
der Berliner Parkraumdaten nach OSM. Diese Recherche hat zum ersten Mal
**gezählt**, was dort liegt (Overpass, `overpass.kumi.systems`, 7. September
2026):

| Stadt | Wege mit `parking:*:fee` | Wege mit `parking:*:charge` bzw. `fee:conditional` |
| --- | --- | --- |
| **Berlin** | **39.913** | **8.488** |
| München | 4.322 | nicht gemessen |
| Frankfurt a. M. | 1.002 | nicht gemessen |
| Köln | 523 | nicht gemessen |

Die drei fehlenden Werte sind keine Aussage über die Daten: Nach den ersten
Abfragen wies der öffentliche Overpass-Server jede weitere mit einer
Zeitüberschreitung ab. Die Zahlen sind also nachzuholen, nicht zu deuten.

Die Zahlenreihe bestätigt beide Aussagen aus `staedte.md` auf einmal. Berlin
ist nach der Übertragung um **eine Größenordnung** besser erfasst als jede
andere Stadt — dort trägt sogar rund jeder fünfte Weg einen Betrag oder eine
bedingte Gebühr. Und in den übrigen Städten ist das Schema zwar vorhanden, aber
dünn: München hat mit 4.322 Wegen weniger als ein Drittel der 13.714
Straßenseiten, die die Stadt selbst veröffentlicht.

Für diese App heißt das: OSM ist heute kein Ersatz für einen amtlichen Feed,
sondern eine Ergänzung — und der Ort, an dem sich Berlins Datenqualität
weiterverbreitet, wenn andere Städte demselben Weg folgen. Die Wiedervorlage
bleibt, wie in `staedte.md`, nach dem dritten Parser.

---

## 8. Was als Nächstes zu tun ist

1. **Frankfurt anschließen.** Vorher zwei Fragen an
   `SVA.GDI@stadt-frankfurt.de`: Gibt es eine Ebene mit Stadtteil- oder
   Ortsbezirksgrenzen im selben Dienst? Und was bedeutet
   `mitparkraumbewirtschaftung = null` — „nein" oder „unbekannt"?
2. **`holidays.ts` um landesbezogene bewegliche Feiertage erweitern.**
   Fronleichnam ist der Auslöser: bundesweit beweglich, aber nicht bundesweit
   gültig. Heute kennt die Datei nur eine globale Osterliste. Ohne diese
   Änderung geht weder Hessen noch Nordrhein-Westfalen noch Bayern.
3. **Köln nachfragen**, bevor es auf eine Liste kommt: Wann wird `psa_2016.csv`
   auf die geltende Gebührenordnung gebracht? Kontakt siehe oben. Ein Datensatz
   unter DL-DE/Zero mit 2.315 Automaten in der viertgrößten Stadt wäre den
   Anruf wert.
4. **Hamburgs Parkscheinautomaten** als offenen Punkt in `todo.md` führen.
5. **Bremen und Hannover** aus einer Umgebung ohne die `metaver.de`-Sperre
   nachprüfen. Beide sind hier **nicht widerlegt**, nur nicht gefunden.
