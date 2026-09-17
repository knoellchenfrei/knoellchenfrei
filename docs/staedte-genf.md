# Genf als Stadt der Klasse C — gemessen, entschieden, offen

> **Wo der Code liegt.** Parser in `app/packages/core/src/genf.ts`,
> Datenbau in `app/packages/ingest/src/build-data-genf.ts`, Quellen in
> `sources.ts` als `GENF_FILES`, Stadt als `GENF` in `core/city.ts`, das
> Land `CH-GE` in `core/holidays.ts`, Tests in `core/test/genf.test.ts` (17)
> und in `laender.test.ts`, `fixture-shape.test.ts`, `fuzz.test.ts`,
> `city.test.ts`, `ingest/test/quellen.test.ts`. Die Daten liegen eingecheckt
> unter `app/apps/web/public/data/genf/`.

> **Stand 17. September 2026.** Genf ist angeschlossen — die erste Stadt in
> der Schweiz und die erste der **Klasse C**: Die Quelle nennt Zonengrenzen,
> aber weder Zeiten noch Beträge. Jede Zone trägt `scheduleUnknown`, die App
> sagt „Zeiten unbekannt" und färbt grau. Was fehlt, steht unter „Was offen
> bleibt": der Tarif der Parkuhren und die Zeiten der Blauen Zone, für die es
> keinen Datensatz gibt, und die Entscheidung Ville oder Kanton.

Alle Zahlen hier sind an diesem Tag gegen die Dienste selbst gemessen, nicht
aus [staedte-recherche-2026-09-16.md](staedte-recherche-2026-09-16.md)
übernommen. Wo die Messung von der Recherche abweicht, steht es dabei.

## Die Quellen

Ein Server, vier Ebenen, alle über ArcGIS REST mit
`query?where=1%3D1&outFields=*&f=geojson&outSR=4326`:

| | Macaron-Zonen | Stellplatzreihen | Behindertenparkplätze | Quartiere |
| --- | --- | --- | --- | --- |
| Adresse | `https://vector.sitg.ge.ch/arcgis/rest/services/OTC_MACARON/MapServer/0` | `…/OTC_STATIONNEMENT_V_PUBLIQUE/MapServer/0` | `…/OTC_PLACE_HANDICAPE/MapServer/0` | `…/VDG_QUARTIER_VILLE/MapServer/0` |
| Titel im Katalog | „Zones de parcage avec macaron" | „Stationnement sur la voie publique" | — | „Ville GE - Quartiers de la ville de Genève" |
| Umfang | **53** Polygone (`returnCountOnly`: 53), 10.981 Stützpunkte; 17 in der Ville | **13.236** Linien (`returnCountOnly`: 13236), `maxRecordCount` 4.000 — vier Seiten | 599 Punkte, 297 in der Ville | **8** Polygone, 3.879 Stützpunkte |
| Inhalt | `ZONE_MACARON`, `NOM_SECTEUR`, `MISE_EN_SERVICE`, `SITG_ADM.OTC_MACARON.FID`, `SHAPE.AREA`, `SHAPE.LEN` | `OBJECTID`, `NOM_RUES`, `TYPE_STATIONNEMENT`, `NOMBRE_PLACES`, `SHAPE.LEN`, `TYPE_SUPPORT`, `NOMBRE_ARCEAUX` | `VOIE`, `LOCALISATION`, `PLACE_ELARGIE`, `DUREE`, `NOMBRE_PLACES`, `CODE_VOIE` | `NOM_QUARTIER`, `OBJECTID` |
| Lizenz | `licenseInfo: "Accès libre"`, `accessInformation: "© 2026 SITG"` — an jedem der vier ArcGIS-Online-Items (MapServer, FeatureServer, WFS, WMS) | dieselbe | dieselbe | dieselbe |
| Aktualität | Item `modified` 12. März 2026; Layer-Beschreibung: „introduites dès 1998" | Item `modified` 12. März 2026; die Recherche vom 16. September zählte 12.731, der Abruf vom 17. **13.236** — täglich nachgeführt | — | Item `modified` 27. August 2026 |

Dazu, nur für den Rahmen gemessen und nicht ausgeliefert: `CAD_COMMUNE`
(48 Polygone, „Périmètres des 45 communes genevoises, y compris les quatre
sections de la commune de Genève"), gefiltert auf `NO_COM_FEDERAL = 6621` —
Cité, Plainpalais, Eaux-Vives, Petit-Saconnex, 13.522 Stützpunkte.

**Zwei Korrekturen an der Recherche.** Erstens: Die Recherche nannte
12.731 Linien; es sind 13.236, und die Zahl in `sources.ts` ist der Abruf.
Zweitens: Der Katalog des SITG ist von hier nur über ArcGIS Online zu lesen.
`sitg.ge.ch` ist eine Next.js-Seite, deren Datensatzseiten (`/donnees/…`,
`/sitg_catalog/…`, `ge.ch/sitg/fiche/…`) alle mit 404 antworten; die
Lizenzstufe steht am Item unter `sitg.maps.arcgis.com/sharing/rest/search`.

## Die Lizenz, wörtlich

Aus <https://sitg.ge.ch/ressources/conditions-utilisation-donnees>,
abgerufen am 17. September 2026 (Seite „Conditions d'utilisation des
données", Stand 14. Juli 2026):

> **A - Accès libre (Open Data)** — Vous pouvez utiliser ce jeu de données à
> des fins privées. Vous pouvez utiliser ce jeu de données à des fins
> commerciales. Vous devez obligatoirement indiquer la source (ex : « Données
> SITG », date/fréquence d'extraction) et, le cas échéant, les traitements
> effectués sur le jeu de données. Sous réserve du respect des dispositions
> prévues dans les Conditions d'utilisation, vous pouvez reproduire, copier,
> transmettre, diffuser, publier, adapter, modifier, transformer, combiner le
> jeu de données notamment pour la création d'informations dérivées, de votre
> propre produit ou d'application, y compris pour une utilisation commerciale.

Und aus den vollständigen Bedingungen („Conditions d'utilisation des données
du Portail SITG en application de la législation genevoise sur la
géoinformation", Version vom 19. Mai 2026, PDF unter `media.sitg.ge.ch`),
Ziffer 4.1.1 und 4.4.1:

> Dans une perspective d'ouverture des données publiques, la Direction met à
> disposition des Utilisatrices ou des Utilisateurs, en libre accès, les
> Données de Niveau A, qu'elles soient destinées à un Usage privé ou à une
> Utilisation à des fins commerciales.
>
> Les Données du Portail SITG sont mises à disposition « en l'état » et telles
> que disponibles, sans garantie d'aucune sorte, y compris et sans limitation,
> sans garantie d'absence d'erreur, aucune garantie expresse ou implicite de
> titularité, d'absence de violation de droits de tiers, de qualité marchande
> ou d'adéquation à un usage particulier.

Dass die vier Ebenen Stufe A sind, steht an jedem ihrer Items:
`licenseInfo: "Accès libre"`. Die Familie ist `cc-by`, aus demselben Grund wie
bei Innsbruck: Die beiden Auflagen, an denen die Oberfläche hängt — Nennung in
vorgeschriebener Form und der Hinweis auf fehlende Gewähr —, sind dieselben.
`city.test.ts` führt die Adresse der Bedingungen deshalb neben der Innsbrucker
als Beleg für `cc-by`. Die Nennung steht als `attribution.source` mit
« Données SITG » vorneweg; das Datum des Abrufs trägt `meta.json`
(`geprueftAm`), und die App zeigt es in der Quellenzeile.

## Die Eigenheit, die alles bestimmt: keine Zeiten, kein Tarif

Die Zone weiß über sich: einen Buchstaben, einen Sektor, ein Datum. Die
Stellplatzreihe weiß: eine Art und eine Platzzahl. Kein Feld in keiner der
vier Ebenen nennt eine Uhrzeit, einen Wochentag oder einen Betrag. Was gilt,
steht auf `geneve.ch` als Prosa — Parkuhren der Fondation des Parkings,
Blaue Zone mit Parkscheibe für Besucher, Macaron für Bewohner — und in
keinem Datensatz, den das SITG führt (die Suche nach `horodateur`,
`stationnement` und `tarif` auf ArcGIS Online liefert außer den beiden
Parkebenen nur `OTC_PARKING`, die Parkhäuser).

Deshalb Klasse C, und deshalb an jeder Zone `scheduleUnknown: true`,
`windows: []`, `fee: { kind: 'unknown' }`, `rawHours` und `rawFee` leer,
`meta.absent` mit `schedule` und `fee`. Die App sagt „Zeiten unbekannt" und
färbt grau — nicht hellblau wie eine Zone, die gerade nicht kassiert. Ein
Datenbau, der die Zeiten von `geneve.ch` abschriebe, wäre der Fehler, den
Cottbus mit seiner Ordnung gerade noch vermeiden konnte: Dort lag eine
datierte, unterschriebene Verordnung mit genau einem Fenster vor; hier liegt
eine Webseite vor, die je Straße auf die Beschilderung verweist.

Eine Währung setzt Genf nicht: `Fee.currency` hängt an `exact` und `range`,
und Genf hat keinen Betrag. Sobald einer dazukommt, ist er `CHF`.

## Die Stellplatzarten: 28 Werte, gezählt

`TYPE_STATIONNEMENT` über alle 13.236 Linien, mit Platzzahl:

| Wert | Linien | Plätze | Lesart |
| --- | --- | --- | --- |
| `Gratuit 60 min` | 5.114 | 27.195 | Auto, frei mit Höchstdauer — die Blaue Zone |
| `Cases 2 roues` | 2.604 | 18.977 | Zweiräder |
| `Vélos` | 1.441 | 11.927 | Velos |
| `Gratuit jaune` | 930 | 1.641 | gelb markiert, Sonderberechtigung — **keine** freien Autoplätze |
| `Payant 90 min` | 818 | 4.092 | Auto, Parkuhr, 90 Minuten |
| `Gratuit 240 min` | 737 | 3.086 | Auto, frei, 4 Stunden |
| `Gratuit illimité` | 443 | 2.227 | Auto, frei, ohne Höchstdauer |
| `Gratuit 180 min` | 339 | 2.049 | Auto, frei, 3 Stunden |
| `Stationnement interdit` | 294 | 714 | Halteverbot |
| `Gratuit 30 min` | 96 | 318 | Auto, frei, 30 Minuten |
| `Payant illimité` | 66 | 636 | Auto, Parkuhr, ohne Höchstdauer |
| `Payant 30 min` | 47 | 231 | Auto, Parkuhr, 30 Minuten |
| `Gratuit 15 heures` | 44 | 174 | Auto, frei, 15 Stunden |
| `Gratuit jaune spécial` | 37 | 88 | gelb, Sonderberechtigung |
| `Police` | 35 | 112 | Polizei |
| `Autre` | 32 | 139 | anderes |
| `Cars` | 29 | 101 | Reisebusse |
| `Electrique` | 22 | 42 | Ladeplätze |
| `Gratuit 120 min` | 16 | 138 | Auto, frei, 2 Stunden |
| `Payant 15 heures` | 15 | 109 | Auto, Parkuhr, 15 Stunden |
| `Vélo cargo` | 14 | 52 | Lastenvelos |
| `Payant 60 min` | 13 | 71 | Auto, Parkuhr, 1 Stunde |
| `Ambulance` | 10 | 11 | Ambulanz |
| `Moto` | 9 | 89 | Motorräder |
| `Payant 120 min` | 9 | 108 | Auto, Parkuhr, 2 Stunden |
| `Mobility` | 9 | 9 | Carsharing |
| `Habitant / nuit` | 8 | 29 | Bewohner nachts |
| `Gratuit 8 heures` | 2 | 51 | Auto, frei, 8 Stunden |
| *(null)* | 3 | 9 | ohne Art — der Parser wirft |

`parseGenfTypeStationnement` kennt genau diese 28 Werte: Die vierzehn ohne
Regime stehen als Liste im Parser, die vierzehn mit Regime folgen einem
Muster (`Payant|Gratuit`, dann `N min`, `N heures` oder `illimité`). Alles
andere wirft `GenfParseError`, und der Datenbau zählt es als unlesbar — im
Abzug vom 17. September: null Linien in den 17 Zonen. Eine Dauer von null
wirft, wie ein Betrag von null in Berlin. `Gratuit jaune` steht mit Absicht
bei den Arten ohne Regime: Gelb markiert heißt in der Schweiz Sonderberechtigung,
und „frei" wäre die eine Lesart, die sicher falsch ist.

## Die Höchstparkdauer

Sie hängt nicht an der Zone, sondern an der Reihe — wie in Berlin an den
Abschnitten und in Frankfurt an den Automaten. Der Datenbau ordnet jede Reihe
über den Mittelpunkt ihrer Stützpunkte der Zone zu, in der er liegt, und
zählt Plätze: `spaces` sind die Autoplätze mit Regime, `maxStayValues` die
Höchstdauern nach Häufigkeit, `maxStay` die häufigste, `maxStayShare` der
Anteil der begrenzten an allen Autoplätzen. Dieselbe Form wie Berlins
`maxStayShare`, nur über Plätze statt Abschnitte — die Quelle zählt Plätze.

Ergebnis für die 17 Zonen, 6.213 Reihen, 19.072 Autoplätze mit Regime:

| Zone | Sektor | Autoplätze | Höchstdauern (nach Plätzen) | Anteil begrenzt |
| --- | --- | --- | --- | --- |
| A | Saint-Gervais | 404 | 90 min, 30 min | 100 % |
| B | Cité | 191 | 90 min, 30 min, 1 h | 100 % |
| C | Bastions | 274 | 90 min, 1 h, 30 min | 100 % |
| D | Eaux-Vives | 1.577 | 1 h, 90 min, 30 min | 100 % |
| E | Tranchées Rive | 1.875 | 1 h, 90 min, 30 min | 100 % |
| F | Florissant | 1.126 | 1 h, 90 min | 98,8 % |
| G | Champel | 1.719 | 1 h, 90 min, 2 h, 30 min | 100 % |
| H | Cluse | 2.035 | 1 h, 90 min, 30 min | 100 % |
| I | Jonction | 1.418 | 1 h, 90 min, 30 min | 100 % |
| J | Saint-Jean | 1.505 | 1 h, 90 min | 100 % |
| K | Grand-Pré | 1.718 | 1 h, 90 min | 100 % |
| L | Pâquis | 1.299 | 1 h, 90 min, 30 min | 100 % |
| M | Nations | 539 | 1 h, 90 min, 30 min | 100 % |
| N | Sécheron | 115 | 1 h, 90 min, 30 min | 100 % |
| O | Acacias - Vernets | 552 | 1 h, 90 min | 100 % |
| P | Petit-Saconnex | 1.365 | 1 h, 90 min, 4 h, 30 min | 99,5 % |
| Q | Vieusseux-Charmilles-Jardins d'Aïre | 1.360 | 1 h, 90 min | 100 % |

In den drei Innenstadtzonen A, B und C überwiegt die Parkuhr (`Payant 90
min`), in allen anderen die Blaue Zone (`Gratuit 60 min`). Das Panel sagt
„Überall in dieser Zone gilt eine Höchstparkdauer, aber nicht überall
dieselbe" — und das ist genau die Datenlage. Dazu 16.894 Plätze anderer Art
in den Zonen (Zweiräder, Velos, gelb, Halteverbot …), gezählt und nicht
ausgeliefert.

## Die Entscheidung: die Ville, nicht der Kanton

Der Datensatz führt 53 Zonen im ganzen Kanton: 17 mit Buchstaben `A`–`Q` in
der Ville de Genève, 35 mit Nummern in Carouge (8), Lancy (28A, 28B), Vernier
(43A–C), Meyrin (30A–C), Versoix (44A–C), Thônex (40A–D), Onex, Chêne-Bourg,
Chêne-Bougeries, Cologny, Grand-Saconnex, Plan-les-Ouates, Veyrier, Troinex,
Bernex/Confignon, Genthod, Corsier, Collonge-Bellerive, Anières, Hermance,
Jussy, Puplinge, Choulex, La Croix-de-Rozon, Chambésy — und eine ohne
Buchstaben (FID 52, Sektor ein Leerzeichen).

Ausgeliefert werden die 17. Die Entscheidung folgt der Vorgabe (Rahmen aus
der Gemeindegrenze der Ville, Bezirke die Quartiere der Ville) und ist
messbar: Behalten wird, was in einem der acht Quartiere liegt — derselbe
Filter, der die Ortsangabe im Panel liefert. Die 35 anderen stehen mit
Buchstaben und Sektor im Log des Datenbaus, damit niemand sie für verloren
hält. Der Rahmen `reportBounds` ist ein Rechteck um die vier Sektionen der
Gemeinde (6,1102–6,1758 / 46,1778–46,2319, nach außen 6,10–6,18 /
46,17–46,24); Carouge südlich der Arve liegt bei 46,181° Nord noch darin.
Eine Meldung von dort wird angenommen, die Karte zeigt dort nur keine Zone —
solange Zone 8 (Carouge) nicht ausgeliefert wird.

Der Mittelpunkt ist der Pont du Mont-Blanc, der Zoom 13: 0,066° Länge sind
ein Drittel von Frankfurts 0,40° bei 12, und bei 13 füllen die acht Quartiere
ein Handy-Display. Der Paartest in `city.test.ts` ist grün; die nächste
Stadt in `CITIES` liegt 400 km entfernt.

## Der Probelauf

```
CITY=genf pnpm --filter @knoellchenfrei/ingest fetch-data
  Stadt: genf — 0 Quellen nach …/.raw/genf
  zones (Datei) … 450695 Bytes, 53 Features
  lines (Datei) … 4547344 Bytes, 13236 Features
  accessible (Datei) … 173144 Bytes, 599 Features
  districts (Datei) … 155949 Bytes, 8 Features

CITY=genf pnpm --filter @knoellchenfrei/ingest build-data-genf
  Genf — Daten bauen …
    districts.geojson: 8 KB
    ausgelassen: FID 52 — Genfer Feed: "" — Zone ohne ZONE_MACARON
    zones.geojson: 21 KB
    poi.geojson: 50 KB
    umweltzone.geojson: 0 KB
    meta.json: 1 KB
    außerhalb der Ville de Genève, nicht ausgeliefert (35): 13 (Chêne-Bourg), …

  17 von 53 Zonen übernommen (1 ohne Schlüssel, 35 außerhalb der Ville),
  8 Quartiere, 297 Behindertenparkplätze (302 außerhalb)
  6213 von 13236 Stellplatzreihen in den Zonen (7023 außerhalb, 0 unlesbar,
  0 ohne Platzzahl): 19072 Autoplätze mit Regime, 16894 Plätze anderer Art
```

Drei Dinge, die der Lauf hält:

- **Seitenweise.** Die Linien sind mehr als `maxRecordCount` (4.000). Der
  Dienst antwortet auf die erste Anfrage mit 4.000 gültigen Merkmalen und
  `exceededTransferLimit: true` — einmal oben, einmal unter `properties`.
  `fetch.ts` holt mit `resultOffset` nach, bis die Marke fehlt
  (`FileSource.paged`), und prüft die 95-%-Schwelle über die Summe. Vor
  dieser Marke hätte der Abruf aus dem ersten Drittel gebaut und Erfolg
  gemeldet.
- **Grade.** Ohne `outSR=4326` antwortet der Dienst in EPSG:2056 (Meter um
  2.500.000 / 1.120.000 — die Layer-`extent`); `assertDegrees` bricht ab,
  sobald ein Wert über 180 bzw. 90 kommt. Der WFS desselben Servers liefert
  mit `urn:ogc:def:crs:EPSG::4326` GML in `[lat, lon]`, deshalb REST.
- **Eine Zone ohne Schlüssel wird ausgelassen und genannt**, nicht geraten:
  `genfZoneKey` wirft, der Datenbau zählt. Sie liegt ohnehin außerhalb.

## Feiertage: Kanton Genf

Neu in `holidays.ts`: `CH-GE`, mit dem Bund darunter (`NATIONWIDE.CH`, nur
der 1. August nach Art. 110 Abs. 3 BV). Beleg: Loi sur les jours fériés
(LJF) vom 3. November 1951, rs/GE J 1 45, Art. 1 Abs. 1, in der Fassung seit
dem 1. Januar 1991, abgerufen am 17. September 2026 von
<https://silgeneve.ch/legis/data/rsg_j1_45.htm>:

> Sont déclarés fériés les jours suivants : a) 1er Janvier, b) Vendredi saint,
> c) Lundi de Pâques, d) Ascension, e) Lundi de Pentecôte, f) 1er Août,
> g) Jeûne genevois, h) Noël, i) 31 Décembre, anniversaire de la restauration
> de la République.

Neun Tage; der Jeûne genevois ist „le jeudi qui suit le premier dimanche du
mois de septembre" (Anmerkung a zum Gesetz, loi additionnelle vom 10. Mai
1844) — weder fest noch österlich, deshalb `jeuneGenevois(year)` als
`custom`-Regel wie Koningsdag. Fällt der 1. September auf einen Sonntag,
ist er selbst der erste, und der Feiertag ist der 5. (2024). Was Genf nicht
hat und ein deutscher Kalender mitbrächte: 1. Mai, 26. Dezember,
Fronleichnam, Allerheiligen, 3. Oktober. Tests in `laender.test.ts` mit den
Daten 2026 (Jeûne genevois am 10. September) und 2027 (Ostern am 28. März,
Jeûne genevois am 9. September) sowie 2024, 2025 und 2028 für die Regel.

Ob die Genfer Parkuhren an diesen Tagen ruhen, sagt keine Quelle — für eine
Zone mit `scheduleUnknown` spielt es heute keine Rolle, und sobald Zeiten
dazukommen, ist es die erste Frage.

## Was einzutragen war

Alles ist eingetragen; die Liste, damit der Merge weiß, wo:

| Datei | Eintrag |
| --- | --- |
| `core/src/city.ts` | `GENF`, in `CITIES` zuletzt |
| `core/src/holidays.ts` | `'CH-GE'` in `Land`, `jeuneGenevois`, `REGIONAL['CH-GE']` mit Gesetzesbeleg |
| `core/src/index.ts` | `export * from './genf.js'` |
| `ingest/src/sources.ts` | `FileSource.paged?`, `GENF_FILES`, `FILES_BY_CITY`, `genf: []` in `BY_CITY` |
| `ingest/src/fetch.ts` | `ladeRumpf`, `ladeSeitenweise` für `paged` |
| `ingest/package.json` | `build-data-genf` |
| `core/test/city.test.ts` | `GENF` in `cityByKey`, Meyrin/Lausanne/Pont du Mont-Blanc in `cityAt`, SITG-Bedingungen als `cc-by`-Beleg |
| `core/test/laender.test.ts` | „der Genfer Kalender", vier Tests |
| `core/test/fuzz.test.ts` | zwei Beschuss-Läufe, zwei Parser im Zeitbudget |
| `core/test/fixture-shape.test.ts` | „Genfer Fixtures", zwei Ebenen |
| `ingest/test/quellen.test.ts` | `describe('cityFiles für Genf')` |
| `apps/web/statistik/main.ts` | `STADTNAMEN.genf` |
| `NOTICE`, `README.md`, `docs/staedte.md`, `docs/data-sources.md`, `docs/todo.md` | Zeile bzw. Abschnitt |
| erzeugt | `zone-keys.generated.ts` (850 Kennungen), `zone-units.generated.ts`, `apps/api/src/zone-units.generated.json` |

Nicht angefasst, wie verabredet: `index.html`, `manifest.webmanifest`,
`login-page.ts`, `deploy.yml`, `kacheln.yml`, die Stadtlisten in den Tests
(alle aus `CITIES`) und der Satz in `CLAUDE.md`, der schon auf
`docs/staedte.md` verweist. Der Satz „Zwei Staaten, sieben Bundesländer" in
`README.md` (Abschnitt „Daten") wird mit der Schweiz falsch — er gehört
zentral geändert, sobald alle Schweizer Städte drin sind.

## Was offen bleibt

1. **Zeiten und Tarif.** Es gibt keinen Datensatz. `geneve.ch` nennt die
   Blaue Zone (Parkscheibe, in der Regel Mo–Sa) und die Parkuhren der
   Fondation des Parkings mit Tarifen je Sektor als Prosa und verweist auf
   die Beschilderung. Der Weg: die Fondation des Parkings
   (`geneve-parking.ch`) oder die Direction générale des transports fragen,
   ob es eine Tarifzonen-Ebene gibt; das SITG hat `OTC_HORAIRES_LIVRAISON`
   (Lieferzeiten) — ein Vorbild dafür, wie Zeiten dort aussähen. Bis dahin
   `scheduleUnknown`, und das ist die richtige Antwort.
2. **Ville oder Kanton.** 35 Zonen liegen im selben Datensatz und werden
   nicht ausgeliefert. Für den Kanton: `reportBounds` aus `CAD_LIMITE_CANTON`,
   Bezirke aus `OCS_SECTEURS_STATISTIQUES` (61) oder `CAD_COMMUNE` (45
   Gemeinden), den Quartier-Filter in `build-data-genf.ts` durch „Sektor
   nicht leer" ersetzen. Eine Entscheidung des Betreibers; der Datenbau
   nennt die 35 bei jedem Lauf.
3. **Die eine Zone ohne Buchstaben** (FID 52, Sektor ` `, in Betrieb seit
   dem 1. Januar 2026 laut `MISE_EN_SERVICE`). Sie liegt außerhalb der
   Ville; wer den Kanton ausliefert, braucht für sie einen Schlüssel — die
   FID wäre die stabile Wahl, wie in Innsbruck.
4. **`Fee.currency`** bleibt ungesetzt, weil es keinen Betrag gibt. Der erste
   Genfer Betrag ist `CHF`; die Oberfläche kann das seit dem 16. September.
5. **Kein Kachelarchiv.** `build-tiles.sh` liest die Städte aus `core` und
   legt `genf.pmtiles` beim nächsten Lauf an; bis dahin Rasterkacheln.
6. **Die Zuordnung der Reihen läuft über den Mittelpunkt.** Eine Reihe, die
   genau auf einer Zonengrenze liegt, fällt auf die eine Seite; bei 6.213
   Reihen und 17 Zonen mit Straßen als Grenzen ist das die Regel, nicht die
   Ausnahme, und der Fehler je Zone liegt im Promillebereich. Wer es genauer
   will, schneidet Linien an Polygonen — das ist ein Werkzeug, das dieses
   Projekt nicht hat.

## Prüfstand

Am 17. September 2026 in diesem Worktree grün:

```
cd app && pnpm -r typecheck          # alle vier Pakete
cd app && pnpm test                  # core, ingest, api, web
./scripts/sprache-pruefen.sh
node scripts/doku-pruefen.mjs
./scripts/namen-pruefen.sh
./scripts/commit-pruefen.sh
```

Nicht gelaufen, absichtlich: die E2E-Suite (läuft zentral) und der Kachelbau.

## Dateien

| Datei | Inhalt |
| --- | --- |
| `app/packages/core/src/genf.ts` | `parseGenfTypeStationnement`, `genfZoneKey`, `genfMaxStayCode`, `genfStreetLabel`, `GenfParseError`, `GenfZoneProperties`, `GenfLineProperties` |
| `app/packages/core/test/genf.test.ts` | 17 Tests: jede Stellplatzart des Abzugs, Unfug, Zonenschlüssel, Stadt, Kalender, Tarifrechnung mit `scheduleUnknown` |
| `app/packages/core/test/fixtures/genf-macaron-2026-09-17.json` | Alle 53 Zonen, Sachdaten ohne Geometrie |
| `app/packages/core/test/fixtures/genf-stationnement-2026-09-17.json` | Je Stellplatzart eine Linie (29), dazu eine ohne Platzzahl und eine mit Bügeln; die Zählung aller 13.236 nach Art |
| `app/packages/ingest/src/build-data-genf.ts` | Datenbau |
| `app/apps/web/public/data/genf/` | `zones.geojson` (17), `districts.geojson` (8), `poi.geojson` (297), leere `umweltzone.geojson`, `meta.json` |
