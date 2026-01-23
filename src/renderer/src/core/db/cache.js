import Dexie from 'dexie'

/**
 * Lumina Metadata Cache (IndexedDB Standard #10)
 * High-performance browser database for instant catalog indexing.
 */
export const db = new Dexie('LuminaVault')

db.version(2).stores({
  snippets: 'id, title, timestamp',
  settings: 'key',
  chatSessions: 'id, title, timestamp' // High-capacity AI storage
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
    console.error('Cache failed:', err)
    // Log individual failures for debugging
    if (err.failures) {
      console.error('Failed items:', err.failures)
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
