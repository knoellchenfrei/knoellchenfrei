#!/usr/bin/env bash
#
# Sucht Geheimnisse im ausgelieferten Bündel — und beweist, dass es das kann.
#
# Vorher stand in `ci.yml` eine einzelne Regex, die auf
# `token = "…"`-Schreibweisen zielte. Sie hätte **keines** der Geheimnisse
# gefunden, die dieses Projekt tatsächlich hat: Ein Cloudflare-Token steht als
# `cfut_…` da, ein Telegram-Token als `123456789:AA…`, und beide kämen über
# eine falsch benannte `VITE_`-Variable ins Bündel, nicht über eine Zuweisung
# mit dem Wort „token" daneben (Audit-Punkt M-091).
#
# Der zweite Teil des Befunds war, dass niemand die Prüfung je hat anschlagen
# sehen. Eine Prüfung, die nie etwas findet, ist von einer kaputten Prüfung
# nicht zu unterscheiden — dieses Projekt hat den Fehler dreimal gemacht
# (`cache.addAll`, `pnpm fetch`, das Einrichtungsskript). Deshalb läuft vor
# jedem Durchgang ein **Selbsttest** gegen ein Verzeichnis mit erfundenen
# Geheimnissen: Findet er die nicht, bricht das Skript ab, bevor es das echte
# Verzeichnis überhaupt ansieht.
#
# Aufruf:
#   ./scripts/geheimnisse-pruefen.sh [verzeichnis …]   Vorgabe: das Web-Bündel
#
# Geschrieben für die Bash, die auf macOS liegt (3.2).

set -u

WURZEL="$(cd "$(dirname "$0")/.." && pwd)"

if [ -t 1 ] && [ -z "${NO_COLOR:-}" ]; then
  F_ROT=$'\033[31m'; F_GRUEN=$'\033[32m'; F_AUS=$'\033[0m'
else
  F_ROT=''; F_GRUEN=''; F_AUS=''
fi
ok()      { printf '  %s✓%s %s\n' "$F_GRUEN" "$F_AUS" "$1"; }
schlimm() { printf '  %s✗%s %s\n' "$F_ROT" "$F_AUS" "$1" >&2; }

# Die Muster, je Zeile: <Name>|<erweiterte Regex>
#
# Bewusst an konkreten Formen entlang und nicht an Wörtern: Ein Wort wie
# „token" steht in diesem Bündel legitim an Dutzenden Stellen, die Form
# `cfut_…` an keiner. Was hier fehlt, sind Cloudflares alte 37-stellige
# Schlüssel — reine Hex-Ketten dieser Länge stehen auch in Kartendaten, und
# ein Muster, das dauernd falschen Alarm gibt, wird abgeschaltet statt gelesen.
MUSTER='
Cloudflare-Token|cf[ua]t_[A-Za-z0-9_-]{20,}
Telegram-Bot-Token|[0-9]{8,10}:AA[A-Za-z0-9_-]{30,}
GitHub-Token|gh[pousr]_[A-Za-z0-9]{36}
GitHub-PAT|github_pat_[A-Za-z0-9_]{60,}
AWS-Schluessel|AKIA[0-9A-Z]{16}
Privater Schlüssel|-----BEGIN [A-Z ]*PRIVATE KEY-----
Slack-Token|xox[baprs]-[A-Za-z0-9-]{10,}
Zuweisung mit langem Wert|(api[_-]?key|secret|password|passwort)["'"'"']?[[:space:]]*[:=][[:space:]]*["'"'"'][A-Za-z0-9_/+-]{20,}
'

# Durchsucht ein Verzeichnis. Gibt 0 zurück, wenn nichts gefunden wurde.
durchsuchen() {
  local ziel="$1" name regex treffer gefunden=0
  [ -d "$ziel" ] || { schlimm "Kein Verzeichnis: $ziel"; return 2; }
  while IFS='|' read -r name regex; do
    [ -n "$name" ] || continue
    # `-I` lässt Binärdateien aus, `-r` geht in die Tiefe, und `-e` ist
    # Pflicht: Das Muster für private Schlüssel fängt mit `-----` an, und
    # ohne `-e` hält grep das für Optionen. Der Selbsttest hat genau das
    # beim ersten Lauf gefunden — zusammen mit einem Muster, für das der
    # Koeder fehlte.
    treffer="$(grep -rIoE -e "$regex" "$ziel" 2>/dev/null | head -5)"
    if [ -n "$treffer" ]; then
      schlimm "$name:"
      printf '%s\n' "$treffer" | sed 's/^/      /' >&2
      gefunden=1
    fi
  done <<EOF
$MUSTER
EOF
  return $gefunden
}

# Ein Verzeichnis mit erfundenen Geheimnissen, gegen das die Muster anschlagen
# müssen. Die Werte sind ausgedacht und gehören zu nichts.
selbsttest() {
  local tmp
  tmp="$(mktemp -d)" || return 1
  {
    echo 'const a = "cfut_0123456789abcdefghijklmnopqrstuvwxyz"'
    echo 'const b = "123456789:AAFakeFakeFakeFakeFakeFakeFakeFakeFake"'
    echo 'const c = "ghp_000000000000000000000000000000000000"'
    echo 'const g = "github_pat_00000000000000000000000000000000000000000000000000000000000000"'
    echo 'const d = "AKIAAAAAAAAAAAAAAAAA"'
    echo 'const e = { password: "aaaaaaaaaaaaaaaaaaaaaaaa" }'
    echo '-----BEGIN RSA PRIVATE KEY-----'
    echo 'const f = "xoxb-1234567890-abcdef"'
  } > "$tmp/koeder.js"

  local fehlend=0 name regex
  while IFS='|' read -r name regex; do
    [ -n "$name" ] || continue
    if ! grep -qIoE -e "$regex" "$tmp/koeder.js" 2>/dev/null; then
      schlimm "Selbsttest: Muster '$name' findet seinen eigenen Köder nicht"
      fehlend=1
    fi
  done <<EOF
$MUSTER
EOF
  rm -rf "$tmp"
  [ "$fehlend" = 0 ] || return 1
  ok "Selbsttest: alle Muster schlagen an"
}

selbsttest || exit 1

if [ $# -gt 0 ]; then
  ZIELE=("$@")
else
  ZIELE=("$WURZEL/app/apps/web/dist/assets" "$WURZEL/app/apps/web/dist/sw.js")
fi

fehler=0
for ziel in "${ZIELE[@]}"; do
  # Eine einzelne Datei wird als ihr eigenes Ziel behandelt.
  if [ -f "$ziel" ]; then
    verzeichnis="$(mktemp -d)"
    cp "$ziel" "$verzeichnis/" || exit 1
    durchsuchen "$verzeichnis" || fehler=1
    rm -rf "$verzeichnis"
  else
    durchsuchen "$ziel" || fehler=1
  fi
done

if [ "$fehler" != 0 ]; then
  schlimm "Mögliches Geheimnis im ausgelieferten Bündel."
  exit 1
fi
ok "Keine Treffer in: ${ZIELE[*]}"
