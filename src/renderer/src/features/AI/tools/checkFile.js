import * as aiSdk from 'ai'

export const checkFileTool = aiSdk.tool({
  description:
    'Check the currently active/focused file in the workspace or inspect details of any specific file. Returns title, word count, line count, folder, tags, and full content so the AI has 100% situational awareness.',
  inputSchema: aiSdk.jsonSchema({
    type: 'object',
    properties: {
      title: {
        type: 'string',
        description: 'Optional file title to check. If omitted, checks the currently active file in the editor.'
      }
    }
  }),
  execute: async ({ title } = {}) => {
    const { useVaultStore } = await import('../../../core/store/useVaultStore')
    const vs = useVaultStore.getState()
    const snippets = Array.from(vs.snippets.values())

    let target = null
    if (title && title.trim()) {
      const cleanTitle = title.trim().toLowerCase().replace(/\.md$/, '')
      target = snippets.find((s) => s.title.toLowerCase().replace(/\.md$/, '') === cleanTitle)
      if (!target) {
        target = snippets.find((s) => s.title.toLowerCase().includes(cleanTitle))
      }
    } else {
      target = vs.selectedSnippet
    }

    if (!target) {
      return {
        success: false,
        error: title ? `File "${title}" not found.` : 'No file is currently open in the editor.',
        instruction_to_ai: 'No active file found. Provide the answer directly in chat.'
      }
    }

    const currentCode =
      vs.drafts?.[target.id] !== undefined ? vs.drafts[target.id] : target.code || ''
    const lines = currentCode.split('\n')
    const wordCount = currentCode.trim() ? currentCode.trim().split(/\s+/).length : 0
    const charCount = currentCode.length

    return {
      success: true,
      file: {
        id: target.id,
        title: target.title,
        folderId: target.folderId || null,
        tags: target.tags || '',
        language: target.language || 'markdown',
        totalLines: lines.length,
        wordCount,
        charCount,
        isActiveFile: vs.selectedSnippet?.id === target.id,
        content: currentCode
      },
      instruction_to_ai:
        'You have the full file details. Now immediately write the full substantive response or edits for the user without any filler preamble.'
    }
  }
})
