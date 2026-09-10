# Ideen: was wir noch bauen sollten

Entstanden am 7. September 2026 auf die Frage des Betreibers, was bisher
niemand aufgeschrieben hat; **11 bis 13 kamen in der Nacht zum 8. September
dazu** und stammen nicht aus einem Brainstorming, sondern aus Fehlern — jede
davon ist die Verallgemeinerung eines Befunds, siehe
[nachtplan-2026-09-08.md](nachtplan-2026-09-08.md). **Nichts davon ist entschieden** — das steht in
[entscheidungen.md](entscheidungen.md) —, und nichts davon ist geplant; die
verbindliche Liste ist [todo.md](todo.md).

Sortiert nach dem, was jemandem am Straßenrand hilft, nicht nach Aufwand. Zu
jedem Punkt steht, was schon da ist: Das meiste braucht **keine** neue
Datenquelle.

## 1. Die Straße statt der Zone — **die größte ungenutzte Reserve**

Der Datenbau lädt **45.917 Straßenabschnitte** und wirft sie danach weg: Er
rechnet sie zu Zonenwerten zusammen (`spaces`, `maxStay`, `chargingPoints`) und
liefert die Abschnitte selbst nie aus. Jeder trägt aber
`strassenname`, `parkgebuehr`, `bewirtschaftungszeit`, `hoechstparkdauer`,
`errechnete_anzahl_parkplaetze`, `ausrichtung`, `parkort` und
`nur_schwerbehinderte`.

Damit ginge dreierlei, ohne eine einzige neue Quelle:

- **„Auf dieser Straße"** statt „in dieser Zone". Die Zone sagt 2–4 €;
  der Abschnitt sagt, was hier gilt. Das ist genau der Unterschied, vor dem die
  App heute mit „kann abschnittsweise abweichen" warnt.
- **Straßensuche ohne fremden Dienst.** Adresssuche bräuchte Nominatim — ein
  weiterer Empfänger in der Datenschutzerklärung. Straßen**namen** haben wir
  schon. „Torstraße" zu tippen ist für die meisten näher an dem, was sie
  wollen, als „Zone 34".
- **Der Widerspruch wird sichtbar.** 421 Abschnitte tragen eine Gebühr und
  liegen in keiner Zone. Mit der Abschnittsebene beantwortet die App dort die
  Frage, statt zu schweigen.

Der Preis: 50 MB roh. Zu klären ist die Auslieferung — als eigenes
PMTiles-Archiv (dieselbe Machart wie die Basiskarte, Range-Requests, nur der
sichtbare Ausschnitt) statt als GeoJSON im Bündel.

## 2. Push — der Unterschied zwischen nett und benutzbar

Zwei Funktionen hängen heute daran, dass die Seite **offen** bleibt:

- **Die Parkuhr.** „Erinnerung in 30 Minuten" gilt nur, solange der Tab lebt.
  Wer das Handy einsteckt, bekommt nichts. Das ist die Funktion, die Leute
  wollen, und sie ist zu 90 % gebaut.
- **Sichtungen in meiner Zone.** Der eigentliche Zweck des Projekts, und
  FreiFahrens stärkstes Merkmal. Heute muss man hinsehen.

Der Weg ist Web Push mit VAPID; der Worker kann das, der Service Worker ist da,
`Notification.permission` wird schon abgefragt. Zu klären: Ein Push-Abo ist ein
Gerätemerkmal mit langer Lebensdauer — es gehört in die Datenschutzerklärung
und braucht eine Einwilligung, die diesen Namen verdient.

## 3. Zeitregler — „wie sieht es um 20 Uhr aus?"

Die Karte zeigt **jetzt**. Die häufigste Frage vor dem Losfahren ist aber „wie
ist es, wenn ich ankomme" und „ab wann ist es frei". Alles dafür ist da:
`isChargeable(zone, zeitpunkt)` nimmt bereits einen Zeitpunkt entgegen — es
fehlt ein Schieberegler, der ihn setzt, und die Karte färbt sich mit.

Billigste große Wirkung im ganzen Katalog.

## 4. Teilbare Zonen

Es gibt keinen Weg, auf eine Zone zu zeigen. `?start=melden` und
`?start=kontrollen` gibt es schon — `?zone=34` wäre dieselbe Machart und macht
die App in Telegram, in einer Nachricht, in einem Forum zitierbar.

## 5. Höchstparkdauer als Wecker

Die App kennt die Höchstparkdauer und zeigt sie an. Die Uhr erinnert an die
**Kosten**, nicht an die **Pflicht**. Zwei Stunden in einer 1-Stunden-Zone sind
teurer als jede Gebühr.

## 6. Der Bot kann nur reden, nicht antworten

`@knoellchen_bot` nimmt Meldungen entgegen. Er könnte auf eine geschickte
Position mit Zone, Tarif und Reststunde antworten — dieselbe Rechnung, die die
App macht, über einen Kanal, den Leute ohnehin offen haben. Der Parser dafür
steht.

## 7. Feiertagsvorschau

`holidaysFor` weiß es, die Oberfläche sagt es nur am Tag selbst. „Morgen ist
Feiertag — dann ist Parken frei" ist ein Satz, der Geld spart und einen
Einzeiler kostet.

## 8. Bewohnerparkausweis merken

Wer einen hat, zahlt in **seiner** Zone nichts. Die App weiß, in welcher Zone
jemand steht, und sagt trotzdem allen dasselbe. Eine Einstellung „meine Zone",
lokal gespeichert, und die Auskunft wird für die halbe Stadt eine andere.

## 9. Die Langzeitzähler als offener Datensatz

Die Kontrolldichte ist etwas, das es sonst nirgends gibt — aggregiert, ohne
Personenbezug. Seit dem 10. September ist der bessere Kandidat dafür die
Langzeittabelle (`kontrollen_langzeit`: Zone, Wochentag, Stunde, Quartal,
Zähler), nicht die 28-Tage-Strichliste mit ihren Zellen und Daten: Sie zu
veröffentlichen (CSV unter einer offenen Lizenz), ohne das laufende und das
vorige Quartal, passt zur Haltung des Projekts und ist der Gegenwert für die
Behördendaten, die es benutzt.

## 10. Datenfehler melden

Fällt jemandem auf, dass eine Zone falsch liegt oder ein Preis nicht stimmt,
gibt es keinen Weg. Ein Knopf „stimmt hier etwas nicht?" mit Zone und Feld im
Freitext — der Weg ins Feedback steht schon.

## 11. Ein Alarm, wenn die Gegenprobe kippt

*Aus der Nacht zum 8. September.*

Auf der Statistikseite steht die einzige Zahl, die etwas über die Statistik
selbst sagt: Sie vergleicht die Öffnungen mit der Gerätezahl aus einem ganz
anderen Schreibweg, und wenn die Öffnungen darunter liegen, kommen Zählungen
nicht an. Nur sieht diese Zahl niemand — die Seite liegt hinter dem Riegel, und
wer die App benutzt, hat keinen Grund, sie aufzurufen.

Die kleine Fassung: Der stündliche Cron rechnet die Gegenprobe ohnehin. Kippt
sie, geht eine Nachricht an den Telegram-Admin-Kanal. Das ist ein `fetch` im
Aufräumlauf und braucht nichts, was es nicht schon gibt — ausser dem Bot-Token.

Dasselbe gilt für zwei weitere Zahlen, die still schieflaufen können: das
Tagesbudget der Ereignisse (steht es exakt auf 5.000, hat jemand es gefüllt)
und der Deckel der Besuche.

> **Eingebaut am 9. September**, als Schritt `alarme prüfen` im Aufräumlauf
> (`apps/api/src/worker.ts`), vier Tests. Geprüft wird die Gegenprobe des
> **gestrigen** Tages — heute laufen die Öffnungen den Geräten um Minuten
> hinterher, ein Alarm um 00:07 wäre jeden Morgen falsch — und die beiden
> Deckel des heutigen. Jeder Befund geht einmal hinaus, der KV merkt sich Tag
> und Art drei Tage lang. Braucht `TELEGRAM_ADMIN_CHAT`, siehe `hosting.md`.

## 12. Die Statistikseite zeigt, was sie **nicht** weiss

*Aus der Nacht zum 8. September, und der Anlass war ein Fehler.*

Drei der zwölf Katalogereignisse wurden nie ausgelöst. Auf der Seite standen
sie als Dauer-Null — nicht zu unterscheiden von „macht niemand". Ein Test
verhindert das jetzt für die Quelle, aber die Anzeige könnte es selbst sagen:
Ereignisse, für die es im gewählten Zeitraum **keine einzige** Zeile gibt,
gehören in einen eigenen kleinen Block „bisher nie gezählt". Dann ist eine
Lücke sichtbar, statt als Null durchzugehen.

Kostet fast nichts: Der Katalog liegt in `core`, die Seite kennt ihn schon für
die Anzeigenamen.

> **Eingebaut am 9. September**: Abschnitt „Bisher nie gezählt" auf der
> Statistikseite, aus `statistik/luecken.ts` gegen `EVENT_NAMES` aus `core`,
> mit zwei Tests. Er erscheint nur, wenn überhaupt etwas gezählt wurde — auf
> einem leeren Stand fehlt schlicht alles. Nebenbei: `statistik/` stand bis
> dahin nicht im `include` der `tsconfig.json` der Web-App und wurde von
> keinem Compiler angesehen; jetzt schon.

## 13. Ein Datum an den Daten, sichtbar in der App

Die App sagt „Daten: <Quelle> · <n> Zonen", aber nicht, **wann** sie gezogen
wurden. `meta.json` trägt das Datum; im Betrieb ist es die interessantere
Angabe von beiden, weil ein Abzug von vor drei Wochen für die Frage „kostet das
gerade etwas" eine andere Verlässlichkeit hat als einer von gestern. Und es
macht einen stehengebliebenen Datenbau sichtbar — der Deploy zieht frische
Daten, aber ein Behördendienst, der schweigt, lässt den alten Abzug stehen, und
genau das soll er ja auch.

> **Eingebaut am 9. September**: `geprueftAm` in jeder `meta.json`, gelesen
> aus den Rohdateien (`packages/ingest/src/abruf-zeit.ts`), in den
> Einstellungen unter „Daten" als „zuletzt geprüft am …", und im Deploy als
> Schritt „Datenstand prüfen" (`scripts/datenstand-pruefen.mjs`). Der ganze
> Weg steht in `todo.md`, Abschnitt 9.

## Was ich nicht bauen würde

- **Konten.** Alles Nützliche geht ohne, und mit ihnen käme die ganze
  DSGVO-Maschinerie.
- **Adresssuche über Nominatim.** Ein weiterer Empfänger für etwas, das die
  Straßennamen aus Punkt 1 fast genauso gut können.
- **Werbung, Spenden-Knopf, Sponsoren.** Steht schon als Entscheidung dagegen.
- **Eine zweite Kartenbibliothek.** MapLibre kann alles hier Genannte.
