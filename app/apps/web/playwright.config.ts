import { defineConfig, devices } from '@playwright/test'

/**
 * End-to-end suite.
 *
 * Runs against the production build, not the dev server: the bugs worth
 * catching here — a collapsed map container, a stylesheet import order, a
 * stringified GeoJSON property — only appear in a real build.
 *
 * Map tiles come from openstreetmap.org and may be unreachable in CI. That is
 * not a failure: the zone polygons are the app's own data and must render
 * either way, so no test asserts on tiles.
 */
export default defineConfig({
  testDir: './e2e',
  /*
   * Two workers, not one per core. All of them hit the same preview server and
   * each runs a WebGL map; at full parallelism the machine, not the app, decided
   * which assertions timed out, and a different set of tests failed each run.
   */
  fullyParallel: true,
  workers: 2,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI === undefined ? 0 : 1,
  reporter: process.env.CI === undefined ? 'list' : [['list'], ['json', { outputFile: 'e2e-results.json' }]],
  timeout: 60_000,
  use: {
    baseURL: 'http://localhost:4173',
    trace: 'retain-on-failure',
    locale: 'de-DE',
    timezoneId: 'Europe/Berlin',
    launchOptions: {
      executablePath: process.env.PLAYWRIGHT_CHROMIUM ?? undefined,
    },
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 860 } } },
    { name: 'phone', use: { ...devices['Pixel 7'] } },
  ],
  webServer: {
    command: 'pnpm build && pnpm preview --port 4173 --strictPort',
    url: 'http://localhost:4173',
    reuseExistingServer: process.env.CI === undefined,
    timeout: 180_000,
  },
})
