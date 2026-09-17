# Straßburg als erste Stadt in Frankreich — gemessen, entschieden, offen

> **Wo der Code liegt.** `app/packages/core/src/strasbourg.ts` (Staffelparser,
> Farbe und Schlüssel, die Zeiten der Datensatzbeschreibung als Konstante),
> `app/packages/ingest/src/build-data-strasbourg.ts` (Datenbau),
> `app/apps/web/public/data/strasbourg/` (der Abzug), Tests in
> `core/test/strasbourg.test.ts` und in den gemeinsamen Testdateien.

> **Stand 17. September 2026.** Straßburg ist angeschlossen: Parser, Datenbau,
> Stadt-Konstante, Abzug und Einträge in den gemeinsamen Dateien liegen im
> Repository; der Kalender `FR-67` stand seit dem 16. September bereit. Es ist
> die erste Stadt in Frankreich und die erste, deren **Zeiten nicht in einem
> Feld stehen**, sondern in der Beschreibung des Datensatzes — und die erste
> mit einem **Staffeltarif am Feature**. Was offen bleibt, steht unten.

Alle Zahlen hier sind an diesem Tag gegen das Portal selbst gemessen, nicht
aus der Auslands-Recherche vom 16. September übernommen. Wo die Messung von
der Recherche abweicht, steht es dabei: Die Lizenz ist die **Fassung 1.0** der
Licence Ouverte, nicht 2.0.

## Die Quellen

Ein Opendatasoft-Portal, `https://data.strasbourg.eu`, Open Data der Ville et
Eurométropole de Strasbourg (401 Datensätze im Katalog). Abgerufen als
`/api/explore/v2.1/catalog/datasets/<id>/exports/geojson` — die ganze Ebene in
einer Antwort, `application/json; charset=utf-8`, WGS84 als `[lon, lat]`. Ein
`srsName` gibt es nicht; `assertDegrees` im Datenbau misst trotzdem nach.

| | Zones de stationnement payant | Découpage en 10 quartiers | Zones de stationnement résidant |
| --- | --- | --- | --- |
| Datensatz | `stationnement-payant` | `strasbourg-10-quartiers` | `stationnement_residant` |
| Herausgeber | `publisher: Ville de Strasbourg`, `attributions: ['Ville de Strasbourg']` | Eurométropole de Strasbourg (Géomatique et connaissance du territoire, Atelier de géomatique) | Ville de Strasbourg |
| Umfang | `records_count: 19`; Abruf **19** Polygone, 93.045 Bytes, 2.244 Stützpunkte | 10 Polygone, 165.865 Bytes | 15 Polygone, 60.230 Bytes |
| Inhalt | `geo_point_2d` (Objekt), `id_zone_visiteur` (int, 1–20 ohne 15), `couleur` (text), `tarif` (text), `numero_zone_resident` (int, 1–16 ohne 13), `date_maj` (date) | `geo_point_2d`, `id_quart10` (int), `nom` (text) | `id_zone_resident` (int), `numero_zone_resident` (**text**), `annee_mise_en_place`, `type_zone`, `date_maj` |
| Lizenz | „Licence Ouverte (Etalab)", `license_url` → PDF von 2014 — **Fassung 1.0**, siehe unten | „Licence Ouverte (Etalab)", dasselbe PDF | „Licence Ouverte v2.0 (Etalab)", PDF von 2017 |
| Aktualität | `date_maj` an allen 19 Flächen `2026-09-03`; Katalog `data_processed` 2026-09-03T07:15, `modified` 2026-09-07 | `modified` 2018-12-07 (Stand der Einteilung) | `date_maj` 2023-07-10 bis 2024-08-08; Katalog 2026-08-11 |

Die Beschreibung des Tarifzonen-Datensatzes, wörtlich (HTML entfernt):

> Retrouvez les zones de stationnement payants de la ville de Strasbourg avec
> les tarifs horaires. Le stationnement est payant du lundi au samedi de 9h00
> à 19h00 et gratuit les dimanches et les jours fériés. Les tarifs augmentent
> progressivement au-delà des premières heures de stationnement. Le paiement
> dans une zone tarifaire n'est pas reconnu dans une autre zone, même si le
> tarif qui y est pratiqué est moins cher. Par exemple, un paiement réalisé
> en zone rouge ne sera pas pris en compte en zone orange ou verte. Pour plus
> d'information, consulter la règlementation tarifaire.

Der Verweis „règlementation tarifaire" führt auf
`https://www.strasbourg.eu/stationnement-visiteur`, die Seite der Ville et
Eurométropole zum Parken auf der Straße (Abschnitt „Stationnement en voirie —
Les tarifs de stationnement au 1er septembre 2026"), gelesen am 17. September:

> Le stationnement est payant du lundi au samedi, de 9 h à 19 h. Il est
> gratuit les dimanches et les jours fériés. Les tarifs augmentent
> progressivement au-delà des premières heures. Le paiement est valable
> uniquement dans la zone choisie.

Dazu die drei Tariftabellen („Tarif cumulé"), zeichengleich mit den drei
Werten des Feeds, nur mit Komma statt Punkt — und je Tabelle der Satz „Au-delà
de 3 heures [4 / 5] de stationnement, montant du Forfait de post-stationnement
(FPS) = 35 € (17 € si réglé dans les 3 jours suivant la réception de l'avis de
paiement)". Betreiber laut Seite: SPL Parcus+ voirie.

**Die Lizenz, nachgemessen.** Das Feld `license` des Tarifzonen-Datensatzes
lautet „Licence Ouverte (Etalab)", `license_url` ist
`https://www.etalab.gouv.fr/wp-content/uploads/2014/05/Licence_Ouverte.pdf`.
Diese Adresse leitet heute über `data.gouv.fr` auf
`static.data.gouv.fr/resources/licence-ouverte-2-0/20240711-152120/licence-ouverte.pdf`
— ein Druck-PDF (PDF/X, Adobe PDF Library 9.0) mit `xmp:CreateDate`
**2011-10-17**, also das Dokument der ersten Fassung; sein Text ließ sich von
hier nicht extrahieren (kein `pdftotext`, `etalab.gouv.fr` antwortet mit 503).
Drei Messungen sagen dasselbe: Andere Datensätze desselben Portals tragen
ausdrücklich „Licence Ouverte v2.0 (Etalab)" mit dem PDF
`2017/04/ETALAB-Licence-Ouverte-v2.0.pdf`; der geerntete Eintrag auf
data.gouv.fr (`/api/1/datasets/zones-de-stationnement-payant/`,
Organisation „Eurométropole de Strasbourg", `harvest.remote_url` →
`data.strasbourg.eu/explore/dataset/stationnement-payant/`) führt
`license: "fr-lo"` — der Schlüssel der Fassung 1.0, 2.0 hieße `lov2`; und die
Bewohnerzonen daneben tragen 2.0. Die Recherche vom 16. September hatte
„Licence Ouverte" ohne Fassung notiert, der Auftrag „2.0" — beides ist damit
korrigiert.

Die Fassung 2.0 (April 2017) ließ sich lesen; ihr Wortlaut zeigt, worum es
bei beiden geht:

> Le « Réutilisateur » est libre de réutiliser l'« Information » : de la
> reproduire, la copier, de l'adapter, la modifier, l'extraire et la
> transformer, pour créer des « Informations dérivées », des produits ou des
> services, de la communiquer, la diffuser, la redistribuer, la publier et la
> transmettre, de l'exploiter à titre commercial […]. Sous réserve de :
> mentionner la paternité de l'« Information » : sa source (au moins le nom
> du « Concédant ») et la date de dernière mise à jour de l'« Information »
> réutilisée. […] La présente licence a été conçue pour être compatible avec
> toute licence libre qui exige au moins la mention de paternité et notamment
> avec la version antérieure de la présente licence ainsi qu'avec les
> licences « Open Government Licence » (OGL) du Royaume-Uni, « Creative
> Commons Attribution » (CC-BY) de Creative Commons et « Open Data Commons
> Attribution » (ODC-BY) de l'Open Knowledge Foundation.

Die Fassung 1.0 verlangt dieselbe Nennung („sa source (a minima le nom du
« Producteur ») et la date de sa dernière mise à jour"). Die App trägt deshalb
`licenceFamily: 'cc-by'`, `attributionRequired: true`, `source` mit dem
Herausgeber wörtlich und den Stand der Daten in `meta.json` (`geprueftAm`) —
das ist die „date de sa dernière mise à jour". `licence` nennt die Fassung
1.0, `licenceUrl` die Adresse, die der Datensatz selbst nennt.

## Die Eigenheit, die alles bestimmt: eine Staffel, kein Stundensatz

`tarif` ist ein kumulierter Preis je Aufenthaltsdauer, drei Werte für 19
Flächen:

| Farbe | Flächen | `tarif` wörtlich |
| --- | --- | --- |
| rouge | 5 | `1h = 3.5€ / 2h = 8€ / 2h15 = 10€ / 2h30 = 12€ / 2h50 = 16.5€ / 3h = 17€` |
| orange | 7 | `1h = 2.5€ / 2h = 3.5€ / 2h15 = 6€ / 2h30 = 8€ / 2h50 = 9€ / 3h = 10€ / 3h20 = 14€ / 3h45 = 16.5€ / 4h = 17€` |
| vert | 7 | `1h = 1€ / 2h = 2€ / 3h = 4.5€ / 3h15 = 5.50€ / 3h30 = 6.50€ / 4h = 10€ / 4h15 = 12€ / 4h30 = 14€ / 4h45 = 16.5€ / 5h = 17€` |

Drei Dinge daran, alle gemessen: Der **Dezimalpunkt** (`3.5`, `16.5`, `5.50`
— eine oder zwei Stellen, `5.50` und `4.5` nebeneinander); die **Stufen
zwischen den Stunden** (`2h15`, `2h50`, `3h20`, `3h45`); und die **letzte Stufe
ist immer 17 €** — der ermäßigte Forfait post-stationnement, den die Stadt bei
Zahlung binnen drei Tagen verlangt. Das ist die Logik der französischen
Dezentralisierung von 2018: Der Tarif steigt gegen Ende steil, bis er die
Strafe erreicht, und darüber gibt es keinen Preis mehr, nur den vollen FPS
von 35 €.

`parseStrasbourgTariff` liest die Stufen mit `^(\d{1,2})h(\d{2})? ?= ?(\d{1,3})(?:\.(\d{1,2}))?€$`
je `/`-Klausel und verlangt, was eine kumulierte Staffel ausmacht: Minuten
und Beträge steigen streng, kein Betrag ist null, mindestens eine volle
Stunde. Das Komma der Stadtseite steht **nicht** im Muster — eine vierte
Schreibweise im Feed soll den Datenbau anhalten, nicht still durchlaufen.

**Die Entscheidung zur Gebühr — Zürichs Weg.** `Fee` kennt keine Staffel.
Die Kosten je voller Stunde, nachgerechnet:

| Farbe | 1. Stunde | 2. Stunde | 3. Stunde | 4. Stunde | 5. Stunde | `Fee` |
| --- | --- | --- | --- | --- | --- | --- |
| rouge | 3,50 € | 4,50 € | 9,00 € | — | — | `range` 3,50–9,00 €/h |
| orange | 2,50 € | 1,00 € | 6,50 € | 7,00 € | — | `range` 1,00–7,00 €/h |
| vert | 1,00 € | 1,00 € | 2,50 € | 5,50 € | 7,00 € | `range` 1,00–7,00 €/h |

Die Spanne ist ehrlich und breit: Jede Schätzung der App liegt um den wahren
Betrag (zwei Stunden rouge: 7–18 € gegen 8 € laut Staffel; getestet), ein
Mittelwert träfe ihn nie (4 €/h in orange stimmt für keine einzige Stunde).
Die Staffel selbst steht wörtlich als Zusatzregel im Panel — mit dem Satz,
dass die letzte Stufe der FPS ist — und der Rohtext bleibt französisch in
`rawFee`. Die letzte Stufe ist die **Höchstparkdauer**: 3, 4 bzw. 5 Stunden,
belegt durch „Au-delà de N heures … FPS = 35 €" auf der Stadtseite. Was das
Modell bräuchte, um den Betrag zu treffen, steht in `docs/todo.md`: eine
Staffel an `Fee` — dieselbe Lücke wie in Paris, Toulouse und im NPR.

## Die Zeitangabe

**Kein Feld nennt Tage oder Uhrzeiten.** Die Regel steht in der Beschreibung
des Datensatzes und auf der Stadtseite (Zitate oben), stadtweit einheitlich:
Montag bis Samstag 9–19 Uhr, Sonn- und Feiertage frei. Sie steht deshalb als
Konstante `STRASBOURG_HOURS` in `core/strasbourg.ts` mit beiden Fundstellen —
wie Wiens Stundensatz aus der Verordnung, nur umgekehrt: Dort fehlte der
Betrag, hier fehlt die Zeit. Jede Zone trägt `rawHours` „laut
Datensatzbeschreibung: du lundi au samedi de 9h00 à 19h00, gratuit les
dimanches et les jours fériés (nicht am Feature)", und `freeOnHolidays: true`,
weil die Beschreibung die Feiertage ausdrücklich nennt. Ein Feld, das eines
Tages Zeiten trüge, fiele im `fixture-shape`-Test auf (die Feldmenge ist als
Gleichheit festgehalten), nicht erst im Datenbau.

Was die Konstante bewusst **nicht** trägt: die Lieferflächen des Hyper-Zentrums
(dieselbe Seite: gebührenpflichtig nur 11:30–19:00) und die „zone violette"
(Kurzparkplätze, 1 €/h, höchstens 1h30) — beides sind keine Flächen des
Datensatzes.

## Die Höchstparkdauer

Aus der letzten Stufe der Staffel: rouge 180, orange 240, vert 300 Minuten,
`maxStayMinutes` je Zone. Belegt durch die Stadtseite („Au-delà de 3 heures de
stationnement, montant du Forfait de post-stationnement (FPS) = 35 €") und
durch die Logik der Staffel selbst, die bei 17 € — dem ermäßigten FPS — endet.

## Der Schlüssel und das Quartier

Der Zonenschlüssel ist Farbe und Nummer der Besucherzone, `rouge 10`: Die
Farbe steht auf Schild und Automat, die Nummer im Feed; beides zusammen ist
eindeutig (19 Werte für 19 Flächen, im Test festgehalten). Das Panel liest
„Zone rouge 10", die Notiz nennt die deutsche Farbe und die Bewohnerparkzone.

Das Quartier kommt aus der Zehner-Einteilung der Ville de Strasbourg — die
Gliederung, die die Stadt selbst in „Mon quartier" führt (Robertsau-Wacken,
Gare-Kléber, Bourse-Esplanade-Krutenau, …). Der Katalog kennt auch Schnitte in
14, 15, 23 und 28 Quartiere und 13 bzw. 20 „quartiers élus"; die zehn sind die
gröbste und stabilste. Zugeordnet wird die Fläche dem Quartier mit den meisten
Stützpunkten, nicht dem Schwerpunkt: Opendatasofts `geo_point_2d` kann bei
einer Fläche um die Ill im Wasser oder im Nachbarquartier liegen. Sieben der
19 Flächen liegen über einer Quartiergrenze (weniger als 95 % ihrer Ränder in
einem Quartier); das Log nennt die Zahl.

## Die Gegenprobe

Jede Tarifzone nennt in `numero_zone_resident` die Bewohnerparkzone, in der
sie liegt (als **Zahl**; im Bewohnerzonen-Datensatz steht dieselbe Nummer als
**Text** — der Datenbau vergleicht über `String(…)`, und `fixture-shape` hält
beide Typen fest). Alle 19 nennen eine der 15 vorhandenen; eine Nummer, die es
dort nicht gibt, hält den Bau an, weil sie ein Zeichen für einen
umgeschnittenen Feed wäre.

## Der Probelauf

`CITY=strasbourg pnpm --filter @knoellchenfrei/ingest fetch-data` und
`… build-data-strasbourg`, 17. September 2026:

```
zones (Datei) … 93045 Bytes, 19 Features
districts (Datei) … 165865 Bytes, 10 Features
residents (Datei) … 60230 Bytes, 15 Features
  districts.geojson: 15 KB
  zones.geojson: 40 KB
19 Tarifzonen (7× orange, 5× rouge, 7× vert), 10 Quartiere, 15 Bewohnerzonen zur Gegenprobe
  — 0 ohne Quartier-Treffer, 7 über eine Quartiergrenze hinweg
Schreibweisen des Tarifs (3): 7 × orange, 7 × vert, 5 × rouge (Wortlaut oben)
Stand laut date_maj: 19 × 2026-09-03
```

Der Abruf über `fetch-data` ist byteweise derselbe wie der mit `curl`
(SHA-256 `48bf77bd…`) und derselbe wie der der Recherche vom 16. September.
`meta.json`: `zones: 19`, `districts: 10`, `absent: ['poi', 'lowEmissionZone',
'segments']` — `schedule` und `fee` stehen dort **nicht**, beides wird
ausgeliefert, die Zeiten aus der Beschreibung.

## Der Rahmen der Stadt

`reportBounds` aus der **Gemeindegrenze der Ville de Strasbourg** im Datensatz
`limites_de_communes` (33 Gemeinden der Eurométropole, Licence Ouverte v2.0,
Stand 25. August 2026; Strasbourg `num_com 482`, ein Polygon mit 2.660
Stützpunkten): 7,6880–7,8361 / 48,4919–48,6462, nach außen gerundet
7,68–7,84 / 48,49–48,65. Die 19 Tarifzonen reichen nur
7,7244–7,7836 / 48,5587–48,5940 — der Kern; Robertsau, Port du Rhin und Neuhof
liegen außerhalb der Parkebene und innerhalb der Stadt. Mittelpunkt Place
Kléber (7,7455 / 48,5834), Zoom 12 wie Frankfurt: 0,15° × 0,15°.
`sessionBounds` 7,45–8,05 / 48,3–48,85. Keine Überschneidung: Freiburg endet
bei 48,08, Karlsruhe beginnt bei 8,27. Was das Rechteck nicht trennt: **Kehl**
liegt jenseits des Rheins und im Rahmen (7,81 / 48,57) — wie Wieliczka bei
Krakau; eine Meldung von dort wird angenommen, die Karte zeigt dort nur keine
Zone. `heatGrid` mit `id: 'strasbourg'`, Ursprung 7,68 / 48,49.

## Feiertage: Bas-Rhin

`FR-67`, seit dem 16. September in `holidays.ts`: die elf nationalen „jours
fériés" nach Art. L3133-1 Code du travail (`NATIONWIDE.FR`) plus die zwei des
Alsace-Moselle-Rechts nach Art. L3134-13 — Vendredi saint und Saint-Étienne
(26. Dezember). Dreizehn Tage im Jahr 2026, in `laender.test.ts` gemessen; die
Zone im Modell kassiert am Karfreitag und am 26. Dezember nicht, am 3. Oktober
(kein Feiertag in Frankreich) schon (`strasbourg.test.ts`). Kein Stadtfeiertag
— `City.holidays` bleibt leer, das Recht hängt am Département.

## Fourrière

Belegt auf `https://www.strasbourg.eu/vehicule-fourriere-que-faire` (gelesen
am 17. September 2026), wörtlich: „La fourrière eurométropolitaine est confiée
à la Société strasbourgeoise d'Enlèvement - SEG, au 1C Rue du Doubs, 67100
Strasbourg. Accueil 24h/24h et 7j/7j – Téléphone : 03 90 40 14 00" und
„121,27 € d'enlèvement, 6,42 € de gardiennage par tranche de 24 heures
commencée". Ohne „mainlevée" (Freigabe der Polizei oder aus dem Online-Dienst
des Innenministeriums) gibt die Fourrière kein Fahrzeug heraus — das steht in
`note`. Die Seiten `/fourriere`, `/fourriere-vehicules` antworten 404; die
richtige Adresse fand die Websuche.

## Was einzutragen bleibt

Nichts — alles ist in diesem Zweig eingetragen. Die Stellen, die beim
Zusammenführen Konflikte machen können:

| Datei | Eintrag |
| --- | --- |
| `app/packages/core/src/city.ts` | `STRASBOURG` und `CITIES` |
| `app/packages/core/src/index.ts` | `export * from './strasbourg.js'` |
| `app/packages/ingest/src/sources.ts` | `odsExportUrl`, `STRASBOURG_FILES`, `FILES_BY_CITY`, `strasbourg: []` in `BY_CITY` |
| `app/packages/ingest/package.json` | `build-data-strasbourg` |
| `app/packages/core/test/{city,fixture-shape,fuzz}.test.ts` | je ein Block; in `city.test.ts` dazu die Lizenz-Adresse in `NUTZUNGSBEDINGUNGEN_WIE_CC_BY` |
| `app/packages/ingest/test/quellen.test.ts` | Block „cityFiles für Straßburg", `odsExportUrl` im Import |
| `app/apps/web/statistik/main.ts` | `STADTNAMEN.strasbourg` |
| `NOTICE`, `README.md`, `docs/staedte.md`, `docs/data-sources.md`, `docs/todo.md`, `CLAUDE.md` | je eine Zeile bzw. ein Abschnitt |
| erzeugt | `core/src/zone-keys.generated.ts`, `core/src/zone-units.generated.ts`, `apps/api/src/zone-units.generated.json` |

Die Stadtlisten in `deploy.yml`/`kacheln.yml` und die Tests `flaechenpunkt`,
`quellen`, `zone-units` kommen aus `CITIES`. Nicht angefasst, wie vereinbart:
`index.html`, `manifest.webmanifest`, `login-page.ts`.

## Was offen bleibt

1. **Die Zeiten von der Stadt bestätigen lassen.** Sie stehen nur in der
   Beschreibung und auf der Stadtseite. Rückfrage an das Open-Data-Team der
   Eurométropole über das Kontaktformular des Portals, ob die Zeiten als
   Feld ins Schema kommen — dann liest der Parser sie, statt sie zu wissen.
2. **Eine Staffel im Modell.** Die Spanne ist ehrlich, aber breit (orange:
   1,00–7,00 €/h, zwei Stunden 2–14 € statt 3,50 €). `Fee` bräuchte
   `steps: [{ minutes, cents }]`; das bediente auch Paris, Toulouse und das
   NPR. Bis dahin steht die Staffel wörtlich im Panel.
3. **Die ZFE-m.** `zfe_emprise` (7 Polygone, Licence Ouverte v2.0) ist die
   Crit'Air-Zone der ganzen Eurométropole, keine deutsche Umweltzone; die
   Oberfläche kann heute nur die grüne Plakette erklären. Erst dann als
   `umweltzone.geojson`.
4. **Die Fassung der Lizenz.** Der Datensatz nennt 1.0, sein Nachbar
   (Bewohnerzonen) 2.0. Eine Nachfrage, ob die Stadt den Tarifzonen-Datensatz
   auf 2.0 hebt, kostet einen Satz; an den Auflagen ändert es nichts.
5. **Stellplätze.** `vo_st_stationmnt_vehi` führt 26.851 Stellplatzreihen der
   Eurométropole mit `occupation` (payant 6.558, gratuit 14.717, livraison
   597, …) und `nbre_places`, aber ohne Tarif und Zeit; 16.123 davon in
   Strasbourg. Als `spaces` je Zone wäre das ein Punkt-in-Polygon über die
   Reihen — der nächste Schritt, wenn jemand die Zahl braucht.

## Prüfstand

Am 17. September 2026 in diesem Worktree grün: `pnpm -r typecheck`,
`pnpm test` (core 1630, api 101, ingest 124, web 324),
`./scripts/sprache-pruefen.sh`, `node scripts/doku-pruefen.mjs`,
`./scripts/namen-pruefen.sh`, `./scripts/commit-pruefen.sh`. E2E-Suite und
Kachelbau laufen zentral.

## Dateien

| Datei | Inhalt |
| --- | --- |
| `app/packages/core/src/strasbourg.ts` | Staffelparser, Kosten und Stundensätze, `strasbourgFee`, `strasbourgMaxStay`, `strasbourgUnmodelledRules`, Farbe, Schlüssel, `STRASBOURG_HOURS`, Rohfeldtypen |
| `app/packages/core/test/strasbourg.test.ts` | Parser gegen jede der drei Schreibweisen und gegen Unfug, die Staffel nachgerechnet, der echte Abzug, eine Zone im Modell gegen `FR-67`, die Stadt |
| `app/packages/core/test/fixtures/sxb-stationnement-payant-2026-09-17.json` | alle 19 Flächen, Sachdaten wörtlich, Zählung, erster Stützpunkt |
| `app/packages/core/test/fixtures/sxb-quartiers-2026-09-17.json` | alle 10 Quartiere |
| `app/packages/core/test/fixtures/sxb-residant-2026-09-17.json` | alle 15 Bewohnerzonen |
| `app/packages/ingest/src/build-data-strasbourg.ts` | Datenbau: Quartiere, Gegenprobe, Zonen mit Staffel und Zeiten aus der Beschreibung, fünf Ausgabedateien |
| `app/apps/web/public/data/strasbourg/` | der Abzug |
