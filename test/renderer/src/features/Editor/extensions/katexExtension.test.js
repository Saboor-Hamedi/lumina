import { describe, it, expect } from 'vitest'
import katex from 'katex'
import { katexExtension } from '../../../../../../src/renderer/src/features/Editor/extensions/katexExtension'
import { EditorState } from '@codemirror/state'
import { EditorView } from '@codemirror/view'

describe('katexExtension', () => {
  it('renders inline math with katex.renderToString', () => {
    const rendered = katex.renderToString('E = mc^2', {
      displayMode: false,
      throwOnError: false
    })
    expect(rendered).toContain('katex')
    expect(rendered).toContain('E')
  })

  it('renders display block math with katex.renderToString', () => {
    const rendered = katex.renderToString('e^{i\\pi} + 1 = 0', {
      displayMode: true,
      throwOnError: false
    })
    expect(rendered).toContain('katex-display')
  })

  it('handles syntax errors gracefully without throwing', () => {
    const rendered = katex.renderToString('\\invalid_macro_xyz', {
      displayMode: false,
      throwOnError: false
    })
    expect(rendered).toBeTruthy()
  })

  it('attaches to CodeMirror EditorView without throwing', () => {
    const state = EditorState.create({
      doc: '# Math\n\nInline $E=mc^2$ and block:\n\n$$\\int x dx$$\n',
      extensions: [katexExtension]
    })

    const parent = document.createElement('div')
    const view = new EditorView({
      state,
      parent
    })

    expect(view).toBeDefined()
    expect(view.state.doc.toString()).toContain('$E=mc^2$')
    view.destroy()
  })

  it('keeps source open when cursor is at the end of the closing $$ line with trailing space', () => {
    const doc = '$$\nE = mc^2\n$$  \nNext line'
    const closingLineEnd = doc.indexOf('\nNext line')
    const state = EditorState.create({
      doc,
      selection: { anchor: closingLineEnd },
      extensions: [katexExtension]
    })

    const parent = document.createElement('div')
    const view = new EditorView({ state, parent })

    expect(parent.querySelector('.cm-katex-source-line')).not.toBeNull()
    expect(parent.querySelector('.cm-katex-live-preview-wrap')).not.toBeNull()
    view.destroy()
  })

  it('places cursor inside LaTeX content on block preview mousedown', () => {
    const doc = 'Top\n\n$$\nE = mc^2\n$$\n\nBottom'
    const state = EditorState.create({
      doc,
      selection: { anchor: 0 },
      extensions: [katexExtension]
    })

    const parent = document.createElement('div')
    const view = new EditorView({ state, parent })

    const preview = parent.querySelector('.cm-katex-block')
    expect(preview).not.toBeNull()
    preview.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }))

    const eqPos = doc.indexOf('E = mc^2')
    expect(view.state.selection.main.anchor).toBe(eqPos)
    view.destroy()
  })
})
