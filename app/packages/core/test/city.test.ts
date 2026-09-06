import { describe, expect, it } from 'vitest'

import {
  BERLIN,
  CITIES,
  cityAt,
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

describe('cityAt', () => {
  // Der Fehler, den diese Funktion behebt: Der Worker war auf **eine** Stadt
  // konfiguriert und beantwortete genau diesen Punkt — den Hamburger
  // Rathausmarkt — mit `422 position outside Berlin`.
  it('resolves a Hamburg position to Hamburg instead of refusing it', () => {
    expect(cityAt(9.9924, 53.5503)).toBe(HAMBURG)
    expect(cityAt(13.3777, 52.5163)).toBe(BERLIN)
  })

  // Kein Rückfall auf Berlin: Zwischen den beiden Städten liegt keine, und
  // genau das muss die Antwort sein. Eine Meldung von hier als Berliner Zeile
  // zu speichern wäre falsch und nirgends zu sehen.
  it('returns undefined between the two cities', () => {
    // Lüneburger Heide, ungefähr auf halbem Weg.
    expect(cityAt(10.4, 53.0)).toBeUndefined()
    // München — eine echte Stadt, nur keine, die wir kennen.
    expect(cityAt(11.5755, 48.1374)).toBeUndefined()
  })

  it('accepts a point just inside each city and refuses one just outside', () => {
    for (const city of CITIES) {
      const { minLon, minLat, maxLon, maxLat } = city.reportBounds
      expect(cityAt(minLon + 0.001, minLat + 0.001)).toBe(city)
      expect(cityAt(maxLon - 0.001, maxLat - 0.001)).toBe(city)
      expect(cityAt(maxLon + 0.001, maxLat + 0.001)).toBeUndefined()
      expect(cityAt(minLon - 0.001, minLat - 0.001)).toBeUndefined()
    }
  })

  it('treats the edges as inside, like withinCity does', () => {
    const { minLon, minLat } = HAMBURG.reportBounds
    expect(cityAt(minLon, minLat)).toBe(HAMBURG)
  })

  it('refuses NaN and Infinity rather than picking whichever city compares first', () => {
    expect(cityAt(Number.NaN, 52.5)).toBeUndefined()
    expect(cityAt(13.4, Number.NaN)).toBeUndefined()
    expect(cityAt(Infinity, Infinity)).toBeUndefined()
  })

  it('finds every city by its own centre', () => {
    for (const city of CITIES) expect(cityAt(city.center[0], city.center[1])).toBe(city)
  })

  // "Die erste passende Stadt gewinnt" ist nur dann eine Antwort und keine
  // Auslosung, wenn kein Punkt in zwei Boxen liegt. Der Test hält das für
  // jedes künftige Paar fest, nicht nur für Berlin und Hamburg.
  it('has no point that belongs to two cities', () => {
    for (const a of CITIES) {
      for (const b of CITIES) {
        if (a === b) continue
        const disjoint =
          a.reportBounds.maxLon < b.reportBounds.minLon ||
          b.reportBounds.maxLon < a.reportBounds.minLon ||
          a.reportBounds.maxLat < b.reportBounds.minLat ||
          b.reportBounds.maxLat < a.reportBounds.minLat
        expect(disjoint).toBe(true)
      }
    }
  })

  // Eine Instanz darf die Auswahl einschränken; dann ist derselbe Punkt keine
  // Meldung mehr, statt der falschen Stadt zugeschlagen zu werden.
  it('honours a restricted list of cities', () => {
    expect(cityAt(9.9924, 53.5503, [BERLIN])).toBeUndefined()
    expect(cityAt(9.9924, 53.5503, [HAMBURG])).toBe(HAMBURG)
    expect(cityAt(13.3777, 52.5163, [])).toBeUndefined()
  })
})
