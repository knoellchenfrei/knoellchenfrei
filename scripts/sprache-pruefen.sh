#!/usr/bin/env bash
#
# Hält die Sprachregel aus CONTRIBUTING.md ein — Prosa mit Umlauten,
# Bezeichner ohne.
#
# Warum es das braucht: Ein Audit hat im September 2026 fünf Befunde zur
# Sprache aufgeschrieben (M-063 bis M-067), und alle fünf lauteten im Kern
# „gemischt, ohne erkennbare Regel". Eine Regel, die nur in einer Datei steht,
# zerfällt beim nächsten Beitrag wieder. Diese Prüfung läuft in der CI mit.
#
# Was sie sucht: deutsche Prosawörter in der Ersatzschreibung — `Pruefung`
# statt `Prüfung`, `fuer` statt `für`. Die Liste ist bewusst kurz und nennt nur
# Wörter, die **kein** Bezeichner, Feldname oder Stadtschlüssel sein können.
# `muenchen`, `staedte.md`, `--pruefen` und `gebuehrenzone` stehen deshalb
# nicht darin: Dort ist ASCII richtig.
#
# Was sie NICHT prüft und warum: Testtitel und Kommentare auf ihre Sprache hin.
# Das ginge nur mit einer Heuristik, die bei jedem englischen Bezeichner in
# einem `describe` anschlägt. Der Bestand ist am 7. September einmal von Hand
# angeglichen worden; alles Weitere ist Sache des Reviews.
#
# Aufruf:
#   ./scripts/sprache-pruefen.sh
#
# Geschrieben für die Bash, die auf macOS liegt (3.2).

set -u

WURZEL="$(cd "$(dirname "$0")/.." && pwd)"
cd "$WURZEL" || exit 1

if [ -t 1 ] && [ -z "${NO_COLOR:-}" ]; then
  F_ROT=$'\033[31m'; F_GRUEN=$'\033[32m'; F_AUS=$'\033[0m'
else
  F_ROT=''; F_GRUEN=''; F_AUS=''
fi

# Die Ersatzschreibungen, an denen es hängt. Ein Wort gehört nur hierher, wenn
# es in diesem Projekt niemals ein Bezeichner ist.
WOERTER='fuer|Fuer|dafuer|ueber|Ueber|ueberall|ueberhaupt|uebrig|koennen|koennte|muessen|duerfen|wuerde|zurueck|Rueckfall|Rueckmeldung|Rueckmeldungen|naechste|naechsten|spaeter|waere|waeren|haette|haetten|haelt|laeuft|laesst|laedt|faellt|faengt|gehoert|gehoeren|loeschen|Loesung|Schluessel|Groesse|moeglich|noetig|oeffentlich|Oberflaeche|gefaehrlich|haeufig|naemlich|zunaechst|zusaetzlich|vollstaendig|grundsaetzlich|ungueltig|gueltig|verfuegbar|erwaehnt|aehnlich|Aenderung|aendern|geaendert|Behoerde|Behoerden|Erklaerung|erklaert|zaehlt|zaehlen|traegt|haengt|prueft|geprueft|Pruefung|Eintraege|Saetze|Staedte|Haelfte|juengste|staerker|Begruendung|Buendel|Privatsphaere|Empfaenger|waehrend|waehlt|gewaehlt|bestaetigt|ausgefuehrt|Ausfuehrung|erfuellt|woertlich|hoechstens|Menue|Maerz|unabhaengig|abhaengig|Abhaengigkeit|Abhaengigkeiten|Zaehlanweisung|Zaehlanweisungen|Gebuehrenerhoehung|Anfuehrungszeichen|Aenderungen|erhoeht|verkuerzt|Erklaerungen|zusaetzliche|nachtraeglich'

# Wo nicht gesucht wird, und warum:
#   audit/    empfangener Bericht — wird nicht redigiert, auch nicht orthografisch
#   fixtures/ Quelldaten der Behörden, jede Änderung wäre eine Fälschung
#   dist*/    erzeugt
# Und diese Datei selbst: Sie muss die Ersatzschreibungen nennen, um nach ihnen
# suchen zu können — genau wie `namen-pruefen.sh` den alten Projektnamen nennt.
AUS='-path ./node_modules -prune -o -path ./.git -prune -o -path ./audit -prune -o
     -path ./app/node_modules -prune -o -path ./app/apps/web/dist -prune -o
     -path ./app/apps/web/dist-artifact -prune -o -path ./app/packages/core/test/fixtures -prune -o
     -path ./app/packages/core/coverage -prune -o'

# shellcheck disable=SC2086
DATEIEN="$(find . $AUS \( -name '*.ts' -o -name '*.tsx' -o -name '*.mjs' \
  -o -name '*.yml' -o -name '*.sh' -o -name '*.md' \) -print | grep -v sprache-pruefen.sh)"

# Ein Treffer zählt nur als Wort für sich: `pruefeKachelAdresse` ist ein
# Bezeichner und richtig so, `namen-pruefen.sh` ein Dateiname.
#
# Und was in Grave-Akzenten steht, ist ein Zitat: ein Bezeichner, ein Befehl
# oder — in CONTRIBUTING.md — die falsche Schreibweise als Beispiel. Genau
# daran hat sich diese Prüfung beim ersten Lauf gestoßen: Sie fand die Regel,
# die sie durchsetzt. Deshalb fällt jede Code-Spanne vor dem Suchen weg;
# **Und was diese Löschung mit verdeckt: einen Umlaut IN den Akzenten.** Ein
# `geprueftAm`, das jemand beim Ersetzen von `ae` nach `ä` mitgenommen hat,
# wird hier nicht gesehen — obwohl ein Bezeichner mit Umlaut genau das ist, was
# die Regel verbietet. Am 9. September geprüft, ob sich das schliessen lässt:
# **134 Stellen** im Bestand haben einen Umlaut in Grave-Akzenten, und fast
# alle sind richtig — `täglich 9-2 Uhr`, `Höchstparkdauer`, `Gebührenzeit` sind
# Feed-Werte, die ihn wirklich tragen, und `ä ö ü ß` steht in CONTRIBUTING.md
# als die Regel selbst. Eine Prüfung darauf wäre 134-mal falsch. Sie gibt es
# deshalb bewusst nicht; wer `ae` nach `ä` ersetzt, sieht die Akzente von Hand
# durch.
#
# `sed` löscht sie, ohne Zeilen zu entfernen, die Zeilennummern stimmen also
# weiter.
treffer=''
while IFS= read -r datei; do
  [ -n "$datei" ] || continue
  # shellcheck disable=SC2016  # Der Grave-Akzent ist hier Suchmuster, keine Ersetzung.
  fund="$(sed 's/`[^`]*`//g' "$datei" \
    | grep -nE "(^|[^-/_A-Za-z0-9])($WOERTER)([^-/._A-Za-z0-9]|$)" 2>/dev/null \
    | sed "s|^|$datei:|")"
  [ -n "$fund" ] && treffer="$treffer$fund
"
done <<EOF
$DATEIEN
EOF

if [ -n "$treffer" ]; then
  printf '  %s✗%s Ersatzschreibung statt Umlaut in Prosa:\n' "$F_ROT" "$F_AUS" >&2
  printf '%s\n' "$treffer" | head -40 | sed 's/^/      /' >&2
  printf '\n  Die Regel steht in CONTRIBUTING.md, Abschnitt "Sprache":\n' >&2
  printf '  Prosa bekommt echte Umlaute, Bezeichner bleiben ASCII.\n' >&2
  exit 1
fi
printf '  %s✓%s Prosa durchgehend mit Umlauten\n' "$F_GRUEN" "$F_AUS"
