#!/usr/bin/env bash
#
# Spiegelt die Glyphen der Vektorkarte in den eigenen R2-Eimer.
#
# Warum: Der Kartenstil holte die Schriften bis zum 7. September von
# `protomaps.github.io` — dem letzten fremden Abruf, den die Karte noch machte.
# Damit ging die IP-Adresse jedes Betrachters an GitHub, und die
# Datenschutzerklärung musste einen Empfänger nennen, den niemand braucht
# (Audit-Punkt M-017). FreiFahren liefert seine Schriften aus demselben Grund
# selbst aus.
#
# Was gespiegelt wird: die drei Schnitte, die der Stil wirklich benutzt —
# nachgemessen an `layers('protomaps', namedFlavor('dark'), { lang: 'de' })`,
# nicht geraten. Und von den 256 Unicode-Bereichen nur die, in denen etwas
# steht: 192 der 256 sind unter einem Kilobyte, also leer. Ein fehlender leerer
# Bereich kostet eine 404 im Netzwerkprotokoll und kein einziges Zeichen auf
# der Karte.
#
# Aufruf:
#   ./schriften-spiegeln.sh                # nur bauen, nach .schriften/
#   ./schriften-spiegeln.sh --hochladen    # und nach R2
#
# Geschrieben für die Bash, die auf macOS liegt (3.2).

set -euo pipefail

HIER="$(cd "$(dirname "$0")" && pwd)"
INGEST="$(cd "$HIER/.." && pwd)"
APP="$(cd "$INGEST/../.." && pwd)"

QUELLE="https://protomaps.github.io/basemaps-assets/fonts"
EIMER="knoellchenfrei-tiles"
ZIEL="$INGEST/.schriften"
# Alles darunter ist ein leerer Bereich. Gemessen: 192 der 256 liegen darunter.
MINDESTGROESSE=1024

SCHNITTE="Noto Sans Regular|Noto Sans Medium|Noto Sans Italic"

HOCHLADEN=nein
for arg in "$@"; do
  case "$arg" in
    --hochladen|--upload) HOCHLADEN=ja ;;
    *) echo "Unbekannt: $arg" >&2; exit 2 ;;
  esac
done

mkdir -p "$ZIEL"

# Der Bereich, den MapLibre anfragt, heisst `<anfang>-<ende>` mit 256 Zeichen
# Schrittweite. Die Adresse trägt den Schnitt mit Leerzeichen, also maskiert.
urlkodiert() { printf '%s' "$1" | sed 's/ /%20/g'; }

gesamt=0
geladen=0
uebersprungen=0

echo "$SCHNITTE" | tr '|' '\n' | while read -r schnitt; do
  [ -n "$schnitt" ] || continue
  kodiert="$(urlkodiert "$schnitt")"
  mkdir -p "$ZIEL/$schnitt"
  echo "→ $schnitt"
  i=0
  while [ "$i" -lt 256 ]; do
    anfang=$((i * 256))
    ende=$((anfang + 255))
    bereich="${anfang}-${ende}"
    datei="$ZIEL/$schnitt/${bereich}.pbf"
    if [ ! -s "$datei" ]; then
      curl -sS -f -o "$datei" --max-time 30 "$QUELLE/$kodiert/${bereich}.pbf" || true
    fi
    if [ -s "$datei" ]; then
      groesse="$(wc -c < "$datei" | tr -d ' ')"
      if [ "$groesse" -lt "$MINDESTGROESSE" ]; then
        rm -f "$datei"
        uebersprungen=$((uebersprungen + 1))
      else
        geladen=$((geladen + 1))
        gesamt=$((gesamt + groesse))
      fi
    fi
    i=$((i + 1))
  done
  echo "   $(find "$ZIEL/$schnitt" -name '*.pbf' | wc -l | tr -d ' ') Bereiche"
done

echo
echo "Gespiegelt nach $ZIEL"
du -sh "$ZIEL" | cut -f1 | sed 's/^/  /'
echo

if [ "$HOCHLADEN" = ja ]; then
  # Einzeln, weil `wrangler r2 object put` keine Verzeichnisse kennt. Das
  # dauert; deshalb steht die Zahl vorher da, damit niemand denkt, es hängt.
  anzahl="$(find "$ZIEL" -name '*.pbf' | wc -l | tr -d ' ')"
  echo "→ $anzahl Dateien nach $EIMER/glyphs/ …"
  n=0
  find "$ZIEL" -name '*.pbf' | while read -r datei; do
    rest="${datei#"$ZIEL"/}"
    n=$((n + 1))
    ( cd "$APP/apps/api" \
      && pnpm --filter @knoellchenfrei/api exec wrangler r2 object put \
           "$EIMER/glyphs/$rest" --file="$datei" \
           --content-type=application/x-protobuf --remote >/dev/null )
    printf '\r   %s/%s' "$n" "$anzahl"
  done
  echo
  echo "Hochgeladen."
  echo
  echo "Die Karte zeigt darauf über das Feld glyphs in map-style.ts:"
  echo "  https://tiles.knoellchenfrei.de/glyphs/{fontstack}/{range}.pbf"
else
  echo "Hochladen:  $0 --hochladen"
fi
