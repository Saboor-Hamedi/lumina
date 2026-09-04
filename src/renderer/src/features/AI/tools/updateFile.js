import * as aiSdk from 'ai'

export const updateFileTool = aiSdk.tool({
  description:
    'Update an existing file with targeted precision. ALWAYS prefer `sectionHeader`, `search` & `replace`, `insertAfter`, or `insertBefore` to edit specific paragraphs, sections, lines, or blocks without wiping the rest of the file. Only use full `content` when complete document rewrite is explicitly requested.',
  inputSchema: aiSdk.jsonSchema({
    type: 'object',
    properties: {
      title: { type: 'string', description: 'The file title to update (or "current" for active note)' },
      sectionHeader: {
        type: 'string',
        description:
          'Markdown section heading (e.g. "## Features", "### Summary", or "Features") to replace or update only that specific section.'
      },
      search: {
        type: 'string',
        description:
          'Exact text, line, or block in the file to find and replace. Keep this as specific as possible.'
      },
      replace: {
        type: 'string',
        description: 'New text, section content, or code to insert in place of `search` or under `sectionHeader`.'
      },
      insertAfter: {
        type: 'string',
        description: 'Text, line, or heading in the file after which to insert the new content.'
      },
      insertBefore: {
        type: 'string',
        description: 'Text, line, or heading in the file before which to insert the new content.'
      },
      position: {
        type: 'string',
        description: 'Where to insert content. Use "top" to place right below the title header (ideal for wikilinks and summaries), or "bottom".'
      },
      content: {
        type: 'string',
        description:
          'Full document markdown content. ONLY use if the user explicitly requested a complete rewrite of the entire file.'
      }
    },
    required: ['title']
  }),
  execute: async ({ title, search, replace, insertAfter, insertBefore, position, content, sectionHeader }) => {
    const { useVaultStore } = await import('../../../core/store/workspaceStore')
    const vs = useVaultStore.getState()
    const snippets = Array.isArray(vs.snippets) ? vs.snippets : Object.values(vs.snippets || {})

    const cleanTitle = (title || '').trim().toLowerCase().replace(/^@/, '').replace(/\.md$/, '')
    let target = null

    if (cleanTitle === 'current' || !cleanTitle) {
      target = vs.selectedSnippet || (snippets.length > 0 ? snippets[0] : null)
    } else {
      target = snippets.find(
        (s) => (s.title || '').toLowerCase().replace(/\.md$/, '') === cleanTitle
      )
      if (!target) {
        target = snippets.find((s) => (s.title || '').toLowerCase().includes(cleanTitle))
      }
      if (!target && vs.selectedSnippet) {
        target = vs.selectedSnippet
      }
    }

    if (!target) return { success: false, error: `File "${title}" not found.` }

    const currentCode =
      vs.drafts?.[target.id] !== undefined ? vs.drafts[target.id] : target.code || ''

    let newCode = currentCode
    let writtenText = replace || content || ''
    let diffPreview = ''
    let summaryText = `Updated **${target.title}**`

    if (position === 'top' && replace !== undefined) {
      const titleMatch = currentCode.match(/^#\s+[^\r\n]+[\r\n]*/m)
      if (titleMatch) {
        const afterTitleIndex = titleMatch.index + titleMatch[0].length
        newCode = currentCode.slice(0, afterTitleIndex) + '\n' + replace.trim() + '\n\n' + currentCode.slice(afterTitleIndex).replace(/^\n+/, '')
      } else {
        newCode = replace.trim() + '\n\n' + currentCode
      }
      writtenText = replace.trim()
      summaryText = `Added top references to **${target.title}**`
      diffPreview = `\`\`\`markdown\n${replace.trim()}\n\`\`\``
    } else if (sectionHeader && replace !== undefined) {
      const cleanHeader = sectionHeader.trim()
      const headerTitle = cleanHeader.replace(/^#{1,6}\s*/, '').trim()
      const headerRegex = new RegExp(`^(#{1,6})\\s+${headerTitle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`, 'im')
      const match = currentCode.match(headerRegex)

      if (match) {
        const headerLevel = match[1].length
        const fullHeader = match[0]
        const startIndex = match.index
        const afterHeaderIndex = startIndex + fullHeader.length

        const nextSectionRegex = new RegExp(`\\n(?=#{1,${headerLevel}}\\s)`, 'g')
        nextSectionRegex.lastIndex = afterHeaderIndex
        const nextMatch = nextSectionRegex.exec(currentCode)
        const endIndex = nextMatch ? nextMatch.index : currentCode.length

        const oldSectionContent = currentCode.slice(startIndex, endIndex).trim()
        const newSectionContent = `${fullHeader}\n\n${replace.trim()}\n`

        newCode = currentCode.slice(0, startIndex) + newSectionContent + (nextMatch ? '\n' + currentCode.slice(endIndex + 1) : '')
        writtenText = newSectionContent
        summaryText = `Updated section \`${fullHeader}\` in **${target.title}**`
        diffPreview = `\`\`\`markdown\n${newSectionContent}\n\`\`\``
      } else {
        const formattedHeader = cleanHeader.startsWith('#') ? cleanHeader : `## ${cleanHeader}`
        const newSection = `\n\n${formattedHeader}\n\n${replace.trim()}\n`
        newCode = currentCode.trimEnd() + newSection
        writtenText = newSection
        summaryText = `Added section \`${formattedHeader}\` to **${target.title}**`
        diffPreview = `\`\`\`markdown\n${formattedHeader}\n\n${replace.trim()}\n\`\`\``
      }
    } else if (insertAfter !== undefined && replace !== undefined) {
      const trimmedTarget = insertAfter.trim()
      let index = currentCode.indexOf(trimmedTarget)
      if (index === -1) {
        const normCurrent = currentCode.replace(/\r\n/g, '\n')
        const normTarget = trimmedTarget.replace(/\r\n/g, '\n')
        index = normCurrent.indexOf(normTarget)
      }

      if (index !== -1) {
        const insertionPoint = index + trimmedTarget.length
        newCode = currentCode.slice(0, insertionPoint) + '\n\n' + replace.trim() + '\n' + currentCode.slice(insertionPoint)
        writtenText = replace.trim()
        summaryText = `Inserted updates into **${target.title}**`
        diffPreview = `\`\`\`markdown\n${replace.trim()}\n\`\`\``
      } else {
        newCode = currentCode.trimEnd() + '\n\n' + replace.trim() + '\n'
        writtenText = replace.trim()
        summaryText = `Appended updates to **${target.title}**`
        diffPreview = `\`\`\`markdown\n${replace.trim()}\n\`\`\``
      }
    } else if (insertBefore !== undefined && replace !== undefined) {
      const trimmedTarget = insertBefore.trim()
      let index = currentCode.indexOf(trimmedTarget)
      if (index === -1) {
        const normCurrent = currentCode.replace(/\r\n/g, '\n')
        const normTarget = trimmedTarget.replace(/\r\n/g, '\n')
        index = normCurrent.indexOf(normTarget)
      }

      if (index !== -1) {
        newCode = currentCode.slice(0, index) + replace.trim() + '\n\n' + currentCode.slice(index)
        writtenText = replace.trim()
        summaryText = `Inserted updates before targeted line in **${target.title}**`
        diffPreview = `\`\`\`markdown\n${replace.trim()}\n\`\`\``
      } else {
        newCode = replace.trim() + '\n\n' + currentCode
        writtenText = replace.trim()
        summaryText = `Prepended updates to **${target.title}**`
        diffPreview = `\`\`\`markdown\n${replace.trim()}\n\`\`\``
      }
    } else if (search !== undefined) {
      if (search === '') {
        newCode = (replace ?? '') + '\n' + currentCode
        writtenText = replace ?? ''
        summaryText = `Updated top of **${target.title}**`
        diffPreview = `\`\`\`markdown\n${replace ?? ''}\n\`\`\``
      } else if (currentCode.includes(search)) {
        newCode = currentCode.replace(search, replace ?? '')
        writtenText = replace ?? ''
        summaryText = `Updated targeted section in **${target.title}**`
        diffPreview = `\`\`\`markdown\n${replace ?? ''}\n\`\`\``
      } else {
        const normCurrent = currentCode.replace(/\r\n/g, '\n')
        const normSearch = search.replace(/\r\n/g, '\n')
        if (normCurrent.includes(normSearch)) {
          newCode = normCurrent.replace(normSearch, replace ?? '')
          writtenText = replace ?? ''
          summaryText = `Updated targeted section in **${target.title}**`
          diffPreview = `\`\`\`markdown\n${replace ?? ''}\n\`\`\``
        } else {
          const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
          const regex = new RegExp(escaped, 'i')
          if (regex.test(currentCode)) {
            newCode = currentCode.replace(regex, replace ?? '')
            writtenText = replace ?? ''
            summaryText = `Updated targeted section in **${target.title}**`
            diffPreview = `\`\`\`markdown\n${replace ?? ''}\n\`\`\``
          } else {
            return {
              success: false,
              error: `Target text to replace was not found in "${target.title}".`
            }
          }
        }
      }
    } else if (content !== undefined) {
      newCode = content
      writtenText = content
      summaryText = `Updated entire document for **${target.title}**`
      diffPreview = `\`\`\`markdown\n${content.slice(0, 300)}${content.length > 300 ? '...' : ''}\n\`\`\``
    } else {
      return {
        success: false,
        error: 'Must provide `sectionHeader`, `search` & `replace`, `insertAfter`, `insertBefore`, or `content`'
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
      writtenContent: writtenText || newCode,
      diffPreview: diffPreview,
      summary: summaryText,
      instruction_to_ai:
        'Targeted update applied successfully. In your chat walkthrough, highlight the exact updated part or diff and explain the improvements.'
    }
  }
})
