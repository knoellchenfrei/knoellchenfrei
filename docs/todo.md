# Todo

Offene Punkte in der Reihenfolge, in der sie sinnvoll sind. Getroffene
Entscheidungen mit Begründung stehen in [entscheidungen.md](entscheidungen.md);
Eigenheiten der Arbeitsumgebung in [../CLAUDE.md](../CLAUDE.md). Was hier steht, ist
entschieden; was noch zur Debatte steht, steht in
[oeffentlich-machen.md](oeffentlich-machen.md).

Zeichen: **du** = geht nur mit deinem Konto, deiner Unterschrift oder deinem
Geld. **ich** = kann ich übernehmen, sobald der Vorlauf steht.

## 1. Trägerschaft: Verein gründen — **du**

Das Vorbild ist eingetragen: **FreiFahren e.V.**, Amtsgericht Charlottenburg,
VR 42496, finanziert über Spenden, ohne Werbung und ohne Abo
([Impressum](https://freifahren.org/impressum/)). Genau diese Form löst drei
Probleme, die eine Privatperson als Betreiber nicht löst:

| Problem | Privatperson | e.V. |
| --- | --- | --- |
| Haftung für Inhalte und Ausfälle | privat, unbeschränkt | Vereinsvermögen |
| Name und Anschrift im Impressum | deine, öffentlich | die des Vereins |
| Spenden annehmen | Einkommen | Vereinskonto, bei Gemeinnützigkeit mit Bescheinigung |
| Wenn du keine Lust mehr hast | Projekt ist tot | Vorstand wechselt |

Was dafür nötig ist — die Zahlen sind Größenordnungen, nicht der Kostenvoranschlag
deines Notariats:

- [ ] **Sieben Gründungsmitglieder** finden. Das ist die harte Untergrenze für
      die Eintragung (§ 56 BGB) und in der Praxis die Hürde, an der solche
      Vorhaben scheitern — nicht das Geld.
- [ ] **Satzung** schreiben. Zweck, Sitz, Name, Ein- und Austritt, Beiträge,
      Vorstand, Mitgliederversammlung, Auflösung. Für die Gemeinnützigkeit muss
      der Zweck in der Satzung wörtlich einem Katalogzweck des § 52 Abs. 2 AO
      entsprechen.
- [ ] **Gründungsversammlung** abhalten, Protokoll unterschreiben.
- [ ] **Anmeldung beim Vereinsregister**, notariell beglaubigt (§ 77 BGB).
      Das geht seit dem 1. August 2023 **online**: Das Digitale-Register-Gesetz
      hat § 77 Abs. 2 BGB eingefügt, damit fällt die Vereinsanmeldung unter das
      Verfahren nach § 40a BeurkG — öffentliche Beglaubigung per
      Videokommunikation über das System der Bundesnotarkammer. Nötig sind ein
      Ausweis mit eID, ein Termin und eine qualifizierte elektronische Signatur.
      Zuständig für ganz Berlin ist das Amtsgericht Charlottenburg.
      Beglaubigung rund 40–70 €, Eintragung rund 75–100 €, Bekanntmachung
      10–30 € — zusammen etwa 150 €. Bei anerkannter Gemeinnützigkeit entfällt
      die Eintragungsgebühr.
- [ ] **Gemeinnützigkeit prüfen lassen** — vom Finanzamt für Körperschaften I,
      Berlin. Offen und ehrlich: Der naheliegende Katalogzweck wäre
      *Verbraucherberatung und Verbraucherschutz* (§ 52 Abs. 2 Nr. 16 AO), und
      dazu passt eine App, die sagt, was Parken kostet und wie lange man stehen
      darf. Die Kontroll-Heatmap passt schlechter dazu, weil sie sich als
      Hilfestellung beim Umgehen von Kontrollen lesen lässt. Das ist keine
      Formalie, sondern die eine Frage, die vorab geklärt gehört — mit
      Steuerberatung, nicht mit einer Websuche.
- [ ] **Vereinskonto** eröffnen, Spendenweg entscheiden.
- [ ] Erst danach: Impressum und Datenschutzerklärung auf den Verein umschreiben
      (die Platzhalter stehen in [impressum.md](impressum.md) und
      [datenschutz.md](datenschutz.md)).

**In zehn Minuten geht das nicht.** Der Notartermin ist online möglich, alles
andere nicht: sieben Gründungsmitglieder, eine Versammlung mit Protokoll, eine
Satzung — und danach das Amtsgericht, das Wochen bis Monate braucht. Der Verein
existiert erst mit der Eintragung.

Der schnelle Ausweg trägt nicht: Ein **Verein ohne Rechtspersönlichkeit** ist in
zehn Minuten gegründet (Satzung, zwei Leute, kein Notar, kein Register). Seit
dem MoPeG zum 1. Januar 2024 haften seine Mitglieder auch nicht mehr persönlich
— aber § 54 BGB lässt die **Handelndenhaftung** stehen: Wer für den Verein
handelt, haftet persönlich. Das ist genau die Person, die die App betreibt und
im Impressum steht. Der nicht eingetragene Verein löst also das eine Problem
nicht, wegen dem er hier in Frage käme.

(Recherchiert, keine Rechtsberatung. Die Satzung und die Frage der
Gemeinnützigkeit gehören vor einen Notar und eine Steuerberatung.)

### Bis dahin: geschlossene Beta

Entschieden. Umgesetzt ist der Riegel, nicht bloß ein Hinweis:

- `noindex, nofollow, noarchive` im Dokument und eine `robots.txt`, die alles
  sperrt. Beides hängt an einem Schalter, nicht an einem Menschen: Ohne
  `PUBLIC_LAUNCH=1` baut Vite die Beta-Variante. Zum Start einmal
  `PUBLIC_LAUNCH=1 pnpm build` — dann fällt beides weg.
- Eine „Beta"-Pille in der Kopfzeile und ein Absatz in den Einstellungen, der
  sagt, dass die App von einer Privatperson betrieben wird, bis der Verein
  eingetragen ist.
- Der Link wird nicht beworben. Weitergeben an Bekannte ist der Zweck, posten
  nicht.

- [ ] **Impressum-Dienstleister buchen.** Empfehlung: `online-impressum.de`
      (Clear-Media UG, Europaring 90, 53757 Sankt Augustin), ab 3 €/Monat —
      derselbe Anbieter, den FreiFahren e.V. nutzt. Das ist kein Werbeurteil,
      sondern der einzige belastbare Hinweis: Ein vergleichbares Berliner
      Projekt fährt damit seit Jahren, samt öffentlicher Aufmerksamkeit und
      Reibung mit der BVG.
      Grenzen, die dazugehören: § 5 DDG (seit 14. Mai 2024 an der Stelle des
      alten § 5 TMG) verlangt eine ladungsfähige Anschrift. Ein reiner
      Briefkasten ohne Zustellungsbevollmächtigten genügt dem nicht — die
      Anbieter unterscheiden sich genau darin. Und die **Haftung bleibt bei
      dir**: Der Dienst versteckt die Anschrift, er ersetzt den Verein nicht.

Reihenfolge zählt: Der Verein sollte stehen, **bevor** die App öffentlich
beworben wird. Ein Impressum mit deiner Privatanschrift lässt sich später nicht
mehr zurücknehmen — es steht dann in Archiven.

## 2. Domains — bestellt, Rest offen — **du**

Am 6. September 2026 bestellt. Begründung der Auswahl in
[entscheidungen.md](entscheidungen.md#name-und-adressen).

| Domain | Rolle | Stand |
| --- | --- | --- |
| `knoellchenfrei.de` | **liefert aus** | registriert |
| `knöllchenfrei.de` — `xn--knllchenfrei-5ib.de` | 301 | registriert |
| `knölchenfrei.de` — `xn--knlchenfrei-sfb.de` | 301 | registriert |
| `knoelchenfrei.de` | 301 | registriert |
| `knoellchenfrei.org` | Vereinsadresse, 301 | zuletzt noch ausstehend |

Die Punycode-Formen stehen dabei, weil Cloudflare und die meisten Werkzeuge die
Umlautdomains so verlangen.

- [ ] **Auto-Renew für alle fünf einschalten.** Eine abgelaufene Hauptdomain
      wird binnen Stunden von Drop-Catchern gegriffen. Das ist das einzige echte
      Risiko an diesem Paket und kostet einen Klick.
- [ ] **Cloudflare-Konto anlegen, alle fünf als eigene Zone hinzufügen**, dann
      beim Registrar die Nameserver umstellen. Eigene Zone auch für die reinen
      Weiterleitungen — sonst gibt es für sie kein Zertifikat, und
      `https://knöllchenfrei.de` läuft in eine Warnung statt in ein Redirect.
- [ ] **Weiterleitungen bei Cloudflare einrichten, nicht beim Registrar.**
      Cloudflare *Redirect Rules* sind kostenlos und machen ein sauberes 301 auf
      `https://knoellchenfrei.de/$1`. Registrar-Weiterleitungen arbeiten oft mit
      Frames oder brechen auf der Apex-Domain bei HTTPS.
- [ ] Falls `.org` länger hängt: im Registrar-Konto nachsehen, ob eine
      Bestätigungsmail offen ist. Bei gTLDs ist eine unbestätigte
      E-Mail-Adresse der häufigste Grund für ein stehendes „pending".

## 3. Umzug ins neue Repository — erledigt am 6. September 2026

Entschieden und umgesetzt: **`github.com/knoellchenfrei/knoellchenfrei`** —
Organisation und Repository gleich benannt, klein geschrieben, wie bei
`github.com/FreiFahren/FreiFahren`.

Warum nicht `knoellchenfrei/app`: Repository-Namen wandern in Verzeichnisse, in
CI-Konfigurationen und in `git remote -v`, und dort fällt das Präfix der
Organisation weg. Ein Ordner namens `app` auf der Platte sagt nichts. Die
Doppelnennung in der Adresse ist der Preis dafür, dass der Name überall dort
noch trägt, wo er allein steht. Getrennte Repositories brauchen wir absehbar
nicht: Der Kachel-Bau und der Telegram-Worker teilen sich Typen und
Deploy-Werkzeug mit dem Rest und gehören als Pakete in dasselbe Monorepo.

- [x] Organisation `knoellchenfrei` auf GitHub angelegt.
- [x] Repository `knoellchenfrei` darin angelegt, öffentlich.
- [x] **Zugriff freigegeben** über die Claude-GitHub-App — es gibt kein
      GitHub-Konto „Claude", das man in eine Organisation aufnehmen könnte.
- [x] **Neue Sitzung mit beiden Repositories als Quelle gestartet.** Nur so
      geht es: Eine laufende Sitzung kann ein Repository unter einem anderen
      Eigentümer nicht nachladen („cross-tier adds are not supported").
- [x] **Umzug ausgeführt:** `./scripts/umzug.sh knoellchenfrei/knoellchenfrei`
      im alten Klon, dann `git push neu umzug-…:main`. Ergebnis: ein einziger
      Commit `f733c36`, 144 Dateien, ohne Vorgeschichte. Das Altprojekt von
      2012 ist nicht mitgezogen; es bleibt in `herbeus/parkingzone` erhalten.

Grund für die saubere Historie: In den alten Commits steht ein Passwort von
2012. Es ist längst wertlos, aber es steht dort, und ein neues Repository ist
der einzige Weg, es loszuwerden, ohne die Historie eines bestehenden zu
zerschreiben.

Zwei Dinge, die der Umzug **nicht** mitgenommen hat und die auch nicht fehlen:
`scripts/umzug.sh` behält die alte Adresse als Quellkonstante, und
[neue-sitzung.md](neue-sitzung.md) beschreibt den Start, der einmalig war.
Beide sind ab hier Dokumentation eines abgeschlossenen Vorgangs.

Was am neuen Repository noch offen ist — **du**:

- [ ] **CI-Geheimnisse hinterlegen.** Die Workflows aus `.github/workflows/`
      sind mitgezogen, aber ihre Secrets nicht: `deploy.yml` und
      `setup-cloudflare.yml` brauchen `CLOUDFLARE_API_TOKEN` und
      `CLOUDFLARE_ACCOUNT_ID`, `VITE_API_BASE`. Ohne sie läuft nur
      `ci.yml` durch.
- [ ] **Branch-Schutz für `main`** einschalten, wenn außer dir jemand pusht.
      Solange nicht, ist es Aufwand ohne Gegenwert.

## 4. Eigene Kartenkacheln — **du** (R2), der Rest ist fertig

- [x] **MapLibre kann Vektorkacheln.** Ist `VITE_TILES_URL` gesetzt, zeichnet
      die App aus einem PMTiles-Archiv statt aus OSM-Rasterkacheln — mit
      deutscher Beschriftung und einem Stil, der zur Oberfläche passt. Ohne den
      Wert bleibt alles wie bisher, und der Vektor-Teil liegt nicht einmal im
      Bündel.
- [x] **Bau-Skript steht:** `app/packages/ingest/scripts/build-tiles.sh`.
      Schneidet Berlin aus dem globalen Tagesarchiv von Protomaps — kein
      eigener OSM-Import nötig.
- [ ] **R2-Eimer anlegen**, Archiv hochladen, `tiles.knoellchenfrei.de`
      davorhängen. Zwei Einstellungen entscheiden, ob überhaupt ein Byte
      ankommt: CORS für die App-Domain und durchgereichte Range-Requests.
      Schritte in [hosting.md](hosting.md#4-eigene-kartenkacheln).

Warum das nicht warten sollte: Die Kacheln kommen zurzeit von
`tile.openstreetmap.org`. Deren Nutzungsrichtlinie deckt ausgelieferte
Anwendungen nicht ab, und die IP-Adressen aller Nutzer gehen an einen Dritten,
über den unsere Datenschutzerklärung Auskunft geben muss. Details in
[hosting.md](hosting.md).

## 5. Zweite Stadt — Hamburg läuft, München offen — **ich**

Analyse der Datenlage in [staedte.md](staedte.md). Hamburg ist seit dem
6. September angeschlossen: 145 Gebiete, umschaltbar in den Einstellungen.
Danach München — die einzige weitere Stadt, für die ein konkreter Datensatz
belegt ist. Alles darunter ist bisher nur ein Portal, in dem noch niemand
nachgesehen hat.

- [x] **Stadt als Konfiguration statt als Konstante.** `core/city.ts` trägt
      Mittelpunkt, Zoom, Meldegrenze, Sitzungsgrenze, Bundesland und
      Quellenangabe; `ingest/sources` ist nach Stadt gegliedert; Browser,
      Worker und Telegram-Bot lesen dieselben Grenzen. Berlin stand dafür an
      **sechs** Stellen als Zahlenpaar im Code — die Doku hatte drei behauptet.
      Ein unbekannter Stadtschlüssel wirft, statt auf Berlin zurückzufallen.
- [x] **Feiertagskalender je Bundesland.** `holidaysFor(land, jahr)`; belegt
      sind BE (8. März) und HH (Reformationstag). Ein Land ohne Tabelle wirft.
      Die zwölf übrigen fehlen bewusst — sie gehören nur mit Beleg hinein, und
      die amtlichen Seiten sind aus dieser Umgebung gesperrt.
- [x] **Prüfliste aus [staedte.md](staedte.md) für Hamburg abgearbeitet.**
      Hamburg fällt an keiner Stelle durch: zwei WFS mit Adresse und Typname,
      DL-DE/Namensnennung 2.0, Tarif und Zeiten laut Metadaten im Datensatz.
      Zwei Funde, die dranhängen: Die Lizenz verlangt anders als in Berlin die
      **Nennung der Quelle**, und die Dienst-Beschreibung nennt **veraltete
      Preise** — drei Zonen zu 3/2/1 Euro, während seit dem 1. Juli 2026 vier
      Zonen zu 4,00/3,50/3,00/2,00 Euro gelten.
- [x] **Hamburger Feed angeschlossen.** Der Egress-Proxy ist seit dem
      6. September offen; Hamburg ist abgerufen, geparst und ausgeliefert.
      145 aktive Gebiete von 146, dazu 104 Stadtteile als Kartenkontext.
      Vier Eigenheiten, die kein Metadatensatz nennt und die alle einen Test
      haben: umgekehrte Achsenreihenfolge, Fenster über Mitternacht,
      „werktags" als Mo–**Sa**, und Gebiete ohne Gebühr (Parkscheibe), die
      keine null Euro sind. Einzelheiten in [staedte.md](staedte.md#hamburg-im-einzelnen).
- [x] **Stadtwechsel in den Einstellungen**, nach FreiFahrens Modell: eine
      Stadt zur Zeit, Daten je Stadt unter `public/data/<stadt>/`, zur Laufzeit
      nachgeladen. Die frühere Begründung für einen Build je Stadt war falsch —
      `loadData` hat die Dateien schon immer geholt.
- [ ] **Standort-Vorschlag beim ersten Öffnen.** FreiFahren fragt „Switch to
      {{city}}? Your location looks like you are in {{city}}." Sinnvoll, sobald
      es mehr als zwei Städte gibt; bei zweien reicht der Umschalter.
- [ ] **München als dritte Stadt.** Der Datensatz ist benannt, aber nicht
      geprüft. Vorher ist die Feiertagstabelle zu klären: Mariä Himmelfahrt
      gilt in Bayern **gemeindeweise**, für München also an der Stadt und nicht
      am Land.
- [x] **Produktname entberlinert.** Die App heißt jetzt überall
      `knoellchenfrei`; die `h1` nennt die geladene Stadt dazu. Der interne
      Paketname `@parkingzone/*` bleibt: Ihn umzubenennen wäre Aufwand ohne
      Wirkung nach außen.

## 6. Telegram — **du** (Token), dann **ich**

Zweistufig, weil Stufe 2 ohne Stufe 1 nichts hat, wohin sie schreiben könnte:

- [x] **Stufe 1: Bot, den man anschreibt — gebaut.** Route `/telegram` am
      bestehenden Worker, kein zweiter Dienst. Ein gesendeter Standort wird über
      denselben Pfad eingetragen wie eine Meldung aus der App; `/hilfe`
      erklärt es; alles andere bekommt eine höfliche Absage. Die
      Telegram-Nutzerkennung wird gehasht wie eine IP-Adresse und nur für die
      Meldegrenze benutzt, die Chat-Kennung gar nicht gespeichert.
      21 Unit-Tests auf dem Parser, weil dort fremder Text ankommt.
- [ ] **Namen jetzt belegen — vier Stück, bevor sie weg sind.**
      `@knoellchenfrei` (Dach), `@knoellchenfrei_BE`, `@knoellchenfrei_HH`,
      `@knoellchenfrei_bot`. Am 6. September 2026 waren alle vier frei.
      **Nicht als leere Hülle:** Telegram behält sich ausdrücklich vor, Namen
      ungenutzter Kanäle zurückzuholen — also anlegen, benennen, ein paar Leute
      hineinholen und den Beitritt auf Genehmigung stellen. Das erfüllt
      „benutzt" und bleibt hinter dem Riegel aus Punkt 1. Begründung und
      Wortlaut in [entscheidungen.md](entscheidungen.md#telegram-und-der-name).
- [ ] **Token besorgen und Webhook anmelden.** @BotFather, dann zwei Geheimnisse
      im Worker hinterlegen — die Befehle stehen in
      [hosting.md](hosting.md#telegram-anschließen). Ohne beide antwortet
      `/telegram` mit 404.
- [ ] **Stufe 2: öffentliche Gruppen mitlesen.** Deutlich mehr Meldungen, aber
      ungeprüfter Fremdtext. FreiFahren hängt dafür einen eigenen Dienst
      (`report-gate`) vor jeden Schreibpfad; das brauchen wir dann auch, samt
      einem Satz in der Datenschutzerklärung.
**AtAdminBot ist angesehen — und hilft beim Melden nicht.** Nachgesehen am
6. September 2026 unter
`git.abfelbaum.dev/abfelbaum/bots/telegram/atadminbot`: Das ist ein
**Moderationsbot**, kein Meldebot. Schreibt jemand `@admin` in eine Gruppe,
benachrichtigt er die Administratoren; `/solve` schließt den Fall. Schlagworte
des Projekts: `bot`, `group-administration`, `telegram`. Geschrieben in C#/.NET,
AGPLv3, letzte Änderung Juni 2024, keine Sterne, keine Forks.

Für die Community-Gruppe kann er später nützlich sein — für die Meldungen
nicht, und in unseren Stack (TypeScript, Cloudflare Worker) passt ein
eigenständiger .NET-Dienst nicht ohne zweite Betriebsumgebung. Unser Meldeweg
bleibt Stufe 1 oben.

Die Community ist davon unabhängig: Eine Telegram-Gruppe ist die Community, der
Bot ist nur eine Datenleitung. Die Gruppe kann sofort aufmachen, der Bot muss
warten, bis der Worker steht.

## 7. Auftritt — **du**, vorbereitet ist alles

Bilder, Beschreibungstexte und Namensschema stehen in
[marke.md](marke.md); der Text der Org-Profilseite in
[org-profil.md](org-profil.md). Nichts davon geht über die GitHub-App: Sie darf
in dieser Organisation weder Repositories anlegen noch Einstellungen ändern
(`403 Resource not accessible by integration`).

- [ ] **Bild der Organisation hochladen** — `docs/brand/org-avatar-512.png`.
- [ ] **Vorschaubild des Repositories setzen** — `docs/brand/social-preview-1280x640.png`.
      Ohne das zeigt jeder geteilte Link ein automatisch erzeugtes Bild mit
      Commit-Zahlen.
- [ ] **Beschreibung und Topics** am Repository setzen. Die Topics sind kein
      Schmuck: über `github.com/topics/open-data` und `/civic-tech` findet
      jemand das Projekt, der nicht nach dem Namen sucht. Fertiger
      `gh repo edit`-Befehl in [marke.md](marke.md#3-repository-beschreiben).
- [ ] **Profilseite der Organisation** anlegen — ein Repository namens
      `.github` mit `profile/README.md`, Inhalt steht fertig in
      [org-profil.md](org-profil.md).
- [ ] Bewusst **nicht**: Sponsor-Knopf (dahinter steht kein Konto), private
      E-Mail im Profil (kommt dort nicht wieder weg), Discussions (ein leeres
      Forum wirkt verlassener als keins).
- [ ] **Dependabot-Warnungen und Sicherheitsupdates einschalten.**
      `Settings → Advanced Security` → *Dependabot alerts* und
      *Dependabot security updates*. Die Konfiguration in
      `.github/dependabot.yml` steuert nur die **Versions**updates; die
      Sicherheitsseite hängt an diesen beiden Schaltern und lässt sich nicht
      aus dem Repository heraus setzen. Ohne sie fehlt genau der Teil, der
      dringend ist.
- [ ] **GitHub Pages einschalten**, wenn die App dort liegen soll.
      `Settings → Pages`, Quelle *GitHub Actions*. Der Workflow baut sauber
      durch und scheitert erst beim Ausliefern mit `404 … Ensure GitHub Pages
      has been enabled`. Falls die App stattdessen über Cloudflare Pages
      laufen soll: `pages.yml` löschen, statt sie rot stehen zu lassen.

## 8. Kleinkram — **ich**

- [ ] Bilder für die Installations-Karte neu aufnehmen, sobald die Kacheln
      erreichbar sind: `public/screenshots/` zeigt zurzeit die App ohne
      Hintergrundkarte, weil die Aufnahme in einer Umgebung ohne Zugang zu
      `tile.openstreetmap.org` entstanden ist. Befehl steht im Kopf von
      `apps/web/scripts/make-screenshots.mjs`.
- [ ] Ladepunkt-Belegung, sobald die Lizenzfrage bei der SenMVKU geklärt ist.
- [ ] **Drei Dependabot-PRs, die Code brauchen.** Sie sind rot, und zwar zu
      Recht — jeder hat eine echte Ursache, keine ist ein Flackern:
      - **Vite 8** (PR #6): Vite 8 baut mit rolldown, und unser eigenes Plugin
        `stamp-service-worker` liest im `closeBundle` die fertige
        `dist/index.html`. Die gibt es zu dem Zeitpunkt nicht mehr —
        `ENOENT … dist/index.html`. Der Haken gehört an einen späteren Hook
        oder an das Bundle statt an die Datei.
      - **`@vitejs/plugin-react` 6** (PR #10): verlangt Vite 8
        (`ERR_PACKAGE_PATH_NOT_EXPORTED: './internal'`). Gehört **mit** PR #6
        zusammen; einzeln kann keiner der beiden grün werden. Dependabot kann
        das nicht wissen, weil es keine Gruppe für Hauptversionen gibt.
      - **MapLibre GL 6** (PR #9): kein Default-Export mehr
        (`TS1192` in `App.tsx` und `main.tsx`), dazu verlorene Ereignistypen
        (`TS7006`). Import auf `* as maplibregl` umstellen und die Handler
        typisieren.
      Die fünf Actions-Bumps und `typescript` 7, `@types/node` 26 und
      `@cloudflare/workers-types` 5 sind grün und können zusammengeführt
      werden.
