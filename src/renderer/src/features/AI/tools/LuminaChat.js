import { create } from 'zustand'
import { db, openDb } from '../../../core/db/cache'
import { extractGraphContext } from '../services/graphContext.js'
import { detectUserIntent, getDynamicExemplars } from '../services/intentRouter.js'

let aiSdk
let createDeepseekProvider
async function ensureAISdk() {
  if (!aiSdk) {
    const [ai, ds] = await Promise.all([import('ai'), import('@ai-sdk/deepseek')])
    aiSdk = ai
    createDeepseekProvider = ds.createDeepSeek
  }
}

export const useAIStore = create((set, get) => {
  let worker = null

  const getWorker = () => {
    if (!worker) {
      worker = new Worker(new URL('../../../core/ai/ai.worker.js', import.meta.url), {
        type: 'module'
      })

      worker.onmessage = (e) => {
        const { type, status, id, result, progress } = e.data

        // Handle Progress
        if (type === 'progress') {
          if (status === 'progress') {
            set({ modelLoadingProgress: progress })

            // Update the loading message in chat with live percentage!
            const currentMessages = get().chatMessages
            if (currentMessages && currentMessages.length > 0) {
              const lastMsg = currentMessages[currentMessages.length - 1]
              if (lastMsg.isGenerating && progress) {
                const newMessages = [...currentMessages]
                const pct = Math.round(progress)
                // Only update if it's a significant jump to avoid React re-rendering 1000 times a second
                if (pct % 5 === 0) {
                  newMessages[newMessages.length - 1] = {
                    ...lastMsg,
                    content: `Downloading offline AI model... **${pct}%**`
                  }
                  set({ chatMessages: newMessages })
                }
              }
            }
          } else if (status === 'ready') {
            set({ isModelReady: true, modelLoadingProgress: 100 })

            // Switch to 'Generating...' once ready
            const currentMessages = get().chatMessages
            if (currentMessages && currentMessages.length > 0) {
              const lastMsg = currentMessages[currentMessages.length - 1]
              if (lastMsg.isGenerating) {
                const newMessages = [...currentMessages]
                newMessages[newMessages.length - 1] = {
                  ...lastMsg,
                  content: `Model loaded! Generating your file offline...`
                }
                set({ chatMessages: newMessages })
              }
            }
          }
          return
        }

        // Handle Task Completion
        const pending = get().pendingTasks.get(id)
        if (pending) {
          if (status === 'complete') {
            pending.resolve(result)
          } else {
            pending.reject(e.data.error)
          }
          const newMap = new Map(get().pendingTasks)
          newMap.delete(id)
          set({ pendingTasks: newMap })
        } else if (status === 'error') {
          // Global error
          console.error('AI Worker Error:', e.data.error)
          set({ aiError: e.data.error })
        }
      }
    }
    return worker
  }

  // Trigger initial session load
  setTimeout(() => {
    get().loadSessions()
  }, 0)

  return {
    aiError: null,
    isModelReady: false,
    modelLoadingProgress: 0,
    pendingTasks: new Map(),
    // Embeddings cache (currently empty - embeddings are handled by main process)
    // This is kept for backward compatibility with graph semantic links
    embeddingsCache: {},

    // Chat state
    chatError: null,
    isChatLoading: false,
    chatController: null,

    generateEmbedding: (text) => {
      return new Promise((resolve, reject) => {
        const id = crypto.randomUUID()
        const { pendingTasks } = get()
        const newMap = new Map(pendingTasks)
        newMap.set(id, { resolve, reject })
        set({ pendingTasks: newMap })

        getWorker().postMessage({ id, type: 'embed', payload: text })
      })
    },

    generateLocalText: (prompt) => {
      return new Promise((resolve, reject) => {
        const id = crypto.randomUUID()
        const { pendingTasks } = get()
        const newMap = new Map(pendingTasks)
        newMap.set(id, { resolve, reject })
        set({ pendingTasks: newMap })

        getWorker().postMessage({ id, type: 'generate', payload: prompt })
      })
    },

    // Search vault using persistent index (main process)
    searchNotes: async (query, threshold = 0.3) => {
      if (!query || !query.trim()) return []

      try {
        if (!window.api?.searchVault) {
          console.warn('[AIStore] Vault search API not available')
          return []
        }

        const results = await window.api.searchVault(query, {
          threshold,
          limit: 20,
          rerank: true
        })

        // Map to expected format for compatibility
        return results.map((result) => ({
          id: result.id,
          score: result.finalScore || result.score,
          chunk: result // Include full chunk data
        }))
      } catch (err) {
        console.error('[AIStore] Vault search failed:', err)
        return []
      }
    },

    // Index vault (triggers main process indexing)
    indexVault: async (vaultPath, options = {}) => {
      try {
        if (!window.api?.indexVault) {
          console.warn('[AIStore] Index API not available')
          return { success: false }
        }

        // Validate vaultPath - if not provided or invalid, pass null to let main process use VaultManager.vaultPath
        const validVaultPath = vaultPath && typeof vaultPath === 'string' ? vaultPath : null

        return await window.api.indexVault(validVaultPath, {
          force: options.force || false,
          onProgress: options.onProgress || null
        })
      } catch (err) {
        console.error('[AIStore] Indexing failed:', err)
        throw err
      }
    },

    // Get index statistics
    getIndexStats: async () => {
      try {
        if (!window.api?.getIndexStats) return null
        return await window.api.getIndexStats()
      } catch (err) {
        console.error('[AIStore] Get stats failed:', err)
        return null
      }
    },

    // --- DeepSeek Chat Integration ---
    // --- Multi-Session Chat Support ---
    sessions: [],
    activeSessionId: null,
    chatMessages: [],
    isChatLoading: false,
    chatError: null,

    // Initial load of sessions
    loadSessions: async () => {
      try {
        let savedSessions = []
        try {
          await openDb()
          savedSessions = await db.chatSessions.orderBy('timestamp').reverse().toArray()
        } catch (dbErr) {
          // IndexedDB not available or failed — fall through to localStorage fallback
        }

        // 2. Fallback to localStorage for migration or if DB is empty
        if (savedSessions.length === 0) {
          const legacy = localStorage.getItem('lumina-chat-sessions')
          if (legacy) {
            const parsed = JSON.parse(legacy)
            if (Array.isArray(parsed) && parsed.length > 0) {
              savedSessions = parsed
              try {
                await openDb()
                await db.chatSessions.bulkAdd(parsed)
                localStorage.removeItem('lumina-chat-sessions')
              } catch (_) {}
            }
          }
        }

        if (savedSessions.length > 0) {
          set({ sessions: savedSessions })

          // Default to last active or first session
          const lastActive = localStorage.getItem('lumina-active-session-id')
          if (lastActive && savedSessions.some((s) => s.id === lastActive)) {
            get().switchSession(lastActive)
          } else {
            get().switchSession(savedSessions[0].id)
          }
          return
        }

        // Fallback or Initial: Create first session
        const firstSession = {
          id: crypto.randomUUID(),
          title: 'New Chat',
          messages: [],
          timestamp: Date.now()
        }
        set({ sessions: [firstSession], activeSessionId: firstSession.id, chatMessages: [] })
        try {
          await openDb()
          await db.chatSessions.add(firstSession)
        } catch (e) {
          console.warn('[AIStore] Failed to save initial session to db:', e)
        }
      } catch (e) {
        console.warn('[AIStore] Failed to load sessions:', e)
      }
    },

    saveSessions: async () => {
      // With IndexedDB, we mainly update individual sessions,
      // but let's sync the list if needed.
    },

    createNewSession: async () => {
      const state = get()
      // Check if there's already an empty session
      const emptySession = state.sessions.find((s) => s.messages.length === 0)
      if (emptySession) {
        state.switchSession(emptySession.id)
        return
      }

      const newSession = {
        id: crypto.randomUUID(),
        title: 'New Chat',
        messages: [],
        timestamp: Date.now()
      }
      set((state) => ({
        sessions: [newSession, ...state.sessions],
        activeSessionId: newSession.id,
        chatMessages: []
      }))
      try {
        await openDb()
        await db.chatSessions.add(newSession)
      } catch (e) {
        console.warn('[AIStore] Failed to save new session to db, falling back to localStorage:', e)
        const currentSessions = get().sessions
        localStorage.setItem('lumina-chat-sessions', JSON.stringify(currentSessions))
      }
      localStorage.setItem('lumina-active-session-id', newSession.id)
    },

    switchSession: (sessionId) => {
      const { sessions } = get()
      const session = sessions.find((s) => s.id === sessionId)
      if (session) {
        set({
          activeSessionId: sessionId,
          chatMessages: session.messages || [],
          chatError: null
        })
        localStorage.setItem('lumina-active-session-id', sessionId)
      }
    },

    deleteSession: async (sessionId) => {
      set((state) => {
        const newSessions = state.sessions.filter((s) => s.id !== sessionId)
        let nextActiveId = state.activeSessionId

        if (state.activeSessionId === sessionId) {
          nextActiveId = newSessions.length > 0 ? newSessions[0].id : null
        }

        const nextMessages = nextActiveId
          ? newSessions.find((s) => s.id === nextActiveId)?.messages || []
          : []

        return {
          sessions: newSessions,
          activeSessionId: nextActiveId,
          chatMessages: nextMessages
        }
      })
      try {
        await openDb()
        await db.chatSessions.delete(sessionId)
      } catch (e) {
        console.warn('[AIStore] Failed to delete session from db, falling back to localStorage:', e)
        const currentSessions = get().sessions
        localStorage.setItem('lumina-chat-sessions', JSON.stringify(currentSessions))
      }

      const { activeSessionId } = get()
      if (activeSessionId) {
        localStorage.setItem('lumina-active-session-id', activeSessionId)
      } else {
        // If no sessions left, create a fresh one
        get().createNewSession()
      }
    },

    // Update active session messages
    saveChatHistory: async () => {
      const { sessions, activeSessionId, chatMessages } = get()
      if (!activeSessionId) return

      let updatedSession = null
      const newSessions = sessions.map((s) => {
        if (s.id === activeSessionId) {
          // Generate title from first message if it's still "New Chat"
          let title = s.title
          if (title === 'New Chat' && chatMessages.length > 0) {
            const firstUserMsg = chatMessages.find((m) => m.role === 'user')
            if (firstUserMsg) {
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

      set({ sessions: newSessions })
      if (updatedSession) {
        try {
          await openDb()
          await db.chatSessions.put(updatedSession)
        } catch (e) {
          console.warn(
            '[AIStore] Failed to save chat history to db, falling back to localStorage:',
            e
          )
          localStorage.setItem('lumina-chat-sessions', JSON.stringify(newSessions))
        }
      }
    },

    updateMessage: async (index, updates) => {
      set((state) => {
        const newMessages = [...state.chatMessages]
        if (newMessages[index]) {
          newMessages[index] = { ...newMessages[index], ...updates }
        }
        return { chatMessages: newMessages }
      })
      await get().saveChatHistory()
    },

    clearChat: async () => {
      const { activeSessionId } = get()
      if (activeSessionId) {
        set((state) => ({
          chatMessages: [],
          chatError: null
        }))
        await get().saveChatHistory()
      }
    },

    cancelChat: () => {
      const controller = get().chatController
      if (controller) {
        try {
          controller.abort()
        } catch (e) {
          console.warn('[AIStore] Abort error:', e)
        }
      }
      set({
        isChatLoading: false,
        chatController: null
      })
    },

    sendChatMessage: async (
      message,
      contextSnippets = [],
      mode = 'Standard',
      attachedMentions = []
    ) => {
      if (
        (!message || typeof message !== 'string' || !message.trim()) &&
        (!attachedMentions || attachedMentions.length === 0)
      ) {
        set({ chatError: 'Message cannot be empty.' })
        return
      }

      // LOCAL AI FILE GENERATOR INTERCEPT
      const cleanMessage = message.trim()
      const writeMatch = cleanMessage.match(/^write (?:a )?file about (.+)/i)

      if (writeMatch) {
        const topic = writeMatch[1].trim()

        const userMsg = {
          id: crypto.randomUUID(),
          role: 'user',
          content: cleanMessage,
          timestamp: Date.now()
        }
        const loadingMsg = {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: `Generating local file about: **${topic}**... This may take a moment if downloading the model for the first time.`,
          isGenerating: true,
          timestamp: Date.now()
        }

        const currentMessages = get().chatMessages || []
        set({
          chatMessages: [...currentMessages, userMsg, loadingMsg],
          isChatLoading: true,
          chatError: null
        })

        try {
          const prompt = `Write a detailed markdown document about ${topic}. Include headings, bullet points, and code examples if relevant.`
          const generatedContent = await get().generateLocalText(prompt)

          // Save to vault
          const vaultModule = await import('../../../core/store/workspaceStore')
          const vaultStore = vaultModule.useVaultStore.getState()
          const newSnippet = {
            id: crypto.randomUUID(),
            title: topic,
            code: generatedContent || `# ${topic}\n\n(No content generated)`,
            language: 'markdown',
            tags: '',
            timestamp: Date.now()
          }
          await vaultStore.saveSnippet(newSnippet)
          vaultStore.setSelectedSnippet(newSnippet)

          // Update chat
          const successMsg = {
            id: crypto.randomUUID(),
            role: 'assistant',
            content: `I have generated and created the file: **${topic}**. It is now open in your editor!`,
            timestamp: Date.now()
          }
          const current = get().chatMessages
          current[current.length - 1] = successMsg
          set({ chatMessages: [...current], isChatLoading: false })
          await get().saveChatHistory()
        } catch (err) {
          console.error('[AIStore] Local generation failed:', err)
          const current = get().chatMessages
          current[current.length - 1] = {
            id: crypto.randomUUID(),
            role: 'assistant',
            content: `Failed to generate file: ${err.message}`,
            timestamp: Date.now()
          }
          set({ chatMessages: [...current], isChatLoading: false })
        }
        return
      }

      if (!Array.isArray(contextSnippets)) {
        contextSnippets = []
      }

      let settings
      try {
        const settingsModule = await import('../../../core/store/useSettingsStore')
        settings = settingsModule.useSettingsStore.getState()
      } catch (err) {
        console.error('[AIStore] Failed to load settings:', err)
        set({ chatError: 'Failed to load settings.' })
        return
      }

      const settingsObj = settings?.settings || settings || {}
      const { deepSeekKey, deepSeekModel } = settingsObj

      const visibleKey = deepSeekKey || import.meta.env.VITE_DEEPSEEK_KEY

      // Normal Chat Flow
      const userMsg = {
        id: crypto.randomUUID(),
        role: 'user',
        content: message.trim(),
        timestamp: Date.now(),
        attachedMentions: attachedMentions
      }

      const currentMessages = get().chatMessages || []
      const newHistory = [...currentMessages, userMsg]

      if (!visibleKey) {
        set({
          chatMessages: newHistory,
          chatError: 'Missing API Key. Please configure it in Settings > Assistant.'
        })
        return
      }

      // 0. Parse @mentions (multi-word and single-word titles)
      const normalize = (str) =>
        (str || '')
          .toLowerCase()
          .replace(/[-_ .]/g, '')
          .replace(/\.md$/, '')

      const mentionedSnippets = []

      if (attachedMentions && attachedMentions.length > 0) {
        attachedMentions.forEach((snip) => {
          if (!mentionedSnippets.some((ms) => ms.id === snip.id)) {
            mentionedSnippets.push(snip)
          }
        })
      }

      try {
        const vaultModule = await import('../../../core/store/workspaceStore')
        const vaultSnippets = vaultModule.useVaultStore.getState().snippets || []

        // Match longest multi-word titles first so "@Types of RAG" matches as one entity
        const sortedSnippets = [...vaultSnippets].sort(
          (a, b) => (b.title?.length || 0) - (a.title?.length || 0)
        )

        for (const snip of sortedSnippets) {
          if (!snip.title) continue
          const escaped = snip.title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
          const pattern = new RegExp(`@${escaped}(?=[\\s,;.!?]|$)`, 'i')
          if (pattern.test(message)) {
            if (!mentionedSnippets.some((ms) => ms.id === snip.id)) {
              mentionedSnippets.push(snip)
            }
          }
        }

        // Fallback single-word mention scan
        const singleMentionRegex = /@([^\s,;.!?]+)/g
        const singleMentions = [...message.matchAll(singleMentionRegex)].map((m) => m[1])
        singleMentions.forEach((mentionTitle) => {
          const normMention = normalize(mentionTitle)
          const found = vaultSnippets.find((s) => {
            const normTitle = normalize(s.title || '')
            return (
              normTitle === normMention ||
              normTitle.includes(normMention) ||
              normMention.includes(normTitle)
            )
          })
          if (found && !mentionedSnippets.some((ms) => ms.id === found.id)) {
            mentionedSnippets.push(found)
          }
        })
      } catch (err) {
        console.warn('[AIStore] Mention scan failed:', err)
      }

      // 1. Auto-detect file mentions by name (e.g. "What do you know about QuickNote?")
      const requestedFiles = []
      try {
        const vaultModule = await import('../../../core/store/workspaceStore')
        const vaultSnippets = vaultModule.useVaultStore.getState().snippets
        const queryNorm = normalize(message)
        vaultSnippets.forEach((s) => {
          const normTitle = normalize(s.title || '')
          if (normTitle && normTitle.length >= 3 && queryNorm.includes(normTitle)) {
            if (
              !mentionedSnippets.some((m) => m.id === s.id) &&
              !requestedFiles.some((f) => f.id === s.id)
            ) {
              requestedFiles.push(s)
            }
          }
        })
        if (requestedFiles.length > 5) requestedFiles.length = 5
      } catch (err) {
        console.warn('[AIStore] File mention detection failed:', err)
      }

      const assistantMsg = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: '',
        timestamp: Date.now()
      }

      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller?.abort(), 180000)

      set({
        chatMessages: [...newHistory, assistantMsg],
        isChatLoading: true,
        chatError: null,
        chatController: controller
      })

      try {
        let vaultContext = []
        let vaultAccessNote = ''
        try {
          if (window.api?.searchVault) {
            const queryLength = message.trim().length
            const adaptiveThreshold = queryLength > 50 ? 0.2 : 0.3
            const searchResults = await window.api.searchVault(message, {
              threshold: adaptiveThreshold,
              limit: 10,
              rerank: true
            })

            if (searchResults?.length > 0) {
              vaultContext = searchResults
                .map((chunk) => ({
                  file: chunk?.metadata?.fileName || 'Unknown',
                  text: String(chunk?.text || '').trim(),
                  score: chunk?.finalScore || 0
                }))
                .slice(0, 8)
              vaultAccessNote = `Retrieved relevant context from workspace.`
            } else {
              vaultAccessNote = 'Synthesizing from general knowledge and active context.'
            }
          }
        } catch (searchErr) {
          console.warn('[AIStore] Vault search failed:', searchErr)
        }

        let systemPrompt = `You are Lumina, the intelligent and friendly AI assistant built directly into this AI-powered thinking environment. You are a highly capable intellectual thought partner.
You ONLY have access to the files and folders inside this specific Lumina workspace. Do NOT claim to see the user's entire Documents folder or full computer filesystem.

**STYLE & TONE**:
- Be warm, conversational, and highly engaging. You are brainstorming and thinking with the user, so act like a brilliant but friendly co-pilot.
- Provide high-signal, detailed responses.
- Cite file names clearly when quoting specific context.
- **Follow EVERY instruction the user gives**. If they ask for wikilinks, headers, formatting, or structure — do it without skipping.
- Produce **comprehensive, rich, detailed content**.

**🔗 WIKILINKS GUIDELINES**:
- Lumina supports double-bracket wikilinks: \`[[Note Title]]\` or \`[[Note Title|Alias]]\`.
- Use wikilinks **naturally and selectively** (e.g., when referencing other important notes or distinct concepts).
- **DO NOT SPAM WIKILINKS**: Never wrap every sentence, header, bullet, or repetition of a topic with brackets. In chat responses and conversational suggestions, write in clean, polished prose without repetitive \`[[\` \`]]\` tags.

**CRITICAL EXECUTION DIRECTIVES (ZERO TOLERANCE FOR FILLER PROMISES)**:
- **ABSOLUTE BAN ON FUTURE-TENSE PROMISES**: NEVER say "Let me read the file...", "Let me pull that up...", "I'll read it now...", "Let me check...", or "Let me see what's in it".
- When the user asks "what do you see?", "what do you read?", "have you read?", "so when?", or asks about any file:
  The note content is ALREADY provided in your context below.
  You MUST output the ACTUAL explanation, summary, and breakdown of what is inside the note IMMEDIATELY.
  NEVER promise to read it — simply deliver the actual answer right now!

**TOOLS AVAILABLE** (use these for file operations):
- 'readFile' — read a workspace file by title (only use when you do NOT already have the file content)
- 'appendToFile' — add new content to the END of an existing file
- 'createFile' — create a brand new workspace file (provide title + content, optional folder)
- 'updateFile' — targeted update to an existing note. Use \`sectionHeader\` (to replace/update or add a specific section), \`search\` & \`replace\` (for exact lines/words), \`insertAfter\`, or \`insertBefore\`. NEVER rewrite the whole file with \`content\` unless the user explicitly requested a complete rewrite from scratch.
- 'clearFile' — clear the content of a file or reset it cleanly
- 'renameFile' — rename a file (preserves folder and content) — ALWAYS use this instead of delete+create
- 'deleteFile' — delete a workspace file by title
- 'createFolder' — create a new folder in the workspace (provide path)
- 'deleteFolder' — delete a folder and ALL its contents from the workspace (provide path)
- 'moveFile' — move a file into a specific folder (provide title and newFolderId)
- 'openFile' — open a file in the user's editor tab so they can see it

**HOW TO USE TOOLS & ROUTE INTENT**:
1. **WHEN THE USER ASKS TO UPDATE, EDIT, MODIFY, OR FIX A NOTE (e.g. \`@NoteTitle update...\`, "update my file", "update this note", "change X to Y in note", "fix X in note", "add section X to note")**:
   - You MUST use targeted \`updateFile\` (specifying \`sectionHeader\`, \`search\` & \`replace\`, \`insertAfter\`, or \`insertBefore\`).
   - DO NOT overwrite the whole document. Target only the specific section or lines requested.
   - In your conversational walkthrough, present the exact updated part or diff clearly so the user sees what changed.
2. **WHEN THE USER ASKS WHAT IS IN A NOTE OR TO EXPLAIN/SUMMARIZE (e.g. "what do you see @NoteTitle", "what's in @NoteTitle", "summarize @NoteTitle", "explain @NoteTitle")**:
   - The note content is ALREADY provided below in this prompt under PRIMARY TARGET FILES.
   - DO NOT call file writing tools. Immediately summarize and explain the content and structure of the note directly in the chat!
3. **WHEN THE USER ASKS TO CREATE A NOTE OR TOPIC FILE (e.g. "write a draft on X", "write a topic about X", "create a note about X", "write comprehensive note on X", "make a file for X")**:
   - ALWAYS call \`createFile\` to create and open that note in the workspace editor with rich markdown headings!
4. **WHEN THE USER ASKS A CONVERSATIONAL OR CONCEPTUAL QUESTION (e.g. "tell me about RAG", "what is RAG?", "how does RAG work?", "compare X and Y")**:
   - Answer and explain directly in the chat window without modifying files!
5. **FOR "clear", "empty", or "wipe"** → call \`clearFile\` directly.
6. **FOR "rename"** → ONLY call \`renameFile\` if a new name is specified. If not, ask first.
7. **FOR "delete"** → call \`deleteFile\`.
8. **FOR "open"** → call \`openFile\`.
9. When modifying a file, call the tool and provide a clean, insightful thought-partner walkthrough in the chat. NEVER output pre-tool filler like "I'll add...".

**CONTEXT**:
${vaultAccessNote}`

        if (mentionedSnippets.length > 0) {
          const { useVaultStore } = await import('../../../core/store/workspaceStore')
          const vs = useVaultStore.getState()
          systemPrompt +=
            '\n\n**🎯 PRIMARY TARGET FILES (@-MENTIONED BY USER — YOUR HIGHEST FOCUS):**\n'
          mentionedSnippets.forEach((snip) => {
            const currentContent =
              vs.drafts?.[snip.id] !== undefined ? vs.drafts[snip.id] : snip.code || ''
            systemPrompt += `[Target Note: ${snip.title}]\n${currentContent}\n\n`
          })
          systemPrompt +=
            'CRITICAL DIRECTIVE:\n' +
            '1. The note content is ALREADY PROVIDED ABOVE in this prompt. Do NOT call readFile for this note.\n' +
            '2. Answer the user\'s question immediately, accurately, and thoroughly using the content above.\n' +
            '3. NEVER output conversational filler like "Let me check" or "Let me read what is in it". You ALREADY have the content right here, so give the actual answer immediately!\n'
        }

        if (requestedFiles.length > 0) {
          const { useVaultStore } = await import('../../../core/store/workspaceStore')
          const vs = useVaultStore.getState()
          systemPrompt +=
            '\n\n**Workspace Files Referenced (content already provided below):**\n'
          requestedFiles.forEach((f) => {
            if (!mentionedSnippets.some((m) => m.id === f.id)) {
              const currentContent =
                vs.drafts?.[f.id] !== undefined ? vs.drafts[f.id] : f.code || ''
              systemPrompt += `--- ${f.title} ---\n${currentContent}\n`
            }
          })
          systemPrompt +=
            'CRITICAL: The content of these files is ALREADY provided above. Answer questions about them directly right now without saying "let me read it".\n'
        }

        // Inject active open note if no explicit @-mentions were attached
        const { useVaultStore } = await import('../../../core/store/workspaceStore')
        const vs = useVaultStore.getState()
        if (mentionedSnippets.length === 0 && vs.selectedSnippet) {
          const activeNote = vs.selectedSnippet
          const activeCode =
            vs.drafts?.[activeNote.id] !== undefined
              ? vs.drafts[activeNote.id]
              : activeNote.code || ''
          systemPrompt +=
            `\n\n**🎯 CURRENTLY OPEN ACTIVE NOTE IN EDITOR: [Note: ${activeNote.title}]**\n` +
            `${activeCode}\n\n` +
            `CRITICAL DIRECTIVE:\n` +
            `1. The user is currently viewing this open note in their workspace editor.\n` +
            `2. When they ask "what do you see", "what do you read", "what is this", or ask questions about their note, the content is ALREADY provided above. Answer and explain immediately based on this content without calling readFile or saying "let me read it"!\n`
        }

        // Only inject active tabs context if no explicit @-mentions were attached
        if (mentionedSnippets.length === 0 && contextSnippets.length > 0) {
          systemPrompt += '\n\n**Active Tabs Context:**\n'
          contextSnippets.forEach((snip) => {
            const currentCode =
              vs.drafts?.[snip.id] !== undefined ? vs.drafts[snip.id] : snip.code || ''
            systemPrompt += `[File: ${snip.title}]\n${currentCode.slice(0, 1500)}\n\n`
          })
        }

        // Only inject generic workspace knowledge if no specific file is explicitly targeted
        if (mentionedSnippets.length === 0 && vaultContext.length > 0) {
          systemPrompt += `\n\n**Workspace Knowledge:**\n`
          vaultContext.forEach((ctx, i) => {
            systemPrompt += `[${i + 1}] source: ${ctx.file}\n${ctx.text}\n\n`
          })
        }

        systemPrompt +=
          '\n\nCRITICAL RULES FOR FILE & FOLDER TOOLS:\n' +
          '1. NEVER output ANY conversational narration or thinking before calling a tool. If a tool is needed, call the tool IMMEDIATELY on the very first step. Never say "I will create...", "Let me start by...", "Let me do that...". Call the tool directly.\n' +
          '2. If the user asks to create a folder with a specific name or path (e.g. "create folder Science", "create folder src/database", "add the react js folder structure with all folders") → call createFolder directly with the path (or call createFolder for each folder in the structure).\n' +
          '3. If the user asks to create a folder WITHOUT specifying a name (e.g. "create a folder", "make a new folder") → politely ask the user: "What would you like to name the folder?" Do NOT create a folder called "New Folder" unless the user explicitly asked for that name.\n' +
          '4. If the user asks to create a note or file WITHOUT specifying a title/topic (e.g. "create a file", "create a note", "make a new note") → politely ask the user: "What should the note be named, and what topic would you like it to cover?" If the user explicitly asks for a random note (e.g. "create a random note", "draft any note") or provides a title/topic, call createFile immediately.\n' +
          '5. If asked to DRAFT/CREATE A STUDY PLAN, TEMPLATE, OR FOLDER+FILE STRUCTURE (e.g. "draft them all into my vault", "create a study plan with folders and notes", "generate this structure") → you MUST create the folders AND immediately create the notes inside them with rich markdown content in the SAME response! Call createFolder for directories, and call createFile with folder="<Folder Path>" and full rich content for each note. NEVER stop after creating only folders.\n' +
          '6. If asked to CREATE A NOTE IN A FOLDER → call createFile with folder="<Folder Path>" (e.g. folder="src/database").\n' +
          '7. If asked to MOVE A FILE → call moveFile with title="current" (or note title) and folder="<Destination Folder>".\n' +
          '8. If asked to RENAME a file → call renameFile with oldTitle="current" (or note title) and newTitle="<New Name>". If no new name is provided, ask the user first.\n' +
          '9. If asked to DELETE a file → call deleteFile with title="current" (or note title) DIRECTLY.\n' +
          '10. If asked to RENAME A FOLDER → call renameFolder DIRECTLY.\n' +
          '11. If asked to DELETE A FOLDER (or folders) → call deleteFolder DIRECTLY for each requested folder.\n' +
          '12. If asked to UPDATE, EDIT, MODIFY, or FIX a note → call updateFile with targeted sectionHeader, search & replace, insertAfter, or insertBefore DIRECTLY. Never wipe the rest of the file.\n' +
          '13. If asked to ADD or WRITE content to the end of a note → call appendToFile DIRECTLY.\n' +
          '14. If asked to CLEAR or EMPTY a file → call updateFile with content: "" DIRECTLY.\n' +
          '15. If asked to EXPLAIN a file → call readFile DIRECTLY.\n' +
          '16. When outputting folder/file trees or hierarchies in chat responses, ALWAYS wrap them in a code block with language text (e.g. ```text\\n📁 Root\\n├── 📁 01_Folder\\n└── 📁 02_Folder\\n```) with each branch on its own separate line so it renders cleanly.\n' +
          '17. After performing tool operations, write a comprehensive, clear walkthrough in chat explaining what was built or modified, highlighting key topics, wikilinks, and the exact updated section or diff so the user can see what changed.\n' +
          '\n' +
          'EXAMPLES:\n' +
          'User: "Create folder Science" → [Call createFolder with path="Science"]\n' +
          'User: "Create folder database inside src" → [Call createFolder with path="src/database"]\n' +
          'User: "create a folder" → "What would you like to name the folder?"\n' +
          'User: "create a file" → "What should the note be named, and what topic would you like it to cover?"\n' +
          'User: "Draft the NLP study plan into my vault" → [Call createFolder for each folder, AND call createFile for each note inside its folder with full markdown content!]\n' +
          'User: "Create note Schema in src/database" → [Call createFile with title="Schema" folder="src/database" content="..."]\n' +
          'User: "Update the Features section in my note" → [Call updateFile with title="current" sectionHeader="## Features" replace="..."]\n' +
          'User: "Change 100 to 200 in Config" → [Call updateFile with title="Config" search="100" replace="200"]\n' +
          'User: "Move my current note into src/database" → [Call moveFile with title="current" folder="src/database"]\n' +
          'User: "Rename folder src to source" → [Call renameFolder with oldPath="src" newPath="source"]\n' +
          'User: "Delete this note" → [Call deleteFile with title="current"]\n' +
          'User: "Rename this note to App Architecture" → [Call renameFile with oldTitle="current" newTitle="App Architecture"]\n' +
          'User: "Write hello world" → [Call appendToFile immediately]\n' +
          'User: "Clear Grammars" → [Call updateFile with title="Grammars" content="" immediately]'

        // --- Existing files list & Knowledge Graph Context ---
        try {
          const { useVaultStore } = await import('../../../core/store/workspaceStore')
          const vs = useVaultStore.getState()
          const allSnippets = Array.isArray(vs.snippets) ? vs.snippets : Object.values(vs.snippets || {})
          const allFolders = vs.folders || []
          if (allSnippets.length > 0 || allFolders.length > 0) {
            const titles = allSnippets.map((s) => s.title).join(', ')
            const folders = allFolders.join(', ')
            systemPrompt += `\n\n**EXISTING FILES**: ${titles || 'None'}\n**EXISTING FOLDERS**: ${folders || 'None'}\nNever create a file or folder whose name is already in these lists. Use updateFile to modify files instead.`
          }

          // Feature 1: Knowledge Graph Topology (1-2 Hop Backlinks & Forward Links)
          const targetSnippets =
            mentionedSnippets.length > 0
              ? mentionedSnippets
              : vs.selectedSnippet
                ? [vs.selectedSnippet]
                : []
          const graphTopology = extractGraphContext(targetSnippets, allSnippets, 2, 6)
          if (graphTopology) {
            systemPrompt += graphTopology
          }

          // Feature 3: Dynamic Intent Routing & Few-Shot Exemplars
          const detectedIntent = detectUserIntent(message, mentionedSnippets, vs.selectedSnippet)
          const exemplars = getDynamicExemplars(detectedIntent)
          if (exemplars) {
            systemPrompt += exemplars
          }
        } catch (_) {}

        // --- Mode Configuration ---
        const modeConfigs = {
          Fast: {
            temperature: 0.3,
            max_tokens: 1000,
            systemAddon: 'Be extremely concise and direct.'
          },
          Thinking: {
            temperature: 0.7,
            max_tokens: 4000,
            systemAddon:
              'Think step-by-step and show your reasoning before giving the final answer.'
          },
          Creative: {
            temperature: 0.9,
            max_tokens: 4000,
            systemAddon: 'Be creative, use vivid language and metaphors.'
          },
          Coder: {
            temperature: 0.2,
            max_tokens: 4000,
            systemAddon:
              'You are a Senior Engineer. Output robust, production-ready code with proper error handling.'
          },
          Standard: { temperature: 0.7, max_tokens: 4000, systemAddon: '' }
        }
        const modeCfg = modeConfigs[mode] || modeConfigs.Standard

        if (modeCfg.systemAddon) {
          systemPrompt += `\n\n**MODE**: ${modeCfg.systemAddon}`
        }

        // --- New Provider Architecture ---
        let providerType = 'deepseek' // Default
        let activeModel = deepSeekModel || 'deepseek-chat'
        let apiKey = visibleKey

        if (settingsObj.activeProvider) {
          providerType = settingsObj.activeProvider
          activeModel = settingsObj.activeModel || null

          if (providerType === 'openai') apiKey = settingsObj.openaiKey
          else if (providerType === 'anthropic') apiKey = settingsObj.anthropicKey
          else if (providerType === 'ollama') apiKey = 'unused'
        }

        // Initialize Provider
        const { AIProviderFactory } = await import('../providers/index.js')
        const providerConfig = {
          apiKey,
          baseUrl: settingsObj.ollamaUrl // Only relevant for Ollama checking
        }

        const provider = AIProviderFactory.createProvider(providerType, providerConfig)

        // Prepare Messages (History only, system passed separately)
        const finalMessages = newHistory.filter((m) => m.role !== 'system').slice(-6)

        // Only block readFile when user clearly wants to WRITE and file is already pre-loaded.
        // For explain/read/summarize requests, always keep readFile available.
        const hasPreloadedFiles = mentionedSnippets.length > 0 || requestedFiles.length > 0
        const writeIntentKeywords =
          /\b(write|add|append|insert|put|include|create new|type|place|set|clear|empty|erase|wipe|delete all|remove all)\b/i
        const readIntentKeywords =
          /\b(explain|read|summarize|describe|tell me|what is|what does|show me|analyze|review)\b/i
        const isWriteIntent = writeIntentKeywords.test(message) && !readIntentKeywords.test(message)
        const blockReadFile = hasPreloadedFiles && isWriteIntent

        // --- Execute Stream ---
        let fullContent = ''
        let lastUpdateTime = Date.now()
        const UPDATE_INTERVAL = 100

        try {
          // Use AI SDK tool calling for providers that support it
          if (providerType === 'deepseek') {
            await ensureAISdk()

            const { getAITools } = await import('./index.js')
            const sdkTools = getAITools(blockReadFile)

            const result = aiSdk.streamText({
              model: createDeepseekProvider({ apiKey: visibleKey })(activeModel || 'deepseek-chat'),
              system: systemPrompt,
              messages: finalMessages,
              temperature: modeCfg.temperature,
              maxTokens: modeCfg.max_tokens,
              abortSignal: controller.signal,
              tools: Object.fromEntries(
                Object.entries(sdkTools).filter(([, v]) => v !== undefined)
              ),
              maxSteps: 30
            })

            const executedActions = []
            let activeToolStatus = ''
            let narrativeText = ''

            const buildRealtimeDisplay = () => {
              const blocks = []
              if (executedActions.length > 0) {
                blocks.push(executedActions.join('\n'))
              }
              if (activeToolStatus) {
                blocks.push(activeToolStatus)
              }
              if (narrativeText.trim()) {
                blocks.push(narrativeText.trim())
              }
              return blocks.join('\n\n')
            }

            for await (const chunk of result.fullStream) {
              if (controller.signal.aborted) break
              if (!chunk || typeof chunk.type !== 'string') continue

              if (chunk.type === 'tool-call') {
                const args = chunk.args || {}
                if (chunk.toolName === 'createFolder') {
                  activeToolStatus = `📁 *Creating folder \`${args.path || '...'}\`...*`
                } else if (chunk.toolName === 'createFile') {
                  activeToolStatus = `📝 *Drafting \`${args.title || 'note'}\`${args.folder ? ' in ' + args.folder : ''}...*`
                } else if (chunk.toolName === 'moveFile') {
                  activeToolStatus = `📦 *Moving \`${args.title || 'note'}\` to \`${args.folder || 'root'}\`...*`
                } else if (chunk.toolName === 'deleteFolder') {
                  activeToolStatus = `🗑️ *Deleting folder \`${args.path || '...'}\`...*`
                } else if (chunk.toolName === 'deleteFile') {
                  activeToolStatus = `🗑️ *Deleting note \`${args.title || '...'}\`...*`
                } else if (chunk.toolName === 'renameFolder') {
                  activeToolStatus = `✏️ *Renaming folder \`${args.oldPath}\` to \`${args.newPath}\`...*`
                } else if (chunk.toolName === 'renameFile') {
                  activeToolStatus = `✏️ *Renaming note \`${args.oldTitle}\` to \`${args.newTitle}\`...*`
                } else if (chunk.toolName === 'appendToFile') {
                  activeToolStatus = `✍️ *Writing content to \`${args.title || 'note'}\`...*`
                } else if (chunk.toolName === 'updateFile') {
                  if (args.sectionHeader) {
                    activeToolStatus = `✏️ *Updating section \`${args.sectionHeader}\` in \`${args.title || 'note'}\`...*`
                  } else if (args.search) {
                    const preview = (args.search || '').trim().replace(/\n/g, ' ')
                    const shortSearch = preview.length > 25 ? preview.slice(0, 25) + '...' : preview
                    activeToolStatus = `✏️ *Modifying targeted part in \`${args.title || 'note'}\` (\`${shortSearch}\`)...*`
                  } else if (args.insertAfter) {
                    activeToolStatus = `✏️ *Inserting into \`${args.title || 'note'}\` after \`${(args.insertAfter || '').slice(0, 20)}...\`...*`
                  } else if (args.insertBefore) {
                    activeToolStatus = `✏️ *Inserting into \`${args.title || 'note'}\` before \`${(args.insertBefore || '').slice(0, 20)}...\`...*`
                  } else {
                    activeToolStatus = `✏️ *Updating \`${args.title || 'note'}\`...*`
                  }
                } else if (chunk.toolName === 'clearFile') {
                  activeToolStatus = `🧹 *Clearing \`${args.title || 'note'}\`...*`
                } else if (chunk.toolName === 'readFile') {
                  activeToolStatus = `📄 *Reading \`${args.title || 'note'}\`...*`
                } else if (chunk.toolName === 'openFile') {
                  activeToolStatus = `📖 *Opening \`${args.title || 'note'}\`...*`
                } else {
                  activeToolStatus = `⚙️ *Executing ${chunk.toolName}...*`
                }

                fullContent = buildRealtimeDisplay()
                set((state) => {
                  const msgs = [...state.chatMessages]
                  if (msgs.length > 0)
                    msgs[msgs.length - 1] = { ...msgs[msgs.length - 1], content: fullContent }
                  return { chatMessages: msgs }
                })
              } else if (chunk.type === 'tool-result') {
                activeToolStatus = ''
                const res = chunk.result
                if (res && res.success === false) {
                  console.warn(`[AIStore] Tool ${chunk.toolName} failed:`, res.error)
                  executedActions.push(`- ⚠️ *${chunk.toolName} failed: ${res.error}*`)
                } else if (res && res.summary) {
                  const entry = `- ${res.summary}`
                  if (!executedActions.includes(entry) && !executedActions.includes(res.summary)) {
                    executedActions.push(entry)
                  }
                }

                fullContent = buildRealtimeDisplay()
                set((state) => {
                  const msgs = [...state.chatMessages]
                  if (msgs.length > 0)
                    msgs[msgs.length - 1] = { ...msgs[msgs.length - 1], content: fullContent }
                  return { chatMessages: msgs }
                })
              } else if (chunk.type === 'text-delta') {
                narrativeText += chunk.textDelta || chunk.text || ''
                fullContent = buildRealtimeDisplay()
              } else if (chunk.type === 'tool-error') {
                const errMsg = chunk.error?.message || chunk.error || 'Unknown tool error'
                console.warn(`[AIStore] Tool ${chunk.toolName} errored:`, errMsg)
                executedActions.push(`- ⚠️ *Tool error: ${errMsg}*`)
                fullContent = buildRealtimeDisplay()
              } else if (chunk.type === 'error') {
                console.error('Stream error:', chunk.error)
                fullContent += `\n\n*(❌ Stream error: ${chunk.error?.message || chunk.error})*`
              }

              const now = Date.now()
              if (now - lastUpdateTime >= UPDATE_INTERVAL) {
                lastUpdateTime = now
                fullContent = buildRealtimeDisplay()
                set((state) => {
                  const msgs = [...state.chatMessages]
                  if (msgs.length > 0)
                    msgs[msgs.length - 1] = { ...msgs[msgs.length - 1], content: fullContent }
                  return { chatMessages: msgs }
                })
              }
            }

            activeToolStatus = ''

            try {
              const steps = await result.steps
              const toolResults = steps?.flatMap((s) => s.toolResults || []) || []
              if (toolResults.length > 0) {
                toolResults.forEach((t) => {
                  const sum = t.result?.summary
                  if (sum) {
                    const entry = `- ${sum}`
                    if (!executedActions.includes(entry) && !executedActions.includes(sum)) {
                      executedActions.push(entry)
                    }
                  }
                })

                if (!narrativeText.trim() || /^(let me|i will|reading|you asked|starting with)\b/i.test(narrativeText.trim())) {
                  narrativeText = ''
                }

                fullContent = buildRealtimeDisplay()
                if (!fullContent.trim()) {
                  fullContent = 'Done!'
                }
              }
            } catch (_) {}

            fullContent = buildRealtimeDisplay()
            set((state) => {
              const msgs = [...state.chatMessages]
              if (msgs.length > 0)
                msgs[msgs.length - 1] = { ...msgs[msgs.length - 1], content: fullContent || 'Done!' }
              return { chatMessages: msgs }
            })
          } else {
            // Fallback: existing provider-based streaming (for non-tool providers)
            const stream = provider.chatStream(finalMessages, {
              model: activeModel,
              temperature: modeCfg.temperature,
              max_tokens: modeCfg.max_tokens,
              signal: controller.signal
            })

            for await (const chunk of stream) {
              if (controller.signal.aborted) break
              if (chunk) {
                fullContent += chunk

                const now = Date.now()
                if (now - lastUpdateTime >= UPDATE_INTERVAL) {
                  lastUpdateTime = now
                  set((state) => {
                    const msgs = [...state.chatMessages]
                    if (msgs.length > 0) {
                      msgs[msgs.length - 1] = { ...msgs[msgs.length - 1], content: fullContent }
                    }
                    return { chatMessages: msgs }
                  })
                }
              }
            }
          }

          set((state) => {
            const msgs = [...state.chatMessages]
            const finalContent = (fullContent || '').trim()
            if (msgs.length > 0) {
              msgs[msgs.length - 1] = {
                ...msgs[msgs.length - 1],
                content: finalContent || 'Done!'
              }
            }

            if (msgs.length > 0) {
              const lastMsg = msgs[msgs.length - 1]
              if (lastMsg.role === 'assistant' && !lastMsg.content && !lastMsg.imageUrl) {
                msgs.pop()
              }
            }

            return { chatMessages: msgs }
          })

          // AUTO-APPLY LUMINA CREATE/UPDATE BLOCKS (legacy path for non-tool providers)
          if (providerType !== 'deepseek') {
            try {
              const vaultModule = await import('../../../core/store/workspaceStore')
              const vaultStore = vaultModule.useVaultStore.getState()
              const allSnippets = vaultStore.snippets
              let appliedCreations = 0
              let appliedUpdates = 0
              let appliedDeletions = 0

              // Helper: parse lumina blocks with code-fence-aware nesting
              const parseLuminaBlocks = (text, prefix) => {
                const blocks = []
                const searchStart = '```' + prefix + ' '
                let i = 0
                while (i < text.length) {
                  const blockStart = text.indexOf(searchStart, i)
                  if (blockStart === -1) break

                  const titleAfter = blockStart + searchStart.length
                  const titleEnd = text.indexOf('\n', titleAfter)
                  if (titleEnd === -1) break
                  const title = text.slice(titleAfter, titleEnd).trim()

                  let depth = 1
                  let fenceDepth = 0
                  let pos = titleEnd + 1

                  while (pos < text.length && depth > 0) {
                    const bt = text.indexOf('```', pos)
                    if (bt === -1) break

                    const afterBt = text.slice(bt + 3)
                    const trimmed = afterBt.trimStart()

                    if (
                      trimmed.startsWith('lumina-create ') ||
                      trimmed.startsWith('lumina-update ') ||
                      trimmed.startsWith('lumina-delete ')
                    ) {
                      depth++
                    } else if (afterBt.length > 0 && !/^\s/.test(afterBt[0])) {
                      fenceDepth++
                    } else if (fenceDepth > 0) {
                      fenceDepth--
                    } else {
                      depth--
                    }

                    pos = bt + 3
                  }

                  const content = text.slice(titleEnd + 1, pos - 3).replace(/\n$/, '')
                  blocks.push({ title, content })
                  i = pos
                }
                return blocks
              }

              // 1. Process lumina-create
              const createMatches = parseLuminaBlocks(fullContent, 'lumina-create')
              for (const { title, content } of createMatches) {
                const newSnippet = {
                  id: crypto.randomUUID(),
                  title: title,
                  code: content,
                  language: 'markdown',
                  tags: '',
                  timestamp: Date.now()
                }
                await vaultStore.saveSnippet(newSnippet)
                appliedCreations++
              }

              // 2. Process lumina-update
              const updateMatches = parseLuminaBlocks(fullContent, 'lumina-update')
              for (const { title, content } of updateMatches) {
                // Find snippet by title (be tolerant of .md extensions)
                const cleanTitle = title.toLowerCase().replace(/\.md$/, '')
                const targetSnippet = allSnippets.find((s) => {
                  const sTitle = s.title.toLowerCase().replace(/\.md$/, '')
                  return sTitle === cleanTitle
                })

                if (targetSnippet) {
                  const updatedSnippet = { ...targetSnippet, code: content, timestamp: Date.now() }
                  await vaultStore.saveSnippet(updatedSnippet)

                  // If it's the currently active snippet, update it
                  if (vaultStore.selectedSnippet?.id === targetSnippet.id) {
                    vaultStore.setSelectedSnippet(updatedSnippet)
                  }
                  appliedUpdates++
                }
              }

              // 3. Process lumina-delete
              const deleteMatches = [...fullContent.matchAll(/```lumina-delete\s+([^\n]+?)\s*```/g)]
              for (const match of deleteMatches) {
                const title = match[1].trim()

                // Find snippet by title (be tolerant of .md extensions)
                const cleanTitle = title.toLowerCase().replace(/\.md$/, '')
                const targetSnippet = allSnippets.find((s) => {
                  const sTitle = s.title.toLowerCase().replace(/\.md$/, '')
                  return sTitle === cleanTitle
                })

                if (targetSnippet) {
                  try {
                    await vaultStore.deleteSnippet(targetSnippet.id, true)
                    appliedDeletions++
                  } catch (e) {
                    const current = get().chatMessages
                    current[current.length - 1].content +=
                      `\n\n*(❌ Failed to delete "${title}": ${e.message})*`
                    set({ chatMessages: [...current] })
                  }
                } else {
                  const current = get().chatMessages
                  current[current.length - 1].content +=
                    `\n\n*(⚠️ File not found for deletion: "${title}")*`
                  set({ chatMessages: [...current] })
                }
              }

              if (appliedCreations > 0 || appliedUpdates > 0 || appliedDeletions > 0) {
                const current = get().chatMessages
                const prevContent = current[current.length - 1].content

                // Strip all tool blocks from chat display, keep only surrounding text
                const cleaned = (() => {
                  const prefixes = ['```lumina-create ', '```lumina-update ']
                  let text = prevContent
                  for (const prefix of prefixes) {
                    const escaped = prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
                    // Use greedy match to grab the closest ``` after content start
                    text = text.replace(new RegExp(escaped + '[^\\n]*\\n[\\s\\S]*?\\n```', 'g'), '')
                  }
                  text = text.replace(/```lumina-delete\s+[^\n]+```\n?/g, '')
                  text = text.replace(/\n{4,}/g, '\n\n\n').trim()
                  // If stripping gutted everything, keep a clean summary
                  if (!text || text.length < 20) {
                    const parts = []
                    if (appliedCreations > 0)
                      parts.push(`${appliedCreations} file(s) about your request`)
                    if (appliedUpdates > 0) parts.push(`${appliedUpdates} file(s) updated`)
                    if (appliedDeletions > 0) parts.push(`Deleted`)
                    return `I've ${parts.join(' and ')}. You can find them in your workspace!`
                  }
                  return text
                })()

                current[current.length - 1].content = cleaned
                set({ chatMessages: [...current] })
              }
            } catch (err) {
              console.error('[AIStore] Failed to auto-apply file operations:', err)
            }
          }
        } finally {
          if (timeoutId) clearTimeout(timeoutId)
        }

        get().saveChatHistory()
        set({ isChatLoading: false, chatController: null })
      } catch (error) {
        if (error.name === 'AbortError') {
          console.log('[AIStore] Chat generation aborted by user.')
        } else {
          console.error('[AIStore] Chat Error:', error)
        }

        // Clean up empty assistant message if it failed immediately
        set((state) => {
          const msgs = [...state.chatMessages]
          if (msgs.length > 0) {
            const lastMsg = msgs[msgs.length - 1]
            if (lastMsg.role === 'assistant' && !lastMsg.content && !lastMsg.imageUrl) {
              msgs.pop()
            }
          }
          return {
            chatMessages: msgs,
            isChatLoading: false,
            chatError: error.name === 'AbortError' ? null : error.message,
            chatController: null
          }
        })
      } finally {
        if (timeoutId) clearTimeout(timeoutId)
        set({ isChatLoading: false, chatController: null })
      }
    }
  }
})
