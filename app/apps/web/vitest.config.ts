import { defineConfig } from 'vitest/config'

/**
 * Eng auf `test/` geschnitten — und das ist hier keine Kleinigkeit.
 *
 * Ohne `include` sucht Vitest von hier aus alles, was nach einem Test
 * aussieht, und greift dabei die Playwright-Dateien unter `e2e/` ab. Die
 * laufen dann nicht, sondern scheitern beim Einlesen, und der Aufruf sieht
 * aus, als sei der Code kaputt. Derselbe Fallstrick steht in `CLAUDE.md` für
 * `npx vitest run` aus dem Wurzelverzeichnis.
 */
export default defineConfig({
  test: {
    include: ['test/**/*.test.{ts,tsx}'],
    // Node bleibt die Vorgabe. Die Komponententests (`komponenten-*.test.tsx`)
    // holen sich jsdom je Datei über `@vitest-environment` — ein DOM für alle
    // wäre langsamer und liesse Speicher-, Format- und Zählwerk-Tests in einer
    // Umgebung laufen, die sie nicht brauchen und die anders lügt als Node.
    environment: 'node',
  },
})
