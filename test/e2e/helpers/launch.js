/**
 * E2E Launch Helper
 *
 * Starts the real Electron app against a temporary vault directory so tests
 * never touch the user's real data. Provides helpers for IPC interactions.
 */

const { _electron: electron } = require('@playwright/test')
const path = require('path')
const os = require('os')
const fs = require('fs/promises')

const projectRoot = path.resolve(__dirname, '../../..')

// Path to the built Electron main entry
const MAIN_ENTRY = path.join(projectRoot, 'out/main/index.js')

/**
 * Launch the Lumina Electron app.
 *
 * Creates an isolated temp vault for this test, passes it via LUMINA_TEST_VAULT
 * env var (the main process reads this when NODE_ENV=test to skip the last-vault
 * config file, ensuring a clean state every time).
 *
 * Retries the launch a few times: on Windows, rapidly launching many Electron
 * instances back-to-back can transiently fail with STATUS_DLL_INIT_FAILED
 * (0xC0000142), unrelated to the app itself.
 *
 * @returns {{ app, page, vaultPath, cleanup }}
 */
async function launchApp() {
  // Fresh temp vault per test run — tests never share state
  const vaultPath = await fs.mkdtemp(path.join(os.tmpdir(), 'lumina-e2e-'))

  const maxAttempts = 3
  let lastError

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const appInstance = await launchOnce(vaultPath)
      return appInstance
    } catch (err) {
      lastError = err
      if (attempt < maxAttempts) {
        console.warn(`[launch] Electron launch attempt ${attempt} failed, retrying...`)
        await new Promise((resolve) => setTimeout(resolve, 1000 * attempt))
      }
    }
  }

  throw lastError
}

async function launchOnce(vaultPath) {
  const appInstance = await electron.launch({
    args: [MAIN_ENTRY],
    env: {
      ...process.env,
      NODE_ENV: 'test',
      LUMINA_TEST_VAULT: vaultPath,
      ELECTRON_DISABLE_GPU: '1'
    },
    timeout: 20_000
  })

  // Wait for main window
  const page = await appInstance.firstWindow()

  // Wait until JS has executed and React has rendered
  await page.waitForLoadState('load')
  // networkidle ensures React has finished its initial render cycle
  await page.waitForLoadState('networkidle').catch(() => {})


  async function cleanup() {
    try { await appInstance.close() } catch {}
    try { await fs.rm(vaultPath, { recursive: true, force: true }) } catch {}
  }

  return { app: appInstance, page, vaultPath, cleanup }
}

/**
 * Call a method on window.api from the renderer context.
 */
async function invokeIPC(page, method, ...args) {
  return page.evaluate(([m, a]) => window.api[m](...a), [method, args])
}

/**
 * Wait for text to appear on page.
 */
async function waitForText(page, text, options = {}) {
  await page.locator(`text=${text}`).first().waitFor({ state: 'visible', ...options })
}

module.exports = { launchApp, invokeIPC, waitForText }
