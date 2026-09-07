# Todo

Offene Punkte in der Reihenfolge, in der sie sinnvoll sind. Getroffene
Entscheidungen mit Begründung stehen in [entscheidungen.md](entscheidungen.md);
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
3. **Dependabot-Warnungen** und **Sicherheitsupdates** einschalten
   (Punkt 7) — zwei Schalter, und genau die, die den dringenden Teil abdecken.
4. **Auto-Renew** für die fünf Domains (Punkt 2). Der einzige Punkt auf dieser
   Liste, an dem ein Versäumnis nicht reparierbar ist.
5. **Telegram-Token** beim BotFather holen (Punkt 6) und die restlichen Namen
   sichern, solange sie frei sind.

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
> die API geht es ebenfalls nicht, und zwar aus zwei getrennten Gründen:
> `PATCH /repos/…` beantwortet der Egress-Proxy dieser Umgebung mit
> **„Repository settings writes are not permitted through this proxy"**, und
> für das **Organisationsbild** gibt es in der GitHub-API überhaupt keinen
> Endpunkt — das kann nur die Weboberfläche. Was ich stattdessen getan habe:
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

- [x] **CI-Geheimnisse hinterlegt.** `deploy.yml` braucht
      `CLOUDFLARE_API_TOKEN` und `CLOUDFLARE_ACCOUNT_ID`; `VITE_API_BASE` ist
      seit dem 6. September **optional** — der Deploy nimmt die Worker-Adresse
      aus seiner eigenen Ausgabe, wenn kein Secret gesetzt ist.
      `./scripts/einrichten.sh ci` setzt beide, wenn `gh` angemeldet ist.
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

## 5. Weitere Städte — Hamburg und Frankfurt laufen, München offen — **ich**

Analyse der Datenlage in [staedte.md](staedte.md), Recherche zu sechzehn
weiteren Städten in
[staedte-recherche-2026-09.md](staedte-recherche-2026-09.md). Hamburg ist seit
dem 6. September angeschlossen, Frankfurt am Main seit dem 7. — drei Städte,
umschaltbar in den Einstellungen. Als nächstes München, die letzte Stadt aus
der Recherche, für die ein tragfähiger Datensatz belegt ist.

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
- [ ] **Standort-Vorschlag beim ersten Öffnen.** FreiFahren fragt „Switch to
      {{city}}? Your location looks like you are in {{city}}." Mit der dritten
      Stadt ist die Liste in den Einstellungen die einzige Stelle, an der
      jemand die Stadt findet — damit ist der Punkt fällig, nicht mehr nur
      sinnvoll.
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
- [ ] **`pages.yml` baut nur Berlin.** Hamburgs und Frankfurts Daten liegen
      committet im Repository und werden im Deploy nicht neu gebaut. Das ist
      heute richtig — die Daten ändern sich über Monate —, aber es heißt auch:
      Ein Feed-Wechsel fällt erst auf, wenn jemand von Hand abruft. Ein
      wöchentlicher Job mit `continue-on-error` je Stadt wäre der nächste
      Schritt.
- [ ] **Die FAQ in den Einstellungen ist Berlin.** „Warum kassiert sonntags nur
      eine einzige Zone?", „Von 45.917 Abschnitten tragen 747 einen Wert" —
      beides stimmt und beides gilt nur für Berlin. Mit drei Städten gehört die
      Liste je Stadt gefiltert oder umformuliert.
- [ ] **München als vierte Stadt.** Der Datensatz ist inzwischen geprüft
      (Recherche vom 7. September): 82 Parkraummanagementgebiete plus 13.714
      Straßenseiten-Linien, DL-DE/BY-2.0. Zwei Dinge sind dort schwerer als in
      Frankfurt: Es gibt **keinen Tarif** im Feed — alle 82 Gebiete bekämen
      `Fee.unknown` —, und die Zeiten stehen in 292 Schreibweisen mit
      zusammengesetzten Klauseln. Vorher ist die Feiertagstabelle zu klären:
      Mariä Himmelfahrt gilt in Bayern **gemeindeweise**, für München also an
      der Stadt und nicht am Land.
- [x] **Produktname entberlinert.** Die App heißt jetzt überall
      `knoellchenfrei`; die `h1` nennt die geladene Stadt dazu. Der interne
      Paketname `@knoellchenfrei/*` bleibt: Ihn umzubenennen wäre Aufwand ohne
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

Bilder, Beschreibungstexte und Namensschema stehen in
[marke.md](marke.md); der Text der Org-Profilseite in
[org-profil.md](org-profil.md). Nichts davon geht über die GitHub-App: Sie darf
in dieser Organisation weder Repositories anlegen noch Einstellungen ändern
(`403 Resource not accessible by integration`).

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
- [ ] Bewusst **nicht**: Sponsor-Knopf (dahinter steht kein Konto), private
      E-Mail im Profil (kommt dort nicht wieder weg), Discussions (ein leeres
      Forum wirkt verlassener als keins).
- [ ] **Dependabot-Warnungen und Sicherheitsupdates einschalten.** *(Ob das
      schon geschehen ist, kann ich nicht nachsehen: Der Egress-Proxy
      beantwortet `GET /repos/…/vulnerability-alerts` und
      `…/automated-security-fixes` mit 403. Bitte im Zweifel selbst
      nachschauen.)*
      `Settings → Advanced Security` → *Dependabot alerts* und
      *Dependabot security updates*. Die Konfiguration in
      `.github/dependabot.yml` steuert nur die **Versions**updates; die
      Sicherheitsseite hängt an diesen beiden Schaltern und lässt sich nicht
      aus dem Repository heraus setzen. Ohne sie fehlt genau der Teil, der
      dringend ist.
- [x] **GitHub Pages ist eingeschaltet.** Nachgeprüft: `has_pages: true`, und
      der Lauf vom 6. September, 18:24 Uhr, ist grün durchgelaufen. Damit liegt
      die App unter `https://knoellchenfrei.github.io/knoellchenfrei/`.
      *(Die Adresse selbst kann ich nicht abrufen — `github.io` ist vom
      Egress-Proxy gesperrt. Der grüne Lauf ist der Beleg, nicht ein
      Seitenaufruf.)*

      **Ins Feld *Custom domain* gehört nichts.** Drei Gründe, jeder für sich
      ausreichend:

      1. Ein Hostname kann nur an einer Stelle liegen. `knoellchenfrei.de` ist
         für **Cloudflare Pages** vorgesehen (Punkt 2 und
         [hosting.md](hosting.md)); trägt man ihn hier ein, zeigt das DNS auf
         GitHub, und der Umzug später kostet eine Ausfallzeit.
      2. `base: './'` in `vite.config.ts` erzeugt **relative** Pfade. Die App
         läuft deshalb ohne jede Anpassung unter
         `knoellchenfrei.github.io/knoellchenfrei/` — für einen geschlossenen
         Test ist das genug, und es kostet keine DNS-Entscheidung.
      3. Eine eigene Domain hier bräuchte zusätzlich eine Datei `CNAME` im
         **ausgelieferten** Verzeichnis, also `apps/web/public/CNAME`. Ohne
         sie setzt `actions/deploy-pages` die Einstellung bei jedem Lauf
         zurück — die Domain funktioniert dann bis zum nächsten Push.

      Wenn es während der Beta trotzdem eine eigene Adresse sein soll, dann
      **nicht die Hauptdomain**, sondern eine eigene Unterdomain, etwa
      `beta.knoellchenfrei.de` als `CNAME` auf `knoellchenfrei.github.io`.
      Das setzt voraus, dass die Zone schon bei Cloudflare liegt, und braucht
      die `CNAME`-Datei aus Punkt 3. Vorher lohnt es nicht.

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

- [ ] Bilder für die Installations-Karte neu aufnehmen, sobald die Kacheln
      erreichbar sind: `public/screenshots/` zeigt zurzeit die App ohne
      Hintergrundkarte, weil die Aufnahme in einer Umgebung ohne Zugang zu
      `tile.openstreetmap.org` entstanden ist. Befehl steht im Kopf von
      `apps/web/scripts/make-screenshots.mjs`.
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
