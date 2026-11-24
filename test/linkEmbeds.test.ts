import { describe, it, expect, afterEach } from 'vitest'
import {
  applyLinkCardDomAttributes,
  buildYouTubeEmbedUrl,
  closeYouTubeModal,
  computeSmartPopoverPosition,
  detectLinkPlatform,
  extractYouTubeId,
  extractYouTubeStartSeconds,
  formatDisplayUrl,
  isHttpUrl,
  openMediaPeekModal,
  openYouTubeModal,
  parseGridLinkLine,
  parseLinkGridHeader,
  parseStandaloneLinkLine,
  resolveLinkCardSettings
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
})
