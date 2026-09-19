import { describe, it, expect } from 'vitest'
import { computeMinimalChange } from '../../../../../src/renderer/src/core/editor/editorDiff'

describe('computeMinimalChange', () => {
  it('returns no-op when strings are identical', () => {
    const result = computeMinimalChange('hello world', 'hello world')
    expect(result).toEqual({ from: 0, to: 0, insert: '' })
  })

  it('handles empty strings', () => {
    expect(computeMinimalChange('', '')).toEqual({ from: 0, to: 0, insert: '' })
    expect(computeMinimalChange('', 'abc')).toEqual({ from: 0, to: 0, insert: 'abc' })
    expect(computeMinimalChange('abc', '')).toEqual({ from: 0, to: 3, insert: '' })
  })

  it('detects pure append to bottom without touching prefix', () => {
    const oldStr = 'Line 1\nLine 2'
    const newStr = 'Line 1\nLine 2\nLine 3'
    const result = computeMinimalChange(oldStr, newStr)
    expect(result).toEqual({
      from: 13,
      to: 13,
      insert: '\nLine 3'
    })
  })

  it('detects pure prepend to top without touching suffix', () => {
    const oldStr = 'world'
    const newStr = 'hello world'
    const result = computeMinimalChange(oldStr, newStr)
    expect(result).toEqual({
      from: 0,
      to: 0,
      insert: 'hello '
    })
  })

  it('detects middle insertion without touching prefix or suffix', () => {
    const oldStr = 'The quick brown fox'
    const newStr = 'The quick red brown fox'
    const result = computeMinimalChange(oldStr, newStr)
    expect(result).toEqual({
      from: 10,
      to: 10,
      insert: 'red '
    })
  })

  it('detects middle replacement without touching prefix or suffix', () => {
    const oldStr = 'The quick brown fox'
    const newStr = 'The slow brown fox'
    const result = computeMinimalChange(oldStr, newStr)
    expect(result).toEqual({
      from: 4,
      to: 9,
      insert: 'slow'
    })
  })

  it('detects complete replacement when no common prefix/suffix', () => {
    const oldStr = 'abcdef'
    const newStr = 'ghijkl'
    const result = computeMinimalChange(oldStr, newStr)
    expect(result).toEqual({
      from: 0,
      to: 6,
      insert: 'ghijkl'
    })
  })
})
