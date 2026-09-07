import { describe, expect, it } from 'vitest'

import { berlinWallClock } from '../src/berlin-time.js'
import { holidaysFor, isHoliday, type Land } from '../src/holidays.js'

describe('holidaysFor', () => {
  it('places the movable feasts correctly for 2026 (Easter 5 April)', () => {
    const dates = holidaysFor('BE', 2026)
    expect(dates.has('2026-04-03')).toBe(true) // Karfreitag
    expect(dates.has('2026-04-06')).toBe(true) // Ostermontag
    expect(dates.has('2026-05-14')).toBe(true) // Christi Himmelfahrt
    expect(dates.has('2026-05-25')).toBe(true) // Pfingstmontag
  })

  it('includes International Womens Day, which is Berlin-specific', () => {
    expect(holidaysFor('BE', 2026).has('2026-03-08')).toBe(true)
  })

  it('excludes days that are not Berlin holidays', () => {
    const dates = holidaysFor('BE', 2026)
    expect(dates.has('2026-10-31')).toBe(false) // Reformationstag
    expect(dates.has('2026-11-18')).toBe(false) // Buss- und Bettag
  })

  it('handles a year where Easter falls in March', () => {
    // Easter 2024 was 31 March, so Good Friday lands in March.
    expect(holidaysFor('BE', 2024).has('2024-03-29')).toBe(true)
    expect(holidaysFor('BE', 2024).has('2024-04-01')).toBe(true)
  })

  it('detects a holiday from a wall-clock reading', () => {
    // 1 May 2026, 10:00 Berlin time.
    expect(isHoliday('BE', berlinWallClock(Date.UTC(2026, 4, 1, 8, 0)))).toBe(true)
  })

  // Der eigentliche Grund für die Umstellung: Berlin und Hamburg haben
  // *verschiedene* Feiertage. Sähen die beiden Kalender gleich aus, wäre die
  // ganze Tabelle überflüssig.
  it('gives Hamburg Reformationstag and denies it Womens Day', () => {
    const hh = holidaysFor('HH', 2026)
    expect(hh.has('2026-10-31')).toBe(true) // Reformationstag, seit 2018
    expect(hh.has('2026-03-08')).toBe(false) // gilt nur in BE und MV
  })

  it('keeps the nine nationwide holidays in both Länder', () => {
    const be = holidaysFor('BE', 2026)
    const hh = holidaysFor('HH', 2026)
    for (const date of ['2026-01-01', '2026-05-01', '2026-10-03', '2026-12-25', '2026-12-26']) {
      expect(be.has(date)).toBe(true)
      expect(hh.has(date)).toBe(true)
    }
  })

  it('counts ten holidays for Hamburg and ten for Berlin', () => {
    // Neun bundesweite plus je einer. Die Zahl steht hier, damit ein
    // versehentlich doppelt eingetragenes Datum auffällt.
    expect(holidaysFor('BE', 2026).size).toBe(10)
    expect(holidaysFor('HH', 2026).size).toBe(10)
  })

  // Hessen ist der Grund für die Strukturänderung: Fronleichnam ist beweglich
  // (Ostersonntag + 60) und trotzdem nicht bundesweit. Vorher kannte die Datei
  // nur eine *globale* Osterliste — Fronleichnam wäre dort in Berlin und
  // Hamburg gelandet, wo er kein Feiertag ist.
  it('gives Hessen Fronleichnam on the right day in two different years', () => {
    // Ostersonntag 2026 ist der 5. April, 2027 der 28. März.
    expect(holidaysFor('HE', 2026).has('2026-06-04')).toBe(true)
    expect(holidaysFor('HE', 2027).has('2027-05-27')).toBe(true)
  })

  // Der eigentliche Beweis, dass die Umstellung nichts verschoben hat: Die
  // beiden bestehenden Länder bekommen Fronleichnam NICHT mit.
  it('keeps Fronleichnam out of Berlin and Hamburg', () => {
    expect(holidaysFor('BE', 2026).has('2026-06-04')).toBe(false)
    expect(holidaysFor('HH', 2026).has('2026-06-04')).toBe(false)
  })

  it('denies Hessen the two days its neighbours have', () => {
    const he = holidaysFor('HE', 2026)
    expect(he.has('2026-03-08')).toBe(false) // Frauentag, nur BE und MV
    expect(he.has('2026-10-31')).toBe(false) // Reformationstag, nicht in HE
    expect(he.has('2026-11-01')).toBe(false) // Allerheiligen, nicht in HE
    expect(he.has('2026-11-18')).toBe(false) // Buss- und Bettag, nur in SN
  })

  it('counts ten holidays for Hessen too', () => {
    expect(holidaysFor('HE', 2026).size).toBe(10)
  })

  // Die Kalender der drei Länder unterscheiden sich um genau je einen Tag —
  // gäbe es keinen Unterschied, wäre die Tabelle überflüssig.
  it('leaves the nine nationwide holidays identical across all three Länder', () => {
    const [be, hh, he] = [holidaysFor('BE', 2026), holidaysFor('HH', 2026), holidaysFor('HE', 2026)]
    const shared = [...be].filter((date) => hh.has(date) && he.has(date))
    expect(shared).toHaveLength(9)
  })

  // Bayern ist das längste Land der Tabelle und trotzdem das einzige, das sie
  // allein nicht abbilden kann — siehe die Zusatztage weiter unten.
  it('gives Bayern its twelve statewide holidays', () => {
    const by = holidaysFor('BY', 2026)
    expect(by.has('2026-01-06')).toBe(true) // Heilige Drei Könige
    expect(by.has('2026-06-04')).toBe(true) // Fronleichnam, Ostern + 60
    expect(by.has('2026-11-01')).toBe(true) // Allerheiligen
    expect(by.size).toBe(12)
  })

  it('denies Bayern what its neighbours have and it does not', () => {
    const by = holidaysFor('BY', 2026)
    expect(by.has('2026-03-08')).toBe(false) // Frauentag, nur BE und MV
    expect(by.has('2026-10-31')).toBe(false) // Reformationstag, nicht in BY
    expect(by.has('2026-11-18')).toBe(false) // Buss- und Bettag, nur in SN
  })

  /**
   * Der Fall, für den `extraFixed` überhaupt existiert.
   *
   * Art. 1 Abs. 1 Nr. 2 BayFTG: Mariä Himmelfahrt ist Feiertag „in Gemeinden
   * mit überwiegend katholischer Bevölkerung". Das Landesamt für Statistik
   * führt München mit ja, Nürnberg mit nein — eine Ländertabelle hätte
   * zwangsläufig für eine der beiden Städte unrecht.
   */
  it('leaves Mariä Himmelfahrt out of the Land and lets a city add it', () => {
    expect(holidaysFor('BY', 2026).has('2026-08-15')).toBe(false)
    const muenchen = holidaysFor('BY', 2026, ['08-15'])
    expect(muenchen.has('2026-08-15')).toBe(true)
    expect(muenchen.size).toBe(13)
  })

  // Der Cache-Schlüssel muss die Zusatztage kennen: Sonst bekäme der zweite
  // Aufruf die Menge des ersten, und ob der 15. August dabei ist, hinge daran,
  // welche Stadt zuerst gefragt hat.
  it('does not let one city\'s holidays leak into another', () => {
    expect(holidaysFor('BY', 2026, ['08-15']).has('2026-08-15')).toBe(true)
    expect(holidaysFor('BY', 2026).has('2026-08-15')).toBe(false)
    expect(holidaysFor('BY', 2026, ['08-15']).has('2026-08-15')).toBe(true)
  })

  it('leaves the other three Länder untouched by the new parameter', () => {
    // Ohne Angabe ändert sich nichts — die Zahlen von vorher, noch einmal.
    expect(holidaysFor('BE', 2026).size).toBe(10)
    expect(holidaysFor('HH', 2026).size).toBe(10)
    expect(holidaysFor('HE', 2026).size).toBe(10)
    expect(holidaysFor('BE', 2026, []).size).toBe(10)
  })

  /**
   * Ein Tippfehler im Zusatzdatum wäre sonst unsichtbar.
   *
   * `15-08` oder `15.08.` passt auf keinen Datumsschlüssel und bewirkt
   * schlicht nichts: Die App verlangte am Feiertag Gebühren, und in der
   * Konfiguration stünde ein Eintrag, der aussieht, als sei die Sache
   * erledigt.
   */
  it('refuses a malformed extra date instead of quietly ignoring it', () => {
    expect(() => holidaysFor('BY', 2026, ['15-08'])).toThrow(/15-08/)
    expect(() => holidaysFor('BY', 2026, ['15.08.'])).toThrow(/MM-TT/)
    expect(() => holidaysFor('BY', 2026, ['2026-08-15'])).toThrow(/MM-TT/)
    expect(() => holidaysFor('BY', 2026, ['13-01'])).toThrow(/MM-TT/)
  })

  it('detects a city holiday from a wall-clock reading', () => {
    // 15. August 2026, 10:00 Münchner Zeit.
    const clock = berlinWallClock(Date.UTC(2026, 7, 15, 8, 0))
    expect(isHoliday('BY', clock)).toBe(false)
    expect(isHoliday('BY', clock, ['08-15'])).toBe(true)
  })

  // Ein Land ohne hinterlegten Kalender darf nicht als "keine Feiertage"
  // durchgehen: Das hiesse, an Karfreitag zum Zahlen aufzufordern, und zwar
  // ohne dass irgendwo etwas nach einem Fehler aussieht.
  it('throws for a Land that has no table yet, rather than returning nothing', () => {
    // Sachsen statt Bayern, seit München dazugehört. Sachsen ist auch der
    // bessere Platzhalter: Dort ist der Buß- und Bettag gesetzlicher Feiertag
    // und Fronleichnam gemeindeweise — zwei Formen, die diese Tabelle noch
    // nicht kann.
    expect(() => holidaysFor('SN' as Land, 2026)).toThrow(/SN/)
  })
})
