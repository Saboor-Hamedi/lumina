import * as aiSdk from 'ai'

export const moveFileTool = aiSdk.tool({
  description:
    'Move a note file (or all notes from a folder) into a specific folder, from one folder to another, or move it back to the root level. Use this when the user asks to move files (e.g. "Move Physics to Science", "Move my file from Archive to Active", "Move my current file into Projects", "Put this note in Archive").',
  inputSchema: aiSdk.jsonSchema({
    type: 'object',
    properties: {
      title: {
        type: 'string',
        description:
          'The title or path of the note to move (e.g. "Physics", "OldFolder/Physics", "current", "active", or "all").'
      },
      folder: {
        type: 'string',
        description:
          'The destination folder name or path (e.g. "Science", "Projects/Frontend", "Mathematics"). Use empty string "" to move to the root workspace level.'
      },
      fromFolder: {
        type: 'string',
        description: 'Optional. The source folder where the note currently resides.'
      },
      newFolderId: {
        type: 'string',
        description: 'Alias for folder.'
      }
    },
    required: ['folder']
  }),
  execute: async ({ title, folder, fromFolder, newFolderId }) => {
    try {
      const targetFolder = (folder !== undefined ? folder : newFolderId || '')
        .trim()
        .replace(/^[/\\]+|[/\\]+$/g, '')
      const sourceFolder = (fromFolder || '').trim().replace(/^[/\\]+|[/\\]+$/g, '')

      const { useVaultStore } = await import('../../../core/store/workspaceStore')
      const vs = useVaultStore.getState()
      const snippets = Array.isArray(vs.snippets)
        ? vs.snippets
        : Array.from(vs.snippets?.values?.() || [])

      if (targetFolder && window.api?.createFolder) {
        try {
          await window.api.createFolder(targetFolder)
        } catch (_) {}
      }

      const rawTitle = (title || '').trim().replace(/^@/, '')
      const isAll =
        rawTitle.toLowerCase() === 'all' ||
        rawTitle.toLowerCase() === 'all files' ||
        rawTitle.toLowerCase() === '*' ||
        rawTitle.toLowerCase() === 'all notes'

      if (isAll) {
        const sourceNotes = snippets.filter((s) => {
          const sFolder = (s.folderId || '').replace(/^[/\\]+|[/\\]+$/g, '')
          return sourceFolder ? sFolder === sourceFolder : true
        })

        if (sourceNotes.length === 0) {
          return {
            success: false,
            error: sourceFolder
              ? `No notes found in folder "${sourceFolder}".`
              : 'No notes found in workspace.'
          }
        }

        for (const s of sourceNotes) {
          await vs.saveSnippet({ ...s, folderId: targetFolder })
        }

        if (vs.loadVault) {
          await vs.loadVault()
        }

        const destName = targetFolder ? `folder "${targetFolder}"` : 'root workspace level'
        return {
          success: true,
          movedCount: sourceNotes.length,
          folder: targetFolder,
          summary: `Moved ${sourceNotes.length} note(s) to ${destName}.`,
          instruction_to_ai: `Moved ${sourceNotes.length} note(s) to ${destName} successfully.`
        }
      }

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
        const baseName = cleanLower.split(/[/\\]/).pop()

        const candidates = sourceFolder
          ? snippets.filter((s) => (s.folderId || '').replace(/^[/\\]+|[/\\]+$/g, '') === sourceFolder)
          : snippets

        target = candidates.find((s) => {
          const sTitle = (s.title || '').toLowerCase().replace(/\.md$/i, '')
          const sFile = (s.fileName || '').toLowerCase().replace(/\.md$/i, '')
          const sRel = (s.folderId ? `${s.folderId}/${s.fileName || s.title}` : s.fileName || s.title)
            .toLowerCase()
            .replace(/\.md$/i, '')
          return sTitle === cleanLower || sFile === cleanLower || sRel === cleanLower || sTitle === baseName || sFile === baseName
        })

        if (!target) {
          target = candidates.find((s) => {
            const sTitle = (s.title || '').toLowerCase().replace(/\.md$/i, '')
            return sTitle.includes(baseName)
          })
        }
      }

      if (!target) {
        return {
          success: false,
          error: `Note "${rawTitle || 'current'}" not found in workspace.`
        }
      }

      const updated = {
        ...target,
        folderId: targetFolder
      }

      const saved = await vs.saveSnippet(updated)
      const finalSnippet = saved || updated

      if (vs.loadVault) {
        await vs.loadVault()
      }

      if (vs.setSelectedSnippet) {
        vs.setSelectedSnippet(finalSnippet)
      }
      if (vs.setActiveTabId) {
        vs.setActiveTabId(finalSnippet.id)
      }

      window.dispatchEvent(
        new CustomEvent('ai-saved-snippet', {
          detail: { id: finalSnippet.id, code: finalSnippet.code, title: finalSnippet.title }
        })
      )

      const destName = targetFolder ? `folder "${targetFolder}"` : 'root workspace level'

      return {
        success: true,
        title: finalSnippet.title,
        folder: targetFolder,
        summary: `Moved **${finalSnippet.title}** to ${destName}.`,
        instruction_to_ai: `Note "${finalSnippet.title}" was moved to ${destName} successfully. Inform the user in a short and friendly sentence.`
      }
    } catch (err) {
      return { success: false, error: err.message || 'Failed to move file' }
    }
  }
})
