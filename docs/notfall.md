# Notfall: was es gibt, was verloren geht, wie es zurückkommt

Diese Datei beantwortet drei Fragen, die vorher nirgends standen und die man
sich nicht im Ernstfall zusammensuchen will: **Was läuft eigentlich? Was ist
weg, wenn es weg ist? In welcher Reihenfolge kommt es zurück?**
Sie ist Audit-Punkt M-010; die Sicherung selbst ist M-008, der
Wiederanlauf-Handgriff M-009.

Stand: 7. September 2026. Was hier steht, ist gemessen, nicht erinnert — wo
etwas ungeprüft ist, steht das dabei.

## Die kurze Antwort

| Frage | Antwort |
| --- | --- |
| Wie viel Datenverlust ist möglich? (RPO) | So alt wie die letzte Sicherung. Sie läuft **von Hand**, also: so lange, wie zuletzt niemand sie angestoßen hat. |
| Wie lange dauert der Wiederaufbau? (RTO) | Rund eine Stunde für Code und Dienste, plus bis zu 24 Stunden für DNS, wenn die Domains mitbetroffen sind. |
| Was ist unwiederbringlich? | Nur die **Domains**, wenn sie auslaufen. Alles andere ist Code oder aus dem Repository wieder herstellbar. |
| Was ist der wahrscheinlichste Ernstfall? | Nicht Brand oder Löschung, sondern ein **verlorener Kontozugang** — ein Konto, zwei Faktoren, ein Mensch. |

## Was läuft

Alles unter **einem** Cloudflare-Konto und der GitHub-Organisation
`knoellchenfrei`.

Die Anmeldeadresse und die Kontokennung stehen hier bewusst **nicht** — dieses
Repository ist öffentlich, und bis zum 7. September standen beide in genau
diesem Absatz. Keines von beiden ist ein Geheimnis im engeren Sinn: Die
Kontokennung ist ein Bezeichner, die Adresse ein Postfach. Zusammen mit dieser
Datei sind sie aber eine Anleitung — sie sagt, was auf dem Konto liegt, was
davon unwiederbringlich ist und wer allein darankommt. Genau das ist der
Halbsatz, der eine Kontoübernahme von einer Vermutung zu einem Plan macht.

Wer die Werte im Ernstfall braucht, holt sie da, wo sie hingehören:

```bash
cd app && pnpm --filter @knoellchenfrei/api exec wrangler whoami   # Konto und Kennung
```

Die Anmeldedaten liegen im Passwortmanager des Betreibers.

| Was | Wo | Aus dem Repository wieder herstellbar? |
| --- | --- | --- |
| Web-App | Cloudflare Pages, Projekt `knoellchenfrei`, dazu `knoellchenfrei.de` und `www.` | **ja**, ein Deploy |
| Beta-Riegel | Pages-Funktion + Secret `BETA_PASSWORD` | Code ja, Passwort **nein** — neu setzen |
| API | Worker `knoellchenfrei-api` | **ja**, ein Deploy |
| Datenbank | D1 `knoellchenfrei`, EU-gebunden | Schema ja (Migrationen), **Inhalt nur aus der Sicherung** |
| Cache | KV-Namespace `CACHE` | **ja** — reiner TTL-Cache, nichts zu sichern |
| Kacheln | R2 `knoellchenfrei-tiles`, `tiles.knoellchenfrei.de` | **ja**, neu bauen (siehe unten) |
| Domains | fünf Zonen bei Cloudflare, registriert beim Registrar | **nein** — siehe „Der eine unwiederbringliche Punkt" |
| Bot | `@knoellchen_bot`, Token beim BotFather | Profiltexte ja, Token **nein** — neu ausstellen |

Geheimnisse, die nirgends im Repository stehen und beim Wiederaufbau neu
gesetzt werden müssen: `CLIENT_SALT`, `TELEGRAM_TOKEN`, `TELEGRAM_SECRET`
(Worker), `BETA_PASSWORD` (Pages), `CLOUDFLARE_API_TOKEN`,
`CLOUDFLARE_ACCOUNT_ID` und `CLOUDFLARE_R2_TOKEN` (GitHub Actions).
`scripts/einrichten.sh` legt alle bis auf die Telegram-Werte selbst an.

Der letzte ist seit dem 7. September dazugekommen und trägt genau **ein**
Recht, *Workers R2 Storage: Edit*: Ohne ihn baut der Workflow *Kacheln* nichts,
und die Karte altert still vor sich hin. Getrennt vom Deploy-Token, weil der
bei jedem Push läuft und absichtlich nur Pages und Worker kann.

## Was in der Datenbank steht — und was davon wehtut

| Tabelle | Inhalt | Bei Verlust |
| --- | --- | --- |
| `feedback` | Freitext von Nutzern, 90 Tage | **Weg und nicht ersetzbar.** Es gibt absichtlich keinen Lesepfad über die API; die Sicherung ist der einzige Weg, an eine Rückmeldung zu kommen. |
| `marks` | Kontrolldichte, 28 Tage | **Weg und nicht ersetzbar** — niemand kann vergangene Kontrollen nachtragen. Die Heatmap fängt bei null an. |
| `sightings` | Meldungen, 90 Minuten | Egal. Nach anderthalb Stunden ist der Bestand ohnehin ersetzt. |
| `visits` | Tageszähler | Egal. Eine Zahl, die morgen neu entsteht. |

Deshalb sichert `scripts/sichern.sh` die ganze Datenbank, nicht eine Auswahl:
Der Abzug ist klein, und eine gepflegte Tabellenliste ist eine Stelle mehr, an
der jemand etwas vergisst.

## Sichern

```bash
./scripts/sichern.sh              # Abzug, verschlüsselt, nach sicherungen/
./scripts/sichern.sh --pruefen    # wie alt ist die jüngste?
```

Beim ersten Mal verlangt das Skript einen Schlüssel und sagt, wie man ihn
erzeugt. **Er gehört in den Passwortmanager, nicht nur auf die Platte** — wer
den Rechner verliert, verlöre sonst Schlüssel und Sicherung im selben Moment.
Dasselbe gilt für die Sicherungsdateien: Ein zweiter Ort ist der Sinn der
Sache.

Verschlüsselt wird, weil der Abzug gesalzene Client-Hashes und
Freitext-Rückmeldungen enthält. Das gehört nicht unverschlüsselt in einen
Ordner, den irgendwann ein Synchronisationsdienst mitnimmt.

**Was hier bewusst fehlt: ein Zeitplan.** Ein Workflow, der nächtlich sichert,
bräuchte den Schlüssel im CI — und damit läge das Einzige, was die Sicherungen
schützt, auf demselben Konto wie die Daten. Solange die Datenmenge klein und
der Verlust verschmerzbar ist (28 Tage Heatmap, 90 Tage Rückmeldungen), ist ein
Handgriff alle paar Wochen die ehrlichere Lösung als eine Automatik, die im
Ernstfall mit verbrennt. **Wiedervorlage, sobald es Nutzer gibt, deren Meldungen
etwas wert sind.**

## Wiederaufbau, in dieser Reihenfolge

Die Reihenfolge ist keine Geschmacksfrage: Jeder Schritt braucht den davor.

1. **Zugang.** Cloudflare-Konto und GitHub-Organisation. Ohne das gar nichts.
2. **Token.** Ein API-Token mit *Workers Scripts:Edit*, *Workers KV
   Storage:Edit*, *D1:Edit*, *Cloudflare Pages:Edit*, *Workers R2
   Storage:Edit*. Für die Prüfschritte zusätzlich die Leserechte, siehe unten.
3. **Ressourcen anlegen:**
   ```bash
   ./scripts/einrichten.sh --neuaufbau cloudflare
   ```
   Das `--neuaufbau` ist der Handgriff, der bis zum 7. September nirgends
   stand: `wrangler.toml` trägt die Kennungen der *alten* KV- und
   D1-Ressourcen. Sie überleben im Repository, die Ressourcen nicht — und das
   Skript hielt eine eingetragene Kennung für den Beweis, dass es sie gibt
   (Audit-Punkt M-009). Mit dem Schalter setzt es sie auf Platzhalter zurück
   und legt beides neu an.
4. **Daten zurückspielen**, falls es eine Sicherung gibt:
   ```bash
   ./scripts/sichern.sh --zurueck sicherungen/knoellchenfrei-<datum>.sql.enc
   ```
   In die **frische** Datenbank, bevor der erste Deploy läuft. Der Abzug
   enthält `CREATE TABLE`; in eine bereits migrierte Datenbank eingespielt
   käme die Migrationstabelle durcheinander.
5. **Rest der Einrichtung:** `./scripts/einrichten.sh` ohne Argument — CI-
   Secrets, Telegram, Kacheln, DNS.
6. **Ausrollen:** ein Push auf `main`, oder *Actions → Deploy → Run workflow*.
7. **Kacheln:** `CLOUDFLARE_R2_TOKEN` setzen und den Workflow *Kacheln* einmal
   von Hand anstoßen — oder lokal
   `app/packages/ingest/scripts/build-tiles.sh --hochladen`. Er lädt jedes
   Archiv nach `v<datum>/` **und** nach `aktuell/`; darauf zeigt
   `VITE_TILES_URL`.
8. **Beta-Riegel:** neues Passwort setzen, sonst antwortet die Seite mit `503`.
   ```bash
   cd app && pnpm --filter @knoellchenfrei/api exec wrangler pages secret put \
     BETA_PASSWORD --project-name=knoellchenfrei
   ```
9. **Nachmessen**, nicht glauben:
   ```bash
   curl -s -o /dev/null -w '%{http_code}\n' https://knoellchenfrei.de/          # 401
   curl -s https://<worker>/health                                              # {"ok":true}
   curl -s -o /dev/null -r 0-99 -w '%{http_code}\n' \
     https://tiles.knoellchenfrei.de/aktuell/berlin.pmtiles                    # 206
   ```

## Der eine unwiederbringliche Punkt

**Die Domains.** Läuft eine aus und wird von jemand anderem registriert, ist
sie weg — kein Skript und keine Sicherung holt sie zurück. Es war der einzige
kritische Befund des ganzen Audits (M-001).

**Seit dem 7. September ist Auto-Renew bei INWX für alle fünf aktiv.** Nachgemessen,
soweit es öffentlich geht: `whois knoellchenfrei.org` nennt
`Registry Expiry Date 2027-09-06` und INWX als Registrar; die DENIC
veröffentlicht für `.de` **kein** Ablaufdatum, die vier `.de`-Domains sind am
selben Tag registriert worden.

Ein Schalter ist trotzdem kein Beweis: Auto-Renew scheitert nicht an sich
selbst, sondern an einer abgelaufenen Karte oder einer Rechnungsmail, die
niemand mehr liest. Dafür stehen zwei Kalendereinträge des Betreibers,
8. März und 9. August 2027, mit genau dieser Prüfung darin. Nachsehen lässt es
sich hinterher an einer Zeile:

```bash
whois knoellchenfrei.org | grep 'Registry Expiry'   # steht dort 2028, ist es durch
```

Alles andere ist Code, Konfiguration oder ein paar Tage Daten.

## Zwei Zugangsdaten, und sie können Verschiedenes

Am 7. September gemessen, und es ist die Sorte Falle, die man im Ernstfall
nicht sucht:

| Schlüssel | Wo | Kann | Kann nicht |
| --- | --- | --- | --- |
| `~/.knoellchenfrei-cf-token`, Präfix `cfut_` | echter API-Token, den `einrichten.sh` benutzt | DNS, Zonen, D1, KV, R2, Memberships | Workers Scripts, Pages — braucht er nicht |
| `CLOUDFLARE_API_TOKEN` in der Shell, Präfix `cfat_` | aus `wrangler login` | Pages, Worker, Secrets | DNS, D1, KV |

Der zweite ist **kein API-Token**, sondern ein OAuth-Token:
`/user/tokens/verify` antwortet darauf `Invalid API Token`, während Zonen- und
Pages-Abrufe funktionieren. Eine Rechteänderung im Dashboard geht an ihm
vorbei — sie betrifft den anderen. Wer etwas an DNS, D1, KV oder R2 tut,
exportiert vorher den Token aus der Datei:

```bash
export CLOUDFLARE_API_TOKEN="$(tr -d '\n' < ~/.knoellchenfrei-cf-token)"
```

`User → Memberships → Read` ist dabei das Recht mit der größten Hebelwirkung:
Ohne es brechen **alle** wrangler-Listenbefehle ab, bevor sie überhaupt fragen
— `d1 list`, `kv namespace list`, `r2 bucket cors list`. Die Fehlermeldung
nennt dann D1 oder KV und führt damit von der Ursache weg.

Der **CI-Token** ist ein dritter und bleibt eng: *Workers Scripts:Edit* und
*Cloudflare Pages:Edit*, mehr nicht. Er rollt nur aus.

## Was ungeprüft ist

Ehrlichkeit an der Stelle, an der sie am meisten wert ist:

- **Der Wiederaufbau ist nie durchgespielt worden.** `einrichten.sh` lief
  einmal gegen ein leeres Konto (6. September) und meldete dabei acht Dinge
  falsch. Gegen ein *verlorenes* Konto lief es nie. Der Teil, der am meisten
  wehgetan hätte — die Daten —, ist inzwischen erprobt, siehe unten.
- **Sicherung und Zurückspielen sind erprobt** — am 7. September, einmal
  vollständig durchgespielt statt hergeleitet:

  | Schritt | Ergebnis |
  | --- | --- |
  | `./scripts/sichern.sh` | 4 KB unverschlüsselt, verschlüsselt nach `sicherungen/` |
  | Wegwerf-Datenbank `knoellchenfrei-probe`, `--jurisdiction eu` | angelegt |
  | Abzug eingespielt | 120 Zeilen geschrieben, 6 Tabellen |
  | Zeilen verglichen | **identisch**: 21 `visits`, 1 `feedback`, 0 `marks`, 0 `sightings`, 0 `votes`, 1 Migration |
  | `d1 migrations apply` danach | „No migrations to apply" — die mitgesicherte `d1_migrations` verhindert einen zweiten Lauf |
  | Wegwerf-Datenbank gelöscht | ja |

  Die letzte Zeile ist die, die vorher offen war: Der Abzug enthält
  `CREATE TABLE` **und** den Migrationsstand. In eine frische Datenbank
  eingespielt kommt danach nichts durcheinander — die Reihenfolge in Schritt 4
  oben stimmt also.

  **Der Schlüssel liegt unter `~/.knoellchenfrei-sicherung-schluessel`** und ist
  seit dem 7. September vorhanden. Er ist das Einzige, was die Sicherungen
  wieder lesbar macht: Ohne Kopie im Passwortmanager verliert man mit dem
  Rechner beides im selben Moment.

  Viel steht in der Sicherung noch nicht — eine Rückmeldung, 21 Besuchszeilen,
  keine Kontrollmarken. Genau deshalb war jetzt der richtige Zeitpunkt: Der
  Probelauf kostete nichts und beweist den Weg, bevor etwas darin steht, das
  wehtut.
