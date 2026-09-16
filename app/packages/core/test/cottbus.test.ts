import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import type { Weekday } from '../src/berlin-time.js'
import { holidaysFor, type Land } from '../src/holidays.js'
import {
  COTTBUS_FEED_2014,
  COTTBUS_ORDINANCE,
  CottbusParseError,
  cottbusScheduleText,
  cottbusTariffFor,
  cottbusZoneKey,
  cottbusZoneNote,
  mergeCottbusWindows,
  parseCottbusDays,
  parseCottbusFee,
  parseCottbusSchedule,
  parseCottbusTariffZone,
  parseCottbusTime,
  type CottbusAutomatProperties,
  type CottbusZoneProperties,
} from '../src/cottbus.js'
import { isChargeable, type ParkingZone } from '../src/tariff.js'

/**
 * Die echten Quellen, abgerufen am 16. September 2026.
 *
 * Wie bei den sieben Städten davor: Fixtures sind der Feed, nicht ausgedachte
 * Beispiele. Cottbus ist klein genug, dass **alle** 44 Automaten und alle
 * fünf Zonen wörtlich darin stehen — der Test „liest jeden Wert des Abzugs"
 * liest damit wirklich jeden.
 */
interface AutomatFixture {
  abgerufenAm: string
  quelle: string
  anzahl: number
  ohneGeometrie: number
  zeiten: { text: string; anzahl: number }[]
  tarifzonen: { text: string; anzahl: number }[]
  gebuehren: { text: string; anzahl: number }[]
  automaten: CottbusAutomatProperties[]
}

interface ZoneFixture {
  abgerufenAm: string
  quelle: string
  anzahl: number
  zonen: CottbusZoneProperties[]
  ersteStuetzpunkte: { name: string; typ: string; punkt: [number, number] }[]
}

const read = <T>(name: string): T =>
  JSON.parse(readFileSync(fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url)), 'utf8')) as T

const AUTOMATS = read<AutomatFixture>('cottbus-parkscheinautomaten-2026-09-16.json')
const ZONES = read<ZoneFixture>('cottbus-bewohnerparkzonen-2026-09-16.json')

const MO_FR: readonly Weekday[] = [1, 2, 3, 4, 5]
const SA: readonly Weekday[] = [6]

describe('parseCottbusDays', () => {
  it('liest die beiden Schreibweisen des Abzugs', () => {
    expect(parseCottbusDays('Mo - Fr')).toEqual(MO_FR)
    expect(parseCottbusDays('Sa')).toEqual(SA)
  })

  it('kommt mit fehlendem und doppeltem Leerraum zurecht', () => {
    expect(parseCottbusDays('Mo-Fr')).toEqual(MO_FR)
    expect(parseCottbusDays('  Mo  -  Sa ')).toEqual([1, 2, 3, 4, 5, 6])
    expect(parseCottbusDays('mo - so')).toEqual([0, 1, 2, 3, 4, 5, 6])
  })

  // Eine Spanne über den Sonntag hinweg ist gültig und kommt sortiert zurück.
  it('sortiert eine Spanne über den Sonntag aufsteigend', () => {
    expect(parseCottbusDays('Sa - Mo')).toEqual([0, 1, 6])
    expect(parseCottbusDays('Fr - Mo')).toEqual([0, 1, 5, 6])
  })

  // Die Wortgrenze auf beiden Seiten: Der ganze Wert muss passen, sonst
  // gilt er nicht. „Mit" enthält „Mi", „frei" enthält „Fr" — beides wirft.
  it('weist alles ab, was mehr als eine Tagesangabe ist', () => {
    for (const raw of ['Mit', 'frei', 'Mo - Fr 08:00', 'Montag', 'Mo -', '- Fr', '', 'Mo - Fr - Sa', 'Xy']) {
      expect(() => parseCottbusDays(raw), raw).toThrow(CottbusParseError)
    }
    expect(() => parseCottbusDays(null)).toThrow(CottbusParseError)
    expect(() => parseCottbusDays(undefined)).toThrow(CottbusParseError)
  })

  it('begrenzt fremde Eingabe, bevor irgendetwas sie anfasst', () => {
    expect(() => parseCottbusDays('Mo'.repeat(30))).toThrow(/Zeichen/)
  })
})

describe('parseCottbusTime', () => {
  it('liest die vier Uhrzeiten des Abzugs als Minuten', () => {
    expect(parseCottbusTime('08:00')).toBe(480)
    expect(parseCottbusTime('19:00')).toBe(1140)
    expect(parseCottbusTime('09:00')).toBe(540)
    expect(parseCottbusTime('15:00')).toBe(900)
  })

  it('liest 24:00 als Mitternacht, also 1440 und nie 0', () => {
    expect(parseCottbusTime('24:00')).toBe(1440)
    expect(parseCottbusTime('0:00')).toBe(0)
  })

  it('weist ab, was keine Uhrzeit der Form HH:MM ist', () => {
    for (const raw of ['8', '08.00', '08:60', '25:00', '24:01', '08:00 Uhr', '', ' ', 'acht']) {
      expect(() => parseCottbusTime(raw), raw).toThrow(CottbusParseError)
    }
    expect(() => parseCottbusTime(null)).toThrow(CottbusParseError)
  })
})

describe('parseCottbusSchedule', () => {
  const FEED = {
    wt: 'Mo - Fr',
    wt_bew_beginn: '08:00',
    wt_bew_ende: '19:00',
    woende: 'Sa',
    woen_bew_beginn: '09:00',
    woen_bew_ende: '15:00',
  }

  it('macht aus den sechs Feldern des Abzugs zwei Fenster', () => {
    expect(parseCottbusSchedule(FEED)).toEqual([
      { weekdays: MO_FR, fromMinute: 480, toMinute: 1140 },
      { weekdays: SA, fromMinute: 540, toMinute: 900 },
    ])
  })

  it('liefert kein Fenster, wenn alle sechs Felder leer sind', () => {
    expect(parseCottbusSchedule({})).toEqual([])
    expect(
      parseCottbusSchedule({ wt: null, wt_bew_beginn: '', woende: ' ' })
    ).toEqual([])
  })

  it('lässt eine Gruppe leer und die andere gefüllt', () => {
    expect(parseCottbusSchedule({ woende: 'Sa', woen_bew_beginn: '09:00', woen_bew_ende: '15:00' })).toEqual([
      { weekdays: SA, fromMinute: 540, toMinute: 900 },
    ])
  })

  // Halb gefüllt ist ein Abbruch: Ein Automat mit Wochentagen und ohne Ende
  // sagt etwas, das niemand lesen kann — „dann eben ohne" wäre geraten.
  it('bricht ab, wenn eine Gruppe nur teilweise gefüllt ist', () => {
    expect(() => parseCottbusSchedule({ wt: 'Mo - Fr', wt_bew_beginn: '08:00' })).toThrow(/teilweise/)
    expect(() => parseCottbusSchedule({ ...FEED, woen_bew_ende: null })).toThrow(CottbusParseError)
  })

  it('legt ein Fenster über Mitternacht auf zwei Tage', () => {
    expect(parseCottbusSchedule({ wt: 'Mo - Fr', wt_bew_beginn: '18:00', wt_bew_ende: '02:00' })).toEqual([
      { weekdays: MO_FR, fromMinute: 1080, toMinute: 1440 },
      { weekdays: [2, 3, 4, 5, 6], fromMinute: 0, toMinute: 120 },
    ])
  })

  it('weist gleiche Anfangs- und Endzeit sowie 24:00 als Beginn ab', () => {
    expect(() => parseCottbusSchedule({ wt: 'Sa', wt_bew_beginn: '09:00', wt_bew_ende: '09:00' })).toThrow(
      /gleich/
    )
    expect(() => parseCottbusSchedule({ wt: 'Sa', wt_bew_beginn: '24:00', wt_bew_ende: '09:00' })).toThrow(
      CottbusParseError
    )
    expect(() => parseCottbusSchedule({ wt: 'Sa', wt_bew_beginn: '09:00', wt_bew_ende: '00:00' })).toThrow(
      /24:00/
    )
  })

  it('schreibt den Rohtext so, wie das Panel ihn nennt', () => {
    expect(cottbusScheduleText(FEED)).toBe('Mo - Fr 08:00-19:00; Sa 09:00-15:00')
    expect(cottbusScheduleText({})).toBe('')
  })

  it('legt doppelte Fenster zusammen', () => {
    const one = parseCottbusSchedule(FEED)
    expect(mergeCottbusWindows([...one, ...one, ...one])).toEqual(one)
  })
})

describe('parseCottbusFee', () => {
  it('liest die beiden Beträge des Abzugs — Zahlen in Euro je Stunde', () => {
    expect(parseCottbusFee(1)).toEqual({ kind: 'exact', centsPerHour: 100 })
    expect(parseCottbusFee(0.5)).toEqual({ kind: 'exact', centsPerHour: 50 })
  })

  // `mind_gebuehr` zeigt, wie die Zahlen gespeichert sind: `0.200000003`.
  it('rundet Fließkomma-Rauschen auf ganze Cent', () => {
    expect(parseCottbusFee(0.200000003)).toEqual({ kind: 'exact', centsPerHour: 20 })
    expect(parseCottbusFee(1.9999999)).toEqual({ kind: 'exact', centsPerHour: 200 })
  })

  it('nimmt eine numerische Zeichenkette, falls der Feldtyp kippt', () => {
    expect(parseCottbusFee('2')).toEqual({ kind: 'exact', centsPerHour: 200 })
    expect(parseCottbusFee('0.5')).toEqual({ kind: 'exact', centsPerHour: 50 })
  })

  it('macht aus fehlend und leer ein "unbekannt" statt einer Null', () => {
    expect(parseCottbusFee(null)).toEqual({ kind: 'unknown' })
    expect(parseCottbusFee(undefined)).toEqual({ kind: 'unknown' })
    expect(parseCottbusFee('')).toEqual({ kind: 'unknown' })
  })

  it('bricht bei einem Betrag von null ab', () => {
    expect(() => parseCottbusFee(0)).toThrow(/0 €/)
    expect(() => parseCottbusFee('0')).toThrow(CottbusParseError)
    expect(() => parseCottbusFee(0.004)).toThrow(CottbusParseError)
  })

  it('weist alles ab, was kein Betrag ist', () => {
    for (const raw of ['1,00', '2 €', 'eins', '-1', 'NaN', 'Infinity', '1e309']) {
      expect(() => parseCottbusFee(raw), raw).toThrow(CottbusParseError)
    }
    expect(() => parseCottbusFee(Number.NaN)).toThrow(CottbusParseError)
    expect(() => parseCottbusFee(Number.POSITIVE_INFINITY)).toThrow(CottbusParseError)
    expect(() => parseCottbusFee(-1)).toThrow(CottbusParseError)
    expect(() => parseCottbusFee(101)).toThrow(/100 €/)
  })

  it('begrenzt fremde Eingabe, bevor irgendetwas sie anfasst', () => {
    expect(() => parseCottbusFee('1'.repeat(50))).toThrow(/Zeichen/)
  })
})

describe('parseCottbusTariffZone', () => {
  it('liest die zwei Tarifzonen des Abzugs', () => {
    expect(parseCottbusTariffZone('Zone 1')).toBe(1)
    expect(parseCottbusTariffZone('Zone 2')).toBe(2)
    expect(parseCottbusTariffZone(' zone  2 ')).toBe(2)
  })

  it('weist eine dritte Zone und alles andere ab', () => {
    for (const raw of ['Zone 3', 'Zone', '1', 'Zone 1a', '', 'Parkzone II']) {
      expect(() => parseCottbusTariffZone(raw), raw).toThrow(CottbusParseError)
    }
    expect(() => parseCottbusTariffZone(null)).toThrow(CottbusParseError)
  })
})

describe('die Parkgebührenordnung vom 1. Juni 2025', () => {
  it('nennt für beide Zonen Betrag, Mindestgebühr und Zeiten', () => {
    expect(COTTBUS_ORDINANCE.zones[1]).toEqual({ centsPerHour: 200, minimumCents: 50 })
    expect(COTTBUS_ORDINANCE.zones[2]).toEqual({ centsPerHour: 100, minimumCents: 20 })
    expect(COTTBUS_ORDINANCE.windows).toEqual([
      { weekdays: MO_FR, fromMinute: 480, toMinute: 1200 },
      { weekdays: SA, fromMinute: 540, toMinute: 900 },
    ])
    expect(COTTBUS_ORDINANCE.validFrom).toBe('2025-06-01')
    expect(COTTBUS_ORDINANCE.url).toMatch(/^https:\/\/cottbus\.de\//)
  })

  // Der Unterschied, um den es geht: Der Feed endet eine Stunde früher und
  // nennt den halben Betrag.
  it('unterscheidet sich vom Stand des Feeds um eine Stunde und den halben Betrag', () => {
    expect(COTTBUS_FEED_2014.windows[0]?.toMinute).toBe(1140)
    expect(COTTBUS_ORDINANCE.windows[0]?.toMinute).toBe(1200)
    expect(COTTBUS_FEED_2014.centsPerHour[1] * 2).toBe(COTTBUS_ORDINANCE.zones[1].centsPerHour)
    expect(COTTBUS_FEED_2014.centsPerHour[2] * 2).toBe(COTTBUS_ORDINANCE.zones[2].centsPerHour)
  })
})

describe('cottbusTariffFor', () => {
  const feedWindows = parseCottbusSchedule({
    wt: 'Mo - Fr',
    wt_bew_beginn: '08:00',
    wt_bew_ende: '19:00',
    woende: 'Sa',
    woen_bew_beginn: '09:00',
    woen_bew_ende: '15:00',
  })
  const feedText = 'Mo - Fr 08:00-19:00; Sa 09:00-15:00'

  it('liefert für den Stand von 2014 die Ordnung von 2025 aus und sagt es', () => {
    const tariff = cottbusTariffFor(1, { kind: 'exact', centsPerHour: 100 }, feedWindows, feedText)
    expect(tariff.fee).toEqual({ kind: 'exact', centsPerHour: 200 })
    expect(tariff.windows).toEqual(COTTBUS_ORDINANCE.windows)
    expect(tariff.sourceDefect).toMatch(/2014/)
    expect(tariff.sourceDefect).toMatch(/1,00 €/)
    expect(tariff.sourceDefect).toMatch(/19:00/)
    expect(tariff.sourceDefect).toMatch(/2,00 €/)
    expect(tariff.rawHours).toContain('08:00–20:00')
    expect(tariff.rawHours).toContain(feedText)
    expect(tariff.rawFee).toContain('2,00 €')
  })

  it('tut dasselbe für Zone 2 mit den halben Beträgen', () => {
    const tariff = cottbusTariffFor(2, { kind: 'exact', centsPerHour: 50 }, feedWindows, feedText)
    expect(tariff.fee).toEqual({ kind: 'exact', centsPerHour: 100 })
    expect(tariff.sourceDefect).toMatch(/0,50 €/)
    expect(tariff.unmodelledRules).toEqual([])
  })

  // § 3 Abs. 2: Großveranstaltungen, nur Zone 1, ohne Kalender — wie Berlins
  // Adventssamstage eine Regel, die das Modell nicht ausdrückt.
  it('hängt die Großveranstaltungsregel nur an Zone 1', () => {
    const one = cottbusTariffFor(1, { kind: 'exact', centsPerHour: 100 }, feedWindows, feedText)
    expect(one.unmodelledRules).toEqual([COTTBUS_ORDINANCE.eventRule])
    expect(one.unmodelledRules[0]).toMatch(/Weihnachtsmarkt/)
  })

  it('nimmt den Feed ohne Vermerk, sobald er die Ordnung von 2025 nennt', () => {
    const tariff = cottbusTariffFor(
      1,
      { kind: 'exact', centsPerHour: 200 },
      [...COTTBUS_ORDINANCE.windows],
      'Mo - Fr 08:00-20:00; Sa 09:00-15:00'
    )
    expect(tariff.sourceDefect).toBeNull()
    expect(tariff.fee).toEqual({ kind: 'exact', centsPerHour: 200 })
    expect(tariff.rawHours).toBe('Mo - Fr 08:00-20:00; Sa 09:00-15:00')
  })

  // Der dritte Ausgang: Ein Feed, der von beiden Ständen abweicht, hat sich
  // geändert — ob dritte Ordnung oder Tippfehler, weiß nur ein Mensch.
  it('wirft, wenn der Feed weder 2014 noch 2025 nennt', () => {
    expect(() =>
      cottbusTariffFor(1, { kind: 'exact', centsPerHour: 150 }, feedWindows, feedText)
    ).toThrow(CottbusParseError)
    expect(() =>
      cottbusTariffFor(1, { kind: 'exact', centsPerHour: 100 }, [...COTTBUS_ORDINANCE.windows], feedText)
    ).toThrow(/weder/)
    expect(() => cottbusTariffFor(2, { kind: 'unknown' }, feedWindows, feedText)).toThrow(/kein Betrag/)
    expect(() =>
      cottbusTariffFor(1, { kind: 'exact', centsPerHour: 200 }, feedWindows, feedText)
    ).toThrow(CottbusParseError)
  })

  it('vergleicht Fenster unabhängig von ihrer Reihenfolge', () => {
    const reversed = [...feedWindows].reverse()
    expect(cottbusTariffFor(1, { kind: 'exact', centsPerHour: 100 }, reversed, feedText).sourceDefect).not.toBeNull()
  })
})

describe('cottbusZoneKey', () => {
  it('liest die römische Zahl aus dem Namen', () => {
    expect(cottbusZoneKey({ name: 'Parkzone II' })).toBe('II')
    expect(cottbusZoneKey({ name: 'Parkzone VI' })).toBe('VI')
    expect(cottbusZoneKey({ name: '  parkzone   iv ' })).toBe('IV')
  })

  it('wirft bei allem, was nicht dieser Form folgt', () => {
    for (const name of ['Parkzone 2', 'Zone II', 'Parkzone', '', 'Parkzone IIX'.repeat(5)]) {
      expect(() => cottbusZoneKey({ name }), name).toThrow(CottbusParseError)
    }
    expect(() => cottbusZoneKey({})).toThrow(CottbusParseError)
    expect(() => cottbusZoneKey({ name: null })).toThrow(CottbusParseError)
  })

  it('nennt im Hinweis Kürzel und Tarifzone', () => {
    expect(cottbusZoneNote({ bem: 'Z2' }, 1)).toBe(
      'Bewohnerparkzone Z2 — Tarifzone 1 (Innenstadt) der Parkgebührenordnung'
    )
    expect(cottbusZoneNote({}, 2)).toBe(
      'Bewohnerparkzone — Tarifzone 2 (außerhalb der Innenstadt) der Parkgebührenordnung'
    )
  })
})

describe('der echte Abzug vom 16. September 2026', () => {
  it('trägt die 44 Automaten und die 5 Zonen, die der Dienst gemeldet hat', () => {
    expect(AUTOMATS.anzahl).toBe(44)
    expect(AUTOMATS.automaten).toHaveLength(44)
    expect(AUTOMATS.ohneGeometrie).toBe(1)
    expect(ZONES.anzahl).toBe(5)
    expect(ZONES.zonen).toHaveLength(5)
  })

  it('liest jeden Automaten ohne Ausnahme', () => {
    const failures: string[] = []
    for (const automat of AUTOMATS.automaten) {
      try {
        expect(parseCottbusSchedule(automat)).toHaveLength(2)
        parseCottbusFee(automat.gebuehr)
        parseCottbusTariffZone(automat.zone)
      } catch (error) {
        failures.push(`${automat.standort ?? '?'}: ${(error as Error).message}`)
      }
    }
    expect(failures).toEqual([])
  })

  it('nagelt die Schreibweisen fest, damit eine Feed-Änderung die CI rot macht', () => {
    expect(AUTOMATS.zeiten).toEqual([{ text: 'Mo - Fr 08:00-19:00; Sa 09:00-15:00', anzahl: 44 }])
    expect(AUTOMATS.tarifzonen).toEqual([
      { text: 'Zone 1', anzahl: 40 },
      { text: 'Zone 2', anzahl: 4 },
    ])
    expect(AUTOMATS.gebuehren).toEqual([
      { text: 'Zone 1: 1', anzahl: 40 },
      { text: 'Zone 2: 0.5', anzahl: 4 },
    ])
    const summe = AUTOMATS.zeiten.reduce((sum, entry) => sum + entry.anzahl, 0)
    expect(summe).toBe(AUTOMATS.anzahl)
  })

  // Der Befund, der alles bestimmt: Jeder Automat nennt exakt den Stand von
  // 2014 — Betrag und Wochentagsende. Wechselt einer davon, fällt es hier auf,
  // und `cottbusTariffFor` würde im Datenbau werfen oder den Vermerk lassen.
  it('nennt an jedem Automaten den Stand der Ordnung von 2014', () => {
    for (const automat of AUTOMATS.automaten) {
      const zone = parseCottbusTariffZone(automat.zone)
      const fee = parseCottbusFee(automat.gebuehr)
      expect(fee, automat.standort ?? '').toEqual({
        kind: 'exact',
        centsPerHour: COTTBUS_FEED_2014.centsPerHour[zone],
      })
      expect(parseCottbusSchedule(automat), automat.standort ?? '').toEqual(COTTBUS_FEED_2014.windows)
      const tariff = cottbusTariffFor(zone, fee, parseCottbusSchedule(automat), cottbusScheduleText(automat))
      expect(tariff.sourceDefect).not.toBeNull()
    }
  })

  it('kennt jede Zone unter einem eigenen Schlüssel', () => {
    const keys = ZONES.zonen.map((zone) => cottbusZoneKey(zone))
    expect(keys.sort()).toEqual(['II', 'III', 'IV', 'V', 'VI'])
    for (const zone of ZONES.zonen) expect(zone.bem).toBe(`Z${['I', 'II', 'III', 'IV', 'V', 'VI'].indexOf(cottbusZoneKey(zone)) + 1}`)
  })

  // Die Voraussetzung für `assertDegrees` im Datenbau: Mit `outSR=4326`
  // kommen Grade, `[lon, lat]`, innerhalb der Cottbuser Meldebox.
  it('liefert die Geometrie in Grad und in GeoJSON-Reihenfolge', () => {
    for (const { punkt, name } of ZONES.ersteStuetzpunkte) {
      const [lon, lat] = punkt
      expect(lon, name).toBeGreaterThan(14.27)
      expect(lon, name).toBeLessThan(14.51)
      expect(lat, name).toBeGreaterThan(51.69)
      expect(lat, name).toBeLessThan(51.87)
    }
  })

  it('führt die Bahnhofsautomaten in Zone 2 — dort gilt der halbe Satz', () => {
    const bahnhof = AUTOMATS.automaten.filter((automat) => automat.standort === 'Bahnhof')
    expect(bahnhof).toHaveLength(2)
    for (const automat of bahnhof) expect(parseCottbusTariffZone(automat.zone)).toBe(2)
  })
})

/**
 * Die Ordnung im Modell: Was die App an einem Cottbuser Werktag sagt.
 *
 * Gerechnet mit der Zone, wie der Datenbau sie ausliefert — Land `BB`, damit
 * der Reformationstag zählt.
 */
describe('eine Cottbuser Zone im Modell', () => {
  const feedWindows = parseCottbusSchedule({
    wt: 'Mo - Fr',
    wt_bew_beginn: '08:00',
    wt_bew_ende: '19:00',
    woende: 'Sa',
    woen_bew_beginn: '09:00',
    woen_bew_ende: '15:00',
  })
  const tariff = cottbusTariffFor(1, { kind: 'exact', centsPerHour: 100 }, feedWindows, '')
  const zone: ParkingZone = {
    id: 'II',
    name: 'II',
    land: 'BB' as Land,
    fee: tariff.fee,
    windows: tariff.windows,
    unmodelledRules: tariff.unmodelledRules,
  }

  it('kassiert am Mittwoch um 19:30 — die Stunde, die der Feed verschweigt', () => {
    // Mittwoch, 16. September 2026, 19:30 Berliner Zeit (17:30 UTC).
    expect(isChargeable(zone, Date.UTC(2026, 8, 16, 17, 30))).toBe(true)
    expect(isChargeable(zone, Date.UTC(2026, 8, 16, 18, 0))).toBe(false)
  })

  it('kassiert samstags 9 bis 15 Uhr und sonntags nie', () => {
    expect(isChargeable(zone, Date.UTC(2026, 8, 19, 8, 0))).toBe(true) // Sa 10:00
    expect(isChargeable(zone, Date.UTC(2026, 8, 19, 13, 30))).toBe(false) // Sa 15:30
    expect(isChargeable(zone, Date.UTC(2026, 8, 20, 9, 0))).toBe(false) // So 11:00
  })

  it('kassiert am Reformationstag nicht — in Brandenburg ein Feiertag', () => {
    // Samstag, 31. Oktober 2026, 11:00 Berliner Zeit (10:00 UTC).
    expect(holidaysFor('BB', 2026).has('2026-10-31')).toBe(true)
    expect(isChargeable(zone, Date.UTC(2026, 9, 31, 10, 0))).toBe(false)
    // Derselbe Samstag in Berlin wäre ein Kassiertag.
    expect(isChargeable({ ...zone, land: 'BE' }, Date.UTC(2026, 9, 31, 10, 0))).toBe(true)
  })
})
