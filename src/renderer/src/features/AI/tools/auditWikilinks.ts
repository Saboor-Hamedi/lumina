import * as aiSdk from 'ai'
import type { AIToolExecutionResult } from '../types/ai.types'

export interface AuditWikilinksInput {
  targetFolder?: string
  includeOrphans?: boolean
  includeBroken?: boolean
}

export interface BrokenLinkItem {
  sourceNote: string
  targetNote: string
  folder?: string
}

export interface WikilinkAuditResult {
  totalNotesScanned: number
  totalLinksFound: number
  healthyLinksCount: number
  brokenLinksCount: number
  orphanNotesCount: number
  brokenLinks: BrokenLinkItem[]
  orphanNotes: string[]
  missingTargets: string[]
}

/**
 * Scans a note's markdown text to extract all target note titles from [[...]] wikilinks.
 * Strips fenced code blocks and inline code to prevent false positives from code literals (e.g. Python [[1.0, 2.0]]).
 */
export const extractWikilinks = (text?: string): string[] => {
  if (!text || typeof text !== 'string') return []
  // Strip fenced code blocks and inline code
  const cleanText = text
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`[^`\n]*`/g, '')

  const linkRegex = /\[\[(.*?)\]\]/g
  const targets: string[] = []

  const matches = cleanText.matchAll(linkRegex)
  for (const match of matches) {
    const raw = match[1] || ''
    // Skip if it looks like code syntax (e.g. quotes, brackets, assignment)
    if (/["]|[']|\[|\]|;|=>|==/.test(raw)) continue

    // Strip aliases [[Target|Alias]] and heading anchors [[Target#Heading]]
    const cleanTarget = raw.split('|')[0].split('#')[0].trim()
    if (cleanTarget) {
      targets.push(cleanTarget)
    }
  }

  return targets
}

/**
 * auditWikilinksTool
 * Comprehensive workspace link health auditor.
 * Analyzes all workspace notes to discover:
 * 1. Broken wikilinks (links pointing to notes that do not exist yet)
 * 2. Orphan notes (notes with zero incoming and zero outgoing links)
 * 3. General link connectivity health across the entire workspace
 */
export const auditWikilinksTool = aiSdk.tool({
  description:
    'Scan and audit the workspace for broken wikilinks (links pointing to notes that do not exist), orphan notes (notes with zero incoming or outgoing connections), and report link connectivity health.',
  inputSchema: aiSdk.jsonSchema<AuditWikilinksInput>({
    type: 'object',
    properties: {
      targetFolder: {
        type: 'string',
        description: 'Optional subfolder to restrict link audit to (defaults to whole workspace).'
      },
      includeOrphans: {
        type: 'boolean',
        description: 'Whether to include isolated orphan notes in the audit report (defaults to true).'
      },
      includeBroken: {
        type: 'boolean',
        description: 'Whether to include broken link targets in the audit report (defaults to true).'
      }
    }
  }),
  execute: async ({
    targetFolder,
    includeOrphans = true,
    includeBroken = true
  }: AuditWikilinksInput = {}): Promise<AIToolExecutionResult> => {
    try {
      // 1. Retrieve all notes from workspace store or IPC
      let allNotes: any[] = []
      try {
        const { useWorkspaceStore } = await import('../../../core/store/workspaceStore')
        const ws = (useWorkspaceStore as any).getState()
        if (Array.isArray(ws?.notes) && ws.notes.length > 0) {
          allNotes = ws.notes
        } else if (Array.isArray(ws?.snippets) && ws.snippets.length > 0) {
          allNotes = ws.snippets
        }
      } catch (_) {}

      if (
        allNotes.length === 0 &&
        typeof window !== 'undefined' &&
        (window as any).api?.getSnippets
      ) {
        try {
          const res = await (window as any).api.getSnippets()
          allNotes = res?.snippets || (Array.isArray(res) ? res : [])
        } catch (_) {}
      }

      // 2. Build canonical set of existing notes across the workspace
      const canonicalTitleMap = new Map<string, string>() // lowerKey -> displayName
      const existingKeySet = new Set<string>()

      for (const note of allNotes) {
        const title = (note.title || '').trim()
        const fileName = (note.fileName || '').replace(/\.[^/.]+$/, '').trim()
        const relPath = (note.relativePath || '').replace(/\.[^/.]+$/, '').trim()

        if (title) {
          const key = title.toLowerCase()
          canonicalTitleMap.set(key, title)
          existingKeySet.add(key)
        }
        if (fileName) {
          const key = fileName.toLowerCase()
          if (!canonicalTitleMap.has(key)) {
            canonicalTitleMap.set(key, fileName)
          }
          existingKeySet.add(key)
        }
        if (relPath) {
          const key = relPath.toLowerCase()
          existingKeySet.add(key)
        }
      }

      // Filter notes by targetFolder if requested
      const targetNotes = targetFolder
        ? allNotes.filter((n) => {
            const f = (n.folderId || '').replace(/\\/g, '/').toLowerCase()
            return f === targetFolder.toLowerCase() || f.startsWith(targetFolder.toLowerCase() + '/')
          })
        : allNotes

      // 3. Scan each note for wikilinks and map graph connections
      const forwardLinks = new Map<string, Set<string>>() // sourceKey -> Set of targetKeys
      const backLinks = new Map<string, Set<string>>() // targetKey -> Set of sourceKeys
      const brokenLinks: BrokenLinkItem[] = []
      const missingTargetKeys = new Set<string>()
      let totalLinksFound = 0

      for (const note of targetNotes) {
        const rawTitle = (note.title || note.fileName || 'Untitled').replace(/\.[^/.]+$/, '').trim()
        const sourceKey = rawTitle.toLowerCase()

        if (!forwardLinks.has(sourceKey)) {
          forwardLinks.set(sourceKey, new Set())
        }

        let body = note.code
        // If content isn't loaded into memory, read directly via IPC if available
        if (!body && typeof window !== 'undefined' && (window as any).api?.readSnippet && note.id) {
          try {
            const loaded = await (window as any).api.readSnippet(note.id)
            body = loaded?.code || ''
          } catch (_) {
            body = ''
          }
        }

        const linkTargets = extractWikilinks(body)
        totalLinksFound += linkTargets.length

        for (const target of linkTargets) {
          const targetKey = target.toLowerCase()
          if (targetKey === sourceKey) continue // skip self-links

          forwardLinks.get(sourceKey)!.add(targetKey)

          if (!backLinks.has(targetKey)) {
            backLinks.set(targetKey, new Set())
          }
          backLinks.get(targetKey)!.add(sourceKey)

          // Check if link target exists in the workspace
          if (!existingKeySet.has(targetKey)) {
            brokenLinks.push({
              sourceNote: rawTitle,
              targetNote: target,
              folder: note.folderId || ''
            })
            missingTargetKeys.add(target)
          }
        }
      }

      // 4. Identify orphan notes (notes with 0 forward links AND 0 incoming backlinks)
      const orphanNotes: string[] = []
      for (const note of targetNotes) {
        const rawTitle = (note.title || note.fileName || 'Untitled').replace(/\.[^/.]+$/, '').trim()
        const key = rawTitle.toLowerCase()
        const outCount = forwardLinks.get(key)?.size || 0
        const inCount = backLinks.get(key)?.size || 0

        if (outCount === 0 && inCount === 0) {
          orphanNotes.push(rawTitle)
        }
      }

      const brokenLinksCount = brokenLinks.length
      const healthyLinksCount = Math.max(0, totalLinksFound - brokenLinksCount)
      const orphanNotesCount = orphanNotes.length
      const totalNotesScanned = targetNotes.length
      const missingTargets = Array.from(missingTargetKeys)

      // 5. Generate clean, non-technical Markdown summary table
      const brokenSection =
        includeBroken && brokenLinks.length > 0
          ? `\n#### ⚠️ Broken Links (${brokenLinks.length} dead references found)\n` +
            brokenLinks
              .slice(0, 15)
              .map(
                (item) =>
                  `- In **${item.sourceNote}**${item.folder ? ` *(${item.folder})*` : ''} ➔ references missing note \`[[${item.targetNote}]]\``
              )
              .join('\n') +
            (brokenLinks.length > 15 ? `\n- *...and ${brokenLinks.length - 15} more*` : '')
          : includeBroken
            ? '\n✅ **All links resolve cleanly!** No broken references found.'
            : ''

      const orphanSection =
        includeOrphans && orphanNotes.length > 0
          ? `\n#### 🏝️ Orphan Notes (${orphanNotes.length} notes without any links)\n` +
            orphanNotes
              .slice(0, 15)
              .map((title) => `- **${title}**`)
              .join('\n') +
            (orphanNotes.length > 15 ? `\n- *...and ${orphanNotes.length - 15} more*` : '')
          : includeOrphans
            ? '\n✅ **No orphan notes!** Every note is connected to at least one other note.'
            : ''

      const actionPrompt =
        brokenLinks.length > 0
          ? `\n\n💡 *Would you like me to create starter notes for any of the missing references (e.g. ${missingTargets.slice(0, 3).map((t) => `\`[[${t}]]\``).join(', ')}), or help cross-link your orphan notes?*`
          : orphanNotes.length > 0
            ? '\n\n💡 *Would you like me to suggest meaningful cross-links for your orphan notes to connect them into your workspace?*'
            : ''

      const summary = `### 🔗 Workspace Link Audit Report

| Metric | Count | Health Status |
| :--- | :--- | :--- |
| 📄 Total Notes Scanned | **${totalNotesScanned}** | Complete |
| 🔗 Total Links Found | **${totalLinksFound}** | Analyzed |
| ✅ Valid Connected Links | **${healthyLinksCount}** | Healthy |
| ⚠️ Broken / Missing Links | **${brokenLinksCount}** | ${brokenLinksCount === 0 ? '🟢 Clean' : '🟠 Needs Review'} |
| 🏝️ Orphan Notes (Zero Links) | **${orphanNotesCount}** | ${orphanNotesCount === 0 ? '🟢 Connected' : '🔵 Isolated'} |
${brokenSection}
${orphanSection}
${actionPrompt}`

      const auditData: WikilinkAuditResult = {
        totalNotesScanned,
        totalLinksFound,
        healthyLinksCount,
        brokenLinksCount,
        orphanNotesCount,
        brokenLinks,
        orphanNotes,
        missingTargets
      }

      return {
        success: true,
        result: auditData,
        summary
      }
    } catch (err: any) {
      console.error('[auditWikilinksTool] Error auditing links:', err)
      return {
        success: false,
        error: `Link audit failed: ${err.message}`
      }
    }
  }
})
