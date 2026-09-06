/**
 * Freitext-Rückmeldungen — die heikelste Datenart in dieser App.
 *
 * Alles andere hier ist eine Zahl oder eine Kategorie: gerundete Koordinaten,
 * Zähler, ein Kalendertag. Freitext von Fremden ist etwas anderes. Er kann
 * Namen, Kennzeichen oder Adressen enthalten — weil Leute so schreiben, nicht
 * weil danach gefragt wird — und er ist der einzige Inhalt, den ein Fremder in
 * fremde Augen bekommt.
 *
 * **Deshalb gibt es das Formular nur mit eigenem Server.** Das Formular sagt zu,
 * dass niemand außer dem Betreiber mitliest. Im Artifact-Speicher lässt sich das
 * nicht ausdrücken: Dessen Regeln verlangen, dass Lesen nie strenger ist als
 * Schreiben, ein Briefkasten für alle mit einem einzigen Leser ist dort also
 * unmöglich, und `{self}`-Unterbäume sind selbst vor dem Betreiber privat. Der
 * Worker kann es, indem es schlicht keinen Lese-Endpunkt gibt — also existiert
 * die Funktion dort und sonst nirgends. Eine Zusage, die die Ablage nicht hält,
 * wäre schlechter als eine fehlende Funktion.
 */

import { tidyFeedback, type FeedbackKind } from '@parkingzone/core'

export { MAX_FEEDBACK_LENGTH, type FeedbackKind } from '@parkingzone/core'

export interface FeedbackBackend {
  send: (kind: FeedbackKind, text: string) => Promise<void>
}

export function openFeedback(): FeedbackBackend | null {
  const apiBase = import.meta.env.VITE_API_BASE as string | undefined
  if (typeof apiBase !== 'string' || apiBase.length === 0) return null
  const base = apiBase.replace(/\/+$/, '')

  return {
    send: async (kind, text) => {
      const response = await fetch(`${base}/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind, text: tidyFeedback(text) }),
        signal: AbortSignal.timeout(10_000),
      })
      if (!response.ok) {
        throw new Error(
          response.status === 429
            ? 'zu viele Rückmeldungen in kurzer Zeit'
            : `HTTP ${response.status}`,
        )
      }
    },
  }
}
