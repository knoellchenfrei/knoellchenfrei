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
# Läuft von Hand nach einem Deploy, nicht in der CI: Es braucht die echte
# Adresse, und ein Fork hätte keine.
#
#   ./scripts/ausgeliefert-pruefen.sh                       # Standardadresse
#   ./scripts/ausgeliefert-pruefen.sh https://andere.example
set -uo pipefail

BASIS="${1:-https://knoellchenfrei.pages.dev}"
BASIS="${BASIS%/}"
fehler=0

kopf() { printf '\n%s\n' "$1"; }
ok()   { printf '  ok   %s\n' "$1"; }
weh()  { printf '  FAIL %s\n' "$1"; fehler=1; }

abruf() { # pfad -> "status content-type"
  curl -s -o /dev/null -w '%{http_code} %{content_type}' --max-time 15 "${BASIS}$1"
}

# Eine frische Auslieferung braucht ein paar Sekunden, bis ihre Adresse
# antwortet. Ohne dieses Warten misst der Lauf direkt nach einem Deploy gegen
# eine Adresse, die es noch nicht gibt.
#
# **Und „antwortet" heisst nicht „ist da".** Die erste Fassung wartete nur
# darauf, dass überhaupt ein Status kommt — eine Vorschauadresse von
# Cloudflare Pages liefert in der ersten Minute aber **404**, und das ist ein
# Status. Der Lauf vom 8. September ist genau daran gescheitert und hat elf
# Fehlschläge gemeldet, die eine Minute später alle grün waren. Gewartet wird
# deshalb, solange `000` oder `404` kommt.
#
# Ein `200` bricht die Schleife sofort ab, statt sie auszusitzen: Das ist der
# schlimmste Fall — die Seite liefert aus, ohne dass der Riegel davorsteht —
# und er gehört sofort und beim Namen gemeldet, nicht nach 90 Sekunden als
# „antwortet nicht".
kopf "Warten, bis die Auslieferung wirklich steht"
versuch=0
status="$(abruf / | cut -d' ' -f1)"
while [ "$status" = "000" ] || [ "$status" = "404" ]; do
  versuch=$((versuch + 1))
  if [ "$versuch" -ge 18 ]; then
    weh "${BASIS} liefert nach 90 s noch ${status} — die Auslieferung steht nicht"
    exit 1
  fi
  sleep 5
  status="$(abruf / | cut -d' ' -f1)"
done
ok "${BASIS} liefert aus (${status})"

kopf "Der Riegel steht vor allem — nicht nur vor der Startseite"
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

kopf "Die Anmeldeseite trägt ihre eigenen Kopfzeilen"
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

kopf "Keine offene Weiterleitung"
# `new URL('https://…//evil.com/').pathname` ist `//evil.com/` — als Location
# eine protokollrelative Adresse. Mit falschem Passwort darf hier gar keine
# Weiterleitung stehen, mit richtigem nur eine, die mit genau einem
# Schrägstrich anfängt.
ziel="$(curl -s -o /dev/null -D - --max-time 15 "${BASIS}//evil.example/?invite=bestimmt-falsch" \
        | grep -i '^location:' | tr -d '\r')"
if [ -z "$ziel" ]; then
  ok "keine Location-Kopfzeile bei falschem Passwort"
else
  weh "unerwartete Weiterleitung: $ziel"
fi

kopf "Ergebnis"
if [ "$fehler" -eq 0 ]; then
  printf '  ✓ %s verhält sich wie erwartet\n' "$BASIS"
else
  printf '  ✗ Es gibt Abweichungen. Was hier rot ist, ist im Betrieb rot.\n'
fi
exit "$fehler"
