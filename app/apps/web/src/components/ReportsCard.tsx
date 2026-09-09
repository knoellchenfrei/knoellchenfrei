import { activeSightings, type Sighting } from '@knoellchenfrei/core'

import { duration } from '../format.js'
import { IconMeldungen, IconStern } from '../icons.js'

interface Props {
  sightings: readonly Sighting[]
  now: number
  /** Name der Zone, in der die Meldung liegt, oder null ausserhalb. */
  zoneName: (sighting: Sighting) => string | null
  onOpen: () => void
}

/** Wie viele Zeilen die Karte zeigt, bevor sie auf das Blatt verweist. */
export const CARD_ROWS = 3

/**
 * Unten links: die letzten Meldungen, wie FreiFahrens Liste der aktuellen
 * Meldungen (Betreiber, 9. September nachts). Eine Fläche, ein Tipp — das
 * Blatt mit allem anderen (Stimmen, Zonen, Tageszeiten) öffnet sich dahinter.
 * Ohne Meldungen sagt die Karte das, statt zu verschwinden: Eine Fläche, die
 * nur manchmal da ist, lernt niemand.
 */
export function ReportsCard({ sightings, now, zoneName, onOpen }: Props) {
  const active = activeSightings(sightings, { now })
  return (
    <button type="button" className="reports-card" onClick={onOpen} aria-label="Meldungen öffnen">
      <span className="reports-card__head">
        <IconMeldungen size={16} aria-hidden="true" />
        <strong>Meldungen</strong>
        <span className="reports-card__count">{active.length} aktiv</span>
      </span>
      {active.length === 0 ? (
        <span className="reports-card__empty">Keine aktuellen Kontrollen gemeldet.</span>
      ) : (
        <ul className="reports-card__list">
          {active.slice(0, CARD_ROWS).map(({ sighting, confidence }) => (
            <li key={sighting.id}>
              <span className="reports-card__zone">{zoneName(sighting) ?? 'Außerhalb der Zonen'}</span>
              <span className="reports-card__meta">
                vor {duration(confidence.ageMs)}
                <span
                  className={`reports-card__stars stars--${confidence.stars}`}
                  role="img"
                  aria-label={`Vertrauen ${confidence.stars} von 3`}
                >
                  {[0, 1, 2].map((i) => (
                    <IconStern
                      key={i}
                      size={11}
                      fill={i < confidence.stars ? 'currentColor' : 'none'}
                      strokeWidth={i < confidence.stars ? 0 : 1.75}
                      aria-hidden="true"
                    />
                  ))}
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </button>
  )
}
