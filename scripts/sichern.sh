#!/usr/bin/env bash
#
# Sichert die D1-Datenbank — verschlüsselt, auf diesen Rechner.
#
# Warum es das überhaupt braucht: Zwei der vier Tabellen sind bei Kontoverlust
# **weg und nicht wiederherstellbar**. `feedback` hat absichtlich keinen
# Lesepfad über die API — die Sicherung ist der einzige Weg, an eine
# Rückmeldung zu kommen —, und `marks` trägt die Kontrolldichte der letzten
# 28 Tage, die niemand nachträglich erzeugen kann. `sightings` verfallen nach
# 90 Minuten und `visits` sind ein Zähler; beide sind der Sicherung nicht wert,
# werden aber mitgenommen, weil ein vollständiger Abzug billiger ist als eine
# Auswahl, die man pflegen muss. (Audit-Punkt M-008.)
#
# Warum verschlüsselt: Der Abzug enthält gesalzene Client-Hashes und
# Freitext-Rückmeldungen. Das gehört nicht unverschlüsselt in einen
# Downloads-Ordner und erst recht nicht in eine Cloud-Sicherung, die jemand
# anders liest.
#
# Aufruf:
#   ./scripts/sichern.sh                     sichern
#   ./scripts/sichern.sh --pruefen           nur sagen, wie alt die letzte ist
#   ./scripts/sichern.sh --zurueck <datei>   entschlüsseln und den Weg zeigen
#
# Geschrieben für die Bash, die auf macOS liegt (3.2).

set -u

WURZEL="$(cd "$(dirname "$0")/.." && pwd)"
APP="$WURZEL/app"
ZIEL="${SICHERUNG_VERZEICHNIS:-$WURZEL/sicherungen}"
SCHLUESSEL="${SICHERUNG_SCHLUESSEL_DATEI:-$HOME/.knoellchenfrei-sicherung-schluessel}"
D1_NAME="${D1_NAME:-knoellchenfrei}"

if [ -t 1 ] && [ -z "${NO_COLOR:-}" ]; then
  F_ROT=$'\033[31m'; F_GRUEN=$'\033[32m'; F_GELB=$'\033[33m'; F_AUS=$'\033[0m'
else
  F_ROT=''; F_GRUEN=''; F_GELB=''; F_AUS=''
fi
ok()      { printf '  %s✓%s %s\n' "$F_GRUEN" "$F_AUS" "$1"; }
fehlt()   { printf '  %s•%s %s\n' "$F_GELB" "$F_AUS" "$1"; }
schlimm() { printf '  %s✗%s %s\n' "$F_ROT" "$F_AUS" "$1" >&2; }

wr() {
  (cd "$APP/apps/api" && pnpm --filter @knoellchenfrei/api exec wrangler "$@")
}

# Die jüngste Sicherung, oder nichts.
#
# `ls -t` statt `find`: shellcheck rät zu `find`, weil `ls` an Dateinamen mit
# Zeilenumbrüchen scheitert. Diese Namen entstehen aber zwei Funktionen weiter
# unten aus einem Zeitstempel — es gibt hier keine fremden Namen, und `find`
# mit Sortierung nach Zeit wäre drei Zeilen für dasselbe Ergebnis.
# shellcheck disable=SC2012
juengste_sicherung() {
  ls -t "$ZIEL"/knoellchenfrei-*.sql.enc 2>/dev/null | head -1
}

alter_in_tagen() {
  local datei="$1" jetzt stand
  jetzt="$(date +%s)"
  # `stat` ist auf macOS und GNU verschieden; erst BSD, dann GNU versuchen.
  stand="$(stat -f %m "$datei" 2>/dev/null || stat -c %Y "$datei" 2>/dev/null)"
  [ -n "$stand" ] || { printf '?'; return; }
  printf '%s' $(( (jetzt - stand) / 86400 ))
}

schluessel_sicherstellen() {
  if [ -r "$SCHLUESSEL" ]; then return 0; fi
  schlimm "Kein Schlüssel unter $SCHLUESSEL"
  printf '\n'
  printf '  Einen erzeugen und in den Passwortmanager legen — er ist das Einzige,\n'
  printf '  was die Sicherungen wieder lesbar macht:\n\n'
  printf '    openssl rand -base64 48 > %s && chmod 600 %s\n\n' "$SCHLUESSEL" "$SCHLUESSEL"
  printf '  %sOhne Kopie im Passwortmanager ist die Sicherung wertlos:%s Wer den\n' "$F_GELB" "$F_AUS"
  printf '  Rechner verliert, verliert Schlüssel und Sicherung im selben Moment.\n\n'
  return 1
}

sichern() {
  schluessel_sicherstellen || return 1
  mkdir -p "$ZIEL" || return 1

  local stempel roh ziel
  stempel="$(date +%Y-%m-%d-%H%M)"
  roh="$(mktemp -t knoellchenfrei-d1)" || return 1
  ziel="$ZIEL/knoellchenfrei-$stempel.sql.enc"

  printf 'Abzug aus D1 "%s" …\n' "$D1_NAME"
  if ! wr d1 export "$D1_NAME" --remote --output "$roh" >/dev/null 2>&1; then
    rm -f "$roh"
    schlimm "Der Abzug ist gescheitert."
    fehlt "Meist fehlt dem Token 'D1:Edit'. Nachsehen mit:"
    printf '      cd app/apps/api && pnpm --filter @knoellchenfrei/api exec wrangler d1 export %s --remote --output /tmp/probe.sql\n' "$D1_NAME"
    return 1
  fi

  # Kein `-in` ohne Größenprüfung: Ein leerer Abzug verschlüsselt sich klaglos
  # und sähe wie eine gültige Sicherung aus. Genau diese Sorte Fehler — Erfolg
  # gemeldet, nichts getan — hat dieses Projekt schon dreimal getroffen.
  local bytes
  bytes="$(wc -c < "$roh" | tr -d ' ')"
  if [ "${bytes:-0}" -lt 100 ]; then
    rm -f "$roh"
    schlimm "Der Abzug ist $bytes Bytes gross — das ist keine Datenbank."
    return 1
  fi

  if ! openssl enc -aes-256-cbc -pbkdf2 -iter 600000 -salt \
        -in "$roh" -out "$ziel" -pass "file:$SCHLUESSEL"; then
    rm -f "$roh" "$ziel"
    schlimm "Verschlüsseln gescheitert."
    return 1
  fi
  rm -f "$roh"
  chmod 600 "$ziel"

  ok "$ziel ($(( bytes / 1024 )) KB unverschlüsselt)"
  printf '\n  Zurückspielen später:  ./scripts/sichern.sh --zurueck %s\n' "$ziel"
  printf '  %sDiese Datei gehört an einen zweiten Ort%s — ein Rechner, der\n' "$F_GELB" "$F_AUS"
  printf '  abbrennt, nimmt sonst die Sicherung mit.\n'
}

zurueckspielen() {
  local quelle="$1" klartext
  [ -r "$quelle" ] || { schlimm "Nicht lesbar: $quelle"; return 1; }
  schluessel_sicherstellen || return 1
  klartext="${quelle%.enc}"
  if ! openssl enc -d -aes-256-cbc -pbkdf2 -iter 600000 \
        -in "$quelle" -out "$klartext" -pass "file:$SCHLUESSEL"; then
    schlimm "Entschlüsseln gescheitert — falscher Schlüssel?"
    return 1
  fi
  ok "Entschlüsselt nach $klartext"
  printf '\n  Einspielen in eine **frische** Datenbank:\n\n'
  printf '    cd app/apps/api\n'
  printf '    pnpm --filter @knoellchenfrei/api exec wrangler d1 execute %s --remote --file %s\n\n' \
    "$D1_NAME" "$klartext"
  printf '  %sNicht in die laufende Datenbank:%s Der Abzug enthält CREATE TABLE,\n' "$F_GELB" "$F_AUS"
  printf '  und die Migrationstabelle käme durcheinander. Der Weg beim\n'
  printf '  Wiederaufbau steht in docs/notfall.md.\n'
}

pruefen() {
  local letzte alter
  letzte="$(juengste_sicherung)"
  if [ -z "$letzte" ]; then
    fehlt "Es gibt keine Sicherung in $ZIEL"
    return 1
  fi
  alter="$(alter_in_tagen "$letzte")"
  if [ "$alter" = '?' ]; then
    fehlt "$letzte — Alter nicht feststellbar"
  elif [ "$alter" -gt 30 ]; then
    schlimm "Jüngste Sicherung ist $alter Tage alt: $letzte"
    return 1
  else
    ok "Jüngste Sicherung ist $alter Tage alt: $letzte"
  fi
}

case "${1:-}" in
  --pruefen|-p) pruefen ;;
  --zurueck)    [ $# -ge 2 ] || { schlimm "Welche Datei?"; exit 2; }; zurueckspielen "$2" ;;
  --hilfe|-h|--help) sed -n '2,25p' "$0" | sed 's/^# \{0,1\}//' ;;
  '')           sichern ;;
  *)            schlimm "Unbekannt: $1"; exit 2 ;;
esac
