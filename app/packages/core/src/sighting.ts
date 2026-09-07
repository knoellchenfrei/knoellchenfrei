/**
 * Confidence model for crowdsourced enforcement sightings.
 *
 * Modelled on blitzer.de's mechanic (report -> peer confirmation -> star rating
 * -> automatic expiry) rather than FreiFahren's, because sightings land on free
 * coordinates instead of nodes in a transit graph: there is no line to project a
 * direction onto, so peer confirmation is the only signal we have.
 *
 * blitzer.de backs its ratings with a human editorial team. We have none, so the
 * score itself has to carry the plausibility check: a lone report never counts as
 * confirmed, and everything decays to nothing on its own.
 */

/** A single reported sighting, as stored. */
export interface Sighting {
  id: string
  lat: number
  lon: number
  /** Epoch ms of the original report. */
  reportedAt: number
  /** Peers who saw the same thing at this spot. */
  confirmations: number
  /** Peers who looked and saw nothing. */
  disputes: number
}

export interface ConfidenceOptions {
  /** Evaluation time, epoch ms. Injected so the model stays pure and testable. */
  now: number
  /**
   * Time after which a sighting's evidence counts half as much.
   * 30 min is deliberately shorter than blitzer.de's mobile-camera window: a
   * parking warden on foot moves on faster than a speed trap does.
   */
  halfLifeMs?: number
  /**
   * Hard cutoff. Past this age a sighting is dropped regardless of how many
   * confirmations it collected — we keep no history of where officials were.
   */
  maxAgeMs?: number
}

export const DEFAULT_HALF_LIFE_MS = 30 * 60 * 1000
export const DEFAULT_MAX_AGE_MS = 90 * 60 * 1000

/**
 * Above this a sighting is shown as confirmed.
 *
 * Not a round 0.6: the common "two peers agree, one disagrees" case lands on
 * exactly 3/5, and a threshold sitting on top of a frequent value decides real
 * reports by float comparison. 0.62 keeps that case clearly on the unconfirmed
 * side while a single clean confirmation (2/3) still promotes.
 */
export const CONFIRMED_THRESHOLD = 0.62
/** Below this it is not shown at all. */
export const VISIBLE_THRESHOLD = 0.25

export type SightingStatus = 'confirmed' | 'unconfirmed' | 'expired'

export interface Confidence {
  /** 0..1, evidence weighted by age. */
  score: number
  status: SightingStatus
  /** 0..3, mirrors blitzer.de's star display. */
  stars: 0 | 1 | 2 | 3
  ageMs: number
}

/**
 * Laplace-smoothed agreement ratio.
 *
 * A fresh report with no peer feedback yields 0.5 rather than 1.0, which is the
 * point: it enters as a maybe, not as fact. Two independent confirmations push it
 * to 0.75 and over the confirmed threshold; a single dispute drops it back under.
 */
function evidence(confirmations: number, disputes: number): number {
  // Clamped because these arrive from other people's clients. A negative
  // dispute count produced a score above 1 — "confirmed" without a single
  // confirmation — and a non-finite one produced NaN, which made the sort in
  // activeSightings non-deterministic.
  const yes = Number.isFinite(confirmations) ? Math.max(0, Math.min(1e6, confirmations)) : 0
  const no = Number.isFinite(disputes) ? Math.max(0, Math.min(1e6, disputes)) : 0
  return (yes + 1) / (yes + no + 2)
}

/** Exponential decay, halving every `halfLifeMs`. */
function decay(ageMs: number, halfLifeMs: number): number {
  return Math.pow(0.5, ageMs / halfLifeMs)
}

/**
 * Clock skew we accept on a report. Beyond this the timestamp is not a slow
 * clock, it is a claim about the future.
 */
const FUTURE_TOLERANCE_MS = 60_000

export function confidenceOf(sighting: Sighting, options: ConfidenceOptions): Confidence {
  const halfLifeMs = options.halfLifeMs ?? DEFAULT_HALF_LIFE_MS
  const maxAgeMs = options.maxAgeMs ?? DEFAULT_MAX_AGE_MS
  // Ein `reportedAt`, das keine endliche Zahl ist, ergab `ageMs: NaN` und
  // `score: NaN`. Der Status fiel dabei zufällig richtig aus — jeder Vergleich
  // mit NaN ist falsch, also landete er auf 'expired' —, aber die zugesicherte
  // Spanne 0..1 galt nicht mehr, und `ageMs` war in der Ausgabe unbrauchbar.
  // Gefunden beim Beschuss mit Zufallswerten. Unlesbar alt ist die ehrliche
  // Lesart eines unlesbaren Zeitstempels, also unendlich alt.
  const rawAgeMs = Number.isFinite(sighting.reportedAt)
    ? options.now - sighting.reportedAt
    : Number.POSITIVE_INFINITY
  const ageMs = Math.max(0, rawAgeMs)

  // A timestamp in the future used to clamp to age zero and score near 1
  // forever — a permanent top-rated sighting that no number of disputes could
  // clear. Reports are written by other people, so this is reachable input,
  // not a hypothetical.
  const expired = ageMs >= maxAgeMs || rawAgeMs < -FUTURE_TOLERANCE_MS

  const score = expired
    ? 0
    : evidence(sighting.confirmations, sighting.disputes) * decay(ageMs, halfLifeMs)

  return { score, status: statusOf(score), stars: starsOf(score), ageMs }
}

function statusOf(score: number): SightingStatus {
  if (score >= CONFIRMED_THRESHOLD) return 'confirmed'
  if (score >= VISIBLE_THRESHOLD) return 'unconfirmed'
  return 'expired'
}

function starsOf(score: number): 0 | 1 | 2 | 3 {
  if (score >= CONFIRMED_THRESHOLD) return 3
  if (score >= 0.45) return 2
  if (score >= VISIBLE_THRESHOLD) return 1
  return 0
}

/**
 * Sightings worth rendering, strongest first.
 *
 * Expired ones are dropped here rather than filtered by the caller so that no
 * code path can accidentally surface a stale location.
 */
export function activeSightings(sightings: readonly Sighting[], options: ConfidenceOptions) {
  return sightings
    .map((sighting) => ({ sighting, confidence: confidenceOf(sighting, options) }))
    .filter((entry) => entry.confidence.status !== 'expired')
    .sort((a, b) => b.confidence.score - a.confidence.score)
}
