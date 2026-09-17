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

import { CITY_KEY, SOURCES, cityFiles, wfsUrl } from './sources.js'

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
    let count: number
    if (source.encoding === 'gml') {
      // Schwerins Dienst kann kein JSON; hier ist XML die *richtige* Antwort.
      // Gezählt wird, was `gml.ts` im Datenbau lesen wird — ein
      // `ows:ExceptionReport` hat null `wfs:member` und fiele damit unten
      // durch die 95-%-Schranke; sein Text steht trotzdem im Log statt nur
      // einer Zahl.
      if (!body.trimStart().startsWith('<')) {
        throw new Error(`kein XML — der Dienst hat auf outputFormat "${source.outputFormat}" etwas anderes geantwortet`)
      }
      const exception = /<ows:ExceptionText[^>]*>([^<]*)</.exec(body)
      if (exception !== null) throw new Error(`der Dienst meldet: ${(exception[1] ?? '').trim()}`)
      count = body.match(/<wfs:member>/g)?.length ?? 0
    } else {
      // Ein falsches `outputFormat` liefert keinen Fehler, sondern GML — also
      // gültiges XML, und `JSON.parse` scheitert daran mit einer Meldung, die
      // nach kaputten Daten aussieht statt nach einer falschen Anfrage.
      if (body.trimStart().startsWith('<')) {
        throw new Error(
          `XML statt JSON — outputFormat "${source.outputFormat}" kennt dieser Dienst vermutlich nicht`
        )
      }
      const parsed = JSON.parse(body) as { features?: unknown[] }
      count = parsed.features?.length ?? 0
    }
    // A service that answers 200 with an empty or truncated collection would
    // otherwise silently shrink the app's data.
    //
    // Die Schwelle stand bei **50 %**, und das war zu grosszügig: Von 103
    // Parkzonen auf 90 wäre stillschweigend durchgegangen. Die Beobachtung,
    // die das ausgelöst hat, stammt vom Betreiber und stimmt: Eine
    // Parkzone verschwindet nicht. Sie kann umbenannt oder zusammengelegt
    // werden, aber ein Rückgang um mehr als ein paar Promille ist kein
    // Datenpflege-Ereignis, sondern ein kaputter Abruf — ein abgeschnittenes
    // Ergebnis, eine geänderte Ebene, ein Dienst, der die Hälfte liefert.
    //
    // 5 % Toleranz nach unten, weil Kataster-Ebenen neu geschnitten werden:
    // Bei 45.917 Strassenabschnitten sind ein paar Dutzend mehr oder weniger
    // Alltag, bei 103 Zonen nicht.
    if (count < Math.floor(source.expectedFeatures * 0.95)) {
      throw new Error(
        `nur ${count} statt ${source.expectedFeatures} Features — das ist ein Rückgang, ` +
          'und der ist bei dieser Ebene kein normaler Vorgang. Von Hand nachsehen, ' +
          'bevor die Zahl in sources.ts angepasst wird.'
      )
    }
    writeFileSync(join(RAW, `${source.key}.${source.encoding === 'gml' ? 'gml' : 'json'}`), body)
    // Wachstum ist der Normalfall und trotzdem eine Meldung wert: Die Zahl in
    // `sources.ts` ist die Messlatte, und eine, die nie nachgezogen wird,
    // verliert ihren Sinn.
    const abweichung = count - source.expectedFeatures
    const notiz =
      abweichung === 0
        ? ''
        : ` (${abweichung > 0 ? '+' : ''}${abweichung} gegenüber sources.ts — Zahl dort nachziehen)`
    console.log(`${count} features${notiz}`)
  } catch (error) {
    failed += 1
    console.log(`FAILED: ${(error as Error).message}`)
  }
}

// Dateien, die kein WFS sind — Kölns Automaten-CSV und Cottbus' zwei
// ArcGIS-Abfragen. Ohne die JSON-Prüfung von oben: Eine CSV beginnt nicht
// mit `{`, und `JSON.parse` würde sie verwerfen. Geprüft wird stattdessen,
// dass etwas Nennenswertes kam: Ein leerer Rumpf oder eine HTML-Fehlerseite
// wäre sonst als Datei gelandet, und der Datenbau hätte aus null Zeilen
// gebaut. Trägt der Eintrag `expectedFeatures`, ist die Datei GeoJSON und
// wird wie ein WFS-Abzug gezählt — siehe `pruefeArcGisAntwort`.
// Dateien, die kein WFS sind — Kölns Automaten-CSV und Innsbrucks
// ArcGIS-Ebenen. Ohne die JSON-Prüfung von oben: Eine CSV beginnt nicht mit
// `{`, und `JSON.parse` würde sie verwerfen. Geprüft wird stattdessen, dass
// etwas Nennenswertes kam: Ein leerer Rumpf oder eine HTML-Fehlerseite wäre
// sonst als Datei gelandet, und der Datenbau hätte aus null Zeilen gebaut.
// Nennt die Quelle `expectedFeatures`, ist sie GeoJSON, und dann gilt
// dieselbe Schwelle wie oben — ein ArcGIS-Dienst kürzt still bei
// `maxRecordCount` und sagt es nur in einem Feld, das niemand liest.
const dateien = cityFiles(CITY_KEY)
for (const datei of dateien) {
  process.stdout.write(`${datei.key} (Datei) … `)
  try {
    const response = await fetch(datei.url, { signal: AbortSignal.timeout(180_000) })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const body = await response.text()
    if (body.length < 1000 || body.trimStart().startsWith('<')) {
      throw new Error(`nur ${body.length} Bytes oder HTML statt einer Datei`)
    }
    const zaehlung =
      datei.expectedFeatures === undefined ? '' : pruefeArcGisAntwort(body, datei.expectedFeatures)
    if (datei.expectedFeatures !== undefined) {
      const parsed = JSON.parse(body) as { features?: unknown[]; exceededTransferLimit?: unknown }
      const count = parsed.features?.length ?? 0
      if (parsed.exceededTransferLimit === true) {
        throw new Error(`der Dienst hat die Antwort bei ${count} Merkmalen abgeschnitten (exceededTransferLimit)`)
      }
      if (count < Math.floor(datei.expectedFeatures * 0.95)) {
        throw new Error(
          `nur ${count} statt ${datei.expectedFeatures} Features — das ist ein Rückgang, ` +
            'und der ist bei dieser Ebene kein normaler Vorgang. Von Hand nachsehen, ' +
            'bevor die Zahl in sources.ts angepasst wird.'
        )
      }
    }
    writeFileSync(join(RAW, datei.file), body)
    console.log(`${body.length} Bytes${zaehlung}`)
  } catch (error) {
    failed += 1
    console.log(`FAILED: ${(error as Error).message}`)
  }
}

/**
 * Ein ArcGIS FeatureServer antwortet auf alles mit 200.
 *
 * Auf einen falschen Layer, einen Tippfehler in `where` oder einen
 * gesperrten Dienst kommt `{"error":{"code":400,…}}` — gültiges JSON, 200,
 * und lang genug für die Längenprüfung oben. Und ein Ergebnis über
 * `maxRecordCount` (in Cottbus 2000) kommt **abgeschnitten**, mit
 * `exceededTransferLimit: true` daneben; wer das Feld nicht liest, baut aus
 * dem ersten Stück und meldet Erfolg. Danach dieselbe 95-%-Schranke wie bei
 * einem WFS, aus demselben Grund: Eine Parkzone verschwindet nicht.
 */
function pruefeArcGisAntwort(body: string, expectedFeatures: number): string {
  const parsed = JSON.parse(body) as {
    error?: { code?: number; message?: string }
    exceededTransferLimit?: boolean
    features?: unknown[]
  }
  if (parsed.error !== undefined) {
    throw new Error(`ArcGIS meldet Fehler ${parsed.error.code ?? '?'}: ${parsed.error.message ?? ''}`)
  }
  if (parsed.exceededTransferLimit === true) {
    throw new Error('exceededTransferLimit — der Dienst hat das Ergebnis abgeschnitten')
  }
  const count = parsed.features?.length ?? 0
  if (count < Math.floor(expectedFeatures * 0.95)) {
    throw new Error(
      `nur ${count} statt ${expectedFeatures} Features — das ist ein Rückgang, und der ist bei ` +
        'dieser Ebene kein normaler Vorgang. Von Hand nachsehen, bevor die Zahl in sources.ts angepasst wird.'
    )
  }
  const abweichung = count - expectedFeatures
  return abweichung === 0
    ? `, ${count} Features`
    : `, ${count} Features (${abweichung > 0 ? '+' : ''}${abweichung} gegenüber sources.ts — Zahl dort nachziehen)`
}

if (failed > 0) {
  console.error(`\n${failed} of ${SOURCES.length + dateien.length} sources failed.`)
  process.exit(1)
}
