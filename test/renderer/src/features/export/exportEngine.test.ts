import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  buildPreviewDocument,
  buildPlainText,
  collectLocalAssets,
  formatCopyableContent,
  htmlToPlainText,
  rewriteMarkdownAssetLinks,
  safeFileName
} from '@renderer/features/export/exportEngine'

describe('exportEngine', () => {
  const originalApi = (window as any).api

  afterEach(() => {
    ;(window as any).api = originalApi
    vi.restoreAllMocks()
  })

  it('sanitizes filenames safely across platforms', () => {
    expect(safeFileName('  Notes: 2026 / Q4*?"<>|  ')).toBe('Notes_ 2026 _ Q4______')
    expect(safeFileName('   ...   ')).toBe('Untitled')
    expect(safeFileName('')).toBe('Untitled')
  })

  it('converts rendered HTML to readable plain text', () => {
    const html = '<h1>Heading</h1><p>Alpha &amp; Beta</p><ul><li>First</li><li>Second</li></ul>'
    expect(htmlToPlainText(html)).toBe('Heading\n\nAlpha & Beta\n\n- First\n\n- Second')
  })

  it('builds self-contained previews across pdf, docs, html, markdown, zip, and text', async () => {
    const sampleMd = [
      '# Section One',
      '',
      'Inline math $E = mc^2$ and link [[TargetNote|Alias]].',
      '',
      '## Section Two',
      '',
      '> Quoted line',
      '',
      '```ts',
      'const value = 42',
      '```'
    ].join('\n')

    const pdf = await buildPreviewDocument({
      format: 'pdf',
      title: 'Physics Notes',
      content: sampleMd,
      toc: true
    })
    expect(pdf.html).toContain('class="page"')
    expect(pdf.html).toContain('Table of Contents')
    expect(pdf.html).toContain('hljs')
    expect(pdf.html).toContain('<math')
    expect(pdf.html).not.toContain('cdn.jsdelivr.net')
    expect(pdf.html).not.toContain('cdnjs.cloudflare.com')

    const docs = await buildPreviewDocument({
      format: 'docs',
      title: 'Physics Notes',
      content: sampleMd,
      toc: true
    })
    expect(docs.html).toContain('urn:schemas-microsoft-com:office:word')
    expect(docs.html).toContain('class="export-quote"')
    expect(docs.html).not.toContain('<blockquote>')

    const html = await buildPreviewDocument({
      format: 'html',
      title: 'Physics Notes',
      content: sampleMd,
      toc: true,
      theme: { 'bg-editor': '#161822', 'text-main': '#f1f5f9' }
    })
    expect(html.html).toContain('class="container"')
    expect(html.html).toContain('class="wikilink"')
    expect(html.html).toContain('class="site-shell"')
    expect(html.html).toContain('class="site-header"')
    expect(html.html).toContain('class="site-toc"')
    expect(html.html).toContain('class="toc-mobile"')
    expect(html.html).toContain('class="code-card"')
    expect(html.html).toContain('data-theme-toggle')
    expect(html.html).toContain('data-copy-code')
    expect(html.html).toContain('Back to top')
    expect(html.html).not.toContain('cdn.jsdelivr.net')
    expect(html.html).not.toContain('cdnjs.cloudflare.com')

    const md = await buildPreviewDocument({
      format: 'markdown',
      title: 'Physics Notes',
      content: sampleMd
    })
    expect(md.html).toContain('class="md"')
    expect(md.html).toContain('[[TargetNote|Alias]]')

    const zip = await buildPreviewDocument({
      format: 'zip',
      title: 'Physics Notes',
      content: sampleMd
    })
    expect(zip.html).toContain('class="md"')

    const txtStripped = await buildPreviewDocument({
      format: 'text',
      title: 'Physics Notes',
      content: sampleMd,
      stripMarkdown: true,
      includeTitle: true
    })
    expect(txtStripped.html).toContain('class="txt"')
    expect(txtStripped.html).toContain('Physics Notes')
    expect(txtStripped.html).not.toContain('## Section Two')

    const txtRaw = await buildPlainText('Physics Notes', '# Raw\n**Bold**', {
      stripMarkdown: false,
      includeTitle: false
    })
    expect(txtRaw).toBe('# Raw\n**Bold**')
  })

  it('merges multi-note batch preview payloads with section dividers', async () => {
    const res = await buildPreviewDocument({
      format: 'html',
      title: 'Sprint Pack',
      notes: [
        { id: '1', title: 'Alpha', content: 'First body' },
        { id: '2', title: 'Beta', content: '# Beta\n\nSecond body' }
      ],
      toc: true
    })
    expect(res.html).toContain('<h1 id="toc-0-alpha">Alpha</h1>')
    expect(res.html).toContain('<h1 id="toc-1-beta">Beta</h1>')
    expect(res.html).toContain('<hr>')
  })

  it('collects local workspace assets and rewrites links cleanly', async () => {
    const readAsset = vi.fn().mockResolvedValue(new Uint8Array([137, 80, 78, 71]))
    ;(window as any).api = { readAsset }

    const md = 'Here is ![shot](asset://local/images/diagram.png) and ![web](https://example.com/a.png)'
    const assets = await collectLocalAssets(md, false)
    expect(readAsset).toHaveBeenCalledTimes(1)
    expect(readAsset).toHaveBeenCalledWith('images/diagram.png')
    expect(assets).toHaveLength(1)
    expect(assets[0].filename).toBe('diagram.png')

    const rewritten = rewriteMarkdownAssetLinks(md, assets, './assets/')
    expect(rewritten).toBe(
      'Here is ![shot](./assets/diagram.png) and ![web](https://example.com/a.png)'
    )
  })

  it('formats copyable content according to active format options', async () => {
    const copiedText = await formatCopyableContent({
      format: 'text',
      title: 'Checklist',
      content: '## Tasks\n- One\n- Two',
      stripMarkdown: true,
      includeTitle: true
    })
    expect(copiedText).toContain('Checklist')
    expect(copiedText).not.toContain('## Tasks')

    const copiedMd = await formatCopyableContent({
      format: 'markdown',
      title: 'Checklist',
      content: '## Tasks\n- One'
    })
    expect(copiedMd).toBe('## Tasks\n- One')
  })
})
