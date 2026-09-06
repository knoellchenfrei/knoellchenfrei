# Öffentlich machen — wer was tut

Das Projekt ist technisch fertig für eine Veröffentlichung nach dem Vorbild von
[FreiFahren](https://github.com/FreiFahren/FreiFahren). Diese Liste trennt, was
im Repository schon erledigt ist, von dem, was **nur der Betreiber** tun kann —
weil es ein Konto, eine Identität oder eine Entscheidung verlangt.

## Erledigt

- MIT-Lizenz, Beitragsleitfaden, Verhaltensregeln, Sicherheitsrichtlinie
- Issue- und Pull-Request-Vorlagen, inklusive einer eigenen Vorlage für falsche
  Tarifdaten
- CI: Typprüfung, Unit-Tests, Coverage-Schwellen, End-to-End-Tests,
  Abhängigkeitsprüfung, Secret-Scan
- `deploy.yml`: rollt Worker und Web-App aus, **sobald** die Zugangsdaten
  hinterlegt sind — ohne sie überspringt der Workflow die Schritte und schreibt
  in die Zusammenfassung, was fehlt. Ein Fork bleibt dadurch grün.
- Entwürfe für Impressum und Datenschutzerklärung, technisch vollständig
- Das 2012er MySQL-Entwicklungspasswort ist aus dem aktuellen Stand entfernt

## Nur du

### 1. Das Passwort in der Historie entscheiden

In sechs Commits von 2012 steht `root` / `muttikit` auf
`jdbc:mysql://localhost:3306/parkingzone`. Aus dem aktuellen Stand ist es
entfernt, in der Historie steht es weiter.

- **Wurde `muttikit` je woanders benutzt?** Dann ändern, unabhängig von diesem
  Repository. Das ist die eigentliche Gefahr, nicht der localhost-Verweis.
- **Historie umschreiben oder nicht?** Solange das Repository privat ist, wirkt
  ein Umschreiben tatsächlich. Danach nie wieder. Wenn es weg soll, dann jetzt:

  ```bash
  pipx install git-filter-repo
  git filter-repo --replace-text <(echo 'muttikit==>REDACTED')
  git push --force-with-lease --all
  ```

  Das ändert alle Commit-Hashes der 2012er Historie. Bei einem Repository ohne
  Forks ist das folgenlos. **Deine Entscheidung — ich mache das nicht ungefragt.**

### 2. Repository öffentlich schalten

*Settings → General → Danger Zone → Change visibility.* Vorher die
Sicherheitsfunktionen einschalten: *Settings → Code security* → Secret scanning,
Push protection, Dependabot alerts. Für öffentliche Repositories ist das
kostenlos.

### 3. Cloudflare einrichten — ohne Terminal

Der Weg über `wrangler` auf dem eigenen Rechner steht in
[hosting.md](hosting.md). Nötig ist er nicht: Alles davon lässt sich vom Handy
aus über die GitHub-Weboberfläche auslösen.

1. **Cloudflare-Konto** anlegen (kostenlos, Web-Formular).
2. **API-Token** erzeugen: Cloudflare → My Profile → API Tokens → Create Token,
   Rechte *Workers Scripts:Edit*, *Workers KV Storage:Edit*, *D1:Edit*,
   *Cloudflare Pages:Edit*. Die **Account-ID** steht im Dashboard rechts.
3. Beides im Repository hinterlegen unter *Settings → Secrets and variables →
   Actions*: `CLOUDFLARE_API_TOKEN` und `CLOUDFLARE_ACCOUNT_ID`.
4. *Actions → **Cloudflare einrichten** → Run workflow* starten. Der Workflow
   legt KV-Namespace und D1-Datenbank an, trägt die IDs in `wrangler.toml` ein,
   committet das zurück und spielt das Schema ein. Zweimal starten schadet
   nicht.
5. *Actions → **Deploy** → Run workflow*. Die Worker-Adresse steht danach in der
   Ausgabe; sie als drittes Secret `VITE_API_BASE` hinterlegen und Deploy einmal
   erneut starten — erst dann teilt die App wirklich, und erst dann erscheint
   das Feedback-Formular.

**Ungetestet.** Der Einrichtungs-Workflow ist geschrieben, aber nie gegen ein
echtes Cloudflare-Konto gelaufen — hier gibt es keins. Er schreibt deshalb die
vollständige Ausgabe beider `create`-Befehle ins Log, bevor er etwas auswertet:
Scheitert das Auslesen der IDs, stehen sie trotzdem lesbar da und lassen sich
über den Web-Editor von Hand in `wrangler.toml` eintragen.

### 4. Impressum und Datenschutzerklärung

**Das ist der Schritt, der nicht delegierbar ist.** Ein Impressum verlangt eine
ladungsfähige Anschrift — dein Name, deine Adresse, öffentlich. Kein Postfach.

1. [`impressum.md`](impressum.md) und [`datenschutz.md`](datenschutz.md)
   ausfüllen — alles mit `⟨…⟩` markierte.
2. Beides irgendwo veröffentlichen (eigene Seite, GitHub Pages, Notion — egal,
   Hauptsache erreichbar).
3. Die URLs beim Bauen setzen, dann erscheinen die Links im Fuß der App:

   ```
   VITE_IMPRINT_URL = https://…
   VITE_PRIVACY_URL = https://…
   ```

   Ohne diese Variablen zeigt die App **keine** Links — ein Link auf eine
   Platzhalterseite wäre schlechter als keiner.
4. Vor dem öffentlichen Betrieb anwaltlich prüfen lassen. Der technische Teil
   der Datenschutzerklärung ist vollständig und stimmt; die Einordnung ist es,
   die geprüft gehört.

### 5. Die rechtliche Frage entscheiden

§ 23 Abs. 1c StVO richtet sich an Fahrzeugführende, nicht an Betreiber —
deshalb existieren Dienste wie blitzer.de legal. Das ist die Rechtslage, wie sie
in der Recherche steht, **keine Rechtsberatung**. Mit einem Impressum steht dein
Name auf dem Dienst. Diese Abwägung kann dir niemand abnehmen.

## Was von FreiFahren übernommen ist — und was nicht

Der Aufbau ist ohnehin derselbe (Vite, TypeScript-Monorepo, MapLibre,
Cloudflare Worker, D1) — das war Konvergenz, nicht Nachbau. Von der Oberfläche
übernommen: das Melde-Sheet mit dem Ort als Pflichtfeld, das Feedback-Formular,
das Einstellungs-Sheet mit stehendem Hinweis und rechtlichen Links, und der
Standort-Vordialog.

**Nicht übernommen, und zwar bewusst:**

| Bei FreiFahren | Warum hier nicht |
| --- | --- |
| „Contribute"-Knopf | Dort ein e. V. mit Vorstand und Beitragskonto. Hier gibt es kein finanzielles Interesse; ein Spenden-Knopf, hinter dem nichts steht, wäre eine Behauptung. |
| Kontaktseite mit Ansprechpartnern | Setzt eine Organisation voraus, die es hier nicht gibt. Solange eine Person dahintersteht, ist das Impressum die ehrliche Form. |
| Presse-Bereich | Braucht jemanden, der Presseanfragen beantwortet. |
| Sprachumschaltung | Die Daten sind deutsch — Zonennamen, Bezirke, Freitext im Feed. Eine halbe Übersetzung ist schlechter als eine ganze deutsche App. |
| ~~Stadt-Umschaltung~~ | **Gebaut.** Die Begründung dagegen war falsch: Die Zonendaten liegen nicht im Bündel, sondern werden zur Laufzeit geholt. Jetzt eine Stadt zur Zeit, umschaltbar in den Einstellungen — dasselbe Modell wie FreiFahren. |

## Zweite Stadt

Eine stehende Anforderung, kein Fernziel: Was neu dazukommt, darf Berlin nicht
fest verdrahten. Der Stand heute:

| Baustein | Berlin-spezifisch? |
| --- | --- |
| Tarif- und Zeitlogik (`core/tariff`) | nein |
| Fahrplan-Parser | nein, aber auf die Schreibweisen dieses Feeds trainiert |
| Heatmap-Raster | nein — metrisch, fester Ursprung |
| Ruhetags-Hinweis | nein — Wochentage und Stunden werden aus den geladenen Fahrplänen abgeleitet |
| Feiertagskalender (`core/holidays`) | nein mehr — Tabelle je Bundesland, BE und HH belegt |
| Kartenausschnitt und Grenzprüfung | nein mehr — `core/city`, ein Datensatz je Stadt |
| Datenquelle (`ingest/sources`) | nein mehr — nach Stadt gegliedert, beide abgerufen |
| Zeitfenster-Parser | nein mehr — je Stadt einer, `parse-schedule.ts` und `hamburg.ts` |
| Zonendaten im Web | nein mehr — je Stadt unter `public/data/<stadt>/`, zur Laufzeit geholt |
| Produktname (`index.html`, Manifest, `h1`) | **ja** — steht dreimal als „ParkingZone Berlin" |

Was sich damit geändert hat: Berlin steckte an **sechs** Stellen als
Zahlenpaar im Code — zwei im Browser-Speicher, eine im Kartenmittelpunkt, eine
beim Merken des Parkplatzes, eine im Worker und eine im Telegram-Parser. Die
Zahl war vorher mit „drei Stellen" angegeben; das war zu optimistisch gezählt.
Jetzt steht sie einmal in `core/city.ts`, und Browser, Worker und Bot lesen
dieselbe. Auseinanderlaufende Grenzen waren der teuerste Fehler dieser Art:
Der Server hätte Meldungen verworfen, die die App gerade angenommen hat.

Offen bleibt eine **Datenbank je Stadt**. FreiFahren macht genau das: Ihr
Bündel nennt `api-worker-db-eu`, `api-worker-db-hamburg-eu` und
`api-worker-db-leipzig` als getrennte D1-Bindings an einem Worker, dazu eine
Subdomain je Stadt. Solange hier nur Berlin einen Worker hat, wäre eine zweite
Datenbank Aufwand ohne Gegenwert — aber sobald Meldungen für Hamburg
hereinkommen sollen, ist es dieser Weg und nicht eine gemeinsame Tabelle mit
einer Stadtspalte: Getrennte Datenbanken machen es unmöglich, dass eine
Hamburger Meldung versehentlich auf einer Berliner Karte landet.

## Danach — und da kann ich wieder übernehmen

- **PMTiles-Pipeline**, damit die Kacheln nicht mehr von OpenStreetMap kommen.
  Die OSM-Kachelrichtlinie deckt ausgelieferte Anwendungen nicht ab, und die
  Nutzer-IPs gehen aktuell an einen Dritten. FreiFahrens Weg: ein
  `.pmtiles`-Archiv in R2, kein laufender Kachelserver. Siehe
  [hosting.md](hosting.md).
- **Ladepunkt-Belegung** über den Worker, sobald die Lizenzfrage bei der SenMVKU
  geklärt ist.
- **Mehrere Städte** — die Zonenlogik war nie Berlin-spezifisch, die Grenzen
  und der Feiertagskalender sind es seit `core/city.ts` auch nicht mehr. Was
  bleibt, ist die Datenquelle: Hamburgs Zeiten stehen in einer anderen
  Schreibweise als Berlins, und dafür braucht es einen Parser, den niemand
  schreiben kann, ohne den Feed einmal gesehen zu haben.
