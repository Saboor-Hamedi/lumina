import { db, openDb } from '../../../core/db/cache'

/**
 * Chat Storage Service
 * Encapsulates IndexedDB persistence with localStorage fallback for multi-session chat history.
 */

export const loadChatSessions = async () => {
  try {
    let savedSessions = []
    try {
      await openDb()
      savedSessions = await db.chatSessions.orderBy('timestamp').reverse().toArray()
    } catch (dbErr) {
      console.warn('[ChatStorage] IndexedDB not available, falling back to localStorage:', dbErr)
    }

    // 2. Fallback to localStorage for migration or if DB is empty
    if (savedSessions.length === 0) {
      const legacy = localStorage.getItem('lumina-chat-sessions')
      if (legacy) {
        try {
          const parsed = JSON.parse(legacy)
          if (Array.isArray(parsed) && parsed.length > 0) {
            savedSessions = parsed
            try {
              await openDb()
              await db.chatSessions.bulkAdd(parsed)
              localStorage.removeItem('lumina-chat-sessions')
            } catch (_) {}
          }
        } catch (_) {}
      }
    }

    if (savedSessions.length > 0) {
      const lastActive = localStorage.getItem('lumina-active-session-id')
      const activeId =
        lastActive && savedSessions.some((s) => s.id === lastActive)
          ? lastActive
          : savedSessions[0].id
      localStorage.setItem('lumina-active-session-id', activeId)
      return { sessions: savedSessions, activeSessionId: activeId }
    }

    // Initial default: create first session
    const firstSession = {
      id: crypto.randomUUID(),
      title: 'New Chat',
      messages: [],
      timestamp: Date.now()
    }

    try {
      await openDb()
      await db.chatSessions.add(firstSession)
    } catch (e) {
      console.warn('[ChatStorage] Failed to save initial session to db:', e)
    }

    localStorage.setItem('lumina-active-session-id', firstSession.id)
    return { sessions: [firstSession], activeSessionId: firstSession.id }
  } catch (e) {
    console.warn('[ChatStorage] Failed to load sessions:', e)
    const fallbackSession = {
      id: crypto.randomUUID(),
      title: 'New Chat',
      messages: [],
      timestamp: Date.now()
    }
    return { sessions: [fallbackSession], activeSessionId: fallbackSession.id }
  }
}

export const createNewChatSession = async (existingSessions) => {
  const emptySession = existingSessions.find((s) => s.messages.length === 0)
  if (emptySession) {
    localStorage.setItem('lumina-active-session-id', emptySession.id)
    return { session: emptySession, isNew: false }
  }

  const newSession = {
    id: crypto.randomUUID(),
    title: 'New Chat',
    messages: [],
    timestamp: Date.now()
  }

  try {
    await openDb()
    await db.chatSessions.add(newSession)
  } catch (e) {
    console.warn('[ChatStorage] Failed to save new session to db, falling back to localStorage:', e)
    const updated = [newSession, ...existingSessions]
    localStorage.setItem('lumina-chat-sessions', JSON.stringify(updated))
  }

  localStorage.setItem('lumina-active-session-id', newSession.id)
  return { session: newSession, isNew: true }
}

export const deleteChatSession = async (sessionId, currentSessions) => {
  try {
    await openDb()
    await db.chatSessions.delete(sessionId)
  } catch (e) {
    console.warn('[ChatStorage] Failed to delete session from db, falling back to localStorage:', e)
    const filtered = currentSessions.filter((s) => s.id !== sessionId)
    localStorage.setItem('lumina-chat-sessions', JSON.stringify(filtered))
  }
}

export const persistChatHistory = async (sessions, activeSessionId, chatMessages) => {
  if (!activeSessionId) return { sessions }

  let updatedSession = null
  const newSessions = sessions.map((s) => {
    if (s.id === activeSessionId) {
      let title = s.title
      if (title === 'New Chat' && chatMessages.length > 0) {
        const firstUserMsg = chatMessages.find((m) => m.role === 'user')
        if (firstUserMsg && firstUserMsg.content) {
          title =
            firstUserMsg.content.slice(0, 30).trim() +
            (firstUserMsg.content.length > 30 ? '...' : '')
        }
      }
      updatedSession = { ...s, messages: chatMessages, title, timestamp: Date.now() }
      return updatedSession
    }
    return s
  })

  if (updatedSession) {
    try {
      await openDb()
      await db.chatSessions.put(updatedSession)
    } catch (e) {
      console.warn('[ChatStorage] Failed to save chat history to db, falling back to localStorage:', e)
      localStorage.setItem('lumina-chat-sessions', JSON.stringify(newSessions))
    }
  }

  return { sessions: newSessions, updatedSession }
}
