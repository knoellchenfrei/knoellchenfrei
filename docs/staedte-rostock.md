# Rostock als achte Stadt — gemessen, entschieden, offen

> **Wo der Code liegt.** Parser `app/packages/core/src/rostock.ts`, Datenbau
> `app/packages/ingest/src/build-data-rostock.ts`, Abzug
> `app/apps/web/public/data/rostock/`, Tests `app/packages/core/test/rostock.test.ts`
> — alles auf demselben Zweig wie dieser Bericht, mit allen Einträgen in den
> gemeinsamen Dateien. Anders als bei Köln und Karlsruhe gibt es hier keine
> Schnipsel zum Nachtragen; die Liste der angefassten gemeinsamen Dateien
> steht unten, damit ein Merge weiß, wo er hinsieht.

> **Stand 16. September 2026.** Angeschlossen: zehn Bewohnerparkgebiete mit
> den Zeiten, Tarifen und Höchstparkdauern der 52 Parkscheinautomaten darin,
> 31 Ortsteile als Kartenkontext, Feiertagskalender Mecklenburg-Vorpommern mit
> Gesetzesbeleg, Lizenz CC0 belegt. **Nicht** angeschlossen: die 59 Automaten
> außerhalb der Gebiete — dafür gibt es in den Daten keine Fläche, siehe „Was
> offen bleibt", Punkt 1.

Alle Zahlen hier sind an diesem Tag gegen die Dienste selbst gemessen, nicht
aus [staedte-recherche-2026-09-16.md](staedte-recherche-2026-09-16.md)
übernommen. Wo die Messung von der Recherche abweicht, steht es dabei.

## Die Quellen

| | Parkscheinautomaten | Bewohnerparkgebiete | Ortsteile |
| --- | --- | --- | --- |
| Art | WFS 2.0.0 | WFS 2.0.0 | WFS 2.0.0 |
| Adresse | `https://geo.sv.rostock.de/geodienste/parkscheinautomaten/wfs` | `…/geodienste/bewohnerparkgebiete/wfs` | `…/geodienste/ortsteile/wfs` |
| Typname | `hro.parkscheinautomaten.parkscheinautomaten` | `hro.bewohnerparkgebiete.bewohnerparkgebiete` | `hro.ortsteile.ortsteile` |
| Umfang | `numberMatched="111"`, Punkte | `numberMatched="10"`, Polygone | `numberMatched="31"`, Polygone |
| Inhalt | Zone, Tarifstufe, Zeiten, Betrag je Stunde als Zahl, Taktung, Höchstparkdauer mit Einheitenfeld, Veranstaltungstarif, Bewohnerparkgebiet, Stellplätze | `bezeichnung` (`A3 – Östliche Altstadt`), `adressen` (Straßenliste) — **keine Zeiten, kein Betrag** | `gemeindeteil_name`, Schlüssel |
| Lizenz | CC0 1.0, wörtlich in `ows:AccessConstraints` (unten) und im Katalog `license_id: cc-zero` | dieselbe, wörtlich gleich | dieselbe |
| Aktualität | Katalog `metadata_modified` 2026-07-02 | Katalog 2026-05-27 | Katalog 2026-06-30 |

Der Lizenztext, wörtlich aus `GetCapabilities` **beider** Parkdienste und des
Ortsteil-Dienstes, abgerufen am 16. September 2026:

> Das von der Hanse- und Universitätsstadt Rostock hier angebotene Werk
> unterliegt der gemeinfreien Lizenz Creative Commons 1.0 Universell Public
> Domain Dedication (CC0 1.0; URL:
> https://creativecommons.org/publicdomain/zero/1.0/deed.de). Damit ist alles
> gestattet, ohne um weitere Erlaubnis bitten zu müssen. Es gelten folgende
> Regelungen zu Gewährleistung und Haftung:
> https://geo.sv.rostock.de/haftung-fuer-angebotene-inhalte.html

Der Katalog `https://www.opendata-hro.de/api/3/action/package_show?id=parkscheinautomaten`
bestätigt es: `license_id: cc-zero`, `license_title: CC0 1.0`, `author:
Hanse- und Universitätsstadt Rostock`, `maintainer_email:
geodienste@rostock.de`, `isopen: true`. CC0 ist damit die **vierte
Lizenzfamilie** des Projekts (`licenceFamily: 'cc0'`), ohne Nennungspflicht
wie DL-DE/Zero; der Quellenvermerk steht trotzdem.

Gefunden wurden alle drei Dienste über den Katalog
(`package_search?q=ortsteile` liefert genau einen Treffer mit WFS- und
Download-Adresse), nicht durch Raten. Eine Suche nach `stadtgrenze` oder
`gemeindegrenze` findet dagegen nur Bevölkerungsstatistik — die Gemeinde ist
die Vereinigung der 31 Ortsteile, und daraus kommt der Rahmen.

Daneben zwei Dokumente der Stadt, die keine Daten sind, aber die Daten
erklären:

- **Parkgebührenordnung** der Hanse- und Universitätsstadt Rostock, Amts- und
  Mitteilungsblatt Nr. 23 vom 26. November 2022 (246. Ergänzung der
  Ortsrechtsammlung, 1. Dezember 2022), als PDF unter
  `https://rathaus.rostock.de/sixcms/media.php/rostock_01.a.1107.de/datei/3%2007%28P002112206%29.pdf`,
  verlinkt von der Seite „Parken" des Amts für Stadtentwicklung, Stadtplanung
  und Mobilität. Sie beantwortet die Frage nach den Wochentagen (unten).
- **„Park- und Halteverbot"** des Stadtamts
  (`https://rathaus.rostock.de/de/service/aemter/stadtamt/park_und_halteverbot/257403`)
  mit der Auskunftsstelle für abgeschleppte Fahrzeuge — Beleg für
  `towedVehicles`.

## Die Eigenheit, die alles bestimmt: Tarifzonen ohne Flächen

Rostock teilt sein Stadtgebiet in die Tarifzonen **W, A, B, C und D** (§ 4
Abs. 1 der Parkgebührenordnung), dazu im Feed `X` für die Kunsthalle. Die
Zonen gibt es aber nur als „schematische Übersicht" in den Anlagen 1 bis 3
der Ordnung — PDF-Karten, keine Geometrie. Im Feed hängen Zone, Tarif, Zeiten
und Höchstparkdauer am **Automaten**, wie in Frankfurt; die einzigen Flächen
sind die **zehn Bewohnerparkgebiete**, und die folgen der Bewohner-, nicht der
Tariflogik: Im Gebiet A3 (Östliche Altstadt) stehen fünf Automaten der Zone B
neben einem der Zone A.

Gemessen, wie die beiden zusammenpassen:

| | über das Attribut `bewohnerparkgebiet` | über Punkt-in-Polygon |
| --- | --- | --- |
| Automaten in einem Gebiet | 48 von 111 | **52** von 111 |
| Attribut und Geometrie einig | 42 | — |
| Attribut zeigt auf ein anderes Gebiet, als der Automat steht | 1 (Nr. 142: `A1`, steht in A3) | — |
| Attribut gesetzt, Automat in keinem Gebiet | 5 | — |
| Automaten außerhalb jedes Gebiets | — | **59** |

Kein Automat liegt in zwei Gebieten. Das Attribut sagt, zu welchem
**Ausweis** ein Automat gehört, nicht, wo er steht; die Frage der App ist „was
gilt hier" — also entscheidet der Punkt, wie in Frankfurt.

**Die Entscheidung: Die Bewohnerparkgebiete sind die Zonen**, mit den
zusammengelegten Angaben der Automaten darin (`mergeRostockFees`,
`mergeRostockWindows`; Höchstparkdauer nur als Anteil und Ausprägungen, nie
als Gebietsregel — Frankfurts Weg). Was dabei fehlt, ist die andere Hälfte:
59 Automaten ohne Fläche, darunter alle vier der Zone D (Mo–Fr 8–18, 0,50 €),
die drei Busplätze, die Kunsthalle und 22 Automaten der Zone B in der
Stadtmitte außerhalb der Gebiete. Für sie eine Fläche zu erfinden — ein Kreis
um den Automaten, ein Voronoi-Stück — wäre eine Behauptung über Straßen, die
niemand geprüft hat, und die Regel dieses Projekts sagt: lieber eine Ebene
weglassen als eine falsche Auskunft. Die Alternativen stehen unter „Was
offen bleibt", Punkt 1; die Zahl steht im Log des Datenbaus, damit ein
Abzug, in dem sie kippt, auffällt.

## Die Zeitangabe

Fünf Schreibweisen über 111 Automaten, gezählt am 16. September 2026:

| `bewirtschaftungszeiten` | Automaten | Zonen | Lesart |
| --- | --- | --- | --- |
| `08:00-19:00` | 83 | A, B, W, Bus | täglich, 8–19 Uhr |
| `08:00-18:00` | 22 | C | täglich, 8–18 Uhr |
| `Mo-Fr 08:00-18:00` | 4 | D | Montag bis Freitag |
| `08:00-20:00` | 1 | X (Kunsthalle) | täglich, 8–20 Uhr |
| `Mo-Fr,So 08:00-19:00; Sa 15:00-19:00` | 1 | W4 (Strandweg) | zwei Fenster |

**Die mehrdeutige ist die häufigste.** `08:00-19:00` ohne Tag kann Mo–So oder
Mo–Sa heißen, und das Feld sagt es nicht. Die Recherche hatte das als offene
Frage markiert; die Antwort steht in der Parkgebührenordnung, § 4 Abs. 2 und
3, wörtlich je Zone:

- Zone W: „täglich 8 - 20 Uhr" (Haupt- wie Nebensaison)
- Zone A: „täglich 8 - 19 Uhr"
- Zone B: „täglich 8 - 19 Uhr"
- Zone C: „täglich 8 - 18 Uhr"
- Zone D: „werktags Montag - Freitag 8 - 18 Uhr"

Also: **täglich** — und die einzige Zone, die die Ordnung auf Werktage
beschränkt, ist genau die einzige, die der Feed mit `Mo-Fr` ausschreibt. Der
Parser liest eine Angabe ohne Tag deshalb als Montag bis Sonntag, und ein
Test in `rostock.test.ts` hält fest, dass ein Rostocker Gebiet am
Sonntagmittag kassiert. Eine tagelose Klausel **neben** einer mit Tag
(`08:00-19:00; Sa 15:00-19:00`) wäre widersprüchlich und bricht ab; sie kommt
im Feed nicht vor.

Was dabei aufgefallen ist und nicht stimmt: Für Zone W nennt die Ordnung
8–20 Uhr, der Feed an allen 27 W-Automaten 08:00-19:00. Die Ordnung ist von
2022, der Feed vom Juli 2026; welche Fassung gilt, weiß nur die Stadt (Punkt 2
unten). Ausgeliefert wird, was der Feed sagt — das Panel nennt es „Zeiten
laut Quelle".

Das Semikolon trennt Klauseln, das Komma Tagesgruppen, der Bindestrich
spannt; Minuten und zweistellige Stunden sind Pflicht. Alles andere
(`8:00-19:00`, `08-19`, `täglich …`, `… Uhr`, über Mitternacht) weist der
Parser mit `RostockParseError` ab, statt eine Schreibweise zu erfinden, die
im Feed nicht vorkommt.

## Die Höchstparkdauer

Zwei Felder, ein Wert: `normaltarif_parkdauer_max` als **Zahl** und
`normaltarif_parkdauer_max_einheit` als Text — `h` 108-mal, `min` 2-mal,
`d` 1-mal. Verteilung: 2 h (62), 24 h (28), 1 h (7), 6 h (7), 4 h (3), 3 h
(2), 30 min (2), 4 d (1). Kein Platzhalter für „unbegrenzt"; `24 h` und `4 d`
werden wörtlich übernommen. Eine Zahl ohne Einheit bricht ab — Stunden
anzunehmen wäre raten —, `0` ebenso, weil es „Parken verboten" hieße.

Wie in Frankfurt wird sie **nie** als Regel des Gebiets ausgegeben: In A2
steht „2 h" neben „30 min", in W1 „2 h" neben „6 h", in A3 drei Werte. Das
Panel bekommt den häufigsten Wert, seinen Anteil und alle Ausprägungen.

## Die Entscheidung zur Gebühr

`normaltarif_gebuehren_pro_stunde` ist eine **Zahl** in Euro — die erste
Stadt, in der kein Text zerlegt werden muss: `1.5` (46), `3.0` (26), `1.0`
(21), `2.0` (8), `0.5` (4), `5.0` (3), `0.6` (1); bei zwei Automaten (Tarif
`A3` am Universitätsplatz und `C3`, beide 30 Minuten Höchstparkdauer) **fehlt
das Feld**. Die Sätze decken sich mit § 4 Abs. 3 der Ordnung
(straßenbegleitende Parkflächen: W 3,00 in der Hauptsaison, A 2,00, B 1,50,
C 1,00, D 0,50) — bis auf die Busse (Feed 5,00, Ordnung 6,00) und die
Nebensaison in Warnemünde (Ordnung 1,00 € vom 1. November bis 31. März, im
Feed nirgends als solche).

Drei Regeln, dieselben wie überall: Ein fehlendes Feld ist `unknown`, kein
Nullbetrag. `0` ist ein Abbruch, nie `exact` mit 0 Cent. Und weil eine Zahl
kein Muster hat, an dem Unfug auffiele, prüft der Parser sie selbst: `NaN`,
Unendlich, negativ, Bruchteile eines Cents und Beträge über 999 € brechen ab
(`0.6 * 100` ist in Gleitkomma 60,00000000000001 — gerundet, nicht
abgeschnitten). Mehrere Sätze in einem Gebiet ergeben `Fee.range` (A3:
1,50–2,00 €), Automaten ohne Betrag ziehen die Spanne nicht nach unten.

Der **Veranstaltungstarif** (`veranstaltungstarif_gebuehren_pro_stunde`,
84-mal gesetzt: 2,00 an B-Automaten, 1,00 an W-Automaten, 5,00 an Busplätzen)
ist eine Regel, die das Modell nicht ausdrückt. Wann er gilt, sagt der Feed
nicht; § 5 der Ordnung kennt Hanse Sail und Weihnachtsmarkt, und dazu passt
der Wert 2,00 in Zone B (Satz der Zone A). Nicht dazu passt 1,00 in
Warnemünde — das ist der Nebensaisonsatz aus § 4 Abs. 3. Deshalb steht der
Betrag als `unmodelledRules` wörtlich im Panel, ohne Bedeutung dazuzudichten,
und nur, wo er vom Normaltarif abweicht.

## Die Achsenreihenfolge, gemessen

`DefaultCRS` beider Parkdienste ist `urn:ogc:def:crs:EPSG::25833`.
`outputFormat=application/geo+json` (wie Hamburg; `application/json` wird
mit `InvalidParameterValue` abgewiesen). Drei Abrufe desselben Automaten:

| Anfrage | Antwort |
| --- | --- |
| WFS mit `srsName=urn:ogc:def:crs:EPSG::4326` | `[54.0873728, 12.1383774]` — **`[lat, lon]`** |
| WFS **ohne** `srsName` | `[12.1383774, 54.0873728]` — `[lon, lat]`, in Grad, nicht UTM |
| GeoJSON-Download | `[12.145634, 54.087699]` — `[lon, lat]`, ohne `crs` |

Weil `wfsUrl` den Parameter für alle Städte setzt, steht in `sources.ts`
`axisOrder: 'lat,lon'`. Der Datenbau prüft danach zweimal: `assertDegrees`
gegen UTM, `assertInRostock` gegen die gedrehte Reihenfolge — ungedreht läge
Warnemünde bei 12° Nord, 54° Ost vor Somalia, mit gültigen Graden.

Eine zweite Eigenheit des WFS, die der Download nicht hat: **Ein leeres Feld
fehlt, statt `null` zu tragen.** 80 der 111 Automaten haben kein
`normaltarif_gebuehren_max`, zwei kein `normaltarif_gebuehren_pro_stunde`;
`bewohnerparkgebiet` ist bei 63 Automaten ein Leerstring. Die Fixtures sind
deshalb Auszüge aus der **WFS-Antwort**, und `fixture-shape.test.ts` hält
`absent` ausdrücklich fest. Und der WFS trägt ein Feld, das der Download
nicht hat: `bezeichnung`, den Standort in Worten.

## Der Probelauf

`CITY=rostock pnpm --filter @knoellchenfrei/ingest fetch-data` (3 Quellen:
10, 111, 31 Features) und `build-data-rostock`, 16. September 2026:

```
districts.geojson: 34 KB · zones.geojson: 11 KB · poi/umweltzone: leer · meta.json
10 von 10 Gebieten übernommen — 0 ohne Parkscheinautomaten ausgelassen, 0 ohne Ortsteil-Treffer
52 von 111 Automaten einem Gebiet zugeordnet, 59 liegen in keinem
Attribut bewohnerparkgebiet: 42 mal einig mit der Geometrie, 1 mal uneins, 5 mal auf ein Gebiet zeigend, in dem der Automat nicht steht
31 Ortsteile
```

| Gebiet | Ortsteil | Automaten | Zeiten | Tarif | Höchstparkdauer (häufigster, alle) |
| --- | --- | --- | --- | --- | --- |
| A1 Nördliche Altstadt | Stadtmitte | 7 | 08:00-19:00 | 1,50 € | 2h (2h, 24h) |
| A2 Zentrum | Stadtmitte | 2 | 08:00-19:00 | 2,00 € | 2h (2h, 30min) |
| A3 Östliche Altstadt | Stadtmitte | 6 | 08:00-19:00 | **1,50–2,00 €** | 2h (2h, 1h, 4h) |
| A4 Steintor-Vorstadt | Stadtmitte | 7 | 08:00-18:00 | 1,00 € | 24h |
| B1 KTV | Kröpeliner-Tor-Vorstadt | 3 | 08:00-19:00 | 1,50 € | 2h |
| B2 KTV | Kröpeliner-Tor-Vorstadt | 5 | 08:00-19:00 | 1,50 € | 2h |
| H1 Thünenviertel/Hansaviertel | Hansaviertel | 4 | 08:00-18:00 | 1,00 € | 24h |
| W1 Ostseebad Warnemünde | Seebad Warnemünde | 10 | 08:00-19:00 | 3,00 € | 2h (2h, 6h) |
| W2 Ostseebad Warnemünde | Seebad Warnemünde | 6 | 08:00-19:00; Mo-Fr,So 08:00-19:00; Sa 15:00-19:00 | 3,00 € | 2h (2h, 1h, 3h) |
| W4 Ostseebad Warnemünde | Seebad Warnemünde | 2 | 08:00-19:00 | 3,00 € | 2h |

Zonenschlüssel sind die Kürzel (`A1` … `W4`), zehn verschiedene; ein
doppeltes bräche den Datenbau ab. `zone-units` fasst W4 (klein) in den
Ortsteil — 9 Zonen, 1 Bezirk. `meta.absent` ist `['poi', 'umweltzone',
'segments']`: Rostock hat keine Umweltzone, die Behindertenparkplätze liegen
in einem eigenen Datensatz, der nicht abgerufen ist.

## Der Rahmen, der Mittelpunkt, die Auskunftsstelle

`reportBounds` kommt aus den 31 Ortsteilen (11,9984–12,2954 /
54,0508–54,2445, nach außen gerundet: 11,99–12,30 / 54,04–54,25), nicht aus
den Gebieten (12,0662–12,1497 / 54,0742–54,1818): Lütten Klein, Dierkow und
Hohe Düne lägen sonst „außerhalb". Kein Rahmen einer anderen Stadt kommt
Rostock nahe; Hamburg endet bei 10,35° Ost.

Der Mittelpunkt (12,108 / 54,128) ist die Mitte des Gebietsrahmens, nicht der
Neue Markt: Die Gebiete liegen in zwei Haufen elf Kilometer auseinander, und
bei Zoom 12 sind von dort aus beide im Bild; vom Neuen Markt aus fiele
Warnemünde mit 27 Automaten heraus.

`towedVehicles` ist belegt, wörtlich von der Seite des Stadtamts: „Auskünfte
über abgeschleppte Fahrzeuge erteilt die Einsatzleistelle der Polizei Waldeck
unter der Telefonnummer 038208 8880. Dort wird auch mitgeteilt, wo man das
Fahrzeug wieder in Empfang nehmen kann." Eingetragen ist die Stelle, die
Auskunft gibt, nicht das Amt, das den Bescheid schreibt.

## Feiertage: Mecklenburg-Vorpommern

Neu in `holidays.ts` als `MV`, **elf** Feiertage: die neun bundesweiten plus
**Frauentag** (8. März) und **Reformationstag** (31. Oktober). Beleg: § 2
Abs. 1 des Gesetzes über Sonn- und Feiertage (Feiertagsgesetz
Mecklenburg-Vorpommern – FTG M-V) in der Fassung der Bekanntmachung vom
8. März 2002 (GVOBl. M-V S. 145).

- Der Reformationstag steht seit dem ersten Gesetz von 1992 darin
  (Landtags-Drucksache 1/1870 vom 27. Mai 1992, § 2 Abs. 1 Nr. 8: „der
  Reformationstag (31. Oktober)").
- Der Frauentag kam mit dem Vierten Gesetz zur Änderung des Feiertagsgesetzes
  Mecklenburg-Vorpommern vom 7. Juli 2022 (GVOBl. M-V Nr. 31 vom 12. Juli
  2022, S. 427), Artikel 1 Nr. 1 wörtlich: „Nach Nummer 1 wird folgende
  Nummer 2 eingefügt: ‚2. der Frauentag (8. März),'. Die bisherigen Nummern
  2 bis 10 werden die Nummern 3 bis 11." In Kraft am Tag nach der
  Verkündung, erstmals am 8. März 2023. Aus der Umnummerierung folgt die
  Zahl elf.
- Buß- und Bettag stand nur im Entwurf von 1992 (Nr. 9) und ist seit 1995
  in allen Ländern außer Sachsen abgeschafft; Fronleichnam, Allerheiligen und
  Heilige Drei Könige kennt das Land nicht.

Beide Texte sind am 16. September 2026 als PDF gelesen worden
(`dokumentation.landtag-mv.de/parldok/dokument/3458/…` und `…/43701/…`,
`regierung-mv.de/static/…/GVOBl. Nr. 31 v. 12.7.2022.pdf`). Das
Landesrechtsportal `landesrecht-mv.de` antwortet ohne JavaScript nur mit
einer leeren Seite — es taugt als Fundstelle, nicht als Abruf. Die Tests in
`holidays.test.ts` messen den Unterschied zu Hamburg (Frauentag) und Berlin
(Reformationstag) als je genau ein Datum. Eine gemeindeweise Regelung wie in
Bayern gibt es nicht; Rostock braucht kein `holidays`-Feld.

## Was einzutragen bleibt

Nichts — alle Einträge sind auf diesem Zweig gemacht. Zum Mergen die Liste
der **gemeinsamen** Dateien mit Rostock-Zeilen: `core/src/city.ts` (Konstante
`ROSTOCK`, `CITIES`), `core/src/holidays.ts` (`MV` in `Land` und `REGIONAL`,
Belegabsatz), `core/src/index.ts`, `ingest/src/sources.ts`
(`ROSTOCK_SOURCES`, `BY_CITY`), `ingest/package.json`,
`core/test/city.test.ts`, `core/test/holidays.test.ts`, `core/test/fuzz.test.ts`,
`core/test/fixture-shape.test.ts`, `ingest/test/quellen.test.ts`,
`ingest/test/zone-units.test.ts`, `apps/web/test/flaechenpunkt.test.ts`,
`apps/web/statistik/main.ts`, `.github/workflows/deploy.yml` und
`kacheln.yml`, `NOTICE`, `README.md`, `CLAUDE.md`, `docs/staedte.md`,
`docs/data-sources.md`, `docs/todo.md`; erzeugt: `zone-keys.generated.ts`,
`zone-units.generated.ts`, `zone-units.generated.json`. Nicht angefasst, weil
zentral: `index.html`, `manifest.webmanifest`, `login-page.ts`.

## Was offen bleibt

1. **59 der 111 Automaten haben keine Fläche** (alle Zone D, Busplätze,
   Kunsthalle, 22 B-Automaten in der Stadtmitte). Drei Wege, keiner
   entschieden: (a) die Stadt nach den Zonenpolygonen fragen
   (`geodienste@rostock.de`; die Anlagen 1–3 der Ordnung zeigen, dass sie
   als Karte existieren), (b) Kleinflächen je Automat mit
   `City.zoneSnapMetres` wie in Karlsruhe — ehrlich nur, wenn das Panel den
   Abstand sagt und die Fläche als Automatenstandort erkennbar ist, nicht
   als Gebiet, (c) die Zonen aus den Anlagen digitalisieren, mit allen
   Fehlern einer schematischen Karte. Bis dahin sagt die App außerhalb der
   zehn Gebiete „außerhalb der Parkraumbewirtschaftung", und das ist an 59
   Automaten falsch.
2. **Welche Parkgebührenordnung gilt.** Die Fassung vom 26. November 2022
   sagt für Zone W „täglich 8 - 20 Uhr" und für Busse 6,00 €; der Feed vom
   Juli 2026 sagt 08:00-19:00 und 5,00 €. Und die Nebensaison in Warnemünde
   (1,00 € vom 1. November bis 31. März) steht im Feed nirgends als solche
   — oder doch, als `veranstaltungstarif` 1,00 an genau den W-Automaten.
   Klären mit dem Tiefbauamt; bis dahin gilt der Feed, und der
   Veranstaltungstarif steht ohne Deutung im Panel.
3. **Feiertage in „täglich"-Zonen.** Die Ordnung sagt „täglich" und nichts
   zu Feiertagen; die Regel dieses Projekts (`isFreeDay` in `tariff.ts`)
   macht jeden gesetzlichen Feiertag gebührenfrei. Für Rostock heißt das an
   elf Tagen im Jahr „frei" über Gebieten, die am Sonntag kassieren — ob das
   stimmt, sagt keine Quelle. Der Punkt ist nicht rostock-spezifisch
   (Hamburgs „täglich 9-2 Uhr", Frankfurts `Tgl.`), gehört aber hierher,
   weil hier 83 von 111 Automaten so lauten. Weg: `freeOnHolidays` bis in
   `ZoneProperties` durchreichen und je Stadt belegen.
4. **Behindertenparkplätze** gibt es im Katalog vermutlich als eigenen
   Datensatz (nicht geprüft); sie könnten wie in Frankfurt als POI mitkommen.
5. **Kachelarchiv** (`kacheln.yml`) und die **Beschreibungstexte** der App
   laufen zentral; Rostock steht in beiden Stadtlisten der Workflows.

## Prüfstand

Alle am 16. September 2026 grün, aus `app/` bzw. der Wurzel:
`pnpm -r typecheck`, `pnpm test` (core 909, ingest 53, api 101, web 304),
`./scripts/sprache-pruefen.sh`, `node scripts/doku-pruefen.mjs`,
`./scripts/namen-pruefen.sh`, `./scripts/commit-pruefen.sh`. Nicht gelaufen:
die E2E-Suite (läuft zentral), der Kachelbau.

## Dateien

| Datei | Inhalt |
| --- | --- |
| `app/packages/core/src/rostock.ts` | Parser: Zeiten, Betrag als Zahl, Höchstparkdauer mit Einheit, Gebietsbezeichnung, Zusammenlegen |
| `app/packages/core/test/rostock.test.ts` | Parser gegen jeden Wert des Abzugs plus Unfug, Tarifrechnung am Sonntag und am Reformationstag |
| `app/packages/core/test/fixtures/hro-parkscheinautomaten-2026-09-16.json` | elf Automaten aus der WFS-Antwort: jede Schreibweise, beide ohne Betrag, alle Einheiten |
| `app/packages/core/test/fixtures/hro-bewohnerparkgebiete-2026-09-16.json` | alle zehn Gebiete, Sachdaten |
| `app/packages/ingest/src/build-data-rostock.ts` | Datenbau: Ortsteile, Automaten, Gebiete; Punkt-in-Polygon; Zählung ins Log |
| `app/apps/web/public/data/rostock/` | `zones.geojson` (10), `districts.geojson` (31), `poi.geojson` und `umweltzone.geojson` (leer), `meta.json` |
| `docs/staedte-rostock.md` | dieser Bericht |
