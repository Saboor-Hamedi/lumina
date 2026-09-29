/**
 * ============================================================================
 * Lumina AI Display Builder & Thought Formatter
 * ============================================================================
 * 
 * Assembles dynamic markdown and visual cards for streaming AI responses:
 * 
 * 1. Badge Formatting:
 *    - Memory Operations: `<lumina-memory>...</lumina-memory>`
 *    - Graph & Link Audits: `<lumina-audit>...</lumina-audit>`
 *    - Health Checks: `<lumina-health>...</lumina-health>`
 *    - Workspace Index Queries: `<lumina-index>...</lumina-index>`
 *    - Model CoT Reasoning: `<think>...</think>`
 *    - Multi-Step Operations: `<lumina-activity>...</lumina-activity>`
 * 
 * 2. Conversational Status & Thought Descriptions:
 *    - `getToolStatusDescription`: Human-friendly status line with emojis.
 *    - `getToolInputStartStatus`: Terse status for model tool invocations.
 *    - `generateInitialThought`: Warm starter thought based on prompt keywords.
 *    - `getToolResultThought`: Outcome narratives following tool execution.
 */

import { cleanRawToolLeaks } from './toolCallInterceptor'

export interface RealtimeDisplayParams {
  timeline?: any[] | null
  initialReasoning?: string
  postToolReasoning?: string
  reasoningText?: string
  executedActions?: string[]
  memoryActions?: string[]
  activeToolStatus?: string
  beforeToolText?: string
  afterToolText?: string
}

export const getToolStatusDescription = (toolName: string, args: Record<string, any> = {}): string => {
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
    case 'diagnoseSystem':
    case 'luminaDiagnoseSystem':
      return `🩺 *Checking Lumina health & testing lumina-health.md...*`
    case 'auditWikilinks':
      return `🔗 *Auditing workspace links & orphan notes...*`
    case 'luminaQueryIndex':
    case 'queryIndex':
      return `🔍 *Querying workspace index (${args.tag ? '#' + args.tag : ''}${args.folder ? ' in ' + args.folder : ''}${args.query ? ' "' + args.query + '"' : ''})...*`
    default:
      return `⚙️ *Working on ${toolName}...*`
  }
}

export const getToolInputStartStatus = (toolName?: string): string => {
  switch (toolName) {
    case 'diagnoseSystem':
    case 'luminaDiagnoseSystem':
      return 'Checking Lumina health...'
    case 'auditWikilinks':
      return 'Auditing workspace links & orphan notes...'
    case 'luminaQueryIndex':
    case 'queryIndex':
      return 'Querying workspace index...'
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

export const generateInitialThought = (prompt: string = ''): string => {
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
  const cleanPrompt = p.replace(/[\r\n]+/g, ' ').slice(0, 80)
  return `Analyzing request: "${cleanPrompt}"... Determining necessary workspace actions.`
}

export const getToolStartThought = (toolName: string): string => {
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
    case 'luminaQueryIndex':
    case 'queryIndex':
      return `Querying structured workspace index...`
    default:
      return `Executing ${toolName}...`
  }
}

export const getToolResultThought = (toolName: string, res: any, target: string = ''): string => {
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
    case 'luminaQueryIndex':
    case 'queryIndex':
      return `Workspace index query returned matching records. Synthesizing insights...`
    default:
      return `Completed ${toolName}. Preparing walkthrough...`
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
}: RealtimeDisplayParams): string => {
  const stripDSML = (text?: string): string => cleanRawToolLeaks(text)

  const normalizeCodeBlocks = (text?: string): string => {
    if (!text) return ''
    return text.replace(/```(TEXT|MARKDOWN|PLAINTEXT|TREE|PLAIN|MD)\b/gi, '```')
  }

  if (Array.isArray(timeline) && timeline.length > 0) {
    const blocks: string[] = []
    for (const seg of timeline) {
      if (seg.type === 'memory') {
        const memText = (seg.content || '').trim()
        if (memText) {
          blocks.push(`<lumina-memory>\n${memText}\n</lumina-memory>`)
        }
      } else if (seg.type === 'audit') {
        const auditText = (seg.content || '').trim()
        if (auditText) {
          blocks.push(`<lumina-audit>\n${auditText}\n</lumina-audit>`)
        }
      } else if (seg.type === 'health') {
        const healthText = (seg.content || '').trim()
        if (healthText) {
          blocks.push(`<lumina-health>\n${healthText}\n</lumina-health>`)
        }
      } else if (seg.type === 'index') {
        const indexText = (seg.content || '').trim()
        if (indexText) {
          blocks.push(`<lumina-index>\n${indexText}\n</lumina-index>`)
        }
      } else if (seg.type === 'think') {
        const cleanThink = stripDSML(seg.content).trim()
        if (cleanThink) {
          blocks.push(`<think>\n${cleanThink}\n</think>`)
        }
      } else if (seg.type === 'activity') {
        const lines: string[] = []
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

  const blocks: string[] = []

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
