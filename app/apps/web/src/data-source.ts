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

import type { Meta } from './types.js'
import type { ZoneFeature } from './zones.js'

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

/**
 * Was ein Datenverzeichnis einer Stadt enthält.
 *
 * Bis zum 8. September stand hier fünfmal `any` — gegen die eigene Regel
 * („kein `any`, keine nicht begründeten Casts") und ohne Begründung. Die
 * Werte kommen zwar aus dem eigenen Datenbau und nicht von fremd, aber `any`
 * schaltet die Prüfung auch für die **Verwendung** ab: `meta.zonen` statt
 * `meta.zones` wäre durchgegangen und hätte in der Fusszeile `undefined`
 * gezeigt.
 *
 * Zwei der fünf sind jetzt echt getypt, drei noch nicht — warum, steht unten
 * an ihnen. `meta` ist der wichtigste von beiden: Aus ihm liest die Fusszeile
 * Felder beim Namen, und mit `any` wäre `meta.zonen` statt `meta.zones` durch
 * die Prüfung gegangen und hätte im Betrieb `undefined` angezeigt.
 */
export interface ZonenSammlung {
  type: 'FeatureCollection'
  features: ZoneFeature[]
}

export interface StadtDaten {
  zones: ZonenSammlung
  // Diese drei bleiben ungetypt, und das ist eine offene Rechnung, keine
  // Bequemlichkeit: Der richtige Typ ist `GeoJSON.FeatureCollection` aus
  // `@types/geojson` — genau der, den `map.addSource({ data })` erwartet. Das
  // Paket liegt im Baum, aber nur **transitiv** über maplibre-gl, und pnpm
  // löst es von hier aus nicht auf (`TS2307: Cannot find module 'geojson'`).
  // Es als direkte Abhängigkeit einzutragen ist eine Änderung an den
  // Abhängigkeiten und deshalb abzusprechen; ein selbstgebauter
  // Struktur-Typ wäre kein Gewinn, weil `addSource` ihn nicht annimmt.
  // Steht als Punkt in `docs/todo.md`.
  poi: unknown
  districts: unknown
  umweltzone: unknown
  meta: Meta
}

/** Welche Städte diese Auslieferung überhaupt zeigen kann. */
export function availableCities(): string[] | null {
  const inlined = window.__PARKINGZONE_DATA__
  // Ein statischer Host holt die Dateien nach; dort ist jede Stadt verfügbar,
  // die es im Bündel gibt. Nur das Artifact ist auf das Eingebettete begrenzt.
  return inlined === undefined ? null : Object.keys(inlined)
}

/**
 * Eine Datendatei holen — und dabei auf den Inhalt sehen, nicht nur auf den
 * Status.
 *
 * Fehlt eine Datei, antwortet **kein** Server dieses Projekts mit 404: Sowohl
 * Cloudflare Pages als auch der lokale `vite preview` liefern die
 * SPA-Rückfalladresse, also `index.html` mit **200 OK** und `text/html`.
 * Gemessen am 9. September gegen den Vorschauserver:
 * `/data/berlin/fehlt.json` → `200 text/html`. `response.ok` ist damit wahr,
 * und der Fehler taucht erst eine Zeile später auf, wenn `response.json()` an
 * dem `<` scheitert — mit einer Meldung, die die Datei nicht nennt. Auf dem
 * Schirm stand dann „Daten konnten nicht geladen werden: Unexpected token
 * '<'", und welche der fünf Dateien fehlt, stand nirgends.
 *
 * Genau diese Form hat dieses Projekt schon zweimal getroffen: die fehlende
 * MapLibre-Worker-Datei (200 mit `text/html`, keine Karte, keine Meldung) und
 * der `308` auf `/index.html`, der `cache.addAll` scheitern liess. Deshalb
 * wird hier gegen **HTML** geprüft und nicht auf „ist es JSON": `.geojson`
 * kommt als `application/geo+json` heraus, eine Prüfung auf
 * `application/json` würde den Normalfall abweisen.
 */
async function holeJson<T>(pfad: string): Promise<T> {
  const response = await fetch(`./data/${pfad}`)
  if (!response.ok) throw new Error(`${pfad}: HTTP ${response.status}`)

  const typ = response.headers.get('content-type') ?? ''
  if (/\bhtml\b/i.test(typ)) {
    throw new Error(`${pfad}: HTML statt Daten — die Datei fehlt, geantwortet hat die Startseite`)
  }

  try {
    // Der einzige Cast hier, und er ist derselbe, den `response.json()` ohnehin
    // macht: Es liefert `any`. Geprüft wird der Inhalt weiter oben und beim
    // Lesen in `loadZones`, nicht durch diesen Typ.
    return (await response.json()) as T
  } catch {
    throw new Error(`${pfad}: kein gültiges JSON`)
  }
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
export async function loadData(cityKey: string): Promise<StadtDaten> {
  const inlined = window.__PARKINGZONE_DATA__
  if (inlined !== undefined) {
    const city = inlined[cityKey]
    if (city === undefined) {
      throw new Error(`Diese Fassung enthält ${cityKey} nicht`)
    }
    return city as never
  }

  // Einzeln aufgezählt statt über eine Namensliste: Nur so behält jede der
  // fünf Dateien ihren eigenen Typ, statt dass alle fünf zu einer Vereinigung
  // verschmelzen.
  const [zones, poi, districts, umweltzone, meta] = await Promise.all([
    holeJson<ZonenSammlung>(`${cityKey}/zones.geojson`),
    holeJson<unknown>(`${cityKey}/poi.geojson`),
    holeJson<unknown>(`${cityKey}/districts.geojson`),
    holeJson<unknown>(`${cityKey}/umweltzone.geojson`),
    holeJson<Meta>(`${cityKey}/meta.json`),
  ])
  return { zones, poi, districts, umweltzone, meta }
}
