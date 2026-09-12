import { describe, expect, it } from 'vitest'
import { cleanEmailMarkdown, cleanEmailMarkdownWithDiagnostics, cleanEmailText, sanitizeRichEmailHtml } from '../../../../../src/renderer/src/features/email/services/emailContentCleaner'

describe('emailContentCleaner', () => {
  it('removes invisible email characters and normalizes escaped pipes', () => {
    expect(cleanEmailText('Subject\u034F  text\\| next')).toBe('Subject  text| next')
  })

  it('removes non-content HTML and tracking pixels', () => {
    const cleaned = sanitizeRichEmailHtml(
      '<style>.x{display:none}</style><p>Hello</p><img width="1" height="1"><script>alert(1)</script>'
    )

    expect(cleaned).toContain('<p>Hello</p>')
    expect(cleaned).not.toContain('<style>')
    expect(cleaned).not.toContain('<script>')
    expect(cleaned).not.toContain('width="1"')
  })

  it('keeps real images lazy and asynchronous', () => {
    const cleaned = sanitizeRichEmailHtml('<p>Message</p><img src="https://example.com/image.png">')

    expect(cleaned).toContain('loading="lazy"')
    expect(cleaned).toContain('decoding="async"')
  })

  it('removes hidden preheaders and cleans tracking parameters', () => {
    const cleaned = sanitizeRichEmailHtml(
      '<div class="preheader">Hidden preview</div><!-- noise --><a href="https://example.com/post?id=4&utm_source=email&trk=abc">Read</a>'
    )

    expect(cleaned).not.toContain('Hidden preview')
    expect(cleaned).not.toContain('utm_source')
    expect(cleaned).not.toContain('trk=')
    expect(cleaned).toContain('id=4')
    expect(cleaned).not.toContain('noise')
  })

  it('removes unsafe links and interactive attributes', () => {
    const cleaned = sanitizeRichEmailHtml(
      '<a href="javascript:alert(1)" onclick="alert(1)">Unsafe</a><a href="https://example.com">Safe</a>'
    )

    expect(cleaned).not.toContain('javascript:')
    expect(cleaned).not.toContain('onclick')
    expect(cleaned).toContain('https://example.com/')
  })

  it('cleans converted email Markdown navigation and tracking URLs', () => {
    const cleaned = cleanEmailMarkdown(
      '[![LinkedIn icon](https://static.licdn.com/icon.png)](https://linkedin.com/?utm_source=email&trk=nav)\n\nRead more: https://example.com/post?utm_source=email&id=4'
    )

    expect(cleaned).not.toContain('LinkedIn icon')
    expect(cleaned).not.toContain('utm_source')
    expect(cleaned).toContain('https://example.com/post?id=4')
  })

  it('reports cleanup diagnostics without changing the string API', () => {
    const result = cleanEmailMarkdownWithDiagnostics('| | |\n![logo](https://example.com/logo.png)\nMessage\u034F')

    expect(result.text).toBe('Message')
    expect(result.diagnostics.removedImages).toBe(1)
    expect(result.diagnostics.removedLines).toBeGreaterThan(0)
    expect(result.diagnostics.removedCharacters).toBeGreaterThan(0)
    expect(cleanEmailMarkdown('| | |\nMessage')).toBe('Message')
  })
})
