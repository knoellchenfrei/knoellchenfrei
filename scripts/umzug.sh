#!/usr/bin/env bash
#
# Zieht dieses Projekt in ein leeres Repository um — mit einer Historie, die
# aus einem einzigen Commit besteht.
#
# Warum überhaupt: In den Commits von 2012 steht ein Passwort. Es ist längst
# wertlos, aber es steht dort, und die Historie eines bestehenden Repositories
# umzuschreiben zerreißt jeden Klon, der davon existiert. Ein neues Repository
# ist der saubere Schnitt.
#
# Was bleibt: der aktuelle Stand der App. Sonst nichts.
#
# Das Projekt von 2012 kommt **nicht** mit — weder Code noch Daten. Von 2,8 MB
# waren nur 256 KB eigener Quelltext; der Rest waren Bezirksgrenzen von 2012 in
# doppelter Ausfertigung (1,8 MB als KML und noch einmal als SQL, für Daten, die
# die App heute in 145 KB und aktuell führt), einkopierte Fremdbibliotheken
# (jQuery, Swagger UI, ein CoffeeScript-Compiler) und eine Excel-Add-in-Datei
# mit Makros.
#
# Was davon erhaltenswert war, steht als Text: die Ideenliste von damals in
# `docs/ideen-2012.md`, mit dem, was aus jedem Punkt geworden ist. Der alte Code
# bleibt im alten Repository — verloren geht nichts, es zieht nur nichts mit um.
#
# Aufruf aus dem Wurzelverzeichnis des alten Klons:
#
#   ./scripts/umzug.sh knoellchenfrei/knoellchenfrei
#
# Das Skript pusht nicht von selbst. Es legt einen Branch an, zeigt, was
# entstanden ist, und nennt den Push-Befehl. Ein Umzug, den man nicht vorher
# ansehen kann, ist keiner.

set -euo pipefail

ZIEL="${1:-}"
if [[ -z "$ZIEL" ]]; then
  echo "Aufruf: $0 <eigner>/<repository>   (z. B. knoellchenfrei/knoellchenfrei)" >&2
  exit 2
fi

if [[ ! -d .git ]]; then
  echo "Bitte im Wurzelverzeichnis des Klons ausführen." >&2
  exit 2
fi

if [[ -n "$(git status --porcelain)" ]]; then
  echo "Der Arbeitsbaum ist nicht sauber. Erst committen oder wegräumen." >&2
  exit 2
fi

BRANCH="umzug-$(date +%Y%m%d-%H%M%S)"
ALT="https://github.com/herbeus/parkingzone"
NEU="https://github.com/${ZIEL}"

# Der ganze Altbestand. Bewusst als eine Zeile: Eine Auswahl zu treffen hieße,
# jemandem später erklären zu müssen, warum ausgerechnet diese Datei blieb.
if [[ -d ParkingZone ]]; then
  echo "→ Altprojekt von 2012 entfernen (bleibt im alten Repository erhalten)"
  rm -rf ParkingZone
fi

echo "→ Repository-Adressen umschreiben: $ALT  →  $NEU"
# Nur die vier Stellen, an denen die alte Adresse wirklich steht. Ein
# projektweites sed würde auch Fundstellen in node_modules oder in
# Beispieltexten erwischen.
for datei in \
  SECURITY.md \
  .github/ISSUE_TEMPLATE/config.yml \
  app/apps/web/src/components/SettingsSheet.tsx \
  docs/hosting.md
do
  if [[ -f "$datei" ]] && grep -q "herbeus/parkingzone" "$datei"; then
    # Ohne -i'' getrennt für GNU und BSD sed — das Skript läuft auch auf macOS.
    perl -pi -e "s{\Qherbeus/parkingzone\E}{${ZIEL}}g" "$datei"
    echo "   $datei"
  fi
done

echo "→ Verwaiste Wurzel anlegen (ein Commit, keine Vorgeschichte)"
git checkout --orphan "$BRANCH" >/dev/null
git add -A
git commit -q -m "knoellchenfrei - Neuanfang mit sauberer Historie" -m "Der Stand aus dem alten Repository, ohne dessen Commits. Die Historie von 2012
enthielt ein Passwort; sie umzuschreiben haette jeden bestehenden Klon
zerrissen, also faengt dieses Repository neu an.

Das Projekt von 2012 kommt nicht mit - weder Code noch Daten. Von 2,8 MB waren
nur 256 KB eigener Quelltext; der Rest waren Bezirksgrenzen in doppelter
Ausfertigung, einkopierte Fremdbibliotheken und eine Excel-Add-in-Datei mit
Makros. Was erhaltenswert war, steht als Text in docs/ideen-2012.md. Der alte
Code bleibt im alten Repository."

echo
echo "Fertig. Entstanden ist ein Branch mit genau einem Commit:"
git --no-pager log --oneline --stat -1 | head -20
echo
echo "Ansehen:   git show --stat $BRANCH"
echo "Ideen:     git show $BRANCH:docs/ideen-2012.md | head -20"
echo
echo "Wenn es passt:"
echo "  git remote add neu ${NEU}.git"
echo "  git push -u neu ${BRANCH}:main"
echo
echo "Der alte Klon bleibt unangetastet — 'git checkout main' bringt dich zurück."
