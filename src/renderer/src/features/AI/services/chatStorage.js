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

export const generateSmartChatTitle = (rawPrompt) => {
  if (!rawPrompt || typeof rawPrompt !== 'string') return 'New Chat'

  let text = rawPrompt
    // Remove code blocks and backticks
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`([^`]+)`/g, '$1')
    // Remove wikilinks brackets [[Title|Alias]] -> Alias or Title
    .replace(/\[\[(?:[^|\]]*\|)?([^\]]+)\]\]/g, '$1')
    // Remove @mentions symbol
    .replace(/@([a-zA-Z0-9_\-./]+)/g, '$1')
    // Remove URLs
    .replace(/https?:\/\/\S+/gi, '')
    // Remove markdown headers and blockquotes
    .replace(/^[#>\-\s*]+/gm, '')
    .trim()

  // Remove common conversational command prefixes
  const prefixRegex =
    /^(?:hey\s+(?:lumina|ai)\s*,?|hi\s+(?:lumina|ai)?\s*,?|hello\s*,?|please\s+|can\s+you\s+(?:please\s+)?|could\s+you\s+(?:please\s+)?|i\s+(?:want|need)\s+to\s+|help\s+me\s+(?:to\s+)?|tell\s+me\s+about\s+|explain\s+(?:to\s+me\s+)?(?:about\s+)?|what\s+is\s+(?:the\s+)?|what\s+are\s+(?:the\s+)?|how\s+to\s+|how\s+do\s+i\s+|write\s+(?:a\s+|an\s+)?|create\s+(?:a\s+|an\s+)?|make\s+(?:a\s+|an\s+)?|draft\s+(?:a\s+|an\s+)?|build\s+(?:a\s+|an\s+)?|go\s+create\s+(?:a\s+|an\s+)?|go\s+draft\s+(?:a\s+|an\s+)?)/i

  while (prefixRegex.test(text)) {
    text = text.replace(prefixRegex, '').trim()
  }

  // Fallback if stripped everything
  if (!text) {
    text = rawPrompt.replace(/^[#>\-\s*]+/gm, '').trim()
  }

  // Capitalize first character
  if (text.length > 0) {
    text = text.charAt(0).toUpperCase() + text.slice(1)
  }

  // Truncate cleanly at word boundary up to ~34 characters
  const MAX_LEN = 34
  if (text.length > MAX_LEN) {
    const cut = text.slice(0, MAX_LEN)
    const lastSpace = cut.lastIndexOf(' ')
    if (lastSpace > 16) {
      text = cut.slice(0, lastSpace).trim() + '...'
    } else {
      text = cut.trim() + '...'
    }
  }

  return text || 'New Chat'
}

export const renameChatSession = async (sessionId, newTitle, currentSessions) => {
  const cleanTitle = (newTitle || '').trim() || 'New Chat'
  let updatedSession = null
  const updated = currentSessions.map((s) => {
    if (s.id === sessionId) {
      updatedSession = { ...s, title: cleanTitle }
      return updatedSession
    }
    return s
  })

  if (updatedSession) {
    try {
      await openDb()
      await db.chatSessions.put(updatedSession)
    } catch (e) {
      console.warn('[ChatStorage] Failed to rename session in db:', e)
      localStorage.setItem('lumina-chat-sessions', JSON.stringify(updated))
    }
  }

  return { sessions: updated, updatedSession }
}

export const togglePinChatSession = async (sessionId, currentSessions) => {
  let updatedSession = null
  const updated = currentSessions.map((s) => {
    if (s.id === sessionId) {
      updatedSession = { ...s, isPinned: !s.isPinned }
      return updatedSession
    }
    return s
  })

  if (updatedSession) {
    try {
      await openDb()
      await db.chatSessions.put(updatedSession)
    } catch (e) {
      console.warn('[ChatStorage] Failed to toggle pin in db:', e)
      localStorage.setItem('lumina-chat-sessions', JSON.stringify(updated))
    }
  }

  return { sessions: updated, updatedSession }
}

export const duplicateChatSession = async (sessionId, currentSessions) => {
  const target = currentSessions.find((s) => s.id === sessionId)
  if (!target) return { sessions: currentSessions, newSession: null }

  const newSession = {
    ...target,
    id: crypto.randomUUID(),
    title: `${target.title || 'Chat'} (Copy)`,
    timestamp: Date.now(),
    isPinned: false
  }

  const updated = [newSession, ...currentSessions]

  try {
    await openDb()
    await db.chatSessions.add(newSession)
  } catch (e) {
    console.warn('[ChatStorage] Failed to duplicate session in db:', e)
    localStorage.setItem('lumina-chat-sessions', JSON.stringify(updated))
  }

  localStorage.setItem('lumina-active-session-id', newSession.id)
  return { sessions: updated, newSession }
}

export const clearChatSessionMessages = async (sessionId, currentSessions) => {
  let updatedSession = null
  const updated = currentSessions.map((s) => {
    if (s.id === sessionId) {
      updatedSession = { ...s, messages: [], timestamp: Date.now() }
      return updatedSession
    }
    return s
  })

  if (updatedSession) {
    try {
      await openDb()
      await db.chatSessions.put(updatedSession)
    } catch (e) {
      console.warn('[ChatStorage] Failed to clear session messages in db:', e)
      localStorage.setItem('lumina-chat-sessions', JSON.stringify(updated))
    }
  }

  return { sessions: updated, updatedSession }
}

export const persistChatHistory = async (sessions, activeSessionId, chatMessages) => {
  if (!activeSessionId) return { sessions }

  let updatedSession = null
  const newSessions = sessions.map((s) => {
    if (s.id === activeSessionId) {
      let title = s.title
      if ((title === 'New Chat' || !title) && chatMessages.length > 0) {
        const firstUserMsg = chatMessages.find((m) => m.role === 'user')
        if (firstUserMsg && firstUserMsg.content) {
          title = generateSmartChatTitle(firstUserMsg.content)
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
