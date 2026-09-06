# Zweite Stadt: was dafür an Daten da sein muss

Die Zonenlogik dieser App ist nicht Berlin-spezifisch — Tarifrechnung,
Zeitfenster-Parser, Heatmap-Raster und Ruhetags-Hinweis funktionieren überall.
Berlin steckt an genau drei Stellen: in der Datenquelle, im Feiertagskalender
und im Kartenausschnitt.

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
| **Hamburg** | „Bewohnerparkgebiete" und „Öffentlicher Parkraum" als WFS im Transparenzportal | offen | teilweise beschrieben | Portal ist auf offene Lizenzen ausgelegt | **belegt** |
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

Drei Aufgaben also:

1. **Feiertage je Bundesland.** Der 8. März ist in Berlin Feiertag, in Hamburg
   nicht; Fronleichnam umgekehrt. Das ist eine Tabelle, keine Architektur.
2. **Stadt als Konfiguration** statt als Konstante: Datenquelle,
   Kartenausschnitt, Grenzprüfung, Feiertagsland. FreiFahren löst das mit einem
   Paket je Stadt und einer Datenbank je Stadt.
3. **Der Parser muss unbekannte Schreibweisen abweisen können**, ohne den Build
   einer anderen Stadt mitzureißen.

Reihenfolge: erst 2, dann 1, dann die zweite Stadt. Punkt 3 zeigt sich von
selbst, sobald der erste fremde Feed hereinkommt.

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

Zu jeder Stadt, die durchfällt, gehört ein Eintrag in
[data-sources.md](data-sources.md) — Negativbefunde sind Arbeitsergebnisse und
verhindern, dass jemand dieselbe Suche ein zweites Mal macht.
