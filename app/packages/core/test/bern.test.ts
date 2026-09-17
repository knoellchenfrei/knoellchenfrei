import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import {
  BernParseError,
  bernZoneNameFromPlz,
  bernZoneNote,
  isBernZoneUnattributed,
  parseBernFieldType,
  parseBernInfo,
  parseBernZoneName,
  type BernZoneProperties,
} from '../src/bern.js'
import { BERN, cityAt, cityCountry, withinCity } from '../src/city.js'
import { chargeableAt, estimateCost, isChargeable, type ParkingZone } from '../src/tariff.js'

/**
 * Der echte Abruf vom 17. September 2026 — alle 42 Flächen, ohne Geometrie.
 *
 * Wie bei den Städten davor: Die Fixture ist der Feed, nicht ein ausgedachtes
 * Beispiel. Bei 42 Zeilen passt der ganze Sachdatenteil hinein, und damit
 * prüft „jeder Wert liest sich" wirklich jeden Wert.
 */
interface Fixture {
  abgerufenAm: string
  quelle: string
  anzahl: number
  geometrieTypen: Record<string, number>
  ersterStuetzpunkt: [number, number]
  zonen: BernZoneProperties[]
}

const FIXTURE = JSON.parse(
  readFileSync(fileURLToPath(new URL('./fixtures/bern-parkkartenzonen-2026-09-17.json', import.meta.url)), 'utf8')
) as Fixture
const ROWS = FIXTURE.zonen
const NAMED = ROWS.filter((row) => !isBernZoneUnattributed(row))

function count<T>(values: readonly T[]): Map<T, number> {
  const map = new Map<T, number>()
  for (const value of values) map.set(value, (map.get(value) ?? 0) + 1)
  return map
}

describe('die Fixture', () => {
  it('ist der ganze Abzug: 42 Polygone, in Grad', () => {
    expect(FIXTURE.anzahl).toBe(42)
    expect(ROWS).toHaveLength(42)
    expect(FIXTURE.geometrieTypen).toEqual({ Polygon: 42 })
    // `[lon, lat]`: Bern liegt bei 7° Ost, 47° Nord. In LV95 stünde hier
    // 2.600.000 / 1.200.000, und die Karte sähe nur leer aus.
    const [lon, lat] = FIXTURE.ersterStuetzpunkt
    expect(lon).toBeGreaterThan(7)
    expect(lon).toBeLessThan(8)
    expect(lat).toBeGreaterThan(46)
    expect(lat).toBeLessThan(47)
  })

  // Gezählt, nicht geschätzt — die Zahlen aus dem Datenbau hängen daran.
  it('führt 34 benannte Flächen und acht ohne jede Sachangabe', () => {
    expect(NAMED).toHaveLength(34)
    expect(ROWS.filter(isBernZoneUnattributed)).toHaveLength(8)
  })

  // 34 Flächen, 31 Namen: Drei Zonen bestehen aus zwei Stücken — dasselbe
  // wie Hamburgs Stücke, die App nummeriert Flächen selbst.
  it('vergibt 31 Zonennamen, drei davon je zweimal', () => {
    const names = count(NAMED.map((row) => row.PKZ_name))
    expect(names.size).toBe(31)
    const doppelt = [...names.entries()].filter(([, n]) => n > 1).map(([name]) => name)
    expect(doppelt.sort()).toEqual(['3000', '3008/1', '3008/3'])
  })

  // Zehnmal leer: acht namenlose Flächen und zwei benannte (3013, 3014/1).
  it('führt genau drei Hinweise in genau diesen Häufigkeiten, und zehnmal keinen', () => {
    const infos = count(ROWS.map((row) => row.Info_beschrieb))
    expect(infos.size).toBe(4)
    expect(infos.get('Auch Sonntags')).toBe(4)
    expect(infos.get('nicht definiert')).toBe(10)
    expect(infos.get('unbekannt')).toBe(18)
    expect(infos.get(null)).toBe(10)
  })

  it('führt zwei Parkfeldarten: 30-mal blau, viermal weiss', () => {
    const arten = count(ROWS.map((row) => row.Parkfeld_typ_beschrieb))
    expect(arten.size).toBe(3)
    expect(arten.get('blau mit Markierung')).toBe(30)
    expect(arten.get('weiss mit Markierung')).toBe(4)
    expect(arten.get(null)).toBe(8)
  })

  it('vergibt jede Objectid genau einmal', () => {
    const ids = ROWS.map((row) => row.Objectid)
    expect(new Set(ids).size).toBe(ids.length)
    for (const id of ids) expect(Number.isInteger(id)).toBe(true)
  })

  // Die acht namenlosen Flächen sind keine Lücke in einem Feld, sondern in
  // allen: Wer nur auf den Namen prüfte, hielte eine Fläche mit Art, aber
  // ohne Namen für dasselbe — und die wäre ein neuer Fall.
  it('lässt bei den acht namenlosen Flächen wirklich alles leer', () => {
    for (const row of ROWS.filter(isBernZoneUnattributed)) {
      expect(row.Parkfeld_typ).toBeNull()
      expect(row.PLZ).toBeNull()
      expect(row.PLZ_zusatz).toBeNull()
      expect(row.Info).toBeNull()
      expect(row.Letzte_Aenderung).toBeGreaterThan(0)
    }
  })
})

describe('parseBernZoneName', () => {
  it('liest eine Postleitzahl mit und ohne Zusatz', () => {
    expect(parseBernZoneName('3006')).toBe('3006')
    expect(parseBernZoneName('3008/1')).toBe('3008/1')
    expect(parseBernZoneName('3018/11')).toBe('3018/11')
    expect(parseBernZoneName('  3006 ')).toBe('3006')
  })

  it('weist alles ab, was kein Zonenname ist — der Name wird der Schlüssel', () => {
    for (const bad of ['', '300', '30061', '3006/', '/1', '3006/0', '3006/01', '3006/123', 'Bern', '3006 Bern', '3006-1']) {
      expect(() => parseBernZoneName(bad), bad).toThrow(BernParseError)
    }
  })

  it('begrenzt seine Eingabe, wie die anderen Parser', () => {
    expect(() => parseBernZoneName('3'.repeat(121))).toThrow(/länger als 120/)
  })

  it('liest jeden Namen des Abzugs', () => {
    for (const row of NAMED) expect(parseBernZoneName(row.PKZ_name ?? '')).toBe(row.PKZ_name)
  })
})

describe('bernZoneNameFromPlz', () => {
  it('setzt Postleitzahl und Zusatz zum Namen zusammen', () => {
    expect(bernZoneNameFromPlz('3006', 'kein Zusatz')).toBe('3006')
    expect(bernZoneNameFromPlz('3008', '/1')).toBe('3008/1')
    expect(bernZoneNameFromPlz('3018', '/11')).toBe('3018/11')
  })

  it('weist Unfug in beiden Feldern ab', () => {
    expect(() => bernZoneNameFromPlz('300', 'kein Zusatz')).toThrow(BernParseError)
    expect(() => bernZoneNameFromPlz('3006', '1')).toThrow(BernParseError)
    expect(() => bernZoneNameFromPlz('3006', '/x')).toThrow(BernParseError)
    expect(() => bernZoneNameFromPlz('3006', '')).toThrow(BernParseError)
    expect(() => bernZoneNameFromPlz('3006', '/0')).toThrow(BernParseError)
  })

  // Die zweite Schreibweise desselben Namens: In allen 34 Zeilen stimmt sie
  // mit `PKZ_name` überein. Der Datenbau bricht ab, sobald das nicht mehr gilt.
  it('stimmt in jeder benannten Zeile mit PKZ_name überein', () => {
    for (const row of NAMED) {
      expect(bernZoneNameFromPlz(row.PLZ_beschrieb ?? '', row.PLZ_zusatz_beschrieb ?? ''), String(row.Objectid)).toBe(
        row.PKZ_name
      )
    }
  })
})

describe('parseBernFieldType', () => {
  it('kennt blau und weiss, auch in anderer Schreibung', () => {
    expect(parseBernFieldType('blau mit Markierung')).toBe('blau')
    expect(parseBernFieldType('weiss mit Markierung')).toBe('weiss')
    expect(parseBernFieldType('Blau  mit Markierung ')).toBe('blau')
  })

  it('weist jede andere Art ab, statt sie als Blaue Zone zu zeigen', () => {
    for (const bad of ['', 'gelb mit Markierung', 'blau', 'blau ohne Markierung', 'weiß mit Markierung']) {
      expect(() => parseBernFieldType(bad), bad).toThrow(BernParseError)
    }
  })

  it('liest jede Art des Abzugs', () => {
    for (const row of NAMED) expect(['blau', 'weiss']).toContain(parseBernFieldType(row.Parkfeld_typ_beschrieb ?? ''))
  })
})

describe('parseBernInfo', () => {
  it('hält unbekannt, nicht definiert und leer für nichts', () => {
    expect(parseBernInfo('unbekannt')).toBeNull()
    expect(parseBernInfo('nicht definiert')).toBeNull()
    expect(parseBernInfo('')).toBeNull()
    expect(parseBernInfo('  ')).toBeNull()
  })

  it('gibt den einen Hinweis wörtlich zurück', () => {
    expect(parseBernInfo('Auch Sonntags')).toBe('Auch Sonntags')
    expect(parseBernInfo('auch sonntags')).toBe('Auch Sonntags')
  })

  it('weist einen neuen Hinweis ab, statt ihn als nichts zu lesen', () => {
    for (const bad of ['Nur werktags', 'Auch Sonntags und Feiertags', 'Sonntags', 'Mo-Sa 8-18 Uhr']) {
      expect(() => parseBernInfo(bad), bad).toThrow(BernParseError)
    }
  })

  it('liest jeden Hinweis des Abzugs, und findet genau vier Regeln', () => {
    const rules = ROWS.map((row) => parseBernInfo(row.Info_beschrieb ?? ''))
    expect(rules.filter((rule) => rule !== null)).toHaveLength(4)
  })
})

describe('bernZoneNote', () => {
  it('nennt die Parkfeldart und den Hinweis, wenn es einen gibt', () => {
    expect(bernZoneNote('blau', null)).toMatch(/^Blaue Zone/)
    expect(bernZoneNote('weiss', null)).toMatch(/^Weiss markierte/)
    expect(bernZoneNote('blau', 'Auch Sonntags')).toContain('Hinweis der Quelle: „Auch Sonntags"')
    expect(bernZoneNote('blau', null)).not.toContain('Hinweis')
  })
})

/**
 * Eine Berner Zone im gemeinsamen Tarifmodell: `scheduleUnknown`, kein
 * Fenster, kein Betrag — und die Antwort ist „unbekannt", nicht „frei".
 */
describe('eine Berner Zone im gemeinsamen Tarifmodell', () => {
  const zone: ParkingZone = {
    id: 'bern-3006',
    name: 'Parkkartenzone 3006',
    land: 'CH-BE',
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

  it('sagt es am Berchtoldstag genauso — ein Feiertag macht aus unbekannt kein frei', () => {
    expect(chargeableAt(zone, Date.UTC(2027, 0, 2, 10)).unknown).toBe(true)
  })

  it('rechnet keine Kosten und nennt keinen Preis', () => {
    const estimate = estimateCost(zone, Date.UTC(2026, 8, 15, 8), 120)
    expect(estimate.priced).toBe(false)
    expect(estimate.chargedMinutes).toBe(0)
  })
})

describe('Bern als Stadt', () => {
  it('liegt in der Schweiz, mit Berner Kantonskürzel', () => {
    expect(BERN.land).toBe('CH-BE')
    expect(cityCountry(BERN)).toBe('CH')
    expect(BERN.holidays).toBeUndefined()
  })

  it('nimmt den Zytglogge, Bümpliz und Oberbottigen an', () => {
    expect(cityAt(7.4477, 46.948)).toBe(BERN)
    expect(withinCity(BERN, 7.3897, 46.9448)).toBe(true) // Bümpliz
    expect(withinCity(BERN, 7.3115, 46.9315)).toBe(true) // Oberbottigen, ohne eine einzige Zone
  })

  // Der Rahmen kommt aus der Gemeindegrenze, nicht aus der Parkebene — die
  // Zonen reichen nur bis 7,373° Ost, die Stadt bis 7,294°.
  it('weist Thun, Burgdorf und Fribourg ab', () => {
    expect(cityAt(7.628, 46.758)).toBeUndefined() // Thun
    expect(cityAt(7.6285, 47.059)).toBeUndefined() // Burgdorf
    expect(cityAt(7.1612, 46.8065)).toBeUndefined() // Fribourg
  })

  it('umschliesst den ersten Stützpunkt des Abzugs', () => {
    const { minLon, minLat, maxLon, maxLat } = BERN.reportBounds
    const [lon, lat] = FIXTURE.ersterStuetzpunkt
    expect(lon).toBeGreaterThan(minLon)
    expect(lon).toBeLessThan(maxLon)
    expect(lat).toBeGreaterThan(minLat)
    expect(lat).toBeLessThan(maxLat)
  })

  it('verlangt die Nennung in der vorgeschriebenen Form', () => {
    expect(BERN.attribution.source).toBe('Geodaten Stadt Bern')
    expect(BERN.attribution.attributionRequired).toBe(true)
    expect(BERN.attribution.licenceFamily).toBe('cc-by')
    expect(BERN.licenceOpen).toBeUndefined()
    expect(BERN.towedVehicles).toBeUndefined()
  })
})
