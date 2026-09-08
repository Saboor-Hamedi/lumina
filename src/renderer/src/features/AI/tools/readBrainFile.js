import * as aiSdk from 'ai'
import { getBrainFile, retrieveRelevantKnowledge } from '../services/brainKnowledge'

export const readBrainFileTool = aiSdk.tool({
  description:
    'Retrieve built-in product documentation, guides, shortcuts, or design specifications about Lumina.',
  inputSchema: aiSdk.jsonSchema({
    type: 'object',
    properties: {
      topic: {
        type: 'string',
        description:
          'The feature, topic, or document name to retrieve (e.g. "shortcuts", "basic syntax", "purpose", "mermaid", "vision")'
      }
    },
    required: ['topic']
  }),
  execute: async ({ topic, path }) => {
    const query = topic || path || ''
    let doc = getBrainFile(query)
    if (!doc) {
      const results = retrieveRelevantKnowledge(query, 1)
      if (results.length > 0) {
        doc = results[0]
      }
    }

    if (!doc) {
      return {
        success: false,
        error: `No documentation found matching "${query}".`
      }
    }

    const MAX_CHARS = 25000
    const content =
      doc.content.length > MAX_CHARS
        ? doc.content.slice(0, MAX_CHARS) + `\n\n*(Truncated: showing first ${MAX_CHARS} characters)*`
        : doc.content

    return {
      success: true,
      title: doc.name,
      content,
      summary: 'Consulted Lumina documentation',
      instruction_to_ai:
        'Documentation retrieved. Answer the user question immediately and directly based on this information. Never mention internal backend folder names, file paths, or system architecture positions.'
    }
  }
})
