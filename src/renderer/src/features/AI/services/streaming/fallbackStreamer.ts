/**
 * ============================================================================
 * Lumina AI Fallback Provider Streamer
 * ============================================================================
 * 
 * Streams chat completions from alternative LLM providers (e.g. Ollama, Groq)
 * that implement Lumina's provider protocol (`chatStream` async iterator).
 * 
 * Includes requestAnimationFrame throttling for smooth 60fps UI updates
 * and status narration.
 */

import type { AIModeConfig } from '../../types/ai.types'
import { getToolResultThought, getToolStatusDescription } from './luminaDisplayBuilder'

export interface RunFallbackProviderStreamParams {
  provider: any
  activeModel?: string | null
  finalMessages: any[]
  systemPrompt?: string
  modeCfg: AIModeConfig
  controller: AbortController
  sdkTools?: Record<string, any>
  onContentUpdate: (content: string) => void
  onThinkingStatusUpdate: (status: string) => void
  onToolActivity?: (toolName: string, args: Record<string, any>, result: any) => void
}

export const runFallbackProviderStream = async ({
  provider,
  activeModel,
  finalMessages,
  systemPrompt,
  modeCfg,
  controller,
  sdkTools,
  onContentUpdate,
  onThinkingStatusUpdate,
  onToolActivity
}: RunFallbackProviderStreamParams): Promise<string> => {
  let fullContent = ''
  const providerMessages = systemPrompt
    ? [{ role: 'system', content: systemPrompt }, ...finalMessages]
    : finalMessages
  const stream = provider.chatStream(providerMessages, {
    model: activeModel,
    temperature: modeCfg.temperature,
    max_tokens: modeCfg.max_tokens,
    signal: controller.signal,
    tools: sdkTools,
    onToolActivity: (toolName: string, args: Record<string, any>, result: any) => {
      if (result) onToolActivity?.(toolName, args, result)
      const target = args?.title || args?.path || args?.oldTitle || ''
      onThinkingStatusUpdate(
        result
          ? getToolResultThought(toolName, result, target)
          : getToolStatusDescription(toolName, args)
      )
    }
  })

  let rafId: number | null = null
  let pendingUpdate = false

  const flush = () => {
    if (rafId) {
      cancelAnimationFrame(rafId)
      rafId = null
    }
    pendingUpdate = false
    onContentUpdate(fullContent)
    onThinkingStatusUpdate(fullContent.trim().length > 30 ? '' : 'Writing...')
  }

  const scheduleUpdate = () => {
    if (!pendingUpdate) {
      pendingUpdate = true
      rafId = requestAnimationFrame(flush)
    }
  }

  for await (const chunk of stream) {
    if (controller.signal.aborted) break
    if (chunk) {
      fullContent += chunk
      scheduleUpdate()
    }
  }

  flush()

  return fullContent
}
