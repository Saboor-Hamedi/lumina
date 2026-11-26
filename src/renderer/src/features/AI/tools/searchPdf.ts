import * as aiSdk from 'ai'
import type { AIToolExecutionResult } from '../types/ai.types'
import { formatPdfHitsForPrompt, searchPdfIndex } from '../../media/pdf'

export interface SearchPdfInput {
  query: string
  relativePath?: string
  limit?: number
}

/**
 * searchPdfTool
 * Performs hybrid (semantic + keyword) retrieval across indexed PDF documents
 * in the workspace and returns page-cited excerpts (`[p. X]`).
 */
export const searchPdfTool = aiSdk.tool({
  description:
    'Search across PDF documents in the workspace using hybrid semantic + keyword search. Returns top relevant passages with exact page numbers so you can cite [p. X]. Optionally restrict to a single PDF relativePath.',
  inputSchema: aiSdk.jsonSchema<SearchPdfInput>({
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Plain-language question, concept, or exact term/table/equation to find inside PDFs.'
      },
      relativePath: {
        type: 'string',
        description: 'Optional workspace-relative path to restrict search to one PDF (e.g. "papers/attention.pdf").'
      },
      limit: {
        type: 'number',
        description: 'Maximum number of page excerpts to return (default 6, max 15).'
      }
    },
    required: ['query']
  }),
  execute: async ({ query, relativePath, limit = 6 }): Promise<AIToolExecutionResult> => {
    try {
      const cleanQuery = String(query || '').trim()
      if (!cleanQuery) {
        return {
          success: false,
          error: 'Please provide a non-empty search query.'
        }
      }

      const cap = Math.min(Math.max(Number(limit) || 6, 1), 15)
      const hits = await searchPdfIndex(cleanQuery, {
        relativePath: relativePath || null,
        limit: cap
      })

      if (hits.length === 0) {
        return {
          success: true,
          summary: relativePath
            ? `No matching passages found in "${relativePath}" for "${cleanQuery}".`
            : `No matching PDF passages found in the workspace for "${cleanQuery}".`,
          result: { query: cleanQuery, relativePath: relativePath || null, hits: [] }
        }
      }

      const formatted = formatPdfHitsForPrompt(hits, 1200)
      return {
        success: true,
        summary: `Found ${hits.length} relevant PDF passage(s) for "${cleanQuery}":\n\n${formatted}`,
        result: {
          query: cleanQuery,
          relativePath: relativePath || null,
          hits
        }
      }
    } catch (err: any) {
      return {
        success: false,
        error: err?.message || 'PDF search failed.'
      }
    }
  }
})
