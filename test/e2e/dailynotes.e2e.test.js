/**
 * E2E: Daily Notes & Templates
 *
 * Launches the real Electron app against a fresh temp vault and verifies:
 * - clicking the Daily button opens the template picker
 * - the template modal shows the blank option + templates
 * - selecting a template creates a titled note in the DailyNotes folder on disk
 * - the Templates folder is seeded with the default templates
 */

const { test, expect } = require('@playwright/test')
const path = require('path')
const fs = require('fs/promises')
const { launchApp } = require('./helpers/launch')

let page, vaultPath, cleanup

test.beforeEach(async () => {
  const launched = await launchApp()
  page = launched.page
  vaultPath = launched.vaultPath
  cleanup = launched.cleanup
})

test.afterEach(async () => {
  await cleanup()
})

async function fileExists(filePath) {
  return fs
    .access(filePath)
    .then(() => true)
    .catch(() => false)
}

// ─── Tests ────────────────────────────────────────────────────────────────────

test('Daily button opens the template picker', async () => {
  await page.getByRole('button', { name: /Daily/ }).first().click()

  await expect(page.locator('.template-modal-container')).toBeVisible({ timeout: 20_000 })
  await expect(page.locator('.template-modal-header')).toContainText('Templates')
  await expect(page.getByText('Blank Note').first()).toBeVisible()
})

test('template picker lists default templates', async () => {
  await page.getByRole('button', { name: /Daily/ }).first().click()

  await expect(page.locator('.template-modal-container')).toBeVisible({ timeout: 20_000 })
  await expect(page.getByText('Learning Notes').first()).toBeVisible()
  await expect(page.getByText('Research Notes').first()).toBeVisible()
})

test('selecting a template creates a dated note on disk', async () => {
  const today = new Date().toISOString().split('T')[0]

  await page.getByRole('button', { name: /Daily/ }).first().click()
  await expect(page.locator('.template-modal-container')).toBeVisible({ timeout: 20_000 })

  // Pick the Learning Notes template card
  await page.getByText('Learning Notes').first().click()
  await page.locator('.template-header-apply-btn').click()

  // The created note should appear in the DailyNotes folder
  const expectedFile = path.join(vaultPath, 'DailyNotes', `${today} - Learning Notes.md`)
  await expect.poll(async () => fileExists(expectedFile), { timeout: 20_000 }).toBe(true)

  const raw = await fs.readFile(expectedFile, 'utf-8')
  expect(raw).toContain(`# ${today} - Learning Notes`)
  expect(raw).toContain('Learning Notes')
})

test('template picker does not clutter disk with template files', async () => {
  await page.getByRole('button', { name: /Daily/ }).first().click()
  await expect(page.locator('.template-modal-container')).toBeVisible({ timeout: 20_000 })

  // Templates are virtual and must not be saved to disk
  const templatesFolder = path.join(vaultPath, 'Templates')
  expect(await fileExists(templatesFolder)).toBe(false)
})

test('selecting the blank option creates an untitled daily note', async () => {
  const today = new Date().toISOString().split('T')[0]

  await page.getByRole('button', { name: /Daily/ }).first().click()
  await expect(page.locator('.template-modal-container')).toBeVisible({ timeout: 20_000 })

  await page.getByText('Blank Note').first().click()
  await page.locator('.template-header-apply-btn').click()

  const expectedFile = path.join(vaultPath, 'DailyNotes', `${today} - Note.md`)
  await expect.poll(async () => fileExists(expectedFile), { timeout: 20_000 }).toBe(true)
})

test('closes the template picker with Escape', async () => {
  await page.getByRole('button', { name: /Daily/ }).first().click()
  await expect(page.locator('.template-modal-container')).toBeVisible({ timeout: 20_000 })

  await page.keyboard.press('Escape')
  await expect(page.locator('.template-modal-container')).not.toBeVisible()
})

