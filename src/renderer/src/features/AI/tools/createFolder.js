import * as aiSdk from 'ai'

export const createFolderTool = aiSdk.tool({
  description:
    'Create a new folder in the workspace. IMPORTANT: If the user asked to create a folder AND notes/plans/expenses/summaries inside or outside of it, you MUST also call createFile for each requested note in this turn. Do not stop after creating only the folder.',
  inputSchema: aiSdk.jsonSchema({
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: 'The folder name or relative path to create (e.g. "Science", "Mathematics", "Projects/Frontend")'
      }
    },
    required: ['path']
  }),
  execute: async ({ path }) => {
    try {
      const cleanPath = (path || '').trim().replace(/^[/\\]+|[/\\]+$/g, '')
      if (!cleanPath) {
        return { success: false, error: 'Folder path cannot be empty.' }
      }

      if (window.api?.createFolder) {
        await window.api.createFolder(cleanPath)
      }

      const { useVaultStore } = await import('../../../core/store/workspaceStore')
      const vs = useVaultStore.getState()
      if (vs.loadVault) {
        await vs.loadVault()
      }

      window.dispatchEvent(
        new CustomEvent('reveal-folder-in-explorer', {
          detail: { folderId: cleanPath }
        })
      )

      return {
        success: true,
        path: cleanPath,
        summary: `Created folder **${cleanPath}**.`,
        instruction_to_ai: `Folder "${cleanPath}" created successfully. If the user requested notes, plans, expense files, or summaries, IMMEDIATELY continue calling createFile for each one now until all items are created.`
      }
    } catch (err) {
      return { success: false, error: err.message || 'Failed to create folder' }
    }
  }
})
