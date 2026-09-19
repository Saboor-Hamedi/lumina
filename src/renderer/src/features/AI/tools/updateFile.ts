import * as aiSdk from 'ai'
import type { AIToolExecutionResult } from '../types/ai.types'

interface UpdateFileInput {
  title: string
  sectionHeader?: string
  search?: string
  replace?: string
  text?: string
  insertAfter?: string
  insertBefore?: string
  position?: string
  content?: string
}

export const updateFileTool = aiSdk.tool({
  description:
    'Update an existing file with targeted precision. ALWAYS prefer `sectionHeader`, `search` & `replace`, `insertAfter`, or `insertBefore` to edit specific paragraphs, sections, lines, or blocks without wiping the rest of the file. Only use full `content` when complete document rewrite is explicitly requested.',
  inputSchema: aiSdk.jsonSchema<UpdateFileInput>({
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
      text: {
        type: 'string',
        description: 'New text, paragraph, or section content to update into the note.'
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
  execute: async ({
    title,
    search,
    replace,
    text,
    insertAfter,
    insertBefore,
    position,
    content,
    sectionHeader
  }): Promise<AIToolExecutionResult> => {
    const { useWorkspaceStore } = await import('../../../core/store/workspaceStore')
    const vs = (useWorkspaceStore as any).getState()
    const snippets = vs.notes || []

    const cleanTitle = (title || '').trim().toLowerCase().replace(/^@/, '').replace(/\.md$/, '')
    let target: any = null

    // Prefer active open note if it matches or if requested as 'current'
    if (vs.selectedNote) {
      const activeTitle = (vs.selectedNote.title || '').toLowerCase().replace(/\.md$/, '')
      if (
        cleanTitle === 'current' ||
        !cleanTitle ||
        activeTitle === cleanTitle ||
        activeTitle.includes(cleanTitle) ||
        cleanTitle.includes(activeTitle)
      ) {
        target = vs.selectedNote
      }
    }

    if (!target) {
      if (cleanTitle === 'current' || !cleanTitle) {
        target = vs.selectedNote || (snippets.length > 0 ? snippets[0] : null)
      } else {
        target = snippets.find(
          (s: any) => (s.title || '').toLowerCase().replace(/\.md$/, '') === cleanTitle
        )
        if (!target) {
          target = snippets.find((s: any) => (s.title || '').toLowerCase().includes(cleanTitle))
        }
        if (!target && vs.selectedNote) {
          target = vs.selectedNote
        }
      }
    }

    if (!target) return { success: false, error: `File "${title}" not found.` }

    const currentCode =
      vs.drafts?.[target.id] !== undefined ? vs.drafts[target.id] : target.code || ''

    const normalize = (str: string) =>
      (str || '')
        .replace(/\r\n/g, '\n')
        .replace(/[“”]/g, '"')
        .replace(/[‘’]/g, "'")
        .replace(/[—–]/g, '--')
        .replace(/[ \t]+/g, ' ')

    const effectiveReplace = replace !== undefined ? replace : text
    let effectiveHeader = sectionHeader

    if (
      !effectiveHeader &&
      search === undefined &&
      insertAfter === undefined &&
      insertBefore === undefined &&
      position === undefined &&
      content === undefined &&
      effectiveReplace !== undefined
    ) {
      effectiveHeader = 'Opening'
    }

    let newCode = currentCode
    let writtenText = effectiveReplace || content || ''
    let diffPreview = ''
    let summaryText = `Updated **${target.title}**`
    const oldSectionContent = ''

    let changePos: number | null = null
    let changeLine: number | null = null

    if (position === 'top' && effectiveReplace !== undefined) {
      const titleMatch = currentCode.match(/^#\s+[^\r\n]+[\r\n]*/m)
      if (titleMatch) {
        const afterTitleIndex = (titleMatch.index || 0) + titleMatch[0].length
        newCode = currentCode.slice(0, afterTitleIndex) + '\n' + effectiveReplace.trim() + '\n\n' + currentCode.slice(afterTitleIndex).replace(/^\n+/, '')
        changePos = afterTitleIndex + 1
        changeLine = 2
      } else {
        newCode = effectiveReplace.trim() + '\n\n' + currentCode
        changePos = 0
        changeLine = 1
      }
      writtenText = effectiveReplace.trim()
      summaryText = `Added top references to **${target.title}**`
      diffPreview = `\`\`\`markdown\n${effectiveReplace.trim()}\n\`\`\``
    } else if (effectiveHeader && effectiveReplace !== undefined) {
      const cleanHeader = effectiveHeader.trim()
      const headerTitle = cleanHeader.replace(/^#{1,6}\s*/, '').trim().toLowerCase()
      const isIntroRequest =
        /^(intro|introduction|opening|opening paragraph|first paragraph|overview|summary|lead|top)$/i.test(
          headerTitle
        ) || headerTitle === (target.title || '').toLowerCase()

      const lines = currentCode.split('\n')

      if (isIntroRequest) {
        // Smart update for opening/introduction before first heading
        let titleLineIdx = -1
        for (let i = 0; i < lines.length; i++) {
          if (lines[i].match(/^#\s+/)) {
            titleLineIdx = i
            break
          }
        }

        let firstSubheadingIdx = lines.length
        const searchStart = titleLineIdx !== -1 ? titleLineIdx + 1 : 0
        for (let j = searchStart; j < lines.length; j++) {
          if (lines[j].match(/^#{1,6}\s+/)) {
            firstSubheadingIdx = j
            break
          }
        }

        let cleanBody = effectiveReplace.trim()
        cleanBody = cleanBody.replace(/^#\s+[^\r\n]+[\r\n]*/, '').trim()

        const beforeLines = titleLineIdx !== -1 ? lines.slice(0, titleLineIdx + 1) : []
        const afterLines = lines.slice(firstSubheadingIdx)
        newCode = [...beforeLines, '', cleanBody, '', ...afterLines].join('\n')
        writtenText = cleanBody
        summaryText = `Updated opening section in **${target.title}**`
        diffPreview = `\`\`\`markdown\n${cleanBody}\n\`\`\``
        changeLine = titleLineIdx !== -1 ? titleLineIdx + 2 : 1
        changePos = beforeLines.length > 0 ? beforeLines.join('\n').length + 1 : 0
      } else {
        let matchLineIndex = -1
        let matchHeaderLevel = 2
        let matchFullHeader = ''

        for (let i = 0; i < lines.length; i++) {
          const line = lines[i]
          const hMatch = line.match(/^(#{1,6})\s+(.*)$/)
          if (hMatch) {
            const level = hMatch[1].length
            const lineText = hMatch[2].trim().toLowerCase()
            const cleanLineText = lineText.replace(/^[0-9.\s\-_:]+/, '').trim()

            if (
              lineText === headerTitle ||
              cleanLineText === headerTitle ||
              lineText.includes(headerTitle) ||
              headerTitle.includes(cleanLineText)
            ) {
              matchLineIndex = i
              matchHeaderLevel = level
              matchFullHeader = line
              break
            }
          }
        }

        if (matchLineIndex !== -1) {
          let endLineIndex = lines.length
          for (let j = matchLineIndex + 1; j < lines.length; j++) {
            const nextH = lines[j].match(/^(#{1,6})\s+/)
            if (nextH) {
              if (matchHeaderLevel === 1 || nextH[1].length <= matchHeaderLevel) {
                endLineIndex = j
                break
              }
            }
          }

          let cleanBody = effectiveReplace.trim()
          const leadingHeadingMatch = cleanBody.match(/^#{1,6}\s+[^\r\n]+[\r\n]*/)
          if (leadingHeadingMatch) {
            const headingText = leadingHeadingMatch[0].replace(/^#{1,6}\s*/, '').trim().toLowerCase()
            if (
              headingText === headerTitle ||
              headerTitle.includes(headingText) ||
              headingText.includes(headerTitle) ||
              headingText === (target.title || '').toLowerCase()
            ) {
              cleanBody = cleanBody.slice(leadingHeadingMatch[0].length).trim()
            }
          }

          const beforeLines = lines.slice(0, matchLineIndex + 1)
          const afterLines = lines.slice(endLineIndex)
          newCode = [...beforeLines, '', cleanBody, '', ...afterLines].join('\n')
          writtenText = `${matchFullHeader}\n\n${cleanBody}`
          summaryText = `Updated section \`${matchFullHeader}\` in **${target.title}**`
          diffPreview = `\`\`\`markdown\n${matchFullHeader}\n\n${cleanBody}\n\`\`\``
          changeLine = matchLineIndex + 1
          changePos = beforeLines.join('\n').length + 1
        } else {
          const formattedHeader = cleanHeader.startsWith('#') ? cleanHeader : `## ${effectiveHeader.trim()}`
          const newSection = `\n\n${formattedHeader}\n\n${effectiveReplace.trim()}\n`
          newCode = currentCode.trimEnd() + newSection
          writtenText = newSection
          summaryText = `Added section \`${formattedHeader}\` to **${target.title}**`
          diffPreview = `\`\`\`markdown\n${formattedHeader}\n\n${effectiveReplace.trim()}\n\`\`\``
          changePos = currentCode.trimEnd().length + 2
        }
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
        changePos = insertionPoint + 2
      } else {
        const lines = currentCode.split('\n')
        const lowerTarget = trimmedTarget.toLowerCase()
        let foundLine = -1
        for (let i = 0; i < lines.length; i++) {
          if (lines[i].toLowerCase().includes(lowerTarget)) {
            foundLine = i
            break
          }
        }

        if (foundLine !== -1) {
          const beforeLines = lines.slice(0, foundLine + 1)
          const afterLines = lines.slice(foundLine + 1)
          newCode = [...beforeLines, '', replace.trim(), '', ...afterLines].join('\n')
          changeLine = foundLine + 2
          changePos = beforeLines.join('\n').length + 1
        } else {
          newCode = currentCode.trimEnd() + '\n\n' + replace.trim() + '\n'
          changePos = currentCode.trimEnd().length + 2
        }
      }
      writtenText = replace.trim()
      summaryText = `Inserted updates into **${target.title}**`
      diffPreview = `\`\`\`markdown\n${replace.trim()}\n\`\`\``
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
        changePos = index
      } else {
        const lines = currentCode.split('\n')
        const lowerTarget = trimmedTarget.toLowerCase()
        let foundLine = -1
        for (let i = 0; i < lines.length; i++) {
          if (lines[i].toLowerCase().includes(lowerTarget)) {
            foundLine = i
            break
          }
        }

        if (foundLine !== -1) {
          const beforeLines = lines.slice(0, foundLine)
          const afterLines = lines.slice(foundLine)
          newCode = [...beforeLines, replace.trim(), '', ...afterLines].join('\n')
          changeLine = foundLine + 1
          changePos = beforeLines.join('\n').length
        } else {
          newCode = replace.trim() + '\n\n' + currentCode
          changePos = 0
          changeLine = 1
        }
      }
      writtenText = replace.trim()
      summaryText = `Prepended updates to **${target.title}**`
      diffPreview = `\`\`\`markdown\n${replace.trim()}\n\`\`\``
    } else if (search !== undefined) {
      const normSearch = normalize(search).trim()
      const words = normSearch.split(/\s+/).filter(Boolean)

      if (search === '') {
        newCode = (replace ?? '') + '\n' + currentCode
        writtenText = replace ?? ''
        summaryText = `Updated top of **${target.title}**`
        changePos = 0
        changeLine = 1
      } else if (currentCode.includes(search)) {
        changePos = currentCode.indexOf(search)
        newCode = currentCode.replace(search, replace ?? '')
        writtenText = replace ?? ''
        summaryText = `Updated targeted section in **${target.title}**`
      } else {
        const blocks = currentCode.split(/\n{2,}/)
        let matchedBlockIdx = -1

        for (let i = 0; i < blocks.length; i++) {
          const block = blocks[i]
          const normBlock = normalize(block).trim()

          if (normBlock === normSearch || normBlock.includes(normSearch) || normSearch.includes(normBlock)) {
            matchedBlockIdx = i
            break
          }

          if (words.length >= 4) {
            const startWords = words.slice(0, Math.min(5, words.length)).join(' ').toLowerCase()
            const endWords = words.slice(-Math.min(4, words.length)).join(' ').toLowerCase()
            const lowerBlock = normBlock.toLowerCase()
            if (lowerBlock.includes(startWords) && lowerBlock.includes(endWords)) {
              matchedBlockIdx = i
              break
            }
          }
        }

        if (matchedBlockIdx !== -1) {
          let lineCount = 1
          for (let k = 0; k < matchedBlockIdx; k++) {
            lineCount += blocks[k].split('\n').length + 1
          }
          changeLine = lineCount

          let cleanReplace = (replace ?? '').trim()
          const blockHeading = blocks[matchedBlockIdx].match(/^(#{1,6}\s+[^\r\n]+[\r\n]*)/)
          if (blockHeading && !/^#{1,6}\s+/.test(cleanReplace)) {
            cleanReplace = blockHeading[1].trim() + '\n\n' + cleanReplace
          }

          blocks[matchedBlockIdx] = cleanReplace
          newCode = blocks.join('\n\n')
          writtenText = cleanReplace
          summaryText = `Updated targeted paragraph in **${target.title}**`
          changePos = blocks.slice(0, matchedBlockIdx).join('\n\n').length + 2
        } else {
          const currentLines = currentCode.split('\n')
          const searchLines = normSearch.split('\n').map((l: string) => l.trim()).filter(Boolean)
          let matchIdx = -1
          let matchLen = 0

          if (searchLines.length > 0) {
            for (let i = 0; i <= currentLines.length - searchLines.length; i++) {
              let allMatch = true
              for (let j = 0; j < searchLines.length; j++) {
                if (normalize(currentLines[i + j]).trim() !== searchLines[j]) {
                  allMatch = false
                  break
                }
              }
              if (allMatch) {
                matchIdx = i
                matchLen = searchLines.length
                break
              }
            }
          }

          if (matchIdx !== -1) {
            const before = currentLines.slice(0, matchIdx).join('\n')
            const after = currentLines.slice(matchIdx + matchLen).join('\n')
            newCode = (before ? before + '\n' : '') + (effectiveReplace ?? '') + (after ? '\n' + after : '')
            writtenText = effectiveReplace ?? ''
            summaryText = `Updated targeted block in **${target.title}**`
            changeLine = matchIdx + 1
            changePos = before ? before.length + 1 : 0
          } else {
            const escaped = search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
            const regex = new RegExp(escaped, 'i')
            if (regex.test(currentCode)) {
              changePos = currentCode.search(regex)
              newCode = currentCode.replace(regex, effectiveReplace ?? '')
              writtenText = effectiveReplace ?? ''
              summaryText = `Updated targeted section in **${target.title}**`
            } else if (effectiveReplace !== undefined) {
              const currentLines2 = currentCode.split('\n')
              let titleLineIdx = -1
              for (let i = 0; i < currentLines2.length; i++) {
                if (currentLines2[i].match(/^#\s+/)) {
                  titleLineIdx = i
                  break
                }
              }
              let firstSubheadingIdx = currentLines2.length
              const searchStart = titleLineIdx !== -1 ? titleLineIdx + 1 : 0
              for (let j = searchStart; j < currentLines2.length; j++) {
                if (currentLines2[j].match(/^#{1,6}\s+/)) {
                  firstSubheadingIdx = j
                  break
                }
              }
              const beforeLines = titleLineIdx !== -1 ? currentLines2.slice(0, titleLineIdx + 1) : []
              const afterLines = currentLines2.slice(firstSubheadingIdx)
              newCode = [...beforeLines, '', effectiveReplace.trim(), '', ...afterLines].join('\n')
              writtenText = effectiveReplace.trim()
              summaryText = `Updated opening section in **${target.title}**`
              changeLine = titleLineIdx !== -1 ? titleLineIdx + 2 : 1
              changePos = beforeLines.length > 0 ? beforeLines.join('\n').length + 1 : 0
            } else {
              return {
                success: false,
                error: `Target text to replace was not found in "${target.title}". Tip: specify sectionHeader to update by heading.`
              }
            }
          }
        }
      }
      diffPreview = `\`\`\`markdown\n${effectiveReplace ?? ''}\n\`\`\``
    } else if (content !== undefined) {
      const trimmedContent = content.trim()
      const contentLines = trimmedContent.split('\n')
      const firstLine = contentLines[0] || ''
      const hasHeading = /^#{1,6}\s+/.test(firstLine)

      const isMuchShorter = currentCode.length > 400 && trimmedContent.length < currentCode.length * 0.5
      const isMissingMainTitle = !firstLine.startsWith('# ')

      if (isMuchShorter && isMissingMainTitle) {
        const currentLines = currentCode.split('\n')
        if (hasHeading) {
          const hMatch = firstLine.match(/^(#{1,6})\s+(.*)$/)
          const level = hMatch ? hMatch[1].length : 2
          const hText = hMatch ? hMatch[2].trim().toLowerCase() : ''

          let matchIdx = -1
          for (let i = 0; i < currentLines.length; i++) {
            const lMatch = currentLines[i].match(/^(#{1,6})\s+(.*)$/)
            if (lMatch && (lMatch[2].toLowerCase().includes(hText) || hText.includes(lMatch[2].toLowerCase()))) {
              matchIdx = i
              break
            }
          }

          if (matchIdx !== -1) {
            let endIdx = currentLines.length
            for (let j = matchIdx + 1; j < currentLines.length; j++) {
              const nH = currentLines[j].match(/^(#{1,6})\s+/)
              if (nH && nH[1].length <= level) {
                endIdx = j
                break
              }
            }
            const beforeLines = currentLines.slice(0, matchIdx)
            newCode = [...beforeLines, trimmedContent, '', ...currentLines.slice(endIdx)].join('\n')
            writtenText = trimmedContent
            summaryText = `Updated section \`${firstLine}\` in **${target.title}**`
            changeLine = matchIdx + 1
            changePos = beforeLines.length > 0 ? beforeLines.join('\n').length + 1 : 0
          } else {
            newCode = currentCode.trimEnd() + '\n\n' + trimmedContent + '\n'
            writtenText = trimmedContent
            summaryText = `Appended updates to **${target.title}**`
            changePos = currentCode.trimEnd().length + 2
          }
        } else {
          let titleLineIdx = -1
          for (let i = 0; i < currentLines.length; i++) {
            if (currentLines[i].match(/^#\s+/)) {
              titleLineIdx = i
              break
            }
          }

          let firstSubheadingIdx = currentLines.length
          const searchStart = titleLineIdx !== -1 ? titleLineIdx + 1 : 0
          for (let j = searchStart; j < currentLines.length; j++) {
            if (currentLines[j].match(/^#{1,6}\s+/)) {
              firstSubheadingIdx = j
              break
            }
          }

          const beforeLines = titleLineIdx !== -1 ? currentLines.slice(0, titleLineIdx + 1) : []
          const afterLines = currentLines.slice(firstSubheadingIdx)
          newCode = [...beforeLines, '', trimmedContent, '', ...afterLines].join('\n')
          writtenText = trimmedContent
          summaryText = `Updated opening section in **${target.title}**`
          changeLine = titleLineIdx !== -1 ? titleLineIdx + 2 : 1
          changePos = beforeLines.length > 0 ? beforeLines.join('\n').length + 1 : 0
        }
      } else {
        newCode = content
        writtenText = content
        summaryText = `Updated **${target.title}**`
      }
      diffPreview = `\`\`\`markdown\n${writtenText.slice(0, 300)}${writtenText.length > 300 ? '...' : ''}\n\`\`\``
    } else {
      return {
        success: false,
        error: 'Must provide `sectionHeader`, `search` & `replace`, `insertAfter`, `insertBefore`, or `content`'
      }
    }

    // Auto-heal duplicate consecutive headings if any were created
    newCode = newCode.replace(/^(#{1,6}\s+[^\r\n]+)\r?\n+(?:\1\r?\n*)+/gm, '$1\n\n')

    const isCurrentlySelected = vs.selectedNote?.id === target.id
    if (isCurrentlySelected && vs.setSelectedNote) {
      vs.setSelectedNote({ ...target, code: newCode })
    }

    try {
      const { streamCodeToEditor } = await import('../services/editorStreamer')
      await streamCodeToEditor({
        targetId: target.id,
        oldCode: currentCode,
        newCode: newCode,
        changePos,
        changeLine,
        scrollToBottom: false,
        isCurrentlySelected
      })
    } catch (_) {
      window.dispatchEvent(
        new CustomEvent('ai-saved-snippet', {
          detail: {
            id: target.id,
            code: newCode,
            title: target.title,
            changePos,
            changeLine,
            scrollToBottom: false
          }
        })
      )
    }

    const saveAction = vs.saveNote || vs.saveSnippet
    const updated = saveAction ? await saveAction({ ...target, code: newCode }) : null
    if (isCurrentlySelected && vs.setSelectedNote) {
      vs.setSelectedNote(updated || { ...target, code: newCode })
    }

    const oldWords = currentCode.trim() ? currentCode.trim().split(/\s+/).length : 0
    const newWords = newCode.trim() ? newCode.trim().split(/\s+/).length : 0

    let addedWords = 0
    let removedWords = 0
    if (search !== undefined && replace !== undefined) {
      removedWords = search.trim() ? search.trim().split(/\s+/).length : 0
      addedWords = replace.trim() ? replace.trim().split(/\s+/).length : 0
    } else if (sectionHeader && replace !== undefined) {
      const oldSectionWords = oldSectionContent ? (oldSectionContent as string).trim().split(/\s+/).length : 0
      removedWords = oldSectionWords
      addedWords = replace.trim() ? replace.trim().split(/\s+/).length : 0
    } else if (content !== undefined) {
      removedWords = oldWords
      addedWords = newWords
    } else {
      const diff = newWords - oldWords
      if (diff >= 0) addedWords = diff
      else removedWords = Math.abs(diff)
    }

    if (addedWords === 0 && removedWords === 0 && newCode !== currentCode) {
      addedWords = Math.max(1, Math.abs(newWords - oldWords))
    }

    const diffBadge = `(+${addedWords}${removedWords > 0 ? `, -${removedWords}` : ''})`

    return {
      success: true,
      title: target.title,
      writtenContent: writtenText || newCode,
      diffPreview: diffPreview,
      summary: `✏️ Updated [[${target.title}]] ${diffBadge}`,
      instruction_to_ai:
        'Targeted update applied successfully. In your chat walkthrough, highlight the exact updated part or diff and explain the improvements.'
    }
  }
})
