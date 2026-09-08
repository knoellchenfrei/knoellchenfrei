import { readdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const src = fileURLToPath(new URL('../src/', import.meta.url))

/**
 * `packages/core` läuft im Browser, im Worker und in Node — und darf deshalb
 * nichts aus Node importieren.
 *
 * Die Regel stand bisher nur in CLAUDE.md. Getragen hat sie in Wahrheit die
 * `tsconfig.json`: Ohne `types` fand `tsc` gar keine Node-Typen, ein
 * `import 'node:fs'` wäre also am Compiler gescheitert. Das war Zufall — die
 * Typen kamen über einen Peer von Vitest 3 nach `app/node_modules/@types/`,
 * und mit Vitest 4 fielen sie weg. Seitdem steht `"types": ["node"]` in der
 * Konfiguration, weil die Tests hier `node:fs` brauchen; damit ist die
 * Compiler-Sperre für `src/` weg. Dieser Test ist ihr Ersatz.
 */
describe('core bleibt frei von Node', () => {
  const dateien = (verzeichnis: string): string[] =>
    readdirSync(verzeichnis, { withFileTypes: true }).flatMap((eintrag) =>
      eintrag.isDirectory()
        ? dateien(`${verzeichnis}${eintrag.name}/`)
        : eintrag.name.endsWith('.ts')
          ? [`${verzeichnis}${eintrag.name}`]
          : [],
    )

  const quellen = dateien(src)

  it('findet überhaupt Quelldateien', () => {
    expect(quellen.length).toBeGreaterThan(10)
  })

  it.each(quellen.map((pfad) => [pfad.slice(src.length), pfad]))(
    'src/%s importiert kein Node-Modul',
    (_name, pfad) => {
      const inhalt = readFileSync(pfad, 'utf8')
      expect(inhalt).not.toMatch(/from\s+['"]node:/)
      expect(inhalt).not.toMatch(/import\s*\(\s*['"]node:/)
      expect(inhalt).not.toMatch(/require\s*\(\s*['"]node:/)
    },
  )
})
