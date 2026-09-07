/**
 * Gibt die Rahmen aller Städte aus, zeilenweise, für `build-tiles.sh`.
 *
 * Warum ein eigenes Skript und keine Zahlen im Shell-Skript: Die Grenzen
 * stehen genau einmal, in `core/city.ts`. Das Kachelskript trug seine eigene
 * `BBOX="13.0,52.3,13.8,52.7"` — dieselben Zahlen wie Berlins `reportBounds`,
 * aber eben eine zweite Kopie, und der Kommentar daneben warnte selbst davor.
 * Mit vier Städten wären es acht Kopien geworden (Audit-Punkt M-034).
 *
 * Ausgabe je Zeile: `<schlüssel> <minLon>,<minLat>,<maxLon>,<maxLat>`
 */

import { CITIES } from '@knoellchenfrei/core'

const nur = process.argv.slice(2)
const auswahl = nur.length === 0 ? CITIES : CITIES.filter((city) => nur.includes(city.key))

if (auswahl.length === 0) {
  console.error(`Keine bekannte Stadt in: ${nur.join(', ')}`)
  console.error(`Bekannt sind: ${CITIES.map((city) => city.key).join(', ')}`)
  process.exit(2)
}

for (const city of auswahl) {
  const b = city.reportBounds
  console.log(`${city.key} ${b.minLon},${b.minLat},${b.maxLon},${b.maxLat}`)
}
