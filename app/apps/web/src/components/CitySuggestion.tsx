import { COUNTRY_NAMES, cityCountry, type City } from '@knoellchenfrei/core'

interface Props {
  /** Die Stadt, in der die Position liegt. */
  city: City
  /** Die Stadt, die die App gerade zeigt. */
  current: City
  onSwitch: () => void
  onStay: () => void
}

/**
 * „Dein Standort liegt in München."
 *
 * Nach FreiFahrens Vorbild („Switch to {city}? Your location looks like you are
 * in {city}."), und aus demselben Anlass: Mit der vierten Stadt ist die Liste in
 * den Einstellungen die einzige Stelle, an der jemand die Stadt überhaupt
 * findet. Wer die App in München öffnet, sieht sonst eine leere Karte und hat
 * keinen Grund zu vermuten, dass es an einer Einstellung liegt.
 *
 * Bewusst **kein** `.callout`: Der ist der stehende Vorbehalt im
 * Einstellungsblatt und wird dort auch getestet. Ein zweiter Kasten derselben
 * Klasse hat schon einmal einen Strict-Mode-Test gebrochen.
 *
 * `role="status"` statt `role="dialog"`: Der Hinweis erscheint als Folge einer
 * Standortabfrage, ohne dass jemand darauf schaut, und er sperrt nichts. Wer
 * ihn ignoriert, arbeitet in der bisherigen Stadt weiter — deshalb steht die
 * schwächere Handlung („hier bleiben") links und die stärkere rechts, wie im
 * Standort-Vordialog.
 */
export function CitySuggestion({ city, current, onSwitch, onStay }: Props) {
  // Über eine Landesgrenze wird das Land genannt: Wer in Wien steht und
  // „zu Wien wechseln" liest, soll wissen, dass damit auch Feiertage, Recht
  // und Währung wechseln — der Betreiber wollte diesen Schritt bewusst.
  const grenze = cityCountry(city) !== cityCountry(current)
  const ziel = grenze ? `${city.name} (${COUNTRY_NAMES[cityCountry(city)]})` : city.name
  return (
    <aside className="city-hint" role="status">
      <p className="city-hint__body">
        <strong>Dein Standort liegt in {ziel}.</strong> Zonen und Meldungen zeigt die App
        gerade für {current.name}
        {grenze ? ` (${COUNTRY_NAMES[cityCountry(current)]})` : ''}.
      </p>
      <div className="city-hint__actions">
        <button type="button" className="button" onClick={onStay}>
          Hier bleiben
        </button>
        <button type="button" className="button button--primary" onClick={onSwitch}>
          Zu {ziel} wechseln
        </button>
      </div>
    </aside>
  )
}
