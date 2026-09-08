import { describe, expect, it } from 'vitest'

import { assertSelfContained, safeJson } from '../src/artifact-guards.js'

/**
 * Die ersten Tests in `packages/ingest`.
 *
 * Beide Funktionen haben einen Vorfall hinter sich, und beide scheitern auf
 * die stille Art: Die eine liess einmal eine **schwarze Seite** ausliefern,
 * die andere hält fremde Daten davon ab, das umgebende `<script>` zu
 * schliessen. Geprüft war bis zum 8. September keine von beiden — der
 * Kommentar über ihnen war die einzige Zusicherung, und ein Kommentar ist
 * keine.
 */

describe('assertSelfContained', () => {
  /**
   * Der Vorfall, wörtlich: Das Artifact wurde aus dem gewöhnlichen,
   * aufgeteilten Build gepackt. Dessen Einstieg importiert den MapLibre-Teil
   * relativ — und ein eingebettetes Modul hat keine Basisadresse, gegen die
   * sich das auflösen liesse. Gemeldet wurde es als „der Link ist einfach nur
   * schwarz".
   */
  it('hält den Bau an, wenn ein Bündel noch relativ importiert', () => {
    expect(() =>
      assertSelfContained('index.js', `import x from "./maplibre-DEADBEEF.js"\nx()`)
    ).toThrow(/still imports "\.\/maplibre-DEADBEEF\.js"/)
  })

  it('nennt den Ausweg, nicht nur den Fehler', () => {
    // Eine Fehlermeldung, die nur „geht nicht" sagt, kostet die nächste halbe
    // Stunde. `pnpm artifact` ist der ganze Unterschied.
    expect(() => assertSelfContained('index.js', 'import "./a.js"')).toThrow(/pnpm artifact/)
  })

  it('erkennt alle drei Schreibweisen eines Imports', () => {
    for (const quelle of [
      'import "./a.js"',
      'import x from "../b.js"',
      'const m = await import("./c.js")',
      "export { x } from './d.js'",
    ]) {
      expect(() => assertSelfContained('index.js', quelle), quelle).toThrow()
    }
  })

  it('lässt ein wirklich eigenständiges Bündel durch', () => {
    // Nackte Paketnamen kommen im gebauten Bündel nicht mehr vor; eine
    // Zeichenkette, die zufällig wie ein Pfad aussieht, ist kein Import.
    for (const quelle of [
      'const a = 1; console.log(a)',
      'const pfad = "./data/berlin/zones.geojson"',
      'fetch("./stats")',
      'const s = "import x from \\"./nope.js\\""',
    ]) {
      expect(() => assertSelfContained('index.js', quelle), quelle).not.toThrow()
    }
  })

  it('nimmt ein leeres Bündel hin, statt daran zu scheitern', () => {
    expect(() => assertSelfContained('leer.js', '')).not.toThrow()
  })
})

describe('safeJson', () => {
  /**
   * Der Grund für diese Funktion: Die eingebetteten Daten kommen aus einem
   * fremden Feed. Was heute keine spitze Klammer enthält, kann sie morgen
   * enthalten, und niemand fragt uns vorher.
   */
  it('lässt kein `</script>` stehen, das das Tag schliessen könnte', () => {
    const roh = { note: 'Ende</script><script>alert(1)</script>' }
    const aus = safeJson(roh)
    expect(aus).not.toContain('</script>')
    expect(aus).not.toContain('<script>')
  })

  it('maskiert jedes `<`, nicht nur die gefährliche Folge', () => {
    // Eine Prüfung auf `</script>` allein liesse sich über eine Feldgrenze
    // hinweg umgehen — ein einzelnes Zeichen kann man nicht aufteilen.
    const aus = safeJson({ a: '</scr', b: 'ipt>', c: 'a < b' })
    expect(aus).not.toContain('<')
    // Zwei spitze Klammern in der Eingabe, zwei Maskierungen in der Ausgabe.
    expect(aus.split('\\u003c').length - 1).toBe(2)
  })

  it('schliesst keinen HTML-Kommentar auf', () => {
    expect(safeJson({ x: '<!-- kommentar -->' })).not.toContain('-->')
  })

  it('bleibt gültiges JSON und liefert denselben Wert zurück', () => {
    // Die Maskierung ist eine JSON-Escape-Sequenz, kein Ersatz: Was der
    // Browser einliest, muss Zeichen für Zeichen das Original sein.
    const roh = { note: 'a</script>b', tief: { liste: [1, '<!--', null] }, uml: 'Straße' }
    expect(JSON.parse(safeJson(roh))).toEqual(roh)
  })

  /**
   * `JSON.stringify(undefined)` gibt **kein** JSON zurück, sondern
   * `undefined` — und `safeJson` wirft daran einen `TypeError`. Das ist beim
   * Schreiben dieser Tests aufgefallen und bleibt **mit Absicht** so.
   *
   * Der Ausweg wäre `?? 'null'`, und genau der wäre falsch: Der Aufrufer
   * bettet damit `null` ins Bündel, die App findet dort nichts, und niemand
   * erfährt warum. Genau diese Form — etwas fehlt, und die Auslieferung geht
   * trotzdem raus — hat in diesem Projekt schon die Karte für zwei Tage
   * gekostet. Ein Abbruch beim Bauen ist die richtige Antwort; erreichbar ist
   * der Fall heute ohnehin nicht, weil beide Aufrufer einen Wert liefern.
   */
  it('bricht bei `undefined` ab, statt still `null` einzubetten', () => {
    expect(() => safeJson(undefined)).toThrow(TypeError)
  })

  it('lässt ein einzelnes undefiniertes Feld weg, wie JSON es vorsieht', () => {
    expect(JSON.parse(safeJson({ a: undefined, b: 1 }))).toEqual({ b: 1 })
  })
})
