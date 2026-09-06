/**
 * Authoritative sources, all Geodateninfrastruktur Berlin.
 *
 * Licence throughout: Datenlizenz Deutschland Zero 2.0 — no attribution
 * required, no restrictions on use.
 *
 * srsName is requested explicitly: the services are natively EPSG:25833 and
 * reproject on request, emitting GeoJSON-conformant lon/lat. Asking for it here
 * keeps every downstream consumer free of reprojection.
 *
 * Deliberately NOT fetched: `parkplaetze:parkplaetze_aussen`, the 214,173 street
 * segments outside the S-Bahn ring. Every one of them reports
 * zone="nicht bewirtschaftet" — outside the ring nothing is metered — so the
 * whole layer answers one question, at a cost of roughly 190 MB. `zoneAt`
 * returning null already means "unmetered", and the UI says so in words.
 */

export interface Source {
  key: string
  service: string
  typeName: string
  /** Roughly what to expect, so a silently truncated fetch is visible. */
  expectedFeatures: number
}

export const SOURCES: readonly Source[] = [
  { key: 'zones', service: 'parkraumbewirtschaftung', typeName: 'parkraumbewirtschaftung:parkzonen', expectedFeatures: 103 },
  { key: 'segments', service: 'parkplaetze', typeName: 'parkplaetze:parkplaetze', expectedFeatures: 45917 },
  { key: 'parkAndRide', service: 'park_and_ride', typeName: 'park_and_ride:park_and_ride', expectedFeatures: 49 },
  { key: 'parkAndRideUmland', service: 'park_and_ride', typeName: 'park_and_ride:park_and_ride_umland', expectedFeatures: 59 },
  // One feature, 7 KB, and the only layer that answers "may I drive here at
  // all" rather than "what does parking cost".
  { key: 'lowEmissionZone', service: 'umweltzone', typeName: 'umweltzone:umweltzone', expectedFeatures: 1 },
  { key: 'accessible', service: 'behindertenparkplaetze', typeName: 'behindertenparkplaetze:bpark', expectedFeatures: 923 },
  // Context only: without a basemap the zone polygons float in the void, and
  // district outlines are enough to tell Kreuzberg from Spandau.
  { key: 'districts', service: 'alkis_ortsteile', typeName: 'alkis_ortsteile:ortsteile', expectedFeatures: 97 },
]

export function wfsUrl(source: Source): string {
  const params = new URLSearchParams({
    service: 'WFS',
    version: '2.0.0',
    request: 'GetFeature',
    typeNames: source.typeName,
    outputFormat: 'application/json',
    srsName: 'urn:ogc:def:crs:EPSG::4326',
  })
  return `https://gdi.berlin.de/services/wfs/${source.service}?${params}`
}
