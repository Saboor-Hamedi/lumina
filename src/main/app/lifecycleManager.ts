/**
 * ============================================================================
 * Lumina Lifecycle & Service Initializer
 * ============================================================================
 * 
 * Coordinates startup sequences, service initialization, workspace path resolution,
 * background index workers, and graceful shutdown:
 * 
 * 1. Startup Diagnostics & Cache Repair:
 *    - Detects and automatically heals corrupted LevelDB manifests in IndexedDB.
 * 
 * 2. Workspace Path Resolution:
 *    - Respects Playwright E2E isolation (`LUMINA_TEST_WORKSPACE`).
 *    - Loads last active path from `app_config.json`.
 *    - Migrates legacy configurations from older Lumina versions.
 * 
 * 3. Core Engine Bootstrapping:
 *    - Concurrently initializes Settings, WorkspaceManager, Indexer, Search,
 *      and Brain neural knowledge base.
 * 
 * 4. Post-Load Optimization:
 *    - Pre-warms Web Workers and launches background index passes after window loads.
 * 
 * 5. Graceful Teardown:
 *    - Flushes pending settings to disk on quit or window closure.
 */

import { app, BrowserWindow } from 'electron'
import { join } from 'path'
import fs from 'fs/promises'
import WorkspaceManager from '../workspace/workspaceManager'
import SettingsManager from '../settings'
import WorkspaceIndexer from '../workspace/workspaceIndexer'
import WorkspaceSearch from '../workspace/workspaceSearch'
import BrainIndexer from '../workspace/brainIndexer'
// @ts-ignore
import { isAppQuitting } from '../handlers/useTrayIcon'

/**
 * Inspects LevelDB IndexedDB partitions for missing manifests and repairs corrupted caches.
 */
export async function autoRepairIndexedDB(): Promise<void> {
  try {
    const partitionsDir = join(app.getPath('userData'), 'Partitions', 'main', 'IndexedDB')
    const devDbDir = join(partitionsDir, 'http_localhost_5173.indexeddb.leveldb')
    const currentFile = join(devDbDir, 'CURRENT')
    const currentContent = await fs.readFile(currentFile, 'utf8').catch(() => null)
    if (currentContent) {
      const manifestName = currentContent.trim().replace(/^[\r\n]+|[\r\n]+$/g, '')
      const manifestPath = join(devDbDir, manifestName)
      const manifestExists = await fs.access(manifestPath).then(() => true).catch(() => false)
      if (!manifestExists) {
        console.warn('[IndexedDB] Corrupted LevelDB manifest detected, auto-healing cache:', devDbDir)
        await fs.rm(devDbDir, { recursive: true, force: true }).catch(() => {})
      }
    }
  } catch (_) {}
}

/**
 * Determines the startup workspace path across test, persisted config, and legacy paths.
 */
export async function resolveStartupWorkspacePath(userDataPath: string): Promise<string> {
  let savedWorkspacePath: string | null = null

  // ── E2E test mode ──────────────────────────────────────────────────────────
  // When launched by Playwright, LUMINA_TEST_WORKSPACE points to a fresh temp dir.
  if (process.env.LUMINA_TEST_WORKSPACE || process.env.LUMINA_TEST_VAULT) {
    savedWorkspacePath = process.env.LUMINA_TEST_WORKSPACE || process.env.LUMINA_TEST_VAULT || null
  } else {
    try {
      await SettingsManager.appConfig.load()
      savedWorkspacePath = SettingsManager.appConfig.getLastWorkspacePath()
    } catch (e) {
      // Fallback migration: read from legacy settings.json
      try {
        const oldSettings = await fs.readFile(join(userDataPath, 'settings.json'), 'utf8')
        const oldCfg = JSON.parse(oldSettings)
        savedWorkspacePath = oldCfg.lastWorkspacePath || oldCfg.workspacePath || oldCfg.vaultPath
      } catch (err) {}
    }
  }

  const oldDefaultPath = join(app.getPath('documents'), 'Lumina Vault')
  const newDefaultPath = join(app.getPath('documents'), 'lumina')

  if (!savedWorkspacePath || savedWorkspacePath === oldDefaultPath) {
    savedWorkspacePath = newDefaultPath
    SettingsManager.appConfig.setLastWorkspacePath(savedWorkspacePath)
    await SettingsManager.appConfig.save()
  }

  return savedWorkspacePath
}

/**
 * Initializes all core application engines, creates the main window, and schedules
 * background indexing operations.
 */
export async function initializeAppServices(createWindow: () => Promise<BrowserWindow>): Promise<void> {
  if (process.platform === 'win32') {
    app.setAppUserModelId(app.isPackaged ? 'io.lumina.app' : process.execPath)
  }

  const userDataPath = app.getPath('userData')
  const startupWorkspacePath = await resolveStartupWorkspacePath(userDataPath)

  // Initialize SettingsManager scoped to the active workspace
  await SettingsManager.init(startupWorkspacePath)

  // Initialize workspace full-text search and indexers
  await WorkspaceIndexer.init(userDataPath)
  await WorkspaceSearch.init(userDataPath)

  // Initialize Brain knowledge indexer (silent, isolated)
  await BrainIndexer.init(userDataPath).catch((err: unknown) =>
    console.warn('[Main] BrainIndexer init warning:', err)
  )

  const workspaceInitPromise = WorkspaceManager.init(startupWorkspacePath, app.getPath('documents'))

  // Ensure IndexedDB LevelDB caches are healthy before creating window
  await autoRepairIndexedDB()

  // Create the main application window
  const win = await createWindow()

  // Post-startup background indexing and optimization
  win.webContents.once('did-finish-load', () => {
    WorkspaceIndexer.warmWorker().catch((err: unknown) =>
      console.error('[Main] Worker pre-warm failed:', err)
    )

    // Background indexing of Lumina Brain knowledge base (silent, non-blocking)
    setTimeout(() => {
      BrainIndexer.indexBrain()
        .then((res: any) => {
          if (res?.indexed) {
            console.info(
              `[Main] ✓ Brain Knowledge Base indexed: ${res.totalFiles} files, ${res.totalChunks} sections`
            )
          }
        })
        .catch((err: unknown) => console.warn('[Main] Brain indexing notice:', err))
    }, 1500)

    if (startupWorkspacePath && typeof startupWorkspacePath === 'string') {
      setTimeout(() => {
        workspaceInitPromise
          .then(() =>
            WorkspaceIndexer.indexWorkspace(startupWorkspacePath, {
              force: false,
              onProgress: (stats: any) => {
                if (win && !win.isDestroyed()) {
                  win.webContents.send('index:progress', stats)
                }
              }
            })
          )
          .then(() => {
            return WorkspaceSearch.reload()
          })
          .catch((err: unknown) => {
            console.error('[Main] Startup workspace indexing failed:', err)
          })
      }, 1200)
    }
  })
}

/**
 * Handles graceful flush of settings before application termination.
 */
export async function handleBeforeQuit(): Promise<void> {
  try {
    await SettingsManager.flush()
  } catch (_) {}
}

/**
 * Handles window closure and background tray behavior.
 */
export async function handleWindowAllClosed(): Promise<void> {
  try {
    await SettingsManager.flush()
  } catch (_) {}

  const settings = SettingsManager.getAll()
  const launchOnStartup = settings?.launchOnStartup === true

  if (process.platform !== 'darwin' && (!launchOnStartup || isAppQuitting())) {
    app.quit()
  }
}
