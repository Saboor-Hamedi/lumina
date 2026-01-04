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
    embeddingsCache: {}, // SnippetID -> Vector[]
    pendingTasks: new Map(),

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

    // Compute Cosine Similarity
    computeSimilarity: (vecA, vecB) => {
      if (!vecA || !vecB || vecA.length !== vecB.length) return 0
      let dot = 0
      let magA = 0
      let magB = 0
      for (let i = 0; i < vecA.length; i++) {
        dot += vecA[i] * vecB[i]
        magA += vecA[i] * vecA[i]
        magB += vecB[i] * vecB[i]
      }
      return dot / (Math.sqrt(magA) * Math.sqrt(magB))
    },

    indexVault: async (snippets) => {
      const { generateEmbedding, embeddingsCache } = get()
      const updates = {}

      // Process sequentially to be nice to CPU (or parallel with Promise.all if daring)
      for (const snippet of snippets) {
        if (!embeddingsCache[snippet.id]) {
          // Combine Title + Content for rich context
          const text = `${snippet.title}\n${snippet.code || ''}`.slice(0, 1000) // Limit context window
          try {
            const vector = await generateEmbedding(text)
            updates[snippet.id] = vector
          } catch (err) {
            console.error('Embedding failed', err)
          }
        }
      }

      if (Object.keys(updates).length > 0) {
        set((state) => ({
          embeddingsCache: { ...state.embeddingsCache, ...updates }
        }))
      }
    },

    searchNotes: async (query, threshold = 0.5) => {
      const { generateEmbedding, embeddingsCache, computeSimilarity } = get()
      if (!query || !query.trim()) return []

      try {
        const queryVec = await generateEmbedding(query)
        const results = []

        for (const [id, noteVec] of Object.entries(embeddingsCache)) {
          if (!noteVec) continue
          const score = computeSimilarity(queryVec, noteVec)
          if (score > threshold) {
            results.push({ id, score })
          }
        }

        return results.sort((a, b) => b.score - a.score)
      } catch (err) {
        console.error('Semantic search failed', err)
        return []
      }
    },

    // --- DeepSeek Chat Integration ---
    chatMessages: [],
    isChatLoading: false,
    chatError: null,

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
        // Construct System Prompt with Context
        let systemPrompt = `You are Lumina AI, an intelligent knowledge assistant inside a modern Markdown editor. You help users with writing, coding, and organizing thoughts.
You are capable of:
- **Code & Tech**: Explaining, debugging, and refactoring code.
- **Content Creation**: Drafting, editing, and polishing markdown notes.
- **Knowledge Management**: Summarizing and structuring complex ideas.

Be concise, helpful, and use beautiful Markdown formatting.`
        
        if (contextSnippets.length > 0) {
          systemPrompt += '\n\nActive Context from User Notes:\n'
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
