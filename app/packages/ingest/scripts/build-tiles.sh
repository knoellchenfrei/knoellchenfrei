#!/usr/bin/env bash
#
# Schneidet Berlin aus dem globalen Protomaps-Basiskartenarchiv und legt es in
# einen R2-Eimer.
#
# Kein Kachelserver: Das Ergebnis ist eine einzige Datei. Der Browser holt per
# HTTP-Range-Request genau die Bytes, die er für den sichtbaren Ausschnitt
# braucht. Kein Prozess, der laufen muss, keine Skalierung, kein Egress-Preis —
# derselbe Aufbau, den FreiFahren fährt.
#
# Warum überhaupt: Die Karte holt ihre Kacheln zurzeit von
# tile.openstreetmap.org. Die Kachelrichtlinie der OSM Foundation deckt
# ausgelieferte Anwendungen nicht ab, und die IP-Adressen aller Nutzer gehen an
# einen Dritten, über den die Datenschutzerklärung Auskunft geben muss.
#
# Voraussetzungen:
#   - pmtiles-CLI:  https://github.com/protomaps/go-pmtiles/releases
#   - wrangler:     ueber den Workspace, nie als nacktes npx —
#                   cd app && pnpm --filter @knoellchenfrei/api exec wrangler --version
#
# Aufruf:
#   ./build-tiles.sh                 # neuestes Tagesarchiv suchen
#   ./build-tiles.sh --hochladen     # dasselbe, und gleich nach R2 legen
#   ./build-tiles.sh 20260904        # ein bestimmtes Tagesarchiv
#
# Ohne Datum ist der Regelfall. Ein Datum in einer Anleitung veraltet, das
# Archiv verschwindet, und der Aufruf scheitert dann mit einer 404, die nach
# einem Fehler im Skript aussieht.
#
# Danach hochladen — der Befehl steht am Ende der Ausgabe.

set -euo pipefail

# Berlin, großzügig umrandet. Dieselben Grenzen, die der Worker für Meldungen
# durchsetzt — eine zweite Zahlenreihe, die auseinanderläuft, wäre eine
# Fehlerquelle ohne Nutzen.
BBOX="13.0,52.3,13.8,52.7"

# Zoom 15 reicht: Darüber hinaus geht es um einzelne Hausnummern, und jede
# weitere Stufe verdoppelt die Dateigröße ungefähr.
MAXZOOM=15

AUSGABE="berlin.pmtiles"
EIMER="knoellchenfrei-tiles"

# `--hochladen` erspart den Zwischenschritt, den Befehl aus der Ausgabe von
# Hand zu kopieren. Der Pfad im Eimer entsteht dabei an genau **einer** Stelle
# — hier. Ein zweites Skript, das ihn nachbildet, laeuft irgendwann auseinander,
# und das faellt erst auf, wenn eine Karte alte Kacheln zeigt.
HOCHLADEN=nein
BUILD=""
for arg in "$@"; do
  case "$arg" in
    --hochladen|--upload) HOCHLADEN=ja ;;
    -*) echo "Unbekannte Option: $arg" >&2; exit 2 ;;
    *)  BUILD="$arg" ;;
  esac
done

if ! command -v pmtiles >/dev/null; then
  echo "pmtiles-CLI fehlt: https://github.com/protomaps/go-pmtiles/releases" >&2
  exit 1
fi

# Protomaps hält nur ein kurzes Fenster an Tagesarchiven vor — gemessen am
# 6. September 2026: 20260904 und 20260901 antworteten, 20260903 und alles ab
# 20260828 abwärts mit 404. Ein Datum in der Dokumentation ist deshalb keine
# Angabe, sondern eine Falle mit Verfallsdatum: `build-tiles.sh 20260730` lief
# in
#
#   Failed to create range reader for 20260730.pmtiles, HTTP error: 404
#
# was nach einem kaputten Skript aussieht und ein abgelaufenes Datum ist.
# Deshalb sucht das Skript selbst, statt eines zu verlangen.
neuestes_archiv() {
  local tag i
  for i in $(seq 0 60); do
    # BSD-date (macOS) und GNU-date sprechen verschiedene Sprachen.
    if date -v-1d >/dev/null 2>&1; then
      tag="$(date -v-"${i}"d +%Y%m%d)"
    else
      tag="$(date -d "-${i} days" +%Y%m%d)"
    fi
    # Ein Ein-Byte-Range-Request kostet nichts und beantwortet die Frage.
    if curl -sS -o /dev/null -r 0-0 -w '%{http_code}' --max-time 15 \
         "https://build.protomaps.com/${tag}.pmtiles" 2>/dev/null | grep -qE '^(200|206)$'; then
      printf '%s' "$tag"
      return 0
    fi
  done
  return 1
}

if [[ -z "$BUILD" ]]; then
  echo "Kein Datum angegeben — suche das neueste verfügbare Tagesarchiv …" >&2
  if ! BUILD="$(neuestes_archiv)"; then
    echo "Keines gefunden. Die Liste steht unter https://maps.protomaps.com/builds" >&2
    exit 2
  fi
  echo "  gefunden: $BUILD" >&2
fi

# Auch ein angegebenes Datum wird geprüft, bevor pmtiles minutenlang läuft und
# dann an einer 404 scheitert.
if ! curl -sS -o /dev/null -r 0-0 -w '%{http_code}' --max-time 15 \
     "https://build.protomaps.com/${BUILD}.pmtiles" 2>/dev/null | grep -qE '^(200|206)$'; then
  echo "Das Archiv ${BUILD} gibt es nicht (mehr). Protomaps hält nur ein kurzes" >&2
  echo "Fenster vor. Ohne Datum aufrufen, dann sucht das Skript das neueste:" >&2
  echo "  $0" >&2
  exit 2
fi

QUELLE="https://build.protomaps.com/${BUILD}.pmtiles"

echo "→ Ausschnitt aus $QUELLE"
echo "  Rahmen $BBOX, bis Zoom $MAXZOOM"
# Der Ausschnitt entsteht über Range-Requests: Es wird nicht das globale Archiv
# geladen, sondern nur die Kacheln im Rahmen.
pmtiles extract "$QUELLE" "$AUSGABE" --bbox="$BBOX" --maxzoom="$MAXZOOM"

GROESSE=$(du -h "$AUSGABE" | cut -f1)
echo
echo "Fertig: $AUSGABE ($GROESSE)"
echo
ZIEL="${EIMER}/v${BUILD}/berlin.pmtiles"

# Der Pfad traegt das Datum, damit ein Zwischenstand nie eine laufende Version
# ueberschreibt und der Browser beliebig lange cachen darf.
if [[ "$HOCHLADEN" == ja ]]; then
  echo "→ Hochladen nach $ZIEL"
  ( cd "$(dirname "$0")/../../../apps/api" \
    && pnpm --filter @knoellchenfrei/api exec wrangler r2 object put "$ZIEL" \
         --file="$(cd "$(dirname "$AUSGABE")" && pwd)/$(basename "$AUSGABE")" \
         --content-type=application/octet-stream --remote )
  echo "Hochgeladen."
  echo
else
  echo "Hochladen:"
  echo
  echo "  $0 ${BUILD} --hochladen"
  echo
  echo "oder von Hand:"
  echo
  echo "  cd app/apps/api && pnpm exec wrangler r2 object put $ZIEL \\"
  echo "    --file=<pfad>/$AUSGABE --content-type=application/octet-stream --remote"
  echo
fi
echo "Danach die Web-App darauf zeigen lassen (Buildzeit-Variable):"
echo
echo "  VITE_TILES_URL=https://tiles.knoellchenfrei.de/v${BUILD}/berlin.pmtiles"
echo
echo "Der Eimer braucht CORS für die eigene Domain und muss Range-Requests"
echo "zulassen — ohne beides lädt der Browser kein einziges Kachelbyte."
