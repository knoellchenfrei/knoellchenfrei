/**
 * „Zuletzt genutzt" — die Städte, zwischen denen jemand wechselt.
 *
 * Für Pendler und Reisende: Wer zwischen zwei Städten pendelt, soll nicht
 * jedes Mal Land und Liste durchgehen (Betreiber, 18. September, nach dem
 * UX-Review zur Gesamtkarte). Gemerkt wird je Stadt der letzte Wechsel;
 * gezeigt werden höchstens drei, die aktuelle nicht — sie steht ja schon da.
 * Reine Rechnung ohne Speicher, damit sie in Node getestet werden kann; das
 * Lesen und Schreiben steht in `city.ts`.
 */
export interface Nutzung {
  key: string
  /** Zeitpunkt des letzten Wechsels in diese Stadt, Millisekunden seit 1970. */
  at: number
}

/** Wie viele Einträge der Speicher hält — mehr als gezeigt, damit ein alter nicht sofort weg ist. */
export const GEMERKT = 6
/** Wie viele Zeilen die Liste zeigt. */
export const GEZEIGT = 3

/** Einen Wechsel eintragen: neueste zuerst, jede Stadt einmal, begrenzt. */
export function merken(liste: readonly Nutzung[], key: string, at: number): Nutzung[] {
  const ohne = liste.filter((n) => n.key !== key)
  return [{ key, at }, ...ohne].sort((a, b) => b.at - a.at).slice(0, GEMERKT)
}

/** Was die Liste zeigt: ohne die aktuelle Stadt, neueste zuerst, höchstens drei. */
export function zuletztGenutzt(liste: readonly Nutzung[], aktuell: string): Nutzung[] {
  return [...liste]
    .filter((n) => n.key !== aktuell && Number.isFinite(n.at))
    .sort((a, b) => b.at - a.at)
    .slice(0, GEZEIGT)
}

/** „gerade eben", „heute", „gestern", „vor 3 Tagen", „vor 2 Wochen" — grob genug, um nichts zu versprechen. */
export function vorText(at: number, jetzt: number): string {
  const ms = jetzt - at
  if (ms < 60 * 60 * 1000) return 'gerade eben'
  const tagVon = (t: number): number => Math.floor(t / (24 * 60 * 60 * 1000))
  const tage = tagVon(jetzt) - tagVon(at)
  if (tage <= 0) return 'heute'
  if (tage === 1) return 'gestern'
  if (tage < 14) return `vor ${tage} Tagen`
  return `vor ${Math.floor(tage / 7)} Wochen`
}

/** Aus dem Speicher gelesen: nur, was wie ein Eintrag aussieht. */
export function nutzungenLesen(roh: unknown): Nutzung[] {
  if (!Array.isArray(roh)) return []
  return roh.filter(
    (n): n is Nutzung =>
      typeof n === 'object' && n !== null && typeof (n as Nutzung).key === 'string' && typeof (n as Nutzung).at === 'number'
  )
}
