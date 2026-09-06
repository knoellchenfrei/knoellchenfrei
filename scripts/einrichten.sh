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

WURZEL="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP="$WURZEL/app"
TOML="$APP/apps/api/wrangler.toml"

# `wrangler` immer über den Workspace. Ein nacktes `npx wrangler` zieht
# irgendeine Version aus dem Zwischenspeicher (gesehen: 4.97 statt der
# festgelegten 4.129), und ohne `pnpm install` im Wurzelverzeichnis fehlt der
# Verweis auf @knoellchenfrei/core — der Build bricht dann mit
# `Could not resolve` ab, was nach einem kaputten Import aussieht und ein
# fehlender Symlink ist.
wr() { (cd "$APP/apps/api" && pnpm --filter @knoellchenfrei/api exec wrangler "$@"); }

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
  local fehlend=''
  for werkzeug in node pnpm curl openssl git; do
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

  if [ ! -d "$APP/node_modules" ]; then
    fehlt "Abhängigkeiten fehlen — hole ich nach"
    [ "$NUR_PRUEFEN" = ja ] || (cd "$APP" && pnpm install)
  else
    ok "Abhängigkeiten liegen"
  fi

  if command -v gh >/dev/null 2>&1 && gh auth status >/dev/null 2>&1; then
    ok "gh angemeldet"
    HAT_GH=ja
  else
    fehlt "gh fehlt oder ist nicht angemeldet"
    hinweis "Ohne gh nennt das Skript nur die Adressen, an denen du es selbst tust."
    hinweis "Nachholen: brew install gh && gh auth login"
  fi

  # Cloudflare: entweder ein Token in der Umgebung oder eine angemeldete
  # Sitzung. Beides ist recht; nichts davon ist es nicht.
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

  if [ "$hat_token" = ja ] && [ "$hat_secret" = ja ]; then
    hinweis "Ob der Webhook hängt, kann nur prüfen, wer den Token hat — das"
    hinweis "Skript kennt ihn nicht (es hat ihn gesetzt, nicht gespeichert)."
    hinweis "Selbst nachsehen: curl \"https://api.telegram.org/bot<TOKEN>/getWebhookInfo\""
    return 0
  fi
  if [ "$NUR_PRUEFEN" = ja ]; then offen_merken; return 0; fi

  hinweis "In Telegram @BotFather anschreiben, /newbot, Namen vergeben."
  adresse "https://t.me/BotFather"
  local token
  token="$(geheim_fragen 'Bot-Token (leer = überspringen, Eingabe unsichtbar):')"
  if [ -z "$token" ]; then fehlt "Telegram übersprungen"; offen_merken; return 0; fi

  # Das zweite Geheimnis weist Telegram gegenüber dem Worker aus. Die
  # Webhook-Adresse ist sonst nur durch Unkenntnis geschützt, und "niemand
  # kennt sie" ist keine Zugangskontrolle.
  local geheim; geheim="$(openssl rand -hex 24)"
  printf '%s' "$token"  | wr secret put TELEGRAM_TOKEN  >/dev/null 2>&1 && ok "TELEGRAM_TOKEN gesetzt"
  printf '%s' "$geheim" | wr secret put TELEGRAM_SECRET >/dev/null 2>&1 && ok "TELEGRAM_SECRET erzeugt und gesetzt"

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

  hinweis "Namen sichern, solange sie frei sind — und nicht als leere Hülle:"
  hinweis "Telegram holt Namen ungenutzter Kanäle zurück. Anlegen, benennen,"
  hinweis "ein paar Leute hineinholen, Beitritt auf Genehmigung stellen."
  hinweis "  @knoellchenfrei  @knoellchenfrei_BE  @knoellchenfrei_HH  @knoellchenfrei_bot"
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

  if wr r2 bucket list 2>/dev/null | grep -q "$R2_EIMER"; then
    ok "R2-Eimer $R2_EIMER besteht"
  else
    fehlt "R2-Eimer $R2_EIMER fehlt"
    if [ "$NUR_PRUEFEN" = ja ]; then offen_merken; else
      if ja_nein "Jetzt anlegen?"; then
        wr r2 bucket create "$R2_EIMER" >/dev/null 2>&1 && ok "angelegt" \
          || { schlimm "ging nicht — fehlt dem Token *Workers R2 Storage:Edit*?"; offen_merken; }
      else
        offen_merken
      fi
    fi
  fi

  local archiv="$APP/packages/ingest/tiles/berlin.pmtiles"
  if [ -f "$archiv" ]; then
    ok "Archiv liegt ($(du -h "$archiv" | cut -f1))"
    if [ "$NUR_PRUEFEN" != ja ] && ja_nein "Hochladen?"; then
      wr r2 object put "$R2_EIMER/berlin.pmtiles" --file="$archiv" --remote \
        && ok "hochgeladen" || { schlimm "ging nicht"; offen_merken; }
    fi
  else
    fehlt "Archiv fehlt — bauen mit: app/packages/ingest/scripts/build-tiles.sh 20260730"
    offen_merken
  fi

  fehlt "Zwei Einstellungen entscheiden, ob überhaupt ein Byte ankommt:"
  hinweis "CORS für die App-Domain und durchgereichte Range-Requests."
  hinweis "Beides im Dashboard am Eimer; Schritte in docs/hosting.md."
  hinweis "Danach VITE_TILES_URL setzen — ohne den Wert bleibt alles bei OSM."
}

# ----------------------------------------------------------------- 5. DNS

schritt_dns() {
  ueberschrift "5. Domains und DNS"
  local domains="knoellchenfrei.de xn--knllchenfrei-5ib.de xn--knlchenfrei-sfb.de knoelchenfrei.de knoellchenfrei.org"
  # Zonen listet nur die REST-API, nicht wrangler. Ohne Token gibt es keinen
  # Befund — und dann wird auch keiner behauptet: Fünf Zeilen "fehlt als Zone"
  # ohne eine einzige Messung wären erfunden.
  local zonen=''
  if [ -n "${CLOUDFLARE_API_TOKEN:-}" ]; then
    zonen="$(curl -sS -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
      'https://api.cloudflare.com/client/v4/zones?per_page=50' 2>/dev/null \
      | tr ',' '\n' | grep -o '"name":"[^"]*"' | cut -d'"' -f4 || true)"
  fi
  if [ -z "$zonen" ]; then
    fehlt "nicht prüfbar — Zonen listet nur die REST-API, dafür braucht es"
    hinweis "CLOUDFLARE_API_TOKEN in der Umgebung (eine wrangler-Anmeldung reicht nicht)."
    hinweis "Nachsehen kannst du selbst hier:"
    adresse "https://dash.cloudflare.com/"
    offen_merken
    return 0
  fi

  local fehlende=''
  for d in $domains; do
    if printf '%s\n' "$zonen" | grep -qx "$d"; then
      ok "$d ist eine Zone"
    else
      fehlt "$d fehlt als Zone"
      fehlende="$fehlende $d"
    fi
  done

  if [ -n "$fehlende" ]; then
    offen_merken
    [ "$NUR_PRUEFEN" = ja ] && return 0
    hinweis "Jede Domain braucht eine **eigene** Zone, auch die reinen"
    hinweis "Weiterleitungen — sonst gibt es für sie kein Zertifikat, und"
    hinweis "https://knöllchenfrei.de läuft in eine Warnung statt in ein Redirect."
    hinweis "Die Punycode-Formen stehen dabei, weil Cloudflare sie so verlangt."
    adresse "https://dash.cloudflare.com/?to=/:account/add-site"
    hinweis "Danach beim Registrar die Nameserver umstellen."
    hinweis "Weiterleitungen als Cloudflare *Redirect Rules* (301 auf"
    hinweis "https://knoellchenfrei.de/\$1), nicht beim Registrar: dessen"
    hinweis "Weiterleitungen arbeiten oft mit Frames oder brechen auf der"
    hinweis "Apex-Domain bei HTTPS."
    weiter || true
  fi

  fehlt "Auto-Renew für alle fünf prüfen"
  hinweis "Der einzige Punkt dieser Liste, an dem ein Versäumnis nicht"
  hinweis "reparierbar ist: Eine abgelaufene Hauptdomain wird binnen Stunden"
  hinweis "von Drop-Catchern gegriffen."
  offen_merken
}

# ------------------------------------------------------------- 6. GitHub

schritt_github() {
  ueberschrift "6. Repository und Organisation"

  if [ "$HAT_GH" != ja ]; then
    fehlt "ohne gh nicht prüfbar"
    adresse "https://github.com/$REPO_SLUG/settings"
    offen_merken
    return 0
  fi

  local json
  json="$(gh api "repos/$REPO_SLUG" 2>/dev/null || true)"

  printf '%s' "$json" | grep -q '"has_pages":true' \
    && ok "GitHub Pages ist an" \
    || { fehlt "GitHub Pages aus — Quelle auf *GitHub Actions*, Custom domain leer lassen"
         adresse "https://github.com/$REPO_SLUG/settings/pages"; offen_merken; }

  local beschreibung
  beschreibung="$(printf '%s' "$json" | grep -o '"description":"[^"]*"' | head -1 | cut -d'"' -f4)"
  [ -n "$beschreibung" ] && ok "Beschreibung steht" || { fehlt "Beschreibung fehlt"; offen_merken; }

  local anzahl
  anzahl="$(gh api "repos/$REPO_SLUG/topics" 2>/dev/null | tr ',' '\n' | grep -c '"[a-z]' || true)"
  [ "${anzahl:-0}" -gt 5 ] && ok "Topics gesetzt ($anzahl)" || { fehlt "Topics fehlen"; offen_merken; }

  # Diese beiden Schalter hängen nicht am Repository-Inhalt. Die Konfiguration
  # in .github/dependabot.yml steuert nur die *Versions*updates; ohne die
  # Schalter fehlt genau der Teil, der dringend ist.
  if gh api "repos/$REPO_SLUG/vulnerability-alerts" >/dev/null 2>&1; then
    ok "Dependabot-Warnungen sind an"
  else
    fehlt "Dependabot-Warnungen und Sicherheitsupdates einschalten"
    adresse "https://github.com/$REPO_SLUG/settings/security_analysis"
    offen_merken
  fi

  # Für das Organisationsbild gibt es in der GitHub-API keinen Endpunkt. Das
  # geht ausschließlich über die Weboberfläche — deshalb steht es hier als
  # Hinweis und nicht als Prüfung.
  hinweis "Nicht prüfbar, weil die API es nicht kennt: das Organisationsbild"
  hinweis "(docs/brand/org-avatar-512.png) und das Vorschaubild des Repositories"
  hinweis "(docs/brand/social-preview-1280x640.png). Beides nur im Browser."
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

SCHRITTE="werkzeuge cloudflare ci telegram kacheln dns github"

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
