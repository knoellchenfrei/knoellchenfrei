#!/usr/bin/env bash
#
# Baut die PMTiles-Archive — eines je Stadt — und lädt sie nach R2.
#
# Warum eigene Kacheln: Die Kachelrichtlinie der OSM Foundation deckt
# ausgelieferte Anwendungen nicht ab, und bei `tile.openstreetmap.org` gehen
# die IP-Adressen aller Nutzer an einen Dritten, über den die
# Datenschutzerklärung Auskunft geben muss.
#
# Voraussetzungen:
#   - pmtiles-CLI:  https://github.com/protomaps/go-pmtiles/releases
#   - wrangler:     über den Workspace, nie als nacktes npx —
#                   cd app && pnpm --filter @knoellchenfrei/api exec wrangler --version
#
# Aufruf:
#   ./build-tiles.sh                        # alle Städte, neuestes Tagesarchiv
#   ./build-tiles.sh --hochladen            # dasselbe, und gleich nach R2
#   ./build-tiles.sh muenchen --hochladen   # nur eine Stadt
#   ./build-tiles.sh 20260904               # ein bestimmtes Tagesarchiv
#
# Ohne Datum ist der Regelfall. Ein Datum in einer Anleitung veraltet, das
# Archiv verschwindet, und der Aufruf scheitert dann mit einer 404, die nach
# einem Fehler im Skript aussieht.

set -euo pipefail

HIER="$(cd "$(dirname "$0")" && pwd)"
INGEST="$(cd "$HIER/.." && pwd)"
APP="$(cd "$INGEST/../.." && pwd)"

# Zoom 15 reicht: Darüber hinaus geht es um einzelne Hausnummern, und jede
# weitere Stufe verdoppelt die Dateigröße ungefähr.
MAXZOOM=15
EIMER="knoellchenfrei-tiles"

# `--hochladen` erspart den Zwischenschritt, den Befehl aus der Ausgabe von
# Hand zu kopieren. Der Pfad im Eimer entsteht dabei an genau **einer** Stelle
# — hier. Ein zweites Skript, das ihn nachbildet, läuft irgendwann auseinander,
# und das fällt erst auf, wenn eine Karte alte Kacheln zeigt.
HOCHLADEN=nein
BUILD=""
STAEDTE=""
for arg in "$@"; do
  case "$arg" in
    --hochladen|--upload) HOCHLADEN=ja ;;
    -*) echo "Unbekannte Option: $arg" >&2; exit 2 ;;
    [0-9]*) BUILD="$arg" ;;
    *)  STAEDTE="$STAEDTE $arg" ;;
  esac
done

if ! command -v pmtiles >/dev/null; then
  echo "pmtiles-CLI fehlt: https://github.com/protomaps/go-pmtiles/releases" >&2
  exit 1
fi

# Die Rahmen kommen aus `core/city.ts`, nicht aus diesem Skript. Sie standen
# hier als zweite Kopie von Berlins `reportBounds`; mit vier Städten wären es
# acht Zahlen geworden, die auseinanderlaufen können (Audit-Punkt M-034). Der
# Kommentar an der alten Stelle warnte selbst davor.
# shellcheck disable=SC2086
RAHMEN="$(cd "$APP" && pnpm --filter @knoellchenfrei/ingest --silent city-bbox $STAEDTE)"
if [[ -z "$RAHMEN" ]]; then
  echo "Keine Städte gefunden." >&2
  exit 2
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
archiv_da() {
  curl -sS -o /dev/null -r 0-0 -w '%{http_code}' --max-time 15 \
    "https://build.protomaps.com/${1}.pmtiles" 2>/dev/null | grep -qE '^(200|206)$'
}

neuestes_archiv() {
  local tag i
  for i in $(seq 0 60); do
    # BSD-date (macOS) und GNU-date sprechen verschiedene Sprachen.
    if date -v-1d >/dev/null 2>&1; then
      tag="$(date -v-"${i}"d +%Y%m%d)"
    else
      tag="$(date -d "-${i} days" +%Y%m%d)"
    fi
    if archiv_da "$tag"; then printf '%s' "$tag"; return 0; fi
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
if ! archiv_da "$BUILD"; then
  echo "Das Archiv ${BUILD} gibt es nicht (mehr). Protomaps hält nur ein kurzes" >&2
  echo "Fenster vor. Ohne Datum aufrufen, dann sucht das Skript das neueste:" >&2
  echo "  $0" >&2
  exit 2
fi

QUELLE="https://build.protomaps.com/${BUILD}.pmtiles"
AUSGABEORDNER="$INGEST/.kacheln/v${BUILD}"
mkdir -p "$AUSGABEORDNER"

echo "→ Ausschnitte aus $QUELLE, bis Zoom $MAXZOOM"
echo

GEBAUT=""
while read -r stadt bbox; do
  [ -n "$stadt" ] || continue
  ziel="$AUSGABEORDNER/${stadt}.pmtiles"
  echo "  ${stadt}: Rahmen ${bbox}"
  # Der Ausschnitt entsteht über Range-Requests: Es wird nicht das globale
  # Archiv geladen, sondern nur die Kacheln im Rahmen.
  pmtiles extract "$QUELLE" "$ziel" --bbox="$bbox" --maxzoom="$MAXZOOM"
  echo "  ${stadt}: $(du -h "$ziel" | cut -f1)"
  echo
  GEBAUT="$GEBAUT $stadt"
done <<< "$RAHMEN"

echo "Fertig in $AUSGABEORDNER"
echo

hochladen_nach() {
  local pfad="$1" datei="$2"
  ( cd "$APP/apps/api" \
    && pnpm --filter @knoellchenfrei/api exec wrangler r2 object put "$pfad" \
         --file="$datei" --content-type=application/octet-stream --remote )
}

if [ "$HOCHLADEN" = ja ]; then
  for stadt in $GEBAUT; do
    datei="$AUSGABEORDNER/${stadt}.pmtiles"
    echo "→ Hochladen nach ${EIMER}/v${BUILD}/${stadt}.pmtiles"
    hochladen_nach "${EIMER}/v${BUILD}/${stadt}.pmtiles" "$datei"
    # **Zweimal, und das ist der Kern der Automatisierung.** Unter `v<datum>/`
    # bleibt jeder Stand liegen — das ist der Rückweg, wenn ein Archiv kaputt
    # ist. Unter `aktuell/` liegt der, auf den die App zeigt; deshalb muss
    # nach einem neuen Bau **keine Variable geändert und nichts neu
    # ausgerollt** werden, und genau daran hing es, dass der Kachelbau von
    # Hand lief.
    #
    # Was das kostet, damit es niemand später als Überraschung findet: Ein
    # Browser, der die Seite offen hat, während hier ein Archiv ersetzt wird,
    # hält den Kopf der alten Datei im Speicher — die Sprungadressen darin
    # zeigen dann ins Leere, und Kacheln kommen verstümmelt an, bis jemand
    # neu lädt. Das Fenster ist eine Minute in der Woche. Der Preis dafür,
    # es auszuschliessen, wäre ein Deploy je Kachelbau.
    echo "→ Hochladen nach ${EIMER}/aktuell/${stadt}.pmtiles"
    hochladen_nach "${EIMER}/aktuell/${stadt}.pmtiles" "$datei"
  done
  echo "Hochgeladen."
  echo
else
  echo "Hochladen:"
  echo
  echo "  $0 ${BUILD}${STAEDTE} --hochladen"
  echo
fi

echo "Die Web-App zeigt auf das VERZEICHNIS 'aktuell', nicht auf eine Datei"
echo "und nicht auf eine Version:"
echo
echo "  gh variable set VITE_TILES_URL --body 'https://tiles.knoellchenfrei.de/aktuell/'"
echo
echo "Steht das einmal, braucht ein neuer Kachelbau keine Änderung mehr — das"
echo "ist die Voraussetzung dafür, dass der Workflow 'Kacheln' ihn allein"
echo "macht. Die App hängt <stadt>.pmtiles selbst an. Ein Wert, der auf eine"
echo "Datei zeigt, hält seit dem 7. September den Build an: Er landete sonst"
echo "unabhängig von der geladenen Stadt im Kartenstil, und in drei von vier"
echo "Städten blieb die Karte leer."
echo
echo "Zurück auf einen älteren Stand, falls ein Archiv kaputt ist:"
echo
echo "  gh variable set VITE_TILES_URL --body 'https://tiles.knoellchenfrei.de/v<datum>/'"
echo
echo "Der Eimer braucht CORS für die eigene Domain und muss Range-Requests"
echo "zulassen — ohne beides lädt der Browser kein einziges Kachelbyte."
