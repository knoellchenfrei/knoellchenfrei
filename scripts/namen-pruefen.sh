#!/usr/bin/env bash
#
# Prüft, dass die Namen der Cloudflare-Ressourcen überall dieselben sind.
#
# Warum das eine Prüfung ist und keine gemeinsame Datei: Worker-, Datenbank-,
# Pages- und Eimername stehen in vier Sprachen — TOML, Shell, YAML und einmal
# in einer Dokumentationszeile. Eine geteilte Quelle müsste jede davon
# erreichen; eine Indirektion über relative Pfade wäre fragiler als das
# Problem, das sie löst. Stattdessen darf jede Datei ihren Namen selbst
# nennen, und dieser Lauf sagt es laut, wenn zwei auseinanderlaufen
# (Audit-Punkt M-035).
#
# Der Anlass ist echt: Am 6. September wurde `parkingzone` zu
# `knoellchenfrei` umbenannt, und der Arbeitstitel steckte in sieben Stellen —
# npm-Scope, Worker, Datenbank, Pages-Projekt, Cache-Name des Service Workers
# und Browser-Speicher. Gefunden hat ihn niemand automatisch.

set -euo pipefail

WURZEL="$(cd "$(dirname "$0")/.." && pwd)"
cd "$WURZEL"

fehler=0
melde() { printf '  ✗ %s\n' "$1" >&2; fehler=$((fehler + 1)); }
gut()   { printf '  ✓ %s\n' "$1"; }

# Der Worker: wrangler.toml ist die Quelle, das Skript muss folgen.
worker_toml="$(grep -m1 '^name = ' app/apps/api/wrangler.toml | sed 's/.*"\(.*\)"/\1/')"
worker_skript="$(grep -m1 '^WORKER_NAME=' scripts/einrichten.sh | sed 's/.*"\(.*\)"/\1/')"
if [ "$worker_toml" = "$worker_skript" ]; then
  gut "Worker: $worker_toml"
else
  melde "Worker heisst in wrangler.toml '$worker_toml', in einrichten.sh '$worker_skript'"
fi

# Die Datenbank: wrangler.toml, Einrichtung und Sicherung.
db_toml="$(grep -m1 '^database_name = ' app/apps/api/wrangler.toml | sed 's/.*"\(.*\)"/\1/')"
db_einr="$(grep -m1 '^D1_NAME=' scripts/einrichten.sh | sed 's/.*"\(.*\)"/\1/')"
db_sich="$(grep -m1 '^D1_NAME=' scripts/sichern.sh | sed 's/.*:-\(.*\)}"/\1/')"
if [ "$db_toml" = "$db_einr" ] && [ "$db_toml" = "$db_sich" ]; then
  gut "Datenbank: $db_toml"
else
  melde "Datenbank: wrangler.toml '$db_toml', einrichten.sh '$db_einr', sichern.sh '$db_sich'"
fi

# Das Pages-Projekt: Einrichtung und Deploy-Workflow.
pages_skript="$(grep -m1 '^PAGES_PROJEKT=' scripts/einrichten.sh | sed 's/.*"\(.*\)"/\1/')"
pages_deploy="$(grep -m1 -oE 'project-name=[A-Za-z0-9_-]+' .github/workflows/deploy.yml | cut -d= -f2)"
if [ "$pages_skript" = "$pages_deploy" ]; then
  gut "Pages-Projekt: $pages_skript"
else
  melde "Pages-Projekt: einrichten.sh '$pages_skript', deploy.yml '$pages_deploy'"
fi

# Der R2-Eimer: Einrichtung und Kachelskript.
eimer_skript="$(grep -m1 '^R2_EIMER=' scripts/einrichten.sh | sed 's/.*"\(.*\)"/\1/')"
eimer_kacheln="$(grep -m1 '^EIMER=' app/packages/ingest/scripts/build-tiles.sh | sed 's/.*"\(.*\)"/\1/')"
if [ "$eimer_skript" = "$eimer_kacheln" ]; then
  gut "R2-Eimer: $eimer_skript"
else
  melde "R2-Eimer: einrichten.sh '$eimer_skript', build-tiles.sh '$eimer_kacheln'"
fi

# Der alte Arbeitstitel darf nur noch dort stehen, wo er eine **historische
# Tatsache** ist: die Adresse des alten Repositories `herbeus/parkingzone` und
# die JDBC-Zeile von 2012. Alles andere wäre ein Überbleibsel der
# Umbenennung. Diese Datei selbst ist ausgenommen — sie muss den Namen nennen,
# um nach ihm suchen zu können.
alt="$(grep -rn 'parkingzone' --include='*.ts' --include='*.tsx' --include='*.toml' \
  --include='*.sh' --include='*.yml' --include='*.json' app scripts .github 2>/dev/null \
  | grep -v node_modules \
  | grep -v '^scripts/namen-pruefen.sh:' \
  | grep -v 'herbeus/parkingzone' || true)"
if [ -z "$alt" ]; then
  gut "'parkingzone' nur noch als historische Adresse"
else
  melde "Arbeitstitel 'parkingzone' steht noch in:"
  printf '%s\n' "$alt" | sed 's/^/      /' >&2
fi

if [ "$fehler" -gt 0 ]; then
  printf '\n%s Abweichung(en). Eine Umbenennung muss alle Stellen treffen.\n' "$fehler" >&2
  exit 1
fi
printf '\nAlle Namen stimmen überein.\n'
