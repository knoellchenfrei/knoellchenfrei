import { describe, expect, it } from 'vitest'

import {
  BERLIN,
  CITIES,
  cityByKey,
  HAMBURG,
  withinCity,
  withinCitySession,
} from '../src/city.js'

describe('cityByKey', () => {
  it('finds a city by its key', () => {
    expect(cityByKey('berlin')).toBe(BERLIN)
    expect(cityByKey('hamburg')).toBe(HAMBURG)
  })

  // Der Rückfall auf Berlin ist genau der Fehler, den diese Funktion nicht
  // machen darf: Eine Hamburger Instanz mit einem Tippfehler in der
  // Konfiguration würde dann jede Hamburger Meldung mit "position outside"
  // abweisen, und im Log stünde nichts, was danach aussieht.
  it('throws on an unknown key instead of falling back', () => {
    expect(() => cityByKey('münchen')).toThrow(/münchen/)
    expect(() => cityByKey('')).toThrow()
  })

  it('names the keys it does know, so the error is actionable', () => {
    expect(() => cityByKey('kiel')).toThrow(/berlin, hamburg/)
  })
})

describe('city keys', () => {
  it('keeps keys unique — a duplicate would shadow a city silently', () => {
    expect(new Set(CITIES.map((city) => city.key)).size).toBe(CITIES.length)
  })

  it('uses keys that survive a URL and a file name', () => {
    for (const city of CITIES) expect(city.key).toMatch(/^[a-z][a-z0-9-]*$/)
  })
})

describe('withinCity', () => {
  it('accepts the Brandenburger Tor for Berlin and refuses it for Hamburg', () => {
    expect(withinCity(BERLIN, 13.3777, 52.5163)).toBe(true)
    expect(withinCity(HAMBURG, 13.3777, 52.5163)).toBe(false)
  })

  it('accepts the Hamburger Rathausmarkt for Hamburg and refuses it for Berlin', () => {
    expect(withinCity(HAMBURG, 9.9924, 53.5503)).toBe(true)
    expect(withinCity(BERLIN, 9.9924, 53.5503)).toBe(false)
  })

  // Die beiden Boxen dürfen sich nicht berühren. Täten sie es, gäbe es Punkte,
  // die zwei Städten gehören, und die Frage "welche Zonendaten gelten hier"
  // hätte zwei Antworten.
  it('keeps the two boxes apart', () => {
    expect(BERLIN.reportBounds.minLon).toBeGreaterThan(HAMBURG.reportBounds.maxLon)
  })

  it('refuses NaN and Infinity rather than letting them through a comparison', () => {
    // `NaN > x` ist false, `NaN < x` auch — eine Prüfung aus zwei negierten
    // Vergleichen liesse NaN durch. Diese hier nicht.
    expect(withinCity(BERLIN, Number.NaN, 52.5)).toBe(false)
    expect(withinCity(BERLIN, 13.4, Number.NaN)).toBe(false)
    expect(withinCity(BERLIN, Infinity, 52.5)).toBe(false)
    expect(withinCity(BERLIN, 13.4, -Infinity)).toBe(false)
  })

  it('treats the edges as inside', () => {
    const { minLon, minLat, maxLon, maxLat } = BERLIN.reportBounds
    expect(withinCity(BERLIN, minLon, minLat)).toBe(true)
    expect(withinCity(BERLIN, maxLon, maxLat)).toBe(true)
  })
})

describe('withinCitySession', () => {
  it('is wider than the report box in every direction', () => {
    for (const city of CITIES) {
      expect(city.sessionBounds.minLon).toBeLessThan(city.reportBounds.minLon)
      expect(city.sessionBounds.minLat).toBeLessThan(city.reportBounds.minLat)
      expect(city.sessionBounds.maxLon).toBeGreaterThan(city.reportBounds.maxLon)
      expect(city.sessionBounds.maxLat).toBeGreaterThan(city.reportBounds.maxLat)
    }
  })

  // Wer am Stadtrand parkt und über die Grenze läuft, soll seine Uhr behalten.
  it('accepts a spot just outside the report box', () => {
    const justOutside = BERLIN.reportBounds.maxLon + 0.05
    expect(withinCity(BERLIN, justOutside, 52.5)).toBe(false)
    expect(withinCitySession(BERLIN, justOutside, 52.5)).toBe(true)
  })

  it('still refuses a spot in another city', () => {
    expect(withinCitySession(BERLIN, 9.9924, 53.5503)).toBe(false)
  })
})

describe('Kartenmittelpunkt', () => {
  it('lies inside the city it belongs to', () => {
    for (const city of CITIES) {
      expect(withinCity(city, city.center[0], city.center[1])).toBe(true)
    }
  })
})

describe('Quellenangabe', () => {
  // Der Unterschied ist Lizenzbedingung, keine Kosmetik: Berlin gibt unter
  // DL-DE/Zero heraus, Hamburg unter DL-DE/Namensnennung. Eine Oberfläche,
  // die die Hamburger Quelle verschweigt, verletzt die Lizenz.
  it('marks Hamburg as requiring attribution and Berlin as not', () => {
    expect(BERLIN.attribution.attributionRequired).toBe(false)
    expect(HAMBURG.attribution.attributionRequired).toBe(true)
  })

  it('names a licence and a link for every city', () => {
    for (const city of CITIES) {
      expect(city.attribution.licence.length).toBeGreaterThan(0)
      expect(city.attribution.licenceUrl).toMatch(/^https:\/\//)
      expect(city.attribution.source.length).toBeGreaterThan(0)
    }
  })
})
