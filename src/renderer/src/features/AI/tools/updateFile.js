import * as aiSdk from 'ai'

export const updateFileTool = aiSdk.tool({
  description:
    'Update an existing file with targeted precision. ALWAYS prefer `search` and `replace` to edit specific paragraphs, sections, lines, or code blocks without wiping the rest of the file. Only use full `content` when complete document rewrite is explicitly requested.',
  inputSchema: aiSdk.jsonSchema({
    type: 'object',
    properties: {
      title: { type: 'string', description: 'The file title to update' },
      search: {
        type: 'string',
        description:
          'Exact text, line, or section in the file to find and replace. Keep this as specific as possible.'
      },
      replace: {
        type: 'string',
        description: 'New text/content to insert in place of `search`.'
      },
      content: {
        type: 'string',
        description:
          'Full document markdown content. ONLY use if the entire file is being rewritten.'
      },
      sectionHeader: {
        type: 'string',
        description:
          'Optional markdown section header (e.g. "## Features") to replace the content under that specific heading.'
      }
    },
    required: ['title']
  }),
  execute: async ({ title, search, replace, content, sectionHeader }) => {
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

    let newCode

    // 1. Targeted Section Replacement
    if (sectionHeader && replace !== undefined) {
      const escapedHeader = sectionHeader.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      const sectionRegex = new RegExp(`(${escapedHeader}[\\s\\S]*?)(?=\\n#{1,6}\\s|$)`, 'i')
      if (sectionRegex.test(currentCode)) {
        newCode = currentCode.replace(sectionRegex, `${sectionHeader}\n\n${replace.trim()}\n\n`)
      } else {
        // Append section at end if not found
        newCode = `${currentCode.trimEnd()}\n\n${sectionHeader}\n\n${replace.trim()}\n`
      }
    }
    // 2. Targeted Search and Replace
    else if (search !== undefined) {
      if (search === '') {
        // Prepend to top
        newCode = (replace ?? '') + '\n' + currentCode
      } else if (currentCode.includes(search)) {
        // Exact match
        newCode = currentCode.replace(search, replace ?? '')
      } else {
        // Normalized whitespace fallback
        const normCurrent = currentCode.replace(/\r\n/g, '\n')
        const normSearch = search.replace(/\r\n/g, '\n')
        if (normCurrent.includes(normSearch)) {
          newCode = normCurrent.replace(normSearch, replace ?? '')
        } else {
          // Case-insensitive fallback
          const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
          const regex = new RegExp(escaped, 'i')
          if (regex.test(currentCode)) {
            newCode = currentCode.replace(regex, replace ?? '')
          } else {
            return {
              success: false,
              error: `Target text to replace was not found in "${target.title}".`
            }
          }
        }
      }
    }
    // 3. Full Content Overwrite
    else if (content !== undefined) {
      newCode = content
    } else {
      return {
        success: false,
        error: 'Must provide either `search` and `replace` or full `content`'
      }
    }

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
      instruction_to_ai:
        'File updated successfully with targeted edits. Respond to the user and summarize specifically what was modified.'
    }
  }
})
