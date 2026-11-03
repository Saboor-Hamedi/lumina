import * as aiSdk from 'ai'
import type { AIToolExecutionResult } from '../types/ai.types'
import { confirmWorkspaceChange } from './confirmWorkspaceChange'

interface DeleteFolderInput {
  path: string
}

export const deleteFolderTool = aiSdk.tool({
  description:
    'Delete an existing folder and all its contents from the workspace. Use this when the user asks to delete or remove a folder (e.g. "Delete the Science folder", "Remove Projects/Old").',
  inputSchema: aiSdk.jsonSchema<DeleteFolderInput>({
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: 'The folder name or relative path to delete (e.g. "Science", "Projects/Old")'
      }
    },
    required: ['path']
  }),
  execute: async ({ path }): Promise<AIToolExecutionResult> => {
    try {
      const rawPath = (path || '').trim().replace(/\\/g, '/').replace(/^\/+|\/+$/g, '')
      if (!rawPath) {
        return { success: false, error: 'Folder path cannot be empty.' }
      }

      const { useWorkspaceStore } = await import('../../../core/store/workspaceStore')
      const { collectWorkspaceFolders, matchFolderByQuery } = await import(
        '../services/prompt/mentionResolver'
      )
      const vs = (useWorkspaceStore as any).getState()
      const notes = (Array.isArray(vs.notes) && vs.notes.length > 0 ? vs.notes : vs.snippets) || []
      const knownFolders = collectWorkspaceFolders(notes, vs.folders || [])
      const cleanPath = matchFolderByQuery(rawPath, knownFolders) || rawPath

      const itemCount = notes.filter((note: any) => {
        const folder = String(note?.folderId || '').replace(/\\/g, '/').replace(/^\/+|\/+$/g, '')
        return folder === cleanPath || folder.startsWith(`${cleanPath}/`)
      }).length
      const confirmed = await confirmWorkspaceChange(
        'delete',
        cleanPath,
        `This permanently removes the folder and its ${itemCount} note${itemCount === 1 ? '' : 's'}.`
      )
      if (!confirmed) return { success: false, error: 'Folder deletion cancelled; nothing was changed.', cancelled: true }

      if ((window as any).api?.deleteFolder) {
        await (window as any).api.deleteFolder(cleanPath)
      }

      if (vs.loadWorkspace) {
        await vs.loadWorkspace()
      }

      return {
        success: true,
        path: cleanPath,
        summary: `Deleted folder **${cleanPath}**.`,
        instruction_to_ai: `Folder "${cleanPath}" was deleted successfully. Confirm to user.`
      }
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to delete folder' }
    }
  }
})
