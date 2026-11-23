import { describe, it, expect, vi, afterEach } from 'vitest'
import { EditorState } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { imageWidgetExtension, ImageWidget } from '@renderer/features/media/hooks/imageExtension'

function createEditor(doc: string, anchor = 0): EditorView {
  const parent = document.createElement('div')
  document.body.appendChild(parent)
  const state = EditorState.create({
    doc,
    selection: { anchor },
    extensions: [imageWidgetExtension]
  })
  return new EditorView({ state, parent })
}

describe('imageExtension sleek widget & side-by-side layout', () => {
  const originalApi = (window as any).api
  const originalCreateObjectURL = URL.createObjectURL

  afterEach(() => {
    ;(window as any).api = originalApi
    URL.createObjectURL = originalCreateObjectURL
    document.body.innerHTML = ''
    vi.restoreAllMocks()
  })

  it('renders hover toolbar and slim resize handle without bulky permanent header', () => {
    const view = createEditor('![Photo](https://example.com/photo.png)')
    const wrapper = view.dom.querySelector('.cm-image-widget-wrapper') as HTMLElement
    expect(wrapper).not.toBeNull()
    expect(wrapper.classList.contains('align-center')).toBe(true)
    expect(wrapper.classList.contains('is-floated')).toBe(false)
    expect(wrapper.querySelector('.image-widget-header')).toBeNull()
    expect(wrapper.querySelector('.image-widget-toolbar')).not.toBeNull()
    expect(wrapper.querySelector('.image-widget-resize-handle')).not.toBeNull()
    expect(wrapper.querySelector('.image-widget-size-badge')).not.toBeNull()
    view.destroy()
  })

  it('uses inline floated placement for left/right images so text remains editable beside the image', () => {
    const lineText = 'Notes on left ![diagram|240px|left](https://example.com/a.png) notes on right'
    const view = createEditor(lineText, 0)

    const wrapper = view.dom.querySelector('.cm-image-widget-wrapper') as HTMLElement
    expect(wrapper).not.toBeNull()
    expect(wrapper.classList.contains('align-left')).toBe(true)
    expect(wrapper.classList.contains('is-floated')).toBe(true)
    expect(wrapper.classList.contains('is-inline')).toBe(true)
    expect(view.dom.textContent).toContain('Notes on left ')
    expect(view.dom.textContent).toContain(' notes on right')

    // Moving cursor immediately after the image token keeps the image rendered (non-intersecting)
    const endOfImg = lineText.indexOf(')') + 1
    view.dispatch({ selection: { anchor: endOfImg + 2 } })
    expect(view.dom.querySelector('.cm-image-widget-wrapper')).not.toBeNull()
    view.destroy()
  })

  it('parses right-aligned standalone image as floated inline widget for adjacent paragraph flow', () => {
    const doc = '![chart|300px|right](https://example.com/chart.png)\nParagraph flowing beside image'
    const view = createEditor(doc, doc.indexOf('Paragraph'))

    const wrapper = view.dom.querySelector('.cm-image-widget-wrapper') as HTMLElement
    expect(wrapper).not.toBeNull()
    expect(wrapper.classList.contains('align-right')).toBe(true)
    expect(wrapper.classList.contains('is-floated')).toBe(true)
    expect(view.dom.textContent).toContain('Paragraph flowing beside image')
    view.destroy()
  })

  it('shows PulseLoader while loading a local asset and creates Blob with inferred MIME type', async () => {
    let resolveAsset!: (val: Uint8Array) => void
    const pendingAsset = new Promise<Uint8Array>((resolve) => {
      resolveAsset = resolve
    })
    const readAsset = vi.fn(() => pendingAsset)
    const createObjectURL = vi.fn((_blob: Blob | MediaSource) => 'blob:mock-webp')
    ;(window as any).api = { readAsset }
    URL.createObjectURL = createObjectURL

    const widget = new ImageWidget('WebP Shot', 'assets/shot.webp', 0, 29, null, true)
    const mockView = { state: { readOnly: false }, requestMeasure: vi.fn() } as unknown as EditorView
    const dom = widget.toDOM(mockView)

    expect(dom.querySelector('.image-widget-loading [data-testid="pulse-loader"]')).not.toBeNull()
    expect(readAsset).toHaveBeenCalledWith('assets/shot.webp')

    resolveAsset(new Uint8Array([82, 73, 70, 70]))
    await new Promise((r) => setTimeout(r, 10))

    expect(createObjectURL).toHaveBeenCalledTimes(1)
    const blobArg = createObjectURL.mock.calls[0][0] as Blob
    expect(blobArg.type).toBe('image/webp')
    const img = dom.querySelector('img') as HTMLImageElement
    expect(img.src).toContain('blob:mock-webp')
  })
})
