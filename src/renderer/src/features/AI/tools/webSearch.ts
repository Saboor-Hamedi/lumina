/**
 * ============================================================================
 * Lumina AI Live Web Search Tool (`tools/webSearch.ts`)
 * ============================================================================
 * Dedicated module enabling Lumina AI to search the live web (via the native
 * Rust Tauri `web_search` command — zero CORS issues, cross-platform on
 * Windows, macOS, and Linux) and return clickable source websites formatted
 * like ChatGPT / Claude citations.
 * ============================================================================
 */

import * as aiSdk from 'ai'
import type { AIToolExecutionResult } from '../types/ai.types'

export interface WebSearchInput {
  query: string
  maxResults?: number
}

export interface WebSearchResultItem {
  title: string
  url: string
  siteName: string
  snippet: string
}

export interface WebSearchPayload {
  query: string
  source: string
  results: WebSearchResultItem[]
}

/**
 * Performs a live online web search using Lumina's native Rust backend.
 * Can be called directly by the AI tool or any other Lumina feature.
 */
export async function searchOnline(
  query: string,
  maxResults: number = 6
): Promise<WebSearchPayload> {
  const cleanQuery = (query || '').trim()
  if (!cleanQuery) {
    return { query: '', source: 'web', results: [] }
  }

  const limit = Math.min(10, Math.max(1, Number(maxResults) || 6))
  const api = (window as any)?.api

  if (typeof api?.webSearch === 'function') {
    const res = await api.webSearch(cleanQuery, limit)
    const rawResults = Array.isArray(res?.results) ? res.results : []
    return {
      query: res?.query || cleanQuery,
      source: res?.source || 'web',
      results: rawResults.map((item: any) => ({
        title: String(item?.title || '').trim(),
        url: String(item?.url || '').trim(),
        siteName: String(item?.siteName || item?.site_name || '').trim(),
        snippet: String(item?.snippet || '').trim()
      })).filter((item: WebSearchResultItem) => item.title && /^https?:\/\//i.test(item.url))
    }
  }

  throw new Error('Native web search bridge is unavailable in this environment.')
}

/**
 * Formats search results into clean Markdown with clickable website links.
 */
export function formatWebSearchMarkdown(payload: WebSearchPayload): string {
  if (!payload.results || payload.results.length === 0) {
    return `No live web results found for "${payload.query}".`
  }

  return payload.results
    .map((item, idx) => {
      const siteLabel = item.siteName || item.url.replace(/^https?:\/\/(www\.)?/i, '').split('/')[0]
      const snippetLine = item.snippet ? `\n   ${item.snippet}` : ''
      return `${idx + 1}. **[${item.title}](${item.url})** — [${siteLabel}](${item.url})${snippetLine}`
    })
    .join('\n')
}

export const webSearchTool = aiSdk.tool({
  description:
    'Search the live internet / Google / web (`webSearch`) for up-to-date information, documentation, news, libraries, or websites. Always use this when the user asks to search online, check the web, look up current information, or find websites. Returns real website titles, domains, snippets, and clickable URLs.',
  inputSchema: aiSdk.jsonSchema<WebSearchInput>({
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'The search query to look up online (e.g. "Tauri v2 window events docs" or "latest React 19 features").'
      },
      maxResults: {
        type: 'number',
        description: 'Maximum number of web results to return (default: 6, max: 10).'
      }
    },
    required: ['query']
  }),
  execute: async ({ query, maxResults = 6 }): Promise<AIToolExecutionResult> => {
    try {
      const rawQuery = (query || '').trim()
      if (!rawQuery) {
        return {
          success: false,
          error: 'Please provide a non-empty search query for webSearch.'
        }
      }

      const payload = await searchOnline(rawQuery, maxResults)
      const formatted = formatWebSearchMarkdown(payload)

      return {
        success: true,
        query: payload.query,
        source: payload.source,
        resultCount: payload.results.length,
        results: payload.results,
        summary: `🌐 Found ${payload.results.length} web result${payload.results.length === 1 ? '' : 's'} for "${payload.query}"`,
        content:
          payload.results.length > 0
            ? `Live web search results for "${payload.query}":\n\n${formatted}`
            : `No live web results were returned for "${payload.query}".`,
        instruction_to_ai:
          'Synthesize a clear, accurate answer using these live web search results. Always cite the websites inline and in a short "Sources" list using clickable Markdown links with the website name, e.g. [Website Name](https://example.com), so the user can click directly to open each website.'
      }
    } catch (err: any) {
      return {
        success: false,
        error: err?.message || 'Live web search failed. Please check your internet connection and try again.'
      }
    }
  }
})
