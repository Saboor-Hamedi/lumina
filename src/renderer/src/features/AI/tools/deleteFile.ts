import * as aiSdk from 'ai'
import type { AIToolExecutionResult } from '../types/ai.types'

interface DeleteFileInput {
  title: string
  folder?: string
}

export const deleteFileTool = aiSdk.tool({
  description:
    'Delete a note file from the workspace. Use this whenever the user asks to delete or remove a note (e.g. "Delete Thermodynamics", "Remove this note", "Delete current file").',
  inputSchema: aiSdk.jsonSchema<DeleteFileInput>({
    type: 'object',
    properties: {
      title: {
        type: 'string',
        description: 'The title, filename, or "Folder/Title" path of the note to delete. Use "current" or "active" to delete the open note.'
      },
      folder: {
        type: 'string',
        description: 'Optional workspace folder path containing the note to delete.'
      }
    },
    required: ['title']
  }),
  execute: async ({ title, folder }): Promise<AIToolExecutionResult> => {
    try {
      const rawTitle = (title || '').trim().replace(/^@/, '').replace(/\\/g, '/')
      const { useWorkspaceStore } = await import('../../../core/store/workspaceStore')
      const { normalizeTitle } = await import('../services/prompt/mentionResolver')
      const vs = (useWorkspaceStore as any).getState()
      const snippets = (Array.isArray(vs.notes) && vs.notes.length > 0 ? vs.notes : vs.snippets) || []

      let cleanFolder = (folder || '').trim().replace(/\\/g, '/').replace(/^\/+|\/+$/g, '').toLowerCase()
      let effectiveTitle = rawTitle
      if (rawTitle.includes('/')) {
        const parts = rawTitle.split('/').filter(Boolean)
        effectiveTitle = parts.pop() || rawTitle
        const pathFolder = parts.join('/').toLowerCase()
        cleanFolder = cleanFolder ? `${cleanFolder}/${pathFolder}` : pathFolder
      }

      const matchesFolder = (s: any) => {
        if (!cleanFolder) return true
        const nf = String(s?.folderId || '').replace(/\\/g, '/').replace(/^\/+|\/+$/g, '').toLowerCase()
        return nf === cleanFolder || nf.endsWith(`/${cleanFolder}`)
      }

      let target: any = null
      if (
        !effectiveTitle ||
        effectiveTitle.toLowerCase() === 'current' ||
        effectiveTitle.toLowerCase() === 'active' ||
        effectiveTitle.toLowerCase() === 'this' ||
        effectiveTitle.toLowerCase() === 'this note' ||
        effectiveTitle.toLowerCase() === 'this file'
      ) {
        target =
          vs.selectedNote ||
          vs.selectedSnippet ||
          (vs.activeTabId ? snippets.find((s: any) => s.id === vs.activeTabId) : null)
      } else {
        const cleanLower = effectiveTitle.toLowerCase().replace(/\.md$/i, '')
        target = snippets.find(
          (s: any) =>
            matchesFolder(s) &&
            ((s.title || '').toLowerCase().replace(/\.md$/i, '') === cleanLower ||
              normalizeTitle(s.title) === normalizeTitle(cleanLower))
        )
        if (!target) {
          target = snippets.find(
            (s: any) =>
              matchesFolder(s) &&
              (s.fileName || '').toLowerCase().replace(/\.md$/i, '') === cleanLower
          )
        }
        if (!target && cleanFolder) {
          target = snippets.find(
            (s: any) => (s.title || '').toLowerCase().replace(/\.md$/i, '') === cleanLower
          )
        }
        if (!target) {
          target = snippets.find(
            (s: any) => matchesFolder(s) && (s.title || '').toLowerCase().includes(cleanLower)
          )
        }
      }

      if (!target) {
        return { success: false, error: `Note "${rawTitle || 'current'}" not found.` }
      }

      const deletedTitle = target.title || target.fileName || effectiveTitle
      const deletedFolder = target.folderId || ''
      const previousContent = target.code || ''
      const removedWords = previousContent.trim() ? previousContent.trim().split(/\s+/).length : 0
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
        id: target.id,
        title: deletedTitle,
        folderId: deletedFolder,
        previousContent,
        removedWords,
        summary: `🗑️ Deleted [[${deletedTitle}]] (-${removedWords})`,
        instruction_to_ai: `Note "${deletedTitle}" was deleted successfully. Confirm to user.`
      }
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to delete file' }
    }
  }
})
