const { test, expect } = require('@playwright/test')
const { launchApp } = require('./helpers/launch')

let page, cleanup

test.beforeEach(async () => {
  const launched = await launchApp()
  page = launched.page
  cleanup = launched.cleanup
})

test.afterEach(async () => {
  if (typeof cleanup === 'function') await cleanup()
})

test('pressing Escape with CommandPalette open closes CommandPalette without closing RightSidebar', async () => {
  const shell = page.locator('.app-shell')

  await page.evaluate(() => {
    window.dispatchEvent(new CustomEvent('toggle-inspector'))
  })
  await expect(shell).toHaveClass(/right-open/, { timeout: 5000 })

  await page.keyboard.press('Control+p')
  await page.waitForTimeout(400)

  const palette = page.locator('.command-palette-container')
  await expect(palette).toBeVisible({ timeout: 10000 })

  await page.keyboard.press('Escape')
  await page.waitForTimeout(300)

  await expect(palette).not.toBeVisible()
  await expect(shell).toHaveClass(/right-open/)

  await page.keyboard.press('Escape')
  await page.waitForTimeout(300)

  await expect(shell).toHaveClass(/right-closed/)
})
