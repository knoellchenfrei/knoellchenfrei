# Die erste Nachricht in der neuen Sitzung

> **Erledigt.** Der Umzug lief am 6. September 2026 genau so ab; dieses
> Dokument beschreibt ihn nur noch. Es hat sich dabei eines bestätigt und eines
> widerlegt: Beide Repositories als Quelle anzugeben hat funktioniert — die
> Sitzung konnte das alte lesen und ins neue pushen. Der Rat, den Umzug im
> Zweifel auf dem Laptop zu fahren, war also nicht nötig. Widerlegt hat sich
> die Annahme, `scripts/umzug.sh` bekomme den Zielnamen groß geschrieben:
> Die Adresse ist durchgehend klein, `knoellchenfrei/knoellchenfrei`, und der
> Name landet unverändert in vier Dateien.
>
> Was danach in einer frischen Sitzung ansteht, steht in
> [todo.md](todo.md) — nicht mehr hier.

Beim Anlegen der Sitzung **beide Repositories** als Quelle angeben — das alte
zum Kopieren, das neue zum Pushen. Nachträglich eins dazuzuladen geht nicht:
Ein Repository unter einem anderen Eigentümer lehnt die Sitzung ab
(„cross-tier adds are not supported").

Lässt das Formular nur eins zu: das **neue** nehmen und den Umzug auf dem Laptop
laufen lassen. Das alte ist privat, eine Sitzung ohne Zugriff kann es nicht
klonen.

`CLAUDE.md` liest die neue Sitzung von selbst. Der Text unten muss deshalb nicht
das Projekt erklären, sondern nur sagen, wo es steht und was ansteht.

## Zum Kopieren

```text
Wir ziehen dieses Projekt aus herbeus/parkingzone hierher um.

Stand: Die App ist fertig und getestet (541 Unit-Tests, 140 E2E, Coverage
99,9 %). Der letzte Stand liegt dort auf dem Branch
claude/github-repo-integration-cqhab3, letzter Commit d33474a.

Lies zuerst CLAUDE.md, docs/todo.md und docs/entscheidungen.md — dort steht
alles Getroffene mit Begründung, und die Eigenheiten dieser Umgebung.

Erste Aufgabe: den Umzug abschließen. scripts/umzug.sh legt aus dem alten Klon
einen Branch mit genau einem Commit an, entfernt das Altprojekt von 2012 und
schreibt die Repository-Adressen um. Es pusht absichtlich nicht selbst.

Danach nach docs/todo.md weiterarbeiten. Punkt 3 ist der Umzug, Punkt 4 die
eigenen Kartenkacheln, Punkt 6 Telegram.

Zwei Artifacts gehören dazu und sollten aktuell gehalten werden:
- die App:      https://claude.ai/code/artifact/b8701c4f-b3dd-43b8-809d-8291df440831
- der Bericht:  https://claude.ai/code/artifact/32d83da8-c4ba-4d8b-b6db-b8c4b8f86c02

Beide werden mit dem Parameter `url` aktualisiert, sonst entsteht ein zweites.
Die Quelle des Berichts liegt unter docs/bericht/index.html, die App wird mit
`pnpm artifact` gebaut.

Meine Vorlieben: Deutsch, kurz und faktenbasiert, Antwort zuerst. Widersprich
mir, wenn ich falsch liege. Bei Entscheidungen frag mich über den Q&A-Dialog,
sonst geht es im Text unter. Aktuelle Fakten bitte nachschlagen statt raten.
```

## Was die neue Sitzung nicht wissen kann

Drei Dinge stehen zwar in den Dokumenten, gehen aber erfahrungsgemäß unter:

- **Der Beta-Riegel ist die Voreinstellung.** Ohne `PUBLIC_LAUNCH=1` baut Vite
  `noindex` und eine sperrende `robots.txt` ein. Das ist Absicht.
- **Eine Karte, auf der nichts steht, hat drei mögliche Gründe — und zwei
  davon sind kein Fehler.** Im Artifact ist es normal: Die
  Sicherheitsrichtlinie des Sandkastens blockiert jede fremde Bildquelle, und
  seit dem 7. September zeichnet es wenigstens die Zonen aus den eingebetteten
  Daten. Lokal ohne `VITE_TILES_URL` ist es auch normal — dann springen die
  Rasterkacheln von OpenStreetMap ein. Der dritte Grund war ein Fehler und ist
  behoben: **MapLibre 6 startet einen Worker aus einer eigenen Datei**, kein
  Bundler erkennt sie statisch, und die Anfrage lief in die SPA-Rückfall-
  adresse — ohne Worker parst MapLibre weder Vektorkacheln noch GeoJSON. Die
  Karte hat deshalb **nie** etwas gezeichnet, auch die Parkzonen nicht.
  Kommt es wieder: `content-type` der Worker-Antwort ansehen, nicht den Status.
  *(Der Egress-Proxy sperrte `tile.openstreetmap.org` zeitweise; seit dem
  6. September ist er offen.)*
- **Die Kacheln liegen unter `aktuell/`, nicht unter einer Version.** Der
  Workflow *Kacheln* baut sie wöchentlich; deshalb braucht ein neuer Bau weder
  eine Variable noch einen Deploy.
- **Playwright braucht `PLAYWRIGHT_CHROMIUM`.** Sonst sucht es eine
  Build-Nummer, die es nicht gibt.
