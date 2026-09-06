import type { LiveStats as Stats } from '../presence.js'

interface Props {
  stats: Stats
  /** Sightings currently inside the 90-minute window. */
  active: number
  /** True when any of this reaches beyond this device. */
  shared: boolean
}

/**
 * A live strip on the map: who is here, who was here today, what is reported.
 *
 * Only the last figure is knowable without a shared runtime, and the strip says
 * so rather than showing "1 online" — which would be true of every single
 * viewer and therefore tells nobody anything.
 */
export function LiveStats({ stats, active, shared }: Props) {
  const unknown = stats.online === null && stats.today === null

  return (
    <div className="live" aria-label="Live-Zahlen">
      {stats.online !== null && (
        <span className="live__item">
          <span className="live__pulse" aria-hidden="true" />
          <strong>{stats.online}</strong> {stats.online === 1 ? 'gerade offen' : 'gerade offen'}
        </span>
      )}
      {stats.today !== null && (
        <span className="live__item">
          <strong>{stats.today}</strong> heute
        </span>
      )}
      <span className="live__item">
        <strong>{active}</strong> {active === 1 ? 'Meldung' : 'Meldungen'}
      </span>
      {unknown && (
        <span className="live__item live__item--muted" title="Ohne geteilten Speicher lässt sich das nicht zählen">
          {shared ? 'zähle …' : 'nur dieses Gerät'}
        </span>
      )}
    </div>
  )
}
