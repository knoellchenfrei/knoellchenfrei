/**
 * Downloads the raw WFS payloads into .raw/<stadt>/ for `build-data`.
 *
 * Run in CI before the data build so a deployment always carries a current
 * snapshot. Failure is not fatal to the pipeline: the committed snapshot is
 * still valid data, just older, and shipping yesterday's zones beats shipping
 * nothing.
 *
 * Welche Stadt: `CITY=hamburg pnpm --filter @knoellchenfrei/ingest fetch-data`. Ohne
 * Angabe Berlin.
 *
 * **Hinter einem Proxy muss `NODE_USE_ENV_PROXY=1` gesetzt sein** — das
 * package.json-Skript tut das. Node ist hier anders als curl: Sein `fetch`
 * ignoriert `HTTPS_PROXY` von sich aus und geht direkt hinaus. In einer
 * Arbeitsumgebung, deren Ausgang über einen Proxy läuft, antwortet
 * `geodienste.hamburg.de` auf die direkte Verbindung mit **403** — kein
 * Netzwerkfehler, keine TLS-Meldung, nur ein Verbot, das nach einer Sperre der
 * Behörde aussieht und keine ist. Ohne gesetzten `HTTPS_PROXY` ist das Flag
 * wirkungslos, in CI also unschädlich.
 */

import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

import { CITY_KEY, SOURCES, wfsUrl } from './sources.js'

const RAW = join(process.env.RAW_DIR ?? join(process.cwd(), '../../.raw'), CITY_KEY)

const proxyConfigured =
  (process.env.HTTPS_PROXY ?? process.env.https_proxy ?? '').length > 0

mkdirSync(RAW, { recursive: true })

console.log(`Stadt: ${CITY_KEY} — ${SOURCES.length} Quellen nach ${RAW}`)

let failed = 0
for (const source of SOURCES) {
  const url = wfsUrl(source)
  process.stdout.write(`${source.key} … `)
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(180_000) })
    if (!response.ok) {
      // 403 bei gesetztem Proxy heisst fast immer: Node ist daran vorbei.
      const hint =
        response.status === 403 && proxyConfigured && process.env.NODE_USE_ENV_PROXY !== '1'
          ? ' — HTTPS_PROXY ist gesetzt, aber NODE_USE_ENV_PROXY=1 fehlt; Node geht am Proxy vorbei'
          : ''
      throw new Error(`HTTP ${response.status}${hint}`)
    }
    const body = await response.text()
    // Ein falsches `outputFormat` liefert keinen Fehler, sondern GML — also
    // gueltiges XML, und `JSON.parse` scheitert daran mit einer Meldung, die
    // nach kaputten Daten aussieht statt nach einer falschen Anfrage.
    if (body.trimStart().startsWith('<')) {
      throw new Error(
        `XML statt JSON — outputFormat "${source.outputFormat}" kennt dieser Dienst vermutlich nicht`
      )
    }
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
