# Mitmachen

## Schnellstart

```bash
cd app
pnpm install
pnpm test          # 190 Unit-Tests
pnpm typecheck
pnpm --filter @knoellchenfrei/web dev
```

## Grundsätze

**Nicht raten, wenn die Quelle schweigt.** Die Berliner Daten sind stellenweise
unvollständig oder mehrdeutig. Wo das so ist, sagt die App es — sie füllt die
Lücke nicht mit einer plausiblen Annahme. Beispiel: Vier Spandauer Zonen nennen
„Advents-Sa", ohne zu definieren, welche Samstage gemeint sind. Die App zeigt an
diesen Tagen „unsicher" statt einer Auslegung.

**Laut scheitern statt still falsch liegen.** Der Parser bricht den Datenbuild
ab, wenn er eine Fahrplanangabe nicht versteht. Eine falsch geparste Zone würde
jemandem einen Preis nennen, für den er dann ein Knöllchen bekommt.

**Kommentare erklären das Warum.** Was der Code tut, steht im Code. Warum er es
so tut — welcher Fehler dahintersteht, welche Alternative verworfen wurde —
gehört in einen Kommentar.

**Tests belegen echte Fehler.** Jeder Regressionstest in `hardening.test.ts`
scheitert ohne den zugehörigen Fix. Tests, die nur bestätigen, dass Code
existiert, helfen niemandem.

## Sprache

Das Projekt ist deutsch. Nur: „deutsch" allein reicht nicht als Regel — ein
Audit hat im September 2026 fünf Befunde dazu aufgeschrieben (M-063 bis M-067),
und alle fünf lauteten im Kern „gemischt, ohne erkennbare Regel". Deshalb steht
sie hier, und ein Skript hält sie.

**Die Trennlinie ist nicht deutsch/englisch, sondern Prosa/Bezeichner.**

| | Sprache | Umlaute |
| --- | --- | --- |
| Kommentare, Dokumentation, Testtitel, Ausgabetexte, Oberfläche | deutsch | **echte**: `ä ö ü ß` |
| Bezeichner, Dateinamen, Schlüssel, Feldnamen, Kommandozeilen-Schalter | wie der Bestand, meist englisch | **ASCII**: `ae oe ue ss` |
| Commit-Nachrichten und Branch-Namen | deutsch | **ASCII** |

Warum die zweite Zeile ASCII bleibt: Bezeichner werden getippt, kopiert, in
Adressen gesetzt, mit `grep` gesucht und von Werkzeugen verglichen. Der
Stadtschlüssel heißt `muenchen` und nicht `münchen`, die Datei `staedte.md` und
nicht `städte.md`, der Schalter `--pruefen` und nicht `--prüfen`. Das ist keine
Nachlässigkeit, sondern die Regel.

Warum Commit-Nachrichten ASCII sind: Sie laufen durch Terminals, Mail-Gateways
und Weboberflächen mit unterschiedlichen Annahmen über die Kodierung. Ein
Betreff, der in einer davon zerfällt, ist schlechter lesbar als einer mit `ue`.

Prosa dagegen wird **gelesen**, und da ist `Prüfung` richtig und `Pruefung`
falsch. `./scripts/sprache-pruefen.sh` prüft das und läuft in der CI mit.

Für Testtitel gilt dieselbe Trennung. Ein `describe`, das eine Funktion
benennt, trägt ihren Namen (`describe('parseHamburgFee', …)`); alles, was ein
Satz ist, ist ein deutscher Satz:

```ts
describe('parseHamburgFee', () => {
  it('behandelt die Parkscheibe als eigene Art, nicht als Preis von null', …)
})
```

Zwei Ausnahmen, die absichtlich stehen bleiben:

- **Englische Kommentare im Bestand** bleiben, wo sie sind. Neu geschriebener
  Code bekommt deutsche. Eine Übersetzungswelle über gewachsenen Code erzeugt
  Diffs, die niemand liest, und verliert dabei Nuancen. Testtitel sind davon
  ausgenommen — die sind am 7. September einmal vollständig angeglichen worden,
  weil sie kurz sind und in der Testausgabe nebeneinanderstehen.
- **`audit/`** ist ein empfangener Bericht und wird nicht redigiert — auch
  nicht orthografisch. Ein Befund, den man nachträglich glattzieht, ist als
  Beleg wertlos.

**Dateinamen bleiben, wie sie sind.** `architecture.md`, `data-sources.md` und
`hosting.md` heißen englisch, der Rest deutsch — das ist gewachsen und sieht
willkürlich aus (Audit-Punkt M-066). Umbenennen hieße: jeden Verweis in jeder
Datei mitziehen, und jeden Link brechen, den irgendwer gesetzt hat. Der
Gegenwert wäre Ästhetik. Neue Dateien bekommen deutsche Namen in ASCII.

## Struktur

```
app/packages/core      Domänenlogik, framework-frei. Keine Laufzeitabhängigkeit.
app/packages/ingest    WFS → eingefrorene Web-Assets, Badges, Artifact-Bundle
app/apps/web           PWA: React 19, Vite 8, MapLibre GL 6
app/apps/api           Cloudflare Worker: WFS-Cache, geteilte Meldungen, Telegram
```

Das Java-Original von 2012 ist beim Umzug am 6. September 2026 im alten
Repository geblieben; seine Ideenliste zieht kommentiert mit:
[docs/ideen-2012.md](docs/ideen-2012.md).

`core` darf nichts aus `apps/` importieren und kein Framework kennen.

## Vor einem Pull Request

```bash
cd app
pnpm typecheck
pnpm test
pnpm test:coverage    # Schwellwerte: 85 % Zeilen, 80 % Zweige
pnpm --filter @knoellchenfrei/web build
cd apps/web && npx playwright test
```

Die CI führt dasselbe aus.

## Daten aktualisieren

```bash
pnpm --filter @knoellchenfrei/ingest fetch-data
pnpm --filter @knoellchenfrei/ingest build-data
```

Schlägt `build-data` fehl, hat der Feed eine Schreibweise, die der Parser nicht
kennt. Das ist Absicht: erst den Parser erweitern und einen Test dafür
schreiben, dann neu bauen.

## Commit-Nachrichten

Erste Zeile im Imperativ, unter 72 Zeichen, **deutsch und in ASCII** (siehe
oben: `Kacheln fuer alle vier Staedte`). Der Rumpf erklärt, warum die Änderung
nötig war — welches Verhalten falsch war und woran man das gemerkt hat.

Zwei Sorten Nachrichten halten sich nicht daran, und das bleibt so: die von
**Dependabot** erzeugten und die Standardtexte von `git merge`. Beide kommen
von Werkzeugen; sie umzuschreiben hieße, den Automaten zu verstecken, der sie
geschrieben hat (Audit-Punkt M-067).
