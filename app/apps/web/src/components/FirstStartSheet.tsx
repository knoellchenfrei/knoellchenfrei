import { useEffect, useRef } from 'react'

import type { City } from '@knoellchenfrei/core'

import { CITY } from '../city.js'
import { CityPicker } from './CityPicker.js'

interface Props {
  /** Eine Stadt wurde gewählt — der Aufrufer merkt sie und lädt neu. */
  onPick: (city: City) => void
  /** Die vorgegebene Stadt bleibt — der Aufrufer merkt sie, damit die Frage nicht wiederkommt. */
  onKeep: () => void
}

/**
 * Die Frage beim ersten Start: Welche Stadt?
 *
 * Bis zum 18. September bekam ein neues Gerät still Berlin. Wer in Wien
 * stand, sah Berliner Zonen, bis der Standortvorschlag kam — und der kommt
 * nur, wenn der Standort freigegeben wird. Jetzt kommt die Frage einmal,
 * vor dem Standort-Vordialog, und die Antwort bleibt im Browser (Wunsch des
 * Betreibers: „für die nächsten Aufrufe gemerkt"). Wer die Vorgabe behält,
 * wird auch nicht noch einmal gefragt.
 *
 * Ein Blatt wie die Einstellungen, kein Vollbild: Die Karte dahinter zeigt,
 * dass es eine App mit Karte ist, und die Liste ist dieselbe wie dort.
 */
export function FirstStartSheet({ onPick, onKeep }: Props) {
  const keepRef = useRef<HTMLButtonElement>(null)
  useEffect(() => keepRef.current?.focus(), [])
  return (
    <div className="sheet" role="dialog" aria-modal="true" aria-label="Stadt wählen">
      <header className="sheet__head">
        <h2 className="sheet__title">Wo parkst du?</h2>
      </header>
      <div className="sheet__body">
        <p className="sheet__hint">
          Die App zeigt eine Stadt zur Zeit. Wähle deine — sie bleibt gemerkt, wechseln geht
          jederzeit in den Einstellungen oder über das Suchfeld.
        </p>
        <CityPicker onPick={onPick} />
        <button type="button" className="button button--block" ref={keepRef} onClick={onKeep}>
          {CITY.name} behalten
        </button>
      </div>
    </div>
  )
}
