/**
 * Der Standort-Vorschlag — der Teil davon, der ein Gedächtnis braucht.
 *
 * Die Entscheidung selbst liegt in `suggestCity` in `packages/core`: eine reine
 * Funktion, die mit Unfug beschossen werden kann und es in `city.test.ts` auch
 * wird. Hier steht nur, was ohne Browser keinen Sinn ergibt — welche Städte
 * jemand schon weggeklickt hat und wo das steht.
 *
 * **Keine zusätzliche Berechtigungsabfrage.** Der Vorschlag entsteht
 * ausschließlich aus einer Position, die die App ohnehin bekommt (aus
 * `locate()`, nach dem Vordialog). Ein eigenes `getCurrentPosition` nur für den
 * Hinweis wäre genau der Handel, den `LocationPrompt` vermeidet: Wer den
 * nativen Dialog einmal ablehnt, hat die Berechtigung dauerhaft verbrannt.
 */

import { suggestCity, type City } from '@knoellchenfrei/core'

import { CITY, selectableCities } from './city.js'

/**
 * Doppelpunkt wie bei `knoellchenfrei:city`, nicht Punkt wie in `storage.ts`.
 * Die Stadtwahl und ihre Ablehnung gehören zusammen; wer den einen Schlüssel
 * sucht, findet so auch den anderen.
 */
const STORAGE_KEY = 'knoellchenfrei:city-suggestion-dismissed'

/** Höher als die Zahl der Städte, damit ein gefüllter Speicher nicht wächst. */
const MAX_DISMISSED = 32

/**
 * Welche Vorschläge schon abgelehnt wurden.
 *
 * Der Inhalt wird auf dem Rückweg nicht geglaubt: `localStorage` übersteht
 * Deploys, lässt sich von Hand ändern und kann eine Form aus einem älteren
 * Build tragen. Alles, was keine Liste von Zeichenketten ist, gilt als „noch
 * nichts abgelehnt" — der Vorschlag erscheint dann eben, statt dass der
 * Aufrufer über einer kaputten Zeile stolpert.
 */
export function dismissedSuggestions(): readonly string[] {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null')
    if (!Array.isArray(raw)) return []
    return raw.filter((entry): entry is string => typeof entry === 'string').slice(0, MAX_DISMISSED)
  } catch {
    // Gesperrter Speicher oder kaputtes JSON. Beides endet gleich: Der Hinweis
    // erscheint weiter, die Ablehnung ist dann eben nicht dauerhaft.
    return []
  }
}

/** „Hier bleiben" — für diese Stadt, nicht für den Hinweis als solchen. */
export function rememberSuggestionDismissed(key: string): void {
  const kept = dismissedSuggestions()
  if (kept.includes(key)) return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...kept, key].slice(-MAX_DISMISSED)))
  } catch {
    /* ohne Speicher gilt die Ablehnung nur bis zum Neuladen */
  }
}

/**
 * Der Vorschlag zu einer Position — oder keiner.
 *
 * Eingeschränkt auf `selectableCities()`: Was diese Auslieferung gar nicht
 * laden kann, darf sie auch nicht vorschlagen.
 */
export function suggestionAt(lon: number, lat: number): City | null {
  return suggestCity(CITY, lon, lat, dismissedSuggestions(), selectableCities())
}
