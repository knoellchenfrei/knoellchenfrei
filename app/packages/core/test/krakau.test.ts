import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import { cityAt, cityByKey, cityCountry, withinCity } from '../src/city.js'
import { holidaysFor } from '../src/holidays.js'
import {
  KrakauParseError,
  krakauDatumDeutsch,
  krakauNote,
  krakauSektor,
  krakauZoneKey,
  krakauZoneNote,
  parseKrakauPodstrefa,
  parseKrakauSektorNr,
  parseKrakauSince,
  type KrakauGranicaProperties,
  type KrakauSektorProperties,
} from '../src/krakau.js'
import { chargeableAt, estimateCost, isChargeable, type ParkingZone } from '../src/tariff.js'

/**
 * Die echten Attributzeilen der drei Ebenen, abgerufen am 17. September 2026.
 *
 * Bei 23 + 4 + 26 Zeilen passt alles in die Fixtures, und „jeder Wert liest
 * sich" prüft wirklich jeden Wert.
 */
const read = <T>(name: string): T =>
  JSON.parse(readFileSync(fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url)), 'utf8')) as T

const GRENZEN = read<KrakauGranicaProperties[]>('krk-granice-stref-2026-09-17.json')
const ERWEITERUNG = read<KrakauGranicaProperties[]>('krk-poszerzenie-2026-09-17.json')
const SEKTOREN = read<KrakauSektorProperties[]>('krk-sektory-2026-09-17.json')

const KRAKAU = cityByKey('krakau')

describe('parseKrakauPodstrefa', () => {
  it('liest die vier Buchstaben des Wertebereichs, mit und ohne n', () => {
    expect(parseKrakauPodstrefa('A')).toEqual({ podstrefa: 'A', planned: false })
    expect(parseKrakauPodstrefa('C')).toEqual({ podstrefa: 'C', planned: false })
    expect(parseKrakauPodstrefa('nB')).toEqual({ podstrefa: 'B', planned: true })
    expect(parseKrakauPodstrefa('nC')).toEqual({ podstrefa: 'C', planned: true })
    // D steht im Wertebereich der Ebene 37, im Abzug nicht.
    expect(parseKrakauPodstrefa('D')).toEqual({ podstrefa: 'D', planned: false })
  })

  it('nimmt Leerraum und Kleinschreibung als dieselbe Aussage', () => {
    expect(parseKrakauPodstrefa(' a ')).toEqual({ podstrefa: 'A', planned: false })
    expect(parseKrakauPodstrefa('nb')).toEqual({ podstrefa: 'B', planned: true })
  })

  it('weist alles ab, was keine Podstrefa ist, mit der eigenen Fehlerklasse', () => {
    for (const raw of ['', 'E', 'AB', 'Podstrefa A', 'n', 'nn', 'N', 'A1', '1', 'ä', 'a'.repeat(81)]) {
      expect(() => parseKrakauPodstrefa(raw), raw).toThrow(KrakauParseError)
    }
  })

  // Die Schreibweisen des Abzugs, gezählt: Kommt eine neue dazu, fällt es
  // hier auf, nicht im Datenbau.
  it('kennt genau die Werte der drei Ebenen: A/B/C in den Grenzen, A/B/C/nB/nC in der Ebene 37', () => {
    const zaehle = (values: readonly (string | null | undefined)[]): Record<string, number> => {
      const counts: Record<string, number> = {}
      for (const value of values) counts[String(value)] = (counts[String(value)] ?? 0) + 1
      return counts
    }
    expect(zaehle(GRENZEN.map((row) => row.Podstrefa_))).toEqual({ A: 7, B: 5, C: 11 })
    expect(zaehle(ERWEITERUNG.map((row) => row.Podstrefa_))).toEqual({ B: 1, C: 3 })
    expect(zaehle(SEKTOREN.map((row) => row.Podstrefa_spp))).toEqual({ A: 7, B: 5, C: 8, nB: 1, nC: 5 })
  })
})

describe('parseKrakauSektorNr', () => {
  it('nimmt eine ganze Zahl von 1 bis 999', () => {
    expect(parseKrakauSektorNr(1)).toBe(1)
    expect(parseKrakauSektorNr(30)).toBe(30)
    expect(parseKrakauSektorNr(999)).toBe(999)
  })

  // Der Frankfurter Vorfall: Ein Feld, das als Zahl deklariert ist, kommt
  // als Zeichenkette — und `12 === '12'` ist stillschweigend falsch.
  it('weist Zeichenketten, Brüche, Null und Unfug ab', () => {
    for (const raw of ['12', 0, -1, 1.5, 1000, Number.NaN, Number.POSITIVE_INFINITY, null, undefined, {}]) {
      expect(() => parseKrakauSektorNr(raw), String(raw)).toThrow(KrakauParseError)
    }
  })
})

describe('krakauSektor und krakauZoneKey', () => {
  it('liest beide Feldnamen — Podstrefa_spp in der Ebene 37, Podstrefa_ in den jüngeren', () => {
    expect(krakauSektor({ Podstrefa_spp: 'A', Nr_sektora: 1 })).toEqual({ podstrefa: 'A', nr: 1, planned: false })
    expect(krakauSektor({ Podstrefa_: 'nC', Nr_sektora: 32 })).toEqual({ podstrefa: 'C', nr: 32, planned: true })
  })

  it('wirft ohne Podstrefa und bei zwei Feldern, die sich widersprechen', () => {
    expect(() => krakauSektor({ Nr_sektora: 1 })).toThrow(KrakauParseError)
    expect(() => krakauSektor({ Podstrefa_spp: null, Podstrefa_: null, Nr_sektora: 1 })).toThrow(KrakauParseError)
    expect(() => krakauSektor({ Podstrefa_spp: 'A', Podstrefa_: 'B', Nr_sektora: 1 })).toThrow(/widersprechen/)
    // Zweimal dasselbe ist kein Widerspruch.
    expect(krakauSektor({ Podstrefa_spp: 'A', Podstrefa_: 'A', Nr_sektora: 1 }).podstrefa).toBe('A')
  })

  it('schreibt den Schlüssel wie die Stadt: Buchstabe und Nummer, ohne n', () => {
    expect(krakauZoneKey({ podstrefa: 'B', nr: 30, planned: false })).toBe('B30')
    expect(krakauZoneKey({ podstrefa: 'C', nr: 7, planned: true })).toBe('C7')
  })

  it('liest jede Zeile der drei Ebenen, ohne zu werfen', () => {
    for (const row of [...GRENZEN, ...ERWEITERUNG, ...SEKTOREN]) {
      expect(() => krakauSektor(row), JSON.stringify(row)).not.toThrow()
    }
  })

  // Die 23 Schlüssel der Karte sind eindeutig; die Ebene 37 führt B30
  // zweimal — einmal geltend, einmal als geplante Erweiterung.
  it('vergibt in den Grenzen 23 verschiedene Schlüssel, in der Ebene 37 den B30 doppelt', () => {
    const grenzen = GRENZEN.map((row) => krakauZoneKey(krakauSektor(row)))
    expect(new Set(grenzen).size).toBe(23)
    const sektoren = SEKTOREN.map((row) => krakauZoneKey(krakauSektor(row)))
    expect(sektoren.length).toBe(26)
    expect(new Set(sektoren).size).toBe(25)
    expect(sektoren.filter((key) => key === 'B30')).toHaveLength(2)
  })

  // Die Karte kennt genau die 20 geltenden Sektoren der Ebene 37 plus die
  // drei neuen der Erweiterung; die Ebene 37 kennt zwei geplante (32, 33),
  // die die Karte nicht zeigt. Ändert sich das, hat die Stadt etwas
  // beschlossen — und der Datenbau soll es im Log sagen, nicht hier raten.
  it('hält die drei Ebenen gegeneinander: 20 + 3 = 23, zwei geplante bleiben aussen', () => {
    const grenzen = new Set(GRENZEN.map((row) => krakauZoneKey(krakauSektor(row))))
    const geltend = SEKTOREN.filter((row) => !krakauSektor(row).planned).map((row) => krakauZoneKey(krakauSektor(row)))
    const geplant = SEKTOREN.filter((row) => krakauSektor(row).planned).map((row) => krakauZoneKey(krakauSektor(row)))
    const erweitert = ERWEITERUNG.map((row) => krakauZoneKey(krakauSektor(row)))
    expect(geltend).toHaveLength(20)
    for (const key of geltend) expect(grenzen.has(key), key).toBe(true)
    expect(erweitert.sort()).toEqual(['B30', 'C23', 'C24', 'C31'])
    for (const key of erweitert) expect(grenzen.has(key), key).toBe(true)
    expect(geplant.sort()).toEqual(['B30', 'C23', 'C24', 'C31', 'C32', 'C33'])
    expect(geplant.filter((key) => !grenzen.has(key))).toEqual(['C32', 'C33'])
  })
})

describe('parseKrakauSince und krakauNote', () => {
  it('liest „Od 10 sierpnia 2026" als 2026-08-10', () => {
    expect(parseKrakauSince('Od 10 sierpnia 2026')).toBe('2026-08-10')
    expect(parseKrakauSince('od 1 stycznia 2027')).toBe('2027-01-01')
    expect(parseKrakauSince('  Od 31 grudnia 2026 ')).toBe('2026-12-31')
    expect(parseKrakauSince('Od 15 września 2026')).toBe('2026-09-15')
  })

  it('kennt alle zwölf Monate im Genitiv', () => {
    const months = ['stycznia', 'lutego', 'marca', 'kwietnia', 'maja', 'czerwca', 'lipca', 'sierpnia', 'września', 'października', 'listopada', 'grudnia']
    months.forEach((month, index) => {
      expect(parseKrakauSince(`Od 1 ${month} 2026`)).toBe(`2026-${String(index + 1).padStart(2, '0')}-01`)
    })
  })

  it('weist einen Tag ab, den es im Monat nicht gibt, statt ihn zu verschieben', () => {
    expect(() => parseKrakauSince('Od 31 lutego 2026')).toThrow(KrakauParseError)
    expect(() => parseKrakauSince('Od 0 maja 2026')).toThrow(KrakauParseError)
    expect(() => parseKrakauSince('Od 32 maja 2026')).toThrow(KrakauParseError)
  })

  it('weist Nominativ, deutsche Monate, Ziffernmonate und Unfug ab', () => {
    for (const raw of ['Od 10 sierpień 2026', 'Od 10 August 2026', 'Od 10.08.2026', '10 sierpnia 2026', 'Od sierpnia 2026', 'Od 10 sierpnia 26', 'Od 10 sierpnia 1999', 'Od 10 sierpnia 2101', '', ' ', 'x'.repeat(81)]) {
      expect(() => parseKrakauSince(raw), raw).toThrow(KrakauParseError)
    }
  })

  it('liest ein Leerzeichen und null als keine Bemerkung — und alles andere als Datum', () => {
    expect(krakauNote(' ')).toBeNull()
    expect(krakauNote('')).toBeNull()
    expect(krakauNote(null)).toBeNull()
    expect(krakauNote(undefined)).toBeNull()
    expect(krakauNote('Od 10 sierpnia 2026')).toBe('2026-08-10')
    expect(() => krakauNote('uwaga')).toThrow(KrakauParseError)
  })

  // Die Bemerkungen des Abzugs, vollständig: In der Erweiterung viermal das
  // Datum, in den Grenzen nur Platzhalter, in der Ebene 37 null.
  it('liest jede Bemerkung der drei Ebenen', () => {
    expect(ERWEITERUNG.map((row) => krakauNote(row.Uwagi))).toEqual(['2026-08-10', '2026-08-10', '2026-08-10', '2026-08-10'])
    expect(new Set(GRENZEN.map((row) => krakauNote(row.Uwagi)))).toEqual(new Set([null]))
    expect(new Set(SEKTOREN.map((row) => krakauNote(row.Uwagi)))).toEqual(new Set([null]))
  })
})

describe('krakauZoneNote und krakauDatumDeutsch', () => {
  it('schreibt Sektor und Podstrefa aus, und was die Erweiterung geändert hat', () => {
    const b30 = { podstrefa: 'B' as const, nr: 30, planned: false }
    expect(krakauZoneNote(b30, null, false)).toBe('Sektor 30, Podstrefa B')
    expect(krakauZoneNote(b30, '2026-08-10', true)).toBe('Sektor 30, Podstrefa B — seit 10. August 2026 erweitert')
    expect(krakauZoneNote({ podstrefa: 'C', nr: 23, planned: false }, '2026-08-10', false)).toBe(
      'Sektor 23, Podstrefa C — neu seit 10. August 2026'
    )
  })

  it('schreibt ein ISO-Datum deutsch und wirft bei allem anderen', () => {
    expect(krakauDatumDeutsch('2026-08-10')).toBe('10. August 2026')
    expect(krakauDatumDeutsch('2027-01-01')).toBe('1. Januar 2027')
    expect(() => krakauDatumDeutsch('10.08.2026')).toThrow(KrakauParseError)
    expect(() => krakauDatumDeutsch('2026-13-01')).toThrow(KrakauParseError)
  })
})

describe('eine Krakauer Zone im gemeinsamen Tarifmodell', () => {
  // So baut `build-data-krakau.ts` jede Zone: keine Fenster, kein Betrag,
  // und die Marke, die aus „frei" ein „unbekannt" macht.
  const zone: ParkingZone = {
    id: 'A1',
    name: 'A1',
    land: 'PL-MA',
    fee: { kind: 'unknown' },
    windows: [],
    scheduleUnknown: true,
  }

  it('ist zu keiner Zeit gebührenpflichtig UND sagt, dass das keine Aussage ist', () => {
    const dienstag = new Date('2026-09-15T10:30:00+02:00')
    expect(isChargeable(zone, dienstag)).toBe(false)
    const status = chargeableAt(zone, dienstag)
    expect(status).toEqual({ chargeable: false, uncertain: false, unknown: true, changesAt: null })
  })

  it('beziffert keine Kosten — kein Betrag ist nicht null Złoty', () => {
    const estimate = estimateCost(zone, new Date('2026-09-15T10:30:00+02:00'), 60)
    expect(estimate.priced).toBe(false)
  })

  // Der ZDMK nennt auf seiner Seite genau die gebührenfreien Tage; der
  // Kalender `PL-MA` muss dieselben liefern — die zwei Sonntage (Ostern,
  // Pfingsten) ausgenommen, die das Modell ohnehin nicht führt.
  it('kennt die gebührenfreien Tage, die der ZDMK für alle Podstrefy nennt', () => {
    const zdmk = [
      '2026-01-01', // Nowy Rok
      '2026-01-06', // Święto Trzech Króli
      '2026-04-06', // drugi dzień Wielkiej Nocy
      '2026-05-01', // Święto Pracy
      '2026-05-03', // Święto Narodowe Trzeciego Maja
      '2026-06-04', // Boże Ciało
      '2026-08-15', // Wniebowzięcie NMP
      '2026-11-01', // Wszystkich Świętych
      '2026-11-11', // Narodowe Święto Niepodległości
      '2026-12-24', // Wigilia
      '2026-12-25',
      '2026-12-26',
    ]
    expect([...holidaysFor('PL-MA', 2026)].sort()).toEqual(zdmk)
  })
})

describe('Krakau als Stadt', () => {
  it('liegt in Polen, mit dem Rynek Główny in der Mitte', () => {
    expect(cityCountry(KRAKAU)).toBe('PL')
    expect(KRAKAU.land).toBe('PL-MA')
    expect(withinCity(KRAKAU, 19.9372, 50.0616)).toBe(true)
  })

  // Der Rahmen kommt aus der Stadtgrenze, nicht aus den Sektoren: Nowa Huta
  // und Swoszowice haben keine Zone und gehören dazu. Bochnia und
  // Myślenice liegen nebenan und nicht.
  it('reicht vom Rynek bis Nowa Huta und Swoszowice, nicht bis Bochnia', () => {
    expect(cityAt(19.9372, 50.0616)?.key).toBe('krakau') // Rynek Główny
    expect(cityAt(20.0373, 50.0722)?.key).toBe('krakau') // Plac Centralny, Nowa Huta
    expect(cityAt(19.9455, 49.9899)?.key).toBe('krakau') // Swoszowice
    expect(cityAt(20.4300, 49.9690)).toBeUndefined() // Bochnia
    expect(cityAt(19.9370, 49.8340)).toBeUndefined() // Myślenice
  })

  it('trägt die offene Lizenzfrage und die Auskunftsstelle des ZDMK', () => {
    expect(KRAKAU.attribution.licenceFamily).toBe('unklar')
    expect(KRAKAU.licenceOpen).toMatch(/poglądowy/)
    expect(KRAKAU.towedVehicles?.url).toMatch(/^https:\/\/zdmk\.krakow\.pl\//)
    expect(KRAKAU.towedVehicles?.phone).toMatch(/^\+48 /)
  })
})
