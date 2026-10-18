import * as aiSdk from 'ai'
import type { AIToolExecutionResult } from '../types/ai.types'

interface CreateFileInput {
  title: string
  content: string
  folder?: string
  tags?: string | string[]
  ifExists?: 'upsert' | 'overwrite' | 'rename' | 'error'
}

export const createFileTool = aiSdk.tool({
  description:
    'Create a new note or document in the workspace. If the destination folder does not exist, it will be automatically created. If a note with the same title already exists in the destination folder, it updates that note in place by default (`ifExists: "upsert"`) to prevent duplicates. When creating multiple files, output a short narration line before creating each file, invoke createFile, and repeat. Note: created files are saved silently in the workspace in the background and are NOT opened as tabs.',
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
      },
      tags: {
        type: 'array',
        items: { type: 'string' },
        description: 'Optional tags to associate with the note.'
      },
      ifExists: {
        type: 'string',
        enum: ['upsert', 'overwrite', 'rename', 'error'],
        description:
          'Behavior when a note with the same title already exists in the target folder. Defaults to "upsert" (reuses existing note ID to avoid duplicate files).'
      }
    },
    required: ['title', 'content']
  }),
  execute: async ({ title, content, folder, tags, ifExists = 'upsert' }): Promise<AIToolExecutionResult> => {
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
      const existingNotes: any[] = Array.isArray(vs.notes) ? vs.notes : []

      const normalizeFolder = (f: string) =>
        String(f || '')
          .replace(/\\/g, '/')
          .replace(/^\/+|\/+$/g, '')
          .toLowerCase()
      const normalizeTitle = (t: string) =>
        String(t || '')
          .trim()
          .replace(/\.md$/i, '')
          .toLowerCase()

      const existingMatch = existingNotes.find(
        (n: any) =>
          normalizeTitle(n.title) === normalizeTitle(cleanTitle) &&
          normalizeFolder(n.folderId) === normalizeFolder(cleanFolder)
      )

      if (existingMatch && ifExists === 'error') {
        return {
          success: false,
          error: `Note "${cleanTitle}" already exists${cleanFolder ? ` in folder "${cleanFolder}"` : ''}. Use updateFile to modify it or pass ifExists: "upsert" | "rename".`
        }
      }

      if (existingMatch && ifExists === 'rename') {
        let suffix = 2
        while (
          existingNotes.some(
            (n: any) =>
              normalizeTitle(n.title) === normalizeTitle(`${cleanTitle} (${suffix})`) &&
              normalizeFolder(n.folderId) === normalizeFolder(cleanFolder)
          )
        ) {
          suffix++
        }
        cleanTitle = `${cleanTitle} (${suffix})`
      }

      if (cleanFolder && (window as any).api?.createFolder) {
        try {
          await (window as any).api.createFolder(cleanFolder)
        } catch (_) {}
      }

      if (cleanFolder && vs.addFolder) {
        vs.addFolder(cleanFolder)
      }

      const normalizedTags = Array.isArray(tags)
        ? tags.map((t) => String(t).trim().replace(/^#/, '')).filter(Boolean)
        : typeof tags === 'string'
          ? tags
              .split(',')
              .map((t) => t.trim().replace(/^#/, ''))
              .filter(Boolean)
          : undefined

      const reusedExisting = Boolean(existingMatch && (ifExists === 'upsert' || ifExists === 'overwrite'))
      const previousContent = reusedExisting ? existingMatch.code || '' : undefined

      const note: Record<string, any> = {
        ...(reusedExisting ? existingMatch : {}),
        id: reusedExisting ? existingMatch.id : crypto.randomUUID(),
        title: cleanTitle,
        code: content || '',
        folderId: cleanFolder || '',
        language: 'markdown',
        timestamp: Date.now()
      }
      if (normalizedTags && normalizedTags.length > 0) {
        note.tags = normalizedTags
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

      const headers = ((content || '').match(/^#{1,3}\s+(.+)$/gm) || []).map((h) =>
        h.replace(/^#{1,3}\s+/, '')
      )

      const wikilinks = ((content || '').match(/\[\[(.*?)\]\]/g) || []).map((w) =>
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
        reusedExisting,
        previousContent,
        newContent: content || '',
        writtenContent: content,
        topics: headers.slice(0, 8),
        wikilinks: wikilinks.slice(0, 10),
        tags: normalizedTags,
        summary: `📝 ${reusedExisting ? 'Updated existing' : 'Created'} [[${targetNote.title}]]${folderContext} (+${wordCount} words, ${charCount} chars)`,
        instruction_to_ai: `File "${targetNote.title}" was ${reusedExisting ? 'updated in place' : 'created'}${folderContext} in the workspace in the background. It is NOT opened as a tab. Do not call openFile. If more files are needed, output a brief narration line for the next file and invoke createFile for it. Once all requested items are created, provide a final short walkthrough in chat.`
      }
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to create file' }
    }
  }
})
