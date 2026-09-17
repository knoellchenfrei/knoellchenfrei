# Die Niederlande als Land — sechs Städte aus einer Quelle, gemessen, entschieden, offen

> **Stand 17. September 2026.** Utrecht, Den Haag, Rotterdam, Groningen,
> Nijmegen und Eindhoven sind angeschlossen — alle aus dem **Nationaal
> Parkeer Register (NPR)** der RDW, „Open Data Parkeren" auf
> `opendata.rdw.nl`, CC0, täglich. Ein Parser (`core/src/npr.ts`), ein
> Datenbau (`ingest/src/build-data-npr.ts`, Stadt als `CITY`), sechs
> `City`-Konstanten. Was fehlt: Amsterdam und Maastricht (Geometrie
> unvollständig, siehe unten), die Vergunninggebiete (kein Besuchertarif in
> der Quelle), und ein Beleg für die Abschleppstelle in vier der sechs Städte.

## Die Quellen

| | NPR (Parkdaten) | CBS Wijken (Stadtteile) | Gemeentegebied (nur zum Messen) |
| --- | --- | --- | --- |
| Art | Socrata/SODA, acht Tabellen | WFS 2.0.0 (PDOK) | WFS 2.0.0 (PDOK) |
| Adresse | `https://opendata.rdw.nl/resource/<id>.json?$where=areamanagerid='344'&$limit=50000&$order=:id` | `https://service.pdok.nl/cbs/wijkenbuurten/2024/wfs/v1_0`, `wijkenbuurten:wijken`, OGC-Filter `gemeentecode = GM0344` | `https://service.pdok.nl/kadaster/bestuurlijkegebieden/wfs/v1_0`, `bestuurlijkegebieden:Gemeentegebied` |
| Tabellen | GEBIED `adw6-9hsg`, GEOMETRIE GEBIED `nsk3-v9n7`, GEBIED REGELING `qtex-qwd8`, REGELING `yefi-qfiq`, TIJDVAK `ixf8-gtwq`, TARIEFDEEL `534e-5vdg`, TARIEFBEREKENING `nfzq-8g7y`, SPECIALE DAG `hpi4-mynq` | — | — |
| Umfang (alle Fassungen) | Utrecht 496/362/760/56/1112/343/38/102 · Den Haag 515/239/804/198/2866/119/44/0 · Rotterdam 360/243/688/132/5425/196/43/411 · Groningen 235/74/342/82/1076/104/39/22 · Nijmegen 89/58/168/66/1364/108/48/74 · Eindhoven 328/328/372/101/990/261/44/44 | 10 / 45 / 22 / 20 / 9 / 20 Wijken | 1 MultiPolygon je Gemeinde |
| Inhalt | Gebiete mit Nutzungszweck, Regelung je Gebiet, Zeitfenster je Tagestyp, Tarifstaffel je Code, Feiertagskalender je Gemeinde | `wijknaam`, `gemeentecode`, `water` | `bbox` |
| Lizenz | Metadatenfeld jeder Tabelle: `Licentie: Creative Commons 0 (CC0)` (`/api/views/metadata/v1/<id>` → `customFields.Licentie.Licentie`); die Socrata-Felder `license`, `attribution` sind leer | `ows:AccessConstraints`: `https://creativecommons.org/publicdomain/zero/1.0/deed.nl` — CC0 | `ows:AccessConstraints`: CC BY 4.0 — nur zum Messen der Rahmen benutzt, nichts davon ausgeliefert |
| Aktualität | `dataUpdatedAt` 2026-09-16T03:21 UTC (GEBIED), täglich | Jahrgang 2024 | — |

Alle Abrufe am 17. September 2026 zwischen 18:17 und 18:35 UTC. Die
Zeilenzahlen oben sind die Messlatte `expectedFeatures` in `sources.ts`; sie
sinken nie, weil alte Fassungen im Register stehen bleiben.

**Warum `source` unsere Formulierung ist:** Das NPR verlangt unter CC0 keine
Nennung, und das Socrata-Feld `attribution` ist bei allen acht Tabellen leer.
`City.attribution.source` lautet deshalb `RDW — Nationaal Parkeer Register
(NPR), Open Data Parkeren, opendata.rdw.nl` — der Herausgeber, der
Registername und der Ort, so wie die Tabellen selbst heißen („Open Data
Parkeren: GEBIED"). Der Bericht vom 16. September nennt dieselbe Quelle.

## Die Eigenheit, die alles bestimmt: ein Sternschema mit Gültigkeit

Das NPR ist kein Feed mit Sätzen, sondern eine Datenbank. Sieben Tabellen
hängen über `areamanagerid` (= CBS-Gemeindecode ohne führende Nullen)
zusammen, und **jede Zeile trägt Anfang und Ende**:

```
GEBIED ──── GEBIED REGELING (usageid) ──── REGELING (Typ B/A)
  │                                            │
GEOMETRIE GEBIED (WKT)                     TIJDVAK (daytimeframe, uumm, farecalculationcode, maxdurationright)
                                               │
                                           TARIEFDEEL (Staffel) ── TARIEFBEREKENING (Klartext)
SPECIALE DAG (Datum → Tagestyp, je Gemeinde)
```

Drei Datumsformate nebeneinander, gemessen: `20150501` (GEBIED, REGELING,
TARIEF*, SPECIALE DAG), `20150501000000` (GEBIED REGELING, TIJDVAK) und ISO
`2015-05-01T00:00:00.000` (GEOMETRIE). Ein offenes Ende ist `29991231`,
`2099-01-01` oder das Feld fehlt (Den Haag, Groningen, Nijmegen: `enddatearea`
bei allen Geometrien abwesend). `nprDateKey` liest alle drei auf `JJJJMMTT`,
`nprValidOn` filtert am **Stichtag** — dem Tag des Abrufs, nicht des Baus,
damit ein Neubau aus demselben Abzug dieselben Dateien ergibt.

Wie viel davon heute gilt (Stichtag 17. September 2026):

| | TIJDVAK gesamt | gültig | GEBIED REGELING gültig | Fassungen mit Start in der Zukunft |
| --- | --- | --- | --- | --- |
| Utrecht | 1.112 | 395 | 425 | 7 (Gebiet 21400 mit REG08 ab 1. November 2026) |
| Den Haag | 2.866 | 863 | 227 | 0 |
| Rotterdam | 5.425 | 1.341 | 318 | 0 |
| Groningen | 1.076 | 418 | 176 | 0 |
| Nijmegen | 1.364 | 466 | 92 | 0 |
| Eindhoven | 990 | 340 | 257 | 0 |

**Die Gültigkeit wird im Datenbau gefiltert, nicht in `$where`.** Der Abzug
trägt alle Fassungen, auch die künftige Utrechter; der Bau entscheidet am
Tag des Laufs. Ein schon gefilterter Abzug ließe sich nicht nachprüfen, und
die Utrechter Änderung vom 1. November würde am 1. November von selbst
wirksam — der Deploy baut täglich.

Vier Socrata-Fallen, alle in `sources.ts` festgehalten: ein einfacher Filter
(`?areamanagerid=363`) **zusammen** mit `$where` lieferte Zeilen anderer
Gemeinden — alles steht in `$where`; ohne `$limit` kommen 1.000 Zeilen ohne
Hinweis; `$limit` ist auf 50.000 begrenzt, deshalb hängt `fetch.ts` `$offset`
an und holt weiter, bis eine Seite kürzer ist (`FileSource.paginate`);
`$order=:id` macht die Seiten stabil. Eine leere Tabelle ist erlaubt — Den
Haag führt keine SPECIALE DAG —, deshalb gilt die 1.000-Byte-Schranke der
anderen Dateien für paginierte nicht; gezählt wird gegen `expectedFeatures`.

## Entscheidung 1: Was ist eine Zone?

**Ein Gebiet mit Nutzungszweck `BETAALDP` (betaald parkeren), gültiger
Geometrie und genau einer Basisregelung (Typ B).** Gemessen, gültig am
Stichtag:

| | BETAALDP | davon mit Geometrie | Basisregelung genau eine | VERGUNP (mit Geometrie) | BEZOEKP | GARAGEP | PARKRIDE | weitere |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Utrecht | 67 | 66 | 66 | 85 (78) | 68 | 0 | 11 | VERGUNZ 89, PARKEREN 30, ONTHEFF 13, GPKB 2, DEELAUTOP 1, MILIEUZONE 1, ZE_ONTHEF 1 |
| Den Haag | 92 | 88 | 88 | 109 (94) | 0 | 8 | 3 | DEELAUTOP 3, GSL_ONTHEF 3, MILIEUZONE 2, SIGNALEREN 1, ZE_ONTHEF 1 |
| Rotterdam | 131 | 124 | 124 | 2 (2) | 114 | 3 | 20 | PARKEREN 42, DEELAUTOP 4, CARPOOL 1, ZE_ONTHEF 1 |
| Groningen | 41 | 39 | 39 | 76 (26) | 0 | 13 | 5 | ONTHEF 39, ZE_ONTHEF 1 |
| Nijmegen | 29 | 29 | 29 | 0 | 0 | 8 | 5 | DEELAUTOP 20, RUNUMC 18, TERREINP 6, BLAUWEZN 1, CARPOOL 1, ZE_ONTHEF 1 |
| Eindhoven | 14 | 13 | 13 | 164 (160) | 0 | 1 | 0 | DEELAUTOP 47, GPK 13, GVVG 8, PARKEREN 2, MILIEUZONE 1, ZE_ONTHEF 1 |

Die Basisregelung ist eindeutig: In keiner Stadt hat ein BETAALDP-Gebiet
zwei Regelungen vom Typ B; 19 Utrechter, 5 Haager, 1 Groninger, 3 Nijmegener
und 6 Eindhovener Gebiete tragen daneben Zusatzregelungen (Typ A: Dagkaart,
Avondkaart, Dagtarief) — Produkte, keine Pflicht, und deshalb nicht die
Zone. Hätte ein Gebiet zwei Basisregelungen, bricht der Bau ab.

**Vergunninggebiete (`VERGUNP`) bleiben draußen, und das ist die Stelle, an
der der Vorschlag vom 16. September nicht hielt.** Er lautete: mitnehmen,
wo sie Zeitfenster *und* Tarif für Besucher tragen — der Eindhoven-Fall. Die
Messung sagt: Eindhovens 160 Vergunninggebiete mit Geometrie tragen 1.279
gültige Zeitfenster (`900–2100` oder `0–2400`) und **kein einziges** trägt
einen `farecalculationcode`; dasselbe in Utrecht (532 Fenster, 0 Codes) und
Groningen (182 Fenster, 0 Codes). Ein Fenster ohne Tarif heißt im NPR: Ein
Recht ist erwerbbar (Vergunning), aber nichts zu zahlen — für den Inhaber.
Für einen Besucher ist die Aussage „hier darf nur mit Vergunning geparkt
werden", und die kann diese App heute nicht ausdrücken: `fee: unknown`
hieße „Betrag nicht in den Daten" über einer Fläche, die gar keinen hat.
Deshalb ausgelassen, gezählt, und unter „Was offen bleibt" als der
gewichtigste Punkt — in Eindhoven ist fast die ganze Stadt Vergunninggebiet.

`BEZOEKP` (Bezoekersregeling), `GARAGEP`, `PARKRIDE`, `DEELAUTOP`, `GPK`
und die übrigen sind keine Straßenzonen für Besucher; `PARKEREN` (Rotterdam
42, Utrecht 30) sind Terreine und Garagen ohne Straßenbezug. Alle stehen im
Log des Datenbaus.

**Mehrere Flächen je Gebiet.** Die Geometrie-Tabelle führt je Gebiet
mehrere gültige Zeilen — Den Haag `D2` 20, Rotterdam `Zone_3` 16, Eindhoven
`A11` 17 —, jede ein eigenes Polygon. Der Bau schreibt je Zeile eine
Fläche mit dem Gebietsschlüssel als `zone`, wie Hamburgs Stücke;
`loadZones` nummeriert sie. Rotterdam liefert daneben 9 MultiPolygone.

## Entscheidung 2: Der Tarif ist eine Staffel

Ein `farecalculationcode` hat ein bis acht Tarifteile: `amountfarepart` je
`stepsizefarepart` Minuten von `startdurationfarepart` bis
`enddurationfarepart` (offen = `999999`). `parseNprFare` rechnet die Staffel
mit angefangenen Schritten durch und nimmt die Kosten der ersten, zweiten
und dritten Stunde:

- **alle drei gleich** → `exact` (Utrecht `TAR03` 0,089 €/min = **5,34 €/h**,
  Rotterdam `TAR01` 1,07 € je 10 min = 6,42 €/h, Den Haag `300`
  0,04583333 €/min = 2,75 €/h — der Rundungsrest verschwindet im Cent);
- **verschieden** → `range` über die Stunden, die etwas kosten (Eindhoven
  `TAR01` „0,30 starttarief, 4,50 per uur": 4,80 / 4,50 / 4,50 →
  **4,50–4,80 €**; Rotterdam `TAR05` „Stop en Shop": 1,32 / 2,24 / 2,24;
  Groningen `TAR09` „Eerste 90 minuten 0,50": 0,33 / 1,52 / 2,70; Den Haag
  `PROG1`: 25 / 55 / 60 €);
- **alle Teile 0** → `free`: kein Fenster, kein Betrag (Rotterdam `TAR04`
  Nultarief 133 Fenster, Groningen `TAR06` Gratis 80, Nijmegen `TAR00` 58,
  Eindhoven `TAR00` 2);
- **erster Schritt ≥ 180 Minuten** → `flat`, eine Pauschale: `range` vom
  Durchschnitt je Stunde bis zum ganzen Schritt (Nijmegen `TAR05` „1,00 per
  3 uur" → 0,33–1,00 €; Eindhoven `TAR06` „B4: 22,55 per dag" → 1,52–22,75 €
  — die Quelle schreibt 22,55 in den Text und 22,75 in die Zahl).

Eine Stunde, die nichts kostet, fällt aus der Spanne heraus: Eine Spanne ab
0 wäre der Nullbetrag, den dieses Projekt nirgends ausliefert. Mehrere Codes
in einer Zone (Den Haag samstags `PROG2`, werktags `300`) werden zu einer
Spanne (`mergeNprFees`). `rawFee` trägt den Klartext der Quelle und das
Ergebnis: „kortparkeertarief gebied 3 — 5,34 €/h", „A1: 0,30 starttarief,
4,50 per uur (2026) — 1. Stunde 4,80 €, 2. Stunde 4,50 €, 3. Stunde 4,50 €".

Alle Tarifklassen der Basisregelungen, gezählt über die Fenster:

| Stadt | Codes in Basisregelungen | linear | gestaffelt | frei | Pauschale |
| --- | --- | --- | --- | --- | --- |
| Utrecht | TAR01 8,01 · TAR02 6,94 · TAR03 5,34 | 3 | — | — | — |
| Den Haag | 100/200/600 7,15 · 211/300/TAR275PU 2,75 · 700 4,95 · PROG1 · PROG2 | 7 | 2 | — | — |
| Rotterdam | TAR01 6,42 · TAR02 3,20 · TAR03 2,24 · TAR04 · TAR05–TAR08 | 3 | 4 | 1 | — |
| Groningen | TAR00 5,00 · TAR01 4,50 · TAR02 2,70 · TAR06 · TAR09 · TAR10 | 3 | 2 | 1 | — |
| Nijmegen | TAR01 2,90 · TAR02 2,60 · TAR03/TAR14 4,00 · TAR04 0,50 · TAR00 · TAR05 · TAR06 | 5 | 1 | 1 | 1 |
| Eindhoven | TAR08/09/11 2,10 · TAR01/04/05/07/10/12 · STRIJP01 · TAR00 · TAR06 | 3 | 7 | 1 | 1 |

## Entscheidung 3 und 4: Tagestypen und Fenster

Ein Fenster ist `daytimeframe` + `starttimetimeframe`/`endtimetimeframe`
als `uumm`: `0`, `900`, `1130`, `930`, `2400`, und in Den Haag `1` (00:01)
und `202` (02:02) an Zusatzregelungen. `2400` ist Minute 1440, nie 0.
**Fenster reichen nie über Mitternacht** — was Hamburg als „täglich 9-2 Uhr"
schreibt, steht hier als zwei Zeilen: `VRIJDAG 900–2400` und `ZATERDAG
0–100`. Der Parser prüft nur, dass Anfang vor Ende liegt; aufteilen muss
er nichts. Alle Zeiten der Basisregelungen, gezählt:

| Stadt | (Start, Ende) und Anzahl |
| --- | --- |
| Utrecht | 600–1100 127 · 900–2100 116 · 900–2300 84 · 0–100 30 · 700–2400 30 · 900–1800 11 · 900–1400 5 · 1200–1800 5 · 1800–2100 1 |
| Den Haag | 1800–2400 192 · 900–2400 174 · 1000–2400 106 · 900–1700 46 · 1300–2400 29 · 1000–1800 18 · 900–1400 15 · 0–200 14 · 900–1800 10 · 1000–2000 7 · 2000–2400 7 · 1000–1700 6 · 900–1900 4 · 1900–2400 4 · 1300–1800 1 · 1700–2100 1 |
| Rotterdam | 900–2300 658 · 1200–2300 234 · 0–2400 133 · 900–1500 51 · 1500–2300 50 · 0–100 17 · 900–1800 17 · 900–2400 16 · dazu 48 seltene Paare der Ereignistage (1200–1815, 1330–2015 …) |
| Groningen | 900–1900 109 · 900–2400 104 · 0–2400 89 · 1200–1700 18 · 900–1800 10 · 900–2000 2 |
| Nijmegen | 900–1800 56 · 0–2400 50 · 900–2300 42 · 1200–1800 38 · 900–1600 25 · 900–2100 22 · 1800–2100 22 · 2100–2400 9 · 0–900 8 · 0–1800 1 |
| Eindhoven | 900–2100 56 · 900–1800 18 · 900–2400 7 · 800–1000 5 |

Die Tagestypen: `MAANDAG…ZONDAG` werden Wochentage. Alles andere teilt
`nprDayKind` in **Feiertagstypen** (`FEESTDAG`, `FEESTDAG 2E`,
`ZONFEESTDAG`, `FEEST GRAT`, `FEEST ZOND`, `1E/2E KERSTDAG`, `1E/2E
PAASDAG`, `1E PINKSTERDAG`, `2E PINKERSTERDAG` — der Tippfehler steht so
35-mal in Rotterdam —, `HEMELVAARTSDAG`, `KONINGSDAG`, `NIEUWJAARSDAG`,
`BEVRIJDINGSDAG`) und **Ereignistypen** (`VOETBAL1200…VOETBAL2100`, 19
Anstoßzeiten; `AHOY_MAANDAG…AHOY_ZONDAG`, `AHOY900_*`; `EVENEMENT`,
`OPENDAG`, `MONSTERJAM`, `VB2045NATL`, `KOOPZONDAG`, `KOOPAVOND`). Rotterdam
führt 37 Sorten, 48 der 1.341 gültigen Fenster sind Ereignisfenster. Sie
werden **genannt, nicht gerechnet**: `unmodelledRules` bekommt „Ereignistage
laut Quelle mit eigenen Zeiten, hier nicht gerechnet: AHOY… (7 Sorten)" — in
Rotterdam zwei Flächen (die Ahoy-Gebiete), in Nijmegen eine (Koopavond). Die
großen Zentrumszonen Rotterdams tragen die VOETBAL-Typen nur in
Zusatzregelungen, nicht in ihrer Basisregelung; der Kalender dafür steht in
SPECIALE DAG (2026: 24 Feyenoord-Termine).

## Entscheidung 5: Feiertage gegen die Quelle

Der Kalender liegt in den Daten: SPECIALE DAG sagt je Gemeinde, an welchem
Datum welcher Tagestyp den Wochentag ersetzt; TIJDVAK sagt, was an diesem
Typ gilt. Und die RDW schreibt in die Beschreibung von TIJDVAK: „Voor die
gedeelten van het etmaal waarvoor geen tijdvak is, geldt dat volgens de
regeling het recht geen tarief heeft." Kein Fenster heißt frei. Daraus
folgt die Lesart des Datenbaus, für jeden Feiertag aus `holidaysFor(land,
2026)`:

- Gemeinde führt **keinen** Sondertag für das Datum → es gilt der Wochentag
  (`wochentag`, falls der Fenster hat; sonst `frei`);
- Sondertag ohne Fenster mit Tarif → `frei`;
- Sondertag mit denselben Fenstern wie der Wochentag → `wochentag`;
- Sondertag mit anderen Fenstern → `anders` (Rotterdams `FEEST ZOND`: die
  Sonntagszeiten an einem Montag — das Modell kann es nicht ausdrücken).

Ist nicht jeder Feiertag `frei`, trägt die Zone `freeOnHolidays: false`
(neu im Web-Typ `ZoneProperties`, `toParkingZone` reicht es durch) und einen
Satz in `unmodelledRules`, z. B. „Feiertage 2026 laut Quelle: frei am
01.01., 25.12.; gebührenpflichtig wie am Wochentag am 26.12.; mit eigenen
Zeiten (hier nicht gerechnet) am 06.04., 27.04., 14.05., 25.05." Gezählt:

| Stadt | SPECIALE DAG 2026 | Zonen mit `freeOnHolidays: false` | frei laut Quelle, dem Kalender unbekannt |
| --- | --- | --- | --- |
| Utrecht | keine (letzte Zeile 2022) | 68 von 68 — jeder Feiertag wie der Wochentag | — |
| Den Haag | keine (Tabelle leer) | 93 von 93 | — |
| Rotterdam | 38: FEEST GRAT 1.1., 5.4., 24.5., 25.12.; FEEST ZOND 6.4., 27.4., 14.5., 25.5. und 9 weitere (17.2., 4.3., 20.3., 5.5., 18.5., 27.5., 25.7., 5.9., 12.9.); 24 VOETBAL, EVENEMENT 18.7. | 148 von 149 — 26.12. fehlt in der Quelle; eine Fläche ohne Samstag bleibt frei | 5.4. und 24.5. (Oster-, Pfingstsonntag, in 119 Flächen mit Sonntagsfenster); die neun FEEST-ZOND-Tage in 5 Flächen ohne Sonntagsfenster |
| Groningen | 9: FEESTDAG 1.1., 5.4., 24.5., 25.12.; FEESTDAG 2E 3.4., 6.4., 14.5., 25.5., 26.12. | 42 von 42 — **Koningsdag (27.4.) fehlt in der Quelle** | 3.4. (Goede Vrijdag, 38 Flächen); 5.4., 24.5. in 20 Flächen mit Sonntagsfenster |
| Nijmegen | 3: FEESTDAG 1.1., 25.12.; ZONFEESTDAG 26.12. | 31 von 31 — 2e Paasdag, Koningsdag, Hemelvaart, 2e Pinksterdag fehlen | — |
| Eindhoven | keine (letzte Zeile 2022) | 71 von 71 | — |

**Kein Eintrag in `City.holidays`.** Der einzige feste Tag, den eine Gemeinde
frei gibt und der Kalender nicht kennt, ist Rotterdams 5. Mai — als `FEEST
ZOND`, also mit Sonntagszeiten, und die sind in 119 Flächen ein Zahltag.
Groningens Goede Vrijdag ist beweglich und passt nicht in `MM-TT`; er steht
als „Zusätzlich frei laut Quelle 2026: 03.04." an 38 Flächen. **Der
Abgleich läuft nur über das laufende Jahr:** Rotterdam und Groningen haben
am 17. September keinen Tag für 2027 eingetragen; ein Kalender, der 2027
mitzählte, hielte jede Zone bis Dezember für „kassiert an Neujahr". Der Bau
läuft täglich und zählt im Januar das neue Jahr.

Was das für Utrecht und Den Haag heißt, ist bemerkenswert und steht so in
den Daten: An Koningsdag 2026 (Montag) gilt der Montag. Ob die Gemeinden
das so meinen oder nur nicht pflegen, weiß die Quelle nicht — die Antwort,
die die App gibt, ist die vorsichtige: zahlen.

## Entscheidung 6: Gültigkeit — siehe oben

Alle sieben Tabellen mit Start/Ende gefiltert, drei Formate, offenes Ende
`29991231`/`2099-01-01`/fehlend, Stichtag = Abrufdatum, künftige Fassungen
nicht. Ein Ende **am** Stichtag zählt als vorbei (so beginnen im NPR die
Nachfolgefassungen).

## Entscheidung 7 und 8: Stadtteile und Rahmen

**Stadtteile** aus den CBS-Wijken 2024 über PDOK — der Dienst geht von hier,
Lizenz CC0 in den Capabilities. Je Gemeinde ein OGC-Filter auf
`gemeentecode` (`Source.filter`, neu in `sources.ts`). Das Präfix `Wijk 01 `
fällt weg; die Wijken „Groot water" (Den Haag, Rotterdam, `water: JA`)
werden ausgelassen. Jede Fläche bekommt das Wijk ihres Schwerpunkts; eine
Haager Fläche liegt in keinem (Strand) und heißt „Den Haag".

**Rahmen** aus der `bbox` des `Gemeentegebied` (PDOK Bestuurlijke Gebieden,
CC BY 4.0 — nur gemessen, nicht ausgeliefert):

| Stadt | bbox der Gemeinde | `reportBounds` | Anmerkung |
| --- | --- | --- | --- |
| Utrecht | 4.9701, 52.0263 – 5.1952, 52.1421 | 4.97, 52.02 – 5.20, 52.15 | |
| Den Haag | 4.1850, 52.0148 – 4.4225, 52.1350 | 4.18, 52.01 – 4.43, 52.14 | Südkante 52,01, nicht 52,00 |
| Rotterdam | 3.9407, 51.8421 – 4.6018, 52.0045 | 3.94, 51.84 – 4.61, **52.00** | Nordkante geschnitten: 500 m Dünen nördlich von Hoek van Holland bleiben draußen, keine Parkzone dort |
| Groningen | 6.4627, 53.1062 – 6.7725, 53.3130 | 6.46, 53.10 – 6.78, 53.32 | |
| Nijmegen | 5.7576, 51.7906 – 5.9083, 51.8946 | 5.75, 51.79 – 5.91, 51.90 | |
| Eindhoven | 5.3567, 51.4000 – 5.5489, 51.4971 | 5.35, 51.39 – 5.55, 51.50 | |

Rotterdam und Den Haag grenzen bei Hoek van Holland fast aneinander (1,1 km
zwischen den Kanten); `city.test.ts` prüft jedes Paar auf Überschneidung
und gibt Hoek van Holland Rotterdam, Kijkduin und Scheveningen Den Haag.

## Entscheidung 9: Abschleppstelle

Belegt in **Utrecht** (utrecht.nl, „Wegslepen auto": „Bergings Combinatie
Utrecht (BCU) … Elektronweg 24, 3542 AC UTRECHT … 030 - 241 5060 (keuze
1)") und **Rotterdam** (rotterdam.nl, „Uw voertuig is weggesleept": „Bel dan
met de gemeente Rotterdam via telefoon 14 010", „Vreugdenhil Berging B.V.
Aploniastraat 20, 3084 CC Rotterdam Telefoon: 015 251 13 51"). Den Haag,
Groningen und Nijmegen antworten aus dieser Umgebung mit 403 (Bot-Schutz),
Eindhovens Seite fand sich nicht — die vier stehen in `OHNE_BELEG`.

## Der Probelauf

`CITY=<stadt> pnpm --filter @knoellchenfrei/ingest fetch-data`, dann
`build-data-npr`, am 17. September 2026:

| Stadt | Zonen | Flächen | ausgelassen | Fenster ohne Betrag | Spanne / Pauschale | Stadtteile |
| --- | --- | --- | --- | --- | --- | --- |
| Utrecht | 66 von 67 | 68 | 1 ohne Geometrie | 0 | 0 / 0 | 10 |
| Den Haag | 88 von 92 | 93 | 4 ohne Geometrie | 0 | 6 / 0 | 44 (+1 Wasser) |
| Rotterdam | 124 von 131 | 149 | 7 ohne Geometrie | 133 Nultarif | 42 / 0 | 21 (+1 Wasser) |
| Groningen | 39 von 41 | 42 | 2 ohne Geometrie | 80 Gratis | 7 / 0 | 20 |
| Nijmegen | 29 von 29 | 31 | — | 58 Gratis, 2 nicht erwerbbar | 4 / 1 | 9 |
| Eindhoven | 13 von 14 | 71 | 1 ohne Geometrie | 2 Gratis | 8 / 1 | 20 |

Zeiten laut Quelle, die häufigsten: Utrecht „Mo–Fr 6–11 Uhr" (24), „Mo–Sa
9–21 Uhr" (17); Den Haag „Mo–So 18–24 Uhr" (21), „Mo–Sa 9–24, So 18–24 Uhr"
(15); Rotterdam „Mo–Sa 9–23, So 12–23 Uhr" (121); Groningen „Mo–Sa 9–24, So
12–17 Uhr" (16); Nijmegen „Mo–Mi 9–18, Do 9–21, Fr, Sa 9–18 Uhr" (9);
Eindhoven „Mo–So 9–21 Uhr" (63). Höchstparkdauer aus `maxdurationright`:
Den Haag 14 Zonen 120 min, 3 × 30, 3 × 180, eine mit 120/240 nebeneinander;
Groningen 15 × 120, 3 × 60; Nijmegen 2 × 30, 1 × 180; Rotterdam und
Eindhoven je eine mit 120; Utrecht eine mit 180/540. Keine Stellplatzzahlen
(die Tabelle SPECIFICATIES PARKEERGEBIED gilt Terreinen und Garagen), keine
Umweltzone, keine POI — `meta.absent`.

## Amsterdam und Maastricht: nicht angeschlossen

**Amsterdam** (363): 159 BETAALDP-Gebiete, davon **nur 30 mit Geometrie**
(Bericht vom 16. September); die Straßenzonen liegen in der Stadtkarte
`tarieven.json` (29 Tarifgebiete) unter einer anderen, an der Datei nicht
ausgewiesenen Lizenz. Das NPR allein zeigte ein Fünftel der Stadt und sagte
über den Rest nichts — ein Abzug, der wie eine Auskunft aussieht und keine
ist. **Maastricht** (935): 84 Geometrien, BETAALDP ohne Geometrie
(`FEESTDAG GEDEELTLIJK` als Tagestyp zeigt, dass die Regeln da sind). Beide
lohnen eine Anfrage an die RDW bzw. die Stadt, nicht einen Rückfall.

## Was einzutragen bleibt

Nichts — alles ist in diesem Zweig eingetragen. Zur Übersicht die Stellen, die
beim Zusammenführen Konflikte machen können:

| Datei | Eintrag |
| --- | --- |
| `app/packages/core/src/city.ts` | `NPR_ATTRIBUTION`, `UTRECHT`, `DENHAAG`, `ROTTERDAM`, `GRONINGEN`, `NIJMEGEN`, `EINDHOVEN`, `CITIES` |
| `app/packages/core/src/index.ts` | `export * from './npr.js'` |
| `app/packages/ingest/src/sources.ts` | `Source.filter`, `pdokWijken`, sechs `BY_CITY`-Einträge, `FileSource.paginate`, `NPR_TABLES`, `nprFiles`, `NPR_AREA_MANAGERS`, sechs `FILES_BY_CITY`-Einträge |
| `app/packages/ingest/src/fetch.ts` | `holeSeiten` für paginierte Dateien |
| `app/packages/ingest/package.json` | `build-data-npr` |
| `app/apps/web/src/types.ts`, `useZoneStatus.ts` | `ZoneProperties.freeOnHolidays`, Durchreichen |
| `app/packages/core/test/{city,fixture-shape,fuzz}.test.ts`, `ingest/test/quellen.test.ts`, `apps/web/test/stadtfeiertage.test.ts` | je ein Block; `OHNE_BELEG` um vier Städte |
| `app/apps/web/statistik/main.ts` | sechs `STADTNAMEN` |
| `NOTICE`, `README.md`, `docs/staedte.md`, `docs/data-sources.md`, `docs/todo.md`, `CLAUDE.md` | je eine Zeile bzw. ein Abschnitt |
| erzeugt | `core/src/zone-keys.generated.ts`, `core/src/zone-units.generated.ts`, `apps/api/src/zone-units.generated.json` |

Nicht angefasst, wie vereinbart: `index.html`, `manifest.webmanifest`,
`login-page.ts`, `deploy.yml`, `kacheln.yml` (Stadtlisten aus `CITIES`).

## Was offen bleibt

1. **Vergunninggebiete.** In Eindhoven sind 160 von 173 Gebieten mit
   Geometrie Vergunninggebiete mit Fenstern (`900–2100`) und ohne Tarif; in
   Utrecht 78, Den Haag 94, Groningen 26. Die App sagt dort heute
   „außerhalb der Zonen", und das ist für einen Besucher die falsche Antwort
   — nicht „gebührenfrei", sondern „nur mit Vergunning". Der Weg: eine
   dritte Zonenart neben Gebühr und Parkscheibe (`Fee.kind: 'permit'` oder
   eine Marke an `ParkingZone`), in der Oberfläche als eigene Farbe und
   eigener Satz; der Datenbau zählt sie schon.
2. **Koningsdag in Groningen, Nijmegen, Utrecht, Den Haag, Eindhoven.** Die
   Quelle führt ihn nicht (oder gar keinen Feiertag). Rückfrage an die
   Gemeinden — oder an die RDW, ob SPECIALE DAG für diese Gemeinden gepflegt
   wird — bevor jemand einen Kalender „aus Erfahrung" darüberlegt.
3. **Ereignistage rechnen.** SPECIALE DAG hat die Termine, TIJDVAK die
   Fenster; ein Modell mit datierten Ausnahmen (`exceptions: [{date,
   windows}]`) könnte Feyenoord-Spieltage und `FEEST ZOND` exakt rechnen
   statt nur zu nennen. Rotterdam wäre der Härtetest.
4. **Abschleppstelle** in Den Haag, Groningen, Nijmegen, Eindhoven: von
   einem Rechner ohne Bot-Schutz-Sperre nachlesen.
5. **Amsterdam und Maastricht:** Anfrage an die RDW, warum die
   BETAALDP-Gebiete ohne Geometrie sind; Amsterdam braucht zusätzlich die
   Lizenzfrage an die Stadt für `tarieven.json`.
6. **Eindhovens `TAR06`:** Text „22,55 per dag", Zahl 22,75 — der Stadt
   melden.
7. **Höchstparkdauer je Fenster:** Den Haag schreibt 120 und 240 Minuten
   nebeneinander (Tag/Abend); das Modell hat einen Wert je Zone, die Liste
   steht in `maxStayValues`.

## Prüfstand

Am 17. September 2026 in diesem Worktree grün: `pnpm -r typecheck`,
`pnpm test` (1.611 Tests: core 1.139, ingest 58, api 101, web 313),
`pnpm --filter @knoellchenfrei/web build`, `./scripts/sprache-pruefen.sh`,
`node scripts/doku-pruefen.mjs`, `./scripts/namen-pruefen.sh`,
`./scripts/commit-pruefen.sh`. E2E-Suite und Kachelbau laufen zentral.

## Dateien

| Datei | Inhalt |
| --- | --- |
| `app/packages/core/src/npr.ts` | Gültigkeit (drei Datumsformate), Zeiten, Tagestypen, Tarifstaffel, WKT, Feiertagsabgleich, Texte; Rohzeilentypen der acht Tabellen |
| `app/packages/core/test/npr.test.ts` | Parser gegen jede Ausprägung der Fixtures, Feiertagsabgleich gegen SPECIALE DAG, der ausgelieferte Abzug aller sechs Städte |
| `app/packages/core/test/fixtures/npr-*-2026-09-17.json` | acht Auszüge, je Tabelle einer: 6 Gebiete, 3 Geometrien, 7 Gebiet-Regelungen, 5 Regelungen, 32 Zeitfenster, 18 Tarifteile, 11 Tarife, 51 Sondertage |
| `app/packages/ingest/src/build-data-npr.ts` | Datenbau für alle sechs Städte, Stadt als `CITY` |
| `app/apps/web/public/data/{utrecht,denhaag,rotterdam,groningen,nijmegen,eindhoven}/` | die Abzüge |
| `docs/staedte-niederlande.md` | dieser Bericht |
