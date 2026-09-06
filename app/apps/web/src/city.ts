/**
 * Welche Stadt diese Ansicht zeigt.
 *
 * Eine Stadt zur Zeit — dasselbe Modell wie FreiFahren, dessen Onboarding es
 * so formuliert: „zeigt Community-Meldungen für jeweils eine Stadt“. Der
 * Grund ist nicht Bequemlichkeit: Zonen, Meldungen, Heatmap und Grenzprüfung
 * gehören zusammen, und eine Karte, die Berliner Zonen über Hamburger
 * Meldungen legt, beantwortet keine Frage richtig.
 *
 * Drei Quellen, in dieser Reihenfolge:
 *
 * 1. **Die Wahl der Nutzerin**, in `localStorage`. Sie gewinnt, weil sie die
 *    jüngste und ausdrücklichste ist.
 * 2. **`VITE_CITY` zur Bauzeit** — für ein Deployment je Stadt unter eigener
 *    Adresse, wie FreiFahren es mit `hamburg.freifahren.org` macht.
 * 3. **Berlin**, weil das die Stadt ist, mit der das Projekt angefangen hat.
 *
 * Ein *unbekannter* Wert fällt in keinem der drei Fälle still zurück. Aus dem
 * Speicher wird er verworfen (dort kann alles stehen, `localStorage` übersteht
 * Deploys und lässt sich von Hand editieren); aus der Bauzeit wirft er, denn
 * ein Tippfehler in der Deployment-Konfiguration soll den Build anhalten und
 * nicht stillschweigend Berlin ausliefern.
 */

import { BERLIN, cityByKey, type City } from '@parkingzone/core'

const STORAGE_KEY = 'knoellchenfrei:city'

function fromStorage(): City | null {
  try {
    const key = localStorage.getItem(STORAGE_KEY)
    if (key === null) return null
    return cityByKey(key)
  } catch {
    // Zwei Fälle in einem: Speicher gesperrt (privates Fenster) oder ein
    // Schlüssel, den `cityByKey` nicht kennt. Beide enden hier gleich —
    // zurück zur Voreinstellung, statt eine Ausnahme durch den Modulstart
    // zu tragen und die Seite schwarz zu lassen.
    return null
  }
}

function fromBuild(): City | null {
  const configured = import.meta.env.VITE_CITY as string | undefined
  if (configured === undefined || configured === '') return null
  return cityByKey(configured)
}

export const CITY: City = fromStorage() ?? fromBuild() ?? BERLIN

/**
 * Stadt wechseln — und die Seite neu laden.
 *
 * Der Neuladen-Teil ist Absicht, keine Faulheit. Am Stadtwechsel hängen der
 * Kartenausschnitt, die Zonendaten, die Meldegrenze, die gespeicherte
 * Parksitzung, die Heatmap und der Feiertagskalender. Sie im laufenden Zustand
 * einzeln umzuhängen hieße, sechs Stellen richtig zu treffen — und die eine,
 * die man vergisst, zeigt danach Berliner Zonen mit Hamburger Grenzen. Ein
 * Neustart trifft alle sechs auf einmal.
 *
 * Die gespeicherte Parksitzung bleibt liegen: Der Leser in `storage.ts`
 * verwirft sie beim nächsten Lesen von selbst, weil sie außerhalb der Box der
 * neuen Stadt liegt. Sie hier zu löschen hieße, sie beim Zurückwechseln
 * verloren zu haben.
 */
export function switchCity(city: City): void {
  try {
    localStorage.setItem(STORAGE_KEY, city.key)
  } catch {
    // Ohne Speicher bleibt der Wechsel eine Sitzung lang bestehen, nicht länger.
  }
  window.location.reload()
}

/** Ob überhaupt jemand gewählt hat — für den Standort-Vorschlag. */
export function hasChosenCity(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) !== null
  } catch {
    return false
  }
}
