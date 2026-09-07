/**
 * Was in den Fixtures wirklich steht — Feld für Feld.
 *
 * Die Regel dahinter hat einen Vorfall: `FrankfurtAutomatProperties.
 * bewohnerparkzone` stand als `string | null` da und ist im Feed eine **Zahl**.
 * TypeScript prüft eine gelesene JSON-Datei nicht; ein Interface über einer
 * Fixture ist eine Behauptung, kein Beweis. Der Datenbau brach damals an
 * `claimed.trim is not a function` ab — ein Glücksfall, denn er *wollte*
 * trimmen. Hätte er nur verglichen, wäre `19 === '19'` stillschweigend immer
 * falsch gewesen und alle 921 Automaten wären „ohne Bereich“ geblieben.
 *
 * Deshalb steht hier für jede Stadt die **beobachtete** Typmenge je Feld, und
 * zwar als Gleichheit, nicht als Teilmenge: Ein neues Feld, ein verschwundenes
 * Feld und ein Feld, das plötzlich eine Zahl statt einer Zeichenkette führt,
 * fallen alle drei hier auf — beim nächsten Abzug und nicht im Datenbau.
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import { BERLIN } from '../src/city.js'
import { parseFee } from '../src/parse-fee.js'
import { parseSchedule } from '../src/parse-schedule.js'
import { parseHamburgMaxStay, type HamburgZoneProperties } from '../src/hamburg.js'
import type {
  FrankfurtAutomatProperties,
  FrankfurtZoneProperties,
} from '../src/frankfurt.js'
import type { MuenchenZoneProperties } from '../src/muenchen.js'

const read = <T>(name: string): T =>
  JSON.parse(
    readFileSync(fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url)), 'utf8')
  ) as T

/** `null` ist eine eigene Antwort, kein `object` — deshalb nicht `typeof`. */
function labelOf(value: unknown): string {
  if (value === null) return 'null'
  if (Array.isArray(value)) return 'array'
  return typeof value
}

/**
 * Prüft Feldnamen und beobachtete Typen gegen die Erwartung — als Gleichheit.
 *
 * Auch die Feldnamen: Ein Feld, das der Dienst neu mitschickt, ist im Zweifel
 * eine neue Aussage über die Zone, und die will jemand gelesen haben.
 *
 * `absent` ist ein eigener Befund und nicht dasselbe wie `null`: Der Hamburger
 * Feed lässt Felder **weg** statt sie leer zu führen, und ein `row.feld.trim()`
 * unterscheidet die beiden Fälle nicht mehr — es wirft. Diese Prüfung hat den
 * Unterschied selbst erst gefunden, weil sie ihn zuerst nicht kannte.
 */
function expectShape(
  rows: readonly Record<string, unknown>[],
  expected: Readonly<Record<string, readonly string[]>>
): void {
  const observed = new Map<string, Set<string>>()
  const fields = new Set<string>()
  for (const row of rows) for (const field of Object.keys(row)) fields.add(field)
  for (const row of rows) {
    for (const field of fields) {
      const seen = observed.get(field) ?? new Set<string>()
      seen.add(field in row ? labelOf(row[field]) : 'absent')
      observed.set(field, seen)
    }
  }
  expect([...observed.keys()].sort()).toEqual(Object.keys(expected).sort())
  for (const [field, types] of Object.entries(expected)) {
    expect([...(observed.get(field) ?? new Set())].sort(), field).toEqual([...types].sort())
  }
}

describe('Berliner Fixture', () => {
  interface RawZone {
    id: string
    parkzone: string
    bezirk: string
    zeiten: string
    gebuehr: string
    bemerkung: string | null
  }
  const ZONES = read<RawZone[]>('parkzonen-2026-09-06.json')

  it('führt genau die sechs Felder in genau diesen Typen', () => {
    expectShape(ZONES as unknown as Record<string, unknown>[], {
      id: ['string'],
      parkzone: ['string'],
      bezirk: ['string'],
      // Der einzige Feed, in dem eine Bemerkung auch fehlen darf.
      bemerkung: ['string', 'null'],
      zeiten: ['string'],
      gebuehr: ['string'],
    })
  })

  // Beide Felder gehen ungeprüft in einen Parser, der `raw.length` liest. Ein
  // `null` dort wäre kein Parse-Fehler, sondern ein `TypeError`.
  it('lässt weder Zeiten noch Gebühr leer', () => {
    for (const zone of ZONES) {
      expect(zone.zeiten.trim(), zone.parkzone).not.toBe('')
      expect(zone.gebuehr.trim(), zone.parkzone).not.toBe('')
    }
  })

  it('liefert für jede Zone mindestens ein Fenster und einen Betrag über null', () => {
    for (const zone of ZONES) {
      expect(parseSchedule(zone.zeiten).windows.length, zone.parkzone).toBeGreaterThan(0)
      const fee = parseFee(zone.gebuehr)
      const cents = fee.kind === 'range' ? fee.minCentsPerHour : fee.kind === 'exact' ? fee.centsPerHour : 0
      expect(cents, zone.parkzone).toBeGreaterThan(0)
    }
  })
})

describe('Hamburger Fixture', () => {
  const ROWS = read<HamburgZoneProperties[]>('hh-bewohnerparkgebiete-2026-09-06.json')

  it('führt genau diese zwölf Felder in genau diesen Typen', () => {
    expectShape(ROWS as unknown as Record<string, unknown>[], {
      objectid: ['number'],
      bwp_name: ['string'],
      bwp_code: ['string'],
      // Die Zahl, an der `isActiveHamburgZone` hängt. Käme sie als `"2"`, wäre
      // der Vergleich mit `2` still immer falsch und die Karte leer.
      geplant_aktiv: ['number'],
      bemerkung: ['string'],
      bewirtschaftungsart: ['string'],
      // Die fünf Felder, die der Feed weglässt statt sie leer zu führen —
      // deshalb stehen sie in `HamburgZoneProperties` mit `?`.
      sonderbewirtschaftung: ['absent', 'number'],
      bewirtschaftungszeit: ['absent', 'string'],
      // Minuten als **Zeichenkette**, nicht als Zahl.
      hoechstparkdauer: ['absent', 'string'],
      gebuehrenzone: ['absent', 'string'],
      hinweis_intern: ['absent', 'string'],
      parkstaende: ['absent', 'number'],
    })
  })

  it('schreibt die Höchstparkdauer als reine Ziffernfolge, wo es sie gibt', () => {
    let seen = 0
    for (const row of ROWS) {
      if (row.hoechstparkdauer === undefined) continue
      seen += 1
      expect(row.hoechstparkdauer, row.bwp_code ?? '').toMatch(/^\d{1,5}$/)
      const minutes = parseHamburgMaxStay(row.hoechstparkdauer)
      if (minutes !== undefined) expect(minutes).toBeGreaterThan(0)
    }
    expect(seen).toBe(145)
  })

  /**
   * Die eine Zeile ohne Bewirtschaftungszeit ist genau die eine, die
   * `isActiveHamburgZone` verwirft.
   *
   * `geplant_aktiv` trägt 2 (145-mal) und 3 (einmal), und was die Zahlen
   * bedeuten, sagt der Feed nicht. Die vorsichtige Lesart „nur der häufige
   * Wert zählt" lässt sich hier trotzdem nachmessen: Die 3 gehört zur Zeile
   * `Keine Sonderbewirtschaftung` — der Restfläche, nicht einem Gebiet. Sie
   * führt weder Zeit noch Gebühr noch Höchstparkdauer, und als geltendes
   * Gebiet ausgeliefert hiesse sie: „ganz Hamburg ist bewirtschaftet".
   */
  it('lässt genau die Zeile ohne Zeiten auch als nicht aktiv gelten', () => {
    const withoutHours = ROWS.filter((row) => row.bewirtschaftungszeit === undefined)
    expect(withoutHours).toHaveLength(1)
    expect(withoutHours[0]?.geplant_aktiv).toBe(3)
    expect(withoutHours[0]?.bwp_name).toBe('Keine Sonderbewirtschaftung')
    expect(ROWS.filter((row) => row.geplant_aktiv === 2)).toHaveLength(145)
  })

  it('führt `geplant_aktiv` nur als ganze Zahl', () => {
    for (const row of ROWS) expect(Number.isInteger(row.geplant_aktiv)).toBe(true)
  })
})

describe('Frankfurter Fixtures', () => {
  const AUTOMATS = read<FrankfurtAutomatProperties[]>('ffm-parkscheinautomaten-2026-09-07.json')
  const ZONES = read<FrankfurtZoneProperties[]>('ffm-bewohnerparken-2026-09-07.json')

  it('führt die Automaten in genau diesen Typen', () => {
    expectShape(AUTOMATS as unknown as Record<string, unknown>[], {
      // Der Vorfall, der diese ganze Datei begründet: eine **Zahl**.
      bewohnerparkzone: ['number', 'null'],
      strassenname: ['string'],
      maximal_parkdauer: ['string'],
      gebuehrenzone: ['string', 'null'],
      gebuehrenzeit: ['string'],
    })
  })

  it('führt die Bereiche in genau diesen Typen', () => {
    expectShape(ZONES as unknown as Record<string, unknown>[], {
      // In allen 42 Bereichen `null`. Das Interface lässt `string` zu, damit
      // ein künftiger Wert ankommt — beobachtet ist er nicht.
      name: ['null'],
      description: ['null'],
      nummer: ['number'],
      vti_url: ['string'],
      mitparkraumbewirtschaftung: ['number', 'null'],
    })
  })

  // `nummer` ist die einzige Identität, die der Feed vergibt, und sie wird auf
  // beiden Seiten verglichen — Automat gegen Bereich.
  it('vergibt jede Bereichsnummer genau einmal', () => {
    const numbers = ZONES.map((zone) => zone.nummer)
    expect(new Set(numbers).size).toBe(numbers.length)
    for (const automat of AUTOMATS) {
      if (automat.bewohnerparkzone === null || automat.bewohnerparkzone === undefined) continue
      expect(Number.isInteger(automat.bewohnerparkzone)).toBe(true)
    }
  })
})

describe('Münchner Fixture', () => {
  interface Fixture {
    abschnitteGesamt: number
    abschnitteOhneRegeltext: number
    regeln: { text: string; gruppe: string; anzahl: number }[]
    gebiete: MuenchenZoneProperties[]
    beispielAbschnitte: Record<string, unknown>[]
  }
  const FIXTURE = read<Fixture>('muc-parkseiten-2026-09-07.json')

  it('führt die Gebiete in genau diesen Typen', () => {
    expectShape(FIXTURE.gebiete as unknown as Record<string, unknown>[], {
      name: ['string'],
      status: ['string'],
      massnahme: ['string'],
      ueberwachung: ['string'],
      eroeffnung: ['string'],
      // Drei der 82 Gebiete führen keinen Link — als `null`, nicht als leere
      // Zeichenkette. `link.startsWith(...)` auf einem davon wirft.
      einzeluebersicht_link: ['null', 'string'],
    })
  })

  it('führt jede Regelzeile mit Text, Gruppe und Anzahl', () => {
    expect(FIXTURE.regeln.length).toBeGreaterThan(0)
    let counted = 0
    for (const rule of FIXTURE.regeln) {
      expect(typeof rule.text).toBe('string')
      expect(typeof rule.gruppe).toBe('string')
      expect(Number.isInteger(rule.anzahl)).toBe(true)
      expect(rule.anzahl).toBeGreaterThan(0)
      counted += rule.anzahl
    }
    // Die Summe der Schreibweisen plus die Zeilen ohne Regeltext ist der
    // ganze Abzug. Läuft das auseinander, fehlt eine Schreibweise im Test.
    expect(counted + FIXTURE.abschnitteOhneRegeltext).toBe(FIXTURE.abschnitteGesamt)
  })
})

/**
 * Die Geometrie-Fixture, an der `geo-real.test.ts` die Achsenreihenfolge prüft.
 *
 * Dort wird die *Folge* geprüft (Gendarmenmarkt landet in Zone 2). Hier steht
 * die Voraussetzung: dass in der Datei überhaupt Grade in GeoJSON-Reihenfolge
 * stehen und keine Meter aus EPSG:25832 — die tragen plausible Zahlen und
 * sähen auf der Karte nur „leer“ aus.
 */
describe('Geometrie-Fixture', () => {
  interface FeatureCollection {
    type: string
    features: {
      properties: { zone: string; district: string }
      geometry: { type: string; coordinates: number[][][] | number[][][][] }
    }[]
  }
  const SAMPLE = read<FeatureCollection>('zone-geometry-sample.json')

  it('führt jede Position als [lon, lat] in Grad, innerhalb der Berliner Box', () => {
    const box = BERLIN.reportBounds
    let positions = 0
    const walk = (value: unknown): void => {
      if (!Array.isArray(value)) return
      if (typeof value[0] === 'number' && typeof value[1] === 'number') {
        const [lon, lat] = value as [number, number]
        expect(Number.isFinite(lon)).toBe(true)
        expect(Number.isFinite(lat)).toBe(true)
        expect(lon).toBeGreaterThanOrEqual(box.minLon)
        expect(lon).toBeLessThanOrEqual(box.maxLon)
        expect(lat).toBeGreaterThanOrEqual(box.minLat)
        expect(lat).toBeLessThanOrEqual(box.maxLat)
        positions += 1
        return
      }
      for (const entry of value) walk(entry)
    }
    for (const feature of SAMPLE.features) walk(feature.geometry.coordinates)
    expect(positions).toBeGreaterThan(100)
  })

  it('schliesst jeden Ring — erster und letzter Punkt sind derselbe', () => {
    const rings: number[][][] = []
    const walk = (value: unknown, depth: number): void => {
      if (!Array.isArray(value)) return
      if (depth === 0) {
        rings.push(value as number[][])
        return
      }
      for (const entry of value) walk(entry, depth - 1)
    }
    for (const feature of SAMPLE.features) {
      walk(feature.geometry.coordinates, feature.geometry.type === 'MultiPolygon' ? 2 : 1)
    }
    expect(rings.length).toBeGreaterThan(0)
    for (const ring of rings) {
      expect(ring.length).toBeGreaterThanOrEqual(4)
      expect(ring[0]).toEqual(ring[ring.length - 1])
    }
  })
})
