import * as aiSdk from 'ai'
import type { AIToolExecutionResult } from '../types/ai.types'

interface CreateFolderInput {
  path: string
}

export const createFolderTool = aiSdk.tool({
  description:
    'Create a new folder in the workspace. IMPORTANT: If the user asked to create a folder AND notes/plans/expenses/summaries inside or outside of it, you must output a narration line for each file and call createFile for each requested note. Do not stop after creating only the folder.',
  inputSchema: aiSdk.jsonSchema<CreateFolderInput>({
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: 'The folder name or relative path to create (e.g. "Science", "Mathematics", "Projects/Frontend")'
      }
    },
    required: ['path']
  }),
  execute: async ({ path }): Promise<AIToolExecutionResult> => {
    try {
      const cleanPath = (path || '')
        .trim()
        .replace(/\\/g, '/')
        .replace(/^\/+|\/+$/g, '')
      if (!cleanPath) {
        return { success: false, error: 'Folder path cannot be empty.' }
      }

      if ((window as any).api?.createFolder) {
        await (window as any).api.createFolder(cleanPath)
      }

      const { useWorkspaceStore } = await import('../../../core/store/workspaceStore')
      const vs = (useWorkspaceStore as any).getState()
      if (vs.addFolder) {
        vs.addFolder(cleanPath)
      }
      if (vs.loadWorkspace) {
        await vs.loadWorkspace()
      }

      window.dispatchEvent(
        new CustomEvent('reveal-folder-in-explorer', {
          detail: { folderId: cleanPath }
        })
      )

      return {
        success: true,
        path: cleanPath,
        summary: `📁 Created folder \`${cleanPath}\``,
        instruction_to_ai: `Folder "${cleanPath}" created successfully. Now in chat, speak and acknowledge that folder "${cleanPath}" is created, narrate what the first note is, and invoke createFile for it. Continue creating all requested files!`
      }
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to create folder' }
    }
  }
})
