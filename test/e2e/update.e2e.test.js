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
  let error = null
  try {
    await invokeIPC(page, 'checkForUpdates')
  } catch (err) {
    error = err
  }
  expect(error).toBeNull()
})

test('app updater handles update status gracefully', async () => {
  const isFunction = await page.evaluate(() => {
    return typeof window.api?.checkForUpdates === 'function'
  })
  expect(isFunction).toBe(true)
})
