import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { CITIES } from '../src/city.js'
import { ALL_ZONE_KEYS, ZONE_KEYS } from '../src/zone-keys.generated.js'

/**
 * Die erzeugte Zonenliste gegen die ausgelieferten Daten.
 *
 * `zone-keys.generated.ts` entsteht aus den `zones.geojson` und ist die einzige
 * Grenze, die der Worker gegen die Ausprägung von `zone.open` hat. Läuft sie
 * auseinander, passiert **nichts Sichtbares**: Der Worker verwirft Zählungen
 * für Zonen, die es längst gibt, mit `written: 0` und ohne Fehler. Auf der
 * Statistikseite fehlen sie einfach — und „diese Zone sieht sich niemand an"
 * ist von „diese Zone wird verworfen" nicht zu unterscheiden.
 *
 * Der Vorfall, gegen den das schützt, ist noch nicht eingetreten; die Zutaten
 * sind aber alle da: Die Datei wird von Hand erzeugt
 * (`npx tsx src/build-zone-keys.ts`), der Datenbau läuft im Deploy
 * automatisch, und niemand erinnert daran.
 */

const DATEN = join(import.meta.dirname, '../../../apps/web/public/data')

function schlüsselAusDaten(stadt: string): string[] {
  const roh = JSON.parse(
    readFileSync(join(DATEN, stadt, 'zones.geojson'), 'utf8')
  ) as { features?: { properties?: { zone?: unknown } }[] }
  const gefunden = new Set<string>()
  for (const feature of roh.features ?? []) {
    const wert = feature.properties?.zone
    if (typeof wert === 'string' && wert.length > 0) gefunden.add(wert)
  }
  return [...gefunden].sort()
}

describe('die erzeugte Zonenliste', () => {
  for (const stadt of CITIES) {
    it(`stimmt mit den ausgelieferten Daten von ${stadt.name} überein`, () => {
      const ausDaten = schlüsselAusDaten(stadt.key)
      const eingetragen = [...(ZONE_KEYS[stadt.key] ?? [])].sort()
      expect(eingetragen.length).toBeGreaterThan(0)
      // Beide Richtungen, und beide sagen etwas anderes: Fehlt ein Schlüssel,
      // werden seine Zählungen verworfen. Steht einer zu viel drin, nimmt der
      // Worker eine Zone an, die es nicht mehr gibt.
      expect(
        ausDaten.filter((k) => !eingetragen.includes(k)),
        `in den Daten, nicht in der Liste — build-zone-keys.ts laufen lassen`
      ).toEqual([])
      expect(
        eingetragen.filter((k) => !ausDaten.includes(k)),
        `in der Liste, nicht mehr in den Daten`
      ).toEqual([])
    })
  }

  it('kennt jede angeschlossene Stadt', () => {
    expect(Object.keys(ZONE_KEYS).sort()).toEqual(CITIES.map((stadt) => stadt.key).sort())
  })

  it('ist flachgeklopft genauso lang wie die Summe der Städte', () => {
    // Nicht kosmetisch: `ALL_ZONE_KEYS` ist `Object.values(...).flat()` und
    // enthält deshalb Dubletten — Berlin und Frankfurt teilen sich 20
    // Kennungen. Wer die Liste für eindeutig hält, prüft die Zonenkennung
    // gegen 275 statt gegen die 27 bis 103 der Stadt; genau das war der
    // Fehler vom 8. September.
    const summe = CITIES.reduce((zahl, stadt) => zahl + (ZONE_KEYS[stadt.key]?.length ?? 0), 0)
    expect(ALL_ZONE_KEYS.length).toBe(summe)
    expect(new Set(ALL_ZONE_KEYS).size).toBeLessThan(ALL_ZONE_KEYS.length)
  })
})
