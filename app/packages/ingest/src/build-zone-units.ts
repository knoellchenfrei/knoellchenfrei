import { writeFileSync } from 'node:fs'
import { join } from 'node:path'

import { buildZoneUnits, renderCoreFile } from './zone-units.js'

/**
 * Schreibt die Einheiten der Langzeitmuster:
 *
 *     cd app/packages/ingest && npx tsx src/build-zone-units.ts
 *
 * Zwei Dateien aus einer Quelle — `core/src/zone-units.generated.ts` für die
 * App und `apps/api/src/zone-units.generated.json` für den Worker. Warum
 * erzeugt und eingecheckt statt zur Laufzeit gelesen, steht in
 * `zone-units.ts`; dass beide zum Datenstand passen, hält
 * `core/test/zone-units-aktuell.test.ts`.
 */
const DATEN = process.env.DATA_DIR ?? join(process.cwd(), '../../apps/web/public/data')
const CORE_OUT = process.env.ZONE_UNITS_CORE ?? join(process.cwd(), '../core/src/zone-units.generated.ts')
const API_OUT = process.env.ZONE_UNITS_API ?? join(process.cwd(), '../../apps/api/src/zone-units.generated.json')

const output = buildZoneUnits(DATEN)
writeFileSync(CORE_OUT, renderCoreFile(output))
writeFileSync(API_OUT, JSON.stringify(output.shapes))

for (const [city, shapes] of Object.entries(output.shapes)) {
  const zonen = shapes.filter((s) => s.kind === 'zone').length
  const punkte = shapes.reduce((n, s) => n + s.polygons.reduce((m, p) => m + p.reduce((k, r) => k + r.length, 0), 0), 0)
  console.log(`  ${city}: ${shapes.length} Einheiten (${zonen} Zonen, ${shapes.length - zonen} Bezirke), ${punkte} Punkte`)
}
console.log(`\n${CORE_OUT}\n${API_OUT}`)
