import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  searchOnline,
  formatWebSearchMarkdown,
  webSearchTool
} from '../../../../../../src/renderer/src/features/AI/tools/webSearch'
import {
  detectUserIntent,
  IntentCategory
} from '../../../../../../src/renderer/src/features/AI/services/intentRouter'

describe('Lumina AI Live Web Search Tool', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(window as any).api = {
      ...(window as any).api,
      webSearch: vi.fn().mockResolvedValue({
        query: 'Tauri v2 docs',
        source: 'web',
        results: [
          {
            title: 'Tauri 2.0 Documentation',
            url: 'https://v2.tauri.app/',
            siteName: 'v2.tauri.app',
            snippet: 'Build smaller, faster, and more secure desktop and mobile applications.'
          },
          {
            title: 'Tauri GitHub Repository',
            url: 'https://github.com/tauri-apps/tauri',
            siteName: 'github.com',
            snippet: 'Open source toolkit for desktop apps.'
          }
        ]
      })
    }
  })

  it('detects online web search intents cleanly', () => {
    expect(detectUserIntent('go search online for Tauri v2')).toBe(IntentCategory.WEB_SEARCH)
    expect(detectUserIntent('search google for React 19 features')).toBe(IntentCategory.WEB_SEARCH)
    expect(detectUserIntent('/web latest Rust release')).toBe(IntentCategory.WEB_SEARCH)
  })

  it('calls native window.api.webSearch and returns sanitized website links', async () => {
    const payload = await searchOnline('Tauri v2 docs', 5)
    expect((window as any).api.webSearch).toHaveBeenCalledWith('Tauri v2 docs', 5)
    expect(payload.results).toHaveLength(2)
    expect(payload.results[0].siteName).toBe('v2.tauri.app')

    const md = formatWebSearchMarkdown(payload)
    expect(md).toContain('[Tauri 2.0 Documentation](https://v2.tauri.app/)')
    expect(md).toContain('[v2.tauri.app](https://v2.tauri.app/)')
  })

  it('executes webSearchTool and returns formatted clickable citations', async () => {
    const res = await (webSearchTool as any).execute({ query: 'Tauri v2 docs', maxResults: 4 })
    expect(res.success).toBe(true)
    expect(res.resultCount).toBe(2)
    expect(res.content).toContain('[Tauri 2.0 Documentation](https://v2.tauri.app/)')
    expect(res.instruction_to_ai).toContain('clickable Markdown links')
  })
})
