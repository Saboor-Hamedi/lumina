import * as aiSdk from 'ai'
import type { AIToolExecutionResult } from '../types/ai.types'

interface OpenFileInput {
  title: string
}

export const openFileTool = aiSdk.tool({
  description: "Open a note file in the user's editor tab so they can view and edit it.",
  inputSchema: aiSdk.jsonSchema<OpenFileInput>({
    type: 'object',
    properties: {
      title: { type: 'string', description: 'The file title or name to open' }
    },
    required: ['title']
  }),
  execute: async ({ title }): Promise<AIToolExecutionResult> => {
    try {
      const cleanTitle = (title || '').trim().replace(/^@/, '')
      const { useWorkspaceStore } = await import('../../../core/store/workspaceStore')
      const vs = (useWorkspaceStore as any).getState()
      const notes = vs.notes || []

      const normalize = (t: string) => (t || '').toLowerCase().replace(/\.md$/i, '').trim()
      let target = notes.find((s: any) => normalize(s.title) === normalize(cleanTitle))
      if (!target) {
        target = notes.find((s: any) => normalize(s.fileName) === normalize(cleanTitle))
      }
      if (!target) {
        target = notes.find((s: any) => normalize(s.title).includes(normalize(cleanTitle)))
      }

      if (!target) {
        return { success: false, error: `Note "${title}" not found.` }
      }

      if (vs.setSelectedNote) {
        vs.setSelectedNote(target)
      }
      if (vs.setActiveTabId) {
        vs.setActiveTabId(target.id)
      }

      return {
        success: true,
        title: target.title,
        instruction_to_ai: `File "${target.title}" is now open in the editor. Tell the user you have opened it for them.`
      }
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to open file' }
    }
  }
})
