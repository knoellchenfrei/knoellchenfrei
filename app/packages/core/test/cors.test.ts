import { describe, expect, it } from 'vitest'

import { allowedOrigins, originAllowed } from '../src/cors.js'

describe('allowedOrigins', () => {
  it('liest eine Liste', () => {
    expect(allowedOrigins('https://a.de,https://b.de')).toEqual(['https://a.de', 'https://b.de'])
  })

  it('duldet Leerzeichen um die Einträge', () => {
    expect(allowedOrigins(' https://a.de , https://b.de ')).toEqual([
      'https://a.de',
      'https://b.de',
    ])
  })

  // Der Befund selbst: `''.split(',')` ist `['']`, nicht `[]`.
  it('ist ohne Konfiguration leer, nicht einelementig', () => {
    expect(allowedOrigins(undefined)).toEqual([])
    expect(allowedOrigins('')).toEqual([])
    expect(allowedOrigins('   ')).toEqual([])
  })

  it('wirft ein Komma am Zeilenende weg', () => {
    expect(allowedOrigins('https://a.de,')).toEqual(['https://a.de'])
    expect(allowedOrigins(',,https://a.de,,')).toEqual(['https://a.de'])
  })
})

describe('originAllowed', () => {
  it('lässt eine eingetragene Herkunft durch', () => {
    expect(originAllowed('https://a.de,https://b.de', 'https://b.de')).toBe(true)
  })

  it('weist eine fremde Herkunft ab', () => {
    expect(originAllowed('https://a.de', 'https://boese.de')).toBe(false)
  })

  // Regression M-097: Ohne Allowlist galt die leere Herkunft als erlaubt.
  it('weist die leere Herkunft ab — auch ohne Allowlist', () => {
    expect(originAllowed(undefined, '')).toBe(false)
    expect(originAllowed('', '')).toBe(false)
    expect(originAllowed(',', '')).toBe(false)
  })

  it('vergleicht genau, nicht mit Teilzeichenketten', () => {
    expect(originAllowed('https://a.de', 'https://a.de.boese.de')).toBe(false)
    expect(originAllowed('https://a.de', 'https://a.de/')).toBe(false)
    expect(originAllowed('https://a.de', 'http://a.de')).toBe(false)
  })
})
