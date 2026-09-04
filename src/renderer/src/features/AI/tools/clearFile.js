import * as aiSdk from 'ai'

export const clearFileTool = aiSdk.tool({
  description:
    'Clear the content of a file completely or reset it to a clean blank state. Use ONLY when the user explicitly asks to clear, reset, or empty a file. Use title="current" to clear the open note.',
  inputSchema: aiSdk.jsonSchema({
    type: 'object',
    properties: {
      title: {
        type: 'string',
        description: 'The title of the file to clear. Use "current" or "active" to clear the open note.'
      },
      keepHeader: {
        type: 'boolean',
        description: 'Whether to keep the title header `# Title\\n\\n`. Defaults to false for a totally blank file.'
      }
    },
    required: ['title']
  }),
  execute: async ({ title, keepHeader = false }) => {
    try {
      const rawTitle = (title || '').trim().replace(/^@/, '')
      const { useVaultStore } = await import('../../../core/store/workspaceStore')
      const vs = useVaultStore.getState()
      const snippets = Array.isArray(vs.snippets)
        ? vs.snippets
        : Array.from(vs.snippets?.values?.() || [])

      let target = null
      if (
        !rawTitle ||
        rawTitle.toLowerCase() === 'current' ||
        rawTitle.toLowerCase() === 'active' ||
        rawTitle.toLowerCase() === 'this' ||
        rawTitle.toLowerCase() === 'this note' ||
        rawTitle.toLowerCase() === 'this file'
      ) {
        target = vs.selectedSnippet || (vs.activeTabId ? snippets.find((s) => s.id === vs.activeTabId) : null)
      } else {
        const cleanTitle = rawTitle.toLowerCase().replace(/\.md$/, '')
        target = snippets.find((s) => (s.title || '').toLowerCase().replace(/\.md$/, '') === cleanTitle)
        if (!target) {
          target = snippets.find((s) => (s.title || '').toLowerCase().includes(cleanTitle))
        }
      }

      if (!target) {
        return { success: false, error: `File "${title}" not found.` }
      }

      const newCode = keepHeader ? `# ${target.title}\n\n` : ''

      if (vs.setDraft) {
        vs.setDraft(target.id, newCode)
      }

      await vs.saveSnippet({ ...target, code: newCode })

      window.dispatchEvent(
        new CustomEvent('ai-saved-snippet', { detail: { id: target.id, code: newCode } })
      )

      return {
        success: true,
        title: target.title,
        instruction_to_ai: `File "${target.title}" was completely cleared. Inform the user.`
      }
    } catch (err) {
      return { success: false, error: err.message || 'Failed to clear file' }
    }
  }
})
