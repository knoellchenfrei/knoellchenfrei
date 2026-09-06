import {
  HISTORY_DAYS,
  MIN_MARKS_FOR_PATTERN,
  type HeatActivity,
  type Heatmap,
} from '@knoellchenfrei/core'

export interface HeatTopEntry {
  label: string
  marks: number
  days: number
  weight: number
}

interface Props {
  heat: Heatmap
  activity: HeatActivity
  /** Busiest spots, already folded per zone and named. */
  top: readonly HeatTopEntry[]
  /** Weekday of the render clock, 0 = Sunday. */
  weekday: number
  /** Berlin hour of the render clock, for the "now" marker. */
  hour: number
  visible: boolean
  onToggle: () => void
  /** True when marks reach a shared store rather than only this device. */
  shared: boolean
  /** True while the picture is generated rather than reported. */
  seeded: boolean
}

const WEEKDAY_NAMES = [
  'Sonntag',
  'Montag',
  'Dienstag',
  'Mittwoch',
  'Donnerstag',
  'Freitag',
  'Samstag',
]

/** Enough bars with something in them that a shape is visible rather than implied. */
const MIN_HOURLY_MARKS = 8

/**
 * The report behind the heat layer: how much, how recent, when, and where.
 *
 * The map answers "where" with colour and nothing else. A dense-looking blob
 * from nine reports and one from nine hundred are the same picture, so every
 * figure the colour cannot carry is stated here in words.
 */
export function HeatPanel({
  heat,
  activity,
  top,
  weekday,
  hour,
  visible,
  onToggle,
  shared,
  seeded,
}: Props) {
  const missing = MIN_MARKS_FOR_PATTERN - heat.totalMarks
  const dayName = WEEKDAY_NAMES[weekday] ?? 'Tag'
  const profile = activity.byHourOnWeekday
  const peak = Math.max(...profile, 0)
  const showProfile = activity.hourlyMarks >= MIN_HOURLY_MARKS && peak > 0
  const dayPeak = Math.max(...activity.byDay, 0)
  const rest = top.reduce((sum, entry) => sum + entry.marks, 0)

  return (
    <section className="panel" aria-label="Kontrolldichte">
      <header className="panel__head">
        <div>
          <h2 className="panel__eyebrow">Kontrolldichte</h2>
          <p className="panel__title">
            {heat.hasPattern
              ? `${heat.totalMarks} Meldungen · ${heat.daysCovered} Tage`
              : 'Noch keine Auswertung'}
          </p>
        </div>
        <button
          type="button"
          className="button button--ghost"
          onClick={onToggle}
          disabled={!heat.hasPattern}
          aria-pressed={visible && heat.hasPattern}
        >
          {visible && heat.hasPattern ? 'Ausblenden' : 'Auf der Karte'}
        </button>
      </header>

      {heat.hasPattern ? (
        <>
          <dl className="report__figures">
            <div>
              <dt>Letzte 24 Stunden</dt>
              <dd>{activity.last24h}</dd>
            </div>
            <div>
              <dt>Letzte Stunde</dt>
              <dd>{activity.lastHour}</dd>
            </div>
            <div>
              <dt>Fenster</dt>
              <dd>
                {HISTORY_DAYS}<span className="report__unit"> Tage</span>
              </dd>
            </div>
          </dl>

          <div className="report__block">
            <h3 className="report__label">Letzte {HISTORY_DAYS} Tage</h3>
            <div
              className="chart chart--days"
              role="img"
              aria-label={`Meldungen je Tag über ${HISTORY_DAYS} Tage, ältester links.`}
            >
              {activity.byDay.map((count, index) => (
                <span
                  key={index}
                  className={`chart__bar${index === activity.byDay.length - 1 ? ' chart__bar--today' : ''}`}
                  style={{
                    height: `${dayPeak > 0 ? Math.max(2, Math.round((count / dayPeak) * 100)) : 2}%`,
                  }}
                  title={`vor ${activity.byDay.length - 1 - index} Tagen — ${count} ${
                    count === 1 ? 'Meldung' : 'Meldungen'
                  }`}
                />
              ))}
            </div>
            <div className="chart__axis" aria-hidden="true">
              <span>vor {HISTORY_DAYS} Tagen</span>
              <span>heute</span>
            </div>
          </div>

          {showProfile ? (
            <div className="report__block">
              <h3 className="report__label">Typischer {dayName}</h3>
              <div className="chart" role="img"
                aria-label={`Meldungen je Stunde an einem ${dayName}. ${
                  activity.peakHour === null ? '' : `Spitze um ${activity.peakHour} Uhr.`
                }`}
              >
                {profile.map((count, index) => (
                  <span
                    key={index}
                    className="chart__bar"
                    /* A zero hour still gets a hairline: a gap in the row reads
                       as missing data, an empty slot reads as a quiet hour. */
                    style={{ height: `${Math.max(2, Math.round((count / peak) * 100))}%` }}
                    title={`${index}:00 — ${count} ${count === 1 ? 'Meldung' : 'Meldungen'}`}
                  />
                ))}
                {/* A line, not a coloured bar: at an hour with no reports the
                    bar is a two-pixel stub, so the marker vanished exactly when
                    it was most worth showing. */}
                <span
                  className="chart__now"
                  style={{ left: `${((hour + 0.5) / 24) * 100}%` }}
                  aria-hidden="true"
                />
              </div>
              <div className="chart__axis" aria-hidden="true">
                <span>0</span>
                <span>6</span>
                <span>12</span>
                <span>18</span>
                <span>24</span>
              </div>
              <p className="chart__caption">
                {activity.peakHour === null ? null : <>Spitze {activity.peakHour} Uhr</>}
                {activity.quietFrom === null ? null : (
                  <span className="chart__caption-right">meist ruhig ab {activity.quietFrom} Uhr</span>
                )}
              </p>
            </div>
          ) : (
            <p className="hours">
              Ein Stundenprofil gibt es, sobald {MIN_HOURLY_MARKS} Meldungen mit Uhrzeit
              vorliegen{activity.hourlyMarks > 0 ? ` (bisher ${activity.hourlyMarks})` : ''}.
              Ältere Strichlisten haben keine — die Uhrzeit wird erst seit kurzem mitgezählt.
            </p>
          )}

          <div className="report__block">
            <h3 className="report__label">Häufige Stellen</h3>
            <ul className="heat-top">
              {top.map((entry) => (
                <li key={entry.label}>
                  <span
                    className="heat-top__bar"
                    style={{ width: `${Math.round(entry.weight * 100)}%` }}
                    aria-hidden="true"
                  />
                  <span className="heat-top__label">
                    <strong>{entry.label}</strong>
                    <span className="heat-top__value">
                      {rest > 0 ? `${Math.round((entry.marks / rest) * 100)} %` : ''}
                    </span>
                  </span>
                  <span className="heat-top__sub">
                    {entry.marks} {entry.marks === 1 ? 'Meldung' : 'Meldungen'} an {entry.days}{' '}
                    {entry.days === 1 ? 'Tag' : 'Tagen'}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <p className="hours">
            Anteile beziehen sich auf die gezeigten Stellen, die Färbung auf der Karte relativ zur
            meistgemeldeten. Jüngere Meldungen zählen mehr.
          </p>
        </>
      ) : (
        <p className="hours">
          Noch {missing} {missing === 1 ? 'Meldung' : 'Meldungen'} bis sich ein Muster zeigen
          lässt. Aus {heat.totalMarks} {heat.totalMarks === 1 ? 'Meldung' : 'Meldungen'} eine
          Karte zu färben sähe nach Wissen aus und wäre Rauschen.
        </p>
      )}

      {seeded && (
        <p className="demo-note">
          <strong>Beispielmuster.</strong> Noch niemand hat hier gemeldet — die Verteilung ist
          erzeugt, damit die Ebene etwas zeigt. Die erste echte Meldung ersetzt sie.
        </p>
      )}

      <p className="note">
        {shared
          ? 'Gezählt wird nur Tag, Stunde und ein 250-m-Feld — keine Minute, kein Bezug zum Melder.'
          : 'Nur auf diesem Gerät: gezählt werden deine eigenen Meldungen.'}{' '}
        Nach {HISTORY_DAYS} Tagen wird gelöscht.
      </p>
    </section>
  )
}
