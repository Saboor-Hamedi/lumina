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
import { parseAndExecuteDSML } from './toolCallInterceptor'

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
  onHeartbeat?: () => void
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
  const activitySummaries: string[] = []
  const specialBadges: string[] = []

  const buildCombinedDisplay = (rawText: string) => {
    const blocks: string[] = [...specialBadges]
    if (activitySummaries.length > 0) {
      blocks.push(`<lumina-activity>\n${activitySummaries.join('\n')}\n</lumina-activity>`)
    }
    if (rawText.trim()) {
      blocks.push(rawText.trim())
    }
    return blocks.join('\n\n')
  }

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
      if (result) {
        onToolActivity?.(toolName, args, result)
        if (toolName === 'diagnoseSystem' || toolName === 'luminaDiagnoseSystem') {
          const payload = JSON.stringify({ ...(result?.result || {}), isChecking: false })
          specialBadges.push(`<lumina-health>\n${payload}\n</lumina-health>`)
        } else if (toolName === 'auditWikilinks') {
          const payload = JSON.stringify({ ...(result?.result || result || {}), isScanning: false })
          specialBadges.push(`<lumina-audit>\n${payload}\n</lumina-audit>`)
        } else if (toolName === 'luminaQueryIndex' || toolName === 'queryIndex') {
          const rObj = result?.result || result || {}
          const payload = JSON.stringify({
            totalWorkspaceNotes: rObj.totalWorkspaceNotes ?? 0,
            totalMatched: rObj.totalMatched ?? 0,
            filters: rObj.filters ?? {},
            notes: rObj.notes ?? [],
            foldersRepresented: rObj.foldersRepresented ?? [],
            isQuerying: false
          })
          specialBadges.push(`<lumina-index>\n${payload}\n</lumina-index>`)
        } else if (['saveMemory', 'updateMemory', 'forgetMemory', 'forgeMemory'].includes(toolName)) {
          if (result?.summary) {
            specialBadges.push(`<lumina-memory>\n${result.summary}\n</lumina-memory>`)
          }
        } else if (result?.summary && !activitySummaries.includes(result.summary)) {
          activitySummaries.push(result.summary)
        }
        onContentUpdate(buildCombinedDisplay(fullContent))
      }
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
    onContentUpdate(buildCombinedDisplay(fullContent))
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
    try {
      onHeartbeat?.()
    } catch (_) {}
    if (chunk) {
      fullContent += chunk
      scheduleUpdate()
    }
  }

  if (sdkTools && fullContent) {
    const intercepted = await parseAndExecuteDSML(fullContent, sdkTools, activitySummaries)
    if (intercepted.didExecute) {
      fullContent = intercepted.cleanedText
      for (const out of intercepted.toolOutputs) {
        if (out.type === 'health') specialBadges.push(`<lumina-health>\n${out.content}\n</lumina-health>`)
        else if (out.type === 'audit') specialBadges.push(`<lumina-audit>\n${out.content}\n</lumina-audit>`)
        else if (out.type === 'index') specialBadges.push(`<lumina-index>\n${out.content}\n</lumina-index>`)
        else if (out.type === 'memory') specialBadges.push(`<lumina-memory>\n${out.content}\n</lumina-memory>`)
      }
    }
  }

  flush()

  return buildCombinedDisplay(fullContent)
}
