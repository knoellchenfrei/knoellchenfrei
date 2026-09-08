# Sitzungsstatistik

Drei Sitzungen, gemessen statt geschätzt: der **Umbau** vom 5./6. September,
die **Fortsetzung** ab dem Nachmittag desselben Tages, in der das Projekt umzog,
Hamburg dazukam — und in der Nacht darauf Frankfurt und München —, sowie die
**dritte** vom 7. auf den 8. September mit Audit, Nutzungsstatistik und
Fehlerjagd. Die zweite steht
[weiter unten](#die-fortsetzung-umzug-und-zweite-stadt), dreimal gemessen: um
16:21, um 23:25 und um 03:50. Die dritte steht
[ganz unten](#die-dritte-sitzung-7-auf-8-september-2026).

Diese Datei ist beim Umzug aus `herbeus/parkingzone` mitgekommen; gepflegt wird
sie hier.

## Der Umbau vom 5./6. September 2026

Messwerte der Claude-Code-Sitzung, in der ParkingZone von einer Java/Spring-App
von 2012 zur heutigen PWA umgebaut wurde. **Stand 6. September 2026, 15:45 Uhr**
— die Sitzung lief zu diesem Zeitpunkt noch, die Zahlen sind also eine
Momentaufnahme, keine Endabrechnung.

Gedacht als Beleg für den [Werkbericht](bericht/index.html) und für eine
Nachfolgesitzung, die das Protokoll fortschreibt.

## Herkunft der Zahlen

Zwei Quellen, die sich nicht decken:

1. **Die Buchhaltung der Sitzung** (`get_session` → `external_metadata.usage`) —
   das, was die Plattform selbst abgerechnet hat. **Maßgeblich.**
2. **Der Sitzungsverlauf** als JSONL (6.577 Zeilen), ausgewertet über die
   `usage`-Felder der Assistenten-Nachrichten.

Beim Cache-Lesen weichen sie erheblich ab — 777 Mio. im Verlauf gegen 483 Mio.
in der Buchhaltung. Die plausible Erklärung: Der Verlauf zählt Zwischenstände
beim Streamen mehrfach. **Wo die Zahlen sich widersprechen, gilt die
Buchhaltung.** Werkzeug- und Nachrichtenzahlen kommen aus dem Verlauf, weil die
Buchhaltung sie nicht führt.

## Modell

| | |
| --- | --- |
| Konfiguriert | `claude-opus-5` |
| Tatsächlich bedient | `claude-opus-5` |
| Aufwandsstufe | `xhigh` |
| Modellwechsel oder Fallback | keiner |
| Kontextfenster | 557.593 von 1.000.000 belegt |

Alle 2.067 Antworten kamen von demselben Modell.

## Tokens und Kosten

| Art | Tokens |
| --- | ---: |
| Eingabe | 1.426.716 |
| Ausgabe | 2.083.289 |
| Cache geschrieben | 10.564.148 |
| Cache gelesen | 483.120.300 |
| **Summe** | **497.194.453** |

**Kosten laut Plattform: 415,88 $** (`cost_usd: 415.87815175`).

> **Nachtrag vom 6. September, 16:20 Uhr.** Die Sitzung ist inzwischen beendet
> (`SESSION_STATUS_IDLE`), und dasselbe Feld noch einmal abgefragt liefert die
> Endabrechnung. Die Zahlen oben waren, wie angekündigt, eine Momentaufnahme:
>
> | | 15:45 (Momentaufnahme) | 16:20 (Endstand) |
> | --- | ---: | ---: |
> | Eingabe | 1.426.716 | 1.427.256 |
> | Ausgabe | 2.083.289 | 2.105.393 |
> | Cache geschrieben | 10.564.148 | 11.195.853 |
> | Cache gelesen | 483.120.300 | 494.218.840 |
> | **Kosten** | **415,88 $** | **428,30 $** |
>
> Der Abstand zum Sitzungsverlauf (777 Mio. Cache-Lesevorgänge) bleibt auch
> gegen den Endstand groß — die Erklärung mit den doppelt gezählten
> Streaming-Zwischenständen hält.

**97 % der Tokens sind Cache-Lesevorgänge.** Das ist die eigentliche Erkenntnis
und gilt für jede lange Sitzung: Nicht das Schreiben kostet, sondern das
Wiederlesen. Bei jeder Anfrage geht der bisherige Verlauf erneut mit; über 2.067
Anfragen summiert sich das auf eine halbe Milliarde Tokens, während tatsächlich
nur 2,1 Millionen Tokens geschrieben wurden — ein Verhältnis von rund 230 : 1.

Zum Einordnen: Bei Opus-5-Sätzen von 5 $ je Million Eingabe- und 25 $ je Million
Ausgabetokens entfällt der Großteil der Summe auf das Cache-Lesen, nicht auf die
Ausgabe. Abgerechnet wurde hier über das Fünf-Stunden-Kontingent des Abos, nicht
über eine API-Rechnung; der Betrag ist der entsprechende Gegenwert.

## Werkzeuge

1.108 Aufrufe in 21 verschiedenen Werkzeugen.

| Werkzeug | Aufrufe | Werkzeug | Aufrufe |
| --- | ---: | --- | ---: |
| Bash | 884 | AskUserQuestion | 9 |
| WebSearch | 43 | Monitor | 4 |
| Write | 38 | SendUserFile | 3 |
| Read | 31 | `list_repos` | 3 |
| Artifact | 27 | `add_repo` | 2 |
| WebFetch | 26 | Edit | 2 |
| Agent | 15 | `search_users` | 2 |
| ToolSearch | 11 | Workflow | 1 |

Dazu je einmal `get_job_logs`, `get_me`, `TaskStop`, zweimal `actions_list`,
zweimal `Skill`.

**80 % Bash.** Das ist kein Zufall, sondern eine Anweisung der Umgebung: Lesen,
Suchen und Ändern laufen über die Shell, und fast alle Änderungen an Dateien
liefen als Python-Skripte durch Bash. Daher nur 2 `Edit`-Aufrufe bei 38 `Write`.

## Agenten

15 Aufrufe, alle vom Typ `general-purpose`, alle in der Nacht und im frühen
Morgen. Im Tagesverlauf keiner — die Recherche zu Domains, Vereinsrecht und
weiteren Städten lief direkt.

| Bereich | Agenten |
| --- | --- |
| Recherche | Live-Parkdaten Berlin, bessere statische Quellen, Kontrolldaten Berlin, PMTiles-Pipeline, Rollenbeschreibungen |
| Fachprüfung | Korrektheit der Domänenlogik, fachliche Plausibilität gegen echte Daten |
| Sicherheit | Sicherheit und Datenschutz, Robustheit und Edge Cases, Regressionen und Randfälle |
| Oberfläche | Mobile Layout und Touch, mobiler Nutzungsfluss (zweimal), E2E-Nutzerreisen, E2E-Barrierefreiheit |

Ehrliche Bilanz: Sie fanden Dinge, die sonst durchgerutscht wären — die
überversprochene Höchstparkdauer, die Advents-Samstage, das wirkungslose
Rate-Limit, die widerlegte CORS-Behauptung. Mehrere andere hingen in
Warteschleifen und lieferten nichts; deren Arbeit wurde nachgeholt. Der Gewinn
lag im Fächern der Blickwinkel, nicht im Durchsatz.

## Verlauf

Werkzeugaufrufe je Stunde (UTC):

```
23:00  ███████████                             45
00:00  ███████████████████                     73
01:00  ██████████████████████████████████████ 143   ← die PWA entsteht
02:00  ███████████████                         58
03:00  ██████████████████████████████         111
       ── Pause ──
06:00  ██████████████                          52   ← erste Fehlermeldungen
07:00  ██████████████████████████              98
08:00  ██████████████████████                  83
09:00  ███████████████████████                 88
10:00  ████████████████████████████████████████████ 165   ← Layout, PWA, Zonenfarbe
11:00  ███████████████████████████            102
12:00  ██████████████████████                  83
13:00  █                                        5
15:00  ██                                       6
```

## Übrige Kennzahlen

| | |
| --- | ---: |
| Laufzeit | 16 h 25 min (23:19 bis 15:44) |
| Nachrichten des Nutzers | 51 |
| Antworten des Assistenten | 2.067 |
| Zeilen im Sitzungsverlauf | 6.577 |
| Commits | 47 |
| Kosten je Commit | 8,85 $ |
| Unit-Tests am Ende | 129 |
| End-to-End-Tests am Ende | 93 bestanden, 1 übersprungen |
| Coverage | 96,3 % Zeilen |

Sitzungskennung: `session_011pJ23HL26uz4mpQdGgj7sA`, gestartet vom iPhone,
Umgebung `env_01J5fLfnaCqinB932bTfJ7BQ`.

## Was davon in den Bericht gehört — **erledigt**

Übernommen am 6. September 2026 nachmittags. Die Statistik-Tabelle des
[Werkberichts](bericht/index.html) nannte **„über 20 Agenten"**; das war
geschätzt, **gemessen sind es 15**, alle vom Typ `general-purpose`. Die Zeile
ist ersetzt und um den Hinweis ergänzt, dass dort vorher eine Schätzung stand.
Die vier Zeilen unten sind ergänzt, dazu ein Kasten über die Herkunft der
Zahlen und das Verhältnis von Wiederlesen zu Schreiben:

| Kennzahl | Wert | Anmerkung |
| --- | --- | --- |
| Modell | `claude-opus-5` | alle 2.067 Antworten, kein Wechsel, Aufwandsstufe `xhigh` |
| Werkzeugaufrufe | 1.108 | in 21 verschiedenen Werkzeugen, davon 884 Bash |
| Tokens | 497.194.453 | davon 97 % Cache-Lesevorgänge |
| Kosten | 415,88 $ | 8,85 $ je Commit |

Nachgetragen wurde außerdem die **Laufzeit**: Der Bericht nannte 12 h 52 min
— das ist die Zeit bis 12:11, die sein Hauptteil beschreibt, nicht die Laufzeit
der Sitzung. Jetzt steht dort 16 h 25 min mit genau dieser Erklärung.

**Hinweis zur Kopie im alten Repository:** `docs/bericht/index.html` dort ist
seit dem 6. September nachmittags überholt — es fehlen die beiden Nachträge zum
Umzug und zu Hamburg. Von dort aus zu veröffentlichen würde sie löschen. Die
gepflegte Fassung liegt in `knoellchenfrei/knoellchenfrei`.

## Für die Nachfolgesitzung

Wer dieses Protokoll fortschreibt, kommt an dieselben Zahlen so heran:

```bash
# Buchhaltung der eigenen Sitzung — maßgeblich
#   get_session ohne session_id → external_metadata.usage
#   Fehlt der Block: SPÄTER NOCH EINMAL FRAGEN. Er wird mit Verzug
#   geschrieben; einmal nichts zu finden beweist nichts.

# Buchhaltung einer FREMDEN Sitzung — geht genauso, sofern sie demselben
# Konto gehört. So lässt sich die Vorgängersitzung nachprüfen, statt ihre
# Zahlen zu glauben:
#   get_session mit session_id → external_metadata.usage

# Verlauf der eigenen Sitzung — nur als Gegenprobe, nie als Ersatz
ls ~/.claude/projects/*/*.jsonl
```

Der Verlauf ist JSONL, eine Zeile je Ereignis. Werkzeugaufrufe stehen als
`message.content[]`-Blöcke mit `type: "tool_use"`, Modell und `usage` an den
Zeilen mit `type: "assistant"`. Beim Zusammenzählen der `usage`-Felder daran
denken, dass Streaming-Zwischenstände doppelt zählen können — siehe oben.

---

## Die Fortsetzung: Umzug und zweite Stadt

Sitzung `session_019V7Wkw6LxEt3Lq3ocaDrHe`, gestartet vom iPhone am
6. September 2026 um 13:21 UTC, Umgebung `env_01J5fLfnaCqinB932bTfJ7BQ` — also
dieselbe Umgebung, aber mit **beiden** Repositories als Quelle, wie
[neue-sitzung.md](neue-sitzung.md) es verlangt hatte.

> **Korrektur.** Hier stand zuerst, die Buchhaltung führe für diese Sitzung
> **keinen** `usage`- und `cost_usd`-Block, es gebe also nur den
> Sitzungsverlauf. Das war falsch — und zwar auf eine Art, die einen eigenen
> Eintrag verdient: Der Block **fehlte um 16:02 und war um 16:21 da**. Er wird
> offensichtlich mit Verzug geschrieben, nicht bei jeder Anfrage. Wer einmal
> nachsieht und nichts findet, hat nicht bewiesen, dass es nichts gibt.
>
> Für die Nachfolgesitzung heißt das: **noch einmal fragen, bevor man „gibt es
> nicht" schreibt.** Genau das hatte ich unterlassen.

**Maßgeblich, Stand 6. September 16:21 Uhr** (die Sitzung lief da noch, es ist
also wieder eine Momentaufnahme):

| Art | Tokens |
| --- | ---: |
| Eingabe | 25.476 |
| Ausgabe | 130.100 |
| Cache geschrieben | 564.644 |
| Cache gelesen | 69.052.843 |
| **Summe** | **69.773.063** |

**Kosten: 43,45 $** (`cost_usd: 43.4531535`).

**Der Sitzungsverlauf liegt weit darüber** — 173,5 Mio. gegen 69,8 Mio.,
Faktor 2,5, bei der Ausgabe sogar Faktor 3,3 (427.456 gegen 130.100). Bei der
Vorgängersitzung war der Abstand kleiner (777 gegen 494 Mio., Faktor 1,6).
Beide Male in dieselbe Richtung: **Der Verlauf taugt nicht als Ersatz für die
Abrechnung**, nur als Obergrenze.

| | |
| --- | ---: |
| Modell | `claude-opus-5` |
| Tatsächlich bedient | `claude-opus-5`, alle 542 Antworten |
| Aufwandsstufe | `high` — die Vorgängersitzung lief auf `xhigh` |
| Modellwechsel oder Fallback | keiner |
| Kontextfenster | 383.460 von 1.000.000 belegt |
| Nachrichten des Nutzers | 5 |
| Antworten des Assistenten | 542 |
| Zeilen im Sitzungsverlauf | 1.674 |
| Commits | 6 |

### Werkzeuge

331 Aufrufe in 12 Werkzeugen — gegenüber 1.108 in 21.

| Werkzeug | Aufrufe | Werkzeug | Aufrufe |
| --- | ---: | --- | ---: |
| Bash | 275 | ToolSearch | 3 |
| Write | 18 | AskUserQuestion | 2 |
| WebSearch | 10 | `search_repositories` | 2 |
| WebFetch | 7 | Read | 1 |
| Artifact | 6 | `create_repository` | 1 |
| Edit | 5 | `get_session` | 1 |

**83 % Bash**, praktisch derselbe Anteil wie beim Umbau (80 %) — dieselbe
Anweisung der Umgebung, dasselbe Ergebnis. Bemerkenswert ist das Fehlende:
**kein einziger Agent.** Die Vorgängersitzung rief 15; hier lief alles direkt.
Der Grund ist die Art der Arbeit: Umzug, Datenanalyse und Doku sind Ketten, in
denen jeder Schritt vom vorigen abhängt — da nützt Fächern nichts.

`create_repository` steht mit einem Aufruf in der Liste und ist trotzdem
gescheitert: `403 Resource not accessible by integration`. Die GitHub-App darf
in der Organisation keine Repositories anlegen. Das ist der Grund, warum die
Profilseite in [marke.md](marke.md) als Klickliste steht statt als erledigter
Haken.

### Dieselben Zahlen aus dem Verlauf — als Gegenprobe

| Art | Tokens |
| --- | ---: |
| Eingabe | 1.084 |
| Ausgabe | 427.456 |
| Cache geschrieben | 2.187.925 |
| Cache gelesen | 170.865.142 |
| **Summe** | **173.481.607** |

Nach der Abrechnung sind es **99 % Cache-Lesevorgänge** (69,05 von 69,77
Mio.) — das Verhältnis von Wiederlesen zu Schreiben liegt bei rund 122 : 1
gegen 230 : 1 beim Umbau. Dass es hier *günstiger* ausfällt als dort, hat einen
einfachen Grund: weniger Anfragen. Über 542 Antworten summiert sich der
mitlaufende Kontext seltener auf als über 2.067.

Die Verlaufszahlen oben nennen 98 % und ein Verhältnis von 78 : 1. Sie sind in
der Größenordnung richtig und in der Zahl falsch — genau der Grund, warum die
Abrechnung gilt.

### Verlauf

Werkzeugaufrufe je Stunde (UTC):

```
13:00  ████████████████████████████████████████ 120   ← Umzug, Stadt-Konfiguration
14:00  ███████████████████████████             83     ← Hamburg-Feed, Parser
15:00  ████████████████████████████████████████ 119   ← Umschalter, Doku, Marke
16:00  ███                                      9
```

### Was diese Sitzung geliefert hat

| | |
| --- | --- |
| Umzug | 144 Dateien, ein Commit ohne Vorgeschichte, Passwort von 2012 zurückgelassen |
| Zweite Stadt | Hamburg: 145 Gebiete, eigener Parser, Umschalter in den Einstellungen |
| Berlin-Konstanten | von 6 verstreuten Zahlenpaaren auf 1 Konfiguration |
| Unit-Tests | 129 → 179 |
| End-to-End-Tests | 93 → 101 |
| Gefundene Fehler | ein Wettlauf in der E2E-Suite, auf dem unveränderten Vorgängerstand reproduziert |
| Widerlegte eigene Behauptungen | 3 (Datenlayout, CA-Problem im Code, „Berlin steckt an drei Stellen") |

## Dieselbe Sitzung, zu Ende gemessen — 23:25 Uhr

Der Abschnitt darüber war ein **Zwischenstand**, aufgenommen um 16:21 Uhr. Die
Sitzung lief danach noch sieben Stunden weiter: Abhängigkeiten, mehrstädtiger
Worker, Umbenennung, die ganze Cloudflare-Einrichtung, Telegram. Hier die
Endabrechnung derselben Sitzung — abgerufen über `get_session` →
`external_metadata.usage`.

| Kennzahl | 16:21 Uhr | **23:25 Uhr** |
| --- | --- | --- |
| Laufzeit | 3 h 00 min | **10 h 04 min** |
| Kosten | 43,45 $ | **169,05 $** |
| Tokens gesamt | 69,77 Mio. | **268,84 Mio.** |
| davon Cache-Lesevorgänge | 69,05 Mio. (99 %) | **265,76 Mio. (98,9 %)** |
| Cache-Schreibvorgänge | — | 2,47 Mio. |
| Eingabe / Ausgabe | — | 130.487 / 473.125 |
| Verhältnis gelesen : geschrieben | 122 : 1 | **107 : 1** |
| Agenten | 0 | **1** (mehrstädtiger Worker) |
| Modell | `claude-opus-5` | `claude-opus-5`, kein Wechsel, kein Rückfall |

**Die Kosten sind nicht linear mit der Zeit gewachsen** — 43 $ in drei Stunden,
169 $ in zehn. Der Grund steht in derselben Zeile: Bei jeder Anfrage geht der
bisherige Verlauf erneut mit, und der Verlauf wird länger. Der Anteil des
Wiederlesens bleibt dabei fast konstant bei 99 %; was wächst, ist die absolute
Menge.

### Was die zweite Hälfte geliefert hat

| | |
| --- | --- |
| Abhängigkeiten | 11 Dependabot-PRs, alle zusammengeführt; MapLibre 6, Vite 8, TypeScript 7 |
| Worker | von einer Stadt auf beide — Stadt aus der Position statt aus der Konfiguration |
| Umbenennung | `parkingzone` → `knoellchenfrei` in Scope, Worker, Datenbank, Pages, Cache, Browser-Speicher |
| Infrastruktur | Worker, Pages, D1, KV, R2 und Kacheln laufen; Telegram-Bot samt Webhook |
| Einrichtung | ~900 Zeilen `scripts/einrichten.sh`, ein gelöschter Workflow |
| Unit-Tests | 179 → **190** |
| End-to-End-Tests | 101 → **107** |
| Gefundene Fehler in eigener Arbeit | **acht** allein beim ersten echten Lauf des Einrichtungsskripts |

### Die Kennzahl, die in keiner Spalte steht

Das Einrichtungsskript war **nie ausgeführt** worden, bevor es committet wurde.
Der erste echte Lauf gegen ein eingerichtetes Konto meldete acht Dinge falsch —
darunter vier angelegte Weiterleitungen als vier Misserfolge, weil ein
`grep`-Muster ein Leerzeichen nach dem Doppelpunkt nicht kannte.

Gekostet hat das keine Tokens, sondern **fremde Zeit**: die des Menschen, der
es ausgeführt und jeden Punkt gemeldet hat. Das ist die Währung, in der
schlecht geprüfte Arbeit abgerechnet wird, und sie taucht in keiner Abrechnung
auf. Wer diese Datei für eine Kostenrechnung liest, sollte die Zeile
mitdenken.

## Dieselbe Sitzung, die Nacht danach — 03:50 Uhr

Auch 23:25 Uhr war ein Zwischenstand. Danach kamen das Read-only-Audit, die
Städte-Recherche, Frankfurt, München, der Standort-Vorschlag und ein Agent nur
für die Testabdeckung. Zahlen wie oben aus `get_session` →
`external_metadata.usage`; der Zuwachs ist die Differenz zweier Abrufe.

| Kennzahl | 23:25 Uhr | **03:50 Uhr** | Zuwachs in der Nacht |
| --- | --- | --- | --- |
| Laufzeit | 10 h 04 min | **14 h 29 min** | 4 h 25 min |
| Kosten | 169,05 $ | **375,28 $** | 206,23 $ |
| Tokens gesamt | 268,84 Mio. | **481,91 Mio.** | 213,07 Mio. |
| davon Cache-Lesevorgänge | 265,76 Mio. (98,9 %) | **469,86 Mio. (97,5 %)** | 204,1 Mio. (95,8 %) |
| Cache-Schreibvorgänge | 2,47 Mio. | **10,15 Mio.** | 7,68 Mio. |
| Eingabe / Ausgabe | 130.487 / 473.125 | **318.735 / 1.575.891** | 188.248 / 1.102.766 |
| Verhältnis gelesen : geschrieben | 107 : 1 | **46 : 1** | 27 : 1 |
| Agenten | 1 | **12** | 11 |
| Modell | `claude-opus-5` | `claude-fable-5-1` als Orchestrator | ab 23:35 auf Wunsch gewechselt; die fünf Bau-Agenten auf `claude-opus-5` |

**Die Nacht hat mehr ausgegeben als der ganze Tag davor** — 1,10 Mio.
Ausgabe-Tokens gegen 0,47 Mio. — und das Verhältnis gelesen : geschrieben ist
von 107 : 1 auf 27 : 1 gefallen. Der Grund ist derselbe wie bei den Kosten je
Commit (10,85 $ gegen 2,11 $ am Tag): Fünf Agenten haben Code geschrieben
statt einer Kette aus kleinen Schritten, und sechs Audit-Agenten haben
dasselbe Repository sechsmal gelesen. Parallelität kostet Kontext, Kontext
kostet Geld; dafür lagen 24 Städte, 102 Befunde und zwei angeschlossene
Städte am Morgen vor.

### Was die Nacht geliefert hat

| | |
| --- | --- |
| Audit | 6 Reports, 102 Befunde dedupliziert (1 kritisch, 10 hoch), 4 davon behoben, 22 Actions auf SHAs gepinnt |
| Recherche | 24 Städte, 16 per Abruf geprüft; Kölns Gebührenfeld als veraltet belegt; Hamburgs zweiter Feed gefunden |
| Frankfurt | 27 Bereiche aus 808 Automaten, 46 Stadtteile, `HE` mit landesgebundenem Fronleichnam |
| München | 82 Gebiete aus 12.365 Straßenseiten, 291 Schreibweisen, Mariä Himmelfahrt an der Stadt, 5 Nebenebenen mit Lizenzbeleg |
| Oberfläche | Standort-Vorschlag, FAQ je Stadt, Beispieldaten je Stadt, Gruppenbilder `F`/`M` |
| Gefundene Fehler | 8 im eigenen Bestand, jeder mit Test: Feldtyp der Fixture, `isUncertainAt`, `seed.ts`, drei Nullbeträge, `Fr-Mo`, `reportedAt: NaN` |
| Unit-Tests | 190 → **463** |
| End-to-End-Tests | 107 → **128** (108 waren es wirklich — die 107 in `CLAUDE.md` waren um eins daneben) |
| Coverage | 96,1 % → **99,9 %** Zeilen, 90,4 % → 96,1 % Zweige, 100 % Funktionen |
| Commits | 19, alle mit grüner CI und vollem E2E-Lauf davor |

## Die dritte Sitzung: 7. auf 8. September 2026

**Stand 8. September, 04:20 Uhr** — die Sitzung läuft noch, die Zahlen sind
eine Momentaufnahme.

> Die Uhrzeit stand hier zuerst falsch (03:20). Ursache: Ich hatte GitHubs
> Zeitstempel gelesen, die in **UTC** stehen, und sie für Ortszeit gehalten —
> zwei Stunden Unterschied. Dieselbe Verwechslung steckt in der Falle, gegen
> die dieses Projekt `berlinWallClock` hat. Aufgeschrieben, weil eine
> Statistikdatei mit einer falschen Uhrzeit die schlechteste Sorte Fehler ist:
> Sie sieht aus wie eine Messung.

Diesmal gibt es **nur eine** Quelle: den Sitzungsverlauf als JSONL
(6.673 Zeilen, 28,9 MB). Die Buchhaltung (`get_session` →
`external_metadata.usage`) ist aus dieser Sitzung heraus nicht abrufbar. Nach
der Erfahrung der ersten Sitzung heisst das: **Die Zahlen unten überzeichnen
das Cache-Lesen wahrscheinlich erheblich** — dort standen 777 Mio. im Verlauf
gegen 483 Mio. in der Buchhaltung, ein Faktor von rund 1,6. Wer diese Zeile
fortschreibt, fragt die Buchhaltung noch einmal, bevor er sie glaubt.

### Modell

| | |
| --- | --- |
| Antworten von `claude-opus-5` | 2.554 |
| Antworten von `claude-fable-5-1` | 181 |
| Synthetische Nachrichten | 3 |
| Kontextfenster | 1.000.000 |

Der Anteil von Fable ist kein Zufall und kein Fallback: Der Plan für die
Nutzungsstatistik ist auf ausdrücklichen Wunsch von einem zweiten Modell
gegengelesen worden, bevor Opus ihn umgesetzt hat. Das sind die 181 Antworten.

### Tokens (aus dem Verlauf, nicht aus der Buchhaltung)

| Art | Tokens |
| --- | ---: |
| Eingabe | 9.746 |
| Ausgabe | 2.400.987 |
| Cache geschrieben | 11.593.836 |
| Cache gelesen | 1.392.191.097 |
| **Summe** | **1.406.195.666** |

Cache-Lesen macht **99,0 %** aus. Das ist die Kennzahl, die am meisten über die
Arbeitsweise sagt: Es wird sehr viel öfter wiedergelesen als geschrieben.

### Werkzeuge

1.746 Aufrufe in 19 verschiedenen Werkzeugen.

| Werkzeug | Aufrufe | Werkzeug | Aufrufe |
| --- | ---: | --- | ---: |
| Bash | 1.610 | WebSearch | 4 |
| Read | 31 | `actions_list` | 3 |
| Edit | 19 | TaskStop | 2 |
| TaskOutput | 13 | `create_event` | 2 |
| Write | 12 | `get_session` | 1 |
| Agent | 9 | `navigate` | 1 |
| WebFetch | 8 | `tabs_context` | 1 |
| ToolSearch | 7 | SendMessage | 1 |
| Artifact | 7 | PushNotification | 1 |

**92 % ist Bash.** Das ist kein Stilmerkmal, sondern eine Vorgabe dieser
Umgebung: Lesen mit `sed`, Suchen mit `grep`, Ändern mit `python3`-Heredocs
statt mit den dafür gedachten Werkzeugen. Der Preis steht in dieser Datei
selbst — ein zeilenbasiertes Ersetzen hat vier Abschnitte aus `docs/todo.md`
gefressen, und das ist genau die Fehlerklasse, die ein Werkzeug mit
Blockgrenzen nicht hat.

### Agenten

Neun, alle mit klar geschnittenem Schreibbereich:

| Agent | Was er durfte |
| --- | --- |
| Frankfurt am Main anschließen | eigene Dateien, integriert |
| München anschließen | eigene Dateien, integriert |
| Standort-Vorschlag und FAQ je Stadt | Oberfläche |
| Testabdeckung in `core` erhöhen | nur Tests |
| Cloud-Sitzung lokal fortsetzen | Übergabe |
| Fable prüft den Statistik-Plan | nur lesen |
| Köln vorbereiten | eigene Dateien, **nicht** integriert |
| Karlsruhe vorbereiten | eigene Dateien, **nicht** integriert |
| Düsseldorf vorbereiten | eigene Dateien, **nicht** integriert |

Die drei letzten hatten eine Auflage, die es vorher nicht gab: `core/city.ts`,
`core/index.ts` und `ingest/src/sources.ts` sind tabu. Alle drei haben sie
eingehalten — nachgeprüft über `git status`, nicht geglaubt.

Und einer von ihnen hat in seinem Bericht einen Fehler von **mir** gemeldet:
Ein `git add -A` hatte seine Fixtures mitcommittet, eine Minute nachdem er sie
geschrieben hatte. Das ist der zweite Vorfall derselben Art in dieser Nacht,
und die Regel dagegen stand zu diesem Zeitpunkt seit zwei Stunden in
`CLAUDE.md` — von mir geschrieben.

### Übrige Kennzahlen

| | |
| --- | ---: |
| Laufzeit | 25 h 53 min |
| Echte Nachrichten des Nutzers | 52 |
| Assistenten-Nachrichten | 2.738 |
| Commits | 111 |
| Geänderte Zeilen | +42.264 / −3.618 |
| Unit-Tests am Ende | 654 |
| End-to-End-Tests | 154 |
| Coverage (`core`) | 99,9 % Zeilen |

**52 Nachrichten auf 111 Commits** ist das Verhältnis, um das es in dieser
Sitzung ging: Der Auftrag lautete, die Nacht durchzuarbeiten. Was dabei
herauskam, steht in [nachtplan-2026-09-08.md](nachtplan-2026-09-08.md) — und
was dabei schiefging, steht dort im selben Dokument, Abschnitt D.

### Wie diese Zahlen entstanden sind

```bash
node scripts/protokoll.mjs ~/.claude/projects/<projekt>/<sitzung>.jsonl
```

Das Skript liegt seit dem 8. September im Repository, damit die Zahlen dieser
Datei nachrechenbar sind statt behauptet. Es liest den Verlauf zeilenweise,
summiert die `usage`-Felder der Assistenten-Nachrichten und zählt
`tool_use`-Blöcke.

Eine „echte" Nachricht des Nutzers ist eine mit reinem Text —
Werkzeugergebnisse kommen im Verlauf ebenfalls als `type: "user"` an und wären
sonst mitgezählt worden: **1.395 statt 51**. Wer diesen Unterschied nicht
macht, misst nicht, wie viel Führung eine Sitzung gebraucht hat, sondern wie
viele Werkzeuge sie benutzt hat.
