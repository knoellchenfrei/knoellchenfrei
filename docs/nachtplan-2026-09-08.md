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

**Gemessen, sechs Befunde.** Jeder hat eine Zahl, jeder einen Test, und bei
dreien ist die Gegenprobe gefahren — der Test wurde gegen die *alte* Fassung
gehalten und musste dort fallen. Ein Test, von dem niemand weiß, ob er den
Fehler gefunden hätte, ist eine Behauptung.

| # | Befund | Was er im Betrieb angerichtet hätte | Gefunden durch |
| --- | --- | --- | --- |
| C1 | Das Bündel, das über das Tagesbudget läuft, wurde **ganz** verworfen — und die Antwort meldete trotzdem `written: n` | Zahlen, die nicht ankommen, während die API Erfolg meldet. Deckel 20, Stand 18, Bündel mit 5 → geschrieben 0, gemeldet 2 | Probe gegen SQLite |
| C2 | Die Zonenkennung wurde gegen **alle 275** Kennungen geprüft statt gegen die der Stadt | Berlin und Frankfurt teilen sich 20 Kennungen; in München wären 193 der 275 angenommenen Werte solche, die es dort nicht gibt | Auszählen der erzeugten Liste |
| C3 | Eine gescheiterte Auswertung hielt **Löschungen** an | Der Aufräumlauf war eine Kette aus zehn `await`; hinter `rollupStats` standen die Fristen für `events`, `event_budget` und `feedback`. Eine Statistik, die nicht rechnen kann, verhinderte damit die Einhaltung einer Zusage aus der Datenschutzerklärung | Lesen — der Aufräumlauf hatte **keinen einzigen** Test |
| C4 | `build-badges.ts` ersetzte ein gutes Abzeichen durch „unknown", wenn keine Messung vorlag | Genau eingetreten: ein Lauf, bei dem es nur um die Testzahl ging, überschrieb die eine Zahl, die niemand nachrechnet | Der eigene Diff |
| C5 | **Offene Weiterleitung** im Beta-Riegel | `new URL('https://knoellchenfrei.de//evil.com/').pathname` ist `//evil.com/` — als `Location` eine protokollrelative Adresse. Ein Tester könnte einen Einladungslink bauen, der von der echten Domain kommt und auf seiner Seite endet | Durchgehen beider Anmeldewege |
| C6 | `docs/todo.md` fehlte Abschnitt **6** | Verloren am 7. September in einem Commit über Worker-Tests. Der vierte Abschnitt, den dasselbe Ersetzungsmuster gefressen hat — die ersten drei waren aufgefallen, dieser nicht | Nachzählen der Überschriften |

Was **nicht** gefunden wurde, obwohl gesucht: `Vary: Origin` steht bereits an
jeder CORS-Antwort, `hour >= 0` hält die Ortsereignisse aus dem Tagesgang
heraus, `visits.day` und `events.day` rechnen beide in Berliner Zeit, und die
Statistikseite schreibt ausschließlich über `textContent`. Vier Verdachte, vier
Fehlanzeigen — das gehört mit aufgeschrieben, sonst sucht sie beim nächsten Mal
jemand noch einmal.

## D — Prozess

Was in dieser Sitzung schiefging, und was es das nächste Mal verhindert. Nicht
die Fehler sind der Punkt, sondern die Prüfung, die sie künftig laut macht.

| Vorfall | Ursache | Was es jetzt verhindert |
| --- | --- | --- |
| **Vier verlorene Abschnitte in `docs/todo.md`** (`## 3.`, `## 5.`, `## 6.`, `## 8.`) | Zeilenbasiertes Ersetzen, dessen Block nicht an der nächsten Überschrift endete. Gefunden wurden sie durch Nachzählen, Stunden später — und einer erst am 8. September | `scripts/doku-pruefen.mjs`: Nummerierte Abschnitte müssen lückenlos aufsteigen. Läuft in der CI, prüft sich vorher selbst |
| **Zwei Verweise auf `öffentlich-machen.md`** — die Datei heißt `oeffentlich-machen.md` | Ausgerechnet der Commit, der die Sprachregel eingeführt hat (`ca60146`), hat einen **Dateinamen** wie Prosa behandelt. `sprache-pruefen.sh` prüft die Gegenrichtung und konnte es nicht sehen | Dasselbe Skript: relative Verweise müssen auf eine existierende Datei zeigen, und ein Anker auf eine Überschrift, die es gibt |
| **D1-Migrationen liefen nie** | Der Deploy rollte den Worker aus, ohne `migrations apply` zu rufen. Der Worker war grün und die Tabelle nicht da | Steht seit dem 7. September im Deploy-Workflow, mit `continue-on-error`, damit ein Migrationsfehler den Rollout nicht blockiert |
| **220 KB fremde Rohdaten in einem Commit über Testabdeckung** (`bdf27a2`) | `git add -A`, während zwei Hintergrundagenten in denselben Baum schrieben | Herausgenommen in `a0eb8a8`. Die Regel dahinter: Solange Agenten im selben Baum arbeiten, wird **benannt** hinzugefügt, nie pauschal |
| **Ein roter Typecheck als Dauerzustand** | Die vorbereiteten Städte importieren Namen, die `core` ohne die drei Einträge nicht ausführt | Der Code liegt auf `staedte/koeln-karlsruhe-vorbereitet`, nicht auf dem Arbeitszweig. Ein dauerhaft roter Typecheck macht das nächste echte Problem unsichtbar |

Der gemeinsame Nenner aller fünf ist derselbe, den CLAUDE.md schon dreimal
festhält: **etwas meldet Erfolg und tut nichts.** Der Commit war grün, der
Deploy war grün, das Abzeichen war grün. Die Abhilfe ist nie „besser
aufpassen", sondern jedes Mal eine Prüfung, die anschlägt — und eine, die sich
vorher selbst prüft, damit sie nicht still kaputtgeht.

## E — Doku

1. **Vernetzen.** Die Befunde dieser Nacht stehen verstreut; sie brauchen
   Querverweise, damit man von der Wirkung zur Ursache kommt.
2. **Gegen die Wirklichkeit halten** — jede Datei, die ich angefasst habe, und
   die, die ich nicht angefasst habe.
3. **Protokoll** in [sitzungsstatistik.md](sitzungsstatistik.md).

**Gemacht — und der Befund war unangenehmer als erwartet.** Die
Nutzungsstatistik ist das größte Stück dieser Nacht und kam in vier der
wichtigsten Dokumente mit **null** Erwähnungen vor. Sie stand nur in
Code-Kommentaren und hier.

| Datei | Was fehlte |
| --- | --- |
| [architecture.md](architecture.md) | Der ganze Aufbau. Dazu las sich die Übersicht wie eine Berlin-App, obwohl vier Städte laufen |
| [hosting.md](hosting.md) | Drei Tabellenzeilen (`feedback`, `events`, `event_budget`), warum `/stats` aus dem KV kommt, warum die Statistikseite ein zweiter Vite-Eintrag ist |
| [notfall.md](notfall.md) | Was bei Verlust von `events` weg ist — und dass die Verschlüsselung des Abzugs **nicht** ihretwegen nötig ist |
| [neue-sitzung.md](neue-sitzung.md) | Die Regel „Ort oder Zeit, nie beides", die im SQL wie ein Fehlwert aussieht und Teil des Schlüssels ist |
| [CLAUDE.md](../CLAUDE.md) | Sieben Regeln aus den Befunden dieser Nacht, die vier Prüfungen und die Testzahlen je Paket |
| [SECURITY.md](../SECURITY.md) | Die fehlende Drosselung des Anmeldeformulars — und eine Zeile über Fremdkacheln, die seit dem 7. September nicht mehr stimmte |
| [bericht/index.html](bericht/index.html) | Der siebte Nachtrag. Der sechste beschreibt vier Städte, deren Zonen niemand gesehen hat |

Das **Vernetzen** hat sich unterwegs von einer Fleißaufgabe in eine Prüfung
verwandelt: `scripts/doku-pruefen.mjs` hält seitdem jeden relativen Verweis
gegen die Datei und jeden Anker gegen die Überschrift. Querverweise zu setzen
ist erst dann eine gute Idee, wenn etwas merkt, dass einer bricht.

Das **Protokoll** steht in
[sitzungsstatistik.md](sitzungsstatistik.md#die-dritte-sitzung-7-auf-8-september-2026),
gemessen mit `scripts/protokoll.mjs` — das jetzt im Repository liegt, weil
Zahlen in einer Statistikdatei nachrechenbar sein müssen.

## Was am Morgen offen ist

Nichts davon ist angefangen und liegengeblieben; es sind Entscheidungen, die
nicht mir gehören.

| | Wartet auf |
| --- | --- |
| **Köln und Karlsruhe eintragen** | Drei Dateien, die architektonisch sind. Je ein offener Punkt: Kölns Gebühr (Datei sagt 4,00 €, Stadt sagt 5,00 €) und Karlsruhes 4,8 m breite „Zonen", die keine Ortung trifft |
| **`NW` im Feiertagskalender** | Fundstelle steht (SGV. NRW. 113, § 2), Wortlaut nicht auslesbar — die Seite lädt per JavaScript nach, das Blatt von 1989 ist ein Scan. Eine Minute in einem echten Browser |
| **WAF-Regel vor das Anmeldeformular** | Cloudflare-Dashboard. Eine Regel ist im kostenlosen Tarif enthalten |
| **`CLOUDFLARE_R2_TOKEN`** | Ohne ihn baut der Kachel-Workflow nichts, und die Karte altert still |
| **`vitest-pool-workers`** | Verlangt Vitest 4, wir sind auf 3.2. Ein Hauptversionssprung des Testläufers über alle Pakete — abzusprechen |
| **Der Bericht als Artifact** | Die veröffentlichte Fassung ist alt (sie lädt noch Schriften von Google, was seit Audit-Punkt M-018 nicht mehr stimmt). Das Aktualisieren wurde in dieser Sitzung abgelehnt; die gepflegte Fassung liegt im Repository |
