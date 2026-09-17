# Release Notes

Was sich für Nutzerinnen und Nutzer geändert hat — nicht jede Datei, nur
das, was man merkt. Der Stand ist geschlossener Testbetrieb; jede Zeile
gilt für die ausgelieferte Adresse ab dem genannten Tag. Was dahinter
entschieden wurde, steht in [entscheidungen.md](entscheidungen.md), was noch
offen ist, in [todo.md](todo.md).

## Länder — 17. September 2026

**Die App zeigt jetzt Städte in sechs Ländern.** In den Einstellungen steht
vor der Städteliste eine Landeswahl; die Liste zeigt nur die Städte des
gewählten Landes, und wer ein Land wechselt, tut das absichtlich. Wer sich in
einer anderen Stadt befindet, bekommt wie bisher einen Vorschlag — über eine
Landesgrenze nennt er das Land dazu („Dein Standort liegt in Wien
(Österreich)").

**Neue Städte.** Deutschland: Freiburg im Breisgau, Rostock, Schwerin,
Cottbus, Kassel, Essen, Saarbrücken. Österreich: Wien, Graz, Salzburg,
Innsbruck. Schweiz: Zürich, Bern, Genf, St. Gallen. Niederlande: Utrecht,
Den Haag, Rotterdam, Groningen, Nijmegen, Eindhoven. Frankreich: Strasbourg.
Polen: Krakau. Die vollständige Liste mit dem
Stand je Stadt steht in [staedte.md](staedte.md).

**Drei Dinge, die man in den neuen Städten sehen kann und die es vorher
nicht gab:**

- **„Zeiten unbekannt".** Manche Städte veröffentlichen nur die Grenzen
  ihrer Zonen, weder Zeiten noch Tarif (Bern, Genf, St. Gallen, Krakau,
  Kassel, Essen, Saarbrücken).
  Solche Zonen sind grau statt messing oder cyan, und das Blatt sagt, dass
  die Stadt keine Zeiten nennt — statt „keine Gebühr", was dort eine
  Behauptung wäre.
- **„Lizenz ungeklärt".** Wo eine Stadt ihre Daten ohne Nutzungsbedingungen
  bereitstellt (Graz, Kassel, Krakau, Saarbrücken), steht ein Hinweis über der Karte und
  in den Einstellungen. Die Zonen sind trotzdem da; die Frage an die Stadt
  ist gestellt.
- **„Tarif laut Verordnung".** Wien, Salzburg und Zürich veröffentlichen die
  Zonen, aber nicht den Betrag; der steht in der Verordnung der Stadt. Das
  Blatt nennt ihn mit dieser Herkunft, damit niemand ihn für eine Angabe aus
  dem Datensatz hält.

**Franken.** Schweizer Tarife erscheinen als CHF, nicht als Euro.

**Feiertage je Staat.** Österreich rechnet ohne Karfreitag und mit den
Landespatronen, die Niederlande mit Koningsdag, Polen mit dem 3. Mai und dem
11. November, Frankreich mit dem 14. Juli; die Schweiz je Kanton. Die App nimmt den Kalender des Landes,
in dem die Stadt liegt.

**Niederlande: Feiertage aus der Quelle.** Das Nationaal Parkeer Register
nennt je Regelung, ob Feiertage frei sind — die App zeigt das, statt es
anzunehmen.

## Android, Langzeitmuster, Tests — 16. September 2026

- Bedienung auf Android nach dem dortigen Muster: Zurück-Taste schließt
  Blätter statt der App, Tastatur mit passenden Eingabetasten, größere
  Tippflächen, kein Überzieh-Ruckeln.
- **„Typisch hier"** im Zonenblatt: Aus den gemeldeten Kontrollen entsteht
  je Zone ein Wochenmuster, sobald genug Wochen beisammen sind. Der Text
  sagt, wie viele Wochen dahinterstehen.
- Zwei Fehler behoben, die niemand gesehen hat: Die Straßensuche verlor bei
  leerer Trefferliste ihre Eingabe; die Ratengrenze für Rückmeldungen zählte
  um die volle Stunde falsch.

## Sieben Städte, neues Erscheinungsbild — 9. bis 10. September 2026

- Köln, Düsseldorf und Karlsruhe dazu. In Karlsruhe sind die „Zonen" die
  Stellplatzreihen selbst; wer daneben steht, bekommt die nächste Reihe mit
  Abstand genannt.
- Neues Erscheinungsbild: eigene Symbole, Messing statt Orange für
  „kassiert gerade", Kennzahlenleiste, Meldungen-Blatt mit Reitern,
  Straßensuche über Photon.
- Meldungen: Die eigene Meldung ist als solche markiert und lässt sich
  nicht selbst bestätigen; die Anzeige übersteht ein Neuladen.

## Hamburg, Frankfurt, München — 6. bis 8. September 2026

- Vier Städte statt einer, umschaltbar in den Einstellungen. Hamburgs
  Parkscheibengebiete stehen als „Parkscheibe", nicht als „0,00 €".
- Beta-Riegel vor der Auslieferung, eigene Kartenkacheln, Kontrolldichte
  als Heatmap, Telegram-Bot zum Melden.
