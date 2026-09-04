import * as aiSdk from 'ai'

export const renameFileTool = aiSdk.tool({
  description:
    'Rename an existing workspace note file to a new title. ONLY call this when the user has EXPLICITLY specified the desired NEW name. You can use oldTitle="current" or oldTitle="active" to rename the currently open note.',
  inputSchema: aiSdk.jsonSchema({
    type: 'object',
    properties: {
      oldTitle: {
        type: 'string',
        description: 'The current file title to rename. Use "current" or "active" to rename the currently open note.'
      },
      newTitle: {
        type: 'string',
        description: 'The explicit new title provided by the user (no extension).'
      }
    },
    required: ['oldTitle', 'newTitle']
  }),
  execute: async ({ oldTitle, newTitle }) => {
    try {
      const cleanNewTitle = (newTitle || '')
        .trim()
        .replace(/^@/, '')
        .replace(/\.md$/i, '')
      if (!cleanNewTitle) {
        return { success: false, error: 'A valid new title is required.' }
      }

      const cleanOldTitle = (oldTitle || '').trim().replace(/^@/, '')
      const { useVaultStore } = await import('../../../core/store/workspaceStore')
      const vs = useVaultStore.getState()
      const snippets = Array.isArray(vs.snippets)
        ? vs.snippets
        : Array.from(vs.snippets?.values?.() || [])

      let target = null
      if (
        !cleanOldTitle ||
        cleanOldTitle.toLowerCase() === 'current' ||
        cleanOldTitle.toLowerCase() === 'active' ||
        cleanOldTitle.toLowerCase() === 'this' ||
        cleanOldTitle.toLowerCase() === 'this note' ||
        cleanOldTitle.toLowerCase() === 'this file'
      ) {
        target = vs.selectedSnippet || (vs.activeTabId ? snippets.find((s) => s.id === vs.activeTabId) : null)
      } else {
        const normalize = (t) => (t || '').toLowerCase().replace(/\.md$/i, '').trim()
        target = snippets.find((s) => normalize(s.title) === normalize(cleanOldTitle))
        if (!target) {
          target = snippets.find((s) => normalize(s.fileName) === normalize(cleanOldTitle))
        }
        if (!target) {
          target = snippets.find((s) => normalize(s.title).includes(normalize(cleanOldTitle)))
        }
      }

      if (!target) {
        return { success: false, error: `Note "${oldTitle || 'current'}" not found in workspace.` }
      }

      const normalize = (t) => (t || '').toLowerCase().replace(/\.md$/i, '').trim()
      const duplicate = snippets.find(
        (s) => s.id !== target.id && normalize(s.title) === normalize(cleanNewTitle) && (s.folderId || '') === (target.folderId || '')
      )
      if (duplicate) {
        return { success: false, error: `A file named "${cleanNewTitle}" already exists in this folder.` }
      }

      const updated = await vs.saveSnippet({ ...target, title: cleanNewTitle })
      const finalSnippet = updated || { ...target, title: cleanNewTitle }

      if (vs.loadVault) {
        await vs.loadVault()
      }

      if (vs.setSelectedSnippet) {
        vs.setSelectedSnippet(finalSnippet)
      }

      window.dispatchEvent(
        new CustomEvent('ai-saved-snippet', {
          detail: { id: target.id, code: target.code, title: cleanNewTitle }
        })
      )

      return {
        success: true,
        oldTitle: target.title,
        newTitle: cleanNewTitle,
        summary: `Renamed note **${target.title}** to **${cleanNewTitle}**.`,
        instruction_to_ai: `File "${target.title}" was successfully renamed to "${cleanNewTitle}". Confirm this to the user.`
      }
    } catch (err) {
      return { success: false, error: err.message || 'Failed to rename file' }
    }
  }
})
