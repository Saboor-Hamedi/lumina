import { describe, it, expect, vi } from 'vitest'
import {
  htmlToMarkdown,
  cleanWordHtml,
  applyRichPasteToView
} from '../../../../../../src/renderer/src/features/Editor/utils/htmlToMarkdown'

describe('htmlToMarkdown', () => {
  describe('cleanWordHtml', () => {
    it('extracts content between StartFragment and EndFragment', () => {
      const input = '<html><body><!--StartFragment--><p>Hello Word</p><!--EndFragment--></body></html>'
      expect(cleanWordHtml(input)).toBe('<p>Hello Word</p>')
    })

    it('strips Microsoft Word conditional comments and namespace tags', () => {
      const input = '<!--[if gte mso 9]><xml><w:WordDocument></w:WordDocument></xml><![endif]--><p class="MsoNormal">Test<o:p></o:p></p>'
      expect(cleanWordHtml(input)).toBe('<p class="MsoNormal">Test</p>')
    })

    it('strips empty Word spacer paragraphs', () => {
      const input = '<p class="MsoNormal">&nbsp;</p><p>Content</p><p class="MsoNormal">   </p>'
      expect(cleanWordHtml(input)).toBe('<p>Content</p>')
    })
  })

  describe('Formatting & Typographic conversions', () => {
    it('converts bold, strong, and font-weight 700 to markdown asterisks', async () => {
      const html = '<p><b>Bold 1</b> and <strong>Bold 2</strong> and <span style="font-weight: 700">Bold 3</span></p>'
      const md = await htmlToMarkdown(html)
      expect(md).toContain('**Bold 1**')
      expect(md).toContain('**Bold 2**')
      expect(md).toContain('**Bold 3**')
    })

    it('converts italic, em, and font-style italic to markdown asterisks', async () => {
      const html = '<p><i>Italic 1</i> and <em>Italic 2</em> and <span style="font-style: italic">Italic 3</span></p>'
      const md = await htmlToMarkdown(html)
      expect(md).toContain('*Italic 1*')
      expect(md).toContain('*Italic 2*')
      expect(md).toContain('*Italic 3*')
    })

    it('converts headings h1 to h3 and Word MsoHeading', async () => {
      const html = '<h1>Title</h1><p class="MsoHeading2">Subtitle</p>'
      const md = await htmlToMarkdown(html)
      expect(md).toContain('# Title')
      expect(md).toContain('## Subtitle')
    })

    it('converts unordered, ordered, and nested lists', async () => {
      const html = '<ul><li>Parent<ul><li>Child</li></ul></li><li>Sibling</li></ul>'
      const md = await htmlToMarkdown(html)
      expect(md).toContain('- Parent')
      expect(md).toContain('  - Child')
      expect(md).toContain('- Sibling')
    })

    it('converts links and blockquotes', async () => {
      const html = '<blockquote>Quote text</blockquote><a href="https://example.com">Visit</a>'
      const md = await htmlToMarkdown(html)
      expect(md).toContain('> Quote text')
      expect(md).toContain('[Visit](https://example.com)')
    })

    it('justifies paragraphs by removing ragged mid-sentence line wraps', async () => {
      const html = '<p>First line of sentence.\nSecond line of sentence.\nThird line.</p>'
      const md = await htmlToMarkdown(html)
      expect(md).toBe('First line of sentence. Second line of sentence. Third line.')
    })
  })

  describe('Table conversions (Microsoft Word & GFM)', () => {
    it('converts standard HTML tables into GFM pipe tables', async () => {
      const html = `
        <table>
          <thead>
            <tr><th align="center">Header 1</th><th align="right">Header 2</th></tr>
          </thead>
          <tbody>
            <tr><td>Cell A</td><td>Cell B</td></tr>
          </tbody>
        </table>
      `
      const md = await htmlToMarkdown(html)
      expect(md).toContain('| Header 1 | Header 2 |')
      expect(md).toContain('| :---: | ---: |')
      expect(md).toContain('| Cell A | Cell B |')
    })

    it('converts Microsoft Word tables where headers only use <td> without <th>', async () => {
      const html = `
        <table>
          <tr><td>Column 1</td><td>Column 2</td></tr>
          <tr><td>Data 1</td><td>Data 2</td></tr>
        </table>
      `
      const md = await htmlToMarkdown(html)
      expect(md).toContain('| Column 1 | Column 2 |')
      expect(md).toContain('| --- | --- |')
      expect(md).toContain('| Data 1 | Data 2 |')
    })

    it('escapes pipe characters and eliminates literal <br> tags in table cells', async () => {
      const html = `
        <table>
          <tr><td>Col A</td><td>Col B</td></tr>
          <tr><td>Line 1<br>Line 2</td><td>Has | Pipe</td></tr>
        </table>
      `
      const md = await htmlToMarkdown(html)
      expect(md).not.toContain('<br>')
      expect(md).toContain('Line 1 Line 2')
      expect(md).toContain('Has \\| Pipe')
    })

    it('handles colspan by padding extra columns to maintain alignment', async () => {
      const html = `
        <table>
          <tr><td colspan="2">Spanned Header</td></tr>
          <tr><td>Cell 1</td><td>Cell 2</td></tr>
        </table>
      `
      const md = await htmlToMarkdown(html)
      expect(md).toContain('| Spanned Header |   |')
      expect(md).toContain('| Cell 1 | Cell 2 |')
    })

    it('strips <u> tags and residual HTML formatting from table cells', async () => {
      const html = `
        <table>
          <tr><td>Role</td><td>Signature</td></tr>
          <tr><td>Leader</td><td><u>Dr. Sajarwo Anggai., S.ST., M.T.</u></td></tr>
        </table>
      `
      const md = await htmlToMarkdown(html)
      expect(md).not.toContain('<u>')
      expect(md).not.toContain('</u>')
      expect(md).toContain('Dr. Sajarwo Anggai., S.ST., M.T.')
    })
  })

  describe('Table of Contents & References polish', () => {
    it('renders Table of Contents lines tightly without giant gaps', async () => {
      const html = `
        <p class="MsoToc1">1. Introduction ..................... 1</p>
        <p class="MsoToc2">1.1 Background .................... 2</p>
        <p class="MsoToc1">2. Methodology ..................... 5</p>
      `
      const md = await htmlToMarkdown(html)
      expect(md).not.toContain('\n\n\n')
      expect(md).toContain('- 1. Introduction ... 1')
      expect(md).toContain('  - 1.1 Background ... 2')
    })

    it('auto-links URLs in references so they are highlighted in markdown', async () => {
      const html = `
        <p class="MsoBibliography">[1] Smith, J. (2023). Study. https://doi.org/10.1016/j.test.2023.01</p>
        <p class="MsoBibliography">[2] Doe, A. (2024). Report. https://example.com/paper.pdf.</p>
      `
      const md = await htmlToMarkdown(html)
      expect(md).toContain('[https://doi.org/10.1016/j.test.2023.01](https://doi.org/10.1016/j.test.2023.01)')
      expect(md).toContain('[https://example.com/paper.pdf](https://example.com/paper.pdf).')
      expect(md).not.toContain('\n\n\n')
    })
  })

  describe('Image extraction', () => {
    it('extracts base64 data URLs and saves via onSaveImage callback', async () => {
      const onSaveImage = vi.fn().mockResolvedValue('assets/pasted-test.png')
      const html = '<p>Image below:</p><img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==" alt="Sample" />'
      const md = await htmlToMarkdown(html, { onSaveImage })

      expect(onSaveImage).toHaveBeenCalled()
      expect(md).toContain('![Sample](assets/pasted-test.png)')
    })

    it('preserves external image URLs', async () => {
      const html = '<img src="https://example.com/photo.jpg" alt="Photo" />'
      const md = await htmlToMarkdown(html)
      expect(md).toContain('![Photo](https://example.com/photo.jpg)')
    })

    it('extracts Microsoft Word file:/// temp images and saves via onSaveImageFromPath', async () => {
      const onSaveImageFromPath = vi.fn().mockResolvedValue('.lumina/assets/word-image.png')
      const html = '<p>Word content</p><img src="file:///C:/Users/Test/AppData/Local/Temp/msohtmlclip1/01/clip_image001.png" alt="WordGraphic" />'
      const md = await htmlToMarkdown(html, { onSaveImageFromPath })

      expect(onSaveImageFromPath).toHaveBeenCalledWith(
        'file:///C:/Users/Test/AppData/Local/Temp/msohtmlclip1/01/clip_image001.png',
        'WordGraphic'
      )
      expect(md).toContain('![WordGraphic](.lumina/assets/word-image.png)')
    })

    it('extracts Word VML <v:imagedata> when no non-VML fallback is present', async () => {
      const onSaveImageFromPath = vi.fn().mockResolvedValue('.lumina/assets/vml-image.png')
      const html = '<!--[if gte vml 1]><v:shape><v:imagedata src="file:///C:/Temp/clip_image001.png" o:title="Chart"/></v:shape><![endif]-->'
      const md = await htmlToMarkdown(html, { onSaveImageFromPath })

      expect(onSaveImageFromPath).toHaveBeenCalledWith('file:///C:/Temp/clip_image001.png', 'Chart')
      expect(md).toContain('![Chart](.lumina/assets/vml-image.png)')
    })

    it('deduplicates Word VML and non-VML fallback block so only one image is output', async () => {
      const onSaveImageFromPath = vi.fn().mockResolvedValue('.lumina/assets/single-image.png')
      const html = `
        <!--[if gte vml 1]><v:shape><v:imagedata src="file:///C:/Temp/vml_dup.png"/></v:shape><![endif]-->
        <![if !vml]><img src="file:///C:/Temp/fallback.jpg" alt="FinalChart"><![endif]>
      `
      const md = await htmlToMarkdown(html, { onSaveImageFromPath })

      expect(onSaveImageFromPath).toHaveBeenCalledTimes(1)
      expect(onSaveImageFromPath).toHaveBeenCalledWith('file:///C:/Temp/fallback.jpg', 'FinalChart')
      expect(md).toBe('![FinalChart](.lumina/assets/single-image.png)')
    })

    it('resolves relative image path using <base href="..."> from Word', async () => {
      const onSaveImageFromPath = vi.fn().mockResolvedValue('.lumina/assets/relative-image.png')
      const html = `
        <base href="file:///C:/Users/Test/AppData/Local/Temp/msohtmlclip1/01/">
        <p><img src="clip_image003.png" alt="RelativeDiagram"></p>
      `
      const md = await htmlToMarkdown(html, { onSaveImageFromPath })

      expect(onSaveImageFromPath).toHaveBeenCalledWith(
        'file:///C:/Users/Test/AppData/Local/Temp/msohtmlclip1/01/clip_image003.png',
        'RelativeDiagram'
      )
      expect(md).toContain('![RelativeDiagram](.lumina/assets/relative-image.png)')
    })

    it('falls back to onGetClipboardImage when local file saving is unavailable or returns null', async () => {
      const onSaveImageFromPath = vi.fn().mockResolvedValue(null)
      const onGetClipboardImage = vi.fn().mockResolvedValue('.lumina/assets/clipboard-fallback.png')
      const html = '<img src="file:///C:/Deleted/clip_image999.png" alt="FallbackImg" />'

      const md = await htmlToMarkdown(html, { onSaveImageFromPath, onGetClipboardImage })

      expect(onSaveImageFromPath).toHaveBeenCalled()
      expect(onGetClipboardImage).toHaveBeenCalled()
      expect(md).toContain('![FallbackImg](.lumina/assets/clipboard-fallback.png)')
    })

    it('preserves text and captions between multiple figures without catastrophic regex bridging', async () => {
      const onSaveImageFromPath = vi
        .fn()
        .mockResolvedValueOnce('.lumina/assets/fig1.png')
        .mockResolvedValueOnce('.lumina/assets/fig2.png')

      const html = `
        <p><!--[if gte vml 1]><v:shape><v:imagedata src="file:///C:/Temp/fig1.png"/></v:shape><![endif]--></p>
        <p class="MsoCaption">Figure 1: Architecture of the system</p>
        <p>This is crucial explanatory text between Figure 1 and Figure 2.</p>
        <p><!--[if gte vml 1]><v:shape><v:imagedata src="file:///C:/Temp/fig2.png"/></v:shape><![endif]--><![if !vml]><img src="file:///C:/Temp/fig2_alt.png" alt="Database"><![endif]></p>
        <p class="MsoCaption">Figure 2: Database entity relations</p>
      `

      const md = await htmlToMarkdown(html, { onSaveImageFromPath })

      expect(md).toContain('![image](.lumina/assets/fig1.png)')
      expect(md).toContain('Figure 1: Architecture of the system')
      expect(md).toContain('This is crucial explanatory text between Figure 1 and Figure 2.')
      expect(md).toContain('![Database](.lumina/assets/fig2.png)')
      expect(md).toContain('Figure 2: Database entity relations')
    })

    it('renders internal bookmark links (e.g. #_Ref, #fig) as clean text without clickable jump links', async () => {
      const html = '<p>As demonstrated in Figure <a href="#_Ref12345678">1</a>, the results match expectations.</p>'
      const md = await htmlToMarkdown(html)

      expect(md).not.toContain('[1](#_Ref12345678)')
      expect(md).toContain('As demonstrated in Figure 1, the results match expectations.')
    })

    it('unwraps textboxes in VML drawing shapes so captions and callouts are preserved', async () => {
      const html = `
        <v:shape>
          <v:textbox>
            <p class="MsoCaption">Figure 3: Callout detail inside textbox</p>
          </v:textbox>
        </v:shape>
      `
      const md = await htmlToMarkdown(html)
      expect(md).toContain('Figure 3: Callout detail inside textbox')
    })
  })

  describe('applyRichPasteToView', () => {
    it('dispatches converted markdown to CodeMirror EditorView', async () => {
      const view = {
        state: {
          selection: { main: { from: 5, to: 5 } }
        },
        dispatch: vi.fn(),
        focus: vi.fn()
      }

      const handled = await applyRichPasteToView(view, '<p><b>Hello</b></p>', 'Hello')
      expect(handled).toBe(true)
      expect(view.dispatch).toHaveBeenCalledWith({
        changes: { from: 5, to: 5, insert: '**Hello**' },
        selection: { anchor: 5 + '**Hello**'.length }
      })
      expect(view.focus).toHaveBeenCalled()
    })

    it('falls back to plain text when HTML conversion is empty', async () => {
      const view = {
        state: {
          selection: { main: { from: 0, to: 0 } }
        },
        dispatch: vi.fn(),
        focus: vi.fn()
      }

      const handled = await applyRichPasteToView(view, '', 'Plain fallback')
      expect(handled).toBe(true)
      expect(view.dispatch).toHaveBeenCalledWith({
        changes: { from: 0, to: 0, insert: 'Plain fallback' },
        selection: { anchor: 'Plain fallback'.length }
      })
    })
  })
})
