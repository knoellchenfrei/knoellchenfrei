# Mobile-UX-Audit, 9. September 2026

Die App wurde als gebauter Stand mit Playwright auf sieben Viewports in
vierzehn Zuständen aufgenommen, vermessen und danach geändert — und mit
denselben Aufnahmen noch einmal gemessen. Was hier steht, ist gemessen, nicht
vermutet; die Aufnahmen entstanden mit stehender Uhr (Dienstag 10:30 Berliner
Zeit, dieselbe wie in `make-screenshots.mjs`).

Leitfrage: *Fühlt sich das auf einem Smartphone wie eine 2026 gebaute App an,
oder wie eine verkleinerte Webseite?* Vorher: eher das Zweite, mit guten
Grundlagen. Nachher: das Erste, mit Rest.

> **Stand 9. September, nachts:** Die Oberfläche hat seitdem ein
> Design-System ([design.md](design.md)) — eckige Steuerelemente, zwei Kreise
> für die Handlungen auf der Karte, Lucide-Symbole, ein Meldungen-Blatt mit
> Reitern statt zweier Abschnitte unter der Zone. Die Messungen unten
> beschreiben den Stand vom Vormittag; was davon nicht mehr gilt, steht in
> [entscheidungen.md](entscheidungen.md), „Ein Erscheinungsbild".

## Gesamtbewertung

| Bereich | vorher | nachher | warum |
| --- | --- | --- | --- |
| Mobile Layout | 6 | 8 | Kopfzeile von 112 auf 64 Pixel; Ablesewerte gebündelt |
| Karte | 7 | 8 | 84 → 88 % freie Fläche im Ruhezustand auf 390 px, 74 → 86 % mit offenen Chips |
| Pills / Chips | 6 | 7 | eine scrollende Zeile statt drei; Ablesewerte sehen nicht mehr aus wie Knöpfe |
| Details-Layer | 5 | 8 | fester Griff, deckender Grund, drei Raststufen, Wischgeste |
| Einstellungen | 7 | 8 | Schleier, `inert`, Zurück-Taste |
| Feedback | 7 | 8 | Absenden bleibt über der Tastatur |
| Layer-System | 5 | 8 | Verlaufseintrag, Fokus bleibt im Dialog, Ebenen kollidieren nicht mehr |
| Navigation | 6 | 8 | Android-Zurück schließt das Blatt statt die App |
| Touch UX | 7 | 8 | Standort-Knopf 48 px unten rechts; Quellenangabe 36 px |
| Visual Hierarchy | 6 | 8 | Knöpfe, Ablesewerte und Inhalt sind drei erkennbare Klassen |
| Accessibility | 7 | 8 | `inert` hinter Dialogen; Rest war schon gut |
| PWA UX | 7 | 8 | `interactive-widget`, `visualViewport`, Safe Areas auch seitlich |
| Responsive Design | 7 | 8 | 320 px ohne Abschneiden; Querformat mit Safe Areas |
| Modernität 2026 | 5 | 8 | Bottom Sheet mit Griffgeste, FAB, Schleier, Einblendung |
| **Gesamt** | **6,3** | **7,9** | |

Nicht auf 9 oder 10, weil der Rest unten noch offen ist — vor allem die
Wischgeste nur am Griff und die Ebenen-Chips ohne Kantenhinweis.

## Getestete Viewports

| Kurzname | Größe | Emulation |
| --- | --- | --- |
| s320 | 320 × 568 | Touch, mobil, Faktor 2 |
| s375 | 375 × 667 | Touch, mobil |
| s390 | 390 × 844 | Touch, mobil — **Priorität** |
| s430 | 430 × 932 | Touch, mobil |
| l844 | 844 × 390 | Touch, Querformat — ohne seitliche Einrückung; das Querformat mit Kerbe wurde erst am Abend des 9. September vermessen, siehe `docs/entscheidungen.md`, „Querformat" |
| t768 | 768 × 1024 | Touch, Tablet |
| d1280 | 1280 × 860 | Maus, Desktop |

## Getestete Zustände

Initial mit Standort-Vordialog · Initial · Ebenen-Chips offen · Details nach
Zonentipp · Details bis unten gescrollt · Geparkt · Erinnerung gesetzt · Blatt
eingeklappt · Einstellungen oben und unten · Feedback leer, mit Text und
verkleinertem Viewport (Tastatur), gesendet · Melde-Blatt, auch mit Tastatur ·
Fehlermeldung · Suche mit Treffern. Dazu die Interaktionen: Zonentipp, Griff
tippen, Griff wischen, Scrollen im Blatt, seitliches Scrollen der Chips,
Browser-Zurück bei offenem Blatt, Neuladen, Escape, Klick auf den Schleier.

Gemessen wurde je Zustand: Anteil der Bildschirmpunkte, an denen die Karte
oben liegt; jedes Bedienelement unter 44 × 44 Pixel; horizontaler Überlauf des
Dokuments; Elemente, deren Inhalt breiter ist als sie selbst.

## Wichtigste Probleme, priorisiert

### 🔴 Kritisch

1. **Der Griff des Details-Blatts scrollte mit dem Inhalt weg.** Das Blatt war
   ein einziger Scroll-Container, und der Knopf „Ausblenden" stand oben in
   ihm. Wer bis zur Herkunftsangabe gelesen hatte, fand keinen Weg mehr, das
   Blatt zu schließen — außer zurückzuscrollen. Dazu ein durchsichtiger
   Verlauf als Hintergrund, durch den gescrollter Text über die Karte schien.
2. **„Zurück" schloss die App, nicht das Blatt.** Kein Verlaufseintrag für
   Einstellungen, Feedback und Melden. Auf Android ist „Zurück" die eine
   Geste, mit der jede App einen Dialog schließt; hier verließ sie die PWA.
3. **Der Absenden-Knopf lag hinter der Bildschirmtastatur.** Seit Chrome 108
   verkleinert die Tastatur auf Android ohne `interactive-widget` nur den
   sichtbaren Ausschnitt; auf dem iPhone war das schon immer so. Ein
   `position: fixed`-Fuß bleibt dann, wo die Tastatur ist. Wer Feedback
   geschrieben hatte, musste die Tastatur erst wegtippen, um zu sehen, dass
   es einen Knopf gibt.
4. **Der Standort-Vordialog lag auf dem Griff des Blatts.** Beide sassen am
   unteren Rand; der blaue Griff schaute unter dem Dialog hervor.

### 🟠 Wichtig

5. **112 Pixel Kopfzeile** auf einem 568 Pixel hohen Schirm: Suche, darunter
   Beta-Marke, Zahnrad, Statuszahl und Standort-Knopf. Der wichtigste Knopf
   der App sass oben rechts — für den Daumen die schlechteste Ecke — und die
   Statuszahl war auf 320 Pixel abgeschnitten („103 von 103 ka…").
6. **Kein Wischen, keine Raststufen.** Das Blatt kannte zu und 58 %; die
   Griff-Linie war Dekoration.
7. **Ablesewerte sahen aus wie Chips.** „4 Meldungen" und „nur dieses Gerät"
   hatten Rand und Pillenform wie der Ebenen-Knopf darunter, waren aber
   `pointer-events: none`.
8. **Kein Fokus-Käfig, kein Schleier.** Tab lief aus den Einstellungen in die
   Karte; auf Tablet und Desktop stand der Dialog ohne Abdunklung über einer
   weiter bedienbaren Karte.
9. **Die Fehlermeldung lag über den Suchtreffern** (z-index 7 gegen 5); der
   erste Treffer war nicht zu treffen, solange sie stand.

### 🟡 Verbesserung

10. Offene Ebenen-Chips brachen auf 320 Pixel in drei Zeilen um und nahmen
    ein Viertel der Karte.
11. Quellenangabe-Knopf 24 × 24 Pixel; oben rechts in der Zeile der Ablesewerte.
12. `max-height` des Blatts in `vh` — auf dem Handy die Höhe *mit* Adressleiste.
13. Kein `overscroll-behavior` auf den Dialog-Körpern; kein Safe-Area-Abstand
    seitlich im Querformat.
14. Auf 320 Pixel drückte die Marke „gebührenpflichtig" den Titel in zwei Zeilen.

### 🟢 Optional

15. Keine Einblendung der Dialoge — sie erschienen schlagartig.

## Durchgeführte Änderungen

| # | Änderung | Wo |
| --- | --- | --- |
| 1 | Blatt als Spalte: Griff steht, `.sidebar__body` scrollt; deckender Grund, Kante, Schatten; Höhe in Prozent statt `vh` | `styles.css`, `App.tsx` |
| 2 | Ein Verlaufseintrag für alle drei Blätter; `popstate` schließt; Knopf-Schließen räumt ab; Wechsel ersetzt statt stapelt | `layer-history.ts`, `App.tsx`, Test in `test/blatt-verlauf.test.ts` |
| 3 | `interactive-widget=resizes-content` (Android) und `visualViewport` → `--vv-height`/`--vv-top` am Blatt (iPhone) | `index.html`, `viewport.ts`, `main.tsx`, `styles.css` |
| 4 | Vordialog und Stadtvorschlag sitzen über dem Griff, gedeckelt auf dessen Höhe | `styles.css` |
| 5 | Kopfzeile: eine Zeile mit Suche und Zahnrad. Standort-Knopf als 48-Pixel-FAB unten rechts über dem Blatt (`--sheet-height` gemessen), auf Desktop links neben der Seitenleiste | `App.tsx`, `styles.css` |
| 6 | Drei Raststufen (zu, halb, ganz) mit Wischgeste am Griff; Klick bleibt Klick (24-Pixel-Schwelle); Blatt folgt dem Finger nach unten | `App.tsx`, `styles.css` |
| 7 | Beta-Marke und „n von m kassieren" in die Live-Zeile; Ablesewerte ohne Rand, Chips mit Rand | `LiveStats.tsx`, `styles.css` |
| 8 | `inert` auf Karte, Kopfzeile, Overlay, Blatt und FAB, solange Einstellungen oder Feedback offen sind; Schleier mit Klick-zum-Schließen | `App.tsx`, `styles.css` |
| 9 | Meldung unter die Kopfzeile (z-index 4, früher im Baum) | `styles.css` |
| 10 | Ebenen-Chips auf dem Handy als eine seitlich scrollende Zeile mit Scroll-Snap; nur der Chip-Streifen nimmt Berührungen an — *seit dem Abend des 9. September ein Menü unter dem Knopf, siehe `docs/entscheidungen.md`, „Die Ebenen sind ein Menü"* | `styles.css` |
| 11 | Quellenangabe: 36 Pixel bei grobem Zeiger; auf dem Handy unten links über dem Blatt, im Querformat eingeklappt; auf Desktop links neben der Seitenleiste | `styles.css`, `App.tsx` |
| 12 | `overscroll-behavior: contain` auf beiden Scroll-Körpern; Safe-Area links/rechts im Querformat; Marke bricht unter den Titel (≤ 380 px) | `styles.css` |
| 13 | Einblendung der Blätter (220 ms, `translate` + Deckkraft) und des Schleiers; `prefers-reduced-motion` greift über die bestehende Regel | `styles.css` |

## Vorher / nachher

| Viewport | Kopfzeile | Karte frei, Ruhe | Karte frei, Chips offen | Elemente < 44 px, Ruhe |
| --- | --- | --- | --- | --- |
| 320 × 568 | 112 → 64 px | 76 → 80 % | 57 → 76 % | 3 → 1 |
| 375 × 667 | 112 → 64 px | 80 → 84 % | 66 → 80 % | 3 → 1 |
| 390 × 844 | 112 → 64 px | 84 → 88 % | 74 → 86 % | 3 → 1 |
| 430 × 932 | 112 → 64 px | 86 → 89 % | 78 → 86 % | 3 → 1 |
| 844 × 390 | 104 → 56 px | 65 → 62 % | 56 → 53 % | 4 → 2 |
| 768 × 1024 | 116 → 68 px | 48 → 48 % | 44 → 44 % | 3 → 1 |
| 1280 × 860 | 108 → 64 px | 69 → 69 % | 67 → 68 % | 18 → 17 |

Das eine verbliebene kleine Element auf dem Handy ist die Quellenangabe mit
36 Pixeln — grösser als MapLibres 24, kleiner als 44, weil sie ein Hinweis ist
und kein Bedienweg. Im Querformat kostet der FAB drei Prozent Karte; vorher
sass der Knopf in der Kopfzeile, die dafür halb so hoch war. Auf dem Desktop
sind die 17 kleinen Elemente die Bewertungsknöpfe und Zoom-Knöpfe, die bei
grobem Zeiger ohnehin auf 44 Pixel wachsen.

Zeitliche Verhaltensprüfung mit Playwright im Zustand „Details gescrollt":
Vorher stand der Griff ausserhalb des Bildes, nachher an derselben Stelle wie
vor dem Scrollen (E2E-Test `behält den Griff beim Scrollen im Bild`).

## Bewusst nicht umgesetzt

- **Wischgeste auf dem Inhalt des Blatts.** Native Sheets ziehen auch, wenn
  man am oberen Ende des Inhalts weiter nach unten wischt. Das verlangt eine
  Unterscheidung zwischen Scrollen und Ziehen in derselben Geste, und die geht
  in jedem zweiten Fall daneben. Erst der Griff; wenn der sich bewährt, der
  Inhalt.
- **Verlaufseintrag für das aufgeklappte Details-Blatt.** Es klappt bei jedem
  Zonentipp auf; ein Eintrag je Tipp wäre eine Zurück-Taste, die zehnmal
  drücken muss, bevor sie die App verlässt.
- **Automatisches Ausblenden der Fehlermeldung.** „Standort nicht verfügbar"
  ist eine Erklärung, die stehen bleiben darf, bis man sie gelesen hat; der
  Schliessen-Knopf ist 32 Pixel und wächst bei grobem Zeiger.
- **Ebenen als eigenes Blatt statt Chips.** Ein Blatt kostet zwei Tipps, wo
  ein Chip einen kostet; die Chips sind die etablierte Form für Kartenebenen.
- **Zahnrad in das Blatt verlegen.** Es wäre für den Daumen besser erreichbar,
  aber Einstellungen gehören in jeder Karten-App oben — Wiedererkennung
  schlägt hier Reichweite, und sie sind selten.
- **Ein Wechsel auf ein Sheet-Framework** (vaul, react-spring-bottom-sheet).
  Drei Raststufen und ein Griff brauchen 60 Zeilen; das Projekt hält `core`
  frei von Laufzeit-Abhängigkeiten und die Web-App schlank.
- **Helle Variante.** Die App ist `color-scheme: dark`; eine helle Karte samt
  aller gemessenen Farbabstände (siehe `farben-parkzonen.md`) ist ein eigenes
  Vorhaben.

## Verbleibende Probleme

- Die Ebenen-Chip-Zeile zeigte nicht, dass sie weitergeht — ein Verlauf am
  rechten Rand fehlte. Der letzte Chip war angeschnitten, was es meistens
  verriet, aber nicht bei jeder Chip-Zahl. Seit dem 9. September gemessen
  und eingeblendet, siehe Punkt 2 unten — und am Abend desselben Tages
  durch ein Menü ersetzt, weil der Verlauf auf dem Gerät des Betreibers ein
  dunkler Block auf dem letzten Chip war.
- Die `visualViewport`-Lösung für das iPhone ist ohne Gerät nur gegen ihre
  Rechnung getestet (Unit-Test), nicht gegen Safari. Die Android-Lösung über
  die Viewport-Angabe ist deterministisch.
- **Die sieben Viewports hatten keine Safe-Area — und genau dort lag der
  Fehler, den das Gerät zeigte.** Am 9. September abends fotografierte der
  Betreiber auf dem iPhone die Chip-Zeile im Suchfeld, den Meldeknopf auf dem
  Griff und Karte unter der blauen Pille. Ursache: Die Einrückung kommt in
  der abgelegten App als Padding und erst nach dem ersten Layout, und die
  beiden `ResizeObserver` für `--topbar-height` und `--sheet-height`
  beobachteten in der Vorgabe nur die Content-Box. Per CDP
  (`Emulation.setSafeAreaInsetsOverride` nach dem Laden) nachgestellt:
  Kopfzeile 64 → 113 Pixel, Blatt 48 → 82, Variablen unverändert. Seitdem
  `box: 'border-box'`, der Griff färbt die Safe-Area selbst blau, und ein
  Test in `mobile.spec.ts` setzt die Einrückung absichtlich spät.
- Das Melde-Blatt bleibt ohne `inert` und ohne Schleier, weil die Karte
  dahinter auf dem Desktop den Anker setzen darf. Tab kann dort in die Karte
  laufen.
- Auf dem Tablet (768 px) teilten sich Chips, FAB und Quellenangabe die
  untere Kante; mit sieben offenen Chips wurde es eng — gemessen am
  9. September lag der ausgeklappte Quellenstreifen (201 px) über dem
  untersten Chip. Seitdem klappt er unter 960 px Breite von Anfang an zum
  „i" ein, wie auf dem Handy; der Karte bleiben neben der Leiste 372 px,
  und dort ist für alle drei nie Platz. Ein E2E-Test in `mobile.spec.ts`
  hält es fest.
- Das Blatt zeigte beim Aufklappen keinen Vorschauzustand („Peek" mit einer
  Zeile Inhalt); der eingeklappte Griff trug nur die Beschriftung. Seit dem
  9. September steht die Antwort selbst im Griff, siehe Punkt 3 unten.
- Die Bewertungsknöpfe „gesehen / weg" waren auf dem Desktop 26 Pixel hoch —
  bei Maus vertretbar, bei einem Touch-Laptop nicht. Seit dem 9. September
  hängen die Tippflächen an `any-pointer: coarse` statt `pointer: coarse`:
  Ein Laptop mit Touchscreen meldet als primären Zeiger die Maus und fiel
  vorher durch. Mit reiner Maus bleibt alles wie es war.

## Technische Risiken

- **Verlaufseintrag.** `history.back()` nach Knopf-Schliessen ist asynchron;
  öffnet jemand im selben Tick ein anderes Blatt, greift `replaceState`
  statt `pushState`, weil der Eintrag noch da ist — das ist beabsichtigt und
  getestet. Ein Rest bleibt: Wer den Eintrag über „Vor" wieder betritt, sieht
  kein Blatt; der nächste „Zurück" ist dann wirkungslos.
- **`inert`.** React 19 setzt es als boolesches Attribut; ältere Safari (< 15.5)
  ignorieren es, der Dialog bleibt dort wie vorher.
- **`touch-action: none` auf dem Griff.** Nötig für die Geste; ein Scrollen
  der Seite, das am Griff beginnt, gibt es nicht mehr — die Seite scrollt
  ohnehin nicht.
- **`:has()`** versteckt die Quellenangabe hinter dem vollen Blatt; ohne
  Unterstützung steht sie am oberen Rand — sichtbar, nicht kaputt.
- **Gemessene `--sheet-height`.** Der FAB hängt am ResizeObserver des Blatts.
  Verschwindet das Blatt aus dem DOM, bliebe der letzte Wert stehen; es
  verschwindet nie.
- **Bilder.** `public/screenshots/` und `docs/images/` zeigen den alten
  Aufbau, bis sie neu aufgenommen sind; der Weg steht in `todo.md`, Abschnitt 9.

## Empfehlung für den nächsten Schritt

1. Auf einem echten iPhone die Tastatur im Feedback-Blatt prüfen und, falls
   Safari die Variablen verspätet setzt, den Fuss zusätzlich per
   `scrollIntoView` nachziehen.
2. **Erledigt am 9. September.** Der Chip-Zeile einen Kantenverlauf geben,
   sobald sie überläuft (`scrollWidth > clientWidth`), damit „da ist mehr"
   sichtbar ist. Gemessen wird in `App.tsx` (ResizeObserver auf Zeile und
   Chip-Streifen, dazu `scroll`), die Klasse `legend--more` schaltet einen
   `::after`-Verlauf mit `position: sticky`. Beim Bau fiel auf, dass
   `.legend__layers { display: contents }` global **hinter** der Handy-Regel
   stand und sie überschrieb — der Chip-Streifen hatte auf dem Handy nie eine
   eigene Box, und die im Merge eingeführte Berührungsregel dafür war tot.
   Die Regel steht jetzt vor dem Media-Block.
3. **Erledigt am 9. September.** Einen Peek-Zustand für das Blatt: eine Zeile
   mit Zone, Status und Preis im eingeklappten Griff, damit die Antwort ohne
   Aufklappen lesbar ist. Die Wörter kommen aus `zone-label.ts` und den neuen
   `statusLabel`/`costLabel` in `format.ts`, die auch das Panel benutzt;
   laufende Parksitzung und abgelaufene Erinnerung behalten Vorrang. Auf
   320 Pixeln passt „Zone 1 · gebührenpflichtig · 4,00 €/Std." gerade; was
   länger ist, endet mit Auslassungspunkten statt in einer zweiten Zeile.
