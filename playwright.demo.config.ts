import { defineConfig } from '@playwright/test'

// Grabación de la demo (no es una prueba): npm run demo:grabar
const PUERTO = 4175

export default defineConfig({
  testDir: './demo',
  testMatch: /grabar-demo\.ts$/,
  workers: 1,
  retries: 0,
  timeout: 300_000,
  expect: { timeout: 20_000 },
  reporter: [['list']],
  outputDir: './demo/.grabacion',
  use: {
    baseURL: `http://localhost:${PUERTO}`,
    locale: 'es-MX',
    timezoneId: 'America/Mexico_City',
    viewport: { width: 1280, height: 720 },
    video: { mode: 'on', size: { width: 1280, height: 720 } },
    serviceWorkers: 'allow',
    launchOptions: { slowMo: 120 },
  },
  webServer: {
    command: `npm run preview -- --port ${PUERTO} --strictPort`,
    url: `http://localhost:${PUERTO}`,
    reuseExistingServer: false,
    timeout: 60_000,
  },
})
