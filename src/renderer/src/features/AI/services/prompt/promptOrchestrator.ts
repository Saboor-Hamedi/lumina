/**
 * ============================================================================
 * Lumina AI Prompt Orchestrator
 * ============================================================================
 * 
 * Central coordinator for composing the rich system prompt for LLMs:
 * 
 * 1. Persona & Mode Selection:
 *    - Injects base operational mode guidelines (Chat Mode vs Execution Mode).
 *    - Binds visual theme and editor typography settings.
 *    - Integrates native intelligence, interactive badges, and tool documentation.
 * 
 * 2. Multi-Tier Workspace Context Injection:
 *    - Tier 1: User @-mentioned notes (highest priority, 25k limit).
 *    - Tier 2: Implicitly referenced notes from prompt text.
 *    - Tier 3: Currently active editor tab (even if unsaved draft buffer).
 *    - Tier 4: Background open tabs.
 *    - Tier 5: Semantic RAG chunks (from vector embeddings).
 * 
 * 3. Knowledge Base & Topology:
 *    - Built-in Lumina product documentation (RAG).
 *    - Existing files catalog & folder hierarchy.
 *    - Knowledge graph 1-2 hop backlinks and forward links.
 *    - Dynamic intent exemplars (DIAGNOSTICS, AUDIT_WIKILINKS, QUERY_INDEX).
 */

import { extractGraphContext } from '../graphContext'
import { getDynamicExemplars } from '../intentRouter'
import type { IntentCategoryType } from '../intentRouter'
// @ts-ignore
import { luminaMemory } from '../../../../core/ai/memory'
import type { AIModeConfig, MentionItem } from '../../types/ai.types'
import type { SafeUserSettings } from './contextRetriever'
import { truncateForContext } from './contextRetriever'
import {
  buildSettingsAwarenessBlock,
  buildLuminaIntelligenceBlock,
  buildChatModeInstructions,
  buildExecutionModeInstructions,
  getIntentDirectives
} from './promptDirectives'

export interface BuildSystemPromptParams {
  modeCfg: AIModeConfig
  mentionedSnippets?: MentionItem[]
  requestedFiles?: any[]
  requestedBrainDocs?: any[]
  vaultContext?: Array<{ file: string; text: string; score: number }>
  vaultAccessNote?: string
  allSnippets?: any[]
  allFolders?: string[]
  selectedSnippet?: any | null
  drafts?: Record<string, string>
  contextSnippets?: any[]
  detectedIntent?: IntentCategoryType | null
  message?: string
  activeTheme?: string
  userSettings?: SafeUserSettings
}

/**
 * Builds the full system prompt string tailored to the active mode and workspace context.
 */
export const buildSystemPrompt = async ({
  modeCfg,
  mentionedSnippets = [],
  requestedFiles = [],
  requestedBrainDocs = [],
  vaultContext = [],
  vaultAccessNote = '',
  allSnippets = [],
  allFolders = [],
  selectedSnippet = null,
  drafts = {},
  contextSnippets = [],
  detectedIntent = null,
  activeTheme = 'Porcelain',
  userSettings
}: BuildSystemPromptParams): Promise<string> => {
  const isExecutionMode =
    modeCfg.enableTools !== false ||
    detectedIntent === 'DIAGNOSTICS' ||
    detectedIntent === 'AUDIT_WIKILINKS' ||
    detectedIntent === 'QUERY_INDEX'

  // Load persistent user profile & facts from memory.json
  await (luminaMemory as any).loadMemory()
  const userMemoryBlock = (luminaMemory as any).getPromptBlock()

  const settingsAwarenessBlock = buildSettingsAwarenessBlock(userSettings, modeCfg, activeTheme)
  const luminaIntelligenceBlock = buildLuminaIntelligenceBlock()

  // Base prompt: Chat mode vs Execution mode
  let systemPrompt = !isExecutionMode
    ? buildChatModeInstructions(
        modeCfg,
        settingsAwarenessBlock,
        luminaIntelligenceBlock,
        vaultAccessNote,
        userMemoryBlock
      )
    : buildExecutionModeInstructions(
        modeCfg,
        settingsAwarenessBlock,
        luminaIntelligenceBlock,
        vaultAccessNote,
        userMemoryBlock
      )

  // ── Tier 1: Explicit @-Mentioned Notes ───────────────────────────────────────
  if (mentionedSnippets.length > 0) {
    systemPrompt +=
      '\n\n**🎯 PRIMARY TARGET FILES (@-MENTIONED BY USER — YOUR HIGHEST FOCUS):**\n'
    mentionedSnippets.forEach((snip: any) => {
      const currentContent =
        snip.isBrain
          ? snip.code
          : drafts?.[snip.id] !== undefined
            ? drafts[snip.id]
            : snip.code || ''
      systemPrompt += `[Target Note: ${snip.title}]\n${truncateForContext(currentContent, 25000)}\n\n`
    })
    systemPrompt +=
      'CRITICAL DIRECTIVE:\n' +
      '1. The note content is ALREADY PROVIDED ABOVE in this prompt. Do NOT call readFile for this note.\n' +
      '2. Answer the user\'s question immediately, accurately, and thoroughly using the content above.\n' +
      '3. NEVER output conversational filler like "Let me check" or "Let me read what is in it". You ALREADY have the content right here, so give the actual answer immediately!\n'
  }

  // ── Tier 2: Implicitly Referenced Files ─────────────────────────────────────
  if (requestedFiles.length > 0) {
    systemPrompt +=
      '\n\n**Workspace Files Referenced (content already provided below):**\n'
    requestedFiles.forEach((f: any) => {
      if (!mentionedSnippets.some((m) => m.id === f.id)) {
        const currentContent =
          drafts?.[f.id] !== undefined ? drafts[f.id] : f.code || ''
        systemPrompt += `--- ${f.title} ---\n${truncateForContext(currentContent, 25000)}\n`
      }
    })
    systemPrompt +=
      'CRITICAL: The content of these files is ALREADY provided above. Answer questions about them directly right now without saying "let me read it".\n'
  }

  // ── Tier 3: Currently Open Active Editor Note ──────────────────────────────
  if (mentionedSnippets.length === 0 && selectedSnippet) {
    const activeCode =
      drafts?.[selectedSnippet.id] !== undefined
        ? drafts[selectedSnippet.id]
        : selectedSnippet.code || ''
    systemPrompt +=
      `\n\n**🎯 CURRENTLY OPEN ACTIVE NOTE IN EDITOR: [Note: ${selectedSnippet.title}]**\n` +
      `${truncateForContext(activeCode, 25000)}\n\n` +
      `CRITICAL DIRECTIVE:\n` +
      `1. The user is currently viewing this open note in their workspace editor (even if newly opened, empty, or an unsaved draft buffer).\n` +
      `2. When they ask "what do you see", "what do you read", "what is this", or ask questions about their note or what tab they are on, acknowledge this active note directly. Never claim it does not exist or hasn't synced to disk.\n` +
      `3. Answer and explain immediately based on this content without calling readFile or saying "let me read it"!\n`
  }

  // ── Tier 4: Background Active Tabs Context ─────────────────────────────────
  if (mentionedSnippets.length === 0 && contextSnippets.length > 0) {
    systemPrompt += '\n\n**Active Tabs Context:**\n'
    contextSnippets.forEach((snip: any) => {
      const currentCode =
        drafts?.[snip.id] !== undefined ? drafts[snip.id] : snip.code || ''
      systemPrompt += `[File: ${snip.title}]\n${truncateForContext(currentCode, 1500)}\n\n`
    })
  }

  // ── Tier 5: Generic Workspace Knowledge (RAG) ──────────────────────────────
  if (mentionedSnippets.length === 0 && vaultContext.length > 0) {
    systemPrompt += `\n\n**Workspace Knowledge:**\n`
    vaultContext.forEach((ctx, i) => {
      systemPrompt += `[${i + 1}] source: ${ctx.file}\n${ctx.text}\n\n`
    })
  }

  // ── Lumina Built-in Product Knowledge Base ─────────────────────────────────
  try {
    const { getBrainSummaryList } = await import('../brainKnowledge')
    const topics = getBrainSummaryList()
    systemPrompt +=
      `\n\n**LUMINA BUILT-IN KNOWLEDGE BASE (RAG)**:\n` +
      `You have comprehensive built-in knowledge about Lumina (product vision, philosophy, keyboard shortcuts, markdown features like mermaid diagrams, LaTeX math, tables, callouts, and design specifications).\n` +
      `Documented Topics Available in Knowledge Base:\n${topics}\n` +
      `CRITICAL PRESENTATION RULES:\n` +
      `- This is your native knowledge base. NEVER mention internal backend folders, paths like "brain/", "backend directory", or filesystem locations to the user.\n` +
      `- When the user asks about Lumina (e.g., "tell me about lumina documentation", "how do shortcuts work?", "what is lumina's vision?"), synthesize the information directly, warmly, and authoritatively from a user perspective.\n`

    if (requestedBrainDocs.length > 0) {
      systemPrompt += '\n\n**Retrieved Documentation Context (ALREADY PROVIDED FOR IMMEDIATE USE):**\n'
      requestedBrainDocs.forEach((b: any) => {
        const topicHeader = b.breadcrumb
          ? `[Topic: ${b.name || 'Guide'} > ${b.breadcrumb}]`
          : `[Topic: ${b.name}]`
        systemPrompt += `--- ${topicHeader} ---\n${truncateForContext(b.content, 15000)}\n\n`
      })
      systemPrompt +=
        'CRITICAL: The reference documentation above is already provided. Answer the user\'s question immediately and naturally from a user perspective without mentioning file names, paths, or backend folders.\n'
    }
  } catch (_) {}

  // ── File Hierarchy & Paths ─────────────────────────────────────────────────
  if (allSnippets.length > 0 || allFolders.length > 0) {
    const filePaths = allSnippets
      .map((s: any) => (s.folderId ? `${s.folderId}/${s.title}` : s.title))
      .join(', ')
    const folders = allFolders.join(', ')
    systemPrompt += `\n\n**EXISTING FILES (WITH FOLDER PATHS)**: ${filePaths || 'None'}\n**EXISTING FOLDERS**: ${folders || 'None'}\nUse these exact paths and folders for targeted file operations. When asked to rename, move, update, or clear files in a folder, reference these exact files.`
  }

  // ── Knowledge Graph Topology (1-2 Hop Backlinks & Forward Links) ───────────
  const targetSnippets =
    mentionedSnippets.length > 0
      ? mentionedSnippets
      : selectedSnippet
        ? [selectedSnippet]
        : []
  const graphTopology = extractGraphContext(targetSnippets, allSnippets, 2, 6)
  if (graphTopology) {
    systemPrompt += graphTopology
  }

  // ── Dynamic Intent Routing & Few-Shot Exemplars ────────────────────────────
  if (detectedIntent) {
    const exemplars = getDynamicExemplars(detectedIntent)
    if (exemplars) {
      systemPrompt += exemplars
    }
    const intentDirectives = getIntentDirectives(detectedIntent)
    if (intentDirectives) {
      systemPrompt += intentDirectives
    }
  }

  return systemPrompt
}
