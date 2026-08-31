import * as aiSdk from 'ai'

export const appendToFileTool = aiSdk.tool({
  description:
    'Append or write new content directly to a note in the workspace editor. Use this whenever the user asks to write, add, or append to an open or mentioned note.',
  inputSchema: aiSdk.jsonSchema({
    type: 'object',
    properties: {
      title: { type: 'string', description: 'The file title' },
      content: { type: 'string', description: 'The new content to write/append to the file' }
    },
    required: ['title', 'content']
  }),
  execute: async ({ title, content }) => {
    const { useVaultStore } = await import('../../../core/store/useVaultStore')
    const vs = useVaultStore.getState()
    const snippets = Array.isArray(vs.snippets) ? vs.snippets : Object.values(vs.snippets || {})

    const cleanTitle = (title || '').trim().toLowerCase().replace(/\.md$/, '')
    let target = snippets.find(
      (s) => (s.title || '').toLowerCase().replace(/\.md$/, '') === cleanTitle
    )
    if (!target) {
      target = snippets.find((s) => (s.title || '').toLowerCase().includes(cleanTitle))
    }
    if (!target && vs.selectedSnippet) {
      target = vs.selectedSnippet
    }
    if (!target) return { success: false, error: `File "${title}" not found.` }

    const currentCode =
      vs.drafts?.[target.id] !== undefined ? vs.drafts[target.id] : target.code || ''
    const separator = currentCode && currentCode.endsWith('\n') ? '\n' : currentCode ? '\n\n' : ''
    const newCode = currentCode + separator + content

    const updated = await vs.saveSnippet({ ...target, code: newCode })
    if (vs.setSelectedSnippet) {
      vs.setSelectedSnippet(updated || { ...target, code: newCode })
    }
    if (vs.setActiveTabId) {
      vs.setActiveTabId(target.id)
    }

    window.dispatchEvent(
      new CustomEvent('ai-saved-snippet', {
        detail: { id: target.id, code: newCode, title: target.title }
      })
    )

    return {
      success: true,
      title: target.title,
      writtenContent: content,
      summary: `Wrote content into **${target.title}**!`,
      instruction_to_ai:
        'Content written successfully. Give a friendly summary of what was written and highlight key wikilinks.'
    }
  }
})
