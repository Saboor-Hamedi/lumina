import * as aiSdk from 'ai'

export const createFileTool = aiSdk.tool({
  description:
    'Create a new note or document in the workspace. If the destination folder does not exist, it will be automatically created. You can call createFile multiple times in a single turn to create all requested notes, expense logs, plans, and summaries at once. Note: created files are saved silently in the workspace in the background and are NOT opened as tabs.',
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
      let rawTitle = (title || 'Untitled')
        .trim()
        .replace(/^@/, '')
        .replace(/\.md$/i, '')
        .replace(/\\/g, '/')
      let rawFolder = (folder || '')
        .trim()
        .replace(/\\/g, '/')
        .replace(/^\/+|\/+$/g, '')

      // If title itself has a folder path (e.g. "Database/Schema/Introduction" or "Database/Schema")
      if (rawTitle.includes('/')) {
        const parts = rawTitle.split('/').filter(Boolean)
        const extractedTitle = parts.pop() || 'Untitled'
        const titleFolder = parts.join('/')
        rawFolder = rawFolder ? `${rawFolder}/${titleFolder}` : titleFolder
        rawTitle = extractedTitle
      }

      const cleanTitle = rawTitle.trim() || 'Untitled'
      const cleanFolder = rawFolder.replace(/^\/+|\/+$/g, '')

      const { useVaultStore } = await import('../../../core/store/workspaceStore')
      const vs = useVaultStore.getState()

      if (cleanFolder && window.api?.createFolder) {
        try {
          await window.api.createFolder(cleanFolder)
        } catch (_) {}
      }

      if (cleanFolder && vs.addFolder) {
        vs.addFolder(cleanFolder)
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

      const folderContext = cleanFolder ? ` in \`${cleanFolder}\`` : ''
      const wordCount = (content || '').trim() ? (content || '').trim().split(/\s+/).length : 0

      return {
        success: true,
        id: targetSnippet.id,
        title: targetSnippet.title,
        folderId: targetSnippet.folderId,
        writtenContent: content,
        topics: headers.slice(0, 8),
        wikilinks: wikilinks.slice(0, 10),
        summary: `📝 Created [[${targetSnippet.title}]]${folderContext} (+${wordCount})`,
        instruction_to_ai: `File "${targetSnippet.title}" was created${folderContext} in the workspace in the background. It is NOT opened as a tab. Do not call openFile. If additional files, plans, expenses, or summaries were requested, continue calling createFile for each remaining file now. Once all files are created, provide a rich, structured feedback walkthrough in chat.`
      }
    } catch (err) {
      return { success: false, error: err.message || 'Failed to create file' }
    }
  }
})
