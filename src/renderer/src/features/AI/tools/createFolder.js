import * as aiSdk from 'ai'

export const createFolderTool = aiSdk.tool({
  description: '',
  inputSchema: aiSdk.jsonSchema({
    type: 'object',
    properties: {
      path: { type: 'string', description: 'The folder path to create (e.g. "my-approach")' }
    },
    required: ['path']
  }),
  execute: async ({ path }) => {
    try {
      await window.api.createFolder(path)
      // Trigger a vault rescan so the UI updates with the new folder immediately
      const { useVaultStore } = await import('../../../core/store/workspaceStore')
      await useVaultStore.getState().loadVault()
      return { success: true, path, instruction_to_ai: `Folder "${path}" created successfully.` }
    } catch (err) {
      return { success: false, error: err.message }
    }
  }
})
