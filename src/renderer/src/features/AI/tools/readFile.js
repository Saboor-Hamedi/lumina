import * as aiSdk from 'ai'

export const getReadFileTool = (blockReadFile) => {
  if (blockReadFile) return undefined;

  return aiSdk.tool({
    description: 'Read the contents of an existing file. Only use when file content is not already in the prompt.',
    inputSchema: aiSdk.jsonSchema({
      type: 'object',
      properties: {
        title: { type: 'string', description: 'The file title' }
      },
      required: ['title']
    }),
    execute: async ({ title }) => {
      const { useVaultStore } = await import('../../../core/store/useVaultStore')
      const vs = useVaultStore.getState()
      const snippets = Array.from(vs.snippets.values())
      let target = snippets.find((s) => s.title.toLowerCase() === title.toLowerCase())
      if (!target) {
        target = snippets.find((s) => s.title.toLowerCase().includes(title.toLowerCase()))
      }
      if (!target) return { success: false, error: 'File not found' }
      const currentCode = vs.drafts?.[target.id] !== undefined ? vs.drafts[target.id] : (target.code || '')
      return { 
        success: true, 
        content: currentCode,
        instruction_to_ai: "File read successfully. You MUST now respond to the user and explain or summarize this content based on their original request."
      }
    }
  })
}
