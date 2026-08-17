import * as aiSdk from 'ai'

export const createFileTool = aiSdk.tool({
  description: 'Create a new file in the workspace. ONLY use this if the user EXPLICITLY asks to "create", "make", or "write" a NEW file. Do not use this to just answer a question.',
  inputSchema: aiSdk.jsonSchema({
    type: 'object',
    properties: {
      title: {
        type: 'string',
        description: 'The file title (single word or short phrase, no extension)'
      },
      content: { type: 'string', description: 'Full markdown content' },
      folder: {
        type: 'string',
        description:
          'Optional. The existing folder path to create the file in (e.g., "English"). If root, leave undefined.'
      }
    },
    required: ['title', 'content']
  }),
  execute: async ({ title, content, folder }) => {
    const { useVaultStore } = await import('../../../core/store/useVaultStore')
    const vs = useVaultStore.getState()
    const snippet = {
      id: crypto.randomUUID(),
      title,
      code: content,
      folderId: folder || '',
      language: 'markdown',
      timestamp: Date.now()
    }
    await vs.saveSnippet(snippet)
    return {
      success: true,
      id: snippet.id,
      title,
      folderId: snippet.folderId,
      instruction_to_ai: 'File created successfully! Tell the user.'
    }
  }
})
