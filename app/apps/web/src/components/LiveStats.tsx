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
 * Die Zahlen unter der Kopfzeile — seit dem 9. September abends **eine
 * Karte** mit drei Kennzahlen, nicht mehr fünf Pillen in vier Zeilen.
 *
 * Der Betreiber, mit Bildschirmfoto: „Der sieht UI/UX-mässig nicht perfekt
 * aus." Er hatte recht: Beta-Marke, „97 von 103 kassieren", „1 gerade
 * offen", „5 heute" und „1 Meldung" standen als Pillen verschiedener Breite
 * untereinander, jede mit eigenem Rand, und nichts davon ordnete sich. Jetzt:
 * drei Spalten, oben die Zahl, darunter das Wort — Zonen, Meldungen,
 * Geräte. „Heute" ist raus; die Zahl beantwortet keine Frage, die jemand auf
 * der Karte hat, und steht weiter auf der Statistikseite. Die Beta-Marke sitzt
 * als kleine Ecke an der Karte, statt als eigene Pille voranzustehen.
 *
 * Es sind Ablesewerte, keine Knöpfe — deshalb ohne Zeiger-Ereignisse, damit
 * die Karte darunter Tipps bekommt.
 */
export function LiveStats({ stats, active, shared, charging }: Props) {
  const unknown = stats.online === null && stats.today === null

  return (
    <div className="live" aria-label="Live-Zahlen">
      <BetaBadge />
      {charging !== null && (
        <span className="live__item live__item--zones">
          <strong>
            {charging.now}
            <span className="live__of">/{charging.total}</span>
          </strong>
          <span className="live__label">kassieren</span>
        </span>
      )}
      <span className="live__item">
        <strong>{active}</strong>
        <span className="live__label">{active === 1 ? 'Meldung' : 'Meldungen'}</span>
      </span>
      {stats.online !== null ? (
        <span className="live__item">
          <strong>{stats.online}</strong>
          <span className="live__label">
            <span className="live__pulse" aria-hidden="true" />
            gerade offen
          </span>
        </span>
      ) : (
        <span
          className="live__item live__item--muted"
          title={unknown && !shared ? 'Ohne geteilten Speicher lässt sich das nicht zählen' : undefined}
        >
          <strong>{shared ? '…' : '–'}</strong>
          <span className="live__label">{shared ? 'gerade offen' : 'nur dieses Gerät'}</span>
        </span>
      )}
    </div>
  )
}
