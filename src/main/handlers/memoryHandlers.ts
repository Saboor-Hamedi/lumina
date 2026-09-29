import { app, ipcMain } from 'electron'
import { join, dirname } from 'path'
import fs from 'fs/promises'
import { validateIpc, z } from './ipcValidation'

/**
 * ============================================================================
 * Assistant Memory IPC Handlers
 * ============================================================================
 * 
 * Manages long-term assistant memory stored in `%APPDATA%/lumina/memory.json`:
 * - `memory:load`: Reads user profile, preferences, and facts learned by the AI.
 * - `memory:save`: Persists updated user facts and preferences to disk.
 */

const memorySchema = z.record(z.string(), z.any())

export function registerMemoryHandlers(): void {
  const memoryFilePath = join(app.getPath('userData'), 'memory.json')

  // Load persistent AI memory (user bio, preferences, facts)
  ipcMain.handle('memory:load', async () => {
    try {
      const data = await fs.readFile(memoryFilePath, 'utf8')
      return JSON.parse(data)
    } catch (_) {
      const defaultMemory = {
        user: { name: null, role: null, bio: null },
        preferences: [],
        facts: []
      }
      try {
        await fs.mkdir(dirname(memoryFilePath), { recursive: true })
        await fs.writeFile(memoryFilePath, JSON.stringify(defaultMemory, null, 2), 'utf8')
      } catch (err) {
        console.error('[Main] Failed to create default memory.json:', err)
      }
      return defaultMemory
    }
  })

  // Save updated AI memory
  ipcMain.handle('memory:save', async (_, memory) => {
    try {
      const validMemory = validateIpc(memorySchema, memory)
      await fs.mkdir(dirname(memoryFilePath), { recursive: true })
      await fs.writeFile(memoryFilePath, JSON.stringify(validMemory, null, 2), 'utf8')
      return true
    } catch (err) {
      console.error('[Main] Failed to save memory.json:', err)
      return false
    }
  })
}
