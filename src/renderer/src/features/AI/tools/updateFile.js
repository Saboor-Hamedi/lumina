import * as aiSdk from 'ai'

export const updateFileTool = aiSdk.tool({
  description:
    'Update an existing file. Use `search` and `replace` for targeted edits, OR provide full `content` to overwrite.',
  inputSchema: aiSdk.jsonSchema({
    type: 'object',
    properties: {
      title: { type: 'string', description: 'The file title' },
      search: { type: 'string', description: 'Exact text to find and replace' },
      replace: { type: 'string', description: 'New text to insert' },
      content: {
        type: 'string',
        description: 'Full markdown content to overwrite the file'
      }
    },
    required: ['title']
  }),
  execute: async ({ title, search, replace, content }) => {
    const { useVaultStore } = await import('../../../core/store/useVaultStore')
    const vs = useVaultStore.getState()
    const snippets = Array.from(vs.snippets.values())
    let target = snippets.find((s) => s.title.toLowerCase() === title.toLowerCase())
    if (!target) {
      target = snippets.find((s) => s.title.toLowerCase().includes(title.toLowerCase()))
    }
    if (!target) return { success: false, error: 'File not found' }

    let newCode
    const currentCode = vs.drafts?.[target.id] !== undefined ? vs.drafts[target.id] : (target.code || '')
    if (search !== undefined) {
      const searchLower = search.toLowerCase()
      if (search !== '' && !currentCode.toLowerCase().includes(searchLower)) {
        return { success: false, error: `Text "${search}" not found in file` }
      }
      if (search === '') {
        newCode = (replace ?? '') + currentCode
      } else {
        const escapedSearch = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        newCode = currentCode.replace(new RegExp(escapedSearch, 'gi'), replace ?? '')
      }
    } else if (content !== undefined) {
      newCode = content
    } else {
      return {
        success: false,
        error: 'Must provide either search/replace or full content'
      }
    }

    await vs.saveSnippet({ ...target, code: newCode })
    window.dispatchEvent(new CustomEvent('ai-saved-snippet', { detail: { id: target.id, code: newCode } }))
    return { 
      success: true, 
      title,
      instruction_to_ai: "File updated successfully. You MUST now respond to the user and summarize exactly what changes you made."
    }
  }
})
