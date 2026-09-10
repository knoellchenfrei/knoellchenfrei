// @vitest-environment jsdom
import { cleanup, fireEvent, render, renderHook, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { ZonePanel } from '../src/components/ZonePanel.js'
import { useZoneStatus } from '../src/useZoneStatus.js'
import type { ZoneProperties } from '../src/types.js'
import type { ZoneStats } from '@knoellchenfrei/core'

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

function zeichne(
  properties: ZoneProperties,
  nearbyMetres: number | null = null,
  rest: Partial<Pick<Parameters<typeof ZonePanel>[0], 'stats' | 'shared' | 'parked'>> = {},
) {
  const { result } = renderHook(() => useZoneStatus(properties, jetzt))
  const onPark = vi.fn()
  render(
    <ZonePanel
      properties={properties}
      status={result.current!}
      nearbyMetres={nearbyMetres}
      now={jetzt}
      onPark={onPark}
      parked={false}
      stats={null}
      shared={false}
      {...rest}
    />,
  )
  return { onPark }
}

const striche = (patch: Partial<ZoneStats> = {}): ZoneStats => ({
  today: 1,
  days7: 4,
  days28: 9,
  byDay: [0, 1, 0, 2, 0, 0, 1],
  last: { day: '2026-09-08', hour: 14, ageDays: 0 },
  ...patch,
})

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

  it('nennt bei Parkscheibe keinen Betrag — und erst recht nicht 0,00 €', () => {
    zeichne(eigenschaften({ fee: { kind: 'disc' }, rawFee: 'Parkscheibe' }))
    expect(screen.getByText(/Parkscheibe/, { selector: 'strong' })).toBeTruthy()
    expect(screen.queryByText(/0,00/)).toBeNull()
    expect(screen.queryByText(/Eine Stunde ab jetzt/)).toBeNull()
  })

  it('nennt den Stundenpreis, wenn es einen gibt', () => {
    zeichne(eigenschaften())
    // Zwischen Zahl und Zeichen steht ein geschütztes Leerzeichen, deshalb \s.
    expect(screen.getByText(/Eine Stunde ab jetzt/).textContent).toMatch(/2,00\s€/)
  })

  // Die Regel aus dem Münchner Anschluss: „Regelung nur an Schultagen" ist eine
  // Zusatzregel, aber keine, die den Status unsicher macht — das tut nur der
  // Advent. Vorher stand über jedem Münchner Gebiet „unsicher".
  it('macht aus einer Schultag-Regel kein „unsicher"', () => {
    zeichne(eigenschaften({ unmodelledRules: ['Regelung nur an Schultagen'] }))
    expect(screen.getByText('gebührenpflichtig')).toBeTruthy()
    expect(screen.queryByText(/unsicher/)).toBeNull()
  })

  it('unterscheidet ohne Striche „nichts gemeldet" von „nichts von diesem Gerät"', () => {
    zeichne(eigenschaften(), null, { stats: striche({ today: 0, days7: 0, days28: 0, last: null }), shared: false })
    expect(screen.getByText(/keine Kontrolle gemeldet — von diesem Gerät/)).toBeTruthy()
    cleanup()
    zeichne(eigenschaften(), null, { stats: striche({ today: 0, days7: 0, days28: 0, last: null }), shared: true })
    expect(screen.getByText(/keine Kontrolle gemeldet\.$/)).toBeTruthy()
  })

  it('zeigt die drei Zahlen, sieben Balken und den jüngsten Strich mit Stunde', () => {
    zeichne(eigenschaften(), null, { stats: striche(), shared: true })
    const block = screen.getByLabelText('Kontrollen in dieser Zone')
    expect(block.textContent).toContain('Heute1')
    expect(block.textContent).toContain('7 Tage4')
    expect(block.textContent).toContain('28 Tage9')
    expect(screen.getByRole('img', { name: /je Tag der letzten sieben Tage/ }).children).toHaveLength(7)
    expect(block.textContent).toContain('heute um 14 Uhr')
    cleanup()
    zeichne(eigenschaften(), null, { stats: striche({ last: { day: '2026-09-05', hour: null, ageDays: 3 } }), shared: true })
    expect(screen.getByLabelText('Kontrollen in dieser Zone').textContent).toContain('vor 3 Tagen')
  })

  it('der Parkknopf ruft onPark und wechselt geparkt seinen Text', () => {
    const { onPark } = zeichne(eigenschaften())
    fireEvent.click(screen.getByRole('button', { name: 'Hier geparkt' }))
    expect(onPark).toHaveBeenCalledTimes(1)
    cleanup()
    zeichne(eigenschaften(), null, { parked: true })
    expect(screen.getByRole('button', { name: 'Parkplatz hierher verschieben' })).toBeTruthy()
  })

  it('sagt bei einer Ortung neben der Fläche den Abstand, bei einem Treffer nicht', () => {
    zeichne(eigenschaften(), 20)
    expect(screen.getByText(/nächste Fläche, etwa 20 m entfernt/)).toBeTruthy()
    cleanup()
    zeichne(eigenschaften(), null)
    expect(screen.queryByText(/nächste Fläche/)).toBeNull()
  })
})
