import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/e2e',
  use: { baseURL: 'http://127.0.0.1:8787', trace: 'retain-on-failure',
    launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH } },
  webServer: {
    command: 'npx wrangler dev --config wrangler.foundation.jsonc --local --ip 127.0.0.1 --port 8787',
    url: 'http://127.0.0.1:8787/healthz', reuseExistingServer: false, timeout: 120000
  }
});
