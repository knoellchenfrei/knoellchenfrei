import { describe, expect, it } from 'vitest'

import {
  duration,
  euro,
  feeLabel,
  MAX_STAY_MINUTES,
  maxStayLabel,
  tidyPoiDetail,
  until,
} from '../src/format.js'

/**
 * `format.ts` — 107 Zeilen reine Funktionen, und bis zum 8. September ohne
 * einen einzigen Test.
 *
 * Gemessen wurde es, nicht vermutet: Eine Abdeckungsmessung über die reinen
 * Module der Web-App wies die Datei mit **0 %** aus. Das ist ausgerechnet die
 * Schicht, in der zwei gemeldete Fehler dieses Projekts lagen — „1 Std. 0 Min."
 * auf der vollen Stunde und „1 Plätze" aus dem POI-Feed. Beide sind im Code
 * behoben und mit einem Kommentar versehen; geprüft war keiner von beiden.
 *
 * Kein DOM nötig: `Intl` gibt es in Node, und die Zeitzone steht in den
 * Formatierern selbst.
 */

describe('Beträge', () => {
  /**
   * Zwischen Zahl und `€` steht ein **geschütztes Leerzeichen** (U+00A0), kein
   * gewöhnliches — so schreibt es `Intl.NumberFormat` für `de-DE`, und so
   * gehört es sich auch. Beim Schreiben dieses Tests hat es zugeschlagen: Die
   * Erwartung sah identisch aus und war es nicht („expected '4,00 €' to be
   * '4,00 €'"). Deshalb steht der Trenner hier als Escape und nicht als
   * kopiertes Zeichen — sonst ändert ihn irgendwann ein Editor still.
   */
  const nbsp = '\u00A0'

  it('schreibt Cent als deutschen Betrag, mit geschütztem Leerzeichen', () => {
    expect(euro(400)).toBe(`4,00${nbsp}€`)
    expect(euro(50)).toBe(`0,50${nbsp}€`)
  })

  it('nennt eine Spanne als Spanne — eine Zahl daraus vergriffe sich um bis zu 50 %', () => {
    expect(feeLabel({ kind: 'range', minCentsPerHour: 200, maxCentsPerHour: 400 })).toBe(
      `2,00${nbsp}€–4,00${nbsp}€/Std.`
    )
  })

  /**
   * Die Regel des Projekts in einem Test: Kein Betrag ist **nicht** null Euro.
   * „0,00 €" läse sich als „hier ist nichts zu beachten", und Parkscheibe wie
   * fehlender Tarif heissen das Gegenteil.
   */
  it('gibt Parkscheibe und fehlendem Tarif Worte statt einer Null', () => {
    expect(feeLabel({ kind: 'disc' })).toBe('Parkscheibe')
    expect(feeLabel({ kind: 'unknown' })).toBe('Tarif nicht angegeben')
    expect(feeLabel({ kind: 'disc' })).not.toContain('0')
    expect(feeLabel({ kind: 'unknown' })).not.toContain('0')
  })
})

describe('Dauer', () => {
  // Der gemeldete Fehler: „1 Std. 0 Min." liest sich wie ein Rundungsartefakt.
  it('lässt die Null auf der vollen Stunde weg', () => {
    expect(duration(3600_000)).toBe('1 Std.')
    expect(duration(2 * 3600_000)).toBe('2 Std.')
    expect(duration(3600_000 + 60_000)).toBe('1 Std. 1 Min.')
  })

  // „0 Min." auf einem Countdown heisst „vorbei", und das stimmt dann nicht.
  it('sagt bei weniger als einer Minute, dass noch Zeit ist', () => {
    expect(duration(59_000)).toBe('unter einer Minute')
    expect(duration(1)).toBe('unter einer Minute')
    expect(duration(0)).toBe('unter einer Minute')
  })

  it('nimmt eine negative Dauer hin, statt Unsinn zu schreiben', () => {
    // Kommt vor, wenn die Uhr des Geräts nachgestellt wird.
    expect(duration(-5_000)).toBe('unter einer Minute')
  })

  it('rundet ab, nicht auf — eine Restzeit soll nicht länger aussehen als sie ist', () => {
    expect(duration(119_000)).toBe('1 Min.')
  })
})

describe('Höchstparkdauer', () => {
  it('macht aus den Codes des Feeds deutsche Prosa', () => {
    expect(maxStayLabel('4h')).toBe('4 Std.')
    expect(maxStayLabel('30min')).toBe('30 Min.')
  })

  it('gibt einen unbekannten Code unverändert zurück, statt ihn zu erfinden', () => {
    expect(maxStayLabel('12tage')).toBe('12tage')
    expect(maxStayLabel('')).toBe('')
  })

  /**
   * Die Tabelle und die Beschriftung müssen dieselben Codes kennen. Fehlt einer
   * in `MAX_STAY_MINUTES`, setzt `toParkingZone` still keine Höchstparkdauer,
   * die Anzeige nennt sie trotzdem, und nur die Kostenschätzung läuft
   * unbegrenzt weiter — genau das war bei Frankfurts `5h` beinahe passiert.
   */
  it('beschriftet jeden Code, den die Tabelle kennt', () => {
    for (const code of Object.keys(MAX_STAY_MINUTES)) {
      expect(maxStayLabel(code), code).not.toBe(code)
    }
  })
})

describe('POI-Text aus fremder Hand', () => {
  // Der zweite gemeldete Fehler: Der Feed schreibt „1 Plätze".
  it('macht aus „1 Plätze" einen Platz', () => {
    expect(tidyPoiDetail('1 Plätze')).toBe('1 Platz')
    expect(tidyPoiDetail('1 Plätze · Ladepunkt')).toBe('1 Platz · Ladepunkt')
  })

  it('fasst nur die Eins an, nicht jede Zahl', () => {
    expect(tidyPoiDetail('11 Plätze')).toBe('11 Plätze')
    expect(tidyPoiDetail('21 Plätze')).toBe('21 Plätze')
  })

  it('zieht doppelte Leerzeichen zusammen und schneidet die Ränder', () => {
    expect(tidyPoiDetail('  Mo-Fr   9-20 Uhr  ')).toBe('Mo-Fr 9-20 Uhr')
  })
})

describe('„bis …"', () => {
  /** Berliner Ortszeit; im September gilt MESZ, also UTC+2. */
  const berlin = (iso: string): Date => new Date(iso)

  it('nennt nur die Uhrzeit, solange es derselbe Tag ist', () => {
    expect(until(berlin('2026-09-08T18:00:00Z'), berlin('2026-09-08T10:00:00Z'))).toBe('20:00')
  })

  it('nennt den Wochentag, sobald es über den Tag geht', () => {
    // Sonntagabend auf Montagmorgen.
    // `Intl` schreibt den Kurztag mit Punkt: „Mo., 09:00".
    expect(until(berlin('2026-09-14T07:00:00Z'), berlin('2026-09-13T18:00:00Z'))).toMatch(
      /^Mo\.,? /
    )
  })

  /**
   * Mitternacht steht als 24:00 des Tages davor, nicht als 00:00 des nächsten.
   * Auf dem Schild steht „bis 24 Uhr", und „bis Mo 00:00" an einem
   * Sonntagabend liest sich wie ein anderer Tag.
   */
  it('schreibt Mitternacht als 24:00 desselben Tages', () => {
    // 00:00 Berliner Zeit am 9. September = 22:00 UTC am 8.
    expect(until(berlin('2026-09-08T22:00:00Z'), berlin('2026-09-08T15:00:00Z'))).toBe('24:00')
  })

  it('aber nicht, wenn der Bezugstag ein anderer ist', () => {
    // Dieselbe Mitternacht, gefragt am Tag davor: dann ist es wirklich ein
    // anderer Tag und der Wochentag gehört dazu.
    expect(until(berlin('2026-09-08T22:00:00Z'), berlin('2026-09-07T15:00:00Z'))).not.toBe('24:00')
  })
})
