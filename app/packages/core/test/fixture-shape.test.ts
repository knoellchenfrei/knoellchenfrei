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
import type { InnsbruckZoneProperties } from '../src/innsbruck.js'
import type { MuenchenZoneProperties } from '../src/muenchen.js'
import type { FreiburgAutomatProperties, FreiburgZoneProperties } from '../src/freiburg.js'
import type { RostockAutomatProperties, RostockZoneProperties } from '../src/rostock.js'
import type { CottbusAutomatProperties, CottbusZoneProperties } from '../src/cottbus.js'
import type { SchwerinAutomatProperties } from '../src/schwerin.js'
import type { GrazZoneProperties } from '../src/graz.js'
import type { KasselIdentifyResult, KasselZoneAttributes } from '../src/kassel.js'
import { parseSalzburgMaxStay, parseSalzburgRule, type SalzburgZoneProperties } from '../src/salzburg.js'
import type {
  ZuerichMeterProperties,
  ZuerichQuartierProperties,
  ZuerichSpaceProperties,
  ZuerichZoneProperties,
} from '../src/zuerich.js'

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

describe('Innsbrucker Fixture', () => {
  const ROWS = read<{ zonen: InnsbruckZoneProperties[] }>('ibk-parkzonen-2026-09-16.json').zonen

  // Fünf Felder, keines fehlt je, keines ist je null. `FID` ist der einzige
  // Schlüssel des Feeds — käme er als `"132"`, wäre er als Zonenschlüssel
  // derselbe Text, aber die Prüfung auf Ganzzahl im Datenbau fiele.
  it('führt genau diese fünf Felder in genau diesen Typen', () => {
    expectShape(ROWS as unknown as Record<string, unknown>[], {
      FID: ['number'],
      BEZEICH: ['string'],
      INFO: ['string'],
      Shape__Area: ['number'],
      Shape__Length: ['number'],
    })
  })

  it('lässt weder Bezeichnung noch Beschreibung leer', () => {
    for (const row of ROWS) {
      expect((row.BEZEICH ?? '').trim().length, String(row.FID)).toBeGreaterThan(0)
      expect((row.INFO ?? '').trim().length, String(row.FID)).toBeGreaterThan(0)
    }
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

describe('Freiburger Fixtures', () => {
  const ZONES = read<FreiburgZoneProperties[]>('fr-parkgebzonen-2026-09-16.json')
  const AUTOMATS = read<{ automaten: FreiburgAutomatProperties[] }>(
    'fr-parkscheinautomaten-2026-09-16.json'
  ).automaten

  it('führt die Flächen in genau diesen Typen', () => {
    expectShape(ZONES as unknown as Record<string, unknown>[], {
      fid: ['number'],
      // Die Zonennummer als **Zeichenkette** — am Automaten ist sie eine Zahl.
      // Der Datenbau vergleicht deshalb über `String(...)`, nicht mit `===`.
      parkgebuehrenzone: ['string'],
      parkgebuehr_je_stunde: ['string'],
      'tages-parkpauschale': ['string'],
      zeit_der_gebuehrenpflicht: ['string'],
      zonenname: ['string'],
    })
  })

  it('führt die Automaten in genau diesen Typen', () => {
    expectShape(AUTOMATS as unknown as Record<string, unknown>[], {
      gid: ['number'],
      // Echte Booleans, nicht `"True"` — die Recherche vom Vormittag hatte
      // die Zeichenkette notiert, der Feed liefert den Typ.
      kartenzahlung: ['boolean'],
      aktiv: ['boolean'],
      gebiet: ['string'],
      gebuehrenzone: ['number'],
      laufzeiten: ['string'],
      hoechstparkdauer_in_h: ['number'],
      handyparkzone: ['string'],
      standort: ['string'],
      stadtteil: ['string'],
      tarif_in_euro_h: ['number'],
      tarif_e_h: ['string'],
      kartenzahlung_i: ['number'],
    })
  })
})

describe('Grazer Fixtures', () => {
  const BLAU = read<GrazZoneProperties[]>('graz-kurzparkzonen-2026-09-16.json')
  const GRUEN = read<GrazZoneProperties[]>('graz-parkzonen-2026-09-16.json')

  // Beide Ebenen führen dieselben dreizehn Felder — mit einem Unterschied,
  // den man erst hier sieht: `DELETED` ist in der grünen Ebene einmal `null`
  // statt einer Zeichenkette. `grazDeletedMarker` rechnet mit beidem.
  const FELDER = {
    OBJECTID: ['number'],
    BEZEICHNUNG: ['string'],
    NAME: ['string'],
    TYP: ['string'],
    PARKDAUER: ['string'],
    GELTUNGSZEIT: ['string'],
    PARK_DAUER: ['string'],
    PARK_GEBUEHR: ['string'],
    AG_BEWOHNER_INFO: ['string'],
    ZONEN_PLAN: ['string'],
    HANDYPARKEN_CODE: ['string'],
    Shape__Area: ['number'],
  }

  it('führt die Kurzparkzonen in genau diesen Typen', () => {
    expectShape(BLAU as unknown as Record<string, unknown>[], { ...FELDER, DELETED: ['string'] })
  })

  it('führt die Parkzonen in denselben Typen, DELETED einmal als null', () => {
    expectShape(GRUEN as unknown as Record<string, unknown>[], { ...FELDER, DELETED: ['null', 'string'] })
  })

  it('führt OBJECTID je Ebene eindeutig — über beide Ebenen hinweg nicht', () => {
    expect(new Set(BLAU.map((row) => row.OBJECTID)).size).toBe(90)
    expect(new Set(GRUEN.map((row) => row.OBJECTID)).size).toBe(75)
    // Beide Ebenen zählen ab 1; die Nummer taugt deshalb nicht als Schlüssel
    // über die ganze Stadt — `grazZoneKey` nimmt `BEZEICHNUNG`.
    expect(new Set([...BLAU, ...GRUEN].map((row) => row.OBJECTID)).size).toBeLessThan(165)
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

describe('Cottbuser Fixtures', () => {
  const AUTOMATS = read<{ automaten: CottbusAutomatProperties[] }>(
    'cottbus-parkscheinautomaten-2026-09-16.json'
  ).automaten
  const ZONES = read<{ zonen: CottbusZoneProperties[] }>('cottbus-bewohnerparkzonen-2026-09-16.json').zonen

  it('führt die Automaten in genau diesen 24 Feldern und Typen', () => {
    expectShape(AUTOMATS as unknown as Record<string, unknown>[], {
      OBJECTID: ['number'],
      // Ein Feld, das die Layer-Beschreibung gar nicht nennt und das im
      // GeoJSON trotzdem an 43 Automaten steht — immer `null`; am einen
      // Automaten ohne Geometrie fehlt es ganz. `absent` ist ein eigener
      // Befund, kein `null`.
      SHAPE: ['absent', 'null'],
      standort: ['string'],
      naehe_bezeich: ['string', 'null'],
      pkw: ['number'],
      behin_stellpl: ['number'],
      krad: ['number'],
      zone: ['string'],
      // Die sechs Zeitfelder — alle als Zeichenkette, nie leer.
      wt: ['string'],
      wt_bew_beginn: ['string'],
      wt_bew_ende: ['string'],
      woende: ['string'],
      woen_bew_beginn: ['string'],
      woen_bew_ende: ['string'],
      // Beträge als **Zahl**, nicht als Text — der Grund, warum
      // `parseCottbusFee` eine Zahl nimmt und rundet.
      mind_gebuehr: ['number'],
      gebuehr: ['number'],
      id_postleitzahl: ['string', 'null'],
      id_ort: ['string'],
      id_stadtgebiete: ['string'],
      id_ortsteile: ['string'],
      id_bezirke: ['string'],
      bloecke: ['string'],
      pk_psa: ['number', 'null'],
      lfd__Nr_: ['number'],
    })
  })

  it('führt die Zonen in genau diesen zwölf Feldern und Typen', () => {
    expectShape(ZONES as unknown as Record<string, unknown>[], {
      OBJECTID: ['number'],
      name: ['string'],
      tel: ['string'],
      mail: ['string'],
      url: ['string'],
      ansprechpa: ['string'],
      bem: ['string'],
      gis_id_ort: ['string'],
      // In allen fünf Zonen `null` — der Dienst sagt nicht, wie alt sie sind.
      geaendert_am: ['null'],
      GlobalID: ['string'],
      Shape__Area: ['number'],
      Shape__Length: ['number'],
    })
  })

  it('lässt kein Zeitfeld leer', () => {
    for (const automat of AUTOMATS) {
      for (const field of ['wt', 'wt_bew_beginn', 'wt_bew_ende', 'woende', 'woen_bew_beginn', 'woen_bew_ende'] as const) {
        expect((automat[field] ?? '').trim(), `${automat.standort ?? '?'} ${field}`).not.toBe('')
      }
    }
  })
})

describe('Salzburger Fixture', () => {
  interface Fixture {
    zonen: (SalzburgZoneProperties & { gmlId: string })[]
  }
  const FIXTURE = read<Fixture>('sbg-kurzparkzonen-2026-09-16.json')

  it('führt die Kurzparkzonen in genau diesen Typen', () => {
    expectShape(FIXTURE.zonen as unknown as Record<string, unknown>[], {
      gmlId: ['string'],
      ID: ['number'],
      NAME: ['string'],
      ART: ['string'],
      GEBUEHRENPFLICHT: ['string'],
      MAXIMALE_PARKDAUER: ['string'],
      GILT_VON: ['string'],
      GILT_BIS: ['string'],
      STATUS: ['string'],
      // In allen 41 Zonen null — beobachtet ist kein anderer Typ.
      STATUS_HINWEIS: ['null'],
      KEIN_BEWOHNERPARKEN: ['string'],
      // Fünf Zonen liegen in keiner Bewohnerparkzone; die Quelle schreibt
      // dann `null`, nicht eine leere Zeichenkette.
      GRUPPE: ['null', 'string'],
      UNTERGRUPPE: ['null', 'string'],
      DOWNLOAD_URL: ['string'],
    })
  })

  // Beide Felder gehen in einen Parser, der `raw.length` liest.
  it('liefert für jede Zone mindestens ein Fenster und eine Höchstparkdauer', () => {
    for (const zone of FIXTURE.zonen) {
      expect(parseSalzburgRule(zone.GEBUEHRENPFLICHT as string).windows.length, String(zone.ID)).toBeGreaterThan(0)
      expect(parseSalzburgMaxStay(zone.MAXIMALE_PARKDAUER), String(zone.ID)).toBe(180)
    }
  })
})

describe('Zürcher Fixtures', () => {
  const ZONES = read<{ zonen: ZuerichZoneProperties[] }>('zh-tarifzonen-2026-09-17.json').zonen
  const METERS = read<{ parkuhren: ZuerichMeterProperties[] }>('zh-parkuhren-2026-09-17.json').parkuhren
  const SPACES = read<{ parkfelder: ZuerichSpaceProperties[] }>('zh-parkfelder-2026-09-17.json').parkfelder
  const QUARTIERE = read<{ quartiere: ZuerichQuartierProperties[] }>('zh-quartiere-2026-09-17.json').quartiere

  it('führt die Tarifflächen in genau diesen fünf Feldern und Typen', () => {
    expectShape(ZONES as unknown as Record<string, unknown>[], {
      bedienungszeiten: ['string'],
      // Ein Feld des Geodaten-Exports, an jeder Ebene dieses Servers, immer `null`.
      geometrie_gdo: ['null'],
      objectid: ['number'],
      tarifzone: ['string'],
      zone_bezeichnung: ['string'],
    })
  })

  it('führt die Parkuhren in genau diesen Feldern und Typen — der Tarif ist eine Zeichenkette', () => {
    expectShape(METERS as unknown as Record<string, unknown>[], {
      davnr: ['string'],
      // HTML mit einem Foto-Link ins Intranet — an 33 der 1.397 Parkuhren leer.
      file_path: ['string', 'null'],
      geometrie_gdo: ['null'],
      geoserverhausnummerid: ['string', 'null'],
      geoserverstrasseid: ['string'],
      // LV95 als Zahl neben der WGS84-Geometrie — die Probe, dass der Dienst
      // wirklich umgerechnet hat: 2'683'177 ist kein Längengrad.
      hochwert: ['number'],
      rechtswert: ['number'],
      kategorie: ['string'],
      objectid: ['number'],
      parkierungzonename: ['string'],
      parkierungzonenummer: ['number'],
      tarif: ['string'],
      typ: ['string'],
      // Von der Fixture ergänzt: die Koordinate, damit `zuerich.test.ts` die
      // Achsenreihenfolge misst.
      punkt: ['array'],
    })
  })

  it('führt die Parkfelder in genau diesen Feldern und Typen — die Parkdauer ist eine Zahl oder null', () => {
    expectShape(SPACES as unknown as Record<string, unknown>[], {
      art: ['string'],
      bezeichnung: ['string', 'null'],
      davnr: ['string', 'null'],
      dienstabteilung: ['string'],
      eigentum: ['string'],
      // Als Zeichenkette `1`/`0`, nicht als Zahl und nicht als Wahrheitswert —
      // der Datenbau vergleicht mit `'1'`.
      gebpflicht: ['string'],
      geometrie_gdo: ['null'],
      inbetriebnahme: ['string'],
      inprojekt: ['string'],
      kategorie: ['string'],
      objectid: ['number'],
      orientierung: ['string'],
      // Minuten als Zahl; `null` genau an den Feldern ohne Parkuhr.
      parkdauer: ['number', 'null'],
      parkfeldnummer: ['number', 'null'],
      stand: ['string'],
      zugang: ['string'],
      punkt: ['array'],
    })
  })

  it('führt die Quartiere in genau diesen sieben Feldern und Typen', () => {
    expectShape(QUARTIERE as unknown as Record<string, unknown>[], {
      geometrie_gdo: ['null'],
      kname: ['string'],
      knr: ['number'],
      objectid: ['number'],
      objid: ['string'],
      qname: ['string'],
      qnr: ['number'],
    })
  })

  it('lässt weder Bedienungszeit noch Tarifzeile leer', () => {
    for (const zone of ZONES) expect((zone.bedienungszeiten ?? '').trim()).not.toBe('')
    for (const meter of METERS) expect((meter.tarif ?? '').trim(), String(meter.objectid)).not.toBe('')
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
describe('Rostocker Fixtures', () => {
  const AUTOMATS = read<RostockAutomatProperties[]>('hro-parkscheinautomaten-2026-09-16.json')
  const AREAS = read<RostockZoneProperties[]>('hro-bewohnerparkgebiete-2026-09-16.json')

  /**
   * Der Rostocker WFS führt ein leeres Feld **nicht** als `null`, sondern
   * lässt es weg — `absent`, nicht `null`, in jedem der zwölf Felder, die
   * nicht immer belegt sind. Der Download derselben Daten schreibt dort
   * `null`. Wer den Parser gegen den Download testet und gegen den WFS baut,
   * prüft den falschen Fall; deshalb ist die Fixture ein Auszug aus der
   * WFS-Antwort, und `absent` steht hier ausdrücklich.
   *
   * Und der Betrag ist eine **Zahl** — der Fall, der bei Frankfurt zu dieser
   * Datei geführt hat, hier als Regelfall.
   */
  it('führt die Automaten in genau diesen Typen — fehlende Felder fehlen, statt null zu sein', () => {
    expectShape(AUTOMATS as unknown as Record<string, unknown>[], {
      bewirtschaftungszeiten: ['string'],
      // Leerstring bei 63 von 111 Automaten, nie `null`, nie weggelassen.
      bewohnerparkgebiet: ['string'],
      bezeichnung: ['string'],
      handyparkzone: ['number'],
      normaltarif_gebuehren_max: ['absent', 'number'],
      // Die zwei Automaten ohne Betrag: kein `null`, das Feld fehlt.
      normaltarif_gebuehren_pro_stunde: ['absent', 'number'],
      normaltarif_gebuehrenschritte: ['string'],
      normaltarif_parkdauer_max: ['number'],
      normaltarif_parkdauer_max_einheit: ['string'],
      normaltarif_parkdauer_min: ['number'],
      normaltarif_parkdauer_min_einheit: ['string'],
      nummer: ['number'],
      stellplaetze_bus: ['absent', 'number'],
      stellplaetze_pkw: ['absent', 'number'],
      tarif: ['string'],
      uuid: ['string'],
      veranstaltungstarif_gebuehren_max: ['absent', 'number'],
      veranstaltungstarif_gebuehren_pro_stunde: ['absent', 'number'],
      // Die Einheitenfelder sind immer da, auch wenn die Zahl daneben fehlt.
      veranstaltungstarif_gebuehrenschritte: ['string'],
      veranstaltungstarif_parkdauer_max: ['absent', 'number'],
      veranstaltungstarif_parkdauer_max_einheit: ['string'],
      veranstaltungstarif_parkdauer_min: ['absent', 'number'],
      veranstaltungstarif_parkdauer_min_einheit: ['string'],
      zone: ['string'],
      zugelassene_muenzen: ['string'],
    })
  })

  it('führt die Gebiete in genau diesen drei Feldern', () => {
    expectShape(AREAS as unknown as Record<string, unknown>[], {
      uuid: ['string'],
      bezeichnung: ['string'],
      adressen: ['string'],
    })
    expect(AREAS).toHaveLength(10)
  })

  // Die Einheit steht in einem eigenen Feld, und der Parser nimmt genau drei
  // Werte an. Ein vierter im Feed wäre ein Abbruch des Datenbaus — hier soll
  // er vorher auffallen.
  it('schreibt die Höchstparkdauer nur in h, min oder d', () => {
    for (const automat of AUTOMATS) {
      expect(['h', 'min', 'd']).toContain(automat.normaltarif_parkdauer_max_einheit)
    }
  })
})

describe('Schweriner Fixtures', () => {
  interface Psa {
    auszug: { id: string; properties: SchwerinAutomatProperties; positionUtm: unknown }[]
  }
  interface Zonen {
    flaechen: { id: unknown; properties: Record<string, unknown>; geometry: { type: string; coordinates: unknown } }[]
  }
  const PSA = read<Psa>('sn-parkscheinautomaten-2026-09-16.json')
  const ZONEN = read<Zonen>('sn-parkzonen-2026-09-16.json')

  // Alles Zeichenkette, nie `null`, nie fehlend: So liefert `gml.ts` ein
  // MapServer-GML, und ein leeres Feld ist eine leere Zeichenkette — der
  // Datenbau prüft `=== ''`, nicht `== null`. Ein `null` hier hiesse, dass
  // der Leser oder der Dienst sich geändert hat.
  it('führt die Automaten in genau diesen acht Feldern, alle als Zeichenkette', () => {
    expectShape(PSA.auszug.map((automat) => automat.properties) as unknown as Record<string, unknown>[], {
      Bezeichnung: ['string'],
      Bemerkung: ['string'],
      Standort: ['string'],
      Bewirtschaftungszeit: ['string'],
      Hoechstparkdauer: ['string'],
      Gebuehr: ['string'],
      Tagesticket: ['string'],
      Kurzparkticket: ['string'],
    })
  })

  it('trägt je Automat eine Position in UTM-Metern, Ost vor Nord', () => {
    for (const automat of PSA.auszug) {
      const [easting, northing] = automat.positionUtm as number[]
      expect(easting).toBeGreaterThan(255_000)
      expect(easting).toBeLessThan(270_000)
      expect(northing).toBeGreaterThan(5_938_000)
      expect(northing).toBeLessThan(5_955_000)
    }
  })

  // Der Befund, um den sich Schwerins Datenbau dreht: kein Feld, keine
  // Kennung. Taucht hier je ein Feld auf, ist `SCHWERIN_ZONE_ANCHORS`
  // dagegen zu prüfen — und vermutlich überflüssig.
  it('führt die Zonen ohne Kennung und ohne ein einziges Sachfeld, mit geschlossenen Ringen', () => {
    expect(ZONEN.flaechen).toHaveLength(15)
    for (const flaeche of ZONEN.flaechen) {
      expect(flaeche.id).toBeNull()
      expect(Object.keys(flaeche.properties)).toEqual([])
      expect(['Polygon', 'MultiPolygon']).toContain(flaeche.geometry.type)
      const polygons =
        flaeche.geometry.type === 'Polygon'
          ? [flaeche.geometry.coordinates as number[][][]]
          : (flaeche.geometry.coordinates as number[][][][])
      for (const rings of polygons) {
        for (const ring of rings) {
          expect(ring.length).toBeGreaterThanOrEqual(4)
          expect(ring[0]).toEqual(ring[ring.length - 1])
        }
      }
    }
  })
})

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

describe('Kasseler Fixtures', () => {
  const BEZIRKE = read<KasselZoneAttributes[]>('kassel-bezirke-2026-09-17.json')
  const VW7 = read<KasselIdentifyResult>('kassel-bezirk-vw7-2026-09-17.json')

  // `identify` liefert die Sachdaten als Zeichenketten — auch die Nummer.
  // Dieselbe Ebene antwortet über `query` mit `OBJECTID` als Zahl; wer die
  // Fixture gegen `query` tauscht, sieht es hier zuerst.
  it('führt genau die zwei Felder, beide als Zeichenkette', () => {
    expectShape(BEZIRKE as unknown as Record<string, unknown>[], {
      OBJECTID: ['string'],
      Name: ['string'],
    })
    expect(BEZIRKE).toHaveLength(29)
  })

  it('führt ein identify-Ergebnis in genau diesen Feldern, die Geometrie als Ringe in Grad', () => {
    expectShape([VW7 as unknown as Record<string, unknown>], {
      layerId: ['number'],
      layerName: ['string'],
      value: ['string'],
      displayFieldName: ['string'],
      attributes: ['object'],
      geometryType: ['string'],
      geometry: ['object'],
    })
    expect(VW7.layerId).toBe(27)
    expect(VW7.layerName).toBe('Bewohnerparkbezirke')
    expect(VW7.geometryType).toBe('esriGeometryPolygon')
    expect(VW7.geometry?.spatialReference?.wkid).toBe(4326)
  })
})
