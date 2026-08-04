import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import InlineLumina from '../../../../../src/renderer/src/features/Overlays/InlineLumina'
import { useSettingsStore } from '../../../../../src/renderer/src/core/store/useSettingsStore'

function makeEditorView({
  docText = 'first line\nsecond line',
  selection = { from: 0, to: 0 }
} = {}) {
  const lines = docText.split('\n')
  const lineInfo = (num) => {
    let acc = 0
    for (let i = 0; i < lines.length; i++) {
      if (i + 1 === num)
        return { number: num, from: acc, to: acc + lines[i].length, text: lines[i] }
      acc += lines[i].length + 1
    }
    return { number: num, from: acc, to: acc, text: '' }
  }
  return {
    state: {
      selection: { main: { ...selection, head: selection.from } },
      doc: {
        toString: () => docText,
        sliceString: (from, to) => docText.slice(from, to),
        lineAt: (pos) => {
          let acc = 0
          for (let i = 0; i < lines.length; i++) {
            if (pos <= acc + lines[i].length) return lineInfo(i + 1)
            acc += lines[i].length + 1
          }
          return lineInfo(lines.length)
        },
        line: lineInfo,
        lines: lines.length
      }
    },
    coordsAtPos: () => ({ top: 100, left: 100, bottom: 120, right: 200 })
  }
}

function mockStreamingResponse(chunks = []) {
  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    start(controller) {
      for (const c of chunks) controller.enqueue(encoder.encode(c))
      controller.close()
    }
  })
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    body: { getReader: () => stream.getReader() }
  })
}

function makeDelta(content) {
  return `data: ${JSON.stringify({ choices: [{ delta: { content } }] })}\n\n`
}

describe('InlineLumina', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv('VITE_DEEPSEEK_KEY', '')
    vi.stubGlobal('requestAnimationFrame', (cb) => {
      cb()
      return 1
    })
    global.navigator = {
      ...global.navigator,
      clipboard: { writeText: vi.fn().mockResolvedValue(true) }
    }
    useSettingsStore.setState({ settings: { deepSeekKey: null, deepSeekModel: 'deepseek-chat' } })
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  const renderOpen = (props = {}) =>
    render(
      <InlineLumina
        isOpen
        onClose={props.onClose || vi.fn()}
        onInsert={props.onInsert || vi.fn()}
        editorView={props.editorView || null}
        title={props.title}
        cursorPosition={props.cursorPosition}
      />
    )

  describe('rendering', () => {
    it('renders nothing when closed', () => {
      const { container } = render(
        <InlineLumina isOpen={false} onClose={vi.fn()} onInsert={vi.fn()} />
      )
      expect(container.firstChild).toBeNull()
    })

    it('renders the modal and input when open', () => {
      renderOpen()
      expect(screen.getByPlaceholderText('Ask Lumina...')).toBeInTheDocument()
      expect(screen.getByText(/to close/)).toBeInTheDocument()
    })

    it('shows selection-specific placeholder when text is selected', () => {
      const view = makeEditorView({ docText: 'hello world', selection: { from: 0, to: 5 } })
      renderOpen({ editorView: view })
      expect(screen.getByPlaceholderText('Ask Lumina to edit selection...')).toBeInTheDocument()
    })

    it('shows "Ask Lumina..." placeholder when no selection', () => {
      const view = makeEditorView()
      renderOpen({ editorView: view })
      expect(screen.getByPlaceholderText('Ask Lumina...')).toBeInTheDocument()
    })
  })

  describe('input & submit', () => {
    it('submit button is disabled when query empty', () => {
      renderOpen()
      const sendBtn = screen.getByTitle('Send (Enter)')
      expect(sendBtn).toBeDisabled()
    })

    it('submit button is enabled after typing', async () => {
      renderOpen()
      const input = screen.getByPlaceholderText('Ask Lumina...')
      await userEvent.type(input, 'expand this')
      expect(screen.getByTitle('Send (Enter)')).toBeEnabled()
    })

    it('shows missing API key error when no key configured', async () => {
      renderOpen()
      const input = screen.getByPlaceholderText('Ask Lumina...')
      await userEvent.type(input, 'expand this')
      await userEvent.keyboard('{Enter}')

      await waitFor(() => {
        expect(screen.getByText(/Missing API Key/)).toBeInTheDocument()
      })
    })

    it('renders a streaming response when a key is configured', async () => {
      useSettingsStore.setState({
        settings: { deepSeekKey: 'test-key', deepSeekModel: 'deepseek-chat' }
      })
      mockStreamingResponse([makeDelta('Hello '), makeDelta('world')])

      renderOpen()
      const input = screen.getByPlaceholderText('Ask Lumina...')
      await userEvent.type(input, 'expand this')
      await userEvent.keyboard('{Enter}')

      await waitFor(() => {
        expect(screen.getByText(/Hello world/)).toBeInTheDocument()
      })
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.deepseek.com/chat/completions',
        expect.objectContaining({ method: 'POST' })
      )
    })

    it('shows error message when API returns non-ok', async () => {
      useSettingsStore.setState({
        settings: { deepSeekKey: 'test-key', deepSeekModel: 'deepseek-chat' }
      })
      global.fetch = vi
        .fn()
        .mockResolvedValue({ ok: false, status: 500, json: () => Promise.resolve({}) })

      renderOpen()
      const input = screen.getByPlaceholderText('Ask Lumina...')
      await userEvent.type(input, 'expand this')
      await userEvent.keyboard('{Enter}')

      await waitFor(() => {
        expect(screen.getByText(/API Error: 500/)).toBeInTheDocument()
      })
    })
  })

  describe('actions', () => {
    it('calls onInsert with response when Insert clicked', async () => {
      useSettingsStore.setState({
        settings: { deepSeekKey: 'test-key', deepSeekModel: 'deepseek-chat' }
      })
      mockStreamingResponse([makeDelta('Expanded text')])
      const onInsert = vi.fn()

      renderOpen({ onInsert })
      const input = screen.getByPlaceholderText('Ask Lumina...')
      await userEvent.type(input, 'expand this')
      await userEvent.keyboard('{Enter}')

      const insertBtn = await screen.findByText('Insert')
      await userEvent.click(insertBtn)

      expect(onInsert).toHaveBeenCalledWith('Expanded text')
    })

    it('passes from/to range to onInsert when selection context exists', async () => {
      const view = makeEditorView({ docText: 'hello world', selection: { from: 0, to: 5 } })
      useSettingsStore.setState({
        settings: { deepSeekKey: 'test-key', deepSeekModel: 'deepseek-chat' }
      })
      mockStreamingResponse([makeDelta('Replacement')])
      const onInsert = vi.fn()

      renderOpen({ onInsert, editorView: view })
      const input = screen.getByPlaceholderText('Ask Lumina to edit selection...')
      await userEvent.type(input, 'replace')
      await userEvent.keyboard('{Enter}')

      const insertBtn = await screen.findByText('Insert')
      await userEvent.click(insertBtn)

      expect(onInsert).toHaveBeenCalledWith('Replacement', { from: 0, to: 5 })
    })

    it('copies response to clipboard', async () => {
      useSettingsStore.setState({
        settings: { deepSeekKey: 'test-key', deepSeekModel: 'deepseek-chat' }
      })
      mockStreamingResponse([makeDelta('Copyable text')])

      renderOpen()
      const input = screen.getByPlaceholderText('Ask Lumina...')
      await userEvent.type(input, 'expand this')
      await userEvent.keyboard('{Enter}')

      const copyBtn = await screen.findByText('Copy')
      await userEvent.click(copyBtn)

      expect(global.navigator.clipboard.writeText).toHaveBeenCalledWith('Copyable text')
      expect(await screen.findByText('Copied')).toBeInTheDocument()
    })

    it('calls onClose when close button clicked', async () => {
      useSettingsStore.setState({
        settings: { deepSeekKey: 'test-key', deepSeekModel: 'deepseek-chat' }
      })
      mockStreamingResponse([makeDelta('Text')])
      const onClose = vi.fn()

      renderOpen({ onClose })
      const input = screen.getByPlaceholderText('Ask Lumina...')
      await userEvent.type(input, 'expand this')
      await userEvent.keyboard('{Enter}')

      const closeBtn = await screen.findByTitle('Close (Esc)')
      await userEvent.click(closeBtn)

      expect(onClose).toHaveBeenCalled()
    })

    it('closes on Escape key when no response', async () => {
      const onClose = vi.fn()
      renderOpen({ onClose })

      const input = screen.getByPlaceholderText('Ask Lumina...')
      input.focus()
      fireEvent.keyDown(input, { key: 'Escape' })
      expect(onClose).toHaveBeenCalled()
    })

    it('closes when clicking overlay background', () => {
      const onClose = vi.fn()
      const { container } = renderOpen({ onClose })

      const overlay = container.querySelector('.inline-lumina-overlay')
      fireEvent.mouseDown(overlay, { target: overlay })

      expect(onClose).toHaveBeenCalled()
    })
  })

  describe('reset', () => {
    it('clears state when closed again', async () => {
      useSettingsStore.setState({
        settings: { deepSeekKey: 'test-key', deepSeekModel: 'deepseek-chat' }
      })
      mockStreamingResponse([makeDelta('Generated')])

      const onClose = vi.fn()
      const { rerender } = render(<InlineLumina isOpen onClose={onClose} onInsert={vi.fn()} />)
      const input = screen.getByPlaceholderText('Ask Lumina...')
      await userEvent.type(input, 'expand this')
      await userEvent.keyboard('{Enter}')

      await screen.findByText('Generated')

      rerender(<InlineLumina isOpen={false} onClose={onClose} onInsert={vi.fn()} />)
      expect(screen.queryByText('Generated')).not.toBeInTheDocument()
    })
  })
})
