import { useEffect, useState } from 'react'

import { install, installState, watchInstall, type InstallState } from '../pwa.js'

/** Was der Nutzer auf iOS im Teilen-Menü sucht. */
const IOS_STEPS = ['Teilen antippen', '„Zum Home-Bildschirm"', 'Hinzufügen']

export function useInstallState(): InstallState {
  const [state, setState] = useState<InstallState>(installState)
  useEffect(() => watchInstall(setState), [])
  return state
}

interface RowProps {
  state: InstallState
}

/**
 * Der Eintrag in den Einstellungen.
 *
 * Auf iOS gibt es keinen Dialog, den eine Seite öffnen könnte — Apple lässt das
 * bewusst nicht zu. Statt eines Knopfes, der nichts tut, steht dort der Weg.
 */
export function InstallRow({ state }: RowProps) {
  const [result, setResult] = useState<'dismissed' | null>(null)

  if (state.kind === 'installed') {
    return (
      <p className="install__done">
        Läuft als abgelegte App. Beim nächsten Start ist die letzte Karte auch ohne Netz da.
      </p>
    )
  }

  if (state.kind === 'ios') {
    return (
      <ol className="install__steps">
        {IOS_STEPS.map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ol>
    )
  }

  if (state.kind === 'prompt') {
    return (
      <>
        <button
          type="button"
          className="button button--primary button--block"
          onClick={() => {
            void install().then((outcome) => setResult(outcome === 'dismissed' ? 'dismissed' : null))
          }}
        >
          Auf dem Homescreen ablegen
        </button>
        {result === 'dismissed' && (
          <p className="install__note">
            Abgebrochen. Der Browser bietet es beim nächsten Besuch wieder an.
          </p>
        )}
      </>
    )
  }

  return (
    <p className="install__note">
      Dieser Browser bietet das Ablegen nicht über die Seite an. In Firefox und Chrome steht es im
      Menü unter „Zum Startbildschirm hinzufügen".
    </p>
  )
}

interface BannerProps {
  state: InstallState
  onDismiss: () => void
}

/**
 * Der Hinweis über der Karte — einmalig, wegklickbar, und erst ab dem zweiten
 * Besuch. Ein Installationsbanner beim allerersten Laden ist der Grund, warum
 * viele Leute solche Banner grundsätzlich wegtippen.
 */
export function InstallBanner({ state, onDismiss }: BannerProps) {
  if (state.kind !== 'prompt' && state.kind !== 'ios') return null

  return (
    <aside className="installbar">
      <img className="installbar__icon" src="./icon.svg" alt="" width={28} height={28} />
      <div className="installbar__text">
        <strong>Auf den Homescreen legen</strong>
        <span>
          {state.kind === 'ios'
            ? 'Teilen → „Zum Home-Bildschirm". Startet ohne Adressleiste und lädt offline.'
            : 'Startet ohne Adressleiste und zeigt die Karte auch ohne Netz.'}
        </span>
      </div>
      {state.kind === 'prompt' && (
        <button
          type="button"
          className="button button--primary installbar__go"
          onClick={() => {
            void install().finally(onDismiss)
          }}
        >
          Ablegen
        </button>
      )}
      <button
        type="button"
        className="installbar__close"
        onClick={onDismiss}
        aria-label="Hinweis ausblenden"
      >
        <span aria-hidden="true">×</span>
      </button>
    </aside>
  )
}
