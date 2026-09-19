import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/invite-e2e',
  workers: 1,
  use: { baseURL: 'http://127.0.0.1:8788', trace: 'retain-on-failure',
    launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH } },
  webServer: {
    command: 'node --experimental-strip-types scripts/preview-invite-test.mjs',
    url: 'http://127.0.0.1:8788/healthz', reuseExistingServer: false, timeout: 120000
  }
});
