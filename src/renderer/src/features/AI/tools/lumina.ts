import { create } from 'zustand'
import {
  initAIWorker,
  generateEmbedding,
  generateLocalText,
  getPendingTasks
} from '../services/aiWorkerManager'
import {
  loadChatSessions,
  saveChatSession,
  createNewChatSession,
  deleteChatSession,
  renameChatSession,
  togglePinChatSession,
  duplicateChatSession,
  clearChatSessionMessages,
  persistChatHistory
} from '../services/chatStorage'
import {
  resolveMentions,
  resolveReferencedFiles,
  retrieveWorkspaceRAG,
  buildSystemPrompt
} from '../services/aiPromptBuilder'
import { getTheme } from '../../theme/hooks/themeDefinitions'
import {
  runDeepSeekStream,
  runFallbackProviderStream,
  applyLegacyMarkdownBlocks
} from '../services/aiStreamRunner'
import { detectUserIntent, IntentCategory } from '../services/intentRouter'
import { getAIMode } from '../modes/index'
import { getAITools, getMemoryTools } from './index'
import { AIProviderFactory, resolveProviderConfig } from '../providers/index'
import type {
  AIStore,
  AIUsageStats,
  ChatMessage,
  ChatSession,
  MentionItem,
  ProviderRecordUsageParams,
  SearchNoteResult
} from '../types/ai.types'

let loadSessionsPromise: Promise<void> | null = null

/**
 * Loads stored AI token usage metrics from browser local storage.
 * Gracefully defaults to zero counters if parse fails or entry is missing.
 */
function loadStoredAIUsage(): AIUsageStats {
  try {
    const raw = localStorage.getItem('lumina_ai_usage_stats')
    if (raw) {
      const parsed = JSON.parse(raw)
      return {
        totalTokens: parsed.totalTokens || 0,
        promptTokens: parsed.promptTokens || 0,
        completionTokens: parsed.completionTokens || 0,
        totalTimeMs: parsed.totalTimeMs || 0,
        totalCostUSD: parsed.totalCostUSD || 0,
        totalPrompts: parsed.totalPrompts || 0
      }
    }
  } catch {
    // fallback to clean state
  }
  return {
    totalTokens: 0,
    promptTokens: 0,
    completionTokens: 0,
    totalTimeMs: 0,
    totalCostUSD: 0,
    totalPrompts: 0
  }
}

/**
 * Computes historical token and cost metrics by scanning all persisted session messages.
 * Uses a standard 4-char per token heuristic for approximation.
 */
export function computeUsageFromSessions(sessions: ChatSession[] = []): AIUsageStats {
  let promptTokens = 0
  let completionTokens = 0
  let totalPrompts = 0

  if (Array.isArray(sessions)) {
    for (const session of sessions) {
      if (Array.isArray(session?.messages)) {
        for (const msg of session.messages) {
          const text = msg.content || ''
          if (!text.trim()) continue
          const approxTokens = Math.max(1, Math.ceil(text.length / 4))
          if (msg.role === 'user') {
            promptTokens += approxTokens
          } else if (msg.role === 'assistant') {
            completionTokens += approxTokens
            totalPrompts++
          }
        }
      }
    }
  }

  const totalTokens = promptTokens + completionTokens
  const promptCost = (promptTokens / 1000) * 0.00014
  const completionCost = (completionTokens / 1000) * 0.00028
  const totalCostUSD = promptCost + completionCost
  const totalTimeMs = totalPrompts * 2800

  return {
    totalTokens,
    promptTokens,
    completionTokens,
    totalTimeMs,
    totalCostUSD,
    totalPrompts
  }
}

/**
 * Lumina AI Store (useAIStore)
 * Central Zustand store managing AI interactions, multi-session chat, RAG search, and agent execution.
 */
export const useAIStore = create<AIStore>((set, get) => {
  // Initialize worker event listeners for local offline AI model download progress
  initAIWorker({
    onProgress: (progress: number) => {
      set({ modelLoadingProgress: progress })
      const currentMessages = get().chatMessages
      if (currentMessages && currentMessages.length > 0) {
        const lastMsg = currentMessages[currentMessages.length - 1]
        if (lastMsg.isGenerating && progress) {
          const pct = Math.round(progress)
          if (pct % 5 === 0) {
            const newMessages = [...currentMessages]
            newMessages[newMessages.length - 1] = {
              ...lastMsg,
              content: `Downloading offline AI model... **${pct}%**`
            }
            set({ chatMessages: newMessages })
          }
        }
      }
    },
    onReady: () => {
      set({ isModelReady: true, modelLoadingProgress: 100 })
      const currentMessages = get().chatMessages
      if (currentMessages && currentMessages.length > 0) {
        const lastMsg = currentMessages[currentMessages.length - 1]
        if (lastMsg.isGenerating) {
          const newMessages = [...currentMessages]
          newMessages[newMessages.length - 1] = {
            ...lastMsg,
            content: 'Model loaded! Generating your file offline...'
          }
          set({ chatMessages: newMessages })
        }
      }
    },
    onError: (err: any) => {
      set({ aiError: err })
    }
  })

  // Trigger initial asynchronous session load
  setTimeout(() => {
    get().loadSessions()
  }, 0)

  return {
    aiError: null,
    isModelReady: false,
    modelLoadingProgress: 0,
    pendingTasks: getPendingTasks(),
    embeddingsCache: {},

    // Chat state
    chatError: null,
    isChatLoading: false,
    chatController: null,
    sessions: [],
    activeSessionId: null,
    chatMessages: [],
    activeThinkingStatus: '',

    // Usage & Workbench Stats
    aiUsageStats: loadStoredAIUsage(),

    /**
     * Records AI usage metrics and calculates exact USD costs based on active provider and model rates.
     */
    recordAIUsage: ({
      promptTokens = 0,
      completionTokens = 0,
      timeMs = 0,
      provider = '',
      model = ''
    }: ProviderRecordUsageParams) => {
      const current = get().aiUsageStats || loadStoredAIUsage()
      const totalTokens = (current.totalTokens || 0) + promptTokens + completionTokens
      const newPromptTokens = (current.promptTokens || 0) + promptTokens
      const newCompletionTokens = (current.completionTokens || 0) + completionTokens
      const newTotalTimeMs = (current.totalTimeMs || 0) + timeMs
      const newTotalPrompts = (current.totalPrompts || 0) + 1

      // Accurate pricing per 1,000 tokens based on active provider and model
      const p = (provider || '').toLowerCase()
      const m = (model || '').toLowerCase()

      let promptRate = 0.00014 // DeepSeek V3 default ($0.14 / 1M)
      let completionRate = 0.00028 // DeepSeek V3 default ($0.28 / 1M)

      if (p.includes('ollama') || m.includes('ollama')) {
        promptRate = 0
        completionRate = 0
      } else if (m.includes('deepseek-reasoner') || m.includes('r1')) {
        promptRate = 0.00055
        completionRate = 0.00219
      } else if (m.includes('gpt-4o-mini')) {
        promptRate = 0.00015
        completionRate = 0.0006
      } else if (m.includes('gpt-4o') || m.includes('gpt-4')) {
        promptRate = 0.0025
        completionRate = 0.01
      } else if (p.includes('anthropic') || m.includes('claude')) {
        promptRate = 0.003
        completionRate = 0.015
      } else if (p.includes('groq')) {
        promptRate = 0.00005
        completionRate = 0.00008
      }

      const promptCost = (promptTokens / 1000) * promptRate
      const completionCost = (completionTokens / 1000) * completionRate
      const newTotalCostUSD = (current.totalCostUSD || 0) + promptCost + completionCost

      const updatedStats: AIUsageStats = {
        totalTokens,
        promptTokens: newPromptTokens,
        completionTokens: newCompletionTokens,
        totalTimeMs: newTotalTimeMs,
        totalCostUSD: newTotalCostUSD,
        totalPrompts: newTotalPrompts
      }

      set({ aiUsageStats: updatedStats })
      try {
        localStorage.setItem('lumina_ai_usage_stats', JSON.stringify(updatedStats))
      } catch (err) {
        console.warn('[AIStore] Failed to save AI usage stats:', err)
      }
    },

    /**
     * Resets AI usage statistics counters in state and local storage.
     */
    resetAIUsage: () => {
      const resetStats: AIUsageStats = {
        totalTokens: 0,
        promptTokens: 0,
        completionTokens: 0,
        totalTimeMs: 0,
        totalCostUSD: 0,
        totalPrompts: 0
      }
      set({ aiUsageStats: resetStats })
      try {
        localStorage.setItem('lumina_ai_usage_stats', JSON.stringify(resetStats))
      } catch (err) {
        console.warn('[AIStore] Failed to reset AI usage stats:', err)
      }
    },

    // --- Offline Model Actions ---
    generateEmbedding,
    generateLocalText,

    // --- Workspace Indexing & Semantic Search API Wrappers ---
    searchNotes: async (query: string, threshold: number = 0.3): Promise<SearchNoteResult[]> => {
      if (!query || !query.trim()) return []
      try {
        const searchFn = (window as any).api?.searchWorkspace || (window as any).api?.searchVault
        if (!searchFn) {
          console.warn('[AIStore] Workspace search API not available')
          return []
        }
        const results = await searchFn(query, { threshold, limit: 20, rerank: true })
        return (results || []).map((result: any) => ({
          id: result.id,
          score: result.finalScore || result.score,
          chunk: result
        }))
      } catch (err) {
        console.error('[AIStore] Workspace search failed:', err)
        return []
      }
    },

    indexWorkspace: async (workspacePath?: string | null, options: { force?: boolean; onProgress?: ((p: number) => void) | null } = {}) => {
      try {
        const indexFn = (window as any).api?.indexWorkspace || (window as any).api?.indexVault
        if (!indexFn) {
          console.warn('[AIStore] Index API not available')
          return { success: false }
        }
        const validPath =
          workspacePath && typeof workspacePath === 'string' ? workspacePath : null
        return await indexFn(validPath, {
          force: options.force || false,
          onProgress: options.onProgress || null
        })
      } catch (err) {
        console.error('[AIStore] Indexing failed:', err)
        throw err
      }
    },

    indexVault: async (vaultPath?: string | null, options: { force?: boolean; onProgress?: ((p: number) => void) | null } = {}) => {
      return get().indexWorkspace(vaultPath, options)
    },

    getIndexStats: async () => {
      try {
        if (!(window as any).api?.getIndexStats) return null
        return await (window as any).api.getIndexStats()
      } catch (err) {
        console.error('[AIStore] Get stats failed:', err)
        return null
      }
    },

    // --- Multi-Session Chat Management ---
    loadSessions: async () => {
      if (loadSessionsPromise) return loadSessionsPromise
      loadSessionsPromise = (async () => {
        try {
          const { isChatLoading } = get()
          const { sessions, activeSessionId } = await loadChatSessions()

          // Calculate and backfill usage stats from all stored chat sessions
          const historicalUsage = computeUsageFromSessions(sessions)
          const currentStats = get().aiUsageStats || loadStoredAIUsage()
          let newUsageStats = currentStats

          if (historicalUsage.totalTokens > (currentStats.totalTokens || 0)) {
            newUsageStats = {
              totalTokens: Math.max(historicalUsage.totalTokens, currentStats.totalTokens || 0),
              promptTokens: Math.max(historicalUsage.promptTokens, currentStats.promptTokens || 0),
              completionTokens: Math.max(historicalUsage.completionTokens, currentStats.completionTokens || 0),
              totalTimeMs: Math.max(historicalUsage.totalTimeMs, currentStats.totalTimeMs || 0),
              totalCostUSD: Math.max(historicalUsage.totalCostUSD, currentStats.totalCostUSD || 0),
              totalPrompts: Math.max(historicalUsage.totalPrompts, currentStats.totalPrompts || 0)
            }
            try {
              localStorage.setItem('lumina_ai_usage_stats', JSON.stringify(newUsageStats))
            } catch (_) {}
          }

          // If actively generating, do NOT overwrite active messages in memory
          if (isChatLoading) {
            set({ sessions, activeSessionId, aiUsageStats: newUsageStats })
            return
          }
          const activeSession = sessions.find((s) => s.id === activeSessionId)
          set({
            sessions,
            activeSessionId,
            chatMessages: activeSession?.messages || [],
            aiUsageStats: newUsageStats
          })
        } finally {
          loadSessionsPromise = null
        }
      })()
      return loadSessionsPromise
    },

    saveSessions: async () => {},

    createNewSession: async () => {
      const { sessions, activeSessionId } = get()
      // If current active session is already empty, just keep it active
      const currentActive = sessions.find((s) => s.id === activeSessionId)
      if (currentActive && (!currentActive.messages || currentActive.messages.length === 0)) {
        return
      }

      // If another empty session already exists, switch to it instead of creating duplicates
      const existingEmpty = sessions.find(
        (s) => (!s.messages || s.messages.length === 0) && (s.title === 'New Chat' || !s.title)
      )
      if (existingEmpty) {
        get().switchSession(existingEmpty.id)
        return
      }

      const { session, isNew } = await createNewChatSession(sessions)
      if (isNew) {
        set((state) => {
          if (state.sessions.some((s) => s.id === session.id)) {
            return { activeSessionId: session.id, chatMessages: [] }
          }
          return {
            sessions: [session, ...state.sessions],
            activeSessionId: session.id,
            chatMessages: []
          }
        })
      } else {
        get().switchSession(session.id)
      }
    },

    renameSession: async (sessionId: string, newTitle: string) => {
      const { sessions } = get()
      const { sessions: updatedSessions } = await renameChatSession(sessionId, newTitle, sessions)
      set({ sessions: updatedSessions })
    },

    togglePinSession: async (sessionId: string) => {
      const { sessions } = get()
      const { sessions: updatedSessions } = await togglePinChatSession(sessionId, sessions)
      set({ sessions: updatedSessions })
    },

    duplicateSession: async (sessionId: string) => {
      const { sessions } = get()
      const { sessions: updatedSessions, newSession } = await duplicateChatSession(sessionId, sessions)
      if (newSession) {
        set({
          sessions: updatedSessions,
          activeSessionId: newSession.id,
          chatMessages: newSession.messages || []
        })
      }
    },

    clearSessionMessages: async (sessionId: string) => {
      const { sessions } = get()
      const { sessions: updatedSessions } = await clearChatSessionMessages(sessionId, sessions)
      set((state) => ({
        sessions: updatedSessions,
        ...(state.activeSessionId === sessionId ? { chatMessages: [] } : {})
      }))
    },

    switchSession: (sessionId: string) => {
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

    deleteSession: async (sessionId: string) => {
      const { sessions, activeSessionId } = get()
      let remainingSessions = sessions.filter((s) => s.id !== sessionId)

      // If deleting the last session, create a single clean session atomically
      let freshSession: ChatSession | null = null
      if (remainingSessions.length === 0) {
        freshSession = {
          id: crypto.randomUUID(),
          title: 'New Chat',
          messages: [],
          timestamp: Date.now()
        }
        remainingSessions = [freshSession]
      }

      let nextActiveId = activeSessionId
      if (activeSessionId === sessionId || !remainingSessions.some((s) => s.id === activeSessionId)) {
        nextActiveId = remainingSessions[0].id
      }

      const nextMessages =
        remainingSessions.find((s) => s.id === nextActiveId)?.messages || []

      set({
        sessions: remainingSessions,
        activeSessionId: nextActiveId,
        chatMessages: nextMessages
      })

      if (nextActiveId) {
        localStorage.setItem('lumina-active-session-id', nextActiveId)
      }

      await deleteChatSession(sessionId, sessions)

      if (freshSession) {
        await saveChatSession(freshSession)
      }
    },

    saveChatHistory: async () => {
      const { sessions, activeSessionId, chatMessages } = get()
      const { sessions: updatedSessions } = await persistChatHistory(
        sessions,
        activeSessionId,
        chatMessages
      )
      set({ sessions: updatedSessions })
    },

    updateMessage: async (index: number, updates: Partial<ChatMessage>) => {
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
        set({ chatMessages: [], chatError: null })
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
      set({ isChatLoading: false, chatController: null })
    },

    // --- Main Chat Send Message Orchestrator ---
    sendChatMessage: async (
      message: string,
      contextSnippets: any[] = [],
      mode: string = 'Standard',
      attachedMentions: MentionItem[] = []
    ) => {
      if (
        (!message || typeof message !== 'string' || !message.trim()) &&
        (!attachedMentions || attachedMentions.length === 0)
      ) {
        set({ chatError: 'Message cannot be empty.' })
        return
      }

      const cleanMessage = (message || '').trim()

      // 1. Local AI File Generator Intercept ("write a file about...")
      const writeMatch = cleanMessage.match(/^write (?:a )?file about (.+)/i)
      if (writeMatch) {
        const topic = writeMatch[1].trim()
        const userMsg: ChatMessage = {
          id: crypto.randomUUID(),
          role: 'user',
          content: cleanMessage,
          timestamp: Date.now()
        }
        const loadingMsg: ChatMessage = {
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

          const { useWorkspaceStore } = await import('../../../core/store/workspaceStore')
          const workspaceStore = (useWorkspaceStore as any).getState()
          const newSnippet = {
            id: crypto.randomUUID(),
            title: topic,
            code: generatedContent || `# ${topic}\n\n(No content generated)`,
            language: 'markdown',
            tags: '',
            timestamp: Date.now()
          }
          const saveAction = workspaceStore.saveNote || workspaceStore.saveSnippet
          if (saveAction) {
            await saveAction(newSnippet)
          }

          const successMsg: ChatMessage = {
            id: crypto.randomUUID(),
            role: 'assistant',
            content: `I have generated and created the file: **${topic}**. You can find it in your workspace!`,
            timestamp: Date.now()
          }
          const current = get().chatMessages
          current[current.length - 1] = successMsg
          set({ chatMessages: [...current], isChatLoading: false })
          await get().saveChatHistory()
        } catch (err: any) {
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

      // 2. Settings & API Key Resolution
      let settings: any
      try {
        const settingsModule = await import('../../../core/store/SettingStore')
        settings = (settingsModule as any).useSettingsStore.getState()
      } catch (err) {
        console.error('[AIStore] Failed to load settings:', err)
        set({ chatError: 'Failed to load settings.' })
        return
      }

      const settingsObj = settings?.settings || settings || {}
      const { deepSeekKey } = settingsObj
      const visibleKey = deepSeekKey || (import.meta as any).env?.VITE_DEEPSEEK_KEY

      const userMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'user',
        content: cleanMessage,
        timestamp: Date.now(),
        attachedMentions
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

      // 3. Resolve Workspace Context & Mentions
      const { useWorkspaceStore } = await import('../../../core/store/workspaceStore')
      const vs = (useWorkspaceStore as any).getState()
      const allSnippets = Array.isArray(vs.snippets)
        ? vs.snippets
        : Array.isArray(vs.notes)
          ? vs.notes
          : Object.values(vs.snippets || vs.notes || {})
      const allFolders = vs.folders || []

      const mentionedSnippets = resolveMentions(cleanMessage, attachedMentions, allSnippets)
      const requestedFiles = resolveReferencedFiles(cleanMessage, allSnippets, mentionedSnippets)

      const requestedBrainDocs: any[] = []
      try {
        const { retrieveRelevantKnowledge } = await import('../services/brainKnowledge')
        const matches = retrieveRelevantKnowledge(cleanMessage, 2)
        if (matches?.length > 0) requestedBrainDocs.push(...matches)
      } catch (_) {}

      const assistantMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: '',
        timestamp: Date.now()
      }

      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller?.abort(), 180000)
      const startTime = Date.now()

      set({
        chatMessages: [...newHistory, assistantMsg],
        isChatLoading: true,
        activeThinkingStatus: 'Thinking...',
        chatError: null,
        chatController: controller
      })

      try {
        const { vaultContext, vaultAccessNote } = await retrieveWorkspaceRAG(cleanMessage)
        const modeCfg = getAIMode(mode)
        const detectedIntent = detectUserIntent(
          cleanMessage,
          mentionedSnippets,
          vs.selectedSnippet || vs.selectedNote
        )

        const storedThemeId =
          (typeof localStorage !== 'undefined' && localStorage.getItem('theme-id')) || null
        const domThemeId =
          (typeof document !== 'undefined' && document.documentElement.getAttribute('data-theme')) || null
        const settingsThemeId = settingsObj?.theme || null

        // Avoid 'default' if a valid theme is stored
        const rawThemeId =
          (storedThemeId && storedThemeId !== 'default' ? storedThemeId : null) ||
          (domThemeId && domThemeId !== 'default' ? domThemeId : null) ||
          (settingsThemeId && settingsThemeId !== 'default' ? settingsThemeId : null) ||
          storedThemeId ||
          domThemeId ||
          'dark'

        const themeDef = getTheme(rawThemeId)
        const activeTheme = themeDef?.name || rawThemeId

        // Pass safe editor and appearance settings (strictly omitting API keys, tokens, or hashes)
        const safeSettings = {
          theme: activeTheme,
          themeId: themeDef?.id || rawThemeId,
          fontSize: settingsObj?.fontSize ?? 16,
          fontFamily: settingsObj?.fontFamily ?? 'Inter',
          lineHeight: settingsObj?.lineHeight ?? 1.6,
          showLineNumbers: Boolean(settingsObj?.showLineNumbers),
          autoSave: settingsObj?.autoSave !== false,
          vimMode: Boolean(settingsObj?.vimMode),
          cursorStyle: settingsObj?.cursorStyle || 'smooth',
          smoothScrolling: settingsObj?.smoothScrolling !== false,
          inlineTitle: settingsObj?.inlineTitle !== false,
          inlineMetadata: Boolean(settingsObj?.inlineMetadata),
          modernUi: Boolean(settingsObj?.modernUi)
        }

        const systemPrompt = await buildSystemPrompt({
          modeCfg,
          mentionedSnippets,
          requestedFiles,
          requestedBrainDocs,
          vaultContext,
          vaultAccessNote,
          allSnippets,
          allFolders,
          selectedSnippet: vs.selectedSnippet || vs.selectedNote,
          drafts: vs.drafts || {},
          contextSnippets: Array.isArray(contextSnippets) ? contextSnippets : [],
          detectedIntent,
          message: cleanMessage,
          activeTheme,
          userSettings: safeSettings
        })

        const { providerType, activeModel, apiKey, baseUrl } =
          resolveProviderConfig(settingsObj)
        const provider = AIProviderFactory.createProvider(providerType, { apiKey, baseUrl })

        const finalMessages = newHistory
          .filter((m) => m.role !== 'system' && (m.content || m.role === 'user'))
          .slice(-6)
          .map((m) => {
            const cleanText = (m.content || '')
              .replace(/<think>[\s\S]*?<\/think>/gi, '')
              .replace(/<lumina-activity>[\s\S]*?<\/lumina-activity>/gi, '')
              .replace(/<lumina-memory>[\s\S]*?<\/lumina-memory>/gi, '')
              .replace(/<[^>]*[｜|][^>]*>/g, '')
              .replace(/<[^>]*(?:DSML|tool_calls?)[^>]*>/gi, '')
              .trim()
            return {
              role: m.role,
              content: cleanText || (m.role === 'assistant' ? 'Completed requested workspace actions.' : '')
            }
          })

        const hasPreloadedFiles = mentionedSnippets.length > 0 || requestedFiles.length > 0
        const writeIntentKeywords =
          /\b(write|add|append|insert|put|include|create new|type|place|set|clear|empty|erase|wipe|delete all|remove all)\b/i
        const readIntentKeywords =
          /\b(explain|read|summarize|describe|tell me|what is|what does|show me|analyze|review)\b/i
        const isWriteIntent =
          writeIntentKeywords.test(cleanMessage) && !readIntentKeywords.test(cleanMessage)
        const blockReadFile = hasPreloadedFiles && isWriteIntent

        const conversationalOverridePatterns =
          /\b(let'?s talk|just talk|talk first|don'?t write|do not write|don'?t create|do not create|no files?( yet)?|don'?t save|do not save|just discuss|discuss first|in chat( only)?|brainstorm(ing)? (in|only in) chat|keep (it )?in chat|without (writing|creating|saving))\b/i
        const isConversationalOverride = conversationalOverridePatterns.test(cleanMessage)

        const openIntentKeywords =
          /\b(open|open up|open the tab|show tab|switch to tab|show in editor|view in editor)\b/i
        const isOpenIntent = openIntentKeywords.test(cleanMessage)

        let sdkTools = getMemoryTools()
        if (
          (modeCfg.enableTools !== false ||
            detectedIntent === IntentCategory.DIAGNOSTICS ||
            detectedIntent === IntentCategory.AUDIT_WIKILINKS) &&
          !isConversationalOverride
        ) {
          sdkTools = getAITools(blockReadFile, isOpenIntent)
        }

        const handleContentUpdate = (content: string) => {
          set((state) => {
            const msgs = [...state.chatMessages]
            if (msgs.length > 0) {
              msgs[msgs.length - 1] = { ...msgs[msgs.length - 1], content }
            }
            return { chatMessages: msgs }
          })
        }

        const handleThinkingStatusUpdate = (status: string) => {
          set({ activeThinkingStatus: status })
        }

        let streamRes: any = null
        if (providerType === 'deepseek') {
          streamRes = await runDeepSeekStream({
            apiKey: visibleKey,
            activeModel,
            systemPrompt,
            finalMessages,
            modeCfg,
            controller,
            sdkTools,
            onContentUpdate: handleContentUpdate,
            onThinkingStatusUpdate: handleThinkingStatusUpdate
          })
        } else {
          const fullContent = await runFallbackProviderStream({
            provider,
            activeModel,
            finalMessages,
            modeCfg,
            controller,
            onContentUpdate: handleContentUpdate,
            onThinkingStatusUpdate: handleThinkingStatusUpdate
          })

          const cleanedContent = await applyLegacyMarkdownBlocks(fullContent, vs)
          handleContentUpdate(cleanedContent)
        }

        get().saveChatHistory()

        const durationMs = Date.now() - startTime
        const currentMsgs = get().chatMessages || []
        const lastMsg = currentMsgs[currentMsgs.length - 1]
        const outputText = lastMsg?.content || ''
        const promptText = systemPrompt + cleanMessage

        let promptTokens = Math.max(10, Math.ceil(promptText.length / 4))
        let completionTokens = Math.max(1, Math.ceil(outputText.length / 4))

        if (streamRes?.usage?.promptTokens) {
          promptTokens = streamRes.usage.promptTokens
        }
        if (streamRes?.usage?.completionTokens) {
          completionTokens = streamRes.usage.completionTokens
        }

        get().recordAIUsage({
          promptTokens,
          completionTokens,
          timeMs: durationMs,
          provider: providerType,
          model: activeModel || undefined
        })
      } catch (error: any) {
        if (error.name === 'AbortError') {
          console.log('[AIStore] Chat generation aborted by user.')
        } else {
          console.error('[AIStore] Chat Error:', error)
        }

        set((state) => {
          const msgs = [...state.chatMessages]
          if (msgs.length > 0) {
            const lastMsg = msgs[msgs.length - 1]
            if (lastMsg.role === 'assistant' && !lastMsg.content?.trim() && !lastMsg.imageUrl) {
              msgs.pop()
            }
          }
          return {
            chatMessages: msgs,
            isChatLoading: false,
            activeThinkingStatus: '',
            chatError: error.name === 'AbortError' ? null : error.message,
            chatController: null
          }
        })
      } finally {
        if (timeoutId) clearTimeout(timeoutId)
        set((state) => {
          const msgs = [...state.chatMessages]
          if (msgs.length > 0) {
            const lastIdx = msgs.length - 1
            if (msgs[lastIdx].role === 'assistant') {
              if (msgs[lastIdx].isGenerating) {
                msgs[lastIdx] = { ...msgs[lastIdx], isGenerating: false }
              }
              if (!msgs[lastIdx].content?.trim() && !msgs[lastIdx].imageUrl) {
                msgs.pop()
              }
            }
          }
          return {
            chatMessages: msgs,
            isChatLoading: false,
            activeThinkingStatus: '',
            chatController: null
          }
        })
      }
    }
  }
})
