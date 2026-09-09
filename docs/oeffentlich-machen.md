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
- Das 2012er MySQL-Entwicklungspasswort steht weder im Code noch in der
  Doku dieses Repositories — seit dem 9. September auch nicht mehr als
  Zitat im Abschnitt darunter, wo es zwölf Zeilen lang wörtlich stand

## Nur du

### 1. Das Passwort von 2012 — entschieden, aber eine Frage bleibt

In sechs Commits von 2012 steht ein MySQL-Zugang im Klartext, auf
`jdbc:mysql://localhost:3306/parkingzone`. Was daraus geworden ist:

- **Das alte Repository `herbeus/parkingzone` ist privat** (am 9. September
  nachgeprüft), und **dieses hier hat die 2012er Historie gar nicht** — der
  Umzug hat einen Neuanfang gemacht, der erste Commit ist
  `knoellchenfrei - Neuanfang mit sauberer Historie` vom 6. September. Ein
  `filter-repo` ist damit gegenstandslos; die Historie umzuschreiben ist
  ausserdem eine Projektregel *dagegen*.
- **Offen bleibt die einzige Frage, auf die es ankommt: Wurde dieses Passwort
  je woanders benutzt?** Dann gehört es dort geändert, unabhängig von jedem
  Repository. Das war schon immer die eigentliche Gefahr, nicht der
  localhost-Verweis.

**Dieser Abschnitt nannte das Passwort bis zum 9. September wörtlich** — und
zwar in einem Repository, das seit dem 6. September **öffentlich** ist. Ein
Zugang, der im privaten Altbestand sicher lag, stand damit im Klartext im
öffentlichen Nachfolger; genau umgekehrt zum Zweck des Umzugs. Aufgefallen ist
es beim Nachgehen von Audit-Punkt M-026, nicht durch eine Prüfung: GitHubs
Secret Scanning meldet nichts, weil ein zwölf Jahre altes MySQL-Passwort auf
kein Anbietermuster passt — und die Erkennung für **generische** Muster
(`secret_scanning_non_provider_patterns`) steht in diesem Repository auf
`disabled`. Sie einzuschalten kostet nichts und ist eine Einstellung, also
deine Entscheidung.

### 2. Repository öffentlich schalten — erledigt

Seit dem 6. September öffentlich. Die Sicherheitsfunktionen sind an, am
9. September über die API nachgeprüft: Secret Scanning `enabled`, Push
Protection `enabled`, Dependabot-Sicherheitsupdates `enabled`, Private
Vulnerability Reporting `true`. Auf `disabled` stehen nur die beiden Zusätze
`secret_scanning_non_provider_patterns` und `secret_scanning_validity_checks`
— siehe den Absatz oben.

### 3. Cloudflare einrichten

**Ein Befehl von deinem Rechner:**

```bash
./scripts/einrichten.sh
```

Hier stand vorher ein Weg „ohne Terminal", der alles über Workflows auslöste.
Er ist am 6. September zugunsten des Skripts entfallen — nicht aus
Geschmacksgründen: **Bootstrap ist nicht Deployment.** Einmalige
Ressourcenerzeugung gehört an einen Arbeitsplatz, an dem jemand sitzt; die
Pipeline macht danach das, was ohne Menschen auskommt. Und der Zustand darf nur
an einer Stelle stehen — vorher stand er in einem Skript *und* in einem
Workflow, beide halb.

Was du davor brauchst, und was das Skript nicht für dich tun kann:

1. **Cloudflare-Konto** anlegen (kostenlos, Web-Formular).
2. **API-Token** erzeugen: Cloudflare → My Profile → API Tokens → Create Token,
   Rechte *Workers Scripts:Edit*, *Workers KV Storage:Edit*, *D1:Edit*,
   *Cloudflare Pages:Edit* — plus *Workers R2 Storage:Edit* für die Kacheln.
   Fehlt eines, scheitert der Schritt, der es braucht, mit
   `Authentication error [code: 10000]`; das Skript nennt die Liste vorher.

Alles Weitere macht das Skript: KV, D1, Migrationen, Pages-Projekt, das Salz
für die Client-Hashes, die CI-Geheimnisse (mit `gh`), Telegram samt Webhook.
Danach rollt jeder Push auf `main` aus.

> **Ein langlebiger Token im GitHub-Secret ist derzeit nicht vermeidbar.**
> Der Zielzustand wäre OIDC — kurzlebige Zugangsdaten je Lauf, wie npm es mit
> *trusted publishing* macht. Cloudflare kann das für `wrangler deploy` noch
> nicht (`cloudflare/workers-sdk#11434`, `cloudflare/wrangler-action#402` sind
> offen, und die Doku verlangt weiterhin einen API-Token für CI). Was bleibt:
> den Token eng schneiden und ihm ein Ablaufdatum geben.

**Überholt seit dem 6. September 2026.** Es gibt keinen
Einrichtungs-*Workflow* mehr: Bootstrap ist nicht Deployment, und
`setup-cloudflare.yml` ist gelöscht. Eingerichtet wird von einem Rechner aus
mit `./scripts/einrichten.sh` — das Skript ist inzwischen gegen ein echtes
Konto gelaufen und hat dabei acht eigene Fehlbefunde offengelegt. Was heute
gilt, steht in [hosting.md](hosting.md#einrichten); was bei Verlust zu tun
ist, in [notfall.md](notfall.md).

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
| Produktname (`index.html`, Manifest, `h1`) | nein mehr — heißt `knoellchenfrei`, die `h1` nennt die geladene Stadt |

Was sich damit geändert hat: Berlin steckte an **sechs** Stellen als
Zahlenpaar im Code — zwei im Browser-Speicher, eine im Kartenmittelpunkt, eine
beim Merken des Parkplatzes, eine im Worker und eine im Telegram-Parser. Die
Zahl war vorher mit „drei Stellen" angegeben; das war zu optimistisch gezählt.
Jetzt steht sie einmal in `core/city.ts`, und Browser, Worker und Bot lesen
dieselbe. Auseinanderlaufende Grenzen waren der teuerste Fehler dieser Art:
Der Server hätte Meldungen verworfen, die die App gerade angenommen hat.

**Entschieden am 6. September 2026, und anders als hier vorher stand:** eine
Datenbank mit einer Spalte `city`, nicht eine Datenbank je Stadt. Dieser
Absatz empfahl das Gegenteil und widersprach damit dem, was seitdem läuft
(Audit-Punkt M-026).

FreiFahren fährt je Stadt eine eigene D1 *und* einen eigenen Worker
(`api-worker-db-eu`, `…-hamburg-eu`, `…-leipzig`). Sauber getrennt, aber
n-mal Betrieb. Für vier Städte auf dem Free Tier ist das Aufwand ohne
Gegenwert, und das Argument „getrennte Datenbanken machen eine Verwechslung
unmöglich" trägt nicht: Die Stadt entsteht beim Schreiben aus der **Position**
(`cityAt`), nicht aus einer Angabe des Clients. Eine Meldung ohne Stadt kann
gar nicht entstehen, und eine falsche Stadt hieße, dass die Koordinaten falsch
sind — was zwei Datenbanken auch nicht heilen würden.

Wiedervorlage, sobald eine Stadt eigene Betriebszeiten, eigenes Recht oder
eigene Betreiber bekommt. Dann trennt man nicht die Tabelle, sondern den
Betrieb.

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
