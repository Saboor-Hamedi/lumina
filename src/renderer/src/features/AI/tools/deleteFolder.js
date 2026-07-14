import * as aiSdk from 'ai'

export const deleteFolderTool = aiSdk.tool({
  description: 'Delete a folder and ALL its contents from the vault.',
  inputSchema: aiSdk.jsonSchema({
    type: 'object',
    properties: { path: { type: 'string', description: 'The folder path to delete' } },
    required: ['path']
  }),
  execute: async ({ path }) => {
    try {
      await window.api.deleteFolder(path)
      const { useVaultStore } = await import('../../../core/store/useVaultStore')
      await useVaultStore.getState().loadVault()
      return { success: true, path, instruction_to_ai: `Folder "${path}" deleted successfully.` }
    } catch (err) {
      return { success: false, error: err.message }
    }
  }
})
