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
})
