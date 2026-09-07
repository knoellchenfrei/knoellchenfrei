# Sicherheit

## Eine Lücke melden

Bitte **kein** öffentliches Issue für Sicherheitsprobleme. Nutze stattdessen
[GitHub Security Advisories](https://github.com/knoellchenfrei/knoellchenfrei/security/advisories/new)
— „Report a vulnerability" im Reiter *Security*.

Der Weg ist seit dem 7. September tatsächlich offen. Vorher stand er hier auch,
aber *Private Vulnerability Reporting* war am Repository **abgeschaltet**: Wer
dem Link folgte, landete auf einer Seite, die das Melden nicht anbietet. Ein
toter Meldeweg ist schlechter als gar keiner, weil er so aussieht, als gäbe es
einen (Audit-Punkt M-003). Nachgeprüft wird das jetzt mit
`./scripts/einrichten.sh --nur-pruefen`, nicht mehr durch Hinsehen.

Was dieser Weg voraussetzt: ein GitHub-Konto. Das ist eine bewusste
Einschränkung und keine Auslassung — solange das Impressum auf eine
Privatperson läuft, ist eine öffentlich genannte E-Mail-Adresse der teurere
Weg. Wer kein Konto hat und etwas Ernstes gefunden hat: ein Issue **ohne
Einzelheiten** („Sicherheitsfrage, bitte um Kontakt") reicht als erster
Schritt.

Zeitrahmen, den wir uns setzen: Eingangsbestätigung innerhalb von drei Tagen,
Ersteinschätzung innerhalb von zehn. **Dahinter steht eine Person** — wer
schnellere Zusagen braucht, bekommt sie hier nicht (Audit-Punkt M-042).

## Bedrohungsmodell

Die App verarbeitet drei Arten von Eingaben, und alle drei gelten als nicht
vertrauenswürdig:

| Quelle | Warum nicht vertrauenswürdig | Behandlung |
| --- | --- | --- |
| Berliner Geodaten | Fremder Feed, kann sich ohne Ankündigung ändern | Parser bricht laut ab statt zu raten; Eingabelänge begrenzt; Build schlägt fehl, wenn eine Zone nicht parst |
| Ordnungsamt-Meldungen | Von anderen Nutzern geschrieben | Jedes Feld einzeln geprüft und begrenzt; ID kommt aus dem Dokumentschlüssel, nie aus dem Inhalt |
| `localStorage` | Übersteht Deploys, von Hand editierbar | Beim Lesen validiert, Unplausibles wird verworfen statt repariert |
| Rückmeldungen (Freitext) | Der einzige freie Text von Fremden | Nur der Betreiber liest; Länge begrenzt, Steuer- und Bidi-Zeichen entfernt, Rate-Limit, Löschung nach 90 Tagen |

## Warum die Heatmap ein eigener Datensatz ist

Die Kontrolldichte-Ebene braucht Wochen an Beobachtungen — genau das, was die
Sichtungen bewusst **nicht** aufheben. Statt die Aufbewahrung der Meldungen zu
verlängern, gibt es einen zweiten, gröberen Datensatz:

| | Sichtungen | Strichliste (Heatmap) |
| --- | --- | --- |
| Ort | ~10 m | 250-m-Raster |
| Zeit | 5-Minuten-Raster | Kalendertag **und Stunde**, keine Minute |
| Aufbewahrung | 90 Minuten | 28 Tage |
| Inhalt | Position, Zeit, Zähler | ausschließlich `{Tag, Zelle}` |

**Die Stunde kam nachträglich dazu, und das ist eine bewusste Verschlechterung.**
Ursprünglich enthielt eine Strichliste nur `{Tag, Zelle}`. Für das Stundenprofil
im Report („typischer Sonntag", Spitze, Ruhe ab) ist die Uhrzeit unverzichtbar —
Kontrollen laufen in Schichten. Was sie zusätzlich preisgibt: dass an einem
bestimmten Tag zu einer bestimmten Stunde irgendwo in einem 250-m-Feld gemeldet
wurde. Was sie **nicht** preisgibt: von wem, in welcher Minute, oder im
Zusammenhang mit welcher anderen Meldung. Die Sichtungsebene veröffentlicht
ohnehin schon 10 m und fünf Minuten an alle; die Stunde in der Strichliste fügt
Dauer hinzu, keine Genauigkeit. Rückgängig zu machen ist es an einer Stelle:
`markFor()` in `packages/core/src/heatmap.ts` gibt die Stunde nicht mehr aus,
und der Report blendet das Diagramm von selbst aus.

Eine Strichliste enthält weder eine Meldungs-ID noch einen Client-Hash und lässt
sich damit nicht auf die Meldung zurückführen, aus der sie entstand. Zwei
Strichlisten desselben Tages sind untereinander nicht verknüpfbar. Was entsteht,
ist ein Histogramm „wie oft fiel eine Meldung in dieses Feld", kein Weg einer
Person. Gelöscht wird, nicht archiviert — im Worker per Cron, im Artifact-Speicher
beim Lesen, lokal beim Laden.

### Die Tagesstrichliste für „heute geöffnet"

Gleiches Muster, noch gröber: eine Zeile je Gerät je Tag, Inhalt nur der
Kalendertag, gelöscht nach zwei Tagen. Die Kennung darin wird **jeden Tag neu
gewürfelt**. Eine über Tage stabile Gerätekennung wäre ein Tracking-Merkmal —
wer den Speicher liest, könnte die Besuche eines Geräts verketten. Eine
tagesfrische beantwortet nur „wie viele verschiedene Geräte heute".

Die Zahl „gerade offen" wird im Artifact gar nicht gespeichert: sie kommt aus
der Anwesenheitsfunktion der Laufzeit und ist weg, sobald jemand den Tab
schließt. Die App veröffentlicht dort ausschließlich `{app: 'knoellchenfrei'}` —
nichts, was eine Person kennzeichnet.

Beim eigenen Worker gibt es keinen solchen Kanal, deshalb kommt beides aus
derselben Zeile: Jeder offene Tab pingt alle zwei Minuten und **überschreibt**
dabei seinen eigenen Zeitstempel. Es bleibt eine Zeile je Gerät und Tag mit dem
*letzten* Ping — kein Verlauf, aus dem sich rekonstruieren ließe, wann jemand
die App benutzt hat. Ein verstecktes Tab pingt nicht. Nach zwei Tagen wird
gelöscht.

Der Wert für „gemeinsam" ist trotzdem nicht null: Wer den Speicher über Wochen
mitschreibt, sieht, an welchen Tagen in welchem Feld gemeldet wurde. Das ist die
bewusst akzeptierte Untergrenze — feiner geht es nicht, ohne die Funktion
aufzugeben.

Kein Login, keine Konten, keine Zahlungsdaten. Die App speichert keine
personenbezogenen Daten über ihre Nutzer, außer dem, was sie selbst melden.

## Getroffene Maßnahmen

**Eingabevalidierung**
- Fahrplan- und Gebührenparser mit Längengrenze (200 bzw. 100 Zeichen); die
  längste echte Angabe hat 51. Ohne Grenze brauchte ein 100k-Zeichen-String
  15 Sekunden zum Ablehnen — quadratisches Backtracking.
- Koordinaten müssen im Bereich einer bekannten Stadt liegen (`cityAt`), sonst wird der Datensatz
  verworfen.
- Zeitstempel werden beidseitig begrenzt. Ein Wert aus der Zukunft ergab sonst
  eine Meldung mit Bestbewertung, die nie verfiel und die kein Widerspruch mehr
  entkräften konnte.
- Zählerstände sind gedeckelt; negative Werte ergaben Bewertungen über 100 %.

**Cross-Site-Scripting**
- Kein `dangerouslySetInnerHTML`, kein `innerHTML` im Anwendungscode. Alle
  Feed-Inhalte laufen als JSX-Text durch React.
- Die einzige HTML-Konstruktion (Karten-Popups) escaped jeden interpolierten
  Wert.
- Der Artifact-Build escaped `<` beim Einbetten von JSON in ein `<script>`-Tag.

**Datenschutz**
- Meldungen werden auf ~10 m gerundet und auf 5-Minuten-Raster gelegt. Eine
  Meldung markiert auch den Standort dessen, der sie abgibt, und ist für alle
  sichtbar.
- Keine Historie: abgelaufene Meldungen werden gelöscht, nicht archiviert. Weder
  im Server noch im Artifact-Speicher entsteht ein Bewegungsprofil.
- Der Client-Hash im Worker enthält nur von Cloudflare gesetzte Werte plus ein
  rotierbares Geheimnis. Ohne Salt wäre er in Minuten auf eine IP zurückrechenbar
  und damit ein Pseudonym, kein anonymer Wert. Er wird nach Ablauf des
  Rate-Limit-Fensters auf `NULL` gesetzt.

**Server (optionaler Cloudflare Worker)**
- Alle SQL-Werte gebunden; die einzige interpolierte Spalte stammt aus einem
  Literal-Union-Typ.
- Rate-Limits auf Meldungen (6/h) und Stimmen (40/h) je Client.
- Eine Stimme pro Client und Meldung, erzwungen über den Primärschlüssel.
- Schreibende Anfragen brauchen `Content-Type: application/json` und einen
  erlaubten `Origin`. CORS allein verhindert keinen Cross-Site-POST.
- CORS fällt geschlossen aus: ohne konfigurierte Allowlist wird kein Header
  gesendet.
- Stündlicher Löschjob, unabhängig vom Lesefilter.

**Abhängigkeiten**
- `pnpm audit`: keine bekannten Lücken (Stand der letzten Prüfung, siehe
  CI-Lauf).
- Keine Laufzeitabhängigkeit im Kernpaket.

## Bekannte Grenzen

- Die Meldungs-API ist ohne Authentifizierung lesbar. Wer regelmäßig abfragt,
  kann mitschreiben, was die 90-Minuten-Löschung danach entfernt. Die Rundung
  begrenzt die Auflösung, verhindert es aber nicht.
- Die Git-Historie dieses Repositories enthält ein MySQL-Entwicklungspasswort
  von 2012. Es zeigt auf `localhost` und wird von nichts Aktuellem verwendet;
  im Arbeitsbaum steht an der Stelle nur noch ein Platzhalter. **Im neuen
  Repository ist es nicht mehr enthalten** — dessen Historie beginnt mit einem
  einzigen Commit, und das Altprojekt zieht nicht mit um (`scripts/umzug.sh`).
  Unabhängig davon: prüfen, ob das Passwort anderswo wiederverwendet wurde.
- Kartenkacheln kommen von einem Dritten. Deren Betreiber sieht die IP-Adressen
  der Nutzer.
