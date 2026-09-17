import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import {
  StGallenParseError,
  parseStGallenAccess,
  parseStGallenMarking,
  parseStGallenSpaces,
  stGallenQuarter,
  stGallenZoneKey,
  stGallenZoneNote,
  type StGallenAreaProperties,
  type StGallenMarking,
  type StGallenQuarterProperties,
} from '../src/stgallen.js'
import { STGALLEN, cityAt, cityCountry, withinCity } from '../src/city.js'
import { chargeableAt, estimateCost, isChargeable, type ParkingZone } from '../src/tariff.js'

/**
 * Der echte Abruf vom 17. September 2026 — die Zählung über alle 3.232
 * Parkfelder und ein Auszug der Zeilen: je Markierungsart die erste, dazu
 * jede ohne Platzzahl. Bei 3.232 Zeilen mit drei Sachfeldern ist der Auszug
 * die Fixture; die Zählung darüber ist die Messung, an der die Zahlen des
 * Datenbaus hängen.
 */
interface AreaFixture {
  abgerufenAm: string
  anzahl: number
  geometrieTypen: Record<string, number>
  ersterStuetzpunkt: [number, number]
  markierungsarten: Record<string, number>
  plaetzeJeArt: Record<string, number>
  ohnePlatzzahl: number
  platzzahlNull: number
  flaechen: (StGallenAreaProperties & { zeile: number })[]
}

interface QuarterFixture {
  anzahl: number
  geometrieTypen: Record<string, number>
  quartiere: StGallenQuarterProperties[]
}

function read<T>(name: string): T {
  return JSON.parse(readFileSync(fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url)), 'utf8')) as T
}

const AREAS = read<AreaFixture>('sg-parkflaechen-2026-09-17.json')
const QUARTERS = read<QuarterFixture>('sg-wohnviertel-2026-09-17.json')

/** Die zwölf Markierungsarten des Abzugs mit Häufigkeit und Erwartung. */
const MARKINGS: readonly { text: string; count: number; marking: StGallenMarking; zone: 'EBZ' | 'Parkuhr' | null }[] = [
  { text: 'Erweiterte Blaue Zone', count: 1871, marking: 'ebz', zone: 'EBZ' },
  { text: 'Weiss (bewirtschaftet)', count: 781, marking: 'parkuhr', zone: 'Parkuhr' },
  { text: 'Kundenparkplatz', count: 205, marking: 'kunden', zone: null },
  { text: 'Invalidenparkplatz', count: 114, marking: 'invaliden', zone: null },
  { text: 'Güterumschlag', count: 85, marking: 'gueterumschlag', zone: null },
  { text: 'Unterirdisch, Garage', count: 56, marking: 'garage', zone: null },
  { text: 'Weisse Zone (nicht bewirtschaftet)', count: 33, marking: 'weissFrei', zone: null },
  { text: 'unbekannt', count: 26, marking: 'unbekannt', zone: null },
  { text: 'Ohne Markierung', count: 21, marking: 'ohneMarkierung', zone: null },
  { text: 'Taxistandplatz', count: 17, marking: 'taxi', zone: null },
  { text: 'Hotelhalt', count: 13, marking: 'hotel', zone: null },
  { text: 'Carparkplatz', count: 10, marking: 'car', zone: null },
]

describe('die Fixture', () => {
  it('zählt 3.232 Polygone, in Grad, erster Stützpunkt in St. Gallen', () => {
    expect(AREAS.anzahl).toBe(3232)
    expect(AREAS.geometrieTypen).toEqual({ Polygon: 3232 })
    // `[lon, lat]`: St. Gallen liegt bei 9° Ost, 47° Nord. In LV95 stünde
    // hier 2.745.000 / 1.254.000, und die Karte sähe nur leer aus.
    const [lon, lat] = AREAS.ersterStuetzpunkt
    expect(lon).toBeGreaterThan(9.2)
    expect(lon).toBeLessThan(9.5)
    expect(lat).toBeGreaterThan(47.3)
    expect(lat).toBeLessThan(47.5)
  })

  // Gezählt, nicht geschätzt — die Zahlen des Datenbaus hängen daran: 1.871
  // und 781 Reihen werden Zonenstücke, 114 werden POI, der Rest bleibt draussen.
  it('führt genau zwölf Markierungsarten in genau diesen Häufigkeiten', () => {
    expect(Object.keys(AREAS.markierungsarten)).toHaveLength(12)
    for (const { text, count } of MARKINGS) expect(AREAS.markierungsarten[text], text).toBe(count)
    expect(Object.values(AREAS.markierungsarten).reduce((a, b) => a + b, 0)).toBe(3232)
  })

  it('zählt 6.263 Plätze in der EBZ und 2.959 an Parkuhren', () => {
    expect(AREAS.plaetzeJeArt['Erweiterte Blaue Zone']).toBe(6263)
    expect(AREAS.plaetzeJeArt['Weiss (bewirtschaftet)']).toBe(2959)
    expect(AREAS.plaetzeJeArt['Invalidenparkplatz']).toBe(242)
  })

  // Fünf Zeilen ohne brauchbare Platzzahl: drei `null`, zwei `0`. Beides
  // heisst „nicht angegeben", und der Datenbau schreibt `spaces: null`.
  it('hat drei Zeilen mit null und zwei mit 0 als Platzzahl', () => {
    expect(AREAS.ohnePlatzzahl).toBe(3)
    expect(AREAS.platzzahlNull).toBe(2)
    expect(AREAS.flaechen.filter((row) => row.anzahl_pp === null)).toHaveLength(3)
    expect(AREAS.flaechen.filter((row) => row.anzahl_pp === 0)).toHaveLength(2)
  })

  it('enthält je Markierungsart mindestens eine Zeile', () => {
    const arten = new Set(AREAS.flaechen.map((row) => row.markierungsart))
    expect([...arten].sort()).toEqual(MARKINGS.map((m) => m.text).sort())
  })

  it('führt alle 31 Quartiere mit Kreis und Gruppe', () => {
    expect(QUARTERS.anzahl).toBe(31)
    expect(QUARTERS.quartiere).toHaveLength(31)
    expect(QUARTERS.geometrieTypen).toEqual({ Polygon: 31 })
    const kreise = new Map<string, number>()
    for (const q of QUARTERS.quartiere) kreise.set(q.kreis ?? '', (kreise.get(q.kreis ?? '') ?? 0) + 1)
    expect([...kreise.entries()].sort()).toEqual([
      ['Centrum', 10],
      ['Osten', 8],
      ['Westen', 13],
    ])
    // Die Nummer trägt den Kreis in der ersten Ziffer: 1 Westen, 2 Centrum, 3 Osten.
    for (const q of QUARTERS.quartiere) {
      const kreis = { 1: 'Westen', 2: 'Centrum', 3: 'Osten' }[Math.floor((q.nummer ?? 0) / 100)]
      expect(kreis, String(q.nummer)).toBe(q.kreis)
    }
  })
})

describe('parseStGallenMarking', () => {
  it('liest jede der zwölf Arten des Abzugs', () => {
    for (const { text, marking } of MARKINGS) expect(parseStGallenMarking(text), text).toBe(marking)
  })

  it('verzeiht Leerraum und Grossschreibung', () => {
    expect(parseStGallenMarking('  erweiterte   blaue zone ')).toBe('ebz')
    expect(parseStGallenMarking('WEISS (BEWIRTSCHAFTET)')).toBe('parkuhr')
  })

  // Eine dreizehnte Art soll jemand lesen, bevor sie als „keine Zone"
  // durchgeht — oder als eine.
  it('weist eine neue Art ab, statt sie einer Zone zuzuordnen', () => {
    for (const raw of ['Blaue Zone', 'Weiss', 'Gebührenpflichtig', '', 'EBZ', 'Erweiterte Blaue Zone (Sektor 3)']) {
      expect(() => parseStGallenMarking(raw), raw).toThrow(StGallenParseError)
    }
  })

  it('begrenzt seine Eingabe, wie die anderen Parser', () => {
    expect(() => parseStGallenMarking('Erweiterte Blaue Zone'.padEnd(200, ' x'))).toThrow(/länger als 120/)
  })

  it('liest jede Zeile der Fixture', () => {
    for (const row of AREAS.flaechen) expect(() => parseStGallenMarking(row.markierungsart ?? '')).not.toThrow()
  })
})

describe('stGallenZoneKey', () => {
  it('macht aus EBZ und Parkuhr eine Zone und aus allem anderen keine', () => {
    for (const { marking, zone } of MARKINGS) expect(stGallenZoneKey(marking), marking).toBe(zone)
  })
})

describe('parseStGallenAccess', () => {
  it('kennt nur öffentlich, mit Leerraum und Grossschreibung', () => {
    expect(parseStGallenAccess('öffentlich')).toBe('public')
    expect(parseStGallenAccess(' Öffentlich ')).toBe('public')
  })

  it('weist alles andere ab', () => {
    for (const raw of ['privat', '', 'halböffentlich', 'öffentlich, nachts gesperrt']) {
      expect(() => parseStGallenAccess(raw), raw).toThrow(StGallenParseError)
    }
  })

  it('liest jede Zeile der Fixture', () => {
    for (const row of AREAS.flaechen) expect(parseStGallenAccess(row.zutrittsart ?? '')).toBe('public')
  })
})

describe('parseStGallenSpaces', () => {
  it('nimmt ganze Zahlen ab 1', () => {
    expect(parseStGallenSpaces(1)).toBe(1)
    expect(parseStGallenSpaces(23)).toBe(23)
    expect(parseStGallenSpaces(1020)).toBe(1020)
  })

  it('hält null, undefined und 0 für nicht angegeben', () => {
    expect(parseStGallenSpaces(null)).toBeNull()
    expect(parseStGallenSpaces(undefined)).toBeNull()
    expect(parseStGallenSpaces(0)).toBeNull()
  })

  it('weist Brüche, negative Zahlen, NaN und Unfug ab', () => {
    for (const raw of [2.5, -1, Number.NaN, Number.POSITIVE_INFINITY, 10_001]) {
      expect(() => parseStGallenSpaces(raw), String(raw)).toThrow(StGallenParseError)
    }
    expect(() => parseStGallenSpaces('4' as unknown as number)).toThrow(StGallenParseError)
  })

  it('liest jede Zeile der Fixture, und die fünf ohne Zahl ergeben null', () => {
    const values = AREAS.flaechen.map((row) => parseStGallenSpaces(row.anzahl_pp))
    expect(values.filter((v) => v === null)).toHaveLength(5)
    for (const v of values) if (v !== null) expect(Number.isInteger(v) && v >= 1).toBe(true)
  })
})

describe('stGallenZoneNote', () => {
  it('nennt das Regime und die Platzzahl, ohne Zeiten oder Beträge zu behaupten', () => {
    expect(stGallenZoneNote('EBZ', 4)).toBe(
      'Erweiterte Blaue Zone: blau markierte Parkfelder, tagsüber mit Parkscheibe, mit Bewilligung unbeschränkt — 4 Plätze in dieser Reihe'
    )
    expect(stGallenZoneNote('Parkuhr', 1)).toMatch(/Parkuhr — 1 Platz in dieser Reihe$/)
    expect(stGallenZoneNote('EBZ', null)).toMatch(/— Platzzahl nicht angegeben$/)
    for (const note of [stGallenZoneNote('EBZ', 2), stGallenZoneNote('Parkuhr', 2)]) {
      expect(note).not.toMatch(/Uhr|CHF|Fr\./)
    }
  })
})

describe('stGallenQuarter', () => {
  it('setzt Name, Gruppe und Kreis zusammen', () => {
    expect(stGallenQuarter({ statistisc: 'Rotmonten', quartiergr: 'Rotmonten', kreis: 'Osten' })).toEqual({
      name: 'Rotmonten',
      bezirk: 'Rotmonten, Kreis Osten',
    })
    expect(stGallenQuarter({ statistisc: ' Altstadt ', quartiergr: 'Innenstadt', kreis: 'Centrum' }).bezirk).toBe(
      'Innenstadt, Kreis Centrum'
    )
  })

  it('wirft, wenn eines der drei Felder fehlt', () => {
    expect(() => stGallenQuarter({ statistisc: null, quartiergr: 'Winkeln', kreis: 'Westen' })).toThrow(StGallenParseError)
    expect(() => stGallenQuarter({ statistisc: 'Chräzeren', quartiergr: '', kreis: 'Westen' })).toThrow(StGallenParseError)
    expect(() => stGallenQuarter({})).toThrow(StGallenParseError)
  })

  it('liest alle 31 Quartiere, mit eindeutigen Namen', () => {
    const names = QUARTERS.quartiere.map((q) => stGallenQuarter(q).name)
    expect(new Set(names).size).toBe(31)
  })
})

/**
 * Eine St. Galler Reihe im gemeinsamen Tarifmodell: `scheduleUnknown`, kein
 * Fenster, kein Betrag — und die Antwort ist „unbekannt", nicht „frei".
 */
describe('eine St. Galler Reihe im gemeinsamen Tarifmodell', () => {
  const zone: ParkingZone = {
    id: 'stgallen-EBZ',
    name: 'Erweiterte Blaue Zone',
    land: 'CH-SG',
    fee: { kind: 'unknown' },
    windows: [],
    scheduleUnknown: true,
  }

  it('sagt an einem Dienstag um zehn „unbekannt", nicht „frei"', () => {
    const status = chargeableAt(zone, Date.UTC(2026, 8, 15, 8))
    expect(status.unknown).toBe(true)
    expect(status.chargeable).toBe(false)
    expect(status.changesAt).toBeNull()
    expect(isChargeable(zone, Date.UTC(2026, 8, 15, 8))).toBe(false)
  })

  it('sagt es an Allerheiligen genauso — ein Feiertag macht aus unbekannt kein frei', () => {
    expect(chargeableAt(zone, Date.UTC(2026, 10, 1, 10)).unknown).toBe(true)
  })

  it('rechnet keine Kosten und nennt keinen Preis', () => {
    const estimate = estimateCost(zone, Date.UTC(2026, 8, 15, 8), 120)
    expect(estimate.priced).toBe(false)
    expect(estimate.chargedMinutes).toBe(0)
  })
})

describe('St. Gallen als Stadt', () => {
  it('liegt in der Schweiz, mit St. Galler Kantonskürzel und Fangradius', () => {
    expect(STGALLEN.land).toBe('CH-SG')
    expect(cityCountry(STGALLEN)).toBe('CH')
    expect(STGALLEN.holidays).toBeUndefined()
    expect(STGALLEN.zoneSnapMetres).toBe(20)
  })

  it('nimmt Marktplatz, Winkeln und Neudorf an', () => {
    expect(cityAt(9.3761, 47.4247)).toBe(STGALLEN)
    expect(withinCity(STGALLEN, 9.3035, 47.41)).toBe(true) // Winkeln, Breitfeld
    expect(withinCity(STGALLEN, 9.4195, 47.4413)).toBe(true) // Neudorf, Achslen
  })

  // Der Rahmen kommt aus den 31 Quartieren, nicht aus der Parkebene — und
  // die Nachbargemeinden liegen draussen.
  it('weist Gossau, Herisau, Wittenbach und Rorschach ab', () => {
    expect(cityAt(9.2477, 47.4152)).toBeUndefined() // Gossau
    expect(cityAt(9.279, 47.386)).toBeUndefined() // Herisau
    expect(cityAt(9.3845, 47.4614)).toBeUndefined() // Wittenbach
    expect(cityAt(9.4947, 47.4779)).toBeUndefined() // Rorschach
  })

  it('umschliesst den ersten Stützpunkt des Abzugs und jeden Quartier-Schwerpunkt', () => {
    const { minLon, minLat, maxLon, maxLat } = STGALLEN.reportBounds
    const [lon, lat] = AREAS.ersterStuetzpunkt
    expect(lon).toBeGreaterThan(minLon)
    expect(lon).toBeLessThan(maxLon)
    expect(lat).toBeGreaterThan(minLat)
    expect(lat).toBeLessThan(maxLat)
    for (const q of QUARTERS.quartiere) {
      expect(withinCity(STGALLEN, q.geo_point_2d?.lon ?? 0, q.geo_point_2d?.lat ?? 0), q.statistisc ?? '').toBe(true)
    }
  })

  it('nennt die Stadt als Urheber unter CC BY 4.0', () => {
    expect(STGALLEN.attribution.source).toMatch(/^Stadt St\.Gallen, Rauminformationszentrum/)
    expect(STGALLEN.attribution.attributionRequired).toBe(true)
    expect(STGALLEN.attribution.licenceFamily).toBe('cc-by')
    expect(STGALLEN.attribution.datasetUrl).toMatch(/ppv-parkflaeche\/exports\/geojson$/)
    expect(STGALLEN.licenceOpen).toBeUndefined()
    expect(STGALLEN.towedVehicles).toBeUndefined()
  })
})
