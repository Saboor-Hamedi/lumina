import { describe, it, expect, vi, beforeEach } from 'vitest'

const readAsset = vi.fn()

vi.mock('../../src/main/workspace/workspaceManager.js', () => ({
  default: { readAsset: (...args) => readAsset(...args) }
}))

vi.mock('electron', () => ({ dialog: {}, BrowserWindow: class {} }))

import {
  generateTOC,
  slugifyHeading,
  escapeHtml,
  convertWikilinks,
  convertImagesToBase64
} from '../../src/export/exportUtils'

const PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='

describe('exportUtils.generateTOC', () => {
  it('injects anchor ids and builds a clickable list', () => {
    const html = '<h1>Intro</h1><p>x</p><h2>Details &amp; Notes</h2><h3>Deep</h3>'
    const { html: out, toc, count } = generateTOC(html)

    expect(count).toBe(3)
    expect(out).toContain('id="toc-0-intro"')
    expect(out).toContain('id="toc-1-details-amp-notes"')
    expect(out).toContain('id="toc-2-deep"')
    expect(toc).toContain('href="#toc-0-intro"')
    expect(toc).toContain('class="toc-l3"')
  })

  it('returns empty toc when there are no headings', () => {
    const { toc, count, html } = generateTOC('<p>just text</p>')
    expect(count).toBe(0)
    expect(toc).toBe('')
    expect(html).toBe('<p>just text</p>')
  })

  it('does not emit a TOC title heading (avoids a duplicate title)', () => {
    const { toc } = generateTOC('<h1>Intro</h1><h2>Details</h2>')
    expect(toc).not.toContain('Table of Contents')
    expect(toc).not.toContain('toc-title')
  })

  it('respects maxLevel', () => {
    const html = '<h1>A</h1><h2>B</h2><h4>C</h4>'
    const { count } = generateTOC(html, { maxLevel: 2 })
    expect(count).toBe(2)
  })

  it('handles empty / non-string input safely', () => {
    expect(generateTOC('').count).toBe(0)
    expect(generateTOC(null).count).toBe(0)
    expect(generateTOC(undefined).count).toBe(0)
  })

  it('escapes heading text in the table of contents', () => {
    const { toc } = generateTOC('<h1>Tom & Jerry</h1>')
    expect(toc).toContain('Tom &amp; Jerry')
  })
})

describe('exportUtils.slugifyHeading', () => {
  it('lowercases, strips punctuation and hyphenates', () => {
    expect(slugifyHeading('Hello, World!')).toBe('hello-world')
  })

  it('strips inline markup', () => {
    expect(slugifyHeading('<code>foo</code> bar')).toBe('foo-bar')
  })
})

describe('exportUtils.escapeHtml', () => {
  it('escapes special characters', () => {
    expect(escapeHtml('<b>"a" & \'b\'</b>')).toBe(
      '&lt;b&gt;&quot;a&quot; &amp; &#39;b&#39;&lt;/b&gt;'
    )
  })
})

describe('exportUtils.convertWikilinks', () => {
  it('converts to span by default', () => {
    expect(convertWikilinks('See [[Note]]')).toContain('<span class="wikilink">Note</span>')
  })

  it('converts to anchor in link mode', () => {
    expect(convertWikilinks('See [[Note]]', 'link')).toContain('<a href="#">Note</a>')
  })
})

describe('exportUtils.convertImagesToBase64', () => {
  beforeEach(() => {
    readAsset.mockReset()
  })

  it('embeds a local image from the object returned by readAsset', async () => {
    readAsset.mockResolvedValue({
      buffer: Buffer.from('x'),
      base64: PNG_BASE64,
      dataUrl: `data:image/png;base64,${PNG_BASE64}`,
      mimeType: 'image/png',
      size: 1
    })

    const out = await convertImagesToBase64('![pic](images/a.png)')
    expect(out).toContain(`data:image/png;base64,${PNG_BASE64}`)
    expect(out).not.toContain('images/a.png')
  })

  it('falls back to the buffer when base64 is missing', async () => {
    readAsset.mockResolvedValue({ buffer: Buffer.from('hello'), mimeType: 'image/jpeg' })

    const out = await convertImagesToBase64('![pic](images/a.jpg)')
    expect(out).toContain(`data:image/jpeg;base64,${Buffer.from('hello').toString('base64')}`)
  })

  it('leaves remote and data images untouched', async () => {
    const src = '![a](https://x.com/a.png) ![b](data:image/png;base64,AAAA)'
    const out = await convertImagesToBase64(src)
    expect(out).toBe(src)
    expect(readAsset).not.toHaveBeenCalled()
  })

  it('resolves asset://local/ URLs', async () => {
    readAsset.mockResolvedValue({ dataUrl: `data:image/png;base64,${PNG_BASE64}` })
    const out = await convertImagesToBase64('![pic](asset://local/images/a.png)')
    expect(readAsset).toHaveBeenCalledWith('images/a.png')
    expect(out).toContain(`data:image/png;base64,${PNG_BASE64}`)
  })

  it('resolves asset:// URLs with query/hash stripped', async () => {
    readAsset.mockResolvedValue({ dataUrl: `data:image/png;base64,${PNG_BASE64}` })
    await convertImagesToBase64('![pic](asset://local/images/a.png?v=2#frag)')
    expect(readAsset).toHaveBeenCalledWith('images/a.png')
  })

  it('converts raw HTML <img> sources too', async () => {
    readAsset.mockResolvedValue({ dataUrl: `data:image/png;base64,${PNG_BASE64}` })
    const out = await convertImagesToBase64('<img src="images/a.png" alt="x" />')
    expect(out).toContain(`src="data:image/png;base64,${PNG_BASE64}"`)
  })

  it('keeps the original URL when the asset cannot be resolved', async () => {
    readAsset.mockResolvedValue(null)
    const out = await convertImagesToBase64('![pic](images/missing.png)')
    expect(out).toContain('images/missing.png')
  })

  it('never throws when readAsset rejects', async () => {
    readAsset.mockRejectedValue(new Error('boom'))
    const out = await convertImagesToBase64('![pic](images/a.png)')
    expect(out).toContain('images/a.png')
  })
})
