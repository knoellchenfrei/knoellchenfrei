/**
 * Die Langzeitmuster je Stadt — die Seite, auf der man sieht, ob das Modell
 * etwas taugt, bevor es jemand glaubt: seit wann geerntet wird, wie viele
 * Fenster, wie viel davon schon eine Stufe trägt, und der Rückwärtstest
 * (Brier-Skill gegen die Stadtrate; erst über null weiss das Modell über
 * eine Zone mehr als über die Stadt).
 */
export interface MusterStand {
  since: string | null
  cityWindows: number
  n: number[]
  units: Record<string, { levels: number[]; windows: number }>
  guete: { quarter: string; skill: number; skillProfile: number; brier: number; windows: number } | null
}

export function musterZeile(name: string, stand: MusterStand | null): string {
  if (stand === null || stand.since === null) return `${name}: noch keine Ernte.`
  const einheiten = Object.values(stand.units)
  const mitStufe = einheiten.filter((u) => u.levels.some((l) => l > 0)).length
  const seit = new Date(`${stand.since}T12:00:00`).toLocaleDateString('de-DE')
  const wochen = Math.round(Math.max(...stand.n, 0))
  const teile = [
    `seit ${seit}`,
    `${stand.cityWindows} Fenster`,
    `${einheiten.length} Einheiten mit Meldungen, ${mitStufe} davon mit Stufe`,
    `bis ${wochen} beobachtete Wochen je Wochentag`,
  ]
  if (stand.guete !== null) {
    teile.push(
      `Rückwärtstest ${stand.guete.quarter}: Skill ${stand.guete.skill.toLocaleString('de-DE', { maximumFractionDigits: 2 })} gegen die Stadtrate, ${stand.guete.skillProfile.toLocaleString('de-DE', { maximumFractionDigits: 2 })} gegen das Stadtprofil`,
    )
  } else {
    teile.push('Rückwärtstest erst nach zwei abgeschlossenen Quartalen')
  }
  return `${name}: ${teile.join(' · ')}.`
}

