import type { PatternLevel, UnitPattern } from './pattern.js'

/**
 * Sätze aus Stufen — was das Zonenblatt unter „Typisch hier" sagt.
 *
 * Die Wortwahl ist „gemeldet", nie „kontrolliert": Die Zahlen messen, wo
 * Nutzer melden, und das ist von „wo kontrolliert wird" nur so weit
 * entfernt, wie die Nutzer verteilt sind.
 */
const WEEKDAYS_ADVERB = ['sonntags', 'montags', 'dienstags', 'mittwochs', 'donnerstags', 'freitags', 'samstags']
const WEEKDAYS_PLURAL = ['Sonntagen', 'Montagen', 'Dienstagen', 'Mittwochen', 'Donnerstagen', 'Freitagen', 'Samstagen']

export const LEVEL_WORDS: Record<PatternLevel, string> = {
  0: 'zu wenig Daten',
  1: 'ruhig',
  2: 'üblich',
  3: 'häufig',
}

/** Zusammenhängende Stundenbereiche einer Stufe an einem Wochentag, als „9–12 Uhr". */
export function hourRanges(levels: readonly PatternLevel[], weekday: number, level: PatternLevel): string[] {
  const ranges: string[] = []
  let start: number | null = null
  for (let hour = 0; hour <= 24; hour += 1) {
    const on = hour < 24 && levels[weekday * 24 + hour] === level
    if (on && start === null) start = hour
    if (!on && start !== null) {
      ranges.push(`${start}–${hour} Uhr`)
      start = null
    }
  }
  return ranges
}

const capitalise = (word: string): string => word.charAt(0).toUpperCase() + word.slice(1)

export interface PatternSentence {
  /** Der Satz über den Wochentag: „Dienstags meist 9–12 Uhr gemeldet." */
  day: string
  /** Der Satz über die Stunde: „Jetzt: häufig — in 5 von 16 Dienstagen um 10 Uhr gemeldet." */
  now: string
  level: PatternLevel
}

/**
 * @param unit Das Muster der Einheit, oder null, wenn die Stadt für sie keins hat.
 * @param n Beobachtete Wochen je Wochentag (aus dem Stadtstand).
 */
export function patternSentence(
  unit: UnitPattern | null,
  weekday: number,
  hour: number,
  n: readonly number[],
): PatternSentence {
  const adverb = WEEKDAYS_ADVERB[weekday] ?? 'werktags'
  const plural = WEEKDAYS_PLURAL[weekday] ?? 'Tagen'
  const weeks = Math.round(n[weekday] ?? 0)
  if (unit === null) {
    return {
      day: `Für diese Zone liegt noch kein Muster vor.`,
      now: weeks < 4 ? 'Zu wenig Daten.' : `In ${weeks} ${plural} wurde hier nichts gemeldet.`,
      level: 0,
    }
  }
  const cell = weekday * 24 + hour
  const level = unit.levels[cell] ?? 0
  const k = unit.k[cell] ?? 0
  if (level === 0) {
    return {
      day: `Zu wenig Daten für ein Muster an ${capitalise(plural)}.`,
      now: 'Zu wenig Daten.',
      level,
    }
  }
  const busy = hourRanges(unit.levels, weekday, 3)
  const quiet = hourRanges(unit.levels, weekday, 1)
  const day =
    busy.length > 0
      ? `${capitalise(adverb)} meist ${busy.join(' und ')} gemeldet${quiet.length > 0 ? `, ${quiet.join(' und ')} selten` : ''}.`
      : quiet.length > 0
        ? `${capitalise(adverb)} keine Häufung; ${quiet.join(' und ')} selten gemeldet.`
        : `${capitalise(adverb)} keine Häufung — gemeldet wird hier wie überall in der Stadt.`
  const kText = Number.isInteger(k) ? String(k) : k.toFixed(1).replace('.', ',')
  const now = `Jetzt: ${LEVEL_WORDS[level]} — in ${kText} von ${weeks} ${plural} um ${hour} Uhr gemeldet.`
  return { day, now, level }
}
