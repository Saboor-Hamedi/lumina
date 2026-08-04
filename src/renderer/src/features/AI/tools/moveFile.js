import * as aiSdk from 'ai'

export const moveFileTool = aiSdk.tool({
  description: 'Move a file into a specific folder.',
  inputSchema: aiSdk.jsonSchema({
    type: 'object',
    properties: {
      title: { type: 'string', description: 'The file title to move' },
      newFolderId: {
        type: 'string',
        description:
          'The new folder path (e.g. "my-approach"). Use empty string "" to move to root.'
      }
    },
    required: ['title', 'newFolderId']
  }),
  execute: async ({ title, newFolderId }) => {
    const cleanTitle = title.startsWith('@') ? title.slice(1) : title
    const { useVaultStore } = await import('../../../core/store/useVaultStore')
    const vs = useVaultStore.getState()
    const snippets = Array.from(vs.snippets.values())
    let target = snippets.find((s) => s.title.toLowerCase() === cleanTitle.toLowerCase())
    if (!target) {
      target = snippets.find((s) => s.title.toLowerCase().includes(cleanTitle.toLowerCase()))
    }
    if (!target) return { success: false, error: 'File not found' }

    await vs.saveSnippet({ ...target, folderId: newFolderId })
    await vs.loadVault()
    return {
      success: true,
      title: target.title,
      newFolderId,
      instruction_to_ai: `File moved to folder "${newFolderId}" successfully.`
    }
  }
})
