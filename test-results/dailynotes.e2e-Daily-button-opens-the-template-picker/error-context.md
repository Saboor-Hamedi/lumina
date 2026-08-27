# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: dailynotes.e2e.test.js >> Daily button opens the template picker
- Location: test\e2e\dailynotes.e2e.test.js:38:1

# Error details

```
Test timeout of 30000ms exceeded while running "afterEach" hook.
```

# Test source

```ts
  1   | /**
  2   |  * E2E: Daily Notes & Templates
  3   |  *
  4   |  * Launches the real Electron app against a fresh temp vault and verifies:
  5   |  * - clicking the Daily button opens the template picker
  6   |  * - the template modal shows the blank option + templates
  7   |  * - selecting a template creates a titled note in the DailyNotes folder on disk
  8   |  * - the Templates folder is seeded with the default templates
  9   |  */
  10  | 
  11  | const { test, expect } = require('@playwright/test')
  12  | const path = require('path')
  13  | const fs = require('fs/promises')
  14  | const { launchApp } = require('./helpers/launch')
  15  | 
  16  | let page, vaultPath, cleanup
  17  | 
  18  | test.beforeEach(async () => {
  19  |   const launched = await launchApp()
  20  |   page = launched.page
  21  |   vaultPath = launched.vaultPath
  22  |   cleanup = launched.cleanup
  23  | })
  24  | 
> 25  | test.afterEach(async () => {
      |      ^ Test timeout of 30000ms exceeded while running "afterEach" hook.
  26  |   await cleanup()
  27  | })
  28  | 
  29  | async function fileExists(filePath) {
  30  |   return fs
  31  |     .access(filePath)
  32  |     .then(() => true)
  33  |     .catch(() => false)
  34  | }
  35  | 
  36  | // ─── Tests ────────────────────────────────────────────────────────────────────
  37  | 
  38  | test('Daily button opens the template picker', async () => {
  39  |   await page.getByRole('button', { name: /Daily/ }).first().click()
  40  | 
  41  |   await expect(page.locator('.template-modal-overlay')).toBeVisible({ timeout: 20_000 })
  42  |   await expect(page.getByText('Select Daily Note Template')).toBeVisible()
  43  |   await expect(page.getByText('Blank Note')).toBeVisible()
  44  | })
  45  | 
  46  | test('template picker lists default templates', async () => {
  47  |   await page.getByRole('button', { name: /Daily/ }).first().click()
  48  | 
  49  |   await expect(page.getByText('Select Daily Note Template')).toBeVisible({ timeout: 20_000 })
  50  |   await expect(page.getByText('Learning Notes')).toBeVisible()
  51  |   await expect(page.getByText('Research Notes')).toBeVisible()
  52  | })
  53  | 
  54  | test('selecting a template creates a dated note on disk', async () => {
  55  |   const today = new Date().toISOString().split('T')[0]
  56  | 
  57  |   await page.getByRole('button', { name: /Daily/ }).first().click()
  58  |   await expect(page.getByText('Select Daily Note Template')).toBeVisible({ timeout: 20_000 })
  59  | 
  60  |   // Pick the Learning Notes template card
  61  |   await page.getByText('Learning Notes').first().click()
  62  | 
  63  |   // The created note should appear in the DailyNotes folder
  64  |   const expectedFile = path.join(vaultPath, 'DailyNotes', `${today} - Learning Notes.md`)
  65  |   await expect.poll(async () => fileExists(expectedFile), { timeout: 20_000 }).toBe(true)
  66  | 
  67  |   const raw = await fs.readFile(expectedFile, 'utf-8')
  68  |   expect(raw).toContain(`# ${today} - Learning Notes`)
  69  |   expect(raw).toContain('Learning Notes')
  70  | })
  71  | 
  72  | test('Templates folder is seeded with default templates', async () => {
  73  |   await page.getByRole('button', { name: /Daily/ }).first().click()
  74  |   await expect(page.getByText('Select Daily Note Template')).toBeVisible({ timeout: 20_000 })
  75  | 
  76  |   // A default template file should exist on disk in the Templates folder
  77  |   const learningTemplate = path.join(vaultPath, 'Templates', 'Learning Notes.md')
  78  |   await expect.poll(async () => fileExists(learningTemplate), { timeout: 20_000 }).toBe(true)
  79  | })
  80  | 
  81  | test('selecting the blank option creates an untitled daily note', async () => {
  82  |   const today = new Date().toISOString().split('T')[0]
  83  | 
  84  |   await page.getByRole('button', { name: /Daily/ }).first().click()
  85  |   await expect(page.getByText('Select Daily Note Template')).toBeVisible({ timeout: 20_000 })
  86  | 
  87  |   await page.getByText('Blank Note').first().click()
  88  | 
  89  |   const expectedFile = path.join(vaultPath, 'DailyNotes', `${today} - Note.md`)
  90  |   await expect.poll(async () => fileExists(expectedFile), { timeout: 20_000 }).toBe(true)
  91  | })
  92  | 
  93  | test('closes the template picker with Escape', async () => {
  94  |   await page.getByRole('button', { name: /Daily/ }).first().click()
  95  |   await expect(page.getByText('Select Daily Note Template')).toBeVisible({ timeout: 20_000 })
  96  | 
  97  |   await page.keyboard.press('Escape')
  98  |   await expect(page.locator('.template-modal-overlay')).not.toBeVisible()
  99  | })
  100 | 
```