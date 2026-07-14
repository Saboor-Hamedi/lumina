import * as aiSdk from 'ai'

export const openFileTool = aiSdk.tool({
  description: "Open a file in the user's editor tab so they can view it.",
  inputSchema: aiSdk.jsonSchema({
    type: 'object',
    properties: { title: { type: 'string', description: 'The file title to open' } },
    required: ['title']
  }),
  execute: async ({ title }) => {
    const cleanTitle = title.startsWith('@') ? title.slice(1) : title
    const { useVaultStore } = await import('../../../core/store/useVaultStore')
    const vs = useVaultStore.getState()
    const snippets = Array.from(vs.snippets.values())
    let target = snippets.find((s) => s.title.toLowerCase() === cleanTitle.toLowerCase())
    if (!target) target = snippets.find((s) => s.title.toLowerCase().includes(cleanTitle.toLowerCase()))
    
    if (!target) return { success: false, error: 'File not found' }
    
    vs.setSelectedSnippet(target)
    vs.setActiveTabId(target.id)
    
    return { success: true, title: target.title, instruction_to_ai: `File "${target.title}" is now open in the editor. Tell the user you have opened it for them.` }
  }
})
