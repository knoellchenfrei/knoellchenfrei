import type { LiveStats as Stats } from '../presence.js'

interface Props {
  stats: Stats
  /** Meldungen des heutigen Berliner Kalendertags, aus der Strichliste. */
  reportsToday: number
  shared: boolean
}

/**
 * Die Zahlen unter der Kopfzeile — eine Karte mit drei Kennzahlen.
 *
 * Der Betreiber, 9. September, zweimal: Erst „sieht UI/UX-mässig nicht
 * perfekt aus" (fünf Pillen in vier Zeilen), dann: Wichtig sind, wie viele
 * die App nutzen und wie viele Meldungen heute waren — wie viele Zonen
 * kassieren, eher nicht. Also: Meldungen heute, Geräte gerade offen, Geräte
 * heute. Die Zonenzahl steht nicht mehr hier; die Farbe der Karte sagt es.
 *
 * Es sind Ablesewerte, keine Knöpfe — deshalb ohne Zeiger-Ereignisse, damit
 * die Karte darunter Tipps bekommt.
 */
export function LiveStats({ stats, reportsToday, shared }: Props) {
  const zahl = (wert: number | null): string => (wert === null ? (shared ? '…' : '–') : String(wert))
  const offline = !shared && stats.online === null && stats.today === null

  return (
    <div className="live" aria-label="Live-Zahlen">
      <span className="live__item live__item--zones">
        <strong>{reportsToday}</strong>
        <span className="live__label">{reportsToday === 1 ? 'Meldung heute' : 'Meldungen heute'}</span>
      </span>
      {offline ? (
        <span
          className="live__item live__item--muted"
          title="Ohne geteilten Speicher lässt sich das nicht zählen"
        >
          <strong>–</strong>
          <span className="live__label">nur dieses Gerät</span>
        </span>
      ) : (
        <>
          <span className="live__item">
            <strong>{zahl(stats.online)}</strong>
            <span className="live__label">
              <span className="live__pulse" aria-hidden="true" />
              gerade offen
            </span>
          </span>
          <span className="live__item">
            <strong>{zahl(stats.today)}</strong>
            <span className="live__label">{stats.today === 1 ? 'Gerät heute' : 'Geräte heute'}</span>
          </span>
        </>
      )}
    </div>
  )
}
