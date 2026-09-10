/**
 * Die regularisierte unvollständige Betafunktion und ihre Umkehrung — für
 * die Quantile der Beta-Verteilung in `pattern.ts`. Die Normalnäherung
 * versagt bei `α < 1`, und genau dort liegen stille Zonen.
 *
 * Kettenbruch nach Numerical Recipes (`betacf`), Lanczos für `lnΓ`. Gegen
 * Tabellenwerte geprüft in `test/beta.test.ts`.
 */
const LANCZOS = [
  76.18009172947146, -86.50532032941677, 24.01409824083091, -1.231739572450155,
  0.1208650973866179e-2, -0.5395239384953e-5,
]

export function lnGamma(x: number): number {
  if (!(x > 0)) throw new RangeError(`lnGamma braucht x > 0, bekam ${x}`)
  let y = x
  const tmp = x + 5.5 - (x + 0.5) * Math.log(x + 5.5)
  let ser = 1.000000000190015
  for (const coefficient of LANCZOS) {
    y += 1
    ser += coefficient / y
  }
  return -tmp + Math.log((2.5066282746310005 * ser) / x)
}

function betacf(a: number, b: number, x: number): number {
  const MAXIT = 300
  const EPS = 3e-14
  const FPMIN = 1e-300
  const qab = a + b
  const qap = a + 1
  const qam = a - 1
  let c = 1
  let d = 1 - (qab * x) / qap
  if (Math.abs(d) < FPMIN) d = FPMIN
  d = 1 / d
  let h = d
  for (let m = 1; m <= MAXIT; m += 1) {
    const m2 = 2 * m
    let aa = (m * (b - m) * x) / ((qam + m2) * (a + m2))
    d = 1 + aa * d
    if (Math.abs(d) < FPMIN) d = FPMIN
    c = 1 + aa / c
    if (Math.abs(c) < FPMIN) c = FPMIN
    d = 1 / d
    h *= d * c
    aa = (-(a + m) * (qab + m) * x) / ((a + m2) * (qap + m2))
    d = 1 + aa * d
    if (Math.abs(d) < FPMIN) d = FPMIN
    c = 1 + aa / c
    if (Math.abs(c) < FPMIN) c = FPMIN
    d = 1 / d
    const del = d * c
    h *= del
    if (Math.abs(del - 1) < EPS) break
  }
  return h
}

/** `I_x(a, b)`: Verteilungsfunktion der Beta(a, b) an der Stelle x. */
export function betaCdf(x: number, a: number, b: number): number {
  if (!(a > 0) || !(b > 0)) throw new RangeError(`Beta braucht a, b > 0, bekam ${a}, ${b}`)
  if (Number.isNaN(x)) throw new RangeError('betaCdf: x ist NaN')
  if (x <= 0) return 0
  if (x >= 1) return 1
  const bt = Math.exp(
    lnGamma(a + b) - lnGamma(a) - lnGamma(b) + a * Math.log(x) + b * Math.log(1 - x),
  )
  if (x < (a + 1) / (a + b + 2)) return (bt * betacf(a, b, x)) / a
  return 1 - (bt * betacf(b, a, 1 - x)) / b
}

/**
 * Das p-Quantil der Beta(a, b).
 *
 * Bisektion im Logarithmus von x, nicht in x selbst: Bei `a = 0,06` (eine
 * stille Zone) liegt das 5-%-Quantil bei 10⁻²², und eine Bisektion in x
 * bricht bei 10⁻¹³ ab, wo die Verteilungsfunktion schon auf 0,19 steht —
 * gefunden vom eigenen Test. Für p > 0,5 über die Spiegelung
 * `q(p, a, b) = 1 − q(1 − p, b, a)`, damit auch das obere Ende in der
 * feinen Hälfte gerechnet wird.
 */
export function betaQuantile(p: number, a: number, b: number): number {
  if (!(p >= 0 && p <= 1)) throw new RangeError(`Quantil braucht p in [0, 1], bekam ${p}`)
  if (p === 0) return 0
  if (p === 1) return 1
  if (p > 0.5) return 1 - betaQuantile(1 - p, b, a)
  let lo = -745
  let hi = 0
  for (let i = 0; i < 200; i += 1) {
    const mid = (lo + hi) / 2
    if (betaCdf(Math.exp(mid), a, b) < p) lo = mid
    else hi = mid
    if (hi - lo < 1e-12) break
  }
  return Math.exp((lo + hi) / 2)
}
