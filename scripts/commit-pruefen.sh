#!/usr/bin/env bash
# Prüft Commit-Betreffs gegen Conventional Commits — und gegen die Sprachregel.
#
#   ./scripts/commit-pruefen.sh              # alles seit origin/main
#   ./scripts/commit-pruefen.sh <von>..<bis> # ein Bereich, wie in der CI
#
# Erwartet wird `typ(bereich): betreff` mit einem Typ aus der Liste unten,
# der Betreff deutsch, im Imperativ und in ASCII (Bezeichner-Regel aus
# CONTRIBUTING.md: `Staedte`, nicht `Städte`). Höchstens 72 Zeichen; die
# Bumps von Dependabot dürfen länger sein, weil ihr Betreff aus zwei
# Paketnamen und zwei Versionen besteht, die niemand kürzt. Merge-Commits
# und `Revert "…"` sind Werkzeugausgaben und bleiben unangetastet.
#
# Warum überhaupt: Die Historie bis zum 9. September hatte gute Betreffs
# und keine Form. Eine Form, die eine Maschine lesen kann, ist der Preis
# dafür, später ein CHANGELOG aus der Historie zu erzeugen (siehe
# docs/entscheidungen.md, „Kein CHANGELOG — vorerst") — und sie beendet die
# stille Abweichung, dass Betreffs mit Umlauten durchgingen.
set -euo pipefail

bereich="${1:-origin/main..HEAD}"
typen='feat|fix|docs|test|refactor|perf|build|ci|chore|revert|style'
muster="^(${typen})(\([a-z0-9,/-]+\))?!?: [^ ].*$"

fehler=0
gesamt=0
while IFS= read -r zeile; do
  [ -n "$zeile" ] || continue
  gesamt=$((gesamt + 1))
  sha="${zeile%% *}"
  betreff="${zeile#* }"
  case "$betreff" in
    "Merge "*|"Revert \""*) continue ;;
  esac
  befund=""
  if ! printf '%s' "$betreff" | grep -Eq "$muster"; then
    befund="kein Conventional Commit (typ(bereich): betreff)"
  elif LC_ALL=C printf '%s' "$betreff" | grep -q '[^ -~]'; then
    befund="Betreff nicht in ASCII — Umlaute als ae/oe/ue/ss schreiben"
  elif [ "${#betreff}" -gt 72 ] && [[ "$betreff" != build\(deps* ]]; then
    befund="Betreff länger als 72 Zeichen (${#betreff})"
  fi
  if [ -n "$befund" ]; then
    fehler=$((fehler + 1))
    printf '  ✗ %s  %s\n      %s\n' "$sha" "$betreff" "$befund"
  fi
done < <(git log --format='%h %s' "$bereich" 2>/dev/null)

if [ "$gesamt" -eq 0 ]; then
  echo "  – keine Commits in $bereich"
  exit 0
fi
if [ "$fehler" -eq 0 ]; then
  echo "  ✓ $gesamt Commit-Betreffs in $bereich nach Conventional Commits, in ASCII"
  exit 0
fi
echo "  $fehler von $gesamt Betreffs in $bereich halten die Form nicht (CONTRIBUTING.md, Abschnitt Commit-Nachrichten)"
exit 1
