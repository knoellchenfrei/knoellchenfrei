import type { LiveStats as Stats } from '../presence.js'
import { BetaBadge } from './BetaBadge.js'

interface Props {
  stats: Stats
  active: number
  shared: boolean
  /** Wie viele Zonen gerade kassieren; null, solange keine geladen sind. */
  charging: { now: number; total: number } | null
}

/**
 * Die Zahlen unter der Kopfzeile, in einer Zeile.
 *
 * Die Beta-Marke und „103 von 103 kassieren" standen bis zum 9. September in
 * einer eigenen Zeile der Kopfzeile, zwischen Zahnrad und Standort-Knopf.
 * Sie sind Ablesewerte, keine Knöpfe — und gehören deshalb zu den anderen
 * Ablesewerten, nicht zwischen die Bedienelemente. Die Kopfzeile ist damit
 * eine Zeile kürzer, und auf 320 Pixel wird die Zahl nicht mehr abgeschnitten,
 * weil diese Zeile umbrechen darf.
 */
export function LiveStats({ stats, active, shared, charging }: Props) {
  const unknown = stats.online === null && stats.today === null

  return (
    <div className="live" aria-label="Live-Zahlen">
      <BetaBadge />
      {charging !== null && (
        <span className="live__item live__item--zones">
          <strong>{charging.now}</strong> von {charging.total} kassieren
        </span>
      )}
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
