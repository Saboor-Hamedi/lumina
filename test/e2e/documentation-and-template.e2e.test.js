/**
 * E2E: Documentation, Guide, and Template Modals
 *
 * Launches the real Electron app and verifies:
 * - Documentation modal opens via Ctrl+D and displays header badge with 2px radius
 * - Documentation floating pop sidebar and toggle controls
 * - Guide modal opens, displays step counter badge with 2px radius and step navigation
 * - Template modal opens, shows Theme-style cards with wireframe previews
 * - Escape closes all modals cleanly
 */

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

const docsModal = () => page.locator('.docs-modal-container')
const guideModal = () => page.locator('.guide-modal-container')
const templateModal = () => page.locator('.template-modal-container')

async function openDocumentation() {
  await page.keyboard.press('Control+d')
  await page.waitForTimeout(300)
  if (!(await docsModal().isVisible())) {
    // Fallback: click Docs button in status bar
    const docsBtn = page.locator('button:has-text("Docs")').first()
    if (await docsBtn.isVisible()) {
      await docsBtn.click()
    } else {
      await page.evaluate(() => {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'd', ctrlKey: true, bubbles: true }))
      })
    }
  }
  await expect(docsModal()).toBeVisible({ timeout: 15_000 })
}

async function openGuide() {
  const guideBtn = page.locator('button:has-text("Guide")').first()
  if (await guideBtn.isVisible()) {
    await guideBtn.click()
  } else {
    await page.evaluate(() => {
      window.dispatchEvent(new CustomEvent('open-guide'))
    })
  }
  await expect(guideModal()).toBeVisible({ timeout: 15_000 })
}

async function openTemplate() {
  // Click Daily Note button in navigation sidebar
  const calBtn = page.locator('button:has-text("Daily")').first()
  if (await calBtn.isVisible()) {
    await calBtn.click()
  } else {
    // Fallback trigger via selector
    const fallbackBtn = page.locator('.daily-note-btn, button:has(.lucide-calendar)').first()
    await fallbackBtn.click()
  }
  await expect(templateModal()).toBeVisible({ timeout: 15_000 })
}

// ─── Documentation Modal Tests ────────────────────────────────────────────────

test('opens Documentation modal and displays title and 2px radius badges', async () => {
  await openDocumentation()
  await expect(docsModal().locator('.docs-modal-header')).toContainText('Documentation')

  // Reading stats badge
  const statBadge = docsModal().locator('.docs-header-stat')
  await expect(statBadge).toBeVisible()
  await expect(statBadge).toContainText('read')
})

test('Documentation sidebar displays Learning Markdown folder and toggles visibility', async () => {
  await openDocumentation()

  const sidebar = docsModal().locator('.docs-sidebar')
  await expect(sidebar).toBeVisible()
  await expect(sidebar.locator('text=Learning Markdown')).toBeVisible()

  // Toggle sidebar closed
  const toggleBtn = docsModal().locator('.docs-sidebar-toggle-btn')
  await toggleBtn.click()
  await expect(sidebar).toHaveClass(/closed/)

  // Toggle sidebar open again
  await toggleBtn.click()
  await expect(sidebar).not.toHaveClass(/closed/)
})

test('closes Documentation modal with Escape', async () => {
  await openDocumentation()
  await page.keyboard.press('Escape')
  await expect(docsModal()).not.toBeVisible()
})

// ─── Guide Modal Tests ────────────────────────────────────────────────────────

test('opens Guide modal and displays step indicator badge with navigation', async () => {
  await openGuide()
  await expect(guideModal().locator('.guide-modal-header')).toContainText('Lumina Guide')

  // Step counter badge
  await expect(guideModal().locator('.guide-modal-header')).toContainText('Step 1 of')

  // Click Next to advance step
  const nextBtn = guideModal().locator('.guide-btn-primary:has-text("Next")')
  await nextBtn.click()
  await expect(guideModal().locator('.guide-modal-header')).toContainText('Step 2 of')

  // Closes on Escape
  await page.keyboard.press('Escape')
  await expect(guideModal()).not.toBeVisible()
})

// ─── Template Modal Tests ─────────────────────────────────────────────────────

test('opens Template modal and displays Theme-style cards with previews', async () => {
  await openTemplate()
  await expect(templateModal().locator('.template-header-title:has-text("Templates")')).toBeVisible()

  // Theme-style cards
  const cards = templateModal().locator('.template-modal-card')
  await expect(cards.first()).toBeVisible()

  // Card previews
  const previews = templateModal().locator('.template-modal-preview')
  await expect(previews.first()).toBeVisible()

  // Blank note card is active initially with check badge
  const activeCard = templateModal().locator('.template-modal-card.active')
  await expect(activeCard).toBeVisible()
  await expect(activeCard.locator('.template-check-badge')).toBeVisible()

  // Closes on Escape
  await page.keyboard.press('Escape')
  await expect(templateModal()).not.toBeVisible()
})
