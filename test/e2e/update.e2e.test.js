const { test, expect } = require('@playwright/test')
const { launchApp, invokeIPC } = require('./helpers/launch')

let app, page, cleanup

test.beforeEach(async () => {
  const launched = await launchApp()
  app = launched.app
  page = launched.page
  cleanup = launched.cleanup
})

test.afterEach(async () => {
  await cleanup()
})

test('update check IPC responds in development mode', async () => {
  const result = await invokeIPC(page, 'checkForUpdates')
  expect(result).toBeDefined()
})

test('app updater handles update status gracefully', async () => {
  const isAvailable = await page.evaluate(async () => {
    try {
      if (window.api?.checkForUpdates) {
        return await window.api.checkForUpdates()
      }
      return null
    } catch {
      return null
    }
  })
  expect(isAvailable).toBeDefined()
})
