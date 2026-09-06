import { duration, until } from '../format.js'
import type { ParkingSession } from '../storage.js'

interface Props {
  session: ParkingSession
  now: number
  onSetReminder: (minutes: number | null) => void
  onClear: () => void
  onLocate: () => void
  notificationsBlocked: boolean
}

const PRESETS = [30, 60, 120]

export function ParkingTimer({
  session,
  now,
  onSetReminder,
  onClear,
  onLocate,
  notificationsBlocked,
}: Props) {
  const elapsed = now - session.startedAt
  const remaining = session.remindAt === null ? null : session.remindAt - now
  const expired = remaining !== null && remaining <= 0

  return (
    <section className={`panel timer${expired ? ' timer--expired' : ''}`} aria-label="Parkuhr">
      <header className="panel__head">
        <div>
          {/*
            The heading is the label, not the number: "12 Min." as an h2 told a
            screen reader user nothing about what the section is.
          */}
          <h2 className="panel__eyebrow">
            Geparkt {session.zone === null ? 'außerhalb einer Parkzone' : `in Zone ${session.zone}`}
          </h2>
          <p className="panel__title">{duration(elapsed)}</p>
        </div>
        <button type="button" className="button button--ghost" onClick={onLocate}>
          Auto zeigen
        </button>
      </header>

      {remaining === null ? (
        <div className="reminder">
          <p className="reminder__label">Erinnerung setzen</p>
          <div className="reminder__row">
            {PRESETS.map((minutes) => (
              <button
                key={minutes}
                type="button"
                className="button button--chip"
                onClick={() => onSetReminder(minutes)}
              >
                {minutes < 60 ? `${minutes} Min.` : `${minutes / 60} Std.`}
              </button>
            ))}
          </div>
        </div>
      ) : expired ? (
        <p className="warn warn--loud">
          {/*
            Static text in its own alert node: it is announced once when the
            reminder comes due, while the ticking duration outside it is not
            re-read every 15 seconds.
          */}
          <span role="alert" className="visually-hidden">
            Parkzeit abgelaufen.
          </span>
          Parkzeit abgelaufen seit {duration(-remaining)}
          <button type="button" className="button button--chip" onClick={() => onSetReminder(30)}>
            +30 Min.
          </button>
        </p>
      ) : (
        <p className="cost">
          Erinnerung um <strong>{until(new Date(session.remindAt ?? now), new Date(now))}</strong> — noch{' '}
          {duration(remaining)}
          <button type="button" className="button button--chip" onClick={() => onSetReminder(null)}>
            abbrechen
          </button>
        </p>
      )}

      {notificationsBlocked && remaining !== null && (
        <p className="hours">
          Benachrichtigungen sind nicht erlaubt — die Erinnerung erscheint nur, solange diese Seite
          geöffnet ist.
        </p>
      )}

      <button type="button" className="button" onClick={onClear}>
        Parkvorgang beenden
      </button>
    </section>
  )
}
