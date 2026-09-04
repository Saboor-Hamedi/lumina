import * as aiSdk from 'ai'

export const renameFolderTool = aiSdk.tool({
  description:
    'Rename an existing folder in the workspace to a new name or path. Use this when the user asks to rename a folder (e.g. "Rename folder Science to Natural Sciences").',
  inputSchema: aiSdk.jsonSchema({
    type: 'object',
    properties: {
      oldPath: {
        type: 'string',
        description: 'The current folder name or path (e.g. "Science", "Projects/V1")'
      },
      newPath: {
        type: 'string',
        description: 'The new folder name or path (e.g. "Natural Sciences", "Projects/V2")'
      }
    },
    required: ['oldPath', 'newPath']
  }),
  execute: async ({ oldPath, newPath }) => {
    try {
      const cleanOld = (oldPath || '').trim().replace(/^[/\\]+|[/\\]+$/g, '')
      const cleanNew = (newPath || '').trim().replace(/^[/\\]+|[/\\]+$/g, '')

      if (!cleanOld || !cleanNew) {
        return { success: false, error: 'Both old and new folder paths are required.' }
      }

      if (window.api?.renameFolder) {
        await window.api.renameFolder(cleanOld, cleanNew)
      } else {
        return { success: false, error: 'renameFolder API is not available' }
      }

      const { useVaultStore } = await import('../../../core/store/workspaceStore')
      const vs = useVaultStore.getState()
      if (vs.loadVault) {
        await vs.loadVault()
      }

      return {
        success: true,
        oldPath: cleanOld,
        newPath: cleanNew,
        summary: `Renamed folder **${cleanOld}** to **${cleanNew}**.`,
        instruction_to_ai: `Folder "${cleanOld}" renamed to "${cleanNew}" successfully.`
      }
    } catch (err) {
      return { success: false, error: err.message || 'Failed to rename folder' }
    }
  }
})
