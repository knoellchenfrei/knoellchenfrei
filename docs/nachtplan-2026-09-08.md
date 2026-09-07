# Nachtplan, 8. September 2026

Aus den Anweisungen des Betreibers in der Nacht: über Todos, Brainstorm,
Fehler und Prozess iterieren, die nächsten Städte durch Agenten vorbereiten
lassen, die Testabdeckung auf das prüfen, was **im Betrieb** eintritt, und die
Doku mehrfach nachziehen. Dazu die Regel, die alles andere überschreibt:

> **Architektonische Änderungen sind vorher abzusprechen.**

Also: vorbereiten ja, einbauen nein. Was die Form des Projekts ändert — eine
neue Abhängigkeit, ein Wechsel des Testläufers, eine neue Lizenzfamilie, ein
Umbau an `core/city.ts` — wird fertig hingelegt und wartet auf eine
Entscheidung.

Diese Datei ist das Arbeitsblatt der Nacht und darf danach gelöscht werden;
was Bestand hat, steht in [todo.md](todo.md), [ideen.md](ideen.md) und
[entscheidungen.md](entscheidungen.md).

## A — Die nächsten Städte (Agenten, parallel)

Jeder Agent bekommt **eigene Dateien** und darf nichts Gemeinsames anfassen.
`core/city.ts`, `core/index.ts` und `ingest/src/sources.ts` sind tabu; was dort
hin müsste, kommt als fertiger Schnipsel in den Bericht.

| | Stadt | Eigenheit, die es schwer macht |
| --- | --- | --- |
| A1 | **Köln** | WFS ignoriert `srsName` — der Datenbau muss selbst umprojizieren. Und das Gebührenfeld ist eine Erhöhung alt. |
| A2 | **Karlsruhe** | Flächen ohne Attribute, Automaten mit Freitext-Gebühr. Dritte Lizenzfamilie: CC BY 4.0. |
| A3 | **Düsseldorf** | Kein Betrag im Feed — dieselbe Lage wie München. |

Beide Länder fehlen im Feiertagskalender: `holidaysFor` kennt nur
`BE | HH | HE | BY`. Nordrhein-Westfalen und Baden-Württemberg wären Einträge,
keine Umbauten — aber sie ändern einen Typ, also erst nach Absprache.

## B — Testabdeckung: was im Betrieb eintritt

Die Frage ist nicht „wie viel Prozent", sondern „was passiert, wenn das Ding
online ist, und wird es geprüft". Fünf Kandidaten, vor der Messung notiert,
damit die Messung sie widerlegen kann:

1. **Zeit.** Zeitumstellung, Jahreswechsel, Schaltjahr, ein Tag mit 23 oder 25
   Stunden. Die App rechnet überall in Berliner Ortszeit.
2. **Der Worker unter Last und mit Unfug.** Rate-Limits, gleichzeitige
   Schreibvorgänge, ein volles Tagesbudget.
3. **Der Weg zwischen App und Worker.** Was tut die App, wenn er 500 sagt,
   429, oder gar nicht antwortet?
4. **Der Service Worker.** Ein alter Vorrat trifft auf neue Daten.
5. **Fremde Eingaben aus dem Netz**, die noch niemand geschickt hat.

**Gemessen, erste Runde.** `packages/core` steht bei 99,9 % Zeilen — die Zahl
sagt aber nichts über die Stellen, an denen es im Betrieb weh tut. Die lagen
woanders:

| Lücke | Was fehlte | Jetzt |
| --- | --- | --- |
| **Zeitumstellung** | Kein einziger Test. Zweimal im Jahr hat ein Berliner Tag 23 oder 25 Stunden, und die App rechnet überall in Berliner Ortszeit | 11 Fälle für den 29. März und den 25. Oktober 2026 |
| **Leseendpunkte** | `/sightings` und `/marks` waren im Worker-Test gar nicht vorgekommen — samt Rückfall auf Berlin und Abweisung eines Tippfehlers | 5 Fälle |
| **Stimmabgabe** | Die Kennung kommt aus einer Adresse, also von aussen; das Muster war ungeprüft | 2 Fälle |
| **Beschuss der offenen Adressen** | `/sightings`, `/visits`, `/events`, `/feedback` nehmen JSON aus dem Netz entgegen. Zwölf Sorten Unfug, keine davon geprüft | 6 Fälle |

Von 580 auf 602 Tests, ohne dass die Zahl in `core` sich groß bewegt hätte —
die Lücken lagen im Worker.

## C — Fehlerjagd

Systematisch statt zufällig: Grenzfälle im Worker, in der App, in den Daten.
Was gefunden wird, bekommt einen Test **und** einen Eintrag, wo die Ursache
steht.

## D — Prozess

Was in dieser Sitzung schiefging, und was es das nächste Mal verhindert. Drei
Fälle liegen schon vor: die nie angewendeten D1-Migrationen, meine
zeilenbasierte Ersetzung, die drei Abschnitte verschluckt hat, und das doppelte
`robots`-Meta.

## E — Doku

1. **Vernetzen.** Die Befunde dieser Nacht stehen verstreut; sie brauchen
   Querverweise, damit man von der Wirkung zur Ursache kommt.
2. **Gegen die Wirklichkeit halten** — jede Datei, die ich angefasst habe, und
   die, die ich nicht angefasst habe.
3. **Protokoll** in [sitzungsstatistik.md](sitzungsstatistik.md).
