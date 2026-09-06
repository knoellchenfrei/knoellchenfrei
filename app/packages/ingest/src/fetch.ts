/**
 * Downloads the raw WFS payloads into .raw/ for `build-data`.
 *
 * Run in CI before the data build so a deployment always carries a current
 * snapshot. Failure is not fatal to the pipeline: the committed snapshot is
 * still valid data, just older, and shipping yesterday's zones beats shipping
 * nothing.
 */

import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

import { SOURCES, wfsUrl } from './sources.js'

const RAW = process.env.RAW_DIR ?? join(process.cwd(), '../../.raw')

mkdirSync(RAW, { recursive: true })

let failed = 0
for (const source of SOURCES) {
  const url = wfsUrl(source)
  process.stdout.write(`${source.key} … `)
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(180_000) })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const body = await response.text()
    const parsed = JSON.parse(body) as { features?: unknown[] }
    const count = parsed.features?.length ?? 0
    // A service that answers 200 with an empty or truncated collection would
    // otherwise silently shrink the app's data.
    if (count < source.expectedFeatures * 0.5) {
      throw new Error(`only ${count} features, expected around ${source.expectedFeatures}`)
    }
    writeFileSync(join(RAW, `${source.key}.json`), body)
    console.log(`${count} features`)
  } catch (error) {
    failed += 1
    console.log(`FAILED: ${(error as Error).message}`)
  }
}

if (failed > 0) {
  console.error(`\n${failed} of ${SOURCES.length} sources failed.`)
  process.exit(1)
}
