import { create } from 'zustand'
import { db } from '../db/cache'

export const useAIStore = create((set, get) => {
  // Initialize worker
  const worker = new Worker(new URL('../ai/ai.worker.js', import.meta.url), { type: 'module' })

  // Trigger initial session load
  setTimeout(() => {
    get().loadSessions()
  }, 0)

  worker.onmessage = (e) => {
    const { type, status, id, result, progress } = e.data

    // Handle Progress
    if (type === 'progress') {
      if (status === 'progress') {
        set({ modelLoadingProgress: progress })
      } else if (status === 'ready') {
        set({ isModelReady: true, modelLoadingProgress: 100 })
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

    // Image generation state
    isImageGenerating: false,
    imageGenerationError: null,
    imageGenerationController: null,

    generateEmbedding: (text) => {
      return new Promise((resolve, reject) => {
        const id = crypto.randomUUID()
        const { pendingTasks } = get()
        const newMap = new Map(pendingTasks)
        newMap.set(id, { resolve, reject })
        set({ pendingTasks: newMap })

        worker.postMessage({ id, type: 'embed', payload: text })
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
        // 1. Try IndexedDB first (High Capacity)
        let savedSessions = await db.chatSessions.orderBy('timestamp').reverse().toArray()
        
        // 2. Fallback to localStorage for migration or if DB is empty
        if (savedSessions.length === 0) {
          const legacy = localStorage.getItem('lumina-chat-sessions')
          if (legacy) {
            const parsed = JSON.parse(legacy)
            if (Array.isArray(parsed) && parsed.length > 0) {
              savedSessions = parsed
              // Migrate to IndexedDB
              await db.chatSessions.bulkAdd(parsed)
              localStorage.removeItem('lumina-chat-sessions')
            }
          }
        }

        if (savedSessions.length > 0) {
          set({ sessions: savedSessions })
          
          // Default to last active or first session
          const lastActive = localStorage.getItem('lumina-active-session-id')
          if (lastActive && savedSessions.some(s => s.id === lastActive)) {
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
        await db.chatSessions.add(firstSession)
      } catch (e) {
        console.warn('[AIStore] Failed to load sessions:', e)
      }
    },

    saveSessions: async () => {
      // With IndexedDB, we mainly update individual sessions, 
      // but let's sync the list if needed.
    },

    createNewSession: async () => {
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
      await db.chatSessions.add(newSession)
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
          ? newSessions.find(s => s.id === nextActiveId)?.messages || []
          : []

        return {
          sessions: newSessions,
          activeSessionId: nextActiveId,
          chatMessages: nextMessages
        }
      })
      
      await db.chatSessions.delete(sessionId)

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
            const firstUserMsg = chatMessages.find(m => m.role === 'user')
            if (firstUserMsg) {
              title = firstUserMsg.content.slice(0, 30).trim() + (firstUserMsg.content.length > 30 ? '...' : '')
            }
          }
          updatedSession = { ...s, messages: chatMessages, title, timestamp: Date.now() }
          return updatedSession
        }
        return s
      })

      set({ sessions: newSessions })
      if (updatedSession) {
        await db.chatSessions.put(updatedSession)
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
          chatError: null,
          imageGenerationError: null
        }))
        await get().saveChatHistory()
      }
    },

    /**
     * Generate an image from a text prompt
     */
    generateImage: async (prompt) => {
      const { generateImageWithRetry, extractImagePrompt } = await import(
        '../../features/AI/imageGenerationService.js'
      )

      const imagePrompt = extractImagePrompt(prompt)

      if (!imagePrompt) {
        set({ imageGenerationError: 'Please provide an image description.' })
        throw new Error('Image prompt cannot be empty.')
      }

      let huggingFaceKey = null
      try {
        const settingsModule = await import('../../core/store/useSettingsStore')
        const settings = settingsModule.useSettingsStore.getState()
        const settingsObj = settings?.settings || settings || {}
        huggingFaceKey = settingsObj.huggingFaceKey || null
      } catch (err) {
        console.warn('[AIStore] Failed to load settings for image generation:', err)
      }

      set({ isImageGenerating: true, imageGenerationError: null })
      
      // OPTIMISTIC UI: Add placeholder message immediately
      const placeholderMsg = {
        role: 'assistant',
        content: '', // Empty text
        imageUrl: null, 
        isGenerating: true, // Flag for UI to show spinner
        timestamp: Date.now()
      }
      
      set((state) => ({
        chatMessages: [...(state.chatMessages || []), placeholderMsg]
      }))

      let controller = new AbortController()
      set({ imageGenerationController: controller })

      try {
        const result = await generateImageWithRetry(imagePrompt, huggingFaceKey, controller)

        const imageMessage = {
          role: 'assistant',
          content: '',
          imageUrl: result.imageUrl,
          imagePrompt: result.prompt,
          timestamp: result.timestamp
        }

        set((state) => {
          // Replace the last message (placeholder) with actual result
          const newMessages = [...(state.chatMessages || [])]
          if (newMessages.length > 0 && newMessages[newMessages.length - 1].isGenerating) {
             newMessages[newMessages.length - 1] = imageMessage
          } else {
             newMessages.push(imageMessage)
          }
          
          return {
            chatMessages: newMessages,
            isImageGenerating: false,
            imageGenerationError: null,
            imageGenerationController: null
          }
        })

        setTimeout(() => get().saveChatHistory(), 100)
        return result
      } catch (error) {
        console.error('[AIStore] Image generation error:', error)
        let errorMessage = error.message || 'Failed to generate image. Please try again.'
        set({
          isImageGenerating: false,
          imageGenerationError: errorMessage,
          imageGenerationController: null
        })
        throw error
      }
    },

    cancelChat: () => {
      const controller = get().chatController
      if (controller && !controller.signal.aborted) {
        controller.abort()
        set({
          isChatLoading: false,
          chatController: null
        })
      }
    },

    cancelImageGeneration: () => {
      const controller = get().imageGenerationController
      if (controller && !controller.signal.aborted) {
        controller.abort()
        set({
          isImageGenerating: false,
          imageGenerationError: 'Image generation cancelled by user',
          imageGenerationController: null
        })
      }
    },

    sendChatMessage: async (message, contextSnippets = []) => {
      if (!message || typeof message !== 'string' || !message.trim()) {
        set({ chatError: 'Message cannot be empty.' })
        return
      }

      if (!Array.isArray(contextSnippets)) {
        contextSnippets = []
      }

      let settings
      try {
        const settingsModule = await import('../../core/store/useSettingsStore')
        settings = settingsModule.useSettingsStore.getState()
      } catch (err) {
        console.error('[AIStore] Failed to load settings:', err)
        set({ chatError: 'Failed to load settings.' })
        return
      }

      const settingsObj = settings?.settings || settings || {}
      const { deepSeekKey, deepSeekModel } = settingsObj

      const visibleKey = deepSeekKey || import.meta.env.VITE_DEEPSEEK_KEY

      if (!visibleKey) {
        set({ chatError: 'Missing API Key. Please configure it in Settings > AI Models.' })
        return
      }

      // 0. Parse @mentions
      const mentionRegex = /@([^ \n\t]+)/g
      const mentions = [...message.matchAll(mentionRegex)].map(m => m[1])
      const mentionedSnippets = []
      
      if (mentions.length > 0) {
        try {
          const vaultModule = await import('../../core/store/useVaultStore')
          const vaultSnippets = vaultModule.useVaultStore.getState().snippets
          mentions.forEach(mentionTitle => {
            const found = vaultSnippets.find(s => 
              s.title.toLowerCase() === mentionTitle.toLowerCase() ||
              s.title.toLowerCase().includes(mentionTitle.toLowerCase())
            )
            if (found && !mentionedSnippets.some(ms => ms.id === found.id)) {
              mentionedSnippets.push(found)
            }
          })
        } catch (err) {
          console.warn('[AIStore] Mention scan failed:', err)
        }
      }

      const userMsg = { role: 'user', content: message.trim() }
      const currentMessages = get().chatMessages || []
      const newHistory = [...currentMessages, userMsg]
      set({ chatMessages: newHistory, isChatLoading: true, chatError: null })

      let controller = null
      let timeoutId = null

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
              vaultContext = searchResults.map(chunk => ({
                file: chunk?.metadata?.fileName || 'Unknown',
                text: String(chunk?.text || '').trim(),
                score: chunk?.finalScore || 0
              })).slice(0, 8)
              vaultAccessNote = `Retrieved relevant context from vault.`
            } else {
              vaultAccessNote = 'Synthesizing from general knowledge and active context.'
            }
          }
        } catch (searchErr) {
          console.warn('[AIStore] Vault search failed:', searchErr)
        }

        let systemPrompt = `You are Lumina, the intelligent core of this Markdown editor. You are technical, precise, and highly integrated.

**STYLE**:
- Be direct and high-signal. Use elegant Markdown.
- Avoid repetitive disclaimers like "I have access to your vault." Just act on the knowledge provided.
- Cite file names when quoting specific context.

**CONTEXT**:
${vaultAccessNote}`

        if (vaultContext.length > 0) {
          systemPrompt += `\n\n**Vault Knowledge:**\n`
          vaultContext.forEach((ctx, i) => {
            systemPrompt += `[${i + 1}] source: ${ctx.file}\n${ctx.text}\n\n`
          })
        }

        if (contextSnippets.length > 0) {
          systemPrompt += '\n\n**Active Tabs Context:**\n'
          contextSnippets.forEach((snip) => {
            systemPrompt += `[File: ${snip.title}]\n${snip.code.slice(0, 1500)}\n\n`
          })
        }

        if (mentionedSnippets.length > 0) {
          systemPrompt += '\n\n**Explicitly Mentioned (@):**\n'
          mentionedSnippets.forEach((snip) => {
            systemPrompt += `[Target Note: ${snip.title}]\n${snip.code.slice(0, 3000)}\n\n`
          })
        }

        // --- New Provider Architecture ---
        let providerType = 'deepseek' // Default
        let activeModel = deepSeekModel || 'deepseek-chat'
        let apiKey = visibleKey

        // Determine provider based on user selection in settings (future)
        // For now, if deepSeekKey is set, use deepseek.
        // Once we add the UI selector, we will read settings.activeProvider
        if (settingsObj.activeProvider) {
          providerType = settingsObj.activeProvider
          activeModel = settingsObj.activeModel || null
          
          if (providerType === 'openai') apiKey = settingsObj.openaiKey
          else if (providerType === 'anthropic') apiKey = settingsObj.anthropicKey
          else if (providerType === 'ollama') apiKey = 'unused' // Ollama usually no key
        }

        // Initialize Provider
        const { AIProviderFactory } = await import('../../features/AI/providers/index.js')
        const providerConfig = { 
          apiKey, 
          baseUrl: settingsObj.ollamaUrl // Only relevant for Ollama checking
        }
        
        const provider = AIProviderFactory.createProvider(providerType, providerConfig)

        // Abort Controller
        controller = new AbortController()
        set({ chatController: controller })
        timeoutId = setTimeout(() => controller?.abort(), 60000)

        // Optimistic UI Update
        const assistantMsg = { role: 'assistant', content: '' }
        set((state) => ({
          chatMessages: [...state.chatMessages, assistantMsg],
          isChatLoading: true
        }))

        // Prepare Messages (System + History)
        const finalMessages = [{ role: 'system', content: systemPrompt }, ...newHistory]

        // --- Execute Stream ---
        let fullContent = ''
        try {
          const stream = provider.chatStream(finalMessages, {
            model: activeModel,
            temperature: 0.7,
            signal: controller.signal
          })

          for await (const chunk of stream) {
            if (chunk) {
              fullContent += chunk
              set((state) => {
                const msgs = [...state.chatMessages]
                if (msgs.length > 0) {
                  msgs[msgs.length - 1].content = fullContent
                }
                return { chatMessages: msgs }
              })
            }
          }
        } finally {
          if (timeoutId) clearTimeout(timeoutId)
        }

        get().saveChatHistory()
        set({ isChatLoading: false, chatController: null })
      } catch (error) {
        console.error('[AIStore] Chat Error:', error)
        set({ isChatLoading: false, chatError: error.message, chatController: null })
      }
    }
  }
})
