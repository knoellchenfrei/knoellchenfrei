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

import { badgesFuer } from './badges.js'

const OUT = process.env.BADGE_DIR ?? join(process.cwd(), '../../../docs/badges')

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

const badges = badgesFuer({ coveragePct, testCount, e2eCount })

for (const [name, svg] of badges) {
  writeFileSync(join(OUT, `${name}.svg`), svg)
}

console.log(`Wrote ${badges.length} badges to ${OUT}`)
if (coveragePct === null) console.log('  coverage: unveraendert gelassen (keine Messung)')
else console.log(`  coverage: ${coveragePct}%`)
