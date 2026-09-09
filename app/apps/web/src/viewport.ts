/**
 * Die Bildschirmtastatur, als CSS-Variablen.
 *
 * Auf dem iPhone verkleinert die Tastatur nicht die Seite, sondern nur den
 * sichtbaren Ausschnitt: Ein Blatt mit `position: fixed; inset: 0` bleibt so
 * hoch wie vorher, und sein Fuß mit dem Absenden-Knopf liegt hinter der
 * Tastatur. Wer etwas geschrieben hat, muss die Tastatur erst wegtippen, um
 * es abzuschicken — und sieht bis dahin nicht, dass es einen Knopf gibt.
 *
 * `visualViewport` sagt, wie hoch der sichtbare Ausschnitt ist und wo er
 * beginnt. Beides steht hier als `--vv-height` und `--vv-top` am Wurzelelement;
 * das Blatt nimmt sie als Höhe und Oberkante, sobald sie gesetzt sind.
 *
 * Android verhält sich seit Chrome 108 genauso, solange die Seite nichts
 * anderes sagt — `interactive-widget=resizes-content` in der Viewport-Angabe
 * lässt dort stattdessen die Seite schrumpfen. Dann bleibt die Differenz
 * unter der Schwelle, und die Variablen bleiben weg.
 */

/** Ab dieser Differenz gilt der Ausschnitt als von der Tastatur verkleinert. */
const KEYBOARD_THRESHOLD = 120

/** Wie viel die Tastatur vom Fenster verdeckt, oder 0 ohne Tastatur. */
export function keyboardInset(innerHeight: number, viewportHeight: number): number {
  const inset = Math.round(innerHeight - viewportHeight)
  return inset > KEYBOARD_THRESHOLD ? inset : 0
}

export function watchKeyboard(): void {
  const viewport = window.visualViewport
  if (viewport === null || viewport === undefined) return
  const root = document.documentElement.style
  const apply = (): void => {
    if (keyboardInset(window.innerHeight, viewport.height) === 0) {
      root.removeProperty('--vv-height')
      root.removeProperty('--vv-top')
      return
    }
    root.setProperty('--vv-height', `${Math.round(viewport.height)}px`)
    root.setProperty('--vv-top', `${Math.round(viewport.offsetTop)}px`)
  }
  viewport.addEventListener('resize', apply)
  viewport.addEventListener('scroll', apply)
}
