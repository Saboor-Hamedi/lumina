import * as aiSdk from 'ai'
import type { AIToolExecutionResult } from '../types/ai.types'

interface AppendToFileInput {
  title: string
  content: string
  folder?: string
}

export const appendToFileTool = aiSdk.tool({
  description:
    'Append or write new content directly to a note in the workspace editor. Use this whenever the user asks to write, add, or append to an open or mentioned note.',
  inputSchema: aiSdk.jsonSchema<AppendToFileInput>({
    type: 'object',
    properties: {
      title: { type: 'string', description: 'The file title or "Folder/Title" path' },
      content: { type: 'string', description: 'The new content to write/append to the file' },
      folder: { type: 'string', description: 'Optional workspace folder path containing the file' }
    },
    required: ['title', 'content']
  }),
  execute: async ({ title, content, folder }): Promise<AIToolExecutionResult> => {
    const { useWorkspaceStore } = await import('../../../core/store/workspaceStore')
    const { normalizeTitle } = await import('../services/prompt/mentionResolver')
    const vs = (useWorkspaceStore as any).getState()
    const snippets = (Array.isArray(vs.notes) && vs.notes.length > 0 ? vs.notes : vs.snippets) || []

    const rawInput = (title || '').trim().replace(/^@/, '').replace(/\\/g, '/').replace(/\.md$/i, '')
    let cleanTitle = rawInput.toLowerCase()
    let cleanFolder = (folder || '').trim().replace(/\\/g, '/').replace(/^\/+|\/+$/g, '').toLowerCase()
    if (rawInput.includes('/')) {
      const parts = rawInput.split('/').filter(Boolean)
      cleanTitle = (parts.pop() || '').toLowerCase()
      const titleFolder = parts.join('/').toLowerCase()
      cleanFolder = cleanFolder ? `${cleanFolder}/${titleFolder}` : titleFolder
    }

    const matchesFolder = (s: any) => {
      if (!cleanFolder) return true
      const nf = String(s?.folderId || '').replace(/\\/g, '/').replace(/^\/+|\/+$/g, '').toLowerCase()
      return nf === cleanFolder || nf.endsWith(`/${cleanFolder}`)
    }

    let target = snippets.find(
      (s: any) =>
        matchesFolder(s) &&
        ((s.title || '').toLowerCase().replace(/\.md$/, '') === cleanTitle ||
          normalizeTitle(s.title) === normalizeTitle(cleanTitle))
    )
    if (!target) {
      target = snippets.find(
        (s: any) => (s.title || '').toLowerCase().replace(/\.md$/, '') === cleanTitle
      )
    }
    if (!target) {
      target = snippets.find((s: any) => (s.title || '').toLowerCase().includes(cleanTitle))
    }
    if (!target && (vs.selectedNote || vs.selectedSnippet)) {
      target = vs.selectedNote || vs.selectedSnippet
    }
    if (!target) return { success: false, error: `File "${title}" not found.` }

    const currentCode =
      vs.drafts?.[target.id] !== undefined ? vs.drafts[target.id] : target.code || ''
    const separator = currentCode && currentCode.endsWith('\n') ? '\n' : currentCode ? '\n\n' : ''
    const newCode = currentCode + separator + content

    const isCurrentlySelected = vs.selectedNote?.id === target.id

    try {
      const { streamCodeToEditor } = await import('../services/editorStreamer')
      await streamCodeToEditor({
        targetId: target.id,
        oldCode: currentCode,
        newCode: newCode,
        changePos: currentCode.trimEnd().length,
        isCurrentlySelected
      })
    } catch (_) {
      window.dispatchEvent(
        new CustomEvent('ai-saved-snippet', {
          detail: {
            id: target.id,
            code: newCode,
            title: target.title,
            changePos: currentCode.trimEnd().length
          }
        })
      )
    }

    const saveAction = vs.saveNote || vs.saveSnippet
    const updated = saveAction ? await saveAction({ ...target, code: newCode }) : null
    if (isCurrentlySelected && vs.setSelectedNote) {
      vs.setSelectedNote(updated || { ...target, code: newCode })
    }

    const addedWords = (content || '').trim() ? (content || '').trim().split(/\s+/).length : 0

    return {
      success: true,
      id: target.id,
      title: target.title,
      folderId: target.folderId || '',
      previousContent: currentCode,
      newContent: newCode,
      writtenContent: content,
      addedWords,
      summary: `✍️ Appended to [[${target.title}]] (+${addedWords})`,
      instruction_to_ai:
        'Content written successfully. Give a friendly summary of what was written and highlight key wikilinks.'
    }
  }
})
