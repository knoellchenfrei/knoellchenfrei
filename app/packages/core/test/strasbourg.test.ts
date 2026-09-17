import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import { STRASBOURG } from '../src/city.js'
import { holidaysFor } from '../src/holidays.js'
import { estimateCost, isChargeable, type ParkingZone } from '../src/tariff.js'
import {
  STRASBOURG_COLOUR_LABELS,
  STRASBOURG_HOURS,
  StrasbourgParseError,
  parseStrasbourgColour,
  parseStrasbourgTariff,
  strasbourgCostFor,
  strasbourgFee,
  strasbourgHourlyRates,
  strasbourgMaxStay,
  strasbourgUnmodelledRules,
  strasbourgWindows,
  strasbourgZoneKey,
  type StrasbourgQuartierProperties,
  type StrasbourgResidentZoneProperties,
  type StrasbourgZoneProperties,
} from '../src/strasbourg.js'

/**
 * Die echten Quellen, abgerufen am 17. September 2026 — vollständig, weil
 * 19 + 10 + 15 Zeilen klein genug sind. Die Zählung der Schreibweisen steht
 * in der Fixture selbst, damit „jede Schreibweise" nachzählbar bleibt.
 */
interface Fixture<P> {
  abgerufenAm: string
  quelle: string
  anzahl: number
  features: (P & { geometryType: string; firstPoint: [number, number] })[]
}

interface ZoneFixture extends Fixture<StrasbourgZoneProperties> {
  couleur: Record<string, number>
  tarif: Record<string, number>
  date_maj: Record<string, number>
}

const read = <T>(name: string): T =>
  JSON.parse(readFileSync(fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url)), 'utf8')) as T

const ZONES = read<ZoneFixture>('sxb-stationnement-payant-2026-09-17.json')
const QUARTIERS = read<Fixture<StrasbourgQuartierProperties>>('sxb-quartiers-2026-09-17.json')
const RESIDENTS = read<Fixture<StrasbourgResidentZoneProperties>>('sxb-residant-2026-09-17.json')

const ROUGE = '1h = 3.5€ / 2h = 8€ / 2h15 = 10€ / 2h30 = 12€ / 2h50 = 16.5€ / 3h = 17€'
const ORANGE = '1h = 2.5€ / 2h = 3.5€ / 2h15 = 6€ / 2h30 = 8€ / 2h50 = 9€ / 3h = 10€ / 3h20 = 14€ / 3h45 = 16.5€ / 4h = 17€'
const VERT =
  '1h = 1€ / 2h = 2€ / 3h = 4.5€ / 3h15 = 5.50€ / 3h30 = 6.50€ / 4h = 10€ / 4h15 = 12€ / 4h30 = 14€ / 4h45 = 16.5€ / 5h = 17€'

describe('parseStrasbourgTariff', () => {
  it('liest die rote Staffel: sechs Stufen, kumuliert, mit Dezimalpunkt', () => {
    expect(parseStrasbourgTariff(ROUGE).steps).toEqual([
      { minutes: 60, cents: 350 },
      { minutes: 120, cents: 800 },
      { minutes: 135, cents: 1000 },
      { minutes: 150, cents: 1200 },
      { minutes: 170, cents: 1650 },
      { minutes: 180, cents: 1700 },
    ])
  })

  it('liest „5.50€" und „4.5€" als denselben Betragstyp — eine Stelle ist Zehntel', () => {
    const steps = parseStrasbourgTariff(VERT).steps
    expect(steps[2]).toEqual({ minutes: 180, cents: 450 })
    expect(steps[3]).toEqual({ minutes: 195, cents: 550 })
    expect(steps[4]).toEqual({ minutes: 210, cents: 650 })
    expect(steps).toHaveLength(10)
  })

  it('liest die orange Staffel mit 3h20 und 3h45', () => {
    const steps = parseStrasbourgTariff(ORANGE).steps
    expect(steps.map((s) => s.minutes)).toEqual([60, 120, 135, 150, 170, 180, 200, 225, 240])
    expect(steps[steps.length - 1]).toEqual({ minutes: 240, cents: 1700 })
  })

  it('ist unempfindlich gegen doppelten Leerraum und fehlende Leerzeichen um das Gleichheitszeichen', () => {
    expect(parseStrasbourgTariff('  1h=3.5€ /  2h = 8€ ').steps).toEqual([
      { minutes: 60, cents: 350 },
      { minutes: 120, cents: 800 },
    ])
  })

  it('weist das Komma der Stadtseite ab — eine vierte Schreibweise soll auffallen', () => {
    expect(() => parseStrasbourgTariff('1h = 3,50€ / 2h = 8€')).toThrow(StrasbourgParseError)
  })

  it('weist einen Nullbetrag ab — null Euro sind kein Tarif', () => {
    expect(() => parseStrasbourgTariff('1h = 0€ / 2h = 8€')).toThrow(StrasbourgParseError)
    expect(() => parseStrasbourgTariff('1h = 0.00€')).toThrow(StrasbourgParseError)
  })

  it('weist 0h, Minuten über 59 und fallende Stufen ab', () => {
    expect(() => parseStrasbourgTariff('0h = 1€ / 1h = 2€')).toThrow(StrasbourgParseError)
    expect(() => parseStrasbourgTariff('1h60 = 1€ / 2h = 2€')).toThrow(StrasbourgParseError)
    expect(() => parseStrasbourgTariff('2h = 8€ / 1h = 3.5€')).toThrow(StrasbourgParseError)
    expect(() => parseStrasbourgTariff('1h = 8€ / 2h = 3.5€')).toThrow(StrasbourgParseError)
    expect(() => parseStrasbourgTariff('1h = 8€ / 2h = 8€')).toThrow(StrasbourgParseError)
  })

  it('verlangt mindestens eine volle Stunde — sonst gibt es keinen Stundensatz', () => {
    expect(() => parseStrasbourgTariff('0h30 = 1€')).toThrow(StrasbourgParseError)
    expect(parseStrasbourgTariff('1h = 1€').steps).toEqual([{ minutes: 60, cents: 100 }])
  })

  it('weist die Schreibweisen der anderen Städte ab', () => {
    for (const fremd of ['2,00 Euro', '3,50 € je Stunde', '2 €/h', '30 min = 1,50 €; 60 min = 3,00 €', '5,00 per uur', 'HOCH 2h Mo-Sa 09:00-20:00']) {
      expect(() => parseStrasbourgTariff(fremd), fremd).toThrow(StrasbourgParseError)
    }
  })

  it('weist Leeres, null und Überlanges ab, bevor irgendetwas es anfasst', () => {
    expect(() => parseStrasbourgTariff('')).toThrow(StrasbourgParseError)
    expect(() => parseStrasbourgTariff('   ')).toThrow(StrasbourgParseError)
    expect(() => parseStrasbourgTariff(null)).toThrow(StrasbourgParseError)
    expect(() => parseStrasbourgTariff(undefined)).toThrow(StrasbourgParseError)
    expect(() => parseStrasbourgTariff(`${ROUGE} / `.repeat(4))).toThrow(StrasbourgParseError)
  })

  it('nennt im Fehler die Rohzeile', () => {
    try {
      parseStrasbourgTariff('1h = drei€')
      expect.unreachable()
    } catch (error) {
      expect(error).toBeInstanceOf(StrasbourgParseError)
      expect((error as StrasbourgParseError).raw).toBe('1h = drei€')
      expect((error as Error).message).toContain('drei€')
    }
  })
})

describe('die Staffel als Kosten, Stundensätze und Spanne', () => {
  const rouge = parseStrasbourgTariff(ROUGE)
  const orange = parseStrasbourgTariff(ORANGE)
  const vert = parseStrasbourgTariff(VERT)

  it('kostet, was die nächste Stufe sagt — und über der letzten nichts Bezifferbares', () => {
    expect(strasbourgCostFor(rouge, 0)).toBe(350)
    expect(strasbourgCostFor(rouge, 30)).toBe(350)
    expect(strasbourgCostFor(rouge, 60)).toBe(350)
    expect(strasbourgCostFor(rouge, 61)).toBe(800)
    expect(strasbourgCostFor(rouge, 125)).toBe(1000)
    expect(strasbourgCostFor(rouge, 180)).toBe(1700)
    expect(strasbourgCostFor(rouge, 181)).toBeUndefined()
    expect(strasbourgCostFor(rouge, -1)).toBeUndefined()
    expect(strasbourgCostFor(rouge, Number.NaN)).toBeUndefined()
  })

  it('rechnet die Stundenkosten nach: rouge 3,50 / 4,50 / 9,00', () => {
    expect(strasbourgHourlyRates(rouge)).toEqual([350, 450, 900])
    expect(strasbourgHourlyRates(orange)).toEqual([250, 100, 650, 700])
    expect(strasbourgHourlyRates(vert)).toEqual([100, 100, 250, 550, 700])
  })

  it('macht daraus die Spanne der Stundenkosten, kein Mittel', () => {
    expect(strasbourgFee(rouge)).toEqual({ kind: 'range', minCentsPerHour: 350, maxCentsPerHour: 900 })
    expect(strasbourgFee(orange)).toEqual({ kind: 'range', minCentsPerHour: 100, maxCentsPerHour: 700 })
    expect(strasbourgFee(vert)).toEqual({ kind: 'range', minCentsPerHour: 100, maxCentsPerHour: 700 })
  })

  it('wird zum Satz, wenn jede Stunde dasselbe kostet', () => {
    expect(strasbourgFee(parseStrasbourgTariff('1h = 2€ / 2h = 4€ / 3h = 6€'))).toEqual({ kind: 'exact', centsPerHour: 200 })
    expect(strasbourgFee(parseStrasbourgTariff('1h = 2€'))).toEqual({ kind: 'exact', centsPerHour: 200 })
  })

  it('beziffert nie eine Null und nie einen Betrag außerhalb der Staffel', () => {
    for (const tariff of [rouge, orange, vert]) {
      const fee = strasbourgFee(tariff)
      expect(fee.kind).toBe('range')
      if (fee.kind !== 'range') return
      expect(fee.minCentsPerHour).toBeGreaterThan(0)
      expect(fee.maxCentsPerHour).toBeLessThanOrEqual(1700)
      expect(fee.currency).toBeUndefined()
    }
  })

  it('nimmt die letzte Stufe als Höchstparkdauer: 3, 4 und 5 Stunden', () => {
    expect(strasbourgMaxStay(rouge)).toBe(180)
    expect(strasbourgMaxStay(orange)).toBe(240)
    expect(strasbourgMaxStay(vert)).toBe(300)
    expect(() => strasbourgMaxStay({ steps: [] })).toThrow(StrasbourgParseError)
  })

  it('nennt die Staffel und den FPS als Zusatzregel, mit deutschem Komma', () => {
    const [rule] = strasbourgUnmodelledRules(rouge)
    expect(rule).toContain('1 h 3,50 €')
    expect(rule).toContain('2 h 15 10,00 €')
    expect(rule).toContain('3 h 17,00 €')
    expect(rule).toContain('länger als 3 h')
    expect(rule).toContain('35 €')
    expect(strasbourgUnmodelledRules(vert)[0]).toContain('länger als 5 h')
    // Kein Advent darin — sonst hielte `isUncertainAt` jede Zone im Dezember für unsicher.
    expect(rule?.toLowerCase()).not.toContain('advent')
  })
})

describe('Farbe und Schlüssel', () => {
  it('liest die drei Farben, auch groß geschrieben', () => {
    expect(parseStrasbourgColour('rouge')).toBe('rouge')
    expect(parseStrasbourgColour(' Orange ')).toBe('orange')
    expect(parseStrasbourgColour('VERT')).toBe('vert')
    expect(STRASBOURG_COLOUR_LABELS.vert).toBe('grün')
  })

  it('weist jede vierte Farbe, Leeres und null ab', () => {
    for (const raw of ['bleue', 'violette', 'rot', '', null, undefined]) {
      expect(() => parseStrasbourgColour(raw), String(raw)).toThrow(StrasbourgParseError)
    }
  })

  it('setzt Farbe und Nummer zum Schlüssel zusammen', () => {
    expect(strasbourgZoneKey({ couleur: 'rouge', id_zone_visiteur: 10 })).toBe('rouge 10')
    expect(strasbourgZoneKey({ couleur: 'vert', id_zone_visiteur: 3 })).toBe('vert 3')
  })

  it('wirft ohne Nummer, bei 0, bei Brüchen und bei einer Nummer als Text', () => {
    expect(() => strasbourgZoneKey({ couleur: 'rouge', id_zone_visiteur: null })).toThrow(StrasbourgParseError)
    expect(() => strasbourgZoneKey({ couleur: 'rouge', id_zone_visiteur: 0 })).toThrow(StrasbourgParseError)
    expect(() => strasbourgZoneKey({ couleur: 'rouge', id_zone_visiteur: 1.5 })).toThrow(StrasbourgParseError)
    expect(() => strasbourgZoneKey({ couleur: 'rouge', id_zone_visiteur: '10' as unknown as number })).toThrow(
      StrasbourgParseError
    )
  })
})

describe('die Zeiten aus der Datensatzbeschreibung', () => {
  it('sind Montag bis Samstag 9 bis 19 Uhr, ein Fenster', () => {
    expect(strasbourgWindows()).toEqual([{ weekdays: [1, 2, 3, 4, 5, 6], fromMinute: 540, toMinute: 1140 }])
  })

  it('geben jedes Mal ein neues Objekt zurück, damit niemand alle Zonen zugleich ändert', () => {
    const a = strasbourgWindows()
    const b = strasbourgWindows()
    expect(a).not.toBe(b)
    expect(a[0]).not.toBe(b[0])
    expect(a[0]?.weekdays).not.toBe(b[0]?.weekdays)
  })

  it('sagen im Rohtext, dass sie nicht aus dem Feature stammen, und zitieren die Beschreibung', () => {
    expect(STRASBOURG_HOURS.rawHours).toContain('laut Datensatzbeschreibung')
    expect(STRASBOURG_HOURS.rawHours).toContain('nicht am Feature')
    expect(STRASBOURG_HOURS.descriptionQuote).toBe(
      'Le stationnement est payant du lundi au samedi de 9h00 à 19h00 et gratuit les dimanches et les jours fériés.'
    )
    expect(STRASBOURG_HOURS.cityPage).toBe('https://www.strasbourg.eu/stationnement-visiteur')
  })
})

describe('der echte Abzug vom 17. September 2026', () => {
  it('trägt 19 Zonen, 10 Quartiere und 15 Bewohnerzonen, alle als Polygon in Grad', () => {
    expect(ZONES.anzahl).toBe(19)
    expect(ZONES.features).toHaveLength(19)
    expect(QUARTIERS.features).toHaveLength(10)
    expect(RESIDENTS.features).toHaveLength(15)
    for (const row of [...ZONES.features, ...QUARTIERS.features, ...RESIDENTS.features]) {
      expect(row.geometryType).toBe('Polygon')
      const [lon, lat] = row.firstPoint
      expect(lon).toBeGreaterThan(7.6)
      expect(lon).toBeLessThan(7.9)
      expect(lat).toBeGreaterThan(48.45)
      expect(lat).toBeLessThan(48.7)
    }
  })

  it('liest jede der 19 Zeilen ohne Ausnahme — Farbe, Staffel, Schlüssel', () => {
    const keys = new Set<string>()
    for (const row of ZONES.features) {
      const key = strasbourgZoneKey(row)
      expect(keys.has(key), key).toBe(false)
      keys.add(key)
      const tariff = parseStrasbourgTariff(row.tarif)
      expect(strasbourgFee(tariff).kind).toBe('range')
      expect(strasbourgMaxStay(tariff)).toBeGreaterThanOrEqual(180)
    }
    expect(keys.size).toBe(19)
  })

  it('nagelt die drei Schreibweisen fest, eine je Farbe, damit eine Feed-Änderung die CI rot macht', () => {
    expect(ZONES.tarif).toEqual({ [ORANGE]: 7, [VERT]: 7, [ROUGE]: 5 })
    expect(ZONES.couleur).toEqual({ orange: 7, vert: 7, rouge: 5 })
    for (const row of ZONES.features) {
      const expected = row.couleur === 'rouge' ? ROUGE : row.couleur === 'orange' ? ORANGE : VERT
      expect(row.tarif, strasbourgZoneKey(row)).toBe(expected)
    }
    expect(ZONES.date_maj).toEqual({ '2026-09-03': 19 })
  })

  it('nennt zu jeder Zone eine Bewohnerzone, die es gibt', () => {
    const residents = new Set(RESIDENTS.features.map((row) => row.numero_zone_resident))
    expect(residents.size).toBe(15)
    for (const row of ZONES.features) {
      expect(residents.has(String(row.numero_zone_resident)), strasbourgZoneKey(row)).toBe(true)
    }
  })

  it('führt die zehn Quartiere mit eindeutigen Namen und Nummern 1 bis 10', () => {
    const nummern = QUARTIERS.features.map((row) => row.id_quart10).sort((a, b) => (a ?? 0) - (b ?? 0))
    expect(nummern).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
    expect(new Set(QUARTIERS.features.map((row) => row.nom)).size).toBe(10)
    expect(QUARTIERS.features.map((row) => row.nom)).toContain('Gare-Kléber')
  })
})

describe('eine Straßburger Zone im Modell', () => {
  const rouge = parseStrasbourgTariff(ROUGE)
  const zone: ParkingZone = {
    id: 'rouge 10',
    name: 'rouge 10',
    land: STRASBOURG.land,
    fee: strasbourgFee(rouge),
    windows: strasbourgWindows(),
    maxStayMinutes: strasbourgMaxStay(rouge),
    freeOnHolidays: true,
    unmodelledRules: strasbourgUnmodelledRules(rouge),
  }
  // Mitteleuropäische Sommerzeit: 10:00 MESZ ist 08:00 UTC.
  const at = (iso: string): Date => new Date(iso)

  it('kassiert am Mittwochvormittag und samstags, nicht sonntags und nicht um 19 Uhr', () => {
    expect(isChargeable(zone, at('2026-09-16T08:00:00Z'))).toBe(true) // Mittwoch 10:00
    expect(isChargeable(zone, at('2026-09-19T15:30:00Z'))).toBe(true) // Samstag 17:30
    expect(isChargeable(zone, at('2026-09-20T10:00:00Z'))).toBe(false) // Sonntag 12:00
    expect(isChargeable(zone, at('2026-09-16T17:00:00Z'))).toBe(false) // Mittwoch 19:00
    expect(isChargeable(zone, at('2026-09-16T06:59:00Z'))).toBe(false) // Mittwoch 08:59
  })

  it('kassiert am Karfreitag und am 26. Dezember nicht — Alsace-Moselle —, am 3. Oktober schon', () => {
    expect(holidaysFor('FR-67', 2026).has('2026-04-03')).toBe(true)
    expect(isChargeable(zone, at('2026-04-03T09:00:00Z'))).toBe(false) // Karfreitag 11:00
    expect(isChargeable(zone, at('2026-12-26T10:00:00Z'))).toBe(false) // Samstag, Saint-Étienne
    expect(isChargeable(zone, at('2026-10-03T09:00:00Z'))).toBe(true) // Samstag, kein Feiertag in Frankreich
    expect(isChargeable(zone, at('2026-07-14T09:00:00Z'))).toBe(false) // Dienstag, Fête nationale
  })

  it('schätzt zwei Stunden ab 10 Uhr als Spanne 7 bis 18 Euro — die 8 Euro der Staffel liegen darin', () => {
    const estimate = estimateCost(zone, at('2026-09-16T08:00:00Z'), 120)
    expect(estimate.priced).toBe(true)
    expect(estimate.exact).toBe(false)
    expect(estimate.minCents).toBe(700)
    expect(estimate.maxCents).toBe(1800)
    expect(strasbourgCostFor(rouge, 120)).toBeGreaterThanOrEqual(estimate.minCents)
    expect(strasbourgCostFor(rouge, 120)).toBeLessThanOrEqual(estimate.maxCents)
    expect(estimate.currency).toBe('EUR')
    expect(estimate.exceedsMaxStay).toBe(false)
    expect(estimateCost(zone, at('2026-09-16T08:00:00Z'), 181).exceedsMaxStay).toBe(true)
  })
})

describe('die Stadt Straßburg', () => {
  it('hängt am Kalender FR-67 mit dreizehn Feiertagen und braucht keinen Stadtfeiertag', () => {
    expect(STRASBOURG.land).toBe('FR-67')
    expect(holidaysFor(STRASBOURG.land, 2026).size).toBe(13)
    expect(STRASBOURG.holidays).toBeUndefined()
  })

  it('führt die Licence Ouverte in der Fassung, die der Datensatz nennt, mit Nennungspflicht', () => {
    expect(STRASBOURG.attribution.licence).toContain('Version 1.0')
    expect(STRASBOURG.attribution.licenceUrl).toBe('https://www.etalab.gouv.fr/wp-content/uploads/2014/05/Licence_Ouverte.pdf')
    expect(STRASBOURG.attribution.attributionRequired).toBe(true)
    expect(STRASBOURG.attribution.licenceFamily).toBe('cc-by')
    expect(STRASBOURG.attribution.datasetUrl).toBe(ZONES.quelle)
    expect(STRASBOURG.licenceOpen).toBeUndefined()
  })
})
