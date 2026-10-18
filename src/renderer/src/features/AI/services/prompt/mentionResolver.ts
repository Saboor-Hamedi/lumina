/**
 * ============================================================================
 * Lumina AI Mention & Referenced File/Folder Resolver
 * ============================================================================
 *
 * Scans user messages for `@note` and `@folder` mentions as well as implicit
 * file/folder references, resolving them against the active workspace catalog:
 *
 * 1. Explicit Mentions (`@Note Title` or `@Folder`):
 *    - Expands UI-attached folder mentions (`isFolder: true`) into all notes
 *      inside that folder (and its subfolders).
 *    - Matches `@folder` tokens (exact, basename, and typo-tolerant Levenshtein
 *      distance <= 2, e.g. `@enrichment` -> `entrichment`) and expands all notes
 *      inside the matched folder.
 *    - Sorts note titles longest-first so multi-word titles (e.g., `@Types of RAG`)
 *      match accurately before partial substrings.
 *
 * 2. Referenced Files & Folders (Implicit Mentions):
 *    - Scans message body for unescaped references to note file names, folder paths,
 *      or folder names (e.g., "read the enrichment folder").
 */

import type { MentionItem } from '../../types/ai.types'

/**
 * Normalizes note/folder titles by removing punctuation, spaces, and `.md` extensions
 * for robust fuzzy matching.
 */
export const normalizeTitle = (str?: string): string =>
  (str || '')
    .toLowerCase()
    .replace(/[-_ .]/g, '')
    .replace(/\.md$/, '')

const normalizePath = (p?: string): string =>
  String(p || '')
    .trim()
    .replace(/\\/g, '/')
    .replace(/^\/+|\/+$/g, '')

/**
 * Computes Levenshtein edit distance between two normalized strings for typo tolerance
 * (e.g. "enrichment" vs "entrichment" => distance 1).
 */
export const editDistance = (a: string, b: string): number => {
  if (a === b) return 0
  if (!a.length) return b.length
  if (!b.length) return a.length
  const dp: number[][] = Array.from({ length: a.length + 1 }, () =>
    new Array(b.length + 1).fill(0)
  )
  for (let i = 0; i <= a.length; i++) dp[i][0] = i
  for (let j = 0; j <= b.length; j++) dp[0][j] = j
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost)
    }
  }
  return dp[a.length][b.length]
}

/**
 * Collects all unique folder paths from explicit workspace folders and note `folderId`s.
 */
export const collectWorkspaceFolders = (
  vaultSnippets: any[] = [],
  allFolders: string[] = []
): string[] => {
  const folderSet = new Set<string>()
  ;(allFolders || []).forEach((f) => {
    const clean = normalizePath(f)
    if (clean) folderSet.add(clean)
  })
  ;(vaultSnippets || []).forEach((s) => {
    const clean = normalizePath(s?.folderId)
    if (clean) {
      let curr = ''
      clean.split('/').forEach((part) => {
        if (!part) return
        curr = curr ? `${curr}/${part}` : part
        folderSet.add(curr)
      })
    }
  })
  return Array.from(folderSet)
}

/**
 * Returns all notes belonging to `folderPath` (or any nested subfolder).
 */
export const getNotesInFolder = (folderPath: string, vaultSnippets: any[] = []): any[] => {
  const target = normalizePath(folderPath).toLowerCase()
  if (!target) return []
  return (vaultSnippets || [])
    .filter((s) => {
      const nf = normalizePath(s?.folderId).toLowerCase()
      return nf === target || nf.startsWith(`${target}/`)
    })
    .map((s) => ({
      ...s,
      fromMentionedFolder: folderPath
    }))
}

/**
 * Resolves a folder query against known workspace folders (exact, basename, or typo-tolerant).
 */
export const matchFolderByQuery = (query: string, knownFolders: string[]): string | null => {
  const cleanQuery = normalizePath(query).toLowerCase()
  const normQuery = normalizeTitle(cleanQuery)
  if (!normQuery) return null

  // 1. Exact path or basename match
  const exact = knownFolders.find((f) => {
    const lf = f.toLowerCase()
    const base = lf.split('/').pop() || lf
    return lf === cleanQuery || base === cleanQuery || normalizeTitle(base) === normQuery
  })
  if (exact) return exact

  // 2. Substring match for queries >= 4 chars
  if (normQuery.length >= 4) {
    const sub = knownFolders.find((f) => {
      const base = normalizeTitle(f.split('/').pop() || f)
      return base.includes(normQuery) || normQuery.includes(base)
    })
    if (sub) return sub
  }

  // 3. Typo-tolerant Levenshtein match (distance <= 2 for queries >= 4 chars)
  if (normQuery.length >= 4) {
    let bestFolder: string | null = null
    let bestDist = 3
    for (const f of knownFolders) {
      const base = normalizeTitle(f.split('/').pop() || f)
      if (Math.abs(base.length - normQuery.length) <= 2) {
        const dist = editDistance(normQuery, base)
        if (dist <= 2 && dist < bestDist) {
          bestDist = dist
          bestFolder = f
        }
      }
    }
    if (bestFolder) return bestFolder
  }

  return null
}

/**
 * Resolves explicit `@Note` and `@Folder` mentions from the user's message and pre-attached UI tags.
 *
 * @param message - The raw prompt text entered by the user
 * @param attachedMentions - Files or folders selected via the autocomplete mention UI
 * @param vaultSnippets - All available notes in the active workspace
 * @param allFolders - All available folder paths in the active workspace
 * @returns Deduplicated list of mentioned notes (expanding any mentioned folders into their constituent notes)
 */
export const resolveMentions = (
  message?: string,
  attachedMentions: MentionItem[] = [],
  vaultSnippets: any[] = [],
  allFolders: string[] = []
): MentionItem[] => {
  const mentionedSnippets: MentionItem[] = []
  const knownFolders = collectWorkspaceFolders(vaultSnippets, allFolders)

  const addFolderNotes = (folderPath: string) => {
    const folderNotes = getNotesInFolder(folderPath, vaultSnippets)
    folderNotes.forEach((n) => {
      if (!mentionedSnippets.some((ms) => ms.id === n.id)) {
        mentionedSnippets.push(n)
      }
    })
  }

  // Pre-seed with any UI-selected mentions from the composer (expanding folders!)
  if (attachedMentions && attachedMentions.length > 0) {
    attachedMentions.forEach((snip: any) => {
      if (snip?.isFolder || String(snip?.id || '').startsWith('folder:')) {
        const folderPath =
          snip.folderId || String(snip.id || '').replace(/^folder:/, '') || snip.title || ''
        const resolvedFolder = matchFolderByQuery(folderPath, knownFolders) || folderPath
        addFolderNotes(resolvedFolder)
      } else if (snip && !mentionedSnippets.some((ms) => ms.id === snip.id)) {
        mentionedSnippets.push(snip)
      }
    })
  }

  if (!message || (!vaultSnippets?.length && !knownFolders.length)) {
    return mentionedSnippets
  }

  try {
    // 1. Check multi-word @Folder mentions longest-first
    const sortedFolders = [...knownFolders].sort((a, b) => b.length - a.length)
    for (const folderPath of sortedFolders) {
      const candidates = [folderPath, folderPath.split('/').pop() || folderPath]
      for (const candidate of candidates) {
        if (!candidate) continue
        const escaped = candidate.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        const pattern = new RegExp(`@${escaped}(?=[\\s,;.!?]|$)`, 'i')
        if (pattern.test(message)) {
          addFolderNotes(folderPath)
        }
      }
    }

    // 2. Match longest multi-word note titles first so "@Types of RAG" matches as one entity
    const sortedSnippets = [...(vaultSnippets || [])].sort(
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

    // 3. Fallback single-word @mention scan (checks both folders and notes, including typo tolerance)
    const singleMentionRegex = /@([^\s,;.!?]+)/g
    const singleMentions = [...message.matchAll(singleMentionRegex)].map((m) => m[1])
    singleMentions.forEach((mentionToken) => {
      // Check if @token matches a folder (exact, basename, or typo-tolerant like @enrichment -> entrichment)
      const matchedFolder = matchFolderByQuery(mentionToken, knownFolders)
      if (matchedFolder) {
        addFolderNotes(matchedFolder)
      }

      const normMention = normalizeTitle(mentionToken)
      const found = (vaultSnippets || []).find((s) => {
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
 * Detects implicit references to workspace files or folders within the user's message
 * without requiring an explicit `@` prefix.
 *
 * @param message - The raw prompt text
 * @param vaultSnippets - All available notes in the active workspace
 * @param mentionedSnippets - Already resolved `@`-mentioned notes to avoid duplicates
 * @param allFolders - All available folder paths in the active workspace
 * @returns Matched workspace files (up to 25 when expanding a referenced folder, or 5 for individual files)
 */
export const resolveReferencedFiles = (
  message?: string,
  vaultSnippets: any[] = [],
  mentionedSnippets: MentionItem[] = [],
  allFolders: string[] = []
): any[] => {
  const requestedFiles: any[] = []
  if (!message || !vaultSnippets) return requestedFiles

  try {
    const cleanMessage = message.toLowerCase().replace(/\\/g, '/')
    const knownFolders = collectWorkspaceFolders(vaultSnippets, allFolders)
    let matchedFolderReference = false

    // 1. Check if message references a known folder name (exact or fuzzy with "folder" / "inside" / "read")
    for (const folderPath of knownFolders) {
      const baseName = (folderPath.split('/').pop() || folderPath).toLowerCase()
      if (baseName.length < 3) continue
      const escaped = baseName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      const exactPattern = new RegExp(`(^|[^a-z0-9_-])${escaped}(?=$|[^a-z0-9_-])`, 'i')
      let isMatched = exactPattern.test(cleanMessage)

      if (!isMatched && baseName.length >= 4 && /\b(folder|directory|inside|read|files?)\b/i.test(cleanMessage)) {
        const words = cleanMessage.split(/[^a-z0-9_-]+/).filter((w) => w.length >= 4)
        isMatched = words.some(
          (w) => Math.abs(w.length - baseName.length) <= 2 && editDistance(w, baseName) <= 2
        )
      }

      if (isMatched) {
        const folderNotes = getNotesInFolder(folderPath, vaultSnippets)
        folderNotes.forEach((n) => {
          if (
            !mentionedSnippets.some((m) => m.id === n.id) &&
            !requestedFiles.some((f) => f.id === n.id)
          ) {
            requestedFiles.push(n)
            matchedFolderReference = true
          }
        })
      }
    }

    // 2. Check individual note titles and paths
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

    const maxFiles = matchedFolderReference ? 25 : 5
    if (requestedFiles.length > maxFiles) requestedFiles.length = maxFiles
  } catch (err) {
    console.warn('[AIPromptBuilder] File mention detection failed:', err)
  }

  return requestedFiles
}
