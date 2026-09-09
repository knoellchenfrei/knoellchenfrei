import { EVENT_NAMES } from '@knoellchenfrei/core'

/**
 * Welche Katalogereignisse im Stand **gar nicht** vorkommen.
 *
 * Der Anlass war ein Fehler: Drei der zwölf Ereignisse wurden nie ausgelöst,
 * und auf der Seite standen sie als Dauer-Null — nicht zu unterscheiden von
 * „macht niemand". Ein Test hält das seitdem für die Quelle fest
 * (`zaehlwerk.test.ts`); die Anzeige sagt es jetzt selbst: Was im Zeitraum
 * keine einzige Zeile hat, steht in einem eigenen Block, statt als Null
 * durchzugehen (`docs/ideen.md`, Punkt 12).
 *
 * Reine Funktion, damit sie ohne DOM prüfbar ist — die Seite selbst hat
 * keine Tests und soll keine brauchen.
 */
export function nieGezaehlt(gezaehlt: readonly { name: string }[]): string[] {
  const vorhanden = new Set(gezaehlt.map((zeile) => zeile.name))
  return EVENT_NAMES.filter((name) => !vorhanden.has(name))
}
