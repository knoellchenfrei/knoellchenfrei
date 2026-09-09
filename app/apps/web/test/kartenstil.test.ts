import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * `map-style.ts` — die drei Ausbaustufen des Kartenhintergrunds, und bis heute
 * mit 0 % Abdeckung.
 *
 * Der teure Vorfall steht im Quelltext: Bis zum 7. September zeigte
 * `VITE_TILES_URL` auf **eine Datei** (`…/v20260904/berlin.pmtiles`), und
 * dieser eine Pfad landete unabhängig von der geladenen Stadt im Stil. In
 * Hamburg, Frankfurt und München lag der Ausschnitt damit ausserhalb des
 * Archivs: Der Hintergrund blieb leer, und zwar so, dass es nach „lädt noch"
 * aussah statt nach einem Fehler. **Eine gesetzte Variable war schlechter als
 * keine** — ohne sie wären die Rasterkacheln eingesprungen.
 *
 * Der Build bricht seitdem ab, wenn der Wert auf `.pmtiles` endet; das ist die
 * eine Hälfte. Die andere ist, dass die App je Stadt selbst anhängt, und die
 * steht hier.
 */

function stelleStadt(key: string): void {
  const inhalt: Record<string, string> = { 'knoellchenfrei:city': key }
  const speicher = {
    getItem: (k: string) => inhalt[k] ?? null,
    setItem: () => undefined,
    removeItem: () => undefined,
  }
  vi.stubGlobal('localStorage', speicher)
  vi.stubGlobal('window', { localStorage: speicher })
  vi.stubGlobal('navigator', {})
}

beforeEach(() => {
  vi.resetModules()
  vi.unstubAllEnvs()
  stelleStadt('berlin')
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

describe('das Archiv wird je Stadt zusammengesetzt', () => {
  it('hängt den Stadtschlüssel an das Verzeichnis', async () => {
    vi.stubEnv('VITE_TILES_URL', 'https://kacheln.example/v20260904/')
    const { tilesUrlFor } = await import('../src/map-style.js')
    expect(tilesUrlFor('hamburg')).toBe('https://kacheln.example/v20260904/hamburg.pmtiles')
    expect(tilesUrlFor('muenchen')).toBe('https://kacheln.example/v20260904/muenchen.pmtiles')
  })

  it('ergänzt einen fehlenden Schrägstrich', async () => {
    vi.stubEnv('VITE_TILES_URL', 'https://kacheln.example/v20260904')
    const { tilesUrlFor } = await import('../src/map-style.js')
    expect(tilesUrlFor('berlin')).toBe('https://kacheln.example/v20260904/berlin.pmtiles')
  })

  it('verdoppelt einen vorhandenen nicht', async () => {
    vi.stubEnv('VITE_TILES_URL', 'https://kacheln.example/v20260904///')
    const { tilesUrlFor } = await import('../src/map-style.js')
    expect(tilesUrlFor('berlin')).toBe('https://kacheln.example/v20260904/berlin.pmtiles')
  })

  it('nimmt Leerzeichen um den Wert hin', async () => {
    vi.stubEnv('VITE_TILES_URL', '  https://kacheln.example/v1/  ')
    const { tilesUrlFor } = await import('../src/map-style.js')
    expect(tilesUrlFor('berlin')).toBe('https://kacheln.example/v1/berlin.pmtiles')
  })

  it.each([
    ['gar nicht gesetzt', undefined],
    ['leer', ''],
    ['nur Leerzeichen', '   '],
  ])('ohne Wert (%s) gibt es kein Archiv — dann greifen die Rasterkacheln', async (_n, wert) => {
    if (wert !== undefined) vi.stubEnv('VITE_TILES_URL', wert)
    const { tilesUrlFor, TILES_BASE } = await import('../src/map-style.js')
    expect(TILES_BASE).toBeUndefined()
    expect(tilesUrlFor('berlin')).toBeUndefined()
  })
})

describe('der Stil ohne Kacheln macht keine fremde Anfrage', () => {
  it('im Artifact bleibt nur die Hintergrundfarbe', async () => {
    const { baseStyle } = await import('../src/map-style.js')
    const stil = baseStyle(false)
    expect(stil.sources).toEqual({})
    expect(stil.layers).toHaveLength(1)
    expect(JSON.stringify(stil)).not.toMatch(/https?:\/\//)
  })

  it('ohne eigenes Archiv springen die Rasterkacheln ein', async () => {
    const { baseStyle } = await import('../src/map-style.js')
    const stil = baseStyle(true)
    expect(JSON.stringify(stil.sources)).toContain('tile.openstreetmap.org')
  })
})

describe('die Quellenangabe hängt nicht am Archiv', () => {
  /**
   * Das lokale Archiv vom 9. September hatte keine Metadaten, und MapLibre
   * nimmt die Attribution einer `pmtiles://`-Quelle aus genau diesen — das
   * „i" verschwand stillschweigend (`maplibregl-attrib-empty`). Als
   * `customAttribution` steht sie unabhängig davon.
   */
  it('nennt mit Archiv OpenStreetMap und Protomaps, ohne nur OpenStreetMap', async () => {
    vi.stubEnv('VITE_TILES_URL', 'https://kacheln.example/v20260904/')
    const mit = await import('../src/map-style.js')
    expect(mit.attributionFor(true)).toBe('© OpenStreetMap-Mitwirkende, © Protomaps')
    expect(mit.attributionFor(false)).toBe('© OpenStreetMap-Mitwirkende')
    vi.resetModules()
    vi.stubEnv('VITE_TILES_URL', '')
    const ohne = await import('../src/map-style.js')
    expect(ohne.attributionFor(true)).toBe('© OpenStreetMap-Mitwirkende')
  })
})
