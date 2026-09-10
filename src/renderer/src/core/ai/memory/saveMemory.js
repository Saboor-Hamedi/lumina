import * as aiSdk from 'ai'
import { luminaMemory } from './luminaMemory'

/**
 * saveMemory Tool
 *
 * Saves a new fact, preference, user profile detail, or ongoing context
 * into Lumina's persistent memory.json file.
 *
 * Usage guidelines:
 * - Automatically invoked when the user shares personal details (e.g. "My name is...", "I am a developer").
 * - Invoked when the user explicitly commands: "Remember that...", "Keep in mind that...", "Save this to memory".
 * - Can update user profile fields (name, role, bio) or append to preferences/facts.
 */
export const saveMemoryTool = aiSdk.tool({
  description:
    'Permanently save a user fact, preference, profile attribute, or context into memory.json. Call this whenever the user shares personal details or asks you to remember something.',
  inputSchema: aiSdk.jsonSchema({
    type: 'object',
    properties: {
      fact: {
        type: 'string',
        description: 'The fact, preference, or detail to save in persistent memory.'
      },
      category: {
        type: 'string',
        enum: ['facts', 'preferences', 'user'],
        description: 'The memory category: "user" for identity (name/role/bio), "preferences" for user habits/styles, or "facts" for general context.'
      },
      key: {
        type: 'string',
        description: 'Optional attribute key when category is "user", e.g. "name", "role", or "bio".'
      }
    },
    required: ['fact']
  }),
  execute: async ({ fact, category = 'facts', key = null }) => {
    const res = await luminaMemory.saveFact({ fact, category, key })
    if (!res.success) {
      return { success: false, error: res.error || 'Failed to save memory' }
    }
    return {
      success: true,
      summary: res.summary,
      instruction_to_ai: 'Memory saved. Respond with a single brief, warm sentence (e.g. "Got it! I\'ve saved that to memory."). NEVER output a table, bulleted dump, or list of memory details unless the user explicitly asked to see their memory.'
    }
  }
})

export default saveMemoryTool
