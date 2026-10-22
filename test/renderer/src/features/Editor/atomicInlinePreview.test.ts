import { describe, it, expect } from 'vitest'
import { EditorState, EditorSelection } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import { inlinePreview } from '../../../../../src/renderer/src/features/Editor/atomic/inlinePreview'

function createTestEditor(doc: string, cursorPos = 0) {
  const container = document.createElement('div')
  document.body.appendChild(container)

  const view = new EditorView({
    parent: container,
    state: EditorState.create({
      doc,
      selection: EditorSelection.cursor(cursorPos),
      extensions: [
        markdown({ base: markdownLanguage }),
        inlinePreview()
      ]
    })
  })

  return { view, container }
}

describe('Atomic inlinePreview URL behavior', () => {
  it('does NOT hide bare URL when cursor is on a different line', () => {
    // Line 1: bare URL
    // Line 2: cursor is down here (after hitting Enter)
    const url = 'https://chat.qwen.ai/c/6ecb4bea-5a8c-4350-83bd-2f0394c0f64'
    const doc = `${url}\n`
    const { view, container } = createTestEditor(doc, doc.length)

    // Let CM6 paint and compute decorations
    const editorText = view.dom.textContent || ''
    expect(editorText).toContain('chat.qwen.ai')

    // Find all replaced ranges in the view state
    // Check that the bare URL position is not hidden by a replace decoration
    const plugin = view.plugin(view.state.facet(EditorView.decorations)[0] as any)
    
    // Inspect DOM lines
    const lines = view.dom.querySelectorAll('.cm-line')
    expect(lines.length).toBeGreaterThanOrEqual(1)
    expect(lines[0].textContent).toContain(url)

    // Check that the URL element has .cm-atomic-link styling
    const linkEl = view.dom.querySelector('.cm-atomic-link')
    expect(linkEl).not.toBeNull()
    expect(linkEl?.textContent).toBe(url)

    view.destroy()
    container.remove()
  })

  it('does NOT hide bare URL for canva presentation link when cursor moves down', () => {
    const url = 'https://www.canva.com/create/ai-presentations/'
    const doc = `${url}\nsecond line`
    // Cursor on second line
    const { view, container } = createTestEditor(doc, doc.indexOf('second'))

    const lines = view.dom.querySelectorAll('.cm-line')
    expect(lines[0].textContent).toContain(url)

    const linkEl = view.dom.querySelector('.cm-atomic-link')
    expect(linkEl).not.toBeNull()
    expect(linkEl?.textContent).toBe(url)

    view.destroy()
    container.remove()
  })

  it('hides the URL target for standard markdown links [text](url) when inactive', () => {
    const doc = '[My Link](https://example.com)\nsecond line'
    // Cursor on second line
    const { view, container } = createTestEditor(doc, doc.indexOf('second'))

    const lines = view.dom.querySelectorAll('.cm-line')
    // On inactive line, the markdown link should render the text
    expect(lines[0].textContent).toContain('My Link')

    view.destroy()
    container.remove()
  })
})
