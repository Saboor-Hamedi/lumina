import * as aiSdk from 'ai'

export const moveFolderTool = aiSdk.tool({
  description:
    'Move an entire folder into another folder, or move it to the root workspace level. Use this whenever the user asks to move a folder (e.g. "Move folder Science to Archive", "Move folder 1-src into src", "Move folder Projects to root").',
  inputSchema: aiSdk.jsonSchema({
    type: 'object',
    properties: {
      sourceFolder: {
        type: 'string',
        description: 'The current folder path to move (e.g. "Science", "Projects/Frontend")'
      },
      targetFolder: {
        type: 'string',
        description:
          'The destination folder path to move into (e.g. "Archive", "src"). Use empty string "" to move the folder to the root workspace level.'
      }
    },
    required: ['sourceFolder']
  }),
  execute: async ({ sourceFolder, targetFolder }) => {
    try {
      const cleanSource = (sourceFolder || '').trim().replace(/^[/\\]+|[/\\]+$/g, '')
      const cleanTarget = (targetFolder || '').trim().replace(/^[/\\]+|[/\\]+$/g, '')

      if (!cleanSource) {
        return { success: false, error: 'Source folder path is required.' }
      }

      const { useWorkspaceStore } = await import('../../../core/store/workspaceStore')
      const vs = useWorkspaceStore.getState()
      const existingFolders = vs.folders || []

      const normalize = (f) => (f || '').toLowerCase().replace(/^[/\\]+|[/\\]+$/g, '')
      const matchedSource = existingFolders.find(
        (f) => normalize(f) === normalize(cleanSource) || normalize(f).endsWith(normalize(cleanSource))
      ) || cleanSource

      const folderName = matchedSource.split('/').pop()
      const newPath = cleanTarget ? `${cleanTarget}/${folderName}` : folderName

      if (normalize(matchedSource) === normalize(newPath)) {
        return {
          success: true,
          oldPath: matchedSource,
          newPath,
          summary: `Folder **${matchedSource}** is already in **${cleanTarget || 'root'}**.`,
          instruction_to_ai: `Folder "${matchedSource}" is already in "${cleanTarget || 'root'}".`
        }
      }

      if (cleanTarget && normalize(cleanTarget).startsWith(`${normalize(matchedSource)}/`)) {
        return {
          success: false,
          error: `Cannot move folder "${matchedSource}" inside its own subfolder "${cleanTarget}".`
        }
      }

      if (window.api?.renameFolder) {
        await window.api.renameFolder(matchedSource, newPath)
      } else {
        return { success: false, error: 'renameFolder API is not available' }
      }

      if (vs.loadWorkspace) {
        await vs.loadWorkspace()
      }

      const destName = cleanTarget ? `folder "${cleanTarget}"` : 'root workspace level'
      return {
        success: true,
        oldPath: matchedSource,
        newPath,
        summary: `Moved folder **${matchedSource}** to ${destName}.`,
        instruction_to_ai: `Folder "${matchedSource}" was moved to ${destName} successfully. All notes inside were relocated silently without opening tabs.`
      }
    } catch (err) {
      return { success: false, error: err.message || 'Failed to move folder' }
    }
  }
})
