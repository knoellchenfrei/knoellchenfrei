import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { KARLSRUHE } from '@knoellchenfrei/core'

import { loadZones, zoneAt, zoneNear, type ZoneFeature } from '../src/zones.js'

/**
 * Karlsruhes „Zonen" sind die Stellplatzreihen selbst: 279 Flächen, im Median
 * 128 m² und 4,8 m breit (`docs/staedte-karlsruhe.md`, 5.1). Eine Ortung auf
 * 10 bis 20 m Genauigkeit trifft so eine Fläche fast nie — die App hätte an
 * jedem Karlsruher Automaten „außerhalb der Parkraumbewirtschaftung" gesagt.
 * `zoneNear` ist der zweite Versuch, mit dem Radius aus `KARLSRUHE.zoneSnapMetres`.
 *
 * Gemessen gegen die ausgelieferten Daten, nicht gegen eine erfundene Fläche.
 */
const zones = loadZones(
  JSON.parse(
    readFileSync(new URL('../public/data/karlsruhe/zones.geojson', import.meta.url), 'utf8'),
  ) as { features: ZoneFeature[] },
)

/** Ein Punkt `metres` Meter nördlich eines anderen. */
const noerdlich = (p: readonly [number, number], metres: number): [number, number] => [
  p[0],
  p[1] + metres / 110_540,
]

describe('zoneNear in Karlsruhe', () => {
  const reach = KARLSRUHE.zoneSnapMetres ?? 0
  const erste = zones[0]!
  // Die Mitte des Rahmens liegt bei einer 4,8 m breiten Reihe nicht sicher
  // darin — genau das ist das Problem. Der oberste Rand des Rahmens ist es.
  const oben: [number, number] = [
    (erste.bounds.minLon + erste.bounds.maxLon) / 2,
    erste.bounds.maxLat,
  ]

  it('hat einen gemessenen Radius', () => {
    expect(reach).toBe(20)
  })

  it('findet die Reihe, die eine Ortung knapp verfehlt, und nennt den Abstand', () => {
    const daneben = noerdlich(oben, 8)
    // Strikt: nichts, sonst bräuchte es den zweiten Versuch nicht.
    expect(zoneAt(zones, daneben)).toBeNull()
    const treffer = zoneNear(zones, daneben, reach)
    expect(treffer).not.toBeNull()
    expect(treffer!.metres).toBeGreaterThan(0)
    expect(treffer!.metres).toBeLessThanOrEqual(reach)
  })

  it('gibt jenseits des Radius nichts zurück', () => {
    // Weit weg von allem: die Rheinmitte bei Maxau.
    expect(zoneNear(zones, [8.29, 49.04], reach)).toBeNull()
  })

  it('liefert null Meter, wo der Punkt in der Fläche liegt — dieselbe Antwort wie zoneAt', () => {
    const innen = zones.find((z) => zoneAt(zones, [(z.bounds.minLon + z.bounds.maxLon) / 2, (z.bounds.minLat + z.bounds.maxLat) / 2]) !== null)!
    const mitte: [number, number] = [
      (innen.bounds.minLon + innen.bounds.maxLon) / 2,
      (innen.bounds.minLat + innen.bounds.maxLat) / 2,
    ]
    expect(zoneNear(zones, mitte, reach)?.metres).toBe(0)
    expect(zoneNear(zones, mitte, reach)?.zone.id).toBe(zoneAt(zones, mitte)?.id)
  })
})
