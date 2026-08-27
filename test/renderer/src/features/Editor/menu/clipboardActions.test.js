import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  selectAll,
  cutText,
  copyText,
  pastePlainText
} from '../../../../../../src/renderer/src/features/Editor/menu/clipboardActions'

describe('clipboardActions', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  describe('selectAll', () => {
    it('does nothing when view is missing', () => {
      expect(() => selectAll(null)).not.toThrow()
    })

    it('dispatches selection across whole doc and focuses', () => {
      const view = {
        state: { doc: { length: 10 } },
        dispatch: vi.fn(),
        focus: vi.fn()
      }

      selectAll(view)

      expect(view.dispatch).toHaveBeenCalledWith({ selection: { anchor: 0, head: 10 } })
      expect(view.focus).toHaveBeenCalled()
    })
  })

  describe('cutText / copyText', () => {
    beforeEach(() => {
      // jsdom has no execCommand; add it so we can spy on calls
      if (!document.execCommand) document.execCommand = () => false
    })

    it('cut calls document.execCommand("cut")', () => {
      const spy = vi.spyOn(document, 'execCommand').mockImplementation(() => true)
      cutText()
      expect(spy).toHaveBeenCalledWith('cut')
    })

    it('copy calls document.execCommand("copy")', () => {
      const spy = vi.spyOn(document, 'execCommand').mockImplementation(() => true)
      copyText()
      expect(spy).toHaveBeenCalledWith('copy')
    })
  })

  describe('pastePlainText', () => {
    it('does nothing when view is missing', async () => {
      await expect(pastePlainText(null)).resolves.toBeUndefined()
    })

    it('reads clipboard and inserts at selection', async () => {
      const readText = vi.fn().mockResolvedValue('pasted text')
      Object.defineProperty(navigator, 'clipboard', {
        value: { readText },
        configurable: true
      })

      const view = {
        state: {
          selection: { main: { from: 3, to: 5 } }
        },
        dispatch: vi.fn(),
        focus: vi.fn()
      }

      await pastePlainText(view)

      expect(view.dispatch).toHaveBeenCalledWith({
        changes: { from: 3, to: 5, insert: 'pasted text' }
      })
      expect(view.focus).toHaveBeenCalled()
    })

    it('logs error when clipboard read fails', async () => {
      const readText = vi.fn().mockRejectedValue(new Error('denied'))
      Object.defineProperty(navigator, 'clipboard', {
        value: { readText },
        configurable: true
      })
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      const view = {
        state: { selection: { main: { from: 0, to: 0 } } },
        dispatch: vi.fn(),
        focus: vi.fn()
      }

      await pastePlainText(view)

      expect(errorSpy).toHaveBeenCalledWith('Failed to read clipboard', expect.any(Error))
      expect(view.dispatch).not.toHaveBeenCalled()
    })
  })
})
