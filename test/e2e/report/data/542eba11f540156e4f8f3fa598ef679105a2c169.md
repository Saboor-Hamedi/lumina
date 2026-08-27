# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: app.e2e.test.js >> app shell renders with sidebar
- Location: test\e2e\app.e2e.test.js:54:1

# Error details

```
Test timeout of 30000ms exceeded while running "afterEach" hook.
```

# Test source

```ts
  1  | /**
  2  |  * E2E: App Launch
  3  |  *
  4  |  * Tests that the real Electron window opens, renders the UI frame,
  5  |  * and shows the welcome state when no vault is pre-loaded.
  6  |  */
  7  | 
  8  | const { test, expect } = require('@playwright/test')
  9  | const { launchApp } = require('./helpers/launch')
  10 | 
  11 | let app, page, cleanup
  12 | 
  13 | test.beforeEach(async () => {
  14 |   const launched = await launchApp()
  15 |   app = launched.app
  16 |   page = launched.page
  17 |   cleanup = launched.cleanup
  18 | })
  19 | 
> 20 | test.afterEach(async () => {
     |      ^ Test timeout of 30000ms exceeded while running "afterEach" hook.
  21 |   await cleanup()
  22 | })
  23 | 
  24 | // ─── Tests ────────────────────────────────────────────────────────────────────
  25 | 
  26 | test('app launches without crashing', async () => {
  27 |   expect(app).toBeTruthy()
  28 |   expect(page).toBeTruthy()
  29 | })
  30 | 
  31 | test('window is visible and has correct title', async () => {
  32 |   // The BrowserWindow title may be empty or the HTML page title during init
  33 |   // — we just verify the window exists and is not destroyed
  34 |   const isVisible = await app.evaluate(({ BrowserWindow }) => {
  35 |     const win = BrowserWindow.getAllWindows()[0]
  36 |     return win && !win.isDestroyed() && win.isVisible()
  37 |   })
  38 |   expect(isVisible).toBe(true)
  39 | })
  40 | 
  41 | test('renderer loads without JS errors', async () => {
  42 |   const errors = []
  43 |   page.on('pageerror', (err) => errors.push(err.message))
  44 | 
  45 |   await page.waitForTimeout(2000)
  46 | 
  47 |   const fatalErrors = errors.filter(
  48 |     (e) => !e.includes('IndexedDB') && !e.includes('extension') && !e.includes('devtools')
  49 |   )
  50 | 
  51 |   expect(fatalErrors).toHaveLength(0)
  52 | })
  53 | 
  54 | test('app shell renders with sidebar', async () => {
  55 |   // Target the New button specifically (not the welcome page text which also says "new note")
  56 |   await expect(page.getByRole('button', { name: 'New', exact: true })).toBeVisible({
  57 |     timeout: 20_000
  58 |   })
  59 | })
  60 | 
  61 | test('note count is shown in sidebar', async () => {
  62 |   // Empty vault → "0 NOTES" label visible
  63 |   await expect(page.locator('text=0 NOTES')).toBeVisible({ timeout: 20_000 })
  64 | })
  65 | 
  66 | test('welcome page shortcuts are visible when no notes exist', async () => {
  67 |   // Welcome action cards shown when vault is empty
  68 |   await expect(page.locator('text=Create a new note')).toBeVisible({ timeout: 20_000 })
  69 |   await expect(page.getByRole('button', { name: /Quick Search/ })).toBeVisible({
  70 |     timeout: 20_000
  71 |   })
  72 |   await expect(page.getByRole('button', { name: /AI Assistant/ })).toBeVisible({ timeout: 20_000 })
  73 | })
  74 | 
```