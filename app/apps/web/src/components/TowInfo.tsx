import { useState } from 'react'

import { CITY } from '../city.js'

/**
 * Aus der Ideenliste von 2012 übernommen: Wenn das Auto weg ist, ist die
 * nützliche Frage, ob es abgeschleppt wurde — und wer das weiß.
 *
 * **Bis zum 7. September stand hier Berlin fest verdrahtet**: Link, Nummer und
 * der Satz „Auskunfts- und Fahndungsstelle der Polizei Berlin", in allen vier
 * Städten. Wer in München sein Auto suchte, bekam eine Berliner
 * Telefonnummer. Das ist schlechter als gar keine Angabe, weil es aussieht wie
 * eine Auskunft — derselbe Fehler wie damals bei den Demodaten über Berliner
 * Koordinaten.
 *
 * Die Angaben stehen jetzt an der Stadt (`City.towedVehicles`), mit Quelle und
 * Prüfdatum. **Fehlen sie, verschwindet der Abschnitt** statt auf Berlin
 * zurückzufallen; die Nummer ist optional und steht nur da, wo sie sich aus
 * der amtlichen Seite belegen ließ. Im Zweifel gilt die Seite, nicht die
 * Angabe hier — deshalb ist der Link der Knopf und die Nummer die Fußnote.
 */
export function TowInfo() {
  const [open, setOpen] = useState(false)
  const info = CITY.towedVehicles
  if (info === undefined) return null

  const [jahr, monat] = info.checkedOn.split('-')
  const stand = `${['', 'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'][Number(monat)] ?? monat} ${jahr}`

  return (
    <section className="panel">
      {/* Heading wraps the button so the section shows up in a headings list. */}
      <h2 className="disclosure__heading">
        <button
          type="button"
          className="disclosure"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          aria-controls="tow-info-body"
        >
          Auto weg? <span aria-hidden="true">{open ? '−' : '+'}</span>
        </button>
      </h2>
      {open && (
        <div className="disclosure__body" id="tow-info-body">
          <p className="hours">
            Falschparkende Fahrzeuge werden „umgesetzt“. Ob und wohin, weiß die {info.authority}.
            Kennzeichen und Abstellort bereithalten.
          </p>
          <a className="button" href={info.url} target="_blank" rel="noreferrer">
            Amtliche Seite öffnen
          </a>
          <p className="hours">
            {info.phone !== undefined && <>Dort stand zuletzt {info.phone} ({stand}). </>}
            {info.note !== undefined && <>{info.note} </>}
            Diese App prüft die Angaben nicht automatisch — im Zweifel gilt die offizielle Seite.
          </p>
        </div>
      )}
    </section>
  )
}
