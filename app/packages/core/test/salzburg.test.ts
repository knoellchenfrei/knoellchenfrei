import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import type { Weekday } from './../src/berlin-time.js'
import { SALZBURG, cityAt, cityCountry, withinCity } from '../src/city.js'
import type { BoundingBox } from '../src/geo.js'
import { holidaysFor } from '../src/holidays.js'
import {
  SALZBURG_RAW_FEE,
  SALZBURG_TARIFF,
  SalzburgParseError,
  isActiveSalzburgZone,
  parseSalzburgMaxStay,
  parseSalzburgRule,
  salzburgArtMatchesRule,
  salzburgDistrictName,
  salzburgFee,
  salzburgUnmodelledRules,
  salzburgZoneLabel,
  salzburgZoneNote,
  type SalzburgDistrictProperties,
  type SalzburgRule,
  type SalzburgZoneProperties,
} from '../src/salzburg.js'
import { chargeableAt, estimateCost, isChargeable, type ParkingZone } from '../src/tariff.js'

/**
 * Salzburg — gegen den echten Abzug vom 16. September 2026.
 *
 * Wie bei den sieben Städten davor: Die Fixture ist der Feed, nicht ein
 * ausgedachtes Beispiel. Jede Behauptung über den Feed steht hier als Prüfung
 * gegen die Fixture, weil ein Interface über einer JSON-Datei eine Behauptung
 * ist und kein Beweis (Frankfurts `bewohnerparkzone`, das als `string | null`
 * deklariert war und im Feed eine Zahl ist).
 */
interface Fixture {
  abgerufenAm: string
  quelle: string
  numberMatched: number
  ersterStuetzpunkt: [number, number]
  ersterStuetzpunktGml4326: [number, number]
  ersterStuetzpunktOhneSrsName: [number, number]
  gebuehrenpflicht: { text: string; anzahl: number }[]
  art: { text: string; anzahl: number }[]
  maximaleParkdauer: { text: string; anzahl: number }[]
  zonen: (SalzburgZoneProperties & { gmlId: string })[]
  stadtteile: {
    numberMatched: number
    gemeinden: Record<string, number>
    namenSalzburg: Record<string, number>
    beispiel: SalzburgDistrictProperties
  }
}

const FIXTURE = JSON.parse(
  readFileSync(fileURLToPath(new URL('./fixtures/sbg-kurzparkzonen-2026-09-16.json', import.meta.url)), 'utf8')
) as Fixture

const MO_FR: readonly Weekday[] = [1, 2, 3, 4, 5]
const SA: readonly Weekday[] = [6]

/** Der Rahmen, den `City.reportBounds` für Salzburg trägt. */
const SALZBURG_BOUNDS: BoundingBox = { minLon: 12.98, minLat: 47.75, maxLon: 13.13, maxLat: 47.86 }

const FREI_MO_FR = 'gebührenfrei (aber Parkuhrenpflicht) werktags Montag bis Freitag 9-19 Uhr'
const PFLICHT_MO_FR_SA =
  'gebührenpflichtig (Gebühreneinhebung mit Parkscheinautomat) werktags Montag bis Freitag 9-19 Uhr; gebührenfrei (aber Parkuhrenpflicht) Samstag 9-16 Uhr'
const FREI_MO_SA = 'gebührenfrei (aber Parkuhrenpflicht) werktags Montag bis Freitag 9-19 Uhr und Samstag 9-16 Uhr'
const FREI_MIT_NACHSATZ =
  'gebührenfrei (aber Parkuhrenpflicht) werktags Montag bis Freitag 9-19 Uhr - gilt nicht zum Dauerparken mit Ausnahmebewilligung'

describe('parseSalzburgRule', () => {
  it('liest die häufigste Zeile: Scheibe Montag bis Freitag', () => {
    expect(parseSalzburgRule(FREI_MO_FR)).toEqual({
      kind: 'disc',
      windows: [{ weekdays: MO_FR, fromMinute: 540, toMinute: 1140 }],
      discWindows: [],
      notes: [],
    })
  })

  // Der teuerste mögliche Fehler in dieser Datei: das Samstagsfenster einer
  // kassierenden Zone als Gebührenfenster zu lesen. Dann stünde samstags
  // „2,20 €" über einer Zone, die gratis ist.
  it('legt den Samstag einer kassierenden Zone in discWindows, nicht in windows', () => {
    const rule = parseSalzburgRule(PFLICHT_MO_FR_SA)
    expect(rule.kind).toBe('paid')
    expect(rule.windows).toEqual([{ weekdays: MO_FR, fromMinute: 540, toMinute: 1140 }])
    expect(rule.discWindows).toEqual([{ weekdays: SA, fromMinute: 540, toMinute: 960 }])
    expect(rule.notes).toEqual([])
  })

  it('liest „und Samstag" einer Scheibenzone als zweites Scheibenfenster', () => {
    expect(parseSalzburgRule(FREI_MO_SA)).toEqual({
      kind: 'disc',
      windows: [
        { weekdays: MO_FR, fromMinute: 540, toMinute: 1140 },
        { weekdays: SA, fromMinute: 540, toMinute: 960 },
      ],
      discWindows: [],
      notes: [],
    })
  })

  it('hebt den Nachsatz nach dem Gedankenstrich heraus, statt an ihm zu scheitern', () => {
    const rule = parseSalzburgRule(FREI_MIT_NACHSATZ)
    expect(rule.kind).toBe('disc')
    expect(rule.windows).toHaveLength(1)
    expect(rule.notes).toEqual(['gilt nicht zum Dauerparken mit Ausnahmebewilligung'])
  })

  it('unterscheidet den Gedankenstrich des Nachsatzes vom Bindestrich der Spanne', () => {
    // `9-19` ohne Leerzeichen ist die Spanne; ` - ` mit Leerzeichen der Nachsatz.
    expect(() => parseSalzburgRule('gebührenfrei (aber Parkuhrenpflicht) Samstag 9 - 16 Uhr')).toThrow(
      SalzburgParseError
    )
  })

  it('normalisiert Leerraum, statt an ihm zu scheitern', () => {
    expect(parseSalzburgRule(`  ${FREI_MO_FR.replace(/ /g, '  ')}\n`)).toEqual(parseSalzburgRule(FREI_MO_FR))
  })

  it('liest Minutenangaben und die Endstunde 24 als Minute 1440', () => {
    const rule = parseSalzburgRule('gebührenfrei (aber Parkuhrenpflicht) Samstag 9:30-24 Uhr')
    expect(rule.windows).toEqual([{ weekdays: SA, fromMinute: 570, toMinute: 1440 }])
  })

  it('liest alle vier Schreibweisen des Abzugs — und es sind genau vier', () => {
    expect(FIXTURE.gebuehrenpflicht).toHaveLength(4)
    expect(FIXTURE.gebuehrenpflicht.reduce((n, entry) => n + entry.anzahl, 0)).toBe(41)
    for (const { text } of FIXTURE.gebuehrenpflicht) {
      expect(() => parseSalzburgRule(text), text).not.toThrow()
    }
    const paid = FIXTURE.gebuehrenpflicht.filter(({ text }) => parseSalzburgRule(text).kind === 'paid')
    expect(paid.map((entry) => entry.anzahl)).toEqual([11])
  })

  it('kennt im Abzug kein Fenster über Mitternacht und keines am Sonntag', () => {
    for (const { text } of FIXTURE.gebuehrenpflicht) {
      const rule = parseSalzburgRule(text)
      for (const window of [...rule.windows, ...rule.discWindows]) {
        expect(window.fromMinute).toBeLessThan(window.toMinute)
        expect(window.weekdays).not.toContain(0)
      }
    }
  })
})

describe('parseSalzburgRule — was abbrechen muss', () => {
  it('weist eine leere Angabe ab, statt sie als „keine Zeiten" durchzulassen', () => {
    for (const raw of ['', '   ', ';', 'gebührenfrei (aber Parkuhrenpflicht) werktags Montag bis Freitag 9-19 Uhr;']) {
      expect(() => parseSalzburgRule(raw), JSON.stringify(raw)).toThrow(SalzburgParseError)
    }
  })

  it('weist eine Klausel ohne Art ab — Hamburgs Zeile ist hier keine', () => {
    expect(() => parseSalzburgRule('werktags 9-20 Uhr')).toThrow(/weder mit gebührenpflichtig/)
    expect(() => parseSalzburgRule('Mo-Sa 9-20 Uhr')).toThrow(SalzburgParseError)
  })

  it('weist eine Art ohne Zeiten ab', () => {
    expect(() => parseSalzburgRule('gebührenfrei (aber Parkuhrenpflicht)')).toThrow(SalzburgParseError)
    expect(() => parseSalzburgRule('gebührenfrei (aber Parkuhrenpflicht) Samstag')).toThrow(/Tag-und-Stunden/)
  })

  it('weist unbekannte Tagesangaben ab, statt sie zu raten', () => {
    for (const tage of ['werktags', 'täglich', 'Sonntag', 'Montag bis Samstag', 'werktags Montag bis Samstag']) {
      expect(() => parseSalzburgRule(`gebührenfrei (aber Parkuhrenpflicht) ${tage} 9-19 Uhr`), tage).toThrow(
        SalzburgParseError
      )
    }
  })

  it('weist eine Spanne ab, die nicht nach ihrem Anfang endet oder den Tag verlässt', () => {
    for (const spanne of ['19-9', '9-9', '9-25', '24-24', '9:60-19']) {
      expect(() => parseSalzburgRule(`gebührenfrei (aber Parkuhrenpflicht) Samstag ${spanne} Uhr`), spanne).toThrow(
        SalzburgParseError
      )
    }
  })

  it('weist ein fehlendes „Uhr" und einen Rest hinter der Spanne ab', () => {
    expect(() => parseSalzburgRule('gebührenfrei (aber Parkuhrenpflicht) Samstag 9-16')).toThrow(SalzburgParseError)
    expect(() => parseSalzburgRule('gebührenfrei (aber Parkuhrenpflicht) Samstag 9-16 Uhr extra')).toThrow(
      SalzburgParseError
    )
  })

  // Der Test-Audit fand `>` gegen `>=` in sechs von sieben Parsern unentdeckt:
  // Alle prüften 500 Zeichen, keiner die Grenze selbst.
  it('nimmt genau 200 Zeichen und weist 201 ab', () => {
    const gerade = FREI_MO_FR.padEnd(200, ' ')
    expect(gerade).toHaveLength(200)
    expect(() => parseSalzburgRule(gerade)).not.toThrow()
    expect(() => parseSalzburgRule(`${gerade} `)).toThrow(/Zeichen/)
  })
})

describe('der Tarif aus der Verordnung', () => {
  it('beträgt 1,10 € je halbe Stunde, also 2,20 € je Stunde, seit dem 1. Jänner 2026', () => {
    expect(SALZBURG_TARIFF.centsPerHalfHour * 2).toBe(SALZBURG_TARIFF.centsPerHour)
    expect(SALZBURG_TARIFF.centsPerHour).toBe(220)
    expect(SALZBURG_TARIFF.inKraftSeit).toBe('2026-01-01')
    expect(SALZBURG_TARIFF.basis).toMatch(/Parkgebührenverordnung 1990/)
    expect(SALZBURG_TARIFF.basis).toMatch(/§ 2 Abs\. 1/)
  })

  it('gibt einer kassierenden Zone den Stadttarif und einer Scheibenzone keinen Preis', () => {
    expect(salzburgFee({ kind: 'paid' })).toEqual({ kind: 'exact', centsPerHour: 220 })
    expect(salzburgFee({ kind: 'disc' })).toEqual({ kind: 'disc' })
  })

  it('sagt in rawFee, dass der Betrag nicht aus dem Datensatz stammt', () => {
    expect(SALZBURG_RAW_FEE).toMatch(/laut Verordnung/)
    expect(SALZBURG_RAW_FEE).toMatch(/1,10 €/)
  })

  it('beziffert nie eine Null — auch die Scheibe ist kein Preis von null', () => {
    const fee = salzburgFee({ kind: 'disc' })
    expect(fee.kind).toBe('disc')
    expect('centsPerHour' in fee).toBe(false)
  })
})

describe('salzburgUnmodelledRules', () => {
  it('schreibt das Samstagsfenster als Satz mit Scheibe und Höchstdauer', () => {
    const rule = parseSalzburgRule(PFLICHT_MO_FR_SA)
    expect(salzburgUnmodelledRules(rule, 180)).toEqual([
      'Sa 9–16 Uhr gebührenfrei, aber mit Parkscheibe, höchstens 3 Std.',
    ])
  })

  it('lässt die Dauer weg, wenn die Quelle keine nennt, und schreibt Minuten, wo es keine vollen Stunden sind', () => {
    const rule = parseSalzburgRule(PFLICHT_MO_FR_SA)
    expect(salzburgUnmodelledRules(rule, undefined)).toEqual(['Sa 9–16 Uhr gebührenfrei, aber mit Parkscheibe'])
    expect(salzburgUnmodelledRules(rule, 90)).toEqual([
      'Sa 9–16 Uhr gebührenfrei, aber mit Parkscheibe, höchstens 90 Min.',
    ])
  })

  it('reicht den Nachsatz der Quelle wörtlich durch', () => {
    const rule = parseSalzburgRule(FREI_MIT_NACHSATZ)
    expect(salzburgUnmodelledRules(rule, 180)).toEqual(['gilt nicht zum Dauerparken mit Ausnahmebewilligung'])
  })

  it('ergibt für eine reine Scheibenzone nichts — ihre Fenster sind die Zonenfenster', () => {
    expect(salzburgUnmodelledRules(parseSalzburgRule(FREI_MO_SA), 180)).toEqual([])
  })

  it('schreibt eine Tagesspanne mit Bis-Strich und halbe Stunden mit Minuten', () => {
    const rule: SalzburgRule = {
      kind: 'paid',
      windows: [],
      discWindows: [{ weekdays: MO_FR, fromMinute: 570, toMinute: 1440 }],
      notes: [],
    }
    expect(salzburgUnmodelledRules(rule, undefined)).toEqual(['Mo–Fr 9:30–24 Uhr gebührenfrei, aber mit Parkscheibe'])
  })
})

describe('parseSalzburgMaxStay', () => {
  it('liest „3 Stunden" als 180 Minuten — den einzigen Wert des Abzugs', () => {
    expect(parseSalzburgMaxStay('3 Stunden')).toBe(180)
    expect(FIXTURE.maximaleParkdauer).toEqual([{ text: '3 Stunden', anzahl: 41 }])
  })

  it('liest Einzahl und Minuten', () => {
    expect(parseSalzburgMaxStay('1 Stunde')).toBe(60)
    expect(parseSalzburgMaxStay('90 Minuten')).toBe(90)
    expect(parseSalzburgMaxStay(' 2  Stunden ')).toBe(120)
  })

  it('macht aus fehlend und leer ein „keine Angabe"', () => {
    for (const raw of [null, undefined, '', '   ']) {
      expect(parseSalzburgMaxStay(raw)).toBeUndefined()
    }
  })

  it('weist die Null ab — sie hieße Parken verboten, und das steht dort nicht', () => {
    expect(() => parseSalzburgMaxStay('0 Stunden')).toThrow(/null/)
    expect(() => parseSalzburgMaxStay('0 Minuten')).toThrow(SalzburgParseError)
  })

  it('weist Unfug, Hamburgs nackte Minutenzahl und mehr als einen Tag ab', () => {
    for (const raw of ['180', '3h', 'drei Stunden', '3 Std.', '25 Stunden', '1500 Minuten', 'unbegrenzt']) {
      expect(() => parseSalzburgMaxStay(raw), raw).toThrow(SalzburgParseError)
    }
  })

  it('begrenzt seine Eingabe', () => {
    expect(() => parseSalzburgMaxStay('3 Stunden'.padEnd(201, ' '))).toThrow(/Zeichen/)
  })
})

describe('isActiveSalzburgZone', () => {
  const now = Date.parse('2026-09-16T12:00:00Z')
  const aktiv: SalzburgZoneProperties = { STATUS: 'aktiv', GILT_VON: '2023-07-02T22:00:00Z', GILT_BIS: '2049-12-30T23:00:00Z' }

  it('nimmt eine aktive Zone mit laufendem Zeitraum', () => {
    expect(isActiveSalzburgZone(aktiv, now)).toBe(true)
  })

  it('weist eine Zone ab, deren Geltung noch nicht begonnen hat oder schon vorbei ist', () => {
    expect(isActiveSalzburgZone({ ...aktiv, GILT_VON: '2027-01-01T00:00:00Z' }, now)).toBe(false)
    expect(isActiveSalzburgZone({ ...aktiv, GILT_BIS: '2026-01-01T00:00:00Z' }, now)).toBe(false)
  })

  it('weist jeden anderen Status ab, auch einen fehlenden', () => {
    expect(isActiveSalzburgZone({ ...aktiv, STATUS: 'geplant' }, now)).toBe(false)
    expect(isActiveSalzburgZone({ ...aktiv, STATUS: null }, now)).toBe(false)
    expect(isActiveSalzburgZone({ ...aktiv, STATUS: 'AKTIV ' }, now)).toBe(true)
  })

  it('zählt ein unlesbares Datum als „gilt nicht" statt als „gilt immer"', () => {
    expect(isActiveSalzburgZone({ ...aktiv, GILT_VON: 'gestern' }, now)).toBe(false)
    expect(isActiveSalzburgZone({ ...aktiv, GILT_BIS: null }, now)).toBe(false)
  })

  it('findet im Abzug alle 41 Zonen aktiv', () => {
    expect(FIXTURE.zonen.filter((zone) => isActiveSalzburgZone(zone, now))).toHaveLength(41)
  })
})

describe('salzburgArtMatchesRule', () => {
  it('hält ART und Zeitangabe für jede der 41 Zonen zusammen', () => {
    for (const zone of FIXTURE.zonen) {
      expect(salzburgArtMatchesRule(zone.ART, parseSalzburgRule(zone.GEBUEHRENPFLICHT as string)), String(zone.ID)).toBe(
        true
      )
    }
  })

  it('meldet den Widerspruch, wenn ART das Gegenteil sagt — und den Tippfehler vom Vormittag', () => {
    expect(salzburgArtMatchesRule('Gebührenfreie Kurzparkzone', { kind: 'paid' })).toBe(false)
    expect(salzburgArtMatchesRule('Gebührenpflichtige Kurzparkzone', { kind: 'disc' })).toBe(false)
    // So stand es am Vormittag des 16. September im Feed; am Nachmittag war
    // es behoben. Der Vergleich auf „gebührenpflichtig" fände es nicht.
    expect(salzburgArtMatchesRule('Gebährenpflichtige Kurzparkzone', { kind: 'paid' })).toBe(false)
    expect(salzburgArtMatchesRule(null, { kind: 'disc' })).toBe(false)
  })
})

describe('Name und Notiz', () => {
  it('gibt den Namen so wieder, wie ihn die Quelle führt', () => {
    expect(salzburgZoneLabel({ NAME: 'NONNTAL-OST' })).toBe('NONNTAL-OST')
    expect(salzburgZoneLabel({ NAME: '  Kurzparkzone   (Bewohnerparkzone E) ' })).toBe('Kurzparkzone (Bewohnerparkzone E)')
    expect(salzburgZoneLabel({ NAME: null })).toBe('?')
    expect(salzburgZoneLabel({})).toBe('?')
  })

  it('nennt die Bewohnerparkzone nur, wenn der Name sie nicht schon nennt', () => {
    expect(salzburgZoneNote({ NAME: 'PARSCH WEST', GRUPPE: 'C' })).toBe('in Bewohnerparkzone C')
    expect(salzburgZoneNote({ NAME: 'Kurzparkzone (Bewohnerparkzone E)', GRUPPE: 'E' })).toBeNull()
  })

  it('nennt den Ausschluss der Bewohner und die Straßenart', () => {
    expect(salzburgZoneNote({ NAME: 'X', GRUPPE: 'G', KEIN_BEWOHNERPARKEN: 'Ja', UNTERGRUPPE: 'Landesstraße' })).toBe(
      'in Bewohnerparkzone G · kein Bewohnerparken · Landesstraße'
    )
    expect(salzburgZoneNote({ NAME: 'X', KEIN_BEWOHNERPARKEN: 'Nein' })).toBeNull()
  })

  it('findet im Abzug 24 Namen für 41 Zonen und genau eine ohne Bewohnerparken', () => {
    expect(new Set(FIXTURE.zonen.map((zone) => zone.NAME)).size).toBe(24)
    expect(FIXTURE.zonen.filter((zone) => zone.KEIN_BEWOHNERPARKEN === 'Ja').map((zone) => zone.ID)).toEqual([605])
    // Die Kennung ist deshalb der Schlüssel, nicht der Name.
    expect(new Set(FIXTURE.zonen.map((zone) => zone.ID)).size).toBe(41)
  })
})

describe('salzburgDistrictName', () => {
  it('nimmt den Stadtteil und fällt auf den Landschaftsraum zurück', () => {
    expect(salzburgDistrictName(FIXTURE.stadtteile.beispiel)).toBe('Riedenburg')
    expect(salzburgDistrictName({ GEMEINDE: 'Salzburg', STADTTEIL: null, LANDSCHAFTSRAUM: 'Gaisberg' })).toBe('Gaisberg')
    expect(salzburgDistrictName({ GEMEINDE: 'Salzburg', STADTTEIL: null, LANDSCHAFTSRAUM: null })).toBeNull()
  })

  it('lässt die Nachbargemeinden aus — Freilassing ist kein Salzburger Stadtteil', () => {
    expect(salzburgDistrictName({ GEMEINDE: 'Freilassing', STADTTEIL: 'Zentrum' })).toBeNull()
    expect(salzburgDistrictName({ GEMEINDE: null, STADTTEIL: 'Altstadt' })).toBeNull()
  })

  it('zählt im Abzug 132 Salzburger Stücke, 13 fremde und 28 Namen', () => {
    const { gemeinden, namenSalzburg, numberMatched } = FIXTURE.stadtteile
    expect(gemeinden['Salzburg']).toBe(132)
    expect(Object.values(gemeinden).reduce((n, count) => n + count, 0)).toBe(numberMatched)
    expect(numberMatched).toBe(145)
    expect(Object.keys(namenSalzburg)).toHaveLength(28)
    expect(Object.values(namenSalzburg).reduce((n, count) => n + count, 0)).toBe(132)
    expect(namenSalzburg['Altstadt']).toBe(10)
  })
})

describe('die Form des Salzburger Feeds', () => {
  /** `null` ist eine eigene Antwort, kein `object` — deshalb nicht `typeof`. */
  const labelOf = (value: unknown): string => (value === null ? 'null' : typeof value)

  it('führt genau diese vierzehn Felder in genau diesen Typen', () => {
    const observed = new Map<string, Set<string>>()
    for (const zone of FIXTURE.zonen) {
      for (const [field, value] of Object.entries(zone)) {
        const seen = observed.get(field) ?? new Set<string>()
        seen.add(labelOf(value))
        observed.set(field, seen)
      }
    }
    const expected: Record<string, string[]> = {
      gmlId: ['string'],
      ID: ['number'],
      NAME: ['string'],
      ART: ['string'],
      GEBUEHRENPFLICHT: ['string'],
      MAXIMALE_PARKDAUER: ['string'],
      GILT_VON: ['string'],
      GILT_BIS: ['string'],
      STATUS: ['string'],
      // In allen 41 Zonen null; das Interface lässt `string` zu, beobachtet ist er nicht.
      STATUS_HINWEIS: ['null'],
      KEIN_BEWOHNERPARKEN: ['string'],
      GRUPPE: ['null', 'string'],
      UNTERGRUPPE: ['null', 'string'],
      DOWNLOAD_URL: ['string'],
    }
    expect([...observed.keys()].sort()).toEqual(Object.keys(expected).sort())
    for (const [field, types] of Object.entries(expected)) {
      expect([...(observed.get(field) ?? [])].sort(), field).toEqual([...types].sort())
    }
  })

  it('trägt 41 Zonen, 30 mit Scheibe und 11 mit Gebühr', () => {
    expect(FIXTURE.numberMatched).toBe(41)
    expect(FIXTURE.zonen).toHaveLength(41)
    expect(FIXTURE.art).toEqual([
      { text: 'Gebührenfreie Kurzparkzone', anzahl: 30 },
      { text: 'Gebührenpflichtige Kurzparkzone', anzahl: 11 },
    ])
  })

  // GeoJSON mit srsName: [lon, lat]. GML mit demselben srsName: [lat, lon].
  // Ohne srsName: Gauß-Krüger-Meter mit negativem Ostwert. Alle drei am
  // 16. September gemessen; die Reihenfolge steht in sources.ts, nicht in
  // einer Heuristik.
  it('liefert im GeoJSON Länge vor Breite, in Grad und innerhalb des Rahmens', () => {
    const [lon, lat] = FIXTURE.ersterStuetzpunkt
    expect(withinCity(SALZBURG, lon, lat)).toBe(true)
    expect(FIXTURE.ersterStuetzpunktGml4326).toEqual([lat, lon])
    expect(Math.abs(FIXTURE.ersterStuetzpunktOhneSrsName[1])).toBeGreaterThan(1000)
  })

  it('stempelt jede Zone mit der GML-Kennung ihrer ID', () => {
    for (const zone of FIXTURE.zonen) {
      expect(zone.gmlId).toBe(`kurzparkzone.${String(zone.ID)}`)
    }
  })
})

describe('Beschuss', () => {
  const TOKENS = [
    'gebührenpflichtig', '(Gebühreneinhebung mit Parkscheinautomat)', 'gebührenfrei', '(aber Parkuhrenpflicht)',
    'werktags', 'Montag bis Freitag', 'Samstag', 'Sonntag', 'täglich', 'und', ';', ' - ', '-', ' ', '  ',
    '9', '19', '16', '24', '25', '0', '99', '9:30', '9:75', 'Uhr', 'uhr', 'Stunden', 'Stunde', 'Minuten', '3',
    'gilt nicht zum Dauerparken', 'Ausnahmebewilligung', '€', '2,20', ' ', '​', 'ß', 'Ä', '{', '\\', 'NaN',
  ]
  const lcg = (seed: number) => {
    let state = seed >>> 0
    return () => {
      state = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0
      return state
    }
  }
  const inputs = (seed: number, count: number): string[] => {
    const next = lcg(seed)
    return Array.from({ length: count }, () => {
      const parts = next() % 14
      return Array.from({ length: parts }, () => TOKENS[next() % TOKENS.length] as string).join('')
    })
  }

  it('wirft aus parseSalzburgRule nur SalzburgParseError und liefert nur gültige Fenster', () => {
    for (const input of inputs(4711, 1500)) {
      try {
        const rule = parseSalzburgRule(input)
        for (const window of [...rule.windows, ...rule.discWindows]) {
          expect(window.fromMinute, input).toBeGreaterThanOrEqual(0)
          expect(window.fromMinute, input).toBeLessThan(window.toMinute)
          expect(window.toMinute, input).toBeLessThanOrEqual(1440)
          expect(window.weekdays.length, input).toBeGreaterThan(0)
        }
      } catch (error) {
        expect(error, input).toBeInstanceOf(SalzburgParseError)
      }
    }
  })

  it('wirft aus parseSalzburgMaxStay nur SalzburgParseError und liefert nie null Minuten', () => {
    for (const input of inputs(815, 1500)) {
      try {
        const minutes = parseSalzburgMaxStay(input)
        if (minutes !== undefined) {
          expect(Number.isInteger(minutes), input).toBe(true)
          expect(minutes, input).toBeGreaterThan(0)
        }
      } catch (error) {
        expect(error, input).toBeInstanceOf(SalzburgParseError)
      }
    }
  })
})

describe('eine Salzburger Zone im gemeinsamen Tarifmodell', () => {
  function zoneFrom(raw: string, id = 'test'): ParkingZone {
    const rule = parseSalzburgRule(raw)
    return {
      id,
      name: id,
      land: 'AT-S',
      fee: salzburgFee(rule),
      windows: rule.windows,
      maxStayMinutes: 180,
      unmodelledRules: salzburgUnmodelledRules(rule, 180),
    }
  }
  const paid = zoneFrom(PFLICHT_MO_FR_SA, 'Schallmoos')
  const disc = zoneFrom(FREI_MO_FR, 'Parsch West')
  const discSa = zoneFrom(FREI_MO_SA, 'Nonntal-Ost')

  // Alle Zeiten sind Ortszeit Salzburg = Europe/Berlin; im September UTC+2.
  const dienstag10 = Date.parse('2026-09-22T10:00:00+02:00')
  const dienstag19 = Date.parse('2026-09-22T19:00:00+02:00')
  const samstag10 = Date.parse('2026-09-19T10:00:00+02:00')
  const sonntag10 = Date.parse('2026-09-20T10:00:00+02:00')

  it('kassiert dienstags um 10 und um 19 Uhr nicht mehr', () => {
    expect(isChargeable(paid, dienstag10)).toBe(true)
    expect(isChargeable(paid, dienstag19)).toBe(false)
    expect(chargeableAt(paid, dienstag10).changesAt?.getTime()).toBe(dienstag19)
  })

  it('kassiert samstags nicht — und sagt in der Zusatzregel, dass die Scheibe verlangt ist', () => {
    expect(isChargeable(paid, samstag10)).toBe(false)
    expect(paid.unmodelledRules).toEqual(['Sa 9–16 Uhr gebührenfrei, aber mit Parkscheibe, höchstens 3 Std.'])
    expect(isChargeable(paid, sonntag10)).toBe(false)
  })

  it('verlangt in einer Scheibenzone die Scheibe zur Bürozeit, samstags nur, wo die Quelle es sagt', () => {
    expect(isChargeable(disc, dienstag10)).toBe(true)
    expect(disc.fee).toEqual({ kind: 'disc' })
    expect(isChargeable(disc, samstag10)).toBe(false)
    expect(isChargeable(discSa, samstag10)).toBe(true)
    expect(isChargeable(discSa, sonntag10)).toBe(false)
  })

  it('rechnet drei Stunden auf 6,60 € und schlägt bei der vierten Stunde an', () => {
    const drei = estimateCost(paid, dienstag10, 180)
    expect(drei.priced).toBe(true)
    expect(drei.currency).toBe('EUR')
    expect(drei.minCents).toBe(660)
    expect(drei.maxCents).toBe(660)
    expect(drei.exceedsMaxStay).toBe(false)
    expect(estimateCost(paid, dienstag10, 240).exceedsMaxStay).toBe(true)
    expect(estimateCost(disc, dienstag10, 60).priced).toBe(false)
  })

  // Der Grund, warum Österreich einen eigenen Kalender hat: Am 3. Oktober
  // kassiert Salzburg, am 26. Oktober nicht — in Berlin ist es umgekehrt.
  it('kassiert am Tag der Deutschen Einheit und ruht am Nationalfeiertag', () => {
    // 3. Oktober 2028 ist ein Dienstag, 26. Oktober 2026 ein Montag.
    const einheit = Date.parse('2028-10-03T10:00:00+02:00')
    const national = Date.parse('2026-10-26T10:00:00+01:00')
    expect(isChargeable(paid, einheit)).toBe(true)
    expect(isChargeable({ ...paid, land: 'BE' }, einheit)).toBe(false)
    expect(isChargeable(paid, national)).toBe(false)
    expect(isChargeable({ ...paid, land: 'BE' }, national)).toBe(true)
  })

  it('kassiert am Karfreitag, den Bayern frei hat, und ruht an Fronleichnam wie Bayern', () => {
    const karfreitag = Date.parse('2026-04-03T10:00:00+02:00')
    const fronleichnam = Date.parse('2026-06-04T10:00:00+02:00')
    expect(isChargeable(paid, karfreitag)).toBe(true)
    expect(isChargeable({ ...paid, land: 'BY' }, karfreitag)).toBe(false)
    expect(isChargeable(paid, fronleichnam)).toBe(false)
  })

  // Der Rupertitag ist Landesfeiertag ohne Feiertagsruhe — die Stadt sagt
  // „An Sonn- und Feiertagen … gratis", und ein Landespatron ist keiner
  // davon. Die Kurzparkzone gilt.
  it('kassiert am Rupertitag, dem Salzburger Landesfeiertag', () => {
    const rupert = Date.parse('2026-09-24T10:00:00+02:00') // Donnerstag
    expect(holidaysFor('AT-S', 2026).has('2026-09-24')).toBe(false)
    expect(isChargeable(paid, rupert)).toBe(true)
  })

  it('baut jede der 41 Zonen des Abzugs, ohne zu werfen', () => {
    for (const zone of FIXTURE.zonen) {
      expect(() => zoneFrom(zone.GEBUEHRENPFLICHT as string, String(zone.ID)), String(zone.ID)).not.toThrow()
    }
  })
})

describe('Salzburg als Stadt', () => {
  it('liegt in Österreich und trägt den Rahmen aus dem Stadtgebiet, nicht aus der Parkebene', () => {
    expect(cityCountry(SALZBURG)).toBe('AT')
    expect(SALZBURG.reportBounds).toEqual(SALZBURG_BOUNDS)
    // Die Kurzparkzonen reichen nur 13,006–13,078; Liefering liegt westlich.
    expect(withinCity(SALZBURG, 12.995, 47.82)).toBe(true) // Liefering
    expect(withinCity(SALZBURG, 13.11, 47.79)).toBe(true) // Aigen / Parsch
  })

  it('findet den Residenzplatz und nicht Hallein oder Wien', () => {
    expect(cityAt(13.0466, 47.7982)).toBe(SALZBURG)
    expect(cityAt(13.1, 47.683)).toBeUndefined() // Hallein
    expect(cityAt(16.3738, 48.2082)).toBeUndefined() // Wien
    expect(cityAt(11.5755, 48.1372)?.key).toBe('muenchen')
  })

  it('führt CC BY 3.0 AT mit Nennungspflicht und den Quellenvermerk des Dienstes wörtlich', () => {
    expect(SALZBURG.attribution.licenceFamily).toBe('cc-by')
    expect(SALZBURG.attribution.attributionRequired).toBe(true)
    expect(SALZBURG.attribution.licenceUrl).toBe('https://creativecommons.org/licenses/by/3.0/at/deed.de')
    expect(SALZBURG.attribution.source).toBe('Datenquelle: Stadt Salzburg – data.stadt-salzburg.at')
    expect(SALZBURG.licenceOpen).toBeUndefined()
  })
})
