import * as aiSdk from 'ai'
import type { AIToolExecutionResult } from '../types/ai.types'

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
      const cleanPath = (path || '').trim().replace(/^[/\\]+|[/\\]+$/g, '')
      if (!cleanPath) {
        return { success: false, error: 'Folder path cannot be empty.' }
      }

      if ((window as any).api?.deleteFolder) {
        await (window as any).api.deleteFolder(cleanPath)
      }

      const { useWorkspaceStore } = await import('../../../core/store/workspaceStore')
      const vs = (useWorkspaceStore as any).getState()
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
