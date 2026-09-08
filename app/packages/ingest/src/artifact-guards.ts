/**
 * Die beiden Wächter des Artifact-Baus — herausgelöst, damit sie prüfbar sind.
 *
 * Sie standen bis zum 8. September in `build-artifact.ts`, und das Modul liest
 * beim Import Dateien aus `dist`. Ein Test hätte also erst einen Build
 * gebraucht, um zwei reine Funktionen zu prüfen. Beide haben einen Vorfall
 * hinter sich, und beide scheitern auf die stille Art — deshalb war „nicht
 * getestet" hier teurer als anderswo.
 */

/**
 * Bricht ab, wenn ein Bündel noch einen **relativen** Import trägt.
 *
 * Der Vorfall: Das Artifact wurde einmal aus dem gewöhnlichen, aufgeteilten
 * Build gepackt. Dessen Einstiegsdatei importiert den MapLibre-Teil relativ —
 * und ein eingebettetes Modul hat keine Basisadresse, gegen die sich das
 * auflösen liesse. Der Browser weist den Bezeichner ab, die Seite bleibt
 * **schwarz**, und im Protokoll steht eine einzige Zeile. Gemeldet wurde es
 * als „der Link ist einfach nur schwarz".
 *
 * Geprüft wird auf `./` und `../` am Anfang des Bezeichners — nackte
 * Paketnamen (`import x from 'maplibre-gl'`) kommen im gebauten Bündel nicht
 * mehr vor, und eine absolute Adresse wäre ein anderes Problem.
 */
export function assertSelfContained(name: string, source: string): void {
  const specifier =
    /(?:\bfrom\s*|\bimport\s*\(\s*|\bimport\s+)["'](\.{1,2}\/[^"']+)["']/.exec(source)
  if (specifier) {
    throw new Error(
      `${name} still imports "${specifier[1]}" — the artifact must be one module. ` +
        'Run `pnpm artifact` from app/ instead of packing the ordinary build.',
    )
  }
}

/**
 * JSON, das gefahrlos in einem `<script>` stehen kann.
 *
 * `</script>` in einer Zeichenkette schliesst das umgebende Tag — der Rest der
 * Daten landet dann als Text im Dokument, und alles danach ist kaputtes HTML.
 * `<!--` eröffnet in einem klassischen Skript einen HTML-Kommentar. Beides
 * wird maskiert und nicht geglaubt, **weil die Daten aus einem fremden Feed
 * stammen**: Was heute keine spitze Klammer enthält, kann sie morgen enthalten,
 * und niemand fragt uns vorher.
 *
 * Maskiert wird jedes `<`, nicht nur die gefährliche Folge. Eine Prüfung auf
 * `</script>` allein liesse sich mit `</scr` + `ipt>` über eine Feldgrenze
 * hinweg umgehen; ein einzelnes Zeichen kann man nicht aufteilen.
 */
export function safeJson(value: unknown): string {
  return JSON.stringify(value).replace(/</g, '\\u003c').replace(/-->/g, '--\\u003e')
}
