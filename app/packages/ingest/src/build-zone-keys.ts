/**
 * Erzeugt die Liste der gültigen Zonenkennungen je Stadt.
 *
 * Wozu: Der Worker nimmt Statistik-Ereignisse über eine offene Adresse
 * entgegen, und `zone.open` trägt eine Zonenkennung als Ausprägung. Ohne Liste
 * wäre das eine Freitextspalte, die 90 Tage bleibt — genau die „Dimension, die
 * nie wieder verschwindet", nur von aussen befüllt.
 *
 * Warum nicht einfach ein Muster wie `[\w-]+`: Münchens Zonen heissen
 * `Volkartstraße` und `Schönstraße Nord`. Ein ASCII-Muster wiese sie **still**
 * ab — München stünde mit null Zonenöffnungen da, und das sähe nach „wird dort
 * nicht benutzt" aus statt nach einem Fehler. Dieselbe Falle wie bei den
 * Achsenreihenfolgen und den Demodaten.
 *
 * Warum aus den **ausgelieferten** GeoJSON und nicht aus dem Datenbau: Der
 * Datenbau holt von vier Behörden-WFS, mit Proxy- und Zertifikatsfallen. Diese
 * Liste braucht kein Netz — sie liest das, was ohnehin im Repository liegt und
 * was die App tatsächlich ausliefert. Läuft der Datenbau, ändern sich die
 * GeoJSON, und dieses Skript läuft danach.
 *
 * Aufruf:  npx tsx src/build-zone-keys.ts
 */

import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

import { CITIES } from '@knoellchenfrei/core'

const DATEN = process.env.DATA_DIR ?? join(process.cwd(), '../../apps/web/public/data')
const ZIEL =
  process.env.ZONE_KEYS_OUT ?? join(process.cwd(), '../core/src/zone-keys.generated.ts')

interface ZoneFeature {
  properties?: { zone?: unknown }
}

const proStadt = new Map<string, string[]>()

for (const city of CITIES) {
  const pfad = join(DATEN, city.key, 'zones.geojson')
  const roh = JSON.parse(readFileSync(pfad, 'utf8')) as { features?: ZoneFeature[] }
  const schluessel = (roh.features ?? [])
    .map((feature) => feature.properties?.zone)
    .filter((wert): wert is string => typeof wert === 'string' && wert.length > 0)
  const eindeutig = [...new Set(schluessel)].sort()
  if (eindeutig.length === 0) {
    throw new Error(`${city.key}: keine einzige Zonenkennung in ${pfad}`)
  }
  proStadt.set(city.key, eindeutig)
  console.log(`  ${city.name}: ${eindeutig.length} Kennungen`)
}

const zeilen = [...proStadt.entries()]
  .map(([key, werte]) => `  ${JSON.stringify(key)}: [\n${werte.map((w) => `    ${JSON.stringify(w)},`).join('\n')}\n  ],`)
  .join('\n')

const inhalt = `/**
 * **Erzeugt von \`packages/ingest/src/build-zone-keys.ts\` — nicht von Hand ändern.**
 *
 * Die gültigen Zonenkennungen je Stadt, gelesen aus den ausgelieferten
 * \`zones.geojson\`. Der Worker prüft die Ausprägung von \`zone.open\` dagegen;
 * ohne diese Liste wäre sie eine Freitextspalte.
 *
 * Neu erzeugen, nachdem sich die Daten geändert haben:
 *
 * \`\`\`bash
 * cd app/packages/ingest && npx tsx src/build-zone-keys.ts
 * \`\`\`
 */

export const ZONE_KEYS: Readonly<Record<string, readonly string[]>> = {
${zeilen}
}

/** Alle Kennungen aller Städte, für eine Prüfung ohne Stadtbezug. */
export const ALL_ZONE_KEYS: readonly string[] = Object.values(ZONE_KEYS).flat()
`

writeFileSync(ZIEL, inhalt)
console.log(`\n${ZIEL}`)
console.log(`  ${[...proStadt.values()].reduce((n, l) => n + l.length, 0)} Kennungen insgesamt`)
