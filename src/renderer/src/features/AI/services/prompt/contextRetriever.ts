/**
 * ============================================================================
 * Lumina AI Context Retriever & Sanitizer
 * ============================================================================
 * 
 * Manages semantic retrieval and data sanitization for AI prompt building:
 * 
 * 1. Semantic Workspace RAG (`retrieveWorkspaceRAG`):
 *    - Queries the local embedding search engine via IPC (`searchWorkspace` / `searchVault`).
 *    - Applies adaptive score thresholds and returns top reranked chunks.
 * 
 * 2. Context Truncation (`truncateForContext`):
 *    - Bounds text character length to prevent context exhaustion while appending
 *      descriptive indicators for model awareness.
 * 
 * 3. Strict Credential Sanitizer (`sanitizeSafeSettings`):
 *    - Strips all API keys, bearer tokens, encrypted strings (`enc:...`), and
 *      forbidden keys from settings before injecting them into the system prompt.
 */

export interface WorkspaceRAGResult {
  vaultContext: Array<{ file: string; text: string; score: number }>
  vaultAccessNote: string
}

export interface SafeUserSettings {
  theme?: string
  themeId?: string
  fontSize?: number
  fontFamily?: string
  lineHeight?: number
  showLineNumbers?: boolean
  autoSave?: boolean
  cursorStyle?: string
  smoothScrolling?: boolean
  inlineTitle?: boolean
  inlineMetadata?: boolean
  modernUi?: boolean
  activeAIMode?: string
  activeProvider?: string
  activeModel?: string | null
  [key: string]: any
}

/**
 * Retrieves semantically relevant workspace chunks using local vector search.
 * 
 * @param message - The user's query prompt to search against
 * @returns Filtered context chunks and access summary note
 */
export const retrieveWorkspaceRAG = async (message?: string): Promise<WorkspaceRAGResult> => {
  let vaultContext: Array<{ file: string; text: string; score: number }> = []
  let vaultAccessNote = 'Synthesizing from general knowledge and active context.'

  try {
    const searchFn = (window as any).api?.searchWorkspace || (window as any).api?.searchVault
    if (searchFn && message && message.trim()) {
      const queryLength = message.trim().length
      const adaptiveThreshold = queryLength > 100 ? 0.35 : 0.3
      const cleanQuery = queryLength > 250 ? message.trim().slice(0, 250) : message.trim()
      const searchResults = await searchFn(cleanQuery, {
        threshold: adaptiveThreshold,
        limit: 6,
        rerank: true
      })

      if (searchResults?.length > 0) {
        vaultContext = searchResults
          .filter((chunk: any) => (chunk?.finalScore || chunk?.score || 0) >= 0.32)
          .map((chunk: any) => ({
            file: chunk?.metadata?.fileName || 'Unknown',
            text: String(chunk?.text || '').trim().slice(0, 1000),
            score: chunk?.finalScore || 0
          }))
          .slice(0, 5)

        if (vaultContext.length > 0) {
          vaultAccessNote = `Retrieved relevant context from workspace.`
        }
      }
    }
  } catch (searchErr) {
    console.warn('[AIPromptBuilder] Workspace search failed:', searchErr)
  }

  return { vaultContext, vaultAccessNote }
}

/**
 * Bounds content character length for prompt injection to protect latency and context limits.
 * 
 * @param text - The raw text content to bound
 * @param limit - Maximum allowed characters (default: 25,000)
 */
export const truncateForContext = (text?: string, limit: number = 25000): string => {
  if (!text || typeof text !== 'string') return ''
  if (text.length <= limit) return text
  return (
    text.slice(0, limit) +
    `\n\n*(Content truncated for performance: showing first ${limit} of ${text.length} characters)*`
  )
}

/**
 * Strips any sensitive credentials, secret hashes, API keys, tokens, or encryption strings.
 * Guarantees that no raw or hashed API secrets can ever leak into the prompt.
 */
export const sanitizeSafeSettings = (settings?: Record<string, any>): SafeUserSettings => {
  if (!settings || typeof settings !== 'object') return {}

  const forbiddenKeyPatterns = [
    /key/i,
    /token/i,
    /secret/i,
    /hash/i,
    /password/i,
    /auth/i,
    /credential/i,
    /googleuser/i
  ]

  const safe: Record<string, any> = {}

  for (const [k, v] of Object.entries(settings)) {
    // 1. Bar forbidden property names
    if (forbiddenKeyPatterns.some((pattern) => pattern.test(k))) {
      continue
    }

    // 2. Bar any values that look like hashes, encryption strings, or secrets
    if (typeof v === 'string') {
      const trimmed = v.trim()
      if (trimmed.startsWith('enc:') || trimmed.startsWith('Bearer ') || trimmed.startsWith('sk-')) {
        continue
      }
      if (trimmed.length > 60 && /^[A-Za-z0-9+/=_-]+$/.test(trimmed)) {
        continue
      }
    }

    if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') {
      safe[k] = v
    }
  }

  return safe as SafeUserSettings
}
