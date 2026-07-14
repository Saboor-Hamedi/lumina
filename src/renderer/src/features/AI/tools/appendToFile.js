import * as aiSdk from 'ai'

export const appendToFileTool = aiSdk.tool({
  description:
    'Append new content to the END of an existing file. Use this when asked to ADD, WRITE MORE, or APPEND to a file. Never read the file first — this tool handles that automatically.',
  inputSchema: aiSdk.jsonSchema({
    type: 'object',
    properties: {
      title: { type: 'string', description: 'The file title' },
      content: { type: 'string', description: 'The new content to append at the end of the file' }
    },
    required: ['title', 'content']
  }),
  execute: async ({ title, content }) => {
    const { useVaultStore } = await import('../../../core/store/useVaultStore')
    const vs = useVaultStore.getState()
    const snippets = Array.from(vs.snippets.values())
    let target = snippets.find((s) => s.title.toLowerCase() === title.toLowerCase())
    if (!target) {
      target = snippets.find((s) => s.title.toLowerCase().includes(title.toLowerCase()))
    }
    if (!target) return { success: false, error: 'File not found' }
    const currentCode = vs.drafts?.[target.id] !== undefined ? vs.drafts[target.id] : (target.code || '')
    const separator = currentCode && currentCode.endsWith('\n') ? '\n' : (currentCode ? '\n\n' : '')
    const newCode = currentCode + separator + content
    await vs.saveSnippet({ ...target, code: newCode })
    window.dispatchEvent(new CustomEvent('ai-saved-snippet', { detail: { id: target.id, code: newCode } }))
    return { success: true, title: target.title, instruction_to_ai: 'Content added successfully. Tell the user what you did in a friendly way, but DO NOT use the word "appended".' }
  }
})
