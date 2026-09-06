# Datenschutzerklärung (Entwurf)

> **Dieser Entwurf ist noch nicht veröffentlichungsreif.** Alles mit `⟨…⟩`
> markierte kann nur der Betreiber ausfüllen, und vor einem öffentlichen Betrieb
> gehört der Text anwaltlich geprüft. Was die App technisch verarbeitet, ist
> hier aber vollständig und korrekt beschrieben — das ist der Teil, der sonst
> erfahrungsgemäß geraten wird.

## 1. Verantwortlicher

⟨Vor- und Nachname⟩
⟨Straße und Hausnummer⟩
⟨PLZ Ort⟩
E-Mail: ⟨Adresse⟩

## 2. Was diese App verarbeitet — und was nicht

Die App hat **keine Konten, kein Login, keine Zahlungsdaten und kein Tracking**.
Es gibt keine Analyse-Werkzeuge, keine Werbe-IDs und keine Cookies zu
Werbezwecken.

### 2.1 Standort

Die App fragt den Standort **nur**, wenn auf „Wo bin ich?" getippt wird. Die
Position wird ausschließlich im Browser verwendet, um die Parkzone zu bestimmen,
und **nicht** übertragen oder gespeichert. Wird die Freigabe verweigert, ist die
App voll benutzbar — die Position lässt sich stattdessen auf der Karte antippen.

Rechtsgrundlage: Einwilligung, Art. 6 Abs. 1 lit. a DSGVO. Die Einwilligung
erteilt der Browser-Dialog; widerrufbar in den Browser-Einstellungen.

### 2.2 Speicher auf dem Gerät

Im `localStorage` des Browsers liegen: der gemerkte Parkplatz samt Startzeit und
Erinnerung, eine gerätelokale Liste eigener Meldungen sowie eine
**tagesfrische Zufallskennung** für die Besuchszählung. Diese Daten verlassen
das Gerät nicht und lassen sich über die Browser-Einstellungen jederzeit
löschen. Sie sind technisch erforderlich, damit die Parkuhr einen Neuladen
übersteht (§ 25 Abs. 2 Nr. 2 TDDDG).

### 2.3 Ordnungsamt-Meldungen

Wer eine Sichtung meldet, überträgt an den Server:

| Feld | Genauigkeit |
| --- | --- |
| Position | auf etwa 10 Meter gerundet |
| Zeitpunkt | auf 5 Minuten gerundet |
| Bestätigungen und Widersprüche | Zähler |

**Eine Meldung ist auch eine Ortsangabe über die meldende Person** und für alle
sichtbar. Deshalb die Rundung. Meldungen werden nach **90 Minuten gelöscht**,
nicht archiviert.

Rechtsgrundlage: Art. 6 Abs. 1 lit. a DSGVO — die Meldung erfolgt durch eine
bewusste Handlung.

### 2.4 Kontrolldichte (Heatmap)

Jede Meldung erzeugt zusätzlich eine anonyme Strichliste aus **Tag, Stunde und
einem 250-Meter-Feld** — mehr nicht. Keine Minute, keine Kennung, kein Bezug zur
Meldung, aus der sie entstand. Zwei Strichlisten desselben Tages lassen sich
nicht derselben Person zuordnen. Gelöscht nach **28 Tagen**.

### 2.5 Rückmeldungen („Feedback senden")

Das Formular gibt es **nur in der selbst gehosteten Fassung**, nicht im
Artifact — Begründung unten. Wer es abschickt, überträgt **den Text, die gewählte Kategorie und den
Zeitpunkt auf die Stunde gerundet** — sonst nichts. Es gibt **kein Kontaktfeld**:
Wer keine Adresse abfragt, speichert auch keine. Der Preis ist, dass auf eine
Rückmeldung nicht geantwortet werden kann; das Formular sagt das.

Das ist der einzige Freitext in dieser Anwendung und damit der einzige Inhalt,
der personenbezogene Daten enthalten kann — nicht weil danach gefragt wird,
sondern weil Menschen sie in ein offenes Feld schreiben. Deshalb: ein Hinweis im
Formular, keine Namen, Adressen oder Kennzeichen anzugeben; eine Längengrenze
von 1.000 Zeichen; und **kein Lesezugriff für andere Nutzende** — im
Artifact-Speicher durch eine Regel (`read: "owner"`), im eigenen Server dadurch,
dass es keinen Lese-Endpunkt gibt. Löschung nach **90 Tagen**.

Warum es das Formular nur mit eigenem Server gibt: Der Artifact-Speicher verlangt,
dass Lesen nie strenger geregelt ist als Schreiben. Ein Briefkasten, in den alle
schreiben und in den nur einer hineinsieht, ist dort nicht ausdrückbar; die
privaten Unterbäume je Nutzer wären auch vor dem Betreiber verborgen. Der Worker
kann es, weil es dort schlicht keinen Lese-Endpunkt gibt. Eine Zusage, die die
Ablage nicht einhalten kann, wäre schlechter als eine fehlende Funktion.

Rechtsgrundlage: Art. 6 Abs. 1 lit. a DSGVO — das Absenden ist eine bewusste
Handlung.

### 2.6 Besuchszählung

Für die Anzeige „gerade offen" und „heute" wird je Gerät und Tag **eine** Zeile
gehalten, die nur den Tag und einen Zeitstempel enthält. Jeder Ping
**überschreibt** diese Zeile — es entsteht kein Verlauf, aus dem sich ablesen
ließe, wann jemand die App benutzt hat. Die Kennung wird täglich neu gewürfelt,
Besuche verschiedener Tage sind deshalb nicht verkettbar. Gelöscht nach zwei
Tagen.

### 2.7 Meldungen über Telegram

Es gibt einen Telegram-Bot, dem man einen Standort schicken kann; daraus wird
dieselbe Meldung wie in der App. Verarbeitet wird dabei:

- **der Standort**, genauso gerundet und zeitlich gebucketet wie eine Meldung
  aus der App (Abschnitt 2.3);
- **die Telegram-Nutzerkennung**, und zwar ausschließlich als **gesalzener
  Hashwert**. Sie ist dauerhaft und eindeutig — im Klartext neben einem Ort
  gespeichert wäre sie ein Bewegungsprofil mit Namensschild. Gebraucht wird sie
  nur, um dieselbe Meldegrenze wie in der App durchzusetzen, und dafür genügt
  der Hash.
- **Nicht gespeichert** werden die Chat-Kennung, der Benutzername, der
  angezeigte Name und der Nachrichtentext.

Wer den Bot benutzt, tritt zugleich in eine Beziehung zu **Telegram** — dessen
Datenverarbeitung liegt außerhalb des Einflusses dieses Projekts und richtet sich
nach Telegrams eigenen Bestimmungen. Die App selbst ist ohne Telegram
vollständig nutzbar; der Bot ist ein zusätzlicher Weg, kein notwendiger.

Nicht enthalten und ausdrücklich nicht geplant: **Mitlesen in Telegram-Gruppen.**

Rechtsgrundlage: Art. 6 Abs. 1 lit. a DSGVO — eine Nachricht an einen Bot ist
eine bewusste Handlung.

### 2.8 Ablegen auf dem Startbildschirm

Wird die App auf dem Startbildschirm abgelegt, legt der Browser eine Kopie der
Programmdateien und der eingefrorenen Geodaten in seinem eigenen Zwischenspeicher
ab, damit sie ohne Netz startet. Diese Kopie liegt **auf dem Gerät**, wird nicht
übertragen und verschwindet mit den Websitedaten. Es entsteht dabei keine
Kennung und keine Registrierung bei irgendeinem Dienst.

### 2.9 Server-Protokolle

Beim Abruf verarbeitet der Betreiber der Infrastruktur technisch notwendige
Verbindungsdaten (IP-Adresse, Zeitpunkt, angefragte Ressource). Zur Begrenzung
von Missbrauch bildet der Server aus Verbindungsmerkmalen und einem geheimen
Wert einen **gesalzenen Hashwert**; ohne das Geheimnis ist daraus keine
IP-Adresse rekonstruierbar. Er wird nach Ablauf des Rate-Limit-Zeitfensters auf
`NULL` gesetzt.

Rechtsgrundlage: berechtigtes Interesse am störungsfreien Betrieb,
Art. 6 Abs. 1 lit. f DSGVO.

## 3. Empfänger und Auftragsverarbeiter

| Dienst | Wofür | Hinweis |
| --- | --- | --- |
| ⟨Cloudflare, Inc.⟩ | Auslieferung, Worker, Datenbank | Vertrag zur Auftragsverarbeitung erforderlich; Datenbank per `--jurisdiction eu` auf die EU beschränken |
| OpenStreetMap Foundation | Kartenkacheln | Sieht beim Kachelabruf die IP-Adresse der Nutzenden. **Entfällt**, sobald die Kacheln aus dem eigenen Speicher kommen — vorbereitet, siehe `docs/hosting.md`. |
| ⟨Telegram Messenger Inc.⟩ | Meldungen über den Bot | Nur für Nutzende des Bots. Die Verarbeitung dort richtet sich nach Telegrams eigenen Bestimmungen und liegt außerhalb des Einflusses dieses Projekts. Entfällt, wenn kein Bot betrieben wird. |

⟨Prüfen und ergänzen, was tatsächlich eingesetzt wird.⟩

## 4. Speicherdauer im Überblick

| Daten | Dauer |
| --- | --- |
| Meldungen | 90 Minuten |
| Strichlisten der Heatmap | 28 Tage |
| Rückmeldungen | 90 Tage |
| Besuchszählung | 2 Tage |
| Hashwert einer Telegram-Kennung | mit der Meldung, also 90 Minuten |
| Gerätespeicher | bis zum Löschen durch die Nutzenden |

## 5. Rechte der Betroffenen

Auskunft, Berichtigung, Löschung, Einschränkung, Datenübertragbarkeit und
Widerspruch nach Art. 15 bis 21 DSGVO, sowie Beschwerde bei einer
Aufsichtsbehörde (Art. 77 DSGVO) — in Berlin: Berliner Beauftragte für
Datenschutz und Informationsfreiheit.

**Praktischer Hinweis:** Da weder Meldungen noch Strichlisten eine Kennung
tragen, kann der Betreiber sie **nicht** einer Person zuordnen. Nach Art. 11
DSGVO besteht damit keine Pflicht, allein zur Erfüllung von Betroffenenrechten
zusätzliche Informationen zu erheben. Wer eine Meldung zurücknehmen möchte, kann
sie in der App als „weg" bewerten.

## 6. Kartendaten und Quellen

Parkraumdaten: Geodateninfrastruktur Berlin, Datenlizenz Deutschland Zero 2.0.
Kartenkacheln: © OpenStreetMap-Mitwirkende, ODbL. Einzelheiten in
[`docs/data-sources.md`](data-sources.md).
