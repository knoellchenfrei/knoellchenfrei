/**
 * Ein Verlaufseintrag, solange ein Blatt offen ist.
 *
 * Auf Android schließt „Zurück" das, was zuletzt aufging — das erwartet jede
 * App, und eine PWA ohne diesen Eintrag verlässt stattdessen die Seite:
 * Einstellungen offen, Zurück gedrückt, und die App ist zu. Deshalb legt das
 * Öffnen eines Blatts einen Eintrag an, den „Zurück" wieder abräumt.
 *
 * **Ein** Eintrag für alle Blätter, nicht einer je Blatt. Der Wechsel von den
 * Einstellungen ins Feedback ersetzt den Eintrag, statt einen zweiten zu
 * legen; sonst führte „Zurück" aus dem Feedback in die Einstellungen, die der
 * Wechsel gerade geschlossen hat. Und wer das Blatt über den Knopf schließt,
 * bekommt den Eintrag ebenfalls abgeräumt — sonst wäre der nächste Druck auf
 * „Zurück" ein Druck ins Leere.
 *
 * Reine Funktionen über einer schmalen Schnittstelle, damit sie sich ohne
 * Browser prüfen lassen.
 */

export interface HistoryLike {
  readonly state: unknown
  pushState(state: unknown, unused: string): void
  replaceState(state: unknown, unused: string): void
  back(): void
}

const KEY = 'knoellchenfreiBlatt'

/** Welches Blatt der Verlaufseintrag nennt, oder null für die Grundansicht. */
export function layerOf(state: unknown): string | null {
  if (typeof state !== 'object' || state === null) return null
  const value = (state as Record<string, unknown>)[KEY]
  return typeof value === 'string' ? value : null
}

/**
 * Bringt den Verlauf auf den Stand der Oberfläche.
 *
 * `previous` und `next` sind das Blatt vor und nach der Änderung. Die Funktion
 * liest dazu, was der Verlauf gerade trägt: Nach einem „Zurück" ist der
 * Eintrag schon weg, und ein zweites `back()` ginge aus der App hinaus.
 */
export function syncLayer(history: HistoryLike, previous: string | null, next: string | null): void {
  if (previous === next) return
  const recorded = layerOf(history.state)
  if (next === null) {
    if (recorded !== null) history.back()
    return
  }
  if (recorded !== null) history.replaceState({ [KEY]: next }, '')
  else history.pushState({ [KEY]: next }, '')
}

/**
 * Räumt einen Eintrag ab, der einen Neustart überlebt hat.
 *
 * Der Verlauf merkt sich seinen Zustand über ein Neuladen hinweg; die
 * Oberfläche fängt aber ohne offenes Blatt an. Ohne diese Korrektur wäre der
 * erste Druck auf „Zurück" nach dem Neuladen wirkungslos.
 */
export function forgetStaleLayer(history: HistoryLike): void {
  if (layerOf(history.state) !== null) history.replaceState(null, '')
}
