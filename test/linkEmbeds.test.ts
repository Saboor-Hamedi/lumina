import { describe, it, expect, afterEach } from 'vitest'
import {
  extractYouTubeId,
  extractYouTubeStartSeconds,
  buildYouTubeEmbedUrl,
  parseStandaloneLinkLine,
  extractDomain,
  openYouTubeModal,
  closeYouTubeModal
} from '../src/renderer/src/features/links'

describe('YouTube & Website Link Parser', () => {
  it('extracts video IDs from all standard YouTube URL formats', () => {
    expect(extractYouTubeId('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ')
    expect(extractYouTubeId('https://youtu.be/dQw4w9WgXcQ?t=42')).toBe('dQw4w9WgXcQ')
    expect(extractYouTubeId('https://www.youtube.com/shorts/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ')
    expect(extractYouTubeId('https://www.youtube.com/embed/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ')
    expect(extractYouTubeId('https://www.youtube.com/live/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ')
    expect(extractYouTubeId('https://example.com/watch?v=dQw4w9WgXcQ')).toBeNull()
  })

  it('parses start timestamps in seconds and h/m/s format', () => {
    expect(extractYouTubeStartSeconds('https://youtu.be/dQw4w9WgXcQ?t=90')).toBe(90)
    expect(extractYouTubeStartSeconds('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=1m30s')).toBe(90)
    expect(extractYouTubeStartSeconds('https://www.youtube.com/watch?v=dQw4w9WgXcQ&start=15')).toBe(15)
    expect(extractYouTubeStartSeconds('https://youtu.be/dQw4w9WgXcQ')).toBeNull()
  })

  it('builds privacy-enhanced youtube-nocookie embed URLs', () => {
    expect(buildYouTubeEmbedUrl('dQw4w9WgXcQ')).toBe(
      'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?autoplay=1&rel=0&modestbranding=1'
    )
    expect(buildYouTubeEmbedUrl('dQw4w9WgXcQ', 45)).toBe(
      'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?autoplay=1&rel=0&modestbranding=1&start=45'
    )
  })

  it('detects standalone URL and Markdown link lines while ignoring images and inline prose', () => {
    expect(parseStandaloneLinkLine('https://example.com/docs')).toEqual({
      url: 'https://example.com/docs'
    })
    expect(parseStandaloneLinkLine('[Lumina](https://github.com/Saboor-Hamedi/lumina)')).toEqual({
      url: 'https://github.com/Saboor-Hamedi/lumina',
      label: 'Lumina'
    })
    expect(parseStandaloneLinkLine('![alt](https://example.com/img.png)')).toBeNull()
    expect(parseStandaloneLinkLine('Check out https://example.com today')).toBeNull()
    expect(extractDomain('https://www.github.com/test')).toBe('github.com')
  })
})

describe('Borderless YouTube Lightbox Modal', () => {
  afterEach(() => {
    closeYouTubeModal()
    document.body.innerHTML = ''
  })

  it('opens a borderless iframe dialog and closes cleanly on Escape', () => {
    const opened = openYouTubeModal('https://youtu.be/dQw4w9WgXcQ?t=30', 'Demo Video')
    expect(opened).toBe(true)

    const dialog = document.querySelector('.yt-modal-overlay')
    const iframe = document.querySelector('.yt-modal-iframe') as HTMLIFrameElement | null
    expect(dialog).toBeTruthy()
    expect(iframe?.src).toContain('youtube-nocookie.com/embed/dQw4w9WgXcQ')
    expect(iframe?.src).toContain('start=30')

    // Pressing Escape stops audio (about:blank) and tears down modal
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    expect(iframe?.src).toBe('about:blank')
  })

  it('returns false for non-YouTube URLs', () => {
    expect(openYouTubeModal('https://example.com')).toBe(false)
    expect(document.querySelector('.yt-modal-overlay')).toBeNull()
  })
})
