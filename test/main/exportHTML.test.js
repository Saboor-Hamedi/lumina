import { describe, it, expect, vi, afterEach } from 'vitest'
import { handleExportHTML } from '../../src/export/exportHTML'

vi.mock('electron', () => ({
  dialog: { showSaveDialog: vi.fn() },
  BrowserWindow: vi.fn()
}))

describe('handleExportHTML', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('returns a full HTML document for valid content', async () => {
    const html = await handleExportHTML(null, { title: 'My Note', content: '# Hello' })

    expect(html).toContain('<!DOCTYPE html>')
    expect(html).toContain('<title>My Note</title>')
    expect(html).toContain('<h1>My Note</h1>')
    expect(html).toContain('<h1>Hello</h1>')
  })

  it('converts markdown to HTML content', async () => {
    const html = await handleExportHTML(null, {
      title: 'Note',
      content: '**bold** and `code`'
    })

    expect(html).toContain('<strong>bold</strong>')
    expect(html).toContain('<code>code</code>')
  })

  it('converts wikilinks to anchor tags', async () => {
    const html = await handleExportHTML(null, {
      title: 'Note',
      content: 'See [[Other Note]]'
    })

    expect(html).toContain('<a href="#">Other Note</a>')
  })

  it('uses Untitled as default title when not provided', async () => {
    const html = await handleExportHTML(null, { content: 'Just body' })

    expect(html).toContain('<title>Untitled</title>')
    expect(html).toContain('<h1>Untitled</h1>')
  })

  it('throws when no content provided', async () => {
    await expect(handleExportHTML(null, { title: 'Empty' })).rejects.toThrow(
      'No content provided'
    )
  })

  it('throws when payload is empty', async () => {
    await expect(handleExportHTML(null, {})).rejects.toThrow('No content provided')
  })

  it('highlights code blocks', async () => {
    const html = await handleExportHTML(null, {
      title: 'Note',
      content: '```js\nconst x = 1\n```'
    })

    expect(html).toContain('hljs language-')
    expect(html).toContain('<code')
  })

  it('throws when content is an empty string', async () => {
    await expect(handleExportHTML(null, { title: 'Note', content: '' })).rejects.toThrow(
      'No content provided'
    )
  })
})
