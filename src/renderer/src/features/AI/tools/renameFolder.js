import * as aiSdk from 'ai'

export const renameFolderTool = aiSdk.tool({
  description: '',
  inputSchema: aiSdk.jsonSchema({
    type: 'object',
    properties: {
      oldPath: { type: 'string', description: 'The current folder path' },
      newPath: { type: 'string', description: 'The new folder path' }
    },
    required: ['oldPath', 'newPath']
  }),
  execute: async ({ oldPath, newPath }) => {
    try {
      if (window.api && window.api.renameFolder) {
        await window.api.renameFolder(oldPath, newPath)
      } else {
        return { success: false, error: 'renameFolder API is not available' }
      }
      const { useVaultStore } = await import('../../../core/store/workspaceStore')
      await useVaultStore.getState().loadVault()
      return {
        success: true,
        oldPath,
        newPath,
        instruction_to_ai: `Folder "${oldPath}" renamed to "${newPath}" successfully.`
      }
    } catch (err) {
      return { success: false, error: err.message }
    }
  }
})
