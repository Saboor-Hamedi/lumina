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
        console.warn(`[launch] Electron launch attempt ${attempt} failed (${err?.message || err}), retrying...`)
        await new Promise((resolve) => setTimeout(resolve, 1500 * attempt))
      }
    }
  }

  try {
    await fs.rm(vaultPath, { recursive: true, force: true }).catch(() => {})
  } catch {}

  throw lastError
}

async function launchOnce(vaultPath) {
  // Unique userData per launch: all app instances otherwise share one SQLite DB
  // and cache dir, which causes Windows fast-fail crashes (0xC0000409) when apps
  // are relaunched back-to-back.
  const userDataPath = await fs.mkdtemp(path.join(os.tmpdir(), 'lumina-e2e-ud-'))

  let appInstance
  try {
    appInstance = await electron.launch({
      args: [
        '--no-sandbox',
        '--disable-gpu',
        `--user-data-dir=${userDataPath}`,
        MAIN_ENTRY
      ],
      env: {
        ...process.env,
        NODE_ENV: 'test',
        LUMINA_TEST_WORKSPACE: vaultPath,
        LUMINA_TEST_VAULT: vaultPath,
        LUMINA_TEST_USERDATA: userDataPath,
        ELECTRON_DISABLE_GPU: '1'
      },
      timeout: 25_000
    })

    // Wait for main window
    const page = await appInstance.firstWindow({ timeout: 25_000 })

    // Wait until JS has executed and React has loaded DOM
    await page.waitForLoadState('domcontentloaded')

    async function cleanup() {
      try {
        await appInstance.evaluate(({ app }) => app.quit())
      } catch {}

      const proc = appInstance.process()
      if (proc && proc.exitCode === null) {
        await new Promise((resolve) => {
          const timer = setTimeout(() => {
            try {
              proc.kill('SIGKILL')
            } catch {}
            resolve()
          }, 2000)
          proc.once('exit', () => {
            clearTimeout(timer)
            resolve()
          })
        })
      }

      try {
        await appInstance.close().catch(() => {})
      } catch {}

      try {
        await fs.rm(vaultPath, { recursive: true, force: true }).catch(() => {})
      } catch {}
      try {
        await fs.rm(userDataPath, { recursive: true, force: true }).catch(() => {})
      } catch {}
    }

    return { app: appInstance, page, workspacePath: vaultPath, vaultPath, cleanup }
  } catch (err) {
    if (appInstance) {
      try {
        await appInstance.close().catch(() => {})
      } catch {}
    }
    try {
      await fs.rm(userDataPath, { recursive: true, force: true }).catch(() => {})
    } catch {}
    throw err
  }
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
  await page
    .locator(`text=${text}`)
    .first()
    .waitFor({ state: 'visible', ...options })
}

module.exports = { launchApp, invokeIPC, waitForText }
