import { describe, it, expect } from 'vitest'
import { resolveDropZoneInRect } from '../../../../../src/renderer/src/features/Layout/tabDragDrop'

describe('tabDragDrop geometry', () => {
  const rect = { left: 0, top: 0, right: 1000, bottom: 600, width: 1000, height: 600 }

  it('resolves top tabbar strip as tabbar drop zone on other panes', () => {
    expect(resolveDropZoneInRect(rect, 900, 20)).toBe('tabbar')
  })

  it('resolves right, left, top, bottom edges and center accurately', () => {
    expect(resolveDropZoneInRect(rect, 900, 300)).toBe('right')
    expect(resolveDropZoneInRect(rect, 100, 300)).toBe('left')
    expect(resolveDropZoneInRect(rect, 500, 550)).toBe('bottom')
    expect(resolveDropZoneInRect(rect, 500, 80)).toBe('top')
    expect(resolveDropZoneInRect(rect, 500, 300)).toBe('center')
  })

  it('divides full pane into edge zones without dead center when allowCenter is false', () => {
    expect(resolveDropZoneInRect(rect, 500, 200, false)).toBe('top')
    expect(resolveDropZoneInRect(rect, 500, 420, false)).toBe('bottom')
    expect(resolveDropZoneInRect(rect, 200, 318, false)).toBe('left')
    expect(resolveDropZoneInRect(rect, 800, 318, false)).toBe('right')
  })
})
