import * as aiSdk from 'ai'

export const renameFileTool = aiSdk.tool({
  description: 'Rename a file in the vault. Preserves the file folder and all content. Use this instead of delete+create when renaming.',
  inputSchema: aiSdk.jsonSchema({
    type: 'object',
    properties: {
      oldTitle: { type: 'string', description: 'The current file title to rename' },
      newTitle: { type: 'string', description: 'The new title for the file' }
    },
    required: ['oldTitle', 'newTitle']
  }),
  execute: async ({ oldTitle, newTitle }) => {
    const cleanOldTitle = oldTitle.startsWith('@') ? oldTitle.slice(1) : oldTitle
    const { useVaultStore } = await import('../../../core/store/useVaultStore')
    const vs = useVaultStore.getState()
    const snippets = Array.from(vs.snippets.values())
    let target = snippets.find((s) => s.title.toLowerCase() === cleanOldTitle.toLowerCase())
    if (!target) {
      target = snippets.find((s) => s.title.toLowerCase().includes(cleanOldTitle.toLowerCase()))
    }
    if (!target) return { success: false, error: `File "${oldTitle}" not found` }
    const duplicate = Array.from(vs.snippets.values()).find(
      (s) => s.id !== target.id && s.title.toLowerCase() === newTitle.toLowerCase()
    )
    if (duplicate) return { success: false, error: `A file named "${newTitle}" already exists` }
    await vs.saveSnippet({ ...target, title: newTitle })
    window.dispatchEvent(new CustomEvent('ai-saved-snippet', { detail: { id: target.id, code: target.code } }))
    return { success: true, oldTitle, newTitle, instruction_to_ai: `File renamed from "${oldTitle}" to "${newTitle}" successfully. Confirm this to the user.` }
  }
})
