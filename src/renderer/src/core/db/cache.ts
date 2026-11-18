/**
 * cache.ts
 * 
 * Resilient IndexedDB cache layer for Lumina.
 * 
 * Architecture & Guarantees:
 * - Automatic Recovery: If Chromium LevelDB corruption occurs, safely closes, deletes, and recreates.
 * - Multi-Tier Fallback: If LuminaVault_v2 LevelDB is unrecoverable, falls back to LuminaVault_v3 partition,
 *   and finally to an in-memory / localStorage adapter with zero console errors or unhandled crashes.
 * - API Parity: Full query interface compatibility (toArray, orderBy, reverse, bulkAdd, bulkPut, get, put, delete).
 */

import Dexie from 'dexie'

function createDexieInstance(name: string): Dexie {
  const instance = new Dexie(name)
  instance.version(1).stores({
    snippets: 'id, title, timestamp',
    settings: 'key'
  })
  instance.version(2).stores({
    snippets: 'id, title, timestamp',
    settings: 'key',
    chatSessions: 'id, title, timestamp'
  })
  return instance
}

let activeDb: Dexie = createDexieInstance('LuminaVault_v2')
let dbOpenPromise: Promise<void> | null = null
let isFallbackMode = false

// In-memory fallback tables for when IndexedDB is blocked or corrupted
const memoryTables: Record<string, Map<string, any>> = {
  snippets: new Map(),
  settings: new Map(),
  chatSessions: new Map()
}

// Initialize memory tables from localStorage if available
function initFallbackStorage() {
  try {
    const savedChat = localStorage.getItem('lumina-chat-sessions-fallback')
    if (savedChat) {
      const parsed = JSON.parse(savedChat)
      if (Array.isArray(parsed)) {
        for (const item of parsed) {
          if (item?.id) memoryTables.chatSessions.set(item.id, item)
        }
      }
    }
  } catch (_) {}
}

function persistFallbackChat() {
  try {
    const items = Array.from(memoryTables.chatSessions.values())
    localStorage.setItem('lumina-chat-sessions-fallback', JSON.stringify(items))
  } catch (_) {}
}

function getFallbackTable(tableName: string) {
  if (!memoryTables[tableName]) {
    memoryTables[tableName] = new Map()
  }
  const store = memoryTables[tableName]

  return {
    async toArray() {
      return Array.from(store.values())
    },
    async clear() {
      store.clear()
      if (tableName === 'chatSessions') persistFallbackChat()
    },
    async add(item: any) {
      const key = item.id || item.key || String(Date.now())
      store.set(key, item)
      if (tableName === 'chatSessions') persistFallbackChat()
      return key
    },
    async put(item: any) {
      const key = item.id || item.key || String(Date.now())
      store.set(key, item)
      if (tableName === 'chatSessions') persistFallbackChat()
      return key
    },
    async bulkAdd(items: any[]) {
      for (const item of items) {
        const key = item.id || item.key || String(Date.now())
        store.set(key, item)
      }
      if (tableName === 'chatSessions') persistFallbackChat()
    },
    async bulkPut(items: any[]) {
      for (const item of items) {
        const key = item.id || item.key || String(Date.now())
        store.set(key, item)
      }
      if (tableName === 'chatSessions') persistFallbackChat()
    },
    async get(key: string) {
      return store.get(key) || null
    },
    async delete(key: string) {
      store.delete(key)
      if (tableName === 'chatSessions') persistFallbackChat()
    },
    orderBy(field: string) {
      return {
        reverse() {
          return {
            async toArray() {
              const all = Array.from(store.values())
              all.sort((a, b) => {
                const valA = a[field] ?? 0
                const valB = b[field] ?? 0
                return valB > valA ? 1 : valB < valA ? -1 : 0
              })
              return all
            }
          }
        },
        async toArray() {
          const all = Array.from(store.values())
          all.sort((a, b) => {
            const valA = a[field] ?? 0
            const valB = b[field] ?? 0
            return valA > valB ? 1 : valA < valB ? -1 : 0
          })
          return all
        }
      }
    }
  }
}

export const db: any = new Proxy({} as any, {
  get(_target, prop: string) {
    if (isFallbackMode) {
      return getFallbackTable(prop)
    }
    if (prop in activeDb) {
      const val = (activeDb as any)[prop]
      return typeof val === 'function' ? val.bind(activeDb) : val
    }
    return getFallbackTable(prop)
  }
})

export const openDb = async (): Promise<void> => {
  if (isFallbackMode) return
  if (dbOpenPromise) return dbOpenPromise

  dbOpenPromise = (async () => {
    try {
      await activeDb.open()
    } catch (err: any) {
      console.warn('[DB] Initial IndexedDB open failed:', err?.message || err)

      // 1. Cleanly close active connection handle
      try {
        activeDb.close()
      } catch (_) {}

      // 2. Safely purge corrupted database files
      try {
        await Dexie.delete('LuminaVault_v2')
      } catch (_) {}
      try {
        if (typeof indexedDB !== 'undefined' && indexedDB.deleteDatabase) {
          indexedDB.deleteDatabase('LuminaVault_v2')
        }
      } catch (_) {}

      // 3. Attempt to recreate LuminaVault_v2 with a fresh instance
      try {
        activeDb = createDexieInstance('LuminaVault_v2')
        await activeDb.open()
        return
      } catch (retryErr: any) {
        console.warn('[DB] Recreate LuminaVault_v2 failed, attempting clean LuminaVault_v3 partition:', retryErr?.message || retryErr)
      }

      // 4. Fallback to clean LuminaVault_v3 partition if v2 disk directory is corrupted
      try {
        activeDb = createDexieInstance('LuminaVault_v3')
        await activeDb.open()
        return
      } catch (v3Err: any) {
        console.warn('[DB] IndexedDB unavailable in this environment, activating in-memory fallback:', v3Err?.message || v3Err)
      }

      // 5. Activate in-memory storage fallback
      initFallbackStorage()
      isFallbackMode = true
    }
  })()

  return dbOpenPromise
}

// Non-blocking initialization
openDb().catch(() => {})

export const cacheSnippets = async (snippets: any[]): Promise<void> => {
  try {
    await openDb()
    await db.snippets.clear()

    const cacheData = snippets.map((s) => ({
      id: s.id,
      title: s.title || 'Untitled',
      code: s.code || '',
      language: s.language || 'markdown',
      tags: s.tags || '',
      timestamp: s.timestamp || Date.now(),
      selection: s.selection || null,
      isPinned: s.isPinned || false,
      type: s.type || 'snippet',
      is_draft: s.is_draft || 0
    }))

    await db.snippets.bulkPut(cacheData)
  } catch (err: any) {
    console.warn('[DB] Snippet caching skipped:', err?.message || err)
  }
}

export const getCachedSnippets = async (): Promise<any[]> => {
  try {
    await openDb()
    const cached = await db.snippets.toArray()
    return cached || []
  } catch (err) {
    console.warn('[DB] Snippet cache read skipped:', err)
    return []
  }
}
