import * as aiSdk from 'ai'

export const renameFileTool = aiSdk.tool({
  description:
    'Rename an existing workspace file to a new title. ONLY call this when the user has EXPLICITLY specified BOTH the current file and the desired NEW name. If the user only says "rename this file" without providing the new name, DO NOT call this tool — simply ask the user what they want to rename it to.',
  inputSchema: aiSdk.jsonSchema({
    type: 'object',
    properties: {
      oldTitle: { type: 'string', description: 'The current file title to rename' },
      newTitle: { type: 'string', description: 'The explicit new title provided by the user' }
    },
    required: ['oldTitle', 'newTitle']
  }),
  execute: async ({ oldTitle, newTitle }) => {
    if (!newTitle || !newTitle.trim() || newTitle.trim() === oldTitle.trim()) {
      return { success: false, error: 'A different new title must be specified by the user.' }
    }

    const cleanOldTitle = oldTitle.startsWith('@') ? oldTitle.slice(1).trim() : oldTitle.trim()
    const cleanNewTitle = newTitle.startsWith('@') ? newTitle.slice(1).trim() : newTitle.trim()

    const { useVaultStore } = await import('../../../core/store/useVaultStore')
    const vs = useVaultStore.getState()
    const snippets = Array.isArray(vs.snippets) ? vs.snippets : Object.values(vs.snippets || {})

    const normalize = (t) => t.toLowerCase().replace(/\.md$/, '').trim()
    let target = snippets.find((s) => normalize(s.title) === normalize(cleanOldTitle))
    if (!target) {
      target = snippets.find((s) => normalize(s.title).includes(normalize(cleanOldTitle)))
    }
    if (!target) return { success: false, error: `File "${oldTitle}" not found in workspace.` }

    const duplicate = snippets.find(
      (s) => s.id !== target.id && normalize(s.title) === normalize(cleanNewTitle)
    )
    if (duplicate) return { success: false, error: `A file named "${cleanNewTitle}" already exists.` }

    const updated = await vs.saveSnippet({ ...target, title: cleanNewTitle })
    if (vs.setSelectedSnippet) {
      vs.setSelectedSnippet(updated || { ...target, title: cleanNewTitle })
    }

    window.dispatchEvent(
      new CustomEvent('ai-saved-snippet', { detail: { id: target.id, code: target.code, title: cleanNewTitle } })
    )

    return {
      success: true,
      oldTitle: target.title,
      newTitle: cleanNewTitle,
      instruction_to_ai: `File "${target.title}" was successfully renamed to "${cleanNewTitle}". Confirm this to the user.`
    }
  }
})
