import * as aiSdk from 'ai'

export const getReadFileTool = (blockReadFile) => {
  if (blockReadFile) return undefined

  return aiSdk.tool({
    description:
      'Read the contents of an existing file. Only use when file content is not already in the prompt or context.',
    inputSchema: aiSdk.jsonSchema({
      type: 'object',
      properties: {
        title: { type: 'string', description: 'The file title to read' }
      },
      required: ['title']
    }),
    execute: async ({ title }) => {
      const { useVaultStore } = await import('../../../core/store/workspaceStore')
      const vs = useVaultStore.getState()
      const snippets = Array.isArray(vs.snippets) ? vs.snippets : Object.values(vs.snippets || {})

      const cleanTitle = title.trim().toLowerCase().replace(/\.md$/, '')
      let target = snippets.find((s) => s.title.toLowerCase().replace(/\.md$/, '') === cleanTitle)
      if (!target) {
        target = snippets.find((s) => s.title.toLowerCase().includes(cleanTitle))
      }
      if (!target) return { success: false, error: `File "${title}" not found.` }

      const rawCode =
        vs.drafts?.[target.id] !== undefined ? vs.drafts[target.id] : target.code || ''
      const MAX_READ_CHARS = 25000
      const isTruncated = rawCode.length > MAX_READ_CHARS
      const safeCode = isTruncated
        ? rawCode.slice(0, MAX_READ_CHARS) +
          `\n\n*(Content truncated for performance: showing first 25,000 of ${rawCode.length} characters. Use sectionHeader or targeted queries to read or update specific parts.)*`
        : rawCode

      return {
        success: true,
        title: target.title,
        content: safeCode,
        writtenContent: `### 📄 ${target.title}\n\n${safeCode}`,
        instruction_to_ai:
          'File read successfully. You MUST now respond to the user and answer based on this content.'
      }
    }
  })
}
