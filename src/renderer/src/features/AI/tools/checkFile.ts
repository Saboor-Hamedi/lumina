import * as aiSdk from 'ai'
import type { AIToolExecutionResult } from '../types/ai.types'

interface CheckFileInput {
  title?: string
}

export const checkFileTool = aiSdk.tool({
  description:
    'Check the currently active/focused file in the workspace or inspect details of any specific file. Returns title, word count, line count, folder, tags, and full content so the AI has 100% situational awareness.',
  inputSchema: aiSdk.jsonSchema<CheckFileInput>({
    type: 'object',
    properties: {
      title: {
        type: 'string',
        description: 'Optional file title to check. If omitted, checks the currently active file in the editor.'
      }
    }
  }),
  execute: async ({ title } = {}): Promise<AIToolExecutionResult> => {
    try {
      const { useWorkspaceStore } = await import('../../../core/store/workspaceStore')
      const vs = (useWorkspaceStore as any).getState()
      const snippets = vs.notes || []

      let target: any = null
      if (title && title.trim()) {
        const cleanTitle = title.trim().toLowerCase().replace(/\.md$/, '')
        target = snippets.find((s: any) => (s.title || '').toLowerCase().replace(/\.md$/, '') === cleanTitle)
        if (!target) {
          target = snippets.find((s: any) => (s.title || '').toLowerCase().includes(cleanTitle))
        }
      } else {
        target = vs.selectedNote || (vs.activeTabId ? snippets.find((s: any) => s.id === vs.activeTabId) : null)
      }

      if (!target) {
        return {
          success: false,
          error: title ? `File "${title}" not found.` : 'No file is currently open in the editor.',
          instruction_to_ai: 'No active file found. Provide the answer directly in chat.'
        }
      }

      const currentCode =
        vs.drafts?.[target.id] !== undefined ? vs.drafts[target.id] : target.code || ''
      const lines = currentCode.split('\n')
      const wordCount = currentCode.trim() ? currentCode.trim().split(/\s+/).length : 0
      const charCount = currentCode.length

      return {
        success: true,
        summary: `📄 Analyzed \`${target.title}\``,
        file: {
          id: target.id,
          title: target.title,
          folderId: target.folderId || null,
          tags: target.tags || '',
          language: target.language || 'markdown',
          totalLines: lines.length,
          wordCount,
          charCount,
          isActiveFile: vs.selectedNote?.id === target.id,
          content: currentCode
        },
        instruction_to_ai:
          'You have the full file details. Now immediately write the full substantive response or edits for the user without any filler preamble.'
      }
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to check file' }
    }
  }
})
