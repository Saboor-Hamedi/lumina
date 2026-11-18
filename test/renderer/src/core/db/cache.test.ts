import { describe, it, expect, vi, beforeEach } from 'vitest'
import { openDb, db, cacheSnippets, getCachedSnippets } from '../../../../../src/renderer/src/core/db/cache'

describe('core/db/cache', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('openDb resolves cleanly without throwing', async () => {
    await expect(openDb()).resolves.toBeUndefined()
  })

  it('supports storing and retrieving cached snippets', async () => {
    const mockSnippets = [
      { id: 'snip-1', title: 'Snippet 1', code: 'console.log(1)', timestamp: 1000 },
      { id: 'snip-2', title: 'Snippet 2', code: 'console.log(2)', timestamp: 2000 }
    ]

    await cacheSnippets(mockSnippets)
    const cached = await getCachedSnippets()
    expect(Array.isArray(cached)).toBe(true)
  })

  it('supports fallback table query operations (orderBy, reverse, toArray, add, clear)', async () => {
    await db.chatSessions.clear()

    await db.chatSessions.add({ id: 'chat-1', title: 'First Chat', timestamp: 100 })
    await db.chatSessions.add({ id: 'chat-2', title: 'Second Chat', timestamp: 200 })

    const ordered = await db.chatSessions.orderBy('timestamp').reverse().toArray()
    expect(ordered.length).toBe(2)
    expect(ordered[0].id).toBe('chat-2')
    expect(ordered[1].id).toBe('chat-1')

    await db.chatSessions.clear()
    const cleared = await db.chatSessions.toArray()
    expect(cleared.length).toBe(0)
  })
})
