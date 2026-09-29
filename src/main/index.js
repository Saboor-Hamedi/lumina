/**
 * ============================================================================
 * Lumina Main Process Entrypoint
 * ============================================================================
 * 
 * High-level orchestration for the Electron application:
 * 1. Process & E2E Isolation: Configures independent userData for testing.
 * 2. Diagnostics: Global uncaught exception and crash reporting.
 * 3. Protocols: Registers privileged schemes ('asset://') and dev cache.
 * 4. IPC Handlers: Registers modular TypeScript handlers with Zod validation.
 * 5. Lifecycle & Window: Bootstraps storage, search indexers, and main window.
 */

import { app, BrowserWindow } from 'electron'
import {
  registerPrivilegedSchemes,
  configureAppCache,
  registerAssetProtocol,
  setupDevWebRequestFilters,
  createMainWindow,
  getMainWindow,
  initializeAppServices,
  handleBeforeQuit,
  handleWindowAllClosed,
  setupCrashReporting
} from './app'
import { registerAllIpcHandlers } from './handlers'
import { setupGoogleAuth } from './auth/googleAuth'
import { setupGmailIpc } from './email/gmailService'
import { registerOpenNoteHandler } from './handlers/useOpenNote'

// ── E2E Test Isolation ────────────────────────────────────────────────────────
// Give each launched instance its own userData dir so rapid relaunches under
// Playwright never contend on the same LevelDB cache or SQLite database.
if (process.env.LUMINA_TEST_USERDATA) {
  app.setPath('userData', process.env.LUMINA_TEST_USERDATA)
}

// ── Global Exception & Crash Handling ─────────────────────────────────────────
setupCrashReporting(getMainWindow)

// ── Pre-Ready Protocols & Caching ─────────────────────────────────────────────
// Custom schemes must be registered before the app triggers 'ready'
registerPrivilegedSchemes()
configureAppCache()

// ── Application Ready Lifecycle ───────────────────────────────────────────────
app.whenReady().then(async () => {
  // Network filters (e.g. Ollama localhost CORS allowances)
  setupDevWebRequestFilters()

  // Register custom asset protocol handler (asset://local/...)
  registerAssetProtocol()

  // Register all modular IPC handlers with runtime Zod validation
  registerAllIpcHandlers(getMainWindow)

  // External integrations (Google Auth, Gmail, file-association launch)
  setupGoogleAuth(getMainWindow)
  setupGmailIpc()
  registerOpenNoteHandler()

  // Initialize workspace, search indexers, and create the primary window
  await initializeAppServices(createMainWindow)
})

// ── OS Window & Activation Events ─────────────────────────────────────────────
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createMainWindow()
  }
})

app.on('before-quit', handleBeforeQuit)
app.on('window-all-closed', handleWindowAllClosed)
