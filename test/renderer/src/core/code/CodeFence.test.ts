import { describe, it, expect, vi, beforeEach } from 'vitest'
import { EditorState } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { handleCodeFenceEnter, copyCodeAsImage } from '../../../../../src/renderer/src/core/code'

function createTestView(docText: string, cursorPos = 0): EditorView {
  const state = EditorState.create({
    doc: docText,
    selection: { anchor: cursorPos }
  })
  return new EditorView({ state })
}

describe('CodeFence.ts', () => {
  describe('handleCodeFenceEnter', () => {
    it('safely handles null or undefined view', () => {
      expect(handleCodeFenceEnter(null)).toBe(false)
      expect(handleCodeFenceEnter(undefined)).toBe(false)
      expect(handleCodeFenceEnter({} as any)).toBe(false)
    })

    it('auto-closes an unclosed code block on Enter', () => {
      const text = '```javascript'
      const view = createTestView(text, text.length)
      const handled = handleCodeFenceEnter(view)
      expect(handled).toBe(true)
      expect(view.state.doc.toString()).toBe('```javascript\n\n```')
      expect(view.state.selection.main.head).toBe(text.length + 1)
    })

    it('does not double-close if already closed below', () => {
      const text = '```javascript\nconst x = 1;\n```'
      const view = createTestView(text, 13)
      const handled = handleCodeFenceEnter(view)
      expect(handled).toBe(false)
    })

    it('auto-expands single-line fenced code block into multi-line', () => {
      const text = '```console.log("hello")```'
      const view = createTestView(text, text.length)
      const handled = handleCodeFenceEnter(view)
      expect(handled).toBe(true)
      expect(view.state.doc.toString()).toBe('```\nconsole.log("hello")\n\n```\n')
    })
  })

  describe('copyCodeAsImage.ts', () => {
    beforeEach(() => {
      // Mock global ClipboardItem
      if (typeof (globalThis as any).ClipboardItem === 'undefined') {
        ;(globalThis as any).ClipboardItem = class ClipboardItem {
          data: any
          constructor(data: any) {
            this.data = data
          }
        }
      }

      // Mock navigator.clipboard
      Object.assign(navigator, {
        clipboard: {
          write: vi.fn().mockResolvedValue(undefined)
        }
      })

      // Mock canvas getContext and toBlob
      HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue({
        scale: vi.fn(),
        createLinearGradient: vi.fn().mockReturnValue({
          addColorStop: vi.fn()
        }),
        fillRect: vi.fn(),
        beginPath: vi.fn(),
        roundRect: vi.fn(),
        fill: vi.fn(),
        stroke: vi.fn(),
        arc: vi.fn(),
        moveTo: vi.fn(),
        lineTo: vi.fn(),
        fillText: vi.fn(),
        save: vi.fn(),
        restore: vi.fn()
      } as any)

      HTMLCanvasElement.prototype.toBlob = vi.fn((cb: any) => {
        cb(new Blob(['dummy-png-content'], { type: 'image/png' }))
      })
    })

    it('throws when code is undefined or null', async () => {
      await expect(copyCodeAsImage(null as any)).rejects.toThrow('No code provided to export')
    })

    it('successfully renders and writes image to clipboard with dark theme', async () => {
      document.documentElement.setAttribute('data-theme', 'dark')
      await expect(
        copyCodeAsImage('const x = 1;\nconsole.log(x);', 'javascript')
      ).resolves.toBeUndefined()
      expect(navigator.clipboard.write).toHaveBeenCalled()
    })

    it('successfully renders and writes image to clipboard with light theme', async () => {
      document.documentElement.setAttribute('data-theme', 'light')
      await expect(
        copyCodeAsImage('import React from "react";', 'typescript')
      ).resolves.toBeUndefined()
      expect(navigator.clipboard.write).toHaveBeenCalled()
    })
  })
})
