import * as aiSdk from 'ai'

export const createFileTool = aiSdk.tool({
  description:
    'Create a new note file in the workspace editor. Use this whenever the user asks to create, draft, or write a new note or topic file. You can optionally specify a target folder (e.g. folder="Science" or folder="Mathematics/Calculus").',
  inputSchema: aiSdk.jsonSchema({
    type: 'object',
    properties: {
      title: {
        type: 'string',
        description: 'The file title (single word or short phrase, no extension)'
      },
      content: { type: 'string', description: 'Full markdown content' },
      folder: {
        type: 'string',
        description:
          'Optional. The destination folder name or path to create the file in (e.g., "Science", "Projects/Frontend", "Mathematics"). If root level, leave empty or undefined.'
      }
    },
    required: ['title', 'content']
  }),
  execute: async ({ title, content, folder }) => {
    try {
      const cleanTitle = (title || 'Untitled')
        .trim()
        .replace(/^@/, '')
        .replace(/\.md$/i, '')
      const cleanFolder = (folder || '').trim().replace(/^[/\\]+|[/\\]+$/g, '')

      const { useVaultStore } = await import('../../../core/store/workspaceStore')
      const vs = useVaultStore.getState()

      if (cleanFolder && window.api?.createFolder) {
        try {
          await window.api.createFolder(cleanFolder)
        } catch (_) {}
      }

      const snippet = {
        id: crypto.randomUUID(),
        title: cleanTitle,
        code: content || '',
        folderId: cleanFolder || '',
        language: 'markdown',
        timestamp: Date.now()
      }

      const saved = await vs.saveSnippet(snippet)
      const targetSnippet = saved || snippet

      if (vs.loadVault) {
        await vs.loadVault()
      }

      if (vs.setSelectedSnippet) {
        vs.setSelectedSnippet(targetSnippet)
      }
      if (vs.setActiveTabId) {
        vs.setActiveTabId(targetSnippet.id)
      }

      window.dispatchEvent(
        new CustomEvent('ai-saved-snippet', {
          detail: { id: targetSnippet.id, code: targetSnippet.code, title: targetSnippet.title }
        })
      )

      const headers = (content.match(/^#{1,3}\s+(.+)$/gm) || []).map((h) =>
        h.replace(/^#{1,3}\s+/, '')
      )

      const wikilinks = (content.match(/\[\[(.*?)\]\]/g) || []).map((w) =>
        w.replace(/^\[\[|\]\]$/g, '')
      )

      const folderContext = cleanFolder ? ` in folder "${cleanFolder}"` : ''

      return {
        success: true,
        id: targetSnippet.id,
        title: targetSnippet.title,
        folderId: targetSnippet.folderId,
        writtenContent: content,
        topics: headers.slice(0, 8),
        wikilinks: wikilinks.slice(0, 10),
        summary: `Created **${targetSnippet.title}**${folderContext} covering: ${headers.slice(0, 5).join(', ')}.`,
        instruction_to_ai: `File "${targetSnippet.title}" was created${folderContext} and opened in the editor. Now provide a rich, structured feedback walkthrough in chat explaining what was built, highlighting key wikilinks, and discussing the concepts.`
      }
    } catch (err) {
      return { success: false, error: err.message || 'Failed to create file' }
    }
  }
})
