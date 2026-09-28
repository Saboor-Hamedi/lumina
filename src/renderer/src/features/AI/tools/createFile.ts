import * as aiSdk from 'ai'
import type { AIToolExecutionResult } from '../types/ai.types'

interface CreateFileInput {
  title: string
  content: string
  folder?: string
}

export const createFileTool = aiSdk.tool({
  description:
    'Create a new note or document in the workspace. If the destination folder does not exist, it will be automatically created. When creating multiple files, output a short narration line before creating each file, invoke createFile, and repeat. Note: created files are saved silently in the workspace in the background and are NOT opened as tabs.',
  inputSchema: aiSdk.jsonSchema<CreateFileInput>({
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
          'Optional workspace-relative destination folder (e.g. "Science" or "Projects/Frontend"). For the workspace root, leave empty or omit this field; do not use "root" as a folder name.'
      }
    },
    required: ['title', 'content']
  }),
  execute: async ({ title, content, folder }): Promise<AIToolExecutionResult> => {
    try {
      const rawTitle = (title || 'Untitled')
        .trim()
        .replace(/^@/, '')
        .replace(/\.md$/i, '')
        .replace(/\\/g, '/')
      let rawFolder = (folder || '')
        .trim()
        .replace(/\\/g, '/')
        .replace(/^\/+|\/+$/g, '')

      // Treat common model-generated root aliases as the workspace root.
      if (/^(?:root|workspace root|vault root|project root|workspace|vault|\.)$/i.test(rawFolder)) {
        rawFolder = ''
      }

      let cleanTitle = rawTitle
      // If title itself has a folder path (e.g. "Database/Schema/Introduction" or "Database/Schema")
      if (rawTitle.includes('/')) {
        const parts = rawTitle.split('/').filter(Boolean)
        const extractedTitle = parts.pop() || 'Untitled'
        const titleFolder = parts.join('/')
        rawFolder = rawFolder ? `${rawFolder}/${titleFolder}` : titleFolder
        cleanTitle = extractedTitle
      }

      cleanTitle = cleanTitle.trim() || 'Untitled'
      const cleanFolder = /^(?:root|workspace root|vault root|project root|workspace|vault|\.)$/i.test(rawFolder)
        ? ''
        : rawFolder.replace(/^\/+|\/+$/g, '')

      const { useWorkspaceStore } = await import('../../../core/store/workspaceStore')
      const vs = (useWorkspaceStore as any).getState()

      if (cleanFolder && (window as any).api?.createFolder) {
        try {
          await (window as any).api.createFolder(cleanFolder)
        } catch (_) {}
      }

      if (cleanFolder && vs.addFolder) {
        vs.addFolder(cleanFolder)
      }

      const note = {
        id: crypto.randomUUID(),
        title: cleanTitle,
        code: content || '',
        folderId: cleanFolder || '',
        language: 'markdown',
        timestamp: Date.now()
      }

      const saveAction = vs.saveNote || vs.saveSnippet
      const saved = saveAction ? await saveAction(note) : null
      const targetNote = saved || note

      window.dispatchEvent(
        new CustomEvent('ai-saved-note', {
          detail: { id: targetNote.id, code: targetNote.code, title: targetNote.title }
        })
      )
      window.dispatchEvent(
        new CustomEvent('ai-saved-snippet', {
          detail: { id: targetNote.id, code: targetNote.code, title: targetNote.title }
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
      const charCount = (content || '').length

      return {
        success: true,
        id: targetNote.id,
        title: targetNote.title,
        folderId: targetNote.folderId,
        writtenContent: content,
        topics: headers.slice(0, 8),
        wikilinks: wikilinks.slice(0, 10),
        summary: `📝 Created [[${targetNote.title}]]${folderContext} (+${wordCount} words, ${charCount} chars)`,
        instruction_to_ai: `File "${targetNote.title}" was created${folderContext} in the workspace in the background. It is NOT opened as a tab. Do not call openFile. If more files are needed, output a brief narration line for the next file and invoke createFile for it. Once all requested items are created, provide a final short walkthrough in chat.`
      }
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to create file' }
    }
  }
})
