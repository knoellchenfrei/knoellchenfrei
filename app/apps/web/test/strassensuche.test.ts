import { afterEach, describe, expect, it, vi } from 'vitest'

import { MIN_QUERY, parsePhoton, photonUrl, searchStreets } from '../src/street-search.js'

/**
 * Die Straßensuche über Photon, seit dem 9. September nachts. Was hier
 * steht, ist die Grenze zwischen einer fremden Antwort und dem, was die
 * Trefferliste zeigt — und die Zusicherung, dass unter drei Zeichen gar
 * nichts hinausgeht.
 */
const BOUNDS = { minLon: 13.08, minLat: 52.33, maxLon: 13.77, maxLat: 52.68 }

const feature = (name: unknown, coords: unknown, extra: Record<string, unknown> = {}) => ({
  geometry: { coordinates: coords },
  properties: { name, osm_key: 'highway', ...extra },
})

afterEach(() => vi.restoreAllMocks())

describe('parsePhoton', () => {
  it('liest Name, Stadtteil und Koordinate', () => {
    const hits = parsePhoton({
      features: [feature('Torstraße', [13.4, 52.53], { district: 'Mitte' })],
    })
    expect(hits).toEqual([{ name: 'Torstraße', detail: 'Mitte', position: [13.4, 52.53] }])
  })

  it('lässt fallen, was keinen Namen oder keine brauchbare Koordinate hat', () => {
    const hits = parsePhoton({
      features: [
        feature('', [13.4, 52.5]),
        feature('Ohne Punkt', null),
        feature('Halbe Koordinate', [13.4]),
        feature('Text', ['13.4', '52.5']),
        feature('Jenseits', [190, 52.5]),
        feature('NaN', [Number.NaN, 52.5]),
        feature('Gut', [13.4, 52.5]),
      ],
    })
    expect(hits.map((hit) => hit.name)).toEqual(['Gut'])
  })

  it('nennt dieselbe Straße je Stadtteil nur einmal', () => {
    const hits = parsePhoton({
      features: [
        feature('Hauptstraße', [13.4, 52.5], { district: 'Schöneberg' }),
        feature('Hauptstraße', [13.41, 52.51], { district: 'Schöneberg' }),
        feature('Hauptstraße', [13.5, 52.5], { district: 'Friedrichshagen' }),
      ],
    })
    expect(hits).toHaveLength(2)
  })

  it('fällt bei Unfug auf eine leere Liste zurück, nie auf einen Fehler', () => {
    for (const body of [null, undefined, 42, 'text', {}, { features: 'nein' }, { features: [null, 1, {}] }]) {
      expect(parsePhoton(body)).toEqual([])
    }
  })
})

describe('photonUrl', () => {
  it('begrenzt auf Straßen im Stadtrahmen und fragt auf Deutsch', () => {
    const url = new URL(photonUrl('Tor', BOUNDS))
    expect(url.origin).toBe('https://photon.komoot.io')
    expect(url.searchParams.get('q')).toBe('Tor')
    expect(url.searchParams.get('osm_tag')).toBe('highway')
    expect(url.searchParams.get('lang')).toBe('de')
    expect(url.searchParams.get('bbox')).toBe('13.08,52.33,13.77,52.68')
  })
})

describe('searchStreets', () => {
  it('schickt unter drei Zeichen nichts hinaus', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch')
    expect(MIN_QUERY).toBe(3)
    expect(await searchStreets('To', BOUNDS)).toEqual([])
    expect(await searchStreets('  T ', BOUNDS)).toEqual([])
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('wirft bei einer Fehlantwort, damit der Aufrufer still bleiben kann', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('', { status: 503 }))
    await expect(searchStreets('Torstr', BOUNDS)).rejects.toThrow('Photon 503')
  })

  it('liefert die gelesenen Treffer', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      Response.json({ features: [feature('Torstraße', [13.4, 52.53], { district: 'Mitte' })] }),
    )
    const hits = await searchStreets('Torstr', BOUNDS)
    expect(hits[0]?.name).toBe('Torstraße')
  })
})
