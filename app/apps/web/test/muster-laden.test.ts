import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ZONE_UNITS } from '@knoellchenfrei/core'

import { forgetPatterns, loadPatterns, parsePatterns, patternForZone } from '../src/patterns.js'

/**
 * Die Muster vom Worker: gelesen, geprüft, sechs Stunden gehalten — und ohne
 * Worker, offline oder vor dem ersten Tageslauf einfach nicht da.
 */
const einheit = (patch: Record<string, unknown> = {}) => ({
  levels: new Array(168).fill(2),
  k: new Array(168).fill(0),
  p: new Array(168).fill(10),
  factor: 1.2,
  windows: 30,
  reports: 40,
  confirmedShare: 0.5,
  ...patch,
})
const stand = (units: Record<string, unknown> = { '12': einheit() }) => ({
  erzeugtAm: '2026-09-10T03:37:00Z',
  city: 'berlin',
  since: '2026-09-01',
  quarters: 1,
  base: 0.007,
  profile: new Array(168).fill(7),
  n: [1, 1, 1, 1, 1, 1, 1],
  cityWindows: 60,
  units,
  guete: null,
})

beforeEach(() => {
  forgetPatterns()
  vi.unstubAllEnvs()
})
afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllEnvs()
})

describe('parsePatterns', () => {
  it('liest einen Stand mit seinen Einheiten', () => {
    const gelesen = parsePatterns(stand())!
    expect(gelesen.city).toBe('berlin')
    expect(gelesen.units['12']!.windows).toBe(30)
    expect(gelesen.units['12']!.levels).toHaveLength(168)
  })

  it('lässt Einheiten mit falscher Form fallen und Unfug ganz', () => {
    const gelesen = parsePatterns(stand({ '12': einheit(), kaputt: einheit({ levels: [1, 2] }), bunt: einheit({ levels: new Array(168).fill(7) }) }))!
    expect(Object.keys(gelesen.units)).toEqual(['12'])
    for (const body of [null, 42, 'text', {}, { city: 'berlin' }, { ...stand(), n: [1, 2] }]) {
      expect(parsePatterns(body)).toBeNull()
    }
  })
})

describe('loadPatterns', () => {
  it('ist ohne Worker null und fragt nicht einmal', async () => {
    vi.stubEnv('VITE_API_BASE', '')
    const fetchMock = vi.spyOn(globalThis, 'fetch')
    expect(await loadPatterns('berlin')).toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('holt den Stand der Stadt und hält ihn sechs Stunden', async () => {
    vi.stubEnv('VITE_API_BASE', 'https://api.example/')
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(Response.json(stand()))
    const erster = await loadPatterns('berlin', 1_000)
    expect(erster?.units['12']).toBeDefined()
    expect(String(fetchMock.mock.calls[0]?.[0])).toBe('https://api.example/patterns?city=berlin')
    await loadPatterns('berlin', 1_000 + 5 * 3_600_000)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    await loadPatterns('berlin', 1_000 + 7 * 3_600_000)
    expect(fetchMock).toHaveBeenCalledTimes(2)
    // Eine andere Stadt ist ein anderer Stand.
    await loadPatterns('hamburg', 1_000 + 7 * 3_600_000)
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })

  it('ist vor dem ersten Tageslauf (404) und bei Netzfehlern null, ohne zu werfen', async () => {
    vi.stubEnv('VITE_API_BASE', 'https://api.example')
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response('', { status: 404 }))
    expect(await loadPatterns('berlin', 1)).toBeNull()
    forgetPatterns()
    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new TypeError('Failed to fetch'))
    expect(await loadPatterns('berlin', 2)).toBeNull()
  })
})

describe('patternForZone', () => {
  it('findet die Zone über ihre Einheit — in Karlsruhe den Bezirk', () => {
    const berlin = parsePatterns(stand())
    expect(patternForZone(berlin, 'berlin', '12')?.windows).toBe(30)
    expect(patternForZone(berlin, 'berlin', '999')).toBeNull()
    expect(patternForZone(null, 'berlin', '12')).toBeNull()
    const karlsruhe = parsePatterns({ ...stand(), city: 'karlsruhe', units: { 'bezirk:Durlach': einheit({ windows: 3 }) } })
    // Irgendeine Durlacher Reihe: Der Schlüssel steht in der erzeugten Liste.
    const reihe = Object.entries(ZONE_UNITS.karlsruhe!).find(([, unit]) => unit === 'bezirk:Durlach')![0]
    expect(patternForZone(karlsruhe, 'karlsruhe', reihe)?.windows).toBe(3)
  })
})
