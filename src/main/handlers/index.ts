/**
 * ============================================================================
 * Lumina IPC Handlers Dispatcher
 * ============================================================================
 *
 * Central dispatcher registering all IPC handler domains across Lumina's main process:
 * - Settings & Theme: SettingsManager persistence with schema-checked keys.
 * - Export: PDF, HTML, Markdown, Word (.docx), and text exports.
 * - System: Window state, hardware checks, clipboard, shortcuts, logging.
 * - Dialogs: Native directory pickers and destructive action confirmations.
 * - Backup: Google Drive workspace & file backups.
 * - Memory: Local agent memory storage (JSON).
 * - AI: Ollama model listing and NDJSON streaming proxy.
 * - Workspace / Vault: Note operations, indexing, and neural/full-text search.
 *
 * Design Guarantees:
 * 1. Safe Window Resolution: Uses a dynamic `getMainWindow` getter function to avoid
 *    stale references across window creation, reload, or destroy cycles.
 * 2. IPC Input Validation: All handlers validate untrusted renderer inputs via Zod
 *    schemas before passing them down to service layers.
 * 3. Backwards Compatibility: Maintains dual registration (`workspace:*` and `vault:*`)
 *    ensuring zero renderer breakage.
 */

import { BrowserWindow } from 'electron'
import { registerSettingsHandlers } from './settingsHandlers'
import { registerExportHandlers } from './exportHandlers'
import { registerSystemHandlers } from './systemHandlers'
import { registerDialogHandlers } from './dialogHandlers'
import { registerBackupHandlers } from './backupHandlers'
import { registerMemoryHandlers } from './memoryHandlers'
import { registerAiHandlers } from './aiHandlers'
import { registerWorkspaceHandlers } from './workspaceHandlers'

export function registerAllIpcHandlers(getMainWindow: () => BrowserWindow | null): void {
  registerSettingsHandlers()
  registerExportHandlers(getMainWindow)
  registerSystemHandlers(getMainWindow)
  registerDialogHandlers()
  registerBackupHandlers()
  registerMemoryHandlers()
  registerAiHandlers()
  registerWorkspaceHandlers(getMainWindow)
}

export * from './ipcValidation'
export * from './settingsHandlers'
export * from './exportHandlers'
export * from './systemHandlers'
export * from './dialogHandlers'
export * from './backupHandlers'
export * from './memoryHandlers'
export * from './aiHandlers'
export * from './workspaceHandlers'
