/**
 * ============================================================================
 * Lumina AI DeepSeek Streamer
 * ============================================================================
 * 
 * Manages full duplex text streaming and multi-step tool execution via Vercel AI SDK:
 * 
 * 1. AI SDK Dynamic Loading (`ensureAISdk`):
 *    - Dynamically loads `ai` and `@ai-sdk/deepseek` to minimize initial bundle overhead.
 * 
 * 2. Real-Time Timeline State Machine:
 *    - Streams reasoning tokens (`reasoning-delta`) into `<think>` blocks.
 *    - Captures tool arguments incrementally (`tool-input-delta`).
 *    - Updates tool execution status reactively (`tool-call`, `tool-result`).
 *    - Smooth 60fps UI flushes via `requestAnimationFrame`.
 * 
 * 3. Fallback Interception:
 *    - Intercepts leaked DSML/XML tokens from final text output.
 *    - Synthesizes clean markdown text without code block or token leaks.
 */

import type { AIModeConfig } from '../../types/ai.types'
import {
  buildRealtimeDisplay,
  getToolStatusDescription
} from './luminaDisplayBuilder'
import {
  cleanRawToolLeaks,
  parseAndExecuteDSML
} from './toolCallInterceptor'

let aiSdk: any
let createDeepseekProvider: any

/**
 * Lazily loads the Vercel AI SDK and DeepSeek provider packages.
 */
export const ensureAISdk = async (): Promise<{ aiSdk: any; createDeepseekProvider: any }> => {
  if (!aiSdk) {
    const [ai, ds] = await Promise.all([import('ai'), import('@ai-sdk/deepseek')])
    aiSdk = ai
    createDeepseekProvider = ds.createDeepSeek
  }
  return { aiSdk, createDeepseekProvider }
}

export interface RunDeepSeekStreamParams {
  apiKey: string
  activeModel?: string | null
  systemPrompt: string
  finalMessages: any[]
  modeCfg: AIModeConfig
  controller: AbortController
  sdkTools: Record<string, any>
  onContentUpdate: (content: string) => void
  onThinkingStatusUpdate: (status: string) => void
  onToolActivity?: (toolName: string, args: Record<string, any>, result: any) => void
}

/**
 * Runs streaming text generation against DeepSeek with tool calling and live timeline updates.
 */
export const runDeepSeekStream = async ({
  apiKey,
  activeModel,
  systemPrompt,
  finalMessages,
  modeCfg,
  controller,
  sdkTools,
  onContentUpdate,
  onThinkingStatusUpdate,
  onToolActivity
}: RunDeepSeekStreamParams): Promise<{ usage: any }> => {
  const { aiSdk: sdk, createDeepseekProvider: createDs } = await ensureAISdk()

  const result = sdk.streamText({
    model: createDs({ apiKey })(activeModel || 'deepseek-chat'),
    system: systemPrompt,
    messages: finalMessages,
    temperature: modeCfg.temperature,
    maxTokens: modeCfg.max_tokens,
    abortSignal: controller.signal,
    tools: Object.fromEntries(
      Object.entries(sdkTools).filter(([, v]) => v !== undefined)
    ),
    toolChoice: 'auto',
    stopWhen: sdk.stepCountIs ? sdk.stepCountIs(30) : ({ steps }: any) => steps.length >= 30,
    maxSteps: 30,
    experimental_transform: sdk.smoothStream
      ? sdk.smoothStream({
          chunking: 'word',
          delayInMs: 15
        })
      : undefined
  })

  const timeline: any[] = []
  let activeToolStatus = ''
  let streamingToolName = ''
  let streamingArgsRaw = ''
  let recordedTarget = ''
  let isParsingModelThink = false

  const getOrCreateThinkSegment = () => {
    let thinkSeg = timeline.find((s) => s.type === 'think')
    if (!thinkSeg) {
      thinkSeg = { type: 'think', content: '' }
      if (timeline.length > 0 && timeline[0].type === 'text') {
        timeline.splice(1, 0, thinkSeg)
      } else {
        timeline.unshift(thinkSeg)
      }
    }
    return thinkSeg
  }

  const appendTextDelta = (text: string) => {
    if (!text) return
    const lastSeg = timeline[timeline.length - 1]
    if (lastSeg && lastSeg.type === 'text') {
      lastSeg.content += text
    } else {
      timeline.push({ type: 'text', content: text })
    }
  }

  let rafId: number | null = null
  let pendingDisplayUpdate = false

  const flushDisplay = () => {
    if (rafId) {
      cancelAnimationFrame(rafId)
      rafId = null
    }
    pendingDisplayUpdate = false
    const content = buildRealtimeDisplay({ timeline })
    onContentUpdate(content)
  }

  const updateDisplay = (immediate = false) => {
    if (immediate) {
      flushDisplay()
      return
    }
    if (!pendingDisplayUpdate) {
      pendingDisplayUpdate = true
      rafId = requestAnimationFrame(() => {
        flushDisplay()
      })
    }
  }

  onThinkingStatusUpdate('Thinking...')

  for await (const chunk of result.fullStream) {
    if (controller.signal.aborted) break
    if (!chunk || typeof chunk.type !== 'string') continue

    if (chunk.type === 'tool-input-start' || chunk.type === 'tool-call-streaming-start') {
      isParsingModelThink = false
      streamingToolName = chunk.toolName || ''
      streamingArgsRaw = ''
      recordedTarget = ''
      activeToolStatus = getToolStatusDescription(streamingToolName, { title: 'note' })
      const isMemoryTool = ['saveMemory', 'updateMemory', 'forgetMemory', 'forgeMemory'].includes(streamingToolName)
      const isAuditTool = streamingToolName === 'auditWikilinks'
      const isHealthTool = ['diagnoseSystem', 'luminaDiagnoseSystem'].includes(streamingToolName)
      const isIndexTool = ['luminaQueryIndex', 'queryIndex'].includes(streamingToolName)
      if (isMemoryTool) {
        timeline.push({
          type: 'memory',
          toolName: streamingToolName,
          content: activeToolStatus,
          isExecuting: true
        })
      } else if (isAuditTool) {
        timeline.push({
          type: 'audit',
          toolName: streamingToolName,
          content: JSON.stringify({ isScanning: true }),
          isExecuting: true
        })
      } else if (isHealthTool) {
        timeline.push({
          type: 'health',
          toolName: streamingToolName,
          content: JSON.stringify({ isChecking: true }),
          isExecuting: true
        })
      } else if (isIndexTool) {
        timeline.push({
          type: 'index',
          toolName: streamingToolName,
          content: JSON.stringify({ isQuerying: true, filters: {} }),
          isExecuting: true
        })
      } else {
        timeline.push({
          type: 'activity',
          toolName: streamingToolName,
          summary: '',
          activeStatus: activeToolStatus,
          isExecuting: true
        })
      }
      updateDisplay(true)
      const cleanToolStatus = activeToolStatus.replace(/[*_`]/g, '').trim()
      onThinkingStatusUpdate(cleanToolStatus)
    } else if (chunk.type === 'tool-input-delta' || chunk.type === 'tool-call-delta') {
      const delta = chunk.argsTextDelta || chunk.delta || chunk.textDelta || ''
      if (delta) {
        streamingArgsRaw += delta
        const titleMatch = streamingArgsRaw.match(/"title"\s*:\s*"([^"\\]*(?:\\.[^"\\]*)*)"?/i)
        const folderMatch = streamingArgsRaw.match(/"folder"\s*:\s*"([^"\\]*(?:\\.[^"\\]*)*)"?/i)
        const pathMatch = streamingArgsRaw.match(/"path"\s*:\s*"([^"\\]*(?:\\.[^"\\]*)*)"?/i)

        const extractedTitle = titleMatch ? titleMatch[1] : ''
        const extractedFolder = folderMatch ? folderMatch[1] : ''
        const extractedPath = pathMatch ? pathMatch[1] : ''
        const currentTarget = extractedTitle || extractedPath

        if (currentTarget && currentTarget !== recordedTarget) {
          recordedTarget = currentTarget
          activeToolStatus = getToolStatusDescription(streamingToolName, {
            title: extractedTitle || 'note',
            folder: extractedFolder,
            path: extractedPath
          })
          const lastActivitySeg = timeline.slice().reverse().find((s) => s.type === 'activity' && s.isExecuting)
          if (lastActivitySeg) {
            lastActivitySeg.activeStatus = activeToolStatus
          }
          updateDisplay(true)
          const cleanToolStatus = activeToolStatus.replace(/[*_`]/g, '').trim()
          onThinkingStatusUpdate(cleanToolStatus)
        }
      }
    } else if (chunk.type === 'tool-call') {
      isParsingModelThink = false
      const args = chunk.input || chunk.args || {}
      const target = args.title || args.path || args.newTitle || args.targetFolder || recordedTarget
      if (target) recordedTarget = target
      activeToolStatus = getToolStatusDescription(chunk.toolName, args)
      const isMemoryTool = ['saveMemory', 'updateMemory', 'forgetMemory', 'forgeMemory'].includes(chunk.toolName)
      const isAuditTool = chunk.toolName === 'auditWikilinks'
      const isHealthTool = ['diagnoseSystem', 'luminaDiagnoseSystem'].includes(chunk.toolName)
      const isIndexTool = ['luminaQueryIndex', 'queryIndex'].includes(chunk.toolName)

      let targetSeg = timeline.slice().reverse().find(
        (s) =>
          s.isExecuting &&
          (isMemoryTool
            ? s.type === 'memory'
            : isAuditTool
              ? s.type === 'audit'
              : isHealthTool
                ? s.type === 'health'
                : isIndexTool
                  ? s.type === 'index'
                  : s.type === 'activity')
      )
      if (!targetSeg) {
        targetSeg = isMemoryTool
          ? { type: 'memory', toolName: chunk.toolName, content: activeToolStatus, isExecuting: true }
          : isAuditTool
            ? { type: 'audit', toolName: chunk.toolName, content: JSON.stringify({ isScanning: true }), isExecuting: true }
            : isHealthTool
              ? { type: 'health', toolName: chunk.toolName, content: JSON.stringify({ isChecking: true }), isExecuting: true }
              : isIndexTool
                ? { type: 'index', toolName: chunk.toolName, content: JSON.stringify({ isQuerying: true, filters: args }), isExecuting: true }
                : { type: 'activity', toolName: chunk.toolName, summary: '', activeStatus: activeToolStatus, isExecuting: true }
        timeline.push(targetSeg)
      } else if (targetSeg.type === 'activity') {
        targetSeg.activeStatus = activeToolStatus
      }
      updateDisplay(true)
      const cleanToolStatus = activeToolStatus.replace(/[*_`]/g, '').trim()
      onThinkingStatusUpdate(cleanToolStatus)
    } else if (chunk.type === 'tool-result') {
      const res = chunk.output || chunk.result
      const isMemoryTool = ['saveMemory', 'updateMemory', 'forgetMemory', 'forgeMemory'].includes(chunk.toolName)
      const isAuditTool = chunk.toolName === 'auditWikilinks'
      const isHealthTool = ['diagnoseSystem', 'luminaDiagnoseSystem'].includes(chunk.toolName)
      const isIndexTool = ['luminaQueryIndex', 'queryIndex'].includes(chunk.toolName)

      let targetSeg = timeline.slice().reverse().find(
        (s) =>
          s.isExecuting &&
          (isMemoryTool
            ? s.type === 'memory'
            : isAuditTool
              ? s.type === 'audit'
              : isHealthTool
                ? s.type === 'health'
                : isIndexTool
                  ? s.type === 'index'
                  : s.type === 'activity')
      )
      if (!targetSeg) {
        targetSeg = isMemoryTool
          ? { type: 'memory', toolName: chunk.toolName, content: '', isExecuting: false }
          : isAuditTool
            ? { type: 'audit', toolName: chunk.toolName, content: '', isExecuting: false }
            : isHealthTool
              ? { type: 'health', toolName: chunk.toolName, content: '', isExecuting: false }
              : isIndexTool
                ? { type: 'index', toolName: chunk.toolName, content: '', isExecuting: false }
                : { type: 'activity', toolName: chunk.toolName, summary: '', activeStatus: '', isExecuting: false }
        timeline.push(targetSeg)
      }

      if (isMemoryTool) {
        if (res && res.success === false) {
          targetSeg.content = `⚠️ ${res.error || 'Failed to save memory'}`
        } else if (res?.summary) {
          targetSeg.content = res.summary
        }
        targetSeg.isExecuting = false
      } else if (isAuditTool) {
        if (res && res.success === false) {
          targetSeg.content = JSON.stringify({ error: res.error, isScanning: false })
        } else {
          const auditObj = res?.result || res || {}
          targetSeg.content = JSON.stringify({
            ...(auditObj || {}),
            isScanning: false
          })
        }
        targetSeg.isExecuting = false
      } else if (isHealthTool) {
        if (res && res.success === false) {
          targetSeg.content = JSON.stringify({ error: res.error, isChecking: false })
        } else {
          targetSeg.content = JSON.stringify({
            ...(res?.result || {}),
            isChecking: false
          })
        }
        targetSeg.isExecuting = false
      } else if (isIndexTool) {
        if (res && res.success === false) {
          targetSeg.content = JSON.stringify({ error: res.error, isQuerying: false })
        } else {
          const resultObj = res?.result || res || {}
          targetSeg.content = JSON.stringify({
            totalWorkspaceNotes: resultObj.totalWorkspaceNotes ?? res?.totalWorkspaceNotes ?? 0,
            totalMatched: resultObj.totalMatched ?? res?.totalMatched ?? 0,
            filters: resultObj.filters ?? res?.filters ?? {},
            notes: resultObj.notes ?? res?.notes ?? [],
            foldersRepresented: resultObj.foldersRepresented ?? res?.foldersRepresented ?? [],
            isQuerying: false
          })
        }
        targetSeg.isExecuting = false
      } else {
        if (res && res.success === false) {
          console.warn(`[StreamRunner] Tool ${chunk.toolName} failed:`, res.error)
          targetSeg.summary = `⚠️ ${chunk.toolName} failed: ${res.error}`
        } else if (res?.summary) {
          targetSeg.summary = res.summary
        }
        targetSeg.activeStatus = ''
        targetSeg.isExecuting = false
      }

      activeToolStatus = ''
      streamingToolName = ''
      streamingArgsRaw = ''

      updateDisplay(true)
      onThinkingStatusUpdate('Reflecting on workspace changes...')
    } else if (chunk.type === 'start-step') {
      const hasExecutedTools = timeline.some((s) => s.type === 'activity')
      if (hasExecutedTools) {
        onThinkingStatusUpdate('Synthesizing response...')
      }
    } else if (chunk.type === 'reasoning' || chunk.type === 'reasoning-delta') {
      const rDelta = chunk.textDelta || chunk.text || chunk.delta || ''
      if (rDelta) {
        const thinkSeg = getOrCreateThinkSegment()
        thinkSeg.content += rDelta
        updateDisplay()
        onThinkingStatusUpdate('Reasoning...')
      }
    } else if (chunk.type === 'text-delta') {
      let delta = chunk.textDelta || chunk.text || chunk.delta || ''
      if (isParsingModelThink) {
        if (delta.includes('</think>')) {
          const [thinkPart, afterPart] = delta.split('</think>')
          const thinkSeg = getOrCreateThinkSegment()
          thinkSeg.content += thinkPart
          isParsingModelThink = false
          delta = afterPart || ''
        } else {
          const thinkSeg = getOrCreateThinkSegment()
          thinkSeg.content += delta
          delta = ''
        }
      } else if (delta.includes('<think>')) {
        const [beforePart, thinkPart] = delta.split('<think>')
        if (beforePart) {
          appendTextDelta(beforePart)
        }
        const thinkSeg = getOrCreateThinkSegment()
        if (thinkPart.includes('</think>')) {
          const [innerThink, rest] = thinkPart.split('</think>')
          thinkSeg.content += (thinkSeg.content ? '\n\n' : '') + innerThink
          delta = rest || ''
        } else {
          thinkSeg.content += (thinkSeg.content ? '\n\n' : '') + thinkPart
          isParsingModelThink = true
          delta = ''
        }
      }

      if (delta) {
        delta = delta
          .replace(/<[^>]*[｜|][^>]*>/g, '')
          .replace(/<[^>]*(?:DSML|tool_calls?)[^>]*>/gi, '')
          .replace(/<[｜|][^>]*$/g, '')
          .replace(/<[^>]*(?:DSML|tool_calls?)[^>]*$/gi, '')
      }

      if (delta) {
        appendTextDelta(delta)
        const hasExecutedTools = timeline.some((s) => s.type === 'activity')
        if (hasExecutedTools) {
          onThinkingStatusUpdate('Synthesizing response...')
        } else {
          onThinkingStatusUpdate('')
        }
      }
      updateDisplay()
    } else if (chunk.type === 'tool-error') {
      const errMsg = chunk.error?.message || chunk.error || 'Unknown tool error'
      console.warn(`[StreamRunner] Tool ${chunk.toolName} errored:`, errMsg)
      const lastTool = timeline.slice().reverse().find((s) => s.type === 'activity' && s.isExecuting)
      if (lastTool) {
        lastTool.summary = `⚠️ Tool error: ${errMsg}`
        lastTool.activeStatus = ''
        lastTool.isExecuting = false
      } else {
        timeline.push({ type: 'activity', summary: `⚠️ Tool error: ${errMsg}`, activeStatus: '', isExecuting: false })
      }
      updateDisplay(true)
    } else if (chunk.type === 'error') {
      console.error('Stream error:', chunk.error)
      updateDisplay(true)
    }
  }

  flushDisplay()
  activeToolStatus = ''
  onThinkingStatusUpdate('')

  try {
    const steps = await result.steps
    const toolResults = steps?.flatMap((s: any) => s.toolResults || []) || []
    if (toolResults.length > 0) {
      toolResults.forEach((t: any) => {
        const res = t.output || t.result
        const toolName = t.toolName || t.name || t.toolCall?.toolName || ''
        const toolArgs = t.input || t.args || t.toolCall?.args || {}
        if (toolName) onToolActivity?.(toolName, toolArgs, res)
        const sum = res?.summary
        if (sum && !timeline.some((s) => s.type === 'activity' && s.summary === sum)) {
          timeline.push({ type: 'activity', summary: sum, activeStatus: '', isExecuting: false })
        }
      })
    }

    const rawFinalText = await result.text
    if (rawFinalText && rawFinalText.trim()) {
      const executedActions: string[] = []
      const { cleanedText, toolOutputs } = await parseAndExecuteDSML(
        rawFinalText,
        sdkTools,
        executedActions
      )
      for (const act of executedActions) {
        if (!timeline.some((s) => s.type === 'activity' && s.summary === act)) {
          timeline.push({ type: 'activity', summary: act, activeStatus: '', isExecuting: false })
        }
      }

      if (toolOutputs && toolOutputs.length > 0) {
        for (const out of toolOutputs) {
          if (
            out.type === 'index' &&
            !timeline.some((s) => s.type === 'index' && s.content === out.content)
          ) {
            timeline.push({ type: 'index', content: out.content, isExecuting: false })
          } else if (
            out.type === 'health' &&
            !timeline.some((s) => s.type === 'health' && s.content === out.content)
          ) {
            timeline.push({ type: 'health', content: out.content, isExecuting: false })
          } else if (
            out.type === 'audit' &&
            !timeline.some((s) => s.type === 'audit' && s.content === out.content)
          ) {
            timeline.push({ type: 'audit', content: out.content, isExecuting: false })
          } else if (
            out.type === 'memory' &&
            !timeline.some((s) => s.type === 'memory' && s.content === out.content)
          ) {
            timeline.push({ type: 'memory', content: out.content, isExecuting: false })
          }
        }
      }

      const cleanFinal = cleanRawToolLeaks(
        cleanedText
          .replace(/<think>[\s\S]*?<\/think>/gi, '')
          .replace(/<\/?think>/gi, '')
      )

      if (cleanFinal) {
        const existingText = timeline
          .filter((s) => s.type === 'text')
          .map((s) => s.content)
          .join(' ')
          .trim()
        if (!existingText) {
          timeline.push({ type: 'text', content: cleanFinal })
        } else if (cleanFinal.length > existingText.length && !existingText.includes(cleanFinal)) {
          let extra = cleanFinal
          if (extra.startsWith(existingText)) {
            extra = extra.slice(existingText.length).trim()
          }
          if (extra) {
            appendTextDelta(extra)
          }
        }
      }
    }
  } catch (_) {}

  const stripStray = (txt?: string): string => {
    if (!txt) return ''
    const withoutSpecial = txt
      .replace(/<think>[\s\S]*?<\/think>/gi, '')
      .replace(/<\/?think>/gi, '')
      .replace(/<lumina-activity>[\s\S]*?<\/lumina-activity>/gi, '')
      .replace(/<lumina-memory>[\s\S]*?<\/lumina-memory>/gi, '')
      .replace(/<lumina-audit>[\s\S]*?<\/lumina-audit>/gi, '')
      .replace(/<lumina-health>[\s\S]*?<\/lumina-health>/gi, '')
      .replace(/<lumina-index>[\s\S]*?<\/lumina-index>/gi, '')
    return cleanRawToolLeaks(withoutSpecial)
  }

  for (const seg of timeline) {
    if (seg.type === 'text') {
      seg.content = stripStray(seg.content)
    }
  }

  let apiUsage: any = null
  try {
    apiUsage = await result.usage
  } catch (_) {}

  return { usage: apiUsage }
}
