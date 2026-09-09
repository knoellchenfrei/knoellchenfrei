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

Die App hat **keine Konten, kein Login und keine Zahlungsdaten**.
Es gibt **keine fremden Analyse-Werkzeuge**, keine Werbe-IDs und keine Cookies zu
Werbezwecken. Seit dem 7. September zählt die App mit, **was** benutzt wird — nicht **wer** es benutzt; wie das gebaut ist und wie man widerspricht, steht in
Abschnitt 2.10.

### 2.1 Standort

Die App fragt den Standort **nur**, wenn auf „Wo bin ich?" getippt wird. Die
Position wird ausschließlich im Browser verwendet, um die Parkzone zu bestimmen,
und **nicht** übertragen oder gespeichert. Wird die Freigabe verweigert, ist die
App voll benutzbar — die Position lässt sich stattdessen auf der Karte antippen.

Rechtsgrundlage: Einwilligung, Art. 6 Abs. 1 lit. a DSGVO. Die Einwilligung
erteilt der Browser-Dialog; widerrufbar in den Browser-Einstellungen.

### 2.2 Speicher auf dem Gerät

Im `localStorage` des Browsers liegen **neun** Einträge. Hier stand bis zum
7. September eine Aufzählung von dreien; die Liste war unvollständig
(Audit-Punkt M-019):

| Schlüssel | Inhalt |
| --- | --- |
| `knoellchenfrei.session` | der gemerkte Parkplatz samt Startzeit und Erinnerung |
| `knoellchenfrei.sightings` | gerätelokale Liste eigener Meldungen |
| `knoellchenfrei.marks.v1` | gerätelokale Strichliste für die Heatmap |
| `knoellchenfrei.visit.v1` | tagesfrische Zufallskennung für die Besuchszählung |
| `knoellchenfrei.visits.v1` | zuletzt angezeigte Besuchszahlen |
| `knoellchenfrei.locationAsked.v1` | ob der Standort-Vordialog schon erschien |
| `knoellchenfrei.installHidden.v1` | ob der Installationshinweis weggeklickt wurde |
| `knoellchenfrei.statistik.aus.v1` | ob der Nutzungsstatistik widersprochen wurde |
| `knoellchenfrei:city` | die gewählte Stadt |
| `knoellchenfrei:city-suggestion-dismissed` | Städte, für die „hier bleiben" gewählt wurde |

Diese Daten verlassen das Gerät nicht und lassen sich über die
Browser-Einstellungen jederzeit löschen. Sieben davon sind technisch
erforderlich, damit Parkuhr, Stadtwahl und weggeklickte Hinweise einen Neuladen
überstehen (§ 25 Abs. 2 Nr. 2 TDDDG).

**Zwei nicht:** `knoellchenfrei.visit.v1` und `knoellchenfrei.visits.v1` dienen
der Besuchszählung des Betreibers, nicht einem Dienst, den die Nutzerin
angefordert hat. Ob § 25 Abs. 2 Nr. 2 TDDDG das trägt, ist offen und
anwaltlich zu klären (Audit-Punkt M-020); die ehrliche Alternative wäre, die
Zählung abzuschalten.

### 2.3 Ordnungsamt-Meldungen

Wer eine Sichtung meldet, überträgt an den Server:

| Feld | Genauigkeit |
| --- | --- |
| Position | auf etwa 10 Meter gerundet |
| Zeitpunkt | auf 5 Minuten gerundet |
| Bestätigungen und Widersprüche | Zähler |

Zur Meldung selbst wird ein **gesalzener Hash** der IP-Adresse gespeichert, um
die Meldegrenze durchzusetzen; er wird nach Ablauf des Zeitfensters auf `NULL`
gesetzt. Eine **Stimme** (Bestätigung oder Widerspruch) legt eine eigene Zeile
mit demselben Hash und dem Zeitpunkt auf die Millisekunde an — das ist der
Schlüssel, der „eine Stimme je Person und Meldung" durchsetzt. Diese Zeilen
werden nicht genullt, sondern zusammen mit der Meldung gelöscht, also
spätestens nach 90 Minuten. Auch das stand hier bis zum 7. September nicht
(Audit-Punkt M-019).

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
Zeitpunkt auf die Stunde gerundet**. Gespeichert wird zusätzlich ein
gesalzener Hash der IP-Adresse, allein um die Grenze von vier Rückmeldungen je
Stunde durchzusetzen; er wird nach Ablauf der Stunde auf `NULL` gesetzt. Sonst
nichts. Es gibt **kein Kontaktfeld**:
Wer keine Adresse abfragt, speichert auch keine. Der Preis ist, dass auf eine
Rückmeldung nicht geantwortet werden kann; das Formular sagt das.

Seit dem 9. September reicht der Server **Kategorie und Text** zusätzlich in
einen geschlossenen Telegram-Kanal des Betreibers weiter, sobald dieser
eingerichtet ist — damit eine Rückmeldung gelesen wird, statt nur in der
Datenbank zu liegen. Der Hash der IP-Adresse geht dabei **nicht** mit.
Telegram ist damit ein weiterer Empfänger des Textes; siehe Abschnitt 3.

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

### 2.10 Nutzungsstatistik

**Was gezählt wird.** Wenn in der App etwas passiert — sie wird geöffnet, eine
Zone angesehen, der Standort freigegeben, eine Stadt gewechselt —, erhöht der
Server einen Zähler. Eine Zeile lautet zum Beispiel:

> 7. September, 14 Uhr, Berlin, „App geöffnet": **12**

Mehr steht nicht darin. Es gibt **keine Kennung, keine Sitzung und keine
Reihenfolge**: Was in welcher Abfolge geschah, verlässt das Gerät nicht — die
Ereignisse werden vorher zusammengezählt.

**Ort oder Zeit, nie beides.** Ereignisse mit Ortsbezug — welche Zone angesehen
wurde, in welche Stadt gewechselt — tragen **keine Uhrzeit**, sondern nur den
Tag. Alle anderen tragen die Stunde, aber keinen Ort. Der Grund: Bei wenigen
Nutzenden wäre „14 Uhr, Zone X, einmal" ein einzelnes Ereignis mit Ort **und**
Zeit, und das wäre kein Zähler mehr.

**Was ausdrücklich nicht erhoben wird:**

- **Keine Koordinaten.** Die feinste Ortsangabe ist die Zone, und die ohne
  Uhrzeit.
- **Keine Minute.** Nur die Stunde, und nur ohne Ort.
- **Keine IP-Adresse.** Der Server sieht sie beim Empfang, speichert sie nicht —
  auch nicht gehasht.
- **Kein Referrer, kein Browserkennzeichen, keine Bildschirmgröße**, kein
  Freitext. Eigenschaften des Geräts werden nicht ausgelesen.
- **Nichts auf dem Gerät.** Die Zählungen liegen bis zum Senden im
  Arbeitsspeicher; wer die Seite schließt, hinterlässt nichts.

**Kein neuer Empfänger.** Die Zahlen liegen in derselben Datenbank in der EU wie
die Meldungen. Es ist kein fremder Dienst beteiligt.

**Aufbewahrung:** 90 Tage, dann gelöscht.

**Rechtsgrundlage:** Art. 6 Abs. 1 lit. f DSGVO — das berechtigte Interesse zu
wissen, ob und wie das Angebot benutzt wird. Da kein Zugriff auf Informationen
im Endgerät stattfindet, greift § 25 TDDDG nicht.

**Widerspruch (Art. 21 DSGVO):** In den Einstellungen steht der Schalter
„Anonym mitzählen, was benutzt wird". Wer ihn ausschaltet, sendet nichts mehr —
ohne Rückfrage und ohne Begründung. Ein Gerät, das
`navigator.globalPrivacyControl` meldet, wird von vornherein nicht gezählt.

## 3. Empfänger und Auftragsverarbeiter

| Dienst | Wofür | Hinweis |
| --- | --- | --- |
| ⟨Cloudflare, Inc.⟩ | Auslieferung, Worker, Datenbank | Vertrag zur Auftragsverarbeitung erforderlich. **Nur die Datenbank** ist per `--jurisdiction eu` verbindlich auf die EU beschränkt; der KV-Cache wird weltweit repliziert und der Worker läuft am nächstgelegenen Rand-Knoten. Das trägt trotzdem, weil im KV ausschließlich zwischengespeicherte Behördendaten liegen und der Worker die IP-Adresse zwar verarbeitet, aber nie speichert — geschrieben wird der gesalzene Hash. Hier stand vorher pauschal, die Verarbeitung sei auf die EU beschränkt (Audit-Punkt M-055). |
| OpenStreetMap Foundation | Rasterkacheln | Sieht beim Kachelabruf die IP-Adresse der Nutzenden. **Entfällt in der ausgelieferten Fassung:** Seit dem 7. September liegt für alle vier Städte ein eigenes Vektorarchiv in R2, und `VITE_TILES_URL` ist gesetzt. Die Rasterkacheln sind nur noch der Rückfall für Bauten ohne diese Variable — lokal und in der Testsuite. |
| ~~GitHub, Inc. (`protomaps.github.io`)~~ | ~~Schriften der Vektorkarte~~ | **Entfällt seit dem 7. September.** Die Schriften liegen im eigenen R2-Eimer neben den Kacheln; die Karte macht damit **keinen einzigen fremden Abruf** mehr. Vorher ging die IP-Adresse jedes Betrachters an GitHub, und hier stand zwischenzeitlich, der Abfluss „entfalle" durch das eigene Kachelarchiv — das war falsch, solange die Schriften fehlten (Audit-Punkt M-017). |
| ⟨Telegram Messenger Inc.⟩ | Meldungen über den Bot; Kategorie und Text von Rückmeldungen aus dem Formular (an einen geschlossenen Kanal des Betreibers, ohne IP-Hash) | Die Verarbeitung dort richtet sich nach Telegrams eigenen Bestimmungen und liegt außerhalb des Einflusses dieses Projekts. Entfällt, wenn kein Bot betrieben wird; die Weiterleitung der Rückmeldungen entfällt, solange `TELEGRAM_ADMIN_CHAT` nicht gesetzt ist. |

| Anthropic PBC | nur in der Artifact-Fassung | Dort liegen Meldungen und Anwesenheit im Speicher der Artifact-Laufzeit, gebunden an das Claude-Konto des Betreibers. In der selbst gehosteten Fassung kommt Anthropic nicht vor (Audit-Punkt M-057). |

**Cloudflare Workers Logs sind eingeschaltet** (`[observability] enabled = true`
in `wrangler.toml`). Cloudflare hält damit Anfrageprotokolle des Workers vor,
und die enthalten IP-Adressen. Das gehört in den Vertrag zur
Auftragsverarbeitung und in diese Tabelle — oder abgeschaltet (Audit-Punkt
M-056).

⟨Prüfen und ergänzen, was tatsächlich eingesetzt wird. Der Vertrag zur
Auftragsverarbeitung mit Cloudflare und die Rechtsgrundlage für den
Drittlandtransfer fehlen weiterhin — Audit-Punkt M-007, anwaltlich zu
klären.⟩

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
