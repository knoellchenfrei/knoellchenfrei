import { IconGeraete, IconMeldungen, IconOffen } from '../icons.js'
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
 * Seit dem 9. September nachts eine Leiste über die ganze Breite bis zum
 * Ebenen-Knopf, mit Symbol je Zelle, und ein Link: Die ganze Fläche führt zur
 * Statistikseite (Betreiber: „klickbar, und man kommt zur Statistik").
 */
export function LiveStats({ stats, reportsToday, shared }: Props) {
  const zahl = (wert: number | null): string => (wert === null ? (shared ? '…' : '–') : String(wert))
  const offline = !shared && stats.online === null && stats.today === null

  return (
    <a className="live" aria-label="Live-Zahlen — zur Statistik" href="/statistik/" target="_blank" rel="noreferrer">
      <span className="live__item live__item--zones">
        <IconMeldungen className="live__icon" size={18} aria-hidden="true" />
        <strong>{reportsToday}</strong>
        <span className="live__label">{reportsToday === 1 ? 'Meldung heute' : 'Meldungen heute'}</span>
      </span>
      {offline ? (
        <span
          className="live__item live__item--muted"
          title="Ohne geteilten Speicher lässt sich das nicht zählen"
        >
          <IconGeraete className="live__icon" size={18} aria-hidden="true" />
          <strong>–</strong>
          <span className="live__label">nur dieses Gerät</span>
        </span>
      ) : (
        <>
          <span className="live__item">
            <span className="live__icon live__icon--live" aria-hidden="true">
              <IconOffen size={18} />
              <span className="live__pulse" />
            </span>
            <strong>{zahl(stats.online)}</strong>
            <span className="live__label">gerade offen</span>
          </span>
          <span className="live__item">
            <IconGeraete className="live__icon" size={18} aria-hidden="true" />
            <strong>{zahl(stats.today)}</strong>
            <span className="live__label">{stats.today === 1 ? 'Gerät heute' : 'Geräte heute'}</span>
          </span>
        </>
      )}
    </a>
  )
}
