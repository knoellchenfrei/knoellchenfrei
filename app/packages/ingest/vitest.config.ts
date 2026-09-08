import { defineConfig } from 'vitest/config'

/**
 * Eng auf `test/` geschnitten, aus demselben Grund wie in `apps/api` und
 * `apps/web`: Ohne `include` sucht Vitest von hier aus alles, was nach einem
 * Test aussieht — und `src/` ist in diesem Paket voller Skripte, die beim
 * blossen Import Dateien lesen und Netzabrufe starten.
 */
export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    environment: 'node',
  },
})
