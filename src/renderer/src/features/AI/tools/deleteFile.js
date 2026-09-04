import * as aiSdk from 'ai'

export const deleteFileTool = aiSdk.tool({
  description:
    'Delete a note file from the workspace. Use this whenever the user asks to delete or remove a note (e.g. "Delete Thermodynamics", "Remove this note", "Delete current file").',
  inputSchema: aiSdk.jsonSchema({
    type: 'object',
    properties: {
      title: {
        type: 'string',
        description: 'The title or filename of the note to delete. Use "current" or "active" to delete the open note.'
      }
    },
    required: ['title']
  }),
  execute: async ({ title }) => {
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
        const cleanLower = rawTitle.toLowerCase().replace(/\.md$/i, '')
        target = snippets.find(
          (s) => (s.title || '').toLowerCase().replace(/\.md$/i, '') === cleanLower
        )
        if (!target) {
          target = snippets.find(
            (s) => (s.fileName || '').toLowerCase().replace(/\.md$/i, '') === cleanLower
          )
        }
        if (!target) {
          target = snippets.find((s) =>
            (s.title || '').toLowerCase().includes(cleanLower)
          )
        }
      }

      if (!target) {
        return { success: false, error: `Note "${rawTitle || 'current'}" not found.` }
      }

      const deletedTitle = target.title || target.fileName || rawTitle
      await vs.deleteSnippet(target.id, true)

      if (window.api?.deleteChunks) {
        await window.api.deleteChunks(deletedTitle)
      }

      if (vs.closeTab) {
        vs.closeTab(target.id)
      }

      if (vs.loadVault) {
        await vs.loadVault()
      }

      return {
        success: true,
        title: deletedTitle,
        summary: `Deleted note **${deletedTitle}**.`,
        instruction_to_ai: `Note "${deletedTitle}" was deleted successfully. Confirm to user.`
      }
    } catch (err) {
      return { success: false, error: err.message || 'Failed to delete file' }
    }
  }
})
