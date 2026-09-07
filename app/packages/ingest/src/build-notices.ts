/**
 * Erzeugt `THIRD-PARTY-NOTICES.md` — die Lizenztexte der Abhängigkeiten, die
 * mit ausgeliefert werden.
 *
 * Warum es das braucht: Fünf der Laufzeit-Abhängigkeiten stehen unter
 * BSD-3-Clause und zwei unter BSD-2-Clause, darunter `maplibre-gl`, `pmtiles`
 * und `pbf`. Beide Lizenzen verlangen wörtlich, den Copyright-Vermerk „in the
 * documentation and/or other materials provided with the distribution" zu
 * reproduzieren. Im gebauten Bündel stand davon nichts — kein `@license`, kein
 * `Copyright`, keine Notices-Datei (Audit-Punkt M-023). Das ist keine
 * Formalie: Es sind dieselben Bedingungen, auf deren Einhaltung dieses Projekt
 * bei den eigenen Daten besteht.
 *
 * Warum **erzeugt** und nicht geschrieben: Eine Liste von Hand wäre am Tag der
 * nächsten Abhängigkeit falsch, und niemand merkte es. Dieselbe Begründung wie
 * bei der Vorratsliste des Service Workers — was aus dem Bestand ablesbar ist,
 * wird abgelesen.
 *
 * Aufruf: `pnpm --filter @knoellchenfrei/ingest build-notices`
 */

import { execFileSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

interface Eintrag {
  name: string
  versions: string[]
  paths: string[]
  license: string
  homepage?: string
}

const APP = join(process.cwd(), '../..')
const ZIELE = [
  join(APP, '../THIRD-PARTY-NOTICES.md'),
  // Zweite Ausfertigung neben der App: Was die Lizenz „mit der Verteilung"
  // verlangt, gehört in die Verteilung, nicht nur ins Repository.
  join(APP, 'apps/web/public/third-party-notices.txt'),
]

/** Die Dateinamen, unter denen Pakete ihren Lizenztext ablegen. */
const LIZENZDATEI = /^(LICEN[SC]E|COPYING|NOTICE)(\.(md|txt))?$/i

function lizenztext(pfad: string): string | null {
  if (!existsSync(pfad)) return null
  const treffer = readdirSync(pfad).filter((name) => LIZENZDATEI.test(name))
  for (const name of treffer) {
    const text = readFileSync(join(pfad, name), 'utf8').trim()
    if (text !== '') return text
  }
  return null
}

const rohe = execFileSync('pnpm', ['licenses', 'list', '--prod', '--json'], {
  cwd: APP,
  encoding: 'utf8',
  maxBuffer: 32 * 1024 * 1024,
})
const nachLizenz = JSON.parse(rohe) as Record<string, Eintrag[]>

const pakete: Eintrag[] = Object.values(nachLizenz)
  .flat()
  .sort((a, b) => a.name.localeCompare(b.name))

if (pakete.length === 0) {
  throw new Error('Keine Abhängigkeiten gefunden — lief `pnpm install`?')
}

const teile: string[] = [
  '# Lizenzhinweise Dritter',
  '',
  'Diese Datei wird erzeugt, nicht geschrieben:',
  '`pnpm --filter @knoellchenfrei/ingest build-notices`.',
  '',
  'Sie führt die Laufzeit-Abhängigkeiten der Web-App auf. BSD-2-Clause und',
  'BSD-3-Clause verlangen wörtlich, den Copyright-Vermerk mit der Verteilung',
  'zu reproduzieren; die übrigen stehen hier der Vollständigkeit halber.',
  '',
  'Der eigene Code steht unter MIT (siehe `LICENSE`), die Geodaten unter den',
  'Lizenzen der Städte und die Kartenkacheln unter ODbL (siehe `NOTICE`).',
  '',
  `Stand: ${pakete.length} Pakete.`,
  '',
]

let ohneText = 0
for (const paket of pakete) {
  const version = paket.versions.join(', ')
  teile.push(`## ${paket.name} ${version}`, '', `Lizenz: ${paket.license}`)
  if (paket.homepage !== undefined) teile.push(`Herkunft: ${paket.homepage}`)
  teile.push('')
  const text = paket.paths.map(lizenztext).find((wert) => wert !== null) ?? null
  if (text === null) {
    ohneText += 1
    // Kein stiller Ausfall: Wenn ein Paket seinen Lizenztext nicht mitliefert,
    // steht das da, statt dass die Zeile einfach fehlt.
    teile.push('> Das Paket liefert keine Lizenzdatei mit; es gilt der oben', '> genannte Bezeichner.', '')
  } else {
    teile.push('```', text, '```', '')
  }
}

const inhalt = `${teile.join('\n').trimEnd()}\n`
for (const ziel of ZIELE) writeFileSync(ziel, inhalt)

console.log(`${pakete.length} Pakete, ${(inhalt.length / 1024).toFixed(0)} KB`)
console.log(`  ohne mitgelieferten Lizenztext: ${ohneText}`)
for (const ziel of ZIELE) console.log(`  ${ziel}`)
