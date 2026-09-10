import * as aiSdk from 'ai'
import { luminaMemory } from './luminaMemory'

export const updateMemoryTool = aiSdk.tool({
  description:
    'Update an existing fact, preference, or profile detail in memory.json when the user changes or refines previously remembered information.',
  inputSchema: aiSdk.jsonSchema({
    type: 'object',
    properties: {
      oldFact: {
        type: 'string',
        description: 'The existing fact or phrase to find and replace in memory.'
      },
      newFact: {
        type: 'string',
        description: 'The updated fact or value to replace it with.'
      },
      category: {
        type: 'string',
        enum: ['facts', 'preferences', 'user'],
        description: 'Memory category to update.'
      },
      key: {
        type: 'string',
        description: 'User profile key (e.g. "name", "role") if updating identity.'
      }
    },
    required: ['newFact']
  }),
  execute: async ({ oldFact, newFact, category = 'facts', key = null }) => {
    const res = await luminaMemory.updateFact({ oldFact, newFact, category, key })
    if (!res.success) {
      return { success: false, error: res.error || 'Failed to update memory' }
    }
    return {
      success: true,
      summary: res.summary,
      instruction_to_ai: 'Memory updated successfully. Acknowledge and proceed.'
    }
  }
})

export default updateMemoryTool
