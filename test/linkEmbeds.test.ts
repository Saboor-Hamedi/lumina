import { describe, it, expect, afterEach } from 'vitest'
import { EditorState, Prec } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import { inlinePreview } from '../src/renderer/src/features/Editor/atomic/inlinePreview'
import { codeBlockDecorations } from '../src/renderer/src/core/code/codeBlockHeader'
import {
  applyLinkCardDomAttributes,
  buildYouTubeEmbedUrl,
  clearLinkMetadataCache,
  closeYouTubeModal,
  computeSmartPopoverPosition,
  createLinkCardElement,
  detectLinkPlatform,
  extractYouTubeId,
  extractYouTubeStartSeconds,
  fetchLinkMetadata,
  formatDisplayUrl,
  formatHostnameTitle,
  getCachedLinkMetadata,
  isHttpUrl,
  linkEmbedExtension,
  normalizeLinkTitle,
  normalizeSiteName,
  openMediaPeekModal,
  openYouTubeModal,
  parseGridLinkLine,
  parseLinkGridHeader,
  parseStandaloneLinkLine,
  resolveLinkCardSettings,
  resolveLinkDescription
} from '../src/renderer/src/features/links'

describe('Link & YouTube URL Parser', () => {
  afterEach(() => {
    closeYouTubeModal()
    document.body.innerHTML = ''
  })

  it('validates real http(s) URLs and rejects malformed/00/credential/overflow URLs', () => {
    expect(isHttpUrl('https://github.com/tauri-apps/tauri')).toBe(true)
    expect(isHttpUrl('http://localhost:3000/docs')).toBe(true)
    expect(isHttpUrl('https://127.0.0.1:8080/api')).toBe(true)

    // Shorthand numeric / 00 / unspecified hosts
    expect(isHttpUrl('https://00')).toBe(false)
    expect(isHttpUrl('https://0000/00/00')).toBe(false)
    expect(isHttpUrl('https://0.0.0.0/test')).toBe(false)
    expect(isHttpUrl('https://123456')).toBe(false)
    expect(isHttpUrl('https://01.02')).toBe(false)

    // Missing TLD, bad dots, credentials, control chars, null bytes
    expect(isHttpUrl('https://singleword')).toBe(false)
    expect(isHttpUrl('https://foo..bar.com')).toBe(false)
    expect(isHttpUrl('https://youtube.com@evil.com/watch?v=dQw4w9WgXcQ')).toBe(false)
    expect(isHttpUrl('https://example.com/path%00evil')).toBe(false)
    expect(isHttpUrl('javascript:alert(1)')).toBe(false)

    // Thousands of slugs or >2048 chars
    const thousandSlugs = 'https://example.com' + '/00'.repeat(1000)
    const seventySlugs = 'https://example.com' + '/a'.repeat(70)
    const hugeQuery = 'https://example.com/doc?q=' + '0'.repeat(2100)
    expect(isHttpUrl(thousandSlugs)).toBe(false)
    expect(isHttpUrl(seventySlugs)).toBe(false)
    expect(isHttpUrl(hugeQuery)).toBe(false)
  })

  it('formats long valid URLs cleanly for card display', () => {
    const longValid =
      'https://www.example.com/2026/11/24/deep/nested/article-with-a-very-long-slug-00-00-00-final?utm_source=newsletter&ref=abc123'
    expect(isHttpUrl(longValid)).toBe(true)
    const formatted = formatDisplayUrl(longValid)
    expect(formatted).toContain('example.com/2026/…/')
    expect(formatted.length).toBeLessThanOrEqual(88)
  })

  it('extracts YouTube video IDs across all standard formats and rejects malformed paths', () => {
    expect(extractYouTubeId('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ')
    expect(extractYouTubeId('https://www.youtube.com/watch/?v=dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ')
    expect(extractYouTubeId('https://youtu.be/dQw4w9WgXcQ?t=42')).toBe('dQw4w9WgXcQ')
    expect(extractYouTubeId('https://www.youtube.com/shorts/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ')
    expect(extractYouTubeId('https://www.youtube.com/embed/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ')
    expect(extractYouTubeId('https://www.youtube.com/live/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ')

    // Extra trailing garbage slugs rejected
    expect(extractYouTubeId('https://youtu.be/dQw4w9WgXcQ/00/00')).toBeNull()
    expect(extractYouTubeId('https://www.youtube.com/shorts/dQw4w9WgXcQ/extra')).toBeNull()
    // Raw 11-char ID rejected unless explicitly allowed
    expect(extractYouTubeId('dQw4w9WgXcQ')).toBeNull()
    expect(extractYouTubeId('dQw4w9WgXcQ', { allowRawId: true })).toBe('dQw4w9WgXcQ')
    expect(extractYouTubeId('https://example.com/watch?v=dQw4w9WgXcQ')).toBeNull()
  })

  it('parses YouTube start timestamps accurately and rejects invalid values', () => {
    expect(extractYouTubeStartSeconds('https://youtu.be/dQw4w9WgXcQ?t=90')).toBe(90)
    expect(extractYouTubeStartSeconds('https://youtu.be/dQw4w9WgXcQ?t=1m30s')).toBe(90)
    expect(extractYouTubeStartSeconds('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=1h2m3s')).toBe(3723)
    expect(extractYouTubeStartSeconds('https://youtu.be/dQw4w9WgXcQ?t=00')).toBeNull()
    expect(extractYouTubeStartSeconds('https://youtu.be/dQw4w9WgXcQ?t=abc12s')).toBeNull()
    expect(extractYouTubeStartSeconds('https://youtu.be/dQw4w9WgXcQ')).toBeNull()
  })

  it('builds privacy-enhanced YouTube embed URLs', () => {
    const url = buildYouTubeEmbedUrl('dQw4w9WgXcQ', 90)
    expect(url).toContain('https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ')
    expect(url).toContain('autoplay=1')
    expect(url).toContain('start=90')
  })

  it('detects bare standalone URLs while keeping named [Word](url) links inline for hover dropdowns', () => {
    expect(parseStandaloneLinkLine('https://example.com/docs')).toEqual({
      url: 'https://example.com/docs'
    })
    expect(parseStandaloneLinkLine('<https://example.com/docs>')).toEqual({
      url: 'https://example.com/docs'
    })
    // Named Markdown links stay as inline words (so hovering shows the smart dropdown card)
    expect(parseStandaloneLinkLine('[Google](https://www.google.com)')).toBeNull()
    expect(
      parseGridLinkLine('[Rust](https://en.wikipedia.org/wiki/Rust_(programming_language))')
    ).toEqual({
      url: 'https://en.wikipedia.org/wiki/Rust_(programming_language)',
      label: 'Rust'
    })
    expect(parseStandaloneLinkLine('https://00')).toBeNull()
    expect(parseStandaloneLinkLine('https://example.com' + '/00'.repeat(500))).toBeNull()
    expect(parseStandaloneLinkLine('![alt](https://example.com/img.png)')).toBeNull()
    expect(parseStandaloneLinkLine('Check out https://example.com today')).toBeNull()
  })

  it('opens and cleanly tears down the borderless YouTube modal on Escape', () => {
    const opened = openYouTubeModal('https://youtu.be/dQw4w9WgXcQ?t=15', 'Demo Video')
    expect(opened).toBe(true)

    const overlay = document.querySelector('.yt-modal-overlay')
    const iframe = document.querySelector('.yt-modal-iframe') as HTMLIFrameElement | null
    expect(overlay).not.toBeNull()
    expect(iframe).not.toBeNull()
    expect(iframe?.src).toContain('youtube-nocookie.com/embed/dQw4w9WgXcQ')
    expect(iframe?.src).toContain('start=15')

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(iframe?.src).toBe('about:blank')
  })

  it('resolves link card customization defaults and applies DOM attributes cleanly', () => {
    const defaults = resolveLinkCardSettings({})
    expect(defaults).toEqual({
      linkCardsEnabled: true,
      linkCardStyle: 'strip',
      linkCardWidth: 'full',
      linkCardSize: 'default',
      linkCardThumbnailPosition: 'right',
      linkCardColumns: 1,
      linkCardShowDescription: true,
      youtubeOpenInModal: true
    })

    applyLinkCardDomAttributes({
      linkCardStyle: 'card',
      linkCardWidth: 'medium',
      linkCardSize: 'large',
      linkCardThumbnailPosition: 'left',
      linkCardShowDescription: false
    })

    const root = document.documentElement
    expect(root.getAttribute('data-link-card-style')).toBe('card')
    expect(root.getAttribute('data-link-card-width')).toBe('medium')
    expect(root.getAttribute('data-link-card-size')).toBe('large')
    expect(root.getAttribute('data-link-card-thumb')).toBe('left')
    expect(root.getAttribute('data-link-card-desc')).toBe('hide')
  })

  it('detects social media platforms and opens the Visual Media Peek modal', () => {
    expect(detectLinkPlatform('https://www.pinterest.com/pin/123456789/').id).toBe('pinterest')
    expect(detectLinkPlatform('https://pin.it/abc1234').id).toBe('pinterest')
    expect(detectLinkPlatform('https://x.com/user/status/123').id).toBe('x')
    expect(detectLinkPlatform('https://www.instagram.com/p/abc/').id).toBe('instagram')
    expect(detectLinkPlatform('https://www.reddit.com/r/rust/comments/abc/').id).toBe('reddit')
    expect(detectLinkPlatform('https://www.tiktok.com/@user/video/123').id).toBe('tiktok')
    expect(detectLinkPlatform('https://open.spotify.com/track/123').id).toBe('spotify')

    const opened = openMediaPeekModal({
      imageUrl: 'https://i.pinimg.com/originals/aa/bb/cc.jpg',
      url: 'https://www.pinterest.com/pin/123456789/',
      title: 'Minimal Desk Setup',
      subtitle: 'Pinterest'
    })
    expect(opened).toBe(true)
    const img = document.querySelector('.peek-modal-img') as HTMLImageElement | null
    expect(img?.src).toBe('https://i.pinimg.com/originals/aa/bb/cc.jpg')
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
  })

  it('positions inline hover popovers smartly inside editor bounds, flipping below near top edge', () => {
    const editorBounds = { top: 48, bottom: 760, left: 260, right: 1060 }

    // Plenty of room above -> places on top
    const above = computeSmartPopoverPosition(
      { top: 320, bottom: 340, left: 400, right: 460, width: 60 },
      { width: 304, height: 84 },
      editorBounds
    )
    expect(above.placement).toBe('top')
    expect(above.top).toBe(320 - 84 - 6)

    // Near editor top & left edge -> flips below and clamps inside editor left margin
    const below = computeSmartPopoverPosition(
      { top: 70, bottom: 90, left: 270, right: 320, width: 50 },
      { width: 304, height: 84 },
      editorBounds
    )
    expect(below.placement).toBe('bottom')
    expect(below.top).toBe(96)
    expect(below.left).toBe(260 + 10) // stays inside editor, never bleeds over sidebar

    // Near editor right edge -> clamps inside editor right margin
    const rightClamped = computeSmartPopoverPosition(
      { top: 320, bottom: 340, left: 990, right: 1050, width: 60 },
      { width: 304, height: 84 },
      editorBounds
    )
    expect(rightClamped.left).toBe(1060 - 304 - 10)
  })

  it('parses flexible ```links / ``` link / ```links-grid headers and clamps columns to 1..3', () => {
    expect(parseLinkGridHeader('```links')).toEqual({ isGridOpen: true, explicitCols: undefined })
    expect(parseLinkGridHeader('``` link 2')).toEqual({ isGridOpen: true, explicitCols: 2 })
    expect(parseLinkGridHeader('```links   3')).toEqual({ isGridOpen: true, explicitCols: 3 })
    expect(parseLinkGridHeader('```links 100')).toEqual({ isGridOpen: true, explicitCols: 3 })
    expect(parseLinkGridHeader('```links 0')).toEqual({ isGridOpen: true, explicitCols: 1 })
    expect(parseLinkGridHeader('```links-grid 2')).toEqual({ isGridOpen: true, explicitCols: 2 })
    expect(parseLinkGridHeader('```link-grid 99')).toEqual({ isGridOpen: true, explicitCols: 3 })
    expect(parseLinkGridHeader('```typescript')).toEqual({ isGridOpen: false })
  })

  it('caches successful metadata and supports forceRefresh retry after failure', async () => {
    clearLinkMetadataCache()
    const testUrl = 'https://example.com/cached-article'

    // Simulate offline failure first
    ;(window as any).api = {
      fetchLinkMetadata: async () => {
        throw new Error('offline')
      }
    }
    const failedMeta = await fetchLinkMetadata(testUrl)
    expect(failedMeta.failed).toBe(true)

    // Now simulate network recovery + explicit forceRefresh retry
    ;(window as any).api = {
      fetchLinkMetadata: async () => ({
        url: testUrl,
        title: 'Recovered Title',
        description: 'Recovered description',
        site_name: 'Example'
      })
    }
    const recovered = await fetchLinkMetadata(testUrl, { forceRefresh: true })
    expect(recovered.failed).toBe(false)
    expect(recovered.title).toBe('Recovered Title')
    expect(getCachedLinkMetadata(testUrl)?.title).toBe('Recovered Title')
    clearLinkMetadataCache()
  })

  it('renders bare URLs, autolinks, self-linked pasted URLs, and ``` links blocks with the exact same LinkWrapper preview', () => {
    const ytUrl = 'https://www.youtube.com/watch?v=dwd9i-z1HIY'
    const docs = [
      ytUrl,
      `<${ytUrl}>`,
      `[${ytUrl}](${ytUrl})`,
      `\`\`\` links\n${ytUrl}\n\`\`\``
    ]

    const views: EditorView[] = []
    const hosts: HTMLElement[] = []

    try {
      for (const doc of docs) {
        const host = document.createElement('div')
        document.body.append(host)
        hosts.push(host)
        views.push(
          new EditorView({
            state: EditorState.create({
              doc,
              extensions: [
                markdown({ base: markdownLanguage }),
                inlinePreview(),
                codeBlockDecorations,
                Prec.highest(linkEmbedExtension)
              ]
            }),
            parent: host
          })
        )
      }

      const baseline = hosts[3].querySelector('.lumina-link-wrapper')
      expect(baseline).not.toBeNull()

      for (let i = 0; i < 3; i++) {
        const wrap = hosts[i].querySelector('.lumina-link-wrapper')
        expect(wrap).not.toBeNull()
        expect(wrap?.className).toBe(baseline?.className)
        expect(wrap?.innerHTML).toBe(baseline?.innerHTML)
      }
    } finally {
      views.forEach((v) => v.destroy())
    }
  })

  it('eliminates duplicate domain/URL text and normalizes noisy site names on bookmark cards', () => {
    expect(formatHostnameTitle('https://google.com')).toBe('Google')
    expect(normalizeLinkTitle('https://google.com', 'https://google.com')).toBe('Google')
    expect(normalizeLinkTitle('google.com', 'https://google.com')).toBe('Google')
    expect(normalizeSiteName('X (formerly Twitter)', 'https://x.com/user/status/1')).toBe('x.com')
    expect(normalizeSiteName('https://google.com', 'https://google.com')).toBe('google.com')

    // Root homepage with no meta description omits the subtitle cleanly
    expect(resolveLinkDescription(null, 'Google', 'google.com', 'https://google.com')).toBeNull()
    expect(
      resolveLinkDescription('google.com', 'Google', 'google.com', 'https://google.com')
    ).toBeNull()
    // URL with a real path falls back to clean canonical display path
    expect(
      resolveLinkDescription(null, 'GitHub', 'github.com', 'https://github.com/tauri-apps/tauri')
    ).toBe('github.com/tauri-apps/tauri')

    // Card DOM for minimal metadata homepage has clean title + domain and hides empty subtitle
    const card = createLinkCardElement({
      url: 'https://google.com',
      youtubeId: null,
      inGrid: true
    })
    expect(card.querySelector('.lumina-link-card-title')?.textContent).toBe('Google')
    expect(card.querySelector('.lumina-link-card-source')?.textContent).toBe('google.com')
    expect((card.querySelector('.lumina-link-card-desc') as HTMLElement)?.style.display).toBe('none')
    expect(card.classList.contains('is-single-line')).toBe(true)
  })

  it('selects the full link block on right-click and renders no extra preview header on standalone or fenced links', () => {
    const ytUrl = 'https://www.youtube.com/watch?v=dwd9i-z1HIY'
    const host = document.createElement('div')
    document.body.append(host)

    const view = new EditorView({
      state: EditorState.create({
        doc: ytUrl,
        extensions: [
          markdown({ base: markdownLanguage }),
          inlinePreview(),
          codeBlockDecorations,
          Prec.highest(linkEmbedExtension)
        ]
      }),
      parent: host
    })

    try {
      expect(host.querySelector('.code-block-header')).toBeNull()
      expect(host.querySelector('.lumina-link-source-bar')).toBeNull()

      const wrap = host.querySelector('.lumina-link-wrapper') as HTMLElement | null
      expect(wrap).not.toBeNull()

      wrap!.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, button: 2 }))
      const sel = view.state.selection.main
      expect(view.state.sliceDoc(sel.from, sel.to)).toBe(ytUrl)
      expect(wrap!.classList.contains('is-selected')).toBe(true)
    } finally {
      view.destroy()
    }
  })

  it('deletes standalone links and individual ```links items via the card delete button', () => {
    const yt1 = 'https://www.youtube.com/watch?v=dwd9i-z1HIY'
    const yt2 = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'

    // 1. Standalone URL delete
    const host1 = document.createElement('div')
    document.body.append(host1)
    const view1 = new EditorView({
      state: EditorState.create({
        doc: `Hello\n${yt1}\nWorld`,
        extensions: [Prec.highest(linkEmbedExtension)]
      }),
      parent: host1
    })

    // 2. Multi-link ```links block item delete
    const host2 = document.createElement('div')
    document.body.append(host2)
    const view2 = new EditorView({
      state: EditorState.create({
        doc: `\`\`\`links\n${yt1}\n${yt2}\n\`\`\``,
        extensions: [Prec.highest(linkEmbedExtension)]
      }),
      parent: host2
    })

    try {
      const delStandalone = host1.querySelector('.lumina-link-card-action.is-delete') as HTMLButtonElement | null
      expect(delStandalone).not.toBeNull()
      delStandalone!.click()
      expect(view1.state.doc.toString()).toBe('Hello\nWorld')

      const delButtons = host2.querySelectorAll<HTMLButtonElement>('.lumina-link-card-action.is-delete')
      expect(delButtons.length).toBe(2)
      delButtons[0].click()
      expect(view2.state.doc.toString()).toBe(`\`\`\`links\n${yt2}\n\`\`\``)
    } finally {
      view1.destroy()
      view2.destroy()
    }
  })

  it('auto-exits source mode when moving away or pressing Enter so pasted URLs never stay stuck in lumina-link-source-line', () => {
    const ytUrl = 'https://www.youtube.com/watch?v=dwd9i-z1HIY'
    const host = document.createElement('div')
    document.body.append(host)

    const view = new EditorView({
      state: EditorState.create({
        doc: `${ytUrl}\nNext line`,
        extensions: [Prec.highest(linkEmbedExtension)]
      }),
      parent: host
    })

    try {
      // Enter source mode via the edit button
      const editBtn = host.querySelector('.lumina-link-wrapper-edit') as HTMLButtonElement | null
      expect(editBtn).not.toBeNull()
      editBtn!.click()
      expect(host.querySelector('.lumina-link-source-line')).not.toBeNull()
      expect(host.querySelector('.lumina-link-source-bar')).not.toBeNull()

      // Moving cursor to another line automatically returns to LinkWrapper preview
      const nextLineFrom = view.state.doc.line(2).from
      view.dispatch({ selection: { anchor: nextLineFrom } })
      expect(host.querySelector('.lumina-link-source-line')).toBeNull()
      expect(host.querySelector('.lumina-link-source-bar')).toBeNull()
      expect(host.querySelector('.lumina-link-wrapper')).not.toBeNull()
    } finally {
      view.destroy()
    }
  })
})
