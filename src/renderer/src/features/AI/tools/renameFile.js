import * as aiSdk from 'ai'

export const renameFileTool = aiSdk.tool({
  description:
    'Rename an existing workspace note file to a new title. Use this whenever the user asks to rename a file, simplify file names, rename files in a folder, or change note titles. You can specify oldTitle (e.g. "1-src/My Note" or "My Note") and newTitle (e.g. "Note"). For batch rename requests, call renameFile for each file.',
  inputSchema: aiSdk.jsonSchema({
    type: 'object',
    properties: {
      oldTitle: {
        type: 'string',
        description: 'The current file title to rename (or "1-src/Note Title", or "current" for active note).'
      },
      newTitle: {
        type: 'string',
        description: 'The new title (no file extension).'
      },
      folder: {
        type: 'string',
        description: 'Optional folder path containing the file (e.g. "1-src").'
      }
    },
    required: ['oldTitle', 'newTitle']
  }),
  execute: async ({ oldTitle, newTitle, folder }) => {
    try {
      let cleanNewTitle = (newTitle || '')
        .trim()
        .replace(/^@/, '')
        .replace(/\.md$/i, '')
      if (cleanNewTitle.includes('/') || cleanNewTitle.includes('\\')) {
        cleanNewTitle = cleanNewTitle.split(/[/\\]+/).pop().trim()
      }
      if (!cleanNewTitle) {
        return { success: false, error: 'A valid new title is required.' }
      }

      let searchFolder = (folder || '').trim().toLowerCase().replace(/^[/\\]+|[/\\]+$/g, '')
      let cleanOldTitle = (oldTitle || '').trim().replace(/^@/, '')

      if (cleanOldTitle.includes('/') || cleanOldTitle.includes('\\')) {
        const parts = cleanOldTitle.split(/[/\\]+/)
        cleanOldTitle = parts.pop().trim()
        if (!searchFolder) {
          searchFolder = parts.join('/').toLowerCase().replace(/^[/\\]+|[/\\]+$/g, '')
        }
      }

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

        target = snippets.find((s) => {
          const sTitle = normalize(s.title)
          const sFile = normalize(s.fileName)
          const matchTitle = sTitle === normalize(cleanOldTitle) || sFile === normalize(cleanOldTitle)
          if (!matchTitle) return false
          if (searchFolder) {
            const sFolder = (s.folderId || '').toLowerCase().replace(/^[/\\]+|[/\\]+$/g, '')
            return sFolder === searchFolder || sFolder.endsWith(searchFolder) || searchFolder.endsWith(sFolder)
          }
          return true
        })

        if (!target) {
          target = snippets.find((s) => {
            const sTitle = normalize(s.title)
            const matchTitle = sTitle.includes(normalize(cleanOldTitle)) || normalize(cleanOldTitle).includes(sTitle)
            if (!matchTitle) return false
            if (searchFolder) {
              const sFolder = (s.folderId || '').toLowerCase().replace(/^[/\\]+|[/\\]+$/g, '')
              return sFolder === searchFolder || sFolder.endsWith(searchFolder) || searchFolder.endsWith(sFolder)
            }
            return true
          })
        }

        if (!target && searchFolder) {
          target = snippets.find((s) => {
            const sFolder = (s.folderId || '').toLowerCase().replace(/^[/\\]+|[/\\]+$/g, '')
            return sFolder === searchFolder || sFolder.endsWith(searchFolder)
          })
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
        return { success: false, error: `A file named "${cleanNewTitle}" already exists in folder "${target.folderId || 'root'}".` }
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

      const folderInfo = target.folderId ? ` in \`${target.folderId}\`` : ''

      return {
        success: true,
        oldTitle: target.title,
        newTitle: cleanNewTitle,
        folder: target.folderId || '',
        summary: `Renamed **${target.title}** to **${cleanNewTitle}**${folderInfo}.`,
        instruction_to_ai: `File "${target.title}" was successfully renamed to "${cleanNewTitle}". Confirm this to the user.`
      }
    } catch (err) {
      return { success: false, error: err.message || 'Failed to rename file' }
    }
  }
})
