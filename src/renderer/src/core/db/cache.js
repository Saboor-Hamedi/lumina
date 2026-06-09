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
      console.warn('[DB] Open failed, resetting database:', err.message || err)
      try {
        await Dexie.delete('LuminaVault_v2')
      } catch (_) {}
      try {
        dbOpenPromise = null
        await db.open()
      } catch (retryErr) {
        console.error('[DB] Cannot recreate database:', retryErr)
        dbOpenPromise = null
        throw retryErr
      }
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
