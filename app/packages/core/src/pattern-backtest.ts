import { fitModel, type PatternParams, type PatternRow, DEFAULT_PATTERN_PARAMS } from './pattern.js'
import { quarterBefore, quarterIndex } from './quarter.js'

/**
 * Der Rückwärtstest: Taugt das Modell, oder rät es?
 *
 * Für das letzte abgeschlossene Quartal Q* wird das Modell aus allen
 * Quartalen davor gerechnet und gegen die Fenster von Q* bewertet — Brier-
 * Score gegen zwei Basislinien (konstante Stadtrate, Stadtprofil je
 * Wochenstunde). Erst wenn der Skill gegen das Profil positiv ist, weiss
 * das Modell über eine Zone mehr als über die Stadt; vorher zeigt die App
 * Stufen und Zahlen („in 5 von 16 Dienstagen"), aber keine Prozente.
 */
export interface BacktestResult {
  quarter: string
  /** Bewertete Fenster (Σ n über alle Zellen und Einheiten). */
  windows: number
  brier: number
  brierBase: number
  brierProfile: number
  skill: number
  skillProfile: number
  /** Fünf Eimer: [vorhergesagt, beobachtet, Anzahl]. */
  calibration: [number, number, number][]
}

export interface BacktestInput {
  rows: readonly PatternRow[]
  observed: Readonly<Record<string, readonly number[]>>
  currentQuarter: string
}

const BUCKETS = [0.01, 0.03, 0.1, 0.3, 1.01]
const clamp = (p: number): number => Math.min(1 - 1e-4, Math.max(1e-4, p))

export function backtest(input: BacktestInput, params: PatternParams = DEFAULT_PATTERN_PARAMS): BacktestResult | null {
  const target = quarterBefore(input.currentQuarter, 1)
  const targetDays = input.observed[target]
  if (targetDays === undefined) return null
  const training = input.rows.filter((row) => quarterIndex(row.quarter) < quarterIndex(target))
  const evaluation = input.rows.filter((row) => row.quarter === target)
  if (training.length === 0 || evaluation.length === 0) return null

  const trainingObserved: Record<string, readonly number[]> = {}
  for (const [quarter, days] of Object.entries(input.observed)) {
    if (quarterIndex(quarter) < quarterIndex(target)) trainingObserved[quarter] = days
  }
  const unitCount = new Set([...training, ...evaluation].map((r) => r.unit)).size
  const model = fitModel({ rows: training, observed: trainingObserved, currentQuarter: target, unitCount }, params)

  const kByUnit = new Map<string, number[]>()
  for (const row of evaluation) {
    let k = kByUnit.get(row.unit)
    if (k === undefined) {
      k = new Array<number>(168).fill(0)
      kByUnit.set(row.unit, k)
    }
    k[row.weekday * 24 + row.hour] = (k[row.weekday * 24 + row.hour] ?? 0) + row.slots
  }
  const units = new Set([...kByUnit.keys(), ...model.units.keys()])

  let sumN = 0
  let brier = 0
  let brierBase = 0
  let brierProfile = 0
  const buckets = BUCKETS.map(() => ({ predicted: 0, observed: 0, n: 0 }))
  for (const unit of units) {
    const k = kByUnit.get(unit)
    for (let cell = 0; cell < 168; cell += 1) {
      const n = targetDays[Math.floor(cell / 24)] ?? 0
      if (n <= 0) continue
      const kc = Math.min(n, k?.[cell] ?? 0)
      const p = clamp(model.rateFor(unit, cell))
      const pBase = clamp(model.base)
      const pProfile = clamp(model.profile[cell] ?? 0)
      sumN += n
      brier += kc * (1 - p) ** 2 + (n - kc) * p ** 2
      brierBase += kc * (1 - pBase) ** 2 + (n - kc) * pBase ** 2
      brierProfile += kc * (1 - pProfile) ** 2 + (n - kc) * pProfile ** 2
      const bucket = buckets[BUCKETS.findIndex((limit) => p < limit)]
      if (bucket !== undefined) {
        bucket.predicted += p * n
        bucket.observed += kc
        bucket.n += n
      }
    }
  }
  if (sumN === 0) return null
  const round = (v: number): number => Math.round(v * 10_000) / 10_000
  return {
    quarter: target,
    windows: sumN,
    brier: round(brier / sumN),
    brierBase: round(brierBase / sumN),
    brierProfile: round(brierProfile / sumN),
    skill: round(brierBase > 0 ? 1 - brier / brierBase : 0),
    skillProfile: round(brierProfile > 0 ? 1 - brier / brierProfile : 0),
    calibration: buckets.map((b) => [
      b.n > 0 ? round(b.predicted / b.n) : 0,
      b.n > 0 ? round(b.observed / b.n) : 0,
      b.n,
    ]),
  }
}
