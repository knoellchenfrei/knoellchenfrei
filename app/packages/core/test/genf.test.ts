import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import { CITIES, GENF, cityAt, cityCountry, withinCity } from '../src/city.js'
import {
  GenfParseError,
  genfMaxStayCode,
  genfStreetLabel,
  genfZoneKey,
  parseGenfTypeStationnement,
  type GenfLineProperties,
  type GenfZoneProperties,
} from '../src/genf.js'
import { holidaysFor, isHoliday } from '../src/holidays.js'
import { berlinWallClock } from '../src/berlin-time.js'
import { chargeableAt, estimateCost, type ParkingZone } from '../src/tariff.js'

/**
 * Die echten Abrufe vom 17. September 2026 — alle 53 Macaron-Zonen ohne
 * Geometrie und je Stellplatzart eine Parkierungslinie, dazu die Zählung
 * aller 13.236 Linien nach Art.
 *
 * Wie bei den Städten davor: Fixtures sind der Feed, nicht ausgedachte
 * Beispiele. Bei 29 Arten (28 Werte und null) prüft „jeder Wert liest sich"
 * wirklich jeden Wert.
 */
interface ZoneFixture {
  abgerufenAm: string
  anzahl: number
  zonen: GenfZoneProperties[]
}

interface LineFixture {
  abgerufenAm: string
  anzahl: number
  typen: Record<string, number>
  linien: GenfLineProperties[]
}

function read<T>(name: string): T {
  return JSON.parse(readFileSync(fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url)), 'utf8')) as T
}

const ZONES = read<ZoneFixture>('genf-macaron-2026-09-17.json')
const LINES = read<LineFixture>('genf-stationnement-2026-09-17.json')

/**
 * Die 28 Stellplatzarten des Abzugs mit ihrer Häufigkeit — gezählt über
 * alle 13.236 Linien, nicht geschätzt. Die Erwartung steht je Wert daneben:
 * Autoreihe mit Regime und Dauer, oder etwas anderes.
 */
const TYPES: readonly { text: string; count: number; car: false | { regime: 'payant' | 'gratuit'; minutes: number | null } }[] = [
  { text: 'Gratuit 60 min', count: 5114, car: { regime: 'gratuit', minutes: 60 } },
  { text: 'Cases 2 roues', count: 2604, car: false },
  { text: 'Vélos', count: 1441, car: false },
  { text: 'Gratuit jaune', count: 930, car: false },
  { text: 'Payant 90 min', count: 818, car: { regime: 'payant', minutes: 90 } },
  { text: 'Gratuit 240 min', count: 737, car: { regime: 'gratuit', minutes: 240 } },
  { text: 'Gratuit illimité', count: 443, car: { regime: 'gratuit', minutes: null } },
  { text: 'Gratuit 180 min', count: 339, car: { regime: 'gratuit', minutes: 180 } },
  { text: 'Stationnement interdit', count: 294, car: false },
  { text: 'Gratuit 30 min', count: 96, car: { regime: 'gratuit', minutes: 30 } },
  { text: 'Payant illimité', count: 66, car: { regime: 'payant', minutes: null } },
  { text: 'Payant 30 min', count: 47, car: { regime: 'payant', minutes: 30 } },
  { text: 'Gratuit 15 heures', count: 44, car: { regime: 'gratuit', minutes: 900 } },
  { text: 'Gratuit jaune spécial', count: 37, car: false },
  { text: 'Police', count: 35, car: false },
  { text: 'Autre', count: 32, car: false },
  { text: 'Cars', count: 29, car: false },
  { text: 'Electrique', count: 22, car: false },
  { text: 'Gratuit 120 min', count: 16, car: { regime: 'gratuit', minutes: 120 } },
  { text: 'Payant 15 heures', count: 15, car: { regime: 'payant', minutes: 900 } },
  { text: 'Vélo cargo', count: 14, car: false },
  { text: 'Payant 60 min', count: 13, car: { regime: 'payant', minutes: 60 } },
  { text: 'Ambulance', count: 10, car: false },
  { text: 'Moto', count: 9, car: false },
  { text: 'Payant 120 min', count: 9, car: { regime: 'payant', minutes: 120 } },
  { text: 'Mobility', count: 9, car: false },
  { text: 'Habitant / nuit', count: 8, car: false },
  { text: 'Gratuit 8 heures', count: 2, car: { regime: 'gratuit', minutes: 480 } },
]

describe('die Stellplatzarten des Abzugs', () => {
  it('sind genau die 28 gezählten, plus dreimal null', () => {
    const gezaehlt = { ...LINES.typen }
    expect(gezaehlt['null']).toBe(3)
    delete gezaehlt['null']
    expect(Object.keys(gezaehlt).sort()).toEqual(TYPES.map((entry) => entry.text).sort())
    for (const entry of TYPES) expect(gezaehlt[entry.text], entry.text).toBe(entry.count)
    expect(Object.values(LINES.typen).reduce((a, b) => a + b, 0)).toBe(LINES.anzahl)
    expect(LINES.anzahl).toBe(13236)
  })

  it('liest jede Art so, wie die Tabelle es sagt', () => {
    for (const entry of TYPES) {
      const parsed = parseGenfTypeStationnement(entry.text)
      if (entry.car === false) {
        expect(parsed, entry.text).toEqual({ vehicles: 'other', label: entry.text })
      } else {
        expect(parsed, entry.text).toEqual({ vehicles: 'car', regime: entry.car.regime, maxStayMinutes: entry.car.minutes })
      }
    }
  })

  // Die Fixture führt je Art eine echte Zeile; sie geht durch denselben Parser
  // wie der Datenbau, ohne Ausnahme — und die drei Zeilen ohne Art werfen.
  it('liest jede Fixture-Zeile oder wirft nur die eigene Klasse', () => {
    let geworfen = 0
    for (const line of LINES.linien) {
      try {
        parseGenfTypeStationnement(line.TYPE_STATIONNEMENT)
      } catch (error) {
        expect(error).toBeInstanceOf(GenfParseError)
        expect(line.TYPE_STATIONNEMENT ?? null, String(line.OBJECTID)).toBeNull()
        geworfen += 1
      }
    }
    expect(geworfen).toBe(1)
  })

  // Gelb markiert heißt in der Schweiz Sonderberechtigung — Lieferanten,
  // bestimmte Fahrzeuge. „Gratuit jaune" als freien Autoplatz zu lesen wäre
  // die eine Lesart, die sicher falsch ist; darum steht es bei den anderen.
  it('hält gelbe Plätze für keine freien Autoplätze', () => {
    expect(parseGenfTypeStationnement('Gratuit jaune').vehicles).toBe('other')
    expect(parseGenfTypeStationnement('Gratuit jaune spécial').vehicles).toBe('other')
  })

  it('nimmt Leerraum und Mehrfachleerzeichen hin, sonst nichts', () => {
    expect(parseGenfTypeStationnement('  Payant  90 min ')).toEqual({ vehicles: 'car', regime: 'payant', maxStayMinutes: 90 })
    for (const unfug of ['', '   ', 'payant 90 min', 'Payant', 'Payant 90', 'Payant 90 minutes', 'Gratuit 1 heure 30',
      'Payant 0 min', 'Gratuit 0 heures', 'Payant 25 heures', 'Payant 1441 min', 'Vélo', 'Bus', 'Gratuit jaune spéciale']) {
      expect(() => parseGenfTypeStationnement(unfug), JSON.stringify(unfug)).toThrow(GenfParseError)
    }
    expect(() => parseGenfTypeStationnement(null)).toThrow(GenfParseError)
    expect(() => parseGenfTypeStationnement(undefined)).toThrow(GenfParseError)
    expect(() => parseGenfTypeStationnement('Payant 90 min'.padEnd(61, ' '))).toThrow(/Zeichen/)
  })

  // Eine Dauer von null ist dieselbe Falle wie ein Betrag von null: Niemand
  // weiß, was sie im Feed bedeutete, und „unbegrenzt" ist die Lesart, die
  // sie sicher nicht verdient.
  it('macht aus einer Null keine Unbegrenztheit', () => {
    expect(() => parseGenfTypeStationnement('Gratuit 0 min')).toThrow(/null/)
    expect(parseGenfTypeStationnement('Gratuit illimité')).toEqual({ vehicles: 'car', regime: 'gratuit', maxStayMinutes: null })
  })
})

describe('der Zonenschlüssel', () => {
  it('ist der Buchstabe der Ville oder die Nummer der Gemeinde, sonst nichts', () => {
    expect(genfZoneKey({ ZONE_MACARON: 'P' })).toBe('P')
    expect(genfZoneKey({ ZONE_MACARON: ' 43B ' })).toBe('43B')
    for (const unfug of [null, undefined, '', ' ', 'p', 'zone A', 'A-B', '12345']) {
      expect(() => genfZoneKey({ ZONE_MACARON: unfug }), JSON.stringify(unfug)).toThrow(GenfParseError)
    }
  })

  // 53 Zonen im Abzug: 52 mit Schlüssel, genau eine ohne (FID 52, Sektor
  // ein Leerzeichen). 17 Buchstaben A–Q sind die Ville de Genève.
  it('liest 52 der 53 Zonen des Abzugs, und die 17 Buchstaben sind A bis Q', () => {
    expect(ZONES.anzahl).toBe(53)
    expect(ZONES.zonen.length).toBe(53)
    const keys: string[] = []
    let ohne = 0
    for (const zone of ZONES.zonen) {
      try {
        keys.push(genfZoneKey(zone))
      } catch (error) {
        expect(error).toBeInstanceOf(GenfParseError)
        expect(zone['SITG_ADM.OTC_MACARON.FID']).toBe(52)
        expect(zone.NOM_SECTEUR).toBe(' ')
        ohne += 1
      }
    }
    expect(ohne).toBe(1)
    expect(new Set(keys).size).toBe(52)
    const letters = keys.filter((key) => /^[A-Z]$/.test(key)).sort()
    expect(letters).toEqual('ABCDEFGHIJKLMNOPQ'.split(''))
  })

  it('führt zu jeder Ville-Zone einen Sektor und ein Datum', () => {
    for (const zone of ZONES.zonen) {
      if (!/^[A-Z]$/.test(zone.ZONE_MACARON ?? '')) continue
      expect((zone.NOM_SECTEUR ?? '').trim().length, zone.ZONE_MACARON ?? '').toBeGreaterThan(0)
      expect(typeof zone.MISE_EN_SERVICE, zone.ZONE_MACARON ?? '').toBe('number')
      // Die erste Zone kam 1997 (C, Bastions), die letzte 2005 (P).
      expect(zone.MISE_EN_SERVICE as number).toBeGreaterThanOrEqual(Date.UTC(1997, 5, 1))
      expect(zone.MISE_EN_SERVICE as number).toBeLessThanOrEqual(Date.UTC(2005, 6, 1))
    }
  })
})

describe('die Höchstdauer als Schlüssel der Oberfläche', () => {
  it('schreibt volle Stunden als Stunden und den Rest in Minuten', () => {
    expect(genfMaxStayCode(30)).toBe('30min')
    expect(genfMaxStayCode(60)).toBe('1h')
    expect(genfMaxStayCode(90)).toBe('90min')
    expect(genfMaxStayCode(240)).toBe('4h')
    expect(genfMaxStayCode(900)).toBe('15h')
  })

  it('wirft bei allem, was keine Minutenzahl ist', () => {
    for (const unfug of [0, -60, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(() => genfMaxStayCode(unfug), String(unfug)).toThrow(GenfParseError)
    }
  })
})

describe('der Straßenname', () => {
  it('dreht die Registerform um und lässt alles andere stehen', () => {
    expect(genfStreetLabel('Comte-GÉRAUD, Rue du')).toBe('Rue du Comte-GÉRAUD')
    expect(genfStreetLabel('Mont-Blanc, Rue du')).toBe('Rue du Mont-Blanc')
    expect(genfStreetLabel('Avenue BLANC')).toBe('Avenue BLANC')
    expect(genfStreetLabel('  Saint-Léger,  Rue ')).toBe('Rue Saint-Léger')
    expect(genfStreetLabel('A, B, C')).toBe('A, B, C')
    expect(genfStreetLabel(null)).toBe('')
    expect(genfStreetLabel(undefined)).toBe('')
  })
})

describe('Genf als Stadt', () => {
  it('steht in CITIES, liegt in der Schweiz und hat den Genfer Kalender', () => {
    expect(CITIES).toContain(GENF)
    expect(cityCountry(GENF)).toBe('CH')
    expect(GENF.land).toBe('CH-GE')
    expect(GENF.zoom).toBe(13)
  })

  // Der Rahmen kommt aus der Gemeindegrenze der Ville, nicht aus dem Kanton
  // und nicht aus den 17 Zonen: Der Pont du Mont-Blanc, die Pâquis und
  // Champel liegen drin; Lausanne, Meyrin am Flughafen und Nyon nicht.
  it('löst die Ville de Genève auf und die Nachbarn nicht', () => {
    expect(cityAt(6.1478, 46.2071)?.key).toBe('genf') // Pont du Mont-Blanc
    expect(cityAt(6.1495, 46.2135)?.key).toBe('genf') // Pâquis
    expect(cityAt(6.1556, 46.1918)?.key).toBe('genf') // Champel
    expect(withinCity(GENF, 6.1478, 46.2071)).toBe(true)
    expect(cityAt(6.6328, 46.5197)).toBeUndefined() // Lausanne
    expect(cityAt(6.0794, 46.2334)).toBeUndefined() // Meyrin, Cité
    expect(cityAt(6.2396, 46.3832)).toBeUndefined() // Nyon
  })

  it('nennt die kantonale Fourrière mit Landesvorwahl', () => {
    expect(GENF.towedVehicles?.phone).toBe('+41 22 427 90 30')
    expect(GENF.towedVehicles?.url).toBe('https://www.ge.ch/fourriere-vehicules')
  })
})

describe('eine Genfer Zone in der Tarifrechnung', () => {
  const zone: ParkingZone = {
    id: 'L',
    name: 'L',
    land: 'CH-GE',
    fee: { kind: 'unknown' },
    windows: [],
    scheduleUnknown: true,
  }

  // Klasse C: Die Antwort ist „Zeiten unbekannt", nicht „frei" — an einem
  // Dienstagvormittag, an dem die Parkuhren der Pâquis sehr wohl laufen.
  it('sagt an einem Werktag unknown statt frei und rechnet nichts', () => {
    const dienstag = Date.UTC(2026, 8, 15, 8, 30)
    expect(chargeableAt(zone, dienstag)).toEqual({ chargeable: false, uncertain: false, unknown: true, changesAt: null })
    expect(estimateCost(zone, dienstag, 120).priced).toBe(false)
  })

  // Und der Feiertag kommt aus dem Genfer Gesetz, nicht aus einem deutschen:
  // Der Jeûne genevois 2026 ist ein Donnerstag, in Berlin ein Werktag.
  it('kennt den Jeûne genevois über das Land der Zone', () => {
    expect(isHoliday(zone.land, berlinWallClock(Date.UTC(2026, 8, 10, 10)))).toBe(true)
    expect(isHoliday('BE', berlinWallClock(Date.UTC(2026, 8, 10, 10)))).toBe(false)
    expect(holidaysFor('CH-GE', 2026).has('2026-05-01')).toBe(false)
  })
})
