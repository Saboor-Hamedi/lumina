import { create } from 'zustand'

export const useAIStore = create((set, get) => {
  // Initialize worker
  const worker = new Worker(new URL('../ai/ai.worker.js', import.meta.url), { type: 'module' });

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
        return results.map(result => ({
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
        const validVaultPath = (vaultPath && typeof vaultPath === 'string') ? vaultPath : null

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
    chatMessages: [],
    isChatLoading: false,
    chatError: null,

    updateMessage: (index, updates) =>
      set((state) => {
        const newMessages = [...state.chatMessages]
        if (newMessages[index]) {
          newMessages[index] = { ...newMessages[index], ...updates }
        }
        return { chatMessages: newMessages }
      }),

    clearChat: () => set({ chatMessages: [], chatError: null }),

    sendChatMessage: async (message, contextSnippets = []) => {
      const { settings } = (await import('../../core/store/useSettingsStore')).useSettingsStore.getState()
      const { deepSeekKey, deepSeekModel } = settings

      // 1. Connectivity Check
      if (!navigator.onLine) {
        set({ isChatLoading: false, chatError: 'No internet connection. Please check your network.' })
        return
      }

      // 2. Validate Key
      const visibleKey = deepSeekKey || import.meta.env.VITE_DEEPSEEK_KEY
      if (!visibleKey) {
        set({ chatError: 'Missing API Key. Please configure it in Settings > AI Models or add VITE_DEEPSEEK_KEY to .env' })
        return
      }

      // Add user message to UI immediately
      const userMsg = { role: 'user', content: message }
      const newHistory = [...get().chatMessages, userMsg]
      set({ chatMessages: newHistory, isChatLoading: true, chatError: null })

      try {
        // 3. Auto-retrieve relevant chunks from vault (RAG)
        let vaultContext = []
        let vaultAccessNote = ''
        try {
          if (window.api?.searchVault) {
            const searchResults = await window.api.searchVault(message, {
              threshold: 0.25, // Lower threshold to get more results
              limit: 10,
              rerank: true
            })

            if (searchResults && searchResults.length > 0) {
              vaultContext = searchResults.map(chunk => ({
                file: chunk.metadata?.fileName || chunk.filePath || 'Unknown',
                text: chunk.text,
                score: chunk.finalScore || chunk.score,
                type: chunk.type
              }))
              vaultAccessNote = `Found ${vaultContext.length} relevant chunks from your vault.`
            } else {
              vaultAccessNote = 'I searched your vault but didn\'t find exact matches. I still have access to your vault though!'
            }
          } else {
            vaultAccessNote = 'Vault search API not available. Please ensure the vault is properly initialized.'
          }
        } catch (searchErr) {
          console.warn('[AIStore] Vault search failed:', searchErr)
          vaultAccessNote = 'Vault search encountered an error, but I may still have access to your files.'
        }

        // Construct System Prompt with Context
        let systemPrompt = `You are Lumina AI, an intelligent knowledge assistant inside a modern Markdown editor. You have FULL ACCESS to the user's vault and can see all their notes, code, and files.

You are capable of:
- **Code & Tech**: Explaining, debugging, and refactoring code.
- **Content Creation**: Drafting, editing, and polishing markdown notes.
- **Knowledge Management**: Summarizing and structuring complex ideas.

Be concise, helpful, and use beautiful Markdown formatting.

**CRITICAL INSTRUCTIONS**:
1. You HAVE ACCESS to the user's vault - you can see their files, notes, and code.
2. When they ask "what do you know about my vault" or "what about my notes", you MUST respond that you have access and can help them.
3. Use the provided context below to answer questions about their vault.
4. Always cite your sources by mentioning the file name.
5. If the answer isn't in the provided context, say so, but emphasize that you DO have access and can help them explore or find information.

${vaultAccessNote}`
        
        // Add vault context if available
        if (vaultContext.length > 0) {
          systemPrompt += `\n\n**Relevant Context from User Vault (${vaultContext.length} chunks found):**\n`
          vaultContext.forEach((ctx, idx) => {
            const fileName = ctx.file.split(/[/\\]/).pop() // Just filename, not full path
            systemPrompt += `\n[${idx + 1}] File: ${fileName} (relevance: ${(ctx.score * 100).toFixed(1)}%)\n${ctx.text.slice(0, 1500)}\n`
          })
          systemPrompt += '\n\nUse this context to provide accurate, grounded answers. Cite files when referencing them.'
        } else {
          systemPrompt += '\n\n**Note**: While I didn\'t find exact matches in this search, I still have access to your vault. Try asking more specifically about files, topics, or I can help you explore your vault structure.'
        }
        
        // Add explicit context snippets if provided
        if (contextSnippets.length > 0) {
          systemPrompt += '\n\n**Active Context from Currently Open Notes:**\n'
          contextSnippets.forEach(snip => {
            systemPrompt += `--- [${snip.title}] ---\n${snip.code.slice(0, 2000)}\n\n`
          })
        }

        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 30000) // 30s Timeout

        const response = await fetch('https://api.deepseek.com/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${visibleKey}`
          },
          body: JSON.stringify({
            model: deepSeekModel || 'deepseek-chat',
            messages: [
              { role: 'system', content: systemPrompt },
              ...newHistory
            ],
            stream: false
          }),
          signal: controller.signal
        })

        clearTimeout(timeoutId)

        if (!response.ok) {
          if (response.status === 401) throw new Error('Invalid API Key. Please check your settings.')
          if (response.status === 429) throw new Error('Rate limit exceeded. Please try again later.')
          if (response.status >= 500) throw new Error('DeepSeek Server Error. Please try again later.')
          
          const errData = await response.json().catch(() => ({}))
          throw new Error(errData.error?.message || `API Error: ${response.status}`)
        }

        const data = await response.json()
        const botMsg = data.choices[0].message

        set((state) => ({
          chatMessages: [...state.chatMessages, botMsg],
          isChatLoading: false
        }))
      } catch (error) {
        console.error('DeepSeek Chat Error:', error)
        let errorMessage = error.message || 'Failed to connect to AI server.'
        
        if (error.name === 'AbortError') {
          errorMessage = 'Request timed out. The AI is taking too long to respond.'
        }

        set({ 
          isChatLoading: false, 
          chatError: errorMessage 
        })
      }
    }
  }
})
