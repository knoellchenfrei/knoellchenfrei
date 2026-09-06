# Entscheidungen

Was entschieden wurde, warum, und woher die Zahlen stammen. Gedacht für den
Moment, in dem jemand — auch ich in einer neuen Sitzung — fragt „warum ist das
eigentlich so?" und die Begründung sonst nur in einem Chatverlauf stünde, den
es nicht mehr gibt.

Offene Punkte stehen nicht hier, sondern in [todo.md](todo.md).

## Name und Adressen

**Der Name ist `knoellchenfrei`.** Zur Wahl standen auch `freiparken` und
`kiezparken`. `FreiParken` war auf GitHub belegt, `freiparken.de` vergeben;
`knoellchenfrei` und `kiezparken` waren frei. „Knöllchen" ist das Wort, das
Leute in Berlin tatsächlich benutzen.

**Fünf Domains, bestellt am 6. September 2026:**

| Domain | Rolle |
| --- | --- |
| `knoellchenfrei.de` | liefert aus |
| `knoellchenfrei.org` | Vereinsadresse, 301 |
| `knöllchenfrei.de` (`xn--knllchenfrei-5ib.de`) | 301 |
| `knölchenfrei.de` (`xn--knlchenfrei-sfb.de`) | 301 |
| `knoelchenfrei.de` | 301 |

Die Regel dahinter: **Tippfehler passieren bei `.de`, nicht bei `.org`.** Eine
`.org`-Adresse schreibt man von einer Visitenkarte oder einem Link ab; niemand
tippt eine falsche Schreibweise und hängt dann `.org` an. Deshalb alle
Schreibweisen unter `.de`, aber nur die korrekte unter `.org`. Vier `.org`
hätten rund 71 €/Jahr für drei Weiterleitungen gekostet, die nie jemand
aufruft.

Nicht gekauft: `.com` (deutsches Wortspiel, ergibt im Englischen keins),
`.berlin` (falsches Signal — die zweite Stadt ist stehende Anforderung),
`.eu`/`.net`/`.info`/`.app` (Verteidigung ohne Angreifer).

**Registrar-Empfehlung war INWX**, nicht Cloudflare: Cloudflare Registrar führt
`.de`
[nicht](https://community.cloudflare.com/t/will-we-see-domain-registration-support-for-de-domains-in-the-future/482518).
DNS bei Cloudflare geht trotzdem. Gekauft wurde bei einem anderen Anbieter; das
ist unerheblich, solange alle fünf in **einem** Konto liegen — der
Inhaberwechsel auf den späteren Verein ist dann eine Aktion statt fünf.

**Whois-Privacy nicht dazubuchen.** Inhaberdaten sind seit der DSGVO bei `.de`
wie bei gTLDs standardmäßig geschwärzt. Öffentlich wird die Anschrift über das
**Impressum**, nicht über Whois — genau deshalb steht der Verein vor der
Veröffentlichung.

## Trägerschaft

**Ein e.V., nach dem Vorbild von FreiFahren e.V.** (Amtsgericht Charlottenburg,
VR 42496, spendenfinanziert, ohne Werbung —
[Impressum](https://freifahren.org/impressum/)).

**In zehn Minuten geht das nicht.** Der Notartermin ja: Seit dem 1. August 2023
fällt die Vereinsanmeldung durch § 77 Abs. 2 BGB unter das Verfahren nach
§ 40a BeurkG, also öffentliche Beglaubigung per Videokommunikation über das
System der Bundesnotarkammer. Alles andere nicht: sieben Gründungsmitglieder
(§ 56 BGB), Versammlung, Satzung — und danach das Amtsgericht, das Wochen bis
Monate braucht. Der Verein existiert erst mit der Eintragung.

**Der nicht eingetragene Verein ist als Abkürzung geprüft und verworfen.** Seit
dem MoPeG (1. Januar 2024) haften seine Mitglieder nicht mehr persönlich, aber
§ 54 BGB lässt die **Handelndenhaftung** stehen: Wer für den Verein handelt,
haftet persönlich. Das ist genau die Person, die die App betreibt — er löst
also das eine Problem nicht, wegen dem er in Frage käme.

Die Frage, die vorab mit Steuerberatung geklärt gehört: Der naheliegende
Katalogzweck wäre *Verbraucherberatung und Verbraucherschutz*
(§ 52 Abs. 2 Nr. 16 AO). Dazu passt „was kostet Parken hier" gut — die
Kontroll-Heatmap schlechter, weil sie sich als Hilfe beim Umgehen von
Kontrollen lesen lässt.

*(Recherchiert, keine Rechtsberatung.)*

## Veröffentlichung

**Geschlossener Testbetrieb bis zur Eintragung**, und der Riegel ist eingebaut
statt angekündigt: `noindex, nofollow, noarchive` plus eine sperrende
`robots.txt`, beides an den Schalter `PUBLIC_LAUNCH` gehängt statt an ein
Gedächtnis. Der Grund ist nicht Bescheidenheit — solange das Impressum auf eine
Privatperson läuft, entscheidet dieser Riegel, ob diese Anschrift in Indizes und
Archiven landet. Einmal drin, bleibt sie drin.

**Impressum über einen Dienstleister**, empfohlen `online-impressum.de`
(Clear-Media UG, Europaring 90, 53757 Sankt Augustin, ab 3 €/Monat) — derselbe
Anbieter, den FreiFahren e.V. nutzt. Das ist kein Werbeurteil, sondern der
einzige belastbare Hinweis: Ein vergleichbares Berliner Projekt fährt damit
seit Jahren. Grenzen: § 5 DDG (seit 14. Mai 2024 an der Stelle des alten
§ 5 TMG) verlangt eine ladungsfähige Anschrift; ein reiner Briefkasten ohne
Zustellungsbevollmächtigten genügt nicht. Und die Haftung bleibt beim
Betreiber — der Dienst versteckt die Anschrift, er ersetzt den Verein nicht.

## Aufbau

**`knoellchenfrei/knoellchenfrei` — Organisation und Repository gleich
benannt**, wie `FreiFahren/FreiFahren`. Gegen `knoellchenfrei/app`:
Repository-Namen wandern in Verzeichnisse, CI-Dateien und `git remote -v`, und
dort fällt das Präfix der Organisation weg. Ein Ordner namens `app` sagt nichts.
Getrennte Repositories sind absehbar nicht nötig — Kachel-Bau und
Telegram-Worker teilen Typen und Deploy-Werkzeug mit dem Rest.

**Neues Repository statt umgeschriebener Historie.** In den Commits von 2012
steht ein Passwort. Es umzuschreiben zerreißt jeden bestehenden Klon;
`scripts/umzug.sh` legt stattdessen einen einzigen Commit an und behält
die Ideenliste von 2012 als kommentiertes Dokument (`docs/ideen-2012.md`).
Der alte Code selbst zieht nicht mit um: Von 2,8 MB waren nur 256 KB eigener
Quelltext, der Rest Bezirksgrenzen in doppelter Ausfertigung, einkopierte
Fremdbibliotheken und eine Excel-Add-in-Datei. Er bleibt im alten Repository.

**Hosting: Cloudflare** — Pages fürs Frontend, Worker für die API, D1 für die
Daten, R2 für die Kacheln. Derselbe Aufbau wie bei FreiFahren; Begründung und
Zahlen in [hosting.md](hosting.md).

**Ein Worker, nicht zwei.** Telegram hängt als Route `/telegram` am bestehenden
Worker. FreiFahren betreibt dafür einen eigenen `telegram-worker`, aber deren
Umfang rechtfertigt das; bei uns wäre es eine zweite Betriebsumgebung für eine
Funktion, die sich Datenbank, Einfügepfad und Meldegrenze mit der ersten teilt.

## Zweite Stadt

**Eine Stadt zur Zeit, umschaltbar in den Einstellungen** — nicht ein Build je
Stadt, und nicht beide Städte gleichzeitig auf einer Karte.

Die Begründung für einen Build je Stadt stand kurzzeitig im Quelltext und war
**falsch**: Sie behauptete, die Zonendaten lägen im Bündel und ein Wechsel
müsse den halben Datenbestand nachladen. Tatsächlich holt `loadData` die
Dateien seit jeher per `fetch`; sie liegen jetzt je Stadt unter
`public/data/<stadt>/`, und ein Wechsel lädt nach. Der Irrtum steht hier, weil
er die Architektur der zweiten Stadt eine Stunde lang in die falsche Richtung
geschoben hätte.

Das Modell ist FreiFahrens, nachgesehen im ausgelieferten Bündel von
`app.freifahren.org`: eine Stadt-Tabelle mit Schlüssel, Anzeigename,
Kartenmittelpunkt und Datenbank je Stadt; ein `citySwitcher` hinter einem
Feature-Flag; ein Onboarding-Schritt, der sagt „zeigt Community-Meldungen für
jeweils eine Stadt“; und ein Standort-Vorschlag („Switch to {{city}}?“). Live
sind dort Berlin und Leipzig, Hamburg liegt als `listed: false` bereit.

**Beide Städte gleichzeitig zu zeigen wurde verworfen.** Zonen, Meldungen,
Heatmap und Grenzprüfung gehören zusammen; eine Karte, die Berliner Zonen über
Hamburger Meldungen legt, beantwortet keine Frage richtig.

**Der Wechsel lädt die Seite neu.** Am Stadtwechsel hängen Kartenausschnitt,
Zonendaten, Meldegrenze, gespeicherte Parksitzung, Heatmap und
Feiertagskalender. Sie im laufenden Zustand einzeln umzuhängen hieße, sechs
Stellen richtig zu treffen — und die eine, die man vergisst, zeigt danach
Berliner Zonen mit Hamburger Grenzen.

**Zwei Parser, nie ein gemeinsamer.** Die Feeds teilen sich außer der Domäne
nichts: andere Felder, andere Schreibweisen, anderes Ausgabeformat, andere
Achsenreihenfolge. Ein Parser für beide wäre bei jeder Änderung an einer Stadt
für die andere gefährlich.

**Hamburgs Stellplatz-Ebene bleibt draußen.** 203.283 Polygone, je Stellplatz
eines, ohne Tarif und mit leerem Zeitfeld — dieselbe Begründung, aus der
Berlins 214.173 Abschnitte außerhalb des Rings draußen bleiben.

## Oberfläche

**Kopfzeile nach FreiFahrens Vorbild:** zwei Zeilen statt Raster — Suchfeld über
die volle Breite, darunter Zahnrad, Status-Pille und Standort-Knopf. Ab
Tablet-Breite steht die Kopfzeile als Spalte links neben der Seitenleiste, statt
quer unter ihr durchzulaufen. Der Verlaufsbalken ist weg; alles schwebt als
eigene Fläche über der Karte.

**Farbe trägt wieder eine Aussage.** Vorher bekamen alle 103 Zonen dieselbe
Deckkraft — an einem Sonntag hieß das: ganz Berlin türkis, und Türkis bedeutet
„hier ist gerade nichts zu beachten". 95 % der Farbe transportierte keine
Information und nahm der einen orangen Fläche die Wirkung. Jetzt füllt Orange,
Türkis flüstert (7 % Deckkraft, die Kontur trägt die Grenze). **Nicht** auf null:
Der Unterschied zwischen „bewirtschaftete Zone, gerade kostenlos" und „gar keine
Bewirtschaftung" ist eine der Antworten, die diese App gibt.

Zoomabhängige Stile wurden erwogen und verworfen: Zwei Zustände, die beim
Zoomen umschalten, lesen Nutzer als Fehler, und 103 Polygone sind keine
Datendichte, die das rechtfertigt.

**Behindertenparkplätze bleiben, aber leiser.** 923 der 1.499 Orte — die
größte Ebene, standardmäßig ausgeschaltet. Sie zu entfernen hieße, zwei Drittel
der POI-Daten wegzuwerfen für eine Ebene, die niemanden stört, der sie nicht
einschaltet. In Signalgelb war sie allerdings die lauteste der Karte; jetzt Sand,
kleinere Punkte, weniger Deckkraft.

## Als App ablegen

**Getrennte Symbole für `any` und `maskable`.** Vorher war ein einziges SVG als
`"any maskable"` deklariert — der übliche Fehler: Android schneidet dann die
runden Ecken samt einem Stück des Motivs ab, und iOS macht aus einem SVG
überhaupt nichts. Jetzt PNG in 192 und 512, ein randloses zuschnittsicheres
512er und ein `apple-touch-icon`, erzeugt aus einer Quelle durch
`scripts/make-icons.mjs`.

**Der Service Worker aktiviert sich nicht mehr selbst.** `skipWaiting()` beim
Installieren zieht einer laufenden Seite die Dateien unter den Füßen weg: Ein
nachgeladenes Bündel, das es in der neuen Version nicht mehr gibt, führt zu
einer weißen Seite mitten in der Benutzung. Die neue Version meldet sich jetzt
in der Kopfzeile und wartet.

## Kacheln

**PMTiles in R2, kein Kachelserver.** Die
[OSM-Kachelrichtlinie](https://operations.osmfoundation.org/policies/tiles/)
deckt ausgelieferte Anwendungen nicht ab, und die IP-Adressen aller Nutzer gehen
zurzeit an einen Dritten. Der Weg ist derselbe wie bei FreiFahren: eine Datei je
Stadt in R2, die der Browser per Range-Request liest.

Umgesetzt ist die Client-Seite: Mit `VITE_TILES_URL` zeichnet die App aus dem
Archiv, ohne den Wert bleibt alles bei den Rasterkacheln. PMTiles-Leser und
Vektor-Theme werden nur dann nachgeladen — statisch eingebunden wuchs das
Bündel um 40 kB für etwas, das im Artifact ohnehin nie laden darf.

**Zoom 15 als Obergrenze** im Bau-Skript: Darüber geht es um einzelne
Hausnummern, und jede Stufe verdoppelt die Dateigröße ungefähr.

## FreiFahren nennen

Entschieden: **ja, und an einer Stelle, wo Nutzende es lesen.** Bis dahin stand
der Name genau einmal in der README, mitten in einem Satz über die Vereinsform —
eine Nebenbemerkung, keine Danksagung.

Jetzt an zwei Stellen: ein Abschnitt „Dank" in der README, der benennt, was
übernommen wurde (Aufbau, Kartenhosting, mehrere Dialoge, die Trägerschaft), und
ein Eintrag „Vorbild" in den Einstellungen der App, der auf `freifahren.org`
verlinkt.

Der Link ist der eigentliche Dank: Er schickt ihnen Leute, und das ist das
Einzige, was ein Projekt ohne Geld weitergeben kann. Kein Code ist kopiert, es
besteht also keine Lizenzpflicht — die Erwähnung ist eine Entscheidung, keine
Auflage.

## Was bewusst nicht gebaut wurde

- **Telegram-Gruppen mitlesen.** Deutlich mehr Meldungen, aber ungeprüfter
  Fremdtext. Braucht einen Missbrauchsfilter vor dem Schreibpfad (FreiFahren
  betreibt dafür einen eigenen Dienst `report-gate`) und einen Absatz in der
  Datenschutzerklärung.
- **Art der Sichtung.** Ausdrücklich nicht gewollt: Es soll nicht möglich sein,
  einen Abschleppwagen zu melden.
- **Ein Lesepfad für Freitext-Feedback.** Nur der Betreiber liest es. In einem
  Artifact ist das gar nicht ausdrückbar — dessen Regeln lassen „alle schreiben,
  einer liest" nicht zu —, deshalb gibt es Feedback nur mit eigenem Worker.
