#!/usr/bin/env bash
#
# Prüft die **Sicherheitseinstellungen des Repositories** gegen das, was hier
# als verbindlich steht.
#
# Warum es das gibt: Vier Sicherheitsnetze dieses Projekts werden geprüft —
# der Riegel vor der Auslieferung (`ausgeliefert-pruefen.sh`), keine Secrets im
# Bündel (`geheimnisse-pruefen.sh`), verwundbare Abhängigkeiten (`pnpm audit`
# in der CI) — und eines gar nicht: die Schalter bei GitHub. Die stehen in
# einer Weboberfläche, sind mit zwei Klicks aus, und niemand merkt es. Ein
# Schutz, der nur in einer Erinnerung existiert, ist keiner.
#
# Der Anlass, am 9. September: In `docs/oeffentlich-machen.md` stand ein
# MySQL-Passwort von 2012 wörtlich — in einem seit dem 6. September
# öffentlichen Repository. Secret Scanning hat nichts gemeldet, und das war
# richtig: Ein zwölf Jahre altes Passwort passt auf kein Anbietermuster. Der
# Schalter, der es gefunden hätte, heisst `non_provider_patterns` und stand
# aus. Aufgefallen ist es beim Lesen, nicht durch eine Prüfung.
#
#   ./scripts/einstellungen-pruefen.sh
#
# Rückgabewerte, und der Unterschied ist der Punkt:
#
#   0  alles wie festgelegt
#   1  mindestens eine Abweichung
#   2  **nicht prüfbar** — kein `gh`, keine Anmeldung, oder das Token darf die
#      Einstellungen nicht lesen. Das ist ausdrücklich **nicht** 0: „konnte
#      nicht messen" als Erfolg zu melden ist genau der Fehler, gegen den
#      dieses Projekt sonst anschreibt.
#
# Läuft absichtlich **nicht** in der CI: `GITHUB_TOKEN` eines Workflows hat
# keine Verwaltungsrechte am Repository und bekäme für jedes Feld `null` — die
# Prüfung wäre dort immer „nicht prüfbar". Sie gehört an denselben Platz wie
# `ausgeliefert-pruefen.sh`: von Hand, vom Rechner des Betreibers.
set -uo pipefail

REPO="${1:-knoellchenfrei/knoellchenfrei}"

if ! command -v gh >/dev/null 2>&1; then
  printf '  ? gh fehlt — die Einstellungen sind von hier aus nicht prüfbar.\n' >&2
  exit 2
fi

antwort="$(gh api "repos/$REPO" 2>/dev/null)" || {
  printf '  ? %s ist nicht abrufbar (Anmeldung? Rechte?).\n' "$REPO" >&2
  exit 2
}

lies() { # feld -> Wert oder leer
  printf '%s' "$antwort" | python3 -c "
import json, sys
d = json.load(sys.stdin).get('security_and_analysis') or {}
print((d.get('$1') or {}).get('status', ''))
"
}

# Ein leeres `security_and_analysis` heisst nicht „alles aus", sondern „darf
# ich nicht sehen". Beides sähe in einer Feldabfrage gleich aus.
if [ -z "$(printf '%s' "$antwort" | python3 -c 'import json,sys; print(json.load(sys.stdin).get("security_and_analysis") or "")')" ]; then
  printf '  ? Das Token darf `security_and_analysis` nicht lesen — nicht prüfbar.\n' >&2
  exit 2
fi

fehler=0
pruefe() { # name erwartet ist
  if [ "$3" = "$2" ]; then
    printf '  ok   %-42s %s\n' "$1" "$3"
  else
    printf '  ✗    %-42s %s (erwartet: %s)\n' "$1" "$3" "$2"
    fehler=$((fehler + 1))
  fi
}

printf '\nSicherheitsschalter von %s\n' "$REPO"

pruefe 'secret_scanning'                        enabled "$(lies secret_scanning)"
pruefe 'secret_scanning_push_protection'        enabled "$(lies secret_scanning_push_protection)"
pruefe 'dependabot_security_updates'            enabled "$(lies dependabot_security_updates)"
# Der Schalter, der den Vorfall vom 9. September gefunden hätte.
pruefe 'secret_scanning_non_provider_patterns'  enabled "$(lies secret_scanning_non_provider_patterns)"

# `secret_scanning_validity_checks` steht **nicht** in der Liste der Felder, die
# „Update a repository" laut Doku annimmt (nachgesehen am 9. September; neu
# dazugekommen ist dort `secret_scanning_ai_detection`). Die Leseabfrage nennt
# es weiter. Ob es sich noch setzen lässt, ist damit offen — und eine Prüfung,
# die etwas verlangt, das man vielleicht gar nicht mehr einstellen kann, wäre
# dieselbe Sorte Ärgernis wie eine WAF-Regel, die aufgehört hat, kostenlos zu
# sein. Deshalb steht es als Hinweis da und zählt nicht als Abweichung.
gueltigkeit="$(lies secret_scanning_validity_checks)"
printf '  –    %-42s %s (nur zur Kenntnis, siehe Kommentar)\n' \
  'secret_scanning_validity_checks' "${gueltigkeit:-unbekannt}"

pvr="$(gh api "repos/$REPO/private-vulnerability-reporting" --jq '.enabled' 2>/dev/null || echo '?')"
pruefe 'private_vulnerability_reporting'        true "$pvr"

printf '\nErgebnis\n'
if [ "$fehler" -eq 0 ]; then
  printf '  ✓ Alle Schalter stehen wie festgelegt.\n'
  exit 0
fi

printf '  ✗ %s Abweichung(en).\n\n' "$fehler"
printf '    In den Einstellungen: Settings → Seitenleiste „Security and quality"\n'
printf '    → Advanced Security → Abschnitt „Secret Protection". Der Schalter für\n'
printf '    `non_provider_patterns` heisst dort inzwischen **Generic patterns**;\n'
printf '    die alte Adresse .../settings/security_analysis gibt es nicht mehr.\n\n'
printf '    Oder: gh api -X PATCH repos/%s \\\n' "$REPO"
printf "      -F 'security_and_analysis[<feld>][status]=enabled'\n"
exit 1
