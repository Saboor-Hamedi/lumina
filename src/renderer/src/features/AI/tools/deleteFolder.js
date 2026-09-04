import * as aiSdk from 'ai'

export const deleteFolderTool = aiSdk.tool({
  description:
    'Delete an existing folder and all its contents from the workspace. Use this when the user asks to delete or remove a folder (e.g. "Delete the Science folder", "Remove Projects/Old").',
  inputSchema: aiSdk.jsonSchema({
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: 'The folder name or relative path to delete (e.g. "Science", "Projects/Old")'
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

      if (window.api?.deleteFolder) {
        await window.api.deleteFolder(cleanPath)
      }

      const { useVaultStore } = await import('../../../core/store/workspaceStore')
      const vs = useVaultStore.getState()
      if (vs.loadVault) {
        await vs.loadVault()
      }

      return {
        success: true,
        path: cleanPath,
        summary: `Deleted folder **${cleanPath}**.`,
        instruction_to_ai: `Folder "${cleanPath}" was deleted successfully. Confirm to user.`
      }
    } catch (err) {
      return { success: false, error: err.message || 'Failed to delete folder' }
    }
  }
})
