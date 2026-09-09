import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'

import { CITIES, withinCity, type City } from '@knoellchenfrei/core'

/**
 * Die Demodaten müssen in **jeder** Stadt in ihrer eigenen Stadt liegen.
 *
 * Der Vorfall dahinter: `seed.ts` streute sechs Beispielmeldungen und acht
 * Heatmap-Ecken über feste **Berliner** Koordinaten. In München lagen sie
 * damit 500 km neben der Karte — nichts zu sehen, kein Fehler im Log, und die
 * einzige Spur war die Liste „am häufigsten kontrolliert", die dreimal
 * „Außerhalb der Zonen" nannte. Das las sich wie eine Aussage über München
 * und war eine über Berlin.
 *
 * Behoben ist es dadurch, dass die Punkte als **Abstand zu `CITY.center`**
 * stehen. Nur: Das Muster stammt weiter aus Berlin — Steglitz liegt 0,12°
 * westlich der Mitte —, und ob dieser Abstand in einer kompakteren Stadt noch
 * im Meldeausschnitt landet, hat bisher niemand nachgerechnet. Frankfurt ist
 * mit 0,40° × 0,25° der engste der vier.
 *
 * Der Test läuft über `CITIES`, nicht über eine Liste im Test: Eine fünfte
 * Stadt ist damit ab dem Tag geprüft, an dem sie eingetragen wird. Genau dort
 * würde der Fehler sonst wieder auftauchen — Karlsruhe liegt vorbereitet.
 */

const SPEICHER = 'knoellchenfrei:city'

/** Die App liest die Stadt aus `localStorage`; hier wird sie gestellt. */
function stelleStadt(key: string): void {
  const inhalt: Record<string, string> = { [SPEICHER]: key }
  const speicher = {
    getItem: (k: string) => inhalt[k] ?? null,
    setItem: (k: string, v: string) => {
      inhalt[k] = v
    },
    removeItem: (k: string) => {
      delete inhalt[k]
    },
  }
  vi.stubGlobal('localStorage', speicher)
  vi.stubGlobal('window', { localStorage: speicher })
  vi.stubGlobal('navigator', {})
}

beforeEach(() => {
  vi.resetModules()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('Demodaten liegen in der Stadt, die sie zeigen', () => {
  const staedte: readonly City[] = CITIES

  it('prüft alle eingetragenen Städte, nicht eine Auswahl', () => {
    expect(staedte.length).toBeGreaterThanOrEqual(4)
  })

  for (const stadt of staedte) {
    it(`${stadt.key}: jede Beispielmeldung liegt im Meldeausschnitt`, async () => {
      stelleStadt(stadt.key)
      const { seedSightings } = await import('../src/seed.js')
      const meldungen = seedSightings(Date.parse('2026-09-08T10:30:00Z'))
      expect(meldungen.length).toBeGreaterThan(0)

      const draussen = meldungen.filter((m) => !withinCity(stadt, m.lon, m.lat))
      expect(draussen.map((m) => `${m.id} bei ${m.lon.toFixed(4)},${m.lat.toFixed(4)}`)).toEqual([])
    })

    it(`${stadt.key}: jede Beispielmarkierung fällt in eine Zelle des Ausschnitts`, async () => {
      stelleStadt(stadt.key)
      const { seedMarks } = await import('../src/seed.js')
      const { cellOf } = await import('@knoellchenfrei/core')
      const marken = seedMarks(Date.parse('2026-09-08T10:30:00Z'))
      expect(marken.length).toBeGreaterThan(0)

      // Das Raster ist global durchnummeriert (`<x>_<y>`), also lassen sich die
      // Ecken des Ausschnitts in Zellnummern übersetzen und die Marken
      // dagegen halten.
      const zahlen = (zelle: string): [number, number] => {
        const [x, y] = zelle.split('_').map(Number)
        return [x as number, y as number]
      }
      const b = stadt.reportBounds
      const [x1, y1] = zahlen(cellOf([b.minLon, b.minLat]))
      const [x2, y2] = zahlen(cellOf([b.maxLon, b.maxLat]))

      const draussen = marken.filter((mark) => {
        const [x, y] = zahlen(mark.cell)
        return x < Math.min(x1, x2) || x > Math.max(x1, x2) || y < Math.min(y1, y2) || y > Math.max(y1, y2)
      })
      expect(draussen.map((m) => m.cell)).toEqual([])
    })
  }
})
