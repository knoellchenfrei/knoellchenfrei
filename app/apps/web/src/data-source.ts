/**
 * Where the app gets its data and where sightings live.
 *
 * Two deployment targets with different constraints:
 *
 * - A normal static host fetches the data files and loads OpenStreetMap tiles.
 * - A published Claude Artifact runs under a CSP that blocks every external
 *   request, tiles included. There the data is inlined into the bundle and the
 *   district outlines stand in for a basemap.
 *
 * The artifact build also gets a real shared backend: the `db` capability keeps
 * sightings in a store every viewer of the link reads and writes, which is the
 * one thing a static host cannot offer without a server.
 */

/** Set by the artifact build; a plain static build leaves it undefined. */
declare global {
  interface Window {
    __PARKINGZONE_DATA__?: {
      zones: unknown
      poi: unknown
      districts: unknown
      umweltzone: unknown
      meta: unknown
    }
  }
}

export const isEmbedded = (): boolean =>
  typeof window !== 'undefined' && window.__PARKINGZONE_DATA__ !== undefined

export async function loadData(): Promise<{
  zones: any
  poi: any
  districts: any
  umweltzone: any
  meta: any
}> {
  const inlined = window.__PARKINGZONE_DATA__
  if (inlined !== undefined) return inlined as never

  const [zones, poi, districts, umweltzone, meta] = await Promise.all(
    ['zones.geojson', 'poi.geojson', 'districts.geojson', 'umweltzone.geojson', 'meta.json'].map(async (name) => {
      const response = await fetch(`./data/${name}`)
      if (!response.ok) throw new Error(`${name}: HTTP ${response.status}`)
      return response.json()
    })
  )
  return { zones, poi, districts, umweltzone, meta }
}
