import * as aiSdk from 'ai'
import { luminaMemory } from './luminaMemory'

export const forgetMemoryTool = aiSdk.tool({
  description:
    'Remove or forget a specific fact, preference, or profile detail from memory.json when the user asks to forget, remove, or clear something from memory.',
  inputSchema: aiSdk.jsonSchema({
    type: 'object',
    properties: {
      target: {
        type: 'string',
        description: 'The specific fact, phrase, or detail to remove from memory.'
      },
      key: {
        type: 'string',
        description: 'Optional profile key to clear (e.g. "name", "role", "bio").'
      }
    },
    required: ['target']
  }),
  execute: async ({ target, key = null }) => {
    const res = await luminaMemory.forgetFact({ target, key })
    if (!res.success) {
      return { success: false, error: res.error || 'Failed to forget memory' }
    }
    return {
      success: true,
      summary: res.summary,
      instruction_to_ai: 'Memory removed. Confirm with a single brief, warm sentence. NEVER output a table or list of memory details.'
    }
  }
})

export const forgeMemoryTool = forgetMemoryTool
export default forgetMemoryTool
