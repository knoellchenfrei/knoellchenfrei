import { describe, expect, it } from 'vitest'

import { musterZeile } from '../statistik/muster.js'

const stand = (patch: Record<string, unknown> = {}) => ({
  since: '2026-09-08',
  cityWindows: 120,
  n: [16, 16, 16, 16, 16, 15, 15],
  units: {
    '12': { levels: new Array(168).fill(3), windows: 30 },
    '77': { levels: new Array(168).fill(0), windows: 1 },
  },
  guete: null,
  ...patch,
})

describe('musterZeile', () => {
  it('sagt ohne Stand oder ohne Ernte, dass noch nichts da ist', () => {
    expect(musterZeile('Köln', null)).toBe('Köln: noch keine Ernte.')
    expect(musterZeile('Köln', stand({ since: null }))).toBe('Köln: noch keine Ernte.')
  })

  it('nennt Beginn, Fenster, Einheiten mit Stufe und Wochen — und wartet mit dem Rückwärtstest', () => {
    expect(musterZeile('Berlin', stand())).toBe(
      'Berlin: seit 8.9.2026 · 120 Fenster · 2 Einheiten mit Meldungen, 1 davon mit Stufe · bis 16 beobachtete Wochen je Wochentag · Rückwärtstest erst nach zwei abgeschlossenen Quartalen.',
    )
  })

  it('nennt den Skill, sobald es einen gibt', () => {
    const zeile = musterZeile('Berlin', stand({ guete: { quarter: '2026-Q4', skill: 0.0912, skillProfile: -0.02, brier: 0.03, windows: 900 } }))
    expect(zeile).toContain('Rückwärtstest 2026-Q4: Skill 0,09 gegen die Stadtrate, -0,02 gegen das Stadtprofil')
  })
})
