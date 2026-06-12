import Dexie from 'dexie'

export const db = new Dexie('LuminaVault_v2')

db.version(1).stores({
  snippets: 'id, title, timestamp',
  settings: 'key'
})

db.version(2).stores({
  snippets: 'id, title, timestamp',
  settings: 'key',
  chatSessions: 'id, title, timestamp'
})

db.version(3).stores({
  snippets: 'id, title, timestamp',
  settings: 'key',
  chatSessions: 'id, title, timestamp'
})

let dbOpenPromise = null

export const openDb = async () => {
  if (dbOpenPromise) return dbOpenPromise
  dbOpenPromise = (async () => {
    try {
      await db.open()
    } catch (err) {
      console.warn('[DB] Open failed:', err.message || err)
      
      // Only attempt to delete and recreate if it's a structural error (like VersionError)
      // Do NOT delete on temporary locks (UnknownError) to avoid wiping user chat sessions.
      if (err.name === 'VersionError') {
        console.warn('[DB] Structural error detected, resetting database...')
        try {
          await Dexie.delete('LuminaVault_v2')
        } catch (_) {}
        try {
          dbOpenPromise = null
          await db.open()
          return
        } catch (retryErr) {
          console.error('[DB] Cannot recreate database:', retryErr)
          dbOpenPromise = null
          throw retryErr
        }
      }
      
      dbOpenPromise = null
      throw err
    }
  })()
  return dbOpenPromise
}

openDb().catch(() => {})

export const cacheSnippets = async (snippets) => {
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
  } catch (err) {
    console.error('Cache failed:', err.message || err)
  }
}

export const getCachedSnippets = async () => {
  try {
    await openDb()
    const cached = await db.snippets.toArray()
    return cached || []
  } catch (err) {
    console.error('Cache read failed:', err)
    return []
  }
}
