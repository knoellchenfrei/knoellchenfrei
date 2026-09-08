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

**Zweite Runde, am Ende der Nacht und diesmal gemessen statt vermutet.** Für
`apps/api` gab es nie eine Abdeckungsmessung; nachgeholt mit v8 stand der
Worker bei **75,3 %** Zeilen. Die beiden grössten zusammenhängenden Lücken
waren nicht die verwinkelten Stellen, sondern zwei Wege, die man für
selbstverständlich hält: `GET /stats` — der einzige öffentliche Lesepfad der
Statistik — und der **Erfolgsfall** des Telegram-Bots, also genau der Weg, für
den es ihn gibt. Beide jetzt geprüft, dazu vierzehn Sorten Unfug hinter dem
Bot-Geheimnis: Telegram wiederholt jede Zustellung ohne 2xx unbegrenzt, ein
geworfener Fehler wäre also keine Panne, sondern eine Schleife.

Dazu der Vorspann vor dem Behördendienst (`/wfs/<ebene>`) — die einzige Stelle,
an der der Worker selbst nach draussen ruft. Drei Dinge darin sieht man nicht,
wenn man nur die glückliche Antwort betrachtet: dass ein Treffer im
Zwischenspeicher gar nicht erst hinausruft, dass eine 200 mit etwas anderem als
einer FeatureCollection **nicht** abgelegt wird — sonst vergiftete sie den
Speicher für einen ganzen Tag —, und dass die Fehlermeldung der Gegenstelle ins
Log geht und nicht in die Antwort.

Danach **91,3 %** Zeilen und **100 %** Funktionen: Jede Funktion des Workers
wird jetzt von mindestens einem Test angefasst.

Dieselbe Messung über die reinen Module der Web-App wies `format.ts` mit
**0 %** aus — 107 Zeilen, keine davon geprüft. Ausgerechnet diese Schicht trägt
zwei gemeldete Fehler des Projekts: „1 Std. 0 Min." auf der vollen Stunde und
„1 Plätze" aus dem POI-Feed. Beide sind im Code behoben und kommentiert;
**geprüft war keiner von beiden.** Jetzt 97 % — und beim Schreiben schlug
prompt zu, was diese Schicht ausmacht: `Intl` setzt zwischen Zahl und `€` ein
**geschütztes** Leerzeichen. Die Erwartung sah identisch aus und war es nicht.

Von 602 auf 685 Tests.

## C — Fehlerjagd

Systematisch statt zufällig: Grenzfälle im Worker, in der App, in den Daten.
Was gefunden wird, bekommt einen Test **und** einen Eintrag, wo die Ursache
steht.

**Gemessen, elf Befunde.** Jeder hat eine Zahl, jeder einen Test, und bei
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
| C7 | **Drei der zwölf Katalogereignisse wurden nie ausgelöst** | `layer.on`, `city.suggest` und `tow.open` standen in `core/events.ts` und in keiner Zeile der App. Auf der Statistikseite hätten sie als Dauer-Null gestanden — und `layer.on` ist ausgerechnet die Antwort auf „welche Ebenen werden benutzt", eine der Fragen, für die das Zählwerk gebaut wurde | Katalogeinträge gegen die Aufrufstellen gezählt |
| C8 | **Ein Tab über Mitternacht zählte nicht mehr mit** | Der Worker weist eine Besuchskennung ab, deren Tag nicht der heutige ist (`422 stale day`). Die App bildete sie **einmal** beim Aufsetzen — ab 00:00 also stundenlang die von gestern. Sichtbar war nichts: Ein fehlgeschlagener Ping bleibt absichtlich still, also stand die ganze Nacht die Zahl von kurz vor Mitternacht auf dem Schirm | Den Client gegen die Serverregel gehalten, die er bedienen soll |
| C9 | **Die MapLibre-Worker-Datei stand nicht im Vorrat des Service Workers** | Dieselbe Wurzel wie der grosse Fund der Nacht: Die Vorratsliste entsteht aus den `src=` der index.html, und die Adresse des Workers wird zur Laufzeit gebaut. Wer die App ablegt und offline geht, bevor die Karte einmal geladen hat, bekommt sie ohne Karte **und ohne Parkzonen** — und offline ist der Fall, für den der Vorrat da ist | Die gebaute `sw.js` gegen `dist/assets` gehalten |
| C10 | **Ein Drittel der Hamburger Flächen konnte die falsche Farbe zeigen** | Die Karte färbt über `setFeatureState({ id })`, und `id` kam aus `promoteId: 'zone'`. In Hamburg tragen **44 von 145 Flächen** den Schlüssel `-` — die Quelle vergibt dort keinen Namen —, dazu vier Zonen in Stücken mit verschiedenen Zeiten (A103: 9–20 und 9–23 Uhr) und eine mit verschiedenen Beträgen. Alle teilten sich einen Zustandsplatz, der letzte Schreibvorgang gewann. Um 21 Uhr stand „frei" über Flächen, die bis 22 Uhr kassieren | Die Zonenschlüssel je Stadt gezählt: 145 Flächen, 63 Schlüssel |
| C11 | **…und beim Klick auch die falschen Zeiten** | Nachtrag zu C10, gefunden beim Nachlesen der eigenen Behauptung: Der Klick-Handler schlug über `properties.zone` nach und nahm die **erste** Fläche mit diesem Schlüssel. Ein Klick auf irgendeine der 44 zeigte die Zeiten der ersten — bei A103 9–20 statt 9–23 Uhr, bei E315 3,50 statt 3,00 €. Ich hatte eine Stunde vorher geschrieben, das Panel sei nicht betroffen | Den eigenen Satz gegen den Code gehalten, statt ihn stehen zu lassen. Der Rückfall auf den Schlüssel bleibt für den Fall, dass MapLibre keine `id` mitliefert: Ein Klick, der gar nichts tut, wäre schlechter als einer, der in Hamburg gelegentlich die Nachbarfläche trifft |

Die letzten beiden sind die lehrreichsten, weil sie zeigen, wie eine Lücke
aussieht, die niemandem auffällt: **Nichts war kaputt.** Die Zählung lief, die Seite
zeichnete, die Tests waren grün — es fehlte nur die Hälfte der Antwort, und
eine Dimension ohne Werte ist von einer kaputten nicht zu unterscheiden. Der
Test dagegen prüft die **Quelle**: Für jeden Katalognamen muss es eine Stelle
geben, die ihn auslöst. Ein Ereignis an einer Schaltfläche ist im Unit-Test
nicht erreichbar, und zwölf Klickstrecken in E2E wären der falsche Preis.

Beim achten dasselbe eine Ebene tiefer: Der Fehler entsteht **zwischen** zwei
Stellen, die für sich richtig sind. Der Worker weist eine veraltete Kennung
zurück, und das muss er. Die App bildet die Kennung beim Aufsetzen, und das
wäre in Ordnung, wenn sie nicht stundenlang liefe. Erst zusammen ergeben sie
einen Tab, der ab Mitternacht nicht mehr zählt — und weil ein fehlgeschlagener
Ping absichtlich still bleibt, sieht man davon nichts ausser einer Zahl, die
sich nicht mehr ändert. Gefunden wurde er, indem der Client gegen die
Serverregel gehalten wurde, die er bedienen soll.

Und eine dritte aus derselben Wurzel: An zwei Stellen war der Zonenschlüssel
auch der **React-Schlüssel** einer Liste — in der Suche und im Meldedialog.
Stehen mehrere Flächen mit `-` gleichzeitig darin, sind die Schlüssel doppelt,
und React darf beim Umsortieren den falschen Knoten wiederverwenden: Die
Auswahl springt dann auf eine andere Zeile, als angeklickt wurde. Beide nehmen
jetzt `zone.id` — genau die Kennung, die es seit diesem Befund gibt.

Aus demselben Befund fiel eine zweite Sache heraus, die niemandem aufgefallen
war, weil sie nur in Hamburg auftritt: An **neun Stellen in fünf Dateien**
stand wörtlich „Zone -" — im Panel, in der Ansage für Screenreader, in der
Suche, im Meldedialog und im Satz „Parkplatz gemerkt in Zone -". Das liest sich
wie ein Anzeigefehler und ist eine Tatsache der Quelle; sie gehört
ausgesprochen, nicht durchgereicht. Alle neun gehen jetzt über
`src/zone-label.ts`. Der erste Anlauf schrieb dabei „gemerkt in **eine** Fläche
ohne Nummer" — aufgefallen im eigenen Test, in dem der falsche Satz als
Erwartung stand.

Der zehnte ist der teuerste und zeigt eine dritte Sorte Blindheit: **Ich habe
zuerst das Falsche gemessen.** Auf die Beobachtung „Hamburg hat 145 Flächen für
63 Zonen" habe ich vier Beispiele angesehen, in allen vieren unterschied sich
nur der Stadtteil, und daraus wurde „unterscheidet sich nur im Stadtteil". Der
Test, den ich auf diese Behauptung schrieb, fiel sofort — und nannte A103 mit
zwei verschiedenen Zeiten. Vier Beispiele sind keine Messung, sie sind vier
Beispiele. Die Zusicherung heisst jetzt, was wahr ist: Ein Zonenschlüssel ist
keine Kennung einer Fläche.

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
| **D1-Migrationen liefen nie — und laufen immer noch nicht** | Der Deploy rief `migrations apply` gar nicht. Seit dem 7. September ruft er es, und bekommt jedes Mal `code: 7403`: Dem CI-Token fehlt `D1:Edit`, es trägt bewusst nur *Workers Scripts:Edit* und *Cloudflare Pages:Edit*. Wegen `continue-on-error` steht darüber eine gelbe Warnung, und der Lauf ist grün | Nichts — das Recht muss ans Token, und das ist im Dashboard. Steht als Punkt 7 in `todo.md`. Gefunden im Log des Laufs vom 8. September, 02:51, **nachdem** ich in `hosting.md` geschrieben hatte, der Schritt tue es |
| **220 KB fremde Rohdaten in einem Commit über Testabdeckung** (`bdf27a2`) | `git add -A`, während zwei Hintergrundagenten in denselben Baum schrieben | Herausgenommen in `a0eb8a8`. Die Regel dahinter: Solange Agenten im selben Baum arbeiten, wird **benannt** hinzugefügt, nie pauschal |
| **Dieselbe Sache noch einmal, zwei Stunden später** (`01df659`) | Wieder `git add -A`, wieder Fixtures eines laufenden Agenten — diesmal Düsseldorfs, eine Minute nachdem er sie geschrieben hatte. Die Regel stand zu diesem Zeitpunkt seit zwei Stunden in `CLAUDE.md`, von mir geschrieben, und **gemerkt hat es der Agent, nicht ich** | Herausgenommen. Und die Lehre ist nicht „besser aufpassen": Eine Regel, die nur im Kopf gilt, ist keine. Solange Agenten laufen, gehört `git add` mit Pfaden geschrieben — was pauschal geht, geht irgendwann pauschal daneben |
| **Dreimal derselbe Pipe-Fehler in einer Nacht** | `pruefung \| tail` — eine Pipeline hat den Status ihres letzten Glieds. Beim dritten Mal traf es die E2E-Suite: `tail -5` schnitt die Zeile „4 failed" ab und zeigte „149 passed", der Exit-Code gehörte `tail`. **Vier rote Tests sahen aus wie ein grüner Lauf** | Aufgefallen nur daran, dass 149 + 1 nicht 154 ergibt. Die Suite schreibt jetzt in eine Datei, und die Testzahl wird nachgerechnet: Eine Suite, die weniger Tests meldet, hat keine verloren, sondern welche verschwiegen |
| **Der eigene Deploy-Check zweimal rot, beide Male zu Unrecht** | Erst galt „irgendein Status" als bereit — und `404` ist einer. Dann galt „`/` antwortet" — aber eine Pages-Vorschauadresse breitet sich **je Pfad** aus: `/` gab 401, während `/sw.js` noch 404 lieferte. Beide Male sechs bis elf Fehlschläge, die eine Minute später alle grün waren | Gewartet wird jetzt auf das **Gesamtergebnis**: der ganze Durchgang wiederholt sich, bis er grün ist oder zwei Minuten um sind. Die Lehre ist dieselbe wie bei den Vier-Beispielen: Ich habe die Bedingung an dem gemessen, was ich gerade abgerufen hatte, statt an dem, was die Prüfung braucht |
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

## Abschluss: die Befehle in der Doku wurden ausgeführt

Nicht gelesen — ausgeführt, um 04:24. Alle zehn, die `CLAUDE.md` nennt, laufen
so, wie sie dort stehen: `pnpm -r typecheck`, `pnpm test`, `test:coverage`,
`pnpm --filter … build`, `pnpm artifact` aus `app/`, und die fünf Prüfungen
`sprache-pruefen.sh`, `doku-pruefen.mjs`, `namen-pruefen.sh`,
`geheimnisse-pruefen.sh`, `ausgeliefert-pruefen.sh` aus dem Wurzelverzeichnis.
Danach ist der Arbeitsbaum unverändert.

**Und die Messung war beim ersten Anlauf falsch**, was hierher gehört, weil es
die Lehre der Nacht ist: Die Schleife meldete alle vier Befehle als
fehlgeschlagen. Ursache war nicht der Code, sondern zsh — es trennt eine
unquotierte Variable nicht in Wörter und suchte einen Befehl namens
`pnpm -r typecheck`. Ein Messgerät, das lügt, sieht genauso aus wie ein Befund.

## Was am Morgen offen ist

Nichts davon ist angefangen und liegengeblieben; es sind Entscheidungen, die
nicht mir gehören.

| | Wartet auf |
| --- | --- |
| **Köln, Karlsruhe und Düsseldorf eintragen** | Drei bis vier Dateien, die architektonisch sind. Je ein offener Punkt: Kölns Gebühr (Datei sagt 4,00 €, Stadt sagt 5,00 €), Karlsruhes 4,8 m breite „Zonen", die keine Ortung trifft, und Düsseldorfs Automatenebene ohne Lizenzfeld — eine E-Mail an `opendata@duesseldorf.de` |
| ~~**`NW` im Feiertagskalender**~~ | **Erledigt.** Der Wortlaut von § 2 FeiertagsG NW liegt vor, gefunden über `robots.txt` → Sitemap-Index → statisches HTML. Damit ist auch Kölns Feiertagsfrage beantwortet |
| **`@types/geojson` als direkte Abhängigkeit** | Drei Felder in `loadData` bleiben sonst ungetypt. Eine Abhängigkeitsänderung, also abzusprechen |
| **Der Ersatzschlüssel für Hamburgs 44 namenlose Flächen** | Er ändert die erzeugte Zonenliste und bereits gezählte Ausprägungen. Die Oberfläche sagt inzwischen „Bewirtschaftete Fläche" statt „Zone -"; die Statistik zählt sie weiter als eine |
| **WAF-Regel vor das Anmeldeformular** | Cloudflare-Dashboard. Eine Regel ist im kostenlosen Tarif enthalten |
| **`CLOUDFLARE_R2_TOKEN`** | Ohne ihn baut der Kachel-Workflow nichts, und die Karte altert still |
| **`D1:Edit` ans CI-Token** | Bis dahin muss jede neue Migration von Hand eingespielt werden |
| **`vitest-pool-workers`** | Verlangt Vitest 4, wir sind auf 3.2. Ein Hauptversionssprung des Testläufers über alle Pakete — abzusprechen |
| **Der Bericht als Artifact** | Die veröffentlichte Fassung ist alt (sie lädt noch Schriften von Google, was seit Audit-Punkt M-018 nicht mehr stimmt). Das Aktualisieren wurde in dieser Sitzung abgelehnt; die gepflegte Fassung liegt im Repository |
