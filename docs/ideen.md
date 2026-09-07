# Ideen: was wir noch bauen sollten

Entstanden am 7. September 2026 auf die Frage des Betreibers, was bisher
niemand aufgeschrieben hat. **Nichts davon ist entschieden** — das steht in
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

## 9. Die Heatmap als offener Datensatz

Die Kontrolldichte ist etwas, das es sonst nirgends gibt — 28 Tage
Beobachtung, aggregiert, ohne Personenbezug. Sie zu veröffentlichen (CSV oder
GeoJSON unter einer offenen Lizenz) passt zur Haltung des Projekts und ist der
Gegenwert für die Behördendaten, die es benutzt.

## 10. Datenfehler melden

Fällt jemandem auf, dass eine Zone falsch liegt oder ein Preis nicht stimmt,
gibt es keinen Weg. Ein Knopf „stimmt hier etwas nicht?" mit Zone und Feld im
Freitext — der Weg ins Feedback steht schon.

## Was ich nicht bauen würde

- **Konten.** Alles Nützliche geht ohne, und mit ihnen käme die ganze
  DSGVO-Maschinerie.
- **Adresssuche über Nominatim.** Ein weiterer Empfänger für etwas, das die
  Straßennamen aus Punkt 1 fast genauso gut können.
- **Werbung, Spenden-Knopf, Sponsoren.** Steht schon als Entscheidung dagegen.
- **Eine zweite Kartenbibliothek.** MapLibre kann alles hier Genannte.
