/**
 * Gibt die Schlüssel aller Städte aus, zeilenweise — für die Workflows.
 *
 * `deploy.yml` und `kacheln.yml` trugen die Städteliste als Text, dreimal.
 * Mit der neunten Stadt am 16. September haben sich zwei Zweige genau an
 * diesen Zeilen gestossen; wichtiger: Eine Stadt, die dort fehlt, wird
 * **still** nie aufgefrischt und bekommt nie ein Kachelarchiv, ohne dass
 * irgendwo ein roter Haken erscheint. Die Liste steht deshalb genau einmal,
 * in `core/city.ts` — wie die Rahmen in `city-bbox.ts` (Audit-Punkt M-034).
 */

import { CITIES, citiesInCountries, parseCountries } from '@knoellchenfrei/core'

// Derselbe Schalter wie im Web-Build (`VITE_COUNTRIES`): Der Deploy frischt
// nur auf, was die Auslieferung zeigt — seit dem 30. September Deutschland.
// Die Abzüge der anderen Städte bleiben eingecheckt und werden nicht älter
// als ihr letzter Lauf; wer sie wieder einschaltet, setzt die Variable.
for (const city of citiesInCountries(CITIES, parseCountries(process.env['VITE_COUNTRIES']))) console.log(city.key)
