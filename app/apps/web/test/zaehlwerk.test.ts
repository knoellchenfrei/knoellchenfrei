import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { ZoneFeature } from '../src/zones.js'

/**
 * Der Zähler in der App — die Hälfte, die vorher keinen Test hatte.
 *
 * `apps/api` prüft, was der Worker mit einem Bündel macht. Ob überhaupt eins
 * losgeschickt wird, entscheidet aber diese Datei, und zwar an vier Stellen:
 * drei Gründe, aus denen gar nichts gesendet wird, und die Zusammenfassung,
 * die aus einer Folge eine Summe macht. Genau diese Zusammenfassung ist das
 * Datenschutzversprechen — „keine Reihenfolge" ist keine Absichtserklärung,
 * sondern eine Eigenschaft des Codes, und Eigenschaften gehören geprüft.
 *
 * Ohne jsdom: `track.ts` fragt jede Browser-Fähigkeit ab, bevor es sie
 * benutzt, und lässt sich deshalb mit gestellten Globals prüfen. Eine
 * DOM-Attrappe als Abhängigkeit wäre für vier Objekte zu viel.
 */

interface Bündel {
  city: string
  events: { name: string; value: string; n: number }[]
}

let gesendet: Bündel[] = []

/**
 * Lädt das Modul frisch — `API_BASE` wird beim Import einmal ausgewertet.
 *
 * `null` und nicht `undefined` für „keine Adresse": `laden(undefined)` würde
 * den Vorgabewert einsetzen, und der Test hätte dann genau das Gegenteil
 * dessen geprüft, was sein Name behauptet. Beim Schreiben dieser Datei ist
 * genau das passiert.
 */
async function laden(basis: string | null = 'https://api.example') {
  vi.resetModules()
  vi.stubEnv('VITE_API_BASE', basis === null ? '' : basis)
  return import('../src/track.js')
}

function speicherAttrappe(inhalt: Record<string, string> = {}) {
  return {
    getItem: (k: string) => inhalt[k] ?? null,
    setItem: (k: string, v: string) => {
      inhalt[k] = v
    },
    removeItem: (k: string) => {
      delete inhalt[k]
    },
  }
}

beforeEach(() => {
  gesendet = []
  vi.stubGlobal('fetch', (_url: string, init: { body: string }) => {
    gesendet.push(JSON.parse(init.body) as Bündel)
    return Promise.resolve(new Response('{}'))
  })
  vi.stubGlobal('localStorage', speicherAttrappe())
  vi.stubGlobal('navigator', {})
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

describe('was hinausgeht', () => {
  it('zählt zusammen, statt eine Folge zu schicken', async () => {
    const { track, trackNow, setTrackCity } = await laden()
    setTrackCity('berlin')
    track('app.open')
    track('zone.open', '34')
    track('app.open')
    trackNow('locate', 'use')

    expect(gesendet).toHaveLength(1)
    const bündel = gesendet[0] as Bündel
    expect(bündel.city).toBe('berlin')
    // Drei Einträge für vier Ereignisse: „geöffnet, Zone 34, geöffnet" wird zu
    // `app.open: 2`. Was in welcher Reihenfolge passiert ist, verlässt das
    // Gerät nicht.
    expect(bündel.events).toHaveLength(3)
    expect(bündel.events.find((e) => e.name === 'app.open')?.n).toBe(2)
    expect(bündel.events.find((e) => e.name === 'zone.open')?.value).toBe('34')
  })

  it('schickt keinen Zeitstempel und keine Kennung mit', async () => {
    const { trackNow, setTrackCity } = await laden()
    setTrackCity('hamburg')
    trackNow('app.open')
    const roh = JSON.stringify(gesendet[0])
    // Nicht „es steht nichts Verdächtiges drin", sondern: Es stehen genau die
    // Felder drin, die dokumentiert sind.
    expect(Object.keys(gesendet[0] as object).sort()).toEqual(['city', 'events'])
    expect(Object.keys((gesendet[0] as Bündel).events[0] as object).sort()).toEqual([
      'n',
      'name',
      'value',
    ])
    expect(roh).not.toMatch(/time|stamp|session|client|id"/i)
  })

  it('leert den Puffer vor dem Senden — eine doppelte Zahl wäre schlimmer als eine fehlende', async () => {
    const { trackNow, setTrackCity } = await laden()
    setTrackCity('berlin')
    trackNow('app.open')
    trackNow('app.open')
    expect(gesendet).toHaveLength(2)
    expect((gesendet[0] as Bündel).events[0]?.n).toBe(1)
    expect((gesendet[1] as Bündel).events[0]?.n).toBe(1)
  })

  it('sendet nichts, solange keine Stadt gesetzt ist', async () => {
    const { trackNow } = await laden()
    trackNow('app.open')
    expect(gesendet).toHaveLength(0)
  })
})

describe('die drei Gründe, aus denen gar nichts gesendet wird', () => {
  it('ohne VITE_API_BASE ist jeder Aufruf ein No-op', async () => {
    const { track, trackNow, setTrackCity } = await laden(null)
    setTrackCity('berlin')
    track('app.open')
    trackNow('locate', 'use')
    expect(gesendet).toHaveLength(0)
  })

  it('nach Widerspruch in den Einstellungen', async () => {
    const { track, trackNow, setStatistikAus, statistikAus, setTrackCity } = await laden()
    setTrackCity('berlin')
    setStatistikAus(true)
    expect(statistikAus()).toBe(true)
    track('app.open')
    trackNow('app.open')
    expect(gesendet).toHaveLength(0)

    // Und wieder an: Der Schalter muss in beide Richtungen wirken. Die
    // Ausschaltbox war in der Oberfläche schon einmal falsch herum verdrahtet.
    setStatistikAus(false)
    expect(statistikAus()).toBe(false)
    trackNow('app.open')
    expect(gesendet).toHaveLength(1)
  })

  it('bei globalPrivacyControl, ohne dass jemand etwas einstellen muss', async () => {
    vi.stubGlobal('navigator', { globalPrivacyControl: true })
    const { trackNow, statistikAus, setTrackCity } = await laden()
    setTrackCity('berlin')
    expect(statistikAus()).toBe(true)
    trackNow('app.open')
    expect(gesendet).toHaveLength(0)
  })

  it('nimmt einen gesperrten Gerätespeicher hin, statt die Anzeige mitzunehmen', async () => {
    // In eingebetteten Zusammenhängen wirft `localStorage` schon beim Lesen.
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('SecurityError')
      },
      setItem: () => {
        throw new Error('SecurityError')
      },
      removeItem: () => {
        throw new Error('SecurityError')
      },
    })
    const { trackNow, statistikAus, setStatistikAus, setTrackCity } = await laden()
    setTrackCity('berlin')
    expect(statistikAus()).toBe(false)
    expect(() => setStatistikAus(true)).not.toThrow()
    expect(() => trackNow('app.open')).not.toThrow()
    expect(gesendet).toHaveLength(1)
  })
})

describe('was der Katalog nicht kennt', () => {
  it('wird verworfen und gemeldet — ein Tippfehler erzeugt sonst eine Dimension für 90 Tage', async () => {
    const warnungen: unknown[] = []
    vi.stubGlobal('console', { ...console, warn: (m: unknown) => warnungen.push(m) })
    const { track, trackNow, setTrackCity } = await laden()
    setTrackCity('berlin')
    track('app.opne' as never)
    trackNow('app.open')
    expect(warnungen).toHaveLength(1)
    expect((gesendet[0] as Bündel).events).toHaveLength(1)
    expect((gesendet[0] as Bündel).events[0]?.name).toBe('app.open')
  })
})

/**
 * Der Katalog verspricht zwölf Messungen — die Prüfung, ob es sie gibt.
 *
 * Am 8. September waren **drei** davon tot: `layer.on`, `city.suggest` und
 * `tow.open` standen in `core/events.ts`, wurden aber nirgends ausgelöst. Auf
 * der Statistikseite hätten sie als Dauer-Null gestanden — und ausgerechnet
 * `layer.on` ist die Antwort auf „welche Ebenen werden benutzt", also eine der
 * Fragen, für die das Zählwerk gebaut wurde. Eine Dimension, die nie einen
 * Wert bekommt, ist von einer kaputten nicht zu unterscheiden.
 *
 * Geprüft wird die Quelle, nicht die Laufzeit: Ein Ereignis, das an einer
 * Schaltfläche hängt, ist im Unit-Test nicht erreichbar, und ein E2E-Test
 * dafür wäre zwölf Klickstrecken lang. Der Name im Aufruf ist eine
 * Zeichenkette; dass sie dort steht, ist die Zusicherung, um die es geht.
 */
describe('der Katalog', () => {
  it('hat für jedes Ereignis eine Stelle, die es auslöst', async () => {
    const { readFileSync, readdirSync } = await import('node:fs')
    const { join } = await import('node:path')
    const { EVENTS } = await import('@knoellchenfrei/core')

    const wurzel = join(import.meta.dirname, '../src')
    const dateien: string[] = []
    const sammeln = (verzeichnis: string): void => {
      for (const eintrag of readdirSync(verzeichnis, { withFileTypes: true })) {
        const pfad = join(verzeichnis, eintrag.name)
        if (eintrag.isDirectory()) sammeln(pfad)
        else if (/\.tsx?$/.test(eintrag.name) && eintrag.name !== 'track.ts') dateien.push(pfad)
      }
    }
    sammeln(wurzel)
    const quelle = dateien.map((pfad) => readFileSync(pfad, 'utf8')).join('\n')

    const tot = Object.keys(EVENTS).filter(
      (name) => !quelle.includes(`track('${name}'`) && !quelle.includes(`trackNow('${name}'`)
    )
    expect(tot, `nie ausgelöst: ${tot.join(', ')}`).toEqual([])
  })
})

/**
 * Jede Kartenfläche bekommt ihre eigene Kennung — der teuerste Fund der Nacht.
 *
 * Die Karte färbt über `setFeatureState({ source, id })`, und `id` kam aus
 * `promoteId: 'zone'`, also aus dem Zonenschlüssel. In Hamburg tragen **44 von
 * 145 Flächen** den Schlüssel `-`, weil die Quelle für sie keine Nummer führt;
 * dazu kommen vier Zonen in mehreren Stücken mit verschiedenen Zeiten.
 *
 * Alle Flächen mit demselben Schlüssel teilten sich damit **einen**
 * Zustandsplatz: Die Schleife schrieb 44-mal hinein, der letzte gewann, und
 * alle 44 bekamen dessen Farbe — unabhängig von ihren eigenen Zeiten. Rund ein
 * Drittel der Hamburger Flächen konnte „kassiert gerade" falsch anzeigen.
 * Sichtbar war es nur als Farbe; das Panel las immer die richtige Fläche.
 */
describe('die Kennung einer Kartenfläche', () => {
  // Der Rückgabetyp steht ausdrücklich da: Ohne ihn ist es ein Objektliteral
  // ohne `id`, und `f.id` unten wäre ein Typfehler — genau der, den `tsc` bis
  // zum 9. September gar nicht zu sehen bekam, weil `test/` nicht im
  // `include` der `tsconfig.json` stand.
  const fläche = (zone: string, lon: number): ZoneFeature => ({
    properties: { zone } as never,
    geometry: {
      type: 'Polygon' as const,
      coordinates: [
        [
          [lon, 53],
          [lon + 0.01, 53],
          [lon + 0.01, 53.01],
          [lon, 53.01],
          [lon, 53],
        ],
      ],
    },
  })

  it('ist je Fläche verschieden, auch wenn der Zonenschlüssel derselbe ist', async () => {
    const { loadZones } = await import('../src/zones.js')
    const sammlung = { features: [fläche('-', 9.9), fläche('-', 10.0), fläche('A103', 10.1)] }
    const geladen = loadZones(sammlung)
    expect(new Set(geladen.map((z) => z.id)).size).toBe(3)
  })

  it('steht auch am übergebenen Feature — genau das Objekt geht an MapLibre', async () => {
    const { loadZones } = await import('../src/zones.js')
    const sammlung = { features: [fläche('-', 9.9), fläche('-', 10.0)] }
    const geladen = loadZones(sammlung)
    // `addSource({ data: sammlung })` bekommt dieses Objekt; ohne den Stempel
    // fiele MapLibre auf `promoteId` oder gar keine Kennung zurück.
    expect(sammlung.features.map((f) => f.id)).toEqual(geladen.map((z) => z.id))
    expect(new Set(sammlung.features.map((f) => f.id)).size).toBe(2)
  })

  it('überschreibt eine mitgelieferte Kennung — Berlin brachte als einzige eine', async () => {
    const { loadZones } = await import('../src/zones.js')
    const mitId = { ...fläche('7', 13.4), id: '7' }
    const sammlung = { features: [mitId] }
    loadZones(sammlung)
    // Eine Kennung, die in einer Stadt der Zonenschlüssel ist und in der
    // nächsten fehlt, ist keine.
    expect(sammlung.features[0]?.id).toBe(0)
  })
})

/**
 * Wie eine Fläche heißt, für die die Quelle keine Zonennummer führt.
 *
 * Hamburg liefert für 44 seiner 145 Flächen den Schlüssel `-`. An neun Stellen
 * der Oberfläche stand daraufhin wörtlich „Zone -" — im Panel, in der Ansage
 * für Screenreader, in der Suche, im Meldedialog und im Satz „Parkplatz
 * gemerkt in Zone -". Das liest sich wie ein Anzeigefehler und ist eine
 * Tatsache der Quelle; man muss sie nur aussprechen statt durchreichen.
 */
describe('der Name einer Fläche', () => {
  it('nennt eine Zone mit Nummer beim Namen', async () => {
    const { zoneImDativ, zoneTitel, hatNummer } = await import('../src/zone-label.js')
    expect(hatNummer({ zone: '12' })).toBe(true)
    expect(zoneImDativ({ zone: '12' })).toBe('Zone 12')
    expect(zoneTitel({ zone: 'A103' })).toBe('Parkzone A103')
  })

  it('sagt bei „-" etwas, das ein Mensch lesen kann', async () => {
    const { zoneImDativ, zoneTitel, hatNummer } = await import('../src/zone-label.js')
    expect(hatNummer({ zone: '-' })).toBe(false)
    expect(zoneTitel({ zone: '-' })).toBe('Bewirtschaftete Fläche')
    // Und der Satz, in dem es am meisten auffiel — im Dativ, denn der erste
    // Anlauf schrieb „gemerkt in eine Fläche ohne Nummer".
    expect(`Parkplatz gemerkt in ${zoneImDativ({ zone: '-' })}.`).toBe(
      'Parkplatz gemerkt in einer Fläche ohne Nummer.'
    )
  })

  /**
   * Die Kurzform gibt es, weil die erste Fassung überall `zoneTitel` einsetzte
   * und damit an vier Stellen aus „Zone 12" ein „Parkzone 12" machte — eine
   * Wortänderung, um die niemand gebeten hatte. Vier E2E-Tests haben es
   * gemeldet („Received string: 'Parkzone 3'"); der Fehler, um den es ging,
   * war ausschliesslich der Platzhalter.
   */
  it('lässt die gewohnte Kurzform stehen, wo vorher „Zone 12" stand', async () => {
    const { zoneKurz } = await import('../src/zone-label.js')
    expect(zoneKurz({ zone: '12' })).toBe('Zone 12')
    expect(zoneKurz({ zone: '3' })).toMatch(/^Zone /)
    expect(zoneKurz({ zone: '-' })).toBe('Fläche ohne Nummer')
  })

  it('behandelt einen leeren Schlüssel wie einen fehlenden', async () => {
    const { hatNummer } = await import('../src/zone-label.js')
    expect(hatNummer({ zone: '' })).toBe(false)
    expect(hatNummer({ zone: '  ' })).toBe(false)
  })
})

/**
 * Der Klick auf eine Kartenfläche muss **diese** Fläche treffen.
 *
 * Der Handler schlug bis zum 8. September über `properties.zone` nach:
 * `loaded.find(z => z.properties.zone === id)` nimmt die **erste** Fläche mit
 * diesem Schlüssel. In Hamburg tragen 44 von 145 Flächen den Schlüssel `-` —
 * ein Klick auf irgendeine von ihnen zeigte die Zeiten der ersten. Bei A103
 * wären das 9–20 statt 9–23 Uhr gewesen, bei E315 3,50 statt 3,00 €.
 *
 * Ich hatte beim Kartenfehler eine Stunde vorher geschrieben, das Panel sei
 * nicht betroffen, weil `zoneAt` geometrisch sucht. Das gilt für Standort und
 * Tipp ins Leere — nicht für den Klick auf eine Zonenfläche.
 */
describe('das Nachschlagen einer angeklickten Fläche', () => {
  it('unterscheidet zwei Flächen mit demselben Zonenschlüssel', async () => {
    const { loadZones } = await import('../src/zones.js')
    const ring = (lon: number) => [
      [
        [lon, 53],
        [lon + 0.01, 53],
        [lon + 0.01, 53.01],
        [lon, 53.01],
        [lon, 53],
      ],
    ]
    const geladen = loadZones({
      features: [
        { properties: { zone: '-', rawHours: 'täglich 9-20 Uhr' } as never, geometry: { type: 'Polygon', coordinates: ring(9.9) } },
        { properties: { zone: '-', rawHours: 'täglich 9-22 Uhr' } as never, geometry: { type: 'Polygon', coordinates: ring(10.0) } },
      ],
    })

    // So schlägt der Handler seit dem 8. September nach: über die Kennung der
    // angeklickten Fläche, die MapLibre am Feature mitliefert.
    const zweite = geladen.find((zone) => zone.id === 1)
    expect((zweite?.properties as { rawHours?: string }).rawHours).toBe('täglich 9-22 Uhr')

    // Und so vorher — die erste Fläche gewann, egal welche angeklickt wurde.
    const alt = geladen.find((zone) => zone.properties.zone === '-')
    expect((alt?.properties as { rawHours?: string }).rawHours).toBe('täglich 9-20 Uhr')
    expect(alt).not.toBe(zweite)
  })
})
