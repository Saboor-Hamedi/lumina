import * as aiSdk from 'ai'
import type { AIToolExecutionResult } from '../types/ai.types'

interface CheckFileInput {
  title?: string
  folder?: string
  startLine?: number
  endLine?: number
  includeLineNumbers?: boolean
}

function extractHeadingOutline(lines: string[]): Array<{ level: number; text: string; startLine: number; endLine: number }> {
  const headings: Array<{ level: number; text: string; startLine: number; endLine: number }> = []
  let inCodeFence = false

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (/^\s*```/.test(line)) {
      inCodeFence = !inCodeFence
      continue
    }
    if (inCodeFence) continue

    const match = line.match(/^(#{1,6})\s+(.+?)\s*$/)
    if (match) {
      headings.push({
        level: match[1].length,
        text: match[2].trim(),
        startLine: i + 1,
        endLine: lines.length
      })
    }
  }

  for (let i = 0; i < headings.length; i++) {
    const current = headings[i]
    for (let j = i + 1; j < headings.length; j++) {
      if (headings[j].level <= current.level) {
        current.endLine = headings[j].startLine - 1
        break
      }
    }
  }

  return headings
}

export const checkFileTool = aiSdk.tool({
  description:
    'Inspect the currently active/focused file or any specific file in the workspace. Returns metadata (title, folder, word/line counts, heading outline with exact startLine/endLine boundaries, outgoing wikilinks, incoming backlinks) and content (optionally scoped to startLine..endLine with 1-indexed line numbers).',
  inputSchema: aiSdk.jsonSchema<CheckFileInput>({
    type: 'object',
    properties: {
      title: {
        type: 'string',
        description: 'Optional file title or "Folder/Title" path to check. If omitted or "current", checks the active file in the editor.'
      },
      folder: {
        type: 'string',
        description: 'Optional workspace folder path to disambiguate notes with the same title.'
      },
      startLine: {
        type: 'number',
        description: 'Optional 1-indexed start line to inspect a specific slice of the file.'
      },
      endLine: {
        type: 'number',
        description: 'Optional 1-indexed end line (inclusive) to inspect a specific slice of the file.'
      },
      includeLineNumbers: {
        type: 'boolean',
        description: 'If true, prefixes each returned line with its 1-indexed line number (e.g. "12: content").'
      }
    }
  }),
  execute: async ({ title, folder, startLine, endLine, includeLineNumbers } = {}): Promise<AIToolExecutionResult> => {
    try {
      const { useWorkspaceStore } = await import('../../../core/store/workspaceStore')
      const vs = (useWorkspaceStore as any).getState()
      const snippets = vs.notes || vs.snippets || []

      let rawTitle = (title || '').trim().replace(/^@/, '').replace(/\\/g, '/')
      let rawFolder = (folder || '').trim().replace(/\\/g, '/').replace(/^\/+|\/+$/g, '')

      if (rawTitle.includes('/')) {
        const parts = rawTitle.split('/').filter(Boolean)
        rawTitle = parts.pop() || ''
        const pathFolder = parts.join('/')
        if (!rawFolder) rawFolder = pathFolder
      }

      const cleanTitle = rawTitle.toLowerCase().replace(/\.md$/i, '')
      const cleanFolder = /^(?:root|workspace root|vault root|project root|workspace|vault|\.)$/i.test(rawFolder)
        ? ''
        : rawFolder.toLowerCase()

      let target: any = null
      if (
        !cleanTitle ||
        cleanTitle === 'current' ||
        cleanTitle === 'active' ||
        cleanTitle === 'this' ||
        cleanTitle === 'this note' ||
        cleanTitle === 'this file'
      ) {
        const activeId = vs.selectedNote?.id || vs.activeTabId
        target = (activeId ? snippets.find((s: any) => s.id === activeId) : null) || vs.selectedNote
      } else {
        // 1. Exact folder + title match
        if (cleanFolder) {
          target = snippets.find((s: any) => {
            const sTitle = (s.title || '').toLowerCase().replace(/\.md$/i, '')
            const sFolder = (s.folderId || '').toLowerCase().replace(/\\/g, '/').replace(/^\/+|\/+$/g, '')
            return sTitle === cleanTitle && sFolder === cleanFolder
          })
        }
        // 2. Exact title match in snippets (prefer active note's ID if it matches)
        if (!target && vs.selectedNote && (vs.selectedNote.title || '').toLowerCase().replace(/\.md$/i, '') === cleanTitle) {
          target = snippets.find((s: any) => s.id === vs.selectedNote.id) || vs.selectedNote
        }
        if (!target) {
          target = snippets.find((s: any) => (s.title || '').toLowerCase().replace(/\.md$/i, '') === cleanTitle)
        }
        // 3. Partial title match
        if (!target) {
          target = snippets.find((s: any) => (s.title || '').toLowerCase().includes(cleanTitle))
        }
      }

      if (!target) {
        return {
          success: false,
          error: title ? `File "${title}" not found.` : 'No file is currently open in the editor.',
          instruction_to_ai: 'No matching file found. Provide the answer directly in chat or verify the file name.'
        }
      }

      const currentCode =
        vs.drafts?.[target.id] !== undefined ? vs.drafts[target.id] : target.code || ''
      const lines = currentCode.split('\n')
      const totalLines = lines.length
      const wordCount = currentCode.trim() ? currentCode.trim().split(/\s+/).length : 0
      const charCount = currentCode.length

      const outline = extractHeadingOutline(lines)
      const outgoingLinks = Array.from(
        new Set(
          (currentCode.match(/\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g) || []).map((w: string) =>
            w.replace(/^\[\[|\]\]$/g, '').split('|')[0].trim()
          )
        )
      )

      const targetTitleLower = (target.title || '').toLowerCase().replace(/\.md$/i, '')
      const backlinks: string[] = []
      const backlinkTitles: string[] = []
      for (const s of snippets) {
        if (!s || s.id === target.id) continue
        const code = String(s.code || '')
        if (code.toLowerCase().includes(`[[${targetTitleLower}`)) {
          backlinks.push(s.folderId ? `${s.folderId}/${s.title}` : s.title)
          backlinkTitles.push(s.title)
        }
      }

      const hasLineSlice = typeof startLine === 'number' || typeof endLine === 'number'
      const safeStart = Math.max(1, Math.min(totalLines || 1, Number(startLine) || 1))
      const safeEnd = Math.max(safeStart, Math.min(totalLines || 1, Number(endLine) || totalLines || 1))
      const slicedLines = hasLineSlice ? lines.slice(safeStart - 1, safeEnd) : lines
      const rawSlicedContent = slicedLines.join('\n')
      const numberedContent = slicedLines
        .map((line: string, idx: number) => `${safeStart + idx}: ${line}`)
        .join('\n')

      const rangeLabel = hasLineSlice ? ` (lines ${safeStart}–${safeEnd} of ${totalLines})` : ''
      const resolvedContent = includeLineNumbers ? numberedContent : rawSlicedContent

      return {
        success: true,
        exists: true,
        id: target.id,
        title: target.title,
        folder: target.folderId || '',
        folderId: target.folderId || '',
        lineCount: totalLines,
        totalLines,
        wordCount,
        charCount,
        outline,
        wikilinks: outgoingLinks,
        backlinks: backlinkTitles,
        backlinkPaths: backlinks,
        content: resolvedContent,
        summary: `📄 Analyzed \`${target.title}\`${rangeLabel}`,
        file: {
          id: target.id,
          title: target.title,
          folderId: target.folderId || null,
          path: target.folderId ? `${target.folderId}/${target.title}` : target.title,
          tags: target.tags || '',
          language: target.language || 'markdown',
          totalLines,
          wordCount,
          charCount,
          startLine: safeStart,
          endLine: safeEnd,
          isActiveFile: vs.selectedNote?.id === target.id,
          outline,
          outgoingLinks,
          backlinks,
          content: resolvedContent,
          numberedContent
        },
        instruction_to_ai:
          'You have the file metadata, heading outline (with startLine/endLine), and content. Now write the substantive response or apply surgical edits with updateFile.'
      }
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to check file' }
    }
  }
})
