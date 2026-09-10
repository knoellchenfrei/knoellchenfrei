/**
 * Die Abzeichen als reine Funktion — herausgelöst aus `build-badges.ts`, damit
 * die eine Regel, die daran hängt, einen Test hat: **Ohne Messung wird das
 * Coverage-Abzeichen nicht angefasst.** Am 8. September ersetzte ein Lauf,
 * bei dem es nur um die Testzahl ging, die Abdeckung durch „unknown" — ein
 * Erfolg, der die einzige Zahl überschrieb, die niemand nachrechnet. Das
 * Skript daneben liest Umgebung und Dateisystem; hier steht, was daraus wird.
 */

/** Character widths at 11px DejaVu Sans; close enough to lay out a badge. */
export function textWidth(text: string): number {
  let width = 0
  for (const char of text) {
    if ('iljt.,:;\'!|'.includes(char)) width += 3.2
    else if ('fr('.includes(char)) width += 4.4
    else if ('mwMW%'.includes(char)) width += 9.5
    else if (char === ' ') width += 3.5
    else width += 6.6
  }
  return Math.ceil(width)
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/**
 * A two-part badge in the familiar shape: grey label, coloured value.
 * Rendered without gradients or external fonts so it stays legible in both
 * GitHub themes.
 */
export function badge(label: string, value: string, colour: string): string {
  const padding = 9
  const labelWidth = textWidth(label) + padding * 2
  const valueWidth = textWidth(value) + padding * 2
  const total = labelWidth + valueWidth

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${total}" height="20" role="img" aria-label="${escapeXml(label)}: ${escapeXml(value)}">
  <title>${escapeXml(label)}: ${escapeXml(value)}</title>
  <clipPath id="r"><rect width="${total}" height="20" rx="3" fill="#fff"/></clipPath>
  <g clip-path="url(#r)">
    <rect width="${labelWidth}" height="20" fill="#555"/>
    <rect x="${labelWidth}" width="${valueWidth}" height="20" fill="${colour}"/>
  </g>
  <g fill="#fff" text-anchor="middle" font-family="Verdana,DejaVu Sans,Geneva,sans-serif" font-size="11">
    <text x="${labelWidth / 2}" y="14">${escapeXml(label)}</text>
    <text x="${labelWidth + valueWidth / 2}" y="14">${escapeXml(value)}</text>
  </g>
</svg>
`
}

/** Green above 90, yellow-green above 80, amber above 70, red below. */
export function coverageColour(percent: number): string {
  if (percent >= 90) return '#3fb950'
  if (percent >= 80) return '#94b91e'
  if (percent >= 70) return '#d29922'
  return '#da3633'
}

export interface BadgeInput {
  /** Zeilenabdeckung in Prozent — oder null, wenn keine Messung vorliegt. */
  coveragePct: number | null
  testCount: string
  e2eCount: string
}

/** Name und SVG je Abzeichen; ohne Messung fehlt `coverage` in der Liste. */
export function badgesFuer({ coveragePct, testCount, e2eCount }: BadgeInput): [string, string][] {
  return [
    ['build', badge('build', 'passing', '#3fb950')],
    // Ohne gelaufene Messung wird das Abzeichen **nicht angefasst**, statt auf
    // „unknown" gesetzt zu werden. Ein Abzeichen, das man aus Versehen
    // verschlechtern kann, ist schlechter als eins, das stehen bleibt.
    ...(coveragePct === null
      ? []
      : ([['coverage', badge('coverage', `${coveragePct}%`, coverageColour(coveragePct))]] as [
          string,
          string,
        ][])),
    ['tests', badge('tests', testCount === '' ? 'passing' : `${testCount} passing`, '#3fb950')],
    ['e2e', badge('e2e', e2eCount === '' ? 'passing' : `${e2eCount} passing`, '#3fb950')],
    ['security', badge('security', 'audited', '#3fb950')],
    ['licence', badge('licence', 'MIT', '#0969da')],
    // Zwei Lizenzen, seit Hamburg und Frankfurt dazukamen: Berlin gibt unter
    // DL-DE/Zero heraus, die beiden anderen unter DL-DE/Namensnennung. Nur die
    // erste zu nennen liesse die Bedingung weg, die die anderen beiden stellen.
    ['data', badge('data', 'DL-DE Zero + BY 2.0', '#0969da')],
  ]
}
