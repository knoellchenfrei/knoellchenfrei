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
#   - wrangler:     npx wrangler --version
#
# Aufruf:
#   ./build-tiles.sh                 # neuestes Tagesarchiv suchen
#   ./build-tiles.sh 20260730        # ein bestimmtes Tagesarchiv
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
BUILD="${1:-}"

if ! command -v pmtiles >/dev/null; then
  echo "pmtiles-CLI fehlt: https://github.com/protomaps/go-pmtiles/releases" >&2
  exit 1
fi

if [[ -z "$BUILD" ]]; then
  echo "Kein Datum angegeben. Die verfügbaren Tagesarchive stehen unter"
  echo "  https://maps.protomaps.com/builds"
  echo "Dann erneut aufrufen, z. B.:  $0 20260730" >&2
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
echo "Hochladen — der Pfad trägt das Datum, damit ein Zwischenstand nie eine"
echo "laufende Version überschreibt und der Browser beliebig lange cachen darf:"
echo
echo "  npx wrangler r2 object put knoellchenfrei-tiles/v${BUILD}/berlin.pmtiles \\"
echo "    --file=$AUSGABE --content-type=application/octet-stream --remote"
echo
echo "Danach die Web-App darauf zeigen lassen (Buildzeit-Variable):"
echo
echo "  VITE_TILES_URL=https://tiles.knoellchenfrei.de/v${BUILD}/berlin.pmtiles"
echo
echo "Der Eimer braucht CORS für die eigene Domain und muss Range-Requests"
echo "zulassen — ohne beides lädt der Browser kein einziges Kachelbyte."
