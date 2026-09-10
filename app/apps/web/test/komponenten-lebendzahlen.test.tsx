// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { LiveStats } from '../src/components/LiveStats.js'

/**
 * Die Kennzahlen-Leiste: drei Zahlen, und was sie sagen, wenn eine fehlt.
 * Ohne geteilten Speicher gibt es „gerade offen" und „Geräte heute" nicht —
 * dann steht dort ein Strich mit Begründung, kein Platzhalter, der nach
 * „lädt noch" aussieht.
 */
afterEach(cleanup)

describe('LiveStats', () => {
  it('ist ein Link zur Statistik in einem neuen Tab', () => {
    render(<LiveStats stats={{ online: 2, today: 7 }} reportsToday={3} shared={true} />)
    const link = screen.getByRole('link', { name: /Live-Zahlen/ })
    expect(link.getAttribute('href')).toBe('/statistik/')
    expect(link.getAttribute('target')).toBe('_blank')
  })

  it('nennt mit geteiltem Speicher alle drei Zahlen mit ihrer Bedeutung', () => {
    render(<LiveStats stats={{ online: 2, today: 7 }} reportsToday={3} shared={true} />)
    const text = screen.getByRole('link').textContent
    expect(text).toContain('3Meldungen heute')
    expect(text).toContain('2gerade offen')
    expect(text).toContain('7Geräte heute')
  })

  it('schreibt Einzahl, wo es eine ist', () => {
    render(<LiveStats stats={{ online: 1, today: 1 }} reportsToday={1} shared={true} />)
    const text = screen.getByRole('link').textContent
    expect(text).toContain('1Meldung heute')
    expect(text).toContain('1Gerät heute')
  })

  it('zeigt mit geteiltem Speicher, aber noch ohne Antwort, ein Auslassungszeichen', () => {
    render(<LiveStats stats={{ online: null, today: null }} reportsToday={0} shared={true} />)
    expect(screen.getByRole('link').textContent).toContain('…gerade offen')
    expect(screen.queryByText('nur dieses Gerät')).toBeNull()
  })

  it('zeigt ohne geteilten Speicher genau eine Zelle „nur dieses Gerät" mit Strich', () => {
    render(<LiveStats stats={{ online: null, today: null }} reportsToday={0} shared={false} />)
    const text = screen.getByRole('link').textContent
    expect(text).toContain('–nur dieses Gerät')
    expect(text).not.toContain('gerade offen')
    expect(text).not.toContain('Geräte heute')
  })
})
