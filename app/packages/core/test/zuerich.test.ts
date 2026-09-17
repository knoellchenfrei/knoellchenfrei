import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import type { Weekday } from '../src/berlin-time.js'
import { ZUERICH, withinCity } from '../src/city.js'
import { holidaysFor } from '../src/holidays.js'
import { estimateCost, isChargeable, type ParkingZone } from '../src/tariff.js'
import {
  ZUERICH_ORDINANCE,
  ZUERICH_SPECIAL_TARIFFS,
  ZuerichParseError,
  parseZuerichMaxStay,
  parseZuerichMeterTariff,
  parseZuerichSchedule,
  parseZuerichTariffZone,
  zuerichFeeFor,
  zuerichFeeText,
  zuerichMaxStayLabel,
  zuerichMeterTariffText,
  type ZuerichMeterProperties,
  type ZuerichQuartierProperties,
  type ZuerichSpaceProperties,
  type ZuerichZoneProperties,
} from '../src/zuerich.js'

/**
 * Die echten Quellen, abgerufen am 17. September 2026.
 *
 * Wie bei den zehn Städten davor: Fixtures sind der Feed, nicht ausgedachte
 * Beispiele. Die Tarifflächen und die Quartiere stehen vollständig darin; von
 * den 1.397 Parkuhren steht je Schreibweise von `tarif` eine (33), von den
 * 13.272 Parkfeldern je Kombination aus Art, Gebührenpflicht, Kategorie und
 * Parkdauer eines (33) — dazu die Zählung aller Werte, damit der Test
 * „liest jeden Wert des Abzugs" wirklich jeden Wert kennt.
 */
interface Counted<T> {
  text: T
  anzahl: number
}

interface ZoneFixture {
  abgerufenAm: string
  anzahl: number
  zonen: ZuerichZoneProperties[]
  geometrie: { objectid: number; typ: string; stuetzpunkte: number; ersterPunkt: [number, number] }[]
}

interface MeterFixture {
  anzahl: number
  typen: Counted<string>[]
  tarife: Counted<string>[]
  parkuhren: (ZuerichMeterProperties & { punkt: [number, number] })[]
}

interface SpaceFixture {
  anzahl: number
  arten: Counted<string>[]
  gebpflicht: Counted<string>[]
  kategorien: Counted<string>[]
  parkdauer: { wert: number | null; anzahl: number }[]
  parkfelder: (ZuerichSpaceProperties & { punkt: [number, number] })[]
}

interface QuartierFixture {
  anzahl: number
  quartiere: ZuerichQuartierProperties[]
}

const read = <T>(name: string): T =>
  JSON.parse(readFileSync(fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url)), 'utf8')) as T

const ZONES = read<ZoneFixture>('zh-tarifzonen-2026-09-17.json')
const METERS = read<MeterFixture>('zh-parkuhren-2026-09-17.json')
const SPACES = read<SpaceFixture>('zh-parkfelder-2026-09-17.json')
const QUARTIERE = read<QuartierFixture>('zh-quartiere-2026-09-17.json')

const MO_SA: readonly Weekday[] = [1, 2, 3, 4, 5, 6]
const ALLE: readonly Weekday[] = [0, 1, 2, 3, 4, 5, 6]

describe('parseZuerichSchedule', () => {
  it('liest die eine Schreibweise des Abzugs', () => {
    expect(parseZuerichSchedule('Montag - Samstag, 9:00 - 20:00 Uhr')).toEqual([
      { weekdays: MO_SA, fromMinute: 540, toMinute: 1200 },
    ])
  })

  it('liest jede Fläche der Fixture ohne Ausnahme', () => {
    expect(ZONES.zonen).toHaveLength(2)
    for (const zone of ZONES.zonen) {
      expect(parseZuerichSchedule(zone.bedienungszeiten)).toEqual([
        { weekdays: MO_SA, fromMinute: 540, toMinute: 1200 },
      ])
    }
  })

  // Eine Stadt darf ihre Schreibweise ändern, ohne dass der Bau still leer
  // läuft: Kürzel, „bis", Halbgeviertstrich, ohne „Uhr", ohne Minuten.
  it('nimmt Kürzel, „bis", den Halbgeviertstrich und Zeiten ohne Minuten', () => {
    const erwartet = [{ weekdays: MO_SA, fromMinute: 540, toMinute: 1200 }]
    expect(parseZuerichSchedule('Mo-Sa 9-20')).toEqual(erwartet)
    expect(parseZuerichSchedule('Montag bis Samstag, 9:00 bis 20:00 Uhr')).toEqual(erwartet)
    expect(parseZuerichSchedule('montag – samstag, 9:00 – 20:00 uhr')).toEqual(erwartet)
    expect(parseZuerichSchedule('  Montag  -  Samstag ,  9:00  -  20:00  Uhr ')).toEqual(erwartet)
  })

  it('liest einen einzelnen Tag und mehrere Klauseln', () => {
    expect(parseZuerichSchedule('Sonntag, 10:00 - 18:00 Uhr')).toEqual([
      { weekdays: [0], fromMinute: 600, toMinute: 1080 },
    ])
    expect(parseZuerichSchedule('Montag - Freitag, 8:00 - 19:00 Uhr; Samstag, 9:00 - 16:00 Uhr')).toEqual([
      { weekdays: [1, 2, 3, 4, 5], fromMinute: 480, toMinute: 1140 },
      { weekdays: [6], fromMinute: 540, toMinute: 960 },
    ])
  })

  it('legt ein Fenster über Mitternacht auf zwei Tage und liest 24:00 als 1440', () => {
    expect(parseZuerichSchedule('Freitag - Samstag, 22:00 - 2:00 Uhr')).toEqual([
      { weekdays: [5, 6], fromMinute: 1320, toMinute: 1440 },
      { weekdays: [0, 6], fromMinute: 0, toMinute: 120 },
    ])
    expect(parseZuerichSchedule('Montag - Sonntag, 0:00 - 24:00 Uhr')).toEqual([
      { weekdays: ALLE, fromMinute: 0, toMinute: 1440 },
    ])
  })

  // Die Wortgrenze steckt im ganzen Muster: „Mit" ist kein Mittwoch, und eine
  // Zeile ohne Tag oder ohne Zeit ist keine Zeitangabe.
  it('weist ab, was keine Zeitangabe ist — und wirft dabei nur seine eigene Klasse', () => {
    for (const raw of [
      '',
      ' ',
      'Mit, 9:00 - 20:00 Uhr',
      'Montag - Samstag',
      '9:00 - 20:00 Uhr',
      'Montag - Samstag, 9:00 - 20:00 Uhr, Feiertage frei',
      'Montag - Samstag, 9:60 - 20:00 Uhr',
      'Montag - Samstag, 9:00 - 25:00 Uhr',
      'Montag - Samstag, 9:00 - 9:00 Uhr',
      'Montag - Samstag, 24:00 - 9:00 Uhr',
      'Montag - Samstag, 9:00 - 0:00 Uhr',
      'Montag - Samstag, 9:00 - 20:00 Uhr;',
    ]) {
      expect(() => parseZuerichSchedule(raw), raw).toThrow(ZuerichParseError)
    }
    expect(() => parseZuerichSchedule(null)).toThrow(ZuerichParseError)
    expect(() => parseZuerichSchedule(undefined)).toThrow(ZuerichParseError)
  })

  it('begrenzt fremde Eingabe, bevor irgendetwas sie anfasst', () => {
    expect(() => parseZuerichSchedule('Montag - Samstag, '.repeat(10))).toThrow(/Zeichen/)
  })
})

describe('parseZuerichTariffZone', () => {
  it('liest die eine Stufe des Abzugs und die andere des Erlasses', () => {
    expect(parseZuerichTariffZone('Hochtarifzone')).toBe('hoch')
    expect(parseZuerichTariffZone(' hochtarifzone ')).toBe('hoch')
    expect(parseZuerichTariffZone('Niedertarifzone')).toBe('nieder')
    for (const zone of ZONES.zonen) expect(parseZuerichTariffZone(zone.tarifzone)).toBe('hoch')
  })

  it('kennt keine dritte Stufe', () => {
    for (const raw of ['', 'Mitteltarifzone', 'Hochtarifzone Innenstadt', 'HOCH', 'Zoo']) {
      expect(() => parseZuerichTariffZone(raw), raw).toThrow(ZuerichParseError)
    }
    expect(() => parseZuerichTariffZone(null)).toThrow(ZuerichParseError)
  })
})

describe('parseZuerichMeterTariff', () => {
  it('liest die häufigste Zeile: Hochtarif, zwei Stunden, Montag bis Samstag', () => {
    expect(parseZuerichMeterTariff('HOCH 2h Mo-Sa 09:00-20:00')).toEqual({
      kind: 'regular',
      level: 'hoch',
      maxStayMinutes: 120,
      windows: [{ weekdays: MO_SA, fromMinute: 540, toMinute: 1200 }],
    })
  })

  it('liest halbe Stunden, 48 Stunden und den ganzen Tag', () => {
    const halb = parseZuerichMeterTariff('NIEDER 0.5h Mo-Sa 09:00-20:00')
    expect(halb.kind === 'regular' && halb.maxStayMinutes).toBe(30)
    const lang = parseZuerichMeterTariff('NIEDER 48h Mo-So 00:00-24:00')
    expect(lang).toEqual({
      kind: 'regular',
      level: 'nieder',
      maxStayMinutes: 2880,
      windows: [{ weekdays: ALLE, fromMinute: 0, toMinute: 1440 }],
    })
    const abend = parseZuerichMeterTariff('HOCH 2h Mo-So 08:00-21:00')
    expect(abend.kind === 'regular' && abend.windows).toEqual([{ weekdays: ALLE, fromMinute: 480, toMinute: 1260 }])
  })

  it('gibt die acht Sonderbezeichnungen wörtlich zurück, statt sie zu deuten', () => {
    for (const label of ZUERICH_SPECIAL_TARIFFS) {
      expect(parseZuerichMeterTariff(label)).toEqual({ kind: 'special', label })
    }
    expect(ZUERICH_SPECIAL_TARIFFS).toHaveLength(8)
  })

  // Jede der 33 Schreibweisen des Abzugs — 25 regulär, 8 Sonderbezeichnungen —
  // liest sich ohne Ausnahme, und die Zählung deckt alle 1.397 Parkuhren.
  it('liest jede Schreibweise des Abzugs und zählt sie vollständig', () => {
    expect(METERS.tarife).toHaveLength(33)
    expect(METERS.tarife.reduce((sum, entry) => sum + entry.anzahl, 0)).toBe(METERS.anzahl)
    expect(METERS.anzahl).toBe(1397)
    let regular = 0
    let special = 0
    for (const entry of METERS.tarife) {
      const tariff = parseZuerichMeterTariff(entry.text)
      if (tariff.kind === 'regular') {
        regular += 1
        expect(tariff.windows.length, entry.text).toBeGreaterThan(0)
        expect(tariff.maxStayMinutes, entry.text).toBeGreaterThan(0)
      } else {
        special += 1
      }
    }
    expect(regular).toBe(25)
    expect(special).toBe(8)
    for (const meter of METERS.parkuhren) expect(() => parseZuerichMeterTariff(meter.tarif)).not.toThrow()
  })

  it('weist ab, was weder Tarifzeile noch bekannte Sonderbezeichnung ist', () => {
    for (const raw of [
      '',
      'HOCH 2h',
      'MITTEL 2h Mo-Sa 09:00-20:00',
      'HOCH 0h Mo-Sa 09:00-20:00',
      'HOCH 2h Mo-Sa 9-20',
      'HOCH 2h Mo-Sa 09:00-20:00 Uhr',
      'HOCH 2h Mit-Sa 09:00-20:00',
      'HOCH 2h Mo-Sa 20:00-20:00',
      'Zoo ganze woche',
      'Theater 12',
    ]) {
      expect(() => parseZuerichMeterTariff(raw), raw).toThrow(ZuerichParseError)
    }
    expect(() => parseZuerichMeterTariff(null)).toThrow(ZuerichParseError)
  })

  it('nennt die Stufe, die Dauer und den Betrag der ersten Stunde in Worten', () => {
    expect(zuerichMeterTariffText(parseZuerichMeterTariff('HOCH 2h Mo-Sa 09:00-20:00'))).toBe(
      'Hochtarif, 2 h (3,00 CHF je erste Stunde)'
    )
    expect(zuerichMeterTariffText(parseZuerichMeterTariff('NIEDER 0.5h Mo-Sa 09:00-20:00'))).toBe(
      'Niedertarif, 30 min (0,50 CHF je erste Stunde)'
    )
    expect(zuerichMeterTariffText({ kind: 'special', label: 'Theater 11' })).toBe('Theater 11')
  })
})

describe('parseZuerichMaxStay', () => {
  it('liest jeden Wert des Abzugs — Zahlen in Minuten, null nur ohne Parkuhr', () => {
    expect(SPACES.parkdauer).toHaveLength(10)
    for (const entry of SPACES.parkdauer) {
      const minutes = parseZuerichMaxStay(entry.wert)
      if (entry.wert === null) expect(minutes).toBeUndefined()
      else expect(minutes).toBe(entry.wert)
    }
    // `null` steht genau an den Feldern ohne Parkuhr (`OPU`, nicht
    // gebührenpflichtig) — 4.829 mal, dieselbe Zahl in drei Zählungen.
    const ohne = SPACES.parkdauer.find((entry) => entry.wert === null)?.anzahl
    expect(ohne).toBe(SPACES.kategorien.find((entry) => entry.text === 'OPU')?.anzahl)
    expect(ohne).toBe(SPACES.gebpflicht.find((entry) => entry.text === '0')?.anzahl)
    for (const space of SPACES.parkfelder) {
      expect(parseZuerichMaxStay(space.parkdauer) === undefined, String(space.objectid)).toBe(space.kategorie === 'OPU')
    }
  })

  it('nimmt eine numerische Zeichenkette, falls der Feldtyp kippt', () => {
    expect(parseZuerichMaxStay('120')).toBe(120)
    expect(parseZuerichMaxStay(' 30 ')).toBe(30)
  })

  it('weist Null, Brüche, Unendlich und mehr als eine Woche ab', () => {
    for (const raw of [0, -60, 1.5, Number.NaN, Number.POSITIVE_INFINITY, 20_000, '0', '12.5', 'zwei', '']) {
      expect(() => parseZuerichMaxStay(raw), String(raw)).toThrow(ZuerichParseError)
    }
  })

  it('beschriftet Minuten so, wie die Karte sie nennt', () => {
    expect(zuerichMaxStayLabel(30)).toBe('30 min')
    expect(zuerichMaxStayLabel(60)).toBe('1 h')
    expect(zuerichMaxStayLabel(90)).toBe('1,5 h')
    expect(zuerichMaxStayLabel(2880)).toBe('48 h')
  })
})

describe('der Erlass (AS 551.330)', () => {
  it('nennt für den Hochtarif eine Spanne der Grenzsätze und für den Niedertarif einen Satz — in Franken', () => {
    expect(zuerichFeeFor('hoch')).toEqual({ kind: 'range', minCentsPerHour: 150, maxCentsPerHour: 450, currency: 'CHF' })
    expect(zuerichFeeFor('nieder')).toEqual({ kind: 'exact', centsPerHour: 50, currency: 'CHF' })
    expect(zuerichFeeText('hoch')).toContain('1 h = 3,00 CHF')
    expect(zuerichFeeText('nieder')).toContain('0,50 CHF für 1 Stunde')
    expect(ZUERICH_ORDINANCE.validFrom).toBe('2017-04-01')
    expect(ZUERICH_ORDINANCE.url).toMatch(/^https:\/\/www\.stadt-zuerich\.ch\//)
  })

  // Die Staffel des Erlasses, nachgerechnet: 30 min 0,75, 1 h 3,00, 2 h 7,50,
  // 3 h 9,50 Franken. Die Spanne 1,50–4,50 je Stunde umschliesst jeden dieser
  // Beträge — das ist der Grund für die Spanne statt eines Mittelwerts.
  it('umschliesst mit der Spanne jeden Betrag der Staffel', () => {
    const staffel: [number, number][] = [
      [30, 75],
      [60, 300],
      [120, 750],
      [180, 950],
    ]
    for (const [minutes, cents] of staffel) {
      const min = (minutes * 150) / 60
      const max = (minutes * 450) / 60
      expect(cents >= min && cents <= max, `${minutes} min = ${cents} Rp.`).toBe(true)
    }
  })

  it('kennt die drei Gebiete des Art. 2 mit Ankern in der Stadt und ASCII-Schlüsseln', () => {
    expect(ZUERICH_ORDINANCE.areas.map((area) => area.key)).toEqual(['Innenstadt', 'Oerlikon', 'Zuerich-West'])
    for (const area of ZUERICH_ORDINANCE.areas) {
      expect(area.key).toMatch(/^[A-Za-z-]+$/)
      expect(withinCity(ZUERICH, ...area.anchor), area.anchorName).toBe(true)
      expect(area.article).toMatch(/^Art\. 2 Abs\. [123]$/)
    }
    // Der Innenstadt-Anker liegt in der ersten Fläche der Fixture, deren
    // erster Stützpunkt bei 8,548 / 47,379 steht; der Oerlikon-Anker vier
    // Kilometer nördlich. Zwei Anker in einer Fläche gäbe es nur, wenn die
    // Stadt beide zu einem Polygon verbände.
    const [innenstadt, oerlikon] = ZUERICH_ORDINANCE.areas
    expect(Math.abs((innenstadt?.anchor[1] ?? 0) - (oerlikon?.anchor[1] ?? 0))).toBeGreaterThan(0.03)
  })
})

/**
 * Die Tarifrechnung an einer Zürcher Zone — mit dem Kalender des Kantons.
 *
 * Der Fehler, den `land: 'CH-ZH'` verhindert: Mit Berlins Kalender wäre der
 * 3. Oktober frei und der 1. August nicht; mit einem erfundenen Berchtoldstag
 * wäre der 2. Januar frei, obwohl er im RLG nicht steht.
 */
describe('eine Hochtarifzone in der Tarifrechnung', () => {
  const zone: ParkingZone = {
    id: 'Innenstadt',
    name: 'Innenstadt',
    land: 'CH-ZH',
    fee: zuerichFeeFor('hoch'),
    windows: parseZuerichSchedule(ZONES.zonen[0]?.bedienungszeiten),
  }

  it('kassiert dienstags um 10 und samstags um 19:30, nicht um 20:30 und nicht sonntags', () => {
    expect(isChargeable(zone, Date.UTC(2026, 8, 15, 8, 0))).toBe(true) // Di 10:00
    expect(isChargeable(zone, Date.UTC(2026, 8, 19, 17, 30))).toBe(true) // Sa 19:30
    expect(isChargeable(zone, Date.UTC(2026, 8, 19, 18, 30))).toBe(false) // Sa 20:30
    expect(isChargeable(zone, Date.UTC(2026, 8, 20, 8, 0))).toBe(false) // So 10:00
  })

  it('hält den Karfreitag und den 1. August frei, den Berchtoldstag und den 3. Oktober nicht', () => {
    expect(isChargeable(zone, Date.UTC(2026, 3, 3, 8, 0))).toBe(false) // Karfreitag, Freitag
    expect(isChargeable(zone, Date.UTC(2026, 7, 1, 8, 0))).toBe(false) // 1. August, Samstag
    expect(isChargeable(zone, Date.UTC(2026, 0, 2, 9, 0))).toBe(true) // Berchtoldstag, Freitag
    expect(isChargeable(zone, Date.UTC(2026, 9, 3, 8, 0))).toBe(true) // 3. Oktober, Samstag
    expect(holidaysFor('CH-ZH', 2026).has('2026-01-02')).toBe(false)
  })

  it('schätzt eine Stunde als 1,50 bis 4,50 Franken — nie in Euro', () => {
    const estimate = estimateCost(zone, Date.UTC(2026, 8, 15, 8, 0), 60)
    expect(estimate.currency).toBe('CHF')
    expect(estimate.priced).toBe(true)
    expect(estimate.minCents).toBe(150)
    expect(estimate.maxCents).toBe(450)
  })
})

describe('die Fixtures als Messung', () => {
  it('führt beide Flächen als Hochtarif „Innenstadt und Oerlikon" mit Polygon in Grad', () => {
    expect(ZONES.anzahl).toBe(2)
    for (const zone of ZONES.zonen) {
      expect(zone.tarifzone).toBe('Hochtarifzone')
      expect(zone.zone_bezeichnung).toBe('Innenstadt und Oerlikon')
    }
    for (const geometrie of ZONES.geometrie) {
      expect(geometrie.typ).toBe('Polygon')
      expect(geometrie.stuetzpunkte).toBeGreaterThan(20)
      // [lon, lat] in Grad — vertauscht läge die Fläche in Somalia.
      expect(withinCity(ZUERICH, ...geometrie.ersterPunkt)).toBe(true)
    }
  })

  it('zählt die Parkuhren nach Typ vollständig und legt jede in die Stadt', () => {
    expect(METERS.typen.map((entry) => entry.text).sort()).toEqual(['SPU', 'ZPU'])
    expect(METERS.typen.reduce((sum, entry) => sum + entry.anzahl, 0)).toBe(METERS.anzahl)
    for (const meter of METERS.parkuhren) {
      expect(withinCity(ZUERICH, ...meter.punkt), meter.tarif ?? '?').toBe(true)
      expect(meter.parkierungzonename?.trim() ?? '').not.toBe('')
    }
  })

  it('zählt die Parkfelder nach Art, Gebührenpflicht und Kategorie vollständig', () => {
    expect(SPACES.anzahl).toBe(13272)
    for (const liste of [SPACES.arten, SPACES.gebpflicht, SPACES.kategorien]) {
      expect(liste.reduce((sum, entry) => sum + entry.anzahl, 0)).toBe(SPACES.anzahl)
    }
    expect(SPACES.gebpflicht.map((entry) => entry.text).sort()).toEqual(['0', '1'])
    expect(SPACES.kategorien.map((entry) => entry.text).sort()).toEqual(['OPU', 'SPU', 'ZPU'])
    for (const space of SPACES.parkfelder) expect(withinCity(ZUERICH, ...space.punkt)).toBe(true)
  })

  it('führt 34 Quartiere mit eindeutigem Namen und einem Kreis von 1 bis 12', () => {
    expect(QUARTIERE.anzahl).toBe(34)
    expect(QUARTIERE.quartiere).toHaveLength(34)
    const namen = new Set(QUARTIERE.quartiere.map((quartier) => quartier.qname))
    expect(namen.size).toBe(34)
    for (const quartier of QUARTIERE.quartiere) {
      expect(quartier.kname).toMatch(/^Kreis ([1-9]|1[0-2])$/)
      expect(quartier.knr).toBe(Number(quartier.kname?.slice(6)))
    }
    expect(namen.has('Oerlikon')).toBe(true)
    expect(namen.has('Lindenhof')).toBe(true)
  })
})
