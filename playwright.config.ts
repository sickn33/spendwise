import { defineConfig, devices } from '@playwright/test';

const ci = Boolean(process.env.CI);

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  expect: { timeout: 7_500 },
  fullyParallel: true,
  forbidOnly: ci,
  failOnFlakyTests: ci,
  retries: ci ? 1 : 0,
  workers: ci ? 1 : undefined,
  outputDir: 'test-results',
  reporter: ci
    ? [['line'], ['junit', { outputFile: 'test-results/e2e.xml' }], ['html', { open: 'never' }]]
    : [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:4173/spendwise/',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    serviceWorkers: 'block',
  },
  projects: [
    { name: 'desktop-chromium', testIgnore: [/mobile\.spec\.ts/, /pwa\.spec\.ts/], use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile-chromium', testMatch: /mobile\.spec\.ts/, use: { ...devices['Pixel 5'] } },
    { name: 'pwa-chromium', testMatch: /pwa\.spec\.ts/, use: { ...devices['Desktop Chrome'], serviceWorkers: 'allow' } },
  ],
  webServer: process.env.PLAYWRIGHT_BASE_URL ? undefined : {
    command: 'npm run preview -- --host 127.0.0.1 --port 4173 --strictPort',
    url: 'http://127.0.0.1:4173/spendwise/',
    reuseExistingServer: !ci,
    timeout: 120_000,
    stdout: 'ignore',
    stderr: 'pipe',
  },
});
