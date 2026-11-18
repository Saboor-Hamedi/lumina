import * as aiSdk from 'ai'
import type { AIToolExecutionResult } from '../types/ai.types'
import { undoAIChanges } from '../safety'

interface UndoChangesInput {
  targetFile?: string
}

/**
 * Allows Lumina AI to undo its own recent file/note edits (single file or all
 * changes from the previous AI turn) when requested by the user.
 */
export const undoChangesTool = aiSdk.tool({
  description:
    'Undo recent file/note changes made by Lumina AI. Can revert a specific file by name/path or revert all files modified in the last AI turn.',
  inputSchema: aiSdk.jsonSchema<UndoChangesInput>({
    type: 'object',
    properties: {
      targetFile: {
        type: 'string',
        description:
          'Optional file name or path to undo only that file. Omit to undo all changes from the last AI turn.'
      }
    }
  }),
  execute: async ({ targetFile }: UndoChangesInput): Promise<AIToolExecutionResult> => {
    const result = await undoAIChanges(targetFile)
    return {
      success: result.success,
      summary: result.message,
      revertedCount: result.revertedCount,
      revertedFiles: result.revertedFiles
    } as AIToolExecutionResult
  }
})
