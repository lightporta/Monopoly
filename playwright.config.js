import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/browser',
  timeout: 45000,
  expect: { timeout: 8000 },
  workers: 1,
  use: {
    baseURL: 'http://127.0.0.1:3107',
    browserName: 'chromium',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'npm run build && node server/server.js',
    url: 'http://127.0.0.1:3107/healthz',
    env: { PORT: '3107', HOST: '127.0.0.1' },
    reuseExistingServer: false,
    timeout: 30000,
  },
});
