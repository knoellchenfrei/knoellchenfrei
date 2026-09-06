#!/usr/bin/env bash
#
# Richtet knoellchenfrei ein — von einem Rechner aus, an dem du sitzt.
#
# Der Grundgedanke: **Prüfen statt anweisen.** Jeder Schritt sieht zuerst nach,
# ob er schon erledigt ist, und meldet sich nur, wenn etwas fehlt. Ein zweiter
# Lauf ist deshalb kein Neuaufsetzen, sondern ein Bericht — und genau deshalb
# darf man jederzeit abbrechen und später weitermachen.
#
# Warum hier und nicht als Workflow: Der Zustand darf nur an einer Stelle
# stehen. Ein Skript, das Workflows anstößt, die dann Ressourcen anlegen, hat
# zwei halbe Wahrheiten und keine ganze. Was danach noch als Workflow läuft,
# ist ausschließlich CI und Deploy — also das, was ohne Menschen auskommt.
#
# Wo ein Schritt nur in einem Browser geht (Konten, Zahlungsdaten,
# Zustimmungen, BotFather), nennt das Skript die Adresse, wartet auf dich und
# **prüft danach nach**. Es behauptet nie, etwas sei fertig, ohne es gemessen
# zu haben.
#
#   ./scripts/einrichten.sh              # alles der Reihe nach
#   ./scripts/einrichten.sh --pruefen    # nur berichten, nichts ändern
#   ./scripts/einrichten.sh telegram     # einen einzelnen Schritt
#   ./scripts/einrichten.sh --liste      # welche Schritte es gibt
#
# Geschrieben für die Bash, die auf macOS liegt (3.2): keine assoziativen
# Arrays, kein ${var,,}, kein `mapfile`.

set -u

# ------------------------------------------------------------------ Ausgabe

if [ -t 1 ] && [ -z "${NO_COLOR:-}" ]; then
  F_ROT=$'\033[31m'; F_GRUEN=$'\033[32m'; F_GELB=$'\033[33m'
  F_BLAU=$'\033[34m'; F_FETT=$'\033[1m'; F_AUS=$'\033[0m'
else
  F_ROT=''; F_GRUEN=''; F_GELB=''; F_BLAU=''; F_FETT=''; F_AUS=''
fi

ok()      { printf '  %s✓%s %s\n' "$F_GRUEN" "$F_AUS" "$*"; }
fehlt()   { printf '  %s•%s %s\n' "$F_GELB" "$F_AUS" "$*"; }
schlimm() { printf '  %s✗%s %s\n' "$F_ROT" "$F_AUS" "$*"; }
hinweis() { printf '    %s\n' "$*"; }
adresse() { printf '    %s%s%s\n' "$F_BLAU" "$*" "$F_AUS"; }

ueberschrift() {
  printf '\n%s%s%s\n' "$F_FETT" "$*" "$F_AUS"
  printf '%s\n' "$(printf '%*s' "${#1}" '' | tr ' ' '-')"
}

# Zählt mit, was offen bleibt. Ein Skript, das durchläuft und schweigt, ist
# nicht dasselbe wie eines, das durchläuft und bestätigt.
OFFEN=0
offen_merken() { OFFEN=$((OFFEN + 1)); }

weiter() {
  [ "$NUR_PRUEFEN" = ja ] && return 1
  printf '\n    %sEnter, wenn erledigt — oder Strg-C zum Abbrechen.%s ' "$F_FETT" "$F_AUS"
  read -r _ </dev/tty || return 1
  return 0
}

frage() {
  local antwort=''
  printf '    %s ' "$1" >&2
  read -r antwort </dev/tty || true
  printf '%s' "$antwort"
}

geheim_fragen() {
  # Wie `frage`, nur ohne Echo. Ein Token gehört nicht in den Scrollback und
  # nicht in die History der Shell.
  local antwort=''
  printf '    %s ' "$1" >&2
  stty -echo 2>/dev/null || true
  read -r antwort </dev/tty || true
  stty echo 2>/dev/null || true
  printf '\n' >&2
  printf '%s' "$antwort"
}

# Ein Einrichtungsskript, das an einem fehlenden Werkzeug abbricht und dich
# selbst installieren laesst, hat die Haelfte seiner Aufgabe nicht getan.
# Also: anbieten, installieren, nachpruefen.
paketmanager() {
  if command -v brew    >/dev/null 2>&1; then printf 'brew'; return; fi
  if command -v apt-get >/dev/null 2>&1; then printf 'apt';  return; fi
  printf 'keiner'
}

installieren() {
  local werkzeug="$1" pm; pm="$(paketmanager)"
  case "$werkzeug" in
    pnpm)
      # Ueber corepack, nicht ueber `npm -g`: package.json legt mit
      # `packageManager: pnpm@10.33.0` eine Version fest, und corepack haelt
      # sich daran. Ein global installiertes pnpm taete das nicht.
      if command -v corepack >/dev/null 2>&1; then
        corepack enable pnpm >/dev/null 2>&1
        (cd "$APP" && corepack install >/dev/null 2>&1) || true
      fi
      command -v pnpm >/dev/null 2>&1 && return 0
      [ "$pm" = brew ] && brew install pnpm >/dev/null 2>&1
      ;;
    gh)
      [ "$pm" = brew ] && brew install gh >/dev/null 2>&1
      [ "$pm" = apt ]  && { sudo apt-get update -qq && sudo apt-get install -y gh >/dev/null 2>&1; }
      ;;
    pmtiles)
      # Kein npm-Paket, sondern eine Go-Binaerdatei.
      [ "$pm" = brew ] && brew install protomaps/tap/pmtiles >/dev/null 2>&1
      ;;
  esac
  command -v "$werkzeug" >/dev/null 2>&1
}

hinweis_installation() {
  case "$1" in
    pnpm)    hinweis "corepack enable pnpm && (cd app && corepack install)"
             hinweis "corepack liegt bei Node bei und haelt sich an die Version"
             hinweis "aus package.json — anders als ein globales npm -g pnpm." ;;
    gh)      hinweis "brew install gh   —  danach: gh auth login" ;;
    pmtiles) hinweis "brew install protomaps/tap/pmtiles"
             hinweis "oder eine Binaerdatei von https://github.com/protomaps/go-pmtiles/releases" ;;
  esac
}

sicherstellen() {
  # sicherstellen <werkzeug> [pflicht] -> 0, wenn es danach da ist
  local werkzeug="$1" art="${2:-kuer}"
  command -v "$werkzeug" >/dev/null 2>&1 && return 0
  fehlt "$werkzeug fehlt"
  if [ "$NUR_PRUEFEN" = ja ]; then hinweis_installation "$werkzeug"; return 1; fi
  if ja_nein "Jetzt installieren?"; then
    if installieren "$werkzeug"; then
      ok "$werkzeug installiert"
      return 0
    fi
    schlimm "Das ging nicht automatisch."
  fi
  hinweis_installation "$werkzeug"
  if [ "$art" = pflicht ]; then schlimm "Ohne $werkzeug geht es nicht weiter."; exit 1; fi
  return 1
}

ja_nein() {
  local a
  a="$(frage "$1 [j/N]")"
  case "$a" in j|J|ja|Ja|y|Y) return 0 ;; *) return 1 ;; esac
}

# ------------------------------------------------------------ Grundangaben

REPO_SLUG="${REPO_SLUG:-knoellchenfrei/knoellchenfrei}"
WORKER_NAME="knoellchenfrei-api"
D1_NAME="knoellchenfrei"
PAGES_PROJEKT="knoellchenfrei"
R2_EIMER="knoellchenfrei-tiles"
D1_JURISDIKTION="${D1_JURISDIKTION:-eu}"
TILES_DOMAIN="tiles.knoellchenfrei.de"
HAUPTDOMAIN="knoellchenfrei.de"
# Die Punycode-Formen stehen hier, weil Cloudflare und die meisten Werkzeuge
# Umlautdomains so verlangen.
DOMAINS="knoellchenfrei.de xn--knllchenfrei-5ib.de xn--knlchenfrei-sfb.de knoelchenfrei.de knoellchenfrei.org"

REPO_BESCHREIBUNG="Wo Parken gerade etwas kostet, wie viel und wie lange — aus amtlichen Geodaten. PWA für Berlin und Hamburg, offlinefähig, ohne Server."
REPO_THEMEN="parking open-data berlin hamburg pwa typescript maplibre geojson wfs offline-first civic-tech cloudflare-workers"

WURZEL="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP="$WURZEL/app"
TOML="$APP/apps/api/wrangler.toml"

# `wrangler` immer über den Workspace. Ein nacktes `npx wrangler` zieht
# irgendeine Version aus dem Zwischenspeicher (gesehen: 4.97 statt der
# festgelegten 4.129), und ohne `pnpm install` im Wurzelverzeichnis fehlt der
# Verweis auf @knoellchenfrei/core — der Build bricht dann mit
# `Could not resolve` ab, was nach einem kaputten Import aussieht und ein
# fehlender Symlink ist.
# Zwei Zugangsdaten, zwei Zwecke — und sie duerfen sich nicht vermischen.
#
# Am 6. September hat genau das eine Stunde gekostet: Das Skript riet dazu,
# CLOUDFLARE_API_TOKEN zu exportieren (die Zonen-API kennt wrangler nicht), und
# dieser Export uebersteuerte die wrangler-Anmeldung. Das Token hatte Zone- und
# R2-Rechte, aber keine fuer Workers — also scheiterte jeder Worker-Aufruf
# still, und das Skript meldete "Pages-Projekt fehlt" und "CLIENT_SALT fehlt"
# fuer Dinge, die beide existierten. Im Nicht-Pruefmodus haette es angefangen,
# sie neu anzulegen.
#
# Deshalb: `wr` laeuft grundsaetzlich OHNE das DNS-Token. Nur wenn nachweislich
# dasselbe Token auch Workers darf (WRANGLER_NUTZT_TOKEN=ja, unten gemessen),
# wird es durchgereicht.
WRANGLER_NUTZT_TOKEN=nein

wr() {
  if [ "$WRANGLER_NUTZT_TOKEN" = ja ]; then
    (cd "$APP/apps/api" && pnpm --filter @knoellchenfrei/api exec wrangler "$@")
  else
    (cd "$APP/apps/api" && env -u CLOUDFLARE_API_TOKEN \
       pnpm --filter @knoellchenfrei/api exec wrangler "$@")
  fi
}

# Das DNS-Token kommt aus der Umgebung oder aus einer Datei — Letzteres, damit
# es nicht in der Shell-History und nicht im Sitzungsprotokoll landet.
CF_TOKEN_DATEI="${CF_TOKEN_DATEI:-$HOME/.knoellchenfrei-cf-token}"
dns_token() {
  if [ -n "${CLOUDFLARE_API_TOKEN:-}" ]; then printf '%s' "$CLOUDFLARE_API_TOKEN"; return; fi
  [ -r "$CF_TOKEN_DATEI" ] || return 1
  tr -d '\n\r "'"'"'' < "$CF_TOKEN_DATEI"
}

# Ausfuehren und im Fehlerfall die Meldung ZEIGEN. `>/dev/null 2>&1` ueberall
# war der zweite Konstruktionsfehler: Jede Diagnose dieses Tages kam daraus,
# die echte Fehlermeldung zu lesen — ein Skript, das sie wegwirft, kann nur
# "ging nicht" sagen.
tun() {
  # tun "<Beschreibung>" <befehl…>
  local was="$1"; shift
  local ausgabe status
  ausgabe="$("$@" 2>&1)"; status=$?
  if [ "$status" -eq 0 ]; then ok "$was"; return 0; fi
  schlimm "$was — ging nicht:"
  printf '%s\n' "$ausgabe" | grep -v '^$' | tail -6 | sed 's/^/      /'
  return 1
}

NUR_PRUEFEN=nein
HAT_GH=nein
HAT_CF=nein

# `wrangler whoami` liefert **Exit-Code 0, auch wenn niemand angemeldet ist** —
# es schreibt dann nur "You are not authenticated" auf die Ausgabe. Auf den
# Rückgabewert zu bauen hiess: Jede folgende Pruefung scheitert leise und meldet
# "fehlt" statt "nicht pruefbar". Der Unterschied ist der zwischen einem Befund
# und einer Erfindung.
cf_angemeldet() {
  [ -n "${CLOUDFLARE_API_TOKEN:-}" ] && return 0
  local ausgabe
  ausgabe="$(wr whoami 2>&1 || true)"
  printf '%s' "$ausgabe" | grep -qi 'not authenticated' && return 1
  printf '%s' "$ausgabe" | grep -qE '[0-9a-f]{32}'
}

# Guard für jeden Schritt, der Cloudflare braucht.
braucht_cf() {
  [ "$HAT_CF" = ja ] && return 0
  fehlt "nicht prüfbar — wrangler kennt kein Konto"
  hinweis "export CLOUDFLARE_API_TOKEN=…  oder  cd app/apps/api && pnpm exec wrangler login"
  offen_merken
  return 1
}

# --------------------------------------------------------------- Werkzeuge

schritt_werkzeuge() {
  ueberschrift "Werkzeuge"
  # node, curl, openssl und git bringt jedes brauchbare System mit — fehlen
  # sie, ist das kein Fall fuer ein Projektskript.
  local fehlend=''
  for werkzeug in node curl openssl git; do
    if command -v "$werkzeug" >/dev/null 2>&1; then
      ok "$werkzeug $("$werkzeug" --version 2>/dev/null | head -1)"
    else
      schlimm "$werkzeug fehlt"
      fehlend="$fehlend $werkzeug"
    fi
  done
  if [ -n "$fehlend" ]; then
    schlimm "Ohne$fehlend geht es nicht weiter."
    exit 1
  fi

  # pnpm ist eine Projektentscheidung — also bringt das Projekt es mit, statt
  # dich danach zu schicken.
  sicherstellen pnpm pflicht && ok "pnpm $(pnpm --version 2>/dev/null)"

  if [ ! -d "$APP/node_modules" ]; then
    fehlt "Abhängigkeiten fehlen — hole ich nach"
    [ "$NUR_PRUEFEN" = ja ] || (cd "$APP" && pnpm install)
  else
    ok "Abhängigkeiten liegen"
  fi

  if sicherstellen gh; then
    if gh auth status >/dev/null 2>&1; then
      ok "gh angemeldet"
      HAT_GH=ja
    elif [ "$NUR_PRUEFEN" != ja ] && ja_nein "gh ist da, aber nicht angemeldet. Jetzt anmelden?"; then
      gh auth login && gh auth status >/dev/null 2>&1 && { ok "angemeldet"; HAT_GH=ja; }
    fi
  fi
  if [ "$HAT_GH" != ja ]; then
    fehlt "gh nicht einsatzbereit"
    hinweis "Ohne gh nennt das Skript nur die Adressen, an denen du es selbst tust."
  fi

  # Cloudflare: entweder ein Token in der Umgebung oder eine angemeldete
  # Sitzung. Beides ist recht; nichts davon ist es nicht.
  # Reihenfolge zaehlt: erst pruefen, ob das DNS-Token auch Workers darf,
  # dann erst `cf_angemeldet` — sonst misst man mit dem falschen Zugang.
  if [ -n "${CLOUDFLARE_API_TOKEN:-}" ]; then
    if (cd "$APP/apps/api" && pnpm --filter @knoellchenfrei/api exec wrangler secret list >/dev/null 2>&1); then
      WRANGLER_NUTZT_TOKEN=ja
      ok "Das Token darf auch Workers — wrangler benutzt es"
    else
      ok "Token nur fuer Zonen/R2 — wrangler benutzt deine Anmeldung"
      hinweis "Beides nebeneinander ist Absicht: Ein Token mit Zone-Rechten hat"
      hinweis "meist keine fuer Workers, und andersherum genauso."
    fi
  fi

  if cf_angemeldet; then
    HAT_CF=ja
    if [ -n "${CLOUDFLARE_API_TOKEN:-}" ]; then
      ok "CLOUDFLARE_API_TOKEN steht in der Umgebung"
    else
      ok "wrangler ist angemeldet"
    fi
  else
    fehlt "wrangler kennt kein Konto"
    hinweis "Zwei Wege, einer reicht:"
    hinweis "  export CLOUDFLARE_API_TOKEN=…   (Token mit den Rechten unten)"
    hinweis "  oder: cd app/apps/api && pnpm exec wrangler login"
    hinweis "Rechte des Tokens — fehlt eines, scheitert der Schritt, der es"
    hinweis "braucht, mit 'Authentication error [code: 10000]':"
    hinweis "  Workers Scripts:Edit, Workers KV Storage:Edit, D1:Edit,"
    hinweis "  Cloudflare Pages:Edit, Workers R2 Storage:Edit (für die Kacheln)"
    adresse "https://dash.cloudflare.com/profile/api-tokens"
    hinweis "Die Schritte, die Cloudflare brauchen, überspringt das Skript so"
    hinweis "lange — die GitHub-Schritte laufen trotzdem."
  fi
}

# ------------------------------------------------- 1. Cloudflare-Ressourcen

kv_id_holen() {
  # Erst anlegen, dann suchen. Beides schreibt die Kennung ins Log; welcher der
  # beiden Wege sie geliefert hat, ist gleichgültig.
  local ausgabe id
  ausgabe="$(wr kv namespace create CACHE 2>&1 || true)"
  id="$(printf '%s' "$ausgabe" | grep -oE '[0-9a-f]{32}' | head -1)"
  if [ -z "$id" ]; then
    id="$(wr kv namespace list 2>/dev/null \
      | tr '{' '\n' | grep CACHE | grep -oE '[0-9a-f]{32}' | head -1)"
  fi
  printf '%s' "$id"
}

d1_id_holen() {
  local args='' ausgabe id
  [ -n "$D1_JURISDIKTION" ] && args="--jurisdiction $D1_JURISDIKTION"
  # shellcheck disable=SC2086
  ausgabe="$(wr d1 create "$D1_NAME" $args 2>&1 || true)"
  id="$(printf '%s' "$ausgabe" \
    | grep -oE '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}' | head -1)"
  if [ -z "$id" ]; then
    id="$(wr d1 list --json 2>/dev/null \
      | tr '{' '\n' | grep "\"$D1_NAME\"" \
      | grep -oE '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}' | head -1)"
  fi
  printf '%s' "$id"
}

migrationen_anwenden() {
  # D1 bringt das mit: `migrations apply` führt eine Tabelle `d1_migrations`
  # und überspringt, was schon drin ist. Vorher stand hier ein Nachbau, der den
  # Zustand aus Fehlermeldungen erriet ("duplicate column name" hinnehmen) —
  # und der lag einmal daneben, weil die Reihenfolge vertauscht war.
  local ausgabe status
  ausgabe="$(wr d1 migrations apply "$D1_NAME" --remote 2>&1)"
  status=$?
  if [ "$status" -eq 0 ]; then
    if printf '%s' "$ausgabe" | grep -qi 'no migrations to apply'; then
      ok "Migrationen: nichts zu tun, die Datenbank ist auf Stand"
    else
      ok "Migrationen eingespielt"
      printf '%s\n' "$ausgabe" | grep -E '^[[:space:]]*[0-9]{4}_' | sed 's/^/      /'
    fi
    return 0
  fi
  schlimm "Migrationen ließen sich nicht einspielen:"
  printf '%s\n' "$ausgabe" | sed 's/^/      /'
  return 1
}

schritt_cloudflare() {
  ueberschrift "1. Cloudflare: KV, D1, Migrationen, Pages"
  braucht_cf || return 0

  if grep -q 'REPLACE_WITH_' "$TOML"; then
    fehlt "wrangler.toml trägt noch Platzhalter"
    if [ "$NUR_PRUEFEN" = ja ]; then offen_merken; return 0; fi

    local kv d1
    kv="$(kv_id_holen)"
    [ -n "$kv" ] && ok "KV-Namespace: $kv" || { schlimm "keine KV-Kennung"; offen_merken; return 1; }
    d1="$(d1_id_holen)"
    [ -n "$d1" ] && ok "D1-Datenbank: $d1" || { schlimm "keine D1-Kennung"; offen_merken; return 1; }

    # `sed -i` ist auf macOS und GNU verschieden. Ein Temporärfile ist auf
    # beiden gleich.
    sed "s|REPLACE_WITH_KV_ID|$kv|; s|REPLACE_WITH_D1_ID|$d1|" "$TOML" > "$TOML.neu" \
      && mv "$TOML.neu" "$TOML"
    ok "Kennungen in wrangler.toml eingetragen"
  else
    ok "KV und D1 stehen in wrangler.toml"
  fi

  if [ "$NUR_PRUEFEN" = ja ]; then
    fehlt "Migrationsstand nicht geprüft (Prüfmodus ändert nichts, und"
    hinweis "'migrations list' braucht dieselben Rechte wie 'apply')"
  else
    migrationen_anwenden || offen_merken
  fi

  # Pages: `pages deploy` legt ein Projekt NICHT an, es bricht ab mit
  # "The Pages project … does not exist".
  if wr pages project list 2>/dev/null | grep -q "$PAGES_PROJEKT"; then
    ok "Pages-Projekt $PAGES_PROJEKT besteht"
  else
    fehlt "Pages-Projekt $PAGES_PROJEKT fehlt"
    if [ "$NUR_PRUEFEN" = ja ]; then offen_merken; else
      wr pages project create "$PAGES_PROJEKT" --production-branch main >/dev/null 2>&1 \
        && ok "angelegt" || { schlimm "ließ sich nicht anlegen"; offen_merken; }
    fi
  fi

  # Ohne Salz ist der Client-Hash in Minuten auf eine IP zurückrechenbar. Ein
  # Salz ist ein Zufallswert, den **niemand** kennen muss — auch du nicht.
  if wr secret list 2>/dev/null | grep -q CLIENT_SALT; then
    ok "CLIENT_SALT ist gesetzt"
  else
    fehlt "CLIENT_SALT fehlt"
    if [ "$NUR_PRUEFEN" = ja ]; then offen_merken; else
      if openssl rand -base64 32 | wr secret put CLIENT_SALT >/dev/null 2>&1; then
        ok "CLIENT_SALT erzeugt und gesetzt — der Wert wird nirgends ausgegeben"
      else
        fehlt "noch nicht setzbar (meist: der Worker ist noch nicht ausgerollt)"
        hinweis "Nach dem ersten Deploy diesen Schritt erneut laufen lassen."
        offen_merken
      fi
    fi
  fi

  if ! git -C "$WURZEL" diff --quiet -- "$TOML"; then
    fehlt "wrangler.toml hat sich geändert und gehört ins Repository"
    if [ "$NUR_PRUEFEN" != ja ] && ja_nein "Committen und pushen?"; then
      git -C "$WURZEL" add "$TOML"
      git -C "$WURZEL" commit -q \
        -m "Cloudflare-Kennungen eintragen" \
        -m "Von scripts/einrichten.sh. KV- und D1-Kennungen sind keine Geheimnisse: ohne den API-Token ist damit nichts anzufangen, und wrangler braucht sie im Klartext."
      git -C "$WURZEL" push && ok "gepusht — der Deploy-Workflow läuft an" \
        || { schlimm "Push ging nicht"; offen_merken; }
    else
      offen_merken
    fi
  fi
}

# --------------------------------------------------------------- 2. CI/CD

schritt_ci() {
  ueberschrift "2. Zugang für den Deploy-Workflow"
  hinweis "Nur hierfür braucht GitHub ein Token: Das Ausrollen läuft ohne dich,"
  hinweis "also muss es eigene Zugangsdaten haben. Die Einrichtung oben nicht —"
  hinweis "die läuft mit deinen."

  if [ "$HAT_GH" != ja ]; then
    fehlt "ohne gh nicht prüfbar"
    adresse "https://github.com/$REPO_SLUG/settings/secrets/actions"
    hinweis "Anzulegen: CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID"
    offen_merken
    return 0
  fi

  local vorhanden fehlende=''
  vorhanden="$(gh secret list --repo "$REPO_SLUG" 2>/dev/null | awk '{print $1}')"
  for name in CLOUDFLARE_API_TOKEN CLOUDFLARE_ACCOUNT_ID; do
    if printf '%s\n' "$vorhanden" | grep -qx "$name"; then
      ok "$name liegt im Repository"
    else
      fehlt "$name fehlt"
      fehlende="$fehlende $name"
    fi
  done
  [ -z "$fehlende" ] && return 0
  if [ "$NUR_PRUEFEN" = ja ]; then offen_merken; return 0; fi

  local wert
  for name in $fehlende; do
    if [ "$name" = CLOUDFLARE_ACCOUNT_ID ]; then
      wert="$(wr whoami 2>/dev/null | grep -oE '[0-9a-f]{32}' | head -1)"
      [ -n "$wert" ] && hinweis "aus wrangler whoami: $wert"
      [ -z "$wert" ] && wert="$(frage "$name:")"
    else
      wert="$(geheim_fragen "$name (Eingabe bleibt unsichtbar):")"
    fi
    if [ -z "$wert" ]; then fehlt "$name übersprungen"; offen_merken; continue; fi
    printf '%s' "$wert" | gh secret set "$name" --repo "$REPO_SLUG" --body-file - \
      && ok "$name gesetzt" || { schlimm "$name ließ sich nicht setzen"; offen_merken; }
  done
}

# ------------------------------------------------------------- 3. Telegram

# Was am Bot ausser dem Webhook eingestellt gehoert — und was davon eine
# Schnittstelle kann.
#
# Die Bot-API setzt drei Dinge selbst, also tut das Skript es auch:
#
#   setMyShortDescription   das "About" im Profil, hoechstens 120 Zeichen
#   setMyDescription        der Text auf dem leeren Chat, VOR dem ersten
#                           /start, hoechstens 512 Zeichen
#   setMyCommands           das Befehlsmenue neben dem Eingabefeld
#
# Nicht ueber die API gehen: das **Profilbild** und das **Beschreibungsbild**
# (das Bild ueber dem Text auf dem leeren Chat). Beides kennt nur der
# BotFather. Deshalb stehen sie unten als Hinweis und nicht als Pruefung, die
# ohnehin nichts messen koennte.
BOT_ABOUT="Wo Parken gerade etwas kostet — und wo zuletzt das Ordnungsamt gesehen wurde. Standort schicken genügt."

BOT_BESCHREIBUNG="Schick mir deinen Standort, und die Sichtung steht für alle auf der Karte — 90 Minuten lang, danach verfällt sie.

Was ich nicht speichere: deine Chat-Kennung. Was ich unscharf mache: die Position auf rund 10 Meter, die Zeit auf ein Fünf-Minuten-Raster. Deine Telegram-Kennung wird gehasht wie eine IP-Adresse und nur benutzt, um die Meldegrenze durchzusetzen.

Berlin und Hamburg. Verbindlich ist immer die Beschilderung vor Ort.

/hilfe erklärt es nochmal."

tg_api() {
  # tg_api <token> <methode> <json>
  curl -sS -X POST "https://api.telegram.org/bot$1/$2" \
    -H 'Content-Type: application/json' -d "$3"
}

tg_ok() { printf '%s' "$1" | grep -q '"ok":true'; }

bot_profil_setzen() {
  local token="$1" antwort

  antwort="$(tg_api "$token" setMyShortDescription \
    "$(printf '{"short_description":%s}' "$(json_text "$BOT_ABOUT")")")"
  tg_ok "$antwort" && ok "About gesetzt (${#BOT_ABOUT} von 120 Zeichen)" \
    || { schlimm "About abgelehnt: $antwort"; offen_merken; }

  antwort="$(tg_api "$token" setMyDescription \
    "$(printf '{"description":%s}' "$(json_text "$BOT_BESCHREIBUNG")")")"
  tg_ok "$antwort" && ok "Beschreibung gesetzt (${#BOT_BESCHREIBUNG} von 512 Zeichen)" \
    || { schlimm "Beschreibung abgelehnt: $antwort"; offen_merken; }

  # Nur was der Worker wirklich beantwortet. Ein Menue, das einen Befehl
  # anbietet, den der Bot nicht kennt, ist schlimmer als keines: Es verspricht
  # etwas und die Antwort ist eine hoefliche Absage.
  antwort="$(tg_api "$token" setMyCommands \
    '{"commands":[{"command":"hilfe","description":"Wie das Melden geht, und was gespeichert wird"}]}')"
  tg_ok "$antwort" && ok "Befehlsmenü gesetzt (/hilfe)" \
    || { schlimm "Befehlsmenü abgelehnt: $antwort"; offen_merken; }

  hinweis ""
  hinweis "Zwei Bilder kann die Bot-API nicht, nur der BotFather:"
  hinweis "  Profilbild        /setuserpic   → docs/brand/telegram-bot-512.png"
  hinweis "  Beschreibungsbild BotFather → Edit Bot → Edit Description Picture"
  hinweis "  (steht über dem Text auf dem leeren Chat; docs/brand/social-preview-1280x640.png"
  hinweis "   taugt dafür, oder das Dach-Bild)"
  hinweis ""
  hinweis "Und zwei Schalter, die zur Bauart gehören:"
  hinweis "  /setjoingroups  → **Disable**. Der Bot ist auf Einzelchats gebaut;"
  hinweis "     Gruppen mitzulesen ist Stufe 2 und braucht erst einen"
  hinweis "     Missbrauchsfilter. Ein Bot, den man in Gruppen ziehen kann, der"
  hinweis "     dort aber schweigt, erzeugt nur Rückfragen."
  hinweis "  /setprivacy     → **Enable** (Vorgabe). Falls Gruppen je dazukommen,"
  hinweis "     sieht er dann nur, was an ihn gerichtet ist."
}

# JSON-Zeichenkette aus beliebigem Text — Umbrueche und Anfuehrungszeichen
# inklusive. `printf '%s'` wuerde beides roh durchreichen und ungueltiges JSON
# erzeugen.
json_text() {
  printf '%s' "$1" | python3 -c 'import json,sys; print(json.dumps(sys.stdin.read()))'
}

schritt_botprofil() {
  ueberschrift "3b. Bot-Profil (Beschreibung, About, Befehle)"
  if [ "$NUR_PRUEFEN" = ja ]; then
    fehlt "nicht prüfbar ohne Token — das Skript speichert ihn nicht"
    hinweis "Einzeln setzen: ./scripts/einrichten.sh botprofil"
    return 0
  fi
  hinweis "Das Skript kennt den Token nicht — es hat ihn gesetzt, nicht behalten."
  local token
  token="$(geheim_fragen 'Bot-Token (leer = überspringen, Eingabe unsichtbar):')"
  if [ -z "$token" ]; then fehlt "übersprungen"; offen_merken; return 0; fi
  bot_profil_setzen "$token"
}

schritt_telegram() {
  ueberschrift "3. Telegram"
  braucht_cf || return 0

  local liste
  liste="$(wr secret list 2>/dev/null || true)"
  local hat_token=nein hat_secret=nein
  printf '%s' "$liste" | grep -q TELEGRAM_TOKEN  && hat_token=ja
  printf '%s' "$liste" | grep -q TELEGRAM_SECRET && hat_secret=ja

  [ "$hat_token" = ja ]  && ok "TELEGRAM_TOKEN liegt im Worker"  || fehlt "TELEGRAM_TOKEN fehlt"
  [ "$hat_secret" = ja ] && ok "TELEGRAM_SECRET liegt im Worker" || fehlt "TELEGRAM_SECRET fehlt"

  # Vorhanden ist nicht dasselbe wie gueltig. Wer den Bot bei BotFather neu
  # anlegt, hat danach zwei Geheimnisse im Worker, die beide auf einen Bot
  # zeigen, den es nicht mehr gibt — und der erste Entwurf meldete genau dann
  # "liegt im Worker" und sprang raus. Ein Einrichtungsskript, das nur anlegen
  # und nie erneuern kann, laesst einen kaputten Zustand als heil durchgehen.
  if [ "$hat_token" = ja ] && [ "$hat_secret" = ja ]; then
    hinweis "Ob sie zum richtigen Bot gehoeren, weiss nur, wer den Token hat —"
    hinweis "das Skript hat ihn gesetzt, nicht gespeichert."
    if [ "$NUR_PRUEFEN" = ja ]; then return 0; fi
    ja_nein "Neu setzen? (noetig nach /newbot oder /revoke bei BotFather)" || return 0
  elif [ "$NUR_PRUEFEN" = ja ]; then
    offen_merken; return 0
  fi

  hinweis "In Telegram @BotFather anschreiben, /newbot, Namen vergeben."
  adresse "https://t.me/BotFather"
  local token
  token="$(geheim_fragen 'Bot-Token (leer = überspringen, Eingabe unsichtbar):')"
  if [ -z "$token" ]; then fehlt "Telegram übersprungen"; offen_merken; return 0; fi

  # Das zweite Geheimnis weist Telegram gegenüber dem Worker aus. Die
  # Webhook-Adresse ist sonst nur durch Unkenntnis geschützt, und "niemand
  # kennt sie" ist keine Zugangskontrolle.
  # Erst fragen, wem der Token gehoert — dann setzen. `getMe` kostet nichts und
  # haette am 6. September sofort gezeigt, dass der Bot @knoellchen_bot heisst
  # und nicht @knoellchenfrei_bot, wie ueberall in der Doku stand.
  local wer
  wer="$(curl -sS --max-time 20 "https://api.telegram.org/bot$token/getMe" | python3 -c "
import sys, json
try: d = json.load(sys.stdin)
except Exception: raise SystemExit
r = d.get('result') or {}
print(('@' + r['username']) if d.get('ok') and r.get('username') else '')" 2>/dev/null)"
  if [ -z "$wer" ]; then
    schlimm "Telegram kennt diesen Token nicht — nichts gesetzt."
    offen_merken
    return 0
  fi
  ok "Der Token gehoert zu $wer"

  local geheim; geheim="$(openssl rand -hex 24)"
  printf '%s' "$token"  | wr secret put TELEGRAM_TOKEN  >/dev/null 2>&1 && ok "TELEGRAM_TOKEN gesetzt"  || { schlimm "TELEGRAM_TOKEN ging nicht"; offen_merken; }
  printf '%s' "$geheim" | wr secret put TELEGRAM_SECRET >/dev/null 2>&1 && ok "TELEGRAM_SECRET erzeugt und gesetzt" || { schlimm "TELEGRAM_SECRET ging nicht"; offen_merken; }

  local basis
  basis="$(worker_adresse)"
  if [ -z "$basis" ]; then
    hinweis "Die Adresse steht in der Ausgabe des letzten Deploy-Laufs"
    hinweis "(Actions -> Deploy -> Zusammenfassung) oder im Cloudflare-Dashboard."
    basis="$(frage 'Adresse des Workers (https://…workers.dev):')"
  fi
  if [ -z "$basis" ]; then fehlt "Webhook nicht angemeldet — Adresse fehlt"; offen_merken; return 0; fi

  # `allowed_updates` ist keine Feinheit: Ohne die Einschränkung schickt
  # Telegram jede Bearbeitung, jeden Beitritt und jede Reaktion an den Worker,
  # sobald der Bot in einer Gruppe liegt.
  local antwort
  antwort="$(curl -sS -X POST "https://api.telegram.org/bot$token/setWebhook" \
    -H 'Content-Type: application/json' \
    -d "{\"url\":\"$basis/telegram\",\"secret_token\":\"$geheim\",\"allowed_updates\":[\"message\"]}")"
  if printf '%s' "$antwort" | grep -q '"ok":true'; then
    ok "Webhook angemeldet: $basis/telegram"
  else
    schlimm "Webhook abgelehnt: $antwort"
    offen_merken
  fi

  # Gegenprobe beim Absender statt beim Empfaenger. `getWebhookInfo` nennt auch
  # den letzten Zustellfehler — das ist die eine Stelle, an der man sieht, dass
  # Telegram es versucht und der Worker es abweist.
  curl -sS --max-time 20 "https://api.telegram.org/bot$token/getWebhookInfo" | python3 -c "
import sys, json
try: d = json.load(sys.stdin)
except Exception: raise SystemExit
r = d.get('result') or {}
print('      eingetragen: ' + (r.get('url') or '(keine)'))
if r.get('last_error_message'):
    print('      letzter Fehler: ' + str(r['last_error_message']))
print('      wartende Nachrichten: ' + str(r.get('pending_update_count', '?')))
" 2>/dev/null

  # Solange der Token noch in der Hand ist: Profil gleich mitsetzen. Danach ist
  # er weg — das Skript speichert ihn nicht.
  bot_profil_setzen "$token"

  hinweis "Namen sichern, solange sie frei sind — und nicht als leere Hülle:"
  hinweis "Telegram holt Namen ungenutzter Kanäle zurück. Anlegen, benennen,"
  hinweis "ein paar Leute hineinholen, Beitritt auf Genehmigung stellen."
  hinweis ""
  hinweis "Die Bilder liegen fertig, 512 × 512, kreissicher zugeschnitten:"
  hinweis "  @knoellchenfrei      docs/brand/telegram-dach-512.png"
  hinweis "  @knoellchenfrei_bot  docs/brand/telegram-bot-512.png"
  hinweis "  @knoellchenfrei_B    docs/brand/telegram-berlin-512.png"
  hinweis "  @knoellchenfrei_HH   docs/brand/telegram-hamburg-512.png"
  hinweis "Setzen: Bot über @BotFather → /setuserpic; Gruppen über"
  hinweis "Bearbeiten → Bild. Beides nur in der App — die Bot-API kennt für"
  hinweis "das eigene Profilbild keinen Endpunkt."
}

# Die Adresse des Workers steht nicht in `wrangler whoami` — dort steht das
# Konto, nicht die Unterdomain. Sie aus dem Kontonamen zu bauen waere geraten,
# und geraten heisst hier: ein Webhook, der ins Leere zeigt und dessen Fehler
# erst auffaellt, wenn jemand dem Bot schreibt. Also fragen.
worker_adresse() {
  local aus_log
  aus_log="$(wr deployments list --name "$WORKER_NAME" 2>/dev/null \
    | grep -oE 'https://[a-z0-9.-]+\.workers\.dev' | head -1)"
  printf '%s' "$aus_log"
}

# -------------------------------------------------------------- 4. Kacheln

schritt_kacheln() {
  ueberschrift "4. Kartenkacheln (R2)"
  braucht_cf || return 0
  hinweis "Warum das nicht warten sollte: Die Kacheln kommen zurzeit von"
  hinweis "tile.openstreetmap.org. Deren Nutzungsrichtlinie deckt ausgelieferte"
  hinweis "Anwendungen nicht ab, und die IP-Adressen aller Nutzer gehen an einen"
  hinweis "Dritten, über den die Datenschutzerklärung Auskunft geben muss."

  # --- Eimer ------------------------------------------------------------
  if wr r2 bucket list 2>/dev/null | grep -q "$R2_EIMER"; then
    ok "R2-Eimer $R2_EIMER besteht"
  elif [ "$NUR_PRUEFEN" = ja ]; then
    fehlt "R2-Eimer $R2_EIMER fehlt"; offen_merken; return 0
  else
    if wr r2 bucket create "$R2_EIMER" >/dev/null 2>&1; then
      ok "R2-Eimer $R2_EIMER angelegt"
    else
      schlimm "ging nicht — fehlt dem Token *Workers R2 Storage:Edit*?"
      offen_merken; return 0
    fi
  fi

  # --- CORS -------------------------------------------------------------
  # Ohne CORS lädt der Browser kein einziges Kachelbyte, und der Fehler steht
  # nur in der Entwicklerkonsole: Die Karte bleibt einfach leer.
  if wr r2 bucket cors list "$R2_EIMER" 2>/dev/null | grep -q "$HAUPTDOMAIN"; then
    ok "CORS am Eimer gesetzt"
  elif [ "$NUR_PRUEFEN" = ja ]; then
    fehlt "CORS fehlt"; offen_merken
  else
    if wr r2 bucket cors set "$R2_EIMER" --file="$APP/apps/api/r2-cors.json" --force >/dev/null 2>&1; then
      ok "CORS gesetzt (aus apps/api/r2-cors.json)"
    else
      schlimm "CORS ließ sich nicht setzen"; offen_merken
    fi
  fi

  # Range-Requests muss man nicht einschalten: R2 beherrscht sie, und PMTiles
  # baut darauf. Erwähnt wird es trotzdem, weil ein davorgehängter Proxy sie
  # verschlucken kann — dann lädt die Karte nichts und sieht nicht kaputt aus.

  # --- eigene Domain am Eimer -------------------------------------------
  if wr r2 bucket domain list "$R2_EIMER" 2>/dev/null | grep -q "$TILES_DOMAIN"; then
    ok "$TILES_DOMAIN zeigt auf den Eimer"
  else
    local zid=''
    # Nach dem *Token* fragen, nicht nach der Umgebungsvariable: Es darf auch
    # aus der Datei kommen. Der erste Entwurf prüfte nur die Variable und
    # meldete deshalb "die Zone fehlt", während Schritt 5 sie fand.
    dns_token >/dev/null 2>&1 && zid="$(zonen_id "$HAUPTDOMAIN")"
    if [ -z "$zid" ]; then
      fehlt "$TILES_DOMAIN noch nicht verbunden — die Zone $HAUPTDOMAIN fehlt (Schritt 5)"
      offen_merken
    elif [ "$NUR_PRUEFEN" = ja ]; then
      fehlt "$TILES_DOMAIN noch nicht verbunden"; offen_merken
    else
      # `pending` heißt: Cloudflare hat die Delegierung noch nicht bestätigt.
      # R2 antwortet dann mit `The specified zone id is not valid` — was nach
      # einer falschen Kennung aussieht und Warten bedeutet. Das gehört
      # unterschieden, sonst sucht jemand eine Stunde nach der richtigen ID.
      local zstatus; zstatus="$(zonen_status "$HAUPTDOMAIN")"
      if [ "$zstatus" != active ]; then
        fehlt "$TILES_DOMAIN wartet — die Zone $HAUPTDOMAIN steht auf '$zstatus'"
        hinweis "R2 verlangt eine aktive Zone. Aktiv wird sie, sobald die Registry"
        hinweis "die neuen Nameserver meldet; im Dashboard beschleunigt das"
        hinweis "*Check nameservers*."
        offen_merken
      else
        tun "$TILES_DOMAIN mit dem Eimer verbunden" \
          wr r2 bucket domain add "$R2_EIMER" --domain "$TILES_DOMAIN" \
             --zone-id "$zid" --min-tls 1.2 --force || offen_merken
      fi
    fi
  fi

  # --- Archiv bauen und hochladen ---------------------------------------
  # Der Pfad im Eimer trägt das Build-Datum (v<datum>/berlin.pmtiles), damit
  # ein Zwischenstand nie eine laufende Version überschreibt und der Browser
  # beliebig lange cachen darf. Deshalb baut und lädt **build-tiles.sh**, nicht
  # dieses Skript: Zwei Stellen, die denselben Pfad bilden, laufen auseinander,
  # und das fällt erst auf, wenn eine Karte alte Kacheln zeigt.
  if sicherstellen pmtiles; then
    if [ "$NUR_PRUEFEN" = ja ]; then
      fehlt "Archiv nicht geprüft (Prüfmodus baut nichts)"
      offen_merken
    elif ja_nein "Kachelarchiv bauen und hochladen? (dauert einige Minuten)"; then
      if "$APP/packages/ingest/scripts/build-tiles.sh" --hochladen; then
        ok "Archiv gebaut und hochgeladen"
      else
        schlimm "build-tiles.sh ist gescheitert — Ausgabe oben"
        offen_merken
      fi
    else
      fehlt "Archiv übersprungen"
      hinweis "Später: app/packages/ingest/scripts/build-tiles.sh --hochladen"
      offen_merken
    fi
  else
    offen_merken
  fi

  hinweis ""
  hinweis "Zuletzt VITE_TILES_URL setzen — die Adresse steht am Ende der"
  hinweis "Ausgabe von build-tiles.sh. Ohne den Wert bleibt alles bei OSM,"
  hinweis "und der Vektor-Teil liegt nicht einmal im Bündel."
}

# ----------------------------------------------------------------- 5. DNS

# Die Zonen-API ist die einzige Stelle, an der wrangler nicht hilft — es
# verwaltet Worker, keine DNS-Zonen. Also direkt gegen die REST-API, und dafür
# braucht es einen Token in der Umgebung (eine wrangler-Anmeldung reicht nicht).
cf_api() {
  # cf_api <METHODE> <pfad> [daten]
  local methode="$1" pfad="$2" daten="${3:-}"
  local t; t="$(dns_token)" || return 1
  if [ -n "$daten" ]; then
    curl -sS -X "$methode" -H "Authorization: Bearer $t" \
      -H 'Content-Type: application/json' -d "$daten" \
      "https://api.cloudflare.com/client/v4$pfad"
  else
    curl -sS -X "$methode" -H "Authorization: Bearer $t" \
      "https://api.cloudflare.com/client/v4$pfad"
  fi
}

# Cloudflare liefert Umlautdomains als `knölchenfrei.de` zurueck, waehrend
# Registrare und Werkzeuge die Punycode-Form `xn--knlchenfrei-sfb.de` verlangen.
# Der erste Entwurf verglich stur die Zeichenketten und meldete zwei
# existierende Zonen als fehlend. Verglichen wird jetzt in einer Form.
# Fehlermeldungen der Cloudflare-API lesbar machen.
#
# Vorher stand hier ein `grep -o '"message":"[^"]*"'`. Das traf nicht, weil die
# API mit einem Leerzeichen nach dem Doppelpunkt antwortet — und so meldete das
# Skript "ließ sich nicht anlegen:" mit einer *leeren* Begründung. Ausgerechnet
# an der Stelle, die dafür da ist, die echte Meldung zu zeigen. JSON gehört von
# einem JSON-Leser gelesen, nicht von einem Muster.
cf_fehler() {
  printf '%s' "$1" | python3 -c "
import sys, json
try:
    d = json.load(sys.stdin)
except Exception:
    print('      (keine lesbare Antwort)'); raise SystemExit
for e in d.get('errors') or []:
    print('      ' + str(e.get('message')))
    for k in e.get('error_chain') or []:
        print('        ' + str(k.get('message')))
if not (d.get('errors')):
    print('      (die API meldete keinen Fehler — dann lag es am Aufruf)')
" 2>/dev/null
}

zonen_id() {
  local gesucht="$1"
  cf_api GET "/zones?per_page=50" | python3 -c "
import sys, json
gesucht = sys.argv[1]
def ascii_form(name):
    try:
        return name.encode('idna').decode('ascii')
    except Exception:
        return name.lower()
ziel = ascii_form(gesucht)
try:
    d = json.load(sys.stdin)
except Exception:
    raise SystemExit
for z in (d.get('result') or []):
    if ascii_form(z['name']) == ziel:
        print(z['id']); break
" "$gesucht" 2>/dev/null
}

# Zonenstatus — `pending` heisst: Cloudflare hat die Delegierung noch nicht
# bestaetigt. Manches (eine eigene Domain am R2-Eimer) geht dann noch nicht,
# und die Fehlermeldung dafuer lautet `The specified zone id is not valid` —
# was nach einer falschen Kennung aussieht und Warten bedeutet.
zonen_status() {
  cf_api GET "/zones?per_page=50" | python3 -c "
import sys, json
gesucht = sys.argv[1]
def ascii_form(name):
    try:
        return name.encode('idna').decode('ascii')
    except Exception:
        return name.lower()
ziel = ascii_form(gesucht)
try:
    d = json.load(sys.stdin)
except Exception:
    raise SystemExit
for z in (d.get('result') or []):
    if ascii_form(z['name']) == ziel:
        print(z['status']); break
" "$gesucht" 2>/dev/null
}

schritt_dns() {
  ueberschrift "5. Domains und DNS"

  if ! dns_token >/dev/null 2>&1; then
    fehlt "nicht möglich — Zonen verwaltet nur die REST-API, und die braucht ein Token"
    hinweis "(eine wrangler-Anmeldung reicht dafür nicht — sie kennt keine Zonen)."
    hinweis "Entweder in die Umgebung:  export CLOUDFLARE_API_TOKEN=…"
    hinweis "oder in eine Datei, dann steht es nicht in der Shell-History:"
    hinweis "  pbpaste | tr -d '\\n\\r ' > $CF_TOKEN_DATEI && chmod 600 $CF_TOKEN_DATEI"
    hinweis "Rechte: Zone:Read, DNS:Edit — und für die Weiterleitungen zusätzlich"
    hinweis "Zone:Dynamic Redirect:Edit sowie Account:Account Rulesets:Edit."
    offen_merken
    return 0
  fi

  # Erst pruefen, ob das Token ueberhaupt angenommen wird. Sonst meldet jeder
  # folgende Schritt "fehlt als Zone" — und das waere erfunden, nicht gemessen.
  if ! cf_api GET "/user/tokens/verify" | grep -q '"success":true'; then
    schlimm "Cloudflare nimmt das Token nicht an:"
    cf_api GET "/user/tokens/verify" | python3 -c "
import sys, json
try: d = json.load(sys.stdin)
except Exception: raise SystemExit
for e in d.get('errors', []): print('      ' + str(e.get('message')))
" 2>/dev/null
    offen_merken
    return 0
  fi

  local konto
  konto="$(cf_api GET '/accounts' | tr '{' '\n' | grep -oE '"id":"[0-9a-f]{32}"' | head -1 | cut -d'"' -f4)"
  if [ -z "$konto" ]; then
    schlimm "Konto nicht abrufbar — fehlt dem Token *Account Settings:Read*?"
    offen_merken
    return 0
  fi

  local neue=''
  for d in $DOMAINS; do
    local id; id="$(zonen_id "$d")"
    if [ -n "$id" ]; then
      ok "$d ist eine Zone ($id)"
      continue
    fi
    fehlt "$d fehlt als Zone"
    if [ "$NUR_PRUEFEN" = ja ]; then offen_merken; continue; fi
    # Jede Domain braucht eine **eigene** Zone, auch die reinen
    # Weiterleitungen — sonst gibt es für sie kein Zertifikat, und
    # https://knöllchenfrei.de läuft in eine Warnung statt in ein Redirect.
    local antwort
    antwort="$(cf_api POST '/zones' "{\"name\":\"$d\",\"account\":{\"id\":\"$konto\"},\"type\":\"full\"}")"
    if printf '%s' "$antwort" | grep -q '"success":true'; then
      ok "$d als Zone angelegt"
      neue="$neue $d"
    else
      schlimm "$d ließ sich nicht anlegen:"
      cf_fehler "$antwort"
      offen_merken
    fi
  done

  if [ -n "$neue" ]; then
    hinweis ""
    hinweis "Diese Zonen sind angelegt, aber noch nicht aktiv: Beim Registrar"
    hinweis "müssen dafür die Nameserver umgestellt werden — das kann keine API,"
    hinweis "die dem Registrar nicht gehört. Die Namen je Zone:"
    for d in $neue; do
      local id ns
      id="$(zonen_id "$d")"
      ns="$(cf_api GET "/zones/$id" | tr ',' '\n' | grep -oE '[a-z]+\.ns\.cloudflare\.com' | sort -u | tr '\n' ' ')"
      hinweis "  $d → ${ns:-(noch nicht zugewiesen)}"
    done
    offen_merken
  fi

  # --- Weiterleitungen -------------------------------------------------
  # Als Cloudflare *Redirect Rules*, nicht beim Registrar: Dessen
  # Weiterleitungen arbeiten oft mit Frames oder brechen auf der Apex-Domain
  # bei HTTPS.
  for d in $DOMAINS; do
    [ "$d" = "$HAUPTDOMAIN" ] && continue
    local id; id="$(zonen_id "$d")"
    [ -z "$id" ] && continue
    local regeln
    regeln="$(cf_api GET "/zones/$id/rulesets" || true)"
    if printf '%s' "$regeln" | grep -q 'http_request_dynamic_redirect'; then
      ok "$d hat eine Weiterleitung"
      continue
    fi
    fehlt "$d ohne Weiterleitung"
    if [ "$NUR_PRUEFEN" = ja ]; then offen_merken; continue; fi
    local daten
    daten="$(printf '%s' "{\"name\":\"Weiterleitung auf $HAUPTDOMAIN\",\"kind\":\"zone\",\"phase\":\"http_request_dynamic_redirect\",\"rules\":[{\"action\":\"redirect\",\"expression\":\"true\",\"description\":\"301 auf $HAUPTDOMAIN, Pfad erhalten\",\"action_parameters\":{\"from_value\":{\"status_code\":301,\"target_url\":{\"expression\":\"concat(\\\"https://$HAUPTDOMAIN\\\", http.request.uri.path)\"},\"preserve_query_string\":true}}}]}")"
    local antwort
    antwort="$(cf_api POST "/zones/$id/rulesets" "$daten")"
    if printf '%s' "$antwort" | grep -q '"success":true'; then
      ok "$d leitet jetzt mit 301 auf $HAUPTDOMAIN"
    else
      schlimm "$d: Weiterleitung ließ sich nicht anlegen:"
      cf_fehler "$antwort"
      offen_merken
    fi
  done

  fehlt "Auto-Renew für alle fünf prüfen — das kann nur der Registrar"
  hinweis "Der einzige Punkt dieser Liste, an dem ein Versäumnis nicht"
  hinweis "reparierbar ist: Eine abgelaufene Hauptdomain wird binnen Stunden"
  hinweis "von Drop-Catchern gegriffen."
  offen_merken
}

# ------------------------------------------------------------- 6. GitHub

schritt_github() {
  ueberschrift "6. Repository und Organisation"

  if [ "$HAT_GH" != ja ]; then
    fehlt "nicht möglich — gh fehlt oder ist nicht angemeldet"
    adresse "https://github.com/$REPO_SLUG/settings"
    offen_merken
    return 0
  fi

  local json
  json="$(gh api "repos/$REPO_SLUG" 2>/dev/null || true)"

  # --- Beschreibung, Themen, ungenutzte Bereiche ------------------------
  local beschreibung
  beschreibung="$(printf '%s' "$json" | grep -o '"description":"[^"]*"' | head -1 | cut -d'"' -f4)"
  if [ -n "$beschreibung" ]; then
    ok "Beschreibung steht"
  elif [ "$NUR_PRUEFEN" = ja ]; then
    fehlt "Beschreibung fehlt"; offen_merken
  else
    if gh api -X PATCH "repos/$REPO_SLUG" -f description="$REPO_BESCHREIBUNG" >/dev/null 2>&1; then
      ok "Beschreibung gesetzt"
    else
      schlimm "ließ sich nicht setzen"; offen_merken
    fi
  fi

  # Eigener Zweig, nicht angehängt an die Beschreibung: Beim ersten Entwurf
  # hingen diese beiden am `else` darüber — stand die Beschreibung schon, wurden
  # sie nie geprüft. Genau so blieben Wiki und Projects an, während das Skript
  # meldete, alles sei in Ordnung.
  if printf '%s' "$json" | grep -q '"has_wiki":true' || printf '%s' "$json" | grep -q '"has_projects":true'; then
    fehlt "Wiki oder Projects sind an — beide leer, und ein leerer Bereich sieht verlassener aus als keiner"
    if [ "$NUR_PRUEFEN" = ja ]; then
      offen_merken
    elif gh api -X PATCH "repos/$REPO_SLUG" -F has_wiki=false -F has_projects=false >/dev/null 2>&1; then
      ok "Wiki und Projects abgeschaltet"
    else
      schlimm "ließen sich nicht abschalten"; offen_merken
    fi
  else
    ok "Wiki und Projects sind aus"
  fi

  local anzahl
  anzahl="$(gh api "repos/$REPO_SLUG/topics" 2>/dev/null | tr ',' '\n' | grep -c '"[a-z]' || true)"
  if [ "${anzahl:-0}" -gt 5 ]; then
    ok "Themen gesetzt ($anzahl)"
  elif [ "$NUR_PRUEFEN" = ja ]; then
    fehlt "Themen fehlen"; offen_merken
  else
    # Die Themen sind kein Schmuck: über github.com/topics/open-data und
    # /civic-tech findet jemand das Projekt, der nicht nach dem Namen sucht.
    local args=''
    for t in $REPO_THEMEN; do args="$args -f names[]=$t"; done
    # shellcheck disable=SC2086
    if gh api -X PUT "repos/$REPO_SLUG/topics" $args >/dev/null 2>&1; then
      ok "Themen gesetzt"
    else
      schlimm "ließen sich nicht setzen"; offen_merken
    fi
  fi

  # --- GitHub Pages -----------------------------------------------------
  if printf '%s' "$json" | grep -q '"has_pages":true'; then
    ok "GitHub Pages ist an"
  elif [ "$NUR_PRUEFEN" = ja ]; then
    fehlt "GitHub Pages aus"; offen_merken
  else
    # Quelle *GitHub Actions*, kein Zweig — der Workflow baut und liefert.
    # Und ausdrücklich keine eigene Domain: knoellchenfrei.de gehört zu
    # Cloudflare Pages, und ein Hostname liegt nur an einer Stelle.
    if gh api -X POST "repos/$REPO_SLUG/pages" -f build_type=workflow >/dev/null 2>&1; then
      ok "GitHub Pages eingeschaltet (Quelle: Actions, ohne eigene Domain)"
    else
      fehlt "ließ sich nicht einschalten"
      adresse "https://github.com/$REPO_SLUG/settings/pages"
      offen_merken
    fi
  fi

  # --- Dependabot -------------------------------------------------------
  # Die Konfiguration in .github/dependabot.yml steuert nur die
  # *Versions*updates. Die Sicherheitsmeldungen hängen an diesen beiden
  # Schaltern — ohne sie fehlt genau der Teil, der dringend ist.
  if gh api "repos/$REPO_SLUG/vulnerability-alerts" >/dev/null 2>&1; then
    ok "Dependabot-Warnungen sind an"
  elif [ "$NUR_PRUEFEN" = ja ]; then
    fehlt "Dependabot-Warnungen aus"; offen_merken
  else
    gh api -X PUT "repos/$REPO_SLUG/vulnerability-alerts" >/dev/null 2>&1 \
      && ok "Dependabot-Warnungen eingeschaltet" \
      || { fehlt "ließen sich nicht einschalten"; offen_merken; }
  fi
  if [ "$NUR_PRUEFEN" != ja ]; then
    gh api -X PUT "repos/$REPO_SLUG/automated-security-fixes" >/dev/null 2>&1 \
      && ok "Dependabot-Sicherheitsupdates eingeschaltet" || true
  fi

  # --- Was die API nicht kann ------------------------------------------
  # Für das Organisationsbild gibt es in der GitHub-API keinen Endpunkt, und
  # das Vorschaubild des Repositories ebenso wenig. Beides kann ausschliesslich
  # die Weboberfläche — deshalb steht es hier als Hinweis und nicht als
  # Prüfung, die immer "fehlt" sagen würde.
  hinweis ""
  hinweis "Zwei Dinge kann keine API, nur der Browser:"
  hinweis "  Organisationsbild   docs/brand/org-avatar-512.png"
  adresse "https://github.com/organizations/${REPO_SLUG%%/*}/settings/profile"
  hinweis "  Vorschaubild        docs/brand/social-preview-1280x640.png"
  adresse "https://github.com/$REPO_SLUG/settings"
}

# ---------------------------------------------------------------- Bericht

schritt_bericht() {
  ueberschrift "Stand"
  if [ "$OFFEN" -eq 0 ]; then
    ok "Nichts offen."
  else
    printf '  %s%s Punkt(e) offen.%s Starte das Skript erneut, wenn du sie erledigt hast —\n' \
      "$F_GELB" "$OFFEN" "$F_AUS"
    hinweis "es prüft nach und fragt nur nach dem, was dann noch fehlt."
  fi
  printf '\n  Die vollständige Liste mit Begründungen: docs/todo.md\n'
  printf '  Was nur Menschen können (Verein, Impressum): dort Punkt 1.\n\n'
}

# ------------------------------------------------------------------ Ablauf

SCHRITTE="werkzeuge cloudflare ci telegram botprofil kacheln dns github"

usage() {
  cat <<'ENDE'
Aufruf:
  ./scripts/einrichten.sh              alles der Reihe nach
  ./scripts/einrichten.sh --pruefen    nur berichten, nichts ändern
  ./scripts/einrichten.sh <schritt>    einen einzelnen Schritt
  ./scripts/einrichten.sh --liste      welche Schritte es gibt
ENDE
}

GEWAEHLT=''
for arg in "$@"; do
  case "$arg" in
    --pruefen|-p)      NUR_PRUEFEN=ja ;;
    --liste|-l)        printf '%s\n' $SCHRITTE; exit 0 ;;
    --hilfe|-h|--help) usage; exit 0 ;;
    -*) printf 'Unbekannte Option: %s\n' "$arg"; usage; exit 2 ;;
    *)  GEWAEHLT="$GEWAEHLT $arg" ;;
  esac
done

printf '%sknoellchenfrei — Einrichtung%s\n' "$F_FETT" "$F_AUS"
printf 'Repository: %s\n' "$REPO_SLUG"
[ "$NUR_PRUEFEN" = ja ] && printf '%sPrüfmodus: es wird nichts geändert.%s\n' "$F_GELB" "$F_AUS"

schritt_werkzeuge

if [ -n "$GEWAEHLT" ]; then
  for name in $GEWAEHLT; do
    case " $SCHRITTE " in
      *" $name "*) [ "$name" = werkzeuge ] || "schritt_$name" ;;
      *) printf 'Unbekannter Schritt: %s\nBekannt: %s\n' "$name" "$SCHRITTE"; exit 2 ;;
    esac
  done
else
  for name in $SCHRITTE; do
    [ "$name" = werkzeuge ] && continue
    "schritt_$name"
  done
fi

schritt_bericht
[ "$OFFEN" -eq 0 ] || exit 1
