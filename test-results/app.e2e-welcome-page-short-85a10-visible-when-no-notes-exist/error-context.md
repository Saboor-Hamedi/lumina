# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: app.e2e.test.js >> welcome page shortcuts are visible when no notes exist
- Location: test\e2e\app.e2e.test.js:69:1

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: locator('text=Quick Search')
Expected: visible
Error: strict mode violation: locator('text=Quick Search') resolved to 2 elements:
    1) <h3>Quick Search</h3> aka getByRole('button', { name: 'Quick Search Find any note or' })
    2) <span>…</span> aka getByText('Press Ctrl+P anywhere to open')

Call log:
  - Expect "toBeVisible" with timeout 20000ms
  - waiting for locator('text=Quick Search')

```

# Page snapshot

```yaml
- generic [ref=e4]:
  - complementary [ref=e5]:
    - generic [ref=e6]:
      - generic [ref=e7]:
        - button "New Note" [ref=e8] [cursor=pointer]:
          - img [ref=e9]
          - text: New Note
        - generic [ref=e10]:
          - button [ref=e11] [cursor=pointer]:
            - img [ref=e12]
          - button [ref=e14] [cursor=pointer]:
            - img [ref=e15]
          - button [ref=e20] [cursor=pointer]:
            - img [ref=e21]
      - generic [ref=e24]:
        - generic [ref=e25]:
          - img [ref=e26]
          - textbox "Search for notes" [ref=e29]
          - generic:
            - generic: v39.2.4
        - generic [ref=e30]:
          - button "All Notes" [ref=e31] [cursor=pointer]:
            - img [ref=e32]
            - generic [ref=e36]: All Notes
          - button "Favorites" [ref=e37] [cursor=pointer]:
            - img [ref=e38]
            - generic [ref=e40]: Favorites
        - generic [ref=e42]:
          - generic [ref=e43]:
            - heading "0 Notes" [level=3] [ref=e44]
            - generic [ref=e45]:
              - button [ref=e46] [cursor=pointer]:
                - img [ref=e47]
              - button [ref=e50] [cursor=pointer]:
                - img [ref=e51]
              - button [ref=e56] [cursor=pointer]:
                - img [ref=e57]
          - generic [ref=e60]: No notes or folders found
      - generic [ref=e61]:
        - button [ref=e62] [cursor=pointer]:
          - img [ref=e63]
        - button [ref=e67] [cursor=pointer]:
          - img [ref=e68]
  - main [ref=e74]:
    - generic [ref=e76]:
      - img [ref=e78]
      - button [ref=e85] [cursor=pointer]:
        - img [ref=e86]
      - button [ref=e89] [cursor=pointer]:
        - img [ref=e90]
      - button [ref=e91] [cursor=pointer]:
        - img [ref=e92]
      - button [ref=e94] [cursor=pointer]:
        - img [ref=e95]
    - generic [ref=e99]:
      - generic:
        - img "Lumina Watermark"
      - generic [ref=e100]:
        - generic [ref=e101]:
          - heading "What are you thinking about today?" [level=1] [ref=e102]
          - paragraph [ref=e103]: Your personal AI-powered workspace for ideas, research, and writing.
        - generic [ref=e104]:
          - button "Create a new note Start writing instantly Ctrl + N" [ref=e105] [cursor=pointer]:
            - img [ref=e107]
            - generic [ref=e110]:
              - heading "Create a new note" [level=3] [ref=e111]
              - paragraph [ref=e112]: Start writing instantly
            - generic [ref=e113]: Ctrl + N
          - button "Quick Search Find any note or command Ctrl + P" [ref=e114] [cursor=pointer]:
            - img [ref=e116]
            - generic [ref=e119]:
              - heading "Quick Search" [level=3] [ref=e120]
              - paragraph [ref=e121]: Find any note or command
            - generic [ref=e122]: Ctrl + P
          - button "Toggle Sidebar Browse your workspace Ctrl + B" [ref=e123] [cursor=pointer]:
            - img [ref=e125]
            - generic [ref=e130]:
              - heading "Toggle Sidebar" [level=3] [ref=e131]
              - paragraph [ref=e132]: Browse your workspace
            - generic [ref=e133]: Ctrl + B
          - button "AI Assistant Chat with your knowledge Ctrl+Shift+I" [ref=e134] [cursor=pointer]:
            - img [ref=e136]
            - generic [ref=e139]:
              - heading "AI Assistant" [level=3] [ref=e140]
              - paragraph [ref=e141]: Chat with your knowledge
            - generic [ref=e142]: Ctrl+Shift+I
        - generic [ref=e143]:
          - img [ref=e144]
          - generic [ref=e146]:
            - text: Press
            - strong [ref=e147]: Ctrl+P
            - text: anywhere to open Quick Search
    - complementary:
      - generic:
        - generic:
          - generic:
            - generic:
              - img
              - generic: Details
          - generic:
            - generic:
              - img
              - generic: Outline
        - generic:
          - generic:
            - generic: No file selected
    - generic [ref=e149]:
      - generic [ref=e150] [cursor=pointer]: details
      - generic [ref=e151]: /
      - generic [ref=e152] [cursor=pointer]: docs
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
  20 | test.afterEach(async () => {
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
  48 |     (e) =>
  49 |       !e.includes('IndexedDB') &&
  50 |       !e.includes('extension') &&
  51 |       !e.includes('devtools')
  52 |   )
  53 | 
  54 |   expect(fatalErrors).toHaveLength(0)
  55 | })
  56 | 
  57 | test('app shell renders with sidebar', async () => {
  58 |   // Target the New Note button specifically (not the welcome page text which also says "new note")
  59 |   await expect(page.getByRole('button', { name: 'New Note', exact: true })).toBeVisible({
  60 |     timeout: 20_000
  61 |   })
  62 | })
  63 | 
  64 | test('note count is shown in sidebar', async () => {
  65 |   // Empty vault → "0 NOTES" label visible
  66 |   await expect(page.locator('text=0 NOTES')).toBeVisible({ timeout: 20_000 })
  67 | })
  68 | 
  69 | test('welcome page shortcuts are visible when no notes exist', async () => {
  70 |   // Welcome action cards shown when vault is empty
  71 |   await expect(page.locator('text=Create a new note')).toBeVisible({ timeout: 20_000 })
> 72 |   await expect(page.locator('text=Quick Search')).toBeVisible({ timeout: 20_000 })
     |                                                   ^ Error: expect(locator).toBeVisible() failed
  73 |   await expect(page.locator('text=AI Assistant')).toBeVisible({ timeout: 20_000 })
  74 | })
  75 | 
```