/**
 * Type definitions for Lumina AI Subsystem.
 * Provides strict typing for messages, sessions, providers, tools, modes, and store state.
 */

export type Role = 'user' | 'assistant' | 'system'

export interface MentionItem {
  id?: string
  name?: string
  title?: string
  type?: string
  code?: string
  content?: string
  folderId?: string
  path?: string
  [key: string]: unknown
}

export interface ChatMessage {
  id: string
  role: Role
  content: string
  timestamp?: number
  isGenerating?: boolean
  imageUrl?: string
  imagePrompt?: string
  rating?: 'up' | 'down' | null
  attachedMentions?: MentionItem[]
  thinkingStatus?: string
  tokens?: {
    prompt?: number
    completion?: number
    total?: number
  }
  [key: string]: unknown
}

export interface ChatSession {
  id: string
  title: string
  messages: ChatMessage[]
  timestamp: number
  pinned?: boolean
  updatedAt?: number
}

export interface AIModeConfig {
  id: string
  name: string
  description: string
  temperature: number
  max_tokens: number
  enableTools: boolean
  systemAddon: string
}

export interface AIUsageStats {
  totalTokens: number
  promptTokens: number
  completionTokens: number
  totalTimeMs: number
  totalCostUSD: number
  totalPrompts: number
}

export interface ProviderRecordUsageParams {
  promptTokens?: number
  completionTokens?: number
  timeMs?: number
  provider?: string
  model?: string
}

export interface ProviderConfig {
  apiKey?: string | null
  baseUrl?: string
  activeModel?: string | null
  providerType?: string
  [key: string]: unknown
}

export interface ResolvedProviderConfig {
  providerType: string
  activeModel: string | null
  apiKey: string | null
  baseUrl: string
}

export interface SearchNoteResult {
  id: string
  score: number
  chunk: Record<string, unknown>
}

export interface AIToolExecutionResult {
  success: boolean
  error?: string
  id?: string
  title?: string
  folderId?: string
  writtenContent?: string
  topics?: string[]
  wikilinks?: string[]
  summary?: string
  instruction_to_ai?: string
  [key: string]: unknown
}

export interface AIStoreState {
  aiError: Error | string | null
  isModelReady: boolean
  modelLoadingProgress: number
  pendingTasks: number
  embeddingsCache: Record<string, number[]>

  // Chat state
  chatError: string | null
  isChatLoading: boolean
  chatController: AbortController | null
  sessions: ChatSession[]
  activeSessionId: string | null
  chatMessages: ChatMessage[]
  activeThinkingStatus: string

  // Usage stats
  aiUsageStats: AIUsageStats
}

export interface AIStoreActions {
  recordAIUsage: (params: ProviderRecordUsageParams) => void
  resetAIUsage: () => void

  generateEmbedding: (text: string) => Promise<number[]>
  generateLocalText: (prompt: string, onToken?: (token: string) => void) => Promise<string>

  searchNotes: (query: string, threshold?: number) => Promise<SearchNoteResult[]>
  indexWorkspace: (workspacePath?: string | null, options?: { force?: boolean; onProgress?: ((p: number) => void) | null }) => Promise<{ success: boolean }>
  indexVault: (vaultPath?: string | null, options?: { force?: boolean; onProgress?: ((p: number) => void) | null }) => Promise<{ success: boolean }>
  getIndexStats: () => Promise<unknown>

  loadSessions: () => Promise<void>
  saveSessions: () => Promise<void>
  createNewSession: () => Promise<void>
  renameSession: (sessionId: string, newTitle: string) => Promise<void>
  togglePinSession: (sessionId: string) => Promise<void>
  duplicateSession: (sessionId: string) => Promise<void>
  clearSessionMessages: (sessionId: string) => Promise<void>
  switchSession: (sessionId: string) => void
  deleteSession: (sessionId: string) => Promise<void>

  saveChatHistory: () => Promise<void>
  updateMessage: (index: number, updates: Partial<ChatMessage>) => Promise<void>
  clearChat: () => Promise<void>
  cancelChat: () => void
  sendChatMessage: (
    message: string,
    contextSnippets?: unknown[],
    mode?: string,
    attachedMentions?: MentionItem[]
  ) => Promise<void>
}

export type AIStore = AIStoreState & AIStoreActions
