import * as aiSdk from 'ai'

export const deleteFileTool = aiSdk.tool({
  description: 'Delete a file from the vault.',
  inputSchema: aiSdk.jsonSchema({
    type: 'object',
    properties: {
      title: { type: 'string', description: 'The file title' }
    },
    required: ['title']
  }),
  execute: async ({ title }) => {
    const cleanTitle = title.startsWith('@') ? title.slice(1) : title
    const { useVaultStore } = await import('../../../core/store/useVaultStore')
    const vs = useVaultStore.getState()
    const snippets = Array.from(vs.snippets.values())
    let target = snippets.find((s) => s.title.toLowerCase() === cleanTitle.toLowerCase())
    if (!target) {
      target = snippets.find((s) => s.title.toLowerCase().includes(cleanTitle.toLowerCase()))
    }
    if (target) {
      await vs.deleteSnippet(target.id, true)
      return { success: true, title }
    }
    return { success: false, error: 'File not found' }
  }
})
