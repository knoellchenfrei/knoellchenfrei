# Zweite Stadt: was dafür an Daten da sein muss

Die Zonenlogik dieser App ist nicht Berlin-spezifisch — Tarifrechnung,
Zeitfenster-Parser, Heatmap-Raster und Ruhetags-Hinweis funktionieren überall.

Berlin steckte an drei Stellen, hieß es hier: Datenquelle, Feiertagskalender,
Kartenausschnitt. Beim Nachzählen waren es sechs — die Grenzprüfung stand als
Zahlenpaar im Browser-Speicher, beim Merken des Parkplatzes, im Worker und im
Telegram-Parser, jeweils einzeln. Seit `core/city.ts` steht sie einmal; der
Feiertagskalender hängt am Bundesland. Was bleibt, ist die Datenquelle.

Die Frage ist deshalb nicht „läuft der Code anderswo", sondern **„gibt es
anderswo die Daten".** Das ist diese Analyse.

## Methodik und ihre Grenze

Diese Analyse entstand in zwei Schritten. Zuerst aus **Recherche**: Der
Egress-Proxy der Arbeitsumgebung ließ nur `daten.berlin.de` durch, alle
anderen Portale antworteten mit 403. Seit dem 6. September 2026 ist er offen,
und Hamburg ist seitdem **abgerufen** — Feld für Feld, nicht aus Metadaten
abgeschrieben. Für alle übrigen Städte gilt die erste Fassung unverändert: Sie
stammen aus Recherche, **nicht aus dem Abruf der Schnittstellen**. Die letzte
Spalte sagt jeweils, wie belastbar ein Eintrag ist.

Der Unterschied war kein akademischer. Vier der sieben Befunde zu Hamburg
weiter unten — die umgekehrte Achsenreihenfolge, die Fenster über Mitternacht,
die Platzhalter in der Höchstparkdauer und die Gebiete ohne Gebühr — stehen in
keinem Metadatensatz. Sie zeigen sich erst, wenn man die Zeilen liest.

| Stufe | Bedeutung |
| --- | --- |
| **geprüft** | Schnittstelle selbst abgerufen, Felder gesehen |
| **belegt** | Datensatz im Portal nachgewiesen, Inhalt nicht selbst geprüft |
| **Hinweis** | Es gibt Anzeichen, aber keinen belegten Datensatz |

Vor jeder Umsetzung gehört die Checkliste am Ende dieses Dokuments abgearbeitet.

**Nachtrag, 7. September 2026:** Für sechzehn weitere Städte ist die Checkliste
inzwischen abgearbeitet — abgerufen, nicht abgeschrieben. Die Ergebnisse, die
Rangliste und die Negativbefunde stehen in
[staedte-recherche-2026-09.md](staedte-recherche-2026-09.md). Die Tabelle
„Städte im Einzelnen" weiter unten ist damit an mehreren Stellen überholt; wo
sich beide widersprechen, gilt die Recherche.

## Was gebraucht wird

Vier Dinge, in dieser Reihenfolge. Ohne die ersten beiden geht gar nichts;
ohne die letzten beiden geht es, aber schlechter.

| | Woran es hängt | Berlin liefert |
| --- | --- | --- |
| **1. Geometrie** | Flächen oder Straßenabschnitte der bewirtschafteten Bereiche | 103 Zonenpolygone, 45.917 Abschnitte |
| **2. Offene Lizenz** | Weiterverwendung erlaubt, ohne Vertrag | Datenlizenz Deutschland Zero 2.0 |
| **3. Tarif** | € je Stunde, je Zone | ja, als Freitext im Feed |
| **4. Zeiten** | Wochentage und Uhrzeiten der Gebührenpflicht | ja, als Freitext im Feed |

Berlins Besonderheit ist Punkt 3 und 4 **im selben Datensatz wie die
Geometrie**. Genau das ist andernorts die Ausnahme: Die meisten Städte
veröffentlichen die Flächen, die Gebührenordnung steht daneben in einer PDF.

## Drei Wege zu einer zweiten Stadt

### Weg A — kommunales Open-Data-Portal

Der Berliner Weg. Beste Datenqualität, aber jede Stadt hat ein eigenes Schema,
eigene Feldnamen und eigene Schreibweisen für Zeiten. Der Aufwand ist je Stadt
ein neuer Parser, nicht eine Konfigurationszeile.

### Weg B — OpenStreetMap

Seit Dezember 2022 gibt es ein einheitliches Schema für Parken im Straßenraum
(`parking:right:*`, `parking:left:*` — das alte `parking:condition:*` ist
abgelöst). Damit sind Gebührenpflicht, Höchstparkdauer und Beschränkungen an der
Straße selbst modellierbar.

Zwei Entwicklungen machen diesen Weg interessanter, als er 2022 war:

- **Berlins amtliche Parkraumdaten sind nach OSM übertragen worden** — in einem
  Gemeinschaftsprojekt von Senatsverwaltung, FixMyCity und der Berliner
  OSM-Community, zwischen Mitte 2025 und Anfang 2026.
- Das Projekt [parkraum.osm-verkehrswende.org](https://parkraum.osm-verkehrswende.org/)
  hat aus dem Prototyp für Neukölln eine **skalierbare Pipeline** gebaut, die
  ausdrücklich auf weitere Regionen und ganz Deutschland zielt.

Der Preis: OSM kennt in aller Regel **keine Tarife**. `fee=yes` steht dort, der
Betrag fast nie. Eine Stadt über OSM beantwortet also „kostet es etwas" und
„wie lange darf ich", aber nicht „wie viel".

### Weg C — kommerzielle Anbieter

Ausgeschlossen. Im 2012er Ordner dieses Projekts lagen Zonen-KML-Dateien von
`parkmobile.nl` für elf deutsche Städte — abgerufen, ohne Lizenz. Genau solche
Dateien sind der Grund, warum das Umzugsskript den alten `doc`-Ordner ausdünnt.
Für ein Projekt, das seine Datenherkunft ausweist, ist das keine Option.

## Städte im Einzelnen

Sortiert nach Aussicht auf Erfolg, nicht nach Einwohnerzahl.

| Stadt | Geometrie | Tarif | Zeiten | Lizenz | Stufe |
| --- | --- | --- | --- | --- | --- |
| **Berlin** | WFS, Zonen und Abschnitte | im selben Feed | im selben Feed | DL-DE/Zero-2.0 | **geprüft** |
| **Hamburg** | 146 Bewohnerparkgebiete als WFS | je Gebiet, als „3,50 € je Stunde" | je Gebiet, zehn Schreibweisen | DL-DE/**Namensnennung** 2.0 | **geprüft** |
| **München** | Datensatz „Parkraummanagementgebiete" als Polygone im Open-Data-Portal, dazu 76 Parklizenzgebiete im GeoPortal | offen | offen | Portal ist auf offene Lizenzen ausgelegt | **belegt** |
| **Frankfurt / Rhein-Main** | Regionalverband stellt Karten und Geodaten als WFS bereit | offen | offen | als Open Data ausgewiesen | **Hinweis** |
| **Stuttgart** | Geoportal mit ausgewiesenen Open-Data-Beständen | offen | offen | ausgewiesen | **Hinweis** |
| **Leipzig, Dresden** | eigene Open-Data-Portale vorhanden | offen | offen | offen | **Hinweis** |
| **Köln** | Portal vorhanden, Parkdatensatz nicht nachgewiesen | offen | offen | offen | **Hinweis** |
| **alle übrigen** | über OSM, soweit die Community die Straßen erfasst hat | praktisch nie | teilweise | ODbL | **Weg B** |

Nüchtern gelesen heißt die Tabelle: **Hamburg und München sind die einzigen
beiden Kandidaten, für die ein konkreter Datensatz benannt ist.** Alles
darunter ist ein Portal, in dem noch niemand nachgesehen hat.

## Empfehlung

**Hamburg zuerst.** Zwei Gründe: Es ist die einzige Stadt neben Berlin, für die
zwei einschlägige Datensätze belegt sind — Bewohnerparkgebiete *und*
öffentlicher Parkraum —, und das Transparenzportal ist auf maschinellen Abruf
ausgelegt. Dazu kommt, dass Hamburg wie Berlin ein Stadtstaat ist: eine
Verwaltung, ein Feiertagskalender, ein Datenbestand. Bei einer Flächenstadt
kommt die Frage dazu, wer eigentlich zuständig ist.

**München danach**, weil der Datensatz benannt ist und die Stadt genug Zonen
hat, dass es sich lohnt.

**Danach nicht die nächstgrößere Stadt, sondern OSM.** Sobald der dritte Parser
geschrieben ist, wird deutlich, dass jede weitere Stadt derselbe Aufwand von
vorn ist. Weg B skaliert stattdessen: ein Parser für ein bundesweit
einheitliches Schema. Die App müsste dann nur ehrlich sagen, was sie nicht
weiß — „gebührenpflichtig, Betrag unbekannt" ist eine brauchbare Antwort, eine
geratene wäre es nicht.

## Hamburg im Einzelnen

Abgerufen und Feld für Feld angesehen am 6. September 2026 — Stufe **geprüft**,
nicht mehr *belegt*. Angeschlossen ist Hamburg seither auch: `core/hamburg.ts`
liest den Feed, `ingest/build-data-hamburg.ts` baut ihn, und in den
Einstellungen lässt sich zwischen beiden Städten wechseln.

| | |
| --- | --- |
| **Bewohnerparkgebiete** | `https://geodienste.hamburg.de/HH_WFS_bewohnerparkgebiete`, Typname `de.hh.up:bewohnerparkgebiete`, **146** Gebiete |
| **Stadtteile** | `https://geodienste.hamburg.de/HH_WFS_Verwaltungsgrenzen`, Typname `app:stadtteile`, **104** — Hamburgs Gegenstück zu Berlins Ortsteilen |
| **Öffentlicher Parkraum** | `https://geodienste.hamburg.de/HH_WFS_Parkraum`, Typname `de.hh.up:parkraum`, **203.283** Polygone — nicht abgerufen, Begründung unten |
| Ausgabeformat | `application/geo+json`. **Nicht** `application/json` wie Berlin — falsch angefragt kommt GML, also gültiges XML, an dem `JSON.parse` scheitert |
| Herausgeber | Freie und Hansestadt Hamburg, Landesbetrieb Geoinformation und Vermessung |
| Lizenz | Datenlizenz Deutschland **Namensnennung** 2.0 |

### Die Felder, die tragen

Ein Bewohnerparkgebiet sieht so aus:

```json
{ "bwp_code": "N101", "bwp_name": "N 101 Flughafenstraße",
  "bewirtschaftungszeit": "täglich 9-20 Uhr", "gebuehrenzone": "Parkscheibe",
  "hoechstparkdauer": "180", "bewirtschaftungsart": "Parkscheibe, Bewohner mit Ausweis frei",
  "geplant_aktiv": 2 }
```

Verglichen mit Berlin ist das **einfacher** — zehn Schreibweisen der Zeiten
statt achtzehn, die Höchstparkdauer als Zahl statt als Prosa — und trotzdem
enthält es vier Dinge, die Berlin nicht kennt. Jedes davon ist ein eigener
Fallstrick, und jedes hat einen Test:

**1. Die Achsenreihenfolge ist umgekehrt.** Auf dieselbe Anfrage
(`srsName=urn:ogc:def:crs:EPSG::4326`) antwortet Berlin mit `[lon, lat]` und
Hamburg mit `[lat, lon]`. Hamburg hält sich an die URN-Form, die die Breite
zuerst vorschreibt; Berlin liefert GeoJSON-Konvention. Beides ist
verteidigbar. Ungedreht landen Hamburgs Gebiete bei 9° Nord, 53° Ost — im Golf
von Guinea —, und auf der Karte sieht das nicht nach einem Fehler aus, sondern
nach einer leeren Stadt. Die Reihenfolge steht deshalb als Feld in
`ingest/sources.ts` und wird nicht geraten: In Hamburg sind beide Zahlen
zweistellig und plausibel.

**2. Fenster laufen über Mitternacht.** Fünf Gebiete lauten „täglich 9-2 Uhr".
Ein einzelnes `ChargeWindow` kann das nicht — `fromMinute > toMinute` heißt in
der Prüfung schlicht „nie". Der Parser zerlegt es in 9:00–24:00 und 0:00–2:00
des **Folgetags**; bei „täglich" fällt der Tageswechsel nicht auf, bei
„werktags" schon.

**3. „werktags" ist Montag bis Samstag.** Nicht Montag bis Freitag. Das folgt
der Legaldefinition in § 3 Abs. 2 BUrlG („Werktage sind alle Kalendertage, die
nicht Sonn- oder gesetzliche Feiertage sind") und ständiger Rechtsprechung des
BGH; im Verkehrsrecht wird das Zusatzzeichen genauso gelesen. Andersherum
gelesen meldete die App an **31 Gebieten** samstags „gebührenfrei", und das
kostet ein Knöllchen.

**4. Es gibt Gebiete ohne Gebühr.** `gebuehrenzone` trägt in sieben Gebieten
„Parkscheibe", in zwei „-", in einem nichts. Das ist **kein Preis von null**:
Wer im Parkscheibengebiet ohne Scheibe steht, zahlt. `Fee` hat dafür die
Varianten `disc` und `unknown` bekommen, und `CostEstimate.priced` zwingt die
Oberfläche, etwas anderes zu sagen als „0,00 €".

Dazu zwei Kleinigkeiten, die still falsch geworden wären: `hoechstparkdauer`
benutzt **9999 und 0 als Platzhalter** für „unbegrenzt" — ungeprüft übernommen
stünde in der App „6 Tage 22 Stunden". Und `geplant_aktiv` unterscheidet
aktive von geplanten Gebieten (145 gegen 1); welche Zahl was heißt, sagt der
Feed nicht, deshalb gilt die vorsichtige Lesart: nur der häufige Wert zählt als
aktiv. Ein Gebiet zu übersehen kostet einen fehlenden Hinweis, ein geplantes
auszuliefern eine falsche Warnung.

### Die Preise: der Feed stimmt, seine Beschreibung nicht

Die Metadaten des Dienstes sprechen von drei Zonen zu 3, 2 und 1 Euro je
Stunde. Der **Feed selbst** trägt 4,00 / 3,50 / 3,00 / 2,00 € — die Sätze, die
seit dem **1. Juli 2026** gelten, angehoben um je 50 Cent mit Verweis auf die
Inflation. Wer den Tarif aus dem Metadatentext liest statt aus dem Feature,
liefert falsche Preise aus. Ein Test hält die vier Sätze fest, damit die
nächste Anhebung auffällt.

### Was nicht mitkommt

**`de.hh.up:parkraum`, 203.283 Polygone** — je Stellplatz eines. Hamburgs
Gegenstück zu Berlins Straßenabschnitten, und es beantwortet eine andere Frage
als diese App: Die Attribute sind Ausrichtung zur Straße, Markierung,
Fahrzeugtyp und Straßenname. Ein Tarif steht nicht darin, und
`geltungszeit_primaerer_bewirtschaftung` war in der Stichprobe leer. Für
„kostet das hier gerade etwas" trägt die Ebene nichts bei, was die 146 Gebiete
nicht schon sagen.

**POI und Umweltzone.** Ladepunkte, P+R, Behindertenparkplätze und Carsharing
liegen in Hamburg in anderen Diensten mit anderen Feldern; sie fehlen, statt
halb dazusein. Eine Umweltzone hat Hamburg nicht — es gibt
Durchfahrtsbeschränkungen für Diesel auf zwei Straßenabschnitten, und das ist
etwas anderes. `meta.json` trägt die Lücken als `absent`, damit die Oberfläche
„gibt es hier nicht" von „noch nicht geladen" unterscheiden kann.

**Der Bezirk.** Der Feed nennt zu einem Gebiet keinen Stadtteil, nur einen
Namen wie „N 101 Flughafenstraße". Der Datenbau ordnet ihn über den
Mittelpunkt gegen die **unvereinfachten** Stadtteilgrenzen zu — vereinfachte
wandern um Dutzende Meter, und ein Gebiet an der Grenze bekäme den Nachbarn
zugeschrieben. 145 von 145 treffen.

## Was am Code dafür zu tun ist

Der Stand heute, aus [oeffentlich-machen.md](oeffentlich-machen.md):

| Baustein | Berlin-spezifisch? |
| --- | --- |
| Tarif- und Zeitlogik (`core/tariff`) | nein |
| Heatmap-Raster | nein — metrisch, fester Ursprung |
| Ruhetags-Hinweis | nein — leitet Tage und Stunden aus den Daten ab |
| Fahrplan-Parser | nein, aber auf die Schreibweisen dieses Feeds trainiert |
| Feiertagskalender (`core/holidays`) | **ja** — enthält den 8. März |
| Datenquelle (`ingest/sources`) | **ja** |
| Kartenausschnitt und Grenzprüfung | **ja** |

Drei Aufgaben waren das. Zwei sind erledigt:

1. ~~**Feiertage je Bundesland.**~~ Erledigt. `holidaysFor(land, jahr)` in
   `core/holidays`; belegt sind BE (8. März, seit 2019) und HH
   (Reformationstag, seit 2018). Ein Land ohne hinterlegte Tabelle **wirft**,
   statt eine leere Menge zu liefern — sonst forderte die App an Karfreitag
   zum Zahlen auf, und nichts daran sähe nach einem Fehler aus. Die zwölf
   übrigen Länder fehlen bewusst: Sie gehören nur mit Beleg hinein, und die
   amtlichen Seiten sind aus dieser Umgebung gesperrt.
   Zwei Fallstricke stehen im Quelltext, weil sie sonst untergehen: Mariä
   Himmelfahrt (BY) und Fronleichnam (SN, TH) gelten **gemeindeweise** — eine
   Tabelle je Land kann sie gar nicht ausdrücken, für München gehören sie an
   die Stadt. Und Buß- und Bettag ist beweglich, aber nicht österlich.
2. ~~**Stadt als Konfiguration** statt als Konstante.~~ Erledigt.
   `core/city.ts` trägt Mittelpunkt, Zoom, Meldegrenze, Sitzungsgrenze,
   Bundesland und Quellenangabe je Stadt; `ingest/sources` ist nach Stadt
   gegliedert. Berlin stand vorher an **sechs** Stellen als Zahlenpaar im
   Code, nicht an dreien wie hier behauptet — die sechste saß im
   Telegram-Parser, und eine abweichende Grenze dort heißt: Der Bot nimmt an,
   was die App verwirft.
3. ~~**Der Parser muss unbekannte Schreibweisen abweisen können**, ohne den
   Build einer anderen Stadt mitzureißen.~~ Erledigt, und die Antwort war
   nicht ein toleranterer Parser, sondern **zwei getrennte**:
   `parse-schedule.ts`/`parse-fee.ts` lesen Berlin, `hamburg.ts` liest Hamburg.
   Ein gemeinsamer Parser müsste beide Grammatiken kennen und wäre bei jeder
   Änderung an einer Stadt für die andere gefährlich. Beide weisen ab, was sie
   nicht kennen, und ein Fehler bricht den *Datenbau* der eigenen Stadt ab —
   die andere baut weiter.

Und die zweite Stadt selbst ist angeschlossen: Zonendaten liegen je Stadt unter
`apps/web/public/data/<stadt>/`, der Browser holt sie zur Laufzeit, und in den
Einstellungen lässt sich wechseln — eine Stadt zur Zeit, wie bei FreiFahren.

Was noch offen ist: ein Standort-Vorschlag beim ersten Öffnen („Du scheinst
in Hamburg zu sein — wechseln?"), wie FreiFahren ihn als `cityLocationPrompt`
hat. Bei zwei Städten reicht der Umschalter; ab der dritten nicht mehr.

## Prüfliste je Stadt

Vor jeder Umsetzung, in dieser Reihenfolge — der erste Fehlschlag beendet die
Prüfung:

- [ ] Gibt es einen Datensatz mit **Geometrie** der bewirtschafteten Bereiche?
- [ ] Ist die **Lizenz** eine offene (DL-DE/Zero, CC-BY, ODbL)? Ohne Lizenz kein Projekt.
- [ ] Ist er **maschinell abrufbar** (WFS, GeoJSON, Shapefile) statt nur als PDF-Karte?
- [ ] Steht der **Tarif** darin — oder wenigstens in einem verknüpfbaren zweiten Datensatz?
- [ ] Stehen die **Zeiten** darin, und in welcher Schreibweise?
- [ ] Wie oft wird **aktualisiert**? Ein Datensatz von 2019 nennt falsche Preise.
- [ ] Gibt es einen **Ansprechpartner** für Rückfragen zu Auffälligkeiten?

Stand für Hamburg, nach dem Abschnitt oben — alles abgerufen, nicht abgeschrieben:

- [x] Geometrie — 146 Bewohnerparkgebiete, dazu 104 Stadtteile als Kontext.
- [x] Lizenz — DL-DE/Namensnennung 2.0, offen, aber mit Pflicht zur Nennung.
- [x] Maschinell abrufbar — WFS mit `application/geo+json`.
- [x] Tarif — je Gebiet in `gebuehrenzone`, als „3,50 € je Stunde".
- [x] Zeiten — je Gebiet in `bewirtschaftungszeit`, zehn Schreibweisen, alle
      auf einem Muster: Tagesangabe, Stundenspanne, „Uhr".
- [x] Aktualisierung — bei Änderung der Gebiete. Die *Beschreibung* des
      Dienstes hinkt hinterher und nennt veraltete Preise, siehe oben.
- [ ] Ansprechpartner — nicht ermittelt. Der einzige offene Punkt.

Hamburg fällt an keiner Stelle durch und ist angeschlossen.

Zu jeder Stadt, die durchfällt, gehört ein Eintrag in
[data-sources.md](data-sources.md) — Negativbefunde sind Arbeitsergebnisse und
verhindern, dass jemand dieselbe Suche ein zweites Mal macht.
