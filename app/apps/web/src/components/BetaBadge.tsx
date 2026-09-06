/**
 * Sagt, woran man ist.
 *
 * Kein Banner: Der Hinweis muss stehen bleiben, solange die Beta läuft, und
 * etwas, das dauerhaft steht, darf nicht dauerhaft im Weg sein. Eine Pille in
 * der Kopfzeile ist gelesen und danach ignorierbar.
 */
export function BetaBadge() {
  if (!__BETA__) return null
  return (
    <span className="beta" title="Geschlossener Testbetrieb — noch nicht öffentlich">
      Beta
    </span>
  )
}
