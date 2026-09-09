#!/usr/bin/env bash
#
# Prüft die **ausgelieferte** Adresse, nicht den lokalen Build.
#
# Warum es das gibt: Die E2E-Suite misst gegen `vite preview`. Der kennt weder
# die Pages-Funktion mit dem Beta-Riegel noch Cloudflares Weiterleitungen —
# zwei Fehler dieses Projekts waren genau deshalb unsichtbar, bis jemand die
# echte Adresse abgerufen hat:
#
#   * Der **308** auf `/index.html`, der `cache.addAll` scheitern liess und
#     damit die Offlinefähigkeit still abschaltete. Lokal antwortet dort 200.
#   * Die **fehlende Worker-Datei** von MapLibre, die in die SPA-Rückfalladresse
#     lief und `index.html` mit `200 OK` und `text/html` zurückbekam. Kein 404,
#     keine Meldung — die Karte zeichnete nur nie etwas.
#
# Beides hatte dieselbe Form: Ein Status, der Erfolg meldet, und ein Inhalt,
# der etwas anderes ist. Dieses Skript sieht deshalb auf **Status und
# Content-Type**, nie nur auf den Status.
#
#   ./scripts/ausgeliefert-pruefen.sh                       # beide Adressen
#   ./scripts/ausgeliefert-pruefen.sh https://andere.example
set -uo pipefail

# Ohne Argument werden **beide** Adressen geprüft.
#
# `pages.dev` ist die, die der Deploy benennt; `knoellchenfrei.de` ist die, die
# jemand eintippt. Sie können auseinanderlaufen — eine eigene Domain hängt an
# einer Zuordnung, die ein Deploy nicht mitbringt, und ein Riegel, der nur auf
# der einen steht, ist keiner. Bis zum 9. September stand hier nur `pages.dev`
# als Vorgabe: Die eine Adresse, die niemand benutzt.
if [ "$#" -eq 0 ]; then
  gesamt=0
  for adresse in https://knoellchenfrei.de https://knoellchenfrei.pages.dev; do
    "$0" "$adresse" || gesamt=1
  done
  exit "$gesamt"
fi

BASIS="${1%/}"

# Wie lange eine frische Auslieferung anlaufen darf.
#
# **Und warum der ganze Durchgang wiederholt wird, nicht nur der erste Abruf.**
# Die erste Fassung wartete darauf, dass `/` antwortet, und prüfte dann einmal
# durch. Eine Vorschauadresse von Cloudflare Pages breitet sich aber **je Pfad**
# aus: Am 8. September um 04:24 antwortete `/` bereits mit 401, während `/sw.js`
# noch 404 gab — der Lauf meldete sechs Fehlschläge, die eine Minute später alle
# grün waren. Gewartet wird deshalb auf das **Gesamtergebnis**.
DEADLINE=$((SECONDS + 120))

abruf() { # pfad -> "status content-type"
  curl -s -o /dev/null -w '%{http_code} %{content_type}' --max-time 15 "${BASIS}$1"
}

# Ein Durchgang. Schreibt seinen Bericht nach `bericht`, setzt `fehler`.
pruefe() {
  fehler=0
  bericht=""
  sammle() { bericht="${bericht}$1"$'\n'; }
  ok()  { sammle "  ok   $1"; }
  weh() { sammle "  FAIL $1"; fehler=1; }

  sammle ""
  sammle "Der Riegel steht vor allem — nicht nur vor der Startseite"
  # Jeder dieser Pfade wäre ohne Riegel offen: das Bündel, die Zonendaten, das
  # Manifest, der Service Worker. Ein Login *in* der App hätte keinen davon
  # geschützt.
  for pfad in / /statistik/ /data/berlin/zones.geojson /manifest.webmanifest /sw.js; do
    antwort="$(abruf "$pfad")"
    status="${antwort%% *}"
    if [ "$status" = "401" ]; then
      ok "$pfad -> 401"
    else
      weh "$pfad -> $antwort (erwartet 401)"
    fi
  done

  sammle ""
  sammle "Die Anmeldeseite trägt ihre eigenen Kopfzeilen"
  # `_headers` deckt nur die statische Auslieferung ab. Die Anmeldeseite kommt
  # aus der Funktion und ging deshalb einmal ganz ohne Kopfzeilen hinaus —
  # ausgerechnet die einzige Seite, die Unangemeldete zu sehen bekommen.
  kopfzeilen="$(curl -s -o /dev/null -D - --max-time 15 "${BASIS}/")"
  for erwartet in "content-security-policy" "x-content-type-options" \
                  "referrer-policy" "x-robots-tag" "cache-control: no-store"; do
    if printf '%s' "$kopfzeilen" | grep -qi "^${erwartet}"; then
      ok "$erwartet"
    else
      weh "$erwartet fehlt"
    fi
  done

  sammle ""
  sammle "Keine offene Weiterleitung"
  # `new URL('https://…//evil.com/').pathname` ist `//evil.com/` — als Location
  # eine protokollrelative Adresse. Mit falschem Passwort darf hier gar keine
  # Weiterleitung stehen.
  ziel="$(curl -s -o /dev/null -D - --max-time 15 "${BASIS}//evil.example/?invite=bestimmt-falsch" \
          | grep -i '^location:' | tr -d '\r')"
  if [ -z "$ziel" ]; then
    ok "keine Location-Kopfzeile bei falschem Passwort"
  else
    weh "unerwartete Weiterleitung: $ziel"
  fi
}

versuche=0
while : ; do
  versuche=$((versuche + 1))
  pruefe
  [ "$fehler" -eq 0 ] && break
  [ "$SECONDS" -ge "$DEADLINE" ] && break
  # Ein `200` auf `/` ist der schlimmste Fall — die Seite liefert aus, ohne
  # dass der Riegel davorsteht. Den sitzt man nicht aus, den meldet man sofort.
  case "$(abruf / | cut -d' ' -f1)" in
    200) break ;;
  esac
  sleep 10
done

printf '%s' "$bericht"
printf '\nErgebnis\n'
if [ "$fehler" -eq 0 ]; then
  printf '  ✓ %s verhält sich wie erwartet' "$BASIS"
  [ "$versuche" -gt 1 ] && printf ' (nach %s Durchgängen — die Auslieferung lief noch an)' "$versuche"
  printf '\n'
else
  printf '  ✗ Es gibt Abweichungen nach %s Durchgängen. Was hier rot ist, ist im Betrieb rot.\n' "$versuche"
fi
exit "$fehler"
