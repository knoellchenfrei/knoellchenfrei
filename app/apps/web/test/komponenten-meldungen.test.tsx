// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { Notice } from '../src/components/Notice.js'
import { ReportsCard } from '../src/components/ReportsCard.js'
import { ReportsSheet } from '../src/components/ReportsSheet.js'

/**
 * Die drei neuen Bausteine vom 9. September nachts (`docs/design.md`): die
 * Meldungen-Karte unten links, das Blatt mit Reitern, die verblassende
 * Hinweis-Pille. Hier die Abbildung Zustand → Fläche, ohne Karte.
 */
afterEach(cleanup)

const jetzt = Date.UTC(2026, 8, 9, 10, 0)
const meldung = (id: string, vorMinuten: number) => ({
  id,
  lon: 13.405,
  lat: 52.52,
  reportedAt: jetzt - vorMinuten * 60_000,
  confirmations: 0,
  disputes: 0,
})

describe('ReportsCard', () => {
  it('sagt ohne Meldungen, dass keine da sind, statt zu verschwinden', () => {
    render(<ReportsCard sightings={[]} now={jetzt} zoneName={() => null} onOpen={() => undefined} />)
    expect(screen.getByText('0 aktiv')).toBeTruthy()
    expect(screen.getByText(/Keine aktuellen Kontrollen/)).toBeTruthy()
  })

  it('zeigt höchstens drei Zeilen mit Zone und Alter, und die ganze Fläche öffnet', () => {
    const onOpen = vi.fn()
    render(
      <ReportsCard
        sightings={[meldung('a', 5), meldung('b', 10), meldung('c', 15), meldung('d', 20)]}
        now={jetzt}
        zoneName={(s) => (s.id === 'a' ? 'Zone 1' : null)}
        onOpen={onOpen}
      />,
    )
    expect(screen.getByText('4 aktiv')).toBeTruthy()
    expect(screen.getAllByRole('listitem')).toHaveLength(3)
    expect(screen.getByText('Zone 1')).toBeTruthy()
    expect(screen.getAllByText('Außerhalb der Zonen')).toHaveLength(2)
    fireEvent.click(screen.getByRole('button', { name: 'Meldungen öffnen' }))
    expect(onOpen).toHaveBeenCalledTimes(1)
  })

  it('lässt Verfallenes weg', () => {
    render(<ReportsCard sightings={[meldung('alt', 120)]} now={jetzt} zoneName={() => null} onOpen={() => undefined} />)
    expect(screen.getByText('0 aktiv')).toBeTruthy()
  })
})

describe('ReportsSheet', () => {
  it('zeigt je Reiter genau einen Inhalt und schliesst über Escape', () => {
    const onClose = vi.fn()
    render(
      <ReportsSheet onClose={onClose} aktuell={<p>A</p>} zonen={<p>Z</p>} zeiten={<p>T</p>} />,
    )
    expect(screen.getByRole('tab', { name: 'Aktuell' }).getAttribute('aria-selected')).toBe('true')
    expect(screen.getByText('A')).toBeTruthy()
    expect(screen.queryByText('Z')).toBeNull()
    fireEvent.click(screen.getByRole('tab', { name: 'Zonen' }))
    expect(screen.getByText('Z')).toBeTruthy()
    expect(screen.queryByText('A')).toBeNull()
    fireEvent.click(screen.getByRole('tab', { name: 'Tageszeiten' }))
    expect(screen.getByText('T')).toBeTruthy()
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})

describe('Notice', () => {
  it('ist ohne Hinweis nichts', () => {
    const { container } = render(<Notice notice={null} leaving={false} />)
    expect(container.innerHTML).toBe('')
  })

  it('ist mit Ziel ein Link, ohne Ziel nur Text, und trägt beim Gehen die Klasse', () => {
    const { rerender } = render(
      <Notice notice={{ text: '12 Meldungen', icon: <span />, href: '/statistik/' }} leaving={false} />,
    )
    expect(screen.getByRole('link', { name: /12 Meldungen/ }).getAttribute('href')).toBe('/statistik/')
    rerender(<Notice notice={{ text: 'Meldungen aktualisiert', icon: <span /> }} leaving={true} />)
    expect(screen.queryByRole('link')).toBeNull()
    expect(screen.getByRole('status').className).toContain('notice--weg')
  })
})
