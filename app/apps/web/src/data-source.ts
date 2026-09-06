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

interface CityData {
  zones: unknown
  poi: unknown
  districts: unknown
  umweltzone: unknown
  meta: unknown
}

/**
 * Vom Artifact-Build gesetzt; ein normaler statischer Build lässt es undefiniert.
 *
 * Seit der zweiten Stadt eine Tabelle je Stadtschlüssel statt eines einzelnen
 * Datensatzes. Der Umschalter soll auch im Artifact funktionieren, und dort
 * gibt es nichts nachzuladen — also müssen beide Städte drin sein.
 */
declare global {
  interface Window {
    __PARKINGZONE_DATA__?: Record<string, CityData>
  }
}

export const isEmbedded = (): boolean =>
  typeof window !== 'undefined' && window.__PARKINGZONE_DATA__ !== undefined

/** Welche Städte diese Auslieferung überhaupt zeigen kann. */
export function availableCities(): string[] | null {
  const inlined = window.__PARKINGZONE_DATA__
  // Ein statischer Host holt die Dateien nach; dort ist jede Stadt verfügbar,
  // die es im Bündel gibt. Nur das Artifact ist auf das Eingebettete begrenzt.
  return inlined === undefined ? null : Object.keys(inlined)
}

/**
 * Lädt die Daten einer Stadt.
 *
 * Die Dateien liegen je Stadt in einem eigenen Verzeichnis und werden zur
 * Laufzeit geholt — ein Stadtwechsel lädt also nach und braucht keinen zweiten
 * Build. Vorher lagen sie flach unter `data/`; mit einer zweiten Stadt hätten
 * sie sich gegenseitig überschrieben, ohne dass irgendetwas fehlgeschlagen
 * wäre.
 */
export async function loadData(cityKey: string): Promise<{
  zones: any
  poi: any
  districts: any
  umweltzone: any
  meta: any
}> {
  const inlined = window.__PARKINGZONE_DATA__
  if (inlined !== undefined) {
    const city = inlined[cityKey]
    if (city === undefined) {
      throw new Error(`Diese Fassung enthält ${cityKey} nicht`)
    }
    return city as never
  }

  const [zones, poi, districts, umweltzone, meta] = await Promise.all(
    ['zones.geojson', 'poi.geojson', 'districts.geojson', 'umweltzone.geojson', 'meta.json'].map(async (name) => {
      const response = await fetch(`./data/${cityKey}/${name}`)
      if (!response.ok) throw new Error(`${cityKey}/${name}: HTTP ${response.status}`)
      return response.json()
    })
  )
  return { zones, poi, districts, umweltzone, meta }
}
