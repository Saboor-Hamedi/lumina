import * as aiSdk from 'ai'
import type { AIToolExecutionResult } from '../types/ai.types'

interface AppendToFileInput {
  title: string
  content: string
}

export const appendToFileTool = aiSdk.tool({
  description:
    'Append or write new content directly to a note in the workspace editor. Use this whenever the user asks to write, add, or append to an open or mentioned note.',
  inputSchema: aiSdk.jsonSchema<AppendToFileInput>({
    type: 'object',
    properties: {
      title: { type: 'string', description: 'The file title' },
      content: { type: 'string', description: 'The new content to write/append to the file' }
    },
    required: ['title', 'content']
  }),
  execute: async ({ title, content }): Promise<AIToolExecutionResult> => {
    const { useWorkspaceStore } = await import('../../../core/store/workspaceStore')
    const vs = (useWorkspaceStore as any).getState()
    const snippets = vs.notes || []

    const cleanTitle = (title || '').trim().toLowerCase().replace(/\.md$/, '')
    let target = snippets.find(
      (s: any) => (s.title || '').toLowerCase().replace(/\.md$/, '') === cleanTitle
    )
    if (!target) {
      target = snippets.find((s: any) => (s.title || '').toLowerCase().includes(cleanTitle))
    }
    if (!target && vs.selectedNote) {
      target = vs.selectedNote
    }
    if (!target) return { success: false, error: `File "${title}" not found.` }

    const currentCode =
      vs.drafts?.[target.id] !== undefined ? vs.drafts[target.id] : target.code || ''
    const separator = currentCode && currentCode.endsWith('\n') ? '\n' : currentCode ? '\n\n' : ''
    const newCode = currentCode + separator + content

    const isCurrentlySelected = vs.selectedNote?.id === target.id
    if (isCurrentlySelected && vs.setSelectedNote) {
      vs.setSelectedNote({ ...target, code: newCode })
    }

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
      title: target.title,
      writtenContent: content,
      summary: `✍️ Appended to [[${target.title}]] (+${addedWords})`,
      instruction_to_ai:
        'Content written successfully. Give a friendly summary of what was written and highlight key wikilinks.'
    }
  }
})
