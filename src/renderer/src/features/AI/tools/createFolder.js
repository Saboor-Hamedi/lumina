import * as aiSdk from 'ai'

export const createFolderTool = aiSdk.tool({
  description:
    'Create a new folder or directory in the workspace. Use this whenever the user asks to create, make, or set up a new folder (e.g. "Science", "Projects/Frontend", "Mathematics").',
  inputSchema: aiSdk.jsonSchema({
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: 'The folder name or relative path to create (e.g. "Science", "Mathematics", "Projects/Frontend")'
      }
    },
    required: ['path']
  }),
  execute: async ({ path }) => {
    try {
      const cleanPath = (path || '').trim().replace(/^[/\\]+|[/\\]+$/g, '')
      if (!cleanPath) {
        return { success: false, error: 'Folder path cannot be empty.' }
      }

      if (window.api?.createFolder) {
        await window.api.createFolder(cleanPath)
      }

      const { useVaultStore } = await import('../../../core/store/workspaceStore')
      const vs = useVaultStore.getState()
      if (vs.loadVault) {
        await vs.loadVault()
      }

      return {
        success: true,
        path: cleanPath,
        summary: `Created folder **${cleanPath}**.`,
        instruction_to_ai: `Folder "${cleanPath}" created successfully.`
      }
    } catch (err) {
      return { success: false, error: err.message || 'Failed to create folder' }
    }
  }
})
