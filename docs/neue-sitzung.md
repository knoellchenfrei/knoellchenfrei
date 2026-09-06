# Die erste Nachricht in der neuen Sitzung

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

Stand: Die App ist fertig und getestet (129 Unit-Tests, 93 E2E, Coverage
96,3 %). Der letzte Stand liegt dort auf dem Branch
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
- **Die Karte ohne Hintergrund ist kein Fehler.** In dieser Umgebung ist
  `tile.openstreetmap.org` gesperrt, im Artifact grundsätzlich jede fremde
  Bildquelle.
- **Playwright braucht `PLAYWRIGHT_CHROMIUM`.** Sonst sucht es eine
  Build-Nummer, die es nicht gibt.
