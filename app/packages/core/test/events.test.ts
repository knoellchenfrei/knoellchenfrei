import { describe, expect, it } from 'vitest'

import { CITIES } from '../src/city.js'
import {
  clampEventCount,
  EVENT_MAX_COUNT,
  EVENT_NAMES,
  EVENTS,
  hourFor,
  isEventName,
  isEventValue,
  type EventName,
} from '../src/events.js'
import { ALL_ZONE_KEYS, ZONE_KEYS } from '../src/zone-keys.generated.js'

const listen = { zones: ALL_ZONE_KEYS, cities: CITIES.map((city) => city.key) }

describe('der Ereigniskatalog', () => {
  it('gibt jedem Ereignis eine Auflösung', () => {
    for (const name of EVENT_NAMES) {
      expect(EVENTS[name].hour, name).toMatch(/^(ort|zeit)$/)
    }
  })

  /**
   * Die Regel, auf der die ganze Bauart beruht: Ort **oder** Zeit, nie beides.
   * Ein Ereignis, dessen Ausprägung ein Ort ist, darf keine Stunde bekommen —
   * sonst ist die Zeile bei kleinen Zahlen ein Einzelereignis mit Ort und Zeit.
   */
  it('gibt keinem Ereignis mit Ortsbezug eine Stunde', () => {
    for (const name of EVENT_NAMES) {
      const werte = EVENTS[name].values
      const hatOrtsbezug = werte === 'zone' || werte === 'city'
      if (hatOrtsbezug) expect(EVENTS[name].hour, name).toBe('ort')
      expect(hourFor(name, 14), name).toBe(hatOrtsbezug ? -1 : 14)
    }
  })

  it('erhebt kein Gerätemerkmal', () => {
    const verboten = /screen|standalone|display|viewport|agent|referrer|sprache|lang/i
    for (const name of EVENT_NAMES) {
      expect(name, name).not.toMatch(verboten)
      const werte = EVENTS[name].values
      if (Array.isArray(werte)) {
        for (const wert of werte) expect(wert, `${name}=${wert}`).not.toMatch(verboten)
      }
    }
  })

  it('zählt Meldungen und Stimmen nicht doppelt — die stehen in D1', () => {
    for (const name of EVENT_NAMES) {
      expect(name, name).not.toMatch(/^sighting\./)
    }
  })
})

describe('isEventName', () => {
  it('nimmt an, was im Katalog steht', () => {
    for (const name of EVENT_NAMES) expect(isEventName(name)).toBe(true)
  })

  it('weist alles andere ab, ohne zu werfen', () => {
    for (const unfug of ['', 'zone.open ', 'ZONE.OPEN', '__proto__', 'constructor', 'toString', null, 42, {}, []]) {
      expect(isEventName(unfug), String(unfug)).toBe(false)
    }
  })
})

describe('clampEventCount', () => {
  it('lässt gewöhnliche Zahlen durch', () => {
    expect(clampEventCount(1)).toBe(1)
    expect(clampEventCount(7)).toBe(7)
  })

  it('deckelt nach oben — sonst ist eine Anfrage eine Million Öffnungen', () => {
    expect(clampEventCount(1e9)).toBe(EVENT_MAX_COUNT)
    expect(clampEventCount(EVENT_MAX_COUNT + 1)).toBe(EVENT_MAX_COUNT)
  })

  it('macht aus Unfug eine Eins, statt zu werfen', () => {
    for (const unfug of [0, -5, NaN, Infinity, -Infinity, 'viele', null, undefined, {}, []]) {
      expect(clampEventCount(unfug), String(unfug)).toBe(1)
    }
  })

  it('schneidet Nachkommastellen ab', () => {
    expect(clampEventCount(3.9)).toBe(3)
  })
})

describe('isEventValue', () => {
  it('nimmt die vorgesehenen Ausprägungen an', () => {
    expect(isEventValue('zone.answer', 'frei', listen)).toBe(true)
    expect(isEventValue('app.open', '', listen)).toBe(true)
    expect(isEventValue('city.switch', 'muenchen', listen)).toBe(true)
  })

  // Münchens Zonen heissen `Volkartstraße` und `Schönstraße Nord`. Ein
  // ASCII-Muster hätte sie still abgewiesen, und München stünde mit null
  // Zonenöffnungen da — das sähe nach „wird dort nicht benutzt" aus.
  it('nimmt Münchner Zonennamen mit Umlaut und Leerzeichen an', () => {
    const muenchen = ZONE_KEYS['muenchen'] ?? []
    const mitUmlaut = muenchen.filter((k) => /[äöüß]/.test(k))
    expect(mitUmlaut.length).toBeGreaterThan(0)
    for (const key of mitUmlaut) expect(isEventValue('zone.open', key, listen), key).toBe(true)
    const mitLeerzeichen = muenchen.filter((k) => k.includes(' '))
    expect(mitLeerzeichen.length).toBeGreaterThan(0)
  })

  it('weist eine erfundene Zone ab', () => {
    expect(isEventValue('zone.open', 'Fantasiestraße', listen)).toBe(false)
    expect(isEventValue('zone.open', '', listen)).toBe(false)
  })

  it('weist eine Ausprägung ab, die zu einem anderen Ereignis gehört', () => {
    expect(isEventValue('zone.answer', 'karte', listen)).toBe(false)
    expect(isEventValue('locate', 'deny', listen)).toBe(false)
  })

  it('weist alles ab, was keine Zeichenkette ist', () => {
    for (const unfug of [null, undefined, 42, {}, [], true]) {
      expect(isEventValue('app.open', unfug, listen), String(unfug)).toBe(false)
    }
  })
})

describe('die erzeugten Zonenkennungen', () => {
  it('kennen jede Stadt', () => {
    for (const city of CITIES) {
      expect(ZONE_KEYS[city.key]?.length ?? 0, city.name).toBeGreaterThan(0)
    }
  })

  it('sind eindeutig je Stadt', () => {
    for (const [key, werte] of Object.entries(ZONE_KEYS)) {
      expect(new Set(werte).size, key).toBe(werte.length)
    }
  })
})
