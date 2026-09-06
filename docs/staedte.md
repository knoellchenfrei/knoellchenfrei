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

Aus der Umgebung, in der diese Analyse entstand, sind fast alle kommunalen
Open-Data-Portale gesperrt — erreichbar war nur `daten.berlin.de`. Die Aussagen
zu den anderen Städten stammen daher aus Recherche, **nicht aus dem Abruf der
Schnittstellen**. Die letzte Spalte sagt jeweils, wie belastbar ein Eintrag ist.

| Stufe | Bedeutung |
| --- | --- |
| **geprüft** | Schnittstelle selbst abgerufen, Felder gesehen |
| **belegt** | Datensatz im Portal nachgewiesen, Inhalt nicht selbst geprüft |
| **Hinweis** | Es gibt Anzeichen, aber keinen belegten Datensatz |

Vor jeder Umsetzung gehört die Checkliste am Ende dieses Dokuments abgearbeitet.

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
| **Hamburg** | zwei WFS, Adressen und Typnamen unten | im Datensatz „Öffentlicher Parkraum" | im selben Datensatz | DL-DE/**Namensnennung** 2.0 | **belegt** |
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

Nachgesehen am 6. September 2026, über Websuche — die Portale selbst sind aus
dieser Umgebung gesperrt (`geodienste.hamburg.de` und
`suche.transparenz.hamburg.de` beantworten den CONNECT des Egress-Proxys mit
403). Die Stufe bleibt deshalb **belegt**, nicht *geprüft*: Kein Feld wurde
selbst gesehen.

| | |
| --- | --- |
| **Bewohnerparkgebiete** | `https://geodienste.hamburg.de/HH_WFS_bewohnerparkgebiete`, Typname `de.hh.up:bewohnerparkgebiete` |
| **Öffentlicher Parkraum** | `https://geodienste.hamburg.de/HH_WFS_Parkraum`, Typname vermutlich `de.hh.up:parkraum` — nicht bestätigt |
| Herausgeber | Landesbetrieb Verkehr (LBV) bzw. Landesbetrieb Geoinformation und Vermessung |
| Formate | WFS (GML), WMS, CSV, dazu eine OGC-API-Features-Schnittstelle |
| Lizenz | Datenlizenz Deutschland **Namensnennung** 2.0 |
| Attribute laut Metadaten | Lage, Parkzeiten, Parkzone, Höchstparkdauer, Handyparkzone |

Drei Dinge, die daran hängen:

**1. Die Lizenz ist eine andere als in Berlin.** Berlin gibt unter DL-DE/**Zero**
heraus — Nennung freiwillig. Hamburg verlangt sie. Das ist keine Formalie,
sondern Lizenzbedingung: Eine Hamburg-Ansicht ohne Quellenangabe verletzt sie.
`City.attribution.attributionRequired` trägt den Unterschied bis in die
Oberfläche, damit ihn niemand übersieht.

**2. Die Metadaten des Dienstes nennen veraltete Preise.** Ihre Beschreibung
spricht von drei Zonen zu 3, 2 und 1 Euro je Stunde. Tatsächlich hat Hamburg
seit dem **1. Juli 2026 vier Zonen**: 4,00 / 3,50 / 3,00 / 2,00 Euro je Stunde,
angehoben um 50 Cent je Zone mit Verweis auf die Inflation. Genau der Fall, vor
dem die Prüfliste unten warnt — nur dass hier nicht der Datensatz alt ist,
sondern seine Beschreibung. Wer den Tarif aus dem Metadatentext liest statt aus
dem Feature, liefert falsche Preise aus.

**3. Vier Zonen statt drei sind kein Sonderfall für den Code.** `ParkingZone`
kennt keine Zonenanzahl; Tarif und Zeitfenster stehen je Zone. Was fehlt, ist
der Parser für Hamburgs *Schreibweise* der Zeiten — Berlins „Mo-Sa 9-20 Uhr"
ist eine Konvention dieses Feeds, keine Norm. Den kann niemand schreiben, ohne
den Feed einmal gesehen zu haben; er ist die eine Aufgabe, die diese Umgebung
nicht erledigen kann.

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
3. **Der Parser muss unbekannte Schreibweisen abweisen können**, ohne den Build
   einer anderen Stadt mitzureißen. Offen, und zeigt sich erst, wenn der erste
   fremde Feed hereinkommt.

Was danach noch offen ist: der Hamburger Feed selbst — Abruf, Parser, Zonendaten
im Bündel — und der Produktname, der in `index.html`, im Manifest und in der
`h1` weiter „ParkingZone Berlin" lautet.

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

Stand für Hamburg, nach dem Abschnitt oben:

- [x] Geometrie — zwei WFS, benannt.
- [x] Lizenz — DL-DE/Namensnennung 2.0, offen, aber mit Pflicht zur Nennung.
- [x] Maschinell abrufbar — WFS, CSV, OGC API Features.
- [x] Tarif — laut Metadaten im Datensatz „Öffentlicher Parkraum".
- [x] Zeiten — ebenda, Schreibweise **unbekannt**. Das ist der offene Punkt.
- [x] Aktualisierung — bei Änderung der Gebiete. Die *Beschreibung* des Dienstes
      hinkt allerdings hinterher, siehe oben.
- [ ] Ansprechpartner — nicht ermittelt.

Damit fällt Hamburg an keiner Stelle durch. Was fehlt, ist der Blick in den
Feed selbst, und der geht aus dieser Umgebung nicht.

Zu jeder Stadt, die durchfällt, gehört ein Eintrag in
[data-sources.md](data-sources.md) — Negativbefunde sind Arbeitsergebnisse und
verhindern, dass jemand dieselbe Suche ein zweites Mal macht.
