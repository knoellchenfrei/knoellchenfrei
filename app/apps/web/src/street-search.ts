import type { Position } from '@knoellchenfrei/core'

/**
 * Straßensuche über Photon (komoot), seit dem 9. September nachts auf Wunsch
 * des Betreibers: „Suche erweitern um Straßennamen".
 *
 * Bis dahin war die Suche absichtlich kein Geocoder — jede Taste eine fremde
 * Anfrage, und offline nichts. Beides gilt noch, deshalb der Zuschnitt: erst
 * ab drei Zeichen, entprellt, auf den Rahmen der Stadt begrenzt, nur Straßen
 * (`osm_tag=highway`), und ein Fehler ist still — die Zonen und Bezirke vom
 * Gerät bleiben die erste Trefferliste. Gesendet wird nur der getippte Text
 * und der Stadtrahmen; die Adresse steht in `docs/datenschutz.md`.
 */
export interface StreetHit {
  name: string
  /** Stadtteil oder Ort aus der Antwort, wenn einer da ist. */
  detail: string | null
  position: Position
}

export const PHOTON = 'https://photon.komoot.io/api/'
export const MIN_QUERY = 3

export interface PhotonFeature {
  geometry?: { coordinates?: unknown }
  properties?: {
    name?: unknown
    osm_key?: unknown
    district?: unknown
    city?: unknown
    locality?: unknown
    postcode?: unknown
  }
}

/** Liest, was Photon liefert, und lässt alles fallen, was keine Straße mit Koordinate ist. */
export function parsePhoton(body: unknown): StreetHit[] {
  const features = (body as { features?: unknown })?.features
  if (!Array.isArray(features)) return []
  const seen = new Set<string>()
  const hits: StreetHit[] = []
  for (const feature of features as PhotonFeature[]) {
    const name = feature?.properties?.name
    const coords = feature?.geometry?.coordinates
    if (typeof name !== 'string' || name.trim() === '') continue
    if (!Array.isArray(coords) || coords.length < 2) continue
    const [lon, lat] = coords
    if (typeof lon !== 'number' || typeof lat !== 'number' || !Number.isFinite(lon) || !Number.isFinite(lat)) continue
    if (Math.abs(lon) > 180 || Math.abs(lat) > 90) continue
    const detailRaw = feature.properties?.district ?? feature.properties?.locality ?? null
    const detail = typeof detailRaw === 'string' && detailRaw.trim() !== '' ? detailRaw : null
    // Dieselbe Straße kommt in mehreren Stücken; einmal je Name und Stadtteil.
    const key = `${name}|${detail ?? ''}`
    if (seen.has(key)) continue
    seen.add(key)
    hits.push({ name: name.trim(), detail, position: [lon, lat] })
  }
  return hits
}

export function photonUrl(
  query: string,
  bounds: { minLon: number; minLat: number; maxLon: number; maxLat: number },
  limit = 6,
): string {
  const url = new URL(PHOTON)
  url.searchParams.set('q', query)
  url.searchParams.set('lang', 'de')
  url.searchParams.set('limit', String(limit))
  url.searchParams.set('osm_tag', 'highway')
  url.searchParams.set('bbox', [bounds.minLon, bounds.minLat, bounds.maxLon, bounds.maxLat].join(','))
  return url.toString()
}

export async function searchStreets(
  query: string,
  bounds: { minLon: number; minLat: number; maxLon: number; maxLat: number },
  signal?: AbortSignal,
): Promise<StreetHit[]> {
  const needle = query.trim()
  if (needle.length < MIN_QUERY) return []
  const response = await fetch(photonUrl(needle, bounds), {
    ...(signal === undefined ? {} : { signal }),
  })
  if (!response.ok) throw new Error(`Photon ${response.status}`)
  return parsePhoton(await response.json())
}
