import * as aiSdk from 'ai'

export const renameFolderTool = aiSdk.tool({
  description:
    'Rename an existing folder in the workspace to a new name or path. Use this when the user asks to rename a folder (e.g. "Rename folder Science to Natural Sciences", "all folder must be lowercase").',
  inputSchema: aiSdk.jsonSchema({
    type: 'object',
    properties: {
      oldPath: {
        type: 'string',
        description: 'The current folder name or path (e.g. "1-Src", "Science", "Projects/V1")'
      },
      newPath: {
        type: 'string',
        description: 'The new folder name or path (e.g. "1-src", "Natural Sciences", "Projects/V2")'
      }
    },
    required: ['oldPath', 'newPath']
  }),
  execute: async ({ oldPath, newPath }) => {
    try {
      const cleanOld = (oldPath || '').trim().replace(/^[/\\]+|[/\\]+$/g, '')
      const cleanNew = (newPath || '').trim().replace(/^[/\\]+|[/\\]+$/g, '')

      if (!cleanOld || !cleanNew) {
        return { success: false, error: 'Both old and new folder paths are required.' }
      }

      const { useVaultStore } = await import('../../../core/store/workspaceStore')
      const vs = useVaultStore.getState()
      const existingFolders = vs.folders || []

      const normalize = (f) => (f || '').toLowerCase().replace(/^[/\\]+|[/\\]+$/g, '')
      const matchedFolder = existingFolders.find(
        (f) => normalize(f) === normalize(cleanOld) || normalize(f).endsWith(normalize(cleanOld))
      ) || cleanOld

      if (window.api?.renameFolder) {
        await window.api.renameFolder(matchedFolder, cleanNew)
      } else {
        return { success: false, error: 'renameFolder API is not available' }
      }

      if (vs.loadVault) {
        await vs.loadVault()
      }

      return {
        success: true,
        oldPath: matchedFolder,
        newPath: cleanNew,
        summary: `Renamed folder **${matchedFolder}** to **${cleanNew}**.`,
        instruction_to_ai: `Folder "${matchedFolder}" was successfully renamed to "${cleanNew}".`
      }
    } catch (err) {
      return { success: false, error: err.message || 'Failed to rename folder' }
    }
  }
})
