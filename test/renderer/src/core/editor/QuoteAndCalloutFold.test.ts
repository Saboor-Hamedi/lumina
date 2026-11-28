import { describe, it, expect, afterEach } from 'vitest'
import { EditorState } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { quoteExtension, quoteFoldField } from '../../../../../src/renderer/src/core/editor/Quote'
import {
  calloutExtension,
  calloutFoldField
} from '../../../../../src/renderer/src/core/editor/useCallout'

function createTestView(doc: string): { view: EditorView; parent: HTMLDivElement } {
  const parent = document.createElement('div')
  document.body.appendChild(parent)
  const state = EditorState.create({
    doc,
    selection: { anchor: 0 },
    extensions: [calloutExtension, quoteExtension]
  })
  const view = new EditorView({ state, parent })
  return { view, parent }
}

describe('Quote.tsx & useCallout.ts — Independent Block Headers & Fold/Unfold', () => {
  const mounted: Array<{ view: EditorView; parent: HTMLDivElement }> = []

  afterEach(() => {
    while (mounted.length > 0) {
      const item = mounted.pop()!
      item.view.destroy()
      item.parent.remove()
    }
  })

  it('renders plain flat Quote header with copy + dropdown and reliably folds & unfolds multi-line quotes', () => {
    const doc = 'Intro line\n\n> First quoted line\n> Second quoted line\n\nAfter'
    const ctx = createTestView(doc)
    mounted.push(ctx)
    const { view, parent } = ctx

    const header = parent.querySelector<HTMLElement>('.lumina-quote-header')
    expect(header).not.toBeNull()
    expect(header?.classList.contains('is-collapsed')).toBe(false)
    expect(header?.querySelector('.lumina-quote-copy-btn')).not.toBeNull()
    const foldBtn = header?.querySelector<HTMLButtonElement>('.lumina-quote-fold-btn')
    expect(foldBtn).not.toBeNull()

    // Click to fold
    foldBtn!.click()
    const startPos = view.state.doc.line(3).from
    expect(view.state.field(quoteFoldField).get(startPos)).toBe(true)

    const collapsedHeader = parent.querySelector<HTMLElement>('.lumina-quote-header.is-collapsed')
    expect(collapsedHeader).not.toBeNull()
    expect(collapsedHeader?.textContent).toContain('2 lines')

    // Click again to unfold
    const unfoldBtn = collapsedHeader!.querySelector<HTMLButtonElement>('.lumina-quote-fold-btn')
    expect(unfoldBtn).not.toBeNull()
    unfoldBtn!.click()
    expect(view.state.field(quoteFoldField).get(startPos)).toBe(false)
    expect(parent.querySelector('.lumina-quote-header.is-collapsed')).toBeNull()
  })

  it('renders atomic block Callout header without Quote overlap and reliably folds & unfolds > [!error]', () => {
    const doc = 'Intro\n\n> [!error] Failure\n> Something went wrong\n\nEnd'
    const ctx = createTestView(doc)
    mounted.push(ctx)
    const { view, parent } = ctx

    // Quote extension must not decorate callouts
    expect(parent.querySelector('.lumina-quote-header')).toBeNull()

    const calloutHeader = parent.querySelector<HTMLElement>('.lumina-callout-block-header')
    expect(calloutHeader).not.toBeNull()
    const foldBtn = calloutHeader?.querySelector<HTMLButtonElement>('.lumina-callout-fold-btn')
    expect(foldBtn).not.toBeNull()

    const startPos = view.state.doc.line(3).from
    foldBtn!.click()
    expect(view.state.field(calloutFoldField).get(startPos)).toBe(true)

    const collapsedHeader = parent.querySelector<HTMLElement>(
      '.lumina-callout-block-header.is-collapsed'
    )
    expect(collapsedHeader).not.toBeNull()
    expect(collapsedHeader?.textContent).toContain('1 line')

    // Click again to unfold
    const unfoldBtn = collapsedHeader!.querySelector<HTMLButtonElement>('.lumina-callout-fold-btn')
    expect(unfoldBtn).not.toBeNull()
    unfoldBtn!.click()
    expect(view.state.field(calloutFoldField).get(startPos)).toBe(false)
    expect(parent.querySelector('.lumina-callout-block-header.is-collapsed')).toBeNull()
  })

  it('keeps Callout header visible while cursor is in the body and folds immediately on click', () => {
    const doc = 'Top\n\n> [!importen]\n> Hello\n\nBottom'
    const ctx = createTestView(doc)
    mounted.push(ctx)
    const { view, parent } = ctx

    // Place caret inside the callout body (`> Hello`)
    const bodyLine = view.state.doc.line(4)
    view.dispatch({ selection: { anchor: bodyLine.to } })

    // Block header remains visible and never disappears while editing the body
    const header = parent.querySelector<HTMLElement>('.lumina-callout-block-header')
    expect(header).not.toBeNull()

    const foldBtn = header!.querySelector<HTMLButtonElement>('.lumina-callout-fold-btn')
    expect(foldBtn).not.toBeNull()
    foldBtn!.click()

    const calloutStart = view.state.doc.line(3).from
    expect(view.state.field(calloutFoldField).get(calloutStart)).toBe(true)
    expect(parent.querySelector('.lumina-callout-block-header.is-collapsed')).not.toBeNull()

    // Clicking again unfolds cleanly
    const unfoldBtn = parent.querySelector<HTMLButtonElement>(
      '.lumina-callout-block-header.is-collapsed .lumina-callout-fold-btn'
    )
    expect(unfoldBtn).not.toBeNull()
    unfoldBtn!.click()
    expect(view.state.field(calloutFoldField).get(calloutStart)).toBe(false)
  })

  it('isolates adjacent Quote and Callout blocks cleanly', () => {
    const doc = 'Top\n\n> Standalone quote\n> [!error] Alert\n> Body line'
    const ctx = createTestView(doc)
    mounted.push(ctx)
    const { parent } = ctx

    expect(parent.querySelector('.lumina-quote-header')).not.toBeNull()
    expect(parent.querySelector('.lumina-callout-block-header')).not.toBeNull()
    expect(parent.querySelector('.lumina-callout-line-last')).not.toBeNull()
  })
})
