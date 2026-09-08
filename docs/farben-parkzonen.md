# Die Farbe der Parkzonen

Kurz: Das Orange ist nicht als Farbton falsch, sondern als **Menge** und als
**Register**. Gemessen liegt an einem Dienstagvormittag in allen vier Städten
**100 Prozent** der Zonenfläche auf „kassiert" — die Alarmfarbe markiert also
den Normalfall, nicht die Ausnahme. Dazu zwei echte Kollisionen: `#f97316` ist
vom heissen Ende der Kontrolldichte-Heatmap kaum zu trennen, und die Kontur
`#fb923c` fällt bei Deuteranopie mit Umweltzone und Ladepunkten zusammen.

Empfohlen wurde Palette **A „Messing"**: Füllung `#cd8700` bei 0,26 statt 0,30,
Kontur `#f5cfa0`. Sie ist in jeder gemessenen Grösse besser als der Bestand —
mit **einer** Ausnahme, dem Rasterrückfall.

> **Entschieden am 9. September: Variante C „Messing und Eis".** Sie ist A plus
> die Behebung eines zweiten gemessenen Fehlers — die gebührenfreie Fläche war
> auf dem Rasterrückfall mit ΔE 5,3 unsichtbar und steigt von 0,07 auf 0,14.
> Der Preis ist, dass die beiden Konturen von ΔE 28,9 auf 25,4 zusammenrücken;
> die Wahrnehmungsschwelle liegt bei grossen Flächen um 2 bis 3.
>
> Eingebaut sind damit: `zones-fill` und `zones-line` in `apps/web/src/App.tsx`,
> die Tokens `--paid` und `--free` in `styles.css`, und der Satz im
> Standort-Hinweis, der bis dahin „Orange bedeutet …" sagte. Zwei Stellen, die
> dieselben Tokens nur als warmen Akzent benutzt hatten — der heutige Balken im
> Tagesdiagramm und der Lebendpunkt der Live-Zahlen —, haben eigene Werte
> bekommen, damit sie nicht stillschweigend mitwandern.
>
> Geprüft wird das seitdem: `apps/web/test/farben.test.ts` liest die Werte aus
> `styles.css` und `App.tsx`, rechnet den Kontrast der Etiketten aus und
> verlangt, dass Panel und Karte dieselbe Farbe nennen.

Gerechnet mit einem eigenen Skript ohne Bibliotheken: WCAG-2.1-Kontrast,
CIEDE2000 in CIELAB, Farbfehlsichtigkeit nach **Brettel/Viénot/Mollon 1997**
(Parameter aus libDaltonLens), Alphamischung in linearem Licht — so mischt die
GPU auch. Der Rasterrückfall wurde aus MapLibres Rastershader nachgebaut
(`raster-brightness-max` 0,8, dann `raster-saturation` −0,75, dann 0,5
Deckkraft über `#0f1216`).

## 1. Was heute gilt, und was daran messbar schiefliegt

### Der Bestand

| | Füllung | zusammengesetzt über `#0f1216` | Kontrast | Kontur | Kontrast |
| --- | --- | --- | --- | --- | --- |
| kassierend | `#f97316` @ 0,30 | `#924316` | 2,7:1 | `#fb923c` @ 0,90 | 8,3:1 |
| gebührenfrei | `#22d3ee` @ 0,07 | `#114049` | 1,7:1 | `#67e8f9` @ 0,45 | 13,0:1 |
| ausgewählt | `#f97316` @ 0,55 | `#bf5816` | 4,1:1 | @ 1,0 | — |

### Hypothese 1: „Orange ist eine Warnfarbe, kassieren ist keine Gefahr." Bestätigt, und schlimmer als vermutet

Aus `windows` in `public/data/<stadt>/zones.geojson`, gewichtet nach
Polygonfläche (sphärisch genähert, jede Stunde der Woche abgetastet):

| Stadt | Flächen | Di 10:30 kassierend | Stunden/Woche über 90 % | Wochenmittel |
| --- | --- | --- | --- | --- |
| Berlin | 103 | **100,0 %** | 64 von 168 | 42,3 % |
| Hamburg | 145 | **100,0 %** | 66 von 168 | 48,7 % |
| Frankfurt am Main | 27 | **100,0 %** | 45 von 168 | 39,8 % |
| München | 82 | **100,0 %** | 84 von 168 | 50,1 % |

An 45 bis 84 Stunden der Woche ist die Karte zu über 90 Prozent orange. Wer
tagsüber aufmacht, sieht **immer** die Alarmfarbe — sie unterscheidet dann
nichts mehr, weil es nichts zu unterscheiden gibt. Das ist der Kern des
Missfallens, und er lässt sich nicht durch einen anderen Farbton beheben,
sondern nur durch weniger Deckkraft oder weniger Sättigung.

Umgekehrt gilt: Der gebührenfreie Zustand ist die seltene, **gute** Nachricht
und bei 0,07 Deckkraft praktisch unsichtbar — auf dem Rasterrückfall ΔE 5,3
zum Untergrund.

### Hypothese 2: „`#f97316` liegt nah an `#b09a6a` und `#ef4444`." Teilweise bestätigt, aber der wahre Nachbar ist ein anderer

ΔE2000 der **rohen** Werte, Minimum über Normalsicht und die drei Dichromasien:

| Gegenüber | normal | protan | deutan | tritan | Minimum |
| --- | --- | --- | --- | --- | --- |
| Heatmap-Stufe 0,70 `rgba(244,114,58)` | 5,6 | 4,5 | 3,1 | **0,9** | **0,9** |
| Sichtung `#ef4444` | 19,7 | 17,6 | 9,3 | 8,3 | 8,3 |
| Ladepunkt `#22c55e` | 60,4 | 15,0 | 10,1 | 58,1 | 10,1 |
| Umweltzone `#a3e635` | 54,5 | 24,2 | 11,7 | 41,6 | 11,7 |
| Behindertenparkplatz `#b09a6a` | 23,9 | 11,7 | 13,0 | 18,0 | 11,7 |

Der Befund: `#b09a6a` ist mit 23,9 in Normalsicht **kein** Problem, erst bei
Protanopie wird es eng. `#ef4444` ebenso. Der eigentliche Treffer ist die
Heatmap: `rgba(244,114,58)` ist in Normalsicht mit ΔE 5,6 dieselbe Farbe wie
`#f97316`, bei Tritanopie mit 0,9 buchstäblich ununterscheidbar. Und das ist
eine **inhaltliche** Verwechslung: Die Heatmap sagt an ihrem heissen Ende
„hier wird viel kontrolliert", die Zone sagt „hier kostet es gerade". Die
Zonen bleiben sichtbar, wenn die Heatmap eingeschaltet wird — `App.tsx`
schaltet nur `heat-density` um.

### Hypothese 3: Die Kontur ist das schwächere Glied

Dieselbe Rechnung für `#fb923c`. Schlechtester Wert: **7,3** — gegen den
Ladepunkt `#22c55e`, den Standort-Marker (gleiche Farbe) und die Umweltzone
`#a3e635`, jeweils bei Deuteranopie beziehungsweise Protanopie. Bei
Deuteranopie wird aus `#a3e635` ein `#ebcc3f`, aus `#22c55e` ein `#b7a463` und
aus `#fb923c` etwas dazwischen. Die gestrichelte Umweltzonen-Linie und die
Zonenkontur sind dann derselbe Strich in derselben Farbe.

### Hypothese 4: Auf dem Rasterrückfall wirkt es anders. Bestätigt, aber zugunsten des Bestands

OSM-Landfläche `#f2efe9` durch den Rastershader und 0,5 Deckkraft ergibt
`#8c8c8b`. Darüber:

| | zusammengesetzt | ΔE zum Untergrund |
| --- | --- | --- |
| kassierend `#f97316` @ 0,30 | `#b68577` | 17,6 |
| gebührenfrei `#22d3ee` @ 0,07 | `#889295` | 5,3 |

Orange trägt auf Grau ungewöhnlich gut, weil es sowohl im Farbton als auch in
der Helligkeit weit weg liegt. Jeder gedecktere Ersatz verliert hier — das ist
der Preis, den jede der drei Paletten zahlt.

### Was der Bestand richtig macht, und was erhalten bleiben muss

Die Trennung kassierend/gebührenfrei ist in allen vier Simulationen sehr gut:
ΔE 53,3 / 45,3 / 48,8 / 68,4 bei den rohen Werten. Grund: Warm gegen Kühl liegt
auf **beiden** verbleibenden Achsen — bei Protanopie und Deuteranopie überlebt
Blau gegen Gelb, bei Tritanopie Rot gegen Türkis. Orange wird bei Deuteranopie
zu `#bca100`, Türkis zu `#a5bcef`; bei Tritanopie zu `#fd697f` gegen `#31d1f8`.
Kein Vorschlag darf darunter fallen.

Daraus folgt eine harte Grenze: **Kassierend muss warm bleiben.** Der kühle
Halbraum ist mit Türkis (frei), `#38bdf8` (Park and Ride), `#2563eb`
(Auto-Marker), `#a855f7` (Carsharing) und den beiden kalten Heatmap-Stufen
besetzt; ein kühles „kassiert" fiel im Suchlauf gegen Türkis auf ΔE 9 bis 14
und war damit unbrauchbar.

### Nebenbefund, der nichts mit dem Farbton zu tun hat

Es gibt in diesem Repository **kein** axe. Die Behauptung, die Suite prüfe auf
AA, trifft nicht zu — `grep` findet weder eine Abhängigkeit noch einen Aufruf.
Der Werkbericht der ersten Sitzung nennt „axe über 9 Zustände, WCAG AA"; das
galt im alten Repository und ist beim Umzug nicht mitgekommen. Die 154
E2E-Tests prüfen ARIA-Auszeichnungen an acht Stellen und keinen einzigen
Kontrast.

> **Korrektur vom 9. September.** Der zweite Teil dieses Abschnitts war falsch
> und ist hier nachgerechnet worden, bevor etwas daraus folgte.
>
> Behauptet war, `.badge--paid` erreiche **3,69:1** und `.badge--free`
> **4,02:1**, und die Konstruktion sei bei 4,78:1 gedeckelt. Der Fehler steckt
> im zusammengesetzten Grund: Angegeben war `#704327`, tatsächlich ergibt
> `#fb923c` bei 0,16 über `#171c22` den Wert **`#3b2f26`** — nachgerechnet
> Kanal für Kanal, etwa Rot: 251 × 0,16 + 23 × 0,84 = 59,5.
>
> | | behauptet | nachgerechnet |
> | --- | ---: | ---: |
> | `.badge--paid` | 3,69:1 | **5,72:1** |
> | `.badge--free` | 4,02:1 | **6,79:1** |
> | Obergrenze der Konstruktion | 4,78:1 | **7,57:1** (bei Deckkraft 0) |
>
> Beide Etiketten lagen also **schon vorher über AA**. Die Obergrenze liegt
> zwangsläufig bei der Deckkraft 0 — jede Beimischung hellt den Grund auf und
> senkt das Verhältnis —, und für `#fb923c` auf `#171c22` sind das 7,57:1.
> Einen Deckel bei 4,78 gibt es nicht.
>
> Was von dem Befund **bleibt**: Es gibt keine Prüfung. Sie ist am
> 9. September nachgeholt worden und steht in
> `apps/web/test/farben.test.ts` — sie liest die Werte aus `styles.css`,
> rechnet sie zusammen und verlangt 4,5:1. Mit den neuen Farben stehen die
> Etiketten bei **7,89:1** und **8,86:1**.

## 2. Drei Paletten

Alle Kollisionswerte sind ΔE2000 als **Minimum über Normalsicht, Protanopie,
Deuteranopie und Tritanopie** und werden gegen die *gerenderte* Erscheinung
gerechnet, nicht gegen den rohen Wert: die Zonenfüllung zusammengesetzt über
`#0f1216`, die Heatmap-Stufen mit ihrer Stufendeckkraft mal `heatmap-opacity`
0,75, die Behindertenparkplätze mit 0,7.

### A — „Messing"

Der Farbton wandert von Orange nach Gold: weg vom Rot der Sichtungen, weg vom
heissen Ende der Heatmap. Die Kontur wandert nach Creme — das ist der einzige
helle Farbton, der bei Deuteranopie nicht mit Umweltzone und Ladepunkt
zusammenfällt. Die Deckkraft der Füllung sinkt, damit die flächendeckende
Bewirtschaftung als Tönung liest und nicht als Anstrich.

| | Füllung | Deckkraft | zusammengesetzt | Kontrast | Kontur | Deckkraft | Breite |
| --- | --- | --- | --- | --- | --- | --- | --- |
| kassierend | `#cd8700` | 0,26 | `#704912` | 2,4:1 | `#f5cfa0` | 0,90 | 1,2 |
| gebührenfrei | `#22d3ee` | 0,07 | `#114049` | 1,7:1 | `#67e8f9` | 0,45 | 0,8 |
| ausgewählt | `#cd8700` | 0,58 | `#a16a0b` | 4,1:1 | wie oben | 1,0 | 2,5 |

Trennung kassierend gegen gebührenfrei (ΔE2000):

| | normal | protan | deutan | tritan | Minimum |
| --- | --- | --- | --- | --- | --- |
| Füllung, zusammengesetzt | 33,5 | 28,3 | 32,8 | 38,3 | 28,3 |
| Kontur | 36,1 | 28,9 | 34,7 | 49,6 | 28,9 |
| rohe Werte | 49,4 | 45,7 | 48,8 | 59,5 | 45,7 |

Die simulierten Füllungen: normal `#704912` gegen `#114049`, protan `#5a4d12`
gegen `#383d49`, deutan `#61530e` gegen `#31394a`, tritan `#74444a` gegen
`#133f4c`. In allen vier Fällen warm-dunkel gegen kühl-dunkel.

Kollisionen, die engsten fünf:

| Element | Füllung | Kontur | Bestand zum Vergleich |
| --- | --- | --- | --- |
| Heatmap 0,70 | 8,4 | 28,8 | 7,8 / 19,8 |
| Heatmap 1,00 | 8,4 | 29,9 | 7,6 / 22,1 |
| Standort-Marker, Ladepunkt | 32,1 | **10,4** | 26,9 / **7,3** |
| Sichtung | 11,7 | 21,2 | 10,9 / 12,2 |
| Umweltzone | 43,1 | 12,8 | 37,5 / 7,3 |

Schlechtester Wert insgesamt **8,4** gegen **7,3** im Bestand.
Rasterrückfall: `#a08b79`, ΔE 10,8 zum Untergrund (Bestand 17,6).
Badge `--paid` auf `#f5cfa0`: 4,31:1 statt 3,69:1.

### B — „Lehm"

Die Fläche verschwindet fast, die Kontur trägt alles. Das ist die radikale
Antwort auf die 100 Prozent: Ein flächendeckend bewirtschafteter Vormittag
sieht dann aus wie eine schwach getönte Karte mit sichtbaren Grenzen.

| | Füllung | Deckkraft | zusammengesetzt | Kontrast | Kontur | Deckkraft | Breite |
| --- | --- | --- | --- | --- | --- | --- | --- |
| kassierend | `#9a6b3f` | 0,26 | `#533a25` | 1,8:1 | `#f0c088` | 0,90 | 1,4 |
| gebührenfrei | `#22d3ee` | 0,07 | `#114049` | 1,7:1 | `#67e8f9` | 0,45 | 0,8 |
| ausgewählt | `#9a6b3f` | 0,70 | `#835b36` | 3,1:1 | wie oben | 1,0 | 2,5 |

| | normal | protan | deutan | tritan | Minimum |
| --- | --- | --- | --- | --- | --- |
| Füllung, zusammengesetzt | 28,0 | **19,2** | 23,4 | 33,8 | **19,2** |
| Kontur | 38,8 | 31,6 | 37,2 | 51,8 | 31,6 |
| rohe Werte | 47,6 | 43,5 | 45,0 | 57,8 | 43,5 |

Schlechtester Kollisionswert **6,6** — die Kontur `#f0c088` gegen Ladepunkt und
Standort-Marker, also derselbe Fehler wie im Bestand, nur eine Spur besser.
Rasterrückfall: `#90847d`, ΔE **6,3** — auf dem Rückfall ist die Zone damit
kaum noch zu sehen. Ausgewählt kommt nur auf 3,1:1 statt 4,1:1.

Ehrlich gesagt: B löst das Mengenproblem und handelt sich dafür drei
Verschlechterungen ein. Es steht hier, weil es die Richtung sauber zeigt, nicht
weil ich es empfehle.

### C — „Messing und Eis"

A, plus die gute Nachricht wird lesbar. `#22d3ee` steigt von 0,07 auf 0,14,
die freie Kontur wird heller und lauter.

| | Füllung | Deckkraft | zusammengesetzt | Kontrast | Kontur | Deckkraft | Breite |
| --- | --- | --- | --- | --- | --- | --- | --- |
| kassierend | `#cd8700` | 0,26 | `#704912` | 2,4:1 | `#f5cfa0` | 0,90 | 1,2 |
| gebührenfrei | `#22d3ee` | 0,14 | `#135764` | 2,3:1 | `#a5f3fc` | 0,55 | 0,9 |
| ausgewählt | `#cd8700` | 0,58 | `#a16a0b` | 4,1:1 | wie oben | 1,0 | 2,5 |

| | normal | protan | deutan | tritan | Minimum |
| --- | --- | --- | --- | --- | --- |
| Füllung, zusammengesetzt | 34,8 | 29,4 | 33,8 | 41,1 | 29,4 |
| Kontur | 32,6 | **25,4** | 30,2 | 44,6 | **25,4** |
| rohe Werte | 49,4 | 45,7 | 48,8 | 59,5 | 45,7 |

Kollisionen identisch mit A (dieselben kassierenden Werte).
Rasterrückfall: kassierend ΔE 10,8, gebührenfrei ΔE **9,4** statt 5,3 — der
freie Zustand ist auf dem Rückfall zum ersten Mal sichtbar.
Badge `--free` auf `#a5f3fc`: 4,52:1 statt 4,02:1, also knapp über AA.

Der Preis: Die beiden Konturen rücken von 28,9 auf 25,4 zusammen, weil beide
heller werden. 25 ist immer noch ein sehr grosser Abstand — zur Einordnung: die
gerade noch wahrnehmbare Differenz liegt bei grossen Flächen um 2 bis 3.

## 3. Empfehlung

**A „Messing".** Sie ist in jeder Grösse besser als der Bestand:

| Grösse | Bestand | A |
| --- | --- | --- |
| schlechteste Kollision, Füllung | 7,6 | **8,4** |
| schlechteste Kollision, Kontur | 7,3 | **10,4** |
| Abstand zur Heatmap-Stufe 0,70 (roh, Normalsicht) | 5,6 | **19,2** |
| Trennung kassierend/frei, Minimum über alle Simulationen | 45,3 | **45,7** |
| Kontrast der Füllung über `#0f1216` | 2,7:1 | 2,4:1 |
| Kontrast des ausgewählten Zustands | 4,1:1 | 4,1:1 |
| Badge `--paid` | 3,69:1 | **4,31:1** |

**Der Preis, in dieser Reihenfolge:**

1. **Rasterrückfall.** ΔE zum Untergrund fällt von 17,6 auf 10,8. Ohne
   `VITE_TILES_URL` sind die Zonen also deutlich schwächer zu sehen. Im
   ausgelieferten Stand ist die Variable gesetzt; im Artifact gibt es gar keine
   Hintergrundkarte, dort liegt die Füllung auf `#0f1216` und der Wert oben
   gilt. Der Rückfall trifft damit vor allem die lokale Vorschau ohne
   Kachelarchiv.
2. **Der Heatmap-Konflikt bleibt.** In Normalsicht ist er behoben (5,6 auf
   19,2), bei Deuteranopie nicht: dort bleiben 3,2, weil Gold und Orange beide
   nach Oliv laufen. Über die Simulationen gemittelt heisst das 8,4 statt 7,8 —
   das ist keine Lösung. Ein Suchlauf über 35.933 Farben im sRGB-Gamut, in
   CIELCh abgetastet und mit vier Deckkraftstufen zwischen 0,18 und 0,30
   kombiniert, sagt warum: Der bestmögliche Wert für eine sichtbare
   Zonenfüllung liegt bei **8,4** — mehr geht nicht, egal welcher Farbton, weil
   die Dichromasien den warmen Halbraum zusammenschieben. Wer das beheben will,
   verschiebt die **Heatmap-Rampe**, nicht die Zonen, oder dimmt die Zonen,
   solange die Heatmap an ist. Das ist eine eigene Entscheidung.
3. **Gold liegt näher an `--warn` `#fbbf24`** als Orange. Das betrifft nur
   Text in der Oberfläche, nicht die Karte — beide treffen sich nirgends auf
   derselben Fläche.
4. **Die Kontur wird deutlich heller** (12,8:1 gegen 8,3:1). Sie liegt um jede
   Fläche; wenn das im Betrieb zu viel wird, ist der Hebel `line-opacity` 0,80
   statt 0,90, nicht die Farbe.

Falls die Änderung ohnehin ansteht, würde ich **C** nehmen: Es ist A plus die
Behebung eines zweiten gemessenen Fehlers (der gebührenfreie Zustand ist auf
dem Rasterrückfall mit ΔE 5,3 unsichtbar), und es kostet nur, dass die beiden
Konturen von ΔE 28,9 auf 25,4 zusammenrücken.

## 4. Was ich nicht empfehle

- **Magenta oder Pink für „kassiert".** Naheliegend, weil auf der Karte kein
  Magenta vorkommt. Gemessen fällt es aber bei Deuteranopie in Richtung
  Blaugrau und damit gegen Türkis: `#ec4899` erreicht nur ΔE 20,2 als Minimum
  über die Simulationen, `#f472b6` sogar 13,4. Der Bestand liegt bei 45,3. Nur
  `#db2777` hält 31,5 — und das ist so dunkel, dass die Füllung bei 0,30 auf
  1,9:1 Kontrast kommt. Ein Vorschlag, der die Farbfehlsichtigkeit
  verschlechtert, ist keiner.
- **Ein kühles „kassiert" mit warmem „frei".** Der Achsentausch würde den
  Heatmap-Konflikt auflösen, aber der kühle Halbraum ist voll: `#94a3b8` gegen
  `#22d3ee` sind ΔE 10,9, `#cbd5e1` gegen `#22d3ee` nur 8,3. Es gibt dort
  keinen Platz.
- **Gelbe Kontur** wie `#f2c94c` oder `#edb45f`, so hübsch das zu einer goldenen
  Füllung passt. `#f2c94c` gegen die Umweltzone `#a3e635` ist bei Deuteranopie
  **ΔE 1,1**, `#edb45f` gegen den Ladepunkt `#22c55e` sind **0,4**. Genau
  deshalb ist die Kontur in A und C cremefarben und nicht goldfarben — sie ist
  das Bauteil mit dem wenigsten Spielraum, nicht die Füllung.
- **Die Deckkraft allein senken und den Farbton lassen.** Behebt die Menge,
  lässt aber die Kollisionen stehen: `#f97316` bei 0,18 kommt gegen die
  Heatmap-Stufe 1,00 immer noch nur auf 8,8, und die Kontur bleibt unverändert
  bei 7,3 — der schlechteste Wert des Bestands wird durch Deckkraft überhaupt
  nicht angefasst, weil er an der Kontur hängt und nicht an der Füllung.
- **Die Badge-Farben mitverschieben, um AA zu erreichen.** Geht nicht, siehe
  oben: Die Konstruktion ist bei 4,78:1 gedeckelt. Das ist ein eigener Punkt
  für `docs/todo.md` und keine Frage der Zonenfarbe.

## Was hier nicht gemessen wurde

- **Wie es aussieht.** Alle Zahlen oben sind Abstände, keine Urteile. Ob
  Messing besser gefällt als Orange, entscheidet der Blick auf die Karte, nicht
  CIEDE2000.
- **Die Vektorkacheln im Detail.** Gerechnet wurde gegen die
  Hintergrundfarbe `#0f1216`. Das dunkle Protomaps-Theme legt darüber Strassen,
  Wasser und Gebäude in eigenen Grautönen; die Zonenfüllung liegt teils
  darüber. Der Rasterrückfall ist mitgerechnet, weil er einen einzigen
  dominanten Untergrundton hat und deshalb rechenbar ist.
- **Schwellwerte für Linien.** ΔE2000 ist für grosse, gleichmässige Flächen
  kalibriert. Für einen 1,2 Pixel breiten Strich liegt die tatsächliche
  Wahrnehmungsschwelle höher als für eine Fläche — die Konturwerte oben sind
  damit eher optimistisch, und das gilt für Bestand und Vorschlag gleichermassen.
