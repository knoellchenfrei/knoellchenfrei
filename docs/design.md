# Design-System und Erscheinungsbild

*9. September 2026, nachts. Konzept vor Umsetzung; was hier steht, gilt für
jede neue Oberfläche. Vorbild in Haltung und Aufbau ist FreiFahren, nicht in
der Farbe: FreiFahren ist blau, wir sind Messing auf Nacht.*

## 1. Markenkern

**Knöllchenfrei sagt in einem Blick, ob es hier gerade kostet — und ob das
Ordnungsamt unterwegs ist.** Zwei Fragen, zwei Signale: Messing für „kassiert
gerade", Rot für „Kontrolle". Alles andere ist Nacht und Grau und tritt
zurück. Die App ist ein Werkzeug für den Moment am Bordstein, nicht ein
Dashboard: eine Karte, wenige Knöpfe, kurze Wörter.

Drei Eigenschaften, an denen sich jede Entscheidung messen lässt:

- **Ruhig.** Die Karte trägt die Information; Bedienelemente sind dunkle
  Flächen mit einem Symbol und stehen an festen Orten.
- **Ehrlich.** Was die App nicht weiß, sagt sie („nur dieses Gerät", „kein
  Betrag laut Quelle"). Keine erzeugten Daten, keine dekorativen Zahlen.
- **Wiedererkennbar.** Dieselbe Form an derselben Stelle, in jeder Stadt und
  in jeder Lage des Geräts.

## 2. Formsprache

**Eckig ist die Regel, rund ist die Handlung auf der Karte.** Bis heute
mischte die App Pillen (Griff, Ebenen, Beta, Meldeknopf, Quellenangabe) mit
eckigen Flächen (Zahnrad, Live-Karte, Panels). Ab jetzt:

| Form | Radius | Wofür |
| --- | --- | --- |
| Fläche | 16 px | Blätter, Panels, Karten (Kennzahlen, Meldungen), Menüs |
| Steuerelement | 12 px | Quadratknöpfe (Zahnrad, Ebenen), Suchfeld, Griff, Tabs, Zeilen im Menü |
| Kleinteil | 8 px | Marken (Beta, Status), Eingaben in Blättern, Code |
| Kreis | 50 % | **Nur** die zwei Handlungen auf der Karte: Kontrolle melden, Standort |

Der Kreis ist damit ein Zeichen: Wer einen Kreis sieht, tut etwas *auf der
Karte*. Die einzige Pille, die bleibt, ist ein verblassender Hinweis
(„Meldungen aktualisiert") — sie ist kein Steuerelement, sondern eine
Meldung, und sie geht von selbst.

Quadratknöpfe sind 44 × 44 px (Handy) bzw. 40 × 40 px (Desktop). Die Kreise
sind 56 px (melden) und 48 px (Standort); der größere ist der, den die App
will.

## 3. Farbe

| Token | Wert | Rolle |
| --- | --- | --- |
| `--bg` | `#0f1216` | Nacht: Seite, Blätter |
| `--panel` | `rgba(23, 28, 34, .96)` | Flächen über der Karte |
| `--panel-edge` | `#2a313a` | Kanten, Trennlinien |
| `--text` | `#e8ecf1` | Text |
| `--muted` | `#8b96a5` | Zweitrangiges, Beschriftungen |
| `--accent` | `#2563eb` | Handlung und Ort: Hauptknöpfe, Griff, Standort, Haken |
| `--brass` | Messing | Zone kassiert gerade (Kartenfüllung, Status „gebührenpflichtig") |
| `--danger` / `--danger-strong` | `#ef4444` / `#dc2626` | Kontrolle: Sterne, Punkte und Ränder auf Dunkel / gefüllte Flächen mit weißem Text (Meldeknopf) — der hellere Ton erreicht mit Weiß nur 3,8:1 |
| `--beta` | Bernstein auf Braun | Testbetrieb — verschwindet mit dem Start |

Blau ist **Ort und Handlung** (wo bin ich, was tue ich), Rot ist **Kontrolle**
(was passiert dort draußen), Messing ist **Geld**. Die drei stehen nie
nebeneinander in derselben Rolle. Ebenenfarben (Umweltzone, Ladepunkte,
Carsharing, P+R, Behindertenparkplätze) sind Datenfarben und kommen nur auf
der Karte und im Ebenen-Menü vor.

## 4. Typografie

Systemschrift (`-apple-system, Segoe UI, Roboto, …`), damit die App auf
jedem Gerät wie das Gerät aussieht. Vier Größen reichen:

| Rolle | Größe / Gewicht | Beispiel |
| --- | --- | --- |
| Titel | 19 / 650, `letter-spacing -0.01em` | „Parkzone 1" |
| Zahl | 16–18 / 700, `font-variant-numeric: tabular-nums` | „4,00 €/Std." |
| Text | 13–14 / 400 | Erklärungen |
| Beschriftung | 10,5 / 600, Versalien, `letter-spacing .06em` | „TARIF", „MITTE" |

Eingaben sind auf dem Handy nie unter 16 px — sonst zoomt iOS hinein.

## 5. Symbole

**Lucide** (ISC-Lizenz, `lucide-react`), 20 px Strich 1,75 in Knöpfen, 16 px in
Zeilen. Keine Emoji, keine Unicode-Zeichen als Symbol (bis heute: ⚙ ☰ × ◎
⚠ ★). Das GitHub-Zeichen kommt als Pfad von Simple Icons (CC0). Eine
Zuordnung, damit dasselbe Ding überall dasselbe Symbol trägt:

| Bedeutung | Symbol |
| --- | --- |
| Einstellungen | `Settings` |
| Ebenen | `Layers` |
| Suche | `Search` |
| Kontrolle melden | `Plus` (im roten Kreis) |
| Mein Standort | `LocateFixed` |
| Meldungen | `Megaphone` |
| Gerade offen | `Radio` (mit Lebendpunkt) |
| Geräte | `Users` |
| Statistik | `ChartColumn` |
| Aktualisiert | `RefreshCw` |
| Gesehen / weg | `Eye` / `EyeOff` |
| Stern (Konfidenz) | `Star`, gefüllt |
| Blatt auf / zu | `ChevronUp` / `ChevronDown` |
| Warnung | `TriangleAlert` |
| Zeit | `Clock` |
| Quellen / Code | MapLibres „i", GitHub-Zeichen |

Warum ein Plus für „Kontrolle melden" und kein Blaulicht: Das Plus ist das
Zeichen für „ich füge etwas hinzu", und genau das tut der Knopf — es ist bei
FreiFahren dasselbe, und wer von dort kommt, versteht es sofort. Ein Blaulicht
oder Auge sähe nach „hier ist Kontrolle" aus, also nach Anzeige statt
Handlung. Die Farbe trägt die Bedeutung: Rot ist Kontrolle.

## 6. Abstände und Ebenen

Raster 4 px; Ränder zur Karte 12 px (Handy) und 16 px (Desktop); zwischen
Steuerelementen 8 px. Safe-Areas kommen als Padding auf die äußeren Behälter,
nie auf die Elemente.

Stapelreihenfolge, fest: Karte 0 · Marker 1 · Karten-Overlays 3 · Blatt 3 ·
Kopfzeile und Kreise 4 · Quellenangabe 5 · offenes Menü 6 · Hinweise 7 ·
Blätter/Dialoge 20.

## 7. Bausteine

- **Suchfeld.** Volle Breite, 48 px, Lupe links, Platzhalter „Zone, Bezirk
  oder Straße". Treffer als Liste darunter, gruppiert: erst Zonen und
  Bezirke (vom Gerät), dann Straßen (aus Photon, erst ab drei Zeichen).
- **Quadratknopf.** 44 px, ein Symbol, `aria-label`. Zahnrad rechts neben
  der Suche, Ebenen darunter am rechten Rand. Das Ebenen-Menü öffnet nach
  unten links, an den Knopf angehängt.
- **Kennzahlen-Leiste.** Volle Breite bis zum Ebenen-Knopf, drei Zellen mit
  Symbol, Zahl und Wort (Meldungen heute · gerade offen · Geräte heute). Ein
  Link zur Statistikseite — die ganze Leiste ist die Fläche.
- **Meldungen-Karte.** Unten links: Kopf „Meldungen · N aktiv", darunter bis
  zu drei Zeilen (Zone, vor x Min, Sterne). Tipp öffnet das Meldungen-Blatt
  mit drei Tabs: *Aktuell* (Liste mit gesehen/weg), *Zonen* (am häufigsten
  kontrolliert, 28 Tage), *Tageszeiten* (Tagesgang und Wochentage). Was
  vorher im Detail-Blatt stand („Gemeldete Sichtungen", „Kontrolldichte"),
  steht jetzt hier.
- **Kreise.** Rechts unten, übereinander: oben Rot mit Plus (melden), darunter
  Blau mit Fadenkreuz (Standort). Beide über dem Griff, beide wandern mit dem
  Blatt.
- **Griff.** Volle Breite, 12 px Radius oben, **immer blau**: „Details
  einblenden" mit Chevron nach oben, „Ausblenden" mit Chevron nach unten.
  Zustände: zu · halb · voll. Wischen nach oben eine Stufe hoch, nach unten
  eine Stufe runter; Tipp auf „Ausblenden" eine Stufe runter. Übergänge nur
  über animierbare Werte — die Sprünge vom 9. September kamen von
  `max-height: none`.
- **Detail-Blatt.** Zone: Bezirk, Titel, Status-Marke; Tarif, Frist,
  Stellplätze; „Eine Stunde ab jetzt"; **Kontrollen hier** (heute · 7 Tage ·
  28 Tage, zuletzt vor x Min, sieben Tagesbalken) — die Zonenstatistik wie
  FreiFahrens Stationsblatt; „Hier geparkt"; Zeiten laut Quelle.
- **Hinweise.** Verblassende Pille oben Mitte unter der Leiste: beim Start
  „N Meldungen in 28 Tagen in Berlin" (Tipp führt zur Statistik, geht nach
  6 s), nach jedem Abruf „Meldungen aktualisiert" mit Drehpfeil (3 s).
- **Quellen.** Unten links, 24 px: MapLibres „i" (klappt die Attribution
  auf) und daneben das GitHub-Zeichen als Link zum Repository.

## 8. Layouts

**Hochformat (Handy).** Kopf: Suche + Zahnrad. Zeile 2: Kennzahlen-Leiste +
Ebenen-Knopf. Unten: links Meldungen-Karte, darunter die Quellen; rechts die
zwei Kreise; ganz unten der Griff. Das Blatt schiebt sich über Karte und
Meldungen-Karte, die Kreise wandern mit; die Meldungen-Karte verschwindet,
solange das Blatt offen ist — auf 320 × 568 stand sie sonst bis an die
Kennzahlen-Leiste heran.

**Querformat (Handy).** Drei Spalten: Leiste links (Suche, Kennzahlen,
Meldungen-Karte), Karte, Blatt rechts als Spalte. Zahnrad und Ebenen stehen
in der Leiste rechts neben der Suche; die Kreise unten links vom Blatt;
Quellen unten links.

**Desktop.** Kopf links (400 px), Blatt rechts als Spalte (380 px), Kreise
unten links vom Blatt, Meldungen-Karte unten links, Quellen daneben.

## 9. Bewegung

220 ms `ease` für Lage und Höhe, 160 ms für Deckkraft. Ein verblassender
Hinweis erscheint sofort und geht in 400 ms. `prefers-reduced-motion`
schaltet alles auf 0,01 ms. Nichts pulsiert außer dem Lebendpunkt.

## 10. Daten, die sich bewegen

Meldungen werden alle 45 Sekunden abgerufen und ohne Neuladen gezeichnet
(seit dem 6. September so); neu ist, dass die App es sagt. Der Hinweis
erscheint nur nach einem **erfolgreichen** Abruf — ein gescheiterter lässt
die alten Daten stehen und schweigt, wie bisher.

## 11. Was bewusst anders ist als bei FreiFahren

- **Rot statt Blau für den Meldeknopf.** FreiFahrens Plus ist blau, weil dort
  alles blau ist. Bei uns ist Blau der Ort; Rot ist die Kontrolle, und der
  Knopf meldet eine Kontrolle.
- **Keine Risikokarte als Ebene.** Die Kontrolldichte liegt, sobald sie ein
  Muster hat, und ist nichts, was jemand abschaltet (Betreiber, 9. September).
- **Beta-Marke.** Solange der Riegel steht, sagt die Kopfzeile es.
