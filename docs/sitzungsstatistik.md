# Sitzungsstatistik

Zwei Sitzungen, gemessen statt geschätzt: der **Umbau** vom 5./6. September und
die **Fortsetzung** am Nachmittag desselben Tages, in der das Projekt umzog und
Hamburg dazukam. Die zweite steht [ganz unten](#die-fortsetzung-umzug-und-zweite-stadt).

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

# Verlauf der eigenen Sitzung
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

**Wichtige Einschränkung, die es bei der Vorgängersitzung nicht gab:** Die
Buchhaltung (`get_session` → `external_metadata`) führt für diese Sitzung
**keinen `usage`- und keinen `cost_usd`-Block**. Es gibt also keine maßgebliche
Quelle, nur den Sitzungsverlauf — und der zählt Streaming-Zwischenstände
mehrfach, wie oben festgestellt. **Die Tokenzahlen unten sind deshalb eine
Obergrenze, keine Abrechnung.** Kosten lassen sich gar nicht angeben.

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

### Tokens (Obergrenze aus dem Verlauf)

| Art | Tokens |
| --- | ---: |
| Eingabe | 1.084 |
| Ausgabe | 427.456 |
| Cache geschrieben | 2.187.925 |
| Cache gelesen | 170.865.142 |
| **Summe** | **173.481.607** |

Wieder **98 % Cache-Lesevorgänge** — das Verhältnis von Wiederlesen zu
Schreiben ist mit rund 400 : 1 sogar noch ungünstiger als die 230 : 1 des
Umbaus. Der Grund liegt auf der Hand: Diese Sitzung startete mit einem
fertigen, großen Projekt, dessen Kontext ab der ersten Anfrage mitging.

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
