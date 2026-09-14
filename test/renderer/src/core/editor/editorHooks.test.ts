import { describe, it, expect, vi } from 'vitest'
import {
  handleCodeFenceEnter,
  handleListEnter,
  isListLine,
  toggleTaskMark,
  handleTaskEnter,
  getQuoteDepth,
  quotePrefix,
  toggleQuoteMark,
  handleQuoteEnter,
  insertCallout,
  CALLOUT_TYPES,
  handleArrowUp,
  handleArrowDown,
  getReplacedBlock,
  EditorState,
  EditorEvent,
  EditorExtensions
} from '../../../../../src/renderer/src/core/editor'

describe('core/editor hooks and helpers', () => {
  describe('ArrowNavigation', () => {
    it('handles null / undefined view safely in handleArrowUp and handleArrowDown', () => {
      expect(handleArrowUp(null)).toBe(false)
      expect(handleArrowUp(undefined)).toBe(false)
      expect(handleArrowDown(null)).toBe(false)
      expect(handleArrowDown(undefined)).toBe(false)
    })

    it('safely evaluates getReplacedBlock with invalid inputs', () => {
      expect(getReplacedBlock(null, 0)).toBeNull()
      expect(getReplacedBlock(undefined, 10)).toBeNull()
      expect(getReplacedBlock({} as any, -1)).toBeNull()
    })
  })

  describe('Direct Export Checks', () => {
    it('exports EditorState function', () => {
      expect(typeof EditorState).toBe('function')
    })

    it('exports EditorEvent function', () => {
      expect(typeof EditorEvent).toBe('function')
    })

    it('exports EditorExtensions function', () => {
      expect(typeof EditorExtensions).toBe('function')
    })
  })

  describe('useList', () => {
    it('identifies list lines properly', () => {
      expect(isListLine('- [ ] Task')).toBe(true)
      expect(isListLine('* Bullet')).toBe(true)
      expect(isListLine('1. Numbered')).toBe(true)
      expect(isListLine('a) Lettered')).toBe(true)
      expect(isListLine('Normal paragraph')).toBe(false)
    })

    it('safely handles null/undefined in handleListEnter', () => {
      expect(handleListEnter(null as any)).toBe(false)
      expect(handleListEnter({} as any)).toBe(false)
    })
  })

  describe('useQuote', () => {
    it('calculates quote depth properly', () => {
      expect(getQuoteDepth('> quote')).toBe(1)
      expect(getQuoteDepth('>> nested')).toBe(2)
      expect(getQuoteDepth('> > nested spaced')).toBe(2)
      expect(getQuoteDepth('no quote')).toBe(0)
    })

    it('formats quotePrefix correctly', () => {
      expect(quotePrefix(0)).toBe('')
      expect(quotePrefix(1)).toBe('> ')
      expect(quotePrefix(2)).toBe('>> ')
    })

    it('safely handles invalid views', () => {
      expect(toggleQuoteMark(null as any)).toBe(false)
      expect(handleQuoteEnter(null as any)).toBe(false)
    })
  })

  describe('useCodeFence', () => {
    it('safely handles invalid views in handleCodeFenceEnter', () => {
      expect(handleCodeFenceEnter(null as any)).toBe(false)
      expect(handleCodeFenceEnter({} as any)).toBe(false)
    })
  })

  describe('useMark', () => {
    it('safely handles invalid views in toggleTaskMark and handleTaskEnter', () => {
      expect(toggleTaskMark(null as any)).toBe(false)
      expect(handleTaskEnter(null as any)).toBe(false)
    })
  })

  describe('useCallout', () => {
    it('has standard callout types with valid labels and colors', () => {
      expect(CALLOUT_TYPES.note).toBeDefined()
      expect(CALLOUT_TYPES.warning).toBeDefined()
      expect(CALLOUT_TYPES.tip).toBeDefined()
      expect(CALLOUT_TYPES.danger).toBeDefined()
      expect(CALLOUT_TYPES.note.label).toBe('Note')
    })

    it('safely handles null view in insertCallout', () => {
      expect(insertCallout(null)).toBe(false)
      expect(insertCallout(undefined)).toBe(false)
    })
  })
})
