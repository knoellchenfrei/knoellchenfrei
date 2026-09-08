import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const lies = (pfad: string): string =>
  readFileSync(fileURLToPath(new URL(pfad, import.meta.url)), 'utf8')

/**
 * Die Nachricht, mit der die Seite die wartende Version übernimmt.
 *
 * Es sind zwei Dateien, die sich auf eine Zeichenkette einigen müssen:
 * `src/pwa.ts` schickt `postMessage({ type: 'skip-waiting' })`, und
 * `src/sw-template.js` hört darauf. Beide sind für sich richtig, und keine
 * merkt es, wenn die andere umbenannt wird — der Knopf „Aktualisieren"
 * verschwindet dann nicht, er **tut nur nichts mehr**. Danach hängt jede
 * bereits installierte App auf ihrer alten Version, bis der Browser den
 * Worker von sich aus ersetzt.
 *
 * Genau die Form, an der dieses Projekt mehrfach hing: etwas meldet Erfolg
 * und bewirkt nichts. Deshalb steht der Name hier einmal ausgeschrieben, und
 * beide Seiten werden dagegen gehalten.
 */
const NACHRICHT = 'skip-waiting'

/** Block- und Zeilenkommentare heraus — sie erwähnen, was sie erklären. */
const ohneKommentare = (quelle: string): string =>
  quelle.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

describe('die Seite und der Service Worker einigen sich auf dieselbe Nachricht', () => {
  const pwa = lies('../src/pwa.ts')
  const sw = lies('../src/sw-template.js')

  it('pwa.ts schickt genau diese Nachricht', () => {
    expect(pwa).toContain(`postMessage({ type: '${NACHRICHT}' })`)
  })

  it('der Service Worker hört auf genau diese Nachricht', () => {
    expect(sw).toMatch(/addEventListener\('message'/)
    expect(sw).toContain(`event.data.type === '${NACHRICHT}'`)
    expect(sw).toContain('self.skipWaiting()')
  })

  it('der Worker aktiviert sich NICHT von selbst beim Installieren', () => {
    // Ein `skipWaiting()` im `install`-Ereignis zieht der laufenden Seite die
    // nachgeladenen Bündel weg — weisse Seite mitten in der Benutzung. Der
    // Aufruf darf nur im Nachrichten-Empfänger stehen.
    //
    // **Ohne `ohneKommentare` schlägt dieser Test auf Prosa an**: Direkt über
    // dem Nachrichten-Empfänger steht der Satz „Bewusst kein `skipWaiting()`
    // beim Installieren", und der stand beim ersten Anlauf im gesuchten
    // Bereich. Ein Wächter, der Kommentare für Code hält, meldet Fehler, die
    // es nicht gibt — und verdeckt damit die, die es gibt.
    const installBlock = /addEventListener\('install'[\s\S]*?addEventListener\('message'/.exec(
      ohneKommentare(sw),
    )
    expect(installBlock).not.toBeNull()
    expect(installBlock?.[0]).not.toContain('skipWaiting')
  })

  it('die Seite lädt erst neu, wenn der neue Worker das Ruder hat', () => {
    // `controllerchange` und nicht sofort: Ein Neuladen vor der Übernahme
    // holt noch einmal die alte Version.
    expect(pwa).toContain("addEventListener(\n    'controllerchange'")
    expect(pwa).toContain('window.location.reload()')
  })
})
