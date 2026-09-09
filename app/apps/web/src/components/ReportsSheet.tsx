import { useEffect, useRef, useState, type ReactNode } from 'react'

import { IconSchliessen } from '../icons.js'

export type ReportsTab = 'aktuell' | 'zonen' | 'zeiten'

interface Props {
  onClose: () => void
  /** Die drei Reiter, in dieser Reihenfolge; der Inhalt kommt aus App.tsx. */
  aktuell: ReactNode
  zonen: ReactNode
  zeiten: ReactNode
  initial?: ReportsTab
}

const TABS: { key: ReportsTab; label: string }[] = [
  { key: 'aktuell', label: 'Aktuell' },
  { key: 'zonen', label: 'Zonen' },
  { key: 'zeiten', label: 'Tageszeiten' },
]

/**
 * Das Meldungen-Blatt: alles über Kontrollen an einem Ort, in drei Reitern —
 * wie FreiFahrens Meldungsliste, mit Reitern statt einer langen Seite
 * (Betreiber, 9. September nachts). Was hier steht, stand vorher als zwei
 * Abschnitte im Detail-Blatt unter der Zone, wo man erst hinscrollen musste.
 */
export function ReportsSheet({ onClose, aktuell, zonen, zeiten, initial = 'aktuell' }: Props) {
  const [tab, setTab] = useState<ReportsTab>(initial)
  const closeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    closeRef.current?.focus()
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="sheet sheet--reports" role="dialog" aria-modal="true" aria-label="Meldungen">
      <header className="sheet__head">
        <h2 className="sheet__title">Meldungen</h2>
        <button
          ref={closeRef}
          type="button"
          className="sheet__back sheet__back--right"
          onClick={onClose}
          aria-label="Schließen"
        >
          <IconSchliessen size={22} aria-hidden="true" />
        </button>
      </header>
      <div className="tabs" role="tablist" aria-label="Meldungen">
        {TABS.map((entry) => (
          <button
            key={entry.key}
            type="button"
            role="tab"
            id={`tab-${entry.key}`}
            aria-selected={tab === entry.key}
            aria-controls={`tabpanel-${entry.key}`}
            className={`tabs__tab${tab === entry.key ? ' tabs__tab--on' : ''}`}
            onClick={() => setTab(entry.key)}
          >
            {entry.label}
          </button>
        ))}
      </div>
      <div
        className="sheet__body"
        role="tabpanel"
        id={`tabpanel-${tab}`}
        aria-labelledby={`tab-${tab}`}
      >
        {tab === 'aktuell' ? aktuell : tab === 'zonen' ? zonen : zeiten}
      </div>
    </div>
  )
}
