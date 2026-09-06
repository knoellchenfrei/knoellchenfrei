import { useEffect, useRef, useState } from 'react'

import { MAX_FEEDBACK_LENGTH, type FeedbackKind } from '../feedback.js'

interface Props {
  onSend: (kind: FeedbackKind, text: string) => Promise<void>
  onClose: () => void
}

const KINDS: readonly { key: FeedbackKind; label: string; hint: string }[] = [
  { key: 'idee', label: 'Idee', hint: 'Was fehlt dir?' },
  { key: 'fehler', label: 'Fehler', hint: 'Was ging nicht?' },
  { key: 'sonstiges', label: 'Sonstiges', hint: 'Alles andere.' },
]

/** Ab hier wird der Zähler sichtbar — vorher ist er nur Unruhe. */
const COUNTER_FROM = MAX_FEEDBACK_LENGTH - 200

/**
 * Rückmeldung schicken, nach dem Vorbild von FreiFahrens „Send feedback".
 *
 * Zwei Abweichungen, beide bewusst:
 *
 * Es gibt **kein Kontaktfeld**. Wer keine Adresse abfragt, speichert auch keine
 * — der Preis ist, dass niemand antworten kann, und genau das steht auch da,
 * statt es offen zu lassen.
 *
 * Und es steht ein Hinweis drin, keine persönlichen Daten zu schreiben. Nicht
 * weil das jemand hören will, sondern weil Leute in ein Freitextfeld ihr
 * Kennzeichen tippen, wenn niemand sie bremst.
 */
export function FeedbackSheet({ onSend, onClose }: Props) {
  const [kind, setKind] = useState<FeedbackKind>('idee')
  const [text, setText] = useState('')
  const [state, setState] = useState<'form' | 'sending' | 'done'>('form')
  const [error, setError] = useState<string | null>(null)
  const closeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => closeRef.current?.focus(), [])

  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const trimmed = text.trim()
  const left = MAX_FEEDBACK_LENGTH - text.length

  const submit = (): void => {
    if (trimmed.length === 0 || state === 'sending') return
    setState('sending')
    setError(null)
    void onSend(kind, trimmed)
      .then(() => setState('done'))
      .catch((cause: unknown) => {
        // Der Text bleibt stehen. Ein Formular, das im Fehlerfall leert, kostet
        // den Menschen genau die Arbeit, um die man ihn gebeten hat.
        setState('form')
        setError(cause instanceof Error ? cause.message : 'unbekannter Fehler')
      })
  }

  return (
    <div className="sheet" role="dialog" aria-modal="true" aria-label="Feedback senden">
      <header className="sheet__head">
        <button
          ref={closeRef}
          type="button"
          className="sheet__back"
          onClick={onClose}
          aria-label="Schließen"
        >
          <span aria-hidden="true">‹</span>
        </button>
        <h2 className="sheet__title">Feedback senden</h2>
      </header>

      {state === 'done' ? (
        <div className="sheet__body">
          <p className="sheet__done">Angekommen. Danke.</p>
          <p className="sheet__hint">
            Antworten können wir nicht — es wird keine Adresse gespeichert. Wenn du eine Antwort
            brauchst, ist ein Issue im Repository der bessere Weg.
          </p>
          <button type="button" className="button button--primary sheet__submit" onClick={onClose}>
            Schließen
          </button>
        </div>
      ) : (
        <>
          <div className="sheet__body">
            <h3 className="sheet__label">Worum geht es?</h3>
            <div className="segmented" role="group" aria-label="Art der Rückmeldung">
              {KINDS.map((entry) => (
                <button
                  key={entry.key}
                  type="button"
                  className={`segmented__item${kind === entry.key ? ' segmented__item--on' : ''}`}
                  onClick={() => setKind(entry.key)}
                  aria-pressed={kind === entry.key}
                >
                  {entry.label}
                </button>
              ))}
            </div>

            <label className="sheet__label sheet__label--field" htmlFor="feedback-text">
              {KINDS.find((entry) => entry.key === kind)?.hint}
            </label>
            <textarea
              id="feedback-text"
              className="sheet__textarea"
              value={text}
              maxLength={MAX_FEEDBACK_LENGTH}
              rows={6}
              placeholder="Je konkreter, desto eher lässt sich etwas daraus machen."
              onChange={(event) => setText(event.target.value)}
            />
            {text.length >= COUNTER_FROM && (
              <p className="sheet__counter" aria-live="polite">
                noch {left} Zeichen
              </p>
            )}

            <p className="sheet__hint">
              Bitte keine Namen, Adressen oder Kennzeichen — auch nicht deine eigenen. Gespeichert
              wird nur, was hier steht, plus die Stunde; lesen kann es nur der Betreiber.
            </p>

            {error !== null && (
              <p className="sheet__error" role="alert">
                Konnte nicht gesendet werden: {error}. Der Text steht noch da.
              </p>
            )}
          </div>

          <footer className="sheet__foot">
            <button
              type="button"
              className="button button--primary sheet__submit"
              disabled={trimmed.length === 0 || state === 'sending'}
              onClick={submit}
            >
              {state === 'sending'
                ? 'Wird gesendet …'
                : trimmed.length === 0
                  ? 'Erst etwas schreiben'
                  : 'Absenden'}
            </button>
            <p className="sheet__note">
              Anonym. Keine Antwort möglich, weil keine Adresse erhoben wird.
            </p>
          </footer>
        </>
      )}
    </div>
  )
}
