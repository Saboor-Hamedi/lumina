import { create } from 'zustand'

export const useAIStore = create((set, get) => {
  // Initialize worker
  const worker = new Worker(new URL('../ai/ai.worker.js', import.meta.url), { type: 'module' })

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
    chatMessages: [],
    isChatLoading: false,
    chatError: null,

    // Load conversation history from localStorage on init
    loadChatHistory: () => {
      try {
        if (typeof localStorage === 'undefined') {
          console.warn('[AIStore] localStorage not available')
          return
        }

        const saved = localStorage.getItem('lumina-chat-history')
        if (saved) {
          const parsed = JSON.parse(saved)
          if (Array.isArray(parsed) && parsed.length > 0) {
            // Validate message structure
            const validMessages = parsed.filter(
              (msg) =>
                msg &&
                typeof msg === 'object' &&
                msg.role &&
                (typeof msg.content === 'string' || msg.imageUrl)
            )

            if (validMessages.length > 0) {
              set({ chatMessages: validMessages })
            }
          }
        }
      } catch (e) {
        console.warn('[AIStore] Failed to load chat history:', e)
        // Clear corrupted data
        try {
          localStorage.removeItem('lumina-chat-history')
        } catch {
          // Ignore cleanup errors
        }
      }
    },

    // Save conversation history to localStorage
    saveChatHistory: () => {
      try {
        if (typeof localStorage === 'undefined') {
          return
        }

        const messages = get().chatMessages
        if (Array.isArray(messages) && messages.length > 0) {
          // Limit history size to prevent localStorage quota issues (keep last 100 messages)
          const messagesToSave = messages.slice(-100)
          localStorage.setItem('lumina-chat-history', JSON.stringify(messagesToSave))
        } else {
          localStorage.removeItem('lumina-chat-history')
        }
      } catch (e) {
        // Handle quota exceeded or other storage errors
        if (e.name === 'QuotaExceededError') {
          console.warn('[AIStore] Chat history too large, clearing old messages')
          try {
            const messages = get().chatMessages
            // Keep only last 50 messages
            const reduced = messages.slice(-50)
            localStorage.setItem('lumina-chat-history', JSON.stringify(reduced))
            set({ chatMessages: reduced })
          } catch {
            // If still fails, clear history
            localStorage.removeItem('lumina-chat-history')
          }
        } else {
          console.warn('[AIStore] Failed to save chat history:', e)
        }
      }
    },

    updateMessage: (index, updates) => {
      set((state) => {
        const newMessages = [...state.chatMessages]
        if (newMessages[index]) {
          newMessages[index] = { ...newMessages[index], ...updates }
        }
        // Auto-save after update
        setTimeout(() => get().saveChatHistory(), 100)
        return { chatMessages: newMessages }
      })
    },

    clearChat: () => {
      set({ chatMessages: [], chatError: null, imageGenerationError: null })
      localStorage.removeItem('lumina-chat-history')
    },

    /**
     * Generate an image from a text prompt
     * @param {string} prompt - The image description
     * @returns {Promise<{imageUrl: string, prompt: string}>}
     */
    generateImage: async (prompt) => {
      // Dynamic import to avoid loading if not used
      const { generateImageWithRetry, extractImagePrompt } = await import(
        '../../features/AI/imageGenerationService.js'
      )

      // Extract prompt if it's a command
      const imagePrompt = extractImagePrompt(prompt)

      if (!imagePrompt) {
        set({ imageGenerationError: 'Please provide an image description.' })
        throw new Error('Image prompt cannot be empty.')
      }

      // Load settings to get Hugging Face API key
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

      let controller = new AbortController()
      set({ imageGenerationController: controller })

      try {
        const result = await generateImageWithRetry(imagePrompt, huggingFaceKey, controller)

        // Add image message to chat
        const imageMessage = {
          role: 'assistant',
          content: '',
          imageUrl: result.imageUrl,
          imagePrompt: result.prompt,
          timestamp: result.timestamp
        }

        set((state) => {
          const newMessages = [...(state.chatMessages || []), imageMessage]
          return {
            chatMessages: newMessages,
            isImageGenerating: false,
            imageGenerationError: null,
            imageGenerationController: null
          }
        })

        // Auto-save chat history
        setTimeout(() => get().saveChatHistory(), 100)

        return result
      } catch (error) {
        console.error('[AIStore] Image generation error:', error)

        // Provide more helpful error messages
        let errorMessage = error.message || 'Failed to generate image. Please try again.'

        // Check if it's a network/CORS issue
        if (
          error.message &&
          (error.message.includes('Failed to fetch') ||
            error.message.includes('NetworkError') ||
            error.message.includes('CORS') ||
            error.message.includes('network'))
        ) {
          errorMessage = `Network error: ${error.message}\n\nPossible solutions:\n1. Check your internet connection\n2. The Hugging Face API may be temporarily unavailable\n3. Try using your API key in Settings > AI Models > Image Generation\n4. Firewall/proxy may be blocking the request`
        }

        set({
          isImageGenerating: false,
          imageGenerationError: errorMessage,
          imageGenerationController: null
        })

        throw error
      }
    },

    /**
     * Cancel the current chat response
     */
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

    /**
     * Cancel the current image generation process
     */
    cancelImageGeneration: () => {
      const controller = get().imageGenerationController
      if (controller && !controller.signal.aborted) {
        controller.abort()
        set({
          isImageGenerating: false,
          imageGenerationController: null
        })
      }
    },

    /**
     * Cancel the current image generation process
     */
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
      // Input validation
      if (!message || typeof message !== 'string' || !message.trim()) {
        set({ chatError: 'Message cannot be empty.' })
        return
      }

      if (!Array.isArray(contextSnippets)) {
        contextSnippets = []
      }

      // Load settings
      let settings
      try {
        const settingsModule = await import('../../core/store/useSettingsStore')
        settings = settingsModule.useSettingsStore.getState()
      } catch (err) {
        console.error('[AIStore] Failed to load settings:', err)
        set({ chatError: 'Failed to load settings. Please try again.' })
        return
      }

      // Get settings object - handle both direct state and nested settings property
      const settingsObj = settings?.settings || settings || {}
      const { deepSeekKey, deepSeekModel } = settingsObj

      // 1. Connectivity Check
      if (!navigator.onLine) {
        set({
          isChatLoading: false,
          chatError: 'No internet connection. Please check your network.'
        })
        return
      }

      // 2. Validate Key - check for truthy string value (not null, undefined, or empty string)
      const envKey = import.meta.env.VITE_DEEPSEEK_KEY
      const visibleKey =
        (deepSeekKey && typeof deepSeekKey === 'string' && deepSeekKey.trim()) ||
        (envKey && typeof envKey === 'string' && envKey.trim())

      if (!visibleKey) {
        // Debug logging to help diagnose the issue
        console.warn('[AIStore] API Key validation failed:', {
          deepSeekKey: deepSeekKey ? `present (${deepSeekKey.length} chars)` : 'missing',
          deepSeekKeyType: typeof deepSeekKey,
          deepSeekKeyValue: deepSeekKey ? `${deepSeekKey.substring(0, 5)}...` : 'null/undefined',
          envKey: envKey ? 'present' : 'missing',
          settingsObjKeys: settingsObj ? Object.keys(settingsObj).join(', ') : 'no settings',
          hasDeepSeekKey: 'deepSeekKey' in (settingsObj || {})
        })
        set({
          chatError:
            'Missing API Key. Please configure it in Settings > AI Models. Make sure the key is saved and not empty.'
        })
        return
      }

      // Add user message to UI immediately
      const userMsg = { role: 'user', content: message.trim() }
      const currentMessages = get().chatMessages || []
      const newHistory = [...currentMessages, userMsg]
      set({ chatMessages: newHistory, isChatLoading: true, chatError: null })

      // Declare controller and timeoutId in outer scope for error handling
      let controller = null
      let timeoutId = null

      try {
        // 3. Auto-retrieve relevant chunks from vault (RAG) with improved selection
        let vaultContext = []
        let vaultAccessNote = ''
        try {
          if (window.api?.searchVault) {
            // Use adaptive threshold based on query length and complexity
            const queryLength = message.trim().length
            const adaptiveThreshold = queryLength > 50 ? 0.2 : 0.3 // Lower threshold for longer queries

            const searchResults = await window.api.searchVault(message, {
              threshold: adaptiveThreshold,
              limit: 15, // Get more results for better selection
              rerank: true
            })

            if (searchResults && Array.isArray(searchResults) && searchResults.length > 0) {
              // Filter and prioritize chunks
              vaultContext = searchResults
                .filter((chunk) => {
                  // Filter out very low relevance chunks
                  const score = chunk?.finalScore ?? chunk?.score ?? 0
                  return score >= adaptiveThreshold && chunk?.text
                })
                .map((chunk) => ({
                  file: chunk?.metadata?.fileName || chunk?.filePath || 'Unknown',
                  text: String(chunk?.text || '').trim(),
                  score: chunk?.finalScore ?? chunk?.score ?? 0,
                  type: chunk?.type || 'unknown',
                  metadata: chunk?.metadata || {}
                }))
                .filter((ctx) => ctx.text.length > 0) // Remove empty chunks
                .sort((a, b) => b.score - a.score) // Sort by relevance
                .slice(0, 12) // Take top 12 most relevant chunks

              vaultAccessNote = `Found ${vaultContext.length} highly relevant chunks from your vault.`
            } else {
              vaultAccessNote =
                "I searched your vault but didn't find exact matches. I still have access to your vault though!"
            }
          } else {
            vaultAccessNote =
              'Vault search API not available. Please ensure the vault is properly initialized.'
          }
        } catch (searchErr) {
          console.warn('[AIStore] Vault search failed:', searchErr)
          vaultAccessNote =
            'Vault search encountered an error, but I may still have access to your files.'
        }

        // Construct System Prompt with Context
        let systemPrompt = `You are Lumina AI, an intelligent knowledge assistant inside a modern Markdown editor. You have FULL ACCESS to the user's vault and can see all their notes, code, and files.

You are capable of:
- **Code & Tech**: Explaining, debugging, and refactoring code.
- **Content Creation**: Drafting, editing, and polishing markdown notes.
- **Knowledge Management**: Summarizing and structuring complex ideas.
- **Context Awareness**: You can see all currently open notes/tabs, their tags, modification dates, and content.

Be concise, helpful, and use beautiful Markdown formatting.

**CRITICAL INSTRUCTIONS**:
1. You HAVE ACCESS to the user's vault - you can see their files, notes, and code.
2. You can see ALL currently open notes/tabs - use this context to provide more relevant answers.
3. When they ask "what do you know about my vault" or "what about my notes", you MUST respond that you have access and can help them.
4. Use the provided context below to answer questions about their vault.
5. Always cite your sources by mentioning the file name when referencing specific content.
6. If the answer isn't in the provided context, say so, but emphasize that you DO have access and can help them explore or find information.
7. Remember previous conversation context - you maintain memory across messages.

${vaultAccessNote}`

        // Add vault context if available (with smarter chunk management)
        if (vaultContext.length > 0) {
          systemPrompt += `\n\n**Relevant Context from User Vault (${vaultContext.length} chunks found):**\n`

          // Group chunks by file to avoid redundancy
          const chunksByFile = {}
          vaultContext.forEach((ctx) => {
            if (!ctx?.file) return
            const fileName = String(ctx.file).split(/[/\\]/).pop() || 'Unknown'
            if (!chunksByFile[fileName]) {
              chunksByFile[fileName] = []
            }
            chunksByFile[fileName].push(ctx)
          })

          let chunkIndex = 1
          Object.entries(chunksByFile).forEach(([fileName, chunks]) => {
            if (!Array.isArray(chunks) || chunks.length === 0) return

            // Combine chunks from same file, prioritizing highest score chunks
            const combinedText = chunks
              .sort((a, b) => (b?.score ?? 0) - (a?.score ?? 0))
              .slice(0, 3) // Max 3 chunks per file
              .map((c) => String(c?.text || '').trim())
              .filter((text) => text.length > 0)
              .join('\n\n---\n\n')
              .slice(0, 2000) // Limit total per file

            if (combinedText.length === 0) return

            const validChunks = chunks.filter((c) => c?.score != null)
            const avgScore =
              validChunks.length > 0
                ? validChunks.reduce((sum, c) => sum + (c.score || 0), 0) / validChunks.length
                : 0

            systemPrompt += `\n[${chunkIndex}] File: ${fileName} (relevance: ${(avgScore * 100).toFixed(1)}%)\n${combinedText}\n`
            chunkIndex++
          })

          systemPrompt +=
            '\n\nUse this context to provide accurate, grounded answers. Always cite the file name when referencing specific content.'
        } else {
          systemPrompt +=
            "\n\n**Note**: While I didn't find exact matches in this search, I still have access to your vault. Try asking more specifically about files, topics, or I can help you explore your vault structure."
        }

        // Add explicit context snippets if provided (with enhanced metadata)
        if (contextSnippets.length > 0) {
          systemPrompt += '\n\n**Active Context from Currently Open Notes:**\n'
          contextSnippets.forEach((snip) => {
            const tags = snip.tags ? ` [Tags: ${snip.tags}]` : ''
            const date = snip.timestamp
              ? ` [Modified: ${new Date(snip.timestamp).toLocaleDateString()}]`
              : ''
            const lang = snip.language ? ` [Language: ${snip.language}]` : ''
            systemPrompt += `--- [${snip.title}]${tags}${date}${lang} ---\n${snip.code.slice(0, 2000)}\n\n`
          })
        }

        controller = new AbortController()
        set({ chatController: controller })
        timeoutId = setTimeout(() => {
          if (controller) {
            controller.abort()
          }
        }, 60000) // 60s Timeout for streaming

        // Add placeholder assistant message for streaming
        const assistantMsg = { role: 'assistant', content: '' }
        set((state) => ({
          chatMessages: [...state.chatMessages, assistantMsg],
          isChatLoading: true
        }))

        const response = await fetch('https://api.deepseek.com/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${visibleKey}`
          },
          body: JSON.stringify({
            model: String(deepSeekModel || 'deepseek-chat'),
            messages: [{ role: 'system', content: systemPrompt }, ...newHistory],
            stream: true // Enable streaming
          }),
          signal: controller?.signal
        })

        // Clear timeout on successful response
        if (timeoutId) {
          clearTimeout(timeoutId)
          timeoutId = null
        }

        if (!response.ok) {
          // Remove placeholder message on error
          set((state) => ({
            chatMessages: messages.slice(0, -1),
            isChatLoading: false,
            chatError: getErrorMessage(error),
            chatController: null
          }))

          if (response.status === 401) {
            throw new Error('Invalid API Key. Please check your settings.')
          }
          if (response.status === 429) {
            throw new Error('Rate limit exceeded. Please try again later.')
          }
          if (response.status >= 500) {
            throw new Error('DeepSeek Server Error. Please try again later.')
          }

          const errData = await response.json().catch(() => ({}))
          throw new Error(errData.error?.message || `API Error: ${response.status}`)
        }

        // Handle streaming response
        if (!response.body) {
          throw new Error('Response body is null. Streaming not available.')
        }

        const reader = response.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ''
        let fullContent = ''
        let hasContent = false

        try {
          while (true) {
            const { done, value } = await reader.read()
            if (done) break

            if (value) {
              buffer += decoder.decode(value, { stream: true })
            }

            const lines = buffer.split('\n')
            buffer = lines.pop() || '' // Keep incomplete line in buffer

            for (const line of lines) {
              if (!line.trim()) continue

              if (line.startsWith('data: ')) {
                const data = line.slice(6).trim()
                if (data === '[DONE]') continue

                try {
                  const parsed = JSON.parse(data)
                  const delta = parsed?.choices?.[0]?.delta?.content

                  if (delta && typeof delta === 'string') {
                    fullContent += delta
                    hasContent = true

                    // Update the last message (assistant message) with accumulated content
                    set((state) => {
                      const messages = Array.isArray(state.chatMessages) ? state.chatMessages : []
                      if (
                        messages.length > 0 &&
                        messages[messages.length - 1]?.role === 'assistant'
                      ) {
                        const updated = [...messages]
                        updated[messages.length - 1] = {
                          ...updated[messages.length - 1],
                          content: fullContent
                        }
                        return { chatMessages: updated }
                      }
                      return { chatMessages: messages }
                    })
                  }
                } catch {
                  // Ignore parse errors for incomplete JSON
                }
              }
            }
          }
        } catch (streamError) {
          console.error('[AIStore] Streaming error:', streamError)
          // If we have partial content, keep it
          if (!hasContent && fullContent.length === 0) {
            throw streamError
          }
        } finally {
          try {
            reader.releaseLock()
          } catch {
            // Ignore release errors
          }
        }

        // If no content was received, remove placeholder
        if (!hasContent || fullContent.length === 0) {
          set((state) => {
            const messages = Array.isArray(state.chatMessages) ? state.chatMessages : []
            return {
              chatMessages: messages.slice(0, -1),
              isChatLoading: false,
              chatError: 'Received empty response from AI.'
            }
          })
          return
        }

        // Save conversation history after streaming completes
        try {
          get().saveChatHistory()
        } catch (saveErr) {
          console.warn('[AIStore] Failed to save chat history:', saveErr)
        }

        set({ isChatLoading: false, chatController: null })
      } catch (error) {
        console.error('[AIStore] DeepSeek Chat Error:', error)

        // Cleanup timeout and controller if still active
        if (timeoutId) {
          clearTimeout(timeoutId)
          timeoutId = null
        }
        if (controller) {
          try {
            controller.abort()
          } catch {
            // Ignore abort errors
          }
        }

        // Helper function to get user-friendly error messages
        const getErrorMessage = (err) => {
          if (!err) return 'An unknown error occurred.'

          if (err.name === 'AbortError') {
            return 'Request timed out. The AI is taking too long to respond.'
          }

          if (err.message) {
            return String(err.message)
          }

          if (typeof err === 'string') {
            return err
          }

          return 'Failed to connect to AI server. Please try again.'
        }

        // Remove placeholder assistant message on error
        set((state) => {
          const messages = Array.isArray(state.chatMessages) ? state.chatMessages : []
          const lastMsg = messages[messages.length - 1]

          // Only remove if it's an empty assistant message (placeholder)
          if (lastMsg?.role === 'assistant' && !lastMsg?.content) {
            return {
              chatMessages: messages.slice(0, -1),
              isChatLoading: false,
              chatError: getErrorMessage(error)
            }
          }

          return {
            isChatLoading: false,
            chatError: getErrorMessage(error),
            chatController: null
          }
        })
      }
    }
  }
})
