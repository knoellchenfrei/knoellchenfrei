import { defineConfig } from 'vitest/config'

/**
 * Eng auf `test/` geschnitten.
 *
 * Ohne `include` sucht Vitest von hier aus alles, was nach einem Test aussieht
 * — und greift dabei die Playwright-Dateien der Web-App ab, die es nicht
 * ausführen kann. Derselbe Fallstrick steht in `CLAUDE.md` für den Aufruf aus
 * dem Wurzelverzeichnis.
 */
export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    environment: 'node',
  },
})
