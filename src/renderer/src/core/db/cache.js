import Dexie from 'dexie'

/**
 * Lumina Metadata Cache (IndexedDB Standard #10)
 * High-performance browser database for instant catalog indexing.
 */
// Renamed to v2 to bypass stuck schema locks on original DB
export const db = new Dexie('LuminaVault_v2')

// Self-healing: Delete DB if version error occurs on open
db.on('versionchange', function(event) {
  event.target.close(); // Close db to allow other tab to upgrade
});


// Version 1: Initial schema
db.version(1).stores({
  snippets: 'id, title, timestamp',
  settings: 'key'
})

// Version 2: Added chatSessions (schema upgrade)
db.version(2).stores({
  snippets: 'id, title, timestamp',
  settings: 'key',
  chatSessions: 'id, title, timestamp'
})

// Version 3: Ensure consistency
db.version(3).stores({
  snippets: 'id, title, timestamp',
  settings: 'key',
  chatSessions: 'id, title, timestamp'
})

export const cacheSnippets = async (snippets) => {
  try {
    // Use bulkPut instead of bulkAdd to handle duplicates
    // bulkPut will update existing records instead of failing
    await db.snippets.clear()

    // Store complete snippet data for instant restore
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
    if (err.name === 'DexieError' || err.name === 'VersionError') {
       console.warn('Database v2 corruption detected. Resetting...')
       await Dexie.delete('LuminaVault_v2')
       window.location.reload()
    }
  }
}

export const getCachedSnippets = async () => {
  try {
    const cached = await db.snippets.toArray()
    return cached || []
  } catch (err) {
    console.error('Cache read failed:', err)
    return []
  }
}
