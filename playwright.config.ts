import { defineConfig, devices } from '@playwright/test'

// BB-17 · Pruebas de punta a punta contra el build de producción (con service worker),
// conectado al Supabase configurado en .env.local. Las pruebas comparten la base de datos,
// por eso corren en serie y con un solo worker.
const PUERTO = 4174

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  reporter: [['list']],
  use: {
    baseURL: `http://localhost:${PUERTO}`,
    locale: 'es-MX',
    timezoneId: 'America/Mexico_City',
    serviceWorkers: 'allow',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `npm run preview -- --port ${PUERTO} --strictPort`,
    url: `http://localhost:${PUERTO}`,
    reuseExistingServer: false,
    timeout: 60_000,
  },
})
