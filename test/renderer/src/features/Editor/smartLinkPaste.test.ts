import { describe, it, expect } from 'vitest'
import {
  isLikelyUrl,
  normalizePasteUrl,
  formatMarkdownLink,
  trySmartLinkPaste
} from '../../../../../src/renderer/src/features/Editor/utils/smartLinkPaste'
import { EditorState } from '@codemirror/state'
import { EditorView } from '@codemirror/view'

describe('Markdown Link Smart-Paste (smartLinkPaste)', () => {
  describe('isLikelyUrl', () => {
    it('detects standard https and http URLs', () => {
      expect(isLikelyUrl('https://www.canva.com/create/ai-presentations/')).toBe(true)
      expect(isLikelyUrl('http://localhost:3000')).toBe(true)
      expect(isLikelyUrl('https://example.com/path?foo=bar#hash')).toBe(true)
    })

    it('detects www. naked URLs', () => {
      expect(isLikelyUrl('www.google.com')).toBe(true)
      expect(isLikelyUrl('www.canva.com/create/ai-presentations/')).toBe(true)
    })

    it('detects mailto and file URLs', () => {
      expect(isLikelyUrl('mailto:user@example.com')).toBe(true)
      expect(isLikelyUrl('file:///C:/path/to/file.md')).toBe(true)
    })

    it('rejects multi-line strings or sentences', () => {
      expect(isLikelyUrl('https://example.com\nAnother line')).toBe(false)
      expect(isLikelyUrl('Check out https://example.com')).toBe(false)
      expect(isLikelyUrl('Not a url at all')).toBe(false)
      expect(isLikelyUrl('')).toBe(false)
    })
  })

  describe('normalizePasteUrl', () => {
    it('prepends https:// to www. domains', () => {
      expect(normalizePasteUrl('www.canva.com')).toBe('https://www.canva.com')
      expect(normalizePasteUrl('https://canva.com')).toBe('https://canva.com')
    })
  })

  describe('formatMarkdownLink', () => {
    it('wraps text and URL into markdown link format', () => {
      const result = formatMarkdownLink(
        'Canva AI Presentations',
        'https://www.canva.com/create/ai-presentations/'
      )
      expect(result).toBe('[Canva AI Presentations](https://www.canva.com/create/ai-presentations/)')
    })

    it('preserves leading and trailing selection spaces', () => {
      const result = formatMarkdownLink(
        '  Awesome Tool  ',
        'https://example.com'
      )
      expect(result).toBe('  [Awesome Tool](https://example.com)  ')
    })

    it('avoids double bracket wrapping when selection already contains brackets', () => {
      const result = formatMarkdownLink(
        '[Existing Bracketed]',
        'https://example.com'
      )
      expect(result).toBe('[Existing Bracketed](https://example.com)')
    })
  })

  describe('trySmartLinkPaste with EditorView', () => {
    it('transforms selected text into markdown link on URL paste', () => {
      const state = EditorState.create({
        doc: 'Check Canva AI for your slides.',
        selection: { anchor: 6, head: 14 } // "Canva AI"
      })
      const view = new EditorView({ state })

      const handled = trySmartLinkPaste(view, 'https://www.canva.com/create/ai-presentations/')
      expect(handled).toBe(true)
      expect(view.state.doc.toString()).toBe(
        'Check [Canva AI](https://www.canva.com/create/ai-presentations/) for your slides.'
      )
      // Cursor should be at the end of the newly inserted markdown link
      expect(view.state.selection.main.head).toBe(6 + '[Canva AI](https://www.canva.com/create/ai-presentations/)'.length)
    })

    it('returns false when no text is selected (cursor only)', () => {
      const state = EditorState.create({
        doc: 'Hello world',
        selection: { anchor: 5, head: 5 } // No selection
      })
      const view = new EditorView({ state })

      const handled = trySmartLinkPaste(view, 'https://example.com')
      expect(handled).toBe(false)
      expect(view.state.doc.toString()).toBe('Hello world') // Unchanged by smart paste
    })

    it('returns false when pasted text is not a URL', () => {
      const state = EditorState.create({
        doc: 'Select me please',
        selection: { anchor: 0, head: 9 } // "Select me"
      })
      const view = new EditorView({ state })

      const handled = trySmartLinkPaste(view, 'Just some regular text')
      expect(handled).toBe(false)
      expect(view.state.doc.toString()).toBe('Select me please')
    })

    it('returns false for multi-line selections to avoid layout corruption', () => {
      const state = EditorState.create({
        doc: 'Paragraph 1\nParagraph 2',
        selection: { anchor: 0, head: 22 }
      })
      const view = new EditorView({ state })

      const handled = trySmartLinkPaste(view, 'https://example.com')
      expect(handled).toBe(false)
    })
  })
})
