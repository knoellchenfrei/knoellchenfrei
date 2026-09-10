import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

import { loadZones, representativePoint, zoneAt, type LoadedZone } from '../src/zones.js'

/**
 * `representativePoint` gegen die echten Daten aller ausgelieferten Städte.
 *
 * Die Funktion beantwortet „wo genau ist diese Zone", wenn jemand sie in der
 * Suche oder im Meldedialog auswählt. Ihr Vorgänger nahm die Mitte des
 * umschliessenden Rechtecks, und das ist bei drei Berliner Zonen falsch: 11
 * und 91 sind L-förmig, ihre Rechteckmitte liegt auf einer gebührenfreien
 * Strasse; 132 legt sich um 133 herum, ihre Mitte liegt **in 133**. „Hier
 * geparkt" aus dem Panel von 132 hat das Auto damit in 133 eingetragen.
 *
 * Wie viel daran hing, war nie gemessen. Am 9. September nachgeholt, indem
 * die alte Rechteckmitte gegen den ganzen Bestand gerechnet wurde:
 *
 *     berlin:    3 von 103 Flächen (11, 91, 132)
 *     hamburg:  38 von 145 Flächen (N101, A103, A100, 35 ohne Nummer)
 *     frankfurt: 0 von 27
 *     muenchen:  0 von 82
 *
 * Die Korrektur war also für Berlin gedacht und trägt in Hamburg mehr als
 * zehnmal so weit.
 *
 * Die Nachfolgerin sucht vom Zentrum aus auf einem 13x13-Raster. Bis heute
 * hatte sie keinen einzigen Test — **357 Flächen** in vier Städten (Berlin 103,
 * Hamburg 145, Frankfurt 27, München 82), und niemand hat nachgerechnet, ob der
 * zurückgegebene Punkt wirklich in der Fläche liegt, für die er steht.
 * Das ist die Zusicherung, auf die es ankommt, und sie ist hier als
 * Eigenschaft über den gesamten Bestand geprüft, nicht an Beispielen.
 */

const DATEN = fileURLToPath(new URL('../public/data/', import.meta.url))
// Aus dem Verzeichnis gelesen, nicht aufgezählt: Bis zum 10. September stand
// hier eine Liste von vier Städten, und Köln, Düsseldorf und Karlsruhe — mit
// 279 schmalen Reihen der schwierigste Bestand — liefen nie mit.
const STAEDTE = readdirSync(DATEN, { withFileTypes: true })
  .filter((eintrag) => eintrag.isDirectory())
  .map((eintrag) => eintrag.name)
  .sort()

function flaechen(stadt: string): LoadedZone[] {
  const pfad = `${DATEN}${stadt}/zones.geojson`
  return loadZones(JSON.parse(readFileSync(pfad, 'utf8')) as Parameters<typeof loadZones>[0])
}

describe('representativePoint liegt in seiner eigenen Fläche', () => {
  // Keine feste Zahl: Ein Datenlauf darf Flächen bringen oder wegnehmen, und
  // dieser Test prüft eine Eigenschaft, keinen Bestand. Die Untergrenze fängt
  // aber den Fall, dass eine ganze Stadt fehlt — am 9. September sind es 357
  // (Berlin 103, Hamburg 145, Frankfurt 27, München 82), die kleinste Stadt
  // hat 27.
  it('findet die Daten aller sieben Städte', () => {
    expect(STAEDTE).toEqual(['berlin', 'duesseldorf', 'frankfurt', 'hamburg', 'karlsruhe', 'koeln', 'muenchen'])
    const summe = STAEDTE.reduce((n, stadt) => n + flaechen(stadt).length, 0)
    // Am 10. September 725 (Berlin 103, Düsseldorf 44, Frankfurt 27, Hamburg 145,
    // Karlsruhe 279, Köln 45, München 82).
    expect(summe).toBeGreaterThanOrEqual(680)
  })

  for (const stadt of STAEDTE) {
    it(`${stadt}: jede Fläche wird von ihrem eigenen Punkt getroffen`, () => {
      const geladen = flaechen(stadt)
      expect(geladen.length).toBeGreaterThan(0)

      const daneben = geladen
        .map((zone) => {
          const punkt = representativePoint(zone)
          const getroffen = zoneAt(geladen, punkt)
          // Nicht auf Objektgleichheit: Überlappen sich zwei Flächen, gewinnt
          // die erste in der Liste. Verlangt ist, dass der Punkt **in** seiner
          // eigenen Fläche liegt — nicht, dass keine andere ihn auch enthält.
          const drin = zoneAt([zone], punkt) !== null
          return { zone, punkt, getroffen, drin }
        })
        .filter((eintrag) => !eintrag.drin)

      expect(
        daneben.map((e) => `${e.zone.properties.zone} (${e.zone.properties.district})`)
      ).toEqual([])
    })
  }
})
