const { defineConfig } = require('@playwright/test')
const path = require('path')

module.exports = defineConfig({
  // Only pick up E2E tests — unit tests stay in vitest
  testDir: path.join(__dirname, 'test/e2e'),
  testMatch: '**/*.e2e.test.js',

  // Give real Electron plenty of time to start
  timeout: 30_000,
  expect: { timeout: 10_000 },

  // Never run E2E in parallel — tests touch the filesystem
  workers: 1,
  fullyParallel: false,

  // Retry flaky launches — on Windows, rapidly launching many Electron instances
  // back-to-back intermittently crashes with 0xC0000409 (fast-fail). Files pass in
  // isolation but can fail under sustained full-suite load, so retry a couple times.
  retries: process.env.CI ? 2 : 1,

  reporter: [['list'], ['html', { outputFolder: 'test/e2e/report', open: 'never' }]],

  use: {
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    trace: 'retain-on-failure'
  }
})
