import * as aiSdk from 'ai'

export const clearFileTool = aiSdk.tool({
  description:
    'Clear the content of a file or reset it to a clean blank state. Use ONLY when the user explicitly asks to clear, reset, or empty a file.',
  inputSchema: aiSdk.jsonSchema({
    type: 'object',
    properties: {
      title: { type: 'string', description: 'The title of the file to clear' },
      keepHeader: {
        type: 'boolean',
        description: 'Whether to keep the title header `# Title\\n\\n` (default true)'
      }
    },
    required: ['title']
  }),
  execute: async ({ title, keepHeader = true }) => {
    const { useVaultStore } = await import('../../../core/store/useVaultStore')
    const vs = useVaultStore.getState()
    const snippets = Array.from(vs.snippets.values())

    const cleanTitle = title.trim().toLowerCase().replace(/\.md$/, '')
    let target = snippets.find((s) => s.title.toLowerCase().replace(/\.md$/, '') === cleanTitle)
    if (!target) {
      target = snippets.find((s) => s.title.toLowerCase().includes(cleanTitle))
    }

    if (!target) {
      return { success: false, error: `File "${title}" not found.` }
    }

    const newCode = keepHeader ? `# ${target.title}\n\n` : ''
    await vs.saveSnippet({ ...target, code: newCode })

    window.dispatchEvent(
      new CustomEvent('ai-saved-snippet', { detail: { id: target.id, code: newCode } })
    )

    return {
      success: true,
      title: target.title,
      instruction_to_ai: `File "${target.title}" was cleared successfully. Inform the user.`
    }
  }
})
