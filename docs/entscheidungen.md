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

## Telegram und der Name

**Die Namen jetzt belegen, die Gruppen aber geschlossen halten.** Zwei Fragen,
die sich nur zusammen beantworten lassen.

*Kann der Name weg sein, wenn ich warte?* Ja, aber anders als vermutet. Die
Telegram-FAQ sagt wörtlich:

> „Due to the fact that one account can register multiple bot and channel
> usernames, we reserve the right to recall usernames assigned to **unused bots
> and channels**, as well as **openly squatted usernames**."

Das schneidet in beide Richtungen. Es schützt vor dem Horten durch andere —
und es heißt, dass eine **leere Reservierung nichts wert ist**: Ein Kanal, in
dem nichts passiert, ist genau der Fall, den Telegram sich vorbehält
zurückzuholen. Ein Name ist also nicht durch Anmelden gesichert, sondern durch
Benutzen.

Dazu kommt: Seit den *Collectible Usernames* auf Fragment kann Telegram einen
dort gehandelten Namen **gar nicht mehr zuteilen** — „they can only be managed
by their respective owners". Wer zu spät kommt, kann ihn dann nur kaufen.

*Sind die Namen frei?* Am 6. September 2026 ja, alle vier. Geprüft über
`t.me/<name>`: Ein vergebener Name liefert Titel und Beschreibung des Kanals,
ein freier nur den Platzhalter „Telegram: Contact @…". Gegenprobe mit
`t.me/durov` und `t.me/freifahren_BE` — beide liefern echte Titel.

**Deshalb: anlegen, benennen, ein paar Leute hineinholen, Beitritt auf
Genehmigung stellen.** Das erfüllt „benutzt" und bleibt trotzdem hinter dem
Riegel, den [todo.md](todo.md#1-trägerschaft-verein-gründen--du) für alles
Öffentliche setzt: Wer eine öffentlich beworbene Gruppe betreibt, betreibt sie
als Privatperson, mit allem, was an Moderationspflicht und Haftung für fremde
Beiträge daranhängt. Das ist derselbe Grund, aus dem die App noch `noindex`
ausliefert.

**Das Schema steht vor dem ersten Namen**, weil andere Städte kommen.
FreiFahren macht es mit einem Stadtkürzel — `@FreiFahren_BE`. Hier genauso,
aber mit dem **Kfz-Kennzeichen** statt dem Ländercode: Die App handelt von
Autos, und ein Unterscheidungszeichen ist das, was auf jedem davon steht.
`@knoellchenfrei` als Dach, `@knoellchenfrei_B` und `@knoellchenfrei_HH` je
Stadt, `@knoellchen_bot` für den Meldeweg (so heißt er tatsächlich — `getMe`
hat es beim Einrichten gezeigt; `@knoellchenfrei_bot` war ein Wunsch, kein Befund). Ein Name ohne Schema müsste bei
der dritten Stadt umbenannt werden, und ein umbenannter Telegram-Link ist ein
toter Link in jedem Beitrag, der ihn je geteilt hat.

*(Recherchiert am 6. September 2026, keine Rechtsberatung.)*

## Abhängigkeiten aktuell halten

**Dependabot, nicht Renovate.** Beide tun dasselbe. Dependabot ist bei GitHub
eingebaut — keine fremde App in der Organisation, keine zusätzlichen Rechte,
keine zweite Stelle, an der ein Token liegt. Renovate kann mehr; „mehr" ist bei
fünf `package.json` und drei Workflow-Dateien kein Argument, und die
Organisation hat ohnehin schon das Problem, dass die eine App, die dort
Rechte hat, zu wenige davon hat.

**Wöchentlich, gebündelt, mit Wartezeit.** Drei Entscheidungen, die zusammen
den Lärm begrenzen, ohne die Sicherheit zu senken:

- **Gruppen** fassen Minor und Patch zu je einem PR für Werkzeug- und
  Laufzeitabhängigkeiten zusammen. Hauptversionen bleiben einzeln: MapLibre,
  React, Vite und Playwright springen nicht folgenlos, und in einem Sammel-PR
  mit zwölf anderen Zeilen liest die niemand.
- **Cooldown — am ersten Lauf gescheitert, dann repariert statt aufgegeben.**
  Die Absicht war eine Woche Wartezeit gegen die npm-Lieferkette: Der häufigste
  Angriff ist eine übernommene Paketpflegerschaft, deren bösartige Version
  binnen ein bis zwei Tagen zurückgezogen wird. Und sie kostet nichts, denn
  laut GitHub-Doku ist `cooldown` „only available for version updates, not
  security updates".

  **Nur verträgt er sich mit pnpm nicht von allein.** Dependabot übersetzt ihn
  in pnpms `minimumReleaseAge` und legt es über den ganzen Auflösungslauf; pnpm
  prüft erst nach dem Auflösen und bricht ab, statt auf eine ältere passende
  Version zurückzufallen. Ein einziges zu junges Paket im Baum — beim ersten
  Lauf `@playwright/test`, 41 Stunden alt und im Lockfile längst
  festgeschrieben — lässt jedes Update scheitern. Offene Konflikte,
  `dependabot-core#13165` und `pnpm#11203`.

  **Den Cooldown herauszunehmen half nicht.** Der zweite Lauf scheiterte
  genauso, und im Protokoll stand, warum: Dependabot reicht auch ohne
  Konfiguration seine eingebaute Drei-Tage-Vorgabe als
  `--config.minimumReleaseAge=4320` durch. Die Einstellung ist also nicht
  abwählbar, nur überschreibbar.

  **Die Abhilfe steht in `app/pnpm-workspace.yaml`:**
  `minimumReleaseAgeExclude: ['*']`. Lokal wirkungslos, weil wir
  `minimumReleaseAge` selbst nie setzen; für Dependabot hebt sie die
  Nebenwirkung auf den restlichen Baum auf. Der Schutz bleibt, denn welche
  Version überhaupt vorgeschlagen wird, entscheidet Dependabot serverseitig —
  pnpm schreibt danach nur noch das Lockfile.

  Warum der Stern und keine Namensliste: nachgemessen, in einem
  Wegwerf-Worktree mit einem künstlichen 90-Tage-Fenster. Ohne Ausnahme
  scheiterte der Lauf an `typescript`; mit `typescript` als einziger Ausnahme
  an `@typescript/typescript-linux-ppc64`, einer transitiven Abhängigkeit, die
  niemand von Hand pflegt; mit dem Stern lief er durch. Wiedervorlage bei
  pnpm 11: Das kennt `minimumReleaseAgeStrict: false` — genau den Rückfall,
  der hier fehlt. 10.33 kennt ihn nicht.

**Ein Eintrag für den ganzen pnpm-Workspace.** `directory: /app` ist die Wurzel
mit `pnpm-workspace.yaml`; von dort erfasst Dependabot die vier Pakete darunter
mit. Ein Eintrag je Paket wäre nicht nur überflüssig, sondern regelwidrig — die
Doku verlangt, dass sich die Verzeichnisse zweier Einträge desselben
Ökosystems nicht überschneiden. pnpm läuft dabei unter
`package-ecosystem: npm`, unterstützt sind pnpm 7 bis 10.

**GitHub Actions bekommt einen eigenen Eintrag.** In den drei Workflows stecken
`actions/checkout`, `actions/setup-node`, `pnpm/action-setup` und
`actions/upload-artifact` — sie laufen mit Repository-Rechten. Eine veraltete
Action ist genau die Art Abhängigkeit, die niemand mitzählt.

**Actions sind auf den Commit gepinnt, nicht auf den Major-Tag.** Seit dem
7. September steht in jedem `uses:` die 40-stellige SHA, dahinter als
Kommentar die Version (`# v7.0.1`). Ein Tag wie `v7` ist beweglich — wer ihn
verschieben kann, verschiebt damit, was mit Repository-Rechten in unserer CI
läuft; das war ein Audit-Finding (M-012/M-013 in `audit/REPORT.md`). Dependabot
versteht das Format und bumpt weiterhin, jetzt SHA samt Kommentar. Aufgelöst
wurden die SHAs per `git ls-remote --tags` — die GitHub-API ist aus dieser
Umgebung auf die eigenen Repositories beschränkt.

**Was Dependabot nicht kann und hier auch nicht soll:** den Pin
`packageManager: pnpm@10.33.0` heben (keine Abhängigkeit, sondern eine
Festlegung), und die Sicherheitswarnungen einschalten — die hängen an zwei
Schaltern in den Repository-Einstellungen, siehe [todo.md](todo.md#7-auftritt--du-vorbereitet-ist-alles).

**Workflow-PRs werden lokal zusammengeführt, nicht über die API.** Sobald ein
PR eine Datei unter `.github/workflows/` anfasst, antwortet der Merge-Endpunkt
mit `refusing to allow a GitHub App to create or update workflow … without
'workflows' permission`. Der Git-Push kann dasselbe problemlos. Der Weg ist
also `git merge --no-ff origin/dependabot/…` und ein Push auf `main`; GitHub
markiert den PR danach von selbst als zusammengeführt. Kein Grund, ihn von
Hand zu schließen — ein geschlossener PR ohne Merge-Vermerk sieht später
aus wie eine abgelehnte Änderung.

**Der erste Schwung Hauptversionen, und was er über den Code gesagt hat.**
Acht der elf Vorschläge waren grün und sind zusammengeführt — darunter
TypeScript 7 ohne eine einzige Beanstandung. Drei waren rot, jeder mit einer
echten Ursache:

- **MapLibre GL 6** hat den Default-Export abgeschafft und exportiert nur noch
  benannt. Ein Namensraum-Import (`import * as maplibregl`) ersetzt ihn, ohne
  den Rest der Datei anzufassen; die drei `TS7006`-Fehler an den
  Klick-Handlern waren Folgefehler desselben kaputten Imports. Nebenbei
  schrumpft das MapLibre-Bündel von 1.053 auf 960 kB.
- **Vite 8** baut mit rolldown, und dessen `closeBundle` läuft, bevor die
  Dateien auf der Platte stehen. Unser Plugin las dort die fertige
  `dist/index.html` — `ENOENT`. Es liest sie jetzt im `writeBundle` aus dem
  Bundle-Objekt, das den Inhalt ohnehin hält. Der Umweg über das Dateisystem
  war nie nötig. Zweiter Stolperstein derselben Umstellung:
  `output.manualChunks` wird von rolldown **aufgerufen** — die Objektform
  ergibt `TypeError: manualChunks is not a function`. Die Funktionsform
  verstehen beide Bundler, also steht dort jetzt eine Funktion.

  **Und der Umbau hat einen Fehler ans Licht geholt, der nicht von ihm kam.**
  Der Service Worker hielt seit der zweiten Stadt gar nichts mehr vor: Die
  Datendateien wanderten nach `data/<stadt>/`, seine Vorabliste stand als fünf
  fest verdrahtete Namen in `vite.config.ts` und zeigte weiter auf
  `data/zones.geojson`. `cache.addAll` scheitert an einer einzigen 404, und
  der Worker fängt den Fehler ab — also wurde **nichts** vorgehalten, die
  App war nicht mehr offlinefähig, und zu sehen war davon nichts. Das ist
  genau die Sorte Fehler, für die es in diesem Projekt eine Regel gibt: Die
  Liste wird jetzt aus dem Verzeichnis gelesen, nicht aufgeschrieben, und zwei
  E2E-Tests rufen jeden Pfad aus dem ausgelieferten `sw.js` ab.
- **`@vitejs/plugin-react` 6** verlangt Vite 8 und kann einzeln gar nicht grün
  werden. Dependabot kann das nicht wissen: Es gibt keine Gruppe für
  Hauptversionen, und eine wäre auch falsch — dann führe jeder große Sprung
  im Sammel-PR mit.

## Oberfläche

**Kopfzeile nach FreiFahrens Vorbild:** zwei Zeilen statt Raster — Suchfeld über
die volle Breite, darunter Zahnrad, Status-Pille und Standort-Knopf. Ab
Tablet-Breite steht die Kopfzeile als Spalte links neben der Seitenleiste, statt
quer unter ihr durchzulaufen. Der Verlaufsbalken ist weg; alles schwebt als
eigene Fläche über der Karte.

**Farbe trägt wieder eine Aussage.** Vorher bekamen alle 103 Zonen dieselbe
Deckkraft — an einem Sonntag hieß das: ganz Berlin türkis, und Türkis bedeutet
„hier ist gerade nichts zu beachten". 95 % der Farbe transportierte keine
Information und nahm der einen orangen Fläche die Wirkung. Seitdem füllt die
kassierende Fläche und die freie flüstert. **Nicht** auf null: Der Unterschied
zwischen „bewirtschaftete Zone, gerade kostenlos" und „gar keine
Bewirtschaftung" ist eine der Antworten, die diese App gibt.

**Nachtrag vom 9. September: der Farbton war falsch, die Gewichtung auch — nur
andersherum als gedacht.** Der Betreiber sagte, das Orange gefalle ihm nicht,
ohne Begründung. Gemessen wurde daraufhin, wie oft es überhaupt zu sehen ist:
An einem Dienstag um 10:30 kassieren **100 % der Zonenfläche** in allen vier
Städten, an 45 bis 84 der 168 Wochenstunden über 90 %. Eine Alarmfarbe markierte
also den Normalfall — die Karte war werktags eine Wand aus Orange, und das
Farbgewicht lag auf dem Häufigen statt auf dem Bemerkenswerten. Dazu zwei
gemessene Kollisionen: gegen die Heatmap-Stufe 0,70 nur **ΔE 0,9** bei
Tritanopie („viel kontrolliert" und „kostet gerade" in derselben Farbe), und die
Kontur gegen Ladepunkt und Umweltzone 7,3.

Jetzt Messing `#cd8700` bei 26 % mit cremefarbener Kontur `#f5cfa0`, und die
freie Fläche steigt von 7 auf 14 % — sie war auf dem Rasterrückfall mit ΔE 5,3
unsichtbar und ist die **seltene**, also die interessante Aussage. Die Kontur
ist bewusst cremefarben und nicht golden: `#f2c94c` liegt bei Deuteranopie
ΔE 1,1 von der Umweltzone entfernt. Alle Zahlen, die verworfenen Paletten und
der Preis stehen in [farben-parkzonen.md](farben-parkzonen.md).

Dabei ist zweierlei aufgefallen, was nicht die Farbe betrifft: Der Satz „Orange
bedeutet …" im Standort-Hinweis wäre stehengeblieben — die App hätte eine Farbe
erklärt, die es nicht mehr gibt —, und die Bildaufnahme hing an der Systemuhr.
Das Bild vom 7. September zeigte „103 von 103 kassieren", das vom 9. September
um 00:08 „0 von 103". Beide Skripte stellen die Uhr jetzt fest.

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

Mit `VITE_TILES_URL` zeichnet die App aus dem Archiv, ohne den Wert bleibt
alles bei den Rasterkacheln. PMTiles-Leser und Vektor-Theme werden nur dann
nachgeladen — statisch eingebunden wuchs das Bündel um 40 kB für etwas, das im
Artifact ohnehin nie laden darf.

**Seit dem 7. September läuft beides.** Vier Archive liegen in R2 (Berlin
89 MB, Hamburg 65 MB, Frankfurt 32 MB, München 32 MB), der Workflow *Kacheln*
baut sie wöchentlich neu, und die App zeigt auf den stabilen Pfad `aktuell/`
statt auf eine Version — sonst müsste nach jedem Bau eine Variable umgesetzt
und neu ausgerollt werden, und das kann ein Workflow nicht.

Dass die Karte davor **nie** etwas gezeichnet hat, lag an keiner dieser
Entscheidungen: MapLibre 6 startet einen Worker aus einer eigenen Datei, die
kein Bundler statisch erkennen kann, und die Anfrage danach lief in die
SPA-Rückfalladresse. Der Befund steht in `docs/todo.md`.

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

## Startseite und Merch — beides erst mit dem Verein

Angesehen am 6. September 2026, weil FreiFahren beides hat.

**`freifahren.org` ist eine Seite für den Verein, nicht für die App.** Die App
liegt getrennt auf `app.freifahren.org`. Die Startseite trägt: Mission, „in
Zahlen", „in deiner Stadt" mit einem Formular *Stadt vormerken*, häufige
Fragen, *Unterstützen* — und eine **Presse-Wand mit über fünfzehn Medien**,
von Spiegel und Zeit über taz und rbb24 bis Golem.

**Eine eigene Startseite: ja, aber nach der Vereinseintragung.** Was diese
Seite trägt, ist genau das, was wir nicht haben — Verein, Spendenkonto,
Presse, vorzeigbare Zahlen. Heute gebaut wäre sie eine Überschrift mit nichts
dahinter und schöbe die App einen Klick weiter weg. Was *vorher* nötig ist,
sind **Impressum und Datenschutz**, und die können Routen in der App sein.

Ein Element lohnt früher als der Rest: **„Stadt vormerken".** Es ist der
einzige Teil, der Information erzeugt, die wir sonst nicht haben — welche Stadt
als dritte drankommt, sonst bleibt es unsere Vermutung. Es sammelt allerdings
E-Mail-Adressen, und damit hängt es wieder am Verein.

**Merch: nein.** Print-on-Demand (FreiFahren nutzt Spreadshirt) kostet kein
Lager und kein Porto, aber es braucht einen **Verkäufer mit Impressum und
Steuernummer**. Das wäre heute eine Privatanschrift — genau das, wogegen der
Beta-Riegel existiert. Und die Presse-Wand ist bei FreiFahren die
*Voraussetzung* für Merch, nicht die Folge: Wer nichts signalisieren kann,
kauft kein T-Shirt. Bei einer Handvoll Testnutzer ist Merch keine Einnahme,
sondern eine Verwaltungsaufgabe mit Finanzamt daran.

**Wiedervorlage für beides:** wenn der Verein eingetragen ist *und* es
Reichweite gibt, die man messen kann. Nicht vorher, und nicht weil das Vorbild
es hat.

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

## Kein CHANGELOG, kein Release-Tag — vorerst

*7. September 2026, Audit-Punkt M-032.*

Der Befund stimmt: Es gibt keine Releases, keine Tags und keine
Änderungsübersicht. Ein CHANGELOG wäre trotzdem falsch, solange die
Auslieferung „jeder Push auf `main`" heißt. Er hätte keine Version, auf die er
sich bezieht, und dupliziert dann die Commit-Historie in einer Datei, die
niemand pflegt — genau die Sorte Dokument, von der dieses Audit ein Dutzend
gefunden hat.

Was stattdessen gilt: Die Commit-Nachrichten tragen die Begründung, und
`docs/entscheidungen.md` trägt die Entscheidungen. Beides ist näher an der
Wahrheit als eine Liste, die aus beidem abgeschrieben wird.

**Wiedervorlage, sobald es eine Version gibt, auf die sich jemand berufen
kann** — also spätestens, wenn die App öffentlich ist und jemand außer dem
Betreiber sie einsetzt. Dann gehören Tag, Release und CHANGELOG zusammen
eingeführt, nicht einzeln.

## Die Kontrolldichte ist voreingestellt an

*7. September 2026.*

Von den sechs Ebenen startet genau eine eingeschaltet. Der Grund ist nicht
Geschmack, sondern was sie zeigt: Ladepunkte, Carsharing, P+R und
Behindertenparkplätze stehen in jeder Karte, die Kontrolldichte **nirgends
sonst**. Sie ist der Grund, warum es diese App über einen Tarifrechner hinaus
gibt.

Dagegen sprach die übliche Regel, eine Oberfläche nichts einschalten zu lassen,
worum niemand gebeten hat. Sie trägt hier nicht: Der Ebenen-Streifen ist auf
dem Handy zugeklappt, und wer eine Ebene erst suchen muss, findet sie nicht.

**Ohne Daten kostet es nichts.** `heat.hasPattern` bleibt falsch, solange zu
wenige Meldungen da sind — dann steht der Schalter auf „an" über einer Fläche,
die leer bleibt, und die Tafel daneben sagt, warum. Aus fünf Meldungen eine
Karte zu färben sähe nach Wissen aus und wäre Rauschen.

## R2-CORS ohne `localhost`

*7. September 2026, Audit-Punkt M-050.*

`app/apps/api/r2-cors.json` erlaubte `http://localhost:5173` und `:4173` am
**Produktiv**-Eimer. Begründet war das nirgends, und nötig ist es nicht: Ohne
gesetzte `VITE_TILES_URL` fällt die App lokal auf die Rasterkacheln von
OpenStreetMap zurück, holt also gar nichts aus R2.

Wer lokal doch gegen die echten Kacheln entwickeln will, trägt seinen Origin
vorübergehend ein und nimmt ihn wieder heraus. Eine dauerhafte Ausnahme für
einen Rechner, der nicht existiert, ist keine.

## shellcheck ja, ESLint und Prettier vorerst nicht

*7. September 2026, Audit-Punkt M-036.*

Der Befund stimmt: Es gab keinen Formatter, keinen Linter, kein shellcheck und
keine statische Sicherheitsanalyse — nichts davon erzwungen.

**shellcheck ist jetzt in der CI**, und das war verdient: Beim ersten Lauf
fand es 15 Hinweise, darunter 13-mal `A && B || C`. Das ist kein
if-then-else — `C` läuft auch, wenn `A` wahr war und `B` scheiterte. Genau
diese Sorte Kette hat in diesem Projekt schon einmal einen Commit rausgehen
lassen, der nichts geändert hatte. Alle 15 sind behoben, der Lauf ist bei
null.

**ESLint und Prettier nicht**, und zwar aus einem Grund, der sich ändern kann:
Der TypeScript-Teil steht auf `strict` samt `noUncheckedIndexedAccess` und
`exactOptionalPropertyTypes`, hat 1084 Unit-Tests und 99,9 % Zeilenabdeckung —
die Klasse Fehler, die ein Linter fängt, fängt hier schon etwas anderes. Und
formatiert ist der Bestand ohnehin einheitlich, weil er von einer Hand stammt.

Ein Linter kostet dagegen sofort: Konfiguration, eine Runde Regelstreit und
ein Commit, der jede Datei anfasst und damit jede `git blame` unbrauchbar
macht.

**Wiedervorlage, sobald ein zweiter Mensch Code beiträgt.** Dann ist der
Nutzen ein anderer — nicht Fehler finden, sondern Streit über Stil vermeiden,
bevor er entsteht.


## Die Nutzungsstatistik reserviert ihr Budget zuletzt

*8. September 2026.*

Ein D1-`batch` läuft der Reihe nach in einer Transaktion. Stand die
Reservierung des Tagesbudgets an erster Stelle, lasen die Zählanweisungen
dahinter bereits den erhöhten Stand — ein Bündel, das den Deckel überschritt,
schrieb **gar nichts**, auch nicht den Teil, der noch gepasst hätte, und die
Antwort meldete trotzdem `written: n`. Gemessen gegen SQLite: Deckel 20,
Stand 18, Bündel mit 5 → Budget 23, geschrieben 0, gemeldet 2.

Die Alternative wäre gewesen, das Budget je Anweisung fortzuschreiben. Das
kostet einen Lesevorgang je Ereignis — und D1 rechnet **gelesene** Zeilen gegen
ein eigenes Tagesbudget ab, was die teure Hälfte ist. Die Reservierung zuletzt
kostet nichts und macht die Antwort wahr.

Der Preis ist ein Überschuss von höchstens einem Bündel. Der war vorher
genauso gross — er lag nur in der Luft statt in der Tabelle.

**`COALESCE(…, 0)` ist dabei Pflicht und kein Schmuck.** Am ersten Bündel eines
Tages gibt es die Budgetzeile noch nicht, `NULL < 5000` ist NULL, und ohne den
Ersatzwert würde an jedem Tag das erste Bündel verworfen: täglich, still, und
ausgerechnet die Zeilen der ersten Stunde.

## Die Aufschlüsselung nach Ausprägung ist eine Positivliste

*8. September 2026.*

`rollupStats` schlüsselt fünf Ereignisse nach ihren Ausprägungen auf —
`layer.on`, `zone.answer`, `zone.source`, `app.open`, `city.suggest`. Ohne das
stünde unter „Was benutzt wird" je Ereignis genau eine Zahl, und
`layer.on: 214` beantwortet die Frage „welche Ebenen werden benutzt" gerade
nicht.

Die naheliegende Formulierung wäre gewesen: *alles ausser den Ortsereignissen*.
Sie steht bewusst nicht da. `zone.open` und `city.switch` tragen Orte als Wert
und gehören durch die k-Schwelle; eine Ausschlussregel wäre in dem Moment
undicht, in dem jemand dem Katalog ein weiteres Ortsereignis hinzufügt — und
zwar ohne dass irgendetwas rot würde. Eine Positivliste kann das nicht. Ein
Test in `apps/api/test/events-sql.test.ts` hält beides fest.

## Kein Deckel je Aufrufer für `/events`

*8. September 2026.*

`POST /events` hat einen Tagesdeckel (5.000 Zählungen) und seit dem
8. September einen je Bündel (200), aber **keinen je Aufrufer**. Damit kann,
wer will, die Statistik eines Tages mit 25 Anfragen füllen; der `Origin`-Kopf
hält das nicht auf, den setzt ein Aufrufer ohne Browser einfach selbst.

Ein Deckel je Aufrufer braucht eine Kennung, und die ist genau das, was diese
Tabelle nicht kennen soll: `events` ist der einzige Datensatz des Projekts ohne
jedes Pseudonym — keine Kennung, keine Sitzung, keine Reihenfolge, keine IP,
auch nicht gehasht. Einen Hash nur für das Rate-Limit einzuführen hiesse, ein
Pseudonym zu schaffen, das es sonst nicht gäbe, und zwar für einen Zähler.

Zwei Dinge machen den Handel vertretbar: Es geht um eine Statistik, nicht um
eine Auskunft. Und es ist **sichtbar** — die Gegenprobe auf der Statistikseite
vergleicht `app.open` mit der Gerätezahl aus einem ganz anderen Schreibweg. Wer
den Tag füllt, drückt die eine Zahl unter die andere, und dort steht dann „da
kommen Zählungen nicht an".

Wiedervorlage, sobald die App öffentlich ist: Dann ist eine WAF-Regel vor
`/events` der richtige Ort, nicht der Worker.

## Vorbereitete Städte liegen auf einem eigenen Zweig

*8. September 2026.*

Köln und Karlsruhe sind vermessen, geparst und getestet — und nicht
eingetragen. Die drei Dateien, die sie anschalten würden (`core/city.ts`,
`core/index.ts`, `ingest/src/sources.ts`), sind absprachepflichtig.

Sie deshalb einfach unversioniert liegen zu lassen war keine Option: Der Code
importiert Namen, die `core` ohne die Einträge nicht exportiert, und
`pnpm -r typecheck` wäre auf dem Arbeitszweig **dauerhaft rot**. Ein dauerhaft
roter Typecheck ist schlimmer als keine Vorarbeit — er macht das nächste echte
Problem unsichtbar.

Also ein eigener Zweig, `staedte/koeln-karlsruhe-vorbereitet`. Die Berichte
liegen auf beiden Zweigen, der Code nur auf jenem; wer die Städte anschalten
will, findet in Abschnitt „Was einzutragen bleibt" fertige Schnipsel.
