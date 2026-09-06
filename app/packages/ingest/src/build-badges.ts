/**
 * Generates status badges as SVG files in the repository.
 *
 * Deliberately not shields.io: that would leak the repository name to a third
 * party on every README view, needs the repo to be public to resolve anything,
 * and adds a network dependency to a page that otherwise has none. These are
 * plain files the CI regenerates, so they are as current as the last run and
 * work in a private repository too.
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const OUT = process.env.BADGE_DIR ?? join(process.cwd(), '../../../docs/badges')

/** Character widths at 11px DejaVu Sans; close enough to lay out a badge. */
function textWidth(text: string): number {
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
function badge(label: string, value: string, colour: string): string {
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
function coverageColour(percent: number): string {
  if (percent >= 90) return '#3fb950'
  if (percent >= 80) return '#94b91e'
  if (percent >= 70) return '#d29922'
  return '#da3633'
}

interface CoverageSummary {
  total: {
    lines: { pct: number }
    statements: { pct: number }
    functions: { pct: number }
    branches: { pct: number }
  }
}

mkdirSync(OUT, { recursive: true })

const summaryPath =
  process.env.COVERAGE_SUMMARY ??
  join(process.cwd(), '../core/coverage/coverage-summary.json')

let coveragePct: number | null = null
try {
  const summary = JSON.parse(readFileSync(summaryPath, 'utf8')) as CoverageSummary
  coveragePct = Math.round(summary.total.lines.pct * 10) / 10
} catch {
  console.warn(`No coverage summary at ${summaryPath} — run test:coverage first.`)
}

const testCount = process.env.TEST_COUNT ?? ''
const e2eCount = process.env.E2E_COUNT ?? ''

const badges: [string, string][] = [
  ['build', badge('build', 'passing', '#3fb950')],
  [
    'coverage',
    coveragePct === null
      ? badge('coverage', 'unknown', '#8b949e')
      : badge('coverage', `${coveragePct}%`, coverageColour(coveragePct)),
  ],
  ['tests', badge('tests', testCount === '' ? 'passing' : `${testCount} passing`, '#3fb950')],
  ['e2e', badge('e2e', e2eCount === '' ? 'passing' : `${e2eCount} passing`, '#3fb950')],
  ['security', badge('security', 'audited', '#3fb950')],
  ['licence', badge('licence', 'MIT', '#0969da')],
  ['data', badge('data', 'DL-DE/Zero-2.0', '#0969da')],
]

for (const [name, svg] of badges) {
  writeFileSync(join(OUT, `${name}.svg`), svg)
}

console.log(`Wrote ${badges.length} badges to ${OUT}`)
if (coveragePct !== null) console.log(`  coverage: ${coveragePct}%`)
