/**
 * ============================================================================
 * Lumina AI Live Web Search Tool (`tools/luminWebSearch.ts`)
 * ============================================================================
 * Dedicated module enabling Lumina AI to search the live web (via the native
 * Rust Tauri `web_search` command — zero CORS issues, cross-platform on
 * Windows, macOS, and Linux) across web links, YouTube videos, arXiv/Scholar
 * papers, GitHub repositories, and Wikipedia, returning clean clickable
 * citations like Claude AI / Codex.
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
  category?: 'web' | 'video' | 'scholar' | 'repo' | 'news' | string
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
  maxResults: number = 8
): Promise<WebSearchPayload> {
  const cleanQuery = (query || '').trim()
  if (!cleanQuery) {
    return { query: '', source: 'web', results: [] }
  }

  const limit = Math.min(12, Math.max(1, Number(maxResults) || 8))
  const api = (window as any)?.api

  if (typeof api?.webSearch === 'function') {
    const res = await api.webSearch(cleanQuery, limit)
    const rawResults = Array.isArray(res?.results) ? res.results : []
    return {
      query: res?.query || cleanQuery,
      source: res?.source || 'web',
      results: rawResults
        .map((item: any) => ({
          title: String(item?.title || '').trim(),
          url: String(item?.url || '').trim(),
          siteName: String(item?.siteName || item?.site_name || '').trim(),
          snippet: String(item?.snippet || '').trim(),
          category: String(item?.category || 'web').trim()
        }))
        .filter((item: WebSearchResultItem) => item.title && /^https?:\/\//i.test(item.url))
    }
  }

  throw new Error('Native web search bridge is unavailable in this environment.')
}

function getCategoryBadge(category?: string): string {
  switch ((category || 'web').toLowerCase()) {
    case 'video':
      return '🎬 Video'
    case 'scholar':
      return '🎓 Scholar'
    case 'repo':
      return '💻 Repo'
    case 'news':
      return '📰 News'
    default:
      return '🌐 Web'
  }
}

/**
 * Formats search results into clean Markdown with category tags and clickable website links.
 */
export function formatWebSearchMarkdown(payload: WebSearchPayload): string {
  if (!payload.results || payload.results.length === 0) {
    return `No live web results found for "${payload.query}".`
  }

  return payload.results
    .map((item, idx) => {
      const siteLabel =
        item.siteName || item.url.replace(/^https?:\/\/(www\.)?/i, '').split('/')[0]
      const badge = getCategoryBadge(item.category)
      const snippetLine = item.snippet ? `\n   ${item.snippet}` : ''
      return `${idx + 1}. ${badge} **[${item.title}](${item.url})** — [${siteLabel}](${item.url})${snippetLine}`
    })
    .join('\n')
}

export const luminWebSearchTool = aiSdk.tool({
  description:
    'Search the live internet (Web links, YouTube videos, Google Scholar / arXiv academic papers, GitHub repositories, and Wikipedia) via `webSearch`. Automatically use this whenever the user asks to search online OR when a topic (e.g. RAG, libraries, papers, repos, tutorials) is not fully covered in their workspace notes. Handles typos in repo slugs (e.g. `.gi` -> `.git`) seamlessly.',
  inputSchema: aiSdk.jsonSchema<WebSearchInput>({
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description:
          'The search query (e.g. "Retrieval Augmented Generation RAG", "saboor-hamedi/lumina", "transformer attention paper scholar", "Tauri v2 tutorial video").'
      },
      maxResults: {
        type: 'number',
        description: 'Maximum number of results to return (default: 8, max: 12).'
      }
    },
    required: ['query']
  }),
  execute: async ({ query, maxResults = 8 }): Promise<AIToolExecutionResult> => {
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
        summary: `🌐 Found ${payload.results.length} online result${payload.results.length === 1 ? '' : 's'} for "${payload.query}"`,
        content:
          payload.results.length > 0
            ? `Live search results (${payload.source}) for "${payload.query}":\n\n${formatted}`
            : `No live web results were returned for "${payload.query}".`,
        instruction_to_ai:
          'Synthesize a rich, clear, well-structured answer using these live search results — just like Claude AI / Codex. Group or highlight relevant web links, videos, scholarly papers, or GitHub repos cleanly, and always include clickable Markdown links with the website/title name (e.g. [AWS — What is RAG?](https://...)) both inline and in a clean **Sources & References** section so the user can click directly to open each source.'
      }
    } catch (err: any) {
      return {
        success: false,
        error:
          err?.message ||
          'Live web search failed. Please check your internet connection and try again.'
      }
    }
  }
})

// Backward-compatible alias
export const webSearchTool = luminWebSearchTool
