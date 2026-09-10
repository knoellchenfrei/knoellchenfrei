import { betaQuantile } from './beta.js'
import { quarterIndex } from './quarter.js'

/**
 * Langzeitmuster der Kontrollen: aus Zeitfenster-Zählern je (Einheit,
 * Wochentag, Stunde, Quartal) eine geglättete Rate und eine Stufe je
 * Wochenstunde.
 *
 * Warum nicht einfach zählen: Die Zelle „Zone × Wochentag × Stunde" hat bei
 * 20 Meldungen am Tag nach einem Jahr 0,8 Meldungen — sie bleibt leer, egal
 * wie lange man aufbewahrt. Verlässlichkeit kommt aus der Hierarchie: Die
 * Stadt hat ein Wochenprofil, jede Einheit einen Faktor dazu, jeder
 * Tagesabschnitt der Einheit einen weiteren, und die Zelle selbst zieht das
 * mit ihren wenigen Fenstern nach oben oder unten — Beta-Binomial gegen den
 * multiplikativen Prior. Fünf benannte Parameter, alle über den
 * Rückwärtstest (`pattern-backtest.ts`) zu setzen, keiner versteckt.
 *
 * Gezählt werden **Fenster**, nicht Meldungen: „An k von n Dienstagen wurde
 * um 10 Uhr gemeldet." Drei Leute, die denselben Beamten sehen, sind ein
 * Ereignis; ein Vielmelder kann eine Wochenstunde je Woche höchstens einmal
 * belegen.
 */
export interface PatternRow {
  unit: string
  quarter: string
  weekday: number
  hour: number
  slots: number
  reports: number
  confirmed: number
  disputed: number
  weight: number
}

export interface PatternParams {
  /** Halbwertszeit in Quartalen: Ein zwei Quartale altes Fenster wiegt halb. */
  halfLifeQuarters: number
  /** Pseudo-Wochen hinter dem Stadtprofil je Wochenstunde. */
  m2: number
  /** Pseudo-Ereignisse hinter dem Einheitsfaktor. */
  m3: number
  /** Pseudo-Ereignisse hinter dem Abschnittsfaktor. */
  m4: number
  /** Pseudo-Beobachtungen hinter der Zelle. */
  m5: number
  /** Unter so vielen beobachteten Wochen je Wochentag gibt es keine Stufe. */
  minWeeks: number
  /** Unter so vielen (verfallgewichteten) Fenstern der Stadt gibt es keine Stufe. */
  minCityWindows: number
}

export const DEFAULT_PATTERN_PARAMS: PatternParams = {
  halfLifeQuarters: 2,
  m2: 20,
  m3: 5,
  m4: 3,
  m5: 6,
  minWeeks: 4,
  minCityWindows: 50,
}

export interface PatternInput {
  rows: readonly PatternRow[]
  /** Beobachtete Tage je Quartal und Wochentag (Sonntag = 0), aus `observedDays`. */
  observed: Readonly<Record<string, readonly number[]>>
  /** Das laufende Quartal — Bezugspunkt des Verfalls. */
  currentQuarter: string
  /** Wie viele Einheiten die Stadt hat, auch stille — der Nenner der Basisrate. */
  unitCount: number
}

/** 0 = zu wenig Daten, 1 = ruhig, 2 = üblich, 3 = häufig. */
export type PatternLevel = 0 | 1 | 2 | 3

export interface UnitPattern {
  /** Je Wochenstunde (Wochentag × 24 + Stunde) die Stufe. */
  levels: PatternLevel[]
  /** Je Wochenstunde die verfallgewichteten belegten Fenster, gerundet. */
  k: number[]
  /** Je Wochenstunde die geglättete Rate in Promille. */
  p: number[]
  factor: number
  /** Belegte Fenster der Einheit, ungewichtet. */
  windows: number
  reports: number
  /** Anteil bestätigter Meldungen, oder null unter 20 Meldungen. */
  confirmedShare: number | null
}

export interface PatternResult {
  /** Die typische Wochenstunde der Stadt: Anteil belegter Fenster. */
  base: number
  /** Stadtprofil je Wochenstunde, 7 × 24. */
  profile: number[]
  /** Verfallgewichtete beobachtete Wochen je Wochentag, gerundet. */
  n: number[]
  /** Verfallgewichtete Fenster der ganzen Stadt. */
  cityWindows: number
  units: Record<string, UnitPattern>
}

const HOURS = 24
const CELLS = 7 * HOURS

/** Tagesart: 0 Werktag, 1 Samstag, 2 Sonntag/Feiertag. */
const dayKind = (weekday: number): number => (weekday === 0 ? 2 : weekday === 6 ? 1 : 0)
/** Tagesabschnitt nach den häufigsten Bewirtschaftungsfenstern: 9, 13, 18. */
const daySection = (hour: number): number => (hour < 9 ? 0 : hour < 13 ? 1 : hour < 18 ? 2 : 3)
const sectionOf = (cell: number): number => dayKind(Math.floor(cell / HOURS)) * 4 + daySection(cell % HOURS)

export function decayWeight(quarter: string, currentQuarter: string, halfLifeQuarters: number): number {
  const delta = quarterIndex(currentQuarter) - quarterIndex(quarter)
  if (delta < 0) return 0
  return Math.pow(0.5, delta / halfLifeQuarters)
}

/**
 * Innere Rechnung ohne Stufen — auch der Rückwärtstest braucht sie, mit
 * einem anderen Bezugsquartal.
 */
export interface FittedModel {
  base: number
  profile: number[]
  n: number[]
  cityWindows: number
  /** Je Einheit die Rate je Wochenstunde und die Posterior-Parameter. */
  units: Map<string, { k: number[]; alpha: number[]; beta: number[]; factor: number }>
  /** Rate einer Einheit ohne eigene Zeilen: das Stadtprofil. */
  rateFor(unit: string, cell: number): number
}

export function fitModel(input: PatternInput, params: PatternParams = DEFAULT_PATTERN_PARAMS): FittedModel {
  const n = new Array<number>(7).fill(0)
  for (const [quarter, days] of Object.entries(input.observed)) {
    const w = decayWeight(quarter, input.currentQuarter, params.halfLifeQuarters)
    for (let d = 0; d < 7; d += 1) n[d] = (n[d] ?? 0) + w * (days[d] ?? 0)
  }
  const nAll = n.reduce((s, v) => s + v, 0)

  const perUnit = new Map<string, number[]>()
  const cityK = new Array<number>(CELLS).fill(0)
  let cityWindows = 0
  for (const row of input.rows) {
    if (row.weekday < 0 || row.weekday > 6 || row.hour < 0 || row.hour > 23) continue
    const w = decayWeight(row.quarter, input.currentQuarter, params.halfLifeQuarters)
    if (w === 0) continue
    const cell = row.weekday * HOURS + row.hour
    let k = perUnit.get(row.unit)
    if (k === undefined) {
      k = new Array<number>(CELLS).fill(0)
      perUnit.set(row.unit, k)
    }
    k[cell] = (k[cell] ?? 0) + w * row.slots
    cityK[cell] = (cityK[cell] ?? 0) + w * row.slots
    cityWindows += w * row.slots
  }

  const U = Math.max(1, input.unitCount)
  const base = nAll > 0 ? cityWindows / (U * nAll * HOURS) : 0
  const profile = new Array<number>(CELLS).fill(0)
  for (let cell = 0; cell < CELLS; cell += 1) {
    const nw = n[Math.floor(cell / HOURS)] ?? 0
    profile[cell] = ((cityK[cell] ?? 0) + params.m2 * base) / (U * nw + params.m2)
  }

  const units = new Map<string, { k: number[]; alpha: number[]; beta: number[]; factor: number }>()
  for (const [unit, k] of perUnit) {
    let observedTotal = 0
    let expectedTotal = 0
    for (let cell = 0; cell < CELLS; cell += 1) {
      observedTotal += k[cell] ?? 0
      expectedTotal += (profile[cell] ?? 0) * (n[Math.floor(cell / HOURS)] ?? 0)
    }
    const factor = (observedTotal + params.m3) / (expectedTotal + params.m3)

    const sectionObserved = new Array<number>(12).fill(0)
    const sectionExpected = new Array<number>(12).fill(0)
    for (let cell = 0; cell < CELLS; cell += 1) {
      const s = sectionOf(cell)
      sectionObserved[s] = (sectionObserved[s] ?? 0) + (k[cell] ?? 0)
      sectionExpected[s] =
        (sectionExpected[s] ?? 0) + (profile[cell] ?? 0) * factor * (n[Math.floor(cell / HOURS)] ?? 0)
    }

    const alpha = new Array<number>(CELLS).fill(0)
    const beta = new Array<number>(CELLS).fill(0)
    for (let cell = 0; cell < CELLS; cell += 1) {
      const s = sectionOf(cell)
      const g = ((sectionObserved[s] ?? 0) + params.m4) / ((sectionExpected[s] ?? 0) + params.m4)
      const p0 = Math.min(0.9, (profile[cell] ?? 0) * factor * g)
      const kc = k[cell] ?? 0
      const nw = n[Math.floor(cell / HOURS)] ?? 0
      alpha[cell] = params.m5 * p0 + kc
      beta[cell] = params.m5 * (1 - p0) + Math.max(0, nw - kc)
    }
    units.set(unit, { k, alpha, beta, factor })
  }

  return {
    base,
    profile,
    n,
    cityWindows,
    units,
    rateFor(unit, cell) {
      const fitted = units.get(unit)
      if (fitted === undefined) return profile[cell] ?? 0
      const a = fitted.alpha[cell] ?? 0
      const b = fitted.beta[cell] ?? 0
      return a + b > 0 ? a / (a + b) : profile[cell] ?? 0
    },
  }
}

/**
 * Die Stufe einer Zelle. Beide Fehlrichtungen sind teuer — falsch „ruhig"
 * heisst Knöllchen, falsch „häufig" ein bezahlter Schein zu viel —, deshalb
 * beide mit Quantilbedingung; was sie nicht schafft, ist ehrlich „üblich".
 */
export function levelOf(
  alpha: number,
  beta: number,
  base: number,
  weeks: number,
  cityWindows: number,
  params: PatternParams = DEFAULT_PATTERN_PARAMS,
): PatternLevel {
  if (weeks < params.minWeeks || cityWindows < params.minCityWindows) return 0
  if (base <= 0 || alpha <= 0 || beta <= 0) return 2
  const p = alpha / (alpha + beta)
  if (p < 0.5 * base && betaQuantile(0.8, alpha, beta) < base) return 1
  if (p > 2 * base && betaQuantile(0.2, alpha, beta) > base) return 3
  return 2
}

export function fitPatterns(input: PatternInput, params: PatternParams = DEFAULT_PATTERN_PARAMS): PatternResult {
  const model = fitModel(input, params)
  const totals = new Map<string, { windows: number; reports: number; confirmed: number }>()
  for (const row of input.rows) {
    const t = totals.get(row.unit) ?? { windows: 0, reports: 0, confirmed: 0 }
    t.windows += row.slots
    t.reports += row.reports
    t.confirmed += row.confirmed
    totals.set(row.unit, t)
  }

  const units: Record<string, UnitPattern> = {}
  for (const [unit, fitted] of model.units) {
    const levels: PatternLevel[] = []
    const k: number[] = []
    const p: number[] = []
    for (let cell = 0; cell < CELLS; cell += 1) {
      const a = fitted.alpha[cell] ?? 0
      const b = fitted.beta[cell] ?? 0
      const weeks = model.n[Math.floor(cell / HOURS)] ?? 0
      levels.push(levelOf(a, b, model.base, weeks, model.cityWindows, params))
      k.push(Math.round((fitted.k[cell] ?? 0) * 10) / 10)
      p.push(Math.round((a / (a + b)) * 1000))
    }
    const t = totals.get(unit) ?? { windows: 0, reports: 0, confirmed: 0 }
    units[unit] = {
      levels,
      k,
      p,
      factor: Math.round(fitted.factor * 100) / 100,
      windows: t.windows,
      reports: t.reports,
      confirmedShare: t.reports >= 20 ? Math.round((t.confirmed / t.reports) * 100) / 100 : null,
    }
  }

  return {
    base: model.base,
    profile: model.profile,
    n: model.n.map((v) => Math.round(v * 10) / 10),
    cityWindows: Math.round(model.cityWindows),
    units,
  }
}
