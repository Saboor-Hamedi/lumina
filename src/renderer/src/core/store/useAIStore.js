import { create } from 'zustand'
import { db, openDb } from '../db/cache'

let aiSdk
let createDeepseekProvider
async function ensureAISdk() {
  if (!aiSdk) {
    const [ai, ds] = await Promise.all([
      import('ai'),
      import('@ai-sdk/deepseek'),
    ])
    aiSdk = ai
    createDeepseekProvider = ds.createDeepSeek
  }
}

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

        // Update the loading message in chat with live percentage!
        const currentMessages = get().chatMessages;
        if (currentMessages && currentMessages.length > 0) {
          const lastMsg = currentMessages[currentMessages.length - 1];
          if (lastMsg.isGenerating && progress) {
            const newMessages = [...currentMessages];
            const pct = Math.round(progress);
            // Only update if it's a significant jump to avoid React re-rendering 1000 times a second
            if (pct % 5 === 0) {
              newMessages[newMessages.length - 1] = {
                ...lastMsg,
                content: `Downloading offline AI model... **${pct}%**`
              };
              set({ chatMessages: newMessages });
            }
          }
        }
      } else if (status === 'ready') {
        set({ isModelReady: true, modelLoadingProgress: 100 })

        // Switch to 'Generating...' once ready
        const currentMessages = get().chatMessages;
        if (currentMessages && currentMessages.length > 0) {
          const lastMsg = currentMessages[currentMessages.length - 1];
          if (lastMsg.isGenerating) {
            const newMessages = [...currentMessages];
            newMessages[newMessages.length - 1] = {
              ...lastMsg,
              content: `Model loaded! Generating your file offline...`
            };
            set({ chatMessages: newMessages });
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

    generateLocalText: (prompt) => {
      return new Promise((resolve, reject) => {
        const id = crypto.randomUUID()
        const { pendingTasks } = get()
        const newMap = new Map(pendingTasks)
        newMap.set(id, { resolve, reject })
        set({ pendingTasks: newMap })

        worker.postMessage({ id, type: 'generate', payload: prompt })
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
          ? newSessions.find(s => s.id === nextActiveId)?.messages || []
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
        try {
          await openDb()
          await db.chatSessions.put(updatedSession)
        } catch (e) {
          console.warn('[AIStore] Failed to save chat history to db, falling back to localStorage:', e)
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
        id: crypto.randomUUID(),
        role: 'assistant',
        content: `Generating image: "${prompt}"...`,
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
          id: crypto.randomUUID(),
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

    sendChatMessage: async (message, contextSnippets = [], mode = 'Standard') => {
      if (!message || typeof message !== 'string' || !message.trim()) {
        set({ chatError: 'Message cannot be empty.' })
        return
      }

      // LOCAL AI FILE GENERATOR INTERCEPT
      const cleanMessage = message.trim();
      const writeMatch = cleanMessage.match(/^write (?:a )?file about (.+)/i);

      if (writeMatch) {
        const topic = writeMatch[1].trim();

        const userMsg = { id: crypto.randomUUID(), role: 'user', content: cleanMessage, timestamp: Date.now() }
        const loadingMsg = {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: `Generating local file about: **${topic}**... This may take a moment if downloading the model for the first time.`,
          isGenerating: true,
          timestamp: Date.now()
        }

        const currentMessages = get().chatMessages || []
        set({ chatMessages: [...currentMessages, userMsg, loadingMsg], isChatLoading: true, chatError: null })

        try {
          const prompt = `Write a detailed markdown document about ${topic}. Include headings, bullet points, and code examples if relevant.`;
          const generatedContent = await get().generateLocalText(prompt);

          // Save to vault
          const vaultModule = await import('../../core/store/useVaultStore')
          const vaultStore = vaultModule.useVaultStore.getState();
          const newSnippet = {
            id: crypto.randomUUID(),
            title: topic,
            code: generatedContent || `# ${topic}\n\n(No content generated)`,
            language: 'markdown',
            tags: '',
            timestamp: Date.now()
          };
          await vaultStore.saveSnippet(newSnippet);
          vaultStore.setSelectedSnippet(newSnippet);

          // Update chat
          const successMsg = { id: crypto.randomUUID(), role: 'assistant', content: `I have generated and created the file: **${topic}**. It is now open in your editor!`, timestamp: Date.now() }
          const current = get().chatMessages;
          current[current.length - 1] = successMsg;
          set({ chatMessages: [...current], isChatLoading: false })
          await get().saveChatHistory()
        } catch (err) {
          console.error('[AIStore] Local generation failed:', err)
          const current = get().chatMessages;
          current[current.length - 1] = { id: crypto.randomUUID(), role: 'assistant', content: `Failed to generate file: ${err.message}`, timestamp: Date.now() }
          set({ chatMessages: [...current], isChatLoading: false })
        }
        return;
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

      // 1. Auto-detect file mentions by name (not just @mentions)
      const requestedFiles = []
      try {
        const vaultModule = await import('../../core/store/useVaultStore')
        const vaultSnippets = vaultModule.useVaultStore.getState().snippets
        const queryLower = message.toLowerCase()
        vaultSnippets.forEach(s => {
          if (s.title && queryLower.includes(s.title.toLowerCase().replace(/\.md$/, '').trim())) {
            if (!requestedFiles.some(f => f.id === s.id)) {
              requestedFiles.push(s)
            }
          }
        })
        if (requestedFiles.length > 5) requestedFiles.length = 5
      } catch (err) {
        console.warn('[AIStore] File mention detection failed:', err)
      }

      // Normal Chat Flow
      const userMsg = {
        id: crypto.randomUUID(),
        role: 'user',
        content: message.trim(),
        timestamp: Date.now()
      }

      const currentMessages = get().chatMessages || []
      const newHistory = [...currentMessages, userMsg]

      const assistantMsg = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: '',
        timestamp: Date.now()
      }
      set({ chatMessages: [...newHistory, assistantMsg], isChatLoading: true, chatError: null })

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

        let systemPrompt = `You are Lumina, the intelligent and friendly AI assistant built directly into this Markdown editor. You are a highly capable technical partner.

**STYLE & TONE**:
- Be warm, conversational, and highly engaging. You are pairing with the user, so act like a brilliant but friendly co-pilot.
- Provide high-signal, detailed responses.
- Cite file names clearly when quoting specific context.
- **Follow EVERY instruction the user gives**. If they ask for wikilinks, headers, formatting, or structure — do it without skipping.
- Produce **comprehensive, detailed content**. A file about "SQL queries" should include real examples, syntax, edge cases, and practical usage — not just "Basic Query Patterns" with one sentence.
- When the user asks about a file, read its content from "Files Mentioned" below and immediately provide a substantive description. Never just acknowledge the file — answer directly with detail.

**TOOLS AVAILABLE** (use these for file operations):
- 'readFile' — read a vault file by title
- 'createFile' — create a new vault file (provide title + content)
- 'updateFile' — edit a vault file (by title+content or title+search+replace)
- 'deleteFile' — delete a vault file by title

**HOW TO USE THEM**:
- Call them directly when needed. They actually execute.
- **For "read" or "tell me about"** → call readFile, then describe the content.
- **For "clear" or "empty"** → call updateFile with content='' (empty string).
- **For "update" or "edit"** → call readFile first, then updateFile.
- **For "delete" or "remove"** → call deleteFile directly (no read needed).
- **For "create" or "new"** → call createFile.
- Check EXISTING FILES before creating — never duplicate.
- For targeted edits: use search+replace. If that fails, retry with full content.
- When done, write a friendly summary of what you changed.

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

        // --- Auto-detected file mentions ---
        if (requestedFiles.length > 0) {
          systemPrompt += '\n\n**Vault Files Referenced (content below):**\n'
          requestedFiles.forEach((f, i) => {
            systemPrompt += `--- ${f.title} ---\n${f.code}\n`
          })
          systemPrompt += '\nThe user is referencing the file(s) above. You MUST take action — call readFile, updateFile, or deleteFile as appropriate. Do NOT just say you will — do it now.\n'
        }

        // --- Existing files list ---
        try {
          const { useVaultStore } = await import('../../core/store/useVaultStore')
          const allSnippets = useVaultStore.getState().snippets || []
          if (allSnippets.length > 0) {
            const titles = allSnippets.map(s => s.title).join(', ')
            systemPrompt += `\n\n**EXISTING FILES**: ${titles}\nNever create a file whose title is already in this list. Use updateFile to modify it instead.`
          }
        } catch (_) {}

        // --- Mode Configuration ---
        const modeConfigs = {
          Fast:     { temperature: 0.3, max_tokens: 1000, systemAddon: 'Be extremely concise and direct.' },
          Thinking: { temperature: 0.7, max_tokens: 4000, systemAddon: 'Think step-by-step and show your reasoning before giving the final answer.' },
          Creative: { temperature: 0.9, max_tokens: 4000, systemAddon: 'Be creative, use vivid language and metaphors.' },
          Coder:    { temperature: 0.2, max_tokens: 4000, systemAddon: 'You are a Senior Engineer. Output robust, production-ready code with proper error handling.' },
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
        const { AIProviderFactory } = await import('../../features/AI/providers/index.js')
        const providerConfig = {
          apiKey,
          baseUrl: settingsObj.ollamaUrl // Only relevant for Ollama checking
        }

        const provider = AIProviderFactory.createProvider(providerType, providerConfig)

        // Abort Controller
        controller = new AbortController()
        set({ chatController: controller })
        timeoutId = setTimeout(() => controller?.abort(), 180000)

        // Prepare Messages (System + History)
        const finalMessages = [{ role: 'system', content: systemPrompt }, ...newHistory]

        // --- Execute Stream ---
        let fullContent = ''
        let lastUpdateTime = Date.now()
        const UPDATE_INTERVAL = 100

        try {
          // Use AI SDK tool calling for providers that support it
          if (providerType === 'deepseek') {
            await ensureAISdk()

            const sdkTools = {
              createFile: aiSdk.tool({
                description: 'Create a new markdown file in the vault.',
                inputSchema: aiSdk.jsonSchema({
                  type: 'object',
                  properties: {
                    title: { type: 'string', description: 'The file title (single word, no extension)' },
                    content: { type: 'string', description: 'Full markdown content' },
                  },
                  required: ['title', 'content'],
                }),
                execute: async ({ title, content }) => {
                  const { useVaultStore } = await import('../../core/store/useVaultStore')
                  const vs = useVaultStore.getState()
                  const snippet = {
                    id: crypto.randomUUID(),
                    title,
                    code: content,
                    language: 'markdown',
                    tags: '',
                    timestamp: Date.now()
                  }
                  await vs.saveSnippet(snippet)
                  return { success: true, title }
                },
              }),
              readFile: aiSdk.tool({
                description: 'Read the contents of a file from the vault.',
                inputSchema: aiSdk.jsonSchema({
                  type: 'object',
                  properties: {
                    title: { type: 'string', description: 'Exact title of the file to read (without .md)' },
                  },
                  required: ['title'],
                }),
                execute: async ({ title }) => {
                  const { useVaultStore } = await import('../../core/store/useVaultStore')
                  const vs = useVaultStore.getState()
                  const target = vs.snippets.find(s =>
                    s.title.toLowerCase() === title.toLowerCase().replace(/\.md$/, '')
                  )
                  if (!target) return { success: false, error: 'File not found' }
                  return { success: true, title: target.title, content: target.code }
                },
              }),
              updateFile: aiSdk.tool({
                description: 'Edit an existing file. Provide EITHER full content (replaces entire file) OR search+replace (targeted edit). For targeted edits, set search to the exact text to find and replace to the new text.',
                inputSchema: aiSdk.jsonSchema({
                  type: 'object',
                  properties: {
                    title: { type: 'string', description: 'Exact title of the file to update (without .md)' },
                    content: { type: 'string', description: 'Full replacement content. Use this to rewrite the whole file.' },
                    search: { type: 'string', description: 'Exact text to find for a targeted replacement. Use this together with replace for surgical edits.' },
                    replace: { type: 'string', description: 'Text to replace the search match with. Use empty string to delete the matched text.' },
                  },
                  required: ['title'],
                }),
                execute: async ({ title, content, search, replace }) => {
                  const { useVaultStore } = await import('../../core/store/useVaultStore')
                  const vs = useVaultStore.getState()
                  const target = vs.snippets.find(s =>
                    s.title.toLowerCase() === title.toLowerCase().replace(/\.md$/, '')
                  )
                  if (!target) return { success: false, error: 'File not found' }

                  let newCode
                  if (search !== undefined) {
                    const idx = target.code.indexOf(search)
                    if (idx === -1) return { success: false, error: `Text "${search}" not found in file` }
                    newCode = target.code.slice(0, idx) + (replace ?? '') + target.code.slice(idx + search.length)
                  } else if (content !== undefined) {
                    newCode = content
                  } else {
                    return { success: false, error: 'Provide either content (full replace) or search+replace (targeted edit)' }
                  }

                  const updated = { ...target, code: newCode, timestamp: Date.now() }
                  await vs.saveSnippet(updated)
                  if (vs.selectedSnippet?.id === target.id) vs.setSelectedSnippet(updated)
                  return { success: true, title }
                },
              }),
              deleteFile: aiSdk.tool({
                description: 'Delete a file from the vault by title.',
                inputSchema: aiSdk.jsonSchema({
                  type: 'object',
                  properties: {
                    title: { type: 'string', description: 'Exact title of the file to delete (without .md)' },
                  },
                  required: ['title'],
                }),
                execute: async ({ title }) => {
                  const { useVaultStore } = await import('../../core/store/useVaultStore')
                  const vs = useVaultStore.getState()
                  const target = vs.snippets.find(s =>
                    s.title.toLowerCase() === title.toLowerCase().replace(/\.md$/, '')
                  )
                  if (target) {
                    await vs.deleteSnippet(target.id, true)
                    return { success: true, title }
                  }
                  return { success: false, error: 'File not found' }
                },
              }),
            }

            // Show a brief "working" message while the AI thinks
            set((state) => {
              const msgs = [...state.chatMessages]
              if (msgs.length > 0) {
                msgs[msgs.length - 1].content = 'Thinking...'
              }
              return { chatMessages: msgs }
            })

            const result = aiSdk.streamText({
              model: createDeepseekProvider({ apiKey: visibleKey })(activeModel || 'deepseek-chat'),
              messages: finalMessages,
              temperature: modeCfg.temperature,
              maxTokens: modeCfg.max_tokens,
              abortSignal: controller.signal,
              tools: sdkTools,
              maxSteps: 15,
            })

            for await (const chunk of result.fullStream) {
              if (chunk.type === 'text-delta') {
                fullContent += (chunk.textDelta || chunk.text || '')
              } else if (chunk.type === 'tool-result') {
                const res = chunk.result
                if (res && res.success === false) {
                  console.warn(`[AIStore] Tool ${chunk.toolName} failed:`, res.error)
                  fullContent += `\n\n*(⚠️ ${chunk.toolName}: ${res.error})*`
                }
              } else if (chunk.type === 'tool-error') {
                const errMsg = chunk.error?.message || chunk.error || 'Unknown tool error'
                console.warn(`[AIStore] Tool ${chunk.toolName} errored:`, errMsg)
                fullContent += `\n\n*(⚠️ Tool error: ${errMsg})*`
              } else if (chunk.type === 'error') {
                console.error('Stream error:', chunk.error)
              }

              const now = Date.now()
              if (now - lastUpdateTime >= UPDATE_INTERVAL) {
                lastUpdateTime = now
                set((state) => {
                  const msgs = [...state.chatMessages]
                  if (msgs.length > 0) msgs[msgs.length - 1] = { ...msgs[msgs.length - 1], content: fullContent }
                  return { chatMessages: msgs }
                })
              }
            }

            // Fallback: if tools were used but AI left empty text, show confirmation
            try {
              const steps = await result.steps
              const hasToolCalls = steps?.some(s => s.toolCalls?.length > 0)
              if (hasToolCalls && !fullContent?.trim()) {
                const toolNames = steps.flatMap(s => s.toolCalls?.map(tc => tc.toolName) || [])
                const unique = [...new Set(toolNames)]
                fullContent = `Done. Called: ${unique.join(', ')}`
              }
            } catch (_) {}
            // Fallback: existing provider-based streaming (for non-tool providers)
            const stream = provider.chatStream(finalMessages, {
              model: activeModel,
              temperature: modeCfg.temperature,
              max_tokens: modeCfg.max_tokens,
              signal: controller.signal
            })

            for await (const chunk of stream) {
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

          // Final update to ensure we have the complete message
          set((state) => {
            const msgs = [...state.chatMessages]
            if (msgs.length > 0) {
              msgs[msgs.length - 1] = { ...msgs[msgs.length - 1], content: fullContent }
            }

            // Clean up empty assistant message if no content was generated
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
            const vaultModule = await import('../../core/store/useVaultStore')
            const vaultStore = vaultModule.useVaultStore.getState();
            const allSnippets = vaultStore.snippets;
            let appliedCreations = 0;
            let appliedUpdates = 0;
            let appliedDeletions = 0;

            // Helper: parse lumina blocks with code-fence-aware nesting
            const parseLuminaBlocks = (text, prefix) => {
              const blocks = [];
              const searchStart = '```' + prefix + ' ';
              let i = 0;
              while (i < text.length) {
                const blockStart = text.indexOf(searchStart, i);
                if (blockStart === -1) break;

                const titleAfter = blockStart + searchStart.length;
                const titleEnd = text.indexOf('\n', titleAfter);
                if (titleEnd === -1) break;
                const title = text.slice(titleAfter, titleEnd).trim();

                let depth = 1;
                let fenceDepth = 0;
                let pos = titleEnd + 1;

                while (pos < text.length && depth > 0) {
                  const bt = text.indexOf('```', pos);
                  if (bt === -1) break;

                  const afterBt = text.slice(bt + 3);
                  const trimmed = afterBt.trimStart();

                  if (trimmed.startsWith('lumina-create ') ||
                      trimmed.startsWith('lumina-update ') ||
                      trimmed.startsWith('lumina-delete ')) {
                    depth++;
                  } else if (afterBt.length > 0 && !/^\s/.test(afterBt[0])) {
                    fenceDepth++;
                  } else if (fenceDepth > 0) {
                    fenceDepth--;
                  } else {
                    depth--;
                  }

                  pos = bt + 3;
                }

                const content = text.slice(titleEnd + 1, pos - 3).replace(/\n$/, '');
                blocks.push({ title, content });
                i = pos;
              }
              return blocks;
            };

            // 1. Process lumina-create
            const createMatches = parseLuminaBlocks(fullContent, 'lumina-create');
            for (const { title, content } of createMatches) {
              const newSnippet = {
                id: crypto.randomUUID(),
                title: title,
                code: content,
                language: 'markdown',
                tags: '',
                timestamp: Date.now()
              };
              await vaultStore.saveSnippet(newSnippet);
              appliedCreations++;
            }

            // 2. Process lumina-update
            const updateMatches = parseLuminaBlocks(fullContent, 'lumina-update');
            for (const { title, content } of updateMatches) {
              // Find snippet by title (be tolerant of .md extensions)
              const cleanTitle = title.toLowerCase().replace(/\.md$/, '');
              const targetSnippet = allSnippets.find(s => {
                const sTitle = s.title.toLowerCase().replace(/\.md$/, '');
                return sTitle === cleanTitle;
              });

              if (targetSnippet) {
                const updatedSnippet = { ...targetSnippet, code: content, timestamp: Date.now() };
                await vaultStore.saveSnippet(updatedSnippet);

                // If it's the currently active snippet, update it
                if (vaultStore.selectedSnippet?.id === targetSnippet.id) {
                  vaultStore.setSelectedSnippet(updatedSnippet);
                }
                appliedUpdates++;
              }
            }

            // 3. Process lumina-delete
            const deleteMatches = [...fullContent.matchAll(/```lumina-delete\s+([^\n]+?)\s*```/g)];
            for (const match of deleteMatches) {
              const title = match[1].trim();

              // Find snippet by title (be tolerant of .md extensions)
              const cleanTitle = title.toLowerCase().replace(/\.md$/, '');
              const targetSnippet = allSnippets.find(s => {
                const sTitle = s.title.toLowerCase().replace(/\.md$/, '');
                return sTitle === cleanTitle;
              });

              if (targetSnippet) {
                try {
                  await vaultStore.deleteSnippet(targetSnippet.id, true);
                  appliedDeletions++;
                } catch (e) {
                  const current = get().chatMessages;
                  current[current.length - 1].content += `\n\n*(❌ Failed to delete "${title}": ${e.message})*`;
                  set({ chatMessages: [...current] });
                }
              } else {
                const current = get().chatMessages;
                current[current.length - 1].content += `\n\n*(⚠️ File not found for deletion: "${title}")*`;
                set({ chatMessages: [...current] });
              }
            }

            if (appliedCreations > 0 || appliedUpdates > 0 || appliedDeletions > 0) {
              const current = get().chatMessages;
              const prevContent = current[current.length - 1].content;

              // Strip all tool blocks from chat display, keep only surrounding text
              const cleaned = (() => {
                const prefixes = ['```lumina-create ', '```lumina-update '];
                let text = prevContent;
                for (const prefix of prefixes) {
                  const escaped = prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                  // Use greedy match to grab the closest ``` after content start
                  text = text.replace(new RegExp(escaped + '[^\\n]*\\n[\\s\\S]*?\\n```', 'g'), '');
                }
                text = text.replace(/```lumina-delete\s+[^\n]+```\n?/g, '');
                text = text.replace(/\n{4,}/g, '\n\n\n').trim();
                // If stripping gutted everything, keep a clean summary
                if (!text || text.length < 20) {
                  const parts = [];
                  if (appliedCreations > 0) parts.push(`${appliedCreations} file(s) about your request`);
                  if (appliedUpdates > 0) parts.push(`${appliedUpdates} file(s) updated`);
                  if (appliedDeletions > 0) parts.push(`Deleted`);
                  return `I've ${parts.join(' and ')}. You can find them in your vault!`;
                }
                return text;
              })();

              current[current.length - 1].content = cleaned;
              set({ chatMessages: [...current] });
            }
          } catch (err) {
            console.error('[AIStore] Failed to auto-apply file operations:', err);
          }
          }
        } finally {
          if (timeoutId) clearTimeout(timeoutId)
        }

        get().saveChatHistory()
        set({ isChatLoading: false, chatController: null })
      } catch (error) {
        console.error('[AIStore] Chat Error:', error)

        // Clean up empty assistant message if it failed immediately
        set((state) => {
          const msgs = [...state.chatMessages]
          if (msgs.length > 0) {
            const lastMsg = msgs[msgs.length - 1]
            if (lastMsg.role === 'assistant' && !lastMsg.content && !lastMsg.imageUrl) {
              msgs.pop()
            }
          }
          return { chatMessages: msgs, isChatLoading: false, chatError: error.message, chatController: null }
        })
      }
    }
  }
})
