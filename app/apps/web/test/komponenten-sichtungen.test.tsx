// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { SightingPanel } from '../src/components/SightingPanel.js'

/**
 * Die Sichtungsliste als Komponente: Was eine Zeile anbietet, hängt davon
 * ab, was dieses Gerät mit ihr zu tun hatte. Genau dort lag der Befund des
 * Betreibers vom 9. September — nach dem Neuladen boten alle Zeilen wieder
 * Knöpfe an. Die E2E-Suite prüft den Weg über Speicher und Neuladen; hier
 * steht die Abbildung Zustand → Zeile, in Millisekunden statt Minuten.
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

function zeichne(overrides: Partial<Parameters<typeof SightingPanel>[0]> = {}) {
  const onConfirm = vi.fn()
  const onDispute = vi.fn()
  render(
    <SightingPanel
      sightings={[meldung('eigene', 2), meldung('bewertet', 5), meldung('fremd', 8)]}
      now={jetzt}
      onConfirm={onConfirm}
      onDispute={onDispute}
      own={(id) => id === 'eigene'}
      voted={(id) => (id === 'bewertet' ? 'dispute' : null)}
      shared={true}
      {...overrides}
    />,
  )
  return { onConfirm, onDispute }
}

describe('SightingPanel', () => {
  it('nennt die eigene Meldung und bietet darauf keine Stimme an', () => {
    zeichne()
    const zeilen = screen.getAllByRole('listitem')
    expect(zeilen[0]?.textContent).toContain('deine Meldung')
    expect(zeilen[0]?.querySelectorAll('button')).toHaveLength(0)
  })

  it('nennt die abgegebene Stimme statt zweier Knöpfe', () => {
    zeichne()
    const zeile = screen.getAllByRole('listitem')[1]
    expect(zeile?.textContent).toContain('du: weg')
    expect(zeile?.querySelectorAll('button')).toHaveLength(0)
  })

  it('bietet auf einer fremden Meldung genau zwei Stimmen an und reicht die Kennung durch', () => {
    const { onConfirm, onDispute } = zeichne()
    const zeile = screen.getAllByRole('listitem')[2]!
    const knoepfe = zeile.querySelectorAll('button')
    expect(knoepfe).toHaveLength(2)
    fireEvent.click(knoepfe[0]!)
    expect(onConfirm).toHaveBeenCalledWith('fremd')
    fireEvent.click(knoepfe[1]!)
    expect(onDispute).toHaveBeenCalledWith('fremd')
  })

  it('sagt ohne Meldungen, dass keine da sind — statt etwas zu zeigen', () => {
    zeichne({ sightings: [] })
    expect(screen.getByText(/Keine aktuellen Sichtungen/)).toBeTruthy()
    expect(screen.queryAllByRole('listitem')).toHaveLength(0)
  })

  it('unterscheidet geteilte von lokalen Meldungen im Hinweis', () => {
    zeichne({ shared: false })
    expect(screen.getByText(/Nur auf diesem Gerät/)).toBeTruthy()
  })
})
