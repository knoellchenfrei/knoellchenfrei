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

import { CITIES } from '@knoellchenfrei/core'

for (const city of CITIES) console.log(city.key)
