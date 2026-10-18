import * as aiSdk from 'ai'
import type { AIToolExecutionResult } from '../types/ai.types'

interface ReadFileInput {
  title: string
  folder?: string
  startLine?: number
  endLine?: number
  includeLineNumbers?: boolean
}

export const getReadFileTool = (blockReadFile?: boolean) => {
  if (blockReadFile) return undefined

  return aiSdk.tool({
    description:
      'Read the contents of an existing file (optionally scoped by folder, startLine, and endLine). Only use when file content is not already in the prompt or context.',
    inputSchema: aiSdk.jsonSchema<ReadFileInput>({
      type: 'object',
      properties: {
        title: { type: 'string', description: 'The file title or "Folder/Title" path to read' },
        folder: { type: 'string', description: 'Optional workspace folder path containing the file' },
        startLine: { type: 'number', description: 'Optional 1-indexed start line to read' },
        endLine: { type: 'number', description: 'Optional 1-indexed end line (inclusive) to read' },
        includeLineNumbers: { type: 'boolean', description: 'If true, prefixes each line with its 1-indexed line number' }
      },
      required: ['title']
    }),
    execute: async ({ title, folder, startLine, endLine, includeLineNumbers }): Promise<AIToolExecutionResult> => {
      const { useWorkspaceStore } = await import('../../../core/store/workspaceStore')
      const { collectWorkspaceFolders, matchFolderByQuery, getNotesInFolder, normalizeTitle } =
        await import('../services/prompt/mentionResolver')
      const vs = (useWorkspaceStore as any).getState()
      const snippets = (Array.isArray(vs.notes) && vs.notes.length > 0 ? vs.notes : vs.snippets) || []
      const knownFolders = collectWorkspaceFolders(snippets, vs.folders || [])

      const rawFolder = (folder || '').trim().toLowerCase().replace(/\\/g, '/').replace(/^\/+|\/+$/g, '')
      const normalizedInput = (title || '').trim().toLowerCase().replace(/^@/, '').replace(/\\/g, '/').replace(/\.md$/, '')
      const baseName = normalizedInput.split('/').pop() || normalizedInput
      const rawEffectiveFolder = rawFolder || (normalizedInput.includes('/') ? normalizedInput.slice(0, normalizedInput.lastIndexOf('/')) : '')
      const resolvedEffectiveFolder = rawEffectiveFolder
        ? (matchFolderByQuery(rawEffectiveFolder, knownFolders) || rawEffectiveFolder).toLowerCase()
        : ''

      let target = snippets.find((s: any) => {
        const noteFolder = (s.folderId || '').toLowerCase().replace(/\\/g, '/').replace(/^\/+|\/+$/g, '')
        const noteTitle = (s.title || '').toLowerCase().replace(/\.md$/, '')
        const fullPath = noteFolder ? `${noteFolder}/${noteTitle}` : noteTitle
        if (resolvedEffectiveFolder) {
          return (
            (noteFolder === resolvedEffectiveFolder || noteFolder === rawEffectiveFolder) &&
            (noteTitle === baseName || normalizeTitle(noteTitle) === normalizeTitle(baseName))
          )
        }
        return fullPath === normalizedInput || noteTitle === normalizedInput
      })

      if (!target && baseName) {
        target = snippets.find(
          (s: any) =>
            (s.title || '').toLowerCase().replace(/\.md$/, '') === baseName ||
            normalizeTitle(s.title) === normalizeTitle(baseName)
        )
      }

      if (!target && baseName) {
        target = snippets.find((s: any) => {
          const noteTitle = (s.title || '').toLowerCase()
          return noteTitle.includes(baseName) || baseName.includes(noteTitle)
        })
      }

      if (!target) {
        // Check if the requested title is actually a workspace folder (e.g. "entrichment" or "enrichment")
        const matchedFolder = matchFolderByQuery(rawFolder || title, knownFolders)
        if (matchedFolder) {
          const folderNotes = getNotesInFolder(matchedFolder, snippets)
          if (folderNotes.length > 0) {
            const perFileBudget = Math.max(3000, Math.floor(40000 / folderNotes.length))
            const combined = folderNotes
              .map((n: any) => {
                const code = (vs.drafts?.[n.id] !== undefined ? vs.drafts[n.id] : n.code || '').slice(
                  0,
                  perFileBudget
                )
                return `### 📄 ${matchedFolder}/${n.title}\n\n${code}`
              })
              .join('\n\n---\n\n')
            return {
              success: true,
              title: matchedFolder,
              folder: matchedFolder,
              folderId: matchedFolder,
              fileCount: folderNotes.length,
              files: folderNotes.map((n: any) => n.title),
              content: combined,
              writtenContent: `### 📁 Folder \`${matchedFolder}\` (${folderNotes.length} files)\n\n${combined}`,
              summary: `📁 Read ${folderNotes.length} files in \`${matchedFolder}\``,
              instruction_to_ai: `Folder "${matchedFolder}" contains ${folderNotes.length} files (${folderNotes.map((n: any) => n.title).join(', ')}). Their contents are provided above. Respond directly based on this content.`
            }
          }
        }

        const { getBrainFile, retrieveRelevantKnowledge } = await import('../services/brainKnowledge')
        let brainDoc = getBrainFile(title)
        if (!brainDoc) {
          const results = await retrieveRelevantKnowledge(title, 1)
          if (results.length > 0) {
            brainDoc = results[0]
          }
        }
        if (brainDoc) {
          const rawCode = brainDoc.content || ''
          const MAX_READ_CHARS = 25000
          const isTruncated = rawCode.length > MAX_READ_CHARS
          const safeCode = isTruncated
            ? rawCode.slice(0, MAX_READ_CHARS) + `\n\n*(Content truncated for performance)*`
            : rawCode
          return {
            success: true,
            title: brainDoc.breadcrumb || `brain/${brainDoc.path}`,
            content: safeCode,
            writtenContent: `### 🧠 ${brainDoc.breadcrumb || `brain/${brainDoc.path}`}\n\n${safeCode}`,
            instruction_to_ai:
              'Brain file read successfully. You MUST now respond to the user and answer based on this content.'
          }
        }
        return { success: false, error: `File "${title}" not found.` }
      }

      const rawCode =
        vs.drafts?.[target.id] !== undefined ? vs.drafts[target.id] : target.code || ''
      const allLines = rawCode.split('\n')
      const totalLines = allLines.length
      const hasLineSlice = typeof startLine === 'number' || typeof endLine === 'number'
      const safeStart = Math.max(1, Math.min(totalLines || 1, Number(startLine) || 1))
      const safeEnd = Math.max(safeStart, Math.min(totalLines || 1, Number(endLine) || totalLines || 1))
      const selectedLines = hasLineSlice ? allLines.slice(safeStart - 1, safeEnd) : allLines
      const formattedCode = includeLineNumbers
        ? selectedLines.map((line: string, idx: number) => `${safeStart + idx}: ${line}`).join('\n')
        : selectedLines.join('\n')

      const MAX_READ_CHARS = 25000
      const isTruncated = formattedCode.length > MAX_READ_CHARS
      const safeCode = isTruncated
        ? formattedCode.slice(0, MAX_READ_CHARS) +
          `\n\n*(Content truncated for performance: showing first 25,000 of ${formattedCode.length} characters. Use startLine/endLine or sectionHeader to read specific parts.)*`
        : formattedCode

      const rangeSuffix = hasLineSlice ? ` (lines ${safeStart}–${safeEnd} of ${totalLines})` : ''

      return {
        success: true,
        id: target.id,
        title: target.title,
        folder: target.folderId || '',
        folderId: target.folderId || '',
        totalLines,
        startLine: safeStart,
        endLine: safeEnd,
        content: safeCode,
        writtenContent: `### 📄 ${target.title}${rangeSuffix}\n\n${safeCode}`,
        summary: `📄 Analyzed \`${target.title}\`${rangeSuffix}`,
        instruction_to_ai:
          'File read successfully. You MUST now respond to the user and answer based on this content.'
      }
    }
  })
}
