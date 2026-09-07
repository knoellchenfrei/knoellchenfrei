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

Alles unter einem Cloudflare-Konto (`K.tommy@gmail.com`,
`feb7167e0ddb59557a38ece3be5a7009`) und einer GitHub-Organisation
(`knoellchenfrei`).

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
(Worker), `BETA_PASSWORD` (Pages), `CLOUDFLARE_API_TOKEN` und
`CLOUDFLARE_ACCOUNT_ID` (GitHub Actions). `scripts/einrichten.sh` legt alle bis
auf die Telegram-Werte selbst an.

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
7. **Beta-Riegel:** neues Passwort setzen, sonst antwortet die Seite mit `503`.
   ```bash
   cd app && pnpm --filter @knoellchenfrei/api exec wrangler pages secret put \
     BETA_PASSWORD --project-name=knoellchenfrei
   ```
8. **Nachmessen**, nicht glauben:
   ```bash
   curl -s -o /dev/null -w '%{http_code}\n' https://knoellchenfrei.de/          # 401
   curl -s https://<worker>/health                                              # {"ok":true}
   curl -s -o /dev/null -r 0-99 -w '%{http_code}\n' "$VITE_TILES_URL"           # 206
   ```

## Der eine unwiederbringliche Punkt

**Die Domains.** Läuft eine aus und wird von jemand anderem registriert, ist
sie weg — kein Skript und keine Sicherung holt sie zurück. Deshalb steht
*Auto-Renew* seit dem ersten Audit ganz oben auf der Liste des Betreibers und
ist der einzige kritische Befund des ganzen Berichts (M-001).

Alles andere ist Code, Konfiguration oder ein paar Tage Daten.

## Was beim Prüfen im Weg steht

Am 7. September gemessen, und es ist genau die Sorte Falle, die man im
Ernstfall nicht sucht: **Es gibt zwei Zugangsdaten, und beide können die
wichtigste Frage nicht beantworten.**

| Schlüssel | Wo | Kann | Kann nicht |
| --- | --- | --- | --- |
| `CLOUDFLARE_API_TOKEN` in der Umgebung, Präfix `cfat_` | aus `wrangler login` | Pages, Worker, Secrets | DNS; `d1 list`; `kv namespace list` |
| `~/.knoellchenfrei-cf-token`, Präfix `cfut_` | echter API-Token | DNS, Zonen | D1, KV |

Der erste ist **kein API-Token**, sondern ein OAuth-Token:
`/user/tokens/verify` antwortet darauf `Invalid API Token`, während Zonen- und
Pages-Abrufe funktionieren. Eine Rechteänderung im Dashboard geht an ihm
vorbei — sie betrifft den anderen.

Und beide scheitern an `wrangler d1 list`, weil wrangler dafür erst die Konten
aufzählt und `User → Memberships → Read` verlangt. Deshalb sagt
`./scripts/einrichten.sh --pruefen cloudflare` heute *„ob es sie gibt, war
nicht zu prüfen"* statt *„weg"* — die ehrliche Antwort, aber eben auch keine.

**Für einen belastbaren Wiederanlauf-Test fehlt ein Token mit Leserechten:**
`D1:Read`, `Workers KV Storage:Read` und `User → Memberships → Read`. Ohne das
lässt sich „meine Datenbank existiert noch" nicht prüfen, und genau das ist die
Frage, mit der ein Ernstfall anfängt.

## Was ungeprüft ist

Ehrlichkeit an der Stelle, an der sie am meisten wert ist:

- **Der Wiederaufbau ist nie durchgespielt worden.** `einrichten.sh` lief
  einmal gegen ein leeres Konto (6. September) und meldete dabei acht Dinge
  falsch. Gegen ein *verlorenes* Konto lief es nie.
- **Es gibt noch keine Sicherung.** `./scripts/sichern.sh --pruefen` sagt das
  auch. Der erste Lauf braucht ein Token mit `D1:Edit`.
- **Ein Zurückspielen ist nie erprobt worden.** Der Weg oben ist hergeleitet,
  nicht gemessen. Ein Probelauf gegen eine Wegwerf-Datenbank wäre eine halbe
  Stunde und die einzige Art, das zu ändern.
