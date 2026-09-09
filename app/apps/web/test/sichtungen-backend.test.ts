import { afterEach, describe, expect, it, vi } from 'vitest'

import { fehlerText, WorkerFehler, workerBackend } from '../src/sighting-backend.js'

/**
 * Der Schreibweg zum Worker, gefunden beim Durchklicken mit drei Sitzungen am
 * 9. September: Wer die eigene Meldung gleich nach dem Absenden bewertete,
 * sah „http://…/sightings/…/confirm antwortete 404 Not Found". Zwei Fehler in
 * einem Satz — die Kennung war die lokale, nicht die des Servers, und die
 * Adresse gehört nicht in einen Toast.
 */

const antwort = (status: number, body: unknown, statusText = ''): Response =>
  new Response(JSON.stringify(body), {
    status,
    statusText,
    headers: { 'Content-Type': 'application/json' },
  })

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('report', () => {
  it('gibt die Kennung zurück, die der Worker vergeben hat', async () => {
    const fetchMock = vi.fn().mockResolvedValue(antwort(201, { id: 'srv-1' }))
    vi.stubGlobal('fetch', fetchMock)
    const backend = workerBackend('https://api.example')
    await expect(backend.report(13.405, 52.52)).resolves.toBe('srv-1')
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('https://api.example/sightings')
    expect((init.headers as Record<string, string>)['Content-Type']).toBe('application/json')
  })

  it('liefert null, wenn die Antwort keine Kennung trägt — die Meldung steht trotzdem', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 201 })))
    await expect(workerBackend('https://api.example').report(13.4, 52.5)).resolves.toBeNull()
  })

  it('wirft bei 422 mit dem Grund, nicht mit der Adresse', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(antwort(422, { error: 'x' }, 'Unprocessable')))
    const versuch = workerBackend('https://api.example').report(0, 0)
    await expect(versuch).rejects.toBeInstanceOf(WorkerFehler)
    await expect(versuch).rejects.toThrow(/ausserhalb der bekannten Städte \(422\)/)
    await expect(versuch).rejects.not.toThrow(/api\.example/)
  })
})

describe('vote', () => {
  it('nennt bei 403 die eigene Meldung als Grund', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(antwort(403, { error: 'own' }, 'Forbidden')))
    const backend = workerBackend('https://api.example')
    const sichtung = { id: 'a', lon: 13.4, lat: 52.5, reportedAt: 0, confirmations: 0, disputes: 0 }
    await expect(backend.vote(sichtung, 'confirm')).rejects.toThrow(
      'Die eigene Meldung lässt sich nicht bewerten (403)',
    )
  })
})

describe('fehlerText', () => {
  it('kennt die Antworten des Workers und lässt den Rest nackt', () => {
    expect(fehlerText(404, 'Not Found')).toMatch(/verfallen \(404\)/)
    expect(fehlerText(429, '')).toMatch(/Zu viele Meldungen/)
    expect(fehlerText(503, '')).toMatch(/nicht eingerichtet/)
    expect(fehlerText(500, 'Internal Server Error')).toBe('Der Server antwortete 500 Internal Server Error')
    expect(fehlerText(418, '')).toBe('Der Server antwortete 418')
  })
})
