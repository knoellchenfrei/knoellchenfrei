import type { ReactNode } from 'react'

export interface NoticeState {
  text: string
  icon: ReactNode
  /** Ziel eines Tipps; ohne ist die Pille nur eine Meldung. */
  href?: string
}

/**
 * Die verblassende Pille unter der Kennzahlen-Leiste — die eine Pille, die
 * bleibt (`docs/design.md`, Abschnitt 2): Sie ist kein Steuerelement, sondern
 * eine Meldung, und sie geht von selbst. Wie bei FreiFahren: „Meldungen
 * aktualisiert" nach jedem Abruf, die 28-Tage-Zahl beim Start. Das Verblassen
 * macht CSS (`.notice--weg`), damit ein Tipp in der letzten Sekunde noch trifft.
 */
export function Notice({ notice, leaving }: { notice: NoticeState | null; leaving: boolean }) {
  if (notice === null) return null
  const inner = (
    <>
      <span className="notice__icon" aria-hidden="true">
        {notice.icon}
      </span>
      {notice.text}
    </>
  )
  return (
    <div className={`notice${leaving ? ' notice--weg' : ''}`} role="status">
      {notice.href === undefined ? (
        <span className="notice__pill">{inner}</span>
      ) : (
        <a className="notice__pill notice__pill--link" href={notice.href} target="_blank" rel="noreferrer">
          {inner}
        </a>
      )}
    </div>
  )
}
