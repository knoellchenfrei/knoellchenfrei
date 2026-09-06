import { useState } from 'react'

/**
 * Carried over from the 2012 idea list: when the car is gone, the useful thing
 * is finding out whether it was towed.
 *
 * The number is deliberately not hardcoded as fact. The one in the original idea
 * list — (030) 4664-98 7800 — no longer matches what the Berlin police publish,
 * and a wrong number here is worse than none, so the official page is the
 * primary link and the number is shown as a dated, checkable hint.
 */
const POLICE_PAGE = 'https://www.berlin.de/polizei/service/auto-fahrrad-bus/auto-wiederfinden/'
const HINT_NUMBER = '(030) 4664-709800'
const HINT_AS_OF = 'September 2026'

export function TowInfo() {
  const [open, setOpen] = useState(false)

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
            Falschparkende Fahrzeuge werden „umgesetzt“. Ob und wohin, weiß die Auskunfts- und
            Fahndungsstelle der Polizei Berlin. Kennzeichen und Abstellort bereithalten.
          </p>
          <a className="button" href={POLICE_PAGE} target="_blank" rel="noreferrer">
            Seite der Polizei Berlin öffnen
          </a>
          <p className="hours">
            Dort stand zuletzt {HINT_NUMBER} ({HINT_AS_OF}). Diese App prüft die Nummer nicht
            automatisch — im Zweifel gilt die offizielle Seite.
          </p>
        </div>
      )}
    </section>
  )
}
