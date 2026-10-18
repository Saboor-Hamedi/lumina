import * as aiSdk from 'ai'
import type { AIToolExecutionResult } from '../types/ai.types'

interface GrepWorkspaceInput {
  query: string
  folder?: string
  isRegex?: boolean
  caseSensitive?: boolean
  maxResults?: number
}

export interface GrepMatchItem {
  id: string
  title: string
  folder: string
  line: number
  text: string
  contextBefore?: string
  contextAfter?: string
}

export const grepWorkspaceTool = aiSdk.tool({
  description:
    'Search across all notes in the workspace for exact text or regex patterns (`grepWorkspace`). Returns matching note titles, folder paths, 1-indexed line numbers, and surrounding context lines so you can follow up with targeted `readFile` (with `startLine`/`endLine`) or `updateFile`.',
  inputSchema: aiSdk.jsonSchema<GrepWorkspaceInput>({
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'The text phrase or regular expression pattern to search for across workspace notes.'
      },
      folder: {
        type: 'string',
        description: 'Optional workspace-relative folder to restrict the search to (e.g. "Projects" or "Science").'
      },
      isRegex: {
        type: 'boolean',
        description: 'Set to true to interpret `query` as a regular expression. Defaults to false.'
      },
      caseSensitive: {
        type: 'boolean',
        description: 'Set to true for case-sensitive matching. Defaults to false.'
      },
      maxResults: {
        type: 'number',
        description: 'Maximum number of line matches to return across the workspace (default: 30, max: 100).'
      }
    },
    required: ['query']
  }),
  execute: async ({
    query,
    folder,
    isRegex = false,
    caseSensitive = false,
    maxResults = 30
  }): Promise<AIToolExecutionResult> => {
    try {
      const rawQuery = (query || '').trim()
      if (!rawQuery) {
        return {
          success: false,
          error: 'Please provide a non-empty `query` string for grepWorkspace.'
        }
      }

      const { useWorkspaceStore } = await import('../../../core/store/workspaceStore')
      const vs = (useWorkspaceStore as any).getState()
      const notes: any[] = Array.isArray(vs.notes) ? vs.notes : []

      const cleanFolder = (folder || '')
        .trim()
        .replace(/\\/g, '/')
        .replace(/^\/+|\/+$/g, '')
        .toLowerCase()

      const limit = Math.min(100, Math.max(1, Number(maxResults) || 30))
      const flags = caseSensitive ? '' : 'i'
      let matcher: RegExp
      try {
        const pattern = isRegex ? rawQuery : rawQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        matcher = new RegExp(pattern, flags)
      } catch (regexErr: any) {
        return {
          success: false,
          error: `Invalid regular expression "${rawQuery}": ${regexErr.message}`
        }
      }

      const matches: GrepMatchItem[] = []
      const matchedNoteIds = new Set<string>()

      for (const note of notes) {
        const noteFolder = String(note?.folderId || '')
          .replace(/\\/g, '/')
          .replace(/^\/+|\/+$/g, '')
        if (cleanFolder && !noteFolder.toLowerCase().startsWith(cleanFolder)) {
          continue
        }

        const content: string =
          vs.drafts?.[note.id] !== undefined ? String(vs.drafts[note.id] || '') : String(note.code || '')
        const lines = content.split(/\r?\n/)

        for (let i = 0; i < lines.length; i++) {
          if (matcher.test(lines[i])) {
            matchedNoteIds.add(note.id || note.title)
            matches.push({
              id: note.id || '',
              title: note.title || 'Untitled',
              folder: noteFolder,
              line: i + 1,
              text: lines[i].slice(0, 240),
              contextBefore: i > 0 ? lines[i - 1].slice(0, 160) : undefined,
              contextAfter: i + 1 < lines.length ? lines[i + 1].slice(0, 160) : undefined
            })

            if (matches.length >= limit) break
          }
        }

        if (matches.length >= limit) break
      }

      const formattedLines = matches
        .map((m) => {
          const pathLabel = m.folder ? `${m.folder}/${m.title}` : m.title
          return `- [[${m.title}]] (${pathLabel}:${m.line}): \`${m.text.trim()}\``
        })
        .join('\n')

      return {
        success: true,
        query: rawQuery,
        folder: cleanFolder || undefined,
        matchCount: matches.length,
        matchedFilesCount: matchedNoteIds.size,
        matches,
        summary: `🔎 Found ${matches.length} match${matches.length === 1 ? '' : 'es'} across ${matchedNoteIds.size} note${matchedNoteIds.size === 1 ? '' : 's'} for "${rawQuery}"`,
        content:
          matches.length > 0
            ? `Found ${matches.length} line match(es) across ${matchedNoteIds.size} note(s):\n${formattedLines}`
            : `No matches found for "${rawQuery}"${cleanFolder ? ` in folder "${cleanFolder}"` : ''}.`,
        instruction_to_ai:
          'Use the returned `line` numbers with `readFile` (`startLine`/`endLine`) or `updateFile` (`startLine`/`endLine` or `search`/`replace`) for surgical edits.'
      }
    } catch (err: any) {
      return {
        success: false,
        error: err.message || 'Failed to search workspace with grepWorkspace.'
      }
    }
  }
})
