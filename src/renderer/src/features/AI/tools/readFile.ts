import * as aiSdk from 'ai'
import type { AIToolExecutionResult } from '../types/ai.types'

interface ReadFileInput {
  title: string
}

export const getReadFileTool = (blockReadFile?: boolean) => {
  if (blockReadFile) return undefined

  return aiSdk.tool({
    description:
      'Read the contents of an existing file. Only use when file content is not already in the prompt or context.',
    inputSchema: aiSdk.jsonSchema<ReadFileInput>({
      type: 'object',
      properties: {
        title: { type: 'string', description: 'The file title to read' }
      },
      required: ['title']
    }),
    execute: async ({ title }): Promise<AIToolExecutionResult> => {
      const { useWorkspaceStore } = await import('../../../core/store/workspaceStore')
      const vs = (useWorkspaceStore as any).getState()
      const snippets = vs.notes || []

      const normalizedInput = title.trim().toLowerCase().replace(/\\/g, '/').replace(/\.md$/, '')
      const baseName = normalizedInput.split('/').pop() || normalizedInput

      let target = snippets.find((s: any) => {
        const noteFolder = (s.folderId || '').toLowerCase().replace(/\\/g, '/')
        const noteTitle = (s.title || '').toLowerCase().replace(/\.md$/, '')
        const fullPath = noteFolder ? `${noteFolder}/${noteTitle}` : noteTitle
        return fullPath === normalizedInput || noteTitle === normalizedInput
      })

      if (!target && baseName) {
        target = snippets.find((s: any) => (s.title || '').toLowerCase().replace(/\.md$/, '') === baseName)
      }

      if (!target) {
        target = snippets.find((s: any) => {
          const noteTitle = (s.title || '').toLowerCase()
          return noteTitle.includes(baseName) || baseName.includes(noteTitle)
        })
      }

      if (!target) {
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
      const MAX_READ_CHARS = 25000
      const isTruncated = rawCode.length > MAX_READ_CHARS
      const safeCode = isTruncated
        ? rawCode.slice(0, MAX_READ_CHARS) +
          `\n\n*(Content truncated for performance: showing first 25,000 of ${rawCode.length} characters. Use sectionHeader or targeted queries to read or update specific parts.)*`
        : rawCode

      return {
        success: true,
        title: target.title,
        content: safeCode,
        writtenContent: `### 📄 ${target.title}\n\n${safeCode}`,
        summary: `📄 Analyzed \`${target.title}\``,
        instruction_to_ai:
          'File read successfully. You MUST now respond to the user and answer based on this content.'
      }
    }
  })
}
