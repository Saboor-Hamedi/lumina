import * as aiSdk from 'ai'
import type { AIToolExecutionResult } from '../types/ai.types'

interface DeleteFileInput {
  title: string
}

export const deleteFileTool = aiSdk.tool({
  description:
    'Delete a note file from the workspace. Use this whenever the user asks to delete or remove a note (e.g. "Delete Thermodynamics", "Remove this note", "Delete current file").',
  inputSchema: aiSdk.jsonSchema<DeleteFileInput>({
    type: 'object',
    properties: {
      title: {
        type: 'string',
        description: 'The title or filename of the note to delete. Use "current" or "active" to delete the open note.'
      }
    },
    required: ['title']
  }),
  execute: async ({ title }): Promise<AIToolExecutionResult> => {
    try {
      const rawTitle = (title || '').trim().replace(/^@/, '')
      const { useWorkspaceStore } = await import('../../../core/store/workspaceStore')
      const vs = (useWorkspaceStore as any).getState()
      const snippets = vs.notes || []

      let target: any = null
      if (
        !rawTitle ||
        rawTitle.toLowerCase() === 'current' ||
        rawTitle.toLowerCase() === 'active' ||
        rawTitle.toLowerCase() === 'this' ||
        rawTitle.toLowerCase() === 'this note' ||
        rawTitle.toLowerCase() === 'this file'
      ) {
        target = vs.selectedNote || (vs.activeTabId ? snippets.find((s: any) => s.id === vs.activeTabId) : null)
      } else {
        const cleanLower = rawTitle.toLowerCase().replace(/\.md$/i, '')
        target = snippets.find(
          (s: any) => (s.title || '').toLowerCase().replace(/\.md$/i, '') === cleanLower
        )
        if (!target) {
          target = snippets.find(
            (s: any) => (s.fileName || '').toLowerCase().replace(/\.md$/i, '') === cleanLower
          )
        }
        if (!target) {
          target = snippets.find((s: any) =>
            (s.title || '').toLowerCase().includes(cleanLower)
          )
        }
      }

      if (!target) {
        return { success: false, error: `Note "${rawTitle || 'current'}" not found.` }
      }

      const deletedTitle = target.title || target.fileName || rawTitle
      const removedWords = (target.code || '').trim() ? (target.code || '').trim().split(/\s+/).length : 0
      const deleteAction = vs.deleteNote || vs.deleteSnippet
      if (deleteAction) {
        await deleteAction(target.id, true)
      }

      if ((window as any).api?.deleteChunks) {
        await (window as any).api.deleteChunks(deletedTitle)
      }

      if (vs.closeTab) {
        vs.closeTab(target.id)
      }

      if (vs.loadWorkspace) {
        await vs.loadWorkspace()
      }

      return {
        success: true,
        title: deletedTitle,
        summary: `🗑️ Deleted [[${deletedTitle}]] (-${removedWords || 1})`,
        instruction_to_ai: `Note "${deletedTitle}" was deleted successfully. Confirm to user.`
      }
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to delete file' }
    }
  }
})
