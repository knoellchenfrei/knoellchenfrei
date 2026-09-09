// @vitest-environment jsdom
import { cleanup, render, renderHook, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { ZonePanel } from '../src/components/ZonePanel.js'
import { useZoneStatus } from '../src/useZoneStatus.js'
import type { ZoneProperties } from '../src/types.js'

/**
 * Das Zonenblatt: Überschrift, Status und der Satz über die nächste Fläche.
 * Die Wortwahl für eine Fläche ohne Nummer und der Abstand bei Karlsruhes
 * Stellplatzreihen sind beides Stellen, an denen die Anzeige schon einmal
 * etwas anderes sagte, als die Daten hergaben.
 */
afterEach(cleanup)

/** Dienstag, 9. September 2026, 10:30 Berliner Zeit — jede Zone kassiert. */
const jetzt = Date.parse('2026-09-08T10:30:00+02:00')

const eigenschaften = (patch: Partial<ZoneProperties> = {}): ZoneProperties => ({
  zone: '12',
  district: 'Mitte',
  rawHours: 'Mo-Sa 9-20 Uhr',
  rawFee: '2,00 Euro',
  note: null,
  windows: [{ weekdays: [1, 2, 3, 4, 5, 6], fromMinute: 540, toMinute: 1200 }],
  fee: { kind: 'exact', centsPerHour: 200 },
  unmodelledRules: [],
  sourceDefect: null,
  spaces: 100,
  maxStay: null,
  maxStayShare: 0,
  maxStayValues: [],
  chargingPoints: 0,
  carsharing: 0,
  ...patch,
})

function zeichne(properties: ZoneProperties, nearbyMetres: number | null = null) {
  const { result } = renderHook(() => useZoneStatus(properties, jetzt))
  render(
    <ZonePanel
      properties={properties}
      status={result.current!}
      nearbyMetres={nearbyMetres}
      now={jetzt}
      onPark={() => undefined}
      parked={false}
      stats={null}
      shared={false}
    />,
  )
}

describe('ZonePanel', () => {
  it('überschreibt eine nummerierte Zone mit ihrer Nummer und nennt den Status', () => {
    zeichne(eigenschaften())
    expect(screen.getByRole('heading', { name: 'Parkzone 12' })).toBeTruthy()
    expect(screen.getByText('gebührenpflichtig')).toBeTruthy()
  })

  it('nennt eine Hamburger Fläche mit Quell-Kennung „Bewirtschaftete Fläche"', () => {
    zeichne(eigenschaften({ zone: 'DE.HH.UP_BEWOHNERPARKGEBIETE_31973', district: 'Altona' }))
    expect(screen.getByRole('heading', { name: 'Bewirtschaftete Fläche' })).toBeTruthy()
    expect(screen.queryByText(/DE\.HH/)).toBeNull()
  })

  it('sagt bei einer Ortung neben der Fläche den Abstand, bei einem Treffer nicht', () => {
    zeichne(eigenschaften(), 20)
    expect(screen.getByText(/nächste Fläche, etwa 20 m entfernt/)).toBeTruthy()
    cleanup()
    zeichne(eigenschaften(), null)
    expect(screen.queryByText(/nächste Fläche/)).toBeNull()
  })
})
