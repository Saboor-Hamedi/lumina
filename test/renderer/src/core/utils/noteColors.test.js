import { describe, it, expect } from 'vitest'
import { NOTE_COLORS } from '../../../../../src/renderer/src/core/utils/noteColors'

describe('noteColors', () => {
  it('exports an array of color definitions', () => {
    expect(Array.isArray(NOTE_COLORS)).toBe(true)
  })

  it('includes a None option with null hex', () => {
    const none = NOTE_COLORS.find((c) => c.label === 'None')
    expect(none).toBeDefined()
    expect(none.hex).toBeNull()
  })

  it('contains all expected colors', () => {
    const labels = NOTE_COLORS.map((c) => c.label)
    expect(labels).toContain('Red')
    expect(labels).toContain('Orange')
    expect(labels).toContain('Yellow')
    expect(labels).toContain('Green')
    expect(labels).toContain('Blue')
    expect(labels).toContain('Purple')
    expect(labels).toContain('Pink')
  })

  it('every color except None has a 6-char hex code', () => {
    const colorEntries = NOTE_COLORS.filter((c) => c.label !== 'None')
    for (const c of colorEntries) {
      expect(c.hex).toMatch(/^[0-9a-f]{6}$/)
    }
  })

  it('has exactly 10 color definitions', () => {
    expect(NOTE_COLORS).toHaveLength(10)
  })
})
