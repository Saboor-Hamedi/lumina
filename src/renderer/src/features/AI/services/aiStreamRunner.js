/**
 * AI Stream Runner Service
 * Handles streaming AI execution via AI SDK, tool call status tracking, and fallback block parsing.
 */

let aiSdk
let createDeepseekProvider

export const ensureAISdk = async () => {
  if (!aiSdk) {
    const [ai, ds] = await Promise.all([import('ai'), import('@ai-sdk/deepseek')])
    aiSdk = ai
    createDeepseekProvider = ds.createDeepSeek
  }
  return { aiSdk, createDeepseekProvider }
}

export const getToolStatusDescription = (toolName, args = {}) => {
  switch (toolName) {
    case 'createFolder':
      return `📁 *Creating folder '${args.path || '...'}'...*`
    case 'moveFolder':
      return `📁 *Moving folder '${args.sourceFolder || '...'}' to '${args.targetFolder || 'root'}'...*`
    case 'createFile':
      return `📝 *Drafting '${args.title || 'note'}'${args.folder ? ' in ' + args.folder : ''}...*`
    case 'moveFile':
      return `📦 *Moving '${args.title || 'note'}' to '${args.folder || 'root'}'...*`
    case 'deleteFolder':
      return `🗑️ *Deleting folder '${args.path || '...'}'...*`
    case 'deleteFile':
      return `🗑️ *Deleting note '${args.title || '...'}'...*`
    case 'renameFolder':
      return `✏️ *Renaming folder '${args.oldPath}' to '${args.newPath}'...*`
    case 'renameFile':
      return `✏️ *Renaming note '${args.oldTitle}' to '${args.newTitle}'...*`
    case 'appendToFile':
      return `✍️ *Writing content to '${args.title || 'note'}'...*`
    case 'updateFile':
      return `✏️ *Updating '${args.title || 'note'}'...*`
    case 'clearFile':
      return `🧹 *Clearing '${args.title || 'note'}'...*`
    case 'readBrainFile':
      return `📖 *Checking documentation...*`
    case 'readFile':
    case 'checkFile':
      return `📄 *Reading '${args.title || 'note'}'...*`
    case 'openFile':
      return `📖 *Opening '${args.title || 'note'}'...*`
    case 'saveMemory':
      return `🧠 *Saving to memory...*`
    case 'updateMemory':
      return `🧠 *Updating memory...*`
    case 'forgetMemory':
    case 'forgeMemory':
      return `🧠 *Removing from memory...*`
    default:
      return `⚙️ *Working on ${toolName}...*`
  }
}

export const getToolInputStartStatus = (toolName) => {
  switch (toolName) {
    case 'createFolder':
      return 'Planning folder creation...'
    case 'createFile':
      return 'Drafting new note in workspace...'
    case 'updateFile':
      return 'Targeting note updates...'
    case 'renameFile':
    case 'renameFolder':
      return 'Preparing rename...'
    case 'deleteFile':
    case 'deleteFolder':
      return 'Preparing deletion...'
    case 'readFile':
    case 'checkFile':
      return 'Analyzing workspace file...'
    case 'readBrainFile':
      return 'Consulting documentation...'
    case 'saveMemory':
      return 'Saving to memory...'
    case 'updateMemory':
      return 'Updating memory...'
    case 'forgetMemory':
    case 'forgeMemory':
      return 'Removing from memory...'
    default:
      return toolName ? `Preparing ${toolName}...` : 'Thinking...'
  }
}

export const buildRealtimeDisplay = ({
  timeline = null,
  initialReasoning = '',
  postToolReasoning = '',
  reasoningText = '',
  executedActions = [],
  memoryActions = [],
  activeToolStatus = '',
  beforeToolText = '',
  afterToolText = ''
}) => {
  const stripDSML = (text) =>
    (text || '')
      .replace(/<[^>]*[｜|][^>]*>/g, '')
      .replace(/<[^>]*(?:DSML|tool_calls?)[^>]*>/gi, '')
      .replace(/<[｜|][^>]*$/g, '')
      .replace(/<[^>]*(?:DSML|tool_calls?)[^>]*$/gi, '')
      .trim()

  const normalizeCodeBlocks = (text) => {
    if (!text) return text
    return text.replace(/```(TEXT|MARKDOWN|PLAINTEXT|TREE|PLAIN|MD)\b/gi, '```')
  }

  if (Array.isArray(timeline) && timeline.length > 0) {
    const blocks = []
    for (const seg of timeline) {
      if (seg.type === 'memory') {
        const memText = (seg.content || '').trim()
        if (memText) {
          blocks.push(`<lumina-memory>\n${memText}\n</lumina-memory>`)
        }
      } else if (seg.type === 'think') {
        const cleanThink = stripDSML(seg.content).trim()
        if (cleanThink) {
          blocks.push(`<think>\n${cleanThink}\n</think>`)
        }
      } else if (seg.type === 'activity') {
        const lines = []
        if (seg.summary?.trim()) lines.push(seg.summary.trim())
        if (seg.activeStatus?.trim()) lines.push(seg.activeStatus.trim())
        if (lines.length > 0) {
          blocks.push(`<lumina-activity>\n${lines.join('\n')}\n</lumina-activity>`)
        }
      } else if (seg.type === 'text') {
        const clean = stripDSML(seg.content).trim()
        if (clean) {
          blocks.push(normalizeCodeBlocks(clean))
        }
      }
    }
    return blocks.join('\n\n')
  }

  const blocks = []

  if (memoryActions.length > 0) {
    blocks.push(`<lumina-memory>\n${memoryActions.join('\n')}\n</lumina-memory>`)
  }

  if (memoryActions.length === 0) {
    const topReasoning = initialReasoning || reasoningText
    const cleanInitial = stripDSML(topReasoning)
    const cleanPost = stripDSML(postToolReasoning)

    const allReasoning = [cleanInitial, cleanPost].filter(Boolean).join('\n\n')
    if (allReasoning) {
      blocks.push(`<think>\n${allReasoning}\n</think>`)
    }
  }

  if (beforeToolText.trim()) {
    blocks.push(normalizeCodeBlocks(beforeToolText.trim()))
  }

  if (executedActions.length > 0 || (activeToolStatus && !activeToolStatus.includes('memory'))) {
    const actionLines = [...executedActions]
    if (activeToolStatus && !activeToolStatus.includes('memory')) {
      actionLines.push(activeToolStatus)
    }
    if (actionLines.length > 0) {
      blocks.push(`<lumina-activity>\n${actionLines.join('\n')}\n</lumina-activity>`)
    }
  }

  if (afterToolText.trim()) {
    blocks.push(normalizeCodeBlocks(afterToolText.trim()))
  }

  return blocks.join('\n\n')
}

export const generateInitialThought = (prompt = '') => {
  const p = (prompt || '').trim()
  const lower = p.toLowerCase()
  if (lower.includes('remember') || lower.includes('memory') || lower.includes('forget')) {
    return `Accessing persistent memory to update user context and preferences...`
  }
  if (lower.includes('journal')) {
    return `Planning a thoughtful journal with daily focus, morning intentions, and reflection prompts. Preparing workspace note...`
  }
  if (lower.includes('research') || lower.includes('paper') || lower.includes('rag')) {
    return `Outlining research structure: abstract, background, architecture, and findings. Preparing workspace note...`
  }
  if (lower.includes('plan') || lower.includes('itinerary')) {
    return `Organizing structured plan with milestones, timeline, and actionable items. Preparing workspace note...`
  }
  if (lower.includes('expense') || lower.includes('budget') || lower.includes('finance')) {
    return `Organizing budget categories, calculations, and tables. Preparing workspace note...`
  }
  if (lower.includes('folder') || lower.includes('structure')) {
    return `Evaluating workspace hierarchy and organizing folder layout...`
  }
  if (lower.includes('clean') || lower.includes('duplicate') || lower.includes('remove')) {
    return `Analyzing target notes to identify redundant sections and clean up content...`
  }
  if (lower.includes('rename')) {
    return `Inspecting workspace items for rename operations...`
  }
  if (lower.includes('delete')) {
    return `Targeting workspace items for deletion...`
  }
  const cleanSnippet = p.replace(/[\r\n]+/g, ' ').slice(0, 80)
  return `Analyzing request: "${cleanSnippet}"... Determining necessary workspace actions.`
}

export const getToolStartThought = (toolName) => {
  switch (toolName) {
    case 'createFile':
      return `Creating note in workspace...`
    case 'createFolder':
      return `Setting up folder structure in workspace...`
    case 'updateFile':
      return `Targeting note for updates in workspace...`
    case 'deleteFile':
      return `Removing note from workspace...`
    case 'deleteFolder':
      return `Removing folder from workspace...`
    case 'moveFile':
    case 'moveFolder':
      return `Moving workspace items to target destination...`
    case 'readFile':
    case 'checkFile':
      return `Reading note content to fulfill request...`
    case 'saveMemory':
      return `Persisting context to memory.json...`
    case 'updateMemory':
      return `Refining stored context in memory.json...`
    case 'forgetMemory':
    case 'forgeMemory':
      return `Removing specified items from memory.json...`
    default:
      return `Executing ${toolName}...`
  }
}

export const getToolResultThought = (toolName, res, target = '') => {
  if (res && res.success === false) {
    return `Encountered an issue executing ${toolName}: ${res.error || 'Failed'}.`
  }
  const name = target || 'target'
  switch (toolName) {
    case 'createFile':
      return `Successfully created '${name}'. Note saved.\nReviewing structure and preparing walkthrough...`
    case 'createFolder':
      return `Successfully created folder '${name}'. Workspace updated.`
    case 'updateFile':
      return `Successfully updated '${name}'. Changes saved.`
    case 'deleteFile':
    case 'deleteFolder':
      return `Successfully removed '${name}'.`
    case 'moveFile':
    case 'moveFolder':
      return `Successfully moved '${name}' to destination.`
    case 'readFile':
    case 'checkFile':
      return `Retrieved content from '${name}'. Synthesizing answer...`
    case 'saveMemory':
      return `Committed to memory.json.`
    case 'updateMemory':
      return `Updated memory.json.`
    case 'forgetMemory':
    case 'forgeMemory':
      return `Removed from memory.json.`
    default:
      return `Completed ${toolName}. Preparing walkthrough...`
  }
}

/**
 * Fallback parser for leaked DeepSeek Markup Language (DSML) tool invocations.
 * Intercepts tool calls if the model streamed them into text instead of API tool_calls.
 */
export const parseAndExecuteDSML = async (text, sdkTools, executedActions) => {
  if (!text || (!text.includes('DSML') && !text.includes('tool_calls') && !text.includes('｜') && !text.includes('|'))) {
    return {
      cleanedText: text
        ? text
            .replace(/<[^>]*[｜|][^>]*>/g, '')
            .replace(/<[^>]*(?:DSML|tool_calls?)[^>]*>/gi, '')
            .trim()
        : '',
      didExecute: false
    }
  }

  let didExecute = false

  const invokeRegex =
    /<[｜|]{1,2}(?:DSML[｜|]{1,2})?invoke:?([a-zA-Z0-9_-]*)[\s\S]*?>([\s\S]*?)(?:<\/[｜|]{1,2}(?:DSML[｜|]{1,2})?invoke>|$)/gi

  const matches = [...text.matchAll(invokeRegex)]
  for (const match of matches) {
    let toolName = (match[1] || '').trim()
    const body = match[2] || ''

    if (!toolName) {
      const nameMatch = match[0].match(/name=["']([a-zA-Z0-9_-]+)["']/i)
      if (nameMatch) toolName = nameMatch[1].trim()
    }

    if (toolName && sdkTools && sdkTools[toolName]?.execute) {
      const params = {}
      const paramRegex =
        /<[｜|]{1,2}(?:DSML[｜|]{1,2})?parameter\s+name=["']([a-zA-Z0-9_-]+)["']>([\s\S]*?)(?:<\/[｜|]{1,2}(?:DSML[｜|]{1,2})?parameter>|$)/gi
      const paramMatches = [...body.matchAll(paramRegex)]
      for (const pMatch of paramMatches) {
        const paramName = pMatch[1]
        const paramVal = pMatch[2].trim()
        params[paramName] = paramVal
      }

      try {
        console.log(`[StreamRunner] Intercepted leaked DSML tool: ${toolName}`, params)
        const res = await sdkTools[toolName].execute(params)
        if (res?.summary && !executedActions.includes(res.summary)) {
          executedActions.push(res.summary)
        }
        didExecute = true
      } catch (err) {
        console.warn(`[StreamRunner] Error executing DSML tool ${toolName}:`, err)
      }
    }
  }

  const cleanedText = text
    .replace(/<[^>]*[｜|][^>]*>/g, '')
    .replace(/<[^>]*(?:DSML|tool_calls?)[^>]*>/gi, '')
    .trim()

  return { cleanedText, didExecute }
}

export const runDeepSeekStream = async ({
  apiKey,
  activeModel,
  systemPrompt,
  finalMessages,
  modeCfg,
  controller,
  sdkTools,
  onContentUpdate,
  onThinkingStatusUpdate
}) => {
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
    stopWhen: sdk.stepCountIs ? sdk.stepCountIs(30) : ({ steps }) => steps.length >= 30,
    maxSteps: 30,
    experimental_transform: sdk.smoothStream
      ? sdk.smoothStream({
          chunking: 'word',
          delayInMs: 15
        })
      : undefined
  })

  const timeline = []
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

  const appendTextDelta = (text) => {
    if (!text) return
    const lastSeg = timeline[timeline.length - 1]
    if (lastSeg && lastSeg.type === 'text') {
      lastSeg.content += text
    } else {
      timeline.push({ type: 'text', content: text })
    }
  }

  let rafId = null
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
      if (isMemoryTool) {
        timeline.push({
          type: 'memory',
          toolName: streamingToolName,
          content: activeToolStatus,
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

      let targetSeg = timeline.slice().reverse().find(
        (s) => s.isExecuting && (isMemoryTool ? s.type === 'memory' : s.type === 'activity')
      )
      if (!targetSeg) {
        targetSeg = isMemoryTool
          ? { type: 'memory', toolName: chunk.toolName, content: activeToolStatus, isExecuting: true }
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

      let targetSeg = timeline.slice().reverse().find(
        (s) => s.isExecuting && (isMemoryTool ? s.type === 'memory' : s.type === 'activity')
      )
      if (!targetSeg) {
        targetSeg = isMemoryTool
          ? { type: 'memory', toolName: chunk.toolName, content: '', isExecuting: false }
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
    const toolResults = steps?.flatMap((s) => s.toolResults || []) || []
    if (toolResults.length > 0) {
      toolResults.forEach((t) => {
        const res = t.output || t.result
        const sum = res?.summary
        if (sum && !timeline.some((s) => s.type === 'activity' && s.summary === sum)) {
          timeline.push({ type: 'activity', summary: sum, activeStatus: '', isExecuting: false })
        }
      })
    }

    const rawFinalText = await result.text
    if (rawFinalText && rawFinalText.trim()) {
      const executedActions = []
      const { cleanedText } = await parseAndExecuteDSML(
        rawFinalText,
        sdkTools,
        executedActions
      )
      for (const act of executedActions) {
        if (!timeline.some((s) => s.type === 'activity' && s.summary === act)) {
          timeline.push({ type: 'activity', summary: act, activeStatus: '', isExecuting: false })
        }
      }

      const cleanFinal = cleanedText
        .replace(/<think>[\s\S]*?<\/think>/gi, '')
        .replace(/<\/?think>/gi, '')
        .replace(/<[^>]*[｜|][^>]*>/g, '')
        .replace(/<[^>]*(?:DSML|tool_calls?)[^>]*>/gi, '')
        .trim()

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

  const stripStray = (txt) =>
    (txt || '')
      .replace(/<think>[\s\S]*?<\/think>/gi, '')
      .replace(/<\/?think>/gi, '')
      .replace(/<lumina-activity>[\s\S]*?<\/lumina-activity>/gi, '')
      .replace(/<lumina-memory>[\s\S]*?<\/lumina-memory>/gi, '')
      .replace(/<[^>]*[｜|][^>]*>/g, '')
      .replace(/<[^>]*(?:DSML|tool_calls?)[^>]*>/gi, '')
      .trim()

  for (const seg of timeline) {
    if (seg.type === 'text') {
      seg.content = stripStray(seg.content)
    }
  }

  updateDisplay(true)
}

export const runFallbackProviderStream = async ({
  provider,
  activeModel,
  finalMessages,
  modeCfg,
  controller,
  onContentUpdate,
  onThinkingStatusUpdate
}) => {
  let fullContent = ''
  const stream = provider.chatStream(finalMessages, {
    model: activeModel,
    temperature: modeCfg.temperature,
    max_tokens: modeCfg.max_tokens,
    signal: controller.signal
  })

  let rafId = null
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

export const applyLegacyMarkdownBlocks = async (fullContent, vaultStore) => {
  const contentOutsideThink = (fullContent || '').replace(/<think>[\s\S]*?<\/think>/gi, '').replace(/<think>[\s\S]*$/gi, '')
  const allSnippets = vaultStore.snippets || []
  let appliedCreations = 0
  let appliedUpdates = 0
  let appliedDeletions = 0

  const parseLuminaBlocks = (text, prefix) => {
    const blocks = []
    const searchStart = '```' + prefix + ' '
    let i = 0
    while (i < text.length) {
      const blockStart = text.indexOf(searchStart, i)
      if (blockStart === -1) break

      const titleAfter = blockStart + searchStart.length
      const titleEnd = text.indexOf('\n', titleAfter)
      if (titleEnd === -1) break
      const title = text.slice(titleAfter, titleEnd).trim()

      let depth = 1
      let fenceDepth = 0
      let pos = titleEnd + 1

      while (pos < text.length && depth > 0) {
        const bt = text.indexOf('```', pos)
        if (bt === -1) break

        const afterBt = text.slice(bt + 3)
        const trimmed = afterBt.trimStart()

        if (
          trimmed.startsWith('lumina-create ') ||
          trimmed.startsWith('lumina-update ') ||
          trimmed.startsWith('lumina-delete ')
        ) {
          depth++
        } else if (afterBt.length > 0 && !/^\s/.test(afterBt[0])) {
          fenceDepth++
        } else if (fenceDepth > 0) {
          fenceDepth--
        } else {
          depth--
        }

        pos = bt + 3
      }

      const content = text.slice(titleEnd + 1, pos - 3).replace(/\n$/, '')
      blocks.push({ title, content })
      i = pos
    }
    return blocks
  }

  // 1. Process lumina-create
  const createMatches = parseLuminaBlocks(contentOutsideThink, 'lumina-create')
  for (const { title, content } of createMatches) {
    const newSnippet = {
      id: crypto.randomUUID(),
      title,
      code: content,
      language: 'markdown',
      tags: '',
      timestamp: Date.now()
    }
    await vaultStore.saveSnippet(newSnippet)
    appliedCreations++
  }

  // 1b. Fallback XML pseudo tags: <createFile title="..." ...>content</createFile>
  const xmlCreateMatches = [
    ...contentOutsideThink.matchAll(
      /<create(?:File|_file)\s+title=["']([^"']+)["'](?:\s+folder=["']([^"']*)["'])?[^>]*>([\s\S]*?)<\/create(?:File|_file)>/gi
    )
  ]
  for (const match of xmlCreateMatches) {
    const title = match[1].trim()
    const folderId = (match[2] || '').trim()
    const content = match[3].trim()

    if (title && !createMatches.some((c) => c.title === title)) {
      if (folderId && window.api?.createFolder) {
        try {
          await window.api.createFolder(folderId)
        } catch (_) {}
      }
      const newSnippet = {
        id: crypto.randomUUID(),
        title,
        code: content,
        folderId: folderId || '',
        language: 'markdown',
        tags: '',
        timestamp: Date.now()
      }
      await vaultStore.saveSnippet(newSnippet)
      appliedCreations++
    }
  }

  // 1c. Process <createFolder path="..."> pseudo tags
  const xmlFolderMatches = [
    ...contentOutsideThink.matchAll(/<create(?:Folder|_folder)\s+path=["']([^"']+)["'][^>]*>/gi)
  ]
  for (const match of xmlFolderMatches) {
    const folderPath = match[1].trim()
    if (folderPath && window.api?.createFolder) {
      try {
        await window.api.createFolder(folderPath)
      } catch (_) {}
    }
  }

  // 2. Process lumina-update
  const updateMatches = parseLuminaBlocks(contentOutsideThink, 'lumina-update')
  for (const { title, content } of updateMatches) {
    const cleanTitle = title.toLowerCase().replace(/\.md$/, '')
    const targetSnippet = allSnippets.find((s) => {
      const sTitle = s.title.toLowerCase().replace(/\.md$/, '')
      return sTitle === cleanTitle
    })

    if (targetSnippet) {
      const updatedSnippet = { ...targetSnippet, code: content, timestamp: Date.now() }
      await vaultStore.saveSnippet(updatedSnippet)
      if (vaultStore.selectedSnippet?.id === targetSnippet.id) {
        vaultStore.setSelectedSnippet(updatedSnippet)
      }
      appliedUpdates++
    }
  }

  // 3. Process lumina-delete
  const deleteMatches = [...contentOutsideThink.matchAll(/```lumina-delete\s+([^\n]+?)\s*```/g)]
  for (const match of deleteMatches) {
    const title = match[1].trim()
    const cleanTitle = title.toLowerCase().replace(/\.md$/, '')
    const targetSnippet = allSnippets.find((s) => {
      const sTitle = s.title.toLowerCase().replace(/\.md$/, '')
      return sTitle === cleanTitle
    })

    if (targetSnippet) {
      try {
        await vaultStore.deleteSnippet(targetSnippet.id, true)
        appliedDeletions++
      } catch (e) {
        console.warn(`[StreamRunner] Failed to delete "${title}":`, e)
      }
    }
  }

  // Strip tool blocks from chat display if any were applied
  if (appliedCreations > 0 || appliedUpdates > 0 || appliedDeletions > 0) {
    const prefixes = ['```lumina-create ', '```lumina-update ']
    let text = fullContent
    for (const prefix of prefixes) {
      const escaped = prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      text = text.replace(new RegExp(escaped + '[^\\n]*\\n[\\s\\S]*?\\n```', 'g'), '')
    }
    text = text.replace(/<create(?:File|_file)[\s\S]*?<\/create(?:File|_file)>/gi, '')
    text = text.replace(/<create(?:Folder|_folder)[^>]*>/gi, '')
    text = text.replace(/```lumina-delete\s+[^\n]+```\n?/g, '')
    text = text.replace(/\n{4,}/g, '\n\n\n').trim()

    if (!text || text.length < 20) {
      const parts = []
      if (appliedCreations > 0) parts.push(`${appliedCreations} file(s) about your request`)
      if (appliedUpdates > 0) parts.push(`${appliedUpdates} file(s) updated`)
      if (appliedDeletions > 0) parts.push(`Deleted`)
      return `I've ${parts.join(' and ')}. You can find them in your workspace!`
    }
    return text
  }

  return fullContent
}
