// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { ReportSheet } from '../src/components/ReportSheet.js'
import { loadZones } from '../src/zones.js'
import type { ZoneFeature } from '../src/zones.js'

/**
 * Das Meldeblatt wählt den Ort als Formularfeld, nicht als Kartengeste.
 * Zwei Tester lasen den alten, ausgegrauten Knopf als kaputt; seitdem sagt
 * das Blatt, was fehlt, und bietet die Nähe an. Hier die Auswahl-Logik ohne
 * Browser: welche Vorschläge stehen, was vorausgewählt ist, was der Knopf sagt.
 */
afterEach(cleanup)

/** Zwei Quadrate, eines um 13,40/52,52 (Zone 12), eines 0,02° östlich (Zone 34). */
function quadrat(zone: string, lon: number, lat: number): ZoneFeature {
  const d = 0.005
  return {
    properties: {
      zone,
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
    },
    geometry: {
      type: 'Polygon',
      coordinates: [
        [
          [lon - d, lat - d],
          [lon + d, lat - d],
          [lon + d, lat + d],
          [lon - d, lat + d],
          [lon - d, lat - d],
        ],
      ],
    },
  }
}

const zones = loadZones({ features: [quadrat('12', 13.4, 52.52), quadrat('34', 13.42, 52.52)] })

function zeichne(props: Partial<Parameters<typeof ReportSheet>[0]> = {}) {
  const onSubmit = vi.fn()
  render(
    <ReportSheet
      zones={zones}
      anchor={null}
      position={null}
      mapCentre={null}
      locating={false}
      preferGps={false}
      onSubmit={onSubmit}
      onClose={() => undefined}
      onFeedback={null}
      {...props}
    />,
  )
  return { onSubmit }
}

describe('ReportSheet', () => {
  it('sagt ohne jeden Bezugspunkt, was fehlt, statt einen toten Knopf zu zeigen', () => {
    zeichne()
    const knopf = screen.getByRole('button', { name: /Erst einen Ort wählen/ })
    expect(knopf).toHaveProperty('disabled', true)
  })

  it('bietet aus der Kartenmitte die nächsten Zonen an, die nächste zuerst', () => {
    zeichne({ mapCentre: [13.419, 52.52] })
    const optionen = screen.getAllByRole('button').filter((b) => b.className.includes('sheet__option'))
    expect(optionen.map((b) => b.textContent)).toEqual([
      expect.stringContaining('Zone 34'),
      expect.stringContaining('Zone 12'),
    ])
  })

  it('wählt die angetippte Stelle vor und meldet genau sie', () => {
    const { onSubmit } = zeichne({ anchor: [13.401, 52.521] })
    const knopf = screen.getByRole('button', { name: /^Melden — Zone 12/ })
    expect(knopf).toHaveProperty('disabled', false)
    fireEvent.click(knopf)
    expect(onSubmit).toHaveBeenCalledWith([13.401, 52.521])
  })

  it('lässt eine Zone aus der Liste die Vorauswahl verdrängen', () => {
    const { onSubmit } = zeichne({ anchor: [13.401, 52.521] })
    const andere = screen
      .getAllByRole('button')
      .find((b) => b.className.includes('sheet__option') && b.textContent?.includes('Zone 34'))
    fireEvent.click(andere!)
    fireEvent.click(screen.getByRole('button', { name: /^Melden — Zone 34/ }))
    const [punkt] = onSubmit.mock.calls[0] as [[number, number]]
    // Ein Punkt in der gewählten Zone, nicht die angetippte Stelle.
    expect(punkt[0]).toBeGreaterThan(13.415)
  })

  // Vom Kartenknopf: Der Betreiber will den Standort sehen und bestätigen,
  // nicht suchen — auch wenn vorher irgendwo auf die Karte getippt wurde.
  it('stellt vom Kartenknopf aus den Standort vor die angetippte Stelle', () => {
    zeichne({ anchor: [13.421, 52.521], position: [13.401, 52.521], preferGps: true })
    const optionen = screen.getAllByRole('button').filter((b) => b.className.includes('sheet__option'))
    expect(optionen[0]?.textContent).toContain('mein Standort')
    expect(optionen[0]?.textContent).toContain('Zone 12')
    expect(screen.getByRole('button', { name: /^Melden — Zone 12/ })).toHaveProperty('disabled', false)
  })

  it('lässt aus dem Blatt heraus die angetippte Stelle vorn', () => {
    zeichne({ anchor: [13.421, 52.521], position: [13.401, 52.521], preferGps: false })
    const optionen = screen.getAllByRole('button').filter((b) => b.className.includes('sheet__option'))
    expect(optionen[0]?.textContent).toContain('angetippt')
  })

  it('sagt, dass der Standort noch geholt wird, statt zu schweigen', () => {
    zeichne({ locating: true })
    expect(screen.getByRole('status').textContent).toContain('Standort wird ermittelt')
  })
})
