import { activeSightings, type Sighting } from '@knoellchenfrei/core'

import { duration } from '../format.js'
import type { VoteKind } from '../storage.js'

interface Props {
  sightings: Sighting[]
  now: number
  onReport: () => void
  onConfirm: (id: string) => void
  onDispute: (id: string) => void
  /** Ob diese Meldung aus dieser Sitzung stammt — dann gibt es keine Stimme darauf. */
  own: (id: string) => boolean
  /** Welche Stimme dieses Gerät auf die Meldung schon abgegeben hat, wenn eine. */
  voted: (id: string) => VoteKind | null
  canReport: boolean
  /** True when reports reach a shared store rather than only this device. */
  shared: boolean
}

const STARS = ['', '★', '★★', '★★★']

export function SightingPanel({
  sightings,
  now,
  onReport,
  onConfirm,
  onDispute,
  own,
  voted,
  canReport,
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
        Deliberately never disabled. It was disabled until a point was set,
        and users read that as a broken button rather than as a missing step —
        twice. Pressing it now says what is missing instead of doing nothing.

        Seit dem 9. September so gross wie „Hier geparkt" und nicht mehr klein
        im Kopf: Der Betreiber hat ihn dort nicht gefunden. Ohne angetippte
        Stelle bietet das Blatt Standort, Kartenmitte und die nächsten Zonen an.
      */}
      <button type="button" className="button button--primary button--block" onClick={onReport}>
        Hier gesehen
      </button>

      <p className="hours">
        {canReport
          ? 'Gemeldet wird die zuletzt auf der Karte angetippte Stelle — oder eine Zone aus der Liste.'
          : 'Ordnungsamt unterwegs? Melde die Stelle: aus der Nähe deines Standorts oder aus der Liste.'}
      </p>

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
                {STARS[confidence.stars] || '·'}
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
                  gesehen
                </button>
                <button
                  type="button"
                  className="button button--chip"
                  onClick={() => onDispute(sighting.id)}
                  aria-label={`Sichtung von vor ${duration(confidence.ageMs)} als weg melden`}
                >
                  weg
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
