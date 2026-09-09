/**
 * Wann die Rohdaten einer Stadt zuletzt **erfolgreich** abgerufen wurden.
 *
 * Der Git-Zeitstempel eines Abzugs misst „zuletzt geändert", nicht „zuletzt
 * geprüft": Eine unveränderte Quelle erzeugt keinen Diff, und ein Abzug, den
 * seit drei Monaten niemand aufgefrischt hat, ist von einer Quelle, die sich
 * drei Monate nicht geändert hat, nicht zu unterscheiden. `meta.json` trug
 * bis zum 9. September kein Datum. Jetzt trägt es dieses hier: den ältesten
 * Änderungszeitpunkt unter den Rohdateien der Stadt. Der älteste, nicht der
 * jüngste — `fetch-data` schreibt jede Ebene einzeln, und scheitert eine,
 * bleibt ihre Datei stehen. „Alles hier ist mindestens so frisch" ist die
 * Aussage, die stimmt.
 *
 * Fehlen die Rohdaten (Bau ohne vorherigen Abruf), gibt es kein Datum — und
 * kein erfundenes.
 */
import { readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

export function geprueftAm(rawDir: string): string | null {
  let aeltester = Number.POSITIVE_INFINITY
  let dateien: string[]
  try {
    dateien = readdirSync(rawDir)
  } catch {
    return null
  }
  for (const name of dateien) {
    const pfad = join(rawDir, name)
    const stat = statSync(pfad)
    if (!stat.isFile()) continue
    aeltester = Math.min(aeltester, stat.mtimeMs)
  }
  if (!Number.isFinite(aeltester)) return null
  // Auf die Minute, ohne Millisekunden: Das Datum wird gelesen, nicht gerechnet.
  return new Date(Math.floor(aeltester / 60_000) * 60_000).toISOString()
}

/** Sieben Tage: ein täglicher Abruf, der eine Woche lang nicht durchkam, ist ein Ausfall. */
export const HOECHSTALTER_MS = 7 * 86_400_000

/** Wie alt ein Datum ist — `null`, wenn keines da ist oder es nicht lesbar ist. */
export function alterInTagen(iso: string | null | undefined, now = Date.now()): number | null {
  if (typeof iso !== 'string') return null
  const at = Date.parse(iso)
  if (!Number.isFinite(at)) return null
  return Math.floor((now - at) / 86_400_000)
}
