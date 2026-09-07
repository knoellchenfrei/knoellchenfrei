# Weitere Städte: was dafür an Daten da sein muss

> **Stand 7. September 2026:** Angeschlossen sind **vier** Städte — Berlin,
> Hamburg, Frankfurt am Main und München. Dieses Dokument hieß einmal „Zweite
> Stadt"; die Frage, die es beantwortet, ist dieselbe geblieben.

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

## Zwei Stufen: Meldestadt und Zonenstadt

**Stand 7. September 2026: eine Richtung, keine Entscheidung.** Der Abschnitt
steht hier, damit die nächste Sitzung ihn nicht neu herleitet. Was er
vorschlägt, ist an keiner Stelle umgesetzt.

Die Idee ist, eine Stadt nicht mehr an ihrem Feed festzumachen. Wo
bewirtschaftet wird, sollen Leute Kontrolleure melden können — auch ohne Zonen,
Tarife und Automaten. Die Aufnahme einer Stadt wäre dann ein Rollout und kein
Projekt; das Fernziel wäre bundesweite Abdeckung.

**Warum das mehr ist als „noch eine Stadt".** Heute ist eine Stadt *definiert*
durch ihren Feed: eigener Parser, eigener Datenbau, geprüfte Lizenz,
Feiertagskalender. Frankfurt und München haben je einen halben Tag gekostet.
Die Recherche in
[staedte-recherche-2026-09.md](staedte-recherche-2026-09.md) zeigt, warum das
nicht skaliert: Von 24 geprüften Städten hatten **acht Großstädte gar keinen
Parkdatensatz** (Stuttgart, Leipzig, Bremen, Hannover, Nürnberg, Münster,
Potsdam, Freiburg), und mehrere weitere einen unbrauchbaren — Kölns
Gebührenfeld ist zwei Erhöhungen alt. Bundesweit wäre der Feed die Ausnahme,
nicht die Regel.

### Die Trennung, um die es geht

| | Braucht | Kann |
| --- | --- | --- |
| **Stufe 1 — Meldestadt** | Name, Kfz-Kürzel, Bundesland (für die Feiertage), eine Grenze | Meldungen, Heatmap, Telegram, Karte — **vollständig** |
| **Stufe 2 — Zonenstadt** | zusätzlich Feed, Parser, Datenbau, Lizenzprüfung | zusätzlich Zonen, Tarife, Zeiten, Automaten |

Stufe 1 ist deshalb möglich, weil der Worker die Stadt **ohnehin schon aus der
Position ableitet** und nicht aus einer Konfiguration: `cityAt(lon, lat)` in
`core/city.ts` sucht die erste Stadt, deren Rahmen den Punkt enthält. Eine
Stadt ohne Feed wäre für den Meldeweg kein Sonderfall.

Die Oberfläche kann es halb schon: `meta.json` trägt `absent`, und die App
blendet aus, was eine Stadt nicht hat — Hamburg listet dort `poi`,
`umweltzone`, `segments`, München `fee`. Eine Stufe-1-Stadt wäre der Grenzfall
davon: alles abwesend außer den Meldungen.

### Was zu klären ist, bevor Code entsteht

Fünf Fragen. Keine davon ist beantwortet, und die ersten beiden sind die, an
denen es hängt.

1. **Woher die Grenzen kommen.** Vier Rahmen von Hand zu pflegen geht,
   vierhundert nicht. Das müsste ein **erzeugter** Datensatz werden — amtliche
   Gemeindegrenzen (Destatis, GADM) oder OSM-Relationen. Damit bekäme die Regel
   „Stadtgrenzen stehen genau einmal, in `core/city.ts`" eine andere Form: Sie
   stünden weiter genau einmal, aber als Erzeugnis mit einem Bauskript davor,
   nicht als getippte Zahlen. Die Regel selbst bleibt — sie hat einen Vorfall
   hinter sich.
2. **Die Meldegrenze.** `cityAt` nimmt die **erste passende** Stadt, und ein
   Test hält fest, dass sich die vier Rahmen nicht überlappen. Bei
   vierhundert Städten ist beides nicht mehr haltbar: Rechteckige Rahmen
   überlappen zwangsläufig, und „die erste" wäre dann Zufall. Es bräuchte
   echte Polygone und eine Punkt-in-Polygon-Suche — `polygonContains` in
   `core/geo.ts` gibt es schon, die Frage ist der Index davor.
3. **Feiertage.** `holidaysFor` deckt heute vier Bundesländer ab
   (`Land = 'BE' | 'HH' | 'HE' | 'BY'`). Bundesweit heißt: alle sechzehn, jedes
   mit Beleg. Und Mariä Himmelfahrt gilt in Bayern **gemeindeweise** — genau
   das hat bei München `City.holidays` erzwungen. Ein `Record<Land, …>` reicht
   dafür nicht, und das gilt bundesweit erst recht.
4. **Woher „hier wird bewirtschaftet" kommt.** Ohne Feed weiß die App es nicht.
   Entweder eine gepflegte Liste — dann ist sie die neue Handarbeit —, oder man
   lässt es offen und meldet trotzdem. Im zweiten Fall darf die App aber
   **nicht behaupten, es koste etwas**. Das ist dieselbe Linie wie bei
   `CostEstimate.priced`: Kein Betrag ist nicht null Euro.
5. **Was die Datenschutzerklärung sagt.** Rechtlich ändert sich nichts — es
   werden keine anderen Daten verarbeitet. Aber `docs/datenschutz.md` nennt
   heute vier Städte namentlich; das müsste eine Regel werden statt einer
   Aufzählung.

### Was dafür spricht, es trotzdem zu tun

Der Meldeweg ist der Teil, der ohne Behörde auskommt — und der, für den
FreiFahren das Vorbild ist. Eine Stadt, in der man melden kann, ist mehr wert
als eine, in der nichts steht, weil die Stadt keinen Feed veröffentlicht.

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
| **München** | 82 Parkraummanagementgebiete und 13.714 Straßenseiten als WFS | **nirgends** — nur in der Gebührenordnung | je Straßenseite, als Fließtext, 291 Schreibweisen | DL-DE/**Namensnennung** 2.0 | **geprüft** |
| **Frankfurt / Rhein-Main** | Regionalverband stellt Karten und Geodaten als WFS bereit | offen | offen | als Open Data ausgewiesen | **Hinweis** |
| **Stuttgart** | Geoportal mit ausgewiesenen Open-Data-Beständen | offen | offen | ausgewiesen | **Hinweis** |
| **Leipzig, Dresden** | eigene Open-Data-Portale vorhanden | offen | offen | offen | **Hinweis** |
| **Köln** | Portal vorhanden, Parkdatensatz nicht nachgewiesen | offen | offen | offen | **Hinweis** |
| **alle übrigen** | über OSM, soweit die Community die Straßen erfasst hat | praktisch nie | teilweise | ODbL | **Weg B** |

Nüchtern gelesen heißt die Tabelle: **Hamburg und München sind die einzigen
beiden Kandidaten, für die ein konkreter Datensatz benannt ist.** Alles
darunter ist ein Portal, in dem noch niemand nachgesehen hat. (Frankfurt hat
sich seitdem als vierter Eintrag mit benanntem Datensatz erwiesen; die
Rangliste stammt vom 6. September 2026 und ist von der ausführlichen Recherche
in [staedte-recherche-2026-09.md](staedte-recherche-2026-09.md) überholt.)

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

## Frankfurt am Main im Einzelnen

Abgerufen und Feld für Feld angesehen am 7. September 2026 — Stufe **geprüft**.
Angeschlossen seither auch: `core/frankfurt.ts` liest den Feed,
`ingest/build-data-frankfurt.ts` baut ihn.

| | |
| --- | --- |
| **Bewohnerparken** | `https://geowebdienste.frankfurt.de/Parken`, Typname `opendata:Bewohnerparken`, **42** Polygone |
| **Parkscheinautomaten** | derselbe Dienst, `opendata:Parkscheinautomaten`, **921** Punkte |
| **Behindertenparkplätze** | derselbe Dienst, `opendata:Behindertenparkplaetze`, **458** Punkte |
| **Stadtteile** | `https://geowebdienste.frankfurt.de/WFS_Stadtgebietsgliederung`, Typname `Stadtgebietsgliederung:Stadtteile`, **46** |
| Ausgabeformat | `application/json` im Parken-Dienst (GeoServer), `GEOJSON` im Stadtteil-Dienst (MapServer). **Nicht** `application/geo+json` wie Hamburg — darauf antwortet der Parken-Dienst mit `ows:ExceptionReport` |
| Achsenreihenfolge | `[lon, lat]`, wie Berlin und anders als Hamburg |
| Herausgeber | Stadt Frankfurt am Main |
| Lizenz | Datenlizenz Deutschland **Namensnennung** 2.0, Quellenvermerk wörtlich `Stadt Frankfurt am Main, www.frankfurt.de` |
| Ansprechpartner | Straßenverkehrsamt, `SVA.GDI@stadt-frankfurt.de` |

### Die Eigenheit, die alles bestimmt

**Die Sachdaten hängen nicht am Polygon.** Ein Bewohnerparkbereich sieht so
aus:

```json
{ "name": null, "description": null, "nummer": 0,
  "vti_url": "<a href=\"/wir-fuer-sie/bewohnerparken/regelungsbereich-0\" …>weitere Informationen</a>",
  "mitparkraumbewirtschaftung": null }
```

Kein Tarif, keine Zeit, keine Höchstparkdauer, nicht einmal ein Name — `name`
und `description` sind in **allen 42** Bereichen `null`. Das alles steht an den
Parkscheinautomaten:

```json
{ "bewohnerparkzone": null, "strassenname": "Alte Mainzer Gasse 4",
  "maximal_parkdauer": "1 h", "gebuehrenzone": "4 €/h",
  "gebuehrenzeit": "Mo-Sa 9-20" }
```

Was für einen Bereich gilt, entsteht also erst durch Zusammenlegen der
Automaten darin. Genau daran hängen die drei Entscheidungen unten.

### Entscheidung 1: Zuordnung über die Geometrie, nicht über das Attribut

Der Feed bietet beides an — `bewohnerparkzone` am Automaten zeigt auf `nummer`
am Bereich. Ausgezählt am Abzug vom 7. September 2026:

| | über `bewohnerparkzone` | über Punkt-in-Polygon |
| --- | --- | --- |
| zugeordnete Automaten | 503 von 921 | **808** von 921 |
| erreichte Bereiche | 21 von 42 | **27** von 42 |
| Automaten, die auf einen Bereich zeigen, in dem sie nicht stehen | 2 | — |

Dazu **13** Automaten, bei denen beide Wege etwas liefern und sich
widersprechen (fünfmal Attribut 20 gegen Polygon 19, dreimal 7 gegen 9, …).
Die 21 über das Attribut erreichten Bereiche sind eine *echte Teilmenge* der
27 geometrischen: Das Attribut findet nichts, was der Punkt nicht auch findet,
und lässt 305 Automaten und sechs Bereiche liegen.

Der Grund dahinter ist inhaltlich, nicht technisch: `bewohnerparkzone` sagt, zu
welchem **Bewohnerparkausweis** ein Automat gehört, nicht, wo er steht. Die
Frage dieser App ist „was gilt an der Stelle, an der ich stehe" — und die
beantwortet der Punkt. Die 42 Polygone überlappen sich nicht; kein Automat
fällt in zwei Bereiche.

### Entscheidung 2: ausgelassen wird nach Daten, nicht nach dem Flag

15 der 42 Bereiche enthalten keinen einzigen Automaten und werden ausgelassen —
dasselbe Kriterium wie Hamburgs „ohne Zeitangabe": Ein Polygon ohne Antwort ist
schlechter als kein Polygon, weil es aussieht wie eine bewirtschaftete Fläche
und über sie nichts weiß.

Naheliegend wäre `mitparkraumbewirtschaftung` gewesen — Frankfurts Gegenstück
zu Hamburgs `geplant_aktiv`. Nachgemessen decken sich die beiden **nicht**:

| | Bereiche | davon mit Automaten |
| --- | --- | --- |
| `mitparkraumbewirtschaftung = 1` | 11 | **11** |
| `mitparkraumbewirtschaftung = null` | 31 | **16** |

Alle geflaggten Bereiche haben Automaten — aber 16 weitere haben ebenfalls
welche, zusammen 245 Stück. Wer dem Flag folgte, würfe sie weg und behauptete
damit, dort werde nicht bewirtschaftet, während dort Automaten stehen. Das
Flag ist also nicht „wird bewirtschaftet". Was es ist, weiß nur die Stadt; die
Rückfrage steht in [todo.md](todo.md).

### Entscheidung 3: die Höchstparkdauer ist keine Gebietsregel

`maximal_parkdauer` steht je Automat, und in 19 der 27 übernommenen Bereiche
stehen mehrere Werte nebeneinander — oft `1 h` neben `-`, also neben „keine".
`maxStayMinutes` bleibt für Frankfurt deshalb **null**; die App geht den Weg,
den Berlin schon geht: Wert, Anteil und alle Ausprägungen. Sie als Gebietsregel
auszugeben wäre genau der Fehler, der in Berlin schon einmal passiert ist.

Ein Nebenbefund: `-` heißt „keine", nicht null Minuten. 579 der 921 Automaten
tragen den Strich.

### Die Werte im Einzelnen

| Feld | Werte |
| --- | --- |
| `gebuehrenzone` | `2 €/h` (699), `4 €/h` (221), leer (1) |
| `gebuehrenzeit` | **30** Schreibweisen, alle auf einem Muster: Tagesangabe, Stundenspanne ohne Minuten, optional eine zweite Klausel. Häufigste: `Mo-Fr 7-19` (351), `Mo-Fr 7-22` (206), `Mo-Sa 9-20` (105). Sonderfälle: `Mo-Fr 8-18 Sa 8-14`, `Tgl. 9-18`, `Mo-So 0-24`, und **einmal** `Mo-Fr 9-17, Sa 9-14` mit Komma statt Leerzeichen |
| `maximal_parkdauer` | `-` (579), `1 h` (242), `2 h` (74), `3 h` (22), `4 h`/`5 h` (je 2) |
| `bewohnerparkzone` | 21 verschiedene Nummern **als Zahl**, 418-mal `null` |

Zwei Bereiche (15 und 18) tragen beide Tarife nebeneinander. Sie bekommen
`Fee.range`, wie Berlins Zonen 41–43 — auf einen Wert zu reduzieren
verschätzte jemanden dort um 100 %.

### Die Falle, die keine Fehlermeldung gibt

**Ohne `srsName` antwortet der Dienst stillschweigend in EPSG:25832.**
Dieselbe Anfrage liefert dann `[477189.85, 5550859.91]` — plausible Zahlen, nur
keine Grade. `wfsUrl` setzt den Parameter für alle Städte; `assertDegrees` im
Datenbau prüft die Antwort trotzdem noch einmal, weil ein Wegfall auf der Karte
nur nach „leer" aussähe und nicht nach kaputt.

### Die Stadtteile: gesucht und gefunden

Der Parken-Dienst führt **keine** Verwaltungsgrenzen; sein `GetCapabilities`
kennt genau die drei Typnamen oben. Gesucht wurde dann so:

| Versuch | Antwort |
| --- | --- |
| `https://geowebdienste.frankfurt.de/Parken?…GetCapabilities` | 200, drei Typnamen, keine Grenzen |
| `…/Stadtteile`, `…/Verwaltungsgrenzen`, `…/Ortsbezirke`, `…/Stadtgrenze`, `…/Grenzen`, `…/opendata`, `…/geoserver/ows` als WFS-Endpunkte geraten | je **404** |
| `https://geowebdienste.frankfurt.de/` | 302 auf `https://geoportal.frankfurt.de/info/` |
| von dort `https://geodatenkatalog.frankfurt.de/` (GeoNetwork) | 200; die Suche nach „Stadtteil OR Ortsbezirk OR Stadtbezirk" liefert 31 Treffer |
| daraus `https://geowebdienste.frankfurt.de/WFS_Stadtgebietsgliederung` | 200, acht Ebenen, darunter `Stadtgebietsgliederung:Stadtteile` mit 46 Features |

Der ISO-Metadatensatz dieser Ebene nennt dieselbe Lizenz und denselben
Quellenvermerk wie der Parken-Dienst; Zugang „Öffentlicher Zugang nicht
beschränkt", fachlich zuständig `rbs.statistik@stadt-frankfurt.de`. Sie ist
damit brauchbar, und `district = 'Frankfurt am Main'` als Rückfall war nicht
nötig: **27 von 27** Bereichen treffen einen Stadtteil.

Der Dienst läuft auf MapServer und will das Ausgabeformat `GEOJSON` — sein
`GetCapabilities` listet weder `application/json` noch `application/geo+json`.
`DefaultCRS` ist EPSG:25832; mit `srsName=urn:ogc:def:crs:EPSG::4326` kommen
Grade in `[lon, lat]`.

### Was mitkommt und was nicht

**Die 458 Behindertenparkplätze kommen mit**, im selben POI-Schema wie Berlins
(`kind: 'accessible'`, Beschriftung, Anzahl und Öffnungszeiten). Keine Änderung
an der Oberfläche nötig.

**Die 113 Automaten ohne Bereich kommen nicht mit.** Sie stehen in
bewirtschafteten Straßen ohne Bewohnerparkbereich; für sie gibt es kein
Polygon, und die Zonenabfrage deckt sie nicht ab. Das POI-Schema kennt vier
Arten — `charging`, `carsharing`, `park_and_ride`, `accessible` — und keine
passt; sie als eine davon auszugeben hieße, ein Symbol zu setzen, das etwas
anderes behauptet. Eine fünfte Art wäre ein Umbau von Karte, Legende und
Filtern. Der offene Punkt steht in [todo.md](todo.md).

Zum Vergleich: Über das Attribut wären es **418** Automaten ohne Bereich
gewesen. Die geometrische Zuordnung schrumpft die Lücke auf 113, also von 45 %
auf 12 %.

**Keine Stellplatzzahlen** — der Feed zählt keine Plätze, `spaces` bleibt null.

**Keine Umweltzonen-Geometrie.** Frankfurt *hat* seit 2008 eine Umweltzone;
dieser Dienst führt sie nur nicht. `absent: ["umweltzone", "segments"]` in
`meta.json` heißt hier ausdrücklich **„nicht in diesem Abzug"**, nicht „gibt es
nicht" — anders als bei Hamburg, wo es beides zugleich heißt.

### Feiertage: Hessen

Zehn gesetzliche: die neun bundesweiten plus **Fronleichnam** (Ostersonntag +
60). Kein Reformationstag, kein Allerheiligen, kein Buß- und Bettag, keine
gemeindeweise Regelung. Quelle: Hessisches Ministerium des Innern,
<https://innen.hessen.de/buerger-staat/feiertage>, abgerufen am 7. September
2026.

Das war der Anlass für eine Strukturänderung in `core/holidays.ts`: Fronleichnam
ist beweglich **und** nicht bundesweit, und die alte Tabelle konnte nur das eine
oder das andere. `REGIONAL` trägt seitdem je Land zwei Listen — feste Daten und
Oster-Abstände. Berlin und Hamburg bekommen dadurch nichts dazu; Tests halten
das fest.

## München im Einzelnen

Abgerufen und Feld für Feld angesehen am 7. September 2026 — Stufe **geprüft**,
angeschlossen als **vierte Stadt**.

| | |
| --- | --- |
| **Dienst** | `https://geoportal.muenchen.de/geoserver/mor_wfs/ows`, WFS 2.0.0, GeoServer |
| **Typnamen** | `mor_wfs:ruhver_prm_gebiete_poly` (82 Gebiete), `mor_wfs:ruhver_parkseiten_line` (13.714 Straßenseiten) |
| **Verwaltungsgrenzen** | `gsm_wfs:vablock_stadtbezirk` (25 Bezirke, 27 Polygone) — anderer Arbeitsbereich, gleicher Server |
| **Ausgabeformat** | `application/json` |
| **Achsenreihenfolge** | `[lon, lat]` wie Berlin und Frankfurt |
| **`DefaultCRS`** | EPSG:25832 — `srsName` ist Pflicht |
| **Lizenz** | DL-DE/Namensnennung 2.0, je Ebene aus dem ISO-Metadatensatz geprüft |
| **Ansprechpartner** | MOR-GB1, `gb1-23.mor@muenchen.de` |

### Die Eigenheit, die alles bestimmt: die Regel ist ein Satz

Berlin, Hamburg und Frankfurt legen je Aussage ein Feld an. München legt einen
Satz an:

```
Absolutes Halteverbot 6:30-8:30 Uhr und 16-19 Uhr,
Eingeschränktes Halteverbot 8:30-16 Uhr, Mischparken 19-23 Uhr
```

Das ist **ein** Wert von `parkregel_beschreibung`. Es gibt **291** verschiedene;
zum Vergleich: Berlin 18, Hamburg 10, Frankfurt 30. Sie sind zusammengesetzt aus
Klauseln, die Regelart, Höchstparkdauer, ein bis vier Zeitspannen und eine
Tagesangabe in beliebiger Kombination tragen. Ein regulärer Ausdruck bekommt das
nicht; `core/muenchen.ts` ist deshalb eine kleine Grammatik.

Getrennt wird **an den Regelphrasen, nicht am Komma**. Das Komma taugt nicht als
Trenner: In `8-14 Uhr Montag, Dienstag, Donnerstag, Hauptbahnhoftarif
Kurzzeitparken 2h` trennt es dreimal eine Wochentagsliste und einmal zwei
Regeln.

### Entscheidung 1: ohne Tagesangabe gilt Montag bis Samstag

Die folgenreichste Festlegung. 3.909 der 13.714 Abschnitte tragen schlicht
`Mischparken 9-23 Uhr`, ohne ein Wort über Wochentage. Alle sieben Tage
anzunehmen hieße, in ganz München sonntags Gebühren zu verlangen.

Montag bis Samstag steht dort nicht als Ortskenntnis, sondern als Befund aus dem
Feed selbst, ausgezählt über alle 291 Texte:

- Wo Tage genannt werden, hängt die gewöhnliche Neun-bis-dreiundzwanzig an
  Montag bis Freitag **und an Samstag** (`Mischparken 18-23 Uhr Montag bis
  Freitag und 9-23 Uhr Samstag`, 85-mal allein in dieser Form).
- **Sonntag steht in genau vier Texten**, und dort ausgeschrieben: `Montag bis
  Sonntag` (Blaue Zone Messestadt Riem), `Samstag bis Sonntag`, `(Fr-So)`,
  `Samstag und Sonntag`. Der Feed *kann* Sonntag sagen und tut es, wo er ihn
  meint.
- `werktags` heißt Montag bis Samstag, nicht Montag bis Freitag — der Feed
  schreibt an 27 Stellen `werktags Montag bis Freitag`, und die Einengung wäre
  überflüssig, wenn `werktags` schon Montag bis Freitag hieße.

Ein Test hält fest, dass ein Sonntagsfenster nur dort entsteht, wo der Text den
Sonntag auch nennt. Im ausgelieferten Abzug ist das genau **ein** Gebiet:
Messestadt.

### Entscheidung 2: `sonst Mischparken` bekommt kein Fenster

25 Abschnitte lauten `Eingeschränktes Halteverbot 7-20 Uhr, sonst Mischparken`.
Naheliegend wäre, `sonst` als Komplement der vorher genannten Zeiten zu lesen —
und es wäre falsch: Das Komplement hieße „gebührenpflichtig von 20 bis 7 Uhr und
den ganzen Sonntag". Gemeint ist „außerhalb des Halteverbots gilt die
gewöhnliche Mischparken-Regelung des Gebiets", also 9–23 Uhr. Die Quelle sagt
*welche* Regel gilt, nicht *wann*.

Solche Klauseln bekommen deshalb `timing: 'otherwise'` und keine Fenster. Das
kostet nichts: Jedes der 82 Gebiete trägt seine gewöhnlichen Zeiten aus
Abschnitten, die sie ausschreiben — keines bleibt ohne Fenster.

### Entscheidung 3: Zuordnung über das Attribut, nicht über die Geometrie

Das **Gegenteil** von Frankfurt, und nachgemessen am Abzug vom 7. September:

| | über `prm_name` | über Punkt-in-Polygon |
| --- | --- | --- |
| zugeordnete Abschnitte | **12.365** von 13.714 | 12.364 |
| erreichte Gebiete | 82 von 82 | 82 von 82 |
| Abschnitte, die der andere Weg nicht findet | 43 | 0 |

Beide Wege sind sich 12.363-mal einig und **einmal** uneins. Die Geometrie
findet nichts, was das Attribut nicht auch findet, und verliert 43 Abschnitte,
deren Linienmitte knapp neben dem Polygon liegt — bei einer Straße *auf* der
Gebietsgrenze ist das der Normalfall.

Der Unterschied zu Frankfurt ist kein Widerspruch, sondern eine andere Bedeutung
desselben Feldtyps: Frankfurts `bewohnerparkzone` sagt, zu welchem **Ausweis**
ein Automat gehört, nicht wo er steht. Münchens `prm_name` sagt, in welchem
Gebiet die Straßenseite **liegt**. Der Datenbau rechnet die Geometrie trotzdem
als Gegenprobe und schreibt die Zahlen ins Log.

1.307 Abschnitte tragen gar keinen Gebietsnamen — sie liegen außerhalb der 82
Gebiete. 42 weitere nennen einen Namen, zu dem es kein Polygon gibt:
`Milbertshofen` (25), `Riesenfeld` (15), `Carsharing auf Privatdrund` (1, Tippfehler
der Quelle) und `E-LIS privat` (1). Die ersten beiden sind vermutlich Gebiete in
Vorbereitung; eine Rückfrage dazu steht in [todo.md](todo.md).

### Entscheidung 4: sieben von achtzehn Regelgruppen zählen

`parkregel_gruppe` ist die Antwort der Stadt darauf, was ein Abschnitt
hauptsächlich ist. Aufgenommen werden sieben Gruppen mit zusammen **8.458**
Abschnitten:

| Gruppe | Abschnitte |
| --- | --- |
| Mischparken | 4.351 |
| Bewohnerparken | 1.968 |
| Mischparken mit Parkscheibe | 887 |
| Eingeschränktes Halteverbot temporär | 430 |
| Kurzzeitparken | 378 |
| Altstadt und HBF | 274 |
| Absolutes Halteverbot temporär | 170 |

Ausgelassen sind **5.255**: `Absolutes Halteverbot (0-24 Uhr)` (1.916),
`E-Parken` (1.171), `Carsharing` (901), `Behindertenparken` (825),
`Eingeschränktes Halteverbot (0-24 Uhr)` (188), `Taxi` (149), `keine Regelung
0 - 24 Uhr` (85), `Baustelle` (10), `Busparken` (8) und
`Kraftfahrzeugparken allgemein` (2). Wer sie mitnähme, baute eine
Halteverbotskarte.

Der teuerste Einzelfall dabei kommt 1.171-mal vor:

```
E-Ladeinfrastruktur AC (Normalladen 22kW) nur E-Fahrzeuge
im Ladezustand 8-20 Uhr 4h mit Parkscheibe
```

Das schließende „mit Parkscheibe" ist grammatisch eine Parkscheiben-Klausel —
und der Abschnitt ist trotzdem ein Ladeplatz. Ohne die Gruppenliste zählte er
bei den Stellplätzen mit, stünde unter „Zeiten laut Quelle" ganz oben und
verdürbe den Anteil der Höchstparkdauer.

Die **Fenster** eines Gebiets entstehen dagegen aus *allen* Abschnitten:
`Behindertenparkplatz 8-18 Uhr Montag bis Freitag, Mischparken 18-23 Uhr` sagt
wahr, dass dort abends Gebühren fällig sind. Die Gruppenliste entscheidet, was
*gezählt* wird, nicht was *gilt*.

### Entscheidung 5: kein Betrag, und keiner erfunden

In keinem der 291 Regeltexte steht `€`, `Euro` oder `EUR`. Der Tarif — 2 € je
Stunde im Parklizenzgebiet, Altstadt- und Hauptbahnhoftarif abweichend — steht
ausschließlich in der Gebührenordnung, und die ist eine PDF-Auskunft, keine
Datenquelle. Alle 82 Gebiete bekommen deshalb `Fee = { kind: 'unknown' }`, und
das Panel sagt „Die Quelle nennt für dieses Gebiet keinen Tarif."

`Fee.unknown` gab es schon für Hamburgs Parkscheibengebiete; München ist die
erste Stadt, in der es für **jedes** Gebiet gilt. Ein E2E-Test hält fest, dass
im Panel `Tarif nicht angegeben` steht und nirgends `0,00 €`.

### Was das Modell nicht ausdrücken kann

Drei Sorten landen in `unmodelledRules` und damit als Hinweis ins Panel:

- **`an Schultagen` / `an nicht Schultagen`** — 15 Abschnitte in 10 Gebieten.
  Ein Schulkalender ist keine Feiertagstabelle; er ist je Land und Jahr anders
  und steht nirgends in dieser Quelle.
- **`(zeitliche Einschränkung unbekannt)`** — die Quelle sagt selbst, dass sie
  die Zeit nicht kennt.
- **Zeitangaben ohne Anfang oder Ende** — `Mischparken mit Parkscheibe 3h bis
  19Uhr`, `Bewohner frei ab 18 Uhr`. Einen Anfang dazuzuerfinden wäre eine
  Lesart, die die Quelle nicht deckt.

Das hat einen **Fehler im Bestand** aufgedeckt: `isUncertainAt` in `tariff.ts`
fragte nur, ob `unmodelledRules` irgendetwas enthält, und die einzige
Zusatzregel bis dahin war Berlins „Advents-Sa". An einem Adventssamstag hätte
die App über jedem Münchner Gebiet mit Schultagsregel „unsicher" gezeigt — und
in der Erklärung den Adventssamstag genannt. Die Funktion filtert seitdem auf
Regeln, die Advent überhaupt erwähnen; der Satz im Panel nennt die Regel
wörtlich und verweist im Übrigen auf die Beschilderung.

### Die Werte im Einzelnen

**Gebiet** (`ruhver_prm_gebiete_poly`, 82 Zeilen):

| Feld | Werte |
| --- | --- |
| `name` | 82 verschiedene Namen, keine Nummern: `TU-Viertel`, `Glockenbachviertel`, `Südliche Au` |
| `status` | `in Betrieb` (82) — geplante und aufgehobene führt der Feed nicht |
| `massnahme` | `Lizenzgebiet in Betrieb` (77), `Parkraumbewirtschaftung` (3), `in Betrieb mit Altstadttarif` (2) |
| `ueberwachung` | `KVÜ` (68), `Polizei` (14) |
| `eroeffnung` | `TT.MM.JJJJ`, ältestes 01.01.2000 |
| `einzeluebersicht_link` | PDF bei muenchenunterwegs.de; in 3 von 82 leer |

**Straßenseite** (`ruhver_parkseiten_line`, 13.714 Zeilen):

| Feld | Werte |
| --- | --- |
| `angebot` | Stellplätze als **Zeichenkette** (`"5"`), 44-mal `null` |
| `parkregel_beschreibung` | 291 Schreibweisen, 1-mal `null` |
| `parkregel_gruppe` | 18 Gruppen, 1-mal `null` |
| `prm_name` | Gebietsname, 1.307-mal `null` |
| `strasse` | Straßenname, abgekürzt (`Falkenstr.`) |

Dass `angebot` eine Zeichenkette ist und keine Zahl, steht als Test gegen die
Fixture — nach dem Frankfurter Vorfall, bei dem ein Interface eine Zahl als
Zeichenkette behauptete und der Vergleich stillschweigend immer falsch war.

### Die Falle, die keine Fehlermeldung gibt

Dieselbe wie in Frankfurt: `DefaultCRS` ist EPSG:25832. Ohne `srsName` in der
Anfrage antwortet der Dienst in UTM-Metern — plausible Zahlen, nur keine Grade.
`wfsUrl` setzt den Parameter, und `assertDegrees` im Datenbau misst nach, statt
es zu glauben.

Zwei weitere, die diesmal dazukamen:

- Die Sammel-Adresse `/geoserver/ows` antwortet mit `ServiceUnavailable: Service
  WFS is disabled`. Jeder Arbeitsbereich muss einzeln angefragt werden
  (`/geoserver/mor_wfs/ows`, `/geoserver/gsm_wfs/ows`).
- Die Parkseiten sind 6,5 MB. Der 180-Sekunden-Zeitausschnitt in `fetch.ts`
  reicht; Paging über `count`/`startIndex` war nicht nötig.

### Die Stadtbezirke: gesucht und gefunden

Der Parken-Dienst führt keine Verwaltungsgrenzen — seine 68 Ebenen sind
Mobilität, keine Verwaltung. Gefunden wurden die Bezirke wie in Frankfurt über
den **Katalog**, nicht durch Raten von Adressen: Der offene Datenkatalog der
Stadt hat eine CKAN-Schnittstelle
(`https://opendata.muenchen.de/api/3/action/package_search?q=stadtbezirk`), und
der Datensatz „Stadtbezirke" nennt den WFS
`gsm_wfs:vablock_stadtbezirk` samt Lizenz und Quellenvermerk.

25 Bezirke in 27 Polygonen: Thalkirchen-Obersendling-Forstenried-Fürstenried-Solln
und Untergiesing-Harlaching sind je zweiteilig. Jedes der 82 Gebiete trifft einen
Bezirk; das Panel zeigt ihn über dem Gebietsnamen, damit „Südliche Au" verortet
ist.

Die Bezirke liefern auch die **Box**: 11,3565–11,7285 / 48,0568–48,2510, nach
außen gerundet. Aus der Parkebene genommen (11,4037–11,7108 / 48,0698–48,2264)
hätte sie Aubing, Lochhausen und Feldmoching aus der Meldegrenze geworfen — dort
wird nur nicht bewirtschaftet.

### Was mitkommt und was nicht

München ist die erste Stadt seit Berlin, die **alle vier POI-Arten** bedient,
ohne dass die Karte etwas Neues lernen müsste — 1.660 Punkte:

| Ebene | Punkte | Lizenzbeleg |
| --- | --- | --- |
| `behindertenparkplaetze` | 556 | Record `f784c10e-…`, DL-DE/BY-2.0 |
| `ruhver_carsharing` | 710 | Record `7a5ed64c-…`, DL-DE/BY-2.0 |
| `ruhver_els_standort_point` | 369 | Record `971c0d43-…`, DL-DE/BY-2.0 |
| `park_ride_standorte` | 25 | Record `a35c138d-…`, DL-DE/BY-2.0 |
| `miv_umweltzone_poly` | 12 Flächen | Record `45abe976-…`, DL-DE/BY-2.0 |

Jeder dieser Records wurde einzeln über den `MetadataURL` aus
`GetCapabilities` abgerufen und gelesen; ohne Beleg wäre keine Ebene
aufgenommen worden. Alle nennen denselben Quellenvermerk wie die beiden
Parkebenen. **Eine Abweichung:** Der Metadatensatz der *Stadtbezirke*
(`efd5be0b-…`) nennt statt `opendata.muenchen.de` den GeodatenService
(`Datenquelle: Landeshauptstadt München - GeodatenService,
https://www.muenchen.de/rathaus/Stadtverwaltung/Kommunalreferat/geodatenservice`).
`City.attribution` trägt einen Vermerk, und das ist der der Parkdaten; der
zweite steht hier, damit er nicht verlorengeht.

**Bewusst nicht abgerufen:** `ruhver_els_saeule_point` (592 Ladesäulen) neben
den 369 Standorten — dieselben Orte, nur feiner gezählt, und zwei Punkte
übereinander sind auf der Karte kein Gewinn. `ruhver_carsharing_station`
(197 stationsbasierte Plätze) neben den 710 allgemeinen aus demselben Grund.
Und die 40 übrigen Ebenen des Dienstes (Radwege, Ampeln, Baustellen,
Bushaltestellen) beantworten andere Fragen als „was kostet Parken hier".

**Die Umweltzone** kommt als **12 Polygone**, nicht als eines: die Zone selbst
und elf „Transferflächen" — Parkplätze am Rand, etwa die Olympiaparkharfe. Alle
kommen mit; sie gehören zur Regelung. München ist damit nach Berlin die zweite
Stadt mit Umweltzonen-Geometrie im Abzug.

**Stellplätze** gibt es: 95.903 in den 82 Gebieten, aus `angebot` summiert.
Das ist die erste Stellplatzzahl seit Berlin.

### Feiertage: Bayern, und der Feiertag, der an der Stadt hängt

Bayern hat **zwölf** landesweite gesetzliche Feiertage: die neun bundesweiten
plus Heilige Drei Könige, Fronleichnam und Allerheiligen. Wörtlich, Art. 1
Abs. 1 Nr. 1 des Bayerischen Feiertagsgesetzes (BayFTG,
<https://www.gesetze-bayern.de/Content/Document/BayFTG-1>, abgerufen am
7. September 2026).

Und dann Nummer 2: gesetzlicher Feiertag ist „in Gemeinden mit überwiegend
katholischer Bevölkerung Mariä Himmelfahrt". Absatz 3: „Das Landesamt für
Statistik stellt nach dem Ergebnis der letzten Volkszählung fest, in welchen
Gemeinden entweder mehr katholische oder mehr evangelische Einwohner ihren
Wohnsitz hatten." Absatz 2 gibt zusätzlich der Stadt Augsburg den 8. August
(Friedensfest).

Das passt in kein `Record<Land, …>`: In Bayern gilt der 15. August in 1.708 der
2.056 Gemeinden und in den übrigen 348 nicht. Eine Ländertabelle hätte
zwangsläufig für München oder für Nürnberg unrecht.

**Nachgeprüft, nicht angenommen.** Die Gemeindeabfrage des Bayerischen
Landesamts für Statistik
(<https://www.statistik.bayern.de/statistik/gebiet_bevoelkerung/zensus/himmelfahrt/>,
abgerufen am 7. September 2026) führt:

| Gemeinde | Schlüssel | Feiertag | katholisch | evangelisch |
| --- | --- | --- | --- | --- |
| München, Landeshauptstadt | 09162000 | **ja** | 402.058 | 147.912 |

Nürnberg steht in derselben Abfrage mit „nein". Der Eintrag gehört also an die
Stadt: `City` hat dafür ein optionales Feld `holidays` bekommen, und
`holidaysFor(land, jahr, extraFixed)` nimmt es entgegen. Für Berlin, Hamburg und
Frankfurt ändert sich nichts — Tests halten das fest, und ein Zusatzdatum, das
nicht die Form `MM-TT` hat, wirft, statt stillschweigend nichts zu bewirken.

## Was am Code dafür zu tun ist

Der Stand heute, aus [öffentlich-machen.md](öffentlich-machen.md):

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

Und die Städte selbst sind angeschlossen: Zonendaten liegen je Stadt unter
`apps/web/public/data/<stadt>/`, der Browser holt sie zur Laufzeit, und in den
Einstellungen lässt sich wechseln — eine Stadt zur Zeit, wie bei FreiFahren.

Frankfurt hat den drei Punkten oben nichts hinzugefügt, was Arbeit gewesen
wäre — bis auf **einen**: `holidays.ts` konnte landesbezogene *bewegliche*
Feiertage nicht ausdrücken. Fronleichnam ist beides zugleich. Die Tabelle trägt
seitdem je Land zwei Listen. Dieselbe Erweiterung brauchen Nordrhein-Westfalen
und Bayern auch, sie ist also nicht für Hessen allein gemacht.

München hat **zwei** Punkte hinzugefügt, und beide waren echte Lücken im
Modell, nicht Fleißarbeit:

4. **Ein Feiertag kann an der Stadt hängen, nicht am Land.** Mariä Himmelfahrt
   gilt in Bayern gemeindeweise; die Ländertabelle konnte das gar nicht
   ausdrücken. `City` trägt jetzt ein optionales `holidays`, `holidaysFor` und
   `isHoliday` nehmen es als dritten Parameter, `ParkingZone.extraHolidays`
   reicht es durch. Für BE, HH und HE ändert sich dadurch nichts. Dieselbe
   Erweiterung braucht Augsburg (Friedensfest) — sie ist also nicht für München
   allein gemacht.
5. **`unmodelledRules` war stillschweigend „Advent".** Der Fehler und seine
   Behebung stehen oben bei „Was das Modell nicht ausdrücken kann". Er wäre
   ohne eine vierte Stadt nicht aufgefallen, weil bis dahin jede Zusatzregel im
   Bestand wirklich eine Adventsregel war.

Was noch offen ist: ein Standort-Vorschlag beim ersten Öffnen („Du scheinst
in München zu sein — wechseln?"), wie FreiFahren ihn als `cityLocationPrompt`
hat. Bei zwei Städten reichte der Umschalter; seit der dritten ist die Liste in
den Einstellungen die einzige Stelle, an der jemand die Stadt findet — mit vier
Einträgen wird sie langsam zu einer, die man einmal sehen muss, um sie zu
kennen.

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

Stand für Frankfurt am Main, am 7. September 2026 abgerufen:

- [x] Geometrie — 42 Bewohnerparkbereiche, dazu 46 Stadtteile als Kontext.
- [x] Lizenz — DL-DE/Namensnennung 2.0, mit wörtlichem Quellenvermerk.
- [x] Maschinell abrufbar — WFS 2.0.0 mit `application/json` bzw. `GEOJSON`.
- [x] Tarif — **nicht** am Bereich, sondern an 921 Parkscheinautomaten, als
      `2 €/h` / `4 €/h`.
- [x] Zeiten — ebenfalls am Automaten, 30 Schreibweisen auf einem Muster.
- [x] Aktualisierung — `asNeeded`; Portal-Metadaten geändert am 4. September 2026.
- [x] Ansprechpartner — Straßenverkehrsamt, `SVA.GDI@stadt-frankfurt.de`.

Frankfurt fällt an keiner Stelle durch und ist angeschlossen. Die zwei
Rückfragen, die dabei offengeblieben sind, stehen in [todo.md](todo.md).

Stand für München, am 7. September 2026 abgerufen:

- [x] Geometrie — 82 Parkraummanagementgebiete, dazu 25 Stadtbezirke als Kontext.
- [x] Lizenz — DL-DE/Namensnennung 2.0, je Ebene aus dem ISO-Metadatensatz
      belegt, mit wörtlichem Quellenvermerk.
- [x] Maschinell abrufbar — WFS 2.0.0 mit `application/json`.
- [ ] Tarif — **nein.** In keinem der 291 Regeltexte steht ein Betrag; er
      steht nur in der Gebührenordnung. Alle 82 Gebiete: `Fee.unknown`.
- [x] Zeiten — je Straßenseite, als Fließtext mit 291 Schreibweisen.
- [x] Aktualisierung — `AS_NEEDED`; GeoPortal-Stand 2026-05-27.
- [x] Ansprechpartner — MOR-GB1, `gb1-23.mor@muenchen.de`.

München fällt an **einer** Stelle durch — dem Tarif — und ist trotzdem
angeschlossen: Die Prüfliste fragt nach dem Betrag, weil eine App ohne ihn
schlechter ist, nicht weil sie ohne ihn falsch wäre. „Gebührenpflichtig, Betrag
nicht in der Quelle" ist eine brauchbare Antwort; eine geratene wäre es nicht.
Die Rückfragen dazu stehen in [todo.md](todo.md).

Zu jeder Stadt, die durchfällt, gehört ein Eintrag in
[data-sources.md](data-sources.md) — Negativbefunde sind Arbeitsergebnisse und
verhindern, dass jemand dieselbe Suche ein zweites Mal macht.
