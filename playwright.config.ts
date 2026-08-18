import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  timeout: 30_000,
  expect: { timeout: 15_000 },
  reporter: [['line']],
  use: {
    baseURL: process.env.GRAFANA_URL ?? 'http://127.0.0.1:3000',
    trace: 'retain-on-failure',
  },
});
