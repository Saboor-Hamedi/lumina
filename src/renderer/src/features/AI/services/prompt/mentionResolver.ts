/**
 * ============================================================================
 * Lumina AI Mention & Referenced File Resolver
 * ============================================================================
 * 
 * Scans user messages for `@note` mentions and implicit file name references,
 * resolving them against the active workspace snippet catalog:
 * 
 * 1. Explicit Mentions (`@Note Title`):
 *    - Sorts note titles longest-first so multi-word titles (e.g., `@Types of RAG`)
 *      match accurately before partial substrings.
 *    - Scans single-word tokens with fallback normalization (`normalizeTitle`).
 * 
 * 2. Referenced Files (Implicit Mentions):
 *    - Scans message body for unescaped references to note file names, folder paths,
 *      or aliases.
 *    - Caps implicit matches (default: 5) to prevent context window saturation.
 */

import type { MentionItem } from '../../types/ai.types'

/**
 * Normalizes note titles by removing punctuation, spaces, and `.md` extensions
 * for robust fuzzy matching.
 */
export const normalizeTitle = (str?: string): string =>
  (str || '')
    .toLowerCase()
    .replace(/[-_ .]/g, '')
    .replace(/\.md$/, '')

/**
 * Resolves explicit `@Note` mentions from the user's message and pre-attached UI tags.
 * 
 * @param message - The raw prompt text entered by the user
 * @param attachedMentions - Files already selected via the autocomplete mention pill UI
 * @param vaultSnippets - All available notes in the active workspace
 * @returns Deduplicated list of mentioned notes
 */
export const resolveMentions = (
  message?: string,
  attachedMentions: MentionItem[] = [],
  vaultSnippets: any[] = []
): MentionItem[] => {
  const mentionedSnippets: MentionItem[] = []

  // Pre-seed with any UI-selected mentions from the composer
  if (attachedMentions && attachedMentions.length > 0) {
    attachedMentions.forEach((snip) => {
      if (!mentionedSnippets.some((ms) => ms.id === snip.id)) {
        mentionedSnippets.push(snip)
      }
    })
  }

  if (!message || !vaultSnippets || vaultSnippets.length === 0) {
    return mentionedSnippets
  }

  try {
    // Match longest multi-word titles first so "@Types of RAG" matches as one entity
    const sortedSnippets = [...vaultSnippets].sort(
      (a, b) => (b.title?.length || 0) - (a.title?.length || 0)
    )

    for (const snip of sortedSnippets) {
      if (!snip.title) continue
      const escaped = snip.title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      const pattern = new RegExp(`@${escaped}(?=[\\s,;.!?]|$)`, 'i')
      if (pattern.test(message)) {
        if (!mentionedSnippets.some((ms) => ms.id === snip.id)) {
          mentionedSnippets.push(snip)
        }
      }
    }

    // Fallback single-word mention scan
    const singleMentionRegex = /@([^\s,;.!?]+)/g
    const singleMentions = [...message.matchAll(singleMentionRegex)].map((m) => m[1])
    singleMentions.forEach((mentionTitle) => {
      const normMention = normalizeTitle(mentionTitle)
      const found = vaultSnippets.find((s) => {
        const normTitle = normalizeTitle(s.title || '')
        return (
          normTitle === normMention ||
          normTitle.includes(normMention) ||
          normMention.includes(normTitle)
        )
      })
      if (found && !mentionedSnippets.some((ms) => ms.id === found.id)) {
        mentionedSnippets.push(found)
      }
    })
  } catch (err) {
    console.warn('[AIPromptBuilder] Mention scan failed:', err)
  }

  return mentionedSnippets
}

/**
 * Detects implicit references to workspace files within the user's message
 * without requiring an explicit `@` prefix.
 * 
 * @param message - The raw prompt text
 * @param vaultSnippets - All available notes in the active workspace
 * @param mentionedSnippets - Already resolved `@`-mentioned notes to avoid duplicates
 * @returns Up to 5 matched workspace files
 */
export const resolveReferencedFiles = (
  message?: string,
  vaultSnippets: any[] = [],
  mentionedSnippets: MentionItem[] = []
): any[] => {
  const requestedFiles: any[] = []
  if (!message || !vaultSnippets) return requestedFiles

  try {
    const cleanMessage = message.toLowerCase().replace(/\\/g, '/')
    vaultSnippets.forEach((s) => {
      const rawTitle = String(s.title || '').trim()
      if (!rawTitle || rawTitle.length < 3) return
      if (
        mentionedSnippets.some((m) => m.id === s.id) ||
        requestedFiles.some((f) => f.id === s.id)
      ) {
        return
      }

      const aliases = [
        rawTitle,
        rawTitle.replace(/\.[^.]+$/, ''),
        s.fileName,
        s.path,
        s.folderId ? `${s.folderId}/${rawTitle}` : rawTitle
      ]
        .filter((alias): alias is string => typeof alias === 'string' && alias.trim().length >= 3)
        .map((alias) => alias.trim().toLowerCase().replace(/\\/g, '/'))

      const matched = aliases.some((alias) => {
        const escaped = alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        const pattern = new RegExp(`(^|[^a-z0-9_-])${escaped}(?=$|[^a-z0-9_-])`, 'i')
        return pattern.test(cleanMessage)
      })

      if (matched) {
        requestedFiles.push(s)
      }
    })
    if (requestedFiles.length > 5) requestedFiles.length = 5
  } catch (err) {
    console.warn('[AIPromptBuilder] File mention detection failed:', err)
  }

  return requestedFiles
}
