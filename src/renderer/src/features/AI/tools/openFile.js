import * as aiSdk from 'ai'

export const openFileTool = aiSdk.tool({
  description: "Open a note file in the user's editor tab so they can view and edit it.",
  inputSchema: aiSdk.jsonSchema({
    type: 'object',
    properties: {
      title: { type: 'string', description: 'The file title or name to open' }
    },
    required: ['title']
  }),
  execute: async ({ title }) => {
    try {
      const cleanTitle = (title || '').trim().replace(/^@/, '')
      const { useVaultStore } = await import('../../../core/store/workspaceStore')
      const vs = useVaultStore.getState()
      const snippets = Array.isArray(vs.snippets)
        ? vs.snippets
        : Array.from(vs.snippets?.values?.() || [])

      const normalize = (t) => (t || '').toLowerCase().replace(/\.md$/i, '').trim()
      let target = snippets.find((s) => normalize(s.title) === normalize(cleanTitle))
      if (!target) {
        target = snippets.find((s) => normalize(s.fileName) === normalize(cleanTitle))
      }
      if (!target) {
        target = snippets.find((s) => normalize(s.title).includes(normalize(cleanTitle)))
      }

      if (!target) {
        return { success: false, error: `Note "${title}" not found.` }
      }

      if (vs.setSelectedSnippet) {
        vs.setSelectedSnippet(target)
      }
      if (vs.setActiveTabId) {
        vs.setActiveTabId(target.id)
      }

      return {
        success: true,
        title: target.title,
        instruction_to_ai: `File "${target.title}" is now open in the editor. Tell the user you have opened it for them.`
      }
    } catch (err) {
      return { success: false, error: err.message || 'Failed to open file' }
    }
  }
})
