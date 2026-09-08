# Todo

Offene Punkte in der Reihenfolge, in der sie sinnvoll sind. Getroffene
Entscheidungen mit Begründung stehen in [entscheidungen.md](entscheidungen.md),
Ideen ohne Beschluss in [ideen.md](ideen.md);
Eigenheiten der Arbeitsumgebung in [../CLAUDE.md](../CLAUDE.md). Was hier steht, ist
entschieden; was noch zur Debatte steht, steht in
[oeffentlich-machen.md](oeffentlich-machen.md).

Zeichen: **du** = geht nur mit deinem Konto, deiner Unterschrift oder deinem
Geld. **ich** = kann ich übernehmen, sobald der Vorlauf steht.

## Deine halbe Stunde, in der Reihenfolge

Warum das nicht an mich delegierbar ist, steht darunter im Kasten. Alles
Vorbereitete ist verlinkt; keiner der Punkte braucht mehr als ein paar Klicks.

1. **Cloudflare-Konto anlegen**, API-Token erzeugen, Kontokennung notieren.
   Rechte: *Workers Scripts:Edit*, *Workers KV Storage:Edit*, *D1:Edit*,
   *Cloudflare Pages:Edit* — und *Workers R2 Storage:Edit*, wenn im selben
   Zug die Kacheln aus Punkt 4 dazukommen sollen.

   > **Am 6. September fehlte genau `Workers Scripts:Edit`.** KV und D1 legte
   > der Workflow an, der Worker scheiterte mit
   > `Authentication error [code: 10000]` auf
   > `/accounts/…/workers/services/…`. Das sieht nach einem Fehler im Code aus
   > und ist eine fehlende Häkchenreihe im Token.

1a. **Einmalig aufräumen.** Der erste Lauf hat KV und D1 noch unter dem alten
   Namen *parkingzone* angelegt. Beide sind leer, also ist das Löschen
   folgenlos — aber es muss vor dem nächsten Lauf passieren, sonst stehen zwei
   Datenbanken nebeneinander und keine weiß, welche gemeint ist:

   ```bash
   cd app && pnpm install
   W="pnpm --filter @knoellchenfrei/api exec wrangler"

   $W d1 list                      # zeigt, was da ist
   $W d1 delete parkingzone        # fragt nach, tippt den Namen zur Bestätigung
   $W kv namespace list            # den Eintrag mit CACHE im Titel suchen
   $W kv namespace delete --namespace-id 5206119c869e4f84b80225963838bb5c

   # Falls doch ein Worker unter dem alten Namen liegt — der Deploy war
   # gescheitert, wahrscheinlich gibt es keinen:
   $W deployments list --name parkingzone-api   # 'not found' heißt: nichts zu tun
   $W delete --name parkingzone-api             # nur falls es ihn doch gibt
   ```

   *(Erledigt am 6. September; die Zeilen bleiben als Anleitung für den Fall,
   dass es noch einmal nötig wird. `wrangler.toml` trägt seit dem Abend die
   neuen Kennungen.)*

2. **Einrichten — ein Befehl, von deinem Rechner:** `./scripts/einrichten.sh`.
   Er prüft das Token, legt KV, D1, Migrationen und das Pages-Projekt an,
   erzeugt das Salz für die Client-Hashes, setzt die CI-Secrets über `gh`,
   trägt die Kennungen ins Repository und committet sie. Danach rollt jeder
   Push auf `main` aus; der Deploy nimmt die Worker-Adresse aus seiner eigenen
   Ausgabe — ein Secret `VITE_API_BASE` braucht es nur, wenn der Worker später
   hinter einer eigenen Domain liegt. *(Der frühere Weg über einen Workflow
   „Cloudflare einrichten" ist am 6. September abends entfallen — Bootstrap
   ist nicht Deployment, siehe [hosting.md](hosting.md#einrichten).)*

   > **Am 6. September waren das noch sechs Schritte von Hand, und fünf davon
   > waren mein Versäumnis, keine Grenze der Plattform.** Aufgeschrieben, damit
   > die Begründungen nicht verloren gehen: Der Deploy lief nicht von selbst an,
   > weil ein Push mit dem `GITHUB_TOKEN` keine Workflows auslöst — ein Dispatch
   > über die API tut es, also tut es jetzt der Workflow. `VITE_API_BASE`
   > abzutippen war unnötig, weil die Adresse im Deploy-Log steht. `CLIENT_SALT`
   > von Hand zu setzen war es auch: Ein Salz ist ein Zufallswert, den *niemand*
   > kennen muss. Das fehlende Token-Recht kam als
   > `Authentication error [code: 10000]` mitten im Lauf statt als Prüfung
   > davor. Und zwei rote Läufe gingen schlicht auf meine Kappe: das
   > Pages-Projekt, das `pages deploy` nicht selbst anlegt, und Migrationen,
   > die ich hinter das Schema gehängt hatte statt davor.
3. ~~**Dependabot-Warnungen** und **Sicherheitsupdates** einschalten.~~
   **Am 7. September erledigt**, zusammen mit Secret Scanning, Push Protection
   und dem Meldeweg aus `SECURITY.md`.
4. ~~**Auto-Renew** für die fünf Domains (Punkt 2).~~ **Am 7. September
   erledigt** — bei INWX aktiv, mit zwei Kalendereinträgen für 2027 als
   Rückversicherung. Es war der einzige Punkt auf dieser Liste, an dem ein
   Versäumnis nicht reparierbar gewesen wäre.
5. **Telegram-Token** beim BotFather holen (Punkt 6) und die restlichen Namen
   sichern, solange sie frei sind. — Offen, zusammen mit den drei Punkten
   darunter.
6. **`CLOUDFLARE_R2_TOKEN`** als Repository-Secret, ein Recht: *Workers R2
   Storage: Edit*. Ohne ihn baut der Workflow *Kacheln* nichts, und die Karte
   altert still vor sich hin.
7. **`D1:Edit` zum CI-Token hinzufügen.** Der Deploy ruft seit dem
   7. September `wrangler d1 migrations apply` — und bekommt jedes Mal
   `code: 7403`, weil das Token nur *Workers Scripts:Edit* und *Cloudflare
   Pages:Edit* trägt. Wegen `continue-on-error` steht darüber eine gelbe
   Warnung und der Lauf ist grün. Bis dahin muss **jede neue Migration von
   Hand** eingespielt werden; das Schema stimmt heute nur, weil
   `0002_events.sql` so eingespielt wurde. Gefunden am 8. September im Log des
   Laufs von 02:51, nicht beim Lesen des Workflows.
8. **Eine WAF-Regel vor das Anmeldeformular** — Cloudflare-Dashboard,
   *Security → WAF → Rate limiting rules*: `http.request.method eq "POST" and
   http.host eq "knoellchenfrei.de"`, etwa 10 Anfragen je Minute je IP,
   Aktion *Block*. Im kostenlosen Tarif ist genau eine solche Regel enthalten;
   sie ist hier gut angelegt.

   > **Warum das nicht in die Funktion gehört.** Der Riegel ist ein geteiltes
   > Passwort, und ein Versuch kostet den Angreifer eine einzige Anfrage —
   > gedrosselt wird heute nichts. Eine Zählung *in* der Pages-Funktion sähe
   > nach einer Lösung aus und wäre keine: Pages-Funktionen laufen in vielen
   > Isolaten, jedes zählte für sich, und das Ergebnis wäre eine Sicherheit,
   > die es nicht gibt. Die Drosselung gehört vor die Funktion. Gefunden bei
   > der Fehlerjagd in der Nacht zum 8. September, steht auch in
   > [SECURITY.md](../SECURITY.md#bekannte-grenzen).

**Am 6. September abends erledigt** (nachgeprüft, nicht geglaubt):
Organisationsbild, Vorschaubild des Repositories, Beschreibung und alle zwölf
Topics, die Profilseite der Organisation aus einem *öffentlichen*
`.github`-Repository, GitHub Pages mit grünem Lauf — und das API-Token um
`Workers Scripts:Edit` ergänzt, das dem ersten Deploy gefehlt hatte.

> **Warum ich das nicht selbst klicke.** Nicht aus Vorsicht — es geht
> technisch nicht. Ein Browser läuft hier zwar (Chromium und Playwright sind
> installiert), aber kopflos in einem Container, den du weder siehst noch
> bedienst: Es gibt keinen Weg, ein Passwort oder einen zweiten Faktor in
> *diese* Sitzung einzugeben, und ins Chat gehören Zugangsdaten nicht. Über
> die API ging es aus der Cloud-Sitzung ebenfalls nicht:
> `PATCH /repos/…` beantwortete deren Egress-Proxy mit
> **„Repository settings writes are not permitted through this proxy"**, und
> für das **Organisationsbild** gibt es in der GitHub-API überhaupt keinen
> Endpunkt — das kann nur die Weboberfläche.
>
> **Nachtrag vom 7. September:** Aus einer Sitzung auf deinem Rechner gilt die
> Proxy-Sperre nicht. Secret Scanning, Push Protection und Private
> Vulnerability Reporting sind dort genau so eingeschaltet worden. Beim
> Organisationsbild bleibt es dabei — kein Endpunkt, kein Weg. Was ich stattdessen getan habe:
> alles vorbereitet, was ohne dein Konto geht, und deinen Teil auf Klicks
> reduziert (siehe Schritt 2 — der Cloudflare-Aufbau läuft als Workflow).

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

## 2. Domains — erledigt, bis auf die Wiedervorlage 2027

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

- [x] **Auto-Renew ist an** — vom Betreiber am 7. September bestätigt, bei
      INWX für alle fünf. Damit ist der einzige `critical`-Befund des Audits
      erledigt (M-001).

      Was trotzdem bleibt, weil ein Schalter kein Beweis ist: Auto-Renew
      scheitert nicht an sich selbst, sondern an einer abgelaufenen Karte oder
      einer Rechnungs-E-Mail, die niemand mehr liest. Dafür stehen jetzt zwei
      Kalendereinträge (6. März und 9. August 2027) mit der Prüfung darin.

      Nachgemessen am 7. September, damit die Daten nicht geraten sind:
      `whois knoellchenfrei.org` nennt **Registry Expiry Date 2027-09-06** und
      als Registrar INWX. Die DENIC veröffentlicht für `.de` **kein**
      Ablaufdatum — dort steht nur `Status: connect` und das Änderungsdatum;
      alle vier `.de`-Domains sind am selben Tag registriert worden, laufen
      also mit. Wer das nachprüfen will, braucht das INWX-Konto:

      ```bash
      whois knoellchenfrei.org | grep 'Registry Expiry'   # das einzige öffentliche Datum
      ```
- [x] **Cloudflare-Konto und fünf Zonen stehen** — nachgemessen am
      7. September: `knoellchenfrei.de`, `knoellchenfrei.org`,
      `knoelchenfrei.de`, `knöllchenfrei.de` und `knölchenfrei.de` sind eigene
      Zonen und `active`.
- [x] **Weiterleitungen laufen, und zwar bei Cloudflare** — alle vier
      Nebendomains antworten mit `301` auf `https://knoellchenfrei.de/`, mit
      gültigem Zertifikat. Nachgemessen am 7. September, auch für die beiden
      Punycode-Formen `xn--knllchenfrei-5ib.de` und `xn--knlchenfrei-sfb.de`.
- [x] `.org` hängt nicht mehr — die Zone ist `active` und leitet weiter.
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

- [x] **CI-Geheimnisse hinterlegt.** `deploy.yml` braucht
      `CLOUDFLARE_API_TOKEN` und `CLOUDFLARE_ACCOUNT_ID`; `VITE_API_BASE` ist
      seit dem 6. September **optional** — der Deploy nimmt die Worker-Adresse
      aus seiner eigenen Ausgabe, wenn kein Secret gesetzt ist.
      `./scripts/einrichten.sh ci` setzt beide, wenn `gh` angemeldet ist.
- [x] **Der Sicherheits-Meldeweg funktioniert jetzt wirklich** — am
      7. September eingeschaltet (Audit-Punkt M-003).

      `SECURITY.md` verwies auf *Private Vulnerability Reporting*, und das war
      am Repository **abgeschaltet**: Wer dem Link folgte, landete auf einer
      Seite ohne Meldeformular. Ein toter Meldeweg ist schlechter als gar
      keiner, weil er wie ein vorhandener aussieht — dieselbe Sorte Fehler wie
      `cache.addAll`, `pnpm fetch` und der fehlende MapLibre-Worker: etwas
      meldet Erfolg und tut nichts.

      Mit eingeschaltet, weil es am selben Schalterbrett lag und für
      öffentliche Repositories nichts kostet: **Secret Scanning** und **Push
      Protection** — die fangen ein versehentlich committetes Token schon vor
      dem Push, was die eigene Prüfung in der CI (`geheimnisse-pruefen.sh`,
      M-091) grundsätzlich nicht kann. Dazu Dependabot-Warnungen und
      -Sicherheitsupdates.

      `einrichten.sh` prüft alle drei jetzt selbst, statt sie zu glauben.

      Nicht durchgegangen sind `secret_scanning_non_provider_patterns` und
      `secret_scanning_validity_checks`: Die `PATCH`-Anfrage kommt ohne Fehler
      zurück und der Status bleibt `disabled` — vermutlich brauchen sie GitHub
      Advanced Security. Beide sind Zusatznutzen, keine Grundlage.

      Was **nicht** dazugehört: eine E-Mail-Adresse als zweiter Weg. Solange
      das Impressum auf eine Privatperson läuft, ist eine öffentlich genannte
      Adresse der teurere Weg; `SECURITY.md` sagt das jetzt ausdrücklich, statt
      die Lücke offenzulassen.

- [x] **Branch-Schutz für `main`: bewusst aus** — Entscheidung des Betreibers
      vom 7. September (Audit-Punkt M-002).

      Am Repository arbeiten genau zwei: der Betreiber und diese Sitzung. Eine
      Regel, die einen Review verlangt, den niemand geben kann, führt zu einem
      Schalter, den man bei jedem Push umlegt — und das ist schlechter als
      keine Regel, weil es so aussieht, als gäbe es eine.

      **Wiedervorlage, sobald jemand Drittes Schreibrechte bekommt.** Dann
      gehören dazu: Pflicht-PR, grüne CI als Bedingung, keine
      Force-Pushes. Was den Befund entschärft, ist bereits da: Die CI läuft auf
      jedem Push, der Deploy-Token kann nur Pages und Worker, und jeder Commit
      ist signiert nachvollziehbar.

## 4. Eigene Kartenkacheln — läuft, bis auf einen Token

- [x] **MapLibre kann Vektorkacheln.** Ist `VITE_TILES_URL` gesetzt, zeichnet
      die App aus einem PMTiles-Archiv statt aus OSM-Rasterkacheln — mit
      deutscher Beschriftung und einem Stil, der zur Oberfläche passt. Ohne den
      Wert bleibt alles wie bisher, und der Vektor-Teil liegt nicht einmal im
      Bündel.
- [x] **Bau-Skript steht:** `app/packages/ingest/scripts/build-tiles.sh`.
      Schneidet Berlin aus dem globalen Tagesarchiv von Protomaps — kein
      eigener OSM-Import nötig.
- [x] **R2 steht** — Eimer `knoellchenfrei-tiles` hinter
      `tiles.knoellchenfrei.de`, CORS auf die eigene Domain, Range-Requests
      durchgereicht. Nachgemessen mit gesetztem `Origin`: `206` auf den Kopf
      jeder der vier Dateien unter `aktuell/`. Der Bau läuft seit dem
      7. September wöchentlich als Workflow.
- [x] **Schneidet alle vier Städte, nicht nur Berlin** — die Rahmen kommen aus
      `core/city.ts`, nicht als zweite Zahlenreihe im Skript.

Warum das nicht warten durfte: Die Kacheln kamen von `tile.openstreetmap.org`.
Deren Nutzungsrichtlinie deckt ausgelieferte Anwendungen nicht ab, und die
IP-Adressen aller Nutzer gingen an einen Dritten, über den die
Datenschutzerklärung Auskunft geben muss. **Seit dem 7. September ist das
erledigt**; die Rasterkacheln sind nur noch der Rückfall für Bauten ohne
`VITE_TILES_URL` — lokal und in der Testsuite. Der letzte fremde Abruf sind
die Schriften von `protomaps.github.io`. Details in
[hosting.md](hosting.md#4-eigene-kartenkacheln).

## 5. Weitere Städte — vier laufen — **ich**

Analyse der Datenlage in [staedte.md](staedte.md), Recherche zu sechzehn
weiteren Städten in
[staedte-recherche-2026-09.md](staedte-recherche-2026-09.md). Hamburg ist seit
dem 6. September angeschlossen, Frankfurt am Main und München seit dem 7. —
**vier** Städte, umschaltbar in den Einstellungen. Damit sind alle Städte
angeschlossen, für die die Recherche einen tragfähigen Datensatz belegt hat.

> **Köln und Karlsruhe sind seit dem 8. September vorbereitet, aber nicht
> eingetragen** — Zweig `staedte/koeln-karlsruhe-vorbereitet`. Zwei Agenten
> haben je eine Stadt gegen die echten Dienste vermessen, Parser samt Tests
> geschrieben (82 bzw. 69) und die Datenbauten laufen lassen. Keiner hat
> `core/city.ts`, `core/index.ts` oder `ingest/src/sources.ts` angefasst; genau
> diese drei Dateien wären das Anschalten, und sie sind abzusprechen. Die
> fertigen Schnipsel stehen in [staedte-koeln.md](staedte-koeln.md),
> [staedte-karlsruhe.md](staedte-karlsruhe.md) und
> [staedte-duesseldorf.md](staedte-duesseldorf.md) — die Berichte liegen hier,
> der Code auf jenem Zweig.
>
> **Düsseldorf kam am 8. September dazu**, auf denselben Zweig und nach
> derselben Regel. Zwei Dinge daraus sind auch ohne Düsseldorf wertvoll:
>
> - **§ 2 Feiertagsgesetz NW ist im Wortlaut belegt.** Nicht über die
>   JavaScript-Seite, sondern über `recht.nrw.de/robots.txt` → Sitemap-Index →
>   statisches HTML unter `/lrgv/gesetz/…`. Elf Feiertage, Fronleichnam und
>   Allerheiligen landesweit, **keine** gemeindeweise Regelung wie in Bayern.
>   `NW: { fixed: ['11-01'], fromEaster: [60] }` ist damit belegt — und Kölns
>   offener Punkt erledigt. Der Weg über die Sitemap ist der, den Frankfurts
>   Stadtteile schon einmal gezeigt haben: über den Katalog, nicht über die
>   Adresszeile.
> - **Die Recherche vom 7. September beschreibt für Düsseldorf einen anderen
>   Bestand als den, der da ist** — neun Punkte einzeln aufgezählt. Es gibt
>   zwei WFS mit zusammen 20 Ebenen und 732 Parkscheinautomaten *mit Tarif*;
>   die statische Datei aus dem Portal ist materiell überholt, 18 von 44
>   Gebieten haben inzwischen andere Zeiten. Wer aus ihr baut, sagt in fünf
>   Innenstadtgebieten „ab 20 Uhr frei", wo bis 22 Uhr kassiert wird. Der
>   Abschnitt in [staedte-recherche-2026-09.md](staedte-recherche-2026-09.md)
>   trägt jetzt eine Warnung.
>
>   Der Tarif wird trotzdem **nicht ausgeliefert**: Die Automatenebene steht in
>   keinem Katalog und hat kein Lizenzfeld. Eine E-Mail an
>   `opendata@duesseldorf.de`, und es ist eine Zeile.
>
> Warum ein eigener Zweig und nicht der Arbeitszweig: Ohne die drei Einträge
> ist der Baum nicht neutral, sondern rot — `pnpm -r typecheck` meldet 22
> `has no exported member`, weil die Datenbauten Namen importieren, die `core`
> noch nicht ausführt. Ein dauerhaft roter Typecheck macht das nächste echte
> Problem unsichtbar.
>
> Je eine Entscheidung steht aus:
>
> - **Köln** — die Gebühr wird bewusst *nicht* gelesen. Die Datei nennt
>   4,00 € Tagesticket, die Stadt am selben Tag 5,00 €; ein Widerspruch
>   zwischen zwei Aussagen derselben Behörde. `Fee.unknown` plus Quellhinweis
>   statt einer Zahl, die falsch ist. ~~Dazu `NW` im Feiertagskalender, dessen
>   Beleg noch fehlt.~~ **Der Beleg ist da** — siehe Düsseldorf unten; damit
>   bleibt für Köln nur noch die Gebührenfrage.
> - **Karlsruhe** — blockierend: Die „Zonen" sind keine Gebiete, sondern die
>   Stellplatzreihen selbst, Median 128 m², 4,8 m breit. `zoneAt` fragt strikt
>   Punkt-in-Polygon; eine Ortung ist auf 10–20 m genau und trifft das nie.
>   Entweder ein gemessener Nächste-Zone-Rückfall in `zones.ts` — das ändert
>   `core` — oder eine Gebietsebene von der Stadt.

- [x] **Stadt als Konfiguration statt als Konstante.** `core/city.ts` trägt
      Mittelpunkt, Zoom, Meldegrenze, Sitzungsgrenze, Bundesland und
      Quellenangabe; `ingest/sources` ist nach Stadt gegliedert; Browser,
      Worker und Telegram-Bot lesen dieselben Grenzen. Berlin stand dafür an
      **sechs** Stellen als Zahlenpaar im Code — die Doku hatte drei behauptet.
      Ein unbekannter Stadtschlüssel wirft, statt auf Berlin zurückzufallen.
- [x] **Feiertagskalender je Bundesland.** `holidaysFor(land, jahr)`; belegt
      sind BE (8. März), HH (Reformationstag) und HE (Fronleichnam). Ein Land
      ohne Tabelle wirft. Die dreizehn übrigen fehlen bewusst — sie gehören nur
      mit Beleg hinein.
- [x] **Landesbezogene *bewegliche* Feiertage.** Fronleichnam ist beweglich
      (Ostersonntag + 60) **und** nicht bundesweit; die alte Tabelle konnte nur
      das eine oder das andere. `REGIONAL` trägt seitdem je Land zwei Listen.
      Dieselbe Erweiterung brauchen Nordrhein-Westfalen und Bayern.
- [x] **Feiertage, die an der Stadt hängen statt am Land.** Mariä Himmelfahrt
      gilt nach Art. 1 Abs. 1 Nr. 2 BayFTG „in Gemeinden mit überwiegend
      katholischer Bevölkerung" — in 1.708 der 2.056 bayerischen Gemeinden,
      also in München und nicht in Nürnberg. `City.holidays` trägt das,
      `holidaysFor(land, jahr, extraFixed)` nimmt es entgegen,
      `ParkingZone.extraHolidays` reicht es durch. Für BE, HH und HE ändert
      sich nichts. Belegt über die Gemeindeabfrage des Bayerischen Landesamts
      für Statistik: München, Gemeindeschlüssel 09162000, **ja**. Dieselbe
      Form braucht Augsburg (Friedensfest am 8. August).
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
- [x] **Frankfurt am Main angeschlossen.** Abgerufen, geparst und ausgeliefert
      am 7. September 2026: 27 von 42 Bewohnerparkbereichen, 921
      Parkscheinautomaten als Sachdatenquelle, 458 Behindertenparkplätze als
      POI, 46 Stadtteile als Kartenkontext. Die eine Eigenheit, an der alles
      hängt: Tarif, Zeiten und Höchstparkdauer stehen am **Automaten**, nicht
      am Bereich — ein Polygon trägt nichts als eine Nummer. Einzelheiten mit
      Zahlen in [staedte.md](staedte.md#frankfurt-am-main-im-einzelnen).
- [x] **München angeschlossen.** Abgerufen, geparst und ausgeliefert am
      7. September 2026: alle 82 Parkraummanagementgebiete, 13.714
      Straßenseiten als Sachdatenquelle, 95.903 Stellplätze, 1.660 POI in allen
      vier Arten, die Umweltzone als 12 Flächen, 25 Stadtbezirke als
      Kartenkontext. Die Eigenheit, an der alles hängt: Die Regel ist ein
      **Satz**, kein Feld — 291 Schreibweisen mit zusammengesetzten Klauseln,
      und `core/muenchen.ts` ist deshalb eine kleine Grammatik. Einzelheiten
      mit Zahlen in [staedte.md](staedte.md#münchen-im-einzelnen).
- [x] **Standort-Vorschlag beim ersten Öffnen** — am 7. September gebaut, nach
      FreiFahrens Vorbild („Switch to {{city}}? Your location looks like you are
      in {{city}}."). Er entsteht **ohne zusätzliche Berechtigungsabfrage**,
      allein aus der Position, die `locate()` ohnehin liefert; die Entscheidung
      ist `suggestCity` in `core/city.ts` (zehn Tests), das Merken der Ablehnung
      steht in `apps/web/src/city-suggestion.ts`. Vorgeschlagen wird nur, wozu
      diese Auslieferung auch umschalten kann — im Artifact also nur
      Eingebettetes, sonst endete die Annahme in „Diese Fassung enthält
      muenchen nicht".

      Zwei Nebenbefunde, beide mitbehoben: Der Satz „hier ist Parken
      gebührenfrei" entfällt, sobald ein Vorschlag entsteht — über 82 Münchner
      Gebieten wäre er falsch und läge auch noch über dem Hinweis, der ihn
      erklärt. Und die Beispieldaten in `seed.ts` waren Berliner Koordinaten:
      In München lagen die sechs Meldungen und die acht Heatmap-Ecken 500 km
      neben der Karte, unsichtbar, während die Liste „am häufigsten
      kontrolliert" dreimal „Außerhalb der Zonen" nannte. Sie stehen jetzt als
      Abstand zu `CITY.center`.
- [ ] **44 Hamburger Flächen heißen `-`.** Die Quelle vergibt für sie keinen
      Zonennamen; von 145 Flächen tragen 44 diesen Schlüssel, und die
      Kartenfärbung ist deshalb seit dem 8. September nicht mehr daran
      gebunden (siehe `LoadedZone.id`). An drei Stellen wirkt er trotzdem noch:

      1. ~~**Die Oberfläche schreibt „Zone -"**~~ **Erledigt am 8. September.**
         Es waren neun Stellen in fünf Dateien; sie gehen jetzt alle über
         `src/zone-label.ts`. Eine Fläche ohne Nummer heisst „Bewirtschaftete
         Fläche", und der eine Satz, der sie mit „in" nennt, bekommt die
         Dativform — der erste Anlauf schrieb „gemerkt in eine Fläche ohne
         Nummer" und ist im eigenen Test aufgefallen.
      2. **Die Nutzungsstatistik zählt sie als *eine* Zone.** `zone.open` mit
         der Ausprägung `-` steht für 44 verschiedene Flächen quer durch die
         Stadt; die Zeile ist damit die häufigste und sagt am wenigsten.
      3. **Die Zonensuche** findet unter `-` genau die erste.

      Der saubere Weg ist ein stabiler Ersatzschlüssel im Datenbau — etwa aus
      Stadtteil und laufender Nummer. Er ändert die erzeugte Zonenliste und
      die bereits gezählten Ausprägungen, also nicht nebenbei.

- [ ] **`packages/ingest` hat keinen einzigen Test**, und darin stehen zwei
      Funktionen, die je einen Vorfall hinter sich haben:
      `assertSelfContained` (hat einmal eine schwarze Seite ausgeliefert, bevor
      es sie gab) und `safeJson` (verhindert, dass ein `</script>` aus den
      Behördendaten das umgebende Tag schliesst). Beide sind rein und in
      zwanzig Zeilen geprüft.

      Warum es in der Nacht zum 8. September **nicht** gemacht wurde: Das Modul
      liest beim Import Dateien aus `dist`, die beiden Funktionen sind nicht
      exportiert, und ein Test bräuchte erst eine Umbauung in eine eigene
      Datei plus eine `vitest.config.ts` für das Paket. Beides um kurz vor fünf
      an einem Build-Skript zu tun, das schon einmal eine kaputte Auslieferung
      erzeugt hat, wäre genau der Leichtsinn, gegen den diese Nacht sonst
      angeschrieben hat. Als eigener Schritt, mit wachem Kopf.

- [ ] **Drei Datenfelder sind noch ungetypt — und dafür braucht es deine
      Zustimmung.** `loadData` in `apps/web/src/data-source.ts` gab bis zum
      8. September fünfmal `any` zurück, gegen die eigene Regel und ohne
      Begründung. Zwei davon sind repariert (`meta` und `zones`, beides
      hauseigene Typen); `meta` war der wichtigere Fall, denn aus ihm liest die
      Fußzeile Felder beim Namen — `meta.zonen` statt `meta.zones` wäre durch
      die Prüfung gegangen und hätte `undefined` angezeigt.

      Für `poi`, `districts` und `umweltzone` ist der richtige Typ
      `GeoJSON.FeatureCollection` aus `@types/geojson` — genau der, den
      `map.addSource({ data })` erwartet. Das Paket liegt im Baum, aber nur
      **transitiv** über maplibre-gl, und pnpm löst es von hier aus nicht auf
      (`TS2307: Cannot find module 'geojson'`). Es als direkte
      Entwicklungsabhängigkeit einzutragen ist eine Änderung an den
      Abhängigkeiten und deshalb abzusprechen. Ein selbstgebauter Struktur-Typ
      wäre kein Ersatz: `addSource` nimmt ihn nicht an.

      Solange stehen an den zwei Stellen, die sie benutzen, benannte Casts
      statt `any` — das verschiebt die Behauptung an die Stelle, an der sie
      gemacht wird, statt sie im Typ zu verstecken.

- [ ] **Das Heatmap-Raster ist noch Berlin.** `core/heatmap.ts` rechnet das
      250-m-Raster mit `ORIGIN` 13,0/52,3 und `cos 52,52°` — beides fest
      verdrahtet. **Am 8. September nachgemessen statt geschätzt:** Die Zelle
      ist überall 250 m hoch und in Ost-West-Richtung Berlin 250,0 m,
      Hamburg 244,1 m (−2,4 %), Frankfurt 263,5 m (+5,4 %), München 274,2 m
      (+9,7 %). Für Köln wären es 258,9 m, für Karlsruhe 269,5 m.

      Funktional fällt das nicht auf: Die Heatmap beantwortet „wo wird
      *innerhalb dieser Stadt* häufiger kontrolliert", und dafür muss das
      Raster nur in sich gleichmäßig sein. Was nicht passieren darf, ist die
      250 als exakten Meterwert in der Oberfläche auszugeben — sie ist ein
      Rastermaß, keine Messung.

      Ein Wechsel des Rasters ändert die Zell-Schlüssel und damit **jede** in
      D1 gespeicherte Markierung. `marks` hält 28 Tage; ohne Migration
      zerreißt der Wechsel die vorhandene Karte still. Deshalb erst mit
      Migrationsplan, nicht nebenbei — die Zahlen oben stehen jetzt auch im
      Quelltext von `heatmap.ts`, damit die Entscheidung nicht noch einmal
      geschätzt wird.

- [ ] **Drei Rückfragen an München**, `gb1-23.mor@muenchen.de` (MOR-GB1).
      Keine davon ist aus dem Feed zu beantworten:
      1. **Was sind `Milbertshofen` (25 Abschnitte) und `Riesenfeld` (15)?**
         Beide stehen als `prm_name` an Straßenseiten, es gibt aber kein
         Polygon dazu. Vermutlich Gebiete in Vorbereitung; heute fallen die
         40 Abschnitte durch.
      2. **Gilt für `Bewohnerparken 9-23 Uhr` wirklich Montag bis Samstag?**
         Der Feed nennt bei dieser Schreibweise keine Wochentage. Die Annahme
         ist aus dem Feed selbst belegt (siehe staedte.md), aber sie bleibt
         eine Annahme — und sie betrifft 3.909 plus 1.968 Abschnitte.
      3. **Gibt es die Gebührenordnung als Datensatz?** Der Tarif steht heute
         nur in einem PDF; mit einem maschinenlesbaren Stand könnte die App
         statt „Tarif nicht angegeben" einen Betrag nennen.
- [ ] **Zwei Rückfragen an Frankfurt**, `SVA.GDI@stadt-frankfurt.de`
      (Straßenverkehrsamt). Beide sind aus dem Feed **nicht** zu beantworten,
      und beide ändern etwas an der Anzeige:
      1. **Was bedeutet `mitparkraumbewirtschaftung = null`** — „nein" oder
         „unbekannt"? Heute wird nach Daten ausgelassen (kein Automat im
         Polygon), weil das Flag nachweislich nicht „wird bewirtschaftet"
         heißt: 16 Bereiche ohne Flag enthalten zusammen 245 Automaten.
      2. **Gibt es eine Ebene, die die 113 Automaten ohne Bewohnerparkbereich
         einem bewirtschafteten Gebiet zuordnet?** Für sie gibt es heute kein
         Polygon, und die Zonenabfrage deckt sie nicht ab.
      Die Stadtteil-Frage aus der Recherche hat sich erledigt: Die Ebene liegt
      in `WFS_Stadtgebietsgliederung`, unter derselben Lizenz. Der Suchweg
      steht in [staedte.md](staedte.md#die-stadtteile-gesucht-und-gefunden).
- [ ] **Fünfte POI-Art für Parkscheinautomaten.** Das Schema kennt
      `charging`, `carsharing`, `park_and_ride` und `accessible`; für die 113
      Frankfurter Automaten ohne Bereich passt keine, und eine davon zu
      missbrauchen hieße, ein Symbol zu setzen, das etwas anderes behauptet.
      Eine fünfte Art wäre ein Umbau von Karte, Legende und Filtern — lohnt
      sich erst, wenn eine zweite Stadt sie auch braucht.
- [x] **Der Datenabzug deckt alle vier Städte ab** — am 7. September mit dem
      Beta-Riegel umgezogen. Er hing an `pages.yml`, holte nur Berlin und
      frischte damit ausgerechnet die Kopie auf, die niemand benutzte: GitHub
      Pages. Jetzt steht er in `deploy.yml`, läuft täglich um 04:17 UTC über
      Berlin, Hamburg, Frankfurt und München, und ein Dienst, der schweigt,
      hält den Deploy nicht auf — er steht in der Zusammenfassung des Laufs.
      Das war Audit-Punkt M-031.
- [x] **Skripte werden geprüft** — am 7. September, Audit-Punkte M-036, M-035
      und M-078. shellcheck läuft in der CI und ist bei null Hinweisen; die 15
      Befunde des ersten Laufs sind behoben, darunter 13-mal `A && B || C`.
      Dazu prüft `scripts/namen-pruefen.sh`, dass Worker-, Datenbank-, Pages-
      und Eimername in allen vier Dateien übereinstimmen und `parkingzone` nur
      noch als historische Adresse vorkommt. Und `app/scripts/fetch-parkzonen.sh`
      ist gelöscht: ein zweiter, undokumentierter Abrufweg neben `fetch.ts`,
      der nur Berlins Zonen holte. ESLint und Prettier bewusst nicht — die
      Begründung steht in [entscheidungen.md](entscheidungen.md).

- [x] **Lizenzen aufgeräumt** — am 7. September, Audit-Punkte M-021, M-023,
      M-058 und M-016. `LICENSE` ist wieder reines MIT (der deutsche
      Datenanhang liess GitHub `NOASSERTION` melden), die Datenlizenzen aller
      vier Städte stehen in [NOTICE](../NOTICE), die Lizenztexte der
      Abhängigkeiten in `THIRD-PARTY-NOTICES.md` — erzeugt, nicht geschrieben
      (`pnpm --filter @knoellchenfrei/ingest build-notices`), und als
      `third-party-notices.txt` mit ausgeliefert, weil BSD genau das verlangt.
      Alle fünf `package.json` tragen jetzt `"license": "MIT"`. Und die
      Oberfläche nennt bei den drei Namensnennungs-Städten den **Datensatz**
      und sagt, dass die Daten **verändert** sind — beides verlangt § 2 der
      Datenlizenz Deutschland, beides fehlte.

- [x] **Sicherung, Wiederanlauf und Notfallplan** — am 7. September gebaut,
      Audit-Punkte M-008, M-009 und M-010. `scripts/sichern.sh` zieht die
      D1-Datenbank ab und verschlüsselt sie lokal;
      `./scripts/einrichten.sh --neuaufbau cloudflare` legt KV und D1 nach
      einem Kontoverlust neu an, statt eingetragene Kennungen für vorhandene
      Ressourcen zu halten; [notfall.md](notfall.md) sagt, was läuft, was bei
      Verlust weg ist (`feedback` und `marks` — beides nicht ersetzbar) und in
      welcher Reihenfolge es zurückkommt.
- [x] **Der Betreiber-Token darf lesen** — am 7. September erweitert um
      `User → Memberships → Read`, `D1` und `Workers KV Storage`. Damit
      beantwortet `./scripts/einrichten.sh --pruefen cloudflare` die Frage, mit
      der ein Ernstfall anfängt: *„KV und D1 stehen in wrangler.toml — und
      dieses Konto kennt beide."* Vorher stand dort „war nicht zu prüfen".
      Die R2-CORS-Regel ohne `localhost` ist damit auch angewendet (M-050).

- [x] **Einmal wirklich zurückgespielt** — am 7. September, und der Weg trägt.
      `sichern.sh` erzeugt den Abzug (4 KB), eine Wegwerf-Datenbank
      `knoellchenfrei-probe` nimmt ihn auf, und die Zeilen stimmen danach
      **exakt** überein: 21 `visits`, 1 `feedback`, 0 `marks`, 0 `sightings`,
      0 `votes`, 1 Migration. Die Wegwerf-Datenbank ist wieder weg.

      Die eine Frage, die vorher offen war: Was macht
      `d1 migrations apply` gegen eine zurückgespielte Datenbank? Antwort
      gemessen: **„No migrations to apply"** — die mitgesicherte
      `d1_migrations` verhindert einen zweiten Lauf. Die Reihenfolge in
      `notfall.md` stimmt also.

      Der Schlüssel liegt jetzt unter `~/.knoellchenfrei-sicherung-schluessel`.
      **Er gehört in den Passwortmanager** — ohne Kopie dort verliert man mit
      dem Rechner Schlüssel und Sicherung im selben Moment, und die Sicherung
      ist dann Rauschen.

- [x] **Nutzungsstatistik gebaut** — 7. September, in drei Teilen: Katalog und
      Endpunkt, Client mit Ausschalter, Auswertung und Seite. Der Plan lief
      zweimal über einen zweiten Kopf, und die Prüfung hat drei echte Fehler
      gefunden, bevor sie gebaut wurden.

      | Teil | Wo |
      | --- | --- |
      | Katalog, Auflösungsregel, Prüfung | `core/events.ts`, `core/zone-keys.generated.ts` |
      | Zählwerk und Tagesbudget | `migrations/0002_events.sql` |
      | Endpunkt, Rollup, Auswertung | `apps/api/src/worker.ts` |
      | Client, Puffer, Widerspruch | `apps/web/src/track.ts` |
      | Seite | `apps/web/statistik/` |

      **Die Gegenprobe steht** — sie ist die einzige Zahl auf der Seite, die
      etwas über die Seite selbst sagt: `app.open` muss mindestens so groß sein
      wie die Zahl der Besuchszeilen, denn jedes Gerät, das eine anlegt, hat
      die App geöffnet. Bleiben Bündel liegen, sinken sonst einfach alle
      Zahlen, und das sieht aus wie weniger Nutzung. Sie reicht **zwei Tage**
      weit: `visits` wird nach zwei Tagen gelöscht, `events` nach 90 — ein
      Vergleich über 28 Tage verglich eine volle Zahl mit einer leeren.

      Die zweite geplante Gegenprobe entfällt: Sie sollte Meldungen aus `marks`
      gegen `sighting.report` halten, und dieses Ereignis gibt es bewusst
      nicht — es stünde schon in `marks`.

      **Offen bleibt `@cloudflare/vitest-pool-workers`** für den Endpunkt: Der
      `node:sqlite`-Test deckt das SQL ab, nicht die Bindings.

- [ ] **`D1:Edit` für den Deploy-Token.** Seit dem 7. September wendet der
      Deploy die D1-Migrationen an, bevor er den Worker ausrollt — vorher
      wurde eine neue Migration im Repository **nie** angewendet, und der
      Worker traf auf eine Tabelle, die es nicht gab. Das fällt erst zur
      Laufzeit auf, im Log, bei der ersten Anfrage.

      Der Deploy-Token kann absichtlich nur *Workers Scripts* und *Cloudflare
      Pages*. Der Schritt läuft deshalb mit `continue-on-error` und setzt einen
      gelben Haken mit dem Befehl darunter, statt still zu überspringen — aber
      solange das Recht fehlt, bleibt das Schema stehen.

      Zwei Wege: *D1:Edit* zum vorhandenen `CLOUDFLARE_API_TOKEN` dazugeben
      (ein Recht mehr an einem Token, der bei jedem Push läuft), oder von Hand
      einspielen:

      ```bash
      cd app/apps/api && pnpm --filter @knoellchenfrei/api exec wrangler d1 migrations apply knoellchenfrei --remote
      ```

      **Bis das passiert ist, zählt die Nutzungsstatistik nichts** — die
      Tabellen aus `0002_events.sql` gibt es in der Produktivdatenbank noch
      nicht.

- [ ] **Ein eigener R2-Token für den Kachel-Workflow** —
      `CLOUDFLARE_R2_TOKEN` als Repository-Secret, mit **einem** Recht:
      *Workers R2 Storage: Edit*. Ohne ihn bricht der Workflow in der ersten
      Zeile ab und sagt das auch.

      Warum nicht der vorhandene `CLOUDFLARE_API_TOKEN`: Der rollt aus und
      kann absichtlich nur *Workers Scripts* und *Cloudflare Pages*. Ihm R2
      dazuzugeben hiesse, den Token zu verbreitern, der bei jedem Push läuft
      — für einen Workflow, der einmal die Woche läuft.

- [x] **Der Worker hat jetzt Tests** — 15 Stück, am 7. September,
      `apps/api/test/worker.test.ts`. Vorher: keinen einzigen, während
      `packages/core` bei 99,9 % Zeilenabdeckung steht.

      Geprüft wird der Weg, den eine Anfrage nimmt, **bevor** sie die Datenbank
      erreicht: `/health`, die CORS-Kopfzeilen samt Vorabruf, die Schreibsperre
      ohne `CLIENT_SALT`, die Pflicht zu `application/json`, die Abweisung
      fremder Herkünfte, der Telegram-Webhook ohne und mit falschem Geheimnis.
      Vier der Audit-Befunde lagen genau auf dieser Ebene — M-014, M-016,
      M-046, M-097.

      **Was fehlt und warum es eine eigene Runde ist:** alles, was echtes SQL
      braucht — Rate-Limits, Doppelmeldungen, die Selbstbestätigung. Dafür
      wäre `@cloudflare/vitest-pool-workers` mit einer D1 in Miniflare nötig,
      samt eingespielten Migrationen. Die Attrappe hier schreibt Anweisungen
      mit, statt sie auszuführen; sie kann nicht beantworten, ob eine Abfrage
      das Richtige zurückgibt.

      Nebenbei festgehalten, was beim Schreiben auffiel: `/health` prüft die
      Methode nicht und antwortet auf `DELETE` mit 200. Folgenlos — die
      Schreibsperre hängt an POST —, aber jetzt steht es als Entscheidung da
      und nicht als Versehen.

- [x] **`/visits` ist gedeckelt** — am 7. September, höchstens 20.000 neue
      Zeilen am Tag (Audit-Punkt M-016).

      Die Kennung kommt vom Aufrufer, und `<heute>-<beliebig>` erfüllt das
      Muster beliebig oft: Wer wollte, legte in einer Schleife Millionen Zeilen
      an, trieb die Zahlen hoch und verbrannte das Schreibbudget.
      `rejectsCrossSite` half dagegen nicht — es prüft eine Herkunft, und wer
      keinen Browser benutzt, schickt gar keine.

      Die Grenze steht **im `INSERT` selbst**, nicht als Abfrage davor:
      Zwischen Zählen und Schreiben läge sonst ein Fenster, in dem zwanzig
      gleichzeitige Anfragen alle „noch Platz" lesen.

      Ein Fallstrick dabei, gegen SQLite nachgemessen statt überlegt: Die erste
      Fassung hielt mit der Grenze auch das **Auffrischen** vorhandener Zeilen
      an — die Anzeige „gerade online" wäre an einem vollen Tag von selbst auf
      null gelaufen, während die Leute zusahen. Das `EXISTS` davor ist der
      Unterschied.

      Was das **nicht** löst: Wer die Grenze ausschöpft, sorgt dafür, dass
      echte Besucher an dem Tag nicht mehr gezählt werden. Bewusster Tausch —
      eine falsche Zahl ist ärgerlich, ein volles Schreibbudget legt die
      Meldungen mit lahm. Sichtbar wird es daran, dass die Tageszahl exakt auf
      der Grenze steht.

## 6. Telegram — **du** (Token), dann **ich**

> **Dieser Abschnitt war zwischenzeitlich zerrissen.** Am 7. September haben
> Commit `2212bfc` — einer über Worker-Tests, der mit Telegram nichts zu tun
> hatte — die Überschrift und die ersten beiden Punkte entfernt; der Rest blieb
> kopflos am Ende von Abschnitt 5 hängen. Ursache war dieselbe wie bei den drei
> anderen Abschnitten, die schon einmal zurückgeholt werden mussten: ein
> zeilenbasiertes Ersetzen ohne Blockgrenze.
>
> **Und die Reparatur war beim ersten Anlauf zu grob.** Am 8. September habe
> ich aus der fehlenden Überschrift auf einen fehlenden Abschnitt geschlossen
> und den ganzen aus `362e8c8` wieder eingesetzt — damit stand die Hälfte
> zweimal da, bis es beim Auflisten der offenen Punkte auffiel. Der kopflose
> Rest ist jetzt entfernt. Die Lehre steht in
> `docs/nachtplan-2026-09-08.md`: Ein fehlender Anker heisst nicht, dass alles
> dahinter fehlt — nachzählen, was wirklich weg ist.

Zweistufig, weil Stufe 2 ohne Stufe 1 nichts hat, wohin sie schreiben könnte:

- [x] **Stufe 1: Bot, den man anschreibt — gebaut.** Route `/telegram` am
      bestehenden Worker, kein zweiter Dienst. Ein gesendeter Standort wird über
      denselben Pfad eingetragen wie eine Meldung aus der App; `/hilfe`
      erklärt es; alles andere bekommt eine höfliche Absage. Die
      Telegram-Nutzerkennung wird gehasht wie eine IP-Adresse und nur für die
      Meldegrenze benutzt, die Chat-Kennung gar nicht gespeichert.
      21 Unit-Tests auf dem Parser, weil dort fremder Text ankommt.
- [~] **Namen belegen — vier Stück, bevor sie weg sind.** Eine Gruppe ist am
      6. September angelegt; welche der vier Namen damit belegt sind, kann ich
      nicht nachsehen — Telegram ist von hier aus nicht erreichbar, und ich
      trage nur ein, was ich geprüft habe. Offen bleiben nach meinem Stand:
      `@knoellchenfrei` (Dach), `@knoellchenfrei_B`, `@knoellchenfrei_HH`,
      `@knoellchen_bot`. Am 6. September 2026 waren alle vier frei.
      *(Der Bot heißt tatsächlich `@knoellchen_bot` — nachgemessen per
      `getMe` beim Einrichten; die Doku hatte fünfmal `@knoellchenfrei_bot`
      gesagt, ohne dass es jemand geprüft hätte.)*
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

- [x] **`knoellchenfrei.de` liegt auf der App** — am 7. September erledigt,
      Audit-Punkt M-038. Es war nie ein Fehler im Skript: Der Schritt hat
      schlicht nie stattgefunden. Die Zone enthielt genau einen Eintrag
      (`tiles.`), Apex und `www` fehlten, und die Custom Domains waren am
      Pages-Projekt nicht eingetragen. Beides steht jetzt:

      | Typ | Name | Ziel | Proxy |
      | --- | --- | --- | --- |
      | CNAME | `knoellchenfrei.de` | `knoellchenfrei.pages.dev` | an |
      | CNAME | `www.knoellchenfrei.de` | `knoellchenfrei.pages.dev` | an |

      Nachgemessen an der ausgelieferten Adresse: `knoellchenfrei.de` und
      `www.` antworten mit `401`, das richtige Passwort mit `303` und danach
      `200`; die vier Weiterleitungsdomains zeigen hierher
      (`knoellchenfrei.org` → `301`).

      **Zwei Schlüssel, und sie sind leicht zu verwechseln.** In der Umgebung
      stand `CLOUDFLARE_API_TOKEN` mit dem Präfix `cfat_` — das ist das
      OAuth-Token aus `wrangler login`, kein API-Token: `/user/tokens/verify`
      antwortet darauf `Invalid API Token`, während Zonen- und Pages-Abrufe
      funktionieren. Sein Geltungsbereich kennt kein DNS, und keine
      Rechteänderung im Dashboard ändert daran etwas. Der API-Token liegt in
      `~/.knoellchenfrei-cf-token` (Präfix `cfut_`) — den nimmt auch
      `scripts/einrichten.sh` über `CF_TOKEN_DATEI`. Wer DNS über die API
      anfassen will, braucht diesen, nicht jenen.

      Was danach noch dauert, ohne dass etwas kaputt ist: Der lokale Resolver
      hält das alte `NXDOMAIN` eine Weile fest — `dig @1.1.1.1` und der Browser
      sehen die Adresse längst, `curl` meldet noch `Could not resolve host`.

- [x] **Bild der Organisation hochgeladen** — nachgeprüft am 6. September:
      `avatars.githubusercontent.com/u/325612516` liefert das blaue P,
      460 × 460, also unser `docs/brand/org-avatar-512.png` und kein
      Platzhalter-Muster.
- [x] **Vorschaubild des Repositories gesetzt.** Nachgeprüft am `og:image`
      der Repository-Seite: Es zeigt auf
      `repository-images.githubusercontent.com/…` — das ist die hochgeladene
      Datei. Ein automatisch erzeugtes Bild käme von
      `opengraph.githubassets.com`.
- [x] **Beschreibung und Topics gesetzt.** Alle **zwölf** Topics aus
      [marke.md](marke.md#3-repository-beschreiben) stehen, keins fehlt.
- [x] **Profilseite der Organisation steht.** Das Repository
      `knoellchenfrei/.github` ist angelegt und — nachgeprüft — **öffentlich**;
      `github.com/knoellchenfrei` zeigt den Text aus
      [org-profil.md](org-profil.md). Das ist die eigentliche Bedingung: Aus
      einem *privaten* `.github` rendert GitHub keine Profilseite, und man
      sieht dem Repository nicht an, dass es nichts tut.
> **Bewusst nicht:** Sponsor-Knopf (dahinter steht kein Konto), private E-Mail
> im Profil (kommt dort nicht wieder weg), Discussions (ein leeres Forum wirkt
> verlassener als keins). Das ist eine Entscheidung und keine Aufgabe — sie
> stand nur als offener Punkt in der Liste und sah dadurch aus wie einer.
- [x] **Dependabot-Warnungen und Sicherheitsupdates sind an** — am
      7. September eingeschaltet und nachgemessen
      (`/vulnerability-alerts` → `204`). Mit dabei, weil sie am selben
      Schalterbrett liegen und für öffentliche Repositories nichts kosten:
      **Secret Scanning** und **Push Protection**. `einrichten.sh` prüft alle
      drei jetzt selbst, statt sie zu glauben.
- [x] **GitHub Pages ist aus** — am 7. September nachgemessen: `/repos/…/pages`
      antwortet `404`, es gibt keine Seite mehr. Musste weg, weil sich dort
      kein Riegel davorsetzen lässt; der Beta-Zugang läuft über eine
      Pages-**Funktion**, und die gibt es bei GitHub Pages nicht.
## 8. Der Worker kennt zwei Städte — erledigt am 6. September 2026

Beim Durchsehen von [hosting.md](hosting.md) aufgefallen, und es wäre erst
aufgefallen, wenn der Worker scharf geht: Die App schaltet seit dem
6. September zwischen Berlin und Hamburg um, der Worker nicht. `Env.CITY`
wählte **eine** Stadt (ohne Wert: Berlin), `withinCity` wies alles andere ab,
`schema.sql` hatte keine Stadtspalte. Eine Hamburger Meldung bekam
**`422 position outside Berlin`** — in der App sähe das aus, als sei das
Melden kaputt.

**Geworden ist es eine Spalte `city`, keine Datenbank je Stadt.** FreiFahren
fährt je Stadt eine eigene D1 *und* einen eigenen Worker; für zwei Städte auf
dem Free Tier ist das n-mal Betrieb ohne Gegenwert.

- [x] **Stadt aus der Position, nicht aus der Konfiguration.** Neu in
      `core/city.ts`: `cityAt(lon, lat)` gibt die erste Stadt zurück, deren
      `reportBounds` den Punkt enthält — und `undefined`, wenn keine passt.
      Kein Rückfall auf Berlin. Elf neue Unit-Tests, darunter ein Punkt
      zwischen beiden Städten, je einer knapp innerhalb und außerhalb, und
      einer, der festhält, dass sich keine zwei Boxen überlappen (sonst wäre
      „die erste passende Stadt" eine Auslosung).
- [x] **Schreiben:** `createSighting` und der Telegram-Pfad leiten die Stadt
      aus der Position ab und schreiben sie in `sightings` **und** `marks`.
      Passt keine, ist die Antwort `422 position outside Berlin, Hamburg` —
      die Meldung nennt alle bekannten Städte statt einer.
- [x] **Lesen:** `GET /sightings` und `GET /marks` nehmen `?city=<schlüssel>`.
      Fehlender Parameter → Berlin (der einzige erlaubte Rückfall);
      unbekannter Schlüssel → `400` mit den bekannten Schlüsseln im Text.
- [x] **Telegram:** `parseTelegramUpdate` bekommt jetzt *alle* Städte statt
      einer und trägt die gefundene im `report`-Intent. Ein Standort außerhalb
      aller Städte wird abgelehnt und nennt beide.
- [x] **`CITY` ist weg** — aus `Env` und aus dem Code. Der Worker ist nicht
      mehr auf eine Stadt konfigurierbar. (In `wrangler.toml` stand es nie.)
- [x] **`visits` bleibt ohne Stadt** — begründet, nicht vergessen: Ein Ping
      trägt keine Position, die Stadt wäre vom Client behauptet statt
      abgeleitet, und die Zahl beantwortet „wie viele benutzen
      knoellchenfrei gerade", nicht „wie viele in Berlin". Die Begründung
      steht bei `recordVisit` in `worker.ts` und in `schema.sql`.

Was noch offen ist:

- [x] **Migration auf der bestehenden D1 eingespielt** — am 6. September,
      19:28 Uhr, mit 4 geschriebenen Zeilen. Seitdem laufen Migrationen über
      `wrangler d1 migrations apply knoellchenfrei --remote` (führt die
      Tabelle `d1_migrations` mit, überspringt Eingespieltes); das
      Einrichtungsskript ruft das auf. Die frühere Datei `001-stadt.sql` und
      der Weg über `d1 execute` existieren nicht mehr — siehe
      [CLAUDE.md](../CLAUDE.md), Regel zu D1-Migrationen.
- [x] **Die Web-App schickt `?city=` mit** — beide Aufrufe in
      `apps/web/src/sighting-backend.ts`, seit dem 6. September abends, mit
      grünem E2E-Lauf.

## 9. Kleinkram — **ich**

- [x] **Bilder neu aufgenommen** — am 7. September, mit Hintergrundkarte
      (Audit-Punkt M-076). Vorher zeigten `public/screenshots/` und
      `docs/images/` eine Karte ohne alles: erst, weil der Egress-Proxy
      `tile.openstreetmap.org` sperrte, danach, weil der MapLibre-Worker fehlte
      und auch die Zonen nicht gezeichnet wurden.

      Ein Handgriff, der beim nächsten Mal Zeit spart: **Mit
      `VITE_TILES_URL=https://tiles.knoellchenfrei.de/…` bauen bringt nichts.**
      Die R2-CORS-Regel lässt nur `https://knoellchenfrei.de` zu, und die
      Aufnahme läuft gegen `127.0.0.1` — die Kachelanfragen scheitern, und das
      Bild sieht aus wie eine leere Karte mit Zonen darauf. Richtig ist, das
      Archiv einmal herunterzuladen und lokal auszuliefern:

      ```bash
      curl -o /tmp/berlin.pmtiles https://tiles.knoellchenfrei.de/v<datum>/berlin.pmtiles
      # kleiner Server mit Range-Unterstützung und Access-Control-Allow-Origin: *
      VITE_TILES_URL=http://127.0.0.1:4190/ pnpm --filter @knoellchenfrei/web build
      cd apps/web && node scripts/make-screenshots.mjs && node scripts/make-docs-images.mjs
      ```

      Die CORS-Regel selbst bleibt eng — sie für die Bilder aufzumachen wäre
      der falsche Weg herum.
- [x] **Sprachkonsistenz, M-063 bis M-067** — am 7. September. Der eigentliche
      Befund war nicht „gemischt", sondern **„ohne erkennbare Regel"**: Es gab
      keine, an der sich ein Beitrag hätte ausrichten können.

      Die Regel steht jetzt in `CONTRIBUTING.md` und trennt nicht
      deutsch/englisch, sondern **Prosa/Bezeichner**: Prosa bekommt echte
      Umlaute, Bezeichner, Dateinamen, Schlüssel und Commit-Betreffs bleiben
      ASCII. Deshalb heißt der Stadtschlüssel weiter `muenchen` und der
      Schalter `--pruefen`.

      | Befund | Erledigt durch |
      | --- | --- |
      | M-063 Umlaute gemischt | 355 Stellen in 43 Dateien vereinheitlicht; `scripts/sprache-pruefen.sh` hält den Stand und läuft in der CI |
      | M-064 Testtitel gemischt | 268 Titel übersetzt, alle 24 Testdateien jetzt durchgehend deutsch; `describe`-Gruppen, die eine Funktion benennen, tragen weiter ihren Namen |
      | M-065 Bezeichner gemischt | Regel geschrieben; drei, die den Umlaut-Lauf mitgenommen hatte, zurück auf ASCII und dabei eindeutiger benannt (`auswahl`, `juengste_sicherung`, `zurueckspielen`) |
      | M-066 Dateinamen zweisprachig | Bewusst **nicht** umbenannt: Jeder Verweis müsste mit, jeder gesetzte Link bräche, und der Gegenwert wäre Ästhetik. Neue Dateien bekommen deutsche Namen in ASCII — steht in `CONTRIBUTING.md` |
      | M-067 Commit-Nachrichten | Regel geschrieben; die Ausnahmen (Dependabot, `git merge`) bleiben, weil sie von Werkzeugen kommen |

      Zwei Dinge, die der Lauf selbst gefunden hat und die zeigen, warum das
      nicht rein mechanisch geht: `taeglich` und `ueberwachung` sind
      **Feed-Werte** aus München und Frankfurt — ersetzt hätten sie zwei Parser
      stillschweigend gebrochen. Und die Prüfung schlug beim ersten Lauf auf
      `CONTRIBUTING.md` an, also auf die Regel, die sie durchsetzt; was in
      Grave-Akzenten steht, ist seitdem ein Zitat und kein Befund.

- [ ] **Meldestadt statt Zonenstadt: Städte vom Feed entkoppeln.** Richtung
      vom 7. September, ausführlich in
      [staedte.md](staedte.md#zwei-stufen-meldestadt-und-zonenstadt) — hier nur
      der Zeiger, damit es nicht zweimal steht.

      Kurz: Wo bewirtschaftet wird, sollen Leute melden können, auch ohne
      Zonen, Tarife und Automaten. Stufe 1 braucht nur Name, Kfz-Kürzel,
      Bundesland und eine Grenze; Stufe 2 ist das Heutige. Möglich ist das,
      weil der Worker die Stadt ohnehin aus der Position ableitet (`cityAt`)
      und die Oberfläche mit `absent` in `meta.json` schon ausblenden kann, was
      eine Stadt nicht hat.

      **Nicht anfangen, bevor zwei Fragen beantwortet sind**, denn beide
      bestimmen die Form des Codes: woher die Grenzen kommen (vierhundert
      Rahmen pflegt niemand von Hand — das muss erzeugt werden) und wie die
      Meldegrenze aussieht (`cityAt` nimmt die *erste passende* Stadt, und ein
      Test hält heute fest, dass sich die vier Rahmen nicht überlappen; bei
      vielen Städten überlappen Rechtecke zwangsläufig, es bräuchte Polygone).

- [ ] **Rückmeldungen von der Webseite in den Admin-Kanal des Telegram-Bots.**
      Wunsch des Betreibers vom 7. September. Heute landet Freitext aus dem
      Formular in `feedback` in D1 — und **bleibt dort**: Es gibt absichtlich
      keinen Lesepfad über die API, der einzige Weg an eine Rückmeldung ist
      `./scripts/sichern.sh`. Das ist unbequem genug, dass es niemand tut, und
      damit ist eine Rückmeldung praktisch verloren.

      Der Weg ist kurz: `createFeedback` in `worker.ts` hat den Text schon
      durch `tidyFeedback` geschickt und schreibt ihn nach D1; danach ein
      `sendMessage` an den Admin-Chat. Vier Dinge, die dabei nicht
      untergehen dürfen:

      1. **Der Bot heißt `@knoellchen_bot`**, nicht `@knoellchenfrei_bot`.
         `getMe` hat das beim Einrichten am 6. September gezeigt; der zweite
         Name war ein Wunsch, kein Befund (Audit-Punkt M-011). Beim Anlegen
         des Kanals also den echten nehmen.
      2. **Die Chat-Kennung ist ein Secret, keine Variable im Repository.**
         `wrangler secret put TELEGRAM_ADMIN_CHAT`. Steht sie im Klartext,
         kann jeder, der den Bot kennt, hineinschreiben.
      3. **Das Senden darf die Antwort nicht aufhalten und nicht kippen.**
         Telegram ist von außen; ein Timeout dort darf nicht dazu führen, dass
         die Nutzerin „hat nicht geklappt" liest, obwohl der Eintrag in der
         Datenbank steht. Also nach dem `INSERT`, mit `ctx.waitUntil`, und ein
         Fehler geht ins Log statt in die Antwort.
      4. **Die Datenschutzerklärung muss mit.** `docs/datenschutz.md` sagt
         heute, Freitext liege ausschließlich in der Datenbank und werde nur
         vom Betreiber gelesen. Geht er zusätzlich an Telegram, ist Telegram
         ein weiterer Empfänger und gehört in die Tabelle unter „Empfänger und
         Auftragsverarbeiter" — mit dem Hinweis, dass die Verarbeitung dort
         außerhalb des Einflusses dieses Projekts liegt. Was **nicht**
         mitgehen darf, ist der Client-Hash: Er ist ein Pseudonym und hat in
         einem Chat nichts zu suchen.

      Offene Entscheidung: ob der Kanal auch die **Sichtungen** bekommt. Dafür
      spräche, dass man den Betrieb dann in einem Fenster sieht; dagegen, dass
      sechs Meldungen pro Stunde einen Kanal unlesbar machen, in dem sonst
      Wochen nichts steht.

- [~] **421 Abschnitte kosten Geld und liegen in keiner Zone — die App nennt
      sie gebührenfrei.** Am 7. September beim Nachgehen der „Löcher" in der
      Zonenkarte gemessen; der Befund ist grösser als die Frage, die dazu
      geführt hat.

      Die Zonenpolygone (`parkraumbewirtschaftung:parkzonen`, 103 Stück) und
      die Strassenabschnitte (`parkplaetze:parkplaetze`, 45.917) sind zwei
      Ebenen desselben Anbieters, und sie widersprechen sich:

      | Gemessen | |
      | --- | --- |
      | Abschnitte mit `parkgebuehr` oder `bewirtschaftungszeit`, aber in **keinem** Zonenpolygon | **421** |
      | Stellplätze darauf | **2.363** |
      | Davon tragen zugleich `zone = "nicht bewirtschaftet"` | 354 |
      | Schwerpunkte | Reinickendorf 138, Steglitz-Zehlendorf 106, Tempelhof-Schöneberg 83, Mitte 52 |

      Beispiele zum Antippen: Provinzstrasse und Ritterlandweg (Reinickendorf,
      44 + 32 Abschnitte), Gritznerstrasse und Filandastrasse (Steglitz),
      Friedrich-Wilhelm-Platz (`13.32905,52.47190`, 2,00 Euro,
      Mo-Fr 9-20 / Sa 9-18), Hohenstaufenstrasse (`13.34782,52.49442`,
      **3,00 Euro**).

      **Was die App dort heute sagt:** „Außerhalb der Parkraumbewirtschaftung —
      hier ist Parken gebührenfrei." (`App.tsx`, im Zweig für „keine Zone
      getroffen"). Das ist genau die Sorte Satz, die dieses Projekt sonst
      streicht: Er behauptet etwas über den Ort und weiss etwas über die
      geladene Ebene. Wer danach ohne Ticket steht, zahlt.

      **Der Satz ist weg** — am 7. September, an beiden Stellen. Statt „hier
      ist Parken gebührenfrei" steht jetzt „Für diesen Ort führt die Quelle
      keine Parkzone — ob hier etwas kostet, sagt sie nicht", und in der Tafel
      der Nachsatz, dass es Strassen mit Gebühr ohne Zone gibt und das Schild
      gilt. Ein E2E-Test prüft, dass nirgends „gebührenfrei" oder „Gebühren
      fallen nicht an" steht, wo keine Zone liegt.

      **Offen bleibt die grössere Hälfte:** ob die Abschnittsebene als zweite
      Quelle dazukommt. Sie hat Gebühr, Zeiten und Höchstparkdauer je
      Abschnitt und wüsste an diesen 421 Stellen die Antwort — aber 45.917
      Abschnitte sind 50 MB roh, und sie widerspricht sich selbst (354 tragen
      `zone = "nicht bewirtschaftet"` und trotzdem eine Gebühr). Das braucht
      eine eigene Runde und eine Entscheidung, welche Ebene bei Widerspruch
      gewinnt.

      Nicht verwechseln mit den Löchern im **Innenstadtring**: Die sind
      geprüft und richtig. Tiergarten mit Zoo (rund 6 km²), Gleisdreieck,
      Humboldthain, Volkspark Wilmersdorf — jedes umschlossene Loch ist ein
      Park oder Bahngelände, und die Abschnitte darin sagen zu 94 %
      `nicht bewirtschaftet`.

- [x] **Herauszoomen ins Schwarze — begrenzt** am 7. September. Die Karte
      kannte keine untere Zoomstufe und keinen Rahmen; wer weit genug herauszog,
      sass vor einer schwarzen Fläche mit einem kleinen Stadtfleck darin.

      Zwei Zeilen in `App.tsx`, und die Zahlen kommen beide aus `core/city.ts`:
      `setMaxBounds` auf `reportBounds` — **genau den Rahmen**, aus dem
      `build-tiles.sh` über `city-bbox.ts` den PMTiles-Ausschnitt schneidet,
      dahinter gibt es also keine Kachel mehr —, und `setMinZoom` aus
      `cameraForBounds` auf denselben Rahmen.

      Die Zoomstufe wird **gerechnet, nicht gesetzt**: Sie hängt an der Grösse
      des Behälters, ist auf dem Handy eine andere als auf dem Monitor, und
      eine geratene Zahl wäre auf einem von beiden falsch. Ein
      `resize`-Zuhörer rechnet sie neu, und sie geht nie über die aktuelle
      Stufe hinaus — sonst spränge die Karte mitten in einer Geste weiter
      hinein, wenn ein Panel aufklappt.

      Dem Städte-Umschalter kommt das nicht in die Quere: Der lädt die Seite
      neu, `CITY` steht also beim Erzeugen der Karte fest.

- [x] **„Auto weg?" nennt jetzt die richtige Stelle** — am 7. September.
      Vorher standen Link, Nummer und der Name „Auskunfts- und Fahndungsstelle
      der Polizei Berlin" fest in `TowInfo.tsx`, in allen vier Städten.

      Die Angaben hängen jetzt an der Stadt (`City.towedVehicles`), mit Quelle
      und Prüfdatum. Fehlt das Feld, **verschwindet der Abschnitt**, statt auf
      Berlin zurückzufallen.

      | Stadt | Stelle | Nummer |
      | --- | --- | --- |
      | Berlin | Auskunfts- und Fahndungsstelle der Polizei Berlin | (030) 4664-709800 |
      | Hamburg | Zentrale Verwahrstelle der Polizei Hamburg, Ausschläger Allee | 040 7810450 |
      | München | Kfz-Verwahrstelle der Polizei München | 089 429301 |
      | Frankfurt | Stadt Frankfurt am Main, Abschleppungen | **keine** |

      Frankfurt bekommt bewusst keine Nummer: Die Seite der Stadt weist
      automatisierte Abrufe mit `403` ab, und eine Nummer aus zweiter Hand
      einzutragen wäre genau der Fehler, den dieser Abschnitt behebt. Wer sie
      am Bildschirm belegen kann, trägt sie nach.

      Zwei Dinge, die beim Nachschlagen auffielen und die zeigen, warum das
      nicht aus dem Kopf geht: Hamburg hat **zwei** Verwahrstellen, und welche
      zuständig ist, hängt am Abstellort — die amtliche Seite sagt das selbst,
      also steht es als Zusatz dabei. Und dieselbe Seite nennt für die
      Verwahrstelle Flughafenstraße `0711/94791-201`, eine **Stuttgarter**
      Vorwahl. Ob Tippfehler oder Servicenummer war nicht zu klären; sie steht
      deshalb nicht in der App.

      Vier Unit-Tests halten fest, dass jede Stadt eine Stelle hat, dass die
      Berliner Seite nur bei Berlin steht und dass jede Nummer ein Prüfdatum
      trägt. Ein E2E-Test schaltet auf Hamburg und prüft, dass dort weder
      „Polizei Berlin" noch eine `030`-Nummer auftaucht.

- [x] **`.nvmrc` mit `22`** — am 7. September, Vorschlag des Betreibers. Eine
      Zeile, und `nvm use` wird zum Selbstläufer.

      Er trifft eine Lücke, die am selben Abend entstanden ist: `corepack
      enable` steht seitdem im Schnellstart von `CONTRIBUTING.md`, damit war
      die **pnpm**-Hälfte des Satzes „so wird die Umgebung richtig aufgesetzt"
      abgedeckt und die **Node**-Hälfte nicht. `engines.node` sagt zwar
      `>=22`, aber niemand liest `engines`, bevor etwas schiefgeht.

      Nachgemessen, dass die Zahl stimmt: Alle vier Workflows stehen auf
      `node-version: 22`. Läuft das auseinander, baut die CI etwas anderes als
      der Rechner — und das fällt erst am Unterschied auf.

- [ ] Ladepunkt-Belegung, sobald die Lizenzfrage bei der SenMVKU geklärt ist.
- [x] **Drei Dependabot-PRs, die Code brauchten — alle drei erledigt** am
      6. September, mit 105 grünen E2E-Tests. Die Ursachen, als Historie:
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
      `@cloudflare/workers-types` 5 waren grün und sind zusammengeführt.
      Alle elf PRs sind zu; Begründungen in
      [entscheidungen.md](entscheidungen.md#abhängigkeiten-aktuell-halten).
