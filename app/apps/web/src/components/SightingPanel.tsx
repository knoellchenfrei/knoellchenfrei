import { activeSightings, type Sighting } from '@knoellchenfrei/core'

import { duration } from '../format.js'
import { IconGesehen, IconStern, IconWeg } from '../icons.js'
import type { VoteKind } from '../storage.js'

interface Props {
  sightings: Sighting[]
  now: number
  onConfirm: (id: string) => void
  onDispute: (id: string) => void
  /** Ob diese Meldung aus dieser Sitzung stammt — dann gibt es keine Stimme darauf. */
  own: (id: string) => boolean
  /** Welche Stimme dieses Gerät auf die Meldung schon abgegeben hat, wenn eine. */
  voted: (id: string) => VoteKind | null
  /** True when reports reach a shared store rather than only this device. */
  shared: boolean
}

export function SightingPanel({
  sightings,
  now,
  onConfirm,
  onDispute,
  own,
  voted,
  shared,
}: Props) {
  const active = activeSightings(sightings, { now })

  return (
    <section className="panel" aria-label="Ordnungsamt-Sichtungen">
      <header className="panel__head">
        <div>
          <h2 className="panel__eyebrow">Gemeldete Sichtungen</h2>
          <p className="panel__title">{active.length} aktiv</p>
        </div>
      </header>

      {/*
        Kein Meldeknopf mehr hier, seit dem 10. September (Betreiber: „Auf der
        Aktuell-Seite sollte nicht gemeldet werden können"). Gemeldet wird
        über den roten Kreis auf der Karte; dieses Blatt liest und bewertet.
      */}
      <p className="demo-note">
        {shared ? (
          <>
            <strong>Geteilt.</strong> Meldungen sehen alle, die diesen Link öffnen.
          </>
        ) : (
          <>
            <strong>Nur auf diesem Gerät.</strong> Ohne Server bleiben Meldungen lokal.
          </>
        )}
      </p>

      {active.length === 0 ? (
        <p className="hours">Keine aktuellen Sichtungen. Meldungen verfallen nach 90 Minuten.</p>
      ) : (
        <ul className="sightings">
          {active.slice(0, 6).map(({ sighting, confidence }) => (
            <li key={sighting.id} className="sightings__item">
              {/* role="img": an aria-label on a bare span is ignored by most readers. */}
              <span
                className={`stars stars--${confidence.stars}`}
                role="img"
                aria-label={`Vertrauen ${confidence.stars} von 3`}
              >
                {[0, 1, 2].map((i) => (
                  <IconStern
                    key={i}
                    size={12}
                    fill={i < confidence.stars ? 'currentColor' : 'none'}
                    strokeWidth={i < confidence.stars ? 0 : 1.75}
                    aria-hidden="true"
                  />
                ))}
              </span>
              <span className="sightings__meta">
                vor {duration(confidence.ageMs)} ·{' '}
                {confidence.status === 'confirmed' ? 'bestätigt' : 'unbestätigt'}
              </span>
              {own(sighting.id) ? (
                // Der Worker weist die Stimme auf die eigene Meldung ab; ein
                // Knopf, der nur einen Fehler auslöst, ist kein Knopf.
                <span className="sightings__actions sightings__own">deine Meldung</span>
              ) : voted(sighting.id) !== null ? (
                // Eine Stimme je Meldung und Gerät, so hält es der Server.
                // Die Zeile sagt, welche — sonst sieht eine zweite, nicht
                // gezählte Stimme aus wie eine, die nicht angenommen wurde.
                <span className="sightings__actions sightings__own">
                  du: {voted(sighting.id) === 'confirm' ? 'gesehen' : 'weg'}
                </span>
              ) : (
              <span className="sightings__actions">
                {/*
                  Four rows of "gesehen" / "weg" are indistinguishable in a
                  list of buttons; the age makes each name unique.
                */}
                <button
                  type="button"
                  className="button button--chip"
                  onClick={() => onConfirm(sighting.id)}
                  aria-label={`Sichtung von vor ${duration(confidence.ageMs)} bestätigen`}
                >
                  <IconGesehen size={14} aria-hidden="true" /> gesehen
                </button>
                <button
                  type="button"
                  className="button button--chip"
                  onClick={() => onDispute(sighting.id)}
                  aria-label={`Sichtung von vor ${duration(confidence.ageMs)} als weg melden`}
                >
                  <IconWeg size={14} aria-hidden="true" /> weg
                </button>
              </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
