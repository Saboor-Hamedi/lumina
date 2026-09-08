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
    default:
      return toolName ? `Preparing ${toolName}...` : 'Thinking...'
  }
}

export const buildRealtimeDisplay = ({
  reasoningText = '',
  executedActions = [],
  activeToolStatus = '',
  beforeToolText = '',
  afterToolText = ''
}) => {
  const blocks = []
  if (reasoningText.trim()) {
    blocks.push(`<think>\n${reasoningText.trim()}\n</think>`)
  }
  if (executedActions.length > 0 || activeToolStatus) {
    const actionLines = [...executedActions]
    if (activeToolStatus) {
      actionLines.push(activeToolStatus)
    }
    blocks.push(`<lumina-activity>\n${actionLines.join('\n')}\n</lumina-activity>`)
  }
  const responseText = [beforeToolText.trim(), afterToolText.trim()].filter(Boolean).join('\n\n')
  if (responseText) {
    blocks.push(responseText)
  }
  return blocks.join('\n\n')
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

  const executedActions = []
  let activeToolStatus = ''
  let reasoningText = ''
  let beforeToolText = ''
  let afterToolText = ''
  let hasToolCalled = false

  const updateDisplay = () => {
    const content = buildRealtimeDisplay({
      reasoningText,
      executedActions,
      activeToolStatus,
      beforeToolText,
      afterToolText
    })
    onContentUpdate(content)
  }

  for await (const chunk of result.fullStream) {
    if (controller.signal.aborted) break
    if (!chunk || typeof chunk.type !== 'string') continue

    if (chunk.type === 'tool-call') {
      hasToolCalled = true
      const args = chunk.input || chunk.args || {}
      activeToolStatus = getToolStatusDescription(chunk.toolName, args)
      updateDisplay()
      const cleanToolStatus = activeToolStatus.replace(/[*_`]/g, '').trim()
      onThinkingStatusUpdate(cleanToolStatus)
    } else if (chunk.type === 'tool-input-start') {
      onThinkingStatusUpdate(getToolInputStartStatus(chunk.toolName))
    } else if (chunk.type === 'tool-result') {
      activeToolStatus = ''
      const res = chunk.output || chunk.result
      if (res && res.success === false) {
        console.warn(`[StreamRunner] Tool ${chunk.toolName} failed:`, res.error)
        executedActions.push(`⚠️ ${chunk.toolName} failed: ${res.error}`)
      } else if (res && res.summary) {
        const entry = res.summary
        if (!executedActions.includes(entry)) {
          executedActions.push(entry)
        }
      }
      updateDisplay()
      onThinkingStatusUpdate('Reflecting on workspace changes...')
    } else if (chunk.type === 'start-step') {
      if (hasToolCalled) {
        onThinkingStatusUpdate('Synthesizing changes...')
      }
    } else if (chunk.type === 'reasoning' || chunk.type === 'reasoning-delta') {
      const rDelta = chunk.textDelta || chunk.text || chunk.delta || ''
      reasoningText += rDelta
      updateDisplay()
      onThinkingStatusUpdate('Reasoning...')
    } else if (chunk.type === 'text-delta') {
      const delta = chunk.textDelta || chunk.text || chunk.delta || ''
      if (hasToolCalled) {
        afterToolText += delta
      } else {
        beforeToolText += delta
      }
      updateDisplay()
      const currentText = hasToolCalled ? afterToolText : beforeToolText
      if (currentText.trim().length > 30) {
        onThinkingStatusUpdate('')
      }
    } else if (chunk.type === 'tool-error') {
      const errMsg = chunk.error?.message || chunk.error || 'Unknown tool error'
      console.warn(`[StreamRunner] Tool ${chunk.toolName} errored:`, errMsg)
      executedActions.push(`⚠️ Tool error: ${errMsg}`)
      updateDisplay()
    } else if (chunk.type === 'error') {
      console.error('Stream error:', chunk.error)
      updateDisplay()
    }
  }

  activeToolStatus = ''
  onThinkingStatusUpdate('')

  try {
    const steps = await result.steps
    const toolResults = steps?.flatMap((s) => s.toolResults || []) || []
    if (toolResults.length > 0) {
      toolResults.forEach((t) => {
        const res = t.output || t.result
        const sum = res?.summary
        if (sum && !executedActions.includes(sum)) {
          executedActions.push(sum)
        }
      })
    }
    const finalText = await result.text
    if (finalText && finalText.trim()) {
      if (hasToolCalled) {
        if (!afterToolText.trim() && finalText.trim() !== beforeToolText.trim()) {
          afterToolText = finalText.trim()
        }
      } else {
        if (!beforeToolText.trim() || finalText.length > beforeToolText.length) {
          beforeToolText = finalText.trim()
        }
      }
    }
  } catch (_) {}

  updateDisplay()
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

  for await (const chunk of stream) {
    if (controller.signal.aborted) break
    if (chunk) {
      fullContent += chunk
      onContentUpdate(fullContent)
      onThinkingStatusUpdate(fullContent.trim().length > 30 ? '' : 'Writing...')
    }
  }

  return fullContent
}

export const applyLegacyMarkdownBlocks = async (fullContent, vaultStore) => {
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
  const createMatches = parseLuminaBlocks(fullContent, 'lumina-create')
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
    ...fullContent.matchAll(
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
    ...fullContent.matchAll(/<create(?:Folder|_folder)\s+path=["']([^"']+)["'][^>]*>/gi)
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
  const updateMatches = parseLuminaBlocks(fullContent, 'lumina-update')
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
  const deleteMatches = [...fullContent.matchAll(/```lumina-delete\s+([^\n]+?)\s*```/g)]
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
