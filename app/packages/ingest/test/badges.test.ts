import { describe, expect, it } from 'vitest'

import { badgesFuer, coverageColour } from '../src/badges.js'

/**
 * Die Regel aus CLAUDE.md: „Ein Werkzeug, das ohne Messung läuft,
 * überschreibt nichts." Am 8. September überschrieb ein Lauf ohne
 * Coverage-Messung das Abzeichen mit „unknown".
 */
describe('badgesFuer', () => {
  it('lässt das Coverage-Abzeichen ohne Messung ganz weg, statt es zu überschreiben', () => {
    const namen = badgesFuer({ coveragePct: null, testCount: '1144', e2eCount: '218' }).map(([name]) => name)
    expect(namen).toEqual(['build', 'tests', 'e2e', 'security', 'licence', 'data'])
  })

  it('schreibt mit Messung die Zahl und die Farbe der Stufe', () => {
    const svg = Object.fromEntries(badgesFuer({ coveragePct: 99.9, testCount: '', e2eCount: '' }))
    expect(svg.coverage).toContain('coverage: 99.9%')
    expect(svg.coverage).toContain(coverageColour(99.9))
    expect(svg.tests).toContain('tests: passing')
  })

  it('nennt die Testzahlen, wenn es welche gibt', () => {
    const svg = Object.fromEntries(badgesFuer({ coveragePct: null, testCount: '1144', e2eCount: '218' }))
    expect(svg.tests).toContain('tests: 1144 passing')
    expect(svg.e2e).toContain('e2e: 218 passing')
  })

  it('stuft die Farbe an den Grenzen 90 / 80 / 70', () => {
    expect(coverageColour(90)).toBe('#3fb950')
    expect(coverageColour(89.9)).toBe('#94b91e')
    expect(coverageColour(80)).toBe('#94b91e')
    expect(coverageColour(79.9)).toBe('#d29922')
    expect(coverageColour(70)).toBe('#d29922')
    expect(coverageColour(69.9)).toBe('#da3633')
  })

  it('maskiert, was in ein Attribut geht', () => {
    const svg = Object.fromEntries(badgesFuer({ coveragePct: null, testCount: '<1&"2">', e2eCount: '' }))
    expect(svg.tests).not.toContain('<1&"2">')
    expect(svg.tests).toContain('&lt;1&amp;&quot;2&quot;&gt;')
  })
})
