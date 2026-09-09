#!/usr/bin/env node
/**
 * Wie alt der ausgelieferte Datenabzug je Stadt ist.
 *
 * Liest `geprueftAm` aus jeder `apps/web/public/data/<stadt>/meta.json` —
 * den Zeitpunkt des letzten **erfolgreichen** Abrufs, nicht den des Baus —
 * und nennt jede Stadt, deren Datum älter als sieben Tage ist oder fehlt.
 * Läuft im Deploy nach dem Auffrischen und von Hand:
 *
 *   node scripts/datenstand-pruefen.mjs
 *
 * Rückgabewert ist immer 0: Ein Behördendienst, der eine Woche schweigt,
 * ist ein Befund für die Zusammenfassung, kein Grund, den Deploy zu
 * verweigern — der eingecheckte Abzug ist gültige Daten, nur ältere.
 */
import { appendFileSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const DATEN = join(process.cwd(), 'app/apps/web/public/data')
const HOECHSTALTER_TAGE = 7
const jetzt = Date.now()

const zeilen = []
const befunde = []
for (const stadt of readdirSync(DATEN).sort()) {
  let meta
  try {
    meta = JSON.parse(readFileSync(join(DATEN, stadt, 'meta.json'), 'utf8'))
  } catch {
    befunde.push(`${stadt}: keine lesbare meta.json`)
    zeilen.push(`| ${stadt} | — | keine meta.json |`)
    continue
  }
  const at = typeof meta.geprueftAm === 'string' ? Date.parse(meta.geprueftAm) : Number.NaN
  if (!Number.isFinite(at)) {
    befunde.push(`${stadt}: kein Datum des letzten Abrufs in meta.json`)
    zeilen.push(`| ${stadt} | — | kein Datum |`)
    continue
  }
  const tage = Math.floor((jetzt - at) / 86_400_000)
  const alt = tage > HOECHSTALTER_TAGE
  if (alt) befunde.push(`${stadt}: zuletzt vor ${tage} Tagen geprüft (${meta.geprueftAm})`)
  zeilen.push(`| ${stadt} | ${meta.geprueftAm} | ${alt ? `**vor ${tage} Tagen**` : `vor ${tage} Tagen`} |`)
}

const tabelle = ['| Stadt | zuletzt geprüft | Alter |', '| --- | --- | --- |', ...zeilen].join('\n')
console.log(tabelle)
for (const befund of befunde) console.log(`::warning::Datenstand: ${befund}`)

if (process.env.GITHUB_STEP_SUMMARY !== undefined) {
  const kopf =
    befunde.length === 0
      ? '### Datenstand: alle Städte innerhalb einer Woche geprüft'
      : `### Datenstand: ${befunde.length} ${befunde.length === 1 ? 'Stadt' : 'Städte'} ohne frischen Abruf`
  appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${kopf}\n\n${tabelle}\n\n`)
}
