import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { loadData } from '../src/data-source.js'

/**
 * `data-source.ts` — die fünf Dateien einer Stadt, geholt zur Laufzeit.
 *
 * Warum es diesen Test gibt: Fehlt eine Datei, antwortet **kein** Server
 * dieses Projekts mit 404. Cloudflare Pages und der lokale `vite preview`
 * liefern beide die SPA-Rückfalladresse, also `index.html` mit **200 OK** und
 * `text/html`. Am 9. September nachgemessen, gegen den Vorschauserver:
 *
 *     /data/berlin/zones.geojson -> 200 application/geo+json
 *     /data/berlin/fehlt.json    -> 200 text/html
 *     /data/quatsch/meta.json    -> 200 text/html
 *
 * `response.ok` war damit wahr, und der Abbruch kam erst aus `response.json()`
 * — „Unexpected token '<'", ohne den Namen der Datei. Auf dem Schirm stand
 * eine Meldung, aus der niemand ablesen konnte, welche der fünf fehlt.
 */

interface Antwort {
  status?: number
  typ?: string
  koerper?: string
}

/** Ein `fetch`, das je Pfad antwortet — sonst die heile Datei. */
function stelleFetch(besonders: Record<string, Antwort>): void {
  vi.stubGlobal('window', {})
  vi.stubGlobal('fetch', (url: string) => {
    const eintrag = Object.entries(besonders).find(([teil]) => url.includes(teil))?.[1]
    const status = eintrag?.status ?? 200
    const typ = eintrag?.typ ?? 'application/geo+json'
    const koerper = eintrag?.koerper ?? '{"type":"FeatureCollection","features":[]}'
    return Promise.resolve({
      ok: status >= 200 && status < 300,
      status,
      headers: { get: (name: string) => (name.toLowerCase() === 'content-type' ? typ : null) },
      json: () => Promise.resolve(JSON.parse(koerper) as unknown),
    })
  })
}

beforeEach(() => {
  vi.unstubAllGlobals()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('loadData sieht auf den Inhalt, nicht nur auf den Status', () => {
  it('lädt alle fünf Dateien, wenn nichts fehlt', async () => {
    stelleFetch({})
    const daten = await loadData('berlin')
    expect(daten.zones).toEqual({ type: 'FeatureCollection', features: [] })
    expect(daten.meta).toBeDefined()
  })

  it('nennt die Datei, wenn statt ihrer die Startseite kommt', async () => {
    stelleFetch({ 'meta.json': { typ: 'text/html', koerper: 'null' } })
    await expect(loadData('berlin')).rejects.toThrow(/berlin\/meta\.json/)
    await expect(loadData('berlin')).rejects.toThrow(/HTML statt Daten/)
  })

  it('erkennt die Startseite auch mit Zeichensatz im Content-Type', async () => {
    stelleFetch({ 'zones.geojson': { typ: 'text/html; charset=utf-8', koerper: 'null' } })
    await expect(loadData('berlin')).rejects.toThrow(/HTML statt Daten/)
  })

  it('weist `application/geo+json` NICHT ab — das ist der Normalfall', async () => {
    stelleFetch({ 'zones.geojson': { typ: 'application/geo+json' } })
    await expect(loadData('berlin')).resolves.toBeDefined()
  })

  it('kommt ohne Content-Type zurecht, statt den Abruf abzuweisen', async () => {
    stelleFetch({ 'poi.geojson': { typ: '' } })
    await expect(loadData('berlin')).resolves.toBeDefined()
  })

  it('nennt die Datei auch bei kaputtem JSON', async () => {
    stelleFetch({ 'districts.geojson': { typ: 'application/geo+json', koerper: '{kaputt' } })
    await expect(loadData('berlin')).rejects.toThrow(/berlin\/districts\.geojson: kein gültiges JSON/)
  })

  it('nennt die Datei bei einem echten Fehlerstatus', async () => {
    stelleFetch({ 'umweltzone.geojson': { status: 503 } })
    await expect(loadData('berlin')).rejects.toThrow(/berlin\/umweltzone\.geojson: HTTP 503/)
  })
})
