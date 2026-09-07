import { duration, euro, feeLabel, maxStayLabel, until } from '../format.js'
import type { ZoneStatus } from '../useZoneStatus.js'
import type { ZoneProperties } from '../types.js'

/**
 * The defect codes come from the core parser and are English by design (they
 * are logged, not shown); zone 54 exposed one to the reader verbatim.
 */
const DEFECT_LABELS: Record<string, string> = {
  'source string was duplicated': 'die Zeitangabe steht in der Quelle doppelt',
}
const defectLabel = (code: string): string => DEFECT_LABELS[code] ?? code

interface Props {
  properties: ZoneProperties
  status: ZoneStatus
  now: number
  onPark: () => void
  parked: boolean
}

export function ZonePanel({ properties, status, now, onPark, parked }: Props) {
  const { chargeable, changesAt, hourly, uncertain } = status

  return (
    <section className="panel" aria-label={`Parkzone ${properties.zone}`}>
      <header className="panel__head">
        <div>
          <p className="panel__eyebrow">{properties.district}</p>
          {/* Focus target after a search pick; tabIndex -1 keeps it out of the Tab order. */}
          <h2 className="panel__title" id="zone-panel-title" tabIndex={-1}>
            Parkzone {properties.zone}
          </h2>
        </div>
        <span
          className={`badge badge--${uncertain ? 'unsure' : chargeable ? 'paid' : 'free'}`}
        >
          {uncertain ? 'unsicher' : chargeable ? 'gebührenpflichtig' : 'keine Gebühr'}
        </span>
      </header>

      <dl className="facts">
        <div>
          <dt>Tarif</dt>
          <dd>{feeLabel(properties.fee)}</dd>
        </div>
        <div>
          <dt>{chargeable ? 'Noch bis' : 'Frei bis'}</dt>
          <dd>{changesAt === null ? 'unverändert' : until(changesAt, new Date(now))}</dd>
        </div>
        {/*
          Maximum stay is deliberately NOT a fact tile. It is set on 1-2% of a
          zone's segments; showing the most common value as the zone's rule told
          drivers "4h" where a couple of streets are limited and would reassure
          someone parked on a 1h stretch. It appears as a caveat below instead.
        */}
        {properties.spaces !== null && (
          <div>
            <dt>Stellplätze</dt>
            <dd>{properties.spaces.toLocaleString('de-DE')}</dd>
          </div>
        )}
      </dl>

      {chargeable && hourly.priced && (
        <p className="cost">
          Eine Stunde ab jetzt:{' '}
          <strong>
            {hourly.exact
              ? euro(hourly.maxCents)
              : `${euro(hourly.minCents)}–${euro(hourly.maxCents)}`}
          </strong>
          {!hourly.exact && (
            <span className="cost__hint">
              {' '}
              — die Quelle nennt für diese Zone eine Spanne, keinen festen Satz.
            </span>
          )}
        </p>
      )}

      {/*
        Kein Betrag heisst nicht 0,00 €. Ein Parkscheibengebiet kostet nichts
        und verlangt trotzdem etwas; wer ohne Scheibe steht, zahlt. Die Zahl
        wegzulassen und den Grund zu nennen ist die einzige ehrliche Form.
      */}
      {chargeable && !hourly.priced && (
        <p className="cost">
          {properties.fee.kind === 'disc' ? (
            <>
              Keine Gebühr, aber <strong>Parkscheibe</strong> — sichtbar hinter der
              Windschutzscheibe, mit der Ankunftszeit.
            </>
          ) : (
            <>
              Die Quelle nennt für dieses Gebiet <strong>keinen Tarif</strong>. Was gilt, steht
              am Automaten oder auf dem Schild.
            </>
          )}
        </p>
      )}

      {!chargeable && (
        <p className="hours">
          Keine Gebühr heißt nicht „Parken erlaubt“: Halteverbote, Ladezonen und
          reine Bewohnerplätze gelten unabhängig davon weiter.
        </p>
      )}

      {chargeable && (
        <p className="hours">
          Gilt für Besucher. Mit Bewohnerparkausweis dieser Zone zahlst du nicht.
        </p>
      )}

      {/*
        Zwei Sätze für zwei verschiedene Tatsachen, und sie dürfen sich nicht
        vermischen: Hamburgs Höchstparkdauer gilt für das ganze Gebiet und
        steht so im Feed. Berlins gilt für einzelne Abschnitte — sie als
        Zonenregel auszusprechen war dort ein gefundener Fehler.
      */}
      {typeof properties.maxStayMinutes === 'number' && (
        <p className="warn">
          Höchstparkdauer in diesem Gebiet:{' '}
          <strong>{duration(properties.maxStayMinutes * 60_000)}</strong>. Die Quelle nennt sie
          für das gesamte Gebiet; die Beschilderung vor Ort geht trotzdem vor.
        </p>
      )}

      {/*
        „Abschnitte" hiess das hier, solange nur Berlin diesen Weg ging. Mit
        Frankfurt sind es Parkscheinautomaten — dieselbe Aussage, anderes
        gezaehltes Ding. „Stellen" deckt beides, ohne einer Stadt ein Wort
        aufzudraengen, das ihre Quelle nicht benutzt.
      */}
      {properties.maxStayMinutes == null && properties.maxStay !== null && (
        <p className="warn">
          {properties.maxStayShare < 0.95 ? (
            <>
              An einzelnen Stellen dieser Zone gilt eine Höchstparkdauer von{' '}
              <strong>{properties.maxStayValues.map(maxStayLabel).join(' / ')}</strong> — nach
              Datenlage an{' '}
              {properties.maxStayShare < 0.05
                ? 'unter 5 %'
                : `rund ${Math.round(properties.maxStayShare * 100)} %`}{' '}
              der erfassten Stellen. Was für deinen Platz gilt, steht am Automaten.
            </>
          ) : properties.maxStayValues.length === 1 ? (
            /*
              Jede erfasste Stelle nennt denselben Wert. Das ist die staerkste
              Aussage, die diese Datenlage traegt — und trotzdem keine
              Gebietsregel wie in Hamburg, wo sie als Feld am Gebiet steht.
            */
            <>
              Höchstparkdauer in dieser Zone:{' '}
              <strong>{properties.maxStayValues.map(maxStayLabel).join('')}</strong> — so steht es
              an jeder erfassten Stelle. Verbindlich ist trotzdem der Automat vor Ort.
            </>
          ) : (
            <>
              Überall in dieser Zone gilt eine Höchstparkdauer, aber nicht überall dieselbe:{' '}
              <strong>{properties.maxStayValues.map(maxStayLabel).join(' / ')}</strong>. Was für
              deinen Platz gilt, steht am Automaten.
            </>
          )}
        </p>
      )}

      {/*
        The primary action sits directly under the numbers, ahead of the
        caveats. Below them it landed past the bottom of a phone sheet, so
        "Hier geparkt" was only reachable by scrolling.
      */}
      <button type="button" className="button button--primary button--block" onClick={onPark}>
        {parked ? 'Parkplatz hierher verschieben' : 'Hier geparkt'}
      </button>

      <p className="hours">
        Zeiten laut Quelle: <code>{properties.rawHours}</code>
      </p>

      {uncertain && (
        <p className="warn warn--loud">
          Heute ist ein Adventssamstag. In dieser Zone gilt dann{' '}
          <strong>{properties.unmodelledRules.join(', ')}</strong> — die Quelle legt aber nicht
          fest, welche Samstage gemeint sind. Verlass dich hier nicht auf die Anzeige, sondern auf
          den Automaten.
        </p>
      )}

      {!uncertain && properties.unmodelledRules.length > 0 && (
        <p className="warn">
          Zusatzregel, die hier nicht berechnet wird:{' '}
          <strong>{properties.unmodelledRules.join(', ')}</strong>. An Adventssamstagen gelten
          längere Zeiten als oben angezeigt.
        </p>
      )}

      {properties.sourceDefect !== null && (
        <p className="warn">
          Hinweis: Die Quellangabe dieser Zone ist fehlerhaft ({defectLabel(properties.sourceDefect)}).
        </p>
      )}

      {(properties.chargingPoints > 0 || properties.carsharing > 0) && (
        <p className="hours">
          In der Zone:{' '}
          {properties.chargingPoints > 0 && <>{properties.chargingPoints} Ladepunkte</>}
          {properties.chargingPoints > 0 && properties.carsharing > 0 && ' · '}
          {properties.carsharing > 0 && <>{properties.carsharing} Carsharing-Plätze</>}
        </p>
      )}

      {properties.note !== null && <p className="note">{properties.note}</p>}
    </section>
  )
}
